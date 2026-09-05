<!-- A column of post cards, resolved. `resolve()` in the kit is the same join
     `feedItems()` does, exposed for exactly this. -->
<script setup lang="ts">
import { resolve, type Post } from '@awc-ui/showcase-kit/community';
import PostCard from './PostCard.vue';

const props = defineProps<{ posts: Post[] }>();
const emit = defineEmits<{
  (e: 'message', key: string | null, params?: Record<string, string | number>): void;
}>();
</script>

<template>
  <PostCard
    v-for="post in props.posts"
    :key="post.id"
    :item="resolve(post)"
    @message="(k, p) => emit('message', k, p)"
  />
</template>
