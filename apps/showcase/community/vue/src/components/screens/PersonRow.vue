<!-- Name, mutuals and whatever control the section puts beside them. -->
<script setup lang="ts">
import type { Person } from '@awc-ui/showcase-kit/community';
import Avatar from '~/components/bits/Avatar.vue';
import PersonLink from '~/components/bits/PersonLink.vue';
import { useT } from '~/composables/useShowcase';

const props = defineProps<{ person: Person }>();
const t = useT();
</script>

<template>
  <div class="person-row" :data-person="props.person.id">
    <PersonLink :person="props.person" class-name="">
      <Avatar :person="props.person" size="medium" />
    </PersonLink>
    <span class="person-row__text">
      <PersonLink :person="props.person" />
      <span class="person-row__meta">{{
        props.person.mutualCount === 1
          ? t('community.count.mutualOne')
          : t('community.count.mutual', { count: t.formatNumber(props.person.mutualCount) })
      }}</span>
      <slot />
    </span>
  </div>
</template>
