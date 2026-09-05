<!-- The viewer's role in a group. `none` earns no chip — the join button
     already says they are not in it. See `roleTone` in the kit. -->
<script setup lang="ts">
import { roleIcon, roleTone, type GroupRole } from '@awc-ui/showcase-kit/community';
import StateChip from './StateChip.vue';

const props = defineProps<{ role: GroupRole }>();
</script>

<template>
  <StateChip
    v-if="roleTone[props.role]"
    :label-key="`community.role.${props.role}`"
    :color="roleTone[props.role] ?? undefined"
    :icon="roleIcon[props.role] ?? undefined"
  />
</template>
