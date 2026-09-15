<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed, onUnmounted, ref, watch } from 'vue';
import { AMMO_LIST } from '@/domain/ammo';
import { ALL_CHARGES, type Charge } from '@/domain/ballistics';
import { formatElevation } from '@/domain/format';
import { addClock, formatClockTime, formatDuration, parseClockTime } from '@/domain/gameClock';
import { missionElevation, missionFlightTime, type FireMission } from '@/domain/fireMission';
import { bearingDeg, distanceKm, formatGridRef, parseGridRef } from '@/domain/grid';
import { totalTraverseDeg } from '@/domain/missionOrder';
import { buildTotPlan, type BarrelId } from '@/domain/tot';
import { useMissionStore, useSettingsStore } from '@/stores';

const store = useMissionStore();
const settings = useSettingsStore();

/* ---------------------- 本地节拍：驱动怀表与倒计时 ---------------------- */
const nowMs = ref(Date.now());
const beat = window.setInterval(() => {
  nowMs.value = Date.now();
}, 200);
onUnmounted(() => window.clearInterval(beat));

const watchNow = computed(() => {
  if (settings.watchSec === null) return null;
  return addClock(settings.watchSec, (nowMs.value - settings.syncedAtMs) / 1000);
});

const syncInput = ref('');
const syncError = ref(false);

function doSync(): void {
  const sec = parseClockTime(syncInput.value);
  if (sec === null) {
    syncError.value = true;
    return;
  }
  syncError.value = false;
  settings.syncWatch(sec);
  syncInput.value = '';
}

/* ------------------------------ 排程 ------------------------------ */
const plan = computed(() => buildTotPlan(store.missions, { nowClockSec: watchNow.value }));

const nextMissionId = computed(() => {
  const upcoming = plan.value.steps
    .filter((s) => s.untilSec !== null && s.untilSec >= 0)
    .sort((a, b) => (a.untilSec as number) - (b.untilSec as number));
  return upcoming[0]?.missionId ?? null;
});

/* --------------------------- 显示排序 --------------------------- */

/**
 * 队列派生数据（排序 + 炮位分配）全部来自 store —— 单一数据源。
 * 炮位面板用的是同一份，所以手动改炮位两边永远一致。
 */
const { orderedMissions, pendingMissions, barrelByMission, currentBearing } = storeToRefs(store);

/** 点炮位标识：指定该管；再点一次取消，回到自动交替 */
function toggleBarrel(mission: FireMission, which: BarrelId): void {
  store.update(mission.id, { barrelOverride: mission.barrelOverride === which ? null : which });
}

/** 一趟扫完的总回转角（按目标逐个算） */
const traverseTotal = computed(() =>
  totalTraverseDeg(
    pendingMissions.value.filter((x) => x.bearingDeg !== null),
    (x) => x.bearingDeg as number,
    currentBearing.value,
  ),
);


/* --------------------------- 手动拖拽排序 --------------------------- */

const dragId = ref<string | null>(null);
const dropId = ref<string | null>(null);

function isPending(m: FireMission): boolean {
  return m.status === 'planned' || m.status === 'loaded';
}

/** 只有「手动模式 + 未击发」的卡片能拖 */
function canDrag(m: FireMission): boolean {
  return settings.sortMode === 'manual' && isPending(m);
}

function onDragStart(m: FireMission, e: DragEvent): void {
  if (!canDrag(m)) return;
  dragId.value = m.id;
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', m.id);
  }
}

function onDragOver(m: FireMission): void {
  if (dragId.value === null || !isPending(m)) return;
  dropId.value = m.id;
}

function onDragEnd(): void {
  dragId.value = null;
  dropId.value = null;
}

