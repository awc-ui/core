import type { Meta, StoryObj } from '@storybook/web-components';
import { expect, waitFor } from 'storybook/test';
import { html } from 'lit';
import { t } from '../i18n';

/** Shadow-piercing + hydration helpers for play(): testing-library queries can't
 *  cross shadow roots, and a Stencil component must be `.hydrated` before it can
 *  be driven (the anchor click-toggle is wired in `componentDidLoad`). */
type FabMenuEl = HTMLElement & { open: boolean };
const getMenu = async (canvasElement: HTMLElement): Promise<FabMenuEl> => {
  const menu = canvasElement.querySelector('md-fab-menu') as FabMenuEl;
  await waitFor(() => expect(menu.classList.contains('hydrated')).toBe(true));
  return menu;
};
const getFab = async (canvasElement: HTMLElement): Promise<HTMLElement> => {
  const fab = canvasElement.querySelector('md-fab') as HTMLElement;
  await waitFor(() => expect(fab.classList.contains('hydrated')).toBe(true));
  return fab;
};
/** Menu items are slotted into the light DOM (not the shadow root). */
const itemsOf = (menu: FabMenuEl) =>
  Array.from(menu.querySelectorAll('md-fab-menu-item')) as HTMLElement[];
const key = (target: Element, k: string) =>
  target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, composed: true }));

const meta: Meta = {
  title: 'Actions/FAB Menu',
  component: 'md-fab-menu',
  tags: ['autodocs'],
  parameters: {
    docs: {
      source: { language: 'html' },
    },
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'tertiary'],
      description: 'Color set for the menu (close button uses direct color, items use container color)',
    },
    placement: {
      control: 'select',
      options: ['up', 'down', 'auto'],
      description: 'Direction items fan out from the FAB',
    },
    quick: {
      control: 'boolean',
      description: 'Skip open/close animation',
    },
    fabSize: {
      control: 'select',
      options: ['standard', 'medium', 'large'],
      description: 'Size of the trigger FAB',
    },
  },
  args: {
    variant: 'primary',
    placement: 'up',
    quick: false,
    fabSize: 'standard',
  },
};
export default meta;
type Story = StoryObj;

const WRAPPER = 'display: flex; justify-content: center; align-items: end; min-height: 500px; padding: 48px;';
const BOTTOM_RIGHT = 'position: fixed; bottom: 24px; right: 24px;';
const SECTION = 'padding: 24px; font-family: Roboto, sans-serif;';
const HEADING = 'color: #49454F; margin: 20px 0 8px; font-size: 13px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px;';

