import type { Meta, StoryObj } from '@storybook/web-components';
import { expect, waitFor } from 'storybook/test';
import { html } from 'lit';
import { t, type Locale } from '../i18n';

/** Shadow-piercing helpers for play(): testing-library queries can't cross
 *  shadow roots, so interactions address the real internals directly. */
type MenuEl = HTMLElement & { open: boolean; show: () => void; close: () => void };
const getMenu = async (canvasElement: HTMLElement, id: string): Promise<MenuEl> => {
  const menu = canvasElement.querySelector(`#${id}`) as MenuEl;
  await waitFor(() => expect(menu.classList.contains('hydrated')).toBe(true));
  return menu;
};
/** In default (non-listbox) mode the surface is the `role="menu"` container. */
const surfaceOf = (menu: MenuEl) =>
  menu.shadowRoot!.querySelector('.md-menu__surface') as HTMLElement;
/** Menu items are slotted light-DOM children; each reflects its role/aria/headline
 *  on its own host element. */
const itemsOf = (menu: MenuEl) =>
  [...menu.querySelectorAll('md-menu-item')] as HTMLElement[];
/** Look a row up by its headline. Headlines are LOCALISED by the stories, so a
 *  play() must pass the resolved string for the active locale — never a hardcoded
 *  English literal, or the test throws on undefined the moment the Locale toolbar
 *  is anything but en-US. Use `itemByKey` below instead. */
const itemByHeadline = (menu: MenuEl, headline: string) =>
  itemsOf(menu).find((i) => i.getAttribute('headline') === headline)!;
/** Locale-safe row lookup: resolves the message key the story rendered with. */
const itemByKey = (menu: MenuEl, locale: Locale, key: string) =>
  itemByHeadline(menu, t(locale, key));
/** Roving tabindex moves REAL focus onto the md-menu-item host (light DOM), so
 *  the focused item is simply `document.activeElement`. */
const focusedItem = () => document.activeElement as HTMLElement;
const key = (target: Element, k: string) =>
  target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, composed: true }));

const meta: Meta = {
  title: 'Navigation/Menu',
  component: 'md-menu',
  tags: ['autodocs'],
  argTypes: {
    variant: { control: 'select', options: ['baseline', 'standard', 'vibrant'] },
    placement: { control: 'select', options: ['bottom-start', 'bottom-end', 'top-start', 'top-end'] },
    quick: { control: 'boolean' },
  },
  args: {
    variant: 'baseline',
    placement: 'bottom-start',
    quick: false,
  },
};
export default meta;
type Story = StoryObj;

/* ═══════════════════════════════════════════════════════════
   1. PLAYGROUND
   ═══════════════════════════════════════════════════════════ */
export const Playground: Story = {
  render: (args, { globals }) => html`
    <div style="padding: 32px; font-family: sans-serif;">
      <md-button id="playground-anchor" variant="filled" aria-haspopup="menu" onclick="document.getElementById('playground-menu').show()">
        Open Menu
      </md-button>
      <md-menu
        id="playground-menu"
        anchor="playground-anchor"
        variant="${args.variant}"
        placement="${args.placement}"
        ?quick="${args.quick}"
      >
        <md-menu-item headline="${t(globals.locale, 'menu.cut')}" trailing-text="⌘X">
          <span slot="leading-icon" class="material-symbols-outlined">content_cut</span>
        </md-menu-item>
        <md-menu-item headline="${t(globals.locale, 'menu.copy')}" trailing-text="⌘C">
          <span slot="leading-icon" class="material-symbols-outlined">content_copy</span>
        </md-menu-item>
        <md-menu-item headline="${t(globals.locale, 'menu.paste')}" trailing-text="⌘V" divider>
          <span slot="leading-icon" class="material-symbols-outlined">content_paste</span>
        </md-menu-item>
        <md-menu-item headline="${t(globals.locale, 'delete')}" disabled>
          <span slot="leading-icon" class="material-symbols-outlined">delete</span>
        </md-menu-item>
      </md-menu>
    </div>
  `,
  /** Open-via-trigger, then activate an item — scripted (see the Interactions panel). */
  play: async ({ canvasElement, step, globals }) => {
    const menu = await getMenu(canvasElement, 'playground-menu');
    const trigger = canvasElement.querySelector('#playground-anchor') as HTMLElement;

    await step('Trigger opens the menu; items are exposed as menuitems', async () => {
      // Closed steady-state: not open, and hidden from the a11y tree.
      expect(menu.open).toBe(false);
      expect(menu.getAttribute('aria-hidden')).toBe('true');
      trigger.click();
      // The transition the trigger drives: closed → open, surfaced to AT.
      await waitFor(() => expect(menu.open).toBe(true));
      await waitFor(() => expect(menu.getAttribute('aria-hidden')).toBe('false'));
      expect(surfaceOf(menu).getAttribute('role')).toBe('menu');
      const items = itemsOf(menu);
      expect(items.length).toBe(4); // Cut, Copy, Paste, Delete
      expect(items.every((i) => i.getAttribute('role') === 'menuitem')).toBe(true);
    });

    await step('Clicking an item emits mdClick and closes the menu', async () => {
      const copy = itemByKey(menu, globals.locale, 'menu.copy');
      let fired = false;
      copy.addEventListener('mdClick', () => (fired = true), { once: true });
      copy.click();
      // mdClick emits synchronously during activation — proves the component fired,
      // not just that its DOM mutated.
      expect(fired).toBe(true);
      // A default (non-keep-open) item dismisses: open flips back and the surface
      // is re-hidden after the ~300ms close sequence.
      await waitFor(() => expect(menu.open).toBe(false));
      await waitFor(() => expect(menu.getAttribute('aria-hidden')).toBe('true'));
      await new Promise((r) => setTimeout(r, 300));
    });

    await step('Reopen; typeahead jumps focus to a prefix-matching item', async () => {
      trigger.click();
      await waitFor(() => expect(menu.open).toBe(true));
      // Auto-focus (pointer open, ring-less) lands real focus on the first item.
      await waitFor(() => expect(focusedItem().tagName.toLowerCase()).toBe('md-menu-item'));
      // Normalize to the first item, then a printable key drives typeahead.
      key(focusedItem(), 'Home');
      await waitFor(() => expect(focusedItem().getAttribute('headline')).toBe('Cut'));
      // 'p' matches the 'Paste' item by headline prefix and moves focus onto it —
      // exercising handleTypeahead + getItemLabel, not just a state we set.
      key(focusedItem(), 'p');
      await waitFor(() => expect(focusedItem().getAttribute('headline')).toBe('Paste'));
    });

    await step('quick close bypasses the close animation', async () => {
      // With `quick` set, close() flips `open` synchronously — no 150ms closing
      // transition — which is the fast-dismiss branch of close().
      (menu as unknown as { quick: boolean }).quick = true;
      await menu.close();
      expect(menu.open).toBe(false);
      (menu as unknown as { quick: boolean }).quick = false;
      await new Promise((r) => setTimeout(r, 100));
    });
  },
};

/* ═══════════════════════════════════════════════════════════
   2. BASELINE VARIANT
   ═══════════════════════════════════════════════════════════ */
export const Baseline: Story = {
  render: (_args, { globals }) => html`
    <div style="display: flex; gap: 48px; padding: 32px; flex-wrap: wrap; font-family: sans-serif;">
      <div style="display: flex; flex-direction: column; gap: 12px; width: 260px;">
        <h3 style="margin: 0; font-size: 14px; color: #666;">Basic menu</h3>
        <md-button id="baseline-basic-anchor" variant="filled" aria-haspopup="menu" onclick="document.getElementById('baseline-basic-menu').show()">
          Open Baseline Menu
        </md-button>
        <md-menu id="baseline-basic-menu" anchor="baseline-basic-anchor" variant="baseline">
          <md-menu-item headline="${t(globals.locale, 'edit')}">
            <span slot="leading-icon" class="material-symbols-outlined">edit</span>
          </md-menu-item>
          <md-menu-item headline="${t(globals.locale, 'menu.duplicate')}">
            <span slot="leading-icon" class="material-symbols-outlined">content_copy</span>
          </md-menu-item>
          <md-menu-item headline="${t(globals.locale, 'menu.share')}">
            <span slot="leading-icon" class="material-symbols-outlined">share</span>
          </md-menu-item>
          <md-menu-item headline="${t(globals.locale, 'delete')}" disabled>
            <span slot="leading-icon" class="material-symbols-outlined">delete</span>
          </md-menu-item>
        </md-menu>
      </div>

      <div style="display: flex; flex-direction: column; gap: 12px; width: 260px;">
        <h3 style="margin: 0; font-size: 14px; color: #666;">With trailing text & divider</h3>
        <md-button id="baseline-trailing-anchor" variant="filled" aria-haspopup="menu" onclick="document.getElementById('baseline-trailing-menu').show()">
          Open Trailing Text Menu
        </md-button>
        <md-menu id="baseline-trailing-menu" anchor="baseline-trailing-anchor" variant="baseline">
          <md-menu-item headline="${t(globals.locale, 'menu.undo')}" trailing-text="⌘Z">
            <span slot="leading-icon" class="material-symbols-outlined">undo</span>
          </md-menu-item>
          <md-menu-item headline="${t(globals.locale, 'menu.redo')}" trailing-text="⌘⇧Z" divider>
            <span slot="leading-icon" class="material-symbols-outlined">redo</span>
          </md-menu-item>
          <md-menu-item headline="${t(globals.locale, 'menu.cut')}" trailing-text="⌘X">
            <span slot="leading-icon" class="material-symbols-outlined">content_cut</span>
          </md-menu-item>
          <md-menu-item headline="${t(globals.locale, 'menu.copy')}" trailing-text="⌘C">
            <span slot="leading-icon" class="material-symbols-outlined">content_copy</span>
          </md-menu-item>
          <md-menu-item headline="${t(globals.locale, 'menu.paste')}" trailing-text="⌘V">
            <span slot="leading-icon" class="material-symbols-outlined">content_paste</span>
          </md-menu-item>
        </md-menu>
      </div>

      <div style="display: flex; flex-direction: column; gap: 12px; width: 260px;">
        <h3 style="margin: 0; font-size: 14px; color: #666;">With supporting text</h3>
        <md-button id="baseline-supporting-anchor" variant="filled" aria-haspopup="menu" onclick="document.getElementById('baseline-supporting-menu').show()">
          Open Supporting Text Menu
        </md-button>
        <md-menu id="baseline-supporting-menu" anchor="baseline-supporting-anchor" variant="baseline">
          <md-menu-item headline="${t(globals.locale, 'menu.profile')}" supporting-text="${t(globals.locale, 'menu.viewYourProfile')}">
            <span slot="leading-icon" class="material-symbols-outlined">person</span>
          </md-menu-item>
          <md-menu-item headline="${t(globals.locale, 'settings')}" supporting-text="${t(globals.locale, 'menu.appPreferences')}">
            <span slot="leading-icon" class="material-symbols-outlined">settings</span>
          </md-menu-item>
          <md-menu-item headline="${t(globals.locale, 'menu.help')}" supporting-text="${t(globals.locale, 'menu.docsAndSupport')}" divider>
            <span slot="leading-icon" class="material-symbols-outlined">help</span>
          </md-menu-item>
          <md-menu-item headline="${t(globals.locale, 'menu.signOut')}">
            <span slot="leading-icon" class="material-symbols-outlined">logout</span>
          </md-menu-item>
        </md-menu>
      </div>
    </div>
  `,
};

/* ═══════════════════════════════════════════════════════════
   3. VERTICAL MENU — STANDARD
   ═══════════════════════════════════════════════════════════ */
export const VerticalStandard: Story = {
  render: (_args, { globals }) => html`
    <div style="display: flex; gap: 48px; padding: 32px; flex-wrap: wrap; font-family: sans-serif;">
      <div style="display: flex; flex-direction: column; gap: 12px; width: 260px;">
        <h3 style="margin: 0; font-size: 14px; color: #666;">Standard — Flat</h3>
        <md-button id="vertical-std-flat-anchor" variant="filled" aria-haspopup="menu" onclick="document.getElementById('vertical-std-flat-menu').show()">
          Open Standard Menu
        </md-button>
        <md-menu id="vertical-std-flat-menu" anchor="vertical-std-flat-anchor" variant="standard">
          <md-menu-item headline="${t(globals.locale, 'menu.newFile')}">
            <span slot="leading-icon" class="material-symbols-outlined">note_add</span>
          </md-menu-item>
          <md-menu-item headline="${t(globals.locale, 'menu.open')}">
            <span slot="leading-icon" class="material-symbols-outlined">folder_open</span>
          </md-menu-item>
          <md-menu-item headline="${t(globals.locale, 'save')}" trailing-text="⌘S">
            <span slot="leading-icon" class="material-symbols-outlined">save</span>
          </md-menu-item>
          <md-menu-item headline="${t(globals.locale, 'menu.export')}" divider>
            <span slot="leading-icon" class="material-symbols-outlined">download</span>
          </md-menu-item>
          <md-menu-item headline="${t(globals.locale, 'menu.print')}" trailing-text="⌘P">
            <span slot="leading-icon" class="material-symbols-outlined">print</span>
          </md-menu-item>
        </md-menu>
      </div>

      <div style="display: flex; flex-direction: column; gap: 12px; width: 260px;">
        <h3 style="margin: 0; font-size: 14px; color: #666;">Standard — With selection</h3>
        <md-button id="vertical-std-selection-anchor" variant="filled" aria-haspopup="menu" onclick="document.getElementById('vertical-std-selection-menu').show()">
          Open Selection Menu
        </md-button>
        <md-menu id="vertical-std-selection-menu" anchor="vertical-std-selection-anchor" variant="standard">
          <md-menu-item headline="${t(globals.locale, 'menu.sortByName')}" selected>
            <span slot="leading-icon" class="material-symbols-outlined">sort_by_alpha</span>
          </md-menu-item>
          <md-menu-item headline="${t(globals.locale, 'menu.sortByDate')}">
            <span slot="leading-icon" class="material-symbols-outlined">calendar_today</span>
          </md-menu-item>
          <md-menu-item headline="${t(globals.locale, 'menu.sortBySize')}">
            <span slot="leading-icon" class="material-symbols-outlined">storage</span>
          </md-menu-item>
        </md-menu>
      </div>

      <div style="display: flex; flex-direction: column; gap: 12px; width: 260px;">
        <h3 style="margin: 0; font-size: 14px; color: #666;">Standard — Grouped</h3>
        <md-button id="vertical-std-grouped-anchor" variant="filled" aria-haspopup="menu" onclick="document.getElementById('vertical-std-grouped-menu').show()">
          Open Grouped Menu
        </md-button>
        <md-menu id="vertical-std-grouped-menu" anchor="vertical-std-grouped-anchor" variant="standard" layout="grouped">
          <md-menu-item-group label="${t(globals.locale, 'menu.file')}">
            <md-menu-item headline="${t(globals.locale, 'menu.new')}">
              <span slot="leading-icon" class="material-symbols-outlined">note_add</span>
            </md-menu-item>
            <md-menu-item headline="${t(globals.locale, 'menu.open')}">
              <span slot="leading-icon" class="material-symbols-outlined">folder_open</span>
            </md-menu-item>
          </md-menu-item-group>
          <md-menu-item-group label="${t(globals.locale, 'edit')}">
            <md-menu-item headline="${t(globals.locale, 'menu.undo')}" trailing-text="⌘Z">
              <span slot="leading-icon" class="material-symbols-outlined">undo</span>
            </md-menu-item>
            <md-menu-item headline="${t(globals.locale, 'menu.redo')}" trailing-text="⌘⇧Z">
              <span slot="leading-icon" class="material-symbols-outlined">redo</span>
            </md-menu-item>
          </md-menu-item-group>
        </md-menu>
      </div>
    </div>
  `,
};

/* ═══════════════════════════════════════════════════════════
   4. VERTICAL MENU — VIBRANT
   ═══════════════════════════════════════════════════════════ */
