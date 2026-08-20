import type { Meta, StoryObj } from '@storybook/web-components';
import { expect, waitFor } from 'storybook/test';
import { html } from 'lit';
import { t } from '../i18n';

// ────────────────────────────────────────────────────────────────────────
// play() shadow-piercing helpers
// (testing-library can't cross shadow roots — address the real internals)
// ────────────────────────────────────────────────────────────────────────

type AppBarEl = HTMLElement & { searchValue: string };

/** First `variant="search"` bar in the canvas, once hydrated. */
const getSearchBar = async (canvasElement: HTMLElement): Promise<AppBarEl> => {
  const bar = canvasElement.querySelector('md-app-bar[variant="search"]') as AppBarEl;
  await waitFor(() => expect(bar.classList.contains('hydrated')).toBe(true));
  return bar;
};

const searchInputOf = (bar: AppBarEl) =>
  bar.shadowRoot!.querySelector('.md-app-bar__search-input') as HTMLInputElement;

/** Set the inline search field value and fire a composed `input` (no focus). */
const typeSearch = (bar: AppBarEl, text: string) => {
  const input = searchInputOf(bar);
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
};

// ────────────────────────────────────────────────────────────────────────
// Shared helpers
// ────────────────────────────────────────────────────────────────────────

/** M3 app-bar action icon — 48dp touch target (`size="md"` + `button-width="narrow"`). */
const appBarIcon = (
  slot: string,
  icon: string,
  label: string,
  opts?: { compactKeep?: boolean; directional?: boolean },
) => html`
  <md-icon-button
    slot="${slot}"
    icon="${icon}"
    variant="standard"
    size="md"
    button-width="narrow"
    aria-label="${label}"
    data-compact-keep=${opts?.compactKeep ? '' : undefined}
    data-directional=${opts?.directional ? '' : undefined}
  ></md-icon-button>
`;

const iconButtons = (searchId: string) => html`
  ${appBarIcon('leading', 'menu', 'Menu')}
  ${trailingSearchIcon(searchId)}
  ${appBarIcon('trailing', 'more_vert', 'More')}
`;

/** Shared search-bar slots — menu leading, mic in-pill, avatar outside. */
const searchBarSlots = html`
  ${appBarIcon('leading', 'menu', 'Menu')}
  ${appBarIcon('search-trailing', 'mic', 'Voice search')}
  <md-avatar slot="trailing" label="A"></md-avatar>
`;

const sectionLabelStyle =
  'margin: 0 0 8px; font: var(--md-sys-typescale-label-medium-font, inherit); font-size: var(--md-sys-typescale-label-medium-size, 12px); color: var(--md-sys-color-on-surface-variant, #49454f);';

/** Card-style stack for multi-bar demos — dividers use outline-variant for light/dark. */
const demoStackStyle =
  'display: flex; flex-direction: column; width: 100%; border: 1px solid var(--md-sys-color-outline-variant); border-radius: var(--md-sys-shape-corner-medium, 12px); overflow: hidden; background: var(--md-sys-color-surface);';

const demoSectionStyle =
  'padding: 20px 16px 24px; border-block-end: 1px solid var(--md-sys-color-outline-variant);';

const demoSectionLastStyle = 'padding: 20px 16px 24px;';

const renderDemoSection = (label: string, content: unknown, isLast = false) => html`
  <section style="${isLast ? demoSectionLastStyle : demoSectionStyle}">
    <p style="${sectionLabelStyle}">${label}</p>
    ${content}
  </section>
`;

const viewportFrame = (label: string, width: string, content: unknown) => html`
  <div style="margin-block-end: 16px;">
    <p style="${sectionLabelStyle}">${label}</p>
    <div
      style="inline-size: ${width}; max-inline-size: 100%; box-sizing: border-box;
             border: 1px dashed var(--md-sys-color-outline-variant);
             border-radius: var(--md-sys-shape-corner-medium, 12px);
             overflow: hidden; background: var(--md-sys-color-surface);"
    >
      ${content}
    </div>
  </div>
`;

const a11yKeyStyle =
  'display: inline-block; padding: 2px 6px; border: 1px solid var(--md-sys-color-outline-variant, #cac4d0); border-radius: 4px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; background: var(--md-sys-color-surface-container, #f3edf7);';

/** Minimal results list for full-screen search demos opened from app-bar trailing icons. */
const fullScreenSearchResults = html`
  <md-list
    slot="results"
    style="--md-list-container-color: transparent; --md-list-item-container-color: transparent;"
  >
    <md-list-item type="button" headline="Page title" supporting-text="Recent search"></md-list-item>
    <md-list-item type="button" headline="Subtitle" supporting-text="Recent search"></md-list-item>
  </md-list>
`;

type TopVariant = 'small' | 'medium' | 'large';

type MdSearchElement = HTMLElement & { show?: () => Promise<void> };

/** Collapse headless `md-search` chrome when closed; expand to viewport when opened. */
const resetHeadlessSearchHost = (el: HTMLElement, open: boolean) => {
  if (open) {
    el.style.cssText =
      'position: fixed; inset: 0; z-index: var(--md-sys-z-index-popup, 1000); inline-size: auto; block-size: auto; overflow: visible; opacity: 1; pointer-events: auto;';
  } else {
    el.style.cssText =
      'position: absolute; inline-size: 1px; block-size: 1px; overflow: hidden; opacity: 0; pointer-events: none;';
  }
};

const activateFullScreenSearch = (searchId: string) => async (e: Event) => {
  e.stopPropagation();
  if (!customElements.get('md-search')) {
    await customElements.whenDefined('md-search');
  }
  const search = document.getElementById(searchId) as MdSearchElement | null;
  if (!search?.show) return;
  await search.show();
  resetHeadlessSearchHost(search, true);
};

/** Trailing search glyph — opens sibling headless `md-search` full-screen view via `show()`. */
const trailingSearchIcon = (searchId: string, label = 'Search') => html`
  <md-icon-button
    slot="trailing"
    icon="search"
    variant="standard"
    size="md"
    button-width="narrow"
    aria-label="${label}"
    @mdClick=${activateFullScreenSearch(searchId)}
  ></md-icon-button>
`;

/** Slotted trailing search glyph — same full-screen wiring as `trailingSearchIcon`. */
const trailingSlottedSearchIcon = (searchId: string, label: string, pathD: string) => html`
  <md-icon-button
    slot="trailing"
    variant="standard"
    size="md"
    button-width="narrow"
    aria-label="${label}"
    @mdClick=${activateFullScreenSearch(searchId)}
  >
    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true">
      <path d="${pathD}"></path>
    </svg>
  </md-icon-button>
`;

const headlessFullScreenSearch = (id: string) => html`
  <md-search
    id=${id}
    layout="full-screen"
    trigger="bar"
    variant="contained"
    placeholder="Search"
    style="position: absolute; inline-size: 1px; block-size: 1px; overflow: hidden; opacity: 0; pointer-events: none;"
    @mdOpen=${(e: Event) => resetHeadlessSearchHost(e.currentTarget as HTMLElement, true)}
    @mdClose=${(e: Event) => resetHeadlessSearchHost(e.currentTarget as HTMLElement, false)}
  >
    ${fullScreenSearchResults}
  </md-search>
`;

const topAppBarActions = (searchId: string) => html`
  ${appBarIcon('leading', 'arrow_back', 'Back', { directional: true })}
  ${trailingSearchIcon(searchId)}
  ${appBarIcon('trailing', 'calendar_month', 'Calendar')}
`;

/** Story wrapper — one headless full-screen `md-search` per story export. */
const withFullScreenSearchHost = (searchId: string, content: unknown) => html`
  <div style="position: relative; width: 100%;">
    ${headlessFullScreenSearch(searchId)}
    ${content}
  </div>
`;

const renderTopAppBar = (
  variant: TopVariant,
  titleAlignment: 'start' | 'center',
  searchId: string,
  locale: string | undefined,
  withSubtitle = true,
) => html`
  <md-app-bar
    variant="${variant}"
    title-alignment="${titleAlignment}"
    headline="${t(locale, 'appbar.pageTitle')}"
    .subtitle=${withSubtitle ? t(locale, 'appbar.subtitle') : ''}
    style="width: 100%;"
  >
    ${topAppBarActions(searchId)}
  </md-app-bar>
`;

