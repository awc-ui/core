<!--
  The household screen's view settings, in a side sheet.

  WHY A SIDE SHEET AND NOT A DIALOG. These four switches change what the screen
  shows while you read it — a dialog would blank the thing being configured,
  and §5.5 puts supplementary content at the side on desktop. `variant="modal"`
  rather than `standard`: a standard sheet is `role="region"` with no focus
  trap, no Escape and no focus restoration, and this one is opened from a
  toolbar button, so the reader must be able to get back to that button with
  the keyboard. The modal variant does all of that itself — §9.3 rule 4 says do
  not write your own trap, and there is none here.

  WHY SWITCHES AND NOT CHECKBOXES. Every one of them takes effect the moment it
  is flipped; there is no Apply. That is the §5.3 rule for `md-switch` — an
  instant on/off setting — and it is why the only other control in the panel is
  a reset rather than a save.

  THREE THINGS THE MANUALS SAY THAT THIS FILE DEPENDS ON:

    - `md-switch` has NO default slot. The label is not slotted content: it is
      the list row's headline, and the switch itself carries `aria-label` with
      the same words, because a bare switch has no accessible name at all.
    - `md-switch` emits `mdChange` AFTER it has already flipped itself, and it
      emits nothing when `selected` is assigned from script. So the flip cannot
      re-enter this handler, and a controlled `selected` is safe.
    - Slotted `[slot="actions"]` elements are NOT wired by the sheet. Only its
      own built-in close button calls `close()`. That built-in button is the
      one used here, and `mdClose` — which fires for the ✕, the scrim and
      Escape alike — is what puts the state back.

  WHY THE RESET IS AT THE TOP OF THE CONTENT AND NOT IN `slot="actions"`.
  M3 puts a sheet's actions in a row along its bottom edge, and that is where
  they were until the screen was looked at: `<awc-showcase-dock>` is a fixed
  bar across the bottom of the viewport with a z-index above the sheet, so the
  actions row rendered UNDERNEATH it — invisible, and unclickable. The sheet's
  modal container is `position: fixed; inset-block: 0` with no custom property
  for a bottom inset, so there is nothing to theme it out of the way with. One
  reset control at the top of a four-row panel costs nothing and is reachable.

  The switch listener is delegated to the list rather than attached per
  control: `mdChange` bubbles and is composed, and the retargeted
  `event.target` is the `md-switch` host itself, so a `data-` attribute says
  which one moved. Four refs and four handlers for four switches is the version
  of this that rots.
-->
<script setup lang="ts">
import { useT } from '~/composables/useShowcase';
import ActionButton from './HouseholdActionButton.vue';
import { DEFAULT_VIEW, type HouseholdView } from './household-view';

const props = defineProps<{ open: boolean; view: HouseholdView }>();

const emit = defineEmits<{
  (e: 'change', next: HouseholdView): void;
  (e: 'close'): void;
}>();

const t = useT();

/**
 * The rows, in order.
 *
 * `labelKey` is a dictionary key and never a string — these four are the only
 * words this file renders, and all four already exist in the shared dictionary
 * because they name things the console shows elsewhere (the benchmark series,
 * the trend column, the cash asset class, the in-band allocation state).
 */
const TOGGLES: { key: keyof HouseholdView; labelKey: string; icon: string }[] = [
  { key: 'benchmark', labelKey: 'wealth.kpi.benchmark', icon: 'timeline' },
  { key: 'trend', labelKey: 'wealth.table.trend', icon: 'show_chart' },
  { key: 'cash', labelKey: 'wealth.assetClass.cash', icon: 'savings' },
  { key: 'inBand', labelKey: 'wealth.allocationStatus.in-band', icon: 'check_circle' },
];

// A dismissal (scrim, Escape, the built-in ✕) emits mdCancel AND mdClose;
// listening to mdClose alone therefore covers every way out.
const sheetListeners = { mdClose: () => emit('close') };

const listListeners = {
  mdChange(event: Event) {
    const target = event.target as HTMLElement | null;
    const key = target?.dataset?.key as keyof HouseholdView | undefined;
    if (!key) return;
    emit('change', {
      ...props.view,
      [key]: (event as CustomEvent<{ selected: boolean }>).detail.selected,
    });
  },
};
</script>

<template>
  <md-side-sheet
    v-awc="{ on: sheetListeners }"
    :open="open"
    variant="modal"
    side="end"
    :headline="t('wealth.action.filter')"
    top-divider
  >
    <div class="row row--end">
      <ActionButton icon="restart_alt" @activate="emit('change', DEFAULT_VIEW)">
        {{ t('wealth.action.clearFilters') }}
      </ActionButton>
    </div>

    <!--
      `selection-mode` is deliberately absent. Turning one on would make the
      list a `listbox` of `option`s and give every row its own selected state
      — a second, competing model beside the switch that is the real control.
      `interaction-mode="multi-action"` is the M3 shape for a settings row:
      the row is a label, the trailing control is the action.
    -->
    <md-list
      v-awc="{ on: listListeners }"
      class="table-host"
      :label="t('wealth.action.filter')"
      interaction-mode="multi-action"
    >
      <md-list-item
        v-for="toggle in TOGGLES"
        :key="toggle.key"
        :headline="t(toggle.labelKey)"
        :leading-icon="toggle.icon"
        lines="1"
      >
        <md-switch
          slot="trailing"
          :data-key="toggle.key"
          :selected="view[toggle.key]"
          :aria-label="t(toggle.labelKey)"
        ></md-switch>
      </md-list-item>
    </md-list>
  </md-side-sheet>
</template>
