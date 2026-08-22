import type { Meta, StoryObj } from '@storybook/web-components';
import { expect, waitFor } from 'storybook/test';
import { html } from 'lit';
import '@awc-ui/core/define';
import { t } from '../i18n';

/** Shadow-piercing helpers for play(): testing-library queries can't cross
 *  shadow roots, so interactions address the real internals directly. The roving
 *  controls are LIGHT-DOM children of the toolbar, so focus lands on the
 *  md-icon-button host itself — `document.activeElement` resolves straight to it. */
const getToolbar = async (canvasElement: HTMLElement): Promise<HTMLElement> => {
  const toolbar = canvasElement.querySelector('md-toolbar') as HTMLElement;
  await waitFor(() => expect(toolbar.classList.contains('hydrated')).toBe(true));
  return toolbar;
};
const buttonsOf = (toolbar: HTMLElement) =>
  [...toolbar.querySelectorAll('md-icon-button')] as HTMLElement[];
const key = (target: Element, k: string) =>
  target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, composed: true }));

const meta: Meta = {
  title: 'Navigation/Toolbar',
  component: 'md-toolbar',
  tags: ['autodocs'],
  parameters: {
    docs: { source: { language: 'html' } },
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['docked', 'floating'],
      description: 'Toolbar variant',
    },
    color: {
      control: 'select',
      options: ['standard', 'vibrant'],
      description: 'Color scheme',
    },
    layout: {
      control: 'select',
      options: ['horizontal', 'vertical'],
      description: 'Layout direction (floating only)',
    },
    alignment: {
      control: 'select',
      options: ['start', 'center', 'end', 'space-between'],
      description: 'Item alignment',
    },
    containerSemantics: {
      control: 'select',
      options: ['toolbar', 'generic'],
      description: 'Web: toolbar role + ARIA. generic: plain container (e.g. mobile)',
    },
  },
  args: {
    variant: 'docked',
    color: 'standard',
    layout: 'horizontal',
    alignment: 'start',
    containerSemantics: 'toolbar',
  },
};
export default meta;
type Story = StoryObj;

/* ==========================================================
   Playground
   ========================================================== */

