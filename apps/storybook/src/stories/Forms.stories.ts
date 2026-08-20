import type { Meta, StoryObj } from "@storybook/web-components";
import { expect, waitFor } from "storybook/test";
import { html } from "lit";
import { ref } from "lit/directives/ref.js";
import { createFormController, type FormController } from "@awc-ui/core";

/**
 * Forms recipe — every input control in one form, wired to nothing but the
 * platform. `new FormData(form)` is the whole integration; validation is the
 * native constraint-validation API.
 */

type FormControl = HTMLElement & {
  checkValidity?: () => Promise<boolean>;
  setCustomValidity?: (m: string) => Promise<void>;
  value?: unknown;
  checked?: boolean;
  selected?: boolean;
};

/** Await hydration before touching a control — a pre-hydration click is a
 *  silent no-op, which reads exactly like a broken component. */
const hydrated = async (
  root: HTMLElement,
  sel: string,
): Promise<FormControl> => {
  const el = root.querySelector(sel) as FormControl;
  await waitFor(() => expect(el.classList.contains("hydrated")).toBe(true));
  return el;
};

const readOut = (root: HTMLElement, form: HTMLFormElement) => {
  const out = root.querySelector("[data-output]") as HTMLElement;
  const entries: Record<string, unknown> = {};
  for (const [k, v] of new FormData(form).entries()) {
    // multi-select submits one entry per selection — collapse repeats to arrays
    if (k in entries)
      entries[k] = ([] as unknown[]).concat(entries[k] as unknown, v);
    else entries[k] = v;
  }
  out.textContent = JSON.stringify(entries, null, 2) || "{}";
};

/** Live readout for the radio-group story. Shared by the mdChange binding and
 *  by play(), because setting `.checked` programmatically does NOT emit
 *  mdChange — without this the panel keeps asserting a state that has changed. */
const updateRadioReadout = (form: HTMLFormElement) => {
  // Deferred: a control publishes its new VALUE first and re-publishes its
  // VALIDITY on the next render, so reading checkValidity() synchronously from
  // an mdChange handler returns the previous state and the button would latch.
  requestAnimationFrame(() => {
    const valid = form.checkValidity();
    const out = form.querySelector("[data-output]") as HTMLElement;
    const submit = form.querySelector(
      'md-button[type="submit"]',
    ) as HTMLElement & {
      disabled?: boolean;
    };
    if (submit) submit.disabled = !valid;
    out.textContent = valid
      ? "A selection satisfies the group — Continue is enabled."
      : "No selection yet — Continue is disabled until you choose one.";
  });
};

const meta: Meta = {
  title: "Recipes/Forms",
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Every AWC UI input is a form-associated custom element: it contributes to " +
          "FormData under its `name`, blocks submission when `required` is unmet, and " +
          "restores on reset. No adapters, no hidden inputs, no framework glue.",
      },
    },
  },
};
export default meta;
type Story = StoryObj;

const formStyles = html`
  <style>
    .recipe-form {
      display: grid;
      /* 8px, not 20px. Validated fields reserve a ~20px supporting-text line so
         an error does not shove the layout down, and that line already supplies
         most of the separation — stacking a 20px grid gap on top of it put 40px
         between adjacent inputs. */
      gap: 8px;
      max-width: 560px;
    }
    /* No extra margin on non-field children. The field ABOVE them already
       reserves a ~20px supporting-text line, so adding 12px here stacked into a
       ~40px hole before the switch row and before the action buttons. */
    .recipe-form fieldset {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      align-items: center;
      border: 1px solid var(--md-sys-color-outline-variant);
      border-radius: var(--md-sys-shape-corner-medium, 12px);
      padding: 12px 16px;
    }
    .recipe-form legend {
      padding: 0 6px;
      font: var(--md-sys-typescale-label-large-font);
      color: var(--md-sys-color-on-surface-variant);
    }
    .recipe-row {
      display: flex;
      gap: 16px;
      align-items: center;
      flex-wrap: wrap;
      /* md-switch / md-checkbox hosts are 48px for the touch target while the
         visible control is 32px, so 8px of invisible padding sits above and
         below. Left alone it reads as a 16px hole next to the 8px rhythm
         between fields. Pull it back so the VISIBLE spacing matches; the touch
         target itself is untouched. */
      margin-block: -8px;
    }
    .recipe-actions {
      display: flex;
      gap: 12px;
    }
    .recipe-output {
      margin: 0;
      padding: 12px 16px;
      min-height: 3em;
      white-space: pre-wrap;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 13px;
      background: var(--md-sys-color-surface-container-high);
      color: var(--md-sys-color-on-surface);
      border-radius: var(--md-sys-shape-corner-medium, 12px);
    }
  </style>
`;

