import type { Meta, StoryObj } from '@storybook/web-components';
import { expect, waitFor } from 'storybook/test';
import { html } from 'lit';
import { t } from '../i18n';

/** Shadow-piercing helpers for play(): testing-library queries can't cross
 *  shadow roots, so interactions address the real internals directly. Every
 *  entry point first awaits hydration — pre-hydration clicks are silent no-ops. */
const getSet = async (canvasElement: HTMLElement): Promise<HTMLElement> => {
  const set = canvasElement.querySelector('md-segmented-button-set') as HTMLElement;
  await waitFor(() => expect(set.classList.contains('hydrated')).toBe(true));
  return set;
};
const segmentsOf = (set: HTMLElement) =>
  Array.from(set.querySelectorAll('md-segmented-button')) as HTMLElement[];
const getSegment = (set: HTMLElement, value: string) =>
  segmentsOf(set).find((s) => s.getAttribute('value') === value)!;
const selectedValues = (set: HTMLElement) =>
  segmentsOf(set)
    .filter((s) => s.getAttribute('aria-checked') === 'true')
    .map((s) => s.getAttribute('value')!);
/** The checkmark span carries part="checkmark" only while selected. */
const checkmarkOf = (seg: HTMLElement) => seg.shadowRoot!.querySelector('[part="checkmark"]');
/** Fire a real keydown on a segment host — the handler is bound on `<Host>`, so a
 *  native dispatch exercises the APG keyboard model (mirrors the radio/tabs stories). */
const key = (target: Element, k: string) =>
  target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, composed: true }));

const meta: Meta = {
  title: 'Actions/Segmented Button',
  component: 'md-segmented-button-set',
  tags: ['autodocs'],
  parameters: {
    docs: {
      source: {
        type: 'code',
        language: 'html',
      },
    },
  },
  argTypes: {
    multiselect: { control: 'boolean' },
    density: {
      control: 'select',
      options: [0, -1, -2, -3],
    },
  },
  args: {
    multiselect: false,
    density: 0,
  },
};

export default meta;
type Story = StoryObj;

const ROW = 'display:flex; gap:16px; flex-wrap:wrap; align-items:center;';
const SECTION = 'padding:24px; font-family: Roboto, sans-serif;';
const HEADING = 'color:#49454F; margin:20px 0 8px; font-size:13px; font-weight:500; text-transform:uppercase; letter-spacing:0.5px;';

/* ==========================================================
   PLAYGROUND
   ========================================================== */
export const Playground: Story = {
  parameters: {
    docs: {
      source: {
        code: `<md-segmented-button-set>
  <md-segmented-button value="day" label="Day" selected></md-segmented-button>
  <md-segmented-button value="week" label="Week"></md-segmented-button>
  <md-segmented-button value="month" label="Month"></md-segmented-button>
</md-segmented-button-set>`,
      },
    },
  },
  render: (args, { globals }) => html`
    <md-segmented-button-set
      .multiselect="${args.multiselect}"
      .density="${args.density}"
    >
      <md-segmented-button value="day" label="${t(globals.locale, 'segmentedButton.day')}" selected></md-segmented-button>
      <md-segmented-button value="week" label="${t(globals.locale, 'segmentedButton.week')}"></md-segmented-button>
      <md-segmented-button value="month" label="${t(globals.locale, 'segmentedButton.month')}"></md-segmented-button>
    </md-segmented-button-set>
  `,
};

/* ==========================================================
   SINGLE SELECT (default)
   ========================================================== */
