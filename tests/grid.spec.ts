import { describe, expect, it } from "vitest";
import {
  bearingDeg,
  distanceKm,
  formatGridRef,
  gridRefFromPolar,
  gridRefToPlane,
  isWithinMap,
  parseGridRef,
  solveFromGridRefs,
  type GridRef,
} from "../src/domain/grid";
import { angularDiff } from "../src/domain/tot";

const ref = (s: string): GridRef => {
  const r = parseGridRef(s);
  if (!r) throw new Error("bad ref: " + s);
  return r;
};

describe("地图范围 A-T x 1-10", () => {
  it("接受边界格位", () => {
    expect(parseGridRef("A1")).toEqual({ col: "A", row: 1, x: 0, y: 0 });
    expect(parseGridRef("T10 9:9")).toEqual({ col: "T", row: 10, x: 9, y: 9 });
  });

  it("拒绝越界列与行", () => {
    expect(parseGridRef("U1")).toBeNull();
    expect(parseGridRef("Z5")).toBeNull();
    expect(parseGridRef("A0")).toBeNull();
    expect(parseGridRef("A11")).toBeNull();
  });

  it("isWithinMap 与解析结果一致", () => {
    expect(isWithinMap({ col: "B", row: 5, x: 0, y: 0 })).toBe(true);
    expect(isWithinMap({ col: "B", row: 0, x: 0, y: 0 })).toBe(false);
    expect(isWithinMap({ col: "U", row: 5, x: 0, y: 0 })).toBe(false);
  });
});

describe("parseGridRef", () => {
  it("解析完整格位", () => {
    expect(parseGridRef("I5 6:8")).toEqual({ col: "I", row: 5, x: 6, y: 8 });
  });

  it("容忍大小写、全角冒号、无空格、逗号与多余空格", () => {
    const expected = { col: "I", row: 5, x: 6, y: 8 };
    expect(parseGridRef("i5 6：8")).toEqual(expected);
    expect(parseGridRef("I56:8")).toEqual(expected);
    expect(parseGridRef(" I5  6 : 8 ")).toEqual(expected);
    expect(parseGridRef("i5,6:8")).toEqual(expected);
  });

  it("只写大格时子坐标归零", () => {
    expect(parseGridRef("A1")).toEqual({ col: "A", row: 1, x: 0, y: 0 });
    expect(parseGridRef("T10")).toEqual({ col: "T", row: 10, x: 0, y: 0 });
  });

  it("拒绝非法输入", () => {
    expect(parseGridRef("")).toBeNull();
    expect(parseGridRef("55")).toBeNull();
    expect(parseGridRef("I5 10:0")).toBeNull();
    expect(parseGridRef("I5 6:99")).toBeNull();
    expect(parseGridRef("I5 6")).toBeNull();
  });

  it("格式化回写", () => {
    expect(formatGridRef({ col: "I", row: 5, x: 6, y: 8 })).toBe("I5 68");
  });
});

describe("gridRefToPlane：1 大格 = 1 km，1 子格 = 0.1 km", () => {
  it("大格步进", () => {
    expect(gridRefToPlane(ref("A1"))).toEqual({ east: 0, south: 1 });
    expect(gridRefToPlane(ref("B1")).east).toBeCloseTo(1, 10);
    expect(gridRefToPlane(ref("A2")).south).toBeCloseTo(2, 10);
  });

  it("子格步进", () => {
    const p = gridRefToPlane(ref("A1 4:7"));
    expect(p.east).toBeCloseTo(0.4, 10);
    expect(p.south).toBeCloseTo(1.7, 10);
  });

  it("整张地图 20 km x 10 km", () => {
    const tl = gridRefToPlane(ref("A1 0:0"));
    const br = gridRefToPlane(ref("T10 9:9"));
    expect(br.east - tl.east).toBeCloseTo(19.9, 10);
    expect(br.south - tl.south).toBeCloseTo(9.9, 10);
  });
});