export const Playground: Story = {
  render: (args) => html`
    <md-toolbar
      variant=${args.variant}
      color=${args.color}
      layout=${args.layout}
      alignment=${args.alignment}
      container-semantics=${args.containerSemantics}
      aria-label="Playground toolbar"
    >
      <md-icon-button icon="search" aria-label="Search"></md-icon-button>
      <md-icon-button icon="delete" aria-label="Delete"></md-icon-button>
      <md-icon-button icon="archive" aria-label="Archive"></md-icon-button>
      <md-icon-button icon="bookmark" aria-label="Bookmark"></md-icon-button>
    </md-toolbar>
  `,
  /** The WAI-ARIA toolbar model, scripted: one roving Tab stop, click emits
   *  mdClick, arrows move focus along the bar (see the Interactions panel). */
  play: async ({ canvasElement, step }) => {
    const toolbar = await getToolbar(canvasElement);

    await step('Roving tabindex: exactly one control is the Tab stop', async () => {
      const buttons = buttonsOf(toolbar);
      expect(buttons.length).toBe(4);
      // The adaptive roving group collapses four focusables to a single Tab stop.
      await waitFor(() =>
        expect(buttons.filter((b) => b.getAttribute('tabindex') === '0').length).toBe(1),
      );
      expect(buttons[0].getAttribute('tabindex')).toBe('0'); // the leading edge owns it
      expect(toolbar.getAttribute('role')).toBe('toolbar');
    });

    await step('Clicking an action button emits mdClick (bubbles to the toolbar)', async () => {
      const deleteBtn = buttonsOf(toolbar)[1];
      let detail: { selected: boolean } | undefined;
      let firedTarget: EventTarget | null = null;
      toolbar.addEventListener(
        'mdClick',
        (e) => { detail = (e as CustomEvent).detail; firedTarget = e.target; },
        { once: true },
      );
      deleteBtn.click();
      await waitFor(() => expect(detail).toBeDefined());
      expect(firedTarget).toBe(deleteBtn);         // proves WHICH control fired
      expect(detail).toEqual({ selected: false }); // the payload the component produced
    });

    await step('ArrowRight roves focus to the next control (the Tab stop follows)', async () => {
      const buttons = buttonsOf(toolbar);
      buttons[0].focus();
      await waitFor(() => expect(document.activeElement).toBe(buttons[0]));
      const before = document.activeElement;
      key(buttons[0], 'ArrowRight');
      await waitFor(() => expect(document.activeElement).not.toBe(before)); // it MOVED
      expect(document.activeElement).toBe(buttons[1]);                      // to WHERE
      // The single Tab stop rode along with focus, off the old control onto the new.
      await waitFor(() => expect(buttons[1].getAttribute('tabindex')).toBe('0'));
      expect(buttons[0].getAttribute('tabindex')).toBe('-1');
    });

    await step('Off-axis ArrowDown is ignored on a horizontal toolbar (guard)', async () => {
      const buttons = buttonsOf(toolbar);
      buttons[1].focus();
      await waitFor(() => expect(document.activeElement).toBe(buttons[1]));
      key(buttons[1], 'ArrowDown'); // vertical key on a horizontal bar — not hijacked
      expect(document.activeElement).toBe(buttons[1]); // focus stays put
    });

    await step('Focusing a non-active control makes IT the single Tab stop (focusin roving)', async () => {
      const buttons = buttonsOf(toolbar);
      // The prior step left the stop/active on buttons[1]; jump focus straight to buttons[3]
      // (not via arrows) — focusin must move the lone Tab stop onto the newly-focused control.
      buttons[3].focus();
      await waitFor(() => expect(document.activeElement).toBe(buttons[3]));
      await waitFor(() => expect(buttons[3].getAttribute('tabindex')).toBe('0')); // stop rode to it
      expect(buttons[1].getAttribute('tabindex')).toBe('-1');                     // left the old one
    });

    await step('Home / End jump the roving stop to the edges of the group', async () => {
      const buttons = buttonsOf(toolbar);
      const last = buttons.length - 1;
      buttons[2].focus();
      await waitFor(() => expect(document.activeElement).toBe(buttons[2]));
      key(buttons[2], 'End');
      await waitFor(() => expect(document.activeElement).toBe(buttons[last])); // End → last member
      await waitFor(() => expect(buttons[last].getAttribute('tabindex')).toBe('0'));
      key(buttons[last], 'Home');
      await waitFor(() => expect(document.activeElement).toBe(buttons[0]));     // Home → first member
      await waitFor(() => expect(buttons[0].getAttribute('tabindex')).toBe('0'));
    });

    await step('setFocus() returns focus to the remembered active control (public @Method)', async () => {
      const buttons = buttonsOf(toolbar);
      // Make buttons[2] the active stop, then blur so nothing is focused; setFocus must restore IT.
      buttons[2].focus();
      await waitFor(() => expect(document.activeElement).toBe(buttons[2]));
      (document.activeElement as HTMLElement).blur();
      await waitFor(() => expect(document.activeElement).not.toBe(buttons[2]));
      await (toolbar as unknown as { setFocus: () => Promise<void> }).setFocus();
      await waitFor(() => expect(document.activeElement).toBe(buttons[2])); // the remembered stop
    });

    await step('Runtime toolbar→generic tears down md-* roving; →toolbar re-roves (group path)', async () => {
      const buttons = buttonsOf(toolbar);
      toolbar.setAttribute('container-semantics', 'generic');
      // role drops AND the roving stamp is undone: each md-icon-button has its cooperative
      // groupTabindex reset to null, so every one renders its natural tabindex="0" — no lone
      // Tab stop survives in a generic (non-roving) container.
      await waitFor(() => expect(toolbar.getAttribute('role')).toBe(null));
      await waitFor(() =>
        expect(buttons.filter((b) => b.getAttribute('tabindex') === '0').length).toBe(buttons.length),
      );
      // Back to toolbar: roving re-collapses the group to a single Tab stop again.
      toolbar.setAttribute('container-semantics', 'toolbar');
      await waitFor(() => expect(toolbar.getAttribute('role')).toBe('toolbar'));
      await waitFor(() =>
        expect(buttons.filter((b) => b.getAttribute('tabindex') === '0').length).toBe(1),
      );
    });
  },
};

/* ==========================================================
   Docked Configurations — matches MD3 spec exactly
   Config 1: Default (start-aligned, 32px gap, 16px margins)
   Config 2: Leading/trailing with Fill (space-between)
   Config 3: Back / Next (space-between)
   Config 4: Center-aligned mixed controls (8px gap)
   ========================================================== */