export const SingleSelect: Story = {
  name: 'Single Select',
  parameters: {
    docs: {
      source: {
        code: `<md-segmented-button-set>
  <md-segmented-button value="day" label="Day" selected></md-segmented-button>
  <md-segmented-button value="week" label="Week"></md-segmented-button>
  <md-segmented-button value="month" label="Month"></md-segmented-button>
  <md-segmented-button value="year" label="Year"></md-segmented-button>
</md-segmented-button-set>`,
      },
    },
  },
  render: (_args, { globals }) => html`
    <div style="${SECTION}">
      <p style="${HEADING}">Single-select (radio group)</p>
      <md-segmented-button-set>
        <md-segmented-button value="day" label="${t(globals.locale, 'segmentedButton.day')}" selected></md-segmented-button>
        <md-segmented-button value="week" label="${t(globals.locale, 'segmentedButton.week')}"></md-segmented-button>
        <md-segmented-button value="month" label="${t(globals.locale, 'segmentedButton.month')}"></md-segmented-button>
        <md-segmented-button value="year" label="${t(globals.locale, 'segmentedButton.year')}"></md-segmented-button>
      </md-segmented-button-set>

      <p style="color:#49454F; font-size:12px; margin-top:16px;">
        Click a segment to select it. Only one can be selected at a time.
      </p>
    </div>
  `,
  /** Radiogroup: picking a segment selects it, deselects the previous one, and
   *  emits the new single-value set — with the checkmark migrating along. */
  play: async ({ canvasElement, step }) => {
    const set = await getSet(canvasElement);
    const day = getSegment(set, 'day');
    const week = getSegment(set, 'week');
    await waitFor(() => {
      expect(day.classList.contains('hydrated')).toBe(true);
      expect(week.classList.contains('hydrated')).toBe(true);
    });

    await step('Initial: only "day" is selected and shows the checkmark', async () => {
      expect(set.getAttribute('role')).toBe('radiogroup');
      expect(day.getAttribute('aria-checked')).toBe('true');
      expect(week.getAttribute('aria-checked')).toBe('false');
      expect(checkmarkOf(day)).not.toBeNull();
      expect(checkmarkOf(week)).toBeNull();
    });

    await step('Clicking "week" swaps selection off "day" and emits mdChange', async () => {
      let detail: string[] | undefined;
      set.addEventListener('mdChange', (e) => { detail = (e as CustomEvent<string[]>).detail; }, { once: true });
      const dayBefore = day.getAttribute('aria-checked'); // 'true'

      week.click();

      // aria-checked is reflected on the next render flush → assert in waitFor.
      await waitFor(() => expect(week.getAttribute('aria-checked')).toBe('true'));
      // The transition: "day" went selected → deselected (radiogroup swap, not accumulate).
      expect(day.getAttribute('aria-checked')).not.toBe(dayBefore);
      expect(day.getAttribute('aria-checked')).toBe('false');
      // Exactly one segment selected across the whole set.
      expect(selectedValues(set)).toEqual(['week']);
      // Payload proves the SET emitted the new selection, not just child DOM mutation.
      expect(detail).toEqual(['week']);
    });

    await step('Checkmark migrates: appears on "week", clears from "day"', async () => {
      await waitFor(() => expect(checkmarkOf(week)).not.toBeNull());
      expect(checkmarkOf(day)).toBeNull();
    });

    // --- Keyboard: radiogroup arrow model (APG). State entering here: "week" selected. ---
    const month = getSegment(set, 'month');
    const year = getSegment(set, 'year');

    await step('ArrowRight moves focus forward AND selects (radiogroup); emits mdChange', async () => {
      week.focus();
      await waitFor(() => expect(document.activeElement).toBe(week));
      let detail: string[] | undefined;
      set.addEventListener('mdChange', (e) => { detail = (e as CustomEvent<string[]>).detail; }, { once: true });

      key(week, 'ArrowRight'); // week (idx 1) → month

      await waitFor(() => expect(document.activeElement).toBe(month));
      await waitFor(() => expect(month.getAttribute('aria-checked')).toBe('true'));
      // Radiogroup swap: the previously-selected segment is deselected, not accumulated.
      expect(week.getAttribute('aria-checked')).toBe('false');
      expect(selectedValues(set)).toEqual(['month']);
      expect(detail).toEqual(['month']);
    });

    await step('ArrowLeft moves focus backward AND reselects the previous segment', async () => {
      let detail: string[] | undefined;
      set.addEventListener('mdChange', (e) => { detail = (e as CustomEvent<string[]>).detail; }, { once: true });

      key(month, 'ArrowLeft'); // month (idx 2, focused) → week

      await waitFor(() => expect(document.activeElement).toBe(week));
      await waitFor(() => expect(week.getAttribute('aria-checked')).toBe('true'));
      expect(month.getAttribute('aria-checked')).toBe('false');
      expect(detail).toEqual(['week']);
    });

    await step('Enter activates the focused segment and emits mdChange', async () => {
      day.focus();
      await waitFor(() => expect(document.activeElement).toBe(day));
      let detail: string[] | undefined;
      set.addEventListener('mdChange', (e) => { detail = (e as CustomEvent<string[]>).detail; }, { once: true });

      key(day, 'Enter');

      await waitFor(() => expect(day.getAttribute('aria-checked')).toBe('true'));
      expect(week.getAttribute('aria-checked')).toBe('false'); // swapped off
      expect(detail).toEqual(['day']);
    });

    await step('ArrowLeft from the first segment wraps around to the last', async () => {
      // "day" (idx 0) is focused+selected; backward wrap → "year" (idx 3).
      let detail: string[] | undefined;
      set.addEventListener('mdChange', (e) => { detail = (e as CustomEvent<string[]>).detail; }, { once: true });

      key(day, 'ArrowLeft');

      await waitFor(() => expect(document.activeElement).toBe(year));
      await waitFor(() => expect(year.getAttribute('aria-checked')).toBe('true'));
      expect(day.getAttribute('aria-checked')).toBe('false');
      expect(selectedValues(set)).toEqual(['year']);
      expect(detail).toEqual(['year']);
    });
  },
};

/* ==========================================================
   MULTI SELECT
   ========================================================== */
