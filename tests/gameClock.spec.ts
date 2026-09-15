import { describe, expect, it } from "vitest";
import {
  addClock,
  clockDelta,
  DAY_SEC,
  formatClockShort,
  formatClockTime,
  formatDuration,
  parseClockTime,
  wrapDay,
} from "../src/domain/gameClock";

describe("parseClockTime · 怀表读数解析", () => {
  it("HH:MM", () => {
    expect(parseClockTime("12:47")).toBe(12 * 3600 + 47 * 60);
  });

  it("HH:MM:SS", () => {
    expect(parseClockTime("12:47:30")).toBe(12 * 3600 + 47 * 60 + 30);
  });

  it("容忍全角冒号与单位数", () => {
    expect(parseClockTime("9:05")).toBe(9 * 3600 + 5 * 60);
    expect(parseClockTime("09：05")).toBe(9 * 3600 + 5 * 60);
    expect(parseClockTime(" 12:47 ")).toBe(12 * 3600 + 47 * 60);
  });

  it("单段视为分钟", () => {
    expect(parseClockTime("47")).toBe(47 * 60);
    expect(parseClockTime("5")).toBe(5 * 60);
  });

  it("纯数字简写：不用敲冒号", () => {
    expect(parseClockTime("1247")).toBe(12 * 3600 + 47 * 60);
    expect(parseClockTime("1247")).toBe(parseClockTime("12:47"));
    expect(parseClockTime("847")).toBe(8 * 3600 + 47 * 60);
    expect(parseClockTime("0005")).toBe(5 * 60);
    expect(parseClockTime("124736")).toBe(12 * 3600 + 47 * 60 + 36);
    expect(parseClockTime("124736")).toBe(parseClockTime("12:47:36"));
    expect(parseClockTime("24736")).toBe(2 * 3600 + 47 * 60 + 36);
    expect(parseClockTime("124799")).toBeNull();
    expect(parseClockTime("2570")).toBeNull();
    expect(parseClockTime("1299")).toBeNull();
  });

  it("拒绝非法输入", () => {
    expect(parseClockTime("")).toBeNull();
    expect(parseClockTime("24:00")).toBeNull();
    expect(parseClockTime("12:60")).toBeNull();
    expect(parseClockTime("12:47:60")).toBeNull();
    expect(parseClockTime("abc")).toBeNull();
    expect(parseClockTime("1:2:3:4")).toBeNull();
  });
});

describe("formatClockTime", () => {
  it("补零到 HH:MM:SS", () => {
    expect(formatClockTime(0)).toBe("00:00:00");
    expect(formatClockTime(12 * 3600 + 47 * 60 + 30)).toBe("12:47:30");
  });

  it("自动环绕一天", () => {
    expect(formatClockTime(DAY_SEC + 60)).toBe("00:01:00");
    expect(formatClockTime(-60)).toBe("23:59:00");
  });
});

describe("formatClockShort", () => {
  it("只到分钟", () => {
    expect(formatClockShort(12 * 3600 + 47 * 60 + 30)).toBe("12:47");
  });
});

describe("formatDuration · 区间量", () => {
  it("M:SS.s", () => {
    expect(formatDuration(0)).toBe("0:00.0");
    expect(formatDuration(23.81)).toBe("0:23.8");
    expect(formatDuration(90)).toBe("1:30.0");
  });

  it("负值为已过", () => {
    expect(formatDuration(-5)).toBe("-0:05.0");
  });
});

describe("clockDelta · 怀表上两点之间的有符号间隔", () => {
  it("同一天内为正", () => {
    expect(clockDelta(12 * 3600, 12 * 3600 + 90)).toBe(90);
  });

  it("已经过为负", () => {
    expect(clockDelta(12 * 3600, 12 * 3600 - 90)).toBe(-90);
  });

  it("跨零点", () => {
    // 23:59:00 → 00:01:00 = 未来 2 分钟
    expect(clockDelta(23 * 3600 + 59 * 60, 60)).toBe(120);
  });

  it("结果恒定落在 (-12h, +12h]", () => {
    for (const [a, b] of [
      [0, DAY_SEC - 1],
      [DAY_SEC - 1, 0],
      [3600, 7200],
      [7200, 3600],
    ]) {
      const d = clockDelta(a as number, b as number);
      expect(d).toBeGreaterThan(-DAY_SEC / 2);
      expect(d).toBeLessThanOrEqual(DAY_SEC / 2);
    }
  });
});

describe("addClock / wrapDay", () => {
  it("减法跨零回绕", () => {
    expect(addClock(60, -120)).toBe(DAY_SEC - 60);
  });

  it("wrapDay 归一化", () => {
    expect(wrapDay(-1)).toBe(DAY_SEC - 1);
    expect(wrapDay(DAY_SEC + 5)).toBe(5);
  });
});
