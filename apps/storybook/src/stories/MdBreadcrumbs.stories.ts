import type { Meta, StoryObj } from '@storybook/web-components';
import { expect, waitFor } from 'storybook/test';
import { html } from 'lit';
import { t } from '../i18n';

/** Shadow-piercing helpers for play(): testing-library queries can't cross
 *  shadow roots, so interactions address the components' internals directly. */
interface MdSelectDetail {
  href: string;
  label: string;
  current: boolean;
  itemIndex: number;
  itemTotal: number;
}
const getBreadcrumbs = async (
  canvasElement: HTMLElement,
  index = 0,
): Promise<HTMLElement> => {
  const bc = canvasElement.querySelectorAll('md-breadcrumbs')[index] as HTMLElement;
  await waitFor(() => expect(bc.classList.contains('hydrated')).toBe(true));
  return bc;
};
const itemsOf = (bc: HTMLElement) =>
  Array.from(bc.querySelectorAll('md-breadcrumb-item')) as HTMLElement[];
/** Crumbs the trail is actually showing (folded middle items reflect `collapsed`). */
const visibleItemsOf = (bc: HTMLElement) =>
  bc.querySelectorAll('md-breadcrumb-item:not([collapsed])');
/** The rendered `<a>` for a navigable crumb — null for current/disabled ones. */
const linkOf = (item: HTMLElement) =>
  item.shadowRoot!.querySelector('a.md-breadcrumb-item__link') as HTMLAnchorElement | null;
const overflowBtnOf = (bc: HTMLElement) =>
  bc.shadowRoot!.querySelector('button.md-breadcrumbs__overflow-btn') as HTMLButtonElement | null;

const meta: Meta = {
  title: 'Navigation/Breadcrumbs',
  component: 'md-breadcrumbs',
  tags: ['autodocs'],
  parameters: { docs: { source: { language: 'html' } } },
  argTypes: {
    label: { control: 'text', description: 'aria-label for the navigation landmark.' },
    'expand-label': {
      control: 'text',
      description: 'aria-label for the overflow ("…") toggle button.',
    },
    separator: { control: 'text' },
    'max-items': { control: { type: 'number', min: 0, max: 12, step: 1 } },
  },
  args: {
    label: 'Breadcrumb',
    'expand-label': 'Show full breadcrumb trail',
    separator: '/',
    'max-items': 0,
  },
};
export default meta;
type Story = StoryObj;

const labelStyle =
  'font: 500 11px/16px Roboto, sans-serif; color: var(--md-sys-color-on-surface-variant, #49454F); text-transform: uppercase; letter-spacing: 0.5px; padding-bottom: 6px;';

/* ─── Playground ──────────────────────────────────────────── */
export const Playground: Story = {
  render: (args, { globals }) => html`
    <md-breadcrumbs
      label=${args.label}
      expand-label=${args['expand-label']}
      separator=${args.separator}
      max-items=${args['max-items']}
    >
      <md-breadcrumb-item href="/">${t(globals.locale, 'home')}</md-breadcrumb-item>
      <md-breadcrumb-item href="/library">${t(globals.locale, 'breadcrumbs.library')}</md-breadcrumb-item>
      <md-breadcrumb-item href="/library/data">${t(globals.locale, 'breadcrumbs.data')}</md-breadcrumb-item>
      <md-breadcrumb-item>${t(globals.locale, 'breadcrumbs.breadcrumbs')}</md-breadcrumb-item>
    </md-breadcrumbs>
  `,
  /** Activating a crumb fires cancelable `mdSelect` with its href/label/position;
   *  the auto-promoted leaf is inert. */
  play: async ({ canvasElement, step }) => {
    const bc = await getBreadcrumbs(canvasElement);

    await step('Navigable crumb renders a real anchor pointing at its href', async () => {
      const items = itemsOf(bc);
      expect(items.length).toBe(4);
      await waitFor(() => expect(linkOf(items[1])).not.toBeNull());
      // href comes from the item's own prop → real <a>, so open-in-new-tab works.
      expect(linkOf(items[1])!.getAttribute('href')).toBe('/library');
    });

    await step('Clicking a crumb emits cancelable mdSelect with href, label + position', async () => {
      const items = itemsOf(bc);
      let detail: MdSelectDetail | undefined;
      const onSelect = (e: Event) => {
        detail = (e as CustomEvent<MdSelectDetail>).detail;
        // SPA-intercept so the real <a> never navigates the test page away.
        e.preventDefault();
      };
      bc.addEventListener('mdSelect', onSelect);
      linkOf(items[1])!.click();
      await waitFor(() => expect(detail).toBeTruthy());
      expect(detail!.href).toBe('/library'); // payload the component built, not one we set
      expect(detail!.label).toBe('Library'); // read from the crumb's own text content
      expect(detail!.itemIndex).toBe(1); // 0-indexed position seeded by the parent
      expect(detail!.itemTotal).toBe(4); // parent seeded the whole trail size
      expect(detail!.current).toBe(false); // a mid-trail crumb, not the leaf
      bc.removeEventListener('mdSelect', onSelect);
    });

    await step('The auto-promoted leaf is a non-navigable span that emits nothing', async () => {
      const items = itemsOf(bc);
      const leaf = items[items.length - 1];
      expect(linkOf(leaf)).toBeNull(); // no href → rendered as a static span, no <a>
      const staticEl = leaf.shadowRoot!.querySelector(
        '.md-breadcrumb-item__static',
      ) as HTMLElement;
      expect(staticEl.getAttribute('aria-current')).toBe('page'); // last crumb promoted to current
      let fired = false;
      bc.addEventListener('mdSelect', () => { fired = true; }, { once: true });
      staticEl.click();
      await new Promise((r) => setTimeout(r, 50));
      expect(fired).toBe(false); // guard: the current page never fires a navigate event
    });
  },
};

