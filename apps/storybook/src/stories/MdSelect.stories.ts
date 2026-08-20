import type { Meta, StoryObj } from '@storybook/web-components';
import { expect, waitFor } from 'storybook/test';
import { html, nothing } from 'lit';
import { ref } from 'lit/directives/ref.js';
import { t } from '../i18n';

/** Shadow-piercing helpers for play(): testing-library queries can't cross
 *  shadow roots, so interactions address the real internals directly. */
type SelectEl = HTMLElement & { value: string; open: boolean };
const getSelect = async (canvasElement: HTMLElement): Promise<SelectEl> => {
  const sel = canvasElement.querySelector('md-select') as SelectEl;
  await waitFor(() => expect(sel.classList.contains('hydrated')).toBe(true));
  return sel;
};
const fieldOf = (sel: SelectEl) =>
  sel.shadowRoot!.querySelector('md-text-field') as HTMLElement;
const inputOf = (sel: SelectEl) =>
  fieldOf(sel).shadowRoot!.querySelector('input') as HTMLInputElement;
const optionsOf = (sel: SelectEl) =>
  [...sel.shadowRoot!.querySelectorAll('md-menu-item')] as Array<
    HTMLElement & { headline?: string }
  >;
const key = (target: Element, k: string) =>
  target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, composed: true }));

/**
 * `md-select` — Material Design 3 single-select dropdown.
 *
 * Built from the library's own primitives: an `md-text-field` trigger
 * (readonly, `appear-focused` while open) and an `md-menu` option surface
 * (anchoring, viewport flip/clamp, roving tabindex, type-ahead, Escape).
 * Options are authored as slotted `<md-select-option>` children **or** via
 * the programmatic `options` array.
 */

const colorOptions = [
  { value: 'red', label: 'Red', icon: 'circle', iconColor: '#E53935' },
  { value: 'green', label: 'Green', icon: 'circle', iconColor: '#43A047' },
  { value: 'blue', label: 'Blue', icon: 'circle', iconColor: '#1E88E5' },
  { value: 'purple', label: 'Purple', icon: 'circle', iconColor: '#8E24AA' },
];

const countryOptions = [
  { value: 'us', label: 'United States', icon: 'flag' },
  { value: 'gb', label: 'United Kingdom', icon: 'flag' },
  { value: 'de', label: 'Germany', icon: 'flag' },
  { value: 'jp', label: 'Japan', icon: 'flag' },
  { value: 'br', label: 'Brazil', icon: 'flag', disabled: true },
];

const meta: Meta = {
  title: 'Selection/Select',
  component: 'md-select',
  tags: ['autodocs'],
  parameters: { docs: { source: { language: 'html' } } },
  argTypes: {
    variant: { control: { type: 'select' }, options: ['filled', 'outlined'] },
    label: { control: 'text' },
    placeholder: { control: 'text' },
    disabled: { control: 'boolean' },
    required: { control: 'boolean' },
    error: { control: 'boolean' },
    clearable: { control: 'boolean' },
    matchTriggerWidth: { control: 'boolean' },
    maxHeight: { control: { type: 'number' } },
    placement: {
      control: { type: 'select' },
      options: ['bottom-start', 'bottom-end', 'top-start', 'top-end'],
    },
  },
  args: {
    variant: 'outlined',
    label: 'Colour',
    placeholder: 'Choose a colour',
    disabled: false,
    required: false,
    error: false,
    clearable: false,
    matchTriggerWidth: true,
    maxHeight: undefined,
    placement: 'bottom-start',
  },
};
export default meta;
type Story = StoryObj;

const BOX = 'width:280px; padding:24px;';
const HEADING =
  'color:var(--md-sys-color-on-surface-variant,#49454F); margin:20px 0 8px; font-size:13px; font-weight:500; text-transform:uppercase; letter-spacing:0.5px; font-family:Roboto,sans-serif;';

/* ── Playground ─────────────────────────────────────────── */
export const Playground: Story = {
  render: (args, { globals }) => html`
    <div style="${BOX}">
      <md-select
        variant=${args.variant}
        label=${args.label}
        placeholder=${args.placeholder}
        ?disabled=${args.disabled}
        ?required=${args.required}
        ?error=${args.error}
        ?clearable=${args.clearable}
        ?match-trigger-width=${args.matchTriggerWidth}
        max-height=${args.maxHeight ?? nothing}
        placement=${args.placement}
      >
        <md-select-option value="red">${t(globals.locale, 'select.red')}</md-select-option>
        <md-select-option value="green">${t(globals.locale, 'select.green')}</md-select-option>
        <md-select-option value="blue">${t(globals.locale, 'select.blue')}</md-select-option>
        <md-select-option value="purple">${t(globals.locale, 'select.purple')}</md-select-option>
      </md-select>
    </div>
  `,
  /** The core pointer + keyboard select flow, scripted (see the Interactions panel). */
  play: async ({ canvasElement, step }) => {
    const sel = await getSelect(canvasElement);

    await step('Clicking the trigger opens the listbox', async () => {
      fieldOf(sel).click();
      await waitFor(() => expect(sel.open).toBe(true));
      await waitFor(() => expect(optionsOf(sel).length).toBe(4));
      for (const opt of optionsOf(sel)) expect(opt.getAttribute('role')).toBe('option');
      // The Playground's default args set no value, so nothing is selected yet.
      expect(
        sel.shadowRoot!.querySelectorAll('md-menu-item[aria-selected="true"]').length,
      ).toBe(0);
    });

    await step('Clicking an option commits it, closes, and fills the trigger', async () => {
      const green = optionsOf(sel).find((o) => o.headline === 'Green') as HTMLElement;
      await waitFor(() => expect(green.classList.contains('hydrated')).toBe(true));
      green.click();
      await waitFor(() => expect(sel.value).toBe('green'));
      await waitFor(() => expect(sel.open).toBe(false));
      await waitFor(() => expect(inputOf(sel).value).toBe('Green'));
      await waitFor(() => expect(green.getAttribute('aria-selected')).toBe('true'));
    });

    await step('Keyboard: ArrowDown reopens (value marked), Escape closes', async () => {
      const field = fieldOf(sel);
      field.focus();
      key(field, 'ArrowDown');
      await waitFor(() => expect(sel.open).toBe(true));
      const selected = sel.shadowRoot!.querySelectorAll('md-menu-item[aria-selected="true"]');
      expect(selected.length).toBe(1);
      key(field, 'Escape');
      await waitFor(() => expect(sel.open).toBe(false));
      // Let the menu's close animation + timers settle before the play
      // returns — a teardown mid-animation registers as an unhandled error.
      await new Promise((r) => setTimeout(r, 300));
    });
  },
};

