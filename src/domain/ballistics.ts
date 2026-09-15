import {
  BASE_SPEED_KMPS,
  CHARGE_MAX,
  CHARGE_MIN,
  COEFF_AT_MAX_CHARGE,
  COEFF_AT_MIN_CHARGE,
  ELEV_PER_KM_PER_CHARGE,
  MAP_MAX_RANGE_KM,
  MAX_ELEVATION_DEG,
  RANGE_PER_CHARGE_KM,
} from "./constants";

/** 装药档位 1–6 */
export type Charge = 1 | 2 | 3 | 4 | 5 | 6;

export const ALL_CHARGES: readonly Charge[] = [1, 2, 3, 4, 5, 6];

export type WarningCode =
  | "DISTANCE_INVALID"
  | "DISTANCE_OVER_MAP_MAX"
  | "OUT_OF_RANGE"
  | "ELEVATION_OVER_MAX";

export interface Warning {
  code: WarningCode;
  message: string;
}

export function isValidCharge(value: number): value is Charge {
  return Number.isInteger(value) && value >= CHARGE_MIN && value <= CHARGE_MAX;
}

export function clampCharge(value: number): Charge {
  const n = Math.min(CHARGE_MAX, Math.max(CHARGE_MIN, Math.round(value)));
  return n as Charge;
}

/** S 型插值：x ≤ 0 → 0，x ≥ 1 → 1 */
export function smoothstep(x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  return 3 * x * x - 2 * x * x * x;
}

/**
 * 装药系数（弹速倍率）：1 档 0.30 → 6 档 1.00。
 * 注意它不是档位本身，而是一条 S 型曲线——中间档位增益最大。
 */
export function chargeCoefficient(charge: Charge): number {
  if (charge <= CHARGE_MIN) return COEFF_AT_MIN_CHARGE;
  if (charge >= CHARGE_MAX) return COEFF_AT_MAX_CHARGE;
  const t = (charge - CHARGE_MIN) / (CHARGE_MAX - CHARGE_MIN);
  return (
    COEFF_AT_MIN_CHARGE +
    (COEFF_AT_MAX_CHARGE - COEFF_AT_MIN_CHARGE) * smoothstep(t)
  );
}

/** 弹速(km/s) = 0.7 × 装药系数 */
export function muzzleSpeedKmps(charge: Charge): number {
  return BASE_SPEED_KMPS * chargeCoefficient(charge);
}

/** 仰角(°) = 12 × 距离(km) ÷ 档位 */
export function elevationDeg(distanceKm: number, charge: Charge): number {
  return (ELEV_PER_KM_PER_CHARGE * distanceKm) / charge;
}

/** 上限射程(km) = 档位 × 5 */
export function maxRangeKm(charge: Charge): number {
  return RANGE_PER_CHARGE_KM * charge;
}

/** 能打到该距离的最低档位（游戏内「留空则自动选最小档」规则） */
export function minChargeFor(distanceKm: number): Charge {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) return CHARGE_MIN;
  return clampCharge(Math.ceil(distanceKm / RANGE_PER_CHARGE_KM));
}

/** 飞行时间(秒) = 距离 ÷ 弹速 */
export function flightTimeSec(distanceKm: number, charge: Charge): number {
  return distanceKm / muzzleSpeedKmps(charge);
}

/* ------------------------------ 反解 ------------------------------ */

/** 反解：已知仰角与档位求距离(km) */
export function distanceFromElevation(
  elevation: number,
  charge: Charge,
): number {
  return (elevation * charge) / ELEV_PER_KM_PER_CHARGE;
}

/** 反解：已知距离与目标仰角，求需要的档位（结果可能是小数，调用方自行取整） */
export function requiredChargeForElevation(
  elevation: number,
  distanceKm: number,
): number {
  if (elevation <= 0) return Number.POSITIVE_INFINITY;
  return (ELEV_PER_KM_PER_CHARGE * distanceKm) / elevation;
}

/* --------------------------- 校验与求解 --------------------------- */

export function warningsFor(distanceKm: number, charge: Charge): Warning[] {
  const warnings: Warning[] = [];

  if (!Number.isFinite(distanceKm) || distanceKm <= 0) {
    warnings.push({ code: "DISTANCE_INVALID", message: "距离须大于 0 km" });
    return warnings;
  }
  if (distanceKm > MAP_MAX_RANGE_KM) {
    warnings.push({
      code: "DISTANCE_OVER_MAP_MAX",
      message: `距离超出全地图射程上限（${MAP_MAX_RANGE_KM} km）`,
    });
  }

  const max = maxRangeKm(charge);
  if (distanceKm > max) {
    warnings.push({
      code: "OUT_OF_RANGE",
      message: `${charge} 档上限 ${max} km，无法打到 ${distanceKm.toFixed(2)} km；至少需要 ${minChargeFor(distanceKm)} 档`,
    });
  }

  const elev = elevationDeg(distanceKm, charge);
  if (elev > MAX_ELEVATION_DEG) {
    warnings.push({
      code: "ELEVATION_OVER_MAX",
      message: `仰角 ${elev.toFixed(2)}° 超出机械上限 ${MAX_ELEVATION_DEG}°`,
    });
  }

  return warnings;
}

export interface Solution {
  distanceKm: number;
  charge: Charge;
  /** 是否为自动选出的最小档 */
  auto: boolean;
  elevationDeg: number;
  maxRangeKm: number;
  muzzleSpeedKmps: number;
  flightTimeSec: number;
  warnings: Warning[];
}

/**
 * 求解射击诸元。
 * @param distanceKm 实测目标距离(km)
 * @param charge     指定档位；留空则自动选最小可用档
 */
export function solve(distanceKm: number, charge?: Charge): Solution {
  const auto = charge === undefined;
  const resolved = charge ?? minChargeFor(distanceKm);

  return {
    distanceKm,
    charge: resolved,
    auto,
    elevationDeg: elevationDeg(distanceKm, resolved),
    maxRangeKm: maxRangeKm(resolved),
    muzzleSpeedKmps: muzzleSpeedKmps(resolved),
    flightTimeSec: flightTimeSec(distanceKm, resolved),
    warnings: warningsFor(distanceKm, resolved),
  };
}

export interface ChargeOption {
  charge: Charge;
  /** 该档位是否能打到当前距离（含仰角不超机械上限） */
  feasible: boolean;
  elevationDeg: number;
  maxRangeKm: number;
  muzzleSpeedKmps: number;
  flightTimeSec: number;
  reason?: string;
}

/** 6 档对照表：一次看清全部档位的仰角 / 弹速 / 飞行时间 */
export function compareCharges(distanceKm: number): ChargeOption[] {
  return ALL_CHARGES.map((charge) => {
    const max = maxRangeKm(charge);
    const elev = elevationDeg(distanceKm, charge);
    const outOfRange =
      !Number.isFinite(distanceKm) || distanceKm <= 0 || distanceKm > max;
    const overMax = elev > MAX_ELEVATION_DEG;

    let reason: string | undefined;
    if (!Number.isFinite(distanceKm) || distanceKm <= 0) reason = "距离无效";
    else if (outOfRange) reason = `超 ${max} km 上限`;
    else if (overMax) reason = `仰角超 ${MAX_ELEVATION_DEG}°`;

    return {
      charge,
      feasible: reason === undefined,
      elevationDeg: elev,
      maxRangeKm: max,
      muzzleSpeedKmps: muzzleSpeedKmps(charge),
      flightTimeSec: flightTimeSec(distanceKm, charge),
      ...(reason === undefined ? {} : { reason }),
    };
  });
}
