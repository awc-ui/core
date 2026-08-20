import type { Meta, StoryObj } from '@storybook/web-components';
import { expect, waitFor } from 'storybook/test';
import { html } from 'lit';
import { t } from '../i18n';
import { drivingCoverage, exerciseProps } from '../testing/coverage-mode';

/** Shadow-piercing helpers for play(): testing-library queries can't cross
 *  shadow roots, so interactions address the real cell inputs directly —
 *  gated on hydration, since pre-hydration input events are silent no-ops. */
type OtpEl = HTMLElement & {
  value: string;
  length: number;
  setFocus: () => Promise<void>;
  clear: () => Promise<void>;
};

const getOtp = async (canvasElement: HTMLElement, selector = 'md-otp-field'): Promise<OtpEl> => {
  const el = canvasElement.querySelector(selector) as OtpEl;
  await waitFor(() => expect(el.classList.contains('hydrated')).toBe(true));
  return el;
};

const cellsOf = (el: OtpEl): HTMLInputElement[] =>
  Array.from(el.shadowRoot!.querySelectorAll('input'));

/** Type a character the way a user would: focus the cell, land the char in
 *  the DOM, then fire `input` (the component's single entry pipeline). */
const typeInto = (cell: HTMLInputElement, ch: string) => {
  cell.focus();
  cell.value = ch;
  cell.dispatchEvent(new Event('input', { bubbles: true }));
};

/** End a play at visual rest: empty cells, nothing focused. */
const restore = async (el: OtpEl) => {
  await el.clear();
  (el.shadowRoot!.activeElement as HTMLElement | null)?.blur();
};

const SECTION = 'padding: 24px; font-family: Roboto, sans-serif;';
const ROW = 'display: flex; gap: 24px; flex-wrap: wrap; align-items: flex-start;';
const HEADING =
  'margin: 0 0 8px; font: 500 14px/20px Roboto, sans-serif; color: var(--md-sys-color-on-surface, #1C1B1F);';
const SUBTLE =
  'margin: 4px 0 12px; font: 400 12px/16px Roboto, sans-serif; color: var(--md-sys-color-on-surface-variant, #49454F);';

const meta: Meta = {
  title: 'Text Inputs/OTP Field',
  component: 'md-otp-field',
  tags: ['autodocs'],
  parameters: {
    docs: {
      source: { language: 'html' },
    },
  },
  argTypes: {
    length: { control: { type: 'number', min: 1, max: 12 } },
    validationType: {
      name: 'validation-type',
      control: 'select',
      options: ['numeric', 'alpha', 'alphanumeric', 'none'],
    },
    transform: { control: 'inline-radio', options: ['none', 'uppercase'] },
    mask: { control: 'boolean' },
    autoSubmit: { name: 'auto-submit', control: 'boolean' },
    groupSize: { name: 'group-size', control: { type: 'number', min: 0, max: 6 } },
    disabled: { control: 'boolean' },
    readOnly: { name: 'readonly', control: 'boolean' },
    required: { control: 'boolean' },
    error: { control: 'boolean' },
    errorText: { name: 'error-text', control: 'text' },
    supportingText: { name: 'supporting-text', control: 'text' },
    label: { control: 'text' },
    density: { control: 'select', options: [0, -1, -2, -3, -4] },
  },
  args: {
    length: 6,
    validationType: 'numeric',
    transform: 'none',
    mask: false,
    autoSubmit: false,
    groupSize: 0,
    disabled: false,
    readOnly: false,
    required: false,
    error: false,
    errorText: '',
    supportingText: '',
    label: 'One-time code',
    density: 0,
  },
};
export default meta;
type Story = StoryObj;

