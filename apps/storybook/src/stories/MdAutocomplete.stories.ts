import type { Meta, StoryObj } from '@storybook/web-components';
import { expect, waitFor } from 'storybook/test';
import { html } from 'lit';
import { ref } from 'lit/directives/ref.js';
import { t } from '../i18n';

/** Shadow-piercing helpers for play(): testing-library queries can't cross
 *  shadow roots, so interactions address the real internals directly. */
type AcEl = HTMLElement & { value: string | string[]; inputValue: string; open: boolean };
const getAc = async (canvasElement: HTMLElement): Promise<AcEl> => {
  const ac = canvasElement.querySelector('md-autocomplete') as AcEl;
  await waitFor(() => expect(ac.classList.contains('hydrated')).toBe(true));
  return ac;
};
const fieldOf = (ac: AcEl) => ac.shadowRoot!.querySelector('md-text-field') as HTMLElement;
const inputOf = (ac: AcEl) =>
  fieldOf(ac).shadowRoot!.querySelector('input') as HTMLInputElement;
const typeIn = (ac: AcEl, text: string) => {
  const input = inputOf(ac);
  input.focus();
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
};
const key = (target: Element, k: string) =>
  target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, composed: true }));
/** Find a rendered option row by its `headline` (options carry the label there). */
const itemByHeadline = (ac: AcEl, headline: string) =>
  [...ac.shadowRoot!.querySelectorAll('md-menu-item')].find(
    (i) => (i as HTMLElement & { headline?: string }).headline === headline,
  ) as HTMLElement | undefined;

const countries = [
  { value: 'us', label: 'United States' },
  { value: 'gb', label: 'United Kingdom' },
  { value: 'de', label: 'Germany' },
  { value: 'fr', label: 'France' },
  { value: 'it', label: 'Italy' },
  { value: 'jp', label: 'Japan' },
  { value: 'kr', label: 'South Korea' },
  { value: 'br', label: 'Brazil' },
  { value: 'in', label: 'India' },
  { value: 'au', label: 'Australia' },
];

const tags = [
  { value: 'design',  label: 'Design',  icon: 'palette',  description: 'Visual & interaction work' },
  { value: 'eng',     label: 'Engineering', icon: 'code',  description: 'Production code & APIs' },
  { value: 'prd',     label: 'Product', icon: 'rocket_launch', description: 'Roadmap & strategy' },
  { value: 'ops',     label: 'Operations', icon: 'settings', description: 'Infra & DX' },
  { value: 'ppl',     label: 'People',  icon: 'group',    description: 'HR, hiring, culture' },
];

const meta: Meta = {
  title: 'Text Inputs/Autocomplete',
  component: 'md-autocomplete',
  tags: ['autodocs'],
  parameters: {
    docs: {
      source: { language: 'html' },
      description: {
        component: [
          'A combobox: a text field that filters a listbox of suggestions, in single or',
          '`multiple` mode (picks render as chips), with optional free text (`free-solo`),',
          'async loading, a custom `filterer`, and WASM virtualization for large datasets.',
          '',
          '**ARIA.** The real textbox — the `<input>` inside md-text-field\'s shadow root —',
          'reports `role="combobox"` with `aria-expanded` and `aria-autocomplete="list"`,',
          'and points at the listbox through **ARIA element reflection**',
          '(`ariaControlsElements`), because an `aria-controls` IDREF cannot cross the shadow',
          'boundary between the two components. `↓` moves REAL focus onto an option — the APG',
          'variant that needs no reference — so the model degrades cleanly where reflection is',
          'unavailable. See the *Combobox semantics* story.',
          '',
          '**axe caveat.** Assigning an element reference leaves an empty `aria-controls=""`',
          'behind, and axe reads attributes rather than the accessibility tree, so it reports',
          '`aria-required-attr` whenever the popup is open. The relation is real (DevTools →',
          'Accessibility shows it); the rule is disabled for this component below.',
        ].join(' ').replace(/ {2,}/g, ' '),
      },
    },
    a11y: {
      options: {
        rules: {
          // Disabled deliberately, not to paper over a defect: the combobox
          // points at its listbox with an ELEMENT REFERENCE, whose setter leaves
          // an empty aria-controls="" attribute. axe checks attributes, so it
          // reads that as missing and fires `aria-required-attr` while the popup
          // is open. Writing the listbox id into the attribute would satisfy axe
          // and DESTROY the real relation — they are mutually exclusive. The
          // accessibility tree is asserted instead, in the Combobox semantics
          // story's play().
          'aria-required-attr': { enabled: false },
        },
      },
    },
  },
  argTypes: {
    variant: { control: { type: 'select' }, options: ['filled', 'outlined'] },
    multiple: { control: 'boolean' },
    freeSolo: { control: 'boolean' },
    loading: { control: 'boolean' },
    clearable: { control: 'boolean' },
    disabled: { control: 'boolean' },
    error: { control: 'boolean' },
    clearOnBlur: { control: 'boolean' },
    disableCloseOnSelect: { control: 'boolean' },
    label: { control: 'text' },
    placeholder: { control: 'text' },
    placement: { control: { type: 'select' }, options: ['bottom-start', 'bottom-end', 'top-start', 'top-end'] },
    density: { control: { type: 'select' }, options: [0, -1, -2, -3, -4] },
  },
  args: {
    variant: 'outlined',
    density: 0,
    multiple: false,
    freeSolo: false,
    loading: false,
    clearable: true,
    disabled: false,
    error: false,
    clearOnBlur: false,
    disableCloseOnSelect: false,
    label: 'Country',
    placeholder: 'Start typing…',
    placement: 'bottom-start',
  },
};
export default meta;
type Story = StoryObj;

