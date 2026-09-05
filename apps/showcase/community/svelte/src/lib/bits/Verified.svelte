<script lang="ts">
  import type { Person } from '@awc-ui/showcase-kit/community';
  import { t } from '$lib/showcase';
  export let person: Person;
</script>

{#if person.verified}
  <md-tooltip text={$t('community.verified')}>
    <span class="verified material-symbols-outlined" role="img" aria-label={$t('community.verified')}
      >verified</span
    >
  </md-tooltip>
{/if}