/* ─── Separators ──────────────────────────────────────────── */
export const Separators: Story = {
  render: (_args, { globals }) => html`
    <div style="display: grid; gap: 16px;">
      <div>
        <div style="${labelStyle}">Default ("/")</div>
        <md-breadcrumbs>
          <md-breadcrumb-item href="/">${t(globals.locale, 'home')}</md-breadcrumb-item>
          <md-breadcrumb-item href="/a">${t(globals.locale, 'breadcrumbs.docs')}</md-breadcrumb-item>
          <md-breadcrumb-item>${t(globals.locale, 'breadcrumbs.reference')}</md-breadcrumb-item>
        </md-breadcrumbs>
      </div>
      <div>
        <div style="${labelStyle}">Chevron ("›")</div>
        <md-breadcrumbs separator="›">
          <md-breadcrumb-item href="/">${t(globals.locale, 'home')}</md-breadcrumb-item>
          <md-breadcrumb-item href="/a">${t(globals.locale, 'breadcrumbs.docs')}</md-breadcrumb-item>
          <md-breadcrumb-item>${t(globals.locale, 'breadcrumbs.reference')}</md-breadcrumb-item>
        </md-breadcrumbs>
      </div>
      <div>
        <div style="${labelStyle}">Arrow ("→")</div>
        <md-breadcrumbs separator="→">
          <md-breadcrumb-item href="/">${t(globals.locale, 'home')}</md-breadcrumb-item>
          <md-breadcrumb-item href="/a">${t(globals.locale, 'breadcrumbs.docs')}</md-breadcrumb-item>
          <md-breadcrumb-item>${t(globals.locale, 'breadcrumbs.reference')}</md-breadcrumb-item>
        </md-breadcrumbs>
      </div>
      <div>
        <div style="${labelStyle}">Dot ("·")</div>
        <md-breadcrumbs separator="·">
          <md-breadcrumb-item href="/">${t(globals.locale, 'home')}</md-breadcrumb-item>
          <md-breadcrumb-item href="/a">${t(globals.locale, 'breadcrumbs.docs')}</md-breadcrumb-item>
          <md-breadcrumb-item>${t(globals.locale, 'breadcrumbs.reference')}</md-breadcrumb-item>
        </md-breadcrumbs>
      </div>
    </div>
  `,
};

/* ─── With Icons ──────────────────────────────────────────── */
export const WithIcons: Story = {
  render: (_args, { globals }) => html`
    <md-breadcrumbs>
      <md-breadcrumb-item href="/" icon="home">${t(globals.locale, 'home')}</md-breadcrumb-item>
      <md-breadcrumb-item href="/settings" icon="settings">${t(globals.locale, 'settings')}</md-breadcrumb-item>
      <md-breadcrumb-item icon="person">${t(globals.locale, 'breadcrumbs.account')}</md-breadcrumb-item>
    </md-breadcrumbs>
  `,
};

