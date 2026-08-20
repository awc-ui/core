/**
 * Form controller — conditional, cross-field, chained and async validation on
 * top of the native constraint-validation API.
 *
 * WHY THIS EXISTS. `required` covers "this field must have a value". It cannot
 * express "required only when the reason is Other", "must match the password
 * field", "must be after the start date" or "must not already exist on the
 * server". Those are the rules real forms are made of.
 *
 * WHY IT IS NOT A PARALLEL ERROR SYSTEM. Every rule result is pushed into the
 * control's OWN validity via `setCustomValidity()`. That keeps exactly one
 * source of truth: `form.checkValidity()` stays authoritative, the browser
 * still blocks submission, the native message still appears, and an error
 * summary built from this controller can never disagree with the form. A
 * library that tracked its own error map alongside the platform would drift the
 * moment anything else touched validity.
 */

/** Values keyed by control `name`. */
export type FormValues = Record<string, unknown>;

/** Return `true` when valid, or a message string when not. */
export type ValidateResult = true | string;

export interface FieldRule<V extends FormValues = FormValues> {
  /**
   * Conditional required. Runs before `validate`, so a field that is not
   * currently required is not also failed by its other rules while empty.
   */
  requiredWhen?: (values: V) => boolean;

  /** Message for a failed `requiredWhen`. */
  requiredMessage?: string;

  /**
   * Cross-field / chained rule. Receives ALL current values, so
   * "confirm matches password" or "end after start" are ordinary comparisons.
   * May be async — return a promise for server checks.
   */
  validate?: (values: V) => ValidateResult | Promise<ValidateResult>;

  /**
   * Other field names this rule reads. When any of them changes, this field is
   * re-validated.
   *
   * Without it a chained rule goes stale in the most confusing way possible:
   * the user fixes `password`, but `confirm` — which was marked invalid by
   * comparing against the OLD password — keeps its error until it is edited
   * again, so the form looks broken while every visible value is correct.
   */
  dependsOn?: string[];

  /** Debounce in ms for live validation. Use for async/server rules. */
  debounce?: number;
}

export interface FormControllerConfig<V extends FormValues = FormValues> {
  rules?: Record<string, FieldRule<V>>;
  /** Re-validate a field as the user edits it. Default true. */
  liveValidate?: boolean;
  /**
   * Mirror each message onto the control's own `error` / `error-text`, so the
   * failure is visible ON THE FIELD and not only in the native bubble. Default
   * true. Controls without those props (checkbox, radio, switch) are skipped —
   * they still expose `aria-invalid`.
   */
  showErrors?: boolean;
  /** Focus (and scroll to) the first invalid control on `validate()`. Default true. */
  focusInvalid?: boolean;
  /** Called after any validation pass — drive an error summary from this. */
  onValidate?: (result: FormValidationResult<V>) => void;
}

export interface FormValidationResult<V extends FormValues = FormValues> {
  valid: boolean;
  values: V;
  /** Control `name` → message, for fields that are currently invalid. */
  errors: Record<string, string>;
  /** First invalid control in DOM order, for focus and summary links. */
  firstInvalid: HTMLElement | null;
}

interface ValidatableElement extends HTMLElement {
  name?: string;
  value?: unknown;
  checked?: boolean;
  selected?: boolean;
  disabled?: boolean;
  type?: string;
  setCustomValidity?: (m: string) => Promise<void> | void;
  checkValidity?: () => Promise<boolean> | boolean;
  getValidity?: () => Promise<{ valid: boolean; validationMessage: string }>;
  setFocus?: () => Promise<void> | void;
  validationMessage?: string;
}

const FIELD_SELECTOR = '[name]';

export class FormController<V extends FormValues = FormValues> {
  private listeners: Array<() => void> = [];
  private debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  /** Monotonic token per field so a slow async rule cannot overwrite a newer result. */
  private asyncSeq = new Map<string, number>();
  private destroyed = false;
  /**
   * Fields the user has finished with (blurred), plus everything once submit is
   * attempted. Errors are only DISPLAYED for these.
   *
   * Without it the form paints red the instant it renders, or while someone is
   * still typing the first character of an email — technically accurate and
   * hostile. Validation runs continuously; only the display waits.
   */
  private touched = new Set<string>();

