import type { Meta, StoryObj } from '@storybook/web-components';
import { expect, waitFor } from 'storybook/test';
import { html } from 'lit';
import { t } from '../i18n';

/** Shadow-piercing helpers for play(): testing-library queries can't cross
 *  shadow roots, so interactions address the real internals directly. For
 *  md-checkbox the interactive surface IS the host (role="checkbox" with
 *  reflected `checked`/`aria-checked`), so helpers target it and wait for
 *  hydration — pre-hydration clicks are silent no-ops. */
type CbEl = HTMLElement & { checked: boolean; indeterminate: boolean };
const getCb = async (canvasElement: HTMLElement): Promise<CbEl> => {
  const cb = canvasElement.querySelector('md-checkbox') as CbEl;
  await waitFor(() => expect(cb.classList.contains('hydrated')).toBe(true));
  return cb;
};
const key = (target: Element, k: string) =>
  target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, composed: true }));
const pointer = (target: Element, type: string) =>
  target.dispatchEvent(new PointerEvent(type, { bubbles: true, composed: true }));

/** A checkbox addressed by its DOM id inside the story canvas (light DOM), with
 *  hydration awaited — pre-hydration clicks/prop-sets are silent no-ops. */
type CbCtl = CbEl & { disabled: boolean };
const getCbById = async (canvasElement: HTMLElement, id: string): Promise<CbEl> => {
  const cb = canvasElement.querySelector(`#${id}`) as CbEl;
  await waitFor(() => expect(cb.classList.contains('hydrated')).toBe(true));
  return cb;
};

const sectionLabelStyle =
  'margin: 0 0 8px; font-size: 12px; font-weight: 500; letter-spacing: 0.04em; text-transform: uppercase; color: var(--md-sys-color-on-surface-variant);';

const viewportFrame = (label: string, width: string, content: unknown) => html`
  <div style="margin-block-end: 16px;">
    <p style="${sectionLabelStyle}">${label}</p>
    <div
      style="inline-size: ${width}; max-inline-size: 100%; box-sizing: border-box;
             border: 1px dashed var(--md-sys-color-outline-variant);
             border-radius: var(--md-sys-shape-corner-medium, 12px);
             overflow: hidden; background: var(--md-sys-color-surface);
             padding: 12px;"
    >
      ${content}
    </div>
  </div>
`;

// align-items: center, not flex-start. md-checkbox's host IS its 48px touch
// target with the visible 24px box centred inside it, so flex-start aligned the
// TARGET's top edge to the text and dropped the visible box ~12px below the
// label. Centring aligns what you can actually see.
const l10nLabelRowStyle =
  'display: flex; align-items: center; gap: 8px; cursor: pointer; max-inline-size: 100%; min-inline-size: 0; font: var(--md-sys-typescale-body-large-weight, 400) var(--md-sys-typescale-body-large-size, 16px)/var(--md-sys-typescale-body-large-line-height, 24px) var(--md-sys-typescale-body-large-font, Roboto, sans-serif); color: var(--md-sys-color-on-surface, #1C1B1F);';

const l10nEllipsisTextStyle =
  'overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-inline-size: 0; flex: 1 1 auto;';

const l10nSupportingStyle =
  'font: var(--md-sys-typescale-body-small-weight, 400) var(--md-sys-typescale-body-small-size, 12px)/var(--md-sys-typescale-body-small-line-height, 16px) var(--md-sys-typescale-body-small-font, Roboto, sans-serif); color: var(--md-sys-color-on-surface-variant, #49454F); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';

const longGermanLabel =
  'Ich stimme den Benachrichtigungseinstellungen und Datenschutzrichtlinien für mein Konto zu';
const longGermanSupporting =
  'Verwalten Sie E-Mail-, Push- und SMS-Benachrichtigungen in allen verbundenen Geräten';
const pseudoLabel =
  'Śęţťįñğš åřę şűşťäįņęď ŵĥēŗē ţĥēŷ ēхčēęđ ţĥē ŗōŵ šűŗŗőūŉđįņğ ţēхţ';
const pseudoSupporting = 'Ṕşęűďŏ-ľŏĉąľįżąţįŏń đēмŏ · ęľľįşş ţēśţ';

const meta: Meta = {
  title: 'Selection/Checkbox',
  component: 'md-checkbox',
  tags: ['autodocs'],
  parameters: {
    docs: {
      source: { language: 'html' },
    },
  },
  argTypes: {
    checked: {
      control: 'boolean',
      description: 'Whether the checkbox is checked',
    },
    indeterminate: {
      control: 'boolean',
      description: 'Whether the checkbox is in the indeterminate (mixed) state',
    },
    disabled: {
      control: 'boolean',
      description: 'Disables the checkbox',
    },
    softDisabled: {
      control: 'boolean',
      description: 'Soft-disabled: disabled visuals but focusable',
    },
    required: {
      control: 'boolean',
      description: 'Mark as required in a form',
    },
  },
  args: {
    checked: false,
    indeterminate: false,
    disabled: false,
    softDisabled: false,
    required: false,
  },
};
export default meta;
type Story = StoryObj;

/* ─── Playground ──────────────────────────────────────────── */
export const Playground: Story = {
  render: (args) => html`
    <md-checkbox
      aria-label="Checkbox"
      ?checked=${args.checked}
      ?indeterminate=${args.indeterminate}
      ?disabled=${args.disabled}
      ?soft-disabled=${args.softDisabled}
      ?required=${args.required}
    ></md-checkbox>
  `,
  /** Pointer + keyboard toggle flow, scripted (see the Interactions panel). */
  play: async ({ canvasElement, step }) => {
    const cb = await getCb(canvasElement);

    await step('Click toggles the checkbox on and emits mdChange', async () => {
      let detail: { checked: boolean; indeterminate: boolean } | undefined;
      cb.addEventListener(
        'mdChange',
        (e) => { detail = (e as CustomEvent).detail; },
        { once: true },
      );
      cb.click();
      await waitFor(() => expect(cb.checked).toBe(true));
      // The property flips synchronously; the reflected attributes land on the
      // next render flush — so these must wait too.
      await waitFor(() => expect(cb.getAttribute('aria-checked')).toBe('true'));
      await waitFor(() => expect(cb.hasAttribute('checked')).toBe(true));
      await waitFor(() => expect(cb.classList.contains('md-checkbox--checked')).toBe(true));
      expect(detail).toEqual({ checked: true, indeterminate: false });
    });

    await step('Space (keyboard) toggles it back off', async () => {
      cb.focus();
      expect(document.activeElement).toBe(cb);
      key(cb, ' ');
      await waitFor(() => expect(cb.checked).toBe(false));
      await waitFor(() => expect(cb.getAttribute('aria-checked')).toBe('false'));
      await waitFor(() => expect(cb.hasAttribute('checked')).toBe(false));
      // Space arms a 150 ms pressed/ripple timer — let it clear before the
      // play returns so teardown doesn't race it.
      await waitFor(() => expect(cb.classList.contains('md-checkbox--pressed')).toBe(false));
    });

    await step('Enter (a non-Space key) is ignored — no toggle, no mdChange', async () => {
      const before = cb.checked; // false after the previous step
      let emitted = false;
      cb.addEventListener('mdChange', () => { emitted = true; }, { once: true });
      key(cb, 'Enter'); // handleKeyDown runs, but the `key === ' '` guard is false
      await new Promise((r) => setTimeout(r, 0));
      expect(cb.checked).toBe(before); // state untouched (Enter never activates, per spec)
      expect(emitted).toBe(false);
    });

    await step('Pointer press drives the pressed state layer on, then back off', async () => {
      expect(cb.classList.contains('md-checkbox--pressed')).toBe(false); // baseline
      pointer(cb, 'pointerdown'); // handlePointerDown → pressed=true
      await waitFor(() => expect(cb.classList.contains('md-checkbox--pressed')).toBe(true));
      pointer(cb, 'pointerup'); // handlePointerUp → pressed=false
      await waitFor(() => expect(cb.classList.contains('md-checkbox--pressed')).toBe(false));
      // pointerdown/up never synthesize a click, so checked stays put
      expect(cb.checked).toBe(false);
    });
  },
};

