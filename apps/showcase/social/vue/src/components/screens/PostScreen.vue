<!--
  One post, and its comments. The first of the two drills.

  TWO COLUMNS ABOVE 900px, ONE BELOW. The picture takes the space it deserves
  and the conversation sits beside it; on a phone the picture goes back on top,
  because a comment thread beside a 390px picture is two narrow columns and
  neither is readable.

  THE COMMENTS COME FROM THE KIT IN READING ORDER, not date order: each
  top-level comment is followed immediately by its replies. A flat newest-first
  list scatters a reply away from the thing it replies to, which is the one
  arrangement a comment section must not have.

  AN UNKNOWN ID IS THIS SCREEN'S PROBLEM, not the router's.
-->
<script setup lang="ts">
import { computed, ref } from 'vue';
import { engagement, getComments, getPersonById, getPostById } from '@awc-ui/showcase-kit/social';
import { route } from '~/lib/routes';
import { useT } from '~/composables/useShowcase';
import { useEngagement } from '~/composables/useEngagement';
import Screen from '~/components/Screen.vue';
import Panel from '~/components/Panel.vue';
import Drill from '~/components/Drill.vue';
import PanelSkeleton from '~/components/skeletons/PanelSkeleton.vue';
import Avatar from '~/components/bits/Avatar.vue';
import Count from '~/components/bits/Count.vue';
import PersonName from '~/components/bits/PersonName.vue';
import PostActions from '~/components/bits/PostActions.vue';
import PostMedia from '~/components/bits/PostMedia.vue';
import When from '~/components/bits/When.vue';
import NotFoundScreen from './NotFoundScreen.vue';
import SnackbarHost from './SnackbarHost.vue';
import { useSnackbar } from './useSnackbar';

const props = defineProps<{ postId: string }>();
const t = useT();
const { isLiked, isSaved, toggleLike, toggleSave } = useEngagement();
const { message, say, close } = useSnackbar();

/* Comments the reader has added this session. They are not in the kit and never
   will be — the fixture is frozen — so they live here and vanish on a reload,
   the same contract every other override in this app has. */
const added = ref<string[]>([]);
const draft = ref('');

const post = computed(() => getPostById(props.postId));
const author = computed(() => (post.value ? getPersonById(post.value.authorId)! : null));
const comments = computed(() => (post.value ? getComments(post.value.id) : []));
const liked = computed(() => (post.value ? isLiked(post.value) : false));
const saved = computed(() => (post.value ? isSaved(post.value) : false));
const counts = computed(() =>
  post.value ? engagement(post.value, liked.value, saved.value) : null,
);

/* `md-text-field` reports through `mdInput` and its detail IS the bare string —
   unlike `md-search`, which carries `{ value }`. */
const draftListeners = {
  mdInput: (event: CustomEvent<string>) => {
    draft.value = String(event.detail ?? '');
  },
};

const postListeners = {
  mdClick: () => {
    if (draft.value.trim() === '') return;
    added.value = [...added.value, draft.value.trim()];
    draft.value = '';
    say('social.msg.posted');
  },
};

const onLike = () => post.value && say(toggleLike(post.value) ? 'social.msg.liked' : null);
const onSave = () =>
  post.value && say(toggleSave(post.value) ? 'social.msg.saved' : 'social.msg.unsaved');
</script>

