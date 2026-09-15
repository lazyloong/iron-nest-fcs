import { formatElevation, formatFlightTime } from "./format";
import { missionSolution, type FireMission } from "./fireMission";

export interface PreflightItem {
  id: string;
  label: string;
  detail: string;
}

/** 开火前 5 点自检 —— 对应游戏 7 步规程的收尾复核 */
export const PREFLIGHT_ITEMS: readonly PreflightItem[] = [
  {
    id: "teletype",
    label: "读电传命令",
    detail: "确认当前有效目标与电传指定的弹种",
  },
  {
    id: "origin",
    label: "核对测量原点",
    detail: "测距红线必须从铁巢自身出发，不能从观测哨拉",
  },
  {
    id: "distance",
    label: "核对距离",
    detail: "用的是本局实测距离，不是上一阶段的旧值",
  },
  {
    id: "solution",
    label: "复算装药与仰角",
    detail: "仰角 = 12 × 距离 ÷ 档位，重新算一遍",
  },
  {
    id: "turret",
    label: "核对炮塔读数",
    detail: "方位角与仰角手轮读数与计算值完全吻合",
  },
];

export interface PreflightLine {
  text: string;
  level: "info" | "warn";
}

export interface PreflightSummary {
  lines: PreflightLine[];
  ready: boolean;
}

export function preflightSummary(
  mission: FireMission | null,
): PreflightSummary {
  if (!mission)
    return { lines: [{ text: "未选择任务", level: "warn" }], ready: false };

  const sol = missionSolution(mission);
  const lines: PreflightLine[] = [
    {
      text:
        "目标 " +
        (mission.label || "未命名") +
        (mission.gridRef ? "  @ " + mission.gridRef : ""),
      level: "info",
    },
    {
      text:
        "距离 " +
        mission.distanceKm.toFixed(1) +
        " km · 方位 " +
        (mission.bearingDeg === null
          ? "未测"
          : mission.bearingDeg.toFixed(1) + "°"),
      level: mission.bearingDeg === null ? "warn" : "info",
    },
    {
      text:
        "装药 " +
        mission.charge +
        " 档" +
        (mission.auto ? "（自动最小档）" : ""),
      level: "info",
    },
    {
      text:
        "仰角 " +
        formatElevation(sol.elevationDeg) +
        "° · 飞行 " +
        formatFlightTime(sol.flightTimeSec) +
        " 秒",
      level: "info",
    },
    {
      text: mission.ammoId ? "弹种 " + mission.ammoId : "弹种未选",
      level: mission.ammoId ? "info" : "warn",
    },
  ];

  for (const w of sol.warnings) lines.push({ text: w.message, level: "warn" });

  const ready =
    mission.bearingDeg !== null &&
    mission.ammoId !== null &&
    sol.warnings.length === 0;
  return { lines, ready };
}
