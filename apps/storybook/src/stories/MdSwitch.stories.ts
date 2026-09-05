import type { Meta, StoryObj } from '@storybook/web-components';
import { expect, waitFor } from 'storybook/test';
import { html } from 'lit';
import { t } from '../i18n';
import '@awc-ui/core/define';

/** Shadow-piercing helpers for play(): testing-library queries can't cross
 *  shadow roots, so interactions address the real internals directly. */
type SwitchEl = HTMLElement & { selected: boolean };
const getSwitch = async (canvasElement: HTMLElement): Promise<SwitchEl> => {
  const sw = canvasElement.querySelector('md-switch') as SwitchEl;
  await waitFor(() => expect(sw.classList.contains('hydrated')).toBe(true));
  return sw;
};
const key = (target: Element, k: string) =>
  target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, composed: true }));

const meta: Meta = {
  title: 'Selection/Switch',
  component: 'md-switch',
  tags: ['autodocs'],
  parameters: {
    docs: {
      source: { language: 'html' },
    },
  },
  argTypes: {
    selected: {
      control: 'boolean',
      description: 'Whether the switch is on (selected)',
    },
    disabled: {
      control: 'boolean',
      description: 'Prevents interaction',
    },
    icons: {
      control: 'boolean',
      description: 'Show icons on both states (check / close)',
    },
    showOnlySelectedIcon: {
      control: 'boolean',
      description: 'Show icon only when selected',
    },
  },
  args: {
    selected: false,
    disabled: false,
    icons: false,
    showOnlySelectedIcon: false,
  },
};
export default meta;
type Story = StoryObj;

/* ─── Playground ──────────────────────────────────────────── */

export const Playground: Story = {
  render: (args) => html`
    <md-switch
      aria-label="Toggle switch"
      ?selected=${args.selected}
      ?disabled=${args.disabled}
      ?icons=${args.icons}
      ?show-only-selected-icon=${args.showOnlySelectedIcon}
    ></md-switch>
  `,
  /** The click + Space toggle flow, scripted (see the Interactions panel). */
  play: async ({ canvasElement, step }) => {
    const sw = await getSwitch(canvasElement);

    await step('Renders as an unselected ARIA switch', async () => {
      expect(sw.getAttribute('role')).toBe('switch');
      expect(sw.selected).toBe(false);
      expect(sw.getAttribute('aria-checked')).toBe('false');
      expect(sw.shadowRoot!.querySelectorAll('[part="handle"]').length).toBe(1);
    });

    await step('Click toggles the switch on (prop + aria-checked)', async () => {
      sw.click();
      await waitFor(() => expect(sw.selected).toBe(true));
      await waitFor(() => expect(sw.getAttribute('aria-checked')).toBe('true'));
      // The class comes from the RENDER (md-switch.tsx sets it in the class
      // object), so it lands a tick after the property and the attribute — both
      // of which are written synchronously by the click handler. Asserting it
      // bare passed locally and failed roughly one CI run in ten.
      await waitFor(() => expect(sw.classList.contains('md-switch--selected')).toBe(true));
    });

    await step('Space toggles it back off (WAI-ARIA switch pattern)', async () => {
      sw.focus();
      expect(document.activeElement).toBe(sw);
      key(sw, ' ');
      await waitFor(() => expect(sw.selected).toBe(false));
      await waitFor(() => expect(sw.getAttribute('aria-checked')).toBe('false'));
    });

    await step('Enter does not toggle — Space-only per WAI-ARIA switch pattern', async () => {
      const before = sw.selected; // false
      key(sw, 'Enter');
      await new Promise((r) => setTimeout(r, 50)); // give a (non-)toggle time to commit
      expect(sw.selected).toBe(before); // non-Space key reaches the handler but is ignored
    });

    await step('Held Space (OS key-repeat) is ignored — no runaway toggling', async () => {
      const before = sw.selected; // false
      sw.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', repeat: true, bubbles: true, composed: true }));
      await new Promise((r) => setTimeout(r, 50));
      expect(sw.selected).toBe(before); // e.repeat short-circuits before toggle()
    });

    await step('Pointer press applies then clears the pressed state layer', async () => {
      sw.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
      await waitFor(() => expect(sw.classList.contains('md-switch--pressed')).toBe(true));
      sw.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, composed: true }));
      await waitFor(() => expect(sw.classList.contains('md-switch--pressed')).toBe(false));
    });

    await step('setFocus() focuses the host and forces the focus ring', async () => {
      await (sw as any).setFocus(); // public @Method: programmatic focus opts into the ring
      expect(document.activeElement).toBe(sw);
      await waitFor(() => expect(sw.classList.contains('md-switch--focus-ring')).toBe(true));
      sw.blur(); // blur clears the programmatic focus ring
      await waitFor(() => expect(sw.classList.contains('md-switch--focus-ring')).toBe(false));
    });

    await step('Space press drives then auto-clears the pressed state layer (keyboard path)', async () => {
      sw.focus();
      const before = sw.selected;
      key(sw, ' ');
      // handleKeyDown sets pressed=true synchronously before toggling…
      await waitFor(() => expect(sw.classList.contains('md-switch--pressed')).toBe(true));
      await waitFor(() => expect(sw.selected).not.toBe(before)); // …and Space also toggled the switch
      // …then the 150ms timeout releases the pressed state layer on its own.
      await waitFor(() => expect(sw.classList.contains('md-switch--pressed')).toBe(false));
    });

    // Reset to the fresh-render visual state for the VISUAL snapshot: the steps
    // above toggle the switch on and leave it focused. Restore off + unfocused.
    await step('Reset to initial visual state (snapshot parity)', async () => {
      sw.selected = false;                                  // undo the toggles above
      (document.activeElement as HTMLElement)?.blur();      // drop focus / any focus ring
      await waitFor(() => expect(sw.selected).toBe(false));
      await waitFor(() => expect(sw.getAttribute('aria-checked')).toBe('false'));
      await waitFor(() => expect(sw.classList.contains('md-switch--focus-ring')).toBe(false));
      await waitFor(() => expect(sw.classList.contains('md-switch--pressed')).toBe(false));
      await new Promise((r) => requestAnimationFrame(() => r(null))); // let the reset render settle
    });
  },
};

