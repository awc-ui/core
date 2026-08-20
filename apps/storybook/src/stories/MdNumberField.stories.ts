import type { Meta, StoryObj } from '@storybook/web-components';
import { expect, waitFor } from 'storybook/test';
import { html } from 'lit';
import { t } from '../i18n';

/** Shadow-piercing helpers for play(): testing-library queries can't cross
 *  shadow roots, so interactions address the real internals directly. */
type NfEl = HTMLElement & {
  value: number | null;
  formatOptions?: Intl.NumberFormatOptions;
  stepUp: (times?: number) => Promise<void>;
  stepDown: (times?: number) => Promise<void>;
};
const getNf = async (canvasElement: HTMLElement, selector = 'md-number-field'): Promise<NfEl> => {
  const nf = canvasElement.querySelector(selector) as NfEl;
  await waitFor(() => expect(nf.classList.contains('hydrated')).toBe(true));
  return nf;
};
const fieldOf = (nf: NfEl) => nf.shadowRoot!.querySelector('md-text-field') as HTMLElement;
const inputOf = (nf: NfEl) =>
  fieldOf(nf).shadowRoot!.querySelector('input') as HTMLInputElement;
const typeIn = (nf: NfEl, text: string) => {
  const input = inputOf(nf);
  input.focus();
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
};
const key = (target: Element, k: string, init: KeyboardEventInit = {}) =>
  target.dispatchEvent(
    new KeyboardEvent('keydown', { key: k, bubbles: true, composed: true, ...init }),
  );
const stepperOf = (nf: NfEl, part: 'increment' | 'decrement') =>
  nf.shadowRoot!.querySelector(`md-icon-button[part="${part}"]`) as HTMLElement;
/** Steppers tick on pointerdown; release on the window ends the hold. */
const pressStepper = (nf: NfEl, part: 'increment' | 'decrement') => {
  stepperOf(nf, part).dispatchEvent(
    new PointerEvent('pointerdown', { bubbles: true, composed: true }),
  );
  window.dispatchEvent(new PointerEvent('pointerup'));
};

const meta: Meta = {
  title: 'Text Inputs/Number Field',
  component: 'md-number-field',
  tags: ['autodocs'],
  parameters: { docs: { source: { language: 'html' } } },
  argTypes: {
    variant: { control: { type: 'select' }, options: ['filled', 'outlined'] },
    steppers: { control: { type: 'select' }, options: ['inline', 'split', 'none'] },
    label: { control: 'text' },
    placeholder: { control: 'text' },
    value: { control: 'number' },
    min: { control: 'number' },
    max: { control: 'number' },
    step: { control: 'number' },
    smallStep: { control: 'number', name: 'small-step' },
    largeStep: { control: 'number', name: 'large-step' },
    snapOnStep: { control: 'boolean', name: 'snap-on-step' },
    allowOutOfRange: { control: 'boolean', name: 'allow-out-of-range' },
    allowWheelScrub: { control: 'boolean', name: 'allow-wheel-scrub' },
    disabled: { control: 'boolean' },
    readOnly: { control: 'boolean', name: 'readonly' },
    required: { control: 'boolean' },
    error: { control: 'boolean' },
    density: { control: { type: 'select' }, options: [0, -1, -2, -3, -4] },
  },
  args: {
    variant: 'outlined',
    steppers: 'inline',
    label: 'Quantity',
    placeholder: '',
    value: null,
    step: 1,
    smallStep: 0.1,
    largeStep: 10,
    snapOnStep: false,
    allowOutOfRange: false,
    allowWheelScrub: false,
    disabled: false,
    readOnly: false,
    required: false,
    error: false,
    density: 0,
  },
};
export default meta;
type Story = StoryObj;

