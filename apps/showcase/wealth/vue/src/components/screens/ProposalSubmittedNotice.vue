<!--
  What the builder panel shows once the proposal is sent: a success chip, the
  document's own title, and the restart action that re-keys the whole form.

  `mdClick`, not a native click: the library's buttons route soft-disabled
  presses through `mdClick`'s cancelable path, so md-events are the house rule
  for every md-button in this vertical.
-->
<script setup lang="ts">
import { useCopy } from './proposal-copy';

defineProps<{ title: string }>();

const emit = defineEmits<{ (e: 'restart'): void }>();

const c = useCopy();

const restartListeners = {
  mdClick() {
    emit('restart');
  },
};
</script>

<template>
  <div class="stack">
    <div class="row">
      <md-chip
        variant="assist"
        appearance="filled"
        color="success"
        icon="check"
        :label="c('wealth.proposal.builder.done')"
      ></md-chip>
      <span class="strong">{{ title }}</span>
    </div>
    <p class="muted">{{ c('wealth.proposal.builder.doneHint') }}</p>
    <div class="row row--end">
      <md-button v-awc="{ on: restartListeners }" variant="tonal" icon="note_add">
        {{ c('wealth.proposal.builder.restart') }}
      </md-button>
    </div>
  </div>
</template>
