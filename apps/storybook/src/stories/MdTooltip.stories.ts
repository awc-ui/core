import type { Meta, StoryObj } from '@storybook/web-components';
import { expect, waitFor } from 'storybook/test';
import { html } from 'lit';
import { t } from '../i18n';
import '@awc-ui/core/define';

/** Shadow-piercing helpers for play(): testing-library queries can't cross shadow
 *  roots, so interactions address the popup inside the tooltip's shadow directly. */
type TooltipEl = HTMLElement & { text: string; open: boolean; disabled: boolean };
const getTooltip = async (canvasElement: HTMLElement): Promise<TooltipEl> => {
  const tip = canvasElement.querySelector('md-tooltip') as TooltipEl;
  await waitFor(() => expect(tip.classList.contains('hydrated')).toBe(true));
  return tip;
};
const popupOf = (tip: TooltipEl) =>
  tip.shadowRoot!.querySelector('[part="popup"]') as HTMLElement;

const meta: Meta = {
  title: 'Communication/Tooltip',
  component: 'md-tooltip',
  tags: ['autodocs'],
  parameters: {
    docs: { source: { language: 'html' } },
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['plain', 'rich'],
      description: 'Visual style variant',
    },
    text: { control: 'text', description: 'Tooltip text content' },
    subhead: { control: 'text', description: 'Rich tooltip subhead' },
    position: {
      control: 'select',
      options: [
        'top', 'top-start', 'top-end',
        'bottom', 'bottom-start', 'bottom-end',
        'left', 'left-start', 'left-end',
        'right', 'right-start', 'right-end',
      ],
      description: 'Placement relative to trigger',
    },
    offset: { control: 'number', description: 'Distance from trigger (px)' },
    crossOffset: { control: 'number', description: 'Cross-axis offset (px)' },
    autoPosition: { control: 'boolean', description: 'Auto-reposition on overflow' },
    showDelay: { control: 'number', description: 'Show delay (ms)' },
    hideDelay: { control: 'number', description: 'Hide delay (ms)' },
  },
  args: {
    variant: 'plain',
    text: 'Tooltip text',
    subhead: '',
    position: 'top',
    offset: 8,
    crossOffset: 0,
    autoPosition: true,
    showDelay: 500,
    hideDelay: 200,
  },
};
export default meta;
type Story = StoryObj;

/* ─── Playground ───────────────────────────────────────── */

export const Playground: Story = {
  render: (args) => html`
    <div style="padding: 120px; display: flex; justify-content: center;">
      <md-tooltip
        variant=${args.variant}
        text=${args.text}
        subhead=${args.subhead}
        position=${args.position}
        offset=${args.offset}
        cross-offset=${args.crossOffset}
        ?auto-position=${args.autoPosition}
        show-delay=${args.showDelay}
        hide-delay=${args.hideDelay}
      >
        <md-button variant="filled">Hover me</md-button>
      </md-tooltip>
    </div>
  `,
  /** Focus (not hover — hover is non-deterministic headless) drives the open
   *  transition, then Escape guards dismissal. See the Interactions panel. */
  play: async ({ canvasElement, step }) => {
    const tip = await getTooltip(canvasElement);
    const trigger = tip.querySelector('md-button') as HTMLElement;
    const popup = popupOf(tip);

    await step('aria-description mirrors the tooltip text onto the anchor', async () => {
      // Cross-shadow aria wiring: the trigger is announced with the tooltip copy via
      // aria-description (aria-describedby IDREFs can't cross the shadow boundary).
      // RECEIVED side is a live DOM read; EXPECTED is the component's live text prop.
      await waitFor(() => expect(trigger.getAttribute('aria-description')).toBe(tip.text));
      expect(popup.getAttribute('role')).toBe('tooltip');
      expect(popup.getAttribute('aria-hidden')).toBe('true'); // starts closed
    });

    await step('Focusing the anchor reveals the tooltip (mdOpen fires)', async () => {
      // Capture the closed pre-state so the assertions below prove a real transition.
      expect(popup.classList.contains('md-tooltip__popup--visible')).toBe(false);
      let opened = false;
      tip.addEventListener('mdOpen', () => { opened = true; }, { once: true });

      trigger.dispatchEvent(new FocusEvent('focus'));

      // show-delay (500ms) then a rAF positions it; reflected aria lands next flush.
      await waitFor(
        () => expect(popup.getAttribute('aria-hidden')).toBe('false'),
        { timeout: 2000 },
      );
      expect(opened).toBe(true); // the component emitted, not just mutated its DOM
      expect(popup.classList.contains('md-tooltip__popup--visible')).toBe(true);
    });

    await step('Escape dismisses it — guard: mdClose fires and it hides', async () => {
      let closed = false;
      tip.addEventListener('mdClose', () => { closed = true; }, { once: true });

      // The global Escape handler is a capturing document keydown listener.
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }),
      );

      await waitFor(() => expect(popup.getAttribute('aria-hidden')).toBe('true'));
      expect(closed).toBe(true);
      expect(popup.classList.contains('md-tooltip__popup--visible')).toBe(false);
      // Let the popup's exit settle so teardown doesn't race the close.
      await new Promise((r) => setTimeout(r, 300));
    });

    await step('show() / hide() @Methods drive the open state programmatically', async () => {
      // suppressed=true after the Escape above; show() bypasses hover suppression by
      // flipping `open` directly, so this proves the public method — not just hover.
      let opened = false;
      tip.addEventListener('mdOpen', () => { opened = true; }, { once: true });
      await (tip as unknown as { show(): Promise<void> }).show();
      await waitFor(() => expect(tip.open).toBe(true));
      await waitFor(() => expect(popup.classList.contains('md-tooltip__popup--visible')).toBe(true));
      expect(opened).toBe(true);

      let closed = false;
      tip.addEventListener('mdClose', () => { closed = true; }, { once: true });
      await (tip as unknown as { hide(): Promise<void> }).hide();
      await waitFor(() => expect(tip.open).toBe(false));
      await waitFor(() => expect(popup.classList.contains('md-tooltip__popup--visible')).toBe(false));
      expect(closed).toBe(true);
    });

    await step('disabled dismisses an open tooltip, blocks show(), and drops aria-description', async () => {
      await (tip as unknown as { show(): Promise<void> }).show();
      await waitFor(() => expect(tip.open).toBe(true));

      // The disabled watcher: clears timers, forces open=false, strips aria-description.
      tip.disabled = true;
      await waitFor(() => expect(tip.open).toBe(false));
      await waitFor(() => expect(popup.classList.contains('md-tooltip__popup--visible')).toBe(false));
      expect(trigger.hasAttribute('aria-description')).toBe(false);

      // show() must be a no-op while disabled (never desync open=true with nothing shown).
      await (tip as unknown as { show(): Promise<void> }).show();
      await new Promise((r) => setTimeout(r, 60));
      expect(tip.open).toBe(false);

      // Re-enabling restores the mirrored description onto the trigger.
      tip.disabled = false;
      await waitFor(() => expect(trigger.getAttribute('aria-description')).toBe(tip.text));
    });

    await step('pointer hover opens (scheduleShow) then leaving arms the hide (scheduleHide)', async () => {
      // A pointer leave clears any lingering Escape suppression so a fresh hover re-shows.
      trigger.dispatchEvent(new MouseEvent('mouseleave'));
      trigger.dispatchEvent(new MouseEvent('mouseenter'));
      await waitFor(() => expect(tip.open).toBe(true), { timeout: 2000 });

      trigger.dispatchEvent(new MouseEvent('mouseleave'));
      await waitFor(() => expect(tip.open).toBe(false), { timeout: 2000 });
    });

    await step('pointer onto the popup keeps it open (hoverable), leaving it hides', async () => {
      await (tip as unknown as { show(): Promise<void> }).show();
      await waitFor(() => expect(tip.open).toBe(true));

      // Arm a hide via trigger-leave, then move onto the popup — handlePopupEnter
      // clears the pending hide so the tooltip survives the gap (WCAG 1.4.13).
      trigger.dispatchEvent(new MouseEvent('mouseleave'));
      popup.dispatchEvent(new MouseEvent('mouseenter'));
      await new Promise((r) => setTimeout(r, 350));
      expect(tip.open).toBe(true);

      // Leaving the popup arms the hide again (handlePopupLeave -> scheduleHide).
      popup.dispatchEvent(new MouseEvent('mouseleave'));
      await waitFor(() => expect(tip.open).toBe(false), { timeout: 2000 });
    });

    await step('blur away from the trigger arms the hide (handleTriggerBlur)', async () => {
      await (tip as unknown as { show(): Promise<void> }).show();
      await waitFor(() => expect(tip.open).toBe(true));

      // relatedTarget null → focus is not moving into the popup → the tooltip hides.
      trigger.dispatchEvent(new FocusEvent('blur'));
      await waitFor(() => expect(tip.open).toBe(false), { timeout: 2000 });
      await new Promise((r) => setTimeout(r, 200));
    });
  },
};

