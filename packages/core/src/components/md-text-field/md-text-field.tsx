import { getValidityOf } from '../../utils/form';
import { AttachInternals, Build, Component, Element, Event, EventEmitter, Host, Method, Prop, State, Watch, h } from '@stencil/core';

const RESTRICT_PATTERNS: Record<string, RegExp> = {
  numeric: /[^0-9]/g,
  integer: /[^0-9-]/g,
  decimal: /[^0-9.\-]/g,
  alpha: /[^a-zA-Z]/g,
  alphanumeric: /[^a-zA-Z0-9]/g,
};

@Component({
  tag: 'md-text-field',
  styleUrl: 'md-text-field.css',
  // delegatesFocus makes host.focus() (and click-anywhere) land in the inner
  // input — previously host.focus() was a literal no-op.
  shadow: { delegatesFocus: true },
  formAssociated: true,
})
export class MdTextField {

  /**
   * Always occupy the supporting-text line, even when there is no message.
   *
   * The row is otherwise rendered only when there is something to show, so the
   * first validation error CREATES a line and shoves everything below it down —
   * the whole form jumps as you tab through it. Reserving the space is opt-in
   * because a field with no message would otherwise carry an empty line
   * everywhere, including dense and inline layouts. createFormController turns
   * it on automatically for the fields it manages, since those are exactly the
   * ones whose messages appear and disappear.
   */
  @Prop({ attribute: 'reserve-supporting-space' }) reserveSupportingSpace: boolean = false;

  @Element() el!: HTMLElement;

  @Prop() variant: 'filled' | 'outlined' = 'filled';
  @Prop() label: string = '';
  /** NOT reflected: typed values (incl. passwords) must never appear as a DOM attribute. */
  @Prop({ mutable: true }) value: string = '';
  @Prop() placeholder: string = '';
  @Prop() type: string = 'text';
  /** Form field name (host attribute — ElementInternals submits under it). */
  @Prop({ reflect: true }) name: string = '';
  /** Constraint validation (forwarded to the inner input; surfaced via ElementInternals). */
  @Prop() pattern: string = '';
  @Prop({ attribute: 'min-length', mutable: true }) minLength: number | undefined;
  @Prop() min: string | number | undefined;
  @Prop() max: string | number | undefined;
  @Prop() step: string | number | undefined;
  /** Input behavior passthrough (password managers / mobile keyboards). */
  @Prop() autocomplete: string = '';
  @Prop({ attribute: 'inputmode' }) inputMode: string = '';
  @Prop({ attribute: 'enterkeyhint' }) enterKeyHint: string = '';
  @Prop({ attribute: 'autocapitalize' }) autoCapitalize: string = '';
  @Prop() spellcheck: boolean | undefined;
  @Prop({ reflect: true }) disabled: boolean = false;
  @Prop({ attribute: 'readonly' }) readOnly: boolean = false;
  @Prop() required: boolean = false;
  @Prop() error: boolean = false;
  @Prop() errorText: string = '';
  @Prop() supportingText: string = '';
  @Prop({ attribute: 'prefix-text' }) prefixText: string = '';
  @Prop({ attribute: 'suffix-text' }) suffixText: string = '';
  @Prop({ attribute: 'max-length', mutable: true }) maxLength: number | undefined;
  /** Show a clear icon button. 'internal' clears the value directly; 'external' emits mdClear and leaves value control to the consumer. */
  @Prop({ mutable: true }) clearable: 'internal' | 'external' | false = false;
  /** Show a password visibility toggle. 'internal' toggles the input type directly; 'external' emits mdPasswordToggle and leaves type control to the consumer. */
  @Prop({ attribute: 'password-toggle', mutable: true }) passwordToggle: 'internal' | 'external' | false = false;
  /** Density scale: 0 (default 56px), -1 (52px), -2 (48px), -3 (44px). */
  @Prop({ reflect: true }) density: 0 | -1 | -2 | -3 | -4 = 0;
  /**
   * Multi-line mode.
   * - false: single-line <input> (default)
   * - 'auto-grow': <textarea> that expands as content grows (multi-line field)
   * - 'fixed': <textarea> with fixed height that scrolls (text area)
   */
  @Prop() multiline: 'auto-grow' | 'fixed' | false = false;
  /** Number of visible text rows for multiline modes. Defaults to 2 for auto-grow, 4 for fixed. */
  @Prop() rows: number | undefined;
  /**
   * Speech-to-text via Web Speech API.
   * - 'internal': manages recognition internally, appends transcript to value
   * - 'external': emits mdSpeechResult on mic click, letting the consumer handle recognition
   */
  @Prop({ attribute: 'speech-to-text', mutable: true }) speechToText: 'internal' | 'external' | false = false;
  /** Language/locale for internal speech recognition (e.g. 'en-US', 'de-DE'). Defaults to browser locale. */
  @Prop({ attribute: 'speech-lang' }) speechLang: string = '';
  /**
   * Restrict input to allowed characters.
   * Presets: 'numeric', 'integer', 'decimal', 'alpha', 'alphanumeric'.
   * Custom: a regex character class string, e.g. '[0-9+() -]'.
   */
  @Prop() restrict: string = '';
  /**
   * Formats the raw value for display.
   * Set via JS: `el.formatter = (v) => Number(v).toLocaleString()`.
   */
  @Prop({ mutable: true }) formatter?: (value: string) => string;
  /**
   * Parses the display value back to a raw value.
   * Set via JS: `el.parser = (v) => v.replace(/[^0-9.-]/g, '')`.
   */
  @Prop({ mutable: true }) parser?: (displayValue: string) => string;
  /**
   * When to apply the formatter.
   * - 'blur': format on blur, show raw value on focus (default)
   * - 'input': format on every keystroke (live formatting)
   */
  @Prop({ attribute: 'format-on' }) formatOn: 'blur' | 'input' = 'blur';
  /** Border width when focused: 1, 2, or 3 pixels. */
  @Prop({ attribute: 'focus-border-width', reflect: true }) focusBorderWidth: number = 3;
  /**
   * Force the field to render in its focused visual state regardless of the
   * underlying input's actual focus. Use when the field acts as an *anchor*
   * for a popover, dialog, or menu, and the OS focus has moved into that
   * surface — for example the `md-time-picker` keeps its trigger field in
   * the focused look while the picker modal is open, so the trigger and
   * the modal read as one connected control.
   *
   * Visual-only: affects the notched-outline width / colour, the floating
   * label position, and the leading-icon colour through md-text-field's
   * existing `.md-text-field--focused` rules. Does NOT alter formatter /
   * blur-format behaviour (those keep tracking real focus events), so
   * `formatOn="blur"` still flips between formatted and raw on real
   * focus/blur even while `appear-focused` is on.
   */
  @Prop({ attribute: 'appear-focused', reflect: true }) appearFocused: boolean = false;
  /**
   * When leading `chips` are slotted, allow them to WRAP onto multiple rows so
   * the field grows to fit them. Default `false`: chips stay on a single line and
   * the field keeps its normal height (the consumer, e.g. md-multi-select, is
   * responsible for handling overflow — clipping or a "+N" counter).
   */
  @Prop({ attribute: 'chips-wrap', reflect: true }) chipsWrap: boolean = false;
  /** Debounce delay (ms) for the mdSearch event. Emits after the user stops typing for this duration. 0 = disabled. */
  @Prop({ reflect: true }) debounce: number = 0;
  /** Throttle interval (ms) for the mdSearch event. Emits at most once per interval while typing. 0 = disabled. */
  @Prop({ reflect: true }) throttle: number = 0;

