import type { Meta, StoryObj } from '@storybook/web-components';
import { expect, waitFor } from 'storybook/test';
import { html } from 'lit';
import { t } from '../i18n';

/**
 * Shadow-piercing / hydration helpers for play(). testing-library can't cross
 * shadow roots, and Stencil reflects prop → attribute on the NEXT render flush,
 * so every read of `active` / `aria-selected` / `active-index` is awaited via
 * waitFor rather than asserted synchronously after the property flips. The
 * destination tabs are light-DOM children of the rail (slotted), so they're
 * queried on the rail itself, not its shadow root.
 */
type RailEl = HTMLElement & {
  activeIndex: number;
  expand: () => Promise<void>;
  collapse: () => Promise<void>;
  toggle: () => Promise<void>;
  focusTab: (index: number) => Promise<void>;
};
const getRail = async (canvasElement: HTMLElement): Promise<RailEl> => {
  const rail = canvasElement.querySelector('md-navigation-rail') as RailEl;
  await waitFor(() => expect(rail.classList.contains('hydrated')).toBe(true));
  const tabs = [...rail.querySelectorAll('md-navigation-rail-tab')] as HTMLElement[];
  await waitFor(() =>
    expect(tabs.every((t) => t.classList.contains('hydrated'))).toBe(true),
  );
  return rail;
};
const tabsOf = (rail: RailEl) =>
  [...rail.querySelectorAll('md-navigation-rail-tab')] as HTMLElement[];
/** Destinations currently carrying the reflected `active` attribute. */
const activeCount = (rail: RailEl) =>
  rail.querySelectorAll('md-navigation-rail-tab[active]').length;

const meta: Meta = {
  title: 'Navigation/Navigation Rail',
  component: 'md-navigation-rail',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: `
A Material Design 3 **Navigation Rail** — a surface for top-level navigation on
medium / large window sizes, laid out **vertically** (the M3 default) or
**horizontally** as a top-of-page application bar (\`orientation="horizontal"\`).

* Spec: https://m3.material.io/components/navigation-rail/specs
* Overview: https://m3.material.io/components/navigation-rail/overview
* Guidelines: https://m3.material.io/components/navigation-rail/guidelines
* Accessibility: https://m3.material.io/components/navigation-rail/accessibility

Holds **3–7 destinations** plus optional **header**, **FAB**, and **footer** slots.

Per the current M3 spec, the collapsed rail is **96px** wide (override
\`--md-navigation-rail-container-width: 80px\` for the narrow variant) and the
expanded rail spans **220–360px** with full-width 56px destination rows. Set
\`modal\` on a floating expanded rail for the surface-container + elevation-2
treatment. Use **labels-selected** / **labels-none** to control label visibility.

**Horizontal** (\`orientation="horizontal"\`) lays the same parts out as a bar:
\`logo\` leads, the destinations region grows to take the middle, and \`footer\`
trails — the slot for an account avatar. \`max-visible\` collapses the extra
destinations into an overflow menu, and any destination can own a dropdown by
slotting an \`md-menu\` into its \`submenu\` slot. The expand/collapse toggle is
vertical-only; \`expandable\` is ignored on a bar.
        `,
      },
      source: { language: 'html' },
    },
  },
  argTypes: {
    variant: { control: 'select', options: ['standard', 'expanded'] },
    orientation: {
      control: 'inline-radio',
      options: ['vertical', 'horizontal'],
      description:
        'Layout axis. `horizontal` lays the same parts out as a top-of-page bar; the expand toggle is not rendered there.',
    },
    maxVisible: {
      control: { type: 'number', min: 0, max: 8, step: 1 },
      description:
        'Cap on visible destinations — the rest collapse into an overflow menu whose items activate the destination.',
    },
    overflowLabel: {
      control: 'text',
      description:
        'Accessible name and tooltip for the overflow trigger. Localize it: it is user-facing text.',
    },
    overflowIcon: {
      control: 'text',
      description: 'Material Symbols ligature for the overflow trigger (default `more_horiz`).',
    },
    modal: {
      control: 'boolean',
      description:
        'Modal surface treatment for the expanded variant (surface-container, elevation 2, large corners). Host app provides positioning + scrim.',
    },
    fullHeight: {
      control: 'boolean',
      name: 'full-height',
      description:
        'Stretch the rail to the full viewport height (100dvh) instead of filling its parent. Best seen in the “Full height” story.',
    },
    alignment: { control: 'select', options: ['top', 'middle', 'bottom'] },
    expandable: {
      control: 'boolean',
      description:
        'Render a built-in leading menu button that toggles collapsed ↔ expanded (icon animates menu ↔ menu_open).',
    },
    labelVisibility: {
      control: 'select',
      options: ['all', 'selected', 'none'],
      name: 'label-visibility',
    },
    activeIndex: { control: 'number', name: 'active-index' },
    label: { control: 'text' },
  },
  args: {
    variant: 'standard',
    modal: false,
    fullHeight: false,
    expandable: false,
    alignment: 'top',
    labelVisibility: 'all',
    activeIndex: 0,
    label: 'Primary',
  },
};
export default meta;
type Story = StoryObj;

const STAGE =
  'height:560px; display:flex; align-items:stretch; border:1px solid var(--md-sys-color-outline-variant, #CAC4D0); border-radius:16px; overflow:hidden;';
const CONTENT_STAGE =
  'flex:1; padding:24px; background:var(--md-sys-color-surface-container-low, #F7F2FA); color:var(--md-sys-color-on-surface, #1C1B1F); font-family: Roboto, sans-serif;';
const SECTION = 'padding:24px; font-family: Roboto, sans-serif;';
const ROW = 'display:flex; gap:24px; flex-wrap:wrap; align-items:flex-start;';
const HEADING =
  'color:var(--md-sys-color-on-surface-variant, #49454F); margin:24px 0 8px; font-size:13px; font-weight:500; text-transform:uppercase; letter-spacing:0.5px;';

/* =====================================================================
   PLAYGROUND
   ===================================================================== */
export const Playground: Story = {
  render: (args, { globals }) => html`
    <div style="${STAGE}">
      <md-navigation-rail
        variant=${args.variant}
        ?modal=${args.modal}
        ?full-height=${args.fullHeight}
        ?expandable=${args.expandable}
        alignment=${args.alignment}
        label-visibility=${args.labelVisibility}
        active-index=${args.activeIndex}
        label=${args.label}
      >
        <md-navigation-rail-tab icon="home" label="${t(globals.locale, 'home')}" value="home"></md-navigation-rail-tab>
        <md-navigation-rail-tab icon="search" label="${t(globals.locale, 'search')}" value="search"></md-navigation-rail-tab>
        <md-navigation-rail-tab icon="favorite" label="${t(globals.locale, 'nav-rail.favorites')}" value="favorites"></md-navigation-rail-tab>
        <md-navigation-rail-tab icon="settings" label="${t(globals.locale, 'settings')}" value="settings"></md-navigation-rail-tab>
      </md-navigation-rail>
      <main style="${CONTENT_STAGE}">
        <h2 style="margin-top:0">Content area</h2>
        <p>Use the controls panel to explore every prop on <code>&lt;md-navigation-rail&gt;</code>.</p>
      </main>
    </div>
  `,
  play: async ({ canvasElement, step }) => {
    const rail = await getRail(canvasElement);
    const tabs = tabsOf(rail); // Home, Search, Favorites, Settings

    await step('Exactly one destination starts active (Home, active-index=0)', async () => {
      await waitFor(() => expect(activeCount(rail)).toBe(1));
      expect(tabs[0].getAttribute('aria-selected')).toBe('true');
      expect(tabs[1].getAttribute('aria-selected')).toBe('false');
      expect(rail.activeIndex).toBe(0);
    });

    await step('Clicking Search activates it, deselects Home, and emits mdTabChange', async () => {
      let detail: { index: number; value: string } | undefined;
      rail.addEventListener(
        'mdTabChange',
        (e) => { detail = (e as CustomEvent).detail; },
        { once: true },
      );
      const homeBefore = tabs[0].getAttribute('aria-selected'); // live read: 'true'
      tabs[1].click(); // activate Search
      // Prior selection clears on the next flush — assert the TRANSITION, not a post-condition.
      await waitFor(() =>
        expect(tabs[0].getAttribute('aria-selected')).not.toBe(homeBefore),
      );
      expect(tabs[0].getAttribute('aria-selected')).toBe('false'); // Home deselected
      expect(tabs[1].getAttribute('aria-selected')).toBe('true'); // Search selected
      expect(detail).toEqual({ index: 1, value: 'search' }); // component emitted the payload
      expect(activeCount(rail)).toBe(1); // selection moved, not accumulated
      expect(rail.activeIndex).toBe(1); // two-way bound index tracked the click
    });

    await step('Guard: re-clicking the active destination re-fires mdTabClick but NOT mdTabChange', async () => {
      let clicks = 0;
      let changes = 0;
      rail.addEventListener('mdTabClick', () => { clicks += 1; });
      rail.addEventListener('mdTabChange', () => { changes += 1; });
      tabs[1].click(); // Search is already active
      await waitFor(() => expect(clicks).toBe(1)); // activation still fires
      expect(changes).toBe(0); // selection unchanged → no mdTabChange
      expect(rail.activeIndex).toBe(1);
    });

    await step('Public expand()/collapse()/toggle() flip the variant and emit lifecycle events', async () => {
      let expands = 0;
      let collapses = 0;
      rail.addEventListener('mdExpand', () => { expands += 1; });
      rail.addEventListener('mdCollapse', () => { collapses += 1; });

      await rail.expand();
      await waitFor(() => expect(rail.getAttribute('variant')).toBe('expanded'));
      expect(expands).toBe(1); // onVariantChange emitted mdExpand

      // Guard: expand() while already expanded is a no-op — no duplicate mdExpand.
      await rail.expand();
      expect(expands).toBe(1);

      await rail.collapse();
      await waitFor(() => expect(rail.getAttribute('variant')).toBe('standard'));
      expect(collapses).toBe(1); // onVariantChange emitted mdCollapse

      await rail.toggle(); // standard → expanded
      await waitFor(() => expect(rail.getAttribute('variant')).toBe('expanded'));
      expect(expands).toBe(2);

      await rail.toggle(); // expanded → standard
      await waitFor(() => expect(rail.getAttribute('variant')).toBe('standard'));
      expect(collapses).toBe(2);
    });

    await step('focusTab(index) moves the roving tabindex to the requested destination', async () => {
      await rail.focusTab(3); // Settings
      await waitFor(() => expect(tabs[3].tabIndex).toBe(0)); // requested tab is now the tab stop
      expect(tabs[0].tabIndex).toBe(-1);
      expect(tabs[1].tabIndex).toBe(-1);
      expect(tabs[2].tabIndex).toBe(-1);

      // Out-of-range index is a safe no-op — roving stays put, nothing throws.
      await rail.focusTab(99);
      expect(tabs[3].tabIndex).toBe(0);
    });

    await step('Arrow / Home / End keys drive roving focus (wrap-around); unknown keys are ignored', async () => {
      const fire = (el: HTMLElement, key: string) =>
        el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, composed: true }));

      fire(tabs[0], 'ArrowDown'); // Home → Search
      await waitFor(() => expect(tabs[1].tabIndex).toBe(0));
      expect(tabs[0].tabIndex).toBe(-1);

      fire(tabs[1], 'End'); // → last (Settings)
      await waitFor(() => expect(tabs[3].tabIndex).toBe(0));

      fire(tabs[3], 'ArrowDown'); // wrap forward → Home
      await waitFor(() => expect(tabs[0].tabIndex).toBe(0));

      fire(tabs[0], 'ArrowUp'); // wrap backward → Settings
      await waitFor(() => expect(tabs[3].tabIndex).toBe(0));

      fire(tabs[3], 'Home'); // → Home
      await waitFor(() => expect(tabs[0].tabIndex).toBe(0));

      fire(tabs[0], 'a'); // unhandled key → no-op, roving unchanged
      expect(tabs[0].tabIndex).toBe(0);
    });
  },
};

