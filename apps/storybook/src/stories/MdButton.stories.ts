import type { Meta, StoryObj } from '@storybook/web-components';
import { expect, waitFor } from 'storybook/test';
import { html } from 'lit';
import { t } from '../i18n';

/** Shadow-piercing helpers for play(): testing-library queries can't cross
 *  shadow roots, so interactions address the real host + internals directly. */
type ButtonEl = HTMLElement & { loading: boolean; selected: boolean; href: string };
/** The cancelable `mdClick` detail payload (mirrors MdButtonClickDetail in core). */
type ClickDetail = {
  value: string;
  toggle: boolean;
  selected: boolean;
  href: string;
  target: string;
  originalEvent: MouseEvent | KeyboardEvent;
};
const getButton = async (
  canvasElement: HTMLElement,
  selector = 'md-button',
): Promise<ButtonEl> => {
  const btn = canvasElement.querySelector(selector) as ButtonEl;
  await waitFor(() => expect(btn.classList.contains('hydrated')).toBe(true));
  return btn;
};
const key = (target: Element, k: string) =>
  target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, composed: true }));

const meta: Meta = {
  title: 'Actions/Button',
  component: 'md-button',
  tags: ['autodocs'],
  parameters: {
    docs: {
      source: {
        type: 'code',
        language: 'html',
      },
    },
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['filled', 'outlined', 'text', 'elevated', 'tonal'],
    },
    size: {
      control: 'select',
      options: ['xs', 'sm', 'md', 'lg', 'xl'],
    },
    shape: {
      control: 'inline-radio',
      options: ['round', 'square'],
    },
    disabled: { control: 'boolean' },
    softDisabled: { control: 'boolean' },
    ripple: { control: 'boolean' },
    loading: { control: 'boolean' },
    toggle: { control: 'boolean' },
    selected: { control: 'boolean' },
    shapeMorph: { control: 'boolean' },
    mirrorIcon: { control: 'boolean' },
    fullWidth: { control: 'boolean' },
    icon: { control: 'text' },
    trailingIcon: { control: 'text' },
    href: { control: 'text' },
  },
  args: {
    variant: 'filled',
    size: 'sm',
    shape: 'round',
    disabled: false,
    softDisabled: false,
    ripple: true,
    loading: false,
    toggle: false,
    selected: false,
    shapeMorph: true,
    mirrorIcon: false,
    fullWidth: false,
    icon: '',
    trailingIcon: '',
    href: '',
  },
};

export default meta;
type Story = StoryObj;

const ROW = 'display:flex; gap:12px; flex-wrap:wrap; align-items:center;';
const SECTION = 'padding:24px; font-family: Roboto, sans-serif;';
const HEADING = 'color:#49454F; margin:20px 0 8px; font-size:13px; font-weight:500; text-transform:uppercase; letter-spacing:0.5px;';
const SUBTLE = 'color:#49454F; margin:0 0 12px; font-size:12.5px; line-height:1.55; max-width:62ch;';
const variants = ['filled', 'outlined', 'text', 'elevated', 'tonal'] as const;
const sizes = ['xs', 'sm', 'md', 'lg', 'xl'] as const;

/* ==========================================================
   PLAYGROUND
   ========================================================== */
/**
 * Localized labels via the demo i18n dictionary — flip the **Locale** toolbar
 * and the button text changes. The component is NOT locale-aware: the story
 * resolves each string with `t(locale, key)` and passes plain text in as a
 * slot, exactly how a consumer's i18n engine (react-intl, i18next, …) would.
 */
export const Localized: Story = {
  render: (_args, { globals }) => html`
    <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
      <md-button variant="filled" icon="save">${t(globals.locale, 'save')}</md-button>
      <md-button variant="outlined">${t(globals.locale, 'cancel')}</md-button>
      <md-button variant="text" icon="delete">${t(globals.locale, 'delete')}</md-button>
      <md-button variant="tonal" icon="search">${t(globals.locale, 'search')}</md-button>
    </div>
  `,
};

export const Playground: Story = {
  parameters: {
    docs: {
      source: {
        code: `<md-button
  variant="filled"
  size="sm"
  shape="round"
  icon="add"
  trailing-icon="arrow_forward"
>Button</md-button>`,
      },
    },
  },
  render: (args) => html`
    <md-button
      variant="${args.variant}"
      size="${args.size}"
      shape="${args.shape}"
      ?disabled="${args.disabled}"
      ?soft-disabled="${args.softDisabled}"
      ?ripple="${args.ripple}"
      ?loading="${args.loading}"
      ?toggle="${args.toggle}"
      ?selected="${args.selected}"
      ?shape-morph="${args.shapeMorph}"
      ?mirror-icon="${args.mirrorIcon}"
      ?full-width="${args.fullWidth}"
      icon="${args.icon}"
      trailing-icon="${args.trailingIcon}"
      href="${args.href}"
    >Button</md-button>
  `,
  /** Pointer click and keyboard (Enter/Space) both emit the cancelable mdClick. */
  play: async ({ canvasElement, step }) => {
    const btn = await getButton(canvasElement);

    await step('Pointer click emits mdClick with a live MouseEvent payload', async () => {
      let detail: ClickDetail | undefined;
      btn.addEventListener('mdClick', (e) => { detail = (e as CustomEvent<ClickDetail>).detail; }, { once: true });
      btn.click();
      await waitFor(() => expect(detail).toBeTruthy());
      // Payload is component-produced, not something the test set.
      expect(detail!.originalEvent instanceof MouseEvent).toBe(true);
      // detail.href mirrors the host's current href (empty in the default args).
      expect(detail!.href).toBe(btn.getAttribute('href') ?? '');
    });

    await step('Enter and Space activate too (keyboard/pointer parity)', async () => {
      let count = 0;
      btn.addEventListener('mdClick', () => { count += 1; });
      btn.focus();
      key(btn, 'Enter');
      await waitFor(() => expect(count).toBe(1)); // keydown mapped to a click
      key(btn, ' ');
      await waitFor(() => expect(count).toBe(2)); // Space fires an independent activation
    });

    await step('Pointer press drives the shape-morph pressed class', async () => {
      // shapeMorph defaults on, so pointerdown flips the host into its
      // pressed (squarer) shape and pointerup/leave releases it.
      btn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      await waitFor(() => expect(btn.classList.contains('md-button--pressed')).toBe(true));
      btn.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      await waitFor(() => expect(btn.classList.contains('md-button--pressed')).toBe(false));
    });

    await step('role-override replaces the default host role; clearing restores button', async () => {
      // Composite widgets (md-date-picker day cells) repurpose the host role.
      const b = btn as ButtonEl & { roleOverride: string };
      await waitFor(() => expect(btn.getAttribute('role')).toBe('button')); // default
      b.roleOverride = 'gridcell';
      await waitFor(() => expect(btn.getAttribute('role')).toBe('gridcell')); // prop drove the render
      b.roleOverride = '';
      await waitFor(() => expect(btn.getAttribute('role')).toBe('button')); // falls back again
    });

    await step('group roving-tabindex override drives the host tabindex', async () => {
      // md-button-group sets groupTabindex to -1/0 for roving focus; outside a
      // group it is null and the button uses its own tabindex.
      const b = btn as ButtonEl & { groupTabindex: number | null };
      await waitFor(() => expect(btn.getAttribute('tabindex')).toBe('0')); // normal default
      b.groupTabindex = -1;
      await waitFor(() => expect(btn.getAttribute('tabindex')).toBe('-1')); // group deactivated it
      b.groupTabindex = 0;
      await waitFor(() => expect(btn.getAttribute('tabindex')).toBe('0')); // group activated it
      b.groupTabindex = null;
      await waitFor(() => expect(btn.getAttribute('tabindex')).toBe('0')); // back to the normal path
    });
  },
};

/* ==========================================================
   ALL VARIANTS
   ========================================================== */
export const AllVariants: Story = {
  parameters: {
    docs: {
      source: { code: `<md-button variant="filled">filled</md-button>\n<md-button variant="outlined">outlined</md-button>\n<md-button variant="text">text</md-button>\n<md-button variant="elevated">elevated</md-button>\n<md-button variant="tonal">tonal</md-button>` },
    },
  },
  render: () => html`
    <div style="${SECTION}">
      <div style="${ROW}">
        ${variants.map(v => html`<md-button variant="${v}">${v}</md-button>`)}
      </div>
    </div>
  `,
};

/* ==========================================================
   STATES — Enabled · Hovered · Focused · Pressed · Disabled
   Shows every variant in every state side-by-side
   ========================================================== */
