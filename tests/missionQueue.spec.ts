import { mount, type VueWrapper } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MissionQueue from "../src/components/MissionQueue.vue";
import BarrelPanel from "../src/components/BarrelPanel.vue";
import { useMissionStore, useSettingsStore } from "../src/stores";

/**
 * 回归测试：打表之后组件会因倒计时每 200ms 重渲染一次。
 * 那时「经过时刻」输入框若直接绑定 store 值，用户刚敲的字会被下一次渲染冲掉。
 */

type Wrapper = VueWrapper;

function timeInput(wrapper: Wrapper): HTMLInputElement {
  return wrapper.find("input.t-in").element as HTMLInputElement;
}

/** 精确模拟「击键」：只派发 input 事件，不碰 change */
function typeInto(wrapper: Wrapper, text: string): void {
  const el = timeInput(wrapper);
  el.value = text;
  el.dispatchEvent(new Event("input"));
}

/** 模拟失焦提交 */
function commit(wrapper: Wrapper): void {
  timeInput(wrapper).dispatchEvent(new Event("change"));
}

describe("MissionQueue · 经过时刻输入", () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function setup() {
    const settings = useSettingsStore();
    settings.soundEnabled = false; // 别去 new AudioContext
    const store = useMissionStore();
    store.addNew({ distanceKm: 6.6, bearingDeg: 12.3 });
    return { settings, store, wrapper: mount(MissionQueue) as Wrapper };
  }

  it("未对表时能输入", async () => {
    const { wrapper } = setup();
    expect(wrapper.find("input.t-in").exists()).toBe(true);

    typeInto(wrapper, "130000");
    await vi.advanceTimersByTimeAsync(600);
    await wrapper.vm.$nextTick();

    expect(timeInput(wrapper).value).toBe("130000");
  });

  it("对表后（高频重渲染）输入的内容不会被冲掉", async () => {
    const { settings, wrapper } = setup();

    // 对表 —— 这一步之后组件开始每 200ms 重渲染
    settings.syncWatch(12 * 3600 + 47 * 60);
    await vi.advanceTimersByTimeAsync(600);
    await wrapper.vm.$nextTick();

    expect(wrapper.find("input.t-in").exists()).toBe(true);

    typeInto(wrapper, "130000");

    // 模拟打字期间经历多次重渲染
    await vi.advanceTimersByTimeAsync(1000);
    await wrapper.vm.$nextTick();

    expect(timeInput(wrapper).value).toBe("130000");
  });

  it("未提交的草稿不会被任务重排影响", async () => {
    const { store, wrapper } = setup();
    store.addNew({ distanceKm: 8, bearingDeg: 30 });

    typeInto(wrapper, "130000");
    await wrapper.vm.$nextTick();

    expect(store.missions[0]!.impactClockSec).toBeNull();
    expect(timeInput(wrapper).value).toBe("130000");
  });

  it("提交后写回任务并显示为完整时刻", async () => {
    const { store, wrapper } = setup();

    typeInto(wrapper, "130000");
    commit(wrapper);
    await wrapper.vm.$nextTick();

    expect(store.missions[0]!.impactClockSec).toBe(13 * 3600);
    expect(timeInput(wrapper).value).toBe("13:00:00");
  });

  it("带秒的输入也能提交", async () => {
    const { store, wrapper } = setup();

    typeInto(wrapper, "130036");
    commit(wrapper);
    await wrapper.vm.$nextTick();

    expect(store.missions[0]!.impactClockSec).toBe(13 * 3600 + 36);
    expect(timeInput(wrapper).value).toBe("13:00:36");
  });
});

