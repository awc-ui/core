<!--
  A square grid of posts, three across.

  PINNED POSTS LEAD, and they say so with a badge — otherwise a grid ordered by
  anything but date looks like a grid that has lost its order. The ordering
  itself is `getPersonPosts()` in the kit, so all five builds pin the same two.
-->
<script setup lang="ts">
import { postKindIcon, type Post } from '@awc-ui/showcase-kit/social';
import { route } from '~/lib/routes';
import { useT } from '~/composables/useShowcase';
import Drill from '~/components/Drill.vue';
import Media from '~/components/bits/Media.vue';

defineProps<{ posts: Post[] }>();
const t = useT();
</script>

<template>
  <slot v-if="posts.length === 0" name="empty" />
  <ul v-else class="post-grid">
    <li v-for="post in posts" :key="post.id" class="post-grid__cell">
      <Drill
        link-class="post-grid__link"
        :to="route.post(post.id)"
        :aria-label="t(post.media[0].altKey)"
      >
        <Media :media="post.media[0]" class-name="post-grid__img" />
        <span v-if="post.pinned" class="post-grid__pin on-media">
          <span class="material-symbols-outlined" aria-hidden="true">push_pin</span>
          {{ t('social.hint.gridSpan') }}
        </span>
        <span
          v-if="postKindIcon[post.kind]"
          class="post-grid__badge on-media material-symbols-outlined"
          aria-hidden="true"
        >{{ postKindIcon[post.kind] }}</span>
      </Drill>
    </li>
  </ul>
</template>
