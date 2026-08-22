import type { Meta, StoryObj } from '@storybook/web-components';
import { expect, waitFor } from 'storybook/test';
import { html } from 'lit';
import { t } from '../i18n';

// ────────────────────────────────────────────────────────────────────────
// play() shadow-piercing helpers — testing-library can't cross shadow roots,
// so play() interactions address md-search's real internals directly.
// ────────────────────────────────────────────────────────────────────────

type SearchEl = HTMLElement & { value: string; open: boolean; loading: boolean };

/** Resolve the story's `<md-search>` once it has hydrated. */
const getSearch = async (canvasElement: HTMLElement): Promise<SearchEl> => {
  const search = canvasElement.querySelector('md-search') as SearchEl;
  await waitFor(() => expect(search.classList.contains('hydrated')).toBe(true));
  return search;
};
const inputOf = (s: SearchEl) =>
  s.shadowRoot!.querySelector('.md-search__input') as HTMLInputElement;
const clearBtnOf = (s: SearchEl) =>
  s.shadowRoot!.querySelector('.md-search__clear') as HTMLElement | null;
const panelOf = (s: SearchEl) =>
  s.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;
const loadingIndicatorOf = (s: SearchEl) =>
  s.shadowRoot!.querySelector('md-loading-indicator');
/** Slotted result rows live in the host's light DOM (`slot="results"`). */
const slottedResults = (s: SearchEl) => s.querySelectorAll('md-list-item');
/** Drive the input like a real keystroke — opens the view, fires mdInput/mdSearch. */
const typeIn = (s: SearchEl, text: string) => {
  const input = inputOf(s);
  input.focus();
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
};
/** Dispatch a keydown that bubbles to md-search's window-level Escape/arrow listener. */
const pressKey = (target: Element, k: string) =>
  target.dispatchEvent(
    new KeyboardEvent('keydown', { key: k, bubbles: true, composed: true }),
  );

// ────────────────────────────────────────────────────────────────────────
// Shared helpers
// ────────────────────────────────────────────────────────────────────────

/**
 * Fill the parent `md-search` input with a recent query — the affordance
 * behind the trailing "arrow upward" button on each recent-search row. Stops
 * propagation so tapping the button doesn't also trigger the row's own click.
 */
const fillQuery = (e: Event, query: string) => {
  e.stopPropagation();
  const search = (e.currentTarget as HTMLElement).closest('md-search') as
    | (HTMLElement & { value?: string; focusInput?: () => void })
    | null;
  if (!search) return;
  search.value = query;
  void search.focusInput?.();
};

/** A recent-search entry: a query plus an optional secondary line. */
type RecentEntry = string | { query: string; supporting?: string };

/** Transparent list chrome — rows sit on the search panel surface, not a nested M3 `surface` bay. */
const transparentListStyle =
  '--md-list-container-color: transparent; --md-list-item-container-color: transparent;';

/**
 * Recent / suggestion results rendered as richer **two-line** `md-list-item`s:
 * a leading history icon, the query as the primary line, a secondary supporting
 * line, and a trailing "arrow upward" icon-button that fills the query back into
 * the search input. Accepts plain strings (a generic supporting line is used)
 * or `{ query, supporting }` objects.
 */
const sampleResults = (items: RecentEntry[]) => html`
  <md-list slot="results" style=${transparentListStyle}>
    ${items.map((entry) => {
      const query = typeof entry === 'string' ? entry : entry.query;
      const supporting =
        typeof entry === 'string'
          ? 'Recent search'
          : entry.supporting ?? 'Recent search';
      return html`
        <md-list-item
          lines="2"
          headline=${query}
          supporting-text=${supporting}
          leading-icon="history"
        >
          <md-icon-button
            slot="trailing"
            icon="arrow_upward"
            aria-label=${`Use “${query}”`}
            @click=${(e: Event) => fillQuery(e, query)}
          ></md-icon-button>
        </md-list-item>
      `;
    })}
  </md-list>
`;

/**
 * Minimal single-line results used by the styling-focused demos (CSS Parts /
 * Custom CSS). Just a plain text label per row — no leading history icon, no
 * supporting line, no trailing button — so the demo's visual emphasis stays on
 * the part / custom-property being shown rather than the row chrome.
 */
const plainResults = (labels: string[]) => html`
  <md-list slot="results" style=${transparentListStyle}>
    ${labels.map(
      (label) =>
        html`<md-list-item type="button" headline=${label}></md-list-item>`,
    )}
  </md-list>
`;

/** Eli email rows — long enough to demo scroll + edge shadows in docked stories. */
const eliEmailRows = [
  {
    overline: 'Eli, me',
    headline: 'Adopt a pup?',
    supporting: 'The pet adoption organization is ...',
    time: '8:22 AM',
    label: 'E',
  },
  {
    overline: 'Zita, Odette, Dagmar',
    headline: 'Movie marathon',
    supporting: 'We have to watch one of these...',
    time: '7:15 AM',
    label: 'Z',
  },
  {
    overline: 'In, Aki Aro',
    headline: 'Museum field trip',
    supporting: 'So far about 20 students signed...',
    time: '9:40 AM',
    label: 'I',
  },
  {
    overline: 'Eli, me',
    headline: 'Weekend hike?',
    supporting: 'Trail opens Saturday — bring water.',
    time: 'Yesterday',
    label: 'E',
  },
  {
    overline: 'Sam, Priya',
    headline: 'Sprint retro notes',
    supporting: 'Posted the doc in the shared drive.',
    time: 'Mon',
    label: 'S',
  },
  {
    overline: 'Design team',
    headline: 'Search spec review',
    supporting: 'Contained + docked variants look good.',
    time: 'Sun',
    label: 'D',
  },
  {
    overline: 'Eli, me',
    headline: 'Coffee run',
    supporting: 'Oat latte for you if you are still at desk.',
    time: 'Fri',
    label: 'E',
  },
  {
    overline: 'Ops',
    headline: 'Deploy window',
    supporting: 'Freeze ends at 18:00 UTC.',
    time: 'Thu',
    label: 'O',
  },
];

const eliEmailList = () => html`
  <md-list
    list-style="standard"
    style="--md-list-container-color: transparent;
           --md-list-item-container-color: transparent;"
  >
    ${eliEmailRows.map(
      (row) => html`
        <md-list-item
          type="button"
          overline=${row.overline}
          headline=${row.headline}
          supporting-text=${row.supporting}
          trailing-supporting-text=${row.time}
          trailing-icon="star"
          leading-avatar-label=${row.label}
        ></md-list-item>
      `,
    )}
  </md-list>
`;

const dockedFrame = (children: unknown) => html`
  <div
    style="position: relative; padding: 24px; min-height: 360px;
           background: var(--md-sys-color-surface); border-radius: 16px;
           border: 1px solid var(--md-sys-color-outline-variant);"
  >
    ${children}
  </div>
`;

const meta: Meta = {
  title: 'Text Inputs/Search',
  component: 'md-search',
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      source: { language: 'html' },
    },
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['contained', 'divided'],
      description: 'M3 style axis. `contained` is the Expressive default.',
    },
    layout: {
      control: 'select',
      options: ['full-screen', 'docked'],
      description: 'How the focused panel appears.',
    },
    trigger: {
      control: 'select',
      options: ['bar', 'icon'],
      description:
        'Closed entry point. Unset = icon for full-screen, bar for docked. Full-screen spec sheets use the search icon button.',
    },
    triggerFor: {
      name: 'trigger-for',
      control: 'text',
      description:
        'Document selector for an opener that lives OUTSIDE the component (app-bar button, menu item). The component wires it — activation toggles the view, `aria-haspopup`/`aria-expanded` stay in step, focus returns to it on close — and renders nothing at rest. `triggerElement` takes an element instead.',
    },
    value: {
      control: 'text',
      description: 'Input value (two-way bindable).',
    },
    placeholder: {
      control: 'text',
      description: 'Placeholder hint inside the bar.',
    },
    open: {
      control: 'boolean',
      description: 'Whether the focused panel is open.',
    },
    disabled: {
      control: 'boolean',
      description: 'Disables the bar.',
    },
    showClearButton: {
      control: 'boolean',
      description: 'Show the built-in clear (×) button when value is non-empty.',
    },
    loading: {
      control: 'boolean',
      description:
        'Show the in-bar loading indicator (shape-morph) while a fetch is in flight. Cross-fades (morphs) with the clear-✕.',
    },
    voiceSearch: {
      control: 'boolean',
      description:
        'Opt in to a mic button (rendered only where the Web Speech API exists). Emits `mdVoice`; exposes `part="voice-button"` and `startVoice()` / `stopVoice()`.',
    },
    debounce: {
      control: 'number',
      description: 'Debounce (ms) before the `mdSearch` query event fires.',
    },
    throttle: {
      control: 'number',
      description: 'Max wait (ms) forcing an `mdSearch` emit during sustained typing.',
    },
  },
  args: {
    variant: 'contained',
    layout: 'docked',
    value: '',
    placeholder: 'Search products',
    open: false,
    disabled: false,
    showClearButton: true,
    loading: false,
    voiceSearch: false,
    debounce: 0,
    throttle: 0,
  },
  decorators: [
    (story, { parameters }) => {
      if (parameters.fullScreenSpecStory) {
        return story();
      }
      return html`
        <div style="padding: 24px; min-height: 480px;">${story()}</div>
      `;
    },
  ],
};
export default meta;
type Story = StoryObj;

// ────────────────────────────────────────────────────────────────────────
// Playground
// ────────────────────────────────────────────────────────────────────────

