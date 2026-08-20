import { AttachInternals, Component, Element, Event, EventEmitter, Host, Method, Prop, State, Watch, h } from '@stencil/core';
import { setFormValue, checkValidityOf, reportValidityOf, getValidityOf } from '../../utils/form';

/** What caused a value change / commit — reported as `reason` on every event. */
export type MdNumberFieldChangeReason =
  | 'input-change'
  | 'input-clear'
  | 'input-blur'
  | 'keyboard'
  | 'increment-press'
  | 'decrement-press'
  | 'wheel'
  | 'none';

/** Detail payload of `mdInput` / `mdChange`. */
export interface MdNumberFieldChangeDetail {
  /** The raw numeric value (`null` = empty). Never the formatted string. */
  value: number | null;
  /** The formatted display text at emit time. */
  formattedValue: string;
  /** What caused the change. */
  reason: MdNumberFieldChangeReason;
}

/** Press-and-hold: delay before auto-repeat starts — long enough that a
 *  deliberate single press never repeats. */
const HOLD_START_DELAY_MS = 400;
/** Press-and-hold: fixed auto-repeat interval — deliberately no acceleration,
 *  so the rate stays predictable and overshoot is one tap to correct. */
const HOLD_TICK_MS = 60;

/** Bidi/format control characters the parser strips (never rejects). */
const BIDI_CONTROL_RE = /[\u061c\u200b\u200e\u200f\u202a-\u202e\u2066-\u2069]/g;
/** Whitespace flavours seen in formatted numbers (NBSP, thin, narrow NBSP…). */
const SPACE_CHAR_RE = /[\s\u00a0\u2009\u202f]/;
const SPACE_CHAR_RE_G = /[\s\u00a0\u2009\u202f]/g;

/** Everything the locale/format-aware parser needs, derived once per
 *  locale+options pair from `Intl.NumberFormat.formatToParts`. */
interface NumberFormatInfo {
  formatter: Intl.NumberFormat;
  /** Grouping separator (may be a NBSP flavour). Empty when the locale has none. */
  group: string;
  /** Decimal separator — always resolved from the plain locale format, because
   *  the active format may have no fraction digits at all (percent default). */
  decimal: string;
  minus: string;
  plus: string;
  percent: string;
  /** Currency / unit / literal characters of the active format, concatenated. */
  symbolChars: string;
  /** Locale numeral glyph → ASCII digit (empty for latin-digit locales). */
  digitMap: Map<string, string>;
  /** Intl percent semantics: displayed 50% ⇔ value 0.5. */
  isPercent: boolean;
  /** Characters the keydown filter lets through. */
  allowed: Set<string>;
}

function buildFormatInfo(locale: string, options?: Intl.NumberFormatOptions): NumberFormatInfo {
  const resolvedLocale = locale || undefined;
  let formatter: Intl.NumberFormat;
  try {
    formatter = new Intl.NumberFormat(resolvedLocale, options);
  } catch {
    // Invalid options (e.g. style:'currency' with no currency code) must not
    // brick the field — fall back to the plain locale format.
    formatter = new Intl.NumberFormat(resolvedLocale);
  }
  let group = '';
  let decimal = '';
  let minus = '-';
  let plus = '+';
  let percent = '';
  let symbolChars = '';
  // Plain-locale pass FIRST: the active format may have no decimal part at all
  // (percent defaults to 0 fraction digits), yet users still paste decimals.
  const plain = new Intl.NumberFormat(resolvedLocale);
  for (const part of plain.formatToParts(-12345678.9)) {
    if (part.type === 'group') group = part.value;
    else if (part.type === 'decimal') decimal = part.value;
    else if (part.type === 'minusSign') minus = part.value;
  }
  for (const part of formatter.formatToParts(-12345678.9)) {
    switch (part.type) {
      case 'group': group = part.value; break;
      case 'decimal': decimal = part.value; break;
      case 'minusSign': minus = part.value; break;
      case 'plusSign': plus = part.value; break;
      case 'percentSign': percent = part.value; break;
      case 'currency':
      case 'unit':
      case 'literal':
        symbolChars += part.value;
        break;
      default:
        break;
    }
  }
  const digitMap = new Map<string, string>();
  const digits = new Intl.NumberFormat(resolvedLocale, { useGrouping: false });
  for (let d = 0; d <= 9; d++) {
    const glyph = digits.format(d);
    if (glyph !== String(d)) digitMap.set(glyph, String(d));
  }
  let isPercent = false;
  try {
    isPercent = formatter.resolvedOptions().style === 'percent';
  } catch { /* resolvedOptions is universal, but stay defensive */ }
  const allowed = new Set<string>();
  for (let d = 0; d <= 9; d++) allowed.add(String(d));
  for (const glyph of digitMap.keys()) allowed.add(glyph);
  for (const ch of group + decimal + minus + plus + symbolChars) allowed.add(ch);
  // ASCII sign keys always work, whatever glyph the locale renders.
  allowed.add('-');
  allowed.add('+');
  if (isPercent) {
    allowed.add('%');
    if (percent) allowed.add(percent);
  }
  // Formats that separate with NBSP flavours accept the plain space key too.
  if (SPACE_CHAR_RE.test(group + symbolChars)) allowed.add(' ');
  return { formatter, group, decimal, minus, plus, percent, symbolChars, digitMap, isPercent, allowed };
}