export const Playground: Story = {
  render: (args) => html`
    <div style="max-inline-size: 320px;">
      <md-number-field
        variant=${args.variant}
        steppers=${args.steppers}
        density=${args.density}
        label=${args.label}
        placeholder=${args.placeholder}
        .value=${args.value ?? null}
        .min=${args.min ?? undefined}
        .max=${args.max ?? undefined}
        .step=${args.step ?? 1}
        .smallStep=${args.smallStep ?? 0.1}
        .largeStep=${args.largeStep ?? 10}
        ?snap-on-step=${args.snapOnStep}
        ?allow-out-of-range=${args.allowOutOfRange}
        ?allow-wheel-scrub=${args.allowWheelScrub}
        ?disabled=${args.disabled}
        ?readonly=${args.readOnly}
        ?required=${args.required}
        ?error=${args.error}
      ></md-number-field>
    </div>
  `,
  parameters: {
    docs: { source: { code: '<md-number-field label="Quantity" variant="outlined"></md-number-field>' } },
  },
  /** The core typing → blur → stepping contract, scripted (see Interactions). */
  play: async ({ canvasElement, step }) => {
    const nf = await getNf(canvasElement);

    await step('Typing parses live; blur commits and reformats', async () => {
      typeIn(nf, '1234.5');
      await waitFor(() => expect(nf.value).toBe(1234.5));
      let commit: CustomEvent | undefined;
      nf.addEventListener('mdChange', (e) => (commit = e as CustomEvent), { once: true });
      // Real blur retargets to the md-text-field host (composed, AT_TARGET) —
      // exactly the path the component listens on.
      inputOf(nf).blur();
      await waitFor(() => expect(inputOf(nf).value).toBe((1234.5).toLocaleString()));
      expect(commit?.detail.reason).toBe('input-blur');
      expect(commit?.detail.value).toBe(1234.5);
    });

    await step('ArrowUp steps by `step`; Shift steps by `large-step`', async () => {
      inputOf(nf).focus();
      key(fieldOf(nf), 'ArrowUp');
      await waitFor(() => expect(nf.value).toBe(1235.5));
      key(fieldOf(nf), 'ArrowUp', { shiftKey: true });
      await waitFor(() => expect(nf.value).toBe(1245.5));
    });

    await step('The stepper buttons tick on pointerdown', async () => {
      pressStepper(nf, 'increment');
      await waitFor(() => expect(nf.value).toBe(1246.5));
      pressStepper(nf, 'decrement');
      await waitFor(() => expect(nf.value).toBe(1245.5));
    });

    await step('stepUp()/stepDown() drive the value programmatically', async () => {
      await nf.stepUp(4);
      await waitFor(() => expect(nf.value).toBe(1249.5));
      await nf.stepDown();
      await waitFor(() => expect(nf.value).toBe(1248.5));
    });

    await step('Reset to the fresh resting render (clean visual baseline)', async () => {
      nf.value = null;
      inputOf(nf).blur();
      (document.activeElement as HTMLElement | null)?.blur();
      await waitFor(() => expect(nf.value).toBeNull());
      await waitFor(() => expect(inputOf(nf).value).toBe(''));
    });
  },
};

export const Variants: Story = {
  render: (_args, { globals }) => html`
    <div style="display:flex; flex-direction:column; gap:24px; max-inline-size: 320px;">
      <md-number-field variant="filled" label="${t(globals.locale, 'numberField.quantity')}" .value=${12}></md-number-field>
      <md-number-field variant="outlined" label="${t(globals.locale, 'numberField.quantity')}" .value=${12}></md-number-field>
    </div>
  `,
};

/** `steppers` places the +/− buttons: `inline` (trailing, default), `split`
 *  (tonal circles flanking the field), or `none` (keyboard/wheel only). */