/* ─── Configurations ──────────────────────────────────────── */

export const Configurations: Story = {
  render: () => html`
    <div style="display: flex; flex-direction: column; gap: 24px; padding: 24px;">
      <div style="display: flex; align-items: center; gap: 16px;">
        <span style="width: 200px; color: var(--md-sys-color-on-surface, #1C1B1F);">Without icons</span>
        <md-switch aria-label="Without icons, off"></md-switch>
        <md-switch selected aria-label="Without icons, on"></md-switch>
      </div>
      <div style="display: flex; align-items: center; gap: 16px;">
        <span style="width: 200px; color: var(--md-sys-color-on-surface, #1C1B1F);">Icon on selected</span>
        <md-switch show-only-selected-icon aria-label="Icon on selected, off"></md-switch>
        <md-switch selected show-only-selected-icon aria-label="Icon on selected, on"></md-switch>
      </div>
      <div style="display: flex; align-items: center; gap: 16px;">
        <span style="width: 200px; color: var(--md-sys-color-on-surface, #1C1B1F);">Icons on both</span>
        <md-switch icons aria-label="Icons on both, off"></md-switch>
        <md-switch selected icons aria-label="Icons on both, on"></md-switch>
      </div>
    </div>
  `,
};

/* ─── States ──────────────────────────────────────────────── */

