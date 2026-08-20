import { AttachInternals, Component, Element, Event, EventEmitter, Host, Method, Prop, State, VNode, Watch, h } from '@stencil/core';
import {
  setFormValue,
  setValidityState,
  checkValidityOf,
  reportValidityOf,
  getValidityOf,
} from '../../utils/form';

/** Detail for `mdComplete` — fired when every cell is filled. */
export interface MdOtpFieldCompleteDetail {
  /** The complete, sanitized code. */
  value: string;
}

/** Detail for `mdInvalidInput` — fired when characters are rejected by the charset filter. */
export interface MdOtpFieldInvalidDetail {
  /** The raw attempted string, BEFORE whitespace-stripping / filtering. */
  attempted: string;
  /** Where the rejected characters came from. */
  reason: 'input-change' | 'input-paste';
}

/** Detail for `mdValidityChange` — mirrors the shared form-control contract. */
export interface MdOtpFieldValidityDetail {
  valid: boolean;
  validationMessage: string;
  flags: Record<string, boolean>;
}

/**
 * `md-otp-field` — Material Design 3 one-time-code field.
 *
 * Renders `length` real `<input>` cells in its own shadow root (it OWNS its
 * inputs, so every cell carries full ARIA), pipes all entry — typing, paste,
 * SMS autofill — through one sanitizing pipeline (strip whitespace →
 * `transform` → `validationType` charset filter → clamp to `length`), and
 * participates in forms via `ElementInternals` (no hidden input).
 *
 * The value is a CONTIGUOUS string: clearing a cell shifts the characters
 * after it left (there are no holes), and a character typed into an empty
 * cell beyond the fill point lands at the first empty position.
 *
 * Normalization is declarative: `transform` names the casing rule as an
 * attribute value rather than taking a callback, so the rule is authorable
 * from plain HTML and survives SSR — an element attribute cannot carry a
 * function.
 */
@Component({
  tag: 'md-otp-field',
  styleUrl: 'md-otp-field.css',
  shadow: true,
  formAssociated: true,
})
export class MdOtpField {
  @Element() el!: HTMLElement;

  /**
   * Form-association handle. The field submits `value` under `name` via
   * `setFormValue`, publishes `valueMissing`/incomplete validity, and anchors
   * `reportValidity()` bubbles at the first cell.
   */
  @AttachInternals() internals!: ElementInternals;

  /** Number of character cells. */
  @Prop() length: number = 6;

  /**
   * The current code. Mutable, deliberately NOT reflected — entered codes
   * must never appear as a DOM attribute (value privacy, like md-text-field).
   * Programmatic writes run through the same sanitizing pipeline as typing.
   */
  @Prop({ mutable: true }) value: string = '';

  /** Which characters are accepted. `none` accepts anything (still whitespace-stripped). */
  @Prop({ attribute: 'validation-type' }) validationType: 'numeric' | 'alpha' | 'alphanumeric' | 'none' = 'numeric';

  /**
   * Case normalization as an attribute value, not a callback (attributes
   * can't carry functions): `uppercase` upper-cases every accepted character
   * (recovery-code entry).
   */
  @Prop() transform: 'none' | 'uppercase' = 'none';

  /** Obscure the entered characters (cells render as `type="password"`). */
  @Prop() mask: boolean = false;

  /** Submit the owning form (`requestSubmit()`) when the code becomes complete. */
  @Prop({ attribute: 'auto-submit' }) autoSubmit: boolean = false;

  /** Chunk the cells into groups of this size with a separator between groups. 0 = ungrouped. */
  @Prop({ attribute: 'group-size' }) groupSize: number = 0;

  /**
   * Virtual-keyboard hint override. Empty derives from `validationType`
   * (`numeric` → `numeric`, everything else → `text`).
   */
  @Prop({ attribute: 'inputmode' }) inputMode: string = '';

  /** Form field name — ElementInternals submits the code under it. */
  @Prop({ reflect: true }) name: string = '';