export const DockedConfigurations: Story = {
  render: (_args, { globals }) => html`
    <div style="display: flex; flex-direction: column; gap: 32px; max-width: 420px; font-family: Roboto, sans-serif;">

      <div>
        <p style="margin: 0 0 8px; font-size: 13px; font-weight: 500; color: var(--md-sys-color-on-surface-variant, #49454F);">
          1 &nbsp;Default margins and padding (start-aligned, 32px gap)
        </p>
        <div style="border: 1px solid var(--md-sys-color-outline-variant, #CAC4D0); border-radius: 16px; overflow: hidden; height: 140px; position: relative;">
          <md-toolbar aria-label="Default layout">
            <md-icon-button icon="download" aria-label="Download"></md-icon-button>
            <md-icon-button icon="delete" aria-label="Delete"></md-icon-button>
            <md-icon-button icon="mail" aria-label="Mail"></md-icon-button>
            <md-icon-button icon="autorenew" aria-label="Refresh"></md-icon-button>
            <md-icon-button icon="star_outline" aria-label="Add to favorites"></md-icon-button>
          </md-toolbar>
        </div>
      </div>

      <div>
        <p style="margin: 0 0 8px; font-size: 13px; font-weight: 500; color: var(--md-sys-color-on-surface-variant, #49454F);">
          2 &nbsp;Margins and padding with leading, middle, and trailing content (Fill)
        </p>
        <div style="border: 1px solid var(--md-sys-color-outline-variant, #CAC4D0); border-radius: 16px; overflow: hidden; height: 140px; position: relative;">
          <md-toolbar alignment="space-between" aria-label="Leading and trailing layout">
            <md-icon-button icon="download" aria-label="Download"></md-icon-button>
            <md-icon-button icon="delete" aria-label="Delete"></md-icon-button>
            <md-icon-button icon="mail" aria-label="Mail"></md-icon-button>
            <md-icon-button icon="star_outline" aria-label="Add to favorites"></md-icon-button>
          </md-toolbar>
        </div>
      </div>

      <div>
        <p style="margin: 0 0 8px; font-size: 13px; font-weight: 500; color: var(--md-sys-color-on-surface-variant, #49454F);">
          1 &nbsp;Left and right alignment (Back / Next)
        </p>
        <div style="border: 1px solid var(--md-sys-color-outline-variant, #CAC4D0); border-radius: 16px; overflow: hidden; height: 140px; position: relative;">
          <md-toolbar alignment="space-between" aria-label="Navigation">
            <md-button slot="leading" variant="text">${t(globals.locale, 'back')}</md-button>
            <md-button slot="trailing" variant="filled">${t(globals.locale, 'next')}</md-button>
          </md-toolbar>
        </div>
      </div>

      <div>
        <p style="margin: 0 0 8px; font-size: 13px; font-weight: 500; color: var(--md-sys-color-on-surface-variant, #49454F);">
          2 &nbsp;Center-aligned, 8px padding between items
        </p>
        <div style="border: 1px solid var(--md-sys-color-outline-variant, #CAC4D0); border-radius: 16px; overflow: hidden; height: 140px; position: relative;">
          <md-toolbar alignment="center" aria-label="Center actions">
            <md-button variant="filled" icon="videocam">${t(globals.locale, 'toolbar.yes')}</md-button>
            <md-icon-button icon="expand_more" aria-label="More options"></md-icon-button>
            <md-button variant="outlined">${t(globals.locale, 'next')}</md-button>
            <md-button variant="outlined">${t(globals.locale, 'toolbar.maybe')}</md-button>
            <md-icon-button icon="expand_more" aria-label="More options"></md-icon-button>
          </md-toolbar>
        </div>
      </div>

    </div>
  `,
};

/* ==========================================================
   Docked — with FAB
   ========================================================== */

export const DockedWithFAB: Story = {
  render: () => html`
    <div style="position: relative; height: 200px; border: 1px solid var(--md-sys-color-outline-variant, #ccc); border-radius: 12px; overflow: hidden;">
      <div style="padding: 24px; font-family: Roboto, sans-serif; color: var(--md-sys-color-on-surface, #1C1B1F);">
        <p>Docked toolbar with paired FAB, anchored to the bottom.</p>
      </div>
      <md-toolbar aria-label="Primary actions">
        <md-icon-button icon="search" aria-label="Search"></md-icon-button>
        <md-icon-button icon="delete" aria-label="Delete"></md-icon-button>
        <md-icon-button icon="archive" aria-label="Archive"></md-icon-button>
        <md-icon-button icon="bookmark" aria-label="Bookmark"></md-icon-button>
        <md-fab slot="fab" icon="add" aria-label="Create new"></md-fab>
      </md-toolbar>
    </div>
  `,
};

/* ==========================================================
   Docked — vibrant
   ========================================================== */

export const DockedVibrant: Story = {
  render: () => html`
    <div style="position: relative; height: 200px; border: 1px solid var(--md-sys-color-outline-variant, #ccc); border-radius: 12px; overflow: hidden;">
      <div style="padding: 24px; font-family: Roboto, sans-serif; color: var(--md-sys-color-on-surface, #1C1B1F);">
        <p>Vibrant docked toolbar with primary container background.</p>
      </div>
      <md-toolbar color="vibrant" aria-label="Vibrant actions">
        <md-icon-button icon="favorite" aria-label="Favorite"></md-icon-button>
        <md-icon-button icon="share" aria-label="Share"></md-icon-button>
        <md-icon-button icon="comment" aria-label="Comment"></md-icon-button>
        <md-fab slot="fab" icon="edit" aria-label="Edit"></md-fab>
      </md-toolbar>
    </div>
  `,
};

/* ==========================================================
   All color schemes
   ========================================================== */

export const ColorSchemes: Story = {
  render: () => html`
    <div style="display: flex; flex-direction: column; gap: 24px;">
      <div>
        <p style="font-family: Roboto, sans-serif; margin: 0 0 8px; font-size: 14px; color: var(--md-sys-color-on-surface-variant, #49454F);">Standard</p>
        <md-toolbar variant="floating" aria-label="Standard">
          <md-icon-button icon="format_bold" aria-label="Bold"></md-icon-button>
          <md-icon-button icon="format_italic" aria-label="Italic"></md-icon-button>
          <md-icon-button icon="format_underlined" aria-label="Underline"></md-icon-button>
          <md-icon-button icon="format_list_bulleted" aria-label="Bulleted list"></md-icon-button>
        </md-toolbar>
      </div>
      <div>
        <p style="font-family: Roboto, sans-serif; margin: 0 0 8px; font-size: 14px; color: var(--md-sys-color-on-surface-variant, #49454F);">Vibrant</p>
        <md-toolbar variant="floating" color="vibrant" aria-label="Vibrant">
          <md-icon-button icon="format_bold" aria-label="Bold"></md-icon-button>
          <md-icon-button icon="format_italic" aria-label="Italic"></md-icon-button>
          <md-icon-button icon="format_underlined" aria-label="Underline"></md-icon-button>
          <md-icon-button icon="format_list_bulleted" aria-label="Bulleted list"></md-icon-button>
        </md-toolbar>
      </div>
    </div>
  `,
};

