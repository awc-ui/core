import { AttachInternals, Component, Element, Event, EventEmitter, Host, Method, Prop, State, Watch, h } from '@stencil/core';
import { triggerRipple } from '../../utils/ripple';
import {
  setFormValue,
  setValidityState,
  checkValidityOf,
  reportValidityOf,
  getValidityOf,
} from '../../utils/form';

/**
 * `md-checkbox` — Material Design 3 checkbox (with tri-state / indeterminate).
 *
 * Form-associated: inside a `<form>` it submits its `value` under `name` when
 * checked, and restores on form reset. It is a *labelable* element — wrap it in
 * a `<label>` (clicks on the label text toggle it AND give it its accessible
 * name natively), or pass `aria-label` / `aria-labelledby` on the host. A bare,
 * unlabeled checkbox has no accessible name (axe `aria-toggle-field-name`).
 *
 * @part state-layer - State-layer overlay
 * @part container - Box container that holds the icon
 * @part icon - Checkmark / indeterminate-dash SVG
 */
@Component({
  tag: 'md-checkbox',
  styleUrl: 'md-checkbox.css',
  shadow: true,
  formAssociated: true,
})
export class MdCheckbox {
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
    'Please check this box if you want to proceed.';

  /** Message set via setCustomValidity(); non-empty wins over valueMissing. */
  private customValidityMessage = '';

  /** Stable id so the supporting line can be referenced by aria-describedby. */
  private uid = `md-checkbox-${Math.random().toString(36).slice(2, 7)}`;

  /** Drives aria-invalid on the host. */
  @State() private invalid = false;

  /** Show the supporting line in the error colour. */
  @Prop({ reflect: true }) error: boolean = false;

  /**
   * Supporting / error message shown beneath the control.
   *
   * A checkbox previously had nowhere to put a message, so a failed `required`
   * could only surface as the browser's own validation balloon — visually
   * unrelated to the field, and gone the moment you click away. This gives it
   * the same inline supporting line md-text-field has.
   *
   * The host is a fixed-size touch target, so the line is positioned OUT of
   * that box rather than laid out inside it; see the CSS for why that cannot
   * simply be a flex child.
   */
  @Prop({ attribute: 'error-text', mutable: true }) errorText: string = '';

  /** Supporting text shown when there is no error. */
  @Prop({ attribute: 'supporting-text' }) supportingText: string = '';

  /**
   * Form-association handle. The checkbox submits `value` under the host's
   * `name` via `setFormValue`, so it participates in `<form>` / `FormData`
   * natively. A hidden shadow `<input>` was previously used but a shadow-DOM
   * form control is invisible to the outer form's `FormData` AND nests a native
   * checkbox inside the `role="checkbox"` host (axe `nested-interactive`).
   */
  @AttachInternals() internals!: ElementInternals;

  /** Whether the checkbox is checked */
  @Prop({ mutable: true, reflect: true }) checked: boolean = false;

  /** Whether the checkbox is in the indeterminate (mixed) state */
  @Prop({ mutable: true, reflect: true }) indeterminate: boolean = false;

  /** Disables the checkbox */
  @Prop({ reflect: true }) disabled: boolean = false;

  /** Soft-disabled: disabled visuals but remains focusable for discoverability */
  @Prop({ reflect: true, attribute: 'soft-disabled' }) softDisabled: boolean = false;

  /** Whether the checkbox is required in a form */
  @Prop({ reflect: true }) required: boolean = false;

  /** Form name */
  @Prop() name: string = '';

  /** Form value submitted when checked */
  @Prop() value: string = 'on';

  /**
   * Local density rung. Drives the same `--md-sys-density-scale` signal that a
   * global `data-density` ancestor sets, so a local value simply overrides the
   * inherited one. 0 = default, -4 = ultra-compact.
   */
  @Prop({ reflect: true }) density: 0 | -1 | -2 | -3 | -4 = 0;

  /** Emits when checked or indeterminate state changes */
  @Event() mdChange: EventEmitter<{ checked: boolean; indeterminate: boolean }>;

  @State() private prevChecked: boolean = false;
  @State() private prevIndeterminate: boolean = false;
  @State() private pressed = false;

  private initialChecked = false;
  private initialIndeterminate = false;

  private get isDisabled() {
    return this.disabled || this.softDisabled;
  }

  // md-checkbox is form-associated, so it is a *labelable* element: a wrapping
  // <label> forwards clicks and names it NATIVELY — no manual closest('label')
  // wiring (which would double-toggle, since the native label click already
  // reaches the host).

  componentWillLoad() {
    this.initialChecked = this.checked;
    this.initialIndeterminate = this.indeterminate;
    this.syncFormValue();
  }

  @Watch('checked')
  @Watch('indeterminate')
  onStateChange() {
    this.prevChecked = this.checked;
    this.prevIndeterminate = this.indeterminate;
    this.syncFormValue();
  }

  @Watch('value')
  onValueChange() {
    this.syncFormValue();
  }

  /** Restore the initial checked / indeterminate state when the form resets. */
  formResetCallback() {
    this.checked = this.initialChecked;
    this.indeterminate = this.initialIndeterminate;
  }

  private syncFormValue() {
    // Indeterminate is a visual state only; `checked` alone decides submission.
    setFormValue(this.internals, this.checked ? this.value : null);
    this.syncValidity();
  }