export const States: Story = {
  render: () => html`
    <div style="display: flex; flex-direction: column; gap: 24px; padding: 24px;">
      <div style="display: flex; align-items: center; gap: 16px;">
        <span style="width: 120px; color: var(--md-sys-color-on-surface, #1C1B1F);">Enabled</span>
        <md-switch aria-label="Enabled, off"></md-switch>
        <md-switch selected aria-label="Enabled, on"></md-switch>
      </div>
      <div style="display: flex; align-items: center; gap: 16px;">
        <span style="width: 120px; color: var(--md-sys-color-on-surface, #1C1B1F);">Disabled</span>
        <md-switch disabled aria-label="Disabled, off"></md-switch>
        <md-switch selected disabled aria-label="Disabled, on"></md-switch>
      </div>
      <div style="display: flex; align-items: center; gap: 16px;">
        <span style="width: 120px; color: var(--md-sys-color-on-surface, #1C1B1F);">Soft-disabled</span>
        <md-switch soft-disabled aria-label="Soft-disabled, off"></md-switch>
        <md-switch selected soft-disabled aria-label="Soft-disabled, on"></md-switch>
      </div>
    </div>
  `,
  /** Disabled + soft-disabled both make interaction inert; only hard-disabled
   *  also leaves the tab order (tabindex=-1). */
  play: async ({ canvasElement, step }) => {
    const all = [...canvasElement.querySelectorAll('md-switch')] as SwitchEl[];
    await Promise.all(all.map((sw) => waitFor(() => expect(sw.classList.contains('hydrated')).toBe(true))));
    const disabledOff = canvasElement.querySelector('md-switch[disabled]:not([selected])') as SwitchEl;
    const softDisabledOff = canvasElement.querySelector('md-switch[soft-disabled]:not([selected])') as SwitchEl;

    await step('Hard-disabled switch is aria-disabled and out of the tab order', async () => {
      expect(disabledOff.getAttribute('aria-disabled')).toBe('true'); // aria-disabled true branch
      expect(disabledOff.getAttribute('tabindex')).toBe('-1');        // tabindex disabled branch
    });

    await step('Disabled switch ignores click, Space and pointer press', async () => {
      disabledOff.click();                                            // toggle() early-returns
      key(disabledOff, ' ');                                          // handleKeyDown early-returns
      disabledOff.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
      await new Promise((r) => setTimeout(r, 50));
      expect(disabledOff.selected).toBe(false);
      expect(disabledOff.getAttribute('aria-checked')).toBe('false');
      expect(disabledOff.classList.contains('md-switch--pressed')).toBe(false); // pointer guarded too
    });

    await step('Soft-disabled stays focusable but interaction is still inert', async () => {
      expect(softDisabledOff.getAttribute('aria-disabled')).toBe('true');
      expect(softDisabledOff.getAttribute('tabindex')).toBe('0'); // discoverable, unlike hard-disabled
      softDisabledOff.click();
      await new Promise((r) => setTimeout(r, 50));
      expect(softDisabledOff.selected).toBe(false); // isDisabled covers softDisabled too
    });

    await step('Hard-disabled + selected renders aria-checked true and cannot be toggled off', async () => {
      const disabledOn = canvasElement.querySelector('md-switch[disabled][selected]') as SwitchEl;
      expect(disabledOn.getAttribute('aria-checked')).toBe('true'); // selected render branch
      expect(disabledOn.getAttribute('aria-disabled')).toBe('true');
      expect(disabledOn.getAttribute('tabindex')).toBe('-1');
      disabledOn.click();   // toggle() early-returns for disabled — cannot flip it off
      key(disabledOn, ' '); // handleKeyDown early-returns for disabled too
      await new Promise((r) => setTimeout(r, 50));
      expect(disabledOn.selected).toBe(true);                    // still on — interaction stayed inert
      expect(disabledOn.getAttribute('aria-checked')).toBe('true');
    });
  },
};

/* ─── With Labels ─────────────────────────────────────────── */

export const WithLabels: Story = {
  render: (_args, { globals }) => html`
    <div style="display: flex; flex-direction: column; gap: 16px; padding: 24px;">
      <label style="display: flex; align-items: center; gap: 12px; cursor: pointer; color: var(--md-sys-color-on-surface, #1C1B1F);">
        <md-switch aria-label="Wi-Fi"></md-switch>
        Wi-Fi
      </label>
      <label style="display: flex; align-items: center; gap: 12px; cursor: pointer; color: var(--md-sys-color-on-surface, #1C1B1F);">
        <md-switch selected icons aria-label="Bluetooth"></md-switch>
        Bluetooth
      </label>
      <label style="display: flex; align-items: center; gap: 12px; cursor: pointer; color: var(--md-sys-color-on-surface, #1C1B1F);">
        <md-switch disabled aria-label="${t(globals.locale, 'switch.airplaneMode')}"></md-switch>
        ${t(globals.locale, 'switch.airplaneMode')}
      </label>
    </div>
  `,
};

/* ─── RTL ─────────────────────────────────────────────────── */

export const RTL: Story = {
  render: () => html`
    <div dir="rtl" style="display: flex; flex-direction: column; gap: 16px; padding: 24px;">
      <label style="display: flex; align-items: center; gap: 12px; cursor: pointer; color: var(--md-sys-color-on-surface, #1C1B1F);">
        <md-switch aria-label="واي فاي"></md-switch>
        واي فاي
      </label>
      <label style="display: flex; align-items: center; gap: 12px; cursor: pointer; color: var(--md-sys-color-on-surface, #1C1B1F);">
        <md-switch selected icons aria-label="بلوتوث"></md-switch>
        بلوتوث
      </label>
    </div>
  `,
};

/* ─── Dark Theme ──────────────────────────────────────────── */

