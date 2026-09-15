<script setup lang="ts">
import { computed } from 'vue';
import { parseGridRef, solveFromGridRefs } from '@/domain/grid';

const originText = defineModel<string>('origin', { default: 'A1 00' });
const targetText = defineModel<string>('target', { default: 'I5 68' });


const result = computed(() => {
  const o = parseGridRef(originText.value);
  const t = parseGridRef(targetText.value);
  if (!o || !t) return null;
  return solveFromGridRefs(o, t);
});

const originValid = computed(() => parseGridRef(originText.value) !== null);
const targetValid = computed(() => parseGridRef(targetText.value) !== null);
</script>

<template>
  <div class="gs">
    <label :class="{ err: !originValid }">
      铁巢格位
      <input v-model="originText" spellcheck="false" placeholder="A1 00" />
    </label>
    <span class="arrow">→</span>
    <label :class="{ err: !targetValid }">
      目标格位
      <input v-model="targetText" spellcheck="false" placeholder="I5 68" />
    </label>

    <div v-if="result">
      <span class="out">
        <b>{{ result.distanceKm.toFixed(1) }}</b> km ·
        <b>{{ result.bearingDeg.toFixed(1) }}</b>°
      </span>
    </div>
    <span v-else class="hint">格位格式：列 A–T + 行 1–10 + 两位子格，如 I5 68</span>
  </div>
</template>

<style scoped>
.gs {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--dim);
  font-size: 12px;
}

input {
  background: #0a0f0b;
  border: 1px solid var(--line);
  border-radius: 4px;
  color: var(--ink);
  font-family: var(--font-mono);
  font-size: 14px;
  padding: 5px 8px;
  width: 96px;
}

input:focus {
  outline: none;
  border-color: var(--amber);
}

label.err input {
  border-color: var(--red);
}

.arrow {
  color: var(--dim);
}

.out {
  font-size: 14px;
}

.out b {
  color: var(--amber);
  font-variant-numeric: tabular-nums;
}

.hint {
  color: var(--dim);
  font-size: 12px;
}

button {
  background: #1b2419;
  border: 1px solid var(--line);
  border-radius: 4px;
  color: var(--ink);
  font-family: var(--font-mono);
  font-size: 12px;
  padding: 5px 12px;
  cursor: pointer;
}

button:hover {
  border-color: var(--amber);
  color: var(--amber);
}
</style>
