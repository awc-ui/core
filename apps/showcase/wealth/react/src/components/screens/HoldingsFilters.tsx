/**
 * The filter bar above the holdings tables, and the two menus that hang off it.
 *
 * IT OWNS NO STATE. Every control here is driven by the `state` prop and reports
 * a whole new `HoldingsFilterState` through `onChange`; the screen holds it and
 * re-reads the rows from the kit's selectors. That is what makes the filters
 * REAL — there is exactly one place where a filter becomes a row set, and it is
 * `getPositions()` / `getInstruments()`, not a `.filter()` in a component.
 *
 * WHY THE BAR SITS ABOVE THE TABS RATHER THAN INSIDE ONE PANEL. Every field it
 * writes — `search`, `assetClass`, `region`, `currency` — exists on BOTH
 * `PositionFilter` and `InstrumentFilter` with the same meaning, so one bar
 * narrows the book and the tabs only choose how you look at what is left. It
 * also keeps the element ids the two `md-menu`s anchor to unique: a per-table
 * copy of this bar would put two `#wealth-holdings-export` triggers in one
 * document and the menus would anchor to whichever the browser found first.
 *
 * THE OPTION LISTS ARE KIT ROLL-UPS, not literals. The asset classes come from
 * `assetClassTotals()`, the regions from `regionTotals()`, the currencies from
 * `currencyExposure()` — each computed over the WHOLE book by the screen, so
 * the choices stay put as you filter instead of disappearing under you, and no
 * enum is written out by hand where the data could disagree with it.
 */

import { useRef, type CSSProperties } from 'react';
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
import { useT } from '@/lib/showcase';
import { useCustomEvent, useElementProps } from '../elements';
import { Money } from '../bits';

/* ------------------------------------------------------------------- state */

/**
 * Everything the bar can narrow the book by.
 *
 * Every field maps 1:1 onto a field of the kit's `PositionFilter`, so the
 * screen hands the whole object to the selector rather than translating it.
 * `null` and `''` mean "not filtered" — never `undefined`, so a spread patch
 * can always clear a field.
 */
export interface HoldingsFilterState {
  /** Substring over ticker, instrument name and id. */
  search: string;
  /** Empty means every class. More than one is a union — see the screen. */
  assetClasses: AssetClass[];
  instrumentId: string | null;
  region: Region | null;
  currency: Currency | null;
}

export const NO_FILTERS: HoldingsFilterState = {
  search: '',
  assetClasses: [],
  instrumentId: null,
  region: null,
  currency: null,
};

/** `true` when anything is narrowing the book. Used to offer "clear filters". */
export function isFiltered(state: HoldingsFilterState): boolean {
  return Boolean(
    state.search || state.assetClasses.length || state.instrumentId || state.region || state.currency,
  );
}

/** One sortable column of whichever table is on screen, for the sort menu. */
export interface SortSpec {
  /** The `column` a sort label emits — a key of the active table's filter. */
  key: string;
  label: string;
}

/** Which dataset the export acts on. */
export type ExportTarget = 'holdings' | 'instruments' | 'concentration';

/*
 * Element ids, written out rather than generated.
 *
 * `md-menu` resolves `anchor` with `getElementById`, so the trigger needs a
 * stable id in the document. `useId()` would give one per mount, but its value
 * contains colons, which is a trap the moment anything reaches for
 * `querySelector('#…')`. Exactly one holdings screen is ever mounted, so a
 * literal is both safe and greppable.
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

/* ------------------------------------------------------------------- chips */

interface ActiveChip {
  /** Stable key, also the `data-filter` the delegated remove handler reads. */
  id: string;
  label: string;
  next: HoldingsFilterState;
}