export const DarkTheme: Story = {
  render: () => html`
    <div style="display: flex; flex-direction: column; gap: 24px; padding: 24px;">
      <div style="display: flex; align-items: center; gap: 16px;">
        <span style="width: 200px; color: var(--md-sys-color-on-surface);">Without icons</span>
        <md-switch aria-label="Without icons, off"></md-switch>
        <md-switch selected aria-label="Without icons, on"></md-switch>
      </div>
      <div style="display: flex; align-items: center; gap: 16px;">
        <span style="width: 200px; color: var(--md-sys-color-on-surface);">With icons</span>
        <md-switch icons aria-label="With icons, off"></md-switch>
        <md-switch selected icons aria-label="With icons, on"></md-switch>
      </div>
      <div style="display: flex; align-items: center; gap: 16px;">
        <span style="width: 200px; color: var(--md-sys-color-on-surface);">Disabled</span>
        <md-switch disabled aria-label="Disabled, off"></md-switch>
        <md-switch selected disabled aria-label="Disabled, on"></md-switch>
      </div>
    </div>
  `,
  decorators: [
    (story) => html`
      <div data-theme="dark" style="background: var(--md-sys-color-surface); padding: 24px; border-radius: 16px;">
        ${story()}
      </div>
    `,
  ],
};

/* ─── Custom CSS ──────────────────────────────────────────── */

export const CustomCSS: Story = {
  render: () => html`
    <style>
      .danger-switch {
        --md-switch-selected-track-color: var(--md-sys-color-error, #B3261E);
        --md-switch-selected-handle-color: var(--md-sys-color-on-error, #FFFFFF);
      }
      .brand-switch {
        --md-switch-selected-track-color: #006B5F;
        --md-switch-selected-handle-color: #FFFFFF;
        --md-switch-track-color: #C8E6C9;
        --md-switch-handle-color: #006B5F;
      }
    </style>
    <div style="display: flex; flex-direction: column; gap: 16px; padding: 24px;">
      <label style="display: flex; align-items: center; gap: 12px; cursor: pointer; color: var(--md-sys-color-on-surface, #1C1B1F);">
        <md-switch selected class="danger-switch" icons aria-label="Danger (error colors)"></md-switch>
        Danger (error colors)
      </label>
      <label style="display: flex; align-items: center; gap: 12px; cursor: pointer; color: var(--md-sys-color-on-surface, #1C1B1F);">
        <md-switch selected class="brand-switch" icons aria-label="Brand (teal)"></md-switch>
        Brand (teal)
      </label>
    </div>
  `,
};

/* ─── CSS Parts ───────────────────────────────────────────── */

export const CSSParts: Story = {
  render: () => html`
    <style>
      .shadow-handle::part(handle) {
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.25);
      }
      .thick-track::part(track) {
        border-width: 3px;
      }
    </style>
    <div style="display: flex; flex-direction: column; gap: 16px; padding: 24px;">
      <label style="display: flex; align-items: center; gap: 12px; cursor: pointer; color: var(--md-sys-color-on-surface, #1C1B1F);">
        <md-switch class="shadow-handle" aria-label="Handle with shadow"></md-switch>
        Handle with shadow
      </label>
      <label style="display: flex; align-items: center; gap: 12px; cursor: pointer; color: var(--md-sys-color-on-surface, #1C1B1F);">
        <md-switch class="thick-track" aria-label="Thick track border"></md-switch>
        Thick track border
      </label>
    </div>
  `,
};

/* ─── Controlled Mode (mdInput + preventDefault) ──────────── */