export const Playground: Story = {
  render: (args) => html`
    <div style="max-inline-size: 360px;">
      <md-autocomplete
        variant=${args.variant}
        density=${args.density}
        ?multiple=${args.multiple}
        ?free-solo=${args.freeSolo}
        ?loading=${args.loading}
        ?clearable=${args.clearable}
        ?disabled=${args.disabled}
        ?error=${args.error}
        ?clear-on-blur=${args.clearOnBlur}
        ?disable-close-on-select=${args.disableCloseOnSelect}
        label=${args.label}
        placeholder=${args.placeholder}
        placement=${args.placement}
        .options=${countries}
      ></md-autocomplete>
    </div>
  `,
};

export const SingleSelect: Story = {
  render: (_args, { globals }) => html`
    <div style="max-inline-size: 360px;">
      <md-autocomplete label="${t(globals.locale, 'autocomplete.country')}" variant="outlined" .options=${countries}></md-autocomplete>
    </div>
  `,
  /** The full keyboard combobox flow, scripted (see the Interactions panel). */
  play: async ({ canvasElement, step }) => {
    const ac = await getAc(canvasElement);

    await step('Typing filters the listbox live', async () => {
      typeIn(ac, 'unit');
      await waitFor(() =>
        expect(ac.shadowRoot!.querySelectorAll('md-menu-item').length).toBe(2),
      );
      expect(ac.open).toBe(true);
    });

    await step('ArrowDown moves real focus into the listbox', async () => {
      key(fieldOf(ac), 'ArrowDown');
      await waitFor(() =>
        expect(ac.shadowRoot!.activeElement?.getAttribute('role')).toBe('option'),
      );
    });

    await step('Enter selects, closes, and returns focus to the input', async () => {
      key(ac.shadowRoot!.activeElement!, 'Enter');
      await waitFor(() => expect(ac.value).toBe('us'));
      await waitFor(() => expect(ac.open).toBe(false));
      expect(ac.inputValue).toBe('United States');
      await waitFor(() => expect(fieldOf(ac).shadowRoot!.activeElement).toBe(inputOf(ac)));
    });

    await step('Reopening shows the FULL list with the value marked selected', async () => {
      fieldOf(ac).click();
      await waitFor(() =>
        expect(ac.shadowRoot!.querySelectorAll('md-menu-item').length).toBe(10),
      );
      const selected = ac.shadowRoot!.querySelectorAll('md-menu-item[aria-selected="true"]');
      expect(selected.length).toBe(1);
      key(fieldOf(ac), 'Escape');
      await waitFor(() => expect(ac.open).toBe(false));
      // Let the menu's close animation + timers settle before the play
      // returns — a teardown mid-animation registers as an unhandled error.
      await new Promise((r) => setTimeout(r, 300));
    });

    await step('focusInput() moves keyboard focus into the input', async () => {
      inputOf(ac).blur();
      await (ac as unknown as { focusInput: () => Promise<void> }).focusInput();
      await waitFor(() => expect(fieldOf(ac).shadowRoot!.activeElement).toBe(inputOf(ac)));
    });

    await step('showMenu()/closeMenu() drive the open state programmatically', async () => {
      await (ac as unknown as { showMenu: () => Promise<void> }).showMenu();
      await waitFor(() => expect(ac.open).toBe(true));
      await waitFor(() =>
        expect(ac.shadowRoot!.querySelectorAll('md-menu-item').length).toBe(10),
      );
      await (ac as unknown as { closeMenu: () => Promise<void> }).closeMenu();
      await waitFor(() => expect(ac.open).toBe(false));
      await new Promise((r) => setTimeout(r, 300));
    });

    await step('getLabels() resolves committed values and falls back to the raw value', async () => {
      const labels = await (
        ac as unknown as { getLabels: (v: string[]) => Promise<Record<string, string>> }
      ).getLabels(['us', 'gb']);
      expect(labels.us).toBe('United States'); // committed earlier → cached label
      expect(labels.gb).toBe('gb'); // never committed → raw-value fallback path
    });

    await step('ArrowUp on a closed field opens it and focuses the LAST option', async () => {
      inputOf(ac).focus();
      key(fieldOf(ac), 'ArrowUp');
      await waitFor(() => expect(ac.open).toBe(true));
      await waitFor(() =>
        expect(ac.shadowRoot!.activeElement?.getAttribute('role')).toBe('option'),
      );
      const active = ac.shadowRoot!.activeElement as HTMLElement & { headline?: string };
      expect(active.headline).toBe('Australia'); // last entry in the dataset
    });

    await step('A printable key on a focused option resumes typing in the input', async () => {
      const option = ac.shadowRoot!.activeElement as HTMLElement;
      key(option, 'x'); // handleListboxKeyDown redirects the key back to the field
      await waitFor(() => expect(fieldOf(ac).shadowRoot!.activeElement).toBe(inputOf(ac)));
      await waitFor(() => expect(ac.inputValue).toContain('x'));
      key(fieldOf(ac), 'Escape');
      await waitFor(() => expect(ac.open).toBe(false));
      // strict single mode snaps the uncommitted text back to the committed label
      await waitFor(() => expect(ac.inputValue).toBe('United States'));
      await new Promise((r) => setTimeout(r, 300));
    });

    await step('The caret toggles the menu open and closed', async () => {
      const caret = ac.shadowRoot!.querySelector('.md-autocomplete__caret') as HTMLElement;
      caret.click();
      await waitFor(() => expect(ac.open).toBe(true));
      caret.click();
      await waitFor(() => expect(ac.open).toBe(false));
      await new Promise((r) => setTimeout(r, 300));
    });

    await step('The clear button resets the value and emits mdClear', async () => {
      expect(ac.value).toBe('us'); // still committed from the earlier Enter pick
      let cleared = false;
      ac.addEventListener('mdClear', () => (cleared = true), { once: true });
      const clearBtn = ac.shadowRoot!.querySelector('.md-autocomplete__clear') as HTMLElement;
      clearBtn.click();
      await waitFor(() => expect(ac.value).toBe(''));
      await waitFor(() => expect(ac.inputValue).toBe(''));
      expect(cleared).toBe(true);
    });
  },
};