  /** Disables every cell. */
  @Prop({ reflect: true }) disabled: boolean = false;

  /** Value not user-changeable; cells stay focusable and arrow-navigable. */
  @Prop({ attribute: 'readonly' }) readOnly: boolean = false;

  /** The code must be complete before the owning form submits. */
  @Prop() required: boolean = false;

  /** Error visual state — colors cells and swaps supporting text to `errorText`. */
  @Prop() error: boolean = false;

  /** Translatable error message; replaces `supportingText` while `error` is true. */
  @Prop({ attribute: 'error-text' }) errorText: string = '';

  /** Translatable supporting text shown under the cells. */
  @Prop({ attribute: 'supporting-text' }) supportingText: string = '';

  /** Accessible group label (translatable). Rendered as `aria-label` on the cell group. */
  @Prop() label: string = 'One-time code';

  /**
   * Per-cell `aria-label` template (translatable). `{index}` is 1-based,
   * `{length}` is the cell count.
   */
  @Prop({ attribute: 'cell-label-template' }) cellLabelTemplate: string = 'Character {index} of {length}';

  /** Translatable constraint-validation message when `required` and empty. */
  @Prop({ attribute: 'value-missing-label' }) valueMissingLabel: string = 'Please enter the complete code.';

  /**
   * When non-empty AND `required`, a started-but-incomplete code is also
   * invalid, reported with this message. Empty (default) = only a fully empty
   * required field blocks submission.
   */
  @Prop({ attribute: 'incomplete-label' }) incompleteLabel: string = '';

  /**
   * Local density rung. Drives the same `--md-sys-density-scale` signal a
   * global `data-density` ancestor sets; local wins. 0 = default, -4 = compact.
   */
  @Prop({ reflect: true }) density: 0 | -1 | -2 | -3 | -4 = 0;

  /** Always reserve the supporting-text line so error text causes no layout jump. */
  @Prop({ attribute: 'reserve-supporting-space' }) reserveSupportingSpace: boolean = false;

  /** Fires on every value change from user input (typing, clearing, paste, autofill). */
  @Event() mdInput!: EventEmitter<string>;

  /** Commit event: fires when the code becomes complete and when focus leaves the whole group. */
  @Event() mdChange!: EventEmitter<string>;

  /** Fires when every cell is filled. A complete paste re-fires it even if the value is unchanged. */
  @Event() mdComplete!: EventEmitter<MdOtpFieldCompleteDetail>;

  /** Fires when typed/pasted characters are rejected by the `validationType` charset. */
  @Event() mdInvalidInput!: EventEmitter<MdOtpFieldInvalidDetail>;

  /**
   * Fires when this control's validity CHANGES — never on mount, never for a
   * re-publish landing on the same state. `composed: false` by the library
   * convention: each control reports only for itself; `bubbles: true` still
   * reaches `<form>`-level listeners in the same DOM tree.
   */
  @Event({ bubbles: true, composed: false }) mdValidityChange!: EventEmitter<MdOtpFieldValidityDetail>;

  /** Ancestor `<fieldset disabled>` / form-disabled state (formDisabledCallback). */
  @State() private formDisabled = false;

  private inputEls: (HTMLInputElement | undefined)[] = [];
  private cellsEl?: HTMLElement;
  private uid = `md-otp-field-${Math.random().toString(36).slice(2, 7)}`;
  private customValidityMessage = '';
  /** Last committed value — mdChange only fires when the value moved past this. */
  private lastCommitted = '';
  /** Last emitted validity, so a re-publish that changes nothing stays silent. */
  private lastValidityKey: string | null = null;

  private get isDisabled(): boolean {
    return this.disabled || this.formDisabled;
  }

  /** `length` hardened against zero/negative/fractional authoring. */
  private get cellCount(): number {
    const n = Math.floor(this.length);
    return Number.isFinite(n) && n > 0 ? n : 1;
  }