/* ─── Collapse long paths ─────────────────────────────────── */
export const Collapsed: Story = {
  render: (_args, { globals }) => html`
    <div style="display: grid; gap: 16px;">
      <div>
        <div style="${labelStyle}">max-items="4" (1 before, 2 after)</div>
        <md-breadcrumbs max-items="4" items-before-collapse="1" items-after-collapse="2">
          <md-breadcrumb-item href="/">${t(globals.locale, 'home')}</md-breadcrumb-item>
          <md-breadcrumb-item href="/a">${t(globals.locale, 'breadcrumbs.catalog')}</md-breadcrumb-item>
          <md-breadcrumb-item href="/a/b">${t(globals.locale, 'breadcrumbs.outdoors')}</md-breadcrumb-item>
          <md-breadcrumb-item href="/a/b/c">${t(globals.locale, 'breadcrumbs.tents')}</md-breadcrumb-item>
          <md-breadcrumb-item href="/a/b/c/d">3-Person</md-breadcrumb-item>
          <md-breadcrumb-item>"Alpine 3"</md-breadcrumb-item>
        </md-breadcrumbs>
      </div>
      <div>
        <div style="${labelStyle}">max-items="3" (1 before, 1 after)</div>
        <md-breadcrumbs max-items="3" items-after-collapse="1">
          <md-breadcrumb-item href="/">${t(globals.locale, 'home')}</md-breadcrumb-item>
          <md-breadcrumb-item href="/a">${t(globals.locale, 'breadcrumbs.library')}</md-breadcrumb-item>
          <md-breadcrumb-item href="/a/b">${t(globals.locale, 'breadcrumbs.data')}</md-breadcrumb-item>
          <md-breadcrumb-item href="/a/b/c">${t(globals.locale, 'breadcrumbs.analytics')}</md-breadcrumb-item>
          <md-breadcrumb-item href="/a/b/c/d">${t(globals.locale, 'breadcrumbs.reports')}</md-breadcrumb-item>
          <md-breadcrumb-item>April 2026</md-breadcrumb-item>
        </md-breadcrumbs>
      </div>
    </div>
  `,
  /** Clicking the "…" overflow toggle unfolds the hidden middle crumbs
   *  (3 shown → 6 shown) and emits `mdExpand`. Drives the first trail. */
  play: async ({ canvasElement, step }) => {
    const bc = await getBreadcrumbs(canvasElement, 0); // max-items=4, 1 before / 2 after

    await step('Middle crumbs start folded behind the overflow toggle', async () => {
      expect(itemsOf(bc).length).toBe(6); // all six crumbs stay in the DOM…
      await waitFor(() => expect(visibleItemsOf(bc).length).toBe(3)); // …but only 3 are shown
      const btn = overflowBtnOf(bc);
      expect(btn).not.toBeNull();
      expect(btn!.getAttribute('aria-expanded')).toBe('false'); // trail is collapsed
    });

    await step('Clicking the toggle unfolds the hidden crumbs (3 → 6) and emits mdExpand', async () => {
      const before = visibleItemsOf(bc).length; // 3
      let detail: { expanded: boolean; itemCount: number } | undefined;
      bc.addEventListener(
        'mdExpand',
        (e) => { detail = (e as CustomEvent).detail; },
        { once: true },
      );
      overflowBtnOf(bc)!.click();
      await waitFor(() => expect(visibleItemsOf(bc).length).toBeGreaterThan(before)); // it MOVED
      expect(visibleItemsOf(bc).length).toBe(6); // …to fully expanded — every crumb shown
      expect(overflowBtnOf(bc)).toBeNull(); // toggle removed once the trail is open
      expect(detail?.expanded).toBe(true); // component reported the new state…
      expect(detail?.itemCount).toBe(6); // …and the true trail size
      await new Promise((r) => setTimeout(r, 300)); // let the staggered entrance settle
    });

    await step('collapse() programmatically re-folds the open trail and emits mdExpand{expanded:false}', async () => {
      // The trail is fully expanded from the previous step; the public
      // collapse() method should re-fold it to the 1-before / 2-after window.
      let detail: { expanded: boolean; itemCount: number } | undefined;
      bc.addEventListener(
        'mdExpand',
        (e) => { detail = (e as CustomEvent).detail; },
        { once: true },
      );
      await (bc as HTMLElement & { collapse?: () => Promise<void> }).collapse?.();
      await waitFor(() => expect(visibleItemsOf(bc).length).toBe(3)); // folded back to 1 + 2
      const btn = overflowBtnOf(bc);
      expect(btn).not.toBeNull(); // overflow toggle reinstated
      expect(btn!.getAttribute('aria-expanded')).toBe('false'); // collapsed state reflected
      expect(detail?.expanded).toBe(false); // component announced the collapse…
      expect(detail?.itemCount).toBe(6); // …with the full trail size, not the visible count
    });

    await step('expand() programmatically reveals the whole trail again and emits mdExpand{expanded:true}', async () => {
      let detail: { expanded: boolean; itemCount: number } | undefined;
      bc.addEventListener(
        'mdExpand',
        (e) => { detail = (e as CustomEvent).detail; },
        { once: true },
      );
      await (bc as HTMLElement & { expand?: () => Promise<void> }).expand?.();
      await waitFor(() => expect(visibleItemsOf(bc).length).toBe(6)); // every crumb visible
      expect(overflowBtnOf(bc)).toBeNull(); // toggle removed once fully open
      expect(detail?.expanded).toBe(true); // component announced the expansion
    });

    await step('expand() while already expanded is an idempotent no-op (guard short-circuits, no duplicate mdExpand)', async () => {
      let fired = false;
      bc.addEventListener('mdExpand', () => { fired = true; }, { once: true });
      await (bc as HTMLElement & { expand?: () => Promise<void> }).expand?.();
      await new Promise((r) => setTimeout(r, 50));
      expect(fired).toBe(false); // no state change → no event re-emitted
      expect(visibleItemsOf(bc).length).toBe(6); // trail stays fully expanded
    });

    await step('Reconfiguring max-items at runtime re-collapses via the @Watch handler', async () => {
      const bc2 = await getBreadcrumbs(canvasElement, 1); // max-items=3 → 2 visible (1 before + 1 after)
      await waitFor(() => expect(visibleItemsOf(bc2).length).toBe(2)); // folded on load
      expect(overflowBtnOf(bc2)).not.toBeNull(); // overflow toggle present while folded
      // Raise the cap above the crumb count: the watch re-runs collapse logic
      // and, since 6 items now fit under max-items=6, folding switches off.
      (bc2 as HTMLElement & { maxItems: number }).maxItems = 6;
      await waitFor(() => expect(visibleItemsOf(bc2).length).toBe(6)); // watch re-expanded the trail
      expect(overflowBtnOf(bc2)).toBeNull(); // nothing folded → no overflow toggle
    });
  },
};