export const Playground: Story = {
  render: (args) =>
    dockedFrame(html`
      <md-search
        variant=${args.variant}
        layout=${args.layout}
        value=${args.value}
        placeholder=${args.placeholder}
        ?open=${args.open}
        ?disabled=${args.disabled}
        ?show-clear-button=${args.showClearButton}
        ?loading=${args.loading}
        ?voice-search=${args.voiceSearch}
        debounce=${args.debounce}
        throttle=${args.throttle}
      >
        ${sampleResults([
          'Wireless headphones',
          'Bluetooth speaker',
          'USB-C cable',
          'Mechanical keyboard',
        ])}
      </md-search>
    `),
  /** Typing emits the immediate + debounced query events and opens the results. */
  play: async ({ canvasElement, step }) => {
    const search = await getSearch(canvasElement);
    const input = inputOf(search);

    await step('Typing emits mdInput + mdSearch carrying the query', async () => {
      expect(search.open).toBe(false); // closed at rest
      let inputDetail: string | undefined;
      let searchDetail: string | undefined;
      search.addEventListener(
        'mdInput',
        (e) => (inputDetail = (e as CustomEvent<{ value: string }>).detail.value),
        { once: true },
      );
      search.addEventListener(
        'mdSearch',
        (e) => (searchDetail = (e as CustomEvent<{ value: string }>).detail.value),
        { once: true },
      );
      typeIn(search, 'head');
      // debounce/throttle are 0 here, so both fire synchronously with the query.
      expect(inputDetail).toBe('head');
      expect(searchDetail).toBe('head');
    });

    await step('Typing activates the search view', async () => {
      await waitFor(() => expect(search.open).toBe(true)); // was false above
      await waitFor(() => expect(input.getAttribute('aria-expanded')).toBe('true'));
    });

    await step('The open panel reveals the slotted results', async () => {
      const panel = panelOf(search);
      await waitFor(() => expect(panel.getAttribute('aria-hidden')).toBe('false'));
      expect(panel.classList.contains('md-search__panel--open')).toBe(true);
      expect(slottedResults(search).length).toBe(4); // the four sampleResults rows
    });

    await step('Escape closes the panel (guard)', async () => {
      pressKey(input, 'Escape');
      await waitFor(() => expect(search.open).toBe(false));
      await waitFor(() => expect(input.getAttribute('aria-expanded')).toBe('false'));
      await new Promise((r) => setTimeout(r, 300)); // let the close animation settle
    });

    // Public method surface (@Method) — typed view onto the imperative API.
    const api = search as unknown as {
      show(): Promise<void>;
      close(): Promise<void>;
      toggle(): Promise<void>;
      focusInput(): Promise<void>;
    };

    await step('show() re-opens the panel and emits mdOpen', async () => {
      let opened = false;
      search.addEventListener('mdOpen', () => (opened = true), { once: true });
      await api.show();
      await waitFor(() => expect(search.open).toBe(true));
      expect(opened).toBe(true); // the method drove the open lifecycle
      await waitFor(() =>
        expect(panelOf(search).getAttribute('aria-hidden')).toBe('false'),
      );
    });

    await step('focusInput() moves focus into the text field', async () => {
      input.blur();
      await waitFor(() =>
        expect(search.shadowRoot!.activeElement).not.toBe(input),
      );
      await api.focusInput();
      await waitFor(() =>
        expect(search.shadowRoot!.activeElement).toBe(input),
      );
    });

    await step('Arrow keys rove focus through the results and back to the input', async () => {
      const rows = slottedResults(search);
      expect(rows.length).toBe(4); // the four sampleResults rows
      pressKey(input, 'ArrowDown'); // input → first row
      await waitFor(() => expect(document.activeElement).toBe(rows[0]));
      pressKey(rows[0], 'ArrowDown'); // first → second row
      await waitFor(() => expect(document.activeElement).toBe(rows[1]));
      pressKey(rows[1], 'ArrowUp'); // second → first row
      await waitFor(() => expect(document.activeElement).toBe(rows[0]));
      pressKey(rows[0], 'ArrowUp'); // first row → back to the input
      await waitFor(() =>
        expect(search.shadowRoot!.activeElement).toBe(input),
      );
    });

    await step('Enter in the open bar flushes + emits mdSubmit with the query', async () => {
      let submitted: string | undefined;
      search.addEventListener(
        'mdSubmit',
        (e) => (submitted = (e as CustomEvent<{ value: string }>).detail.value),
        { once: true },
      );
      pressKey(input, 'Enter');
      await waitFor(() => expect(submitted).toBe(search.value)); // carries the current value
    });

    await step('The leading back button dismisses the panel + emits mdLeadingIconClick', async () => {
      expect(search.open).toBe(true); // still open going in
      let detail: { value: string; open: boolean } | undefined;
      search.addEventListener(
        'mdLeadingIconClick',
        (e) =>
          (detail = (e as CustomEvent<{ value: string; open: boolean }>).detail),
        { once: true },
      );
      const leadingBtn = search.shadowRoot!.querySelector(
        '.md-search__leading-button',
      ) as HTMLElement;
      leadingBtn.click();
      await waitFor(() => expect(detail).toBeDefined());
      expect(detail!.open).toBe(true); // payload captured before the dismiss
      expect(detail!.value).toBe(search.value);
      await waitFor(() => expect(search.open).toBe(false)); // back button closed it
      await new Promise((r) => setTimeout(r, 300)); // settle the close animation
    });

    await step('Enter on the closed bar re-activates it (opens for input)', async () => {
      expect(search.open).toBe(false);
      pressKey(input, 'Enter'); // closed → Enter activates the field
      await waitFor(() => expect(search.open).toBe(true));
    });

    await step('toggle() flips open↔closed; close() settles it shut', async () => {
      await api.toggle(); // open → closed
      await waitFor(() => expect(search.open).toBe(false));
      await api.toggle(); // closed → open
      await waitFor(() => expect(search.open).toBe(true));
      await api.close(); // → closed
      await waitFor(() => expect(search.open).toBe(false));
      await new Promise((r) => setTimeout(r, 300));
    });
  },
};

// ────────────────────────────────────────────────────────────────────────
// Expressive expansion — bar grows left + right on focus
// ────────────────────────────────────────────────────────────────────────

export const ExpressiveExpansion: Story = {
  render: (_args, { globals }) => html`
    <div style="display: grid; gap: 32px;">
      <section>
        <h3 style="margin: 0 0 8px; font-family: Roboto; font-weight: 500;">
          Default — 24px → 12px margins, springy settle
        </h3>
        <p style="margin: 0 0 12px; opacity: 0.7; font-family: Roboto;">
          Click the bar. At rest it keeps 24px side margins
          (<code>--md-search-expand-inset</code>); on focus the margins shrink to
          the new <code>--md-search-expand-focused-inset</code> (12px), so the bar
          springs out symmetrically left + right over 400 ms with a lively
          back-out settle. Both insets are fixed lengths, so the motion reads the
          same at any container width.
        </p>
        ${dockedFrame(html`
          <md-search variant="contained" layout="docked" placeholder=${t(globals.locale, 'search')}>
            ${sampleResults([
              'Recent: shoes',
              'Recent: laptop bag',
              'Trending: mechanical keyboard',
            ])}
          </md-search>
        `)}
      </section>

      <section>
        <h3 style="margin: 0 0 8px; font-family: Roboto; font-weight: 500;">
          Calmer — emphasized curve, no overshoot
        </h3>
        <p style="margin: 0 0 12px; opacity: 0.7; font-family: Roboto;">
          Swap the back-out spring for the standard M3 emphasized curve
          when you want a more measured expansion without the bounce.
        </p>
        ${dockedFrame(html`
          <md-search
            variant="contained"
            layout="docked"
            placeholder=${t(globals.locale, 'search')}
            style="
              --md-search-expand-easing: var(--md-sys-motion-easing-emphasized);
              --md-search-expand-duration: 400ms;
            "
          >
            ${sampleResults([
              'Wireless headphones',
              'Bluetooth speaker',
              'USB-C cable',
            ])}
          </md-search>
        `)}
      </section>

      <section>
        <h3 style="margin: 0 0 8px; font-family: Roboto; font-weight: 500;">
          Disabled — focused inset = resting inset
        </h3>
        <p style="margin: 0 0 12px; opacity: 0.7; font-family: Roboto;">
          Set <code>--md-search-expand-focused-inset</code> equal to
          <code>--md-search-expand-inset</code> (here both <code>12px</code>) so
          focus produces no width change — the bar stays put.
        </p>
        ${dockedFrame(html`
          <md-search
            variant="contained"
            layout="docked"
            placeholder=${t(globals.locale, 'search')}
            style="--md-search-expand-inset: 12px;
                   --md-search-expand-focused-inset: 12px;"
          >
            ${sampleResults(['Recent: shoes'])}
          </md-search>
        `)}
      </section>
    </div>
  `,
  parameters: {
    docs: {
      description: {
        story:
          'Expressive expansion (docked / inline bars only): the bar rests with 24px side margins (`--md-search-expand-inset`) and on focus the margins shrink to the new `--md-search-expand-focused-inset` (12px), so it grows symmetrically left + right over 400 ms with a springy back-out settle. Pure CSS, no Web Animations API. Tunable via `--md-search-expand-inset`, `--md-search-expand-focused-inset`, `--md-search-expand-duration`, and `--md-search-expand-easing` (set the two insets equal to disable). The full-screen layout does not margin-expand — it slides up from translateY(30px) with an opacity fade (matching md-dialog fullscreen), with no scrim or dimmer.',
      },
    },
  },
};

// ────────────────────────────────────────────────────────────────────────
// Full-width — no 24→12px gutters
// ────────────────────────────────────────────────────────────────────────

