<!--
  One post, and its comments. The first of the two drills.

  TWO COLUMNS ABOVE 900px, ONE BELOW. The picture takes the space it deserves
  and the conversation sits beside it; on a phone the picture goes back on top,
  because a comment thread beside a 390px picture is two narrow columns and
  neither is readable.

  THE COMMENTS COME FROM THE KIT IN READING ORDER, not date order: each
  top-level comment is followed immediately by its replies.

  AN UNKNOWN ID IS THIS SCREEN'S PROBLEM, not the router's.
-->
<script lang="ts">
  import { engagement, getComments, getPersonById, getPostById } from '@awc-ui/showcase-kit/social';
  import { route } from '$lib/routes';
  import { t } from '$lib/showcase';
  import { likes, saves, isLiked, isSaved, toggleLike, toggleSave } from '$lib/engagement';
  import Screen from '$lib/components/Screen.svelte';
  import Panel from '$lib/components/Panel.svelte';
  import Drill from '$lib/components/Drill.svelte';
  import PanelSkeleton from '$lib/skeletons/PanelSkeleton.svelte';
  import Avatar from '$lib/bits/Avatar.svelte';
  import Count from '$lib/bits/Count.svelte';
  import PersonName from '$lib/bits/PersonName.svelte';
  import PostActions from '$lib/bits/PostActions.svelte';
  import PostMedia from '$lib/bits/PostMedia.svelte';
  import When from '$lib/bits/When.svelte';
  import NotFoundScreen from './NotFoundScreen.svelte';
  import SnackbarHost from './SnackbarHost.svelte';
  import { createSnackbar } from './snackbar';

  export let postId: string;

  const { message, say, close } = createSnackbar();

  /* Comments the reader has added this session. They are not in the kit and
     never will be — the fixture is frozen — so they live here and vanish on a
     reload, the same contract every other override in this app has. */
  let added: string[] = [];
  let draft = '';

  $: post = getPostById(postId);
  $: author = post ? getPersonById(post.authorId)! : null;
  $: comments = post ? getComments(post.id) : [];
  $: liked = post ? isLiked($likes, post) : false;
  $: saved = post ? isSaved($saves, post) : false;
  $: counts = post ? engagement(post, liked, saved) : null;

  /* `md-text-field` reports through `mdInput` and its detail IS the bare
     string — unlike `md-search`, which carries `{ value }`. */
  function onDraft(event: CustomEvent<string>) {
    draft = String(event.detail ?? '');
  }

  function submit() {
    if (draft.trim() === '') return;
    added = [...added, draft.trim()];
    draft = '';
    say('social.msg.posted');
  }
</script>