/* ─── Custom Separator (string + ::part) ──────────────────── */
export const CustomSeparator: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Two ways to customise the separator visual:\n\n' +
          '1. **Set the `separator` prop to any glyph** (›, →, »…) — the simplest path.\n' +
          '2. **Style `::part(separator)`** from the light DOM. This lets you swap the ' +
          'glyph for a CSS-rendered SVG (via `background-image`) at every position in the ' +
          'trail without needing slot cloning. Because each separator span gets a part ' +
          'attribute, you keep full control of size, colour, spacing, and theme.',
      },
    },
  },
  render: (_args, { globals }) => html`
    <style>
      .glyph md-breadcrumbs::part(separator) {
        font-size: 14px;
        margin-inline: 4px;
        color: var(--md-sys-color-primary, #6750a4);
      }
      .svg-glyph md-breadcrumbs::part(separator) {
        /* Hide the prop-based string and replace it with an inline SVG via
           a CSS background-image on a fixed-size pseudo-element. The
           identical visual repeats at every position automatically. */
        font-size: 0;
        inline-size: 14px;
        block-size: 14px;
        margin-inline: 6px;
        background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%236750a4'><path d='M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z'/></svg>");
        background-repeat: no-repeat;
        background-position: center;
        background-size: contain;
      }
    </style>

    <div style="display: flex; flex-direction: column; gap: 24px;">
      <section>
        <h4 style="margin: 0 0 8px;">Glyph via prop</h4>
        <div class="glyph">
          <md-breadcrumbs separator="›">
            <md-breadcrumb-item href="/">${t(globals.locale, 'home')}</md-breadcrumb-item>
            <md-breadcrumb-item href="/library">${t(globals.locale, 'breadcrumbs.library')}</md-breadcrumb-item>
            <md-breadcrumb-item href="/library/data">${t(globals.locale, 'breadcrumbs.data')}</md-breadcrumb-item>
            <md-breadcrumb-item>${t(globals.locale, 'breadcrumbs.analytics')}</md-breadcrumb-item>
          </md-breadcrumbs>
        </div>
      </section>

      <section>
        <h4 style="margin: 0 0 8px;">SVG via <code>::part(separator)</code></h4>
        <div class="svg-glyph">
          <md-breadcrumbs>
            <md-breadcrumb-item href="/">${t(globals.locale, 'home')}</md-breadcrumb-item>
            <md-breadcrumb-item href="/library">${t(globals.locale, 'breadcrumbs.library')}</md-breadcrumb-item>
            <md-breadcrumb-item href="/library/data">${t(globals.locale, 'breadcrumbs.data')}</md-breadcrumb-item>
            <md-breadcrumb-item>${t(globals.locale, 'breadcrumbs.analytics')}</md-breadcrumb-item>
          </md-breadcrumbs>
        </div>
      </section>
    </div>
  `,
};

/* ─── Disabled ────────────────────────────────────────────── */
export const Disabled: Story = {
  render: (_args, { globals }) => html`
    <md-breadcrumbs>
      <md-breadcrumb-item href="/">${t(globals.locale, 'home')}</md-breadcrumb-item>
      <md-breadcrumb-item href="/admin" disabled>${t(globals.locale, 'breadcrumbs.admin-locked')}</md-breadcrumb-item>
      <md-breadcrumb-item href="/admin/users">${t(globals.locale, 'breadcrumbs.users')}</md-breadcrumb-item>
      <md-breadcrumb-item>"Jane Doe"</md-breadcrumb-item>
    </md-breadcrumbs>
  `,
};

/* ─── RTL ─────────────────────────────────────────────────── */
export const RTL: Story = {
  render: () => html`
    <div dir="rtl">
      <md-breadcrumbs separator="›">
        <md-breadcrumb-item href="/">الرئيسية</md-breadcrumb-item>
        <md-breadcrumb-item href="/library">المكتبة</md-breadcrumb-item>
        <md-breadcrumb-item href="/library/data">البيانات</md-breadcrumb-item>
        <md-breadcrumb-item>تحليلات</md-breadcrumb-item>
      </md-breadcrumbs>
    </div>
  `,
};

/* ─── Dark Theme ──────────────────────────────────────────── */
export const DarkTheme: Story = {
  render: (_args, { globals }) => html`
    <md-breadcrumbs>
      <md-breadcrumb-item href="/" icon="home">${t(globals.locale, 'home')}</md-breadcrumb-item>
      <md-breadcrumb-item href="/d">${t(globals.locale, 'breadcrumbs.docs')}</md-breadcrumb-item>
      <md-breadcrumb-item href="/d/c">${t(globals.locale, 'breadcrumbs.components')}</md-breadcrumb-item>
      <md-breadcrumb-item>${t(globals.locale, 'breadcrumbs.breadcrumbs')}</md-breadcrumb-item>
    </md-breadcrumbs>
  `,
  decorators: [
    (story) => html`
      <div
        data-theme="dark"
        style="background: var(--md-sys-color-surface, #1C1B1F); padding: 24px; border-radius: 16px;"
      >
        ${story()}
      </div>
    `,
  ],
};

/* ─── Custom CSS ──────────────────────────────────────────── */
export const CustomCSS: Story = {
  render: (_args, { globals }) => html`
    <style>
      .brand {
        --md-breadcrumbs-separator-color: #00897b;
        --md-breadcrumb-item-link-color: #00796b;
        --md-breadcrumb-item-hover-color: #00695c;
        --md-breadcrumb-item-current-color: #004d40;
      }
    </style>
    <md-breadcrumbs class="brand">
      <md-breadcrumb-item href="/">${t(globals.locale, 'breadcrumbs.workspace')}</md-breadcrumb-item>
      <md-breadcrumb-item href="/projects">${t(globals.locale, 'breadcrumbs.projects')}</md-breadcrumb-item>
      <md-breadcrumb-item>AWC redesign</md-breadcrumb-item>
    </md-breadcrumbs>
  `,
};

/* ═══════════════════════════════════════════════════════════
   ACCESSIBILITY
   ═══════════════════════════════════════════════════════════ */