/** The embedded md-text-field, addressed structurally (no global element types). */
type FieldElement = HTMLElement & {
  value?: string;
  focus?: () => void;
  setFocus?: () => Promise<void>;
  select?: () => Promise<void>;
};

/** Normalize float noise after arithmetic stepping: `toPrecision(15)` with a
 *  1e-10 absolute delta cap, so 0.1 + 0.2 commits as 0.3 while a value that
 *  genuinely needs those digits survives untouched. Typed values are never
 *  passed through this — they stay verbatim. */
function cleanFloat(n: number): number {
  if (!Number.isFinite(n)) return n;
  const p = parseFloat(n.toPrecision(15));
  return Math.abs(p - n) < 1e-10 ? p : n;
}

/**
 * `md-number-field` — Material Design 3 number input: an `md-text-field`
 * with locale-aware `Intl.NumberFormat` display, arrow-key / stepper-button /
 * wheel stepping, and native form participation.
 *
 * Behavior contract:
 *   - the visible control is a **plain text input** (`inputmode` numeric or
 *     decimal) — deliberately NOT `role="spinbutton"` and NOT
 *     `type="number"`, so the locale-formatted value stays ordinary readable,
 *     editable text and no native spinner chrome fights the Intl display;
 *     the steppers are separate labeled buttons with `tabindex="-1"` (the
 *     input is the keyboard surface),
 *   - `value` is the raw number (`null` = empty); the formatted string is
 *     display-only state,
 *   - ArrowUp/Down step by `step`, Alt = `smallStep`, Shift = `largeStep`;
 *     Home/End jump to a defined `min`/`max`,
 *   - press-and-hold on a stepper auto-repeats (400ms delay, 60ms interval),
 *   - typing is filtered to the characters of the active locale/format,
 *     parsed leniently and kept verbatim; blur reformats (and clamps unless
 *     `allow-out-of-range`),
 *   - stepping (keys, buttons, wheel) always clamps and commits (`mdChange`).
 *
 * A drag-to-scrub surface (pointer lock over the field) is deliberately out of
 * scope: a niche gesture built on pointer lock, whose behaviour is unreliable
 * in Safari. `allow-wheel-scrub` covers the "nudge without typing" case.
 */
@Component({
  tag: 'md-number-field',
  styleUrl: 'md-number-field.css',
  shadow: true,
  formAssociated: true,
})
export class MdNumberField {
  @Element() el!: HTMLElement;

  /**
   * Form-association handle. The raw value is submitted under the host's
   * `name` via `setFormValue` (`String(value)`; empty submits no entry).
   */
  @AttachInternals() internals!: ElementInternals;

  // ── Props ────────────────────────────────────────────────

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

  /** Read-only: the value is visible and focusable but cannot be edited or stepped. */
  @Prop({ attribute: 'readonly' }) readOnly: boolean = false;

  /** Required for native form parity (`valueMissing` when empty). */
  @Prop({ reflect: true }) required: boolean = false;

  /** Form name. The raw numeric value submits as `String(value)`. */
  @Prop({ reflect: true }) name: string = '';

  /** Density forwarded to the text-field and applied to the steppers. */
  @Prop({ reflect: true }) density: 0 | -1 | -2 | -3 | -4 = 0;

  /**
   * The raw numeric value (`null` = empty). Never the formatted string —
   * the display text is derived via `Intl.NumberFormat`.
   */
  @Prop({ mutable: true }) value: number | null = null;

  /**
   * BCP-47 locale for `Intl.NumberFormat` display/parsing ONLY (an
   * Intl-computed value — translatable copy stays in the `*-label` props).
   * Empty = the runtime locale.
   */
  @Prop() locale: string = '';

  /**
   * `Intl.NumberFormat` options for display formatting (currency, percent,
   * unit, fraction digits…). Percent keeps Intl semantics: displayed 50% ⇔
   * value 0.5.
   *
   * Takes either form, so a plain-HTML page needs no script:
   *   - property — `el.formatOptions = { style: 'currency', currency: 'EUR' }`
   *   - attribute — `format-options='{"style":"currency","currency":"EUR"}'`
   *
   * Malformed JSON warns once and falls back to plain number formatting rather
   * than throwing: a broken attribute must not take the whole field down.
   */
  @Prop({ attribute: 'format-options' }) formatOptions?: Intl.NumberFormatOptions | string;

