import {
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild,
} from '@angular/core';
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
import { ShowcaseComponent } from '../lib/screen.base';
import { MoneyComponent } from '../components/bits.component';

/**
 * The filter bar above the holdings tables, and the two menus that hang off it.
 *
 * IT OWNS NO STATE. Every control here is driven by the `state` input and
 * reports a whole new `HoldingsFilterState` through `stateChange`; the screen
 * holds it and re-reads the rows from the kit's selectors. That is what makes
 * the filters REAL — there is exactly one place where a filter becomes a row
 * set, and it is `getPositions()` / `getInstruments()`, not a `.filter()` in a
 * component.
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
 * the choices stay put as you filter instead of disappearing under you.
 */

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
    state.search ||
      state.assetClasses.length ||
      state.instrumentId ||
      state.region ||
      state.currency,
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

/** The `md-menu` / `md-search` methods used here. All of them are async. */
type PopupElement = HTMLElement & {
  show?: (options?: unknown) => Promise<void>;
  close?: () => Promise<void>;
  trailingChecked?: boolean;
};

interface ActiveChip {
  /** Stable key, also the `data-filter` the delegated remove handler reads. */
  id: string;
  label: string;
  next: HoldingsFilterState;
}

/*
 * Element ids, written out rather than generated.
 *
 * `md-menu` resolves `anchor` with `getElementById`, so the trigger needs a
 * stable id in the document. Exactly one holdings screen is ever mounted, so a
 * literal is both safe and greppable. They appear verbatim in the template:
 * wealth-holdings-export / wealth-holdings-export-menu / wealth-holdings-more /
 * wealth-holdings-more-menu.
 */

