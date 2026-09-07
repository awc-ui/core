<script setup lang="ts">
const t = useT();
import { useT } from "~/composables/useShowcase";

import { ref, watch, computed } from "vue";
const props = defineProps<{
  value: string;
  onValue: (value: string) => void;
}>();
const change = (event: CustomEvent) => props.onValue(event.detail.value);
</script>
<template>
  <md-color-picker
    :locale="t.locale"
    v-awc="{ props: { value, showHex: true }, on: { mdChange: change } }"
    variant="popup"
    :aria-label="t('Custom fill color')"
    presets="#203D35,#BEE7AA,#F4F1E9,#F2AAA7,#392263,#C2BBF3"
  />
</template>
