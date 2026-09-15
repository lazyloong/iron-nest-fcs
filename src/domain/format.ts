/** 显示精度：游戏内读数支持到两位小数 */
export type Precision = 0 | 1 | 2;

export function formatNumber(value: number, precision: Precision = 2): string {
  if (!Number.isFinite(value)) return "—";
  return value.toFixed(precision);
}

/** 仰角。游戏内可读到 0.01° */
export function formatElevation(
  value: number,
  precision: Precision = 2,
): string {
  return formatNumber(value, precision);
}

/** 弹速，单位 km/s */
export function formatSpeed(value: number, precision: Precision = 2): string {
  return formatNumber(value, precision);
}

/** 飞行时间，单位秒 */
export function formatFlightTime(
  value: number,
  precision: Precision = 1,
): string {
  return formatNumber(value, precision);
}

/** 距离，单位 km */
export function formatKm(value: number, precision: Precision = 2): string {
  return formatNumber(value, precision);
}

/** 方位角，0–360° */
export function formatBearing(value: number, precision: Precision = 1): string {
  return `${formatNumber(value, precision)}°`;
}

/**
 * 复刻 WIKI 计算器的显示口径：整数取 0 位小数，否则取 1 位。
 * 仅用于与旧工具对数值，默认 UI 请用 2 位。
 */
export function formatElevationWikiStyle(value: number): string {
  return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);
}