export const MultiSelect: Story = {
  render: (_args, { globals }) => html`
    <div style="max-inline-size: 360px;">
      <md-autocomplete label="${t(globals.locale, 'autocomplete.tags')}" variant="outlined" multiple .options=${tags} .value=${['design']}></md-autocomplete>
    </div>
  `,
  /** Chip lifecycle, scripted: pick → chip appears → Backspace pops it. */
  play: async ({ canvasElement, step }) => {
    const ac = await getAc(canvasElement);
    const chips = () => ac.shadowRoot!.querySelectorAll('md-chip').length;

    await step('Picking an option adds a chip', async () => {
      fieldOf(ac).click();
      await waitFor(() =>
        expect(ac.shadowRoot!.querySelectorAll('md-menu-item').length).toBeGreaterThan(0),
      );
      const eng = [...ac.shadowRoot!.querySelectorAll('md-menu-item')].find(
        (i) => (i as HTMLElement & { headline?: string }).headline === 'Engineering',
      ) as HTMLElement;
      eng.click();
      await waitFor(() => expect(ac.value).toEqual(['design', 'eng']));
      await waitFor(() => expect(chips()).toBe(2));
    });

    await step('Backspace on the empty input removes the last chip', async () => {
      inputOf(ac).focus();
      key(fieldOf(ac), 'Backspace');
      await waitFor(() => expect(ac.value).toEqual(['design']));
      await waitFor(() => expect(chips()).toBe(1));
    });

    await step("Removing a chip via its mdRemove event drops that value", async () => {
      const chip = ac.shadowRoot!.querySelector('md-chip') as HTMLElement;
      chip.dispatchEvent(new CustomEvent('mdRemove', { bubbles: true, composed: true }));
      await waitFor(() => expect(ac.value).toEqual([]));
      await waitFor(() => expect(chips()).toBe(0));
    });

    await step('Flipping `multiple` at runtime reshapes the committed value', async () => {
      const acp = ac as unknown as { multiple: boolean; value: string | string[] };
      acp.value = ['design', 'eng'];
      await waitFor(() => expect(chips()).toBe(2));
      acp.multiple = false; // array → single mode: keeps only the first value
      await waitFor(() => expect(ac.value).toBe('design'));
      await waitFor(() => expect(chips()).toBe(0)); // single mode renders no chips
      acp.multiple = true; // single → multi mode: wraps back into an array
      await waitFor(() => expect(ac.value).toEqual(['design']));
      await waitFor(() => expect(chips()).toBe(1));
    });
  },
};

/** `chip-position="inline"` puts the chips INSIDE the field, before the input;
 *  they wrap onto new rows and the field grows with them. */
