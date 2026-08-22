import type { Meta, StoryObj } from '@storybook/web-components';
import { expect, waitFor } from 'storybook/test';
import { html } from 'lit';
import { t } from '../i18n';

/* ════════════════════════════════════════════════════════════════════
   Shared style helpers — keep stories visually consistent and lightweight
   ════════════════════════════════════════════════════════════════════ */
const sectionLabel = (text: string) => html`
  <h4
    style="
      margin: 0 0 4px;
      font-family: var(--md-sys-typescale-title-small-font-family, system-ui, sans-serif);
      font-size: 14px;
      font-weight: 600;
      color: var(--md-sys-color-on-surface);
    "
  >${text}</h4>
`;

const caption = (text: string) => html`
  <p
    style="
      margin: 0 0 12px;
      font-family: var(--md-sys-typescale-body-small-font-family, system-ui, sans-serif);
      font-size: 12px;
      line-height: 16px;
      color: var(--md-sys-color-on-surface-variant);
    "
  >${text}</p>
`;

/**
 * Mobile-shaped frame to remind authors that md-navigation-bar is bottom-
 * anchored on compact screens. Stories render the bar inside a 360×640
 * "phone" so layout/badges/indicators are seen in their natural context.
 */
const phone = (children: unknown) => html`
  <div
    style="
      width: 360px;
      height: 640px;
      border: 1px solid var(--md-sys-color-outline-variant, #CAC4D0);
      border-radius: 28px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      background: var(--md-sys-color-surface, #FFFBFE);
      box-shadow: var(--md-sys-elevation-1);
    "
  >
    <div style="flex: 1; padding: 16px; overflow-y: auto;">
      <div style="height: 100%; display: flex; align-items: center; justify-content: center;
                  color: var(--md-sys-color-on-surface-variant, #49454F);
                  font-family: var(--md-sys-typescale-body-medium-font-family, system-ui, sans-serif);
                  font-size: 13px;">
        Content area
      </div>
    </div>
    ${children}
  </div>
`;

/* ════════════════════════════════════════════════════════════════════
   play() helpers — testing-library can't cross shadow roots. The bar itself
   is a shadow component, but its destinations are slotted light-DOM
   <md-navigation-tab> children, so plays address them directly. getBar first
   awaits hydration before anything is driven.
   ════════════════════════════════════════════════════════════════════ */
type NavBarEl = HTMLElement & {
  activeIndex: number;
  labelBehavior: 'always' | 'selected' | 'none';
  select(index: number): Promise<void>;
  focusTab(index: number): Promise<void>;
};
type ChangeDetail = { index: number; previousIndex: number };

const getBar = async (canvasElement: HTMLElement): Promise<NavBarEl> => {
  const bar = canvasElement.querySelector('md-navigation-bar') as NavBarEl;
  await waitFor(() => expect(bar.classList.contains('hydrated')).toBe(true));
  return bar;
};
const tabsOf = (bar: NavBarEl) =>
  Array.from(bar.querySelectorAll('md-navigation-tab')) as HTMLElement[];
const focusedTab = (bar: NavBarEl) =>
  bar.ownerDocument.activeElement as HTMLElement;
/** Roving tabindex → exactly one destination should be a tab stop at a time. */
const tabStops = (bar: NavBarEl) =>
  tabsOf(bar).filter((t) => t.getAttribute('tabindex') === '0');
const key = (target: Element, k: string) =>
  target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, composed: true }));

/* ════════════════════════════════════════════════════════════════════
   META
   ════════════════════════════════════════════════════════════════════ */
const meta: Meta = {
  title: 'Navigation/Navigation Bar',
  component: 'md-navigation-bar',
  tags: ['autodocs'],
  parameters: {
    docs: {
      source: { language: 'html' },
      description: {
        component: [
          'Material Design 3 **Navigation Bar** — a bottom-anchored row of',
          '3 – 5 top-level destinations, optimized for compact-width layouts',
          '(mobile). Each destination is an `<md-navigation-tab>` with an icon,',
          'optional label, and optional badge.',
          '',
          'The bar implements:',
          '',
          '- Roving tabindex (single tab-stop, arrow keys move focus)',
          '- Automatic activation by default (or `manual-activation` for Enter-to-commit)',
          '- Home / End to jump to first / last destination',
          '- Three label visibility modes: `always` (default), `selected`, `none`',
          '- RTL-aware arrow direction',
          '- Forced-colors / reduced-motion adaptations',
          '- M3 active-indicator pill, filled-vs-outlined icon variant, badges',
          '',
          'Specs: [overview](https://m3.material.io/components/navigation-bar/overview) ·',
          '[specs](https://m3.material.io/components/navigation-bar/specs) ·',
          '[guidelines](https://m3.material.io/components/navigation-bar/guidelines) ·',
          '[accessibility](https://m3.material.io/components/navigation-bar/accessibility).',
        ].join('\n'),
      },
    },
  },
  argTypes: {
    /* ── Props (md-navigation-bar) ── */
    activeIndex: {
      control: { type: 'number', min: 0, max: 3, step: 1 },
      description: 'Index of the selected destination. Two-way — reflects to `active-index` and writes back on selection.',
      table: { category: 'Props', type: { summary: 'number' }, defaultValue: { summary: '0' } },
    },
    ariaLabel: {
      control: 'text',
      description: 'Accessible name for the `navigation` landmark. The bar has no `label` prop — set `aria-label` directly on the element; it passes through to the host.',
      table: { category: 'Accessibility', type: { summary: 'string (aria-label)' } },
    },
    labelBehavior: {
      control: 'inline-radio',
      options: ['always', 'selected', 'none'],
      description: 'Label visibility for child tabs: show all, only the selected one, or icon-only.',
      table: { category: 'Props', type: { summary: '"always" | "selected" | "none"' }, defaultValue: { summary: 'always' } },
    },
    manualActivation: {
      control: 'boolean',
      description: 'When `true`, arrow keys move focus only and Enter/Space activates. When `false` (default), arrow keys move focus **and** activate.',
      table: { category: 'Props', type: { summary: 'boolean' }, defaultValue: { summary: 'false' } },
    },

    /* ── Playground-only demo toggles (drive the child tabs) ── */
    badgeOnSearch: {
      control: 'inline-radio',
      options: ['none', 'dot', 'count'],
      description: 'Demo: badge on the **Search** tab — `badge` (dot) or `badge-value` (count).',
      table: { category: 'Demo · tabs' },
    },
    profileState: {
      control: 'inline-radio',
      options: ['enabled', 'soft-disabled', 'disabled'],
      description: 'Demo: state of the **Profile** tab. `soft-disabled` stays keyboard-reachable (announced `aria-disabled`); `disabled` is removed from the arrow-key tour.',
      table: { category: 'Demo · tabs' },
    },

    /* ── Events (logged in the Actions panel) ── */
    mdChange: {
      description: 'The bar\'s only event. Selection changed (click, keyboard, or `select()`). `detail: { index, previousIndex }`.',
      table: { category: 'Events', type: { summary: 'CustomEvent<{ index, previousIndex }>' } },
      control: false,
    },
  },
  args: {
    activeIndex: 0,
    ariaLabel: 'Primary navigation',
    labelBehavior: 'always',
    manualActivation: false,
    badgeOnSearch: 'none',
    profileState: 'enabled',
  },
};