/* =====================================================================
   FULL HEIGHT — `full-height` prop (100dvh)
   ===================================================================== */
export const FullHeight: Story = {
  name: 'Full height',
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        story:
          'With the `full-height` prop the rail spans the entire viewport (`100dvh`) regardless of its parent — the typical app-shell setup. Without the prop the rail simply fills whatever height its container provides (`100%`), which keeps it embeddable in split-pane / nested layouts.',
      },
    },
  },
  render: (_args, { globals }) => html`
    <div style="display:flex; min-height:100dvh; align-items:stretch; font-family:Roboto, sans-serif;">
      <md-navigation-rail full-height expandable label="App" active-index="0">
        <md-navigation-rail-tab icon="home" label="${t(globals.locale, 'home')}" value="home"></md-navigation-rail-tab>
        <md-navigation-rail-tab icon="search" label="${t(globals.locale, 'search')}" value="search"></md-navigation-rail-tab>
        <md-navigation-rail-tab icon="favorite" label="${t(globals.locale, 'nav-rail.favorites')}" value="favorites"></md-navigation-rail-tab>
        <md-navigation-rail-tab icon="settings" label="${t(globals.locale, 'settings')}" value="settings"></md-navigation-rail-tab>
      </md-navigation-rail>
      <main
        style="flex:1; padding:32px; background:var(--md-sys-color-surface-container-low,#F7F2FA); color:var(--md-sys-color-on-surface,#1C1B1F);"
      >
        <h2 style="margin-top:0">Full-height app shell</h2>
        <p>
          The rail has <code>full-height</code>, so it spans the whole viewport
          (<code>100dvh</code>) while the content fills the rest. Resize the
          preview — the rail tracks the viewport height.
        </p>
      </main>
    </div>
  `,
};

/* =====================================================================
   ALIGNMENTS
   ===================================================================== */
export const Alignments: Story = {
  render: (_args, { globals }) => html`
    <div style="${ROW}">
      ${(['top', 'middle', 'bottom'] as const).map(
        (alignment) => html`
          <div style="${STAGE} width: 280px;">
            <md-navigation-rail alignment=${alignment} label=${`${alignment} aligned`}>
              <md-navigation-rail-tab icon="home" label="${t(globals.locale, 'home')}" active></md-navigation-rail-tab>
              <md-navigation-rail-tab icon="search" label="${t(globals.locale, 'search')}"></md-navigation-rail-tab>
              <md-navigation-rail-tab icon="settings" label="${t(globals.locale, 'settings')}"></md-navigation-rail-tab>
            </md-navigation-rail>
            <main style="${CONTENT_STAGE}">
              <strong style="text-transform: capitalize;">${alignment}</strong>
            </main>
          </div>
        `,
      )}
    </div>
  `,
};

/* =====================================================================
   LABEL VISIBILITY
   ===================================================================== */
export const LabelVisibility: Story = {
  render: (_args, { globals }) => html`
    <div style="${ROW}">
      ${(['all', 'selected', 'none'] as const).map(
        (mode) => html`
          <div style="${STAGE} width: 280px;">
            <md-navigation-rail label-visibility=${mode} label=${`labels: ${mode}`}>
              <md-navigation-rail-tab icon="home" label="${t(globals.locale, 'home')}" active></md-navigation-rail-tab>
              <md-navigation-rail-tab icon="search" label="${t(globals.locale, 'search')}"></md-navigation-rail-tab>
              <md-navigation-rail-tab icon="settings" label="${t(globals.locale, 'settings')}"></md-navigation-rail-tab>
            </md-navigation-rail>
            <main style="${CONTENT_STAGE}">
              <p style="${HEADING}">label-visibility="${mode}"</p>
            </main>
          </div>
        `,
      )}
    </div>
  `,
};

/* =====================================================================
   WITH FAB
   ===================================================================== */
export const WithFab: Story = {
  render: (_args, { globals }) => html`
    <div style="${STAGE}">
      <md-navigation-rail label="Mail">
        <md-fab slot="fab" icon="edit" size="standard" aria-label="Compose"></md-fab>
        <md-navigation-rail-tab icon="inbox" label="${t(globals.locale, 'nav-rail.inbox')}" active badge-value="3"></md-navigation-rail-tab>
        <md-navigation-rail-tab icon="send" label="${t(globals.locale, 'nav-rail.sent')}"></md-navigation-rail-tab>
        <md-navigation-rail-tab icon="schedule" label="${t(globals.locale, 'nav-rail.scheduled')}"></md-navigation-rail-tab>
        <md-navigation-rail-tab icon="drafts" label="${t(globals.locale, 'nav-rail.drafts')}"></md-navigation-rail-tab>
      </md-navigation-rail>
      <main style="${CONTENT_STAGE}">
        <h2 style="margin-top:0">Mail</h2>
        <p>Navigation rail with a leading FAB — the most common MD3 layout.</p>
      </main>
    </div>
  `,
};

/* =====================================================================
   WITH HEADER & FOOTER
   ===================================================================== */
export const WithHeaderAndFooter: Story = {
  render: (_args, { globals }) => html`
    <div style="${STAGE}">
      <md-navigation-rail label="App navigation">
        <md-icon-button slot="header" icon="menu" aria-label="Open drawer"></md-icon-button>
        <md-fab slot="fab" icon="add" aria-label="Create"></md-fab>
        <md-navigation-rail-tab icon="home" label="${t(globals.locale, 'home')}" active></md-navigation-rail-tab>
        <md-navigation-rail-tab icon="explore" label="${t(globals.locale, 'nav-rail.explore')}"></md-navigation-rail-tab>
        <md-navigation-rail-tab icon="library_music" label="${t(globals.locale, 'nav-rail.library')}"></md-navigation-rail-tab>
        <md-navigation-rail-tab icon="person" label="${t(globals.locale, 'nav-rail.profile')}" href="#" slot="footer"></md-navigation-rail-tab>
      </md-navigation-rail>
      <main style="${CONTENT_STAGE}">
        <h2 style="margin-top:0">With header &amp; footer</h2>
        <p>
          A menu button is placed in the <code>header</code> slot, a FAB in the
          <code>fab</code> slot, and an account destination in the <code>footer</code>.
        </p>
      </main>
    </div>
  `,
};

/* =====================================================================
   LOGO + USER MENU
   ===================================================================== */