describe("distanceKm", () => {
  it("同一大格内对角", () => {
    expect(distanceKm(ref("A1 0:0"), ref("A1 9:9"))).toBeCloseTo(
      Math.hypot(0.9, 0.9),
      10,
    );
  });

  it("相邻大格同子位距离恰为 1 km", () => {
    expect(distanceKm(ref("A1 5:5"), ref("B1 5:5"))).toBeCloseTo(1, 10);
    expect(distanceKm(ref("A1 5:5"), ref("A2 5:5"))).toBeCloseTo(1, 10);
  });

  it("3-4-5 直角三角形（列差 3、行差 4）", () => {
    expect(distanceKm(ref("A1"), ref("D5"))).toBeCloseTo(5, 10);
  });

  it("列差 2、行差 3 时为 hypot(2,3)", () => {
    expect(distanceKm(ref("A1"), ref("C4"))).toBeCloseTo(Math.hypot(2, 3), 10);
  });

  it("全图对角线", () => {
    expect(distanceKm(ref("A1 0:0"), ref("T10 9:9"))).toBeCloseTo(
      Math.hypot(19.9, 9.9),
      10,
    );
  });

  it("对称性", () => {
    const a = ref("A1 3:4");
    const b = ref("I5 6:8");
    expect(distanceKm(a, b)).toBeCloseTo(distanceKm(b, a), 12);
  });
});

describe("bearingDeg", () => {
  it("行号增大 = 0 度、列增大 = 90 度（实测校准）", () => {
    const o = ref("E5 5:5");
    expect(bearingDeg(o, ref("E6 5:5"))).toBeCloseTo(0, 6); // 行号增大
    expect(bearingDeg(o, ref("F5 5:5"))).toBeCloseTo(90, 6);
    expect(bearingDeg(o, ref("E5 5:0"))).toBeCloseTo(180, 6); // 行号减小
    expect(bearingDeg(o, ref("D5 5:5"))).toBeCloseTo(270, 6);
  });

  it("结果始终落在 0-360", () => {
    const o = ref("A1");
    for (const t of ["A2", "B2", "B1", "T10 9:9"]) {
      const b = bearingDeg(o, ref(t));
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThan(360);
    }
  });
});

describe("solveFromGridRefs", () => {
  it("一次算出距离与方位角", () => {
    const s = solveFromGridRefs(ref("A1 0:0"), ref("D5 0:0"));
    expect(s.distanceKm).toBeCloseTo(5, 10);
    expect(s.bearingDeg).toBeGreaterThan(0);
    expect(s.bearingDeg).toBeLessThan(90);
  });
});

describe("gridRefFromPolar · 距离/方位角 → 格位（反解）", () => {
  it("A1 0:0 + 9.8 km + 119.2° ≈ I5 6:8", () => {
    expect(gridRefFromPolar(ref("A1 0:0"), 9.8, 60.8)).toEqual({
      col: "I",
      row: 5,
      x: 6,
      y: 8,
    });
  });

  it("四个正方向各走 2 km（原点 J5 5:5）", () => {
    const o = ref("J5 5:5");
    expect(gridRefFromPolar(o, 2, 0)).toEqual({ col: "J", row: 7, x: 5, y: 5 }); // 正北：行号减小
    expect(gridRefFromPolar(o, 2, 90)).toEqual({
      col: "L",
      row: 5,
      x: 5,
      y: 5,
    }); // 正东：列 +2
    expect(gridRefFromPolar(o, 2, 180)).toEqual({
      col: "J",
      row: 3,
      x: 5,
      y: 5,
    }); // 正南：行号增大
    expect(gridRefFromPolar(o, 2, 270)).toEqual({
      col: "H",
      row: 5,
      x: 5,
      y: 5,
    }); // 正西
  });

  it("零距离原地不动", () => {
    expect(gridRefFromPolar(ref("I5 6:8"), 0, 45)).toEqual({
      col: "I",
      row: 5,
      x: 6,
      y: 8,
    });
  });

  it("落在图外返回 null", () => {
    expect(gridRefFromPolar(ref("A1 0:0"), 5, 270)).toBeNull();
    expect(gridRefFromPolar(ref("A1"), -1, 0)).toBeNull();
  });

  it("与正解往返一致（0.1 km 量化内）", () => {
    const o = ref("F4 5:5");
    for (let d = 1; d <= 8; d += 0.9) {
      for (let b = 0; b < 360; b += 41) {
        const t = gridRefFromPolar(o, d, b);
        if (t === null) continue;
        expect(distanceKm(o, t)).toBeCloseTo(d, 0);
        expect(angularDiff(bearingDeg(o, t), b)).toBeLessThan(2.5);
      }
    }
  });
});