export const States: Story = {
  name: 'States (Enabled / Disabled / Soft-Disabled)',
  render: () => html`
    <div style="${SECTION}">
      <p style="${HEADING}">Enabled</p>
      <div style="${ROW}">
        ${variants.map(v => html`<md-button variant="${v}">${v}</md-button>`)}
      </div>

      <p style="${HEADING}">Disabled</p>
      <div style="${ROW}">
        ${variants.map(v => html`<md-button variant="${v}" disabled>${v}</md-button>`)}
      </div>

      <p style="${HEADING}">Soft-Disabled (focusable)</p>
      <div style="${ROW}">
        ${variants.map(v => html`<md-button variant="${v}" soft-disabled>${v}</md-button>`)}
      </div>

      <p style="${HEADING}">Loading</p>
      <div style="${ROW}">
        ${variants.map(v => html`<md-button variant="${v}" loading>${v}</md-button>`)}
      </div>

      <p style="color:#49454F; font-size:12px; margin-top:16px;">
        Hover, focus (Tab), and press states are interactive — try them above.
      </p>
    </div>
  `,
  /** Disabled vs soft-disabled: both inert to activation, but only soft-disabled stays focusable. */
  play: async ({ canvasElement, step }) => {
    const disabled = await getButton(canvasElement, 'md-button[disabled]');
    const soft = await getButton(canvasElement, 'md-button[soft-disabled]');

    await step('disabled: dropped from Tab order and swallows click + keyboard', async () => {
      await waitFor(() => expect(disabled.getAttribute('tabindex')).toBe('-1'));
      expect(disabled.getAttribute('aria-disabled')).toBe('true');

      let clicks = 0;
      disabled.addEventListener('mdClick', () => { clicks += 1; });
      disabled.click();          // pointer/click path guarded by isDisabled
      key(disabled, 'Enter');    // keydown path guarded by isDisabled
      await new Promise((r) => setTimeout(r, 50));
      expect(clicks).toBe(0);    // neither activation path emitted
    });

    await step('disabled: pointerdown never enters the pressed shape', async () => {
      disabled.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 50));
      expect(disabled.classList.contains('md-button--pressed')).toBe(false);
    });

    await step('soft-disabled: focusable (tabindex 0) yet still inert to clicks', async () => {
      await waitFor(() => expect(soft.getAttribute('tabindex')).toBe('0'));
      expect(soft.getAttribute('aria-disabled')).toBe('true');

      let clicks = 0;
      soft.addEventListener('mdClick', () => { clicks += 1; });
      soft.click();
      await new Promise((r) => setTimeout(r, 50));
      expect(clicks).toBe(0);
    });
  },
};

/* ==========================================================
   SIZES
   ========================================================== */
export const Sizes: Story = {
  render: () => html`
    <div style="${SECTION}">
      <p style="${HEADING}">All sizes — filled</p>
      <div style="${ROW}">
        ${sizes.map(s => html`<md-button variant="filled" size="${s}">${s.toUpperCase()}</md-button>`)}
      </div>

      <p style="${HEADING}">All sizes — outlined</p>
      <div style="${ROW}">
        ${sizes.map(s => html`<md-button variant="outlined" size="${s}">${s.toUpperCase()}</md-button>`)}
      </div>

      <p style="${HEADING}">All sizes — text</p>
      <div style="${ROW}">
        ${sizes.map(s => html`<md-button variant="text" size="${s}">${s.toUpperCase()}</md-button>`)}
      </div>
    </div>
  `,
};

/* ==========================================================
   SIZES WITH ICONS
   ========================================================== */
export const SizesWithIcons: Story = {
  render: () => html`
    <div style="${SECTION}">
      <p style="${HEADING}">Leading icon — tonal</p>
      <div style="${ROW}">
        ${sizes.map(s => html`<md-button variant="tonal" size="${s}" icon="add">Add</md-button>`)}
      </div>

      <p style="${HEADING}">Trailing icon — filled</p>
      <div style="${ROW}">
        ${sizes.map(s => html`<md-button variant="filled" size="${s}" trailing-icon="arrow_forward">Next</md-button>`)}
      </div>

      <p style="${HEADING}">Both icons — elevated</p>
      <div style="${ROW}">
        ${sizes.map(s => html`<md-button variant="elevated" size="${s}" icon="edit" trailing-icon="arrow_forward">Edit</md-button>`)}
      </div>
    </div>
  `,
};

/* ==========================================================
   SHAPES
   ========================================================== */
export const Shapes: Story = {
  render: () => html`
    <div style="${SECTION}">
      <p style="${HEADING}">Round (default) — filled</p>
      <div style="${ROW}">
        ${sizes.map(s => html`<md-button variant="filled" shape="round" size="${s}">${s.toUpperCase()}</md-button>`)}
      </div>

      <p style="${HEADING}">Square — filled</p>
      <div style="${ROW}">
        ${sizes.map(s => html`<md-button variant="filled" shape="square" size="${s}">${s.toUpperCase()}</md-button>`)}
      </div>

      <p style="${HEADING}">Round — outlined</p>
      <div style="${ROW}">
        ${sizes.map(s => html`<md-button variant="outlined" shape="round" size="${s}">${s.toUpperCase()}</md-button>`)}
      </div>

      <p style="${HEADING}">Square — outlined</p>
      <div style="${ROW}">
        ${sizes.map(s => html`<md-button variant="outlined" shape="square" size="${s}">${s.toUpperCase()}</md-button>`)}
      </div>
    </div>
  `,
};

/* ==========================================================
   ICONS
   ========================================================== */
export const WithIcons: Story = {
  parameters: {
    docs: {
      source: {
        code: `<!-- Leading icon -->
<md-button variant="filled" icon="add">Add Item</md-button>

<!-- Trailing icon -->
<md-button variant="filled" trailing-icon="arrow_forward">Continue</md-button>

<!-- Custom icon via slot -->
<md-button variant="filled">
  <svg slot="leading-icon" viewBox="0 0 24 24" width="18" height="18">...</svg>
  Starred
</md-button>`,
      },
    },
  },
  render: () => html`
    <div style="${SECTION}">
      <p style="${HEADING}">Leading icons</p>
      <div style="${ROW}">
        <md-button variant="filled" icon="add">Add Item</md-button>
        <md-button variant="outlined" icon="search">Search</md-button>
        <md-button variant="tonal" icon="download">Download</md-button>
        <md-button variant="elevated" icon="bookmark">Bookmark</md-button>
        <md-button variant="text" icon="link">Share</md-button>
      </div>

      <p style="${HEADING}">Trailing icons</p>
      <div style="${ROW}">
        <md-button variant="filled" trailing-icon="arrow_forward">Continue</md-button>
        <md-button variant="outlined" trailing-icon="open_in_new">Open</md-button>
        <md-button variant="tonal" trailing-icon="chevron_right">Next</md-button>
        <md-button variant="elevated" trailing-icon="send">Send</md-button>
        <md-button variant="text" trailing-icon="expand_more">Show more</md-button>
      </div>

      <p style="${HEADING}">Both leading + trailing</p>
      <div style="${ROW}">
        <md-button variant="filled" icon="edit" trailing-icon="arrow_forward">Edit</md-button>
        <md-button variant="tonal" icon="attach_file" trailing-icon="close">File.pdf</md-button>
        <md-button variant="outlined" icon="filter_list" trailing-icon="expand_more">Filter</md-button>
      </div>
    </div>
  `,
};

/* ==========================================================
   ALL VARIANTS × ALL SIZES (matrix)
   ========================================================== */
export const AllVariantsAllSizes: Story = {
  render: () => html`
    <div style="${SECTION}">
      ${variants.map(variant => html`
        <p style="${HEADING}">${variant}</p>
        <div style="${ROW}">
          ${sizes.map(s => html`<md-button variant="${variant}" size="${s}">${variant}</md-button>`)}
        </div>
      `)}
    </div>
  `,
};

/* ==========================================================
   DISABLED — per variant
   ========================================================== */
export const Disabled: Story = {
  render: () => html`
    <div style="${SECTION}">
      <p style="${HEADING}">Disabled buttons</p>
      <div style="${ROW}">
        ${variants.map(v => html`<md-button variant="${v}" disabled>${v}</md-button>`)}
      </div>

      <p style="${HEADING}">Disabled with icons</p>
      <div style="${ROW}">
        <md-button variant="filled" icon="add" disabled>Add</md-button>
        <md-button variant="outlined" icon="search" disabled>Search</md-button>
        <md-button variant="elevated" icon="bookmark" disabled>Save</md-button>
        <md-button variant="tonal" trailing-icon="send" disabled>Send</md-button>
        <md-button variant="text" icon="link" disabled>Share</md-button>
      </div>
    </div>
  `,
};

/* ==========================================================
   SOFT-DISABLED
   ========================================================== */
