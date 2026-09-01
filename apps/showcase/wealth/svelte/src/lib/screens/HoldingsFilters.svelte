<!--
  The filter bar above the holdings tables, and the two menus that hang off it.

  IT OWNS NO STATE. Every control here is driven by the `state` prop and reports
  a whole new `HoldingsFilterState` through `onChange`; the screen holds it and
  re-reads the rows from the kit's selectors. That is what makes the filters
  REAL — there is exactly one place where a filter becomes a row set, and it is
  `getPositions()` / `getInstruments()`, not a `.filter()` in a component.

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
-->
<script lang="ts">
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
  import { t, type T } from '$lib/showcase';
  import { objectProps } from '$lib/elements';
  import Money from '$lib/bits/Money.svelte';
  import {
    isFiltered,
    NO_FILTERS,
    type ExportTarget,
    type HoldingsFilterState,
    type SortSpec,
  } from './holdings';

  export let state: HoldingsFilterState;
  export let onChange: (next: HoldingsFilterState) => void;
  /** Book-wide roll-ups — the option lists. Never recomputed from the filtered set. */
  export let classOptions: ClassTotal[];
  export let regionOptions: RegionTotal[];
  export let currencyOptions: CurrencyExposure[];
  /** The whole instrument universe, for the lookup field. */
  export let instruments: Instrument[];
  /** The first few matching positions, for the search panel. */
  export let suggestions: Position[];
  /** How many rows the current filters match, for the search announcement. */
  export let matchCount: number;
  /** The sortable columns of whichever table is showing. */
  export let sortColumns: SortSpec[];
  export let sortBy: string;
  export let onSortColumn: (key: string) => void;
  /** What the split button's default half exports — whichever view is showing. */
  export let defaultTarget: ExportTarget;
  export let onExport: (target: ExportTarget) => void;

  /*
   * Element ids, written out rather than generated.
   *
   * `md-menu` resolves `anchor` with `getElementById`, so the trigger needs a
   * stable id in the document. Exactly one holdings screen is ever mounted, so
   * a literal is both safe and greppable.
   */
  const EXPORT_TRIGGER = 'wealth-holdings-export';
  const EXPORT_MENU = 'wealth-holdings-export-menu';
  const MORE_TRIGGER = 'wealth-holdings-more';
  const MORE_MENU = 'wealth-holdings-more-menu';

  /** The `md-menu` / `md-search` methods used here. All of them are async. */
  type PopupElement = HTMLElement & {
    show?: (options?: unknown) => Promise<void>;
    close?: () => Promise<void>;
    trailingChecked?: boolean;
  };

  let searchEl: HTMLElement | null = null;
  let splitEl: HTMLElement | null = null;
  let exportMenuEl: HTMLElement | null = null;
  let moreMenuEl: HTMLElement | null = null;

  /* ------------------------------------------------------------- search */

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
  function onSearch(event: Event) {
    onChange({ ...state, search: (event as CustomEvent<{ value: string }>).detail.value });
  }

  // The rows are `md-list-item type="button"`, so each one emits `mdClick` and
  // it bubbles: one delegated listener on the list covers every result.
  function onResultClick(event: Event) {
    const row = (event.target as HTMLElement | null)?.closest?.('md-list-item') as HTMLElement | null;
    const instrumentId = row?.dataset.instrument;
    if (!instrumentId) return;
    onChange({ ...state, instrumentId });
    void (searchEl as PopupElement | null)?.close?.();
  }

  /* -------------------------------------------------------- asset classes */

  /*
   * `value` is a `string[]` with no attribute form, so it is assigned to the
   * element through the `objectProps` action rather than rendered. The props
   * object is rebuilt only when the JOINED array changes — the array itself is
   * a fresh identity on every `state` patch, and re-assigning the selection
   * while the reader is using an unrelated control is exactly the churn the
   * React build keys its effect against.
   */
  function buildClassesProps(_key: string): Record<string, unknown> {
    return { value: state.assetClasses };
  }
  $: classesKey = state.assetClasses.join('|');
  $: classesProps = buildClassesProps(classesKey);

  function onClassesChange(event: Event) {
    onChange({
      ...state,
      assetClasses: ((event as CustomEvent<string[]>).detail ?? []) as AssetClass[],
    });
  }

  /* ------------------------------------------------------------ instrument */

  function onInstrumentChange(event: Event) {
    const detail = (event as CustomEvent<string | string[]>).detail;
    const value = Array.isArray(detail) ? detail[0] : detail;
    onChange({ ...state, instrumentId: value || null });
  }

  $: picked = state.instrumentId
    ? instruments.find((instrument) => instrument.id === state.instrumentId)
    : undefined;

  /* ----------------------------------------------------------------- chips */

  interface ActiveChip {
    /** Stable key, also the `data-filter` the delegated remove handler reads. */
    id: string;
    label: string;
    next: HoldingsFilterState;
  }

  function buildChips(
    current: HoldingsFilterState,
    pickedInstrument: Instrument | undefined,
    translator: T,
  ): ActiveChip[] {
    const list: ActiveChip[] = [];
    if (current.search) {
      // The label is the query itself: it is what the reader typed, and a
      // dictionary key would only ever describe it.
      list.push({ id: 'search', label: current.search, next: { ...current, search: '' } });
    }
    for (const assetClass of current.assetClasses) {
      list.push({
        id: `class:${assetClass}`,
        label: translator(`wealth.assetClass.${assetClass}`),
        next: { ...current, assetClasses: current.assetClasses.filter((c) => c !== assetClass) },
      });
    }
    if (pickedInstrument) {
      list.push({
        id: 'instrument',
        label: pickedInstrument.ticker,
        next: { ...current, instrumentId: null },
      });
    }
    if (current.region) {
      list.push({
        id: 'region',
        label: translator(`wealth.region.${current.region}`),
        next: { ...current, region: null },
      });
    }
    if (current.currency) {
      // A currency code is a proper noun; there is no dictionary key for "EUR".
      list.push({ id: 'currency', label: current.currency, next: { ...current, currency: null } });
    }
    return list;
  }

  $: chips = buildChips(state, picked, $t);

  /*
   * `preventDefault()` IS THE POINT.
   *
   * `mdRemove`'s default action is the chip removing ITSELF from the DOM — a
   * node Svelte owns and will try to remove again when the re-render drops the
   * chip. The manual names this exact case: cancel the default when the state
   * layer owns the list, and let the re-render drop the chip. `mdRemove`
   * bubbles, so one listener on the row covers every chip.
   */
  function onChipRemove(event: Event) {
    event.preventDefault();
    const chip = (event.target as HTMLElement | null)?.closest?.('md-chip') as HTMLElement | null;
    const id = chip?.dataset.filter;
    const match = chips.find((entry) => entry.id === id);
    if (match) onChange(match.next);
  }

  /*
   * "Clear filters" rides on the SAME container listener by delegation:
   * `mdClick` bubbles and is composed, and the chips are `selectable="false"`,
   * so the button is the only thing in here that can emit one. (Svelte would
   * happily bind a listener to a conditionally-mounted button — the React
   * build cannot — but the row stays always mounted regardless: a row that
   * comes and goes moves the table, and the DOM census must match React's.)
   */
  function onChipsClick(event: Event) {
    if ((event.target as HTMLElement | null)?.closest?.('md-button')) onChange(NO_FILTERS);
  }

  /* ----------------------------------------------------------------- menus */

  // The default half exports the view you are looking at; the menu is the same
  // verb applied to a different subject, which is what makes this a split
  // button rather than a button standing next to a menu.
  function onExportLeading() {
    onExport(defaultTarget);
  }

  // The split button flips `trailing-checked` itself and reports the new state;
  // writing it back here would double-toggle it.
  function onExportTrailing(event: Event) {
    const menu = exportMenuEl as PopupElement | null;
    void ((event as CustomEvent<{ checked: boolean }>).detail.checked
      ? menu?.show?.()
      : menu?.close?.());
  }

  // …but the menu can also close by Escape, an outside click or a pick, and the
  // button cannot see any of those. `mdClose` neither bubbles nor crosses a
  // shadow boundary, so this listener has to sit on the menu itself.
  function onExportMenuClose() {
    const split = splitEl as PopupElement | null;
    if (split) split.trailingChecked = false;
  }

  function onExportMenuClick(event: Event) {
    const item = (event.target as HTMLElement | null)?.closest?.(
      'md-menu-item',
    ) as HTMLElement | null;
    const target = item?.dataset.export as ExportTarget | undefined;
    if (target) onExport(target);
  }

  function onMoreClick() {
    void (moreMenuEl as PopupElement | null)?.show?.();
  }

  /*
   * One delegated listener for the whole overflow tree.
   *
   * `mdClick` bubbles out of the nested submenus too, so the rows carry
   * `data-*` rather than being told apart by position. A click on the
   * `md-sub-menu-item` row itself also lands here and carries no `data-action`,
   * which is exactly right: opening a branch is a hover / ArrowRight gesture,
   * not a command.
   */
  function onMoreMenuClick(event: Event) {
    const row = (event.target as HTMLElement | null)?.closest?.(
      'md-menu-item',
    ) as HTMLElement | null;
    const action = row?.dataset.action;
    const value = row?.dataset.value ?? '';
    if (action === 'region') onChange({ ...state, region: (value || null) as Region | null });
    else if (action === 'currency')
      onChange({ ...state, currency: (value || null) as Currency | null });
    else if (action === 'sort') onSortColumn(value);
    else if (action === 'clear') onChange(NO_FILTERS);
  }