describe("MissionQueue · 排序", () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function setup() {
    const settings = useSettingsStore();
    settings.soundEnabled = false;
    const store = useMissionStore();
    store.addNew({ distanceKm: 6.6, bearingDeg: 20 });
    return { settings, store, wrapper: mount(MissionQueue) as Wrapper };
  }

  const labels = (wrapper: Wrapper) =>
    wrapper
      .findAll("input.lab")
      .map((el) => (el.element as HTMLInputElement).value);

  it("最小回转模式：跨零点按最短弧排，不平铺绕远", async () => {
    const { settings, store, wrapper } = setup(); // 目标 1 方位 20
    store.addNew({ distanceKm: 8, bearingDeg: 350 });
    store.addNew({ distanceKm: 9, bearingDeg: 10 });

    settings.sortMode = "traverse";
    await wrapper.vm.$nextTick();

    // 最大间隙在 20→350，所以从 350 起头单向扫：350 → 10 → 20
    expect(labels(wrapper)).toEqual(["目标 2", "目标 3", "目标 1"]);
  });

  it("开火时刻模式：按开火时刻升序", async () => {
    const { settings, store, wrapper } = setup();
    store.addNew({ distanceKm: 8, bearingDeg: 350 });
    store.addNew({ distanceKm: 9, bearingDeg: 10 });

    settings.sortMode = "time";
    // 第 3 条最早开火、第 1 条最晚
    store.update(store.missions[2]!.id, { impactClockSec: 13 * 3600 });
    store.update(store.missions[1]!.id, { impactClockSec: 14 * 3600 });
    store.update(store.missions[0]!.id, { impactClockSec: 15 * 3600 });
    await wrapper.vm.$nextTick();

    // 目标 3 最早开火（13:00），其次目标 2，最后目标 1
    expect(labels(wrapper)).toEqual(["目标 3", "目标 2", "目标 1"]);
  });

  it("store：moveMissionBefore 把一条移到另一条之前", () => {
    const { store } = setup();
    store.addNew({ distanceKm: 8, bearingDeg: 350 });
    const a = store.missions[0]!.id;
    const b = store.missions[1]!.id;

    store.moveMissionBefore(b, a);
    expect(store.missions.map((x) => x.id)).toEqual([b, a]);

    // 移到自己前面是空操作
    store.moveMissionBefore(b, b);
    expect(store.missions.map((x) => x.id)).toEqual([b, a]);
  });

  it("手动模式：卡片可拖拽；其他模式不可", async () => {
    const { settings, wrapper } = setup();

    settings.sortMode = "manual";
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".card").attributes("draggable")).toBe("true");

    settings.sortMode = "time";
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".card").attributes("draggable")).toBe("false");

    settings.sortMode = "traverse";
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".card").attributes("draggable")).toBe("false");
  });

  it("拖拽：把第二张卡拖到第一张之前", async () => {
    const { settings, store, wrapper } = setup();
    store.addNew({ distanceKm: 8, bearingDeg: 350 });
    settings.sortMode = "manual";
    await wrapper.vm.$nextTick();

    expect(labels(wrapper)).toEqual(["目标 1", "目标 2"]);

    const cards = wrapper.findAll(".card");
    await cards[1]!.trigger("dragstart");
    await cards[0]!.trigger("drop");
    await wrapper.vm.$nextTick();

    expect(labels(wrapper)).toEqual(["目标 2", "目标 1"]);
  });

  it("已击发的卡片不可拖拽", async () => {
    const { settings, store, wrapper } = setup();
    settings.sortMode = "manual";
    store.setStatus(store.missions[0]!.id, "hit");
    await wrapper.vm.$nextTick();

    expect(wrapper.find(".card").attributes("draggable")).toBe("false");
  });

  it("非手动模式不显示 ▲▼", async () => {
    const { settings, wrapper } = setup();
    settings.sortMode = "time";
    await wrapper.vm.$nextTick();
    const ops = wrapper
      .find(".card .ops")
      .findAll("button")
      .map((b) => b.text());
    expect(ops).not.toContain("▲");
  });
});

