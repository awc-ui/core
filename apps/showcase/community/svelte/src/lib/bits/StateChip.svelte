<script lang="ts">
  import { t } from '$lib/showcase';
  export let labelKey: string;
  export let color: string | undefined = undefined;
  export let icon: string | undefined = undefined;
  export let appearance: 'outlined' | 'filled' = 'outlined';
</script>

<md-chip variant="assist" {appearance} {color} {icon} label={$t(labelKey)}></md-chip>