{#if !post || !author || !counts}
  <NotFoundScreen />
{:else}
  <Screen
    title={$t('social.screen.post.title')}
    subtitle={$t('social.screen.post.subtitle', { name: author.displayName })}
  >
    <svelte:fragment slot="skeleton"><PanelSkeleton height="620px" lines={8} /></svelte:fragment>

    <div class="post-detail">
      <div class="post-detail__media"><PostMedia {post} eager /></div>

      <div class="post-detail__side">
        <Panel>
          <header class="post-card__head">
            <!-- `PersonName`, not `PersonLink`: this row is already one link,
                 and an anchor inside an anchor is invalid. -->
            <Drill href={route.person(author.handle)} linkClass="post-card__author">
              <Avatar person={author} size="small" ring />
              <span class="post-card__names">
                <PersonName person={author} showHandle />
                {#if post.locationKey}
                  <span class="post-card__place">{$t(post.locationKey)}</span>
                {/if}
              </span>
            </Drill>
            <When at={post.postedAt} />
          </header>

          <p class="post-card__caption">{$t(post.captionKey)}</p>

          <div class="row">
            {#each post.topics as id (id)}
              <md-chip
                variant="assist"
                appearance="outlined"
                color="secondary"
                label={$t(`social.topic.${id}`)}
              ></md-chip>
            {/each}
          </div>

          <PostActions
            {liked}
            {saved}
            on:like={() => say(toggleLike(post) ? 'social.msg.liked' : null)}
            on:save={() => say(toggleSave(post) ? 'social.msg.saved' : 'social.msg.unsaved')}
            on:share={() => say('social.msg.linkCopied')}
          />

          <dl class="stat-row">
            <div>
              <dt>{$t('social.count.likes')}</dt>
              <dd><Count value={counts.likeCount} /></dd>
            </div>
            <div>
              <dt>{$t('social.count.comments')}</dt>
              <dd><Count value={counts.commentCount + added.length} /></dd>
            </div>
            <div>
              <dt>{$t('social.count.shares')}</dt>
              <dd><Count value={counts.shareCount} /></dd>
            </div>
            <div>
              <dt>{$t('social.count.saves')}</dt>
              <dd><Count value={counts.saveCount} /></dd>
            </div>
          </dl>
        </Panel>

        <Panel title={$t('social.panel.comments')}>
          <svelte:fragment slot="actions">
            <Count value={comments.length + added.length} />
          </svelte:fragment>

          {#if post.commentsDisabled}
            <p class="muted">{$t('social.hint.commentsOff')}</p>
          {:else if comments.length === 0 && added.length === 0}
            <div class="empty">
              <p>{$t('social.empty.comments')}</p>
              <p>{$t('social.empty.commentsHint')}</p>
            </div>
          {:else}
            <md-list
              label={$t('social.panel.comments')}
              interaction-mode="multi-action"
              list-style="segmented"
            >
              <!-- A reply is marked with `data-reply` and drawn as an elbow by
                   `app.css`; the word "Reply" rides in the trailing slot as
                   visually-hidden text, because a drawn line tells a screen
                   reader nothing. No overline: it cost a whole line, so a reply
                   stood taller than the comment it answered. -->
              {#each comments as comment (comment.id)}
                <md-list-item
                  data-reply={comment.replyToId ? '' : undefined}
                  headline={getPersonById(comment.authorId)?.displayName}
                  supporting-text={$t(comment.bodyKey)}
                  lines="2"
                >
                  <span slot="leading">
                    <Avatar person={getPersonById(comment.authorId)} size="small" />
                  </span>
                  <span slot="trailing" class="comment-trailing">
                    {#if comment.replyToId}
                      <span class="visually-hidden">{$t('social.action.reply')}</span>
                    {/if}
                    <When at={comment.postedAt} />
                    <span class="comment-likes">
                      <span class="material-symbols-outlined" aria-hidden="true">favorite</span>
                      <Count value={comment.likeCount} />
                      <span class="visually-hidden">{$t('social.count.likes')}</span>
                    </span>
                  </span>
                </md-list-item>
              {/each}

              {#each added as body, index (index)}
                <md-list-item
                  data-mine=""
                  headline={$t('social.common.you')}
                  supporting-text={body}
                  lines="2"
                ></md-list-item>
              {/each}
            </md-list>
          {/if}

          {#if !post.commentsDisabled}
            <div class="comment-compose">
              <!-- OUTLINED, not the default filled. A filled field reserves a
                   band at the top for its label to float into — 28px against
                   8px below, measured — and on a single-line box that band is
                   simply empty. -->
              <md-text-field
                on:mdInput={onDraft}
                variant="outlined"
                label={$t('social.action.comment')}
                value={draft}
                multiline="auto-grow"
                rows={1}
                full-width
              ></md-text-field>
              <md-button
                on:mdClick={submit}
                variant="filled"
                icon="send"
                soft-disabled={draft.trim() === '' || undefined}
              >
                {$t('social.action.post')}
              </md-button>
            </div>
          {/if}
        </Panel>
      </div>
    </div>

    <SnackbarHost message={$message} on:close={close} />
  </Screen>
{/if}