export const FullWidth: Story = {
  name: 'Full-width (no gutters)',
  parameters: {
    docs: {
      description: {
        story:
          'The **`full-width`** boolean prop makes a docked / inline bar span its ' +
          'container edge-to-edge with **no side gutters** — both expand insets ' +
          'are zeroed (resting + focused), so there is no 24 → 12px margin ' +
          'animation and the results drawer aligns to the same full width. ' +
          'The identical effect is available via CSS: ' +
          '`--md-search-expand-inset: 0; --md-search-expand-focused-inset: 0`. ' +
          'Has no effect on `full-screen` layout (already edge-to-edge).',
      },
    },
  },
  render: (_args, { globals, viewMode }) => html`
    <style>
      .fw-grid {
        display: grid;
        gap: 24px;
        grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
        max-width: 960px;
        font-family: Roboto;
      }
      .fw-card {
        border-radius: 16px;
        border: 1px solid var(--md-sys-color-outline-variant);
        background: var(--md-sys-color-surface);
        overflow: hidden;
      }
      .fw-card-head {
        padding: 12px 16px;
        border-bottom: 1px solid var(--md-sys-color-outline-variant);
      }
      .fw-card-head h4 {
        margin: 0 0 4px;
        font-size: 14px;
        font-weight: 500;
      }
      .fw-card-head p {
        margin: 0;
        font-size: 12px;
        opacity: 0.72;
        line-height: 1.4;
      }
      .fw-card-body {
        position: relative;
        min-block-size: 260px;
        padding-block: 16px;
        overflow: hidden;
      }
      .fw-card-body md-search {
        --md-search-container-min-inline-size: 0;
      }
    </style>

    <p style="margin: 0 0 16px; max-width: 960px; opacity: 0.75; font-family: Roboto; font-size: 13px;">
      Side-by-side: default expressive gutters (24px resting → 12px focused) vs
      edge-to-edge full width. Cards have no horizontal padding so the gutter
      difference is visible at the container edges.
    </p>

    <div class="fw-grid">
      <div class="fw-card">
        <div class="fw-card-head">
          <h4>Normal — 24px → 12px gutters</h4>
          <p>Default expand insets; bar and drawer inset from the card edges.</p>
        </div>
        <div class="fw-card-body">
          <md-search variant="contained" layout="docked" placeholder=${t(globals.locale, 'search')} ?open=${viewMode !== 'docs'}>
            ${plainResults(['Result one', 'Result two'])}
          </md-search>
        </div>
      </div>

      <div class="fw-card">
        <div class="fw-card-head">
          <h4>Full-width prop</h4>
          <p><code>full-width</code> — zeroes both insets; bar + drawer flush.</p>
        </div>
        <div class="fw-card-body">
          <md-search
            variant="contained"
            layout="docked"
            full-width
            placeholder=${t(globals.locale, 'search')}
            ?open=${viewMode !== 'docs'}
          >
            ${plainResults(['Edge to edge', 'No gutters'])}
          </md-search>
        </div>
      </div>

      <div class="fw-card">
        <div class="fw-card-head">
          <h4>Full-width via CSS vars</h4>
          <p>
            <code>--md-search-expand-inset: 0;</code>
            <code>--md-search-expand-focused-inset: 0</code>
          </p>
        </div>
        <div class="fw-card-body">
          <md-search
            variant="contained"
            layout="docked"
            placeholder=${t(globals.locale, 'search')}
            ?open=${viewMode !== 'docs'}
            style="--md-search-expand-inset: 0; --md-search-expand-focused-inset: 0;"
          >
            ${plainResults(['CSS equivalent', 'Same layout'])}
          </md-search>
        </div>
      </div>
    </div>
  `,
};

// ────────────────────────────────────────────────────────────────────────
// Style × Layout matrix (all 4 spec configurations)
// ────────────────────────────────────────────────────────────────────────

/** Shared full-screen results bay for Contained/Divided spec stories. */
const fullScreenResultsBay = () => html`
  <div
    slot="results"
    style="background: var(--md-sys-color-surface-container-low); flex: 1 1 auto;
           min-block-size: 0; display: flex; flex-direction: column;"
  >
    <p
      style="margin: 0; padding: 16px 16px 0;
             font: var(--md-sys-typescale-body-small-font);
             letter-spacing: var(--md-sys-typescale-body-small-letter-spacing);
             color: var(--md-sys-color-on-surface-variant);"
    >
      Results
    </p>
    <md-list
      list-style="standard"
      style="--md-list-container-color: transparent;
             --md-list-item-container-color: transparent;"
    >
      <md-list-item
        type="button"
        overline="Eli, me"
        headline="Adopt a pup?"
        supporting-text="Hey! Adopt a pup?..."
        trailing-supporting-text="8:22 AM"
        trailing-icon="star"
        leading-avatar-label="E"
      ></md-list-item>
      <md-list-item
        type="button"
        overline="Zel, me"
        headline="Re: Brunch this weekend?"
        supporting-text="Hey! Brunch this weekend?..."
        trailing-supporting-text="8:22 AM"
        trailing-icon="star"
        leading-avatar-label="Z"
      ></md-list-item>
      <md-list-item
        type="button"
        overline="Ivy, me"
        headline="Re: Brunch this weekend?"
        supporting-text="Hey! Brunch this weekend?..."
        trailing-supporting-text="8:22 AM"
        trailing-icon="star"
        leading-avatar-label="I"
      ></md-list-item>
    </md-list>
  </div>
`;

/**
 * Closed full-screen icon trigger centered on the preview surface (no card).
 * `parameters.fullScreenSpecStory` skips the meta padding wrapper so this
 * stage fills the iframe and flex-centers the 48×48 host.
 */
const fullScreenIconTriggerStage = (variant: 'contained' | 'divided') => html`
  <div
    style="box-sizing: border-box; display: flex; align-items: center;
           justify-content: center; min-block-size: 100dvh; min-block-size: 100vh;
           background: var(--md-sys-color-surface);"
  >
    <md-search
      variant=${variant}
      layout="full-screen"
      placeholder="Search"
      style="--md-search-container-min-inline-size: 0;"
    >
      ${fullScreenResultsBay()}
    </md-search>
  </div>
`;

const fullScreenSpecParameters = {
  layout: 'fullscreen' as const,
  fullScreenSpecStory: true,
  controls: { disable: true },
};

/** Canonical M3 spec sheet — contained × full-screen. */
export const ContainedFullScreen: Story = {
  name: 'Contained × Full-screen',
  parameters: {
    ...fullScreenSpecParameters,
    docs: {
      description: {
        story:
          'Expressive contained search in full-screen layout: a search icon button opens the view (no resting bar). The host then covers the viewport and the bar + panel slide up from translateY(30px) with an opacity fade — the same medium2 / standard motion as md-dialog fullscreen (no scrim). Click the search icon to open. Follows the toolbar Theme selection.',
      },
    },
  },
  render: () => fullScreenIconTriggerStage('contained'),
};

/** Canonical M3 spec sheet — divided × full-screen. */
export const DividedFullScreen: Story = {
  name: 'Divided × Full-screen',
  parameters: {
    ...fullScreenSpecParameters,
    docs: {
      description: {
        story:
          'Baseline divided search in full-screen layout: a search icon button opens a flat edge-bleed app bar with a hairline divider and results area. The full-screen view slides up from translateY(30px) with an opacity fade — matching md-dialog fullscreen motion (no scrim). Click the search icon to open. Follows the toolbar Theme selection.',
      },
    },
  },
  render: () => fullScreenIconTriggerStage('divided'),
};

/** Canonical M3 spec sheet — divided × docked. */
export const DividedDocked: Story = {
  name: 'Divided × Docked',
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        story:
          'Baseline divided search in docked layout: a single floating card (12px corners) with a flat bar, hairline divider, and results list beneath — non-modal, 360–720px wide. Bar and panel share surface-container-low. Matches the M3 "Style Divided, Docked layout" spec sheet. Follows the toolbar Theme selection.',
      },
    },
  },
  render: (_args, { viewMode }) => html`
    <div
      style="min-height: 100vh; padding: 24px;
             background: var(--md-sys-color-surface); box-sizing: border-box;"
    >
      <md-search
        variant="divided"
        layout="docked"
        value="Eli"
        placeholder="Search"
        ?open=${viewMode !== 'docs'}
        style="margin-inline: 0; --md-search-panel-max-block-size: 320px;"
      >
        <div slot="results">
          <p
            style="margin: 0; padding: 16px 16px 0;
                   font: var(--md-sys-typescale-body-small-font);
                   letter-spacing: var(--md-sys-typescale-body-small-letter-spacing);
                   color: var(--md-sys-color-on-surface-variant);"
          >
            Results
          </p>
          ${eliEmailList()}
        </div>
      </md-search>
    </div>
  `,
};

/** Canonical M3 spec sheet — contained × docked. */
export const ContainedDocked: Story = {
  name: 'Contained × Docked',
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        story:
          'Expressive contained search in docked layout: a pill bar with an anchored results popup beneath it (non-modal, 360–720px wide). The slotted results sit on a rounded surface card. Matches the M3 "Style Contained, Docked layout" spec sheet. Follows the toolbar Theme selection.',
      },
    },
  },
  render: (_args, { viewMode }) => html`
    <div
      style="min-height: 100vh; padding: 24px;
             background: var(--md-sys-color-surface); box-sizing: border-box;"
    >
      <md-search
        variant="contained"
        layout="docked"
        value="Eli"
        placeholder="Search"
        ?open=${viewMode !== 'docs'}
        style="margin-inline: 0; --md-search-panel-max-block-size: 320px;"
      >
        <div
          slot="results"
          style="background: var(--md-sys-color-surface-container-high);
                 border-radius: var(--md-sys-shape-corner-medium, 12px);
                 overflow: hidden;"
        >
          <p
            style="margin: 0; padding: 16px 16px 0;
                   font: var(--md-sys-typescale-body-small-font);
                   letter-spacing: var(--md-sys-typescale-body-small-letter-spacing);
                   color: var(--md-sys-color-on-surface-variant);"
          >
            Results
          </p>
          ${eliEmailList()}
        </div>
      </md-search>
    </div>
  `,
};

// ────────────────────────────────────────────────────────────────────────
// Results — actual md-list integration
// ────────────────────────────────────────────────────────────────────────

export const WithResults: Story = {
  render: (_args, { globals }) =>
    dockedFrame(html`
      <md-search
        variant="contained"
        layout="docked"
        value="cat"
        placeholder=${t(globals.locale, 'search.searchAnimals')}
      >
        <md-list slot="results" style=${transparentListStyle}>
          <md-list-item
            type="button"
            headline="Cat"
            supporting-text="Felis catus"
            leading-icon="pets"
          ></md-list-item>
          <md-list-item
            type="button"
            headline="Catamaran"
            supporting-text="Twin-hull boat"
            leading-icon="directions_boat"
          ></md-list-item>
          <md-list-item
            type="button"
            headline="Catalogue"
            supporting-text="Indexed list"
            leading-icon="menu_book"
          ></md-list-item>
          <md-list-item
            type="button"
            headline="Cathedral"
            supporting-text="Bishop's seat"
            leading-icon="church"
          ></md-list-item>
        </md-list>
      </md-search>
    `),
  /** A matching query renders result rows + a clear affordance; clearing empties the bar. */
  play: async ({ canvasElement, step }) => {
    const search = await getSearch(canvasElement);

    await step('The seeded query shows its matching result rows', async () => {
      expect(inputOf(search).value).toBe('cat'); // seeded query rendered into the input
      expect(slottedResults(search).length).toBe(4); // Cat, Catamaran, Catalogue, Cathedral
      expect(slottedResults(search)[0].getAttribute('headline')).toBe('Cat');
      expect(clearBtnOf(search)).not.toBeNull(); // clear (×) present because value is non-empty
    });

    await step('Clicking clear empties the input and fires mdClear', async () => {
      let cleared = false;
      let inputDetail: string | undefined;
      search.addEventListener('mdClear', () => (cleared = true), { once: true });
      search.addEventListener(
        'mdInput',
        (e) => (inputDetail = (e as CustomEvent<{ value: string }>).detail.value),
        { once: true },
      );
      const before = search.getAttribute('value'); // 'cat'
      clearBtnOf(search)!.click();
      expect(cleared).toBe(true); // component emitted its dedicated clear event
      expect(inputDetail).toBe(''); // mdInput carried the emptied value
      await waitFor(() => expect(search.getAttribute('value')).not.toBe(before)); // cat → ''
      await waitFor(() => expect(inputOf(search).value).toBe('')); // input visually emptied
      expect(clearBtnOf(search)).toBeNull(); // clear button retracts once value is empty
    });
  },
};

