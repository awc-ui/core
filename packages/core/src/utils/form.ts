/**
 * Helpers for form-associated custom elements (ElementInternals).
 */

let validationIntent: 'check' | 'report' | undefined;

/** Preserve native constraint validation while marking an interactive report. */
export function withValidationReport<T>(action: () => T): T {
  const previous = validationIntent;
  validationIntent = 'report';
  try { return action(); } finally { validationIntent = previous; }
}

/** A validity query must not reveal errors or move keyboard focus. */
export function withValidationCheck<T>(action: () => T): T {
  const previous = validationIntent;
  validationIntent = 'check';
  try { return action(); } finally { validationIntent = previous; }
}

interface InlineValidationOptions {
  host: () => HTMLElement;
  validity: () => { valid: boolean; validationMessage: string };
  message: (message: string) => void;
  focus: () => void | Promise<void>;
}
const pendingInvalidFocus = new WeakMap<Node, InlineValidationPresenter[]>();

/**
 * Present platform validity through the control's supporting/error UI.
 * Canceling invalid cancels only the browser popover, never validity or the
 * submission guard. Public error/errorText remain owned by the application.
 */
export class InlineValidationPresenter {
  private revealed = false;
  private shown = '';
  constructor(private options: InlineValidationOptions) {}

  handleInvalid(event: Event) {
    if (event.target !== this.options.host()) return;
    this.present(event);
  }

  /** Explicit native input fallback (invalid does not cross shadow roots). */
  handleInputInvalid(event: Event) { this.present(event); }

  private present(event: Event) {
    event.preventDefault();
    if (validationIntent === 'check') return;
    this.revealed = true;
    this.refresh();
    // Native form.checkValidity and form.reportValidity emit identical events.
    // Only known reports/submits move focus; unmarked queries never steal it.
    if (validationIntent === 'report') this.queueFocus();
  }

  refresh() {
    if (!this.revealed) return;
    const validity = this.options.validity();
    this.publish(validity.valid ? '' : validity.validationMessage);
  }

  reset() {
    this.revealed = false;
    this.publish('');
  }

  private publish(message: string) {
    if (message === this.shown) return;
    this.shown = message;
    this.options.message(message);
  }

  private queueFocus() {
    const host = this.options.host();
    const root = host.getRootNode();
    const formId = host.getAttribute('form');
    const owner = formId && 'getElementById' in root
      ? (root as Document | ShadowRoot).getElementById(formId)
      : host.closest('form');
    const key = owner || root;
    const pending = pendingInvalidFocus.get(key);
    if (pending) { if (!pending.includes(this)) pending.push(this); return; }
    const candidates = [this];
    pendingInvalidFocus.set(key, candidates);
    const run = () => {
      pendingInvalidFocus.delete(key);
      const first = candidates.find((candidate) => {
        const el = candidate.options.host();
        return candidate.revealed && el.isConnected && !el.hasAttribute('disabled') && !candidate.options.validity().valid;
      });
      if (!first) return;
      void Promise.resolve(first.options.focus()).then(() => {
        first.options.host().scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
      });
    };
    // Allow the supporting message to render before focusing and scrolling.
    const view = host.ownerDocument.defaultView;
    if (view?.requestAnimationFrame) view.requestAnimationFrame(run);
    else setTimeout(run, 0);
  }
}

/**
 * Set a form-associated control's submitted value.
 *
 * No-ops when `setFormValue` isn't available — notably the Stencil spec-test
 * mock for `ElementInternals`, whose proxy doesn't implement it (real
 * behaviour is covered by e2e tests). The `in` check reads the method off the
 * real `ElementInternals.prototype` without tripping the mock's get-trap, so
 * spec runs stay quiet.
 */
export function setFormValue(
  internals: ElementInternals,
  value: string | FormData | null,
): void {
  if (internals && 'setFormValue' in internals) {
    internals.setFormValue(value);
  }
}

/**
 * Publish a control's validity to its form.
 *
 * `missing` is the `valueMissing` case (an empty `required` control).
 * `customMessage`, when non-empty, wins — matching the native precedence where
 * `setCustomValidity()` invalidates a field regardless of its other flags.
 *
 * The `anchor` identifies the native focus target. Core presents the message
 * inline and suppresses the browser's separate validation popover.
 *
 * Guarded the same way as `setFormValue` — the Stencil spec-test mock does not
 * implement `setValidity`, so specs stay quiet and e2e covers real behaviour.
 */
export function setValidityState(
  internals: ElementInternals,
  opts: { missing?: boolean; missingMessage?: string; customMessage?: string; anchor?: HTMLElement },
): void {
  if (!internals || !('setValidity' in internals)) return;
  const { missing = false, missingMessage = 'Please fill out this field.', customMessage = '', anchor } = opts;
  if (customMessage) {
    internals.setValidity({ customError: true }, customMessage, anchor);
  } else if (missing) {
    internals.setValidity({ valueMissing: true }, missingMessage, anchor);
  } else {
    internals.setValidity({});
  }
}

/**
 * `checkValidity()` / `reportValidity()` for a form-associated control.
 *
 * Both return true when the platform lacks the method (spec mock, or a browser
 * without ElementInternals) — an unknown validity must never be reported as a
 * FAILURE, or forms become unsubmittable in exactly the environments least able
 * to explain why.
 */
