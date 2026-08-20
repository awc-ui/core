import type { Meta, StoryObj } from '@storybook/web-components';
import { expect, waitFor } from 'storybook/test';
import { html } from 'lit';
import '@awc-ui/core/define';
import { t } from '../i18n';

function getSheet(id: string) {
  return document.getElementById(id) as any;
}

/** Shadow-piercing helpers for play(): testing-library queries can't cross
 *  shadow roots, so interactions address the real internals directly. */
type SheetEl = HTMLElement & {
  open: boolean;
  show: () => Promise<void>;
  close: () => Promise<void>;
};
const getSheetEl = async (
  canvasElement: HTMLElement,
  id: string,
): Promise<SheetEl> => {
  const sheet = canvasElement.querySelector(`#${id}`) as SheetEl;
  await waitFor(() => expect(sheet.classList.contains('hydrated')).toBe(true));
  return sheet;
};
/** The internal `role="dialog"` surface — carries aria-hidden when closed. */
const containerOf = (sheet: SheetEl) =>
  sheet.shadowRoot!.querySelector('[part="container"]') as HTMLElement;
const scrimOf = (sheet: SheetEl) =>
  sheet.shadowRoot!.querySelector('[part="scrim"]') as HTMLElement;

const kbdStyle =
  'padding: 2px 8px; border-radius: 4px; background: var(--md-sys-color-surface-container, #f3edf7); font-family: monospace; font-size: 13px; border: 1px solid var(--md-sys-color-outline-variant, #CAC4D0);';

const meta: Meta = {
  title: 'Containment/Bottom Sheet',
  component: 'md-bottom-sheet',
  tags: ['autodocs'],
  parameters: {
    // `fullscreen` lets our wrapper actually be `100vh` — anything
    // else (Storybook's default `centered`, or `padded`) reserves
    // outer chrome that prevents a `position: fixed` scrim from
    // visually filling the canvas.
    layout: 'fullscreen',
    docs: {
      // In Autodocs, each story renders inside its own iframe so a
      // `position: fixed` bottom sheet doesn't escape into the rest
      // of the docs page. Without this each preview shares the docs
      // page's viewport and a single open sheet covers everything
      // above it. The iframe is sized to comfortably fit the 80vh
      // sheet plus its trigger.
      story: { inline: false, iframeHeight: 720 },
      source: { language: 'html' },
    },
  },
  decorators: [
    // Wrapper that horizontally centres the trigger (and any
    // explanatory prose) at the top of the story's viewport. We
    // deliberately do NOT set `transform`, `filter`, or any other
    // property that would create a containing block for
    // `position: fixed` descendants — the bottom sheet must resolve
    // against the real viewport so its scrim covers the full canvas /
    // iframe and its container anchors to the actual bottom edge.
    (story) => html`
      <div
        style="
          position: relative;
          inline-size: 100%;
          min-block-size: 100vh;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-start;
          gap: 16px;
          padding: 24px;
          text-align: center;
        "
      >
        ${story()}
      </div>
    `,
  ],
  argTypes: {
    variant: {
      control: 'select',
      options: ['standard', 'detached'],
      description:
        '`standard` anchors to the bottom edge, `detached` floats with margin on every side. Both are modal dialogs with scrim.',
    },
    headline: {
      control: 'text',
      description: 'Headline text',
    },
    closeable: {
      control: 'boolean',
      description: 'Show a close icon-button in the header',
    },
    showDragHandle: {
      control: 'boolean',
      description: 'Show drag handle indicator',
    },
    scrimDismissible: {
      control: 'boolean',
      description: 'Whether scrim click closes the sheet',
    },
    'top-divider': {
      control: 'boolean',
      description: 'Render a divider between the header and the content',
    },
    'bottom-divider': {
      control: 'boolean',
      description: 'Render a divider between the content and the actions',
    },
    'headline-align': {
      control: 'inline-radio',
      options: ['start', 'center', 'end'],
      description:
        'Inline-axis text-align for the headline. Logical — flips with `dir="rtl"`.',
    },
    'content-align': {
      control: 'inline-radio',
      options: ['start', 'center', 'end'],
      description:
        'Inline-axis text-align for slotted body content. Inherits to all default-slot children.',
    },
  },
  args: {
    variant: 'standard',
    headline: 'Title',
    closeable: false,
    showDragHandle: true,
    scrimDismissible: true,
    'top-divider': false,
    'bottom-divider': false,
    'headline-align': 'start',
    'content-align': 'start',
  },
};
export default meta;
type Story = StoryObj;

/* ─── Playground ──────────────────────────────────────────── */

export const Playground: Story = {
  render: (args, { globals }) => html`
    <md-button variant="filled" @click=${() => getSheet('playground-sheet')?.show()}>
      ${t(globals.locale, 'bottomSheet.openBottomSheet')}
    </md-button>
    <md-bottom-sheet
      id="playground-sheet"
      variant=${args.variant}
      headline=${args.headline}
      ?closeable=${args.closeable}
      ?show-drag-handle=${args.showDragHandle}
      ?scrim-dismissible=${args.scrimDismissible}
      ?top-divider=${args['top-divider']}
      ?bottom-divider=${args['bottom-divider']}
      headline-align=${args['headline-align']}
      content-align=${args['content-align']}
    >
      <p>This is the bottom sheet content. Toggle <code>variant</code> between
      <code>standard</code> (anchored) and <code>detached</code> (floating).</p>
    </md-bottom-sheet>
  `,
};

/* ─── Standard (anchored) ─────────────────────────────────── */

/**
 * The default. Anchored to the bottom edge of the viewport with rounded
 * top corners only — full-width on mobile, centred 640 px panel on desktop.
 * Always renders a scrim and traps focus.
 *
 * For list-based content (share sheets, action menus, contextual menus),
 * tighten the content area's inline padding via the
 * `--md-bottom-sheet-content-padding-inline` token. Combined with the
 * list-item's own 16 px padding this aligns list content with the headline
 * (24 px from the sheet edge) while keeping a small visual gutter on
 * either side. Set the token to `0` for fully edge-to-edge content (the
 * scrollbar then sits flush with the container's inline edge).
 */
export const Standard: Story = {
  render: (_args, { globals }) => html`
    <style>
      #standard-sheet { --md-bottom-sheet-content-padding-inline: 8px; }
    </style>
    <md-button variant="filled" @click=${() => getSheet('standard-sheet')?.show()}>
      ${t(globals.locale, 'bottomSheet.openStandard')}
    </md-button>
    <md-bottom-sheet id="standard-sheet" headline=${t(globals.locale, 'bottomSheet.share')}>
      <md-list>
        <md-list-item headline=${t(globals.locale, 'bottomSheet.shareEmail')} leading-icon="email"></md-list-item>
        <md-list-item headline=${t(globals.locale, 'bottomSheet.copyLink')} leading-icon="link"></md-list-item>
        <md-list-item headline=${t(globals.locale, 'bottomSheet.saveToDrive')} leading-icon="add_to_drive"></md-list-item>
        <md-list-item headline=${t(globals.locale, 'bottomSheet.print')} leading-icon="print"></md-list-item>
      </md-list>
    </md-bottom-sheet>
  `,
  /** The modal open→dismiss lifecycle, scripted (see the Interactions panel):
   *  the trigger opens it (focus enters, aria-hidden clears, mdOpen fires) and a
   *  scrim click dismisses it (mdCancel + mdClose, focus restored to the opener). */
  play: async ({ canvasElement, step }) => {
    const sheet = await getSheetEl(canvasElement, 'standard-sheet');
    const trigger = canvasElement.querySelector('md-button') as HTMLElement;
    const container = containerOf(sheet);

    await step('Trigger opens the sheet — focus leaves the opener, aria-hidden clears', async () => {
      // Closed baseline: the dialog surface is inert and the opener holds focus.
      expect(sheet.open).toBe(false);
      expect(container.getAttribute('aria-hidden')).toBe('true');
      trigger.focus();
      expect(document.activeElement).toBe(trigger);

      let opened = false;
      sheet.addEventListener('mdOpen', () => (opened = true), { once: true });
      trigger.click(); // runs the story's @click → show()

      await waitFor(() => expect(sheet.open).toBe(true));
      // aria-hidden clears on the render flush after open flips (not synchronously).
      await waitFor(() => expect(container.getAttribute('aria-hidden')).toBeNull());
      expect(sheet.hasAttribute('open')).toBe(true); // prop reflected to the attribute
      expect(opened).toBe(true); // component actually emitted mdOpen
      // Focus was pulled off the opener into the trapped dialog.
      await waitFor(() => expect(document.activeElement).not.toBe(trigger));
    });

    await step('Scrim click dismisses — mdCancel + mdClose fire, focus returns to the opener', async () => {
      let cancelled = false;
      let closed = false;
      sheet.addEventListener('mdCancel', () => (cancelled = true), { once: true });
      sheet.addEventListener('mdClose', () => (closed = true), { once: true });

      scrimOf(sheet).click(); // scrim-dismissible defaults to true here

      await waitFor(() => expect(sheet.open).toBe(false));
      await waitFor(() => expect(container.getAttribute('aria-hidden')).toBe('true'));
      expect(cancelled).toBe(true); // user-dismiss path emits mdCancel…
      expect(closed).toBe(true); // …in addition to mdClose
      await waitFor(() => expect(document.activeElement).toBe(trigger)); // focus restored
      // Let the close animation settle so teardown doesn't race it.
      await new Promise((r) => setTimeout(r, 300));
    });
  },
};

/* ─── Detached (floating) ────────────────────────────────── */

/**
 * Floats with a margin on every side and rounded corners on every side.
 * Same modal semantics as standard — only the chrome differs.
 */
export const Detached: Story = {
  render: (_args, { globals }) => html`
    <style>
      #detached-sheet { --md-bottom-sheet-content-padding-inline: 8px; }
    </style>
    <md-button variant="filled" @click=${() => getSheet('detached-sheet')?.show()}>
      ${t(globals.locale, 'bottomSheet.openDetached')}
    </md-button>
    <md-bottom-sheet id="detached-sheet" variant="detached" headline=${t(globals.locale, 'bottomSheet.share')}>
      <md-list>
        <md-list-item headline=${t(globals.locale, 'bottomSheet.shareEmail')} leading-icon="email"></md-list-item>
        <md-list-item headline=${t(globals.locale, 'bottomSheet.copyLink')} leading-icon="link"></md-list-item>
        <md-list-item headline=${t(globals.locale, 'bottomSheet.saveToDrive')} leading-icon="add_to_drive"></md-list-item>
        <md-list-item headline=${t(globals.locale, 'bottomSheet.print')} leading-icon="print"></md-list-item>
      </md-list>
    </md-bottom-sheet>
  `,
};

/* ─── All Variants ────────────────────────────────────────── */

/**
 * The two variants side by side. Both are modal dialogs with scrim, focus
 * trap, body scroll lock, and Escape handling — only the chrome differs.
 */