export default meta;
type Story = StoryObj;

/* ════════════════════════════════════════════════════════════════════
   1. PLAYGROUND
   ════════════════════════════════════════════════════════════════════ */
export const Playground: Story = {
  render: (args, { globals }) => html`
    ${phone(html`
      <md-navigation-bar
        .activeIndex=${args.activeIndex}
        aria-label=${args.ariaLabel}
        label-behavior=${args.labelBehavior}
        ?manual-activation=${args.manualActivation}
      >
        <md-navigation-tab label=${t(globals.locale, 'home')} icon="home"></md-navigation-tab>
        <md-navigation-tab
          label=${t(globals.locale, 'search')}
          icon="search"
          ?badge=${args.badgeOnSearch === 'dot'}
          badge-value=${args.badgeOnSearch === 'count' ? '3' : ''}
        ></md-navigation-tab>
        <md-navigation-tab label=${t(globals.locale, 'navbar.library')} icon="library_music"></md-navigation-tab>
        <md-navigation-tab
          label=${t(globals.locale, 'navbar.profile')}
          icon="person"
          ?disabled=${args.profileState === 'disabled'}
          ?soft-disabled=${args.profileState === 'soft-disabled'}
        ></md-navigation-tab>
      </md-navigation-bar>
    `)}
  `,
};

/* ════════════════════════════════════════════════════════════════════
   2. DESTINATION COUNT — M3 supports 3–5 destinations
   ════════════════════════════════════════════════════════════════════ */
export const ThreeDestinations: Story = {
  render: (_args, { globals }) => html`
    ${caption('Minimum: three destinations. Each destination claims 1/3 of the bar.')}
    ${phone(html`
      <md-navigation-bar>
        <md-navigation-tab label=${t(globals.locale, 'home')} icon="home"></md-navigation-tab>
        <md-navigation-tab label=${t(globals.locale, 'search')} icon="search"></md-navigation-tab>
        <md-navigation-tab label=${t(globals.locale, 'navbar.profile')} icon="person"></md-navigation-tab>
      </md-navigation-bar>
    `)}
  `,
};

export const FourDestinations: Story = {
  render: (_args, { globals }) => html`
    ${phone(html`
      <md-navigation-bar>
        <md-navigation-tab label=${t(globals.locale, 'home')} icon="home"></md-navigation-tab>
        <md-navigation-tab label=${t(globals.locale, 'search')} icon="search"></md-navigation-tab>
        <md-navigation-tab label=${t(globals.locale, 'navbar.library')} icon="library_music"></md-navigation-tab>
        <md-navigation-tab label=${t(globals.locale, 'navbar.profile')} icon="person"></md-navigation-tab>
      </md-navigation-bar>
    `)}
  `,
};

export const FiveDestinations: Story = {
  render: (_args, { globals }) => html`
    ${caption('Maximum: five destinations. Per M3 guidelines, beyond five use a navigation drawer or rail.')}
    ${phone(html`
      <md-navigation-bar>
        <md-navigation-tab label=${t(globals.locale, 'home')} icon="home"></md-navigation-tab>
        <md-navigation-tab label=${t(globals.locale, 'search')} icon="search"></md-navigation-tab>
        <md-navigation-tab label=${t(globals.locale, 'navbar.library')} icon="library_music"></md-navigation-tab>
        <md-navigation-tab label=${t(globals.locale, 'navbar.inbox')} icon="inbox"></md-navigation-tab>
        <md-navigation-tab label=${t(globals.locale, 'navbar.profile')} icon="person"></md-navigation-tab>
      </md-navigation-bar>
    `)}
  `,
};

/* ════════════════════════════════════════════════════════════════════
   3. LABEL BEHAVIOR
   ════════════════════════════════════════════════════════════════════ */
export const LabelBehaviorAlways: Story = {
  name: 'Label · always (default)',
  render: (_args, { globals }) => html`
    ${caption('Default M3 behavior — every destination shows its label.')}
    ${phone(html`
      <md-navigation-bar label-behavior="always">
        <md-navigation-tab label=${t(globals.locale, 'home')} icon="home"></md-navigation-tab>
        <md-navigation-tab label=${t(globals.locale, 'search')} icon="search"></md-navigation-tab>
        <md-navigation-tab label=${t(globals.locale, 'navbar.library')} icon="library_music"></md-navigation-tab>
        <md-navigation-tab label=${t(globals.locale, 'navbar.profile')} icon="person"></md-navigation-tab>
      </md-navigation-bar>
    `)}
  `,
  /** The bar propagates its label-behavior to child tabs that lack an explicit
   *  override, and the @Watch re-propagates when the prop changes at runtime. */
  play: async ({ canvasElement, step }) => {
    const bar = await getBar(canvasElement);
    const tabs = tabsOf(bar);
    await waitFor(() => expect(tabs.every((tb) => tb.classList.contains('hydrated'))).toBe(true));

    await step('Baseline: child tabs inherit the bar\'s "always" label-behavior', async () => {
      await waitFor(() => expect(
        tabs.every((tb) => tb.getAttribute('data-md-inherited-label-behavior') === 'always'),
      ).toBe(true));
    });

    await step('Changing label-behavior at runtime re-propagates to every child tab', async () => {
      bar.labelBehavior = 'none'; // fires the @Watch → propagateLabelBehavior on each tab
      await waitFor(() => expect(
        tabs.every((tb) => tb.getAttribute('data-md-inherited-label-behavior') === 'none'),
      ).toBe(true));
    });
  },
};

export const LabelBehaviorSelected: Story = {
  name: 'Label · selected only',
  render: (_args, { globals }) => html`
    ${caption('Only the active destination shows its label — inactive labels stay reserved in the layout but visually hidden so heights stay constant.')}
    ${phone(html`
      <md-navigation-bar label-behavior="selected">
        <md-navigation-tab label=${t(globals.locale, 'home')} icon="home"></md-navigation-tab>
        <md-navigation-tab label=${t(globals.locale, 'search')} icon="search"></md-navigation-tab>
        <md-navigation-tab label=${t(globals.locale, 'navbar.library')} icon="library_music"></md-navigation-tab>
        <md-navigation-tab label=${t(globals.locale, 'navbar.profile')} icon="person"></md-navigation-tab>
      </md-navigation-bar>
    `)}
  `,
};

