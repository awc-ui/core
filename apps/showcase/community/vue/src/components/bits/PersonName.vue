<!--
  A person's name and tick — WITH NO ANCHOR.

  Two callers are already links themselves. Putting `PersonLink` inside one
  produced an `<a>` inside an `<a>`: invalid HTML that the DOM API builds
  happily rather than unnesting the way a parser would, so nothing complains and
  a screen reader gets two overlapping links for one name.
-->
<script setup lang="ts">
import type { Person } from '@awc-ui/showcase-kit/community';
import Verified from './Verified.vue';

const props = defineProps<{ person: Person }>();
</script>

<template>
  <span class="person-row__name">{{ props.person.displayName }}</span>
  <Verified :person="props.person" />
</template>