describe("格位省略分隔符（连写）", () => {
  it("三种等价写法都指向 I5 6:8", () => {
    const expected = { col: "I", row: 5, x: 6, y: 8 };
    expect(parseGridRef("I5 68")).toEqual(expected);
    expect(parseGridRef("I568")).toEqual(expected);
    expect(parseGridRef("i568")).toEqual(expected);
    expect(parseGridRef("I5 6 8")).toEqual(expected);
    expect(parseGridRef("I5.6-8")).toEqual(expected);
    expect(parseGridRef("I5 6:8")).toEqual(expected); // 旧写法仍然兼容
  });

  it("行号 10 的连写", () => {
    expect(parseGridRef("J10 37")).toEqual({ col: "J", row: 10, x: 3, y: 7 });
    expect(parseGridRef("J1037")).toEqual({ col: "J", row: 10, x: 3, y: 7 });
    expect(parseGridRef("T1099")).toEqual({ col: "T", row: 10, x: 9, y: 9 });
  });

  it("只写大格", () => {
    expect(parseGridRef("A1")).toEqual({ col: "A", row: 1, x: 0, y: 0 });
    expect(parseGridRef("B5")).toEqual({ col: "B", row: 5, x: 0, y: 0 });
    expect(parseGridRef("J10")).toEqual({ col: "J", row: 10, x: 0, y: 0 });
    expect(parseGridRef("A100")).toEqual({ col: "A", row: 1, x: 0, y: 0 });
  });

  it("行号两位优先，避免与 1 位行号歧义", () => {
    // "1099" 只能是 10 行 + 9:9，不能是 1 行 + 0:9 加一个多余数字
    expect(parseGridRef("J1099")).toEqual({ col: "J", row: 10, x: 9, y: 9 });
  });

  it("仍然拒绝非法输入", () => {
    expect(parseGridRef("5689")).toBeNull();
    expect(parseGridRef("I5689")).toBeNull();
    expect(parseGridRef("I")).toBeNull();
    expect(parseGridRef("I  ")).toBeNull();
  });

  it("反解出来的格位能直接被解析回去", () => {
    const ref = gridRefFromPolar({ col: "A", row: 1, x: 0, y: 0 }, 9.8, 60.8);
    expect(ref).not.toBeNull();
    const text = formatGridRef(ref!);
    expect(text).toBe("I5 68");
    expect(parseGridRef(text)).toEqual(ref);
  });
});

describe("实测校准：游戏内真值", () => {
  it("铁巢 d295 → 目标 p604 应为 11.79 km / 70.7°", () => {
    const origin = parseGridRef("d295");
    const target = parseGridRef("p604");
    expect(origin).toEqual({ col: "D", row: 2, x: 9, y: 5 });
    expect(target).toEqual({ col: "P", row: 6, x: 0, y: 4 });

    const s = solveFromGridRefs(origin!, target!);
    // 游戏读数 11.79 km（本实现 11.765，差 0.03）
    expect(s.distanceKm).toBeCloseTo(11.79, 1);
    // 游戏读数 70.7 度（本实现 70.65，差 0.05）
    expect(Math.abs(s.bearingDeg - 70.7)).toBeLessThan(0.2);
  });

  it("反解回去也应落在 p604", () => {
    const origin = parseGridRef("d295")!;
    const back = gridRefFromPolar(origin, 11.765, 70.65);
    expect(back).toEqual({ col: "P", row: 6, x: 0, y: 4 });
  });
});
