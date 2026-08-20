import type { Meta, StoryObj } from '@storybook/web-components';
import { expect, waitFor } from 'storybook/test';
import { html } from 'lit';
import { t } from '../i18n';

const meta: Meta = {
  title: 'Containment/Side Sheet',
  component: 'md-side-sheet',
  tags: ['autodocs'],
  parameters: {
    docs: {
      source: { language: 'html' },
    },
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['standard', 'modal'],
      description: 'Visual variant',
    },
    side: {
      control: 'select',
      options: ['start', 'end'],
      description: 'Which edge the sheet is anchored to',
    },
    headline: { control: 'text', description: 'Headline text' },
    closeable: { control: 'boolean', description: 'Show close icon button' },
    'show-back': { control: 'boolean', description: 'Show back icon (modal only)' },
    'top-divider': { control: 'boolean', description: 'Divider below header' },
    'bottom-divider': { control: 'boolean', description: 'Divider above actions' },
    detached: { control: 'boolean', description: 'Detached style (rounded, floating)' },
    'scrim-dismissible': { control: 'boolean', description: 'Close on scrim click (modal)' },
  },
  args: {
    variant: 'modal',
    side: 'end',
    headline: 'Side Sheet',
    closeable: true,
    'show-back': false,
    'top-divider': false,
    'bottom-divider': false,
    detached: false,
    'scrim-dismissible': true,
  },
};
export default meta;
type Story = StoryObj;

function getSheet(id: string): any {
  return document.querySelector(`#${id}`);
}

/* ── play() shadow-piercing helpers ──────────────────────────
 * testing-library can't cross shadow roots, so play() addresses the sheet's
 * real internals directly. getHydratedSheet() gates on `.hydrated` first so we
 * never poke a pre-hydration host (its methods work but attribute reflection
 * and focus wiring aren't live yet). */
type SheetEl = HTMLElement & { open: boolean; show(): Promise<void>; close(): Promise<void> };
const getHydratedSheet = async (root: ParentNode, sel = 'md-side-sheet'): Promise<SheetEl> => {
  const sheet = root.querySelector(sel) as SheetEl;
  await waitFor(() => expect(sheet.classList.contains('hydrated')).toBe(true));
  return sheet;
};
const part = (sheet: SheetEl, name: string) =>
  sheet.shadowRoot!.querySelector(`[part="${name}"]`) as HTMLElement | null;
const closeButton = (sheet: SheetEl) =>
  sheet.shadowRoot!.querySelector('[part="close"] md-icon-button') as HTMLElement;
const click = (el: Element) =>
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));

/* ─── Playground ──────────────────────────────────────────── */

export const Playground: Story = {
  render: (args, { globals }) => html`
    <md-button variant="filled" @click=${() => getSheet('pg-sheet')?.show()}>
      ${t(globals.locale, 'sideSheet.openSideSheet')}
    </md-button>
    <md-side-sheet
      id="pg-sheet"
      variant=${args.variant}
      side=${args.side}
      headline=${args.headline}
      ?closeable=${args.closeable}
      ?show-back=${args['show-back']}
      ?top-divider=${args['top-divider']}
      ?bottom-divider=${args['bottom-divider']}
      ?detached=${args.detached}
      ?scrim-dismissible=${args['scrim-dismissible']}
    >
      <p>${t(globals.locale, 'sideSheet.playgroundBody')}</p>
      <p>${t(globals.locale, 'sideSheet.scrollDown')}</p>
      <p style="margin-top: 200px;">${t(globals.locale, 'sideSheet.moreBelow')}</p>
    </md-side-sheet>
  `,
};

/* ─── Standard ────────────────────────────────────────────── */

export const Standard: Story = {
  render: (_args, { globals, viewMode }) => html`
    <div style="display: flex; height: 400px; border: 1px solid var(--md-sys-color-outline-variant, #ccc); border-radius: 12px; overflow: hidden;">
      <main style="flex: 1; padding: 24px;">
        <h3 style="margin: 0 0 8px;">${t(globals.locale, 'sideSheet.mainContent')}</h3>
        <p>${t(globals.locale, 'sideSheet.standardInline')}</p>
      </main>
      <md-side-sheet ?open=${viewMode !== 'docs'} variant="standard" headline=${t(globals.locale, 'sideSheet.filters')}>
        <p>${t(globals.locale, 'sideSheet.filterByCategory')}</p>
      </md-side-sheet>
    </div>
  `,
  /** Standard sheet ships open and inline (no scrim); its close button flips
   *  `open` to false and emits mdClose/mdCancel. */
  play: async ({ canvasElement, step }) => {
    const sheet = await getHydratedSheet(canvasElement);

    await step('Renders open and inline — region role, no overlay', async () => {
      expect(sheet.hasAttribute('open')).toBe(true);
      expect(sheet.classList.contains('md-side-sheet--open')).toBe(true);
      const container = part(sheet, 'container')!;
      expect(container.getAttribute('role')).toBe('region');    // NOT a dialog
      expect(container.hasAttribute('aria-modal')).toBe(false);
      expect(container.hasAttribute('aria-hidden')).toBe(false); // open → exposed to AT
      expect(part(sheet, 'scrim')).toBeNull();                   // standard has no scrim
    });

    await step('Close button dismisses (open → false), emits mdClose + mdCancel', async () => {
      let closed = false;
      let cancelled = false;
      sheet.addEventListener('mdClose', () => { closed = true; }, { once: true });
      sheet.addEventListener('mdCancel', () => { cancelled = true; }, { once: true });
      expect(sheet.hasAttribute('open')).toBe(true);              // before: open
      click(closeButton(sheet));
      await waitFor(() => expect(sheet.hasAttribute('open')).toBe(false)); // proves it closed
      expect(closed).toBe(true);
      expect(cancelled).toBe(true);
      // aria-hidden is re-rendered on the next flush, not synchronously.
      await waitFor(() =>
        expect(part(sheet, 'container')!.getAttribute('aria-hidden')).toBe('true'),
      );
    });

    await step('Escape does NOT dismiss the standard variant, and scroll is never locked', async () => {
      // Reopen the (now-closed) standard sheet via the imperative API — exercises
      // the onOpenChange open path through @Watch for a non-modal variant.
      await sheet.show();
      await waitFor(() => expect(sheet.hasAttribute('open')).toBe(true)); // proves it reopened
      // Standard is inline: opening must NOT lock the page scroll (modal-only).
      expect(document.body.style.overflow).toBe('');

      // Escape is a MODAL affordance. A standard sheet is a non-modal region
      // that leaves the rest of the page interactive, so a stray Escape aimed at
      // something else on the page must not collapse it — the close button (or
      // your own control) is the dismissal path. This story used to assert the
      // opposite, which contradicted both the readme and the page's own callout.
      let cancelled = false;
      sheet.addEventListener('mdCancel', () => { cancelled = true; }, { once: true });
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await new Promise((r) => setTimeout(r, 200));
      expect(sheet.hasAttribute('open')).toBe(true);  // still open
      expect(cancelled).toBe(false);                  // and no dismissal event

      // The documented keyboard path out is the close button.
      click(closeButton(sheet));
      await waitFor(() => expect(sheet.hasAttribute('open')).toBe(false));
      expect(document.body.style.overflow).toBe(''); // never locked for standard
      await new Promise((r) => setTimeout(r, 300));   // let the slide-out settle
    });
  },
};

/* ─── Modal ───────────────────────────────────────────────── */

