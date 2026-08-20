import type { Meta, StoryObj } from '@storybook/web-components';
import { expect, waitFor } from 'storybook/test';
import { html } from 'lit';
import { t } from '../i18n';

/** Shadow-piercing helpers for play(): testing-library queries can't cross
 *  shadow roots, so interactions address the real internals directly. */
type SplitBtnEl = HTMLElement & { trailingChecked: boolean };
const getSplit = async (canvasElement: HTMLElement): Promise<SplitBtnEl> => {
  const sb = canvasElement.querySelector('md-split-button') as SplitBtnEl;
  await waitFor(() => expect(sb.classList.contains('hydrated')).toBe(true));
  return sb;
};
const leadingOf = (sb: SplitBtnEl) =>
  sb.shadowRoot!.querySelector('[part="leading"]') as HTMLButtonElement;
const trailingOf = (sb: SplitBtnEl) =>
  sb.shadowRoot!.querySelector('[part="trailing"]') as HTMLButtonElement;

const meta: Meta = {
  title: 'Actions/Split Button',
  component: 'md-split-button',
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
      options: ['elevated', 'filled', 'tonal', 'outlined'],
    },
    size: {
      control: 'select',
      options: ['xs', 'sm', 'md', 'lg', 'xl'],
    },
    disabled: { control: 'boolean' },
    trailingChecked: { control: 'boolean' },
    fullWidth: {
      control: 'boolean',
      description: 'Stretch to fill the container; the leading label truncates with an ellipsis when tight.',
    },
    menuLabel: {
      control: 'text',
      description: 'Accessible label for the trailing menu-toggle button (localize per locale).',
    },
    haspopup: {
      control: 'select',
      options: ['menu', 'listbox', 'dialog', 'grid', 'tree', 'true', 'false'],
      description: 'aria-haspopup value for the trailing button. "false" removes it.',
    },
  },
  args: {
    variant: 'filled',
    size: 'sm',
    disabled: false,
    trailingChecked: false,
    fullWidth: false,
    menuLabel: 'Toggle menu',
    haspopup: 'menu',
  },
};

export default meta;
type Story = StoryObj;

const ROW = 'display:flex; gap:16px; flex-wrap:wrap; align-items:center;';
const SECTION = 'padding:24px; font-family: Roboto, sans-serif;';
const HEADING = 'color:#49454F; margin:20px 0 8px; font-size:13px; font-weight:500; text-transform:uppercase; letter-spacing:0.5px;';

/* ==========================================================
   PLAYGROUND
   ========================================================== */
