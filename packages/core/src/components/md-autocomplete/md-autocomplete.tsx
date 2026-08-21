import { AttachInternals, Component, Element, Event, EventEmitter, Host, Listen, Method, Prop, State, Watch, forceUpdate, h } from '@stencil/core';
import { LazyLoadingIndicator } from '../../utils/lazy-loading-indicator';
import { setFormValue, checkValidityOf, reportValidityOf, getValidityOf } from '../../utils/form';
import {
  collectOptions,
  SelectOptionData,
  SelectOptionInit,
  OptionRowSource,
} from '../../utils/select-options';
import { VirtualSelectController } from '../../utils/virtual-select-controller';
import { isWasmSupported, FilterMode } from '../../utils/wasm-option-store';

let autocompleteIdCounter = 0;

/** Above this many options, `virtualize="auto"` switches to the WASM path. */
const VIRTUALIZE_THRESHOLD = 200;

/** Idle time after a keystroke before the virtualized query runs (debounce). */
const SEARCH_DEBOUNCE_MS = 200;

/**
 * Programmatic option entry. Extends the shared select model with a
 * legacy `description` alias for `supportingText`.
 */
export interface MdAutocompleteOption extends SelectOptionInit {
  /** @deprecated Use `supportingText`. */
  description?: string;
}

interface VirtualMenuEl extends HTMLElement {
  show?: (opts?: { autoFocus?: boolean }) => Promise<void>;
  close?: () => Promise<void>;
  setVirtualProvider?: (p: unknown | null) => Promise<void>;
  getScrollViewport?: () => Promise<HTMLElement | null>;
}

/**
 * `md-autocomplete` — Material Design 3 combobox: a text field that filters
 * a dropdown listbox **as you type in the input** (no separate search row),
 * with single or multiple (chips) selection.
 *
 * Built from the same primitives as `md-select` / `md-multi-select`:
 *   - the shared option model (`options` array of `{ value, label,
 *     supportingText?, icon?, iconColor?, disabled? }` or slotted
 *     `<md-select-option>` children),
 *   - `md-text-field` for the trigger (typing filters live),
 *   - `md-menu` as a WAI-ARIA listbox popup (options carry `aria-selected`),
 *   - `VirtualSelectController` for WASM-virtualized huge datasets
 *     (`virtualize`, `loadOptions()`, `filter-mode`) — the same engine as
 *     the selects, so tens of thousands of rows filter smoothly.
 *
 * Keyboard: typing filters; ArrowDown moves focus into the listbox (the
 * focus-moves-into-popup combobox variant — option focus is announced
 * directly); Enter selects; Escape closes back to the input; Backspace on an
 * empty multi input removes the last chip.
 *
 * ARIA: the real textbox — the `<input>` inside md-text-field's shadow root —
 * is promoted to `role="combobox"` with `aria-expanded` / `aria-autocomplete`
 * (handed over via `input-role`, since only that component renders the input),
 * and points at this component's listbox through ARIA element reflection. An
 * IDREF could not: it would have to resolve inside md-text-field's tree, where
 * the listbox is not. See `syncComboboxRefs`.
 *
 * Extras kept from the surface this API mirrors: `free-solo` (commit arbitrary text),
 * `max-selected`, `clearable`, `disable-close-on-select`, `clear-on-blur`,
 * a custom `filterer` and `limit-results` (client-side path only).
 */
@Component({
  tag: 'md-autocomplete',
  styleUrl: 'md-autocomplete.css',
  shadow: true,
  formAssociated: true,
})
export class MdAutocomplete {
  @Element() el!: HTMLElement;


  /**
   * Localized constraint-validation message shown when `required` is unmet.
   * `errorText` still wins when set, so an app-supplied inline message and the
   * native bubble stay in agreement.
   */
  @Prop({ attribute: 'value-missing-label' }) valueMissingLabel: string = 'Please make a selection';


  /**
   * Always occupy the supporting-text line, even when there is no message, so a
   * validation error does not push the content below it down. Forwarded to the
   * embedded md-text-field. See that component for why it is opt-in.
   */
  @Prop({ attribute: 'reserve-supporting-space' }) reserveSupportingSpace: boolean = false;

  /** Message set via setCustomValidity(); non-empty wins over valueMissing. */
  private customValidityMessage = '';

  /**
   * Form-association handle. The selection is submitted under the host's
   * `name` via `setFormValue` (a single string, or repeated pairs when
   * `multiple`), so the control participates in `<form>`/`FormData` natively.
   */
  @AttachInternals() internals!: ElementInternals;

  /** Visual variant of the inner text-field. */
  @Prop({ reflect: true }) variant: 'filled' | 'outlined' = 'filled';

  /** Floating label / accessible name. */
  @Prop() label: string = '';

  /** Placeholder for the input. */
  @Prop() placeholder: string = '';

  /** Supporting / helper text below the field. */
  @Prop({ attribute: 'supporting-text' }) supportingText: string = '';

  /** Error state — forwarded to the text-field. */
  @Prop({ reflect: true }) error: boolean = false;

  /** Error text rendered in place of supporting text when `error` is true. */
  @Prop({ attribute: 'error-text' }) errorText: string = '';

  /** Disabled — non-interactive. */
  @Prop({ reflect: true }) disabled: boolean = false;

  /** Soft-disabled — focusable but non-interactive. */
  @Prop({ reflect: true, attribute: 'soft-disabled' }) softDisabled: boolean = false;

  /** Required for native form parity. */
  @Prop({ reflect: true }) required: boolean = false;

  /** Density forwarded to the text-field. */
  @Prop({ reflect: true }) density: 0 | -1 | -2 | -3 | -4 = 0;

  /**
   * Programmatic options (shared select model; `description` is accepted as
   * a legacy alias for `supportingText`). Slotted `<md-select-option>`
   * children take precedence when present.
   *
   * Accepts either the array (property) or a **JSON string** (attribute), the
   * same contract `md-organization-chart.nodes` uses — so a plain-HTML page can
   * declare its dataset inline instead of reaching for a script:
   *
   *     <md-autocomplete options='[{"value":"a","label":"Apple"}]'></md-autocomplete>
   *
   * Malformed JSON degrades to an empty list rather than throwing: a broken
   * attribute must not take the whole field down.
   */
  @Prop() options: MdAutocompleteOption[] | string = [];