export const ControlledMode: Story = {
  render: (_args, { globals }) => {
    const labelStyle = 'display: flex; align-items: center; gap: 12px; color: var(--md-sys-color-on-surface, #1C1B1F);';
    const logStyle = 'font-family: monospace; font-size: 12px; padding: 12px; background: var(--md-sys-color-surface-container, #F2ECF4); border-radius: 8px; min-height: 120px; white-space: pre-wrap; overflow-y: auto; max-height: 200px; color: var(--md-sys-color-on-surface, #1C1B1F);';

    return html`
      <div style="display: flex; flex-direction: column; gap: 24px; padding: 24px; max-width: 480px;">
        <h3 style="margin: 0; color: var(--md-sys-color-on-surface, #1C1B1F);">mdInput + mdChange events</h3>

        <!-- Uncontrolled (default) -->
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <strong style="color: var(--md-sys-color-on-surface, #1C1B1F);">Uncontrolled — toggles freely</strong>
          <div style="${labelStyle}">
            <md-switch
              aria-label="${t(globals.locale, 'switch.notifications')}"
              icons
              @mdInput=${(e: CustomEvent<{ selected: boolean }>) => {
                const log = document.getElementById('event-log');
                if (log) log.textContent += 'mdInput  → ' + JSON.stringify(e.detail) + '\n';
              }}
              @mdChange=${(e: CustomEvent<{ selected: boolean }>) => {
                const log = document.getElementById('event-log');
                if (log) log.textContent += 'mdChange → ' + JSON.stringify(e.detail) + '\n';
              }}
            ></md-switch>
            ${t(globals.locale, 'switch.notifications')}
          </div>
        </div>

        <!-- Controlled — blocked -->
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <strong style="color: var(--md-sys-color-on-surface, #1C1B1F);">Controlled — toggle blocked by preventDefault()</strong>
          <div style="${labelStyle}">
            <md-switch
              aria-label="${t(globals.locale, 'switch.lockedSetting')}"
              icons
              @mdInput=${(e: CustomEvent<{ selected: boolean }>) => {
                e.preventDefault();
                const log = document.getElementById('event-log');
                if (log) log.textContent += 'mdInput  → PREVENTED (selected stays ' + !(e.detail.selected) + ')\n';
              }}
            ></md-switch>
            ${t(globals.locale, 'switch.lockedSetting')}
          </div>
        </div>

        <!-- Controlled — async confirm -->
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <strong style="color: var(--md-sys-color-on-surface, #1C1B1F);">Controlled — confirm before toggling on</strong>
          <div style="${labelStyle}">
            <md-switch
              id="confirm-switch"
              aria-label="${t(globals.locale, 'switch.dangerousSetting')}"
              icons
              @mdInput=${(e: CustomEvent<{ selected: boolean }>) => {
                if (e.detail.selected) {
                  e.preventDefault();
                  if (confirm(t(globals.locale, 'switch.enableConfirm'))) {
                    (document.getElementById('confirm-switch') as any).selected = true;
                  }
                }
                const log = document.getElementById('event-log');
                if (log) log.textContent += 'mdInput  → ' + JSON.stringify(e.detail) + (e.defaultPrevented ? ' (controlled)' : '') + '\n';
              }}
              @mdChange=${(e: CustomEvent<{ selected: boolean }>) => {
                const log = document.getElementById('event-log');
                if (log) log.textContent += 'mdChange → ' + JSON.stringify(e.detail) + '\n';
              }}
            ></md-switch>
            ${t(globals.locale, 'switch.dangerousSetting')}
          </div>
        </div>

        <!-- Event log -->
        <div style="display: flex; flex-direction: column; gap: 4px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <strong style="color: var(--md-sys-color-on-surface, #1C1B1F);">Event log</strong>
            <button
              style="font-size: 12px; cursor: pointer; background: none; border: 1px solid var(--md-sys-color-outline, #79747E); border-radius: 4px; padding: 4px 8px; color: var(--md-sys-color-on-surface, #1C1B1F);"
              @click=${() => { const el = document.getElementById('event-log'); if (el) el.textContent = ''; }}
            >Clear</button>
          </div>
          <div id="event-log" style="${logStyle}"></div>
        </div>
      </div>
    `;
  },
  /** Controlled semantics: mdInput proposes, preventDefault() vetoes, and the
   *  switch only flips when the parent sets `selected` itself. */
  play: async ({ canvasElement, step }) => {
    const switches = [...canvasElement.querySelectorAll('md-switch')] as SwitchEl[];
    const [free, locked] = switches;
    await waitFor(() => expect(free.classList.contains('hydrated')).toBe(true));
    await waitFor(() => expect(locked.classList.contains('hydrated')).toBe(true));

    await step('Uncontrolled: click fires mdInput→mdChange and flips selected', async () => {
      let proposed: { selected: boolean } | undefined;
      let committed: { selected: boolean } | undefined;
      free.addEventListener('mdInput', (e) => { proposed = (e as CustomEvent).detail; }, { once: true });
      free.addEventListener('mdChange', (e) => { committed = (e as CustomEvent).detail; }, { once: true });
      const before = free.selected; // false
      free.click();
      await waitFor(() => expect(free.selected).not.toBe(before)); // it MOVED
      expect(free.selected).toBe(true);
      expect(proposed?.selected).toBe(true);  // mdInput carried the proposed state
      expect(committed?.selected).toBe(true); // mdChange carried the committed state
      await waitFor(() => expect(free.getAttribute('aria-checked')).toBe('true'));
    });

    await step('Controlled: preventDefault() on mdInput vetoes the toggle (no mdChange)', async () => {
      let inputFired = false;
      let changeFired = false;
      // The story's inline @mdInput handler calls preventDefault(); we only observe.
      locked.addEventListener('mdInput', () => { inputFired = true; }, { once: true });
      locked.addEventListener('mdChange', () => { changeFired = true; }, { once: true });
      const before = locked.selected; // false
      locked.click();
      await waitFor(() => expect(inputFired).toBe(true)); // component proposed the change…
      await new Promise((r) => setTimeout(r, 50));        // …give a vetoed toggle time to (not) commit
      expect(locked.selected).toBe(before);               // stayed off — the veto held
      expect(locked.getAttribute('aria-checked')).toBe('false');
      expect(changeFired).toBe(false);                    // never committed → mdChange never fired
    });

    await step('Controlled parent still owns state — imperative set flips it', async () => {
      const before = locked.selected; // false (the veto above never moved it)
      locked.selected = true;
      await waitFor(() => expect(locked.getAttribute('aria-checked')).toBe('true'));
      expect(locked.selected).not.toBe(before); // only the parent's own write moved it
    });
  },
};

