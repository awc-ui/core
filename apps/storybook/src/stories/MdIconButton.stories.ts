import type { Meta, StoryObj } from '@storybook/web-components';
import { expect, waitFor } from 'storybook/test';
import { html } from 'lit';
import { t } from '../i18n';

/** Shadow-piercing / hydration helpers for play(): testing-library queries can't
 *  cross shadow roots, and Stencil reflection (aria-pressed, host classes) only
 *  lands post-hydration. Await `.hydrated`, then read the real host + shadow. */
type IconButtonEl = HTMLElement & { selected: boolean; toggle: boolean };
const hydrate = async (btn: HTMLElement): Promise<IconButtonEl> => {
  await waitFor(() => expect(btn.classList.contains('hydrated')).toBe(true));
  return btn as IconButtonEl;
};
const selectedLayerOn = (btn: IconButtonEl) =>
  btn.shadowRoot!
    .querySelector('[part="selected-icon"]')
    ?.classList.contains('md-icon-button__icon--on') ?? false;

const meta: Meta = {
  title: 'Actions/Icon Button',
  component: 'md-icon-button',
  tags: ['autodocs'],
  parameters: {
    docs: {
      source: { type: 'code', language: 'html' },
    },
  },
  argTypes: {
    variant: { control: 'select', options: ['standard', 'filled', 'outlined', 'tonal'] },
    size: { control: 'select', options: ['xs', 'sm', 'md', 'lg', 'xl'] },
    shape: { control: 'select', options: ['round', 'square'] },
    buttonWidth: { control: 'select', options: ['narrow', 'default', 'wide'] },
    disabled: { control: 'boolean' },
    softDisabled: { control: 'boolean' },
    selected: { control: 'boolean' },
    toggle: { control: 'boolean' },
    shapeMorph: { control: 'boolean' },
    ripple: { control: 'boolean' },
    icon: { control: 'text' },
    selectedIcon: { control: 'text' },
  },
  args: {
    variant: 'standard',
    size: 'sm',
    shape: 'round',
    buttonWidth: 'default',
    disabled: false,
    softDisabled: false,
    selected: false,
    toggle: false,
    shapeMorph: true,
    ripple: true,
    icon: 'favorite',
    selectedIcon: '',
  },
};
export default meta;
type Story = StoryObj;

const SECTION = 'padding:24px; font-family: Roboto, sans-serif;';
const HEADING = 'color:#49454F; margin:20px 0 8px; font-size:13px; font-weight:500; text-transform:uppercase; letter-spacing:0.5px;';
const ROW = 'display:flex; gap:16px; flex-wrap:wrap; align-items:center;';
const LABEL = 'font-size:11px; color:#49454F; margin-top:4px; text-align:center;';

/* ==========================================================
   PLAYGROUND
   ========================================================== */
export const Playground: Story = {
  /** The core activation contract: a pointer click and keyboard Enter/Space each
   *  emit `mdClick`; disabling the button blocks every activation path. Asserts
   *  event counts/payloads the component actually produced and the reflected
   *  disabled transition — never a value the play set on itself. */
  play: async ({ canvasElement, step }) => {
    const btn = await hydrate(canvasElement.querySelector('md-icon-button') as HTMLElement);

    await step('Hydrates as an enabled, non-toggle button', async () => {
      await waitFor(() => expect(btn.getAttribute('role')).toBe('button'));
      expect(btn.getAttribute('aria-pressed')).toBeNull(); // non-toggle → no pressed state
      expect(btn.getAttribute('aria-disabled')).toBe('false');
      expect(btn.classList.contains('md-icon-button--toggle')).toBe(false);
    });

    await step('Click emits mdClick carrying the live (non-toggle) state', async () => {
      const details: Array<{ selected: boolean }> = [];
      const onClick = (e: Event) => details.push((e as CustomEvent).detail);
      btn.addEventListener('mdClick', onClick);
      expect(details.length).toBe(0); // nothing before the click
      btn.click();
      await waitFor(() => expect(details.length).toBe(1)); // component fired exactly once
      expect(details[0].selected).toBe(false); // non-toggle: state stays put
      expect(btn.selected).toBe(false); // a plain click does NOT flip selected
      btn.removeEventListener('mdClick', onClick);
    });

    await step('Enter and Space both activate the focused button', async () => {
      const details: Array<{ selected: boolean }> = [];
      const onClick = (e: Event) => details.push((e as CustomEvent).detail);
      btn.addEventListener('mdClick', onClick);
      btn.focus();
      btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true }));
      await waitFor(() => expect(details.length).toBe(1)); // Enter → mdClick
      btn.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, composed: true }));
      await waitFor(() => expect(details.length).toBe(2)); // Space → mdClick
      btn.removeEventListener('mdClick', onClick);
    });

    await step('Disabling blocks pointer AND keyboard activation (guard)', async () => {
      const before = btn.getAttribute('aria-disabled'); // 'false'
      (btn as HTMLElement & { disabled: boolean }).disabled = true;
      // Reflected attrs land on the next render flush → assert the transition.
      await waitFor(() => expect(btn.getAttribute('aria-disabled')).not.toBe(before));
      expect(btn.getAttribute('aria-disabled')).toBe('true');
      expect(btn.getAttribute('tabindex')).toBe('-1'); // and dropped from the tab order

      let fired = false;
      btn.addEventListener('mdClick', () => { fired = true; });
      btn.click();
      btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true }));
      // Settle a render tick so a regressed emit would have surfaced.
      await new Promise((r) => setTimeout(r, 60));
      expect(fired).toBe(false); // disabled emits nothing on any path
    });

    await step('Disabled pointerdown never enters the pressed shape-morph state', async () => {
      // btn is still disabled from the previous step → the pointer-down guard
      // (`if (!this.isDisabled)`) must short-circuit and leave `pressed` false.
      expect(btn.getAttribute('aria-disabled')).toBe('true'); // precondition
      // The earlier Enter/Space steps set `pressed` via a self-releasing 150ms
      // timer (handleKeyDown); let that settle first so we measure the disabled
      // pointer-down guard — not the tail of that keyboard press bleeding through.
      await waitFor(() => expect(btn.classList.contains('md-icon-button--pressed')).toBe(false));
      btn.dispatchEvent(new Event('pointerdown', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 60)); // settle a render tick
      expect(btn.classList.contains('md-icon-button--pressed')).toBe(false);
    });

    await step('Re-enabled pointerdown morphs to pressed; pointerup releases it', async () => {
      (btn as HTMLElement & { disabled: boolean }).disabled = false;
      await waitFor(() => expect(btn.getAttribute('aria-disabled')).toBe('false'));

      btn.dispatchEvent(new Event('pointerdown', { bubbles: true }));
      // shapeMorph (default true) + pressed → the host gains the pressed class.
      await waitFor(() => expect(btn.classList.contains('md-icon-button--pressed')).toBe(true));

      btn.dispatchEvent(new Event('pointerup', { bubbles: true }));
      await waitFor(() => expect(btn.classList.contains('md-icon-button--pressed')).toBe(false));
    });

    await step('Pointer-leave and pointer-cancel also release the pressed state', async () => {
      btn.dispatchEvent(new Event('pointerdown', { bubbles: true }));
      await waitFor(() => expect(btn.classList.contains('md-icon-button--pressed')).toBe(true));
      btn.dispatchEvent(new Event('pointerleave', { bubbles: true }));
      await waitFor(() => expect(btn.classList.contains('md-icon-button--pressed')).toBe(false));

      btn.dispatchEvent(new Event('pointerdown', { bubbles: true }));
      await waitFor(() => expect(btn.classList.contains('md-icon-button--pressed')).toBe(true));
      btn.dispatchEvent(new Event('pointercancel', { bubbles: true }));
      await waitFor(() => expect(btn.classList.contains('md-icon-button--pressed')).toBe(false));
    });

    await step('groupTabindex override drives the roving tabindex (md-button-group contract)', async () => {
      // Enabled + standalone → the host is tabbable at '0'.
      expect(btn.getAttribute('tabindex')).toBe('0');
      const grouped = btn as HTMLElement & { groupTabindex: number | null };
      grouped.groupTabindex = -1; // a group parks this button OUT of the tab order
      await waitFor(() => expect(btn.getAttribute('tabindex')).toBe('-1'));
      grouped.groupTabindex = 0; // …then makes it the single active roving stop
      await waitFor(() => expect(btn.getAttribute('tabindex')).toBe('0'));
      grouped.groupTabindex = null; // standalone again → falls back to '0'
      await waitFor(() => expect(btn.getAttribute('tabindex')).toBe('0'));
    });

    await step('A non-activation key neither emits mdClick nor morphs the shape', async () => {
      let fired = false;
      const onClick = () => { fired = true; };
      btn.addEventListener('mdClick', onClick);
      btn.focus();
      // Only Enter/Space activate — ArrowDown must fall through the keydown guard.
      btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true }));
      await new Promise((r) => setTimeout(r, 60)); // settle a render tick
      expect(fired).toBe(false); // no activation on a non-activation key
      expect(btn.classList.contains('md-icon-button--pressed')).toBe(false); // no shape morph
      btn.removeEventListener('mdClick', onClick);
    });

    await step('Keyboard Enter drives the pressed shape-morph, then auto-releases (~150ms)', async () => {
      let fired = false;
      const onClick = () => { fired = true; };
      btn.addEventListener('mdClick', onClick);
      btn.focus();
      btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true }));
      // handleKeyDown sets pressed=true (shapeMorph default) and synth-clicks the host.
      await waitFor(() => expect(btn.classList.contains('md-icon-button--pressed')).toBe(true));
      await waitFor(() => expect(fired).toBe(true)); // el.click() routed through to mdClick
      // The internal 150ms timer releases the pressed state on its own — no pointerup.
      await waitFor(() => expect(btn.classList.contains('md-icon-button--pressed')).toBe(false));
      btn.removeEventListener('mdClick', onClick);
    });
  },
  render: (args) => html`
    <div style="${SECTION}">
      <div style="${ROW}">
        <md-icon-button
          variant="${args.variant}"
          size="${args.size}"
          shape="${args.shape}"
          button-width="${args.buttonWidth}"
          ?disabled="${args.disabled}"
          ?soft-disabled="${args.softDisabled}"
          ?selected="${args.selected}"
          ?toggle="${args.toggle}"
          ?shape-morph="${args.shapeMorph}"
          ?ripple="${args.ripple}"
          icon="${args.icon}"
          aria-label="${args.icon || 'Icon button'}"
          selected-icon="${args.selectedIcon}"
        ></md-icon-button>
      </div>
    </div>
  `,
};