const variantDemosStoryDescription =
  'Four bars per variant: centered headline + subtitle, start-aligned headline + subtitle, start-aligned headline only (no `subtitle` prop), and centered headline only. ' +
  'Each uses `arrow_back` in the `leading` slot (mirrors in RTL) and trailing `search` + `calendar_month` icon buttons. ' +
  'The search icon does not use the inline `search` app-bar configuration — it calls `show()` on a headless sibling `<md-search layout="full-screen">` (M3 full-screen search view). ' +
  'Alternatively, use `<md-app-bar variant="search">` and listen for `mdSearchActivate` to open the same view.';

const renderVariantDemos = (variant: TopVariant, searchId: string, locale: string | undefined) =>
  withFullScreenSearchHost(
    searchId,
    html`
      <div style="${demoStackStyle}">
        ${renderDemoSection('Centered headline + subtitle', renderTopAppBar(variant, 'center', searchId, locale))}
        ${renderDemoSection('Start-aligned headline + subtitle', renderTopAppBar(variant, 'start', searchId, locale))}
        ${renderDemoSection('Headline only (start)', renderTopAppBar(variant, 'start', searchId, locale, false))}
        ${renderDemoSection(
          'Headline only (centered)',
          renderTopAppBar(variant, 'center', searchId, locale, false),
          true,
        )}
      </div>
    `,
  );

const variantDemosParameters = {
  docs: {
    description: {
      story: variantDemosStoryDescription,
    },
  },
};


// Custom icons (slotted) — helpers must live before story exports (CSF indexer).
const menuSvgPath = 'M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z';
const searchSvgPath =
  'M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z';
const micSvgPath =
  'M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16s-4.52-1.8-4.93-4.15c-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V20h-2v2h6v-2h-2v-2.08c3.02-.43 5.42-2.78 5.91-5.78.1-.6-.39-1.14-1-1.14z';

/** SVG in md-icon-button default slot — matches MdIconButton CustomIcons story. */
const appBarSlottedSvgButton = (
  slot: string,
  label: string,
  pathD: string,
  opts?: { compactKeep?: boolean; directional?: boolean },
) => html`
  <md-icon-button
    slot="${slot}"
    variant="standard"
    size="md"
    button-width="narrow"
    aria-label="${label}"
    data-compact-keep=${opts?.compactKeep ? '' : undefined}
    data-directional=${opts?.directional ? '' : undefined}
  >
    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true">
      <path d="${pathD}"></path>
    </svg>
  </md-icon-button>
`;

/** Non-SVG glyph in md-icon-button default slot (emoji, icon font). */
const appBarSlottedIconButton = (
  slot: string,
  label: string,
  iconContent: ReturnType<typeof html>,
  opts?: { compactKeep?: boolean; directional?: boolean },
) => html`
  <md-icon-button
    slot="${slot}"
    variant="standard"
    size="md"
    button-width="narrow"
    aria-label="${label}"
    data-compact-keep=${opts?.compactKeep ? '' : undefined}
    data-directional=${opts?.directional ? '' : undefined}
  >
    ${iconContent}
  </md-icon-button>
`;

// ────────────────────────────────────────────────────────────────────────
// Meta
// ────────────────────────────────────────────────────────────────────────

const meta: Meta = {
  title: 'Navigation/App Bar',
  component: 'md-app-bar',
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Material Design 3 top app bar implementing the [MD3 App bars spec](https://m3.material.io/components/app-bars/specs). ' +
          'Variants: `small` (64dp), `medium` (112/136dp), `large` (120/152dp), and `search` (inline search field). ' +
          'Use `title-alignment` for centered titles.',
      },
      source: { language: 'html' },
    },
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['small', 'medium', 'large', 'search'],
      description: 'App bar size variant.',
    },
    titleAlignment: {
      control: 'inline-radio',
      options: ['start', 'center'],
      description:
        'Title alignment. Search: centers placeholder when empty; caret/text start-align on focus or input.',
    },
    headline: { control: 'text', description: 'Inline or expanded headline (reflected).' },
    subtitle: { control: 'text', description: 'Subtitle — small inline / medium·large expanded (reflected).' },
    leadingIcon: { control: 'text', description: 'Prop-based leading icon (slot takes priority).' },
    leadingIconLabel: {
      control: 'text',
      description: 'Accessible label for prop-based leading icon (required when leading-icon is set).',
    },
    searchPlaceholder: { control: 'text', description: 'Search hint text in the inline field.' },
    searchValue: { control: 'text', description: 'Search field value (two-way bindable, reflected).' },
    searchAriaLabel: {
      control: 'text',
      description: 'Accessible name for search field (falls back to search-placeholder).',
    },
    searchDisabled: { control: 'boolean', description: 'Disable the inline search field.' },
    scrolled: {
      control: 'boolean',
      description:
        'Scrolled surface colour (surface → surface-container). Wire from your scroll listener.',
    },
    density: {
      control: 'select',
      options: [0, -1, -2, -3, -4],
      description: 'Density scale: 0 (default 64dp row), -1 (60dp), -2 (56dp), -3 (52dp), -4 (48dp).',
    },
  },
  args: {
    variant: 'small',
    titleAlignment: 'start',
    headline: 'Inbox',
    subtitle: '12 unread messages',
    leadingIcon: '',
    leadingIconLabel: '',
    searchPlaceholder: 'Search mail',
    searchValue: '',
    searchAriaLabel: '',
    searchDisabled: false,
    scrolled: false,
    density: 0,
  },
  decorators: [
    (story) => html`
      <div style="width: 100%; min-inline-size: 0;">
        ${story()}
      </div>
    `,
  ],
};
export default meta;
type Story = StoryObj;

// ────────────────────────────────────────────────────────────────────────
// Playground
// ────────────────────────────────────────────────────────────────────────

export const Playground: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Interactive controls for every public prop. Set `variant="search"` for the M3 search row (menu · pill · mic · avatar).',
      },
    },
  },
  render: (args) => {
    const isSearchMode = args.variant === 'search';
    const searchId = 'app-bar-fs-search-playground';

    const bar = html`
      <md-app-bar
        variant="${args.variant}"
        title-alignment="${args.titleAlignment}"
        headline="${args.headline}"
        subtitle="${args.subtitle}"
        leading-icon="${args.leadingIcon}"
        leading-icon-label="${args.leadingIconLabel}"
        search-placeholder="${args.searchPlaceholder}"
        search-value="${args.searchValue}"
        search-aria-label="${args.searchAriaLabel}"
        ?search-disabled=${args.searchDisabled}
        ?scrolled=${args.scrolled}
        density="${args.density}"
        style="width: 100%;"
      >
        ${isSearchMode
          ? html`
              ${appBarIcon('leading', 'menu', 'Menu')}
              ${appBarIcon('search-trailing', 'mic', 'Voice search')}
              <md-avatar slot="trailing" label="A" aria-label="Account"></md-avatar>
            `
          : args.leadingIcon
            ? html`
                ${trailingSearchIcon(searchId)}
                ${appBarIcon('trailing', 'more_vert', 'More')}
              `
            : iconButtons(searchId)}
      </md-app-bar>
    `;

    return isSearchMode ? bar : withFullScreenSearchHost(searchId, bar);
  },
};

// ────────────────────────────────────────────────────────────────────────
// Variant & search demos
// ────────────────────────────────────────────────────────────────────────