@Component({
  selector: 'awc-holdings-filters',
  standalone: true,
  styles: ':host { display: contents; }',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [MoneyComponent],
  template: `
    <div class="stack">
      <div class="row">
        <!--
          A SEARCH SURFACE, not a text field with a magnifier. md-search earns
          its keep here because it has a results panel: the matches appear as
          you type and picking one narrows the table to that instrument. The
          query also drives the table itself, so the panel is a shortcut rather
          than the only way through.

          mdSearch, AND ONLY mdSearch. mdInput fires on every keystroke,
          mdSubmit on Enter and mdChange on a changed blur; binding more than
          one of them to the same query runs it up to four times per typing
          burst. mdSearch is the debounced, trimmed, de-duplicated one, and both
          Enter and the clear button flush it — so clearing the field delivers
          an empty query immediately and needs no separate mdClear handler.

          full-width zeroes the bar's side gutters; the min-inline-size override
          is what lets it shrink below the component's 360px default. The short
          panel cap is deliberate: the default min(400px, 60vh) drawer is long
          enough to cover the table it is filtering.
        -->
        <md-search
          #search
          layout="docked"
          trigger="bar"
          variant="contained"
          full-width
          debounce="250"
          throttle="1000"
          [attr.value]="state.search"
          [attr.placeholder]="t('wealth.action.searchHoldings')"
          [attr.input-aria-label]="t('wealth.action.searchHoldings')"
          [attr.results-label]="
            t('wealth.common.showing', { shown: suggestions.length, total: matchCount })
          "
          [attr.no-results-label]="t('wealth.empty.search', { query: state.search })"
          style="flex: 1 1 260px; --md-search-container-min-inline-size: 240px; --md-search-panel-max-block-size: 232px"
          (mdSearch)="onSearch($event)"
        >
          <!-- The rows are md-list-item type="button", so each one emits
               mdClick and it bubbles: one delegated listener on the list
               covers every result. -->
          <md-list slot="results" (mdClick)="onResultClick($event)">
            @for (position of suggestions; track position.id) {
              <md-list-item
                type="button"
                [attr.data-instrument]="position.instrumentId"
                [attr.overline]="position.ticker"
                [attr.headline]="position.instrumentName"
                [attr.supporting-text]="t(position.assetClassKey)"
                lines="2"
              >
                <span slot="trailing-supporting-text">
                  <span awcMoney [value]="position.marketValueEur" [compact]="true"></span>
                </span>
              </md-list-item>
            }
          </md-list>
        </md-search>

        <!--
          Several values from a closed list of five-ish — the multi-select.
          display-mode="text" rather than the default chips: the active filters
          already have a chip row below, and two sets of chips for one
          selection is two things to keep in step. "value" is a string[] with
          no attribute form, so it is a PROPERTY binding — classesValue keeps
          a stable array reference so the element is not re-assigned on every
          change-detection pass.
        -->
        <md-multi-select
          [value]="classesValue"
          [attr.label]="t('wealth.table.assetClass')"
          [attr.placeholder]="t('wealth.common.all')"
          display-mode="text"
          [attr.no-options-text]="t('wealth.empty.generic')"
          density="-2"
          style="flex: 0 1 220px; min-inline-size: 180px"
          (mdChange)="onClasses($event)"
        >
          @for (option of classOptions; track option.assetClass) {
            <!-- t.formatCurrency rather than span[awcMoney]: supporting-text
                 is a PROP, so it has to be a string and a component cannot
                 render into it. Still the kit's locale-bound formatter. -->
            <md-select-option
              [attr.value]="option.assetClass"
              [attr.label]="t(option.assetClassKey)"
              [attr.supporting-text]="
                t.formatCurrency(option.marketValue, {
                  notation: 'compact',
                  maximumFractionDigits: 1
                })
              "
            ></md-select-option>
          }
        </md-multi-select>

        <!--
          Type-to-find over forty instruments: md-autocomplete, not a select.
          The label carries the ticker AND the name so substring matching finds
          either, and the committed value is the instrument id the kit filters
          by. status-template's {count} survives on purpose: the translator
          leaves a token it was not given in place, and md-autocomplete
          substitutes it with the number of visible suggestions.
        -->
        <md-autocomplete
          [attr.label]="t('wealth.table.instrument')"
          variant="outlined"
          density="-2"
          [attr.value]="state.instrumentId ?? ''"
          [attr.input-value]="picked ? picked.ticker + ' · ' + picked.name : ''"
          limit-results="8"
          [attr.no-options-text]="t('wealth.common.none')"
          [attr.no-results-text]="t('wealth.empty.generic')"
          [attr.status-template]="t('wealth.common.of', { total: instruments.length })"
          style="flex: 1 1 240px; min-inline-size: 200px"
          (mdChange)="onInstrument($event)"
        >
          @for (instrument of instruments; track instrument.id) {
            <md-select-option
              [attr.value]="instrument.id"
              [attr.label]="instrument.ticker + ' · ' + instrument.name"
              [attr.supporting-text]="t(instrument.assetClassKey)"
            ></md-select-option>
          }
        </md-autocomplete>

        <!--
          Export: one default action plus variations of it. The leading half
          exports what is on screen; the menu picks a different dataset — the
          same verb, a different subject, which is what makes a split button
          rather than a button beside a menu. menu-label repeats "Export"
          because the dictionary has no "more export options" key and a screen
          may not add one to the kit.

          The split button flips trailing-checked itself and reports the new
          state; writing it back here would double-toggle it. The mdClose
          mirror below covers Escape, an outside click and a pick.
        -->
        <md-split-button
          #split
          id="wealth-holdings-export"
          controls="wealth-holdings-export-menu"
          variant="tonal"
          size="sm"
          icon="download"
          [attr.label]="t('wealth.action.export')"
          [attr.menu-label]="t('wealth.action.export')"
          (mdLeadingClick)="exportPick.emit(defaultTarget)"
          (mdTrailingClick)="onTrailing($event)"
        ></md-split-button>

        <!--
          The overflow trigger's name is composed from the two things behind
          it: "Screen actions" is already the shell toolbar's name and
          "Filter" alone would hide the sort group.
        -->
        <md-icon-button
          id="wealth-holdings-more"
          icon="more_vert"
          variant="standard"
          size="sm"
          [attr.aria-label]="t('wealth.action.filter') + ' · ' + t('wealth.action.sortBy')"
          (mdClick)="onMoreOpen()"
        ></md-icon-button>
      </div>

      <!--
        THE ROW HOLDS ITS HEIGHT WHETHER OR NOT ANYTHING IS IN IT. A row that
        comes and goes would push the tabs and the whole table down the first
        time a filter is picked — the table moving as a side effect of
        filtering it. Only its CONTENTS come and go. min-block-size rather
        than a fixed height: a long chip set that wraps to two lines still
        grows, which is a change the reader caused directly. The group role is
        dropped while it is empty — an empty labelled group is noise in the
        accessibility tree.

        preventDefault() ON mdRemove IS THE POINT: the event's default action
        is the chip removing ITSELF from the DOM — a node Angular owns and
        would try to remove again on the next render. Cancel the default and
        let the state change drop the chip. mdRemove and mdClick both bubble,
        so one listener each on the row covers every chip and the clear
        button (the chips are selectable="false", so the button is the only
        thing in here that can emit an mdClick).
      -->
      <div
        class="row"
        [attr.role]="chips.length ? 'group' : null"
        [attr.aria-label]="chips.length ? t('wealth.action.filter') : null"
        [attr.aria-hidden]="chips.length ? null : 'true'"
        style="min-block-size: 32px; align-items: center"
        (mdRemove)="onChipRemove($event)"
        (mdClick)="onChipsRowClick($event)"
      >
        @for (chip of chips; track chip.id) {
          <!-- variant="input" with selectable="false": a token whose only
               action is its ✕. The chip's own accessible name for that button
               is generated as "Remove {label}". -->
          <md-chip
            [attr.data-filter]="chip.id"
            variant="input"
            appearance="outlined"
            selectable="false"
            removable
            [attr.label]="chip.label"
          ></md-chip>
        }
        @if (chips.length) {
          <md-button variant="text" size="xs" icon="filter_alt_off">
            {{ t('wealth.action.clearFilters') }}
          </md-button>
        }
      </div>

      <!--
        Never rendered "open": md-menu wires positioning and dismissal from the
        "open" CHANGE handler, and an attribute that is already there at first
        paint never fires it. Both menus are opened by a method call instead.

        variant="vibrant" on every menu surface, submenus included — a submenu
        does NOT inherit the parent's variant, because it is its own md-menu
        element, so each one carries it.
      -->
      <md-menu
        #exportMenu
        id="wealth-holdings-export-menu"
        anchor="wealth-holdings-export"
        placement="bottom-end"
        variant="vibrant"
        (mdClose)="onExportMenuClose()"
        (mdClick)="onExportPick($event)"
      >
        <md-menu-item data-export="holdings" [attr.headline]="t('wealth.panel.holdings')"></md-menu-item>
        <md-menu-item data-export="instruments" [attr.headline]="t('wealth.panel.universe')"></md-menu-item>
        <md-menu-item
          data-export="concentration"
          [attr.headline]="t('wealth.panel.concentration')"
        ></md-menu-item>
      </md-menu>

      <!--
        One delegated listener for the whole overflow tree: mdClick bubbles out
        of the nested submenus too, so the rows carry data-* rather than being
        told apart by position. A click on the md-sub-menu-item row itself also
        lands in the handler and carries no data-action, which is exactly
        right: opening a branch is a hover / ArrowRight gesture, not a command.

        EACH BRANCH CARRIES ITS OWN GROUP. md-menu-item resolves radio
        exclusivity with closest('md-menu-item-group'), and a row inside a
        submenu is still a DOM descendant of the OUTER group — so without an
        inner group, picking a region would silently clear the currency.
      -->
      <md-menu
        #moreMenu
        id="wealth-holdings-more-menu"
        anchor="wealth-holdings-more"
        placement="bottom-end"
        variant="vibrant"
        (mdClick)="onMorePick($event)"
      >
        <md-menu-item-group [attr.label]="t('wealth.action.filter')">
          <md-sub-menu-item [attr.headline]="t('wealth.table.region')">
            <md-menu slot="submenu" variant="vibrant">
              <md-menu-item-group [attr.label]="t('wealth.table.region')">
                <md-menu-item
                  data-action="region"
                  data-value=""
                  type="radio"
                  [attr.selected]="!state.region ? '' : null"
                  [attr.headline]="t('wealth.common.all')"
                ></md-menu-item>
                @for (option of regionOptions; track option.region) {
                  <md-menu-item
                    data-action="region"
                    [attr.data-value]="option.region"
                    type="radio"
                    [attr.selected]="state.region === option.region ? '' : null"
                    [attr.headline]="t(option.regionKey)"
                    [attr.trailing-text]="option.positionCount"
                  ></md-menu-item>
                }
              </md-menu-item-group>
            </md-menu>
          </md-sub-menu-item>

          <md-sub-menu-item [attr.headline]="t('wealth.table.currency')" divider>
            <md-menu slot="submenu" variant="vibrant">
              <md-menu-item-group [attr.label]="t('wealth.table.currency')">
                <md-menu-item
                  data-action="currency"
                  data-value=""
                  type="radio"
                  [attr.selected]="!state.currency ? '' : null"
                  [attr.headline]="t('wealth.common.all')"
                ></md-menu-item>
                @for (option of currencyOptions; track option.currency) {
                  <md-menu-item
                    data-action="currency"
                    [attr.data-value]="option.currency"
                    type="radio"
                    [attr.selected]="state.currency === option.currency ? '' : null"
                    [attr.headline]="option.currency"
                    [attr.trailing-text]="option.positionCount"
                  ></md-menu-item>
                }
              </md-menu-item-group>
            </md-menu>
          </md-sub-menu-item>

          <md-menu-item
            data-action="clear"
            [attr.headline]="t('wealth.action.clearFilters')"
            [attr.disabled]="filtered ? null : ''"
          ></md-menu-item>
        </md-menu-item-group>

        <!--
          The sort group mirrors whichever table is on screen — its rows are
          the same column keys the sort labels emit, so the menu and the
          headers can never disagree about what is sortable.
        -->
        <md-menu-item-group [attr.label]="t('wealth.action.sortBy')">
          @for (column of sortColumns; track column.key) {
            <md-menu-item
              data-action="sort"
              [attr.data-value]="column.key"
              type="radio"
              [attr.selected]="sortBy === column.key ? '' : null"
              [attr.headline]="column.label"
            ></md-menu-item>
          }
        </md-menu-item-group>
      </md-menu>
    </div>
  `,
})
export class HoldingsFiltersComponent extends ShowcaseComponent {
  @Input({ required: true }) state!: HoldingsFilterState;
  /** Book-wide roll-ups — the option lists. Never recomputed from the filtered set. */
  @Input({ required: true }) classOptions!: ClassTotal[];
  @Input({ required: true }) regionOptions!: RegionTotal[];
  @Input({ required: true }) currencyOptions!: CurrencyExposure[];
  /** The whole instrument universe, for the lookup field. */
  @Input({ required: true }) instruments!: Instrument[];
  /** The first few matching positions, for the search panel. */
  @Input({ required: true }) suggestions!: Position[];
  /** How many rows the current filters match, for the search announcement. */
  @Input({ required: true }) matchCount!: number;
  /** The sortable columns of whichever table is showing. */
  @Input({ required: true }) sortColumns!: SortSpec[];
  @Input({ required: true }) sortBy!: string;
  /** What the split button's default half exports — whichever view is showing. */
  @Input({ required: true }) defaultTarget!: ExportTarget;

