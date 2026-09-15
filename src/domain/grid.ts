import {
  MAJOR_GRID_KM,
  MAP_COL_MAX,
  MAP_COL_MIN,
  MAP_ROW_MAX,
  MAP_ROW_MIN,
  SUB_CELL_KM,
  SUB_DIVISIONS,
} from "./constants";

/**
 * 铁巢重炮 · 战术地图坐标系
 *
 * 地图规格（玩家实测）：
 *  - 范围：[A-T] x [1-10]，即 20 列 x 10 行，共 200 个大格
 *  - 大格边长 1 km，记如 "I5"
 *  - 大格内部长宽各分十分，用 "x:y" 表示，x / y 各取 0-9，单个子格 0.1 km
 *  - 完整格位记如 "I5 6:8"
 *
 * 因此整张地图为 20 km x 10 km，格位精度 0.1 km。
 * 距离只与两点的相对偏移有关，不受原点与朝向约定影响；方位角见 BearingConvention。
 */

export interface GridRef {
  /** 列字母 A-T */
  col: string;
  /** 行号 1-10 */
  row: number;
  /** 大格内东向子格 0-9 */
  x: number;
  /** 大格内南向子格 0-9 */
  y: number;
}

export function colToIndex(col: string): number {
  return col.trim().toUpperCase().charCodeAt(0) - MAP_COL_MIN.charCodeAt(0);
}

export function indexToCol(index: number): string {
  return String.fromCharCode(MAP_COL_MIN.charCodeAt(0) + index);
}

/** 列字母是否在地图范围内（A-T） */
export function isValidCol(col: string): boolean {
  const c = col.trim().toUpperCase();
  return c.length === 1 && c >= MAP_COL_MIN && c <= MAP_COL_MAX;
}

/** 行号是否在地图范围内（1-10） */
export function isValidRow(row: number): boolean {
  return Number.isInteger(row) && row >= MAP_ROW_MIN && row <= MAP_ROW_MAX;
}

/** 格位是否完整落在可玩地图内 */
export function isWithinMap(ref: GridRef): boolean {
  return isValidCol(ref.col) && isValidRow(ref.row);
}

/**
 * 解析格位文本，容忍大小写、全角冒号、逗号与多余空格。
 * 例："I5 6:8" / "i5 6：8" / "I5" / "I56:8" / "T10 9:9"
 */
/**
 * 把纯数字串拆成「行号 + 两个子格数字」。
 * 子格只有一位（0-9），行号是一位或两位（1-10），所以：
 *   3 位 = 行 + x + y      例 "568"  → I5 6:8
 *   4 位 = 行(两位) + x + y 例 "1099" → T10 9:9
 *   2 位 = 只有行号        例 "10"   → T10
 *   1 位 = 只有行号        例 "5"    → I5
 */
function parseRowAndSub(
  digits: string,
): { row: number; x: number; y: number } | null {
  if (digits.length === 4) {
    const row2 = Number(digits.slice(0, 2));
    if (isValidRow(row2))
      return { row: row2, x: Number(digits[2]), y: Number(digits[3]) };
    return null;
  }
  if (digits.length === 3) {
    return {
      row: Number(digits[0]),
      x: Number(digits[1]),
      y: Number(digits[2]),
    };
  }
  if (digits.length === 2) {
    const row = Number(digits);
    return isValidRow(row) ? { row, x: 0, y: 0 } : null;
  }
  if (digits.length === 1) {
    return { row: Number(digits), x: 0, y: 0 };
  }
  return null;
}

/**
 * 解析格位文本。分隔符全部可省略，也可以带空格或冒号。
 * 以下写法等价，都指向 I5 6:8：
 *   "I5 68" / "I568" / "I5 6:8" / "i5.6-8" / "I5 6 8"
 * 行号 10 的写法： "J10 37" / "J1037"
 */
export function parseGridRef(input: string): GridRef | null {
  if (!input) return null;

  // 去掉所有分隔符，只留字母和数字
  const compact = input
    .replace(/[：，,]/g, "")
    .replace(/[\s:.\-_/]/g, "")
    .toUpperCase();

  const m = /^([A-Z])(\d+)$/.exec(compact);
  if (!m) return null;

  const col = m[1] as string;
  const parsed = parseRowAndSub(m[2] as string);
  if (parsed === null) return null;

  const ref: GridRef = { col, row: parsed.row, x: parsed.x, y: parsed.y };
  if (!isWithinMap(ref)) return null;

  return ref;
}

export function formatGridRef(ref: GridRef): string {
  return ref.col + ref.row + " " + ref.x + ref.y;
}

/** 平面坐标，单位 km */
export interface PlanePoint {
  /** 东向距离 */
  east: number;
  /** 南向距离 */
  south: number;
}

