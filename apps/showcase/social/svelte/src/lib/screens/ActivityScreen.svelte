<!--
  Activity — what happened to you, newest first.

  GROUPED BY AGE, NOT PAGED. Four buckets from the kit, and empty ones are
  dropped rather than rendered as a heading over nothing.

  THE SENTENCE IS A TRANSLATED TEMPLATE, not a name concatenated with a verb.
  `{name} liked your post` is one dictionary entry per kind, so Arabic puts the
  verb where Arabic puts the verb.

  READ AND UNREAD ARE BOTH IN THE LIST. Marking everything read is one button
  and it changes the badge in the rail; filtering the read ones out would make
  the button look like it deleted them.
-->
<script lang="ts">
  import { activityGroups, getTotals } from '@awc-ui/showcase-kit/social';
  import { route } from '$lib/routes';
  import { t } from '$lib/showcase';
  import Screen from '$lib/components/Screen.svelte';
  import Panel from '$lib/components/Panel.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import Drill from '$lib/components/Drill.svelte';
  import PanelSkeleton from '$lib/skeletons/PanelSkeleton.svelte';
  import ActivityIcon from '$lib/bits/ActivityIcon.svelte';
  import Avatar from '$lib/bits/Avatar.svelte';
  import Count from '$lib/bits/Count.svelte';
  import Media from '$lib/bits/Media.svelte';
  import When from '$lib/bits/When.svelte';

  const totals = getTotals();
  const groups = activityGroups();

  /* Read state is this screen's own override, and is NOT hoisted into the
     engagement store — unlike a like, it means nothing anywhere else. */
  let allRead = false;
  $: unread = allRead ? 0 : totals.unreadActivityCount;
</script>

<Screen title={$t('social.screen.activity.title')} subtitle={$t('social.screen.activity.subtitle')}>
  <svelte:fragment slot="aside">
    {#if unread > 0}<Count value={unread} />{/if}
  </svelte:fragment>
  <svelte:fragment slot="actions">
    {#if unread > 0}
      <md-button on:mdClick={() => (allRead = true)} variant="text" size="sm" icon="done_all">
        {$t('social.action.markAllRead')}
      </md-button>
    {/if}
  </svelte:fragment>
  <svelte:fragment slot="skeleton"><PanelSkeleton height="560px" lines={10} /></svelte:fragment>

  {#if groups.length === 0}
    <EmptyState message={$t('social.empty.activity')} />
  {:else}
    {#each groups as group (group.bucket)}
      <Panel title={$t(group.labelKey)}>
        <svelte:fragment slot="actions"><Count value={group.rows.length} /></svelte:fragment>
        <md-list label={$t(group.labelKey)} interaction-mode="multi-action" list-style="segmented">
          {#each group.rows as row (row.activity.id)}
            <md-list-item
              data-unread={!row.activity.read && !allRead ? '' : undefined}
              headline={$t(`social.activity.${row.activity.kind}`, { name: row.actor.displayName })}
              supporting-text={`@${row.actor.handle}`}
              lines="2"
            >
              <span slot="leading" class="activity-leading">
                <Avatar person={row.actor} size="small" />
                <ActivityIcon kind={row.activity.kind} />
              </span>
              <span slot="trailing" class="activity-trailing">
                <When at={row.activity.at} />
                <!-- A follow has no post to show, so the thumbnail slot is
                     genuinely empty rather than filled with a placeholder. -->
                {#if row.post}
                  <Drill href={route.post(row.post.id)} linkClass="activity-thumb">
                    <Media media={row.post.media[0]} className="activity-thumb__img" />
                  </Drill>
                {/if}
              </span>
            </md-list-item>
          {/each}
        </md-list>
      </Panel>
    {/each}
  {/if}
</Screen>