export const AllVariants: Story = {
  render: (_args, { globals }) => html`
    <style>
      #all-standard,
      #all-detached { --md-bottom-sheet-content-padding-inline: 8px; }
    </style>
    <div style="display: flex; gap: 16px; flex-wrap: wrap; align-items: flex-start;">
      <md-button variant="filled" @click=${() => getSheet('all-standard')?.show()}>
        ${t(globals.locale, 'bottomSheet.openStandardShort')}
      </md-button>
      <md-button variant="outlined" @click=${() => getSheet('all-detached')?.show()}>
        ${t(globals.locale, 'bottomSheet.openDetachedShort')}
      </md-button>
    </div>

    <md-bottom-sheet id="all-standard" headline=${t(globals.locale, 'bottomSheet.share')}>
      <md-list>
        <md-list-item headline=${t(globals.locale, 'bottomSheet.shareEmail')} leading-icon="email"></md-list-item>
        <md-list-item headline=${t(globals.locale, 'bottomSheet.copyLink')} leading-icon="link"></md-list-item>
        <md-list-item headline=${t(globals.locale, 'bottomSheet.saveToDrive')} leading-icon="add_to_drive"></md-list-item>
      </md-list>
    </md-bottom-sheet>

    <md-bottom-sheet id="all-detached" variant="detached" headline=${t(globals.locale, 'bottomSheet.share')}>
      <md-list>
        <md-list-item headline=${t(globals.locale, 'bottomSheet.shareEmail')} leading-icon="email"></md-list-item>
        <md-list-item headline=${t(globals.locale, 'bottomSheet.copyLink')} leading-icon="link"></md-list-item>
        <md-list-item headline=${t(globals.locale, 'bottomSheet.saveToDrive')} leading-icon="add_to_drive"></md-list-item>
      </md-list>
    </md-bottom-sheet>
  `,
};

/* ─── Variable Width / Height ─────────────────────────────── */

/**
 * Width and height are entirely token-driven. Override
 * `--md-bottom-sheet-width`, `--md-bottom-sheet-max-width`,
 * `--md-bottom-sheet-height`, `--md-bottom-sheet-min-height`, and
 * `--md-bottom-sheet-max-height` on the host to size the panel however
 * you need — works on either variant.
 */
export const VariableWidthHeight: Story = {
  render: () => html`
    <style>
      #compact-sheet {
        --md-bottom-sheet-width: 360px;
        --md-bottom-sheet-max-width: 360px;
        --md-bottom-sheet-max-height: 240px;
      }
      #wide-sheet {
        --md-bottom-sheet-width: 880px;
        --md-bottom-sheet-max-width: calc(100% - 32px);
        --md-bottom-sheet-max-height: 60vh;
      }
      #tall-sheet {
        --md-bottom-sheet-width: 480px;
        --md-bottom-sheet-max-width: 480px;
        --md-bottom-sheet-max-height: 90vh;
        --md-bottom-sheet-min-height: 480px;
      }
    </style>
    <div style="display: flex; flex-direction: column; gap: 16px; align-items: flex-start;">
      <p style="margin: 0; max-width: 600px; line-height: 1.5; color: var(--md-sys-color-on-surface-variant, #49454F);">
        Each button opens a sheet with different size tokens applied. Resize the viewport
        to see how the panel responds — consumer-supplied tokens win over the responsive defaults.
      </p>
      <div style="display: flex; gap: 12px; flex-wrap: wrap;">
        <md-button variant="filled" @click=${() => getSheet('compact-sheet')?.show()}>
          Compact (360 × 240)
        </md-button>
        <md-button variant="outlined" @click=${() => getSheet('wide-sheet')?.show()}>
          Wide (880 × 60vh)
        </md-button>
        <md-button variant="tonal" @click=${() => getSheet('tall-sheet')?.show()}>
          Tall (480 × 480 min, 90vh max)
        </md-button>
      </div>

      <md-bottom-sheet id="compact-sheet" variant="detached" headline="Compact">
        <p>360 px wide, 240 px tall, detached chrome.</p>
      </md-bottom-sheet>
      <md-bottom-sheet id="wide-sheet" headline="Wide">
        <p>880 px wide (capped at <code>100% - 32px</code> on small viewports), 60vh tall.</p>
      </md-bottom-sheet>
      <md-bottom-sheet id="tall-sheet" headline="Tall">
        <p>480 px wide, between 480 px and 90vh tall — useful for nearly full-screen content on mobile.</p>
        ${Array.from({ length: 12 }, (_, i) => html`<p>Paragraph ${i + 1}.</p>`)}
      </md-bottom-sheet>
    </div>
  `,
};

/* ─── Responsive ─────────────────────────────────────────── */

/**
 * The default tokens reflow at the **640 px** breakpoint: full-width on
 * mobile, centred 640 px panel on desktop. Resize the Storybook viewport
 * to see it in action.
 */
export const Responsive: Story = {
  render: () => html`
    <div style="display: flex; flex-direction: column; gap: 16px; align-items: flex-start;">
      <p style="margin: 0; max-width: 600px; line-height: 1.5; color: var(--md-sys-color-on-surface-variant, #49454F);">
        Drag the Storybook viewport across the 640 px breakpoint while a sheet is open
        — on mobile it stretches edge-to-edge, on desktop it caps at 640 px and centres.
      </p>
      <md-button variant="filled" @click=${() => getSheet('responsive-sheet')?.show()}>
        Open Responsive Sheet
      </md-button>
      <md-bottom-sheet id="responsive-sheet" headline="Responsive Layout">
        <p>This sheet uses the default tokens. The breakpoint at 640 px swaps between
          <code>width: 100%</code> (mobile) and <code>width: 640px</code> (desktop) automatically.</p>
        <p>Override <code>--md-bottom-sheet-width</code> and
          <code>--md-bottom-sheet-max-width</code> per-instance to opt out of the default.</p>
      </md-bottom-sheet>
    </div>
  `,
};

/* ─── States ──────────────────────────────────────────────── */

export const States: Story = {
  render: () => html`
    <div style="display: flex; gap: 16px; flex-wrap: wrap;">
      <md-button variant="filled" @click=${() => getSheet('state-open')?.show()}>
        Open Sheet
      </md-button>
      <md-button variant="outlined" @click=${() => getSheet('state-no-handle')?.show()}>
        No Drag Handle
      </md-button>
      <md-button variant="tonal" @click=${() => getSheet('state-no-headline')?.show()}>
        No Headline
      </md-button>
    </div>

    <md-bottom-sheet id="state-open" headline="With Everything">
      <p>Full-featured: drag handle, headline, and content.</p>
    </md-bottom-sheet>

    <md-bottom-sheet id="state-no-handle" headline="No Drag Handle" show-drag-handle="false">
      <p>This sheet has no drag handle indicator. Top padding is preserved.</p>
    </md-bottom-sheet>

    <md-bottom-sheet id="state-no-headline">
      <p>This sheet has no headline — just content.</p>
    </md-bottom-sheet>
  `,
};

/* ─── Alignment ───────────────────────────────────────────── */

/**
 * Both the headline and the slotted content expose an inline-axis
 * alignment attribute (`headline-align` / `content-align`). Values are
 * **logical** — `start` reads left in LTR / right in RTL, `end` reads
 * right in LTR / left in RTL, `center` is direction-agnostic. Open
 * each sheet to compare.
 *
 * Body alignment propagates to slotted children via CSS `text-align`
 * inheritance through the flattened tree, so prose, lists, and forms
 * all pick it up unless they set their own `text-align`.
 *
 * For physical (non-RTL-flipping) alignment, override
 * `::part(headline)` or `::part(content)` with `text-align: left/right`.
 */
export const Alignment: Story = {
  render: () => {
    type Align = 'start' | 'center' | 'end';
    const matrix: Array<{ headline: Align; content: Align; label: string }> = [
      { headline: 'start', content: 'start', label: 'Default — start / start' },
      { headline: 'center', content: 'start', label: 'center / start' },
      { headline: 'end', content: 'start', label: 'end / start' },
      { headline: 'center', content: 'center', label: 'center / center' },
      { headline: 'start', content: 'end', label: 'start / end' },
    ];
    return html`
      <div style="display: flex; flex-direction: column; gap: 12px; align-items: center; max-width: 720px;">
        <p style="margin: 0; line-height: 1.6;">
          The headline and the body content each take an inline-axis alignment
          attribute. Defaults are <code>start</code> / <code>start</code> so
          the sheet's text never inherits a parent's <code>text-align</code>
          (e.g. a centred Storybook decorator). Try the matrix and toggle the
          RTL row at the bottom to see logical values flip.
        </p>

        <div style="display: flex; gap: 12px; flex-wrap: wrap; justify-content: center;">
          ${matrix.map(
            (m, i) => html`
              <md-button
                variant="filled"
                @click=${() => getSheet(`align-${i}`)?.show()}
              >
                ${m.label}
              </md-button>
            `,
          )}
          <md-button
            variant="outlined"
            @click=${() => getSheet('align-rtl')?.show()}
          >
            RTL — center / end
          </md-button>
        </div>

        ${matrix.map(
          (m, i) => html`
            <md-bottom-sheet
              id="align-${i}"
              headline=${`Headline (${m.headline})`}
              headline-align=${m.headline}
              content-align=${m.content}
              closeable
            >
              <p style="margin: 0 0 8px;">
                Body paragraph aligned <strong>${m.content}</strong>.
                Slotted children inherit <code>text-align</code> from the
                content wrapper through the flattened tree.
              </p>
              <p style="margin: 0 0 8px;">
                A second paragraph confirms the alignment applies to every
                default-slot child, not just the first one.
              </p>
              <p style="margin: 0; text-align: start;">
                This paragraph sets its own <code>text-align: start</code>
                inline — child overrides win, as expected.
              </p>
              <md-button
                slot="actions"
                variant="text"
                @click=${() => getSheet(`align-${i}`)?.close()}
              >
                Close
              </md-button>
            </md-bottom-sheet>
          `,
        )}

        <div dir="rtl">
          <md-bottom-sheet
            id="align-rtl"
            headline="عنوان"
            headline-align="center"
            content-align="end"
            closeable
          >
            <p style="margin: 0 0 8px;">
              فقرة محتوى عربية. <code>content-align="end"</code> منطقي،
              لذا في RTL يقرأ يسارًا.
            </p>
            <p style="margin: 0;">
              العنوان مركّز و المحتوى مُحاذى للنهاية المنطقية.
            </p>
            <md-button
              slot="actions"
              variant="text"
              @click=${() => getSheet('align-rtl')?.close()}
            >
              إغلاق
            </md-button>
          </md-bottom-sheet>
        </div>
      </div>
    `;
  },
};

/* ─── With Close + Dividers ──────────────────────────────── */

/**
 * `closeable` adds a close icon-button in the top-end corner.
 * `top-divider` and `bottom-divider` add hairline rules around the
 * content for sheets with action bars or scrollable content.
 *
 * Settings rows are real `md-list-item`s with a switch in the trailing
 * slot — keyboard nav, ARIA, and surface tinting all come from the
 * library list component.
 */