/**
 * 格位 -> 平面坐标（以 A1 大格的西北角为原点）。
 * 由于距离只用相对量，原点的绝对位置不影响任何结果。
 */
export function gridRefToPlane(ref: GridRef): PlanePoint {
  return {
    east: colToIndex(ref.col) * MAJOR_GRID_KM + ref.x * SUB_CELL_KM,
    south: ref.row * MAJOR_GRID_KM + ref.y * SUB_CELL_KM,
  };
}

/** 两格位之间的直线距离(km) */
export function distanceKm(a: GridRef, b: GridRef): number {
  const pa = gridRefToPlane(a);
  const pb = gridRefToPlane(b);
  return Math.hypot(pb.east - pa.east, pb.south - pa.south);
}

/** 方位角约定 —— 首次使用时用已知目标校准一次即可确定 */
export interface BearingConvention {
  /** 行号增大对应方位角 0 还是 180 度（'north' = 行号增大方向为 0°） */
  rowDirection: "north" | "south";
  /** 0 度指向 */
  zero: "north" | "east";
  /** 是否顺时针增大 */
  clockwise: boolean;
}

/**
 * 方位角约定 —— 已用游戏内实测数据校准：
 *   铁巢 D2 9:5 → 目标 P6 0:4，游戏读数 11.79 km / 70.7 度，
 *   本约定算出 11.765 km / 70.65 度，吻合。
 * 结论：**行号增大的方向即方位角 0 度，顺时针增大**。
 * 距离与约定无关，只有方位角依赖它。
 */
export const DEFAULT_BEARING_CONVENTION: BearingConvention = {
  rowDirection: "north",
  zero: "north",
  clockwise: true,
};

/** 从 from 指向 to 的方位角，返回 0-360 */
export function bearingDeg(
  from: GridRef,
  to: GridRef,
  convention: BearingConvention = DEFAULT_BEARING_CONVENTION,
): number {
  const p1 = gridRefToPlane(from);
  const p2 = gridRefToPlane(to);

  const dEast = p2.east - p1.east;
  const dSouth = p2.south - p1.south;
  const dNorth = convention.rowDirection === "south" ? -dSouth : dSouth;

  let deg = (Math.atan2(dEast, dNorth) * 180) / Math.PI;
  if (convention.zero === "east") deg -= 90;
  deg = ((deg % 360) + 360) % 360;
  if (!convention.clockwise) deg = (360 - deg) % 360;
  return deg;
}

export interface GridSolution {
  /** 两点直线距离(km) */
  distanceKm: number;
  /** 方位角 0-360 度 */
  bearingDeg: number;
}

/**
 * 反解：由「原点格位 + 距离 + 方位角」推出目标格位。
 * 方位角按 BearingConvention 解释，结果四舍五入到 0.1 km 子格；
 * 落在图外时返回 null。
 */
export function gridRefFromPolar(
  origin: GridRef,
  distanceKmValue: number,
  bearing: number,
  convention: BearingConvention = DEFAULT_BEARING_CONVENTION,
): GridRef | null {
  if (!Number.isFinite(distanceKmValue) || distanceKmValue < 0) return null;

  const p = gridRefToPlane(origin);
  const rad = (bearing * Math.PI) / 180;

  // 0 度 = 正北、顺时针：东分量 = sin，北分量 = cos
  let dEast = Math.sin(rad) * distanceKmValue;
  let dNorth = Math.cos(rad) * distanceKmValue;

  if (convention.zero === "east") {
    // 0 度 = 正东、顺时针：东分量 = cos，北分量 = -sin
    dEast = Math.cos(rad) * distanceKmValue;
    dNorth = -Math.sin(rad) * distanceKmValue;
  }
  if (!convention.clockwise) dEast = -dEast;

  const dSouth = convention.rowDirection === "south" ? -dNorth : dNorth;

  const east = p.east + dEast;
  const south = p.south + dSouth;

  let col = Math.floor(east);
  let row = Math.floor(south);
  let x = Math.round((east - col) * SUB_DIVISIONS);
  let y = Math.round((south - row) * SUB_DIVISIONS);

  if (x >= SUB_DIVISIONS) {
    col += 1;
    x -= SUB_DIVISIONS;
  }
  if (y >= SUB_DIVISIONS) {
    row += 1;
    y -= SUB_DIVISIONS;
  }
  if (x < 0 || y < 0) return null;

  const ref: GridRef = { col: indexToCol(col), row, x, y };
  return isWithinMap(ref) ? ref : null;
}
/** 一次算出「铁巢格位 -> 目标格位」的距离与方位角 */
export function solveFromGridRefs(
  origin: GridRef,
  target: GridRef,
  convention: BearingConvention = DEFAULT_BEARING_CONVENTION,
): GridSolution {
  return {
    distanceKm: distanceKm(origin, target),
    bearingDeg: bearingDeg(origin, target, convention),
  };
}