describe("炮位标识与预装面板", () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function setup() {
    const settings = useSettingsStore();
    settings.soundEnabled = false;
    const store = useMissionStore();
    store.addNew({ distanceKm: 6.6, bearingDeg: 20 });
    return { settings, store, wrapper: mount(MissionQueue) as Wrapper };
  }

  /** 每张卡上的 [A, B] 两个标识及其高亮状态 */
  function badges(wrapper: Wrapper) {
    return wrapper.findAll(".card").map((card) =>
      card.findAll(".bl").map((b) => ({ text: b.text(), on: b.classes().includes("on") })),
    );
  }

  it("按队列顺序轮转：第 1 条 A、第 2 条 B、第 3 条 A", async () => {
    const { store, wrapper } = setup();
    store.addNew({ distanceKm: 8, bearingDeg: 350 });
    store.addNew({ distanceKm: 9, bearingDeg: 30 });
    await wrapper.vm.$nextTick();

    const b = badges(wrapper);
    expect(b).toHaveLength(3);
    expect(b[0]).toEqual([
      { text: "A", on: true },
      { text: "B", on: false },
    ]);
    expect(b[1]).toEqual([
      { text: "A", on: false },
      { text: "B", on: true },
    ]);
    expect(b[2]).toEqual([
      { text: "A", on: true },
      { text: "B", on: false },
    ]);
  });

  it("打掉第一条后，后面的自动往前顶", async () => {
    const { store, wrapper } = setup();
    store.addNew({ distanceKm: 8, bearingDeg: 350 });
    await wrapper.vm.$nextTick();

    store.markFired(store.missions[0]!.id);
    await wrapper.vm.$nextTick();

    const b = badges(wrapper);
    // 原来的第 2 条变成待击发序列的第 1 条 → A 管
    expect(b[0]![0]).toEqual({ text: "A", on: true });
    expect(b[0]![1]).toEqual({ text: "B", on: false });
  });

  it("双炮位面板自动填入队列前两条", async () => {
    const { store } = setup();
    store.addNew({ distanceKm: 8, bearingDeg: 350 });
    const panel = mount(BarrelPanel);
    await panel.vm.$nextTick();

    expect(panel.findAll(".target").map((t) => t.text())).toEqual(["目标 1", "目标 2"]);
  });

  it("队列为空时炮位面板显示空", () => {
    setActivePinia(createPinia());
    const panel = mount(BarrelPanel);
    expect(panel.findAll(".target").map((t) => t.text())).toEqual(["空", "空"]);
  });
});


describe("炮位手动覆盖", () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function setup() {
    const settings = useSettingsStore();
    settings.soundEnabled = false;
    const store = useMissionStore();
    store.addNew({ distanceKm: 6.6, bearingDeg: 20 });
    return { store, wrapper: mount(MissionQueue) as Wrapper };
  }

  it("点标识手动指定炮位，再点一次回到自动交替", async () => {
    const { store, wrapper } = setup();
    await wrapper.vm.$nextTick();

    const bl = () => wrapper.find(".card").findAll(".bl");
    const cls = (i: number) => bl()[i]!.classes();

    // 自动：第 1 条 → A
    expect(cls(0)).toContain("on");
    expect(cls(1)).not.toContain("on");

    // 点 B → 手动指定 B
    await bl()[1]!.trigger("click");
    await wrapper.vm.$nextTick();
    expect(cls(0)).not.toContain("on");
    expect(cls(1)).toContain("on");
    expect(cls(1)).toContain("manual");
    expect(store.missions[0]!.barrelOverride).toBe("B");

    // 再点 B → 取消，回到自动 A
    await bl()[1]!.trigger("click");
    await wrapper.vm.$nextTick();
    expect(cls(0)).toContain("on");
    expect(cls(0)).not.toContain("manual");
    expect(store.missions[0]!.barrelOverride).toBeNull();
  });

  it("自动交替的标识不带 manual 标记", async () => {
    const { wrapper } = setup();
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".card").findAll(".bl")[0]!.classes()).not.toContain("manual");
    expect(wrapper.find(".card").findAll(".bl")[0]!.classes()).toContain("on");
  });
});