/* ── Variants ───────────────────────────────────────────── */
export const Variants: Story = {
  render: (_args, { globals }) => html`
    <div style="display:flex; gap:24px; padding:24px; flex-wrap:wrap;">
      <div style="width:240px;">
        <p style="${HEADING}">Outlined (default)</p>
        <md-select variant="outlined" label="${t(globals.locale, 'select.colour')}" value="green">
          <md-select-option value="red">${t(globals.locale, 'select.red')}</md-select-option>
          <md-select-option value="green">${t(globals.locale, 'select.green')}</md-select-option>
          <md-select-option value="blue">${t(globals.locale, 'select.blue')}</md-select-option>
        </md-select>
      </div>
      <div style="width:240px;">
        <p style="${HEADING}">Filled</p>
        <md-select variant="filled" label="${t(globals.locale, 'select.colour')}" value="blue">
          <md-select-option value="red">${t(globals.locale, 'select.red')}</md-select-option>
          <md-select-option value="green">${t(globals.locale, 'select.green')}</md-select-option>
          <md-select-option value="blue">${t(globals.locale, 'select.blue')}</md-select-option>
        </md-select>
      </div>
    </div>
  `,
};

/* ── Authoring: slotted vs options array ────────────────── */
export const AuthoringModes: Story = {
  name: 'Authoring — slotted vs array',
  render: (_args, { globals }) => html`
    <div style="display:flex; gap:24px; padding:24px; flex-wrap:wrap;">
      <div style="width:260px;">
        <p style="${HEADING}">Slotted &lt;md-select-option&gt;</p>
        <md-select label="${t(globals.locale, 'select.colour')}" value="red">
          <md-select-option value="red" icon="circle" icon-color="#E53935">${t(globals.locale, 'select.red')}</md-select-option>
          <md-select-option value="green" icon="circle" icon-color="#43A047">${t(globals.locale, 'select.green')}</md-select-option>
          <md-select-option value="blue" icon="circle" icon-color="#1E88E5">${t(globals.locale, 'select.blue')}</md-select-option>
        </md-select>
      </div>
      <div style="width:260px;">
        <p style="${HEADING}">Programmatic .options array</p>
        <md-select label="${t(globals.locale, 'select.country')}" .options=${countryOptions} value="us"></md-select>
        <p style="font:400 12px/16px Roboto,sans-serif; color:var(--md-sys-color-on-surface-variant, #49454F); margin-top:8px;">
          Brazil is <code>disabled</code> in the data.
        </p>
      </div>
    </div>
  `,
};

/* ── With leading icons + supporting text ───────────────── */
export const WithIconsAndSupportingText: Story = {
  name: 'Icons + supporting text',
  render: (_args, { globals }) => html`
    <div style="${BOX}">
      <md-select label="${t(globals.locale, 'select.account')}" value="checking">
        <md-select-option value="checking" icon="account_balance" supporting-text="•••• 4021">
          ${t(globals.locale, 'select.checking')}
        </md-select-option>
        <md-select-option value="savings" icon="savings" supporting-text="•••• 8830">
          ${t(globals.locale, 'select.savings')}
        </md-select-option>
        <md-select-option value="credit" icon="credit_card" supporting-text="•••• 1102">
          ${t(globals.locale, 'select.creditCard')}
        </md-select-option>
      </md-select>
    </div>
  `,
};

/* ── Match trigger width on/off ─────────────────────────── */
export const MatchTriggerWidth: Story = {
  name: 'Match trigger width',
  render: (_args, { globals }) => html`
    <div style="display:flex; gap:48px; padding:24px; flex-wrap:wrap;">
      <div style="width:320px;">
        <p style="${HEADING}">match-trigger-width (default)</p>
        <md-select label="${t(globals.locale, 'select.fruit')}" match-trigger-width value="kiwi">
          <md-select-option value="apple">${t(globals.locale, 'select.apple')}</md-select-option>
          <md-select-option value="kiwi">${t(globals.locale, 'select.kiwi')}</md-select-option>
          <md-select-option value="watermelon">${t(globals.locale, 'select.watermelon')}</md-select-option>
        </md-select>
        <p style="font:400 12px/16px Roboto,sans-serif; color:var(--md-sys-color-on-surface-variant, #49454F); margin-top:8px;">
          Menu fills the trigger width.
        </p>
      </div>
      <div style="width:320px;">
        <p style="${HEADING}">match-trigger-width="false"</p>
        <md-select label="${t(globals.locale, 'select.fruit')}" .matchTriggerWidth=${false} value="kiwi">
          <md-select-option value="apple">${t(globals.locale, 'select.apple')}</md-select-option>
          <md-select-option value="kiwi">${t(globals.locale, 'select.kiwi')}</md-select-option>
          <md-select-option value="watermelon">${t(globals.locale, 'select.watermelon')}</md-select-option>
        </md-select>
        <p style="font:400 12px/16px Roboto,sans-serif; color:var(--md-sys-color-on-surface-variant, #49454F); margin-top:8px;">
          Menu sizes to its content instead.
        </p>
      </div>
    </div>
  `,
};