export const SearchBars: Story = {
  name: 'Search bars',
  parameters: {
    docs: {
      description: {
        story:
          'M3 search app bars: hamburger leading, mic inside the search pill (`search-trailing`), avatar outside (`trailing`). ' +
          'The first two bars share the same slots; only `title-alignment` differs (start-aligned vs centered placeholder). ' +
          'The third bar has no in-pill trailing icon — two `trailing` icon buttons after the search pill.',
      },
    },
  },
  render: (_args, { globals }) => html`
    <div style="${demoStackStyle}">
      ${renderDemoSection(
        'Start-aligned',
        html`
          <md-app-bar variant="search" search-placeholder="${t(globals.locale, 'search')}" style="width: 100%;">
            ${searchBarSlots}
          </md-app-bar>
        `,
      )}
      ${renderDemoSection(
        'Centered placeholder',
        html`
          <md-app-bar variant="search" title-alignment="center" search-placeholder="${t(globals.locale, 'search')}" style="width: 100%;">
            ${searchBarSlots}
          </md-app-bar>
        `,
      )}
      ${renderDemoSection(
        'Two trailing actions',
        html`
          <md-app-bar variant="search" search-placeholder="${t(globals.locale, 'search')}" style="width: 100%;">
            ${appBarIcon('leading', 'menu', 'Menu')}
            ${appBarIcon('trailing', 'auto_awesome', 'Assistant')}
            ${appBarIcon('trailing', 'calendar_month', 'Calendar')}
          </md-app-bar>
        `,
        true,
      )}
    </div>
  `,
  /** Typing into the inline search field updates `searchValue` and emits
   *  `mdSearchInput`; focusing activates the full-screen search intent
   *  (`mdSearchActivate`); clearing the field resets the value. */
  play: async ({ canvasElement, step }) => {
    const bar = await getSearchBar(canvasElement);

    await step('Typing updates searchValue + emits mdSearchInput (not activate)', async () => {
      const before = bar.searchValue; // '' at rest
      let inputDetail: { value: string } | undefined;
      let activateFired = false;
      bar.addEventListener(
        'mdSearchInput',
        (e) => { inputDetail = (e as CustomEvent).detail; },
        { once: true },
      );
      bar.addEventListener('mdSearchActivate', () => { activateFired = true; });
      typeSearch(bar, 'mail');
      await waitFor(() => expect(bar.searchValue).not.toBe(before)); // proves it CHANGED
      expect(bar.searchValue).toBe('mail');                          // proves WHERE
      expect(inputDetail?.value).toBe('mail');                       // component fired mdSearchInput
      expect(activateFired).toBe(false);                             // guard: typing ≠ full-screen activate
      // searchValue is reflected → the attribute lands on the next render flush.
      await waitFor(() => expect(bar.getAttribute('search-value')).toBe('mail'));
    });

    await step('Focusing the field activates search with the current value', async () => {
      let activateDetail: { value: string } | undefined;
      bar.addEventListener(
        'mdSearchActivate',
        (e) => { activateDetail = (e as CustomEvent).detail; },
        { once: true },
      );
      searchInputOf(bar).focus();
      await waitFor(() => expect(activateDetail).toBeTruthy()); // proves mdSearchActivate fired
      expect(activateDetail?.value).toBe('mail');               // payload carries the typed value
      // searchFocused state lands on the host as a class on the next render.
      await waitFor(() =>
        expect(bar.classList.contains('md-app-bar--search-focused')).toBe(true),
      );
    });

    await step('Clearing the field resets searchValue back to empty', async () => {
      const before = bar.searchValue; // 'mail'
      let clearDetail: { value: string } | undefined;
      bar.addEventListener(
        'mdSearchInput',
        (e) => { clearDetail = (e as CustomEvent).detail; },
        { once: true },
      );
      typeSearch(bar, '');
      await waitFor(() => expect(bar.searchValue).not.toBe(before)); // 'mail' → ''
      expect(bar.searchValue).toBe('');
      expect(clearDetail?.value).toBe(''); // component re-emitted mdSearchInput on clear
    });

    await step('Enter/Space keydown re-activates search (keyboard modality → focus ring)', async () => {
      const input = searchInputOf(bar);
      input.focus();
      await waitFor(() => expect(bar.shadowRoot!.activeElement).toBe(input));

      let activateCount = 0;
      const onActivate = () => { activateCount += 1; };
      bar.addEventListener('mdSearchActivate', onActivate);

      const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true, cancelable: true });
      input.dispatchEvent(enter);
      await waitFor(() => expect(activateCount).toBe(1)); // Enter emits mdSearchActivate (handleSearchKeyDown)
      expect(enter.defaultPrevented).toBe(true);          // handler called preventDefault

      const space = new KeyboardEvent('keydown', { key: ' ', bubbles: true, composed: true, cancelable: true });
      input.dispatchEvent(space);
      await waitFor(() => expect(activateCount).toBe(2)); // Space also activates (second key branch)
      expect(space.defaultPrevented).toBe(true);

      const other = new KeyboardEvent('keydown', { key: 'a', bubbles: true, composed: true, cancelable: true });
      input.dispatchEvent(other);
      expect(activateCount).toBe(2);             // a non-Enter/Space key does NOT activate
      expect(other.defaultPrevented).toBe(false); // …and is not consumed

      bar.removeEventListener('mdSearchActivate', onActivate);

      // The keydown flagged keyboard modality → the focused pill shows the keyboard focus ring.
      await waitFor(() =>
        expect(
          bar.shadowRoot!.querySelector('.md-app-bar__search')!.classList.contains('md-app-bar__search--focus-ring'),
        ).toBe(true),
      );
    });

    await step('Pointer modality clears the keyboard focus ring while the field stays focused', async () => {
      document.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
      const pill = () => bar.shadowRoot!.querySelector('.md-app-bar__search')!;
      await waitFor(() =>
        expect(pill().classList.contains('md-app-bar__search--focus-ring')).toBe(false), // pointer modality reset
      );
      expect(pill().classList.contains('md-app-bar__search--focused')).toBe(true); // still focused — only modality changed
    });

    await step('Clicking the search pill focuses the inline input', async () => {
      const input = searchInputOf(bar);
      input.blur();
      await waitFor(() => expect(bar.shadowRoot!.activeElement).not.toBe(input));
      (bar.shadowRoot!.querySelector('.md-app-bar__search') as HTMLElement).click();
      await waitFor(() => expect(bar.shadowRoot!.activeElement).toBe(input)); // container click → searchInput.focus()
    });
  },
};

export const SmallVariants: Story = {
  name: 'Small — centered & start',
  parameters: variantDemosParameters,
  render: (_args, { globals }) => renderVariantDemos('small', 'app-bar-fs-search-small', globals.locale),
};

export const MediumVariants: Story = {
  name: 'Medium — centered & start',
  parameters: variantDemosParameters,
  render: (_args, { globals }) => renderVariantDemos('medium', 'app-bar-fs-search-medium', globals.locale),
};

export const LargeVariants: Story = {
  name: 'Large — centered & start',
  parameters: variantDemosParameters,
  render: (_args, { globals }) => renderVariantDemos('large', 'app-bar-fs-search-large', globals.locale),
};

