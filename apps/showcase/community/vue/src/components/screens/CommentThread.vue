<!--
  A post's comments, two levels deep, with a collapse control on each run of
  replies and a box to add one.

  THE TREE COMES FROM THE KIT, not from a walk written here. `commentTree()`
  returns nodes with their children already attached, which is what puts the
  boundary of a reply-run in the DATA — and that boundary is exactly where the
  collapse control goes.
-->
<script setup lang="ts">
import { ref } from 'vue';
import { commentTree } from '@awc-ui/showcase-kit/community';
import { useT } from '~/composables/useShowcase';
import ThreadBranch from './ThreadBranch.vue';

const props = defineProps<{ postId: string }>();
const emit = defineEmits<{
  (e: 'message', key: string | null, params?: Record<string, string | number>): void;
}>();

const t = useT();
const added = ref<string[]>([]);
const draft = ref('');

/*
 * `mdInput` THROUGH THE `v-awc` DIRECTIVE, NOT `@input`.
 *
 * Vue's `@input` binds the NATIVE input event, and `md-text-field` reports
 * through a custom `mdInput` whose detail IS the bare string. The two never
 * meet: the draft stays empty, the Post button stays soft-disabled, and nothing
 * throws. The directive is this build's own answer to the same problem the
 * React port solves with a ref — it attaches to the element rather than to
 * Vue's synthetic layer, so a custom event reaches it.
 */
const draftListeners = {
  mdInput: (event: Event) => {
    draft.value = String((event as CustomEvent<string>).detail ?? '');
  },
};

function post() {
  if (draft.value.trim() === '') return;
  added.value = [...added.value, draft.value.trim()];
  draft.value = '';
  emit('message', 'community.msg.commentPosted');
}
</script>

<template>
  <div class="thread">
    <div v-if="commentTree(props.postId).length === 0 && added.length === 0" class="empty">
      <p>{{ t('community.empty.comments') }}</p>
      <p>{{ t('community.empty.commentsHint') }}</p>
    </div>
    <ThreadBranch
      v-for="node in commentTree(props.postId)"
      v-else
      :key="node.comment.id"
      :node="node"
    />

    <div v-for="(body, index) in added" :key="`added-${index}`" class="comment" data-mine="">
      <div>
        <div class="comment__bubble">
          <span class="comment__author">{{ t('community.common.you') }}</span>
          <p class="comment__body">{{ body }}</p>
        </div>
      </div>
    </div>

    <div class="comment-compose">
      <!-- OUTLINED and `auto-grow`: a filled field reserves 28px above the
           textarea for its label to float into and 8px below, which on a
           one-row box puts the label near the bottom of a 60px control under a
           strip of nothing. -->
      <md-text-field
        v-awc="{ on: draftListeners }"
        variant="outlined"
        :label="t('community.action.comment')"
        :value="draft"
        multiline="auto-grow"
        rows="1"
        full-width
      />
      <md-button
        variant="filled"
        icon="send"
        :soft-disabled="draft.trim() === '' || undefined"
        @click="post"
      >
        {{ t('community.action.post') }}
      </md-button>
    </div>
  </div>
</template>