/* ─── All States ──────────────────────────────────────────── */
export const AllStates: Story = {
  render: () => html`
    <div style="display: flex; gap: 32px; align-items: center; flex-wrap: wrap;">
      <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
        <md-checkbox aria-label="Unchecked"></md-checkbox>
        <span style="font-size: 12px; color: var(--md-sys-color-on-surface-variant, #49454F);">Unchecked</span>
      </div>
      <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
        <md-checkbox aria-label="Checked" checked></md-checkbox>
        <span style="font-size: 12px; color: var(--md-sys-color-on-surface-variant, #49454F);">Checked</span>
      </div>
      <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
        <md-checkbox aria-label="Indeterminate" indeterminate></md-checkbox>
        <span style="font-size: 12px; color: var(--md-sys-color-on-surface-variant, #49454F);">Indeterminate</span>
      </div>
    </div>
  `,
};

/* ─── With Labels ─────────────────────────────────────────── */
export const WithLabels: Story = {
  render: (_args, { globals }) => html`
    <div style="display: flex; flex-direction: column; gap: 12px;">
      <label style="display: inline-flex; align-items: center; gap: 8px; cursor: pointer; font: var(--md-sys-typescale-body-large-weight, 400) var(--md-sys-typescale-body-large-size, 16px)/var(--md-sys-typescale-body-large-line-height, 24px) var(--md-sys-typescale-body-large-font, Roboto, sans-serif); color: var(--md-sys-color-on-surface, #1C1B1F);">
        <md-checkbox aria-label=${t(globals.locale, 'checkbox.acceptTerms')}></md-checkbox>
        ${t(globals.locale, 'checkbox.acceptTerms')}
      </label>
      <label style="display: inline-flex; align-items: center; gap: 8px; cursor: pointer; font: var(--md-sys-typescale-body-large-weight, 400) var(--md-sys-typescale-body-large-size, 16px)/var(--md-sys-typescale-body-large-line-height, 24px) var(--md-sys-typescale-body-large-font, Roboto, sans-serif); color: var(--md-sys-color-on-surface, #1C1B1F);">
        <md-checkbox aria-label=${t(globals.locale, 'checkbox.subscribeNewsletter')} checked></md-checkbox>
        ${t(globals.locale, 'checkbox.subscribeNewsletter')}
      </label>
      <label style="display: inline-flex; align-items: center; gap: 8px; cursor: pointer; font: var(--md-sys-typescale-body-large-weight, 400) var(--md-sys-typescale-body-large-size, 16px)/var(--md-sys-typescale-body-large-line-height, 24px) var(--md-sys-typescale-body-large-font, Roboto, sans-serif); color: var(--md-sys-color-on-surface, #1C1B1F);">
        <md-checkbox aria-label=${t(globals.locale, 'checkbox.unavailableOption')} disabled></md-checkbox>
        ${t(globals.locale, 'checkbox.unavailableOption')}
      </label>
    </div>
  `,
};

/* ─── Dual-State Checkbox Group (WAI-ARIA) ────────────────── */
export const MultiSelectList: Story = {
  render: (_args, { globals }) => html`
    <fieldset
      role="group"
      aria-labelledby="toppings-legend"
      style="border: 1px solid var(--md-sys-color-outline-variant, #CAC4D0); border-radius: 12px; padding: 16px;"
    >
      <legend
        id="toppings-legend"
        style="padding: 0 8px; font: var(--md-sys-typescale-title-medium-weight, 500) var(--md-sys-typescale-title-medium-size, 16px)/var(--md-sys-typescale-title-medium-line-height, 24px) var(--md-sys-typescale-title-medium-font, Roboto, sans-serif); color: var(--md-sys-color-on-surface, #1C1B1F);"
      >
        ${t(globals.locale, 'checkbox.selectToppings')}
      </legend>
      <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 8px;">
        ${['pepperoni', 'mushrooms', 'olives', 'onions', 'bellPeppers'].map((topping, i) => {
          const label = t(globals.locale, `checkbox.${topping}`);
          return html`
            <label style="display: inline-flex; align-items: center; gap: 8px; cursor: pointer; font: 400 14px/20px Roboto, sans-serif; color: var(--md-sys-color-on-surface, #1C1B1F);">
              <md-checkbox aria-label=${label} ?checked=${i < 2}></md-checkbox>
              ${label}
            </label>
          `;
        })}
      </div>
    </fieldset>
  `,
};

/* ─── Mixed-State (Tri-State) Checkbox — WAI-ARIA Pattern ── */
export const IndeterminateParentChild: Story = {
  render: (_args, { globals }) => {
    const syncParent = () => {
      const parent = document.querySelector('#mixed-parent') as any;
      const children = Array.from(document.querySelectorAll('.mixed-child')) as any[];
      if (!parent || !children.length) return;

      const checkedCount = children.filter((c) => c.checked).length;

      if (checkedCount === 0) {
        parent.checked = false;
        parent.indeterminate = false;
      } else if (checkedCount === children.length) {
        parent.checked = true;
        parent.indeterminate = false;
      } else {
        parent.checked = false;
        parent.indeterminate = true;
      }
    };

    const handleParentChange = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const children = Array.from(document.querySelectorAll('.mixed-child')) as any[];
      children.forEach((c) => {
        c.checked = detail.checked;
        c.indeterminate = false;
      });
    };

    const labelStyle = 'display: inline-flex; align-items: center; gap: 8px; cursor: pointer; color: var(--md-sys-color-on-surface, #1C1B1F);';

    return html`
      <fieldset
        style="border: 1px solid var(--md-sys-color-outline-variant, #CAC4D0); border-radius: 12px; padding: 16px;"
      >
        <legend
          id="mixed-group-label"
          style="padding: 0 8px; font: 500 16px/24px Roboto, sans-serif; color: var(--md-sys-color-on-surface, #1C1B1F);"
        >
          ${t(globals.locale, 'checkbox.installOptions')}
        </legend>

        <div style="display: flex; flex-direction: column; gap: 4px; margin-top: 8px;">
          <!-- Tri-state parent: controls entire group -->
          <label style="${labelStyle} font: 500 14px/20px Roboto, sans-serif;">
            <md-checkbox aria-label=${t(globals.locale, 'checkbox.selectAll')}
              indeterminate
              id="mixed-parent"
              aria-controls="opt-a opt-b opt-c"
              @mdChange=${handleParentChange}
            ></md-checkbox>
            ${t(globals.locale, 'checkbox.selectAll')}
          </label>

          <!-- Child group with role="group" and aria-labelledby -->
          <div
            role="group"
            aria-labelledby="mixed-group-label"
            style="display: flex; flex-direction: column; gap: 4px; padding-inline-start: 32px;"
          >
            <label style="${labelStyle} font: 400 14px/20px Roboto, sans-serif;">
              <md-checkbox aria-label=${t(globals.locale, 'checkbox.documentation')} checked class="mixed-child" id="opt-a" @mdChange=${syncParent}></md-checkbox>
              ${t(globals.locale, 'checkbox.documentation')}
            </label>
            <label style="${labelStyle} font: 400 14px/20px Roboto, sans-serif;">
              <md-checkbox aria-label=${t(globals.locale, 'checkbox.codeSamples')} class="mixed-child" id="opt-b" @mdChange=${syncParent}></md-checkbox>
              ${t(globals.locale, 'checkbox.codeSamples')}
            </label>
            <label style="${labelStyle} font: 400 14px/20px Roboto, sans-serif;">
              <md-checkbox aria-label=${t(globals.locale, 'checkbox.developerTools')} checked class="mixed-child" id="opt-c" @mdChange=${syncParent}></md-checkbox>
              ${t(globals.locale, 'checkbox.developerTools')}
            </label>
          </div>
        </div>
      </fieldset>

      <div style="margin-top: 16px; padding: 12px 16px; background: var(--md-sys-color-surface-variant, #E7E0EC); border-radius: 8px; font: 400 13px/18px Roboto, sans-serif; color: var(--md-sys-color-on-surface-variant, #49454F);">
        <strong>WAI-ARIA Mixed-State pattern:</strong>
        The tri-state "Select all" checkbox uses <code>aria-checked="mixed"</code>
        when some children are checked. Checking it checks all; unchecking it unchecks all.
        Each child is a standard dual-state checkbox. The group uses
        <code>role="group"</code> with <code>aria-labelledby</code>. Keyboard: <kbd>Space</kbd> toggles.
      </div>
    `;
  },
  /** Tri-state parent ⇄ children wiring, scripted (see the Interactions panel). */
  play: async ({ canvasElement, step }) => {
    const parent = await getCbById(canvasElement, 'mixed-parent');
    const [a, b, c] = ['opt-a', 'opt-b', 'opt-c'].map(
      (id) => canvasElement.querySelector(`#${id}`) as CbEl,
    );
    const checkedCount = () => [a, b, c].filter((cb) => cb.checked).length;

    await step('Seeded mixed: 2 of 3 children checked → parent is "mixed"', async () => {
      expect(checkedCount()).toBe(2); // opt-a + opt-c seeded checked, opt-b not
      expect(parent.indeterminate).toBe(true);
      expect(parent.getAttribute('aria-checked')).toBe('mixed');
    });

    await step('Clicking the parent checks ALL children and emits mdChange', async () => {
      let detail: { checked: boolean; indeterminate: boolean } | undefined;
      parent.addEventListener('mdChange', (e) => { detail = (e as CustomEvent).detail; }, { once: true });
      const before = checkedCount(); // 2
      parent.click(); // indeterminate parent → checked, fans out to children
      await waitFor(() => expect(checkedCount()).toBe(3)); // proves it GREW to all
      expect(before).toBe(2);
      expect(detail).toEqual({ checked: true, indeterminate: false }); // real emitted payload
      await waitFor(() => expect(parent.getAttribute('aria-checked')).toBe('true'));
      expect(parent.indeterminate).toBe(false);
    });

    await step('Unchecking one child flips the parent back to "mixed"', async () => {
      const before = parent.getAttribute('aria-checked'); // 'true'
      let childFired = false;
      a.addEventListener('mdChange', () => { childFired = true; }, { once: true });
      a.click();
      await waitFor(() => expect(a.checked).toBe(false));
      expect(childFired).toBe(true); // the child itself emitted (user toggle)
      await waitFor(() => expect(parent.getAttribute('aria-checked')).not.toBe(before)); // it MOVED
      expect(parent.getAttribute('aria-checked')).toBe('mixed'); // ...to mixed
      expect(parent.indeterminate).toBe(true);
      expect(checkedCount()).toBe(2);
    });

    await step('Unchecking the rest drives the parent to fully unchecked, not mixed (guard)', async () => {
      const before = parent.getAttribute('aria-checked'); // 'mixed'
      b.click();
      c.click();
      await waitFor(() => expect(checkedCount()).toBe(0));
      await waitFor(() => expect(parent.getAttribute('aria-checked')).not.toBe(before));
      expect(parent.getAttribute('aria-checked')).toBe('false'); // 0-count branch, NOT 'mixed'
      expect(parent.indeterminate).toBe(false);
      expect(parent.checked).toBe(false);
    });
  },
};