/* ==========================================================
   ALL VARIANTS
   ========================================================== */
export const Variants: Story = {
  name: 'All Variants',
  render: () => html`
    <div style="${SECTION}">
      <p style="${HEADING}">Unselected</p>
      <div style="${ROW}">
        ${(['standard', 'filled', 'tonal', 'outlined'] as const).map(
          (v) => html`
            <div style="text-align:center;">
              <md-icon-button variant="${v}" icon="settings" aria-label="Settings"></md-icon-button>
              <div style="${LABEL}">${v}</div>
            </div>
          `,
        )}
      </div>

      <p style="${HEADING}">Selected (toggle)</p>
      <div style="${ROW}">
        ${(['standard', 'filled', 'tonal', 'outlined'] as const).map(
          (v) => html`
            <div style="text-align:center;">
              <md-icon-button variant="${v}" toggle selected icon="favorite" aria-label="Favorite"></md-icon-button>
              <div style="${LABEL}">${v}</div>
            </div>
          `,
        )}
      </div>

      <p style="${HEADING}">Disabled</p>
      <div style="${ROW}">
        ${(['standard', 'filled', 'tonal', 'outlined'] as const).map(
          (v) => html`
            <div style="text-align:center;">
              <md-icon-button variant="${v}" disabled icon="settings" aria-label="Settings"></md-icon-button>
              <div style="${LABEL}">${v}</div>
            </div>
          `,
        )}
      </div>
    </div>
  `,
};

/* ==========================================================
   SIZES
   ========================================================== */
export const Sizes: Story = {
  name: 'All Sizes',
  render: () => html`
    <div style="${SECTION}">
      <p style="${HEADING}">Round (default)</p>
      <div style="${ROW}; align-items: flex-end;">
        ${(['xs', 'sm', 'md', 'lg', 'xl'] as const).map(
          (s) => html`
            <div style="text-align:center;">
              <md-icon-button variant="filled" size="${s}" icon="favorite" aria-label="Favorite"></md-icon-button>
              <div style="${LABEL}">${s}</div>
            </div>
          `,
        )}
      </div>

      <p style="${HEADING}">Square</p>
      <div style="${ROW}; align-items: flex-end;">
        ${(['xs', 'sm', 'md', 'lg', 'xl'] as const).map(
          (s) => html`
            <div style="text-align:center;">
              <md-icon-button variant="filled" size="${s}" shape="square" icon="favorite" aria-label="Favorite"></md-icon-button>
              <div style="${LABEL}">${s}</div>
            </div>
          `,
        )}
      </div>

      <p style="${HEADING}">All variants at each size</p>
      ${(['xs', 'sm', 'md', 'lg', 'xl'] as const).map(
        (s) => html`
          <div style="margin-bottom:16px;">
            <div style="font-size:11px; color:#49454F; margin-bottom:4px;">${s.toUpperCase()}</div>
            <div style="${ROW}">
              <md-icon-button variant="standard" size="${s}" icon="settings" aria-label="Settings"></md-icon-button>
              <md-icon-button variant="filled" size="${s}" icon="settings" aria-label="Settings"></md-icon-button>
              <md-icon-button variant="tonal" size="${s}" icon="settings" aria-label="Settings"></md-icon-button>
              <md-icon-button variant="outlined" size="${s}" icon="settings" aria-label="Settings"></md-icon-button>
            </div>
          </div>
        `,
      )}
    </div>
  `,
};