function onDrop(target: FireMission): void {
  const from = dragId.value;
  dragId.value = null;
  dropId.value = null;
  if (from === null || from === target.id || !isPending(target)) return;
  store.moveMissionBefore(from, target.id);
}
/* ---------------------------- 到点提示音 ---------------------------- */
let audioCtx: AudioContext | null = null;
function beep(freq: number): void {
  if (!settings.soundEnabled) return;
  try {
    audioCtx = audioCtx ?? new AudioContext();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.16);
  } catch {
    /* 音频不可用时静默降级 */
  }
}

const alerted = ref<Set<string>>(new Set());

watch(
  () => plan.value.steps.map((s) => (s.untilSec === null ? 'x' : s.untilSec.toFixed(1))).join(','),
  () => {
    for (const step of plan.value.steps) {
      if (step.untilSec === null) continue;
      if (step.untilSec <= 0 && step.untilSec > -1.5 && !alerted.value.has(step.missionId)) {
        alerted.value.add(step.missionId);
        beep(step.barrel === 'A' ? 880 : 620);
      }
    }
  },
);

watch(
  () => store.missions.map((m) => m.id + ':' + m.impactClockSec).join(','),
  () => {
    alerted.value = new Set();
  },
);

/* ---------------------------- 操作 ---------------------------- */
/** 提交：清掉草稿，写回 store */
function setImpact(mission: FireMission, raw: string): void {
  const next = { ...impactDraft.value };
  delete next[mission.id];
  impactDraft.value = next;
  store.update(mission.id, { impactClockSec: parseClockTime(raw) });
}

/** 队列里改格位：能解析就用「铁巢格位」反算距离与方位 */
function setGrid(mission: FireMission, raw: string): void {
  const target = parseGridRef(raw);
  if (target === null) {
    store.update(mission.id, { gridRef: raw });
    return;
  }
  const text = formatGridRef(target);
  const nest = parseGridRef(settings.nestGrid);
  if (nest === null) {
    store.update(mission.id, { gridRef: text });
    return;
  }
  store.update(mission.id, {
    gridRef: text,
    distanceKm: Number(distanceKm(nest, target).toFixed(1)),
    bearingDeg: Number(bearingDeg(nest, target).toFixed(1)),
  });
}

function setCharge(mission: FireMission, raw: string): void {
  store.update(mission.id, { charge: Number(raw) as Charge, auto: false });
}

function stepOf(missionId: string) {
  return plan.value.steps.find((s) => s.missionId === missionId) ?? null;
}

function untilOf(missionId: string): number | null {
  return stepOf(missionId)?.untilSec ?? null;
}

/**
 * 经过时刻的输入草稿。
 *
 * 打表之后组件每 200ms 重渲染一次；若输入框的值直接来自 store，
 * 用户刚敲进去、还没提交的内容会被下一次渲染冲掉。
 * 所以未提交的文本先存在这里，提交（change / 回车）时才写回 store。
 */
const impactDraft = ref<Record<string, string>>({});

/** 输入框显示值：优先草稿，其次已提交值 */
function impactText(mission: FireMission): string {
  const draft = impactDraft.value[mission.id];
  if (draft !== undefined) return draft;
  return mission.impactClockSec === null ? '' : formatClockTime(mission.impactClockSec);
}

/** 每次击键都记草稿，这样重渲染时值不会变 */
function onImpactInput(mission: FireMission, raw: string): void {
  impactDraft.value = { ...impactDraft.value, [mission.id]: raw };
}

function fireText(missionId: string): string {
  const step = stepOf(missionId);
  return step === null ? '—' : formatClockTime(step.fireClockSec);
}

function untilText(missionId: string): string {
  const u = untilOf(missionId);
  if (u === null) return '—';
  if (u < 0) return '已过';
  return formatDuration(u);
}


function statusText(status: FireMission['status']): string {
  return status === 'planned'
    ? '待击发'
    : status === 'loaded'
      ? '已装填'
      : status === 'fired'
        ? '已击发'
        : status === 'hit'
          ? '命中'
          : '未中';
}
</script>

