<script setup lang="ts">
import { computed } from "vue";
import type { BarrelId } from "@/domain/constants";
import { formatElevation } from "@/domain/format";
import { missionElevation, type FireMission } from "@/domain/fireMission";
import { formatClockTime } from "@/domain/gameClock";
import { assignBarrels, orderMissions } from "@/domain/missionOrder";
import { fireClockSecMap } from "@/domain/tot";
import { useMissionStore, useSettingsStore } from "@/stores";

const store = useMissionStore();
const settings = useSettingsStore();

/** 未击发序列（与队列同序） */
const pending = computed(() => {
  const ordered = orderMissions(store.missions, settings.sortMode, {
    fireClockSecById: fireClockSecMap(store.missions),
  });
  return ordered.filter((m) => m.status === "planned" || m.status === "loaded");
});

const fireMap = computed(() => fireClockSecMap(store.missions));

interface BarrelSlot {
  id: BarrelId;
  /** 在待击发序列里的位次；空槽为 0 */
  seq: number;
  mission: FireMission | null;
  fireClockSec: number | null;
}

/**
 * 炮位占用：按每个任务实际分配到的炮位取。
 * 用的是和卡片标识同一个 assignBarrels（手动优先、其余交替填补），
 * 所以点卡片上的 A/B 标识，这里会实时跟着变。
 */
const barrels = computed<BarrelSlot[]>(() => {
  const list = pending.value;
  const assigned = assignBarrels(list.map((m) => m.barrelOverride));

  const slot = (id: BarrelId): BarrelSlot => {
    const i = assigned.indexOf(id);
    if (i < 0) return { id, seq: 0, mission: null, fireClockSec: null };
    const mission = list[i]!;
    return { id, seq: i + 1, mission, fireClockSec: fireMap.value.get(mission.id) ?? null };
  };

  return [slot("A"), slot("B")];
});

function labelOf(m: FireMission): string {
  return m.label || m.gridRef || "未命名";
}

function bearingText(m: FireMission): string {
  return m.bearingDeg === null ? "—" : m.bearingDeg.toFixed(1) + "°";
}
</script>

<template>
  <div class="bp">
    <div v-for="b in barrels" :key="b.id" class="barrel" :class="{ empty: b.mission === null }">
      <div class="top">
        <span class="id">{{ b.id }} 管</span>
        <span v-if="b.mission" class="seq">第 {{ b.seq }} 发</span>
      </div>

      <template v-if="b.mission">
        <div class="target">{{ labelOf(b.mission) }}</div>

        <div class="grid">
          <div class="cell">
            <i>仰角</i>
            <b>{{ formatElevation(missionElevation(b.mission), settings.precision) }}°</b>
          </div>
          <div class="cell">
            <i>方位</i>
            <b>{{ bearingText(b.mission) }}</b>
          </div>
          <div class="cell">
            <i>装药</i>
            <b>{{ b.mission.charge }} 档</b>
          </div>
          <div class="cell">
            <i>开火</i>
            <b class="fire">{{ b.fireClockSec === null ? "—" : formatClockTime(b.fireClockSec) }}</b>
          </div>
        </div>
      </template>

      <div v-else class="target dim">空</div>
    </div>
  </div>
  <p class="hint">炮位按队列顺序自动轮转，点卡片上的 A/B 可手动指定</p>
</template>

<style scoped>
.bp {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.barrel {
  background: #0f150f;
  border: 1px solid var(--line);
  border-radius: 5px;
  padding: 9px 12px 10px;
}
.barrel.empty {
  opacity: 0.45;
}
.top {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}
.id {
  color: var(--amber);
  font-size: 13px;
  letter-spacing: 1px;
}
.seq {
  color: var(--dim);
  font-size: 11px;
}
.target {
  font-size: 14px;
  margin: 5px 0 7px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.target.dim {
  color: var(--dim);
  font-size: 13px;
  margin-top: 8px;
}

.grid {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 3px 10px;
}
.cell {
  display: flex;
  align-items: baseline;
  gap: 6px;
  white-space: nowrap;
}
.cell i {
  font-style: normal;
  color: var(--dim);
  font-size: 11px;
  min-width: 24px;
}
.cell b {
  color: var(--ok);
  font-size: 16px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.cell b.fire {
  color: var(--amber);
}
</style>