/**
 * The full recipe: every control, a submit that only fires once `required` is
 * satisfied, and a live view of what would actually be posted.
 */
export const CompleteForm: Story = {
  render: () => html`
    ${formStyles}
    <form
      class="recipe-form"
      data-recipe-form
      ${ref(
        // Attached so failures render INLINE under each control instead of as
        // the browser's validation balloon — which is unstyled, points at the
        // control rather than the field, and vanishes on the next click. The
        // controller also suppresses that balloon, and gives md-checkbox its
        // supporting line (it has no other place to put a message).
        attach({}),
      )}
      @submit=${(e: Event) => {
        e.preventDefault();
        const form = e.currentTarget as HTMLFormElement;
        // The form itself contains the output node, so it is its own query root.
        readOut(form, form);
      }}
      @reset=${(e: Event) => {
        const form = e.currentTarget as HTMLFormElement;
        setTimeout(() => {
          const out = form.querySelector("[data-output]") as HTMLElement;
          out.textContent = "Form reset.";
        }, 0);
      }}
    >
      <md-text-field
        name="name"
        label="Full name"
        variant="outlined"
        required
      ></md-text-field>
      <md-text-field
        name="email"
        label="Email"
        type="email"
        variant="outlined"
        required
      ></md-text-field>

      <md-select name="country" label="Country" variant="outlined" required>
        <md-select-option value="pt">Portugal</md-select-option>
        <md-select-option value="ro">Romania</md-select-option>
        <md-select-option value="nl">Netherlands</md-select-option>
      </md-select>

      <md-multi-select name="skills" label="Skills" variant="outlined">
        <md-select-option value="ts">TypeScript</md-select-option>
        <md-select-option value="css">CSS</md-select-option>
        <md-select-option value="a11y">Accessibility</md-select-option>
      </md-multi-select>

      <md-date-picker
        name="start"
        label="Start date"
        variant="outlined"
      ></md-date-picker>
      <md-time-picker
        name="time"
        label="Preferred time"
        variant="outlined"
      ></md-time-picker>

      <fieldset>
        <legend>Plan</legend>
        <label
          ><md-radio
            name="plan"
            value="free"
            aria-label="Free"
            checked
          ></md-radio>
          Free</label
        >
        <label
          ><md-radio name="plan" value="pro" aria-label="Pro"></md-radio>
          Pro</label
        >
        <label
          ><md-radio name="plan" value="team" aria-label="Team"></md-radio>
          Team</label
        >
      </fieldset>

      <div class="recipe-row">
        <label
          ><md-checkbox
            name="terms"
            required
            aria-label="I accept the terms"
          ></md-checkbox>
          I accept the terms</label
        >
        <label
          ><md-switch name="newsletter" aria-label="Newsletter"></md-switch>
          Newsletter</label
        >
      </div>

      <div class="recipe-row">
        <span>Experience</span>
        <md-rating name="experience" rating-label="Experience"></md-rating>
      </div>

      <div class="recipe-actions">
        <md-button type="submit" variant="filled">Submit</md-button>
        <md-button type="reset" variant="text">Reset</md-button>
      </div>

      <pre class="recipe-output" data-output>
Submit to see the FormData payload.</pre
      >
    </form>
  `,
  play: async ({ canvasElement }) => {
    const form = canvasElement.querySelector("form") as HTMLFormElement;
    const email = await hydrated(canvasElement, 'md-text-field[name="email"]');
    await hydrated(canvasElement, "md-select");
    const terms = await hydrated(canvasElement, "md-checkbox");

    // Empty required controls must BLOCK submission — this is the assertion the
    // whole recipe rests on, and it was not true before the controls published
    // their validity to the form.
    await expect(form.checkValidity()).toBe(false);

    // Fill everything required, then it must submit.
    (
      canvasElement.querySelector('md-text-field[name="name"]') as FormControl
    ).value = "Ada Lovelace";
    email.value = "ada@example.com";
    (canvasElement.querySelector("md-select") as FormControl).value = "pt";
    terms.checked = true;
    await waitFor(() => expect(form.checkValidity()).toBe(true));

    readOut(canvasElement, form);
    const out = canvasElement.querySelector("[data-output]") as HTMLElement;
    // The radio group contributes its CHECKED member, not every member.
    await waitFor(() => expect(out.textContent).toContain('"plan": "free"'));
    await expect(out.textContent).toContain("ada@example.com");
  },
};