export const CustomIcons: Story = {
  name: 'Custom icons',
  decorators: [
    (story) => html`
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css"
        crossorigin="anonymous"
      />
      ${story()}
    `,
  ],
  parameters: {
    docs: {
      description: {
        story:
          'Replace prop-based or Material Symbols actions with slotted custom icons. ' +
          'Use `leading`, `trailing`, and `search-trailing` on `md-icon-button` (or raw SVG in `leading` per readme); ' +
          'slots take priority over `leading-icon`. Host `::slotted` rules map `--md-icon-button-container-*` to the 48dp app-bar touch target. ' +
          'Compare the first section (`leading-icon` prop) with the slotted examples below.',
      },
      source: {
        code: `<!-- SVG in leading slot (md-icon-button + slotted glyph) -->
<md-app-bar headline="Inbox">
  <md-icon-button slot="leading" variant="standard" size="md" button-width="narrow" aria-label="Menu">
    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true">
      <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
    </svg>
  </md-icon-button>
  <md-icon-button slot="trailing" variant="standard" size="md" button-width="narrow" aria-label="Search">
    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true">…</svg>
  </md-icon-button>
</md-app-bar>

<!-- Search: emoji in-pill, avatar outside -->
<md-app-bar variant="search" search-placeholder="Search">
  <md-icon-button slot="leading" icon="menu" variant="standard" size="md" button-width="narrow" aria-label="Menu"></md-icon-button>
  <md-icon-button slot="search-trailing" variant="standard" size="md" button-width="narrow" aria-label="Voice">
    <span style="font-size:24px;line-height:1" aria-hidden="true">🎤</span>
  </md-icon-button>
  <md-avatar slot="trailing" label="A"></md-avatar>
</md-app-bar>`,
      },
    },
  },
  render: (_args, { globals }) => {
    const searchId = 'app-bar-fs-search-custom-icons';
    return withFullScreenSearchHost(
      searchId,
      html`
        <div style="${demoStackStyle}">
          ${renderDemoSection(
            'Prop-based leading icon (reference)',
            html`
              <md-app-bar
                headline="${t(globals.locale, 'appbar.inbox')}"
                leading-icon="menu"
                leading-icon-label="Open navigation menu"
                style="width: 100%;"
              >
                ${trailingSearchIcon(searchId)}
                ${appBarIcon('trailing', 'more_vert', 'More options')}
              </md-app-bar>
            `,
          )}
          ${renderDemoSection(
            'Small — SVG in leading slot',
            html`
              <md-app-bar headline="${t(globals.locale, 'appbar.inbox')}" subtitle="${t(globals.locale, 'appbar.unreadShort')}" style="width: 100%;">
                ${appBarSlottedSvgButton('leading', 'Open navigation menu', menuSvgPath)}
                ${trailingSlottedSearchIcon(searchId, 'Search mail', searchSvgPath)}
                ${appBarIcon('trailing', 'more_vert', 'More options')}
              </md-app-bar>
            `,
          )}
          ${renderDemoSection(
            'Medium flexible — SVG leading',
            html`
              <md-app-bar
                variant="medium"
                headline="${t(globals.locale, 'appbar.products')}"
                subtitle="${t(globals.locale, 'appbar.browseCatalog')}"
                style="width: 100%;"
              >
                ${appBarSlottedSvgButton(
                  'leading',
                  'Back',
                  'M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z',
                  { directional: true },
                )}
                ${trailingSlottedSearchIcon(searchId, 'Search', searchSvgPath)}
              </md-app-bar>
            `,
          )}
          ${renderDemoSection(
            'Search — emoji in search-trailing',
            html`
              <md-app-bar variant="search" search-placeholder="${t(globals.locale, 'appbar.searchProducts')}" style="width: 100%;">
                ${appBarIcon('leading', 'menu', 'Menu')}
                ${appBarSlottedIconButton(
                  'search-trailing',
                  'Voice search',
                  html`<span style="font-size:24px;line-height:1" aria-hidden="true">🎤</span>`,
                )}
                <md-avatar slot="trailing" label="A" aria-label="Account"></md-avatar>
              </md-app-bar>
            `,
          )}
          ${renderDemoSection(
            'Search — SVG in-pill + icon-font & SVG trailing (max 3)',
            html`
              <md-app-bar variant="search" search-placeholder="${t(globals.locale, 'search')}" style="width: 100%;">
                ${appBarSlottedSvgButton('leading', 'Menu', menuSvgPath)}
                ${appBarSlottedSvgButton('search-trailing', 'Voice search', micSvgPath)}
                ${appBarSlottedIconButton(
                  'trailing',
                  'Favorites',
                  html`<i class="fa-solid fa-heart" style="font-size:24px;line-height:1" aria-hidden="true"></i>`,
                )}
                ${appBarSlottedSvgButton(
                  'trailing',
                  'Calendar',
                  'M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zM9 14H7v-2h2v2zm4 0h-2v-2h2v2zm4 0h-2v-2h2v2z',
                )}
              </md-app-bar>
            `,
            true,
          )}
        </div>
      `,
    );
  },
};

// ────────────────────────────────────────────────────────────────────────
// RTL
// ────────────────────────────────────────────────────────────────────────

export const RTL: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Leading/trailing slots mirror automatically under `dir="rtl"`. Use `data-directional` on `arrow_back` for glyph mirroring. ' +
          'Search rows keep 48dp touch targets; hint inset follows container-query tiers from the host.',
      },
    },
  },
  render: () => {
    const searchId = 'app-bar-fs-search-rtl';
    return withFullScreenSearchHost(
      searchId,
      html`
        <div dir="rtl" lang="ar" style="width: 100%;">
          <div style="${demoStackStyle}">
            ${renderDemoSection(
              'Small · centered title',
              html`
                <md-app-bar title-alignment="center" headline="الرئيسية" subtitle="٣ إشعارات">
                  ${appBarIcon('leading', 'arrow_back', 'رجوع', { directional: true })}
                  ${appBarIcon('trailing', 'more_vert', 'المزيد')}
                </md-app-bar>
              `,
            )}
            ${renderDemoSection(
              'Search bar',
              html`
                <md-app-bar variant="search" search-placeholder="بحث" style="width: 100%;">
                  ${appBarIcon('leading', 'menu', 'القائمة')}
                  ${appBarIcon('search-trailing', 'mic', 'بحث صوتي')}
                  <md-avatar slot="trailing" label="أ" aria-label="الحساب"></md-avatar>
                </md-app-bar>
              `,
            )}
            ${renderDemoSection(
              'Medium flexible',
              html`
                <md-app-bar variant="medium" headline="إعدادات" subtitle="حسابي">
                  ${appBarIcon('leading', 'arrow_back', 'رجوع', { directional: true })}
                  ${trailingSearchIcon(searchId, 'بحث')}
                </md-app-bar>
              `,
              true,
            )}
          </div>
        </div>
      `,
    );
  },
};

// ────────────────────────────────────────────────────────────────────────
// Dark theme
// ────────────────────────────────────────────────────────────────────────

export const DarkTheme: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Small and search app bars on a dark surface (`data-theme="dark"`). ' +
          'The small bar uses slotted actions; the search row follows the M3 layout (menu · pill · mic · avatar).',
      },
    },
  },
  decorators: [
    (story) => html`
      <div
        data-theme="dark"
        style="background: var(--md-sys-color-surface); padding: 24px; border-radius: 16px; width: 100%;"
      >
        ${story()}
      </div>
    `,
  ],
  render: (_args, { globals }) => {
    const searchId = 'app-bar-fs-search-dark';
    return withFullScreenSearchHost(
      searchId,
      html`
        <div style="${demoStackStyle}">
          ${renderDemoSection(
            'Small — start-aligned',
            html`
              <md-app-bar headline="${t(globals.locale, 'appbar.inbox')}" subtitle="${t(globals.locale, 'appbar.unreadMessages')}" style="width: 100%;">
                ${appBarIcon('leading', 'menu', 'Menu')}
                ${trailingSearchIcon(searchId)}
                ${appBarIcon('trailing', 'more_vert', 'More')}
              </md-app-bar>
            `,
          )}
          ${renderDemoSection(
            'Search bar',
            html`
              <md-app-bar variant="search" search-placeholder="${t(globals.locale, 'search')}" style="width: 100%;">
                ${searchBarSlots}
              </md-app-bar>
            `,
            true,
          )}
        </div>
      `,
    );
  },
};

// ────────────────────────────────────────────────────────────────────────
// Custom CSS
// ────────────────────────────────────────────────────────────────────────

