<!--
  One comment and its replies, with the collapse control between them.

  The control counts the WHOLE subtree, not the direct children: "3 more
  replies" that reveals three rows and then two more nested under them has
  undercounted, and the reader has to press again on something that did not say
  it was there.

  ONE TOGGLE AT A TIME. `hiddenCount` is a property of the DATA and does not
  change when the reader expands, so keying both buttons off it independently
  showed "View 1 more reply" directly above "Hide replies".
-->
<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  REPLY_PAGE,
  reactionSummary,
  subtreeSize,
  type ThreadNode,
} from '@awc-ui/showcase-kit/community';
import Drill from '~/components/Drill.vue';
import Avatar from '~/components/bits/Avatar.vue';
import Count from '~/components/bits/Count.vue';
import When from '~/components/bits/When.vue';
import { route } from '~/lib/routes';
import { useEngagement } from '~/composables/useEngagement';
import { useT } from '~/composables/useShowcase';

const props = defineProps<{ node: ThreadNode }>();
const t = useT();
const { commentReactionFor, setCommentReaction } = useEngagement();
const expanded = ref(false);

const mine = computed(() => commentReactionFor(props.node.comment));
const summary = computed(() =>
  reactionSummary(props.node.comment.reactions, props.node.comment.viewerReaction, mine.value),
);
const shown = computed(() =>
  expanded.value ? props.node.children : props.node.children.slice(0, REPLY_PAGE),
);
const hiddenCount = computed(() =>
  props.node.children.slice(REPLY_PAGE).reduce((total, child) => total + 1 + subtreeSize(child), 0),
);
const self = computed(() =>
  props.node.author.friendship === 'self'
    ? route.profile()
    : route.person(props.node.author.handle),
);
</script>

<template>
  <div class="thread__branch">
    <div
      class="comment"
      :data-comment="props.node.comment.id"
      :data-depth="String(props.node.comment.depth)"
    >
      <Drill link-class="comment__avatar" :to="self">
        <Avatar :person="props.node.author" size="small" />
      </Drill>

      <div>
        <div class="comment__bubble">
          <!-- "Replying to X" AT DEPTH 2 ONLY. At depth 1 the indent is
               unambiguous — one possible parent, directly above. At depth 2
               siblings may sit between, so the indent no longer says WHO. -->
          <span
            v-if="props.node.comment.depth === 2 && props.node.replyingTo"
            class="comment__replying"
            >{{
              t('community.hint.replyingTo', { name: props.node.replyingTo.displayName })
            }}</span
          >
          <Drill link-class="comment__author" :to="self">{{
            props.node.author.displayName
          }}</Drill>
          <p class="comment__body">{{ t(props.node.comment.bodyKey) }}</p>
        </div>

        <div class="comment__foot">
          <When :at="props.node.comment.postedAt" />
          <button
            type="button"
            class="comment__act"
            :data-on="mine ? '' : undefined"
            :aria-pressed="mine !== null"
            @click="setCommentReaction(props.node.comment, mine ? null : 'like')"
          >
            {{ t('community.reaction.like') }}
          </button>
          <span v-if="summary.total > 0" class="comment__likes">
            <span class="material-symbols-outlined" aria-hidden="true">thumb_up</span>
            <Count :value="summary.total" />
            <span class="visually-hidden">{{ t('community.count.reactions') }}</span>
          </span>
        </div>
      </div>
    </div>

    <div v-if="props.node.children.length > 0" class="thread__children">
      <ThreadBranch v-for="child in shown" :key="child.comment.id" :node="child" />
      <button v-if="expanded" type="button" class="thread__toggle" @click="expanded = false">
        {{ t('community.action.hideReplies') }}
      </button>
      <button
        v-else-if="hiddenCount > 0"
        type="button"
        class="thread__toggle"
        @click="expanded = true"
      >
        {{
          hiddenCount === 1
            ? t('community.action.viewRepliesOne')
            : t('community.action.viewReplies', { count: t.formatNumber(hiddenCount) })
        }}
      </button>
    </div>
  </div>
</template>
