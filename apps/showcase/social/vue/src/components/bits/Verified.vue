<!-- The tick, with a name a screen reader can read. -->
<script setup lang="ts">
import type { Person } from '@awc-ui/showcase-kit/social';
import { useT } from '~/composables/useShowcase';

defineProps<{ person: Person }>();
const t = useT();
</script>

<template>
  <md-tooltip v-if="person.verified" :text="t('social.verified')">
    <span class="verified material-symbols-outlined" role="img" :aria-label="t('social.verified')">
      verified
    </span>
  </md-tooltip>
</template>