  @Event() mdInput: EventEmitter<string>;
  @Event() mdChange: EventEmitter<string>;
  /** Emitted with debounce/throttle control. Useful for search-as-you-type, API calls, or filtering. */
  @Event() mdSearch: EventEmitter<string>;
  @Event() mdClear: EventEmitter<void>;
  @Event() mdPasswordToggle: EventEmitter<{ visible: boolean }>;
  @Event() mdSpeechResult: EventEmitter<{ transcript: string; listening: boolean }>;

  @AttachInternals() internals!: ElementInternals;

  @State() private focused = false;
  @State() private formDisabled = false;
  @State() private autofilled = false;
  @State() private hostAriaLabel = '';
  @State() private passwordVisible = false;
  @State() private hasSlottedLeading = false;
  /** Interactive leading content (e.g. multi-select chips) slotted into `chips` —
   *  rendered in the input flow (NOT the aria-hidden icon slot) so it stays operable. */
  @State() private hasSlottedChips = false;
  @State() private hasSlottedTrailing = false;
  @State() private hasTrailingIconButton = false;
  @State() private listening = false;
  @State() private displayValue: string = '';

  private inputEl?: HTMLInputElement | HTMLTextAreaElement;
  private defaultValue = '';
  /** True while a this.value mutation originates from user input handlers. */
  private internalWrite = false;
  private composing = false;
  private warnedLiveFormat = false;
  private uid = `md-text-field-${Math.random().toString(36).slice(2, 7)}`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private recognition?: any;
  private debounceTimer?: ReturnType<typeof setTimeout>;
  private throttleTimer?: ReturnType<typeof setTimeout>;
  private throttlePending = false;
  private lastEmittedSearch: string | undefined;

  /** Consumer `disabled` OR ancestor form/fieldset disabled (formDisabledCallback). */
  private get isDisabled(): boolean {
    return this.disabled || this.formDisabled;
  }

  /** Live (per-keystroke) formatting REQUIRES a parser — without one the
   *  formatted display feeds back into the next parse and corrupts the value.
   *  Fall back to blur formatting and warn once in dev. */
  private get effectiveFormatOn(): 'blur' | 'input' {
    if (this.formatOn === 'input' && this.formatter && !this.parser) {
      if (Build.isDev && !this.warnedLiveFormat) {
        this.warnedLiveFormat = true;
        console.warn("[md-text-field] format-on='input' requires a parser — falling back to format-on='blur'.", this.el);
      }
      return 'blur';
    }
    return this.formatOn;
  }

  /** Anything focusable slotted as trailing content must stay in the AX
   *  tree (the wrapper is aria-hidden for decorative icons only). */
  private static isInteractive(el: Element): boolean {
    const tag = el.tagName.toLowerCase();
    return (
      ['md-icon-button', 'md-button', 'button', 'a', 'input', 'select', 'textarea'].includes(tag) ||
      el.hasAttribute('tabindex')
    );
  }

  private get isFloating(): boolean {
    // `appearFocused` opts an unfocused, empty field into the floating-label
    // state so the legend notch forms cleanly around the label. Without this,
    // toggling `appear-focused` on an empty trigger would draw the focused
    // primary outline THROUGH the resting (inline) label, because the
    // fieldset's legend wouldn't be active and there'd be no notch cut.
    return this.focused || this.appearFocused || !!this.value || !!this.placeholder || this.autofilled || this.hasSlottedChips;
  }

  private get effectiveRows(): number {
    if (this.rows != null) return this.rows;
    return this.multiline === 'fixed' ? 4 : 2;
  }

  private get restrictPattern(): RegExp | null {
    if (!this.restrict) return null;
    if (RESTRICT_PATTERNS[this.restrict]) return RESTRICT_PATTERNS[this.restrict];
    try {
      // Custom character class: invert it to strip disallowed chars
      // e.g. '[0-9+]' → /[^0-9+]/g
      const inner = this.restrict.startsWith('[') && this.restrict.endsWith(']')
        ? this.restrict.slice(1, -1)
        : this.restrict;
      return new RegExp(`[^${inner}]`, 'g');
    } catch {
      return null;
    }
  }

  private applyRestrict(raw: string): string {
    const pattern = this.restrictPattern;
    return pattern ? raw.replace(pattern, '') : raw;
  }

  private syncTrailingSlotState(trailingSlot: HTMLSlotElement | null | undefined) {
    if (!trailingSlot) return;
    this.hasSlottedTrailing = trailingSlot.assignedNodes().length > 0;
    this.hasTrailingIconButton = trailingSlot
      .assignedElements()
      .some((el) => MdTextField.isInteractive(el));
  }