/* ─── Playground ──────────────────────────────────────────── */
export const Playground: Story = {
  render: (args) => html`
    <md-otp-field
      length=${args.length}
      validation-type=${args.validationType}
      transform=${args.transform}
      ?mask=${args.mask}
      ?auto-submit=${args.autoSubmit}
      group-size=${args.groupSize}
      ?disabled=${args.disabled}
      ?readonly=${args.readOnly}
      ?required=${args.required}
      ?error=${args.error}
      error-text=${args.errorText || ''}
      supporting-text=${args.supportingText || ''}
      label=${args.label}
      density=${args.density}
    ></md-otp-field>
  `,
  parameters: {
    docs: {
      source: {
        code: '<md-otp-field label="One-time code" supporting-text="Enter the 6-digit code"></md-otp-field>',
      },
    },
  },
  /** The core typing contract, scripted (see the Interactions panel). */
  play: async ({ canvasElement, step }) => {
    const otp = await getOtp(canvasElement);

    await step('type a full code — cells fill, mdComplete fires', async () => {
      let completeDetail: { value: string } | undefined;
      otp.addEventListener(
        'mdComplete',
        (e) => {
          completeDetail = (e as CustomEvent<{ value: string }>).detail;
        },
        { once: true },
      );
      const cells = cellsOf(otp);
      const code = '492617';
      code.split('').forEach((ch, i) => typeInto(cells[i], ch));
      await waitFor(() => expect(otp.value).toBe(code));
      await waitFor(() => expect(completeDetail).toEqual({ value: code }));
    });

    await step('rejected characters never land', async () => {
      await restore(otp);
      const cells = cellsOf(otp);
      typeInto(cells[0], 'x'); // numeric field — letters are filtered
      await new Promise((r) => setTimeout(r, 50));
      expect(otp.value).toBe('');
      expect(cells[0].value).toBe('');
    });

    if (drivingCoverage()) {
      await step('exercise visual branches (coverage only)', async () => {
        await exerciseProps(otp, [
          ['mask', true],
          ['error', true],
          ['groupSize', 3],
          ['density', -2],
        ]);
      });
    }

    await step('reset: restore the resting state', async () => {
      await restore(otp);
      await waitFor(() => expect(otp.value).toBe(''));
    });
  },
};

/* ─── Lengths ─────────────────────────────────────────────── */
export const Lengths: Story = {
  render: () => html`
    <div style="${SECTION}">
      <p style="${HEADING}">4-digit PIN</p>
      <md-otp-field length="4" label="4-digit PIN"></md-otp-field>
      <p style="${HEADING} margin-top: 24px;">6-digit code (default)</p>
      <md-otp-field label="6-digit code"></md-otp-field>
      <p style="${HEADING} margin-top: 24px;">8-character code</p>
      <md-otp-field length="8" label="8-character code"></md-otp-field>
    </div>
  `,
};

/* ─── Grouped ─────────────────────────────────────────────── */
export const Grouped: Story = {
  render: () => html`
    <div style="${SECTION}">
      <p style="${HEADING}">group-size="3" — default dot separator</p>
      <md-otp-field group-size="3" label="Grouped code"></md-otp-field>
      <p style="${HEADING} margin-top: 24px;">Custom slotted separator (first gap)</p>
      <md-otp-field length="6" group-size="3" label="Grouped code with dash">
        <span slot="separator" style="font: 500 18px/1 Roboto, sans-serif;">–</span>
      </md-otp-field>
      <p style="${SUBTLE}">
        Slotted separator content fills the first gap; additional gaps repeat the
        built-in dot. Style <code>::part(separator)</code> for uniform custom gaps.
      </p>
    </div>
  `,
  parameters: {
    docs: {
      source: {
        code: `<md-otp-field group-size="3" label="Grouped code"></md-otp-field>

<md-otp-field group-size="3" label="Grouped code with dash">
  <span slot="separator">–</span>
</md-otp-field>`,
      },
    },
  },
};

/* ─── Masked ──────────────────────────────────────────────── */
export const Masked: Story = {
  render: () => html`
    <div style="${SECTION}">
      <md-otp-field
        length="4"
        mask
        label="PIN"
        supporting-text="Your PIN stays hidden on shared screens"
        value="1234"
      ></md-otp-field>
    </div>
  `,
};

/* ─── Alphanumeric ────────────────────────────────────────── */
export const Alphanumeric: Story = {
  render: () => html`
    <div style="${SECTION}">
      <md-otp-field
        length="8"
        validation-type="alphanumeric"
        transform="uppercase"
        label="Recovery code"
        supporting-text="Letters are stored uppercase automatically"
      ></md-otp-field>
    </div>
  `,
  /** transform="uppercase" recovers lowercase entry. */
  play: async ({ canvasElement, step }) => {
    const otp = await getOtp(canvasElement);
    await step('a lowercase keystroke lands uppercase', async () => {
      typeInto(cellsOf(otp)[0], 'a');
      await waitFor(() => expect(otp.value).toBe('A'));
      await waitFor(() => expect(cellsOf(otp)[0].value).toBe('A'));
    });
    await step('reset: restore the resting state', async () => {
      await restore(otp);
      await waitFor(() => expect(otp.value).toBe(''));
    });
  },
};

