<!--
  An avatar, with the story ring when there is a story behind it.

  THE RING IS A CLASS, NOT A BORDER PROP. `md-avatar` has no ring of its own,
  and giving it one with a `style` attribute would be refused outright by the
  deployed Content-Security-Policy (`style-src-attr 'none'`). So the state goes
  on a wrapping span as a data attribute and `app.css` draws the ring, which
  also lets the unseen and seen rings differ by more than colour.
-->
<script setup lang="ts">
import { computed } from 'vue';
import type { Person } from '@awc-ui/showcase-kit/social';
import { useT } from '~/composables/useShowcase';

const props = withDefaults(
  defineProps<{ person: Person; size?: 'small' | 'medium' | 'large'; ring?: boolean }>(),
  { size: 'small', ring: false },
);
const t = useT();

const state = computed(() =>
  !props.ring ? 'none' : props.person.storyUnseen ? 'unseen' : props.person.hasStory ? 'seen' : 'none',
);
</script>

<template>
  <span class="avatar" :data-ring="state">
    <!-- `label` is the accessible name and `alt` the image's own. Both are set:
         the avatar usually sits inside a link whose text already names the
         person, but the picture is generated portrait artwork and naming it is
         convention 5 in the kit. -->
    <md-avatar
      :src="person.avatar"
      :name="person.displayName"
      :initials="person.initials"
      :size="size"
      :label="person.displayName"
      :alt="t('social.alt.arcs')"
    ></md-avatar>
    <span v-if="state !== 'none'" class="visually-hidden">
      {{ t(state === 'unseen' ? 'social.hint.storyUnseen' : 'social.hint.storySeen') }}
    </span>
  </span>
</template>
