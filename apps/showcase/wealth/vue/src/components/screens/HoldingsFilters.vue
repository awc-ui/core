<!--
  The filter bar above the holdings tables, and the two menus that hang off it.

  IT OWNS NO STATE. Every control here is driven by the `state` prop and reports
  a whole new `HoldingsFilterState` through the `change` emit; the screen holds
  it and re-reads the rows from the kit's selectors. That is what makes the
  filters REAL — there is exactly one place where a filter becomes a row set,
  and it is `getPositions()` / `getInstruments()`, not a `.filter()` in a
  component.

  WHY THE BAR SITS ABOVE THE TABS RATHER THAN INSIDE ONE PANEL. Every field it
  writes — `search`, `assetClass`, `region`, `currency` — exists on BOTH
  `PositionFilter` and `InstrumentFilter` with the same meaning, so one bar
  narrows the book and the tabs only choose how you look at what is left. It
  also keeps the element ids the two `md-menu`s anchor to unique: a per-table
  copy of this bar would put two `#wealth-holdings-export` triggers in one
  document and the menus would anchor to whichever the browser found first.

  THE OPTION LISTS ARE KIT ROLL-UPS, not literals. The asset classes come from
  `assetClassTotals()`, the regions from `regionTotals()`, the currencies from
  `currencyExposure()` — each computed over the WHOLE book by the screen, so
  the choices stay put as you filter instead of disappearing under you, and no
  enum is written out by hand where the data could disagree with it.

  EVERY `md*` EVENT GOES THROUGH `v-awc`. `@mdSearch` in a template silently
  listens for `md-search`, which nothing emits — see `lib/awc.ts`. The React
  source needed its chip row always mounted because its listener hook binds
  once per ref; `v-awc` binds on the element's own mount, so that constraint is
  gone here — but the row stays always mounted anyway, because its OTHER job
  (holding its height so picking a filter never pushes the table down) is a
  layout fact every port must reproduce.
-->
<script setup lang="ts">
import { computed, ref } from 'vue';
import type {
  AssetClass,
  ClassTotal,
  Currency,
  CurrencyExposure,
  Instrument,
  Position,
  Region,
  RegionTotal,
} from '@awc-ui/showcase-kit/wealth';
import { useT } from '~/composables/useShowcase';
import Money from '~/components/bits/Money.vue';
import {
  isFiltered,
  NO_FILTERS,
  type ExportTarget,
  type HoldingsFilterState,
  type PopupElement,
  type SortSpec,
} from './holdings';

const props = defineProps<{
  state: HoldingsFilterState;
  /** Book-wide roll-ups — the option lists. Never recomputed from the filtered set. */
  classOptions: ClassTotal[];
  regionOptions: RegionTotal[];
  currencyOptions: CurrencyExposure[];
  /** The whole instrument universe, for the lookup field. */
  instruments: Instrument[];
  /** The first few matching positions, for the search panel. */
  suggestions: Position[];
  /** How many rows the current filters match, for the search announcement. */
  matchCount: number;
  /** The sortable columns of whichever table is showing. */
  sortColumns: SortSpec[];
  sortBy: string;
  /** What the split button's default half exports — whichever view is showing. */
  defaultTarget: ExportTarget;
}>();

const emit = defineEmits<{
  (e: 'change', next: HoldingsFilterState): void;
  (e: 'sortColumn', key: string): void;
  (e: 'export', target: ExportTarget): void;
}>();

const t = useT();

/*
 * Element ids, written out rather than generated.
 *
 * `md-menu` resolves `anchor` with `getElementById`, so the trigger needs a
 * stable id in the document. A generated per-mount id would contain characters
 * that trap the moment anything reaches for `querySelector('#…')`. Exactly one
 * holdings screen is ever mounted, so a literal is both safe and greppable.
 */
const EXPORT_TRIGGER = 'wealth-holdings-export';
const EXPORT_MENU = 'wealth-holdings-export-menu';
const MORE_TRIGGER = 'wealth-holdings-more';
const MORE_MENU = 'wealth-holdings-more-menu';

/* ------------------------------------------------------------------ search */

const searchEl = ref<HTMLElement | null>(null);

/*
 * `mdSearch`, and only `mdSearch`.
 *
 * `mdInput` fires on every keystroke, `mdSubmit` on Enter and `mdChange` on a
 * changed blur; binding more than one of them to the same query runs it up to
 * four times per typing burst. `mdSearch` is the debounced, trimmed,
 * de-duplicated one, and both Enter and the clear button flush it — so
 * clearing the field delivers an empty query immediately and needs no
 * separate `mdClear` handler.
 */
