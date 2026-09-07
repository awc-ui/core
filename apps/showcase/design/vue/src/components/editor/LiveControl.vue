<script setup lang="ts">
const t = useT();
import { useT } from "~/composables/useShowcase";

import { ref } from "vue";
import type { Layer } from "@awc-ui/showcase-kit/design";
const props = defineProps<{ layer: Layer; presentation: boolean }>();
const activated = ref(false);
const activate = () => {
  if (props.presentation) activated.value = !activated.value;
};
</script>
<template>
  <md-button
    v-if="layer.componentId === 'awc:button'"
    variant="filled"
    :icon="activated ? 'check' : 'arrow_forward'"
    @click="activate"
    >{{ activated ? t("You made it happen!") : layer.name }}</md-button
  >
  <md-text-field
    v-else-if="layer.componentId === 'awc:text-field'"
    variant="outlined"
    :label="layer.name"
    :placeholder="t('Try typing here…')"
  />
  <div v-else-if="layer.componentId === 'awc:switch'" class="live-switch">
    <span>{{ layer.name }}</span
    ><md-switch :aria-label="layer.name" icons />
  </div>
  <md-card v-else variant="filled"
    ><span class="live-card__eyebrow">{{ t("MADE OF POSSIBILITIES") }}</span
    ><strong>{{ layer.name }}</strong>
    <p>{{ t("A real component. Ready for your next idea.") }}</p>
    <md-button variant="tonal" @click="activate">{{
      activated ? t("Nice work!") : t("Explore more")
    }}</md-button></md-card
  >
</template>