export const LabelBehaviorNone: Story = {
  name: 'Label · none (icon-only)',
  render: (_args, { globals }) => html`
    ${caption('Icon-only mode. The label is still exposed to assistive technology via `aria-label`.')}
    ${phone(html`
      <md-navigation-bar label-behavior="none">
        <md-navigation-tab label=${t(globals.locale, 'home')} icon="home"></md-navigation-tab>
        <md-navigation-tab label=${t(globals.locale, 'search')} icon="search"></md-navigation-tab>
        <md-navigation-tab label=${t(globals.locale, 'navbar.library')} icon="library_music"></md-navigation-tab>
        <md-navigation-tab label=${t(globals.locale, 'navbar.profile')} icon="person"></md-navigation-tab>
      </md-navigation-bar>
    `)}
  `,
};

/* ════════════════════════════════════════════════════════════════════
   4. BADGES
   ════════════════════════════════════════════════════════════════════ */
export const WithBadges: Story = {
  render: (_args, { globals }) => html`
    ${caption('Two badge flavors per M3: small dot (presence) and large pill (count or text). Badges are exposed via `role="status"` with a localized accessible label.')}
    ${phone(html`
      <md-navigation-bar>
        <md-navigation-tab label=${t(globals.locale, 'home')} icon="home" active-icon="home"></md-navigation-tab>
        <md-navigation-tab label=${t(globals.locale, 'navbar.messages')} icon="chat" badge-value="3"></md-navigation-tab>
        <md-navigation-tab label=${t(globals.locale, 'navbar.notifications')} icon="notifications" badge></md-navigation-tab>
        <md-navigation-tab label=${t(globals.locale, 'navbar.profile')} icon="person"></md-navigation-tab>
      </md-navigation-bar>
    `)}
  `,
};

export const BadgeOverflow: Story = {
  render: (_args, { globals }) => html`
    ${caption('Numeric badges are capped at `badge-max` (default 999). Values above the cap render as "max+".')}
    ${phone(html`
      <md-navigation-bar>
        <md-navigation-tab label=${t(globals.locale, 'navbar.inbox')} icon="inbox" badge-value="1500"></md-navigation-tab>
        <md-navigation-tab label=${t(globals.locale, 'navbar.comments')} icon="forum" badge-value="42"></md-navigation-tab>
        <md-navigation-tab label=${t(globals.locale, 'navbar.drafts')} icon="drafts" badge-value="9"></md-navigation-tab>
        <md-navigation-tab label=${t(globals.locale, 'navbar.spam')} icon="report" badge-value=${t(globals.locale, 'navbar.new')}></md-navigation-tab>
      </md-navigation-bar>
    `)}
  `,
};

/* ════════════════════════════════════════════════════════════════════
   5. ACTIVE-ICON VARIANT (outlined → filled)
   ════════════════════════════════════════════════════════════════════ */
export const ActiveIconFilled: Story = {
  name: 'Active icon variant (outlined → filled)',
  render: (_args, { globals }) => html`
    ${caption('Per M3 spec, inactive destinations use the outlined icon and active destinations switch to the filled variant. Pass both names — the component swaps automatically. With Material Symbols variable font the FILL axis is also toggled.')}
    ${phone(html`
      <md-navigation-bar>
        <md-navigation-tab label=${t(globals.locale, 'home')} icon="home" active-icon="home"></md-navigation-tab>
        <md-navigation-tab label=${t(globals.locale, 'navbar.favorites')} icon="favorite" active-icon="favorite"></md-navigation-tab>
        <md-navigation-tab label=${t(globals.locale, 'settings')} icon="settings" active-icon="settings"></md-navigation-tab>
      </md-navigation-bar>
    `)}
  `,
};

/* ════════════════════════════════════════════════════════════════════
   6. DISABLED DESTINATION
   ════════════════════════════════════════════════════════════════════ */
export const DisabledDestination: Story = {
  render: (_args, { globals }) => html`
    ${caption('Disabled destinations are skipped by arrow-key navigation and ignored by click. The bar exposes `aria-disabled="true"` so assistive tech surfaces the state.')}
    ${phone(html`
      <md-navigation-bar>
        <md-navigation-tab label=${t(globals.locale, 'home')} icon="home"></md-navigation-tab>
        <md-navigation-tab label=${t(globals.locale, 'search')} icon="search" disabled></md-navigation-tab>
        <md-navigation-tab label=${t(globals.locale, 'navbar.library')} icon="library_music"></md-navigation-tab>
        <md-navigation-tab label=${t(globals.locale, 'navbar.profile')} icon="person"></md-navigation-tab>
      </md-navigation-bar>
    `)}
  `,
  /** select() targeting the disabled tab clamps FORWARD to the next enabled one;
   *  focusTab() refuses the hard-disabled tab but focuses an enabled one without selecting. */
  play: async ({ canvasElement, step }) => {
    const bar = await getBar(canvasElement);
    const tabs = tabsOf(bar); // 0 home, 1 search(disabled), 2 library, 3 profile
    await waitFor(() => expect(tabs.every((tb) => tb.classList.contains('hydrated'))).toBe(true));

    await step('select() on a disabled destination clamps forward to the next enabled tab', async () => {
      expect(tabs[1].getAttribute('aria-disabled')).toBe('true'); // search is disabled
      let detail: ChangeDetail | undefined;
      bar.addEventListener('mdChange', (e) => { detail = (e as CustomEvent<ChangeDetail>).detail; }, { once: true });
      await bar.select(1); // request the disabled tab → forward-clamp to library (2)
      await waitFor(() => expect(bar.activeIndex).toBe(2));
      expect(detail).toEqual({ index: 2, previousIndex: 0 });
      expect(tabs[2].getAttribute('aria-selected')).toBe('true');
      expect(tabs[1].getAttribute('aria-selected')).toBe('false');
    });

    await step('focusTab() ignores a hard-disabled tab but focuses an enabled one without selecting', async () => {
      tabs[0].focus();
      expect(focusedTab(bar)).toBe(tabs[0]);
      await bar.focusTab(1); // hard-disabled → no-op, focus must not move
      expect(focusedTab(bar)).toBe(tabs[0]);
      await bar.focusTab(3); // enabled → focus moves, but selection stays put
      await waitFor(() => expect(focusedTab(bar)).toBe(tabs[3]));
      expect(bar.activeIndex).toBe(2);
      expect(tabs[3].getAttribute('aria-selected')).toBe('false');
    });

    await step('focusTab() with an out-of-range index is a safe no-op (no such tab → !t guard)', async () => {
      tabs[0].focus();
      expect(focusedTab(bar)).toBe(tabs[0]);
      await bar.focusTab(99); // this.tabs[99] is undefined → !t short-circuits, focus must not move
      expect(focusedTab(bar)).toBe(tabs[0]);
      expect(bar.activeIndex).toBe(2); // selection also untouched
    });
  },
};