export const Playground: Story = {
  render: (args, { globals }) => html`
    <div style=${WRAPPER}>
      <div style="position: relative;">
        <md-fab id="playground-fab" icon="add" aria-label="${t(globals.locale, 'fabMenu.actions')}" size=${args.fabSize}></md-fab>
        <md-fab-menu anchor="playground-fab" variant=${args.variant} placement=${args.placement} ?quick=${args.quick}>
          <md-fab-menu-item icon="edit" label="${t(globals.locale, 'edit')}"></md-fab-menu-item>
          <md-fab-menu-item icon="share" label="${t(globals.locale, 'fabMenu.share')}"></md-fab-menu-item>
          <md-fab-menu-item icon="delete" label="${t(globals.locale, 'delete')}"></md-fab-menu-item>
        </md-fab-menu>
      </div>
    </div>
  `,
  /** The FAB↔menu open/activate/close contract, scripted (see the Interactions panel). */
  play: async ({ canvasElement, step, args }) => {
    const menu = await getMenu(canvasElement);
    const fab = await getFab(canvasElement);
    const items = itemsOf(menu);

    await step('Menu starts inert — closed, hidden from AT, items not tabbable (guard)', async () => {
      expect(menu.open).toBe(false);
      expect(menu.getAttribute('aria-hidden')).toBe('true');
      expect(menu.classList.contains('md-fab-menu--open')).toBe(false);
      // The anchor carries no expanded-state until the menu wires it on open.
      expect(fab.getAttribute('aria-expanded')).toBeNull();
      expect(items).toHaveLength(3);
      // Every item is out of the tab order while the menu is closed.
      expect(items.every((i) => i.getAttribute('tabindex') === '-1')).toBe(true);
    });

    await step('Clicking the FAB opens the menu and wires roving focus', async () => {
      let opened = false;
      menu.addEventListener('mdOpen', () => (opened = true), { once: true });
      fab.click();
      await waitFor(() => expect(menu.open).toBe(true));
      expect(opened).toBe(true); // the component actually emitted mdOpen
      // aria-hidden + the open class are JSX-derived on the Host, so Stencil
      // flips them on the next (async) render — whereas `open` is set
      // synchronously in show(). Poll them, or we read the stale closed-state
      // values before the open re-render lands.
      await waitFor(() => expect(menu.getAttribute('aria-hidden')).toBe('false')); // now exposed to AT
      await waitFor(() => expect(menu.classList.contains('md-fab-menu--open')).toBe(true));
      // Anchor aria flips null → 'true', proving the FAB↔menu wiring engaged.
      await waitFor(() => expect(fab.getAttribute('aria-expanded')).toBe('true'));
      // The first item becomes the single tab stop (roving tabindex activates on open).
      await waitFor(() => expect(items[0].getAttribute('tabindex')).toBe('0'));
    });

    await step('Clicking an item emits its mdClick and closes the menu', async () => {
      let clickedLabel: string | null = null;
      let closed = false;
      const share = items[1];
      share.addEventListener(
        'mdClick',
        (e) => { clickedLabel = (e.target as HTMLElement).getAttribute('label'); },
        { once: true },
      );
      menu.addEventListener('mdClose', () => (closed = true), { once: true });
      share.click();
      // The activated item fired mdClick, identifying itself as the source node.
      expect(clickedLabel).toBe('Share');
      // Activation closes the menu (animated: quick=false) and re-hides it from AT.
      await waitFor(() => expect(menu.open).toBe(false));
      expect(closed).toBe(true);
      // aria-hidden re-flips to 'true' on the close re-render (async) — poll it.
      await waitFor(() => expect(menu.getAttribute('aria-hidden')).toBe('true'));
      await waitFor(() => expect(fab.getAttribute('aria-expanded')).toBe('false'));
      // Settle the close animation + FAB icon-morph timers before the reopen below.
      await new Promise((r) => setTimeout(r, 300));
    });

    await step('Escape closes a reopened menu — keyboard close path (guard)', async () => {
      fab.click();
      await waitFor(() => expect(menu.open).toBe(true));
      let closedAgain = false;
      menu.addEventListener('mdClose', () => (closedAgain = true), { once: true });
      key(items[0], 'Escape');
      await waitFor(() => expect(menu.open).toBe(false));
      expect(closedAgain).toBe(true);
      // Let the close animation + FAB icon-morph timers settle before teardown.
      await new Promise((r) => setTimeout(r, 300));
    });

    await step('Clicking outside the menu and its anchor dismisses it (outside-click)', async () => {
      fab.click();
      await waitFor(() => expect(menu.open).toBe(true));
      // The document-level outside-click listener attaches on the frame after open.
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      let dismissed = false;
      menu.addEventListener('mdClose', () => (dismissed = true), { once: true });
      document.body.click(); // composedPath() excludes the menu + anchor → close()
      await waitFor(() => expect(menu.open).toBe(false));
      expect(dismissed).toBe(true);
      await new Promise((r) => setTimeout(r, 300));
    });

    await step('Clicking the FAB while open toggles it closed (toggle close path)', async () => {
      fab.click();
      await waitFor(() => expect(menu.open).toBe(true));
      let toggledClosed = false;
      menu.addEventListener('mdClose', () => (toggledClosed = true), { once: true });
      fab.click(); // a second activation routes through toggleMenu()'s close branch
      await waitFor(() => expect(menu.open).toBe(false));
      expect(toggledClosed).toBe(true);
      await new Promise((r) => setTimeout(r, 300));
    });

    await step('Changing the placement prop re-derives the effective-placement class (@Watch)', async () => {
      const placed = menu as FabMenuEl & { placement: 'up' | 'down' | 'auto' };
      // Up by default → the Host carries the --up modifier.
      expect(menu.classList.contains('md-fab-menu--up')).toBe(true);
      placed.placement = 'down';
      // @Watch('placement') updates effectivePlacement, which render maps to a Host class.
      await waitFor(() => expect(menu.classList.contains('md-fab-menu--down')).toBe(true));
      expect(menu.classList.contains('md-fab-menu--up')).toBe(false);

      // Restore. This assertion is the LAST thing the Playground runs, so
      // whatever it leaves behind is the state you are left looking at — and a
      // story that contradicts its own `placement` control is worse than no
      // coverage. Left as 'down', the FAB sits near the bottom of the frame and
      // the menu opens off-screen. Watch-driven, so the round trip is also the
      // stronger assertion: the class has to follow the prop BOTH ways.
      placed.placement = args.placement ?? 'up';
      await waitFor(() => expect(menu.classList.contains('md-fab-menu--up')).toBe(true));
      expect(menu.classList.contains('md-fab-menu--down')).toBe(false);
    });
  },
};

export const AllVariants: Story = {
  render: (_args, { globals }) => html`
    <div style="display: flex; gap: 120px; justify-content: center; align-items: end; min-height: 400px; padding: 48px;">
      <div style="position: relative; text-align: center;">
        <span style="display: block; margin-bottom: 8px; font-size: 12px; color: var(--md-sys-color-on-surface-variant);">Primary</span>
        <md-fab id="fab-primary" icon="add" variant="primary" aria-label="${t(globals.locale, 'fabMenu.actions')}"></md-fab>
        <md-fab-menu anchor="fab-primary" variant="primary">
          <md-fab-menu-item icon="edit" label="${t(globals.locale, 'edit')}"></md-fab-menu-item>
          <md-fab-menu-item icon="share" label="${t(globals.locale, 'fabMenu.share')}"></md-fab-menu-item>
          <md-fab-menu-item icon="delete" label="${t(globals.locale, 'delete')}"></md-fab-menu-item>
        </md-fab-menu>
      </div>
      <div style="position: relative; text-align: center;">
        <span style="display: block; margin-bottom: 8px; font-size: 12px; color: var(--md-sys-color-on-surface-variant);">Secondary</span>
        <md-fab id="fab-secondary" icon="add" variant="secondary" aria-label="${t(globals.locale, 'fabMenu.actions')}"></md-fab>
        <md-fab-menu anchor="fab-secondary" variant="secondary">
          <md-fab-menu-item icon="photo_camera" label="${t(globals.locale, 'fabMenu.photo')}"></md-fab-menu-item>
          <md-fab-menu-item icon="videocam" label="${t(globals.locale, 'fabMenu.video')}"></md-fab-menu-item>
          <md-fab-menu-item icon="mic" label="${t(globals.locale, 'fabMenu.audio')}"></md-fab-menu-item>
        </md-fab-menu>
      </div>
      <div style="position: relative; text-align: center;">
        <span style="display: block; margin-bottom: 8px; font-size: 12px; color: var(--md-sys-color-on-surface-variant);">Tertiary</span>
        <md-fab id="fab-tertiary" icon="add" variant="tertiary" aria-label="${t(globals.locale, 'fabMenu.actions')}"></md-fab>
        <md-fab-menu anchor="fab-tertiary" variant="tertiary">
          <md-fab-menu-item icon="note_add" label="${t(globals.locale, 'fabMenu.note')}"></md-fab-menu-item>
          <md-fab-menu-item icon="create_new_folder" label="${t(globals.locale, 'fabMenu.folder')}"></md-fab-menu-item>
          <md-fab-menu-item icon="upload" label="${t(globals.locale, 'fabMenu.upload')}"></md-fab-menu-item>
        </md-fab-menu>
      </div>
    </div>
  `,
};

