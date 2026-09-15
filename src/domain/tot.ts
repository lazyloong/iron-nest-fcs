import type { Charge } from "./ballistics";
import { addClock, clockDelta } from "./gameClock";
import {
  missionElevation,
  missionFlightTime,
  type FireMission,
} from "./fireMission";

export type BarrelId = "A" | "B";

/**
 * 每个任务的「开火时刻」表（怀表秒）。
 * 排序与炮位面板都只要这个静态值，不需要当前时间。
 */
export function fireClockSecMap(missions: readonly FireMission[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const m of missions) {
    if (m.impactClockSec === null) continue;
    map.set(m.id, addClock(m.impactClockSec, -missionFlightTime(m)));
  }
  return map;
}

export interface FireStep {
  missionId: string;
  label: string;
  charge: Charge;
  elevationDeg: number;
  flightTimeSec: number;
  bearingDeg: number | null;
  ammoId: string | null;
  /** 目标经过该点的怀表时刻（秒） */
  impactClockSec: number;
  /** 开火时刻（怀表秒）= 目标经过时刻 − 飞行时间 */
  fireClockSec: number;
  /** 距离开火还剩多少秒（负数 = 已过）；未对表时为 null */
  untilSec: number | null;
  /** 分到哪根炮管 */
  barrel: BarrelId;
}

export type ConflictKind =
  | "azimuth-mismatch"
  | "barrel-overflow"
  | "fire-time-past"
  | "no-bearing";

export interface TotConflict {
  kind: ConflictKind;
  message: string;
  missionIds: string[];
  atClockSec: number;
}

export interface TotPlan {
  steps: FireStep[];
  /** 齐射组：同一时刻一起开火的若干发（最多 2 发，一管一发） */
  volleys: FireStep[][];
  conflicts: TotConflict[];
  /** 从第一发开火到最后一发弹着的总跨度（秒） */
  spanSec: number;
}

export interface TotOptions {
  /** 判定"同时开火"的时间容差（秒） */
  toleranceSec?: number;
  /** 两管共享方位，齐射时方位角必须一致的容差（度） */
  bearingToleranceDeg?: number;
  /** 当前怀表时刻（秒），用于算倒计时与判断是否已错过 */
  nowClockSec?: number | null;
}

const DEFAULTS = {
  toleranceSec: 1,
  bearingToleranceDeg: 2,
  nowClockSec: null,
} satisfies Required<TotOptions>;

/** 两角之间的最小夹角（0-180） */
export function angularDiff(a: number, b: number): number {
  return Math.abs(((a - b + 540) % 360) - 180);
}

/**
 * 时间到达弹着（Time on Target）排程。
 *
 * 游戏的时间是**怀表绝对时间**，不是倒计时：
 *   开火时刻 = 目标经过时刻 − 飞行时间
 *
 * 双管约束：
 *  - 两根炮管共享方位角，装药与仰角各自独立
 *  - 齐射（同一时刻开火）只允许发生在同一方位上，
 *    典型用法是同一条方位线上、两个不同距离的目标
 */
export function buildTotPlan(
  missions: FireMission[],
  options: TotOptions = {},
): TotPlan {
  const opts = { ...DEFAULTS, ...options };
  const now = opts.nowClockSec;

  const scheduled = missions.filter(
    (m) => m.impactClockSec !== null && m.status !== "missed",
  );

  const raw = scheduled
    .map<FireStep>((m) => {
      const flightTimeSec = missionFlightTime(m);
      const impactClockSec = m.impactClockSec as number;
      const fireClockSec = addClock(impactClockSec, -flightTimeSec);
      return {
        missionId: m.id,
        label: m.label || m.gridRef || "未命名",
        charge: m.charge,
        elevationDeg: missionElevation(m),
        flightTimeSec,
        bearingDeg: m.bearingDeg,
        ammoId: m.ammoId,
        impactClockSec,
        fireClockSec,
        untilSec: now === null ? null : clockDelta(now, fireClockSec),
        barrel: "A",
      };
    })
    .sort((a, b) => a.fireClockSec - b.fireClockSec);

  // 按开火时刻聚成齐射组
  const volleys: FireStep[][] = [];
  for (const step of raw) {
    const last = volleys[volleys.length - 1];
    if (
      last &&
      Math.abs(last[0]!.fireClockSec - step.fireClockSec) <= opts.toleranceSec
    ) {
      last.push(step);
    } else {
      volleys.push([step]);
    }
  }

  const conflicts: TotConflict[] = [];

  for (const volley of volleys) {
    volley.forEach((step, i) => {
      step.barrel = i === 0 ? "A" : "B";
    });

    if (volley.length > 2) {
      conflicts.push({
        kind: "barrel-overflow",
        message: "同一时刻要打 " + volley.length + " 发，但只有两根炮管",
        missionIds: volley.map((s) => s.missionId),
        atClockSec: volley[0]!.fireClockSec,
      });
    }

    // 齐射必须同方位（两管共享方位角）
    if (volley.length === 2) {
      const a = volley[0]!;
      const b = volley[1]!;
      if (a.bearingDeg === null || b.bearingDeg === null) {
        conflicts.push({
          kind: "no-bearing",
          message: "齐射前需先测出两个目标的方位角",
          missionIds: volley.map((s) => s.missionId),
          atClockSec: a.fireClockSec,
        });
      } else {
        const diff = angularDiff(a.bearingDeg, b.bearingDeg);
        if (diff > opts.bearingToleranceDeg) {
          conflicts.push({
            kind: "azimuth-mismatch",
            message:
              "齐射两发方位相差 " +
              diff.toFixed(1) +
              "°，两管共享方位角，无法同时开火",
            missionIds: volley.map((s) => s.missionId),
            atClockSec: a.fireClockSec,
          });
        }
      }
    }

    for (const step of volley) {
      if (step.untilSec !== null && step.untilSec < 0) {
        conflicts.push({
          kind: "fire-time-past",
          message: step.label + " 的开火时刻已经错过",
          missionIds: [step.missionId],
          atClockSec: step.fireClockSec,
        });
      }
    }
  }

  const first = raw[0];
  const last = raw[raw.length - 1];
  const spanSec =
    first && last
      ? Math.max(0, clockDelta(first.fireClockSec, last.impactClockSec))
      : 0;

  return { steps: raw, volleys, conflicts, spanSec };
}

/** 找出下一个还没到点、且最紧要的开火步骤 */
export function nextStep(plan: TotPlan): FireStep | null {
  const upcoming = plan.steps
    .filter((s) => s.untilSec !== null && s.untilSec >= 0)
    .sort((a, b) => (a.untilSec as number) - (b.untilSec as number));
  return upcoming[0] ?? null;
}