/* ─── Plain Tooltips ───────────────────────────────────── */

export const PlainTooltips: Story = {
  render: (_args, { globals }) => html`
    <div style="padding: 80px; display: flex; gap: 32px; flex-wrap: wrap; justify-content: center; align-items: center;">
      <md-tooltip text=${t(globals.locale, 'save')} position="top">
        <md-icon-button icon="save" aria-label="Save"></md-icon-button>
      </md-tooltip>
      <md-tooltip text=${t(globals.locale, 'delete')} position="bottom">
        <md-icon-button icon="delete" aria-label="Delete"></md-icon-button>
      </md-tooltip>
      <md-tooltip text=${t(globals.locale, 'edit')} position="left">
        <md-icon-button icon="edit" aria-label="Edit"></md-icon-button>
      </md-tooltip>
      <md-tooltip text=${t(globals.locale, 'tooltip.share')} position="right">
        <md-icon-button icon="share" aria-label="Share"></md-icon-button>
      </md-tooltip>
      <md-tooltip text=${t(globals.locale, 'tooltip.favoriteThisItem')} position="top">
        <md-icon-button icon="favorite" aria-label="Favorite"></md-icon-button>
      </md-tooltip>
    </div>
  `,
};

/* ─── All Placements ───────────────────────────────────── */

export const AllPlacements: Story = {
  render: () => {
    const placements = [
      'top', 'top-start', 'top-end',
      'bottom', 'bottom-start', 'bottom-end',
      'left', 'left-start', 'left-end',
      'right', 'right-start', 'right-end',
    ];
    return html`
      <div style="padding: 120px 80px; display: flex; gap: 24px; flex-wrap: wrap; justify-content: center; align-items: center;">
        ${placements.map(p => html`
          <md-tooltip text=${`Position: ${p}`} position=${p} show-delay="200">
            <md-button variant="outlined" style="min-width: 120px;">${p}</md-button>
          </md-tooltip>
        `)}
      </div>
    `;
  },
  /** Open every placement so updatePosition/calcCoords runs for each side (top/bottom
   *  centered + start/end, and left/right which also exercise the cross-axis clamp). */
  play: async ({ canvasElement }) => {
    const tips = Array.from(canvasElement.querySelectorAll('md-tooltip')) as TooltipEl[];
    await waitFor(() => expect(tips.every((tp) => tp.classList.contains('hydrated'))).toBe(true));

    // Focusing each trigger opens its tooltip (synthetic focus doesn't move real focus,
    // so opening one can't blur another) — all 12 placements position in parallel.
    tips.forEach((tp) => (tp.querySelector('md-button') as HTMLElement).dispatchEvent(new FocusEvent('focus')));

    // Every popup becomes visible AND receives inline fixed coords — proof that
    // updatePosition (calcCoords + toFixedCoords) actually ran for its placement.
    await waitFor(() => {
      tips.forEach((tp) => {
        const popup = popupOf(tp);
        expect(popup.classList.contains('md-tooltip__popup--visible')).toBe(true);
        expect(popup.style.top).not.toBe('');
        expect(popup.style.left).not.toBe('');
      });
    }, { timeout: 3000 });

    // The resolved-placement modifier class names one of the four physical sides.
    tips.forEach((tp) => {
      const popup = popupOf(tp);
      const hasPlacementClass = Array.from(popup.classList).some(
        (c) => /^md-tooltip__popup--(top|bottom|left|right)/.test(c),
      );
      expect(hasPlacementClass).toBe(true);
    });

    // One Escape dismisses them all — each visible tooltip has its own capturing
    // document keydown handler.
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }));
    await waitFor(() => expect(tips.every((tp) => !tp.open)).toBe(true), { timeout: 2000 });
    await new Promise((r) => setTimeout(r, 200));
  },
};