export const Playground: Story = {
  render: (args) => html`
    <md-split-button
      variant="${args.variant}"
      size="${args.size}"
      ?disabled="${args.disabled}"
      ?trailing-checked="${args.trailingChecked}"
      ?full-width="${args.fullWidth}"
      menu-label="${args.menuLabel}"
      haspopup="${args.haspopup}"
      icon="edit"
      label="Label"
      @mdLeadingClick="${() => console.log('mdLeadingClick')}"
      @mdTrailingClick="${(e: CustomEvent) => console.log('mdTrailingClick', e.detail)}"
    ></md-split-button>
  `,
  /** The two segments fire independent events; the trailing segment is a toggle
   *  that advertises its open state via aria-expanded. (No menu is wired in the
   *  Playground — the trailing "open" state is aria-expanded; the real md-menu
   *  with items lives in the Menu Pattern story.) */
  play: async ({ canvasElement, step }) => {
    const sb = await getSplit(canvasElement);

    await step('The primary (leading) segment emits mdLeadingClick — and only that', async () => {
      let leading = 0;
      let trailing = 0;
      sb.addEventListener('mdLeadingClick', () => (leading += 1));
      sb.addEventListener('mdTrailingClick', () => (trailing += 1));
      leadingOf(sb).click();
      await waitFor(() => expect(leading).toBe(1));
      // The primary action must not masquerade as the menu toggle.
      expect(trailing).toBe(0);
    });

    await step('The trailing toggle opens (aria-expanded false → true) + emits its payload', async () => {
      expect(trailingOf(sb).getAttribute('aria-expanded')).toBe('false'); // closed to start
      let detail: { checked: boolean } | undefined;
      sb.addEventListener('mdTrailingClick', (e) => (detail = (e as CustomEvent).detail), { once: true });
      trailingOf(sb).click();
      // Reflected aria-expanded lands on the NEXT render flush — assert in waitFor.
      await waitFor(() => expect(trailingOf(sb).getAttribute('aria-expanded')).toBe('true'));
      expect(sb.trailingChecked).toBe(true);
      // The payload proves the component fired the event, not just mutated itself.
      expect(detail?.checked).toBe(true);
    });

    await step('Toggling the trailing segment again closes it (aria-expanded → false)', async () => {
      let detail: { checked: boolean } | undefined;
      sb.addEventListener('mdTrailingClick', (e) => (detail = (e as CustomEvent).detail), { once: true });
      trailingOf(sb).click();
      await waitFor(() => expect(trailingOf(sb).getAttribute('aria-expanded')).toBe('false'));
      expect(sb.trailingChecked).toBe(false);
      expect(detail?.checked).toBe(false);
    });

    await step('Keyboard: Enter and Space on the leading segment both fire mdLeadingClick', async () => {
      let count = 0;
      sb.addEventListener('mdLeadingClick', () => (count += 1));
      const lead = leadingOf(sb);
      lead.focus();
      // The keydown handler activates on Enter…
      lead.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
      await waitFor(() => expect(count).toBe(1));
      // …and on Space.
      lead.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
      await waitFor(() => expect(count).toBe(2));
      // A non-activation key is ignored — the handler must not emit.
      lead.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true }));
      await new Promise((r) => setTimeout(r, 50));
      expect(count).toBe(2);
    });

    await step('Keyboard: Enter opens the trailing toggle, Space closes it (aria-expanded tracks it)', async () => {
      expect(sb.trailingChecked).toBe(false); // closed after the click steps above
      let last: { checked: boolean } | undefined;
      sb.addEventListener('mdTrailingClick', (e) => (last = (e as CustomEvent).detail));
      const trail = trailingOf(sb);
      trail.focus();
      trail.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
      await waitFor(() => expect(sb.trailingChecked).toBe(true));
      expect(last?.checked).toBe(true);
      await waitFor(() => expect(trailingOf(sb).getAttribute('aria-expanded')).toBe('true'));
      trail.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
      await waitFor(() => expect(sb.trailingChecked).toBe(false));
      expect(last?.checked).toBe(false);
      await waitFor(() => expect(trailingOf(sb).getAttribute('aria-expanded')).toBe('false'));
    });

    await step('Keyboard: a non-activation key on the trailing toggle is ignored (no toggle, no event)', async () => {
      expect(sb.trailingChecked).toBe(false); // closed after the prior step
      let fired = 0;
      const onTrail = () => (fired += 1);
      sb.addEventListener('mdTrailingClick', onTrail);
      const trail = trailingOf(sb);
      trail.focus();
      // Escape is neither Enter nor Space — the trailing keydown guard must fall through untouched.
      trail.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      await new Promise((r) => setTimeout(r, 50));
      expect(fired).toBe(0);
      expect(sb.trailingChecked).toBe(false);
      expect(trailingOf(sb).getAttribute('aria-expanded')).toBe('false');
      sb.removeEventListener('mdTrailingClick', onTrail);
    });

    // State-neutral reset: the keyboard steps above left focus (and a focus ring)
    // on the trailing segment. Restore the fresh-render resting state — nothing
    // checked/open and nothing focused — so the visual snapshot matches args
    // (trailingChecked=false, no focus ring).
    await step('Reset: clear toggle + focus so the resting snapshot matches a fresh render', async () => {
      sb.trailingChecked = false; // initial args value
      trailingOf(sb).blur();
      leadingOf(sb).blur();
      (sb.shadowRoot?.activeElement as HTMLElement | null)?.blur();
      (document.activeElement as HTMLElement)?.blur();
      await waitFor(() => expect(sb.trailingChecked).toBe(false));
      await waitFor(() => expect(trailingOf(sb).getAttribute('aria-expanded')).toBe('false'));
      // Let the reset render (focus-ring removal) settle before the screenshot.
      await new Promise((r) => requestAnimationFrame(() => r(null)));
    });
  },
};

/* ==========================================================
   CONFIGURATIONS — matches M3 spec reference layout
   Two-column: color configurations (left), size configurations (right)
   ========================================================== */
export const Configurations: Story = {
  name: 'Configurations (M3 Reference)',
  render: () => html`
    <div style="display:flex; gap:64px; padding:40px; font-family:Roboto, sans-serif; align-items:flex-start;">
      <!-- Column 1: Color configurations -->
      <div style="display:flex; flex-direction:column; gap:12px; align-items:center;">
        <p style="font-size:12px; color:#49454F; margin:0 0 8px;">1</p>
        <md-split-button variant="elevated" icon="edit" label="Label"></md-split-button>
        <md-split-button variant="filled" icon="edit" label="Label"></md-split-button>
        <md-split-button variant="tonal" icon="edit" label="Label"></md-split-button>
        <md-split-button variant="outlined" icon="edit" label="Label"></md-split-button>
      </div>

      <!-- Column 2: Size configurations -->
      <div style="display:flex; flex-direction:column; gap:12px; align-items:center;">
        <p style="font-size:12px; color:#49454F; margin:0 0 8px;">2</p>
        <md-split-button variant="tonal" size="xs" icon="edit" label="Label"></md-split-button>
        <md-split-button variant="tonal" size="sm" icon="edit" label="Label"></md-split-button>
        <md-split-button variant="tonal" size="md" icon="edit" label="Label"></md-split-button>
        <md-split-button variant="tonal" size="lg" icon="edit" label="Label"></md-split-button>
        <md-split-button variant="tonal" size="xl" icon="edit" label="Label"></md-split-button>
      </div>
    </div>

    <div style="padding:0 40px 24px; font-family:Roboto, sans-serif;">
      <p style="font-size:12px; color:#49454F; margin:4px 0;">
        <strong>1</strong> Color configurations: Elevated, filled, tonal, outlined
      </p>
      <p style="font-size:12px; color:#49454F; margin:4px 0;">
        <strong>2</strong> Size configurations: XS, S, M, L, XL
      </p>
    </div>
  `,
};