export const SoftDisabled: Story = {
  render: () => html`
    <div style="${SECTION}">
      <p style="color:#49454F; margin-bottom:12px; font-size:14px;">
        Soft-disabled buttons look disabled but remain keyboard-focusable
        (Tab to reach them). Use for contextually unavailable actions that
        the user should still discover.
      </p>
      <div role="toolbar" style="${ROW}">
        <md-button variant="filled">Copy</md-button>
        <md-button variant="filled">Cut</md-button>
        <md-button variant="filled" soft-disabled>Paste</md-button>
      </div>
      <div style="${ROW}; margin-top:12px;">
        ${variants.map(v => html`<md-button variant="${v}" soft-disabled>${v}</md-button>`)}
      </div>
    </div>
  `,
};

/* ==========================================================
   LOADING
   ========================================================== */
export const Loading: Story = {
  render: () => html`
    <div style="${SECTION}">
      <p style="${HEADING}">Loading at different sizes</p>
      <div style="${ROW}">
        ${sizes.map(s => html`<md-button variant="filled" size="${s}" loading>${s.toUpperCase()}</md-button>`)}
      </div>

      <p style="${HEADING}">Loading across variants</p>
      <div style="${ROW}">
        ${variants.map(v => html`<md-button variant="${v}" loading>${v}</md-button>`)}
      </div>

      <p style="${HEADING}">
        Slotted md-progress-indicator instead of the built-in spinner
      </p>
      <p style="${SUBTLE}">
        The <code>loading</code> prop renders an md-loading-indicator sized from
        the icon box (14px at sm). Slot a circular md-progress-indicator into
        <code>leading-icon</code> when you want the determinate/indeterminate
        API instead — note it clamps to M3's 24px circular minimum, so it reads
        larger than the built-in spinner and suits md and up. Keep
        <code>soft-disabled</code> on so the busy button still swallows clicks.
      </p>
      <div style="${ROW}">
        ${variants.map(
          v => html`
            <md-button variant="${v}" size="md" soft-disabled>
              <md-progress-indicator
                slot="leading-icon"
                variant="circular"
                indeterminate
                label="Saving"
              ></md-progress-indicator>
              ${v}
            </md-button>
          `,
        )}
      </div>

      <p style="${SUBTLE}">
        The same indicator in <code>trailing-icon</code>, for flows where the
        spinner reads as the outcome of the action rather than its subject —
        "Continue &rarr; (working)". Under <code>dir="rtl"</code> the slot
        swaps sides on its own; no <code>mirror-icon</code>, since a spinner is
        not a directional glyph.
      </p>
      <div style="${ROW}">
        ${variants.map(
          v => html`
            <md-button variant="${v}" size="md" soft-disabled>
              ${v}
              <md-progress-indicator
                slot="trailing-icon"
                variant="circular"
                indeterminate
                label="Saving"
              ></md-progress-indicator>
            </md-button>
          `,
        )}
      </div>
    </div>
  `,
  /** A loading button shows the spinner, reports busy, and swallows activation. */
  play: async ({ canvasElement, step }) => {
    const btn = await getButton(canvasElement); // first button renders with loading

    await step('Loading renders the spinner part and reports aria-disabled', async () => {
      expect(btn.shadowRoot!.querySelector('[part="loading"]')).toBeTruthy();
      // Reflected attribute lands on the render flush — assert inside waitFor.
      await waitFor(() => expect(btn.getAttribute('aria-disabled')).toBe('true'));
    });

    await step('Loading suppresses mdClick; clearing loading restores it', async () => {
      let count = 0;
      btn.addEventListener('mdClick', () => { count += 1; });
      btn.click();
      // Give any (erroneous) emission a chance to arrive, then prove none did.
      await new Promise((r) => setTimeout(r, 50));
      expect(count).toBe(0); // guard: the busy button never fired

      // Clear loading and confirm the SAME button now behaves normally.
      btn.loading = false;
      await waitFor(() => expect(btn.getAttribute('aria-disabled')).toBe('false'));
      await waitFor(() => expect(btn.shadowRoot!.querySelector('[part="loading"]')).toBeNull());
      btn.click();
      await waitFor(() => expect(count).toBe(1)); // now the activation lands
    });
  },
};

/* ==========================================================
   RIPPLE (enable/disable)
   ========================================================== */
export const Ripple: Story = {
  parameters: {
    docs: {
      source: {
        code: `<!-- With ripple (default) -->
<md-button variant="filled">Button</md-button>

<!-- Without ripple -->
<md-button variant="filled" ripple="false">No Ripple</md-button>`,
      },
    },
  },
  render: () => html`
    <div style="${SECTION}">
      <p style="color:#49454F; margin-bottom:12px; font-size:14px;">
        Ripple is enabled by default. Set <code>ripple="false"</code> to disable the press animation.
      </p>
      <p style="${HEADING}">With ripple (default)</p>
      <div style="${ROW}">
        ${variants.map(v => html`<md-button variant="${v}">${v}</md-button>`)}
      </div>

      <p style="${HEADING}">Without ripple</p>
      <div style="${ROW}">
        ${variants.map(v => html`<md-button variant="${v}" ripple="false">${v}</md-button>`)}
      </div>

      <p style="${HEADING}">Mixed — with and without</p>
      <div style="${ROW}">
        <md-button variant="filled" icon="add">Add (ripple)</md-button>
        <md-button variant="filled" icon="add" ripple="false">Add (no ripple)</md-button>
      </div>
    </div>
  `,
};

/* ==========================================================
   LINK BUTTON (href)
   ========================================================== */
export const LinkButton: Story = {
  render: () => html`
    <div style="${SECTION}">
      <p style="color:#49454F; margin-bottom:12px; font-size:14px;">
        Buttons with <code>href</code> open the URL on click.
      </p>
      <div style="${ROW}">
        <md-button variant="filled" href="https://m3.material.io" target="_blank" trailing-icon="open_in_new">
          Material Design 3
        </md-button>
        <md-button variant="outlined" href="https://github.com" target="_blank" trailing-icon="open_in_new">
          GitHub
        </md-button>
        <md-button variant="text" href="https://example.com" target="_blank" icon="link">
          Example
        </md-button>
      </div>
    </div>
  `,
  /** href buttons navigate via window.open; the click is cancelable (SPA veto). */
  play: async ({ canvasElement, step }) => {
    const link = await getButton(canvasElement, 'md-button[href]'); // first link button

    await step('Clicking navigates to the host href/target via window.open', async () => {
      const opened: Array<{ url: string; target: string }> = [];
      const orig = window.open;
      window.open = ((url?: string | URL, target?: string) => {
        opened.push({ url: String(url), target: String(target) });
        return null;
      }) as typeof window.open;

      let detail: ClickDetail | undefined;
      link.addEventListener('mdClick', (e) => { detail = (e as CustomEvent<ClickDetail>).detail; }, { once: true });
      link.click();
      await waitFor(() => expect(opened.length).toBe(1));
      window.open = orig;

      // The component forwarded the host's own href/target, not a test literal.
      expect(opened[0].url).toBe(link.getAttribute('href'));
      expect(opened[0].target).toBe(link.getAttribute('target'));
      expect(detail!.href).toBe(link.getAttribute('href'));
    });

    await step('preventDefault on mdClick vetoes the navigation (cancelable)', async () => {
      const opened: Array<unknown> = [];
      const orig = window.open;
      window.open = (() => { opened.push(1); return null; }) as typeof window.open;

      const veto = (e: Event) => e.preventDefault();
      link.addEventListener('mdClick', veto);
      link.click();
      await new Promise((r) => setTimeout(r, 50));
      link.removeEventListener('mdClick', veto);
      window.open = orig;

      expect(opened.length).toBe(0); // guard: vetoed click did not navigate
    });
  },
};

/* ==========================================================
   CUSTOM CSS (--md-button-* properties)
   ========================================================== */