  @Output() readonly stateChange = new EventEmitter<HoldingsFilterState>();
  @Output() readonly sortPick = new EventEmitter<string>();
  @Output() readonly exportPick = new EventEmitter<ExportTarget>();

  @ViewChild('search') private searchEl?: ElementRef<HTMLElement>;
  @ViewChild('split') private splitEl?: ElementRef<HTMLElement>;
  @ViewChild('exportMenu') private exportMenuEl?: ElementRef<HTMLElement>;
  @ViewChild('moreMenu') private moreMenuEl?: ElementRef<HTMLElement>;

  /* ------------------------------------------------------------- search */

  protected onSearch(event: Event): void {
    const { value } = (event as CustomEvent<{ value: string }>).detail;
    this.stateChange.emit({ ...this.state, search: value });
  }

  protected onResultClick(event: Event): void {
    const row = (event.target as HTMLElement | null)?.closest?.(
      'md-list-item',
    ) as HTMLElement | null;
    const instrumentId = row?.dataset.instrument;
    if (!instrumentId) return;
    this.stateChange.emit({ ...this.state, instrumentId });
    void (this.searchEl?.nativeElement as PopupElement | undefined)?.close?.();
  }

  /* -------------------------------------------------------- asset classes */

  // `value` is a property binding, dirty-checked by REFERENCE — hand back the
  // same array until the selection actually changes, or the element is
  // re-assigned on every change-detection pass.
  private classesKey = '';
  private classesCache: AssetClass[] = [];