export const VerticalVibrant: Story = {
  render: (_args, { globals }) => html`
    <div style="display: flex; gap: 48px; padding: 32px; flex-wrap: wrap; font-family: sans-serif;">
      <div style="display: flex; flex-direction: column; gap: 12px; width: 260px;">
        <h3 style="margin: 0; font-size: 14px; color: #666;">Vibrant — Flat</h3>
        <md-button id="vertical-vib-flat-anchor" variant="filled" aria-haspopup="menu" onclick="document.getElementById('vertical-vib-flat-menu').show()">
          Open Vibrant Menu
        </md-button>
        <md-menu id="vertical-vib-flat-menu" anchor="vertical-vib-flat-anchor" variant="vibrant">
          <md-menu-item headline="${t(globals.locale, 'menu.inbox')}">
            <span slot="leading-icon" class="material-symbols-outlined">inbox</span>
          </md-menu-item>
          <md-menu-item headline="${t(globals.locale, 'menu.starred')}" selected>
            <span slot="leading-icon" class="material-symbols-outlined">star</span>
          </md-menu-item>
          <md-menu-item headline="${t(globals.locale, 'menu.sent')}">
            <span slot="leading-icon" class="material-symbols-outlined">send</span>
          </md-menu-item>
          <md-menu-item headline="${t(globals.locale, 'menu.drafts')}">
            <span slot="leading-icon" class="material-symbols-outlined">drafts</span>
          </md-menu-item>
        </md-menu>
      </div>

      <div style="display: flex; flex-direction: column; gap: 12px; width: 260px;">
        <h3 style="margin: 0; font-size: 14px; color: #666;">Vibrant — Grouped with gap</h3>
        <md-button id="vertical-vib-gap-anchor" variant="filled" aria-haspopup="menu" onclick="document.getElementById('vertical-vib-gap-menu').show()">
          Open Grouped Gap Menu
        </md-button>
        <md-menu id="vertical-vib-gap-menu" anchor="vertical-vib-gap-anchor" variant="vibrant" layout="grouped" use-gap>
          <md-menu-item-group label="${t(globals.locale, 'menu.overview')}">
            <md-menu-item headline="${t(globals.locale, 'menu.dashboard')}">
              <span slot="leading-icon" class="material-symbols-outlined">dashboard</span>
            </md-menu-item>
            <md-menu-item headline="${t(globals.locale, 'menu.analytics')}">
              <span slot="leading-icon" class="material-symbols-outlined">analytics</span>
            </md-menu-item>
          </md-menu-item-group>
          <md-menu-item-group label="${t(globals.locale, 'menu.tools')}">
            <md-menu-item headline="${t(globals.locale, 'menu.reports')}">
              <span slot="leading-icon" class="material-symbols-outlined">assessment</span>
            </md-menu-item>
            <md-menu-item headline="${t(globals.locale, 'settings')}" disabled>
              <span slot="leading-icon" class="material-symbols-outlined">settings</span>
            </md-menu-item>
          </md-menu-item-group>
        </md-menu>
      </div>

      <div style="display: flex; flex-direction: column; gap: 12px; width: 260px;">
        <h3 style="margin: 0; font-size: 14px; color: #666;">Vibrant — Grouped</h3>
        <md-button id="vertical-vib-grouped-anchor" variant="filled" aria-haspopup="menu" onclick="document.getElementById('vertical-vib-grouped-menu').show()">
          Open Grouped Menu
        </md-button>
        <md-menu id="vertical-vib-grouped-menu" anchor="vertical-vib-grouped-anchor" variant="vibrant" layout="grouped">
          <md-menu-item-group label="${t(globals.locale, 'menu.actions')}">
            <md-menu-item headline="${t(globals.locale, 'menu.reply')}">
              <span slot="leading-icon" class="material-symbols-outlined">reply</span>
            </md-menu-item>
            <md-menu-item headline="${t(globals.locale, 'menu.forward')}">
              <span slot="leading-icon" class="material-symbols-outlined">forward</span>
            </md-menu-item>
          </md-menu-item-group>
          <md-menu-item-group label="${t(globals.locale, 'menu.manage')}">
            <md-menu-item headline="${t(globals.locale, 'menu.archive')}">
              <span slot="leading-icon" class="material-symbols-outlined">archive</span>
            </md-menu-item>
            <md-menu-item headline="${t(globals.locale, 'delete')}">
              <span slot="leading-icon" class="material-symbols-outlined">delete</span>
            </md-menu-item>
          </md-menu-item-group>
        </md-menu>
      </div>
    </div>
  `,
};

/* ═══════════════════════════════════════════════════════════
   5. GROUPED + GAP — STACKED CARD CONTAINERS
   Using layout="grouped" with use-gap splits groups into
   separate card containers separated by a gap.
   ═══════════════════════════════════════════════════════════ */
export const GroupedWithGap: Story = {
  render: (_args, { globals }) => html`
    <div style="display: flex; gap: 48px; padding: 32px; flex-wrap: wrap; font-family: sans-serif;">
      <div style="display: flex; flex-direction: column; gap: 12px; width: 280px;">
        <h3 style="margin: 0; font-size: 14px; color: #666;">Standard — Grouped with gap</h3>
        <md-button id="gap-std-labeled-anchor" variant="filled" aria-haspopup="menu" onclick="document.getElementById('gap-std-labeled-menu').show()">
          Open Grouped Gap Menu
        </md-button>
        <md-menu id="gap-std-labeled-menu" anchor="gap-std-labeled-anchor" variant="standard" layout="grouped" use-gap>
          <md-menu-item-group label="${t(globals.locale, 'menu.file')}">
            <md-menu-item headline="${t(globals.locale, 'menu.new')}">
              <span slot="leading-icon" class="material-symbols-outlined">note_add</span>
            </md-menu-item>
            <md-menu-item headline="${t(globals.locale, 'menu.open')}">
              <span slot="leading-icon" class="material-symbols-outlined">folder_open</span>
            </md-menu-item>
            <md-menu-item headline="${t(globals.locale, 'save')}" trailing-text="⌘S">
              <span slot="leading-icon" class="material-symbols-outlined">save</span>
            </md-menu-item>
          </md-menu-item-group>
          <md-menu-item-group label="${t(globals.locale, 'edit')}">
            <md-menu-item headline="${t(globals.locale, 'menu.undo')}" trailing-text="⌘Z">
              <span slot="leading-icon" class="material-symbols-outlined">undo</span>
            </md-menu-item>
            <md-menu-item headline="${t(globals.locale, 'menu.redo')}" trailing-text="⌘⇧Z">
              <span slot="leading-icon" class="material-symbols-outlined">redo</span>
            </md-menu-item>
          </md-menu-item-group>
        </md-menu>
      </div>

      <div style="display: flex; flex-direction: column; gap: 12px; width: 280px;">
        <h3 style="margin: 0; font-size: 14px; color: #666;">Vibrant — Grouped with gap</h3>
        <md-button id="gap-vib-labeled-anchor" variant="filled" aria-haspopup="menu" onclick="document.getElementById('gap-vib-labeled-menu').show()">
          Open Vibrant Gap Menu
        </md-button>
        <md-menu id="gap-vib-labeled-menu" anchor="gap-vib-labeled-anchor" variant="vibrant" layout="grouped" use-gap>
          <md-menu-item-group label="${t(globals.locale, 'menu.mail')}">
            <md-menu-item headline="${t(globals.locale, 'menu.inbox')}">
              <span slot="leading-icon" class="material-symbols-outlined">inbox</span>
            </md-menu-item>
            <md-menu-item headline="${t(globals.locale, 'menu.starred')}" selected>
              <span slot="leading-icon" class="material-symbols-outlined">star</span>
            </md-menu-item>
          </md-menu-item-group>
          <md-menu-item-group label="${t(globals.locale, 'menu.folders')}">
            <md-menu-item headline="${t(globals.locale, 'menu.sent')}">
              <span slot="leading-icon" class="material-symbols-outlined">send</span>
            </md-menu-item>
            <md-menu-item headline="${t(globals.locale, 'menu.drafts')}">
              <span slot="leading-icon" class="material-symbols-outlined">drafts</span>
            </md-menu-item>
          </md-menu-item-group>
        </md-menu>
      </div>

      <div style="display: flex; flex-direction: column; gap: 12px; width: 280px;">
        <h3 style="margin: 0; font-size: 14px; color: #666;">Standard — No labels</h3>
        <md-button id="gap-std-unlabeled-anchor" variant="filled" aria-haspopup="menu" onclick="document.getElementById('gap-std-unlabeled-menu').show()">
          Open No Labels Menu
        </md-button>
        <md-menu id="gap-std-unlabeled-menu" anchor="gap-std-unlabeled-anchor" variant="standard" layout="grouped" use-gap>
          <md-menu-item-group>
            <md-menu-item headline="${t(globals.locale, 'menu.new')}">
              <span slot="leading-icon" class="material-symbols-outlined">note_add</span>
            </md-menu-item>
            <md-menu-item headline="${t(globals.locale, 'menu.open')}">
              <span slot="leading-icon" class="material-symbols-outlined">folder_open</span>
            </md-menu-item>
          </md-menu-item-group>
          <md-menu-item-group>
            <md-menu-item headline="${t(globals.locale, 'save')}" trailing-text="⌘S">
              <span slot="leading-icon" class="material-symbols-outlined">save</span>
            </md-menu-item>
            <md-menu-item headline="${t(globals.locale, 'menu.export')}">
              <span slot="leading-icon" class="material-symbols-outlined">download</span>
            </md-menu-item>
            <md-menu-item headline="${t(globals.locale, 'menu.print')}" trailing-text="⌘P">
              <span slot="leading-icon" class="material-symbols-outlined">print</span>
            </md-menu-item>
          </md-menu-item-group>
        </md-menu>
      </div>

      <div style="display: flex; flex-direction: column; gap: 12px; width: 280px;">
        <h3 style="margin: 0; font-size: 14px; color: #666;">Vibrant — No labels</h3>
        <md-button id="gap-vib-unlabeled-anchor" variant="filled" aria-haspopup="menu" onclick="document.getElementById('gap-vib-unlabeled-menu').show()">
          Open Vibrant No Labels Menu
        </md-button>
        <md-menu id="gap-vib-unlabeled-menu" anchor="gap-vib-unlabeled-anchor" variant="vibrant" layout="grouped" use-gap>
          <md-menu-item-group>
            <md-menu-item headline="${t(globals.locale, 'menu.dashboard')}">
              <span slot="leading-icon" class="material-symbols-outlined">dashboard</span>
            </md-menu-item>
            <md-menu-item headline="${t(globals.locale, 'menu.analytics')}">
              <span slot="leading-icon" class="material-symbols-outlined">analytics</span>
            </md-menu-item>
          </md-menu-item-group>
          <md-menu-item-group>
            <md-menu-item headline="${t(globals.locale, 'menu.reports')}">
              <span slot="leading-icon" class="material-symbols-outlined">assessment</span>
            </md-menu-item>
            <md-menu-item headline="${t(globals.locale, 'settings')}" disabled>
              <span slot="leading-icon" class="material-symbols-outlined">settings</span>
            </md-menu-item>
          </md-menu-item-group>
        </md-menu>
      </div>

      <div style="display: flex; flex-direction: column; gap: 12px; width: 280px;">
        <h3 style="margin: 0; font-size: 14px; color: #666;">Standard — 3 groups</h3>
        <md-button id="gap-std-3groups-anchor" variant="filled" aria-haspopup="menu" onclick="document.getElementById('gap-std-3groups-menu').show()">
          Open 3 Groups Menu
        </md-button>
        <md-menu id="gap-std-3groups-menu" anchor="gap-std-3groups-anchor" variant="standard" layout="grouped" use-gap>
          <md-menu-item-group label="${t(globals.locale, 'menu.history')}">
            <md-menu-item headline="${t(globals.locale, 'menu.undo')}" trailing-text="⌘Z">
              <span slot="leading-icon" class="material-symbols-outlined">undo</span>
            </md-menu-item>
            <md-menu-item headline="${t(globals.locale, 'menu.redo')}" trailing-text="⌘⇧Z">
              <span slot="leading-icon" class="material-symbols-outlined">redo</span>
            </md-menu-item>
          </md-menu-item-group>
          <md-menu-item-group label="${t(globals.locale, 'menu.clipboard')}">
            <md-menu-item headline="${t(globals.locale, 'menu.cut')}" trailing-text="⌘X">
              <span slot="leading-icon" class="material-symbols-outlined">content_cut</span>
            </md-menu-item>
            <md-menu-item headline="${t(globals.locale, 'menu.copy')}" trailing-text="⌘C">
              <span slot="leading-icon" class="material-symbols-outlined">content_copy</span>
            </md-menu-item>
            <md-menu-item headline="${t(globals.locale, 'menu.paste')}" trailing-text="⌘V">
              <span slot="leading-icon" class="material-symbols-outlined">content_paste</span>
            </md-menu-item>
          </md-menu-item-group>
          <md-menu-item-group label="${t(globals.locale, 'menu.other')}">
            <md-menu-item headline="${t(globals.locale, 'delete')}">
              <span slot="leading-icon" class="material-symbols-outlined">delete</span>
            </md-menu-item>
          </md-menu-item-group>
        </md-menu>
      </div>

      <div style="display: flex; flex-direction: column; gap: 12px; width: 280px;">
        <h3 style="margin: 0; font-size: 14px; color: #666;">Gap vs Divider comparison</h3>
        <div style="display: flex; gap: 24px;">
          <div>
            <p style="margin: 0 0 8px; font-size: 12px; color: #49454F;">Divider (grouped)</p>
            <md-button id="gap-divider-anchor" variant="outlined" aria-haspopup="menu" onclick="document.getElementById('gap-divider-menu').show()">
              Open Divider Menu
            </md-button>
            <md-menu id="gap-divider-menu" anchor="gap-divider-anchor" variant="standard" layout="grouped">
              <md-menu-item-group label="${t(globals.locale, 'menu.clipboard')}">
                <md-menu-item headline="${t(globals.locale, 'menu.cut')}" trailing-text="⌘X">
                  <span slot="leading-icon" class="material-symbols-outlined">content_cut</span>
                </md-menu-item>
                <md-menu-item headline="${t(globals.locale, 'menu.copy')}" trailing-text="⌘C">
                  <span slot="leading-icon" class="material-symbols-outlined">content_copy</span>
                </md-menu-item>
              </md-menu-item-group>
              <md-menu-item-group label="${t(globals.locale, 'menu.actions')}">
                <md-menu-item headline="${t(globals.locale, 'menu.paste')}" trailing-text="⌘V">
                  <span slot="leading-icon" class="material-symbols-outlined">content_paste</span>
                </md-menu-item>
              </md-menu-item-group>
            </md-menu>
          </div>
          <div>
            <p style="margin: 0 0 8px; font-size: 12px; color: #49454F;">Gap (stacked cards)</p>
            <md-button id="gap-stacked-anchor" variant="outlined" aria-haspopup="menu" onclick="document.getElementById('gap-stacked-menu').show()">
              Open Gap Menu
            </md-button>
            <md-menu id="gap-stacked-menu" anchor="gap-stacked-anchor" variant="standard" layout="grouped" use-gap>
              <md-menu-item-group label="${t(globals.locale, 'menu.clipboard')}">
                <md-menu-item headline="${t(globals.locale, 'menu.cut')}" trailing-text="⌘X">
                  <span slot="leading-icon" class="material-symbols-outlined">content_cut</span>
                </md-menu-item>
                <md-menu-item headline="${t(globals.locale, 'menu.copy')}" trailing-text="⌘C">
                  <span slot="leading-icon" class="material-symbols-outlined">content_copy</span>
                </md-menu-item>
              </md-menu-item-group>
              <md-menu-item-group label="${t(globals.locale, 'menu.actions')}">
                <md-menu-item headline="${t(globals.locale, 'menu.paste')}" trailing-text="⌘V">
                  <span slot="leading-icon" class="material-symbols-outlined">content_paste</span>
                </md-menu-item>
              </md-menu-item-group>
            </md-menu>
          </div>
        </div>
      </div>
    </div>
  `,
  /** Slot-mutation contract, scripted on the standard use-gap grouped menu:
   *  adding children re-runs propagateVariant (variant + use-gap stamping) and
   *  updateSections (gap-driven sectioning). */
  play: async ({ canvasElement, step }) => {
    const menu = await getMenu(canvasElement, 'gap-std-labeled-menu');
    const trigger = canvasElement.querySelector('#gap-std-labeled-anchor') as HTMLElement;

    await step('Opens the use-gap grouped menu', async () => {
      trigger.click();
      await waitFor(() => expect(menu.open).toBe(true));
      await waitFor(() => expect(menu.getAttribute('aria-hidden')).toBe('false'));
    });

    await step('Slotting a new group propagates the variant + use-gap onto it and its items', async () => {
      // Appending children fires slotchange → propagateVariant: a use-gap menu
      // stamps data-use-gap + data-variant on each group and mirrors the variant
      // onto the group's nested items.
      const group = document.createElement('md-menu-item-group');
      group.setAttribute('label', 'Extra');
      const nested = document.createElement('md-menu-item');
      nested.setAttribute('headline', 'Nested item');
      group.appendChild(nested);
      menu.appendChild(group);

      await waitFor(() => expect(group.getAttribute('data-variant')).toBe('standard'));
      expect(group.hasAttribute('data-use-gap')).toBe(true);
      await waitFor(() => expect(nested.getAttribute('data-variant')).toBe('standard'));

      menu.removeChild(group);
    });

    await step('A `gap`-marked item starts a new section on the following sibling', async () => {
      // updateSections walks the slotted children: an item carrying `gap` opens a
      // new visual section, so the NEXT sibling is tagged data-after-gap and the
      // host reflects md-menu--sectioned.
      const marker = document.createElement('md-menu-item');
      marker.setAttribute('headline', 'Section A end');
      marker.setAttribute('gap', '');
      const after = document.createElement('md-menu-item');
      after.setAttribute('headline', 'Section B start');
      menu.appendChild(marker);
      menu.appendChild(after);

      await waitFor(() => expect(after.hasAttribute('data-after-gap')).toBe(true));
      await waitFor(() => expect(menu.classList.contains('md-menu--sectioned')).toBe(true));

      menu.removeChild(marker);
      menu.removeChild(after);
      menu.close();
      await waitFor(() => expect(menu.open).toBe(false));
      await new Promise((r) => setTimeout(r, 300));
    });
  },
};

/* ═══════════════════════════════════════════════════════════
   6. SELECTION — CHECKBOX & RADIO
   All combinations of type × check-position × variant × icons
   ═══════════════════════════════════════════════════════════ */