export const FabSizes: Story = {
  render: (_args, { globals }) => html`
    <div style="display: flex; gap: 120px; justify-content: center; align-items: end; min-height: 500px; padding: 48px;">
      <div style="position: relative; text-align: center;">
        <span style="display: block; margin-bottom: 8px; font-size: 12px; color: var(--md-sys-color-on-surface-variant);">Standard (56px)</span>
        <md-fab id="fab-std" icon="add" size="standard" aria-label="${t(globals.locale, 'fabMenu.actions')}"></md-fab>
        <md-fab-menu anchor="fab-std" variant="primary">
          <md-fab-menu-item icon="edit" label="${t(globals.locale, 'edit')}"></md-fab-menu-item>
          <md-fab-menu-item icon="share" label="${t(globals.locale, 'fabMenu.share')}"></md-fab-menu-item>
        </md-fab-menu>
      </div>
      <div style="position: relative; text-align: center;">
        <span style="display: block; margin-bottom: 8px; font-size: 12px; color: var(--md-sys-color-on-surface-variant);">Medium (80px)</span>
        <md-fab id="fab-med" icon="add" size="medium" aria-label="${t(globals.locale, 'fabMenu.actions')}"></md-fab>
        <md-fab-menu anchor="fab-med" variant="primary">
          <md-fab-menu-item icon="edit" label="${t(globals.locale, 'edit')}"></md-fab-menu-item>
          <md-fab-menu-item icon="share" label="${t(globals.locale, 'fabMenu.share')}"></md-fab-menu-item>
        </md-fab-menu>
      </div>
      <div style="position: relative; text-align: center;">
        <span style="display: block; margin-bottom: 8px; font-size: 12px; color: var(--md-sys-color-on-surface-variant);">Large (96px)</span>
        <md-fab id="fab-lg" icon="add" size="large" aria-label="${t(globals.locale, 'fabMenu.actions')}"></md-fab>
        <md-fab-menu anchor="fab-lg" variant="primary">
          <md-fab-menu-item icon="edit" label="${t(globals.locale, 'edit')}"></md-fab-menu-item>
          <md-fab-menu-item icon="share" label="${t(globals.locale, 'fabMenu.share')}"></md-fab-menu-item>
        </md-fab-menu>
      </div>
    </div>
  `,
};

export const MaxItems: Story = {
  render: (_args, { globals }) => html`
    <div style=${WRAPPER}>
      <div style="position: relative;">
        <md-fab id="fab-max" icon="add" aria-label="${t(globals.locale, 'fabMenu.actions')}"></md-fab>
        <md-fab-menu anchor="fab-max" variant="primary">
          <md-fab-menu-item icon="edit" label="${t(globals.locale, 'edit')}"></md-fab-menu-item>
          <md-fab-menu-item icon="content_copy" label="${t(globals.locale, 'fabMenu.copy')}"></md-fab-menu-item>
          <md-fab-menu-item icon="share" label="${t(globals.locale, 'fabMenu.share')}"></md-fab-menu-item>
          <md-fab-menu-item icon="download" label="${t(globals.locale, 'fabMenu.download')}"></md-fab-menu-item>
          <md-fab-menu-item icon="bookmark" label="${t(globals.locale, 'fabMenu.bookmark')}"></md-fab-menu-item>
          <md-fab-menu-item icon="delete" label="${t(globals.locale, 'delete')}"></md-fab-menu-item>
        </md-fab-menu>
      </div>
    </div>
  `,
};

export const WithDisabledItems: Story = {
  render: (_args, { globals }) => html`
    <div style=${WRAPPER}>
      <div style="position: relative;">
        <md-fab id="fab-disabled" icon="add" aria-label="${t(globals.locale, 'fabMenu.actions')}"></md-fab>
        <md-fab-menu anchor="fab-disabled" variant="primary">
          <md-fab-menu-item icon="edit" label="${t(globals.locale, 'edit')}"></md-fab-menu-item>
          <md-fab-menu-item icon="share" label="${t(globals.locale, 'fabMenu.share')}" disabled></md-fab-menu-item>
          <md-fab-menu-item icon="delete" label="${t(globals.locale, 'delete')}"></md-fab-menu-item>
        </md-fab-menu>
      </div>
    </div>
  `,
  /** A disabled item is inert — it emits no mdClick and does not close the menu;
   *  an enabled item does both (see the Interactions panel). */
  play: async ({ canvasElement, step }) => {
    const menu = await getMenu(canvasElement);
    const fab = await getFab(canvasElement);
    const items = itemsOf(menu); // [0] Edit, [1] Share (disabled), [2] Delete
    const disabled = items[1];
    const enabled = items[2];

    await step('Opening the menu reveals all three items — the middle one disabled', async () => {
      expect(menu.open).toBe(false); // starts closed
      expect(items).toHaveLength(3);
      // The disabled item reflects its state to AT before any interaction —
      // aria-disabled is JSX-derived, so poll it rather than reading synchronously.
      await waitFor(() => expect(disabled.getAttribute('aria-disabled')).toBe('true'));
      expect(disabled.hasAttribute('disabled')).toBe(true);

      fab.click();
      await waitFor(() => expect(menu.open).toBe(true)); // closed → open transition
      await waitFor(() => expect(menu.classList.contains('md-fab-menu--open')).toBe(true));
    });

    await step('Clicking the DISABLED item emits no mdClick and leaves the menu open (guard)', async () => {
      // Prove the item is live first — an unhydrated click is a silent no-op that
      // would also fire no mdClick, passing this guard for the wrong reason.
      await waitFor(() => expect(disabled.classList.contains('hydrated')).toBe(true));
      let itemFired = false;
      let closed = false;
      disabled.addEventListener('mdClick', () => (itemFired = true), { once: true });
      menu.addEventListener('mdClose', () => (closed = true), { once: true });

      disabled.click();

      // Settle past the 180ms close-animation window a real close would take,
      // so a regressed close would have flipped `open` by now.
      await new Promise((r) => setTimeout(r, 250));
      expect(itemFired).toBe(false); // the disabled item swallowed its own click
      expect(closed).toBe(false);
      expect(menu.open).toBe(true); // menu never closed
    });

    await step('Clicking an ENABLED item emits its mdClick and closes the menu', async () => {
      await waitFor(() => expect(enabled.classList.contains('hydrated')).toBe(true));
      let clickedLabel: string | null = null;
      let closed = false;
      enabled.addEventListener(
        'mdClick',
        (e) => { clickedLabel = (e.target as HTMLElement).getAttribute('label'); },
        { once: true },
      );
      menu.addEventListener('mdClose', () => (closed = true), { once: true });

      enabled.click();
      // mdClick fires synchronously and identifies the activated item as its source.
      expect(clickedLabel).toBe('Delete');
      // Activation closes the menu (animated: quick=false) and re-hides it from AT.
      await waitFor(() => expect(menu.open).toBe(false)); // open → closed transition
      expect(closed).toBe(true);
      await waitFor(() => expect(menu.getAttribute('aria-hidden')).toBe('true'));
      // Let the close animation + FAB icon-morph timers settle before teardown.
      await new Promise((r) => setTimeout(r, 300));
    });
  },
};