/* ─── AutoSubmitForm ──────────────────────────────────────── */
export const AutoSubmitForm: Story = {
  render: () => html`
    <form
      style="${SECTION} display: flex; flex-direction: column; gap: 12px; align-items: flex-start;"
      @submit=${(e: Event) => {
        e.preventDefault();
        const status = (e.currentTarget as HTMLElement).querySelector('[data-status]');
        if (status) status.textContent = 'Submitted ✓';
      }}
    >
      <md-otp-field
        name="code"
        auto-submit
        label="One-time code"
        supporting-text="The form submits the moment the code is complete"
      ></md-otp-field>
      <p data-status role="status" style="${SUBTLE} margin: 0;">Waiting for a complete code…</p>
    </form>
  `,
  parameters: {
    docs: {
      source: {
        code: `<form id="verify">
  <md-otp-field name="code" auto-submit label="One-time code"></md-otp-field>
</form>
\x3Cscript>
  document.getElementById('verify').addEventListener('submit', (e) => {
    e.preventDefault(); // verify new FormData(e.target).get('code') server-side
  });
\x3C/script>`,
      },
    },
  },
  /** Completion drives form.requestSubmit() — intercepted so the iframe never navigates. */
  play: async ({ canvasElement, step }) => {
    const otp = await getOtp(canvasElement);
    const status = canvasElement.querySelector('[data-status]') as HTMLElement;

    await step('a complete code submits the form', async () => {
      const cells = cellsOf(otp);
      '135791'.split('').forEach((ch, i) => typeInto(cells[i], ch));
      await waitFor(() => expect(status.textContent).toBe('Submitted ✓'));
    });

    await step('reset: restore the resting state', async () => {
      await restore(otp);
      status.textContent = 'Waiting for a complete code…';
      await waitFor(() => expect(otp.value).toBe(''));
    });
  },
};

/* ─── States ──────────────────────────────────────────────── */
export const States: Story = {
  name: 'States (Enabled / Error / Disabled / Read-only)',
  render: () => html`
    <div style="${SECTION} ${ROW}">
      <div>
        <p style="${HEADING}">Enabled</p>
        <md-otp-field label="Enabled code" supporting-text="Check your phone"></md-otp-field>
      </div>
      <div>
        <p style="${HEADING}">Error</p>
        <md-otp-field
          label="Wrong code"
          value="492617"
          error
          error-text="That code is incorrect — try again"
        ></md-otp-field>
      </div>
      <div>
        <p style="${HEADING}">Disabled</p>
        <md-otp-field label="Disabled code" value="12" disabled></md-otp-field>
      </div>
      <div>
        <p style="${HEADING}">Read-only</p>
        <md-otp-field label="Read-only code" value="492617" readonly></md-otp-field>
      </div>
    </div>
  `,
};

/* ─── Density ─────────────────────────────────────────────── */
export const Density: Story = {
  render: () => html`
    <div style="${SECTION}">
      ${[0, -1, -2, -3, -4].map(
        (d) => html`
          <p style="${HEADING} margin-top: ${d === 0 ? '0' : '20px'};">density="${d}"</p>
          <md-otp-field density=${d} value="4926" length="4" label="Code at density ${d}"></md-otp-field>
        `,
      )}
    </div>
  `,
};

/* ─── RTL ─────────────────────────────────────────────────── */
export const RTL: Story = {
  render: () => html`
    <div dir="rtl" lang="ar" style="${SECTION}">
      <p style="${HEADING}">رمز التحقق لمرة واحدة</p>
      <md-otp-field
        label="رمز التحقق لمرة واحدة"
        supporting-text="أدخل الرمز المكوَّن من 6 أرقام"
        cell-label-template="الحرف {index} من {length}"
        value="123"
      ></md-otp-field>
      <p style="${SUBTLE}">
        The supporting line follows the RTL document direction, but the cell row
        itself stays LTR — codes read left-to-right in RTL locales too.
      </p>
    </div>
  `,
};