/* ════════════════════════════════════════════════════════════════════
   6b. SOFT-DISABLED DESTINATION
   ════════════════════════════════════════════════════════════════════ */
export const SoftDisabled: Story = {
  name: 'Soft-disabled destination',
  parameters: {
    docs: {
      description: {
        story:
          'A **soft-disabled** destination (`soft-disabled`) cannot be activated ' +
          'or selected, but — unlike hard `disabled` — it stays in the arrow-key ' +
          'tour and is announced as `aria-disabled="true"`. Keyboard / screen-reader ' +
          'users can land on it (focus ring shows) to discover a temporarily ' +
          'unavailable destination, while pointer clicks are ignored. Compare ' +
          'Library (hard `disabled`, skipped entirely) with Profile (`soft-disabled`, ' +
          'reachable but inert).',
      },
    },
  },
  render: (_args, { globals }) => html`
    ${caption('Tab into the bar, then press → / ← . Focus stops on **Profile** (soft-disabled, reachable but not activatable) but skips **Library** (hard-disabled).')}
    ${phone(html`
      <md-navigation-bar aria-label="Soft vs hard disabled">
        <md-navigation-tab label=${t(globals.locale, 'home')} icon="home"></md-navigation-tab>
        <md-navigation-tab label=${t(globals.locale, 'search')} icon="search"></md-navigation-tab>
        <md-navigation-tab label=${t(globals.locale, 'navbar.library')} icon="library_music" disabled></md-navigation-tab>
        <md-navigation-tab label=${t(globals.locale, 'navbar.profile')} icon="person" soft-disabled></md-navigation-tab>
      </md-navigation-bar>
    `)}
  `,
  /** With a run of unselectable tail tabs, select() clamps BACKWARD to the nearest
   *  enabled tab; focusTab() may still land on a soft-disabled tab (reachable, inert). */
  play: async ({ canvasElement, step }) => {
    const bar = await getBar(canvasElement);
    const tabs = tabsOf(bar); // 0 home, 1 search, 2 library(hard), 3 profile(soft)
    await waitFor(() => expect(tabs.every((tb) => tb.classList.contains('hydrated'))).toBe(true));

    await step('select() on a disabled tail clamps backward to the nearest enabled tab', async () => {
      // library(2, hard) and profile(3, soft) are both unselectable → forward finds
      // nothing, so the bar must clamp BACKWARD to search(1).
      expect(tabs[2].getAttribute('aria-disabled')).toBe('true');
      expect(tabs[3].getAttribute('aria-disabled')).toBe('true');
      let detail: ChangeDetail | undefined;
      bar.addEventListener('mdChange', (e) => { detail = (e as CustomEvent<ChangeDetail>).detail; }, { once: true });
      await bar.select(2);
      await waitFor(() => expect(bar.activeIndex).toBe(1));
      expect(detail).toEqual({ index: 1, previousIndex: 0 });
      expect(tabs[1].getAttribute('aria-selected')).toBe('true');
    });

    await step('focusTab() lands on a soft-disabled destination (reachable, never selected)', async () => {
      const activeBefore = bar.activeIndex; // 1
      await bar.focusTab(3); // soft-disabled is NOT hard-disabled → still focusable
      await waitFor(() => expect(focusedTab(bar)).toBe(tabs[3]));
      expect(bar.activeIndex).toBe(activeBefore); // focus never selects
      expect(tabs[3].getAttribute('aria-selected')).toBe('false');
    });
  },
};

/* ════════════════════════════════════════════════════════════════════
   7. CONTROLLED EXAMPLE
   ════════════════════════════════════════════════════════════════════ */