// ────────────────────────────────────────────────────────────────────────
// States
// ────────────────────────────────────────────────────────────────────────

export const States: Story = {
  render: (_args, { globals, viewMode }) => html`
    <div style="display: grid; gap: 32px;">
      <section>
        <h4 style="margin: 0 0 8px; font-family: Roboto; font-weight: 500;">
          Enabled (resting)
        </h4>
        ${dockedFrame(html`
          <md-search variant="contained" layout="docked" placeholder=${t(globals.locale, 'search')}></md-search>
        `)}
      </section>

      <section>
        <h4 style="margin: 0 0 8px; font-family: Roboto; font-weight: 500;">
          With value
        </h4>
        ${dockedFrame(html`
          <md-search
            variant="contained"
            layout="docked"
            placeholder=${t(globals.locale, 'search')}
            value="Wireless headphones"
          ></md-search>
        `)}
      </section>

      <section>
        <h4 style="margin: 0 0 8px; font-family: Roboto; font-weight: 500;">
          Disabled
        </h4>
        ${dockedFrame(html`
          <md-search
            variant="contained"
            layout="docked"
            placeholder=${t(globals.locale, 'search')}
            disabled
          ></md-search>
        `)}
      </section>

      <section>
        <h4 style="margin: 0 0 8px; font-family: Roboto; font-weight: 500;">
          Open (docked, with results visible)
        </h4>
        ${dockedFrame(html`
          <md-search
            variant="contained"
            layout="docked"
            placeholder=${t(globals.locale, 'search')}
            ?open=${viewMode !== 'docs'}
          >
            ${sampleResults(['Suggestion one', 'Suggestion two', 'Suggestion three'])}
          </md-search>
        `)}
      </section>
    </div>
  `,
};

// ────────────────────────────────────────────────────────────────────────
// Async results — debounce + throttle + distinct + loading indicator
// ────────────────────────────────────────────────────────────────────────

/** Mock catalogue the fake "server" searches over. */
const ASYNC_CATALOGUE = [
  'Wireless headphones',
  'Wireless charger',
  'Wireless keyboard',
  'Bluetooth speaker',
  'Bluetooth earbuds',
  'USB-C cable',
  'USB-C hub',
  'Mechanical keyboard',
  'Ergonomic mouse',
  'Laptop stand',
  'Webcam 4K',
  'Studio microphone',
  'Portable SSD',
  'Noise-cancelling earbuds',
  'Smart watch',
  'Phone tripod',
];

export const AsyncResults: Story = {
  name: 'Async results (debounce + throttle + loading)',
  parameters: {
    docs: {
      description: {
        story:
          'Wire an async fetch to the **`mdSearch`** event — it is debounced ' +
          '(300 ms), throttled (1000 ms max-wait) and de-duplicated on the ' +
          'trimmed query so the simulated server is hit only when the query ' +
          'meaningfully changes. While the (artificially delayed) request is ' +
          'in flight the bar shows the M3 loading indicator; the most recent ' +
          'query always wins, so out-of-order responses are discarded.',
      },
    },
  },
  render: (_args, { globals }) => {
    setTimeout(() => bootstrapAsyncSearch(), 0);
    return html`
      <div style="max-width: 600px;">
        <!-- Tall, clipped frame: gives the open docked panel enough vertical
             room for several result rows and keeps it (and its capped,
             scrollable results list) fully inside the card. -->
        <div
          style="position: relative; min-block-size: 480px; padding: 24px;
                 background: var(--md-sys-color-surface); border-radius: 16px;
                 border: 1px solid var(--md-sys-color-outline-variant);
                 overflow: hidden;"
        >
          <md-search
            id="async-search"
            variant="contained"
            layout="docked"
            placeholder=${t(globals.locale, 'search.searchProducts')}
            debounce="300"
            throttle="1000"
            no-results-label=${t(globals.locale, 'search.noProductsMatch')}
            style="--md-search-panel-max-block-size: 340px;"
          >
            ${sampleResults([
              'Wireless headphones',
              'USB-C cable',
              'Mechanical keyboard',
            ])}
          </md-search>
        </div>
        <!-- Status sits in normal flow BELOW the frame, so the absolutely
             positioned panel can never overlap or leak it at the edge. -->
        <p
          id="async-status"
          style="margin: 12px 4px 0; font: 12px/1.5 monospace;
                 color: var(--md-sys-color-on-surface-variant);
                 overflow-wrap: anywhere;"
        >
          Idle — type to query the mock server (≈600 ms latency).
        </p>
      </div>
    `;
  },
};

function bootstrapAsyncSearch() {
  const search = document.getElementById('async-search') as
    | (HTMLElement & { loading?: boolean })
    | null;
  const status = document.getElementById('async-status');
  if (!search || !status) return;
  if ((search as unknown as { __wired?: boolean }).__wired) return;
  (search as unknown as { __wired?: boolean }).__wired = true;

  // Newest-query-wins token so out-of-order responses are dropped.
  let token = 0;

  // Recent searches shown when the query is empty.
  const RECENTS = ['Wireless headphones', 'USB-C cable', 'Mechanical keyboard'];

  // Build a two-line row: leading icon, headline, supporting line, and (for
  // interactive rows) a trailing "arrow upward" button that fills the query.
  const makeRow = (
    headline: string,
    supporting: string,
    icon: string,
    interactive = true,
  ) => {
    const item = document.createElement('md-list-item');
    if (interactive) item.setAttribute('type', 'button');
    item.setAttribute('lines', '2');
    item.setAttribute('headline', headline);
    item.setAttribute('supporting-text', supporting);
    item.setAttribute('leading-icon', icon);
    if (interactive) {
      const btn = document.createElement('md-icon-button');
      btn.setAttribute('slot', 'trailing');
      btn.setAttribute('icon', 'arrow_upward');
      btn.setAttribute('aria-label', `Use “${headline}”`);
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        (search as unknown as { value?: string }).value = headline;
        (search as unknown as { focusInput?: () => void }).focusInput?.();
      });
      item.appendChild(btn);
    }
    return item;
  };

  // Swap the slotted results list for a freshly built one.
  const renderList = (build: (list: HTMLElement) => void) => {
    search.querySelectorAll('[slot="results"]').forEach((n) => n.remove());
    const list = document.createElement('md-list');
    list.setAttribute('slot', 'results');
    list.setAttribute('style', transparentListStyle);
    build(list);
    search.appendChild(list);
  };

  const renderRecents = () =>
    renderList((list) => {
      RECENTS.forEach((q) =>
        list.appendChild(makeRow(q, 'Recent search', 'history')),
      );
    });

  const renderRows = (rows: string[]) =>
    renderList((list) => {
      if (rows.length === 0) {
        list.appendChild(
          makeRow('No products match', 'Try a different term', 'search_off', false),
        );
      } else {
        rows.forEach((row) =>
          list.appendChild(makeRow(row, 'In catalogue', 'inventory_2')),
        );
      }
    });

  // Fake server: filters the catalogue after a network-like delay.
  const fetchFromServer = (query: string) =>
    new Promise<string[]>((resolve) => {
      const q = query.toLowerCase();
      setTimeout(
        () =>
          resolve(
            ASYNC_CATALOGUE.filter((item) => item.toLowerCase().includes(q)),
          ),
        600,
      );
    });

  search.addEventListener('mdSearch', async (e: Event) => {
    const query = (e as CustomEvent<{ value: string }>).detail.value;
    const ticket = ++token;

    if (!query) {
      search.loading = false;
      status!.textContent = 'Idle — type to query the mock server (≈600 ms latency).';
      renderRecents();
      return;
    }

    search.loading = true;
    status!.textContent = `Fetching "${query}"…`;

    const results = await fetchFromServer(query);
    if (ticket !== token) return; // a newer query superseded this one

    search.loading = false;
    status!.textContent = `"${query}" → ${results.length} result${
      results.length === 1 ? '' : 's'
    }`;
    renderRows(results);
  });
}

// ────────────────────────────────────────────────────────────────────────
// Voice search
// ────────────────────────────────────────────────────────────────────────

export const VoiceSearch: Story = {
  name: 'Voice search (Web Speech API)',
  parameters: {
    docs: {
      description: {
        story:
          'Opt in with the **`voice-search`** boolean. A mic button is added to ' +
          'the trailing cluster **only where the Web Speech API is available** ' +
          '(e.g. Chrome / Edge); on unsupported engines it is omitted entirely, ' +
          'so the demo below may show no mic depending on your browser. Tapping ' +
          'it streams recognised speech straight into the query, emitting ' +
          '`mdVoice` (`{ value, final }`) on every interim + final result. ' +
          'Style the button via `part="voice-button"` (it pulses while ' +
          'listening) and drive it programmatically with `startVoice()` / ' +
          '`stopVoice()`.',
      },
    },
  },
  render: (_args, { globals }) => html`
    <div style="display: grid; gap: 16px; max-width: 600px; font-family: Roboto;">
      <p style="margin: 0; opacity: 0.75;">
        The mic only appears where the Web Speech API is supported. While
        listening it shows a pulsing state and streams speech into the input,
        firing <code>mdVoice</code> as recognition progresses.
      </p>
      ${dockedFrame(html`
        <md-search
          variant="contained"
          layout="docked"
          voice-search
          placeholder=${t(globals.locale, 'search.tapMicSpeak')}
        >
          ${sampleResults([
            { query: 'weather today', supporting: t(globals.locale, 'search.spokenQuery') },
            { query: 'coffee near me', supporting: t(globals.locale, 'search.spokenQuery') },
          ])}
        </md-search>
      `)}
    </div>
  `,
};

// ────────────────────────────────────────────────────────────────────────
// Loading toggle — loading-indicator ↔ clear-✕ morph
// ────────────────────────────────────────────────────────────────────────

