import { AttachInternals, Component, Element, Event, EventEmitter, Host, Method, Prop, State, Watch, h } from '@stencil/core';
import { RadioElement } from '../../utils/types';
import { triggerRipple } from '../../utils/ripple';
import {
  setFormValue,
  setValidityState,
  checkValidityOf,
  reportValidityOf,
  getValidityOf,
} from '../../utils/form';

@Component({
  tag: 'md-radio',
  styleUrl: 'md-radio.css',
  shadow: true,
  formAssociated: true,
})
export class MdRadio {
  @Element() el!: HTMLElement;

  /**
   * Form-association handle. Radios previously declared `name`/`value` but were
   * NOT form-associated, so a checked radio never reached FormData at all — the
   * group looked wired up and submitted nothing.
   */
  @AttachInternals() internals!: ElementInternals;


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
    'Please select one of these options.';

  /** Message set via setCustomValidity(); non-empty wins over valueMissing. */
  private customValidityMessage = '';

  /** Drives aria-invalid on the host. */
  @State() private invalid = false;

  /** `checked` at first render, restored on form reset (native radio behaviour). */
  private defaultChecked = false;

  // ─── Public Props ──────────────────────────────────────────

  /** Whether the radio button is selected */
  @Prop({ mutable: true, reflect: true }) checked: boolean = false;

  /** Disables the radio button */
  @Prop({ reflect: true }) disabled: boolean = false;

  /** Soft-disabled: disabled visuals but remains focusable for discoverability */
  @Prop({ reflect: true, attribute: 'soft-disabled' }) softDisabled: boolean = false;

  /** Whether the radio is required in a form */
  @Prop({ reflect: true }) required: boolean = false;

  /** Form name — radios sharing a name form an exclusive group */
  @Prop({ reflect: true }) name: string = '';

  /** Form value submitted when checked */
  @Prop({ reflect: true }) value: string = '';

  /**
   * Local density rung. Drives the same `--md-sys-density-scale` signal that a
   * global `data-density` ancestor sets, so a local value simply overrides the
   * inherited one. 0 = default, -4 = ultra-compact.
   */
  @Prop({ reflect: true }) density: 0 | -1 | -2 | -3 | -4 = 0;

  // ─── Events ────────────────────────────────────────────────

  /** Emits when the checked state changes via user interaction */
  @Event() mdChange: EventEmitter<{ checked: boolean; value: string }>;

  /** Emits when the radio receives focus */
  @Event() mdFocus: EventEmitter<void>;

  /** Emits when the radio loses focus */
  @Event() mdBlur: EventEmitter<void>;

  // ─── Internal State ────────────────────────────────────────

  @State() private pressed = false;
  @State() private focused = false;
  @State() private programmaticFocus = false;
  @State() private managedTabIndex = '0';

  private parentLabel: HTMLLabelElement | null = null;

  private get isDisabled() {
    return this.disabled || this.softDisabled;
  }

  // ─── Lifecycle ─────────────────────────────────────────────

  connectedCallback() {
    this.parentLabel = this.el.closest('label');
    this.parentLabel?.addEventListener('click', this.handleLabelClick);
  }

  componentWillLoad() {
    this.defaultChecked = this.checked;
    this.syncFormValue();
  }

  componentDidLoad() {
    this.updateRovingTabIndex();
    // Group validity depends on SIBLINGS, which may not have upgraded when this
    // radio first rendered. Re-sync once the whole group exists, or a group
    // whose pre-checked member upgraded last would report itself empty.
    this.syncGroupValidity();
  }

  disconnectedCallback() {
    this.parentLabel?.removeEventListener('click', this.handleLabelClick);
    this.parentLabel = null;
  }

  // ─── Watchers ──────────────────────────────────────────────

  @Watch('checked')
  onCheckedChange(newVal: boolean) {
    if (newVal) {
      this.uncheckOthers(this.el);
    }
    this.updateRovingTabIndex();
    this.syncFormValue();
    // Runs for BOTH directions. Checking this radio satisfies `required` for
    // every member of the group; unchecking the last one must put the group
    // back into valueMissing. Either way every member re-publishes, not just
    // this one, because validity here is a property of the group.
    this.syncGroupValidity();
  }

  @Watch('required')
  @Watch('name')
  @Watch('valueMissingLabel')
  onValidityInputChange() {
    this.syncGroupValidity();
  }

  /** Only the checked member of a name group submits — native radio semantics. */
  private syncFormValue() {
    setFormValue(this.internals, this.checked ? this.value || 'on' : null);
  }