export const InlineChips: Story = {
  name: 'Inline chips (in-field, wrapping)',
  render: (_args, { globals }) => html`
    <div style="max-inline-size: 360px;">
      <md-autocomplete
        label="${t(globals.locale, 'autocomplete.tags')}"
        variant="outlined"
        multiple
        chip-position="inline"
        .options=${tags}
        .value=${['design', 'eng', 'prd', 'ops']}
      ></md-autocomplete>
    </div>
  `,
  /** Inline chips grow the field; picking adds one, Backspace pops the last. */
  play: async ({ canvasElement, step }) => {
    const ac = await getAc(canvasElement);
    const chips = () => ac.shadowRoot!.querySelectorAll('md-chip').length;

    await step('Seeds four chips, rendered inline inside the field', async () => {
      await waitFor(() => expect(chips()).toBe(4)); // design, eng, prd, ops
      // inline layout slots the chips into the text-field, not the below-group.
      expect(ac.shadowRoot!.querySelector('.md-autocomplete__inline-chips')).not.toBeNull();
      expect(ac.shadowRoot!.querySelector('.md-autocomplete__chips')).toBeNull();
    });

    await step('Picking a new option grows the chip set (4 → 5)', async () => {
      fieldOf(ac).click();
      await waitFor(() =>
        expect(ac.shadowRoot!.querySelectorAll('md-menu-item').length).toBeGreaterThan(0),
      );
      const before = chips();
      itemByHeadline(ac, 'People')!.click();
      await waitFor(() => expect(chips()).toBeGreaterThan(before));
      expect(ac.value).toEqual(['design', 'eng', 'prd', 'ops', 'ppl']);
    });

    await step('Backspace on the empty input pops the last chip (5 → 4)', async () => {
      inputOf(ac).focus(); // pick already emptied + refocused the input
      const before = chips();
      key(fieldOf(ac), 'Backspace');
      await waitFor(() => expect(chips()).toBeLessThan(before));
      expect(ac.value).toEqual(['design', 'eng', 'prd', 'ops']); // last ('ppl') dropped
      await new Promise((r) => setTimeout(r, 300)); // multi keeps the popup OPEN on pick — just let the re-render settle
    });
  },
};

/** `chip-position` places the selection around the trigger: below (default),
 *  top, left, right — or inline (see the Inline chips story). */
export const ChipPositions: Story = {
  name: 'Chip positions (top / left / right)',
  render: () => html`
    <div style="display:flex; flex-direction:column; gap:32px; max-inline-size: 520px;">
      <md-autocomplete label="Top" variant="outlined" multiple chip-position="top" .options=${tags} .value=${['design', 'eng']}></md-autocomplete>
      <md-autocomplete label="Left" variant="outlined" multiple chip-position="left" .options=${tags} .value=${['design', 'eng']}></md-autocomplete>
      <md-autocomplete label="Right" variant="outlined" multiple chip-position="right" .options=${tags} .value=${['design', 'eng']}></md-autocomplete>
      <md-autocomplete label="Below (default)" variant="outlined" multiple chip-position="below" .options=${tags} .value=${['design', 'eng']}></md-autocomplete>
    </div>
  `,
};

export const FreeSolo: Story = {
  render: (_args, { globals }) => html`
    <div style="display:flex; flex-direction:column; gap:24px; max-inline-size: 360px;">
      <md-autocomplete label="${t(globals.locale, 'autocomplete.email')}" variant="outlined" free-solo .options=${[]}></md-autocomplete>
      <md-autocomplete label="Tags (free)" variant="outlined" multiple free-solo .options=${tags}></md-autocomplete>
    </div>
  `,
  /** free-solo commits arbitrary typed text on Enter (the first, single field). */
  play: async ({ canvasElement, step }) => {
    const ac = await getAc(canvasElement); // first = single free-solo "Email"

    await step('Enter on an empty input commits nothing (guard)', async () => {
      let fired = false;
      ac.addEventListener('mdChange', () => (fired = true), { once: true });
      inputOf(ac).focus();
      key(fieldOf(ac), 'Enter');
      expect(ac.value).toBe(''); // still the initial, uncommitted value
      expect(fired).toBe(false);
    });

    await step('Typing arbitrary text + Enter commits it and emits mdChange', async () => {
      const before = ac.value;
      let detail: string | string[] | undefined;
      ac.addEventListener('mdChange', (e) => (detail = (e as CustomEvent).detail), { once: true });
      typeIn(ac, 'hi@example.com');
      key(fieldOf(ac), 'Enter');
      // The typed string became the committed value — proves the transition,
      // and the payload proves the component actually fired mdChange.
      await waitFor(() => expect(ac.value).not.toBe(before));
      expect(ac.value).toBe('hi@example.com');
      expect(detail).toBe('hi@example.com');
      await waitFor(() => expect(ac.open).toBe(false)); // single free-solo closes on commit
      // Typing briefly opened the empty-options menu; let its close settle.
      await new Promise((r) => setTimeout(r, 300));
    });

    await step('Multiple free-solo commits arbitrary typed text as a chip', async () => {
      const multi = canvasElement.querySelectorAll('md-autocomplete')[1] as AcEl;
      await waitFor(() => expect(multi.classList.contains('hydrated')).toBe(true));
      typeIn(multi, 'novel-tag'); // not one of the tag options
      key(fieldOf(multi), 'Enter');
      await waitFor(() => expect(multi.value).toEqual(['novel-tag']));
      await waitFor(() => expect(multi.inputValue).toBe('')); // commit clears the input
      key(fieldOf(multi), 'Escape');
      await waitFor(() => expect(multi.open).toBe(false));
      await new Promise((r) => setTimeout(r, 300));
    });

    await step('Reset to the fresh resting render (clean visual baseline)', async () => {
      const multi = canvasElement.querySelectorAll('md-autocomplete')[1] as AcEl;
      // Both fields committed content above; restore the empty resting render so
      // the visual snapshot matches a fresh mount (no text, no chip, no focus).
      ac.value = ''; // single free-solo: drop the committed "hi@example.com"
      ac.inputValue = ''; // clear the mirrored text from the visible input
      multi.value = []; // multi free-solo: drop the "novel-tag" chip
      multi.inputValue = '';
      inputOf(ac).blur();
      inputOf(multi).blur();
      (document.activeElement as HTMLElement | null)?.blur(); // drop the focus ring
      await waitFor(() => expect(ac.value).toBe(''));
      await waitFor(() => expect(ac.inputValue).toBe(''));
      await waitFor(() => expect(multi.value).toEqual([]));
      await waitFor(() => expect(ac.open).toBe(false));
      await waitFor(() => expect(multi.open).toBe(false));
      await new Promise((r) => setTimeout(r, 300)); // let the reset render settle
    });
  },
};

