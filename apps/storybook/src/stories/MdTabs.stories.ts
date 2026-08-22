import type { Meta, StoryObj } from '@storybook/web-components';
import { expect, waitFor } from 'storybook/test';
import { html } from 'lit';
import { t } from '../i18n';
import '@awc-ui/core/define';

/** Shadow-piercing helpers for play(): testing-library queries can't cross
 *  shadow roots — but md-tab hosts are LIGHT-DOM children of md-tabs (they
 *  carry role="tab"/aria-selected themselves), so address them directly. */
const getTabs = async (canvasElement: HTMLElement): Promise<HTMLElement> => {
  const tabs = canvasElement.querySelector('md-tabs') as HTMLElement;
  await waitFor(() => expect(tabs.classList.contains('hydrated')).toBe(true));
  return tabs;
};
const tabsOf = (tabs: HTMLElement) => [...tabs.querySelectorAll('md-tab')] as HTMLElement[];
const key = (target: Element, k: string) =>
  target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, composed: true }));

const meta: Meta = {
  title: 'Navigation/Tabs',
  component: 'md-tabs',
  tags: ['autodocs'],
  parameters: {
    docs: { source: { language: 'html' } },
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary'],
      description: 'Visual style variant',
    },
    activeTabIndex: {
      control: 'number',
      description: 'Index of the active tab',
    },
    tabWidth: {
      control: 'text',
      name: 'tab-width',
      description: "'equal' (fill parent) | 'auto' (content-sized) | CSS length (fixed)",
    },
    width: {
      control: 'text',
      description: "Strip width (any CSS size, e.g. '100%', '480px') — anchors the tablist against panel-driven layout shifts",
    },
  },
  args: {
    variant: 'primary',
    activeTabIndex: 0,
    tabWidth: 'equal',
    width: '',
  },
};
export default meta;
type Story = StoryObj;

/* ─── Playground ───────────────────────────────────────── */

export const Playground: Story = {
  render: (args, { globals }) => html`
    <md-tabs
      variant=${args.variant}
      active-tab-index=${args.activeTabIndex}
      tab-width=${args.tabWidth || 'equal'}
      width=${args.width || ''}
      style="max-width: 500px;"
    >
      <md-tab label=${t(globals.locale, 'tabs.flights')} icon="flight"></md-tab>
      <md-tab label=${t(globals.locale, 'tabs.hotels')} icon="hotel"></md-tab>
      <md-tab label=${t(globals.locale, 'tabs.trips')} icon="explore"></md-tab>
    </md-tabs>
  `,
  /** Public API + prop reactivity: selectTab() and its guard, activeTabIndex
   *  normalization (no emit on the consumer path), variant/tab-width watchers,
   *  and the wrapping arrow / Home-End keyboard model. */
  play: async ({ canvasElement, step }) => {
    const tabs = (await getTabs(canvasElement)) as HTMLElement & {
      activeTabIndex: number;
      variant: 'primary' | 'secondary';
      tabWidth: string;
      selectTab: (i: number) => Promise<void>;
    };
    const tabEls = tabsOf(tabs);

    await step('Baseline — first tab active with a single roving tab stop', async () => {
      await waitFor(() =>
        expect(tabEls.map((t) => t.getAttribute('tabindex'))).toEqual(['0', '-1', '-1']),
      );
      // aria-selected reflects on the md-tab child's OWN render flush (the
      // parent only stamps tabindex directly) — poll so we don't read it
      // before that render lands as null.
      await waitFor(() => expect(tabEls[0].getAttribute('aria-selected')).toBe('true'));
    });

    await step('selectTab(2) programmatically activates the third tab and emits', async () => {
      let detail: { index: number; previousIndex: number } | undefined;
      tabs.addEventListener('mdTabChange', (e) => { detail = (e as CustomEvent).detail; }, { once: true });
      await tabs.selectTab(2);
      await waitFor(() => expect(tabEls[2].getAttribute('aria-selected')).toBe('true'));
      // tab[0]'s DEselect reflects on its own async render flush — poll it too.
      await waitFor(() => expect(tabEls[0].getAttribute('aria-selected')).toBe('false'));
      expect(detail).toEqual({ index: 2, previousIndex: 0 });
    });

    await step('selectTab ignores out-of-range indices — no change, no emit', async () => {
      let fired = 0;
      const bump = () => { fired += 1; };
      tabs.addEventListener('mdTabChange', bump);
      await tabs.selectTab(99);
      await tabs.selectTab(-1);
      await new Promise((r) => setTimeout(r, 50));
      tabs.removeEventListener('mdTabChange', bump);
      expect(fired).toBe(0);
      expect(tabEls[2].getAttribute('aria-selected')).toBe('true'); // still the third tab
    });

    await step('variant prop propagates to every child tab', async () => {
      tabs.variant = 'secondary';
      await waitFor(() =>
        expect(tabEls.every((t) => t.getAttribute('variant') === 'secondary')).toBe(true),
      );
    });

    await step('tab-width prop switches the strip sizing class (fixed → auto)', async () => {
      tabs.tabWidth = '160px';
      await waitFor(() => expect(tabs.classList.contains('md-tabs--tw-fixed')).toBe(true));
      tabs.tabWidth = 'auto';
      await waitFor(() => {
        expect(tabs.classList.contains('md-tabs--tw-auto')).toBe(true);
        expect(tabs.classList.contains('md-tabs--tw-fixed')).toBe(false);
      });
    });

    await step('Setting activeTabIndex to a float clamps + normalizes without emitting', async () => {
      let fired = 0;
      const bump = () => { fired += 1; };
      tabs.addEventListener('mdTabChange', bump);
      tabs.activeTabIndex = 1.4;
      await waitFor(() => expect(tabEls[1].getAttribute('aria-selected')).toBe('true'));
      expect(tabEls[2].getAttribute('aria-selected')).toBe('false');
      await new Promise((r) => setTimeout(r, 50));
      tabs.removeEventListener('mdTabChange', bump);
      expect(tabs.activeTabIndex).toBe(1); // component rounded 1.4 → 1
      expect(fired).toBe(0);               // prop path is consumer-initiated
    });

    await step('Arrow keys move & wrap by visual direction; Home/End jump to ends', async () => {
      tabEls[0].click();
      tabEls[0].focus();
      await waitFor(() => expect(tabEls[0].getAttribute('aria-selected')).toBe('true'));

      key(tabEls[0], 'ArrowLeft'); // wraps first → last
      await waitFor(() => expect(tabEls[2].getAttribute('aria-selected')).toBe('true'));
      expect(document.activeElement).toBe(tabEls[2]);

      key(tabEls[2], 'ArrowRight'); // wraps last → first
      await waitFor(() => expect(tabEls[0].getAttribute('aria-selected')).toBe('true'));
      expect(document.activeElement).toBe(tabEls[0]);

      key(tabEls[0], 'End');
      await waitFor(() => expect(tabEls[2].getAttribute('aria-selected')).toBe('true'));

      key(tabEls[2], 'Home');
      await waitFor(() => expect(tabEls[0].getAttribute('aria-selected')).toBe('true'));
      // Let the indicator glide + smooth auto-scroll settle before teardown.
      await new Promise((r) => setTimeout(r, 300));
    });

    await step('Keyboard nav survives events with no composedPath (deep-activeElement fallback)', async () => {
      tabEls[0].click();
      tabEls[0].focus();
      await waitFor(() => expect(tabEls[0].getAttribute('aria-selected')).toBe('true'));
      await waitFor(() => expect(document.activeElement).toBe(tabEls[0]));

      // A keydown whose composedPath() is empty (synthetic / legacy events)
      // forces handleKeyDown onto its deepActiveElement() walk to find the
      // origin tab — the normal path reads composedPath()[0] instead.
      const noPath = (k: string) => {
        const target = document.activeElement as HTMLElement;
        const evt = new KeyboardEvent('keydown', { key: k, bubbles: true, composed: true, cancelable: true });
        Object.defineProperty(evt, 'composedPath', { value: () => [] });
        target.dispatchEvent(evt);
      };

      noPath('ArrowRight'); // fallback origin = focused tab 0 → advances to tab 1
      await waitFor(() => expect(tabEls[1].getAttribute('aria-selected')).toBe('true'));
      expect(document.activeElement).toBe(tabEls[1]);

      noPath('Home'); // fallback again → jumps back to the first tab
      await waitFor(() => expect(tabEls[0].getAttribute('aria-selected')).toBe('true'));
      expect(document.activeElement).toBe(tabEls[0]);
      await new Promise((r) => setTimeout(r, 200));
    });

    // ── Visual reset ──────────────────────────────────────────
    // The steps above mutated props the screenshot would otherwise capture:
    // variant → 'secondary', tab-width → 'auto', and focus parked on tab 0
    // (a focus ring). Restore the fresh-render visual state — primary variant,
    // equal tab-width, first tab active, nothing focused — so the VISUAL
    // baseline matches a clean resting render (coverage steps above still run).
    await step('Reset to fresh-render visual state for a clean screenshot baseline', async () => {
      tabs.variant = 'primary';
      tabs.tabWidth = 'equal';
      tabs.activeTabIndex = 0;
      (document.activeElement as HTMLElement)?.blur();
      await waitFor(() => {
        expect(tabEls.every((t) => t.getAttribute('variant') === 'primary')).toBe(true);
        expect(tabs.classList.contains('md-tabs--tw-auto')).toBe(false);
        expect(tabs.classList.contains('md-tabs--tw-fixed')).toBe(false);
        expect(tabEls[0].getAttribute('aria-selected')).toBe('true');
        expect(tabEls.some((t) => t === document.activeElement)).toBe(false);
      });
      // Let the indicator glide back and the reset render settle before capture.
      await new Promise((r) => setTimeout(r, 300));
    });
  },
};