/* ==========================================================
   SHAPES
   ========================================================== */
export const Shapes: Story = {
  name: 'Round vs Square',
  render: () => html`
    <div style="${SECTION}">
      ${(['filled', 'tonal', 'outlined'] as const).map(
        (v) => html`
          <p style="${HEADING}">${v}</p>
          <div style="${ROW}">
            <div style="text-align:center;">
              <md-icon-button variant="${v}" shape="round" icon="favorite" aria-label="Favorite"></md-icon-button>
              <div style="${LABEL}">round</div>
            </div>
            <div style="text-align:center;">
              <md-icon-button variant="${v}" shape="square" icon="favorite" aria-label="Favorite"></md-icon-button>
              <div style="${LABEL}">square</div>
            </div>
          </div>
        `,
      )}
    </div>
  `,
};

/* ==========================================================
   WIDTHS
   ========================================================== */
export const Widths: Story = {
  name: 'Narrow / Default / Wide',
  render: () => html`
    <div style="${SECTION}">
      ${(['narrow', 'default', 'wide'] as const).map(
        (w) => html`
          <p style="${HEADING}">${w}</p>
          <div style="${ROW}; align-items: flex-end;">
            ${(['xs', 'sm', 'md', 'lg', 'xl'] as const).map(
              (s) => html`
                <div style="text-align:center;">
                  <md-icon-button variant="filled" size="${s}" button-width="${w}" icon="favorite" aria-label="Favorite"></md-icon-button>
                  <div style="${LABEL}">${s}</div>
                </div>
              `,
            )}
          </div>
        `,
      )}

      <p style="${HEADING}">All variants × wide</p>
      <div style="${ROW}">
        ${(['standard', 'filled', 'tonal', 'outlined'] as const).map(
          (v) => html`
            <div style="text-align:center;">
              <md-icon-button variant="${v}" button-width="wide" icon="settings" aria-label="Settings"></md-icon-button>
              <div style="${LABEL}">${v}</div>
            </div>
          `,
        )}
      </div>

      <p style="${HEADING}">All variants × narrow</p>
      <div style="${ROW}">
        ${(['standard', 'filled', 'tonal', 'outlined'] as const).map(
          (v) => html`
            <div style="text-align:center;">
              <md-icon-button variant="${v}" button-width="narrow" icon="settings" aria-label="Settings"></md-icon-button>
              <div style="${LABEL}">${v}</div>
            </div>
          `,
        )}
      </div>

      <p style="${HEADING}">Wide + square shape</p>
      <div style="${ROW}; align-items: flex-end;">
        ${(['xs', 'sm', 'md', 'lg', 'xl'] as const).map(
          (s) => html`
            <div style="text-align:center;">
              <md-icon-button variant="tonal" size="${s}" shape="square" button-width="wide" icon="favorite" aria-label="Favorite"></md-icon-button>
              <div style="${LABEL}">${s}</div>
            </div>
          `,
        )}
      </div>

      <p style="${HEADING}">Narrow + square shape</p>
      <div style="${ROW}; align-items: flex-end;">
        ${(['xs', 'sm', 'md', 'lg', 'xl'] as const).map(
          (s) => html`
            <div style="text-align:center;">
              <md-icon-button variant="tonal" size="${s}" shape="square" button-width="narrow" icon="favorite" aria-label="Favorite"></md-icon-button>
              <div style="${LABEL}">${s}</div>
            </div>
          `,
        )}
      </div>
    </div>
  `,
};

/* ==========================================================
   SHAPE MORPHING
   ========================================================== */
export const ShapeMorphing: Story = {
  name: 'Shape Morphing',
  render: () => html`
    <div style="${SECTION}">
      <p style="${HEADING}">Pressed state — press and hold to see the shape morph</p>
      <div style="${ROW}; align-items: flex-end;">
        ${(['xs', 'sm', 'md', 'lg', 'xl'] as const).map(
          (s) => html`
            <div style="text-align:center;">
              <md-icon-button variant="filled" size="${s}" icon="edit" aria-label="Edit"></md-icon-button>
              <div style="${LABEL}">${s} round</div>
            </div>
          `,
        )}
      </div>
      <div style="${ROW}; align-items: flex-end; margin-top:16px;">
        ${(['xs', 'sm', 'md', 'lg', 'xl'] as const).map(
          (s) => html`
            <div style="text-align:center;">
              <md-icon-button variant="filled" size="${s}" shape="square" icon="edit" aria-label="Edit"></md-icon-button>
              <div style="${LABEL}">${s} square</div>
            </div>
          `,
        )}
      </div>

      <p style="${HEADING}">Toggle selected — round resting → square selected (click to toggle)</p>
      <div style="${ROW}; align-items: flex-end;">
        ${(['xs', 'sm', 'md', 'lg', 'xl'] as const).map(
          (s) => html`
            <div style="text-align:center;">
              <md-icon-button variant="filled" size="${s}" toggle icon="favorite_border" selected-icon="favorite" aria-label="Favorite"></md-icon-button>
              <div style="${LABEL}">${s}</div>
            </div>
          `,
        )}
      </div>

      <p style="${HEADING}">Toggle selected — square resting → round selected (click to toggle)</p>
      <div style="${ROW}; align-items: flex-end;">
        ${(['xs', 'sm', 'md', 'lg', 'xl'] as const).map(
          (s) => html`
            <div style="text-align:center;">
              <md-icon-button variant="tonal" size="${s}" shape="square" toggle icon="bookmark_border" selected-icon="bookmark" aria-label="Bookmark"></md-icon-button>
              <div style="${LABEL}">${s}</div>
            </div>
          `,
        )}
      </div>

      <p style="${HEADING}">All variants — toggle with shape morph (round → square)</p>
      <div style="${ROW}">
        ${(['standard', 'filled', 'tonal', 'outlined'] as const).map(
          (v) => html`
            <div style="text-align:center;">
              <md-icon-button variant="${v}" toggle icon="star_border" selected-icon="star" aria-label="Star"></md-icon-button>
              <div style="${LABEL}">${v}</div>
            </div>
          `,
        )}
      </div>

      <p style="${HEADING}">Pre-selected (notice square shape on round buttons)</p>
      <div style="${ROW}">
        ${(['standard', 'filled', 'tonal', 'outlined'] as const).map(
          (v) => html`
            <div style="text-align:center;">
              <md-icon-button variant="${v}" toggle selected icon="favorite_border" selected-icon="favorite" aria-label="Favorite"></md-icon-button>
              <div style="${LABEL}">${v} selected</div>
            </div>
          `,
        )}
      </div>
    </div>
  `,
};