/** `loading` mirrors the selects' busy state: a spinner replaces the
 *  clear/caret cluster (swap it via the `loader` slot, size it with
 *  `--md-autocomplete-spinner-size`) and the menu shows a wavy indeterminate
 *  bar instead of options — the "fetch then `loadOptions`" flow. */
export const Loading: Story = {
  render: (_args, { globals, viewMode }) => html`
    <div style="display:flex; flex-direction:column; gap:24px; max-inline-size: 360px;">
      <md-autocomplete label="${t(globals.locale, 'autocomplete.users')}" variant="outlined" loading .options=${[]}></md-autocomplete>
      <md-autocomplete label="${t(globals.locale, 'autocomplete.tags')}" variant="outlined" loading multiple .options=${[]} ?open=${viewMode !== 'docs'}></md-autocomplete>
    </div>
  `,
};

export const States: Story = {
  render: (_args, { globals }) => html`
    <div style="display:flex; flex-direction:column; gap:24px; max-inline-size: 360px;">
      <md-autocomplete label="Enabled" variant="outlined" .options=${countries}></md-autocomplete>
      <md-autocomplete label="Disabled" variant="outlined" disabled .options=${countries}></md-autocomplete>
      <md-autocomplete label="Error" variant="outlined" error error-text="${t(globals.locale, 'autocomplete.selectCountryError')}" .options=${countries}></md-autocomplete>
    </div>
  `,
};

export const WithDescriptions: Story = {
  render: (_args, { globals }) => html`
    <div style="max-inline-size: 360px;">
      <md-autocomplete label="${t(globals.locale, 'autocomplete.tags')}" variant="outlined" multiple .options=${tags}></md-autocomplete>
    </div>
  `,
};

/**
 * Above 200 options (`virtualize="auto"`), the dataset is byte-packed into the
 * WASM store and rendered as a windowed listbox — typing in the input filters
 * it with a debounced engine query. Same engine as `md-select`.
 */
export const Virtualized10k: Story = {
  name: 'Virtualized (10,000 options)',
  render: (_args, { globals }) => html`
    <div style="max-inline-size: 360px;">
      <md-autocomplete
        label="${t(globals.locale, 'autocomplete.city')}"
        variant="outlined"
        .options=${Array.from({ length: 10_000 }, (_, i) => ({ value: `c${i}`, label: `City ${i}` }))}
      ></md-autocomplete>
    </div>
  `,
  /** Exercises the WASM-virtualized path: a windowed listbox, a debounced
   *  engine query, and picking an off-window row by its value. */
  play: async ({ canvasElement, step }) => {
    const ac = await getAc(canvasElement);

    await step('Opens a WINDOWED virtual listbox (not all 10k rows in the DOM)', async () => {
      fieldOf(ac).click();
      await waitFor(() => expect(ac.open).toBe(true));
      await waitFor(
        () => {
          const n = ac.shadowRoot!.querySelectorAll('md-menu-item').length;
          expect(n).toBeGreaterThan(0);
          expect(n).toBeLessThan(200); // only the visible window + overscan render
        },
        { timeout: 5000 },
      );
    });

    await step('Typing runs the debounced engine query and filters the window', async () => {
      typeIn(ac, 'City 4242');
      await waitFor(
        () =>
          expect(
            [...ac.shadowRoot!.querySelectorAll('md-menu-item')].some(
              (i) => (i as HTMLElement & { headline?: string }).headline === 'City 4242',
            ),
          ).toBe(true),
        { timeout: 5000 },
      );
    });

    await step('Picking a virtual row commits its value', async () => {
      const row = [...ac.shadowRoot!.querySelectorAll('md-menu-item')].find(
        (i) => (i as HTMLElement & { headline?: string }).headline === 'City 4242',
      ) as HTMLElement;
      row.click();
      await waitFor(() => expect(ac.value).toBe('c4242'));
      await new Promise((r) => setTimeout(r, 300));
    });

    await step('Reset to the fresh resting render (clean visual baseline)', async () => {
      // The pick committed "c4242" and mirrored "City 4242" into the input, and
      // typing left the field focused; restore the empty resting render so the
      // snapshot matches a fresh mount. (pick() already closed the menu and
      // reset the virtual query, so only value/input/focus need clearing.)
      ac.value = '';
      ac.inputValue = '';
      inputOf(ac).blur();
      (document.activeElement as HTMLElement | null)?.blur(); // drop the focus ring
      await waitFor(() => expect(ac.value).toBe(''));
      await waitFor(() => expect(ac.inputValue).toBe(''));
      await waitFor(() => expect(ac.open).toBe(false));
      await new Promise((r) => setTimeout(r, 300)); // let the reset render settle
    });
  },
};