  private get chars(): string[] {
    const out: string[] = [];
    for (let i = 0; i < this.cellCount; i++) out.push(this.value.charAt(i) || '');
    return out;
  }

  private get effectiveInputMode(): string {
    return this.inputMode || (this.validationType === 'numeric' ? 'numeric' : 'text');
  }

  componentWillLoad() {
    // Normalize any authored initial value through the same pipeline as user
    // input. @Watch is inert before load, so sync explicitly.
    const { clean } = this.sanitize(this.value ?? '');
    if (clean !== this.value) this.value = clean;
    this.lastCommitted = this.value;
    this.syncFormState();
  }

  componentDidLoad() {
    // Re-publish validity now that the cell refs exist: the willLoad publish
    // had no anchor, and reportValidity() needs a FOCUSABLE anchor (the first
    // cell) or the browser silently shows no bubble. Same validity state, so
    // emitValidityChange stays silent.
    this.syncValidity();
  }

  @Watch('value')
  onValueChanged() {
    // The pipeline is idempotent, so re-sanitizing a value the component set
    // itself is a no-op; a programmatic write of dirty input gets cleaned and
    // re-enters this watch once with the clean string.
    const { clean } = this.sanitize(this.value ?? '');
    if (clean !== this.value) {
      this.value = clean;
      return;
    }
    this.syncFormState();
  }

  @Watch('length')
  @Watch('validationType')
  @Watch('transform')
  onPipelineChanged() {
    const { clean } = this.sanitize(this.value ?? '');
    if (clean !== this.value) {
      this.value = clean; // watch above re-syncs
    } else {
      this.syncFormState();
    }
  }

  @Watch('required')
  @Watch('valueMissingLabel')
  @Watch('incompleteLabel')
  onValidityInputsChanged() {
    this.syncValidity();
  }

  /** Form reset clears the code — one-time codes are transient by nature. */
  formResetCallback() {
    this.value = '';
    this.lastCommitted = '';
  }

  /** Ancestor form/fieldset disabling. State write deferred — Stencil forbids sync writes here. */
  formDisabledCallback(disabled: boolean) {
    queueMicrotask(() => {
      this.formDisabled = disabled;
    });
  }

  /** Browser session restore. */
  formStateRestoreCallback(state: unknown) {
    if (typeof state === 'string') {
      this.value = this.sanitize(state).clean;
    }
  }

  /** Focus the first empty cell (or the last cell when the code is complete). */
  @Method()
  async setFocus() {
    const firstEmpty = this.chars.findIndex((c) => !c);
    this.focusCell(firstEmpty === -1 ? this.cellCount - 1 : firstEmpty);
  }

  /** Clear the code programmatically (no `mdInput`/`mdChange` — programmatic writes stay silent). */
  @Method()
  async clear() {
    this.value = '';
    this.lastCommitted = '';
  }

  /** Current validity: boolean, message and flags. Mirrors md-text-field. */
  @Method()
  async getValidity(): Promise<MdOtpFieldValidityDetail> {
    return getValidityOf(this.internals);
  }