/* ── States ─────────────────────────────────────────────── */
export const States: Story = {
  render: (_args, { globals }) => html`
    <div style="display:flex; flex-direction:column; gap:8px; padding:24px; width:280px;">
      <p style="${HEADING}">Empty</p>
      <md-select label="${t(globals.locale, 'select.colour')}" placeholder="${t(globals.locale, 'select.choose')}">
        <md-select-option value="red">${t(globals.locale, 'select.red')}</md-select-option>
        <md-select-option value="green">${t(globals.locale, 'select.green')}</md-select-option>
      </md-select>

      <p style="${HEADING}">Selected</p>
      <md-select label="${t(globals.locale, 'select.colour')}" value="green">
        <md-select-option value="red">${t(globals.locale, 'select.red')}</md-select-option>
        <md-select-option value="green">${t(globals.locale, 'select.green')}</md-select-option>
      </md-select>

      <p style="${HEADING}">Error</p>
      <md-select label="${t(globals.locale, 'select.colour')}" error error-text="${t(globals.locale, 'select.selectionRequired')}" required>
        <md-select-option value="red">${t(globals.locale, 'select.red')}</md-select-option>
        <md-select-option value="green">${t(globals.locale, 'select.green')}</md-select-option>
      </md-select>

      <p style="${HEADING}">Supporting text</p>
      <md-select label="${t(globals.locale, 'select.colour')}" supporting-text="${t(globals.locale, 'select.pickFavourite')}" value="red">
        <md-select-option value="red">${t(globals.locale, 'select.red')}</md-select-option>
        <md-select-option value="green">${t(globals.locale, 'select.green')}</md-select-option>
      </md-select>

      <p style="${HEADING}">Disabled</p>
      <md-select label="${t(globals.locale, 'select.colour')}" disabled value="red">
        <md-select-option value="red">${t(globals.locale, 'select.red')}</md-select-option>
        <md-select-option value="green">${t(globals.locale, 'select.green')}</md-select-option>
      </md-select>
    </div>
  `,
  /** Guard: a disabled select must not open — by pointer, keyboard, or the show() API. */
  play: async ({ canvasElement, step }) => {
    const enabled = canvasElement.querySelector('md-select:not([disabled])') as SelectEl;
    const disabled = canvasElement.querySelector('md-select[disabled]') as SelectEl;
    await waitFor(() => expect(enabled.classList.contains('hydrated')).toBe(true));
    await waitFor(() => expect(disabled.classList.contains('hydrated')).toBe(true));

    await step('Positive control: an enabled select DOES open on click', async () => {
      expect(enabled.open).toBe(false);
      fieldOf(enabled).click();
      // Proves the harness can drive a select open — so the disabled one staying
      // shut below is a real guard, not an inert page.
      await waitFor(() => expect(enabled.open).toBe(true));
      key(fieldOf(enabled), 'Escape');
      await waitFor(() => expect(enabled.open).toBe(false));
    });

    await step('Disabled select stays closed on click + keyboard + show() (guard)', async () => {
      let opened = false;
      disabled.addEventListener('mdOpen', () => { opened = true; });
      expect(disabled.open).toBe(false);
      expect(inputOf(disabled).disabled).toBe(true); // the trigger really is inert
      fieldOf(disabled).click();
      key(disabled, 'ArrowDown');
      key(disabled, 'Enter');
      await (disabled as SelectEl & { show: () => Promise<void> }).show(); // JS API is guarded too
      await new Promise((r) => setTimeout(r, 80));
      expect(disabled.open).toBe(false); // never opened by any path
      expect(opened).toBe(false);        // …and mdOpen never fired
      // Settle the enabled select's close animation before teardown.
      await new Promise((r) => setTimeout(r, 300));
    });
  },
};

/* ── Clearable ──────────────────────────────────────────── */
export const Clearable: Story = {
  render: (_args, { globals }) => html`
    <div style="${BOX}">
      <md-select label="${t(globals.locale, 'select.colour')}" clearable value="blue">
        <md-select-option value="red">${t(globals.locale, 'select.red')}</md-select-option>
        <md-select-option value="green">${t(globals.locale, 'select.green')}</md-select-option>
        <md-select-option value="blue">${t(globals.locale, 'select.blue')}</md-select-option>
      </md-select>
      <p style="font:400 12px/16px Roboto,sans-serif; color:var(--md-sys-color-on-surface-variant, #49454F); margin-top:8px;">
        A clear (✕) button appears in the trigger once a value is chosen.
      </p>
    </div>
  `,
  /** Clearing resets both the value and the visible trigger, and emits mdChange(""). */
  play: async ({ canvasElement, step }) => {
    const sel = await getSelect(canvasElement);
    const clearBtn = () =>
      sel.shadowRoot!.querySelector('.md-select__clear') as HTMLElement | null;

    await step('Precondition: value is set and the clear (✕) button is showing', async () => {
      expect(sel.value).toBe('blue');
      await waitFor(() => expect(inputOf(sel).value).toBe('Blue'));
      await waitFor(() => expect(clearBtn()).not.toBeNull());
    });

    await step('Clicking clear empties the value + trigger and fires mdChange("")', async () => {
      const before = inputOf(sel).value; // 'Blue'
      let detail: string | undefined;
      sel.addEventListener(
        'mdChange',
        (e) => { detail = (e as CustomEvent<string>).detail; },
        { once: true },
      );
      clearBtn()!.click();
      await waitFor(() => expect(sel.value).toBe(''));
      await waitFor(() => expect(inputOf(sel).value).not.toBe(before)); // it MOVED off 'Blue'
      expect(inputOf(sel).value).toBe('');                             // …to empty
      expect(detail).toBe('');                                         // the component fired the event
      // With no value the clear affordance unmounts — the reverse-state guard.
      await waitFor(() => expect(clearBtn()).toBeNull());
    });
  },
};

/* ── Density ────────────────────────────────────────────── */
export const Density: Story = {
  render: (_args, { globals }) => html`
    <div style="display:flex; flex-direction:column; gap:16px; padding:24px; width:280px;">
      ${[0, -1, -2, -3].map(
        (d) => html`
          <md-select label="Density ${d}" .density=${d} value="green">
            <md-select-option value="red">${t(globals.locale, 'select.red')}</md-select-option>
            <md-select-option value="green">${t(globals.locale, 'select.green')}</md-select-option>
            <md-select-option value="blue">${t(globals.locale, 'select.blue')}</md-select-option>
          </md-select>
        `,
      )}
    </div>
  `,
};

/* ── Long list (max-height scroll + shadow + type-ahead) ─── */
export const LongList: Story = {
  render: (_args, { globals }) => {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    return html`
      <div style="${BOX}">
        <md-select label="${t(globals.locale, 'select.month')}" value="June" max-height="240">
          ${months.map(
            (m) => html`<md-select-option value=${m}>${m}</md-select-option>`,
          )}
        </md-select>
        <p style="font:400 12px/16px Roboto,sans-serif; color:var(--md-sys-color-on-surface-variant, #49454F); margin-top:8px;">
          <code>max-height="240"</code> caps the dropdown — the list scrolls with
          top/bottom edge shadows. Type "s" to jump to September (type-ahead).
        </p>
      </div>
    `;
  },
};