/**
 * Validation the browser cannot infer — cross-field rules and server answers —
 * pushed in with `setCustomValidity()`. A non-empty message invalidates the
 * control until it is cleared with `''`.
 */
export const CustomValidation: Story = {
  render: () => html`
    ${formStyles}
    <form
      class="recipe-form"
      data-recipe-form
      @mdInput=${async (e: Event) => {
        const form = e.currentTarget as HTMLFormElement;
        const pw = form.querySelector('[name="password"]') as FormControl;
        const cf = form.querySelector('[name="confirm"]') as FormControl & {
          error?: boolean;
          errorText?: string;
        };
        const mismatch = !!cf.value && pw.value !== cf.value;
        await cf.setCustomValidity?.(mismatch ? "Passwords do not match" : "");
        cf.error = mismatch;
        cf.errorText = mismatch ? "Passwords do not match" : "";
      }}
      @submit=${(e: Event) => {
        e.preventDefault();
        const form = e.currentTarget as HTMLFormElement;
        (form.querySelector("[data-output]") as HTMLElement).textContent =
          "Accepted — passwords match.";
      }}
    >
      <md-text-field
        name="password"
        label="Password"
        type="password"
        variant="outlined"
        required
      ></md-text-field>
      <md-text-field
        name="confirm"
        label="Confirm password"
        type="password"
        variant="outlined"
        required
      ></md-text-field>
      <md-button type="submit" variant="filled">Change password</md-button>
      <pre class="recipe-output" data-output>Passwords must match.</pre>
    </form>
  `,
  play: async ({ canvasElement }) => {
    const form = canvasElement.querySelector("form") as HTMLFormElement;
    const pw = await hydrated(canvasElement, 'md-text-field[name="password"]');
    const cf = await hydrated(canvasElement, 'md-text-field[name="confirm"]');

    pw.value = "correct-horse";
    cf.value = "battery-staple";
    await cf.setCustomValidity!("Passwords do not match");
    await waitFor(() => expect(form.checkValidity()).toBe(false));

    // Clearing with '' must release the control — a stale custom message is the
    // classic way a form becomes permanently unsubmittable.
    cf.value = "correct-horse";
    await cf.setCustomValidity!("");
    await waitFor(() => expect(form.checkValidity()).toBe(true));
  },
};

/**
 * `required` on a radio group is a GROUP property: marking any member required
 * means a selection must be made, and picking any member satisfies it.
 */
export const RadioGroupRequired: Story = {
  render: () => html`
    ${formStyles}
    <form
      class="recipe-form"
      data-recipe-form
      @mdChange=${(e: Event) => {
        // Keep the readout LIVE. It previously carried a fixed "submission is
        // blocked" line that stayed put after a radio was chosen, so the panel
        // asserted a state that was no longer true.
        updateRadioReadout(e.currentTarget as HTMLFormElement);
      }}
      @submit=${(e: Event) => {
        e.preventDefault();
        const form = e.currentTarget as HTMLFormElement;
        (form.querySelector("[data-output]") as HTMLElement).textContent =
          "Submitted — " +
          JSON.stringify(Object.fromEntries(new FormData(form)));
      }}
    >
      <fieldset>
        <legend>Delivery (required)</legend>
        <label
          ><md-radio
            name="delivery"
            value="standard"
            required
            aria-label="Standard"
          ></md-radio>
          Standard</label
        >
        <label
          ><md-radio
            name="delivery"
            value="express"
            aria-label="Express"
          ></md-radio>
          Express</label
        >
      </fieldset>
      <md-button type="submit" variant="filled" disabled>Continue</md-button>
      <pre class="recipe-output" data-output>
No selection yet — Continue is disabled until you choose one.</pre
      >
    </form>
  `,
  play: async ({ canvasElement }) => {
    const form = canvasElement.querySelector("form") as HTMLFormElement;
    const radios = canvasElement.querySelectorAll("md-radio");
    await hydrated(canvasElement, "md-radio");

    await expect(form.checkValidity()).toBe(false);

    // Checking the member that is NOT marked required must still satisfy the
    // group — validity belongs to the group, not to one element.
    (radios[1] as FormControl).checked = true;
    await waitFor(() => expect(form.checkValidity()).toBe(true));
    await expect(new FormData(form).get("delivery")).toBe("express");

    // Leave the story in the state it is meant to DEMONSTRATE: empty, and
    // therefore blocked. Ending with a selection made Continue submit normally,
    // so a visitor saw a working button under a caption about blocking.
    //
    // Clear explicitly rather than via form.reset(): reset restores each radio
    // to the `checked` it had at ITS componentWillLoad, and Storybook can
    // re-mount the story after play() has already checked one — so the
    // "default" gets re-captured as checked and reset puts it straight back.
    radios.forEach((r) => {
      (r as FormControl).checked = false;
    });
    await waitFor(() => expect(form.checkValidity()).toBe(false));
    // Programmatic .checked emits no mdChange, so refresh the panel explicitly.
    updateRadioReadout(form);
  },
};

