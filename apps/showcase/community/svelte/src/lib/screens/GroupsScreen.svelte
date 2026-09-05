<!-- TWO SECTIONS AND THE JOIN BUTTON IS THE DIFFERENCE. `joinAction` decides
     which control each role gets, including the two that offer nothing. -->
<script lang="ts">
  import { getDiscoverGroups, getJoinedGroups, getTotals } from '@awc-ui/showcase-kit/community';
  import Screen from '$lib/components/Screen.svelte';
  import Panel from '$lib/components/Panel.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import GroupsSkeleton from '$lib/skeletons/GroupsSkeleton.svelte';
  import Count from '$lib/bits/Count.svelte';
  import GroupCard from './GroupCard.svelte';
  import SnackbarHost from './SnackbarHost.svelte';
  import { createSnackbar } from './snackbar';
  import { t } from '$lib/showcase';

  const totals = getTotals();
  const joined = getJoinedGroups();
  const discover = getDiscoverGroups();
  const { message, say, close } = createSnackbar();
</script>

<Screen
  title={$t('community.screen.groups.title')}
  subtitle={$t('community.screen.groups.subtitle')}
>
  <svelte:fragment slot="skeleton"><GroupsSkeleton /></svelte:fragment>
  <svelte:fragment slot="aside"><Count value={totals.groupCount} /></svelte:fragment>

  <Panel title={$t('community.panel.yourGroups')}>
    <svelte:fragment slot="actions"><Count value={joined.length} /></svelte:fragment>
    {#if joined.length === 0}
      <EmptyState
        message={$t('community.empty.groups')}
        hint={$t('community.empty.groupsHint')}
      />
    {:else}
      <div class="card-grid">
        {#each joined as group (group.id)}
          <GroupCard {group} on:message={(e) => say(e.detail.key, e.detail.params)} />
        {/each}
      </div>
    {/if}
  </Panel>

  <Panel title={$t('community.panel.discover')}>
    <svelte:fragment slot="actions"><Count value={discover.length} /></svelte:fragment>
    <div class="card-grid">
      {#each discover as group (group.id)}
        <GroupCard {group} on:message={(e) => say(e.detail.key, e.detail.params)} />
      {/each}
    </div>
  </Panel>

  <SnackbarHost message={$message} on:close={close} />
</Screen>