  /** True when any radio sharing this name is checked. */
  private get groupHasSelection(): boolean {
    if (!this.name) return this.checked;
    const root = this.el.getRootNode() as Document | ShadowRoot;
    return Array.from(root.querySelectorAll(`md-radio[name="${this.name}"]`)).some((r) => {
      const el = r as Element & { checked?: boolean };
      // The PROPERTY is authoritative once the element has upgraded. The
      // reflected `checked` attribute lags by a render, so reading it (or
      // OR-ing it in) reports a just-unchecked radio as still checked — the
      // group then looks satisfied, `required` never republishes valueMissing,
      // and the form submits empty. Fall back to the attribute only for an
      // element that has not upgraded yet, where the property does not exist.
      return typeof el.checked === 'boolean' ? el.checked : r.hasAttribute('checked');
    });
  }

  /**
   * True when ANY radio in the group is marked required.
   *
   * Per the HTML spec `required` on a single radio makes the whole GROUP
   * required, and every member then suffers valueMissing — not just the one
   * carrying the attribute. Reading it per-element meant a screen-reader user
   * landing on a sibling heard nothing wrong, and that sibling's own
   * checkValidity() disagreed with the form's.
   */
  private get groupIsRequired(): boolean {
    if (this.required) return true;
    if (!this.name) return false;
    const root = this.el.getRootNode() as Document | ShadowRoot;
    return Array.from(root.querySelectorAll(`md-radio[name="${this.name}"]`)).some((r) =>
      r.hasAttribute('required'),
    );
  }

  private syncValidity() {
    // See md-checkbox: WCAG 3.3.1 requires the invalid state to be exposed
    // programmatically. For a radio the condition is a GROUP property, so every
    // member reports invalid while the group has no selection — which is what a
    // screen reader user hears whichever member they land on.
    this.invalid = this.customValidityMessage
      ? true
      : this.groupIsRequired && !this.groupHasSelection;
    setValidityState(this.internals, {
      missing: this.groupIsRequired && !this.groupHasSelection,
      missingMessage: this.valueMissingLabel,
      customMessage: this.customValidityMessage,
    });
      this.emitValidityChange();
  }

  /** Re-publish validity for every radio in the group. */
  private syncGroupValidity() {
    this.syncValidity();
    if (!this.name) return;
    const root = this.el.getRootNode() as Document | ShadowRoot;
    root.querySelectorAll(`md-radio[name="${this.name}"]`).forEach((r) => {
      if (r !== this.el) (r as unknown as { syncValidityFromGroup?: () => void }).syncValidityFromGroup?.();
    });
  }

  /**
   * Group-coordination hook. Sibling radios call this so the whole group agrees
   * on validity; exposed as a @Method because a sibling can only reach this
   * component through its public element interface.
   */
  @Method()
  async syncValidityFromGroup() {
    this.syncValidity();
  }

  /** Restore the initial selection when the owning form is reset. */
  formResetCallback() {
    this.checked = this.defaultChecked;
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

  @Method()
  async reportValidity(): Promise<boolean> {
    return reportValidityOf(this.internals);
  }

  @Method()
  async setCustomValidity(message: string) {
    this.customValidityMessage = message;
    this.syncValidity();
  }

  @Watch('disabled')
  onDisabledChange() {
    this.updateRovingTabIndex();
  }

  // ─── Public Methods ────────────────────────────────────────

  /** Programmatically focus the radio */
  @Method()
  async setFocus() {
    // Script-initiated focus does not trigger :focus-visible, so flag it
    // explicitly to render the focus ring.
    this.programmaticFocus = true;
    this.el.focus();
  }

  /** Programmatically blur the radio */
  @Method()
  async setBlur() {
    this.el.blur();
  }

  /**
   * Programmatically select this radio and uncheck siblings.
   * Emits mdChange like a user interaction.
   */
  @Method()
  async select() {
    if (this.isDisabled || this.checked) return;
    this.checked = true;
    this.mdChange.emit({ checked: true, value: this.value });
  }

  // ─── Private — Roving tabindex (WAI-ARIA Radio Group) ─────

  /**
   * WAI-ARIA: only the active radio in a group receives Tab focus.
   *  - checked radio → tabindex 0
   *  - no radio checked → first enabled radio → tabindex 0
   *  - all others → tabindex -1
   *  - disabled → always tabindex -1
   *  - no name (standalone) → tabindex 0
   */
  private updateRovingTabIndex() {
    if (this.disabled) {
      this.managedTabIndex = '-1';
      return;
    }
    if (this.checked) {
      this.managedTabIndex = '0';
      return;
    }
    if (!this.name) {
      this.managedTabIndex = '0';
      return;
    }

    const root = this.el.getRootNode() as Document | ShadowRoot;
    const siblings = Array.from(root.querySelectorAll(`md-radio[name="${this.name}"]`));

    const anyChecked = siblings.some(s => s !== this.el && (s as unknown as RadioElement).checked);
    if (anyChecked) {
      this.managedTabIndex = '-1';
      return;
    }

    const firstEnabled = siblings.find(s => !(s as unknown as RadioElement).disabled);
    this.managedTabIndex = firstEnabled === this.el ? '0' : '-1';
  }

  // ─── Private — Handlers ───────────────────────────────────

  private handleLabelClick = (e: MouseEvent) => {
    if (!e.composedPath().includes(this.el)) {
      this.handleClick();
    }
  };

  private handleClick = () => {
    if (this.isDisabled || this.checked) return;
    this.checked = true;
    this.mdChange.emit({ checked: true, value: this.value });
  };

  private handleKeyDown = (e: KeyboardEvent) => {
    if (this.isDisabled) return;

    if (e.key === ' ') {
      e.preventDefault();
      this.pressed = true;
      this.handleClick();
      triggerRipple(this.el);
      setTimeout(() => { this.pressed = false; }, 150);
      return;
    }

    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault();
      this.focusSibling(1);
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault();
      this.focusSibling(-1);
    }
  };