const searchListeners = {
  mdSearch(event: Event) {
    emit('change', { ...props.state, search: (event as CustomEvent<{ value: string }>).detail.value });
  },
};

// The rows are `md-list-item type="button"`, so each one emits `mdClick` and
// it bubbles: one delegated listener on the list covers every result.
const resultListeners = {
  mdClick(event: Event) {
    const row = (event.target as HTMLElement | null)?.closest?.('md-list-item') as HTMLElement | null;
    const instrumentId = row?.dataset.instrument;
    if (!instrumentId) return;
    emit('change', { ...props.state, instrumentId });
    void (searchEl.value as PopupElement | null)?.close?.();
  },
};

/* ------------------------------------------------------------ asset classes */

// `value` is a `string[]` with no attribute form, so it goes to the element as
// a JS property through `v-awc`, which re-assigns it on every update.
const classProps = computed(() => ({ value: props.state.assetClasses }));

const classListeners = {
  mdChange(event: Event) {
    emit('change', {
      ...props.state,
      assetClasses: ((event as CustomEvent<string[]>).detail ?? []) as AssetClass[],
    });
  },
};

/* -------------------------------------------------------------- instrument */

const instrumentListeners = {
  mdChange(event: Event) {
    const detail = (event as CustomEvent<string | string[]>).detail;
    const value = Array.isArray(detail) ? detail[0] : detail;
    emit('change', { ...props.state, instrumentId: value || null });
  },
};

const picked = computed(() =>
  props.state.instrumentId
    ? props.instruments.find((instrument) => instrument.id === props.state.instrumentId)
    : undefined,
);

/* ------------------------------------------------------------------- chips */

interface ActiveChip {
  /** Stable key, also the `data-filter` the delegated remove handler reads. */
  id: string;
  label: string;
  next: HoldingsFilterState;
}

const chips = computed<ActiveChip[]>(() => {
  const state = props.state;
  const list: ActiveChip[] = [];
  if (state.search) {
    // The label is the query itself: it is what the reader typed, and a
    // dictionary key would only ever describe it.
    list.push({ id: 'search', label: state.search, next: { ...state, search: '' } });
  }
  for (const assetClass of state.assetClasses) {
    list.push({
      id: `class:${assetClass}`,
      label: t.value(`wealth.assetClass.${assetClass}`),
      next: { ...state, assetClasses: state.assetClasses.filter((c) => c !== assetClass) },
    });
  }
  if (picked.value) {
    list.push({ id: 'instrument', label: picked.value.ticker, next: { ...state, instrumentId: null } });
  }
  if (state.region) {
    list.push({
      id: 'region',
      label: t.value(`wealth.region.${state.region}`),
      next: { ...state, region: null },
    });
  }
  if (state.currency) {
    // A currency code is a proper noun; there is no dictionary key for "EUR".
    list.push({ id: 'currency', label: state.currency, next: { ...state, currency: null } });
  }
  return list;
});

/*
 * `preventDefault()` IS THE POINT.
 *
 * `mdRemove`'s default action is the chip removing ITSELF from the DOM — a
 * node Vue owns and will try to remove again on the next patch, which throws.
 * The manual names this exact case: cancel the default when the state layer
 * owns the list, and let the re-render drop the chip. `mdRemove` bubbles, so
 * one listener on the row covers every chip; "clear filters" rides on the same
 * container listener because `mdClick` bubbles and is composed, and the chips
 * are `selectable="false"`, so the button is the only thing in here that can
 * emit one.
 */
const chipRowListeners = {
  mdRemove(event: Event) {
    event.preventDefault();
    const chip = (event.target as HTMLElement | null)?.closest?.('md-chip') as HTMLElement | null;
    const id = chip?.dataset.filter;
    const match = chips.value.find((entry) => entry.id === id);
    if (match) emit('change', match.next);
  },
  mdClick(event: Event) {
    if ((event.target as HTMLElement | null)?.closest?.('md-button')) emit('change', NO_FILTERS);
  },
};

/* ------------------------------------------------------------------- menus */

const splitEl = ref<HTMLElement | null>(null);
const exportMenuEl = ref<HTMLElement | null>(null);
const moreMenuEl = ref<HTMLElement | null>(null);

