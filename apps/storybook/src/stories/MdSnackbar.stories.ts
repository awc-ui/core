import type { Meta, StoryObj } from '@storybook/web-components';
import { expect, waitFor } from 'storybook/test';
import { html } from 'lit';
import { t } from '../i18n';

/** Shadow-piercing helpers for play(): testing-library queries can't cross
 *  shadow roots, so interactions address the real internals directly. */
type SnackEl = HTMLElement & {
  open: boolean;
  autoHide: boolean;
  autoHideDuration: number;
  show: () => Promise<void>;
  hide: (reason?: 'auto' | 'action' | 'close') => Promise<void>;
};
const getSnackbar = async (canvasElement: HTMLElement): Promise<SnackEl> => {
  const el = canvasElement.querySelector('md-snackbar') as SnackEl;
  await waitFor(() => expect(el.classList.contains('hydrated')).toBe(true));
  return el;
};
/** The action button + close icon are slot-fallback content in the shadow root. */
const actionBtn = (el: SnackEl) =>
  el.shadowRoot!.querySelector('.md-snackbar__action-btn') as HTMLElement | null;
const closeBtn = (el: SnackEl) =>
  el.shadowRoot!.querySelector('.md-snackbar__close md-icon-button') as HTMLElement | null;

const meta: Meta = {
  title: 'Communication/Snackbar',
  component: 'md-snackbar',
  tags: ['autodocs'],
  parameters: {
    docs: {
      source: { language: 'html' },
    },
  },
  argTypes: {
    message: {
      control: 'text',
      description: 'Primary supporting text',
    },
    action: {
      control: 'text',
      description: 'Action button label',
    },
    closeable: {
      control: 'boolean',
      description: 'Show close (X) icon button',
    },
    autoHide: {
      control: 'boolean',
      description: 'Auto-dismiss after duration',
    },
    autoHideDuration: {
      control: 'number',
      description: 'Time in ms before auto-dismiss',
    },
    position: {
      control: 'select',
      options: [
        'bottom', 'bottom-start', 'bottom-end',
        'top', 'top-start', 'top-end',
        'start', 'end', 'center',
      ],
      description: 'Screen position',
    },
    stacked: {
      control: 'boolean',
      description: 'Stack action below text',
    },
    politeness: {
      control: 'select',
      options: ['polite', 'assertive'],
      description: 'Live-region politeness (assertive → role=alert for errors)',
    },
    dismissLabel: { control: 'text', description: 'Accessible label for the close button' },
  },
  args: {
    message: 'File saved successfully',
    action: '',
    closeable: false,
    autoHide: false,
    autoHideDuration: 4000,
    position: 'bottom',
    stacked: false,
  },
};
export default meta;
type Story = StoryObj;

/* ─── Helper ──────────────────────────────────────────────── */

function showSnackbar(selector: string) {
  return () => {
    const el = document.querySelector(selector) as any;
    el?.show();
  };
}

/* ─── Playground ──────────────────────────────────────────── */

export const Playground: Story = {
  render: (args, { globals }) => html`
    <md-button variant="filled" @click=${showSnackbar('#playground-snack')}>
      ${t(globals.locale, 'snackbar.show')}
    </md-button>
    <md-snackbar
      id="playground-snack"
      message=${args.message}
      action=${args.action || ''}
      ?closeable=${args.closeable}
      ?auto-hide=${args.autoHide}
      auto-hide-duration=${args.autoHideDuration}
      position=${args.position}
      ?stacked=${args.stacked}
    ></md-snackbar>
  `,
};

/* ─── Single Line ─────────────────────────────────────────── */

export const SingleLine: Story = {
  render: (_args, { globals }) => html`
    <md-button variant="filled" @click=${showSnackbar('#single')}>
      ${t(globals.locale, 'snackbar.show')}
    </md-button>
    <md-snackbar id="single" message=${t(globals.locale, 'snackbar.file-saved')}></md-snackbar>
  `,
};