export const LoadingToggle: Story = {
  name: 'Loading ↔ clear morph',
  parameters: {
    docs: {
      description: {
        story:
          'The **`loading`** prop swaps the trailing affordance for an M3 ' +
          'loading indicator that **cross-fades (morphs)** with the clear-✕. ' +
          'The bar carries a value here so the clear button is present to morph ' +
          'from — toggle the button to watch the indicator ⇄ ✕ transition.',
      },
    },
  },
  render: () => {
    setTimeout(() => bootstrapLoadingToggle(), 0);
    return html`
      <div style="display: grid; gap: 16px; max-width: 600px; font-family: Roboto;">
        <p style="margin: 0; opacity: 0.75;">
          Toggle <code>loading</code> to see the trailing loading indicator
          cross-fade with the clear-✕.
        </p>
        ${dockedFrame(html`
          <md-search
            id="loading-search"
            variant="contained"
            layout="docked"
            value="headphones"
            placeholder="Search"
            show-clear-button
          ></md-search>
        `)}
        <md-button id="loading-toggle" variant="filled">
          Toggle loading
        </md-button>
      </div>
    `;
  },
  /** The `loading` prop mounts the in-bar busy indicator; toggling off retracts it. */
  play: async ({ canvasElement, step }) => {
    const search = await getSearch(canvasElement);
    const toggle = canvasElement.querySelector('#loading-toggle') as HTMLElement;
    // The story wires the toggle button in a setTimeout(0); wait for that before clicking.
    await waitFor(() =>
      expect((search as unknown as { __wired?: boolean }).__wired).toBe(true),
    );

    await step('At rest the bar shows no busy indicator', async () => {
      expect(search.loading).toBe(false);
      expect(search.hasAttribute('loading')).toBe(false);
      expect(loadingIndicatorOf(search)).toBeNull(); // no md-loading-indicator mounted
    });

    await step('Toggling loading mounts the M3 busy indicator', async () => {
      expect(loadingIndicatorOf(search)).toBeNull(); // before
      toggle.click(); // the wired "Toggle loading" button flips search.loading
      await waitFor(() => expect(search.loading).toBe(true));
      await waitFor(() => expect(search.hasAttribute('loading')).toBe(true)); // reflected
      await waitFor(() => expect(loadingIndicatorOf(search)).not.toBeNull()); // now in the DOM
      expect(loadingIndicatorOf(search)!.getAttribute('part')).toBe('loading');
    });

    await step('Toggling off retracts the indicator after the morph (guard)', async () => {
      toggle.click();
      await waitFor(() => expect(search.hasAttribute('loading')).toBe(false));
      // It stays mounted through its ~300ms cross-fade, then unmounts.
      await waitFor(() => expect(loadingIndicatorOf(search)).toBeNull(), {
        timeout: 1500,
      });
      await new Promise((r) => setTimeout(r, 300));
    });
  },
};

function bootstrapLoadingToggle() {
  const search = document.getElementById('loading-search') as
    | (HTMLElement & { loading?: boolean })
    | null;
  const btn = document.getElementById('loading-toggle');
  if (!search || !btn) return;
  if ((search as unknown as { __wired?: boolean }).__wired) return;
  (search as unknown as { __wired?: boolean }).__wired = true;
  btn.addEventListener('click', () => {
    search.loading = !search.loading;
  });
}

// ────────────────────────────────────────────────────────────────────────
// Accessibility
// ────────────────────────────────────────────────────────────────────────

export const Accessibility: Story = {
  render: () => html`
    <div
      style="display: grid; gap: 24px; max-width: 720px; font-family: Roboto;"
    >
      <p style="margin: 0; opacity: 0.85;">
        The component implements the WAI-ARIA combobox / searchbox pattern:
      </p>
      <ul style="margin: 0; padding-inline-start: 20px; opacity: 0.85;">
        <li><code>role="searchbox"</code> on the input, with <code>aria-expanded</code> mirroring <code>open</code>.</li>
        <li><code>role="dialog"</code> on the panel; <code>aria-modal="true"</code> only in full-screen.</li>
        <li>Focus is trapped inside the bar + panel in full-screen layout.</li>
        <li>Escape closes (configurable via <code>escape-closes</code>).</li>
        <li>The leading icon swaps to a labelled close button when full-screen + open.</li>
      </ul>
      ${dockedFrame(html`
        <md-search
          variant="contained"
          layout="docked"
          placeholder="Use Tab + Shift+Tab to traverse"
          input-aria-label="Search the knowledge base"
        >
          <md-icon-button slot="trailing" icon="mic" aria-label="Voice search"></md-icon-button>
          <md-icon-button slot="trailing" icon="tune" aria-label="Open filters"></md-icon-button>
          ${sampleResults(['Keyboard accessible', 'Screen-reader friendly', 'Focus trap demo'])}
        </md-search>
      `)}
    </div>
  `,
};

// ────────────────────────────────────────────────────────────────────────
// Localization
// ────────────────────────────────────────────────────────────────────────

const localizedExamples = [
  { lang: 'en', dir: 'ltr', placeholder: 'Search products', items: ['Laptop bag', 'USB-C cable'] },
  { lang: 'fr', dir: 'ltr', placeholder: 'Rechercher des produits', items: ['Sac d’ordinateur', 'Câble USB-C'] },
  { lang: 'de', dir: 'ltr', placeholder: 'Produkte suchen', items: ['Laptoptasche', 'USB-C-Kabel'] },
  { lang: 'ja', dir: 'ltr', placeholder: '商品を検索', items: ['ノートパソコンバッグ', 'USB-Cケーブル'] },
  { lang: 'ar', dir: 'rtl', placeholder: 'البحث عن المنتجات', items: ['حقيبة كمبيوتر', 'كابل USB-C'] },
  { lang: 'he', dir: 'rtl', placeholder: 'חיפוש מוצרים', items: ['תיק למחשב נייד', 'כבל USB-C'] },
];

export const Localization: Story = {
  render: () => html`
    <div style="display: grid; gap: 24px; max-width: 800px;">
      ${localizedExamples.map(
        ({ lang, dir, placeholder, items }) => html`
          <section lang=${lang} dir=${dir}>
            <h4
              style="margin: 0 0 8px; font-family: Roboto; font-weight: 500;
                     text-align: start;"
            >
              ${lang.toUpperCase()} · ${dir.toUpperCase()}
            </h4>
            ${dockedFrame(html`
              <md-search
                variant="contained"
                layout="docked"
                placeholder=${placeholder}
              >
                ${sampleResults(items)}
              </md-search>
            `)}
          </section>
        `,
      )}
    </div>
  `,
};

// ────────────────────────────────────────────────────────────────────────
// RTL
// ────────────────────────────────────────────────────────────────────────

export const RTL: Story = {
  render: () => html`
    <div dir="rtl" lang="ar">
      ${dockedFrame(html`
        <md-search
          variant="contained"
          layout="docked"
          placeholder="بحث"
        >
          <md-icon-button slot="trailing" icon="mic" aria-label="بحث صوتي"></md-icon-button>
          ${sampleResults([
            { query: 'نتيجة أولى', supporting: 'بحث سابق' },
            { query: 'نتيجة ثانية', supporting: 'بحث سابق' },
          ])}
        </md-search>
      `)}
    </div>
  `,
};

// ────────────────────────────────────────────────────────────────────────
// Dark theme
// ────────────────────────────────────────────────────────────────────────

export const DarkTheme: Story = {
  render: () => html`
    <div
      data-theme="dark"
      style="background: var(--md-sys-color-surface);
             padding: 32px; border-radius: 16px;"
    >
      ${dockedFrame(html`
        <md-search variant="contained" layout="docked" placeholder="Dark theme search">
          ${sampleResults(['Recent: keyboard', 'Recent: monitor'])}
        </md-search>
      `)}
    </div>
  `,
};

// ────────────────────────────────────────────────────────────────────────
// Custom CSS — token overrides
// ────────────────────────────────────────────────────────────────────────