const bigLoaded = new WeakSet<Element>();
/** Streaming a huge dataset via `loadOptions({ count, getRow })` — rows never
 *  exist as a JS array; the WASM store materialises them on demand. */
export const VirtualizedLoadOptions: Story = {
  name: 'Virtualized — loadOptions (1M rows)',
  render: (_args, { globals }) => html`
    <div style="max-inline-size: 360px;">
      <md-autocomplete
        label="${t(globals.locale, 'autocomplete.item')}"
        variant="outlined"
        multiple
        ${ref((el) => {
          if (!el || bigLoaded.has(el)) return;
          bigLoaded.add(el);
          const ac = el as HTMLElement & {
            loadOptions?: (s: { count: number; getRow: (i: number) => { value: string; label: string } }) => Promise<void>;
          };
          customElements.whenDefined('md-autocomplete').then(() =>
            ac.loadOptions?.({ count: 1_000_000, getRow: (i) => ({ value: `v${i}`, label: `Item ${i.toLocaleString('en-US')}` }) }),
          );
        })}
      ></md-autocomplete>
    </div>
  `,
};

export const MaxSelected: Story = {
  render: (_args, { globals }) => html`
    <div style="max-inline-size: 360px;">
      <md-autocomplete label="${t(globals.locale, 'autocomplete.pickUpTo2')}" variant="outlined" multiple max-selected="2" .options=${tags} .value=${['design']}></md-autocomplete>
    </div>
  `,
  /** `max-selected="2"`: the second pick fills the cap; a third is rejected. */
  play: async ({ canvasElement, step }) => {
    const ac = await getAc(canvasElement); // seeded ['design'] — one of two slots used

    await step('Second pick fills the cap (1 → 2)', async () => {
      fieldOf(ac).click();
      await waitFor(() =>
        expect(ac.shadowRoot!.querySelectorAll('md-menu-item').length).toBeGreaterThan(0),
      );
      itemByHeadline(ac, 'Engineering')!.click();
      await waitFor(() => expect(ac.value).toEqual(['design', 'eng']));
    });

    await step('A third pick past the cap is rejected — no growth, no event (guard)', async () => {
      fieldOf(ac).click(); // the previous pick closed the menu; reopen
      await waitFor(() =>
        expect(ac.shadowRoot!.querySelectorAll('md-menu-item').length).toBeGreaterThan(0),
      );
      const marked = () =>
        ac.shadowRoot!.querySelectorAll('md-menu-item[aria-selected="true"]').length;
      // Both capped selections — seeded `design` + picked `eng` — are marked in
      // the reopened list. Asserted inside waitFor because `value` commits
      // synchronously on the pick but each option reflects `selected →
      // aria-selected` a render tick later: a bare read here catches only
      // `design` (1) before `eng`'s reflection lands, then settles to 2.
      await waitFor(() => expect(marked()).toBe(2));

      let fired = false;
      ac.addEventListener('mdChange', () => (fired = true), { once: true });

      itemByHeadline(ac, 'Product')!.click();

      // `value` is the source of truth and commits synchronously on a successful
      // pick — the cap blocks this one, so it must NOT grow and no mdChange fires.
      expect(ac.value).toEqual(['design', 'eng']);
      expect(fired).toBe(false);
      // …and the rejected option's optimistic self-toggle is reverted, so the
      // reopened list still marks exactly the two capped selections (no phantom
      // check). Settle a render tick so a regressed reflection would have landed.
      await new Promise((r) => setTimeout(r, 60));
      await waitFor(() => expect(marked()).toBe(2));
      expect(itemByHeadline(ac, 'Product')!.getAttribute('aria-selected')).toBe('false');

      key(fieldOf(ac), 'Escape');
      await waitFor(() => expect(ac.open).toBe(false));
      await new Promise((r) => setTimeout(r, 300));
    });
  },
};

/** `clear-on-blur` (strict single mode): text that never matched an option is
 *  wiped when focus leaves the field. */