/* ==========================================================
   TOGGLE
   ========================================================== */
export const Toggle: Story = {
  name: 'Toggle Behavior',
  /** Clicking a toggle button flips selected/aria-pressed ON and emits
   *  `mdClick` with the new state; clicking again flips it back OFF. Asserts
   *  both transitions from live DOM/event reads, not the values we set. */
  play: async ({ canvasElement, step }) => {
    const btn = await hydrate(canvasElement.querySelector('md-icon-button') as HTMLElement);

    await step('Toggle button starts unpressed', async () => {
      await waitFor(() => expect(btn.getAttribute('role')).toBe('button'));
      expect(btn.getAttribute('aria-pressed')).toBe('false');
      expect(btn.selected).toBe(false);
      expect(btn.classList.contains('md-icon-button--selected')).toBe(false);
    });

    await step('Click flips it ON and emits mdClick{selected:true}', async () => {
      const before = btn.getAttribute('aria-pressed'); // 'false'
      let detail: { selected: boolean } | undefined;
      btn.addEventListener(
        'mdClick',
        (e) => { detail = (e as CustomEvent).detail; },
        { once: true },
      );
      btn.click();
      // Reflected attrs land on the next render flush → assert inside waitFor.
      await waitFor(() => expect(btn.getAttribute('aria-pressed')).not.toBe(before));
      expect(btn.getAttribute('aria-pressed')).toBe('true'); // proves WHERE it moved
      expect(btn.classList.contains('md-icon-button--selected')).toBe(true);
      expect(btn.selected).toBe(true);
      expect(detail?.selected).toBe(true); // component fired, not just mutated DOM
    });

    await step('Click again flips it back OFF', async () => {
      const before = btn.getAttribute('aria-pressed'); // 'true'
      let detail: { selected: boolean } | undefined;
      btn.addEventListener(
        'mdClick',
        (e) => { detail = (e as CustomEvent).detail; },
        { once: true },
      );
      btn.click();
      await waitFor(() => expect(btn.getAttribute('aria-pressed')).not.toBe(before));
      expect(btn.getAttribute('aria-pressed')).toBe('false');
      expect(btn.classList.contains('md-icon-button--selected')).toBe(false);
      expect(btn.selected).toBe(false);
      expect(detail?.selected).toBe(false);
    });

    await step('Pre-selected toggle starts pressed and clears on click', async () => {
      const pre = await hydrate(
        canvasElement.querySelector('md-icon-button[selected]') as HTMLElement,
      );
      await waitFor(() => expect(pre.getAttribute('aria-pressed')).toBe('true'));
      expect(pre.selected).toBe(true);
      expect(selectedLayerOn(pre)).toBe(true); // the `selected-icon` glyph layer is lit

      let detail: { selected: boolean } | undefined;
      pre.addEventListener(
        'mdClick',
        (e) => { detail = (e as CustomEvent).detail; },
        { once: true },
      );
      pre.click();
      await waitFor(() => expect(pre.getAttribute('aria-pressed')).toBe('false'));
      expect(detail?.selected).toBe(false);
      expect(selectedLayerOn(pre)).toBe(false); // glyph layer swapped back off
    });

    await step('Keyboard Enter/Space toggle through the keydown → click path', async () => {
      // btn is a toggle button left OFF by the earlier click steps.
      await waitFor(() => expect(btn.getAttribute('aria-pressed')).toBe('false'));
      btn.focus();
      // handleKeyDown → el.click() → handleClick flips `selected` in toggle mode.
      btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true }));
      await waitFor(() => expect(btn.getAttribute('aria-pressed')).toBe('true'));
      expect(btn.selected).toBe(true); // keyboard activation flipped the live state ON
      btn.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, composed: true }));
      await waitFor(() => expect(btn.getAttribute('aria-pressed')).toBe('false'));
      expect(btn.selected).toBe(false); // …and Space flipped it back OFF
    });
  },
  render: () => html`
    <div style="${SECTION}">
      <p style="${HEADING}">Click to toggle (same icon)</p>
      <div style="${ROW}">
        <md-icon-button toggle variant="standard" icon="favorite" aria-label="Favorite"></md-icon-button>
        <md-icon-button toggle variant="filled" icon="bookmark" aria-label="Bookmark"></md-icon-button>
        <md-icon-button toggle variant="tonal" icon="star" aria-label="Star"></md-icon-button>
        <md-icon-button toggle variant="outlined" icon="notifications" aria-label="Notifications"></md-icon-button>
      </div>

      <p style="${HEADING}">Toggle with different selected icon</p>
      <div style="${ROW}">
        <md-icon-button toggle variant="standard" icon="favorite_border" selected-icon="favorite" aria-label="Favorite"></md-icon-button>
        <md-icon-button toggle variant="filled" icon="bookmark_border" selected-icon="bookmark" aria-label="Bookmark"></md-icon-button>
        <md-icon-button toggle variant="tonal" icon="star_border" selected-icon="star" aria-label="Star"></md-icon-button>
        <md-icon-button toggle variant="outlined" icon="notifications_none" selected-icon="notifications" aria-label="Notifications"></md-icon-button>
      </div>

      <p style="${HEADING}">Pre-selected</p>
      <div style="${ROW}">
        <md-icon-button toggle selected variant="filled" icon="favorite_border" selected-icon="favorite" aria-label="Favorite"></md-icon-button>
        <md-icon-button toggle selected variant="tonal" icon="bookmark_border" selected-icon="bookmark" aria-label="Bookmark"></md-icon-button>
        <md-icon-button toggle selected variant="outlined" icon="star_border" selected-icon="star" aria-label="Star"></md-icon-button>
      </div>
    </div>
  `,
};

/* ==========================================================
   CUSTOM ICONS (SLOT)
   ========================================================== */
export const CustomIcons: Story = {
  name: 'Custom Icons (Slot)',
  render: () => html`
    <div style="${SECTION}">
      <p style="${HEADING}">SVG icon via default slot</p>
      <div style="${ROW}">
        <md-icon-button variant="filled" aria-label="Star">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
          </svg>
        </md-icon-button>

        <md-icon-button variant="tonal" aria-label="Security">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
            <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
          </svg>
        </md-icon-button>

        <md-icon-button variant="outlined" aria-label="Close">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </md-icon-button>
      </div>

      <p style="${HEADING}">Emoji via slot</p>
      <div style="${ROW}">
        <md-icon-button variant="filled" aria-label="Fire">
          <span style="font-size:24px; line-height:1;">🔥</span>
        </md-icon-button>
        <md-icon-button variant="tonal" aria-label="Flash">
          <span style="font-size:24px; line-height:1;">⚡</span>
        </md-icon-button>
      </div>
    </div>
  `,
};