/* ─── Disabled States ─────────────────────────────────────── */
export const States: Story = {
  render: () => html`
    <div style="display: flex; gap: 32px; align-items: center; flex-wrap: wrap;">
      <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
        <md-checkbox aria-label="Enabled"></md-checkbox>
        <span style="font-size: 12px;">Enabled</span>
      </div>
      <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
        <md-checkbox aria-label="Checked" checked></md-checkbox>
        <span style="font-size: 12px;">Checked</span>
      </div>
      <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
        <md-checkbox aria-label="Disabled" disabled></md-checkbox>
        <span style="font-size: 12px;">Disabled</span>
      </div>
      <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
        <md-checkbox aria-label="Disabled Checked" checked disabled></md-checkbox>
        <span style="font-size: 12px;">Disabled Checked</span>
      </div>
      <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
        <md-checkbox aria-label="Disabled Indeterminate" indeterminate disabled></md-checkbox>
        <span style="font-size: 12px;">Disabled Indeterminate</span>
      </div>
      <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
        <md-checkbox aria-label="Soft-disabled" soft-disabled></md-checkbox>
        <span style="font-size: 12px;">Soft-disabled</span>
      </div>
      <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
        <md-checkbox aria-label="Soft-disabled Checked" checked soft-disabled></md-checkbox>
        <span style="font-size: 12px;">Soft-disabled Checked</span>
      </div>
    </div>
  `,
};

/* ─── RTL ─────────────────────────────────────────────────── */
export const RTL: Story = {
  render: () => html`
    <div dir="rtl" style="display: flex; flex-direction: column; gap: 12px;">
      <label style="display: inline-flex; align-items: center; gap: 8px; cursor: pointer; font: 400 14px/20px Roboto, sans-serif; color: var(--md-sys-color-on-surface, #1C1B1F);">
        <md-checkbox aria-label="خيار محدد" checked></md-checkbox>
        خيار محدد
      </label>
      <label style="display: inline-flex; align-items: center; gap: 8px; cursor: pointer; font: 400 14px/20px Roboto, sans-serif; color: var(--md-sys-color-on-surface, #1C1B1F);">
        <md-checkbox aria-label="خيار غير محدد"></md-checkbox>
        خيار غير محدد
      </label>
      <label style="display: inline-flex; align-items: center; gap: 8px; cursor: pointer; font: 400 14px/20px Roboto, sans-serif; color: var(--md-sys-color-on-surface, #1C1B1F);">
        <md-checkbox aria-label="حالة مختلطة" indeterminate></md-checkbox>
        حالة مختلطة
      </label>
    </div>
  `,
};

/* ─── Dark Theme ──────────────────────────────────────────── */
export const DarkTheme: Story = {
  render: () => html`
    <div style="display: flex; gap: 32px; align-items: center; flex-wrap: wrap;">
      <md-checkbox aria-label="Unchecked"></md-checkbox>
      <md-checkbox aria-label="Checked" checked></md-checkbox>
      <md-checkbox aria-label="Indeterminate" indeterminate></md-checkbox>
      <md-checkbox aria-label="Disabled" disabled></md-checkbox>
      <md-checkbox aria-label="Checked and disabled" checked disabled></md-checkbox>
    </div>
  `,
  decorators: [
    (story) => html`
      <div data-theme="dark" style="background: var(--md-sys-color-surface, #1C1B1F); padding: 24px; border-radius: 16px;">
        ${story()}
      </div>
    `,
  ],
};

/* ─── Custom CSS ──────────────────────────────────────────── */
export const CustomCSS: Story = {
  render: () => html`
    <style>
      .error-cb { --md-checkbox-selected-container-color: var(--md-sys-color-error, #B3261E); --md-checkbox-outline-color: var(--md-sys-color-error, #B3261E); }
      .brand-cb { --md-checkbox-selected-container-color: #6200ee; --md-checkbox-outline-color: #6200ee; }
      .large-cb { --md-checkbox-container-size: 24px; --md-checkbox-icon-size: 24px; --md-checkbox-state-layer-size: 48px; }
    </style>
    <div style="display: flex; gap: 32px; align-items: center; flex-wrap: wrap;">
      <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
        <md-checkbox aria-label="Error" checked class="error-cb"></md-checkbox>
        <span style="font-size: 12px;">Error</span>
      </div>
      <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
        <md-checkbox aria-label="Brand" checked class="brand-cb"></md-checkbox>
        <span style="font-size: 12px;">Brand</span>
      </div>
      <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
        <md-checkbox aria-label="Large" checked class="large-cb"></md-checkbox>
        <span style="font-size: 12px;">Large</span>
      </div>
      <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
        <md-checkbox aria-label="Inline" checked style="--md-checkbox-selected-container-color: coral;"></md-checkbox>
        <span style="font-size: 12px;">Inline</span>
      </div>
    </div>
  `,
};

