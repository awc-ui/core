<!--
  A lane's name, renameable in place.

  A DOUBLE-CLICK OPENS IT, and so does Enter — the discoverable gesture and the
  keyboard one, because a rename reachable only by double-click is one most
  people never find and some cannot perform at all.
-->
<script setup lang="ts">
import { nextTick, ref } from 'vue';
import { trackIcon, type StudioTrack } from '@awc-ui/showcase-kit/music';
import { useT } from '~/composables/useShowcase';
import { usePlayer } from '~/composables/usePlayer';

const props = defineProps<{ track: StudioTrack }>();
const emit = defineEmits<{
  (e: 'message', key: string, params?: Record<string, string | number>): void;
}>();

const t = useT();
const player = usePlayer();
const editing = ref(false);
const draft = ref(props.track.name);
const field = ref<HTMLInputElement | null>(null);

async function open() {
  draft.value = props.track.name;
  editing.value = true;
  await nextTick();
  field.value?.focus();
}

function commit() {
  editing.value = false;
  if (draft.value.trim() !== '' && draft.value !== props.track.name) {
    player.renameTrack(props.track.id, draft.value.trim());
    emit('message', 'music.msg.trackRenamed', { name: draft.value.trim() });
  }
}
</script>

<template>
  <div v-if="editing" class="lane-name">
    <input
      ref="field"
      v-model="draft"
      class="lane-name__input"
      :aria-label="`${t('music.edit.trackRename')}: ${track.name}`"
      @blur="commit()"
      @keydown.enter="commit()"
      @keydown.esc="
        draft = track.name;
        editing = false;
      "
    />
  </div>
  <div
    v-else
    class="lane-name"
    role="button"
    :tabindex="0"
    :data-track="track.id"
    :aria-label="`${t('music.edit.trackRename')}: ${track.name}`"
    @dblclick="open()"
    @keydown.enter="open()"
  >
    <span class="material-symbols-outlined" aria-hidden="true">{{ trackIcon[track.kind] }}</span>
    <span class="lane-name__text">{{ track.name }}</span>
  </div>
</template>
