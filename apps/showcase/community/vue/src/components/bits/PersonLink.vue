<!--
  A person's name, linking to their profile.

  THE VIEWER'S OWN NAME LINKS TO `/profile/`, not to `/people/<handle>/`. Both
  resolve, and the second would be a second URL for the same page — which is how
  a "you" state ends up on a screen that has decided it is looking at someone
  else.
-->
<script setup lang="ts">
import { computed } from 'vue';
import type { Person } from '@awc-ui/showcase-kit/community';
import Drill from '~/components/Drill.vue';
import { route } from '~/lib/routes';

const props = withDefaults(defineProps<{ person: Person; className?: string }>(), {
  className: 'person-row__name',
});

const href = computed(() =>
  props.person.friendship === 'self' ? route.profile() : route.person(props.person.handle),
);
</script>

<template>
  <Drill :link-class="props.className" :to="href">
    <slot>{{ props.person.displayName }}</slot>
  </Drill>
</template>