/* ─── Rich Tooltip ─────────────────────────────────────── */

export const RichTooltip: Story = {
  render: (_args, { globals }) => html`
    <div style="padding: 120px; display: flex; justify-content: center;">
      <md-tooltip
        variant="rich"
        subhead=${t(globals.locale, 'tooltip.grantCameraAccess')}
        text=${t(globals.locale, 'tooltip.cameraAccessBody')}
        position="bottom"
      >
        <md-icon-button icon="videocam" aria-label="Camera access"></md-icon-button>
      </md-tooltip>
    </div>
  `,
  play: async ({ canvasElement }) => {
    const tip = await getTooltip(canvasElement);
    const popup = popupOf(tip);

    // Open the rich variant (renders subhead + supporting text + actions region).
    await (tip as unknown as { show(): Promise<void> }).show();
    await waitFor(() => expect(popup.classList.contains('md-tooltip__popup--visible')).toBe(true));

    // Host-level focusout with focus leaving the tooltip closes it — handleHostFocusOut
    // covers focus escaping the trigger AND slotted rich-tooltip action buttons.
    tip.dispatchEvent(new FocusEvent('focusout', { relatedTarget: document.body }));
    await waitFor(() => expect(tip.open).toBe(false), { timeout: 2000 });
    await new Promise((r) => setTimeout(r, 200));
  },
};

/* ─── Rich Configurations ──────────────────────────────── */

export const RichConfigurations: Story = {
  render: (_args, { globals }) => html`
    <div style="padding: 120px 40px; display: flex; gap: 48px; flex-wrap: wrap; justify-content: center; align-items: center;">

      <!-- 1. Subhead + text + 2 buttons -->
      <md-tooltip
        variant="rich"
        subhead=${t(globals.locale, 'tooltip.autoSave')}
        text=${t(globals.locale, 'tooltip.autoSaveBody')}
        position="bottom"
      >
        <md-button variant="outlined">Subhead + text + 2 buttons</md-button>
        <div slot="actions">
          <md-button variant="text">${t(globals.locale, 'tooltip.learnMore')}</md-button>
          <md-button variant="text">${t(globals.locale, 'tooltip.gotIt')}</md-button>
        </div>
      </md-tooltip>

      <!-- 2. Subhead + text + 1 button -->
      <md-tooltip
        variant="rich"
        subhead=${t(globals.locale, 'tooltip.newFeature')}
        text=${t(globals.locale, 'tooltip.newFeatureBody')}
        position="bottom"
      >
        <md-button variant="outlined">Subhead + text + 1 button</md-button>
        <div slot="actions">
          <md-button variant="text">${t(globals.locale, 'tooltip.gotIt')}</md-button>
        </div>
      </md-tooltip>

      <!-- 3. Subhead + text only -->
      <md-tooltip
        variant="rich"
        subhead=${t(globals.locale, 'tooltip.keyboardShortcut')}
        text=${t(globals.locale, 'tooltip.ctrlSBody')}
        position="bottom"
      >
        <md-button variant="outlined">Subhead + text</md-button>
      </md-tooltip>

      <!-- 4. Text + 1 button -->
      <md-tooltip
        variant="rich"
        text=${t(globals.locale, 'tooltip.undoneBody')}
        position="bottom"
      >
        <md-button variant="outlined">Text + 1 button</md-button>
        <div slot="actions">
          <md-button variant="text">${t(globals.locale, 'tooltip.dismiss')}</md-button>
        </div>
      </md-tooltip>

      <!-- 5. Text + 2 buttons -->
      <md-tooltip
        variant="rich"
        text=${t(globals.locale, 'tooltip.enableNotificationsBody')}
        position="bottom"
      >
        <md-button variant="outlined">Text + 2 buttons</md-button>
        <div slot="actions">
          <md-button variant="text">${t(globals.locale, 'tooltip.notNow')}</md-button>
          <md-button variant="text">${t(globals.locale, 'tooltip.enable')}</md-button>
        </div>
      </md-tooltip>

    </div>
  `,
};

/* ─── Auto-Positioning ─────────────────────────────────── */

export const AutoPositioning: Story = {
  render: () => html`
    <div style="padding: 24px; display: flex; flex-direction: column; gap: 16px;">
      <p style="font-family: Roboto, sans-serif; color: var(--md-sys-color-on-surface-variant, #49454F); margin: 0;">
        These tooltips prefer "top" placement but will auto-flip when near viewport edges.
      </p>
      <div style="display: flex; gap: 16px; justify-content: space-between;">
        <md-tooltip text="Auto-positioned tooltip" position="top" auto-position show-delay="200">
          <md-button variant="tonal">Top-left area</md-button>
        </md-tooltip>
        <md-tooltip text="Auto-positioned tooltip" position="top" auto-position show-delay="200">
          <md-button variant="tonal">Top-right area</md-button>
        </md-tooltip>
      </div>
      <div style="height: 300px;"></div>
      <div style="display: flex; gap: 16px; justify-content: space-between;">
        <md-tooltip text="Auto-positioned tooltip" position="bottom" auto-position show-delay="200">
          <md-button variant="tonal">Bottom-left area</md-button>
        </md-tooltip>
        <md-tooltip text="Auto-positioned tooltip" position="bottom" auto-position show-delay="200">
          <md-button variant="tonal">Bottom-right area</md-button>
        </md-tooltip>
      </div>
    </div>
  `,
};