/* ─── Form participation ──────────────────────────────────── */

export const FormParticipation: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'md-switch is form-associated: selected switches submit `value` under `name` (off = absent), ' +
          'and **Reset** restores initial state. Wrapping `<label>`s name each switch and toggle on text-click.',
      },
    },
  },
  render: (_args, { globals }) => {
    const labelStyle = 'display: flex; align-items: center; gap: 12px; color: var(--md-sys-color-on-surface, #1C1B1F);';
    return html`
      <form
        id="prefs-form"
        style="display: flex; flex-direction: column; gap: 16px; padding: 24px; max-width: 420px;"
        @submit=${(e: Event) => {
          e.preventDefault();
          const data = new FormData(e.target as HTMLFormElement);
          const out = document.getElementById('form-out');
          if (out) out.textContent = 'Submitted: ' + (JSON.stringify(Object.fromEntries(data)) || '{}');
        }}
      >
        <label style=${labelStyle}><md-switch name="email" value="on" selected aria-label="${t(globals.locale, 'switch.emailNotifications')}"></md-switch> ${t(globals.locale, 'switch.emailNotifications')}</label>
        <label style=${labelStyle}><md-switch name="sms" value="on" aria-label="${t(globals.locale, 'switch.smsNotifications')}"></md-switch> ${t(globals.locale, 'switch.smsNotifications')}</label>
        <label style=${labelStyle}><md-switch name="marketing" value="yes" aria-label="${t(globals.locale, 'switch.marketingEmails')}"></md-switch> ${t(globals.locale, 'switch.marketingEmails')}</label>
        <div style="display: flex; gap: 8px;">
          <md-button type="submit" variant="filled" size="sm">${t(globals.locale, 'submit')}</md-button>
          <md-button type="reset" variant="text" size="sm">${t(globals.locale, 'switch.reset')}</md-button>
        </div>
        <div id="form-out" style="font-family: monospace; font-size: 12px; padding: 12px; background: var(--md-sys-color-surface-container, #F2ECF4); border-radius: 8px; color: var(--md-sys-color-on-surface, #1C1B1F);">Submitted: —</div>
      </form>
    `;
  },
  /** Submit payload reflects live on/off state: selected switches contribute
   *  `value` under `name`, off switches are absent, and Reset restores it all. */
  play: async ({ canvasElement, step }) => {
    const switches = [...canvasElement.querySelectorAll('md-switch')] as SwitchEl[];
    await Promise.all(
      switches.map((sw) => waitFor(() => expect(sw.classList.contains('hydrated')).toBe(true))),
    );
    const [email, sms] = switches;
    const submitBtn = canvasElement.querySelector('md-button[type="submit"]') as HTMLElement;
    const resetBtn = canvasElement.querySelector('md-button[type="reset"]') as HTMLElement;
    await waitFor(() => expect(submitBtn.classList.contains('hydrated')).toBe(true));
    await waitFor(() => expect(resetBtn.classList.contains('hydrated')).toBe(true));
    const out = canvasElement.querySelector('#form-out') as HTMLElement;

    /** Submit via the real submit button (routes through md-button →
     *  internals.form.requestSubmit) and parse the serialized FormData. */
    const submitAndRead = async (): Promise<Record<string, string>> => {
      out.textContent = 'Submitted: —'; // clear the prior result so the wait is meaningful
      submitBtn.click();
      await waitFor(() => expect(out.textContent).toMatch(/^Submitted: \{/));
      return JSON.parse(out.textContent!.replace('Submitted: ', ''));
    };

    await step('Only selected switches submit — off ones are absent', async () => {
      expect(email.selected).toBe(true); // seeded on in the markup
      const payload = await submitAndRead();
      expect(payload.email).toBe('on');       // selected → value 'on' under name 'email'
      expect('sms' in payload).toBe(false);   // off → absent from FormData entirely
      expect('marketing' in payload).toBe(false);
      expect(Object.keys(payload).length).toBe(1);
    });

    await step('Toggling a switch on changes the submitted payload', async () => {
      const before = sms.selected; // false
      sms.click();
      await waitFor(() => expect(sms.selected).not.toBe(before)); // it MOVED
      await waitFor(() => expect(sms.getAttribute('aria-checked')).toBe('true'));
      const payload = await submitAndRead();
      expect(payload.sms).toBe('on');   // now contributes under its name
      expect(payload.email).toBe('on'); // untouched switch still contributes
      expect(Object.keys(payload).length).toBe(2); // payload grew by one
    });

    await step('Reset restores initial state — toggled switch drops back out', async () => {
      resetBtn.click();
      await waitFor(() => expect(sms.selected).toBe(false)); // formResetCallback → initialSelected
      await waitFor(() => expect(sms.getAttribute('aria-checked')).toBe('false'));
      const payload = await submitAndRead();
      expect('sms' in payload).toBe(false); // off again → absent
      expect(payload.email).toBe('on');     // its initial-on state was preserved
      expect(Object.keys(payload).length).toBe(1);
    });

    await step('A non-default value ("yes") is submitted under its name when toggled on', async () => {
      const marketing = switches[2]; // name="marketing" value="yes"
      expect(marketing.selected).toBe(false);
      marketing.click();
      await waitFor(() => expect(marketing.selected).toBe(true));
      const payload = await submitAndRead();
      expect(payload.marketing).toBe('yes'); // syncFormValue submits the prop value, not the default 'on'
      expect(payload.email).toBe('on');
      expect(Object.keys(payload).length).toBe(2);
    });

    await step('Mutating value at runtime re-syncs the submitted FormData (@Watch(value))', async () => {
      (email as any).value = 'digest'; // property write triggers the value Watch → syncFormValue
      const payload = await submitAndRead();
      expect(payload.email).toBe('digest');  // the new value flows into FormData while still selected
      expect(payload.marketing).toBe('yes'); // untouched switch keeps its own value
      expect(Object.keys(payload).length).toBe(2);
    });

    // Reset to the fresh-render visual state for the VISUAL snapshot: the steps
    // above toggle `marketing` on, mutate `email.value`, and leave the output
    // div showing submitted JSON. Restore the initial on/off + placeholder text.
    await step('Reset to initial visual state (snapshot parity)', async () => {
      const marketing = switches[2];
      marketing.selected = false;                     // undo the toggle-on above (initial: off)
      (email as any).value = 'on';                    // restore the runtime-mutated value (markup value)
      out.textContent = 'Submitted: —';               // restore the pre-submit placeholder
      (document.activeElement as HTMLElement)?.blur(); // drop any focus from the button clicks
      await waitFor(() => expect(marketing.selected).toBe(false));
      await waitFor(() => expect(marketing.getAttribute('aria-checked')).toBe('false'));
      await waitFor(() => expect(email.selected).toBe(true)); // initial-on, untouched
      await waitFor(() => expect(sms.selected).toBe(false));  // reset earlier, still off
      await new Promise((r) => requestAnimationFrame(() => r(null))); // let the reset render settle
    });
  },
};

