<!-- An RSVP state. `none` and `declined` earn no chip. -->
<script setup lang="ts">
import { rsvpIcon, rsvpTone, type Rsvp } from '@awc-ui/showcase-kit/community';
import StateChip from './StateChip.vue';

const props = defineProps<{ rsvp: Rsvp }>();
</script>

<template>
  <StateChip
    v-if="rsvpTone[props.rsvp]"
    :label-key="`community.rsvp.${props.rsvp}`"
    :color="rsvpTone[props.rsvp] ?? undefined"
    :icon="rsvpIcon[props.rsvp]"
  />
</template>