/* ============================================================================
   VALIDATION RECIPES
   These use createFormController, which layers conditional / cross-field /
   async rules on top of the native constraint API by writing each result into
   the control's own setCustomValidity() — so form.checkValidity() stays the
   single source of truth and the summary can never disagree with the form.
   ========================================================================= */

/** One controller per mounted form. lit re-invokes ref callbacks on re-render,
 *  so without this guard a story would stack duplicate listener sets. */
const controllers = new WeakMap<HTMLFormElement, FormController>();
const attach =
  (config: Parameters<typeof createFormController>[1]) => (el?: Element) => {
    const form = el as HTMLFormElement | undefined;
    if (!form || controllers.has(form)) return;
    controllers.set(form, createFormController(form, config));
  };
const controllerFor = async (
  canvasElement: HTMLElement,
): Promise<FormController> => {
  const form = canvasElement.querySelector("form") as HTMLFormElement;
  await waitFor(() => expect(controllers.has(form)).toBe(true));
  return controllers.get(form)!;
};
/** Fire the event the controller listens on — setting a property is silent. */
const commit = (el: Element, evt = "mdChange") =>
  el.dispatchEvent(new CustomEvent(evt, { bubbles: true }));

/**
 * CONDITIONAL — a field that is required only when another field says so.
 * Choose "Other" and the details field becomes required; choose anything else
 * and it is not.
 */
export const ConditionalRequired: Story = {
  render: () => html`
    ${formStyles}
    <form
      class="recipe-form"
      ${ref(
        attach({
          rules: {
            otherReason: {
              dependsOn: ["reason"],
              requiredWhen: (v) => v.reason === "other",
              requiredMessage: "Please tell us more",
            },
          },
          onValidate: ({ errors }) => {
            const out = document.querySelector(
              "[data-output-conditional]",
            ) as HTMLElement;
            if (out) {
              out.textContent = Object.keys(errors).length
                ? JSON.stringify(errors, null, 2)
                : "No errors — the form would submit.";
            }
          },
        }),
      )}
    >
      <md-select name="reason" label="Reason" variant="outlined">
        <md-select-option value="bug">Bug report</md-select-option>
        <md-select-option value="other">Other</md-select-option>
      </md-select>
      <md-text-field
        name="otherReason"
        label="Details"
        variant="outlined"
      ></md-text-field>
      <md-button type="submit" variant="filled">Submit</md-button>
      <pre class="recipe-output" data-output-conditional>Pick a reason.</pre>
    </form>
  `,
  play: async ({ canvasElement }) => {
    const c = await controllerFor(canvasElement);
    const reason = canvasElement.querySelector("md-select") as FormControl;
    const details = canvasElement.querySelector("md-text-field") as FormControl;

    reason.value = "bug";
    commit(reason);
    await expect((await c.validate()).valid).toBe(true);

    // Flip the trigger: the SAME empty field is now required.
    reason.value = "other";
    commit(reason);
    const withOther = await c.validate();
    await expect(withOther.errors.otherReason).toBe("Please tell us more");

    details.value = "It happens on Safari";
    commit(details, "mdInput");
    await waitFor(async () => expect((await c.snapshot()).valid).toBe(true));
  },
};

/**
 * CHAINED — a rule that reads another field. Fixing the DEPENDENCY clears the
 * error without touching the field that shows it, which is what `dependsOn`
 * buys: otherwise "confirm" keeps an error from comparing against a password
 * that no longer exists.
 */
