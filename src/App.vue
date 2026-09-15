<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import BarrelPanel from '@/components/BarrelPanel.vue';
import ChargeTable from '@/components/ChargeTable.vue';
import GridSolver from '@/components/GridSolver.vue';
import MissionQueue from '@/components/MissionQueue.vue';
import { minChargeFor, solve, type Charge } from '@/domain/ballistics';
import { bearingDeg, distanceKm, formatGridRef, gridRefFromPolar, parseGridRef } from '@/domain/grid';
import { formatElevation, formatFlightTime } from '@/domain/format';
import { PREFLIGHT_ITEMS, preflightSummary } from '@/domain/preflight';
import { useMissionStore, useSettingsStore } from '@/stores';

const settings = useSettingsStore();
const missionStore = useMissionStore();

const targetText = ref('I5 68');
const distance = ref(9.8);
const bearing = ref<number | null>(null);
const charge = ref<Charge>(1);
const auto = ref(true);

const solution = computed(() => (auto.value ? solve(distance.value) : solve(distance.value, charge.value)));

watch(
  distance,
  (d) => {
    if (auto.value) charge.value = minChargeFor(d);
  },
  { immediate: true },
);

function clampDistance(v: number): number {
  return Math.min(30, Math.max(0.1, Math.round(v * 10) / 10));
}

/** 滚轮微调距离（±0.1 km） */
function onWheel(e: WheelEvent): void {
  distance.value = clampDistance(distance.value + (e.deltaY > 0 ? 0.1 : -0.1));
}

/* ---------------- 格位 ⇄ 距离/方位角 双向解算 ---------------- */

/** 防重入：一侧写回另一侧时不再反向触发 */
let guard = false;

/** 距离 / 方位角 → 目标格位 */
function applyPolarToGrid(): void {
  if (guard) return;
  const origin = parseGridRef(settings.nestGrid);
  if (!origin || bearing.value === null) return;
  const target = gridRefFromPolar(origin, distance.value, bearing.value);
  if (!target) return;
  const text = formatGridRef(target);
  if (text === targetText.value) return;
  guard = true;
  targetText.value = text;
  guard = false;
}

/** 目标格位 → 距离 / 方位角 */
function applyGridToPolar(): void {
  if (guard) return;
  const origin = parseGridRef(settings.nestGrid);
  const target = parseGridRef(targetText.value);
  if (!origin || !target) return;
  guard = true;
  distance.value = clampDistance(distanceKm(origin, target));
  bearing.value = Number(bearingDeg(origin, target).toFixed(1));
  guard = false;
}

/** 方位角也可以直接手填，不必走测绘 */
const bearingText = computed(() => (bearing.value === null ? '' : bearing.value.toFixed(1)));
const bearInput = ref<HTMLInputElement | null>(null);

function onBearChange(): void {
  setBearing(bearInput.value === null ? '' : bearInput.value.value);
}

function setBearing(raw: string): void {
  const t = raw.trim().replace(/[^\d.-]/g, '');
  if (!t) {
    bearing.value = null;
    return;
  }
  const n = Number(t);
  if (!Number.isFinite(n)) return;
  bearing.value = ((n % 360) + 360) % 360;
}

function selectCharge(c: Charge): void {
  auto.value = false;
  charge.value = c;
}


watch(targetText, applyGridToPolar, { flush: 'sync', immediate: true });
watch([distance, bearing], applyPolarToGrid, { flush: 'sync' });
watch(() => settings.nestGrid, applyPolarToGrid, { flush: 'sync' });

function addToQueue(): void {
  missionStore.addNew({
    distanceKm: distance.value,
    bearingDeg: bearing.value,
    gridRef: targetText.value,
    charge: charge.value,
    auto: auto.value,
  });
}

const preflight = computed(() => preflightSummary(missionStore.selected));

