import { AttachInternals, Component, Element, Event, EventEmitter, Host, Listen, Method, Prop, State, Watch, forceUpdate, h } from '@stencil/core';
import {
  collectOptions,
  labelFor,
  normalizeInits,
  OptionRowSource,
  rowsToArray,
  SelectOptionData,
  SelectOptionInit,
} from '../../utils/select-options';
import {
  setFormValue,
  setValidityState,
  checkValidityOf,
  reportValidityOf,
  getValidityOf,
} from '../../utils/form';
import { VirtualSelectController } from '../../utils/virtual-select-controller';
import { isWasmSupported, FilterMode } from '../../utils/wasm-option-store';
import { VirtualMenuProvider } from '../../utils/types';
import { parseJsonArrayProp } from '../../utils/json-prop';

let selectIdCounter = 0;

/** Above this many options, `virtualize="auto"` switches to the WASM path. */
const VIRTUALIZE_THRESHOLD = 200;

/** Idle time after a keystroke before the search query runs (debounce). */
const SEARCH_DEBOUNCE_MS = 180;

type VirtualMenuEl = HTMLElement & {
  show?: (opts?: { autoFocus?: boolean }) => Promise<void>;
  close?: () => Promise<void>;
  setVirtualProvider?: (p: VirtualMenuProvider | null) => Promise<void>;
  setComboboxElement?: (el: HTMLElement | null) => Promise<void>;
  getScrollViewport?: () => Promise<HTMLElement | null>;
};

/**
 * `md-select` — Material Design 3 single-select dropdown.
 *
 * Composes the library's own primitives instead of re-implementing them:
 *   - `md-text-field` is the trigger surface, so the picker inherits the
 *     full filled/outlined visuals, density scale, floating label, error
 *     state, supporting text, and focus ring of every other input. It is
 *     `readonly` (not editable) and `appear-focused` while the menu is open
 *     so the field + menu read as one connected control.
 *   - `md-menu` is the option surface, so the picker inherits open/close
 *     motion, viewport-aware positioning, single-open coordination, roving
 *     tabindex, type-ahead, and Escape/Home/End — for free.
 *
 * Options are authored either declaratively as slotted `<md-select-option>`
 * children (primary API) or via the programmatic `options` array. Each
 * becomes a `type="radio"` `md-menu-item` so only one is ever selected.
 *
 * @slot - `md-select-option` children for the dropdown (primary authoring API).
 * @slot dropdown-icon - Replaces the caret glyph (e.g. a custom SVG). Rotates 180° when open.
 * @slot loader - Replaces the busy-state spinner shown in the trigger while `loading`.
 *
 * @part field - The inner `md-text-field` trigger surface.
 * @part field-container - The text-field's container box (border/fill).
 * @part trailing - The trailing cluster wrapping the clear + caret.
 * @part clear - The clear (✕) `md-icon-button`.
 * @part caret - The dropdown caret glyph.
 * @part loading-spinner - The busy-state spinner in the trigger (`loading`).
 * @part loading-bar - The busy-state container in the menu (`loading`).
 * @part loading-progress - The wavy progress indicator shown in the menu while `loading`.
 * @part menu - The `md-menu` option surface.
 * @part option - Each option row (`md-menu-item`).
 * @part option-selected - The currently selected option row.
 * @part option-icon - An option's leading icon.
 * @part search - The filter input (`filterable`).
 * @part search-spinner - The in-menu spinner shown while filtering.
 */
@Component({
  tag: 'md-select',
  styleUrl: 'md-select.css',
  shadow: true,
  formAssociated: true,
})
export class MdSelect {
  @Element() el!: HTMLElement;


  /**
   * Localized constraint-validation message shown when `required` is unmet.
   *
   * A prop rather than a hardcoded string, matching md-time-picker's
   * `value-missing-label`: components stay i18n-engine-agnostic and the
   * consumer localizes through its own dictionary. Native inputs get their
   * message from the browser's locale for free; a form-associated custom
   * element supplies its own, so leaving this hardcoded would ship an
   * English-only form to every locale.
   */
  @Prop({ attribute: 'value-missing-label' }) valueMissingLabel: string =
    'Please select an item in the list.';