export const ChainedFields: Story = {
  render: () => html`
    ${formStyles}
    <form
      class="recipe-form"
      ${ref(
        attach({
          rules: {
            confirm: {
              dependsOn: ["password"],
              validate: (v) =>
                !v.confirm ||
                v.password === v.confirm ||
                "Passwords do not match",
            },
          },
          onValidate: ({ errors }) => {
            const out = document.querySelector(
              "[data-output-chained]",
            ) as HTMLElement;
            if (out) out.textContent = errors.confirm || "Passwords match.";
          },
        }),
      )}
    >
      <md-text-field
        name="password"
        label="Password"
        type="password"
        variant="outlined"
      ></md-text-field>
      <md-text-field
        name="confirm"
        label="Confirm password"
        type="password"
        variant="outlined"
      ></md-text-field>
      <pre class="recipe-output" data-output-chained>
Type a password, then confirm it.</pre
      >
    </form>
  `,
  play: async ({ canvasElement }) => {
    const c = await controllerFor(canvasElement);
    const [pw, cf] = Array.from(
      canvasElement.querySelectorAll("md-text-field"),
    ) as FormControl[];

    pw.value = "correct-horse";
    cf.value = "battery-staple";
    commit(cf, "mdInput");
    await waitFor(async () =>
      expect((await c.snapshot()).errors.confirm).toBe(
        "Passwords do not match",
      ),
    );

    // Edit ONLY the dependency. `confirm` is never touched.
    pw.value = "battery-staple";
    commit(pw, "mdInput");
    await waitFor(async () => expect((await c.snapshot()).valid).toBe(true));
  },
};

/**
 * ASYNC — a server check, debounced. "taken@example.com" is rejected.
 * Each field carries a monotonic token, so a slow earlier check cannot
 * overwrite a newer result.
 */
export const AsyncValidation: Story = {
  render: () => html`
    ${formStyles}
    <form
      class="recipe-form"
      ${ref(
        attach({
          rules: {
            email: {
              debounce: 150,
              validate: async (v) => {
                await new Promise((r) => setTimeout(r, 120)); // stand-in for the network
                return (
                  v.email !== "taken@example.com" ||
                  "That email is already registered"
                );
              },
            },
          },
          onValidate: ({ errors }) => {
            const out = document.querySelector(
              "[data-output-async]",
            ) as HTMLElement;
            if (out) out.textContent = errors.email || "Email is available.";
          },
        }),
      )}
    >
      <md-text-field
        name="email"
        label="Email"
        type="email"
        variant="outlined"
      ></md-text-field>
      <pre class="recipe-output" data-output-async>Try taken@example.com</pre>
    </form>
  `,
  play: async ({ canvasElement }) => {
    const c = await controllerFor(canvasElement);
    const email = canvasElement.querySelector("md-text-field") as FormControl;

    email.value = "taken@example.com";
    await expect((await c.validate()).errors.email).toBe(
      "That email is already registered",
    );

    email.value = "free@example.com";
    await waitFor(async () => expect((await c.validate()).valid).toBe(true));
  },
};

/**
 * ERROR SUMMARY — the WCAG 3.3.1 submit pattern. validate() returns every
 * message keyed by field name plus the first invalid control, already focused
 * and scrolled into view.
 */
export const ErrorSummary: Story = {
  render: () => html`
    ${formStyles}
    <form
      class="recipe-form"
      ${ref(
        attach({
          onValidate: ({ errors }) => {
            const list = document.querySelector(
              "[data-summary]",
            ) as HTMLElement;
            if (!list) return;
            const names = Object.keys(errors);
            list.innerHTML = names.length
              ? "<strong>" +
                names.length +
                " problem(s):</strong><ul>" +
                names
                  .map((n) => "<li>" + n + ": " + errors[n] + "</li>")
                  .join("") +
                "</ul>"
              : "No problems — ready to submit.";
          },
        }),
      )}
    >
      <div class="recipe-output" data-summary role="alert">Press Validate.</div>
      <md-text-field
        name="name"
        label="Full name"
        variant="outlined"
        required
      ></md-text-field>
      <md-text-field
        name="email"
        label="Email"
        type="email"
        variant="outlined"
        required
      ></md-text-field>
      <md-select name="country" label="Country" variant="outlined" required>
        <md-select-option value="pt">Portugal</md-select-option>
      </md-select>
      <md-button type="submit" variant="filled">Validate</md-button>
    </form>
  `,
  play: async ({ canvasElement }) => {
    const c = await controllerFor(canvasElement);
    const result = await c.validate();

    // Every unsatisfied control is reported, keyed by name.
    await expect(Object.keys(result.errors).sort()).toEqual([
      "country",
      "email",
      "name",
    ]);
    // ...and the FIRST one in DOM order is what focus lands on.
    await expect(result.firstInvalid?.getAttribute("name")).toBe("name");

    const summary = canvasElement.querySelector(
      "[data-summary]",
    ) as HTMLElement;
    await waitFor(() => expect(summary.textContent).toContain("3 problem"));
  },
};

