<script setup lang="ts">
import { computed } from 'vue';
import type { OrgNode } from '~/lib/types';

const props = defineProps<{ nodes: OrgNode[] }>();

const objectProps = computed(() => ({ nodes: props.nodes }));
</script>

<template>
  <md-organization-chart v-awc="{ props: objectProps }"></md-organization-chart>
</template>