/* ─── Single Line with Action ─────────────────────────────── */

export const SingleLineWithAction: Story = {
  render: (_args, { globals }) => html`
    <md-button variant="filled" @click=${showSnackbar('#single-action')}>
      ${t(globals.locale, 'snackbar.show')}
    </md-button>
    <md-snackbar id="single-action" message=${t(globals.locale, 'snackbar.item-deleted')} action=${t(globals.locale, 'snackbar.undo')}></md-snackbar>
  `,
  /** The action button emits mdAction and restarts auto-hide — it does NOT
   *  dismiss the snackbar (contrary to a naive expectation; see spec). */
  play: async ({ canvasElement, step }) => {
    const el = await getSnackbar(canvasElement);

    await step('show() opens the snackbar and emits mdOpen', async () => {
      expect(el.open).toBe(false); // closed until shown
      let opened = false;
      el.addEventListener('mdOpen', () => (opened = true), { once: true });
      await el.show();
      await waitFor(() => expect(el.open).toBe(true));
      await waitFor(() => expect(el.classList.contains('md-snackbar--open')).toBe(true));
      expect(opened).toBe(true); // mdOpen actually fired
    });

    await step('Clicking "Undo" emits mdAction but does NOT dismiss (guard)', async () => {
      const btn = actionBtn(el)!;
      expect(btn.textContent).toContain('Undo');
      let actioned = false;
      let closed = false;
      el.addEventListener('mdAction', () => (actioned = true), { once: true });
      el.addEventListener('mdClose', () => (closed = true), { once: true });
      btn.click();
      await waitFor(() => expect(actioned).toBe(true)); // mdAction observed
      // The action restarts the auto-hide timer; it never closes the snackbar.
      expect(closed).toBe(false);
      expect(el.open).toBe(true);
    });

    await step('Enter and Space on the action button activate it (md-button keyboard → click → mdAction)', async () => {
      const btn = actionBtn(el)!;
      btn.focus();
      let count = 0;
      const bump = () => (count += 1);
      el.addEventListener('mdAction', bump);
      // The action is an md-button: its own keydown handler translates Enter/Space
      // into a native click (el.click()), which the snackbar's onClick turns into
      // mdAction — so a synthetic keydown on the button still drives the action.
      btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await waitFor(() => expect(count).toBe(1)); // Enter → mdAction
      btn.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
      await waitFor(() => expect(count).toBe(2)); // Space → mdAction
      el.removeEventListener('mdAction', bump);
      expect(el.open).toBe(true); // keyboard activation never dismisses
    });
  },
};

/* ─── Two Lines ───────────────────────────────────────────── */

export const TwoLines: Story = {
  render: (_args, { globals }) => html`
    <md-button variant="filled" @click=${showSnackbar('#two-lines')}>
      ${t(globals.locale, 'snackbar.show')}
    </md-button>
    <md-snackbar
      id="two-lines"
      message=${t(globals.locale, 'snackbar.wrap-long')}
    ></md-snackbar>
  `,
};

/* ─── Two Lines with Action ───────────────────────────────── */

export const TwoLinesWithAction: Story = {
  render: (_args, { globals }) => html`
    <md-button variant="filled" @click=${showSnackbar('#two-lines-action')}>
      ${t(globals.locale, 'snackbar.show')}
    </md-button>
    <md-snackbar
      id="two-lines-action"
      message=${t(globals.locale, 'snackbar.wrap-long-action')}
      action=${t(globals.locale, 'snackbar.undo')}
    ></md-snackbar>
  `,
};

/* ─── Stacked (longer action + close) ─────────────────────── */

export const Stacked: Story = {
  render: (_args, { globals }) => html`
    <md-button variant="filled" @click=${showSnackbar('#stacked')}>
      ${t(globals.locale, 'snackbar.show')}
    </md-button>
    <md-snackbar
      id="stacked"
      message=${t(globals.locale, 'snackbar.moved-to-trash')}
      action=${t(globals.locale, 'snackbar.undo-action')}
      closeable
      stacked
    ></md-snackbar>
  `,
};