export const MultiSelect: Story = {
  name: 'Multi Select',
  render: (_args, { globals }) => html`
    <div style="${SECTION}">
      <p style="${HEADING}">Multi-select (checkbox group)</p>
      <md-segmented-button-set multiselect>
        <md-segmented-button value="bold" icon="format_bold" label="${t(globals.locale, 'segmentedButton.bold')}"></md-segmented-button>
        <md-segmented-button value="italic" icon="format_italic" label="${t(globals.locale, 'segmentedButton.italic')}"></md-segmented-button>
        <md-segmented-button value="underline" icon="format_underlined" label="${t(globals.locale, 'segmentedButton.underline')}"></md-segmented-button>
      </md-segmented-button-set>

      <p style="color:#49454F; font-size:12px; margin-top:16px;">
        Multiple segments can be selected simultaneously.
      </p>
    </div>
  `,
  /** Group (checkbox) mode: selections accumulate rather than swap, and each
   *  toggle is independent — the value-set grows and shrinks by one. */
  play: async ({ canvasElement, step }) => {
    const set = await getSet(canvasElement);
    const bold = getSegment(set, 'bold');
    const italic = getSegment(set, 'italic');
    const underline = getSegment(set, 'underline');
    // Gate on multiselect having propagated into the children (role flips to
    // checkbox) so clicks land after the set's syncSegments, not as no-op no-wires.
    await waitFor(() => {
      expect(bold.classList.contains('hydrated')).toBe(true);
      expect(bold.getAttribute('role')).toBe('checkbox');
    });

    await step('Initial: a group with nothing selected', async () => {
      expect(set.getAttribute('role')).toBe('group');
      expect(selectedValues(set)).toEqual([]);
    });

    await step('Select "bold" → emits ["bold"]', async () => {
      let detail: string[] | undefined;
      set.addEventListener('mdChange', (e) => { detail = (e as CustomEvent<string[]>).detail; }, { once: true });
      bold.click();
      await waitFor(() => expect(bold.getAttribute('aria-checked')).toBe('true'));
      expect(detail).toEqual(['bold']);
    });

    await step('Select "italic" → BOTH stay selected (value-set grows), emits ["bold","italic"]', async () => {
      const before = selectedValues(set); // ['bold']
      let detail: string[] | undefined;
      set.addEventListener('mdChange', (e) => { detail = (e as CustomEvent<string[]>).detail; }, { once: true });
      italic.click();
      await waitFor(() => expect(italic.getAttribute('aria-checked')).toBe('true'));
      // The transition that distinguishes multi from single: "bold" was NOT deselected.
      expect(bold.getAttribute('aria-checked')).toBe('true');
      expect(selectedValues(set).length).toBeGreaterThan(before.length);
      expect(selectedValues(set)).toEqual(['bold', 'italic']);
      expect(detail).toEqual(['bold', 'italic']);
    });

    await step('Guard: toggling "bold" off leaves "italic" alone → emits ["italic"]', async () => {
      let detail: string[] | undefined;
      set.addEventListener('mdChange', (e) => { detail = (e as CustomEvent<string[]>).detail; }, { once: true });
      bold.click(); // second click on a selected segment toggles it off
      await waitFor(() => expect(bold.getAttribute('aria-checked')).toBe('false'));
      // Independent toggle: italic untouched, underline never touched.
      expect(italic.getAttribute('aria-checked')).toBe('true');
      expect(underline.getAttribute('aria-checked')).toBe('false');
      expect(detail).toEqual(['italic']);
    });

    // --- Keyboard in checkbox (multiselect) mode. State entering here: only "italic" on. ---
    await step('Space toggles the focused segment ON without deselecting others (accumulate)', async () => {
      underline.focus();
      await waitFor(() => expect(document.activeElement).toBe(underline));
      let detail: string[] | undefined;
      set.addEventListener('mdChange', (e) => { detail = (e as CustomEvent<string[]>).detail; }, { once: true });

      key(underline, ' '); // Space activates; multiselect → toggles to selected

      await waitFor(() => expect(underline.getAttribute('aria-checked')).toBe('true'));
      // Accumulate, not swap: italic stays selected.
      expect(italic.getAttribute('aria-checked')).toBe('true');
      expect(detail).toEqual(['italic', 'underline']);
    });

    await step('Arrow moves focus but does NOT change selection in multiselect (APG checkbox group)', async () => {
      const boldBefore = bold.getAttribute('aria-checked');
      const italicBefore = italic.getAttribute('aria-checked');
      const underlineBefore = underline.getAttribute('aria-checked');

      key(underline, 'ArrowLeft'); // underline (idx 2, focused) → italic, focus only

      await waitFor(() => expect(document.activeElement).toBe(italic));
      // Selection is untouched by arrow keys when multiselect.
      expect(bold.getAttribute('aria-checked')).toBe(boldBefore);
      expect(italic.getAttribute('aria-checked')).toBe(italicBefore);
      expect(underline.getAttribute('aria-checked')).toBe(underlineBefore);
    });
  },
};

/* ==========================================================
   WITH ICONS
   ========================================================== */
export const WithIcons: Story = {
  render: (_args, { globals }) => html`
    <div style="${SECTION}">
      <p style="${HEADING}">Icons + labels</p>
      <md-segmented-button-set>
        <md-segmented-button value="car" icon="directions_car" label="${t(globals.locale, 'segmentedButton.car')}" selected></md-segmented-button>
        <md-segmented-button value="bus" icon="directions_bus" label="${t(globals.locale, 'segmentedButton.bus')}"></md-segmented-button>
        <md-segmented-button value="train" icon="train" label="${t(globals.locale, 'segmentedButton.train')}"></md-segmented-button>
        <md-segmented-button value="walk" icon="directions_walk" label="${t(globals.locale, 'segmentedButton.walk')}"></md-segmented-button>
      </md-segmented-button-set>

      <p style="${HEADING}">Label only</p>
      <md-segmented-button-set>
        <md-segmented-button value="s" label="S" selected></md-segmented-button>
        <md-segmented-button value="m" label="M"></md-segmented-button>
        <md-segmented-button value="l" label="L"></md-segmented-button>
        <md-segmented-button value="xl" label="XL"></md-segmented-button>
      </md-segmented-button-set>

      <p style="color:#49454F; font-size:12px; margin-top:16px;">
        When a segment with an icon is selected, the icon is replaced by a checkmark.
        Use <code>no-checkmark</code> to keep the original icon.
      </p>
    </div>
  `,
};

/* ==========================================================
   NO CHECKMARK
   ========================================================== */
export const NoCheckmark: Story = {
  name: 'No Checkmark',
  render: (_args, { globals }) => html`
    <div style="${SECTION}">
      <p style="${HEADING}">With checkmark (default)</p>
      <md-segmented-button-set>
        <md-segmented-button value="car" icon="directions_car" label="${t(globals.locale, 'segmentedButton.car')}" selected></md-segmented-button>
        <md-segmented-button value="bus" icon="directions_bus" label="${t(globals.locale, 'segmentedButton.bus')}"></md-segmented-button>
        <md-segmented-button value="train" icon="train" label="${t(globals.locale, 'segmentedButton.train')}"></md-segmented-button>
      </md-segmented-button-set>

      <p style="${HEADING}">Without checkmark (no-checkmark)</p>
      <md-segmented-button-set>
        <md-segmented-button value="car" icon="directions_car" label="${t(globals.locale, 'segmentedButton.car')}" selected no-checkmark></md-segmented-button>
        <md-segmented-button value="bus" icon="directions_bus" label="${t(globals.locale, 'segmentedButton.bus')}" no-checkmark></md-segmented-button>
        <md-segmented-button value="train" icon="train" label="${t(globals.locale, 'segmentedButton.train')}" no-checkmark></md-segmented-button>
      </md-segmented-button-set>
    </div>
  `,
};

/* ==========================================================
   STATES
   ========================================================== */