export const Controlled: Story = {
  render: (_args, { globals }) => {
    const id = `ctrl-${Math.random().toString(36).slice(2, 7)}`;
    return html`
      ${caption('External state drives `active-index`. Listen to `mdChange` to keep your model in sync.')}
      <div id=${`${id}-status`}
           style="margin-bottom: 12px;
                  font-family: var(--md-sys-typescale-label-medium-font-family, system-ui, sans-serif);
                  font-size: 13px;
                  color: var(--md-sys-color-on-surface);">
        Selected: <strong>0</strong> (${t(globals.locale, 'home')})
      </div>
      ${phone(html`
        <md-navigation-bar
          id=${id}
          @mdChange=${(e: CustomEvent<{ index: number; previousIndex: number }>) => {
            const status = document.getElementById(`${id}-status`);
            const names = [t(globals.locale, 'home'), t(globals.locale, 'search'), t(globals.locale, 'navbar.library'), t(globals.locale, 'navbar.profile')];
            if (status) {
              status.innerHTML =
                `Selected: <strong>${e.detail.index}</strong> (${names[e.detail.index]})`;
            }
          }}
        >
          <md-navigation-tab label=${t(globals.locale, 'home')} icon="home"></md-navigation-tab>
          <md-navigation-tab label=${t(globals.locale, 'search')} icon="search"></md-navigation-tab>
          <md-navigation-tab label=${t(globals.locale, 'navbar.library')} icon="library_music"></md-navigation-tab>
          <md-navigation-tab label=${t(globals.locale, 'navbar.profile')} icon="person"></md-navigation-tab>
        </md-navigation-bar>
      `)}
    `;
  },
  /** Controlled: writing `active-index` externally drives the selection and
   *  emits mdChange to host listeners; out-of-range writes are clamped. */
  play: async ({ canvasElement, step }) => {
    const bar = await getBar(canvasElement);
    const tabs = tabsOf(bar);
    const status = bar.ownerDocument.getElementById(`${bar.id}-status`)!;

    await step('Baseline: external state shows Home (index 0) selected', async () => {
      expect(bar.activeIndex).toBe(0);
      expect(tabs[0].getAttribute('aria-selected')).toBe('true');
      expect(status.textContent).toContain('Home');
      expect(status.textContent).not.toContain('Library');
    });

    await step('Writing active-index drives selection and emits mdChange to the host', async () => {
      let detail: ChangeDetail | undefined;
      bar.addEventListener('mdChange', (e) => { detail = (e as CustomEvent<ChangeDetail>).detail; }, { once: true });
      bar.activeIndex = 2; // external / controlled write
      await waitFor(() => expect(detail).toEqual({ index: 2, previousIndex: 0 }));
      await waitFor(() => expect(tabs[2].getAttribute('aria-selected')).toBe('true'));
      expect(tabs[0].getAttribute('aria-selected')).toBe('false');
      // The story's own mdChange handler rewrote the status line — proof a real
      // event reached external listeners, not just an internal DOM mutation.
      await waitFor(() => expect(status.textContent).toContain('Library'));
    });

    await step('Guard: an out-of-range write is clamped to the nearest enabled destination', async () => {
      const last = tabs.length - 1;
      bar.activeIndex = 99;
      await waitFor(() => expect(bar.activeIndex).toBe(last)); // component clamped 99 → last
      await waitFor(() => expect(bar.getAttribute('active-index')).toBe(String(last)));
      expect(tabs[last].getAttribute('aria-selected')).toBe('true');
    });

    await step('select() method moves to another enabled destination and emits mdChange', async () => {
      const before = bar.activeIndex; // last (3)
      let detail: ChangeDetail | undefined;
      bar.addEventListener('mdChange', (e) => { detail = (e as CustomEvent<ChangeDetail>).detail; }, { once: true });
      await bar.select(1); // programmatic selection via the public @Method
      await waitFor(() => expect(detail).toEqual({ index: 1, previousIndex: before }));
      await waitFor(() => expect(bar.activeIndex).toBe(1));
      await waitFor(() => expect(bar.getAttribute('active-index')).toBe('1')); // two-way write-back reflected
      expect(tabs[1].getAttribute('aria-selected')).toBe('true');
      expect(tabs[before].getAttribute('aria-selected')).toBe('false');
    });

    await step('Guard: select() on the already-active destination is a no-op (no mdChange)', async () => {
      let fired = false;
      bar.addEventListener('mdChange', () => { fired = true; }, { once: true });
      await bar.select(bar.activeIndex); // clamped === active → early return, no event
      await new Promise((r) => setTimeout(r, 50));
      expect(fired).toBe(false);
      expect(bar.activeIndex).toBe(1);
    });

    await step('Pointer click on a destination activates it (handleTabClick) and notifies the host', async () => {
      const before = bar.activeIndex; // 1 (search)
      let detail: ChangeDetail | undefined;
      bar.addEventListener('mdChange', (e) => { detail = (e as CustomEvent<ChangeDetail>).detail; }, { once: true });
      tabs[3].click(); // real pointer activation → tab emits mdTabClick, bubbles to the bar
      await waitFor(() => expect(detail).toEqual({ index: 3, previousIndex: before }));
      await waitFor(() => expect(bar.activeIndex).toBe(3));
      expect(tabs[3].getAttribute('aria-selected')).toBe('true');
      expect(tabs[before].getAttribute('aria-selected')).toBe('false');
      // The story's own @mdChange handler rewrote the status line — proof the click's
      // event reached external listeners, not just an internal DOM mutation.
      await waitFor(() => expect(status.textContent).toContain('Profile'));
    });

    await step('Guard: clicking the already-active destination is a no-op (no mdChange)', async () => {
      let fired = false;
      bar.addEventListener('mdChange', () => { fired = true; }, { once: true });
      tabs[3].click(); // index === activeIndex → handleTabClick early-returns before emitting
      await new Promise((r) => setTimeout(r, 50));
      expect(fired).toBe(false);
      expect(bar.activeIndex).toBe(3);
    });
  },
};

/* ════════════════════════════════════════════════════════════════════
   8. KEYBOARD CHEAT SHEET
   ════════════════════════════════════════════════════════════════════ */
export const Keyboard: Story = {
  render: (_args, { globals }) => html`
    ${sectionLabel('Keyboard support')}
    ${caption('Click the first destination and use the keyboard to test.')}
    <table style="
      margin: 0 0 16px;
      border-collapse: collapse;
      font-family: var(--md-sys-typescale-body-small-font-family, system-ui, sans-serif);
      font-size: 12px;
      color: var(--md-sys-color-on-surface);
    ">
      <tbody>
        <tr><td style="padding: 4px 12px 4px 0;"><kbd>←</kbd> / <kbd>→</kbd></td><td>Move focus to the previous / next destination (wraps).</td></tr>
        <tr><td style="padding: 4px 12px 4px 0;"><kbd>Home</kbd> / <kbd>End</kbd></td><td>Jump to first / last destination.</td></tr>
        <tr><td style="padding: 4px 12px 4px 0;"><kbd>Enter</kbd> / <kbd>Space</kbd></td><td>Activate the focused destination.</td></tr>
        <tr><td style="padding: 4px 12px 4px 0;"><kbd>Tab</kbd></td><td>Leave the bar (single tab-stop = the active destination).</td></tr>
      </tbody>
    </table>
    ${phone(html`
      <md-navigation-bar>
        <md-navigation-tab label=${t(globals.locale, 'home')} icon="home"></md-navigation-tab>
        <md-navigation-tab label=${t(globals.locale, 'search')} icon="search"></md-navigation-tab>
        <md-navigation-tab label=${t(globals.locale, 'navbar.library')} icon="library_music"></md-navigation-tab>
        <md-navigation-tab label=${t(globals.locale, 'navbar.profile')} icon="person"></md-navigation-tab>
      </md-navigation-bar>
    `)}
  `,
  /** Automatic activation: arrow keys move focus AND commit selection (event +
   *  transition), Home/End jump, and re-activating the current tab is a no-op. */
  play: async ({ canvasElement, step }) => {
    const bar = await getBar(canvasElement);
    const tabs = tabsOf(bar);

    await step('Baseline: roving tabindex — one stop, on the active destination', async () => {
      await waitFor(() => expect(tabs.every((t) => t.classList.contains('hydrated'))).toBe(true));
      expect(bar.activeIndex).toBe(0);
      expect(tabStops(bar).length).toBe(1);
      expect(tabs[0].getAttribute('aria-selected')).toBe('true');
      tabs[0].focus();
      expect(focusedTab(bar)).toBe(tabs[0]);
    });

    await step('ArrowRight moves focus AND auto-activates the next destination', async () => {
      const fromIndex = bar.activeIndex;
      let detail: ChangeDetail | undefined;
      bar.addEventListener('mdChange', (e) => { detail = (e as CustomEvent<ChangeDetail>).detail; }, { once: true });
      key(focusedTab(bar), 'ArrowRight');
      await waitFor(() => expect(focusedTab(bar)).toBe(tabs[1]));        // focus MOVED
      await waitFor(() => expect(bar.activeIndex).not.toBe(fromIndex));  // selection CHANGED
      expect(bar.activeIndex).toBe(1);
      expect(detail).toEqual({ index: 1, previousIndex: 0 });           // event payload
      await waitFor(() => expect(tabs[1].getAttribute('aria-selected')).toBe('true'));
      expect(tabs[0].getAttribute('aria-selected')).toBe('false');
      expect(tabStops(bar).length).toBe(1);                             // roving stop followed
    });

    await step('End jumps to and activates the last destination', async () => {
      let detail: ChangeDetail | undefined;
      bar.addEventListener('mdChange', (e) => { detail = (e as CustomEvent<ChangeDetail>).detail; }, { once: true });
      key(focusedTab(bar), 'End');
      const last = tabs.length - 1;
      await waitFor(() => expect(focusedTab(bar)).toBe(tabs[last]));
      expect(bar.activeIndex).toBe(last);
      expect(detail).toEqual({ index: last, previousIndex: 1 });
    });

    await step('Guard: Enter on the already-active destination is a no-op (no mdChange)', async () => {
      const activeBefore = bar.activeIndex;
      let fired = false;
      bar.addEventListener('mdChange', () => { fired = true; }, { once: true });
      key(focusedTab(bar), 'Enter');
      await new Promise((r) => setTimeout(r, 50));
      expect(fired).toBe(false);
      expect(bar.activeIndex).toBe(activeBefore);
    });

    await step('Home jumps to and activates the first destination', async () => {
      const from = bar.activeIndex; // last
      let detail: ChangeDetail | undefined;
      bar.addEventListener('mdChange', (e) => { detail = (e as CustomEvent<ChangeDetail>).detail; }, { once: true });
      key(focusedTab(bar), 'Home');
      await waitFor(() => expect(focusedTab(bar)).toBe(tabs[0]));
      expect(bar.activeIndex).toBe(0);
      expect(detail).toEqual({ index: 0, previousIndex: from });
      await waitFor(() => expect(tabs[0].getAttribute('aria-selected')).toBe('true'));
      expect(tabStops(bar).length).toBe(1);                             // roving stop followed
    });

    await step('ArrowLeft from the first destination wraps backward to the last', async () => {
      const last = tabs.length - 1;
      let detail: ChangeDetail | undefined;
      bar.addEventListener('mdChange', (e) => { detail = (e as CustomEvent<ChangeDetail>).detail; }, { once: true });
      key(focusedTab(bar), 'ArrowLeft');
      await waitFor(() => expect(focusedTab(bar)).toBe(tabs[last]));    // wrapped past index 0
      expect(bar.activeIndex).toBe(last);
      expect(detail).toEqual({ index: last, previousIndex: 0 });
      await waitFor(() => expect(tabs[last].getAttribute('aria-selected')).toBe('true'));
      expect(tabs[0].getAttribute('aria-selected')).toBe('false');
    });
  },
};