export const PlacementDown: Story = {
  render: (_args, { globals }) => html`
    <div style="display: flex; justify-content: center; align-items: start; min-height: 500px; padding: 48px;">
      <div style="position: relative;">
        <md-fab id="fab-down" icon="add" aria-label="${t(globals.locale, 'fabMenu.actions')}"></md-fab>
        <md-fab-menu anchor="fab-down" variant="primary" placement="down">
          <md-fab-menu-item icon="edit" label="${t(globals.locale, 'edit')}"></md-fab-menu-item>
          <md-fab-menu-item icon="share" label="${t(globals.locale, 'fabMenu.share')}"></md-fab-menu-item>
          <md-fab-menu-item icon="delete" label="${t(globals.locale, 'delete')}"></md-fab-menu-item>
        </md-fab-menu>
      </div>
    </div>
  `,
  /** Down-placement inverts the vertical arrow mapping and positions below the FAB. */
  play: async ({ canvasElement, step }) => {
    const menu = await getMenu(canvasElement);
    const fab = await getFab(canvasElement);
    const items = itemsOf(menu);

    await step('Opening a placement=down menu applies the --down modifier and positions below', async () => {
      fab.click();
      await waitFor(() => expect(menu.open).toBe(true));
      // placement="down" (not auto) resolves straight to the down effective placement.
      await waitFor(() => expect(menu.classList.contains('md-fab-menu--down')).toBe(true));
      const container = menu.shadowRoot?.querySelector('.md-fab-menu__container') as HTMLElement;
      // positionMenu ran for a down menu → it anchors via `top`, clearing `bottom`.
      await waitFor(() => expect(container.style.top).not.toBe(''));
      expect(container.style.bottom).toBe('');
      await waitFor(() => expect(items[0].getAttribute('tabindex')).toBe('0'));
    });

    await step('Down-placement arrows fan the opposite way and hand focus back to the anchor', async () => {
      // ArrowDown advances toward later items when placement is down.
      key(items[0], 'ArrowDown');
      await waitFor(() => expect(items[1].getAttribute('tabindex')).toBe('0'));
      // ArrowUp steps back toward earlier items.
      key(items[1], 'ArrowUp');
      await waitFor(() => expect(items[0].getAttribute('tabindex')).toBe('0'));
      // ArrowUp at index 0 (placement down) returns focus to the anchor FAB.
      key(items[0], 'ArrowUp');
      await waitFor(() => expect(items.every((i) => i.getAttribute('tabindex') === '-1')).toBe(true));
      // ArrowDown on the anchor (handleAnchorKeyDown, placement down) re-enters at item 0.
      key(fab, 'ArrowDown');
      await waitFor(() => expect(items[0].getAttribute('tabindex')).toBe('0'));
    });

    await step('Escape closes the down-placement menu', async () => {
      let closed = false;
      menu.addEventListener('mdClose', () => (closed = true), { once: true });
      key(items[0], 'Escape');
      await waitFor(() => expect(menu.open).toBe(false));
      expect(closed).toBe(true);
      await new Promise((r) => setTimeout(r, 300));
    });
  },
};

