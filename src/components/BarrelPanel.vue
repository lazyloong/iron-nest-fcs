<script setup lang="ts">
import { computed } from 'vue';
import { useBarrelStore, useMissionStore } from '@/stores';
import type { BarrelId } from '@/domain/tot';

const missionStore = useMissionStore();
const barrelStore = useBarrelStore();

const barrels = computed(() => [barrelStore.barrels.A, barrelStore.barrels.B]);

const bearingWarning = computed(() => {
  const a = barrelStore.barrels.A;
  const b = barrelStore.barrels.B;
  if (a.state === 'empty' || b.state === 'empty') return null;
  const ma = missionStore.missions.find((m) => m.id === a.missionId);
  const mb = missionStore.missions.find((m) => m.id === b.missionId);
  if (!ma || !mb || ma.bearingDeg === null || mb.bearingDeg === null) return null;
  const diff = Math.abs(((ma.bearingDeg - mb.bearingDeg + 540) % 360) - 180);
  if (diff > 2) return '两管方位相差 ' + diff.toFixed(1) + '°，共享方位角无法同时装定';
  if (diff <= 2 && Math.abs(ma.distanceKm - mb.distanceKm) > 0.05) {
    return '同方位齐射：距离 ' + ma.distanceKm.toFixed(1) + ' km 与 ' + mb.distanceKm.toFixed(1) + ' km';
  }
  return null;
});

function label(id: string | null): string {
  const m = missionStore.missions.find((x) => x.id === id);
  return m ? (m.label || m.gridRef || '未命名') : '空膛';
}

function stateText(state: string): string {
  return state === 'empty' ? '空膛' : state === 'ready' ? '已装填' : '已击发';
}
</script>

<template>
  <div class="bp">
    <div v-for="b in barrels" :key="b.barrel" class="barrel" :class="[b.state]">
      <div class="top">
        <span class="id">{{ b.barrel }} 管</span>
        <span class="state">{{ stateText(b.state) }}</span>
      </div>
      <div class="target">{{ label(b.missionId) }}</div>
      <div v-if="b.state !== 'empty'" class="nums">
        <span>{{ b.ammoId ?? '未选弹' }}</span>
        <span>{{ b.charge }} 档</span>
        <span class="elev">{{ b.elevationDeg.toFixed(2) }}°</span>
      </div>
      <div class="actions">
        <button type="button" :disabled="!missionStore.selected"
          @click="missionStore.selected && barrelStore.loadMission(b.barrel as BarrelId, missionStore.selected)">
          装填选中
        </button>
        <button type="button" :disabled="b.state !== 'ready'"
          @click="barrelStore.markFired(b.barrel as BarrelId)">击发</button>
        <button type="button" :disabled="b.state === 'empty'"
          @click="barrelStore.clearBarrel(b.barrel as BarrelId)">清空</button>
      </div>
    </div>
  </div>
  <p v-if="bearingWarning" class="warn">{{ bearingWarning }}</p>
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
  padding: 10px 12px;
}

.barrel.ready {
  border-color: var(--ok);
}

.barrel.fired {
  border-color: #6b4a48;
  opacity: 0.7;
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

.state {
  color: var(--dim);
  font-size: 11px;
}

.target {
  font-size: 15px;
  margin: 6px 0 4px;
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
}

.actions {
  display: flex;
  gap: 6px;
  margin-top: 10px;
}

button {
  background: #1b2419;
  border: 1px solid var(--line);
  border-radius: 4px;
  color: var(--ink);
  font-family: var(--font-mono);
  font-size: 11px;
  padding: 4px 8px;
  cursor: pointer;
}

button:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

button:hover:not(:disabled) {
  border-color: var(--amber);
  color: var(--amber);
}

.warn {
  color: var(--amber);
  font-size: 13px;
  margin: 10px 0 0;
}
</style>