export const States: Story = {
  name: 'States (Enabled / Selected / Disabled / Soft-Disabled)',
  render: () => html`
    <div style="${SECTION}">
      <p style="${HEADING}">Enabled (unselected)</p>
      <md-segmented-button-set>
        <md-segmented-button value="a" label="Alpha"></md-segmented-button>
        <md-segmented-button value="b" label="Beta"></md-segmented-button>
        <md-segmented-button value="c" label="Gamma"></md-segmented-button>
      </md-segmented-button-set>

      <p style="${HEADING}">Selected</p>
      <md-segmented-button-set>
        <md-segmented-button value="a" label="Alpha" selected></md-segmented-button>
        <md-segmented-button value="b" label="Beta"></md-segmented-button>
        <md-segmented-button value="c" label="Gamma"></md-segmented-button>
      </md-segmented-button-set>

      <p style="${HEADING}">Disabled (unselected)</p>
      <md-segmented-button-set>
        <md-segmented-button value="a" label="Alpha" disabled></md-segmented-button>
        <md-segmented-button value="b" label="Beta" disabled></md-segmented-button>
        <md-segmented-button value="c" label="Gamma" disabled></md-segmented-button>
      </md-segmented-button-set>

      <p style="${HEADING}">Disabled + Selected</p>
      <md-segmented-button-set>
        <md-segmented-button value="a" label="Alpha" selected disabled></md-segmented-button>
        <md-segmented-button value="b" label="Beta" disabled></md-segmented-button>
        <md-segmented-button value="c" label="Gamma" disabled></md-segmented-button>
      </md-segmented-button-set>

      <p style="${HEADING}">Soft-Disabled (focusable, announced to AT)</p>
      <md-segmented-button-set>
        <md-segmented-button value="a" label="Alpha" soft-disabled></md-segmented-button>
        <md-segmented-button value="b" label="Beta" soft-disabled></md-segmented-button>
        <md-segmented-button value="c" label="Gamma" soft-disabled></md-segmented-button>
      </md-segmented-button-set>

      <p style="${HEADING}">Soft-Disabled + Selected</p>
      <md-segmented-button-set>
        <md-segmented-button value="a" label="Alpha" selected soft-disabled></md-segmented-button>
        <md-segmented-button value="b" label="Beta" soft-disabled></md-segmented-button>
        <md-segmented-button value="c" label="Gamma" soft-disabled></md-segmented-button>
      </md-segmented-button-set>

      <p style="color:#49454F; font-size:12px; margin-top:16px;">
        Hover, focus (Tab), and press states are interactive — try them above.<br>
        <strong>Disabled</strong> removes the segment from the tab order.
        <strong>Soft-disabled</strong> looks disabled but remains focusable for screen readers.
      </p>
    </div>
  `,
};

/* ==========================================================
   DENSITY
   ========================================================== */
export const Density: Story = {
  render: (_args, { globals }) => html`
    <div style="${SECTION}">
      <p style="${HEADING}">Density 0 (default — 40dp)</p>
      <md-segmented-button-set density="0">
        <md-segmented-button value="a" label="${t(globals.locale, 'segmentedButton.day')}" selected></md-segmented-button>
        <md-segmented-button value="b" label="${t(globals.locale, 'segmentedButton.week')}"></md-segmented-button>
        <md-segmented-button value="c" label="${t(globals.locale, 'segmentedButton.month')}"></md-segmented-button>
      </md-segmented-button-set>

      <p style="${HEADING}">Density -1 (36dp)</p>
      <md-segmented-button-set density="-1">
        <md-segmented-button value="a" label="${t(globals.locale, 'segmentedButton.day')}" selected></md-segmented-button>
        <md-segmented-button value="b" label="${t(globals.locale, 'segmentedButton.week')}"></md-segmented-button>
        <md-segmented-button value="c" label="${t(globals.locale, 'segmentedButton.month')}"></md-segmented-button>
      </md-segmented-button-set>

      <p style="${HEADING}">Density -2 (32dp)</p>
      <md-segmented-button-set density="-2">
        <md-segmented-button value="a" label="${t(globals.locale, 'segmentedButton.day')}" selected></md-segmented-button>
        <md-segmented-button value="b" label="${t(globals.locale, 'segmentedButton.week')}"></md-segmented-button>
        <md-segmented-button value="c" label="${t(globals.locale, 'segmentedButton.month')}"></md-segmented-button>
      </md-segmented-button-set>

      <p style="${HEADING}">Density -3 (28dp)</p>
      <md-segmented-button-set density="-3">
        <md-segmented-button value="a" label="${t(globals.locale, 'segmentedButton.day')}" selected></md-segmented-button>
        <md-segmented-button value="b" label="${t(globals.locale, 'segmentedButton.week')}"></md-segmented-button>
        <md-segmented-button value="c" label="${t(globals.locale, 'segmentedButton.month')}"></md-segmented-button>
      </md-segmented-button-set>

      <p style="color:#49454F; font-size:12px; margin-top:16px;">
        Each density step removes 4dp from the height.
      </p>
    </div>
  `,
};

/* ==========================================================
   TWO SEGMENTS
   ========================================================== */
export const TwoSegments: Story = {
  name: 'Two Segments',
  render: (_args, { globals }) => html`
    <div style="${SECTION}">
      <p style="${HEADING}">Toggle between two options</p>
      <md-segmented-button-set>
        <md-segmented-button value="list" icon="view_list" label="${t(globals.locale, 'segmentedButton.list')}" selected></md-segmented-button>
        <md-segmented-button value="grid" icon="grid_view" label="${t(globals.locale, 'segmentedButton.grid')}"></md-segmented-button>
      </md-segmented-button-set>
    </div>
  `,
};

/* ==========================================================
   FIVE SEGMENTS
   ========================================================== */