export const WithCloseAndDividers: Story = {
  render: (_args, { globals }) => html`
    <style>
      #close-divider-sheet { --md-bottom-sheet-content-padding-inline: 8px; }
    </style>
    <md-button variant="filled" @click=${() => getSheet('close-divider-sheet')?.show()}>
      ${t(globals.locale, 'bottomSheet.openSheet')}
    </md-button>
    <md-bottom-sheet
      id="close-divider-sheet"
      headline=${t(globals.locale, 'bottomSheet.notificationSettings')}
      closeable
      top-divider
      bottom-divider
    >
      <md-list>
        <md-list-item headline=${t(globals.locale, 'bottomSheet.emailDigest')}>
          <md-switch slot="trailing" checked></md-switch>
        </md-list-item>
        <md-list-item headline=${t(globals.locale, 'bottomSheet.pushNotifications')}>
          <md-switch slot="trailing"></md-switch>
        </md-list-item>
        <md-list-item headline=${t(globals.locale, 'bottomSheet.smsAlerts')}>
          <md-switch slot="trailing"></md-switch>
        </md-list-item>
      </md-list>
      <md-button slot="actions" variant="filled" @click=${() => getSheet('close-divider-sheet')?.close()}>
        ${t(globals.locale, 'save')}
      </md-button>
      <md-button slot="actions" variant="text" @click=${() => getSheet('close-divider-sheet')?.close()}>
        ${t(globals.locale, 'cancel')}
      </md-button>
    </md-bottom-sheet>
  `,
};

/* ─── Custom Close Slot ──────────────────────────────────── */

/**
 * Replace the default close icon-button with anything via the `close`
 * slot — a text button, a ghost icon, a custom web component.
 */
export const CustomClose: Story = {
  render: (_args, { globals }) => html`
    <md-button variant="filled" @click=${() => getSheet('custom-close-sheet')?.show()}>
      ${t(globals.locale, 'bottomSheet.openSheet')}
    </md-button>
    <md-bottom-sheet id="custom-close-sheet" headline=${t(globals.locale, 'bottomSheet.customDismiss')} closeable>
      <md-button
        slot="close"
        variant="text"
        size="sm"
        @click=${() => getSheet('custom-close-sheet')?.close()}
      >
        ${t(globals.locale, 'bottomSheet.done')}
      </md-button>
      <p>The default close icon-button has been replaced with a text button.
      Use this when "Close" should communicate an explicit affirmation.</p>
    </md-bottom-sheet>
  `,
};

/* ─── Share Actions ───────────────────────────────────────── */

export const ShareActions: Story = {
  render: (_args, { globals }) => html`
    <style>
      #share-sheet { --md-bottom-sheet-content-padding-inline: 8px; }
    </style>
    <md-button variant="filled" @click=${() => getSheet('share-sheet')?.show()}>
      ${t(globals.locale, 'bottomSheet.share')}
    </md-button>
    <md-bottom-sheet id="share-sheet" headline=${t(globals.locale, 'bottomSheet.share')}>
      <md-list>
        <md-list-item headline=${t(globals.locale, 'bottomSheet.shareEmail')} leading-icon="email"></md-list-item>
        <md-list-item headline=${t(globals.locale, 'bottomSheet.shareLink')} leading-icon="link"></md-list-item>
        <md-list-item headline=${t(globals.locale, 'bottomSheet.copyClipboard')} leading-icon="content_copy"></md-list-item>
        <md-list-item headline=${t(globals.locale, 'bottomSheet.saveToDrive')} leading-icon="add_to_drive"></md-list-item>
        <md-list-item headline=${t(globals.locale, 'bottomSheet.print')} leading-icon="print"></md-list-item>
      </md-list>
    </md-bottom-sheet>
  `,
};

/* ─── With Actions ────────────────────────────────────────── */

export const WithActions: Story = {
  render: (_args, { globals }) => html`
    <md-button variant="filled" @click=${() => getSheet('actions-sheet')?.show()}>
      ${t(globals.locale, 'bottomSheet.openWithActions')}
    </md-button>
    <md-bottom-sheet id="actions-sheet" headline=${t(globals.locale, 'bottomSheet.deleteItemQ')}>
      <p>${t(globals.locale, 'bottomSheet.deleteItemBody')}</p>
      <md-button slot="actions" variant="filled" @click=${() => getSheet('actions-sheet')?.close()}>
        ${t(globals.locale, 'delete')}
      </md-button>
      <md-button slot="actions" variant="text" @click=${() => getSheet('actions-sheet')?.close()}>
        ${t(globals.locale, 'cancel')}
      </md-button>
    </md-bottom-sheet>
  `,
};

/* ─── Scrollable Content ──────────────────────────────────── */

/**
 * Long content automatically scrolls inside the sheet. The scrollable
 * area is a plain scroll container; the optional top / bottom dividers
 * separate it from the headline and the action bar.
 */
export const ScrollableContent: Story = {
  render: (_args, { globals }) => html`
    <md-button variant="filled" @click=${() => getSheet('scroll-sheet')?.show()}>
      ${t(globals.locale, 'bottomSheet.openScrollable')}
    </md-button>
    <md-bottom-sheet id="scroll-sheet" headline=${t(globals.locale, 'bottomSheet.termsConditions')} top-divider bottom-divider>
      ${Array.from({ length: 20 }, (_, i) => html`
        <p>Section ${i + 1}: Lorem ipsum dolor sit amet, consectetur adipiscing elit.
        Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
        Ut enim ad minim veniam, quis nostrud exercitation ullamco.</p>
      `)}
      <md-button slot="actions" variant="filled" @click=${() => getSheet('scroll-sheet')?.close()}>
        ${t(globals.locale, 'bottomSheet.accept')}
      </md-button>
      <md-button slot="actions" variant="text" @click=${() => getSheet('scroll-sheet')?.close()}>
        ${t(globals.locale, 'bottomSheet.decline')}
      </md-button>
    </md-bottom-sheet>
  `,
};

/* ─── Non-Dismissible ─────────────────────────────────────── */

export const NonDismissible: Story = {
  render: (_args, { globals }) => html`
    <md-button variant="filled" @click=${() => getSheet('no-dismiss-sheet')?.show()}>
      ${t(globals.locale, 'bottomSheet.openNonDismissible')}
    </md-button>
    <md-bottom-sheet id="no-dismiss-sheet" headline=${t(globals.locale, 'bottomSheet.requiredAction')} scrim-dismissible="false">
      <p>${t(globals.locale, 'bottomSheet.requiredActionBody')}</p>
      <md-button slot="actions" variant="filled" @click=${() => getSheet('no-dismiss-sheet')?.close()}>
        ${t(globals.locale, 'bottomSheet.iUnderstand')}
      </md-button>
    </md-bottom-sheet>
  `,
  /** `scrim-dismissible="false"`: the scrim click is a guarded no-op — the only
   *  way out is the sheet's own action (a programmatic close ⇒ mdClose WITHOUT
   *  mdCancel, unlike a user dismiss), and focus returns to the opener. */
  play: async ({ canvasElement, step }) => {
    const sheet = await getSheetEl(canvasElement, 'no-dismiss-sheet');
    const trigger = canvasElement.querySelector('md-button') as HTMLElement;
    const container = containerOf(sheet);

    await step('Trigger opens the sheet', async () => {
      trigger.focus();
      let opened = false;
      sheet.addEventListener('mdOpen', () => (opened = true), { once: true });
      trigger.click();
      await waitFor(() => expect(sheet.open).toBe(true));
      await waitFor(() => expect(container.getAttribute('aria-hidden')).toBeNull());
      expect(opened).toBe(true);
    });

    await step('Scrim click is a guarded no-op — the sheet stays open', async () => {
      let dismissed = false;
      // Either event firing would mean the guard leaked and it closed.
      sheet.addEventListener('mdCancel', () => (dismissed = true), { once: true });
      sheet.addEventListener('mdClose', () => (dismissed = true), { once: true });

      scrimOf(sheet).click();
      // handleScrimClick bails before mutating state when not dismissible, so
      // this is synchronously inert — the dialog is still live.
      expect(sheet.open).toBe(true);
      expect(container.getAttribute('aria-hidden')).toBeNull();
      await new Promise((r) => setTimeout(r, 60)); // give any (unexpected) close a chance to land
      expect(sheet.open).toBe(true);
      expect(dismissed).toBe(false); // neither mdCancel nor mdClose fired
    });

    await step('The action button closes it — mdClose only (no mdCancel), focus restored', async () => {
      const action = sheet.querySelector('md-button[slot="actions"]') as HTMLElement;
      let cancelled = false;
      let closed = false;
      sheet.addEventListener('mdCancel', () => (cancelled = true), { once: true });
      sheet.addEventListener('mdClose', () => (closed = true), { once: true });

      action.click(); // story wires this to close() → programmatic path

      await waitFor(() => expect(sheet.open).toBe(false));
      await waitFor(() => expect(container.getAttribute('aria-hidden')).toBe('true'));
      expect(closed).toBe(true); // programmatic close emits mdClose…
      expect(cancelled).toBe(false); // …but NOT mdCancel — that's for user dismissal only
      await waitFor(() => expect(document.activeElement).toBe(trigger)); // focus restored to opener
      await new Promise((r) => setTimeout(r, 300));
    });
  },
};

/* ─── Drag to Dismiss ─────────────────────────────────────── */

export const DragToDismiss: Story = {
  render: (_args, { globals }) => html`
    <div style="display: flex; flex-direction: column; gap: 12px; align-items: flex-start;">
      <md-button variant="filled" @click=${() => getSheet('drag-sheet')?.show()}>
        ${t(globals.locale, 'bottomSheet.openDraggable')}
      </md-button>
      <p style="margin: 0; max-width: 480px; line-height: 1.5; color: var(--md-sys-color-on-surface-variant, #49454F);">
        ${t(globals.locale, 'bottomSheet.dragIntro')}
      </p>
    </div>
    <md-bottom-sheet id="drag-sheet" headline=${t(globals.locale, 'bottomSheet.dragMeDown')}>
      <div style="display: flex; flex-direction: column; align-items: center; gap: 16px; padding-block: 24px;">
        <span class="material-symbols-outlined" style="font-size: 48px; color: var(--md-sys-color-primary, #6750A4);">swipe_down</span>
        <p style="text-align: center; max-width: 280px; margin: 0;">
          ${t(globals.locale, 'bottomSheet.dragInstruction')}
        </p>
      </div>
    </md-bottom-sheet>
  `,
};

/* ─── RTL ─────────────────────────────────────────────────── */

export const RTL: Story = {
  render: () => html`
    <style>
      #rtl-sheet { --md-bottom-sheet-content-padding-inline: 8px; }
    </style>
    <div dir="rtl">
      <md-button variant="filled" @click=${() => getSheet('rtl-sheet')?.show()}>
        فتح الورقة السفلية
      </md-button>
      <md-bottom-sheet id="rtl-sheet" headline="مشاركة" closeable>
        <md-list>
          <md-list-item headline="مشاركة عبر البريد" leading-icon="email"></md-list-item>
          <md-list-item headline="نسخ الرابط" leading-icon="link"></md-list-item>
          <md-list-item headline="حفظ" leading-icon="save"></md-list-item>
        </md-list>
      </md-bottom-sheet>
    </div>
  `,
};

/* ─── Dark Theme ──────────────────────────────────────────── */

