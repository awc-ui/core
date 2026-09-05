<!--
  The aggregate: up to three overlapping glyphs and a total.

  IT RENDERS NOTHING AT ZERO rather than "0 reactions". A post nobody has
  reacted to should look like a post nobody has reacted to, not like a post with
  a counter stuck at zero.
-->
<script setup lang="ts">
import { reactionIcon, type ReactionSummary } from '@awc-ui/showcase-kit/community';
import { useT } from '~/composables/useShowcase';

const props = defineProps<{
  summary: ReactionSummary;
  commentCount: number;
  shareCount: number;
}>();
const emit = defineEmits<{ (e: 'openComments'): void }>();
const t = useT();
</script>

<template>
  <div
    v-if="props.summary.total > 0 || props.commentCount > 0 || props.shareCount > 0"
    class="reactions"
  >
    <template v-if="props.summary.total > 0">
      <span class="reactions__glyphs" aria-hidden="true">
        <span v-for="kind in props.summary.top" :key="kind" class="reactions__glyph">
          <span class="material-symbols-outlined">{{ reactionIcon[kind] }}</span>
        </span>
      </span>
      <!-- The number is announced with its unit; the glyphs above are
           decoration and are hidden from the accessibility tree. -->
      <span class="reactions__count">{{
        t('community.reaction.summary', { count: t.formatNumber(props.summary.total) })
      }}</span>
    </template>
    <span class="reactions__spacer" />
    <button
      v-if="props.commentCount > 0"
      type="button"
      class="reactions__count comment__act"
      @click="emit('openComments')"
    >
      {{ t('community.action.viewComments', { count: t.formatNumber(props.commentCount) }) }}
    </button>
    <span v-if="props.shareCount > 0" class="reactions__count">
      {{ t.formatNumber(props.shareCount) }}
      {{ t('community.count.shares').toLocaleLowerCase(t.locale) }}
    </span>
  </div>
</template>