export const FiveSegments: Story = {
  name: 'Five Segments',
  render: () => html`
    <div style="${SECTION}">
      <p style="${HEADING}">Five segments with icons</p>
      <md-segmented-button-set>
        <md-segmented-button value="1" icon="looks_one" label="One" selected></md-segmented-button>
        <md-segmented-button value="2" icon="looks_two" label="Two"></md-segmented-button>
        <md-segmented-button value="3" icon="looks_3" label="Three"></md-segmented-button>
        <md-segmented-button value="4" icon="looks_4" label="Four"></md-segmented-button>
        <md-segmented-button value="5" icon="looks_5" label="Five"></md-segmented-button>
      </md-segmented-button-set>
    </div>
  `,
};

/* ==========================================================
   CUSTOM CSS
   ========================================================== */
export const CustomCSS: Story = {
  name: 'Custom CSS Properties',
  render: (_args, { globals }) => html`
    <style>
      .custom-seg md-segmented-button {
        --md-segmented-button-selected-container-color: var(--md-sys-color-primary, #6750A4);
        --md-segmented-button-selected-label-color: var(--md-sys-color-on-primary, #fff);
        --md-segmented-button-outline-color: var(--md-sys-color-primary, #6750A4);
      }
      .custom-shape md-segmented-button {
        --md-segmented-button-container-shape: 8px;
      }
    </style>
    <div style="${SECTION}">
      <p style="${HEADING}">Custom colors (primary variant)</p>
      <div class="custom-seg">
        <md-segmented-button-set>
          <md-segmented-button value="a" label="Alpha" selected></md-segmented-button>
          <md-segmented-button value="b" label="Beta"></md-segmented-button>
          <md-segmented-button value="c" label="Gamma"></md-segmented-button>
        </md-segmented-button-set>
      </div>

      <p style="${HEADING}">Custom shape (8px corners)</p>
      <div class="custom-shape">
        <md-segmented-button-set>
          <md-segmented-button value="a" label="${t(globals.locale, 'segmentedButton.day')}" selected></md-segmented-button>
          <md-segmented-button value="b" label="${t(globals.locale, 'segmentedButton.week')}"></md-segmented-button>
          <md-segmented-button value="c" label="${t(globals.locale, 'segmentedButton.month')}"></md-segmented-button>
        </md-segmented-button-set>
      </div>
    </div>
  `,
};

/* ==========================================================
   RTL
   ========================================================== */
export const RTL: Story = {
  name: 'RTL',
  render: () => html`
    <div dir="rtl" style="${SECTION}">
      <p style="${HEADING}">Single-select — RTL</p>
      <md-segmented-button-set>
        <md-segmented-button value="day" label="يوم" selected></md-segmented-button>
        <md-segmented-button value="week" label="أسبوع"></md-segmented-button>
        <md-segmented-button value="month" label="شهر"></md-segmented-button>
      </md-segmented-button-set>

      <p style="${HEADING}">With icons — RTL</p>
      <md-segmented-button-set>
        <md-segmented-button value="car" icon="directions_car" label="سيارة" selected></md-segmented-button>
        <md-segmented-button value="bus" icon="directions_bus" label="حافلة"></md-segmented-button>
        <md-segmented-button value="train" icon="train" label="قطار"></md-segmented-button>
      </md-segmented-button-set>

      <p style="${HEADING}">Multi-select — RTL</p>
      <md-segmented-button-set multiselect>
        <md-segmented-button value="bold" icon="format_bold" label="عريض" selected></md-segmented-button>
        <md-segmented-button value="italic" icon="format_italic" label="مائل"></md-segmented-button>
        <md-segmented-button value="underline" icon="format_underlined" label="تسطير" selected></md-segmented-button>
      </md-segmented-button-set>

      <p style="${HEADING}">Five segments — RTL</p>
      <md-segmented-button-set>
        <md-segmented-button value="1" label="واحد" selected></md-segmented-button>
        <md-segmented-button value="2" label="اثنان"></md-segmented-button>
        <md-segmented-button value="3" label="ثلاثة"></md-segmented-button>
        <md-segmented-button value="4" label="أربعة"></md-segmented-button>
        <md-segmented-button value="5" label="خمسة"></md-segmented-button>
      </md-segmented-button-set>
    </div>
  `,
};

/* ==========================================================
   LOCALIZATION
   ========================================================== */
export const Localization: Story = {
  name: 'Localization',
  render: () => html`
    <div style="${SECTION}">
      <p style="${HEADING}">English (LTR)</p>
      <md-segmented-button-set>
        <md-segmented-button value="day" label="Day" selected></md-segmented-button>
        <md-segmented-button value="week" label="Week"></md-segmented-button>
        <md-segmented-button value="month" label="Month"></md-segmented-button>
      </md-segmented-button-set>

      <p style="${HEADING}">Arabic (RTL)</p>
      <div dir="rtl">
        <md-segmented-button-set>
          <md-segmented-button value="day" label="يوم" selected></md-segmented-button>
          <md-segmented-button value="week" label="أسبوع"></md-segmented-button>
          <md-segmented-button value="month" label="شهر"></md-segmented-button>
        </md-segmented-button-set>
      </div>

      <p style="${HEADING}">Japanese (LTR)</p>
      <md-segmented-button-set>
        <md-segmented-button value="day" label="日" selected></md-segmented-button>
        <md-segmented-button value="week" label="週"></md-segmented-button>
        <md-segmented-button value="month" label="月"></md-segmented-button>
      </md-segmented-button-set>

      <p style="${HEADING}">German (LTR — longer labels)</p>
      <md-segmented-button-set>
        <md-segmented-button value="day" label="Tag" selected></md-segmented-button>
        <md-segmented-button value="week" label="Woche"></md-segmented-button>
        <md-segmented-button value="month" label="Monat"></md-segmented-button>
        <md-segmented-button value="year" label="Jahr"></md-segmented-button>
      </md-segmented-button-set>

      <p style="${HEADING}">French (LTR)</p>
      <md-segmented-button-set>
        <md-segmented-button value="day" label="Jour" selected></md-segmented-button>
        <md-segmented-button value="week" label="Semaine"></md-segmented-button>
        <md-segmented-button value="month" label="Mois"></md-segmented-button>
      </md-segmented-button-set>

      <p style="${HEADING}">Hebrew (RTL)</p>
      <div dir="rtl">
        <md-segmented-button-set>
          <md-segmented-button value="day" label="יום" selected></md-segmented-button>
          <md-segmented-button value="week" label="שבוע"></md-segmented-button>
          <md-segmented-button value="month" label="חודש"></md-segmented-button>
        </md-segmented-button-set>
      </div>
    </div>
  `,
};