  /** Multi-select mode — the selection renders as removable chips. */
  @Prop({ reflect: true }) multiple: boolean = false;

  /** Where the selection chips live (`multiple` only): around the field
   *  (`'below'` default, `'top'`, `'left'`, `'right'`) or `'inline'` inside
   *  it, before the input, wrapping onto new rows as the selection grows
   *  (the field grows with them). */
  @Prop({ attribute: 'chip-position', reflect: true }) chipPosition:
    | 'below'
    | 'top'
    | 'left'
    | 'right'
    | 'inline' = 'below';

  /**
   * Single-mode value — option `value` or free-solo string.
   * Multi-mode value — array of option `value`s.
   */
  @Prop({ mutable: true }) value: string | string[] = '';

  /** Live text of the input (separate from `value` so typing never commits). */
  @Prop({ mutable: true, attribute: 'input-value' }) inputValue: string = '';

  /** Allow committing arbitrary text (not just options) with Enter. */
  @Prop({ reflect: true, attribute: 'free-solo' }) freeSolo: boolean = false;

  /** When `multiple`, the max number of selected items (`0` = no limit). */
  @Prop({ attribute: 'max-selected' }) maxSelected: number = 0;

  /** Busy state: progress bar in the menu while an async dataset loads. */
  @Prop({ reflect: true }) loading: boolean = false;

  /** Empty-state text when the dataset has no options at all. */
  @Prop({ attribute: 'no-options-text' }) noOptionsText: string = 'No options';

  /** Empty-state text when the typed filter matches nothing. */
  @Prop({ attribute: 'no-results-text' }) noResultsText: string = 'No results';

  /** Text shown while `loading` is true. */
  @Prop({ attribute: 'loading-text' }) loadingText: string = 'Loading…';

  /** Template for the polite screen-reader status while the popup is open
   *  (localisable). `{count}` is replaced with the visible option count. */
  @Prop({ attribute: 'status-template' }) statusTemplate: string = '{count} suggestions available';

  /**
   * Keep the menu open after a selection in **single** mode.
   *
   * `multiple` already stays open — picking several in a row is the point, and
   * it dismisses on an outside click, on the trigger, or on Escape. This prop
   * gives a single-select the same stickiness when a picker is being used to
   * scan rather than to commit.
   */
  @Prop({ attribute: 'disable-close-on-select', reflect: true }) disableCloseOnSelect: boolean = false;

  /** Clear a non-matching input on blur (strict single mode only). */
  @Prop({ attribute: 'clear-on-blur', reflect: true }) clearOnBlur: boolean = false;

  /** Show a clear (×) button on the trailing edge. */
  @Prop({ reflect: true }) clearable: boolean = true;

  /** Material Symbols glyph for the clear button. */
  @Prop({ attribute: 'clear-icon' }) clearIcon: string = 'close';

  /** Caret glyph; rotates 180° when open (matches md-select). Slot
   *  `dropdown-icon` overrides it. */
  @Prop({ attribute: 'dropdown-icon' }) dropdownIcon: string = 'arrow_drop_down';

  /** Max items shown in the dropdown (`0` = unlimited; client-side path only). */
  @Prop({ attribute: 'limit-results' }) limitResults: number = 0;

  /** Open state. */
  @Prop({ mutable: true, reflect: true }) open: boolean = false;

  /**
   * Custom client-side filter (ignored while virtualized — the WASM engine
   * filters by `filter-mode` instead).
   */
  @Prop() filterer?: (
    options: SelectOptionData[],
    state: { inputValue: string; selected: string[] },
  ) => SelectOptionData[];

  /**
   * Virtualization strategy (same engine as `md-select`):
   *   - `'auto'` (default): virtualize above 200 rows.
   *   - `'always'`: always virtualize the `options` / `loadOptions` dataset.
   *   - `'never'`: plain DOM rendering.
   */
  @Prop() virtualize: 'auto' | 'always' | 'never' = 'auto';

  /** Filter strategy for the virtualized (WASM) path. */
  @Prop({ attribute: 'filter-mode' }) filterMode: FilterMode = 'substring';

  /** Fixed virtualized row height (px). Auto-measured from the first row if unset. */
  @Prop({ attribute: 'row-height' }) rowHeight?: number;

  /** Menu placement. */
  @Prop() placement: 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end' = 'bottom-start';

  /** Match the dropdown width to the trigger. */
  @Prop({ attribute: 'match-trigger-width' }) matchTriggerWidth: boolean = true;

  /** Max height of the dropdown menu (px). */
  @Prop({ attribute: 'max-height' }) maxHeight?: number;

  /** Form name. Multi-mode submits as repeated `name=value` pairs. */
  @Prop({ reflect: true }) name: string = '';

  /** Fires whenever the committed selection changes. */
  @Event() mdChange: EventEmitter<string | string[]>;

  /** Fires whenever the live input string changes. */
  @Event() mdInput: EventEmitter<string>;

  /** Fires when the menu opens. */
  @Event() mdOpen: EventEmitter<void>;

  /** Fires when the menu closes. */
  @Event() mdClose: EventEmitter<void>;

  /** Fires when the user clears the value. */
  @Event() mdClear: EventEmitter<void>;

  @State() private triggerId: string = `md-autocomplete-${++autocompleteIdCounter}`;
  @State() private focused: boolean = false;
  /** Normalised dataset for the plain-DOM path (empty while virtualized). */
  @State() private optionsData: SelectOptionData[] = [];
  /** value → label cache so chips / the input label survive off-window rows. */
  @State() private labelMap: Map<string, string> = new Map();

  /** True while a dataset is packing into the WASM store — presents the same
   *  busy UI as `loading` until the rows are ready. */
  @State() private packing = false;

