import { getValidityOf } from '../../utils/form';
import { AttachInternals, Build, Component, Element, Event, EventEmitter, Host, Method, Prop, State, Watch, h } from '@stencil/core';

export type MdTimePickerFormat = '12h' | '24h';
export type MdTimePickerMode = 'dial' | 'input';
export type MdTimePickerSelection = 'hour' | 'minute';
export type MdTimePickerPeriod = 'AM' | 'PM';
/**
 * MD3 supports two AM/PM period-selector layouts inside the dial dialog:
 *
 * - `vertical` (default) — 52×80px stack on the trailing side of the
 *   minute tile. Matches the canonical reference dialog.
 * - `horizontal` — 216×38px segmented button placed below the
 *   HH:MM display. Useful in compact layouts where the inline gutter
 *   cannot fit the vertical toggle.
 */
export type MdTimePickerPeriodLayout = 'vertical' | 'horizontal';

/**
 * MD3 supports two **dialog** orientations for the dial variant:
 *
 * - `vertical` (default, portrait) — headline / HH:MM / dial / actions
 *   stacked top-to-bottom inside a ~328px-wide dialog. Optimal for
 *   phone-portrait screens.
 * - `horizontal` (landscape) — two-column body with HH:MM + AM/PM in
 *   the left column and the 256px dial in the right column, inside a
 *   wider (~572px / 608px for 24h) dialog. Matches the canonical M3
 *   "Time picker dial - horizontal" spec sheet. Always uses the
 *   216×38px horizontal AM/PM pill — the 52×80px vertical pill does
 *   not fit the landscape layout.
 *
 * `orientation` has no effect when `variant="input"` (the input
 * dialog is always vertical / 328px wide).
 */
export type MdTimePickerOrientation = 'vertical' | 'horizontal';

export interface MdTimePickerChangeDetail {
  /**
   * Canonical value as a 24-hour `HH:MM` string (e.g. `"14:30"`).
   * Always zero-padded. Matches the `value` prop format so the
   * detail can be round-tripped back into another picker without
   * any transformation.
   */
  value: string;
  /**
   * ISO 8601 extended local-time string (`HH:MM:SS`), e.g.
   * `"14:30:00"`. Seconds are always `"00"` because the picker
   * tops out at minute precision.
   *
   * This is the format used by:
   *   • HTML `<input type="time" step="1">` (when step ≤ 60 the
   *     browser exposes the value with the seconds component);
   *   • the W3C HTML Living Standard's "time" microsyntax;
   *   • REST API "time-only" column types (Postgres `time`,
   *     MySQL `TIME`, OpenAPI `format: "time"`).
   */
  iso: string;
  /**
   * Full ISO 8601 / RFC 3339 datetime string anchored to *today's*
   * calendar date in UTC, e.g. `"2026-05-21T14:30:00.000Z"`.
   * Equivalent to `date.toISOString()`.
   *
   * Use this when posting to an API that expects a JSON
   * datetime (the vast majority of REST / GraphQL backends).
   * The selected hours/minutes are interpreted in the user's
   * **local** timezone and then serialized to UTC, so a user
   * picking `15:00` in CET sees `"…T14:00:00.000Z"`.
   */
  isoDateTime: string;
  /**
   * JavaScript `Date` object — today's calendar date with the
   * picked hours and minutes; seconds and milliseconds are
   * zeroed. The local timezone offset is preserved by the
   * `Date` itself; serialize with `.toISOString()` for UTC or
   * `.toLocaleTimeString()` for the user's locale.
   */
  date: Date;
  /** Hours in 24-hour clock (0–23). */
  hours: number;
  /** Minutes (0–59). */
  minutes: number;
  /** Day period derived from `hours` (always defined). */
  period: MdTimePickerPeriod;
}

/**
 * Payload emitted by the `mdModeChange` event when the user
 * toggles between the dial and input variants from inside the
 * open dialog.
 */
export interface MdTimePickerModeChangeDetail {
  /** Active mode after the toggle. */
  mode: MdTimePickerMode;
  /** Mode the picker was in before the toggle. */
  previousMode: MdTimePickerMode;
}

/**
 * `md-time-picker` — Material Design 3 time picker.
 *
 * Spec: https://m3.material.io/components/time-pickers/specs
 *
 * Implements both MD3 dialog variants:
 *   1. **Dial** — a clock face the user drags or taps to pick hour & minute.
 *   2. **Input** — two text fields (HH / MM) plus optional AM/PM toggle.
 *
 * Users can switch between modes inside the open dialog via the toggle icon
 * (mirrors the official MD3 reference implementation). Both 12-hour and
 * 24-hour clocks are supported; the canonical `value` is always 24-hour
 * `HH:MM` for round-trip safety.
 */
/* Module-level registry of open pickers (push order = open order).
   Drives: topmost-only Escape/Tab handling when several pickers are
   open simultaneously (capture listeners on the same document node all
   fire — stopPropagation cannot silence same-node siblings), and a
   refcounted body scroll lock so closing/disconnecting one picker never
   unlocks scrolling underneath another that is still open. */
const openPickerStack: MdTimePicker[] = [];
let bodyOverflowBeforeLock = '';
/* Monotonic open counter. Keyboard ownership (Escape / Tab trap) belongs
   to the LAST-OPENED picker, which is NOT the same as the tail of
   openPickerStack: a reparent (disconnect → reconnect) of a lower picker
   re-pushes it to the tail, so array position is unreliable. Each picker
   stamps openSeq when it actually opens (not on a reparent re-arm), and
   the topmost owner is the open picker with the greatest openSeq. */
let openSeqCounter = 0;  

@Component({
  tag: 'md-time-picker',
  styleUrl: 'md-time-picker.css',
  shadow: true,
  formAssociated: true,
})
export class MdTimePicker {
  @Element() el!: HTMLElement;

  @AttachInternals() internals!: ElementInternals;

  // ───────────────────────────── PUBLIC API ─────────────────────────────

  /** Picker mode shown when the dialog first opens. Defaults to `input` (keyboard-first); users can toggle to `dial` from the footer icon. */
  @Prop() variant: MdTimePickerMode = 'input';

  /** 12-hour (with AM/PM) or 24-hour clock. */
  @Prop() format: MdTimePickerFormat = '12h';

  /** Selected time as a 24-hour `HH:MM` string (e.g. `"14:30"`). */
  @Prop({ mutable: true, reflect: true }) value: string = '';

  /** Form field name — the picker is form-associated and submits its `value` under this name in `FormData`, like a native `<input type="time">`. */
  @Prop({ reflect: true }) name: string = '';

  /** Earliest selectable time as a 24-hour `HH:MM` string. A committed value before it fails constraint validation with `rangeUnderflow`. */
  @Prop() min: string = '';

  /** Latest selectable time as a 24-hour `HH:MM` string. A committed value after it fails constraint validation with `rangeOverflow`. */
  @Prop() max: string = '';

  /** Requires a committed value for the host form to validate (`valueMissing` otherwise). */
  @Prop({ reflect: true }) required: boolean = false;

  /** Trigger field label (acts as the floating label of the text-field-shaped trigger). */
  @Prop() label: string = 'Select time';

  /*
   * Supporting text and error state — the same four props `md-date-picker`
   * carries, for the same reason.
   *
   * The two are a matched pair and get used side by side in a form. Without
   * these, only one of them could hold its own validation message: a date could
   * paint itself red and say why, while a time had to be told off by a
   * paragraph the app rendered underneath it. That paragraph sits outside the
   * component, so it has no supporting-text line to reserve either, and every
   * appearance of it shoved the rest of the form down. The trigger below is
   * already a real `md-text-field`, which does all of this properly — so this
   * is plumbing, not new behaviour.
   */

  /** Helper text shown below the trigger. Hidden while an error is displayed. */
  @Prop({ attribute: 'supporting-text' }) supportingText: string = '';

  /** Error state — paints the trigger with the error colour and shows `error-text`. */
  @Prop({ mutable: true, reflect: true }) error: boolean = false;

  /** Error message shown below the trigger when `error` is true. */
  @Prop({ mutable: true, attribute: 'error-text' }) errorText: string = '';

  /**
   * Always occupy the supporting-text line, even when there is no message, so a
   * validation error does not push the content below it down. Forwarded to the
   * embedded md-text-field. See that component for why it is opt-in.
   */
  @Prop({ attribute: 'reserve-supporting-space' }) reserveSupportingSpace: boolean = false;

  /** Headline copy shown above the dial / inputs. Overrides the
   *  mode-specific defaults (`headline-input-label` / `headline-dial-label`)
   *  when set. */
  @Prop() headline: string = '';

  /** Localized default headline for the input variant (used when `headline` is empty). */
  @Prop({ attribute: 'headline-input-label' }) headlineInputLabel: string = 'Enter time';

  /** Localized default headline for the dial variant (used when `headline` is empty). */
  @Prop({ attribute: 'headline-dial-label' }) headlineDialLabel: string = 'Select time';

  /** Localized constraint-validation message when `required` and no time is committed. */
  @Prop({ attribute: 'value-missing-label' }) valueMissingLabel: string = 'Please select a time.';

  /** Localized validation message when the committed time is before `min`. `{min}` is substituted. */
  @Prop({ attribute: 'range-underflow-label' }) rangeUnderflowLabel: string = 'Please select a time at or after {min}.';

  /** Localized validation message when the committed time is after `max`. `{max}` is substituted. */
  @Prop({ attribute: 'range-overflow-label' }) rangeOverflowLabel: string = 'Please select a time at or before {max}.';

  /** Localized validation message for a reversed (overnight) `min`/`max` window when the time falls in the excluded middle. `{min}` and `{max}` are substituted. */
  @Prop({ attribute: 'range-outside-label' }) rangeOutsideLabel: string = 'Please select a time at or after {min} or at or before {max}.';

  /** Disables the trigger and prevents the dialog from opening. */
  @Prop({ reflect: true }) disabled: boolean = false;

  /** Whether the picker dialog is open. Two-way bindable / reflected. */
  @Prop({ mutable: true, reflect: true }) open: boolean = false;

  /** Minute snap increment on the dial (1, 5, 10, 15, 30…). Inputs always accept 1-minute granularity. */
  @Prop({ attribute: 'minute-step' }) minuteStep: number = 1;

  /** Localized label for the Cancel action. */
  @Prop({ attribute: 'cancel-label' }) cancelLabel: string = 'Cancel';

  /** Localized label for the confirm action. */
  @Prop({ attribute: 'ok-label' }) okLabel: string = 'OK';

  /** When true the built-in field trigger is not rendered; open the dialog programmatically via `.show()`. */
  @Prop({ attribute: 'hide-trigger', reflect: true }) hideTrigger: boolean = false;

  /** Localized AM label (12-hour mode). */
  @Prop({ attribute: 'am-label' }) amLabel: string = 'AM';

  /** Localized PM label (12-hour mode). */
  @Prop({ attribute: 'pm-label' }) pmLabel: string = 'PM';

  /**
   * Localized accessible label for the Hour input field. Matches the
   * [MD3 Time picker accessibility spec](https://m3.material.io/components/time-pickers/accessibility)
   * which mandates an "Hour" label on the hour text input.
   */
  @Prop({ attribute: 'hour-label' }) hourLabel: string = 'Hour';

  /**
   * Localized accessible label for the Minute input field. Matches the
   * [MD3 Time picker accessibility spec](https://m3.material.io/components/time-pickers/accessibility)
   * which mandates a "Minute" label on the minute text input.
   */
  @Prop({ attribute: 'minute-label' }) minuteLabel: string = 'Minute';

  /**
   * Localized accessible label for the mode-toggle icon button when the
   * picker is currently in the *input* variant (clock icon shown — click
   * to switch to the dial). Matches the MD3 accessibility spec entry
   * "Clock button → Toggle dial picker".
   */
  @Prop({ attribute: 'toggle-dial-label' }) toggleDialLabel: string = 'Toggle dial picker';

  /**
   * Localized accessible label for the mode-toggle icon button when the
   * picker is currently in the *dial* variant (keyboard icon shown —
   * click to switch back to the input). Symmetric extension of the MD3
   * "Toggle dial picker" naming pattern, since the spec only documents
   * the input-mode label explicitly.
   */
  @Prop({ attribute: 'toggle-input-label' }) toggleInputLabel: string = 'Toggle keyboard input';