  constructor(
    private form: HTMLFormElement,
    private config: FormControllerConfig<V> = {},
  ) {
    if (config.liveValidate !== false) this.attachLiveValidation();
    if (config.showErrors !== false) this.reserveMessageSpace();
  }

  /**
   * Ask every managed field to hold its supporting-text line open.
   *
   * Messages here appear and disappear as the user tabs through the form, and
   * the row is otherwise created on demand — so without this the first error on
   * a field shoves everything below it down, and the form jumps around while
   * being filled in. Done from the controller rather than by default on the
   * component so that fields outside a validated form keep their current
   * height.
   */
  private reserveMessageSpace() {
    for (const el of this.fields()) {
      const target = el as ValidatableElement & { reserveSupportingSpace?: boolean };
      if ('reserveSupportingSpace' in target) target.reserveSupportingSpace = true;
    }
  }

  /** Every named, enabled control inside the form, in DOM order. */
  private fields(): ValidatableElement[] {
    return Array.from(this.form.querySelectorAll<ValidatableElement>(FIELD_SELECTOR)).filter(
      (el) => !!el.name && !el.disabled,
    );
  }

  /**
   * Current values keyed by name.
   *
   * Read from the ELEMENTS rather than FormData: FormData omits unchecked
   * boxes and radios entirely, so a rule like `requiredWhen: v => !v.subscribed`
   * would see `undefined` and could not distinguish "unchecked" from "no such
   * field". Rules need the full shape, so booleans are reported as booleans.
   */
  values(): V {
    const out: FormValues = {};
    for (const el of this.fields()) {
      const name = el.name!;
      const tag = el.tagName.toLowerCase();
      if (tag === 'md-switch') {
        out[name] = !!el.selected;
      } else if (tag === 'md-checkbox') {
        out[name] = !!el.checked;
      } else if (tag === 'md-radio') {
        // A radio group reports the CHECKED member's value, matching FormData.
        if (el.checked) out[name] = el.value;
        else if (!(name in out)) out[name] = null;
      } else {
        out[name] = el.value;
      }
    }
    return out as V;
  }

  private fieldsByName(name: string): ValidatableElement[] {
    return this.fields().filter((el) => el.name === name);
  }

  /**
   * Apply a field's rules and push the outcome into its own validity.
   * Returns the message, or '' when the field passes.
   */
  private async applyRule(name: string, values: V): Promise<string> {
    const rule = this.config.rules?.[name];
    const els = this.fieldsByName(name);
    if (!rule || els.length === 0) return '';

    // For a radio group the rule belongs to the group; anchor it on the first
    // member so the message is set once rather than once per radio.
    const el = els[0];

    let message = '';
    if (rule.requiredWhen) {
      const v = values[name];
      const isEmpty = v === undefined || v === null || v === '' || v === false ||
        (Array.isArray(v) && v.length === 0);
      if (rule.requiredWhen(values) && isEmpty) {
        message = rule.requiredMessage || 'This field is required.';
      }
    }

    if (!message && rule.validate) {
      const seq = (this.asyncSeq.get(name) || 0) + 1;
      this.asyncSeq.set(name, seq);
      const res = await rule.validate(values);
      // A slower earlier call must not overwrite a newer result — the classic
      // async-validation race that makes an error flash back after it was fixed.
      if (seq !== this.asyncSeq.get(name)) return '';
      if (res !== true) message = typeof res === 'string' ? res : 'Invalid value.';
    }

    if (this.destroyed) return '';
    await el.setCustomValidity?.(message);
    return message;
  }

  /**
   * Push a message onto the control's inline error slot.
   *
   * Capability-checked rather than tag-listed: md-checkbox / md-radio /
   * md-switch have no `error` prop, and assigning one would silently create an
   * expando that renders nothing.
   */
  private display(name: string, message: string) {
    if (this.config.showErrors === false) return;
    const show = this.touched.has(name) && !!message;
    for (const el of this.fieldsByName(name)) {
      const target = el as ValidatableElement & { error?: boolean; errorText?: string };
      if (!('errorText' in target)) continue;
      target.error = show;
      target.errorText = show ? message : '';
    }
  }

  /** Mark a field as interacted-with, so its errors may now be shown. */
  markTouched(name: string) {
    this.touched.add(name);
  }