/* ==========================================================
   ACCESSIBILITY
   ========================================================== */
export const Accessibility: Story = {
  name: 'Accessibility',
  parameters: {
    docs: {
      description: {
        story: [
          'The set renders as `radiogroup` (single-select) or `group` (multi-select).',
          'Each segment is `radio` or `checkbox` with `aria-checked`.',
          'Disabled segments carry `aria-disabled="true"` and are removed from the tab order.',
          'Soft-disabled segments stay focusable so screen readers can discover and announce them.',
          '**Keyboard:** Tab to enter the set, Arrow keys to move, Space / Enter to activate.',
        ].join(' '),
      },
    },
  },
  render: () => html`
    <div style="${SECTION}">
      <p style="${HEADING}">Single-select — role="radiogroup" / role="radio"</p>
      <p style="color:#49454F; font-size:12px; margin:4px 0 8px;">
        Tab into the set, use ← → Arrow keys to move, Space / Enter to select.
      </p>
      <md-segmented-button-set aria-label="View period">
        <md-segmented-button value="day" label="Day" selected></md-segmented-button>
        <md-segmented-button value="week" label="Week"></md-segmented-button>
        <md-segmented-button value="month" label="Month"></md-segmented-button>
      </md-segmented-button-set>

      <p style="${HEADING}">Multi-select — role="group" / role="checkbox"</p>
      <p style="color:#49454F; font-size:12px; margin:4px 0 8px;">
        Tab between segments. Space / Enter toggles each one independently.
      </p>
      <md-segmented-button-set multiselect aria-label="Text formatting">
        <md-segmented-button value="bold" icon="format_bold" label="Bold" selected></md-segmented-button>
        <md-segmented-button value="italic" icon="format_italic" label="Italic"></md-segmented-button>
        <md-segmented-button value="underline" icon="format_underlined" label="Underline"></md-segmented-button>
      </md-segmented-button-set>

      <p style="${HEADING}">Disabled segment — aria-disabled="true", removed from tab order</p>
      <md-segmented-button-set aria-label="Sort order">
        <md-segmented-button value="asc" label="Ascending" selected></md-segmented-button>
        <md-segmented-button value="desc" label="Descending"></md-segmented-button>
        <md-segmented-button value="custom" label="Custom" disabled></md-segmented-button>
      </md-segmented-button-set>

      <p style="${HEADING}">Soft-disabled — focusable, announced as disabled to AT</p>
      <p style="color:#49454F; font-size:12px; margin:4px 0 8px;">
        Tab reaches soft-disabled segments; screen readers announce them as disabled.
      </p>
      <md-segmented-button-set aria-label="Export format">
        <md-segmented-button value="pdf" label="PDF" selected></md-segmented-button>
        <md-segmented-button value="csv" label="CSV"></md-segmented-button>
        <md-segmented-button value="xlsx" label="XLSX" soft-disabled></md-segmented-button>
      </md-segmented-button-set>

      <p style="${HEADING}">Icon-only with aria-label on each segment</p>
      <p style="color:#49454F; font-size:12px; margin:4px 0 8px;">
        When omitting the label prop, provide aria-label so AT has an accessible name.
      </p>
      <md-segmented-button-set aria-label="View mode">
        <md-segmented-button value="list" icon="view_list" aria-label="List view" selected></md-segmented-button>
        <md-segmented-button value="grid" icon="grid_view" aria-label="Grid view"></md-segmented-button>
        <md-segmented-button value="map" icon="map" aria-label="Map view"></md-segmented-button>
      </md-segmented-button-set>
    </div>
  `,
};

/* ==========================================================
   RESPONSIVENESS
   ========================================================== */