export const Selection: Story = {
  render: (_args, { globals }) => html`
    <div style="display: flex; flex-direction: column; gap: 40px; padding: 32px; font-family: sans-serif;">

      <!-- ── ROW 1: Checkbox — check end (default) ── -->
      <div>
        <h2 style="margin: 0 0 16px; font-size: 16px; font-weight: 500; color: #333;">Checkbox — check end (default)</h2>
        <div style="display: flex; gap: 32px; flex-wrap: wrap;">
          <div style="display: flex; flex-direction: column; gap: 8px; width: 260px;">
            <h3 style="margin: 0; font-size: 13px; color: #49454F;">Baseline</h3>
            <md-button id="sel-cb-end-bl-anchor" variant="filled" aria-haspopup="menu" onclick="document.getElementById('sel-cb-end-bl-menu').show()">
              Open Checkbox Menu
            </md-button>
            <md-menu id="sel-cb-end-bl-menu" anchor="sel-cb-end-bl-anchor" variant="baseline">
              <md-menu-item headline="${t(globals.locale, 'menu.notifications')}" type="checkbox" keep-open selected>
                <span slot="leading-icon" class="material-symbols-outlined">notifications</span>
              </md-menu-item>
              <md-menu-item headline="${t(globals.locale, 'menu.darkMode')}" type="checkbox" keep-open>
                <span slot="leading-icon" class="material-symbols-outlined">dark_mode</span>
              </md-menu-item>
              <md-menu-item headline="${t(globals.locale, 'menu.compactView')}" type="checkbox" keep-open>
                <span slot="leading-icon" class="material-symbols-outlined">view_compact</span>
              </md-menu-item>
            </md-menu>
          </div>
          <div style="display: flex; flex-direction: column; gap: 8px; width: 260px;">
            <h3 style="margin: 0; font-size: 13px; color: #49454F;">Standard</h3>
            <md-button id="sel-cb-end-std-anchor" variant="filled" aria-haspopup="menu" onclick="document.getElementById('sel-cb-end-std-menu').show()">
              Open Checkbox Menu
            </md-button>
            <md-menu id="sel-cb-end-std-menu" anchor="sel-cb-end-std-anchor" variant="standard">
              <md-menu-item headline="${t(globals.locale, 'menu.notifications')}" type="checkbox" keep-open selected>
                <span slot="leading-icon" class="material-symbols-outlined">notifications</span>
              </md-menu-item>
              <md-menu-item headline="${t(globals.locale, 'menu.darkMode')}" type="checkbox" keep-open>
                <span slot="leading-icon" class="material-symbols-outlined">dark_mode</span>
              </md-menu-item>
              <md-menu-item headline="${t(globals.locale, 'menu.compactView')}" type="checkbox" keep-open selected>
                <span slot="leading-icon" class="material-symbols-outlined">view_compact</span>
              </md-menu-item>
            </md-menu>
          </div>
          <div style="display: flex; flex-direction: column; gap: 8px; width: 260px;">
            <h3 style="margin: 0; font-size: 13px; color: #49454F;">Vibrant</h3>
            <md-button id="sel-cb-end-vib-anchor" variant="filled" aria-haspopup="menu" onclick="document.getElementById('sel-cb-end-vib-menu').show()">
              Open Checkbox Menu
            </md-button>
            <md-menu id="sel-cb-end-vib-menu" anchor="sel-cb-end-vib-anchor" variant="vibrant">
              <md-menu-item headline="${t(globals.locale, 'menu.notifications')}" type="checkbox" keep-open selected>
                <span slot="leading-icon" class="material-symbols-outlined">notifications</span>
              </md-menu-item>
              <md-menu-item headline="${t(globals.locale, 'menu.darkMode')}" type="checkbox" keep-open>
                <span slot="leading-icon" class="material-symbols-outlined">dark_mode</span>
              </md-menu-item>
              <md-menu-item headline="${t(globals.locale, 'menu.compactView')}" type="checkbox" keep-open>
                <span slot="leading-icon" class="material-symbols-outlined">view_compact</span>
              </md-menu-item>
            </md-menu>
          </div>
        </div>
      </div>

      <!-- ── ROW 2: Checkbox — check start ── -->
      <div>
        <h2 style="margin: 0 0 16px; font-size: 16px; font-weight: 500; color: #333;">Checkbox — check start</h2>
        <div style="display: flex; gap: 32px; flex-wrap: wrap;">
          <div style="display: flex; flex-direction: column; gap: 8px; width: 260px;">
            <h3 style="margin: 0; font-size: 13px; color: #49454F;">Baseline + icons</h3>
            <md-button id="sel-cb-start-bl-anchor" variant="filled" aria-haspopup="menu" onclick="document.getElementById('sel-cb-start-bl-menu').show()">
              Open Check Start Menu
            </md-button>
            <md-menu id="sel-cb-start-bl-menu" anchor="sel-cb-start-bl-anchor" variant="baseline">
              <md-menu-item headline="${t(globals.locale, 'menu.notifications')}" type="checkbox" check-position="start" keep-open selected>
                <span slot="leading-icon" class="material-symbols-outlined">notifications</span>
              </md-menu-item>
              <md-menu-item headline="${t(globals.locale, 'menu.darkMode')}" type="checkbox" check-position="start" keep-open>
                <span slot="leading-icon" class="material-symbols-outlined">dark_mode</span>
              </md-menu-item>
              <md-menu-item headline="${t(globals.locale, 'menu.compactView')}" type="checkbox" check-position="start" keep-open>
                <span slot="leading-icon" class="material-symbols-outlined">view_compact</span>
              </md-menu-item>
            </md-menu>
          </div>
          <div style="display: flex; flex-direction: column; gap: 8px; width: 260px;">
            <h3 style="margin: 0; font-size: 13px; color: #49454F;">Standard + no icons</h3>
            <md-button id="sel-cb-start-std-anchor" variant="filled" aria-haspopup="menu" onclick="document.getElementById('sel-cb-start-std-menu').show()">
              Open Check Start Menu
            </md-button>
            <md-menu id="sel-cb-start-std-menu" anchor="sel-cb-start-std-anchor" variant="standard">
              <md-menu-item headline="Wi-Fi" type="checkbox" check-position="start" keep-open selected></md-menu-item>
              <md-menu-item headline="Bluetooth" type="checkbox" check-position="start" keep-open selected></md-menu-item>
              <md-menu-item headline="${t(globals.locale, 'menu.airplaneMode')}" type="checkbox" check-position="start" keep-open></md-menu-item>
            </md-menu>
          </div>
          <div style="display: flex; flex-direction: column; gap: 8px; width: 260px;">
            <h3 style="margin: 0; font-size: 13px; color: #49454F;">Vibrant + no icons</h3>
            <md-button id="sel-cb-start-vib-anchor" variant="filled" aria-haspopup="menu" onclick="document.getElementById('sel-cb-start-vib-menu').show()">
              Open Check Start Menu
            </md-button>
            <md-menu id="sel-cb-start-vib-menu" anchor="sel-cb-start-vib-anchor" variant="vibrant">
              <md-menu-item headline="${t(globals.locale, 'menu.bold')}" type="checkbox" check-position="start" keep-open selected></md-menu-item>
              <md-menu-item headline="${t(globals.locale, 'menu.italic')}" type="checkbox" check-position="start" keep-open></md-menu-item>
              <md-menu-item headline="${t(globals.locale, 'menu.underline')}" type="checkbox" check-position="start" keep-open selected></md-menu-item>
            </md-menu>
          </div>
        </div>
      </div>

      <!-- ── ROW 3: Radio — check end (default) ── -->
      <div>
        <h2 style="margin: 0 0 16px; font-size: 16px; font-weight: 500; color: #333;">Radio — check end (default)</h2>
        <div style="display: flex; gap: 32px; flex-wrap: wrap;">
          <div style="display: flex; flex-direction: column; gap: 8px; width: 260px;">
            <h3 style="margin: 0; font-size: 13px; color: #49454F;">Baseline</h3>
            <md-button id="sel-radio-end-bl-anchor" variant="filled" aria-haspopup="menu" onclick="document.getElementById('sel-radio-end-bl-menu').show()">
              Open Radio Menu
            </md-button>
            <md-menu id="sel-radio-end-bl-menu" anchor="sel-radio-end-bl-anchor" variant="baseline">
              <md-menu-item headline="${t(globals.locale, 'menu.small')}" type="radio" keep-open>
                <span slot="leading-icon" class="material-symbols-outlined">text_decrease</span>
              </md-menu-item>
              <md-menu-item headline="${t(globals.locale, 'menu.medium')}" type="radio" keep-open selected>
                <span slot="leading-icon" class="material-symbols-outlined">text_fields</span>
              </md-menu-item>
              <md-menu-item headline="${t(globals.locale, 'menu.large')}" type="radio" keep-open>
                <span slot="leading-icon" class="material-symbols-outlined">text_increase</span>
              </md-menu-item>
            </md-menu>
          </div>
          <div style="display: flex; flex-direction: column; gap: 8px; width: 260px;">
            <h3 style="margin: 0; font-size: 13px; color: #49454F;">Standard</h3>
            <md-button id="sel-radio-end-std-anchor" variant="filled" aria-haspopup="menu" onclick="document.getElementById('sel-radio-end-std-menu').show()">
              Open Radio Menu
            </md-button>
            <md-menu id="sel-radio-end-std-menu" anchor="sel-radio-end-std-anchor" variant="standard">
              <md-menu-item headline="${t(globals.locale, 'menu.sortByName')}" type="radio" keep-open selected>
                <span slot="leading-icon" class="material-symbols-outlined">sort_by_alpha</span>
              </md-menu-item>
              <md-menu-item headline="${t(globals.locale, 'menu.sortByDate')}" type="radio" keep-open>
                <span slot="leading-icon" class="material-symbols-outlined">calendar_today</span>
              </md-menu-item>
              <md-menu-item headline="${t(globals.locale, 'menu.sortBySize')}" type="radio" keep-open>
                <span slot="leading-icon" class="material-symbols-outlined">storage</span>
              </md-menu-item>
            </md-menu>
          </div>
          <div style="display: flex; flex-direction: column; gap: 8px; width: 260px;">
            <h3 style="margin: 0; font-size: 13px; color: #49454F;">Vibrant</h3>
            <md-button id="sel-radio-end-vib-anchor" variant="filled" aria-haspopup="menu" onclick="document.getElementById('sel-radio-end-vib-menu').show()">
              Open Radio Menu
            </md-button>
            <md-menu id="sel-radio-end-vib-menu" anchor="sel-radio-end-vib-anchor" variant="vibrant">
              <md-menu-item headline="${t(globals.locale, 'menu.light')}" type="radio" keep-open selected>
                <span slot="leading-icon" class="material-symbols-outlined">light_mode</span>
              </md-menu-item>
              <md-menu-item headline="${t(globals.locale, 'menu.dark')}" type="radio" keep-open>
                <span slot="leading-icon" class="material-symbols-outlined">dark_mode</span>
              </md-menu-item>
              <md-menu-item headline="${t(globals.locale, 'menu.system')}" type="radio" keep-open>
                <span slot="leading-icon" class="material-symbols-outlined">brightness_auto</span>
              </md-menu-item>
            </md-menu>
          </div>
        </div>
      </div>

      <!-- ── ROW 4: Radio — check start ── -->
      <div>
        <h2 style="margin: 0 0 16px; font-size: 16px; font-weight: 500; color: #333;">Radio — check start</h2>
        <div style="display: flex; gap: 32px; flex-wrap: wrap;">
          <div style="display: flex; flex-direction: column; gap: 8px; width: 260px;">
            <h3 style="margin: 0; font-size: 13px; color: #49454F;">Baseline + icons</h3>
            <md-button id="sel-radio-start-bl-anchor" variant="filled" aria-haspopup="menu" onclick="document.getElementById('sel-radio-start-bl-menu').show()">
              Open Radio Start Menu
            </md-button>
            <md-menu id="sel-radio-start-bl-menu" anchor="sel-radio-start-bl-anchor" variant="baseline">
              <md-menu-item headline="${t(globals.locale, 'menu.listView')}" type="radio" check-position="start" keep-open selected>
                <span slot="leading-icon" class="material-symbols-outlined">view_list</span>
              </md-menu-item>
              <md-menu-item headline="${t(globals.locale, 'menu.gridView')}" type="radio" check-position="start" keep-open>
                <span slot="leading-icon" class="material-symbols-outlined">grid_view</span>
              </md-menu-item>
              <md-menu-item headline="${t(globals.locale, 'menu.columnView')}" type="radio" check-position="start" keep-open>
                <span slot="leading-icon" class="material-symbols-outlined">view_column</span>
              </md-menu-item>
            </md-menu>
          </div>
          <div style="display: flex; flex-direction: column; gap: 8px; width: 260px;">
            <h3 style="margin: 0; font-size: 13px; color: #49454F;">Standard + no icons</h3>
            <md-button id="sel-radio-start-std-anchor" variant="filled" aria-haspopup="menu" onclick="document.getElementById('sel-radio-start-std-menu').show()">
              Open Radio Start Menu
            </md-button>
            <md-menu id="sel-radio-start-std-menu" anchor="sel-radio-start-std-anchor" variant="standard">
              <md-menu-item headline="${t(globals.locale, 'menu.english')}" type="radio" check-position="start" keep-open selected></md-menu-item>
              <md-menu-item headline="${t(globals.locale, 'menu.french')}" type="radio" check-position="start" keep-open></md-menu-item>
              <md-menu-item headline="${t(globals.locale, 'menu.german')}" type="radio" check-position="start" keep-open></md-menu-item>
              <md-menu-item headline="${t(globals.locale, 'menu.japanese')}" type="radio" check-position="start" keep-open></md-menu-item>
            </md-menu>
          </div>
          <div style="display: flex; flex-direction: column; gap: 8px; width: 260px;">
            <h3 style="margin: 0; font-size: 13px; color: #49454F;">Vibrant + no icons</h3>
            <md-button id="sel-radio-start-vib-anchor" variant="filled" aria-haspopup="menu" onclick="document.getElementById('sel-radio-start-vib-menu').show()">
              Open Radio Start Menu
            </md-button>
            <md-menu id="sel-radio-start-vib-menu" anchor="sel-radio-start-vib-anchor" variant="vibrant">
              <md-menu-item headline="${t(globals.locale, 'menu.low')}" type="radio" check-position="start" keep-open></md-menu-item>
              <md-menu-item headline="${t(globals.locale, 'menu.medium')}" type="radio" check-position="start" keep-open selected></md-menu-item>
              <md-menu-item headline="${t(globals.locale, 'menu.high')}" type="radio" check-position="start" keep-open></md-menu-item>
              <md-menu-item headline="${t(globals.locale, 'menu.critical')}" type="radio" check-position="start" keep-open></md-menu-item>
            </md-menu>
          </div>
        </div>
      </div>

      <!-- ── ROW 5: Mixed — checkbox + radio in same menu ── -->
      <div>
        <h2 style="margin: 0 0 16px; font-size: 16px; font-weight: 500; color: #333;">Mixed types in one menu</h2>
        <div style="display: flex; gap: 32px; flex-wrap: wrap;">
          <div style="display: flex; flex-direction: column; gap: 8px; width: 280px;">
            <h3 style="margin: 0; font-size: 13px; color: #49454F;">Standard — check end</h3>
            <md-button id="sel-mixed-std-end-anchor" variant="filled" aria-haspopup="menu" onclick="document.getElementById('sel-mixed-std-end-menu').show()">
              Open Mixed Menu
            </md-button>
            <md-menu id="sel-mixed-std-end-menu" anchor="sel-mixed-std-end-anchor" variant="standard">
              <md-menu-item headline="${t(globals.locale, 'menu.sortByName')}" type="radio" keep-open selected>
                <span slot="leading-icon" class="material-symbols-outlined">sort_by_alpha</span>
              </md-menu-item>
              <md-menu-item headline="${t(globals.locale, 'menu.sortByDate')}" type="radio" keep-open divider>
                <span slot="leading-icon" class="material-symbols-outlined">calendar_today</span>
              </md-menu-item>
              <md-menu-item headline="${t(globals.locale, 'menu.showHidden')}" type="checkbox" keep-open>
                <span slot="leading-icon" class="material-symbols-outlined">visibility_off</span>
              </md-menu-item>
              <md-menu-item headline="${t(globals.locale, 'menu.showPreview')}" type="checkbox" keep-open selected>
                <span slot="leading-icon" class="material-symbols-outlined">preview</span>
              </md-menu-item>
            </md-menu>
          </div>
          <div style="display: flex; flex-direction: column; gap: 8px; width: 280px;">
            <h3 style="margin: 0; font-size: 13px; color: #49454F;">Vibrant — check start</h3>
            <md-button id="sel-mixed-vib-start-anchor" variant="filled" aria-haspopup="menu" onclick="document.getElementById('sel-mixed-vib-start-menu').show()">
              Open Mixed Menu
            </md-button>
            <md-menu id="sel-mixed-vib-start-menu" anchor="sel-mixed-vib-start-anchor" variant="vibrant">
              <md-menu-item headline="${t(globals.locale, 'menu.ascending')}" type="radio" check-position="start" keep-open selected></md-menu-item>
              <md-menu-item headline="${t(globals.locale, 'menu.descending')}" type="radio" check-position="start" keep-open divider></md-menu-item>
              <md-menu-item headline="${t(globals.locale, 'menu.groupByType')}" type="checkbox" check-position="start" keep-open selected></md-menu-item>
              <md-menu-item headline="${t(globals.locale, 'menu.showSize')}" type="checkbox" check-position="start" keep-open></md-menu-item>
            </md-menu>
          </div>
          <div style="display: flex; flex-direction: column; gap: 8px; width: 280px;">
            <h3 style="margin: 0; font-size: 13px; color: #49454F;">Baseline — check start, no icons</h3>
            <md-button id="sel-mixed-bl-start-anchor" variant="filled" aria-haspopup="menu" onclick="document.getElementById('sel-mixed-bl-start-menu').show()">
              Open Mixed Menu
            </md-button>
            <md-menu id="sel-mixed-bl-start-menu" anchor="sel-mixed-bl-start-anchor" variant="baseline">
              <md-menu-item headline="${t(globals.locale, 'menu.newestFirst')}" type="radio" check-position="start" keep-open selected></md-menu-item>
              <md-menu-item headline="${t(globals.locale, 'menu.oldestFirst')}" type="radio" check-position="start" keep-open divider></md-menu-item>
              <md-menu-item headline="${t(globals.locale, 'menu.unreadOnly')}" type="checkbox" check-position="start" keep-open></md-menu-item>
              <md-menu-item headline="${t(globals.locale, 'menu.starredOnly')}" type="checkbox" check-position="start" keep-open selected></md-menu-item>
            </md-menu>
          </div>
        </div>
      </div>

    </div>
  `,
  /** Radio selection + keyboard model, scripted on the Standard radio menu. */
  play: async ({ canvasElement, step, globals }) => {
    const menu = await getMenu(canvasElement, 'sel-radio-end-std-menu');
    const trigger = canvasElement.querySelector('#sel-radio-end-std-anchor') as HTMLElement;
    const checked = () => menu.querySelectorAll('md-menu-item[aria-checked="true"]');

    await step('Opens; the seeded radio reflects its selected state via aria', async () => {
      trigger.click();
      await waitFor(() => expect(menu.open).toBe(true));
      // Exactly the preseeded option is checked, and it is a menuitemradio.
      await waitFor(() => expect(checked().length).toBe(1));
      const seeded = itemByKey(menu, globals.locale, 'menu.sortByName');
      expect(seeded.getAttribute('role')).toBe('menuitemradio');
      expect(seeded.getAttribute('aria-checked')).toBe('true');
    });

    await step('ArrowDown roves focus off the auto-focused first item', async () => {
      await waitFor(() => expect(focusedItem().tagName.toLowerCase()).toBe('md-menu-item'));
      const before = focusedItem().getAttribute('headline'); // 'Sort by name' (item 0)
      key(focusedItem(), 'ArrowDown');
      await waitFor(() => expect(focusedItem().getAttribute('headline')).not.toBe(before)); // moved
      expect(focusedItem().getAttribute('headline')).toBe('Sort by date'); // to item 1
    });

    await step('Enter selects the focused radio; the checkmark swaps (single-select)', async () => {
      const target = focusedItem(); // 'Sort by date', currently unchecked
      expect(target.getAttribute('aria-checked')).toBe('false');
      let fired = false;
      target.addEventListener('mdClick', () => (fired = true), { once: true });
      key(target, 'Enter');
      expect(fired).toBe(true); // Enter activated the item
      // aria-checked lands on the next render flush — assert it inside waitFor.
      await waitFor(() => expect(target.getAttribute('aria-checked')).toBe('true'));
      // Radio group: the new pick is the ONLY checked item, and the seed cleared.
      await waitFor(() => expect(checked().length).toBe(1));
      expect(itemByKey(menu, globals.locale, 'menu.sortByName').getAttribute('aria-checked')).toBe('false');
      key(target, 'Escape');
      await waitFor(() => expect(menu.open).toBe(false));
      await new Promise((r) => setTimeout(r, 300));
    });

    await step('Reopen and probe the scroll viewport, reposition, and scroll handler', async () => {
      trigger.click();
      await waitFor(() => expect(menu.open).toBe(true));
      // getScrollViewport() reaches through the surface into the scroll viewport
      // and returns the real scrollable element (a capped menu always has one).
      let vp: unknown = null;
      await waitFor(async () => {
        vp = await (menu as unknown as { getScrollViewport: () => Promise<HTMLElement | null> }).getScrollViewport();
        expect(vp).not.toBe(null);
      });
      expect(vp instanceof HTMLElement).toBe(true);
      // reposition() re-runs positionMenu, which writes an absolute top offset.
      await (menu as unknown as { reposition: () => Promise<void> }).reposition();
      await waitFor(() => expect(menu.style.top).not.toBe(''));
      // The scroll/resize handlers reposition the open menu without dismissing it.
      window.dispatchEvent(new Event('scroll'));
      window.dispatchEvent(new Event('resize'));
      await waitFor(() => expect(menu.open).toBe(true));
    });

    await step('Home, ArrowUp (wrap), and End move the roving focus across the list', async () => {
      await waitFor(() => expect(focusedItem().tagName.toLowerCase()).toBe('md-menu-item'));
      // Home jumps to the first item…
      key(focusedItem(), 'Home');
      await waitFor(() => expect(focusedItem().getAttribute('headline')).toBe('Sort by name'));
      // …ArrowUp from the first item wraps around to the last…
      key(focusedItem(), 'ArrowUp');
      await waitFor(() => expect(focusedItem().getAttribute('headline')).toBe('Sort by size'));
      // …and End pins to the last item.
      key(focusedItem(), 'End');
      await waitFor(() => expect(focusedItem().getAttribute('headline')).toBe('Sort by size'));
    });

    await step('Tab closes the whole menu tree and restores focus to the anchor', async () => {
      // Tab tears the tree down (closeEntireMenuTree) and returns focus to the
      // trigger rather than dropping it to <body>.
      key(focusedItem(), 'Tab');
      await waitFor(() => expect(menu.open).toBe(false));
      await waitFor(() => expect(document.activeElement).toBe(trigger));
      await new Promise((r) => setTimeout(r, 300));
    });
  },
};