/* ─── CSS Parts ───────────────────────────────────────────── */
export const CSSParts: Story = {
  render: () => html`
    <style>
      .round-cb::part(container) { border-radius: 50%; }
      .shadow-cb::part(container) { box-shadow: 0 2px 4px rgba(0,0,0,.2); }
    </style>
    <div style="display: flex; gap: 32px; align-items: center; flex-wrap: wrap;">
      <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
        <md-checkbox aria-label="Round" checked class="round-cb"></md-checkbox>
        <span style="font-size: 12px;">Round</span>
      </div>
      <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
        <md-checkbox aria-label="Shadow" checked class="shadow-cb"></md-checkbox>
        <span style="font-size: 12px;">Shadow</span>
      </div>
    </div>
  `,
};

/* ─── Uncontrolled (Internal State) ───────────────────────── */
export const Uncontrolled: Story = {
  render: () => {
    const log = (label: string) => (e: Event) => {
      const d = (e as CustomEvent).detail;
      const el = document.getElementById('uncontrolled-log')!;
      const line = document.createElement('div');
      line.textContent = `${label}: checked=${d.checked}, indeterminate=${d.indeterminate}`;
      el.prepend(line);
      if (el.children.length > 8) el.lastElementChild?.remove();
    };

    return html`
      <div style="display: flex; flex-direction: column; gap: 24px;">
        <div>
          <h3 style="font: 500 14px/20px Roboto, sans-serif; color: var(--md-sys-color-on-surface, #1C1B1F); margin: 0 0 12px;">
            Uncontrolled — checkbox manages its own state
          </h3>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <label style="display: inline-flex; align-items: center; gap: 8px; cursor: pointer; font: 400 14px/20px Roboto, sans-serif; color: var(--md-sys-color-on-surface, #1C1B1F);">
              <md-checkbox aria-label="Lettuce" @mdChange=${log('Lettuce')}></md-checkbox>
              Lettuce
            </label>
            <label style="display: inline-flex; align-items: center; gap: 8px; cursor: pointer; font: 400 14px/20px Roboto, sans-serif; color: var(--md-sys-color-on-surface, #1C1B1F);">
              <md-checkbox aria-label="Tomato" checked @mdChange=${log('Tomato')}></md-checkbox>
              Tomato
            </label>
            <label style="display: inline-flex; align-items: center; gap: 8px; cursor: pointer; font: 400 14px/20px Roboto, sans-serif; color: var(--md-sys-color-on-surface, #1C1B1F);">
              <md-checkbox aria-label="Onion" @mdChange=${log('Onion')}></md-checkbox>
              Onion
            </label>
          </div>
        </div>

        <div id="uncontrolled-log" style="padding: 12px 16px; min-height: 40px; background: var(--md-sys-color-surface-variant, #E7E0EC); border-radius: 8px; font: 400 12px/18px 'Roboto Mono', monospace; color: var(--md-sys-color-on-surface-variant, #49454F);">
          <div style="opacity: 0.87;">Click a checkbox to see events…</div>
        </div>

        <div style="padding: 12px 16px; background: var(--md-sys-color-surface-variant, #E7E0EC); border-radius: 8px; font: 400 13px/18px Roboto, sans-serif; color: var(--md-sys-color-on-surface-variant, #49454F);">
          <strong>Uncontrolled mode:</strong> Set initial attributes (<code>checked</code>, <code>indeterminate</code>)
          and the checkbox toggles itself on user interaction. Listen to <code>mdChange</code> to react to state changes.
          No application code is needed to drive the toggle.
        </div>
      </div>
    `;
  },
};

/* ─── Controlled (External State) ────────────────────────── */
export const Controlled: Story = {
  render: () => {
    let allowed = true;

    const handleToggleAllow = () => {
      allowed = !allowed;
      const badge = document.getElementById('ctrl-badge')!;
      badge.textContent = allowed ? 'Allowed' : 'Blocked';
      badge.style.background = allowed
        ? 'var(--md-sys-color-primary-container, #EADDFF)'
        : 'var(--md-sys-color-error-container, #F9DEDC)';
      badge.style.color = allowed
        ? 'var(--md-sys-color-on-primary-container, #21005D)'
        : 'var(--md-sys-color-on-error-container, #410E0B)';
    };

    const handleChange = (e: Event) => {
      const cb = e.target as any;
      const d = (e as CustomEvent).detail;
      const logEl = document.getElementById('ctrl-log')!;

      if (!allowed) {
        cb.checked = !d.checked;
        const line = document.createElement('div');
        line.textContent = `BLOCKED — reverted to checked=${cb.checked}`;
        line.style.color = 'var(--md-sys-color-error, #B3261E)';
        logEl.prepend(line);
      } else {
        const line = document.createElement('div');
        line.textContent = `ACCEPTED — checked=${d.checked}`;
        logEl.prepend(line);
      }
      if (logEl.children.length > 8) logEl.lastElementChild?.remove();
    };

    return html`
      <div style="display: flex; flex-direction: column; gap: 24px;">
        <div>
          <h3 style="font: 500 14px/20px Roboto, sans-serif; color: var(--md-sys-color-on-surface, #1C1B1F); margin: 0 0 12px;">
            Controlled — application owns the state
          </h3>
          <div style="display: flex; align-items: center; gap: 16px;">
            <label style="display: inline-flex; align-items: center; gap: 8px; cursor: pointer; font: 400 14px/20px Roboto, sans-serif; color: var(--md-sys-color-on-surface, #1C1B1F);">
              <md-checkbox aria-label="Controlled checkbox" checked @mdChange=${handleChange}></md-checkbox>
              Controlled checkbox
            </label>
            <button
              @click=${handleToggleAllow}
              style="padding: 6px 16px; border: 1px solid var(--md-sys-color-outline, #79747E); border-radius: 20px; background: none; cursor: pointer; font: 500 13px/18px Roboto, sans-serif; color: var(--md-sys-color-on-surface, #1C1B1F);"
            >
              Toggle lock
            </button>
            <span
              id="ctrl-badge"
              style="padding: 4px 12px; border-radius: 12px; font: 500 12px/16px Roboto, sans-serif; background: var(--md-sys-color-primary-container, #EADDFF); color: var(--md-sys-color-on-primary-container, #21005D);"
            >Allowed</span>
          </div>
        </div>

        <div id="ctrl-log" style="padding: 12px 16px; min-height: 40px; background: var(--md-sys-color-surface-variant, #E7E0EC); border-radius: 8px; font: 400 12px/18px 'Roboto Mono', monospace; color: var(--md-sys-color-on-surface-variant, #49454F);">
          <div style="opacity: 0.87;">Toggle the lock, then click the checkbox…</div>
        </div>

        <div style="padding: 12px 16px; background: var(--md-sys-color-surface-variant, #E7E0EC); border-radius: 8px; font: 400 13px/18px Roboto, sans-serif; color: var(--md-sys-color-on-surface-variant, #49454F);">
          <strong>Controlled mode:</strong> Listen to <code>mdChange</code> and revert the
          <code>checked</code> property if your application logic rejects the change. Because
          <code>checked</code> is a <code>mutable</code> reflected prop, you can set it from
          outside at any time: <code>el.checked = true</code>.
        </div>
      </div>
    `;
  },
};