const kbdStyle =
  'display:inline-flex; align-items:center; padding: 2px 6px; min-inline-size: 24px; ' +
  'border-radius: 4px; background: var(--md-sys-color-surface-container, #F3EDF7); ' +
  'border: 1px solid var(--md-sys-color-outline-variant, #CAC4D0); ' +
  'font: 500 11px/14px ui-monospace, SFMono-Regular, Menlo, monospace; ' +
  'color: var(--md-sys-color-on-surface, #1C1B1F);';

/**
 * Breadcrumbs implement the WAI-ARIA breadcrumb pattern. The walkthrough
 * below covers the four pieces consumers should verify in their own
 * usage: landmark naming, `aria-current="page"` on the leaf, the
 * disabled / current static fallback, and keyboard navigation through
 * the overflow toggle.
 */
export const Accessibility: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Native semantics: `<nav role="navigation">` landmark, `<ol>` ' +
          'list, `aria-current="page"` on the leaf crumb, `aria-hidden` ' +
          'on every separator, and a real `<a>` with a real `href` so the ' +
          'browser, screen readers, and the keyboard all treat each ' +
          'crumb as a regular link. The overflow toggle is a real ' +
          '`<button>` with `aria-expanded`.',
      },
    },
  },
  render: (_args, { globals }) => html`
    <style>
      .bc-a11y {
        display: grid;
        gap: 24px;
        font-family: var(--md-sys-typescale-body-large-font-family, Roboto, sans-serif);
      }
      .bc-a11y section {
        padding: 16px 20px;
        border-radius: 16px;
        background: var(--md-sys-color-surface-container-lowest, #FFFBFE);
        border: 1px solid var(--md-sys-color-outline-variant, #CAC4D0);
      }
      .bc-a11y h4 {
        margin: 0 0 6px;
        font: 500 12px/16px Roboto, sans-serif;
        color: var(--md-sys-color-on-surface-variant, #49454F);
        text-transform: uppercase;
        letter-spacing: 0.6px;
      }
      .bc-a11y p {
        margin: 0 0 12px;
        font: 400 13px/20px Roboto, sans-serif;
        color: var(--md-sys-color-on-surface, #1C1B1F);
        max-inline-size: 760px;
      }
      .bc-a11y code {
        background: var(--md-sys-color-surface-container, #F3EDF7);
        padding: 1px 6px;
        border-radius: 4px;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 12px;
      }
      .bc-a11y .bc-a11y__attrs {
        display: grid;
        grid-template-columns: minmax(180px, auto) 1fr;
        gap: 6px 16px;
        font-size: 13px;
        margin-block-start: 8px;
      }
      .bc-a11y .bc-a11y__keys {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 8px 16px;
        align-items: center;
        font-size: 13px;
        margin-block-start: 8px;
      }
    </style>

    <div class="bc-a11y">
      <section>
        <h4>1 · Landmark + accessible name</h4>
        <p>
          The host renders as a navigation landmark with an
          <code>aria-label</code>. Override the default
          <code>"Breadcrumb"</code> with anything more specific to your
          page so screen-reader users can distinguish multiple
          navigation regions.
        </p>
        <md-breadcrumbs label="Page navigation: Library › Data › Reports">
          <md-breadcrumb-item href="/" icon="home">${t(globals.locale, 'home')}</md-breadcrumb-item>
          <md-breadcrumb-item href="/library">${t(globals.locale, 'breadcrumbs.library')}</md-breadcrumb-item>
          <md-breadcrumb-item href="/library/data">${t(globals.locale, 'breadcrumbs.data')}</md-breadcrumb-item>
          <md-breadcrumb-item>${t(globals.locale, 'breadcrumbs.reports')}</md-breadcrumb-item>
        </md-breadcrumbs>
        <div class="bc-a11y__attrs">
          <code>role="navigation"</code><span>Identifies the trail as a landmark to AT.</span>
          <code>aria-label</code><span>Disambiguates this nav from other landmarks on the page.</span>
          <code>&lt;ol&gt;</code><span>Native ordered list — exposes structure even with CSS off.</span>
        </div>
      </section>

      <section>
        <h4>2 · aria-current on the leaf</h4>
        <p>
          The last item is automatically promoted to the current page —
          rendered as a non-link <code>&lt;span&gt;</code> with
          <code>aria-current="page"</code>. Screen readers announce
          "current page" so users know they are already there.
        </p>
        <md-breadcrumbs>
          <md-breadcrumb-item href="/">${t(globals.locale, 'home')}</md-breadcrumb-item>
          <md-breadcrumb-item href="/users">${t(globals.locale, 'breadcrumbs.users')}</md-breadcrumb-item>
          <md-breadcrumb-item href="/users/jane">Jane Doe</md-breadcrumb-item>
          <md-breadcrumb-item>${t(globals.locale, 'breadcrumbs.profile')}</md-breadcrumb-item>
        </md-breadcrumbs>
        <p style="margin-block-start: 12px;">
          You can also explicitly mark a non-leaf item as current with
          the <code>current</code> attribute — the parent will respect
          your override and skip the auto-promotion:
        </p>
        <md-breadcrumbs>
          <md-breadcrumb-item href="/">${t(globals.locale, 'home')}</md-breadcrumb-item>
          <md-breadcrumb-item href="/users" current>${t(globals.locale, 'breadcrumbs.users')}</md-breadcrumb-item>
          <md-breadcrumb-item href="/users/jane">Jane Doe</md-breadcrumb-item>
          <md-breadcrumb-item href="/users/jane/profile">${t(globals.locale, 'breadcrumbs.profile')}</md-breadcrumb-item>
        </md-breadcrumbs>
      </section>

      <section>
        <h4>3 · Disabled crumbs</h4>
        <p>
          A <code>disabled</code> crumb renders as a non-focusable
          <code>&lt;span&gt;</code>. There's no anchor to click and no
          <code>tabindex</code>, so keyboard users skip past it. Use it
          for paths the current user can't access — e.g. permission-gated
          subtrees in admin tools — and pair it with descriptive label
          copy so the reason is obvious.
        </p>
        <md-breadcrumbs>
          <md-breadcrumb-item href="/">${t(globals.locale, 'home')}</md-breadcrumb-item>
          <md-breadcrumb-item href="/admin" disabled>${t(globals.locale, 'breadcrumbs.admin-locked')}</md-breadcrumb-item>
          <md-breadcrumb-item href="/admin/users">${t(globals.locale, 'breadcrumbs.users')}</md-breadcrumb-item>
          <md-breadcrumb-item>"Jane Doe"</md-breadcrumb-item>
        </md-breadcrumbs>
      </section>

      <section>
        <h4>4 · Keyboard navigation</h4>
        <p>
          Every navigable crumb is a real <code>&lt;a&gt;</code>, so
          keyboard mechanics come from the platform — no custom keymap
          needed. The collapsed-trail toggle is a real
          <code>&lt;button&gt;</code> with <code>aria-expanded</code>
          that flips when the trail unfolds.
        </p>
        <div class="bc-a11y__keys">
          <kbd style="${kbdStyle}">Tab</kbd>
          <span>Move focus to the next crumb / overflow button.</span>
          <kbd style="${kbdStyle}">Shift+Tab</kbd>
          <span>Move focus backwards.</span>
          <kbd style="${kbdStyle}">Enter</kbd>
          <span>Activate the focused crumb (fires <code>mdSelect</code>) or expand the collapsed trail.</span>
          <kbd style="${kbdStyle}">Space</kbd>
          <span>Activate the overflow ("…") button to expand the trail.</span>
        </div>
        <p style="margin-block-start: 12px;">
          Try it: tab into the trail below, then press <kbd style="${kbdStyle}">Enter</kbd>
          on the "…" button to expand. <code>aria-expanded</code> flips
          to <code>true</code>; the change is announced as
          "expanded, button" in most screen readers.
        </p>
        <md-breadcrumbs max-items="4" items-before-collapse="1" items-after-collapse="2">
          <md-breadcrumb-item href="/">${t(globals.locale, 'home')}</md-breadcrumb-item>
          <md-breadcrumb-item href="/a">${t(globals.locale, 'breadcrumbs.catalog')}</md-breadcrumb-item>
          <md-breadcrumb-item href="/a/b">${t(globals.locale, 'breadcrumbs.outdoors')}</md-breadcrumb-item>
          <md-breadcrumb-item href="/a/b/c">${t(globals.locale, 'breadcrumbs.tents')}</md-breadcrumb-item>
          <md-breadcrumb-item href="/a/b/c/d">3-Person</md-breadcrumb-item>
          <md-breadcrumb-item>"Alpine 3"</md-breadcrumb-item>
        </md-breadcrumbs>
      </section>

      <section>
        <h4>5 · Hidden separators</h4>
        <p>
          Separator glyphs (the "/", "›", or any custom character / SVG)
          carry <code>aria-hidden="true"</code> so screen readers don't
          announce them. The structural list and current-page semantics
          give AT all the context it needs.
        </p>
        <md-breadcrumbs separator="›">
          <md-breadcrumb-item href="/">${t(globals.locale, 'home')}</md-breadcrumb-item>
          <md-breadcrumb-item href="/library">${t(globals.locale, 'breadcrumbs.library')}</md-breadcrumb-item>
          <md-breadcrumb-item>${t(globals.locale, 'breadcrumbs.reports')}</md-breadcrumb-item>
        </md-breadcrumbs>
      </section>
    </div>
  `,
};

