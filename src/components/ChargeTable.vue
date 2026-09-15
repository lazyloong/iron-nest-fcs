<script setup lang="ts">
import { computed } from 'vue';
import { compareCharges, type Charge } from '@/domain/ballistics';
import { formatElevation, formatFlightTime, formatSpeed, type Precision } from '@/domain/format';

const props = defineProps<{
  distanceKm: number;
  selected: Charge;
  precision: Precision;
}>();

const emit = defineEmits<{ select: [charge: Charge] }>();

const rows = computed(() => compareCharges(props.distanceKm));
</script>

<template>
  <table class="ct">
    <thead>
      <tr>
        <th>档位</th>
        <th>仰角</th>
        <th>上限射程</th>
        <th>弹速</th>
        <th>飞行时间</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="r in rows" :key="r.charge" :class="{ bad: !r.feasible, pick: r.charge === selected }"
        @click="r.feasible && emit('select', r.charge)">
        <td class="c">{{ r.charge }}</td>
        <td class="n">{{ r.feasible ? formatElevation(r.elevationDeg, props.precision) + '°' : r.reason }}</td>
        <td class="n">{{ r.maxRangeKm }} km</td>
        <td class="n">{{ formatSpeed(r.muzzleSpeedKmps, props.precision) }}</td>
        <td class="n">{{ r.feasible ? formatFlightTime(r.flightTimeSec) + ' s' : '—' }}</td>
      </tr>
    </tbody>
  </table>
</template>

<style scoped>
.ct {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

th {
  text-align: left;
  color: var(--dim);
  font-weight: 500;
  font-size: 11px;
  letter-spacing: 1px;
  border-bottom: 1px solid var(--line);
  padding: 5px 8px;
}

td {
  padding: 5px 8px;
  border-bottom: 1px solid #1a241b;
}

td.c {
  color: var(--dim);
}

td.n {
  font-variant-numeric: tabular-nums;
}

tbody tr {
  cursor: pointer;
}

tbody tr:hover:not(.bad) {
  background: #182218;
}

tr.bad td {
  color: #6b4a48;
  cursor: not-allowed;
}

tr.pick {
  background: #16241a;
}

tr.pick td {
  color: var(--ok);
}
</style>
