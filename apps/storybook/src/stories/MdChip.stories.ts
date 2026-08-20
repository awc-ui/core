import type { Meta, StoryObj } from '@storybook/web-components';
import { expect, waitFor } from 'storybook/test';
import { html, nothing } from 'lit';
import { t } from '../i18n';

/** Shadow-piercing helpers for play(): testing-library queries can't cross
 *  shadow roots, so interactions/reads address the real internals directly. */
type ChipEl = HTMLElement & { selected: boolean; disabled: boolean; variant: string };
const hydratedChips = async (canvasElement: HTMLElement, selector: string): Promise<ChipEl[]> => {
  const chips = [...canvasElement.querySelectorAll(selector)] as ChipEl[];
  await waitFor(() => expect(chips.every((c) => c.classList.contains('hydrated'))).toBe(true));
  return chips;
};
/** The MD3 selection checkmark only renders inside a selected, icon-less filter chip. */
const checkmarkOf = (chip: ChipEl) => chip.shadowRoot!.querySelector('[part="checkmark"]');

const meta: Meta = {
  title: 'Selection/Chip',
  component: 'md-chip',
  tags: ['autodocs'],
  parameters: {
    docs: {
      source: { language: 'html' },
    },
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['assist', 'filter', 'input', 'suggestion'],
      description: 'Chip variant',
    },
    appearance: {
      control: 'select',
      options: ['outlined', 'filled', 'elevated'],
      description: 'Surface style — independent of `variant`, which picks the chip TYPE',
    },
    color: {
      control: 'select',
      options: ['', 'primary', 'secondary', 'tertiary', 'error', 'success', 'warning', 'info'],
      description: 'Colour role. Blank = neutral surface treatment',
    },
    icon: {
      control: 'text',
      description: 'Material Symbols icon name for leading icon',
    },
    trailingIcon: {
      control: 'text',
      description: 'Material Symbols icon name for trailing icon',
    },
    selected: {
      control: 'boolean',
      description: 'Selected state (filter/input)',
    },
    elevated: {
      control: 'boolean',
      description: 'Elevated style (shadow instead of outline)',
    },
    disabled: {
      control: 'boolean',
      description: 'Disabled state',
    },
    label: {
      control: 'text',
      description: 'Label text (alternative to slot)',
    },
  },
  args: {
    variant: 'assist',
    appearance: 'outlined',
    color: '',
    icon: '',
    trailingIcon: '',
    selected: false,
    disabled: false,
    label: 'Chip',
  },
};
export default meta;
type Story = StoryObj;

export const Playground: Story = {
  render: (args) => html`
    <md-chip
      variant=${args.variant}
      appearance=${args.appearance}
      color=${args.color || nothing}
      icon=${args.icon}
      trailing-icon=${args.trailingIcon}
      ?selected=${args.selected}
      ?disabled=${args.disabled}
    >${args.label}</md-chip>
  `,
};

export const AllVariants: Story = {
  render: () => html`
    <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
      <md-chip variant="assist" icon="event">Assist</md-chip>
      <md-chip variant="filter">Filter</md-chip>
      <md-chip variant="input">Input</md-chip>
      <md-chip variant="suggestion">Suggestion</md-chip>
    </div>
  `,
};

/**
 * `appearance` (surface style) is independent of `variant` (chip type), so any
 * chip type can be outlined, filled or elevated. `color` tints it: the four
 * baseline M3 palette roles plus the semantic status roles (success / warning /
 * info) added to the token layer.
 *
 * Leaving `color` off keeps the neutral treatment — note that a neutral filled
 * chip takes a surface tone rather than the secondary container, so it is never
 * mistaken for a selected chip.
 */
export const AppearanceAndColor: Story = {
  parameters: { layout: 'padded' },
  render: () => {
    const colors = ['', 'primary', 'secondary', 'tertiary', 'error', 'success', 'warning', 'info'];
    const row = (appearance: string) => html`
      <tr>
        <th
          scope="row"
          style="text-align: right; padding: 8px 16px 8px 0; font: 500 13px/1.4 Roboto, sans-serif; white-space: nowrap;"
        >
          ${appearance}
        </th>
        ${colors.map(
          (c) => html`<td style="padding: 6px 8px;">
            <md-chip variant="assist" appearance=${appearance} color=${c || nothing} icon="event">
              ${c || 'neutral'}
            </md-chip>
          </td>`,
        )}
      </tr>
    `;
    return html`
      <table style="border-collapse: collapse;">
        ${['outlined', 'filled', 'elevated'].map(row)}
      </table>
    `;
  },
};

