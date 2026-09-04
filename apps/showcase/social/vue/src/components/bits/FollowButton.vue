<!--
  The follow button, in whichever of its four states applies.

  `toggle` emits the state the caller should move TO. The button holds none of
  its own: the screen owns the override, so a reload is a reset.
-->
<script setup lang="ts">
import { computed } from 'vue';
import { followAction, type Person } from '@awc-ui/showcase-kit/social';
import { useT } from '~/composables/useShowcase';

const props = withDefaults(
  defineProps<{ person: Person; following: boolean; size?: 'sm' | 'md' }>(),
  { size: 'sm' },
);
const emit = defineEmits<{ toggle: [next: boolean] }>();
const t = useT();

/* The kit's table answers for the FIXTURE's relationship; a viewer who has
   since pressed the button is either following or not, and those are the only
   two states reachable after an override. */
const action = computed(() => {
  const knownBoth = props.person.relationship === 'follower' || props.person.relationship === 'mutual';
  return props.following
    ? followAction[knownBoth ? 'mutual' : 'following']
    : followAction[knownBoth ? 'follower' : 'none'];
});

const listeners = { mdClick: () => emit('toggle', !props.following) };
</script>

<template>
  <md-button
    v-if="action"
    v-awc="{ on: listeners }"
    :variant="action.variant"
    :size="size"
    :icon="action.icon ?? undefined"
  >
    {{ t(action.labelKey) }}
  </md-button>
</template>
