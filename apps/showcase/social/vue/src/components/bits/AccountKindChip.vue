<!-- The account-type chip. `personal` earns none — see the kit's tone map. -->
<script setup lang="ts">
import { accountKindTone, type Person } from '@awc-ui/showcase-kit/social';
import StateChip from './StateChip.vue';

defineProps<{ person: Person }>();
</script>

<template>
  <StateChip
    v-if="accountKindTone[person.kind]"
    :label-key="person.kindKey"
    :color="accountKindTone[person.kind]!"
  />
</template>