<template>
  <NotFoundScreen v-if="!post || !author || !counts" />
  <Screen
    v-else
    :title="t('social.screen.post.title')"
    :subtitle="t('social.screen.post.subtitle', { name: author.displayName })"
  >
    <template #skeleton><PanelSkeleton height="620px" :lines="8" /></template>

    <div class="post-detail">
      <div class="post-detail__media"><PostMedia :post="post" eager /></div>

      <div class="post-detail__side">
        <Panel>
          <header class="post-card__head">
            <!-- `PersonName`, not `PersonLink`: this row is already one link,
                 and an anchor inside an anchor is invalid. -->
            <Drill link-class="post-card__author" :to="route.person(author.handle)">
              <Avatar :person="author" size="small" ring />
              <span class="post-card__names">
                <PersonName :person="author" show-handle />
                <span v-if="post.locationKey" class="post-card__place">
                  {{ t(post.locationKey) }}
                </span>
              </span>
            </Drill>
            <When :at="post.postedAt" />
          </header>

          <p class="post-card__caption">{{ t(post.captionKey) }}</p>

          <div class="row">
            <md-chip
              v-for="id in post.topics"
              :key="id"
              variant="assist"
              appearance="outlined"
              color="secondary"
              :label="t(`social.topic.${id}`)"
            ></md-chip>
          </div>

          <PostActions
            :liked="liked"
            :saved="saved"
            @like="onLike"
            @save="onSave"
            @share="say('social.msg.linkCopied')"
            @comment="() => {}"
          />

          <dl class="stat-row">
            <div>
              <dt>{{ t('social.count.likes') }}</dt>
              <dd><Count :value="counts.likeCount" /></dd>
            </div>
            <div>
              <dt>{{ t('social.count.comments') }}</dt>
              <dd><Count :value="counts.commentCount + added.length" /></dd>
            </div>
            <div>
              <dt>{{ t('social.count.shares') }}</dt>
              <dd><Count :value="counts.shareCount" /></dd>
            </div>
            <div>
              <dt>{{ t('social.count.saves') }}</dt>
              <dd><Count :value="counts.saveCount" /></dd>
            </div>
          </dl>
        </Panel>

        <Panel :title="t('social.panel.comments')">
          <template #actions><Count :value="comments.length + added.length" /></template>

          <p v-if="post.commentsDisabled" class="muted">{{ t('social.hint.commentsOff') }}</p>
          <div v-else-if="comments.length === 0 && added.length === 0" class="empty">
            <p>{{ t('social.empty.comments') }}</p>
            <p>{{ t('social.empty.commentsHint') }}</p>
          </div>
          <md-list
            v-else
            :label="t('social.panel.comments')"
            interaction-mode="multi-action"
            list-style="segmented"
          >
            <!-- A reply is marked with `data-reply` and drawn as an elbow by
                 `app.css`; the word "Reply" rides in the trailing slot as
                 visually-hidden text, because a drawn line tells a screen
                 reader nothing. No overline: it cost a whole line, so a reply
                 stood taller than the comment it answered. -->
            <md-list-item
              v-for="comment in comments"
              :key="comment.id"
              :data-reply="comment.replyToId ? '' : undefined"
              :headline="getPersonById(comment.authorId)!.displayName"
              :supporting-text="t(comment.bodyKey)"
              lines="2"
            >
              <span slot="leading">
                <Avatar :person="getPersonById(comment.authorId)!" size="small" />
              </span>
              <span slot="trailing" class="comment-trailing">
                <span v-if="comment.replyToId" class="visually-hidden">
                  {{ t('social.action.reply') }}
                </span>
                <When :at="comment.postedAt" />
                <span class="comment-likes">
                  <span class="material-symbols-outlined" aria-hidden="true">favorite</span>
                  <Count :value="comment.likeCount" />
                  <span class="visually-hidden">{{ t('social.count.likes') }}</span>
                </span>
              </span>
            </md-list-item>

            <md-list-item
              v-for="(body, index) in added"
              :key="`added-${index}`"
              data-mine=""
              :headline="t('social.common.you')"
              :supporting-text="body"
              lines="2"
            ></md-list-item>
          </md-list>

          <div v-if="!post.commentsDisabled" class="comment-compose">
            <!-- OUTLINED, not the default filled. A filled field reserves a band
                 at the top for its label to float into — 28px against 8px below,
                 measured — and on a single-line box that band is simply empty. -->
            <md-text-field
              v-awc="{ on: draftListeners }"
              variant="outlined"
              :label="t('social.action.comment')"
              :value="draft"
              multiline="auto-grow"
              :rows="1"
              full-width
            ></md-text-field>
            <md-button
              v-awc="{ on: postListeners }"
              variant="filled"
              icon="send"
              :soft-disabled="draft.trim() === '' || undefined"
            >
              {{ t('social.action.post') }}
            </md-button>
          </div>
        </Panel>
      </div>
    </div>

    <SnackbarHost :message="message" @close="close" />
  </Screen>
</template>