  /** App/server-side validation: a non-empty message marks the control invalid until cleared with `''`. */
  @Method()
  async setCustomValidity(message: string) {
    this.customValidityMessage = message;
    this.syncValidity();
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

  /**
   * The one value pipeline every entry path shares — typing, paste, autofill,
   * programmatic writes, authored attributes: strip whitespace → `transform`
   * → filter by the `validationType` charset → clamp to `length`. `rejected`
   * is true when the charset filter dropped characters (clamping is silent).
   */
  private sanitize(raw: string): { clean: string; rejected: boolean } {
    const stripped = String(raw ?? '').replace(/\s+/g, '');
    const transformed = this.transform === 'uppercase' ? stripped.toUpperCase() : stripped;
    let kept = transformed;
    if (this.validationType === 'numeric') kept = transformed.replace(/[^0-9]/g, '');
    else if (this.validationType === 'alpha') kept = transformed.replace(/[^a-zA-Z]/g, '');
    else if (this.validationType === 'alphanumeric') kept = transformed.replace(/[^0-9a-zA-Z]/g, '');
    return { clean: kept.slice(0, this.cellCount), rejected: kept.length !== transformed.length };
  }

  private syncFormState() {
    // Empty submits NO entry (null) — an absent code should be absent from
    // FormData, unlike text fields where `x=` matches the native input.
    setFormValue(this.internals, this.value || null);
    this.syncValidity();
  }

  private syncValidity() {
    const len = this.value.length;
    const missing = this.required && len === 0;
    // Incomplete-but-started handling: reported through the shared helper's
    // `missing` channel (flag: valueMissing) with `incompleteLabel` as the
    // message — utils/form.ts deliberately exposes no badInput channel.
    const incomplete = this.required && !!this.incompleteLabel && len > 0 && len < this.cellCount;
    setValidityState(this.internals, {
      missing: missing || incomplete,
      missingMessage: incomplete ? this.incompleteLabel : this.valueMissingLabel,
      customMessage: this.customValidityMessage,
      anchor: this.inputEls[0],
    });
    this.emitValidityChange();
  }

  /** Emit mdValidityChange only when validity actually moved; the first call primes the baseline. */
  private emitValidityChange() {
    const v = getValidityOf(this.internals);
    const key = `${v.valid}|${v.validationMessage}`;
    if (this.lastValidityKey === key) return;
    const primed = this.lastValidityKey !== null;
    this.lastValidityKey = key;
    if (primed) this.mdValidityChange.emit(v);
  }

  private updateValue(next: string): boolean {
    if (next === this.value) return false;
    this.value = next; // @Watch sanitizes (idempotent no-op here) + syncs the form
    return true;
  }

  /** Force every cell's DOM value back to state — the vdom can't see a DOM-only divergence (e.g. a rejected char). */
  private syncCellDom() {
    const chars = this.chars;
    this.inputEls.forEach((input, i) => {
      if (input && input.value !== chars[i]) input.value = chars[i];
    });
  }

  private focusCell(index: number) {
    const clamped = Math.max(0, Math.min(index, this.cellCount - 1));
    const input = this.inputEls[clamped];
    if (input && typeof input.focus === 'function') input.focus();
  }

  private indexOfCell(target: EventTarget | null): number {
    return this.inputEls.findIndex((el) => el === target);
  }

  private commit() {
    if (this.value === this.lastCommitted) return;
    this.lastCommitted = this.value;
    this.mdChange.emit(this.value);
  }

  /**
   * Completion check. `force` is the paste path: a complete paste announces
   * completion even when the pasted code equals the current value — the
   * consumer re-runs verification either way, so re-pasting a code the server
   * rejected must retrigger it rather than sit silent.
   */
  private maybeComplete(prevValue: string, force: boolean) {
    const complete = this.value.length >= this.cellCount;
    if (!complete) return;
    const became = prevValue.length < this.cellCount;
    if (!became && !force) return;
    this.commit();
    this.mdComplete.emit({ value: this.value });
    if (this.autoSubmit) {
      // Runs after mdComplete so listeners see the completed code before the
      // form submits. requestSubmit (never submit()) so the form's submit
      // event fires and validation runs.
      this.internals.form?.requestSubmit();
    }
  }

  private handleInput = (e: Event) => {
    const input = e.target as HTMLInputElement;
    const index = this.indexOfCell(input);
    if (index < 0) return;
    if (this.isDisabled || this.readOnly) {
      this.syncCellDom();
      return;
    }
    const raw = input.value;
    const prev = this.value;

    if (raw === '') {
      // Native deletion (cut / context-menu delete). Backspace/Delete keys are
      // handled in keydown and never reach here.
      if (index < prev.length) {
        const changed = this.updateValue(prev.slice(0, index) + prev.slice(index + 1));
        this.syncCellDom();
        if (changed) this.mdInput.emit(this.value);
      } else {
        this.syncCellDom();
      }
      return;
    }

    const { clean, rejected } = this.sanitize(raw);
    if (rejected) this.mdInvalidInput.emit({ attempted: raw, reason: 'input-change' });
    if (!clean) {
      // Everything was filtered out — restore the cell.
      this.syncCellDom();
      return;
    }

    let next: string;
    let focusTarget: number;
    if (clean.length >= this.cellCount) {
      // Full-code burst (SMS autofill / IME) — whole-value replace from 0.
      next = clean.slice(0, this.cellCount);
      focusTarget = this.cellCount - 1;
    } else {
      // Contiguous model: a char typed beyond the fill point lands at the
      // first empty position.
      const start = Math.min(index, prev.length);
      const arr = prev.split('');
      for (let i = 0; i < clean.length; i++) arr[start + i] = clean.charAt(i);
      next = arr.join('').slice(0, this.cellCount);
      focusTarget = Math.min(start + clean.length, this.cellCount - 1);
    }

    const changed = this.updateValue(next);
    this.syncCellDom();
    this.focusCell(focusTarget);
    if (changed) this.mdInput.emit(this.value);
    this.maybeComplete(prev, false);
  };

  private handleKeyDown = (e: KeyboardEvent) => {
    const input = e.target as HTMLInputElement;
    const index = this.indexOfCell(input);
    if (index < 0 || this.isDisabled) return;

    switch (e.key) {
      case 'Backspace': {
        e.preventDefault();
        if (this.readOnly) return;
        const prev = this.value;
        if (this.chars[index]) {
          // Filled: clear this cell (chars after it shift left), keep focus.
          const changed = this.updateValue(prev.slice(0, index) + prev.slice(index + 1));
          this.syncCellDom();
          if (changed) this.mdInput.emit(this.value);
        } else if (index > 0) {
          // Empty: walk back and clear the previous cell.
          const t = index - 1;
          this.focusCell(t);
          if (t < prev.length) {
            const changed = this.updateValue(prev.slice(0, t) + prev.slice(t + 1));
            this.syncCellDom();
            if (changed) this.mdInput.emit(this.value);
          }
        }
        break;
      }
      case 'Delete': {
        e.preventDefault();
        if (this.readOnly) return;
        const prev = this.value;
        if (index < prev.length) {
          const changed = this.updateValue(prev.slice(0, index) + prev.slice(index + 1));
          this.syncCellDom();
          if (changed) this.mdInput.emit(this.value);
        }
        break;
      }
      // The cell row is forced LTR even in RTL documents (codes read
      // left-to-right everywhere), so "physical left" and "previous index"
      // are always the same direction — no RTL branch.
      case 'ArrowLeft':
        e.preventDefault();
        this.focusCell(index - 1);
        break;
      case 'ArrowRight':
        e.preventDefault();
        this.focusCell(index + 1);
        break;
      case 'Home':
        e.preventDefault();
        this.focusCell(0);
        break;
      case 'End':
        e.preventDefault();
        this.focusCell(this.cellCount - 1);
        break;
      default:
        break;
    }
  };

  /** Select the cell's char on focus so typing replaces it. */
  private handleFocus = (e: Event) => {
    const input = e.target as HTMLInputElement;
    if (typeof input.select === 'function') input.select();
  };

  /** Clicking an already-focused cell re-selects its content. */
  private handleCellClick = (e: Event) => {
    const input = e.target as HTMLInputElement;
    if (typeof input.select === 'function') input.select();
  };

  private handlePaste = (e: ClipboardEvent) => {
    e.preventDefault();
    if (this.isDisabled || this.readOnly) return;
    const raw = e.clipboardData?.getData('text') ?? '';
    const prev = this.value;
    const { clean, rejected } = this.sanitize(raw);
    if (rejected) this.mdInvalidInput.emit({ attempted: raw, reason: 'input-paste' });
    if (!clean) return;
    // Whole-value replace from position 0, regardless of which cell was pasted into.
    const changed = this.updateValue(clean);
    this.syncCellDom();
    this.focusCell(Math.min(clean.length, this.cellCount - 1));
    if (changed) this.mdInput.emit(this.value);
    this.maybeComplete(prev, true);
  };

  /** Commit (mdChange) when focus leaves the whole group. */
  private handleFocusOut = (e: FocusEvent) => {
    const next = e.relatedTarget;
    if (next && this.cellsEl && this.cellsEl.contains(next as Node)) return;
    this.commit();
  };

  render() {
    const disabled = this.isDisabled;
    const chars = this.chars;
    const count = this.cellCount;
    const inputType = this.mask ? 'password' : 'text';
    const inputMode = this.effectiveInputMode;
    const group = Math.max(0, Math.floor(this.groupSize) || 0);
    const supportText = this.error && this.errorText ? this.errorText : this.supportingText;
    const showSupport = !!supportText || this.reserveSupportingSpace;

    this.inputEls.length = count;

    const nodes: VNode[] = [];
    for (let i = 0; i < count; i++) {
      if (group > 0 && i > 0 && i % group === 0) {
        nodes.push(
          <span class="md-otp-field__separator" part="separator" aria-hidden="true">
            {/* Slotted content is assigned to the FIRST separator slot in tree
                order; later gaps keep the built-in dot fallback (documented). */}
            <slot name="separator">
              <span class="md-otp-field__separator-dot"></span>
            </slot>
          </span>,
        );
      }
      const cellLabel = this.cellLabelTemplate
        .replace('{index}', String(i + 1))
        .replace('{length}', String(count));
      nodes.push(
        <input
          key={`cell-${i}`}
          ref={(el?: HTMLInputElement) => {
            this.inputEls[i] = el;
          }}
          class={{
            'md-otp-field__cell': true,
            'md-otp-field__cell--filled': !!chars[i],
          }}
          part="cell"
          type={inputType}
          disabled={disabled}
          readOnly={this.readOnly}
          // one-time-code on the FIRST cell only: it is the SMS-autofill
          // target; the burst is distributed by handleInput.
          autocomplete={i === 0 ? 'one-time-code' : 'off'}
          inputMode={inputMode}
          // No maxlength: it would truncate autofill/IME bursts before the
          // JS pipeline can distribute them. Select-on-focus keeps single
          // keystrokes replacing rather than appending.
          value={chars[i]}
          aria-label={cellLabel}
          aria-invalid={this.error ? 'true' : undefined}
          aria-required={i === 0 && this.required ? 'true' : undefined}
          aria-describedby={supportText ? `${this.uid}-support` : undefined}
          onInput={this.handleInput}
          onKeyDown={this.handleKeyDown}
          onFocus={this.handleFocus}
          onClick={this.handleCellClick}
          onPaste={this.handlePaste}
        />,
      );
    }

    return (
      <Host
        class={{
          'md-otp-field': true,
          'md-otp-field--disabled': disabled,
          'md-otp-field--readonly': this.readOnly,
          'md-otp-field--error': this.error,
          'md-otp-field--masked': this.mask,
        }}
      >
        <div
          class="md-otp-field__cells"
          part="cells"
          role="group"
          aria-label={this.label || undefined}
          // Codes read left-to-right in RTL locales too — the row is pinned
          // LTR at the markup level (CSS re-asserts it).
          dir="ltr"
          ref={(el?: HTMLElement) => {
            this.cellsEl = el;
          }}
          onFocusout={this.handleFocusOut}
        >
          {nodes}
        </div>
        {showSupport && (
          <div class="md-otp-field__support-row">
            <span
              id={`${this.uid}-support`}
              part="supporting-text"
              role={this.error && supportText ? 'alert' : undefined}
              class={{
                'md-otp-field__support-text': true,
                'md-otp-field__support-text--error': this.error,
              }}
            >
              {supportText || '\u200B'}
            </span>
          </div>
        )}
      </Host>
    );
  }
}
