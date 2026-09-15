import type { BarrelId } from "./constants";
import type { FireMission } from "./fireMission";

/** 队列排序方式 */
export type SortMode =
  | "time" // 按开火时刻升序
  | "traverse" // 转动距离最小（已内建双管预装：同方位配对成一个停靠点）
  | "manual"; // 手动

/** 环形最短夹角，结果落在 0-180 */
export function angularDistance(a: number, b: number): number {
  const d = ((Math.abs(a - b) % 360) + 360) % 360;
  return d > 180 ? 360 - d : d;
}

function norm360(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/**
 * 圆环上的最小回转排序（方位角最小回转）。
 *
 * 原理：圆周上走遍所有点，最优走法一定是「沿一个方向单调扫过覆盖全部点的最短弧」，
 * 该弧长 = 360 - 最大间隙。所以按角度排序后，从最大间隙之后那个点开始依次取即可。
 *
 * @param startAngle 当前炮口方位（可选）。给了就从更近的那一端起头，省掉最初那一下转向。
 */
export function orderByMinTraverse<T>(
  items: readonly T[],
  angleOf: (item: T) => number,
  startAngle?: number,
): T[] {
  const n = items.length;
  if (n <= 1) return [...items];

  const points = items.map((item, i) => ({
    item,
    i,
    a: norm360(angleOf(item)),
  }));
  points.sort((x, y) => x.a - y.a || x.i - y.i);

  // 找最大间隙（环状，含最后一点回到第一点）
  let gapAt = 0;
  let maxGap = -1;
  for (let k = 0; k < n; k++) {
    const gap = (points[(k + 1) % n]!.a - points[k]!.a + 360) % 360;
    if (gap > maxGap) {
      maxGap = gap;
      gapAt = k;
    }
  }

  // 从最大间隙之后开始单向扫
  const sweep: T[] = [];
  for (let k = 1; k <= n; k++) {
    sweep.push(points[(gapAt + k) % n]!.item);
  }

  // 有炮口方位时，从更近的那端起头（只是反转序列，总回转不变）
  if (startAngle !== undefined && n >= 2) {
    const head = norm360(angleOf(sweep[0] as T));
    const tail = norm360(angleOf(sweep[n - 1] as T));
    if (angularDistance(startAngle, tail) < angularDistance(startAngle, head)) {
      sweep.reverse();
    }
  }

  return sweep;
}

/** 一趟扫完的总回转角度 */
export function totalTraverseDeg<T>(
  ordered: readonly T[],
  angleOf: (item: T) => number,
  startAngle?: number,
): number {
  let total = 0;
  let prev = startAngle;
  for (const item of ordered) {
    const a = norm360(angleOf(item));
    if (prev !== undefined) total += angularDistance(prev, a);
    prev = a;
  }
  return total;
}

/* --------------------------- 双管轮转 --------------------------- */

/**
 * 双管轮转分配：待击发序列里第 1、3、5… 条给 A 管，第 2、4、6… 条给 B 管。
 *
 * 这只是「哪根管子负责这一发」的排班，**不影响射击顺序**：
 * 转向与其他系统独立，装填可以与转向并行，所以双管不改变最优顺序，
 * 它改变的是你能提前把接下来两发都装好。
 */
export function barrelForIndex(index: number): BarrelId {
  return index % 2 === 0 ? "A" : "B";
}

/**
 * 批量分配炮位。规则：
 *  - 手动指定的**直接采用，且不消耗轮转**
 *  - 没指定的按顺序交替填（A、B、A、B…）
 *
 * 这样「把第 1 条手动改成 B 管」之后，第 2 条会自动补到 A 管，
 * 而不是两条挤在 B 管、A 管空着。
 */
export function assignBarrels(overrides: readonly (BarrelId | null | undefined)[]): BarrelId[] {
  const out: BarrelId[] = [];
  let cursor: BarrelId = "A";
  for (const o of overrides) {
    if (o === "A" || o === "B") {
      out.push(o);
    } else {
      out.push(cursor);
      cursor = cursor === "A" ? "B" : "A";
    }
  }
  return out;
}
export interface OrderOptions {
  /** 每个任务的开火时刻（秒），'time' 模式用 */
  fireClockSecById?: ReadonlyMap<string, number>;
  /** 当前炮口方位，'traverse' 模式用 */
  currentBearing?: number;
}

/**
 * 队列显示顺序。
 *
 * 分组恒定：未击发（待击发/已装填）在前，已完成（已击发/命中/未中）在后。
 * 组内顺序由 mode 决定；两个组内部都保持稳定排序。
 * 没填方位角的任务在 'traverse' 模式下沉到未击发组底部。
 */
export function orderMissions(
  missions: readonly FireMission[],
  mode: SortMode = "time",
  opts: OrderOptions = {},
): FireMission[] {
  const pending: FireMission[] = [];
  const done: FireMission[] = [];

  for (const m of missions) {
    if (m.status === "planned" || m.status === "loaded") pending.push(m);
    else done.push(m);
  }

  let orderedPending: FireMission[];

  if (mode === "manual") {
    orderedPending = pending;
  } else if (mode === "traverse") {
    const withBearing = pending.filter((m) => m.bearingDeg !== null);
    const without = pending.filter((m) => m.bearingDeg === null);
    // 排序仍按「每个目标自己的方位」做最小回转。
    //
    // 双管预装**不改变最优顺序**：它省的只是「装填」这一项，
    // 而配对的两个目标本来就只差几度，它们之间的转向本来就趋近于零。
    // 所以配对只作为「能否齐射」的信息标注，不参与排序。
    const sorted = orderByMinTraverse(
      withBearing,
      (m) => m.bearingDeg as number,
      opts.currentBearing,
    );
    orderedPending = [...sorted, ...without];
  } else {
    orderedPending = [...pending].sort((a, b) => {
      const fa = opts.fireClockSecById?.get(a.id);
      const fb = opts.fireClockSecById?.get(b.id);
      if (fa === undefined && fb === undefined) return 0;
      if (fa === undefined) return 1;
      if (fb === undefined) return -1;
      return fa - fb;
    });
  }

  return [...orderedPending, ...done];
}