export const DarkTheme: Story = {
  render: (_args, { globals }) => html`
    <style>
      #dark-sheet { --md-bottom-sheet-content-padding-inline: 8px; }
    </style>
    <div data-theme="dark" style="background: var(--md-sys-color-surface, #1C1B1F); padding: 24px; border-radius: 16px;">
      <md-button variant="filled" @click=${() => getSheet('dark-sheet')?.show()}>
        ${t(globals.locale, 'bottomSheet.openDarkTheme')}
      </md-button>
      <md-bottom-sheet id="dark-sheet" variant="detached" headline=${t(globals.locale, 'bottomSheet.options')}>
        <md-list>
          <md-list-item headline=${t(globals.locale, 'edit')} leading-icon="edit"></md-list-item>
          <md-list-item headline=${t(globals.locale, 'bottomSheet.duplicate')} leading-icon="content_copy"></md-list-item>
          <md-list-item headline=${t(globals.locale, 'delete')} leading-icon="delete"></md-list-item>
        </md-list>
      </md-bottom-sheet>
    </div>
  `,
};

/* ─── Custom CSS ──────────────────────────────────────────── */

export const CustomCSS: Story = {
  render: () => html`
    <style>
      #custom-sheet {
        --md-bottom-sheet-container-color: var(--md-sys-color-primary-container, #EADDFF);
        --md-bottom-sheet-headline-color: var(--md-sys-color-on-primary-container, #21005D);
        --md-bottom-sheet-container-shape: 16px;
        --md-bottom-sheet-drag-handle-color: var(--md-sys-color-on-primary-container, #21005D);
      }
    </style>
    <md-button variant="filled" @click=${() => getSheet('custom-sheet')?.show()}>
      Custom Themed Sheet
    </md-button>
    <md-bottom-sheet id="custom-sheet" headline="Custom Theme">
      <p>This sheet uses custom CSS properties for a branded look.</p>
    </md-bottom-sheet>
  `,
};

/* ─── CSS Parts ───────────────────────────────────────────── */

export const CSSParts: Story = {
  render: () => html`
    <style>
      #parts-sheet::part(container) {
        border: 2px solid var(--md-sys-color-primary, #6750A4);
      }
      #parts-sheet::part(drag-handle-indicator) {
        background-color: var(--md-sys-color-primary, #6750A4);
        opacity: 0.8;
        inline-size: 48px;
      }
      #parts-sheet::part(headline) {
        font-style: italic;
        color: var(--md-sys-color-primary, #6750A4);
      }
      #parts-sheet::part(content) {
        padding-inline: 32px;
      }
    </style>
    <md-button variant="filled" @click=${() => getSheet('parts-sheet')?.show()}>
      Parts Styled Sheet
    </md-button>
    <md-bottom-sheet id="parts-sheet" headline="CSS Parts Demo">
      <p>This sheet's internal elements are styled using <code>::part()</code> selectors.</p>
    </md-bottom-sheet>
  `,
};

/* ─── Music Player ────────────────────────────────────────── */

export const MusicPlayer: Story = {
  render: (_args, { globals }) => html`
    <md-button variant="filled" @click=${() => getSheet('music-sheet')?.show()}>
      ${t(globals.locale, 'bottomSheet.nowPlaying')}
    </md-button>
    <md-bottom-sheet id="music-sheet" variant="detached">
      <div style="text-align: center; padding-block: 8px;">
        <div style="inline-size: 200px; block-size: 200px; margin: 0 auto 16px; border-radius: 16px; background: linear-gradient(135deg, var(--md-sys-color-primary-container, #EADDFF), var(--md-sys-color-tertiary-container, #FFD8E4)); display: flex; align-items: center; justify-content: center;">
          <span class="material-symbols-outlined" style="font-size: 64px; color: var(--md-sys-color-on-primary-container, #21005D);">music_note</span>
        </div>
        <div style="font-size: 20px; font-weight: 500; margin-bottom: 4px;">Song Title</div>
        <div style="font-size: 14px; color: var(--md-sys-color-on-surface-variant, #49454F);">Artist Name</div>
        <div style="display: flex; justify-content: center; gap: 24px; margin-top: 24px;">
          <md-icon-button variant="standard" icon="skip_previous"></md-icon-button>
          <md-icon-button variant="filled" icon="play_arrow"></md-icon-button>
          <md-icon-button variant="standard" icon="skip_next"></md-icon-button>
        </div>
      </div>
    </md-bottom-sheet>
  `,
};

/* ─── Filter Panel ────────────────────────────────────────── */

export const FilterPanel: Story = {
  render: (_args, { globals }) => html`
    <md-button variant="filled" @click=${() => getSheet('filter-sheet')?.show()}>
      ${t(globals.locale, 'bottomSheet.filters')}
    </md-button>
    <md-bottom-sheet id="filter-sheet" headline=${t(globals.locale, 'bottomSheet.filters')}>
      <div style="margin-bottom: 16px;">
        <div style="font-weight: 500; margin-bottom: 8px;">${t(globals.locale, 'bottomSheet.category')}</div>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <md-chip>${t(globals.locale, 'bottomSheet.electronics')}</md-chip>
          <md-chip>${t(globals.locale, 'bottomSheet.clothing')}</md-chip>
          <md-chip>${t(globals.locale, 'bottomSheet.books')}</md-chip>
          <md-chip>${t(globals.locale, 'home')}</md-chip>
        </div>
      </div>
      <md-divider></md-divider>
      <div style="margin-block: 16px;">
        <div style="font-weight: 500; margin-bottom: 8px;">${t(globals.locale, 'bottomSheet.priceRange')}</div>
        <md-slider min="0" max="500" value="250" value-indicator></md-slider>
      </div>
      <md-divider></md-divider>
      <div style="margin-top: 16px;">
        <div style="font-weight: 500; margin-bottom: 8px;">${t(globals.locale, 'bottomSheet.availability')}</div>
        <md-list selection-mode="multi-select">
          <md-list-item headline=${t(globals.locale, 'bottomSheet.inStock')}>
            <md-checkbox slot="trailing"></md-checkbox>
          </md-list-item>
          <md-list-item headline=${t(globals.locale, 'bottomSheet.preOrder')}>
            <md-checkbox slot="trailing"></md-checkbox>
          </md-list-item>
          <md-list-item headline=${t(globals.locale, 'bottomSheet.outOfStock')}>
            <md-checkbox slot="trailing"></md-checkbox>
          </md-list-item>
        </md-list>
      </div>
      <md-button slot="actions" variant="filled" @click=${() => getSheet('filter-sheet')?.close()}>
        ${t(globals.locale, 'bottomSheet.apply')}
      </md-button>
      <md-button slot="actions" variant="text" @click=${() => getSheet('filter-sheet')?.close()}>
        ${t(globals.locale, 'bottomSheet.clearAll')}
      </md-button>
    </md-bottom-sheet>
  `,
};

/* ═══════════════════════════════════════════════════════════
   ACCESSIBILITY STORIES
   ═══════════════════════════════════════════════════════════ */

export const Accessibility: Story = {
  render: () => html`
    <div style="display: flex; flex-direction: column; gap: 20px; align-items: flex-start; max-width: 600px;">
      <h3 style="margin: 0;">Accessibility Features</h3>
      <p style="margin: 0; line-height: 1.6;">
        Both <code>standard</code> and <code>detached</code> bottom sheets are modal dialogs —
        they implement the WAI-ARIA Dialog pattern with full keyboard and screen reader support.
        Open each demo to test.
      </p>

      <div style="display: flex; gap: 12px; flex-wrap: wrap;">
        <md-button variant="filled" @click=${() => getSheet('a11y-focus')?.show()}>
          Focus Trap
        </md-button>
        <md-button variant="outlined" @click=${() => getSheet('a11y-roles')?.show()}>
          ARIA Roles
        </md-button>
        <md-button variant="tonal" @click=${() => getSheet('a11y-escape')?.show()}>
          Keyboard Shortcuts
        </md-button>
      </div>

      <md-bottom-sheet id="a11y-focus" headline="Focus Trap Demo">
        <p>Focus is trapped inside this sheet. Press
          <kbd style="${kbdStyle}">Tab</kbd> and <kbd style="${kbdStyle}">Shift+Tab</kbd>
          — focus cycles through the interactive elements without escaping to the page behind.
        </p>
        <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 16px;">
          <md-text-field label="First name"></md-text-field>
          <md-text-field label="Last name"></md-text-field>
          <md-text-field label="Email address"></md-text-field>
        </div>
        <md-button slot="actions" variant="filled" @click=${() => getSheet('a11y-focus')?.close()}>
          Submit
        </md-button>
        <md-button slot="actions" variant="text" @click=${() => getSheet('a11y-focus')?.close()}>
          Cancel
        </md-button>
      </md-bottom-sheet>

      <md-bottom-sheet id="a11y-roles" headline="ARIA Roles & Attributes">
        <p style="margin-top: 0;">Bottom sheets have the following ARIA attributes applied automatically — identical for both variants:</p>
        <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 12px;">
          <div style="display: flex; gap: 12px; padding: 12px; border-radius: 8px; background: var(--md-sys-color-surface-container, #f3edf7);">
            <code style="font-weight: 600; white-space: nowrap;">role="dialog"</code>
            <span>Announces the container as a dialog to screen readers</span>
          </div>
          <div style="display: flex; gap: 12px; padding: 12px; border-radius: 8px; background: var(--md-sys-color-surface-container, #f3edf7);">
            <code style="font-weight: 600; white-space: nowrap;">aria-modal="true"</code>
            <span>Signals that background content is inert</span>
          </div>
          <div style="display: flex; gap: 12px; padding: 12px; border-radius: 8px; background: var(--md-sys-color-surface-container, #f3edf7);">
            <code style="font-weight: 600; white-space: nowrap;">aria-labelledby</code>
            <span>Points to the headline element for accessible naming</span>
          </div>
          <div style="display: flex; gap: 12px; padding: 12px; border-radius: 8px; background: var(--md-sys-color-surface-container, #f3edf7);">
            <code style="font-weight: 600; white-space: nowrap;">aria-hidden="true"</code>
            <span>Applied to the container when the sheet is closed</span>
          </div>
        </div>
      </md-bottom-sheet>

      <md-bottom-sheet id="a11y-escape" headline="Keyboard Shortcuts">
        <p style="margin-top: 0;">Press <kbd style="${kbdStyle}">Escape</kbd> to close this sheet. Focus returns to the button that opened it.</p>
        <div style="margin-top: 16px; padding: 16px; border-radius: 12px; background: var(--md-sys-color-surface-container, #f3edf7);">
          <div style="font-weight: 500; margin-bottom: 12px;">Keyboard reference</div>
          <div style="display: grid; grid-template-columns: auto 1fr; gap: 8px 16px; font-size: 14px; align-items: center;">
            <kbd style="${kbdStyle}">Escape</kbd><span>Close the sheet</span>
            <kbd style="${kbdStyle}">Tab</kbd><span>Move to the next focusable element</span>
            <kbd style="${kbdStyle}">Shift+Tab</kbd><span>Move to the previous focusable element</span>
          </div>
        </div>
      </md-bottom-sheet>
    </div>
  `,
};