/* ─── Offsets ──────────────────────────────────────────── */

export const Offsets: Story = {
  render: () => html`
    <div style="padding: 120px; display: flex; gap: 48px; flex-wrap: wrap; justify-content: center; align-items: center;">
      <md-tooltip text="Default offset (8px)" position="top" show-delay="200">
        <md-button variant="outlined">offset=8 (default)</md-button>
      </md-tooltip>
      <md-tooltip text="Large offset (24px)" position="top" offset="24" show-delay="200">
        <md-button variant="outlined">offset=24</md-button>
      </md-tooltip>
      <md-tooltip text="Zero offset" position="top" offset="0" show-delay="200">
        <md-button variant="outlined">offset=0</md-button>
      </md-tooltip>
      <md-tooltip text="Cross offset (20px)" position="top" cross-offset="20" show-delay="200">
        <md-button variant="outlined">cross-offset=20</md-button>
      </md-tooltip>
    </div>
  `,
};

/* ─── RTL ──────────────────────────────────────────────── */

export const RTL: Story = {
  render: () => html`
    <div dir="rtl" style="padding: 120px; display: flex; gap: 48px; flex-wrap: wrap; justify-content: center; align-items: center;">
      <md-tooltip text="يمين" position="right" show-delay="200">
        <md-button variant="filled">Right (RTL)</md-button>
      </md-tooltip>
      <md-tooltip text="يسار" position="left" show-delay="200">
        <md-button variant="filled">Left (RTL)</md-button>
      </md-tooltip>
      <md-tooltip text="أعلى" position="top-start" show-delay="200">
        <md-button variant="filled">Top Start (RTL)</md-button>
      </md-tooltip>
      <md-tooltip
        variant="rich"
        subhead="ميزة جديدة"
        text="جرب المحرر الجديد بالسحب والإفلات."
        position="bottom"
      >
        <md-button variant="outlined">Rich RTL</md-button>
        <div slot="actions">
          <md-button variant="text">فهمت</md-button>
        </div>
      </md-tooltip>
    </div>
  `,
};

/* ─── Dark Theme ───────────────────────────────────────── */

export const DarkTheme: Story = {
  render: () => html`
    <div data-theme="dark" style="background: var(--md-sys-color-surface, #1C1B1F); padding: 120px; border-radius: 16px; display: flex; gap: 48px; flex-wrap: wrap; justify-content: center; align-items: center;">
      <md-tooltip text="Dark plain tooltip" position="top" show-delay="200">
        <md-button variant="filled">Plain</md-button>
      </md-tooltip>
      <md-tooltip
        variant="rich"
        subhead="Dark rich tooltip"
        text="Rich tooltip in dark theme with actions."
        position="bottom"
      >
        <md-button variant="outlined">Rich</md-button>
        <div slot="actions">
          <md-button variant="text">Learn more</md-button>
        </div>
      </md-tooltip>
    </div>
  `,
  decorators: [
    (story) => html`<div data-theme="dark">${story()}</div>`,
  ],
};

/* ─── Custom CSS ───────────────────────────────────────── */

export const CustomCSS: Story = {
  render: () => html`
    <style>
      .custom-plain {
        --md-tooltip-plain-container-color: #1a237e;
        --md-tooltip-plain-text-color: #e8eaf6;
        --md-tooltip-container-shape: 8px;
      }
      .custom-rich {
        --md-tooltip-rich-container-color: #fff3e0;
        --md-tooltip-rich-subhead-color: #e65100;
        --md-tooltip-rich-text-color: #bf360c;
        --md-tooltip-rich-action-color: #e65100;
        --md-tooltip-rich-container-shape: 16px;
      }
    </style>
    <div style="padding: 120px; display: flex; gap: 48px; flex-wrap: wrap; justify-content: center; align-items: center;">
      <md-tooltip class="custom-plain" text="Custom styled" position="top" show-delay="200">
        <md-button variant="filled">Custom Plain</md-button>
      </md-tooltip>
      <md-tooltip
        class="custom-rich"
        variant="rich"
        subhead="Custom Colors"
        text="Rich tooltip with warm color overrides."
        position="bottom"
      >
        <md-button variant="outlined">Custom Rich</md-button>
        <div slot="actions">
          <md-button variant="text">Action</md-button>
        </div>
      </md-tooltip>
    </div>
  `,
};

/* ─── CSS Parts ────────────────────────────────────────── */

export const CSSParts: Story = {
  render: () => html`
    <style>
      .parts-demo::part(popup) {
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
      }
      .parts-demo::part(text) {
        font-weight: 600;
        letter-spacing: 0.5px;
      }
      .parts-rich::part(subhead) {
        text-transform: uppercase;
        letter-spacing: 1px;
      }
      .parts-rich::part(supporting-text) {
        font-style: italic;
      }
    </style>
    <div style="padding: 120px; display: flex; gap: 48px; flex-wrap: wrap; justify-content: center; align-items: center;">
      <md-tooltip class="parts-demo" text="Styled with ::part" position="top" show-delay="200">
        <md-button variant="filled">Part Styling</md-button>
      </md-tooltip>
      <md-tooltip
        class="parts-rich"
        variant="rich"
        subhead="Styled Subhead"
        text="Supporting text styled via CSS parts."
        position="bottom"
      >
        <md-button variant="outlined">Rich Parts</md-button>
      </md-tooltip>
    </div>
  `,
};