<template>
  <div class="mq">
    <!-- 对表 -->
    <div class="watch">
      <div class="wt">
        <span class="wl">游戏时间</span>
        <span class="wv">{{ watchNow === null ? '--:--:--' : formatClockTime(watchNow) }}</span>
      </div>
      <div class="wsync">
        <input v-model="syncInput" :class="{ err: syncError }" placeholder="124736" spellcheck="false"
          @keyup.enter="doSync" />
        <button type="button" @click="doSync">对表</button>
      </div>
      <span class="whint">
        {{ watchNow === null ? '按怀表读数对表一次，之后自动走时' : '已对表 · 开火时刻会自动倒计时' }}
      </span>

      <span class="sortsel">
        <span class="sl">排序</span>
        <button type="button" :class="{ on: settings.sortMode === 'time' }" @click="settings.sortMode = 'time'">
          开火时刻
        </button>
        <button type="button" :class="{ on: settings.sortMode === 'traverse' }" @click="settings.sortMode = 'traverse'">
          最小回转
        </button>

        <button type="button" :class="{ on: settings.sortMode === 'manual' }" @click="settings.sortMode = 'manual'">
          手动
        </button>

        <span v-if="settings.sortMode === 'traverse' && pendingMissions.length > 1" class="tt">
          总回转 {{ traverseTotal.toFixed(0) }}°
        </span>
      </span>
    </div>

    <p v-if="!store.missions.length" class="empty">
      队列为空 —— 在左侧解算后点「加入任务队列 →」
    </p>

    <div v-else class="list">
      <div v-for="m in orderedMissions" :key="m.id" class="card" :draggable="canDrag(m)" :class="{
        sel: m.id === store.selectedId,
        next: m.id === nextMissionId && m.status === 'planned',
        past: m.status === 'planned' && (untilOf(m.id) ?? 1) < 0,
        done: m.status !== 'planned',
        dragging: dragId === m.id,
        'drop-target': dropId === m.id && dragId !== m.id,
      }" @click="store.selectedId = m.id" @dragstart="onDragStart(m, $event)" @dragover.prevent="onDragOver(m)"
        @drop.prevent="onDrop(m)" @dragend="onDragEnd">
        <!-- 第一行：目标 · 仰角 · 方位角 · 装药 · 开火时间 -->
        <div class="r1">
          <input class="lab" title="目标" :value="m.label"
            @input="store.update(m.id, { label: ($event.target as HTMLInputElement).value })" />
          <span class="kv">
            <i>仰角</i>
            <b class="hi">{{ formatElevation(missionElevation(m), settings.precision) }}°</b>
          </span>
          <span class="kv">
            <i>方位</i>
            <b class="hi">{{ m.bearingDeg === null ? '—' : m.bearingDeg.toFixed(1) + '°' }}</b>
          </span>
          <span class="kv">
            <i>装药</i>
            <select class="ch" :value="m.charge" @change="setCharge(m, ($event.target as HTMLSelectElement).value)">
              <option v-for="c in ALL_CHARGES" :key="c" :value="c">{{ c }} 档</option>
            </select>
          </span>
          <span class="kv">
            <i>格位</i>
            <input class="g-in" :value="m.gridRef" placeholder="I5 68" spellcheck="false" title="改这里会按铁巢格位反算距离与方位"
              @change="setGrid(m, ($event.target as HTMLInputElement).value)" />
          </span>
          <span class="kv grow">
            <i>开火</i>
            <b class="fire">{{ fireText(m.id) }}</b>
          </span>
        </div>

        <!-- 第二行：其余全部 -->
        <div class="r2">
          <span class="kv"><i>距离</i><span>{{ m.distanceKm.toFixed(1) }} km</span></span>
          <span class="kv">
            <i>弹种</i>
            <select :value="m.ammoId ?? ''"
              @change="store.update(m.id, { ammoId: ($event.target as HTMLSelectElement).value || null })">
              <option value="">—</option>
              <option v-for="a in AMMO_LIST" :key="a.id" :value="a.id">{{ a.id }}</option>
            </select>
          </span>
          <span class="kv"><i>飞行</i><span>{{ missionFlightTime(m).toFixed(1) }} s</span></span>
          <span class="kv">
            <i>经过</i>
            <input class="t-in" :value="impactText(m)" placeholder="124736" spellcheck="false" title="直接敲数字即可，不用打冒号"
              @input="onImpactInput(m, ($event.target as HTMLInputElement).value)"
              @change="setImpact(m, ($event.target as HTMLInputElement).value)"
              @keyup.enter="setImpact(m, ($event.target as HTMLInputElement).value)" />
          </span>
          <span class="kv">
            <i>还剩</i>
            <b class="cd" :class="{ now: (untilOf(m.id) ?? 99) < 15 && (untilOf(m.id) ?? -1) >= 0 }">
              {{ untilText(m.id) }}
            </b>
          </span>

          <span class="spacer"></span>

          <span class="st" :class="m.status">{{ statusText(m.status) }}</span>
          <span class="ops">