/* ─── Programmatic Control (External Set) ────────────────── */
export const ProgrammaticControl: Story = {
  render: () => {
    const setChecked = (val: boolean) => {
      const cb = document.getElementById('prog-cb') as any;
      if (cb) cb.checked = val;
    };
    const setIndeterminate = () => {
      const cb = document.getElementById('prog-cb') as any;
      if (cb) { cb.indeterminate = true; cb.checked = false; }
    };
    const toggleDisabled = () => {
      const cb = document.getElementById('prog-cb') as any;
      if (cb) cb.disabled = !cb.disabled;
    };

    const btnStyle = 'padding: 6px 16px; border: 1px solid var(--md-sys-color-outline, #79747E); border-radius: 20px; background: none; cursor: pointer; font: 500 13px/18px Roboto, sans-serif; color: var(--md-sys-color-on-surface, #1C1B1F);';

    return html`
      <div style="display: flex; flex-direction: column; gap: 24px;">
        <div>
          <h3 style="font: 500 14px/20px Roboto, sans-serif; color: var(--md-sys-color-on-surface, #1C1B1F); margin: 0 0 12px;">
            Programmatic control — set properties from application code
          </h3>
          <div style="display: flex; align-items: center; gap: 16px;">
            <md-checkbox id="prog-cb" aria-label="Programmatically controlled checkbox"></md-checkbox>
            <button @click=${() => setChecked(true)} style="${btnStyle}">Set checked</button>
            <button @click=${() => setChecked(false)} style="${btnStyle}">Set unchecked</button>
            <button @click=${setIndeterminate} style="${btnStyle}">Set indeterminate</button>
            <button @click=${toggleDisabled} style="${btnStyle}">Toggle disabled</button>
          </div>
        </div>

        <div style="padding: 12px 16px; background: var(--md-sys-color-surface-variant, #E7E0EC); border-radius: 8px; font: 400 13px/18px Roboto, sans-serif; color: var(--md-sys-color-on-surface-variant, #49454F);">
          <strong>Programmatic API:</strong> Set <code>checked</code>, <code>indeterminate</code>, and
          <code>disabled</code> properties directly on the element reference. All are
          <code>reflect: true</code> so the HTML attribute updates too.
        </div>
      </div>
    `;
  },
  /** Property sets reflect to ARIA without a click, scripted (see Interactions). */
  play: async ({ canvasElement, step }) => {
    const cb = (await getCbById(canvasElement, 'prog-cb')) as CbCtl;

    await step('Setting checked=true reflects aria-checked, with NO mdChange (no click)', async () => {
      let emitted = false;
      cb.addEventListener('mdChange', () => { emitted = true; });
      const before = cb.getAttribute('aria-checked'); // 'false'
      cb.checked = true; // programmatic mutation, not a user click
      await waitFor(() => expect(cb.getAttribute('aria-checked')).toBe('true')); // reflected next flush
      expect(before).toBe('false');
      await waitFor(() => expect(cb.hasAttribute('checked')).toBe(true));
      expect(emitted).toBe(false); // programmatic set stays silent (no infinite loops)
    });

    await step('Setting indeterminate reflects aria-checked="mixed"', async () => {
      const before = cb.getAttribute('aria-checked'); // 'true'
      cb.indeterminate = true;
      cb.checked = false;
      await waitFor(() => expect(cb.getAttribute('aria-checked')).not.toBe(before)); // it MOVED
      expect(cb.getAttribute('aria-checked')).toBe('mixed'); // ...to the tri-state value
      await waitFor(() => expect(cb.classList.contains('md-checkbox--indeterminate')).toBe(true));
      expect(cb.hasAttribute('indeterminate')).toBe(true);
    });

    await step('Disabling programmatically blocks user clicks (guard)', async () => {
      cb.disabled = true;
      await waitFor(() => expect(cb.getAttribute('aria-disabled')).toBe('true'));
      await waitFor(() => expect(cb.getAttribute('tabindex')).toBe('-1')); // dropped out of tab order
      let emitted = false;
      cb.addEventListener('mdChange', () => { emitted = true; }, { once: true });
      const frozen = cb.getAttribute('aria-checked'); // 'mixed'
      cb.click(); // ignored while disabled — handleClick returns early
      await new Promise((r) => setTimeout(r, 0));
      expect(cb.getAttribute('aria-checked')).toBe(frozen); // unchanged
      expect(emitted).toBe(false);
    });
  },
};

/* ─── Accessibility ──────────────────────────────────────── */
export const Accessibility: Story = {
  render: (_args, { globals }) => html`
    <div style="display: flex; flex-direction: column; gap: 32px;">

      <!-- 1. Dual-state with visible label (aria-labelledby) -->
      <section>
        <h3 id="a11y-section-1" style="font: 500 14px/20px Roboto, sans-serif; color: var(--md-sys-color-on-surface, #1C1B1F); margin: 0 0 8px;">
          Dual-state checkbox with <code>aria-labelledby</code>
        </h3>
        <div style="display: flex; align-items: center; gap: 8px;">
          <md-checkbox id="a11y-cb-1" aria-labelledby="a11y-label-1"></md-checkbox>
          <span id="a11y-label-1" style="font: 400 14px/20px Roboto, sans-serif; color: var(--md-sys-color-on-surface, #1C1B1F);">
            ${t(globals.locale, 'checkbox.agreeTos')}
          </span>
        </div>
      </section>

      <!-- 2. Dual-state with aria-label (no visible label) -->
      <section>
        <h3 style="font: 500 14px/20px Roboto, sans-serif; color: var(--md-sys-color-on-surface, #1C1B1F); margin: 0 0 8px;">
          Checkbox with <code>aria-label</code> (no visible label)
        </h3>
        <md-checkbox aria-label="Toggle dark mode"></md-checkbox>
        <span style="font: 400 12px/16px Roboto, sans-serif; color: var(--md-sys-color-on-surface-variant, #49454F); margin-inline-start: 8px;">
          ← Inspect with screen reader: announces "Toggle dark mode"
        </span>
      </section>

      <!-- 3. Required checkbox with aria-describedby -->
      <section>
        <h3 style="font: 500 14px/20px Roboto, sans-serif; color: var(--md-sys-color-on-surface, #1C1B1F); margin: 0 0 8px;">
          Required checkbox with <code>aria-describedby</code>
        </h3>
        <div style="display: flex; align-items: center; gap: 8px;">
          <md-checkbox
            required
            aria-labelledby="a11y-label-req"
            aria-describedby="a11y-desc-req"
          ></md-checkbox>
          <div>
            <span id="a11y-label-req" style="font: 400 14px/20px Roboto, sans-serif; color: var(--md-sys-color-on-surface, #1C1B1F);">
              ${t(globals.locale, 'checkbox.acceptPrivacy')}
            </span>
            <br/>
            <span id="a11y-desc-req" style="font: 400 12px/16px Roboto, sans-serif; color: var(--md-sys-color-on-surface-variant, #49454F);">
              ${t(globals.locale, 'checkbox.privacyRequired')}
            </span>
          </div>
        </div>
      </section>

      <!-- 4. Checkbox group with role="group" and aria-labelledby -->
      <section>
        <h3 style="font: 500 14px/20px Roboto, sans-serif; color: var(--md-sys-color-on-surface, #1C1B1F); margin: 0 0 8px;">
          Checkbox group with <code>role="group"</code>
        </h3>
        <fieldset
          role="group"
          aria-labelledby="a11y-group-label"
          style="border: 1px solid var(--md-sys-color-outline-variant, #CAC4D0); border-radius: 12px; padding: 16px;"
        >
          <legend id="a11y-group-label" style="padding: 0 8px; font: 500 14px/20px Roboto, sans-serif; color: var(--md-sys-color-on-surface, #1C1B1F);">
            ${t(globals.locale, 'checkbox.notificationPreferences')}
          </legend>
          <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 8px;">
            <label style="display: inline-flex; align-items: center; gap: 8px; cursor: pointer; font: 400 14px/20px Roboto, sans-serif; color: var(--md-sys-color-on-surface, #1C1B1F);">
              <md-checkbox aria-label=${t(globals.locale, 'checkbox.emailNotifications')} checked></md-checkbox>
              ${t(globals.locale, 'checkbox.emailNotifications')}
            </label>
            <label style="display: inline-flex; align-items: center; gap: 8px; cursor: pointer; font: 400 14px/20px Roboto, sans-serif; color: var(--md-sys-color-on-surface, #1C1B1F);">
              <md-checkbox aria-label=${t(globals.locale, 'checkbox.smsNotifications')}></md-checkbox>
              ${t(globals.locale, 'checkbox.smsNotifications')}
            </label>
            <label style="display: inline-flex; align-items: center; gap: 8px; cursor: pointer; font: 400 14px/20px Roboto, sans-serif; color: var(--md-sys-color-on-surface, #1C1B1F);">
              <md-checkbox aria-label=${t(globals.locale, 'checkbox.pushNotifications')} checked></md-checkbox>
              ${t(globals.locale, 'checkbox.pushNotifications')}
            </label>
          </div>
        </fieldset>
      </section>

      <!-- 5. Disabled & soft-disabled focus behavior -->
      <section>
        <h3 style="font: 500 14px/20px Roboto, sans-serif; color: var(--md-sys-color-on-surface, #1C1B1F); margin: 0 0 8px;">
          Disabled vs. soft-disabled (focus behavior)
        </h3>
        <div style="display: flex; gap: 24px; align-items: center;">
          <label style="display: inline-flex; align-items: center; gap: 8px; font: 400 14px/20px Roboto, sans-serif; color: var(--md-sys-color-on-surface, #1C1B1F);">
            <md-checkbox aria-label="Disabled" disabled checked></md-checkbox>
            Disabled (<code>tabindex="-1"</code>)
          </label>
          <label style="display: inline-flex; align-items: center; gap: 8px; font: 400 14px/20px Roboto, sans-serif; color: var(--md-sys-color-on-surface, #1C1B1F);">
            <md-checkbox aria-label="Soft-disabled" soft-disabled checked></md-checkbox>
            Soft-disabled (<code>tabindex="0"</code>, focusable)
          </label>
        </div>
      </section>

    </div>

    <div style="margin-top: 24px; padding: 12px 16px; background: var(--md-sys-color-surface-variant, #E7E0EC); border-radius: 8px; font: 400 13px/18px Roboto, sans-serif; color: var(--md-sys-color-on-surface-variant, #49454F);">
      <strong>WAI-ARIA Checkbox pattern:</strong>
      <ul style="margin: 8px 0 0; padding-inline-start: 20px;">
        <li><code>role="checkbox"</code> on the host element</li>
        <li><code>aria-checked</code>: <code>"true"</code>, <code>"false"</code>, or <code>"mixed"</code> (tri-state)</li>
        <li><code>aria-labelledby</code> or <code>aria-label</code> for accessible name</li>
        <li><code>aria-describedby</code> for supplementary description</li>
        <li><code>aria-required="true"</code> when required</li>
        <li><code>aria-disabled="true"</code> when disabled or soft-disabled</li>
        <li>Keyboard: <kbd>Space</kbd> toggles state (Enter does not activate, per spec)</li>
        <li>Groups use <code>role="group"</code> with <code>aria-labelledby</code></li>
      </ul>
    </div>
  `,
};