export const CustomCSS: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Tour of the `--md-app-bar-*` custom-property API: container colors, typography colours, row padding, trailing gaps, ' +
          'search-pill fill/shape/padding, and scrolled-state overrides. Values map to the public vars in the component CSS header.',
      },
    },
  },
  render: (_args, { globals }) => {
    const searchId = 'app-bar-fs-search-custom-css';
    return withFullScreenSearchHost(
      searchId,
      html`
    <style>
      .ab-brand {
        --md-app-bar-container-color: #6750a4;
        --md-app-bar-container-color-scrolled: #4f378b;
        --md-app-bar-headline-color: #ffffff;
        --md-app-bar-subtitle-color: #eaddff;
        --md-app-bar-leading-icon-color: #ffffff;
        --md-app-bar-trailing-icon-color: #eaddff;
      }
      .ab-scrolled {
        --md-app-bar-container-color-scrolled: var(--md-sys-color-secondary-container, #e8def8);
        --md-app-bar-headline-color: var(--md-sys-color-on-secondary-container, #1d192b);
        --md-app-bar-subtitle-color: var(--md-sys-color-on-secondary-container, #1d192b);
      }
      .ab-search-pill {
        --md-app-bar-search-container-color: #fff3e0;
        --md-app-bar-search-container-color-scrolled: #ffe0b2;
        --md-app-bar-search-container-shape: 28px;
        --md-app-bar-search-placeholder-color: #8a4b00;
        --md-app-bar-search-trailing-icon-color: #663300;
        --md-app-bar-search-padding-inline-start: 20px;
        --md-app-bar-search-trailing-gap: 8px;
      }
      .ab-dense-row {
        --md-app-bar-padding-inline-start: 0;
        --md-app-bar-padding-inline-end: 0;
        --md-app-bar-trailing-gap: 0;
        --md-app-bar-icon-size: 20px;
        --md-app-bar-search-row-gap: 4px;
      }
      .ab-ocean {
        --md-app-bar-container-color: var(--md-sys-color-primary-container, #eaddff);
        --md-app-bar-headline-color: var(--md-sys-color-on-primary-container, #21005d);
        --md-app-bar-subtitle-color: var(--md-sys-color-on-primary-container, #21005d);
        --md-app-bar-search-container-color: #f3e8ff;
      }
    </style>
    <div style="${demoStackStyle}">
      ${renderDemoSection(
        'Brand surface + scrolled token',
        html`
          <div style="display: flex; flex-direction: column; gap: 12px;">
            <md-app-bar
              class="ab-brand"
              variant="medium"
              headline="Resting surface"
              subtitle="scrolled=false"
              style="width: 100%;"
            >
              ${appBarIcon('leading', 'menu', 'Menu')}
              ${appBarIcon('trailing', 'more_vert', 'More')}
            </md-app-bar>
            <md-app-bar
              class="ab-brand"
              variant="medium"
              scrolled
              headline="Scrolled surface"
              subtitle="scrolled=true"
              style="width: 100%;"
            >
              ${appBarIcon('leading', 'menu', 'Menu')}
              ${appBarIcon('trailing', 'more_vert', 'More')}
            </md-app-bar>
          </div>
        `,
      )}
      ${renderDemoSection(
        'Scrolled surface (token defaults)',
        html`
          <div style="display: flex; flex-direction: column; gap: 12px;">
            <md-app-bar headline="Resting — surface" style="width: 100%;">
              ${appBarIcon('leading', 'menu', 'Menu')}
              ${appBarIcon('trailing', 'search', 'Search')}
            </md-app-bar>
            <md-app-bar class="ab-scrolled" scrolled headline="Scrolled — surface-container" style="width: 100%;">
              ${appBarIcon('leading', 'menu', 'Menu')}
              ${appBarIcon('trailing', 'search', 'Search')}
            </md-app-bar>
          </div>
        `,
      )}
      ${renderDemoSection(
        'Search pill — resting vs scrolled',
        html`
          <div style="display: flex; flex-direction: column; gap: 12px;">
            <md-app-bar class="ab-search-pill" variant="search" search-placeholder="Resting pill" style="width: 100%;">
              ${appBarIcon('leading', 'menu', 'Menu')}
              ${appBarIcon('search-trailing', 'mic', 'Voice search')}
              <md-avatar slot="trailing" label="A"></md-avatar>
            </md-app-bar>
            <md-app-bar
              class="ab-search-pill"
              variant="search"
              scrolled
              search-placeholder="Scrolled pill"
              style="width: 100%;"
            >
              ${appBarIcon('leading', 'menu', 'Menu')}
              ${appBarIcon('search-trailing', 'mic', 'Voice search')}
              <md-avatar slot="trailing" label="A"></md-avatar>
            </md-app-bar>
          </div>
        `,
      )}
      ${renderDemoSection(
        'Search pill shape, fill, hint inset',
        html`
          <md-app-bar class="ab-search-pill" variant="search" search-placeholder="${t(globals.locale, 'appbar.searchProducts')}" style="width: 100%;">
            ${appBarIcon('leading', 'menu', 'Menu')}
            ${appBarIcon('search-trailing', 'mic', 'Voice search')}
            ${appBarIcon('search-trailing', 'auto_awesome', 'AI search', { compactKeep: true })}
            <md-avatar slot="trailing" label="A"></md-avatar>
          </md-app-bar>
        `,
      )}
      ${renderDemoSection(
        'Dense row padding + trailing gap',
        html`
          <md-app-bar
            class="ab-dense-row"
            headline="Compact chrome"
            style="width: 100%;"
          >
            ${appBarIcon('leading', 'menu', 'Menu')}
            ${trailingSearchIcon(searchId)}
            ${appBarIcon('trailing', 'calendar_month', 'Calendar')}
            ${appBarIcon('trailing', 'more_vert', 'More')}
          </md-app-bar>
        `,
      )}
      ${renderDemoSection(
        'Primary-container bar + search',
        html`
          <md-app-bar
            class="ab-ocean"
            variant="search"
            headline="Ocean preset"
            subtitle="Token-aware colours"
            search-placeholder="${t(globals.locale, 'search')}"
            style="width: 100%;"
          >
            ${appBarIcon('leading', 'menu', 'Menu')}
            ${appBarIcon('search-trailing', 'mic', 'Voice')}
            <md-avatar slot="trailing" label="O"></md-avatar>
          </md-app-bar>
        `,
        true,
      )}
    </div>
      `,
    );
  },
};

// ────────────────────────────────────────────────────────────────────────
// CSS Parts
// ────────────────────────────────────────────────────────────────────────

export const CSSParts: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Every documented `::part()` target from the component readme — action row, search anatomy, and flexible expanded title block. ' +
          'Parts on nested `md-icon-button` elements (`icon`, `state-layer`) are reachable from the host.',
      },
    },
  },
  render: () => {
    const searchId = 'app-bar-fs-search-css-parts';
    return withFullScreenSearchHost(
      searchId,
      html`
    <style>
      .parts-all::part(row) { outline: 1px dashed var(--md-sys-color-outline-variant, #cac4d0); outline-offset: -1px; }
      .parts-all::part(leading) { opacity: 0.95; }
      .parts-all::part(title) { text-transform: uppercase; letter-spacing: 0.08em; font-size: 0.9em; }
      .parts-all::part(trailing) { gap: 4px; }
      .parts-all::part(search-host) { flex: 1; min-inline-size: 0; }
      .parts-all::part(search) {
        border: 2px solid var(--md-sys-color-tertiary, #7d5260);
        box-shadow: inset 0 0 0 1px rgba(125, 82, 96, 0.3);
      }
      .parts-all::part(search-field) { font-style: italic; }
      .parts-all::part(search-trailing) { filter: saturate(1.4); }
      .parts-all::part(expanded) {
        background: rgba(234, 221, 255, 0.4);
        border-radius: 8px;
      }
      .parts-all::part(expanded-headline) { color: var(--md-sys-color-primary, #6750a4); }
      .parts-all::part(subtitle) { text-decoration: underline; text-underline-offset: 3px; }
      .parts-search-only::part(search-state-layer) { background: gold; opacity: 0.15; }
      .parts-search-only::part(search-input) { caret-color: var(--md-sys-color-primary, #6750a4); }
    </style>
    <div style="${demoStackStyle}">
      ${renderDemoSection(
        'Flexible bar — title, expanded, subtitle parts',
        html`
          <md-app-bar
            class="parts-all"
            variant="large"
            headline="CSS parts tour"
            subtitle="expanded-headline, subtitle, row"
            style="width: 100%;"
          >
            ${appBarIcon('leading', 'arrow_back', 'Back', { directional: true })}
            ${trailingSearchIcon(searchId)}
          </md-app-bar>
        `,
      )}
      ${renderDemoSection(
        'Search bar: search, search-field, search-trailing',
        html`
          <md-app-bar
            class="parts-all parts-search-only"
            variant="search"
            search-placeholder="Style the pill"
            style="width: 100%;"
          >
            ${appBarIcon('leading', 'menu', 'Menu')}
            ${appBarIcon('search-trailing', 'mic', 'Voice')}
            <md-avatar slot="trailing" label="P"></md-avatar>
          </md-app-bar>
        `,
        true,
      )}
    </div>
      `,
    );
  },
};