/**
 * VALIDATION TIMING — when a message appears, and when it does not.
 *
 * Deliberately does NOT pre-validate in play(): a validate() pass marks every
 * field touched, which is right on submit but would hide the very behaviour
 * this story exists to show. Tab out of an empty field to see its error, then
 * start typing to watch it clear.
 */
export const ValidationTiming: Story = {
  render: () => html`
    ${formStyles}
    <form
      class="recipe-form"
      ${ref(
        attach({
          onValidate: ({ errors }) => {
            const out = document.querySelector(
              "[data-output-timing]",
            ) as HTMLElement;
            if (out) {
              const n = Object.keys(errors).length;
              out.textContent = n
                ? n + " field(s) currently invalid"
                : "All good.";
            }
          },
        }),
      )}
    >
      <p style="margin:0;color:var(--md-sys-color-on-surface-variant);">
        Tab out of an empty field to see its error. Type to clear it. Submit
        reveals every field.
      </p>
      <md-text-field
        name="name"
        label="Full name"
        variant="outlined"
        required
      ></md-text-field>
      <md-text-field
        name="email"
        label="Email"
        type="email"
        variant="outlined"
        required
      ></md-text-field>
      <md-text-field
        name="nickname"
        label="Nickname (optional)"
        variant="outlined"
      ></md-text-field>
      <md-button type="submit" variant="filled">Submit</md-button>
      <pre class="recipe-output" data-output-timing>Nothing validated yet.</pre>
    </form>
  `,
  play: async ({ canvasElement }) => {
    await controllerFor(canvasElement);
    const [name, email] = Array.from(
      canvasElement.querySelectorAll("md-text-field"),
    ) as Array<FormControl & { error?: boolean; errorText?: string }>;
    await waitFor(() => expect(name.classList.contains("hydrated")).toBe(true));

    // ON LOAD: a form must not open in red.
    await expect(!!name.error).toBe(false);

    // ON BLUR: focusout is what marks a field touched. Uses focusout rather
    // than blur because blur does not bubble and never reaches the form.
    name.dispatchEvent(
      new FocusEvent("focusout", { bubbles: true, composed: true }),
    );
    await waitFor(() => expect(!!name.error).toBe(true));

    // An untouched neighbour stays quiet — errors are per-field, not global.
    await expect(!!email.error).toBe(false);

    // ON SUBMIT: every field is revealed, including ones never visited.
    (
      canvasElement.querySelector('md-button[type="submit"]') as HTMLElement
    ).click();
    await waitFor(() => expect(!!email.error).toBe(true));

    // Hand the story back CLEAN. play() has to exercise blur and submit to
    // assert them, but leaving the form covered in errors means a visitor
    // arrives after the moment this story exists to demonstrate.
    const c = await controllerFor(canvasElement);
    await c.reset();
    await waitFor(() => expect(!!name.error).toBe(false));
  },
};

/**
 * ALL TRIGGERS — one form wired to every entry point, with a live log of what
 * fired and why. This is the story to open when asking "when does validation
 * actually run?".
 */
