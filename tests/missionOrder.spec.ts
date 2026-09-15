import { describe, expect, it } from "vitest";
import {
  createMission,
  type FireMission,
  type MissionStatus,
} from "../src/domain/fireMission";
import {
  angularDistance,
  groupIntoStops,
  orderByMinTraverse,
  orderMissions,
  totalTraverseDeg,
} from "../src/domain/missionOrder";

function m(
  id: string,
  status: MissionStatus = "planned",
  bearingDeg: number | null = null,
): FireMission {
  return {
    ...createMission({ label: id, distanceKm: 10 }),
    id,
    status,
    bearingDeg,
  };
}

const ids = (list: FireMission[]) => list.map((x) => x.id);

describe("angularDistance · 环形最短夹角", () => {
  it("不跨零", () => {
    expect(angularDistance(10, 40)).toBe(30);
  });
  it("跨零取环内角", () => {
    expect(angularDistance(350, 10)).toBe(20);
    expect(angularDistance(359, 1)).toBe(2);
  });
  it("结果不超过 180", () => {
    expect(angularDistance(0, 200)).toBe(160);
    expect(angularDistance(0, 180)).toBe(180);
  });
});

describe("orderByMinTraverse · 最小回转排序", () => {
  const angle = (x: { a: number }) => x.a;

  it("连续角度保持原序", () => {
    const list = [{ a: 20 }, { a: 0 }, { a: 10 }];
    expect(orderByMinTraverse(list, angle).map((x) => x.a)).toEqual([
      0, 10, 20,
    ]);
  });

  it("跨零点：从最大间隙之后起头", () => {
    // 排序后 10, 20, 350；最大间隙在 20→350（330 度）
    const list = [{ a: 350 }, { a: 10 }, { a: 20 }];
    expect(orderByMinTraverse(list, angle).map((x) => x.a)).toEqual([
      350, 10, 20,
    ]);
  });

  it("总回转 = 360 - 最大间隙", () => {
    const list = [{ a: 350 }, { a: 10 }, { a: 20 }];
    const sorted = orderByMinTraverse(list, angle);
    expect(totalTraverseDeg(sorted, angle)).toBeCloseTo(30, 6); // 350→10 = 20，10→20 = 10
  });

  it("不要来回横跳（反例：朴素按输入顺序会绕远）", () => {
    const list = [{ a: 0 }, { a: 180 }, { a: 90 }];
    const sorted = orderByMinTraverse(list, angle);
    const naive = totalTraverseDeg(list, angle); // 0→180 = 180，180→90 = 90，共 270
    const best = totalTraverseDeg(sorted, angle); // 0→90→180 = 180
    expect(best).toBeLessThan(naive);
    expect(best).toBeCloseTo(180, 6);
  });

  it("单点与空集不出错", () => {
    expect(orderByMinTraverse([], angle)).toEqual([]);
    expect(orderByMinTraverse([{ a: 42 }], angle).map((x) => x.a)).toEqual([
      42,
    ]);
  });

  it("给了炮口方位就从更近的一端起头", () => {
    const list = [{ a: 0 }, { a: 90 }, { a: 180 }];
    // 炮口在 175 度：更靠近 180 那一端，应从 180 扫回 0
    expect(orderByMinTraverse(list, angle, 175).map((x) => x.a)).toEqual([
      180, 90, 0,
    ]);
    // 炮口在 5 度：从 0 扫到 180
    expect(orderByMinTraverse(list, angle, 5).map((x) => x.a)).toEqual([
      0, 90, 180,
    ]);
  });

  it("起头方向不影响总回转", () => {
    const list = [{ a: 0 }, { a: 90 }, { a: 180 }];
    const a = totalTraverseDeg(orderByMinTraverse(list, angle, 175), angle);
    const b = totalTraverseDeg(orderByMinTraverse(list, angle, 5), angle);
    expect(a).toBeCloseTo(b, 6);
  });
});