/* ═══════════════════════════════════════════════════════════
   7. SUBMENUS
   ═══════════════════════════════════════════════════════════ */
export const Submenus: Story = {
  render: (_args, { globals }) => html`
    <div style="display: flex; gap: 48px; padding: 32px; flex-wrap: wrap; font-family: sans-serif;">
      <div style="display: flex; flex-direction: column; gap: 12px; width: 260px;">
        <h3 style="margin: 0; font-size: 14px; color: #666;">Baseline with submenu</h3>
        <md-button id="submenu-bl-anchor" variant="filled" aria-haspopup="menu" onclick="document.getElementById('submenu-bl-menu').show()">
          Open Submenu
        </md-button>
        <md-menu id="submenu-bl-menu" anchor="submenu-bl-anchor" variant="baseline">
          <md-menu-item headline="${t(globals.locale, 'menu.newFile')}" trailing-text="⌘N">
            <span slot="leading-icon" class="material-symbols-outlined">note_add</span>
          </md-menu-item>
          <md-sub-menu-item headline="${t(globals.locale, 'menu.openRecent')}">
            <span slot="leading-icon" class="material-symbols-outlined">history</span>
            <md-menu slot="submenu" variant="baseline">
              <md-menu-item headline="document.txt"></md-menu-item>
              <md-menu-item headline="image.png"></md-menu-item>
              <md-menu-item headline="styles.css"></md-menu-item>
            </md-menu>
          </md-sub-menu-item>
          <md-menu-item headline="${t(globals.locale, 'save')}" trailing-text="⌘S" divider>
            <span slot="leading-icon" class="material-symbols-outlined">save</span>
          </md-menu-item>
          <md-menu-item headline="${t(globals.locale, 'menu.close')}">
            <span slot="leading-icon" class="material-symbols-outlined">close</span>
          </md-menu-item>
        </md-menu>
      </div>

      <div style="display: flex; flex-direction: column; gap: 12px; width: 260px;">
        <h3 style="margin: 0; font-size: 14px; color: #666;">Standard with submenu</h3>
        <md-button id="submenu-std-anchor" variant="filled" aria-haspopup="menu" onclick="document.getElementById('submenu-std-menu').show()">
          Open Submenu
        </md-button>
        <md-menu id="submenu-std-menu" anchor="submenu-std-anchor" variant="standard">
          <md-menu-item headline="${t(globals.locale, 'edit')}">
            <span slot="leading-icon" class="material-symbols-outlined">edit</span>
          </md-menu-item>
          <md-sub-menu-item headline="${t(globals.locale, 'menu.shareWith')}" divider>
            <span slot="leading-icon" class="material-symbols-outlined">share</span>
            <md-menu slot="submenu" variant="standard">
              <md-menu-item headline="${t(globals.locale, 'menu.email')}">
                <span slot="leading-icon" class="material-symbols-outlined">email</span>
              </md-menu-item>
              <md-menu-item headline="${t(globals.locale, 'menu.messages')}">
                <span slot="leading-icon" class="material-symbols-outlined">chat</span>
              </md-menu-item>
              <md-menu-item headline="AirDrop">
                <span slot="leading-icon" class="material-symbols-outlined">wifi</span>
              </md-menu-item>
            </md-menu>
          </md-sub-menu-item>
          <md-menu-item headline="${t(globals.locale, 'delete')}">
            <span slot="leading-icon" class="material-symbols-outlined">delete</span>
          </md-menu-item>
        </md-menu>
      </div>
    </div>
  `,
  /** Submenu drill-down, scripted on the Baseline "Open recent" branch:
   *  keyboard-open the nested flyout, then select a leaf to collapse the tree. */
  play: async ({ canvasElement, step }) => {
    const menu = await getMenu(canvasElement, 'submenu-bl-menu');
    const trigger = canvasElement.querySelector('#submenu-bl-anchor') as HTMLElement;
    const parentItem = menu.querySelector('md-sub-menu-item') as HTMLElement;
    const submenu = parentItem.querySelector('md-menu') as MenuEl;
    const leavesOf = () => [...submenu.querySelectorAll('md-menu-item')] as HTMLElement[];

    await step('Trigger opens the root menu; the submenu-parent is a collapsed haspopup', async () => {
      expect(menu.open).toBe(false);
      await waitFor(() => expect(trigger.classList.contains('hydrated')).toBe(true));
      trigger.click();
      // Root menu: closed → open, surfaced to AT.
      await waitFor(() => expect(menu.open).toBe(true));
      await waitFor(() => expect(menu.getAttribute('aria-hidden')).toBe('false'));
      // The submenu-parent advertises a nested menu but starts collapsed, and its
      // nested surface is still hidden from AT.
      await waitFor(() => expect(parentItem.getAttribute('aria-haspopup')).toBe('menu'));
      await waitFor(() => expect(parentItem.getAttribute('aria-expanded')).toBe('false'));
      expect(submenu.open).toBe(false);
      await waitFor(() => expect(submenu.getAttribute('aria-hidden')).toBe('true'));
    });

    await step('ArrowRight on the parent opens the nested submenu — child items surface', async () => {
      await waitFor(() => expect(parentItem.classList.contains('hydrated')).toBe(true));
      key(parentItem, 'ArrowRight');
      // The activation drives collapsed → expanded and opens the nested menu.
      await waitFor(() => expect(parentItem.getAttribute('aria-expanded')).toBe('true'));
      await waitFor(() => expect(submenu.open).toBe(true));
      await waitFor(() => expect(submenu.getAttribute('aria-hidden')).toBe('false'));
      // The three leaves are now the nested menu's own menuitems.
      await waitFor(() =>
        expect(leavesOf().map((l) => l.getAttribute('headline'))).toEqual([
          'document.txt', 'image.png', 'styles.css',
        ]),
      );
      expect(leavesOf().every((l) => l.getAttribute('role') === 'menuitem')).toBe(true);
    });

    await step('Selecting a leaf emits mdClick and closes the entire menu tree', async () => {
      const leaf = leavesOf().find((l) => l.getAttribute('headline') === 'styles.css')!;
      await waitFor(() => expect(leaf.classList.contains('hydrated')).toBe(true));
      let fired = false;
      leaf.addEventListener('mdClick', () => (fired = true), { once: true });
      leaf.click();
      // mdClick fires synchronously during activation — proves the component fired.
      expect(fired).toBe(true);
      // A default leaf dismisses the ROOT menu, which cascades the submenu closed.
      await waitFor(() => expect(menu.open).toBe(false));
      await waitFor(() => expect(submenu.open).toBe(false));
      await new Promise((r) => setTimeout(r, 300));
    });

    await step('Reopen, drill in, then Tab out — the whole tree closes from the leaf', async () => {
      trigger.click();
      await waitFor(() => expect(menu.open).toBe(true));
      await waitFor(() => expect(parentItem.classList.contains('hydrated')).toBe(true));
      key(parentItem, 'ArrowRight');
      await waitFor(() => expect(submenu.open).toBe(true));
      const firstLeaf = leavesOf()[0];
      await waitFor(() => expect(firstLeaf.classList.contains('hydrated')).toBe(true));
      // Tab from a leaf walks UP the parent chain to the root menu, closes it, and
      // returns focus to the root anchor (closeEntireMenuTree's ancestor branch).
      key(firstLeaf, 'Tab');
      await waitFor(() => expect(menu.open).toBe(false));
      await waitFor(() => expect(submenu.open).toBe(false));
      await waitFor(() => expect(document.activeElement).toBe(trigger));
      await new Promise((r) => setTimeout(r, 300));
    });
  },
};

/* ═══════════════════════════════════════════════════════════
   7b. NO LEADING ICON
   Items without a leading-icon slot render no extra DOM element,
   so the headline sits flush to the left padding.
   ═══════════════════════════════════════════════════════════ */
export const NoLeadingIcon: Story = {
  render: (_args, { globals }) => html`
    <div style="display: flex; gap: 48px; padding: 32px; flex-wrap: wrap; font-family: sans-serif;">
      <div style="display: flex; flex-direction: column; gap: 12px; width: 260px;">
        <h3 style="margin: 0; font-size: 14px; color: #666;">Baseline — no icons</h3>
        <md-button id="no-icon-bl-anchor" variant="filled" aria-haspopup="menu" onclick="document.getElementById('no-icon-bl-menu').show()">
          Open No Icon Menu
        </md-button>
        <md-menu id="no-icon-bl-menu" anchor="no-icon-bl-anchor" variant="baseline">
          <md-menu-item headline="${t(globals.locale, 'menu.cut')}" trailing-text="⌘X"></md-menu-item>
          <md-menu-item headline="${t(globals.locale, 'menu.copy')}" trailing-text="⌘C"></md-menu-item>
          <md-menu-item headline="${t(globals.locale, 'menu.paste')}" trailing-text="⌘V"></md-menu-item>
        </md-menu>
      </div>

      <div style="display: flex; flex-direction: column; gap: 12px; width: 260px;">
        <h3 style="margin: 0; font-size: 14px; color: #666;">Standard — no icons</h3>
        <md-button id="no-icon-std-anchor" variant="filled" aria-haspopup="menu" onclick="document.getElementById('no-icon-std-menu').show()">
          Open No Icon Menu
        </md-button>
        <md-menu id="no-icon-std-menu" anchor="no-icon-std-anchor" variant="standard">
          <md-menu-item headline="${t(globals.locale, 'menu.undo')}" trailing-text="⌘Z"></md-menu-item>
          <md-menu-item headline="${t(globals.locale, 'menu.redo')}" trailing-text="⌘⇧Z" divider></md-menu-item>
          <md-menu-item headline="${t(globals.locale, 'menu.selectAll')}" trailing-text="⌘A"></md-menu-item>
        </md-menu>
      </div>

      <div style="display: flex; flex-direction: column; gap: 12px; width: 260px;">
        <h3 style="margin: 0; font-size: 14px; color: #666;">Vibrant — no icons</h3>
        <md-button id="no-icon-vib-anchor" variant="filled" aria-haspopup="menu" onclick="document.getElementById('no-icon-vib-menu').show()">
          Open No Icon Menu
        </md-button>
        <md-menu id="no-icon-vib-menu" anchor="no-icon-vib-anchor" variant="vibrant">
          <md-menu-item headline="${t(globals.locale, 'menu.reply')}"></md-menu-item>
          <md-menu-item headline="${t(globals.locale, 'menu.forward')}"></md-menu-item>
          <md-menu-item headline="${t(globals.locale, 'menu.archive')}"></md-menu-item>
        </md-menu>
      </div>

      <div style="display: flex; flex-direction: column; gap: 12px; width: 260px;">
        <h3 style="margin: 0; font-size: 14px; color: #666;">Mixed — some with, some without</h3>
        <md-button id="no-icon-mixed-anchor" variant="filled" aria-haspopup="menu" onclick="document.getElementById('no-icon-mixed-menu').show()">
          Open Mixed Icon Menu
        </md-button>
        <md-menu id="no-icon-mixed-menu" anchor="no-icon-mixed-anchor" variant="standard">
          <md-menu-item headline="${t(globals.locale, 'edit')}">
            <span slot="leading-icon" class="material-symbols-outlined">edit</span>
          </md-menu-item>
          <md-menu-item headline="${t(globals.locale, 'menu.duplicate')}"></md-menu-item>
          <md-menu-item headline="${t(globals.locale, 'menu.share')}">
            <span slot="leading-icon" class="material-symbols-outlined">share</span>
          </md-menu-item>
          <md-menu-item headline="${t(globals.locale, 'delete')}"></md-menu-item>
        </md-menu>
      </div>

      <div style="display: flex; flex-direction: column; gap: 12px; width: 260px;">
        <h3 style="margin: 0; font-size: 14px; color: #666;">Submenu — no icons in children</h3>
        <md-button id="no-icon-submenu-anchor" variant="filled" aria-haspopup="menu" onclick="document.getElementById('no-icon-submenu-menu').show()">
          Open Submenu
        </md-button>
        <md-menu id="no-icon-submenu-menu" anchor="no-icon-submenu-anchor" variant="standard">
          <md-menu-item headline="${t(globals.locale, 'menu.newFile')}">
            <span slot="leading-icon" class="material-symbols-outlined">note_add</span>
          </md-menu-item>
          <md-sub-menu-item headline="${t(globals.locale, 'menu.export')}">
            <span slot="leading-icon" class="material-symbols-outlined">download</span>
            <md-menu slot="submenu" variant="standard">
              <md-menu-item headline="PDF"></md-menu-item>
              <md-menu-item headline="PNG"></md-menu-item>
              <md-menu-item headline="SVG"></md-menu-item>
            </md-menu>
          </md-sub-menu-item>
          <md-sub-menu-item headline="${t(globals.locale, 'menu.moreOptions')}">
            <md-menu slot="submenu" variant="standard">
              <md-menu-item headline="${t(globals.locale, 'menu.upload')}"></md-menu-item>
              <md-menu-item headline="${t(globals.locale, 'menu.download')}"></md-menu-item>
            </md-menu>
          </md-sub-menu-item>
        </md-menu>
      </div>
    </div>
  `,
};

/* ═══════════════════════════════════════════════════════════
   8. PLAYGROUND — BUTTON TRIGGER
   ═══════════════════════════════════════════════════════════ */