export const FocusRestoration: Story = {
  render: () => html`
    <div style="display: flex; flex-direction: column; gap: 16px; align-items: flex-start; max-width: 500px;">
      <h3 style="margin: 0;">Focus Restoration</h3>
      <p style="margin: 0; line-height: 1.6;">
        When a bottom sheet closes, focus returns to the element that opened it.
        Click any button below, then close the sheet with <kbd style="${kbdStyle}">Escape</kbd>
        or the action button — focus returns to the trigger.
      </p>
      <div style="display: flex; gap: 12px; flex-wrap: wrap;">
        <md-button variant="filled" @click=${() => getSheet('restore-a')?.show()}>
          Trigger A
        </md-button>
        <md-button variant="outlined" @click=${() => getSheet('restore-b')?.show()}>
          Trigger B
        </md-button>
        <md-button variant="tonal" @click=${() => getSheet('restore-c')?.show()}>
          Trigger C
        </md-button>
      </div>

      <md-bottom-sheet id="restore-a" headline="Opened by Trigger A">
        <p>Close this sheet — focus will return to <strong>Trigger A</strong>.</p>
        <md-button slot="actions" variant="filled" @click=${() => getSheet('restore-a')?.close()}>
          Done
        </md-button>
      </md-bottom-sheet>

      <md-bottom-sheet id="restore-b" headline="Opened by Trigger B">
        <p>Close this sheet — focus will return to <strong>Trigger B</strong>.</p>
        <md-button slot="actions" variant="filled" @click=${() => getSheet('restore-b')?.close()}>
          Done
        </md-button>
      </md-bottom-sheet>

      <md-bottom-sheet id="restore-c" headline="Opened by Trigger C">
        <p>Close this sheet — focus will return to <strong>Trigger C</strong>.</p>
        <md-button slot="actions" variant="filled" @click=${() => getSheet('restore-c')?.close()}>
          Done
        </md-button>
      </md-bottom-sheet>
    </div>
  `,
  /** Focus restoration, scripted (see the Interactions panel): opening pulls
   *  focus off Trigger A into the trapped dialog, and closing via the sheet's
   *  own action button hands focus back to the exact node that opened it — the
   *  before-open activeElement is identical to the after-close activeElement. */
  play: async ({ canvasElement, step }) => {
    const sheet = await getSheetEl(canvasElement, 'restore-a');
    const trigger = canvasElement.querySelector('md-button') as HTMLElement; // Trigger A
    const container = containerOf(sheet);

    let openerBefore: Element | null = null;

    await step('Trigger A opens the sheet — focus leaves the opener, enters the dialog', async () => {
      // Closed baseline: the dialog surface is inert and the opener holds focus.
      expect(sheet.open).toBe(false);
      expect(container.getAttribute('aria-hidden')).toBe('true');
      trigger.focus();
      expect(document.activeElement).toBe(trigger);
      openerBefore = document.activeElement; // snapshot the pre-open focus owner

      let opened = false;
      sheet.addEventListener('mdOpen', () => (opened = true), { once: true });
      trigger.click(); // story @click → show()

      await waitFor(() => expect(sheet.open).toBe(true));
      // aria-hidden clears on the render flush after open flips (not synchronously).
      await waitFor(() => expect(container.getAttribute('aria-hidden')).toBeNull());
      expect(opened).toBe(true); // component actually emitted mdOpen
      // Focus was pulled off the opener into the trapped dialog.
      await waitFor(() => expect(document.activeElement).not.toBe(trigger));
    });

    await step("The sheet's Done action closes it — mdClose only, no mdCancel", async () => {
      const done = sheet.querySelector('md-button[slot="actions"]') as HTMLElement;
      // A control's click is a silent no-op before it hydrates.
      await waitFor(() => expect(done.classList.contains('hydrated')).toBe(true));

      let cancelled = false;
      let closed = false;
      sheet.addEventListener('mdCancel', () => (cancelled = true), { once: true });
      sheet.addEventListener('mdClose', () => (closed = true), { once: true });

      done.click(); // story wires this to close() → programmatic path

      await waitFor(() => expect(sheet.open).toBe(false));
      await waitFor(() => expect(container.getAttribute('aria-hidden')).toBe('true'));
      expect(closed).toBe(true); // programmatic close emits mdClose…
      expect(cancelled).toBe(false); // …but NOT mdCancel — that's for user dismissal only
    });

    await step('Focus is restored to the exact opener node', async () => {
      // The component re-focuses the node it captured at open time, so the
      // after-close activeElement is identical to the before-open snapshot.
      await waitFor(() => expect(document.activeElement).toBe(trigger));
      expect(document.activeElement).toBe(openerBefore);
      // Let the close animation settle so teardown doesn't race it.
      await new Promise((r) => setTimeout(r, 300));
    });
  },
};

export const CustomAriaLabel: Story = {
  render: () => html`
    <div style="display: flex; flex-direction: column; gap: 16px; align-items: flex-start; max-width: 500px;">
      <h3 style="margin: 0;">Custom aria-label</h3>
      <p style="margin: 0; line-height: 1.6;">
        When a sheet has no visible headline, provide an <code>aria-label</code> so
        screen readers can still announce its purpose. Without either, the fallback
        is "Bottom sheet".
      </p>
      <div style="display: flex; gap: 12px; flex-wrap: wrap;">
        <md-button variant="filled" @click=${() => getSheet('label-custom')?.show()}>
          Custom Label
        </md-button>
        <md-button variant="outlined" @click=${() => getSheet('label-fallback')?.show()}>
          Fallback Label
        </md-button>
      </div>

      <md-bottom-sheet id="label-custom">
        <p style="font-weight: 500; font-size: 16px; margin-top: 0;">Notification Settings</p>
        <p>This sheet has <code>aria-label="Notification preferences panel"</code> for screen readers.</p>
        <md-list style="margin-block-start: 12px;">
          <md-list-item headline="Push notifications">
            <md-switch slot="trailing"></md-switch>
          </md-list-item>
          <md-list-item headline="Email digest">
            <md-switch slot="trailing"></md-switch>
          </md-list-item>
          <md-list-item headline="SMS alerts">
            <md-switch slot="trailing"></md-switch>
          </md-list-item>
        </md-list>
      </md-bottom-sheet>

      <md-bottom-sheet id="label-fallback">
        <p>This sheet has no headline and no <code>aria-label</code>. The container falls back to <code>aria-label="Bottom sheet"</code>.</p>
      </md-bottom-sheet>
    </div>
  `,
};

/* ─── Form Inside Sheet ───────────────────────────────────── */

export const FormInsideSheet: Story = {
  render: (_args, { globals }) => html`
    <md-button variant="filled" @click=${() => getSheet('form-sheet')?.show()}>
      ${t(globals.locale, 'bottomSheet.openForm')}
    </md-button>
    <md-bottom-sheet id="form-sheet" headline=${t(globals.locale, 'bottomSheet.contactUs')}>
      <div style="display: flex; flex-direction: column; gap: 12px;">
        <md-text-field label=${t(globals.locale, 'bottomSheet.fullName')}></md-text-field>
        <md-text-field label=${t(globals.locale, 'bottomSheet.emailAddress')}></md-text-field>
        <md-text-field label=${t(globals.locale, 'bottomSheet.subject')}></md-text-field>
      </div>
      <md-list style="margin-block-start: 12px;">
        <md-list-item headline=${t(globals.locale, 'bottomSheet.agreeTerms')}>
          <md-checkbox slot="trailing"></md-checkbox>
        </md-list-item>
      </md-list>
      <md-button slot="actions" variant="filled" @click=${() => getSheet('form-sheet')?.close()}>
        ${t(globals.locale, 'bottomSheet.send')}
      </md-button>
      <md-button slot="actions" variant="text" @click=${() => getSheet('form-sheet')?.close()}>
        ${t(globals.locale, 'cancel')}
      </md-button>
    </md-bottom-sheet>
  `,
};

/* ═══════════════════════════════════════════════════════════
   LOCALIZATION
   ═══════════════════════════════════════════════════════════ */

/**
 * The bottom sheet is **content-agnostic** — every visible string
 * (headline, list items, action buttons, aria-label fallbacks) flows in
 * from your i18n layer. The component itself ships zero hard-coded
 * user-facing copy inside the shadow DOM.
 *
 * Set `lang` on a wrapping element (or on the sheet itself) so screen
 * readers pronounce content correctly and font fallbacks pick the right
 * glyphs. Set `dir="rtl"` to flip the chrome for Arabic, Hebrew, Persian,
 * and Urdu — both the close button and content padding use logical
 * properties internally, so they mirror automatically while the drag
 * handle stays centred.
 *
 * Pair the body with `Intl.DateTimeFormat` / `Intl.NumberFormat` /
 * `Intl.RelativeTimeFormat` for locale-correct dates, currencies, percent
 * values, and digit shapes (Arabic-Indic, Devanagari).
 */