export const RTL: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Menu items use CSS logical properties, so labels and icons align ' +
          'correctly inside <code>dir="rtl"</code>. Set a localized ' +
          '<code>aria-label</code> on the anchor FAB and localized ' +
          '<code>label</code> props on each item for screen readers.',
      },
    },
  },
  render: () => html`
    <div style="${SECTION}">
      <p style="${HEADING}">Arabic (العربية)</p>
      <div dir="rtl" lang="ar" style="${WRAPPER}">
        <div style="position: relative;">
          <md-fab id="fab-rtl-ar" icon="add" aria-label="إنشاء"></md-fab>
          <md-fab-menu anchor="fab-rtl-ar" variant="primary">
            <md-fab-menu-item icon="edit" label="تحرير"></md-fab-menu-item>
            <md-fab-menu-item icon="share" label="مشاركة"></md-fab-menu-item>
            <md-fab-menu-item icon="delete" label="حذف"></md-fab-menu-item>
          </md-fab-menu>
        </div>
      </div>

      <p style="${HEADING}">Hebrew (עברית)</p>
      <div dir="rtl" lang="he" style="${WRAPPER}">
        <div style="position: relative;">
          <md-fab id="fab-rtl-he" icon="add" aria-label="הוסף"></md-fab>
          <md-fab-menu anchor="fab-rtl-he" variant="secondary">
            <md-fab-menu-item icon="edit" label="עריכה"></md-fab-menu-item>
            <md-fab-menu-item icon="share" label="שיתוף"></md-fab-menu-item>
            <md-fab-menu-item icon="delete" label="מחיקה"></md-fab-menu-item>
          </md-fab-menu>
        </div>
      </div>
    </div>
  `,
  /** Under dir=rtl the open menu anchors from the logical start edge (`left`, not `right`). */
  play: async ({ canvasElement, step }) => {
    const menu = await getMenu(canvasElement); // first menu: Arabic (dir=rtl)
    const fab = await getFab(canvasElement);   // first anchor: fab-rtl-ar

    await step('Opening inside dir=rtl anchors the menu from the logical start edge', async () => {
      let opened = false;
      menu.addEventListener('mdOpen', () => (opened = true), { once: true });
      fab.click();
      await waitFor(() => expect(menu.open).toBe(true));
      expect(opened).toBe(true);
      const container = menu.shadowRoot?.querySelector('.md-fab-menu__container') as HTMLElement;
      // positionMenu detected direction:rtl → it set `left` (start) and cleared `right`.
      await waitFor(() => expect(container.style.left).not.toBe(''));
      expect(container.style.right).toBe('');
    });

    await step('Escape closes the RTL menu', async () => {
      let closed = false;
      menu.addEventListener('mdClose', () => (closed = true), { once: true });
      key(menu.querySelector('md-fab-menu-item') as Element, 'Escape');
      await waitFor(() => expect(menu.open).toBe(false));
      expect(closed).toBe(true);
      await new Promise((r) => setTimeout(r, 300));
    });
  },
};

/* ==========================================================
   LOCALIZATION — localized FAB aria-label and item labels
   ========================================================== */
export const Localization: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Set a localized <code>aria-label</code> on the anchor FAB and ' +
          'localized <code>label</code> props on each ' +
          '<code>md-fab-menu-item</code>. Wrap rows in ' +
          '<code>lang</code> and <code>dir</code> so screen readers ' +
          'pronounce labels correctly and layout mirrors in RTL locales.',
      },
    },
  },
  render: (_args, { viewMode }) => {
    const rows = [
      { code: 'en', dir: 'ltr', name: 'English',  fab: 'Create', edit: 'Edit',    share: 'Share',   del: 'Delete' },
      { code: 'fr', dir: 'ltr', name: 'Français', fab: 'Créer',  edit: 'Modifier', share: 'Partager', del: 'Supprimer' },
      { code: 'de', dir: 'ltr', name: 'Deutsch',  fab: 'Erstellen', edit: 'Bearbeiten', share: 'Teilen', del: 'Löschen' },
      { code: 'ja', dir: 'ltr', name: '日本語',     fab: '作成',     edit: '編集',     share: '共有',    del: '削除' },
      { code: 'ar', dir: 'rtl', name: 'العربية',   fab: 'إنشاء',   edit: 'تحرير',    share: 'مشاركة',  del: 'حذف' },
      { code: 'he', dir: 'rtl', name: 'עברית',    fab: 'הוסף',    edit: 'עריכה',    share: 'שיתוף',   del: 'מחיקה' },
    ];
    return html`
      <style>
        .fab-menu-l10n { padding: 24px; font-family: Roboto, sans-serif; }
        .fab-menu-l10n .grid { display: flex; flex-direction: column; }
        .fab-menu-l10n .row {
          display: flex;
          align-items: center;
          gap: 24px;
          padding-block: 16px;
          border-block-end: 1px solid #e7e0ec;
        }
        .fab-menu-l10n .info {
          flex: 0 0 180px;
          display: flex;
          align-items: baseline;
          gap: 8px;
        }
        .fab-menu-l10n .code {
          color: #6750a4;
          font-weight: 600;
          font-family: 'JetBrains Mono', ui-monospace, monospace;
        }
        .fab-menu-l10n .name { color: #49454F; font-size: 14px; }
        .fab-menu-l10n .demo {
          flex: 1 1 auto;
          display: flex;
          justify-content: center;
          align-items: end;
          min-height: 280px;
          padding: 16px;
        }
      </style>
      <div class="fab-menu-l10n">
        <p style="color:#49454F; margin:0 0 16px; font-size:14px;">
          Each row carries its own <code>lang</code> and <code>dir</code>.
          Menus are shown open so localized item labels are visible.
        </p>
        <div class="grid">
          ${rows.map((r) => html`
            <div class="row" lang="${r.code}" dir="${r.dir}">
              <div class="info">
                <span class="code">${r.code}</span>
                <span class="name">${r.name}</span>
              </div>
              <div class="demo">
                <div style="position: relative;">
                  <md-fab id="l10n-fab-${r.code}" icon="add" aria-label="${r.fab}"></md-fab>
                  <md-fab-menu anchor="l10n-fab-${r.code}" variant="primary" ?open=${viewMode !== 'docs'} quick>
                    <md-fab-menu-item icon="edit" label="${r.edit}"></md-fab-menu-item>
                    <md-fab-menu-item icon="share" label="${r.share}"></md-fab-menu-item>
                    <md-fab-menu-item icon="delete" label="${r.del}"></md-fab-menu-item>
                  </md-fab-menu>
                </div>
              </div>
            </div>
          `)}
        </div>
      </div>
    `;
  },
};

