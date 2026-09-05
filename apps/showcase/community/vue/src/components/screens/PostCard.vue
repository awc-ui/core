<!--
  One post. The most-repeated component in the app and the most complex, and
  both for the same reason: four kinds share it, and one of them contains
  another post.

  THE ORDER IS BYLINE, BODY, ATTACHMENT, AGGREGATE, ACTIONS, COMMENTS — and the
  body comes SECOND, which is the whole inversion from Lyra. There the picture
  is the post and the caption trails it; here the writing is the post and the
  picture, link or shared card is an attachment to it.

  THE WHOLE CARD IS NOT A LINK. Only the author, the group, the timestamp and
  the comment count navigate. Wrapping the card would swallow the reaction
  picker, the six option buttons inside it and the comment box.
-->
<script setup lang="ts">
import { computed, ref } from 'vue';
import { reactionSummary, type FeedItem } from '@awc-ui/showcase-kit/community';
import Panel from '~/components/Panel.vue';
import ReactButton from '~/components/bits/ReactButton.vue';
import ReactionSummaryRow from '~/components/bits/ReactionSummaryRow.vue';
import Byline from './Byline.vue';
import PostBody from './PostBody.vue';
import PostAttachment from './PostAttachment.vue';
import CommentThread from './CommentThread.vue';
import { useEngagement } from '~/composables/useEngagement';
import { useT } from '~/composables/useShowcase';

const props = withDefaults(defineProps<{ item: FeedItem; showComments?: boolean }>(), {
  showComments: false,
});
const emit = defineEmits<{
  (e: 'message', key: string | null, params?: Record<string, string | number>): void;
}>();

const t = useT();
const { reactionFor, setReaction } = useEngagement();
const open = ref(props.showComments);

const mine = computed(() => reactionFor(props.item.post));
/* The kit does the arithmetic of turning an override plus a shipped count into
   the numbers on screen — including the SWITCH case, where a reader moves from
   one reaction to another and two counts have to move. */
const summary = computed(() =>
  reactionSummary(props.item.post.reactions, props.item.post.viewerReaction, mine.value),
);
</script>

<template>
  <Panel>
    <article class="post-card" :data-post="props.item.post.id">
      <p v-if="props.item.shared" class="post-card__meta">
        {{
          t(
            props.item.shared.group
              ? 'community.hint.sharedGroupPost'
              : 'community.hint.sharedPost',
            { name: props.item.author.displayName, group: props.item.shared.group?.name ?? '' },
          )
        }}
      </p>

      <Byline :item="props.item" />
      <PostBody :post="props.item.post" />
      <PostAttachment :item="props.item" />

      <ReactionSummaryRow
        :summary="summary"
        :comment-count="props.item.post.commentCount"
        :share-count="props.item.post.shareCount"
        @open-comments="open = true"
      />

      <div class="post-actions">
        <ReactButton
          :mine="mine"
          @pick="
            (next) => {
              setReaction(props.item.post, next);
              /* Reacting announces; taking it back does not. A snackbar is for
                 something the reader may want to verify, and un-reacting is
                 already its own confirmation — the button goes grey. */
              emit('message', next ? 'community.reaction.summary' : null, {
                count: summary.total + (next ? 1 : 0),
              });
            }
          "
        />
        <md-button variant="text" icon="mode_comment" :aria-expanded="open" @click="open = !open">
          {{ t('community.action.comment') }}
        </md-button>
        <md-button variant="text" icon="share" @click="emit('message', 'community.msg.linkCopied')">
          {{ t('community.action.share') }}
        </md-button>
      </div>

      <template v-if="open">
        <p v-if="props.item.post.commentsDisabled" class="muted">
          {{ t('community.hint.commentsOff') }}
        </p>
        <CommentThread
          v-else
          :post-id="props.item.post.id"
          @message="(k, p) => emit('message', k, p)"
        />
      </template>
    </article>
  </Panel>
</template>