export const AssistChips: Story = {
  render: (_args, { globals }) => html`
    <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
      <md-chip variant="assist">Plain Assist</md-chip>
      <md-chip variant="assist" icon="event">With Icon</md-chip>
      <md-chip variant="assist" icon="directions">${t(globals.locale, 'chip.directions')}</md-chip>
      <md-chip variant="assist" elevated icon="star">Elevated</md-chip>
      <md-chip variant="assist" disabled icon="event">Disabled</md-chip>
    </div>
  `,
  /** Assist chips are NOT selectable: click/Enter emit mdClick only, never
   *  mdSelect, and the host exposes no aria-pressed toggle state. */
  play: async ({ canvasElement, step }) => {
    const chips = await hydratedChips(canvasElement, 'md-chip[variant="assist"]');
    const plain = chips.find((c) => !c.hasAttribute('disabled'))!;

    await step('Click emits mdClick and does NOT toggle selection (isSelectable=false)', async () => {
      let clicked = false, selected = false;
      plain.addEventListener('mdClick', () => { clicked = true; }, { once: true });
      plain.addEventListener('mdSelect', () => { selected = true; }, { once: true });
      plain.click();

      await waitFor(() => expect(clicked).toBe(true)); // handleClick reached mdClick.emit()
      expect(selected).toBe(false); // assist skips the toggle branch
      expect(plain.hasAttribute('selected')).toBe(false);
      expect(plain.getAttribute('aria-pressed')).toBeNull(); // no toggle semantics exposed
    });

    await step('Enter routes handleKeyDown → triggerRipple + el.click() → mdClick', async () => {
      let clicked = false;
      plain.addEventListener('mdClick', () => { clicked = true; }, { once: true });
      plain.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
      await waitFor(() => expect(clicked).toBe(true)); // keydown synthesised a real activation
    });

    await step('Space also routes handleKeyDown → el.click() → mdClick (space branch), no toggle', async () => {
      let clicked = false, selected = false;
      plain.addEventListener('mdClick', () => { clicked = true; }, { once: true });
      plain.addEventListener('mdSelect', () => { selected = true; }, { once: true });
      plain.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));

      await waitFor(() => expect(clicked).toBe(true)); // Space branch synthesised an activation
      expect(selected).toBe(false); // assist stays non-selectable through the keyboard path
    });

    await step('A non-activation key is ignored: handleKeyDown falls through both key branches', async () => {
      let clicked = false, removed = false;
      plain.addEventListener('mdClick', () => { clicked = true; }, { once: true });
      plain.addEventListener('mdRemove', () => { removed = true; }, { once: true });
      plain.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));

      await new Promise((r) => setTimeout(r, 50)); // give any (unwanted) activation a chance
      expect(clicked).toBe(false); // not Enter/Space → no synthesised el.click()
      expect(removed).toBe(false); // assist is non-removable → Delete/Backspace branch is never reachable
      expect(plain.isConnected).toBe(true); // chip untouched
    });
  },
};

export const FilterChips: Story = {
  render: (_args, { globals }) => html`
    <p style="margin: 0 0 12px; font-size: 14px; color: var(--md-sys-color-on-surface-variant);">Click to toggle selection:</p>
    <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
      <md-chip variant="filter">${t(globals.locale, 'chip.all')}</md-chip>
      <md-chip variant="filter" selected>Selected</md-chip>
      <md-chip variant="filter" icon="restaurant">${t(globals.locale, 'chip.restaurants')}</md-chip>
      <md-chip variant="filter" elevated>Elevated</md-chip>
      <md-chip variant="filter" elevated selected>Elevated Selected</md-chip>
      <md-chip variant="filter" disabled>Disabled</md-chip>
      <md-chip variant="filter" disabled selected>Disabled Selected</md-chip>
    </div>
  `,
  /** Toggle semantics: click flips selection, reflects aria-pressed, renders the
   *  checkmark, and emits mdSelect with the new state — disabled chips do neither. */
  play: async ({ canvasElement, step }) => {
    const chips = await hydratedChips(canvasElement, 'md-chip[variant="filter"]');
    const target = chips.find((c) => !c.hasAttribute('selected') && !c.hasAttribute('disabled'))!;

    await step('Click selects: aria-pressed flips, checkmark renders, mdSelect{selected:true} fires', async () => {
      expect(target.getAttribute('aria-pressed')).toBe('false'); // pre-state the component owns
      expect(target.hasAttribute('selected')).toBe(false);
      expect(checkmarkOf(target)).toBeNull();

      let detail: { selected: boolean } | undefined;
      target.addEventListener('mdSelect', (e) => { detail = (e as CustomEvent).detail; }, { once: true });
      target.click();

      // Reflected attrs land on the next render flush — assert inside waitFor.
      await waitFor(() => expect(target.getAttribute('aria-pressed')).toBe('true'));
      expect(target.hasAttribute('selected')).toBe(true);
      expect(target.classList.contains('md-chip--selected')).toBe(true);
      expect(checkmarkOf(target)).not.toBeNull(); // selection indicator actually painted
      expect(detail).toEqual({ selected: true }); // component emitted, not just mutated
    });

    await step('Second click deselects: aria-pressed reverts, checkmark gone, mdSelect{selected:false}', async () => {
      let detail: { selected: boolean } | undefined;
      target.addEventListener('mdSelect', (e) => { detail = (e as CustomEvent).detail; }, { once: true });
      target.click();

      await waitFor(() => expect(target.getAttribute('aria-pressed')).toBe('false'));
      expect(target.hasAttribute('selected')).toBe(false);
      expect(checkmarkOf(target)).toBeNull();
      expect(detail).toEqual({ selected: false });
    });

    await step('Guard: a disabled filter chip neither toggles nor emits', async () => {
      const disabled = chips.find((c) => c.hasAttribute('disabled') && !c.hasAttribute('selected'))!;
      expect(disabled.getAttribute('aria-pressed')).toBe('false');
      let fired = false;
      disabled.addEventListener('mdSelect', () => { fired = true; }, { once: true });
      disabled.click();
      await new Promise((r) => setTimeout(r, 50)); // give any (unwanted) flush a chance
      expect(fired).toBe(false);
      expect(disabled.getAttribute('aria-pressed')).toBe('false'); // unchanged
    });

    await step('Keyboard: Enter/Space route through handleKeyDown → el.click() → toggles + mdSelect', async () => {
      // `target` is deselected after the two clicks above — the component owns this pre-state.
      expect(target.getAttribute('aria-pressed')).toBe('false');

      let detail: { selected: boolean } | undefined;
      target.addEventListener('mdSelect', (e) => { detail = (e as CustomEvent).detail; }, { once: true });
      target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));

      await waitFor(() => expect(target.getAttribute('aria-pressed')).toBe('true'));
      expect(target.hasAttribute('selected')).toBe(true);
      expect(detail).toEqual({ selected: true }); // keydown reached handleClick, not just a no-op

      let detail2: { selected: boolean } | undefined;
      target.addEventListener('mdSelect', (e) => { detail2 = (e as CustomEvent).detail; }, { once: true });
      target.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));

      await waitFor(() => expect(target.getAttribute('aria-pressed')).toBe('false'));
      expect(detail2).toEqual({ selected: false }); // Space branch toggles back
    });

    await step('Keyboard guard: a disabled chip ignores Enter (handleKeyDown early return)', async () => {
      const disabledChip = chips.find((c) => c.hasAttribute('disabled') && !c.hasAttribute('selected'))!;
      const before = disabledChip.getAttribute('aria-pressed');
      let fired = false;
      disabledChip.addEventListener('mdSelect', () => { fired = true; }, { once: true });
      disabledChip.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
      await new Promise((r) => setTimeout(r, 50)); // give any (unwanted) flush a chance
      expect(fired).toBe(false);
      expect(disabledChip.getAttribute('aria-pressed')).toBe(before); // unchanged
    });
  },
};