/* ==========================================================
   VARIANTS
   ========================================================== */
export const Variants: Story = {
  render: () => html`
    <div style="${SECTION}">
      <p style="${HEADING}">Elevated</p>
      <div style="${ROW}">
        <md-split-button variant="elevated" icon="edit" label="Label"></md-split-button>
        <md-split-button variant="elevated" label="Label"></md-split-button>
      </div>

      <p style="${HEADING}">Filled (default)</p>
      <div style="${ROW}">
        <md-split-button variant="filled" icon="edit" label="Label"></md-split-button>
        <md-split-button variant="filled" label="Label"></md-split-button>
      </div>

      <p style="${HEADING}">Tonal</p>
      <div style="${ROW}">
        <md-split-button variant="tonal" icon="edit" label="Label"></md-split-button>
        <md-split-button variant="tonal" label="Label"></md-split-button>
      </div>

      <p style="${HEADING}">Outlined</p>
      <div style="${ROW}">
        <md-split-button variant="outlined" icon="edit" label="Label"></md-split-button>
        <md-split-button variant="outlined" label="Label"></md-split-button>
      </div>

      <p style="color:#49454F; font-size:12px; margin-top:16px;">
        Each variant shown with icon + label and label only.
      </p>
    </div>
  `,
};

/* ==========================================================
   SIZES
   ========================================================== */
export const Sizes: Story = {
  render: () => html`
    <div style="${SECTION}">
      <p style="${HEADING}">Extra Small (32dp)</p>
      <md-split-button variant="tonal" size="xs" icon="edit" label="Label"></md-split-button>

      <p style="${HEADING}">Small (40dp) — default</p>
      <md-split-button variant="tonal" size="sm" icon="edit" label="Label"></md-split-button>

      <p style="${HEADING}">Medium (56dp)</p>
      <md-split-button variant="tonal" size="md" icon="edit" label="Label"></md-split-button>

      <p style="${HEADING}">Large (96dp)</p>
      <md-split-button variant="tonal" size="lg" icon="edit" label="Label"></md-split-button>

      <p style="${HEADING}">Extra Large (136dp)</p>
      <md-split-button variant="tonal" size="xl" icon="edit" label="Label"></md-split-button>

      <p style="color:#49454F; font-size:12px; margin-top:16px;">
        Each size step increases height, icon size, padding, and typography.
      </p>
    </div>
  `,
};

/* ==========================================================
   INNER CORNER SIZING — M3 spec reference
   ========================================================== */
export const InnerCornerSizing: Story = {
  name: 'Inner Corner Sizing (M3 Spec)',
  render: () => {
    const sizes = [
      { size: 'xs', label: 'Extra small', innerRadius: '4dp', height: '32dp' },
      { size: 'sm', label: 'Small',       innerRadius: '4dp', height: '40dp' },
      { size: 'md', label: 'Medium',      innerRadius: '8dp', height: '56dp' },
      { size: 'lg', label: 'Large',       innerRadius: '12dp', height: '96dp' },
      { size: 'xl', label: 'Extra large', innerRadius: '16dp', height: '136dp' },
    ];
    const NOTE = 'font-size:11px; color:#49454F; font-family:Roboto Mono,monospace; text-align:center;';
    const BADGE = 'display:inline-flex; align-items:center; justify-content:center; width:20px; height:20px; border-radius:50%; background:#49454F; color:#fff; font-size:11px; font-weight:500;';

    return html`
      <div style="padding:40px; font-family:Roboto, sans-serif;">
        <p style="color:#49454F; font-size:13px; font-weight:400; margin:0 0 8px; max-width:500px;">
          The inner corner radius changes depending on button sizing.
          The space should always be 2dp.
        </p>

        <div style="display:flex; gap:32px; align-items:flex-end; padding:32px 0 16px; flex-wrap:wrap;">
          ${sizes.map(
            (s, i) => html`
              <div style="display:flex; flex-direction:column; align-items:center; gap:6px;">
                <span style="${NOTE}">2</span>
                <md-split-button variant="tonal" size="${s.size}" icon="edit" label="Label"></md-split-button>
                <span style="${NOTE}">${s.innerRadius}</span>
                <span style="${BADGE}">${i + 1}</span>
              </div>
            `,
          )}
        </div>

        <div style="display:flex; flex-direction:column; gap:4px; padding-top:12px;">
          ${sizes.map(
            (s, i) => html`
              <p style="font-size:12px; color:#49454F; margin:0;">
                <span style="${BADGE}; display:inline-flex; width:18px; height:18px; font-size:10px;">${i + 1}</span>
                &nbsp;${s.label} ${s.innerRadius}
              </p>
            `,
          )}
        </div>
      </div>
    `;
  },
};