export const Localization: Story = {
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        story:
          'Open each tile to see the bottom sheet rendered for a different ' +
          'locale. The component picks up <code>lang</code> and <code>dir</code> ' +
          'from a wrapping element, mirrors its chrome (close button position, ' +
          'content padding) via CSS logical properties for RTL scripts, and ' +
          'leaves all string content under your i18n layer\'s control. The ' +
          'inner list uses <code>Intl.DateTimeFormat</code> and ' +
          '<code>Intl.NumberFormat</code> to format the same source data ' +
          '(date, count, percent) per-locale.',
      },
    },
  },
  render: () => {
    type LocaleId = 'en' | 'fr' | 'de' | 'ja' | 'ar' | 'he' | 'hi';
    interface LocalePack {
      label: string;
      lang: string;
      dir: 'ltr' | 'rtl';
      headline: string;
      ariaLabel: string;
      open: string;
      close: string;
      apply: string;
      cancel: string;
      itemEmail: string;
      itemLink: string;
      itemDrive: string;
      itemPrint: string;
      caption: (parts: { date: string; count: string; percent: string }) => string;
    }

    const PACKS: Record<LocaleId, LocalePack> = {
      en: {
        label: 'English',
        lang: 'en-US',
        dir: 'ltr',
        headline: 'Share',
        ariaLabel: 'Share options',
        open: 'Open',
        close: 'Close',
        apply: 'Apply',
        cancel: 'Cancel',
        itemEmail: 'Share via email',
        itemLink: 'Copy link',
        itemDrive: 'Save to Drive',
        itemPrint: 'Print',
        caption: ({ date, count, percent }) =>
          `Last shared on ${date} · ${count} contacts · ${percent} success rate`,
      },
      fr: {
        label: 'Français',
        lang: 'fr-FR',
        dir: 'ltr',
        headline: 'Partager',
        ariaLabel: 'Options de partage',
        open: 'Ouvrir',
        close: 'Fermer',
        apply: 'Appliquer',
        cancel: 'Annuler',
        itemEmail: 'Partager par e-mail',
        itemLink: 'Copier le lien',
        itemDrive: 'Enregistrer sur Drive',
        itemPrint: 'Imprimer',
        caption: ({ date, count, percent }) =>
          `Dernier partage le ${date} · ${count} contacts · ${percent} de réussite`,
      },
      de: {
        label: 'Deutsch',
        lang: 'de-DE',
        dir: 'ltr',
        headline: 'Teilen',
        ariaLabel: 'Freigabeoptionen',
        open: 'Öffnen',
        close: 'Schließen',
        apply: 'Übernehmen',
        cancel: 'Abbrechen',
        itemEmail: 'Per E-Mail teilen',
        itemLink: 'Link kopieren',
        itemDrive: 'Auf Drive speichern',
        itemPrint: 'Drucken',
        caption: ({ date, count, percent }) =>
          `Zuletzt geteilt am ${date} · ${count} Kontakte · ${percent} Erfolgsquote`,
      },
      ja: {
        label: '日本語',
        lang: 'ja-JP',
        dir: 'ltr',
        headline: '共有',
        ariaLabel: '共有オプション',
        open: '開く',
        close: '閉じる',
        apply: '適用',
        cancel: 'キャンセル',
        itemEmail: 'メールで共有',
        itemLink: 'リンクをコピー',
        itemDrive: 'ドライブに保存',
        itemPrint: '印刷',
        caption: ({ date, count, percent }) =>
          `最終共有 ${date} ・ 連絡先 ${count} 件 ・ 成功率 ${percent}`,
      },
      ar: {
        label: 'العربية',
        lang: 'ar-EG',
        dir: 'rtl',
        headline: 'مشاركة',
        ariaLabel: 'خيارات المشاركة',
        open: 'فتح',
        close: 'إغلاق',
        apply: 'تطبيق',
        cancel: 'إلغاء',
        itemEmail: 'المشاركة عبر البريد الإلكتروني',
        itemLink: 'نسخ الرابط',
        itemDrive: 'حفظ في درايف',
        itemPrint: 'طباعة',
        caption: ({ date, count, percent }) =>
          `آخر مشاركة في ${date} · ${count} جهة اتصال · معدل نجاح ${percent}`,
      },
      he: {
        label: 'עברית',
        lang: 'he-IL',
        dir: 'rtl',
        headline: 'שיתוף',
        ariaLabel: 'אפשרויות שיתוף',
        open: 'פתיחה',
        close: 'סגירה',
        apply: 'החלה',
        cancel: 'ביטול',
        itemEmail: 'שיתוף בדוא״ל',
        itemLink: 'העתקת קישור',
        itemDrive: 'שמירה ב-Drive',
        itemPrint: 'הדפסה',
        caption: ({ date, count, percent }) =>
          `שותף לאחרונה בתאריך ${date} · ${count} אנשי קשר · ${percent} הצלחה`,
      },
      hi: {
        label: 'हिन्दी',
        lang: 'hi-IN',
        dir: 'ltr',
        headline: 'साझा करें',
        ariaLabel: 'साझा करने के विकल्प',
        open: 'खोलें',
        close: 'बंद करें',
        apply: 'लागू करें',
        cancel: 'रद्द करें',
        itemEmail: 'ईमेल से साझा करें',
        itemLink: 'लिंक कॉपी करें',
        itemDrive: 'ड्राइव में सहेजें',
        itemPrint: 'प्रिंट',
        caption: ({ date, count, percent }) =>
          `अंतिम बार ${date} को साझा · ${count} संपर्क · ${percent} सफलता दर`,
      },
    };

    const sourceDate = new Date(2026, 4, 21);
    const sourceCount = 1284;
    const sourceRatio = 0.732;

    return html`
      <style>
        .l10n-bs {
          max-inline-size: 1180px;
          margin: 0 auto;
          padding: 24px;
          display: grid;
          gap: 32px;
          font-family: var(--md-sys-typescale-body-large-font-family, Roboto, sans-serif);
        }
        .l10n-bs h3 {
          margin: 0 0 6px;
          font: 500 13px/18px Roboto, sans-serif;
          color: var(--md-sys-color-on-surface-variant, #49454F);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .l10n-bs p {
          margin: 0 0 14px;
          font: 400 13px/20px Roboto, sans-serif;
          color: var(--md-sys-color-on-surface-variant, #49454F);
          max-inline-size: 760px;
        }
        .l10n-bs p code {
          background: var(--md-sys-color-surface-container, #F3EDF7);
          padding: 1px 6px;
          border-radius: 4px;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 12px;
        }
        .l10n-bs__grid {
          display: grid;
          gap: 16px;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        }
        .l10n-bs__tile {
          padding: 16px;
          border-radius: 16px;
          background: var(--md-sys-color-surface-container-lowest, #FFFBFE);
          border: 1px solid var(--md-sys-color-outline-variant, #CAC4D0);
          display: grid;
          gap: 12px;
        }
        .l10n-bs__head {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 12px;
        }
        .l10n-bs__name {
          font: 500 14px/20px Roboto, sans-serif;
          color: var(--md-sys-color-on-surface, #1C1B1F);
        }
        .l10n-bs__meta {
          font: 400 11px/14px ui-monospace, SFMono-Regular, Menlo, monospace;
          color: var(--md-sys-color-on-surface-variant, #49454F);
        }
        .l10n-bs__caption {
          margin: 0;
          font: 400 11px/16px ui-monospace, SFMono-Regular, Menlo, monospace;
          color: var(--md-sys-color-on-surface-variant, #49454F);
        }
        /* Inset the list inside each localized sheet so list-item content
           aligns with the headline (8 + 16 = 24 px). */
        md-bottom-sheet[data-l10n]::part(content) {
          padding-inline: 8px;
        }
      </style>

      <div class="l10n-bs">
        <!-- Section 1 — locale tiles ─────────────────────────────── -->
        <section>
          <h3>1 · Translated content + RTL chrome</h3>
          <p>
            Each tile opens its own bottom sheet wrapped in
            <code>lang</code> and <code>dir</code> attributes. Headlines,
            list items, and action button labels come from a per-locale
            dictionary; the component renders them as-is. RTL locales
            automatically flip the close button to the leading edge while
            the drag handle stays centred.
          </p>
          <div class="l10n-bs__grid">
            ${(Object.keys(PACKS) as LocaleId[]).map((id) => {
              const pack = PACKS[id];
              const sheetId = `l10n-sheet-${id}`;
              const dateFmt = new Intl.DateTimeFormat(pack.lang, {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              }).format(sourceDate);
              const countFmt = new Intl.NumberFormat(pack.lang).format(
                sourceCount,
              );
              const percentFmt = new Intl.NumberFormat(pack.lang, {
                style: 'percent',
                maximumFractionDigits: 1,
              }).format(sourceRatio);
              return html`
                <article
                  class="l10n-bs__tile"
                  lang=${pack.lang}
                  dir=${pack.dir}
                >
                  <header class="l10n-bs__head">
                    <span class="l10n-bs__name">${pack.label}</span>
                    <span class="l10n-bs__meta">
                      ${pack.lang} · ${pack.dir}
                    </span>
                  </header>
                  <md-button
                    variant="filled"
                    icon="ios_share"
                    @click=${() => getSheet(sheetId)?.show()}
                  >
                    ${pack.open}
                  </md-button>
                  <p class="l10n-bs__caption">
                    headline: <strong>${pack.headline}</strong>
                  </p>
                  <md-bottom-sheet
                    id=${sheetId}
                    data-l10n
                    headline=${pack.headline}
                    closeable
                    lang=${pack.lang}
                    dir=${pack.dir}
                  >
                    <md-list>
                      <md-list-item
                        headline=${pack.itemEmail}
                        leading-icon="email"
                      ></md-list-item>
                      <md-list-item
                        headline=${pack.itemLink}
                        leading-icon="link"
                      ></md-list-item>
                      <md-list-item
                        headline=${pack.itemDrive}
                        leading-icon="add_to_drive"
                      ></md-list-item>
                      <md-list-item
                        headline=${pack.itemPrint}
                        leading-icon="print"
                      ></md-list-item>
                    </md-list>
                    <p
                      style="margin: 16px 8px 0; font: 400 12px/18px Roboto, sans-serif; color: var(--md-sys-color-on-surface-variant, #49454F);"
                    >
                      ${pack.caption({
                        date: dateFmt,
                        count: countFmt,
                        percent: percentFmt,
                      })}
                    </p>
                    <md-button
                      slot="actions"
                      variant="filled"
                      @click=${() => getSheet(sheetId)?.close()}
                    >
                      ${pack.apply}
                    </md-button>
                    <md-button
                      slot="actions"
                      variant="text"
                      @click=${() => getSheet(sheetId)?.close()}
                    >
                      ${pack.cancel}
                    </md-button>
                  </md-bottom-sheet>
                </article>
              `;
            })}
          </div>
        </section>

        <!-- Section 2 — i18n integration patterns ─────────────────── -->
        <section>
          <h3>2 · i18n integration patterns</h3>
          <p>
            Drive every visible string from your dictionary —
            <code>i18next</code>, <code>@formatjs/intl</code>,
            <code>$localize</code>, <code>vue-i18n</code>,
            <code>svelte-i18n</code>, etc. The bottom sheet has no
            internal translatable strings:
          </p>
          <ul style="margin: 0 0 14px 20px; padding: 0; font: 400 13px/20px Roboto, sans-serif; color: var(--md-sys-color-on-surface, #1C1B1F);">
            <li>
              <code>headline</code> — the title prop / slot
            </li>
            <li>
              <code>aria-label</code> — required when no headline is
              visible (otherwise falls back to literal "Bottom sheet")
            </li>
            <li>
              Action button labels — slotted via <code>slot="actions"</code>
            </li>
            <li>
              List items, prose, form labels, etc. — your slotted content
            </li>
          </ul>
          <p>
            For RTL: set <code>dir="rtl"</code> on a wrapping element. The
            sheet's chrome (close button, content padding, headline
            ellipsis) mirrors via CSS logical properties; the drag handle
            and animations are direction-agnostic. Logical-property
            overrides on <code>::part(content)</code>, <code>::part(header)</code>,
            and <code>::part(actions)</code> work in both directions.
          </p>
        </section>
      </div>
    `;
  },
};

