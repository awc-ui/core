<!--
  A person's name, tick and optional handle — WITH NO ANCHOR.

  This exists because two callers are already links themselves. A post card's
  header wraps the avatar AND the name in one target, and putting `PersonLink`
  inside it produces an `<a>` inside an `<a>`: invalid HTML that a framework
  builds happily and a screen reader reads as two overlapping links.

  So the presentation is here and the link is `PersonLink`, which is just this
  in an anchor. A caller uses whichever it is not already inside.
-->
<script setup lang="ts">
import type { Person } from '@awc-ui/showcase-kit/social';
import Verified from './Verified.vue';

defineProps<{ person: Person; showHandle?: boolean }>();
</script>

<template>
  <span class="person-link__name">{{ person.displayName }}</span>
  <Verified :person="person" />
  <span v-if="showHandle" class="person-link__handle">@{{ person.handle }}</span>
</template>
