import { solve, type Charge, type Solution } from "./ballistics";
import type { BarrelId } from "./constants";

/** 任务状态：计划 → 已装填 → 已击发 → 命中/未中 */
export type MissionStatus = "planned" | "loaded" | "fired" | "hit" | "missed";

export interface FireMission {
  id: string;
  /** 目标名/编号，如 "A 地堡" */
  label: string;
  /** 格位文本，如 "I5 6:8" */
  gridRef: string;
  /** 实测距离 km */
  distanceKm: number;
  /** 方位角 0-360；null = 未测 */
  bearingDeg: number | null;
  charge: Charge;
  /** true = 自动选最小档，距离变化时档位跟随 */
  auto: boolean;
  /** 弹种 id；null = 未选 */
  ammoId: string | null;
  /** 目标经过该点的怀表时刻（一天内秒数）；null = 未设定 */
  impactClockSec: number | null;
  status: MissionStatus;
  note: string;
  createdAt: number;
  /** 击发时刻（本地 epoch ms）；null = 尚未击发 */
  firedAt: number | null;
  /** 手动指定的炮位；null = 按队列位次自动交替 */
  barrelOverride: BarrelId | null;
}

export function newMissionId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function createMission(input: Partial<FireMission> = {}): FireMission {
  const distanceKm = input.distanceKm ?? 5;
  // 显式给了档位就视为手动档，避免 auto 把用户选择覆盖掉
  const auto = input.auto ?? input.charge === undefined;
  const base = auto ? solve(distanceKm) : solve(distanceKm, input.charge);

  return {
    id: input.id ?? newMissionId(),
    label: input.label ?? "",
    gridRef: input.gridRef ?? "",
    distanceKm,
    bearingDeg: input.bearingDeg ?? null,
    charge: base.charge,
    auto,
    ammoId: input.ammoId ?? null,
    impactClockSec: input.impactClockSec ?? null,
    status: input.status ?? "planned",
    note: input.note ?? "",
    createdAt: input.createdAt ?? Date.now(),
    firedAt: input.firedAt ?? null,
    barrelOverride: input.barrelOverride ?? null,
  };
}

/** 任务的当前解算结果 */
export function missionSolution(mission: FireMission): Solution {
  return mission.auto
    ? solve(mission.distanceKm)
    : solve(mission.distanceKm, mission.charge);
}

export function missionElevation(mission: FireMission): number {
  return missionSolution(mission).elevationDeg;
}

export function missionFlightTime(mission: FireMission): number {
  return missionSolution(mission).flightTimeSec;
}

export function missionSpeed(mission: FireMission): number {
  return missionSolution(mission).muzzleSpeedKmps;
}

/** 任务是否可执行（不超程、不超机械上限） */
export function isMissionFeasible(mission: FireMission): boolean {
  return missionSolution(mission).warnings.length === 0;
}