export const InputChips: Story = {
  render: () => html`
    <p style="margin: 0 0 12px; font-size: 14px; color: var(--md-sys-color-on-surface-variant);">Click the X to remove, or click the chip body to toggle:</p>
    <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;" id="input-chips">
      <md-chip variant="input" icon="person">Jane Doe</md-chip>
      <md-chip variant="input" icon="person" selected>John Smith</md-chip>
      <md-chip variant="input">plain@email.com</md-chip>
      <md-chip variant="input" disabled icon="person">Disabled</md-chip>
    </div>
  `,
  play: async ({ canvasElement }) => {
    canvasElement.querySelectorAll('md-chip[variant="input"]').forEach((chip) => {
      chip.addEventListener('mdRemove', () => {
        chip.remove();
      });
    });
  },
};

export const SuggestionChips: Story = {
  render: (_args, { globals }) => html`
    <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
      <md-chip variant="suggestion">${t(globals.locale, 'chip.priceLowToHigh')}</md-chip>
      <md-chip variant="suggestion">${t(globals.locale, 'chip.priceHighToLow')}</md-chip>
      <md-chip variant="suggestion" elevated>Elevated</md-chip>
      <md-chip variant="suggestion" disabled>Disabled</md-chip>
    </div>
  `,
  /** Suggestion chips are non-selectable, non-removable: the host is a plain
   *  `button` that emits mdClick (never mdSelect) and exposes no aria-pressed. */
  play: async ({ canvasElement, step }) => {
    const chips = await hydratedChips(canvasElement, 'md-chip[variant="suggestion"]');
    const plain = chips.find((c) => !c.hasAttribute('disabled') && !c.hasAttribute('elevated'))!;
    const disabled = chips.find((c) => c.hasAttribute('disabled'))!;

    await step('Host is a plain button with no toggle state (non-selectable variant)', async () => {
      expect(plain.getAttribute('role')).toBe('button'); // interactive host, no ✕ to nest → button
      expect(plain.getAttribute('aria-pressed')).toBeNull(); // isSelectable=false → no pressed semantics
      expect(plain.getAttribute('tabindex')).toBe('0'); // focusable tab stop
    });

    await step('Click emits mdClick without toggling selection (isSelectable=false)', async () => {
      let clicked = false, selected = false;
      plain.addEventListener('mdClick', () => { clicked = true; }, { once: true });
      plain.addEventListener('mdSelect', () => { selected = true; }, { once: true });
      plain.click();

      await waitFor(() => expect(clicked).toBe(true)); // handleClick reached mdClick.emit()
      expect(selected).toBe(false); // suggestion skips the toggle branch
      expect(plain.hasAttribute('selected')).toBe(false);
    });

    await step('Enter routes handleKeyDown → el.click() → mdClick', async () => {
      let clicked = false;
      plain.addEventListener('mdClick', () => { clicked = true; }, { once: true });
      plain.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
      await waitFor(() => expect(clicked).toBe(true)); // keyboard activation reached mdClick
    });

    await step('A disabled suggestion chip is inert to clicks and out of the tab order', async () => {
      let clicked = false;
      disabled.addEventListener('mdClick', () => { clicked = true; }, { once: true });
      disabled.click();

      await new Promise((r) => setTimeout(r, 50)); // give any (unwanted) emit a chance
      expect(clicked).toBe(false); // handleClick isDisabled guard short-circuited before mdClick.emit()
      expect(disabled.getAttribute('aria-disabled')).toBe('true');
      expect(disabled.getAttribute('tabindex')).toBe('-1'); // hard-disabled leaves the tab order
    });
  },
};

