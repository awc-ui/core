<!--
  The react button and its six-option picker.

  OPENS ON HOVER WITH A POINTER, ON PRESS EVERYWHERE. The CSS handles hover and
  focus; this component only holds the pressed state, which is what a touch
  reader and a keyboard reader both get.

  PRESSING THE MAIN BUTTON TOGGLES `like` rather than opening the picker, which
  is what every product of this shape does: the common case is one press for the
  default reaction, and making that press open a menu would put a second
  decision in front of the thing people actually want.
-->
<script setup lang="ts">
import { ref } from 'vue';
import { REACTIONS, reactionIcon, reactionTone, type ReactionKind } from '@awc-ui/showcase-kit/community';
import { useT } from '~/composables/useShowcase';

const props = defineProps<{ mine: ReactionKind | null }>();
const emit = defineEmits<{ (e: 'pick', next: ReactionKind | null): void }>();
const t = useT();
const open = ref(false);

function choose(kind: ReactionKind) {
  emit('pick', props.mine === kind ? null : kind);
  open.value = false;
}
</script>

<template>
  <span class="react">
    <!--
      `|| undefined` on `data-on` and `color`, NOT a plain false.

      These are boolean-ish ATTRIBUTES: presence means true, so a literal
      `false` would render `data-on="false"` and read as on. Vue drops an
      attribute whose value is `undefined` or `null`, which is what makes the
      unselected state emit nothing at all — and what keeps this build's DOM
      identical to React's, where the same rule applies for the same reason.
    -->
    <md-button
      class="react__main"
      variant="text"
      :icon="reactionIcon[props.mine ?? 'like']"
      :color="props.mine ? reactionTone[props.mine] : undefined"
      :data-on="props.mine ? '' : undefined"
      :aria-label="t(props.mine ? `community.reaction.${props.mine}` : 'community.reaction.none')"
      @click="emit('pick', props.mine ? null : 'like')"
    >
      {{ t(`community.reaction.${props.mine ?? 'like'}`) }}
    </md-button>

    <span
      class="react__picker"
      :data-open="open ? '' : undefined"
      role="group"
      :aria-label="t('community.reaction.pick')"
    >
      <button
        v-for="kind in REACTIONS"
        :key="kind"
        type="button"
        class="react__option"
        :data-tone="reactionTone[kind]"
        :data-reaction="kind"
        :data-on="props.mine === kind ? '' : undefined"
        :aria-pressed="props.mine === kind"
        :aria-label="t(`community.reaction.${kind}`)"
        @click="choose(kind)"
      >
        <span class="material-symbols-outlined" aria-hidden="true">{{ reactionIcon[kind] }}</span>
      </button>
    </span>

    <!-- The touch path. `pointer: coarse` hides the hover affordance, so this
         is the only way in on a phone — and it is a real button with a name
         rather than a long-press nobody can discover. -->
    <md-icon-button
      class="react__toggle"
      icon="add_reaction"
      :aria-label="t('community.reaction.pick')"
      :aria-expanded="open"
      @click="open = !open"
    />
  </span>
</template>
