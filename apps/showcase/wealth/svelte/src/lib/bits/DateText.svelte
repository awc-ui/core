<!--
  A calendar date.

  Rendered inside a `<time>` with a machine-readable `dateTime`, so the ISO
  value survives even though the visible text is localised. `formatDate` is
  pinned to UTC in the kit, so 2026-06-30 is 30 June west of Greenwich too.
-->
<script lang="ts">
  import { t } from '$lib/showcase';

  export let value: string;
  export let style: 'short' | 'medium' | 'long' | 'monthYear' = 'medium';
</script>

<time datetime={value}>{$t.formatDate(value, style)}</time>