  /** True once the user typed since the menu opened — before that the full
   *  list shows (reopening a committed single value must not filter to it). */
  private typedSinceOpen = false;

  /** Monotonic guard: only the NEWEST load may commit its results (a dataset
   *  replaced mid-pack must not interleave or resurrect stale state). */
  private loadGen = 0;

  /** Deferred focus target inside the freshly-opened listbox (APG: ArrowDown
   *  from a closed combobox opens AND focuses the first option). */
  private pendingListFocus: 'first' | 'last' | null = null;

  private fieldEl?: HTMLElement & { focus?: () => void };
  private menuEl?: VirtualMenuEl;
  private searchDebounce?: ReturnType<typeof setTimeout>;
  private providerSet = false;

  private vc = new VirtualSelectController({
    queryItem: (i) =>
      (this.el.shadowRoot?.querySelector(
        `md-menu-item[data-vindex="${i}"]`,
      ) as HTMLElement | null) ?? null,
    requestRender: () => forceUpdate(this),
  });

  // ── Public API ───────────────────────────────────────────

  /** Programmatically focus the input. */
  @Method()
  async focusInput() {
    this.fieldEl?.focus?.();
  }

  /** Open the menu. */
  @Method()
  async showMenu() {
    if (this.disabled) return;
    this.open = true;
  }

  /** Close the menu. */
  @Method()
  async closeMenu() {
    this.open = false;
  }

  /**
   * Load a large dataset into the WASM-backed virtualized list (rows are
   * byte-packed off the JS heap). Accepts an array or a `{ count, getRow }`
   * factory. Falls back to plain DOM when `virtualize="never"` or WASM is
   * unavailable.
   */
  @Method()
  async loadOptions(source: SelectOptionInit[] | OptionRowSource) {
    const gen = ++this.loadGen;
    if (this.virtualize === 'never' || !isWasmSupported()) {
      const rows = Array.isArray(source)
        ? source
        : Array.from({ length: source.count }, (_, i) => source.getRow(i));
      this.vc.reset();
      this.optionsData = this.normalize(rows);
      this.refreshLabelMap();
      return;
    }
    this.optionsData = [];
    this.packing = true;
    try {
      this.vc.setFixedRowHeight(this.rowHeight);
      this.vc.setFilterMode(this.filterMode);
      await this.vc.load(Array.isArray(source) ? this.normalize(source) : source);
    } finally {
      if (gen === this.loadGen) this.packing = false;
    }
    if (gen !== this.loadGen) return; // superseded by a newer load/refresh
    // A filter typed while the pack ran must apply to the fresh dataset.
    if (this.open && this.typedSinceOpen) this.vc.setQuery(this.query);
    this.refreshLabelMap();
    forceUpdate(this);
  }

  /** Resolve labels for a set of values (virtual-safe). */
  @Method()
  async getLabels(values: string[]): Promise<Record<string, string>> {
    if (this.vc.active) return Object.fromEntries(this.vc.getLabels(values));
    const out: Record<string, string> = {};
    for (const v of values) out[v] = this.labelMap.get(v) ?? v;
    return out;
  }

  // ── Option collection ────────────────────────────────────

  /** Accept the legacy `description` alias for `supportingText`. */
  private normalize(list: ReadonlyArray<MdAutocompleteOption>): SelectOptionData[] {
    return list.map((o) => ({
      value: o.value,
      label: o.label ?? o.value,
      disabled: !!o.disabled,
      icon: o.icon,
      iconColor: o.iconColor,
      supportingText: o.supportingText ?? o.description,
      selected: !!o.selected,
    }));
  }