export const CustomCSS: Story = {
  name: 'Custom CSS Properties',
  parameters: {
    docs: {
      source: {
        code: `/* Per-instance theming via CSS custom properties */
<md-button variant="filled" class="danger-btn" icon="delete">Delete</md-button>

<style>
.danger-btn {
  --md-button-container-color: var(--md-sys-color-error);
  --md-button-label-color: var(--md-sys-color-on-error);
}
</style>`,
      },
    },
  },
  render: () => html`
    <style>
      .danger-btn {
        --md-button-container-color: var(--md-sys-color-error, #B3261E);
        --md-button-label-color: var(--md-sys-color-on-error, #FFFFFF);
      }
      .brand-btn {
        --md-button-container-color: #1a73e8;
        --md-button-label-color: #ffffff;
        --md-button-container-shape: 8px;
      }
      .custom-outline {
        --md-button-outline-color: #1a73e8;
        --md-button-outline-width: 2px;
        --md-button-label-color: #1a73e8;
      }
      .large-icon-btn {
        --md-button-icon-size: 28px;
        --md-button-icon-color: gold;
      }
    </style>
    <div style="${SECTION}">
      <p style="${HEADING}">--md-button-container-color / --md-button-label-color</p>
      <div style="${ROW}">
        <md-button variant="filled" class="danger-btn" icon="delete">Delete</md-button>
        <md-button variant="filled" class="brand-btn">Brand Button</md-button>
      </div>

      <p style="${HEADING}">--md-button-outline-color / --md-button-outline-width</p>
      <div style="${ROW}">
        <md-button variant="outlined" class="custom-outline">Custom Outline</md-button>
      </div>

      <p style="${HEADING}">--md-button-icon-size / --md-button-icon-color</p>
      <div style="${ROW}">
        <md-button variant="filled" class="large-icon-btn" icon="star">Starred</md-button>
        <md-button variant="tonal" class="large-icon-btn" icon="favorite">Favorite</md-button>
      </div>

      <p style="${HEADING}">--md-button-container-shape</p>
      <div style="${ROW}">
        <md-button variant="filled" style="--md-button-container-shape: 0px">Sharp</md-button>
        <md-button variant="filled" style="--md-button-container-shape: 4px">Subtle</md-button>
        <md-button variant="filled">Default</md-button>
        <md-button variant="filled" style="--md-button-container-shape: 50%">Circle-ish</md-button>
      </div>
    </div>
  `,
};

/* ==========================================================
   CSS ::part() STYLING
   ========================================================== */
export const CSSParts: Story = {
  name: 'CSS ::part() Styling',
  render: () => html`
    <style>
      .part-demo .upper-btn::part(label) {
        text-transform: uppercase;
        letter-spacing: 1.5px;
      }
      .part-demo .italic-btn::part(label) {
        font-style: italic;
        font-weight: 300;
      }
      .part-demo .red-icon::part(icon) {
        color: #d32f2f;
      }
      .part-demo .spin-loading::part(loading) {
        border-color: gold;
        border-top-color: transparent;
        width: 24px;
        height: 24px;
      }
    </style>
    <div style="${SECTION}" class="part-demo">
      <p style="${HEADING}">::part(label) — uppercase + letter-spacing</p>
      <div style="${ROW}">
        <md-button variant="filled" class="upper-btn">Uppercase</md-button>
        <md-button variant="outlined" class="upper-btn">Outlined</md-button>
        <md-button variant="tonal" class="upper-btn">Tonal</md-button>
      </div>

      <p style="${HEADING}">::part(label) — italic + light weight</p>
      <div style="${ROW}">
        <md-button variant="filled" class="italic-btn">Italic Label</md-button>
        <md-button variant="elevated" class="italic-btn">Elevated</md-button>
      </div>

      <p style="${HEADING}">::part(icon) — red icon color</p>
      <div style="${ROW}">
        <md-button variant="filled" icon="favorite" class="red-icon">Favorite</md-button>
        <md-button variant="outlined" icon="delete" class="red-icon">Delete</md-button>
      </div>

      <p style="${HEADING}">::part(loading) — custom spinner</p>
      <div style="${ROW}">
        <md-button variant="filled" loading class="spin-loading">Saving</md-button>
        <md-button variant="tonal" loading class="spin-loading">Processing</md-button>
      </div>

      <p style="color:#49454F; font-size:12px; margin-top:16px;">
        Available parts: <code>state-layer</code>, <code>icon</code>,
        <code>trailing-icon</code>, <code>label</code>, <code>loading</code>
      </p>
    </div>
  `,
};

/* ==========================================================
   SLOTTED ICONS (custom iconography)
   ========================================================== */
export const SlottedIcons: Story = {
  name: 'Custom Icons (Named Slots)',
  parameters: {
    docs: {
      source: {
        code: `<!-- SVG icon via slot -->
<md-button variant="filled">
  <svg slot="leading-icon" viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77z"/>
  </svg>
  Starred
</md-button>`,
      },
    },
  },
  render: () => html`
    <div style="${SECTION}">
      <p style="${HEADING}">SVG icon via slot="leading-icon"</p>
      <div style="${ROW}">
        <md-button variant="filled">
          <svg slot="leading-icon" viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
          </svg>
          Starred
        </md-button>
        <md-button variant="outlined">
          <svg slot="leading-icon" viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
          </svg>
          Favorite
        </md-button>
        <md-button variant="tonal">
          <svg slot="leading-icon" viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
          </svg>
          Add Item
        </md-button>
      </div>

      <p style="${HEADING}">SVG trailing icon via slot="trailing-icon"</p>
      <div style="${ROW}">
        <md-button variant="filled">
          Continue
          <svg slot="trailing-icon" viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"/>
          </svg>
        </md-button>
      </div>

      <p style="${HEADING}">Emoji as slotted icon</p>
      <div style="${ROW}">
        <md-button variant="elevated">
          <span slot="leading-icon" style="font-size:18px">🚀</span>
          Launch
        </md-button>
        <md-button variant="tonal">
          <span slot="leading-icon" style="font-size:18px">🎉</span>
          Celebrate
        </md-button>
      </div>

      <p style="${HEADING}">Mixed: prop icon + slotted trailing</p>
      <div style="${ROW}">
        <md-button variant="filled" icon="edit">
          Edit
          <svg slot="trailing-icon" viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M7 10l5 5 5-5z"/>
          </svg>
        </md-button>
      </div>
    </div>
  `,
  /** slotchange listeners recompute the with-leading/with-trailing-icon layout classes. */
  play: async ({ canvasElement, step }) => {
    const btn = await getButton(canvasElement); // first: filled, SVG in slot="leading-icon"

    await step('re-assigning the leading-icon slot fires slotchange → with-leading-icon class', async () => {
      const lead = btn.querySelector('[slot="leading-icon"]') as HTMLElement;
      expect(lead).toBeTruthy();
      // Removing then re-adding the node re-fires slotchange, which flips the
      // has-slotted-leading-icon state and adds the host layout class.
      lead.remove();
      btn.appendChild(lead);
      await waitFor(() => expect(btn.classList.contains('md-button--with-leading-icon')).toBe(true));
    });

    await step('adding/removing a trailing slot toggles the with-trailing-icon class', async () => {
      const trail = document.createElement('span');
      trail.setAttribute('slot', 'trailing-icon');
      trail.textContent = '→';
      btn.appendChild(trail);
      await waitFor(() => expect(btn.classList.contains('md-button--with-trailing-icon')).toBe(true));
      trail.remove();
      await waitFor(() => expect(btn.classList.contains('md-button--with-trailing-icon')).toBe(false));
    });

    // Reset to the resting render so the visual baseline captures a fresh mount:
    // step 1 re-appended the leading icon to the end of the light DOM and step 2
    // added/removed a trailing span — restore the original slot order, drop any
    // lingering test-added trailing node, and clear focus, then let it settle.
    await step('reset: restore the fresh-mount visual state', async () => {
      const lead = btn.querySelector('[slot="leading-icon"]') as HTMLElement | null;
      if (lead) btn.insertBefore(lead, btn.firstChild);
      btn.querySelector('[slot="trailing-icon"]')?.remove();
      (document.activeElement as HTMLElement)?.blur();
      await waitFor(() => {
        expect(btn.classList.contains('md-button--with-leading-icon')).toBe(true);
        expect(btn.classList.contains('md-button--with-trailing-icon')).toBe(false);
      });
      await new Promise((r) => requestAnimationFrame(() => r(null)));
    });
  },
};

/* ==========================================================
   SHAPE MORPHING — Press & Toggle
   ========================================================== */
