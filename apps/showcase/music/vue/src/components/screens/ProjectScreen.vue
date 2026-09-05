<!--
  A project drill. It delegates to `StudioScreen` with a slug rather than
  reimplementing the arrangement: the only difference between "the studio" and
  "this project" is which project is open, and two copies of the timeline would
  be two places to fix the next thing found in it.
-->
<script setup lang="ts">
import { computed } from 'vue';
import { projectBySlug } from '@awc-ui/showcase-kit/music';
import StudioScreen from '~/components/screens/StudioScreen.vue';
import NotFoundScreen from '~/components/screens/NotFoundScreen.vue';

const props = defineProps<{ slug: string }>();
/* The screen guards its own parameter: it came from a URL, so it is not
   trusted until the fixture confirms it. */
const project = computed(() => projectBySlug(props.slug));
</script>

<template>
  <NotFoundScreen v-if="!project" />
  <StudioScreen v-else :slug="slug" />
</template>
