import { describe, expect, it } from "vitest";
import { createMission, type FireMission } from "../src/domain/fireMission";
import { formatClockTime } from "../src/domain/gameClock";
import { angularDiff, buildTotPlan } from "../src/domain/tot";

function mission(input: Partial<FireMission>): FireMission {
  return createMission({ label: "T", distanceKm: 10, ...input });
}

/** 简报常见的绝对时刻：12:47 */
const T1247 = 12 * 3600 + 47 * 60;

describe("怀表时间反推", () => {
  it("开火时刻 = 目标经过时刻 − 飞行时间", () => {
    const m = mission({ distanceKm: 5, charge: 1, impactClockSec: T1247 });
    const step = buildTotPlan([m]).steps[0]!;
    expect(step.flightTimeSec).toBeCloseTo(23.8095, 3);
    expect(step.fireClockSec).toBeCloseTo(T1247 - 23.8095, 3);
    // 12:47:00 减去 23.8 秒
    expect(formatClockTime(step.fireClockSec)).toBe("12:46:36");
  });

  it("跨零点自动回绕", () => {
    const m = mission({ distanceKm: 5, charge: 1, impactClockSec: 10 });
    const step = buildTotPlan([m]).steps[0]!;
    expect(formatClockTime(step.fireClockSec)).toBe("23:59:46");
  });

  it("保证同时弹着：远目标先开火", () => {
    const near = mission({
      label: "近",
      distanceKm: 5,
      charge: 1,
      impactClockSec: T1247,
    });
    const far = mission({
      label: "远",
      distanceKm: 25,
      charge: 5,
      impactClockSec: T1247,
    });
    const plan = buildTotPlan([near, far]);
    const a = plan.steps.find((s) => s.missionId === far.id)!;
    const b = plan.steps.find((s) => s.missionId === near.id)!;
    expect(a.fireClockSec).toBeLessThan(b.fireClockSec);
    expect(a.impactClockSec).toBe(b.impactClockSec);
  });

  it("未填经过时刻的任务不进排程", () => {
    expect(
      buildTotPlan([mission({ impactClockSec: null })]).steps,
    ).toHaveLength(0);
  });
});

describe("倒计时（对表之后）", () => {
  it("还剩 = 开火时刻 − 当前怀表时刻", () => {
    const m = mission({ distanceKm: 5, charge: 1, impactClockSec: T1247 });
    const fire = T1247 - 23.8095;
    const plan = buildTotPlan([m], { nowClockSec: fire - 300 });
    expect(plan.steps[0]!.untilSec).toBeCloseTo(300, 3);
  });

  it("已对表且开火时刻已过 → 告警", () => {
    const m = mission({ distanceKm: 5, charge: 1, impactClockSec: T1247 });
    const plan = buildTotPlan([m], { nowClockSec: T1247 });
    expect(plan.steps[0]!.untilSec).toBeLessThan(0);
    expect(plan.conflicts.some((c) => c.kind === "fire-time-past")).toBe(true);
  });

  it("未对表时不给倒计时，也不报已过", () => {
    const m = mission({ distanceKm: 5, charge: 1, impactClockSec: T1247 });
    const plan = buildTotPlan([m]);
    expect(plan.steps[0]!.untilSec).toBeNull();
    expect(plan.conflicts).toHaveLength(0);
  });
});

describe("双管约束（两管共享方位、独立仰角）", () => {
  it("同一时刻要打三发 → 炮管不够", () => {
    const list = [1, 2, 3].map((i) =>
      mission({
        label: "T" + i,
        distanceKm: 5,
        charge: 1,
        bearingDeg: 90,
        impactClockSec: T1247,
      }),
    );
    const plan = buildTotPlan(list);
    expect(plan.conflicts.some((c) => c.kind === "barrel-overflow")).toBe(true);
  });

  it("齐射但方位不同 → 冲突", () => {
    const a = mission({
      label: "A",
      distanceKm: 5,
      charge: 1,
      bearingDeg: 90,
      impactClockSec: T1247,
    });
    const b = mission({
      label: "B",
      distanceKm: 5,
      charge: 1,
      bearingDeg: 40,
      impactClockSec: T1247,
    });
    const plan = buildTotPlan([a, b]);
    expect(plan.conflicts.some((c) => c.kind === "azimuth-mismatch")).toBe(
      true,
    );
  });

  it("齐射同方位 → 无冲突，且分到 A/B 两管", () => {
    const a = mission({
      label: "A",
      distanceKm: 5,
      charge: 1,
      bearingDeg: 90,
      impactClockSec: T1247,
    });
    const b = mission({
      label: "B",
      distanceKm: 5,
      charge: 1,
      bearingDeg: 91,
      impactClockSec: T1247,
    });
    const plan = buildTotPlan([a, b]);
    expect(plan.conflicts).toHaveLength(0);
    expect(new Set(plan.steps.map((s) => s.barrel))).toEqual(
      new Set(["A", "B"]),
    );
  });

  it("同方位不同距离 → 两个不同仰角（双管的正当用法）", () => {
    const near = mission({
      label: "近",
      distanceKm: 6,
      charge: 2,
      bearingDeg: 90,
      impactClockSec: 60 + T1247,
    });
    const far = mission({
      label: "远",
      distanceKm: 14,
      charge: 4,
      bearingDeg: 90,
      impactClockSec: T1247,
    });
    const plan = buildTotPlan([near, far]);
    const a = plan.steps.find((s) => s.missionId === near.id)!;
    const b = plan.steps.find((s) => s.missionId === far.id)!;
    expect(a.elevationDeg).toBeCloseTo(36, 10); // 12 × 6 ÷ 2
    expect(b.elevationDeg).toBeCloseTo(42, 10); // 12 × 14 ÷ 4
    expect(a.bearingDeg).toBe(b.bearingDeg);
    expect(a.elevationDeg).not.toBe(b.elevationDeg);
  });
});

describe("angularDiff", () => {
  it("跨 0 度也正确", () => {
    expect(angularDiff(359, 1)).toBeCloseTo(2, 10);
    expect(angularDiff(10, 350)).toBeCloseTo(20, 10);
    expect(angularDiff(90, 270)).toBeCloseTo(180, 10);
  });
});