/**
 * Virtualized + WebAssembly-backed. Ten million options live packed in WASM
 * linear memory; only the ~visible rows are ever in the DOM. Filtering and
 * typeahead run inside WASM. `loadOptions(source)` is the high-scale entry point.
 */
const VIRTUAL_ROW_COUNT = 10_000_000;

// A row factory instead of a materialised array: `loadOptions` packs rows into
// WASM one at a time, so ten million options never exist as JS objects at once
// (a materialised array would be ~1.5GB and freeze the tab). Labels are plain
// strings — no per-row `toLocaleString()`.
const virtualRowSource = {
  count: VIRTUAL_ROW_COUNT,
  getRow: (i: number) => ({ value: `v${i}`, label: `Option ${i}` }),
};

// lit re-creates the render closure (and its ref callback) on every re-render —
// theme / control / HMR changes included — which would re-run the load each
// time. Keying on the live element makes the load happen once per mounted select.
const virtualLoaded = new WeakSet<Element>();

export const VirtualizedTenMillion: Story = {
  render: (_args, { globals }) => {
    const onRef = (el?: Element) => {
      if (!el || virtualLoaded.has(el)) return;
      virtualLoaded.add(el);
      const select = el as HTMLElement & {
        loading?: boolean;
        loadOptions?: (source: {
          count: number;
          getRow: (i: number) => { value: string; label: string };
        }) => Promise<void>;
      };
      // Flip the trigger into its busy state while the dataset packs into WASM —
      // the spinner replaces the caret and the host becomes aria-busy. The
      // chunked load keeps the page responsive, so this status actually paints.
      select.loading = true;
      const status = el.parentElement?.querySelector('.vstatus') as HTMLElement | null;
      if (status) status.textContent = 'Loading 10,000,000 options…';
      const t0 = performance.now();
      void select.loadOptions?.(virtualRowSource).then(() => {
        select.loading = false;
        if (status) status.textContent = `Ready — 10,000,000 options in ${Math.round(performance.now() - t0)} ms.`;
      });
    };
    return html`
      <div style="${BOX}">
        <md-select
          ${ref(onRef)}
          label="${t(globals.locale, 'select.option')}"
          virtualize="always"
          filterable
          max-height="320"
        ></md-select>
        <p
          class="vstatus"
          style="font:500 12px/16px Roboto,sans-serif; color: var(--md-sys-color-on-surface-variant, #49454F); margin-top:8px; min-height:16px;"
        ></p>
        <p style="font:400 12px/16px Roboto,sans-serif; color:var(--md-sys-color-on-surface-variant, #49454F); margin-top:4px;">
          10,000,000 options in WebAssembly. Open the menu and scroll — only ~30
          rows exist in the DOM at any time. Type in the search box to filter
          (substring match runs in WASM), or use ↑/↓, Home/End, and type-ahead.
        </p>
      </div>
    `;
  },
};

/**
 * Virtualized rows carry an optional leading icon + supporting line. They are
 * packed into WASM as two extra columns alongside the label (allocated only when
 * the dataset uses them), so the icon/two-line layout scales the same way the
 * label-only list does. Just return `icon` / `supportingText` from `getRow`
 * (or include them on the materialised `options` / `loadOptions` array).
 */
const VIRTUAL_RICH_COUNT = 100_000;
const RICH_ICONS = ['person', 'star', 'bolt', 'favorite', 'home', 'work', 'cloud', 'bookmark'];
const virtualRichSource = {
  count: VIRTUAL_RICH_COUNT,
  getRow: (i: number) => {
    const icon = RICH_ICONS[i % RICH_ICONS.length];
    return { value: `u${i}`, label: `Item ${i}`, icon, supportingText: `ID ${i} · ${icon}` };
  },
};
const virtualRichLoaded = new WeakSet<Element>();

export const VirtualizedWithIconsAndSupportingText: Story = {
  render: (_args, { globals }) => {
    const onRef = (el?: Element) => {
      if (!el || virtualRichLoaded.has(el)) return;
      virtualRichLoaded.add(el);
      const select = el as HTMLElement & {
        loadOptions?: (source: {
          count: number;
          getRow: (i: number) => {
            value: string;
            label: string;
            icon: string;
            supportingText: string;
          };
        }) => Promise<void>;
      };
      void select.loadOptions?.(virtualRichSource);
    };
    return html`
      <div style="${BOX}">
        <md-select
          ${ref(onRef)}
          label="${t(globals.locale, 'select.item')}"
          virtualize="always"
          filterable
          max-height="360"
        ></md-select>
        <p style="font:400 12px/16px Roboto,sans-serif; color:var(--md-sys-color-on-surface-variant, #49454F); margin-top:8px;">
          100,000 virtualized rows, each with a leading icon and a supporting line —
          both packed into WASM next to the label. Open and scroll; only the
          visible rows exist in the DOM. Set <code>icon</code> /
          <code>supportingText</code> on each row returned by
          <code>getRow</code> (uniform row height is assumed, so keep rows the same
          shape).
        </p>
      </div>
    `;
  },
};

/**
 * Five million rows, each with a leading icon **and** a supporting line.
 *
 * This is the full recipe for the high-scale virtualized select — read the
 * heavily-commented `render` below to copy it. The short version:
 *
 *  1. Describe the dataset with a **row factory**, not an array. A factory is
 *     `{ count, getRow(i) }`; `getRow` returns one row on demand. Five million
 *     materialised objects would be multiple GB and freeze the tab — the factory
 *     lets `loadOptions` pack rows into WebAssembly memory one at a time.
 *  2. Each row may carry `icon` (a Material Symbols name) and `supportingText`
 *     (the second line). These become extra columns in WASM, allocated only when
 *     present, so the rich two-line layout scales exactly like the label-only
 *     list. Keep every row the same shape — the list assumes a uniform row height.
 *  3. Call `await select.loadOptions(source)` once, after the element mounts.
 *  4. Set `virtualize="always"` so it uses the WASM path regardless of count,
 *     `filterable` for the in-WASM substring search, and a `max-height` to bound
 *     the scroll viewport.
 *
 * Only ~30 rows ever exist in the DOM; scrolling, ↑/↓, Home/End, type-ahead and
 * filtering all run against the packed dataset.
 */
const VIRTUAL_RICH_5M_COUNT = 5_000_000;