<span v-if="isPending(m)" class="bl" :class="{ on: barrelByMission.get(m.id) === 'A', manual: m.barrelOverride === 'A' }" :title="m.barrelOverride === 'A' ? '手动指定 A 管 · 点击取消' : '点击指定 A 管'" @click.stop="toggleBarrel(m, 'A')">A</span>
<span v-if="isPending(m)" class="bl" :class="{ on: barrelByMission.get(m.id) === 'B', manual: m.barrelOverride === 'B' }" :title="m.barrelOverride === 'B' ? '手动指定 B 管 · 点击取消' : '点击指定 B 管'" @click.stop="toggleBarrel(m, 'B')">B</span>

            <template v-if="m.status === 'planned'">
              <button type="button" class="firebtn" @click.stop="store.markFired(m.id)">击发</button>
            </template>
            <template v-else-if="m.status === 'fired'">
              <button type="button" @click.stop="store.markResult(m.id, true)">命中</button>
              <button type="button" @click.stop="store.markResult(m.id, false)">未中</button>
              <button type="button" @click.stop="store.resetToPlanned(m.id)">撤销</button>
            </template>
            <template v-else>
              <button type="button" @click.stop="store.resetToPlanned(m.id)">撤销</button>
            </template>
            <button type="button" class="del" title="删除" @click.stop="store.remove(m.id)">✕</button>
          </span>
        </div>
      </div>
    </div>

    <ul v-if="plan.conflicts.length" class="conflicts">
      <li v-for="(c, i) in plan.conflicts" :key="i">⚠ {{ c.message }}</li>
    </ul>
  </div>
</template>