/* ─── Primary Tabs — Label Only ────────────────────────── */

export const PrimaryLabelOnly: Story = {
  render: (_args, { globals }) => html`
    <md-tabs variant="primary" style="max-width: 500px;">
      <md-tab label=${t(globals.locale, 'tabs.flights')}></md-tab>
      <md-tab label=${t(globals.locale, 'tabs.hotels')}></md-tab>
      <md-tab label=${t(globals.locale, 'tabs.trips')}></md-tab>
    </md-tabs>
    <p style="font-family: Roboto, sans-serif; color: var(--md-sys-color-on-surface-variant); font-size: 14px; padding: 16px;">
      Primary tabs with label text only — container height 48px, active indicator inset 2px with 3px height.
    </p>
  `,
};

/* ─── Primary Tabs — Icon + Label (Stacked) ────────────── */

export const PrimaryIconAndLabel: Story = {
  render: (_args, { globals }) => html`
    <md-tabs variant="primary" style="max-width: 500px;">
      <md-tab label=${t(globals.locale, 'tabs.flights')} icon="flight"></md-tab>
      <md-tab label=${t(globals.locale, 'tabs.hotels')} icon="hotel"></md-tab>
      <md-tab label=${t(globals.locale, 'tabs.trips')} icon="explore"></md-tab>
    </md-tabs>
    <p style="font-family: Roboto, sans-serif; color: var(--md-sys-color-on-surface-variant); font-size: 14px; padding: 16px;">
      Primary tabs with icon + label — container height increases to 64px.
    </p>
  `,
};

/* ─── Primary Tabs — Inline Icon ───────────────────────── */

export const PrimaryInlineIcon: Story = {
  render: (_args, { globals }) => html`
    <md-tabs variant="primary" style="max-width: 500px;">
      <md-tab label=${t(globals.locale, 'tabs.flights')} icon="flight" inline-icon></md-tab>
      <md-tab label=${t(globals.locale, 'tabs.hotels')} icon="hotel" inline-icon></md-tab>
      <md-tab label=${t(globals.locale, 'tabs.trips')} icon="explore" inline-icon></md-tab>
    </md-tabs>
    <p style="font-family: Roboto, sans-serif; color: var(--md-sys-color-on-surface-variant); font-size: 14px; padding: 16px;">
      Inline icon layout — icon and label side-by-side with 8px gap.
    </p>
  `,
};

/* ─── Secondary Tabs ───────────────────────────────────── */

export const SecondaryTabs: Story = {
  render: (_args, { globals }) => html`
    <md-tabs variant="secondary" style="max-width: 500px;">
      <md-tab label=${t(globals.locale, 'tabs.music')}></md-tab>
      <md-tab label=${t(globals.locale, 'tabs.podcasts')}></md-tab>
      <md-tab label=${t(globals.locale, 'tabs.audiobooks')}></md-tab>
    </md-tabs>
    <p style="font-family: Roboto, sans-serif; color: var(--md-sys-color-on-surface-variant); font-size: 14px; padding: 16px;">
      Secondary tabs — full-width active indicator with 2px height. Active color is on-surface.
    </p>
  `,
};

/* ─── Badges ───────────────────────────────────────────── */

export const WithBadges: Story = {
  render: (_args, { globals }) => html`
    <md-tabs variant="primary" style="max-width: 500px;">
      <md-tab label=${t(globals.locale, 'tabs.inbox')} icon="inbox" badge="12"></md-tab>
      <md-tab label=${t(globals.locale, 'tabs.sent')} icon="send"></md-tab>
      <md-tab label=${t(globals.locale, 'tabs.drafts')} icon="drafts" badge=""></md-tab>
      <md-tab label=${t(globals.locale, 'tabs.spam')} icon="report" badge="3"></md-tab>
    </md-tabs>
    <p style="font-family: Roboto, sans-serif; color: var(--md-sys-color-on-surface-variant); font-size: 14px; padding: 16px;">
      Badges on tabs — text badge on "Inbox" and "Spam", dot badge on "Drafts".
    </p>
  `,
};

/* ─── Inline Badge (label only) ────────────────────────── */

export const InlineBadge: Story = {
  render: (_args, { globals }) => html`
    <md-tabs variant="secondary" style="max-width: 500px;">
      <md-tab label=${t(globals.locale, 'tabs.messages')} badge="5"></md-tab>
      <md-tab label=${t(globals.locale, 'tabs.mentions')} badge=""></md-tab>
      <md-tab label=${t(globals.locale, 'tabs.saved')}></md-tab>
    </md-tabs>
    <p style="font-family: Roboto, sans-serif; color: var(--md-sys-color-on-surface-variant); font-size: 14px; padding: 16px;">
      Badges without icons appear inline next to the label text.
    </p>
  `,
};

/* ─── States ───────────────────────────────────────────── */

export const States: Story = {
  render: () => html`
    <div style="display: flex; flex-direction: column; gap: 24px; max-width: 500px;">
      <div>
        <p style="font-family: Roboto, sans-serif; font-size: 12px; color: var(--md-sys-color-on-surface-variant); margin: 0 0 8px;">Primary — active + inactive + disabled</p>
        <md-tabs variant="primary">
          <md-tab label="Active" icon="home"></md-tab>
          <md-tab label="Inactive" icon="search"></md-tab>
          <md-tab label="Disabled" icon="block" disabled></md-tab>
        </md-tabs>
      </div>
      <div>
        <p style="font-family: Roboto, sans-serif; font-size: 12px; color: var(--md-sys-color-on-surface-variant); margin: 0 0 8px;">Secondary — active + inactive + disabled</p>
        <md-tabs variant="secondary">
          <md-tab label="Active"></md-tab>
          <md-tab label="Inactive"></md-tab>
          <md-tab label="Disabled" disabled></md-tab>
        </md-tabs>
      </div>
    </div>
  `,
};

/* ─── Scrollable Tabs ──────────────────────────────────── */

export const ScrollableTabs: Story = {
  render: () => html`
    <md-tabs variant="primary" style="max-width: 400px;">
      <md-tab label="Tab 1"></md-tab>
      <md-tab label="Tab 2"></md-tab>
      <md-tab label="Tab 3"></md-tab>
      <md-tab label="Tab 4"></md-tab>
      <md-tab label="Tab 5"></md-tab>
      <md-tab label="Tab 6"></md-tab>
      <md-tab label="Tab 7"></md-tab>
      <md-tab label="Tab 8"></md-tab>
    </md-tabs>
    <p style="font-family: Roboto, sans-serif; color: var(--md-sys-color-on-surface-variant); font-size: 14px; padding: 16px;">
      Tabs can scroll horizontally. A UI can have as many tabs as needed.
    </p>
  `,
  /** Activating an off-screen tab (End) must scroll it into view and move the
   *  clip fade — proven via container.scrollLeft + tab geometry, not literals. */
  play: async ({ canvasElement, step }) => {
    const tabs = await getTabs(canvasElement);
    const tabEls = tabsOf(tabs);
    const container = tabs.shadowRoot!.querySelector('[part="container"]') as HTMLElement;
    const last = tabEls[tabEls.length - 1];
    // A tab is clipped on the right when its right edge overruns the viewport.
    const clippedRight = (el: HTMLElement) =>
      el.getBoundingClientRect().right > container.getBoundingClientRect().right + 1;

    let startScroll = 0;
    await step('The strip overflows and Tab 8 starts clipped off the right edge', async () => {
      // Real geometry the component produced — differs if overflow broke.
      await waitFor(() => expect(container.scrollWidth).toBeGreaterThan(container.clientWidth));
      startScroll = container.scrollLeft;
      expect(clippedRight(last)).toBe(true);
      expect(tabs.classList.contains('md-tabs--clip-right')).toBe(true);
      await waitFor(() => expect(tabEls[0].getAttribute('aria-selected')).toBe('true'));
    });

    let detail: { index: number; previousIndex: number } | undefined;
    await step('End activates the last tab and emits mdTabChange', async () => {
      tabEls[0].focus();
      await waitFor(() => expect(document.activeElement).toBe(tabEls[0]));
      tabs.addEventListener(
        'mdTabChange',
        (e) => { detail = (e as CustomEvent).detail; },
        { once: true },
      );

      key(tabEls[0], 'End');

      await waitFor(() => expect(last.getAttribute('aria-selected')).toBe('true'));
      expect(tabEls[0].getAttribute('aria-selected')).toBe('false'); // moved off tab 0
      expect(document.activeElement).toBe(last);
      expect(detail).toEqual({ index: tabEls.length - 1, previousIndex: 0 });
    });

    await step('The newly-active tab is scrolled into view; the fade follows', async () => {
      // Smooth scroll settles async — poll until the strip moved AND Tab 8 is
      // no longer clipped, with the clipped edge now on the LEFT instead.
      await waitFor(() => expect(container.scrollLeft).toBeGreaterThan(startScroll));
      await waitFor(() => expect(clippedRight(last)).toBe(false));
      await waitFor(() => expect(tabs.classList.contains('md-tabs--clip-left')).toBe(true));
      // Let the smooth scroll + indicator glide settle before teardown.
      await new Promise((r) => setTimeout(r, 300));
    });
  },
};