  /** Parsed form of `formatOptions`, memoised on the raw attribute string. */
  private parsedOptionsKey?: string;
  private parsedOptionsCache?: Intl.NumberFormatOptions;

  /** Lower bound. Interactive stepping always clamps to it. */
  @Prop() min?: number;

  /** Upper bound. Interactive stepping always clamps to it. */
  @Prop() max?: number;

  /** Step for arrows / steppers / wheel. */
  @Prop() step: number = 1;

  /** Step while **Alt** is held. */
  @Prop({ attribute: 'small-step' }) smallStep: number = 0.1;

  /** Step while **Shift** is held. */
  @Prop({ attribute: 'large-step' }) largeStep: number = 10;

  /**
   * Snap stepped values to multiples of the active step (base = `min` when
   * defined, else 0). Snapping happens BEFORE clamping, so non-aligned
   * bounds stay reachable. Regular steps snap directionally; Alt
   * (`smallStep`) snaps to the nearest multiple.
   */
  @Prop({ attribute: 'snap-on-step' }) snapOnStep: boolean = false;

  /**
   * Let TYPED text exceed `min`/`max` unclamped (blur does not clamp).
   * Step-based interactions (keys, buttons, wheel) always clamp.
   */
  @Prop({ attribute: 'allow-out-of-range' }) allowOutOfRange: boolean = false;

  /** Enable wheel stepping while the inner input has focus. */
  @Prop({ attribute: 'allow-wheel-scrub' }) allowWheelScrub: boolean = false;

  /** Which stepper buttons render: inside the field, split around it, or none. */
  @Prop() steppers: 'inline' | 'split' | 'none' = 'inline';

  /** Accessible name of the increment stepper (localizable). */
  @Prop({ attribute: 'increment-label' }) incrementLabel: string = 'Increment';

  /** Accessible name of the decrement stepper (localizable). */
  @Prop({ attribute: 'decrement-label' }) decrementLabel: string = 'Decrement';

  /**
   * Localized constraint-validation message shown when `required` is unmet.
   * `errorText` still wins when set, so an app-supplied inline message and
   * the native bubble stay in agreement.
   */
  @Prop({ attribute: 'value-missing-label' }) valueMissingLabel: string = 'Please enter a number.';

  /**
   * Always occupy the supporting-text line, even when there is no message, so
   * a validation error does not push the content below it down. Forwarded to
   * the embedded md-text-field.
   */
  @Prop({ attribute: 'reserve-supporting-space' }) reserveSupportingSpace: boolean = false;

  // ── Events ───────────────────────────────────────────────

  /** Fires on every value change (typing included). */
  @Event() mdInput: EventEmitter<MdNumberFieldChangeDetail>;

  /** Fires at commit points: blur/Enter reformat, stepping, wheel. */
  @Event() mdChange: EventEmitter<MdNumberFieldChangeDetail>;

  /**
   * Fires when this control's validity CHANGES — never on every keystroke, and
   * never for a re-publish that lands on the same state.
   *
   * `composed: false` is deliberate. Composites embedding a field would
   * otherwise hear two events for one logical control; `bubbles: true` still
   * lets a `<form>` or app root hear every control.
   */
  @Event({ bubbles: true, composed: false }) mdValidityChange: EventEmitter<{
    valid: boolean;
    validationMessage: string;
    flags: Record<string, boolean>;
  }>;

  // ── State ────────────────────────────────────────────────

  /** Formatted display text (the text-field's `value`). */
  @State() private inputValue: string = '';

  /** True while the inner input has focus (wheel gating). */
  @State() private focused = false;

  /** Ancestor form/fieldset disabled via formDisabledCallback. */
  @State() private formDisabled = false;

  // ── Private fields ───────────────────────────────────────

  private fieldEl?: FieldElement;

  private defaultValue: number | null = null;
  /** Last value published through mdChange — blur without change stays silent. */
  private lastCommitted: number | null = null;
  /** True while a this.value mutation originates from user input handlers. */
  private internalWrite = false;
  /** Message set via setCustomValidity(); non-empty wins over valueMissing. */
  private customValidityMessage = '';
  /** Last emitted validity, so a re-publish that changes nothing stays silent. */
  private lastValidityKey: string | null = null;

  private formatInfoCache?: NumberFormatInfo;
  private formatInfoKey?: string;

  // Press-and-hold machinery (timeouts on the instance; cleared on disconnect).
  private holdTimer?: ReturnType<typeof setTimeout>;
  private holdInterval?: ReturnType<typeof setInterval>;
  private holdDir: 1 | -1 = 1;
  private heldAlt = false;
  private heldShift = false;

  // ── Private getters ──────────────────────────────────────

  /** Consumer `disabled` OR ancestor form/fieldset disabled. */
  private get isDisabled(): boolean {
    return this.disabled || this.formDisabled;
  }

