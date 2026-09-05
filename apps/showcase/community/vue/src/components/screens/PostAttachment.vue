<!--
  Photos, a link card or a shared post — whichever this kind carries.

  ONE COMPONENT AND NOT THREE BRANCHES AT THE CALL SITE, because a shared post
  renders its own attachment too and would otherwise need the same three
  branches written a second time.

  IT RECURSES, and Vue needs the component to be named for that to resolve —
  `<script setup>` infers the name from the FILE, so `<PostAttachment>` inside
  this template finds itself. The recursion is bounded by the fixture: a share
  can never contain a share, and the generator asserts it.
-->
<script setup lang="ts">
import type { FeedItem } from '@awc-ui/showcase-kit/community';
import Drill from '~/components/Drill.vue';
import Media from '~/components/bits/Media.vue';
import Byline from './Byline.vue';
import PostBody from './PostBody.vue';
import { route } from '~/lib/routes';
import { useT } from '~/composables/useShowcase';

const props = withDefaults(defineProps<{ item: FeedItem; nested?: boolean }>(), { nested: false });
const t = useT();

/** The inner post, shaped as a feed item so the same components render it. */
const inner = (): FeedItem | null =>
  props.item.shared
    ? {
        post: props.item.shared.post,
        author: props.item.shared.author,
        group: props.item.shared.group,
        shared: null,
        preview: [],
        hiddenComments: 0,
      }
    : null;
</script>

<template>
  <div
    v-if="props.item.post.media.length > 0"
    class="post-photos"
    :data-count="String(props.item.post.media.length)"
  >
    <Drill
      v-for="(media, index) in props.item.post.media"
      :key="media.id"
      link-class="post-photos__cell"
      :to="route.post(props.item.post.id)"
      :aria-label="t(media.altKey)"
    >
      <Media :media="media" :eager="!props.nested && index === 0" />
    </Drill>
  </div>

  <!-- NOT AN ANCHOR — see `LinkPreview` in the kit. Nothing here navigates off
       the app, so a live href would put a real outbound request behind a
       fictional article; and a non-anchor can sit inside the post's own link
       target without nesting one anchor in another. -->
  <md-tooltip v-else-if="props.item.post.link" :text="t('community.hint.linkNotReal')">
    <div class="link-card">
      <Media :media="props.item.post.link.image" class-name="link-card__image" />
      <div class="link-card__text">
        <span class="link-card__domain">{{ props.item.post.link.domain }}</span>
        <p class="link-card__title">{{ t(props.item.post.link.titleKey) }}</p>
        <p class="link-card__about">{{ t(props.item.post.link.descriptionKey) }}</p>
      </div>
    </div>
  </md-tooltip>

  <!-- The inner post is rendered whole, byline and attachment and all, but
       NEVER its actions or comments: those belong to the original, and pressing
       them here would react to a post the reader is not looking at. -->
  <div v-else-if="inner()" class="shared-post">
    <Byline :item="inner()!" compact />
    <PostBody :post="inner()!.post" />
    <PostAttachment :item="inner()!" nested />
  </div>
</template>
