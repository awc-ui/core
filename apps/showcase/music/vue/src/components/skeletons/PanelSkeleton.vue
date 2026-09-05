<!--
  The card a panel is, without the card.

  The skeletons cannot use `md-card`: it is a lazily-hydrated custom element
  exactly like the content it stands in for. But a bare div has no border, no
  radius and no surface — `.skel-panel` carries an outlined card's box, and it
  pads by 16 because `md-card` pads its own host by 16 ON TOP of
  `.panel__inner`'s 16. Both are needed, or the placeholder is 32px shorter than
  the panel it covers, per panel.

  `head` is not decoration: `Panel` renders no head when it has no title, and a
  placeholder that draws one anyway is another 32px too tall.
-->
<script setup lang="ts">
import SkeletonLine from './SkeletonLine.vue';

withDefaults(defineProps<{ head?: boolean }>(), { head: true });
</script>

<template>
  <div class="skel-panel">
    <div class="panel__inner">
      <div v-if="head" class="panel__head">
        <SkeletonLine w="180px" :h="20" />
        <SkeletonLine w="24px" :h="20" />
      </div>
      <slot />
    </div>
  </div>
</template>