export const Modal: Story = {
  render: (_args, { globals }) => html`
    <md-button variant="filled" @click=${() => getSheet('modal-sheet')?.show()}>
      ${t(globals.locale, 'sideSheet.openModalSheet')}
    </md-button>
    <md-side-sheet id="modal-sheet" variant="modal" headline=${t(globals.locale, 'sideSheet.details')}>
      <p>${t(globals.locale, 'sideSheet.modalBody')}</p>
      <p>${t(globals.locale, 'sideSheet.scrimOrEscape')}</p>
    </md-side-sheet>
  `,
  /** Trigger opens the modal (dialog role, focus enters); a content click is
   *  ignored (scrim-scoped); the scrim dismisses and restores focus to the
   *  trigger. */
  play: async ({ canvasElement, step }) => {
    const sheet = await getHydratedSheet(canvasElement);
    const trigger = canvasElement.querySelector('md-button') as HTMLElement;

    await step('Trigger opens the modal — dialog role, focus enters the sheet', async () => {
      let opened = false;
      sheet.addEventListener('mdOpen', () => { opened = true; }, { once: true });
      trigger.focus();
      expect(document.activeElement).toBe(trigger);         // baseline focus to restore later
      expect(sheet.hasAttribute('open')).toBe(false);       // before: closed
      click(trigger);
      await waitFor(() => expect(sheet.hasAttribute('open')).toBe(true)); // proves it opened
      expect(opened).toBe(true);
      const container = part(sheet, 'container')!;
      expect(container.getAttribute('role')).toBe('dialog');
      expect(container.getAttribute('aria-modal')).toBe('true');
      await waitFor(() => expect(container.hasAttribute('aria-hidden')).toBe(false));
      // Focus trap pulls focus off the trigger into the sheet (rAF-scheduled);
      // a focused shadow child surfaces as the host at document level.
      await waitFor(() => expect(document.activeElement).toBe(sheet));
    });

    await step('Clicking sheet content does NOT dismiss (guard: scrim-scoped)', async () => {
      click(part(sheet, 'content')!);
      await new Promise((r) => setTimeout(r, 50));
      expect(sheet.hasAttribute('open')).toBe(true);        // still open
    });

    await step('Scrim click dismisses, emits mdCancel, restores focus to trigger', async () => {
      let cancelled = false;
      sheet.addEventListener('mdCancel', () => { cancelled = true; }, { once: true });
      click(part(sheet, 'scrim')!);
      await waitFor(() => expect(sheet.hasAttribute('open')).toBe(false)); // proves it closed
      expect(cancelled).toBe(true);
      await waitFor(() =>
        expect(part(sheet, 'container')!.getAttribute('aria-hidden')).toBe('true'),
      );
      await waitFor(() => expect(document.activeElement).toBe(trigger));   // focus restored
      // Let the close animation settle so teardown doesn't race it.
      await new Promise((r) => setTimeout(r, 300));
    });

    await step('Reopens via show() and dismisses via the close() method', async () => {
      let reopened = false;
      sheet.addEventListener('mdOpen', () => { reopened = true; }, { once: true });
      await sheet.show();
      await waitFor(() => expect(sheet.hasAttribute('open')).toBe(true)); // proves it reopened
      expect(reopened).toBe(true);
      // Re-entering the modal open path through @Watch re-locks the page scroll…
      await waitFor(() => expect(document.body.style.overflow).toBe('hidden'));
      let closedAgain = false;
      sheet.addEventListener('mdClose', () => { closedAgain = true; }, { once: true });
      await sheet.close();
      await waitFor(() => expect(sheet.hasAttribute('open')).toBe(false)); // proves close() closed it
      expect(closedAgain).toBe(true);
      await waitFor(() => expect(document.body.style.overflow).toBe(''));  // …and unlocks on close
      await new Promise((r) => setTimeout(r, 300));
    });
  },
};

/* ─── Modal with Back Navigation ──────────────────────────── */

export const ModalWithBack: Story = {
  render: (_args, { globals }) => html`
    <md-button variant="filled" @click=${() => getSheet('back-sheet')?.show()}>
      ${t(globals.locale, 'sideSheet.openWithBack')}
    </md-button>
    <md-side-sheet id="back-sheet" variant="modal" show-back headline=${t(globals.locale, 'sideSheet.subcategory')}>
      <p>${t(globals.locale, 'sideSheet.backNavBody')}</p>
    </md-side-sheet>
  `,
  /** Opening a modal locks page scroll and stores focus; the back button is
   *  event-only; the focusin trap yanks stray focus back; Escape dismisses via
   *  mdCancel, unlocks scroll, and restores focus to the trigger. */
  play: async ({ canvasElement, step }) => {
    const sheet = await getHydratedSheet(canvasElement);
    const trigger = canvasElement.querySelector('md-button') as HTMLElement;

    await step('Trigger opens modal — locks body scroll, focus enters the sheet', async () => {
      let opened = false;
      sheet.addEventListener('mdOpen', () => { opened = true; }, { once: true });
      await waitFor(() => expect(trigger.classList.contains('hydrated')).toBe(true));
      trigger.focus();
      expect(document.activeElement).toBe(trigger);         // baseline focus to restore later
      expect(sheet.hasAttribute('open')).toBe(false);
      click(trigger);
      await waitFor(() => expect(sheet.hasAttribute('open')).toBe(true)); // proves it opened
      expect(opened).toBe(true);
      // modal open path locks the page scroll…
      await waitFor(() => expect(document.body.style.overflow).toBe('hidden'));
      expect(part(sheet, 'container')!.getAttribute('role')).toBe('dialog');
      // …and pulls focus into the panel (surfaces as the host at doc level).
      await waitFor(() => expect(document.activeElement).toBe(sheet));
    });

    await step('Back button emits mdBack but does NOT close (navigation-only)', async () => {
      const backBtn = sheet.shadowRoot!.querySelector('.md-side-sheet__back md-icon-button') as HTMLElement;
      await waitFor(() => expect(backBtn.classList.contains('hydrated')).toBe(true));
      let backFired = false;
      sheet.addEventListener('mdBack', () => { backFired = true; }, { once: true });
      click(backBtn);
      await waitFor(() => expect(backFired).toBe(true));   // event fired…
      expect(sheet.hasAttribute('open')).toBe(true);       // …but the sheet stays open
    });

    await step('Focus trap pulls stray focus back into the sheet', async () => {
      // Moving focus to the trigger (outside the open modal) fires the document
      // focusin guard, which returns focus to the panel.
      trigger.focus();
      await waitFor(() => expect(document.activeElement).toBe(sheet));
    });

    await step('Escape dismisses — mdCancel, unlocks scroll, restores focus', async () => {
      let cancelled = false;
      sheet.addEventListener('mdCancel', () => { cancelled = true; }, { once: true });
      expect(sheet.hasAttribute('open')).toBe(true);       // before: open
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await waitFor(() => expect(sheet.hasAttribute('open')).toBe(false)); // proves it closed
      expect(cancelled).toBe(true);
      await waitFor(() => expect(document.body.style.overflow).toBe('')); // scroll unlocked
      await waitFor(() => expect(document.activeElement).toBe(trigger));  // focus restored
      await new Promise((r) => setTimeout(r, 300));         // let the close animation settle
    });

    // Reset to a clean resting render for the visual baseline. The sheet is
    // already closed and scroll unlocked, but the play left the trigger focused
    // (a keyboard-driven :focus-visible ring). Blur it so the screenshot matches
    // a fresh, unfocused render.
    await step('Reset visual state — blur the focused trigger for a clean baseline', async () => {
      (document.activeElement as HTMLElement)?.blur();
      await waitFor(() => expect(document.activeElement).not.toBe(trigger));
      await new Promise((r) => requestAnimationFrame(() => r(null)));
    });
  },
};

/* ─── Detached ────────────────────────────────────────────── */

export const Detached: Story = {
  render: (_args, { globals }) => html`
    <md-button variant="filled" @click=${() => getSheet('detached-sheet')?.show()}>
      ${t(globals.locale, 'sideSheet.openDetached')}
    </md-button>
    <md-side-sheet id="detached-sheet" variant="modal" detached headline=${t(globals.locale, 'sideSheet.options')}>
      <p>${t(globals.locale, 'sideSheet.detachedBody')}</p>
    </md-side-sheet>
  `,
};

/* ─── Start Side ──────────────────────────────────────────── */

export const StartSide: Story = {
  render: (_args, { globals }) => html`
    <md-button variant="filled" @click=${() => getSheet('start-sheet')?.show()}>
      ${t(globals.locale, 'sideSheet.openStartSide')}
    </md-button>
    <md-side-sheet id="start-sheet" variant="modal" side="start" headline=${t(globals.locale, 'sideSheet.navigation')}>
      <p>${t(globals.locale, 'sideSheet.startSideBody')}</p>
    </md-side-sheet>
  `,
};

/* ─── With Actions ────────────────────────────────────────── */

export const WithActions: Story = {
  render: (_args, { globals }) => html`
    <md-button variant="filled" @click=${() => getSheet('actions-sheet')?.show()}>
      ${t(globals.locale, 'sideSheet.openWithActions')}
    </md-button>
    <md-side-sheet id="actions-sheet" variant="modal" headline=${t(globals.locale, 'sideSheet.filters')} bottom-divider>
      <p>${t(globals.locale, 'sideSheet.selectFilters')}</p>
      <md-button slot="actions" variant="filled" @click=${() => getSheet('actions-sheet')?.close()}>
        ${t(globals.locale, 'sideSheet.apply')}
      </md-button>
      <md-button slot="actions" variant="text" @click=${() => getSheet('actions-sheet')?.close()}>
        ${t(globals.locale, 'sideSheet.reset')}
      </md-button>
    </md-side-sheet>
  `,
};

/* ─── With Dividers ───────────────────────────────────────── */