export const LogoAndUserMenu: Story = {
  name: 'Logo & user menu',
  parameters: {
    docs: {
      description: {
        story:
          'A full app rail: a brand <strong>logo</strong> in the top <code>logo</code> ' +
          'slot, destinations in the middle, and a <strong>user menu</strong> in the ' +
          'bottom <code>footer</code> slot. The logo and footer are centred while ' +
          'collapsed and shift to the leading edge when expanded.<br><br>' +
          '<strong>Keyboard:</strong> Tab and arrow keys move between interactive ' +
          'elements; Space / Enter activates the focused element.',
      },
    },
  },
  render: (_args, { globals }) => html`
    <div style="${STAGE} position: relative;">
      <md-navigation-rail variant="expanded" expandable label="Acme" style="--md-navigation-rail-logo-icon-size: 30px;">
        <!-- Contracted logo: shown while collapsed (centred) -->
        <span
          slot="logo"
          class="material-symbols-outlined"
          aria-label="Acme"
          style="font-size:30px;color:var(--md-sys-color-primary,#6750A4);"
          >rocket_launch</span
        >
        <!-- Expanded logo: shown while expanded (leading) — icon + wordmark -->
        <span
          slot="logo-expanded"
          aria-label="Acme"
          style="display:flex;align-items:center;gap:10px;"
        >
          <span class="material-symbols-outlined" style="font-size:30px;color:var(--md-sys-color-primary,#6750A4);">rocket_launch</span>
          <strong style="font-family:Roboto,sans-serif;font-size:20px;letter-spacing:0.2px;color:var(--md-sys-color-on-surface,#1C1B1F);">Acme</strong>
        </span>

        <md-navigation-rail-tab icon="home" label="${t(globals.locale, 'home')}" active></md-navigation-rail-tab>
        <md-navigation-rail-tab icon="search" label="${t(globals.locale, 'search')}"></md-navigation-rail-tab>
        <md-navigation-rail-tab icon="dashboard" label="${t(globals.locale, 'nav-rail.dashboard')}" badge-value="3"></md-navigation-rail-tab>
        <md-navigation-rail-tab icon="settings" label="${t(globals.locale, 'settings')}"></md-navigation-rail-tab>

        <!-- User menu (bottom): an account button that opens a menu -->
        <md-icon-button
          slot="footer"
          id="rail-account-anchor"
          icon="account_circle"
          aria-label="Account — Jane Doe"
          aria-haspopup="menu"
          onclick="document.getElementById('rail-account-menu').show()"
        ></md-icon-button>
      </md-navigation-rail>

      <md-menu id="rail-account-menu" anchor="rail-account-anchor" placement="top-start" variant="vibrant">
        <md-menu-item headline="Jane Doe" supporting-text="jane@acme.com"></md-menu-item>
        <md-menu-item headline="${t(globals.locale, 'nav-rail.profile')}"></md-menu-item>
        <md-menu-item headline="${t(globals.locale, 'settings')}"></md-menu-item>
        <md-menu-item headline="${t(globals.locale, 'nav-rail.sign-out')}"></md-menu-item>
      </md-menu>

      <main style="${CONTENT_STAGE}">
        <h2 style="margin-top:0">Logo &amp; user menu</h2>
        <p>
          The <code>logo</code> (contracted) and <code>logo-expanded</code> slots
          cross-fade in place as the rail expands — no drift. The <code>footer</code>
          slot holds the account button, which opens a <code>md-menu</code>. Toggle
          the rail and click the account avatar to try it.
        </p>
        <p>
          <strong>Keyboard navigation</strong> — <kbd>Tab</kbd> / arrow keys move
          between interactive elements; <kbd>Space</kbd> / <kbd>Enter</kbd> selects.
        </p>
      </main>
    </div>
  `,
};

/* =====================================================================
   EXPANDED VARIANT
   ===================================================================== */
export const ExpandedVariant: Story = {
  render: (_args, { globals }) => html`
    <div style="${STAGE}">
      <md-navigation-rail variant="expanded" expandable label="Music">
        <md-fab slot="fab" icon="add" label="${t(globals.locale, 'nav-rail.create')}" aria-label="Create"></md-fab>
        <md-navigation-rail-tab icon="home" label="${t(globals.locale, 'home')}" active></md-navigation-rail-tab>
        <md-navigation-rail-tab icon="search" label="${t(globals.locale, 'search')}"></md-navigation-rail-tab>
        <md-navigation-rail-tab icon="library_music" label="${t(globals.locale, 'nav-rail.your-library')}"></md-navigation-rail-tab>
        <md-navigation-rail-tab icon="favorite" label="${t(globals.locale, 'nav-rail.liked-songs')}"></md-navigation-rail-tab>
      </md-navigation-rail>
      <main style="${CONTENT_STAGE}">
        <h2 style="margin-top:0">Expanded rail</h2>
        <p>
          When horizontal space allows, set <code>variant="expanded"</code> to show
          full-width labels alongside the icons. Per spec the expanded rail is
          220–360px wide with 56px-tall destination rows and label-large typography.
        </p>
        <p>
          The <code>expandable</code> attribute renders the built-in menu button —
          click it to collapse the rail, then again to expand. The glyph animates
          between <code>menu_open</code> and <code>menu</code>.
        </p>
      </main>
    </div>
  `,
};

/* =====================================================================
   SECTION HEADERS
   ===================================================================== */
export const SectionHeaders: Story = {
  name: 'Section headers',
  parameters: {
    docs: {
      description: {
        story:
          'Group destinations under labelled sections in the expanded rail. Mark a ' +
          'slotted element with <code>data-section-header</code> and place it between ' +
          'destinations. Section headers show only when expanded (12px above / 8px ' +
          'below per spec) and are hidden in the collapsed icon-only rail. Use the ' +
          'toggle to collapse and see them disappear.',
      },
    },
  },
  render: (_args, { globals }) => html`
    <div style="${STAGE}">
      <md-navigation-rail variant="expanded" expandable label="Library">
        <md-fab slot="fab" icon="add" label="${t(globals.locale, 'nav-rail.create')}" aria-label="Create"></md-fab>

        <div data-section-header>${t(globals.locale, 'nav-rail.browse')}</div>
        <md-navigation-rail-tab icon="home" label="${t(globals.locale, 'home')}" active></md-navigation-rail-tab>
        <md-navigation-rail-tab icon="search" label="${t(globals.locale, 'search')}"></md-navigation-rail-tab>
        <md-navigation-rail-tab icon="explore" label="${t(globals.locale, 'nav-rail.explore')}"></md-navigation-rail-tab>

        <div data-section-header>${t(globals.locale, 'nav-rail.your-music')}</div>
        <md-navigation-rail-tab icon="library_music" label="${t(globals.locale, 'nav-rail.your-library')}"></md-navigation-rail-tab>
        <md-navigation-rail-tab icon="favorite" label="${t(globals.locale, 'nav-rail.liked-songs')}"></md-navigation-rail-tab>
        <md-navigation-rail-tab icon="schedule" label="${t(globals.locale, 'nav-rail.recently-played')}"></md-navigation-rail-tab>
      </md-navigation-rail>
      <main style="${CONTENT_STAGE}">
        <h2 style="margin-top:0">Section headers</h2>
        <p>
          A <code>data-section-header</code> element groups destinations under a label.
          They appear only in the expanded rail (spec: 12px above, 8px below) and are
          hidden when collapsed. Toggle the rail to compare.
        </p>
      </main>
    </div>
  `,
};

/* =====================================================================
   MODAL EXPANDED VARIANT
   ===================================================================== */
export const ModalExpanded: Story = {
  name: 'Modal expanded',
  parameters: {
    docs: {
      description: {
        story:
          'A modal rail. Collapsed, it is a normal docked 96px rail that sits in ' +
          'the content. Use the built-in toggle (<code>expandable</code>) to open ' +
          'it: it becomes a floating overlay over the content with a scrim behind ' +
          '(<code>surface-container</code> background, level-2 elevation, large ' +
          'corner shape). Click the scrim or press Escape to dismiss. The component ' +
          'positions the overlay against its content area, so wrap it in a ' +
          '<code>position: relative</code> container (as below).',
      },
    },
  },
  render: (_args, { globals }) => html`
    <div style="${STAGE} position: relative;">
      <md-navigation-rail variant="expanded" modal expandable label="Music">
        <md-navigation-rail-tab icon="home" label="${t(globals.locale, 'home')}" active></md-navigation-rail-tab>
        <md-navigation-rail-tab icon="search" label="${t(globals.locale, 'search')}"></md-navigation-rail-tab>
        <md-navigation-rail-tab icon="library_music" label="${t(globals.locale, 'nav-rail.your-library')}"></md-navigation-rail-tab>
        <md-navigation-rail-tab icon="favorite" label="${t(globals.locale, 'nav-rail.liked-songs')}"></md-navigation-rail-tab>
      </md-navigation-rail>
      <main style="${CONTENT_STAGE} background: #ffffff;">
        <h2 style="margin-top:0;">Content behind the modal rail</h2>
        <p>Click the scrim or press Escape to dismiss; the rail returns to its docked collapsed state.</p>
      </main>
    </div>
  `,
};

/* =====================================================================
   EXPANDED LAYOUTS — standard vs modal, mirroring the M3 spec figure
   ===================================================================== */