/* ─── With Close Icon ─────────────────────────────────────── */

export const WithCloseIcon: Story = {
  render: (_args, { globals }) => html`
    <md-button variant="filled" @click=${showSnackbar('#closeable')}>
      ${t(globals.locale, 'snackbar.show')}
    </md-button>
    <md-snackbar
      id="closeable"
      message=${t(globals.locale, 'snackbar.connection-restored')}
      closeable
    ></md-snackbar>
  `,
  /** The close (X) icon dismisses the snackbar and emits mdClose{reason:'close'}. */
  play: async ({ canvasElement, step }) => {
    const el = await getSnackbar(canvasElement);

    await step('show() opens the snackbar', async () => {
      expect(el.open).toBe(false);
      let opened = false;
      el.addEventListener('mdOpen', () => (opened = true), { once: true });
      await el.show();
      await waitFor(() => expect(el.open).toBe(true));
      expect(opened).toBe(true);
    });

    await step('Close icon dismisses it and emits mdClose{reason:"close"}', async () => {
      const close = closeBtn(el)!;
      await waitFor(() => expect(close.classList.contains('hydrated')).toBe(true));
      let detail: { reason: string } | undefined;
      el.addEventListener('mdClose', (e) => (detail = (e as CustomEvent).detail), { once: true });
      close.click();
      // dismissAfterRipple waits ~150ms before flipping open → false.
      await waitFor(() => expect(el.open).toBe(false));
      await waitFor(() => expect(el.classList.contains('md-snackbar--open')).toBe(false));
      expect(detail?.reason).toBe('close'); // payload carries the dismissal reason
      await new Promise((r) => setTimeout(r, 300)); // let the close animation settle
    });
  },
};

/* ─── With Action and Close ───────────────────────────────── */

export const WithActionAndClose: Story = {
  render: (_args, { globals }) => html`
    <md-button variant="filled" @click=${showSnackbar('#action-close')}>
      ${t(globals.locale, 'snackbar.show')}
    </md-button>
    <md-snackbar
      id="action-close"
      message=${t(globals.locale, 'snackbar.message-archived')}
      action=${t(globals.locale, 'snackbar.view')}
      closeable
    ></md-snackbar>
  `,
};

/* ─── Non-dismissive ──────────────────────────────────────── */

export const NonDismissive: Story = {
  render: (_args, { globals }) => html`
    <md-button variant="filled" @click=${showSnackbar('#non-dismissive')}>
      ${t(globals.locale, 'snackbar.show')}
    </md-button>
    <md-snackbar
      id="non-dismissive"
      message=${t(globals.locale, 'snackbar.no-connection')}
      action=${t(globals.locale, 'snackbar.retry')}
      .autoHide=${false}
    ></md-snackbar>
  `,
  /** Non-dismissive = auto-hide disabled and no close icon: the only exits are
   *  the app's own logic or the action. It never self-dismisses on a timer. */
  play: async ({ canvasElement, step }) => {
    const el = await getSnackbar(canvasElement);

    await step('No close affordance and auto-hide is disabled (guard)', async () => {
      expect(el.autoHide).toBe(false); // .autoHide=${false}
      // Not `closeable` → the X icon (and its wrapper) are never rendered.
      expect(closeBtn(el)).toBeNull();
      expect(el.shadowRoot!.querySelector('.md-snackbar__close')).toBeNull();
    });

    await step('Showing never schedules an auto-dismiss — stays open past its duration (guard)', async () => {
      el.autoHideDuration = 80; // shorten so the "would-have-hidden" window elapses fast
      let closed = false;
      el.addEventListener('mdClose', () => (closed = true));
      await el.show();
      await waitFor(() => expect(el.open).toBe(true));
      // Well past the (shortened) duration: an auto-hiding snackbar would have
      // fired mdClose{reason:'auto'} and closed by now — this one must not.
      await new Promise((r) => setTimeout(r, 220));
      expect(el.open).toBe(true);
      expect(closed).toBe(false); // no mdClose ever emitted
    });
  },
};