/* ==========================================================
   Icon button types × color scheme (MD3 token mapping)
   ========================================================== */

export const IconButtonTypes: Story = {
  render: () => html`
    <div style="display: flex; flex-direction: column; gap: 32px; font-family: Roboto, sans-serif;">
      <p style="margin: 0; font-size: 12px; color: var(--md-sys-color-on-surface-variant, #49454F); max-width: 640px;">
        Token pairs below are <strong>toolbar-only</strong> (applied by <code>md-toolbar</code> to slotted <code>md-icon-button</code>). The same icon buttons outside a toolbar use default icon-button colors.
      </p>
      <div>
        <p style="margin: 0 0 12px; font-size: 14px; font-weight: 500; color: var(--md-sys-color-on-surface-variant, #49454F);">
          Standard — surface container bar; standard = on-surface-variant; filled = primary/on-primary; tonal toggle on = secondary container/on-secondary-container
        </p>
        <md-toolbar variant="floating" color="standard" aria-label="Standard icon types">
          <md-icon-button icon="format_bold" aria-label="Standard"></md-icon-button>
          <md-icon-button variant="filled" icon="star" aria-label="Filled"></md-icon-button>
          <md-icon-button variant="tonal" toggle selected icon="format_italic" aria-label="Tonal toggle on"></md-icon-button>
        </md-toolbar>
      </div>
      <div>
        <p style="margin: 0 0 12px; font-size: 14px; font-weight: 500; color: var(--md-sys-color-on-surface-variant, #49454F);">
          Vibrant — primary container bar; standard = on-surface; filled = primary/on-primary; tonal toggle = surface-container/on-surface
        </p>
        <md-toolbar variant="floating" color="vibrant" aria-label="Vibrant icon types">
          <md-icon-button icon="format_bold" aria-label="Standard"></md-icon-button>
          <md-icon-button variant="filled" icon="star" aria-label="Filled"></md-icon-button>
          <md-icon-button variant="tonal" toggle selected icon="format_italic" aria-label="Tonal toggle on"></md-icon-button>
        </md-toolbar>
      </div>
    </div>
  `,
};

/* ==========================================================
   Floating horizontal
   ========================================================== */

export const FloatingHorizontal: Story = {
  render: () => html`
    <md-toolbar variant="floating" aria-label="Text formatting">
      <md-icon-button icon="format_bold" aria-label="Bold"></md-icon-button>
      <md-icon-button icon="format_italic" aria-label="Italic"></md-icon-button>
      <md-icon-button icon="format_underlined" aria-label="Underline"></md-icon-button>
      <md-icon-button icon="format_strikethrough" aria-label="Strikethrough"></md-icon-button>
      <md-icon-button icon="format_color_text" aria-label="Text color"></md-icon-button>
      <md-icon-button icon="link" aria-label="Insert link"></md-icon-button>
    </md-toolbar>
  `,
};

/* ==========================================================
   Floating vertical
   ========================================================== */

export const FloatingVertical: Story = {
  render: () => html`
    <md-toolbar variant="floating" layout="vertical" aria-label="Drawing tools">
      <md-icon-button icon="brush" aria-label="Brush"></md-icon-button>
      <md-icon-button icon="edit" aria-label="Edit"></md-icon-button>
      <md-icon-button icon="palette" aria-label="Palette"></md-icon-button>
      <md-icon-button icon="crop" aria-label="Crop"></md-icon-button>
      <md-icon-button icon="straighten" aria-label="Straighten"></md-icon-button>
    </md-toolbar>
  `,
  /** A floating+vertical toolbar swaps the nav axis: ArrowUp/Down rove (not Left/Right). */
  play: async ({ canvasElement, step }) => {
    const toolbar = await getToolbar(canvasElement);
    const buttons = buttonsOf(toolbar);

    await step('ArrowDown / ArrowUp rove along the vertical column', async () => {
      buttons[0].focus();
      await waitFor(() => expect(document.activeElement).toBe(buttons[0]));
      key(buttons[0], 'ArrowDown');
      await waitFor(() => expect(document.activeElement).toBe(buttons[1])); // down = next
      await waitFor(() => expect(buttons[1].getAttribute('tabindex')).toBe('0'));
      await waitFor(() => expect(buttons[0].getAttribute('tabindex')).toBe('-1'));
      key(buttons[1], 'ArrowUp');
      await waitFor(() => expect(document.activeElement).toBe(buttons[0])); // up = previous
      await waitFor(() => expect(buttons[0].getAttribute('tabindex')).toBe('0'));
    });

    await step('Off-axis ArrowRight is ignored on a vertical toolbar (guard)', async () => {
      buttons[0].focus();
      await waitFor(() => expect(document.activeElement).toBe(buttons[0]));
      key(buttons[0], 'ArrowRight'); // horizontal key on a vertical bar — off-axis, no-op
      expect(document.activeElement).toBe(buttons[0]); // focus stays put
    });
  },
};