export const States: Story = {
  render: () => html`
    <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
      <md-chip variant="filter">Enabled</md-chip>
      <md-chip variant="filter" selected>Selected</md-chip>
      <md-chip variant="filter" disabled>Disabled</md-chip>
      <md-chip variant="filter" disabled selected>Disabled Selected</md-chip>
      <md-chip variant="filter" soft-disabled>Soft-disabled</md-chip>
    </div>
  `,
};

export const WithIcons: Story = {
  render: (_args, { globals }) => html`
    <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
      <md-chip icon="search">${t(globals.locale, 'search')}</md-chip>
      <md-chip icon="add">${t(globals.locale, 'chip.add')}</md-chip>
      <md-chip variant="filter" icon="check_circle" selected>${t(globals.locale, 'chip.verified')}</md-chip>
      <md-chip variant="input" icon="person">${t(globals.locale, 'chip.contact')}</md-chip>
    </div>
  `,
};

export const SlottedIcons: Story = {
  render: () => html`
    <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
      <md-chip>
        <svg slot="leading-icon" viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
        SVG Icon
      </md-chip>
      <md-chip>
        <span slot="leading-icon">🚀</span>
        Emoji Icon
      </md-chip>
      <md-chip variant="filter" icon="check">
        Prop Icon
      </md-chip>
    </div>
  `,
};

export const Elevated: Story = {
  render: () => html`
    <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
      <md-chip elevated icon="event">Assist Elevated</md-chip>
      <md-chip variant="filter" elevated>Filter Elevated</md-chip>
      <md-chip variant="filter" elevated selected>Filter Elevated Selected</md-chip>
      <md-chip variant="suggestion" elevated>Suggestion Elevated</md-chip>
    </div>
  `,
};

export const RTL: Story = {
  render: () => html`
    <div dir="rtl" style="display: flex; gap: 8px; flex-wrap: wrap;">
      <md-chip variant="assist" icon="event">مساعدة</md-chip>
      <md-chip variant="filter" selected>فلتر</md-chip>
      <md-chip variant="input" icon="person">إدخال</md-chip>
      <md-chip variant="suggestion">اقتراح</md-chip>
    </div>
  `,
};

export const DarkTheme: Story = {
  render: () => html`
    <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
      <md-chip variant="assist" icon="event">Assist</md-chip>
      <md-chip variant="filter">Filter</md-chip>
      <md-chip variant="filter" selected>Selected</md-chip>
      <md-chip variant="input" icon="person">Input</md-chip>
      <md-chip variant="suggestion">Suggestion</md-chip>
      <md-chip elevated>Elevated</md-chip>
    </div>
  `,
  decorators: [
    (story) => html`
      <div data-theme="dark" style="background: var(--md-sys-color-surface); padding: 24px; border-radius: 16px;">
        ${story()}
      </div>
    `,
  ],
};

export const CustomCSS: Story = {
  render: () => html`
    <style>
      .brand-chip { --md-chip-container-color: #6200ee; --md-chip-label-color: white; --md-chip-icon-color: white; --md-chip-container-shape: 16px; }
      .danger-chip { --md-chip-outline-color: var(--md-sys-color-error); --md-chip-label-color: var(--md-sys-color-error); --md-chip-icon-color: var(--md-sys-color-error); }
      .rounded-chip { --md-chip-container-shape: 9999px; }
    </style>
    <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
      <md-chip class="brand-chip" icon="star">Brand</md-chip>
      <md-chip class="danger-chip" icon="warning">Danger</md-chip>
      <md-chip class="rounded-chip">Full Round</md-chip>
      <md-chip style="--md-chip-container-color: #c1440e; --md-chip-label-color: white;">Inline</md-chip>
    </div>
  `,
};