/* ─── Density & sizing (tokens) ───────────────────────────── */

export const Density: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Resize with `--md-switch-track-width` / `--md-switch-track-height` — the thumb sizes and ' +
          'slide offsets derive from the track, so alignment holds at any density.',
      },
    },
  },
  render: () => {
    const row = 'display: flex; align-items: center; gap: 16px;';
    const label = 'width: 120px; color: var(--md-sys-color-on-surface, #1C1B1F);';
    return html`
      <div style="display: flex; flex-direction: column; gap: 24px; padding: 24px;">
        <div style=${row}>
          <span style=${label}>Compact</span>
          <md-switch aria-label="Compact, off" style="--md-switch-track-width: 40px; --md-switch-track-height: 24px;"></md-switch>
          <md-switch selected icons aria-label="Compact, on" style="--md-switch-track-width: 40px; --md-switch-track-height: 24px;"></md-switch>
        </div>
        <div style=${row}>
          <span style=${label}>Default</span>
          <md-switch aria-label="Default, off"></md-switch>
          <md-switch selected icons aria-label="Default, on"></md-switch>
        </div>
        <div style=${row}>
          <span style=${label}>Large</span>
          <md-switch aria-label="Large, off" style="--md-switch-track-width: 68px; --md-switch-track-height: 40px;"></md-switch>
          <md-switch selected icons aria-label="Large, on" style="--md-switch-track-width: 68px; --md-switch-track-height: 40px;"></md-switch>
        </div>
      </div>
    `;
  },
};