/* ==========================================================
   Floating with FAB
   ========================================================== */

export const FloatingWithFAB: Story = {
  render: () => html`
    <md-toolbar variant="floating" color="vibrant" aria-label="Actions">
      <md-icon-button icon="search" aria-label="Search"></md-icon-button>
      <md-icon-button icon="favorite" aria-label="Favorite"></md-icon-button>
      <md-icon-button icon="share" aria-label="Share"></md-icon-button>
      <md-fab slot="fab" icon="add" aria-label="Add"></md-fab>
    </md-toolbar>
  `,
};

/* ==========================================================
   Floating Configurations
   ========================================================== */

export const FloatingConfigurations: Story = {
  render: () => html`
    <div style="display: flex; flex-direction: column; gap: 32px; font-family: Roboto, sans-serif;">
      <div>
        <p style="margin: 0 0 8px; font-size: 13px; font-weight: 500; color: var(--md-sys-color-on-surface-variant, #49454F);">
          Default floating — pill shape, 8px padding, 4px gap
        </p>
        <md-toolbar variant="floating" aria-label="Quick actions">
          <md-icon-button icon="check_box" aria-label="Checkbox"></md-icon-button>
          <md-icon-button icon="edit" aria-label="Edit"></md-icon-button>
          <md-icon-button icon="mic" aria-label="Microphone"></md-icon-button>
          <md-icon-button icon="image" aria-label="Image"></md-icon-button>
        </md-toolbar>
      </div>
      <div>
        <p style="margin: 0 0 8px; font-size: 13px; font-weight: 500; color: var(--md-sys-color-on-surface-variant, #49454F);">
          Floating with separate FAB (56px height, 8px gap)
        </p>
        <md-toolbar variant="floating" aria-label="Actions with FAB">
          <md-icon-button icon="check_box" aria-label="Checkbox"></md-icon-button>
          <md-icon-button icon="edit" aria-label="Edit"></md-icon-button>
          <md-icon-button icon="mic" aria-label="Microphone"></md-icon-button>
          <md-icon-button icon="image" aria-label="Image"></md-icon-button>
          <md-fab slot="fab" icon="add" aria-label="Add"></md-fab>
        </md-toolbar>
      </div>
      <div>
        <p style="margin: 0 0 8px; font-size: 13px; font-weight: 500; color: var(--md-sys-color-on-surface-variant, #49454F);">
          Floating in context — 16px minimum margins, text formatting
        </p>
        <div style="max-width: 400px; border: 1px solid var(--md-sys-color-outline-variant, #CAC4D0); border-radius: 16px; overflow: hidden; position: relative; height: 240px;">
          <div style="padding: 16px; font-size: 14px; color: var(--md-sys-color-on-surface, #1C1B1F);">
            Content area — the floating toolbar sits above with 16px margins on each side.
          </div>
          <div style="position: absolute; inset-block-end: 40px; inset-inline: 0; display: flex; justify-content: center;">
            <md-toolbar variant="floating" aria-label="Text formatting">
              <md-icon-button icon="format_bold" aria-label="Bold"></md-icon-button>
              <md-icon-button icon="format_italic" aria-label="Italic"></md-icon-button>
              <md-icon-button icon="format_underlined" aria-label="Underline"></md-icon-button>
              <md-icon-button icon="format_color_text" aria-label="Text color"></md-icon-button>
              <md-icon-button icon="format_color_fill" aria-label="Fill color"></md-icon-button>
              <md-icon-button icon="more_vert" aria-label="More options"></md-icon-button>
            </md-toolbar>
          </div>
        </div>
      </div>
    </div>
  `,
};

/* ==========================================================
   Mixed content
   ========================================================== */

export const MixedContent: Story = {
  render: (_args, { globals }) => html`
    <div style="display: flex; flex-direction: column; gap: 24px;">
      <div>
        <p style="font-family: Roboto, sans-serif; margin: 0 0 8px; font-size: 14px; color: var(--md-sys-color-on-surface-variant, #49454F);">Icon buttons + text button</p>
        <md-toolbar variant="floating" aria-label="Actions">
          <md-icon-button icon="undo" aria-label="Undo"></md-icon-button>
          <md-icon-button icon="redo" aria-label="Redo"></md-icon-button>
          <md-button variant="filled">${t(globals.locale, 'save')}</md-button>
        </md-toolbar>
      </div>
      <div>
        <p style="font-family: Roboto, sans-serif; margin: 0 0 8px; font-size: 14px; color: var(--md-sys-color-on-surface-variant, #49454F);">Multiple buttons</p>
        <md-toolbar variant="floating" aria-label="Quick actions">
          <md-button variant="tonal">${t(globals.locale, 'toolbar.cut')}</md-button>
          <md-button variant="tonal">${t(globals.locale, 'toolbar.copy')}</md-button>
          <md-button variant="tonal">${t(globals.locale, 'toolbar.paste')}</md-button>
        </md-toolbar>
      </div>
    </div>
  `,
};

/* ==========================================================
   RTL
   ========================================================== */