  /**
   * Localized accessible label for the AM/PM radio group container.
   * Wraps the two radio children; individual radio names come from
   * `am-label` / `pm-label`.
   */
  @Prop({ attribute: 'period-label' }) periodLabel: string = 'Period';

  /**
   * Layout for the AM/PM period selector. Has no effect when
   * `format="24h"` (the toggle is not rendered).
   *
   * - `vertical` — 52×72px stack next to the minute tile (default).
   * - `horizontal` — 216×38px segmented button below HH:MM.
   */
  @Prop({ attribute: 'period-layout' }) periodLayout: MdTimePickerPeriodLayout = 'vertical';

  /**
   * Dialog orientation for the dial variant.
   *
   * - `vertical` (default) — single-column portrait layout (~328px wide).
   * - `horizontal` — two-column landscape layout (~572px wide in both
   *   12h and 24h modes since the HH/MM input tiles are 96px in either
   *   format). Forces the AM/PM pill into the 216×38px horizontal
   *   variant since the 52×72px vertical pill cannot share the left
   *   column cleanly. Has no effect when `variant="input"`.
   */
  @Prop({ attribute: 'orientation' }) orientation: MdTimePickerOrientation = 'vertical';

  /**
   * Adaptive layout policy. Per the MD3 spec the picker should swap
   * orientation or variant based on the viewport so the dial never
   * has to scroll. When `responsive` is enabled the dialog
   * automatically:
   *
   *   • Falls back to `variant="input"` when the viewport height is
   *     too short to fit the 256px dial (default threshold: 460px),
   *     matching the spec line "Time pickers can fallback to the
   *     input time picker when there isn't enough vertical real
   *     estate to present the landscape orientation without
   *     scrolling".
   *   • Promotes the dial variant to `orientation="horizontal"`
   *     when the viewport is wide enough for the 572/608px landscape
   *     dialog (default threshold: width ≥ 720px AND width > height),
   *     matching "the time picker can change to landscape orientation
   *     on larger breakpoints or when viewport height is limited".
   *
   * The `variant` / `orientation` props remain the *preference*
   * the picker tries to honor — adaptive overrides only kick in
   * when the viewport literally cannot fit them. Default `false`
   * for backward compatibility; flip to `true` on new integrations
   * to get the canonical MD3 adaptive layout.
   */
  @Prop({ attribute: 'responsive' }) responsive: boolean = false;

  /**
   * Local density rung. Drives the same `--md-sys-density-scale` signal that a
   * global `data-density` ancestor sets, so a local value simply overrides the
   * inherited one. 0 = default, -4 = ultra-compact.
   */
  @Prop({ reflect: true }) density: 0 | -1 | -2 | -3 | -4 = 0;

  // ───────────────────────────── EVENTS ─────────────────────────────

  /**
   * Emitted when the user confirms the chosen time (OK button, or
   * Enter inside the HH/MM fields while the buffers are valid).
   * This is the canonical "the user has committed a value" event —
   * use it for form integration, persistence, and analytics.
   *
   * The detail bundle includes both the human-friendly `value` and
   * three industry-standard ISO / Date representations so
   * downstream code never has to re-format the time itself.
   */
  @Event() mdChange: EventEmitter<MdTimePickerChangeDetail>;

  /**
   * Emitted on every intermediate change while the dialog is
   * open — dial drag, dial-mode keyboard typing, AM/PM toggle,
   * and input-variant keystrokes that produce a valid HH:MM.
   *
   * Mirrors the HTML `input` event semantics ("fires for every
   * user-driven mutation") and matches the pattern used by
   * `md-date-picker` / `md-text-field`. Use `mdInput` for live
   * previews and `mdChange` for the final commit. The detail
   * shape is identical to `mdChange` so a previewer can read the
   * same fields regardless of which event arrived.
   */
  @Event() mdInput: EventEmitter<MdTimePickerChangeDetail>;

  /** Emitted when the picker opens. */
  @Event() mdOpen: EventEmitter<void>;

  /** Emitted when the picker closes (whether confirmed, cancelled, or dismissed). */
  @Event() mdClose: EventEmitter<void>;

  /** Emitted when the picker is cancelled or dismissed without committing. */
  @Event() mdCancel: EventEmitter<void>;

  /**
   * Emitted when the user switches between the dial and input
   * variants via the dialog's keyboard / clock toggle. Lets
   * analytics or sibling UI react to the variant change (e.g.
   * announce the new mode to screen readers, or resize a hosting
   * dialog wrapper).
   */
  @Event() mdModeChange: EventEmitter<MdTimePickerModeChangeDetail>;

  // ───────────────────────────── INTERNAL STATE ─────────────────────────────

  @State() private isOpen: boolean = false;
  @State() private mode: MdTimePickerMode = 'dial';
  @State() private selecting: MdTimePickerSelection = 'hour';
  @State() private draftHours: number = 12;
  @State() private draftMinutes: number = 0;
  @State() private hourInputValue: string = '';
  @State() private minuteInputValue: string = '';
  @State() private hourInputError: boolean = false;
  @State() private minuteInputError: boolean = false;
  /* Live viewport dimensions, sampled while the dialog is open so
     the adaptive `responsive` policy can flip variant / orientation
     in response to a window resize, an orientationchange event, or
     a foldable device unfolding. Only updated when `responsive` is
     enabled to avoid paying the listener cost in the static case.
     Initial value of 0/0 reads as "no measurement yet" and is
     interpreted as "respect the props verbatim" by the getters. */
  @State() private viewportWidth: number = 0;
  @State() private viewportHeight: number = 0;
  /* Mirrors the `disabled` state a wrapping `<fieldset disabled>` imposes
     via the form-associated `formDisabledCallback` — merged with the
     `disabled` prop through `isDisabled` so both channels behave alike. */
  @State() private formDisabled: boolean = false;

  private committedHours: number = 12;
  private committedMinutes: number = 0;
  private committedValue: string = '';
  /* The canonical initial `value` captured at load, restored on form
     reset — native `<input type="time">` reset returns to the initial
     attribute value, not to empty. */
  private defaultValue: string = '';
  private isDragging: boolean = false;
  private dialEl?: HTMLDivElement;
  private hourInputEl?: HTMLInputElement;
  private minuteInputEl?: HTMLInputElement;
  private hourInputSeeded: boolean = false;
  private minuteInputSeeded: boolean = false;
  private previousFocus: HTMLElement | null = null;
  /* Open-sequence stamp (see openSeqCounter). 0 = never opened; set when
     this picker opens, preserved across reparents so keyboard ownership
     tracks open-order rather than DOM/stack position. */
  private openSeq = 0;
  private triggerFieldEl?: HTMLMdTextFieldElement;
  private uid = Math.random().toString(36).slice(2, 11);
  private headlineId = `md-time-picker-headline-${this.uid}`;
  /* Cumulative (unwrapped) rotation, per dial mode, in degrees.
     CSS `transition: transform` interpolates between literal angle
     values — `rotate(354deg) → rotate(0deg)` therefore unwinds the
     hand backward by -354° instead of advancing forward +6°. We
     track the running angle so each render hands CSS the shortest
     signed delta from the previous frame, keeping minute 59 → 00 (or
     hour 23 → 00 in 24h mode) animating in the natural direction. */
  private hourCumulativeAngle: number = 0;
  private minuteCumulativeAngle: number = 0;
  /* Which dial mode owned the cumulative angles last paint. When the
     mode flips (hour ↔ minute) or the picker opens fresh, we re-seed
     to avoid spinning the hand from a stale unwrapped value. */
  private lastHandMode: MdTimePickerSelection | null = null;
  private docKeyHandler?: (e: KeyboardEvent) => void;
  /* Window resize / orientationchange listener for the adaptive
     `responsive` policy. Only attached while the dialog is open
     AND `responsive === true` — keeps idle pickers off the global
     event loop. */
  private viewportResizeHandler?: () => void;
  // ───────────────────────────── LIFECYCLE ─────────────────────────────

  componentWillLoad() {
    if (!this.parseValueInto(this.value)) {
      if (Build.isDev) {
        console.warn(
          `[md-time-picker] invalid value "${this.value}" — expected a 24-hour "HH:MM" string. Treating as empty.`,
        );
      }
      this.value = '';
    } else if (this.value) {
      // Canonicalize accepted-but-unpadded input ("9:05" → "09:05") so
      // FormData and the reflected attribute never flip format later.
      this.value = this.toIso(this.draftHours, this.draftMinutes);
    }
    this.committedHours = this.draftHours;
    this.committedMinutes = this.draftMinutes;
    this.committedValue = this.value;
    // Capture the canonical initial value for form reset (native parity).
    this.defaultValue = this.value;
    this.hourInputValue = String(this.computeDisplayHour(this.draftHours));
    this.minuteInputValue = String(this.draftMinutes).padStart(2, '0');
    // Sample the viewport BEFORE deriving the initial mode so the
    // adaptive `responsive` policy can already apply the
    // input-fallback during first paint (avoids a hydration flash
    // where the dial briefly renders against a tiny viewport).
    if (this.responsive) this.sampleViewport();
    this.mode = this.effectiveVariant;
    // Don't boot into an open dialog on a disabled picker (mirrors the
    // openPicker isDisabled guard). formDisabled is always false at load.
    if (this.open && !this.disabled) {
      this.isOpen = true;
      this.selecting = 'hour';
    } else if (this.open && this.disabled) {
      this.open = false;
    }
    this.updateFormValue();
  }

  componentDidLoad() {
    // Re-assert validity now that renderTrigger's ref bound
    // triggerFieldEl — the willLoad pass ran without an anchor, and an
    // un-anchored valueMissing means the first form submit would show
    // no validation UI.
    this.updateValidity();
    if (this.isOpen) {
      this.openSeq = ++openSeqCounter;
      this.previousFocus = MdTimePicker.deepActiveElement();
      this.attachOpenEnvironment();
      this.mdOpen.emit();
      requestAnimationFrame(() => this.focusInitial());
    }
  }

  connectedCallback() {
    // Stencil fires disconnected/connected on a DOM *move* (reparent).
    // disconnectedCallback tears the open-dialog environment down, so an
    // open picker that gets reparented must re-arm Escape handling, the
    // scroll lock, and the adaptive resize listener here — otherwise the
    // dialog stays visible but Escape and the focus trap are dead.
    if (this.isOpen) this.attachOpenEnvironment();
  }

  disconnectedCallback() {
    this.detachOpenEnvironment();
  }

  // ─────────────────────── FORM-ASSOCIATED CALLBACKS ───────────────────────

  formResetCallback() {
    // Native `<input type="time">` reset restores the initial attribute
    // value, not empty. The @Watch('value') pass handles re-parsing/
    // committing when the value actually changed; when it was already at
    // the default nothing fires, so re-assert form value + validity here.
    this.value = this.defaultValue;
    this.updateFormValue();
  }

  formDisabledCallback(disabled: boolean) {
    this.formDisabled = disabled;
    if (disabled && this.isOpen) this.cancel();
  }

  formStateRestoreCallback(state: string | File | FormData | null) {
    if (typeof state === 'string') this.value = state;
  }

  // ───────────────────────────── WATCHERS ─────────────────────────────

  @Watch('variant')
  handleVariantChange(v: MdTimePickerMode) {
    if (!this.isOpen) this.mode = v;
  }

  @Watch('value')
  handleValueChange(v: string) {
    // 1. NORMALIZE into the draft and compute the canonical string:
    //      empty            → '' (draft seeds to the noon default)
    //      valid "HH:MM"    → zero-padded canonical (parses into draft)
    //      malformed/range  → '' + dev warn (draft reset to the default)
    let normalized: string;
    if (v === '') {
      this.parseValueInto('');
      normalized = '';
    } else if (this.parseValueInto(v)) {
      normalized = this.toIso(this.draftHours, this.draftMinutes);
    } else {
      if (Build.isDev) {
        console.warn(
          `[md-time-picker] invalid value "${v}" — expected a 24-hour "HH:MM" string. Treating as empty.`,
        );
      }
      this.parseValueInto('');
      normalized = '';
    }
    // 2. Round-trip a non-canonical / rejected input through the prop so
    //    the reflected attribute + FormData always carry the canonical
    //    form. Re-assigning re-fires this watch with normalized === v,
    //    which falls through to the commit below (bounded — one bounce).
    if (normalized !== v) {
      this.value = normalized;
      return;
    }
    // 3. Commit. We deliberately do NOT early-return when v equals the
    //    prior committedValue: an open dialog whose draft/tiles the user
    //    moved (dial drag) must still resync to an external set that
    //    canonically equals the committed value ("9:05" while committed
    //    "09:05") — the previous early-return stranded the tiles/dial.
    this.committedHours = this.draftHours;
    this.committedMinutes = this.draftMinutes;
    this.committedValue = v;
    if (this.isOpen) {
      this.syncInputsFromDraft();
      this.lastInputEmitKey = this.draftHours * 60 + this.draftMinutes;
    } else {
      this.hourInputValue = String(this.computeDisplayHour(this.draftHours));
      this.minuteInputValue = String(this.draftMinutes).padStart(2, '0');
    }
    this.updateFormValue();
  }