/* ==========================================================
   SOFT-DISABLED
   ========================================================== */
export const SoftDisabled: Story = {
  name: 'Soft-Disabled',
  /** soft-disabled is visually disabled but stays in the tab order (tabindex 0)
   *  for discoverability, while every activation path is still blocked. Exercises
   *  the `softDisabled` arm of the isDisabled guard through click, keyboard and
   *  pointer — none of which may emit or morph — and the tabindex='0' branch that
   *  distinguishes it from a hard `disabled` button. */
  play: async ({ canvasElement, step }) => {
    const btn = await hydrate(
      canvasElement.querySelector('md-icon-button[soft-disabled]') as HTMLElement,
    );

    await step('Soft-disabled is announced disabled yet remains focusable', async () => {
      await waitFor(() => expect(btn.getAttribute('aria-disabled')).toBe('true'));
      expect(btn.getAttribute('tabindex')).toBe('0'); // NOT dropped from the tab order
      btn.focus();
      expect(document.activeElement).toBe(btn); // reachable by keyboard focus
    });

    await step('Every activation path is blocked (no mdClick, no shape morph)', async () => {
      let fired = false;
      const onClick = () => { fired = true; };
      btn.addEventListener('mdClick', onClick);

      btn.click(); // pointer path → handleClick guard returns early
      btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true }));
      btn.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, composed: true }));
      btn.dispatchEvent(new Event('pointerdown', { bubbles: true })); // pointer-down guard

      await new Promise((r) => setTimeout(r, 80)); // settle: a regressed emit/morph would surface
      expect(fired).toBe(false); // soft-disabled emits nothing on any path
      expect(btn.classList.contains('md-icon-button--pressed')).toBe(false); // pointerdown guard held
      btn.removeEventListener('mdClick', onClick);
    });
  },
  render: () => html`
    <div style="${SECTION}">
      <p style="${HEADING}">Soft-disabled (focusable, visually disabled)</p>
      <div style="${ROW}">
        <div style="text-align:center;">
          <md-icon-button soft-disabled variant="standard" icon="content_paste" aria-label="Paste"></md-icon-button>
          <div style="${LABEL}">standard</div>
        </div>
        <div style="text-align:center;">
          <md-icon-button soft-disabled variant="filled" icon="content_paste" aria-label="Paste"></md-icon-button>
          <div style="${LABEL}">filled</div>
        </div>
        <div style="text-align:center;">
          <md-icon-button soft-disabled variant="tonal" icon="content_paste" aria-label="Paste"></md-icon-button>
          <div style="${LABEL}">tonal</div>
        </div>
        <div style="text-align:center;">
          <md-icon-button soft-disabled variant="outlined" icon="content_paste" aria-label="Paste"></md-icon-button>
          <div style="${LABEL}">outlined</div>
        </div>
      </div>

      <p style="${HEADING}">Comparison: disabled vs soft-disabled (try tabbing)</p>
      <div style="${ROW}">
        <div style="text-align:center;">
          <md-icon-button disabled variant="filled" icon="content_paste" aria-label="Paste"></md-icon-button>
          <div style="${LABEL}">disabled</div>
        </div>
        <div style="text-align:center;">
          <md-icon-button soft-disabled variant="filled" icon="content_paste" aria-label="Paste"></md-icon-button>
          <div style="${LABEL}">soft-disabled</div>
        </div>
        <div style="text-align:center;">
          <md-icon-button variant="filled" icon="content_paste" aria-label="Paste"></md-icon-button>
          <div style="${LABEL}">enabled</div>
        </div>
      </div>
    </div>
  `,
};

/* ==========================================================
   CUSTOM CSS
   ========================================================== */
