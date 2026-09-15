import { defineStore } from "pinia";
import { computed, ref, watch } from "vue";
import type { Precision } from "@/domain/format";
import type { SortMode } from "@/domain/missionOrder";
import { createMission, type FireMission, type MissionStatus } from "@/domain/fireMission";

const SETTINGS_KEY = "iron-nest-fcs.settings.v1";
const MISSIONS_KEY = "iron-nest-fcs.missions.v1";

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* 存储不可用时静默降级 */
  }
}

/* ----------------------------- 设置 ----------------------------- */

export const useSettingsStore = defineStore("settings", () => {
  const saved = readJson(SETTINGS_KEY, {
    precision: 2 as Precision,
    soundEnabled: true,
    autoCharge: true,
    sortMode: "time" as SortMode,
    watchSec: null as number | null,
    syncedAtMs: 0,
    nestGrid: "A1 00",
  });

  const precision = ref<Precision>(saved.precision ?? 2);
  const soundEnabled = ref<boolean>(saved.soundEnabled ?? true);
  const autoCharge = ref<boolean>(saved.autoCharge ?? true);

  /** 队列排序：time=按开火时刻 / traverse=最小回转 / manual=手动 */
  const sortMode = ref<SortMode>(saved.sortMode ?? "time");

  /** 铁巢自身格位 —— 全局唯一，队列里改格位要靠它反算距离/方位 */
  const nestGrid = ref<string>(saved.nestGrid ?? "A1 00");

  /** 对表时的游戏怀表读数（一天内秒数）；null = 尚未对表 */
  const watchSec = ref<number | null>(saved.watchSec ?? null);
  /** 对表发生的本地时刻（epoch ms） */
  const syncedAtMs = ref<number>(saved.syncedAtMs ?? 0);

  /** 把本地时钟对齐到游戏怀表 */
  function syncWatch(sec: number): void {
    watchSec.value = sec;
    syncedAtMs.value = Date.now();
  }

  watch(
    [
      precision,
      soundEnabled,
      autoCharge,
      sortMode,
      watchSec,
      syncedAtMs,
      nestGrid,
    ],
    () =>
      writeJson(SETTINGS_KEY, {
        precision: precision.value,
        soundEnabled: soundEnabled.value,
        autoCharge: autoCharge.value,
        sortMode: sortMode.value,
        watchSec: watchSec.value,
        syncedAtMs: syncedAtMs.value,
        nestGrid: nestGrid.value,
      }),
    { deep: true },
  );

  return {
    precision,
    soundEnabled,
    autoCharge,
    sortMode,
    watchSec,
    syncedAtMs,
    nestGrid,
    syncWatch,
  };
});

/* --------------------------- 火力任务 --------------------------- */

export const useMissionStore = defineStore("missions", () => {
  const missions = ref<FireMission[]>(
    readJson<FireMission[]>(MISSIONS_KEY, []),
  );
  const selectedId = ref<string | null>(null);

  watch(missions, () => writeJson(MISSIONS_KEY, missions.value), {
    deep: true,
  });

  const selected = computed(
    () => missions.value.find((m) => m.id === selectedId.value) ?? null,
  );

  const scheduled = computed(() =>
    missions.value.filter((m) => m.impactClockSec !== null),
  );

  function add(mission: FireMission): FireMission {
    missions.value.push(mission);
    selectedId.value = mission.id;
    return mission;
  }

  function addNew(input: Partial<FireMission> = {}): FireMission {
    return add(
      createMission({ label: "目标 " + (missions.value.length + 1), ...input }),
    );
  }

  function update(id: string, patch: Partial<FireMission>): void {
    const i = missions.value.findIndex((m) => m.id === id);
    if (i < 0) return;
    const next = { ...missions.value[i]!, ...patch };
    // 自动档模式下，距离变化时重算档位
    if (patch.distanceKm !== undefined && next.auto) {
      next.charge = createMission({
        distanceKm: next.distanceKm,
        auto: true,
      }).charge;
    }
    missions.value[i] = next;
  }

  /** 把 id 移动到 targetId 之前（拖拽排序用） */
  function moveMissionBefore(id: string, targetId: string): void {
    if (id === targetId) return;
    const list = [...missions.value];
    const from = list.findIndex((x) => x.id === id);
    if (from < 0) return;
    const [moved] = list.splice(from, 1);
    const to = list.findIndex((x) => x.id === targetId);
    if (to < 0) {
      // 目标不存在则原样放回
      list.splice(from, 0, moved!);
      return;
    }
    list.splice(to, 0, moved!);
    missions.value = list;
  }

  function remove(id: string): void {
    missions.value = missions.value.filter((m) => m.id !== id);
    if (selectedId.value === id) selectedId.value = null;
  }

  function setStatus(id: string, status: MissionStatus): void {
    update(id, { status });
  }

  /** 标记已击发（记录本地时间，供战后复盘） */
  function markFired(id: string): void {
    update(id, { status: "fired", firedAt: Date.now() });
  }

  /** 登记弹着结果 */
  function markResult(id: string, hit: boolean): void {
    update(id, { status: hit ? "hit" : "missed" });
  }

  /** 复位回计划状态 */
  function resetToPlanned(id: string): void {
    update(id, { status: "planned", firedAt: null });
  }

  function clearAll(): void {
    missions.value = [];
    selectedId.value = null;
  }

  function exportJson(): string {
    return JSON.stringify(missions.value, null, 2);
  }

  function importJson(text: string): boolean {
    try {
      const parsed = JSON.parse(text) as FireMission[];
      if (!Array.isArray(parsed)) return false;
      missions.value = parsed;
      return true;
    } catch {
      return false;
    }
  }

  return {
    missions,
    selectedId,
    selected,
    scheduled,
    add,
    addNew,
    update,
    remove,
    setStatus,
    moveMissionBefore,
    markFired,
    markResult,
    resetToPlanned,
    clearAll,
    exportJson,
    importJson,
  };
});