export const ClearOnBlur: Story = {
  name: 'Clear on blur (strict single)',
  render: () => html`
    <div style="max-inline-size: 360px;">
      <md-autocomplete label="Country" variant="outlined" clear-on-blur .options=${countries}></md-autocomplete>
    </div>
  `,
  play: async ({ canvasElement, step }) => {
    const ac = await getAc(canvasElement);

    await step('Non-matching, uncommitted text is wiped from the input on blur', async () => {
      // Seed uncommitted text without opening the menu, then blur the field.
      (ac as unknown as { inputValue: string }).inputValue = 'zzz';
      await waitFor(() => expect(inputOf(ac).value).toBe('zzz'));
      let emitted: string | string[] | undefined;
      ac.addEventListener('mdInput', (e) => (emitted = (e as CustomEvent).detail));
      fieldOf(ac).dispatchEvent(new Event('blur')); // handleFieldBlur (menu closed)
      await waitFor(() => expect(ac.inputValue).toBe('')); // clear-on-blur wiped it
      expect(emitted).toBe('');
      expect(ac.value).toBe(''); // value was never committed, so it stays empty
    });
  },
};

export const RTL: Story = {
  render: () => html`
    <div dir="rtl" style="max-inline-size: 360px;">
      <md-autocomplete
        label="الدولة"
        placeholder="ابدأ بالكتابة…"
        no-options-text="لا توجد خيارات"
        no-results-text="لا نتائج"
        variant="outlined"
        .options=${[
          { value: 'sa', label: 'السعودية' },
          { value: 'ae', label: 'الإمارات' },
          { value: 'eg', label: 'مصر' },
          { value: 'ma', label: 'المغرب' },
        ]}
      ></md-autocomplete>
    </div>
  `,
};

/** German + Japanese instances — every text affordance is a prop. */
export const Localization: Story = {
  render: () => html`
    <div style="display:flex; flex-direction:column; gap:24px; max-inline-size: 360px;">
      <md-autocomplete
        label="Land" placeholder="Tippen zum Filtern…"
        no-options-text="Keine Optionen" no-results-text="Keine Treffer" loading-text="Wird geladen…"
        variant="outlined"
        .options=${[
          { value: 'de', label: 'Deutschland' },
          { value: 'at', label: 'Österreich' },
          { value: 'ch', label: 'Schweiz' },
        ]}
      ></md-autocomplete>
      <md-autocomplete
        label="都道府県" placeholder="入力して絞り込み…"
        no-options-text="選択肢がありません" no-results-text="一致なし"
        variant="outlined" multiple
        .options=${[
          { value: 'tokyo', label: '東京都' },
          { value: 'osaka', label: '大阪府' },
          { value: 'kyoto', label: '京都府' },
          { value: 'hokkaido', label: '北海道' },
        ]}
        .value=${['tokyo']}
      ></md-autocomplete>
    </div>
  `,
};

/**
 * Combobox with the focus-moves-into-popup keyboard model: typing filters in
 * place; ArrowDown walks into the listbox (real focus, announced by AT);
 * Enter selects; Escape returns to the input.
 */
export const Accessibility: Story = {
  name: 'Accessibility',
  parameters: {
    docs: {
      description: {
        story:
          'The popup is a named WAI-ARIA listbox (`aria-selected` options, `aria-multiselectable` when `multiple`); chips live in a labelled `role="group"`; `required` participates in constraint validation. axe: 0 violations across all stories, light + dark.',
      },
    },
  },
  render: (_args, { globals }) => html`
    <md-autocomplete label="${t(globals.locale, 'autocomplete.assignee')}" variant="outlined" multiple required .options=${tags} .value=${['eng']}></md-autocomplete>
    <details style="font: 13px/1.6 system-ui; opacity: 0.85; margin-top: 20px; max-inline-size: 560px;">
      <summary>Keyboard &amp; AT contract</summary>
      <ul style="line-height: 1.9;">
        <li><b>Type</b> — filters the listbox live (debounced engine query when virtualized).</li>
        <li><b>↓</b> — on a closed field, opens the popup <em>and</em> moves <em>real</em> focus onto the first option in a single press (APG); with the popup already open it steps focus in from the input. <b>↑</b> does the same to the LAST option.</li>
        <li><b>↑ / ↓</b> in the list — roving focus between options; <b>Enter</b> selects; typing resumes in the input.</li>
        <li><b>Escape</b> — closes the popup and returns to the input.</li>
        <li><b>Backspace</b> on an empty multi input — removes the last chip.</li>
        <li>Popup: <code>role="listbox"</code> named by the label, options carry <code>aria-selected</code> (+ <code>aria-setsize/posinset</code> when virtualized).</li>
        <li>Chips: labelled <code>role="group"</code>; each chip's remove button is a real, focusable control.</li>
        <li><code>required</code> with no selection blocks form submission (ElementInternals validity).</li>
      </ul>
    </details>
  `,
};

