<!--
  The body, clamped to four lines with a "see more".

  `LONG_BODY` only decides whether to RENDER the control — the clamp itself is
  CSS, four lines of whatever this column happens to hold. It has to be an
  estimate because the real answer depends on width, font and language, and it
  is deliberately generous: a button on a post that turns out not to be clipped
  is a small oddity; one missing from a post that IS clipped hides the end of
  somebody's writing.
-->
<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Post } from '@awc-ui/showcase-kit/community';
import { useT } from '~/composables/useShowcase';

const LONG_BODY = 180;

const props = defineProps<{ post: Post }>();
const t = useT();
const expanded = ref(false);

/* `t.value(...)` in script, plain `t(...)` in template — Vue unwraps a ref
   in a template and does not in a setup block. */
const text = computed(() => t.value(props.post.bodyKey));
const long = computed(() => text.value.length > LONG_BODY);
</script>

<template>
  <!-- `data-clamped` and not a class: the clamp is a STATE of this paragraph,
       and app.css keys the four-line clamp off exactly that. -->
  <p class="post-card__body" :data-clamped="long && !expanded ? '' : undefined">{{ text }}</p>
  <button v-if="long" type="button" class="post-card__more" @click="expanded = !expanded">
    {{ t(expanded ? 'community.action.seeLess' : 'community.action.seeMore') }}
  </button>
</template>