export const WithDividers: Story = {
  render: (_args, { globals }) => html`
    <md-button variant="filled" @click=${() => getSheet('divider-sheet')?.show()}>
      ${t(globals.locale, 'sideSheet.openWithDividers')}
    </md-button>
    <md-side-sheet id="divider-sheet" variant="modal" headline=${t(globals.locale, 'settings')} top-divider bottom-divider>
      <p>${t(globals.locale, 'sideSheet.bothDividers')}</p>
      <md-button slot="actions" variant="filled" @click=${() => getSheet('divider-sheet')?.close()}>
        ${t(globals.locale, 'save')}
      </md-button>
    </md-side-sheet>
  `,
};

/* ─── Standard Start Side ─────────────────────────────────── */

export const StandardStart: Story = {
  render: (_args, { globals, viewMode }) => html`
    <div style="display: flex; height: 400px; border: 1px solid var(--md-sys-color-outline-variant, #ccc); border-radius: 12px; overflow: hidden;">
      <md-side-sheet ?open=${viewMode !== 'docs'} variant="standard" side="start" headline=${t(globals.locale, 'sideSheet.sidebar')}>
        <p>${t(globals.locale, 'sideSheet.startSideStandard')}</p>
      </md-side-sheet>
      <main style="flex: 1; padding: 24px;">
        <h3 style="margin: 0 0 8px;">${t(globals.locale, 'sideSheet.mainContent')}</h3>
        <p>${t(globals.locale, 'sideSheet.standardSitsStart')}</p>
      </main>
    </div>
  `,
};

/* ─── RTL ─────────────────────────────────────────────────── */

export const RTL: Story = {
  render: () => html`
    <div dir="rtl">
      <md-button variant="filled" @click=${() => getSheet('rtl-sheet')?.show()}>
        فتح الورقة الجانبية
      </md-button>
      <md-side-sheet id="rtl-sheet" variant="modal" headline="تفاصيل">
        <p>هذه ورقة جانبية في وضع RTL. تنزلق من الحافة اليسرى.</p>
      </md-side-sheet>
    </div>
  `,
};

/* ─── Localization ────────────────────────────────────────── */

export const Localization: Story = {
  name: 'Localization',
  render: () => html`
    <style>
      .locale-grid {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        align-items: flex-start;
      }
      .locale-label {
        font: 500 11px/16px Roboto, sans-serif;
        color: var(--md-sys-color-on-surface-variant, #49454F);
        text-transform: uppercase;
        letter-spacing: .5px;
        margin: 0 0 6px;
      }
    </style>

    <div style="display: flex; flex-direction: column; gap: 24px; padding: 8px;">
      <p style="margin: 0; font: 400 13px/20px Roboto, sans-serif; color: var(--md-sys-color-on-surface-variant, #49454F);">
        Each button opens a side sheet localised for that language and direction.
        The sheet — headline, body copy, and action labels — all reflect the locale.
      </p>

      <div class="locale-grid">
        <!-- English (LTR) -->
        <div>
          <p class="locale-label">English (LTR)</p>
          <md-button variant="filled" @click=${() => getSheet('loc-en')?.show()}>
            Open Filters
          </md-button>
        </div>

        <!-- French (LTR) -->
        <div>
          <p class="locale-label">French (LTR)</p>
          <md-button variant="filled" @click=${() => getSheet('loc-fr')?.show()}>
            Ouvrir les filtres
          </md-button>
        </div>

        <!-- German (LTR) -->
        <div>
          <p class="locale-label">German (LTR)</p>
          <md-button variant="filled" @click=${() => getSheet('loc-de')?.show()}>
            Filter öffnen
          </md-button>
        </div>

        <!-- Japanese (LTR) -->
        <div>
          <p class="locale-label">Japanese (LTR)</p>
          <md-button variant="filled" @click=${() => getSheet('loc-ja')?.show()}>
            フィルターを開く
          </md-button>
        </div>

        <!-- Arabic (RTL) -->
        <div>
          <p class="locale-label">Arabic (RTL)</p>
          <div dir="rtl">
            <md-button variant="filled" @click=${() => getSheet('loc-ar')?.show()}>
              فتح الفلاتر
            </md-button>
          </div>
        </div>

        <!-- Hebrew (RTL) -->
        <div>
          <p class="locale-label">Hebrew (RTL)</p>
          <div dir="rtl">
            <md-button variant="filled" @click=${() => getSheet('loc-he')?.show()}>
              פתח מסננים
            </md-button>
          </div>
        </div>
      </div>
    </div>

    <!-- English -->
    <md-side-sheet id="loc-en" variant="modal" headline="Filters" bottom-divider>
      <div style="display: flex; flex-direction: column; gap: 12px;">
        <p style="margin: 0; font: 400 14px/20px Roboto, sans-serif;">Narrow your results by applying one or more filters below.</p>
        <md-divider></md-divider>
        <label style="font-weight: 500;">Category</label>
        <md-chip>Electronics</md-chip>
        <md-chip>Clothing</md-chip>
        <md-chip>Books</md-chip>
      </div>
      <md-button slot="actions" variant="filled" @click=${() => getSheet('loc-en')?.close()}>Apply</md-button>
      <md-button slot="actions" variant="text"   @click=${() => getSheet('loc-en')?.close()}>Clear all</md-button>
    </md-side-sheet>

    <!-- French -->
    <md-side-sheet id="loc-fr" variant="modal" headline="Filtres" bottom-divider>
      <div style="display: flex; flex-direction: column; gap: 12px;">
        <p style="margin: 0; font: 400 14px/20px Roboto, sans-serif;">Affinez vos résultats en appliquant un ou plusieurs filtres.</p>
        <md-divider></md-divider>
        <label style="font-weight: 500;">Catégorie</label>
        <md-chip>Électronique</md-chip>
        <md-chip>Vêtements</md-chip>
        <md-chip>Livres</md-chip>
      </div>
      <md-button slot="actions" variant="filled" @click=${() => getSheet('loc-fr')?.close()}>Appliquer</md-button>
      <md-button slot="actions" variant="text"   @click=${() => getSheet('loc-fr')?.close()}>Tout effacer</md-button>
    </md-side-sheet>

    <!-- German -->
    <md-side-sheet id="loc-de" variant="modal" headline="Filter" bottom-divider>
      <div style="display: flex; flex-direction: column; gap: 12px;">
        <p style="margin: 0; font: 400 14px/20px Roboto, sans-serif;">Grenzen Sie Ihre Ergebnisse durch einen oder mehrere Filter ein.</p>
        <md-divider></md-divider>
        <label style="font-weight: 500;">Kategorie</label>
        <md-chip>Elektronik</md-chip>
        <md-chip>Kleidung</md-chip>
        <md-chip>Bücher</md-chip>
      </div>
      <md-button slot="actions" variant="filled" @click=${() => getSheet('loc-de')?.close()}>Anwenden</md-button>
      <md-button slot="actions" variant="text"   @click=${() => getSheet('loc-de')?.close()}>Alles löschen</md-button>
    </md-side-sheet>

    <!-- Japanese -->
    <md-side-sheet id="loc-ja" variant="modal" headline="フィルター" bottom-divider>
      <div style="display: flex; flex-direction: column; gap: 12px;">
        <p style="margin: 0; font: 400 14px/20px Roboto, sans-serif;">1つ以上のフィルターを適用して結果を絞り込んでください。</p>
        <md-divider></md-divider>
        <label style="font-weight: 500;">カテゴリー</label>
        <md-chip>電子機器</md-chip>
        <md-chip>衣類</md-chip>
        <md-chip>書籍</md-chip>
      </div>
      <md-button slot="actions" variant="filled" @click=${() => getSheet('loc-ja')?.close()}>適用</md-button>
      <md-button slot="actions" variant="text"   @click=${() => getSheet('loc-ja')?.close()}>すべてクリア</md-button>
    </md-side-sheet>

    <!-- Arabic (RTL) -->
    <md-side-sheet id="loc-ar" variant="modal" side="start" headline="الفلاتر" bottom-divider>
      <div dir="rtl" style="display: flex; flex-direction: column; gap: 12px;">
        <p style="margin: 0; font: 400 14px/20px Roboto, sans-serif;">قم بتضييق نتائجك من خلال تطبيق فلتر واحد أو أكثر.</p>
        <md-divider></md-divider>
        <label style="font-weight: 500;">الفئة</label>
        <md-chip>إلكترونيات</md-chip>
        <md-chip>ملابس</md-chip>
        <md-chip>كتب</md-chip>
      </div>
      <md-button slot="actions" variant="filled" @click=${() => getSheet('loc-ar')?.close()}>تطبيق</md-button>
      <md-button slot="actions" variant="text"   @click=${() => getSheet('loc-ar')?.close()}>مسح الكل</md-button>
    </md-side-sheet>

    <!-- Hebrew (RTL) -->
    <md-side-sheet id="loc-he" variant="modal" side="start" headline="סינונים" bottom-divider>
      <div dir="rtl" style="display: flex; flex-direction: column; gap: 12px;">
        <p style="margin: 0; font: 400 14px/20px Roboto, sans-serif;">צמצם את התוצאות על ידי החלת מסנן אחד או יותר.</p>
        <md-divider></md-divider>
        <label style="font-weight: 500;">קטגוריה</label>
        <md-chip>אלקטרוניקה</md-chip>
        <md-chip>ביגוד</md-chip>
        <md-chip>ספרים</md-chip>
      </div>
      <md-button slot="actions" variant="filled" @click=${() => getSheet('loc-he')?.close()}>החל</md-button>
      <md-button slot="actions" variant="text"   @click=${() => getSheet('loc-he')?.close()}>נקה הכל</md-button>
    </md-side-sheet>
  `,
};

