<!--
  The header row, shared by both holdings tables.

  The sort labels carry no `active` / `order`: `md-table` already declares
  `sort-by` / `sort-order` and pushes both down into every label on sync, so
  anything written here could only ever disagree with it.
-->
<script lang="ts">
  import type { Column } from './holdings';

  export let columns: Column<string>[];
</script>

<md-table-head>
  <md-table-row rowgroup="head">
    {#each columns as column (column.label)}
      <md-table-cell head scope="col" numeric={column.numeric || undefined}>
        {#if column.key}
          <md-table-sort-label
            column={column.key}
            default-order={column.numeric ? 'desc' : 'asc'}
            icon-position={column.numeric ? 'start' : 'end'}
          >
            {column.label}
          </md-table-sort-label>
        {:else}
          {column.label}
        {/if}
      </md-table-cell>
    {/each}
  </md-table-row>
</md-table-head>
