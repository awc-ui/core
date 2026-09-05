<!-- A PRIVATE GROUP THE VIEWER IS NOT IN SHOWS ITS ABOUT AND NOTHING ELSE, and
     SAYS the posts are withheld — an empty feed with no explanation reads as a
     dead group, and one that showed its posts anyway would make the flag a
     decoration. -->
<script lang="ts">
  import { getGroupBySlug, groupSummary, joinAction } from '@awc-ui/showcase-kit/community';
  import Screen from '$lib/components/Screen.svelte';
  import Panel from '$lib/components/Panel.svelte';
  import Drill from '$lib/components/Drill.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import CoverSkeleton from '$lib/skeletons/CoverSkeleton.svelte';
  import Avatar from '$lib/bits/Avatar.svelte';
  import Count from '$lib/bits/Count.svelte';
  import DateText from '$lib/bits/DateText.svelte';
  import Media from '$lib/bits/Media.svelte';
  import PrivacyChip from '$lib/bits/PrivacyChip.svelte';
  import RoleChip from '$lib/bits/RoleChip.svelte';
  import EventRailRow from './EventRailRow.svelte';
  import Timeline from './Timeline.svelte';
  import NotFoundScreen from './NotFoundScreen.svelte';
  import SnackbarHost from './SnackbarHost.svelte';
  import { createSnackbar } from './snackbar';
  import { roleFor, roles, setRole } from '$lib/engagement';
  import { route } from '$lib/routes';
  import { t } from '$lib/showcase';

  export let slug: string;
  const { message, say, close } = createSnackbar();

  $: found = getGroupBySlug(slug);
  $: summary = found ? groupSummary(found.id) : null;
  $: role = found ? roleFor($roles, found) : 'none';
  $: action = joinAction[role];
  $: member = ['admin', 'moderator', 'member'].includes(role);
  $: hidden = summary?.group.privacy === 'private' && !member;

  function press() {
    if (!found) return;
    const was = role;
    const next = was === 'none' ? (found.privacy === 'private' ? 'pending' : 'member') : 'none';
    setRole(found, next);
    say(
      next === 'member'
        ? 'community.msg.joined'
        : next === 'pending'
          ? 'community.msg.requested'
          : was === 'pending'
            ? 'community.msg.requestCancelled'
            : 'community.msg.left',
      { name: found.name },
    );
  }
</script>

{#if !summary}
  <NotFoundScreen />
{:else}
  <Screen
    title={summary.group.name}
    subtitle={$t('community.screen.group.subtitle')}
    crumbLabel={summary.group.name}
  >
    <svelte:fragment slot="skeleton"><CoverSkeleton timeline /></svelte:fragment>
    <svelte:fragment slot="aside"><Count value={summary.group.memberCount} compact /></svelte:fragment>

    <div class="columns">
      <div class="columns__main">
        <Panel>
          <Media media={summary.group.cover} className="event-cover" eager />
          <h2 class="profile-head__name">{summary.group.name}</h2>
          <div class="row">
            <PrivacyChip group={summary.group} />
            <RoleChip {role} />
            <span class="person-row__meta">
              <Count value={summary.group.memberCount} compact />
              {$t('community.count.members').toLocaleLowerCase($t.locale)}
            </span>
            {#if action}
              <md-button variant={action.variant} icon={action.icon} on:mdClick={press}>
                {$t(action.labelKey)}
              </md-button>
            {/if}
          </div>
          <p>{$t(summary.group.descriptionKey)}</p>
          {#if summary.group.joinedAt}
            <p class="person-row__meta">
              {$t('community.hint.joinedGroup', { date: '' })}<DateText
                at={summary.group.joinedAt}
                format="long"
              />
            </p>
          {/if}
        </Panel>

        {#if hidden}
          <EmptyState message={$t('community.hint.privateGroup')} />
        {:else if summary.posts.length === 0}
          <EmptyState message={$t('community.empty.posts')} />
        {:else}
          <Timeline posts={summary.posts} on:message={(e) => say(e.detail.key, e.detail.params)} />
        {/if}
      </div>

      <aside class="columns__rail">
        {#if summary.events.length > 0}
          <Panel title={$t('community.panel.groupEvents')}>
            <svelte:fragment slot="actions"><Count value={summary.events.length} /></svelte:fragment>
            <!-- The RAIL variant: a 300px column cannot hold the list row's
                 three tracks. -->
            <div class="rail-block">
              {#each summary.events as event (event.id)}
                <EventRailRow {event} />
              {/each}
            </div>
          </Panel>
        {/if}

        <Panel title={$t('community.panel.members')}>
          <svelte:fragment slot="actions"><Count value={summary.contributors.length} /></svelte:fragment>
          {#if summary.contributors.length === 0}
            <EmptyState message={$t('community.empty.members')} />
          {:else}
            <div class="rail-block">
              {#each summary.contributors as person (person.id)}
                <Drill linkClass="rail-row" href={route.person(person.handle)}>
                  <Avatar {person} size="small" />
                  <span class="rail-row__text">
                    <span class="rail-row__name">{person.displayName}</span>
                  </span>
                </Drill>
              {/each}
            </div>
          {/if}
        </Panel>
      </aside>
    </div>

    <SnackbarHost message={$message} on:close={close} />
  </Screen>
{/if}