/* ─── Dark Theme ──────────────────────────────────────────── */

export const DarkTheme: Story = {
  render: (_args, { globals }) => html`
    <div data-theme="dark" style="background: var(--md-sys-color-surface); padding: 24px; border-radius: 16px;">
      <md-button variant="filled" @click=${() => getSheet('dark-sheet')?.show()}>
        ${t(globals.locale, 'sideSheet.openInDarkTheme')}
      </md-button>
      <md-side-sheet id="dark-sheet" variant="modal" headline=${t(globals.locale, 'sideSheet.darkSheet')}>
        <p>${t(globals.locale, 'sideSheet.darkThemeBody')}</p>
      </md-side-sheet>
    </div>
  `,
};

/* ─── Customization ───────────────────────────────────────── */

export const Customization: Story = {
  name: 'Customization',
  render: () => html`
    <style>
      /* ── Token overrides ── */
      .sheet-primary {
        --md-side-sheet-container-color: var(--md-sys-color-primary-container, #EADDFF);
        --md-side-sheet-headline-color:  var(--md-sys-color-on-primary-container, #21005D);
        --md-side-sheet-content-color:   var(--md-sys-color-on-primary-container, #21005D);
        --md-side-sheet-icon-color:      var(--md-sys-color-on-primary-container, #21005D);
        --md-side-sheet-divider-color:   var(--md-sys-color-primary, #6750A4);
      }
      .sheet-error {
        --md-side-sheet-container-color: var(--md-sys-color-error-container, #F9DEDC);
        --md-side-sheet-headline-color:  var(--md-sys-color-on-error-container, #410E0B);
        --md-side-sheet-content-color:   var(--md-sys-color-on-error-container, #410E0B);
        --md-side-sheet-icon-color:      var(--md-sys-color-on-error-container, #410E0B);
        --md-side-sheet-divider-color:   var(--md-sys-color-error, #B3261E);
      }
      .sheet-brand {
        --md-side-sheet-container-color: #1a1a2e;
        --md-side-sheet-headline-color:  #e94560;
        --md-side-sheet-content-color:   #ccc;
        --md-side-sheet-icon-color:      #e94560;
        --md-side-sheet-scrim-color:     rgba(26, 26, 46, 0.6);
        --md-side-sheet-divider-color:   #e94560;
      }
      .sheet-narrow {
        --md-side-sheet-width:     240px;
        --md-side-sheet-max-width: 280px;
      }
      .sheet-wide {
        --md-side-sheet-width:     520px;
        --md-side-sheet-max-width: 600px;
      }
      .sheet-sharp {
        --md-side-sheet-container-shape: 4px;
      }
      .sheet-scrim {
        --md-side-sheet-scrim-color: rgba(103, 80, 164, 0.45);
      }

      /* ── ::part() overrides ── */
      .sheet-parts::part(header) {
        background: linear-gradient(135deg,
          var(--md-sys-color-primary-container, #EADDFF),
          var(--md-sys-color-secondary-container, #E8DEF8));
      }
      .sheet-parts::part(headline) {
        font-size: 20px;
        letter-spacing: 0;
        font-weight: 700;
      }
      .sheet-parts::part(content) {
        background: var(--md-sys-color-surface-container-lowest, #FFFBFE);
      }
      .sheet-parts::part(actions) {
        background: var(--md-sys-color-surface-container, #F3EDF7);
        border-top: 2px solid var(--md-sys-color-primary, #6750A4);
      }

      .cust-row {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        align-items: flex-start;
        margin-bottom: 4px;
      }
      .cust-label {
        font: 500 11px/16px Roboto, sans-serif;
        color: var(--md-sys-color-on-surface-variant, #49454F);
        text-transform: uppercase;
        letter-spacing: .5px;
        margin: 0 0 6px;
      }
    </style>

    <div style="display: flex; flex-direction: column; gap: 28px; padding: 8px;">

      <!-- Colour tokens -->
      <div>
        <p style="font:500 14px/20px Roboto,sans-serif; margin:0 0 10px;">Container &amp; text colours</p>
        <div class="cust-row">
          <div>
            <p class="cust-label">Primary container</p>
            <md-button variant="tonal" @click=${() => getSheet('c-primary')?.show()}>Open</md-button>
          </div>
          <div>
            <p class="cust-label">Error container</p>
            <md-button variant="tonal" @click=${() => getSheet('c-error')?.show()}>Open</md-button>
          </div>
          <div>
            <p class="cust-label">Dark brand</p>
            <md-button variant="filled" @click=${() => getSheet('c-brand')?.show()}>Open</md-button>
          </div>
        </div>
      </div>

      <!-- Width tokens -->
      <div>
        <p style="font:500 14px/20px Roboto,sans-serif; margin:0 0 10px;">Width</p>
        <div class="cust-row">
          <div>
            <p class="cust-label">Narrow (240 px)</p>
            <md-button variant="outlined" @click=${() => getSheet('c-narrow')?.show()}>Open</md-button>
          </div>
          <div>
            <p class="cust-label">Default (360 px)</p>
            <md-button variant="outlined" @click=${() => getSheet('c-default-w')?.show()}>Open</md-button>
          </div>
          <div>
            <p class="cust-label">Wide (520 px)</p>
            <md-button variant="outlined" @click=${() => getSheet('c-wide')?.show()}>Open</md-button>
          </div>
        </div>
      </div>

      <!-- Shape & scrim -->
      <div>
        <p style="font:500 14px/20px Roboto,sans-serif; margin:0 0 10px;">Shape &amp; scrim</p>
        <div class="cust-row">
          <div>
            <p class="cust-label">Sharp corners (detached)</p>
            <md-button variant="outlined" @click=${() => getSheet('c-sharp')?.show()}>Open</md-button>
          </div>
          <div>
            <p class="cust-label">Tinted scrim</p>
            <md-button variant="outlined" @click=${() => getSheet('c-scrim')?.show()}>Open</md-button>
          </div>
        </div>
      </div>

      <!-- ::part() overrides -->
      <div>
        <p style="font:500 14px/20px Roboto,sans-serif; margin:0 0 10px;">::part() overrides</p>
        <div class="cust-row">
          <div>
            <p class="cust-label">Gradient header, styled actions</p>
            <md-button variant="tonal" @click=${() => getSheet('c-parts')?.show()}>Open</md-button>
          </div>
        </div>
      </div>
    </div>

    <!-- Primary container sheet -->
    <md-side-sheet id="c-primary" variant="modal" headline="Primary Style"
        top-divider bottom-divider class="sheet-primary">
      <p>Container background uses <code>--md-side-sheet-container-color</code> set to <code>primary-container</code>. Headline, body, and icon colours all follow the same on-primary-container token.</p>
      <md-button slot="actions" variant="filled" @click=${() => getSheet('c-primary')?.close()}>Confirm</md-button>
      <md-button slot="actions" variant="text"   @click=${() => getSheet('c-primary')?.close()}>Cancel</md-button>
    </md-side-sheet>

    <!-- Error container sheet -->
    <md-side-sheet id="c-error" variant="modal" headline="Destructive Action"
        top-divider bottom-divider class="sheet-error">
      <p>Error-container tint signals a destructive or critical action. All tokens use the M3 error role colours.</p>
      <md-button slot="actions" variant="filled" @click=${() => getSheet('c-error')?.close()}>Delete</md-button>
      <md-button slot="actions" variant="text"   @click=${() => getSheet('c-error')?.close()}>Cancel</md-button>
    </md-side-sheet>

    <!-- Dark brand sheet -->
    <md-side-sheet id="c-brand" variant="modal" headline="Branded" class="sheet-brand" top-divider>
      <p>Fully custom palette via <code>--md-side-sheet-container-color</code>, <code>--md-side-sheet-headline-color</code>, and a tinted <code>--md-side-sheet-scrim-color</code>.</p>
    </md-side-sheet>

    <!-- Narrow sheet -->
    <md-side-sheet id="c-narrow" variant="modal" headline="Compact" class="sheet-narrow">
      <p>240 px width — useful for a slim navigation rail or a minimal tool panel.</p>
    </md-side-sheet>

    <!-- Default width sheet -->
    <md-side-sheet id="c-default-w" variant="modal" headline="Default width">
      <p>360 px — the M3 spec default for side sheets.</p>
    </md-side-sheet>

    <!-- Wide sheet -->
    <md-side-sheet id="c-wide" variant="modal" headline="Wide panel" class="sheet-wide" top-divider>
      <p>520 px — suits rich detail views, code panels, or data tables that need more horizontal room.</p>
      <pre style="margin-top:12px; padding:16px; border-radius:12px;
           background:var(--md-sys-color-surface-container,#F3EDF7);
           font-size:13px; line-height:1.5; overflow-x:auto;">
const total = items.reduce((sum, item) => {
  return sum + item.price * item.qty;
}, 0);</pre>
    </md-side-sheet>

    <!-- Sharp detached sheet -->
    <md-side-sheet id="c-sharp" variant="modal" detached headline="Sharp corners" class="sheet-sharp">
      <p><code>--md-side-sheet-container-shape: 4px</code> overrides the detached default (16 dp) with sharp corners.</p>
    </md-side-sheet>

    <!-- Tinted scrim sheet -->
    <md-side-sheet id="c-scrim" variant="modal" headline="Tinted scrim" class="sheet-scrim">
      <p><code>--md-side-sheet-scrim-color</code> set to <code>rgba(103, 80, 164, 0.45)</code> — a primary-tinted scrim instead of the default neutral.</p>
    </md-side-sheet>

    <!-- ::part() sheet -->
    <md-side-sheet id="c-parts" variant="modal" headline="Theme Editor"
        top-divider bottom-divider class="sheet-parts">
      <p>Styled exclusively with <code>::part()</code> selectors — no token overrides.</p>
      <ul style="margin:12px 0 0; padding-inline-start:20px; line-height:1.8;">
        <li><code>::part(header)</code> — gradient background</li>
        <li><code>::part(headline)</code> — larger, bolder text</li>
        <li><code>::part(content)</code> — lowest-surface background</li>
        <li><code>::part(actions)</code> — surface-container + primary top border</li>
      </ul>
      <md-button slot="actions" variant="filled" @click=${() => getSheet('c-parts')?.close()}>Apply</md-button>
      <md-button slot="actions" variant="text"   @click=${() => getSheet('c-parts')?.close()}>Discard</md-button>
    </md-side-sheet>
  `,
};