export const PlaygroundButton: Story = {
  render: (_args, { globals }) => html`
    <div style="display: flex; gap: 48px; padding: 32px; flex-wrap: wrap; font-family: sans-serif;">
      <div style="display: flex; flex-direction: column; gap: 12px;">
        <h3 style="margin: 0; font-size: 14px; color: #666;">Filled button — Baseline menu</h3>
        <md-button id="btn-bl-anchor" variant="filled" onclick="document.getElementById('btn-bl-menu').show()">
          ${t(globals.locale, 'menu.actions')}
        </md-button>
        <md-menu id="btn-bl-menu" anchor="btn-bl-anchor" variant="baseline">
          <md-menu-item headline="${t(globals.locale, 'edit')}">
            <span slot="leading-icon" class="material-symbols-outlined">edit</span>
          </md-menu-item>
          <md-menu-item headline="${t(globals.locale, 'menu.duplicate')}">
            <span slot="leading-icon" class="material-symbols-outlined">content_copy</span>
          </md-menu-item>
          <md-menu-item headline="${t(globals.locale, 'delete')}" divider>
            <span slot="leading-icon" class="material-symbols-outlined">delete</span>
          </md-menu-item>
          <md-menu-item headline="${t(globals.locale, 'menu.moveTo')}">
            <span slot="leading-icon" class="material-symbols-outlined">drive_file_move</span>
          </md-menu-item>
        </md-menu>
      </div>

      <div style="display: flex; flex-direction: column; gap: 12px;">
        <h3 style="margin: 0; font-size: 14px; color: #666;">Outlined button — Standard menu</h3>
        <md-button id="btn-st-anchor" variant="outlined" onclick="document.getElementById('btn-st-menu').show()">
          ${t(globals.locale, 'menu.file')}
        </md-button>
        <md-menu id="btn-st-menu" anchor="btn-st-anchor" variant="standard">
          <md-menu-item headline="${t(globals.locale, 'menu.new')}" trailing-text="⌘N">
            <span slot="leading-icon" class="material-symbols-outlined">note_add</span>
          </md-menu-item>
          <md-menu-item headline="${t(globals.locale, 'menu.open')}" trailing-text="⌘O">
            <span slot="leading-icon" class="material-symbols-outlined">folder_open</span>
          </md-menu-item>
          <md-menu-item headline="${t(globals.locale, 'save')}" trailing-text="⌘S" divider>
            <span slot="leading-icon" class="material-symbols-outlined">save</span>
          </md-menu-item>
          <md-menu-item headline="${t(globals.locale, 'menu.export')}">
            <span slot="leading-icon" class="material-symbols-outlined">download</span>
          </md-menu-item>
        </md-menu>
      </div>

      <div style="display: flex; flex-direction: column; gap: 12px;">
        <h3 style="margin: 0; font-size: 14px; color: #666;">Tonal button — Vibrant menu</h3>
        <md-button id="btn-vib-anchor" variant="tonal" onclick="document.getElementById('btn-vib-menu').show()">
          ${t(globals.locale, 'menu.theme')}
        </md-button>
        <md-menu id="btn-vib-menu" anchor="btn-vib-anchor" variant="vibrant">
          <md-menu-item headline="${t(globals.locale, 'menu.light')}" type="radio" keep-open selected>
            <span slot="leading-icon" class="material-symbols-outlined">light_mode</span>
          </md-menu-item>
          <md-menu-item headline="${t(globals.locale, 'menu.dark')}" type="radio" keep-open>
            <span slot="leading-icon" class="material-symbols-outlined">dark_mode</span>
          </md-menu-item>
          <md-menu-item headline="${t(globals.locale, 'menu.system')}" type="radio" keep-open>
            <span slot="leading-icon" class="material-symbols-outlined">brightness_auto</span>
          </md-menu-item>
        </md-menu>
      </div>
    </div>
  `,
};

/* ═══════════════════════════════════════════════════════════
   8b. PLAYGROUND — ICON BUTTON TRIGGER
   ═══════════════════════════════════════════════════════════ */
export const PlaygroundIconButton: Story = {
  render: (_args, { globals }) => html`
    <div style="display: flex; gap: 48px; padding: 32px; flex-wrap: wrap; font-family: sans-serif;">
      <div style="display: flex; flex-direction: column; gap: 12px;">
        <h3 style="margin: 0; font-size: 14px; color: #666;">Standard icon button — Baseline menu</h3>
        <md-icon-button id="ib-bl-anchor" onclick="document.getElementById('ib-bl-menu').show()">
          <span class="material-symbols-outlined">more_vert</span>
        </md-icon-button>
        <md-menu id="ib-bl-menu" anchor="ib-bl-anchor" variant="baseline">
          <md-menu-item headline="${t(globals.locale, 'menu.refresh')}">
            <span slot="leading-icon" class="material-symbols-outlined">refresh</span>
          </md-menu-item>
          <md-menu-item headline="${t(globals.locale, 'settings')}">
            <span slot="leading-icon" class="material-symbols-outlined">settings</span>
          </md-menu-item>
          <md-menu-item headline="${t(globals.locale, 'menu.help')}">
            <span slot="leading-icon" class="material-symbols-outlined">help</span>
          </md-menu-item>
        </md-menu>
      </div>

      <div style="display: flex; flex-direction: column; gap: 12px;">
        <h3 style="margin: 0; font-size: 14px; color: #666;">Filled icon button — Standard menu</h3>
        <md-icon-button id="ib-st-anchor" variant="filled" onclick="document.getElementById('ib-st-menu').show()">
          <span class="material-symbols-outlined">add</span>
        </md-icon-button>
        <md-menu id="ib-st-menu" anchor="ib-st-anchor" variant="standard">
          <md-menu-item headline="${t(globals.locale, 'menu.newFile')}">
            <span slot="leading-icon" class="material-symbols-outlined">note_add</span>
          </md-menu-item>
          <md-menu-item headline="${t(globals.locale, 'menu.newFolder')}">
            <span slot="leading-icon" class="material-symbols-outlined">create_new_folder</span>
          </md-menu-item>
          <md-menu-item headline="${t(globals.locale, 'menu.uploadFile')}">
            <span slot="leading-icon" class="material-symbols-outlined">upload_file</span>
          </md-menu-item>
        </md-menu>
      </div>

      <div style="display: flex; flex-direction: column; gap: 12px;">
        <h3 style="margin: 0; font-size: 14px; color: #666;">Tonal icon button — Vibrant menu</h3>
        <md-icon-button id="ib-vib-anchor" variant="tonal" onclick="document.getElementById('ib-vib-menu').show()">
          <span class="material-symbols-outlined">palette</span>
        </md-icon-button>
        <md-menu id="ib-vib-menu" anchor="ib-vib-anchor" variant="vibrant" placement="bottom-end">
          <md-menu-item headline="${t(globals.locale, 'menu.red')}" type="radio" keep-open>
            <span slot="leading-icon" class="material-symbols-outlined">circle</span>
          </md-menu-item>
          <md-menu-item headline="${t(globals.locale, 'menu.blue')}" type="radio" keep-open selected>
            <span slot="leading-icon" class="material-symbols-outlined">circle</span>
          </md-menu-item>
          <md-menu-item headline="${t(globals.locale, 'menu.green')}" type="radio" keep-open>
            <span slot="leading-icon" class="material-symbols-outlined">circle</span>
          </md-menu-item>
        </md-menu>
      </div>
    </div>
  `,
};

/* ═══════════════════════════════════════════════════════════
   8c. ALL STATES
   ═══════════════════════════════════════════════════════════ */
export const States: Story = {
  render: (_args, { globals }) => html`
    <div style="display: flex; gap: 48px; padding: 32px; flex-wrap: wrap; font-family: sans-serif;">
      <div style="display: flex; flex-direction: column; gap: 12px; width: 260px;">
        <h3 style="margin: 0; font-size: 14px; color: #666;">Baseline states</h3>
        <md-button id="states-bl-anchor" variant="filled" aria-haspopup="menu" onclick="document.getElementById('states-bl-menu').show()">
          Open States Menu
        </md-button>
        <md-menu id="states-bl-menu" anchor="states-bl-anchor" variant="baseline">
          <md-menu-item headline="${t(globals.locale, 'menu.enabled')}">
            <span slot="leading-icon" class="material-symbols-outlined">check_circle</span>
          </md-menu-item>
          <md-menu-item headline="${t(globals.locale, 'menu.selected')}" selected>
            <span slot="leading-icon" class="material-symbols-outlined">star</span>
          </md-menu-item>
          <md-menu-item headline="${t(globals.locale, 'menu.disabled')}" disabled>
            <span slot="leading-icon" class="material-symbols-outlined">block</span>
          </md-menu-item>
          <md-menu-item headline="${t(globals.locale, 'menu.withDivider')}" divider>
            <span slot="leading-icon" class="material-symbols-outlined">horizontal_rule</span>
          </md-menu-item>
          <md-menu-item headline="${t(globals.locale, 'menu.afterDivider')}">
            <span slot="leading-icon" class="material-symbols-outlined">more_horiz</span>
          </md-menu-item>
        </md-menu>
      </div>

      <div style="display: flex; flex-direction: column; gap: 12px; width: 260px;">
        <h3 style="margin: 0; font-size: 14px; color: #666;">Standard states</h3>
        <md-button id="states-std-anchor" variant="filled" aria-haspopup="menu" onclick="document.getElementById('states-std-menu').show()">
          Open States Menu
        </md-button>
        <md-menu id="states-std-menu" anchor="states-std-anchor" variant="standard">
          <md-menu-item headline="${t(globals.locale, 'menu.enabled')}">
            <span slot="leading-icon" class="material-symbols-outlined">check_circle</span>
          </md-menu-item>
          <md-menu-item headline="${t(globals.locale, 'menu.selected')}" selected>
            <span slot="leading-icon" class="material-symbols-outlined">star</span>
          </md-menu-item>
          <md-menu-item headline="${t(globals.locale, 'menu.disabled')}" disabled>
            <span slot="leading-icon" class="material-symbols-outlined">block</span>
          </md-menu-item>
        </md-menu>
      </div>

      <div style="display: flex; flex-direction: column; gap: 12px; width: 260px;">
        <h3 style="margin: 0; font-size: 14px; color: #666;">Vibrant states</h3>
        <md-button id="states-vib-anchor" variant="filled" aria-haspopup="menu" onclick="document.getElementById('states-vib-menu').show()">
          Open States Menu
        </md-button>
        <md-menu id="states-vib-menu" anchor="states-vib-anchor" variant="vibrant">
          <md-menu-item headline="${t(globals.locale, 'menu.enabled')}">
            <span slot="leading-icon" class="material-symbols-outlined">check_circle</span>
          </md-menu-item>
          <md-menu-item headline="${t(globals.locale, 'menu.selected')}" selected>
            <span slot="leading-icon" class="material-symbols-outlined">star</span>
          </md-menu-item>
          <md-menu-item headline="${t(globals.locale, 'menu.disabled')}" disabled>
            <span slot="leading-icon" class="material-symbols-outlined">block</span>
          </md-menu-item>
        </md-menu>
      </div>
    </div>
  `,
};

/* ═══════════════════════════════════════════════════════════
   9. NESTED SUBMENUS — MULTI-LEVEL
   Sub-menu items can nest arbitrarily deep. Each level
   manages its own open/close, z-index, and auto-positioning.
   ═══════════════════════════════════════════════════════════ */
export const NestedSubmenus: Story = {
  render: (_args, { globals }) => html`
    <div style="display: flex; gap: 48px; padding: 32px; flex-wrap: wrap; font-family: sans-serif;">

      <div style="display: flex; flex-direction: column; gap: 12px;">
        <h3 style="margin: 0; font-size: 14px; color: #666;">Standard — 3 levels deep</h3>
        <md-button id="nested-std-anchor" variant="filled" onclick="document.getElementById('nested-std-menu').show()">
          ${t(globals.locale, 'menu.file')}
        </md-button>
        <md-menu id="nested-std-menu" anchor="nested-std-anchor" variant="standard">
          <md-menu-item headline="${t(globals.locale, 'menu.newFile')}" trailing-text="⌘N">
            <span slot="leading-icon" class="material-symbols-outlined">note_add</span>
          </md-menu-item>
          <md-sub-menu-item headline="${t(globals.locale, 'menu.openRecent')}" supporting-text="${t(globals.locale, 'menu.last5Files')}">
            <span slot="leading-icon" class="material-symbols-outlined">history</span>
            <md-menu slot="submenu" variant="standard">
              <md-menu-item headline="document.txt" supporting-text="Modified yesterday"></md-menu-item>
              <md-menu-item headline="styles.css" supporting-text="Modified 3 days ago"></md-menu-item>
              <md-sub-menu-item headline="${t(globals.locale, 'menu.projects')}" supporting-text="${t(globals.locale, 'menu.browseAll')}">
                <span slot="leading-icon" class="material-symbols-outlined">folder</span>
                <md-menu slot="submenu" variant="standard">
                  <md-menu-item headline="my-app" supporting-text="React project"></md-menu-item>
                  <md-menu-item headline="website" supporting-text="Static site"></md-menu-item>
                  <md-menu-item headline="design-system" supporting-text="Stencil components"></md-menu-item>
                </md-menu>
              </md-sub-menu-item>
            </md-menu>
          </md-sub-menu-item>
          <md-sub-menu-item headline="${t(globals.locale, 'menu.exportAs')}" supporting-text="${t(globals.locale, 'menu.saveToDisk')}" divider>
            <span slot="leading-icon" class="material-symbols-outlined">download</span>
            <md-menu slot="submenu" variant="standard">
              <md-sub-menu-item headline="${t(globals.locale, 'menu.image')}" supporting-text="${t(globals.locale, 'menu.rasterVector')}">
                <span slot="leading-icon" class="material-symbols-outlined">image</span>
                <md-menu slot="submenu" variant="standard">
                  <md-menu-item headline="PNG"></md-menu-item>
                  <md-menu-item headline="JPEG"></md-menu-item>
                  <md-menu-item headline="SVG"></md-menu-item>
                  <md-menu-item headline="WebP"></md-menu-item>
                </md-menu>
              </md-sub-menu-item>
              <md-menu-item headline="PDF">
                <span slot="leading-icon" class="material-symbols-outlined">picture_as_pdf</span>
              </md-menu-item>
              <md-menu-item headline="CSV">
                <span slot="leading-icon" class="material-symbols-outlined">table_chart</span>
              </md-menu-item>
            </md-menu>
          </md-sub-menu-item>
          <md-menu-item headline="${t(globals.locale, 'save')}" trailing-text="⌘S">
            <span slot="leading-icon" class="material-symbols-outlined">save</span>
          </md-menu-item>
        </md-menu>
      </div>

      <div style="display: flex; flex-direction: column; gap: 12px;">
        <h3 style="margin: 0; font-size: 14px; color: #666;">Vibrant — 3 levels deep</h3>
        <md-button id="nested-vib-anchor" variant="tonal" onclick="document.getElementById('nested-vib-menu').show()">
          ${t(globals.locale, 'menu.share')}
        </md-button>
        <md-menu id="nested-vib-menu" anchor="nested-vib-anchor" variant="vibrant">
          <md-menu-item headline="${t(globals.locale, 'menu.copyLink')}" supporting-text="${t(globals.locale, 'menu.toClipboard')}">
            <span slot="leading-icon" class="material-symbols-outlined">link</span>
          </md-menu-item>
          <md-sub-menu-item headline="${t(globals.locale, 'menu.social')}" supporting-text="${t(globals.locale, 'menu.postToNetwork')}">
            <span slot="leading-icon" class="material-symbols-outlined">public</span>
            <md-menu slot="submenu" variant="vibrant">
              <md-menu-item headline="Twitter" supporting-text="Post a tweet">
                <span slot="leading-icon" class="material-symbols-outlined">tag</span>
              </md-menu-item>
              <md-menu-item headline="LinkedIn" supporting-text="${t(globals.locale, 'menu.shareWithNetwork')}">
                <span slot="leading-icon" class="material-symbols-outlined">work</span>
              </md-menu-item>
              <md-sub-menu-item headline="${t(globals.locale, 'menu.more')}" supporting-text="${t(globals.locale, 'menu.otherPlatforms')}">
                <span slot="leading-icon" class="material-symbols-outlined">more_horiz</span>
                <md-menu slot="submenu" variant="vibrant">
                  <md-menu-item headline="Facebook"></md-menu-item>
                  <md-menu-item headline="Reddit"></md-menu-item>
                  <md-menu-item headline="Mastodon"></md-menu-item>
                </md-menu>
              </md-sub-menu-item>
            </md-menu>
          </md-sub-menu-item>
          <md-sub-menu-item headline="${t(globals.locale, 'menu.sendTo')}" supporting-text="${t(globals.locale, 'menu.directMessage')}" divider>
            <span slot="leading-icon" class="material-symbols-outlined">send</span>
            <md-menu slot="submenu" variant="vibrant">
              <md-menu-item headline="${t(globals.locale, 'menu.email')}" supporting-text="${t(globals.locale, 'menu.composeMessage')}">
                <span slot="leading-icon" class="material-symbols-outlined">email</span>
              </md-menu-item>
              <md-menu-item headline="${t(globals.locale, 'menu.messages')}" supporting-text="Via iMessage">
                <span slot="leading-icon" class="material-symbols-outlined">chat</span>
              </md-menu-item>
              <md-menu-item headline="AirDrop" supporting-text="${t(globals.locale, 'menu.nearbyDevices')}">
                <span slot="leading-icon" class="material-symbols-outlined">wifi</span>
              </md-menu-item>
            </md-menu>
          </md-sub-menu-item>
          <md-menu-item headline="${t(globals.locale, 'menu.embed')}" supporting-text="${t(globals.locale, 'menu.getEmbedCode')}">
            <span slot="leading-icon" class="material-symbols-outlined">code</span>
          </md-menu-item>
        </md-menu>
      </div>

    </div>
  `,
};

/* ═══════════════════════════════════════════════════════════
   10. BADGES
   Menu items and sub-menu items can display a small pill-shaped
   badge (e.g. "New", "3") via the `badge` prop.
   ═══════════════════════════════════════════════════════════ */