/* ─── Custom Icons (slotted) ───────────────────────────── */

export const SlottedIcons: Story = {
  render: (_args, { globals }) => html`
    <md-tabs variant="primary" style="max-width: 500px;">
      <md-tab label=${t(globals.locale, 'tabs.starred')}>
        <svg slot="icon" viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
      </md-tab>
      <md-tab label=${t(globals.locale, 'tabs.heart')}>
        <svg slot="icon" viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
        </svg>
      </md-tab>
      <md-tab label=${t(globals.locale, 'tabs.emoji')}>
        <span slot="icon" style="font-size: 24px;">🎵</span>
      </md-tab>
    </md-tabs>
  `,
};

/* ─── RTL ──────────────────────────────────────────────── */

export const RTL: Story = {
  render: () => html`
    <div dir="rtl" style="max-width: 500px;">
      <md-tabs variant="primary">
        <md-tab label="رحلات" icon="flight"></md-tab>
        <md-tab label="فنادق" icon="hotel"></md-tab>
        <md-tab label="رحلات" icon="explore"></md-tab>
      </md-tabs>
    </div>
  `,
};

/* ─── Dark Theme ───────────────────────────────────────── */

export const DarkTheme: Story = {
  render: (_args, { globals }) => html`
    <div data-theme="dark" style="background: var(--md-sys-color-surface, #1C1B1F); padding: 24px; border-radius: 16px; max-width: 500px;">
      <md-tabs variant="primary">
        <md-tab label=${t(globals.locale, 'tabs.flights')} icon="flight"></md-tab>
        <md-tab label=${t(globals.locale, 'tabs.hotels')} icon="hotel"></md-tab>
        <md-tab label=${t(globals.locale, 'tabs.trips')} icon="explore"></md-tab>
      </md-tabs>
      <div style="margin-top: 16px;">
        <md-tabs variant="secondary">
          <md-tab label=${t(globals.locale, 'tabs.music')}></md-tab>
          <md-tab label=${t(globals.locale, 'tabs.podcasts')}></md-tab>
          <md-tab label=${t(globals.locale, 'tabs.books')}></md-tab>
        </md-tabs>
      </div>
    </div>
  `,
  decorators: [(story) => html`<div data-theme="dark">${story()}</div>`],
};

/* ─── Custom CSS ───────────────────────────────────────── */

export const CustomCSS: Story = {
  render: (_args, { globals }) => html`
    <style>
      .brand-tabs { --md-tabs-container-color: #f3e8ff; }
      .brand-tabs md-tab {
        --md-tab-active-label-color: #7c3aed;
        --md-tab-active-icon-color: #7c3aed;
        --md-tab-active-indicator-color: #7c3aed;
        --md-tab-inactive-label-color: #6b5b95;
        --md-tab-inactive-icon-color: #6b5b95;
      }
    </style>
    <md-tabs class="brand-tabs" variant="primary" style="max-width: 500px;">
      <md-tab label=${t(globals.locale, 'home')} icon="home"></md-tab>
      <md-tab label=${t(globals.locale, 'search')} icon="search"></md-tab>
      <md-tab label=${t(globals.locale, 'tabs.profile')} icon="person"></md-tab>
    </md-tabs>
  `,
};

/* ─── CSS Parts ────────────────────────────────────────── */

export const CSSParts: Story = {
  render: (_args, { globals }) => html`
    <style>
      .parts-demo md-tab::part(label) {
        text-transform: uppercase;
        letter-spacing: 1px;
      }
      .parts-demo md-tab::part(indicator) {
        background: linear-gradient(90deg, #6750A4, #D0BCFF);
      }
    </style>
    <md-tabs class="parts-demo" variant="primary" style="max-width: 500px;">
      <md-tab label=${t(globals.locale, 'tabs.flights')} icon="flight"></md-tab>
      <md-tab label=${t(globals.locale, 'tabs.hotels')} icon="hotel"></md-tab>
      <md-tab label=${t(globals.locale, 'tabs.trips')} icon="explore"></md-tab>
    </md-tabs>
  `,
};

/* ─── With Tab Panels (aria-controls) ──────────────────── */

export const WithTabPanels: Story = {
  render: (_args, { globals }) => {
    const showPanel = (prefix: string, idx: number) => {
      document.querySelectorAll(`.${prefix}`).forEach((p, i) => {
        (p as HTMLElement).hidden = i !== idx;
      });
    };
    return html`
      <div style="max-width: 500px;">
        <md-tabs
          variant="primary"
          aria-label="Content sections"
          @mdTabChange=${(e: CustomEvent) => showPanel('panel-travel', e.detail.index)}
        >
          <md-tab id="tab-flights" label=${t(globals.locale, 'tabs.flights')} icon="flight" controls="panel-flights"></md-tab>
          <md-tab id="tab-hotels" label=${t(globals.locale, 'tabs.hotels')} icon="hotel" controls="panel-hotels"></md-tab>
          <md-tab id="tab-trips" label=${t(globals.locale, 'tabs.trips')} icon="explore" controls="panel-trips"></md-tab>
        </md-tabs>

        <div
          id="panel-flights"
          class="panel-travel"
          role="tabpanel"
          aria-labelledby="tab-flights"
          tabindex="0"
          style="padding: 24px; font-family: Roboto, sans-serif; color: var(--md-sys-color-on-surface);"
        >
          ${t(globals.locale, 'tabs.panelFlights')}
        </div>

        <div
          id="panel-hotels"
          class="panel-travel"
          role="tabpanel"
          aria-labelledby="tab-hotels"
          tabindex="0"
          hidden
          style="padding: 24px; font-family: Roboto, sans-serif; color: var(--md-sys-color-on-surface);"
        >
          ${t(globals.locale, 'tabs.panelHotels')}
        </div>

        <div
          id="panel-trips"
          class="panel-travel"
          role="tabpanel"
          aria-labelledby="tab-trips"
          tabindex="0"
          hidden
          style="padding: 24px; font-family: Roboto, sans-serif; color: var(--md-sys-color-on-surface);"
        >
          ${t(globals.locale, 'tabs.panelTrips')}
        </div>
      </div>
      <p style="font-family: Roboto, sans-serif; font-size: 12px; color: var(--md-sys-color-on-surface-variant); padding: 16px 0;">
        Full ARIA pattern: each tab has <code>controls</code> → panel ID, each panel has <code>role="tabpanel"</code> + <code>aria-labelledby</code> → tab ID.
      </p>
    `;
  },
  /** Activating a tab must SWAP the visible panel (mdTabChange → showPanel),
   *  keeping exactly one panel shown — and re-clicking the active tab must not. */
  play: async ({ canvasElement, step }) => {
    const tabs = await getTabs(canvasElement);
    const tabEls = tabsOf(tabs);
    const panels = () => [...canvasElement.querySelectorAll('.panel-travel')] as HTMLElement[];
    const shownIds = () => panels().filter((p) => !p.hidden).map((p) => p.id);

    await step('Baseline — only the Flights panel is visible under the active tab', async () => {
      await waitFor(() => expect(tabEls[0].getAttribute('aria-selected')).toBe('true'));
      expect(shownIds()).toEqual(['panel-flights']);
    });

    await step('Clicking Hotels emits mdTabChange and swaps Flights→Hotels', async () => {
      const flightsHiddenBefore = panels()[0].hidden; // false — capture the pre-state
      let detail: { index: number; previousIndex: number } | undefined;
      tabs.addEventListener(
        'mdTabChange',
        (e) => { detail = (e as CustomEvent).detail; },
        { once: true },
      );

      tabEls[1].click();

      // aria-selected reflects on the NEXT render flush — assert inside waitFor.
      await waitFor(() => expect(tabEls[1].getAttribute('aria-selected')).toBe('true'));
      expect(tabEls[0].getAttribute('aria-selected')).toBe('false');
      // The component fired the event (not just mutated its own DOM).
      expect(detail).toEqual({ index: 1, previousIndex: 0 });
      // Panel visibility flipped: Flights hid, Hotels appeared.
      await waitFor(() => {
        expect(panels()[0].hidden).toBe(true);
        expect(panels()[1].hidden).toBe(false);
      });
      expect(panels()[0].hidden).not.toBe(flightsHiddenBefore); // it MOVED
    });

    await step('Activating Trips leaves exactly one panel shown (mutual exclusion)', async () => {
      tabEls[2].click();
      await waitFor(() => expect(tabEls[2].getAttribute('aria-selected')).toBe('true'));
      expect(shownIds()).toEqual(['panel-trips']);
    });

    await step('Re-clicking the already-active tab does NOT re-emit (guard)', async () => {
      let fired = 0;
      const bump = () => { fired += 1; };
      tabs.addEventListener('mdTabChange', bump);
      tabEls[2].click(); // Trips is already active
      await new Promise((r) => setTimeout(r, 60));
      tabs.removeEventListener('mdTabChange', bump);
      expect(fired).toBe(0);
      expect(shownIds()).toEqual(['panel-trips']); // unchanged
    });
  },
};

/* ─── Settings Page ────────────────────────────────────── */