</script>

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
      which would otherwise overflow a 420px viewport.

      A SHORT DRAWER, DELIBERATELY (the panel max-block-size). The component's
      default cap is `min(400px, 60vh)`, which on a desktop shows most of a
      filtered book at once — a panel long enough to cover the table it is
      filtering, so you lose sight of what the query is doing. Three rows and a
      bit is enough to recognise a match or keep typing, and the panel scrolls
      for the rest.
    -->
    <md-search
      bind:this={searchEl}
      layout="docked"
      trigger="bar"
      variant="contained"
      full-width
      debounce="250"
      throttle="1000"
      value={state.search}
      placeholder={$t('wealth.action.searchHoldings')}
      input-aria-label={$t('wealth.action.searchHoldings')}
      results-label={$t('wealth.common.showing', {
        shown: suggestions.length,
        total: matchCount,
      })}
      no-results-label={$t('wealth.empty.search', { query: state.search })}
      style="
        flex: 1 1 260px;
        --md-search-container-min-inline-size: 240px;
        --md-search-panel-max-block-size: 232px;
      "
      on:mdSearch={onSearch}
    >
      <md-list slot="results" on:mdClick={onResultClick}>
        {#each suggestions as position (position.id)}
          <md-list-item
            type="button"
            data-instrument={position.instrumentId}
            overline={position.ticker}
            headline={position.instrumentName}
            supporting-text={$t(position.assetClassKey)}
            lines="2"
          >
            <span slot="trailing-supporting-text">
              <Money value={position.marketValueEur} compact />
            </span>
          </md-list-item>
        {/each}
      </md-list>
    </md-search>

    <!--
      Several values from a closed list of five-ish — the multi-select row of
      §5.3. `display-mode="text"` rather than the default chips: the active
      filters already have a chip row below, and two sets of chips for one
      selection is two things to keep in step.
    -->
    <md-multi-select
      use:objectProps={classesProps}
      label={$t('wealth.table.assetClass')}
      placeholder={$t('wealth.common.all')}
      display-mode="text"
      no-options-text={$t('wealth.empty.generic')}
      density="-2"
      style="flex: 0 1 220px; min-inline-size: 180px"
      on:mdChange={onClassesChange}
    >
      {#each classOptions as option (option.assetClass)}
        <!--
          `$t.formatCurrency` rather than `<Money>`: `supporting-text` is a
          PROP, so it has to be a string and a component cannot render into it.
          This is the kit's locale-bound formatter, not a raw `Intl` call — the
          rule that stands is "never format a number yourself", and this does
          not.
        -->
        <md-select-option
          value={option.assetClass}
          label={$t(option.assetClassKey)}
          supporting-text={$t.formatCurrency(option.marketValue, {
            notation: 'compact',
            maximumFractionDigits: 1,
          })}
        ></md-select-option>
      {/each}
    </md-multi-select>

    <!--
      Type-to-find over forty instruments: `md-autocomplete`, not a select.
      The label carries the ticker AND the name so substring matching finds
      either, and the committed value is the instrument id the kit filters by.

      Two different empty states, two different strings, as the manual asks: an
      empty universe would be "None", a query that matches nothing is "Nothing
      to show". The first is unreachable here — the option list is the whole
      instrument universe — but the pair is what stops one message from
      covering two situations.

      `{count}` survives in `status-template` on purpose: the kit's translator
      leaves a token it was not given in place, and md-autocomplete substitutes
      it with the number of visible suggestions. So one existing key becomes
      "12 of 40" without inventing a dictionary entry.
    -->
    <md-autocomplete
      label={$t('wealth.table.instrument')}
      variant="outlined"
      density="-2"
      value={state.instrumentId ?? ''}
      input-value={picked ? `${picked.ticker} · ${picked.name}` : ''}
      limit-results="8"
      no-options-text={$t('wealth.common.none')}
      no-results-text={$t('wealth.empty.generic')}
      status-template={$t('wealth.common.of', { total: instruments.length })}
      style="flex: 1 1 240px; min-inline-size: 200px"
      on:mdChange={onInstrumentChange}
    >
      {#each instruments as instrument (instrument.id)}
        <md-select-option
          value={instrument.id}
          label={`${instrument.ticker} · ${instrument.name}`}
          supporting-text={$t(instrument.assetClassKey)}
        ></md-select-option>
      {/each}
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
      bind:this={splitEl}
      id={EXPORT_TRIGGER}
      controls={EXPORT_MENU}
      variant="tonal"
      size="sm"
      icon="download"
      label={$t('wealth.action.export')}
      menu-label={$t('wealth.action.export')}
      on:mdLeadingClick={onExportLeading}
      on:mdTrailingClick={onExportTrailing}
    ></md-split-button>

    <!--
      The overflow trigger's name is composed from the two things behind it.
      "Screen actions" is already the shell toolbar's name and "Filter"
      alone would hide the sort group; two words joined by a separator stay
      translated and say what the menu holds.
    -->
    <md-icon-button
      id={MORE_TRIGGER}
      icon="more_vert"
      variant="standard"
      size="sm"
      aria-label={`${$t('wealth.action.filter')} · ${$t('wealth.action.sortBy')}`}
      on:mdClick={onMoreClick}
    ></md-icon-button>
  </div>

  <!--
    THE ROW HOLDS ITS HEIGHT WHETHER OR NOT ANYTHING IS IN IT.
    A row that only exists while filters are on would insert itself on the
    first pick and push the tabs and the whole table down — the table moving as
    a side effect of filtering it. The row always occupies its own height and
    only its CONTENTS come and go, so selecting and clearing filters leaves
    everything below exactly where it was.
    `min-block-size` rather than a fixed height: a long chip set that wraps
    to two lines still grows, which is a change the reader caused directly.

    THE RESERVATION IS ONE CHIP TALL — 32px, exactly the chip it is holding
    room for; anything more pushes the table down for nothing on first arrival.

    The group role is dropped while it is empty — an empty labelled group is
    noise in the accessibility tree.
  -->
  <div
    class="row"
    role={chips.length ? 'group' : undefined}
    aria-label={chips.length ? $t('wealth.action.filter') : undefined}
    aria-hidden={chips.length ? undefined : true}
    style="min-block-size: 32px; align-items: center"
    on:mdRemove={onChipRemove}
    on:mdClick={onChipsClick}
  >
    {#each chips as chip (chip.id)}
      <!--
        `variant="input"` with `selectable="false"`: a token whose only
        action is its ✕. The chip's own accessible name for that button is
        generated as "Remove {label}", so the row needs no extra wiring.
      -->
      <md-chip
        data-filter={chip.id}
        variant="input"
        appearance="outlined"
        selectable="false"
        removable
        label={chip.label}
      ></md-chip>
    {/each}
    {#if chips.length}
      <md-button variant="text" size="xs" icon="filter_alt_off">
        {$t('wealth.action.clearFilters')}
      </md-button>
    {/if}
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
    bind:this={exportMenuEl}
    id={EXPORT_MENU}
    anchor={EXPORT_TRIGGER}
    placement="bottom-end"
    variant="vibrant"
    on:mdClose={onExportMenuClose}
    on:mdClick={onExportMenuClick}
  >
    <md-menu-item data-export="holdings" headline={$t('wealth.panel.holdings')}></md-menu-item>
    <md-menu-item data-export="instruments" headline={$t('wealth.panel.universe')}></md-menu-item>
    <md-menu-item
      data-export="concentration"
      headline={$t('wealth.panel.concentration')}
    ></md-menu-item>
  </md-menu>

  <md-menu
    bind:this={moreMenuEl}
    id={MORE_MENU}
    anchor={MORE_TRIGGER}
    placement="bottom-end"
    variant="vibrant"
    on:mdClick={onMoreMenuClick}
  >
    <md-menu-item-group label={$t('wealth.action.filter')}>
      <!--
        EACH BRANCH CARRIES ITS OWN GROUP. `md-menu-item` resolves radio
        exclusivity with `closest('md-menu-item-group')`, and a row inside a
        submenu is still a DOM descendant of the OUTER group — so without an
        inner group, picking a region would silently clear the currency.
      -->
      <md-sub-menu-item headline={$t('wealth.table.region')}>
        <md-menu slot="submenu" variant="vibrant">
          <md-menu-item-group label={$t('wealth.table.region')}>
            <md-menu-item
              data-action="region"
              data-value=""
              type="radio"
              selected={!state.region || undefined}
              headline={$t('wealth.common.all')}
            ></md-menu-item>
            {#each regionOptions as option (option.region)}
              <md-menu-item
                data-action="region"
                data-value={option.region}
                type="radio"
                selected={state.region === option.region || undefined}
                headline={$t(option.regionKey)}
                trailing-text={String(option.positionCount)}
              ></md-menu-item>
            {/each}
          </md-menu-item-group>
        </md-menu>
      </md-sub-menu-item>

      <md-sub-menu-item headline={$t('wealth.table.currency')} divider>
        <md-menu slot="submenu" variant="vibrant">
          <md-menu-item-group label={$t('wealth.table.currency')}>
            <md-menu-item
              data-action="currency"
              data-value=""
              type="radio"
              selected={!state.currency || undefined}
              headline={$t('wealth.common.all')}
            ></md-menu-item>
            {#each currencyOptions as option (option.currency)}
              <md-menu-item
                data-action="currency"
                data-value={option.currency}
                type="radio"
                selected={state.currency === option.currency || undefined}
                headline={option.currency}
                trailing-text={String(option.positionCount)}
              ></md-menu-item>
            {/each}
          </md-menu-item-group>
        </md-menu>
      </md-sub-menu-item>

      <md-menu-item
        data-action="clear"
        headline={$t('wealth.action.clearFilters')}
        disabled={!isFiltered(state) || undefined}
      ></md-menu-item>
    </md-menu-item-group>

    <!--
      The sort group mirrors whichever table is on screen — its rows are the
      same column keys the sort labels emit, so the menu and the headers can
      never disagree about what is sortable.
    -->
    <md-menu-item-group label={$t('wealth.action.sortBy')}>
      {#each sortColumns as column (column.key)}
        <md-menu-item
          data-action="sort"
          data-value={column.key}
          type="radio"
          selected={sortBy === column.key || undefined}
          headline={column.label}
        ></md-menu-item>
      {/each}
    </md-menu-item-group>
  </md-menu>
</div>