describe("orderMissions · 未击发置顶 + 三种排序", () => {
  it("未击发恒在已完成之前", () => {
    const list = [m("a", "hit"), m("b", "planned"), m("c", "fired")];
    expect(ids(orderMissions(list, "manual"))).toEqual(["b", "a", "c"]);
    expect(ids(orderMissions(list, "time"))).toEqual(["b", "a", "c"]);
    expect(ids(orderMissions(list, "traverse"))).toEqual(["b", "a", "c"]);
  });

  it("time：组内按开火时刻升序，没填的沉底", () => {
    const list = [m("late"), m("none"), m("early")];
    const map = new Map([
      ["late", 40000],
      ["early", 38000],
    ]);
    expect(ids(orderMissions(list, "time", { fireClockSecById: map }))).toEqual(
      ["early", "late", "none"],
    );
  });

  it("traverse：按方位角最小回转排序", () => {
    const list = [
      m("t350", "planned", 350),
      m("t10", "planned", 10),
      m("t20", "planned", 20),
    ];
    expect(ids(orderMissions(list, "traverse"))).toEqual([
      "t350",
      "t10",
      "t20",
    ]);
  });

  it("traverse：没方位角的沉到未击发组底部", () => {
    const list = [
      m("none", "planned", null),
      m("b", "planned", 90),
      m("a", "planned", 0),
    ];
    expect(ids(orderMissions(list, "traverse"))).toEqual(["a", "b", "none"]);
  });

  it("manual：完全保留输入顺序", () => {
    const list = [
      m("c", "planned", 350),
      m("a", "planned", 0),
      m("b", "planned", 180),
    ];
    expect(ids(orderMissions(list, "manual"))).toEqual(["c", "a", "b"]);
  });

  it("不改动原数组", () => {
    const list = [m("a", "hit"), m("b", "planned")];
    const before = ids(list);
    orderMissions(list, "traverse");
    expect(ids(list)).toEqual(before);
  });

  it("空数组不出错", () => {
    expect(orderMissions([], "traverse")).toEqual([]);
  });
});

describe("双管预装 · 停靠点", () => {
  const angle = (x: { a: number }) => x.a;

  it("同方位两两配对", () => {
    const stops = groupIntoStops([{ a: 0 }, { a: 1 }, { a: 90 }], angle, 2);
    expect(stops.map((s) => s.members.map((m) => m.a))).toEqual([[0, 1], [90]]);
    expect(stops[0]!.bearingDeg).toBeCloseTo(0.5, 6);
  });

  it("超容差不配对", () => {
    const stops = groupIntoStops([{ a: 0 }, { a: 5 }, { a: 10 }], angle, 2);
    expect(stops.map((s) => s.members.length)).toEqual([1, 1, 1]);
  });

  it("四点配成两组", () => {
    const stops = groupIntoStops(
      [{ a: 0 }, { a: 1 }, { a: 2 }, { a: 3 }],
      angle,
      2,
    );
    expect(stops.map((s) => s.members.length)).toEqual([2, 2]);
  });

  it("跨零点也能配对，中值不回绕", () => {
    const stops = groupIntoStops([{ a: 359 }, { a: 0 }], angle, 2);
    expect(stops).toHaveLength(1);
    expect(stops[0]!.bearingDeg).toBeCloseTo(359.5, 6);
  });

  it("空集不出错", () => {
    expect(groupIntoStops([], angle, 2)).toEqual([]);
  });

  it("配对只合并方位，省的是装填不是转向", () => {
    const stops = groupIntoStops([{ a: 350 }, { a: 10 }, { a: 11 }], angle, 2);
    expect(stops.map((s) => s.members.map((m) => m.a))).toEqual([
      [10, 11],
      [350],
    ]);
    // 组内两目标本来就只差 1 度 —— 转向省不了多少，
    // 真正省下的是「一次装填」（两发可以提前都装好）
    expect(angularDistance(10, 11)).toBe(1);
  });
});

describe("orderMissions · traverse 模式内建双管配对", () => {
  it("同方位的两条被排在一起", () => {
    const list = [
      m("far", "planned", 200),
      m("b1", "planned", 10),
      m("b2", "planned", 11),
    ];
    expect(ids(orderMissions(list, "traverse"))).toEqual(["far", "b1", "b2"]);
  });

  it("没方位角的仍然沉底", () => {
    const list = [
      m("none", "planned", null),
      m("a", "planned", 10),
      m("b", "planned", 11),
    ];
    expect(ids(orderMissions(list, "traverse"))).toEqual(["a", "b", "none"]);
  });

  it("未击发仍然置顶", () => {
    const list = [
      m("done", "hit", 10),
      m("a", "planned", 10),
      m("b", "planned", 11),
    ];
    expect(ids(orderMissions(list, "traverse"))[2]).toBe("done");
  });
});