export const CustomCSS: Story = {
  name: 'Custom CSS Properties',
  render: () => html`
    <div style="${SECTION}">
      <p style="${HEADING}">Custom colors</p>
      <div style="${ROW}">
        <div style="text-align:center;">
          <md-icon-button
            variant="filled"
            icon="delete"
            aria-label="Delete"
            style="--md-icon-button-container-color: #B3261E; --md-icon-button-icon-color: #FFFFFF;"
          ></md-icon-button>
          <div style="${LABEL}">Error</div>
        </div>
        <div style="text-align:center;">
          <md-icon-button
            variant="filled"
            icon="check"
            aria-label="Confirm"
            style="--md-icon-button-container-color: #1B5E20; --md-icon-button-icon-color: #FFFFFF;"
          ></md-icon-button>
          <div style="${LABEL}">Success</div>
        </div>
        <div style="text-align:center;">
          <md-icon-button
            variant="filled"
            icon="warning"
            aria-label="Warning"
            style="--md-icon-button-container-color: #E65100; --md-icon-button-icon-color: #FFFFFF;"
          ></md-icon-button>
          <div style="${LABEL}">Warning</div>
        </div>
      </div>

      <p style="${HEADING}">Custom size override</p>
      <div style="${ROW}">
        <div style="text-align:center;">
          <md-icon-button
            variant="filled"
            icon="favorite"
            aria-label="Favorite"
            style="--md-icon-button-container-width: 64px; --md-icon-button-container-height: 64px; --md-icon-button-icon-size: 32px;"
          ></md-icon-button>
          <div style="${LABEL}">64x64</div>
        </div>
      </div>

      <p style="${HEADING}">Custom shape</p>
      <div style="${ROW}">
        <div style="text-align:center;">
          <md-icon-button
            variant="filled"
            icon="settings"
            aria-label="Settings"
            style="--md-icon-button-container-shape: 4px;"
          ></md-icon-button>
          <div style="${LABEL}">4px radius</div>
        </div>
        <div style="text-align:center;">
          <md-icon-button
            variant="filled"
            icon="settings"
            aria-label="Settings"
            style="--md-icon-button-container-shape: 0;"
          ></md-icon-button>
          <div style="${LABEL}">Sharp</div>
        </div>
      </div>

      <p style="${HEADING}">Custom outline</p>
      <div style="${ROW}">
        <div style="text-align:center;">
          <md-icon-button
            variant="outlined"
            icon="edit"
            aria-label="Edit"
            style="--md-icon-button-outline-color: #6750A4; --md-icon-button-outline-width: 2px;"
          ></md-icon-button>
          <div style="${LABEL}">Purple 2px</div>
        </div>
      </div>
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
          'Icon-only buttons require an accessible name via ' +
          '<code>aria-label</code> or <code>aria-labelledby</code>. ' +
          'Toggle buttons announce state with <code>aria-pressed</code>. ' +
          'Tab through the page and use Enter / Space to activate.',
      },
    },
  },
  render: () => html`
    <style>
      .ib-a11y { padding: 24px; font-family: Roboto, sans-serif; }
      .ib-a11y section { margin-bottom: 32px; }
      .ib-a11y h4 { margin: 0 0 4px; font-size: 14px; font-weight: 600; }
      .ib-a11y p { margin: 0 0 12px; color: #49454F; font-size: 13px; line-height: 1.5; }
      .ib-a11y .row { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }
      .ib-a11y code { background: #f7f2fa; padding: 1px 6px; border-radius: 4px; font-size: 12px; }
    </style>

    <div class="ib-a11y">
      <section>
        <h4>1 · Accessible name (required for icon-only)</h4>
        <p>
          Every icon button needs <code>aria-label</code> or
          <code>aria-labelledby</code> so screen readers announce its purpose.
          Without one, users hear only "button".
        </p>
        <div class="row">
          <md-icon-button variant="filled" icon="settings" aria-label="Settings"></md-icon-button>
          <md-icon-button variant="tonal" icon="search" aria-label="Search"></md-icon-button>
          <md-icon-button variant="outlined" icon="more_vert" aria-label="More options"></md-icon-button>
        </div>
      </section>

      <section>
        <h4>2 · Default role and keyboard</h4>
        <p>
          Renders with <code>role="button"</code> and
          <code>tabindex="0"</code>. <kbd>Enter</kbd> and <kbd>Space</kbd>
          both fire <code>mdClick</code>.
        </p>
        <div class="row">
          <md-icon-button variant="filled" icon="add" aria-label="Add"></md-icon-button>
          <md-icon-button variant="standard" icon="close" aria-label="Close"></md-icon-button>
        </div>
      </section>

      <section>
        <h4>3 · Disabled vs. soft-disabled</h4>
        <p>
          <strong>disabled</strong> sets <code>aria-disabled="true"</code>
          and <code>tabindex="-1"</code> — skipped by Tab.
          <strong>soft-disabled</strong> keeps <code>tabindex="0"</code>
          (focusable for discoverability) but blocks activation.
        </p>
        <div class="row">
          <md-icon-button variant="filled" disabled icon="delete" aria-label="Delete (disabled)"></md-icon-button>
          <md-icon-button variant="filled" soft-disabled icon="delete" aria-label="Delete (soft-disabled)"></md-icon-button>
        </div>
      </section>

      <section>
        <h4>4 · Toggle button — aria-pressed</h4>
        <p>
          Toggle icon buttons announce state via
          <code>aria-pressed</code>. Screen-reader users hear "Favorite,
          toggle button, pressed" when selected.
        </p>
        <div class="row">
          <md-icon-button toggle variant="standard" icon="favorite_border" selected-icon="favorite" aria-label="Favorite"></md-icon-button>
          <md-icon-button toggle selected variant="filled" icon="favorite_border" selected-icon="favorite" aria-label="Favorite"></md-icon-button>
          <md-icon-button toggle variant="tonal" icon="bookmark_border" selected-icon="bookmark" aria-label="Bookmark"></md-icon-button>
        </div>
      </section>

      <section>
        <h4>5 · Focus ring (Tab from another control)</h4>
        <p>
          Focus is shown as a 3px secondary outline 2px outside the
          container — visible against any variant or background.
        </p>
        <div class="row">
          <input type="text" placeholder="Tab from here" aria-label="Tab from here" />
          <md-icon-button variant="standard" icon="settings" aria-label="Settings"></md-icon-button>
          <md-icon-button variant="filled" icon="edit" aria-label="Edit"></md-icon-button>
          <md-icon-button variant="tonal" icon="share" aria-label="Share"></md-icon-button>
          <md-icon-button variant="outlined" icon="delete" aria-label="Delete"></md-icon-button>
        </div>
      </section>
    </div>
  `,
};

/* ==========================================================
   LOCALIZATION — localized aria-label in 6 locales
   ========================================================== */
export const Localization: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Icon-only buttons need a localized <code>aria-label</code> — ' +
          'there is no visible text for screen readers to fall back on. ' +
          'Set <code>lang</code> and <code>dir</code> on a wrapping element ' +
          'so pronunciation and layout match the locale.',
      },
    },
  },
  render: () => {
    const rows = [
      { code: 'en', dir: 'ltr', name: 'English',  settings: 'Settings', favorite: 'Favorite', share: 'Share', delete: 'Delete' },
      { code: 'fr', dir: 'ltr', name: 'Français', settings: 'Paramètres', favorite: 'Favori', share: 'Partager', delete: 'Supprimer' },
      { code: 'de', dir: 'ltr', name: 'Deutsch',  settings: 'Einstellungen', favorite: 'Favorit', share: 'Teilen', delete: 'Löschen' },
      { code: 'ja', dir: 'ltr', name: '日本語',     settings: '設定',       favorite: 'お気に入り', share: '共有',     delete: '削除' },
      { code: 'ar', dir: 'rtl', name: 'العربية',   settings: 'الإعدادات',  favorite: 'مفضلة',    share: 'مشاركة',   delete: 'حذف' },
      { code: 'he', dir: 'rtl', name: 'עברית',    settings: 'הגדרות',     favorite: 'מועדף',    share: 'שיתוף',    delete: 'מחק' },
    ];
    return html`
      <style>
        .ib-l10n { padding: 24px; font-family: Roboto, sans-serif; }
        .ib-l10n .grid { display: flex; flex-direction: column; }
        .ib-l10n .row {
          display: flex;
          align-items: center;
          gap: 24px;
          padding-block: 16px;
          border-block-end: 1px solid #e7e0ec;
        }
        .ib-l10n .info {
          flex: 0 0 180px;
          display: flex;
          align-items: baseline;
          gap: 8px;
        }
        .ib-l10n .code { color: #6750a4; font-weight: 600; font-family: 'JetBrains Mono', ui-monospace, monospace; }
        .ib-l10n .name { color: #49454F; font-size: 14px; }
        .ib-l10n .buttons {
          flex: 1 1 auto;
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          align-items: center;
        }
      </style>
      <div class="ib-l10n">
        <p style="color:#49454F; margin:0 0 16px; font-size:14px;">
          Each row carries its own <code>lang</code> and <code>dir</code>.
          Icon buttons use localized <code>aria-label</code> values from your
          i18n layer — Material Symbols icons render the same in every locale.
        </p>
        <div class="grid">
          ${rows.map(r => html`
            <div class="row" lang="${r.code}" dir="${r.dir}">
              <div class="info">
                <span class="code">${r.code}</span>
                <span class="name">${r.name}</span>
              </div>
              <div class="buttons">
                <md-icon-button variant="standard" icon="settings" aria-label="${r.settings}"></md-icon-button>
                <md-icon-button variant="filled" icon="favorite" aria-label="${r.favorite}"></md-icon-button>
                <md-icon-button variant="tonal" icon="share" aria-label="${r.share}"></md-icon-button>
                <md-icon-button variant="outlined" icon="delete" aria-label="${r.delete}"></md-icon-button>
              </div>
            </div>
          `)}
        </div>
      </div>
    `;
  },
};

/* ==========================================================
   RTL — variants and sizes in dir="rtl"
   ========================================================== */
export const RTL: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Icon buttons are symmetric — layout does not mirror in RTL, ' +
          'but localized <code>aria-label</code> values and ' +
          '<code>lang</code>/<code>dir</code> on the wrapper are still ' +
          'required for screen-reader pronunciation in Arabic and Hebrew.',
      },
    },
  },
  render: () => html`
    <div dir="rtl" lang="ar" style="${SECTION}">
      <p style="${HEADING}">All variants (Arabic aria-labels)</p>
      <div style="${ROW}">
        <md-icon-button variant="standard" icon="settings" aria-label="الإعدادات"></md-icon-button>
        <md-icon-button variant="filled" icon="edit" aria-label="تحرير"></md-icon-button>
        <md-icon-button variant="tonal" icon="share" aria-label="مشاركة"></md-icon-button>
        <md-icon-button variant="outlined" icon="delete" aria-label="حذف"></md-icon-button>
      </div>

      <p style="${HEADING}">Toggle selected (Arabic)</p>
      <div style="${ROW}">
        <md-icon-button toggle selected variant="filled" icon="favorite_border" selected-icon="favorite" aria-label="مفضلة"></md-icon-button>
        <md-icon-button toggle variant="tonal" icon="bookmark_border" selected-icon="bookmark" aria-label="إشارة مرجعية"></md-icon-button>
        <md-icon-button toggle variant="outlined" icon="notifications_none" selected-icon="notifications" aria-label="إشعارات"></md-icon-button>
      </div>

      <p style="${HEADING}">All sizes (Arabic)</p>
      <div style="${ROW}; align-items: flex-end;">
        ${(['xs', 'sm', 'md', 'lg', 'xl'] as const).map(
          (s) => html`<md-icon-button variant="filled" size="${s}" icon="add" aria-label="إضافة"></md-icon-button>`,
        )}
      </div>

      <p style="${HEADING}">Hebrew (עברית)</p>
      <div style="${ROW}" lang="he">
        <md-icon-button variant="filled" icon="settings" aria-label="הגדרות"></md-icon-button>
        <md-icon-button variant="tonal" icon="favorite" aria-label="מועדף"></md-icon-button>
        <md-icon-button toggle variant="outlined" icon="star_border" selected-icon="star" aria-label="כוכב"></md-icon-button>
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
      <p style="${HEADING}; color:#CAC4D0;">All Variants</p>
      <div style="${ROW}">
        <md-icon-button variant="standard" icon="settings" aria-label="Settings"></md-icon-button>
        <md-icon-button variant="filled" icon="settings" aria-label="Settings"></md-icon-button>
        <md-icon-button variant="tonal" icon="settings" aria-label="Settings"></md-icon-button>
        <md-icon-button variant="outlined" icon="settings" aria-label="Settings"></md-icon-button>
      </div>

      <p style="${HEADING}; color:#CAC4D0;">Toggle Selected</p>
      <div style="${ROW}">
        <md-icon-button toggle selected variant="standard" icon="favorite_border" selected-icon="favorite" aria-label="Favorite"></md-icon-button>
        <md-icon-button toggle selected variant="filled" icon="favorite_border" selected-icon="favorite" aria-label="Favorite"></md-icon-button>
        <md-icon-button toggle selected variant="tonal" icon="favorite_border" selected-icon="favorite" aria-label="Favorite"></md-icon-button>
        <md-icon-button toggle selected variant="outlined" icon="favorite_border" selected-icon="favorite" aria-label="Favorite"></md-icon-button>
      </div>

      <p style="${HEADING}; color:#CAC4D0;">Sizes (Filled)</p>
      <div style="${ROW}; align-items: flex-end;">
        ${(['xs', 'sm', 'md', 'lg', 'xl'] as const).map(
          (s) => html`<md-icon-button variant="filled" size="${s}" icon="favorite" aria-label="Favorite"></md-icon-button>`,
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
          'Icon buttons are fixed-size touch targets — responsiveness is about ' +
          'how toolbars and action rows wrap in narrow containers. Use ' +
          '<code>flex-wrap: wrap</code> with a consistent <code>gap</code>. ' +
          'Below 360px consider hiding secondary actions or moving them into ' +
          'an overflow menu, keeping only the primary action visible.',
      },
    },
  },
  render: (_args, { globals }) => html`
    <style>
      .ib-resp-shell { display: flex; flex-direction: column; gap: 32px; max-width: 1100px; }
      .ib-resp-vp__label { font-size: 11px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase; color: var(--md-sys-color-on-surface-variant, #49454F); margin-block-end: 6px; }
      .ib-resp-vp {
        border: 1px dashed var(--md-sys-color-outline-variant, #cac4d0);
        border-radius: 12px;
        padding: 16px;
        background: var(--md-sys-color-surface-container-lowest, #fffbfe);
        box-sizing: border-box;
        container-type: inline-size;
        margin-block-end: 12px;
      }
      .ib-resp-toolbar { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; justify-content: flex-end; }
      @container (max-width: 360px) {
        .ib-resp-toolbar .ib-resp-secondary { display: none; }
      }
      .ib-resp-live { resize: horizontal; overflow: auto; min-inline-size: 200px; max-inline-size: 100%; inline-size: 480px; }
    </style>

    <div class="ib-resp-shell">
      <section>
        <h3 style="margin: 0 0 4px;">Toolbar wrapping at four breakpoints</h3>
        <p style="margin: 0 0 16px; font-size: 14px; color: var(--md-sys-color-on-surface-variant, #49454F);">
          Action icon buttons wrap to new rows when the container is narrow.
        </p>
        ${[
          { label: 'XS · 320 px (phone)', width: '320px' },
          { label: 'SM · 480 px (large phone)', width: '480px' },
          { label: 'MD · 768 px (tablet)', width: '768px' },
          { label: 'LG · 1024 px (desktop)', width: '1024px' },
        ].map(
          (vp) => html`
            <div>
              <div class="ib-resp-vp__label">${vp.label}</div>
              <div class="ib-resp-vp" style="inline-size: ${vp.width}; max-inline-size: 100%;">
                <p style="margin: 0 0 8px; font-size: 14px;">${t(globals.locale, 'icon-button.documentTitle')}</p>
                <div class="ib-resp-toolbar">
                  <md-icon-button variant="standard" icon="search" aria-label="Search"></md-icon-button>
                  <md-icon-button variant="standard" icon="filter_alt" aria-label="Filter"></md-icon-button>
                  <md-icon-button variant="standard" icon="sort" aria-label="Sort"></md-icon-button>
                  <md-icon-button variant="tonal" icon="share" aria-label="Share"></md-icon-button>
                  <md-icon-button variant="filled" icon="edit" aria-label="Edit"></md-icon-button>
                </div>
              </div>
            </div>
          `,
        )}
      </section>

      <section>
        <h3 style="margin: 0 0 4px;">Hide secondary actions below 360px</h3>
        <p style="margin: 0 0 16px; font-size: 14px; color: var(--md-sys-color-on-surface-variant, #49454F);">
          Container query collapses non-essential buttons on very narrow toolbars.
        </p>
        <div class="ib-resp-vp" style="inline-size: 320px; max-inline-size: 100%;">
          <div class="ib-resp-toolbar">
            <md-icon-button class="ib-resp-secondary" variant="standard" icon="search" aria-label="Search"></md-icon-button>
            <md-icon-button class="ib-resp-secondary" variant="standard" icon="filter_alt" aria-label="Filter"></md-icon-button>
            <md-icon-button class="ib-resp-secondary" variant="standard" icon="sort" aria-label="Sort"></md-icon-button>
            <md-icon-button variant="filled" icon="add" aria-label="Create"></md-icon-button>
          </div>
        </div>
      </section>

      <section>
        <h3 style="margin: 0 0 4px;">Live resize playground</h3>
        <p style="margin: 0 0 16px; font-size: 14px; color: var(--md-sys-color-on-surface-variant, #49454F);">
          Drag the bottom-right corner — watch buttons wrap and secondary actions hide.
        </p>
        <div class="ib-resp-vp ib-resp-live">
          <div class="ib-resp-toolbar">
            <md-icon-button class="ib-resp-secondary" variant="standard" icon="search" aria-label="Search"></md-icon-button>
            <md-icon-button class="ib-resp-secondary" variant="standard" icon="filter_alt" aria-label="Filter"></md-icon-button>
            <md-icon-button class="ib-resp-secondary" variant="standard" icon="sort" aria-label="Sort"></md-icon-button>
            <md-icon-button class="ib-resp-secondary" variant="tonal" icon="share" aria-label="Share"></md-icon-button>
            <md-icon-button variant="filled" icon="edit" aria-label="Edit"></md-icon-button>
          </div>
        </div>
      </section>
    </div>
  `,
};

/* ==========================================================
   LINK (href) — click opens the target URL
   ========================================================== */
export const LinkButton: Story = {
  name: 'Link (href)',
  parameters: {
    docs: {
      description: {
        story:
          'With <code>href</code> set, a click opens the target URL via ' +
          '<code>window.open(href, target)</code> while still emitting ' +
          '<code>mdClick</code>. Useful for icon-only navigation actions.',
      },
    },
  },
  /** Clicking an href icon button routes through the `if (this.href)` branch:
   *  it calls window.open with the configured href + target. We stub window.open
   *  to capture the call (avoids opening a real popup in CI), then restore it. */
  play: async ({ canvasElement, step }) => {
    const btn = await hydrate(canvasElement.querySelector('md-icon-button') as HTMLElement);

    await step('Click opens the href in the configured target and still emits mdClick', async () => {
      const originalOpen = window.open;
      let openCall: { url?: string | URL; target?: string } | undefined;
      window.open = ((url?: string | URL, target?: string) => {
        openCall = { url, target };
        return null;
      }) as typeof window.open;

      try {
        let detail: { selected: boolean } | undefined;
        btn.addEventListener('mdClick', (e) => { detail = (e as CustomEvent).detail; }, { once: true });

        btn.click();

        await waitFor(() => expect(openCall).toBeDefined()); // component invoked window.open
        expect(openCall?.url).toBe('https://example.com/awc'); // exact href forwarded
        expect(openCall?.target).toBe('_blank'); // target prop forwarded
        expect(detail?.selected).toBe(false); // non-toggle link still fires mdClick
      } finally {
        window.open = originalOpen; // never leave the global stubbed
      }
    });
  },
  render: () => html`
    <div style="${SECTION}">
      <p style="${HEADING}">Icon button as a link (opens in a new tab)</p>
      <div style="${ROW}">
        <md-icon-button
          variant="filled"
          icon="open_in_new"
          href="https://example.com/awc"
          target="_blank"
          aria-label="Open AWC docs"
        ></md-icon-button>
      </div>
    </div>
  `,
};

/* ==========================================================
   SLOTTED TEXT — raw text node detection
   ========================================================== */
export const SlottedTextIcon: Story = {
  name: 'Slotted Text Icon',
  parameters: {
    docs: {
      description: {
        story:
          'A raw text node in the default slot (e.g. an emoji) is detected as ' +
          'meaningful slot content, so the <code>icon</code> prop font ' +
          'glyph is suppressed in favour of the slotted character.',
      },
    },
  },
  /** The default slot receives a raw text node. `hasMeaningfulSlotContent()`
   *  exercises its TEXT_NODE branch, flips `hasSlottedIcon` true, and the
   *  re-render drops the `icon`-prop font glyph. */
  play: async ({ canvasElement, step }) => {
    const btn = await hydrate(canvasElement.querySelector('md-icon-button') as HTMLElement);

    await step('Slotted text is detected and suppresses the icon-font glyph', async () => {
      const slot = btn.shadowRoot!.querySelector('slot:not([name])') as HTMLSlotElement;
      const textNode = slot
        .assignedNodes()
        .find((n) => n.nodeType === Node.TEXT_NODE && (n.textContent?.trim().length ?? 0) > 0);
      expect(textNode).toBeDefined(); // a meaningful text node is slotted

      // Slotted content present → the `icon="favorite"` font glyph must not paint
      // (render gate: `hasIcon && !this.hasSlottedIcon`). This proves the
      // text-node detection path actually ran and toggled `hasSlottedIcon`.
      await waitFor(() =>
        expect(btn.shadowRoot!.querySelector('.md-icon-button__icon-font')).toBeNull(),
      );
    });
  },
  render: () => html`
    <div style="${SECTION}">
      <p style="${HEADING}">Emoji text node in the default slot</p>
      <div style="${ROW}">
        <md-icon-button variant="filled" icon="favorite" aria-label="Fire">🔥</md-icon-button>
      </div>
    </div>
  `,
};