/* ==========================================================
   TRAILING ICON OPTICAL CENTERING — M3 spec reference
   ========================================================== */
export const OpticalCentering: Story = {
  name: 'Trailing Icon Optical Centering',
  render: () => {
    const sizes = [
      { size: 'xs', height: '32dp', left: '12', right: '14', center: '13' },
      { size: 'sm', height: '40dp', left: '12', right: '14', center: '13' },
      { size: 'md', height: '56dp', left: '13', right: '17', center: '15' },
      { size: 'lg', height: '96dp', left: '26', right: '32', center: '29' },
      { size: 'xl', height: '136dp', left: '37', right: '49', center: '43' },
    ];
    const NOTE = 'font-size:11px; color:#49454F; font-family:Roboto Mono,monospace; text-align:center;';
    const COL_LABEL = 'font-size:12px; color:#49454F; font-weight:500; margin:0 0 12px; text-align:center;';

    return html`
      <div style="padding:40px; font-family:Roboto, sans-serif;">
        <p style="color:#49454F; font-size:14px; font-weight:500; margin:0 0 4px;">
          Trailing button icon — Centering behaviour
        </p>
        <p style="color:#49454F; font-size:12px; margin:0 0 32px; max-width:560px;">
          <strong>Caret down</strong> (closed) uses asymmetric padding for optical centering.
          <strong>Caret up</strong> (checked) switches to symmetric padding for true center alignment.
        </p>

        <div style="display:flex; gap:64px; align-items:flex-start;">
          <!-- Caret down — optical centering -->
          <div>
            <p style="${COL_LABEL}">Caret down — optical</p>
            <div style="display:flex; flex-direction:column; gap:20px;">
              ${sizes.map(
                (s) => html`
                  <div style="display:flex; align-items:center; gap:12px;">
                    <span style="${NOTE}; width:44px; text-align:right;">${s.height}</span>
                    <md-split-button variant="tonal" size="${s.size}" icon="edit" label="Label"></md-split-button>
                    <span style="${NOTE}">L:${s.left} R:${s.right}</span>
                  </div>
                `,
              )}
            </div>
          </div>

          <!-- Caret up — center aligned -->
          <div>
            <p style="${COL_LABEL}">Caret up — centered</p>
            <div style="display:flex; flex-direction:column; gap:20px;">
              ${sizes.map(
                (s) => html`
                  <div style="display:flex; align-items:center; gap:12px;">
                    <span style="${NOTE}; width:44px; text-align:right;">${s.height}</span>
                    <md-split-button variant="tonal" size="${s.size}" icon="edit" label="Label" trailing-checked></md-split-button>
                    <span style="${NOTE}">${s.center}dp</span>
                  </div>
                `,
              )}
            </div>
          </div>
        </div>

        <div style="margin-top:32px; padding:16px; background:#F7F2FA; border-radius:12px; max-width:480px;">
          <p style="color:#49454F; font-size:12px; margin:0 0 8px; font-weight:500;">
            Trailing button padding per state
          </p>
          <table style="border-collapse:collapse; font-size:12px; color:#49454F; width:100%;">
            <tr style="border-bottom:1px solid #E7E0EC;">
              <th style="text-align:left; padding:4px 8px; font-weight:500;">Size</th>
              <th style="text-align:right; padding:4px 8px; font-weight:500;">Down L</th>
              <th style="text-align:right; padding:4px 8px; font-weight:500;">Down R</th>
              <th style="text-align:right; padding:4px 8px; font-weight:500;">Offset</th>
              <th style="text-align:right; padding:4px 8px; font-weight:500;">Up (sym)</th>
            </tr>
            ${sizes.map(
              (s) => html`
                <tr style="border-bottom:1px solid #E7E0EC;">
                  <td style="padding:4px 8px;">${s.size.toUpperCase()} (${s.height})</td>
                  <td style="text-align:right; padding:4px 8px;">${s.left}dp</td>
                  <td style="text-align:right; padding:4px 8px;">${s.right}dp</td>
                  <td style="text-align:right; padding:4px 8px;">${Number(s.right) - Number(s.left)}dp</td>
                  <td style="text-align:right; padding:4px 8px;">${s.center}dp</td>
                </tr>
              `,
            )}
          </table>
        </div>
      </div>
    `;
  },
};

/* ==========================================================
   WITH ICONS
   ========================================================== */
