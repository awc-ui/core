<!--
  The header row, shared by both holdings tables.

  The sort labels carry no `active` / `order`: `md-table` already declares
  `sort-by` / `sort-order` and pushes both down into every label on sync, so
  anything written here could only ever disagree with it.
-->
<script setup lang="ts">
import type { Column } from './holdings';

defineProps<{ columns: Column<string>[] }>();
</script>

<template>
  <md-table-head>
    <md-table-row rowgroup="head">
      <md-table-cell
        v-for="column in columns"
        :key="column.label"
        head
        scope="col"
        :numeric="column.numeric || undefined"
      >
        <md-table-sort-label
          v-if="column.key"
          :column="column.key"
          :default-order="column.numeric ? 'desc' : 'asc'"
          :icon-position="column.numeric ? 'start' : 'end'"
        >
          {{ column.label }}
        </md-table-sort-label>
        <template v-else>{{ column.label }}</template>
      </md-table-cell>
    </md-table-row>
  </md-table-head>
</template>