export const RTL: Story = {
  render: () => html`
    <div dir="rtl">
      <md-toolbar aria-label="الإجراءات">
        <md-icon-button icon="search" aria-label="بحث"></md-icon-button>
        <md-icon-button icon="delete" aria-label="حذف"></md-icon-button>
        <md-icon-button icon="archive" aria-label="أرشفة"></md-icon-button>
        <md-fab slot="fab" icon="add" aria-label="إضافة"></md-fab>
      </md-toolbar>
    </div>
  `,
  /** In an RTL toolbar the horizontal arrow axis flips: ArrowLeft advances to the next
   *  member (visually leftward = logically forward), ArrowRight goes back. */
  play: async ({ canvasElement, step }) => {
    const toolbar = await getToolbar(canvasElement);
    const buttons = buttonsOf(toolbar);

    await step('RTL inverts the arrow axis: ArrowLeft moves forward, ArrowRight moves back', async () => {
      buttons[0].focus();
      await waitFor(() => expect(document.activeElement).toBe(buttons[0]));
      key(buttons[0], 'ArrowLeft'); // rtl → leftward is the NEXT member
      await waitFor(() => expect(document.activeElement).toBe(buttons[1]));
      await waitFor(() => expect(buttons[1].getAttribute('tabindex')).toBe('0')); // the Tab stop rode forward
      await waitFor(() => expect(buttons[0].getAttribute('tabindex')).toBe('-1'));
      key(buttons[1], 'ArrowRight'); // rtl → rightward is the PREVIOUS member
      await waitFor(() => expect(document.activeElement).toBe(buttons[0]));
      await waitFor(() => expect(buttons[0].getAttribute('tabindex')).toBe('0'));
    });
  },
};

/* ==========================================================
   Dark Theme
   ========================================================== */