export const ShapeMorphing: Story = {
  name: 'Shape Morphing',
  render: () => html`
    <div style="${SECTION}">
      <p style="color:#49454F; margin-bottom:16px; font-size:14px;">
        Press and hold any button to see the shape morph to a more square form.
        Toggle buttons change resting shape when selected (round→square, square→round).
      </p>

      <p style="${HEADING}">Pressed — round (all sizes)</p>
      <div style="${ROW}">
        ${sizes.map(s => html`<md-button variant="filled" shape="round" size="${s}">${s.toUpperCase()}</md-button>`)}
      </div>

      <p style="${HEADING}">Pressed — square (all sizes)</p>
      <div style="${ROW}">
        ${sizes.map(s => html`<md-button variant="filled" shape="square" size="${s}">${s.toUpperCase()}</md-button>`)}
      </div>

      <p style="${HEADING}">Pressed — all variants (SM round)</p>
      <div style="${ROW}">
        ${variants.map(v => html`<md-button variant="${v}" shape="round">${v}</md-button>`)}
      </div>

      <p style="${HEADING}">Toggle — round (click to select, shape morphs round→square)</p>
      <div style="${ROW}">
        ${sizes.map(s => html`<md-button variant="tonal" shape="round" size="${s}" toggle>Toggle ${s.toUpperCase()}</md-button>`)}
      </div>

      <p style="${HEADING}">Toggle — square (click to select, shape morphs square→round)</p>
      <div style="${ROW}">
        ${sizes.map(s => html`<md-button variant="tonal" shape="square" size="${s}" toggle>Toggle ${s.toUpperCase()}</md-button>`)}
      </div>

      <p style="${HEADING}">Toggle — pre-selected round (starts selected = square)</p>
      <div style="${ROW}">
        ${variants.map(v => html`<md-button variant="${v}" shape="round" toggle selected>${v}</md-button>`)}
      </div>
    </div>
  `,
  /** Toggle mode flips selected + emits mdChange; preventDefault on mdClick vetoes the flip. */
  play: async ({ canvasElement, step }) => {
    const tog = await getButton(canvasElement, 'md-button[toggle]') as ButtonEl & { selected: boolean };

    await step('toggle click flips selected, emits mdChange, updates aria-pressed', async () => {
      await waitFor(() => expect(tog.getAttribute('aria-pressed')).toBe('false')); // starts unselected
      let change: { selected: boolean; value: string } | undefined;
      tog.addEventListener('mdChange', (e) => { change = (e as CustomEvent).detail; }, { once: true });

      tog.click();
      await waitFor(() => expect(tog.selected).toBe(true)); // component mutated the prop
      expect(change).toBeTruthy();
      expect(change!.selected).toBe(true);                 // mdChange payload mirrors the new state
      await waitFor(() => expect(tog.getAttribute('aria-pressed')).toBe('true'));
      expect(tog.classList.contains('md-button--selected')).toBe(true);
    });

    await step('preventDefault on mdClick vetoes the flip (no mdChange, state held)', async () => {
      let changes = 0;
      const onChange = () => { changes += 1; };
      const veto = (e: Event) => e.preventDefault();
      tog.addEventListener('mdChange', onChange);
      tog.addEventListener('mdClick', veto);
      tog.click();                    // would flip true→false, but the veto suppresses it
      await new Promise((r) => setTimeout(r, 50));
      tog.removeEventListener('mdChange', onChange);
      tog.removeEventListener('mdClick', veto);

      expect(changes).toBe(0);        // veto blocked the state change
      expect(tog.selected).toBe(true); // still selected from the prior step
      expect(tog.getAttribute('aria-pressed')).toBe('true');
    });
  },
};

/* ==========================================================
   DARK THEME
   ========================================================== */
export const DarkTheme: Story = {
  decorators: [
    (story) => html`
      <div data-theme="dark" style="background: var(--md-sys-color-surface, #1C1B1F); color: var(--md-sys-color-on-surface, #E6E1E5); padding: 32px; border-radius: 16px;">
        ${story()}
      </div>
    `,
  ],
  render: () => html`
    <div style="${SECTION}">
      <p style="${HEADING}; color:#CAC4D0;">Enabled</p>
      <div style="${ROW}">
        ${variants.map(v => html`<md-button variant="${v}">${v}</md-button>`)}
      </div>

      <p style="${HEADING}; color:#CAC4D0;">With icons</p>
      <div style="${ROW}">
        <md-button variant="filled" icon="add">Add</md-button>
        <md-button variant="tonal" icon="download">Download</md-button>
        <md-button variant="elevated" trailing-icon="send">Send</md-button>
        <md-button variant="outlined" icon="search">Search</md-button>
        <md-button variant="text" icon="link">Share</md-button>
      </div>

      <p style="${HEADING}; color:#CAC4D0;">Disabled</p>
      <div style="${ROW}">
        ${variants.map(v => html`<md-button variant="${v}" disabled>${v}</md-button>`)}
      </div>

      <p style="${HEADING}; color:#CAC4D0;">Sizes — filled</p>
      <div style="${ROW}">
        ${sizes.map(s => html`<md-button variant="filled" size="${s}">${s.toUpperCase()}</md-button>`)}
      </div>
    </div>
  `,
};

/* ==========================================================
   WIDTH AND HEIGHT — full-width, fixed sizes, custom min/max
   ========================================================== */
export const WidthAndHeight: Story = {
  name: 'Width and Height',
  parameters: {
    docs: {
      description: {
        story:
          'By default the button uses <code>display: inline-flex</code> ' +
          'and sizes to its content; each <code>size</code> sets a ' +
          'spec-compliant <code>min-block-size</code> (touch target). ' +
          'Three escape hatches let you override that:<br><br>' +
          '<strong>1. Full-width</strong> — the <code>full-width</code> ' +
          'attribute switches the host to <code>display: flex</code> ' +
          'and stretches inline-size to <code>100%</code> of the parent. ' +
          'Standard pattern for primary CTAs in forms, modals, and ' +
          'bottom sheets.<br><br>' +
          '<strong>2. Fixed dimensions</strong> — set the public CSS ' +
          'custom properties <code>--md-button-width</code>, ' +
          '<code>--md-button-height</code>, ' +
          '<code>--md-button-min-width</code>, ' +
          '<code>--md-button-max-width</code>, or ' +
          '<code>--md-button-min-height</code> for arbitrary inline / ' +
          'block sizing.<br><br>' +
          '<strong>3. Combine</strong> — <code>full-width</code> + ' +
          '<code>--md-button-max-width</code> caps a stretch button at ' +
          'a max width while keeping responsive shrink below.',
      },
    },
  },
  render: () => html`
    <style>
      .wh { padding: 24px; font-family: Roboto, sans-serif; max-width: 720px; }
      .wh section { margin-block-end: 32px; }
      .wh h3 { margin: 0 0 8px; font-size: 16px; color: #1d1b20; }
      .wh p { margin: 0 0 12px; color: #49454F; font-size: 13px; line-height: 1.6; }
      .wh code {
        background: #f7f2fa; padding: 1px 6px; border-radius: 4px; font-size: 12px;
      }
      .wh .container {
        background: repeating-linear-gradient(
          135deg,
          #fef7ff,
          #fef7ff 8px,
          #f7f2fa 8px,
          #f7f2fa 16px
        );
        border: 1px dashed #cac4d0;
        border-radius: 12px;
        padding: 16px;
      }
      .wh .container + .container { margin-block-start: 12px; }
      .wh .label {
        font-size: 11px;
        color: #6750a4;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        font-weight: 500;
        margin-block-end: 8px;
      }
      .wh .row { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }
      .wh .stack { display: flex; flex-direction: column; gap: 12px; }
    </style>

    <div class="wh">
      <section>
        <h3>1 · Default (inline, sizes to content)</h3>
        <p>
          Out of the box buttons size to their label plus padding,
          clamped by the per-size <code>min-inline-size</code> /
          <code>min-block-size</code>.
        </p>
        <div class="container">
          <div class="label">parent: 480px wide</div>
          <div class="row" style="max-width: 480px;">
            <md-button variant="filled">Save</md-button>
            <md-button variant="outlined">Cancel</md-button>
            <md-button variant="tonal" icon="add">Add to library</md-button>
          </div>
        </div>
      </section>

      <section>
        <h3>2 · <code>full-width</code> attribute</h3>
        <p>
          Stretches the button to fill the inline axis. The size's
          <code>min-block-size</code> (touch target) is preserved.
          Stack multiple full-width buttons vertically for the
          classic primary / secondary CTA layout.
        </p>
        <div class="container">
          <div class="label">parent: 100%</div>
          <div class="stack">
            <md-button variant="filled" full-width icon="check">
              Confirm and continue
            </md-button>
            <md-button variant="text" full-width>
              Not now
            </md-button>
          </div>
        </div>
        <div class="container">
          <div class="label">parent: 320px wide (e.g. modal footer)</div>
          <div class="stack" style="max-width: 320px;">
            <md-button variant="filled" full-width icon="login">Sign in</md-button>
            <md-button variant="outlined" full-width>Create account</md-button>
          </div>
        </div>
      </section>

      <section>
        <h3>3 · Fixed width via <code>--md-button-width</code></h3>
        <p>
          Pin a button to an exact inline-size when you want
          predictable column widths (e.g. a wizard's "Next" button).
        </p>
        <div class="container">
          <div class="row">
            <md-button variant="filled" style="--md-button-width: 160px;">
              160px
            </md-button>
            <md-button variant="tonal" style="--md-button-width: 240px;" icon="cloud_upload">
              240px
            </md-button>
            <md-button variant="outlined" style="--md-button-width: 320px;" trailing-icon="arrow_forward" mirror-icon>
              320px — Next step
            </md-button>
          </div>
        </div>
      </section>

      <section>
        <h3>4 · Custom <code>min-width</code> / <code>max-width</code></h3>
        <p>
          <code>--md-button-min-width</code> overrides the per-size
          minimum (useful for form-aligned button rows).
          <code>--md-button-max-width</code> caps how far a button can
          stretch — handy combined with <code>full-width</code> on
          large screens.
        </p>
        <div class="container">
          <div class="label">all set to <code>--md-button-min-width: 200px</code></div>
          <div class="row">
            <md-button variant="filled" style="--md-button-min-width: 200px;">OK</md-button>
            <md-button variant="outlined" style="--md-button-min-width: 200px;">Cancel</md-button>
            <md-button variant="text" style="--md-button-min-width: 200px;">Skip</md-button>
          </div>
        </div>
        <div class="container">
          <div class="label">
            <code>full-width</code> capped at <code>--md-button-max-width: 360px</code>
          </div>
          <md-button variant="filled" full-width style="--md-button-max-width: 360px;" icon="save">
            Save changes
          </md-button>
        </div>
      </section>

      <section>
        <h3>5 · Custom <code>height</code> / <code>min-height</code></h3>
        <p>
          Set <code>--md-button-height</code> for a fixed block-size
          (e.g. matching a search field).
          <code>--md-button-min-height</code> raises the touch target
          when the size's default is too small for touch-only
          surfaces.
        </p>
        <div class="container">
          <div class="row">
            <md-button variant="filled" size="sm" style="--md-button-height: 56px;">
              56px tall
            </md-button>
            <md-button variant="tonal" size="sm" style="--md-button-height: 72px; --md-button-width: 200px;" icon="touch_app">
              72×200
            </md-button>
            <md-button variant="outlined" size="xs" style="--md-button-min-height: 48px;">
              XS bumped to 48
            </md-button>
          </div>
        </div>
      </section>

      <section>
        <h3>6 · Stretch group — full-width inside flex</h3>
        <p>
          Drop <code>full-width</code> buttons in a flex container
          with <code>flex: 1</code> to make them split available
          space evenly. The size's touch target keeps them clickable.
        </p>
        <div class="container">
          <div style="display: flex; gap: 12px;">
            <md-button variant="outlined" full-width style="flex: 1;">Decline</md-button>
            <md-button variant="filled" full-width style="flex: 1;" icon="check">Accept</md-button>
          </div>
        </div>
      </section>
    </div>
  `,
};

