<script setup lang="ts">
import type { Person } from '@awc-ui/showcase-kit/community';
import { useT } from '~/composables/useShowcase';

const props = withDefaults(
  defineProps<{ person: Person; size?: 'small' | 'medium' | 'large'; className?: string }>(),
  { size: 'small' },
);
const t = useT();
</script>

<template>
  <md-avatar
    :class="props.className"
    :src="props.person.avatar"
    :name="props.person.displayName"
    :initials="props.person.initials"
    :size="props.size"
    :label="props.person.displayName"
    :alt="t('community.alt.arcs')"
  />
</template>