export const ExpandedLayouts: Story = {
  name: 'Expanded layouts: standard & modal',
  parameters: {
    docs: {
      description: {
        story:
          'The two expanded layouts from the M3 spec, side by side. ' +
          '<strong>Standard</strong> is docked: it sits in the layout, full height, ' +
          'square corners, surface background. <strong>Modal</strong> floats over ' +
          'content: <code>surface-container</code> background, level-2 elevation, ' +
          'large corner shape — the host app positions it and supplies a scrim.',
      },
    },
  },
  render: () => html`
    <div style="${ROW}">
      <div>
        <p style="${HEADING}">1 · Expanded layout: standard</p>
        <div style="${STAGE} width: 520px;">
          <md-navigation-rail variant="expanded" expandable label="Standard expanded">
            <md-fab slot="fab" icon="edit" label="Label" aria-label="Compose"></md-fab>
            <md-navigation-rail-tab icon="star" label="Label" active></md-navigation-rail-tab>
            <md-navigation-rail-tab icon="star" label="Label" badge-value="3"></md-navigation-rail-tab>
            <md-navigation-rail-tab icon="star" label="Label" badge></md-navigation-rail-tab>
            <md-navigation-rail-tab icon="star" label="Label"></md-navigation-rail-tab>
          </md-navigation-rail>
          <main style="${CONTENT_STAGE}"></main>
        </div>
      </div>
      <div>
        <p style="${HEADING}">2 · Expanded layout: modal</p>
        <div style="${STAGE} width: 520px; position: relative;">
          <md-navigation-rail variant="expanded" modal expandable label="Modal expanded">
            <md-fab slot="fab" icon="edit" label="Label" aria-label="Compose"></md-fab>
            <md-navigation-rail-tab icon="star" label="Label" active></md-navigation-rail-tab>
            <md-navigation-rail-tab icon="star" label="Label" badge-value="3"></md-navigation-rail-tab>
            <md-navigation-rail-tab icon="star" label="Label" badge></md-navigation-rail-tab>
            <md-navigation-rail-tab icon="star" label="Label"></md-navigation-rail-tab>
          </md-navigation-rail>
          <main style="${CONTENT_STAGE} background: var(--md-sys-color-surface-dim, #DED8E1);"></main>
        </div>
      </div>
    </div>
  `,
};

/* =====================================================================
   EXPANDED DESTINATION STATES — all four interaction states simultaneously
   ===================================================================== */
export const ExpandedItemStates: Story = {
  name: 'Expanded: item states',
  parameters: {
    docs: {
      description: {
        story:
          'Visual states for destinations in the expanded rail, shown simultaneously ' +
          'for documentation. Uses <code>::part(state-layer)</code> and ' +
          '<code>::part(indicator)</code> to force pseudo-states — in a real rail ' +
          'only one item is interactive at a time.',
      },
    },
  },
  render: () => {
    const NUM_BUBBLE =
      'width:24px;height:24px;border-radius:50%;' +
      'background:var(--md-sys-color-on-surface,#1C1B1F);' +
      'color:var(--md-sys-color-surface,#FFFBFE);' +
      'display:inline-flex;align-items:center;justify-content:center;' +
      'font-size:11px;font-family:Roboto,sans-serif;font-weight:500;flex-shrink:0;';
    const RAIL_WRAP =
      'height:480px;width:220px;display:flex;align-items:stretch;' +
      'border:1px solid var(--md-sys-color-outline-variant,#CAC4D0);' +
      'border-radius:16px;overflow:hidden;';
    return html`
      <style>
        .force-hover::part(state-layer) { opacity: 0.08; }
        .force-focus::part(state-layer) { opacity: 0.10; }
        /* Inset ring, matching the real expanded focus-visible style — an
           outset ring would overlap the adjacent pill (4px apart). */
        .force-focus::part(indicator) {
          outline: 3px solid var(--md-sys-color-secondary, #625B71);
          outline-offset: -3px;
        }
        .force-press::part(state-layer) { opacity: 0.10; }
      </style>
      <div style="display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start;padding:24px;font-family:Roboto,sans-serif;">
        <!-- 1 · Enabled -->
        <div style="display:flex;flex-direction:column;align-items:center;gap:8px;">
          <span style="${NUM_BUBBLE}">1</span>
          <div style="${RAIL_WRAP}">
            <md-navigation-rail variant="expanded">
              <md-icon-button slot="header" icon="menu_open" aria-label="Collapse"></md-icon-button>
              <md-navigation-rail-tab icon="star" label="Label" active></md-navigation-rail-tab>
              <md-navigation-rail-tab icon="star" label="Label"></md-navigation-rail-tab>
              <md-navigation-rail-tab icon="star" label="Label"></md-navigation-rail-tab>
            </md-navigation-rail>
          </div>
        </div>
        <!-- 2 · Hovered -->
        <div style="display:flex;flex-direction:column;align-items:center;gap:8px;">
          <span style="${NUM_BUBBLE}">2</span>
          <div style="${RAIL_WRAP}">
            <md-navigation-rail variant="expanded">
              <md-icon-button slot="header" icon="menu_open" aria-label="Collapse"></md-icon-button>
              <md-navigation-rail-tab icon="star" label="Label" active></md-navigation-rail-tab>
              <md-navigation-rail-tab icon="star" label="Label" class="force-hover"></md-navigation-rail-tab>
              <md-navigation-rail-tab icon="star" label="Label"></md-navigation-rail-tab>
            </md-navigation-rail>
          </div>
        </div>
        <!-- 3 · Focused -->
        <div style="display:flex;flex-direction:column;align-items:center;gap:8px;">
          <span style="${NUM_BUBBLE}">3</span>
          <div style="${RAIL_WRAP}">
            <md-navigation-rail variant="expanded">
              <md-icon-button slot="header" icon="menu_open" aria-label="Collapse"></md-icon-button>
              <md-navigation-rail-tab icon="star" label="Label" active></md-navigation-rail-tab>
              <md-navigation-rail-tab icon="star" label="Label" class="force-focus"></md-navigation-rail-tab>
              <md-navigation-rail-tab icon="star" label="Label"></md-navigation-rail-tab>
            </md-navigation-rail>
          </div>
        </div>
        <!-- 4 · Pressed -->
        <div style="display:flex;flex-direction:column;align-items:center;gap:8px;">
          <span style="${NUM_BUBBLE}">4</span>
          <div style="${RAIL_WRAP}">
            <md-navigation-rail variant="expanded">
              <md-icon-button slot="header" icon="menu_open" aria-label="Collapse"></md-icon-button>
              <md-navigation-rail-tab icon="star" label="Label" active></md-navigation-rail-tab>
              <md-navigation-rail-tab icon="star" label="Label" class="force-press"></md-navigation-rail-tab>
              <md-navigation-rail-tab icon="star" label="Label"></md-navigation-rail-tab>
            </md-navigation-rail>
          </div>
        </div>
      </div>
      <!-- Legend -->
      <div style="display:flex;gap:32px;padding:0 24px 24px;font-family:Roboto,sans-serif;">
        ${([
          { n: 1, l: 'Enabled' },
          { n: 2, l: 'Hovered' },
          { n: 3, l: 'Focused' },
          { n: 4, l: 'Pressed' },
        ] as const).map(
          ({ n, l }) => html`
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="${NUM_BUBBLE}">${n}</span>
              <span style="font-size:14px;color:var(--md-sys-color-on-surface,#1C1B1F);">${l}</span>
            </div>
          `,
        )}
      </div>
    `;
  },
};

/* =====================================================================
   BADGES
   ===================================================================== */
export const Badges: Story = {
  render: (_args, { globals }) => html`
    <div style="${STAGE}">
      <md-navigation-rail label="Messages">
        <md-navigation-rail-tab icon="chat" label="${t(globals.locale, 'nav-rail.chats')}" active badge-value="3"></md-navigation-rail-tab>
        <md-navigation-rail-tab icon="group" label="${t(globals.locale, 'nav-rail.groups')}" badge></md-navigation-rail-tab>
        <md-navigation-rail-tab icon="notifications" label="${t(globals.locale, 'nav-rail.alerts')}" badge-value="1200"></md-navigation-rail-tab>
        <md-navigation-rail-tab icon="settings" label="${t(globals.locale, 'settings')}"></md-navigation-rail-tab>
      </md-navigation-rail>
      <main style="${CONTENT_STAGE}">
        <h2 style="margin-top:0">Badges</h2>
        <ul>
          <li>Dot badge — set the <code>badge</code> attribute</li>
          <li>Numeric badge — set <code>badge-value</code> (auto-clamps to <code>999+</code>)</li>
        </ul>
      </main>
    </div>
  `,
};

/* =====================================================================
   STATES
   ===================================================================== */
export const States: Story = {
  render: () => html`
    <div style="${SECTION}">
      <p style="${HEADING}">Default states</p>
      <div style="${STAGE} width:240px;">
        <md-navigation-rail label="States">
          <md-navigation-rail-tab icon="home" label="Default"></md-navigation-rail-tab>
          <md-navigation-rail-tab icon="search" label="Active" active></md-navigation-rail-tab>
          <md-navigation-rail-tab icon="block" label="Disabled" disabled></md-navigation-rail-tab>
          <md-navigation-rail-tab icon="link" label="Link" href="#" slot="footer"></md-navigation-rail-tab>
        </md-navigation-rail>
      </div>
    </div>
  `,
};

/* =====================================================================
   CONTROLLED — react to mdTabChange
   ===================================================================== */
