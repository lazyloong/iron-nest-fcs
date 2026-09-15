import { describe, expect, it } from "vitest";
import {
  createMission,
  type FireMission,
  type MissionStatus,
} from "../src/domain/fireMission";
import {
  angularDistance,
  barrelForIndex,
  orderByMinTraverse,
  orderMissions,
  assignBarrels,
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

describe("双管轮转 · 炮位分配", () => {
  it("没有手动指定时就是交替", () => {
    expect(assignBarrels([null, null, null, null])).toEqual(["A", "B", "A", "B"]);
    expect(assignBarrels([undefined, undefined, undefined])).toEqual(["A", "B", "A"]);
  });

  it("手动指定直接采用，且不消耗轮转", () => {
    expect(assignBarrels(["B", null])).toEqual(["B", "A"]);
    expect(assignBarrels(["B", null, null])).toEqual(["B", "A", "B"]);
    expect(assignBarrels([null, "A"])).toEqual(["A", "A"]);
  });

  it("全手动指定给同一根管时，另一根就空着", () => {
    expect(assignBarrels(["A", "A"])).toEqual(["A", "A"]);
  });

  it("空数组不出错", () => {
    expect(assignBarrels([])).toEqual([]);
  });
  it("第 1、3、5… 条给 A 管，第 2、4、6… 条给 B 管", () => {
    expect([0, 1, 2, 3, 4, 5].map(barrelForIndex)).toEqual(["A", "B", "A", "B", "A", "B"]);
  });

  it("按待击发序列的位次轮转，与射击顺序无关", () => {
    expect(barrelForIndex(0)).toBe("A");
    expect(barrelForIndex(1)).toBe("B");
    expect(barrelForIndex(2)).toBe("A");
  });
});

describe("orderMissions · traverse 模式", () => {
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