  @Watch('min')
  @Watch('max')
  @Watch('required')
  @Watch('valueMissingLabel')
  @Watch('rangeUnderflowLabel')
  @Watch('rangeOverflowLabel')
  @Watch('rangeOutsideLabel')
  handleConstraintChange() {
    this.updateValidity();
  }

  @Watch('disabled')
  handleDisabledChange(v: boolean) {
    // Disabling an open picker at runtime must close it — symmetric with
    // formDisabledCallback and the "both channels behave alike" contract.
    // (isDisabled already gates opening, the dial, and the trigger.)
    if (v && this.isOpen) this.cancel();
  }

  @Watch('responsive')
  handleResponsiveChange(v: boolean) {
    if (!this.isOpen) return;
    if (v) {
      this.sampleViewport();
      this.attachViewportListener();
      // Enabling responsive mid-session must apply the adaptive policy
      // immediately, not only on the NEXT resize: a dial open on a short
      // viewport falls back to input right away.
      if (
        this.mode === 'dial' &&
        this.viewportHeight > 0 &&
        this.viewportHeight < MdTimePicker.ADAPTIVE_MIN_DIAL_HEIGHT
      ) {
        this.mode = 'input';
      }
    } else {
      // Disabling responsive stops the adaptive policy from applying to
      // FUTURE resizes; we deliberately do NOT flip the current mode.
      // `mode==='input'` is indistinguishable between an adaptive
      // short-viewport fallback and a user's deliberate keyboard toggle
      // (toggleMode sets mode without touching variant), and the
      // component's own rule is that flipping a user OUT of input mid-
      // session is hostile (see the resize handler). Leaving mode as-is
      // preserves a user choice; the user can toggle to the dial via the
      // footer icon if they want it.
      this.detachViewportListener();
    }
  }

  @Watch('open')
  handleOpenPropChange(v: boolean) {
    if (v && !this.isOpen) {
      this.openPicker();
    } else if (!v && this.isOpen) {
      this.closePicker();
    }
  }

  // ───────────────────────────── PUBLIC METHODS ─────────────────────────────

  /** Programmatically open the picker dialog. */
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

  @Method()
  async show(): Promise<void> {
    this.openPicker();
  }

  /** Programmatically close the picker dialog (treated as Cancel). */
  @Method()
  async hide(): Promise<void> {
    this.cancel();
  }

  /** Constraint-validation parity with native form controls: true when
   *  the committed value satisfies `required` / `min` / `max`. */
  @Method()
  async checkValidity(): Promise<boolean> {
    if (typeof this.internals?.checkValidity !== 'function') return true;
    return this.internals.checkValidity();
  }

  /** Like `checkValidity()` but also surfaces the browser's validation
   *  UI anchored on the trigger field (matches md-text-field). */
  @Method()
  async reportValidity(): Promise<boolean> {
    if (typeof this.internals?.reportValidity !== 'function') return true;
    return this.internals.reportValidity();
  }

  /** Snapshot of the host's ValidityState + message (ElementInternals). */
  @Method()
  async getValidity(): Promise<{ valid: boolean; validationMessage: string } & Partial<ValidityState>> {
    const v = this.internals?.validity;
    if (!v) return { valid: true, validationMessage: '' };
    return {
      valid: v.valid,
      valueMissing: v.valueMissing,
      rangeUnderflow: v.rangeUnderflow,
      rangeOverflow: v.rangeOverflow,
      validationMessage: this.internals.validationMessage,
    };
  }

  // ───────────────────────────── VALUE HELPERS ─────────────────────────────

  /** Parse a `HH:MM` string into the draft. Returns false (leaving the
   *  draft untouched) when the string is present but malformed / out of
   *  range — callers decide how to surface the rejection (dev warn +
   *  reset to empty). An empty string is valid and seeds the draft to
   *  the documented empty-state default of 12:00 PM (noon). */
  private parseValueInto(v: string): boolean {
    if (!v) {
      this.draftHours = 12;
      this.draftMinutes = 0;
      return true;
    }
    const m = /^(\d{1,2}):(\d{2})$/.exec(v);
    if (!m) return false;
    const h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    if (h < 0 || h > 23 || min < 0 || min > 59) return false;
    this.draftHours = h;
    this.draftMinutes = min;
    return true;
  }

  /** Effective disabled state: the `disabled` prop OR the form-imposed
   *  disabled state from a wrapping `<fieldset disabled>`. */
  private get isDisabled(): boolean {
    return this.disabled || this.formDisabled;
  }

  /** `HH:MM` → minutes-since-midnight, or null when absent/malformed.
   *  Used by the min/max constraint validation. */
  private parseHHMM(v: string): number | null {
    const m = /^(\d{1,2}):(\d{2})$/.exec(v || '');
    if (!m) return null;
    const h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    if (h > 23 || min > 59) return null;
    return h * 60 + min;
  }

