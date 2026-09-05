<!--
  One placeholder bar with a corner of its own.

  PLAIN DOM, NOT `md-skeleton` — the single most important thing about these
  placeholder components. `md-skeleton` is a lazily-hydrated custom element
  exactly like the content it stands in for, so a placeholder built from it
  catches the same disease it is there to treat: measured on the React source's
  holdings screen, an md-skeleton placeholder was 172px tall for three frames,
  228px for one more, and only then its real height. Divs have their size in the
  first paint, before a chunk has loaded — the only property a placeholder
  actually needs. (`md-skeleton` remains right for a placeholder INSIDE an
  already-hydrated screen.)

  A single `border-radius` for everything would be wrong in both directions:
  measured off the real holdings filter bar, `md-search` is a 9999px pill, an
  outlined text field is 4px, `md-chip` is 8px and `md-split-button` is 20px.

  `flex` is how a bar takes the SAME share of a `.row` its control does — the
  fields in that bar are laid out by `flex: 1 1 260px` and friends, and a
  placeholder that guessed a percentage instead would break at the first
  breakpoint.
-->
<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  /** A CSS length. The control's own corner, measured, not a guess. */
  radius: string;
  height: string;
  /** Omit to let the bar fill its box. */
  width?: string;
  flex?: string;
}>();

const style = computed(() => ({
  blockSize: props.height,
  inlineSize: props.width ?? (props.flex ? undefined : '100%'),
  borderRadius: props.radius,
  ...(props.flex ? { flex: props.flex } : null),
}));
</script>

<template>
  <div class="skel" :style="style"></div>
</template>
