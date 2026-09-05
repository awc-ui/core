<script setup lang="ts">
import type { Person } from '@awc-ui/showcase-kit/community';
import { useT } from '~/composables/useShowcase';

const props = defineProps<{ person: Person }>();
const t = useT();
</script>

<template>
  <md-tooltip v-if="props.person.verified" :text="t('community.verified')">
    <span class="verified material-symbols-outlined" role="img" :aria-label="t('community.verified')"
      >verified</span
    >
  </md-tooltip>
</template>