// Cycle a handful of Material Symbols so each row looks distinct. `supportingText`
// is the second line under the label.
const RICH_5M_ICONS = ['person', 'star', 'bolt', 'favorite', 'home', 'work', 'cloud', 'bookmark'];

// One row shape. `value` is what the select emits on change; `label` is the
// primary line; `icon` + `supportingText` are optional per-row extras.
interface Rich5MRow {
  value: string;
  label: string;
  icon: string;
  supportingText: string;
}

// THE DATA SOURCE — a row factory, NOT an array. `getRow(i)` is called lazily by
// `loadOptions` for each index as it packs the row into WASM, so the five million
// rows never exist as JS objects at the same time.
const virtualRich5MSource: {
  count: number;
  getRow: (i: number) => Rich5MRow;
} = {
  count: VIRTUAL_RICH_5M_COUNT,
  getRow: (i: number) => {
    const icon = RICH_5M_ICONS[i % RICH_5M_ICONS.length];
    return {
      value: `u${i}`,
      label: `Item ${i}`,
      icon,
      // Keep this cheap — it runs five million times. Plain string concat only;
      // no `toLocaleString()` / formatting per row.
      supportingText: `ID ${i} · ${icon}`,
    };
  },
};

// lit re-creates the render closure (and its `ref` callback) on every re-render —
// theme / control / HMR changes included. Tracking mounted elements in a WeakSet
// makes the (expensive) load run exactly once per mounted select.
const virtualRich5MLoaded = new WeakSet<Element>();

export const VirtualizedFiveMillionWithIconsAndText: Story = {
  render: (_args, { globals }) => {
    // `ref` fires with the <md-select> element once it's in the DOM. Load there
    // (not at module scope) so we have the real element to call loadOptions on.
    const onRef = (el?: Element) => {
      if (!el || virtualRich5MLoaded.has(el)) return; // load once per element
      virtualRich5MLoaded.add(el);

      // `loadOptions` is the high-scale entry point. It accepts either a
      // materialised array OR this `{ count, getRow }` factory. Returns a Promise
      // that resolves when the dataset is packed and the first window is ready.
      const select = el as HTMLElement & {
        loading?: boolean;
        loadOptions?: (source: typeof virtualRich5MSource) => Promise<void>;
      };

      // Busy state on while the dataset packs (spinner in the trigger + aria-busy).
      // The load is chunked and yields to the event loop, so the page stays
      // responsive and this status text actually paints while rows pack in.
      select.loading = true;
      const status = el.parentElement?.querySelector('.vstatus') as HTMLElement | null;
      if (status) status.textContent = 'Loading 5,000,000 rows…';
      const t0 = performance.now();
      void select.loadOptions?.(virtualRich5MSource).then(() => {
        select.loading = false;
        if (status) {
          status.textContent = `Ready — 5,000,000 rows in ${Math.round(
            performance.now() - t0,
          )} ms.`;
        }
      });
    };

    return html`
      <div style="${BOX}">
        <md-select
          ${ref(onRef)}
          label="${t(globals.locale, 'select.item')}"
          virtualize="always"
          filterable
          max-height="360"
        ></md-select>
        <p
          class="vstatus"
          style="font:500 12px/16px Roboto,sans-serif; color: var(--md-sys-color-on-surface-variant, #49454F); margin-top:8px; min-height:16px;"
        ></p>
        <p style="font:400 12px/16px Roboto,sans-serif; color:var(--md-sys-color-on-surface-variant, #49454F); margin-top:4px;">
          5,000,000 virtualized rows, each with a leading icon and a supporting
          line — both packed into WASM next to the label. Open and scroll; only the
          visible rows exist in the DOM. The whole recipe is in this story's source
          (View Code): a <code>{ count, getRow }</code> row factory passed to
          <code>loadOptions</code>, returning <code>icon</code> /
          <code>supportingText</code> per row.
        </p>
      </div>
    `;
  },
};

/* ── RTL ────────────────────────────────────────────────── */
export const RTL: Story = {
  render: () => html`
    <div dir="rtl" style="${BOX}">
      <md-select label="اللون" value="green">
        <md-select-option value="red">أحمر</md-select-option>
        <md-select-option value="green">أخضر</md-select-option>
        <md-select-option value="blue">أزرق</md-select-option>
      </md-select>
    </div>
  `,
};

/* ── Localization ───────────────────────────────────────── */

/**
 * Full localization. Two layers:
 *
 *  1. **Your data** — the `label`, `placeholder`, and option labels are your
 *     strings; translate them per locale.
 *  2. **The component's built-in UI strings** — exposed as props so they aren't
 *     stuck in English: `search-placeholder`, `no-results-text`,
 *     `no-options-text`, `clear-label`, `searching-label`, `filter-label`. Set
 *     them from your i18n dictionary.
 *
 * Pair with `dir="rtl"` (and `lang`) on a container for right-to-left locales —
 * the whole control mirrors via CSS logical properties. Each select below is the
 * filterable/virtualized variant so the localized search field + empty state show.
 */
const LOCALE_FRUITS = ['apple', 'banana', 'cherry', 'grape', 'orange', 'lemon', 'peach', 'pear'];
const LOCALES = [
  {
    code: 'en', dir: 'ltr', label: 'Fruit', placeholder: 'Select a fruit',
    search: 'Search…', noResults: 'No results', clear: 'Clear selection',
    t: ['Apple', 'Banana', 'Cherry', 'Grape', 'Orange', 'Lemon', 'Peach', 'Pear'],
  },
  {
    code: 'de', dir: 'ltr', label: 'Obst', placeholder: 'Obst auswählen',
    search: 'Suchen…', noResults: 'Keine Ergebnisse', clear: 'Auswahl löschen',
    t: ['Apfel', 'Banane', 'Kirsche', 'Traube', 'Orange', 'Zitrone', 'Pfirsich', 'Birne'],
  },
  {
    code: 'ja', dir: 'ltr', label: '果物', placeholder: '果物を選択',
    search: '検索…', noResults: '結果なし', clear: '選択をクリア',
    t: ['りんご', 'バナナ', 'さくらんぼ', 'ぶどう', 'オレンジ', 'レモン', '桃', '梨'],
  },
  {
    code: 'ar', dir: 'rtl', label: 'فاكهة', placeholder: 'اختر فاكهة',
    search: 'بحث…', noResults: 'لا نتائج', clear: 'مسح الاختيار',
    t: ['تفاحة', 'موز', 'كرز', 'عنب', 'برتقال', 'ليمون', 'خوخ', 'كمثرى'],
  },
];
const localizedLoaded = new WeakSet<Element>();