/* ─── Localization ─────────────────────────────────────────── */
export const Localization: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Checkbox labels and supporting text ellipsis when space is tight. German copy exercises compound words; pseudo-localization widens glyphs. ' +
          'Compare LTR and RTL in narrow frames — the checkbox stays at the inline-start edge via logical layout; wrap with <code>dir</code> and <code>lang</code> on an ancestor. ' +
          'Use <code>aria-labelledby</code> / <code>aria-describedby</code> when the visible label and hint sit outside a native <code>&lt;label&gt;</code>.',
      },
    },
  },
  render: () => html`
    <div style="display: grid; gap: 24px; width: 100%; max-width: 900px;">
      ${viewportFrame(
        'LTR · long German (280px — ellipsis)',
        '280px',
        html`
          <div lang="de" style="display: flex; flex-direction: column; gap: 12px;">
            <label style="${l10nLabelRowStyle}">
              <md-checkbox aria-label="${longGermanLabel}" checked style="flex-shrink: 0;"></md-checkbox>
              <span style="${l10nEllipsisTextStyle}">${longGermanLabel}</span>
            </label>
            <label style="${l10nLabelRowStyle}">
              <md-checkbox required aria-labelledby="l10n-de-label" aria-describedby="l10n-de-desc" style="flex-shrink: 0;"></md-checkbox>
              <div style="min-inline-size: 0; flex: 1 1 auto; display: flex; flex-direction: column; gap: 2px;">
                <span id="l10n-de-label" style="${l10nEllipsisTextStyle}">${longGermanLabel}</span>
                <span id="l10n-de-desc" style="${l10nSupportingStyle}">${longGermanSupporting}</span>
              </div>
            </label>
          </div>
        `,
      )}
      ${viewportFrame(
        'LTR · pseudo-localization (320px)',
        '320px',
        html`
          <label style="${l10nLabelRowStyle}">
            <md-checkbox aria-label=${pseudoLabel} style="flex-shrink: 0;"></md-checkbox>
            <div style="min-inline-size: 0; flex: 1 1 auto; display: flex; flex-direction: column; gap: 2px;">
              <span style="${l10nEllipsisTextStyle}">${pseudoLabel}</span>
              <span style="${l10nSupportingStyle}">${pseudoSupporting}</span>
            </div>
          </label>
        `,
      )}
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px;">
        ${viewportFrame(
          'RTL · Arabic label + supporting text',
          '100%',
          html`
            <div dir="rtl" lang="ar" style="display: flex; flex-direction: column; gap: 12px;">
              <label style="${l10nLabelRowStyle}">
                <md-checkbox aria-label="أوافق على إعدادات الإشعارات والخصوصية لحسابي على جميع الأجهزة" checked style="flex-shrink: 0;"></md-checkbox>
                <span style="${l10nEllipsisTextStyle}">
                  أوافق على إعدادات الإشعارات والخصوصية لحسابي على جميع الأجهزة
                </span>
              </label>
              <label style="${l10nLabelRowStyle}">
                <md-checkbox
                  aria-labelledby="l10n-ar-label"
                  aria-describedby="l10n-ar-desc"
                  style="flex-shrink: 0;"
                ></md-checkbox>
                <div style="min-inline-size: 0; flex: 1 1 auto; display: flex; flex-direction: column; gap: 2px;">
                  <span id="l10n-ar-label" style="${l10nEllipsisTextStyle}">
                    أوافق على إعدادات الإشعارات والخصوصية لحسابي
                  </span>
                  <span id="l10n-ar-desc" style="${l10nSupportingStyle}">
                    إدارة البريد والدفع والرسائل القصيرة عبر جميع الأجهزة
                  </span>
                </div>
              </label>
            </div>
          `,
        )}
        ${viewportFrame(
          'LTR · English (same width)',
          '100%',
          html`
            <div style="display: flex; flex-direction: column; gap: 12px;">
              <label style="${l10nLabelRowStyle}">
                <md-checkbox aria-label="I agree to notification and privacy settings for my account" checked style="flex-shrink: 0;"></md-checkbox>
                <span style="${l10nEllipsisTextStyle}">
                  I agree to notification and privacy settings for my account
                </span>
              </label>
              <label style="${l10nLabelRowStyle}">
                <md-checkbox
                  aria-labelledby="l10n-en-label"
                  aria-describedby="l10n-en-desc"
                  style="flex-shrink: 0;"
                ></md-checkbox>
                <div style="min-inline-size: 0; flex: 1 1 auto; display: flex; flex-direction: column; gap: 2px;">
                  <span id="l10n-en-label" style="${l10nEllipsisTextStyle}">
                    I agree to notification and privacy settings for my account
                  </span>
                  <span id="l10n-en-desc" style="${l10nSupportingStyle}">
                    Manage email, push, and SMS across all connected devices
                  </span>
                </div>
              </label>
            </div>
          `,
        )}
      </div>
    </div>
  `,
};

