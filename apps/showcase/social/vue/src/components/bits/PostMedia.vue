<!--
  A post's pictures: one image, or a pager over several.

  THE PAGER IS BUTTONS AND DOTS, not a swipe handler. A swipe is not reachable
  from a keyboard and this app is measured for that; the buttons are real
  controls with real names, and the dots are a live region announcing which of
  how many. On a touch screen the buttons grow to 48px under `pointer: coarse`.

  `href` PUTS THE ANCHOR AROUND THE IMAGE ONLY, and that is the whole reason it
  is a prop here rather than a wrapper at the call site. The feed card wrapped
  this component in a link, which put the two pager buttons inside an anchor —
  so paging to the next picture navigated to the post instead. A control inside
  a link is broken twice over: the click bubbles, and a keyboard press fires
  both.
-->
<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { postKindIcon, type Post } from '@awc-ui/showcase-kit/social';
import { useT } from '~/composables/useShowcase';
import Drill from '~/components/Drill.vue';
import Media from './Media.vue';

const props = withDefaults(
  defineProps<{ post: Post; eager?: boolean; href?: string }>(),
  { eager: false },
);
const t = useT();

const index = ref(0);
/* Reset when the post changes: a pager left on picture 4 of a post that has
   since been replaced by one with two pictures is the bug this avoids. Vue
   reuses the component instance where React would remount it on a new key. */
watch(() => props.post.id, () => { index.value = 0; });

const total = computed(() => props.post.media.length);
const media = computed(() => props.post.media[Math.min(index.value, total.value - 1)]);

const prev = { mdClick: () => { index.value = Math.max(0, index.value - 1); } };
const next = { mdClick: () => { index.value = Math.min(total.value - 1, index.value + 1); } };
</script>

<template>
  <div class="post-media">
    <Drill v-if="href" link-class="post-media__link" :to="href">
      <Media :media="media" :eager="eager" />
    </Drill>
    <Media v-else :media="media" :eager="eager" />

    <!-- `on-media` carries the contrast pair: anything sitting on a photograph
         needs a colour that does not depend on the theme behind it. -->
    <span
      v-if="post.kind === 'video' && media.durationSec !== null"
      class="post-media__duration on-media"
    >
      <span class="material-symbols-outlined" aria-hidden="true">{{ postKindIcon.video }}</span>
      {{ t('social.hint.videoDuration', { seconds: t.formatNumber(media.durationSec) }) }}
    </span>

    <template v-if="total > 1">
      <md-icon-button
        v-awc="{ on: prev }"
        class="post-media__nav post-media__nav--prev"
        icon="chevron_left"
        :aria-label="t('social.action.previous')"
        :soft-disabled="index === 0 || undefined"
      ></md-icon-button>
      <md-icon-button
        v-awc="{ on: next }"
        class="post-media__nav post-media__nav--next"
        icon="chevron_right"
        :aria-label="t('social.action.next')"
        :soft-disabled="index === total - 1 || undefined"
      ></md-icon-button>
      <div class="post-media__dots" role="status">
        <span class="visually-hidden">
          {{ t('social.postKind.carouselCount', { index: index + 1, total }) }}
        </span>
        <span
          v-for="(item, i) in post.media"
          :key="item.id"
          class="post-media__dot"
          :data-on="i === index ? '' : undefined"
        ></span>
      </div>
    </template>
  </div>
</template>