  /**
   * Detect projected trailing/leading icons from host children before first
   * paint. Nested consumers (e.g. md-date-picker) always render a trailing
   * md-icon-button inside the field; waiting for componentDidLoad left the
   * trailing wrapper at display:none on the initial frame.
   */
  private syncHostSlottedIcons() {
    const leading = this.el.querySelector('[slot="leading-icon"]');
    const trailing = this.el.querySelector('[slot="trailing-icon"]');
    this.hasSlottedLeading = !!leading;
    this.hasSlottedTrailing = !!trailing;
    this.hasTrailingIconButton = !!trailing && MdTextField.isInteractive(trailing);
  }

  componentWillLoad() {
    this.bridgeFormatterProps();
    // bare attribute forms (`clearable`, `password-toggle`, `speech-to-text`)
    // parse as '' — treat as the internal mode instead of silently off
    if (this.el.hasAttribute('clearable') && !this.clearable) this.clearable = 'internal';
    if (this.el.hasAttribute('password-toggle') && !this.passwordToggle) this.passwordToggle = 'internal';
    if (this.el.hasAttribute('speech-to-text') && !this.speechToText) this.speechToText = 'internal';
    // native attribute spellings (minlength/maxlength) as fallbacks for the
    // dash-cased props
    if (this.maxLength == null && this.el.hasAttribute('maxlength')) {
      this.maxLength = parseInt(this.el.getAttribute('maxlength')!, 10);
    }
    if (this.minLength == null && this.el.hasAttribute('minlength')) {
      this.minLength = parseInt(this.el.getAttribute('minlength')!, 10);
    }
    // host aria-label passthrough: hosts are role-less (generic), where
    // aria-label is prohibited — move it to the input's accessible name
    if (!this.label && !this.hostAriaLabel) {
      const hostLabel = this.el.getAttribute('aria-label');
      if (hostLabel) {
        this.hostAriaLabel = hostLabel;
        this.el.removeAttribute('aria-label');
      }
    }
    // Sync before first paint so consumers (e.g. md-date-picker) do not flash
    // an empty input when a `value` prop is already set.
    if (!this.multiline && /[\r\n]/.test(this.value)) {
      this.value = this.value.replace(/[\r\n]+/g, ''); // native setter parity for initial values
    }
    this.defaultValue = this.value;
    this.syncDisplayValue();
    this.syncHostSlottedIcons();
    this.updateFormValue();
  }

  /** ElementInternals: participate in FormData under the host's `name`. */
  private updateFormValue() {
    try {
      this.internals?.setFormValue(this.value); // '' submits as x= like a native input
    } catch { /* spec mock */ }
  }

  /** Surface the inner input's constraint validity on the host. */
  private customValidityMessage = '';

  private updateValidity() {
    const input = this.inputEl;
    if (!input) return;
    try {
      if (this.customValidityMessage) {
        this.internals?.setValidity({ customError: true }, this.customValidityMessage, input);
        return;
      }
      // Validity must describe the SUBMITTED value (this.value), not the
      // formatted display: pattern="[0-9]+" + a grouping formatter flagged
      // valid data as patternMismatch after blur. Probe raw synchronously
      // (no paint can happen mid-task), then restore the display.
      // While FOCUSED with display != raw (live formatter/parser fields),
      // the probe swap below destroys the caret Chrome preserves across
      // value writes — skip; blur re-validates on the committed state.
      if (this.focused && input.value !== this.value) return;
      const shown = input.value;
      let restore = false;
      if (input.value !== this.value) {
        input.value = this.value;
        restore = true;
        if (input.value !== this.value) {
          // input can't even HOLD the value (type=number + garbage) — block
          // submission rather than submit data the control can't represent
          input.value = shown;
          this.internals?.setValidity({ badInput: true }, 'Invalid value', input);
          return;
        }
      }
      // SNAPSHOT immediately: input.validity is LIVE — restoring the display
      // value below would re-flip every flag before we read it.
      const v = input.validity;
      const flags = {
        valueMissing: v.valueMissing,
        typeMismatch: v.typeMismatch,
        patternMismatch: v.patternMismatch,
        tooLong: v.tooLong,
        tooShort: v.tooShort,
        rangeUnderflow: v.rangeUnderflow,
        rangeOverflow: v.rangeOverflow,
        stepMismatch: v.stepMismatch,
        badInput: v.badInput,
      };
      const valid = v.valid;
      const message = input.validationMessage;
      if (restore) input.value = shown;

      if (valid) {
        this.internals?.setValidity({});
      } else {
        // plain flags — passing the live ValidityState object throws in Chrome
        this.internals?.setValidity(flags, message || 'Invalid value', input);
      }
    } catch { /* spec mock */ }
      this.emitValidityChange();
  }

  formResetCallback() {
    this.internalWrite = false;
    this.value = this.defaultValue;
    this.syncDisplayValue();
    if (this.inputEl) this.inputEl.value = this.displayValue;
    this.updateFormValue();
  }

  formDisabledCallback(disabled: boolean) {
    // called synchronously while Stencil reflects the disabled attribute
    // during render — a direct @State write logs 'changed during rendering'
    queueMicrotask(() => {
      this.formDisabled = disabled;
    });
  }

  /**
   * Promote the inner input to a WAI-ARIA **combobox**, for a composite that
   * owns the popup (md-autocomplete). The role has to live on the real textbox
   * — the one AT reads when it has focus — and this field renders it, so the
   * owner cannot put it there itself.
   *
   * Whitelisted to `combobox`: it is the only role an owner has a legitimate
   * reason to place on a text input, and an open-ended role prop here would let
   * a consumer lie about the control.
   */
  @Prop({ attribute: 'input-role' }) inputRole: '' | 'combobox' = '';

  /** Expanded state of the owner's popup. Emitted only with `input-role="combobox"`,
   *  where `aria-expanded` is an allowed attribute (it is not on a bare textbox). */
  @Prop({ attribute: 'input-expanded' }) inputExpanded: boolean = false;

  /** `aria-autocomplete` for the combobox — how typing relates to the popup. */
  @Prop({ attribute: 'input-aria-autocomplete' })
  inputAriaAutocomplete: '' | 'none' | 'inline' | 'list' | 'both' = '';

  /** Focus the inner input (host.focus() also works via delegatesFocus). */
  @Method()
  async setFocus() {
    this.inputEl?.focus();
  }

  /** Select the input's full contents. */
  @Method()
  async select() {
    this.inputEl?.select();
  }