export const Controlled: Story = {
  render: (_args, { globals }) => html`
    <div style="${STAGE}">
      <md-navigation-rail
        id="ctrlRail"
        label="Controlled"
        active-index="0"
        @mdTabChange="${(e: CustomEvent) => {
          const out = document.getElementById('ctrlOut');
          if (out) out.textContent = `Selected: ${e.detail.value} (index ${e.detail.index})`;
        }}"
      >
        <md-navigation-rail-tab icon="home" label="${t(globals.locale, 'home')}" value="home"></md-navigation-rail-tab>
        <md-navigation-rail-tab icon="search" label="${t(globals.locale, 'search')}" value="search"></md-navigation-rail-tab>
        <md-navigation-rail-tab icon="favorite" label="${t(globals.locale, 'nav-rail.favorites')}" value="favorites"></md-navigation-rail-tab>
      </md-navigation-rail>
      <main style="${CONTENT_STAGE}">
        <h2 style="margin-top:0">Controlled rail</h2>
        <p>Click a destination — the parent receives the <code>mdTabChange</code> event:</p>
        <pre id="ctrlOut" style="padding:12px; background:var(--md-sys-color-surface-container, #F3EDF7); border-radius:8px;">Selected: home (index 0)</pre>
      </main>
    </div>
  `,
  play: async ({ canvasElement, step }) => {
    const rail = await getRail(canvasElement);
    const tabs = tabsOf(rail); // Home, Search, Favorites
    const out = canvasElement.querySelector('#ctrlOut') as HTMLElement;

    await step('active-index="0" selects Home', async () => {
      await waitFor(() => expect(tabs[0].getAttribute('aria-selected')).toBe('true'));
      expect(tabs[2].getAttribute('aria-selected')).toBe('false');
      expect(activeCount(rail)).toBe(1);
    });

    await step('Setting active-index=2 drives selection to Favorites (prior deselects, no phantom event)', async () => {
      const homeBefore = tabs[0].getAttribute('aria-selected'); // live read: 'true'
      const outBefore = out.textContent; // parent's mdTabChange readout
      rail.activeIndex = 2; // programmatic control — no user click
      await waitFor(() => expect(tabs[2].getAttribute('aria-selected')).toBe('true'));
      expect(tabs[0].getAttribute('aria-selected')).not.toBe(homeBefore); // Home deselected
      expect(tabs[0].getAttribute('aria-selected')).toBe('false');
      expect(activeCount(rail)).toBe(1); // exactly one selected — the prop drove it
      expect(rail.getAttribute('active-index')).toBe('2'); // reflected to the attribute
      // Guard: a programmatic active-index change must NOT emit mdTabChange.
      expect(out.textContent).toBe(outBefore);
    });

    await step('Clicking a destination emits mdTabChange AND self-moves the active selection', async () => {
      let detail: { index: number; value: string } | undefined;
      rail.addEventListener(
        'mdTabChange',
        (e) => { detail = (e as CustomEvent).detail; },
        { once: true },
      );
      const outBefore = out.textContent; // parent readout before the click ('Selected: home …')
      tabs[1].click(); // activate Search (was Favorites at index 2)
      await waitFor(() => expect(out.textContent).not.toBe(outBefore)); // parent handler ran
      expect(detail).toEqual({ index: 1, value: 'search' }); // component emitted the payload
      expect(out.textContent).toContain('search'); // parent's mdTabChange readout updated
      // `activeIndex` is a mutable, two-way-bound prop: the rail moves the selection
      // itself on click (uncontrolled by default) — the parent handler only observes.
      // aria-selected reflects on the tab's NEXT render flush, so gate it via waitFor,
      // not synchronously off the (already-settled) text readout above.
      await waitFor(() => {
        expect(tabs[1].getAttribute('aria-selected')).toBe('true'); // Search now selected
        expect(tabs[2].getAttribute('aria-selected')).toBe('false'); // prior active (Favorites) deselected
      });
      expect(activeCount(rail)).toBe(1); // selection moved, not accumulated
      expect(rail.activeIndex).toBe(1); // two-way bound index tracked the click
    });
  },
};

/* =====================================================================
   CUSTOM ICONS (SVG / FA / emoji via slot)
   ===================================================================== */
export const SlottedIcons: Story = {
  render: () => html`
    <div style="${STAGE}">
      <md-navigation-rail label="Custom icons">
        <md-navigation-rail-tab label="SVG" active>
          <svg slot="icon" viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
            <path d="M12 2 3 7v2h18V7l-9-5zm-7 9v9h4v-5h6v5h4v-9H5z" />
          </svg>
        </md-navigation-rail-tab>
        <md-navigation-rail-tab label="Star">
          <svg slot="icon" viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
          </svg>
        </md-navigation-rail-tab>
        <md-navigation-rail-tab label="Emoji">
          <span slot="icon" style="font-size:20px;">🚀</span>
        </md-navigation-rail-tab>
        <md-navigation-rail-tab icon="settings" label="Prop"></md-navigation-rail-tab>
      </md-navigation-rail>
      <main style="${CONTENT_STAGE}">
        <h2 style="margin-top:0">Custom icons via slot</h2>
        <p>Drop any <code>&lt;svg&gt;</code>, font icon, emoji or custom element into the <code>icon</code> slot — the prop is used as fallback.</p>
      </main>
    </div>
  `,
};

/* =====================================================================
   CUSTOM CSS — CSS custom properties + parts
   ===================================================================== */
export const CustomCSS: Story = {
  render: (_args, { globals }) => html`
    <style>
      .brand-rail {
        --md-navigation-rail-container-color: #1A1F36;
        --md-navigation-rail-content-color: #C7D0FF;
      }
      .brand-rail md-navigation-rail-tab {
        --md-navigation-rail-tab-active-icon-color: #FFFFFF;
        --md-navigation-rail-tab-active-label-color: #FFFFFF;
        --md-navigation-rail-tab-indicator-color: #4F6FFF;
        --md-navigation-rail-tab-icon-color: #97A4D8;
        --md-navigation-rail-tab-label-color: #97A4D8;
      }
      /* CSS Parts — pierce the shadow root */
      .uppercase-rail md-navigation-rail-tab::part(label) {
        text-transform: uppercase;
        letter-spacing: 1.2px;
        font-size: 10px;
      }
    </style>

    <div style="${ROW}">
      <div style="${STAGE} width:240px;">
        <md-navigation-rail class="brand-rail" label="Brand">
          <md-navigation-rail-tab icon="dashboard" label="${t(globals.locale, 'nav-rail.dashboard')}" active></md-navigation-rail-tab>
          <md-navigation-rail-tab icon="bar_chart" label="${t(globals.locale, 'nav-rail.analytics')}"></md-navigation-rail-tab>
          <md-navigation-rail-tab icon="people" label="${t(globals.locale, 'nav-rail.team')}"></md-navigation-rail-tab>
        </md-navigation-rail>
      </div>
      <div style="${STAGE} width:240px;">
        <md-navigation-rail class="uppercase-rail" label="Uppercase labels">
          <md-navigation-rail-tab icon="home" label="${t(globals.locale, 'home')}" active></md-navigation-rail-tab>
          <md-navigation-rail-tab icon="search" label="${t(globals.locale, 'search')}"></md-navigation-rail-tab>
        </md-navigation-rail>
      </div>
    </div>
  `,
};

/* =====================================================================
   LOCALIZATION — live language switcher
   ===================================================================== */
