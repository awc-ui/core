<!-- The glyph beside a timestamp saying who can see a post. Genuinely
     informative here: a network with friends-only posts has to say which ones
     they are, or the reader cannot tell what they are replying in front of. -->
<script setup lang="ts">
import { audienceIcon, type Audience } from '@awc-ui/showcase-kit/community';
import { useT } from '~/composables/useShowcase';

const props = defineProps<{ audience: Audience; labelKey: string }>();
const t = useT();
</script>

<template>
  <md-tooltip :text="t(props.labelKey)">
    <span class="material-symbols-outlined" role="img" :aria-label="t(props.labelKey)">{{
      audienceIcon[props.audience]
    }}</span>
  </md-tooltip>
</template>