  private handleFocus = () => {
    this.focused = true;
    this.mdFocus.emit();
  };

  private handleBlur = () => {
    this.focused = false;
    this.programmaticFocus = false;
    this.mdBlur.emit();
  };

  private handlePointerDown = () => {
    // Pointer interaction should not keep the programmatic focus ring.
    this.programmaticFocus = false;
    if (!this.isDisabled) this.pressed = true;
  };

  private handlePointerUp = () => {
    this.pressed = false;
  };

  // ─── Private — Group management ───────────────────────────

  /** Uncheck all radios in the group except the given element */
  private uncheckOthers(keepChecked: HTMLElement) {
    if (!this.name) return;
    const root = this.el.getRootNode() as Document | ShadowRoot;
    const siblings = root.querySelectorAll(`md-radio[name="${this.name}"]`);
    siblings.forEach((sibling) => {
      if (sibling !== keepChecked && sibling.hasAttribute('checked')) {
        sibling.removeAttribute('checked');
      }
    });
  }

  /**
   * Focus next/previous sibling radio in the group.
   * Arrow keys move focus AND check the newly focused button (WAI-ARIA).
   * Skips disabled and soft-disabled radios.
   */
  private focusSibling(direction: 1 | -1) {
    if (!this.name) return;
    const root = this.el.getRootNode() as Document | ShadowRoot;
    const siblings = Array.from(root.querySelectorAll(`md-radio[name="${this.name}"]`)) as HTMLElement[];
    const enabled = siblings.filter(s => !s.hasAttribute('disabled') && !s.hasAttribute('soft-disabled'));
    if (enabled.length === 0) return;

    const idx = enabled.indexOf(this.el);
    const next = (idx + direction + enabled.length) % enabled.length;
    const target = enabled[next];
    target.focus();
    target.setAttribute('checked', '');
    triggerRipple(target);
    target.dispatchEvent(new CustomEvent('mdChange', {
      detail: { checked: true, value: target.getAttribute('value') || '' },
      bubbles: true,
      composed: true,
    }));
  }

  // ─── Render ────────────────────────────────────────────────

  render() {
    const isEffectivelyDisabled = this.isDisabled;

    return (
      <Host
        class={{
          'md-radio': true,
          'md-radio--checked': this.checked,
          'md-radio--unchecked': !this.checked,
          'md-radio--disabled': isEffectivelyDisabled,
          'md-radio--pressed': this.pressed,
          'md-radio--focused': this.focused,
          'md-radio--focus-ring': this.programmaticFocus,
        }}
        role="radio"
        aria-invalid={this.invalid ? 'true' : undefined}
        aria-checked={String(this.checked)}
        aria-disabled={isEffectivelyDisabled ? 'true' : undefined}
        aria-required={this.required ? 'true' : undefined}
        tabindex={this.managedTabIndex}
        onClick={this.handleClick}
        onKeyDown={this.handleKeyDown}
        onFocus={this.handleFocus}
        onBlur={this.handleBlur}
        onPointerDown={this.handlePointerDown}
        onPointerUp={this.handlePointerUp}
        onPointerLeave={this.handlePointerUp}
        onPointerCancel={this.handlePointerUp}
      >
        <span class="md-radio__ripple-layer" aria-hidden="true">
          <md-ripple disabled={isEffectivelyDisabled}></md-ripple>
        </span>
        <span class="md-radio__state-layer" part="state-layer" aria-hidden="true"></span>

        <span class="md-radio__container" part="container" aria-hidden="true">
          <span class="md-radio__outer" part="outer-circle"></span>
          <span class="md-radio__inner" part="inner-circle"></span>
        </span>

        <input
          type="radio"
          class="md-radio__native"
          checked={this.checked}
          disabled={this.disabled}
          required={this.required}
          name={this.name}
          value={this.value}
          aria-hidden="true"
          tabindex="-1"
          onChange={() => {}}
        />
      </Host>
    );
  }
}