  /**
   * The real `<input>` / `<textarea>` this field renders.
   *
   * A composite that owns a popup (md-autocomplete, the date/time pickers)
   * needs the actual textbox to wire combobox ARIA onto — its role, its
   * expanded state, and the element references that point at a listbox living
   * in the PARENT's shadow root. Handing it over explicitly replaces the
   * shadow-piercing `querySelector('.md-text-field__input')` those components
   * were doing against a private class name.
   *
   * Returns null before the first render.
   */
  @Method()
  async getInputElement(): Promise<HTMLInputElement | HTMLTextAreaElement | null> {
    return this.inputEl ?? null;
  }

  /** Native-parity validity readback: flags + message + willValidate. */
  @Method()
  async getValidity(): Promise<{ valid: boolean; validationMessage: string; flags: Record<string, boolean> }> {
    try {
      const v = this.internals.validity;
      return {
        valid: v.valid,
        validationMessage: this.internals.validationMessage,
        flags: {
          valueMissing: v.valueMissing,
          typeMismatch: v.typeMismatch,
          patternMismatch: v.patternMismatch,
          tooLong: v.tooLong,
          tooShort: v.tooShort,
          rangeUnderflow: v.rangeUnderflow,
          rangeOverflow: v.rangeOverflow,
          stepMismatch: v.stepMismatch,
          badInput: v.badInput,
          customError: v.customError,
        },
      };
    } catch {
      return { valid: true, validationMessage: '', flags: {} };
    }
  }

  /** App/server-side validation: a non-empty message marks the field
   *  invalid for its form until cleared with an empty string. */
  @Method()
  async setCustomValidity(message: string) {
    this.customValidityMessage = message;
    this.updateValidity();
  }

  formStateRestoreCallback(state: string | File | FormData | null) {
    // browser session restore / bfcache — native inputs restore their value
    if (typeof state === 'string') {
      this.value = state;
    }
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

  /** Constraint-validation API, delegated to the inner input. */
  @Method()
  async checkValidity(): Promise<boolean> {
    // internals reflects the SUBMITTED value's validity (the inner input may
    // hold a formatted display that would answer wrongly in both directions)
    try {
      return this.internals.checkValidity();
    } catch {
      return this.inputEl?.checkValidity() ?? true;
    }
  }

  @Method()
  async reportValidity(): Promise<boolean> {
    try {
      return this.internals.reportValidity();
    } catch {
      return this.inputEl?.reportValidity() ?? true;
    }
  }

  componentDidLoad() {
    const root = this.el.shadowRoot;
    const leadingSlot = root?.querySelector('slot[name="leading-icon"]') as HTMLSlotElement | null;
    leadingSlot?.addEventListener('slotchange', () => {
      this.hasSlottedLeading = leadingSlot.assignedNodes().length > 0;
    });
    const trailingSlot = root?.querySelector('slot[name="trailing-icon"]') as HTMLSlotElement | null;
    trailingSlot?.addEventListener('slotchange', () => {
      this.syncTrailingSlotState(trailingSlot);
    });
    const chipsSlot = root?.querySelector('slot[name="chips"]') as HTMLSlotElement | null;
    chipsSlot?.addEventListener('slotchange', () => {
      this.hasSlottedChips = chipsSlot.assignedNodes().length > 0;
    });
    // Detect statically-slotted icons present at first render: the initial
    // `slotchange` can fire before the listeners above are attached, so sync
    // once on load (matches md-icon-button's behaviour).
    this.hasSlottedLeading = (leadingSlot?.assignedNodes().length ?? 0) > 0;
    this.hasSlottedChips = (chipsSlot?.assignedNodes().length ?? 0) > 0;
    this.syncTrailingSlotState(trailingSlot);

    if (this.multiline === 'auto-grow') {
      this.autoGrow();
    }

    // Initialize display value with formatted version if not focused
    this.syncDisplayValue();
    this.updateValidity();
  }

  @Watch('value')
  onValueChange() {
    // framework form resets (Angular/Vue setValue(null)) write null through
    // the proxies — native inputs coerce to ''
    if (this.value == null) {
      this.value = '';
      return; // watch re-fires with ''
    }
    // native single-line inputs strip newlines at the value SETTER —
    // blurred programmatic writes must sanitize too, or value/display/
    // validity/submission diverge
    if (!this.internalWrite && !this.multiline && /[\r\n]/.test(this.value)) {
      this.value = this.value.replace(/[\r\n]+/g, '');
      return; // watch re-fires with the clean value
    }
    if (this.multiline === 'auto-grow') {
      this.autoGrow();
    }
    this.updateFormValue();
    if (!this.focused) {
      this.syncDisplayValue();
      return;
    }
    // Programmatic writes while FOCUSED were silently dropped (the next
    // keystroke reverted to DOM state) — breaking md-autocomplete's option
    // pick. Writes NOT originating from our own input handlers must reach
    // the visible input, preserving the caret.
    if (!this.internalWrite) {
      // a programmatic write ABORTS any in-flight composition without a
      // compositionend — un-wedge the gate
      this.composing = false;
      this.syncDisplayValue();
      const el = this.inputEl;
      if (el) {
        el.value = this.effectiveFormatOn === 'blur' && this.formatter ? this.value : this.displayValue;
        // replacement semantics (autocomplete pick): caret goes to the end
        const end = el.value.length;
        try { el.setSelectionRange(end, end); } catch { /* mock DOM */ }
      }
      this.updateValidity();
    }
  }

  /** Re-sync the DOM input after a type change: churning through
   *  type="number" leaves the native input blank for non-numeric values;
   *  switching back must restore the visible text. */
  private pendingTypeResync = false;

  @Watch('type')
  onTypeChange() {
    // resync must run AFTER the render that applies the new type to the DOM —
    // a microtask fires before Stencil commits, and the type swap re-wipes it
    this.pendingTypeResync = true;
  }

  componentDidRender() {
    if (this.pendingTypeResync) {
      this.pendingTypeResync = false;
      const el = this.inputEl;
      if (el) {
        const expected = this.focused && this.formatter && this.effectiveFormatOn === 'blur' ? this.value : this.displayValue;
        if (el.value !== expected) {
          el.value = expected;
        }
      }
    }
    // Always AFTER render: validity must be read from the COMMITTED input —
    // reading it in the value watch saw the stale DOM (programmatic fills
    // never cleared valueMissing).
    this.updateValidity();
  }

  @State() private formatterEpoch = 0;

  /** Stencil function-typed props are INERT (no watch, no re-render on
   *  assignment) — bridge element-level formatter/parser assignments with
   *  explicit accessors so the documented `el.formatter = fn` path
   *  reformats the resting display and re-renders (maxLength omission etc). */
  private bridgeFormatterProps() {
    (['formatter', 'parser'] as const).forEach((key) => {
      const el = this.el as unknown as Record<string, unknown>;
      Object.defineProperty(this.el, key, {
        configurable: true,
        get: () => this[key],
        set: (fn: ((v: string) => string) | undefined) => {
          this[key] = fn as never;
          // recompute the display BEFORE the reactive poke — spec-env renders
          // flush synchronously per state set, and a stale displayValue would
          // win the final patch
          if (!this.focused) {
            this.syncDisplayValue();
          }
          this.formatterEpoch++; // re-render (maxLength omission, display)
        },
      });
      void el;
    });
  }

  private syncDisplayValue() {
    if (this.formatter) {
      try {
        const out = this.formatter(this.value);
        this.displayValue = typeof out === 'string' ? out : this.value;
      } catch (err) {
        if (Build.isDev) console.warn('[md-text-field] formatter threw — showing the raw value.', err);
        this.displayValue = this.value;
      }
    } else {
      this.displayValue = this.value;
    }
  }

  private emitSearchDistinct(value: string) {
    if (value === this.lastEmittedSearch) return;
    this.lastEmittedSearch = value;
    this.mdSearch.emit(value);
  }

  private emitSearch(value: string) {
    if (this.debounce > 0) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => this.emitSearchDistinct(value), this.debounce);
    }