export const SettingsPage: Story = {
  render: (_args, { globals }) => {
    const show = (prefix: string, idx: number) => {
      document.querySelectorAll(`.${prefix}`).forEach((p, i) => {
        (p as HTMLElement).hidden = i !== idx;
      });
    };
    return html`
      <style>
        .settings-shell {
          max-width: 520px;
          border-radius: 16px;
          overflow: hidden;
          border: 1px solid var(--md-sys-color-outline-variant, #CAC4D0);
          font-family: Roboto, sans-serif;
        }
        .settings-panel {
          padding: 24px;
          background: var(--md-sys-color-surface, #FFFBFE);
          color: var(--md-sys-color-on-surface, #1C1B1F);
          animation: fadeIn 200ms ease;
        }
        .settings-panel[hidden] { display: none; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .field { margin-block-end: 16px; }
        .field label {
          display: block;
          font-size: 12px;
          font-weight: 500;
          color: var(--md-sys-color-on-surface-variant, #49454F);
          margin-block-end: 4px;
        }
        .field-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-block: 12px;
          border-bottom: 1px solid var(--md-sys-color-outline-variant, #CAC4D0);
        }
        .field-row span {
          font-size: 14px;
          color: #1C1B1F;
        }
        .field-row small {
          font-size: 12px;
          color: #49454F;
        }
        .avatar {
          width: 64px; height: 64px; border-radius: 50%;
          background: #EADDFF;
          color: #21005D;
          display: flex; align-items: center; justify-content: center;
          font-size: 28px; font-weight: 600; margin-block-end: 12px;
        }
      </style>
      <div class="settings-shell">
        <md-tabs
          variant="secondary"
          aria-label="Settings"
          @mdTabChange=${(e: CustomEvent) => show('settings-p', e.detail.index)}
        >
          <md-tab label=${t(globals.locale, 'tabs.profile')}></md-tab>
          <md-tab label=${t(globals.locale, 'tabs.notifications')}></md-tab>
          <md-tab label=${t(globals.locale, 'tabs.security')}></md-tab>
        </md-tabs>

        <div class="settings-panel settings-p" role="tabpanel" tabindex="0">
          <div class="avatar">JD</div>
          <div class="field-row">
            <div><span>${t(globals.locale, 'tabs.name')}</span><br><small>Jane Doe</small></div>
            <md-icon-button icon="edit" aria-label="Edit name"></md-icon-button>
          </div>
          <div class="field-row">
            <div><span>${t(globals.locale, 'tabs.email')}</span><br><small>jane.doe@example.com</small></div>
            <md-icon-button icon="edit" aria-label="Edit email"></md-icon-button>
          </div>
          <div class="field-row">
            <div><span>${t(globals.locale, 'tabs.phone')}</span><br><small>+1 (555) 123-4567</small></div>
            <md-icon-button icon="edit" aria-label="Edit phone"></md-icon-button>
          </div>
        </div>

        <div class="settings-panel settings-p" role="tabpanel" tabindex="0" hidden>
          <div class="field-row">
            <div><span>${t(globals.locale, 'tabs.pushNotifications')}</span><br><small>${t(globals.locale, 'tabs.pushNotificationsDesc')}</small></div>
            <md-switch selected></md-switch>
          </div>
          <div class="field-row">
            <div><span>${t(globals.locale, 'tabs.emailDigest')}</span><br><small>${t(globals.locale, 'tabs.emailDigestDesc')}</small></div>
            <md-switch></md-switch>
          </div>
          <div class="field-row">
            <div><span>${t(globals.locale, 'tabs.marketingEmails')}</span><br><small>${t(globals.locale, 'tabs.marketingEmailsDesc')}</small></div>
            <md-switch></md-switch>
          </div>
          <div class="field-row">
            <div><span>${t(globals.locale, 'tabs.sound')}</span><br><small>${t(globals.locale, 'tabs.soundDesc')}</small></div>
            <md-switch selected></md-switch>
          </div>
        </div>

        <div class="settings-panel settings-p" role="tabpanel" tabindex="0" hidden>
          <div class="field-row">
            <div><span>${t(globals.locale, 'tabs.twoFactor')}</span><br><small>${t(globals.locale, 'tabs.twoFactorDesc')}</small></div>
            <md-switch></md-switch>
          </div>
          <div class="field-row">
            <div><span>${t(globals.locale, 'tabs.biometricLogin')}</span><br><small>${t(globals.locale, 'tabs.biometricLoginDesc')}</small></div>
            <md-switch selected></md-switch>
          </div>
          <div class="field-row" style="border: none;">
            <div><span>${t(globals.locale, 'tabs.activeSessions')}</span><br><small>${t(globals.locale, 'tabs.activeSessionsDesc')}</small></div>
            <md-button variant="text">${t(globals.locale, 'tabs.manage')}</md-button>
          </div>
        </div>
      </div>
    `;
  },
};

/* ─── Media Library ────────────────────────────────────── */

export const MediaLibrary: Story = {
  render: (_args, { globals }) => {
    const show = (prefix: string, idx: number) => {
      document.querySelectorAll(`.${prefix}`).forEach((p, i) => {
        (p as HTMLElement).hidden = i !== idx;
      });
    };
    return html`
      <style>
        .media-shell {
          max-width: 520px;
          font-family: Roboto, sans-serif;
        }
        .media-panel {
          padding: 16px;
          color: var(--md-sys-color-on-surface, #1C1B1F);
          animation: fadeIn 200ms ease;
        }
        .media-panel[hidden] { display: none; }
        .media-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
        }
        .media-card {
          aspect-ratio: 1;
          border-radius: 12px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-size: 13px;
          cursor: pointer;
          transition: background 150ms ease;
        }
        .media-card:hover {
          background: var(--md-sys-color-surface-container-highest, #E6E0E9);
        }
        .media-card .material-symbols-outlined {
          font-size: 32px;
          color: var(--md-sys-color-primary, #6750A4);
        }
        .media-list-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 0;
          border-bottom: 1px solid var(--md-sys-color-outline-variant, #CAC4D0);
        }
        .media-list-item .material-symbols-outlined {
          font-size: 24px;
          color: var(--md-sys-color-on-surface-variant, #49454F);
        }
        .media-list-item div { flex: 1; }
        .media-list-item span { font-size: 14px; }
        .media-list-item small {
          font-size: 12px;
          color: var(--md-sys-color-on-surface-variant, #49454F);
        }
        .empty-state {
          text-align: center;
          padding: 48px 24px;
          color: var(--md-sys-color-on-surface-variant, #49454F);
        }
        .empty-state .material-symbols-outlined {
          font-size: 48px;
          margin-block-end: 12px;
          opacity: 0.87;
        }
      </style>
      <div class="media-shell">
        <md-tabs
          variant="primary"
          aria-label="Media library"
          @mdTabChange=${(e: CustomEvent) => show('media-p', e.detail.index)}
        >
          <md-tab label=${t(globals.locale, 'tabs.photos')} icon="photo_library" badge="24"></md-tab>
          <md-tab label=${t(globals.locale, 'tabs.videos')} icon="videocam"></md-tab>
          <md-tab label=${t(globals.locale, 'tabs.audio')} icon="headphones" badge="3"></md-tab>
          <md-tab label=${t(globals.locale, 'tabs.documents')} icon="description"></md-tab>
        </md-tabs>

        <div class="media-panel media-p" role="tabpanel" tabindex="0">
          <div class="media-grid">
            ${['landscape', 'photo_camera', 'image', 'panorama', 'nature', 'pets', 'portrait', 'filter_hdr', 'wb_sunny'].map(icon => html`
              <div class="media-card" style="background: var(--md-sys-color-surface-container, #F3EDF7);">
                <span class="material-symbols-outlined">${icon}</span>
              </div>
            `)}
          </div>
        </div>

        <div class="media-panel media-p" role="tabpanel" tabindex="0" hidden>
          ${['vacation_highlight.mp4', 'birthday_party.mov', 'presentation_v2.mp4'].map((name, i) => html`
            <div class="media-list-item">
              <span class="material-symbols-outlined">smart_display</span>
              <div>
                <span>${name}</span><br>
                <small>${['2:34', '5:12', '15:03'][i]} · ${['128 MB', '340 MB', '1.2 GB'][i]}</small>
              </div>
              <md-icon-button icon="more_vert" aria-label=${`More options for ${name}`}></md-icon-button>
            </div>
          `)}
        </div>

        <div class="media-panel media-p" role="tabpanel" tabindex="0" hidden>
          ${['morning_playlist.mp3', 'podcast_ep42.m4a', 'voice_note.wav'].map((name, i) => html`
            <div class="media-list-item">
              <span class="material-symbols-outlined">music_note</span>
              <div>
                <span>${name}</span><br>
                <small>${['3:45', '28:10', '0:52'][i]} · ${['4.2 MB', '32 MB', '1.1 MB'][i]}</small>
              </div>
              <md-icon-button icon="play_arrow" aria-label=${`Play ${name}`}></md-icon-button>
            </div>
          `)}
        </div>

        <div class="media-panel media-p" role="tabpanel" tabindex="0" hidden>
          <div class="empty-state">
            <span class="material-symbols-outlined">folder_open</span>
            <p style="margin: 0; font-size: 14px;">${t(globals.locale, 'tabs.noDocuments')}</p>
            <p style="margin: 4px 0 16px; font-size: 12px;">${t(globals.locale, 'tabs.uploadToStart')}</p>
            <md-button variant="filled" icon="upload">${t(globals.locale, 'tabs.upload')}</md-button>
          </div>
        </div>
      </div>
    `;
  },
};

/* ─── Dashboard with Secondary Tabs ────────────────────── */