  private toIso(h: number, m: number): string {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  /* Cache of the last `(hours, minutes)` pair we emitted on
     `mdInput` so a single user gesture (drag, keyboard repeat,
     IME composition) doesn't fire the same payload twice in a
     row. Reset on open / close. The comparison key is a packed
     int (`h * 60 + m`) for cheap equality. */
  private lastInputEmitKey: number = -1;

  /** Emit `mdInput` for the current draft H/M if (and only if)
   *  the draft moved since the previous emit. Cheap to over-call
   *  — pointer-move handlers, dial-typing commits, AM/PM toggles
   *  and input keystrokes all funnel through this. */
  private emitInputIfChanged() {
    if (!this.isOpen) return;
    const key = this.draftHours * 60 + this.draftMinutes;
    if (key === this.lastInputEmitKey) return;
    this.lastInputEmitKey = key;
    this.mdInput.emit(this.buildChangeDetail(this.draftHours, this.draftMinutes));
  }

  /** Build the full event detail bundle for `mdChange` / `mdInput`.
   *
   *  We compute every representation up-front so listeners never
   *  need to re-format the time themselves. The cost is trivial
   *  (a single `Date` allocation + three `String.prototype.padStart`
   *  calls) and we already touch all of these formats internally,
   *  so centralizing the build keeps the canonical mapping in one
   *  place.
   *
   *  Format choices follow the relevant industry standards:
   *    • `value`       — `HH:MM`        → matches the `value` prop & HTML `<input type="time">`
   *    • `iso`         — `HH:MM:SS`     → ISO 8601 partial-time, extended (W3C, OpenAPI `format: time`)
   *    • `isoDateTime` — full RFC 3339  → JSON-safe datetime for REST/GraphQL backends
   *    • `date`        — `Date` instance → ergonomic for in-process JS code
   */
  private buildChangeDetail(h: number, m: number): MdTimePickerChangeDetail {
    const value = this.toIso(h, m);
    const iso = `${value}:00`;
    // Anchor to today's calendar date so the `Date` is a real point
    // in time the backend can persist. We zero seconds and ms to
    // match the picker's actual precision; serializing a Date with
    // junk seconds would mislead anyone diffing two emitted values.
    const date = new Date();
    date.setHours(h, m, 0, 0);
    return {
      value,
      iso,
      isoDateTime: date.toISOString(),
      date,
      hours: h,
      minutes: m,
      period: h >= 12 ? 'PM' : 'AM',
    };
  }

  private get period(): MdTimePickerPeriod {
    return this.draftHours >= 12 ? 'PM' : 'AM';
  }

  private computeDisplayHour(h24: number): number {
    if (this.format === '24h') return h24;
    if (h24 === 0) return 12;
    if (h24 > 12) return h24 - 12;
    return h24;
  }

  private get displayHour(): number {
    return this.computeDisplayHour(this.draftHours);
  }

  private setHour24FromDisplay(displayH: number, period: MdTimePickerPeriod) {
    let h: number;
    if (this.format === '24h') {
      h = ((displayH % 24) + 24) % 24;
    } else {
      const normalized = displayH === 0 ? 12 : displayH;
      if (normalized === 12) h = period === 'AM' ? 0 : 12;
      else h = period === 'AM' ? normalized : normalized + 12;
    }
    this.draftHours = h;
  }

  private formatDisplayTime(h: number, m: number): string {
    if (this.format === '24h') {
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
    const period = h >= 12 ? this.pmLabel : this.amLabel;
    const dh = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${dh}:${String(m).padStart(2, '0')} ${period}`;
  }

  // ───────────────────────────── OPEN / CLOSE ─────────────────────────────

  private openPicker = () => {
    if (this.isDisabled || this.isOpen) return;
    // Deep (composed-tree) capture: `document.activeElement` alone stops
    // at the outermost shadow host — often this very picker — which made
    // the close-time restore land on <body>. Walking shadowRoot
    // .activeElement down to the real focused node lets closePicker put
    // focus back exactly where the user left it.
    this.previousFocus = MdTimePicker.deepActiveElement();
    // Take an initial viewport sample BEFORE picking the open mode
    // so `effectiveVariant` already has the data it needs to apply
    // the adaptive fallback (input on short viewports).
    this.sampleViewport();
    this.attachOpenEnvironment();
    this.draftHours = this.committedHours;
    this.draftMinutes = this.committedMinutes;
    // Seed the input-event de-dupe key with the *current* draft so
    // the first user-driven movement away from the seed fires
    // `mdInput`, but reopening the picker on an unchanged time
    // doesn't fire a spurious "input" event before any interaction.
    this.lastInputEmitKey = this.draftHours * 60 + this.draftMinutes;
    this.selecting = 'hour';
    // `effectiveVariant` collapses to `this.variant` when `responsive`
    // is false, so this stays a no-op for non-adaptive integrations.
    this.mode = this.effectiveVariant;
    this.hourInputValue = String(this.displayHour);
    this.minuteInputValue = String(this.draftMinutes).padStart(2, '0');
    this.hourInputError = false;
    this.minuteInputError = false;
    this.hourInputSeeded = false;
    this.minuteInputSeeded = false;
    /* Fresh dial — drop the cumulative rotation so the first render
       snaps to the seeded value without animating in from whatever
       angle the previous session ended on. The actual seed happens
       inside renderDial() when it detects `lastHandMode === null`. */
    this.hourCumulativeAngle = 0;
    this.minuteCumulativeAngle = 0;
    this.lastHandMode = null;
    this.openSeq = ++openSeqCounter;
    this.isOpen = true;
    this.open = true;
    this.mdOpen.emit();
    requestAnimationFrame(() => this.focusInitial());
  };

  private focusInitial() {
    const root = this.el.shadowRoot;
    if (!root) return;
    // Both variants share the typeable HH:MM input row, so the
    // initial focus target is identical in either mode — the HH input.
    this.syncInputFields();
    this.focusInputSelectingAll(this.hourInputEl);
  }

  /** Focus an input with its full contents selected so the next
   *  keystroke REPLACES the seeded value. The seeded buffer is always
   *  already at `maxLength` (e.g. "12"), so a caret parked at the end
   *  silently swallows the first keystroke — the single worst failure
   *  mode for a keyboard user ("typed 9:30, got 12:30"). Select-all is
   *  also what native `<input type="time">` segments do on focus. */
  private focusInputSelectingAll(el: HTMLInputElement | undefined | null) {
    if (!el) return;
    el.focus();
    this.selectInputContents(el);
  }

  private closePicker = () => {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.open = false;
    this.detachOpenEnvironment();
    this.mdClose.emit();
    this.restoreFocusAfterClose();
  };

  /** Everything the open dialog needs from the document/window scope:
   *  scroll lock, the capture-phase Escape + Tab-trap key handler, and
   *  the adaptive viewport listener. Idempotent — safe to call from
   *  openPicker, the boot-open path, and connectedCallback (reparent). */
  private attachOpenEnvironment() {
    if (typeof document === 'undefined' || this.docKeyHandler) return;
    if (!openPickerStack.includes(this)) openPickerStack.push(this);
    if (document.body) {
      // Save the pre-lock overflow only when taking the FIRST lock so a
      // stack of pickers restores the page's own value, not 'hidden'.
      if (openPickerStack.length === 1) {
        bodyOverflowBeforeLock = document.body.style.overflow;
      }
      document.body.style.overflow = 'hidden';
    }
    this.docKeyHandler = (ev: KeyboardEvent) => {
      if (!this.isOpen) return;
      // Only the LAST-OPENED picker owns the keyboard: every stacked
      // picker's capture listener fires on the same keydown, so without
      // this gate one Escape closed every dialog and the dueling Tab
      // traps pinned focus into the wrong dialog. Ownership follows the
      // greatest openSeq — NOT the stack tail, which a reparent's
      // detach/re-push would otherwise hand to a background picker.
      if (!MdTimePicker.isTopmostOpen(this)) return;
      if (ev.key === 'Escape') {
        ev.preventDefault();
        ev.stopImmediatePropagation();
        this.cancel();
      } else if (ev.key === 'Tab') {
        this.trapFocus(ev);
      }
    };
    document.addEventListener('keydown', this.docKeyHandler, true);
    this.attachViewportListener();
  }

  private detachOpenEnvironment() {
    if (typeof document !== 'undefined' && this.docKeyHandler) {
      document.removeEventListener('keydown', this.docKeyHandler, true);
      this.docKeyHandler = undefined;
      const idx = openPickerStack.indexOf(this);
      if (idx !== -1) openPickerStack.splice(idx, 1);
      // Release the shared scroll lock only when the LAST open picker
      // leaves; a closed/never-opened picker (disconnectedCallback on a
      // closed instance) must not touch the lock it never took.
      if (document.body && openPickerStack.length === 0) {
        document.body.style.overflow = bodyOverflowBeforeLock;
      }
    }
    this.detachViewportListener();
  }

  /** True when `picker` is the last-opened member of the open stack
   *  (greatest openSeq) — the keyboard/focus-trap owner. Uses the open
   *  stamp rather than array position so a reparent (which re-pushes a
   *  lower picker to the tail) can't hand ownership to a background
   *  dialog. */
  private static isTopmostOpen(picker: MdTimePicker): boolean {
    let top: MdTimePicker | null = null;
    for (const p of openPickerStack) {
      if (!top || p.openSeq > top.openSeq) top = p;
    }
    return top === picker;
  }

  /** The real focused element across shadow boundaries (composed tree). */
  private static deepActiveElement(): HTMLElement | null {
    if (typeof document === 'undefined') return null;
    let active: Element | null = document.activeElement;
    while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
    return (active as HTMLElement) ?? null;
  }

  /** Composed-tree containment (crosses shadow boundaries upward). */
  private static composedContains(ancestor: Node, node: Node | null): boolean {
    let n: Node | null = node;
    while (n) {
      if (n === ancestor) return true;
      n = n instanceof ShadowRoot ? n.host : n.parentNode;
    }
    return false;
  }

  /** Focus-restore on close. The captured origin is only reused when it
   *  is still connected and NOT inside this picker (opening via the
   *  built-in trigger captures the trigger's inner input — restoring
   *  through the md-text-field's setFocus keeps delegatesFocus happy).
   *  Every degraded path lands on the trigger, never on <body>. */
  private restoreFocusAfterClose() {
    const target = this.previousFocus;
    this.previousFocus = null;
    const usable =
      !!target &&
      target.isConnected &&
      typeof target.focus === 'function' &&
      (typeof document === 'undefined' || target !== document.body);
    if (usable && !MdTimePicker.composedContains(this.el, target)) {
      target.focus();
      // A connected origin can still refuse focus (disabled or
      // display:none since capture) — verify it actually took before
      // accepting, otherwise fall through to the trigger.
      const after = MdTimePicker.deepActiveElement();
      if (after && MdTimePicker.composedContains(target, after)) return;
    }
    // When the close was caused by the control becoming disabled
    // (fieldset), match native behavior: no focus target remains.
    if (this.isDisabled) return;
    // With a trigger, restore to it. Without one (hideTrigger), the host
    // itself is `display: contents` and generates no focusable box, so
    // there is no in-component anchor: focus falling to <body> is the
    // honest outcome (matching a native <dialog> opened with no trigger).
    // The meaningful hideTrigger case — an external control that called
    // show() — is handled by the usable-previousFocus branch above.
    if (this.triggerFieldEl) this.focusTrigger();
  }

  private focusTrigger() {
    const field = this.triggerFieldEl;
    if (!field) return;
    if (typeof field.setFocus === 'function') void field.setFocus();
    else field.focus?.();
  }

  /** Tab-order candidates inside the open dialog, in DOM order.
   *  Includes the composed md-button / md-icon-button hosts (their
   *  shadow buttons receive the actual focus via focusItem). Roving
   *  tabindex="-1" radios and disabled controls are excluded. */
  private dialogFocusables(): HTMLElement[] {
    const dialog = this.el.shadowRoot?.querySelector('.md-time-picker__dialog');
    if (!dialog) return [];
    const nodes = Array.from(
      dialog.querySelectorAll<HTMLElement>('input, button, md-button, md-icon-button, [tabindex]'),
    );
    return nodes.filter(
      (n) => !n.hasAttribute('disabled') && n.getAttribute('tabindex') !== '-1',
    );
  }

  private focusItem(el: HTMLElement) {
    const anyEl = el as HTMLElement & { setFocus?: () => Promise<void> };
    if (typeof anyEl.setFocus === 'function') {
      void anyEl.setFocus();
      return;
    }
    const inner = el.shadowRoot?.querySelector<HTMLElement>('button, input, [tabindex]');
    const target = inner ?? el;
    target.focus();
    // HH/MM buffers sit at maxLength — a bare focus() with a collapsed
    // caret swallows the next keystroke, so the trap wrap honors the
    // same select-all contract as focusInputSelectingAll.
    if (target instanceof HTMLInputElement) this.selectInputContents(target);
  }

  /** Modal focus trap (WAI-ARIA dialog pattern): Tab from the last
   *  focusable wraps to the first, Shift+Tab from the first wraps to
   *  the last, and focus that escaped the dialog (scrim click residue,
   *  background page) is pulled back in on the next Tab. */
  private trapFocus(ev: KeyboardEvent) {
    const focusables = this.dialogFocusables();
    if (!focusables.length) return;
    const active = MdTimePicker.deepActiveElement();
    const idx = active
      ? focusables.findIndex((f) => MdTimePicker.composedContains(f, active))
      : -1;
    const forward = !ev.shiftKey;
    if (idx === -1) {
      ev.preventDefault();
      this.focusItem(focusables[forward ? 0 : focusables.length - 1]);
      return;
    }
    if (forward && idx === focusables.length - 1) {
      ev.preventDefault();
      this.focusItem(focusables[0]);
    } else if (!forward && idx === 0) {
      ev.preventDefault();
      this.focusItem(focusables[focusables.length - 1]);
    }
  }

  /** Take a synchronous snapshot of the current viewport size into
   *  state, used by the adaptive `responsive` policy. Safe to call
   *  outside a browser (returns early when `window` is unavailable
   *  during SSR / Jest spec runs). */
  private sampleViewport() {
    if (typeof window === 'undefined') return;
    this.viewportWidth = window.innerWidth || 0;
    this.viewportHeight = window.innerHeight || 0;
  }

  private attachViewportListener() {
    if (!this.responsive || typeof window === 'undefined') return;
    if (this.viewportResizeHandler) return; // already attached
    let frame = 0;
    this.viewportResizeHandler = () => {
      // Coalesce bursts of resize / orientationchange events into
      // a single re-render frame so we don't thrash the layout
      // while the user is mid-drag of a window edge.
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        this.sampleViewport();
        // If the new viewport pushes us into the input-fallback
        // range, eagerly flip `mode` so the dial doesn't render
        // for a frame against an undersized container. The
        // reverse (input → dial when the viewport grows) is left
        // to the user — flipping them OUT of input mid-typing
        // would be hostile.
        // Force the input FALLBACK only when the viewport genuinely
        // cannot fit the dial — not merely because the author's
        // variant preference is 'input'. Otherwise any resize evicted
        // a user who had toggled to the dial back to the input mode.
        if (
          this.mode === 'dial' &&
          this.viewportHeight > 0 &&
          this.viewportHeight < MdTimePicker.ADAPTIVE_MIN_DIAL_HEIGHT
        ) {
          this.mode = 'input';
        }
        frame = 0;
      });
    };
    window.addEventListener('resize', this.viewportResizeHandler, { passive: true });
    window.addEventListener('orientationchange', this.viewportResizeHandler, { passive: true });
  }

  private detachViewportListener() {
    if (typeof window === 'undefined') return;
    if (!this.viewportResizeHandler) return;
    window.removeEventListener('resize', this.viewportResizeHandler);
    window.removeEventListener('orientationchange', this.viewportResizeHandler);
    this.viewportResizeHandler = undefined;
  }

  private cancel = () => {
    if (!this.isOpen) return;
    this.draftHours = this.committedHours;
    this.draftMinutes = this.committedMinutes;
    this.mdCancel.emit();
    this.closePicker();
  };

  private confirm = () => {
    // A disabled picker must never commit (defensive — the dialog is
    // closed on disable, but confirm() is also reachable programmatically).
    if (this.isDisabled) return;
    // The typeable HH:MM tile row exists in BOTH variants, so OK must
    // validate the visible buffers in dial mode too — previously a
    // stale invalid buffer (e.g. "99") let OK silently commit the older
    // draft while the tiles still showed the erroring text.
    this.commitInputs();
    if (this.hourInputError || this.minuteInputError) return;
    this.committedHours = this.draftHours;
    this.committedMinutes = this.draftMinutes;
    const detail = this.buildChangeDetail(this.draftHours, this.draftMinutes);
    this.committedValue = detail.value;
    this.value = detail.value;
    this.updateFormValue();
    this.mdChange.emit(detail);
    this.closePicker();
  };

  // ─────────────────────── FORM VALUE & VALIDITY ───────────────────────

  /** ElementInternals: participate in FormData under the host's `name`
   *  and keep constraint validity in sync with the committed value. */
  private updateFormValue() {
    try {
      // '' submits as name= (empty entry), matching a native
      // <input type="time"> with no selection.
      this.internals?.setFormValue(this.committedValue ?? '');
    } catch {
      /* spec mock */
    }
    this.updateValidity();
  }

  private updateValidity() {
    if (typeof this.internals?.setValidity !== 'function') return;
    // Anchor validation UI on the trigger field when rendered (it's a
    // shadow-including descendant); before first render or with
    // `hideTrigger`, omit the anchor so the browser defaults to the host.
    const anchor = this.triggerFieldEl as unknown as HTMLElement | undefined;
    const setValidity = (flags: ValidityStateFlags, message?: string) => {
      if (message && anchor) this.internals.setValidity(flags, message, anchor);
      else if (message) this.internals.setValidity(flags, message);
      else this.internals.setValidity(flags);
    };
    const current = this.parseHHMM(this.committedValue);
    const minM = this.parseHHMM(this.min);
    const maxM = this.parseHHMM(this.max);
    // Substitute {min}/{max} into a localizable message template. Global
    // so a template that repeats a token substitutes every occurrence.
    const msg = (tpl: string) => tpl.replace(/\{min\}/g, this.min).replace(/\{max\}/g, this.max);
    try {
      if (this.required && current === null) {
        setValidity({ valueMissing: true }, this.valueMissingLabel);
      } else if (current !== null && minM !== null && maxM !== null && minM > maxM) {
        // Reversed range = overnight window, matching native
        // <input type="time"> semantics: valid when v >= min OR v <= max
        // (e.g. min="22:00" max="06:00" accepts 23:30 and 05:00). When
        // the value falls in the excluded middle the HTML spec marks the
        // control as suffering from BOTH underflow and overflow, so we
        // set both flags (a consumer checking rangeOverflow alone still
        // sees the failure).
        if (current < minM && current > maxM) {
          setValidity({ rangeUnderflow: true, rangeOverflow: true }, msg(this.rangeOutsideLabel));
        } else {
          setValidity({});
        }
      } else if (current !== null && minM !== null && current < minM) {
        setValidity({ rangeUnderflow: true }, msg(this.rangeUnderflowLabel));
      } else if (current !== null && maxM !== null && current > maxM) {
        setValidity({ rangeOverflow: true }, msg(this.rangeOverflowLabel));
      } else {
        setValidity({});
      }
    } catch {
      /* spec mock */
    }
      this.emitValidityChange();
  }

  // ───────────────────────────── MODE / SELECTION ─────────────────────────────

  private setSelecting = (s: MdTimePickerSelection) => {
    this.selecting = s;
  };

  private togglePeriod = (p: MdTimePickerPeriod) => {
    if (this.format === '24h') return;
    if (this.period === p) return;
    if (p === 'AM' && this.draftHours >= 12) this.draftHours -= 12;
    else if (p === 'PM' && this.draftHours < 12) this.draftHours += 12;
    this.emitInputIfChanged();
    // In 12h mode the displayed HH digit doesn't change when the
    // period flips (3 AM ↔ 3 PM both show "3"), but the typed
    // buffer might be stale or in an error state from a prior bad
    // value — re-sync so the inputs always reflect the truth.
    this.syncInputsFromDraft();
  };

  /**
   * WAI-ARIA radiogroup keyboard pattern for AM ⇄ PM.
   *
   * The roving-tabindex on the period buttons (only the *checked*
   * radio is tabbable) is correct for `role="radiogroup"`, but it
   * means the second radio is unreachable via Tab — so the group
   * also has to handle the arrow / Home / End keys per the WAI-ARIA
   * Authoring Practices for the radio pattern. Without this, Tab
   * appears to "skip" PM straight to the footer keyboard-toggle
   * icon — which is exactly the bug this handler fixes.
   *
   * Bindings:
   *   - ArrowLeft / ArrowUp    → previous radio (and select it)
   *   - ArrowRight / ArrowDown → next radio (and select it)
   *   - Home                   → AM
   *   - End                    → PM
   *   - Space                  → re-select the focused radio (no-op
   *                              if already checked; matches HTML
   *                              radio semantics)
   *
   * All four arrow keys are wired even though the toggle is laid out
   * vertically by default, because the horizontal-period-layout
   * variant (and the dial's landscape orientation) reorient the
   * group and users expect both axes to work either way.
   */
  private onPeriodKeyDown = (e: KeyboardEvent) => {
    if (this.format === '24h') return;
    const key = e.key;
    const nav = key === 'ArrowLeft' || key === 'ArrowRight' || key === 'ArrowUp' || key === 'ArrowDown' || key === 'Home' || key === 'End';
    if (!nav && key !== ' ' && key !== 'Spacebar') return;
    e.preventDefault();
    let next: MdTimePickerPeriod;
    if (key === 'Home') next = 'AM';
    else if (key === 'End') next = 'PM';
    else if (key === ' ' || key === 'Spacebar') next = this.period;
    else next = this.period === 'AM' ? 'PM' : 'AM';
    this.togglePeriod(next);
    // Move DOM focus to the newly-active radio so the user can keep
    // arrowing without first re-tabbing into the group. We do this
    // in the next frame because the tabindex flip (`current === 'AM'`
    // ? 0 : -1) only takes effect after the next render — focusing
    // a tabindex=-1 element pre-render would silently no-op on some
    // browsers.
    requestAnimationFrame(() => {
      const root = this.el.shadowRoot;
      if (!root) return;
      const target = root.querySelector(
        next === 'AM' ? '[part="period-am"]' : '[part="period-pm"]',
      ) as HTMLElement | null;
      target?.focus();
    });
  };

  private toggleMode = () => {
    const previousMode = this.mode;
    this.mode = this.mode === 'dial' ? 'input' : 'dial';
    // Fire mdModeChange BEFORE re-seeding inputs / focusing so a
    // listener can react synchronously (e.g. tweak a wrapper's
    // max-height) before the new mode lays out. The detail bundle
    // includes the previous mode for analytics that need to count
    // "user opened the keyboard from dial" vs "from input".
    this.mdModeChange.emit({ mode: this.mode, previousMode });
    // Both modes share the same typeable HH:MM input row — re-seed
    // the input fields, clear any prior error state, and focus the
    // hour input with its contents selected so the next keystroke
    // replaces the seeded value (the buffer is already at maxLength,
    // so a caret at the end would swallow the first keystroke).
    this.selecting = 'hour';
    this.hourInputValue = String(this.displayHour);
    this.minuteInputValue = String(this.draftMinutes).padStart(2, '0');
    this.hourInputError = false;
    this.minuteInputError = false;
    this.hourInputSeeded = false;
    this.minuteInputSeeded = false;
    requestAnimationFrame(() => {
      this.syncInputFields();
      this.focusInputSelectingAll(this.hourInputEl);
    });
  };

  /** Write current state to the (uncontrolled) input fields. */
  private syncInputFields() {
    if (this.hourInputEl) this.hourInputEl.value = String(this.displayHour);
    if (this.minuteInputEl) this.minuteInputEl.value = String(this.draftMinutes).padStart(2, '0');
  }

  /**
   * Bidirectional dial ⇄ input sync: mirror the current draft into the
   * HH / MM input fields whenever the *dial side* drove the change
   * (drag, click on a number, AM/PM toggle, etc.). Without this the
   * input row would silently desync — the user would drag the dial
   * to 17:45 but the HH/MM fields would keep showing "03:30" until
   * they typed something or blurred.
   *
   * Two writes per call site:
   *
   *   1. `hourInputValue` / `minuteInputValue` — the `@State` strings
   *      backing the validator. Updated so that the next blur or
   *      `Enter` re-validates against the dial-driven value, not the
   *      stale typed buffer.
   *
   *   2. The actual `<input>` DOM nodes (uncontrolled). The input is
   *      uncontrolled because Stencil's JSX `value=` rebinding would
   *      yank the caret mid-typing — but that means we have to write
   *      the value imperatively when the dial drives the change.
   *
   * Also clears both error flags: any value coming from the dial is
   * by construction in range (the dial geometry can't produce hour
   * 99 or minute 60), so a stale error from a prior bad typed buffer
   * should not survive a corrective dial drag.
   *
   * Caret safety: we write to `.value` only when it actually differs
   * from the target string, and we never call this from inside the
   * input-typing handlers — so the user's caret position in the
   * field they're actively editing is never disturbed.
   */
  private syncInputsFromDraft() {
    const hourStr = String(this.displayHour);
    const minuteStr = String(this.draftMinutes).padStart(2, '0');
    this.hourInputValue = hourStr;
    this.minuteInputValue = minuteStr;
    this.hourInputError = false;
    this.minuteInputError = false;
    if (this.hourInputEl && this.hourInputEl.value !== hourStr) {
      this.hourInputEl.value = hourStr;
      // Rewriting the FOCUSED field leaves a collapsed caret in a
      // maxLength-full buffer (the dial auto-advance focuses MM, then
      // dial taps rewrite it) — re-select so the next keystroke
      // replaces instead of being swallowed. Never called from the
      // typing handlers, so a mid-edit caret is never disturbed.
      if (MdTimePicker.deepActiveElement() === this.hourInputEl) {
        this.selectInputContents(this.hourInputEl);
      }
    }
    if (this.minuteInputEl && this.minuteInputEl.value !== minuteStr) {
      this.minuteInputEl.value = minuteStr;
      if (MdTimePicker.deepActiveElement() === this.minuteInputEl) {
        this.selectInputContents(this.minuteInputEl);
      }
    }
  }

  private bindHourInput = (el?: HTMLInputElement | null) => {
    if (!el) {
      this.hourInputSeeded = false;
      this.hourInputEl = undefined;
      return;
    }
    this.hourInputEl = el;
    if (!this.hourInputSeeded) {
      el.value = this.hourInputValue;
      this.hourInputSeeded = true;
    }
  };

  private bindMinuteInput = (el?: HTMLInputElement | null) => {
    if (!el) {
      this.minuteInputSeeded = false;
      this.minuteInputEl = undefined;
      return;
    }
    this.minuteInputEl = el;
    if (!this.minuteInputSeeded) {
      el.value = this.minuteInputValue;
      this.minuteInputSeeded = true;
    }
  };

  // ───────────────────────────── DIAL INTERACTION ─────────────────────────────

  private dialPointFromEvent(e: PointerEvent) {
    if (!this.dialEl) return null;
    const rect = this.dialEl.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const distance = Math.hypot(dx, dy);
    let angle = Math.atan2(dy, dx) * (180 / Math.PI);
    angle = (angle + 90 + 360) % 360;
    return { angle, distance, radius: rect.width / 2 };
  }

  private applyDialPointer = (e: PointerEvent) => {
    const pt = this.dialPointFromEvent(e);
    if (!pt) return;
    const { angle, distance, radius } = pt;

    if (this.selecting === 'hour') {
      const idx = Math.round(angle / 30) % 12;
      if (this.format === '12h') {
        const displayH = idx === 0 ? 12 : idx;
        this.setHour24FromDisplay(displayH, this.period);
      } else {
        // The midpoint between the inner (0.52r) and outer (0.80r)
        // number rings — anything closer to the centre than this
        // threshold is treated as an inner-ring tap (hours 0/13-23).
        // Keep this in sync with outerRadiusRatio/innerRadiusRatio in
        // renderDial(): midpoint = (0.52 + 0.80) / 2 = 0.66.
        const isInner = distance < radius * 0.66;
        if (isInner) {
          this.draftHours = idx === 0 ? 0 : 12 + idx;
        } else {
          this.draftHours = idx === 0 ? 12 : idx;
        }
      }
    } else {
      const step = Math.max(1, Math.min(30, this.minuteStep || 1));
      let raw = Math.round(angle / 6);
      raw = (Math.round(raw / step) * step) % 60;
      this.draftMinutes = raw;
    }
    // Drag emits `mdInput` continuously, but the de-dupe key
    // collapses repeats so listeners only see one event per
    // distinct H/M pair. Cheap enough to call on every pointer
    // move without throttling.
    this.emitInputIfChanged();
    // Mirror the dial-driven draft into the HH/MM input row so the
    // user sees their drag reflected in the typeable tiles too —
    // the dial and the inputs share a single source of truth.
    this.syncInputsFromDraft();
  };

  private onDialPointerDown = (e: PointerEvent) => {
    if (this.isDisabled) return;
    e.preventDefault();
    this.isDragging = true;
    (e.currentTarget as Element)?.setPointerCapture?.(e.pointerId);
    this.applyDialPointer(e);
  };

  private onDialPointerMove = (e: PointerEvent) => {
    if (!this.isDragging) return;
    this.applyDialPointer(e);
  };

  private onDialPointerUp = (e: PointerEvent) => {
    if (!this.isDragging) return;
    this.isDragging = false;
    (e.currentTarget as Element)?.releasePointerCapture?.(e.pointerId);
    if (this.selecting === 'hour') {
      this.selecting = 'minute';
      // After the user commits an hour by releasing a dial drag,
      // push keyboard focus to the MM input so they can either keep
      // dragging the (now-minute) dial OR start typing the minute
      // value without first clicking into the field. The MM input's
      // `onFocus` would also call `setSelecting('minute')`, but
      // `selecting` was already flipped above — this is purely
      // about getting the caret into the right field.
      //
      // Deferred to the next frame because (a) the minute input
      // needs to render in its newly-active state first (the
      // `--active` class drives focus-visible styling), and (b)
      // focusing mid-pointerup races the browser's own focus
      // restoration on some platforms.
      requestAnimationFrame(() => {
        this.focusInputSelectingAll(this.minuteInputEl);
      });
    }
  };

  // ───────────────────────────── KEYBOARD ─────────────────────────────

  private onHostKeyDown = (e: KeyboardEvent) => {
    if (!this.isOpen) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      this.cancel();
    }
  };

  // ───────────────────────────── INPUT MODE ─────────────────────────────

  /**
   * Apply the current `hourInputValue` / `minuteInputValue` buffers to
   * the live draft (so the dial hand tracks typing in real time) and
   * flag invalid buffers as errors.
   *
   * `scope` tells the validator which field(s) the user just touched,
   * so we only re-flag the field the user is actively editing instead
   * of painting both fields red when only one was just typed into:
   *
   *   • `'hour'`   — fired from `onHourInput`.   Only the HH field's
   *     error flag is rewritten (set OR cleared). MM's error sticks
   *     until MM itself is edited or the input is blurred.
   *   • `'minute'` — fired from `onMinuteInput`. Symmetric mirror.
   *   • `'both'`   — fired from blur / Enter / OK. Both fields are
   *     re-validated together so the form is "final-state" correct
   *     before committing (or before refusing to commit).
   *
   * In *all* call sites a valid (H, M) pair commits to the draft and
   * emits `mdInput`. The `emitInputIfChanged` filter handles the
   * common case where mid-keystroke commits and the blur commit
   * resolve to the same final value (only one emit reaches listeners).
   *
   * Note on the dial: if the buffer is mid-typing-invalid (e.g. the
   * user has typed "5" → "50" and is on their way to "55"), the
   * draft does NOT update — the dial hand intentionally HOLDS at the
   * previous valid value so the hand doesn't jitter into nonsense
   * positions between keystrokes. The error flag still updates
   * synchronously per the scope rules above.
   */
  private applyInputsToDraft(scope: 'hour' | 'minute' | 'both'): boolean {
    const h = parseInt(this.hourInputValue, 10);
    const m = parseInt(this.minuteInputValue, 10);
    const minH = this.format === '24h' ? 0 : 1;
    const maxH = this.format === '24h' ? 23 : 12;
    const hValid = !isNaN(h) && h >= minH && h <= maxH;
    const mValid = !isNaN(m) && m >= 0 && m <= 59;
    if (scope === 'hour' || scope === 'both') this.hourInputError = !hValid;
    if (scope === 'minute' || scope === 'both') this.minuteInputError = !mValid;
    if (hValid && mValid) {
      this.draftMinutes = m;
      this.setHour24FromDisplay(h, this.period);
      this.emitInputIfChanged();
      return true;
    }
    return false;
  }

  private commitInputs = () => {
    this.applyInputsToDraft('both');
  };

  private onHourInput = (e: Event) => {
    const el = e.target as HTMLInputElement;
    const v = el.value.replace(/\D/g, '').slice(0, 2);
    if (el.value !== v) el.value = v;
    this.hourInputValue = v;
    // Live: flag the HH field immediately if the buffer is out of
    // range, AND commit to the draft (which moves the dial hand) if
    // BOTH HH and MM parse cleanly. We never touch the MM error flag
    // here — only HH was just edited.
    this.applyInputsToDraft('hour');
  };

  private onMinuteInput = (e: Event) => {
    const el = e.target as HTMLInputElement;
    const v = el.value.replace(/\D/g, '').slice(0, 2);
    if (el.value !== v) el.value = v;
    this.minuteInputValue = v;
    this.applyInputsToDraft('minute');
  };

  private onHourBlur = () => {
    if (this.hourInputEl) this.hourInputValue = this.hourInputEl.value;
    this.commitInputs();
    // Canonicalize the display ONLY when the buffer actually round-trips
    // to the draft. When this field is valid but the sibling errors, the
    // both-valid gate in applyInputsToDraft left the draft stale —
    // rewriting from the draft here would silently destroy the user's
    // typed value (they typed "7", the field would snap back to "10").
    if (!this.hourInputError && parseInt(this.hourInputValue, 10) === this.displayHour) {
      this.hourInputValue = String(this.displayHour);
      if (this.hourInputEl) this.hourInputEl.value = this.hourInputValue;
    }
  };

  private onMinuteBlur = () => {
    if (this.minuteInputEl) this.minuteInputValue = this.minuteInputEl.value;
    this.commitInputs();
    // Same sibling-error guard as onHourBlur: only pad/canonicalize a
    // buffer that was actually applied to the draft.
    if (!this.minuteInputError && parseInt(this.minuteInputValue, 10) === this.draftMinutes) {
      this.minuteInputValue = String(this.draftMinutes).padStart(2, '0');
      if (this.minuteInputEl) this.minuteInputEl.value = this.minuteInputValue;
    }
  };

  /**
   * Apply a signed delta (in "ticks" — 1 hour / 1 minute step) to the
   * currently-focused HH or MM input. Mirrors the keyboard increment
   * pattern of the native `<input type="time">` and the WAI-ARIA
   * spinbutton pattern, so screen-reader users on Win+NVDA who hear
   * the input announced and press the standard Up arrow get the
   * expected behaviour.
   *
   * Wrap rules:
   *   • HH 24h     — wraps 23↔0 cyclically.
   *   • HH 12h     — wraps in display-hour space (1..12) so going up
   *                   from "12" lands on "1" with period UNCHANGED.
   *                   Users flip AM/PM with the dedicated pill (or
   *                   ArrowUp/Down on that pill); the hour cycler
   *                   doesn't fight them by flipping period under
   *                   them on every wrap.
   *   • MM         — wraps mod 60 in steps of `minuteStep` (snapping
   *                   the current value to the nearest step first so
   *                   an off-step value typed manually still moves
   *                   cleanly on the next arrow press).
   *
   * After the update we re-render the visible input string, clear
   * the field's error flag (the new value is definitionally valid),
   * emit `mdInput` via the de-duping channel, and reselect the
   * input's text so the next arrow press operates on the field
   * (instead of moving the caret within the now-visible digits).
   */
  /** Spinbutton "current value": prefer the visible valid buffer — it
   *  can be valid-but-unapplied while the SIBLING field errors (the
   *  both-valid gate holds the draft) — falling back to the draft.
   *  Feeds aria-valuenow and the ArrowUp/Down base so what the user
   *  sees is always what gets announced and incremented. */
  private get hourValueNow(): number {
    const b = parseInt(this.hourInputValue, 10);
    return Number.isNaN(b) ? this.displayHour : b;
  }

  private get minuteValueNow(): number {
    const b = parseInt(this.minuteInputValue, 10);
    return Number.isNaN(b) ? this.draftMinutes : b;
  }

  private bumpFocusedInput(direction: 1 | -1, target: 'hour' | 'minute') {
    if (target === 'hour') {
      const base = this.hourInputError ? this.displayHour : this.hourValueNow;
      if (this.format === '24h') {
        this.draftHours = ((base + direction) % 24 + 24) % 24;
      } else {
        // Cycle the DISPLAY hour 1..12 so the wrap from 12→1 / 1→12
        // preserves whichever period the user is currently in.
        const current = base;
        let next = current + direction;
        if (next > 12) next = 1;
        else if (next < 1) next = 12;
        this.setHour24FromDisplay(next, this.period);
      }
      this.hourInputError = false;
      this.hourInputValue = String(this.displayHour);
      if (this.hourInputEl) {
        this.hourInputEl.value = this.hourInputValue;
        this.selectInputContents(this.hourInputEl);
      }
    } else {
      const step = Math.max(1, Math.min(30, this.minuteStep || 1));
      // Snap the current value to the step grid before bumping, so a
      // 1-min stray (e.g. typed "07" with step=5) still produces a
      // clean next-step value ("10") rather than "12".
      const minuteBase = this.minuteInputError ? this.draftMinutes : this.minuteValueNow;
      const snapped = Math.round(minuteBase / step) * step;
      this.draftMinutes = ((snapped + direction * step) % 60 + 60) % 60;
      this.minuteInputError = false;
      this.minuteInputValue = String(this.draftMinutes).padStart(2, '0');
      if (this.minuteInputEl) {
        this.minuteInputEl.value = this.minuteInputValue;
        this.selectInputContents(this.minuteInputEl);
      }
    }
    this.emitInputIfChanged();
  }

  /**
   * Re-select the input's contents so the next arrow press operates
   * on the field as a whole (instead of moving the caret within the
   * now-visible digits).
   *
   * Wrapped in a feature-detect + try/catch so spec environments
   * whose mock `HTMLInputElement` doesn't implement `select()` (e.g.
   * Stencil's mock-doc) don't throw out of the keydown handler and
   * skip the subsequent `emitInputIfChanged()` call. In real browsers
   * `select()` always exists; the guard is a no-op cost.
   */
  private selectInputContents(el: HTMLInputElement) {
    if (typeof el.select !== 'function') return;
    try { el.select(); } catch { /* DOM not focusable yet — non-fatal */ }
  }

  private onInputKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (this.hourInputEl) this.hourInputValue = this.hourInputEl.value;
      if (this.minuteInputEl) this.minuteInputValue = this.minuteInputEl.value;
      this.confirm();
      return;
    }
    // ArrowUp / ArrowDown increment / decrement the focused field.
    // The dial hand follows along because both HH/MM inputs and the
    // dial are bound to the same `draftHours` / `draftMinutes` state.
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      // Identify which input fired this event. Using the event target
      // (rather than `this.selecting`) keeps the handler correct even
      // if the active-input class lags behind focus by a render
      // (e.g. mid-tab transitions).
      const target = e.target as HTMLElement | null;
      const isHour =
        target === this.hourInputEl ||
        target?.classList?.contains('md-time-picker__input-hour') === true;
      const isMinute =
        target === this.minuteInputEl ||
        target?.classList?.contains('md-time-picker__input-minute') === true;
      if (!isHour && !isMinute) return;
      // preventDefault stops the browser from jumping the text caret
      // to start/end of the input, which would otherwise visually
      // compete with the .select() the bumper performs.
      e.preventDefault();
      this.bumpFocusedInput(e.key === 'ArrowUp' ? 1 : -1, isHour ? 'hour' : 'minute');
    }
  };

  // ───────────────────────────── RENDER HELPERS ─────────────────────────────

  /**
   * Renders the trigger as a real `md-text-field` (outlined, read-only).
   * Composing the canonical field gets us the M3 notched outline, the
   * floating-label animation, hover/focus/disabled visual states, and
   * density / a11y plumbing for free — none of which the legacy custom
   * button could match without re-implementing the whole text-field spec.
   *
   * The text-field is read-only so users can't type free text into a time
   * trigger, but Tab still focuses it (matching the standard pattern for
   * pickers that wrap an input). Click and Enter/Space open the dialog.
   */
  private renderTrigger() {
    if (this.hideTrigger) return null;
    const display = this.committedValue
      ? this.formatDisplayTime(this.committedHours, this.committedMinutes)
      : '';
    const a11yLabel = display ? `${this.label}, ${display}` : this.label;
    return (
      <md-text-field
        class={{
          'md-time-picker__field': true,
          'md-time-picker__field--disabled': this.isDisabled,
          'md-time-picker__field--filled': !!display,
          'md-time-picker__field--open': this.isOpen,
        }}
        variant="outlined"
        readOnly
        label={this.label}
        value={display}
        /* An error message replaces the helper rather than stacking under it —
           the same rule md-text-field applies to its own two, and what
           md-date-picker does one line for one line. */
        supportingText={this.error && this.errorText ? '' : this.supportingText}
        error={this.error}
        errorText={this.errorText}
        reserveSupportingSpace={this.reserveSupportingSpace}
        disabled={this.isDisabled}
        required={this.required}
        part="trigger"
        aria-haspopup="dialog"
        aria-expanded={String(this.isOpen)}
        aria-label={a11yLabel}
        appearFocused={this.isOpen}
        ref={(el?: HTMLMdTextFieldElement) => {
          this.triggerFieldEl = el;
        }}
        onClick={this.onTriggerClick}
        onKeyDown={this.onTriggerKeyDown}
      >
        <span
          slot="leading-icon"
          class="md-time-picker__field-icon material-symbols-outlined"
          part="trigger-icon"
          aria-hidden="true"
        >
          schedule
        </span>
      </md-text-field>
    );
  }

  private onTriggerClick = (e: MouseEvent) => {
    if (this.isDisabled) return;
    e.preventDefault();
    this.openPicker();
  };

  private onTriggerKeyDown = (e: KeyboardEvent) => {
    if (this.isDisabled) return;
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      e.stopPropagation();
      this.openPicker();
    }
  };

  /**
   * Resolves the AM/PM pill layout used at render time. Returns the
   * 216×38 horizontal pill whenever the dialog itself is horizontal
   * (because the 52×80 vertical pill would have to share the left
   * column with HH:MM and AM/PM and the spec arrangement doesn't
   * accommodate that). Otherwise the author's explicit
   * `period-layout` prop wins.
   *
   * Centralising this in a getter means every site that branches on
   * AM/PM layout (renderInputs, renderDialog, period CSS modifier)
   * stays in sync if the orientation flips at runtime.
   */
  private get effectivePeriodLayout(): MdTimePickerPeriodLayout {
    // Input variant: spec sheet (m3.material.io/components/time-pickers/
    // specs#input) shows the AM/PM toggle as a 52×72 vertical stack
    // inline-end of MM, never as the 216×38 horizontal pill. We force
    // vertical here so authors can keep their `period-layout="horizontal"`
    // preference for dial mode without breaking the input layout.
    if (this.mode === 'input') return 'vertical';
    // Horizontal dial dialog: the 52×80 vertical pill cannot share the
    // left column with HH:MM cleanly, so we coerce the 216×38 pill.
    if (this.effectiveOrientation === 'horizontal' && this.mode === 'dial') return 'horizontal';
    return this.periodLayout;
  }

  /* ── Adaptive layout policy ──
     The MD3 spec says the picker should "swap between orientation
     or variant depending on device orientation and viewport
     constraints" so the dial never has to scroll. These two
     getters centralise that decision so every render path
     (renderDialog, renderPeriodToggle, the @Watch handlers, the
     CSS-class branches) reads from a single source of truth.

     Thresholds — picked off the canonical MD3 reference and our
     own dialog math:

       • `--_adaptive-min-dial-height` (460px): the dial dialog is
         the headline (~32px) + HH:MM tile row (80px) + dial
         (256px) + footer (~48px) + 2 × 24px padding ≈ 440px.
         Add the 24px scrim padding and 460px is the smallest
         viewport that fits the picker without scroll.
       • `--_adaptive-landscape-width` (720px): the 12-hour
         horizontal dialog is 572px wide and 24-hour is 608px. With
         24px scrim padding either side we need at least ~656px;
         720px gives the dialog comfortable breathing room.

     The author's prop values are honored unless the viewport
     literally cannot fit them. `responsive=false` skips the entire
     policy and respects props verbatim. */
  private static readonly ADAPTIVE_MIN_DIAL_HEIGHT = 460;
  private static readonly ADAPTIVE_LANDSCAPE_WIDTH = 720;
  /* Demotion threshold for an explicit `orientation="horizontal"`:
     the 12h landscape dialog is 572px wide (608px for 24h) + 2×24px
     scrim padding ≈ 620/656px. Below 620px the horizontal layout
     cannot fit even the narrower 12h dialog, so the responsive
     policy falls back to the vertical portrait dialog. Deliberately
     lower than ADAPTIVE_LANDSCAPE_WIDTH (720) so there's a hysteresis
     band where an author preference is honored but never auto-promoted. */
  private static readonly ADAPTIVE_DEMOTE_WIDTH = 620;

  private get effectiveVariant(): MdTimePickerMode {
    if (!this.responsive) return this.variant;
    if (!this.viewportHeight) return this.variant;
    // Vertical real estate too small for the 256px dial → fall
    // back to input even if the author asked for `dial`.
    if (this.viewportHeight < MdTimePicker.ADAPTIVE_MIN_DIAL_HEIGHT) return 'input';
    return this.variant;
  }

  private get effectiveOrientation(): MdTimePickerOrientation {
    if (!this.responsive) return this.orientation;
    if (!this.viewportWidth || !this.viewportHeight) return this.orientation;
    // Landscape promotion/demotion only applies while the DIAL is the
    // rendered mode — gate on `this.mode` (what renderDialog uses), not
    // the variant preference: a user who toggles variant="input" into
    // dial mode must still get the demotion on narrow viewports.
    if (this.mode !== 'dial') return this.orientation;
    // Promote vertical → horizontal when the viewport is wide
    // enough AND wider than it is tall. The width gate avoids
    // promoting on a tall-but-narrow tablet (e.g. unfolded book
    // mode) where the horizontal dialog would still be cramped.
    if (
      this.orientation === 'vertical' &&
      this.viewportWidth >= MdTimePicker.ADAPTIVE_LANDSCAPE_WIDTH &&
      this.viewportWidth > this.viewportHeight
    ) {
      return 'horizontal';
    }
    // Demote horizontal → vertical when the viewport cannot fit the
    // 572/608px landscape dialog (+ scrim padding) — the symmetric
    // counterpart of the promotion above. Without it an explicit
    // `orientation="horizontal"` on a narrow viewport overflowed the
    // dialog ~196px past the right edge with no scroll access to OK.
    if (
      this.orientation === 'horizontal' &&
      this.viewportWidth < MdTimePicker.ADAPTIVE_DEMOTE_WIDTH
    ) {
      return 'vertical';
    }
    return this.orientation;
  }

  private renderPeriodToggle() {
    const current = this.period;
    // Same effective-layout resolution as renderInputs — when the
    // dialog is horizontal we override the prop to "horizontal" so the
    // pill stretches across the left column instead of stacking next
    // to MM as a 52×80 vertical pill.
    const horizontal = this.effectivePeriodLayout === 'horizontal';
    return (
      <div
        class={{
          'md-time-picker__period': true,
          'md-time-picker__period--vertical': !horizontal,
          'md-time-picker__period--horizontal': horizontal,
        }}
        role="radiogroup"
        aria-label={this.periodLabel}
        aria-orientation={horizontal ? 'horizontal' : 'vertical'}
        onKeyDown={this.onPeriodKeyDown}
        part="period-toggle"
      >
        <button
          type="button"
          class={{
            'md-time-picker__period-btn': true,
            'md-time-picker__period-btn--am': true,
            'md-time-picker__period-btn--active': current === 'AM',
          }}
          role="radio"
          aria-checked={String(current === 'AM')}
          tabindex={current === 'AM' ? 0 : -1}
          onClick={() => this.togglePeriod('AM')}
          part="period-am"
        >
          <md-ripple disabled={this.isDisabled} part="period-am-ripple"></md-ripple>
          <span class="md-time-picker__period-btn-label">{this.amLabel}</span>
        </button>
        <button
          type="button"
          class={{
            'md-time-picker__period-btn': true,
            'md-time-picker__period-btn--pm': true,
            'md-time-picker__period-btn--active': current === 'PM',
          }}
          role="radio"
          aria-checked={String(current === 'PM')}
          tabindex={current === 'PM' ? 0 : -1}
          onClick={() => this.togglePeriod('PM')}
          part="period-pm"
        >
          <md-ripple disabled={this.isDisabled} part="period-pm-ripple"></md-ripple>
          <span class="md-time-picker__period-btn-label">{this.pmLabel}</span>
        </button>
      </div>
    );
  }

  /**
   * Maintains a per-mode cumulative rotation so successive renders feed
   * CSS the shortest signed delta from the previous frame. Without this
   * the hand visibly snaps backward whenever the value crosses zero
   * (minute 59 → 00, hour 23 → 00 in 24h, hour 12 → 1 in 12h, …).
   *
   * Math: project `raw - last` into the half-open interval [-180°, +180°)
   * using the trick `((d % 360) + 540) % 360 - 180`. Add that delta to
   * the running total — the result is monotonic across boundaries.
   *
   * Re-seed when the dial mode flips (hour ↔ minute) or when the picker
   * just opened (`lastHandMode === null`) so the first paint of a fresh
   * dial doesn't animate in from a stale unwrapped angle.
   */
  private advanceHandAngle(mode: MdTimePickerSelection, raw: number): number {
    if (this.lastHandMode !== mode) {
      this.lastHandMode = mode;
      if (mode === 'hour') {
        this.hourCumulativeAngle = raw;
        return raw;
      }
      this.minuteCumulativeAngle = raw;
      return raw;
    }
    const last = mode === 'hour' ? this.hourCumulativeAngle : this.minuteCumulativeAngle;
    const delta = (((raw - last) % 360) + 540) % 360 - 180;
    const next = last + delta;
    if (mode === 'hour') this.hourCumulativeAngle = next;
    else this.minuteCumulativeAngle = next;
    return next;
  }

  private renderDial() {
    const isHour = this.selecting === 'hour';
    const radius = 50;
    // Number-ring radii expressed as a fraction of the half-dial radius
    // (128px on a 256px dial). Two competing constraints:
    //   1) The OUTER handle must hug the dial circle (~1–2px clear).
    //   2) The INNER handle must not engulf outer-ring numbers.
    //
    // With a 48px handle (24px radius), constraint #2 requires
    //   outer_center − (inner_center + 24px) ≥ ~10px
    // ⇒ inner ≤ (outer × 128 − 24 − 10) / 128 = outer − 0.266r
    // With outer = 0.80r, that caps inner at ~0.534r.
    //
    // Current values (verified by E2E):
    //   outer ring center  = 0.80  →  102.4px from dial centre
    //   handle outer edge  = 102.4 + 24 = 126.4px
    //   dial radius        = 128px
    //   clearance to edge  = ~1.6px (handle hugs the dial) ✓
    //
    //   inner 24h ring     = 0.52  →  66.56px from dial centre
    //   inner-handle outer = 66.56 + 24 = 90.56px
    //   gap to outer ring  = 102.4 − 90.56 = 11.84px ✓
    //   gap to centre dot  = 66.56 − 4 = 62.56px ✓
    //
    // History — the iteration trail that landed here:
    //   0.82 / 0.62 → outer handle 1px PAST dial edge (overflow)
    //   0.75 / 0.50 → outer handle 8px away ("too inside")
    //   0.80 / 0.55 → outer good, inner-handle engulfed outer numbers
    //                 (only 8px clearance between rings)
    //   0.80 / 0.50 → safe but the inner ring felt "too inner" — the
    //                 empty centre was visually dominant
    //   0.80 / 0.52 → inner pushed outward by ~4% while keeping
    //                 11.84px clearance to the outer ring
    const outerRadiusRatio = 0.8;
    const innerRadiusRatio = 0.52;

    // ── Hand angle (wrapped 0–360°) ──
    let rawAngle = 0;
    let handLengthRatio = outerRadiusRatio;
    if (isHour) {
      if (this.format === '12h') {
        const idx = this.displayHour === 12 ? 0 : this.displayHour;
        rawAngle = idx * 30;
      } else {
        const h = this.draftHours;
        if (h === 0) {
          rawAngle = 0;
          handLengthRatio = innerRadiusRatio;
        } else if (h >= 1 && h <= 12) {
          rawAngle = (h === 12 ? 0 : h) * 30;
        } else {
          rawAngle = (h - 12) * 30;
          handLengthRatio = innerRadiusRatio;
        }
      }
    } else {
      rawAngle = this.draftMinutes * 6;
    }

    // ── Smooth wrap across 0/360 ──
    // CSS `transition: transform` interpolates between literal degree
    // values, so feeding it `rotate(354deg) → rotate(0deg)` unwinds the
    // hand backward by -354°. We compute the shortest signed delta
    // (within [-180°, +180°)) from the previous unwrapped angle and add
    // it to the running total; the consumer hand keeps spinning the
    // natural direction even as the value crosses the 0-hour or
    // 0-minute boundary.
    const handAngle = this.advanceHandAngle(isHour ? 'hour' : 'minute', rawAngle);

    return (
      <div
        class="md-time-picker__dial-wrap"
        part="dial-wrap"
      >
        <div
          class={{
            'md-time-picker__dial': true,
            'md-time-picker__dial--minute': !isHour,
            'md-time-picker__dial--24h-hour': isHour && this.format === '24h',
          }}
          ref={(el) => (this.dialEl = el as HTMLDivElement)}
          onPointerDown={this.onDialPointerDown}
          onPointerMove={this.onDialPointerMove}
          onPointerUp={this.onDialPointerUp}
          onPointerCancel={this.onDialPointerUp}
          role="presentation"
          part="dial"
        >
          <div
            class="md-time-picker__dial-hand"
            style={{
              transform: `rotate(${handAngle}deg)`,
              /* Private var — the PUBLIC `--md-time-picker-hand-length`
                 token must stay author-settable, so CSS resolves
                 `var(--md-time-picker-hand-length, var(--_hand-length-dynamic))`.
                 Writing the public name here would shadow any author
                 value on the host (element-level inline always wins). */
              ['--_hand-length-dynamic' as any]: `${handLengthRatio * 100}%`,
            }}
            aria-hidden="true"
            part="dial-hand"
          >
            <span class="md-time-picker__dial-hand-dot" aria-hidden="true"></span>
            <span class="md-time-picker__dial-hand-line" aria-hidden="true"></span>
            <span class="md-time-picker__dial-hand-tip" aria-hidden="true"></span>
          </div>
          <span class="md-time-picker__dial-center" aria-hidden="true"></span>
          {isHour
            ? this.renderHourNumbers(radius, outerRadiusRatio, innerRadiusRatio)
            : this.renderMinuteNumbers(radius, outerRadiusRatio)}
        </div>
      </div>
    );
  }

  private renderHourNumbers(radius: number, outerRatio: number, innerRatio: number) {
    const numbers: { label: string; angle: number; inner: boolean; value: number }[] = [];
    if (this.format === '12h') {
      for (let i = 0; i < 12; i++) {
        const label = i === 0 ? '12' : String(i);
        numbers.push({ label, angle: i * 30, inner: false, value: i === 0 ? 12 : i });
      }
    } else {
      for (let i = 0; i < 12; i++) {
        const label = i === 0 ? '12' : String(i);
        numbers.push({ label, angle: i * 30, inner: false, value: i === 0 ? 12 : i });
      }
      for (let i = 0; i < 12; i++) {
        const label = i === 0 ? '00' : String(12 + i);
        numbers.push({ label, angle: i * 30, inner: true, value: i === 0 ? 0 : 12 + i });
      }
    }

    return numbers.map((n) => this.renderDialNumber(n.label, n.angle, n.inner, this.isHourActive(n.value), radius, outerRatio, innerRatio, n.value));
  }

  private isHourActive(h: number) {
    if (this.format === '12h') {
      return this.displayHour === h;
    }
    return this.draftHours === h;
  }

  private renderMinuteNumbers(radius: number, outerRatio: number) {
    const items: { label: string; angle: number; value: number }[] = [];
    for (let i = 0; i < 12; i++) {
      const minute = i * 5;
      items.push({ label: String(minute).padStart(2, '0'), angle: minute * 6, value: minute });
    }
    return items.map((n) =>
      // Minutes only ever live on the outer ring — feed the outerRatio
      // into both `outerRatio` and `innerRatio` so the value is unused.
      this.renderDialNumber(n.label, n.angle, false, this.draftMinutes === n.value, radius, outerRatio, outerRatio, n.value),
    );
  }

  private renderDialNumber(
    label: string,
    angle: number,
    inner: boolean,
    active: boolean,
    radius: number,
    outerRatio: number,
    innerRatio: number,
    value: number,
  ) {
    // Number placement MUST agree with `renderDial`'s hand length so the
    // 48px handle visually overlaps the selected number rather than
    // floating past it. Both ratios are sourced from the single pair
    // declared in renderDial().
    const r = inner ? radius * innerRatio : radius * outerRatio;
    const rad = ((angle - 90) * Math.PI) / 180;
    const x = 50 + (Math.cos(rad) * r);
    const y = 50 + (Math.sin(rad) * r);
    // PHYSICAL `left` / `top` — not the logical `inset-inline-start`
    // pair we use for content flow. A clock dial is a geometric
    // shape, not a text layout: in every locale, the numbers go
    // clockwise from 12 at the top (real wristwatches don't have an
    // RTL variant, and the MD3 spec dial mirrors that — Google's
    // Material Components Android implementation positions numbers
    // physically and never flips for RTL). Pairing physical
    // positioning here with the hand's physical `transform: rotate`
    // keeps the handle visually centred on the active number in
    // both LTR and RTL contexts.
    //
    // We intentionally side-step the logical-properties rule of this
    // codebase for these two declarations because the dial is the
    // exception called out in the same rule
    // ("RTL Icon Mirroring … Icons that imply direction mirror —
    // clock-face geometry does not").
    return (
      <span
        class={{
          'md-time-picker__dial-number': true,
          'md-time-picker__dial-number--inner': inner,
          'md-time-picker__dial-number--active': active,
        }}
        style={{
          left: `${x}%`,
          top: `${y}%`,
        }}
        data-value={String(value)}
        aria-hidden="true"
      >
        {label}
      </span>
    );
  }

  /**
   * Renders the typeable HH:MM headline tile row that's shared by
   * BOTH the dial and input variants. In dial mode the dial-face
   * still renders below; in input mode this is the entire body.
   *
   * `inlinePeriod` controls whether the 12-hour AM/PM toggle gets
   * placed inline in the same row as MM (its default — matches the
   * input variant and the dial variant's vertical orientation), or
   * is suppressed so the dialog can render the 216×38 horizontal
   * pill as a separate row below (dial variant + horizontal
   * landscape orientation). The horizontal toggle is rendered by
   * the caller in that case.
   *
   * The two `<input>` fields expose `input-hour` / `input-minute`
   * parts. The legacy `hour-display` / `minute-display` parts —
   * which used to identify the read-only `<button role="spinbutton">`
   * tiles in dial mode — were removed when both variants unified
   * around the typeable input row. Consumers that styled the old
   * parts should migrate to the new names.
   */
  private renderInputs(inlinePeriod: boolean = true) {
    const isHour = this.selecting === 'hour';
    return (
      <div class="md-time-picker__input-area" part="input-area">
        <div class="md-time-picker__input-time">
          <div class="md-time-picker__input-group">
            <input
              type="text"
              inputmode="numeric"
              autocomplete="off"
              class={{
                'md-time-picker__input': true,
                'md-time-picker__input-hour': true,
                'md-time-picker__input--active': isHour,
                'md-time-picker__input--error': this.hourInputError,
              }}
              maxLength={2}
              ref={this.bindHourInput}
              /* WAI-ARIA spinbutton: the field cycles via ArrowUp/Down
                 (bumpFocusedInput), so expose the numeric range + current
                 value. aria-valuenow is omitted while the typed buffer is
                 invalid — the current value is genuinely unknown then. */
              role="spinbutton"
              aria-valuemin={this.format === '24h' ? 0 : 1}
              aria-valuemax={this.format === '24h' ? 23 : 12}
              aria-valuenow={this.hourInputError ? undefined : this.hourValueNow}
              aria-label={this.hourLabel}
              aria-invalid={String(this.hourInputError)}
              onInput={this.onHourInput}
              onFocus={() => this.setSelecting('hour')}
              onBlur={this.onHourBlur}
              onKeyDown={this.onInputKeyDown}
              part="input-hour"
            />
            <span class="md-time-picker__input-hint">{this.hourLabel}</span>
          </div>
          <span class="md-time-picker__input-separator" aria-hidden="true">:</span>
          <div class="md-time-picker__input-group">
            <input
              type="text"
              inputmode="numeric"
              autocomplete="off"
              class={{
                'md-time-picker__input': true,
                'md-time-picker__input-minute': true,
                'md-time-picker__input--active': !isHour,
                'md-time-picker__input--error': this.minuteInputError,
              }}
              maxLength={2}
              ref={this.bindMinuteInput}
              role="spinbutton"
              aria-valuemin={0}
              aria-valuemax={59}
              aria-valuenow={this.minuteInputError ? undefined : this.minuteValueNow}
              aria-label={this.minuteLabel}
              aria-invalid={String(this.minuteInputError)}
              onInput={this.onMinuteInput}
              onFocus={() => this.setSelecting('minute')}
              onBlur={this.onMinuteBlur}
              onKeyDown={this.onInputKeyDown}
              part="input-minute"
            />
            <span class="md-time-picker__input-hint">{this.minuteLabel}</span>
          </div>
          {/* In both variants the 12h AM/PM toggle defaults to the
              52×72 (input) / 52×80 (dial) vertical pill stacked next
              to MM. The only exception is the dial variant's
              horizontal landscape dialog — there the left column
              can't fit a 52×80 pill alongside HH:MM, so we suppress
              the inline toggle and the caller renders the 216×38
              horizontal pill as a separate row below. */}
          {this.format === '12h' && inlinePeriod && this.renderPeriodToggle()}
        </div>
      </div>
    );
  }

  private renderDialog() {
    if (!this.isOpen) return null;
    const isInput = this.mode === 'input';
    // Horizontal orientation only applies to the dial variant — the
    // input variant always renders as a compact 328px portrait dialog
    // because there's no dial to balance against in the right column.
    // `effectiveOrientation` factors in the adaptive `responsive`
    // policy so a vertical preference is auto-promoted to horizontal
    // on wide viewports per the MD3 adaptive-design guideline.
    const isHorizontalDialog = !isInput && this.effectiveOrientation === 'horizontal';
    const effectivePeriodLayout = this.effectivePeriodLayout;
    const computedHeadline =
      this.headline || (isInput ? this.headlineInputLabel : this.headlineDialLabel);

    // Both variants share the same typeable HH:MM headline tile
    // row (rendered by `renderInputs`). In the input variant the
    // input-area IS the dialog body. In the dial variant we wrap
    // it in a `time-area` so the horizontal landscape layout can
    // place the 216×38 AM/PM pill below it as a separate row, and
    // so consumers / tests targeting `[part="time-area"]` still
    // resolve a node.
    //
    // `inlinePeriod` controls whether the 12-hour AM/PM toggle
    // renders inline with MM (default — vertical 52px pill) or
    // gets suppressed so the horizontal 216×38 pill can render
    // below the row in landscape dial dialogs.
    const useHorizontalPeriod =
      !isInput && this.format === '12h' && effectivePeriodLayout === 'horizontal';
    const timeArea = isInput ? null : (
      <div class="md-time-picker__time-area" part="time-area">
        {this.renderInputs(!useHorizontalPeriod)}
        {useHorizontalPeriod && this.renderPeriodToggle()}
      </div>
    );

    return (
      <div
        class="md-time-picker__scrim"
        part="scrim"
        onClick={(e) => {
          if (e.target === e.currentTarget) this.cancel();
        }}
      >
        <div
          class={{
            'md-time-picker__dialog': true,
            'md-time-picker__dialog--dial': !isInput,
            'md-time-picker__dialog--input': isInput,
            'md-time-picker__dialog--horizontal': isHorizontalDialog,
            'md-time-picker__dialog--vertical': !isHorizontalDialog,
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby={this.headlineId}
          part="dialog"
        >
          <div class="md-time-picker__headline" id={this.headlineId} part="headline">
            {computedHeadline}
          </div>

          {/* Polite live region announcing which unit is being selected
              as the dial auto-advances hour → minute (and on mode
              toggles the tiles re-seed, changing the announcement
              context). Uses the localizable hour/minute label props —
              no hardcoded English. Visually hidden via CSS. */}
          <span class="md-time-picker__sr-status" aria-live="polite">
            {this.selecting === 'hour' ? this.hourLabel : this.minuteLabel}
          </span>

          <div
            class={{
              'md-time-picker__body': true,
              'md-time-picker__body--horizontal': isHorizontalDialog,
            }}
            part="body"
          >
            {timeArea}
            {isInput ? this.renderInputs() : this.renderDial()}
          </div>

          <div class="md-time-picker__footer" part="footer">
            {/* Compose md-icon-button so the mode toggle inherits the
                full M3 icon-button system (state layer, focus ring,
                ripple, density, RTL) without reimplementing it locally. */}
            <md-icon-button
              class="md-time-picker__toggle-mode"
              variant="standard"
              size="sm"
              icon={isInput ? 'schedule' : 'keyboard'}
              aria-label={isInput ? this.toggleDialLabel : this.toggleInputLabel}
              onMdClick={this.toggleMode}
              part="toggle-mode"
            ></md-icon-button>
            <div class="md-time-picker__actions" part="actions">
              {/* Cancel / OK use md-button's text variant — the canonical
                  M3 dialog action style (no container, primary label
                  color, label-large typography). */}
              <md-button
                class="md-time-picker__action-btn"
                variant="text"
                size="sm"
                onMdClick={this.cancel}
                part="cancel-button"
              >
                {this.cancelLabel}
              </md-button>
              <md-button
                class="md-time-picker__action-btn md-time-picker__action-btn--primary"
                variant="text"
                size="sm"
                onMdClick={this.confirm}
                part="confirm-button"
              >
                {this.okLabel}
              </md-button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ───────────────────────────── RENDER ─────────────────────────────

  render() {
    return (
      <Host
        class={{
          'md-time-picker': true,
          [`md-time-picker--${this.variant}`]: true,
          [`md-time-picker--format-${this.format}`]: true,
          'md-time-picker--open': this.isOpen,
          'md-time-picker--disabled': this.isDisabled,
        }}
        onKeyDown={this.onHostKeyDown}
      >
        {this.renderTrigger()}
        {this.renderDialog()}
      </Host>
    );
  }
}
