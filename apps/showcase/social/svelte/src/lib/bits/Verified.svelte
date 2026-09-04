<!-- The tick, with a name a screen reader can read. -->
<script lang="ts">
  import type { Person } from '@awc-ui/showcase-kit/social';
  import { t } from '$lib/showcase';

  export let person: Person;
</script>

{#if person.verified}
  <md-tooltip text={$t('social.verified')}>
    <span class="verified material-symbols-outlined" role="img" aria-label={$t('social.verified')}>
      verified
    </span>
  </md-tooltip>
{/if}
