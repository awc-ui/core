<!--
  The feed — the screen this app is judged on.

  POSTS FROM PEOPLE YOU FOLLOW, NEWEST FIRST, and the selection rule is the
  kit's `getFeed()`: someone who follows YOU does not thereby appear here, and
  that asymmetry is the whole reason `Relationship` has four values instead of a
  boolean.

  ONE COLUMN, CAPPED. A feed is a column of pictures read at one width; letting
  it stretch across a 1600px monitor makes every photograph a letterbox.

  IT PAGES BY REVEALING, NOT BY FETCHING. There is no infinite scroll: a scroll
  handler that appends on intersection is untestable in a parity check,
  unreachable from a keyboard, and would make the document height — which
  `verify-showcase-parity` compares across builds — depend on how far the
  harness happened to scroll.
-->
<script lang="ts">
  import { FEED_PAGE, feedItems, storyRail, suggestedPeople, type Person } from '@awc-ui/showcase-kit/social';
  import { route } from '$lib/routes';
  import { t } from '$lib/showcase';
  import { follows, isFollowing, setFollowing } from '$lib/engagement';
  import Screen from '$lib/components/Screen.svelte';
  import Panel from '$lib/components/Panel.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import Drill from '$lib/components/Drill.svelte';
  import PanelSkeleton from '$lib/skeletons/PanelSkeleton.svelte';
  import Avatar from '$lib/bits/Avatar.svelte';
  import Count from '$lib/bits/Count.svelte';
  import FollowButton from '$lib/bits/FollowButton.svelte';
  import PostCard from './PostCard.svelte';
  import StoryRail from './StoryRail.svelte';
  import SnackbarHost from './SnackbarHost.svelte';
  import { createSnackbar } from './snackbar';

  const { message, say, close } = createSnackbar();

  const items = feedItems();
  const rail = storyRail();
  const suggestions = suggestedPeople(5);

  let shown = FEED_PAGE;
  $: visible = items.slice(0, shown);

  function follow(person: Person, next: boolean) {
    setFollowing(person, next);
    say(next ? 'social.msg.followed' : 'social.msg.unfollowed', { name: person.displayName });
  }
</script>

<Screen title={$t('social.screen.feed.title')} subtitle={$t('social.screen.feed.subtitle')}>
  <svelte:fragment slot="skeleton"><PanelSkeleton height="640px" lines={6} /></svelte:fragment>

  <StoryRail rings={rail} />

  <div class="feed-layout">
    <div class="feed">
      {#if visible.length === 0}
        <EmptyState message={$t('social.empty.feed')} hint={$t('social.empty.feedHint')} />
      {:else}
        <!-- Only the first decodes eagerly. Everything below the fold is lazy,
             which is what keeps forty images off the first paint. -->
        {#each visible as item, index (item.post.id)}
          <PostCard
            {item}
            eager={index === 0}
            on:message={(e) => say(e.detail.key, e.detail.params)}
          />
        {/each}
      {/if}

      {#if shown < items.length}
        <div class="feed__more">
          <md-button on:mdClick={() => (shown = items.length)} variant="tonal" icon="expand_more">
            {$t('social.action.viewAll')}
          </md-button>
        </div>
      {:else}
        <div class="feed__end">
          <span class="material-symbols-outlined" aria-hidden="true">check_circle</span>
          <p class="strong">{$t('social.common.caughtUp')}</p>
          <p class="muted">{$t('social.common.caughtUpHint')}</p>
        </div>
      {/if}
    </div>

    <!-- ASIDE CONTENT, AND IT SAYS SO. `app.css` moves it below the column on a
         phone rather than above it: a reader who opened the app came for the
         posts. -->
    <aside class="feed-aside">
      <Panel title={$t('social.panel.suggested')}>
        <svelte:fragment slot="actions"><Count value={suggestions.length} /></svelte:fragment>
        <!-- PLAIN ROWS, NOT `md-list-item`. Four text slots and a trailing
             action do not fit in a 340px aside: the handle rendered as a
             truncated small-caps overline and "Follows you" wrapped to three
             lines beside the button. -->
        <div class="stack">
          {#each suggestions as person (person.id)}
            <div class="suggest-row">
              <Avatar {person} size="small" />
              <span class="suggest-row__text">
                <Drill href={route.person(person.handle)} linkClass="suggest-row__name">
                  {person.displayName}
                </Drill>
                <span class="suggest-row__meta">{$t(person.relationshipKey)}</span>
              </span>
              <FollowButton
                {person}
                following={isFollowing($follows, person)}
                on:toggle={(e) => follow(person, e.detail)}
              />
            </div>
          {/each}
        </div>
      </Panel>
    </aside>
  </div>

  <SnackbarHost message={$message} on:close={close} />
</Screen>
