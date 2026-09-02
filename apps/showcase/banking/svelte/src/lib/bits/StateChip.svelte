<!--
  Every chip in the app comes through here.

  One component, one mapping table, so a category is the same colour in the
  ring, the statement row and the budget meter. A screen names the domain value
  and this resolves it through `status.ts` — it never picks a `color` itself.
-->
<script lang="ts">
  import { t } from '$lib/showcase';

  export let labelKey: string;
  export let color: string;
  export let icon: string | undefined = undefined;
  export let appearance = 'outlined';
</script>

<md-chip variant="assist" {appearance} {color} {icon} label={$t(labelKey)}></md-chip>