  protected get classesValue(): AssetClass[] {
    const key = this.state.assetClasses.join('|');
    if (key !== this.classesKey) {
      this.classesKey = key;
      this.classesCache = [...this.state.assetClasses];
    }
    return this.classesCache;
  }

  protected onClasses(event: Event): void {
    const detail = (event as CustomEvent<string[]>).detail;
    this.stateChange.emit({ ...this.state, assetClasses: (detail ?? []) as AssetClass[] });
  }

  /* ------------------------------------------------------------ instrument */

  protected onInstrument(event: Event): void {
    const detail = (event as CustomEvent<string | string[]>).detail;
    const value = Array.isArray(detail) ? detail[0] : detail;
    this.stateChange.emit({ ...this.state, instrumentId: value || null });
  }

  protected get picked(): Instrument | undefined {
    return this.state.instrumentId
      ? this.instruments.find((instrument) => instrument.id === this.state.instrumentId)
      : undefined;
  }

  /* ----------------------------------------------------------------- chips */

  protected get filtered(): boolean {
    return isFiltered(this.state);
  }

  protected get chips(): ActiveChip[] {
    const state = this.state;
    const chips: ActiveChip[] = [];
    if (state.search) {
      // The label is the query itself: it is what the reader typed, and a
      // dictionary key would only ever describe it.
      chips.push({ id: 'search', label: state.search, next: { ...state, search: '' } });
    }
    for (const assetClass of state.assetClasses) {
      chips.push({
        id: `class:${assetClass}`,
        label: this.t(`wealth.assetClass.${assetClass}`),
        next: { ...state, assetClasses: state.assetClasses.filter((c) => c !== assetClass) },
      });
    }
    const picked = this.picked;
    if (picked) {
      chips.push({ id: 'instrument', label: picked.ticker, next: { ...state, instrumentId: null } });
    }
    if (state.region) {
      chips.push({
        id: 'region',
        label: this.t(`wealth.region.${state.region}`),
        next: { ...state, region: null },
      });
    }
    if (state.currency) {
      // A currency code is a proper noun; there is no dictionary key for "EUR".
      chips.push({ id: 'currency', label: state.currency, next: { ...state, currency: null } });
    }
    return chips;
  }

