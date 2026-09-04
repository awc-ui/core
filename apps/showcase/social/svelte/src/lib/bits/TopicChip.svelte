<script lang="ts">
  import { t } from '$lib/showcase';

  export let id: string;
  export let selected = false;
</script>

<!-- `|| undefined` so a false value emits NO ATTRIBUTE. `selected` is a boolean
     attribute — presence means true — and Svelte omits an `undefined` one
     entirely, which is the behaviour the other builds were corrected to match. -->
<md-chip
  variant="filter"
  appearance="outlined"
  data-topic={id}
  selected={selected || undefined}
  label={$t(`social.topic.${id}`)}
></md-chip>