/* ─── CSS Parts ───────────────────────────────────────────── */

export const CSSParts: Story = {
  render: () => html`
    <style>
      .parts-demo::part(headline) {
        text-transform: uppercase;
        letter-spacing: 1px;
      }
      .parts-demo::part(content) {
        background: linear-gradient(180deg, transparent, rgba(103, 80, 164, 0.05));
      }
      .parts-demo::part(header) {
        background-color: rgba(103, 80, 164, 0.08);
      }
    </style>
    <md-button variant="filled" @click=${() => getSheet('parts-sheet')?.show()}>
      Open Parts Demo
    </md-button>
    <md-side-sheet id="parts-sheet" variant="modal" headline="Styled Parts" class="parts-demo" top-divider>
      <p>This sheet uses ::part() selectors for custom styling.</p>
    </md-side-sheet>
  `,
};

/* ─── Scrollable Content ──────────────────────────────────── */

export const ScrollableContent: Story = {
  render: (_args, { globals }) => html`
    <md-button variant="filled" @click=${() => getSheet('scroll-sheet')?.show()}>
      ${t(globals.locale, 'sideSheet.openScrollableSheet')}
    </md-button>
    <md-side-sheet id="scroll-sheet" variant="modal" headline=${t(globals.locale, 'sideSheet.longContent')} top-divider>
      ${Array.from({ length: 30 }, (_, i) => html`
        <p>Paragraph ${i + 1} — Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore.</p>
      `)}
    </md-side-sheet>
  `,
};

/* ─── Filter Panel ────────────────────────────────────────── */

export const FilterPanel: Story = {
  render: (_args, { globals }) => html`
    <md-button variant="filled" @click=${() => getSheet('filter-sheet')?.show()}>
      ${t(globals.locale, 'sideSheet.openFilters')}
    </md-button>
    <md-side-sheet id="filter-sheet" variant="modal" headline=${t(globals.locale, 'sideSheet.filters')} bottom-divider>
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <div>
          <label style="display: block; margin-bottom: 8px; font-weight: 500;">${t(globals.locale, 'sideSheet.category')}</label>
          <md-chip>${t(globals.locale, 'sideSheet.electronics')}</md-chip>
          <md-chip>${t(globals.locale, 'sideSheet.clothing')}</md-chip>
          <md-chip>${t(globals.locale, 'sideSheet.books')}</md-chip>
        </div>
        <md-divider></md-divider>
        <div>
          <label style="display: block; margin-bottom: 8px; font-weight: 500;">${t(globals.locale, 'sideSheet.priceRange')}</label>
          <md-slider min="0" max="500" value="250" value-indicator></md-slider>
        </div>
        <md-divider></md-divider>
        <div>
          <label style="display: block; margin-bottom: 8px; font-weight: 500;">${t(globals.locale, 'sideSheet.availability')}</label>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;"><md-checkbox aria-label=${t(globals.locale, 'sideSheet.inStock')}></md-checkbox>${t(globals.locale, 'sideSheet.inStock')}</label>
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;"><md-checkbox aria-label=${t(globals.locale, 'sideSheet.preOrder')}></md-checkbox>${t(globals.locale, 'sideSheet.preOrder')}</label>
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;"><md-checkbox aria-label=${t(globals.locale, 'sideSheet.outOfStock')}></md-checkbox>${t(globals.locale, 'sideSheet.outOfStock')}</label>
          </div>
        </div>
      </div>
      <md-button slot="actions" variant="filled" @click=${() => getSheet('filter-sheet')?.close()}>
        ${t(globals.locale, 'sideSheet.applyFilters')}
      </md-button>
      <md-button slot="actions" variant="text" @click=${() => getSheet('filter-sheet')?.close()}>
        ${t(globals.locale, 'sideSheet.clearAll')}
      </md-button>
    </md-side-sheet>
  `,
};

/* ─── Detail View ─────────────────────────────────────────── */

export const DetailView: Story = {
  render: (_args, { globals }) => html`
    <md-button variant="filled" @click=${() => getSheet('detail-sheet')?.show()}>
      ${t(globals.locale, 'sideSheet.viewDetails')}
    </md-button>
    <md-side-sheet id="detail-sheet" variant="modal" headline=${t(globals.locale, 'sideSheet.orderNumber')} top-divider>
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <div>
          <div style="font-weight: 500; margin-bottom: 4px;">${t(globals.locale, 'sideSheet.status')}</div>
          <md-chip>${t(globals.locale, 'sideSheet.shipped')}</md-chip>
        </div>
        <div>
          <div style="font-weight: 500; margin-bottom: 4px;">${t(globals.locale, 'sideSheet.trackingNumber')}</div>
          <div style="font-family: monospace;">1Z999AA10123456784</div>
        </div>
        <md-divider></md-divider>
        <div>
          <div style="font-weight: 500; margin-bottom: 8px;">${t(globals.locale, 'sideSheet.items')}</div>
          <md-list>
            <md-list-item>Wireless Headphones × 1</md-list-item>
            <md-list-item>USB-C Cable × 2</md-list-item>
            <md-list-item>Phone Case × 1</md-list-item>
          </md-list>
        </div>
        <md-divider></md-divider>
        <div style="display: flex; justify-content: space-between;">
          <span style="font-weight: 500;">${t(globals.locale, 'sideSheet.total')}</span>
          <span style="font-weight: 500;">$127.99</span>
        </div>
      </div>
    </md-side-sheet>
  `,
};

/* ─── Settings Panel ──────────────────────────────────────── */

export const SettingsPanel: Story = {
  render: (_args, { globals, viewMode }) => html`
    <div style="display: flex; height: 500px; border: 1px solid var(--md-sys-color-outline-variant, #ccc); border-radius: 12px; overflow: hidden;">
      <main style="flex: 1; padding: 24px;">
        <h3 style="margin: 0 0 16px;">${t(globals.locale, 'sideSheet.application')}</h3>
        <p>${t(globals.locale, 'sideSheet.settingsInline')}</p>
        <p>${t(globals.locale, 'sideSheet.standardVariantNote')}</p>
      </main>
      <md-side-sheet ?open=${viewMode !== 'docs'} variant="standard" headline=${t(globals.locale, 'settings')} top-divider>
        <div style="display: flex; flex-direction: column;">
          <div style="display: flex; justify-content: space-between; align-items: center; min-height: 44px;">
            <span>${t(globals.locale, 'sideSheet.darkMode')}</span>
            <md-switch aria-label=${t(globals.locale, 'sideSheet.darkMode')}></md-switch>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; min-height: 44px;">
            <span>${t(globals.locale, 'sideSheet.notifications')}</span>
            <md-switch aria-label=${t(globals.locale, 'sideSheet.notifications')}></md-switch>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; min-height: 44px;">
            <span>${t(globals.locale, 'sideSheet.compactView')}</span>
            <md-switch aria-label=${t(globals.locale, 'sideSheet.compactView')}></md-switch>
          </div>
          <md-divider style="margin-block: 4px 16px;"></md-divider>
          <md-select label=${t(globals.locale, 'sideSheet.language')} style="width: 100%;">
            <md-select-option value="en" selected>English</md-select-option>
            <md-select-option value="es">Español</md-select-option>
            <md-select-option value="fr">Français</md-select-option>
          </md-select>
        </div>
      </md-side-sheet>
    </div>
  `,
};