export const WithIcons: Story = {
  render: () => html`
    <div style="${SECTION}">
      <p style="${HEADING}">Icon + Label</p>
      <div style="${ROW}">
        <md-split-button icon="edit" label="Label"></md-split-button>
        <md-split-button icon="send" label="Label" variant="tonal"></md-split-button>
        <md-split-button icon="share" label="Label" variant="outlined"></md-split-button>
      </div>

      <p style="${HEADING}">Label only</p>
      <div style="${ROW}">
        <md-split-button label="Label"></md-split-button>
        <md-split-button label="Label" variant="tonal"></md-split-button>
        <md-split-button label="Label" variant="outlined"></md-split-button>
      </div>

      <p style="${HEADING}">Icon only (with aria-label)</p>
      <div style="${ROW}">
        <md-split-button icon="edit" aria-label="Edit"></md-split-button>
        <md-split-button icon="send" aria-label="Send" variant="tonal"></md-split-button>
        <md-split-button icon="share" aria-label="Share" variant="outlined"></md-split-button>
      </div>
    </div>
  `,
};

/* ==========================================================
   STATES
   ========================================================== */
export const States: Story = {
  name: 'States (Enabled / Disabled / Soft-Disabled)',
  render: () => html`
    <div style="${SECTION}">
      <p style="${HEADING}">Enabled</p>
      <div style="${ROW}">
        <md-split-button icon="edit" label="Label"></md-split-button>
        <md-split-button icon="edit" label="Label" variant="outlined"></md-split-button>
      </div>

      <p style="${HEADING}">Disabled</p>
      <div style="${ROW}">
        <md-split-button icon="edit" label="Label" disabled></md-split-button>
        <md-split-button icon="edit" label="Label" variant="outlined" disabled></md-split-button>
      </div>

      <p style="${HEADING}">Soft-Disabled</p>
      <div style="${ROW}">
        <md-split-button icon="edit" label="Label" soft-disabled></md-split-button>
        <md-split-button icon="edit" label="Label" variant="outlined" soft-disabled></md-split-button>
      </div>

      <p style="color:#49454F; font-size:12px; margin-top:16px;">
        <strong>Disabled</strong> removes both buttons from the tab order.
        <strong>Soft-disabled</strong> keeps them focusable for screen readers.
      </p>
    </div>
  `,
  /** The disabled variants: hard-disabled drops out of the tab order entirely,
   *  while soft-disabled stays focusable for AT but swallows every activation
   *  (pointer and keyboard) via the component's disabled guards. */
  play: async ({ canvasElement, step }) => {
    const hard = canvasElement.querySelector('md-split-button[disabled]') as SplitBtnEl;
    const soft = canvasElement.querySelector('md-split-button[soft-disabled]') as SplitBtnEl;
    await waitFor(() => expect(hard.classList.contains('hydrated')).toBe(true));
    await waitFor(() => expect(soft.classList.contains('hydrated')).toBe(true));

    await step('Hard-disabled: both segments leave the tab order (tabindex -1) and expose aria-disabled', async () => {
      expect(leadingOf(hard).getAttribute('tabindex')).toBe('-1');
      expect(trailingOf(hard).getAttribute('tabindex')).toBe('-1');
      expect(leadingOf(hard).getAttribute('aria-disabled')).toBe('true');
      expect(trailingOf(hard).getAttribute('aria-disabled')).toBe('true');
    });

    await step('Soft-disabled: stays focusable (tabindex 0) yet the leading click is swallowed', async () => {
      const lead = leadingOf(soft);
      expect(lead.getAttribute('tabindex')).toBe('0');        // still reachable for AT
      expect(lead.getAttribute('aria-disabled')).toBe('true'); // but announced as disabled
      let fired = false;
      soft.addEventListener('mdLeadingClick', () => (fired = true));
      lead.click();
      await new Promise((r) => setTimeout(r, 50));
      expect(fired).toBe(false); // the disabled guard preventDefault-and-returns
    });

    await step('Soft-disabled: the trailing click is swallowed too — it never toggles open', async () => {
      let fired = false;
      soft.addEventListener('mdTrailingClick', () => (fired = true));
      expect(soft.trailingChecked).toBe(false);
      trailingOf(soft).click();
      await new Promise((r) => setTimeout(r, 50));
      expect(fired).toBe(false);
      expect(soft.trailingChecked).toBe(false);
      expect(trailingOf(soft).getAttribute('aria-expanded')).toBe('false');
    });

    await step('Soft-disabled: keyboard activation (Enter/Space) on both segments is swallowed', async () => {
      let leadFired = false;
      let trailFired = false;
      soft.addEventListener('mdLeadingClick', () => (leadFired = true));
      soft.addEventListener('mdTrailingClick', () => (trailFired = true));
      leadingOf(soft).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
      trailingOf(soft).dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
      await new Promise((r) => setTimeout(r, 50));
      expect(leadFired).toBe(false);
      expect(trailFired).toBe(false);
      expect(soft.trailingChecked).toBe(false); // the keydown guard blocked the toggle
    });
  },
};

/* ==========================================================
   TRAILING TOGGLE
   ========================================================== */
