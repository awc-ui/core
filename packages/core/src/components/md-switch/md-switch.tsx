import { AttachInternals, Component, Element, Event, EventEmitter, Host, Method, Prop, State, Watch, h } from '@stencil/core';
import {
  setFormValue,
  setValidityState,
  checkValidityOf,
  reportValidityOf,
  getValidityOf,
} from '../../utils/form';

/**
 * `md-switch` — Material Design 3 switch (on/off toggle).
 *
 * Form-associated: inside a `<form>` it submits its `value` under `name` when
 * selected, and restores on form reset. It is a *labelable* element — wrap it in
 * a `<label>` (clicks on the label text toggle it and name it), or pass
 * `aria-label` / `aria-labelledby` on the host.
 *
 * @slot selected-icon - Custom icon shown on the handle when selected (replaces
 *                        the `selected-icon` glyph). Requires `icons` or
 *                        `show-only-selected-icon`.
 * @slot unselected-icon - Custom icon shown on the handle when unselected
 *                         (replaces the `unselected-icon` glyph). Requires `icons`.
 *
 * @part track - Track container
 * @part state-layer - State-layer overlay (centered on handle)
 * @part handle - Handle (thumb)
 * @part icon - Check / close icon
 */
@Component({
  tag: 'md-switch',
  styleUrl: 'md-switch.css',
  shadow: true,
  formAssociated: true,
})
export class MdSwitch {
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
    'Please turn this on if you want to proceed.';

  /** Message set via setCustomValidity(); non-empty wins over valueMissing. */
  private customValidityMessage = '';

  /**
   * Form-association handle. The switch submits `value` under the host's `name`
   * via `setFormValue`, so it participates in `<form>` / `FormData` natively
   * (a hidden shadow `<input>` would be invisible to `FormData`).
   */
  @AttachInternals() internals!: ElementInternals;

  // ─── Public Props ──────────────────────────────────────────

  /** Whether the switch is on (selected) */
  @Prop({ mutable: true, reflect: true }) selected: boolean = false;

  /** Prevents interaction and removes from tab order */
  @Prop({ reflect: true }) disabled: boolean = false;

  /** Visually disabled but remains focusable for discoverability */
  @Prop({ reflect: true, attribute: 'soft-disabled' }) softDisabled: boolean = false;

  /** Mark the control required for form validation / assistive tech. */
  @Prop({ reflect: true }) required: boolean = false;

  /** Name submitted with the owning `<form>`. */
  @Prop({ reflect: true }) name: string = '';

  /** Value submitted when the switch is selected. */
  @Prop() value: string = 'on';

  /** Show icons on both selected and unselected states (check / close) */
  @Prop() icons: boolean = false;

  /** Show icon only when selected */
  @Prop({ attribute: 'show-only-selected-icon' }) showOnlySelectedIcon: boolean = false;

  /** Material Symbols glyph shown on the handle when selected (override the
   *  default check). Ignored when the `selected-icon` slot is filled. */
  @Prop({ attribute: 'selected-icon' }) selectedIcon: string = 'check';

  /** Material Symbols glyph shown on the handle when unselected (override the
   *  default close). Ignored when the `unselected-icon` slot is filled. */
  @Prop({ attribute: 'unselected-icon' }) unselectedIcon: string = 'close';

  /**
   * Local density rung. Drives the same `--md-sys-density-scale` signal that a
   * global `data-density` ancestor sets, so a local value simply overrides the
   * inherited one. 0 = default, -4 = ultra-compact.
   */
  @Prop({ reflect: true }) density: 0 | -1 | -2 | -3 | -4 = 0;

  // ─── Events ────────────────────────────────────────────────

  /**
   * Fires **before** the state changes. Call `event.preventDefault()` to
   * block the internal toggle and manage state externally (controlled mode).
   *
   * ```ts
   * switch.addEventListener('mdInput', (e) => {
   *   e.preventDefault();          // prevent internal toggle
   *   myState.value = e.detail.selected; // update your own state
   * });
   * ```
   */
  @Event({ cancelable: true }) mdInput: EventEmitter<{ selected: boolean }>;

  /**
   * Fires **after** the internal state has committed. Use for side effects
   * like saving preferences, analytics, or syncing with other components.
   * Not cancelable — the toggle has already happened.
   *
   * ```ts
   * switch.addEventListener('mdChange', (e) => {
   *   console.log('Switch is now', e.detail.selected ? 'ON' : 'OFF');
   * });
   * ```
   */
  @Event({ cancelable: false }) mdChange: EventEmitter<{ selected: boolean }>;

  // ─── Internal State ────────────────────────────────────────