/* ─── Detached with Actions ───────────────────────────────── */

export const DetachedWithActions: Story = {
  render: (_args, { globals }) => html`
    <md-button variant="filled" @click=${() => getSheet('detached-actions')?.show()}>
      ${t(globals.locale, 'sideSheet.openDetachedWithActions')}
    </md-button>
    <md-side-sheet id="detached-actions" variant="modal" detached headline=${t(globals.locale, 'sideSheet.editProfile')} top-divider bottom-divider>
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <md-text-field label=${t(globals.locale, 'sideSheet.displayName')} value="Jane Doe"></md-text-field>
        <md-text-field label=${t(globals.locale, 'sideSheet.email')} value="jane@example.com"></md-text-field>
        <md-text-field label=${t(globals.locale, 'sideSheet.bio')} value="Designer & developer"></md-text-field>
      </div>
      <md-button slot="actions" variant="filled" @click=${() => getSheet('detached-actions')?.close()}>
        ${t(globals.locale, 'save')}
      </md-button>
      <md-button slot="actions" variant="outlined" @click=${() => getSheet('detached-actions')?.close()}>
        ${t(globals.locale, 'cancel')}
      </md-button>
    </md-side-sheet>
  `,
};

/* ─── Non-Dismissible Modal ───────────────────────────────── */

export const NonDismissibleModal: Story = {
  render: (_args, { globals }) => html`
    <md-button variant="filled" @click=${() => getSheet('nodismiss-sheet')?.show()}>
      ${t(globals.locale, 'sideSheet.openNonDismissible')}
    </md-button>
    <md-side-sheet id="nodismiss-sheet" variant="modal" headline=${t(globals.locale, 'sideSheet.requiredAction')} scrim-dismissible="false" closeable="false">
      <p>${t(globals.locale, 'sideSheet.nonDismissibleBody')}</p>
      <p>${t(globals.locale, 'sideSheet.onlyActionCloses')}</p>
      <md-button slot="actions" variant="filled" @click=${() => getSheet('nodismiss-sheet')?.close()}>
        ${t(globals.locale, 'sideSheet.iUnderstand')}
      </md-button>
    </md-side-sheet>
  `,
  /** With scrim-dismissible=false, neither Escape nor a scrim click can dismiss
   *  the sheet (both short-circuit before mdCancel); only the close() method
   *  (here via the action button's programmatic call) dismisses it. */
  play: async ({ canvasElement, step }) => {
    const sheet = await getHydratedSheet(canvasElement);
    let cancelled = false;
    sheet.addEventListener('mdCancel', () => { cancelled = true; });

    await step('show() opens it; Escape and scrim clicks are inert', async () => {
      expect(sheet.hasAttribute('open')).toBe(false);
      await sheet.show();
      await waitFor(() => expect(sheet.hasAttribute('open')).toBe(true)); // proves it opened
      // Escape is swallowed (scrim-dismissible=false returns before mdCancel).
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await new Promise((r) => setTimeout(r, 50));
      expect(sheet.hasAttribute('open')).toBe(true);        // still open after Escape
      // Scrim click is guarded the same way.
      click(part(sheet, 'scrim')!);
      await new Promise((r) => setTimeout(r, 50));
      expect(sheet.hasAttribute('open')).toBe(true);        // still open after scrim click
      expect(cancelled).toBe(false);                        // neither path emitted mdCancel
    });

    await step('close() method dismisses and unlocks page scroll', async () => {
      let closed = false;
      sheet.addEventListener('mdClose', () => { closed = true; }, { once: true });
      await sheet.close();
      await waitFor(() => expect(sheet.hasAttribute('open')).toBe(false)); // proves it closed
      expect(closed).toBe(true);
      await waitFor(() => expect(document.body.style.overflow).toBe('')); // scroll unlocked
      await new Promise((r) => setTimeout(r, 300));          // let the close animation settle
    });
  },
};

/* ─── Multi-Step Navigation ───────────────────────────────── */