export const Dashboard: Story = {
  render: (_args, { globals }) => {
    const show = (prefix: string, idx: number) => {
      document.querySelectorAll(`.${prefix}`).forEach((p, i) => {
        (p as HTMLElement).hidden = i !== idx;
      });
    };
    return html`
      <style>
        .dash-shell {
          max-width: 520px;
          border-radius: 16px;
          overflow: hidden;
          background: var(--md-sys-color-surface, #FFFBFE);
          border: 1px solid var(--md-sys-color-outline-variant, #CAC4D0);
          font-family: Roboto, sans-serif;
        }
        .dash-header {
          padding: 20px 24px 0;
          font-size: 22px;
          font-weight: 400;
          color: var(--md-sys-color-on-surface, #1C1B1F);
        }
        .dash-panel {
          padding: 24px;
          background: var(--md-sys-color-surface, #FFFBFE);
          color: var(--md-sys-color-on-surface, #1C1B1F);
          animation: fadeIn 200ms ease;
        }
        .dash-panel[hidden] { display: none; }
        .stat-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        .stat-card {
          padding: 16px;
          border-radius: 12px;
          background: var(--md-sys-color-surface-container, #F3EDF7);
        }
        .stat-card .value {
          font-size: 28px;
          font-weight: 500;
          color: var(--md-sys-color-primary, #6750A4);
        }
        .stat-card .label {
          font-size: 12px;
          color: var(--md-sys-color-on-surface-variant, #49454F);
          margin-block-start: 4px;
        }
        .stat-card .trend {
          font-size: 12px;
          margin-block-start: 4px;
        }
        .trend-up { color: #1B5E20; font-weight: 600; }
        .trend-down { color: var(--md-sys-color-error, #B3261E); font-weight: 600; }
        .activity-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 0;
          border-bottom: 1px solid var(--md-sys-color-outline-variant, #CAC4D0);
          font-size: 14px;
        }
        .activity-dot {
          width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
        }
        .activity-item small {
          margin-inline-start: auto;
          font-size: 12px;
          color: var(--md-sys-color-on-surface-variant, #49454F);
          white-space: nowrap;
        }
      </style>
      <div class="dash-shell">
        <div class="dash-header">${t(globals.locale, 'tabs.analytics')}</div>
        <md-tabs
          variant="secondary"
          aria-label="Dashboard views"
          @mdTabChange=${(e: CustomEvent) => show('dash-p', e.detail.index)}
        >
          <md-tab label=${t(globals.locale, 'tabs.overview')}></md-tab>
          <md-tab label=${t(globals.locale, 'tabs.activity')}></md-tab>
          <md-tab label=${t(globals.locale, 'tabs.reports')} badge="2"></md-tab>
        </md-tabs>

        <div class="dash-panel dash-p" role="tabpanel" tabindex="0">
          <div class="stat-grid">
            <div class="stat-card">
              <div class="value">1,248</div>
              <div class="label">${t(globals.locale, 'tabs.totalUsers')}</div>
              <div class="trend trend-up">↑ 12% this week</div>
            </div>
            <div class="stat-card">
              <div class="value">384</div>
              <div class="label">${t(globals.locale, 'tabs.activeToday')}</div>
              <div class="trend trend-up">↑ 8% vs yesterday</div>
            </div>
            <div class="stat-card">
              <div class="value">92%</div>
              <div class="label">${t(globals.locale, 'tabs.uptime')}</div>
              <div class="trend trend-down">↓ 3% this month</div>
            </div>
            <div class="stat-card">
              <div class="value">$4.2k</div>
              <div class="label">${t(globals.locale, 'tabs.revenue')}</div>
              <div class="trend trend-up">↑ 18% MoM</div>
            </div>
          </div>
        </div>

        <div class="dash-panel dash-p" role="tabpanel" tabindex="0" hidden>
          <div class="activity-item">
            <span class="activity-dot" style="background: var(--md-sys-color-primary, #6750A4);"></span>
            <span>${t(globals.locale, 'tabs.activityNewUser')}</span>
            <small>2 min ago</small>
          </div>
          <div class="activity-item">
            <span class="activity-dot" style="background: #2e7d32;"></span>
            <span>${t(globals.locale, 'tabs.activityPayment')}</span>
            <small>15 min ago</small>
          </div>
          <div class="activity-item">
            <span class="activity-dot" style="background: var(--md-sys-color-tertiary, #7D5260);"></span>
            <span>${t(globals.locale, 'tabs.activityReportExported')}</span>
            <small>1 hr ago</small>
          </div>
          <div class="activity-item">
            <span class="activity-dot" style="background: var(--md-sys-color-error, #B3261E);"></span>
            <span>${t(globals.locale, 'tabs.activityServerError')}</span>
            <small>3 hr ago</small>
          </div>
          <div class="activity-item" style="border: none;">
            <span class="activity-dot" style="background: var(--md-sys-color-primary, #6750A4);"></span>
            <span>${t(globals.locale, 'tabs.activityDeployment')}</span>
            <small>5 hr ago</small>
          </div>
        </div>

        <div class="dash-panel dash-p" role="tabpanel" tabindex="0" hidden>
          <div class="activity-item">
            <span class="material-symbols-outlined" style="font-size: 20px; color: var(--md-sys-color-primary);">description</span>
            <div style="flex: 1;">
              <span style="font-size: 14px;">${t(globals.locale, 'tabs.reportWeeklyGrowth')}</span><br>
              <small style="font-size: 12px; color: var(--md-sys-color-on-surface-variant);">Generated Mar 23, 2026</small>
            </div>
            <md-button variant="text">${t(globals.locale, 'tabs.view')}</md-button>
          </div>
          <div class="activity-item" style="border: none;">
            <span class="material-symbols-outlined" style="font-size: 20px; color: var(--md-sys-color-primary);">description</span>
            <div style="flex: 1;">
              <span style="font-size: 14px;">${t(globals.locale, 'tabs.reportRevenueQ1')}</span><br>
              <small style="font-size: 12px; color: var(--md-sys-color-on-surface-variant);">Generated Mar 20, 2026</small>
            </div>
            <md-button variant="text">${t(globals.locale, 'tabs.view')}</md-button>
          </div>
        </div>
      </div>
    `;
  },
};


/* ─── Width modes ──────────────────────────────────────── */

export const WidthModes: Story = {
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        story:
          'Two width concerns, two knobs. **Strip width (`width`)**: in shrink-to-fit layouts the parent follows the ACTIVE PANEL, so switching to a tab with tiny content collapses the whole tablist — the first card shows the collapse (click "Sent": its panel is one letter), the second is anchored with `width="480px"` and never moves. **Tab width (`tab-width`)**: `equal` shares the strip, `auto` follows label content, a CSS length fixes each tab track exactly.',
      },
    },
  },
  render: (_args, { globals }) => {
    const PANELS: Record<string, string> = {
      Inbox: 'Twelve unread conversations, three flagged for follow-up — a realistically wide panel that stretches the card.',
      Sent: 'S',
      Archive: 'Archived threads are kept for 90 days.',
    };
    const showPanel = (card: string, index: number) => {
      const names = Object.keys(PANELS);
      const el = document.querySelector(`[data-wm-panel="${card}"]`)!;
      el.textContent = PANELS[names[index]];
    };
    const card = (id: string, anchored: boolean) => html`
      <p style="font: 12px/2 ui-monospace, monospace; color: var(--md-sys-color-on-surface-variant); margin: 14px 0 2px;">
        ${anchored ? 'width="480px" — strip anchored, panels can\'t move it' : 'default — strip follows the shrink-to-fit card (click Sent!)'}
      </p>
      <div style="display: inline-block; border: 1px dashed color-mix(in srgb, currentColor 30%, transparent); border-radius: 10px; padding: 10px;">
        <md-tabs aria-label=${`Mail ${id}`} width=${anchored ? '480px' : ''}
          @mdTabChange=${(e: CustomEvent<{ index: number }>) => showPanel(id, e.detail.index)}>
          <md-tab label=${t(globals.locale, 'tabs.inbox')} active badge="3"></md-tab>
          <md-tab label=${t(globals.locale, 'tabs.sent')}></md-tab>
          <md-tab label=${t(globals.locale, 'tabs.archive')}></md-tab>
        </md-tabs>
        <div data-wm-panel=${id} style="padding: 12px 4px; font: 14px/1.5 system-ui; white-space: nowrap;">${PANELS.Inbox}</div>
      </div>
    `;
    const strip = (mode: string) => html`
      <p style="font: 12px/2 ui-monospace, monospace; color: var(--md-sys-color-on-surface-variant); margin: 14px 0 2px;">tab-width="${mode}"</p>
      <md-tabs aria-label=${`Width ${mode}`} tab-width=${mode} style="max-width: 640px;">
        <md-tab label=${t(globals.locale, 'tabs.inbox')} active badge="3"></md-tab>
        <md-tab label=${t(globals.locale, 'tabs.payments')}></md-tab>
        <md-tab label=${t(globals.locale, 'tabs.documentsAndArchived')}></md-tab>
        <md-tab label=${t(globals.locale, 'settings')}></md-tab>
      </md-tabs>
    `;
    return html`
      <h4 style="font: 600 13px system-ui; margin: 0;">Strip width vs panel content</h4>
      <p style="font: 12.5px/1.5 system-ui; color: var(--md-sys-color-on-surface-variant); max-width: 70ch; margin: 4px 0 0;">
        Prefer <code>md-tab-panels</code> (see the <b>Stable Panels</b> story) — it keeps the whole card
        size-stable without any explicit width. <code>width</code> is the manual anchor.
      </p>
      ${card('plain', false)}
      ${card('anchored', true)}
      <p style="font: 12px/2 ui-monospace, monospace; color: var(--md-sys-color-on-surface-variant); margin: 14px 0 2px;">width="100%" — full width of the parent, panels still can't shrink it</p>
      <div style="border: 1px dashed color-mix(in srgb, currentColor 30%, transparent); border-radius: 10px; padding: 10px;">
        <md-tabs aria-label="Mail full" width="100%"
          @mdTabChange=${(e: CustomEvent<{ index: number }>) => showPanel('full', e.detail.index)}>
          <md-tab label=${t(globals.locale, 'tabs.inbox')} active badge="3"></md-tab>
          <md-tab label=${t(globals.locale, 'tabs.sent')}></md-tab>
          <md-tab label=${t(globals.locale, 'tabs.archive')}></md-tab>
        </md-tabs>
        <div data-wm-panel="full" style="padding: 12px 4px; font: 14px/1.5 system-ui;">${'Twelve unread conversations, three flagged for follow-up — a realistically wide panel that stretches the card.'}</div>
      </div>
      <h4 style="font: 600 13px system-ui; margin: 22px 0 0;">Tab track sizing</h4>
      ${strip('equal')}
      ${strip('auto')}
      ${strip('140px')}
    `;
  },
};