export const Localization: Story = {
  name: 'Localization',
  parameters: {
    docs: {
      description: {
        story:
          'The rail is fully localizable: destination **labels**, the navigation ' +
          '**aria-label** (the `label` prop), the surrounding content, and the layout ' +
          '**direction** all follow the active locale. Pick a language to swap every ' +
          'string in place. Arabic (`dir="rtl"`) flips the rail to the trailing edge ' +
          'automatically — the component uses CSS logical properties throughout — and ' +
          'the longer German labels show how the rail handles overflow. Icons stay ' +
          'constant since they carry meaning across languages; only text is translated.',
      },
    },
  },
  render: () => {
    type Locale = {
      code: string;
      native: string;
      dir: 'ltr' | 'rtl';
      nav: string;
      labels: [string, string, string, string]; // Home, Search, Favorites, Settings
      heading: string;
      body: string;
    };

    const LOCALES: Locale[] = [
      {
        code: 'en',
        native: 'English',
        dir: 'ltr',
        nav: 'Navigation',
        labels: ['Home', 'Search', 'Favorites', 'Settings'],
        heading: 'Localized navigation',
        body: 'Every label, the navigation aria-label, and the layout direction follow the selected locale.',
      },
      {
        code: 'es',
        native: 'Español',
        dir: 'ltr',
        nav: 'Navegación',
        labels: ['Inicio', 'Buscar', 'Favoritos', 'Ajustes'],
        heading: 'Navegación localizada',
        body: 'Cada etiqueta, la etiqueta aria de navegación y la dirección del diseño siguen la configuración regional seleccionada.',
      },
      {
        code: 'de',
        native: 'Deutsch',
        dir: 'ltr',
        nav: 'Navigation',
        labels: ['Startseite', 'Suchen', 'Favoriten', 'Einstellungen'],
        heading: 'Lokalisierte Navigation',
        body: 'Die längeren deutschen Bezeichnungen zeigen, wie die Navigationsleiste mit überlaufenden Beschriftungen umgeht.',
      },
      {
        code: 'ja',
        native: '日本語',
        dir: 'ltr',
        nav: 'ナビゲーション',
        labels: ['ホーム', '検索', 'お気に入り', '設定'],
        heading: 'ローカライズされたナビゲーション',
        body: 'すべてのラベル、ナビゲーションの aria-label、レイアウトの方向が選択した言語に従います。',
      },
      {
        code: 'ar',
        native: 'العربية',
        dir: 'rtl',
        nav: 'التنقل',
        labels: ['الرئيسية', 'البحث', 'المفضلة', 'الإعدادات'],
        heading: 'تنقل مترجم',
        body: 'في السياقات من اليمين إلى اليسار، تنتقل الشريط إلى الحافة الخلفية تلقائيًا باستخدام الخصائص المنطقية في CSS.',
      },
    ];

    const DEFAULT = LOCALES[0];

    const chipStyle = (active: boolean) =>
      'display:inline-flex; align-items:center; padding:6px 14px; border-radius:999px;' +
      'cursor:pointer; font-family:Roboto, sans-serif; font-size:13px; font-weight:500;' +
      'transition:background 120ms, border-color 120ms, color 120ms;' +
      `border:1px solid ${
        active
          ? 'var(--md-sys-color-secondary, #625B71)'
          : 'var(--md-sys-color-outline-variant, #CAC4D0)'
      };` +
      `background:${active ? 'var(--md-sys-color-secondary-container, #E8DEF8)' : 'transparent'};` +
      `color:${
        active
          ? 'var(--md-sys-color-on-secondary-container, #1D192B)'
          : 'var(--md-sys-color-on-surface, #1C1B1F)'
      };`;

    const apply = (code: string) => {
      const loc = LOCALES.find((l) => l.code === code) ?? DEFAULT;

      const stage = document.getElementById('l10n-stage');
      if (stage) stage.setAttribute('dir', loc.dir);

      const rail = document.getElementById('l10n-rail');
      if (rail) {
        rail.setAttribute('label', loc.nav);
        rail.setAttribute('lang', loc.code);
        const tabs = rail.querySelectorAll('md-navigation-rail-tab');
        loc.labels.forEach((label, i) => tabs[i]?.setAttribute('label', label));
      }

      const heading = document.getElementById('l10n-heading');
      if (heading) heading.textContent = loc.heading;
      const body = document.getElementById('l10n-body');
      if (body) body.textContent = loc.body;

      document.querySelectorAll('[data-l10n-btn]').forEach((node) => {
        const el = node as HTMLButtonElement;
        const active = el.getAttribute('data-l10n-btn') === code;
        el.setAttribute('aria-pressed', String(active));
        el.setAttribute('style', chipStyle(active));
      });
    };

    return html`
      <div style="display:flex; flex-direction:column; gap:16px; font-family:Roboto, sans-serif;">
        <div role="group" aria-label="Language" style="display:flex; gap:8px; flex-wrap:wrap;">
          ${LOCALES.map(
            (loc) => html`
              <button
                type="button"
                lang=${loc.code}
                data-l10n-btn=${loc.code}
                aria-pressed=${loc.code === DEFAULT.code ? 'true' : 'false'}
                style=${chipStyle(loc.code === DEFAULT.code)}
                @click=${() => apply(loc.code)}
              >
                ${loc.native}
              </button>
            `,
          )}
        </div>

        <div id="l10n-stage" dir=${DEFAULT.dir} style="${STAGE}">
          <md-navigation-rail id="l10n-rail" lang=${DEFAULT.code} label=${DEFAULT.nav} active-index="0">
            <md-navigation-rail-tab icon="home" label=${DEFAULT.labels[0]} value="home"></md-navigation-rail-tab>
            <md-navigation-rail-tab icon="search" label=${DEFAULT.labels[1]} value="search"></md-navigation-rail-tab>
            <md-navigation-rail-tab icon="favorite" label=${DEFAULT.labels[2]} value="favorites"></md-navigation-rail-tab>
            <md-navigation-rail-tab icon="settings" label=${DEFAULT.labels[3]} value="settings"></md-navigation-rail-tab>
          </md-navigation-rail>
          <main style="${CONTENT_STAGE}">
            <h2 id="l10n-heading" style="margin-top:0; text-align:start;">${DEFAULT.heading}</h2>
            <p id="l10n-body" style="text-align:start;">${DEFAULT.body}</p>
          </main>
        </div>
      </div>
    `;
  },
};

/* =====================================================================
   RTL
   ===================================================================== */
export const RTL: Story = {
  render: () => html`
    <div dir="rtl" style="${STAGE}">
      <md-navigation-rail label="التنقل">
        <md-navigation-rail-tab icon="home" label="الرئيسية" active></md-navigation-rail-tab>
        <md-navigation-rail-tab icon="search" label="البحث"></md-navigation-rail-tab>
        <md-navigation-rail-tab icon="settings" label="الإعدادات"></md-navigation-rail-tab>
      </md-navigation-rail>
      <main style="${CONTENT_STAGE}">
        <h2 style="margin-top:0; text-align:start;">RTL layout</h2>
        <p>
          The rail uses CSS logical properties throughout, so it sits on the
          right edge in RTL contexts automatically.
        </p>
      </main>
    </div>
  `,
};

/* =====================================================================
   DARK THEME
   ===================================================================== */
export const DarkTheme: Story = {
  decorators: [
    (story) => html`
      <div data-theme="dark" style="background:#1C1B1F; padding:24px; border-radius:16px;">
        ${story()}
      </div>
    `,
  ],
  render: (_args, { globals }) => html`
    <div style="${STAGE} background:#1C1B1F;">
      <md-navigation-rail label="Dark">
        <md-fab slot="fab" icon="edit" aria-label="Compose"></md-fab>
        <md-navigation-rail-tab icon="home" label="${t(globals.locale, 'home')}" active></md-navigation-rail-tab>
        <md-navigation-rail-tab icon="search" label="${t(globals.locale, 'search')}"></md-navigation-rail-tab>
        <md-navigation-rail-tab icon="favorite" label="${t(globals.locale, 'nav-rail.favorites')}" badge></md-navigation-rail-tab>
        <md-navigation-rail-tab icon="settings" label="${t(globals.locale, 'settings')}"></md-navigation-rail-tab>
      </md-navigation-rail>
      <main style="${CONTENT_STAGE} background:#211F26; color:#E6E1E5;">
        <h2 style="margin-top:0">Dark theme</h2>
      </main>
    </div>
  `,
};

/* =====================================================================
   ACCESSIBILITY DEMO
   ===================================================================== */
export const Accessibility: Story = {
  parameters: {
    docs: {
      description: {
        story: `
**Accessibility features**

* Host has \`role="navigation"\` and an \`aria-label\` (defaults to *"Navigation"*).
* Inner destinations container exposes \`role="tablist"\` with \`aria-orientation="vertical"\`.
* Each destination is \`role="tab"\` (or \`role="link"\` when \`href\` is set).
* The active destination uses \`aria-selected="true"\` (tab semantics) or \`aria-current="page"\` (link semantics).
* Roving tabindex — only the active destination is in the tab order; arrow keys move focus.
* **Keyboard**: <kbd>Tab</kbd> into the rail, <kbd>↑</kbd>/<kbd>↓</kbd> move focus, <kbd>Home</kbd>/<kbd>End</kbd> jump, <kbd>Enter</kbd>/<kbd>Space</kbd> activate.
* All states meet **WCAG 2.1 AA** contrast against MD3 tokens.
* Reduced motion is respected — transitions disable under \`prefers-reduced-motion: reduce\`.
* Forced-colors mode receives a visible indicator and border.
        `,
      },
    },
  },
  render: (_args, { globals }) => html`
    <div style="${STAGE}">
      <md-navigation-rail label="Accessible rail">
        <md-navigation-rail-tab icon="home" label="${t(globals.locale, 'home')}" active></md-navigation-rail-tab>
        <md-navigation-rail-tab icon="search" label="${t(globals.locale, 'search')}"></md-navigation-rail-tab>
        <md-navigation-rail-tab icon="favorite" label="${t(globals.locale, 'nav-rail.favorites')}" badge></md-navigation-rail-tab>
        <md-navigation-rail-tab icon="block" label="Disabled" disabled></md-navigation-rail-tab>
        <md-navigation-rail-tab icon="settings" label="${t(globals.locale, 'settings')}"></md-navigation-rail-tab>
      </md-navigation-rail>
      <main style="${CONTENT_STAGE}">
        <h2 style="margin-top:0">Try the keyboard</h2>
        <ol>
          <li>Press <kbd>Tab</kbd> until the active destination is focused.</li>
          <li>Use <kbd>↑</kbd> / <kbd>↓</kbd> to move between destinations.</li>
          <li>Press <kbd>Home</kbd> / <kbd>End</kbd> to jump to first / last.</li>
          <li>Press <kbd>Enter</kbd> or <kbd>Space</kbd> to activate.</li>
        </ol>
      </main>
    </div>
  `,
};

/* =====================================================================
   EXPANDABLE TOGGLE + MODAL DISMISS + PRE-MARKED ACTIVE (interaction coverage)
   ===================================================================== */
