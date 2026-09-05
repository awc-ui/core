<script setup lang="ts">
import type { ProfileSummary } from '@awc-ui/showcase-kit/community';
import Panel from '~/components/Panel.vue';
import Drill from '~/components/Drill.vue';
import DateText from '~/components/bits/DateText.vue';
import { route } from '~/lib/routes';
import { useT } from '~/composables/useShowcase';

const props = defineProps<{ summary: ProfileSummary }>();
const t = useT();
</script>

<template>
  <Panel :title="t('community.panel.about')">
    <div class="profile-facts">
      <p class="profile-fact">{{ t(props.summary.person.bioKey) }}</p>
      <!-- THE GLYPH AND THE TEXT ARE ADJACENT, with no newline between them.

           Vue's `whitespace: 'condense'` removes a whitespace-only node between
           two ELEMENTS but collapses one between an element and an
           INTERPOLATION to a single space — so a glyph on its own line put
           "work Gardener" where React, whose JSX strips that whitespace
           entirely, has "workGardener". The space is invisible because the
           glyph is an icon, and it is exactly the kind of one-character drift
           the parity check exists to catch.

           This is the mirror of the trap Lyra hit, where the same rule DELETED
           a space that was wanted. Both are fixed the same way: say what you
           mean in the markup rather than relying on how the compiler treats the
           gap. -->
      <p v-if="props.summary.person.workKey" class="profile-fact">
        <span class="material-symbols-outlined" aria-hidden="true">work</span
        >{{ t(props.summary.person.workKey) }}
      </p>
      <p v-if="props.summary.person.locationKey" class="profile-fact">
        <span class="material-symbols-outlined" aria-hidden="true">place</span
        >{{ t(props.summary.person.locationKey) }}
      </p>
      <p class="profile-fact">
        <span class="material-symbols-outlined" aria-hidden="true">schedule</span
        >{{ t('community.hint.joinedCorvus', { date: '' })
        }}<DateText :at="props.summary.person.joinedAt" format="long" />
      </p>
    </div>

    <template v-if="props.summary.sharedGroups.length > 0">
      <p class="muted">{{ t('community.panel.sharedGroups') }}</p>
      <div class="row">
        <Drill
          v-for="group in props.summary.sharedGroups"
          :key="group.id"
          link-class="post-card__group"
          :to="route.group(group.slug)"
          >{{ group.name }}</Drill
        >
      </div>
    </template>
  </Panel>
</template>