export const AllTriggers: Story = {
  render: () => {
    const log = (line: string) => {
      const el = document.querySelector("[data-trigger-log]") as HTMLElement;
      if (!el) return;
      el.textContent = (line + "\n" + el.textContent)
        .split("\n")
        .slice(0, 8)
        .join("\n");
    };
    return html`
      ${formStyles}
      <form
        class="recipe-form"
        @focusout=${(e: Event) =>
          log(
            "blur      → " +
              ((e.target as HTMLElement).getAttribute("name") || "?"),
          )}
        @mdInput=${(e: Event) =>
          log(
            "input     → " +
              ((e.target as HTMLElement).getAttribute("name") || "?"),
          )}
        @mdChange=${(e: Event) =>
          log(
            "change    → " +
              ((e.target as HTMLElement).getAttribute("name") || "?"),
          )}
        ${ref(
          attach({
            rules: {
              confirmEmail: {
                dependsOn: ["email"],
                validate: (v) =>
                  !v.confirmEmail ||
                  v.email === v.confirmEmail ||
                  "Emails do not match",
              },
              vatNumber: {
                dependsOn: ["isCompany"],
                requiredWhen: (v) => v.isCompany === true,
                requiredMessage:
                  "A VAT number is required for company accounts",
              },
              username: {
                debounce: 200,
                validate: async (v) => {
                  if (!v.username) return true;
                  await new Promise((r) => setTimeout(r, 100));
                  return v.username !== "admin" || "That username is taken";
                },
              },
            },
            onValidate: ({ errors, valid }) => {
              const el = document.querySelector(
                "[data-trigger-state]",
              ) as HTMLElement;
              if (el) {
                el.textContent = valid
                  ? "Form is valid."
                  : Object.entries(errors)
                      .map(([k, v]) => k + ": " + v)
                      .join("\n");
              }
            },
          }),
        )}
      >
        <p style="margin:0;color:var(--md-sys-color-on-surface-variant);">
          Blur an empty field, type to fix it, toggle the company switch, or
          press Submit.
        </p>

        <md-text-field
          name="email"
          label="Email"
          type="email"
          variant="outlined"
          required
        ></md-text-field>
        <md-text-field
          name="confirmEmail"
          label="Confirm email"
          variant="outlined"
        ></md-text-field>
        <md-text-field
          name="username"
          label="Username (try admin)"
          variant="outlined"
        ></md-text-field>

        <div class="recipe-row">
          <label
            ><md-switch
              name="isCompany"
              aria-label="Company account"
            ></md-switch>
            Company account</label
          >
        </div>
        <md-text-field
          name="vatNumber"
          label="VAT number"
          variant="outlined"
        ></md-text-field>

        <div class="recipe-actions">
          <md-button type="submit" variant="filled">Submit</md-button>
          <md-button type="reset" variant="text">Reset</md-button>
        </div>

        <pre class="recipe-output" data-trigger-state>
Nothing validated yet.</pre
        >
        <pre class="recipe-output" data-trigger-log>event log</pre>
      </form>
    `;
  },
  play: async ({ canvasElement }) => {
    const c = await controllerFor(canvasElement);
    const f = (n: string) =>
      canvasElement.querySelector(`[name="${n}"]`) as FormControl & {
        error?: boolean;
        errorText?: string;
      };
    await waitFor(() =>
      expect(f("email").classList.contains("hydrated")).toBe(true),
    );

    // 1. ON LOAD — silent.
    await expect(!!f("email").error).toBe(false);

    // 2. ON BLUR — only the blurred field speaks.
    f("email").dispatchEvent(
      new FocusEvent("focusout", { bubbles: true, composed: true }),
    );
    await waitFor(() => expect(!!f("email").error).toBe(true));
    await expect(!!f("username").error).toBe(false);

    // 3. CONDITIONAL — the switch makes a different field required.
    (f("isCompany") as FormControl).selected = true;
    commit(f("isCompany"));
    await waitFor(async () =>
      expect((await c.snapshot()).errors.vatNumber).toBeTruthy(),
    );

    // 4. CHAINED — mismatch, then fix the DEPENDENCY only.
    f("email").value = "ada@example.com";
    f("confirmEmail").value = "nope@example.com";
    commit(f("confirmEmail"), "mdInput");
    await waitFor(async () =>
      expect((await c.snapshot()).errors.confirmEmail).toBe(
        "Emails do not match",
      ),
    );
    f("confirmEmail").value = "ada@example.com";
    commit(f("confirmEmail"), "mdInput");
    await waitFor(async () =>
      expect((await c.snapshot()).errors.confirmEmail).toBeUndefined(),
    );

    // 5. ASYNC — debounced server check.
    f("username").value = "admin";
    await expect((await c.validate()).errors.username).toBe(
      "That username is taken",
    );

    // 6. RESET — clears values AND the error display, so the form does not
    //    keep complaining about values that no longer exist.
    (
      canvasElement.querySelector('md-button[type="reset"]') as HTMLElement
    ).click();
    await waitFor(() => expect(!!f("email").error).toBe(false));
  },
};