export const ManualActivation: Story = {
  render: (_args, { globals }) => html`
    ${caption('With `manual-activation`, arrow keys move focus without activating. Press Enter or Space to commit. Useful when activation has cost (a destructive operation, expensive route load, etc).')}
    ${phone(html`
      <md-navigation-bar manual-activation>
        <md-navigation-tab label=${t(globals.locale, 'home')} icon="home"></md-navigation-tab>
        <md-navigation-tab label=${t(globals.locale, 'search')} icon="search"></md-navigation-tab>
        <md-navigation-tab label=${t(globals.locale, 'navbar.library')} icon="library_music"></md-navigation-tab>
        <md-navigation-tab label=${t(globals.locale, 'navbar.profile')} icon="person"></md-navigation-tab>
      </md-navigation-bar>
    `)}
  `,
  /** Manual activation: arrow keys move focus but must NOT commit until the
   *  user presses Enter/Space — the guard, then the commit. */
  play: async ({ canvasElement, step }) => {
    const bar = await getBar(canvasElement);
    const tabs = tabsOf(bar);

    await step('Baseline: manual activation, first destination selected', async () => {
      await waitFor(() => expect(tabs.every((t) => t.classList.contains('hydrated'))).toBe(true));
      expect(bar.activeIndex).toBe(0);
      expect(tabs[0].getAttribute('aria-selected')).toBe('true');
      tabs[0].focus();
      expect(focusedTab(bar)).toBe(tabs[0]);
    });

    await step('Guard: ArrowRight moves focus only — it does NOT activate', async () => {
      const before = focusedTab(bar);
      let fired = false;
      bar.addEventListener('mdChange', () => { fired = true; }, { once: true });
      key(before, 'ArrowRight');
      await waitFor(() => expect(focusedTab(bar)).not.toBe(before)); // focus MOVED
      expect(focusedTab(bar)).toBe(tabs[1]);
      await new Promise((r) => setTimeout(r, 50));
      expect(fired).toBe(false);                                    // nothing committed
      expect(bar.activeIndex).toBe(0);
      expect(tabs[1].hasAttribute('active')).toBe(false);
      expect(tabs[0].getAttribute('aria-selected')).toBe('true');   // selection unchanged
    });

    await step('Enter commits the focused destination (fires mdChange)', async () => {
      let detail: ChangeDetail | undefined;
      bar.addEventListener('mdChange', (e) => { detail = (e as CustomEvent<ChangeDetail>).detail; }, { once: true });
      key(tabs[1], 'Enter');
      await waitFor(() => expect(detail).toBeDefined());
      expect(detail).toEqual({ index: 1, previousIndex: 0 });
      await waitFor(() => expect(tabs[1].getAttribute('aria-selected')).toBe('true'));
      expect(tabs[0].getAttribute('aria-selected')).toBe('false');
      expect(bar.activeIndex).toBe(1);
    });
  },
};

/* ════════════════════════════════════════════════════════════════════
   9. RTL
   ════════════════════════════════════════════════════════════════════ */