export const ExpandableToggleAndModalDismiss: Story = {
  name: 'Expandable toggle & modal dismiss',
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        story:
          'Exercises the built-in `expandable` toggle button (icon + `aria-expanded` ' +
          'reflect the variant), the modal dismissal paths (Escape and scrim click, ' +
          'both returning focus to the toggle), and adoption of a destination that was ' +
          'pre-marked `active` in light DOM without an `active-index` on the rail.',
      },
    },
  },
  render: () => html`
    <div style="${STAGE} position: relative;">
      <md-navigation-rail variant="expanded" modal expandable label="App">
        <md-navigation-rail-tab icon="home" label="Home" value="home" active></md-navigation-rail-tab>
        <md-navigation-rail-tab icon="search" label="Search" value="search"></md-navigation-rail-tab>
        <md-navigation-rail-tab icon="settings" label="Settings" value="settings"></md-navigation-rail-tab>
      </md-navigation-rail>
      <main style="${CONTENT_STAGE}">
        <h2 style="margin-top:0">Toggle &amp; modal dismiss</h2>
        <p>Content behind the modal rail. Escape or a scrim click collapses it.</p>
      </main>
    </div>
  `,
  play: async ({ canvasElement, step }) => {
    const rail = await getRail(canvasElement);
    const tabs = tabsOf(rail); // Home, Search, Settings
    const toggle = () =>
      rail.shadowRoot?.querySelector('.md-navigation-rail__toggle-button') as
        | (HTMLElement & { icon: string })
        | null;

    await step('A tab pre-marked `active` (no active-index) is adopted as the active destination', async () => {
      await waitFor(() => expect(rail.activeIndex).toBe(0)); // componentWillLoad read the child's `active`
      expect(activeCount(rail)).toBe(1);
      expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    });

    await step('The built-in toggle reflects the expanded state (menu_open icon, aria-expanded=true)', async () => {
      await waitFor(() => expect(toggle()).not.toBe(null));
      expect(toggle()!.getAttribute('aria-expanded')).toBe('true');
      // `icon` is an md-icon-button @Prop (not reflected), so read the property.
      expect(toggle()!.icon).toBe('menu_open');
    });

    await step('Clicking the toggle collapses the rail, emits mdCollapse, and swaps the icon', async () => {
      let collapses = 0;
      rail.addEventListener('mdCollapse', () => { collapses += 1; }, { once: true });
      toggle()!.click(); // handleToggleClick → toggle()
      await waitFor(() => expect(rail.getAttribute('variant')).toBe('standard'));
      expect(collapses).toBe(1);
      await waitFor(() => expect(toggle()!.getAttribute('aria-expanded')).toBe('false'));
      expect(toggle()!.icon).toBe('menu');
    });

    await step('Clicking the toggle again expands the rail and emits mdExpand', async () => {
      let expands = 0;
      rail.addEventListener('mdExpand', () => { expands += 1; }, { once: true });
      toggle()!.click();
      await waitFor(() => expect(rail.getAttribute('variant')).toBe('expanded'));
      expect(expands).toBe(1);
      await waitFor(() => expect(toggle()!.icon).toBe('menu_open'));
    });

    await step('Escape dismisses the modal overlay and returns focus to the toggle', async () => {
      let collapses = 0;
      rail.addEventListener('mdCollapse', () => { collapses += 1; }, { once: true });
      rail.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }));
      await waitFor(() => expect(rail.getAttribute('variant')).toBe('standard'));
      expect(collapses).toBe(1); // Escape drove the collapse
      await waitFor(() =>
        expect(
          rail.shadowRoot?.activeElement?.classList.contains('md-navigation-rail__toggle-button'),
        ).toBe(true),
      );
    });

    await step('Clicking the scrim dismisses the re-opened modal overlay', async () => {
      toggle()!.click(); // re-expand
      await waitFor(() => expect(rail.getAttribute('variant')).toBe('expanded'));
      const scrim = rail.shadowRoot?.querySelector('.md-navigation-rail__scrim') as HTMLElement;
      let collapses = 0;
      rail.addEventListener('mdCollapse', () => { collapses += 1; }, { once: true });
      scrim.click(); // handleScrimClick → collapse()
      await waitFor(() => expect(rail.getAttribute('variant')).toBe('standard'));
      expect(collapses).toBe(1);
    });
  },
};

/* =====================================================================
   LINK DESTINATIONS — container sheds its tablist role (interaction coverage)
   ===================================================================== */
export const LinkDestinationsRole: Story = {
  name: 'Link destinations (role sheds tablist)',
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        story:
          'When destinations render as links (`href` set) the destinations container ' +
          'drops its invalid `tablist` role and orientation/label — a `tablist` may only ' +
          'contain `tab` children per ARIA.',
      },
    },
  },
  render: () => html`
    <div style="${STAGE}">
      <md-navigation-rail label="Site">
        <md-navigation-rail-tab icon="home" label="Home" href="#home"></md-navigation-rail-tab>
        <md-navigation-rail-tab icon="info" label="About" href="#about"></md-navigation-rail-tab>
        <md-navigation-rail-tab icon="mail" label="Contact" href="#contact"></md-navigation-rail-tab>
      </md-navigation-rail>
      <main style="${CONTENT_STAGE}">
        <h2 style="margin-top:0">Link destinations</h2>
        <p>Each destination has an <code>href</code>, so the container is not a tablist.</p>
      </main>
    </div>
  `,
  play: async ({ canvasElement, step }) => {
    const rail = await getRail(canvasElement);
    const dest = rail.shadowRoot?.querySelector('.md-navigation-rail__destinations') as HTMLElement;

    await step('href destinations make the container shed its tablist semantics', async () => {
      // syncTabs detects the links and re-renders the container without tab roles.
      await waitFor(() => expect(dest.getAttribute('role')).toBe(null));
      expect(dest.getAttribute('aria-orientation')).toBe(null);
      expect(dest.getAttribute('aria-label')).toBe(null);
    });
  },
};

/* ═══════════════════════════════════════════════════════════
   HORIZONTAL, OVERFLOW AND SUBMENUS
   The rail beyond the fixed vertical column: a top-of-page bar,
   an overflow menu for extra destinations, and a destination
   that owns its own dropdown.
   ═══════════════════════════════════════════════════════════ */