export const Badges: Story = {
  render: (_args, { globals }) => html`
    <div style="display: flex; gap: 48px; padding: 32px; flex-wrap: wrap; font-family: sans-serif;">

      <div style="display: flex; flex-direction: column; gap: 12px; width: 280px;">
        <h3 style="margin: 0; font-size: 14px; color: #666;">Baseline — with badges</h3>
        <md-button id="badges-bl-anchor" variant="filled" aria-haspopup="menu" onclick="document.getElementById('badges-bl-menu').show()">
          Open Badges Menu
        </md-button>
        <md-menu id="badges-bl-menu" anchor="badges-bl-anchor" variant="baseline">
          <md-menu-item headline="${t(globals.locale, 'menu.notifications')}" badge="3">
            <span slot="leading-icon" class="material-symbols-outlined">notifications</span>
          </md-menu-item>
          <md-menu-item headline="${t(globals.locale, 'menu.messages')}" badge="${t(globals.locale, 'menu.badgeNew')}">
            <span slot="leading-icon" class="material-symbols-outlined">chat</span>
          </md-menu-item>
          <md-menu-item headline="${t(globals.locale, 'settings')}">
            <span slot="leading-icon" class="material-symbols-outlined">settings</span>
          </md-menu-item>
          <md-sub-menu-item headline="${t(globals.locale, 'menu.moreOptions')}" badge="2">
            <span slot="leading-icon" class="material-symbols-outlined">more_horiz</span>
            <md-menu slot="submenu" variant="baseline">
              <md-menu-item headline="${t(globals.locale, 'menu.import')}" badge="${t(globals.locale, 'menu.badgeNew')}"></md-menu-item>
              <md-menu-item headline="${t(globals.locale, 'menu.export')}"></md-menu-item>
            </md-menu>
          </md-sub-menu-item>
        </md-menu>
      </div>

      <div style="display: flex; flex-direction: column; gap: 12px; width: 280px;">
        <h3 style="margin: 0; font-size: 14px; color: #666;">Standard — with badges</h3>
        <md-button id="badges-std-anchor" variant="filled" aria-haspopup="menu" onclick="document.getElementById('badges-std-menu').show()">
          Open Badges Menu
        </md-button>
        <md-menu id="badges-std-menu" anchor="badges-std-anchor" variant="standard">
          <md-menu-item headline="${t(globals.locale, 'menu.inbox')}" badge="12">
            <span slot="leading-icon" class="material-symbols-outlined">inbox</span>
          </md-menu-item>
          <md-menu-item headline="${t(globals.locale, 'menu.updates')}" badge="${t(globals.locale, 'menu.badgeNew')}">
            <span slot="leading-icon" class="material-symbols-outlined">update</span>
          </md-menu-item>
          <md-menu-item headline="${t(globals.locale, 'menu.archive')}">
            <span slot="leading-icon" class="material-symbols-outlined">archive</span>
          </md-menu-item>
          <md-sub-menu-item headline="${t(globals.locale, 'menu.labels')}" badge="5">
            <span slot="leading-icon" class="material-symbols-outlined">label</span>
            <md-menu slot="submenu" variant="standard">
              <md-menu-item headline="${t(globals.locale, 'menu.work')}" badge="3"></md-menu-item>
              <md-menu-item headline="${t(globals.locale, 'menu.personal')}" badge="2"></md-menu-item>
              <md-menu-item headline="${t(globals.locale, 'menu.travel')}"></md-menu-item>
            </md-menu>
          </md-sub-menu-item>
        </md-menu>
      </div>

      <div style="display: flex; flex-direction: column; gap: 12px; width: 280px;">
        <h3 style="margin: 0; font-size: 14px; color: #666;">Vibrant — with badges</h3>
        <md-button id="badges-vib-anchor" variant="filled" aria-haspopup="menu" onclick="document.getElementById('badges-vib-menu').show()">
          Open Badges Menu
        </md-button>
        <md-menu id="badges-vib-menu" anchor="badges-vib-anchor" variant="vibrant">
          <md-menu-item headline="${t(globals.locale, 'menu.dashboard')}" badge="${t(globals.locale, 'menu.badgeNew')}">
            <span slot="leading-icon" class="material-symbols-outlined">dashboard</span>
          </md-menu-item>
          <md-menu-item headline="${t(globals.locale, 'menu.analytics')}" badge="${t(globals.locale, 'menu.badgeBeta')}">
            <span slot="leading-icon" class="material-symbols-outlined">analytics</span>
          </md-menu-item>
          <md-menu-item headline="${t(globals.locale, 'menu.reports')}">
            <span slot="leading-icon" class="material-symbols-outlined">assessment</span>
          </md-menu-item>
        </md-menu>
      </div>

      <div style="display: flex; flex-direction: column; gap: 12px; width: 280px;">
        <h3 style="margin: 0; font-size: 14px; color: #666;">Badge with trailing text</h3>
        <md-button id="badges-trailing-anchor" variant="filled" aria-haspopup="menu" onclick="document.getElementById('badges-trailing-menu').show()">
          Open Badges Menu
        </md-button>
        <md-menu id="badges-trailing-menu" anchor="badges-trailing-anchor" variant="standard">
          <md-menu-item headline="${t(globals.locale, 'save')}" trailing-text="⌘S" badge="${t(globals.locale, 'menu.badgeNew')}">
            <span slot="leading-icon" class="material-symbols-outlined">save</span>
          </md-menu-item>
          <md-menu-item headline="${t(globals.locale, 'menu.export')}" trailing-text="⌘E">
            <span slot="leading-icon" class="material-symbols-outlined">download</span>
          </md-menu-item>
          <md-menu-item headline="${t(globals.locale, 'menu.print')}" trailing-text="⌘P" badge="${t(globals.locale, 'menu.badgeUpdated')}">
            <span slot="leading-icon" class="material-symbols-outlined">print</span>
          </md-menu-item>
        </md-menu>
      </div>

    </div>
  `,
};

/* ═══════════════════════════════════════════════════════════
   11. STATE MANAGEMENT — INTERNAL vs EXTERNAL
   Internal: the menu manages its own open state via show()/close().
   External: the consumer controls the `open` prop directly.
   ═══════════════════════════════════════════════════════════ */
export const StateManagement: Story = {
  render: (_args, { globals }) => {
    const setupExternal = () => {
      const menu = document.getElementById('ext-menu') as any;
      const openBtn = document.getElementById('ext-open-btn');
      const closeBtn = document.getElementById('ext-close-btn');
      const toggleBtn = document.getElementById('ext-toggle-btn');
      const indicator = document.getElementById('ext-indicator');
      if (!menu || menu.dataset.bound) return;
      menu.dataset.bound = '1';

      const updateIndicator = () => {
        if (indicator) {
          indicator.textContent = menu.open ? 'open' : 'closed';
          indicator.style.color = menu.open ? '#1b6e2c' : '#b3261e';
        }
      };

      openBtn?.addEventListener('click', () => { menu.open = true; });
      closeBtn?.addEventListener('click', () => { menu.open = false; });
      toggleBtn?.addEventListener('click', () => { menu.open = !menu.open; });
      menu.addEventListener('mdOpen', updateIndicator);
      menu.addEventListener('mdClose', updateIndicator);
      updateIndicator();
    };

    const setupControlled = () => {
      const menu = document.getElementById('ctrl-menu') as any;
      const tf = document.getElementById('ctrl-tf') as any;
      const indicator = document.getElementById('ctrl-indicator');
      if (!menu || menu.dataset.bound) return;
      menu.dataset.bound = '1';

      let isOpen = false;

      const setOpen = (val: boolean) => {
        isOpen = val;
        menu.open = val;
        if (indicator) {
          indicator.textContent = val ? 'open' : 'closed';
          indicator.style.color = val ? '#1b6e2c' : '#b3261e';
        }
        if (tf) tf.focusOverride = val;
      };

      tf?.addEventListener('click', () => { setOpen(!isOpen); });
      menu.addEventListener('mdClose', () => { setOpen(false); });

      const items = Array.from(menu.querySelectorAll('md-menu-item')) as any[];
      items.forEach((item: any) => {
        item.addEventListener('mdClick', () => {
          tf.value = item.headline || item.getAttribute('headline') || '';
          setOpen(false);
        });
      });
    };

    requestAnimationFrame(() => {
      setupExternal();
      setupControlled();
    });

    return html`
    <div style="display: flex; flex-direction: column; gap: 48px; padding: 32px; font-family: sans-serif; min-height: 1000px;">

      <!-- ── INTERNAL STATE ── -->
      <div>
        <h2 style="margin: 0 0 4px; font-size: 16px; font-weight: 500; color: #333;">Internal state (default)</h2>
        <p style="margin: 0 0 16px; font-size: 13px; color: #49454F;">
          Call <code>show()</code> / <code>close()</code> methods. The menu manages its own <code>open</code> prop.
          Clicking outside or pressing Escape closes it automatically.
        </p>
        <div style="display: flex; gap: 32px; flex-wrap: wrap; align-items: flex-start;">
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <h3 style="margin: 0; font-size: 13px; color: #49454F;">show() / close()</h3>
            <md-button id="int-anchor" variant="filled" onclick="document.getElementById('int-menu').show()">
              Open via show()
            </md-button>
            <md-menu id="int-menu" anchor="int-anchor" variant="standard">
              <md-menu-item headline="${t(globals.locale, 'menu.cut')}" trailing-text="⌘X">
                <span slot="leading-icon" class="material-symbols-outlined">content_cut</span>
              </md-menu-item>
              <md-menu-item headline="${t(globals.locale, 'menu.copy')}" trailing-text="⌘C">
                <span slot="leading-icon" class="material-symbols-outlined">content_copy</span>
              </md-menu-item>
              <md-menu-item headline="${t(globals.locale, 'menu.paste')}" trailing-text="⌘V">
                <span slot="leading-icon" class="material-symbols-outlined">content_paste</span>
              </md-menu-item>
            </md-menu>
          </div>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <h3 style="margin: 0; font-size: 13px; color: #49454F;">show() with autoFocus: false</h3>
            <md-button id="int-nofocus-anchor" variant="outlined" onclick="document.getElementById('int-nofocus-menu').show({ autoFocus: false })">
              Open (no auto-focus)
            </md-button>
            <md-menu id="int-nofocus-menu" anchor="int-nofocus-anchor" variant="standard">
              <md-menu-item headline="${t(globals.locale, 'menu.newFile')}">
                <span slot="leading-icon" class="material-symbols-outlined">note_add</span>
              </md-menu-item>
              <md-menu-item headline="${t(globals.locale, 'menu.open')}">
                <span slot="leading-icon" class="material-symbols-outlined">folder_open</span>
              </md-menu-item>
              <md-menu-item headline="${t(globals.locale, 'save')}">
                <span slot="leading-icon" class="material-symbols-outlined">save</span>
              </md-menu-item>
            </md-menu>
          </div>
        </div>
      </div>

      <!-- ── EXTERNAL STATE (open prop) ── -->
      <div>
        <h2 style="margin: 0 0 4px; font-size: 16px; font-weight: 500; color: #333;">External state (open prop)</h2>
        <p style="margin: 0 0 16px; font-size: 13px; color: #49454F;">
          Set the <code>open</code> property directly. Useful when the consumer needs full control
          (e.g. conditional logic, animations, or binding to framework state).
        </p>
        <div style="display: flex; gap: 32px; flex-wrap: wrap; align-items: flex-start;">
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <h3 style="margin: 0; font-size: 13px; color: #49454F;">Direct prop control</h3>
            <div style="display: flex; gap: 8px; align-items: center;">
              <md-button id="ext-open-btn" variant="filled">Open</md-button>
              <md-button id="ext-close-btn" variant="outlined">Close</md-button>
              <md-button id="ext-toggle-btn" variant="tonal">Toggle</md-button>
              <span style="font-size: 13px; margin-left: 8px;">
                State: <strong id="ext-indicator" style="color: #b3261e;">closed</strong>
              </span>
            </div>
            <md-menu id="ext-menu" anchor="ext-toggle-btn" variant="standard">
              <md-menu-item headline="${t(globals.locale, 'menu.profile')}">
                <span slot="leading-icon" class="material-symbols-outlined">person</span>
              </md-menu-item>
              <md-menu-item headline="${t(globals.locale, 'settings')}">
                <span slot="leading-icon" class="material-symbols-outlined">settings</span>
              </md-menu-item>
              <md-menu-item headline="${t(globals.locale, 'menu.signOut')}" divider>
                <span slot="leading-icon" class="material-symbols-outlined">logout</span>
              </md-menu-item>
            </md-menu>
          </div>
        </div>
      </div>

      <!-- ── CONTROLLED PATTERN (external state + text field) ── -->
      <div>
        <h2 style="margin: 0 0 4px; font-size: 16px; font-weight: 500; color: #333;">Controlled pattern</h2>
        <p style="margin: 0 0 16px; font-size: 13px; color: #49454F;">
          Full external control: clicking the text field toggles <code>open</code>,
          selecting an item updates the value and sets <code>open = false</code>.
          The <code>mdOpen</code> / <code>mdClose</code> events keep the UI in sync.
        </p>
        <div style="display: flex; gap: 32px; flex-wrap: wrap; align-items: flex-start;">
          <div style="display: flex; flex-direction: column; gap: 8px; width: 280px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <h3 style="margin: 0; font-size: 13px; color: #49454F;">Controlled dropdown</h3>
              <span style="font-size: 13px;">
                State: <strong id="ctrl-indicator" style="color: #b3261e;">closed</strong>
              </span>
            </div>
            <md-text-field id="ctrl-tf" variant="outlined" label="${t(globals.locale, 'menu.country')}" placeholder="${t(globals.locale, 'menu.selectCountry')}" readonly>
              <span slot="trailing-icon" class="material-symbols-outlined">arrow_drop_down</span>
            </md-text-field>
            <md-menu id="ctrl-menu" anchor="ctrl-tf" variant="standard" match-anchor-width>
              <md-menu-item headline="United States">
                <span slot="leading-icon" class="material-symbols-outlined">flag</span>
              </md-menu-item>
              <md-menu-item headline="United Kingdom">
                <span slot="leading-icon" class="material-symbols-outlined">flag</span>
              </md-menu-item>
              <md-menu-item headline="Germany">
                <span slot="leading-icon" class="material-symbols-outlined">flag</span>
              </md-menu-item>
              <md-menu-item headline="Japan">
                <span slot="leading-icon" class="material-symbols-outlined">flag</span>
              </md-menu-item>
            </md-menu>
          </div>
        </div>
      </div>

    </div>
  `;
  },
};

/* ═══════════════════════════════════════════════════════════
   12. AUTO-POSITIONING
   Menus and submenus automatically flip when they would
   overflow the viewport. Buttons are placed at viewport
   edges to trigger the repositioning logic.

   IMPORTANT: No `transform` on ancestor divs — it creates a
   new containing block that breaks `position: fixed` menus.
   ═══════════════════════════════════════════════════════════ */
