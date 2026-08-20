import { AttachInternals, Component, Element, Event, EventEmitter, Host, Listen, Method, Prop, State, Watch, forceUpdate, h } from '@stencil/core';
import {
  collectOptions,
  normalizeInits,
  OptionRowSource,
  rowsToArray,
  SelectOptionData,
  SelectOptionInit,
} from '../../utils/select-options';
import { setFormValue, checkValidityOf, reportValidityOf, getValidityOf } from '../../utils/form';
import { VirtualSelectController } from '../../utils/virtual-select-controller';
import { isWasmSupported, FilterMode } from '../../utils/wasm-option-store';
import { VirtualMenuProvider } from '../../utils/types';
import { parseJsonArrayProp } from '../../utils/json-prop';

let multiSelectIdCounter = 0;

/** Above this many options, `virtualize="auto"` switches to the WASM path. */
const VIRTUALIZE_THRESHOLD = 200;

/** Idle time after a keystroke before the search query runs (debounce). */
const SEARCH_DEBOUNCE_MS = 180;

type VirtualMenuEl = HTMLElement & {
  show?: (opts?: { autoFocus?: boolean }) => Promise<void>;
  close?: () => Promise<void>;
  reposition?: () => Promise<void>;
  setVirtualProvider?: (p: VirtualMenuProvider | null) => Promise<void>;
  getScrollViewport?: () => Promise<HTMLElement | null>;
  setComboboxElement?: (el: HTMLElement | null) => Promise<void>;
};

/** @deprecated Use slotted `<md-select-option>` or the shared option shape. */
export interface MdMultiSelectOption {
  value: string;
  label: string;
  description?: string;
  group?: string;
  icon?: string;
  iconHtml?: string;
  disabled?: boolean;
}

/**
 * `md-multi-select` — Material Design 3 multi-value dropdown.
 *
 * Shares its internals with `md-select`: an `md-text-field` trigger and an
 * `md-menu` option surface. Options come from slotted `<md-select-option>`
 * children (primary API) or the programmatic `options` array. Each becomes a
 * `type="checkbox"` `md-menu-item` so several can be selected at once, and the
 * menu uses `keep-open` so multiple toggles don't dismiss it.
 *
 * Selected values render in the trigger as removable chips (`display-mode="chips"`),
 * a "{n} selected" count, or comma-joined text.
 */
@Component({
  tag: 'md-multi-select',
  styleUrl: 'md-multi-select.css',
  shadow: true,
  formAssociated: true,
})
export class MdMultiSelect {
  @Element() el!: HTMLElement;


  /**
   * Localized constraint-validation message shown when `required` is unmet.
   * `errorText` still wins when set, so an app-supplied inline message and the
   * native bubble stay in agreement.
   */
  @Prop({ attribute: 'value-missing-label' }) valueMissingLabel: string = 'Please select at least one option';


  /**
   * Always occupy the supporting-text line, even when there is no message, so a
   * validation error does not push the content below it down. Forwarded to the
   * embedded md-text-field. See that component for why it is opt-in.
   */
  @Prop({ attribute: 'reserve-supporting-space' }) reserveSupportingSpace: boolean = false;

  /** Message set via setCustomValidity(); non-empty wins over valueMissing. */
  private customValidityMessage = '';

  /**
   * Form-association handle. Each selected value is submitted under the
   * host's `name` via a `FormData` payload, so the control participates in
   * `<form>`/`FormData` natively (repeated `name=value` pairs) — hidden
   * `<input>`s in the shadow root would be invisible to `FormData`.
   */
  @AttachInternals() internals!: ElementInternals;

  /** Visual variant — forwarded to the inner `md-text-field`. */
  @Prop({ reflect: true }) variant: 'filled' | 'outlined' = 'outlined';

  /** Floating label / accessible name. */
  @Prop() label: string = '';

  /** Placeholder shown when nothing is selected. */
  @Prop() placeholder: string = '';

  /** Supporting / helper text below the field. */
  @Prop({ attribute: 'supporting-text' }) supportingText: string = '';

  /** Error state — forwarded to the inner field. */
  @Prop({ reflect: true }) error: boolean = false;

  /** Error text rendered in place of supporting text when `error` is set. */
  @Prop({ attribute: 'error-text' }) errorText: string = '';

  /** Disabled — non-interactive. */
  @Prop({ reflect: true }) disabled: boolean = false;

  /** Soft-disabled — disabled visuals but still focusable. */
  @Prop({ reflect: true, attribute: 'soft-disabled' }) softDisabled: boolean = false;

  /** Required (form validation parity). */
  @Prop({ reflect: true }) required: boolean = false;

  /** Density forwarded to the inner field. */
  @Prop({ reflect: true }) density: 0 | -1 | -2 | -3 | -4 = 0;

  /** Programmatic options. Ignored when `<md-select-option>` children exist. */
  /**
   * Programmatic options. Slotted `md-select-option` children take precedence.
   *
   * Accepts the array (property) or a **JSON string** (attribute), so a
   * plain-HTML page can declare its data inline instead of reaching for a
   * script. Malformed JSON degrades to an empty list with a console warning.
   */
  @Prop() options: SelectOptionInit[] | string = [];

  /** `options` as an array, whether it arrived as one or as a JSON attribute. */
  private get optionList(): SelectOptionInit[] {
    return parseJsonArrayProp<SelectOptionInit>(this.options, 'md-multi-select', 'options');
  }

  /**
   * Virtualization mode for large option lists (backed by a WASM data engine):
   *   - `'auto'` (default): virtualize only above `VIRTUALIZE_THRESHOLD` rows.
   *   - `'always'`: always virtualize.
   *   - `'never'`: keep the classic DOM rendering.
   * Virtualized rows render label + selection only (no per-row icon /
   * supporting text), assume a uniform row height, and disable "Select all".
   */
  @Prop() virtualize: 'auto' | 'always' | 'never' = 'auto';

  /** Show a search field in the menu header that filters via the WASM engine. */
  @Prop() filterable: boolean = false;

  /** Filter strategy used by `filterable` / `setQuery`. */
  @Prop({ attribute: 'filter-mode' }) filterMode: FilterMode = 'substring';

  /** Fixed virtualized row height (px). Auto-measured from the first row if unset. */
  @Prop({ attribute: 'row-height' }) rowHeight?: number;

  /** Currently selected values. */
  @Prop({ mutable: true }) value: string[] = [];

  /** Maximum number of selected items. `0` = unlimited. */
  @Prop({ attribute: 'max-selected' }) maxSelected: number = 0;

  /** Render an inline "Select all" checkbox at the top of the menu. */
  @Prop({ attribute: 'show-select-all', reflect: true }) showSelectAll: boolean = false;

  /** Label for the "Select all" item. */
  @Prop({ attribute: 'select-all-label' }) selectAllLabel: string = 'Select all';

  /** Menu placement relative to the trigger — forwarded to `md-menu`. */
  @Prop() placement: 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end' =
    'bottom-start';

  /** Max height of the dropdown menu (px), forwarded to `md-menu`. Virtualized
   *  lists fall back to 320 when unset (they need a bounded scroll viewport). */
  @Prop({ attribute: 'max-height' }) maxHeight?: number;

  /**
   * Match the dropdown width to the trigger. When `false` the menu sizes to
   * content. Maps to `md-menu`'s `match-anchor-width`. Default `true`.
   */
  @Prop({ attribute: 'match-trigger-width', reflect: true })
  matchTriggerWidth: boolean = true;

  /**
   * How selected values appear in the trigger:
   *   - `'chips'` (default): removable chips in a region BELOW the field.
   *   - `'chips-inline'`: removable chips INSIDE the trigger input, on a single
   *     line — the field keeps its normal height and never grows; chips that
   *     overflow are clipped (the open menu is the source of truth).
   *   - `'count'`: "{n} selected".
   *   - `'text'`: comma-joined labels.
   */
  @Prop({ reflect: true, attribute: 'display-mode' })
  displayMode: 'chips' | 'chips-inline' | 'count' | 'text' = 'chips';