    if (this.throttle > 0) {
      if (!this.throttleTimer) {
        this.emitSearchDistinct(value);
        this.throttlePending = false;
        this.throttleTimer = setTimeout(() => {
          this.throttleTimer = undefined;
          if (this.throttlePending) {
            this.emitSearchDistinct(this.value);
            this.throttlePending = false;
          }
        }, this.throttle);
      } else {
        this.throttlePending = true;
      }
    }

    if (this.debounce <= 0 && this.throttle <= 0) {
      this.emitSearchDistinct(value);
    }
  }

  private autoGrow() {
    const textarea = this.inputEl as HTMLTextAreaElement | undefined;
    if (!textarea) return;
    textarea.value = this.value;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }

  private handleInput = (e: Event) => {
    const el = (e.target as HTMLInputElement | HTMLTextAreaElement) || this.inputEl;
    if (!el) return;
    // Mid-IME-composition the DOM value is provisional: restricting or
    // formatting it CANCELS the composition on every CJK keystroke. Let the
    // browser compose; the full pipeline runs once on compositionend.
    if (this.composing) return;
    let raw = el.value;
    let cursorPos = el.selectionStart ?? raw.length;

    // Apply restriction
    let restricted = this.applyRestrict(raw);
    // length cap runs AFTER restrict (native maxLength is not forwarded for
    // restrict fields), so pasting "(555) 123-4567" into numeric/10 keeps
    // all ten digits
    if (this.restrict && this.maxLength != null && !isNaN(this.maxLength) && restricted.length > this.maxLength) {
      const points = Array.from(restricted);
      let out = '';
      for (const pt of points) {
        if ((out + pt).length > this.maxLength) break;
        out += pt;
      }
      restricted = out;
    }
    if (restricted !== raw) {
      // adjust the caret by characters stripped BEFORE it only — the global
      // length diff also counted strips after the caret, landing the caret
      // behind the edit point and scrambling sustained mid-string typing
      const strippedBefore = this.applyRestrict(raw.substring(0, cursorPos));
      raw = restricted;
      el.value = raw;
      cursorPos = Math.min(strippedBefore.length, raw.length);
      try { el.setSelectionRange(cursorPos, cursorPos); } catch { /* mock DOM */ }
    }

    this.internalWrite = true;
    try {
      this.value = this.parser ? this.parser(raw) : raw;
    } catch (err) {
      if (Build.isDev) console.warn('[md-text-field] parser threw — using the raw value.', err);
      this.value = raw;
    }

    if (this.formatter && this.effectiveFormatOn === 'input' && this.maxLength != null) {
      const content = this.value.replace(/[-/\s]/g, '');
      if (content.length > this.maxLength) {
        // slice by CODE POINTS — a code-unit slice can split a surrogate
        // pair and submit corrupted Unicode (U+FFFD)
        const points = Array.from(content);
        let out = '';
        for (const pt of points) {
          if ((out + pt).length > this.maxLength) break;
          out += pt;
        }
        this.value = out;
      }
    }

    if (this.formatter && this.effectiveFormatOn === 'input') {
      try {
      // content = what the PARSER keeps (typed '.'/',' are content for number
      // formatters; group separators are not) — the alphanumeric-only count
      // orphaned decimal separators and scrambled following digits
      const contentLen = (str: string) =>
        this.parser ? this.parser(str).length : (str.match(/[0-9a-zA-Z]/g) || []).length;
      const contentBeforeCursor = contentLen(raw.substring(0, cursorPos));
      const formatted = this.formatter(this.value);
      this.displayValue = formatted;
      el.value = formatted;

      // deletions can land the caret at content position 0 — defaulting to
      // the END teleported it and scrambled "retype the first group" flows
      let newPos = contentBeforeCursor === 0 ? 0 : formatted.length;
      for (let i = 0; contentBeforeCursor > 0 && i < formatted.length; i++) {
        if (contentLen(formatted.slice(0, i + 1)) === contentBeforeCursor) {
          newPos = i + 1;
          break;
        }
      }
      try { el.setSelectionRange(newPos, newPos); } catch { /* mock DOM */ }
      } catch (err) {
        // a throwing formatter must not wedge the pipeline (uncaught per
        // keystroke froze the visible input while value kept advancing)
        if (Build.isDev) console.warn('[md-text-field] formatter threw — leaving the raw display.', err);
        this.displayValue = this.value;
        el.value = this.value;
      }
    }

    if (!(this.formatter && this.effectiveFormatOn === 'input')) {
      // keep displayValue honest while typing — the post-render type-churn
      // resync reads it and used to clobber live input with stale text
      this.displayValue = el.value;
    }
    this.internalWrite = false;
    this.mdInput.emit(this.value);
    this.emitSearch(this.value);

    if (this.multiline === 'auto-grow') {
      this.autoGrow();
    }
  };

  private handleCompositionStart = () => {
    this.composing = true;
  };

  private handleCompositionEnd = (e: Event) => {
    this.composing = false;
    this.handleInput(e);
  };

  private handleKeyDown = (e: KeyboardEvent) => {
    // Enter submits the owning form (single-line fields, like a native input)
    if (e.key === 'Enter' && !this.multiline && !this.composing) {
      try {
        const form = this.internals?.form;
        // native implicit submission activates the DEFAULT submit button so
        // its name/value participates and its click handlers fire
        const submitter = form?.querySelector<HTMLElement>(
          'button[type="submit"], input[type="submit"], button:not([type])',
        );
        form?.requestSubmit(submitter instanceof HTMLButtonElement || submitter instanceof HTMLInputElement ? submitter : undefined);
      } catch { /* spec mock */ }
    }
    // Escape clears (internal clearable only) — keyboard parity with the icon
    if (e.key === 'Escape' && !this.composing && this.clearable === 'internal' && this.value && !this.readOnly && !this.isDisabled) {
      e.stopPropagation();
      e.preventDefault(); // a parent <dialog> must not ALSO close on the clearing press
      this.clearValue();
      this.mdClear.emit(); // keyboard parity with the clear icon
    }
  };

  /** Autofill never fires input events pre-interaction — detect it via the
   *  animation hack so the label floats instead of overlapping the text. */
  private handleAutofillStart = (e: AnimationEvent) => {
    if (e.animationName === 'md-tf-autofill-start') this.autofilled = true;
    if (e.animationName === 'md-tf-autofill-cancel') this.autofilled = false;
  };

  private handleChange = () => {
    this.mdChange.emit(this.value);
    // change is non-composed — form-level change delegation never hears the
    // inner input; re-dispatch from the host (material-web parity).
    // CustomEvent, NOT Event: the Stencil `Event` decorator import shadows
    // the DOM constructor here.
    this.el.dispatchEvent(new CustomEvent('change', { bubbles: true }));
  };

  private handleFocus = () => {
    this.focused = true;
    // In blur mode, switch from formatted display to raw value for editing
    if (this.formatter && this.effectiveFormatOn === 'blur' && this.inputEl) {
      this.displayValue = this.value;
      this.inputEl.value = this.value;
    }
  };

  private handleBlur = () => {
    this.focused = false;
    this.composing = false; // abandoned compositions must not wedge the input gate
    // Always sync display value on blur
    this.syncDisplayValue();
    if (this.inputEl) {
      this.inputEl.value = this.displayValue;
    }
  };

  private handleContainerClick = () => {
    this.inputEl?.focus();
  };

  private clearValue() {
    this.internalWrite = true;
    this.value = '';
    this.internalWrite = false;
    if (this.inputEl) {
      this.inputEl.value = '';
    }
    this.displayValue = '';
    this.updateValidity();
    this.mdInput.emit(this.value);
    this.mdChange.emit(this.value);
    this.emitSearch(''); // search consumers must not keep stale results
  }

  private handleClear = (e: MouseEvent) => {
    e.stopPropagation();
    // readonly means the USER cannot mutate the value — the clear affordance included
    if (this.isDisabled || this.readOnly || !this.value) return;

    if (this.clearable === 'internal') {
      this.clearValue();
    }

    this.mdClear.emit();
    this.inputEl?.focus();
  };

  private handlePasswordToggle = (e: MouseEvent) => {
    e.stopPropagation();
    if (this.isDisabled) return;

    if (this.passwordToggle === 'internal') {
      this.passwordVisible = !this.passwordVisible;
      this.mdPasswordToggle.emit({ visible: this.passwordVisible });
    } else {
      this.mdPasswordToggle.emit({ visible: this.type === 'password' });
    }

    this.inputEl?.focus();
  };

  private handleSpeechToggle = (e: MouseEvent) => {
    e.stopPropagation();
    if (this.isDisabled || this.readOnly) return;

    if (this.speechToText === 'external') {
      this.listening = !this.listening;
      this.mdSpeechResult.emit({ transcript: '', listening: this.listening });
      return;
    }

    if (this.listening) {
      this.recognition?.stop();
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('md-text-field: SpeechRecognition API not supported in this browser.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    if (this.speechLang) {
      recognition.lang = this.speechLang;
    }

    let finalTranscript = '';
    const baseValue = this.value;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interim += transcript;
        }
      }
      const separator = baseValue && !baseValue.endsWith(' ') ? ' ' : '';
      this.internalWrite = true;
      this.value = baseValue + separator + finalTranscript + interim;
      this.internalWrite = false;
      if (this.inputEl) this.inputEl.value = this.value;
      this.mdInput.emit(this.value);
      this.mdSpeechResult.emit({ transcript: finalTranscript + interim, listening: true });
    };

    recognition.onend = () => {
      this.listening = false;
      this.recognition = undefined;
      const separator = baseValue && !baseValue.endsWith(' ') ? ' ' : '';
      this.internalWrite = true;
      this.value = baseValue + separator + finalTranscript;
      this.internalWrite = false;
      if (this.inputEl) this.inputEl.value = this.value;
      this.mdInput.emit(this.value);
      this.mdChange.emit(this.value);
      this.mdSpeechResult.emit({ transcript: finalTranscript, listening: false });
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (event: any) => {
      if (event.error !== 'aborted') {
        console.warn('md-text-field: Speech recognition error:', event.error);
      }
      this.listening = false;
      this.recognition = undefined;
    };

    this.recognition = recognition;
    this.listening = true;
    recognition.start();
  };

  disconnectedCallback() {
    this.recognition?.abort();
    this.recognition = undefined;
    clearTimeout(this.debounceTimer);
    clearTimeout(this.throttleTimer);
    // stale ids read as an OPEN throttle window after reconnect — mdSearch
    // would never emit again for this instance
    this.debounceTimer = undefined;
    this.throttleTimer = undefined;
    this.throttlePending = false;
  }

  private renderInputElement() {
    const inputType = this.passwordToggle === 'internal' && this.passwordVisible ? 'text' : this.type;
    const useRawWhileFocused = this.focused && this.formatter && this.effectiveFormatOn === 'blur';
    const showValue = useRawWhileFocused ? this.value : this.displayValue;

    const supportText = this.error && this.errorText ? this.errorText : this.supportingText;
    const describedBy = [
      supportText ? `${this.uid}-support` : '',
      this.maxLength != null && !isNaN(this.maxLength) ? `${this.uid}-counter` : '',
    ].filter(Boolean).join(' ');

    // Mirror the popup-opener kinds that are truthful ON THE INPUT: 'dialog'
    // (md-time-picker's modal trigger) and 'listbox' (the select/autocomplete
    // family — the focused input genuinely summons a listbox popup). Other
    // kinds stay host-side, and aria-controls is never mirrored (an IDREF in
    // this shadow scope can never resolve to the owner's popup).
    const hostPopupAttr = this.el.getAttribute('aria-haspopup');
    const hostPopup = hostPopupAttr === 'dialog' || hostPopupAttr === 'listbox' ? hostPopupAttr : null;
    // Combobox promotion (opt-in, `input-role="combobox"`): with the role in
    // place, aria-expanded and aria-autocomplete become allowed on this input,
    // so the owner's popup state is exposed on the element AT actually reads.
    // The listbox itself is still referenced by the OWNER, via ARIA element
    // reflection — see md-autocomplete. An IDREF could not do it: it would have
    // to resolve inside this shadow root, where the owner's listbox is not.
    const comboboxRole = this.inputRole === 'combobox' ? 'combobox' : undefined;
    const sharedProps = {
      placeholder: this.isFloating ? this.placeholder : '',
      disabled: this.isDisabled,
      readOnly: this.readOnly,
      required: this.required,
      // restrict fields enforce length POST-strip in handleInput — native
      // maxLength would truncate a paste BEFORE restrict runs, dropping legal chars
      maxLength: (this.formatter && this.effectiveFormatOn === 'input') || this.restrict ? undefined : this.maxLength,
      pattern: this.pattern || undefined,
      minLength: this.minLength,
      min: this.min,
      max: this.max,
      step: this.step,
      autocomplete: this.autocomplete || undefined,
      inputMode: this.inputMode || undefined,
      enterKeyHint: this.enterKeyHint || undefined,
      autoCapitalize: this.autoCapitalize || undefined,
      spellcheck: this.spellcheck,
      // value LAST: Stencil applies JSX props in order, and value-before-
      //   type/min/max triggers dev warnings + transient clamping
      value: showValue,
      'aria-label': this.label || this.hostAriaLabel || undefined,
      // popup-trigger passthrough: composite widgets (md-time-picker etc.)
      // set aria-haspopup / aria-expanded / aria-controls on the host, but
      // AT reads the focused element — the inner input — so mirror them.
      // Only aria-haspopup is mirrored from the HOST — it's an ARIA *global*
      // attribute, valid on the textbox role. aria-expanded is not allowed on a
      // bare textbox (axe: critical aria-allowed-attr), so an owner that needs
      // it opts into `input-role="combobox"` above instead of pushing the
      // attribute at the host. Read live from the host each render; the host
      // attrs are re-applied by the owner's JSX and any owner state flip that
      // changes them also re-renders this field (e.g. via appearFocused).
      'aria-haspopup': hostPopup || undefined,
      role: comboboxRole,
      'aria-expanded': comboboxRole ? String(this.inputExpanded) : undefined,
      'aria-autocomplete':
        comboboxRole && this.inputAriaAutocomplete ? this.inputAriaAutocomplete : undefined,
      'aria-describedby': describedBy || undefined,
      // omit when valid — a hard-coded "false" suppresses the browser's own
      // :user-invalid signal on the inner input
      'aria-invalid': this.error ? 'true' : undefined,
      'aria-required': this.required ? 'true' : undefined,
      id: `${this.uid}-input`,
      onInput: this.handleInput,
      onChange: this.handleChange,
      onFocus: this.handleFocus,
      onBlur: this.handleBlur,
      onKeyDown: this.handleKeyDown,
      onCompositionstart: this.handleCompositionStart,
      onCompositionend: this.handleCompositionEnd,
      onAnimationStart: this.handleAutofillStart,
    };

    if (this.multiline) {
      return (
        <textarea
          ref={(el?: HTMLTextAreaElement) => { this.inputEl = el; }}
          {...sharedProps}
          rows={this.effectiveRows}
          part="input"
          class={{
            'md-text-field__input': true,
            'md-text-field__input--textarea': true,
            'md-text-field__input--auto-grow': this.multiline === 'auto-grow',
            'md-text-field__input--fixed': this.multiline === 'fixed',
          }}
        >
          {showValue}
        </textarea>
      );
    }

    return (
      <input
        ref={(el?: HTMLInputElement) => { this.inputEl = el; }}
        class="md-text-field__input"
        part="input"
        type={inputType}
        {...sharedProps}
      />
    );
  }

  render() {
    const supportText = this.error && this.errorText ? this.errorText : this.supportingText;
    const showClear = !!this.clearable;
    const showPasswordToggle = !this.multiline && !!this.passwordToggle;
    const showSpeech = !!this.speechToText;
    const hasLeading = this.hasSlottedLeading;
    const hasTrailing = this.hasSlottedTrailing || showClear || showPasswordToggle || showSpeech || this.error;
    // The counter must count what the LIMIT counts: native maxLength counts
    // every char; only the live-formatter path enforces a stripped length.
    const usesFormatterLimit = !!this.formatter && this.effectiveFormatOn === 'input';
    const contentLength = usesFormatterLimit
      ? this.value.replace(/[-/\s]/g, '').length
      : this.value.length;
    const charCount = this.maxLength != null && !isNaN(this.maxLength) ? `${contentLength}/${this.maxLength}` : '';
    const clearDisabled = this.isDisabled || this.readOnly || !this.value;

    const isPasswordRevealed = this.passwordToggle === 'internal'
      ? this.passwordVisible
      : this.type !== 'password';
    const passwordIcon = isPasswordRevealed ? 'visibility_off' : 'visibility';

    return (
      <Host
        class={{
          'md-text-field': true,
          [`md-text-field--${this.variant}`]: true,
          'md-text-field--focused': this.focused || this.appearFocused,
          'md-text-field--error': this.error,
          'md-text-field--disabled': this.isDisabled,
          'md-text-field--with-leading': hasLeading,
          'md-text-field--with-trailing': hasTrailing,
          'md-text-field--with-chips': this.hasSlottedChips,
          'md-text-field--floating': this.isFloating,
          [`md-text-field--density${this.density}`]: this.density !== 0,
          'md-text-field--multiline': !!this.multiline,
          'md-text-field--auto-grow': this.multiline === 'auto-grow',
          'md-text-field--textarea': this.multiline === 'fixed',
          'md-text-field--listening': this.listening,
        }}
        style={Number(this.focusBorderWidth) !== 3 ? {
          // Only inline when the prop deviates — unconditional inline styles
          // made the documented custom properties dead (clobbered every render).
          '--md-text-field-focus-border-width': `${Number(this.focusBorderWidth)}px`,
          '--md-text-field-focus-inset': `${-(Number(this.focusBorderWidth) - 1)}px`,
        } : undefined}
      >
        <div class="md-text-field__container" part="container" onClick={this.handleContainerClick}>
          <div class="md-text-field__state-layer" aria-hidden="true"></div>

          <span
            class="md-text-field__icon md-text-field__icon--leading"
            aria-hidden="true"
            style={{ display: hasLeading ? undefined : 'none' }}
          >
            <slot name="leading-icon"></slot>
          </span>

          <div class="md-text-field__input-wrap">
            {this.label && (
              <label class="md-text-field__label" part="label" htmlFor={`${this.uid}-input`}>{this.label}</label>
            )}

            <div class="md-text-field__input-row">
              {/* Interactive leading content (multi-select chips). Kept in the input
                  flow and NOT aria-hidden, so its focusable controls stay operable.
                  Only occupies space when populated. */}
              <span
                class="md-text-field__chips"
                part="chips"
                style={{ display: this.hasSlottedChips ? undefined : 'none' }}
              >
                <slot name="chips"></slot>
              </span>
              {this.prefixText && this.isFloating && (
                <span class="md-text-field__prefix">{this.prefixText}</span>
              )}
              {this.renderInputElement()}
              {this.suffixText && this.isFloating && (
                <span class="md-text-field__suffix">{this.suffixText}</span>
              )}
            </div>
          </div>

          {showClear && (
            <button
              type="button"
              class={{
                'md-text-field__clear': true,
                'md-text-field__clear--disabled': clearDisabled,
                'md-text-field__clear--empty': !this.value,
              }}
              disabled={clearDisabled}
              onClick={this.handleClear}
              aria-label="Clear"
            >
              <slot name="clear-icon">
                <span class="material-symbols-outlined" aria-hidden="true">cancel</span>
              </slot>
            </button>
          )}

          {showPasswordToggle && (
            <button
              type="button"
              class={{
                'md-text-field__password-toggle': true,
                'md-text-field__password-toggle--disabled': this.isDisabled,
              }}
              disabled={this.isDisabled}
              onClick={this.handlePasswordToggle}
              aria-label={isPasswordRevealed ? 'Hide password' : 'Show password'}
              aria-pressed={isPasswordRevealed ? 'true' : 'false'}
            >
              <slot name="password-toggle-icon">
                <span class="material-symbols-outlined" aria-hidden="true">{passwordIcon}</span>
              </slot>
            </button>
          )}

          {showSpeech && (
            <button
              type="button"
              class={{
                'md-text-field__speech': true,
                'md-text-field__speech--listening': this.listening,
                'md-text-field__speech--disabled': this.isDisabled,
              }}
              disabled={this.isDisabled || this.readOnly}
              onClick={this.handleSpeechToggle}
              aria-label={this.listening ? 'Stop listening' : 'Start voice input'}
              aria-pressed={this.listening ? 'true' : 'false'}
            >
              <slot name="speech-icon">
                <span class="material-symbols-outlined" aria-hidden="true">
                  {this.listening ? 'hearing' : 'mic'}
                </span>
              </slot>
            </button>
          )}

          {this.error && (
            <span class="md-text-field__error-icon" aria-hidden="true">
              <slot name="error-icon">
                <span class="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>error</span>
              </slot>
            </span>
          )}

          <span
            class={{
              'md-text-field__icon': !this.hasTrailingIconButton,
              'md-text-field__icon--trailing': !this.hasTrailingIconButton,
              'md-text-field__trailing-icon-button': this.hasTrailingIconButton,
            }}
            // interactive slotted content (md-date-picker's icon buttons) must
            // NOT be pruned from the AX tree while staying tabbable
            aria-hidden={this.hasTrailingIconButton ? null : 'true'}
            style={{ display: this.hasSlottedTrailing ? undefined : 'none' }}
          >
            <slot name="trailing-icon"></slot>
          </span>

          {this.variant === 'filled' && <div class="md-text-field__indicator"></div>}

          {this.variant === 'outlined' && (
            <fieldset class="md-text-field__fieldset">
              {/* Only cut a notch when there's a label to notch around — an empty
                  active legend still reserves `padding-inline`, leaving a blank
                  gap in the top border (e.g. a label-less pagination select). */}
              <legend
                class={{
                  'md-text-field__legend': true,
                  'md-text-field__legend--active': this.isFloating && !!this.label,
                }}
              >
                <span>{this.label}</span>
              </legend>
            </fieldset>
          )}
        </div>

        {(supportText || charCount || this.reserveSupportingSpace) && (
          <div class="md-text-field__support-row">
            <span
              id={`${this.uid}-support`}
              part="supporting-text"
              role={this.error ? 'alert' : undefined}
              class={{ 'md-text-field__support-text': true, 'md-text-field__support-text--error': this.error }}
            >
              {/* A zero-width space holds the line box open when reserving, so
                  the row has height before any message exists. An empty span
                  would collapse and defeat the reservation. */}
              {supportText || (this.reserveSupportingSpace ? '\u200B' : '')}
            </span>
            {charCount && <span id={`${this.uid}-counter`} part="counter" class="md-text-field__counter">{charCount}</span>}
          </div>
        )}
      </Host>
    );
  }
}