// ────────────────────────────────────────────────────────────────────────
// Accessibility
// ────────────────────────────────────────────────────────────────────────

export const Accessibility: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Top bars expose `role="banner"`. Slotted icon buttons are independently focusable — each needs `aria-label`. ' +
          'Use the `headline` slot with a real heading when this is the page title. Tab through the demo; run `axe-core` on the page for WCAG 2.1 AA (see readme).',
      },
    },
  },
  render: (_args, { globals }) => {
    const searchId = 'app-bar-fs-search-a11y';
    return withFullScreenSearchHost(
      searchId,
      html`
    <div style="${demoStackStyle}">
      ${renderDemoSection(
        'Semantic headline + labelled actions',
        html`
          <md-app-bar variant="small" style="width: 100%;">
            ${appBarIcon('leading', 'menu', 'Open navigation menu')}
            <h1 slot="headline" style="margin: 0; font: inherit;">${t(globals.locale, 'appbar.inbox')}</h1>
            ${trailingSearchIcon(searchId, 'Search mail')}
            ${appBarIcon('trailing', 'more_vert', 'More options')}
          </md-app-bar>
        `,
      )}
      ${renderDemoSection(
        'Prop leading icon + leading-icon-label',
        html`
          <md-app-bar
            headline="${t(globals.locale, 'settings')}"
            leading-icon="arrow_back"
            leading-icon-label="Navigate back"
            style="width: 100%;"
          ></md-app-bar>
        `,
      )}
      ${renderDemoSection(
        'Keyboard · Tab order',
        html`
          <p style="margin: 0 0 12px; font-size: 13px; line-height: 1.5; color: var(--md-sys-color-on-surface-variant);">
            Tab from the field below: leading icon → trailing icons → search input (in search row).
            <span style="${a11yKeyStyle}">Enter</span> / <span style="${a11yKeyStyle}">Space</span> activate icon buttons.
          </p>
          <input
            type="text"
            placeholder="Tab from here"
            style="margin-block-end: 12px; padding: 8px 12px; border-radius: 8px; border: 1px solid var(--md-sys-color-outline-variant); width: 100%; box-sizing: border-box;"
          />
          <md-app-bar variant="search" search-placeholder="${t(globals.locale, 'search')}" style="width: 100%;">
            ${appBarIcon('leading', 'menu', 'Menu')}
            ${appBarIcon('search-trailing', 'mic', 'Voice search')}
            ${appBarIcon('trailing', 'tune', 'Filters')}
          </md-app-bar>
        `,
      )}
      ${renderDemoSection(
        'Focus visible on actions',
        html`
          <md-app-bar headline="Focus ring demo" style="width: 100%;">
            ${appBarIcon('leading', 'menu', 'Menu')}
            ${appBarIcon('trailing', 'favorite', 'Favorites')}
            ${appBarIcon('trailing', 'account_circle', 'Account')}
          </md-app-bar>
          <p style="margin: 12px 0 0; font-size: 12px; color: var(--md-sys-color-on-surface-variant);">
            Icon buttons use the shared MD3 focus ring (3px secondary outline). Search field focus is on the pill input.
          </p>
        `,
        true,
      )}
    </div>
      `,
    );
  },
};

// ────────────────────────────────────────────────────────────────────────
// Localization
// ────────────────────────────────────────────────────────────────────────

const longGermanHeadline =
  'Benachrichtigungseinstellungen und Datenschutzrichtlinien für Ihr Konto';
const longGermanSubtitle =
  'Verwalten Sie E-Mail-, Push- und SMS-Benachrichtigungen in allen verbundenen Geräten';
const pseudoHeadline = 'Śęţťįñğš åřę şűşťäįņęď ŵĥēŗē ţĥēŷ ēхčēęď ţĥē ćōŉţąįņēŕ';
const pseudoSubtitle = 'Ṕşęűďŏ-ľŏĉąľįżąţįŏń đēмŏ · ęľľįşş ţēśţ';

export const Localization: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Headlines and subtitles ellipsis when space is tight. German copy exercises compound words; pseudo-localization widens glyphs. ' +
          'Compare LTR and RTL in narrow frames — layout flips via logical properties without extra props.',
      },
    },
  },
  render: () => {
    const searchId = 'app-bar-fs-search-l10n';
    return withFullScreenSearchHost(
      searchId,
      html`
    <div style="display: grid; gap: 24px; width: 100%; max-width: 900px;">
      ${viewportFrame(
        'LTR · long German (280px — ellipsis)',
        '280px',
        html`
          <md-app-bar
            lang="de"
            variant="medium"
            headline="${longGermanHeadline}"
            subtitle="${longGermanSubtitle}"
            style="width: 100%;"
          >
            ${appBarIcon('leading', 'menu', 'Menü')}
            ${trailingSearchIcon(searchId, 'Suchen')}
          </md-app-bar>
        `,
      )}
      ${viewportFrame(
        'LTR · pseudo-localization (320px)',
        '320px',
        html`
          <md-app-bar headline="${pseudoHeadline}" subtitle="${pseudoSubtitle}" style="width: 100%;">
            ${appBarIcon('leading', 'arrow_back', 'Back', { directional: true })}
            ${appBarIcon('trailing', 'more_vert', 'More')}
          </md-app-bar>
        `,
      )}
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px;">
        ${viewportFrame(
          'RTL · Arabic headline',
          '100%',
          html`
            <div dir="rtl" lang="ar">
              <md-app-bar
                headline="إعدادات الإشعارات والخصوصية لحسابك على جميع الأجهزة"
                subtitle="إدارة البريد والدفع والرسائل القصيرة"
                style="width: 100%;"
              >
                ${appBarIcon('leading', 'arrow_back', 'رجوع', { directional: true })}
                ${trailingSearchIcon(searchId, 'بحث')}
              </md-app-bar>
            </div>
          `,
        )}
        ${viewportFrame(
          'LTR · English (same width)',
          '100%',
          html`
            <md-app-bar
              headline="Notification and privacy settings for your account"
              subtitle="Manage email, push, and SMS across devices"
              style="width: 100%;"
            >
              ${appBarIcon('leading', 'arrow_back', 'Back', { directional: true })}
              ${trailingSearchIcon(searchId)}
            </md-app-bar>
          `,
        )}
      </div>
    </div>
      `,
    );
  },
};

// ────────────────────────────────────────────────────────────────────────
// Responsiveness — container queries on host
// ────────────────────────────────────────────────────────────────────────

export const Responsiveness: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'The search row uses host container queries: hint inset steps down below 600dp and 400dp; second+ `search-trailing` icons hide unless `data-compact-keep`. ' +
          'Fixed-width frames at 320 / 600 / 800px show the tiers. Row gaps and 48dp touch targets stay constant.',
      },
    },
  },
  render: (_args, { globals }) => {
    const searchId = 'app-bar-fs-search-responsive';
    return withFullScreenSearchHost(
      searchId,
      html`
    <div style="display: flex; flex-direction: column; gap: 8px; width: 100%; max-width: 840px;">
      <p style="margin: 0 0 8px; font-size: 13px; line-height: 1.5; color: var(--md-sys-color-on-surface-variant);">
        Mic stays visible; sparkle uses <code>data-compact-keep</code> so it remains below 600dp.
      </p>
      ${[
        { label: '320px · extra-narrow (12dp hint, one in-pill icon)', width: '320px' },
        { label: '600px · compact tier boundary (16dp hint)', width: '600px' },
        { label: '800px · full width (24dp hint, both in-pill icons)', width: '800px' },
      ].map((vp) =>
        viewportFrame(
          vp.label,
          vp.width,
          html`
            <md-app-bar variant="search" search-placeholder="${t(globals.locale, 'appbar.searchProducts')}" style="width: 100%;">
              ${appBarIcon('leading', 'menu', 'Menu')}
              ${appBarIcon('search-trailing', 'mic', 'Voice search')}
              ${appBarIcon('search-trailing', 'auto_awesome', 'AI search', { compactKeep: true })}
              <md-avatar slot="trailing" label="A"></md-avatar>
            </md-app-bar>
            <md-app-bar
              variant="small"
              headline="${t(globals.locale, 'appbar.pageTitle')}"
              subtitle="${t(globals.locale, 'appbar.subtitle')}"
              style="width: 100%; border-block-start: 1px solid var(--md-sys-color-outline-variant);"
            >
              ${appBarIcon('leading', 'arrow_back', 'Back', { directional: true })}
              ${trailingSearchIcon(searchId)}
            </md-app-bar>
          `,
        ),
      )}
    </div>
      `,
    );
  },
};