// ──────────────────────────────────────────────────────────────
// Responsiveness
// ──────────────────────────────────────────────────────────────
export const Responsiveness: Story = {
  name: 'Responsiveness',
  parameters: {
    docs: {
      description: {
        story:
          'Bottom sheets are responsive out of the box: the component ' +
          'ships with a built-in 640px media-query breakpoint that ' +
          'switches behavior between phone and tablet+ viewports. The ' +
          'three preset buttons below open the same sheet with different ' +
          'inline overrides on <code>--md-bottom-sheet-max-width</code> ' +
          'and <code>--md-bottom-sheet-detached-margin</code>, so you can ' +
          'preview each breakpoint without resizing your browser. The ' +
          'sheet itself is always anchored to the real viewport — the ' +
          'parent container is irrelevant because <code>md-bottom-sheet</code> ' +
          'is <code>position: fixed</code>.',
      },
    },
  },
  render: () => {
    setTimeout(() => {
      const sheet = getSheet('resp-sheet');
      if (!sheet) return;

      const PRESETS: Record<string, { maxWidth: string; margin: string; modal: boolean; label: string }> = {
        phone: {
          maxWidth: '100%',
          margin: '0px',
          modal: true,
          label: 'Phone (≤ 639px) — modal, full inline-size, anchored to bottom edge',
        },
        tablet: {
          maxWidth: '480px',
          margin: '24px',
          modal: false,
          label: 'Tablet (640–1023px) — detached, capped at 480px, 24px margin',
        },
        desktop: {
          maxWidth: '640px',
          margin: '32px',
          modal: false,
          label: 'Desktop (≥ 1024px) — detached, capped at 640px, 32px margin',
        },
      };

      const apply = (key: keyof typeof PRESETS) => {
        const p = PRESETS[key];
        sheet.style.setProperty('--md-bottom-sheet-max-width', p.maxWidth);
        sheet.style.setProperty('--md-bottom-sheet-detached-margin', p.margin);
        sheet.modal = p.modal;
        const note = document.getElementById('resp-sheet-note');
        if (note) note.textContent = p.label;
        sheet.show();
      };

      document.getElementById('resp-btn-phone')?.addEventListener('click', () => apply('phone'));
      document.getElementById('resp-btn-tablet')?.addEventListener('click', () => apply('tablet'));
      document.getElementById('resp-btn-desktop')?.addEventListener('click', () => apply('desktop'));
    }, 0);

    return html`
      <div style="display: flex; flex-direction: column; gap: 24px; max-width: 720px; text-align: start;">
        <section style="display: flex; flex-direction: column; gap: 12px;">
          <h2 style="margin: 0;">Built-in breakpoints</h2>
          <p style="margin: 0; opacity: 0.8;">
            <code>md-bottom-sheet</code> ships with a single internal media
            query at <strong>640px</strong> that swaps between two layout modes:
          </p>
          <ul style="margin: 0; padding-inline-start: 20px; line-height: 1.7; opacity: 0.85;">
            <li>
              <strong>≤ 639.98px</strong> — full inline-size container
              attached to the bottom edge, no inline margin. Ideal for
              phones; uses the entire screen width.
            </li>
            <li>
              <strong>≥ 640px</strong> — capped at the
              <code>--md-bottom-sheet-max-width</code> token (default
              <code>100%</code>) with the
              <code>--md-bottom-sheet-detached-margin</code> token (default
              <code>16px</code>) around the container. Centers automatically
              on tablet and desktop.
            </li>
          </ul>
        </section>

        <section style="display: flex; flex-direction: column; gap: 12px;">
          <h2 style="margin: 0;">Override per breakpoint in your CSS</h2>
          <p style="margin: 0; opacity: 0.8;">
            Use ordinary media queries to dial in the max-width and
            detached margin for each tier:
          </p>
          <pre style="
            margin: 0;
            padding: 16px;
            background: var(--md-sys-color-surface-container, #f3edf7);
            border-radius: 12px;
            font-size: 13px;
            line-height: 1.5;
            overflow-x: auto;
            text-align: start;
          "><code>@media (min-width: 640px) {
  md-bottom-sheet {
    --md-bottom-sheet-max-width: 480px;
    --md-bottom-sheet-detached-margin: 24px;
  }
}

@media (min-width: 1024px) {
  md-bottom-sheet {
    --md-bottom-sheet-max-width: 640px;
    --md-bottom-sheet-detached-margin: 32px;
  }
}</code></pre>
        </section>

        <section style="display: flex; flex-direction: column; gap: 12px;">
          <h2 style="margin: 0;">Preview each preset</h2>
          <p style="margin: 0; opacity: 0.8;">
            Click a button to open the same sheet with the corresponding
            preset applied. The sheet always anchors to the real viewport;
            the inline overrides only change its inline-size and inset.
          </p>

          <div style="display: flex; gap: 8px; flex-wrap: wrap; justify-content: center;">
            <md-button id="resp-btn-phone" variant="filled" icon="smartphone">Phone preset</md-button>
            <md-button id="resp-btn-tablet" variant="tonal" icon="tablet">Tablet preset</md-button>
            <md-button id="resp-btn-desktop" variant="outlined" icon="desktop_windows">Desktop preset</md-button>
          </div>

          <p
            id="resp-sheet-note"
            style="
              margin: 0;
              padding: 8px 12px;
              border: 1px dashed var(--md-sys-color-outline-variant, #cac4d0);
              border-radius: 8px;
              font-size: 12px;
              opacity: 0.75;
              text-align: center;
            "
          >
            Click a preset above to open the sheet with the matching
            inline override.
          </p>
        </section>

        <md-bottom-sheet
          id="resp-sheet"
          headline="Responsive bottom sheet"
        >
          <p style="margin: 0 0 16px;">
            The sheet itself is identical between presets — only the inline
            overrides on
            <code>--md-bottom-sheet-max-width</code> and
            <code>--md-bottom-sheet-detached-margin</code> changed, plus the
            <code>modal</code> attribute (phone preset = modal,
            tablet/desktop = detached).
          </p>
          <p style="margin: 0 0 16px;">
            On a real device this would happen automatically via a media
            query — no JavaScript involved.
          </p>
          <md-button slot="actions" variant="text">Cancel</md-button>
          <md-button slot="actions" variant="filled">Confirm</md-button>
        </md-bottom-sheet>
      </div>
    `;
  },
};

/* ═══════════════════════════════════════════════════════════
   COVERAGE — scripted edge-path interactions
   These drive the keyboard, focus-trap, close-button, drag, and
   open-on-load paths that the visual stories above never exercise.
   ═══════════════════════════════════════════════════════════ */

/**
 * Escape + focus-trap enforcement. Opening pulls focus into the shadow
 * dialog; focus that escapes to the background opener is yanked back; the
 * bottom focus-guard wraps focus to the last focusable control; and a
 * document-level Escape dismisses the sheet as a user-cancel with focus
 * restored to the opener.
 */
export const EscapeAndFocusTrap: Story = {
  render: () => html`
    <md-button variant="filled" @click=${() => getSheet('esc-trap-sheet')?.show()}>
      Open sheet
    </md-button>
    <md-bottom-sheet id="esc-trap-sheet" headline="Escape + focus trap">
      <p>Focus is trapped inside the sheet; Escape dismisses it.</p>
      <button id="esc-trap-focusable">A focusable body control</button>
    </md-bottom-sheet>
  `,
  play: async ({ canvasElement, step }) => {
    const sheet = await getSheetEl(canvasElement, 'esc-trap-sheet');
    const trigger = canvasElement.querySelector('md-button') as HTMLElement;
    const container = containerOf(sheet);

    await step('Trigger opens the sheet and pulls focus into the dialog', async () => {
      trigger.focus();
      expect(document.activeElement).toBe(trigger);
      trigger.click();
      await waitFor(() => expect(sheet.open).toBe(true));
      await waitFor(() => expect(container.getAttribute('aria-hidden')).toBeNull());
      // rAF focusFirst() moves focus off the opener into the shadow container.
      await waitFor(() => expect(document.activeElement).toBe(sheet));
    });

    await step('Focus escaping to the background opener is yanked back into the dialog', async () => {
      // Drive focus OUT of the sheet onto the background opener…
      trigger.focus();
      // …the document `focusin` trap re-runs focusFirst(), so focus lands back
      // on the sheet host (its shadow guard) instead of staying on the opener.
      await waitFor(() => expect(document.activeElement).toBe(sheet));
      expect(document.activeElement).not.toBe(trigger);
    });

    await step('The bottom focus-guard wraps focus to the last focusable element', async () => {
      const guards = sheet.shadowRoot!.querySelectorAll('.md-bottom-sheet__focus-guard');
      const bottomGuard = guards[guards.length - 1] as HTMLElement;
      const bodyBtn = sheet.querySelector('#esc-trap-focusable') as HTMLElement;
      // Focusing the trailing sentinel runs handleStartGuardFocus → focus the
      // last focusable control (the slotted native button), not the guard.
      bottomGuard.focus();
      await waitFor(() => expect(document.activeElement).toBe(bodyBtn));
    });

    await step('Escape dismisses as a user-cancel and restores focus to the opener', async () => {
      let cancelled = false;
      let closed = false;
      sheet.addEventListener('mdCancel', () => (cancelled = true), { once: true });
      sheet.addEventListener('mdClose', () => (closed = true), { once: true });

      // The component listens on document in the capture phase.
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

      await waitFor(() => expect(sheet.open).toBe(false));
      await waitFor(() => expect(container.getAttribute('aria-hidden')).toBe('true'));
      expect(cancelled).toBe(true); // Escape is a user-dismiss ⇒ mdCancel…
      expect(closed).toBe(true); // …plus mdClose
      await waitFor(() => expect(document.activeElement).toBe(trigger)); // focus restored
      await new Promise((r) => setTimeout(r, 300));
    });
  },
};

/**
 * The built-in header close icon-button (`closeable`) dismisses the sheet
 * as a user-cancel — `handleCloseClick` fires mdCancel + mdClose and focus
 * returns to the opener.
 */
export const CloseButtonDismiss: Story = {
  render: () => html`
    <md-button variant="filled" @click=${() => getSheet('close-btn-sheet')?.show()}>
      Open sheet
    </md-button>
    <md-bottom-sheet id="close-btn-sheet" headline="Closeable" closeable>
      <p>The header close icon dismisses the sheet as a user-cancel.</p>
    </md-bottom-sheet>
  `,
  play: async ({ canvasElement, step }) => {
    const sheet = await getSheetEl(canvasElement, 'close-btn-sheet');
    const trigger = canvasElement.querySelector('md-button') as HTMLElement;
    const container = containerOf(sheet);

    await step('Trigger opens the sheet', async () => {
      trigger.focus();
      trigger.click();
      await waitFor(() => expect(sheet.open).toBe(true));
      await waitFor(() => expect(container.getAttribute('aria-hidden')).toBeNull());
    });

    await step('The built-in close icon-button dismisses (mdCancel + mdClose), focus restored', async () => {
      const closeBtn = sheet.shadowRoot!.querySelector(
        '[part="close"] md-icon-button',
      ) as HTMLElement;
      expect(closeBtn).not.toBeNull();
      // A control's click is a silent no-op before it hydrates.
      await waitFor(() => expect(closeBtn.classList.contains('hydrated')).toBe(true));

      let cancelled = false;
      let closed = false;
      sheet.addEventListener('mdCancel', () => (cancelled = true), { once: true });
      sheet.addEventListener('mdClose', () => (closed = true), { once: true });

      closeBtn.click(); // onClick → handleCloseClick

      await waitFor(() => expect(sheet.open).toBe(false));
      await waitFor(() => expect(container.getAttribute('aria-hidden')).toBe('true'));
      expect(cancelled).toBe(true); // close button is a user-dismiss ⇒ mdCancel…
      expect(closed).toBe(true); // …plus mdClose
      await waitFor(() => expect(document.activeElement).toBe(trigger)); // focus restored
      await new Promise((r) => setTimeout(r, 300));
    });
  },
};

/**
 * Drag-to-dismiss, scripted with synthetic pointer events. A short drag
 * tracks the pointer via an inline `translateY` then snaps back below the
 * 100px threshold (sheet stays open); a long drag past the threshold
 * dismisses (mdCancel + mdClose) with focus restored.
 */