// The default half exports the view you are looking at; the menu is the same
// verb applied to a different subject, which is what makes this a split
// button rather than a button standing next to a menu.
const splitListeners = {
  mdLeadingClick() {
    emit('export', props.defaultTarget);
  },
  // The split button flips `trailing-checked` itself and reports the new state;
  // writing it back here would double-toggle it.
  mdTrailingClick(event: Event) {
    const menu = exportMenuEl.value as PopupElement | null;
    void ((event as CustomEvent<{ checked: boolean }>).detail.checked ? menu?.show?.() : menu?.close?.());
  },
};

const exportMenuListeners = {
  // …but the menu can also close by Escape, an outside click or a pick, and the
  // button cannot see any of those. `mdClose` neither bubbles nor crosses a
  // shadow boundary, so this listener has to sit on the menu itself.
  mdClose() {
    const split = splitEl.value as PopupElement | null;
    if (split) split.trailingChecked = false;
  },
  mdClick(event: Event) {
    const item = (event.target as HTMLElement | null)?.closest?.('md-menu-item') as HTMLElement | null;
    const target = item?.dataset.export as ExportTarget | undefined;
    if (target) emit('export', target);
  },
};

const moreListeners = {
  mdClick() {
    void (moreMenuEl.value as PopupElement | null)?.show?.();
  },
};

/*
 * One delegated listener for the whole overflow tree.
 *
 * `mdClick` bubbles out of the nested submenus too, so the rows carry
 * `data-*` rather than being told apart by position. A click on the
 * `md-sub-menu-item` row itself also lands here and carries no `data-action`,
 * which is exactly right: opening a branch is a hover / ArrowRight gesture,
 * not a command.
 */
const moreMenuListeners = {
  mdClick(event: Event) {
    const row = (event.target as HTMLElement | null)?.closest?.('md-menu-item') as HTMLElement | null;
    const action = row?.dataset.action;
    const value = row?.dataset.value ?? '';
    if (action === 'region') emit('change', { ...props.state, region: (value || null) as Region | null });
    else if (action === 'currency')
      emit('change', { ...props.state, currency: (value || null) as Currency | null });
    else if (action === 'sort') emit('sortColumn', value);
    else if (action === 'clear') emit('change', NO_FILTERS);
  },
};
</script>