// ────────────────────────────────────────────────────────────────────────
// Coverage-focused behavioural stories
// ────────────────────────────────────────────────────────────────────────

/** Trailing slot caps at 3 icons (M3 guidance); extras hide and re-reveal on removal. */
export const TrailingIconLimit: Story = {
  name: 'Trailing icon limit',
  parameters: {
    docs: {
      description: {
        story:
          'The `trailing` slot supports at most 3 action icons; extras are hidden (and warned in dev). ' +
          'Removing a visible icon re-reveals a previously hidden one via `slotchange` re-sync.',
      },
    },
  },
  render: () => html`
    <md-app-bar headline="Overflowing actions" style="width: 100%;">
      ${appBarIcon('leading', 'menu', 'Menu')}
      ${appBarIcon('trailing', 'search', 'Search')}
      ${appBarIcon('trailing', 'favorite', 'Favorites')}
      ${appBarIcon('trailing', 'share', 'Share')}
      ${appBarIcon('trailing', 'more_vert', 'More')}
    </md-app-bar>
  `,
  play: async ({ canvasElement, step }) => {
    const bar = canvasElement.querySelector('md-app-bar') as HTMLElement;
    await waitFor(() => expect(bar.classList.contains('hydrated')).toBe(true));
    const trailingIcons = () => Array.from(bar.querySelectorAll('[slot="trailing"]')) as HTMLElement[];

    await step('The fourth trailing icon is hidden beyond the 3-icon cap', async () => {
      await waitFor(() => {
        const icons = trailingIcons();
        expect(icons.length).toBe(4);
        expect(icons[3].hidden).toBe(true); // enforceTrailingSlotLimit hides index >= MAX
      });
      const icons = trailingIcons();
      expect(icons[0].hidden).toBe(false);
      expect(icons[1].hidden).toBe(false);
      expect(icons[2].hidden).toBe(false);
    });

    await step('Removing a visible icon re-reveals the previously hidden one', async () => {
      trailingIcons()[0].remove(); // 4 → 3 assigned → slotchange re-enforces
      await waitFor(() => {
        const rest = trailingIcons();
        expect(rest.length).toBe(3);
        expect(rest.every((el) => !el.hidden)).toBe(true); // formerly-hidden icon un-hidden
      });
    });
  },
};

/** Disabled inline search field ignores clicks, focus, and Enter/Space. */
export const DisabledSearch: Story = {
  name: 'Disabled search field',
  parameters: {
    docs: {
      description: {
        story:
          'With `search-disabled`, the inline field ignores clicks, focus, and Enter/Space — ' +
          'no `mdSearchActivate` is emitted and the pill never gains the focused state.',
      },
    },
  },
  render: () => html`
    <md-app-bar variant="search" search-disabled search-placeholder="Search (disabled)" style="width: 100%;">
      ${appBarIcon('leading', 'menu', 'Menu')}
      ${appBarIcon('search-trailing', 'mic', 'Voice search')}
      <md-avatar slot="trailing" label="A"></md-avatar>
    </md-app-bar>
  `,
  play: async ({ canvasElement, step }) => {
    const bar = canvasElement.querySelector('md-app-bar[variant="search"]') as AppBarEl;
    await waitFor(() => expect(bar.classList.contains('hydrated')).toBe(true));
    const input = bar.shadowRoot!.querySelector('.md-app-bar__search-input') as HTMLInputElement;

    let activated = false;
    bar.addEventListener('mdSearchActivate', () => { activated = true; });

    await step('The inline input is disabled and the host reflects it', async () => {
      expect(input.disabled).toBe(true);
      expect(bar.classList.contains('md-app-bar--search-disabled')).toBe(true);
    });

    await step('Clicking the disabled pill neither focuses nor activates', async () => {
      (bar.shadowRoot!.querySelector('.md-app-bar__search') as HTMLElement).click();
      expect(bar.shadowRoot!.activeElement).not.toBe(input); // handleSearchContainerClick guard returned early
      expect(activated).toBe(false);
    });

    await step('Enter and a synthetic focus on the disabled field stay inert', async () => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true, cancelable: true }));
      input.dispatchEvent(new FocusEvent('focus')); // handleSearchFocus guard returns early
      expect(activated).toBe(false); // neither keydown nor focus activated while disabled
      expect(bar.classList.contains('md-app-bar--search-focused')).toBe(false);
    });
  },
};

/** Flexible bars render slotted headline/subtitle in the expanded block when props are empty. */
export const SlottedExpandedHeadline: Story = {
  name: 'Slotted expanded headline',
  parameters: {
    docs: {
      description: {
        story:
          'On flexible (`medium`/`large`) bars, the expanded block projects slotted `headline` and `subtitle` ' +
          'content when the corresponding props are empty.',
      },
    },
  },
  render: () => html`
    <md-app-bar variant="medium" style="width: 100%;">
      ${appBarIcon('leading', 'arrow_back', 'Back', { directional: true })}
      <span slot="headline">Slotted headline</span>
      <span slot="subtitle">Slotted subtitle</span>
    </md-app-bar>
  `,
  play: async ({ canvasElement }) => {
    const bar = canvasElement.querySelector('md-app-bar[variant="medium"]') as HTMLElement;
    await waitFor(() => expect(bar.classList.contains('hydrated')).toBe(true));

    // Expanded headline uses the fallback <slot name="headline"> (no headline prop) → projects the slotted text.
    await waitFor(() => {
      const headlineSlot = bar.shadowRoot!.querySelector(
        '[part="expanded-headline"] slot[name="headline"]',
      ) as HTMLSlotElement | null;
      expect(headlineSlot).not.toBe(null);
      expect(headlineSlot!.assignedElements().map((n) => n.textContent).join('')).toContain('Slotted headline');
    });

    // hasSubtitleContent() true via the slotted subtitle → host with-subtitle class + fallback subtitle slot rendered.
    expect(bar.classList.contains('md-app-bar--with-subtitle')).toBe(true);
    const subtitleSlot = bar.shadowRoot!.querySelector(
      '[part="expanded"] [part="subtitle"] slot[name="subtitle"]',
    ) as HTMLSlotElement | null;
    expect(subtitleSlot).not.toBe(null);
    expect(subtitleSlot!.assignedElements().map((n) => n.textContent).join('')).toContain('Slotted subtitle');
  },
};