  /**
   * Always occupy the supporting-text line, even when there is no message, so a
   * validation error does not push the content below it down. Forwarded to the
   * embedded md-text-field. See that component for why it is opt-in.
   */
  @Prop({ attribute: 'reserve-supporting-space' }) reserveSupportingSpace: boolean = false;

  /** Message set via setCustomValidity(); non-empty wins over valueMissing. */
  private customValidityMessage = '';

  /**
   * Form-association handle. The select submits its `value` under the host's
   * `name` via `setFormValue`, so it participates in `<form>`/`FormData`
   * natively — a hidden `<input>` in the shadow root would be invisible to
   * `FormData`.
   */
  @AttachInternals() internals!: ElementInternals;

  /** Visual variant — forwarded to the inner `md-text-field`. */
  @Prop({ reflect: true }) variant: 'filled' | 'outlined' = 'outlined';

  /** Floating label / accessible name. */
  @Prop() label: string = '';

  /** Placeholder shown when no value is selected. */
  @Prop() placeholder: string = '';

  /** Selected option value. Empty string = nothing selected. */
  @Prop({ mutable: true, reflect: true }) value: string = '';

  /** Disabled — non-interactive. */
  @Prop({ reflect: true }) disabled: boolean = false;

  /** Required (form validation parity). */
  @Prop({ reflect: true }) required: boolean = false;

  /** Error state — forwarded to the inner field. */
  @Prop({ reflect: true }) error: boolean = false;

  /** Error text rendered in place of supporting text when `error` is set. */
  @Prop({ attribute: 'error-text' }) errorText: string = '';

  /** Supporting / helper text rendered below the field. */
  @Prop({ attribute: 'supporting-text' }) supportingText: string = '';

  /** Density forwarded to the inner field (0 = comfortable … -3 = compact). */
  @Prop({ reflect: true }) density: 0 | -1 | -2 | -3 | -4 = 0;

  /** Show a clear (✕) button in the trigger when a value is selected. */
  @Prop({ reflect: true }) clearable: boolean = false;

  /**
   * Match the dropdown width to the trigger width. When `false` the menu
   * sizes to its content (down to its own min-width). Maps to `md-menu`'s
   * `match-anchor-width`. Default `true` — the expected select behaviour.
   */
  @Prop({ attribute: 'match-trigger-width', reflect: true })
  matchTriggerWidth: boolean = true;

  /** Menu placement relative to the trigger — forwarded to `md-menu`. */
  @Prop() placement: 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end' =
    'bottom-start';