  /** Validate one field and anything that declares a dependency on it. */
  async validateField(name: string): Promise<void> {
    const values = this.values();
    await this.applyRule(name, values);

    const dependents = Object.entries(this.config.rules || {})
      .filter(([, r]) => r.dependsOn?.includes(name))
      .map(([n]) => n);
    // Re-read values so dependents see the value just committed above.
    const fresh = this.values();
    await Promise.all(dependents.map((d) => this.applyRule(d, fresh)));

    // Refresh the inline text for this field AND its dependents: fixing the
    // dependency has to clear the message on the field that showed it.
    const snap = await this.snapshot();
    for (const n of [name, ...dependents]) this.display(n, snap.errors[n] || '');
    this.config.onValidate?.(snap);
  }

  /**
   * Validate the whole form: every rule, then the native validity of every
   * control. Focuses the first invalid control unless disabled.
   */
  async validate(): Promise<FormValidationResult<V>> {
    const values = this.values();
    await Promise.all(Object.keys(this.config.rules || {}).map((n) => this.applyRule(n, values)));
    const result = await this.collect(values);
    // A validate() pass is the submit moment: every field has now been "seen",
    // so every message becomes displayable.
    for (const el of this.fields()) this.touched.add(el.name!);
    for (const el of this.fields()) this.display(el.name!, result.errors[el.name!] || '');
    if (this.config.focusInvalid !== false && result.firstInvalid) {
      this.focusElement(result.firstInvalid);
    }
    this.config.onValidate?.(result);
    return result;
  }

  /** Read current validity without running rules or moving focus. */
  async snapshot(): Promise<FormValidationResult<V>> {
    return this.collect(this.values());
  }

  private async collect(values: V): Promise<FormValidationResult<V>> {
    const errors: Record<string, string> = {};
    let firstInvalid: HTMLElement | null = null;

    for (const el of this.fields()) {
      const name = el.name!;
      // A radio group is one logical field — only report it once.
      if (name in errors) continue;
      let valid = true;
      let message = '';
      if (el.getValidity) {
        const v = await el.getValidity();
        valid = v.valid;
        message = v.validationMessage;
      } else if (el.checkValidity) {
        valid = await el.checkValidity();
        message = valid ? '' : el.validationMessage || 'Invalid value.';
      }
      if (!valid) {
        errors[name] = message || 'Invalid value.';
        if (!firstInvalid) firstInvalid = el;
      }
    }

    return { valid: Object.keys(errors).length === 0, values, errors, firstInvalid };
  }

  /** Focus and scroll to a control, preferring its own focus method. */
  focusElement(el: HTMLElement) {
    const target = el as ValidatableElement;
    try {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    } catch {
      /* jsdom / mock-doc has no scrollIntoView */
    }
    if (typeof target.setFocus === 'function') void target.setFocus();
    else el.focus?.();
  }

  /** Focus the first currently-invalid control. */
  async focusFirstInvalid(): Promise<HTMLElement | null> {
    const { firstInvalid } = await this.snapshot();
    if (firstInvalid) this.focusElement(firstInvalid);
    return firstInvalid;
  }

  private report() {
    if (!this.config.onValidate) return;
    void this.snapshot().then((r) => this.config.onValidate!(r));
  }