/* ═══════════════════════════════════════════════════════════
   LOCALIZATION
   ═══════════════════════════════════════════════════════════ */

/**
 * The component itself stays content-neutral: every visible string
 * (the trail labels, the `label` ARIA name, the overflow button's
 * `expand-label`, separator glyphs) is consumer-controlled. Drop your
 * i18n layer's translations straight into the props / slots, and let
 * `dir="rtl"` on a parent flip the trail direction.
 */
export const Localization: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'The same trail rendered for seven locales. The component picks ' +
          'up <code>lang</code> + <code>dir</code> from a wrapping element ' +
          'and uses CSS logical properties everywhere, so RTL scripts ' +
          'flip naturally — including the staggered entrance animation. ' +
          'Strings (<code>label</code>, <code>expand-label</code>, item ' +
          'labels, separator) are all consumer-controlled, so plug in ' +
          'whatever i18n layer you use.',
      },
    },
  },
  render: () => {
    type LocaleId = 'en' | 'fr' | 'de' | 'ja' | 'ar' | 'he' | 'hi';
    interface LocalePack {
      label: string;
      lang: string;
      dir: 'ltr' | 'rtl';
      ariaLabel: string;
      expandLabel: string;
      separator: string;
      crumbs: string[];
      caption: string;
    }

    const PACKS: Record<LocaleId, LocalePack> = {
      en: {
        label: 'English',
        lang: 'en-US',
        dir: 'ltr',
        ariaLabel: 'Page navigation',
        expandLabel: 'Show full breadcrumb trail',
        separator: '/',
        crumbs: ['Home', 'Library', 'Data', 'Reports', 'April 2026'],
        caption: '5 crumbs · max-items=4 · 1 + 2 visible',
      },
      fr: {
        label: 'Français',
        lang: 'fr-FR',
        dir: 'ltr',
        ariaLabel: 'Navigation de la page',
        expandLabel: 'Afficher le fil d\u2019Ariane complet',
        separator: '\u203A',
        crumbs: ['Accueil', 'Bibliothèque', 'Données', 'Rapports', 'Avril 2026'],
        caption: '5 éléments · max-items=4 · 1 + 2 visibles',
      },
      de: {
        label: 'Deutsch',
        lang: 'de-DE',
        dir: 'ltr',
        ariaLabel: 'Seitennavigation',
        expandLabel: 'Vollständigen Brotkrumenpfad anzeigen',
        separator: '\u203A',
        crumbs: [
          'Startseite',
          'Bibliothek',
          'Datenbestände',
          'Berichte',
          'April 2026',
        ],
        caption: '5 Einträge · max-items=4 · 1 + 2 sichtbar',
      },
      ja: {
        label: '日本語',
        lang: 'ja-JP',
        dir: 'ltr',
        ariaLabel: 'ページナビゲーション',
        expandLabel: 'パンくずリストをすべて表示',
        separator: '\uFF1E',
        crumbs: ['ホーム', 'ライブラリ', 'データ', 'レポート', '2026年4月'],
        caption: '5 件 · max-items=4 · 1 + 2 表示',
      },
      ar: {
        label: 'العربية',
        lang: 'ar-EG',
        dir: 'rtl',
        ariaLabel: 'تنقل الصفحة',
        expandLabel: 'إظهار مسار التنقل الكامل',
        separator: '\u00AB',
        crumbs: [
          'الرئيسية',
          'المكتبة',
          'البيانات',
          'التقارير',
          'أبريل 2026',
        ],
        caption: '5 عناصر · max-items=4 · 1 + 2 مرئية',
      },
      he: {
        label: 'עברית',
        lang: 'he-IL',
        dir: 'rtl',
        ariaLabel: 'ניווט עמוד',
        expandLabel: 'הצג שביל פירורי לחם מלא',
        separator: '\u00AB',
        crumbs: [
          'דף הבית',
          'ספרייה',
          'נתונים',
          'דוחות',
          'אפריל 2026',
        ],
        caption: '5 פריטים · max-items=4 · 1 + 2 גלויים',
      },
      hi: {
        label: 'हिन्दी',
        lang: 'hi-IN',
        dir: 'ltr',
        ariaLabel: 'पृष्ठ नेविगेशन',
        expandLabel: 'पूरा ब्रेडक्रंब पथ दिखाएँ',
        separator: '\u203A',
        crumbs: [
          'होम',
          'लाइब्रेरी',
          'डेटा',
          'रिपोर्ट',
          'अप्रैल 2026',
        ],
        caption: '5 आइटम · max-items=4 · 1 + 2 दृश्य',
      },
    };

    const ORDER: LocaleId[] = ['en', 'fr', 'de', 'ja', 'hi', 'ar', 'he'];

    return html`
      <style>
        .bc-l10n {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
          gap: 16px;
          font-family: var(--md-sys-typescale-body-large-font-family, Roboto, sans-serif);
        }
        .bc-l10n__card {
          padding: 16px 20px;
          border-radius: 16px;
          background: var(--md-sys-color-surface-container-lowest, #FFFBFE);
          border: 1px solid var(--md-sys-color-outline-variant, #CAC4D0);
          display: grid;
          gap: 10px;
        }
        .bc-l10n__head {
          display: flex;
          align-items: baseline;
          gap: 12px;
          flex-wrap: wrap;
        }
        .bc-l10n__locale {
          font: 500 14px/20px Roboto, sans-serif;
          color: var(--md-sys-color-on-surface, #1C1B1F);
        }
        .bc-l10n__tag {
          font: 500 11px/14px ui-monospace, SFMono-Regular, Menlo, monospace;
          color: var(--md-sys-color-on-surface-variant, #49454F);
          padding: 2px 8px;
          border-radius: 999px;
          background: var(--md-sys-color-surface-container, #F3EDF7);
        }
        .bc-l10n__caption {
          font: 400 12px/18px Roboto, sans-serif;
          color: var(--md-sys-color-on-surface-variant, #49454F);
        }
      </style>

      <div class="bc-l10n">
        ${ORDER.map((id) => {
          const p = PACKS[id];
          return html`
            <div class="bc-l10n__card" lang=${p.lang} dir=${p.dir}>
              <div class="bc-l10n__head">
                <span class="bc-l10n__locale">${p.label}</span>
                <span class="bc-l10n__tag">${p.lang} · ${p.dir.toUpperCase()}</span>
              </div>
              <md-breadcrumbs
                label=${p.ariaLabel}
                expand-label=${p.expandLabel}
                separator=${p.separator}
                max-items="4"
                items-before-collapse="1"
                items-after-collapse="2"
              >
                ${p.crumbs.map(
                  (c, i) => html`
                    <md-breadcrumb-item href=${i === p.crumbs.length - 1 ? '' : `/seg/${i}`}>
                      ${c}
                    </md-breadcrumb-item>
                  `,
                )}
              </md-breadcrumbs>
              <div class="bc-l10n__caption">${p.caption}</div>
            </div>
          `;
        })}
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
          'Breadcrumbs are the prime example of a responsive navigation ' +
          'pattern: when the trail does not fit, the middle items collapse ' +
          'into a single "…" overflow toggle that expands on click. The ' +
          'collapse threshold is configurable per-trail with the ' +
          '<code>max-items</code> attribute. The frames below show the ' +
          'same 7-item trail at four breakpoints — collapse kicks in ' +
          'whenever the rendered chips run out of room. Drag the live ' +
          'frame at the bottom to watch the transition in real time.',
      },
    },
  },
  render: (_args, { globals }) => {
    const trail = [
      { href: '/', label: t(globals.locale, 'home') },
      { href: '/account', label: t(globals.locale, 'breadcrumbs.account') },
      { href: '/account/billing', label: t(globals.locale, 'breadcrumbs.billing') },
      { href: '/account/billing/invoices', label: t(globals.locale, 'breadcrumbs.invoices') },
      { href: '/account/billing/invoices/2026', label: '2026' },
      { href: '/account/billing/invoices/2026/may', label: 'May' },
      { href: '#', label: 'Invoice #INV-1284', current: true },
    ];

    return html`
      <style>
        .bc-resp-shell { display: flex; flex-direction: column; gap: 28px; max-width: 1100px; }
        .bc-resp-frame { display: flex; flex-direction: column; gap: 6px; }
        .bc-resp-label { font-size: 11px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase; color: var(--md-sys-color-on-surface-variant, #49454F); }
        .bc-resp-vp {
          border: 1px dashed var(--md-sys-color-outline-variant, #cac4d0);
          border-radius: 12px;
          padding: 12px 16px;
          background: var(--md-sys-color-surface-container-lowest, #fffbfe);
          box-sizing: border-box;
          overflow: hidden;
        }
        .bc-resp-live { resize: horizontal; overflow: auto; min-inline-size: 240px; max-inline-size: 100%; inline-size: 600px; }
        .bc-resp-section { display: flex; flex-direction: column; gap: 10px; }
        .bc-resp-section h3 { margin: 0; }
        .bc-resp-section p { margin: 0; font-size: 14px; color: var(--md-sys-color-on-surface-variant, #49454F); }
      </style>

      <div class="bc-resp-shell">
        <section class="bc-resp-section">
          <h3>1 · Same trail across breakpoints</h3>
          <p>
            Auto-collapse: the component measures available inline-size
            after every render and folds middle items into the "…" toggle
            until the trail fits.
          </p>
          ${[
            { label: 'XS · 320 px', width: '320px' },
            { label: 'SM · 480 px', width: '480px' },
            { label: 'MD · 768 px', width: '768px' },
            { label: 'LG · 1024 px', width: '1024px' },
          ].map(
            (vp) => html`
              <div class="bc-resp-frame">
                <div class="bc-resp-label">${vp.label}</div>
                <div class="bc-resp-vp" style="inline-size: ${vp.width}; max-inline-size: 100%;">
                  <md-breadcrumbs label="Account navigation">
                    ${trail.map(
                      (item) => html`
                        <md-breadcrumb-item
                          href=${item.href}
                          ?aria-current=${item.current}
                        >${item.label}</md-breadcrumb-item>
                      `,
                    )}
                  </md-breadcrumbs>
                </div>
              </div>
            `,
          )}
        </section>

        <section class="bc-resp-section">
          <h3>2 · <code>max-items</code> caps</h3>
          <p>
            Force a maximum number of visible items regardless of width.
            The first and last item are always kept, the middle is folded
            into the overflow toggle.
          </p>
          ${[3, 5, 0].map(
            (mx) => html`
              <div class="bc-resp-frame">
                <div class="bc-resp-label">
                  ${mx === 0 ? 'max-items="0" (no cap, width-driven)' : `max-items="${mx}"`}
                </div>
                <div class="bc-resp-vp" style="inline-size: 720px; max-inline-size: 100%;">
                  <md-breadcrumbs label="Account navigation" max-items=${mx}>
                    ${trail.map(
                      (item) => html`
                        <md-breadcrumb-item
                          href=${item.href}
                          ?aria-current=${item.current}
                        >${item.label}</md-breadcrumb-item>
                      `,
                    )}
                  </md-breadcrumbs>
                </div>
              </div>
            `,
          )}
        </section>

        <section class="bc-resp-section">
          <h3>3 · Live resize</h3>
          <p>
            Drag the bottom-right corner of the frame to watch the
            collapse kick in (and out) as the available width changes.
          </p>
          <div class="bc-resp-vp bc-resp-live">
            <md-breadcrumbs label="Account navigation">
              ${trail.map(
                (item) => html`
                  <md-breadcrumb-item
                    href=${item.href}
                    ?aria-current=${item.current}
                  >${item.label}</md-breadcrumb-item>
                `,
              )}
            </md-breadcrumbs>
          </div>
        </section>
      </div>
    `;
  },
};

/* ═══════════════════════════════════════════════════════════
   ADDITIONAL COVERAGE
   ═══════════════════════════════════════════════════════════ */