export const Steppers: Story = {
  name: 'Steppers (inline / split / none)',
  render: () => html`
    <div style="display:flex; flex-direction:column; gap:24px; max-inline-size: 360px;">
      <md-number-field steppers="inline" variant="outlined" label="Inline (default)" .value=${3}></md-number-field>
      <md-number-field steppers="split" variant="outlined" label="Split" .value=${3}></md-number-field>
      <md-number-field steppers="none" variant="outlined" label="None (keyboard only)" .value=${3}></md-number-field>
    </div>
  `,
  /** Split steppers step on pointerdown and auto-disable at the bounds. */
  play: async ({ canvasElement, step }) => {
    const all = canvasElement.querySelectorAll('md-number-field');
    const split = all[1] as NfEl;
    await waitFor(() => expect(split.classList.contains('hydrated')).toBe(true));

    await step('The split increment ticks once per press', async () => {
      pressStepper(split, 'increment');
      await waitFor(() => expect(split.value).toBe(4));
    });

    await step('`steppers="none"` renders no buttons', async () => {
      const none = all[2] as NfEl;
      await waitFor(() => expect(none.classList.contains('hydrated')).toBe(true));
      expect(none.shadowRoot!.querySelectorAll('md-icon-button').length).toBe(0);
    });

    await step('Reset to the seeded resting value', async () => {
      split.value = 3;
      (document.activeElement as HTMLElement | null)?.blur();
      await waitFor(() => expect(split.value).toBe(3));
    });
  },
};

/** `format-options` + `locale` drive an `Intl.NumberFormat` display: currency,
 *  percent (displayed 50% ⇔ value 0.5 — Intl semantics), units, grouping.
 *  Typing and parsing accept the locale's separators, symbols and numerals. */
export const FormattingAndLocale: Story = {
  name: 'Formatting & locale',
  render: () => html`
    <div style="display:flex; flex-direction:column; gap:24px; max-inline-size: 320px;">
      <md-number-field
        variant="outlined"
        label="Preis (EUR, de-DE)"
        locale="de-DE"
        .formatOptions=${{ style: 'currency', currency: 'EUR' } as Intl.NumberFormatOptions}
        .value=${1234.5}
        .step=${0.5}
      ></md-number-field>
      <md-number-field
        variant="outlined"
        label="Discount (percent)"
        .formatOptions=${{ style: 'percent' } as Intl.NumberFormatOptions}
        .value=${0.5}
        .step=${0.01}
        .min=${0}
        .max=${1}
      ></md-number-field>
      <md-number-field
        variant="outlined"
        label="Speed (km/h)"
        .formatOptions=${{ style: 'unit', unit: 'kilometer-per-hour' } as Intl.NumberFormatOptions}
        .value=${88}
      ></md-number-field>
    </div>
  `,
  /** The percent instance proves Intl semantics: display 50% ⇔ value 0.5. */
  play: async ({ canvasElement, step }) => {
    const percent = canvasElement.querySelectorAll('md-number-field')[1] as NfEl;
    await waitFor(() => expect(percent.classList.contains('hydrated')).toBe(true));

    await step('Displayed 50% is the raw value 0.5', async () => {
      await waitFor(() => expect(inputOf(percent).value).toContain('50'));
      expect(percent.value).toBe(0.5);
    });

    await step('Stepping by 0.01 moves the display by one percent point', async () => {
      pressStepper(percent, 'increment');
      await waitFor(() => expect(percent.value).toBe(0.51));
      await waitFor(() => expect(inputOf(percent).value).toContain('51'));
    });

    await step('Reset to the seeded resting value', async () => {
      percent.value = 0.5;
      (document.activeElement as HTMLElement | null)?.blur();
      await waitFor(() => expect(percent.value).toBe(0.5));
    });
  },
};

/** Bounds clamp interactive stepping and disable the steppers at the edges;
 *  `snap-on-step` aligns stepped values to multiples of the step;
 *  `allow-out-of-range` exempts TYPED text from the blur clamp. */