export const RTL: Story = {
  render: () => html`
    ${caption('RTL — arrow direction is mirrored: ArrowLeft moves to the next destination, ArrowRight to the previous.')}
    <div dir="rtl">
      ${phone(html`
        <md-navigation-bar aria-label="التنقل الرئيسي">
          <md-navigation-tab label="الرئيسية" icon="home"></md-navigation-tab>
          <md-navigation-tab label="بحث" icon="search"></md-navigation-tab>
          <md-navigation-tab label="المكتبة" icon="library_music"></md-navigation-tab>
          <md-navigation-tab label="ملفي" icon="person"></md-navigation-tab>
        </md-navigation-bar>
      `)}
    </div>
  `,
  /** In RTL the arrow direction mirrors: ArrowLeft moves toward the inline-end
   *  (forward), ArrowRight toward the inline-start (backward). Exercises the
   *  `getComputedStyle(el).direction === 'rtl'` branch of the keyboard handler. */
  play: async ({ canvasElement, step }) => {
    const bar = await getBar(canvasElement);
    const tabs = tabsOf(bar);
    await waitFor(() => expect(tabs.every((tb) => tb.classList.contains('hydrated'))).toBe(true));

    await step('Baseline: the bar computes an RTL direction and starts on the first destination', async () => {
      await waitFor(() => expect(getComputedStyle(bar).direction).toBe('rtl'));
      expect(bar.activeIndex).toBe(0);
      tabs[0].focus();
      expect(focusedTab(bar)).toBe(tabs[0]);
    });

    await step('RTL: ArrowLeft is FORWARD — moves focus and activates the next destination', async () => {
      let detail: ChangeDetail | undefined;
      bar.addEventListener('mdChange', (e) => { detail = (e as CustomEvent<ChangeDetail>).detail; }, { once: true });
      key(focusedTab(bar), 'ArrowLeft'); // forward under RTL
      await waitFor(() => expect(focusedTab(bar)).toBe(tabs[1]));
      await waitFor(() => expect(bar.activeIndex).toBe(1));
      expect(detail).toEqual({ index: 1, previousIndex: 0 });
      await waitFor(() => expect(tabs[1].getAttribute('aria-selected')).toBe('true'));
      expect(tabs[0].getAttribute('aria-selected')).toBe('false');
      expect(tabStops(bar).length).toBe(1); // roving stop followed
    });

    await step('RTL: ArrowRight is BACKWARD — moves focus and activation back to the first destination', async () => {
      let detail: ChangeDetail | undefined;
      bar.addEventListener('mdChange', (e) => { detail = (e as CustomEvent<ChangeDetail>).detail; }, { once: true });
      key(focusedTab(bar), 'ArrowRight'); // backward under RTL
      await waitFor(() => expect(focusedTab(bar)).toBe(tabs[0]));
      await waitFor(() => expect(bar.activeIndex).toBe(0));
      expect(detail).toEqual({ index: 0, previousIndex: 1 });
      await waitFor(() => expect(tabs[0].getAttribute('aria-selected')).toBe('true'));
    });
  },
};

/* ════════════════════════════════════════════════════════════════════
   10. DARK THEME
   ════════════════════════════════════════════════════════════════════ */
export const DarkTheme: Story = {
  render: (_args, { globals }) => html`
    <div data-theme="dark"
         style="background: var(--md-sys-color-surface, #141218); padding: 24px; border-radius: 16px;">
      ${phone(html`
        <md-navigation-bar>
          <md-navigation-tab label=${t(globals.locale, 'home')} icon="home" active-icon="home"></md-navigation-tab>
          <md-navigation-tab label=${t(globals.locale, 'search')} icon="search"></md-navigation-tab>
          <md-navigation-tab label=${t(globals.locale, 'navbar.library')} icon="library_music" badge-value="2"></md-navigation-tab>
          <md-navigation-tab label=${t(globals.locale, 'navbar.profile')} icon="person" badge></md-navigation-tab>
        </md-navigation-bar>
      `)}
    </div>
  `,
};

/* ════════════════════════════════════════════════════════════════════
   11. CUSTOM TOKENS — custom properties + parts
   ════════════════════════════════════════════════════════════════════ */
export const CustomTokens: Story = {
  render: (_args, { globals }) => html`
    <style>
      .branded {
        --md-navigation-bar-container-color: #1B5E20;
        --md-navigation-tab-active-indicator-color: #A5D6A7;
        --md-navigation-tab-active-icon-color: #1B5E20;
        --md-navigation-tab-inactive-icon-color: #C8E6C9;
        --md-navigation-tab-active-label-color: #E8F5E9;
        --md-navigation-tab-inactive-label-color: #C8E6C9;
        --md-navigation-bar-divider-color: rgba(255,255,255,0.12);
        --md-navigation-bar-divider-width: 1px;
      }
      .pill-indicator::part(indicator) {
        background: linear-gradient(135deg, #6750A4, #B69DF8);
      }
      .center-label::part(label) {
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
    </style>
    ${sectionLabel('Per-instance branding via CSS custom properties')}
    ${phone(html`
      <md-navigation-bar class="branded" aria-label="Branded navigation">
        <md-navigation-tab label=${t(globals.locale, 'home')} icon="home" active-icon="home"></md-navigation-tab>
        <md-navigation-tab label=${t(globals.locale, 'search')} icon="search"></md-navigation-tab>
        <md-navigation-tab label=${t(globals.locale, 'navbar.library')} icon="library_music"></md-navigation-tab>
        <md-navigation-tab label=${t(globals.locale, 'navbar.profile')} icon="person"></md-navigation-tab>
      </md-navigation-bar>
    `)}
    ${sectionLabel('Restyling via CSS Shadow Parts')}
    ${phone(html`
      <md-navigation-bar>
        <md-navigation-tab class="pill-indicator center-label" label=${t(globals.locale, 'home')} icon="home" active></md-navigation-tab>
        <md-navigation-tab class="pill-indicator center-label" label=${t(globals.locale, 'search')} icon="search"></md-navigation-tab>
        <md-navigation-tab class="pill-indicator center-label" label=${t(globals.locale, 'navbar.library')} icon="library_music"></md-navigation-tab>
        <md-navigation-tab class="pill-indicator center-label" label=${t(globals.locale, 'navbar.profile')} icon="person"></md-navigation-tab>
      </md-navigation-bar>
    `)}
  `,
};

/* ════════════════════════════════════════════════════════════════════
   12. CUSTOM-ICON SLOTS — bring your own SVG / emoji
   ════════════════════════════════════════════════════════════════════ */
export const CustomIconSlots: Story = {
  render: (_args, { globals }) => html`
    ${caption('Slot named `icon` / `active-icon` to render any element (SVG, emoji, custom font) in place of Material Symbols.')}
    ${phone(html`
      <md-navigation-bar>
        <md-navigation-tab label=${t(globals.locale, 'navbar.star')} active>
          <span slot="icon">★</span>
          <span slot="active-icon">★</span>
        </md-navigation-tab>
        <md-navigation-tab label=${t(globals.locale, 'navbar.heart')}>
          <svg slot="icon" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
          <svg slot="active-icon" viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
        </md-navigation-tab>
        <md-navigation-tab label=${t(globals.locale, 'navbar.smile')}>
          <span slot="icon">🙂</span>
          <span slot="active-icon">😄</span>
        </md-navigation-tab>
      </md-navigation-bar>
    `)}
  `,
};

/* ════════════════════════════════════════════════════════════════════
   14. LOCALIZATION — per-locale labels + RTL mirroring
   ════════════════════════════════════════════════════════════════════ */