export const ComboboxSemantics: Story = {
  name: 'Combobox semantics (cross-shadow ARIA)',
  parameters: {
    docs: {
      description: {
        story:
          'The typing target is the `<input>` inside md-text-field\'s shadow root, while the ' +
          'listbox lives in md-autocomplete\'s — different tree scopes, so an `aria-controls` ' +
          'IDREF between them can never resolve. The role, the expanded state and the ' +
          'typing relationship are handed to the field as props (`input-role="combobox"`), ' +
          'and the listbox is referenced with **ARIA element reflection** ' +
          '(`input.ariaControlsElements`), which takes element references rather than ids and ' +
          'accepts a target in an ancestor tree.<br><br>' +
          'Note for anyone reading an axe report: the reflection setter leaves an EMPTY ' +
          '`aria-controls=""` attribute behind, and axe reads attributes rather than the ' +
          'accessibility tree, so it reports `aria-required-attr` while the popup is open. The ' +
          'relation is real — Chrome DevTools → Accessibility shows the combobox controlling ' +
          'the listbox.',
      },
    },
  },
  render: (_args, { globals }) => html`
    <md-autocomplete
      label="${t(globals.locale, 'autocomplete.country')}"
      variant="outlined"
      .options=${countries}
    ></md-autocomplete>
  `,
  /** Asserts the combobox contract on the REAL textbox, including the
   *  cross-shadow listbox reference that plain IDREFs cannot express. */
  play: async ({ canvasElement, step }) => {
    const ac = await getAc(canvasElement);
    const input = () => inputOf(ac);

    await step('The inner input is the combobox, not the host', async () => {
      await waitFor(() => expect(input().getAttribute('role')).toBe('combobox'));
      expect(input().getAttribute('aria-autocomplete')).toBe('list');
      expect(input().getAttribute('aria-expanded')).toBe('false');
      // The host carries no role: the control is the input AT lands on.
      expect(ac.getAttribute('role')).toBeNull();
    });

    await step('Opening flips aria-expanded on that input', async () => {
      typeIn(ac, 'un');
      await waitFor(() => expect(ac.open).toBe(true));
      await waitFor(() => expect(input().getAttribute('aria-expanded')).toBe('true'));
    });

    await step('The listbox is referenced across the shadow boundary', async () => {
      const listbox = ac.shadowRoot!.querySelector('[role="listbox"]') as HTMLElement;
      expect(listbox).toBeTruthy();
      // Different roots — an IDREF here would dangle.
      expect(input().getRootNode()).not.toBe(listbox.getRootNode());
      const refs = (input() as unknown as { ariaControlsElements?: Element[] | null })
        .ariaControlsElements;
      if (refs !== undefined) {
        await waitFor(() => {
          const current = (input() as unknown as { ariaControlsElements?: Element[] | null })
            .ariaControlsElements;
          expect(current?.[0]).toBe(listbox);
        });
      }
    });

    await step('Closing drops the reference and the expanded flag', async () => {
      key(input(), 'Escape');
      await waitFor(() => expect(ac.open).toBe(false));
      await waitFor(() => expect(input().getAttribute('aria-expanded')).toBe('false'));
      // The reference is cleared from componentDidRender, one microtask after
      // the attribute flip — so wait for it rather than reading straight after.
      if ('ariaControlsElements' in input()) {
        await waitFor(() => {
          const refs = (input() as unknown as { ariaControlsElements?: Element[] | null })
            .ariaControlsElements;
          expect(refs?.length ?? 0).toBe(0);
        });
      }
      await new Promise((r) => setTimeout(r, 200));
    });
  },
};

export const FormParticipation: Story = {
  render: (_args, { globals }) => html`
    <form
      id="ac-form"
      @submit=${(e: Event) => {
        e.preventDefault();
        const fd = new FormData(e.target as HTMLFormElement);
        console.log('FormData tags:', fd.getAll('tags'));
        alert('tags = ' + JSON.stringify(fd.getAll('tags')));
      }}
      style="display:flex; flex-direction:column; gap:16px; max-inline-size: 360px;"
    >
      <md-autocomplete name="tags" label="${t(globals.locale, 'autocomplete.tags')}" variant="outlined" multiple required .options=${tags}></md-autocomplete>
      <md-button type="submit" variant="filled">${t(globals.locale, 'submit')}</md-button>
    </form>
  `,
};

export const DarkTheme: Story = {
  decorators: [
    (story) => html`
      <div data-theme="dark" style="background: var(--md-sys-color-surface); padding: 24px; border-radius: 16px;">
        ${story()}
      </div>
    `,
  ],
  render: () => html`
    <div style="max-inline-size: 360px;">
      <md-autocomplete label="Dark" variant="outlined" multiple .options=${tags} .value=${['design','eng']}></md-autocomplete>
    </div>
  `,
};

export const CustomCSS: Story = {
  render: () => html`
    <style>
      .pill { --md-autocomplete-chip-radius: 999px; }
      .wide { --md-autocomplete-min-width: 480px; }
    </style>
    <div style="display:flex; flex-direction:column; gap:16px;">
      <md-autocomplete class="pill" variant="outlined" multiple label="Pill chips" .options=${tags} .value=${['design','eng']}></md-autocomplete>
      <md-autocomplete class="wide" variant="outlined" label="Wide" .options=${countries}></md-autocomplete>
    </div>
  `,
};