export function checkValidityOf(internals: ElementInternals): boolean {
  if (!internals || !('checkValidity' in internals)) return true;
  try {
    return withValidationCheck(() => internals.checkValidity());
  } catch {
    return true;
  }
}

export function reportValidityOf(internals: ElementInternals): boolean {
  if (!internals || !('reportValidity' in internals)) return true;
  try {
    return withValidationReport(() => internals.reportValidity());
  } catch {
    return true;
  }
}

/**
 * Read a control's current validity: the boolean, the message, and the flags.
 *
 * `ElementInternals` is private to the component, so without this a consumer
 * can call checkValidity() but cannot find out WHY a field failed — which is
 * exactly what an error-summary panel ("3 problems: …") needs, and what a form
 * library needs to map platform validity onto its own error model.
 *
 * Mirrors md-text-field's existing getValidity() shape so every control answers
 * the same question the same way.
 */
export function getValidityOf(internals: ElementInternals): {
  valid: boolean;
  validationMessage: string;
  flags: Record<string, boolean>;
} {
  if (!internals || !('validity' in internals)) {
    return { valid: true, validationMessage: '', flags: {} };
  }
  try {
    const v = internals.validity;
    const flags: Record<string, boolean> = {};
    for (const k in v) {
      // `valid` is the summary, not a failure reason — including it means a
      // passing control reports `flags: { valid: true }`, so any consumer
      // testing "are there flags?" sees a problem where there is none.
      if (k === 'valid') continue;
      const val = (v as unknown as Record<string, unknown>)[k];
      if (typeof val === 'boolean' && val) flags[k] = true;
    }
    return { valid: v.valid, validationMessage: internals.validationMessage || '', flags };
  } catch {
    return { valid: true, validationMessage: '', flags: {} };
  }
}


const pendingEnterSubmissions = new WeakSet<KeyboardEvent>();

/**
 * Give a shadow-owned text input the owning form's implicit Enter action.
 * The input itself has no native association with the OUTER form. Defer the
 * action until keydown has finished bubbling, so composite controls and app
 * handlers can preventDefault (for example, Enter selecting an autocomplete
 * option). Never call submit(): validation and cancelable submission must run.
 */
export function submitFormOnEnter(
  internals: ElementInternals | undefined,
  event: KeyboardEvent,
  options: { disabled?: boolean; composing?: boolean; multiline?: boolean } = {},
): boolean {
  if (event.key !== 'Enter' || event.defaultPrevented || event.repeat ||
      event.altKey || event.ctrlKey || event.metaKey || event.shiftKey ||
      event.isComposing || event.keyCode === 229 || options.composing ||
      options.disabled || options.multiline || pendingEnterSubmissions.has(event)) return false;

  // The spec ElementInternals proxy does not implement form association.
  let form: HTMLFormElement | null;
  try {
    form = internals && 'form' in internals ? internals.form : null;
  } catch {
    return false;
  }
  if (!form) return false;
  pendingEnterSubmissions.add(event);

  setTimeout(() => {
    if (event.defaultPrevented) return;
    // Search the form's DOM tree, not just descendants: native form="id"
    // submitters can precede the form and are still its default button.
    const root = form.getRootNode() as ParentNode;
    const defaultSubmitter = () => Array.from(root.querySelectorAll<HTMLElement>('button, input, md-button'))
      .find((element) => {
        const tag = element.localName;
        if (tag === 'button' || tag === 'input') {
          const control = element as HTMLButtonElement | HTMLInputElement;
          return control.form === form && (control.type === 'submit' || (tag === 'input' && control.type === 'image'));
        }
        const button = element as HTMLElement & { type?: string; href?: string };
        if ((button.type || button.getAttribute('type')) !== 'submit' || button.href || button.getAttribute('href')) return false;
        const owner = button.getAttribute('form');
        return owner === null ? button.closest('form') === form : !!owner && owner === form.getAttribute('id');
      });
    const submitter = defaultSubmitter();
    if (submitter) {
      const button = submitter as HTMLElement & {
        disabled?: boolean;
        softDisabled?: boolean;
        loading?: boolean;
        componentOnReady?: () => Promise<unknown>;
      };
      const activate = () => {
        // A lazy default may finish loading after its form has unmounted, the
        // button has moved, or another control has become the default. Never
        // submit a different form or bypass a newly disabled/loading default.
        if (event.defaultPrevented || !form.isConnected || !button.isConnected || defaultSubmitter() !== button) return;
        event.preventDefault();
        if (button.matches(':disabled') || button.disabled || button.softDisabled || button.loading) return;
        // Native click preserves SubmitEvent.submitter, name/value and
        // formnovalidate. md-button's HOST click preserves cancelable mdClick.
        withValidationReport(() => button.click());
      };
      if (button.localName === 'md-button' && !button.classList.contains('hydrated') && typeof button.componentOnReady === 'function') {
        // The text field can hydrate before the default button's lazy chunk.
        // Wait for its click handler instead of losing Enter on an inert host.
        // Rejection leaves the original default in charge; no fallback submit.
        try {
          void button.componentOnReady().then(activate, () => undefined);
        } catch { /* failed lazy upgrade: do not bypass the default button */ }
      } else {
        activate();
      }
    } else if (typeof form.requestSubmit === 'function' && form.isConnected) {
      event.preventDefault();
      withValidationReport(() => form.requestSubmit());
    }
  }, 0);
  return true;
}
