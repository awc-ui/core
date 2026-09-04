<!-- Every chip in the app resolves its label and colour the same way. -->
<script lang="ts">
  import { t } from '$lib/showcase';

  export let labelKey: string;
  export let color: string | undefined = undefined;
  export let icon: string | undefined = undefined;
  export let appearance = 'outlined';
</script>

<md-chip variant="assist" {appearance} {color} {icon} label={$t(labelKey)}></md-chip>