/* ─── Stable panels ────────────────────────────────────── */

export const StablePanels: Story = {
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        story:
          '`md-tab-panels` + `md-tab-panel`: place after the tablist, one panel per tab. All panels stack in one grid cell and inactive ones stay in layout (hidden + inert), so the region — and any shrink-to-fit card around it — keeps the **same width and height on every tab**, even when a panel holds a single letter. ARIA is wired automatically (`aria-controls` ↔ `aria-labelledby`). `sizing="active"` opts back into content-driven sizing.',
      },
    },
  },
  render: (_args, { globals }) => html`
    <div style="display: inline-block; border: 1px solid color-mix(in srgb, currentColor 20%, transparent); border-radius: 16px; padding: 20px 24px;">
      <h3 style="font: 600 22px system-ui; margin: 0 0 10px;">${t(globals.locale, 'tabs.analytics')}</h3>
      <md-tabs aria-label="Analytics sections" id="sp-analytics">
        <md-tab label=${t(globals.locale, 'tabs.overview')} active></md-tab>
        <md-tab label=${t(globals.locale, 'tabs.activity')}></md-tab>
        <md-tab label=${t(globals.locale, 'tabs.reports')} badge="2"></md-tab>
      </md-tabs>
      <md-tab-panels>
        <md-tab-panel>
          <div style="padding: 16px 4px; font: 14px/1.6 system-ui;">
            <b>Sessions up 18%</b> week over week.<br />Peak traffic Tuesday 14:00 — 3,412 concurrent users.
          </div>
        </md-tab-panel>
        <md-tab-panel><div style="padding: 16px 4px; font: 14px/1.6 system-ui;">S</div></md-tab-panel>
        <md-tab-panel>
          <div style="padding: 16px 4px; font: 14px/1.6 system-ui; display: grid; gap: 12px;">
            ${['Weekly user growth — Mar 23, 2026', 'Revenue breakdown Q1 — Mar 20, 2026'].map(
              (r) => html`<div style="display: flex; align-items: center; gap: 12px;">
                <span class="material-symbols-outlined" style="color: var(--md-sys-color-primary, #6750A4);">description</span>
                <span style="flex: 1;">${r}</span>
                <md-button variant="text">${t(globals.locale, 'tabs.view')}</md-button>
              </div>`,
            )}
          </div>
        </md-tab-panel>
      </md-tab-panels>
    </div>

    <div style="display: inline-block; vertical-align: top; margin-inline-start: 28px; border: 1px solid color-mix(in srgb, currentColor 20%, transparent); border-radius: 16px; padding: 20px 24px;">
      <md-tabs aria-label="Media library" tab-width="auto">
        <md-tab label=${t(globals.locale, 'tabs.photos')} icon="photo_library" badge="24" active></md-tab>
        <md-tab label=${t(globals.locale, 'tabs.videos')} icon="videocam"></md-tab>
        <md-tab label=${t(globals.locale, 'tabs.audio')} icon="headphones" badge="3"></md-tab>
        <md-tab label=${t(globals.locale, 'tabs.documents')} icon="description"></md-tab>
      </md-tabs>
      <md-tab-panels>
        <md-tab-panel>
          <div style="padding: 16px 0; display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px;">
            ${['landscape', 'photo_camera', 'image', 'image', 'park', 'pets', 'portrait', 'terrain', 'sunny'].map(
              (ic) => html`<div style="aspect-ratio: 1; border-radius: 16px; background: color-mix(in srgb, currentColor 6%, transparent); display: grid; place-items: center;">
                <span class="material-symbols-outlined" style="font-size: 36px; color: var(--md-sys-color-primary, #6750A4);">${ic}</span>
              </div>`,
            )}
          </div>
        </md-tab-panel>
        <md-tab-panel><div style="padding: 16px 0; font: 14px system-ui;">2 videos</div></md-tab-panel>
        <md-tab-panel><div style="padding: 16px 0; font: 14px system-ui;">A</div></md-tab-panel>
        <md-tab-panel><div style="padding: 16px 0; font: 14px system-ui;">No documents yet.</div></md-tab-panel>
      </md-tab-panels>
    </div>
  `,
};

/* ─── Localization ─────────────────────────────────────── */

const TABS_I18N: Record<string, { dir: 'ltr' | 'rtl'; tablist: string; tabs: string[]; note: string }> = {
  'en-US': { dir: 'ltr', tablist: 'Account sections', tabs: ['Overview', 'Payments', 'Documents', 'Settings'], note: 'English (LTR)' },
  'de-DE': { dir: 'ltr', tablist: 'Kontobereiche', tabs: ['Übersicht', 'Zahlungen', 'Dokumente', 'Einstellungen'], note: 'Deutsch (LTR, long labels)' },
  'ja-JP': { dir: 'ltr', tablist: 'アカウント', tabs: ['概要', '支払い', '書類', '設定'], note: '日本語 (LTR, CJK)' },
  'ar-EG': { dir: 'rtl', tablist: 'أقسام الحساب', tabs: ['نظرة عامة', 'المدفوعات', 'المستندات', 'الإعدادات'], note: 'العربية (RTL — arrows invert to visual direction)' },
};

export const Localization: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Locale switcher: translated labels + `aria-label`, `Intl.NumberFormat` badge counts, and an RTL locale (ar-EG) proving the indicator, edge fades and **arrow keys follow the visual direction** (`dir="rtl"`).',
      },
    },
  },
  render: () => {
    const apply = (locale: string) => {
      const conf = TABS_I18N[locale];
      const wrap = document.getElementById('tabs-l10n-wrap')!;
      wrap.setAttribute('dir', conf.dir);
      const tabs = wrap.querySelector('md-tabs')!;
      tabs.setAttribute('aria-label', conf.tablist);
      const fmt = new Intl.NumberFormat(locale);
      Array.from(tabs.querySelectorAll('md-tab')).forEach((t, i) => {
        t.setAttribute('label', conf.tabs[i]);
        if (i === 1) t.setAttribute('badge', fmt.format(3));
        if (i === 2) t.setAttribute('badge', fmt.format(1284));
      });
      document.getElementById('tabs-l10n-note')!.textContent = conf.note;
    };
    return html`
      <div role="group" aria-label="Locale" style="display: flex; gap: 8px; margin-bottom: 14px;">
        ${Object.keys(TABS_I18N).map(
          (loc) => html`<md-button variant="tonal" @click=${() => apply(loc)}>${loc}</md-button>`,
        )}
      </div>
      <p id="tabs-l10n-note" style="font: 13px system-ui; color: var(--md-sys-color-on-surface-variant); margin: 0 0 10px;">English (LTR)</p>
      <div id="tabs-l10n-wrap" dir="ltr">
        <md-tabs aria-label="Account sections">
          <md-tab label="Overview" active></md-tab>
          <md-tab label="Payments" badge="3"></md-tab>
          <md-tab label="Documents" badge="1,284"></md-tab>
          <md-tab label="Settings"></md-tab>
        </md-tabs>
      </div>
    `;
  },
};

/* ─── Responsiveness ───────────────────────────────────── */

export const Responsive: Story = {
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        story:
          'Drag the native resize grip (bottom-right corner) to shrink the container: tabs overflow into a scrollable strip with **edge fades** on the clipped side, a vertical **mouse wheel scrolls it horizontally**, and keyboard navigation auto-scrolls the active tab into view.',
      },
    },
  },
  render: (_args, { globals }) => html`
    <div style="resize: horizontal; overflow: auto; inline-size: 600px; min-inline-size: 220px; max-inline-size: 100%; padding: 16px; border: 1px dashed var(--md-sys-color-outline, #79747E); border-radius: 12px;">
      <md-tabs aria-label="Sections">
        <md-tab label=${t(globals.locale, 'tabs.overview')} active></md-tab>
        <md-tab label=${t(globals.locale, 'tabs.payments')}></md-tab>
        <md-tab label=${t(globals.locale, 'tabs.documents')}></md-tab>
        <md-tab label=${t(globals.locale, 'tabs.analytics')}></md-tab>
        <md-tab label=${t(globals.locale, 'tabs.integrations')}></md-tab>
        <md-tab label=${t(globals.locale, 'tabs.notifications')}></md-tab>
        <md-tab label=${t(globals.locale, 'settings')}></md-tab>
      </md-tabs>
    </div>
  `,
};