export const CustomCSS: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'A tour of the `--md-search-*` custom-property API: per-instance color theming, shape, sizing, spacing, elevation, and a few cohesive branded presets. Every value is a real public custom property declared in the component CSS header — override them inline or via a class.',
      },
    },
  },
  render: () => html`
    <style>
      /* ── Cohesive branded presets (class-based overrides) ───────── */
      .brand {
        --md-search-container-color: #fff7ec;
        --md-search-leading-icon-color: #663300;
        --md-search-trailing-icon-color: #8a4b00;
        --md-search-state-layer-color: #663300;
        --md-search-focus-indicator-color: #b5651d;
        --md-search-input-color: #2b1d10;
        --md-search-placeholder-color: #8a6a45;
        --md-search-container-shape: 16px;
      }
      /* Token-driven brand — stays theme-aware (dark mode etc.). */
      .ocean {
        --md-search-container-color: var(--md-sys-color-primary-container);
        --md-search-leading-icon-color: var(--md-sys-color-on-primary-container);
        --md-search-trailing-icon-color: var(--md-sys-color-on-primary-container);
        --md-search-input-color: var(--md-sys-color-on-primary-container);
        --md-search-placeholder-color: var(--md-sys-color-on-primary-container);
        --md-search-state-layer-color: var(--md-sys-color-on-primary-container);
        --md-search-focus-indicator-color: var(--md-sys-color-primary);
      }
      /* Dense / compact bar. */
      .dense {
        --md-search-container-height: 44px;
        --md-search-icon-size: 20px;
        --md-search-leading-padding-inline: 8px;
        --md-search-trailing-padding-inline: 8px;
      }
      /* Sharp / square corners. */
      .sharp {
        --md-search-container-shape: var(--md-sys-shape-corner-none, 0px);
      }
      /* Rounded (not full pill). */
      .rounded {
        --md-search-container-shape: 12px;
      }
      /* Gradient bar — the container background is a real gradient painted on
         ::part(bar); icon/label colors are tuned for legibility on top. */
      .gradient::part(bar) {
        background: linear-gradient(135deg, #6a1b9a 0%, #c2185b 55%, #ef6c00 100%);
      }
      .gradient {
        --md-search-leading-icon-color: #ffffff;
        --md-search-trailing-icon-color: #ffffff;
        --md-search-input-color: #ffffff;
        --md-search-placeholder-color: rgba(255, 255, 255, 0.82);
        --md-search-state-layer-color: #ffffff;
        --md-search-focus-indicator-color: #ffffff;
      }
      /* Let each demo bar shrink to fit its card instead of forcing the
         360px host minimum (which overflows narrow grid columns). */
      .demo md-search {
        --md-search-container-min-inline-size: 0;
      }
      .demo-row {
        display: grid;
        gap: 24px;
        grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      }
      .demo h4 {
        margin: 0 0 8px;
        font-family: Roboto;
        font-weight: 500;
      }
      .demo code {
        font-size: 12px;
        opacity: 0.75;
      }
    </style>

    <div style="display: grid; gap: 40px; font-family: Roboto;">
      <!-- ── Color theming ──────────────────────────────────────── -->
      <section>
        <h3 style="margin: 0 0 16px; font-weight: 500;">Color theming</h3>
        <div class="demo-row">
          <div class="demo">
            <h4>Container color</h4>
            <code>--md-search-container-color</code>
            ${dockedFrame(html`
              <md-search
                variant="contained"
                layout="docked"
                placeholder="Tinted container"
                style="--md-search-container-color: #e3f2fd;"
              >
                ${plainResults(['Item A', 'Item B'])}
              </md-search>
            `)}
          </div>

          <div class="demo">
            <h4>Input + placeholder color</h4>
            <code>--md-search-input-color · --md-search-placeholder-color</code>
            ${dockedFrame(html`
              <md-search
                variant="contained"
                layout="docked"
                placeholder="Coloured text"
                value="Indigo input"
                style="--md-search-input-color: #311b92;
                       --md-search-placeholder-color: #7e57c2;"
              ></md-search>
            `)}
          </div>

          <div class="demo">
            <h4>Leading vs trailing icon color</h4>
            <code>--md-search-leading-icon-color · --md-search-trailing-icon-color</code>
            ${dockedFrame(html`
              <md-search
                variant="contained"
                layout="docked"
                placeholder="Two-tone icons"
                value="cat"
                style="--md-search-leading-icon-color: #00796b;
                       --md-search-trailing-icon-color: #c2185b;"
              >
                <md-icon-button slot="trailing" icon="mic" aria-label="Voice"></md-icon-button>
              </md-search>
            `)}
          </div>

          <div class="demo">
            <h4>State-layer color</h4>
            <code>--md-search-state-layer-color (hover / press wash)</code>
            ${dockedFrame(html`
              <md-search
                variant="contained"
                layout="docked"
                placeholder="Hover / press me"
                style="--md-search-state-layer-color: #6a1b9a;
                       --md-search-hover-state-layer-opacity: 0.16;"
              ></md-search>
            `)}
          </div>

          <div class="demo">
            <h4>Focus-indicator color</h4>
            <code>--md-search-focus-indicator-color (Tab to focus)</code>
            ${dockedFrame(html`
              <md-search
                variant="contained"
                layout="docked"
                placeholder="Keyboard-focus me"
                style="--md-search-focus-indicator-color: #e65100;
                       --md-search-focus-indicator-thickness: 3px;"
              ></md-search>
            `)}
          </div>

          <div class="demo">
            <h4>Loading-indicator color</h4>
            <code>--md-search-loading-color</code>
            ${dockedFrame(html`
              <md-search
                variant="contained"
                layout="docked"
                placeholder="Custom loading tint"
                style="--md-search-loading-color: #d81b60;"
              ></md-search>
            `)}
          </div>
        </div>
      </section>

      <!-- ── Shape & sizing ─────────────────────────────────────── -->
      <section>
        <h3 style="margin: 0 0 16px; font-weight: 500;">Shape &amp; sizing</h3>
        <div class="demo-row">
          <div class="demo">
            <h4>Pill (default full shape)</h4>
            <code>--md-search-container-shape: 9999px</code>
            ${dockedFrame(html`
              <md-search variant="contained" layout="docked" placeholder="Pill">
                ${plainResults(['Default pill'])}
              </md-search>
            `)}
          </div>

          <div class="demo">
            <h4>Rounded corners</h4>
            <code>--md-search-container-shape: 12px</code>
            ${dockedFrame(html`
              <md-search class="rounded" variant="contained" layout="docked" placeholder="Rounded">
                ${plainResults(['Rounded 12px'])}
              </md-search>
            `)}
          </div>

          <div class="demo">
            <h4>Sharp / square</h4>
            <code>--md-search-container-shape: 0</code>
            ${dockedFrame(html`
              <md-search class="sharp" variant="contained" layout="docked" placeholder="Sharp">
                ${plainResults(['Square corners'])}
              </md-search>
            `)}
          </div>

          <div class="demo">
            <h4>Taller container + larger icons</h4>
            <code>--md-search-container-height · --md-search-icon-size</code>
            ${dockedFrame(html`
              <md-search
                variant="contained"
                layout="docked"
                placeholder="64px tall"
                style="--md-search-container-height: 64px;
                       --md-search-icon-size: 28px;"
              >
                ${plainResults(['Roomy bar'])}
              </md-search>
            `)}
          </div>

          <div class="demo">
            <h4>Avatar size (trailing avatar)</h4>
            <code>--md-search-avatar-size</code>
            ${dockedFrame(html`
              <md-search
                variant="contained"
                layout="docked"
                placeholder="Profile search"
                style="--md-search-avatar-size: 32px;"
              >
                <md-avatar slot="trailing" initials="A" label="Account"></md-avatar>
              </md-search>
            `)}
          </div>
        </div>
      </section>

      <!-- ── Spacing ────────────────────────────────────────────── -->
      <section>
        <h3 style="margin: 0 0 16px; font-weight: 500;">Spacing</h3>
        <div class="demo-row">
          <div class="demo">
            <h4>Leading / trailing edge padding</h4>
            <code>--md-search-leading-padding-inline · --md-search-trailing-padding-inline</code>
            ${dockedFrame(html`
              <md-search
                variant="contained"
                layout="docked"
                placeholder="Wider gutters"
                value="cat"
                style="--md-search-leading-padding-inline: 16px;
                       --md-search-trailing-padding-inline: 16px;"
              >
                <md-icon-button slot="trailing" icon="mic" aria-label="Voice"></md-icon-button>
              </md-search>
            `)}
          </div>

          <div class="demo">
            <h4>Icon ↔ label gaps</h4>
            <code>--md-search-leading-icon-label-gap · --md-search-trailing-icon-label-gap</code>
            ${dockedFrame(html`
              <md-search
                variant="contained"
                layout="docked"
                placeholder="Tighter label gap"
                value="cat"
                style="--md-search-leading-icon-label-gap: 0px;
                       --md-search-trailing-icon-label-gap: 0px;"
              ></md-search>
            `)}
          </div>

          <div class="demo">
            <h4>Container inline padding</h4>
            <code>--md-search-container-padding-inline(-focused)</code>
            ${dockedFrame(html`
              <md-search
                variant="contained"
                layout="docked"
                placeholder="Extra bar padding"
                style="--md-search-container-padding-inline: 12px;
                       --md-search-container-padding-inline-focused: 12px;"
              >
                ${plainResults(['Padded bar'])}
              </md-search>
            `)}
          </div>
        </div>
      </section>

      <!-- ── Elevation ──────────────────────────────────────────── -->
      <section>
        <h3 style="margin: 0 0 16px; font-weight: 500;">Elevation</h3>
        <p style="margin: 0 0 16px; opacity: 0.75;">
          The <code>elevation</code> prop (0–5) maps the resting bar to an
          <code>--md-sys-elevation-{n}</code> tier. For a fully custom shadow set
          <code>--md-search-container-elevation</code> (it overrides the prop).
        </p>
        <div class="demo-row">
          ${[0, 1, 2, 3, 4, 5].map(
            (level) => html`
              <div class="demo">
                <h4>elevation=${level}</h4>
                ${dockedFrame(html`
                  <md-search
                    variant="contained"
                    layout="docked"
                    placeholder="Level ${level}"
                    elevation=${level}
                  ></md-search>
                `)}
              </div>
            `,
          )}
          <div class="demo">
            <h4>Custom shadow</h4>
            <code>--md-search-container-elevation</code>
            ${dockedFrame(html`
              <md-search
                variant="contained"
                layout="docked"
                placeholder="Custom glow"
                style="--md-search-container-elevation: 0 4px 24px rgba(216, 27, 96, 0.4);"
              ></md-search>
            `)}
          </div>
        </div>
      </section>

      <!-- ── Branded presets ────────────────────────────────────── -->
      <section>
        <h3 style="margin: 0 0 16px; font-weight: 500;">Branded presets</h3>
        <div class="demo-row">
          <div class="demo">
            <h4>Warm brand palette</h4>
            <code>.brand</code>
            ${dockedFrame(html`
              <md-search class="brand" variant="contained" layout="docked"
                placeholder="Search the catalogue" value="cat">
                <md-icon-button slot="trailing" icon="mic" aria-label="Voice"></md-icon-button>
                ${plainResults(['Brand item 1', 'Brand item 2'])}
              </md-search>
            `)}
          </div>

          <div class="demo">
            <h4>Token-driven (theme-aware)</h4>
            <code>.ocean — uses --md-sys-color-primary-container</code>
            ${dockedFrame(html`
              <md-search class="ocean" variant="contained" layout="docked"
                placeholder="Primary container">
                ${plainResults(['Stays correct in dark mode'])}
              </md-search>
            `)}
          </div>

          <div class="demo">
            <h4>Dense / compact</h4>
            <code>.dense — 44px height, 20px icons</code>
            ${dockedFrame(html`
              <md-search class="dense" variant="contained" layout="docked"
                placeholder="Compact search">
                ${plainResults(['Tighter row 1', 'Tighter row 2'])}
              </md-search>
            `)}
          </div>

          <div class="demo">
            <h4>Sharp square variant</h4>
            <code>.sharp — corner-none</code>
            ${dockedFrame(html`
              <md-search class="sharp" variant="divided" layout="docked"
                placeholder="Square search">
                ${plainResults(['Squared off'])}
              </md-search>
            `)}
          </div>

          <div class="demo">
            <h4>Gradient bar</h4>
            <code>::part(bar) { background: linear-gradient(…) }</code>
            ${dockedFrame(html`
              <md-search class="gradient" variant="contained" layout="docked"
                placeholder="Gradient search" value="cat">
                <md-icon-button slot="trailing" icon="mic" aria-label="Voice"></md-icon-button>
                ${plainResults(['Sunset gradient', 'Painted on ::part(bar)'])}
              </md-search>
            `)}
          </div>
        </div>
      </section>
    </div>
  `,
};

// ────────────────────────────────────────────────────────────────────────
// CSS Parts
// ────────────────────────────────────────────────────────────────────────