  private attachLiveValidation() {
    const nameOf = (e: Event) => (e.target as ValidatableElement)?.name;

    // ── ON EDIT ─────────────────────────────────────────────────────────────
    // Re-validate as the user types/selects, but display only for fields they
    // have already finished with. This is what clears an error the instant it
    // is fixed without shouting at someone mid-keystroke.
    const onEdit = (e: Event) => {
      const name = nameOf(e);
      if (!name) return;
      const delay = this.config.rules?.[name]?.debounce ?? 0;
      const existing = this.debounceTimers.get(name);
      if (existing) clearTimeout(existing);
      this.debounceTimers.set(
        name,
        setTimeout(() => {
          this.debounceTimers.delete(name);
          void this.validateField(name);
        }, delay),
      );
    };

    // ── ON BLUR ─────────────────────────────────────────────────────────────
    // The moment a field is "done": mark it touched, then validate so any
    // message becomes visible.
    //
    // `focusout`, not `blur`: blur does not bubble, so a listener on the form
    // would never hear it. focusout is its bubbling counterpart.
    const onBlur = (e: Event) => {
      const name = nameOf(e);
      if (!name) return;
      this.markTouched(name);
      void this.validateField(name);
    };

    // ── ON SUBMIT ───────────────────────────────────────────────────────────
    // A submit ATTEMPT must reveal everything, not just the fields visited.
    //
    // Listening for the form's `submit` event is not enough: the browser blocks
    // it while any control is invalid, so the one moment the user most needs to
    // see the errors is the one moment the event does not fire. Hooking the
    // submit control's click (capture, so it runs before activation) catches
    // the attempt either way.
    const onSubmitAttempt = (e: Event) => {
      const el = e.target as HTMLElement;
      if (!el?.closest?.('[type="submit"]')) return;
      void this.validate();
    };

    for (const evt of ['mdChange', 'mdInput', 'change', 'input']) {
      this.form.addEventListener(evt, onEdit);
      this.listeners.push(() => this.form.removeEventListener(evt, onEdit));
    }
    this.form.addEventListener('focusout', onBlur);
    this.listeners.push(() => this.form.removeEventListener('focusout', onBlur));
    this.form.addEventListener('click', onSubmitAttempt, true);
    this.listeners.push(() => this.form.removeEventListener('click', onSubmitAttempt, true));
    this.form.addEventListener('submit', onSubmitAttempt);
    this.listeners.push(() => this.form.removeEventListener('submit', onSubmitAttempt));

    // ── SUPPRESS THE NATIVE BUBBLE ──────────────────────────────────────────
    // The browser pops its own validation balloon on submit. When this
    // controller is showing messages inline, that balloon is a SECOND, uglier
    // copy of the same information, anchored to the control rather than to the
    // field's supporting line. preventDefault() on `invalid` suppresses the
    // browser UI without affecting validity itself — submission stays blocked.
    //
    // Capture phase: `invalid` does not bubble, so a listener on the form only
    // sees it on the way down.
    const onInvalid = (e: Event) => {
      if (this.config.showErrors !== false) e.preventDefault();
    };

    // Native reset clears the VALUES; the error display has to go with them.
    const onReset = () => setTimeout(() => void this.reset(), 0);
    this.form.addEventListener('reset', onReset);
    this.listeners.push(() => this.form.removeEventListener('reset', onReset));
    this.form.addEventListener('invalid', onInvalid, true);
    this.listeners.push(() => this.form.removeEventListener('invalid', onInvalid, true));
  }

  /**
   * Forget every field's touched state and clear all displayed errors.
   *
   * Wired to the form's native `reset` as well: a reset form that keeps its
   * error text is claiming problems about values the user can no longer see.
   * Custom validity is cleared too, so a rule-driven message does not outlive
   * the value that caused it.
   */
  async reset() {
    this.touched.clear();
    for (const el of this.fields()) {
      const target = el as ValidatableElement & { error?: boolean; errorText?: string };
      await target.setCustomValidity?.('');
      if ('errorText' in target) {
        target.error = false;
        target.errorText = '';
      }
    }
    this.config.onValidate?.(await this.snapshot());
  }

  /** Remove listeners and cancel pending debounces. */
  destroy() {
    this.destroyed = true;
    this.listeners.forEach((off) => off());
    this.listeners = [];
    this.debounceTimers.forEach((t) => clearTimeout(t));
    this.debounceTimers.clear();
  }
}

/**
 * Create a form controller.
 *
 * @example
 * const controller = createFormController(formEl, {
 *   rules: {
 *     otherReason: {
 *       requiredWhen: (v) => v.reason === 'other',
 *       requiredMessage: 'Please tell us more',
 *     },
 *     confirm: {
 *       dependsOn: ['password'],
 *       validate: (v) => v.password === v.confirm || 'Passwords do not match',
 *     },
 *     email: {
 *       debounce: 300,
 *       validate: async (v) => (await isFree(v.email)) || 'Already registered',
 *     },
 *   },
 *   onValidate: ({ errors }) => renderSummary(errors),
 * });
 *
 * form.addEventListener('submit', async (e) => {
 *   e.preventDefault();
 *   const { valid, values } = await controller.validate();
 *   if (valid) send(values);
 * });
 */
export function createFormController<V extends FormValues = FormValues>(
  form: HTMLFormElement,
  config: FormControllerConfig<V> = {},
): FormController<V> {
  return new FormController<V>(form, config);
}