  /**
   * For `display-mode="chips-inline"`, how the in-field chips handle running out
   * of room:
   *   - `'count'` (default): chips stay on ONE line; the field keeps its normal
   *     height and the chips that don't fit collapse into a trailing `+N` counter
   *     chip (click it — or the field — to open the menu and manage the full set).
   *   - `'wrap'`: chips wrap onto new rows and the field grows to fit them.
   */
  @Prop({ reflect: true, attribute: 'chip-overflow' })
  chipOverflow: 'count' | 'wrap' = 'count';

  /**
   * Where the removable chips sit relative to the trigger, for `display-mode="chips"`
   * (ignored for `chips-inline`/`count`/`text`): `'bottom'` (default), `'top'`,
   * `'left'`, or `'right'`. `left`/`right` place the chips beside the trigger and are
   * the natural pairing for `trigger="button"`.
   */
  @Prop({ reflect: true, attribute: 'chip-position' })
  chipPosition: 'bottom' | 'top' | 'left' | 'right' = 'bottom';

  /**
   * Trigger style: `'field'` (default) is the readonly md-text-field; `'button'` is
   * a compact button (leading icon + label) that only opens the drawer — the
   * selection shows as removable chips beside it (pair with `chip-position`
   * `left`/`right`). The button always shows chips regardless of `display-mode`.
   */
  @Prop({ reflect: true }) trigger: 'field' | 'button' = 'field';

  /** Leading icon (Material Symbol name) for `trigger="button"`. */
  @Prop({ attribute: 'trigger-icon' }) triggerIcon: string = 'add';

  /** Button text for `trigger="button"`. Falls back to `label`. */
  @Prop({ attribute: 'trigger-label' }) triggerLabel: string = '';

  /** Custom formatter for `display-mode="count"`. */
  @Prop() countFormatter?: (count: number) => string;

  /** Placeholder for the filter search input (localization). */
  @Prop({ attribute: 'search-placeholder' }) searchPlaceholder: string = 'Search…';

  /** Accessible label for the filter search input. Defaults to "Filter {label}". */
  @Prop({ attribute: 'filter-label' }) filterLabel: string = '';

  /** Text shown when the filter matches no options (localization). */
  @Prop({ attribute: 'no-results-text' }) noResultsText: string = 'No results';

  /** Text shown when there are no options at all (localization). */
  @Prop({ attribute: 'no-options-text' }) noOptionsText: string = 'No options';

  /** Accessible label for the search spinner (localization). */
  @Prop({ attribute: 'searching-label' }) searchingLabel: string = 'Searching';

  /** Text shown in the trigger / menu while `loading` is true. */
  @Prop({ attribute: 'loading-text' }) loadingText: string = 'Loading…';

  /**
   * Show a busy state: the trigger shows a spinner instead of the caret and the
   * host is `aria-busy`, and the menu shows a wavy progress bar instead of the
   * option list. Use while an async dataset loads (e.g. before/around a large
   * `loadOptions`). Replace the trigger spinner with the `loader` slot.
   */
  @Prop({ reflect: true }) loading: boolean = false;

  /** Show a clear (×) button in the trigger that removes all selections. */
  @Prop({ reflect: true }) clearable: boolean = false;

  /** Material Symbols glyph for the clear button. */
  @Prop({ attribute: 'clear-icon' }) clearIcon: string = 'close';

  /** Accessible label for the clear button (localization). */
  @Prop({ attribute: 'clear-label' }) clearLabel: string = 'Clear selection';

  /** Caret glyph (Material Symbol) for the field trigger; rotates 180° when open.
   *  Override the whole glyph with the `dropdown-icon` slot. */
  @Prop({ attribute: 'dropdown-icon' }) dropdownIcon: string = 'arrow_drop_down';

  /** Form name. Selected values submit as repeated `name=value` pairs. */
  @Prop({ reflect: true }) name: string = '';

  /** Open state of the menu. Reflected so `:host([open])` rules apply. */
  @Prop({ mutable: true, reflect: true }) open: boolean = false;

  /** Emits the full selected-value array whenever the selection changes. */
  @Event() mdChange!: EventEmitter<string[]>;

  /** Emits when the menu opens. */
  @Event() mdOpen!: EventEmitter<void>;

  /** Emits when the menu closes. */
  @Event() mdClose!: EventEmitter<void>;

  /** Emits the removed value when a chip is dismissed. */
  @Event() mdRemove!: EventEmitter<string>;

  /** Emits when the clear button empties the selection. */
  @Event() mdClear!: EventEmitter<void>;

  @State() private optionsData: SelectOptionData[] = [];
  @State() private triggerId = `md-multi-select-${++multiSelectIdCounter}`;
  // Only forward the trigger-leading/trailing slots into md-text-field when the
  // consumer actually provides content: md-text-field flags a slotted leading icon
  // purely by the PRESENCE of a [slot="leading-icon"] element, so an empty
  // forwarding <slot> would shift the label and steal the trailing cluster.
  @State() private hasTriggerLeading = false;
  @State() private hasTriggerTrailing = false;
  // Visually-hidden polite live region: announces selection-count and filter-result
  // changes that would otherwise be silent (readonly trigger value / windowed list).
  @State() private liveMessage = '';
  /** A consumer element in `slot="trigger"` REPLACES the built-in field / button.
   *  State, not a plain field: its arrival has to swap what `renderTrigger` emits. */
  @State() private hasSlottedTrigger = false;

  /** Client-side filter query for `filterable` on a NON-virtualized list (the
   *  virtualized path filters through the WASM engine via `vc.setQuery`). */
  @State() private query = '';

  /** chips-inline + chip-overflow="count": how many leading chips fit on the
   *  single line, and how many collapse into the trailing "+N" counter. */
  @State() private inlineVisibleCount = Number.POSITIVE_INFINITY;
  @State() private inlineOverflowCount = 0;

  private inlineDisplayEl?: HTMLElement;
  private inlineMeasureEl?: HTMLElement;
  private _inlineRO?: ResizeObserver;

  private fieldEl?: HTMLElement & { focus?: () => void };
  /** The consumer's trigger element, once wired. Kept so re-wiring can detach
   *  the listener from a trigger that was swapped out. */
  private wiredTrigger: HTMLElement | null = null;
  private menuEl?: VirtualMenuEl;
  private frameEl?: HTMLElement;
  private _frameRO?: ResizeObserver;
  private _needsReposition = false;
  // After removing a chip, move focus to the chip that takes its place (or the
  // previous one, or the trigger) instead of dropping focus to <body>.
  private _focusChipAfterRender: number | 'trigger' | null = null;

  /** Shared virtualization engine (WASM store + window math + provider glue). */
  private vc = new VirtualSelectController({
    queryItem: (i) =>
      (this.el.shadowRoot?.querySelector(
        `md-menu-item[data-vindex="${i}"]`,
      ) as HTMLElement | null) ?? null,
    requestRender: () => forceUpdate(this),
  });
  private providerSet = false;
  /** Labels for the selected values (off-window safe) while virtualized. */
  private selectedLabelMap = new Map<string, string>();
  private searchDebounce?: ReturnType<typeof setTimeout>;
  /** True between a keystroke and the debounced query resolving (drives the spinner). */
  private searching = false;

  private get isDisabled() {
    return this.disabled || this.softDisabled;
  }

  // ── Public API ───────────────────────────────────────────

  /** Open the dropdown programmatically. */
  @Method()
  async show() {
    if (this.isDisabled) return;
    this.open = true;
  }

  /** Close the dropdown programmatically. */
  @Method()
  async close() {
    this.open = false;
  }