export const TrailingToggle: Story = {
  name: 'Trailing Button Toggle',
  render: () => html`
    <div style="${SECTION}">
      <p style="${HEADING}">Unchecked (default)</p>
      <md-split-button icon="edit" label="Label"></md-split-button>

      <p style="${HEADING}">Checked (trailing-checked)</p>
      <md-split-button icon="edit" label="Label" trailing-checked></md-split-button>

      <p style="color:#49454F; font-size:12px; margin-top:16px;">
        Click the trailing button to toggle. The arrow icon rotates 180° when checked.
        Inner corners of the trailing button become fully rounded when selected.
      </p>
    </div>
  `,
};

/* ==========================================================
   ALL VARIANTS × SIZES
   ========================================================== */
export const AllCombinations: Story = {
  name: 'All Variants × Sizes',
  render: () => html`
    <div style="${SECTION}">
      ${['elevated', 'filled', 'tonal', 'outlined'].map(
        (variant) => html`
          <p style="${HEADING}">${variant}</p>
          <div style="${ROW}">
            ${['xs', 'sm', 'md', 'lg', 'xl'].map(
              (size) => html`
                <md-split-button
                  variant="${variant}"
                  size="${size}"
                  icon="edit"
                  label="Label"
                ></md-split-button>
              `,
            )}
          </div>
        `,
      )}
    </div>
  `,
};

/* ==========================================================
   CUSTOM CSS
   ========================================================== */
export const CustomCSS: Story = {
  name: 'Custom CSS Properties',
  render: (_args, { globals }) => html`
    <style>
      .custom-split md-split-button {
        --md-split-button-container-color: var(--md-sys-color-tertiary-container, #FFD8E4);
        --md-split-button-label-color: var(--md-sys-color-on-tertiary-container, #31111D);
      }
    </style>
    <div style="${SECTION}">
      <p style="${HEADING}">Custom colors (tertiary variant)</p>
      <div class="custom-split">
        <md-split-button icon="favorite" label="${t(globals.locale, 'splitButton.like')}"></md-split-button>
      </div>
    </div>
  `,
};

/* ==========================================================
   DARK THEME
   ========================================================== */
export const DarkTheme: Story = {
  decorators: [
    (story) => {
      return html`
        <div data-theme="dark" style="background: var(--md-sys-color-surface, #1C1B1F); color: var(--md-sys-color-on-surface, #E6E1E5); padding: 32px; border-radius: 16px;">
          ${story()}
        </div>
      `;
    },
  ],
  render: () => html`
    <div style="${SECTION}">
      <p style="${HEADING}; color:#CAC4D0;">Elevated</p>
      <md-split-button icon="edit" label="Label" variant="elevated"></md-split-button>

      <p style="${HEADING}; color:#CAC4D0;">Filled</p>
      <md-split-button icon="edit" label="Label"></md-split-button>

      <p style="${HEADING}; color:#CAC4D0;">Tonal</p>
      <md-split-button icon="edit" label="Label" variant="tonal"></md-split-button>

      <p style="${HEADING}; color:#CAC4D0;">Outlined</p>
      <md-split-button icon="edit" label="Label" variant="outlined"></md-split-button>

      <p style="${HEADING}; color:#CAC4D0;">Disabled</p>
      <md-split-button icon="edit" label="Label" disabled></md-split-button>
    </div>
  `,
};

/* ==========================================================
   MENU PATTERN (Accessibility) — the WAI-ARIA menu-button wiring
   The trailing toggle advertises a popup (aria-haspopup="menu"), points at the
   menu it controls (aria-controls), and exposes open/closed state
   (aria-expanded, kept in sync via trailing-checked). Open/close the menu from
   the mdTrailingClick event. This is the contract assistive tech relies on.
   ========================================================== */
export const MenuPattern: Story = {
  name: 'Menu Pattern (a11y)',
  render: (_args, { globals }) => html`
    <div style="${SECTION}">
      <p style="${HEADING}">Trailing button opens a real md-menu — fully wired for screen readers</p>

      <md-split-button
        id="sb-create"
        icon="add"
        label="${t(globals.locale, 'splitButton.create')}"
        variant="tonal"
        menu-label="More create options"
        haspopup="menu"
        controls="sb-create-menu"
        @mdLeadingClick="${() => console.log('Primary action: Create')}"
        @mdTrailingClick="${(e: CustomEvent) => {
          const menu = document.getElementById('sb-create-menu') as any;
          e.detail.checked ? menu.show() : menu.close();
        }}"
      ></md-split-button>

      <!-- The same menu component used everywhere else, anchored to the split button.
           When it closes (item pick / outside click / Esc) we clear trailing-checked so
           the arrow rotates back and aria-expanded returns to false. -->
      <md-menu
        id="sb-create-menu"
        anchor="sb-create"
        placement="bottom-end"
        @mdClose="${() => {
          const sb = document.getElementById('sb-create') as any;
          sb.trailingChecked = false;
        }}"
      >
        <md-menu-item headline="${t(globals.locale, 'splitButton.newDocument')}">
          <span slot="leading-icon" class="material-symbols-outlined">description</span>
        </md-menu-item>
        <md-menu-item headline="${t(globals.locale, 'splitButton.newFolder')}">
          <span slot="leading-icon" class="material-symbols-outlined">create_new_folder</span>
        </md-menu-item>
        <md-menu-item headline="${t(globals.locale, 'splitButton.fromTemplate')}">
          <span slot="leading-icon" class="material-symbols-outlined">dashboard_customize</span>
        </md-menu-item>
      </md-menu>

      <p style="color:#49454F; font-size:12px; margin-top:16px; max-width:540px;">
        <code>haspopup</code> → <code>aria-haspopup</code> (announces "opens a menu") ·
        <code>controls</code> → <code>aria-controls</code> (links trigger to the <code>md-menu</code>) ·
        <code>trailing-checked</code> drives <code>aria-expanded</code> and is reset on
        <code>md-menu</code>'s <code>mdClose</code>. Set <code>menu-label</code> to localize the
        trailing button's name.
      </p>
    </div>
  `,
};