/* ─── With Slotted Content ─────────────────────────────── */

export const SlottedContent: Story = {
  render: () => html`
    <div style="padding: 120px; display: flex; gap: 48px; flex-wrap: wrap; justify-content: center; align-items: center;">
      <md-tooltip variant="rich" position="bottom">
        <md-icon-button icon="help_outline" aria-label="Help"></md-icon-button>
        <span slot="subhead" style="display: flex; align-items: center; gap: 6px;">
          <span class="material-symbols-outlined" style="font-size: 18px;">info</span>
          Slotted Subhead
        </span>
        <span slot="content">
          This content uses <strong>slots</strong> instead of props, allowing
          rich HTML formatting.
        </span>
        <div slot="actions">
          <md-button variant="text">Learn more</md-button>
          <md-button variant="text">Got it</md-button>
        </div>
      </md-tooltip>
    </div>
  `,
  play: async ({ canvasElement }) => {
    const tip = await getTooltip(canvasElement);
    const trigger = tip.querySelector('md-icon-button') as HTMLElement;

    // With no text/subhead props, computeDescription falls back to the SLOTTED
    // subhead + content so a slot-only rich tooltip is still announced to SRs.
    await waitFor(() => {
      const desc = trigger.getAttribute('aria-description') || '';
      expect(desc).toContain('Slotted Subhead');
      expect(desc).toContain('slots');
    });

    // Editing slotted content at RUNTIME must re-sync the announced copy: the host
    // MutationObserver (subtree + characterData) refires syncSlotFlags +
    // updateTriggerAria, so aria-description tracks the edited slotted text — proof
    // the observer callback ran, not a one-shot read at bind time.
    const slottedSubhead = tip.querySelector('[slot="subhead"]') as HTMLElement;
    slottedSubhead.appendChild(document.createTextNode(' Revised'));
    await waitFor(() =>
      expect(trigger.getAttribute('aria-description') || '').toContain('Revised'),
    );
  },
};

/* ─── Shared helpers for the l10n / responsive / a11y stories ─── */

const ttLabelStyle =
  'margin: 0 0 10px; font-size: 12px; font-weight: 600; letter-spacing: 0.4px; text-transform: uppercase; color: var(--md-sys-color-on-surface-variant);';
const ttNoteStyle =
  'margin: 0; font-size: 13px; line-height: 1.5; color: var(--md-sys-color-on-surface-variant);';
const ttKeyStyle =
  'display: inline-block; padding: 1px 6px; border: 1px solid var(--md-sys-color-outline-variant); border-radius: 4px; font: 600 11px/1.6 ui-monospace, monospace; background: var(--md-sys-color-surface-container-high);';

/* ─── Localization ─────────────────────────────────────── */

export const Localization: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Tooltip copy is localized per instance; the trigger mirrors it onto `aria-description`, so screen readers announce the translated text in the page language. ' +
          'Long copy **wraps** below `--md-tooltip-plain-max-inline-size` (never truncated with an ellipsis), so it works for verbose languages like German. ' +
          'RTL locales flip placement via logical properties — `position="left"`/`"right"` follow reading direction. Tooltips are shown open here for comparison; hover or focus to toggle.',
      },
    },
  },
  render: (_args, { viewMode }) => html`
    <div style="padding: 64px 48px; display: grid; gap: 96px; justify-items: start; max-width: 760px;">
      <div>
        <p style="${ttLabelStyle}">English · plain</p>
        <md-tooltip text="Save to your library" position="bottom" show-delay="150" ?open=${viewMode !== 'docs'}>
          <md-button variant="filled">Save</md-button>
        </md-tooltip>
      </div>
      <div lang="de">
        <p style="${ttLabelStyle}">German · long compound copy (wraps, not clipped)</p>
        <md-tooltip
          text="Änderungen werden automatisch in Ihrem Benutzerkonto gespeichert und mit allen Geräten synchronisiert."
          position="bottom"
          show-delay="150"
          ?open=${viewMode !== 'docs'}
        >
          <md-button variant="filled">Speichern</md-button>
        </md-tooltip>
      </div>
      <div lang="ja">
        <p style="${ttLabelStyle}">Japanese · CJK glyph width</p>
        <md-tooltip text="変更内容は自動的に保存され、すべてのデバイスと同期されます。" position="bottom" show-delay="150" ?open=${viewMode !== 'docs'}>
          <md-button variant="filled">保存</md-button>
        </md-tooltip>
      </div>
      <div dir="rtl" lang="ar">
        <p style="${ttLabelStyle}">Arabic · RTL rich tooltip (placement + actions mirror)</p>
        <md-tooltip
          variant="rich"
          subhead="ميزة جديدة"
          text="يتم حفظ التغييرات تلقائيًا ومزامنتها عبر جميع أجهزتك المتصلة."
          position="bottom"
          show-delay="150"
          ?open=${viewMode !== 'docs'}
        >
          <md-button variant="filled">حفظ</md-button>
          <div slot="actions">
            <md-button variant="text">فهمت</md-button>
            <md-button variant="text">معرفة المزيد</md-button>
          </div>
        </md-tooltip>
      </div>
    </div>
  `,
};

/* ─── Responsiveness ───────────────────────────────────── */