  /** Move focus to the trigger field. */
  @Method()
  async focusTrigger() {
    this.fieldEl?.focus?.();
  }

  /** Clear all selections. */
  @Method()
  async reset() {
    if (this.value.length === 0) return;
    this.value = [];
    this.mdChange.emit([]);
  }

  /**
   * Load a large dataset into the WASM-backed virtualized list. Accepts a
   * materialised `SelectOptionInit[]` or a row factory (`{ count, getRow }`) —
   * the factory streams rows into WASM one at a time, so tens of millions of
   * options never exist as JS objects at once. Falls back to plain DOM rendering
   * when `virtualize="never"` or WebAssembly is unavailable.
   */
  @Method()
  async loadOptions(source: SelectOptionInit[] | OptionRowSource) {
    if (this.virtualize === 'never' || !isWasmSupported()) {
      this.loadSeq++;
      this.vc.reset();
      this.optionsData = normalizeInits(rowsToArray(source));
      return;
    }
    const seq = ++this.loadSeq;
    this.optionsData = [];
    this.vc.setFixedRowHeight(this.rowHeight);
    this.vc.setFilterMode(this.filterMode);
    const ok = await this.vc.load(source);
    if (seq !== this.loadSeq) return; // superseded by a newer load/refresh
    if (!ok) {
      // The store declines an empty set (and a WASM failure). Without dropping
      // whatever it still holds, `loadOptions([])` after a populated load left
      // the PREVIOUS rows active and rendering — so a consumer could not clear
      // the list by handing over an empty one.
      this.vc.reset();
      this.optionsData = normalizeInits(rowsToArray(source));
    } else {
      this.updateSelectedLabels();
    }
    forceUpdate(this);
  }

  /** Programmatically filter the virtualized list (mirrors the search field). */
  @Method()
  async setQuery(query: string) {
    this.vc.setQuery(query);
    // The non-virtual path filters off `query`, and the search field is
    // uncontrolled — so drive both, or the list narrows (or doesn't) while the
    // box still reads empty and the call looks like a no-op.
    if (!this.vc.active) this.query = query;
    this.queryText = query;
    this.syncSearchField();
    forceUpdate(this);
  }

  /** Text pushed by `setQuery()`, pending mirroring into the search field. */
  private queryText: string | null = null;

  private syncSearchField() {
    if (this.queryText === null) return;
    const input = this.el.shadowRoot?.querySelector(
      '.md-multi-select__search',
    ) as HTMLInputElement | null;
    if (!input) return;
    input.value = this.queryText;
    this.queryText = null;
  }

  /** Resolve labels for values that may be outside the current filter/window. */
  @Method()
  async getLabels(values: string[]): Promise<Record<string, string>> {
    return Object.fromEntries(this.vc.getLabels(values));
  }

  // ── Lifecycle / reactivity ───────────────────────────────

  /** Initial selection, restored on form reset. */
  private defaultValue: string[] = [];

  componentDidLoad() {
    this.wireSlottedTrigger();
    // @Watch('open') does not fire for the initial value, so a declaratively-open
    // menu (`open` set at load) would render the expanded chrome (caret up,
    // aria-expanded="true") with no actual menu surface. Show it now — without
    // autoFocus, so an initially-open select doesn't steal focus on page load.
    if (this.open && !this.isDisabled) {
      this.menuEl?.show?.({ autoFocus: false });
    }

    // The trigger can MOVE while the menu is open without any scroll/resize —
    // e.g. selecting a value adds a chip beside the button trigger, reflowing the
    // frame and shifting the trigger. md-menu only re-anchors on scroll/resize, so
    // watch the frame and nudge the open menu to follow its anchor.
    if (typeof ResizeObserver !== 'undefined' && this.frameEl) {
      this._frameRO = new ResizeObserver(() => {
        if (this.open) void this.menuEl?.reposition?.();
      });
      this._frameRO.observe(this.frameEl);
    }
  }

  componentWillLoad() {
    this.refreshOptions();
    if (this.value.length === 0) {
      const preselected = this.optionsData
        .filter((o) => o.selected && !o.disabled)
        .map((o) => o.value);
      if (preselected.length) this.value = preselected;
    }
    this.defaultValue = [...this.value];
    this.syncFormValue();
    this.hasTriggerLeading = !!this.el.querySelector('[slot="trigger-leading"]');
    this.hasTriggerTrailing = !!this.el.querySelector('[slot="trigger-trailing"]');
    this.computeSlottedTrigger();
  }

  /** ── Consumer-supplied trigger ─────────────────────────────
   *
   *  `slot="trigger"` takes over from the built-in field / button entirely: any
   *  element works (md-button, md-icon-button, md-fab, a plain button), and the
   *  chips keep their `chip-position` relationship to it, so the opener sits
   *  OUTSIDE the component's own chrome without losing the chip layout.
   *
   *  The element is the consumer's, so it is never re-rendered here — only wired:
   *  a click opens, an id makes it the menu's anchor, and `aria-haspopup`
   *  advertises the popup. All of it is idempotent. */
  private computeSlottedTrigger() {
    this.hasSlottedTrigger = this.el.querySelector('[slot="trigger"]') !== null;
  }

  private onTriggerSlotChange = () => {
    this.computeSlottedTrigger();
    this.wireSlottedTrigger();
  };

  private wireSlottedTrigger() {
    const trigger = this.el.querySelector('[slot="trigger"]') as HTMLElement | null;
    if (!trigger) {
      this.wiredTrigger?.removeEventListener('click', this.toggleOpen);
      this.wiredTrigger = null;
      return;
    }
    if (trigger !== this.wiredTrigger) {
      this.wiredTrigger?.removeEventListener('click', this.toggleOpen);
      trigger.addEventListener('click', this.toggleOpen);
      this.wiredTrigger = trigger;
    }
    // md-menu resolves its anchor by id, falling back to the document — which is
    // exactly where a slotted trigger lives — so stamping our id makes the popup
    // position against the consumer's element. A trigger that already carries an
    // id keeps it, and becomes the anchor under that name instead.
    if (!trigger.id) trigger.id = this.triggerId;
    else if (trigger.id !== this.triggerId) this.triggerId = trigger.id;
    // md-menu sets aria-expanded (and re-asserts haspopup) as it opens; declare
    // the popup up front so the relationship is announced before the first open.
    trigger.setAttribute('aria-haspopup', 'listbox');
    // NB: no aria-controls. The listbox lives in THIS shadow root and the trigger
    // does not — an IDREF cannot cross that boundary, it would simply dangle.
    this.fieldEl = trigger as HTMLElement & { focus?: () => void };
  }

  /** Restore the initial selection when the owning form is reset. */
  formResetCallback() {
    this.value = [...this.defaultValue];
  }

  /** Submit each selected value under `name` as a repeated form field. */
  @Watch('value')
  syncFormValue() {
    this.updateSelectedLabels();
    this.updateValidity();
    // Announce the new selection count — the readonly trigger value / windowed
    // chips change silently otherwise. (Initial content is not announced by a
    // polite live region, so the load-time call here is harmless.)
    this.liveMessage = this.value.length ? `${this.value.length} selected` : 'None selected';
    // A selection change reflows the chips, which can move the trigger (e.g. the
    // button trigger shifts as chips are added beside it). Re-anchor the open menu
    // after the chips render (componentDidRender) — a frame ResizeObserver only
    // catches size changes, not a same-size horizontal shift.
    this._needsReposition = true;
    if (!this.value.length) {
      setFormValue(this.internals, null);
      return;
    }
    const data = new FormData();
    const name = this.name || '';
    for (const v of this.value) data.append(name, v);
    setFormValue(this.internals, data);
  }