export const DarkTheme: Story = {
  render: () => html`
    <div data-theme="dark" style="background: var(--md-sys-color-surface, #1C1B1F); padding: 24px; border-radius: 16px;">
      <div style="display: flex; flex-direction: column; gap: 24px;">
        <md-toolbar variant="floating" aria-label="Standard dark">
          <md-icon-button icon="format_bold" aria-label="Bold"></md-icon-button>
          <md-icon-button icon="format_italic" aria-label="Italic"></md-icon-button>
          <md-icon-button icon="format_underlined" aria-label="Underline"></md-icon-button>
        </md-toolbar>
        <md-toolbar variant="floating" color="vibrant" aria-label="Vibrant dark">
          <md-icon-button icon="search" aria-label="Search"></md-icon-button>
          <md-icon-button icon="favorite" aria-label="Favorite"></md-icon-button>
          <md-icon-button icon="share" aria-label="Share"></md-icon-button>
        </md-toolbar>
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

/* ==========================================================
   Custom CSS
   ========================================================== */

export const CustomCSS: Story = {
  render: () => html`
    <style>
      .brand-toolbar {
        --md-toolbar-container-color: #6200ee;
        --md-toolbar-icon-color: #ffffff;
        --md-toolbar-container-shape: 28px;
      }
      .compact-toolbar {
        --md-toolbar-container-height: 48px;
        --md-toolbar-gap: 4px;
        --md-toolbar-padding: 12px;
      }
    </style>
    <div style="display: flex; flex-direction: column; gap: 24px;">
      <div>
        <p style="font-family: Roboto, sans-serif; margin: 0 0 8px; font-size: 14px; color: var(--md-sys-color-on-surface-variant, #49454F);">Brand color</p>
        <md-toolbar variant="floating" class="brand-toolbar" aria-label="Brand">
          <md-icon-button icon="format_bold" aria-label="Bold"></md-icon-button>
          <md-icon-button icon="format_italic" aria-label="Italic"></md-icon-button>
          <md-icon-button icon="link" aria-label="Insert link"></md-icon-button>
        </md-toolbar>
      </div>
      <div>
        <p style="font-family: Roboto, sans-serif; margin: 0 0 8px; font-size: 14px; color: var(--md-sys-color-on-surface-variant, #49454F);">Compact</p>
        <md-toolbar variant="floating" class="compact-toolbar" aria-label="Compact">
          <md-icon-button icon="undo" aria-label="Undo"></md-icon-button>
          <md-icon-button icon="redo" aria-label="Redo"></md-icon-button>
          <md-icon-button icon="format_bold" aria-label="Bold"></md-icon-button>
        </md-toolbar>
      </div>
    </div>
  `,
};

/* ==========================================================
   CSS Parts
   ========================================================== */

export const CSSParts: Story = {
  render: () => html`
    <style>
      .styled-parts::part(container) {
        gap: 16px;
      }
      .styled-parts::part(fab-container) {
        background: rgba(0,0,0,0.05);
        border-radius: 16px;
        padding: 4px;
      }
    </style>
    <md-toolbar variant="floating" class="styled-parts" aria-label="Styled parts">
      <md-icon-button icon="format_bold" aria-label="Bold"></md-icon-button>
      <md-icon-button icon="format_italic" aria-label="Italic"></md-icon-button>
      <md-icon-button icon="link" aria-label="Insert link"></md-icon-button>
      <md-fab slot="fab" icon="add" aria-label="Add"></md-fab>
    </md-toolbar>
  `,
};

/* ==========================================================
   Real-world: Text Editor Toolbar
   Uses contenteditable + document.execCommand. Mousedown default
   prevented on buttons so selection stays in the editor.
   ========================================================== */

export const TextEditor: Story = {
  render: () => {
    const preventToolbarFocusSteal = (e: Event) => {
      e.preventDefault();
    };

    const getEditor = (e: Event): HTMLElement | null => {
      const btn = e.currentTarget as HTMLElement;
      const shell = btn.closest('.editor-shell');
      return (shell?.querySelector('.editor-area') as HTMLElement) ?? null;
    };

    const applyExec = (command: string, value?: string) => (e: Event) => {
      const editor = getEditor(e);
      if (!editor) return;
      if (document.activeElement !== editor) {
        editor.focus();
      }
      try {
        document.execCommand(command, false, value);
      } catch {
        /* unsupported in some environments */
      }
      editor.focus();
    };

    const applyLink = (e: Event) => {
      const editor = getEditor(e);
      if (!editor) return;
      if (document.activeElement !== editor) {
        editor.focus();
      }
      const url = window.prompt('Link URL', 'https://');
      if (url) {
        try {
          document.execCommand('createLink', false, url);
        } catch {
          /* ignore */
        }
      }
      editor.focus();
    };

    const applyImage = (e: Event) => {
      const editor = getEditor(e);
      if (!editor) return;
      if (document.activeElement !== editor) {
        editor.focus();
      }
      const url = window.prompt('Image URL', 'https://');
      if (url) {
        try {
          document.execCommand('insertImage', false, url);
        } catch {
          /* ignore */
        }
      }
      editor.focus();
    };

    return html`
      <style>
        .editor-shell {
          max-width: 600px;
          border-radius: 16px;
          overflow: hidden;
          border: 1px solid var(--md-sys-color-outline-variant, #CAC4D0);
          font-family: Roboto, sans-serif;
        }
        .editor-area {
          min-height: 200px;
          padding: 16px;
          font-size: 14px;
          color: var(--md-sys-color-on-surface, #1c1b1f);
          outline: none;
          line-height: 1.5;
        }
        .editor-area:focus-visible {
          outline: 2px solid var(--md-sys-color-primary, #6750a4);
          outline-offset: 2px;
        }
        .editor-hint {
          margin: 0;
          padding: 8px 16px;
          font-size: 12px;
          color: var(--md-sys-color-on-surface-variant, #49454f);
          background: var(--md-sys-color-surface-container-low, #f7f2fa);
          border-block-end: 1px solid var(--md-sys-color-outline-variant, #cac4d0);
        }
        /* Full-width recipe: the floating pill hugs its content by default (MD3
           free-placed). Embedded edge-to-edge in the shell: host takes the full
           width (inline style), margins off, and the pill part grows to fill. */
        .editor-shell md-toolbar {
          margin: 0;
        }
        .editor-shell md-toolbar::part(container) {
          flex: 1;
        }
      </style>
      <div class="editor-shell">
        <p class="editor-hint" id="text-editor-toolbar-label">
          Select text in the area below, then use the toolbar: Tab through each control, or use arrow keys
          between buttons. Link and image ask for a URL.
        </p>
        <md-toolbar
          variant="floating"
          style="width: 100%; --md-toolbar-container-shape: 0;"
          aria-labelledby="text-editor-toolbar-label"
        >
          <md-icon-button
            icon="format_bold"
            aria-label="Bold"
            @mousedown=${preventToolbarFocusSteal}
            @click=${applyExec('bold')}
          ></md-icon-button>
          <md-icon-button
            icon="format_italic"
            aria-label="Italic"
            @mousedown=${preventToolbarFocusSteal}
            @click=${applyExec('italic')}
          ></md-icon-button>
          <md-icon-button
            icon="format_underlined"
            aria-label="Underline"
            @mousedown=${preventToolbarFocusSteal}
            @click=${applyExec('underline')}
          ></md-icon-button>
          <md-icon-button
            icon="format_strikethrough"
            aria-label="Strikethrough"
            @mousedown=${preventToolbarFocusSteal}
            @click=${applyExec('strikeThrough')}
          ></md-icon-button>
          <md-icon-button
            icon="format_list_bulleted"
            aria-label="Bulleted list"
            @mousedown=${preventToolbarFocusSteal}
            @click=${applyExec('insertUnorderedList')}
          ></md-icon-button>
          <md-icon-button
            icon="format_list_numbered"
            aria-label="Numbered list"
            @mousedown=${preventToolbarFocusSteal}
            @click=${applyExec('insertOrderedList')}
          ></md-icon-button>
          <md-icon-button
            icon="link"
            aria-label="Insert link"
            @mousedown=${preventToolbarFocusSteal}
            @click=${applyLink}
          ></md-icon-button>
          <md-icon-button
            icon="image"
            aria-label="Insert image"
            @mousedown=${preventToolbarFocusSteal}
            @click=${applyImage}
          ></md-icon-button>
          <md-icon-button
            icon="code"
            aria-label="Code block"
            @mousedown=${preventToolbarFocusSteal}
            @click=${applyExec('formatBlock', 'pre')}
          ></md-icon-button>
        </md-toolbar>
        <div
          class="editor-area"
          id="text-editor-demo-body"
          role="textbox"
          aria-multiline="true"
          aria-label="Rich text document"
          contenteditable="true"
          spellcheck="true"
        >
          Select this sample text and apply <strong>bold</strong>, lists, or a link from the toolbar above.
        </div>
      </div>
    `;
  },
};

/* ==========================================================
   Real-world: Drawing App Sidebar
   ========================================================== */

export const DrawingApp: Story = {
  render: () => html`
    <style>
      .canvas-shell {
        display: flex;
        gap: 16px;
        max-width: 600px;
      }
      .canvas-area {
        flex: 1;
        min-height: 300px;
        border-radius: 16px;
        background: var(--md-sys-color-surface-container, #F3EDF7);
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: Roboto, sans-serif;
        font-size: 14px;
        color: var(--md-sys-color-on-surface-variant, #49454F);
      }
    </style>
    <div class="canvas-shell">
      <md-toolbar variant="floating" layout="vertical" color="vibrant" aria-label="Drawing tools">
        <md-icon-button icon="brush" aria-label="Brush"></md-icon-button>
        <md-icon-button icon="edit" aria-label="Edit"></md-icon-button>
        <md-icon-button icon="format_color_fill" aria-label="Fill color"></md-icon-button>
        <md-icon-button icon="crop" aria-label="Crop"></md-icon-button>
        <md-icon-button icon="straighten" aria-label="Straighten"></md-icon-button>
        <md-icon-button icon="text_fields" aria-label="Text"></md-icon-button>
        <md-icon-button icon="undo" aria-label="Undo"></md-icon-button>
        <md-icon-button icon="redo" aria-label="Redo"></md-icon-button>
      </md-toolbar>
      <div class="canvas-area">Canvas area</div>
    </div>
  `,
};

/* ==========================================================
   Real-world: Email App Bottom Bar
   ========================================================== */

export const EmailApp: Story = {
  render: (_args, { globals }) => html`
    <style>
      .email-shell {
        position: relative;
        height: 320px;
        max-width: 400px;
        border-radius: 16px;
        overflow: hidden;
        border: 1px solid var(--md-sys-color-outline-variant, #CAC4D0);
        font-family: Roboto, sans-serif;
        display: flex;
        flex-direction: column;
      }
      .email-header {
        padding: 16px;
        font-size: 20px;
        font-weight: 500;
        color: var(--md-sys-color-on-surface, #1C1B1F);
        border-bottom: 1px solid var(--md-sys-color-outline-variant, #CAC4D0);
      }
      .email-list {
        flex: 1;
        overflow-y: auto;
      }
      .email-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 16px;
        border-bottom: 1px solid var(--md-sys-color-outline-variant, #CAC4D0);
      }
      .email-avatar {
        width: 40px; height: 40px; border-radius: 50%;
        background: var(--md-sys-color-primary-container, #EADDFF);
        color: var(--md-sys-color-on-primary-container, #21005D);
        display: flex; align-items: center; justify-content: center;
        font-size: 16px; font-weight: 500; flex-shrink: 0;
      }
      .email-preview { flex: 1; min-width: 0; }
      .email-preview strong { display: block; font-size: 14px; }
      .email-preview small { font-size: 12px; color: var(--md-sys-color-on-surface-variant, #49454F); }
    </style>
    <div class="email-shell">
      <div class="email-header">${t(globals.locale, 'toolbar.inbox')}</div>
      <div class="email-list">
        <div class="email-item">
          <div class="email-avatar">A</div>
          <div class="email-preview">
            <strong>Alice</strong>
            <small>${t(globals.locale, 'toolbar.emailMeeting')}</small>
          </div>
        </div>
        <div class="email-item">
          <div class="email-avatar">B</div>
          <div class="email-preview">
            <strong>Bob</strong>
            <small>${t(globals.locale, 'toolbar.emailReview')}</small>
          </div>
        </div>
        <div class="email-item">
          <div class="email-avatar">C</div>
          <div class="email-preview">
            <strong>Carol</strong>
            <small>${t(globals.locale, 'toolbar.emailLunch')}</small>
          </div>
        </div>
      </div>
      <md-toolbar alignment="space-between" aria-label="Mail actions">
        <md-icon-button icon="menu" aria-label="Open menu"></md-icon-button>
        <md-icon-button icon="search" aria-label="Search"></md-icon-button>
        <md-icon-button icon="person" aria-label="Account"></md-icon-button>
        <md-fab slot="fab" icon="edit" aria-label="Compose"></md-fab>
      </md-toolbar>
    </div>
  `,
};

/* ==========================================================
   Native + wrapper controls (attr-tabindex roving path)
   Exercises the roving code for controls that DON'T expose a
   cooperative `groupTabindex` (native button / a[href] /
   [tabindex]), plus wrapper descent and the runtime
   toolbar→generic teardown that restores original tabindex.
   ========================================================== */

/* ==========================================================
   Independent-only toolbar (empty roving group)
   A toolbar whose only control is a text field has ZERO roving
   members — updateRoving()/handleKeyDown must both no-op cleanly.
   ========================================================== */

/* ==========================================================
   Soft-disabled member (aria-disabled roving)
   A soft-disabled (aria-disabled, NOT hard-disabled) control stays a
   roving member: the default Tab stop prefers an ENABLED sibling, but
   arrows still reach the disabled one (WAI-ARIA APG discoverability).
   ========================================================== */