export const Responsiveness: Story = {
  name: 'Responsiveness',
  render: (_args, { globals }) => html`
    <style>
      .resp-resizable {
        resize: horizontal;
        overflow: hidden;
        min-inline-size: 320px;
        max-inline-size: 100%;
        inline-size: 480px;
        padding: 20px;
        border: 2px dashed var(--md-sys-color-outline-variant, #CAC4D0);
        border-radius: 12px;
        box-sizing: border-box;
      }
      .resp-resizable md-segmented-button-set { inline-size: 100%; }
      .resp-hint {
        font: 400 12px/18px Roboto, sans-serif;
        color: var(--md-sys-color-on-surface-variant, #49454F);
        margin: 0 0 12px;
        display: flex;
        align-items: center;
        gap: 6px;
      }
    </style>
    <div style="${SECTION}">
      <p style="${HEADING}">Drag the corner to resize — segments scale with the container</p>
      <p class="resp-hint">
        <span style="font-size:16px;">↔</span>
        Drag the bottom-right corner of the dashed box. Min 320 px (compact mobile), max full width.
      </p>

      <div style="display:flex; flex-direction:column; gap:20px;">
        <div class="resp-resizable">
          <p style="font:500 11px/16px Roboto,sans-serif; color:var(--md-sys-color-on-surface-variant,#49454F); margin:0 0 8px; text-transform:uppercase; letter-spacing:.5px;">3 segments</p>
          <md-segmented-button-set>
            <md-segmented-button value="day" label="${t(globals.locale, 'segmentedButton.day')}" selected></md-segmented-button>
            <md-segmented-button value="week" label="${t(globals.locale, 'segmentedButton.week')}"></md-segmented-button>
            <md-segmented-button value="month" label="${t(globals.locale, 'segmentedButton.month')}"></md-segmented-button>
          </md-segmented-button-set>
        </div>

        <div class="resp-resizable">
          <p style="font:500 11px/16px Roboto,sans-serif; color:var(--md-sys-color-on-surface-variant,#49454F); margin:0 0 8px; text-transform:uppercase; letter-spacing:.5px;">4 segments with icons</p>
          <md-segmented-button-set>
            <md-segmented-button value="car" icon="directions_car" label="${t(globals.locale, 'segmentedButton.car')}" selected></md-segmented-button>
            <md-segmented-button value="bus" icon="directions_bus" label="${t(globals.locale, 'segmentedButton.bus')}"></md-segmented-button>
            <md-segmented-button value="train" icon="train" label="${t(globals.locale, 'segmentedButton.train')}"></md-segmented-button>
            <md-segmented-button value="walk" icon="directions_walk" label="${t(globals.locale, 'segmentedButton.walk')}"></md-segmented-button>
          </md-segmented-button-set>
        </div>

        <div class="resp-resizable">
          <p style="font:500 11px/16px Roboto,sans-serif; color:var(--md-sys-color-on-surface-variant,#49454F); margin:0 0 8px; text-transform:uppercase; letter-spacing:.5px;">5 segments — density -3</p>
          <md-segmented-button-set density="-3">
            <md-segmented-button value="1" icon="looks_one" label="One" selected></md-segmented-button>
            <md-segmented-button value="2" icon="looks_two" label="Two"></md-segmented-button>
            <md-segmented-button value="3" icon="looks_3" label="Three"></md-segmented-button>
            <md-segmented-button value="4" icon="looks_4" label="Four"></md-segmented-button>
            <md-segmented-button value="5" icon="looks_5" label="Five"></md-segmented-button>
          </md-segmented-button-set>
        </div>
      </div>
    </div>
  `,
};

/* ==========================================================
   CUSTOMIZATION
   ========================================================== */
export const Customization: Story = {
  name: 'Customization',
  render: (_args, { globals }) => html`
    <style>
      .seg-primary md-segmented-button {
        --md-segmented-button-outline-color: var(--md-sys-color-primary, #6750A4);
        --md-segmented-button-selected-container-color: var(--md-sys-color-primary-container, #EADDFF);
        --md-segmented-button-selected-label-color: var(--md-sys-color-on-primary-container, #21005D);
      }
      .seg-tertiary md-segmented-button {
        --md-segmented-button-outline-color: var(--md-sys-color-tertiary, #7D5260);
        --md-segmented-button-selected-container-color: var(--md-sys-color-tertiary-container, #FFD8E4);
        --md-segmented-button-selected-label-color: var(--md-sys-color-on-tertiary-container, #31111D);
      }
      .seg-error md-segmented-button {
        --md-segmented-button-outline-color: var(--md-sys-color-error, #B3261E);
        --md-segmented-button-selected-container-color: var(--md-sys-color-error-container, #F9DEDC);
        --md-segmented-button-selected-label-color: var(--md-sys-color-on-error-container, #410E0B);
      }
      .seg-sharp md-segmented-button {
        --md-segmented-button-container-shape: 4px;
      }
      .seg-large-icon md-segmented-button {
        --md-segmented-button-icon-size: 24px;
      }
    </style>
    <div style="${SECTION}">
      <p style="${HEADING}">Primary container</p>
      <div class="seg-primary">
        <md-segmented-button-set>
          <md-segmented-button value="day" label="${t(globals.locale, 'segmentedButton.day')}" selected></md-segmented-button>
          <md-segmented-button value="week" label="${t(globals.locale, 'segmentedButton.week')}"></md-segmented-button>
          <md-segmented-button value="month" label="${t(globals.locale, 'segmentedButton.month')}"></md-segmented-button>
        </md-segmented-button-set>
      </div>

      <p style="${HEADING}">Tertiary container</p>
      <div class="seg-tertiary">
        <md-segmented-button-set>
          <md-segmented-button value="day" label="${t(globals.locale, 'segmentedButton.day')}" selected></md-segmented-button>
          <md-segmented-button value="week" label="${t(globals.locale, 'segmentedButton.week')}"></md-segmented-button>
          <md-segmented-button value="month" label="${t(globals.locale, 'segmentedButton.month')}"></md-segmented-button>
        </md-segmented-button-set>
      </div>

      <p style="${HEADING}">Error / danger variant</p>
      <div class="seg-error">
        <md-segmented-button-set>
          <md-segmented-button value="low" label="${t(globals.locale, 'segmentedButton.low')}" selected></md-segmented-button>
          <md-segmented-button value="medium" label="${t(globals.locale, 'segmentedButton.medium')}"></md-segmented-button>
          <md-segmented-button value="high" label="${t(globals.locale, 'segmentedButton.high')}"></md-segmented-button>
        </md-segmented-button-set>
      </div>

      <p style="${HEADING}">Sharp corners (--md-segmented-button-container-shape: 4px)</p>
      <div class="seg-sharp">
        <md-segmented-button-set>
          <md-segmented-button value="day" label="${t(globals.locale, 'segmentedButton.day')}" selected></md-segmented-button>
          <md-segmented-button value="week" label="${t(globals.locale, 'segmentedButton.week')}"></md-segmented-button>
          <md-segmented-button value="month" label="${t(globals.locale, 'segmentedButton.month')}"></md-segmented-button>
        </md-segmented-button-set>
      </div>

      <p style="${HEADING}">Large icons (--md-segmented-button-icon-size: 24px)</p>
      <div class="seg-large-icon">
        <md-segmented-button-set>
          <md-segmented-button value="car" icon="directions_car" label="${t(globals.locale, 'segmentedButton.car')}" selected></md-segmented-button>
          <md-segmented-button value="bus" icon="directions_bus" label="${t(globals.locale, 'segmentedButton.bus')}"></md-segmented-button>
          <md-segmented-button value="train" icon="train" label="${t(globals.locale, 'segmentedButton.train')}"></md-segmented-button>
        </md-segmented-button-set>
      </div>
    </div>
  `,
};