  /**
   * Cap the dropdown height. When the options exceed it the list scrolls
   * vertically with top/bottom edge shadows. A number is pixels; any CSS
   * length is passed through (e.g. `'50vh'`). Forwarded to `md-menu`'s
   * `max-height`.
   */
  @Prop({ attribute: 'max-height' }) maxHeight?: number | string;

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
    return parseJsonArrayProp<SelectOptionInit>(this.options, 'md-select', 'options');
  }

  /**
   * Virtualization mode for large option lists (backed by a WASM data engine):
   *   - `'auto'` (default): virtualize only above `VIRTUALIZE_THRESHOLD` rows.
   *   - `'always'`: always virtualize the `options` / `loadOptions` dataset.
   *   - `'never'`: keep the classic DOM rendering regardless of size.
   * Virtualized rows render label + selection only (no per-row icon /
   * supporting text) and assume a uniform row height.
   */
  @Prop() virtualize: 'auto' | 'always' | 'never' = 'auto';

  /**
   * Show a search field in the menu header.
   *
   * A plain list filters client-side on label / supporting text; a virtualized
   * one filters inside the WASM engine. Closing the menu clears the query.
   */
  @Prop() filterable: boolean = false;

  /** Filter strategy used by `filterable` / `setQuery`. */
  @Prop({ attribute: 'filter-mode' }) filterMode: FilterMode = 'substring';

  /** Fixed virtualized row height (px). Auto-measured from the first row if unset. */
  @Prop({ attribute: 'row-height' }) rowHeight?: number;

  /** Form field name. The selected value is submitted under this name. */
  @Prop({ reflect: true }) name: string = '';

  // ── Localizable UI strings ───────────────────────────────
  // Defaults are English; override per the page locale (see the date picker for
  // the same convention). Option labels themselves come from `options` data.

  /** Placeholder for the in-menu filter field (`filterable`). */
  @Prop({ attribute: 'search-placeholder' }) searchPlaceholder: string = 'Search…';
  /** Accessible name for the filter field. Falls back to `Filter <label>`. */
  @Prop({ attribute: 'filter-label' }) filterLabel: string = '';
  /** Empty-state text when a filter matches nothing. */
  @Prop({ attribute: 'no-results-text' }) noResultsText: string = 'No results';
  /** Empty-state text when there are no options at all. */
  @Prop({ attribute: 'no-options-text' }) noOptionsText: string = 'No options';
  /** Accessible label for the clear button (`clearable`). */
  @Prop({ attribute: 'clear-label' }) clearLabel: string = 'Clear selection';
  /** Accessible label for the in-menu loading spinner while filtering. */
  @Prop({ attribute: 'searching-label' }) searchingLabel: string = 'Searching';
  /** Text shown in the trigger / menu while `loading` is true. */
  @Prop({ attribute: 'loading-text' }) loadingText: string = 'Loading…';

  // ── Icon customization (Material Symbols names; or use the slots below) ──

  /** Icon (Material Symbols name) for the clear button (`clearable`). */
  @Prop({ attribute: 'clear-icon' }) clearIcon: string = 'close';
  /** Caret icon; rotates 180° when open. Slot `dropdown-icon` overrides it. */
  @Prop({ attribute: 'dropdown-icon' }) dropdownIcon: string = 'arrow_drop_down';

  /**
   * Show a busy state: the trigger shows a spinner instead of the caret and the
   * host is `aria-busy`. Use while an async dataset loads (e.g. before/around a
   * large `loadOptions`). Replace the spinner with the `loader` slot.
   */
  @Prop({ reflect: true }) loading: boolean = false;

  /**
   * Stretch the control to fill its parent's inline width (otherwise it sizes to
   * a sensible default). The dropdown follows when `match-trigger-width` is set.
   */
  @Prop({ attribute: 'full-width', reflect: true }) fullWidth: boolean = false;

  /** Open state of the dropdown. Reflected so `:host([open])` rules apply. */
  @Prop({ mutable: true, reflect: true }) open: boolean = false;

  /** Emits the newly selected value whenever the selection changes. */
  @Event() mdChange!: EventEmitter<string>;

  /** Emits when the dropdown opens. */
  @Event() mdOpen!: EventEmitter<void>;

  /** Emits when the dropdown closes. */
  @Event() mdClose!: EventEmitter<void>;

  @State() private optionsData: SelectOptionData[] = [];

  @State() private triggerId = `md-select-${++selectIdCounter}`;

  private fieldEl?: HTMLElement & { focus?: () => void };
  private menuEl?: VirtualMenuEl;

  /** Shared virtualization engine (WASM store + window math + provider glue). */
  private vc = new VirtualSelectController({
    queryItem: (i) =>
      (this.el.shadowRoot?.querySelector(
        `md-menu-item[data-vindex="${i}"]`,
      ) as HTMLElement | null) ?? null,
    requestRender: () => forceUpdate(this),
  });
  private providerSet = false;
  /** Trigger label for the selected value while virtualized (off-window safe). */
  private selectedLabel = '';
  private searchDebounce?: ReturnType<typeof setTimeout>;
  /** Client-side filter query for `filterable` on a NON-virtualized list. The
   *  virtualized path filters inside the WASM engine via `vc.setQuery`. */
  @State() private query = '';

  /** True between a keystroke and the debounced query resolving (drives the spinner). */
  private searching = false;

  // ── Public API ───────────────────────────────────────────

  /** Open the dropdown programmatically. */
  @Method()
  async show() {
    if (this.disabled) return;
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

  /** Clear the selection. */
  @Method()
  async reset() {
    if (!this.value) return;
    this.value = '';
    this.mdChange.emit('');
  }

  /**
   * Load a large dataset into the WASM-backed virtualized list (the high-scale
   * entry point). Accepts a materialised `SelectOptionInit[]` or a row factory
   * (`{ count, getRow }`) — the factory streams rows into WASM one at a time, so
   * tens of millions of options never exist as JS objects at once. Falls back to
   * plain DOM rendering when `virtualize="never"` or WebAssembly is unavailable.
   */
  @Method()
  async loadOptions(source: SelectOptionInit[] | OptionRowSource) {
    if (this.virtualize === 'never' || !isWasmSupported()) {
      this.vc.reset();
      this.optionsData = normalizeInits(rowsToArray(source));
      return;
    }
    this.optionsData = [];
    this.vc.setFixedRowHeight(this.rowHeight);
    this.vc.setFilterMode(this.filterMode);
    const ok = await this.vc.load(source);
    if (!ok) {
      // The store declines an empty set (and a WASM failure). Without dropping
      // whatever it still holds, `loadOptions([])` after a populated load left
      // the PREVIOUS rows active and rendering — so a consumer could not clear
      // the list by handing over an empty one.
      this.vc.reset();
      this.optionsData = normalizeInits(rowsToArray(source));
    } else {
      this.updateSelectedLabel();
    }
    forceUpdate(this);
  }

  /**
   * Filter the menu exactly as typing into the in-menu search field would.
   *
   * The field is uncontrolled, so the text is mirrored into it as well —
   * otherwise the list narrows while the box still reads empty, which looks
   * like the call did nothing. The menu may be closed (no field rendered yet),
   * so the text is stashed and applied on the next render.
   */
  @Method()
  async setQuery(query: string) {
    this.vc.setQuery(query);
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
      '.md-select__search',
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

  /** Initial value, restored on form reset. */
  private defaultValue = '';

  componentWillLoad() {
    this.refreshOptions();
    // Adopt an option-declared `selected` hint when no value was provided.
    if (!this.value) {
      const preselected = this.optionsData.find((o) => o.selected && !o.disabled);
      if (preselected) this.value = preselected.value;
    }
    this.defaultValue = this.value;
    this.syncFormValue();
  }

  /** Keep the submitted form value in sync with the selection. */
  @Watch('value')
  syncFormValue() {
    setFormValue(this.internals, this.value || null);
    this.updateSelectedLabel();
    this.syncValidity();
  }

  /**
   * Publish `required` to the owning form. Without this the select is
   * form-associated (its value reaches FormData) yet ALWAYS reports valid, so an
   * empty required control lets the form submit — `required` renders as a visual
   * hint and nothing more. Kept in the same place as the value sync so the two
   * can never drift.
   */
  @Watch('required')
  @Watch('valueMissingLabel')
  private syncValidity() {
    setValidityState(this.internals, {
      missing: this.required && !this.value,
      missingMessage: this.valueMissingLabel,
      customMessage: this.customValidityMessage,
    });
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

  /** Constraint-validation API, matching md-text-field and the native contract. */
  @Method()
  async checkValidity(): Promise<boolean> {
    return checkValidityOf(this.internals);
  }

  /** Like checkValidity(), but also shows the browser's validation message. */
  @Method()
  async reportValidity(): Promise<boolean> {
    return reportValidityOf(this.internals);
  }

  /** App/server-side validation: a non-empty message marks the control invalid
   *  for its form until cleared with an empty string. */
  @Method()
  async setCustomValidity(message: string) {
    this.customValidityMessage = message;
    this.syncValidity();
  }

  /** Restore the initial selection when the owning form is reset. */
  formResetCallback() {
    this.value = this.defaultValue;
  }

  @Watch('options')
  refreshOptions() {
    const data = collectOptions(this.el, this.optionList);
    const shouldVirtualize =
      this.virtualize === 'always' ||
      (this.virtualize === 'auto' && data.length > VIRTUALIZE_THRESHOLD);

    if (shouldVirtualize && isWasmSupported() && data.length > 0) {
      this.optionsData = [];
      this.vc.setFixedRowHeight(this.rowHeight);
      this.vc.setFilterMode(this.filterMode);
      void this.vc.load(data).then((ok) => {
        if (!ok) {
          this.optionsData = data;
          forceUpdate(this);
        } else {
          this.updateSelectedLabel();
        }
      });
    } else {
      this.vc.reset();
      this.optionsData = data;
    }
  }

  /** Refresh the cached trigger label for the current value (virtual mode). */
  private updateSelectedLabel() {
    if (!this.value) {
      this.selectedLabel = '';
    } else if (this.vc.active) {
      this.selectedLabel = this.vc.getLabels([this.value]).get(this.value) ?? this.selectedLabel;
    }
    forceUpdate(this);
  }

  /** Slotted `<md-select-option>` mount/unmount/data change → re-read. */
  @Listen('mdSelectOptionChange')
  onOptionChange(e: Event) {
    e.stopPropagation();
    this.refreshOptions();
  }

  // Prevents @Watch re-entrancy when handleMenuClose syncs this.open back.
  private _syncGuard = false;
  // Deduplicates mdOpen/mdClose: only emit when the state actually flips.
  private _lastEmit: 'open' | 'close' | null = null;

  @Watch('open')
  syncMenu(open: boolean) {
    if (this._syncGuard || !this.menuEl) return;
    if (open) {
      // A filterable virtual menu focuses its search field, not the first row.
      this.menuEl.show?.({ autoFocus: !(this.filterable && this.vc.active) });
    } else {
      this.menuEl.close?.();
    }
  }

  // ── Keyboard (trigger) ───────────────────────────────────

  @Listen('keydown')
  handleKeyDown(e: KeyboardEvent) {
    if (this.disabled) return;
    if (!this.open && (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ')) {
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
    if (this.disabled) return;
    this.open = !this.open;
  };

  private selectValue = (val: string) => {
    if (this.value === val) {
      this.open = false;
      return;
    }
    this.value = val;
    this.mdChange.emit(val);
    this.open = false;
    this.fieldEl?.focus?.();
  };

  private clearValue = (e: MouseEvent) => {
    e.stopPropagation();
    if (this.disabled || !this.value) return;
    this.value = '';
    this.mdChange.emit('');
  };

  /** True once the vc is wired to the menu's live scroll viewport. */
  private vpWired = false;

  /** Wire the vc to the menu scroll viewport; a null resolve (viewport not
   *  rendered yet — e.g. the menu opened while the dataset was packing and
   *  showed the uncapped busy bar) just returns, and componentDidRender
   *  retries until the wiring lands. */
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
      if (this.filterable) {
        requestAnimationFrame(() => {
          const input = this.el.shadowRoot?.querySelector('.md-select__search') as HTMLElement | null;
          input?.focus();
          // Register the search input as the combobox so md-menu drives the
          // listbox via aria-activedescendant on it (focus stays here while the
          // user arrows through / filters the virtualized options).
          void this.menuEl?.setComboboxElement?.(input);
        });
      }
    }
  };

  private handleMenuClose = () => {
    this._syncGuard = true;
    this.open = false;
    this._syncGuard = false;
    // Reopening shows the full list: the search field is uncontrolled and
    // unmounts with the menu, so a stale query would filter an empty-looking box.
    if (this.query) this.query = '';
    if (this._lastEmit !== 'close') {
      this._lastEmit = 'close';
      this.mdClose.emit();
    }
    void this.menuEl?.setComboboxElement?.(null);
    this.vc.detachViewport();
    this.vpWired = false;
  };

  private onSearchInput = (e: Event) => {
    const q = (e.target as HTMLInputElement).value;
    this.queryText = null; // typing supersedes a pending programmatic query
    if (!this.vc.active) {
      // Plain (non-virtual) list: filter the rendered options client-side. It is
      // cheap, so it runs synchronously per keystroke — no spinner, no debounce.
      this.query = q;
      return;
    }
    // Show the spinner immediately, debounce the actual (expensive) query, then
    // clear the spinner once results are in — a smooth, intentional transition.
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

  /** Register/clear the virtual provider on the menu once it's rendered, and
   *  (re)try viewport wiring for menus opened mid-pack. */
  componentDidRender() {
    this.syncSearchField();
    if (!this.menuEl) return;
    if (this.vc.active && !this.providerSet) {
      void this.menuEl.setVirtualProvider?.(this.vc.provider);
      this.providerSet = true;
    } else if (!this.vc.active && this.providerSet) {
      void this.menuEl.setVirtualProvider?.(null);
      this.providerSet = false;
    }
    if (this.open && this.vc.active && !this.vpWired) this.wireViewport();
  }

  disconnectedCallback() {
    clearTimeout(this.searchDebounce);
    this.vc.detachViewport();
  }

  // ── Render ───────────────────────────────────────────────

  /**
   * Resolved accessible name for the control.
   *
   * A consumer names the select one of two ways: the visible `label` prop, or
   * `aria-label` / `aria-labelledby` on the host — the latter used when there
   * is no floating label, e.g. `md-table-pagination`'s rows-per-page select,
   * which has a *separate* visible label element next to it. The host is
   * role-less (generic), so a name set there is invisible to assistive tech,
   * and an `aria-labelledby` IDREF can't cross the shadow boundary into the
   * field's inner input. Resolve the name here (visible `label` wins, then
   * `aria-label`, then the flattened text of `aria-labelledby` targets) so it
   * can be forwarded onto the inner input (the real focus/accessible-name
   * target) and used to name the popup listbox — instead of the input having
   * no accessible name at all.
   */
  private get accessibleName(): string {
    if (this.label) return this.label;
    const ariaLabel = this.el.getAttribute('aria-label');
    if (ariaLabel && ariaLabel.trim()) return ariaLabel.trim();
    const labelledby = this.el.getAttribute('aria-labelledby');
    if (labelledby) {
      const root = this.el.getRootNode() as Document | ShadowRoot;
      const text = labelledby
        .trim()
        .split(/\s+/)
        .map((id) => root.getElementById?.(id)?.textContent?.trim() ?? '')
        .filter(Boolean)
        .join(' ');
      if (text) return text;
    }
    return '';
  }

  private renderTrigger() {
    const display = this.vc.active
      ? this.selectedLabel
      : labelFor(this.optionsData, this.value);
    const hasValue = !!this.value && !!display;
    const showClear = this.clearable && hasValue && !this.disabled;
    // When there's no visible `label`, forward the host's accessible name
    // (aria-label / aria-labelledby) onto the field so md-text-field mirrors it
    // as the inner input's accessible name. Skipped when `label` is set: the
    // `label` prop already names the input, and passing aria-label too would
    // both double-name and leave an aria-label on md-text-field's role-less host.
    const fieldAriaLabel = this.label ? undefined : this.accessibleName || undefined;

    return (
      <md-text-field
        ref={(el) => (this.fieldEl = el as HTMLElement)}
        id={this.triggerId}
        class="md-select__field"
        part="field"
        exportparts="container:field-container"
        variant={this.variant}
        label={this.label}
        aria-label={fieldAriaLabel}
        placeholder={hasValue ? '' : this.placeholder}
        value={display}
        readOnly={true}
        disabled={this.disabled}
        required={this.required}
        error={this.error}
        errorText={this.errorText}
        reserveSupportingSpace={this.reserveSupportingSpace}
        supportingText={this.supportingText}
        density={this.density}
        appearFocused={this.open}
        onClick={this.toggleOpen}
      >
        <span
          slot="trailing-icon"
          class="md-select__trailing"
          part="trailing"
          aria-hidden="true"
        >
          {this.loading ? (
            // Busy state: a spinner replaces the caret/clear. Consumers can swap
            // the spinner via the `loader` slot; the default is md-loading-indicator.
            <span class="md-select__loader" part="loading-spinner">
              <slot name="loader">
                <md-loading-indicator label={this.loadingText}></md-loading-indicator>
              </slot>
            </span>
          ) : (
            [
              showClear && (
                <md-icon-button
                  class="md-select__clear"
                  part="clear"
                  size="xs"
                  icon={this.clearIcon}
                  aria-label={this.clearLabel}
                  shapeMorph={false}
                  // Keep it out of the tab order: the cluster is aria-hidden and
                  // the select trigger owns focus, matching the prior <button>.
                  groupTabindex={-1}
                  // Native click (not mdClick) so stopPropagation prevents the
                  // field's toggle from also firing and opening the menu.
                  onClick={this.clearValue}
                ></md-icon-button>
              ),
              <span class="md-select__caret material-symbols-outlined" part="caret">
                <slot name="dropdown-icon">{this.dropdownIcon}</slot>
              </span>,
            ]
          )}
        </span>
      </md-text-field>
    );
  }

  private renderVirtualOptions() {
    // The listbox wrapper lives in md-select's shadow root (slotted into md-menu),
    // so the combobox input's aria-controls / aria-activedescendant IDREFs
    // resolve, and the listbox directly owns its role="option" children (the
    // spacers are aria-hidden). This is the WAI-ARIA combobox/listbox structure.
    return (
      <div
        class="md-select__listbox"
        role="listbox"
        id={`${this.triggerId}-listbox`}
        aria-label={this.accessibleName || 'Options'}
      >
        <div
          class="md-select__vspacer"
          style={{ height: `${this.vc.topPad}px` }}
          aria-hidden="true"
        ></div>
        {this.vc.windowRows.map((row, i) => {
        const filteredIndex = this.vc.windowStart + i;
        const selected = row.value === this.value;
        return (
          <md-menu-item
            key={row.index}
            // Stable id so md-menu can point aria-activedescendant here. Lives in
            // md-select's shadow root alongside the combobox input, so the IDREF
            // resolves. Keyed on the filtered index (its position in the list).
            id={`${this.triggerId}-opt-${filteredIndex}`}
            data-vindex={filteredIndex}
            // Exposes the row as a listbox option (role="option" + aria-selected)
            // rather than a menuitemradio — the WAI-ARIA select/combobox pattern.
            presentation="option"
            type="radio"
            check-position="start"
            keep-open
            part={selected ? 'option option-selected' : 'option'}
            disabled={row.disabled}
            selected={selected}
            headline={row.label}
            supporting-text={row.supportingText || ''}
            aria-setsize={this.vc.filteredLength}
            aria-posinset={filteredIndex + 1}
            onMdClick={() => this.selectValue(row.value)}
          >
            {row.icon ? (
              <span
                slot="leading-icon"
                part="option-icon"
                // Per-option `iconColor` is not carried on the virtualized (WASM)
                // path — the byte-packed row store has no colour column — so
                // virtual rows fall back to --md-select-option-icon-color.
                class="material-symbols-outlined md-select__option-icon"
                aria-hidden="true"
              >
                {row.icon}
              </span>
            ) : null}
            {row.label}
          </md-menu-item>
        );
        })}
        <div
          class="md-select__vspacer"
          style={{ height: `${this.vc.bottomPad}px` }}
          aria-hidden="true"
        ></div>
      </div>
    );
  }

  private renderMenu() {
    const virtual = this.vc.active;
    // Non-virtual `filterable`: narrow the rendered options by label / supporting
    // text (case-insensitive). Virtual filtering runs in the WASM engine instead.
    const q = this.filterable && !virtual ? this.query.trim().toLowerCase() : '';
    const listOptions = q
      ? this.optionsData.filter(
          (o) =>
            o.label.toLowerCase().includes(q) ||
            (o.supportingText || '').toLowerCase().includes(q),
        )
      : this.optionsData;
    // While loading we show a wavy progress bar in the menu (below), not text.
    const emptyText = this.loading
      ? ''
      : virtual
        ? this.vc.filteredLength === 0
          ? this.noResultsText
          : ''
        : this.optionsData.length === 0
          ? this.noOptionsText
          : q && listOptions.length === 0
            ? this.noResultsText
            : '';
    // Virtualization needs a bounded viewport to scroll within.
    const menuMaxHeight = virtual ? (this.maxHeight ?? 320) : this.maxHeight;

    return (
      <md-menu
        ref={(el) => (this.menuEl = el as VirtualMenuEl)}
        anchor={this.triggerId}
        placement={this.placement}
        match-anchor-width={this.matchTriggerWidth || this.fullWidth}
        max-height={menuMaxHeight}
        empty-text={emptyText}
        // Present the popup as a WAI-ARIA listbox (not a menu) for every select,
        // virtual or not, and name it.
        listbox
        list-label={this.accessibleName || 'Options'}
        part="menu"
        onMdOpen={this.handleMenuOpen}
        onMdClose={this.handleMenuClose}
      >
        {this.filterable && !this.loading && (
          <div slot="header" class="md-select__search-wrap" part="search-wrap">
            <input
              class="md-select__search"
              part="search"
              type="text"
              // WAI-ARIA combobox: this input owns focus while the listbox is
              // open; the active option is conveyed via aria-activedescendant
              // (set by md-menu). aria-controls points at the listbox wrapper,
              // which md-select renders in this same shadow root so the IDREF
              // resolves (the menu surface is only role="presentation").
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
                class="md-select__search-spinner"
                part="search-spinner"
                label={this.searchingLabel}
                aria-hidden="true"
              ></md-loading-indicator>
            )}
          </div>
        )}
        {this.loading ? (
          // Busy state inside the menu: a wavy (M3 Expressive) indeterminate
          // linear progress bar instead of "Loading…" text.
          <div
            class="md-select__loading"
            part="loading-bar"
            role="status"
            aria-label={this.loadingText}
          >
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
          // Listbox wrapper in md-select's shadow root so aria-controls (from a
          // combobox consumer) resolves and the listbox directly owns its
          // role="option" children — the WAI-ARIA select pattern, matching the
          // virtual path. Options carry aria-selected (presentation="option")
          // rather than the menuitemradio/aria-checked of a menu.
          <div
            class="md-select__listbox"
            role="listbox"
            id={`${this.triggerId}-listbox`}
            aria-label={this.accessibleName || 'Options'}
          >
            {listOptions.map((opt) => (
              <md-menu-item
                key={opt.value}
                id={`${this.triggerId}-opt-${opt.value}`}
                presentation="option"
                type="radio"
                check-position="start"
                keep-open
                part={opt.value === this.value ? 'option option-selected' : 'option'}
                disabled={opt.disabled}
                selected={opt.value === this.value}
                headline={opt.label}
                supporting-text={opt.supportingText || ''}
                onMdClick={() => this.selectValue(opt.value)}
              >
                {opt.icon ? (
                  <span
                    slot="leading-icon"
                    part="option-icon"
                    class="material-symbols-outlined md-select__option-icon"
                    style={opt.iconColor ? { color: opt.iconColor } : undefined}
                    aria-hidden="true"
                  >
                    {opt.icon}
                  </span>
                ) : null}
                {/* No light-DOM label copy: md-menu-item renders `headline` in
                    its shadow and has no default slot — the unslotted text
                    still entered accname computation, doubling the option's
                    accessible name ("10 10"). */}
              </md-menu-item>
            ))}
          </div>
        )}
      </md-menu>
    );
  }

  render() {
    return (
      <Host
        class={{
          'md-select': true,
          [`md-select--${this.variant}`]: true,
          'md-select--open': this.open,
          'md-select--disabled': this.disabled,
          'md-select--loading': this.loading,
        }}
        aria-haspopup="listbox"
        // No aria-expanded on the host: it has no role, so a screen reader ignores
        // it there (axe flags it "aria attribute may be ignored"). The expanded
        // state lives where it works — the filterable search (role=combobox) — and
        // on open, focus moves into the menu (the search, or md-menu's active row).
        aria-busy={this.loading ? 'true' : undefined}
      >
        {this.renderTrigger()}
        {this.renderMenu()}
        {/* Keep the declarative options in the light DOM (hidden) so the
            slotchange/mutation reactivity has something to observe. */}
        <div class="md-select__options" hidden>
          <slot onSlotchange={() => this.refreshOptions()} />
        </div>
      </Host>
    );
  }
}