/* ─── Accessibility ────────────────────────────────────── */

export const Accessibility: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Full WAI-ARIA APG Tabs wiring: labeled `tablist`, tabs with `aria-controls` → panels with `aria-labelledby` back-references, roving tabindex (exactly one tab stop), disabled tab skipped by arrows, **icon-only tab named via `aria-label`**, and visible focus ring. Keyboard: Arrow ←/→ (visual direction, wraps), Home/End, Enter/Space.',
      },
    },
  },
  render: (_args, { globals }) => {
    const showPanel = (index: number) => {
      document.querySelectorAll('#tabs-a11y-panels [role="tabpanel"]').forEach((p, i) => {
        (p as HTMLElement).hidden = i !== index;
      });
    };
    return html`
      <md-tabs aria-label="Project views" @mdTabChange=${(e: CustomEvent<{ index: number }>) => showPanel(e.detail.index)}>
        <md-tab id="a11y-tab-code" label=${t(globals.locale, 'tabs.code')} active controls="a11y-panel-code"></md-tab>
        <md-tab id="a11y-tab-issues" label=${t(globals.locale, 'tabs.issues')} badge="7" controls="a11y-panel-issues"></md-tab>
        <md-tab id="a11y-tab-archived" label=${t(globals.locale, 'tabs.archived')} disabled controls="a11y-panel-archived"></md-tab>
        <md-tab id="a11y-tab-settings" icon="settings" aria-label="Settings" controls="a11y-panel-settings"></md-tab>
      </md-tabs>
      <div id="tabs-a11y-panels" style="padding: 16px 4px; font: 14px/1.6 system-ui;">
        <div id="a11y-panel-code" role="tabpanel" aria-labelledby="a11y-tab-code" tabindex="0">
          Repository file tree and editors live here. Panels are focusable (<code>tabindex="0"</code>) so keyboard users land inside after Tab.
        </div>
        <div id="a11y-panel-issues" role="tabpanel" aria-labelledby="a11y-tab-issues" tabindex="0" hidden>
          Seven open issues — the badge count is exposed through its own <code>aria-label</code>.
        </div>
        <div id="a11y-panel-archived" role="tabpanel" aria-labelledby="a11y-tab-archived" tabindex="0" hidden>
          Unreachable while its tab is disabled.
        </div>
        <div id="a11y-panel-settings" role="tabpanel" aria-labelledby="a11y-tab-settings" tabindex="0" hidden>
          This panel's tab is icon-only — it is named via <code>aria-label="Settings"</code> (icon-only tabs without one warn in dev builds).
        </div>
      </div>
      <details style="font: 13px system-ui; opacity: 0.85;">
        <summary>Keyboard &amp; AT contract</summary>
        <ul style="line-height: 1.9;">
          <li><b>Tab</b> — one stop for the whole tablist (roving tabindex), then into the visible panel.</li>
          <li><b>← →</b> — move &amp; activate by <em>visual</em> direction (inverted under <code>dir="rtl"</code>), wrapping, skipping disabled tabs.</li>
          <li><b>Home / End</b> — first / last enabled tab.</li>
          <li><b>Enter / Space</b> — activate the focused tab.</li>
          <li>Selection state: <code>aria-selected</code>; disabled: <code>aria-disabled</code> + unreachable by arrows.</li>
          <li>Panels: <code>role="tabpanel"</code> + <code>aria-labelledby</code> pointing at the tab (IDREFs resolve — tabs are light-DOM elements).</li>
        </ul>
      </details>
    `;
  },
  /** The APG tablist keyboard flow, scripted (see the Interactions panel). */
  play: async ({ canvasElement, step }) => {
    const tabs = await getTabs(canvasElement);
    const tabEls = tabsOf(tabs);
    const panels = () =>
      [...canvasElement.querySelectorAll('[role="tabpanel"]')] as HTMLElement[];

    await step('Focus lands on the single roving tab stop (the active tab)', async () => {
      await waitFor(() =>
        expect(tabEls.map((t) => t.getAttribute('tabindex'))).toEqual(['0', '-1', '-1', '-1']),
      );
      tabEls[0].focus();
      await waitFor(() => expect(document.activeElement).toBe(tabEls[0]));
      expect(tabEls[0].getAttribute('aria-selected')).toBe('true');
    });

    await step('ArrowRight moves focus AND activates the next tab — the panel follows', async () => {
      key(tabEls[0], 'ArrowRight');
      await waitFor(() => expect(tabEls[1].getAttribute('aria-selected')).toBe('true'));
      expect(tabEls[0].getAttribute('aria-selected')).toBe('false');
      expect(document.activeElement).toBe(tabEls[1]);
      await waitFor(() => {
        expect(panels()[0].hidden).toBe(true);
        expect(panels()[1].hidden).toBe(false);
      });
    });

    await step('ArrowRight again SKIPS the disabled tab (Archived → Settings)', async () => {
      key(tabEls[1], 'ArrowRight');
      await waitFor(() => expect(tabEls[3].getAttribute('aria-selected')).toBe('true'));
      expect(tabEls[2].getAttribute('aria-selected')).toBe('false');
      expect(tabEls[2].getAttribute('tabindex')).toBe('-1');
      expect(document.activeElement).toBe(tabEls[3]);
      await waitFor(() => expect(panels()[3].hidden).toBe(false));
    });

    await step('Home returns to the first tab', async () => {
      key(tabEls[3], 'Home');
      await waitFor(() => expect(tabEls[0].getAttribute('aria-selected')).toBe('true'));
      expect(document.activeElement).toBe(tabEls[0]);
      await waitFor(() => expect(panels()[0].hidden).toBe(false));
      // Let the indicator glide + smooth auto-scroll settle before the play
      // returns — a teardown mid-animation registers as an unhandled error.
      await new Promise((r) => setTimeout(r, 300));
    });
  },
};

/* ─── Programmatic reconciliation (coverage) ───────────── */

export const ProgrammaticReconciliation: Story = {
  parameters: { layout: 'padded' },
  render: () => html`
    <md-tabs aria-label="Reconcile" style="max-width: 500px;">
      <md-tab label="One" active></md-tab>
      <md-tab label="Two"></md-tab>
      <md-tab label="Three"></md-tab>
      <md-tab label="Four"></md-tab>
    </md-tabs>
  `,
  /** Mutating the slotted set keeps selection coherent: follow the active
   *  ELEMENT across removals (emit only on a real selection change), honor a
   *  pending "append + select", and survive emptying then refilling. */
  play: async ({ canvasElement, step }) => {
    const tabs = (await getTabs(canvasElement)) as HTMLElement & { activeTabIndex: number };
    const labelOf = (el: HTMLElement | undefined) => el?.getAttribute('label');
    const active = () => tabsOf(tabs).find((el) => el.getAttribute('aria-selected') === 'true');

    await step('Baseline — "One" is active', async () => {
      await waitFor(() => expect(labelOf(active())).toBe('One'));
    });

    await step('Removing a NON-active tab keeps "One" selected and emits nothing', async () => {
      let fired = 0;
      const bump = () => { fired += 1; };
      tabs.addEventListener('mdTabChange', bump);
      tabsOf(tabs).find((el) => el.getAttribute('label') === 'Two')!.remove();
      await waitFor(() => expect(tabsOf(tabs).length).toBe(3));
      await waitFor(() => expect(labelOf(active())).toBe('One')); // selection followed identity
      await new Promise((r) => setTimeout(r, 50));
      tabs.removeEventListener('mdTabChange', bump);
      expect(fired).toBe(0);
    });

    await step('Removing the ACTIVE tab reconciles to a sibling and emits', async () => {
      let detail: { index: number; previousIndex: number } | undefined;
      tabs.addEventListener('mdTabChange', (e) => { detail = (e as CustomEvent).detail; }, { once: true });
      const one = tabsOf(tabs).find((el) => el.getAttribute('label') === 'One')!;
      one.remove();
      await waitFor(() => expect(tabsOf(tabs).length).toBe(2));
      await waitFor(() => expect(labelOf(active())).toBe('Three')); // nearest valid tab
      expect(one.hasAttribute('active')).toBe(false); // stripped from the departed tab
      expect(detail).toBeTruthy();
      expect(detail!.index).toBe(0); // identity changed even though the index held
    });

    await step('appendChild + activeTabIndex (same tick) honors the pending selection', async () => {
      let fired = 0;
      const bump = () => { fired += 1; };
      tabs.addEventListener('mdTabChange', bump);
      const five = document.createElement('md-tab');
      five.setAttribute('label', 'Five');
      tabs.appendChild(five);
      tabs.activeTabIndex = tabsOf(tabs).length - 1; // index of the just-appended tab
      await waitFor(() => expect(tabsOf(tabs).length).toBe(3));
      await waitFor(() => expect(labelOf(active())).toBe('Five')); // pending intent wins after slotchange
      await new Promise((r) => setTimeout(r, 50));
      tabs.removeEventListener('mdTabChange', bump);
      expect(fired).toBe(0); // consumer-initiated append → no emit
    });

    await step('Emptying the tablist clears selection; a re-added tab is selectable', async () => {
      tabsOf(tabs).forEach((el) => el.remove());
      await waitFor(() => expect(tabsOf(tabs).length).toBe(0));
      expect(active()).toBeUndefined(); // nothing claims the tab stop
      const solo = document.createElement('md-tab');
      solo.setAttribute('label', 'Solo');
      tabs.appendChild(solo);
      await waitFor(() => expect(labelOf(active())).toBe('Solo')); // recovered from empty
    });
  },
};