  /** The options as an object, whichever way they were supplied. */
  private get formatOptionsObject(): Intl.NumberFormatOptions | undefined {
    const raw = this.formatOptions;
    if (raw == null) return undefined;
    if (typeof raw !== 'string') return raw;
    const trimmed = raw.trim();
    if (!trimmed) return undefined;
    if (this.parsedOptionsKey !== trimmed) {
      this.parsedOptionsKey = trimmed;
      try {
        const parsed: unknown = JSON.parse(trimmed);
        const usable = !!parsed && typeof parsed === 'object' && !Array.isArray(parsed);
        this.parsedOptionsCache = usable ? (parsed as Intl.NumberFormatOptions) : undefined;
        if (!usable && typeof console !== 'undefined') {
          console.warn(
            '[md-number-field] `format-options` must be a JSON object:',
            raw,
          );
        }
      } catch {
        this.parsedOptionsCache = undefined;
        if (typeof console !== 'undefined') {
          console.warn(
            '[md-number-field] `format-options` attribute is not valid JSON:',
            raw,
          );
        }
      }
    }
    return this.parsedOptionsCache;
  }

  private get formatInfo(): NumberFormatInfo {
    let optionsKey = 'null';
    try {
      optionsKey = JSON.stringify(this.formatOptions ?? null) ?? 'null';
    } catch {
      optionsKey = 'opaque';
    }
    const key = `${this.locale}|${optionsKey}`;
    if (!this.formatInfoCache || this.formatInfoKey !== key) {
      this.formatInfoCache = buildFormatInfo(this.locale, this.formatOptionsObject);
      this.formatInfoKey = key;
    }
    return this.formatInfoCache;
  }

  /** Sanitized regular step (guards 0/negative/NaN back to 1). */
  private get stepAmount(): number {
    const n = Number(this.step);
    return Number.isFinite(n) && n > 0 ? n : 1;
  }

  private get minBound(): number | null {
    const n = this.min == null ? NaN : Number(this.min);
    return Number.isFinite(n) ? n : null;
  }

  private get maxBound(): number | null {
    const n = this.max == null ? NaN : Number(this.max);
    return Number.isFinite(n) ? n : null;
  }

  /**
   * `numeric` (digit-only software keyboard) when negatives are impossible
   * (`min >= 0`) and neither step nor format implies decimals; otherwise
   * `decimal` (exposes the separator — and, on iOS, the minus key lives on
   * the decimal/numeric layouts, so `decimal` also serves `min < 0`).
   */
  private get resolvedInputMode(): 'numeric' | 'decimal' {
    const fo = this.formatOptionsObject;
    const fractional =
      !Number.isInteger(this.stepAmount) ||
      (fo != null &&
        (((fo.maximumFractionDigits ?? 0) > 0) ||
          ((fo.minimumFractionDigits ?? 0) > 0) ||
          fo.style === 'currency' ||
          fo.style === 'percent'));
    const min = this.minBound;
    return min != null && min >= 0 && !fractional ? 'numeric' : 'decimal';
  }

  // ── Public methods ───────────────────────────────────────

  /** Focus the inner input. */
  @Method()
  async setFocus() {
    this.focusField();
  }

  /** Select the input's full contents. */
  @Method()
  async select() {
    await this.fieldEl?.select?.();
  }

  /** Step up by `step` (× `times`), snapping/clamping like an arrow press. */
  @Method()
  async stepUp(times: number = 1) {
    this.doStep(1, this.stepAmount * Math.max(1, times), false, 'none');
  }