/* ─── Localization ────────────────────────────────────────── */
export const Localization: Story = {
  render: (_args, { globals }) => html`
    <div style="${SECTION} max-inline-size: 420px;">
      <p style="${HEADING}">${t(globals.locale, 'otpField.heading')}</p>
      <md-otp-field
        label=${t(globals.locale, 'otpField.label')}
        supporting-text=${t(globals.locale, 'otpField.supporting')}
        cell-label-template=${t(globals.locale, 'otpField.cellLabel')}
        value-missing-label=${t(globals.locale, 'otpField.incomplete')}
        required
      ></md-otp-field>
    </div>
  `,
  parameters: {
    docs: {
      description: {
        story:
          'Every user-facing string — the group label, supporting text, the per-cell ' +
          '`cell-label-template` (with `{index}`/`{length}` placeholders) and the ' +
          'constraint-validation messages — is a prop, resolved here from the demo ' +
          'dictionary via the Locale toolbar. The component itself stays i18n-engine-agnostic.',
      },
    },
  },
};

/* ─── Accessibility ───────────────────────────────────────── */
export const Accessibility: Story = {
  render: () => html`
    <div style="${SECTION} max-inline-size: 460px;">
      <p style="${HEADING}">Verify your identity</p>
      <p style="${SUBTLE}">
        The cells sit in a <code>role="group"</code> named by <code>label</code>; every
        cell carries its own positional <code>aria-label</code> and references the
        supporting line via <code>aria-describedby</code> (same shadow scope — the
        IDREF resolves).
      </p>
      <md-otp-field
        label="One-time code"
        supporting-text="Enter the 6-digit code we sent to your phone"
        required
      ></md-otp-field>
    </div>
  `,
  /** Read-only ARIA assertions — no state is mutated. */
  play: async ({ canvasElement, step }) => {
    const otp = await getOtp(canvasElement);
    await step('group and per-cell names are wired', async () => {
      const group = otp.shadowRoot!.querySelector('[part="cells"]')!;
      expect(group.getAttribute('role')).toBe('group');
      expect(group.getAttribute('aria-label')).toBe('One-time code');
      const cells = cellsOf(otp);
      expect(cells[0].getAttribute('aria-label')).toBe('Character 1 of 6');
      expect(cells[5].getAttribute('aria-label')).toBe('Character 6 of 6');
      expect(cells[0].getAttribute('aria-describedby')).toBeTruthy();
    });
  },
};

/* ─── Custom CSS Properties ───────────────────────────────── */
export const CustomCSS: Story = {
  name: 'Custom CSS Properties',
  render: () => html`
    <div style="${SECTION} ${ROW}">
      <div>
        <p style="${HEADING}">Tertiary focus, pill cells</p>
        <md-otp-field
          label="Themed code"
          value="49"
          style="--md-otp-field-focus-color: var(--md-sys-color-tertiary, #7D5260); --md-otp-field-cell-shape: 999px;"
        ></md-otp-field>
      </div>
      <div>
        <p style="${HEADING}">Compact custom metrics</p>
        <md-otp-field
          label="Compact code"
          value="49"
          style="--md-otp-field-cell-width: 36px; --md-otp-field-cell-height: 44px; --md-otp-field-cell-gap: 4px; --md-otp-field-font-size: 18px;"
        ></md-otp-field>
      </div>
    </div>
  `,
};

/* ─── CSS ::part() Styling ────────────────────────────────── */
export const CSSParts: Story = {
  name: 'CSS ::part() Styling',
  render: () => html`
    <style>
      .otp-parts-demo::part(cell) {
        background: var(--md-sys-color-surface-container-highest, #E6E0E9);
        border-color: transparent;
      }
      .otp-parts-demo::part(supporting-text) {
        font-style: italic;
      }
      .otp-parts-demo::part(separator) {
        color: var(--md-sys-color-primary, #6750A4);
      }
    </style>
    <div style="${SECTION}">
      <md-otp-field
        class="otp-parts-demo"
        group-size="3"
        label="Part-styled code"
        supporting-text="Filled cells via ::part(cell)"
        value="492"
      ></md-otp-field>
    </div>
  `,
};

/* ─── Dark theme ──────────────────────────────────────────── */
export const DarkTheme: Story = {
  decorators: [
    (story) => html`
      <div
        data-theme="dark"
        style="background: var(--md-sys-color-surface, #1C1B1F); padding: 32px; border-radius: 12px;"
      >
        ${story()}
      </div>
    `,
  ],
  render: () => html`
    <div style="${ROW}">
      <md-otp-field label="Dark code" value="492"></md-otp-field>
      <md-otp-field
        label="Dark error"
        value="492617"
        error
        error-text="That code is incorrect — try again"
      ></md-otp-field>
    </div>
  `,
};