  protected onChipRemove(event: Event): void {
    event.preventDefault();
    const chip = (event.target as HTMLElement | null)?.closest?.('md-chip') as HTMLElement | null;
    const id = chip?.dataset.filter;
    const match = this.chips.find((entry) => entry.id === id);
    if (match) this.stateChange.emit(match.next);
  }

  protected onChipsRowClick(event: Event): void {
    if ((event.target as HTMLElement | null)?.closest?.('md-button')) {
      this.stateChange.emit(NO_FILTERS);
    }
  }

  /* ----------------------------------------------------------------- menus */

  protected onTrailing(event: Event): void {
    const { checked } = (event as CustomEvent<{ checked: boolean }>).detail;
    const menu = this.exportMenuEl?.nativeElement as PopupElement | undefined;
    void (checked ? menu?.show?.() : menu?.close?.());
  }

  // The menu can close by Escape, an outside click or a pick, and the button
  // cannot see any of those. mdClose neither bubbles nor crosses a shadow
  // boundary, so the listener sits on the menu itself and mirrors the state
  // back into the button as a property write.
  protected onExportMenuClose(): void {
    const split = this.splitEl?.nativeElement as PopupElement | undefined;
    if (split) split.trailingChecked = false;
  }

  protected onExportPick(event: Event): void {
    const item = (event.target as HTMLElement | null)?.closest?.(
      'md-menu-item',
    ) as HTMLElement | null;
    const target = item?.dataset.export as ExportTarget | undefined;
    if (target) this.exportPick.emit(target);
  }

  protected onMoreOpen(): void {
    void (this.moreMenuEl?.nativeElement as PopupElement | undefined)?.show?.();
  }

  protected onMorePick(event: Event): void {
    const row = (event.target as HTMLElement | null)?.closest?.(
      'md-menu-item',
    ) as HTMLElement | null;
    const action = row?.dataset.action;
    const value = row?.dataset.value ?? '';
    if (action === 'region') {
      this.stateChange.emit({ ...this.state, region: (value || null) as Region | null });
    } else if (action === 'currency') {
      this.stateChange.emit({ ...this.state, currency: (value || null) as Currency | null });
    } else if (action === 'sort') {
      this.sortPick.emit(value);
    } else if (action === 'clear') {
      this.stateChange.emit(NO_FILTERS);
    }
  }
}