<template>
  <div class="stack">
    <div class="row">
      <!--
        A SEARCH SURFACE, not a text field with a magnifier.
        `md-search` earns its keep here because it has a results panel: the
        matches appear as you type and picking one narrows the table to that
        instrument. The query also drives the table itself, so the panel is a
        shortcut rather than the only way through.

        `full-width` zeroes the bar's side gutters; the min-inline-size
        override is what lets it shrink below the component's 360px default,
        which would otherwise overflow a 420px viewport. The panel cap is a
        SHORT DRAWER, deliberately: the default `min(400px, 60vh)` is long
        enough to cover the table the query is filtering.
      -->
      <md-search
        ref="searchEl"
        v-awc="{ on: searchListeners }"
        layout="docked"
        trigger="bar"
        variant="contained"
        full-width
        debounce="250"
        throttle="1000"
        :value="state.search"
        :placeholder="t('wealth.action.searchHoldings')"
        :input-aria-label="t('wealth.action.searchHoldings')"
        :results-label="t('wealth.common.showing', { shown: suggestions.length, total: matchCount })"
        :no-results-label="t('wealth.empty.search', { query: state.search })"
        :style="{
          flex: '1 1 260px',
          '--md-search-container-min-inline-size': '240px',
          '--md-search-panel-max-block-size': '232px',
        }"
      >
        <md-list v-awc="{ on: resultListeners }" slot="results">
          <md-list-item
            v-for="position in suggestions"
            :key="position.id"
            type="button"
            :data-instrument="position.instrumentId"
            :overline="position.ticker"
            :headline="position.instrumentName"
            :supporting-text="t(position.assetClassKey)"
            lines="2"
          >
            <span slot="trailing-supporting-text">
              <Money :value="position.marketValueEur" compact />
            </span>
          </md-list-item>
        </md-list>
      </md-search>

      <!--
        Several values from a closed list of five-ish — the multi-select row of
        §5.3. `display-mode="text"` rather than the default chips: the active
        filters already have a chip row below, and two sets of chips for one
        selection is two things to keep in step.
      -->
      <md-multi-select
        v-awc="{ props: classProps, on: classListeners }"
        :label="t('wealth.table.assetClass')"
        :placeholder="t('wealth.common.all')"
        display-mode="text"
        :no-options-text="t('wealth.empty.generic')"
        density="-2"
        :style="{ flex: '0 1 220px', minInlineSize: '180px' }"
      >
        <!--
          `t.formatCurrency` rather than `<Money>` in `supporting-text`: it is
          a PROP, so it has to be a string and a component cannot render into
          it. This is the kit's locale-bound formatter, not a raw `Intl` call —
          the rule that stands is "never format a number yourself", and this
          does not.
        -->
        <md-select-option
          v-for="option in classOptions"
          :key="option.assetClass"
          :value="option.assetClass"
          :label="t(option.assetClassKey)"
          :supporting-text="
            t.formatCurrency(option.marketValue, { notation: 'compact', maximumFractionDigits: 1 })
          "
        ></md-select-option>
      </md-multi-select>

      <!--
        Type-to-find over forty instruments: `md-autocomplete`, not a select.
        The label carries the ticker AND the name so substring matching finds
        either, and the committed value is the instrument id the kit filters
        by. `{count}` in `status-template` survives on purpose: the kit's
        translator leaves a token it was not given in place, and
        md-autocomplete substitutes it with the number of visible suggestions.
      -->
      <md-autocomplete
        v-awc="{ on: instrumentListeners }"
        :label="t('wealth.table.instrument')"
        variant="outlined"
        density="-2"
        :value="state.instrumentId ?? ''"
        :input-value="picked ? `${picked.ticker} · ${picked.name}` : ''"
        limit-results="8"
        :no-options-text="t('wealth.common.none')"
        :no-results-text="t('wealth.empty.generic')"
        :status-template="t('wealth.common.of', { total: instruments.length })"
        :style="{ flex: '1 1 240px', minInlineSize: '200px' }"
      >
        <md-select-option
          v-for="instrument in instruments"
          :key="instrument.id"
          :value="instrument.id"
          :label="`${instrument.ticker} · ${instrument.name}`"
          :supporting-text="t(instrument.assetClassKey)"
        ></md-select-option>
      </md-autocomplete>

      <!--
        Export: one default action plus variations of it. The leading half
        exports what is on screen; the menu picks a different dataset — the
        same verb, a different subject, which is what makes a split button
        rather than a button beside a menu.

        `menu-label` repeats the word "Export" because the dictionary has no
        "more export options" key and a screen may not add one to the kit; the
        trailing button is still distinguishable in the accessibility tree by
        its `aria-haspopup="menu"` and its live `aria-expanded`.
      -->
      <md-split-button
        ref="splitEl"
        v-awc="{ on: splitListeners }"
        :id="EXPORT_TRIGGER"
        :controls="EXPORT_MENU"
        variant="tonal"
        size="sm"
        icon="download"
        :label="t('wealth.action.export')"
        :menu-label="t('wealth.action.export')"
      ></md-split-button>

      <!--
        The overflow trigger's name is composed from the two things behind it.
        "Screen actions" is already the shell toolbar's name and "Filter"
        alone would hide the sort group; two words joined by a separator stay
        translated and say what the menu holds.
      -->
      <md-icon-button
        v-awc="{ on: moreListeners }"
        :id="MORE_TRIGGER"
        icon="more_vert"
        variant="standard"
        size="sm"
        :aria-label="`${t('wealth.action.filter')} · ${t('wealth.action.sortBy')}`"
      ></md-icon-button>
    </div>

    <!--
      THE ROW HOLDS ITS HEIGHT WHETHER OR NOT ANYTHING IS IN IT.
      A row that comes and goes with the first filter picked inserts itself and
      pushes the tabs and the whole table down — the table moving as a side
      effect of filtering it. The row always occupies its own height and only
      its CONTENTS come and go, so selecting and clearing filters leaves
      everything below exactly where it was. `min-block-size` rather than a
      fixed height: a long chip set that wraps to two lines still grows, which
      is a change the reader caused directly. The reservation is ONE CHIP TALL
      (32px), and the group role is dropped while it is empty — an empty
      labelled group is noise in the accessibility tree.
    -->
    <div
      v-awc="{ on: chipRowListeners }"
      class="row"
      :role="chips.length ? 'group' : undefined"
      :aria-label="chips.length ? t('wealth.action.filter') : undefined"
      :aria-hidden="chips.length ? undefined : true"
      style="min-block-size: 32px; align-items: center"
    >
      <!--
        `variant="input"` with `selectable="false"`: a token whose only action
        is its ✕. The chip's own accessible name for that button is generated
        as "Remove {label}", so the row needs no extra wiring.
      -->
      <md-chip
        v-for="chip in chips"
        :key="chip.id"
        :data-filter="chip.id"
        variant="input"
        appearance="outlined"
        selectable="false"
        removable
        :label="chip.label"
      ></md-chip>
      <md-button v-if="chips.length" variant="text" size="xs" icon="filter_alt_off">
        {{ t('wealth.action.clearFilters') }}
      </md-button>
    </div>

    <!-- --------------------------------------------------------- menus --- -->

    <!--
      Never rendered `open`: md-menu wires positioning and dismissal from the
      `open` CHANGE handler, and an attribute that is already there at first
      paint never fires it. Both menus are opened by a method call instead.

      `variant="vibrant"` on every menu surface in this app, submenus
      included. The default is `baseline` — square corners on a surface
      container; `vibrant` is the M3 Expressive vertical menu, 16px corners on
      tertiary-based colour. A submenu does NOT inherit the parent's variant,
      because it is its own `md-menu` element, so each one carries it.
    -->
    <md-menu
      ref="exportMenuEl"
      v-awc="{ on: exportMenuListeners }"
      :id="EXPORT_MENU"
      :anchor="EXPORT_TRIGGER"
      placement="bottom-end"
      variant="vibrant"
    >
      <md-menu-item data-export="holdings" :headline="t('wealth.panel.holdings')"></md-menu-item>
      <md-menu-item data-export="instruments" :headline="t('wealth.panel.universe')"></md-menu-item>
      <md-menu-item
        data-export="concentration"
        :headline="t('wealth.panel.concentration')"
      ></md-menu-item>
    </md-menu>

    <md-menu
      ref="moreMenuEl"
      v-awc="{ on: moreMenuListeners }"
      :id="MORE_MENU"
      :anchor="MORE_TRIGGER"
      placement="bottom-end"
      variant="vibrant"
    >
      <md-menu-item-group :label="t('wealth.action.filter')">
        <!--
          EACH BRANCH CARRIES ITS OWN GROUP. `md-menu-item` resolves radio
          exclusivity with `closest('md-menu-item-group')`, and a row inside a
          submenu is still a DOM descendant of the OUTER group — so without an
          inner group, picking a region would silently clear the currency.
        -->
        <md-sub-menu-item :headline="t('wealth.table.region')">
          <md-menu slot="submenu" variant="vibrant">
            <md-menu-item-group :label="t('wealth.table.region')">
              <md-menu-item
                data-action="region"
                data-value=""
                type="radio"
                :selected="!state.region || undefined"
                :headline="t('wealth.common.all')"
              ></md-menu-item>
              <md-menu-item
                v-for="option in regionOptions"
                :key="option.region"
                data-action="region"
                :data-value="option.region"
                type="radio"
                :selected="state.region === option.region || undefined"
                :headline="t(option.regionKey)"
                :trailing-text="String(option.positionCount)"
              ></md-menu-item>
            </md-menu-item-group>
          </md-menu>
        </md-sub-menu-item>

        <md-sub-menu-item :headline="t('wealth.table.currency')" divider>
          <md-menu slot="submenu" variant="vibrant">
            <md-menu-item-group :label="t('wealth.table.currency')">
              <md-menu-item
                data-action="currency"
                data-value=""
                type="radio"
                :selected="!state.currency || undefined"
                :headline="t('wealth.common.all')"
              ></md-menu-item>
              <md-menu-item
                v-for="option in currencyOptions"
                :key="option.currency"
                data-action="currency"
                :data-value="option.currency"
                type="radio"
                :selected="state.currency === option.currency || undefined"
                :headline="option.currency"
                :trailing-text="String(option.positionCount)"
              ></md-menu-item>
            </md-menu-item-group>
          </md-menu>
        </md-sub-menu-item>

        <md-menu-item
          data-action="clear"
          :headline="t('wealth.action.clearFilters')"
          :disabled="!isFiltered(state) || undefined"
        ></md-menu-item>
      </md-menu-item-group>

      <!--
        The sort group mirrors whichever table is on screen — its rows are the
        same column keys the sort labels emit, so the menu and the headers can
        never disagree about what is sortable.
      -->
      <md-menu-item-group :label="t('wealth.action.sortBy')">
        <md-menu-item
          v-for="column in sortColumns"
          :key="column.key"
          data-action="sort"
          :data-value="column.key"
          type="radio"
          :selected="sortBy === column.key || undefined"
          :headline="column.label"
        ></md-menu-item>
      </md-menu-item-group>
    </md-menu>
  </div>
</template>