export const MultiStepNavigation: Story = {
  render: (_args, { globals }) => {
    let selectedCategory = '';
    let selectedItem = '';
    let selectedPrice = '';

    const goToStep = (step: number) => {
      document.querySelectorAll('.msnav-step').forEach((el) => {
        (el as HTMLElement).hidden = true;
      });
      const target = document.querySelector(`.msnav-step-${step}`) as HTMLElement;
      if (target) target.hidden = false;

      const sheet = getSheet('multistep-sheet');
      const headlines = [
        t(globals.locale, 'sideSheet.selectCategory'),
        t(globals.locale, 'sideSheet.chooseItem'),
        t(globals.locale, 'sideSheet.confirmOrder'),
      ];
      if (sheet) sheet.headline = headlines[step - 1] || '';
    };

    const selectCategory = (cat: string) => {
      selectedCategory = cat;
      // update the breadcrumb shown in step 2
      const crumb = document.getElementById('msnav-cat-label');
      if (crumb) crumb.textContent = cat;
      goToStep(2);
    };

    const selectItem = (name: string, price: string) => {
      selectedItem = name;
      selectedPrice = price;
      const nameEl  = document.getElementById('msnav-item-name');
      const priceEl = document.getElementById('msnav-item-price');
      const catEl   = document.getElementById('msnav-confirm-cat');
      if (nameEl)  nameEl.textContent  = name;
      if (priceEl) priceEl.textContent = price;
      if (catEl)   catEl.textContent   = selectedCategory;
      goToStep(3);
    };

    return html`
      <md-button variant="filled"
        @click=${() => { goToStep(1); getSheet('multistep-sheet')?.show(); }}>
        ${t(globals.locale, 'sideSheet.startFlow')}
      </md-button>

      <md-side-sheet id="multistep-sheet" variant="modal" show-back
          headline=${t(globals.locale, 'sideSheet.selectCategory')} top-divider bottom-divider>

        <!-- Step 1: categories -->
        <div class="msnav-step msnav-step-1">
          <md-list>
            <md-list-item
              type="button"
              headline=${t(globals.locale, 'sideSheet.electronics')}
              supporting-text=${t(globals.locale, 'sideSheet.electronicsDesc')}
              leading-icon="devices"
              trailing-icon="chevron_right"
              @click=${() => selectCategory(t(globals.locale, 'sideSheet.electronics'))}
            ></md-list-item>
            <md-list-item
              type="button"
              headline=${t(globals.locale, 'sideSheet.homeGarden')}
              supporting-text=${t(globals.locale, 'sideSheet.homeGardenDesc')}
              leading-icon="home"
              trailing-icon="chevron_right"
              @click=${() => selectCategory(t(globals.locale, 'sideSheet.homeGarden'))}
            ></md-list-item>
            <md-list-item
              type="button"
              headline=${t(globals.locale, 'sideSheet.sportsOutdoors')}
              supporting-text=${t(globals.locale, 'sideSheet.sportsDesc')}
              leading-icon="sports"
              trailing-icon="chevron_right"
              @click=${() => selectCategory(t(globals.locale, 'sideSheet.sportsOutdoors'))}
            ></md-list-item>
          </md-list>
        </div>

        <!-- Step 2: items -->
        <div class="msnav-step msnav-step-2" hidden>
          <p style="margin: 0 0 4px; font: 400 12px/16px Roboto,sans-serif;
              color: var(--md-sys-color-on-surface-variant, #49454F);">
            ${t(globals.locale, 'sideSheet.category')}: <strong id="msnav-cat-label"></strong>
          </p>
          <md-list>
            <md-list-item
              type="button"
              headline="Wireless Headphones"
              supporting-text=${t(globals.locale, 'sideSheet.headphonesDesc')}
              leading-icon="headphones"
              trailing-supporting-text="$79.99"
              @click=${() => selectItem('Wireless Headphones', '$79.99')}
            ></md-list-item>
            <md-list-item
              type="button"
              headline="Smart Watch"
              supporting-text=${t(globals.locale, 'sideSheet.watchDesc')}
              leading-icon="watch"
              trailing-supporting-text="$199.99"
              @click=${() => selectItem('Smart Watch', '$199.99')}
            ></md-list-item>
            <md-list-item
              type="button"
              headline="Bluetooth Speaker"
              supporting-text=${t(globals.locale, 'sideSheet.speakerDesc')}
              leading-icon="speaker"
              trailing-supporting-text="$49.99"
              @click=${() => selectItem('Bluetooth Speaker', '$49.99')}
            ></md-list-item>
          </md-list>
        </div>

        <!-- Step 3: confirmation -->
        <div class="msnav-step msnav-step-3" hidden>
          <md-list>
            <md-list-item
              headline=${t(globals.locale, 'sideSheet.category')}
              supporting-text-id="msnav-confirm-cat"
            >
              <span slot="supporting-text" id="msnav-confirm-cat"></span>
            </md-list-item>
            <md-list-item headline=${t(globals.locale, 'sideSheet.item')}>
              <span slot="supporting-text" id="msnav-item-name"></span>
            </md-list-item>
            <md-list-item headline=${t(globals.locale, 'sideSheet.price')}>
              <span slot="supporting-text" id="msnav-item-price"></span>
            </md-list-item>
          </md-list>
        </div>

        <md-button slot="actions" variant="filled"
            @click=${() => getSheet('multistep-sheet')?.close()}>
          ${t(globals.locale, 'sideSheet.confirmOrder')}
        </md-button>
        <md-button slot="actions" variant="text"
            @click=${() => getSheet('multistep-sheet')?.close()}>
          ${t(globals.locale, 'cancel')}
        </md-button>
      </md-side-sheet>
    `;
  },
  /** Drives the wizard forward through its three steps. Each step is a light-DOM
   *  div (`.msnav-step-N`) slotted into the sheet; `goToStep` toggles their
   *  `hidden` flag and retitles the headline, so the visible step is the
   *  observable step-index state. Advancing is driven by the list-item rows;
   *  the header back button is event-only here (no step-decrement is wired). */
  play: async ({ canvasElement, step }) => {
    const sheet = await getHydratedSheet(canvasElement);
    const trigger = canvasElement.querySelector('md-button') as HTMLElement;
    const stepVisible = (n: number) =>
      !(sheet.querySelector(`.msnav-step-${n}`) as HTMLElement).hidden;
    const headlineText = () => part(sheet, 'headline')!.textContent!.trim();
    const text = (sel: string) => (sheet.querySelector(sel) as HTMLElement).textContent;

    await step('Trigger opens the wizard on step 1', async () => {
      let opened = false;
      sheet.addEventListener('mdOpen', () => { opened = true; }, { once: true });
      await waitFor(() => expect(trigger.classList.contains('hydrated')).toBe(true));
      expect(sheet.hasAttribute('open')).toBe(false);            // before: closed
      click(trigger);
      await waitFor(() => expect(sheet.hasAttribute('open')).toBe(true)); // proves it opened
      expect(opened).toBe(true);
      expect(stepVisible(1)).toBe(true);                         // only step 1 is shown
      expect(stepVisible(2)).toBe(false);
      expect(stepVisible(3)).toBe(false);
      await waitFor(() => expect(headlineText()).toBe('Select Category'));
    });

    await step('Picking a category advances step 1 → step 2', async () => {
      const catRow = sheet.querySelector('.msnav-step-1 md-list-item') as HTMLElement; // Electronics
      await waitFor(() => expect(catRow.classList.contains('hydrated')).toBe(true));
      expect(stepVisible(1)).toBe(true);                         // before: on step 1
      expect(stepVisible(2)).toBe(false);
      click(catRow);
      await waitFor(() => expect(stepVisible(2)).toBe(true));    // step 2 now visible — transition
      expect(stepVisible(1)).toBe(false);                        // step 1 hidden
      expect(text('#msnav-cat-label')).toBe('Electronics');      // breadcrumb carries the pick
      await waitFor(() => expect(headlineText()).toBe('Choose Item')); // headline followed the step
    });

    await step('Picking an item advances step 2 → step 3 and fills the summary', async () => {
      const itemRow = sheet.querySelector('.msnav-step-2 md-list-item') as HTMLElement; // Wireless Headphones
      await waitFor(() => expect(itemRow.classList.contains('hydrated')).toBe(true));
      expect(stepVisible(2)).toBe(true);                         // before: on step 2
      expect(stepVisible(3)).toBe(false);
      click(itemRow);
      await waitFor(() => expect(stepVisible(3)).toBe(true));    // step 3 now visible — transition
      expect(stepVisible(2)).toBe(false);                        // step 2 hidden
      // the confirmation summary reflects both prior picks
      expect(text('#msnav-item-name')).toBe('Wireless Headphones');
      expect(text('#msnav-item-price')).toBe('$79.99');
      expect(text('#msnav-confirm-cat')).toBe('Electronics');
      await waitFor(() => expect(headlineText()).toBe('Confirm order'));
    });

    await step('Header back emits mdBack but does NOT navigate (guard); close dismisses', async () => {
      const backBtn = sheet.shadowRoot!.querySelector('.md-side-sheet__back md-icon-button') as HTMLElement;
      await waitFor(() => expect(backBtn.classList.contains('hydrated')).toBe(true));
      let backFired = false;
      sheet.addEventListener('mdBack', () => { backFired = true; }, { once: true });
      expect(stepVisible(3)).toBe(true);                         // before: on step 3
      click(backBtn);
      await waitFor(() => expect(backFired).toBe(true));         // event fired…
      // …but this story wires no step-decrement, so the visible step is unchanged.
      expect(stepVisible(3)).toBe(true);
      expect(stepVisible(2)).toBe(false);

      let closed = false;
      sheet.addEventListener('mdClose', () => { closed = true; }, { once: true });
      click(closeButton(sheet));
      await waitFor(() => expect(sheet.hasAttribute('open')).toBe(false)); // sheet dismissed
      expect(closed).toBe(true);
      await new Promise((r) => setTimeout(r, 300));              // let the close animation settle
    });
  },
};

/* ─── No Close Button ─────────────────────────────────────── */

export const NoCloseButton: Story = {
  render: (_args, { globals }) => html`
    <md-button variant="filled" @click=${() => getSheet('noclose-sheet')?.show()}>
      ${t(globals.locale, 'sideSheet.openNoCloseButton')}
    </md-button>
    <md-side-sheet id="noclose-sheet" variant="modal" headline=${t(globals.locale, 'sideSheet.notifications')} closeable="false">
      <p>${t(globals.locale, 'sideSheet.noCloseBody')}</p>
      <md-list>
        <md-list-item>${t(globals.locale, 'sideSheet.newMessageAlex')}</md-list-item>
        <md-list-item>${t(globals.locale, 'sideSheet.orderShipped')}</md-list-item>
        <md-list-item>${t(globals.locale, 'sideSheet.weeklyReport')}</md-list-item>
      </md-list>
    </md-side-sheet>
  `,
};

/* ─── Custom Headline Slot ────────────────────────────────── */

export const CustomHeadlineSlot: Story = {
  render: (_args, { globals }) => html`
    <md-button variant="filled" @click=${() => getSheet('headline-slot-sheet')?.show()}>
      ${t(globals.locale, 'sideSheet.openCustomHeadline')}
    </md-button>
    <md-side-sheet id="headline-slot-sheet" variant="modal">
      <span slot="headline" style="display: flex; align-items: center; gap: 8px;">
        <span class="material-symbols-outlined" style="font-size: 24px; color: var(--md-sys-color-primary);">palette</span>
        <span>${t(globals.locale, 'sideSheet.themeEditor')}</span>
      </span>
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <div>
          <div style="font-weight: 500; margin-bottom: 8px;">${t(globals.locale, 'sideSheet.primaryColor')}</div>
          <div style="display: flex; gap: 8px;">
            <div style="width: 40px; height: 40px; border-radius: 50%; background: #6750A4; cursor: pointer;"></div>
            <div style="width: 40px; height: 40px; border-radius: 50%; background: #006A6A; cursor: pointer;"></div>
            <div style="width: 40px; height: 40px; border-radius: 50%; background: #984061; cursor: pointer;"></div>
            <div style="width: 40px; height: 40px; border-radius: 50%; background: #4A6267; cursor: pointer;"></div>
          </div>
        </div>
        <md-divider></md-divider>
        <div>
          <div style="font-weight: 500; margin-bottom: 8px;">${t(globals.locale, 'sideSheet.borderRadius')}</div>
          <md-slider min="0" max="28" value="12" value-indicator stops step="4"></md-slider>
        </div>
      </div>
      <md-button slot="actions" variant="filled" @click=${() => getSheet('headline-slot-sheet')?.close()}>
        ${t(globals.locale, 'sideSheet.applyTheme')}
      </md-button>
    </md-side-sheet>
  `,
};