  /**
   * `options` arrives as an array from a property binding, or as a JSON string
   * from an attribute. Everything downstream wants the array.
   */
  private get optionList(): MdAutocompleteOption[] {
    const raw = this.options;
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string' && raw.trim()) {
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        // A malformed attribute is an authoring mistake, not a reason to break
        // the field — warn once and carry on with nothing.
        if (typeof console !== 'undefined') {
          console.warn('[md-autocomplete] `options` attribute is not valid JSON:', raw);
        }
        return [];
      }
    }
    return [];
  }

  @Watch('options')
  refreshOptions() {
    const slotted = collectOptions(this.el, []);
    const data = slotted.length > 0 ? slotted : this.normalize(this.optionList);
    const shouldVirtualize =
      this.virtualize === 'always' ||
      (this.virtualize === 'auto' && data.length > VIRTUALIZE_THRESHOLD);
    const gen = ++this.loadGen;

    if (shouldVirtualize && isWasmSupported() && data.length > 0) {
      this.optionsData = [];
      this.packing = true;
      this.vc.setFixedRowHeight(this.rowHeight);
      this.vc.setFilterMode(this.filterMode);
      void this.vc.load(data).then((ok) => {
        if (gen !== this.loadGen) return; // superseded by a newer load/refresh
        if (!ok) {
          this.optionsData = data;
        }
        this.packing = false;
        // A filter typed while the pack ran must apply to the fresh dataset.
        if (ok && this.open && this.typedSinceOpen) this.vc.setQuery(this.query);
        this.refreshLabelMap();
        forceUpdate(this);
      });
    } else {
      this.vc.reset();
      this.optionsData = data;
      this.refreshLabelMap();
    }
  }

  /** Slotted `<md-select-option>` mount/unmount/data change → re-read. */
  @Listen('mdSelectOptionChange')
  onOptionChange(e: Event) {
    e.stopPropagation();
    this.refreshOptions();
  }

  // ── Selection state ──────────────────────────────────────

  /** Effective busy state: consumer-driven `loading` OR an in-flight pack. */
  private get busy(): boolean {
    return this.loading || this.packing;
  }

  private get selectedArray(): string[] {
    if (this.multiple) return Array.isArray(this.value) ? this.value : [];
    if (typeof this.value === 'string' && this.value) return [this.value];
    return [];
  }

  private isSelected = (val: string) => this.selectedArray.includes(val);

  /** The active filter query: only what the user typed since open counts. */
  private get query(): string {
    return this.typedSinceOpen ? this.inputValue.trim() : '';
  }

  private get filteredOptions(): SelectOptionData[] {
    const selected = this.selectedArray;
    const state = { inputValue: this.query, selected };
    let results = this.filterer
      ? this.filterer(this.optionsData, state)
      : this.defaultFilter(this.optionsData, state);
    if (this.limitResults > 0) results = results.slice(0, this.limitResults);
    return results;
  }

  private defaultFilter(
    options: SelectOptionData[],
    state: { inputValue: string; selected: string[] },
  ): SelectOptionData[] {
    const q = state.inputValue.toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.value.toLowerCase().includes(q) ||
        (o.supportingText?.toLowerCase().includes(q) ?? false),
    );
  }

  /** Rebuild the value→label cache (chips, single-mode input text). */
  private refreshLabelMap() {
    const values = this.selectedArray;
    if (values.length === 0) {
      if (this.labelMap.size) this.labelMap = new Map();
      return;
    }
    const next = new Map<string, string>();
    if (this.vc.active) {
      const resolved = this.vc.getLabels(values);
      for (const v of values) {
        next.set(v, resolved.get(v) ?? this.labelMap.get(v) ?? v);
      }
    } else {
      for (const v of values) {
        const opt = this.optionsData.find((o) => o.value === v);
        next.set(v, opt?.label ?? this.labelMap.get(v) ?? v);
      }
    }
    this.labelMap = next;
  }

  // ── Form association ─────────────────────────────────────

  private defaultValue: string | string[] = '';
  private defaultInputValue = '';

  componentWillLoad() {
    this.refreshOptions();
    this.defaultValue = Array.isArray(this.value) ? [...this.value] : this.value;
    this.defaultInputValue = this.inputValue;
    this.syncFormValue();
  }

  componentDidLoad() {
    // @Watch('open') does not fire for the initial value.
    if (this.open && !this.disabled) {
      void this.menuEl?.show?.({ autoFocus: false });
      this.mdOpen.emit();
    }
  }

  disconnectedCallback() {
    clearTimeout(this.searchDebounce);
    this.vc.detachViewport();
  }

  formResetCallback() {
    this.value = Array.isArray(this.defaultValue) ? [...this.defaultValue] : this.defaultValue;
    this.inputValue = this.defaultInputValue;
    // Stale filter state must not survive a reset.
    this.typedSinceOpen = false;
    clearTimeout(this.searchDebounce);
    if (this.vc.active) this.vc.setQuery('');
  }

  @Watch('value')
  syncFormValue() {
    this.updateValidity();
    this.refreshLabelMap();
    // Programmatic single-mode value set (menu closed): reflect the committed
    // label in the visible input — otherwise the field shows stale text until
    // the next interaction. Silent (no mdInput): this is not user typing.
    if (!this.multiple && !this.open) {
      const committed =
        typeof this.value === 'string' && this.value
          ? this.labelMap.get(this.value) ?? this.value
          : '';
      if (this.inputValue !== committed) this.inputValue = committed;
    }
    if (this.multiple) {
      const values = this.selectedArray;
      if (!values.length) {
        setFormValue(this.internals, null);
        return;
      }
      const data = new FormData();
      for (const v of values) data.append(this.name || '', v);
      setFormValue(this.internals, data);
      return;
    }
    const single = typeof this.value === 'string' ? this.value : '';
    setFormValue(this.internals, single || null);
  }

  /** Flipping `multiple` at runtime must re-shape the value and re-submit —
   *  ElementInternals would otherwise keep the pre-flip payload. */
  @Watch('multiple')
  onMultipleFlip() {
    if (this.multiple) {
      if (typeof this.value === 'string') this.value = this.value ? [this.value] : [];
      else this.syncFormValue();
    } else {
      if (Array.isArray(this.value)) this.value = this.value[0] ?? '';
      else this.syncFormValue();
    }
  }

  @Watch('required')
  @Watch('valueMissingLabel')
  updateValidity() {
    if (!this.internals?.setValidity) return;
    // setCustomValidity() takes precedence over valueMissing, matching native.
    if (this.customValidityMessage) {
      this.internals.setValidity(
        { customError: true },
        this.customValidityMessage,
        (this.fieldEl as HTMLElement) ?? this.el,
      );
    } else if (this.required && this.selectedArray.length === 0) {
      this.internals.setValidity(
        { valueMissing: true },
        this.errorText || this.valueMissingLabel,
        (this.fieldEl as HTMLElement) ?? this.el,
      );
    } else {
      this.internals.setValidity({});
    }
      this.emitValidityChange();
  }

  /** Current validity: boolean, message and flags. Mirrors md-text-field. */
  @Method()
  async getValidity(): Promise<{
    valid: boolean;
    validationMessage: string;
    flags: Record<string, boolean>;
  }> {
    return getValidityOf(this.internals);
  }

  /**
   * Fires when this control's validity CHANGES — never on every keystroke, and
   * never for a re-publish that lands on the same state.
   *
   * `composed: false` is deliberate. Composites like md-select embed an
   * md-text-field, and a composed event escapes that inner shadow root, so a
   * listener on md-select would receive the inner field's event as well as the
   * host's — two events, different payloads, for one logical control. Keeping
   * it uncomposed means each component reports only for itself, while
   * `bubbles: true` still lets a <form> or app root hear every control.
   */
  @Event({ bubbles: true, composed: false }) mdValidityChange: EventEmitter<{
    valid: boolean;
    validationMessage: string;
    flags: Record<string, boolean>;
  }>;

  /** Last emitted validity, so a re-publish that changes nothing stays silent. */
  private lastValidityKey: string | null = null;

  /**
   * Emit mdValidityChange if validity actually moved.
   *
   * The FIRST call only primes the baseline. Initial state is not a change, and
   * emitting on mount would fire once per control on every page load — noise a
   * consumer would have to filter out, and misleading for anything logging
   * "field became invalid".
   */
  private emitValidityChange() {
    const v = getValidityOf(this.internals);
    const key = `${v.valid}|${v.validationMessage}`;
    if (this.lastValidityKey === key) return;
    const primed = this.lastValidityKey !== null;
    this.lastValidityKey = key;
    if (primed) this.mdValidityChange.emit(v);
  }

  /** Constraint-validation API, matching md-text-field and the native contract.
   *  Validity was already published to the form here, but with no public method
   *  a consumer could not ASK this control whether it was valid. */
  @Method()
  async checkValidity(): Promise<boolean> {
    return checkValidityOf(this.internals);
  }

  @Method()
  async reportValidity(): Promise<boolean> {
    return reportValidityOf(this.internals);
  }

  @Method()
  async setCustomValidity(message: string) {
    this.customValidityMessage = message;
    this.updateValidity();
  }

  // ── Menu open/close plumbing (mirrors md-select) ─────────

  private _syncGuard = false;
  private _lastEmit: 'open' | 'close' | null = null;

  @Watch('open')
  syncMenu(open: boolean) {
    if (this._syncGuard || !this.menuEl) return;
    if (open) {
      // Focus stays in the input — typing keeps filtering.
      this.menuEl.show?.({ autoFocus: false });
    } else {
      this.menuEl.close?.();
    }
  }

  /** True once the vc is wired to the menu's live scroll viewport. */
  private vpWired = false;

  /** Wire the vc to the menu's scroll viewport (listener + row measure +
   *  recompute). The viewport only exists once the CAPPED virtual listbox has
   *  rendered (the busy bar renders uncapped, without a scroll viewport), so a
   *  null resolve just returns — componentDidRender retries every render
   *  while the menu is open until the wiring lands. */
  private attachMenuViewport() {
    void (async () => {
      const vp = (await this.menuEl?.getScrollViewport?.()) ?? null;
      if (!vp || this.vpWired) return;
      this.vpWired = true;
      await this.vc.attachViewport(async () => vp);
    })();
  }

  private handleMenuOpen = () => {
    this._syncGuard = true;
    this.open = true;
    this._syncGuard = false;
    if (this._lastEmit !== 'open') {
      this._lastEmit = 'open';
      this.mdOpen.emit();
    }
    if (this.vc.active) {
      // Apply the live query (typing may have just opened the menu — the open
      // event lands after the keystroke, so the filter must be preserved).
      this.vc.setQuery(this.query);
      this.attachMenuViewport();
    }
  };

  private handleMenuClose = () => {
    this._syncGuard = true;
    this.open = false;
    this._syncGuard = false;
    if (this._lastEmit !== 'close') {
      this._lastEmit = 'close';
      this.mdClose.emit();
    }
    // Reset the typing gate on close, so REOPENING shows the full list (a
    // committed single value must not filter the list down to itself).
    this.typedSinceOpen = false;
    this.vc.detachViewport();
    this.vpWired = false;
    // Strict single mode: snap the input back to the committed label (or
    // empty) — typed-but-uncommitted text must not linger after the popup
    // closes, and the committed value itself is never touched by typing.
    if (!this.multiple && !this.freeSolo) {
      const committed =
        typeof this.value === 'string' && this.value
          ? this.labelMap.get(this.value) ?? this.value
          : '';
      if (this.inputValue !== committed) {
        this.inputValue = committed;
        this.mdInput.emit(committed);
      }
    }
  };

  /** Register/clear the virtual provider on the menu once it's rendered, and
   *  (re)try the viewport wiring — the menu may have been opened while the
   *  dataset was still packing, before the scroll viewport existed. */
  componentDidRender() {
    void this.syncComboboxRefs();
    if (!this.menuEl) return;
    if (this.vc.active && !this.providerSet) {
      void this.menuEl.setVirtualProvider?.(this.vc.provider);
      this.providerSet = true;
    } else if (!this.vc.active && this.providerSet) {
      void this.menuEl.setVirtualProvider?.(null);
      this.providerSet = false;
    }
    if (this.open && this.vc.active && !this.vpWired) this.attachMenuViewport();
    if (this.pendingListFocus && this.open) {
      const all = this.el.shadowRoot?.querySelectorAll(
        '.md-autocomplete__listbox md-menu-item:not([disabled])',
      );
      const target = (this.pendingListFocus === 'first' ? all?.[0] : all?.[all.length - 1]) as
        | HTMLElement
        | undefined;
      if (target) {
        this.pendingListFocus = null;
        target.focus();
      }
    } else if (this.pendingListFocus && !this.open) {
      this.pendingListFocus = null;
    }
  }

  /**
   * Point the combobox at its listbox ACROSS the shadow boundary.
   *
   * The textbox lives in md-text-field's shadow root and the listbox in this
   * one, so `aria-controls` as an IDREF is unusable — an IDREF only resolves
   * inside a single tree. ARIA element reflection takes element references
   * instead, and a reference from a descendant tree to an element in an
   * ancestor tree is in scope: verified in the accessibility tree, where the
   * combobox node gains a real `controls` relation to the listbox.
   *
   * Where reflection is unavailable the component is still a combobox with a
   * truthful expanded state, and ArrowDown moves REAL focus onto an option —
   * the APG variant that does not depend on a reference at all.
   */
  private async syncComboboxRefs() {
    const field = this.fieldEl as (HTMLElement & {
      getInputElement?: () => Promise<HTMLInputElement | null>;
    }) | undefined;
    const input = await field?.getInputElement?.();
    if (!input || !('ariaControlsElements' in input)) return;
    const listbox = this.el.shadowRoot?.querySelector('[role="listbox"]') as HTMLElement | null;
    const next = this.open && listbox ? [listbox] : null;
    const current = (input as unknown as { ariaControlsElements: Element[] | null })
      .ariaControlsElements;
    // Idempotent: reassigning every render would churn the AX tree.
    if (!next && !current?.length) return;
    if (next && current?.length === 1 && current[0] === next[0]) return;
    (input as unknown as { ariaControlsElements: Element[] | null }).ariaControlsElements = next;
  }

  // ── Selection ────────────────────────────────────────────

  private commitValue(next: string | string[]) {
    this.value = next;
    this.mdChange.emit(next);
  }

  private pick(value: string, label: string, disabled: boolean | undefined, e?: CustomEvent) {
    // Composed mdClick would otherwise leak to host listeners.
    e?.stopPropagation();
    if (disabled) return;
    if (this.multiple) {
      const current = this.selectedArray;
      const exists = current.includes(value);
      const blocked = !exists && this.maxSelected > 0 && current.length >= this.maxSelected;
      if (blocked) {
        // md-menu-item self-toggled selected=true before this fired; revert it.
        const item = e?.target as (HTMLElement & { selected?: boolean }) | null;
        if (item) item.selected = false;
        return;
      }
      this.labelMap = new Map(this.labelMap).set(value, label);
      const next = exists ? current.filter((v) => v !== value) : [...current, value];
      this.commitValue(next);
      this.inputValue = '';
      this.mdInput.emit('');
      this.typedSinceOpen = false;
      if (this.vc.active) this.vc.setQuery('');
      // Multi-select stays OPEN on pick — choosing several in a row is the
      // whole point, and md-multi-select already behaves this way. Closing
      // after the first pick forced a reopen per item. It dismisses on an
      // outside click, on the trigger, or on Escape like any other popup.
      this.fieldEl?.focus?.();
    } else {
      this.labelMap = new Map(this.labelMap).set(value, label);
      this.commitValue(value);
      this.inputValue = label;
      this.mdInput.emit(label);
      // The selection ends the query session NOW — not at mdClose time. The
      // close event lands ~150ms later (menu animation); reopening within
      // that window must already show the full list, not a list filtered by
      // the committed label.
      this.typedSinceOpen = false;
      if (this.vc.active) this.vc.setQuery('');
      if (!this.disableCloseOnSelect) this.open = false;
      this.fieldEl?.focus?.();
    }
  }

  private commitFreeSolo(): boolean {
    if (!this.freeSolo) return false;
    const raw = this.inputValue.trim();
    if (!raw) return false;
    if (this.multiple) {
      const current = this.selectedArray;
      if (current.includes(raw)) return true;
      if (this.maxSelected > 0 && current.length >= this.maxSelected) return false;
      this.labelMap = new Map(this.labelMap).set(raw, raw);
      this.commitValue([...current, raw]);
      this.inputValue = '';
      this.mdInput.emit('');
    } else {
      this.commitValue(raw);
    }
    return true;
  }

  private removeChip = (val: string) => (e: CustomEvent | MouseEvent) => {
    e.stopPropagation();
    if ('preventDefault' in e) e.preventDefault();
    if (this.disabled || this.softDisabled || !this.multiple) return;
    this.commitValue(this.selectedArray.filter((v) => v !== val));
  };

  private handleClear = () => {
    if (this.disabled || this.softDisabled) return;
    this.inputValue = '';
    this.mdInput.emit('');
    this.typedSinceOpen = false;
    if (this.vc.active) this.vc.setQuery('');
    this.commitValue(this.multiple ? [] : '');
    this.mdClear.emit();
    this.fieldEl?.focus?.();
  };

  // ── Input handlers ───────────────────────────────────────

  /** Apply a typed input string (from the field, or a printable key redirected
   *  out of the listbox): update state, open, and drive the (virtual) filter. */
  private applyTyped(raw: string) {
    this.inputValue = raw;
    this.typedSinceOpen = true;
    this.mdInput.emit(raw);
    if (!this.open) this.open = true;
    if (this.vc.active) {
      clearTimeout(this.searchDebounce);
      this.searchDebounce = setTimeout(() => {
        this.vc.setQuery(this.query);
      }, SEARCH_DEBOUNCE_MS);
    }
    // NB: typing never uncommits the value in strict single mode — a stray
    // keystroke (even a trailing space) must not deselect the committed
    // option. The input resyncs to the committed label when the popup closes
    // (see handleMenuClose), matching the MUI model.
  }

  private handleFieldInput = (e: CustomEvent<string>) => {
    this.applyTyped(e.detail ?? '');
  };

  /** Printable keys (and Backspace) pressed while focus is on an option:
   *  an editable combobox keeps TYPING in the input — refocus it and extend
   *  the query instead of letting md-menu's typeahead swallow the key. */
  private handleListboxKeyDown = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const isPrintable = e.key.length === 1;
    if (!isPrintable && e.key !== 'Backspace') return;
    e.preventDefault();
    e.stopPropagation();
    this.fieldEl?.focus?.();
    this.applyTyped(
      e.key === 'Backspace' ? this.inputValue.slice(0, -1) : this.inputValue + e.key,
    );
  };

  /** First visible, enabled option row in this shadow root (plain or virtual). */
  private firstOptionItem(): HTMLElement | null {
    return (
      (this.el.shadowRoot?.querySelector(
        '.md-autocomplete__listbox md-menu-item:not([disabled])',
      ) as HTMLElement | null) ?? null
    );
  }

  private handleFieldKeyDown = (e: KeyboardEvent) => {
    if (this.disabled || this.softDisabled) return;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!this.open) {
          // APG: ArrowDown on a closed combobox opens the popup AND moves
          // focus to the first option (deferred until the list renders).
          this.pendingListFocus = 'first';
          this.open = true;
        } else {
          // Focus-moves-into-popup combobox variant: the option takes real
          // focus (announced by AT); md-menu's roving model handles the rest.
          this.firstOptionItem()?.focus();
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (!this.open) {
          this.pendingListFocus = 'last';
          this.open = true;
        } else {
          const all = this.el.shadowRoot?.querySelectorAll(
            '.md-autocomplete__listbox md-menu-item:not([disabled])',
          );
          (all?.[all.length - 1] as HTMLElement | undefined)?.focus();
        }
        break;
      case 'Enter':
        if (this.freeSolo && this.commitFreeSolo()) {
          e.preventDefault();
          if (!this.multiple) this.open = false;
        }
        break;
      case 'Escape':
        if (this.open) {
          e.preventDefault();
          this.open = false;
        }
        break;
      case 'Backspace':
        if (this.multiple && !this.inputValue && this.selectedArray.length > 0) {
          this.commitValue(this.selectedArray.slice(0, -1));
        }
        break;
    }
  };

  private handleFieldFocus = () => {
    this.focused = true;
  };

  private handleFieldBlur = () => {
    this.focused = false;
    // Not while the popup is open — ArrowDown moves focus into the listbox,
    // and resetting the input there would wipe the active filter mid-browse.
    if (this.open) return;
    if (this.clearOnBlur && !this.multiple && !this.freeSolo) {
      const committed = typeof this.value === 'string' ? this.labelMap.get(this.value) : '';
      if (this.inputValue && this.inputValue !== committed) {
        this.inputValue = committed ?? '';
        this.mdInput.emit(this.inputValue);
      }
    }
  };

  // ── Render ───────────────────────────────────────────────

  /** A single removable value token (shared by the below + inline layouts). */
  private renderChipItem = (val: string) => (
    <md-chip
      key={val}
      part="chip"
      exportparts="remove:chip-remove,label:chip-label"
      variant="input"
      // A display token of a selected value (role=group, not a nested
      // interactive button host) — only its ✕ removes it.
      selectable={false}
      label={this.labelMap.get(val) ?? val}
      disabled={this.disabled || this.softDisabled}
      removable={!this.disabled && !this.softDisabled}
      onMdRemove={this.removeChip(val)}
      onClick={(e: MouseEvent) => e.stopPropagation()}
    ></md-chip>
  );

  private get inlineChips(): boolean {
    return this.multiple && this.chipPosition === 'inline';
  }

  /** Chips BELOW the field (default layout). */
  private renderChips() {
    if (!this.multiple || this.inlineChips) return null;
    const selected = this.selectedArray;
    if (selected.length === 0) return null;
    return (
      <div
        class="md-autocomplete__chips"
        part="chips"
        role="group"
        aria-label={this.label ? `${this.label} — selected` : 'Selected'}
      >
        {selected.map(this.renderChipItem)}
      </div>
    );
  }

  /** Chips INSIDE the field (md-text-field `chips` slot), wrapping onto new
   *  rows — the field grows with them (`chips-wrap`). */
  private renderInlineChips() {
    if (!this.inlineChips) return null;
    const selected = this.selectedArray;
    if (selected.length === 0) return null;
    return (
      <div
        slot="chips"
        class="md-autocomplete__inline-chips"
        part="chips"
        role="group"
        aria-label={this.label ? `${this.label} — selected` : 'Selected'}
      >
        {selected.map(this.renderChipItem)}
      </div>
    );
  }

  private renderClearButton(forceHidden = false) {
    if (!this.clearable) return null;
    const hasValue = this.multiple
      ? this.selectedArray.length > 0
      : !!this.inputValue || !!this.value;
    // Always rendered (visibility-hidden when empty or busy): the button
    // popping in and out would change the field's intrinsic width, making the
    // trigger jump by its 30px whenever text appears in a shrink-to-fit layout.
    const hidden = forceHidden || !hasValue;
    return (
      <md-icon-button
        class={{
          'md-autocomplete__clear': true,
          'md-autocomplete__clear--hidden': hidden,
        }}
        slot="trailing-icon"
        part="clear"
        variant="standard"
        size="xs"
        icon={this.clearIcon}
        aria-label="Clear value"
        aria-hidden={hidden ? 'true' : undefined}
        onClick={(e: MouseEvent) => {
          e.stopPropagation();
          this.handleClear();
        }}
      ></md-icon-button>
    );
  }

  private renderTrigger() {
    return (
      <md-text-field
        ref={(el) => (this.fieldEl = el as HTMLElement)}
        id={this.triggerId}
        class="md-autocomplete__field"
        part="field"
        variant={this.variant}
        label={this.label}
        placeholder={this.placeholder}
        value={this.inputValue}
        disabled={this.disabled}
        error={this.error}
        errorText={this.errorText}
        reserveSupportingSpace={this.reserveSupportingSpace}
        supportingText={this.supportingText}
        required={this.required}
        density={this.density}
        appearFocused={this.open || this.focused}
        // Mirrored by md-text-field onto the focused input (global ARIA attr,
        // valid on textbox) — the input truthfully announces its listbox popup.
        aria-haspopup="listbox"
        // Promote the real textbox to a combobox: the role, the expanded state
        // and the typing relationship all have to sit on the element AT reads.
        // The listbox reference is wired separately (syncComboboxRefs) because
        // it has to cross md-text-field's shadow boundary.
        inputRole="combobox"
        inputExpanded={this.open}
        inputAriaAutocomplete="list"
        chipsWrap={this.inlineChips}
        onMdInput={this.handleFieldInput}
        onClick={() => {
          if (!this.disabled && !this.softDisabled && !this.open) this.open = true;
        }}
        onKeyDown={this.handleFieldKeyDown}
        onFocus={this.handleFieldFocus}
        onBlur={this.handleFieldBlur}
      >
        {this.renderInlineChips()}
        {this.busy ? (
          // Busy state (consumer `loading` OR a dataset packing into WASM): a
          // spinner replaces the CARET only; the (hidden) clear button keeps
          // its reserved slot so the trailing cluster — and therefore the
          // field width — is identical across idle/typing/busy/loaded.
          [
            this.renderClearButton(true),
            <span slot="trailing-icon" class="md-autocomplete__loader" part="loading-spinner">
              <slot name="loader">
                <LazyLoadingIndicator label={this.loadingText}></LazyLoadingIndicator>
              </slot>
            </span>,
          ]
        ) : (
          [
            this.renderClearButton(),
            <span
              slot="trailing-icon"
              class="md-autocomplete__caret material-symbols-outlined"
              part="caret"
              aria-hidden="true"
              onClick={(e: MouseEvent) => {
                e.stopPropagation();
                if (!this.disabled && !this.softDisabled) this.open = !this.open;
              }}
            >
              {/* Static glyph + CSS rotation on open — same caret as the selects
                  (a glyph swap would double-flip with the rotate rule). */}
              <slot name="dropdown-icon">{this.dropdownIcon}</slot>
            </span>,
          ]
        )}
      </md-text-field>
    );
  }

  private renderOptionIcon(icon?: string, iconColor?: string) {
    if (!icon) return null;
    return (
      <span
        slot="leading-icon"
        part="option-icon"
        class="material-symbols-outlined md-autocomplete__option-icon"
        style={iconColor ? { color: iconColor } : undefined}
        aria-hidden="true"
      >
        {icon}
      </span>
    );
  }

  private renderVirtualOptions() {
    return (
      <div
        class="md-autocomplete__listbox"
        role="listbox"
        id={`${this.triggerId}-listbox`}
        aria-label={this.label || 'Options'}
        aria-multiselectable={this.multiple ? 'true' : undefined}
        onKeyDown={this.handleListboxKeyDown}
      >
        <div
          class="md-autocomplete__vspacer"
          style={{ height: `${this.vc.topPad}px` }}
          aria-hidden="true"
        ></div>
        {this.vc.windowRows.map((row, i) => {
          const filteredIndex = this.vc.windowStart + i;
          const selected = this.isSelected(row.value);
          return (
            <md-menu-item
              key={row.index}
              id={`${this.triggerId}-opt-${filteredIndex}`}
              data-vindex={filteredIndex}
              presentation="option"
              type={this.multiple ? 'checkbox' : 'radio'}
              check-position="start"
              keep-open
              part={selected ? 'option option-selected' : 'option'}
              disabled={row.disabled}
              selected={selected}
              headline={row.label}
              supporting-text={row.supportingText || ''}
              aria-setsize={this.vc.filteredLength}
              aria-posinset={filteredIndex + 1}
              onMdClick={(e: CustomEvent) => this.pick(row.value, row.label, row.disabled, e)}
            >
              {this.renderOptionIcon(row.icon || undefined)}
            </md-menu-item>
          );
        })}
        <div
          class="md-autocomplete__vspacer"
          style={{ height: `${this.vc.bottomPad}px` }}
          aria-hidden="true"
        ></div>
      </div>
    );
  }

  private renderMenu() {
    const virtual = this.vc.active;
    const filtered = virtual ? [] : this.filteredOptions;
    const datasetEmpty = virtual ? false : this.optionsData.length === 0;
    const emptyText = this.busy
      ? ''
      : virtual
        ? this.vc.filteredLength === 0
          ? this.noResultsText
          : ''
        : datasetEmpty
          ? this.noOptionsText
          : filtered.length === 0
            ? this.noResultsText
            : '';
    const menuMaxHeight = virtual ? (this.maxHeight ?? 320) : this.maxHeight;

    return (
      <md-menu
        ref={(el) => (this.menuEl = el as VirtualMenuEl)}
        anchor={this.triggerId}
        placement={this.placement}
        match-anchor-width={this.matchTriggerWidth}
        max-height={menuMaxHeight}
        persistent={this.disableCloseOnSelect}
        empty-text={emptyText}
        auto-focus={false}
        listbox
        list-label={this.label || 'Options'}
        part="menu"
        onMdOpen={this.handleMenuOpen}
        onMdClose={this.handleMenuClose}
      >
        {this.busy ? (
          <div class="md-autocomplete__loading" part="loading" role="status" aria-label={this.loadingText}>
            <md-progress-indicator
              variant="linear"
              indeterminate
              wave
              part="loading-progress"
              label={this.loadingText}
            ></md-progress-indicator>
          </div>
        ) : virtual ? (
          this.renderVirtualOptions()
        ) : (
          <div
            class="md-autocomplete__listbox"
            role="listbox"
            id={`${this.triggerId}-listbox`}
            aria-label={this.label || 'Options'}
            aria-multiselectable={this.multiple ? 'true' : undefined}
            onKeyDown={this.handleListboxKeyDown}
          >
            {filtered.map((opt, i) => (
              <md-menu-item
                key={opt.value}
                id={`${this.triggerId}-opt-${i}`}
                presentation="option"
                type={this.multiple ? 'checkbox' : 'radio'}
                check-position="start"
                keep-open
                part={this.isSelected(opt.value) ? 'option option-selected' : 'option'}
                disabled={opt.disabled}
                selected={this.isSelected(opt.value)}
                headline={opt.label}
                supporting-text={opt.supportingText || ''}
                onMdClick={(e: CustomEvent) => this.pick(opt.value, opt.label, opt.disabled, e)}
              >
                {this.renderOptionIcon(opt.icon, opt.iconColor)}
              </md-menu-item>
            ))}
          </div>
        )}
      </md-menu>
    );
  }

  render() {
    const chipsFirst =
      this.multiple && (this.chipPosition === 'top' || this.chipPosition === 'left');
    const optionCount = this.vc.active ? this.vc.filteredLength : this.filteredOptions.length;
    const srStatus = this.busy
      ? this.loadingText
      : this.open
        ? this.statusTemplate.replace('{count}', String(optionCount))
        : '';
    return (
      <Host
        class={{
          'md-autocomplete': true,
          [`md-autocomplete--${this.variant}`]: true,
          'md-autocomplete--open': this.open,
          'md-autocomplete--disabled': this.disabled,
          'md-autocomplete--soft-disabled': this.softDisabled,
          'md-autocomplete--multiple': this.multiple,
          'md-autocomplete--loading': this.busy,
          [`md-autocomplete--chips-${this.chipPosition}`]: this.multiple,
        }}
        aria-haspopup="listbox"
        aria-busy={this.busy ? 'true' : 'false'}
      >
        {chipsFirst && this.renderChips()}
        {this.renderTrigger()}
        {!chipsFirst && this.renderChips()}
        {this.renderMenu()}
        {/* Polite live status: the visible option count — which no ARIA
            attribute conveys — plus the busy text. The expanded state itself
            rides on the real textbox (`input-expanded` → aria-expanded, legal
            there because the input carries role="combobox"; see renderTrigger). */}
        <span class="md-autocomplete__sr-status" role="status" aria-live="polite">
          {srStatus}
        </span>
      </Host>
    );
  }
}
