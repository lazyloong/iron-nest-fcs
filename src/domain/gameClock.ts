/**
 * 游戏怀表时间
 *
 * 铁巢重炮的时间机制不是倒计时，而是操纵台右下的**怀表**：
 *  - 怀表显示当前时间（内圈是当前时间）
 *  - 电传简报给出的是**目标在几时经过哪里**（绝对时刻）
 *  - 射击控制台与怀表都会显示本发的**飞行时间**
 *
 * 所以要反推的是：开火时刻 = 目标经过时刻 - 飞行时间（绝对值相减）
 */

/** 一天的秒数 */
export const DAY_SEC = 86400;

function pad2(n: number): string {
  return (n < 10 ? "0" : "") + n;
}

/**
 * 解析怀表读数。
 *  - "12:47"    → 12 时 47 分
 *  - "12:47:30" → 12 时 47 分 30 秒
 *  - "47"       → 47 分
 */
export function parseClockTime(input: string): number | null {
  const s = input.trim().replace(/：/g, ":");
  if (!s) return null;

  // 纯数字简写，省掉冒号：
  //   124736 = 12:47:36（6 位，带秒）
  //   24736  =  2:47:36（5 位，带秒）
  //   1247   = 12:47   （4 位）
  //   847    =  8:47   （3 位）
  //   47     = 47 分   （1-2 位）
  if (/^\d+$/.test(s)) {
    let h = 0;
    let m = 0;
    let sec = 0;

    if (s.length === 6) {
      h = Number(s.slice(0, 2));
      m = Number(s.slice(2, 4));
      sec = Number(s.slice(4, 6));
    } else if (s.length === 5) {
      h = Number(s.slice(0, 1));
      m = Number(s.slice(1, 3));
      sec = Number(s.slice(3, 5));
    } else if (s.length === 4) {
      h = Number(s.slice(0, 2));
      m = Number(s.slice(2, 4));
    } else if (s.length === 3) {
      h = Number(s.slice(0, 1));
      m = Number(s.slice(1, 3));
    } else if (s.length <= 2) {
      m = Number(s);
    } else {
      return null;
    }

    if (h > 23 || m > 59 || sec > 59) return null;
    return h * 3600 + m * 60 + sec;
  }

  const parts = s.split(":");
  if (parts.length > 3) return null;

  const nums = parts.map((p) => p.trim());
  for (const n of nums) {
    if (!/^\d{1,2}$/.test(n)) return null;
  }

  let h = 0;
  let m = 0;
  let sec = 0;

  if (nums.length === 3) {
    h = Number(nums[0]);
    m = Number(nums[1]);
    sec = Number(nums[2]);
  } else if (nums.length === 2) {
    h = Number(nums[0]);
    m = Number(nums[1]);
  } else {
    m = Number(nums[0]);
  }

  if (h > 23 || m > 59 || sec > 59) return null;
  return h * 3600 + m * 60 + sec;
}

/** 24 小时制格式化 "HH:MM:SS" */
export function formatClockTime(sec: number): string {
  const s = wrapDay(sec);
  return (
    pad2(Math.floor(s / 3600)) +
    ":" +
    pad2(Math.floor((s % 3600) / 60)) +
    ":" +
    pad2(Math.floor(s % 60))
  );
}

/** 简短格式化 "HH:MM" */
export function formatClockShort(sec: number): string {
  const s = wrapDay(sec);
  return pad2(Math.floor(s / 3600)) + ":" + pad2(Math.floor((s % 3600) / 60));
}

/** 时长格式化 "M:SS.s"（用于飞行时间、倒计时等区间量） */
export function formatDuration(totalSec: number): string {
  const sign = totalSec < 0 ? "-" : "";
  const abs = Math.abs(totalSec);
  const m = Math.floor(abs / 60);
  const s = abs - m * 60;
  return sign + m + ":" + (s < 10 ? "0" : "") + s.toFixed(1);
}

/** 秒数环绕到 0–86399 */
export function wrapDay(sec: number): number {
  return ((sec % DAY_SEC) + DAY_SEC) % DAY_SEC;
}

/** 怀表加/减秒数（自动跨零） */
export function addClock(sec: number, delta: number): number {
  return wrapDay(sec + delta);
}

/**
 * 从 from 到 to 的有符号间隔，落在 (-12h, +12h]。
 * 正数 = to 在未来，负数 = to 已经过去。
 */
export function clockDelta(fromSec: number, toSec: number): number {
  let d = wrapDay(toSec - fromSec);
  if (d > DAY_SEC / 2) d -= DAY_SEC;
  return d;
}