export const CSSParts: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Style the component internals through the shadow boundary with `::part(...)`. Exposed parts: `bar`, `state-layer`, `leading`, `input`, `trailing`, `clear-button`, `loading` / `loading-shape`, `voice-button`, `panel`, `panel-body`, `divider`, `results-viewport`, and `results-shadow-block-start` / `results-shadow-block-end`.',
      },
    },
  },
  render: (_args, { viewMode }) => html`
    <style>
      /* input */
      .uppercase-input::part(input) {
        text-transform: uppercase;
        letter-spacing: 1px;
        font-weight: 600;
      }
      /* leading / trailing / clear-button */
      .colored-icons::part(leading),
      .colored-icons::part(trailing),
      .colored-icons::part(clear-button) {
        color: var(--md-sys-color-tertiary);
      }
      /* state-layer */
      .glow::part(state-layer) {
        background-color: gold;
      }
      /* bar */
      .bordered-bar::part(bar) {
        outline: 2px solid var(--md-sys-color-primary);
        outline-offset: -2px;
      }
      /* divider (divided variant) */
      .thick-divider::part(divider) {
        background-color: var(--md-sys-color-primary);
        block-size: 2px;
      }
      /* panel */
      .square::part(panel) {
        border-radius: 4px;
      }
      /* results-viewport — style the inner scroll area */
      .scroll-tint::part(results-viewport) {
        background-color: var(--md-sys-color-surface-container-high);
        border-radius: 12px;
      }
      /* Let each demo bar shrink to fit its card instead of forcing the
         360px host minimum (which overflows narrow grid columns). */
      .demo md-search {
        --md-search-container-min-inline-size: 0;
      }
      .demo-row {
        display: grid;
        gap: 24px;
        grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      }
      .demo h4 {
        margin: 0 0 8px;
        font-family: Roboto;
        font-weight: 500;
      }
      .demo code {
        font-size: 12px;
        opacity: 0.75;
      }
    </style>

    <div style="display: grid; gap: 24px; font-family: Roboto;">
      <div class="demo-row">
        <div class="demo">
          <h4>Uppercase input</h4>
          <code>::part(input)</code>
          ${dockedFrame(html`
            <md-search class="uppercase-input" variant="contained" layout="docked"
              placeholder="Type something" value="hello"></md-search>
          `)}
        </div>

        <div class="demo">
          <h4>Tertiary-coloured icons</h4>
          <code>::part(leading) · ::part(trailing) · ::part(clear-button)</code>
          ${dockedFrame(html`
            <md-search class="colored-icons" variant="contained" layout="docked"
              placeholder="Search" value="something">
              <md-icon-button slot="trailing" icon="mic" aria-label="Voice"></md-icon-button>
            </md-search>
          `)}
        </div>

        <div class="demo">
          <h4>Gold state-layer</h4>
          <code>::part(state-layer)</code>
          ${dockedFrame(html`
            <md-search class="glow" variant="contained" layout="docked"
              placeholder="Hover or press me"></md-search>
          `)}
        </div>

        <div class="demo">
          <h4>Outlined bar</h4>
          <code>::part(bar)</code>
          ${dockedFrame(html`
            <md-search class="bordered-bar" variant="contained" layout="docked"
              placeholder="Outlined container"></md-search>
          `)}
        </div>

        <div class="demo">
          <h4>Thicker tinted divider</h4>
          <code>::part(divider)</code>
          ${dockedFrame(html`
            <md-search class="thick-divider" variant="divided" layout="docked"
              placeholder="Search" ?open=${viewMode !== 'docs'}>
              ${plainResults(['Divider above me', 'Second row'])}
            </md-search>
          `)}
        </div>

        <div class="demo">
          <h4>Square panel corners</h4>
          <code>::part(panel)</code>
          ${dockedFrame(html`
            <md-search class="square" variant="contained" layout="docked"
              placeholder="Search" ?open=${viewMode !== 'docs'}>
              ${plainResults(['Square corners', 'Sharp design'])}
            </md-search>
          `)}
        </div>

        <div class="demo">
          <h4>Tinted results viewport</h4>
          <code>::part(results-viewport)</code>
          ${dockedFrame(html`
            <md-search class="scroll-tint" variant="contained" layout="docked"
              placeholder="Scroll the results" ?open=${viewMode !== 'docs'}
              style="--md-search-panel-max-block-size: 220px;">
              <div slot="results">${eliEmailList()}</div>
            </md-search>
          `)}
        </div>
      </div>
    </div>
  `,
};

// ────────────────────────────────────────────────────────────────────────
// Icons — prop-based shorthand + slotted custom icons
// ────────────────────────────────────────────────────────────────────────

export const Icons: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Every way to change the search icons: the prop-based `leading-icon` Material Symbols shorthand, the `open-leading-icon` glyph shown when the bar is open, fully slotted leading icons (SVG / emoji), trailing slot actions (`md-icon-button`, `md-avatar`), and icon color / size via the `--md-search-*-icon-color` and `--md-search-icon-size` custom properties.',
      },
    },
  },
  render: (_args, { viewMode }) => {
    // Content-sized frame for resting-state demos — just the bar height, no
    // reserved panel space (avoids the large empty gap).
    const restingFrame = (children: unknown) => html`
      <div
        style="padding: 16px; background: var(--md-sys-color-surface);
               border-radius: 16px;
               border: 1px solid var(--md-sys-color-outline-variant);"
      >
        ${children}
      </div>
    `;
    // Relative frame for open-state demos — reserves room for the anchored
    // docked panel so the open/back glyph and a short result list are visible.
    const openFrame = (children: unknown) => html`
      <div
        style="position: relative; padding: 16px; min-height: 280px;
               background: var(--md-sys-color-surface); border-radius: 16px;
               border: 1px solid var(--md-sys-color-outline-variant);
               overflow: hidden;"
      >
        ${children}
      </div>
    `;
    return html`
      <style>
        .demo-row {
          display: grid;
          gap: 24px;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
        }
        .demo h4 {
          margin: 0 0 8px;
          font-family: Roboto;
          font-weight: 500;
        }
        .demo code {
          display: block;
          margin-bottom: 8px;
          font-size: 12px;
          opacity: 0.75;
        }
        /* Let each demo bar shrink to fit its card instead of forcing the
           360px host minimum (which overflows narrow grid columns). */
        .demo md-search {
          --md-search-container-min-inline-size: 0;
        }
      </style>

      <div style="display: grid; gap: 40px; font-family: Roboto;">
        <!-- ── Prop-based Material Symbols ─────────────────────────── -->
        <section>
          <h3 style="margin: 0 0 16px; font-weight: 500;">Prop-based (Material Symbols)</h3>
          <div class="demo-row">
            <div class="demo">
              <h4>Custom leading glyph</h4>
              <code>leading-icon="travel_explore"</code>
              ${restingFrame(html`
                <md-search
                  variant="contained"
                  layout="docked"
                  leading-icon="travel_explore"
                  placeholder="Explore"
                ></md-search>
              `)}
            </div>

            <div class="demo">
              <h4>Custom open (back) glyph — shown open</h4>
              <code>open-leading-icon="close"</code>
              ${openFrame(html`
                <md-search
                  variant="contained"
                  layout="docked"
                  leading-icon="search"
                  open-leading-icon="close"
                  placeholder="Leading morphs to ✕"
                  ?open=${viewMode !== 'docs'}
                  .dismissOnOutsideClick=${false}
                  style="--md-search-panel-min-block-size: 0;
                         --md-search-panel-max-block-size: 160px;"
                >
                  ${plainResults(['Click ✕ to dismiss', 'Custom open glyph'])}
                </md-search>
              `)}
            </div>

            <div class="demo">
              <h4>Divided default back glyph — shown open</h4>
              <code>divided → arrow_back (when open)</code>
              ${openFrame(html`
                <md-search
                  variant="divided"
                  layout="docked"
                  placeholder="Baseline back arrow"
                  ?open=${viewMode !== 'docs'}
                  .dismissOnOutsideClick=${false}
                  style="--md-search-panel-min-block-size: 0;
                         --md-search-panel-max-block-size: 160px;"
                >
                  ${plainResults(['arrow_back glyph', 'Spec-canonical'])}
                </md-search>
              `)}
            </div>
          </div>
        </section>

        <!-- ── Slotted leading icons ──────────────────────────────── -->
        <section>
          <h3 style="margin: 0 0 16px; font-weight: 500;">Slotted leading icon</h3>
          <p style="margin: 0 0 16px; opacity: 0.75;">
            A <code>slot="leading"</code> element replaces the built-in
            search/back morph button entirely — supply any custom element.
          </p>
          <div class="demo-row">
            <div class="demo">
              <h4>Inline SVG</h4>
              <code>&lt;svg slot="leading"&gt;</code>
              ${restingFrame(html`
                <md-search variant="contained" layout="docked" placeholder="SVG leading">
                  <svg
                    slot="leading"
                    viewBox="0 0 24 24"
                    width="24"
                    height="24"
                    fill="currentColor"
                    style="color: var(--md-sys-color-primary);"
                  >
                    <path
                      d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                    />
                  </svg>
                </md-search>
              `)}
            </div>

            <div class="demo">
              <h4>Emoji</h4>
              <code>&lt;span slot="leading"&gt;🔎&lt;/span&gt;</code>
              ${restingFrame(html`
                <md-search variant="contained" layout="docked" placeholder="Emoji leading">
                  <span slot="leading" style="font-size: 22px; line-height: 1;">🔎</span>
                </md-search>
              `)}
            </div>
          </div>
        </section>

        <!-- ── Slotted trailing actions ───────────────────────────── -->
        <section>
          <h3 style="margin: 0 0 16px; font-weight: 500;">Slotted trailing actions</h3>
          <div class="demo-row">
            <div class="demo">
              <h4>Icon buttons</h4>
              <code>md-icon-button slot="trailing"</code>
              ${restingFrame(html`
                <md-search variant="contained" layout="docked" placeholder="Voice + filters">
                  <md-icon-button slot="trailing" icon="mic" aria-label="Voice search"></md-icon-button>
                  <md-icon-button slot="trailing" icon="tune" aria-label="Filters"></md-icon-button>
                </md-search>
              `)}
            </div>

            <div class="demo">
              <h4>Avatar</h4>
              <code>md-avatar slot="trailing"</code>
              ${restingFrame(html`
                <md-search variant="contained" layout="docked" placeholder="Profile search">
                  <md-avatar slot="trailing" initials="JD" label="Jane Doe"></md-avatar>
                </md-search>
              `)}
            </div>

            <div class="demo">
              <h4>Icon button + avatar</h4>
              <code>combined trailing cluster</code>
              ${restingFrame(html`
                <md-search variant="contained" layout="docked" placeholder="Search">
                  <md-icon-button slot="trailing" icon="mic" aria-label="Voice search"></md-icon-button>
                  <md-avatar slot="trailing" initials="B" label="Profile"></md-avatar>
                </md-search>
              `)}
            </div>
          </div>
        </section>

        <!-- ── Icon color & size ──────────────────────────────────── -->
        <section>
          <h3 style="margin: 0 0 16px; font-weight: 500;">Icon color &amp; size</h3>
          <div class="demo-row">
            <div class="demo">
              <h4>Tinted leading + trailing</h4>
              <code>--md-search-leading-icon-color · --md-search-trailing-icon-color</code>
              ${restingFrame(html`
                <md-search
                  variant="contained"
                  layout="docked"
                  placeholder="Two-tone icons"
                  value="cat"
                  style="--md-search-leading-icon-color: #1565c0;
                         --md-search-trailing-icon-color: #ad1457;"
                >
                  <md-icon-button slot="trailing" icon="mic" aria-label="Voice"></md-icon-button>
                </md-search>
              `)}
            </div>

            <div class="demo">
              <h4>Larger icons</h4>
              <code>--md-search-icon-size: 30px</code>
              ${restingFrame(html`
                <md-search
                  variant="contained"
                  layout="docked"
                  placeholder="Bigger glyphs"
                  value="cat"
                  style="--md-search-icon-size: 30px;
                         --md-search-container-height: 64px;"
                ></md-search>
              `)}
            </div>
          </div>
        </section>
      </div>
    `;
  },
};

