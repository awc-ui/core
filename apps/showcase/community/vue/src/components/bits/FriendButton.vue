<!--
  The friendship button, in whichever of its five states applies.

  THE TWO PENDING STATES ARE THE REASON THIS IS NOT A TOGGLE. Somebody who asked
  you and somebody you asked are the same relationship from opposite ends, and
  they need opposite verbs — which is why `friendAction` in the kit is a table
  rather than a ternary, and why `incoming` routes to a pair of Accept/Decline
  buttons rather than to this one.
-->
<script setup lang="ts">
import { computed } from 'vue';
import { friendAction, type Friendship, type Person } from '@awc-ui/showcase-kit/community';
import { useT } from '~/composables/useShowcase';

const props = withDefaults(
  defineProps<{ person: Person; state: Friendship; size?: 'sm' | 'md' }>(),
  { size: 'sm' },
);
const emit = defineEmits<{ (e: 'act', next: Friendship): void }>();
const t = useT();

const action = computed(() => friendAction[props.state]);

/* Where each press goes. `incoming` is handled by the screen's own two buttons,
   so pressing this one only ever opens that choice — it never silently
   accepts. */
const next = computed<Friendship>(() =>
  props.state === 'none'
    ? 'outgoing'
    : props.state === 'outgoing'
      ? 'none'
      : props.state === 'friend'
        ? 'none'
        : 'incoming',
);
</script>

<template>
  <md-button
    v-if="action"
    :variant="action.variant"
    :size="props.size"
    :icon="action.icon ?? undefined"
    :data-person="props.person.id"
    @click="emit('act', next)"
  >
    {{ t(action.labelKey) }}
  </md-button>
</template>