/* ─── Custom icons ────────────────────────────────────────── */

export const CustomIcons: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Override the check / close glyphs with any Material Symbols name via ' +
          '`selected-icon` / `unselected-icon`, or slot fully custom icons per state.',
      },
    },
  },
  render: () => {
    const row = 'display: flex; align-items: center; gap: 16px;';
    const label = 'width: 200px; color: var(--md-sys-color-on-surface, #1C1B1F);';
    return html`
      <div style="display: flex; flex-direction: column; gap: 24px; padding: 24px;">
        <div style=${row}>
          <span style=${label}>Default (check / close)</span>
          <md-switch icons aria-label="Default icons, off"></md-switch>
          <md-switch selected icons aria-label="Default icons, on"></md-switch>
        </div>
        <div style=${row}>
          <span style=${label}>Glyph overrides (bolt / power_off)</span>
          <md-switch icons selected-icon="bolt" unselected-icon="power_off" aria-label="Glyph overrides, off"></md-switch>
          <md-switch selected icons selected-icon="bolt" unselected-icon="power_off" aria-label="Glyph overrides, on"></md-switch>
        </div>
        <div style=${row}>
          <span style=${label}>Theme (dark_mode / light_mode)</span>
          <md-switch icons selected-icon="dark_mode" unselected-icon="light_mode" aria-label="Theme icons, off"></md-switch>
          <md-switch selected icons selected-icon="dark_mode" unselected-icon="light_mode" aria-label="Theme icons, on"></md-switch>
        </div>
        <div style=${row}>
          <span style=${label}>Slotted SVG</span>
          <md-switch icons aria-label="Slotted SVG icons">
            <svg slot="selected-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>
            <svg slot="unselected-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.4 17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12z"/></svg>
          </md-switch>
        </div>
      </div>
    `;
  },
};

/* ─── Localization & RTL ──────────────────────────────────── */

export const Localization: Story = {
  name: 'Localization & RTL',
  parameters: {
    docs: {
      description: {
        story:
          'The switch has no built-in text: state is announced via `aria-checked` (localized by ' +
          "the user's assistive tech) and the name comes from your (localized) label. Layout mirrors " +
          'automatically in RTL. A localized switch is simply a localized label.',
      },
    },
  },
  render: () => {
    const label = 'display: flex; align-items: center; gap: 12px; color: var(--md-sys-color-on-surface, #1C1B1F);';
    return html`
      <div style="display: flex; flex-direction: column; gap: 24px; padding: 24px; max-width: 360px;">
        <label style=${label}><md-switch name="wifi" selected aria-label="Wi-Fi (English)"></md-switch> Wi-Fi <span style="color: var(--md-sys-color-on-surface-variant, #49454F);">(English)</span></label>
        <label style=${label}><md-switch name="wifi" selected aria-label="WLAN (Deutsch)"></md-switch> WLAN <span style="color: var(--md-sys-color-on-surface-variant, #49454F);">(Deutsch)</span></label>
        <label style=${label}><md-switch name="wifi" selected aria-label="Wi-Fi (日本語)"></md-switch> Wi-Fi <span style="color: var(--md-sys-color-on-surface-variant, #49454F);">(日本語)</span></label>
        <div dir="rtl" style="border-top: 1px solid var(--md-sys-color-outline-variant, #CAC4D0); padding-top: 16px;">
          <label style=${label}><md-switch name="wifi" selected aria-label="واي فاي (العربية)"></md-switch> واي فاي <span style="color: var(--md-sys-color-on-surface-variant, #49454F);">(العربية — RTL)</span></label>
        </div>
      </div>
    `;
  },
};

/* ─── Required (form validation) ──────────────────────────── */

export const Required: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'A `required` switch exposes `aria-required="true"` for assistive tech and native form ' +
          'validation, while still toggling normally.',
      },
    },
  },
  render: () => html`
    <md-switch required aria-label="Accept terms"></md-switch>
  `,
  play: async ({ canvasElement, step }) => {
    const sw = await getSwitch(canvasElement);

    await step('Required switch advertises aria-required', async () => {
      expect(sw.getAttribute('aria-required')).toBe('true'); // aria-required true branch
    });

    await step('Required switch still toggles on interaction', async () => {
      sw.click();
      await waitFor(() => expect(sw.selected).toBe(true));
      await waitFor(() => expect(sw.getAttribute('aria-checked')).toBe('true'));
    });
  },
};