export const HorizontalOverflowAndSubmenus: Story = {
  parameters: {
    docs: {
      description: {
        story:
          '`orientation="horizontal"` lays the rail out as a top-of-page bar. `max-visible` collapses the destinations past the cap into an overflow menu (the trigger is a `button` with `aria-haspopup="menu"`, deliberately outside the `tablist`). A destination can also own a dropdown by slotting an `md-menu` into its `submenu` slot — activating it opens the menu instead of navigating.',
      },
    },
  },
  render: (_args, { globals }) => html`
    <div style="display: flex; flex-direction: column; gap: 32px; padding: 24px; font-family: sans-serif;">
      <div style="display: grid; gap: 8px;">
        <h3 style="margin: 0; font-size: 13px; color: #666;">orientation="horizontal"</h3>
        <md-navigation-rail id="rail-horiz" orientation="horizontal" label="${t(globals.locale, 'nav-rail.dashboard')}" active-index="0">
          <md-navigation-rail-tab icon="home" label="${t(globals.locale, 'home')}" value="home"></md-navigation-rail-tab>
          <md-navigation-rail-tab icon="folder" label="${t(globals.locale, 'nav-rail.library')}" value="library"></md-navigation-rail-tab>
          <md-navigation-rail-tab icon="star" label="${t(globals.locale, 'nav-rail.favorites')}" value="favorites"></md-navigation-rail-tab>
          <md-navigation-rail-tab id="rail-bar-menu" icon="bar_chart" label="${t(globals.locale, 'nav-rail.analytics')}" value="analytics">
            <md-menu variant="vibrant" slot="submenu">
              <md-menu-item headline="Usage"><span slot="leading-icon" class="material-symbols-outlined">insights</span></md-menu-item>
              <md-menu-item headline="Revenue"><span slot="leading-icon" class="material-symbols-outlined">payments</span></md-menu-item>
              <md-sub-menu-item headline="Exports" supporting-text="Pick a format"><span slot="leading-icon" class="material-symbols-outlined">download</span>
                <md-menu variant="vibrant" slot="submenu">
                  <md-menu-item headline="CSV"><span slot="leading-icon" class="material-symbols-outlined">table_chart</span></md-menu-item>
                  <md-menu-item headline="PDF"><span slot="leading-icon" class="material-symbols-outlined">picture_as_pdf</span></md-menu-item>
                </md-menu>
              </md-sub-menu-item>
            </md-menu>
          </md-navigation-rail-tab>
          <md-navigation-rail-tab icon="settings" label="${t(globals.locale, 'settings')}" value="settings"></md-navigation-rail-tab>
        </md-navigation-rail>
      </div>

      <div style="display: flex; gap: 32px;">
        <div style="display: grid; gap: 8px;">
          <h3 style="margin: 0; font-size: 13px; color: #666;">max-visible="3"</h3>
          <div style="display: flex; block-size: 360px;">
            <md-navigation-rail id="rail-overflow" label="${t(globals.locale, 'nav-rail.dashboard')}" active-index="0" max-visible="3">
              <md-navigation-rail-tab icon="home" label="${t(globals.locale, 'home')}" value="home"></md-navigation-rail-tab>
              <md-navigation-rail-tab icon="folder" label="${t(globals.locale, 'nav-rail.library')}" value="library"></md-navigation-rail-tab>
              <md-navigation-rail-tab icon="star" label="${t(globals.locale, 'nav-rail.favorites')}" value="favorites"></md-navigation-rail-tab>
              <md-navigation-rail-tab icon="drafts" label="${t(globals.locale, 'nav-rail.drafts')}" value="drafts"></md-navigation-rail-tab>
              <md-navigation-rail-tab icon="settings" label="${t(globals.locale, 'settings')}" value="settings"></md-navigation-rail-tab>
            </md-navigation-rail>
          </div>
        </div>

        <div style="display: grid; gap: 8px;">
          <h3 style="margin: 0; font-size: 13px; color: #666;">A destination with a submenu</h3>
          <div style="display: flex; block-size: 360px;">
            <md-navigation-rail id="rail-submenu" label="${t(globals.locale, 'nav-rail.dashboard')}" active-index="0">
              <md-navigation-rail-tab icon="home" label="${t(globals.locale, 'home')}" value="home"></md-navigation-rail-tab>
              <md-navigation-rail-tab id="rail-submenu-trigger" icon="category" label="${t(globals.locale, 'nav-rail.library')}" value="library">
                <md-menu variant="vibrant" slot="submenu">
                  <md-menu-item headline="Overview"><span slot="leading-icon" class="material-symbols-outlined">dashboard</span></md-menu-item>
                  <md-menu-item headline="Pricing"><span slot="leading-icon" class="material-symbols-outlined">sell</span></md-menu-item>
                  <md-menu-item headline="Changelog"><span slot="leading-icon" class="material-symbols-outlined">history</span></md-menu-item>
                </md-menu>
              </md-navigation-rail-tab>
              <md-navigation-rail-tab icon="settings" label="${t(globals.locale, 'settings')}" value="settings"></md-navigation-rail-tab>
            </md-navigation-rail>
          </div>
        </div>
      </div>
    </div>
  `,
  play: async ({ canvasElement, step }) => {
    const horiz = canvasElement.querySelector('#rail-horiz') as HTMLElement;
    await waitFor(() => expect(horiz.classList.contains('hydrated')).toBe(true));

    await step('Horizontal lays the destinations in a row and says so', async () => {
      const tabs = [...horiz.querySelectorAll('md-navigation-rail-tab')] as HTMLElement[];
      const a = tabs[0].getBoundingClientRect();
      const b = tabs[1].getBoundingClientRect();
      expect(Math.abs(a.top - b.top)).toBeLessThan(2);
      expect(b.left).toBeGreaterThan(a.right - 1);
      const dest = horiz.shadowRoot!.querySelector('[part="destinations"]') as HTMLElement;
      await waitFor(() => expect(dest.getAttribute('aria-orientation')).toBe('horizontal'));
    });

    await step('A bar destination can open a menu that nests one level further', async () => {
      const trigger = canvasElement.querySelector('#rail-bar-menu') as HTMLElement;
      const menu = trigger.querySelector('md-menu[slot="submenu"]') as HTMLElement & { open: boolean };
      trigger.click();
      await waitFor(() => expect(menu.open).toBe(true));
      const branch = menu.querySelector('md-sub-menu-item') as HTMLElement;
      branch.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      const inner = branch.querySelector('md-menu[slot="submenu"]') as HTMLElement & { open: boolean };
      await waitFor(() => expect(inner.open).toBe(true));
      expect([...inner.querySelectorAll('md-menu-item')]).toHaveLength(2);
      trigger.click(); // close again so it doesn't cover the next step
      await waitFor(() => expect(menu.open).toBe(false));
    });

    await step('Overflow collapses the extras and activating one selects it', async () => {
      const rail = canvasElement.querySelector('#rail-overflow') as HTMLElement & { activeIndex: number };
      await waitFor(() =>
        expect(rail.shadowRoot!.querySelector('.md-navigation-rail__overflow-trigger')).not.toBe(null),
      );
      const trigger = rail.shadowRoot!.querySelector('.md-navigation-rail__overflow-trigger') as HTMLElement;
      expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
      expect(trigger.closest('[role="tablist"]')).toBe(null);
      trigger.click();
      const menu = rail.shadowRoot!.querySelector('md-menu') as HTMLElement & { open: boolean };
      await waitFor(() => expect(menu.open).toBe(true));
      const items = [...menu.querySelectorAll('md-menu-item')] as HTMLElement[];
      items[items.length - 1].click();
      await waitFor(() => expect(rail.activeIndex).toBe(4));
    });

    await step('A destination with a submenu discloses instead of navigating', async () => {
      const rail = canvasElement.querySelector('#rail-submenu') as HTMLElement & { activeIndex: number };
      const trigger = canvasElement.querySelector('#rail-submenu-trigger') as HTMLElement;
      await waitFor(() => expect(trigger.getAttribute('aria-haspopup')).toBe('menu'));
      const before = rail.activeIndex;
      trigger.click();
      const menu = trigger.querySelector('md-menu[slot="submenu"]') as HTMLElement & { open: boolean };
      await waitFor(() => expect(menu.open).toBe(true));
      await waitFor(() => expect(trigger.getAttribute('aria-expanded')).toBe('true'));
      expect(rail.activeIndex).toBe(before);
    });
  },
};

/* ═══════════════════════════════════════════════════════════
   APPLICATION BAR
   The three slots that make a web-app header: brand in `logo`,
   destinations between, signed-in user in `footer`.
   ═══════════════════════════════════════════════════════════ */
export const HorizontalAppBar: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'A horizontal rail used as an application bar. The `logo` slot leads, the destinations region grows to take the space between, and the `footer` slot trails with the signed-in user. The avatar is a real `button` with `aria-haspopup="menu"` that opens an anchored `md-menu` — the rail drops its `isolation: isolate` while any slotted menu is open so the dropdown paints above the page.',
      },
    },
  },
  render: (_args, { globals }) => html`
    <div style="padding: 24px; font-family: sans-serif;">
      <md-navigation-rail
        id="rail-app-bar"
        orientation="horizontal"
        label="${t(globals.locale, 'nav-rail.dashboard')}"
        active-index="0"
      >
        <span slot="logo" style="display: inline-flex; align-items: center; gap: 8px; font-weight: 600;">
          <span class="material-symbols-outlined" style="font-size: 28px; color: var(--md-sys-color-primary);">hexagon</span>
          <span>Acme</span>
        </span>

        <md-navigation-rail-tab icon="home" label="${t(globals.locale, 'home')}" value="home"></md-navigation-rail-tab>
        <md-navigation-rail-tab icon="dashboard" label="${t(globals.locale, 'nav-rail.dashboard')}" value="dashboard"></md-navigation-rail-tab>
        <md-navigation-rail-tab icon="folder" label="${t(globals.locale, 'nav-rail.library')}" value="library"></md-navigation-rail-tab>
        <md-navigation-rail-tab icon="bar_chart" label="${t(globals.locale, 'nav-rail.analytics')}" value="analytics"></md-navigation-rail-tab>

        <div slot="footer">
          <md-icon-button
            id="app-bar-account"
            size="md"
            aria-haspopup="menu"
            aria-label="Ada Lovelace"
            @click=${() => {
              const menu = document.getElementById('app-bar-account-menu') as
                | (HTMLElement & { show: () => void })
                | null;
              menu?.show();
            }}
          >
            <md-avatar name="Ada Lovelace" initials="AL" size="40px"></md-avatar>
          </md-icon-button>
          <md-menu variant="vibrant" id="app-bar-account-menu" anchor="app-bar-account" placement="bottom-end">
            <md-menu-item headline="Ada Lovelace" supporting-text="ada@acme.example">
              <span slot="leading-icon" class="material-symbols-outlined">account_circle</span>
            </md-menu-item>
            <md-divider></md-divider>
            <md-menu-item headline="${t(globals.locale, 'nav-rail.profile')}">
              <span slot="leading-icon" class="material-symbols-outlined">person</span>
            </md-menu-item>
            <md-menu-item headline="${t(globals.locale, 'settings')}">
              <span slot="leading-icon" class="material-symbols-outlined">settings</span>
            </md-menu-item>
            <md-divider></md-divider>
            <md-menu-item headline="${t(globals.locale, 'nav-rail.sign-out')}">
              <span slot="leading-icon" class="material-symbols-outlined">logout</span>
            </md-menu-item>
          </md-menu>
        </div>
      </md-navigation-rail>
    </div>
  `,
  play: async ({ canvasElement, step }) => {
    const rail = canvasElement.querySelector('#rail-app-bar') as HTMLElement;

    await step('Brand leads, destinations take the middle, account trails', async () => {
      const shadow = rail.shadowRoot!;
      const rect = (part: string) =>
        shadow.querySelector(`[part="${part}"]`)?.getBoundingClientRect();

      // Wait for LAYOUT, not just for the nodes: the footer only gets a box once
      // its slotted account button has hydrated, and asserting on the zero-rect
      // in between failed with "expected 0 to be greater than 913".
      await waitFor(() => {
        expect(rect('logo')?.width).toBeGreaterThan(0);
        expect(rect('destinations')?.width).toBeGreaterThan(0);
        expect(rect('footer')?.width).toBeGreaterThan(0);
      });

      const logo = rect('logo')!;
      const dest = rect('destinations')!;
      const footer = rect('footer')!;
      expect(dest.left).toBeGreaterThan(logo.right - 1);
      expect(footer.left).toBeGreaterThan(dest.right - 1);
    });

    await step('The avatar opens the account menu, and the rail stops confining it', async () => {
      const trigger = canvasElement.querySelector('#app-bar-account') as HTMLElement;
      expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
      const menu = canvasElement.querySelector('#app-bar-account-menu') as HTMLElement & {
        open: boolean;
        close: () => Promise<void>;
      };
      trigger.click();
      await waitFor(() => expect(menu.open).toBe(true));
      // isolate would trap the fixed-position menu in the rail's stacking context.
      await waitFor(() => expect(getComputedStyle(rail).isolation).toBe('auto'));
      await menu.close();
      await waitFor(() => expect(menu.open).toBe(false));
      await waitFor(() => expect(getComputedStyle(rail).isolation).toBe('isolate'));
    });
  },
};