/* ==========================================================
   FULL WIDTH / RESPONSIVE — stretches to fill, label truncates
   ========================================================== */
export const FullWidth: Story = {
  name: 'Full Width (Responsive)',
  render: (_args, { globals }) => html`
    <div style="${SECTION}">
      <p style="${HEADING}">full-width fills its container — the trailing toggle keeps its width</p>
      <div style="max-width:420px; display:flex; flex-direction:column; gap:16px;">
        <md-split-button full-width icon="cloud_upload" label="${t(globals.locale, 'splitButton.upload')}" variant="filled"></md-split-button>
        <md-split-button full-width icon="save" label="${t(globals.locale, 'splitButton.saveChanges')}" variant="tonal"></md-split-button>

        <p style="${HEADING}">Long label truncates with an ellipsis instead of overflowing</p>
        <!-- resize: horizontal + overflow gives the drag handle on the right edge;
             the full-width split button tracks the box and the label re-truncates live. -->
        <div
          style="
            resize: horizontal;
            overflow: auto;
            inline-size: 240px;
            min-inline-size: 160px;
            max-inline-size: 100%;
            padding: 8px;
            border: 1px dashed var(--md-sys-color-outline, #79747E);
            border-radius: 12px;
          "
        >
          <md-split-button
            full-width
            icon="description"
            label="${t(globals.locale, 'splitButton.saveAndContinue')}"
            variant="outlined"
          ></md-split-button>
        </div>
      </div>

      <p style="color:#49454F; font-size:12px; margin-top:16px;">
        <strong>Drag the right edge of the dashed box</strong> to resize it — the leading segment
        grows/shrinks and the label re-truncates, while the arrow toggle stays a fixed icon target.
      </p>
    </div>
  `,
};

/* ==========================================================
   LOCALIZATION & RTL — localized labels + mirrored layout
   ========================================================== */
export const Localization: Story = {
  name: 'Localization & RTL',
  render: () => html`
    <div style="${SECTION}">
      <p style="${HEADING}">Localized leading + trailing (menu-label) names</p>
      <div style="${ROW}">
        <md-split-button icon="edit" label="Edit" menu-label="Toggle menu" variant="tonal"></md-split-button>
        <md-split-button icon="edit" label="Bearbeiten" menu-label="Menü umschalten" variant="tonal"></md-split-button>
        <md-split-button icon="edit" label="編集" menu-label="メニューの切り替え" variant="tonal"></md-split-button>
      </div>

      <p style="${HEADING}">RTL (Arabic) — corners & icon order mirror via logical properties</p>
      <div dir="rtl" style="${ROW}">
        <md-split-button icon="edit" label="تعديل" menu-label="تبديل القائمة" variant="filled"></md-split-button>
        <md-split-button icon="add" label="إنشاء" menu-label="خيارات الإنشاء" variant="outlined"></md-split-button>
        <md-split-button icon="edit" label="تعديل" menu-label="تبديل القائمة" variant="elevated"></md-split-button>
      </div>

      <p style="color:#49454F; font-size:12px; margin-top:16px;">
        The outer pill always lands on the free (inline-start) edge and the split corner on the
        inline-end edge in both directions — the layout uses logical corner-radius + padding.
      </p>
    </div>
  `,
};

/* ==========================================================
   TRAILING ARIA CONFIG — haspopup / controls wiring on the trailing button
   ========================================================== */