function exportQueue(): void {
  const blob = new Blob([missionStore.exportJson()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'iron-nest-missions.json';
  a.click();
  URL.revokeObjectURL(url);
}

function importQueue(e: Event): void {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    if (typeof reader.result === 'string') missionStore.importJson(reader.result);
  };
  reader.readAsText(file);
  input.value = '';
}
</script>

<template>
  <main class="wrap">
    <header>
      <h1>铁巢重炮 · 火控计算机</h1>
      <p class="sub">IRON NEST · 弹道解算</p>
    </header>

    <div class="cols">
      <!-- ======================= 左：解算 ======================= -->
      <div class="col">
        <section class="panel">
          <h2>解算</h2>
          <GridSolver v-model:origin="settings.nestGrid" v-model:target="targetText" />

          <div class="row">
            <div class="fld">
              <span class="lb">距离</span>
              <input v-model.number="distance" type="number" step="0.1" min="0.1" max="30" @wheel.prevent="onWheel" />
              <span class="unit">km</span>
            </div>
            <div class="fld">
              <span class="lb">方位角</span>
              <input ref="bearInput" class="bear" :value="bearingText" placeholder="0-360" spellcheck="false"
                @change="onBearChange" />
              <span class="unit">°</span>
            </div>
          </div>

          <div class="opts">
            <label class="chk">
              <input v-model="auto" type="checkbox" @change="auto && (charge = minChargeFor(distance))" />
              自动最小档
            </label>
            <button v-if="bearing !== null" type="button" class="ghost" @click="bearing = null">清方位</button>
          </div>

          <div class="summary">
            <span><i>装药</i><b>{{ solution.charge }}</b> 档</span>
            <span><i>仰角</i><b>{{ formatElevation(solution.elevationDeg, settings.precision) }}°</b></span>
            <span><i>飞行</i><b>{{ formatFlightTime(solution.flightTimeSec) }}</b> 秒</span>
          </div>
          <button type="button" class="add" @click="addToQueue">加入任务队列 →</button>
          <p v-for="w in solution.warnings" :key="w.code" class="bad">{{ w.message }}</p>

          <ChargeTable :distance-km="distance" :selected="solution.charge" :precision="settings.precision"
            @select="selectCharge" />
          <p class="tip">点击任意可行档位可手动锁档；距离变化时自动档会重算。</p>
        </section>

        <section class="panel">
          <div class="head">
            <h2>开火前 5 点自检</h2>
            <span class="ready" :class="{ ok: preflight.ready }">{{ preflight.ready ? '可以击发' : '未就绪' }}</span>
          </div>
          <div class="pf-item" v-for="(item, i) in PREFLIGHT_ITEMS" :key="item.id">
            <span class="num">{{ i + 1 }}</span>
            <div>
              <b>{{ item.label }}</b>
              <span class="detail">{{ item.detail }}</span>
            </div>
          </div>
          <div class="pf-cur">
            <div class="pf-title">当前选中任务</div>
            <div v-for="(l, i) in preflight.lines" :key="i" :class="['line', l.level]">{{ l.text }}</div>
          </div>
        </section>

        <section class="panel">
          <h2>设置</h2>
          <div class="settings">
            <button type="button" @click="exportQueue">导出队列</button>
            <label class="file">
              导入队列
              <input type="file" accept="application/json" @change="importQueue" />
            </label>
            <label class="chk">
              仰角小数位
              <select v-model.number="settings.precision">
                <option :value="0">0</option>
                <option :value="1">1</option>
                <option :value="2">2</option>
              </select>
            </label>
            <label class="chk"><input v-model="settings.soundEnabled" type="checkbox" /> 开火提示音</label>
          </div>
        </section>
      </div>

      <!-- ======================= 右：队列 ======================= -->
      <div class="col">
        <section class="panel">
          <h2>双炮位</h2>
          <BarrelPanel />
        </section>

        <section class="panel">
          <div class="head">
            <h2>火力任务队列</h2>
            <button type="button" class="danger" @click="missionStore.clearAll()">清空队列</button>
          </div>
          <MissionQueue />
        </section>
      </div>
    </div>
  </main>
</template>

<style scoped>
.wrap {
  max-width: 1680px;
  margin: 0 auto;
  padding: 18px 18px 56px;
}

header h1 {
  font-size: 21px;
  letter-spacing: 2px;
  margin: 0 0 2px;
}

.sub {
  color: var(--dim);
  margin: 0 0 16px;
  font-size: 12px;
  letter-spacing: 1px;
}

.cols {
  display: grid;
  grid-template-columns: minmax(320px, 1fr) minmax(560px, 1.45fr);
  gap: 12px;
  align-items: start;
}

.col {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.panel {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 12px 16px 16px;
  min-width: 0;
  overflow-x: auto;
}

.panel h2 {
  font-size: 12px;
  color: var(--amber);
  letter-spacing: 2px;
  margin: 0 0 12px;
  font-weight: 600;
}

.head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.row {
  display: flex;
  align-items: center;
  gap: 20px;
  flex-wrap: wrap;
  margin: 14px 0 8px;
}

.fld {
  display: flex;
  align-items: center;
  gap: 6px;
}

.lb {
  color: var(--dim);
  font-size: 12px;
  margin-right: 2px;
}

.unit {
  color: var(--dim);
  font-size: 13px;
  margin-left: 2px;
}

.opts {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 8px;
}

.bear {
  width: 74px;
  text-align: center;
}

button.ghost {
  padding: 4px 8px;
  font-size: 11px;
  color: var(--dim);
}

.chk {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--dim);
  font-size: 12px;
}

input,
select {
  background: #0a0f0b;
  border: 1px solid var(--line);
  border-radius: 4px;
  color: var(--ink);
  font-family: var(--font-mono);
  font-size: 14px;
  padding: 5px 7px;
}

input[type='number'] {
  width: 88px;
  text-align: center;
}

input:focus,
select:focus {
  outline: none;
  border-color: var(--amber);
}

button {
  background: #1b2419;
  border: 1px solid var(--line);
  border-radius: 4px;
  color: var(--ink);
  font-family: var(--font-mono);
  font-size: 12px;
  padding: 6px 11px;
  cursor: pointer;
}

button:hover {
  border-color: var(--amber);
  color: var(--amber);
}

button.danger:hover {
  border-color: var(--red);
  color: var(--red);
}

.summary {
  display: flex;
  align-items: baseline;
  gap: 18px;
  flex-wrap: wrap;
  padding: 6px 0;
}

.summary span {
  font-size: 12px;
}

.summary i {
  color: var(--dim);
  font-style: normal;
  margin-right: 5px;
  font-size: 11px;
}

.summary b {
  color: var(--ok);
  font-size: 18px;
  font-variant-numeric: tabular-nums;
}

.add {
  width: 100%;
  margin-bottom: 6px;
}

.bad {
  color: var(--red);
  font-size: 12px;
  margin: 4px 0;
}

.tip {
  color: var(--dim);
  font-size: 11px;
  margin: 8px 0 0;
}

.ready {
  font-size: 12px;
  color: var(--red);
  letter-spacing: 1px;
  white-space: nowrap;
}

.ready.ok {
  color: var(--ok);
}

.pf-item {
  display: flex;
  gap: 8px;
  margin-bottom: 7px;
  font-size: 13px;
}

.pf-item .num {
  color: var(--amber);
  font-size: 12px;
  min-width: 14px;
}

.pf-item .detail {
  display: block;
  color: var(--dim);
  font-size: 11px;
}

.pf-cur {
  background: #0f150f;
  border: 1px solid var(--line);
  border-radius: 5px;
  padding: 10px 12px;
  margin-top: 10px;
}

.pf-title {
  color: var(--dim);
  font-size: 11px;
  letter-spacing: 1px;
  margin-bottom: 6px;
}

.line {
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}

.line.warn {
  color: var(--amber);
}

.settings {
  display: flex;
  gap: 14px;
  align-items: center;
  flex-wrap: wrap;
}

.file {
  position: relative;
  overflow: hidden;
  display: inline-block;
  background: #1b2419;
  border: 1px solid var(--line);
  border-radius: 4px;
  padding: 6px 11px;
  font-size: 12px;
  cursor: pointer;
}

.file input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
  width: 100%;
}

@media (max-width: 1180px) {
  .cols {
    grid-template-columns: 1fr;
  }
}
</style>