export const Localization: Story = {
  render: () => {
    // Each locale loads its own translated option set once it mounts.
    const loaderFor =
      (loc: (typeof LOCALES)[number]) => (el?: Element) => {
        if (!el || localizedLoaded.has(el)) return;
        localizedLoaded.add(el);
        const select = el as HTMLElement & {
          loadOptions?: (rows: Array<{ value: string; label: string }>) => Promise<void>;
        };
        void select.loadOptions?.(
          LOCALE_FRUITS.map((value, i) => ({ value, label: loc.t[i] })),
        );
      };
    return html`
      <div style="display:flex; gap:24px; padding:24px; flex-wrap:wrap;">
        ${LOCALES.map(
          (loc) => html`
            <div dir="${loc.dir}" lang="${loc.code}" style="width:240px;">
              <p style="font:600 12px/16px Roboto,sans-serif; color:var(--md-sys-color-on-surface-variant, #49454F); margin:0 0 8px;">
                ${loc.code.toUpperCase()} · ${loc.dir.toUpperCase()}
              </p>
              <md-select
                ${ref(loaderFor(loc))}
                label="${loc.label}"
                placeholder="${loc.placeholder}"
                virtualize="always"
                filterable
                clearable
                value="apple"
                max-height="240"
                search-placeholder="${loc.search}"
                no-results-text="${loc.noResults}"
                clear-label="${loc.clear}"
              ></md-select>
            </div>
          `,
        )}
      </div>
    `;
  },
};

/* ── Icon customization ─────────────────────────────────── */

/**
 * Swap the clear and caret icons. Use the `clear-icon` / `dropdown-icon` props
 * (Material Symbols names) for the simple case, or the `dropdown-icon` slot to
 * drop in any element (e.g. an SVG). The caret rotates 180° on open regardless,
 * so a custom chevron reads correctly both ways.
 */
export const IconCustomization: Story = {
  render: (_args, { globals }) => html`
    <div style="display:flex; gap:24px; padding:24px; flex-wrap:wrap;">
      <div style="width:240px;">
        <p style="font:600 12px/16px Roboto,sans-serif; color:var(--md-sys-color-on-surface-variant, #49454F); margin:0 0 8px;">
          clear-icon + dropdown-icon props
        </p>
        <md-select
          label="${t(globals.locale, 'select.priority')}"
          value="high"
          clearable
          clear-icon="cancel"
          dropdown-icon="expand_more"
        >
          <md-select-option value="low">${t(globals.locale, 'select.low')}</md-select-option>
          <md-select-option value="medium">${t(globals.locale, 'select.medium')}</md-select-option>
          <md-select-option value="high">${t(globals.locale, 'select.high')}</md-select-option>
        </md-select>
      </div>
      <div style="width:240px;">
        <p style="font:600 12px/16px Roboto,sans-serif; color:var(--md-sys-color-on-surface-variant, #49454F); margin:0 0 8px;">
          slotted caret (custom SVG)
        </p>
        <md-select label="${t(globals.locale, 'select.sort')}" value="az">
          <svg
            slot="dropdown-icon"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
          <md-select-option value="az">A–Z</md-select-option>
          <md-select-option value="za">Z–A</md-select-option>
        </md-select>
      </div>
    </div>
  `,
};

/* ── Loading / busy state ───────────────────────────────── */

/**
 * `loading` puts the trigger into a busy state — a spinner replaces the caret and
 * the host becomes `aria-busy` — for the "fetch then `loadOptions`" flow. Replace
 * the spinner via the `loader` slot. Size it with `--md-select-spinner-size`.
 *
 * The 10M / 5M virtualized stories toggle `loading` automatically while their
 * dataset packs into WASM.
 */
export const Loading: Story = {
  render: (_args, { globals, viewMode }) => html`
    <div style="display:flex; gap:24px; padding:24px; flex-wrap:wrap;">
      <div style="width:240px; min-height:160px;">
        <p style="font:600 12px/16px Roboto,sans-serif; color:var(--md-sys-color-on-surface-variant, #49454F); margin:0 0 8px;">
          trigger spinner + open menu shows a wavy progress bar
        </p>
        <md-select label="${t(globals.locale, 'select.account')}" loading ?open=${viewMode !== 'docs'} placeholder="${t(globals.locale, 'select.loadingAccounts')}"></md-select>
      </div>
      <div style="width:240px;">
        <p style="font:600 12px/16px Roboto,sans-serif; color:var(--md-sys-color-on-surface-variant, #49454F); margin:0 0 8px;">
          custom loader (slot)
        </p>
        <md-select label="${t(globals.locale, 'select.account')}" loading placeholder="${t(globals.locale, 'select.fetching')}">
          <span
            slot="loader"
            class="material-symbols-outlined"
            style="font-size:20px; color: var(--md-sys-color-on-surface-variant, #49454F); animation:md-select-spin 1s linear infinite;"
            aria-hidden="true"
            >progress_activity</span
          >
        </md-select>
      </div>
    </div>
    <style>
      @keyframes md-select-spin {
        to {
          transform: rotate(360deg);
        }
      }
    </style>
  `,
};

/* ── Full width / responsive ────────────────────────────── */

/**
 * By default the select fills its parent's inline width. Set `full-width` to make
 * that explicit and robust (block layout) — handy inside flex/grid form rows where
 * each field should share the available space. Add `match-trigger-width` so the
 * dropdown matches the (now wider) trigger.
 */