/* ─── Positions ───────────────────────────────────────────── */

export const Positions: Story = {
  render: () => html`
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; max-width: 480px;">
      <md-button variant="outlined" @click=${showSnackbar('#pos-tl')}>Top-start</md-button>
      <md-button variant="outlined" @click=${showSnackbar('#pos-tc')}>Top</md-button>
      <md-button variant="outlined" @click=${showSnackbar('#pos-tr')}>Top-end</md-button>
      <md-button variant="outlined" @click=${showSnackbar('#pos-ml')}>Start</md-button>
      <md-button variant="outlined" @click=${showSnackbar('#pos-mc')}>Center</md-button>
      <md-button variant="outlined" @click=${showSnackbar('#pos-mr')}>End</md-button>
      <md-button variant="outlined" @click=${showSnackbar('#pos-bl')}>Bottom-start</md-button>
      <md-button variant="filled" @click=${showSnackbar('#pos-bc')}>Bottom</md-button>
      <md-button variant="outlined" @click=${showSnackbar('#pos-br')}>Bottom-end</md-button>
    </div>
    <md-snackbar id="pos-tl" position="top-start" message="Top-start snackbar" closeable></md-snackbar>
    <md-snackbar id="pos-tc" position="top" message="Top snackbar" closeable></md-snackbar>
    <md-snackbar id="pos-tr" position="top-end" message="Top-end snackbar" closeable></md-snackbar>
    <md-snackbar id="pos-ml" position="start" message="Start snackbar" closeable></md-snackbar>
    <md-snackbar id="pos-mc" position="center" message="Center snackbar" closeable></md-snackbar>
    <md-snackbar id="pos-mr" position="end" message="End snackbar" closeable></md-snackbar>
    <md-snackbar id="pos-bl" position="bottom-start" message="Bottom-start snackbar" closeable></md-snackbar>
    <md-snackbar id="pos-bc" position="bottom" message="Bottom snackbar" closeable></md-snackbar>
    <md-snackbar id="pos-br" position="bottom-end" message="Bottom-end snackbar" closeable></md-snackbar>
  `,
};

/* ─── RTL ─────────────────────────────────────────────────── */

export const RTL: Story = {
  render: () => html`
    <div dir="rtl">
      <md-button variant="filled" @click=${showSnackbar('#rtl-snack')}>
        عرض الإشعار
      </md-button>
      <md-snackbar
        id="rtl-snack"
        message="تم حفظ الملف بنجاح"
        action="تراجع"
        closeable
      ></md-snackbar>
    </div>
  `,
};

/* ─── Dark Theme ──────────────────────────────────────────── */

export const DarkTheme: Story = {
  render: (_args, { globals }) => html`
    <div data-theme="dark" style="background: var(--md-sys-color-surface); padding: 24px; border-radius: 16px;">
      <md-button variant="filled" @click=${showSnackbar('#dark-snack')}>
        ${t(globals.locale, 'snackbar.show')}
      </md-button>
      <md-snackbar
        id="dark-snack"
        message=${t(globals.locale, 'snackbar.changes-saved')}
        action=${t(globals.locale, 'snackbar.undo')}
        closeable
      ></md-snackbar>
    </div>
  `,
};

/* ─── Custom CSS ──────────────────────────────────────────── */

