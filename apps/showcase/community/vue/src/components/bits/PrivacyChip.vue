<!-- A group's privacy. Always shown — it changes what a non-member can see. -->
<script setup lang="ts">
import { privacyIcon, privacyTone, type Group } from '@awc-ui/showcase-kit/community';
import StateChip from './StateChip.vue';

const props = defineProps<{ group: Group }>();
</script>

<template>
  <StateChip
    :label-key="props.group.privacyKey"
    :color="privacyTone[props.group.privacy]"
    :icon="privacyIcon[props.group.privacy]"
  />
</template>