/* ==========================================================
   ACCESSIBILITY — roles, ARIA, keyboard, focus
   ========================================================== */
export const Accessibility: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Each section demonstrates a WAI-ARIA pattern that md-button ' +
          'implements. Tab through the page and use Enter / Space to ' +
          'activate; screen readers will announce every state.',
      },
    },
  },
  render: () => html`
    <style>
      .a11y { padding: 24px; font-family: Roboto, sans-serif; }
      .a11y section { margin-bottom: 32px; }
      .a11y h4 { margin: 0 0 4px; font-size: 14px; font-weight: 600; }
      .a11y p { margin: 0 0 12px; color: #49454F; font-size: 13px; line-height: 1.5; }
      .a11y .row { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }
      .a11y code { background: #f7f2fa; padding: 1px 6px; border-radius: 4px; font-size: 12px; }
    </style>

    <div class="a11y">
      <section>
        <h4>1 · Default role and keyboard</h4>
        <p>
          Every button renders with <code>role="button"</code> and
          <code>tabindex="0"</code>, so it joins the natural tab order.
          <kbd>Enter</kbd> and <kbd>Space</kbd> both fire <code>mdClick</code>
          (the host's keydown handler maps these to <code>el.click()</code>).
        </p>
        <div class="row">
          <md-button variant="filled">Filled</md-button>
          <md-button variant="outlined">Outlined</md-button>
          <md-button variant="tonal">Tonal</md-button>
        </div>
      </section>

      <section>
        <h4>2 · Disabled vs. soft-disabled</h4>
        <p>
          <strong>disabled</strong> sets <code>aria-disabled="true"</code>
          and <code>tabindex="-1"</code> — the button is skipped by Tab.
          <strong>soft-disabled</strong> keeps <code>tabindex="0"</code>
          (focusable so users can still discover it) but blocks
          activation. Use soft-disabled for actions that are temporarily
          unavailable in context.
        </p>
        <div class="row">
          <md-button variant="filled" disabled>Disabled (skipped)</md-button>
          <md-button variant="filled" soft-disabled>Soft-disabled (focusable)</md-button>
        </div>
      </section>

      <section>
        <h4>3 · Toggle button — aria-pressed</h4>
        <p>
          Toggle buttons announce their state via
          <code>aria-pressed</code>. Screen-reader users hear "Bold,
          toggle button, pressed" when selected.
        </p>
        <div class="row">
          <md-button variant="tonal" toggle icon="format_bold">Bold</md-button>
          <md-button variant="tonal" toggle selected icon="format_italic">Italic</md-button>
          <md-button variant="tonal" toggle icon="format_underlined">Underline</md-button>
        </div>
      </section>

      <section>
        <h4>4 · Loading state</h4>
        <p>
          During <code>loading</code>, the button reports
          <code>aria-disabled="true"</code> so AT users hear the busy
          state and clicks are suppressed. Pair with an
          <code>aria-live</code> region elsewhere on the page if you
          want explicit "Saving…" announcements.
        </p>
        <div class="row">
          <md-button variant="filled" loading>Saving…</md-button>
          <md-button variant="tonal" loading icon="sync">Syncing</md-button>
        </div>
      </section>

      <section>
        <h4>5 · Focus ring (Tab from another control)</h4>
        <p>
          Focus is shown as a 3px secondary outline 2px outside the
          container — visible against any variant or background.
        </p>
        <div class="row">
          <input type="text" placeholder="Tab from here" />
          ${variants.map(v => html`<md-button variant="${v}">${v}</md-button>`)}
        </div>
      </section>
    </div>
  `,
};

/* ==========================================================
   LOCALIZATION — labels in 7 locales (incl. RTL)
   ========================================================== */
export const Localization: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Buttons are language-agnostic — the visible label is the ' +
          'consumer\'s slotted text, so plug in your i18n layer\'s ' +
          'translations directly. The component picks up <code>lang</code> ' +
          'and <code>dir</code> from any wrapping element, so wrapping a ' +
          'button (or a whole page) in <code>&lt;div lang="ar" ' +
          'dir="rtl"&gt;</code> is enough — layout flips automatically ' +
          'thanks to CSS logical properties, and Material Symbols icons ' +
          'render the same in every locale.',
      },
    },
  },
  render: () => {
    const rows = [
      { code: 'en', dir: 'ltr', label: 'English',  save: 'Save',     cancel: 'Cancel',   add: 'Add item',  next: 'Next' },
      { code: 'fr', dir: 'ltr', label: 'Français', save: 'Enregistrer', cancel: 'Annuler', add: 'Ajouter',  next: 'Suivant' },
      { code: 'de', dir: 'ltr', label: 'Deutsch',  save: 'Speichern', cancel: 'Abbrechen', add: 'Hinzufügen', next: 'Weiter' },
      { code: 'ja', dir: 'ltr', label: '日本語',     save: '保存',      cancel: 'キャンセル',  add: '追加',     next: '次へ' },
      { code: 'hi', dir: 'ltr', label: 'हिन्दी',      save: 'सहेजें',    cancel: 'रद्द करें',     add: 'जोड़ें',    next: 'अगला' },
      { code: 'ar', dir: 'rtl', label: 'العربية',   save: 'حفظ',       cancel: 'إلغاء',     add: 'إضافة',    next: 'التالي' },
      { code: 'he', dir: 'rtl', label: 'עברית',    save: 'שמור',      cancel: 'בטל',       add: 'הוסף',     next: 'הבא' },
    ];
    return html`
      <style>
        .l10n { padding: 24px; font-family: Roboto, sans-serif; }
        .l10n .grid { display: flex; flex-direction: column; }
        .l10n .row {
          /* dir lives directly on this flex container so the CSS
             direction property reliably cascades into every
             md-button shadow root underneath. */
          display: flex;
          align-items: center;
          gap: 24px;
          padding-block: 16px;
          border-block-end: 1px solid #e7e0ec;
        }
        .l10n .info {
          flex: 0 0 180px;
          display: flex;
          align-items: baseline;
          gap: 8px;
        }
        .l10n .code { color: #6750a4; font-weight: 600; font-family: 'JetBrains Mono', ui-monospace, monospace; }
        .l10n .name { color: var(--md-sys-color-on-surface-variant, #49454F); font-size: 14px; }
        .l10n .buttons {
          flex: 1 1 auto;
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          align-items: center;
        }
      </style>
      <div class="l10n">
        <p style="color:#49454F; margin:0 0 16px; font-size:14px;">
          The same <code>md-button</code> instances rendered with
          translated labels. Each row carries its own
          <code>lang</code> and <code>dir</code> on a real block-level
          element so the <code>direction</code> property cascades
          cleanly into the button's shadow DOM. In RTL rows the row
          itself reverses (locale info on the right) and so does each
          button's internal layout (icons on the inline-end side); the
          <code>arrow_forward</code> on the "Next" button additionally
          flips along the X axis thanks to <code>mirror-icon</code>.
        </p>
        <div class="grid">
          ${rows.map(r => html`
            <div class="row" lang="${r.code}" dir="${r.dir}">
              <div class="info">
                <span class="code">${r.code}</span>
                <span class="name">${r.label}</span>
              </div>
              <div class="buttons">
                <md-button variant="filled" icon="save">${r.save}</md-button>
                <md-button variant="outlined">${r.cancel}</md-button>
                <md-button variant="tonal" icon="add">${r.add}</md-button>
                <md-button variant="text" trailing-icon="arrow_forward" mirror-icon>${r.next}</md-button>
              </div>
            </div>
          `)}
        </div>
      </div>
    `;
  },
};

