<script setup lang="ts">
const t = useT();
import { useT } from "~/composables/useShowcase";

import { ref, watch, computed } from "vue";
const props = withDefaults(
  defineProps<{
    open: boolean;
    onClose: () => void;
    title: string;
    fullscreen?: boolean;
  }>(),
  { fullscreen: false },
);
const close = (event: CustomEvent) => {
  if (event.target === event.currentTarget) props.onClose();
};
</script>
<template>
  <md-dialog
    :locale="t.locale"
    v-if="open"
    class="studio-dialog"
    :headline="title"
    :close-label="t('Close dialog')"
    v-awc="{
      props: { open, fullscreen },
      on: { mdClose: close, mdCancel: close },
    }"
    ><div class="studio-dialog__content"><slot /></div>
    <div v-if="$slots.actions" slot="actions" class="studio-dialog__actions">
      <slot name="actions" /></div
  ></md-dialog>
</template>