export const AutoPositioning: Story = {
  render: (_args, { globals }) => html`
    <div style="font-family: sans-serif; padding: 16px;">
      <h2 style="margin: 0 0 8px; font-size: 16px; font-weight: 500; color: #333;">Auto-positioning</h2>
      <p style="margin: 0 0 24px; font-size: 13px; color: #49454F;">
        Menus flip vertically and horizontally when there isn't enough space.
        Click the buttons near each edge to see the menu reposition itself.
      </p>

      <div style="position: relative; width: 100%; height: 600px; border: 1px dashed #ccc; border-radius: 12px;">

        <!-- TOP-LEFT: default bottom-start, should stay -->
        <div style="position: absolute; top: 16px; left: 16px;">
          <md-button id="ap-tl-anchor" variant="tonal" onclick="document.getElementById('ap-tl-menu').show()">
            Top Left ↓
          </md-button>
          <md-menu id="ap-tl-menu" anchor="ap-tl-anchor" variant="standard" placement="bottom-start">
            <md-menu-item headline="${t(globals.locale, 'menu.newFile')}">
              <span slot="leading-icon" class="material-symbols-outlined">note_add</span>
            </md-menu-item>
            <md-menu-item headline="${t(globals.locale, 'menu.open')}">
              <span slot="leading-icon" class="material-symbols-outlined">folder_open</span>
            </md-menu-item>
            <md-menu-item headline="${t(globals.locale, 'save')}">
              <span slot="leading-icon" class="material-symbols-outlined">save</span>
            </md-menu-item>
          </md-menu>
        </div>

        <!-- TOP-RIGHT: default bottom-end, should stay -->
        <div style="position: absolute; top: 16px; right: 16px;">
          <md-button id="ap-tr-anchor" variant="tonal" onclick="document.getElementById('ap-tr-menu').show()">
            ↓ Top Right
          </md-button>
          <md-menu id="ap-tr-menu" anchor="ap-tr-anchor" variant="vibrant" placement="bottom-end">
            <md-menu-item headline="${t(globals.locale, 'menu.dashboard')}">
              <span slot="leading-icon" class="material-symbols-outlined">dashboard</span>
            </md-menu-item>
            <md-menu-item headline="${t(globals.locale, 'menu.analytics')}">
              <span slot="leading-icon" class="material-symbols-outlined">analytics</span>
            </md-menu-item>
            <md-menu-item headline="${t(globals.locale, 'settings')}">
              <span slot="leading-icon" class="material-symbols-outlined">settings</span>
            </md-menu-item>
          </md-menu>
        </div>

        <!-- BOTTOM-LEFT: requests bottom-start but should flip to top -->
        <div style="position: absolute; bottom: 16px; left: 16px;">
          <md-button id="ap-bl-anchor" variant="filled" onclick="document.getElementById('ap-bl-menu').show()">
            Bottom Left ↑
          </md-button>
          <md-menu id="ap-bl-menu" anchor="ap-bl-anchor" variant="standard" placement="bottom-start">
            <md-menu-item headline="${t(globals.locale, 'menu.cut')}" trailing-text="⌘X">
              <span slot="leading-icon" class="material-symbols-outlined">content_cut</span>
            </md-menu-item>
            <md-menu-item headline="${t(globals.locale, 'menu.copy')}" trailing-text="⌘C">
              <span slot="leading-icon" class="material-symbols-outlined">content_copy</span>
            </md-menu-item>
            <md-menu-item headline="${t(globals.locale, 'menu.paste')}" trailing-text="⌘V">
              <span slot="leading-icon" class="material-symbols-outlined">content_paste</span>
            </md-menu-item>
            <md-menu-item headline="${t(globals.locale, 'delete')}" divider>
              <span slot="leading-icon" class="material-symbols-outlined">delete</span>
            </md-menu-item>
            <md-menu-item headline="${t(globals.locale, 'menu.selectAll')}" trailing-text="⌘A">
              <span slot="leading-icon" class="material-symbols-outlined">select_all</span>
            </md-menu-item>
          </md-menu>
        </div>

        <!-- BOTTOM-RIGHT: requests bottom-end but should flip to top -->
        <div style="position: absolute; bottom: 16px; right: 16px;">
          <md-button id="ap-br-anchor" variant="filled" onclick="document.getElementById('ap-br-menu').show()">
            ↑ Bottom Right
          </md-button>
          <md-menu id="ap-br-menu" anchor="ap-br-anchor" variant="vibrant" placement="bottom-end">
            <md-menu-item headline="${t(globals.locale, 'menu.profile')}">
              <span slot="leading-icon" class="material-symbols-outlined">person</span>
            </md-menu-item>
            <md-menu-item headline="${t(globals.locale, 'settings')}">
              <span slot="leading-icon" class="material-symbols-outlined">settings</span>
            </md-menu-item>
            <md-menu-item headline="${t(globals.locale, 'menu.help')}">
              <span slot="leading-icon" class="material-symbols-outlined">help</span>
            </md-menu-item>
            <md-menu-item headline="${t(globals.locale, 'menu.signOut')}">
              <span slot="leading-icon" class="material-symbols-outlined">logout</span>
            </md-menu-item>
          </md-menu>
        </div>

        <!-- CENTER: with submenus -->
        <div style="position: absolute; top: 260px; left: 0; right: 0; display: flex; justify-content: center;">
          <md-button id="ap-center-anchor" variant="outlined" onclick="document.getElementById('ap-center-menu').show()">
            Center — With submenus
          </md-button>
          <md-menu id="ap-center-menu" anchor="ap-center-anchor" variant="standard" placement="bottom-start">
            <md-menu-item headline="${t(globals.locale, 'menu.newFile')}" trailing-text="⌘N">
              <span slot="leading-icon" class="material-symbols-outlined">note_add</span>
            </md-menu-item>
            <md-sub-menu-item headline="${t(globals.locale, 'menu.openRecent')}">
              <span slot="leading-icon" class="material-symbols-outlined">history</span>
              <md-menu slot="submenu" variant="standard">
                <md-menu-item headline="document.txt"></md-menu-item>
                <md-menu-item headline="image.png"></md-menu-item>
                <md-sub-menu-item headline="${t(globals.locale, 'menu.projects')}">
                  <span slot="leading-icon" class="material-symbols-outlined">folder</span>
                  <md-menu slot="submenu" variant="standard">
                    <md-menu-item headline="my-app"></md-menu-item>
                    <md-menu-item headline="website"></md-menu-item>
                    <md-menu-item headline="design-system"></md-menu-item>
                  </md-menu>
                </md-sub-menu-item>
              </md-menu>
            </md-sub-menu-item>
            <md-sub-menu-item headline="${t(globals.locale, 'menu.exportAs')}" divider>
              <span slot="leading-icon" class="material-symbols-outlined">download</span>
              <md-menu slot="submenu" variant="standard">
                <md-menu-item headline="PDF"></md-menu-item>
                <md-menu-item headline="PNG"></md-menu-item>
                <md-menu-item headline="SVG"></md-menu-item>
              </md-menu>
            </md-sub-menu-item>
            <md-menu-item headline="${t(globals.locale, 'save')}" trailing-text="⌘S">
              <span slot="leading-icon" class="material-symbols-outlined">save</span>
            </md-menu-item>
          </md-menu>
        </div>

        <!-- LEFT EDGE: submenu should open right -->
        <div style="position: absolute; top: 200px; left: 16px;">
          <md-button id="ap-left-anchor" variant="tonal" onclick="document.getElementById('ap-left-menu').show()">
            ← Left edge
          </md-button>
          <md-menu id="ap-left-menu" anchor="ap-left-anchor" variant="standard" placement="bottom-start">
            <md-menu-item headline="${t(globals.locale, 'menu.view')}">
              <span slot="leading-icon" class="material-symbols-outlined">visibility</span>
            </md-menu-item>
            <md-sub-menu-item headline="${t(globals.locale, 'menu.zoom')}">
              <span slot="leading-icon" class="material-symbols-outlined">zoom_in</span>
              <md-menu slot="submenu" variant="standard">
                <md-menu-item headline="${t(globals.locale, 'menu.zoomIn')}"></md-menu-item>
                <md-menu-item headline="${t(globals.locale, 'menu.zoomOut')}"></md-menu-item>
                <md-menu-item headline="${t(globals.locale, 'menu.fitToScreen')}"></md-menu-item>
              </md-menu>
            </md-sub-menu-item>
            <md-menu-item headline="${t(globals.locale, 'menu.fullScreen')}">
              <span slot="leading-icon" class="material-symbols-outlined">fullscreen</span>
            </md-menu-item>
          </md-menu>
        </div>

        <!-- RIGHT EDGE: submenu should flip left -->
        <div style="position: absolute; top: 200px; right: 16px;">
          <md-button id="ap-right-anchor" variant="tonal" onclick="document.getElementById('ap-right-menu').show()">
            Right edge →
          </md-button>
          <md-menu id="ap-right-menu" anchor="ap-right-anchor" variant="vibrant" placement="bottom-end">
            <md-menu-item headline="${t(globals.locale, 'edit')}">
              <span slot="leading-icon" class="material-symbols-outlined">edit</span>
            </md-menu-item>
            <md-sub-menu-item headline="${t(globals.locale, 'menu.shareWith')}">
              <span slot="leading-icon" class="material-symbols-outlined">share</span>
              <md-menu slot="submenu" variant="vibrant">
                <md-menu-item headline="${t(globals.locale, 'menu.email')}">
                  <span slot="leading-icon" class="material-symbols-outlined">email</span>
                </md-menu-item>
                <md-menu-item headline="${t(globals.locale, 'menu.messages')}">
                  <span slot="leading-icon" class="material-symbols-outlined">chat</span>
                </md-menu-item>
                <md-menu-item headline="AirDrop">
                  <span slot="leading-icon" class="material-symbols-outlined">wifi</span>
                </md-menu-item>
              </md-menu>
            </md-sub-menu-item>
            <md-menu-item headline="${t(globals.locale, 'delete')}">
              <span slot="leading-icon" class="material-symbols-outlined">delete</span>
            </md-menu-item>
          </md-menu>
        </div>

      </div>

      </div>
    </div>
  `,
};

/* ═══════════════════════════════════════════════════════════
   13. MENU TRIGGERS
   Menus can open from many component types. This story
   showcases icon buttons and split buttons as menu triggers.
   ═══════════════════════════════════════════════════════════ */
export const MenuTriggers: Story = {
  render: (_args, { globals }) => html`
    <div style="font-family: sans-serif; padding: 32px; display: flex; flex-direction: column; gap: 48px;">

      <!-- ─── SECTION: Icon Buttons ─────────────────────────── -->
      <section>
        <h2 style="margin: 0 0 4px; font-size: 16px; font-weight: 500; color: #1C1B1F;">Icon Buttons</h2>
        <p style="margin: 0 0 16px; font-size: 13px; color: #49454F;">
          The most common menu trigger — overflow menus, action menus, and contextual options.
        </p>
        <div style="display: flex; gap: 24px; align-items: center; flex-wrap: wrap;">

          <!-- Standard -->
          <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
            <md-icon-button id="trigger-ib-std" icon="more_vert" aria-label="More options" aria-haspopup="menu" onclick="document.getElementById('menu-ib-std').show()"></md-icon-button>
            <md-menu id="menu-ib-std" anchor="trigger-ib-std" placement="bottom-start">
              <md-menu-item headline="${t(globals.locale, 'edit')}">
                <span slot="leading-icon" class="material-symbols-outlined">edit</span>
              </md-menu-item>
              <md-menu-item headline="${t(globals.locale, 'menu.duplicate')}">
                <span slot="leading-icon" class="material-symbols-outlined">content_copy</span>
              </md-menu-item>
              <md-menu-item headline="${t(globals.locale, 'menu.archive')}" divider>
                <span slot="leading-icon" class="material-symbols-outlined">archive</span>
              </md-menu-item>
              <md-menu-item headline="${t(globals.locale, 'delete')}">
                <span slot="leading-icon" class="material-symbols-outlined">delete</span>
              </md-menu-item>
            </md-menu>
            <span style="font-size: 11px; color: #49454F;">Standard</span>
          </div>

          <!-- Filled -->
          <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
            <md-icon-button id="trigger-ib-filled" icon="more_vert" variant="filled" aria-label="More options" aria-haspopup="menu" onclick="document.getElementById('menu-ib-filled').show()"></md-icon-button>
            <md-menu id="menu-ib-filled" anchor="trigger-ib-filled" placement="bottom-start">
              <md-menu-item headline="${t(globals.locale, 'menu.newFile')}">
                <span slot="leading-icon" class="material-symbols-outlined">note_add</span>
              </md-menu-item>
              <md-menu-item headline="${t(globals.locale, 'menu.newFolder')}">
                <span slot="leading-icon" class="material-symbols-outlined">create_new_folder</span>
              </md-menu-item>
              <md-menu-item headline="${t(globals.locale, 'menu.upload')}">
                <span slot="leading-icon" class="material-symbols-outlined">upload_file</span>
              </md-menu-item>
            </md-menu>
            <span style="font-size: 11px; color: #49454F;">Filled</span>
          </div>

          <!-- Outlined -->
          <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
            <md-icon-button id="trigger-ib-outlined" icon="more_vert" variant="outlined" aria-label="More options" aria-haspopup="menu" onclick="document.getElementById('menu-ib-outlined').show()"></md-icon-button>
            <md-menu id="menu-ib-outlined" anchor="trigger-ib-outlined" placement="bottom-start">
              <md-menu-item headline="${t(globals.locale, 'menu.sortByName')}">
                <span slot="leading-icon" class="material-symbols-outlined">sort_by_alpha</span>
              </md-menu-item>
              <md-menu-item headline="${t(globals.locale, 'menu.sortByDate')}">
                <span slot="leading-icon" class="material-symbols-outlined">calendar_today</span>
              </md-menu-item>
              <md-menu-item headline="${t(globals.locale, 'menu.sortBySize')}">
                <span slot="leading-icon" class="material-symbols-outlined">straighten</span>
              </md-menu-item>
            </md-menu>
            <span style="font-size: 11px; color: #49454F;">Outlined</span>
          </div>

          <!-- Tonal -->
          <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
            <md-icon-button id="trigger-ib-tonal" icon="more_vert" variant="tonal" aria-label="More options" aria-haspopup="menu" onclick="document.getElementById('menu-ib-tonal').show()"></md-icon-button>
            <md-menu id="menu-ib-tonal" anchor="trigger-ib-tonal" placement="bottom-start">
              <md-menu-item headline="${t(globals.locale, 'menu.copyLink')}">
                <span slot="leading-icon" class="material-symbols-outlined">link</span>
              </md-menu-item>
              <md-menu-item headline="${t(globals.locale, 'menu.email')}">
                <span slot="leading-icon" class="material-symbols-outlined">email</span>
              </md-menu-item>
              <md-menu-item headline="${t(globals.locale, 'menu.messages')}">
                <span slot="leading-icon" class="material-symbols-outlined">chat</span>
              </md-menu-item>
            </md-menu>
            <span style="font-size: 11px; color: #49454F;">Tonal</span>
          </div>
        </div>
      </section>

      <!-- ─── SECTION: Split Buttons ────────────────────────── -->
      <section>
        <h2 style="margin: 0 0 4px; font-size: 16px; font-weight: 500; color: #1C1B1F;">Split Buttons</h2>
        <p style="margin: 0 0 16px; font-size: 13px; color: #49454F;">
          The leading action executes immediately; the trailing arrow reveals alternative actions.
        </p>
        <div style="display: flex; gap: 24px; align-items: flex-start; flex-wrap: wrap;">

          <!-- Filled split -->
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <md-split-button id="trigger-sb-filled" variant="filled" label="${t(globals.locale, 'save')}" icon="save"
              @mdTrailingClick=${(e: any) => {
                const menu = document.getElementById('menu-sb-filled') as any;
                e.detail.checked ? menu?.show() : menu?.close();
              }}>
            </md-split-button>
            <md-menu id="menu-sb-filled" anchor="trigger-sb-filled" placement="bottom-end"
              @mdClose=${() => {
                const sb = document.getElementById('trigger-sb-filled') as any;
                if (sb) sb.trailingChecked = false;
              }}>
              <md-menu-item headline="${t(globals.locale, 'menu.saveAs')}" trailing-text="⌘⇧S">
                <span slot="leading-icon" class="material-symbols-outlined">save_as</span>
              </md-menu-item>
              <md-menu-item headline="${t(globals.locale, 'menu.saveACopy')}">
                <span slot="leading-icon" class="material-symbols-outlined">file_copy</span>
              </md-menu-item>
              <md-menu-item headline="${t(globals.locale, 'menu.exportAsPdf')}">
                <span slot="leading-icon" class="material-symbols-outlined">picture_as_pdf</span>
              </md-menu-item>
            </md-menu>
            <span style="font-size: 11px; color: #49454F;">Filled</span>
          </div>

          <!-- Tonal split -->
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <md-split-button id="trigger-sb-tonal" variant="tonal" label="${t(globals.locale, 'menu.reply')}" icon="reply"
              @mdTrailingClick=${(e: any) => {
                const menu = document.getElementById('menu-sb-tonal') as any;
                e.detail.checked ? menu?.show() : menu?.close();
              }}>
            </md-split-button>
            <md-menu id="menu-sb-tonal" anchor="trigger-sb-tonal" placement="bottom-end"
              @mdClose=${() => {
                const sb = document.getElementById('trigger-sb-tonal') as any;
                if (sb) sb.trailingChecked = false;
              }}>
              <md-menu-item headline="${t(globals.locale, 'menu.replyAll')}">
                <span slot="leading-icon" class="material-symbols-outlined">reply_all</span>
              </md-menu-item>
              <md-menu-item headline="${t(globals.locale, 'menu.forward')}">
                <span slot="leading-icon" class="material-symbols-outlined">forward</span>
              </md-menu-item>
              <md-menu-item headline="${t(globals.locale, 'menu.forwardAsAttachment')}">
                <span slot="leading-icon" class="material-symbols-outlined">attach_email</span>
              </md-menu-item>
            </md-menu>
            <span style="font-size: 11px; color: #49454F;">Tonal</span>
          </div>

          <!-- Outlined split -->
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <md-split-button id="trigger-sb-outlined" variant="outlined" label="${t(globals.locale, 'menu.download')}" icon="download"
              @mdTrailingClick=${(e: any) => {
                const menu = document.getElementById('menu-sb-outlined') as any;
                e.detail.checked ? menu?.show() : menu?.close();
              }}>
            </md-split-button>
            <md-menu id="menu-sb-outlined" anchor="trigger-sb-outlined" placement="bottom-end"
              @mdClose=${() => {
                const sb = document.getElementById('trigger-sb-outlined') as any;
                if (sb) sb.trailingChecked = false;
              }}>
              <md-menu-item headline="PNG">
                <span slot="leading-icon" class="material-symbols-outlined">image</span>
              </md-menu-item>
              <md-menu-item headline="SVG">
                <span slot="leading-icon" class="material-symbols-outlined">code</span>
              </md-menu-item>
              <md-menu-item headline="PDF">
                <span slot="leading-icon" class="material-symbols-outlined">picture_as_pdf</span>
              </md-menu-item>
            </md-menu>
            <span style="font-size: 11px; color: #49454F;">Outlined</span>
          </div>
        </div>
      </section>

    </div>
  `,
  /** Trigger → menu, scripted on the icon-button openers: each opens its own
   *  menu, and single-open coordination dismisses whichever was already open. */
  play: async ({ canvasElement, step }) => {
    const menuStd = await getMenu(canvasElement, 'menu-ib-std');
    const triggerStd = canvasElement.querySelector('#trigger-ib-std') as HTMLElement;
    const menuFilled = await getMenu(canvasElement, 'menu-ib-filled');
    const triggerFilled = canvasElement.querySelector('#trigger-ib-filled') as HTMLElement;

    await step('The icon-button trigger opens its menu and exposes its four items', async () => {
      expect(menuStd.open).toBe(false);
      expect(menuStd.getAttribute('aria-hidden')).toBe('true');
      await waitFor(() => expect(triggerStd.classList.contains('hydrated')).toBe(true));
      triggerStd.click();
      // The transition the trigger drives: closed → open, surfaced to AT.
      await waitFor(() => expect(menuStd.open).toBe(true));
      await waitFor(() => expect(menuStd.getAttribute('aria-hidden')).toBe('false'));
      expect(surfaceOf(menuStd).getAttribute('role')).toBe('menu');
      expect(itemsOf(menuStd).map((i) => i.getAttribute('headline'))).toEqual([
        'Edit', 'Duplicate', 'Archive', 'Delete',
      ]);
    });

    await step('A second trigger opens its own menu and dismisses the first (single-open)', async () => {
      expect(menuFilled.open).toBe(false);
      await waitFor(() => expect(triggerFilled.classList.contains('hydrated')).toBe(true));
      triggerFilled.click();
      // The second menu opens with its own three items…
      await waitFor(() => expect(menuFilled.open).toBe(true));
      await waitFor(() => expect(menuFilled.getAttribute('aria-hidden')).toBe('false'));
      expect(itemsOf(menuFilled).map((i) => i.getAttribute('headline'))).toEqual([
        'New file', 'New folder', 'Upload',
      ]);
      // …and single-open coordination dismisses the first: it was open (asserted
      // above), now the component drives it closed and re-hides it from AT.
      await waitFor(() => expect(menuStd.open).toBe(false));
      await waitFor(() => expect(menuStd.getAttribute('aria-hidden')).toBe('true'));
      await new Promise((r) => setTimeout(r, 300));
    });
  },
};