/* ==========================================================
   RTL — layout swap, mirror-icon, button-group connection
   ========================================================== */
export const RTL: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Layout uses CSS logical properties throughout, so leading / ' +
          'trailing icons swap visual sides automatically inside ' +
          '<code>dir="rtl"</code>. The <code>mirror-icon</code> ' +
          'attribute additionally flips the icon glyph along the X ' +
          'axis — set it on buttons that use directional Material ' +
          'Symbols (<code>arrow_forward</code>, ' +
          '<code>chevron_right</code>, <code>send</code>, ' +
          '<code>reply</code>…). Non-directional icons (' +
          '<code>add</code>, <code>search</code>, <code>favorite</code>) ' +
          'must leave it unset.',
      },
    },
  },
  render: () => html`
    <style>
      .rtl-demo { padding: 24px; font-family: Roboto, sans-serif; }
      .rtl-demo .pair {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
        margin-block-end: 24px;
      }
      .rtl-demo .pane {
        padding: 16px;
        border: 1px solid #e7e0ec;
        border-radius: 12px;
        background: #fef7ff;
      }
      .rtl-demo .pane h5 {
        margin: 0 0 12px;
        font-size: 12px;
        font-weight: 500;
        color: #6750a4;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .rtl-demo .row { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }
      .rtl-demo h3 { margin: 0 0 8px; font-size: 16px; }
      .rtl-demo p { margin: 0 0 16px; color: #49454F; font-size: 13px; }
      .rtl-demo code { background: #f7f2fa; padding: 1px 6px; border-radius: 4px; font-size: 12px; }
    </style>

    <div class="rtl-demo">
      <h3>1 · Layout swap (automatic)</h3>
      <p>
        Trailing icons sit on the <em>inline-end</em> side, so they
        appear on the visual right in LTR and on the visual left in
        RTL. The icon glyph itself is unchanged.
      </p>
      <div class="pair">
        <div class="pane" dir="ltr">
          <h5>dir="ltr"</h5>
          <div class="row">
            <md-button variant="filled" icon="add">Add item</md-button>
            <md-button variant="outlined" trailing-icon="open_in_new">Open</md-button>
            <md-button variant="tonal" icon="filter_list" trailing-icon="expand_more">Filter</md-button>
          </div>
        </div>
        <div class="pane" dir="rtl">
          <h5>dir="rtl"</h5>
          <div class="row">
            <md-button variant="filled" icon="add">إضافة</md-button>
            <md-button variant="outlined" trailing-icon="open_in_new">فتح</md-button>
            <md-button variant="tonal" icon="filter_list" trailing-icon="expand_more">تصفية</md-button>
          </div>
        </div>
      </div>

      <h3>2 · <code>mirror-icon</code> for directional glyphs</h3>
      <p>
        Without <code>mirror-icon</code>, an <code>arrow_forward</code>
        in RTL still points right — wrong direction for a
        right-to-left reader. Add <code>mirror-icon</code> and the
        glyph flips so it points <em>with</em> the reading flow.
      </p>
      <div class="pair">
        <div class="pane" dir="rtl">
          <h5>without mirror-icon (wrong)</h5>
          <div class="row">
            <md-button variant="filled" trailing-icon="arrow_forward">التالي</md-button>
            <md-button variant="text" icon="chevron_left">السابق</md-button>
            <md-button variant="tonal" trailing-icon="send">إرسال</md-button>
          </div>
        </div>
        <div class="pane" dir="rtl">
          <h5>with mirror-icon (correct)</h5>
          <div class="row">
            <md-button variant="filled" trailing-icon="arrow_forward" mirror-icon>التالي</md-button>
            <md-button variant="text" icon="chevron_left" mirror-icon>السابق</md-button>
            <md-button variant="tonal" trailing-icon="send" mirror-icon>إرسال</md-button>
          </div>
        </div>
      </div>

      <h3>3 · Non-directional icons stay put</h3>
      <p>
        Icons like <code>favorite</code>, <code>search</code>, or
        <code>add</code> are symmetric or
        rotationally-meaningful — leave <code>mirror-icon</code>
        <em>off</em> so the glyph stays semantically correct in both
        directions.
      </p>
      <div class="pair">
        <div class="pane" dir="ltr">
          <h5>dir="ltr"</h5>
          <div class="row">
            <md-button variant="filled" icon="favorite">Favorite</md-button>
            <md-button variant="outlined" icon="search">Search</md-button>
            <md-button variant="tonal" icon="add">Add</md-button>
          </div>
        </div>
        <div class="pane" dir="rtl">
          <h5>dir="rtl"</h5>
          <div class="row">
            <md-button variant="filled" icon="favorite">المفضلة</md-button>
            <md-button variant="outlined" icon="search">بحث</md-button>
            <md-button variant="tonal" icon="add">إضافة</md-button>
          </div>
        </div>
      </div>

      <h3>4 · Button toolbar in RTL</h3>
      <p>
        Soft-disabled and disabled states keep the same a11y semantics
        in any direction — and <code>aria-pressed</code> on toggle
        buttons stays correct.
      </p>
      <div class="pane" dir="rtl">
        <div role="toolbar" aria-label="شريط الأدوات" class="row">
          <md-button variant="tonal" toggle icon="format_bold">عريض</md-button>
          <md-button variant="tonal" toggle icon="format_italic">مائل</md-button>
          <md-button variant="tonal" toggle icon="format_underlined">تسطير</md-button>
          <md-button variant="text" soft-disabled icon="format_strikethrough">يتوسطه خط</md-button>
        </div>
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
          'Buttons themselves are not responsive — their inline-size is ' +
          'driven by content unless you override it with ' +
          '<code>--md-button-width</code>, <code>--md-button-min-width</code>, ' +
          '<code>--md-button-max-width</code>, or the <code>full-width</code> ' +
          'attribute. Three responsive recipes shown below: ' +
          '<strong>(1)</strong> action rows that stack vertically on phones ' +
          'and align horizontally on desktop, ' +
          '<strong>(2)</strong> <code>full-width</code> primary CTAs that ' +
          'fill their container on every breakpoint, ' +
          '<strong>(3)</strong> labels that hide below 360px via a ' +
          'container query, leaving only the icon for compact toolbars.',
      },
    },
  },
  render: () => html`
    <style>
      .btn-resp-shell { display: flex; flex-direction: column; gap: 32px; max-width: 1100px; }
      .btn-resp-section h3 { margin: 0 0 4px; }
      .btn-resp-section p { margin: 0 0 16px; font-size: 14px; opacity: 0.7; }
      .btn-resp-vp__label { font-size: 11px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase; color: var(--md-sys-color-on-surface-variant, #49454F); margin-block-end: 6px; }
      .btn-resp-vp {
        border: 1px dashed var(--md-sys-color-outline-variant, #cac4d0);
        border-radius: 12px;
        padding: 16px;
        background: var(--md-sys-color-surface-container-lowest, #fffbfe);
        box-sizing: border-box;
        container-type: inline-size;
        margin-block-end: 12px;
      }
      .btn-resp-live { resize: horizontal; overflow: auto; min-inline-size: 240px; max-inline-size: 100%; inline-size: 600px; }

      /* Recipe 1: action row that stacks below 480px */
      .btn-resp-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        justify-content: flex-end;
      }
      .btn-resp-actions md-button { flex: 0 0 auto; }
      @container (max-width: 480px) {
        .btn-resp-actions {
          flex-direction: column-reverse;
          align-items: stretch;
        }
        .btn-resp-actions md-button { inline-size: 100%; }
      }

      /* Recipe 3: hide labels under 480px via the exposed 'label'
         shadow part. Using ::part() drops both the label span AND the
         slotted text in one rule — far more reliable than wrapping
         each label in its own class and toggling 'display'. */
      @container (max-width: 480px) {
        .btn-resp-toolbar md-button::part(label) { display: none; }
        /* Tighten icon padding when there is no label — otherwise the
           icon sits off-center inside a button still sized for text. */
        .btn-resp-toolbar md-button { --md-button-min-width: 48px; }
      }
    </style>

    <div class="btn-resp-shell">
      <section class="btn-resp-section">
        <h3>1 · Action rows that stack on phones</h3>
        <p>
          Submit/cancel pairs align to the right on tablet+, then stack
          full-width with the primary action on top below 480px (the
          touch-target friendly mobile pattern).
        </p>
        ${[
          { label: 'XS · 320 px (stacked)', width: '320px' },
          { label: 'SM · 480 px (still stacked at boundary)', width: '480px' },
          { label: 'MD · 720 px (horizontal)', width: '720px' },
          { label: 'LG · 1024 px (horizontal)', width: '1024px' },
        ].map(
          (vp) => html`
            <div>
              <div class="btn-resp-vp__label">${vp.label}</div>
              <div class="btn-resp-vp" style="inline-size: ${vp.width}; max-inline-size: 100%;">
                <p style="margin: 0 0 12px; font-size: 14px;">
                  Save your changes before leaving this page.
                </p>
                <div class="btn-resp-actions">
                  <md-button variant="text">Cancel</md-button>
                  <md-button variant="tonal">Discard</md-button>
                  <md-button variant="filled">Save changes</md-button>
                </div>
              </div>
            </div>
          `,
        )}
      </section>

      <section class="btn-resp-section">
        <h3>2 · <code>full-width</code> primary CTA</h3>
        <p>
          Hero buttons inside narrow content columns. Pair with
          <code>--md-button-max-width</code> to keep the button readable
          on ultra-wide screens.
        </p>
        ${[
          { label: 'XS · 320 px', width: '320px' },
          { label: 'SM · 480 px', width: '480px' },
          { label: 'MD · 768 px', width: '768px' },
        ].map(
          (vp) => html`
            <div>
              <div class="btn-resp-vp__label">${vp.label}</div>
              <div class="btn-resp-vp" style="inline-size: ${vp.width}; max-inline-size: 100%;">
                <md-button variant="filled" full-width icon="rocket_launch">Get started</md-button>
                <md-button
                  variant="outlined"
                  full-width
                  icon="login"
                  style="margin-block-start: 8px; --md-button-max-width: 320px;"
                >Sign in</md-button>
              </div>
            </div>
          `,
        )}
      </section>

      <section class="btn-resp-section">
        <h3>3 · Hide labels under 480px (icon-only at narrow)</h3>
        <p>
          Same toolbar, container-query-driven. At ≥ 480px each button
          shows its icon <em>and</em> label; below 480px the label drops
          out via <code>::part(label) { display: none }</code> so only
          the icon remains. The accessible name is preserved through
          <code>aria-label</code> on each host so screen readers always
          hear "Create / Filter / Sort / Share".
        </p>
        ${[
          { label: 'XS · 360 px (icon-only)', width: '360px' },
          { label: 'SM · 480 px (labels appear at the breakpoint)', width: '480px' },
          { label: 'MD · 720 px (labels)', width: '720px' },
        ].map(
          (vp) => html`
            <div>
              <div class="btn-resp-vp__label">${vp.label}</div>
              <div class="btn-resp-vp btn-resp-toolbar" style="inline-size: ${vp.width}; max-inline-size: 100%;">
                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                  <md-button variant="tonal" icon="add"        aria-label="Create new">Create</md-button>
                  <md-button variant="tonal" icon="filter_alt" aria-label="Filter results">Filter</md-button>
                  <md-button variant="tonal" icon="sort"       aria-label="Sort results">Sort</md-button>
                  <md-button variant="tonal" icon="share"      aria-label="Share">Share</md-button>
                </div>
              </div>
            </div>
          `,
        )}
      </section>

      <section class="btn-resp-section">
        <h3>4 · Live resize playground</h3>
        <p>
          Drag the bottom-right corner of the frame. All three recipes are
          live in the same container.
        </p>
        <div class="btn-resp-vp btn-resp-live">
          <p style="margin: 0 0 8px; font-size: 12px; opacity: 0.6;">Stacking action row</p>
          <div class="btn-resp-actions">
            <md-button variant="text">Cancel</md-button>
            <md-button variant="tonal">Discard</md-button>
            <md-button variant="filled">Save changes</md-button>
          </div>

          <p style="margin: 16px 0 8px; font-size: 12px; opacity: 0.6;">Full-width CTA</p>
          <md-button variant="filled" full-width icon="rocket_launch">Get started</md-button>

          <p style="margin: 16px 0 8px; font-size: 12px; opacity: 0.6;">
            Hide-label-at-narrow toolbar — drag the frame below 480px to
            collapse the labels.
          </p>
          <div class="btn-resp-toolbar" style="display: flex; gap: 8px; flex-wrap: wrap;">
            <md-button variant="tonal" icon="add"        aria-label="Create new">Create</md-button>
            <md-button variant="tonal" icon="filter_alt" aria-label="Filter results">Filter</md-button>
            <md-button variant="tonal" icon="sort"       aria-label="Sort results">Sort</md-button>
            <md-button variant="tonal" icon="share"      aria-label="Share">Share</md-button>
          </div>
        </div>
      </section>
    </div>
  `,
};

/* ==========================================================
   FORM ASSOCIATION — type="submit" / type="reset"
   ========================================================== */
export const FormAssociation: Story = {
  name: 'Form Association (submit / reset)',
  parameters: {
    docs: {
      description: {
        story:
          '`type="submit"` and `type="reset"` mirror the native ' +
          '`<button type>`. Because the button renders its control in a ' +
          'shadow root, it uses `ElementInternals` to reach the ' +
          'light-DOM `<form>` across the shadow boundary — `submit` calls ' +
          '`form.requestSubmit()` (so the form\'s submit event fires and ' +
          'constraint validation runs) and `reset` calls `form.reset()`.',
      },
    },
  },
  render: () => html`
    <form id="fa-form" style="${SECTION}">
      <p style="${HEADING}">Associated form (submit + reset reach it across the shadow boundary)</p>
      <div style="${ROW}">
        <input id="fa-input" type="text" placeholder="Type something" />
      </div>
      <div style="${ROW}; margin-top:12px;">
        <md-button variant="filled" type="submit" icon="check">Submit</md-button>
        <md-button variant="outlined" type="reset">Reset</md-button>
        <md-button variant="text">Plain (no form action)</md-button>
      </div>
    </form>
  `,
  /** submit/reset buttons drive the associated form via ElementInternals. */
  play: async ({ canvasElement, step }) => {
    const submitBtn = await getButton(canvasElement, 'md-button[type="submit"]');
    const resetBtn = await getButton(canvasElement, 'md-button[type="reset"]');
    const form = canvasElement.querySelector('#fa-form') as HTMLFormElement;
    const input = canvasElement.querySelector('#fa-input') as HTMLInputElement;

    await step('type reflects onto the host attribute', async () => {
      await waitFor(() => expect(submitBtn.getAttribute('type')).toBe('submit'));
      await waitFor(() => expect(resetBtn.getAttribute('type')).toBe('reset'));
    });

    await step('type="submit" requestSubmit()s the associated form', async () => {
      let submitted = 0;
      // preventDefault keeps the test-runner iframe from actually navigating.
      const onSubmit = (e: Event) => { e.preventDefault(); submitted += 1; };
      form.addEventListener('submit', onSubmit);
      submitBtn.click();
      await waitFor(() => expect(submitted).toBe(1)); // component reached form.requestSubmit()
      form.removeEventListener('submit', onSubmit);
    });

    await step('type="reset" reset()s the form, clearing dirty field values', async () => {
      input.value = 'draft text'; // dirty the field (its default value is empty)
      let didReset = 0;
      const onReset = () => { didReset += 1; };
      form.addEventListener('reset', onReset);
      resetBtn.click();
      await waitFor(() => expect(input.value).toBe('')); // component reached form.reset()
      await waitFor(() => expect(didReset).toBe(1));      // and the reset event fired
      form.removeEventListener('reset', onReset);
    });
  },
};