export const DarkTheme: Story = {
  render: (_args, { globals }) => html`
    <div style=${WRAPPER}>
      <div style="position: relative;">
        <md-fab id="fab-dark" icon="add" aria-label="${t(globals.locale, 'fabMenu.actions')}"></md-fab>
        <md-fab-menu anchor="fab-dark" variant="primary">
          <md-fab-menu-item icon="edit" label="${t(globals.locale, 'edit')}"></md-fab-menu-item>
          <md-fab-menu-item icon="share" label="${t(globals.locale, 'fabMenu.share')}"></md-fab-menu-item>
          <md-fab-menu-item icon="delete" label="${t(globals.locale, 'delete')}"></md-fab-menu-item>
        </md-fab-menu>
      </div>
    </div>
  `,
  decorators: [
    (story) => html`
      <div data-theme="dark" style="background: var(--md-sys-color-surface); padding: 24px; border-radius: 16px; min-height: 500px;">
        ${story()}
      </div>
    `,
  ],
};

export const CustomCSS: Story = {
  render: (_args, { globals }) => html`
    <style>
      .custom-fab-menu {
        --md-fab-menu-close-container-color: var(--md-sys-color-error);
        --md-fab-menu-close-icon-color: var(--md-sys-color-on-error);
        --md-fab-menu-item-container-color: var(--md-sys-color-error-container);
        --md-fab-menu-item-label-color: var(--md-sys-color-on-error-container);
      }
    </style>
    <div style=${WRAPPER}>
      <div style="position: relative;">
        <md-fab id="fab-custom" icon="warning" aria-label="${t(globals.locale, 'fabMenu.dangerActions')}"
          style="--md-fab-container-color: var(--md-sys-color-error); --md-fab-icon-color: var(--md-sys-color-on-error);">
        </md-fab>
        <md-fab-menu anchor="fab-custom" class="custom-fab-menu">
          <md-fab-menu-item icon="block" label="${t(globals.locale, 'fabMenu.block')}"></md-fab-menu-item>
          <md-fab-menu-item icon="report" label="${t(globals.locale, 'fabMenu.report')}"></md-fab-menu-item>
          <md-fab-menu-item icon="delete_forever" label="${t(globals.locale, 'fabMenu.deleteForever')}"></md-fab-menu-item>
        </md-fab-menu>
      </div>
    </div>
  `,
};

export const SlottedIcons: Story = {
  render: (_args, { globals }) => html`
    <div style=${WRAPPER}>
      <div style="position: relative;">
        <md-fab id="fab-slotted" icon="add" aria-label="${t(globals.locale, 'fabMenu.actions')}"></md-fab>
        <md-fab-menu anchor="fab-slotted" variant="tertiary">
          <md-fab-menu-item label="${t(globals.locale, 'fabMenu.star')}">
            <svg slot="icon" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
          </md-fab-menu-item>
          <md-fab-menu-item label="${t(globals.locale, 'fabMenu.rocket')}">
            <span slot="icon" style="font-size: 20px;">🚀</span>
          </md-fab-menu-item>
          <md-fab-menu-item icon="favorite" label="${t(globals.locale, 'fabMenu.heart')}"></md-fab-menu-item>
        </md-fab-menu>
      </div>
    </div>
  `,
};