export const Localization: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Pass localized <code>label</code> props per tab and a localized ' +
          '<code>label</code> on the bar (the landmark name). Wrap each bar in ' +
          '<code>lang</code> + <code>dir</code> so screen readers pronounce labels ' +
          'correctly and the arrow-key direction + layout mirror in RTL locales ' +
          '(→ moves toward the inline-end).',
      },
    },
  },
  render: () => {
    const rows = [
      { code: 'en', dir: 'ltr', name: 'English',  bar: 'Primary',  home: 'Home',    search: 'Search',   library: 'Library',  profile: 'Profile' },
      { code: 'fr', dir: 'ltr', name: 'Français', bar: 'Principal', home: 'Accueil', search: 'Recherche', library: 'Bibliothèque', profile: 'Profil' },
      { code: 'de', dir: 'ltr', name: 'Deutsch',  bar: 'Primär',    home: 'Start',   search: 'Suche',    library: 'Mediathek', profile: 'Profil' },
      { code: 'ja', dir: 'ltr', name: '日本語',     bar: 'メイン',      home: 'ホーム',    search: '検索',      library: 'ライブラリ', profile: 'プロフィール' },
      { code: 'ar', dir: 'rtl', name: 'العربية',   bar: 'الرئيسية',  home: 'الرئيسية', search: 'بحث',      library: 'المكتبة',  profile: 'الملف' },
      { code: 'he', dir: 'rtl', name: 'עברית',    bar: 'ראשי',      home: 'בית',     search: 'חיפוש',     library: 'ספרייה',   profile: 'פרופיל' },
    ];
    return html`
      <style>
        .nav-l10n { padding: 24px; font-family: Roboto, sans-serif; }
        .nav-l10n .row {
          display: flex; align-items: center; gap: 24px;
          padding-block: 16px; border-block-end: 1px solid var(--md-sys-color-outline-variant, #e7e0ec);
        }
        .nav-l10n .info { flex: 0 0 140px; display: flex; align-items: baseline; gap: 8px; }
        .nav-l10n .code { color: var(--md-sys-color-primary, #6750a4); font-weight: 600; font-family: 'JetBrains Mono', ui-monospace, monospace; }
        .nav-l10n .name { color: var(--md-sys-color-on-surface-variant, #49454F); font-size: 14px; }
        .nav-l10n .demo { flex: 1 1 auto; max-width: 420px; }
        .nav-l10n .bar-wrap {
          border: 1px solid var(--md-sys-color-outline-variant, #CAC4D0);
          border-radius: 16px; overflow: hidden;
        }
      </style>
      <div class="nav-l10n">
        <p style="color:var(--md-sys-color-on-surface-variant,#49454F); margin:0 0 16px; font-size:14px;">
          Each row carries its own <code>lang</code> and <code>dir</code>. RTL rows mirror layout and arrow direction.
        </p>
        ${rows.map((r) => html`
          <div class="row" lang=${r.code} dir=${r.dir}>
            <div class="info">
              <span class="code">${r.code}</span>
              <span class="name">${r.name}</span>
            </div>
            <div class="demo">
              <div class="bar-wrap">
                <md-navigation-bar aria-label=${r.bar}>
                  <md-navigation-tab label=${r.home} icon="home"></md-navigation-tab>
                  <md-navigation-tab label=${r.search} icon="search"></md-navigation-tab>
                  <md-navigation-tab label=${r.library} icon="library_music"></md-navigation-tab>
                  <md-navigation-tab label=${r.profile} icon="person"></md-navigation-tab>
                </md-navigation-bar>
              </div>
            </div>
          </div>
        `)}
      </div>
    `;
  },
};

/* ════════════════════════════════════════════════════════════════════
   15. RESPONSIVENESS — fluid width across compact breakpoints
   ════════════════════════════════════════════════════════════════════ */
export const Responsiveness: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'The navigation bar is **fluid**: `width: 100%`, equal-width ' +
          'destinations (`flex: 1`), and a fixed `64px` height. It targets ' +
          '**compact** window widths (&lt; 600 dp) — the same markup fills its ' +
          'container at any phone width. At ≥ 600 dp, M3 recommends switching to a ' +
          '[navigation rail](?path=/docs/components-navigation-rail--docs) or ' +
          'drawer; do that by swapping components at the breakpoint, not by ' +
          'stretching the bar.',
      },
    },
  },
  render: (_args, { globals }) => {
    const frames = [
      { w: 320, label: 'Compact · 320 dp (small phone)' },
      { w: 360, label: 'Compact · 360 dp (typical phone)' },
      { w: 412, label: 'Compact · 412 dp (large phone)' },
      { w: 560, label: 'Compact · 560 dp (upper bound)' },
    ];
    return html`
      <style>
        .nav-resp { padding: 24px; font-family: Roboto, sans-serif; }
        .nav-resp .row { display: flex; align-items: flex-end; gap: 20px; margin-bottom: 24px; }
        .nav-resp .meta {
          flex: 0 0 200px; font-size: 13px;
          color: var(--md-sys-color-on-surface-variant, #49454F);
        }
        .nav-resp .frame {
          border: 1px solid var(--md-sys-color-outline-variant, #CAC4D0);
          border-radius: 20px; overflow: hidden;
          background: var(--md-sys-color-surface, #FFFBFE);
          box-shadow: var(--md-sys-elevation-1);
          display: flex; flex-direction: column;
        }
        .nav-resp .content {
          height: 96px; display: flex; align-items: center; justify-content: center;
          color: var(--md-sys-color-on-surface-variant, #49454F); font-size: 12px;
        }
        .nav-resp .note {
          margin-top: 8px; padding: 16px;
          border: 1px dashed var(--md-sys-color-outline, #79747E);
          border-radius: 12px; max-width: 760px;
          color: var(--md-sys-color-on-surface-variant, #49454F); font-size: 13px; line-height: 1.5;
        }
        .nav-resp code { font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 12px; }
      </style>
      <div class="nav-resp">
        ${caption('Same markup, four container widths — destinations stay equal-width and the bar fills the inline space.')}
        ${frames.map(({ w, label }) => html`
          <div class="row">
            <div class="meta">${label}</div>
            <div class="frame" style="width:${w}px">
              <div class="content">Content area</div>
              <md-navigation-bar aria-label=${label}>
                <md-navigation-tab label=${t(globals.locale, 'home')} icon="home"></md-navigation-tab>
                <md-navigation-tab label=${t(globals.locale, 'search')} icon="search"></md-navigation-tab>
                <md-navigation-tab label=${t(globals.locale, 'navbar.library')} icon="library_music"></md-navigation-tab>
                <md-navigation-tab label=${t(globals.locale, 'navbar.profile')} icon="person"></md-navigation-tab>
              </md-navigation-bar>
            </div>
          </div>
        `)}
        <div class="note">
          <strong>At ≥ 600 dp</strong>, switch component rather than stretch the bar.
          Tip: at the narrow end, set <code>label-behavior="selected"</code> or
          <code>"none"</code> to reclaim space when destinations get cramped.
        </div>
      </div>
    `;
  },
};

/* ════════════════════════════════════════════════════════════════════
   16. ALL DESTINATIONS DISABLED — edge: no selectable target
   ════════════════════════════════════════════════════════════════════ */

/* ════════════════════════════════════════════════════════════════════
   17. NO DESTINATIONS — edge: empty bar
   ════════════════════════════════════════════════════════════════════ */