/* ═══════════════════════════════════════════════════════════
   RTL — logical properties + Arabic content
   ═══════════════════════════════════════════════════════════ */
export const RTL: Story = {
  name: 'RTL',
  parameters: {
    docs: {
      description: {
        story:
          'Menu layout uses CSS logical properties — wrap the trigger and menu ' +
          'in <code>dir="rtl"</code> to mirror leading icons, trailing text, ' +
          'and submenu chevrons automatically.',
      },
    },
  },
  render: () => html`
    <div dir="rtl" lang="ar" style="padding: 32px; font-family: Roboto, sans-serif;">
      <p style="margin: 0 0 16px; font-size: 14px; color: #49454F;">
        فتح القائمة من زر المشغّل — التخطيط يعكس تلقائياً في RTL.
      </p>
      <md-button
        id="menu-rtl-anchor"
        variant="filled"
        aria-haspopup="menu"
        onclick="document.getElementById('menu-rtl').show()"
      >
        إجراءات
      </md-button>
      <md-menu id="menu-rtl" anchor="menu-rtl-anchor" variant="standard" placement="bottom-end">
        <md-menu-item headline="تحرير" trailing-text="⌘E">
          <span slot="leading-icon" class="material-symbols-outlined">edit</span>
        </md-menu-item>
        <md-menu-item headline="نسخ" trailing-text="⌘C">
          <span slot="leading-icon" class="material-symbols-outlined">content_copy</span>
        </md-menu-item>
        <md-menu-item headline="لصق" trailing-text="⌘V" divider>
          <span slot="leading-icon" class="material-symbols-outlined">content_paste</span>
        </md-menu-item>
        <md-menu-item headline="حذف" disabled>
          <span slot="leading-icon" class="material-symbols-outlined">delete</span>
        </md-menu-item>
      </md-menu>
    </div>
  `,
};

/* ═══════════════════════════════════════════════════════════
   LOCALIZATION — translated labels
   ═══════════════════════════════════════════════════════════ */
export const Localization: Story = {
  name: 'Localization',
  parameters: {
    docs: {
      description: {
        story:
          'Pass translated strings into <code>headline</code>, ' +
          '<code>supporting-text</code>, and <code>trailing-text</code>. ' +
          'Set <code>lang</code> on the trigger for correct screen-reader ' +
          'pronunciation.',
      },
    },
  },
  render: () => {
    const locales = [
      {
        code: 'ro',
        name: 'Română',
        trigger: 'Fișier',
        items: [
          { headline: 'Fișier nou', icon: 'note_add', trailing: '⌘N' },
          { headline: 'Deschide', icon: 'folder_open', trailing: '⌘O' },
          { headline: 'Salvează', icon: 'save', trailing: '⌘S' },
        ],
      },
      {
        code: 'fr',
        name: 'Français',
        trigger: 'Fichier',
        items: [
          { headline: 'Nouveau fichier', icon: 'note_add', trailing: '⌘N' },
          { headline: 'Ouvrir', icon: 'folder_open', trailing: '⌘O' },
          { headline: 'Enregistrer', icon: 'save', trailing: '⌘S' },
        ],
      },
      {
        code: 'de',
        name: 'Deutsch',
        trigger: 'Datei',
        items: [
          { headline: 'Neue Datei', icon: 'note_add', trailing: '⌘N' },
          { headline: 'Öffnen', icon: 'folder_open', trailing: '⌘O' },
          { headline: 'Speichern', icon: 'save', trailing: '⌘S' },
        ],
      },
    ];
    return html`
      <style>
        .menu-l10n { padding: 24px; font-family: Roboto, sans-serif; display: flex; flex-direction: column; gap: 32px; }
        .menu-l10n .row { display: flex; align-items: flex-start; gap: 24px; }
        .menu-l10n .info { flex: 0 0 140px; padding-block-start: 8px; }
        .menu-l10n .code { color: #6750a4; font-weight: 600; font-family: ui-monospace, monospace; }
        .menu-l10n .name { color: #49454F; font-size: 14px; }
      </style>
      <div class="menu-l10n">
        ${locales.map((loc, i) => html`
          <div class="row" lang="${loc.code}">
            <div class="info">
              <span class="code">${loc.code}</span>
              <span class="name">${loc.name}</span>
            </div>
            <div>
              <md-button
                id="menu-l10n-anchor-${i}"
                variant="outlined"
                aria-haspopup="menu"
                onclick="document.getElementById('menu-l10n-${i}').show()"
              >
                ${loc.trigger}
              </md-button>
              <md-menu id="menu-l10n-${i}" anchor="menu-l10n-anchor-${i}" variant="baseline">
                ${loc.items.map((item, j) => html`
                  <md-menu-item headline="${item.headline}" trailing-text="${item.trailing}" ?divider=${j === loc.items.length - 1}>
                    <span slot="leading-icon" class="material-symbols-outlined">${item.icon}</span>
                  </md-menu-item>
                `)}
              </md-menu>
            </div>
          </div>
        `)}
      </div>
    `;
  },
};

/* ═══════════════════════════════════════════════════════════
   ACCESSIBILITY — ARIA, keyboard, focus ring
   ═══════════════════════════════════════════════════════════ */
export const Accessibility: Story = {
  name: 'Accessibility',
  parameters: {
    docs: {
      description: {
        story:
          'Anchor buttons need <code>aria-haspopup="menu"</code>. The menu sets ' +
          '<code>aria-expanded</code> and <code>aria-controls</code> on the anchor ' +
          'when open. Items use roving <code>tabindex</code> — the focus ring ' +
          'appears only after Tab or arrow-key navigation, not on pointer open.',
      },
    },
  },
  render: (_args, { globals }) => html`
    <style>
      .menu-a11y { padding: 24px; font-family: Roboto, sans-serif; max-width: 640px; }
      .menu-a11y section { margin-bottom: 28px; }
      .menu-a11y h4 { margin: 0 0 4px; font-size: 14px; font-weight: 600; }
      .menu-a11y p { margin: 0 0 12px; color: #49454F; font-size: 13px; line-height: 1.5; }
      .menu-a11y kbd {
        background: #f7f2fa;
        border: 1px solid #cac4d0;
        border-radius: 4px;
        padding: 1px 6px;
        font-size: 12px;
        font-family: ui-monospace, monospace;
      }
      .menu-a11y code { background: #f7f2fa; padding: 1px 6px; border-radius: 4px; font-size: 12px; }
    </style>

    <div class="menu-a11y">
      <section>
        <h4>1 · Anchor button pattern</h4>
        <p>
          Use <code>md-button</code> or <code>md-icon-button</code> as the anchor.
          The menu wires <code>aria-expanded</code> and <code>aria-controls</code> automatically.
        </p>
        <md-button
          id="menu-a11y-anchor"
          variant="filled"
          aria-haspopup="menu"
          onclick="document.getElementById('menu-a11y').show()"
        >
          ${t(globals.locale, 'menu.actions')}
        </md-button>
        <md-menu id="menu-a11y" anchor="menu-a11y-anchor" variant="standard">
          <md-menu-item headline="${t(globals.locale, 'edit')}">
            <span slot="leading-icon" class="material-symbols-outlined">edit</span>
          </md-menu-item>
          <md-menu-item headline="${t(globals.locale, 'menu.duplicate')}">
            <span slot="leading-icon" class="material-symbols-outlined">content_copy</span>
          </md-menu-item>
          <md-menu-item headline="${t(globals.locale, 'delete')}">
            <span slot="leading-icon" class="material-symbols-outlined">delete</span>
          </md-menu-item>
        </md-menu>
      </section>

      <section>
        <h4>2 · Keyboard navigation</h4>
        <p>
          <kbd>↑</kbd> <kbd>↓</kbd> move between items ·
          <kbd>Home</kbd> <kbd>End</kbd> jump to ends ·
          <kbd>Enter</kbd> <kbd>Space</kbd> activate ·
          <kbd>Escape</kbd> close and return focus to anchor ·
          <kbd>Tab</kbd> closes the entire menu tree
        </p>
        <md-icon-button
          id="menu-a11y-kb-anchor"
          aria-haspopup="menu"
          aria-label="More options"
          onclick="document.getElementById('menu-a11y-kb').show()"
        >
          <span class="material-symbols-outlined">more_vert</span>
        </md-icon-button>
        <md-menu id="menu-a11y-kb" anchor="menu-a11y-kb-anchor" variant="baseline">
          <md-menu-item headline="${t(globals.locale, 'menu.refresh')}">
            <span slot="leading-icon" class="material-symbols-outlined">refresh</span>
          </md-menu-item>
          <md-menu-item headline="${t(globals.locale, 'settings')}">
            <span slot="leading-icon" class="material-symbols-outlined">settings</span>
          </md-menu-item>
          <md-menu-item headline="${t(globals.locale, 'menu.help')}">
            <span slot="leading-icon" class="material-symbols-outlined">help</span>
          </md-menu-item>
        </md-menu>
      </section>

      <section>
        <h4>3 · Focus ring behaviour</h4>
        <p>
          Click the trigger — no focus ring on the first item until you press
          <kbd>Tab</kbd> or use arrow keys. This matches the MD3 keyboard-focus
          pattern used across the library.
        </p>
      </section>

      <section>
        <h4>4 · Checkbox &amp; radio items</h4>
        <p>
          Toggle items expose <code>role="menuitemcheckbox"</code> /
          <code>role="menuitemradio"</code> with <code>aria-checked</code>.
        </p>
        <md-button
          id="menu-a11y-sel-anchor"
          variant="tonal"
          aria-haspopup="menu"
          onclick="document.getElementById('menu-a11y-sel').show()"
        >
          ${t(globals.locale, 'menu.viewOptions')}
        </md-button>
        <md-menu id="menu-a11y-sel" anchor="menu-a11y-sel-anchor" variant="standard">
          <md-menu-item headline="${t(globals.locale, 'menu.showThumbnails')}" type="checkbox" keep-open selected></md-menu-item>
          <md-menu-item headline="${t(globals.locale, 'menu.listView')}" type="radio" keep-open selected></md-menu-item>
          <md-menu-item headline="${t(globals.locale, 'menu.gridView')}" type="radio" keep-open></md-menu-item>
        </md-menu>
      </section>
    </div>
  `,
  /** The Escape dismissal contract, scripted on the keyboard-nav (icon-button) menu. */
  play: async ({ canvasElement, step }) => {
    const menu = await getMenu(canvasElement, 'menu-a11y-kb');
    const trigger = canvasElement.querySelector('#menu-a11y-kb-anchor') as HTMLElement;

    await step('Icon-button trigger opens the menu and wires anchor aria', async () => {
      expect(trigger.getAttribute('aria-expanded')).toBe(null); // unset while closed
      trigger.click();
      await waitFor(() => expect(menu.open).toBe(true));
      // The anchor advertises the open popup and points at the real surface.
      await waitFor(() => expect(trigger.getAttribute('aria-expanded')).toBe('true'));
      expect(trigger.getAttribute('aria-controls')).toBe(surfaceOf(menu).id);
    });

    await step('Escape closes the menu AND returns focus to the trigger (guard)', async () => {
      // Focus has moved into the menu (roving tabindex on a menuitem).
      await waitFor(() => expect(focusedItem().tagName.toLowerCase()).toBe('md-menu-item'));
      key(focusedItem(), 'Escape');
      await waitFor(() => expect(menu.open).toBe(false));
      // aria-expanded flips back, and focus is restored to the anchor — not left
      // on the now-hidden item nor dropped to <body>.
      await waitFor(() => expect(trigger.getAttribute('aria-expanded')).toBe('false'));
      await waitFor(() => expect(document.activeElement).toBe(trigger));
      await new Promise((r) => setTimeout(r, 300));
    });
  },
};

/* ═══════════════════════════════════════════════════════════
   N. RESPONSIVE
   Resize the preview (or use the Storybook viewport toolbar) to
   cross the 600px compact breakpoint and watch the menus adapt.
   ═══════════════════════════════════════════════════════════ */
export const Responsive: Story = {
  parameters: {
    layout: 'fullscreen',
    viewport: { defaultViewport: 'mobile1' },
    docs: {
      description: {
        story:
          'Menus are always clamped inside the viewport (they never overflow an edge ' +
          'and shrink their width to fit). Adding the `responsive` attribute makes a ' +
          'menu expand to near-full-width below its trigger on compact screens (≤600px). ' +
          'Resize the preview or pick a phone in the viewport toolbar to see the switch.',
      },
    },
  },
  render: (_args, { globals }) => html`
    <div style="min-height: 100vh; padding: 24px; font-family: sans-serif; box-sizing: border-box;">
      <p style="margin: 0 0 20px; font-size: 14px; color: #666; max-width: 60ch;">
        Resize this preview across <strong>600px</strong> (or use the viewport toolbar).
        Below the breakpoint the <code>responsive</code> menus go near-full-width below
        their trigger; above it they behave as normal dropdowns. All menus stay clamped
        on-screen regardless.
      </p>

      <div style="display: flex; gap: 16px; flex-wrap: wrap; align-items: flex-start;">
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <span style="font-size: 12px; color: #6f6f6f;">responsive · flat</span>
          <md-button
            id="resp-flat-anchor"
            variant="filled"
            aria-haspopup="menu"
            onclick="document.getElementById('resp-flat-menu').show()"
          >
            ${t(globals.locale, 'menu.actions')}
          </md-button>
          <md-menu id="resp-flat-menu" anchor="resp-flat-anchor" variant="standard" responsive>
            <md-menu-item headline="${t(globals.locale, 'menu.reply')}" trailing-text="R">
              <span slot="leading-icon" class="material-symbols-outlined">reply</span>
            </md-menu-item>
            <md-menu-item headline="${t(globals.locale, 'menu.forward')}" trailing-text="F">
              <span slot="leading-icon" class="material-symbols-outlined">forward</span>
            </md-menu-item>
            <md-menu-item headline="${t(globals.locale, 'menu.archive')}" trailing-text="E">
              <span slot="leading-icon" class="material-symbols-outlined">archive</span>
            </md-menu-item>
            <md-menu-item headline="${t(globals.locale, 'delete')}" trailing-text="⌫">
              <span slot="leading-icon" class="material-symbols-outlined">delete</span>
            </md-menu-item>
          </md-menu>
        </div>

        <div style="display: flex; flex-direction: column; gap: 8px;">
          <span style="font-size: 12px; color: #6f6f6f;">responsive · grouped</span>
          <md-button
            id="resp-grouped-anchor"
            variant="tonal"
            aria-haspopup="menu"
            onclick="document.getElementById('resp-grouped-menu').show()"
          >
            ${t(globals.locale, 'menu.file')}
          </md-button>
          <md-menu id="resp-grouped-menu" anchor="resp-grouped-anchor" variant="standard" layout="grouped" responsive>
            <md-menu-item-group label="${t(globals.locale, 'menu.create')}">
              <md-menu-item headline="${t(globals.locale, 'menu.newFile')}" trailing-text="⌘N">
                <span slot="leading-icon" class="material-symbols-outlined">note_add</span>
              </md-menu-item>
              <md-menu-item headline="${t(globals.locale, 'menu.newFolder')}" trailing-text="⌘⇧N">
                <span slot="leading-icon" class="material-symbols-outlined">create_new_folder</span>
              </md-menu-item>
            </md-menu-item-group>
            <md-menu-item-group label="${t(globals.locale, 'menu.manage')}">
              <md-menu-item headline="${t(globals.locale, 'menu.rename')}">
                <span slot="leading-icon" class="material-symbols-outlined">edit</span>
              </md-menu-item>
              <md-menu-item headline="${t(globals.locale, 'menu.moveToTrash')}">
                <span slot="leading-icon" class="material-symbols-outlined">delete</span>
              </md-menu-item>
            </md-menu-item-group>
          </md-menu>
        </div>

        <div style="display: flex; flex-direction: column; gap: 8px; margin-left: auto;">
          <span style="font-size: 12px; color: #6f6f6f;">clamp · near right edge</span>
          <md-button
            id="resp-clamp-anchor"
            variant="outlined"
            placement="bottom-end"
            aria-haspopup="menu"
            onclick="document.getElementById('resp-clamp-menu').show()"
          >
            Edge menu
          </md-button>
          <md-menu id="resp-clamp-menu" anchor="resp-clamp-anchor" variant="standard" placement="bottom-end">
            <md-menu-item headline="${t(globals.locale, 'menu.staysOnScreen')}"></md-menu-item>
            <md-menu-item headline="${t(globals.locale, 'menu.pinsToEdge')}"></md-menu-item>
            <md-menu-item headline="${t(globals.locale, 'menu.neverClipped')}"></md-menu-item>
          </md-menu>
        </div>
      </div>
    </div>
  `,
};

/* ═══════════════════════════════════════════════════════════
   EMPTY STATE — type-to-filter
   With `empty-text` set, hiding every item (the canonical filter
   pattern) surfaces the empty-state message. A MutationObserver
   watches inline style/hidden changes on the items.
   ═══════════════════════════════════════════════════════════ */