/* ─── Wide Sheet ──────────────────────────────────────────── */

export const WideSheet: Story = {
  render: () => html`
    <style>
      .wide-sheet {
        --md-side-sheet-width: 480px;
        --md-side-sheet-max-width: 560px;
      }
    </style>
    <md-button variant="filled" @click=${() => getSheet('wide-sheet')?.show()}>
      Open Wide Sheet
    </md-button>
    <md-side-sheet id="wide-sheet" variant="modal" headline="Code Review" class="wide-sheet" top-divider>
      <pre style="background: var(--md-sys-color-surface-container, #f3edf7); padding: 16px; border-radius: 12px; overflow-x: auto; font-size: 13px; line-height: 1.5;">
export function calculateTotal(items: Item[]): number {
  return items.reduce((sum, item) => {
    const discount = item.discount ?? 0;
    const price = item.price * (1 - discount);
    return sum + price * item.quantity;
  }, 0);
}</pre>
      <p style="margin-top: 16px;">This wider sheet is useful for content that needs more horizontal space, like code snippets or data tables.</p>
    </md-side-sheet>
  `,
};

/* ─── Accessibility ───────────────────────────────────────── */

export const Accessibility: Story = {
  render: () => html`
    <div style="display: flex; flex-direction: column; gap: 16px; align-items: flex-start;">
      <h3 style="margin: 0;">Accessibility Features</h3>
      <p style="margin: 0; max-width: 480px; line-height: 1.5;">
        The side sheet implements full keyboard and screen reader support.
        Open each example and try navigating with Tab, Shift+Tab, and Escape.
      </p>

      <div style="display: flex; gap: 12px; flex-wrap: wrap;">
        <md-button variant="filled" @click=${() => getSheet('a11y-modal')?.show()}>
          Modal (Focus Trap)
        </md-button>
        <md-button variant="outlined" @click=${() => getSheet('a11y-labeled')?.show()}>
          Custom aria-label
        </md-button>
        <md-button variant="tonal" @click=${() => getSheet('a11y-escape')?.show()}>
          Escape to Close
        </md-button>
      </div>

      <!-- Modal with focus trap -->
      <md-side-sheet id="a11y-modal" variant="modal" headline="Focus Trap Demo">
        <p>Focus is trapped inside this modal sheet. Try pressing <kbd style="padding: 2px 6px; border-radius: 4px; background: var(--md-sys-color-surface-container, #f3edf7); font-family: monospace;">Tab</kbd> — it cycles through the focusable elements without leaving the sheet.</p>
        <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 16px;">
          <md-text-field label="First name"></md-text-field>
          <md-text-field label="Last name"></md-text-field>
          <md-text-field label="Email"></md-text-field>
        </div>
        <md-button slot="actions" variant="filled" @click=${() => getSheet('a11y-modal')?.close()}>
          Submit
        </md-button>
        <md-button slot="actions" variant="text" @click=${() => getSheet('a11y-modal')?.close()}>
          Cancel
        </md-button>
      </md-side-sheet>

      <!-- Custom aria-label (no headline) -->
      <md-side-sheet id="a11y-labeled" variant="modal" closeable>
        <span slot="headline" style="display: flex; align-items: center; gap: 8px;">
          <span class="material-symbols-outlined" style="font-size: 20px;">notifications</span>
          Notifications
        </span>
        <p>This sheet uses a custom <code>aria-label</code> for screen readers. The container has <code>role="dialog"</code> and <code>aria-modal="true"</code>.</p>
        <div style="display: flex; flex-direction: column; gap: var(--md-sys-spacing-gap-sm, 8px); margin-top: var(--md-sys-spacing-gap-md, 12px);">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span>Push notifications</span>
            <md-switch aria-label="Push notifications"></md-switch>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span>Email digest</span>
            <md-switch aria-label="Email digest"></md-switch>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span>SMS alerts</span>
            <md-switch aria-label="SMS alerts"></md-switch>
          </div>
        </div>
      </md-side-sheet>

      <!-- Escape key dismissal -->
      <md-side-sheet id="a11y-escape" variant="modal" headline="Keyboard Dismissal">
        <p>Press <kbd style="padding: 2px 6px; border-radius: 4px; background: var(--md-sys-color-surface-container, #f3edf7); font-family: monospace;">Escape</kbd> to close this sheet. The <code>mdCancel</code> event fires and focus returns to the button that opened it.</p>
        <div style="margin-top: 16px; padding: 16px; border-radius: 12px; background: var(--md-sys-color-surface-container, #f3edf7);">
          <div style="font-weight: 500; margin-bottom: 8px;">Keyboard shortcuts</div>
          <div style="display: grid; grid-template-columns: auto 1fr; gap: 4px 16px; font-size: 14px;">
            <kbd style="font-family: monospace;">Escape</kbd><span>Close sheet</span>
            <kbd style="font-family: monospace;">Tab</kbd><span>Next focusable element</span>
            <kbd style="font-family: monospace;">Shift+Tab</kbd><span>Previous focusable element</span>
          </div>
        </div>
      </md-side-sheet>
    </div>
  `,
};

/* ─── Dynamic Slots ───────────────────────────────────────── */

export const DynamicSlots: Story = {
  render: () => html`
    <md-button variant="filled" @click=${() => getSheet('dynamic-slots')?.show()}>
      Open Dynamic Slots
    </md-button>
    <md-side-sheet id="dynamic-slots" variant="modal" show-back headline="Dynamic Slots" bottom-divider>
      <p>Slotted content is added at runtime to exercise the slotchange wiring.</p>
      <md-button slot="actions" variant="filled">Primary</md-button>
    </md-side-sheet>
  `,
  /** Ships with the close/back/actions slots present (so their slotchange
   *  listeners are wired), then mutates each slot at runtime and confirms the
   *  component reacts. Also drives the focus-guard sentinels to prove the trap
   *  keeps focus inside the panel. */
  play: async ({ canvasElement, step }) => {
    const sheet = await getHydratedSheet(canvasElement);
    const trigger = canvasElement.querySelector('md-button') as HTMLElement;
    const slot = (name: string) =>
      sheet.shadowRoot!.querySelector(`slot[name="${name}"]`) as HTMLSlotElement;
    const append = (name: string, tag: string, attrs: Record<string, string> = {}) => {
      const el = document.createElement(tag);
      el.setAttribute('slot', name);
      Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
      sheet.appendChild(el);
      return el;
    };

    await step('Opens with one action already slotted', async () => {
      await waitFor(() => expect(trigger.classList.contains('hydrated')).toBe(true));
      click(trigger);
      await waitFor(() => expect(sheet.hasAttribute('open')).toBe(true)); // proves it opened
      expect(part(sheet, 'actions')).not.toBeNull();        // hasActions true at load
      expect(slot('actions').assignedElements().length).toBe(1);
    });

    await step('Adding a second action fires the actions slotchange', async () => {
      append('actions', 'md-button', { variant: 'text' });
      await waitFor(() => expect(slot('actions').assignedElements().length).toBe(2)); // slot picked it up
      expect(part(sheet, 'actions')).not.toBeNull();        // actions bar still rendered
    });

    await step('A custom close element is honored via the close slotchange', async () => {
      expect(slot('close').assignedElements().length).toBe(0);  // before: default icon only
      append('close', 'md-icon-button', { icon: 'close', variant: 'standard', 'aria-label': 'Close' });
      await waitFor(() => expect(slot('close').assignedElements().length).toBe(1)); // custom close assigned
    });

    await step('A custom back element is honored via the back slotchange', async () => {
      expect(slot('back').assignedElements().length).toBe(0);
      append('back', 'md-icon-button', { icon: 'arrow_back', variant: 'standard', 'aria-label': 'Back' });
      await waitFor(() => expect(slot('back').assignedElements().length).toBe(1)); // custom back assigned
    });

    await step('Focus guards keep Tab focus trapped inside the sheet', async () => {
      const guards = sheet.shadowRoot!.querySelectorAll('.md-side-sheet__focus-guard');
      expect(guards.length).toBe(2);
      (guards[0] as HTMLElement).focus();                   // end guard → wraps focus inward
      await waitFor(() => expect(document.activeElement).toBe(sheet));
      (guards[1] as HTMLElement).focus();                   // start guard → wraps to the last focusable
      // The last focusable is a slotted action button (light DOM), so focus
      // surfaces as that descendant — not the host — but it must stay trapped
      // inside the sheet, so assert containment rather than host identity.
      await waitFor(() => expect(sheet.contains(document.activeElement)).toBe(true));
      await sheet.close();
      await waitFor(() => expect(sheet.hasAttribute('open')).toBe(false));
      await new Promise((r) => setTimeout(r, 300));
    });
  },
};
