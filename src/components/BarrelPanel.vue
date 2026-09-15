<script setup lang="ts">
import { computed } from "vue";
import { AMMO_LIST } from "@/domain/ammo";
import { formatElevation } from "@/domain/format";
import { missionElevation, missionFlightTime, type FireMission } from "@/domain/fireMission";
import type { BarrelId } from "@/domain/constants";
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

interface BarrelSlot {
  id: BarrelId;
  /** 在待击发序列里的位次；空槽为 0 */
  seq: number;
  mission: FireMission | null;
}

/**
 * 炮位占用：**按每个任务实际分配到的炮位取**。
 * 用的是和卡片标识同一个 assignBarrels（手动优先、其余交替填补），
 * 所以点卡片上的 A/B 标识，这里会实时跟着变。
 */
const barrels = computed<BarrelSlot[]>(() => {
  const list = pending.value;
  const assigned = assignBarrels(list.map((m) => m.barrelOverride));
  const slot = (id: BarrelId): BarrelSlot => {
    const i = assigned.indexOf(id);
    return i < 0 ? { id, seq: 0, mission: null } : { id, seq: i + 1, mission: list[i]! };
  };
  return [slot("A"), slot("B")];
});

function ammoName(id: string | null): string {
  if (id === null) return "未选弹";
  return AMMO_LIST.find((a) => a.id === id)?.name ?? id;
}

function labelOf(m: FireMission): string {
  return m.label || m.gridRef || "未命名";
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
        <div class="nums">
          <span>{{ ammoName(b.mission.ammoId) }}</span>
          <span>{{ b.mission.charge }} 档</span>
          <span class="elev">{{ formatElevation(missionElevation(b.mission), settings.precision) }}°</span>
        </div>
        <div class="sub">
          距离 {{ b.mission.distanceKm.toFixed(1) }} km · 飞行 {{ missionFlightTime(b.mission).toFixed(1) }} s
        </div>
      </template>
      <div v-else class="target dim">空</div>
    </div>
  </div>
  <p class="hint">炮位按队列顺序自动轮转，不需要手动装填</p>
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
  padding: 9px 12px;
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
  font-size: 15px;
  margin: 6px 0 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.target.dim {
  color: var(--dim);
  font-size: 13px;
}
.nums {
  display: flex;
  gap: 12px;
  color: var(--dim);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}
.nums .elev {
  color: var(--ok);
  font-weight: 600;
}
.sub {
  margin-top: 4px;
  color: var(--dim);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}
.hint {
  margin: 8px 0 0;
  color: var(--dim);
  font-size: 11px;
}
</style>