export const MinMaxStep: Story = {
  name: 'Min / max / step',
  render: () => html`
    <div style="display:flex; flex-direction:column; gap:24px; max-inline-size: 320px;">
      <md-number-field variant="outlined" label="0–10, step 1" .min=${0} .max=${10} .value=${10} supporting-text="Increment disables at max"></md-number-field>
      <md-number-field variant="outlined" label="Snap to 25s" .step=${25} snap-on-step .value=${30} supporting-text="ArrowUp from 30 lands on 50"></md-number-field>
      <md-number-field variant="outlined" label="Typed text may exceed 100" .max=${100} allow-out-of-range .value=${250} supporting-text="Stepping still clamps"></md-number-field>
    </div>
  `,
  play: async ({ canvasElement, step }) => {
    const bounded = (await getNf(canvasElement)) as NfEl;

    await step('The increment stepper is disabled at max', async () => {
      await waitFor(() =>
        expect(stepperOf(bounded, 'increment').hasAttribute('disabled')).toBe(true),
      );
      expect(stepperOf(bounded, 'decrement').hasAttribute('disabled')).toBe(false);
    });

    await step('Snapped stepping lands on step multiples', async () => {
      const snap = canvasElement.querySelectorAll('md-number-field')[1] as NfEl;
      await waitFor(() => expect(snap.classList.contains('hydrated')).toBe(true));
      pressStepper(snap, 'increment'); // 30 + 25 = 55 → snaps to 50
      await waitFor(() => expect(snap.value).toBe(50));
      snap.value = 30; // reset the seeded state
      (document.activeElement as HTMLElement | null)?.blur();
      await waitFor(() => expect(snap.value).toBe(30));
    });
  },
};

export const States: Story = {
  render: (_args, { globals }) => html`
    <div style="display:flex; flex-direction:column; gap:24px; max-inline-size: 320px;">
      <md-number-field variant="outlined" label="Enabled" .value=${5}></md-number-field>
      <md-number-field variant="outlined" label="Disabled" disabled .value=${5}></md-number-field>
      <md-number-field variant="outlined" label="Read-only" readonly .value=${5}></md-number-field>
      <md-number-field
        variant="outlined"
        label="${t(globals.locale, 'numberField.quantity')}"
        required
        error
        error-text="${t(globals.locale, 'numberField.enterQuantityError')}"
      ></md-number-field>
      <md-number-field
        variant="outlined"
        label="${t(globals.locale, 'numberField.quantity')}"
        supporting-text="${t(globals.locale, 'numberField.between0and10')}"
        reserve-supporting-space
        .min=${0}
        .max=${10}
      ></md-number-field>
    </div>
  `,
};

export const Density: Story = {
  render: () => html`
    <div style="display:flex; flex-direction:column; gap:24px; max-inline-size: 320px;">
      ${[0, -1, -2, -3, -4].map(
        (d) => html`
          <md-number-field
            variant="outlined"
            density=${d}
            label="Density ${d}"
            .value=${42}
          ></md-number-field>
        `,
      )}
    </div>
  `,
};

/** Logical properties mirror the layout for free; `locale="ar-SA"` also
 *  renders Arabic-Indic numerals through Intl (typing them parses too). */
export const RTL: Story = {
  render: () => html`
    <div dir="rtl" lang="ar" style="display:flex; flex-direction:column; gap:24px; max-inline-size: 320px;">
      <md-number-field variant="outlined" label="الكمية" locale="ar-SA" .value=${1234}></md-number-field>
      <md-number-field variant="outlined" steppers="split" label="الكمية" locale="ar-SA" .value=${7}></md-number-field>
    </div>
  `,
};

/** German + Japanese instances — every text affordance is a prop; the demo
 *  dictionary resolves the toolbar locale (i18n stays in the consumer layer). */
