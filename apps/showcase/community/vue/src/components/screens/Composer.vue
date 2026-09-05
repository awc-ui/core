<!--
  The inline composer at the top of the feed.

  IT IS A TRIGGER UNTIL IT IS PRESSED, which is the whole reason this vertical
  has no Create destination. A permanently-open textarea with an audience picker
  and three buttons costs 180px at the top of every visit to the feed, and the
  reader came for the feed.

  NOTHING IS EVER POSTED. The fixture is frozen; pressing Post raises a snackbar
  and collapses.
-->
<script setup lang="ts">
import { computed, ref } from 'vue';
import { AUDIENCES, audienceIcon, type Audience, type Person } from '@awc-ui/showcase-kit/community';
import Avatar from '~/components/bits/Avatar.vue';
import { useT } from '~/composables/useShowcase';

const props = defineProps<{ viewer: Person }>();
const emit = defineEmits<{
  (e: 'message', key: string | null, params?: Record<string, string | number>): void;
}>();

const t = useT();
const open = ref(false);
const body = ref('');
const audience = ref<Audience>('friends');

const spec = computed(() => AUDIENCES.find((a) => a.value === audience.value));
const firstName = computed(() => props.viewer.displayName.split(' ')[0]);

/* The same directive the comment box uses, and for the same reason: `mdInput`
   carries the bare string and Vue's `@input` is the native event. */
const bodyListeners = {
  mdInput: (event: Event) => {
    body.value = String((event as CustomEvent<string>).detail ?? '');
  },
};

function post() {
  if (body.value.trim() === '') {
    emit('message', 'community.hint.needBody');
    return;
  }
  emit('message', 'community.msg.posted');
  body.value = '';
  open.value = false;
}
</script>

<template>
  <div v-if="!open" class="composer">
    <Avatar :person="props.viewer" size="medium" />
    <!-- A BUTTON, not a read-only text field styled as one. A field would take
         focus, show a caret and accept typing that goes nowhere until the real
         composer opens. -->
    <button type="button" class="composer__trigger" @click="open = true">
      {{ t('community.action.writeSomething', { name: firstName }) }}
    </button>
  </div>

  <div v-else class="composer__open">
    <div class="composer">
      <Avatar :person="props.viewer" size="medium" />
      <span class="post-card__names">
        <span class="post-card__name">{{ props.viewer.displayName }}</span>
        <span class="post-card__meta">
          <span class="material-symbols-outlined" aria-hidden="true">{{
            audienceIcon[audience]
          }}</span>
          {{ spec ? t(spec.labelKey) : '' }}
        </span>
      </span>
    </div>

    <md-text-field
      v-awc="{ on: bodyListeners }"
      variant="outlined"
      :label="t('community.panel.compose')"
      :value="body"
      multiline="auto-grow"
      rows="3"
      full-width
    />

    <div class="composer__foot">
      <!-- Four audiences as filter chips rather than a select: each needs a
           sentence of explanation, and a select hides the explanations behind
           the one that happens to be chosen. -->
      <md-chip
        v-for="option in AUDIENCES"
        :key="option.value"
        variant="filter"
        appearance="outlined"
        :icon="audienceIcon[option.value]"
        :label="t(option.labelKey)"
        :selected="audience === option.value || undefined"
        @click="audience = option.value"
      />
      <span class="composer__spacer" />
      <md-button
        variant="text"
        @click="
          () => {
            open = false;
            body = '';
          }
        "
      >
        {{ t('community.action.cancel') }}
      </md-button>
      <md-button
        variant="filled"
        icon="send"
        :soft-disabled="body.trim() === '' || undefined"
        @click="post"
      >
        {{ t('community.action.post') }}
      </md-button>
    </div>
  </div>
</template>
