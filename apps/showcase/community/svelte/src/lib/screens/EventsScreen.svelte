<!-- Buckets from the kit, empty ones dropped. `past` is LAST rather than
     first: a list read top to bottom begins with what is about to happen. -->
<script lang="ts">
  import { eventGroups, getEvents, getTotals } from '@awc-ui/showcase-kit/community';
  import Screen from '$lib/components/Screen.svelte';
  import Panel from '$lib/components/Panel.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import EventsSkeleton from '$lib/skeletons/EventsSkeleton.svelte';
  import Count from '$lib/bits/Count.svelte';
  import EventRow from './EventRow.svelte';
  import SnackbarHost from './SnackbarHost.svelte';
  import { createSnackbar } from './snackbar';
  import { t } from '$lib/showcase';

  const totals = getTotals();
  const groups = eventGroups(getEvents());
  const { message, say, close } = createSnackbar();
</script>

<Screen
  title={$t('community.screen.events.title')}
  subtitle={$t('community.screen.events.subtitle')}
>
  <svelte:fragment slot="skeleton"><EventsSkeleton /></svelte:fragment>
  <svelte:fragment slot="aside"><Count value={totals.goingCount} /></svelte:fragment>

  {#if groups.length === 0}
    <EmptyState message={$t('community.empty.events')} />
  {:else}
    {#each groups as group (group.bucket)}
      <Panel title={$t(group.labelKey)}>
        <svelte:fragment slot="actions"><Count value={group.events.length} /></svelte:fragment>
        <div class="event-list">
          {#each group.events as event (event.id)}
            <EventRow {event} on:message={(e) => say(e.detail.key, e.detail.params)} />
          {/each}
        </div>
      </Panel>
    {/each}
  {/if}

  <SnackbarHost message={$message} on:close={close} />
</Screen>