export const Localization: Story = {
  render: (_args, { globals }) => html`
    <div style="display:flex; flex-direction:column; gap:24px; max-inline-size: 320px;">
      <md-number-field
        variant="outlined"
        label="${t(globals.locale, 'numberField.quantity')}"
        supporting-text="${t(globals.locale, 'numberField.between0and10')}"
        increment-label="${t(globals.locale, 'numberField.increment')}"
        decrement-label="${t(globals.locale, 'numberField.decrement')}"
        value-missing-label="${t(globals.locale, 'numberField.enterQuantityError')}"
        .min=${0}
        .max=${10}
        .value=${5}
      ></md-number-field>
      <md-number-field
        variant="outlined"
        label="Menge"
        locale="de-DE"
        increment-label="Erhöhen"
        decrement-label="Verringern"
        .value=${1234.5}
      ></md-number-field>
      <md-number-field
        variant="outlined"
        label="数量"
        locale="ja-JP"
        increment-label="増やす"
        decrement-label="減らす"
        .value=${10000}
      ></md-number-field>
    </div>
  `,
};

/**
 * A plain text input with a numeric keyboard — deliberately NOT
 * `role="spinbutton"` and NOT `type="number"`, so the locale-formatted value
 * stays ordinary readable, editable text. The input is the whole keyboard
 * surface; the steppers are labeled, pointer-only buttons.
 */
export const Accessibility: Story = {
  name: 'Accessibility',
  parameters: {
    docs: {
      description: {
        story:
          'The input stays a plain textbox (`inputmode="numeric|decimal"`), the steppers carry localizable `aria-label`s and `tabindex="-1"` (pointer-only — the input is the keyboard surface), and `required` participates in constraint validation. axe: 0 violations across all stories, light + dark.',
      },
    },
  },
  render: (_args, { globals }) => html`
    <md-number-field
      variant="outlined"
      label="${t(globals.locale, 'numberField.quantity')}"
      required
      increment-label="${t(globals.locale, 'numberField.increment')}"
      decrement-label="${t(globals.locale, 'numberField.decrement')}"
      .min=${0}
      .max=${99}
      .value=${1}
      style="max-inline-size: 320px;"
    ></md-number-field>
    <details style="font: 13px/1.6 system-ui; opacity: 0.85; margin-top: 20px; max-inline-size: 560px;">
      <summary>Keyboard &amp; AT contract</summary>
      <ul style="line-height: 1.9;">
        <li><b>Type</b> — characters are filtered to the active locale/format (digits, separators, sign, symbols).</li>
        <li><b>↑ / ↓</b> — step by <code>step</code>; <b>Alt</b> steps by <code>small-step</code>, <b>Shift</b> by <code>large-step</code>.</li>
        <li><b>Home / End</b> — jump to <code>min</code> / <code>max</code> (only when defined).</li>
        <li><b>Enter</b> — commits like blur and requests form submission.</li>
        <li>Steppers: labeled buttons, <code>tabindex="-1"</code>, press-and-hold auto-repeats; they auto-disable at the bounds.</li>
        <li>No <code>role="spinbutton"</code> — the value is plain, formatted text the user can read and edit directly.</li>
        <li><code>required</code> with no value blocks form submission (ElementInternals validity).</li>
      </ul>
    </details>
  `,
  /** Keyboard contract, scripted: modifier stepping + Home/End. */
  play: async ({ canvasElement, step }) => {
    const nf = await getNf(canvasElement);

    await step('Alt+ArrowUp steps by small-step', async () => {
      inputOf(nf).focus();
      key(fieldOf(nf), 'ArrowUp', { altKey: true });
      await waitFor(() => expect(nf.value).toBe(1.1));
    });

    await step('End jumps to max, Home to min', async () => {
      key(fieldOf(nf), 'End');
      await waitFor(() => expect(nf.value).toBe(99));
      key(fieldOf(nf), 'Home');
      await waitFor(() => expect(nf.value).toBe(0));
    });

    await step('Reset to the seeded resting value', async () => {
      nf.value = 1;
      inputOf(nf).blur();
      (document.activeElement as HTMLElement | null)?.blur();
      await waitFor(() => expect(nf.value).toBe(1));
    });
  },
};

