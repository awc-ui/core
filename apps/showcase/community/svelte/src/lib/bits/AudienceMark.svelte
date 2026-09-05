<script lang="ts">
  import { audienceIcon, type Audience } from '@awc-ui/showcase-kit/community';
  import { t } from '$lib/showcase';
  export let audience: Audience;
  export let labelKey: string;
</script>

<md-tooltip text={$t(labelKey)}>
  <span class="material-symbols-outlined" role="img" aria-label={$t(labelKey)}
    >{audienceIcon[audience]}</span
  >
</md-tooltip>