export const BottomRightPlacement: Story = {
  render: (_args, { globals }) => html`
    <div style="min-height: 600px; position: relative;">
      <p style="padding: 24px; color: var(--md-sys-color-on-surface);">
        Click the FAB in the bottom-right corner to open the menu.
        This demonstrates the typical placement of a FAB menu in an application.
      </p>
      <div style=${BOTTOM_RIGHT}>
        <md-fab id="fab-br" icon="add" aria-label="${t(globals.locale, 'fabMenu.createNew')}"></md-fab>
        <md-fab-menu anchor="fab-br" variant="primary">
          <md-fab-menu-item icon="description" label="${t(globals.locale, 'fabMenu.document')}"></md-fab-menu-item>
          <md-fab-menu-item icon="image" label="${t(globals.locale, 'fabMenu.image')}"></md-fab-menu-item>
          <md-fab-menu-item icon="folder" label="${t(globals.locale, 'fabMenu.folder')}"></md-fab-menu-item>
          <md-fab-menu-item icon="link" label="${t(globals.locale, 'fabMenu.link')}"></md-fab-menu-item>
        </md-fab-menu>
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
          'FAB menus fan out from a corner FAB — on narrow viewports keep the ' +
          'trigger in the bottom-end safe area and use <code>placement="auto"</code> ' +
          'so items flip upward when space below is tight. Menu items are ' +
          'fixed-size; the responsive concern is ensuring the expanded stack ' +
          'does not clip off-screen in small containers.',
      },
    },
  },
  render: (_args, { globals }) => html`
    <style>
      .fm-resp-shell { display: flex; flex-direction: column; gap: 32px; max-width: 1100px; }
      .fm-resp-vp__label { font-size: 11px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase; color: var(--md-sys-color-on-surface-variant, #49454F); margin-block-end: 6px; }
      .fm-resp-vp {
        border: 1px dashed var(--md-sys-color-outline-variant, #cac4d0);
        border-radius: 12px;
        padding: 0;
        background: var(--md-sys-color-surface-container-lowest, #fffbfe);
        box-sizing: border-box;
        margin-block-end: 12px;
        position: relative;
        overflow: hidden;
      }
      .fm-resp-corner {
        position: absolute;
        inset-block-end: 16px;
        inset-inline-end: 16px;
      }
      .fm-resp-scaffold {
        padding: 16px;
        min-block-size: 280px;
        font: 400 14px/20px Roboto, sans-serif;
        color: var(--md-sys-color-on-surface-variant, #49454F);
      }
      .fm-resp-live { resize: horizontal; overflow: auto; min-inline-size: 240px; max-inline-size: 100%; inline-size: 400px; min-block-size: 320px; }
    </style>

    <div class="fm-resp-shell">
      <section>
        <h3 style="margin: 0 0 4px;">Corner menu at four breakpoints</h3>
        <p style="margin: 0 0 16px; font-size: 14px; color: var(--md-sys-color-on-surface-variant, #49454F);">
          Click the FAB to expand — items fan upward from the corner in each frame.
        </p>
        ${[
          { label: 'XS · 320 px (phone)', width: '320px', suffix: 'xs' },
          { label: 'SM · 480 px (large phone)', width: '480px', suffix: 'sm' },
          { label: 'MD · 768 px (tablet)', width: '768px', suffix: 'md' },
          { label: 'LG · 1024 px (desktop)', width: '1024px', suffix: 'lg' },
        ].map(
          (vp) => html`
            <div>
              <div class="fm-resp-vp__label">${vp.label}</div>
              <div class="fm-resp-vp" style="inline-size: ${vp.width}; max-inline-size: 100%;">
                <div class="fm-resp-scaffold">
                  Tap the + button to open the speed-dial menu.
                </div>
                <div class="fm-resp-corner">
                  <md-fab id="fm-resp-${vp.suffix}" icon="add" aria-label="${t(globals.locale, 'fabMenu.createNew')}"></md-fab>
                  <md-fab-menu anchor="fm-resp-${vp.suffix}" placement="auto" variant="primary">
                    <md-fab-menu-item icon="description" label="${t(globals.locale, 'fabMenu.document')}"></md-fab-menu-item>
                    <md-fab-menu-item icon="image" label="${t(globals.locale, 'fabMenu.image')}"></md-fab-menu-item>
                    <md-fab-menu-item icon="folder" label="${t(globals.locale, 'fabMenu.folder')}"></md-fab-menu-item>
                  </md-fab-menu>
                </div>
              </div>
            </div>
          `,
        )}
      </section>

      <section>
        <h3 style="margin: 0 0 4px;">Live resize playground</h3>
        <p style="margin: 0 0 16px; font-size: 14px; color: var(--md-sys-color-on-surface-variant, #49454F);">
          Drag the bottom-right corner, then open the menu to check for clipping.
        </p>
        <div class="fm-resp-vp fm-resp-live">
          <div class="fm-resp-scaffold">Resize this frame and open the menu.</div>
          <div class="fm-resp-corner">
            <md-fab id="fm-resp-live" icon="add" aria-label="${t(globals.locale, 'fabMenu.createNew')}"></md-fab>
            <md-fab-menu anchor="fm-resp-live" placement="auto" variant="secondary">
              <md-fab-menu-item icon="edit" label="${t(globals.locale, 'edit')}"></md-fab-menu-item>
              <md-fab-menu-item icon="share" label="${t(globals.locale, 'fabMenu.share')}"></md-fab-menu-item>
              <md-fab-menu-item icon="delete" label="${t(globals.locale, 'delete')}"></md-fab-menu-item>
            </md-fab-menu>
          </div>
        </div>
      </section>
    </div>
  `,
};

// ──────────────────────────────────────────────────────────────
// Open at mount — the componentDidLoad open branch (no click needed)
// ──────────────────────────────────────────────────────────────
export const OpenOnMount: Story = {
  name: 'Open On Mount',
  render: (_args, { globals, viewMode }) => html`
    <div style=${WRAPPER}>
      <div style="position: relative;">
        <md-fab id="fab-open-mount" icon="add" aria-label="${t(globals.locale, 'fabMenu.actions')}"></md-fab>
        <md-fab-menu anchor="fab-open-mount" variant="primary" ?open=${viewMode !== 'docs'}>
          <md-fab-menu-item icon="edit" label="${t(globals.locale, 'edit')}"></md-fab-menu-item>
          <md-fab-menu-item icon="share" label="${t(globals.locale, 'fabMenu.share')}"></md-fab-menu-item>
          <md-fab-menu-item icon="delete" label="${t(globals.locale, 'delete')}"></md-fab-menu-item>
        </md-fab-menu>
      </div>
    </div>
  `,
  /** A menu authored open=true wires up in componentDidLoad's open branch — no click. */
  play: async ({ canvasElement, step }) => {
    const menu = await getMenu(canvasElement);
    const fab = await getFab(canvasElement);
    const items = itemsOf(menu);

    await step('A menu rendered open is live at mount (componentDidLoad open branch)', async () => {
      expect(menu.open).toBe(true);
      // Open at mount exposes the menu to AT and wires anchor state (without emitting mdOpen).
      await waitFor(() => expect(menu.getAttribute('aria-hidden')).toBe('false'));
      await waitFor(() => expect(fab.getAttribute('aria-expanded')).toBe('true'));
      // aria-controls points the anchor at the menu's generated id.
      await waitFor(() => expect(fab.getAttribute('aria-controls')).toBe(menu.getAttribute('id')));
      // Roving tabindex is initialised so the first item is the single tab stop.
      await waitFor(() => expect(items[0].getAttribute('tabindex')).toBe('0'));
      expect(items.slice(1).every((i) => i.getAttribute('tabindex') === '-1')).toBe(true);
    });

    await step('Escape closes a menu that was open at mount', async () => {
      let closed = false;
      menu.addEventListener('mdClose', () => (closed = true), { once: true });
      key(items[0], 'Escape');
      await waitFor(() => expect(menu.open).toBe(false));
      expect(closed).toBe(true);
      await new Promise((r) => setTimeout(r, 300));
    });
  },
};

// ──────────────────────────────────────────────────────────────
// Keyboard navigation — roving tabindex, typeahead, anchor keydown, Tab
// ──────────────────────────────────────────────────────────────
export const KeyboardNavigation: Story = {
  name: 'Keyboard Navigation',
  render: (_args, { globals }) => html`
    <div style=${WRAPPER}>
      <div style="position: relative;">
        <md-fab id="fab-kbd" icon="add" aria-label="${t(globals.locale, 'fabMenu.actions')}"></md-fab>
        <md-fab-menu anchor="fab-kbd" variant="primary" placement="up">
          <md-fab-menu-item icon="edit" label="${t(globals.locale, 'edit')}"></md-fab-menu-item>
          <md-fab-menu-item icon="share" label="${t(globals.locale, 'fabMenu.share')}"></md-fab-menu-item>
          <md-fab-menu-item icon="delete" label="${t(globals.locale, 'delete')}"></md-fab-menu-item>
        </md-fab-menu>
      </div>
    </div>
  `,
  /** Full APG keyboard model: arrows, Home/End, typeahead, focusin sync, anchor keys, Tab. */
  play: async ({ canvasElement, step }) => {
    const menu = await getMenu(canvasElement);
    const fab = await getFab(canvasElement);
    const items = itemsOf(menu); // [0] Edit, [1] Share, [2] Delete

    const shiftTab = (target: Element) =>
      target.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, composed: true }),
      );

    await step('Open the menu and land roving focus on the first item', async () => {
      fab.click();
      await waitFor(() => expect(menu.open).toBe(true));
      await waitFor(() => expect(items[0].getAttribute('tabindex')).toBe('0'));
    });

    await step('Arrow / Home / End / typeahead move the single roving tab stop (placement=up)', async () => {
      // Up-menu: ArrowUp advances toward later (visually higher) items.
      key(items[0], 'ArrowUp');
      await waitFor(() => expect(items[1].getAttribute('tabindex')).toBe('0'));
      expect(items[0].getAttribute('tabindex')).toBe('-1');
      // ArrowDown steps back toward earlier items.
      key(items[1], 'ArrowDown');
      await waitFor(() => expect(items[0].getAttribute('tabindex')).toBe('0'));
      // End jumps to the last item.
      key(items[0], 'End');
      await waitFor(() => expect(items[2].getAttribute('tabindex')).toBe('0'));
      // Home jumps back to the first item.
      key(items[2], 'Home');
      await waitFor(() => expect(items[0].getAttribute('tabindex')).toBe('0'));
      // Typeahead 's' matches "Share" (index 1).
      key(items[0], 's');
      await waitFor(() => expect(items[1].getAttribute('tabindex')).toBe('0'));
    });

    await step('focusin on a different item syncs the roving tab stop to it', async () => {
      // Item 1 currently holds the tab stop; a focusin on item 2 re-homes it (handleFocusIn).
      items[2].dispatchEvent(new FocusEvent('focusin', { bubbles: true, composed: true }));
      await waitFor(() => expect(items[2].getAttribute('tabindex')).toBe('0'));
      expect(items[1].getAttribute('tabindex')).toBe('-1');
    });

    await step('ArrowDown from the first item exits to the anchor; ArrowUp on the anchor re-enters', async () => {
      key(items[2], 'Home'); // move the tab stop back to index 0
      await waitFor(() => expect(items[0].getAttribute('tabindex')).toBe('0'));
      // ArrowDown at index 0 (placement up) hands focus back to the anchor FAB (focusAnchor).
      key(items[0], 'ArrowDown');
      await waitFor(() => expect(items.every((i) => i.getAttribute('tabindex') === '-1')).toBe(true));
      // ArrowUp on the anchor (handleAnchorKeyDown) re-enters the menu at the first item.
      key(fab, 'ArrowUp');
      await waitFor(() => expect(items[0].getAttribute('tabindex')).toBe('0'));
    });

    await step('Tab walks forward through items; Tab on the last item closes the menu', async () => {
      key(items[0], 'Tab');
      await waitFor(() => expect(items[1].getAttribute('tabindex')).toBe('0'));
      key(items[1], 'Tab');
      await waitFor(() => expect(items[2].getAttribute('tabindex')).toBe('0'));
      let closed = false;
      menu.addEventListener('mdClose', () => (closed = true), { once: true });
      key(items[2], 'Tab'); // Tab past the last item closes the menu
      await waitFor(() => expect(menu.open).toBe(false));
      expect(closed).toBe(true);
      await new Promise((r) => setTimeout(r, 300));
    });

    await step('Shift+Tab exits to the anchor; Tab on the anchor re-enters; Shift+Tab steps back', async () => {
      fab.click();
      await waitFor(() => expect(menu.open).toBe(true));
      await waitFor(() => expect(items[0].getAttribute('tabindex')).toBe('0'));
      // Shift+Tab at index 0 exits to the anchor (all items leave the tab order).
      shiftTab(items[0]);
      await waitFor(() => expect(items.every((i) => i.getAttribute('tabindex') === '-1')).toBe(true));
      // Tab on the anchor (handleAnchorKeyDown) re-enters at the first item.
      key(fab, 'Tab');
      await waitFor(() => expect(items[0].getAttribute('tabindex')).toBe('0'));
      // From the last item, Shift+Tab steps back one item.
      key(items[0], 'End');
      await waitFor(() => expect(items[2].getAttribute('tabindex')).toBe('0'));
      shiftTab(items[2]);
      await waitFor(() => expect(items[1].getAttribute('tabindex')).toBe('0'));
    });

    await step('Escape on the anchor closes the menu (handleAnchorKeyDown)', async () => {
      let closed = false;
      menu.addEventListener('mdClose', () => (closed = true), { once: true });
      key(fab, 'Escape'); // anchor-level Escape routes through handleAnchorKeyDown
      await waitFor(() => expect(menu.open).toBe(false));
      expect(closed).toBe(true);
      await new Promise((r) => setTimeout(r, 300));
    });
  },
};