// ──────────────────────────────────────────────────────────────
// Responsiveness
// ──────────────────────────────────────────────────────────────
export const Responsiveness: Story = {
  name: 'Responsiveness',
  parameters: {
    // The demo's widest viewport box is 1024px. Under the default centred
    // layout the canvas shrink-wraps its content, so the shell's and the boxes'
    // `max-inline-size: 100%` are circular and never bind — the story then
    // overflows a narrower canvas, and CENTRING clips both edges, taking the
    // first characters off every heading. 'padded' gives the root a definite
    // width so those percentage caps resolve.
    layout: 'padded',
    docs: {
      description: {
        story:
          'Checkboxes have a fixed 18×18 dp control — responsiveness is about ' +
          'how you lay out the label beside or below it. Pair each checkbox with ' +
          'a <code>&lt;label&gt;</code> in a flex row; at narrow widths let the ' +
          'label column shrink with <code>min-inline-size: 0</code> and ' +
          '<code>text-overflow: ellipsis</code> so long copy never pushes the ' +
          'control off-screen. Below 480px, stack checkbox groups vertically ' +
          'instead of placing them inline.',
      },
    },
  },
  render: () => html`
    <style>
      .cb-resp-shell { display: flex; flex-direction: column; gap: 32px; max-width: 1100px; }
      .cb-resp-vp__label { font-size: 11px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase; opacity: 0.72; margin-block-end: 6px; }
      .cb-resp-vp {
        border: 1px dashed var(--md-sys-color-outline-variant, #cac4d0);
        border-radius: 12px;
        padding: 16px;
        background: var(--md-sys-color-surface-container-lowest, #fffbfe);
        box-sizing: border-box;
        container-type: inline-size;
        margin-block-end: 12px;
      }
      /* center, not flex-start. md-checkbox's host IS its 48px touch target, and
         the visible 24px box sits centred inside it — so flex-start aligned the
         TARGET's top edge with the text, dropping the visible box 12px below the
         label's centre on every row. Centring aligns what you can actually see.
         (Measured: vOffset was +12px on all rows, single- and multi-line.) */
      /* Multi-line labels align the control to the FIRST LINE, not to the middle
         of the wrapped block — centring a 2-line label put the checkbox 9px
         below its first line. flex-start puts the 48px TARGET's top on the line;
         the negative margin pulls the visible 24px box up onto it, since the
         target overhangs the box by (48 - 24) / 2 on each side. */
      .cb-resp-label-row--block { align-items: flex-start; }
      .cb-resp-label-row--block > md-checkbox { margin-block-start: -12px; }

      .cb-resp-label-row {
        display: flex; align-items: center; gap: 8px; cursor: pointer;
        max-inline-size: 100%; min-inline-size: 0;
        font: 400 16px/24px Roboto, sans-serif; color: var(--md-sys-color-on-surface, #1C1B1F);
      }
      .cb-resp-label-text {
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        min-inline-size: 0; flex: 1 1 auto;
      }
      .cb-resp-supporting {
        font: 400 12px/16px Roboto, sans-serif; color: var(--md-sys-color-on-surface-variant, #49454F);
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      .cb-resp-group { display: flex; flex-wrap: wrap; gap: 16px 24px; }
      @container (max-width: 480px) {
        .cb-resp-group { flex-direction: column; gap: 12px; }
      }
      .cb-resp-live { resize: horizontal; overflow: auto; min-inline-size: 240px; max-inline-size: 100%; inline-size: 600px; }
    </style>

    <div class="cb-resp-shell">
      <section>
        <h3 style="margin: 0 0 4px;">Label truncation at four breakpoints</h3>
        <p style="margin: 0 0 16px; font-size: 14px; opacity: 0.7;">
          Same checkbox + long label markup. Ellipsis keeps the control visible.
        </p>
        ${[
          { label: 'XS · 320 px (phone)', width: '320px' },
          { label: 'SM · 480 px (large phone)', width: '480px' },
          { label: 'MD · 768 px (tablet)', width: '768px' },
          { label: 'LG · 1024 px (desktop)', width: '1024px' },
        ].map(
          (vp) => html`
            <div>
              <div class="cb-resp-vp__label">${vp.label}</div>
              <div class="cb-resp-vp" style="inline-size: ${vp.width}; max-inline-size: 100%;">
                <label class="cb-resp-label-row cb-resp-label-row--block">
                  <md-checkbox aria-label="I agree to notification and privacy settings for my account on all devices" checked style="flex-shrink: 0;"></md-checkbox>
                  <div style="min-inline-size: 0; flex: 1 1 auto; display: flex; flex-direction: column; gap: 2px;">
                    <span class="cb-resp-label-text">
                      I agree to notification and privacy settings for my account on all devices
                    </span>
                    <span class="cb-resp-supporting">
                      Manage email, push, and SMS across all connected devices
                    </span>
                  </div>
                </label>
              </div>
            </div>
          `,
        )}
      </section>

      <section>
        <h3 style="margin: 0 0 4px;">Checkbox groups: inline → stacked</h3>
        <p style="margin: 0 0 16px; font-size: 14px; opacity: 0.7;">
          Filter preferences wrap horizontally on tablet+ and stack below 480px
          via a container query on the parent frame.
        </p>
        ${[
          { label: 'XS · 320 px (stacked)', width: '320px' },
          { label: 'MD · 768 px (inline)', width: '768px' },
        ].map(
          (vp) => html`
            <div>
              <div class="cb-resp-vp__label">${vp.label}</div>
              <div class="cb-resp-vp" style="inline-size: ${vp.width}; max-inline-size: 100%;">
                <div class="cb-resp-group">
                  ${['Email', 'Push', 'SMS', 'In-app'].map(
                    (item, i) => html`
                      <label class="cb-resp-label-row" style="flex: 0 1 auto;">
                        <md-checkbox aria-label="${item}" ?checked=${i < 2} style="flex-shrink: 0;"></md-checkbox>
                        <span>${item}</span>
                      </label>
                    `,
                  )}
                </div>
              </div>
            </div>
          `,
        )}
      </section>

      <section>
        <h3 style="margin: 0 0 4px;">Live resize playground</h3>
        <p style="margin: 0 0 16px; font-size: 14px; opacity: 0.7;">
          Drag the bottom-right corner. Watch the group stack and labels truncate.
        </p>
        <div class="cb-resp-vp cb-resp-live">
          <label class="cb-resp-label-row" style="margin-block-end: 12px;">
            <md-checkbox aria-label="I agree to notification and privacy settings for my account on all devices" checked style="flex-shrink: 0;"></md-checkbox>
            <div style="min-inline-size: 0; flex: 1 1 auto; display: flex; flex-direction: column; gap: 2px;">
              <span class="cb-resp-label-text">
                I agree to notification and privacy settings for my account on all devices
              </span>
              <span class="cb-resp-supporting">Manage email, push, and SMS across all connected devices</span>
            </div>
          </label>
          <div class="cb-resp-group">
            ${['Email', 'Push', 'SMS', 'In-app'].map(
              (item, i) => html`
                <label class="cb-resp-label-row" style="flex: 0 1 auto;">
                  <md-checkbox aria-label="${item}" ?checked=${i < 2} style="flex-shrink: 0;"></md-checkbox>
                  <span>${item}</span>
                </label>
              `,
            )}
          </div>
        </div>
      </section>
    </div>
  `,
};

/* ─── Disabled & Decorative (guard branches) ──────────────── */
export const DisabledAndDecorative: Story = {
  render: () => html`
    <div style="display: flex; gap: 32px; align-items: center; flex-wrap: wrap;">
      <label style="display: inline-flex; align-items: center; gap: 8px; font: 400 14px/20px Roboto, sans-serif; color: var(--md-sys-color-on-surface, #1C1B1F);">
        <md-checkbox id="edge-disabled" aria-label="Disabled option" disabled></md-checkbox>
        Disabled — clicks &amp; Space are inert
      </label>
      <span style="display: inline-flex; align-items: center; gap: 8px; font: 400 14px/20px Roboto, sans-serif; color: var(--md-sys-color-on-surface, #1C1B1F);">
        <md-checkbox id="edge-decorative" aria-hidden="true" checked></md-checkbox>
        Decorative glyph — mirrors row state, not focusable
      </span>
    </div>
  `,
  /** Disabled guards + decorative (aria-hidden) non-focusable path (see Interactions). */
  play: async ({ canvasElement, step }) => {
    const disabled = await getCbById(canvasElement, 'edge-disabled');
    const decorative = await getCbById(canvasElement, 'edge-decorative');

    await step('Disabled checkbox ignores click AND Space — no toggle, no mdChange', async () => {
      expect(disabled.getAttribute('aria-checked')).toBe('false');
      expect(disabled.getAttribute('tabindex')).toBe('-1'); // dropped from tab order
      let emitted = false;
      disabled.addEventListener('mdChange', () => { emitted = true; });
      disabled.click(); // handleClick early-returns (isDisabled)
      key(disabled, ' '); // handleKeyDown early-returns (isDisabled)
      await new Promise((r) => setTimeout(r, 0));
      expect(disabled.checked).toBe(false); // never flipped
      expect(disabled.getAttribute('aria-checked')).toBe('false');
      expect(emitted).toBe(false); // no event escaped
    });

    await step('Disabled checkbox never enters the pressed state on pointerdown', async () => {
      pointer(disabled, 'pointerdown'); // handlePointerDown → !isDisabled is false, skips
      await new Promise((r) => setTimeout(r, 0));
      expect(disabled.classList.contains('md-checkbox--pressed')).toBe(false);
    });

    await step('Decorative (aria-hidden) checkbox reflects state yet is not focusable', async () => {
      expect(decorative.getAttribute('aria-checked')).toBe('true'); // still mirrors `checked`
      expect(decorative.hasAttribute('tabindex')).toBe(false); // decorative → tabindex omitted
    });
  },
};