  /**
   * Publish `required` to the owning form. Without this the checkbox is
   * form-associated (its value reaches FormData) yet ALWAYS reports valid, so an
   * empty required control lets the form submit — `required` renders as a visual
   * hint and nothing more. Kept in the same place as the value sync so the two
   * can never drift.
   */
  @Watch('required')
  @Watch('valueMissingLabel')
  private syncValidity() {
    // Mirror the computed validity into state so the host can expose
    // aria-invalid. WCAG 3.3.1 (Error Identification, Level A): a control that
    // is invalid must SAY SO programmatically, not just look wrong. This host
    // carries role="checkbox", so aria-invalid belongs on it. Error TEXT stays
    // the app's to render and link with aria-describedby on this host (it is a
    // light-DOM element, so that association works without our help) — the
    // component does not own the label and should not own the message.
    this.invalid = this.required && !this.checked && !this.customValidityMessage
      ? true
      : !!this.customValidityMessage;
    setValidityState(this.internals, {
      missing: this.required && !this.checked,
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

  private handleClick = () => {
    if (this.isDisabled) return;

    this.prevChecked = this.checked;
    this.prevIndeterminate = this.indeterminate;

    if (this.indeterminate) {
      this.indeterminate = false;
      this.checked = true;
    } else {
      this.checked = !this.checked;
    }

    this.mdChange.emit({ checked: this.checked, indeterminate: this.indeterminate });
  };

  private handleKeyDown = (e: KeyboardEvent) => {
    if (this.isDisabled) return;
    if (e.key === ' ') {
      e.preventDefault();
      this.pressed = true;
      triggerRipple(this.el);
      this.handleClick();
      setTimeout(() => { this.pressed = false; }, 150);
    }
  };

  private handlePointerDown = () => {
    if (!this.isDisabled) this.pressed = true;
  };

  private handlePointerUp = () => {
    this.pressed = false;
  };

  private get ariaCheckedValue(): string {
    if (this.indeterminate) return 'mixed';
    return String(this.checked);
  }

  render() {
    const isEffectivelyDisabled = this.isDisabled;
    const isSelected = this.checked || this.indeterminate;
    /* A checkbox authored `aria-hidden="true"` is a purely decorative
       indicator (e.g. an M3 list-row selection glyph mirroring the row's
       state — the row click owns the real toggle). It must NOT be focusable:
       a focusable `role="checkbox"` nested inside an interactive row
       (`role="option"`/`button`) trips axe `nested-interactive`, and an
       aria-hidden element in the tab order trips `aria-hidden-focus`. Note a
       `tabindex="-1"` is NOT enough — nested-interactive flags any focusable
       (tabindex present) widget descendant "even with aria-hidden" — so the
       attribute is dropped entirely, leaving the host non-focusable. */
    const decorative = this.el.getAttribute('aria-hidden') === 'true';

    return (
      <Host
        class={{
          'md-checkbox': true,
          'md-checkbox--checked': this.checked && !this.indeterminate,
          'md-checkbox--indeterminate': this.indeterminate,
          'md-checkbox--disabled': isEffectivelyDisabled,
          'md-checkbox--selected': isSelected,
          'md-checkbox--unselected': !isSelected,
          'md-checkbox--pressed': this.pressed,
          'md-checkbox--prev-unselected': !this.prevChecked && !this.prevIndeterminate,
          'md-checkbox--has-support': !!(this.errorText || this.supportingText),
        }}
        role="checkbox"
        aria-invalid={this.invalid ? 'true' : undefined}
        aria-describedby={this.errorText || this.supportingText ? `${this.uid}-support` : undefined}
        aria-checked={this.ariaCheckedValue}
        aria-disabled={isEffectivelyDisabled ? 'true' : undefined}
        aria-required={this.required ? 'true' : undefined}
        tabindex={decorative ? null : this.disabled ? '-1' : '0'}
        onPointerDown={this.handlePointerDown}
        onPointerUp={this.handlePointerUp}
        onPointerLeave={this.handlePointerUp}
        onPointerCancel={this.handlePointerUp}
        onClick={this.handleClick}
        onKeyDown={this.handleKeyDown}
      >
        <span class="md-checkbox__target" part="target">
          <span class="md-checkbox__ripple-layer" aria-hidden="true">
          <md-ripple disabled={isEffectivelyDisabled}></md-ripple>
        </span>
        <span class="md-checkbox__state-layer" part="state-layer" aria-hidden="true"></span>

        <span class="md-checkbox__container" part="container">
          {/* Material Symbols glyphs — the same `check` md-step draws for a
              completed step, so the two components' marks are identical rather
              than merely similar. (This replaced a hand-drawn SVG path whose
              stroke geometry never quite matched the font face.) */}
          <span class="md-checkbox__icon" part="icon" aria-hidden="true">
            <span class="material-symbols-outlined">
              {this.indeterminate ? 'remove' : 'check'}
            </span>
          </span>
        </span>
        </span>

{(this.errorText || this.supportingText) && (
          <span
            id={`${this.uid}-support`}
            part="supporting-text"
            role={this.error ? 'alert' : undefined}
            class={{
              'md-checkbox__support': true,
              'md-checkbox__support--error': this.error,
            }}
          >
            {this.errorText || this.supportingText}
          </span>
        )}

      </Host>
    );
  }
}