export const Responsiveness: Story = {
  name: 'Responsiveness',
  parameters: {
    docs: {
      description: {
        story:
          'A tooltip is a viewport-anchored popup, so "responsive" means it stays readable and on-screen as the viewport changes: long text **wraps** within a width cap instead of forcing horizontal overflow, and `auto-position` (default on) **flips and clamps** the popup against the viewport near its edges. ' +
          'The first tooltip is shown open to illustrate wrapping; the rest are interactive — **resize the canvas or use the Viewport toolbar, then hover / focus** the triggers.',
      },
    },
  },
  render: (_args, { viewMode }) => html`
    <div style="padding: 48px; display: grid; gap: 32px; max-width: 900px;">
      <div style="padding-block-end: 104px;">
        <p style="${ttLabelStyle}">Wraps to fit — long text never overflows a narrow screen</p>
        <p style="${ttNoteStyle}; margin-bottom: 24px;">
          Capped at <code>--md-tooltip-plain-max-inline-size</code> (280px default) and wrapped below it, so there is no sideways scrolling on small screens.
        </p>
        <md-tooltip
          text="On a narrow screen this longer supporting sentence wraps onto multiple lines and stays within the width cap instead of forcing the layout to scroll sideways."
          position="bottom"
          show-delay="150"
          ?open=${viewMode !== 'docs'}
        >
          <md-button variant="filled">Long tooltip</md-button>
        </md-tooltip>
      </div>

      <div>
        <p style="${ttLabelStyle}">Tighten the cap per breakpoint — hover each</p>
        <p style="${ttNoteStyle}; margin-bottom: 20px;">
          Same text, three caps set with a per-instance custom property (e.g. narrower on phones, wider on desktop).
        </p>
        <div style="display: flex; gap: 20px; flex-wrap: wrap;">
          <md-tooltip text="This supporting text wraps to stay within the width cap." position="bottom" show-delay="120">
            <md-button variant="tonal">280px · default</md-button>
          </md-tooltip>
          <md-tooltip
            text="This supporting text wraps to stay within the width cap."
            style="--md-tooltip-plain-max-inline-size: 160px;"
            position="bottom"
            show-delay="120"
          >
            <md-button variant="tonal">160px</md-button>
          </md-tooltip>
          <md-tooltip
            text="This supporting text wraps to stay within the width cap."
            style="--md-tooltip-plain-max-inline-size: 440px;"
            position="bottom"
            show-delay="120"
          >
            <md-button variant="tonal">440px</md-button>
          </md-tooltip>
        </div>
      </div>

      <div>
        <p style="${ttLabelStyle}">Stays on-screen at the edges — hover to see the clamp / flip</p>
        <p style="${ttNoteStyle}; margin-bottom: 20px;">
          Edge-anchored triggers shift inward, and top/bottom flips, so the popup is never cut off. Resize the canvas narrower to watch it adapt.
        </p>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <md-tooltip text="Left-edge anchor — the popup clamps inward so nothing is cut off." position="top" show-delay="120">
            <md-icon-button icon="first_page" aria-label="Left edge"></md-icon-button>
          </md-tooltip>
          <md-tooltip text="Centered anchor keeps its centered placement." position="top" show-delay="120">
            <md-icon-button icon="filter_center_focus" aria-label="Center"></md-icon-button>
          </md-tooltip>
          <md-tooltip text="Right-edge anchor — the popup clamps inward so nothing is cut off." position="top" show-delay="120">
            <md-icon-button icon="last_page" aria-label="Right edge"></md-icon-button>
          </md-tooltip>
        </div>
      </div>
    </div>
  `,
};

/* ─── Accessibility ────────────────────────────────────── */

export const Accessibility: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'The popup carries `role="tooltip"`; the trigger gets an `aria-description` (not `aria-describedby`, which cannot cross the shadow boundary) so the text is announced when the trigger is focused. ' +
          'Tooltips open on **keyboard focus**, stay visible while the pointer moves onto them (WCAG 1.4.13 hoverable), and dismiss on <span style="' +
          ttKeyStyle +
          '">Esc</span> without stealing focus from unrelated elements. ' +
          '**Limitations** (see readme): no touch / long-press trigger, and a rich tooltip\'s action buttons sit inside `role="tooltip"` — use a menu or dialog when actions must be announced as interactive.',
      },
    },
  },
  render: () => html`
    <div style="padding: 48px; display: grid; gap: 40px; max-width: 720px;">
      <div>
        <p style="${ttLabelStyle}">Keyboard: focus reveals the tooltip</p>
        <p style="${ttNoteStyle}; margin-bottom: 16px;">
          <span style="${ttKeyStyle}">Tab</span> from the field into each control — the tooltip shows on focus and hides on blur.
          <span style="${ttKeyStyle}">Esc</span> dismisses it and returns focus to the trigger.
        </p>
        <input
          type="text"
          placeholder="Tab from here"
          style="margin-block-end: 20px; padding: 8px 12px; border-radius: 8px; border: 1px solid var(--md-sys-color-outline-variant); width: 100%; box-sizing: border-box;"
        />
        <div style="display: flex; gap: 40px; flex-wrap: wrap; padding-block: 40px;">
          <md-tooltip text="Undo the last action" position="top" show-delay="0">
            <md-icon-button icon="undo" aria-label="Undo"></md-icon-button>
          </md-tooltip>
          <md-tooltip text="Redo the last action" position="top" show-delay="0">
            <md-icon-button icon="redo" aria-label="Redo"></md-icon-button>
          </md-tooltip>
          <md-tooltip text="Save changes" position="top" show-delay="0">
            <md-button variant="filled">Save</md-button>
          </md-tooltip>
        </div>
      </div>
      <div>
        <p style="${ttLabelStyle}">aria-description carries the text to screen readers</p>
        <p style="${ttNoteStyle}; margin-bottom: 40px;">
          The button below is announced as “More options, <em>Open the overflow menu</em>”. Inspect the trigger to see the
          <code>aria-description</code> the tooltip mirrors onto it.
        </p>
        <md-tooltip text="Open the overflow menu" position="bottom" show-delay="150">
          <md-icon-button icon="more_vert" aria-label="More options"></md-icon-button>
        </md-tooltip>
      </div>
      <div>
        <p style="${ttLabelStyle}">Hoverable (WCAG 1.4.13) — move onto the tooltip to read it</p>
        <p style="${ttNoteStyle}; margin-bottom: 40px;">
          Hover the trigger, then move the pointer onto the tooltip: it stays visible long enough to reach and read (rich tooltips keep their action buttons reachable too).
        </p>
        <md-tooltip
          variant="rich"
          subhead="Keyboard shortcuts"
          text="Press ⌘K to open the command palette from anywhere in the app."
          position="bottom"
          hide-delay="400"
        >
          <md-icon-button icon="keyboard" aria-label="Keyboard shortcuts"></md-icon-button>
          <div slot="actions">
            <md-button variant="text">View all</md-button>
          </div>
        </md-tooltip>
      </div>
    </div>
  `,
};

