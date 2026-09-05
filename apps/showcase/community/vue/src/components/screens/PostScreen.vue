<!-- One post and its whole thread. The SAME CARD as the feed with
     `showComments` on: a post is a post, and the only thing the drill adds is
     that the conversation is open rather than previewed. -->
<script setup lang="ts">
import { computed } from 'vue';
import { getPersonById, getPostById, resolve } from '@awc-ui/showcase-kit/community';
import Screen from '~/components/Screen.vue';
import PostSkeleton from '~/components/skeletons/PostSkeleton.vue';
import PostCard from './PostCard.vue';
import RightRail from './RightRail.vue';
import NotFoundScreen from './NotFoundScreen.vue';
import SnackbarHost from './SnackbarHost.vue';
import { useSnackbar } from './useSnackbar';
import { useT } from '~/composables/useShowcase';

const props = defineProps<{ postId: string }>();
const t = useT();
const { message, say, close } = useSnackbar();

const post = computed(() => getPostById(props.postId));
const author = computed(() => (post.value ? getPersonById(post.value.authorId) : undefined));
</script>

<template>
  <NotFoundScreen v-if="!post || !author" />
  <Screen
    v-else
    :title="t('community.screen.post.title')"
    :subtitle="t('community.screen.post.subtitle', { name: author.displayName })"
  >
    <template #skeleton><PostSkeleton /></template>

    <div class="columns">
      <div class="columns__main">
        <PostCard :item="resolve(post)" show-comments @message="say" />
      </div>
      <aside class="columns__rail"><RightRail /></aside>
    </div>

    <SnackbarHost :message="message" @close="close" />
  </Screen>
</template>