  /** Step down by `step` (× `times`), snapping/clamping like an arrow press. */
  @Method()
  async stepDown(times: number = 1) {
    this.doStep(-1, this.stepAmount * Math.max(1, times), false, 'none');
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

  /** Constraint-validation API, matching md-text-field and the native contract. */
  @Method()
  async checkValidity(): Promise<boolean> {
    return checkValidityOf(this.internals);
  }

  @Method()
  async reportValidity(): Promise<boolean> {
    return reportValidityOf(this.internals);
  }

  /** App/server-side validation: a non-empty message marks the field
   *  invalid for its form until cleared with an empty string. */
  @Method()
  async setCustomValidity(message: string) {
    this.customValidityMessage = message;
    this.updateValidity();
  }

  // ── Lifecycle + form callbacks ───────────────────────────

  componentWillLoad() {
    this.normalizeValueProp();
    this.defaultValue = this.value;
    this.lastCommitted = this.value;
    this.inputValue = this.formatValue(this.value);
    this.syncFormValue();
  }

  componentDidLoad() {
    // Re-publish validity now that the field ref exists: reportValidity()
    // needs a FOCUSABLE anchor, and the pre-render publish anchored the host.
    this.updateValidity();
    if (typeof window === 'undefined') return;
    // Non-passive: a scrub must preventDefault the page scroll.
    this.el.addEventListener('wheel', this.handleWheel, { passive: false });
  }

  disconnectedCallback() {
    if (typeof window !== 'undefined') {
      this.el.removeEventListener('wheel', this.handleWheel);
    }
    this.endHold();
  }

  formResetCallback() {
    this.internalWrite = false;
    this.customValidityMessage = '';
    this.value = this.defaultValue;
    // The watch only fires when the value actually moved — sync explicitly so
    // display/form/commit baseline reset even when it did not.
    this.inputValue = this.formatValue(this.value);
    this.lastCommitted = this.value;
    this.syncFormValue();
  }

  formDisabledCallback(disabled: boolean) {
    // called synchronously while Stencil reflects the disabled attribute
    // during render — a direct @State write logs 'changed during rendering'
    queueMicrotask(() => {
      this.formDisabled = disabled;
    });
  }

  formStateRestoreCallback(state: string | File | FormData | null) {
    // browser session restore / bfcache — native inputs restore their value
    if (typeof state === 'string') {
      const n = state === '' ? NaN : Number(state);
      this.value = Number.isFinite(n) ? n : null;
    }
  }

  // ── Watches ──────────────────────────────────────────────

  @Watch('value')
  onValueChange() {
    this.normalizeValueProp();
    this.syncFormValue();
    if (!this.internalWrite) {
      // A programmatic write is a committed fact, not a pending edit.
      this.lastCommitted = this.value;
      const formatted = this.formatValue(this.value);
      if (this.inputValue !== formatted) this.inputValue = formatted;
    }
  }

  @Watch('locale')
  @Watch('formatOptions')
  onFormatChange() {
    this.formatInfoKey = undefined;
    this.inputValue = this.formatValue(this.value);
  }

  @Watch('required')
  @Watch('valueMissingLabel')
  updateValidity() {
    if (!this.internals?.setValidity) return; // spec mock — e2e covers the real path
    // setCustomValidity() takes precedence over valueMissing, matching native.
    if (this.customValidityMessage) {
      this.internals.setValidity(
        { customError: true },
        this.customValidityMessage,
        (this.fieldEl as HTMLElement) ?? this.el,
      );
    } else if (this.required && this.value === null) {
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

  // ── Value plumbing ───────────────────────────────────────

  /** Framework proxies can write strings/undefined through the number prop. */
  private normalizeValueProp() {
    const v = this.value as unknown;
    if (v === null) return;
    if (typeof v === 'number') {
      if (!Number.isFinite(v)) this.value = null; // watch re-fires with null
      return;
    }
    const n = v === '' || v == null ? NaN : Number(v);
    this.value = Number.isFinite(n) ? n : null; // watch re-fires with the clean value
  }

  private syncFormValue() {
    // null → no FormData entry (md-autocomplete convention), else the RAW value.
    setFormValue(this.internals, this.value === null ? null : String(this.value));
    this.updateValidity();
  }

  /**
   * Emit mdValidityChange if validity actually moved.
   *
   * The FIRST call only primes the baseline. Initial state is not a change,
   * and emitting on mount would fire once per control on every page load.
   */
  private emitValidityChange() {
    const v = getValidityOf(this.internals);
    const key = `${v.valid}|${v.validationMessage}`;
    if (this.lastValidityKey === key) return;
    const primed = this.lastValidityKey !== null;
    this.lastValidityKey = key;
    if (primed) this.mdValidityChange.emit(v);
  }

  // ── Parse / format ───────────────────────────────────────

  private formatValue(v: number | null): string {
    if (v === null) return '';
    try {
      return this.formatInfo.formatter.format(v);
    } catch {
      return String(v);
    }
  }

  /** Locale/format-aware lenient parse. `null` = not a number. */
  private parseNumber(raw: string): number | null {
    if (!raw) return null;
    const info = this.formatInfo;
    let s = raw.replace(BIDI_CONTROL_RE, '');
    if (info.digitMap.size > 0) {
      let mapped = '';
      for (const ch of s) mapped += info.digitMap.get(ch) ?? ch;
      s = mapped;
    }
    // Strip the active format's currency/unit/literal characters, then any
    // whitespace flavour (formats separate with NBSP variants).
    for (const ch of new Set(info.symbolChars)) s = s.split(ch).join('');
    s = s.replace(SPACE_CHAR_RE_G, '');
    if (info.percent) s = s.split(info.percent).join('');
    s = s.split('%').join('');
    if (info.group) s = s.split(info.group).join('');
    if (info.decimal && info.decimal !== '.') s = s.split(info.decimal).join('.');
    if (info.minus && info.minus !== '-') s = s.split(info.minus).join('-');
    if (info.plus && info.plus !== '+') s = s.split(info.plus).join('+');
    // U+2212 minus and its dash lookalikes normalize to ASCII.
    s = s.replace(/[\u2012\u2013\u2212]/g, '-');
    if (s === '' || s === '-' || s === '+') return null;
    const n = Number(s);
    if (!Number.isFinite(n)) return null;
    // Intl percent semantics: the typed "50" in a percent field means 0.5.
    return info.isPercent ? n / 100 : n;
  }

  /** Every character is a numeral/separator/sign/symbol of the active format. */
  private hasOnlyAllowedChars(raw: string): boolean {
    const info = this.formatInfo;
    for (const ch of raw.replace(BIDI_CONTROL_RE, '')) {
      if (info.allowed.has(ch)) continue;
      if (SPACE_CHAR_RE.test(ch)) continue; // any whitespace flavour is tolerated
      return false;
    }
    return true;
  }

  private clamp(n: number): number {
    const min = this.minBound;
    const max = this.maxBound;
    if (min != null && n < min) n = min;
    if (max != null && n > max) n = max;
    return n;
  }

  /** Snap BEFORE clamping, so a non-aligned bound stays reachable: base =
   *  `min` ?? 0; directional for regular steps, nearest for Alt;
   *  ε = amount × 1e-10. */
  private snap(candidate: number, amount: number, dir: 1 | -1, nearest: boolean): number {
    const base = this.minBound ?? 0;
    const offset = candidate - base;
    const eps = amount * 1e-10;
    let units: number;
    if (nearest) units = Math.round(offset / amount);
    else if (dir > 0) units = Math.floor(offset / amount + eps);
    else units = Math.ceil(offset / amount - eps);
    return cleanFloat(base + units * amount);
  }

  private atBound(dir: 1 | -1): boolean {
    if (this.value === null) return false;
    if (dir > 0) return this.maxBound != null && this.value >= this.maxBound;
    return this.minBound != null && this.value <= this.minBound;
  }

  private makeDetail(reason: MdNumberFieldChangeReason): MdNumberFieldChangeDetail {
    return { value: this.value, formattedValue: this.inputValue, reason };
  }

  /**
   * One step of interactive/programmatic stepping. Steps from the parsed
   * VISIBLE text when the user edited it (not stale state); an empty field
   * seeds from 0; snaps (opt-in) before clamping; always clamps; commits.
   */
  private doStep(dir: 1 | -1, amount: number, nearestSnap: boolean, reason: MdNumberFieldChangeReason) {
    if (!(Number.isFinite(amount) && amount > 0)) amount = this.stepAmount;
    const parsed = this.parseNumber(this.inputValue);
    const base = parsed ?? this.value ?? 0;
    let next = base + dir * amount;
    if (this.snapOnStep) next = this.snap(next, amount, dir, nearestSnap);
    next = cleanFloat(this.clamp(next));
    const prev = this.value;
    this.internalWrite = true;
    this.value = next;
    this.internalWrite = false;
    this.inputValue = this.formatValue(next);
    const detail = this.makeDetail(reason);
    if (next !== prev) this.mdInput.emit(detail);
    if (next !== this.lastCommitted) {
      this.lastCommitted = next;
      this.mdChange.emit(detail);
    }
  }

  /** Non-stepping value set (Home/End): clamps and commits. */
  private setAndCommit(n: number, reason: MdNumberFieldChangeReason) {
    const next = cleanFloat(this.clamp(n));
    const prev = this.value;
    this.internalWrite = true;
    this.value = next;
    this.internalWrite = false;
    this.inputValue = this.formatValue(next);
    const detail = this.makeDetail(reason);
    if (next !== prev) this.mdInput.emit(detail);
    if (next !== this.lastCommitted) {
      this.lastCommitted = next;
      this.mdChange.emit(detail);
    }
  }

  /** Blur/Enter commit: reformat, clamp TYPED text unless allow-out-of-range. */
  private commitTyped(reason: MdNumberFieldChangeReason) {
    const parsed = this.parseNumber(this.inputValue);
    let next = parsed;
    // Typed values stay verbatim (no float cleanup); only the range is enforced.
    if (next !== null && !this.allowOutOfRange) next = this.clamp(next);
    const prev = this.value;
    this.internalWrite = true;
    this.value = next;
    this.internalWrite = false;
    this.inputValue = this.formatValue(next);
    const detail = this.makeDetail(reason);
    if (next !== prev) this.mdInput.emit(detail);
    if (next !== this.lastCommitted) {
      this.lastCommitted = next;
      this.mdChange.emit(detail);
    }
  }

  private focusField() {
    const f = this.fieldEl;
    if (!f) return;
    if (typeof f.setFocus === 'function') void f.setFocus();
    else f.focus?.();
  }

  /** Snap the visible text back to the last accepted display (garbage paste). */
  private revertFieldText() {
    const field = this.fieldEl;
    if (field && field.value !== this.inputValue) {
      field.value = this.inputValue;
    }
  }

  private requestSubmit() {
    try {
      const form = this.internals?.form;
      // Native implicit submission attributes the submit to the DEFAULT submit
      // button, so its name/value joins the entry list and `event.submitter` is
      // set. It does NOT click that button — requestSubmit() runs the spec's
      // submit steps directly, so a click handler on it never sees this.
      const submitter = form?.querySelector<HTMLElement>(
        'button[type="submit"], input[type="submit"], button:not([type])',
      );
      form?.requestSubmit(
        submitter instanceof HTMLButtonElement || submitter instanceof HTMLInputElement
          ? submitter
          : undefined,
      );
    } catch { /* spec mock */ }
  }

  // ── Press-and-hold ───────────────────────────────────────

  private beginHold(dir: 1 | -1, e: PointerEvent) {
    if (this.isDisabled || this.readOnly) return;
    // Mouse/pen presses keep the typing context in the input; a touch tap must
    // NOT focus it — that would summon the software keyboard over the field
    // the user is only trying to nudge.
    if (e.pointerType !== 'touch') this.focusField();
    this.endHold(); // never double timers
    this.holdDir = dir;
    this.heldAlt = e.altKey === true;
    this.heldShift = e.shiftKey === true;
    this.holdTick(); // first tick immediately on pointerdown
    if (typeof window === 'undefined') return;
    window.addEventListener('pointerup', this.endHold);
    window.addEventListener('pointercancel', this.endHold);
    window.addEventListener('contextmenu', this.endHold);
    // Modifiers are read PER TICK — track them while holding.
    window.addEventListener('keydown', this.trackHoldModifiers);
    window.addEventListener('keyup', this.trackHoldModifiers);
    this.holdTimer = setTimeout(() => {
      this.holdInterval = setInterval(this.holdTick, HOLD_TICK_MS);
    }, HOLD_START_DELAY_MS);
  }

  private trackHoldModifiers = (e: KeyboardEvent) => {
    this.heldAlt = e.altKey;
    this.heldShift = e.shiftKey;
  };

  private holdTick = () => {
    const dir = this.holdDir;
    if (this.atBound(dir)) {
      this.endHold(); // ticking stops at the bound
      return;
    }
    const amount = this.heldShift ? this.largeStep : this.heldAlt ? this.smallStep : this.stepAmount;
    this.doStep(dir, amount, this.heldAlt, dir > 0 ? 'increment-press' : 'decrement-press');
  };

  private endHold = () => {
    clearTimeout(this.holdTimer);
    clearInterval(this.holdInterval);
    this.holdTimer = undefined;
    this.holdInterval = undefined;
    if (typeof window !== 'undefined') {
      window.removeEventListener('pointerup', this.endHold);
      window.removeEventListener('pointercancel', this.endHold);
      window.removeEventListener('contextmenu', this.endHold);
      window.removeEventListener('keydown', this.trackHoldModifiers);
      window.removeEventListener('keyup', this.trackHoldModifiers);
    }
  };

  // ── Input handlers ───────────────────────────────────────

  private handleFieldInput = (e: CustomEvent<string>) => {
    // The inner field's mdInput (string detail) must not leak past the host —
    // this component re-emits its own typed detail.
    e.stopPropagation();
    const raw = e.detail ?? '';
    if (raw.trim() === '') {
      this.inputValue = raw;
      if (this.value !== null) {
        this.internalWrite = true;
        this.value = null;
        this.internalWrite = false;
        this.mdInput.emit({ value: null, formattedValue: raw, reason: 'input-clear' });
      }
      return;
    }
    if (!this.hasOnlyAllowedChars(raw)) {
      // Unparseable candidate (garbage paste): silently revert to the last
      // accepted text and emit nothing — a rejected edit is not a value change.
      this.revertFieldText();
      return;
    }
    // Typed text is kept VERBATIM (no live reformatting); the value updates
    // only when the text parses. Partial states ("-", "1,") just wait.
    this.inputValue = raw;
    const parsed = this.parseNumber(raw);
    if (parsed !== null && parsed !== this.value) {
      this.internalWrite = true;
      this.value = parsed;
      this.internalWrite = false;
      this.mdInput.emit({ value: parsed, formattedValue: raw, reason: 'input-change' });
    }
  };

  private handleFieldChange = (e: CustomEvent<string>) => {
    // Contain the inner field's mdChange — this component's own mdChange is
    // emitted at ITS commit points with a typed detail.
    e.stopPropagation();
  };

  private handleFieldKeyDown = (e: KeyboardEvent) => {
    if (this.isDisabled) return;
    // IME composition passes through untouched.
    if (e.isComposing || e.keyCode === 229) return;
    switch (e.key) {
      case 'ArrowUp':
      case 'ArrowDown': {
        e.preventDefault();
        if (this.readOnly) return;
        const dir: 1 | -1 = e.key === 'ArrowUp' ? 1 : -1;
        const amount = e.shiftKey ? this.largeStep : e.altKey ? this.smallStep : this.stepAmount;
        this.doStep(dir, amount, e.altKey, 'keyboard');
        return;
      }
      case 'Home':
        // Only when a bound is defined — otherwise native caret-to-start.
        if (this.minBound != null && !this.readOnly) {
          e.preventDefault();
          this.setAndCommit(this.minBound, 'keyboard');
        }
        return;
      case 'End':
        if (this.maxBound != null && !this.readOnly) {
          e.preventDefault();
          this.setAndCommit(this.maxBound, 'keyboard');
        }
        return;
      case 'Enter':
        // Enter commits like blur, then native implicit-submission parity
        // (the inner field's own Enter handler has no form in this shadow root).
        this.commitTyped('input-blur');
        this.requestSubmit();
        return;
      default:
        break;
    }
    // Editing/navigation keys and shortcuts pass through.
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key.length !== 1) return;
    if (this.readOnly) return; // the native readonly input blocks typing anyway
    // Character filter: only numerals/separators/signs/symbols of the format.
    if (!this.formatInfo.allowed.has(e.key)) e.preventDefault();
  };

  private handleFieldFocus = () => {
    this.focused = true;
  };

  private handleFieldBlur = () => {
    this.focused = false;
    this.commitTyped('input-blur');
  };

  private handleWheel = (e: WheelEvent) => {
    // Opt-in, and only while the inner input is the focused element.
    if (!this.allowWheelScrub || this.isDisabled || this.readOnly || !this.focused) return;
    if (e.ctrlKey) return; // pinch-zoom gesture — never hijack it
    e.preventDefault();
    const dir: 1 | -1 = e.deltaY > 0 ? -1 : 1;
    const amount = e.shiftKey ? this.largeStep : e.altKey ? this.smallStep : this.stepAmount;
    this.doStep(dir, amount, e.altKey, 'wheel');
  };

  // ── Render ───────────────────────────────────────────────

  private renderStepper(kind: 'increment' | 'decrement') {
    const inline = this.steppers === 'inline';
    const dir: 1 | -1 = kind === 'increment' ? 1 : -1;
    const disabled = this.isDisabled || this.readOnly || this.atBound(dir);
    return (
      <md-icon-button
        key={kind}
        class={{
          'md-number-field__stepper': true,
          [`md-number-field__stepper--${kind}`]: true,
          'md-number-field__stepper--inline': inline,
          'md-number-field__stepper--split': !inline,
        }}
        slot={inline ? 'trailing-icon' : undefined}
        part={kind}
        variant={inline ? 'standard' : 'tonal'}
        icon={kind === 'increment' ? 'add' : 'remove'}
        aria-label={kind === 'increment' ? this.incrementLabel : this.decrementLabel}
        disabled={disabled}
        // The input is the keyboard surface — steppers are pointer-only
        // (tabIndex=-1), so Tab never stops on buttons that only duplicate ↑/↓.
        groupTabindex={-1}
        onMouseDown={(e: MouseEvent) => e.preventDefault()} // keep focus in the input
        onPointerDown={(e: PointerEvent) => this.beginHold(dir, e)}
        onPointerLeave={this.endHold}
        onClick={(e: MouseEvent) => e.stopPropagation()}
        onMdClick={(e: CustomEvent) => e.stopPropagation()}
      ></md-icon-button>
    );
  }

  render() {
    const split = this.steppers === 'split';
    return (
      <Host
        class={{
          'md-number-field': true,
          [`md-number-field--${this.variant}`]: true,
          'md-number-field--disabled': this.isDisabled,
          'md-number-field--split': split,
          'md-number-field--inline': this.steppers === 'inline',
        }}
      >
        {split && this.renderStepper('decrement')}
        <md-text-field
          ref={(el) => (this.fieldEl = el as unknown as FieldElement)}
          class="md-number-field__field"
          part="field"
          variant={this.variant}
          label={this.label}
          placeholder={this.placeholder}
          value={this.inputValue}
          disabled={this.isDisabled}
          readOnly={this.readOnly}
          required={this.required}
          error={this.error}
          errorText={this.errorText}
          supportingText={this.supportingText}
          reserveSupportingSpace={this.reserveSupportingSpace}
          density={this.density}
          // A plain text input with a numeric software keyboard — deliberately
          // NOT type="number" (its spinners and browser-specific parsing fight
          // the Intl display), NOT role="spinbutton" (the formatted value stays
          // ordinary readable, editable text).
          inputMode={this.resolvedInputMode}
          autocomplete="off"
          spellcheck={false}
          onMdInput={this.handleFieldInput}
          onMdChange={this.handleFieldChange}
          onKeyDown={this.handleFieldKeyDown}
          onFocus={this.handleFieldFocus}
          onBlur={this.handleFieldBlur}
        >
          {this.steppers === 'inline' && [
            this.renderStepper('decrement'),
            this.renderStepper('increment'),
          ]}
        </md-text-field>
        {split && this.renderStepper('increment')}
      </Host>
    );
  }
}