/* ─── Native Button Trigger ────────────────────────────── */

export const NativeButtonTrigger: Story = {
  render: () => html`
    <div style="padding: 120px; display: flex; justify-content: center;">
      <md-tooltip text="Native button tooltip" position="top" show-delay="0">
        <button type="button" style="padding: 8px 16px;">Native button</button>
      </md-tooltip>
    </div>
  `,
  /** A native <button> trigger takes the interactive-element path in useHostHover
   *  (hover/focus bind to the button, not the host) — distinct from md-* triggers. */
  play: async ({ canvasElement }) => {
    const tip = await getTooltip(canvasElement);
    const trigger = tip.querySelector('button') as HTMLButtonElement;
    const popup = popupOf(tip);

    // aria-description mirrors across the shadow boundary onto the native trigger.
    await waitFor(() => expect(trigger.getAttribute('aria-description')).toBe(tip.text));

    trigger.dispatchEvent(new FocusEvent('focus'));
    await waitFor(
      () => expect(popup.classList.contains('md-tooltip__popup--visible')).toBe(true),
      { timeout: 2000 },
    );

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }));
    await waitFor(() => expect(tip.open).toBe(false), { timeout: 2000 });
    await new Promise((r) => setTimeout(r, 200));
  },
};

/* ─── Inside a Transformed Containing Block ────────────── */

export const InsideTransformedContainer: Story = {
  render: () => html`
    <div style="transform: translateZ(0); padding: 120px; display: flex; justify-content: center;">
      <md-tooltip text="Inside a transformed containing block" position="bottom" show-delay="0">
        <md-button variant="filled">Transformed ancestor</md-button>
      </md-tooltip>
    </div>
  `,
  /** An ancestor with `transform` becomes the popup's position:fixed containing block,
   *  exercising getFixedContainingBlock + toFixedCoords' viewport→block conversion. */
  play: async ({ canvasElement }) => {
    const tip = await getTooltip(canvasElement);
    const trigger = tip.querySelector('md-button') as HTMLElement;
    const popup = popupOf(tip);

    trigger.dispatchEvent(new FocusEvent('focus'));
    await waitFor(
      () => expect(popup.classList.contains('md-tooltip__popup--visible')).toBe(true),
      { timeout: 2000 },
    );

    // Positioning ran relative to the transformed containing block (inline coords set).
    await waitFor(() => expect(popup.style.top).not.toBe(''));
    expect(popup.style.left).not.toBe('');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }));
    await waitFor(() => expect(tip.open).toBe(false), { timeout: 2000 });
    await new Promise((r) => setTimeout(r, 200));
  },
};

/* ─── Reparented Trigger (reconnect lifecycle) ─────────── */

export const ReparentedTrigger: Story = {
  render: () => html`
    <div style="padding: 120px; display: flex; gap: 64px; justify-content: center;">
      <div id="tt-home">
        <md-tooltip text="Reparent me" position="top" show-delay="0" hide-delay="0">
          <md-button variant="filled">Move target</md-button>
        </md-tooltip>
      </div>
      <div id="tt-dest" style="min-width: 140px; min-height: 40px;"></div>
    </div>
  `,
  /** A REPARENT (disconnect→connect after first load) must re-establish bindings —
   *  componentDidLoad runs only once. Exercises connectedCallback's re-setup path:
   *  (a) a still-visible tooltip restores its listeners + repositions against the
   *  moved trigger, and (b) `open` set while DETACHED is honored on reconnect. */
  play: async ({ canvasElement }) => {
    const tip = await getTooltip(canvasElement);
    const popup = popupOf(tip);
    const dest = canvasElement.querySelector('#tt-dest') as HTMLElement;

    // (a) Open it, then move the whole tooltip to a new parent while VISIBLE.
    await (tip as unknown as { show(): Promise<void> }).show();
    await waitFor(() => expect(popup.classList.contains('md-tooltip__popup--visible')).toBe(true));

    dest.appendChild(tip); // disconnectedCallback tears down, then connectedCallback re-setups
    // isVisible survived the move, so connectedCallback re-attaches listeners and
    // reschedules positioning — it stays open and re-anchors (fresh inline coords).
    await waitFor(() => expect(popup.classList.contains('md-tooltip__popup--visible')).toBe(true));
    await waitFor(() => expect(popup.style.top).not.toBe(''));
    expect(popup.style.left).not.toBe('');
    expect(tip.parentElement).toBe(dest); // it really moved

    // Settle it closed before the next scenario.
    await (tip as unknown as { hide(): Promise<void> }).hide();
    await waitFor(() => expect(popup.classList.contains('md-tooltip__popup--visible')).toBe(false));

    // (b) Set `open` while the element is DETACHED — showTooltip refuses to bind
    // global listeners off-DOM, so it stays not-visible with open=true. Reconnecting
    // must honor the pending open and finally show it.
    let reopened = false;
    tip.addEventListener('mdOpen', () => { reopened = true; }, { once: true });
    tip.remove();
    tip.open = true;
    await new Promise((r) => setTimeout(r, 30));
    expect(popup.classList.contains('md-tooltip__popup--visible')).toBe(false); // detached: not shown yet

    dest.appendChild(tip); // connectedCallback's open && !isVisible branch runs showTooltip
    await waitFor(() => expect(popup.classList.contains('md-tooltip__popup--visible')).toBe(true), { timeout: 2000 });
    expect(reopened).toBe(true); // the reconnect actually emitted mdOpen

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }));
    await waitFor(() => expect(tip.open).toBe(false), { timeout: 2000 });
    await new Promise((r) => setTimeout(r, 200));
  },
};

