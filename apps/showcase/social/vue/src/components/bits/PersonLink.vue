<!--
  A person's name and handle, linking to their profile.

  THE VIEWER'S OWN NAME LINKS TO `/profile/`, not to `/people/<their handle>/`.
  Both would render, and the second would be a second URL for the same page —
  which is how a "you" state appears on a screen that has already decided it is
  looking at someone else.
-->
<script setup lang="ts">
import { computed } from 'vue';
import type { Person } from '@awc-ui/showcase-kit/social';
import { route } from '~/lib/routes';
import Drill from '~/components/Drill.vue';
import PersonName from './PersonName.vue';

const props = defineProps<{ person: Person; showHandle?: boolean }>();
const href = computed(() =>
  props.person.relationship === 'self' ? route.profile() : route.person(props.person.handle),
);
</script>

<template>
  <Drill link-class="person-link" :to="href">
    <PersonName :person="person" :show-handle="showHandle" />
  </Drill>
</template>