export const FullWidthResponsive: Story = {
  render: (_args, { globals }) => html`
    <div style="max-width:680px; padding:24px; display:flex; flex-direction:column; gap:16px;">
      <p style="font:400 12px/16px Roboto,sans-serif; color:var(--md-sys-color-on-surface-variant, #49454F); margin:0;">
        <strong>Drag the bottom-right corner</strong> of the box below to resize it —
        the <code>full-width</code> select tracks the container (and the
        <code>match-trigger-width</code> dropdown follows).
      </p>
      <!-- A resizable container: CSS resize + overflow gives the drag handle. -->
      <div
        style="
          resize: horizontal;
          overflow: auto;
          inline-size: 360px;
          min-inline-size: 200px;
          max-inline-size: 100%;
          padding: 16px;
          border: 1px dashed var(--md-sys-color-outline, #79747E);
          border-radius: 12px;
        "
      >
        <md-select full-width match-trigger-width label="${t(globals.locale, 'select.country')}" value="us">
          <md-select-option value="us">United States</md-select-option>
          <md-select-option value="gb">United Kingdom</md-select-option>
          <md-select-option value="de">Germany</md-select-option>
          <md-select-option value="jp">Japan</md-select-option>
        </md-select>
      </div>

      <p style="font:400 12px/16px Roboto,sans-serif; color:var(--md-sys-color-on-surface-variant, #49454F); margin:8px 0 0;">
        Two <code>full-width</code> selects in a flex row each take an equal share —
        the layout stays responsive as the row shrinks.
      </p>
      <div style="display:flex; gap:16px; flex-wrap:wrap;">
        <md-select full-width style="flex:1 1 200px;" label="${t(globals.locale, 'select.firstName')}" value="a">
          <md-select-option value="a">Ada</md-select-option>
          <md-select-option value="b">Grace</md-select-option>
        </md-select>
        <md-select full-width style="flex:1 1 200px;" label="${t(globals.locale, 'select.lastName')}" value="x">
          <md-select-option value="x">Lovelace</md-select-option>
          <md-select-option value="y">Hopper</md-select-option>
        </md-select>
      </div>
    </div>
  `,
};

/* ── Dark theme ─────────────────────────────────────────── */
export const DarkTheme: Story = {
  decorators: [
    (story) => html`
      <div data-theme="dark" style="background:var(--md-sys-color-surface,#1C1B1F); padding:24px; border-radius:16px;">
        ${story()}
      </div>
    `,
  ],
  render: (_args, { globals }) => html`
    <div style="width:280px;">
      <md-select label="${t(globals.locale, 'select.colour')}" value="blue">
        <md-select-option value="red">${t(globals.locale, 'select.red')}</md-select-option>
        <md-select-option value="green">${t(globals.locale, 'select.green')}</md-select-option>
        <md-select-option value="blue">${t(globals.locale, 'select.blue')}</md-select-option>
      </md-select>
    </div>
  `,
};

/* ── Form participation ─────────────────────────────────── */
export const FormParticipation: Story = {
  render: (_args, { globals }) => html`
    <form
      style="${BOX}"
      @submit=${(e: Event) => {
        e.preventDefault();
        const data = new FormData(e.target as HTMLFormElement);
        const out = document.getElementById('select-form-out')!;
        out.textContent = `colour = ${data.get('colour') ?? '(none)'}`;
      }}
    >
      <md-select name="colour" label="${t(globals.locale, 'select.colour')}" value="green" .options=${colorOptions.map((o) => ({ ...o, label: t(globals.locale, 'select.' + o.value) }))}></md-select>
      <div style="margin-top:16px; display:flex; gap:8px;">
        <md-button type="submit" variant="filled">${t(globals.locale, 'submit')}</md-button>
      </div>
      <div
        id="select-form-out"
        style="margin-top:12px; font:400 13px/20px 'Roboto Mono',monospace; color:var(--md-sys-color-on-surface,#1C1B1F);"
      >
        Submit to read the FormData value…
      </div>
    </form>
  `,
  /** The submitted FormData tracks the live selection under the field's name. */
  play: async ({ canvasElement, step }) => {
    const form = canvasElement.querySelector('form') as HTMLFormElement;
    const sel = await getSelect(canvasElement);
    const out = canvasElement.querySelector('#select-form-out') as HTMLElement;
    const submitBtn = canvasElement.querySelector('md-button[type="submit"]') as HTMLElement;
    // The submit md-button must be hydrated or its click is a silent no-op
    // (form never submits, readout stays on the placeholder).
    await waitFor(() => expect(submitBtn.classList.contains('hydrated')).toBe(true));
    const submit = () => submitBtn.click();

    await step('Initial selection is submitted under name="colour"', async () => {
      expect(sel.value).toBe('green');
      submit();
      await waitFor(() => expect(out.textContent).toContain('green'));
      // Read the ElementInternals-contributed value straight off the form.
      expect(new FormData(form).get('colour')).toBe('green');
    });

    await step('Choosing another option updates the form value', async () => {
      const before = new FormData(form).get('colour'); // 'green'
      fieldOf(sel).click();
      await waitFor(() => expect(sel.open).toBe(true));
      const red = optionsOf(sel).find((o) => o.headline === 'Red') as HTMLElement;
      await waitFor(() => expect(red.classList.contains('hydrated')).toBe(true));
      red.click();
      await waitFor(() => expect(sel.value).toBe('red'));
      await waitFor(() => expect(inputOf(sel).value).toBe('Red'));
      await waitFor(() => expect(new FormData(form).get('colour')).not.toBe(before)); // payload MOVED
      expect(new FormData(form).get('colour')).toBe('red');                           // …to the new pick
    });

    await step('Re-submitting reflects the NEW selection', async () => {
      const prev = out.textContent; // 'colour = green'
      submit();
      await waitFor(() => expect(out.textContent).not.toBe(prev)); // the readout changed
      expect(out.textContent).toContain('red');
      // Let the option menu's close animation settle before teardown.
      await new Promise((r) => setTimeout(r, 300));
    });

    await step('form.reset() restores the initial selection (formResetCallback)', async () => {
      expect(sel.value).toBe('red'); // we changed it away from the mounted default
      form.reset();
      // formResetCallback writes defaultValue ('green', captured at mount) back.
      await waitFor(() => expect(sel.value).toBe('green'));
      await waitFor(() => expect(inputOf(sel).value).toBe('Green'));
      await new Promise((r) => setTimeout(r, 200));
    });
  },
};

/* ── Custom CSS ─────────────────────────────────────────── */
/**
 * The select is themeable on three levels:
 *
 * 1. **Select-owned tokens** — `--md-select-caret-color`, `--md-select-caret-size`,
 *    `--md-select-clear-color`, `--md-select-trailing-gap`,
 *    `--md-select-option-icon-color`, `--md-select-width`, `--md-select-min-width`.
 * 2. **Passthrough tokens** — the composed field + menu honour their own
 *    `--md-text-field-*` / `--md-menu-*` / `--md-menu-item-*` tokens set on the host.
 * 3. **Parts** — `field`, `field-container`, `trailing`, `clear`, `caret`, `menu`,
 *    `option`, `option-selected`, `option-icon`.
 */