/** Slotting content after mount fires slotchange; the bar re-syncs and reflects the new state. */
export const DynamicSlots: Story = {
  name: 'Dynamic slot updates',
  parameters: {
    docs: {
      description: {
        story:
          'Mutating slotted content after mount fires `slotchange`; the bar re-syncs headline/subtitle/leading ' +
          '(and, on search bars, search/search-trailing) and reflects the new state on the host and in shadow DOM. ' +
          'Conditionally-rendered slots (subtitle, headline, search) are seeded at mount so their `slotchange` ' +
          'listeners are wired — the play then adds/removes content to drive the re-sync.',
      },
    },
  },
  render: () => html`
    <div style="display: flex; flex-direction: column; gap: 12px; width: 100%;">
      <md-app-bar id="dyn-top" leading-icon="menu" leading-icon-label="Menu" style="width: 100%;">
        <span slot="subtitle">3 new</span>
        <span slot="headline">Live title</span>
      </md-app-bar>
      <md-app-bar id="dyn-search" variant="search" search-placeholder="Search" style="width: 100%;">
        <input slot="search" aria-label="Custom search" />
      </md-app-bar>
    </div>
  `,
  play: async ({ canvasElement, step }) => {
    const top = canvasElement.querySelector('#dyn-top') as HTMLElement;
    const search = canvasElement.querySelector('#dyn-search') as HTMLElement;
    await waitFor(() => expect(top.classList.contains('hydrated')).toBe(true));
    await waitFor(() => expect(search.classList.contains('hydrated')).toBe(true));

    const addSlotted = (host: HTMLElement, slot: string, tag: string, text: string) => {
      const el = document.createElement(tag);
      el.setAttribute('slot', slot);
      el.setAttribute('aria-label', text);
      el.textContent = text;
      host.appendChild(el);
      return el;
    };

    await step('Removing the slotted subtitle drops the with-subtitle host class', async () => {
      expect(top.classList.contains('md-app-bar--with-subtitle')).toBe(true); // seeded subtitle at mount
      top.querySelector('[slot="subtitle"]')!.remove();
      await waitFor(() => expect(top.classList.contains('md-app-bar--with-subtitle')).toBe(false)); // syncSubtitle
    });

    await step('Slotting more headline content re-projects it into the inline title part', async () => {
      const seededSlot = top.shadowRoot!.querySelector(
        '[part="title"] slot[name="headline"]',
      ) as HTMLSlotElement | null;
      expect(seededSlot).not.toBe(null); // headline slot projected from the seeded content
      addSlotted(top, 'headline', 'span', 'Updated title');
      await waitFor(() => {
        const titleSlot = top.shadowRoot!.querySelector(
          '[part="title"] slot[name="headline"]',
        ) as HTMLSlotElement | null;
        expect(titleSlot).not.toBe(null);
        expect(titleSlot!.assignedElements().map((n) => n.textContent).join('')).toContain('Updated title'); // syncHeadline
      });
    });

    await step('Slotting a leading action removes the prop-based fallback icon', async () => {
      expect(top.shadowRoot!.querySelector('.md-app-bar__leading-button')).not.toBe(null); // prop fallback present
      addSlotted(top, 'leading', 'button', 'Menu');
      await waitFor(() =>
        expect(top.shadowRoot!.querySelector('.md-app-bar__leading-button')).toBe(null), // syncLeading → fallback gone
      );
    });

    await step('Slotting search-trailing adds the with-search-trailing host class', async () => {
      expect(search.classList.contains('md-app-bar--with-search-trailing')).toBe(false);
      addSlotted(search, 'search-trailing', 'button', 'Voice');
      await waitFor(() => expect(search.classList.contains('md-app-bar--with-search-trailing')).toBe(true)); // syncSearchTrailing
    });

    await step('Removing slotted search content restores the default inline input', async () => {
      expect(search.shadowRoot!.querySelector('.md-app-bar__search-content')).not.toBe(null); // seeded slotted search branch
      expect(search.shadowRoot!.querySelector('.md-app-bar__search-input')).toBe(null); // default input replaced at mount
      search.querySelector('[slot="search"]')!.remove();
      await waitFor(() => {
        expect(search.shadowRoot!.querySelector('.md-app-bar__search-input')).not.toBe(null); // syncSearch → default input restored
        expect(search.shadowRoot!.querySelector('.md-app-bar__search-content')).toBe(null); // slotted branch gone
      });
    });
  },
};

/** Prop-based leading icon renders a fallback button whose activation emits `mdLeadingClick`. */
export const LeadingIconClick: Story = {
  name: 'Leading icon click',
  parameters: {
    docs: {
      description: {
        story:
          'When `leading-icon` is set (and no `leading` slot is provided), the bar renders a fallback ' +
          '`md-icon-button`. Activating it emits `mdLeadingClick`, carrying the originating `MouseEvent`.',
      },
    },
  },
  render: () => html`
    <md-app-bar
      headline="Prop leading icon"
      leading-icon="menu"
      leading-icon-label="Open navigation menu"
      style="width: 100%;"
    >
      ${appBarIcon('trailing', 'more_vert', 'More')}
    </md-app-bar>
  `,
  play: async ({ canvasElement, step }) => {
    const bar = canvasElement.querySelector('md-app-bar') as HTMLElement;
    await waitFor(() => expect(bar.classList.contains('hydrated')).toBe(true));

    const leadingButton = () =>
      bar.shadowRoot!.querySelector('.md-app-bar__leading-button') as HTMLElement | null;

    await step('The prop-based leading fallback button renders with its label', async () => {
      await waitFor(() => expect(leadingButton()).not.toBe(null)); // renderLeadingFallback: leadingIcon set, no slot
      expect(leadingButton()!.getAttribute('aria-label')).toBe('Open navigation menu'); // leadingIconLabel wired through
    });

    await step('Activating the leading button emits mdLeadingClick with the source MouseEvent', async () => {
      let leadingCount = 0;
      let lastDetail: MouseEvent | undefined;
      const onLeading = (e: Event) => {
        leadingCount += 1;
        lastDetail = (e as CustomEvent<MouseEvent>).detail;
      };
      bar.addEventListener('mdLeadingClick', onLeading);

      leadingButton()!.click(); // onClick={(event) => this.mdLeadingClick.emit(event)}
      await waitFor(() => expect(leadingCount).toBe(1)); // proves the emit ran
      expect(lastDetail).toBeTruthy();
      expect(lastDetail!.type).toBe('click'); // payload is the originating MouseEvent, not a re-wrapped detail

      leadingButton()!.click(); // repeatable — not a once-only wiring
      await waitFor(() => expect(leadingCount).toBe(2));

      bar.removeEventListener('mdLeadingClick', onLeading);
    });
  },
};

/** The inline search field derives its accessible name from label → placeholder → literal `Search`. */
export const SearchLabelFallback: Story = {
  name: 'Search accessible-name fallback',
  parameters: {
    docs: {
      description: {
        story:
          'The inline search field derives its accessible name via `search-aria-label`, falling back to ' +
          '`search-placeholder`, then the literal `Search` when both are empty.',
      },
    },
  },
  render: () => html`
    <div style="display: flex; flex-direction: column; gap: 12px; width: 100%;">
      <md-app-bar
        id="lbl-aria"
        variant="search"
        search-aria-label="Search all mail"
        search-placeholder="Type here"
        style="width: 100%;"
      >
        ${appBarIcon('leading', 'menu', 'Menu')}
      </md-app-bar>
      <md-app-bar id="lbl-fallback" variant="search" search-placeholder="" style="width: 100%;">
        ${appBarIcon('leading', 'menu', 'Menu')}
      </md-app-bar>
    </div>
  `,
  play: async ({ canvasElement, step }) => {
    const withAria = canvasElement.querySelector('#lbl-aria') as AppBarEl;
    const fallback = canvasElement.querySelector('#lbl-fallback') as HTMLElement;
    await waitFor(() => expect(withAria.classList.contains('hydrated')).toBe(true));
    await waitFor(() => expect(fallback.classList.contains('hydrated')).toBe(true));

    const inputOf = (bar: HTMLElement) =>
      bar.shadowRoot!.querySelector('.md-app-bar__search-input') as HTMLInputElement;

    await step('search-aria-label wins over search-placeholder for the accessible name', async () => {
      await waitFor(() =>
        expect(inputOf(withAria).getAttribute('aria-label')).toBe('Search all mail'), // effectiveSearchLabel: aria branch
      );
      expect(inputOf(withAria).getAttribute('placeholder')).toBe('Type here'); // placeholder is still the visual hint
    });

    await step('Empty aria-label and placeholder fall back to the literal "Search"', async () => {
      await waitFor(() =>
        expect(inputOf(fallback).getAttribute('aria-label')).toBe('Search'), // effectiveSearchLabel: || 'Search'
      );
    });

    await step('Typing updates the value but leaves the accessible name unchanged', async () => {
      typeSearch(withAria, 'invoices');
      await waitFor(() => expect(withAria.searchValue).toBe('invoices')); // handleSearchInput updated searchValue
      expect(inputOf(withAria).getAttribute('aria-label')).toBe('Search all mail'); // name is stable across input
    });
  },
};