export const CustomCSS: Story = {
  name: 'Custom CSS Properties',
  render: () => html`
    <style>
      .nf-narrow { --md-number-field-width: 220px; --md-number-field-min-width: 220px; }
      .nf-big-steppers { --md-number-field-stepper-icon-size: 24px; --md-number-field-stepper-color: var(--md-sys-color-primary); }
      .nf-tinted { --md-text-field-container-color: var(--md-sys-color-surface-container-high); }
    </style>
    <div style="display:flex; flex-direction:column; gap:24px;">
      <md-number-field class="nf-narrow" variant="outlined" label="Narrow (220px)" .value=${7}></md-number-field>
      <md-number-field class="nf-big-steppers" variant="outlined" label="Primary 24px steppers" .value=${7} style="max-inline-size: 320px;"></md-number-field>
      <md-number-field class="nf-tinted" variant="filled" label="Tinted via md-text-field hook" .value=${7} style="max-inline-size: 320px;"></md-number-field>
    </div>
  `,
};

export const CSSParts: Story = {
  name: 'CSS ::part() Styling',
  render: () => html`
    <style>
      .nf-parts::part(increment) {
        --md-icon-button-icon-color: var(--md-sys-color-primary);
      }
      .nf-parts::part(decrement) {
        --md-icon-button-icon-color: var(--md-sys-color-error);
      }
    </style>
    <md-number-field
      class="nf-parts"
      variant="outlined"
      label="Tinted steppers via ::part()"
      .value=${5}
      style="max-inline-size: 320px;"
    ></md-number-field>
  `,
};

export const DarkTheme: Story = {
  decorators: [
    (story) => html`
      <div data-theme="dark" style="background: var(--md-sys-color-surface, #1c1b1f); padding: 24px; border-radius: 16px;">
        ${story()}
      </div>
    `,
  ],
  render: () => html`
    <div style="display:flex; flex-direction:column; gap:24px; max-inline-size: 320px;">
      <md-number-field variant="outlined" label="Outlined" .value=${42}></md-number-field>
      <md-number-field variant="filled" label="Filled" steppers="split" .value=${42}></md-number-field>
    </div>
  `,
};

export const FormAssociation: Story = {
  render: (_args, { globals }) => html`
    <form
      id="nf-form"
      @submit=${(e: Event) => {
        e.preventDefault();
        const fd = new FormData(e.target as HTMLFormElement);
        console.log('FormData qty:', fd.get('qty'));
      }}
      style="display:flex; flex-direction:column; gap:16px; max-inline-size: 320px;"
    >
      <md-number-field
        name="qty"
        variant="outlined"
        label="${t(globals.locale, 'numberField.quantity')}"
        required
        value-missing-label="${t(globals.locale, 'numberField.enterQuantityError')}"
        .min=${0}
        .max=${99}
      ></md-number-field>
      <md-button type="submit" variant="filled">${t(globals.locale, 'submit')}</md-button>
    </form>
  `,
  /** ElementInternals round-trip: required blocks, filling submits the raw value. */
  play: async ({ canvasElement, step }) => {
    const nf = await getNf(canvasElement);
    const form = canvasElement.querySelector('#nf-form') as HTMLFormElement;

    await step('Empty + required → the form is invalid and FormData has no entry', async () => {
      await waitFor(() => expect(form.checkValidity()).toBe(false));
      expect(new FormData(form).get('qty')).toBeNull();
    });

    await step('Setting a value makes it valid and submits the RAW number', async () => {
      nf.value = 7;
      await waitFor(() => expect(form.checkValidity()).toBe(true));
      await waitFor(() => expect(new FormData(form).get('qty')).toBe('7'));
    });

    await step('Reset to the fresh resting render', async () => {
      nf.value = null;
      await waitFor(() => expect(new FormData(form).get('qty')).toBeNull());
    });
  },
};
