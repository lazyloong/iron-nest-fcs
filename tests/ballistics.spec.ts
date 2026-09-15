import { describe, expect, it } from "vitest";
import {
  ALL_CHARGES,
  chargeCoefficient,
  compareCharges,
  distanceFromElevation,
  elevationDeg,
  flightTimeSec,
  maxRangeKm,
  minChargeFor,
  muzzleSpeedKmps,
  solve,
  type Charge,
} from "../src/domain/ballistics";
import { MAX_ELEVATION_DEG } from "../src/domain/constants";

/* =========================================================================
 * 金值表 —— 全部来自「游戏内火控台实测截图」与 WIKI 计算器源码
 * 玩家实测（距离 5 km）：
 *   1 档 → 60° / 弹速 0.21   / 飞行 23.8 s
 *   2 档 → 30° / 弹速 0.26   / 飞行 19.2 s
 *   3 档 → 20° / 弹速 0.38   / 飞行 13.1 s
 * ========================================================================= */

describe("实测金值（距离 5 km）", () => {
  it("仰角与实测完全一致", () => {
    expect(elevationDeg(5, 1)).toBeCloseTo(60, 10);
    expect(elevationDeg(5, 2)).toBeCloseTo(30, 10);
    expect(elevationDeg(5, 3)).toBeCloseTo(20, 10);
  });

  it("弹速与实测完全一致", () => {
    expect(muzzleSpeedKmps(1)).toBeCloseTo(0.21, 5);
    expect(muzzleSpeedKmps(2)).toBeCloseTo(0.26096, 5);
    expect(muzzleSpeedKmps(3)).toBeCloseTo(0.38248, 5);
  });

  it("飞行时间与实测显示口径一致", () => {
    expect(flightTimeSec(5, 1).toFixed(1)).toBe("23.8");
    expect(flightTimeSec(5, 2).toFixed(1)).toBe("19.2");
    expect(flightTimeSec(5, 3).toFixed(1)).toBe("13.1");
  });
});

describe("全档位金值表", () => {
  const golden: Array<{
    c: Charge;
    coeff: number;
    speed: number;
    maxRange: number;
  }> = [
    { c: 1, coeff: 0.3, speed: 0.21, maxRange: 5 },
    { c: 2, coeff: 0.3728, speed: 0.26096, maxRange: 10 },
    { c: 3, coeff: 0.5464, speed: 0.38248, maxRange: 15 },
    { c: 4, coeff: 0.7536, speed: 0.52752, maxRange: 20 },
    { c: 5, coeff: 0.9272, speed: 0.64904, maxRange: 25 },
    { c: 6, coeff: 1.0, speed: 0.7, maxRange: 30 },
  ];

  it.each(golden)(
    "$c 档：系数 $coeff / 弹速 $speed / 上限 $maxRange km",
    ({ c, coeff, speed, maxRange }) => {
      expect(chargeCoefficient(c)).toBeCloseTo(coeff, 6);
      expect(muzzleSpeedKmps(c)).toBeCloseTo(speed, 6);
      expect(maxRangeKm(c)).toBe(maxRange);
    },
  );

  it("装药系数单调递增", () => {
    for (let i = 1; i < ALL_CHARGES.length; i++) {
      const prev = chargeCoefficient(ALL_CHARGES[i - 1] as Charge);
      const curr = chargeCoefficient(ALL_CHARGES[i] as Charge);
      expect(curr).toBeGreaterThan(prev);
    }
  });
});

describe("闭环一致性", () => {
  it("满装药射程处仰角恒为 60°（与机械上限吻合）", () => {
    for (const c of ALL_CHARGES) {
      expect(elevationDeg(maxRangeKm(c), c)).toBeCloseTo(MAX_ELEVATION_DEG, 10);
    }
  });

  it("任意可行解都不超过机械上限", () => {
    for (const c of ALL_CHARGES) {
      for (let d = 0.1; d <= maxRangeKm(c) + 1e-9; d += 0.1) {
        const elev = elevationDeg(d, c);
        if (d <= maxRangeKm(c)) {
          expect(elev).toBeLessThanOrEqual(MAX_ELEVATION_DEG + 1e-9);
        }
      }
    }
  });

  it("正解 / 反解往返一致", () => {
    for (const c of ALL_CHARGES) {
      for (const d of [0.5, 3.3, 7.7, 12.25, 29.9]) {
        const elev = elevationDeg(d, c);
        expect(distanceFromElevation(elev, c)).toBeCloseTo(d, 10);
      }
    }
  });
});

describe("自动选最小档", () => {
  it.each([
    [1, 1],
    [5, 1],
    [5.01, 2],
    [10, 2],
    [10.01, 3],
    [30, 6],
    [35, 6],
  ])("距离 %s km → %s 档", (distance, expected) => {
    expect(minChargeFor(distance)).toBe(expected);
  });

  it("solve() 不带档位时自动选档并标记 auto", () => {
    const s = solve(12);
    expect(s.charge).toBe(3);
    expect(s.auto).toBe(true);
    expect(s.elevationDeg).toBeCloseTo(48, 10);
    expect(s.warnings).toHaveLength(0);
  });

  it("solve() 带档位时不覆盖用户选择", () => {
    const s = solve(12, 6);
    expect(s.charge).toBe(6);
    expect(s.auto).toBe(false);
    expect(s.elevationDeg).toBeCloseTo(24, 10);
  });
});

describe("校验告警", () => {
  it("超程时给出至少需要几档", () => {
    const [w] = solve(12, 2).warnings;
    expect(w?.code).toBe("OUT_OF_RANGE");
    expect(w?.message).toContain("至少需要 3 档");
  });

  it("距离为 0 或负数时告警", () => {
    expect(solve(0, 1).warnings[0]?.code).toBe("DISTANCE_INVALID");
    expect(solve(-5, 1).warnings[0]?.code).toBe("DISTANCE_INVALID");
  });

  it("超过全地图 30 km 上限时告警", () => {
    const codes = solve(31, 6).warnings.map((w) => w.code);
    expect(codes).toContain("DISTANCE_OVER_MAP_MAX");
    expect(codes).toContain("OUT_OF_RANGE");
  });

  it("正常解无告警", () => {
    expect(solve(20, 5).warnings).toHaveLength(0);
  });
});

describe("compareCharges 对照表", () => {
  it("12 km 时 1、2 档不可行，3 档起可行", () => {
    const table = compareCharges(12);
    expect(table).toHaveLength(6);
    expect(table[0]?.feasible).toBe(false);
    expect(table[1]?.feasible).toBe(false);
    expect(table[2]?.feasible).toBe(true);
    expect(table[2]?.elevationDeg).toBeCloseTo(48, 10);
  });

  it("不可行档位带原因说明", () => {
    const table = compareCharges(12);
    expect(table[0]?.reason).toContain("超 5 km 上限");
  });

  it("距离越大所需档位越高", () => {
    const firstFeasible = (d: number) =>
      compareCharges(d).find((o) => o.feasible)?.charge;
    expect(firstFeasible(3)).toBe(1);
    expect(firstFeasible(8)).toBe(2);
    expect(firstFeasible(18)).toBe(4);
    expect(firstFeasible(27)).toBe(6);
  });
});
