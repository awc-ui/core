<!--
  The row under a post: like, comment, share, save.

  THE HEART IS THE ONLY COLOURED CONTROL, and only when it is on. Four coloured
  icons is four things shouting; one is a state.

  Every button carries a real accessible name saying what pressing it will DO —
  "Like" when off, "Unlike" when on — rather than naming the icon. The counts
  are beside them as text, not inside the names, because a screen reader
  reading "Like, 1,240" on every post in a feed is noise.
-->
<script setup lang="ts">
import { useT } from '~/composables/useShowcase';

const props = defineProps<{ liked: boolean; saved: boolean }>();
const emit = defineEmits<{ like: []; save: []; comment: []; share: [] }>();
const t = useT();

const likeListeners = { mdClick: () => emit('like') };
const commentListeners = { mdClick: () => emit('comment') };
const shareListeners = { mdClick: () => emit('share') };
const saveListeners = { mdClick: () => emit('save') };
</script>

<template>
  <div class="post-actions">
    <md-icon-button
      v-awc="{ on: likeListeners }"
      class="post-actions__like"
      :icon="props.liked ? 'favorite' : 'favorite_border'"
      :color="props.liked ? 'error' : undefined"
      :data-on="props.liked ? '' : undefined"
      :aria-label="t(props.liked ? 'social.action.unlike' : 'social.action.like')"
    ></md-icon-button>
    <md-icon-button
      v-awc="{ on: commentListeners }"
      icon="mode_comment"
      :aria-label="t('social.action.comment')"
    ></md-icon-button>
    <md-icon-button
      v-awc="{ on: shareListeners }"
      icon="send"
      :aria-label="t('social.action.share')"
    ></md-icon-button>
    <span class="post-actions__spacer"></span>
    <md-icon-button
      v-awc="{ on: saveListeners }"
      :icon="props.saved ? 'bookmark' : 'bookmark_border'"
      :data-on="props.saved ? '' : undefined"
      :aria-label="t(props.saved ? 'social.action.unsave' : 'social.action.save')"
    ></md-icon-button>
  </div>
</template>
