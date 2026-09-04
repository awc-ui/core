<!--
  The story rail, and the two buttons that move it.

  NO SCROLLBAR. A horizontal scrollbar under a row of ten circles is OS
  furniture in the middle of the page — thicker than the gap it lives in, styled
  by the platform, and on a trackpad it fades in and out as the pointer moves.
  It is hidden, and the two chevrons take over its job.

  THE SCROLLER IS STILL A REAL SCROLLER, which is the part that matters. Hiding
  the bar changes nothing about the element: trackpad, touch drag, shift-wheel
  and — the one people forget — TAB, which scrolls a focused ring into view on
  its own, all still work. Rebuilt as a transform carousel, every one of those
  would have had to be reimplemented and the keyboard one would have been
  forgotten.

  RTL IS A SIGN, NOT A SPECIAL CASE. `scrollLeft` runs negative in a
  right-to-left container, so "toward the end" is a different sign each way —
  but the DISTANCE from each end is `Math.abs(scrollLeft)` either way, so the
  two disabled states need no branch at all.
-->
<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import type { StoryRing } from '@awc-ui/showcase-kit/social';
import { useT } from '~/composables/useShowcase';
import Avatar from '~/components/bits/Avatar.vue';

defineProps<{ rings: StoryRing[] }>();
const t = useT();

/** How far one press moves the rail: a little under a viewport of it. */
const PAGE_FRACTION = 0.8;

const scroller = ref<HTMLDivElement | null>(null);
const atStart = ref(true);
const atEnd = ref(false);
let observer: ResizeObserver | null = null;

/* The 2px slack is not superstition: a scroller whose content is a fractional
   number of pixels wide never reports `scrollLeft + clientWidth === scrollWidth`
   exactly, so an exact comparison leaves the forward button live at the end
   forever. */
function measure() {
  const el = scroller.value;
  if (!el) return;
  const offset = Math.abs(el.scrollLeft);
  atStart.value = offset < 2;
  atEnd.value = offset + el.clientWidth >= el.scrollWidth - 2;
}

onMounted(() => {
  const el = scroller.value;
  if (!el) return;
  measure();
  el.addEventListener('scroll', measure, { passive: true });
  /* Observing the ELEMENT, not the window: the rail also narrows when the
     suggestions panel appears beside it, which a window listener would miss. */
  observer = new ResizeObserver(measure);
  observer.observe(el);
});

onBeforeUnmount(() => {
  scroller.value?.removeEventListener('scroll', measure);
  observer?.disconnect();
  observer = null;
});

function page(towardEnd: boolean) {
  const el = scroller.value;
  if (!el) return;
  const rtl = getComputedStyle(el).direction === 'rtl';
  /* The only place direction is consulted: which way "the end" is. */
  const sign = towardEnd === rtl ? -1 : 1;
  el.scrollBy({ left: el.clientWidth * PAGE_FRACTION * sign, behavior: 'smooth' });
}

const prev = { mdClick: () => page(false) };
const next = { mdClick: () => page(true) };
</script>

<template>
  <section class="story-rail" :aria-label="t('social.panel.stories')">
    <md-icon-button
      v-awc="{ on: prev }"
      class="story-rail__nav story-rail__nav--prev"
      icon="chevron_left"
      :aria-label="t('social.action.previous')"
      :soft-disabled="atStart || undefined"
    ></md-icon-button>

    <div ref="scroller" class="story-rail__scroller">
      <div v-for="ring in rings" :key="ring.person.id" class="story">
        <Avatar :person="ring.person" size="medium" :ring="!ring.self" />
        <span class="story__name">
          {{ ring.self ? t('social.hint.yourStory') : ring.person.handle }}
        </span>
      </div>
    </div>

    <md-icon-button
      v-awc="{ on: next }"
      class="story-rail__nav story-rail__nav--next"
      icon="chevron_right"
      :aria-label="t('social.action.next')"
      :soft-disabled="atEnd || undefined"
    ></md-icon-button>
  </section>
</template>