export const CSSParts: Story = {
  render: () => html`
    <style>
      .uppercase-label::part(label) { text-transform: uppercase; letter-spacing: 1.5px; }
      .dashed-outline::part(outline) { border-style: dashed; border-width: 2px; }
      .tinted-state::part(state-layer) { background-color: var(--md-sys-color-tertiary); }
    </style>
    <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
      <md-chip class="uppercase-label">Uppercase</md-chip>
      <md-chip class="dashed-outline">Dashed</md-chip>
      <md-chip class="tinted-state">Tinted State</md-chip>
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
          'Chips are inline-size-driven by their label — responsiveness means ' +
          'letting chip groups <code>flex-wrap</code> inside a constrained ' +
          'parent. Filter and suggestion rows reflow from a single column ' +
          'feel at 320px to multi-row grids at 768px+. No component-level ' +
          'breakpoint is needed; wrap the chips in a flex container with ' +
          '<code>gap: 8px</code> and <code>flex-wrap: wrap</code>.',
      },
    },
  },
  render: (_args, { globals }) => html`
    <style>
      .chip-resp-shell { display: flex; flex-direction: column; gap: 32px; max-width: 1100px; }
      .chip-resp-vp__label { font-size: 11px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase; color: var(--md-sys-color-on-surface-variant); margin-block-end: 6px; }
      .chip-resp-vp {
        border: 1px dashed var(--md-sys-color-outline-variant, #cac4d0);
        border-radius: 12px;
        padding: 16px;
        background: var(--md-sys-color-surface-container-lowest, #fffbfe);
        box-sizing: border-box;
        margin-block-end: 12px;
      }
      .chip-resp-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
      .chip-resp-live { resize: horizontal; overflow: auto; min-inline-size: 240px; max-inline-size: 100%; inline-size: 600px; }
    </style>

    <div class="chip-resp-shell">
      <section>
        <h3 style="margin: 0 0 4px;">Filter chips wrapping at four breakpoints</h3>
        <p style="margin: 0 0 16px; font-size: 14px; color: var(--md-sys-color-on-surface-variant);">
          Identical chip group — the parent width determines how many fit per row.
        </p>
        ${[
          { label: 'XS · 320 px (phone)', width: '320px' },
          { label: 'SM · 480 px (large phone)', width: '480px' },
          { label: 'MD · 768 px (tablet)', width: '768px' },
          { label: 'LG · 1024 px (desktop)', width: '1024px' },
        ].map(
          (vp) => html`
            <div>
              <div class="chip-resp-vp__label">${vp.label}</div>
              <div class="chip-resp-vp" style="inline-size: ${vp.width}; max-inline-size: 100%;">
                <div class="chip-resp-row">
                  <md-chip variant="filter" selected>${t(globals.locale, 'chip.all')}</md-chip>
                  <md-chip variant="filter">${t(globals.locale, 'chip.documents')}</md-chip>
                  <md-chip variant="filter">${t(globals.locale, 'chip.images')}</md-chip>
                  <md-chip variant="filter">${t(globals.locale, 'chip.videos')}</md-chip>
                  <md-chip variant="filter">${t(globals.locale, 'chip.audio')}</md-chip>
                  <md-chip variant="filter">${t(globals.locale, 'chip.archives')}</md-chip>
                  <md-chip variant="filter">${t(globals.locale, 'chip.spreadsheets')}</md-chip>
                  <md-chip variant="filter">${t(globals.locale, 'chip.presentations')}</md-chip>
                </div>
              </div>
            </div>
          `,
        )}
      </section>

      <section>
        <h3 style="margin: 0 0 4px;">Mixed variants in a toolbar</h3>
        <p style="margin: 0 0 16px; font-size: 14px; color: var(--md-sys-color-on-surface-variant);">
          Assist + input chips in a search/filter bar. Long labels wrap to new rows naturally.
        </p>
        <div class="chip-resp-vp" style="inline-size: 320px; max-inline-size: 100%;">
          <div class="chip-resp-row">
            <md-chip variant="assist" icon="event">${t(globals.locale, 'chip.addToCalendar')}</md-chip>
            <md-chip variant="input" icon="person" trailing-icon="close">jane@example.com</md-chip>
            <md-chip variant="suggestion">Material Design</md-chip>
            <md-chip variant="suggestion">Web components</md-chip>
            <md-chip variant="filter" icon="tune">${t(globals.locale, 'chip.filters')}</md-chip>
          </div>
        </div>
      </section>

      <section>
        <h3 style="margin: 0 0 4px;">Live resize playground</h3>
        <p style="margin: 0 0 16px; font-size: 14px; color: var(--md-sys-color-on-surface-variant);">
          Drag the bottom-right corner to see chips reflow.
        </p>
        <div class="chip-resp-vp chip-resp-live">
          <div class="chip-resp-row">
            <md-chip variant="filter" selected>${t(globals.locale, 'chip.all')}</md-chip>
            <md-chip variant="filter">${t(globals.locale, 'chip.documents')}</md-chip>
            <md-chip variant="filter">${t(globals.locale, 'chip.images')}</md-chip>
            <md-chip variant="filter">${t(globals.locale, 'chip.videos')}</md-chip>
            <md-chip variant="filter">${t(globals.locale, 'chip.audio')}</md-chip>
            <md-chip variant="filter">${t(globals.locale, 'chip.archives')}</md-chip>
            <md-chip variant="assist" icon="add">${t(globals.locale, 'chip.newTag')}</md-chip>
          </div>
        </div>
      </section>
    </div>
  `,
};

// ──────────────────────────────────────────────────────────────
// Removal behaviour (coverage) — the ✕ button + Delete/Backspace keys.
// Isolated in its own story so we fully control mdRemove listeners
// (InputChips attaches a blanket remover that would defeat preventDefault).
// ──────────────────────────────────────────────────────────────
export const RemovalInteractions: Story = {
  render: () => html`
    <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;" id="removal-chips">
      <md-chip variant="input" icon="person" id="rm-delete">Delete key</md-chip>
      <md-chip variant="input" icon="person" id="rm-backspace">Backspace key</md-chip>
      <md-chip variant="input" id="rm-click">Click the X</md-chip>
      <md-chip variant="input" id="rm-enter">Enter on X</md-chip>
      <md-chip variant="input" id="rm-space">Space on X</md-chip>
      <md-chip variant="filter" removable id="rm-keep">Keep mounted</md-chip>
    </div>
  `,
  play: async ({ canvasElement, step }) => {
    const chips = await hydratedChips(canvasElement, '#removal-chips md-chip');
    const byId = (id: string) => chips.find((c) => c.id === id)!;
    const removeBtnOf = (chip: ChipEl) => chip.shadowRoot!.querySelector('[part="remove"]') as HTMLButtonElement | null;

    await step('Delete on a removable chip emits mdRemove and self-removes (default action)', async () => {
      const chip = byId('rm-delete');
      expect(removeBtnOf(chip)).not.toBeNull(); // input variant renders the ✕ button
      let fired = false;
      chip.addEventListener('mdRemove', () => { fired = true; });
      chip.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, cancelable: true }));

      await waitFor(() => expect(chip.isConnected).toBe(false)); // el.remove() ran as the default action
      expect(fired).toBe(true); // handleKeyDown Delete branch → dispatchRemove
    });

    await step('Backspace also triggers removal (second key of the remove branch)', async () => {
      const chip = byId('rm-backspace');
      let fired = false;
      chip.addEventListener('mdRemove', () => { fired = true; });
      chip.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true }));

      await waitFor(() => expect(chip.isConnected).toBe(false));
      expect(fired).toBe(true);
    });

    await step('Clicking the ✕ removes the chip and stops propagation (no host mdClick)', async () => {
      const chip = byId('rm-click');
      const btn = removeBtnOf(chip)!;
      let removed = false, clicked = false;
      chip.addEventListener('mdRemove', () => { removed = true; });
      chip.addEventListener('mdClick', () => { clicked = true; });
      btn.click();

      await waitFor(() => expect(chip.isConnected).toBe(false));
      expect(removed).toBe(true); // handleRemoveClick → dispatchRemove
      expect(clicked).toBe(false); // e.stopPropagation() kept the body click from firing
    });

    await step('Enter on the ✕ button removes the chip (handleRemoveKeyDown)', async () => {
      const chip = byId('rm-enter');
      const btn = removeBtnOf(chip)!;
      let removed = false;
      chip.addEventListener('mdRemove', () => { removed = true; });
      btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));

      await waitFor(() => expect(chip.isConnected).toBe(false));
      expect(removed).toBe(true);
    });

    await step('Space on the ✕ button removes the chip', async () => {
      const chip = byId('rm-space');
      const btn = removeBtnOf(chip)!;
      let removed = false;
      chip.addEventListener('mdRemove', () => { removed = true; });
      btn.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));

      await waitFor(() => expect(chip.isConnected).toBe(false));
      expect(removed).toBe(true);
    });

    await step('preventDefault() on mdRemove keeps the chip mounted', async () => {
      const chip = byId('rm-keep');
      let fired = false;
      chip.addEventListener('mdRemove', (e) => { fired = true; e.preventDefault(); });
      chip.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, cancelable: true }));

      await waitFor(() => expect(fired).toBe(true)); // event still emitted
      await new Promise((r) => setTimeout(r, 50)); // give the (suppressed) default action a chance
      expect(chip.isConnected).toBe(true); // defaultPrevented → el.remove() was skipped
    });
  },
};

// ──────────────────────────────────────────────────────────────
// Slot-change reactions (coverage) — slotting an icon AFTER load fires the
// slotchange listener wired in componentDidLoad, flipping the has*Icon state.
// ──────────────────────────────────────────────────────────────
export const SlotChangeReactions: Story = {
  render: () => html`
    <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;" id="slotchange-chips">
      <md-chip variant="assist" id="slot-lead">Leading later</md-chip>
      <md-chip variant="assist" id="slot-trail">Trailing later</md-chip>
    </div>
  `,
  play: async ({ canvasElement, step }) => {
    const [lead, trail] = await hydratedChips(canvasElement, '#slotchange-chips md-chip');

    await step('Slotting a leading icon after load → hasSlottedLeadingIcon → with-leading-icon class', async () => {
      expect(lead.classList.contains('md-chip--with-leading-icon')).toBe(false); // nothing slotted yet
      const icon = document.createElement('span');
      icon.setAttribute('slot', 'leading-icon');
      icon.textContent = '🚀';
      lead.appendChild(icon);

      await waitFor(() => expect(lead.classList.contains('md-chip--with-leading-icon')).toBe(true));
    });

    await step('Slotting a trailing icon after load → hasSlottedTrailingIcon → with-trailing-icon class', async () => {
      expect(trail.classList.contains('md-chip--with-trailing-icon')).toBe(false);
      const icon = document.createElement('span');
      icon.setAttribute('slot', 'trailing-icon');
      icon.textContent = '⭐';
      trail.appendChild(icon);

      await waitFor(() => expect(trail.classList.contains('md-chip--with-trailing-icon')).toBe(true));
    });
  },
};

// ──────────────────────────────────────────────────────────────
// Non-selectable removable token (coverage) — a `selectable="false"` removable
// chip is md-multi-select's display token: isInteractiveHost=false, so the HOST
// is a labelled `group` (NOT a focusable button), NO `part="primary"` control is
// rendered, and a body-click emits mdClick WITHOUT toggling selection — only the
// ✕ acts. Exercises the isInteractiveHost / renderPrimary false branches.
// ──────────────────────────────────────────────────────────────
export const NonSelectableToken: Story = {
  render: () => html`
    <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;" id="token-chips">
      <md-chip variant="filter" removable selectable="false" id="tok-body">Body token</md-chip>
      <md-chip variant="filter" removable selectable="false" id="tok-remove">Remove token</md-chip>
    </div>
  `,
  play: async ({ canvasElement, step }) => {
    const chips = await hydratedChips(canvasElement, '#token-chips md-chip');
    const byId = (id: string) => chips.find((c) => c.id === id)!;

    await step('Host of a selectable="false" removable token is a labelled group, not a button', async () => {
      const chip = byId('tok-body');
      expect(chip.getAttribute('role')).toBe('group'); // isInteractiveHost=false → host is NOT a button
      expect(chip.getAttribute('aria-label')).toBe('Body token'); // group carries the accessible name
      expect(chip.getAttribute('aria-pressed')).toBeNull(); // no toggle semantics exposed
      expect(chip.getAttribute('tabindex')).toBeNull(); // host is not a tab stop; only the ✕ is
      expect(chip.shadowRoot!.querySelector('[part="primary"]')).toBeNull(); // renderPrimary=false → no primary control
      expect(chip.shadowRoot!.querySelector('[part="remove"]')).not.toBeNull(); // ✕ still rendered (removable)
    });

    await step('Body click emits mdClick but does NOT toggle selection (explicit isSelectable=false)', async () => {
      const chip = byId('tok-body');
      let clicked = false, selected = false;
      chip.addEventListener('mdClick', () => { clicked = true; }, { once: true });
      chip.addEventListener('mdSelect', () => { selected = true; }, { once: true });
      chip.click();

      await waitFor(() => expect(clicked).toBe(true)); // handleClick still reaches mdClick.emit()
      expect(selected).toBe(false); // selectable=false short-circuits the toggle branch (isSelectable getter)
      expect(chip.hasAttribute('selected')).toBe(false);
      expect(chip.classList.contains('md-chip--selected')).toBe(false); // no misleading "active" flash
    });

    await step('The ✕ still removes a non-selectable token (default action runs on a group host)', async () => {
      const chip = byId('tok-remove');
      const btn = chip.shadowRoot!.querySelector('[part="remove"]') as HTMLButtonElement;
      let removed = false;
      chip.addEventListener('mdRemove', () => { removed = true; });
      btn.click();

      await waitFor(() => expect(chip.isConnected).toBe(false)); // handleRemoveClick → dispatchRemove → el.remove()
      expect(removed).toBe(true);
    });
  },
};

// ──────────────────────────────────────────────────────────────
// removable="false" opt-out (coverage) — an input chip that opts out of the
// built-in ✕ (isRemovable=false). No remove <button>; a `trailing-icon` prop
// instead paints the plain `part="trailing-icon"` span (the showRemove=false
// else branch), and Delete no longer removes the chip.
// ──────────────────────────────────────────────────────────────
export const RemovableOptOut: Story = {
  render: () => html`
    <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;" id="optout-chips">
      <md-chip variant="input" removable="false" trailing-icon="expand_more" id="optout">Read-only tag</md-chip>
    </div>
  `,
  play: async ({ canvasElement, step }) => {
    const [chip] = await hydratedChips(canvasElement, '#optout-chips md-chip');

    await step('removable="false" input chip renders NO ✕ but shows the trailing-icon span', async () => {
      expect(chip.shadowRoot!.querySelector('[part="remove"]')).toBeNull(); // isRemovable=false → no remove button
      const trailing = chip.shadowRoot!.querySelector('[part="trailing-icon"]'); // showRemove=false else branch
      expect(trailing).not.toBeNull();
      expect(trailing!.textContent?.trim()).toBe('expand_more'); // paints the trailingIcon glyph
      expect(chip.classList.contains('md-chip--with-trailing-icon')).toBe(true);
      expect(chip.getAttribute('role')).toBe('button'); // body stays interactive (hostIsButton, no ✕ to nest)
    });

    await step('Delete does nothing on a non-removable chip (handleKeyDown remove branch skipped)', async () => {
      let fired = false;
      chip.addEventListener('mdRemove', () => { fired = true; }, { once: true });
      chip.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, cancelable: true }));

      await new Promise((r) => setTimeout(r, 50)); // give any (unwanted) removal a chance to run
      expect(fired).toBe(false); // isRemovable=false → the Delete/Backspace branch is never entered
      expect(chip.isConnected).toBe(true); // chip stays mounted
    });
  },
};

// ──────────────────────────────────────────────────────────────
// Soft-disabled (coverage) — softDisabled feeds isDisabled (the OR term), so the
// chip is inert to clicks; yet, unlike a hard-disabled chip, it stays in the tab
// order (tabindex="0", not "-1"). Contrasts the two disabled sources.
// ──────────────────────────────────────────────────────────────
export const SoftDisabledInteractions: Story = {
  render: () => html`
    <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;" id="softdis-chips">
      <md-chip variant="filter" soft-disabled id="soft">Soft-disabled</md-chip>
      <md-chip variant="filter" disabled id="hard">Hard-disabled</md-chip>
    </div>
  `,
  play: async ({ canvasElement, step }) => {
    const chips = await hydratedChips(canvasElement, '#softdis-chips md-chip');
    const soft = chips.find((c) => c.id === 'soft')!;
    const hard = chips.find((c) => c.id === 'hard')!;

    await step('Soft-disabled stays focusable (tabindex="0") while hard-disabled leaves the tab order (-1)', async () => {
      expect(soft.getAttribute('aria-disabled')).toBe('true'); // isEffectivelyDisabled via the softDisabled term
      expect(soft.classList.contains('md-chip--disabled')).toBe(true); // disabled visuals applied
      expect(soft.getAttribute('tabindex')).toBe('0'); // disabled=false → still a tab stop (focusable)
      expect(hard.getAttribute('aria-disabled')).toBe('true');
      expect(hard.getAttribute('tabindex')).toBe('-1'); // hard-disabled drops out of the tab order
    });

    await step('Clicking a soft-disabled chip is inert (isDisabled OR-term short-circuits handleClick)', async () => {
      let clicked = false, selected = false;
      soft.addEventListener('mdClick', () => { clicked = true; }, { once: true });
      soft.addEventListener('mdSelect', () => { selected = true; }, { once: true });
      soft.click();

      await new Promise((r) => setTimeout(r, 50)); // give any (unwanted) flush a chance
      expect(clicked).toBe(false); // handleClick early-returned before mdClick.emit()
      expect(selected).toBe(false); // ...and before the selection-toggle branch
      expect(soft.getAttribute('aria-pressed')).toBe('false'); // selection state left untouched
    });
  },
};

// ──────────────────────────────────────────────────────────────
// Disabled remove ✕ guards (coverage) — a hard-disabled removable chip still
// renders the ✕ <button> (isRemovable=true), but it is natively `disabled` and
// out of the tab order, and every removal path is inert: handleRemoveClick and
// handleRemoveKeyDown both isDisabled-early-return, and the host handleKeyDown
// Delete branch is gated by the same isDisabled guard.
// ──────────────────────────────────────────────────────────────
export const DisabledRemoveGuard: Story = {
  render: () => html`
    <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;" id="disrm-chips">
      <md-chip variant="input" removable disabled icon="person" id="disrm">Disabled removable</md-chip>
    </div>
  `,
  play: async ({ canvasElement, step }) => {
    const [chip] = await hydratedChips(canvasElement, '#disrm-chips md-chip');
    const btn = chip.shadowRoot!.querySelector('[part="remove"]') as HTMLButtonElement;

    await step('A hard-disabled removable chip still renders the ✕, disabled and out of the tab order', async () => {
      expect(btn).not.toBeNull(); // isRemovable=true → ✕ rendered even when disabled
      expect(btn.disabled).toBe(true); // isEffectivelyDisabled → native disabled button
      expect(btn.getAttribute('tabindex')).toBe('-1'); // hard-disabled drops the ✕ from the tab order
    });

    await step('Clicking the disabled ✕ does NOT remove (handleRemoveClick isDisabled guard)', async () => {
      let removed = false;
      chip.addEventListener('mdRemove', () => { removed = true; }, { once: true });
      btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

      await new Promise((r) => setTimeout(r, 50)); // give any (unwanted) removal a chance
      expect(removed).toBe(false); // handleRemoveClick early-returned on isDisabled
      expect(chip.isConnected).toBe(true); // chip stays mounted
    });

    await step('Enter/Space on the disabled ✕ is inert (handleRemoveKeyDown isDisabled guard)', async () => {
      let removed = false;
      chip.addEventListener('mdRemove', () => { removed = true; });
      btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
      btn.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));

      await new Promise((r) => setTimeout(r, 50));
      expect(removed).toBe(false); // handleRemoveKeyDown returned before dispatchRemove
      expect(chip.isConnected).toBe(true);
    });

    await step('Delete on the disabled chip body is inert (handleKeyDown isDisabled early return)', async () => {
      let removed = false;
      chip.addEventListener('mdRemove', () => { removed = true; }, { once: true });
      chip.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, cancelable: true }));

      await new Promise((r) => setTimeout(r, 50));
      expect(removed).toBe(false); // handleKeyDown isDisabled → return before the Delete/Backspace branch
      expect(chip.isConnected).toBe(true);
    });
  },
};