<style scoped>
.mq {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* 对表 */
.watch {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}

.wt {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.wl {
  color: var(--dim);
  font-size: 11px;
  letter-spacing: 1px;
}

.wv {
  font-size: 27px;
  color: var(--amber);
  font-variant-numeric: tabular-nums;
  letter-spacing: 1px;
  line-height: 1;
}

.wsync {
  display: flex;
  gap: 5px;
  align-items: center;
}

.whint {
  color: var(--dim);
  font-size: 11px;
}

.sortsel {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
}

.sortsel .sl {
  color: var(--dim);
  font-size: 11px;
  margin-right: 2px;
}

.sortsel button {
  background: #0f150f;
  border: 1px solid var(--line);
  border-radius: 3px;
  color: var(--dim);
  font-family: var(--font-mono);
  font-size: 11px;
  padding: 3px 8px;
  cursor: pointer;
}

.sortsel button:hover {
  border-color: var(--amber);
  color: var(--amber);
}

.sortsel button.on {
  background: #1f3020;
  border-color: var(--ok);
  color: var(--ok);
}

.sortsel .tt {
  color: var(--amber);
  font-size: 11px;
  margin-left: 4px;
  font-variant-numeric: tabular-nums;
}

.bl {
  display: inline-block;
  cursor: pointer;
  user-select: none;
  min-width: 18px;
  text-align: center;
  border: 1px solid var(--line);
  border-radius: 3px;
  color: #4a5a4a;
  font-size: 11px;
  padding: 3px 6px;
}

.bl.on {
  background: #1f3020;
  border-color: var(--ok);
  color: var(--ok);
  font-weight: 600;
}

/* 手动指定：琥珀色，跟自动交替区分开 */
.bl.manual.on {
  background: #2a1f10;
  border-color: var(--amber);
  color: var(--amber);
}

.empty {
  color: var(--dim);
  font-size: 12px;
  margin: 4px 0;
}

/* 任务卡片 */
.list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.card {
  background: #0f150f;
  border: 1px solid var(--line);
  border-radius: 5px;
  padding: 7px 10px 6px;
  cursor: pointer;
}

.card:hover {
  border-color: #3a5040;
}

.card[draggable='true'] {
  cursor: grab;
}

.card[draggable='true']:active {
  cursor: grabbing;
}

.card.dragging {
  opacity: 0.3;
}

.card.drop-target {
  border-color: var(--ok);
  box-shadow: inset 0 2px 0 var(--ok);
}

.card.sel {
  background: #131d13;
  border-color: var(--amber);
}

.card.next {
  box-shadow: inset 3px 0 0 var(--amber);
}

.card.past,
.card.done {
  opacity: 0.5;
}

.card.done .hi,
.card.done .fire {
  color: var(--dim);
}

.r1 {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.r2 {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 4px;
  padding-top: 4px;
  border-top: 1px solid #1a241b;
  font-size: 12px;
  color: var(--dim);
}

.grow {
  margin-left: auto;
}

.spacer {
  flex: 1 1 0;
  min-width: 0;
}

.kv {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  white-space: nowrap;
}

.kv i {
  font-style: normal;
  color: var(--dim);
  font-size: 11px;
}

.kv span {
  font-variant-numeric: tabular-nums;
}

.hi {
  color: var(--ok);
  font-size: 17px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.fire {
  color: var(--ok);
  font-size: 17px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.cd {
  font-variant-numeric: tabular-nums;
  color: var(--ink);
}

.cd.now {
  color: var(--amber);
  font-size: 15px;
}

.st {
  font-size: 11px;
  white-space: nowrap;
  color: var(--dim);
}

.st.fired {
  color: var(--amber);
}

.st.hit {
  color: var(--ok);
}

.st.missed {
  color: var(--red);
}

input,
select {
  background: #0a0f0b;
  border: 1px solid var(--line);
  border-radius: 3px;
  color: var(--ink);
  font-family: var(--font-mono);
  font-size: 13px;
  padding: 3px 5px;
}

input.lab {
  width: 104px;
}

input.t-in {
  width: 94px;
  text-align: center;
}

input.g-in {
  width: 84px;
  text-align: center;
  letter-spacing: 1px;
}

select.ch {
  font-size: 13px;
}

input.err {
  border-color: var(--red);
}

input:focus,
select:focus {
  outline: none;
  border-color: var(--amber);
}

.ops {
  display: flex;
  gap: 4px;
}

.ops button {
  background: #1b2419;
  border: 1px solid var(--line);
  border-radius: 3px;
  color: var(--ink);
  font-family: var(--font-mono);
  font-size: 11px;
  padding: 3px 8px;
  cursor: pointer;
  white-space: nowrap;
}

.ops button:hover {
  border-color: var(--amber);
  color: var(--amber);
}

.ops button.firebtn {
  border-color: #3d5a3a;
  color: var(--ok);
  font-weight: 600;
}

.ops button.firebtn:hover {
  background: #1f3020;
  border-color: var(--ok);
}

.ops button.del:hover {
  border-color: var(--red);
  color: var(--red);
}

.conflicts {
  list-style: none;
  margin: 0;
  padding: 0;
  color: var(--red);
  font-size: 12px;
}
</style>