// ────────────────────────────────────────────────────────────────────────
// Responsiveness — container queries
// ────────────────────────────────────────────────────────────────────────

export const Responsiveness: Story = {
  render: () => html`
    <style>
      .resp-frame {
        container-type: inline-size;
        resize: horizontal;
        overflow: auto;
        min-width: 320px;
        max-width: 1000px;
        padding: 24px;
        border: 1px dashed var(--md-sys-color-outline);
        border-radius: 12px;
        background: var(--md-sys-color-surface);
      }
      .resp-frame md-search {
        --md-search-container-min-inline-size: 0;
      }
      @container (max-width: 480px) {
        .resp-frame md-search {
          --md-search-container-padding-inline: 16px;
        }
      }
    </style>

    <div style="font-family: Roboto;">
      <p style="margin: 0 0 12px; opacity: 0.8;">
        The bar's <code>min-inline-size</code> is overridden via a CSS custom
        property and a container query to demonstrate fluid behaviour. Drag the
        bottom-right corner of the frame to resize.
      </p>
      <div class="resp-frame">
        <md-search variant="contained" layout="docked" placeholder="Resize me">
          <md-icon-button slot="trailing" icon="mic" aria-label="Voice search"></md-icon-button>
          ${sampleResults(['Auto-fits', 'Container queries', 'Logical properties'])}
        </md-search>
      </div>
    </div>
  `,
};

// ────────────────────────────────────────────────────────────────────────
// Icon trigger — open via the compact search icon button
// ────────────────────────────────────────────────────────────────────────

export const IconTrigger: Story = {
  name: 'Icon trigger (open via button)',
  render: (_args, { globals }) =>
    dockedFrame(html`
      <md-search
        variant="contained"
        layout="docked"
        trigger="icon"
        placeholder=${t(globals.locale, 'search')}
        .dismissOnOutsideClick=${false}
      >
        ${sampleResults(['Recent one', 'Recent two'])}
      </md-search>
    `),
  /** The compact icon trigger opens the bar via click OR Space/Enter activation. */
  play: async ({ canvasElement, step }) => {
    const search = await getSearch(canvasElement);
    const api = search as unknown as { close(): Promise<void> };
    const triggerBtn = () =>
      search.shadowRoot!.querySelector(
        '.md-search__trigger-button',
      ) as HTMLElement | null;

    await step('Closed icon trigger renders a search button, no bar chrome', async () => {
      expect(search.open).toBe(false);
      await waitFor(() => expect(triggerBtn()).not.toBeNull());
      expect(search.shadowRoot!.querySelector('[part="bar"]')).toBeNull(); // bar hidden until open
    });

    await step('A non-activation key on the trigger is ignored', async () => {
      pressKey(triggerBtn()!, 'a'); // neither Enter nor Space
      expect(search.open).toBe(false); // still closed — key was a no-op
    });

    await step('Space on the trigger opens the panel + emits mdOpen', async () => {
      let opened = false;
      search.addEventListener('mdOpen', () => (opened = true), { once: true });
      pressKey(triggerBtn()!, ' '); // Space activates
      await waitFor(() => expect(search.open).toBe(true));
      expect(opened).toBe(true);
      await waitFor(() =>
        expect(search.shadowRoot!.querySelector('[part="bar"]')).not.toBeNull(),
      ); // bar chrome now mounted
    });

    await step('Closing retracts the bar and restores the trigger button', async () => {
      await api.close();
      await waitFor(() => expect(search.open).toBe(false));
      await waitFor(() => expect(triggerBtn()).not.toBeNull(), { timeout: 1000 });
    });

    await step('Clicking the trigger button reopens the panel', async () => {
      triggerBtn()!.click();
      await waitFor(() => expect(search.open).toBe(true));
    });
  },
};

// ────────────────────────────────────────────────────────────────────────
// External trigger — the opener lives outside the component
// ────────────────────────────────────────────────────────────────────────

export const ExternalTrigger: Story = {
  name: 'External trigger (opener outside the component)',
  parameters: {
    docs: {
      description: {
        story:
          'The built-in trigger and the `trigger` slot both have to sit INSIDE ' +
          '`md-search`. When the opener belongs somewhere else on the page — an ' +
          'app-bar icon, a menu item, a shortcut hint — point `trigger-for` at it ' +
          '(a document selector) or assign the element to `.triggerElement`. ' +
          'The component wires it instead of rendering it: activation toggles the ' +
          'view, `aria-haspopup="dialog"` / `aria-expanded` stay in step, closing ' +
          'returns focus to it, and the search renders nothing at rest so the page ' +
          'never shows two ways in. Use a real button — activation rides on `click`, ' +
          'which native buttons already emit for Enter and Space.',
      },
    },
  },
  render: (_args, { globals }) =>
    dockedFrame(html`
      <div style="display: flex; justify-content: flex-end; margin-block-end: 12px;">
        <md-icon-button
          id="md-search-external-trigger"
          icon="search"
          aria-label=${t(globals.locale, 'search')}
        ></md-icon-button>
      </div>
      <md-search
        variant="contained"
        layout="docked"
        trigger-for="#md-search-external-trigger"
        placeholder=${t(globals.locale, 'search')}
      >
        ${sampleResults(['Recent one', 'Recent two'])}
      </md-search>
    `),
  /** The outside opener drives the view and owns the focus round trip. */
  play: async ({ canvasElement, step }) => {
    const search = await getSearch(canvasElement);
    const trigger = canvasElement.querySelector(
      '#md-search-external-trigger',
    ) as HTMLElement;

    await step('At rest the search renders nothing — the outside button is the only way in', async () => {
      expect(search.open).toBe(false);
      expect(search.shadowRoot!.querySelector('[part="trigger"]')).toBeNull();
      expect(search.shadowRoot!.querySelector('[part="bar"]')).toBeNull();
    });

    await step('The trigger advertises the dialog it opens', async () => {
      await waitFor(() => expect(trigger.getAttribute('aria-haspopup')).toBe('dialog'));
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
    });

    await step('Activating it opens the panel and flips aria-expanded', async () => {
      let opened = false;
      search.addEventListener('mdOpen', () => (opened = true), { once: true });
      trigger.click();
      await waitFor(() => expect(search.open).toBe(true));
      expect(opened).toBe(true);
      await waitFor(() =>
        expect(search.shadowRoot!.querySelector('[part="bar"]')).not.toBeNull(),
      );
      expect(trigger.getAttribute('aria-expanded')).toBe('true');
    });

    await step('Activating it again closes — the outside-click handler does not fight it', async () => {
      trigger.click();
      await waitFor(() => expect(search.open).toBe(false));
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
    });
  },
};

// ────────────────────────────────────────────────────────────────────────
// Bar + trailing action — bar-click open, slotted trailing emit, outside dismiss
// ────────────────────────────────────────────────────────────────────────

export const TrailingActionClick: Story = {
  name: 'Bar + trailing action (click to emit)',
  render: (_args, { globals }) =>
    dockedFrame(html`
      <md-search
        variant="contained"
        layout="docked"
        placeholder=${t(globals.locale, 'search')}
      >
        <md-icon-button
          slot="trailing"
          icon="tune"
          aria-label="Open filters"
        ></md-icon-button>
        ${sampleResults(['Suggestion one', 'Suggestion two'])}
      </md-search>
    `),
  /** Clicking the bar opens + focuses; a slotted trailing action emits without toggling. */
  play: async ({ canvasElement, step }) => {
    const search = await getSearch(canvasElement);
    const bar = search.shadowRoot!.querySelector('[part="bar"]') as HTMLElement;

    await step('Clicking the bar opens the panel and focuses the input', async () => {
      let opened = false;
      search.addEventListener('mdOpen', () => (opened = true), { once: true });
      bar.click();
      await waitFor(() => expect(search.open).toBe(true));
      expect(opened).toBe(true);
      await waitFor(() =>
        expect(search.shadowRoot!.activeElement).toBe(inputOf(search)),
      ); // handleBarClick focuses the field
    });

    await step('Clicking a slotted trailing action emits mdTrailingIconClick', async () => {
      const trailingBtn = search.querySelector(
        'md-icon-button[slot="trailing"]',
      ) as HTMLElement;
      let detail: { value: string; open: boolean } | undefined;
      search.addEventListener(
        'mdTrailingIconClick',
        (e) =>
          (detail = (e as CustomEvent<{ value: string; open: boolean }>).detail),
        { once: true },
      );
      trailingBtn.click();
      await waitFor(() => expect(detail).toBeDefined());
      expect(detail!.open).toBe(true); // panel open at click time
      expect(detail!.value).toBe(search.value); // carries the current query
      expect(search.open).toBe(true); // a trailing action must NOT toggle the panel
    });

    await step('An outside mousedown dismisses the docked panel', async () => {
      let closed = false;
      search.addEventListener('mdClose', () => (closed = true), { once: true });
      // The outside-click handler listens for mousedown in the capture phase.
      document.body.dispatchEvent(
        new MouseEvent('mousedown', { bubbles: true, composed: true }),
      );
      await waitFor(() => expect(search.open).toBe(false));
      expect(closed).toBe(true);
      await new Promise((r) => setTimeout(r, 300)); // settle the close animation
    });
  },
};