export const TrailingAriaConfig: Story = {
  name: 'Trailing ARIA (haspopup / controls)',
  render: () => html`
    <div style="${SECTION}">
      <p style="${HEADING}">The trailing button advertises the popup it controls</p>
      <div style="${ROW}">
        <md-split-button
          id="sb-listbox"
          icon="sort"
          label="Sort"
          variant="tonal"
          haspopup="listbox"
          controls="sb-listbox-menu"
          menu-label="Sort options"
        ></md-split-button>
        <md-split-button
          id="sb-nopopup"
          icon="favorite"
          label="Like"
          variant="outlined"
          haspopup="false"
          menu-label="Toggle like"
        ></md-split-button>
      </div>
      <!-- Real (hidden) target so aria-controls resolves to an existing IDREF. -->
      <div id="sb-listbox-menu" hidden></div>
    </div>
  `,
  /** haspopup maps to aria-haspopup for any value except "false" (which removes
   *  it), and controls maps to aria-controls to link the trigger to its popup. */
  play: async ({ canvasElement, step }) => {
    const listboxSb = canvasElement.querySelector('#sb-listbox') as SplitBtnEl;
    const noPopupSb = canvasElement.querySelector('#sb-nopopup') as SplitBtnEl;
    await waitFor(() => expect(listboxSb.classList.contains('hydrated')).toBe(true));
    await waitFor(() => expect(noPopupSb.classList.contains('hydrated')).toBe(true));

    await step('haspopup="listbox" → the trailing button announces aria-haspopup="listbox" and links aria-controls', async () => {
      const trail = trailingOf(listboxSb);
      expect(trail.getAttribute('aria-haspopup')).toBe('listbox');
      expect(trail.getAttribute('aria-controls')).toBe('sb-listbox-menu');
      // The accessible name still comes from menu-label, independent of the popup type.
      expect(trail.getAttribute('aria-label')).toBe('Sort options');
    });

    await step('haspopup="false" → aria-haspopup is dropped and no dangling aria-controls, yet it still toggles', async () => {
      const trail = trailingOf(noPopupSb);
      expect(trail.hasAttribute('aria-haspopup')).toBe(false); // the "false" branch removes the attribute
      expect(trail.hasAttribute('aria-controls')).toBe(false); // no controls prop → no attribute
      // Still a real toggle: clicking flips aria-expanded and emits its payload even without a popup.
      let detail: { checked: boolean } | undefined;
      noPopupSb.addEventListener('mdTrailingClick', (e) => (detail = (e as CustomEvent).detail), { once: true });
      trail.click();
      await waitFor(() => expect(trailingOf(noPopupSb).getAttribute('aria-expanded')).toBe('true'));
      expect(detail?.checked).toBe(true);
    });
  },
};

/* ==========================================================
   ACCESSIBLE NAME — the leading button must be named (WCAG 1.1.1)
   ========================================================== */
export const AccessibleName: Story = {
  name: 'Accessible Name (leading button)',
  render: () => html`
    <div style="${SECTION}">
      <p style="${HEADING}">Icon-only leading buttons take their name from the host aria-label</p>
      <div style="${ROW}">
        <md-split-button id="sb-named" icon="edit" aria-label="Edit item" variant="tonal"></md-split-button>
      </div>
    </div>
  `,
  /** With no label prop the component forwards the host aria-label onto the
   *  leading button; with neither label nor aria-label it mirrors no name and
   *  (in dev builds) warns on load via the componentDidLoad accessibility guard. */
  play: async ({ canvasElement, step }) => {
    const named = canvasElement.querySelector('#sb-named') as SplitBtnEl;
    await waitFor(() => expect(named.classList.contains('hydrated')).toBe(true));

    await step('label omitted → the host aria-label is mirrored onto the leading button (no visible label span)', async () => {
      const lead = leadingOf(named);
      // !this.label is true, so the component reads the host aria-label and forwards it.
      expect(lead.getAttribute('aria-label')).toBe('Edit item');
      // No text label was provided, so no label span is rendered.
      expect(named.shadowRoot!.querySelector('.md-split-button__label')).toBeNull();
    });

    await step('neither label nor aria-label → no name is mirrored (and dev builds warn on load)', async () => {
      const warnCalls: unknown[][] = [];
      const originalWarn = console.warn;
      console.warn = (...args: unknown[]) => { warnCalls.push(args); };
      const nameless = document.createElement('md-split-button') as SplitBtnEl;
      nameless.setAttribute('icon', 'edit'); // icon only — no label, no aria-label
      canvasElement.appendChild(nameless);
      try {
        await waitFor(() => expect(nameless.classList.contains('hydrated')).toBe(true));
        // Render branch: getAttribute('aria-label') is null, so the leading button carries no name.
        const lead = leadingOf(nameless);
        expect(lead.hasAttribute('aria-label')).toBe(false);
        // The load-time accessibility guard warns — but only when Stencil dev mode is on.
        const devMode =
          (window as unknown as { __STENCIL_DEV_MODE__?: boolean }).__STENCIL_DEV_MODE__ !== false;
        if (devMode) {
          await waitFor(() =>
            expect(warnCalls.some((a) => String(a[0]).includes('WCAG 1.1.1'))).toBe(true),
          );
        }
      } finally {
        console.warn = originalWarn;
        nameless.remove(); // clear the nameless node before the a11y sweep runs
      }
    });
  },
};