export const CustomCSS: Story = {
  render: (_args, { globals }) => html`
    <style>
      #custom-error {
        --md-snackbar-container-color: var(--md-sys-color-error-container, #F9DEDC);
        --md-snackbar-message-color: var(--md-sys-color-on-error-container, #410E0B);
        --md-snackbar-action-color: var(--md-sys-color-error, #B3261E);
        --md-snackbar-close-color: var(--md-sys-color-on-error-container, #410E0B);
      }
      #custom-brand {
        --md-snackbar-container-color: #1a1a2e;
        --md-snackbar-message-color: #eaeaea;
        --md-snackbar-action-color: #e94560;
        --md-snackbar-container-shape: 12px;
      }
    </style>
    <div style="display: flex; gap: 16px; flex-wrap: wrap;">
      <md-button variant="filled" @click=${showSnackbar('#custom-error')}>
        ${t(globals.locale, 'snackbar.error-style')}
      </md-button>
      <md-button variant="outlined" @click=${showSnackbar('#custom-brand')}>
        ${t(globals.locale, 'snackbar.brand-style')}
      </md-button>
    </div>
    <md-snackbar id="custom-error" message=${t(globals.locale, 'snackbar.upload-failed')} action=${t(globals.locale, 'snackbar.retry')} closeable></md-snackbar>
    <md-snackbar id="custom-brand" message=${t(globals.locale, 'snackbar.welcome')} action=${t(globals.locale, 'snackbar.explore')}></md-snackbar>
  `,
};

/* ─── CSS Parts ───────────────────────────────────────────── */

export const CSSParts: Story = {
  render: (_args, { globals }) => html`
    <style>
      #parts-snack::part(surface) {
        border-radius: 16px;
        border: 2px solid var(--md-sys-color-outline-variant, #CAC4D0);
      }
      #parts-snack::part(message) {
        font-style: italic;
      }
      #parts-snack::part(actions) {
        gap: 16px;
      }
    </style>
    <md-button variant="filled" @click=${showSnackbar('#parts-snack')}>
      ${t(globals.locale, 'snackbar.show')}
    </md-button>
    <md-snackbar id="parts-snack" message=${t(globals.locale, 'snackbar.styled-parts')} action=${t(globals.locale, 'snackbar.nice')} closeable></md-snackbar>
  `,
};

/* ─── Slotted Content ─────────────────────────────────────── */

export const SlottedContent: Story = {
  render: (_args, { globals }) => html`
    <md-button variant="filled" @click=${showSnackbar('#slotted-snack')}>
      ${t(globals.locale, 'snackbar.show')}
    </md-button>
    <md-snackbar id="slotted-snack" closeable>
      File <strong style="color: var(--md-sys-color-inverse-primary, #D0BCFF)">report.pdf</strong> uploaded
    </md-snackbar>
  `,
};

/* ─── Localization ────────────────────────────────────────── */

/**
 * Full localization. The `message` and `action` are your strings; the one
 * built-in label — the close button — is exposed via `dismiss-label`. Set
 * `dir="rtl"` on the element (or an ancestor) for RTL locales and the whole
 * snackbar mirrors via CSS logical properties.
 *
 * Four locales are shown at once, pinned to the four corners so they don't
 * overlap (each stays open via `auto-hide="false"`).
 */
const L10N = [
  { code: 'en', dir: 'ltr', pos: 'bottom-start', msg: 'Item moved to trash', action: 'Undo', dismiss: 'Dismiss' },
  { code: 'de', dir: 'ltr', pos: 'bottom-end', msg: 'Element in den Papierkorb verschoben', action: 'Rückgängig', dismiss: 'Schließen' },
  { code: 'ja', dir: 'ltr', pos: 'top-start', msg: 'ゴミ箱に移動しました', action: '元に戻す', dismiss: '閉じる' },
  { code: 'ar', dir: 'rtl', pos: 'top-end', msg: 'تم نقل العنصر إلى المهملات', action: 'تراجع', dismiss: 'إغلاق' },
];

export const Localization: Story = {
  render: (_args, { viewMode }) => html`
    ${L10N.map(
      (l) => html`
        <md-snackbar
          ?open=${viewMode !== 'docs'}
          auto-hide="false"
          closeable
          dir=${l.dir}
          lang=${l.code}
          position=${l.pos}
          message=${l.msg}
          action=${l.action}
          dismiss-label=${l.dismiss}
        ></md-snackbar>
      `,
    )}
  `,
};