export const DragDismiss: Story = {
  render: () => html`
    <md-button variant="filled" @click=${() => getSheet('drag-dismiss-sheet')?.show()}>
      Open sheet
    </md-button>
    <md-bottom-sheet id="drag-dismiss-sheet" headline="Drag to dismiss">
      <p>Drag the handle down past the threshold to dismiss.</p>
    </md-bottom-sheet>
  `,
  play: async ({ canvasElement, step }) => {
    const sheet = await getSheetEl(canvasElement, 'drag-dismiss-sheet');
    const trigger = canvasElement.querySelector('md-button') as HTMLElement;
    const container = containerOf(sheet);

    await step('Trigger opens the sheet', async () => {
      trigger.focus();
      trigger.click();
      await waitFor(() => expect(sheet.open).toBe(true));
      await waitFor(() => expect(container.getAttribute('aria-hidden')).toBeNull());
    });

    const dragHandle = sheet.shadowRoot!.querySelector('[part="drag-handle"]') as HTMLElement;
    // Synthetic pointer events have no live pointer, so neutralise the capture
    // call the drag-start handler makes (it would otherwise throw).
    dragHandle.setPointerCapture = () => {};
    const drag = (type: string, clientY: number) =>
      dragHandle.dispatchEvent(
        new PointerEvent(type, { clientY, pointerId: 1, bubbles: true }),
      );

    await step('A short drag tracks the pointer then snaps back — the sheet stays open', async () => {
      drag('pointerdown', 200);
      drag('pointermove', 240); // delta 40px, below the 100px dismiss threshold
      expect(container.style.transform).toBe('translateY(40px)'); // handleDragMove applied it
      drag('pointerup', 240);
      expect(sheet.open).toBe(true); // under threshold ⇒ no dismiss
      expect(container.style.transform).toBe(''); // handleDragEnd cleared the offset
    });

    await step('A long drag past the threshold dismisses (mdCancel + mdClose), focus restored', async () => {
      let cancelled = false;
      let closed = false;
      sheet.addEventListener('mdCancel', () => (cancelled = true), { once: true });
      sheet.addEventListener('mdClose', () => (closed = true), { once: true });

      drag('pointerdown', 100);
      drag('pointermove', 300); // delta 200px, above the 100px threshold
      expect(container.style.transform).toBe('translateY(200px)');
      drag('pointerup', 300);

      await waitFor(() => expect(sheet.open).toBe(false));
      expect(cancelled).toBe(true); // drag-dismiss is a user-cancel ⇒ mdCancel…
      expect(closed).toBe(true); // …plus mdClose
      await waitFor(() => expect(document.activeElement).toBe(trigger)); // focus restored
      await new Promise((r) => setTimeout(r, 300));
    });
  },
};

/**
 * A sheet rendered with the `open` attribute already set runs its open
 * side effects (body-scroll lock) from `componentDidLoad` rather than the
 * watcher. Emptying the actions slot then fires `slotchange`, recomputing
 * `hasActions` and re-rendering without the action bar.
 */
export const InitiallyOpen: Story = {
  render: (_args, { viewMode }) => html`
    <md-bottom-sheet id="initial-open-sheet" ?open=${viewMode !== 'docs'} headline="Initially Open">
      <p>Rendered with the <code>open</code> attribute already set.</p>
      <md-button slot="actions" variant="filled">OK</md-button>
    </md-bottom-sheet>
  `,
  play: async ({ canvasElement, step }) => {
    const sheet = await getSheetEl(canvasElement, 'initial-open-sheet');
    const container = containerOf(sheet);

    await step('An open-on-load sheet runs its open side effects from componentDidLoad', async () => {
      expect(sheet.open).toBe(true);
      // onOpenChange(true) fired from componentDidLoad (not the watcher, which
      // does not run on initial value) — its body-scroll lock is the observable
      // proof the open path executed on first paint.
      await waitFor(() => expect(document.body.style.overflow).toBe('hidden'));
      expect(container.getAttribute('aria-hidden')).toBeNull();
    });

    await step('Emptying the actions slot re-renders the sheet without its action bar', async () => {
      // hasActions started true (connectedCallback saw [slot="actions"]) so the
      // actions bar and its slotchange listener are both live.
      expect(sheet.shadowRoot!.querySelector('[part="actions"]')).not.toBeNull();
      const action = sheet.querySelector('[slot="actions"]') as HTMLElement;
      action.remove(); // fires slotchange → hasActions recomputed to false
      await waitFor(() =>
        expect(sheet.shadowRoot!.querySelector('[part="actions"]')).toBeNull(),
      );
    });
  },
};

/**
 * The two focus sentinels wrap Tab / Shift+Tab back into the dialog. Focusing
 * the trailing guard jumps to the LAST focusable control (`handleStartGuardFocus`,
 * already covered elsewhere); focusing the LEADING guard jumps to the FIRST
 * focusable control (`handleEndGuardFocus`). A document `focusin` whose target is
 * already inside the dialog is left untouched — the trap only re-homes focus that
 * has escaped. The default slot is a direct child, so the focusable scan resolves
 * the two body buttons without nesting.
 */
export const FocusGuardWrap: Story = {
  render: () => html`
    <md-button variant="filled" @click=${() => getSheet('guard-wrap-sheet')?.show()}>
      Open sheet
    </md-button>
    <md-bottom-sheet id="guard-wrap-sheet" headline="Focus guard wrap">
      <p>Two focusable body controls exercise the leading and trailing sentinels.</p>
      <button id="guard-wrap-first">First body control</button>
      <button id="guard-wrap-last">Last body control</button>
    </md-bottom-sheet>
  `,
  play: async ({ canvasElement, step }) => {
    const sheet = await getSheetEl(canvasElement, 'guard-wrap-sheet');
    const trigger = canvasElement.querySelector('md-button') as HTMLElement;
    const container = containerOf(sheet);

    await step('Trigger opens the sheet', async () => {
      trigger.focus();
      trigger.click();
      await waitFor(() => expect(sheet.open).toBe(true));
      await waitFor(() => expect(container.getAttribute('aria-hidden')).toBeNull());
    });

    const guards = sheet.shadowRoot!.querySelectorAll('.md-bottom-sheet__focus-guard');
    const topGuard = guards[0] as HTMLElement;
    const bottomGuard = guards[guards.length - 1] as HTMLElement;
    const firstBtn = sheet.querySelector('#guard-wrap-first') as HTMLElement;
    const lastBtn = sheet.querySelector('#guard-wrap-last') as HTMLElement;

    await step('The leading focus-guard routes focus to focusable[0] — the sentinel itself in real DOM', async () => {
      // Shift+Tab past the top lands on the leading sentinel → handleEndGuardFocus
      // sends focus to focusable[0]. In a real browser the focus-guard spans carry
      // tabindex=0, so they match the focusable selector and sort ahead of the
      // slotted buttons — focusable[0] is this very sentinel. Re-focusing it is a
      // no-op, so document.activeElement retargets to the md-bottom-sheet host.
      topGuard.focus();
      await waitFor(() => expect(document.activeElement).toBe(sheet));
      expect(document.activeElement).not.toBe(lastBtn);
    });

    await step('The trailing focus-guard wraps focus to the LAST focusable control', async () => {
      // Tab past the end lands on the trailing sentinel → handleStartGuardFocus
      // sends focus to focusable[last] (the last slotted body button).
      bottomGuard.focus();
      await waitFor(() => expect(document.activeElement).toBe(lastBtn));
      expect(document.activeElement).not.toBe(firstBtn);
    });

    await step('A focusin already inside the dialog is left in place — not re-homed', async () => {
      firstBtn.focus();
      expect(document.activeElement).toBe(firstBtn);
      // handleDocFocusIn sees the active element is contained by the sheet and
      // returns without calling focusFirst, so focus stays exactly where it was.
      document.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 40));
      expect(document.activeElement).toBe(firstBtn);
    });

    await step('Programmatic close restores focus to the opener', async () => {
      let closed = false;
      let cancelled = false;
      sheet.addEventListener('mdClose', () => (closed = true), { once: true });
      sheet.addEventListener('mdCancel', () => (cancelled = true), { once: true });
      await sheet.close(); // @Method close() → open=false, programmatic path
      await waitFor(() => expect(sheet.open).toBe(false));
      await waitFor(() => expect(container.getAttribute('aria-hidden')).toBe('true'));
      expect(closed).toBe(true); // mdClose fires…
      expect(cancelled).toBe(false); // …but not mdCancel on a programmatic close
      await waitFor(() => expect(document.activeElement).toBe(trigger));
      await new Promise((r) => setTimeout(r, 300));
    });
  },
};

/**
 * A slotted `close` element replaces the built-in close icon-button. The
 * `slot="close"` assignment fires the slotchange that sets `hasSlottedClose`,
 * and the custom control drives a programmatic `close()` (mdClose without
 * mdCancel), with focus restored to the opener.
 */
export const SlottedCloseDismiss: Story = {
  render: () => html`
    <md-button variant="filled" @click=${() => getSheet('slotted-close-sheet')?.show()}>
      Open sheet
    </md-button>
    <md-bottom-sheet id="slotted-close-sheet" headline="Slotted close" closeable>
      <md-button
        slot="close"
        variant="text"
        size="sm"
        @click=${() => getSheet('slotted-close-sheet')?.close()}
      >
        Done
      </md-button>
      <p>The default close icon-button is replaced by a slotted text button.</p>
    </md-bottom-sheet>
  `,
  play: async ({ canvasElement, step }) => {
    const sheet = await getSheetEl(canvasElement, 'slotted-close-sheet');
    const trigger = canvasElement.querySelector('md-button') as HTMLElement;
    const container = containerOf(sheet);

    await step('Trigger opens the sheet', async () => {
      trigger.focus();
      trigger.click();
      await waitFor(() => expect(sheet.open).toBe(true));
      await waitFor(() => expect(container.getAttribute('aria-hidden')).toBeNull());
    });

    await step('The close slot projects the custom control (hasSlottedClose path)', async () => {
      const closePart = sheet.shadowRoot!.querySelector('[part="close"]') as HTMLElement;
      expect(closePart).not.toBeNull();
      const closeSlot = closePart.querySelector('slot[name="close"]') as HTMLSlotElement;
      // The slotchange that ran on assignment computed hasSlottedClose from exactly
      // this — a non-empty assigned set for the close slot.
      expect(closeSlot.assignedElements().length).toBeGreaterThan(0);
      const projected = closeSlot.assignedElements()[0] as HTMLElement;
      expect(projected.getAttribute('slot')).toBe('close');
      expect(projected.tagName.toLowerCase()).toBe('md-button'); // custom, not the icon-button fallback
    });

    await step('The slotted close control dismisses (mdClose only), focus restored', async () => {
      const slottedClose = sheet.querySelector('[slot="close"]') as HTMLElement;
      // A control's click is a silent no-op before it hydrates.
      await waitFor(() => expect(slottedClose.classList.contains('hydrated')).toBe(true));

      let closed = false;
      let cancelled = false;
      sheet.addEventListener('mdClose', () => (closed = true), { once: true });
      sheet.addEventListener('mdCancel', () => (cancelled = true), { once: true });

      slottedClose.click(); // story wires @click → close() (programmatic path)

      await waitFor(() => expect(sheet.open).toBe(false));
      await waitFor(() => expect(container.getAttribute('aria-hidden')).toBe('true'));
      expect(closed).toBe(true); // programmatic close ⇒ mdClose…
      expect(cancelled).toBe(false); // …but NOT mdCancel — that's for user dismissal only
      await waitFor(() => expect(document.activeElement).toBe(trigger));
      await new Promise((r) => setTimeout(r, 300));
    });
  },
};
