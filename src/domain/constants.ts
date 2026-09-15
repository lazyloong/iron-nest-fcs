/**
 * 铁巢重炮 · 弹道常量
 *
 * 数据来源：游戏内火控台实测（1/2/3 档 @ 5 km）
 *          + 哔哩哔哩 WIKI「仰角计算器」内联 JS（注释注明与 WikiModules/弹速与装药.lua 一致）
 *
 * 三个公式互相闭环：距离取满装药射程时 仰角 = 12 × (5c) ÷ c = 60°，恰好等于机械上限。
 */

/** 仰角系数：仰角(°) = 12 × 距离(km) ÷ 装药档位 */
export const ELEV_PER_KM_PER_CHARGE = 12;

/** 每档装药提供的上限射程(km)：上限射程 = 档位 × 5 */
export const RANGE_PER_CHARGE_KM = 5;

/** 火炮机械仰角上限(°) —— 选档的硬约束 */
export const MAX_ELEVATION_DEG = 60;

/** 基准弹速(km/s)：6 档满装药时的实际弹速 */
export const BASE_SPEED_KMPS = 0.7;

/** 装药系数曲线端点：1 档 0.30 → 6 档 1.00（smoothstep 插值） */
export const COEFF_AT_MIN_CHARGE = 0.3;
export const COEFF_AT_MAX_CHARGE = 1.0;

/** 可用装药档位范围 */
export const CHARGE_MIN = 1;
export const CHARGE_MAX = 6;

/** 全地图射程上限(km) = 6 档 × 5 */
export const MAP_MAX_RANGE_KM = RANGE_PER_CHARGE_KM * CHARGE_MAX;

/** 战术地图：大格边长(km) */
export const MAJOR_GRID_KM = 1;

/** 战术地图：大格内部等分数（长宽各十分，用 "x:y" 表示，取值 0–9） */
export const SUB_DIVISIONS = 10;

/** 战术地图：子格边长(km) */
export const SUB_CELL_KM = MAJOR_GRID_KM / SUB_DIVISIONS;

/** 战术地图范围：列 A–T（20 列） */
export const MAP_COL_MIN = "A";
export const MAP_COL_MAX = "T";

/** 战术地图范围：行 1–10 */
export const MAP_ROW_MIN = 1;
export const MAP_ROW_MAX = 10;

/** 战术地图尺寸(km)：20 × 10 */
export const MAP_WIDTH_KM =
  (MAP_COL_MAX.charCodeAt(0) - MAP_COL_MIN.charCodeAt(0) + 1) * MAJOR_GRID_KM;
export const MAP_HEIGHT_KM = MAP_ROW_MAX * MAJOR_GRID_KM;
