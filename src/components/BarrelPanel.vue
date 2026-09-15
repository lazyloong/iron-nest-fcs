<script setup lang="ts">
import { storeToRefs } from "pinia";
import { formatElevation } from "@/domain/format";
import { missionElevation, type FireMission } from "@/domain/fireMission";
import { formatClockTime } from "@/domain/gameClock";
import { useMissionStore, useSettingsStore } from "@/stores";

const store = useMissionStore();
const settings = useSettingsStore();

/**
 * 炮位占用直接来自 store —— 和队列卡片是同一份数据，
 * 所以点卡片上的 A/B 标识，这里会实时跟着变。
 */
const { barrels } = storeToRefs(store);

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