export function HoldingsFilters({
  state,
  onChange,
  classOptions,
  regionOptions,
  currencyOptions,
  instruments,
  suggestions,
  matchCount,
  sortColumns,
  sortBy,
  onSortColumn,
  defaultTarget,
  onExport,
}: {
  state: HoldingsFilterState;
  onChange: (next: HoldingsFilterState) => void;
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
  onSortColumn: (key: string) => void;
  /** What the split button's default half exports — whichever view is showing. */
  defaultTarget: ExportTarget;
  onExport: (target: ExportTarget) => void;
}) {
  const t = useT();

  /* ------------------------------------------------------------- search */

  const searchRef = useRef<HTMLElement | null>(null);

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
  useCustomEvent<CustomEvent<{ value: string }>>(searchRef, 'mdSearch', (event) => {
    onChange({ ...state, search: event.detail.value });
  });

  const resultsRef = useRef<HTMLElement | null>(null);

  // The rows are `md-list-item type="button"`, so each one emits `mdClick` and
  // it bubbles: one delegated listener on the list covers every result.
  useCustomEvent<CustomEvent<{ item: HTMLElement }>>(resultsRef, 'mdClick', (event) => {
    const row = (event.target as HTMLElement | null)?.closest?.('md-list-item') as HTMLElement | null;
    const instrumentId = row?.dataset.instrument;
    if (!instrumentId) return;
    onChange({ ...state, instrumentId });
    void (searchRef.current as PopupElement | null)?.close?.();
  });

  /* -------------------------------------------------------- asset classes */

  // `value` is a `string[]` with no attribute form, so it is assigned to the
  // element rather than rendered. The dep is the joined array, not the array
  // itself, which is a new identity on every render.
  const classesRef = useElementProps<HTMLElement>({ value: state.assetClasses }, [
    state.assetClasses.join('|'),
  ]);

  useCustomEvent<CustomEvent<string[]>>(classesRef, 'mdChange', (event) => {
    onChange({ ...state, assetClasses: (event.detail ?? []) as AssetClass[] });
  });

  /* ------------------------------------------------------------ instrument */

  const instrumentRef = useRef<HTMLElement | null>(null);

  useCustomEvent<CustomEvent<string | string[]>>(instrumentRef, 'mdChange', (event) => {
    const value = Array.isArray(event.detail) ? event.detail[0] : event.detail;
    onChange({ ...state, instrumentId: value || null });
  });

  const picked = state.instrumentId
    ? instruments.find((instrument) => instrument.id === state.instrumentId)
    : undefined;

  /* ----------------------------------------------------------------- chips */

  const chips: ActiveChip[] = [];
  if (state.search) {
    // The label is the query itself: it is what the reader typed, and a
    // dictionary key would only ever describe it.
    chips.push({ id: 'search', label: state.search, next: { ...state, search: '' } });
  }
  for (const assetClass of state.assetClasses) {
    chips.push({
      id: `class:${assetClass}`,
      label: t(`wealth.assetClass.${assetClass}`),
      next: { ...state, assetClasses: state.assetClasses.filter((c) => c !== assetClass) },
    });
  }
  if (picked) {
    chips.push({ id: 'instrument', label: picked.ticker, next: { ...state, instrumentId: null } });
  }
  if (state.region) {
    chips.push({
      id: 'region',
      label: t(`wealth.region.${state.region}`),
      next: { ...state, region: null },
    });
  }
  if (state.currency) {
    // A currency code is a proper noun; there is no dictionary key for "EUR".
    chips.push({ id: 'currency', label: state.currency, next: { ...state, currency: null } });
  }

  // A real `<div>`, so the ref is typed as one — `MutableRefObject<HTMLElement>`
  // would not satisfy React's `Ref<HTMLDivElement>`.
  const chipsRef = useRef<HTMLDivElement | null>(null);

  /*
   * `preventDefault()` IS THE POINT.
   *
   * `mdRemove`'s default action is the chip removing ITSELF from the DOM — a
   * node React owns and will try to remove again on the next reconcile, which
   * throws. The manual names this exact case: cancel the default when the state
   * layer owns the list, and let the re-render drop the chip. `mdRemove`
   * bubbles, so one listener on the row covers every chip.
   */
  useCustomEvent<CustomEvent<void>>(chipsRef, 'mdRemove', (event) => {
    event.preventDefault();
    const chip = (event.target as HTMLElement | null)?.closest?.('md-chip') as HTMLElement | null;
    const id = chip?.dataset.filter;
    const match = chips.find((entry) => entry.id === id);
    if (match) onChange(match.next);
  });

  /*
   * "Clear filters" rides on the SAME container listener rather than a ref of
   * its own, and that is not tidiness — it is the only thing that works.
   * `useCustomEvent` binds once, in an effect keyed on the ref, so an element
   * that is not in the tree on the first render never gets a listener at all.
   * The row below is therefore always mounted (and merely `display: none` when
   * empty), and the button inside it is reached by delegation: `mdClick`
   * bubbles and is composed, and the chips are `selectable="false"`, so the
   * button is the only thing in here that can emit one.
   */
  useCustomEvent<CustomEvent<{ selected: boolean }>>(chipsRef, 'mdClick', (event) => {
    if ((event.target as HTMLElement | null)?.closest?.('md-button')) onChange(NO_FILTERS);
  });

  /* ----------------------------------------------------------------- menus */

  const splitRef = useRef<HTMLElement | null>(null);
  const exportMenuRef = useRef<HTMLElement | null>(null);
  const moreRef = useRef<HTMLElement | null>(null);
  const moreMenuRef = useRef<HTMLElement | null>(null);

  // The default half exports the view you are looking at; the menu is the same
  // verb applied to a different subject, which is what makes this a split
  // button rather than a button standing next to a menu.
  useCustomEvent<CustomEvent<void>>(splitRef, 'mdLeadingClick', () => onExport(defaultTarget));

  // The split button flips `trailing-checked` itself and reports the new state;
  // writing it back here would double-toggle it.
  useCustomEvent<CustomEvent<{ checked: boolean }>>(splitRef, 'mdTrailingClick', (event) => {
    const menu = exportMenuRef.current as PopupElement | null;
    void (event.detail.checked ? menu?.show?.() : menu?.close?.());
  });

  // …but the menu can also close by Escape, an outside click or a pick, and the
  // button cannot see any of those. `mdClose` neither bubbles nor crosses a
  // shadow boundary, so this listener has to sit on the menu itself.
  useCustomEvent<CustomEvent<void>>(exportMenuRef, 'mdClose', () => {
    const split = splitRef.current as PopupElement | null;
    if (split) split.trailingChecked = false;
  });

  useCustomEvent<CustomEvent<{ selected: boolean }>>(exportMenuRef, 'mdClick', (event) => {
    const item = (event.target as HTMLElement | null)?.closest?.('md-menu-item') as HTMLElement | null;
    const target = item?.dataset.export as ExportTarget | undefined;
    if (target) onExport(target);
  });

  useCustomEvent<CustomEvent<{ selected: boolean }>>(moreRef, 'mdClick', () => {
    void (moreMenuRef.current as PopupElement | null)?.show?.();
  });

  /*
   * One delegated listener for the whole overflow tree.
   *
   * `mdClick` bubbles out of the nested submenus too, so the rows carry
   * `data-*` rather than being told apart by position. A click on the
   * `md-sub-menu-item` row itself also lands here and carries no `data-action`,
   * which is exactly right: opening a branch is a hover / ArrowRight gesture,
   * not a command.
   */
  useCustomEvent<CustomEvent<{ selected: boolean }>>(moreMenuRef, 'mdClick', (event) => {
    const row = (event.target as HTMLElement | null)?.closest?.('md-menu-item') as HTMLElement | null;
    const action = row?.dataset.action;
    const value = row?.dataset.value ?? '';
    if (action === 'region') onChange({ ...state, region: (value || null) as Region | null });
    else if (action === 'currency') onChange({ ...state, currency: (value || null) as Currency | null });
    else if (action === 'sort') onSortColumn(value);
    else if (action === 'clear') onChange(NO_FILTERS);
  });

  return (
    <div className="stack">
      <div className="row">
        {/*
          A SEARCH SURFACE, not a text field with a magnifier.
          `md-search` earns its keep here because it has a results panel: the
          matches appear as you type and picking one narrows the table to that
          instrument. The query also drives the table itself, so the panel is a
          shortcut rather than the only way through.

          `full-width` zeroes the bar's side gutters; the min-inline-size
          override is what lets it shrink below the component's 360px default,
          which would otherwise overflow a 420px viewport.
        */}
        <md-search
          ref={searchRef}
          layout="docked"
          trigger="bar"
          variant="contained"
          full-width
          debounce="250"
          throttle="1000"
          value={state.search}
          placeholder={t('wealth.action.searchHoldings')}
          input-aria-label={t('wealth.action.searchHoldings')}
          results-label={t('wealth.common.showing', {
            shown: suggestions.length,
            total: matchCount,
          })}
          no-results-label={t('wealth.empty.search', { query: state.search })}
          style={
            {
              flex: '1 1 260px',
              '--md-search-container-min-inline-size': '240px',
              /*
               * A SHORT DRAWER, DELIBERATELY. The component's default cap is
               * `min(400px, 60vh)`, which on a desktop shows most of a filtered
               * book at once — a panel long enough to cover the table it is
               * filtering, so you lose sight of what the query is doing. Three
               * rows and a bit is enough to recognise a match or keep typing,
               * and the panel scrolls for the rest.
               */
              '--md-search-panel-max-block-size': '232px',
            } as CSSProperties
          }
        >
          <md-list ref={resultsRef} slot="results">
            {suggestions.map((position) => (
              <md-list-item
                key={position.id}
                type="button"
                data-instrument={position.instrumentId}
                overline={position.ticker}
                headline={position.instrumentName}
                supporting-text={t(position.assetClassKey)}
                lines="2"
              >
                <span slot="trailing-supporting-text">
                  <Money value={position.marketValueEur} compact />
                </span>
              </md-list-item>
            ))}
          </md-list>
        </md-search>

        {/*
          Several values from a closed list of five-ish — the multi-select row of
          §5.3. `display-mode="text"` rather than the default chips: the active
          filters already have a chip row below, and two sets of chips for one
          selection is two things to keep in step.
        */}
        <md-multi-select
          ref={classesRef}
          label={t('wealth.table.assetClass')}
          placeholder={t('wealth.common.all')}
          display-mode="text"
          no-options-text={t('wealth.empty.generic')}
          density="-2"
          style={{ flex: '0 1 220px', minInlineSize: '180px' } as CSSProperties}
        >
          {classOptions.map((option) => (
            <md-select-option
              key={option.assetClass}
              value={option.assetClass}
              label={t(option.assetClassKey)}
              /*
                `t.formatCurrency` rather than `<Money>`: `supporting-text` is a
                PROP, so it has to be a string and a component cannot render
                into it. This is the kit's locale-bound formatter, not a raw
                `Intl` call — the rule that stands is "never format a number
                yourself", and this does not.
              */
              supporting-text={t.formatCurrency(option.marketValue, {
                notation: 'compact',
                maximumFractionDigits: 1,
              })}
            />
          ))}
        </md-multi-select>

        {/*
          Type-to-find over forty instruments: `md-autocomplete`, not a select.
          The label carries the ticker AND the name so substring matching finds
          either, and the committed value is the instrument id the kit filters
          by.
        */}
        <md-autocomplete
          ref={instrumentRef}
          label={t('wealth.table.instrument')}
          variant="outlined"
          density="-2"
          value={state.instrumentId ?? ''}
          input-value={picked ? `${picked.ticker} · ${picked.name}` : ''}
          limit-results="8"
          /*
            Two different states, two different strings, as the manual asks: an
            empty universe would be "None", a query that matches nothing is
            "Nothing to show". The first is unreachable here — the option list
            is the whole instrument universe — but the pair is what stops one
            message from covering two situations.
          */
          no-options-text={t('wealth.common.none')}
          no-results-text={t('wealth.empty.generic')}
          /*
            `{count}` survives on purpose: the kit's translator leaves a token it
            was not given in place, and md-autocomplete substitutes it with the
            number of visible suggestions. So one existing key becomes
            "12 of 40" without inventing a dictionary entry.
          */
          status-template={t('wealth.common.of', { total: instruments.length })}
          style={{ flex: '1 1 240px', minInlineSize: '200px' } as CSSProperties}
        >
          {instruments.map((instrument) => (
            <md-select-option
              key={instrument.id}
              value={instrument.id}
              label={`${instrument.ticker} · ${instrument.name}`}
              supporting-text={t(instrument.assetClassKey)}
            />
          ))}
        </md-autocomplete>

        {/*
          Export: one default action plus variations of it. The leading half
          exports what is on screen; the menu picks a different dataset — the
          same verb, a different subject, which is what makes a split button
          rather than a button beside a menu.

          `menu-label` repeats the word "Export" because the dictionary has no
          "more export options" key and a screen may not add one to the kit; the
          trailing button is still distinguishable in the accessibility tree by
          its `aria-haspopup="menu"` and its live `aria-expanded`.
        */}
        <md-split-button
          ref={splitRef}
          id={EXPORT_TRIGGER}
          controls={EXPORT_MENU}
          variant="tonal"
          size="sm"
          icon="download"
          label={t('wealth.action.export')}
          menu-label={t('wealth.action.export')}
        />

        {/*
          The overflow trigger's name is composed from the two things behind it.
          "Screen actions" is already the shell toolbar's name and "Filter"
          alone would hide the sort group; two words joined by a separator stay
          translated and say what the menu holds.
        */}
        <md-icon-button
          ref={moreRef}
          id={MORE_TRIGGER}
          icon="more_vert"
          variant="standard"
          size="sm"
          aria-label={`${t('wealth.action.filter')} · ${t('wealth.action.sortBy')}`}
        />
      </div>

      {/*
        ALWAYS MOUNTED, hidden when there is nothing in it: the delegated
        `mdRemove` / `mdClick` listeners are bound to this node once, on mount.
        `display: none` rather than a conditional element keeps `.stack`'s gap
        from leaving a hole above the tabs when no filter is on.
        The group role is dropped while it is empty — an empty labelled group is
        noise in the accessibility tree.
      */}
      {/*
        THE ROW HOLDS ITS HEIGHT WHETHER OR NOT ANYTHING IS IN IT.
        `display: none` when empty meant the first filter you picked inserted a
        row and pushed the tabs and the whole table down — the table moving as a
        side effect of filtering it. The row now always occupies its own height
        and only its CONTENTS come and go, so selecting and clearing filters
        leaves everything below exactly where it was.
        `min-block-size` rather than a fixed height: a long chip set that wraps
        to two lines still grows, which is a change the reader caused directly.
      */}
      <div
        ref={chipsRef}
        className="row"
        role={chips.length ? 'group' : undefined}
        aria-label={chips.length ? t('wealth.action.filter') : undefined}
        aria-hidden={chips.length ? undefined : true}
        /*
          THE RESERVATION IS ONE CHIP TALL, NOT 40px.
          The row is empty until a filter is picked, so whatever is reserved
          here is empty space between the fields and the table on first
          arrival — 40px was 8px more than the 32px chip it is holding room
          for, and every one of those pixels pushed the table down for nothing.
          It still reserves, because a row that appears on first selection
          shoves the whole table down as you use it, which is the thing this
          exists to prevent.
        */
        style={{ minBlockSize: '32px', alignItems: 'center' }}
      >
        {chips.map((chip) => (
          /*
            `variant="input"` with `selectable="false"`: a token whose only
            action is its ✕. The chip's own accessible name for that button is
            generated as "Remove {label}", so the row needs no extra wiring.
          */
          <md-chip
            key={chip.id}
            data-filter={chip.id}
            variant="input"
            appearance="outlined"
            selectable="false"
            removable
            label={chip.label}
          />
        ))}
        {chips.length ? (
          <md-button variant="text" size="xs" icon="filter_alt_off">
            {t('wealth.action.clearFilters')}
          </md-button>
        ) : null}
      </div>

      {/* --------------------------------------------------------- menus --- */}

      {/*
        Never rendered `open`: md-menu wires positioning and dismissal from the
        `open` CHANGE handler, and an attribute that is already there at first
        paint never fires it. Both menus are opened by a method call instead.

        `variant="vibrant"` on every menu surface in this app, submenus
        included. The default is `baseline` — square corners on a surface
        container; `vibrant` is the M3 Expressive vertical menu, 16px corners on
        tertiary-based colour. A submenu does NOT inherit the parent's variant,
        because it is its own `md-menu` element, so each one carries it.
      */}
      <md-menu
        ref={exportMenuRef}
        id={EXPORT_MENU}
        anchor={EXPORT_TRIGGER}
        placement="bottom-end"
        variant="vibrant"
      >
        <md-menu-item data-export="holdings" headline={t('wealth.panel.holdings')} />
        <md-menu-item data-export="instruments" headline={t('wealth.panel.universe')} />
        <md-menu-item data-export="concentration" headline={t('wealth.panel.concentration')} />
      </md-menu>

      <md-menu
        ref={moreMenuRef}
        id={MORE_MENU}
        anchor={MORE_TRIGGER}
        placement="bottom-end"
        variant="vibrant"
      >
        <md-menu-item-group label={t('wealth.action.filter')}>
          {/*
            EACH BRANCH CARRIES ITS OWN GROUP. `md-menu-item` resolves radio
            exclusivity with `closest('md-menu-item-group')`, and a row inside a
            submenu is still a DOM descendant of the OUTER group — so without an
            inner group, picking a region would silently clear the currency.
          */}
          <md-sub-menu-item headline={t('wealth.table.region')}>
            <md-menu slot="submenu" variant="vibrant">
              <md-menu-item-group label={t('wealth.table.region')}>
                <md-menu-item
                  data-action="region"
                  data-value=""
                  type="radio"
                  selected={!state.region || undefined}
                  headline={t('wealth.common.all')}
                />
                {regionOptions.map((option) => (
                  <md-menu-item
                    key={option.region}
                    data-action="region"
                    data-value={option.region}
                    type="radio"
                    selected={state.region === option.region || undefined}
                    headline={t(option.regionKey)}
                    trailing-text={String(option.positionCount)}
                  />
                ))}
              </md-menu-item-group>
            </md-menu>
          </md-sub-menu-item>

          <md-sub-menu-item headline={t('wealth.table.currency')} divider>
            <md-menu slot="submenu" variant="vibrant">
              <md-menu-item-group label={t('wealth.table.currency')}>
                <md-menu-item
                  data-action="currency"
                  data-value=""
                  type="radio"
                  selected={!state.currency || undefined}
                  headline={t('wealth.common.all')}
                />
                {currencyOptions.map((option) => (
                  <md-menu-item
                    key={option.currency}
                    data-action="currency"
                    data-value={option.currency}
                    type="radio"
                    selected={state.currency === option.currency || undefined}
                    headline={option.currency}
                    trailing-text={String(option.positionCount)}
                  />
                ))}
              </md-menu-item-group>
            </md-menu>
          </md-sub-menu-item>

          <md-menu-item
            data-action="clear"
            headline={t('wealth.action.clearFilters')}
            disabled={!isFiltered(state) || undefined}
          />
        </md-menu-item-group>

        {/*
          The sort group mirrors whichever table is on screen — its rows are the
          same column keys the sort labels emit, so the menu and the headers can
          never disagree about what is sortable.
        */}
        <md-menu-item-group label={t('wealth.action.sortBy')}>
          {sortColumns.map((column) => (
            <md-menu-item
              key={column.key}
              data-action="sort"
              data-value={column.key}
              type="radio"
              selected={sortBy === column.key || undefined}
              headline={column.label}
            />
          ))}
        </md-menu-item-group>
      </md-menu>
    </div>
  );
}