/* ─── RTL Physical Placement ───────────────────────────── */

export const RTLPlacement: Story = {
  render: () => html`
    <div dir="rtl" style="padding: 160px; display: flex; justify-content: center;">
      <md-tooltip text="يمين" position="right" show-delay="0" hide-delay="0">
        <md-button variant="filled">RTL right</md-button>
      </md-tooltip>
    </div>
  `,
  /** In RTL the inline-axis SIDE mirrors: position="right" must resolve to the
   *  physical LEFT (physicalPlacement). auto-position is turned off so the mirror
   *  is deterministic (no re-flip), proving the RTL branch — not viewport fitting. */
  play: async ({ canvasElement }) => {
    const tip = await getTooltip(canvasElement);
    const popup = popupOf(tip);
    (tip as unknown as { autoPosition: boolean }).autoPosition = false;

    await (tip as unknown as { show(): Promise<void> }).show();
    await waitFor(() => expect(popup.classList.contains('md-tooltip__popup--visible')).toBe(true));
    await waitFor(() => expect(popup.style.left).not.toBe(''));

    // The requested "right" mirrored to a physical "left" placement class.
    const classes = Array.from(popup.classList);
    expect(classes.some((c) => c.startsWith('md-tooltip__popup--left'))).toBe(true);
    expect(classes.includes('md-tooltip__popup--right')).toBe(false);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }));
    await waitFor(() => expect(tip.open).toBe(false), { timeout: 2000 });
    await new Promise((r) => setTimeout(r, 200));
  },
};

/* ─── Rich: focus into an action keeps it open ─────────── */

export const RichFocusRetention: Story = {
  render: () => html`
    <div style="padding: 160px; display: flex; justify-content: center;">
      <md-tooltip
        variant="rich"
        subhead="Heads up"
        text="Moving focus onto the action button keeps the tooltip open."
        position="bottom"
        show-delay="0"
        hide-delay="150"
      >
        <md-button variant="outlined">Rich focus</md-button>
        <div slot="actions">
          <md-button variant="text">Got it</md-button>
        </div>
      </md-tooltip>
    </div>
  `,
  /** handleTriggerBlur: focus leaving the trigger but INTO the tooltip (a rich
   *  action button) must NOT arm the hide — the guard returns early. Focus leaving
   *  to an unrelated element then arms the hide as usual. */
  play: async ({ canvasElement }) => {
    const tip = await getTooltip(canvasElement);
    const popup = popupOf(tip);
    const trigger = tip.querySelector('md-button') as HTMLElement; // first md-button = trigger
    const actionBtn = tip.querySelector('[slot="actions"] md-button') as HTMLElement;

    await (tip as unknown as { show(): Promise<void> }).show();
    await waitFor(() => expect(popup.classList.contains('md-tooltip__popup--visible')).toBe(true));

    // Blur off the trigger with relatedTarget INSIDE the tooltip → the guard returns,
    // no hide scheduled. Wait past hide-delay (150ms) and confirm it survived.
    trigger.dispatchEvent(new FocusEvent('blur', { relatedTarget: actionBtn }));
    await new Promise((r) => setTimeout(r, 260));
    expect(tip.open).toBe(true);

    // Blur with an OUTSIDE relatedTarget → scheduleHide fires and it dismisses.
    trigger.dispatchEvent(new FocusEvent('blur', { relatedTarget: document.body }));
    await waitFor(() => expect(tip.open).toBe(false), { timeout: 2000 });
    await new Promise((r) => setTimeout(r, 200));
  },
};

/* ─── Edge Auto-Flip ───────────────────────────────────── */

export const EdgeAutoFlip: Story = {
  // Interaction test for edge auto-flip only; the sole content is a
  // position:fixed trigger, so #storybook-root has no visible box to screenshot
  // — skip visual regression (the play still runs in the a11y/coverage gates).
  parameters: { layout: 'fullscreen', visual: { skip: true } },
  render: () => html`
    <div style="position: fixed; top: 2px; left: 50%; transform: none;">
      <md-tooltip text="Flips below the trigger" position="top" show-delay="0" hide-delay="0">
        <md-button variant="filled">Top edge</md-button>
      </md-tooltip>
    </div>
  `,
  /** A trigger pinned to the viewport's top edge can't fit a "top" popup, so
   *  findBestPlacement flips to the opposite side (getOppositePlacement) — the
   *  resolved placement becomes "bottom". */
  play: async ({ canvasElement }) => {
    const tip = await getTooltip(canvasElement);
    const trigger = tip.querySelector('md-button') as HTMLElement;
    const popup = popupOf(tip);

    trigger.dispatchEvent(new FocusEvent('focus'));
    await waitFor(
      () => expect(popup.classList.contains('md-tooltip__popup--visible')).toBe(true),
      { timeout: 2000 },
    );
    await waitFor(() => expect(popup.style.top).not.toBe(''));

    // Preferred "top" overflowed the viewport top → auto-flipped to "bottom".
    const classes = Array.from(popup.classList);
    expect(classes.some((c) => c.startsWith('md-tooltip__popup--bottom'))).toBe(true);
    expect(classes.some((c) => c.startsWith('md-tooltip__popup--top'))).toBe(false);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }));
    await waitFor(() => expect(tip.open).toBe(false), { timeout: 2000 });
    await new Promise((r) => setTimeout(r, 200));
  },
};