  @State() private pressed = false;
  /** Script-initiated focus doesn't trigger :focus-visible — force the ring. */
  @State() private programmaticFocus = false;

  private initialSelected = false;

  private get isDisabled() {
    return this.disabled || this.softDisabled;
  }

  // ─── Lifecycle ─────────────────────────────────────────────
  // Because md-switch is form-associated it is a *labelable* element, so a
  // wrapping <label> both names it and forwards clicks NATIVELY — no manual
  // closest('label') wiring needed (that would double-toggle here, unlike the
  // non-form-associated md-checkbox which must hand-roll it).

  componentWillLoad() {
    this.initialSelected = this.selected;
    this.syncFormValue();
  }

  @Watch('selected')
  @Watch('value')
  onValueChange() {
    this.syncFormValue();
  }

  /** Restore the initial state when the owning form is reset. */
  formResetCallback() {
    this.selected = this.initialSelected;
  }

  // ─── Public methods ────────────────────────────────────────

  /** Programmatically focus the switch (shows the focus ring). */
  @Method()
  async setFocus() {
    this.programmaticFocus = true;
    this.el.focus();
  }

  // ─── Private ───────────────────────────────────────────────

  private syncFormValue() {
    setFormValue(this.internals, this.selected ? this.value : null);
    this.syncValidity();
  }

  /**
   * Publish `required` to the owning form. Without this the switch is
   * form-associated (its value reaches FormData) yet ALWAYS reports valid, so an
   * empty required control lets the form submit — `required` renders as a visual
   * hint and nothing more. Kept in the same place as the value sync so the two
   * can never drift.
   */
  @Watch('required')
  @Watch('valueMissingLabel')
  private syncValidity() {
    setValidityState(this.internals, {
      missing: this.required && !this.selected,
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

  private toggle = () => {
    if (this.isDisabled) return;

    const proposed = !this.selected;

    const inputEvent = this.mdInput.emit({ selected: proposed });
    if (inputEvent.defaultPrevented) return;

    this.selected = proposed;
    this.mdChange.emit({ selected: this.selected });
  };

  private handleKeyDown = (e: KeyboardEvent) => {
    if (this.isDisabled) return;
    // WAI-ARIA switch pattern: Space toggles (Enter is reserved for form
    // submission — matching md-checkbox / md-radio).
    if (e.key === ' ') {
      e.preventDefault();
      if (e.repeat) return; // ignore OS key-repeat storms
      this.pressed = true;
      this.toggle();
      setTimeout(() => { this.pressed = false; }, 150);
    }
  };

  private handlePointerDown = () => {
    if (!this.isDisabled) this.pressed = true;
  };

  private handlePointerUp = () => {
    this.pressed = false;
  };

  private handleBlur = () => {
    this.programmaticFocus = false;
  };

  // ─── Render ────────────────────────────────────────────────

  render() {
    const showSelectedIcon = this.icons || this.showOnlySelectedIcon;
    const showUnselectedIcon = this.icons;
    const showIcon = this.selected ? showSelectedIcon : showUnselectedIcon;

    return (
      <Host
        role="switch"
        aria-checked={String(this.selected)}
        aria-disabled={this.isDisabled ? 'true' : null}
        aria-required={this.required ? 'true' : null}
        tabindex={this.disabled ? '-1' : '0'}
        class={{
          'md-switch': true,
          'md-switch--selected': this.selected,
          'md-switch--disabled': this.disabled || this.softDisabled,
          'md-switch--pressed': this.pressed,
          'md-switch--with-icon': showIcon,
          'md-switch--focus-ring': this.programmaticFocus,
        }}
        onClick={this.toggle}
        onKeyDown={this.handleKeyDown}
        onPointerDown={this.handlePointerDown}
        onPointerUp={this.handlePointerUp}
        onPointerLeave={this.handlePointerUp}
        onPointerCancel={this.handlePointerUp}
        onBlur={this.handleBlur}
      >
        <div class="md-switch__track" part="track">
          <div class="md-switch__handle-container">
            <span class="md-switch__state-layer" part="state-layer" aria-hidden="true"></span>
            <span class="md-switch__handle" part="handle">
              {showIcon && (this.selected ? (
                <slot name="selected-icon">
                  <span class="md-switch__icon material-symbols-outlined" part="icon" aria-hidden="true">
                    {this.selectedIcon}
                  </span>
                </slot>
              ) : (
                <slot name="unselected-icon">
                  <span class="md-switch__icon material-symbols-outlined" part="icon" aria-hidden="true">
                    {this.unselectedIcon}
                  </span>
                </slot>
              ))}
            </span>
          </div>
        </div>
      </Host>
    );
  }
}
