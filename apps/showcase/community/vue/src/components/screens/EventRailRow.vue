<!--
  An event in a 300px rail.

  A SECOND PRESENTATION, NOT A NARROWER FIRST ONE. `EventRow` is a three-column
  grid sized for the 680px feed column; dropped into a 300px rail it had to
  divide that three ways and every word wrapped. A rail is REFERENCE material —
  it says what is coming up, and answering it is a decision that belongs on the
  event's own page, one press away. So this carries no controls at all.
-->
<script setup lang="ts">
import type { CommunityEvent } from '@awc-ui/showcase-kit/community';
import Drill from '~/components/Drill.vue';
import DateText from '~/components/bits/DateText.vue';
import { route } from '~/lib/routes';

const props = defineProps<{ event: CommunityEvent }>();
</script>

<template>
  <Drill link-class="rail-row" :to="route.event(props.event.slug)">
    <span class="material-symbols-outlined" aria-hidden="true">event</span>
    <span class="rail-row__text">
      <span class="rail-row__name">{{ props.event.name }}</span>
      <span class="rail-row__meta"><DateText :at="props.event.startsAt" /></span>
    </span>
  </Drill>
</template>