  /** Constraint validation: a `required` multi-select is invalid with no selection,
   *  so it blocks form submission and reports like a native required control. */
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
    } else if (this.required && this.value.length === 0) {
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

  /** Monotonic token so a slow WASM load can't clobber a newer options set. */
  private loadSeq = 0;

  @Watch('options')
  refreshOptions() {
    const data = collectOptions(this.el, this.optionList);
    const shouldVirtualize =
      this.virtualize === 'always' ||
      (this.virtualize === 'auto' && data.length > VIRTUALIZE_THRESHOLD);

    if (shouldVirtualize && isWasmSupported() && data.length > 0) {
      const seq = ++this.loadSeq;
      this.optionsData = [];
      this.vc.setFixedRowHeight(this.rowHeight);
      this.vc.setFilterMode(this.filterMode);
      void this.vc.load(data).then((ok) => {
        if (seq !== this.loadSeq) return; // a newer refresh superseded this load
        if (!ok) {
          this.optionsData = data;
          forceUpdate(this);
        } else {
          this.updateSelectedLabels();
        }
      });
    } else {
      this.loadSeq++; // invalidate any in-flight virtual load
      this.vc.reset();
      this.optionsData = data;
    }
  }

  /** Refresh cached labels for the selected values (virtual mode). */
  private updateSelectedLabels() {
    if (this.vc.active && this.value.length) {
      this.selectedLabelMap = this.vc.getLabels(this.value);
    } else {
      this.selectedLabelMap = new Map();
    }
    forceUpdate(this);
  }

  @Listen('mdSelectOptionChange')
  onOptionChange(e: Event) {
    e.stopPropagation();
    this.refreshOptions();
  }

  private _syncGuard = false;
  private _lastEmit: 'open' | 'close' | null = null;

  @Watch('open')
  syncMenu(open: boolean) {
    if (this._syncGuard || !this.menuEl) return;
    // autoFocus moves real focus into the option list so arrow keys navigate it.
    // Only the filterable+virtual case keeps focus on the search input (which owns
    // the listbox via aria-activedescendant). Previously this was always false, so
    // opening left focus on the readonly trigger and the options were unreachable
    // by keyboard.
    // Filterable = combobox: focus the search, not an option (for the virtual
    // list AND the plain-DOM list). From the search, ArrowDown moves focus into
    // the listbox — the "focus moves into the popup" WAI-ARIA combobox variant.
    if (open) this.menuEl.show?.({ autoFocus: !this.filterable });
    else this.menuEl.close?.();
  }

  // ── Keyboard (trigger) ───────────────────────────────────

  @Listen('keydown')
  handleKeyDown(e: KeyboardEvent) {
    if (this.isDisabled) return;
    // APG select-only listbox/combobox: Down/Up/Enter/Space all open the menu.
    if (!this.open && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      this.open = true;
    } else if (this.open && e.key === 'Escape') {
      e.preventDefault();
      this.open = false;
      this.fieldEl?.focus?.();
    }
  }

  // ── Handlers ─────────────────────────────────────────────

  private toggleOpen = () => {
    if (this.isDisabled) return;
    this.open = !this.open;
  };

  private isSelected = (val: string) => this.value.includes(val);

  private toggleValue = (val: string, e?: CustomEvent) => {
    // The option is an md-menu-item whose `mdClick` is composed:true, so without
    // this it escapes our shadow root and surfaces on the page ALONGSIDE our own
    // `mdChange` — a duplicate, internal event for consumers. We consume it here;
    // `mdChange` is the single public "selection changed" signal.
    e?.stopPropagation();
    if (this.isDisabled) return;
    const has = this.isSelected(val);
    const blocked = !has && this.maxSelected > 0 && this.value.length >= this.maxSelected;
    if (blocked) {
      // md-menu-item self-toggles its own `selected` on click (uncontrolled) BEFORE
      // this handler runs, and since `value` doesn't change there is no re-render to
      // reset it — the option would stay visually + aria-selected checked while
      // excluded from value/FormData. Revert the exact item that fired.
      const item = e?.target as (HTMLElement & { selected?: boolean }) | null;
      if (item) item.selected = false;
      return;
    }
    const next = has ? this.value.filter((v) => v !== val) : [...this.value, val];
    this.value = next;
    this.mdChange.emit([...next]);
  };

  private removeValue = (val: string) => (e: CustomEvent | MouseEvent) => {
    e.stopPropagation();
    if ('preventDefault' in e) e.preventDefault();
    if (this.isDisabled || !this.isSelected(val)) return;
    const removedIndex = this.selectedOptions().findIndex((o) => o.value === val);
    this.value = this.value.filter((v) => v !== val);
    this.mdRemove.emit(val);
    this.mdChange.emit([...this.value]);
    // Keyboard/AT focus must not fall to <body> when the focused chip unmounts.
    const remaining = this.selectedOptions().length;
    this._focusChipAfterRender = remaining === 0 ? 'trigger' : Math.min(removedIndex, remaining - 1);
  };

  private clearValue = (e: MouseEvent) => {
    e.stopPropagation(); // don't let the click also toggle the menu open
    if (this.isDisabled || this.value.length === 0) return;
    this.value = [];
    this.mdChange.emit([]);
    this.mdClear.emit();
    this.fieldEl?.focus?.();
  };

  private toggleSelectAll = (e?: CustomEvent) => {
    e?.stopPropagation(); // don't leak the option's internal mdClick — see toggleValue
    if (this.isDisabled) return;
    const eligible = this.optionsData.filter((o) => !o.disabled).map((o) => o.value);
    const allSelected = eligible.length > 0 && eligible.every((v) => this.value.includes(v));
    this.value = allSelected
      ? []
      : eligible.slice(0, this.maxSelected > 0 ? this.maxSelected : undefined);
    this.mdChange.emit([...this.value]);
    // md-menu-item self-toggles its own `selected` on click (uncontrolled) before
    // this handler runs; reconcile it to the TRUE post-update state (the maxSelected
    // cap can make "select all" only partially apply → the row must land on the
    // indeterminate dash, not the tick).
    const item = e?.target as (HTMLElement & { selected?: boolean; indeterminate?: boolean }) | null;
    if (item) {
      const nowAll = eligible.length > 0 && eligible.every((v) => this.value.includes(v));
      item.selected = nowAll;
      item.indeterminate = !nowAll && eligible.some((v) => this.value.includes(v));
    }
  };

  /** True once the vc is wired to the menu's live scroll viewport. */
  private vpWired = false;

  /** Wire the vc to the menu scroll viewport; a null resolve (viewport not
   *  rendered yet — e.g. opened mid-pack showing the uncapped busy bar) just
   *  returns, and componentDidRender retries until the wiring lands. */
  private wireViewport() {
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
      this.wireViewport();
    }
    if (this.filterable) {
      // Same combobox wiring for BOTH the virtual and the plain-DOM list: focus
      // the search and register it so md-menu drives the active option via
      // aria-activedescendant on it (focus stays here while arrowing).
      requestAnimationFrame(() => {
        const input = this.el.shadowRoot?.querySelector('.md-multi-select__search') as HTMLElement | null;
        input?.focus();
        void this.menuEl?.setComboboxElement?.(input);
      });
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
    void this.menuEl?.setComboboxElement?.(null);
    this.vc.detachViewport();
    this.vpWired = false;
    // Clear the non-virtual filter so reopening shows the full list. The search
    // input is uncontrolled, so reset its text too.
    if (this.query) {
      this.query = '';
      const input = this.el.shadowRoot?.querySelector('.md-multi-select__search') as HTMLInputElement | null;
      if (input) input.value = '';
    }
  };

  private onSearchInput = (e: Event) => {
    const q = (e.target as HTMLInputElement).value;
    this.queryText = null; // typing supersedes a pending programmatic query
    if (!this.vc.active) {
      // Non-virtual list: filter the DOM options client-side. Cheap, so it runs
      // synchronously on each keystroke (no spinner, no debounce).
      this.query = q;
      return;
    }
    // Virtualized list: show the spinner immediately, debounce the (expensive)
    // WASM query, then clear the spinner once results are in.
    if (!this.searching) {
      this.searching = true;
      forceUpdate(this);
    }
    clearTimeout(this.searchDebounce);
    this.searchDebounce = setTimeout(() => {
      this.vc.setQuery(q);
      this.searching = false;
      forceUpdate(this);
    }, SEARCH_DEBOUNCE_MS);
  };

  /** Register/clear the virtual provider on the menu once it's rendered. */
  componentDidRender() {
    this.syncSearchField();
    if (!this.menuEl) return;
    if (this.vc.active && !this.providerSet) {
      void this.menuEl.setVirtualProvider?.(this.vc.provider);
      this.providerSet = true;
      // The menu can open BEFORE the data arrives (e.g. `open` while `loading`),
      // when the vc is still inactive — so handleMenuOpen skips the viewport
      // attach and the window never advances past the first page. Wire the
      // combobox now; the viewport wiring is retried below every render until
      // the (capped) scroll viewport actually exists.
      if (this.open && this.filterable) {
        const input = this.el.shadowRoot?.querySelector('.md-multi-select__search') as HTMLElement | null;
        void this.menuEl?.setComboboxElement?.(input);
      }
    } else if (!this.vc.active && this.providerSet) {
      void this.menuEl.setVirtualProvider?.(null);
      this.providerSet = false;
    }
    if (this.open && this.vc.active && !this.vpWired) this.wireViewport();
    // After a selection-driven re-render, re-anchor the open menu to the (possibly
    // moved) trigger on the next frame, once layout has settled.
    if (this._needsReposition) {
      this._needsReposition = false;
      if (this.open) requestAnimationFrame(() => void this.menuEl?.reposition?.());
    }
    // Restore focus after a chip was removed (its element unmounted).
    if (this._focusChipAfterRender !== null) {
      const target = this._focusChipAfterRender;
      this._focusChipAfterRender = null;
      requestAnimationFrame(() => {
        if (target === 'trigger') {
          this.fieldEl?.focus?.();
          return;
        }
        const chips = this.el.shadowRoot?.querySelectorAll<HTMLElement>(
          // Direct-child `> md-chip` for the inline row so the hidden measurement
          // row's chips (nested in .md-multi-select__inline-measure) don't shift
          // the index.
          '.md-multi-select__chips md-chip, .md-multi-select__inline-chips > md-chip',
        );
        // The chips are non-selectable tokens (role=group); their only focusable
        // element is the remove ✕ button — focus THAT, not the inert host.
        const chip = chips?.[target];
        const removeBtn = chip?.shadowRoot?.querySelector<HTMLElement>('[part="remove"]');
        (removeBtn ?? chip ?? (this.fieldEl as HTMLElement | undefined))?.focus?.();
      });
    }

    // chips-inline + chip-overflow="count": (re)measure how many chips fit and
    // observe the field so the "+N" counter tracks selection AND width changes.
    if (this.trigger === 'field' && this.displayMode === 'chips-inline' && this.chipOverflow === 'count') {
      if (typeof ResizeObserver !== 'undefined') {
        if (!this._inlineRO) this._inlineRO = new ResizeObserver(this.recomputeInlineOverflow);
        this._inlineRO.disconnect();
        // Observe BOTH: the display row (available width) and the measurement row
        // (its size settles when the md-chips finish hydrating → real widths).
        if (this.inlineDisplayEl) this._inlineRO.observe(this.inlineDisplayEl);
        if (this.inlineMeasureEl) this._inlineRO.observe(this.inlineMeasureEl);
      }
      requestAnimationFrame(this.recomputeInlineOverflow);
    } else {
      this._inlineRO?.disconnect();
    }
  }

  disconnectedCallback() {
    this.wiredTrigger?.removeEventListener('click', this.toggleOpen);
    this.wiredTrigger = null;
    clearTimeout(this.searchDebounce);
    this.vc.detachViewport();
    this._frameRO?.disconnect();
    this._frameRO = undefined;
    this._inlineRO?.disconnect();
    this._inlineRO = undefined;
  }

  // ── Derived ──────────────────────────────────────────────

  private selectedOptions(): SelectOptionData[] {
    if (this.vc.active) {
      // Labels resolved from WASM — selections may be outside the filter/window.
      return this.value.map((v) => ({
        value: v,
        label: this.selectedLabelMap.get(v) ?? v,
        disabled: false,
      }));
    }
    return this.value
      .map((v) => this.optionsData.find((o) => o.value === v))
      .filter((o): o is SelectOptionData => !!o);
  }

  private countText(): string {
    const n = this.value.length;
    if (n === 0) return '';
    return this.countFormatter ? this.countFormatter(n) : `${n} selected`;
  }

  // ── Render ───────────────────────────────────────────────

  /** The slot is rendered UNCONDITIONALLY — it is what tells us a trigger arrived.
   *  Rendering it only once `hasSlottedTrigger` is true would mean a trigger added
   *  later has nothing to project into, and `slotchange` would never fire. */
  private renderTrigger() {
    return [
      <slot name="trigger" onSlotchange={this.onTriggerSlotChange} />,
      this.hasSlottedTrigger
        ? this.renderTriggerMessage()
        : this.trigger === 'button'
          ? this.renderButtonTrigger()
          : this.renderFieldTrigger(),
    ];
  }

  private renderFieldTrigger() {
    const selected = this.selectedOptions();
    const hasValue = selected.length > 0;

    const isInline = this.displayMode === 'chips-inline';

    // The trigger's accessible VALUE summarises the selection so the field is
    // announced with its content and the floating label floats. 'text' mode uses
    // the joined labels; 'chips'/'count' use the count summary. 'chips-inline'
    // renders the chips INSIDE the field (via md-text-field's non-aria-hidden
    // `chips` slot), so it carries no text value — the slotted chips are the
    // content (and float the label via the field's hasSlottedChips signal).
    const displayValue = isInline
      ? ''
      : this.displayMode === 'text' && hasValue
        ? selected.map((o) => o.label).join(', ')
        : hasValue
          ? this.countText()
          : '';

    return (
      <md-text-field
        ref={(el) => (this.fieldEl = el as HTMLElement)}
        id={this.triggerId}
        class="md-multi-select__field"
        part="field"
        exportparts="container:field-container,input:field-input,label:field-label"
        variant={this.variant}
        label={this.label}
        placeholder={hasValue ? '' : this.placeholder}
        value={displayValue}
        readOnly={true}
        disabled={this.disabled}
        error={this.error}
        errorText={this.errorText}
        reserveSupportingSpace={this.reserveSupportingSpace}
        supportingText={this.supportingText}
        required={this.required}
        // Chips beside the field (left/right) read best against a COMPACT trigger
        // so the field height is closer to the 32px chips it sits next to.
        density={this.chipPosition === 'left' || this.chipPosition === 'right' ? -3 : this.density}
        appearFocused={this.open}
        // chips-inline: let the field grow only when overflow="wrap"; the default
        // "count" mode keeps a single line and collapses extras into "+N".
        chipsWrap={isInline && this.chipOverflow === 'wrap'}
        onClick={this.toggleOpen}
      >
        {/* Custom leading content in the trigger (e.g. an icon or avatar). Only
            forwarded when actually provided — an empty forwarding slot would make
            md-text-field reserve leading-icon space and mis-align the label. */}
        {this.hasTriggerLeading && <slot name="trigger-leading" slot="leading-icon"></slot>}
        {isInline && this.renderInlineChips()}
        {/* Custom trailing content, before the clear/caret cluster. Conditional so
            an empty slot doesn't become the "first" trailing-icon and break the
            clear button's interactive-trailing detection. */}
        {this.hasTriggerTrailing && <slot name="trigger-trailing" slot="trailing-icon"></slot>}
        {this.loading ? (
          // Busy state: a spinner replaces the clear/caret cluster. Consumers can
          // swap it via the `loader` slot; the default is md-loading-indicator.
          <span slot="trailing-icon" class="md-multi-select__loader" part="loading-spinner">
            <slot name="loader">
              <md-loading-indicator label={this.loadingText}></md-loading-indicator>
            </slot>
          </span>
        ) : (
          [
            this.clearable && hasValue && !this.isDisabled && (
              // A real <button> in the trailing slot: md-text-field detects it as an
              // interactive trailing control and un-hides the trailing wrapper, so this
              // clear button is keyboard-reachable and announced (unlike a decorative
              // caret). It sits before the caret.
              <button
                type="button"
                slot="trailing-icon"
                class="md-multi-select__clear"
                part="clear"
                aria-label={this.clearLabel}
                onClick={this.clearValue}
              >
                <span class="material-symbols-outlined" aria-hidden="true">{this.clearIcon}</span>
              </button>
            ),
            // The caret is NESTED one level down, not slotted directly. md-text-field
            // sizes the top-level slotted node with `font-size: var(--_icon-size)
            // !important`, which tapers with density — and `::slotted()` matches only
            // that top-level node, so a glyph one level in is out of its reach and
            // keeps its own 24px. This is the same reason md-select's caret sits
            // inside `.md-select__trailing`; without it the two carets drift apart at
            // every density rung below 0.
            <span
              slot="trailing-icon"
              class="md-multi-select__caret-box"
              part="caret-box"
              aria-hidden="true"
            >
              <span class="md-multi-select__caret material-symbols-outlined" part="caret">
                <slot name="dropdown-icon">{this.dropdownIcon}</slot>
              </span>
            </span>,
          ]
        )}
      </md-text-field>
    );
  }

  /** Compact button trigger: opens the drawer; the selection shows as chips
   *  beside it. Uses the library's md-button (role="button" on its host, which is
   *  the focusable element) so aria-haspopup/controls sit on the trigger and
   *  resolve to the listbox in this shadow root. */
  private renderButtonTrigger() {
    // The field trigger delegates required/error/supporting to md-text-field; the
    // button path must wire the equivalent ARIA + a visible message itself.
    const descText = this.error && this.errorText ? this.errorText : this.supportingText;
    const descId = descText ? `${this.triggerId}-desc` : undefined;
    return [
      <md-button
        ref={(el) => (this.fieldEl = el as HTMLElement)}
        id={this.triggerId}
        class="md-multi-select__button"
        part="field button"
        variant="outlined"
        size="xs"
        icon={this.triggerIcon}
        loading={this.loading}
        disabled={this.isDisabled}
        aria-haspopup="listbox"
        aria-expanded={String(this.open)}
        aria-controls={this.listboxRendered ? `${this.triggerId}-listbox` : undefined}
        // aria-required is not allowed on role="button"; required is conveyed via
        // the described-by message + form validity (ElementInternals). aria-invalid
        // is a global state and is allowed.
        aria-invalid={this.error ? 'true' : undefined}
        aria-describedby={descId}
        onMdClick={this.toggleOpen}
      >
        {this.triggerLabel || this.label}
      </md-button>,
      this.renderTriggerMessage(),
    ];
  }

  /** Supporting / error line for the trigger paths md-text-field does not own —
   *  the button trigger and a slotted one. The id is only emitted when something
   *  can actually reference it: a slotted trigger lives in the light DOM, where an
   *  IDREF into this shadow root would dangle, so an error there is announced by
   *  role="alert" instead of aria-describedby. */
  private renderTriggerMessage() {
    const descText = this.error && this.errorText ? this.errorText : this.supportingText;
    if (!descText) return null;
    return (
      <div
        id={this.hasSlottedTrigger ? undefined : `${this.triggerId}-desc`}
        class={{
          'md-multi-select__button-desc': true,
          'md-multi-select__button-desc--error': this.error && !!this.errorText,
        }}
        part="button-desc"
        role={this.error ? 'alert' : undefined}
      >
        {descText}
      </div>
    );
  }

  /** The role=listbox (id `${triggerId}-listbox`) exists when open and not loading,
   *  except the non-virtual empty state which renders the empty message instead —
   *  so aria-controls only points at a listbox that is actually in the DOM. */
  private get listboxRendered(): boolean {
    return this.open && !this.loading && (this.vc.active || this.optionsData.length > 0);
  }

  /** A single removable value token. Shared by the inline display row and the
   *  hidden measurement row. */
  private renderValueChip = (opt: SelectOptionData) => (
    <md-chip
      key={opt.value}
      part="chip"
      exportparts="remove:chip-remove,label:chip-label"
      variant="input"
      // A display token of a selected value — clicking the body must not
      // toggle a misleading "active"/selected state; only ✕ removes it.
      selectable={false}
      label={opt.label}
      disabled={this.isDisabled}
      removable={!this.isDisabled}
      onMdRemove={this.removeValue(opt.value)}
      onClick={(e: MouseEvent) => e.stopPropagation()}
    ></md-chip>
  );

  /** Chips slotted INSIDE the field (display-mode="chips-inline") via md-text-field's
   *  `chips` slot — in the input flow, not the aria-hidden icon slot. In `count`
   *  overflow mode the chips that don't fit collapse into a trailing "+N" chip
   *  (the visible count is computed in {@link recomputeInlineOverflow}); in `wrap`
   *  mode all chips render and the field grows. */
  private renderInlineChips() {
    const selected = this.selectedOptions();
    if (selected.length === 0) return null;

    const isWrap = this.chipOverflow === 'wrap';
    const visible = isWrap ? selected.length : Math.min(selected.length, this.inlineVisibleCount);
    const overflow = isWrap ? 0 : selected.length - visible;

    return (
      <div
        slot="chips"
        class={{
          'md-multi-select__inline-chips': true,
          'md-multi-select__inline-chips--wrap': isWrap,
        }}
        part="chips"
        role="group"
        aria-label={this.label ? `${this.label} — selected` : 'Selected'}
        ref={(el) => (this.inlineDisplayEl = el as HTMLElement)}
      >
        {selected.slice(0, visible).map(this.renderValueChip)}
        {overflow > 0 && (
          <button
            type="button"
            class="md-multi-select__overflow-chip"
            part="overflow-chip"
            aria-label={`${overflow} more selected — open to manage`}
            // Stop the bubble to the field's onClick so we toggle exactly once.
            onClick={(e: MouseEvent) => { e.stopPropagation(); this.toggleOpen(); }}
          >
            +{overflow}
          </button>
        )}
      </div>
    );
  }

  /** Hidden, out-of-flow measurement row rendered in THIS component's shadow (not
   *  slotted into the field, so consumers querying `[slot="chips"] md-chip` never
   *  see duplicates). Chip widths are intrinsic (label + padding), so measuring
   *  here matches what they'd render at inside the field. Only present for the
   *  count-overflow path that needs it. */
  private renderInlineMeasure() {
    if (this.trigger !== 'field' || this.displayMode !== 'chips-inline' || this.chipOverflow !== 'count') return null;
    const selected = this.selectedOptions();
    if (selected.length === 0) return null;
    return (
      // Zero-size, overflow-clipped wrapper: contains the natural-width row so it
      // never creates page scrollbars; the row itself is visibility:hidden so its
      // remove buttons aren't tab stops (still laid out → measurable).
      <div class="md-multi-select__measure-clip" aria-hidden="true">
        <div class="md-multi-select__inline-measure" ref={(el) => (this.inlineMeasureEl = el as HTMLElement)}>
          {selected.map(this.renderValueChip)}
          <span class="md-multi-select__overflow-chip">+{selected.length}</span>
        </div>
      </div>
    );
  }

  /** Measure how many leading chips fit on the single line and collapse the rest
   *  into the "+N" counter. Idempotent: it reads intrinsic chip widths from the
   *  hidden measurement row (stable regardless of how many are currently shown)
   *  and the available width from the display row (which fills the field), so
   *  re-running after its own state change converges without looping. */
  private recomputeInlineOverflow = () => {
    if (this.trigger !== 'field' || this.displayMode !== 'chips-inline' || this.chipOverflow !== 'count') return;
    const display = this.inlineDisplayEl;
    const measure = this.inlineMeasureEl;
    const total = this.selectedOptions().length;
    if (!display || !measure || total === 0) return;
    const avail = display.clientWidth;
    if (avail <= 0) return; // not laid out yet

    const gapStr = getComputedStyle(measure).columnGap || getComputedStyle(measure).gap;
    const gap = parseFloat(gapStr) || 4;
    const chipEls = Array.from(measure.querySelectorAll('md-chip')) as HTMLElement[];
    const widths = chipEls.slice(0, total).map((c) => c.getBoundingClientRect().width);
    if (widths.some((w) => w <= 0)) return; // chips not hydrated/measured yet — retry on next RO tick
    const plusEl = measure.querySelector('.md-multi-select__overflow-chip') as HTMLElement | null;
    const plusW = plusEl ? plusEl.getBoundingClientRect().width : 44;

    // Does the whole set fit? (no counter needed)
    let sumAll = 0;
    for (let i = 0; i < total; i++) sumAll += widths[i] + (i > 0 ? gap : 0);

    let visible: number;
    if (sumAll <= avail + 0.5) {
      visible = total;
    } else {
      const budget = avail - plusW - gap; // reserve the "+N" counter
      let used = 0;
      visible = 0;
      for (let i = 0; i < total; i++) {
        const add = widths[i] + (i > 0 ? gap : 0);
        if (used + add <= budget) { used += add; visible++; } else break;
      }
    }

    if (visible !== this.inlineVisibleCount || total - visible !== this.inlineOverflowCount) {
      this.inlineVisibleCount = visible;
      this.inlineOverflowCount = total - visible;
    }
  };

  /** Removable selection chips, rendered in the host shadow (NOT the field's
   *  aria-hidden icon slot) so they are visible to assistive tech and their remove
   *  buttons are operable and announced. */
  private renderChips() {
    // The button trigger has no in-field value display, so it always shows chips;
    // the field trigger shows them only in display-mode="chips".
    // A slotted trigger has no in-field value display either, so it behaves like
    // the button trigger: the selection IS the chips beside it.
    if (this.trigger !== 'button' && !this.hasSlottedTrigger && this.displayMode !== 'chips')
      return null;
    const selected = this.selectedOptions();
    if (selected.length === 0) return null;
    return (
      // role="group" (not "list"): md-chip forces its own Host role="button", so a
      // role="listitem" on the chip would be clobbered and a role="list" would report
      // as an empty list. A labelled group of buttons is the accurate structure.
      <div
        class="md-multi-select__chips"
        part="chips"
        role="group"
        aria-label={this.label ? `${this.label} — selected` : 'Selected'}
      >
        {selected.map((opt) => (
          <md-chip
            key={opt.value}
            part="chip"
            exportparts="remove:chip-remove,label:chip-label"
            variant="input"
            // A display token of a selected value — clicking the body must not
            // toggle a misleading "active"/selected state; only ✕ removes it.
            selectable={false}
            label={opt.label}
            disabled={this.isDisabled}
            removable={!this.isDisabled}
            onMdRemove={this.removeValue(opt.value)}
            onClick={(e: MouseEvent) => e.stopPropagation()}
          ></md-chip>
        ))}
      </div>
    );
  }

  private renderVirtualOptions() {
    // A role="listbox" wrapper (in this shadow root, so the combobox input's
    // aria-controls/aria-activedescendant IDREFs resolve) that directly owns its
    // role="option" children — the WAI-ARIA multiselectable listbox structure.
    return (
      <div
        class="md-multi-select__listbox"
        part="listbox"
        role="listbox"
        id={`${this.triggerId}-listbox`}
        aria-multiselectable="true"
        aria-label={this.label || 'Options'}
      >
        <div
          class="md-multi-select__vspacer"
          style={{ height: `${this.vc.topPad}px` }}
          aria-hidden="true"
        ></div>
        {this.vc.windowRows.map((row, i) => {
          const filteredIndex = this.vc.windowStart + i;
          const selected = this.isSelected(row.value);
          return (
            <md-menu-item
              key={row.index}
              // Stable id so md-menu can point aria-activedescendant here.
              id={`${this.triggerId}-opt-${filteredIndex}`}
              data-vindex={filteredIndex}
              // presentation="option" → role="option" + aria-selected (the listbox
              // multiselectable pattern), not menuitemcheckbox.
              presentation="option"
              type="checkbox"
              check-position="start"
              keep-open
              part={selected ? 'option option-selected' : 'option'}
              disabled={row.disabled}
              selected={selected}
              headline={row.label}
              supporting-text={row.supportingText || ''}
              aria-setsize={this.vc.filteredLength}
              aria-posinset={filteredIndex + 1}
              onMdClick={(e: CustomEvent) => this.toggleValue(row.value, e)}
            >
              {row.icon ? (
                <span
                  slot="leading-icon"
                  part="option-icon"
                  // Per-option `iconColor` is not carried on the virtualized (WASM)
                  // path — the byte-packed row store has no colour column — so
                  // virtual rows fall back to --md-multi-select-option-icon-color.
                  class="material-symbols-outlined md-multi-select__option-icon"
                  aria-hidden="true"
                >
                  {row.icon}
                </span>
              ) : null}
              {/* No light-DOM label copy: md-menu-item renders `headline` in its
                  shadow, so an unslotted text child would double the option's
                  accessible name ("Apple Apple"). */}
            </md-menu-item>
          );
        })}
        <div
          class="md-multi-select__vspacer"
          style={{ height: `${this.vc.bottomPad}px` }}
          aria-hidden="true"
        ></div>
      </div>
    );
  }

  /** Empty-state message with a `no-options` / `no-results` slot so a consumer can
   *  replace the plain text with custom markup (illustration, CTA, etc.). */
  private renderEmpty(slotName: 'no-options' | 'no-results', text: string) {
    return (
      <div class="md-multi-select__empty" part="empty" role="status">
        <slot name={slotName}>{text}</slot>
      </div>
    );
  }

  private renderMenu() {
    const virtual = this.vc.active;
    const eligible = this.optionsData.filter((o) => !o.disabled);
    const allSelected = eligible.length > 0 && eligible.every((o) => this.value.includes(o.value));
    const someSelected = !allSelected && eligible.some((o) => this.value.includes(o.value));
    // Non-virtual `filterable`: filter the DOM options client-side by label /
    // supporting text (case-insensitive). Virtual filtering runs in the WASM engine.
    const q = this.filterable && !virtual ? this.query.trim().toLowerCase() : '';
    const listOptions = q
      ? this.optionsData.filter(
          (o) => o.label.toLowerCase().includes(q) || (o.supportingText || '').toLowerCase().includes(q),
        )
      : this.optionsData;
    // Empty states are rendered HERE (not via md-menu's text-only empty-text) so
    // they carry the `no-options` / `no-results` slots for custom markup.
    const showNoResults =
      !this.loading && ((virtual && this.vc.filteredLength === 0) || (!virtual && !!q && listOptions.length === 0));
    const showNoOptions = !this.loading && !virtual && !q && this.optionsData.length === 0;
    // Virtualization needs a bounded viewport to scroll within.
    const menuMaxHeight = virtual ? (this.maxHeight ?? 320) : this.maxHeight;

    return (
      <md-menu
        ref={(el) => (this.menuEl = el as VirtualMenuEl)}
        anchor={this.triggerId}
        placement={this.placement}
        match-anchor-width={this.matchTriggerWidth}
        max-height={menuMaxHeight}
        // Filterable = combobox: the search owns focus (md-menu drives the active
        // option via aria-activedescendant), so don't auto-focus the first option.
        auto-focus={!this.filterable}
        empty-text=""
        // Present the popup as a WAI-ARIA listbox (not a menu) and name it, so the
        // trigger advertises a listbox popup consistently and options are `option`s.
        listbox
        list-label={this.label || 'Options'}
        part="menu"
        exportparts="surface:menu-surface,empty-text"
        onMdOpen={this.handleMenuOpen}
        onMdClose={this.handleMenuClose}
      >
        {/* Custom pinned header content above the built-in search / select-all.
            Empty (zero-height) when nothing is slotted. */}
        <div slot="header" part="menu-header" class="md-multi-select__menu-header">
          <slot name="menu-header"></slot>
        </div>
        {this.filterable && !this.loading && (
          <div slot="header" class="md-multi-select__search-wrap" part="search-wrap">
            <input
              class="md-multi-select__search"
              part="search"
              type="text"
              // WAI-ARIA combobox: this input owns focus while the listbox is open;
              // md-menu conveys the active option via aria-activedescendant, and
              // aria-controls points at the listbox wrapper rendered in this shadow root.
              role="combobox"
              aria-haspopup="listbox"
              aria-expanded={String(this.open)}
              aria-controls={`${this.triggerId}-listbox`}
              aria-autocomplete="list"
              autocomplete="off"
              placeholder={this.searchPlaceholder}
              aria-label={this.filterLabel || (this.label ? `Filter ${this.label}` : 'Filter options')}
              onInput={this.onSearchInput}
              onClick={(e: MouseEvent) => e.stopPropagation()}
            />
            {this.searching && (
              <md-loading-indicator
                class="md-multi-select__search-spinner"
                part="search-spinner"
                label={this.searchingLabel}
                aria-hidden="true"
              ></md-loading-indicator>
            )}
          </div>
        )}
        {/* "Select all" is a bulk action pinned in the menu header — styled exactly
            like an option (an md-menu-item with a start-check glyph: tick when all
            selected, dash when some, blank when none) rather than a heavy checkbox
            square. It isn't a listbox value, so it lives in its own role="group"
            (a valid parent for the menuitemcheckbox) above the scrolling options,
            and is skipped for virtualized data (would materialise every value). */}
        {this.showSelectAll && !virtual && !this.loading && this.optionsData.length > 0 && (
          <div slot="header" class="md-multi-select__select-all" part="select-all">
            <md-menu-item
              type="checkbox"
              check-position="start"
              part="select-all-item"
              // A bulk "select all" toggle is a tri-state CHECKBOX, not a menu item
              // (no menu context in a listbox popup) — role="checkbox" keeps
              // aria-checked without the menuitemcheckbox required-parent violation.
              role-override="checkbox"
              keep-open
              headline={this.selectAllLabel}
              selected={allSelected}
              indeterminate={someSelected}
              disabled={this.isDisabled}
              onMdClick={(e: CustomEvent) => this.toggleSelectAll(e)}
            ></md-menu-item>
          </div>
        )}
        {this.loading ? (
          // Busy state inside the menu: a wavy (M3 Expressive) indeterminate linear
          // progress bar instead of the option list or "Loading…" text.
          <div class="md-multi-select__loading" part="loading-bar" role="status" aria-label={this.loadingText}>
            <slot name="menu-loader">
              <md-progress-indicator
                variant="linear"
                indeterminate
                wave
                part="loading-progress"
                label={this.loadingText}
              ></md-progress-indicator>
            </slot>
          </div>
        ) : virtual ? (
          // Keep the (empty) listbox so aria-controls resolves; add the no-results
          // slot beside it when the filter matches nothing.
          [this.renderVirtualOptions(), showNoResults ? this.renderEmpty('no-results', this.noResultsText) : null]
        ) : showNoOptions ? (
          this.renderEmpty('no-options', this.noOptionsText)
        ) : (
          // Plain-DOM list. `listOptions` is the client-side filtered set for
          // `filterable`; the listbox always renders (empty on no match) so the
          // search's aria-controls resolves, with the no-results slot beside it.
          [
            <div
              class="md-multi-select__listbox"
              part="listbox"
              role="listbox"
              id={`${this.triggerId}-listbox`}
              aria-multiselectable="true"
              aria-label={this.label || 'Options'}
            >
              {listOptions.map((opt, i) => {
                const selected = this.isSelected(opt.value);
                return (
                  <md-menu-item
                    key={opt.value}
                    // Index-based id (not value-based) so two options that share a
                    // value cannot mint duplicate DOM ids in this shadow root.
                    id={`${this.triggerId}-opt-${i}`}
                    presentation="option"
                    type="checkbox"
                    check-position="start"
                    keep-open
                    part={selected ? 'option option-selected' : 'option'}
                    disabled={opt.disabled}
                    selected={selected}
                    headline={opt.label}
                    supporting-text={opt.supportingText || ''}
                    onMdClick={(e: CustomEvent) => this.toggleValue(opt.value, e)}
                  >
                    {opt.icon ? (
                      <span
                        slot="leading-icon"
                        part="option-icon"
                        class="material-symbols-outlined md-multi-select__option-icon"
                        style={opt.iconColor ? { color: opt.iconColor } : undefined}
                        aria-hidden="true"
                      >
                        {opt.icon}
                      </span>
                    ) : null}
                    {/* No light-DOM label child — headline already names the option. */}
                  </md-menu-item>
                );
              })}
            </div>,
            showNoResults ? this.renderEmpty('no-results', this.noResultsText) : null,
          ]
        )}
      </md-menu>
    );
  }

  render() {
    return (
      <Host
        class={{
          'md-multi-select': true,
          [`md-multi-select--${this.variant}`]: true,
          'md-multi-select--open': this.open,
          'md-multi-select--disabled': this.disabled,
          'md-multi-select--soft-disabled': this.softDisabled,
          'md-multi-select--loading': this.loading,
          [`md-multi-select--display-${this.displayMode}`]: true,
          'md-multi-select--button': this.trigger === 'button' && !this.hasSlottedTrigger,
          'md-multi-select--slotted-trigger': this.hasSlottedTrigger,
          [`md-multi-select--chips-${this.chipPosition}`]:
            this.trigger === 'button' ||
            this.hasSlottedTrigger ||
            this.displayMode === 'chips',
        }}
        aria-haspopup="listbox"
        // NB: no aria-expanded on the host. The host has no role, so a screen
        // reader IGNORES aria-expanded here (axe flags it "aria attribute may be
        // ignored") — it was never announced. The open/closed state is conveyed
        // where it actually works: the button trigger (role=button) and the
        // filterable search (role=combobox) carry their own aria-expanded, and on
        // open focus moves into the menu (the search, or md-menu's first option).
        aria-busy={this.loading ? 'true' : undefined}
      >
        {/* Trigger + its below/around chips share a positioning frame so
            chip-position (top/bottom/left/right) is a flex-direction choice. */}
        <div class="md-multi-select__frame" part="frame" ref={(el) => (this.frameEl = el as HTMLElement)}>
          {this.renderTrigger()}
          {this.renderChips()}
        </div>
        {this.renderInlineMeasure()}
        {this.renderMenu()}
        {/* Polite live region for selection-count / filter-result announcements. */}
        <div class="md-multi-select__sr-live" part="live-region" role="status" aria-live="polite" aria-atomic="true">
          {this.liveMessage}
        </div>
        <div class="md-multi-select__options" hidden>
          <slot onSlotchange={() => this.refreshOptions()} />
        </div>
      </Host>
    );
  }
}