/* ─── Form Participation (reset + value re-sync) ──────────── */
export const FormParticipation: Story = {
  render: () => html`
    <form
      id="cb-form"
      style="display: flex; align-items: center; gap: 16px; font: 400 14px/20px Roboto, sans-serif; color: var(--md-sys-color-on-surface, #1C1B1F);"
    >
      <label style="display: inline-flex; align-items: center; gap: 8px; cursor: pointer;">
        <md-checkbox id="form-cb" name="subscribe" value="yes" required aria-label="Subscribe to updates"></md-checkbox>
        Subscribe to updates
      </label>
      <button
        type="reset"
        style="padding: 6px 16px; border: 1px solid var(--md-sys-color-outline, #79747E); border-radius: 20px; background: none; cursor: pointer; font: 500 13px/18px Roboto, sans-serif; color: var(--md-sys-color-on-surface, #1C1B1F);"
      >
        Reset
      </button>
    </form>
  `,
  /** Form value re-sync on `value` change + formResetCallback restore (see Interactions). */
  play: async ({ canvasElement, step }) => {
    const cb = (await getCbById(canvasElement, 'form-cb')) as CbEl & { value: string };
    const form = canvasElement.querySelector('#cb-form') as HTMLFormElement;

    await step('Required checkbox reflects aria-required="true"', async () => {
      await waitFor(() => expect(cb.getAttribute('aria-required')).toBe('true'));
    });

    await step('Checking submits `value` under `name`; mutating value re-syncs the entry', async () => {
      // Unchecked → the checkbox contributes nothing to the form.
      expect(new FormData(form).get('subscribe')).toBe(null);
      cb.click();
      await waitFor(() => expect(cb.checked).toBe(true));
      await waitFor(() => expect(new FormData(form).get('subscribe')).toBe('yes'));
      // Changing `value` fires @Watch('value') → syncFormValue re-runs against ElementInternals.
      cb.value = 'updated';
      await waitFor(() => expect(new FormData(form).get('subscribe')).toBe('updated'));
    });

    await step('Form reset restores the initial unchecked state (formResetCallback)', async () => {
      expect(cb.checked).toBe(true); // still checked from the previous step
      form.reset(); // invokes formResetCallback → checked/indeterminate back to initial
      await waitFor(() => expect(cb.checked).toBe(false));
      await waitFor(() => expect(cb.getAttribute('aria-checked')).toBe('false'));
      // Reset unchecks it, so it once again contributes nothing to the form.
      await waitFor(() => expect(new FormData(form).get('subscribe')).toBe(null));
    });
  },
};

/* ─── Soft-disabled guards (focusable, yet inert) ─────────── */
export const SoftDisabledGuards: Story = {
  render: () => html`
    <label style="display: inline-flex; align-items: center; gap: 8px; font: 400 14px/20px Roboto, sans-serif; color: var(--md-sys-color-on-surface, #1C1B1F);">
      <md-checkbox id="soft-cb" soft-disabled aria-label="Soft-disabled option"></md-checkbox>
      Soft-disabled — inert to input, yet stays in the tab order
    </label>
  `,
  /** soft-disabled drives isDisabled via `softDisabled` (not `disabled`) — the guards
   *  still block, but tabindex stays 0 (focusable). See the Interactions panel. */
  play: async ({ canvasElement, step }) => {
    const cb = await getCbById(canvasElement, 'soft-cb');

    await step('Soft-disabled is aria-disabled but focusable (tabindex 0, unlike hard-disabled)', async () => {
      await waitFor(() => expect(cb.getAttribute('aria-disabled')).toBe('true'));
      // The soft-disabled distinction: `disabled` is false, so tabindex is 0, NOT -1.
      await waitFor(() => expect(cb.getAttribute('tabindex')).toBe('0'));
      cb.focus();
      expect(document.activeElement).toBe(cb); // reachable by keyboard for discoverability
    });

    await step('Click and Space are inert while soft-disabled — no toggle, no mdChange', async () => {
      let emitted = false;
      cb.addEventListener('mdChange', () => { emitted = true; });
      cb.click(); // handleClick → isDisabled (via softDisabled) → early return
      key(cb, ' '); // handleKeyDown → isDisabled (via softDisabled) → early return
      await new Promise((r) => setTimeout(r, 0));
      expect(cb.checked).toBe(false); // never flipped
      expect(cb.getAttribute('aria-checked')).toBe('false');
      expect(emitted).toBe(false); // guard swallows the interaction before mdChange
    });

    await step('pointerdown does not arm the pressed state layer while soft-disabled', async () => {
      pointer(cb, 'pointerdown'); // handlePointerDown → !isDisabled is false, skips pressed
      await new Promise((r) => setTimeout(r, 0));
      expect(cb.classList.contains('md-checkbox--pressed')).toBe(false);
    });
  },
};

/* ─── Form reset restores CHECKED / INDETERMINATE initial state ── */
export const FormResetRestoresState: Story = {
  render: () => html`
    <form
      id="reset-form"
      style="display: flex; flex-direction: column; gap: 12px; font: 400 14px/20px Roboto, sans-serif; color: var(--md-sys-color-on-surface, #1C1B1F);"
    >
      <label style="display: inline-flex; align-items: center; gap: 8px; cursor: pointer;">
        <md-checkbox id="reset-checked-cb" name="a" value="on" checked aria-label="Starts checked"></md-checkbox>
        Starts checked
      </label>
      <label style="display: inline-flex; align-items: center; gap: 8px; cursor: pointer;">
        <md-checkbox id="reset-indet-cb" name="b" indeterminate aria-label="Starts indeterminate"></md-checkbox>
        Starts indeterminate
      </label>
      <button
        type="reset"
        style="align-self: flex-start; padding: 6px 16px; border: 1px solid var(--md-sys-color-outline, #79747E); border-radius: 20px; background: none; cursor: pointer; font: 500 13px/18px Roboto, sans-serif; color: var(--md-sys-color-on-surface, #1C1B1F);"
      >
        Reset
      </button>
    </form>
  `,
  /** formResetCallback restores whatever was AUTHORED at load — checked AND
   *  indeterminate, not just the empty default. See the Interactions panel. */
  play: async ({ canvasElement, step }) => {
    const checkedCb = await getCbById(canvasElement, 'reset-checked-cb');
    const indetCb = await getCbById(canvasElement, 'reset-indet-cb');
    const form = canvasElement.querySelector('#reset-form') as HTMLFormElement;

    await step('User toggles both boxes away from their authored initial states', async () => {
      checkedCb.click(); // checked → unchecked
      await waitFor(() => expect(checkedCb.checked).toBe(false));
      indetCb.click(); // indeterminate resolves to checked (per handleClick)
      await waitFor(() => expect(indetCb.checked).toBe(true));
      await waitFor(() => expect(indetCb.indeterminate).toBe(false));
    });

    await step('Form reset restores the initially-CHECKED box to checked (not the default false)', async () => {
      form.reset(); // formResetCallback → this.checked = initialChecked (true here)
      await waitFor(() => expect(checkedCb.checked).toBe(true));
      await waitFor(() => expect(checkedCb.getAttribute('aria-checked')).toBe('true'));
      // Re-checked → it contributes its value to the form again.
      await waitFor(() => expect(new FormData(form).get('a')).toBe('on'));
    });

    await step('Form reset restores the initially-INDETERMINATE box to mixed, not the clicked-checked state', async () => {
      // Same reset call above also restored this one; assert the tri-state came back.
      await waitFor(() => expect(indetCb.indeterminate).toBe(true));
      await waitFor(() => expect(indetCb.getAttribute('aria-checked')).toBe('mixed'));
      expect(indetCb.checked).toBe(false); // indeterminate is checked-agnostic
      // Indeterminate is a visual-only state → it submits nothing on its own.
      expect(new FormData(form).get('b')).toBe(null);
    });
  },
};