/* ─── Disabled roving & all-disabled (coverage) ────────── */

export const DisabledRoving: Story = {
  parameters: { layout: 'padded' },
  render: () => html`
    <md-tabs aria-label="Disabled roving" style="max-width: 500px;">
      <md-tab label="Alpha" active></md-tab>
      <md-tab label="Beta"></md-tab>
      <md-tab label="Gamma"></md-tab>
    </md-tabs>
  `,
  /** Disabling tabs re-roves the single tab stop, redirects selection away
   *  from a disabled target, and an all-disabled tablist loses its selection
   *  (index: -1). */
  play: async ({ canvasElement, step }) => {
    const tabs = (await getTabs(canvasElement)) as HTMLElement & { activeTabIndex: number };
    const tabEls = tabsOf(tabs) as (HTMLElement & { disabled: boolean })[];

    await step('Baseline roving — only the active tab is a tab stop', async () => {
      await waitFor(() =>
        expect(tabEls.map((t) => t.getAttribute('tabindex'))).toEqual(['0', '-1', '-1']),
      );
    });

    await step('Disabling an inactive tab drops it from the tab order', async () => {
      tabEls[2].disabled = true;
      await waitFor(() => expect(tabEls[2].getAttribute('tabindex')).toBe('-1'));
      await waitFor(() => expect(tabEls[2].getAttribute('aria-disabled')).toBe('true'));
      expect(tabEls[0].getAttribute('tabindex')).toBe('0'); // stop stays on the active tab
    });

    await step('Selecting a disabled tab is redirected to the nearest enabled one', async () => {
      tabs.activeTabIndex = 2; // Gamma is disabled
      await waitFor(() => expect(tabs.activeTabIndex).toBe(0)); // clamped back to Alpha
      expect(tabEls[0].getAttribute('aria-selected')).toBe('true');
      expect(tabEls[2].getAttribute('aria-selected')).toBe('false');
    });

    await step('Disabling the ACTIVE tab moves the tab stop to a still-enabled tab', async () => {
      tabEls[0].disabled = true;
      await waitFor(() => expect(tabEls[0].getAttribute('tabindex')).toBe('-1'));
      await waitFor(() => expect(tabEls[1].getAttribute('tabindex')).toBe('0')); // Beta holds it now
    });

    await step('An all-disabled tablist loses its selection and emits index -1', async () => {
      let detail: { index: number; previousIndex: number } | undefined;
      tabs.addEventListener('mdTabChange', (e) => { detail = (e as CustomEvent).detail; }, { once: true });
      tabEls[1].disabled = true;    // now every tab is disabled
      tabsOf(tabs)[2].remove();     // force a re-sync → reconcile with no enabled tab
      await waitFor(() => expect(detail?.index).toBe(-1));
      await waitFor(() =>
        expect(tabsOf(tabs).every((t) => t.getAttribute('aria-selected') === 'false')).toBe(true),
      );
    });
  },
};

/* ─── Wheel scrolling (coverage) ───────────────────────── */

export const WheelScroll: Story = {
  parameters: { layout: 'padded' },
  render: () => html`
    <md-tabs aria-label="Wheel scroll" style="max-width: 320px;">
      ${Array.from({ length: 9 }, (_, i) => html`<md-tab label=${`Section ${i + 1}`}></md-tab>`)}
    </md-tabs>
  `,
  /** A vertical mouse wheel scrolls the overflowing strip horizontally;
   *  horizontal-intent wheels pass through to native scrolling. */
  play: async ({ canvasElement, step }) => {
    const tabs = await getTabs(canvasElement);
    const container = tabs.shadowRoot!.querySelector('[part="container"]') as HTMLElement;
    const wheel = (init: WheelEventInit) =>
      container.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, ...init }));
    const reset = async () => {
      container.scrollTo({ left: 0, behavior: 'instant' as ScrollBehavior });
      await waitFor(() => expect(container.scrollLeft).toBe(0));
    };

    await step('The strip overflows its container', async () => {
      await waitFor(() => expect(container.scrollWidth).toBeGreaterThan(container.clientWidth));
    });

    await step('A vertical wheel (deltaY) scrolls the strip to the right', async () => {
      await reset();
      wheel({ deltaY: 200, deltaX: 0 });
      await waitFor(() => expect(container.scrollLeft).toBeGreaterThan(0));
    });

    await step('A horizontal-intent wheel is left to native scrolling (no interception)', async () => {
      await reset();
      wheel({ deltaX: 200, deltaY: 0 }); // |deltaX| >= |deltaY| → early return
      await new Promise((r) => setTimeout(r, 50));
      expect(container.scrollLeft).toBe(0); // handler did not scrollBy
    });

    await step('Line-mode wheel (deltaMode=1) applies the 16px-per-line factor', async () => {
      await reset();
      wheel({ deltaY: 4, deltaMode: 1 }); // 4 lines * 16 = 64px
      await waitFor(() => expect(container.scrollLeft).toBeGreaterThanOrEqual(48));
    });
  },
};

/* ─── Reparent rebind (coverage) ───────────────────────── */

export const Reparent: Story = {
  parameters: { layout: 'padded' },
  render: () => html`
    <div id="reparent-src">
      <md-tabs aria-label="Reparent" style="max-width: 500px;">
        <md-tab label="Home" active></md-tab>
        <md-tab label="Search"></md-tab>
        <md-tab label="Profile"></md-tab>
      </md-tabs>
    </div>
    <div id="reparent-dst" style="margin-top: 16px;"></div>
  `,
  /** Reparenting (appendChild elsewhere) disconnects + reconnects WITHOUT a
   *  slotchange — connectedCallback must re-bind so click/keyboard stay live. */
  play: async ({ canvasElement, step }) => {
    const tabs = await getTabs(canvasElement);
    const tabEls = tabsOf(tabs);
    const dst = canvasElement.querySelector('#reparent-dst') as HTMLElement;

    await step('Baseline — the tablist works before reparenting', async () => {
      tabEls[1].click();
      await waitFor(() => expect(tabEls[1].getAttribute('aria-selected')).toBe('true'));
    });

    await step('After moving the whole md-tabs to a new parent it stays interactive', async () => {
      dst.appendChild(tabs); // disconnect + reconnect, no slotchange
      await waitFor(() => expect(tabs.parentElement).toBe(dst));

      // Click must still activate — proving connectedCallback re-bound listeners.
      let detail: { index: number; previousIndex: number } | undefined;
      tabs.addEventListener('mdTabChange', (e) => { detail = (e as CustomEvent).detail; }, { once: true });
      tabEls[2].click();
      await waitFor(() => expect(tabEls[2].getAttribute('aria-selected')).toBe('true'));
      expect(tabEls[1].getAttribute('aria-selected')).toBe('false');
      expect(detail).toEqual({ index: 2, previousIndex: 1 });

      // Keyboard still routes through the re-bound host handler.
      tabEls[2].focus();
      key(tabEls[2], 'ArrowLeft');
      await waitFor(() => expect(tabEls[1].getAttribute('aria-selected')).toBe('true'));
      expect(document.activeElement).toBe(tabEls[1]);
      await new Promise((r) => setTimeout(r, 300));
    });
  },
};

/* ─── Fully disabled tablist (coverage) ────────────────── */

export const AllDisabled: Story = {
  parameters: { layout: 'padded' },
  render: () => html`
    <md-tabs aria-label="All disabled" style="max-width: 500px;">
      <md-tab label="One" disabled></md-tab>
      <md-tab label="Two" disabled></md-tab>
      <md-tab label="Three" disabled></md-tab>
    </md-tabs>
  `,
  /** A fully-disabled tablist holds the roving invariant: NO tab is a tab
   *  stop, and even a programmatic selection request (which walks every tab
   *  looking for an enabled one and finds none) never hands out a
   *  keyboard-focusable tabindex=0. */
  play: async ({ canvasElement, step }) => {
    const tabs = (await getTabs(canvasElement)) as HTMLElement & { activeTabIndex: number };
    const tabEls = tabsOf(tabs);

    await step('No tab is a tab stop and none is selected when every tab is disabled', async () => {
      await waitFor(() =>
        expect(tabEls.map((t) => t.getAttribute('tabindex'))).toEqual(['-1', '-1', '-1']),
      );
      expect(tabEls.every((t) => t.getAttribute('aria-selected') === 'false')).toBe(true);
    });

    await step('Requesting a selection finds no enabled tab and grants no tab stop', async () => {
      let fired = 0;
      const bump = () => { fired += 1; };
      tabs.addEventListener('mdTabChange', bump);
      tabs.activeTabIndex = 1; // onActiveChange → clampIndex → findNextEnabledWrapping (no enabled → null)
      await waitFor(() =>
        expect(tabEls.map((t) => t.getAttribute('tabindex'))).toEqual(['-1', '-1', '-1']),
      );
      await new Promise((r) => setTimeout(r, 50));
      tabs.removeEventListener('mdTabChange', bump);
      expect(fired).toBe(0); // prop path is consumer-initiated — no emit
    });
  },
};