export const CustomCSS: Story = {
  render: (_args, { globals }) => html`
    <style>
      /* 1 + 2 — token-driven brand theme */
      .brand-select {
        --md-select-width: 280px;
        --md-select-caret-color: #e94560;
        --md-select-caret-size: 28px;
        --md-select-clear-color: #e94560;
        --md-select-option-icon-color: #e94560;
        --md-text-field-active-indicator-color: #e94560;
        --md-text-field-label-color: #c0143a;
      }

      /* 3 — ::part() styling: rounded outline + branded selected row */
      .part-select::part(field-container) {
        border-radius: 16px;
      }
      .part-select::part(caret) {
        color: var(--md-sys-color-on-surface-variant, #49454F);
      }
      .part-select::part(option-selected) {
        font-weight: 600;
      }
      .part-select::part(option-icon) {
        color: var(--md-sys-color-on-surface-variant, #49454F);
      }
    </style>

    <div style="display:flex; gap:32px; padding:24px; flex-wrap:wrap;">
      <div>
        <p style="${HEADING}">Design tokens</p>
        <md-select class="brand-select" variant="outlined" label="${t(globals.locale, 'select.colour')}" clearable value="green">
          <md-select-option value="red" icon="circle">${t(globals.locale, 'select.red')}</md-select-option>
          <md-select-option value="green" icon="circle">${t(globals.locale, 'select.green')}</md-select-option>
          <md-select-option value="blue" icon="circle">${t(globals.locale, 'select.blue')}</md-select-option>
        </md-select>
      </div>

      <div style="width:280px;">
        <p style="${HEADING}">::part() styling</p>
        <md-select class="part-select" variant="outlined" label="${t(globals.locale, 'select.colour')}" value="blue">
          <md-select-option value="red" icon="circle">${t(globals.locale, 'select.red')}</md-select-option>
          <md-select-option value="green" icon="circle">${t(globals.locale, 'select.green')}</md-select-option>
          <md-select-option value="blue" icon="circle">${t(globals.locale, 'select.blue')}</md-select-option>
        </md-select>
      </div>
    </div>
  `,
};

/* ── Programmatic API + trigger keyboard ────────────────── */

/** Exposes the public methods on the element for the play() interactions. */
type SelectApi = SelectEl & {
  show: () => Promise<void>;
  close: () => Promise<void>;
  focusTrigger: () => Promise<void>;
  reset: () => Promise<void>;
  setQuery: (query: string) => Promise<void>;
  getLabels: (values: string[]) => Promise<Record<string, string>>;
  loadOptions: (source: Array<{ value: string; label: string }>) => Promise<void>;
};

/**
 * Drives the public `@Method` API — `show()` / `close()` / `focusTrigger()` /
 * `reset()` — plus the Enter/Space open shortcuts and the "click the already
 * selected option" close path, asserting each observable outcome.
 */
export const ProgrammaticApi: Story = {
  name: 'Programmatic API',
  render: (_args, { globals }) => html`
    <div style="${BOX}">
      <md-select label="${t(globals.locale, 'select.colour')}" value="green">
        <md-select-option value="red">${t(globals.locale, 'select.red')}</md-select-option>
        <md-select-option value="green">${t(globals.locale, 'select.green')}</md-select-option>
        <md-select-option value="blue">${t(globals.locale, 'select.blue')}</md-select-option>
      </md-select>
    </div>
  `,
  play: async ({ canvasElement, step }) => {
    const sel = await getSelect(canvasElement);
    const api = sel as SelectApi;

    await step('show() opens the listbox and close() shuts it', async () => {
      expect(sel.open).toBe(false);
      await api.show();
      await waitFor(() => expect(sel.open).toBe(true));
      await waitFor(() => expect(optionsOf(sel).length).toBe(3));
      await api.close();
      await waitFor(() => expect(sel.open).toBe(false));
    });

    await step('focusTrigger() moves focus onto the trigger field', async () => {
      inputOf(sel).blur();
      await api.focusTrigger();
      // Focus lands on the inner input → md-text-field is sel.shadowRoot's activeElement.
      await waitFor(() => expect(sel.shadowRoot!.activeElement).toBe(fieldOf(sel)));
    });

    await step('Enter and Space open the closed listbox (keyboard)', async () => {
      const field = fieldOf(sel);
      field.focus();
      key(field, 'Enter');
      await waitFor(() => expect(sel.open).toBe(true));
      key(field, 'Escape');
      await waitFor(() => expect(sel.open).toBe(false));
      key(field, ' ');
      await waitFor(() => expect(sel.open).toBe(true));
      key(field, 'Escape');
      await waitFor(() => expect(sel.open).toBe(false));
    });

    await step('Re-clicking the selected option just closes — no mdChange', async () => {
      let changes = 0;
      sel.addEventListener('mdChange', () => { changes += 1; });
      await api.show();
      await waitFor(() => expect(sel.open).toBe(true));
      const green = optionsOf(sel).find((o) => o.headline === 'Green') as HTMLElement;
      await waitFor(() => expect(green.classList.contains('hydrated')).toBe(true));
      green.click();
      await waitFor(() => expect(sel.open).toBe(false));
      expect(sel.value).toBe('green'); // value is unchanged…
      expect(changes).toBe(0);         // …and re-picking the current value emits nothing
    });

    await step('reset() clears the value + emits mdChange(""), then no-ops when empty', async () => {
      let last: string | undefined;
      let emits = 0;
      sel.addEventListener('mdChange', (e) => { last = (e as CustomEvent<string>).detail; emits += 1; });
      expect(sel.value).toBe('green');
      await api.reset();
      await waitFor(() => expect(sel.value).toBe(''));
      await waitFor(() => expect(inputOf(sel).value).toBe(''));
      expect(last).toBe('');
      expect(emits).toBe(1);
      // Second reset with nothing selected returns early — no extra event fires.
      await api.reset();
      await new Promise((r) => setTimeout(r, 60));
      expect(emits).toBe(1);
      await new Promise((r) => setTimeout(r, 250));
    });
  },
};

/* ── Virtualized interactions (WASM filter + label API) ──── */

const virtualSmallRows = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Bravo' },
  { value: 'c', label: 'Charlie' },
  { value: 'd', label: 'Delta' },
];
