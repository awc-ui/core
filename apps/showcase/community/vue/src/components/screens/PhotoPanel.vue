<!-- Three across, square-cropped: the one place this app throws away an aspect
     ratio it is otherwise careful about, because a grid whose cells were 1:1,
     4:5 and 16:9 is not a grid. -->
<script setup lang="ts">
import type { ProfileSummary } from '@awc-ui/showcase-kit/community';
import Panel from '~/components/Panel.vue';
import Drill from '~/components/Drill.vue';
import Count from '~/components/bits/Count.vue';
import Media from '~/components/bits/Media.vue';
import { route } from '~/lib/routes';
import { useT } from '~/composables/useShowcase';

const props = defineProps<{ summary: ProfileSummary }>();
const t = useT();
</script>

<template>
  <Panel v-if="props.summary.photos.length > 0" :title="t('community.panel.photos')">
    <template #actions><Count :value="props.summary.photos.length" /></template>
    <div class="photo-grid">
      <Drill
        v-for="photo in props.summary.photos"
        :key="photo.media.id"
        link-class="photo-grid__cell"
        :to="route.post(photo.postId)"
        :aria-label="t(photo.media.altKey)"
      >
        <Media :media="photo.media" />
      </Drill>
    </div>
  </Panel>
</template>