/* ==========================================================
   DARK THEME
   ========================================================== */
export const DarkTheme: Story = {
  decorators: [
    (story) => {
      return html`
        <div data-theme="dark" style="background: var(--md-sys-color-surface, #1C1B1F); color: var(--md-sys-color-on-surface, #E6E1E5); padding: 32px; border-radius: 16px;">
          ${story()}
        </div>
      `;
    },
  ],
  render: (_args, { globals }) => html`
    <div style="${SECTION}">
      <p style="${HEADING}; color:#CAC4D0;">Single select</p>
      <md-segmented-button-set>
        <md-segmented-button value="day" label="${t(globals.locale, 'segmentedButton.day')}" selected></md-segmented-button>
        <md-segmented-button value="week" label="${t(globals.locale, 'segmentedButton.week')}"></md-segmented-button>
        <md-segmented-button value="month" label="${t(globals.locale, 'segmentedButton.month')}"></md-segmented-button>
      </md-segmented-button-set>

      <p style="${HEADING}; color:#CAC4D0;">With icons</p>
      <md-segmented-button-set>
        <md-segmented-button value="car" icon="directions_car" label="${t(globals.locale, 'segmentedButton.car')}" selected></md-segmented-button>
        <md-segmented-button value="bus" icon="directions_bus" label="${t(globals.locale, 'segmentedButton.bus')}"></md-segmented-button>
        <md-segmented-button value="train" icon="train" label="${t(globals.locale, 'segmentedButton.train')}"></md-segmented-button>
      </md-segmented-button-set>

      <p style="${HEADING}; color:#CAC4D0;">Disabled</p>
      <md-segmented-button-set>
        <md-segmented-button value="a" label="Alpha" selected disabled></md-segmented-button>
        <md-segmented-button value="b" label="Beta" disabled></md-segmented-button>
        <md-segmented-button value="c" label="Gamma" disabled></md-segmented-button>
      </md-segmented-button-set>
    </div>
  `,
};

/* ==========================================================
   KEYBOARD & DISABLED (interaction coverage)
   ========================================================== */
export const KeyboardAndDisabled: Story = {
  name: 'Keyboard & Disabled',
  render: () => html`
    <div style="${SECTION}">
      <p style="${HEADING}">Disabled segment is inert; arrow keys skip over it</p>
      <md-segmented-button-set aria-label="Priority">
        <md-segmented-button value="a" label="Alpha" selected></md-segmented-button>
        <md-segmented-button value="b" label="Beta"></md-segmented-button>
        <md-segmented-button value="c" label="Gamma" disabled></md-segmented-button>
        <md-segmented-button value="d" label="Delta"></md-segmented-button>
      </md-segmented-button-set>
    </div>
  `,
  /** Disabled segments must not activate by pointer or keyboard, and arrow
   *  navigation must hop over them to the next enabled segment. */
  play: async ({ canvasElement, step }) => {
    const set = await getSet(canvasElement);
    const a = getSegment(set, 'a');
    const b = getSegment(set, 'b');
    const c = getSegment(set, 'c'); // disabled
    const d = getSegment(set, 'd');
    await waitFor(() => {
      expect(a.classList.contains('hydrated')).toBe(true);
      expect(c.classList.contains('hydrated')).toBe(true);
    });

    await step('Disabled segment reflects aria-disabled and drops out of the tab order', async () => {
      expect(c.getAttribute('aria-disabled')).toBe('true');
      expect(c.getAttribute('tabindex')).toBe('-1');
      // Enabled peers remain reachable by Tab.
      expect(a.getAttribute('tabindex')).toBe('0');
      expect(selectedValues(set)).toEqual(['a']);
    });

    await step('Clicking a disabled segment is a no-op — no selection, no mdChange', async () => {
      let emitted = false;
      set.addEventListener('mdChange', () => { emitted = true; }, { once: true });

      c.click(); // handleClick short-circuits synchronously for a disabled segment

      expect(c.getAttribute('aria-checked')).toBe('false');
      expect(selectedValues(set)).toEqual(['a']); // unchanged
      expect(emitted).toBe(false);
    });

    await step('Enter on a disabled segment does not activate it', async () => {
      let emitted = false;
      set.addEventListener('mdChange', () => { emitted = true; }, { once: true });

      c.focus(); // tabindex="-1" still allows programmatic focus
      key(c, 'Enter');

      expect(c.getAttribute('aria-checked')).toBe('false');
      expect(emitted).toBe(false);
    });

    await step('ArrowRight hops over the disabled segment to the next enabled one', async () => {
      b.focus();
      await waitFor(() => expect(document.activeElement).toBe(b));
      let detail: string[] | undefined;
      set.addEventListener('mdChange', (e) => { detail = (e as CustomEvent<string[]>).detail; }, { once: true });

      key(b, 'ArrowRight'); // b → (skip disabled c) → d

      await waitFor(() => expect(document.activeElement).toBe(d));
      await waitFor(() => expect(d.getAttribute('aria-checked')).toBe('true'));
      expect(c.getAttribute('aria-checked')).toBe('false'); // never landed on / selected
      expect(detail).toEqual(['d']);
    });

    await step('Drop focus so the resting view has no lingering keyboard focus ring', async () => {
      // The ArrowRight nav above leaves Delta keyboard-focused, so its 3px
      // :focus-visible ring persists in the static/screenshot view and reads as a
      // heavy dark border on the last segment. Blur for a clean resting baseline.
      d.blur();
      await waitFor(() => expect(document.activeElement).not.toBe(d));
    });
  },
};
