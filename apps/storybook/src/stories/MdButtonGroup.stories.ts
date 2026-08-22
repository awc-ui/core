import type { Meta, StoryObj } from '@storybook/web-components';
import { expect, waitFor } from 'storybook/test';
import { html } from 'lit';
import { t } from '../i18n';

/** Shadow-piercing / hydration helpers for play(): testing-library can't cross
 *  shadow roots, and pre-hydration clicks on Stencil hosts are silent no-ops —
 *  so we gate every group and its children on `.hydrated`, then read the
 *  reflected `aria-pressed` attributes (which land on the NEXT render flush). */
type ChangeDetail = { values: string[]; added: string[]; removed: string[] };
const getGroups = async (canvasElement: HTMLElement): Promise<HTMLElement[]> => {
  const groups = [...canvasElement.querySelectorAll('md-button-group')] as HTMLElement[];
  await waitFor(() => {
    expect(groups.length).toBeGreaterThan(0);
    groups.forEach((g) => {
      expect(g.classList.contains('hydrated')).toBe(true);
      const kids = g.querySelectorAll('md-button, md-icon-button');
      expect(kids.length).toBeGreaterThan(0);
      kids.forEach((b) => {
        expect(b.classList.contains('hydrated')).toBe(true);
        // The group sets `toggle=true` on every child; once that flush lands
        // each child reflects aria-pressed, so later 'true'/'false' reads are real.
        expect(b.getAttribute('aria-pressed')).not.toBeNull();
      });
    });
  });
  return groups;
};
const btn = (group: HTMLElement, value: string) =>
  group.querySelector(`[value="${value}"]`) as HTMLElement;
const pressed = (el: HTMLElement) => el.getAttribute('aria-pressed');
const pressedCount = (group: HTMLElement) =>
  group.querySelectorAll('[aria-pressed="true"]').length;

const meta: Meta = {
  title: 'Actions/Button Group',
  component: 'md-button-group',
  tags: ['autodocs'],
  parameters: {
    docs: {
      source: { type: 'code', language: 'html' },
    },
  },
  argTypes: {
    variant: { control: 'select', options: ['standard', 'connected'] },
    size: { control: 'select', options: ['xs', 'sm', 'md', 'lg', 'xl'] },
    shape: { control: 'inline-radio', options: ['round', 'square'] },
    selectionMode: { control: 'select', options: ['single-select', 'multi-select'] },
    required: { control: 'boolean' },
    fullWidth: { control: 'boolean' },
  },
  args: {
    variant: 'standard',
    size: 'sm',
    shape: 'round',
    selectionMode: 'single-select',
    required: false,
    fullWidth: false,
  },
};
export default meta;
type Story = StoryObj;

const SECTION = 'padding:24px; font-family: Roboto, sans-serif;';
const HEADING = 'color:#49454F; margin:20px 0 8px; font-size:13px; font-weight:500; text-transform:uppercase; letter-spacing:0.5px;';
const ROW = 'display:flex; gap:16px; flex-wrap:wrap; align-items:center;';
const sizes = ['xs', 'sm', 'md', 'lg', 'xl'] as const;

/* ==========================================================
   PLAYGROUND
   ========================================================== */
export const Playground: Story = {
  render: (args) => html`
    <div style="${SECTION}">
      <md-button-group
        variant="${args.variant}"
        size="${args.size}"
        shape="${args.shape}"
        selection-mode="${args.selectionMode}"
        ?required="${args.required}"
        ?full-width="${args.fullWidth}"
      >
        <md-button variant="tonal" value="a">Option A</md-button>
        <md-button variant="tonal" value="b">Option B</md-button>
        <md-button variant="tonal" value="c">Option C</md-button>
      </md-button-group>
    </div>
  `,
};

/* ==========================================================
   SELECTION MODES
   ========================================================== */
export const SelectionModes: Story = {
  name: 'Selection Modes',
  render: (_args, { globals }) => html`
    <div style="${SECTION}">
      <p style="${HEADING}">Single-select (one at a time, click again to deselect)</p>
      <div style="${ROW}">
        <md-button-group variant="connected" size="sm" shape="round" selection-mode="single-select">
          <md-button variant="tonal" value="day">${t(globals.locale, 'buttonGroup.day')}</md-button>
          <md-button variant="tonal" value="week">${t(globals.locale, 'buttonGroup.week')}</md-button>
          <md-button variant="tonal" value="month">${t(globals.locale, 'buttonGroup.month')}</md-button>
        </md-button-group>
      </div>

      <p style="${HEADING}">Single-select + required (always one active)</p>
      <div style="${ROW}">
        <md-button-group variant="connected" size="sm" shape="round" selection-mode="single-select" required>
          <md-button variant="tonal" value="list" icon="view_list" selected>${t(globals.locale, 'buttonGroup.list')}</md-button>
          <md-button variant="tonal" value="grid" icon="grid_view">${t(globals.locale, 'buttonGroup.grid')}</md-button>
          <md-button variant="tonal" value="module" icon="view_module">${t(globals.locale, 'buttonGroup.module')}</md-button>
        </md-button-group>
      </div>

      <p style="${HEADING}">Multi-select (toggle each independently)</p>
      <div style="${ROW}">
        <md-button-group variant="connected" size="sm" shape="round" selection-mode="multi-select">
          <md-button variant="tonal" value="bold" icon="format_bold">${t(globals.locale, 'buttonGroup.bold')}</md-button>
          <md-button variant="tonal" value="italic" icon="format_italic">${t(globals.locale, 'buttonGroup.italic')}</md-button>
          <md-button variant="tonal" value="underline" icon="format_underlined">${t(globals.locale, 'buttonGroup.underline')}</md-button>
        </md-button-group>
      </div>

      <p style="${HEADING}">Multi-select + required (at least one stays active)</p>
      <div style="${ROW}">
        <md-button-group variant="connected" size="sm" shape="round" selection-mode="multi-select" required>
          <md-button variant="tonal" value="bold" icon="format_bold" selected>${t(globals.locale, 'buttonGroup.bold')}</md-button>
          <md-button variant="tonal" value="italic" icon="format_italic">${t(globals.locale, 'buttonGroup.italic')}</md-button>
          <md-button variant="tonal" value="underline" icon="format_underlined">${t(globals.locale, 'buttonGroup.underline')}</md-button>
        </md-button-group>
      </div>
    </div>
  `,
  /** Single-select swaps (picking one deselects the other); multi-select
   *  accumulates (two coexist). Each step captures the mdSelectionChange
   *  payload AND asserts the before→after aria-pressed transition. */
  play: async ({ canvasElement, step }) => {
    const groups = await getGroups(canvasElement);
    const single = groups[0]; // Day / Week / Month — selection-mode="single-select"
    const multi = groups[2]; // Bold / Italic / Underline — selection-mode="multi-select"

    await step('Single-select: picking Day emits its value and presses it', async () => {
      const day = btn(single, 'day');
      expect(pressed(day)).toBe('false'); // nothing selected on entry
      let detail: ChangeDetail | undefined;
      single.addEventListener('mdSelectionChange', (e) => { detail = (e as CustomEvent).detail; }, { once: true });
      day.click();
      await waitFor(() => expect(pressed(day)).toBe('true')); // reflected next flush
      expect(detail?.added).toEqual(['day']);
      expect(detail?.values).toEqual(['day']);
      expect(pressedCount(single)).toBe(1);
    });

    await step('Single-select: picking Week deselects Day (swap, not accumulate)', async () => {
      const day = btn(single, 'day');
      const week = btn(single, 'week');
      expect(pressed(day)).toBe('true'); // Day is the live selection from the prior step
      let detail: ChangeDetail | undefined;
      single.addEventListener('mdSelectionChange', (e) => { detail = (e as CustomEvent).detail; }, { once: true });
      week.click();
      await waitFor(() => expect(pressed(week)).toBe('true'));
      await waitFor(() => expect(pressed(day)).toBe('false')); // the group swapped it off
      expect(detail?.added).toEqual(['week']);
      expect(detail?.removed).toEqual(['day']);
      expect(detail?.values).toEqual(['week']);
      expect(pressedCount(single)).toBe(1); // never more than one in single-select
    });

    await step('Multi-select: two buttons stay pressed together', async () => {
      const bold = btn(multi, 'bold');
      const italic = btn(multi, 'italic');
      expect(pressedCount(multi)).toBe(0); // starts empty
      bold.click();
      await waitFor(() => expect(pressed(bold)).toBe('true'));
      let detail: ChangeDetail | undefined;
      multi.addEventListener('mdSelectionChange', (e) => { detail = (e as CustomEvent).detail; }, { once: true });
      italic.click(); // adds — does NOT clear bold
      await waitFor(() => expect(pressed(italic)).toBe('true'));
      expect(pressed(bold)).toBe('true'); // still on — the set grew rather than swapped
      expect(detail?.added).toEqual(['italic']);
      expect(detail?.values).toEqual(['bold', 'italic']);
      expect(pressedCount(multi)).toBe(2);
    });

    await step('Guard: re-clicking a pressed multi button toggles only it off', async () => {
      const bold = btn(multi, 'bold');
      let detail: ChangeDetail | undefined;
      multi.addEventListener('mdSelectionChange', (e) => { detail = (e as CustomEvent).detail; }, { once: true });
      bold.click(); // independent toggle — italic must survive
      await waitFor(() => expect(pressed(bold)).toBe('false'));
      expect(detail?.removed).toEqual(['bold']);
      expect(detail?.values).toEqual(['italic']);
      expect(pressedCount(multi)).toBe(1); // italic remains selected
    });

    await step('Home / End move the roving tab stop to the last / first child', async () => {
      const day = btn(single, 'day');
      const week = btn(single, 'week');
      const month = btn(single, 'month');
      // End jumps to the last child regardless of which button is currently active.
      week.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
      await waitFor(() => {
        expect(month.getAttribute('tabindex')).toBe('0'); // last child now owns the single tab stop
        expect(day.getAttribute('tabindex')).toBe('-1');
        expect(week.getAttribute('tabindex')).toBe('-1');
      });
      // Home jumps back to the first child.
      month.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
      await waitFor(() => {
        expect(day.getAttribute('tabindex')).toBe('0');
        expect(month.getAttribute('tabindex')).toBe('-1');
      });
    });

    await step('Arrow keys move the roving focus to an adjacent child (and back)', async () => {
      const day = btn(single, 'day'); // active from the Home step above
      const zeros = () => [...single.querySelectorAll('md-button')].filter(b => b.getAttribute('tabindex') === '0');
      day.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      await waitFor(() => {
        expect(zeros().length).toBe(1); // still exactly one tab stop after moving
        expect(zeros()[0]).not.toBe(day); // ...and it left 'day'
      });
      // ArrowLeft is the exact inverse of ArrowRight in either text direction -> lands back on 'day'.
      zeros()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
      await waitFor(() => {
        expect(zeros().length).toBe(1);
        expect(zeros()[0]).toBe(day);
      });
    });

    await step('Focusing a child moves the roving tab stop (focusin)', async () => {
      const day = btn(single, 'day'); // active from the arrow step above
      const week = btn(single, 'week');
      week.focus();
      await waitFor(() => {
        expect(week.getAttribute('tabindex')).toBe('0'); // focus promoted week to the tab stop
        expect(day.getAttribute('tabindex')).toBe('-1');
      });
    });

    await step('required single-select restores the button when you deselect the last one', async () => {
      const req = groups[1]; // list(selected) / grid / module — single-select + required
      const list = btn(req, 'list');
      await waitFor(() => expect(pressed(list)).toBe('true')); // seeded selected
      let detail: ChangeDetail | undefined;
      req.addEventListener('mdSelectionChange', (e) => { detail = (e as CustomEvent).detail; }, { once: true });
      list.click(); // the child toggles itself off; the group re-selects it because required
      await waitFor(() => expect(pressed(list)).toBe('true')); // never left unselected
      expect(pressedCount(req)).toBe(1);
      expect(detail?.values).toEqual(['list']); // still the live selection
    });

    await step('Adding a child re-syncs connected edges via the MutationObserver', async () => {
      const month = btn(single, 'month'); // currently the last child of the connected group
      await waitFor(() => expect(month.hasAttribute('connected-right')).toBe(false)); // last -> no inner right edge
      const extra = document.createElement('md-button');
      extra.setAttribute('variant', 'tonal');
      extra.setAttribute('value', 'quarter');
      extra.textContent = 'Quarter';
      single.appendChild(extra); // childList mutation -> the group re-runs syncChildren
      // month is no longer last, so syncChildren gives it an inner (connected) right edge.
      await waitFor(() => expect(month.hasAttribute('connected-right')).toBe(true));
      // the freshly added child is adopted by the group (toggle=true -> aria-pressed now reflects).
      await waitFor(() => expect(extra.getAttribute('aria-pressed')).not.toBeNull());
    });

    await step('Changing the variant prop re-runs syncChildren (@Watch)', async () => {
      const req = groups[1]; // connected list / grid / module
      const grid = btn(req, 'grid'); // middle child -> both inner edges while connected
      await waitFor(() => {
        expect(grid.hasAttribute('connected-left')).toBe(true);
        expect(grid.hasAttribute('connected-right')).toBe(true);
      });
      req.setAttribute('variant', 'standard'); // @Watch(variant) -> onPropsChange -> syncChildren clears the edges
      await waitFor(() => {
        expect(grid.hasAttribute('connected-left')).toBe(false);
        expect(grid.hasAttribute('connected-right')).toBe(false);
      });
    });
  },
};

/* ==========================================================
   STANDARD — All sizes
   ========================================================== */
export const Standard: Story = {
  name: 'Standard',
  render: () => html`
    <div style="${SECTION}">
      <p style="${HEADING}">Round — all sizes (gap: XS 18px, SM 12px, MD–XL 8px)</p>
      ${sizes.map(s => html`
        <div style="${ROW}; margin-bottom:12px;">
          <span style="width:24px; font-size:11px; color:#49454F; font-weight:600;">${s.toUpperCase()}</span>
          <md-button-group variant="standard" size="${s}" shape="round">
            <md-button variant="tonal" value="a">First</md-button>
            <md-button variant="tonal" value="b">Second</md-button>
            <md-button variant="tonal" value="c">Third</md-button>
          </md-button-group>
        </div>
      `)}

      <p style="${HEADING}">Square</p>
      <div style="${ROW}">
        <md-button-group variant="standard" size="md" shape="square">
          <md-button variant="tonal" value="a">Option A</md-button>
          <md-button variant="tonal" value="b">Option B</md-button>
          <md-button variant="tonal" value="c">Option C</md-button>
        </md-button-group>
      </div>

      <p style="${HEADING}">Icon buttons — round — all sizes</p>
      ${sizes.map(s => html`
        <div style="${ROW}; margin-bottom:12px;">
          <span style="width:24px; font-size:11px; color:#49454F; font-weight:600;">${s.toUpperCase()}</span>
          <md-button-group variant="standard" size="${s}" shape="round">
            <md-icon-button variant="filled" value="a" icon="format_bold" aria-label="Bold"></md-icon-button>
            <md-icon-button variant="filled" value="b" icon="format_italic" aria-label="Italic"></md-icon-button>
            <md-icon-button variant="filled" value="c" icon="format_underlined" aria-label="Underline"></md-icon-button>
          </md-button-group>
        </div>
      `)}

      <p style="${HEADING}">Icon buttons — square</p>
      <div style="${ROW}">
        <md-button-group variant="standard" size="md" shape="square">
          <md-icon-button variant="tonal" value="a" icon="format_align_left" aria-label="Align left"></md-icon-button>
          <md-icon-button variant="tonal" value="b" icon="format_align_center" aria-label="Align center"></md-icon-button>
          <md-icon-button variant="tonal" value="c" icon="format_align_right" aria-label="Align right"></md-icon-button>
          <md-icon-button variant="tonal" value="d" icon="format_align_justify" aria-label="Justify"></md-icon-button>
        </md-button-group>
      </div>
    </div>
  `,
};

/* ==========================================================
   CONNECTED — All sizes
   ========================================================== */
export const Connected: Story = {
  name: 'Connected',
  render: (_args, { globals }) => html`
    <div style="${SECTION}">
      <p style="color:#49454F; margin:0 0 16px; font-size:13px; line-height:1.6;">
        Connected groups fuse buttons with <strong>2px</strong> inner padding at every size.
        <strong>Round</strong> outer edges are fully round; inner edges use size-dependent radii
        (XS 4, SM 8, MD 8, LG 16, XL 20).
        <strong>Square</strong> outer edges use the same size-dependent radii.
        XS and SM enforce a <strong>48px minimum width</strong> for touch targets.
      </p>

      <p style="${HEADING}">Round — all sizes (outer: fully round, inner: size-dependent)</p>
      ${sizes.map(s => html`
        <div style="${ROW}; margin-bottom:12px;">
          <span style="width:24px; font-size:11px; color:#49454F; font-weight:600;">${s.toUpperCase()}</span>
          <md-button-group variant="connected" size="${s}" shape="round">
            <md-button variant="tonal" value="a">First</md-button>
            <md-button variant="tonal" value="b">Second</md-button>
            <md-button variant="tonal" value="c">Third</md-button>
          </md-button-group>
        </div>
      `)}

      <p style="${HEADING}">Square — all sizes (outer: size-dependent radii)</p>
      ${sizes.map(s => html`
        <div style="${ROW}; margin-bottom:12px;">
          <span style="width:24px; font-size:11px; color:#49454F; font-weight:600;">${s.toUpperCase()}</span>
          <md-button-group variant="connected" size="${s}" shape="square">
            <md-button variant="tonal" value="a">First</md-button>
            <md-button variant="tonal" value="b">Second</md-button>
            <md-button variant="tonal" value="c">Third</md-button>
          </md-button-group>
        </div>
      `)}

      <p style="${HEADING}">Icon buttons — round — all sizes</p>
      ${sizes.map(s => html`
        <div style="${ROW}; margin-bottom:12px;">
          <span style="width:24px; font-size:11px; color:#49454F; font-weight:600;">${s.toUpperCase()}</span>
          <md-button-group variant="connected" size="${s}" shape="round">
            <md-icon-button variant="tonal" value="a" icon="format_bold" aria-label="Bold"></md-icon-button>
            <md-icon-button variant="tonal" value="b" icon="format_italic" aria-label="Italic"></md-icon-button>
            <md-icon-button variant="tonal" value="c" icon="format_underlined" aria-label="Underline"></md-icon-button>
          </md-button-group>
        </div>
      `)}

      <p style="${HEADING}">Icon buttons — square — all sizes</p>
      ${sizes.map(s => html`
        <div style="${ROW}; margin-bottom:12px;">
          <span style="width:24px; font-size:11px; color:#49454F; font-weight:600;">${s.toUpperCase()}</span>
          <md-button-group variant="connected" size="${s}" shape="square">
            <md-icon-button variant="tonal" value="a" icon="format_align_left" aria-label="Align left"></md-icon-button>
            <md-icon-button variant="tonal" value="b" icon="format_align_center" aria-label="Align center"></md-icon-button>
            <md-icon-button variant="tonal" value="c" icon="format_align_right" aria-label="Align right"></md-icon-button>
          </md-button-group>
        </div>
      `)}

      <p style="${HEADING}">Minimum width — XS/SM icon buttons (48px target area)</p>
      <div style="${ROW}; margin-bottom:12px;">
        <span style="width:24px; font-size:11px; color:#49454F; font-weight:600;">XS</span>
        <md-button-group variant="connected" size="xs" shape="round">
          <md-icon-button variant="tonal" value="a" icon="home" aria-label="Home"></md-icon-button>
          <md-icon-button variant="tonal" value="b" icon="search" aria-label="Search"></md-icon-button>
          <md-icon-button variant="tonal" value="c" icon="settings" aria-label="Settings"></md-icon-button>
        </md-button-group>
      </div>
      <div style="${ROW}; margin-bottom:12px;">
        <span style="width:24px; font-size:11px; color:#49454F; font-weight:600;">SM</span>
        <md-button-group variant="connected" size="sm" shape="round">
          <md-icon-button variant="tonal" value="a" icon="home" aria-label="Home"></md-icon-button>
          <md-icon-button variant="tonal" value="b" icon="search" aria-label="Search"></md-icon-button>
          <md-icon-button variant="tonal" value="c" icon="settings" aria-label="Settings"></md-icon-button>
        </md-button-group>
      </div>

      <p style="${HEADING}">Two buttons — round / square</p>
      <div style="${ROW}; margin-bottom:12px;">
        <md-button-group variant="connected" size="sm" shape="round">
          <md-button variant="tonal" value="a">${t(globals.locale, 'buttonGroup.yes')}</md-button>
          <md-button variant="tonal" value="b">${t(globals.locale, 'buttonGroup.no')}</md-button>
        </md-button-group>
        <md-button-group variant="connected" size="sm" shape="square">
          <md-button variant="tonal" value="a">${t(globals.locale, 'buttonGroup.yes')}</md-button>
          <md-button variant="tonal" value="b">${t(globals.locale, 'buttonGroup.no')}</md-button>
        </md-button-group>
      </div>

      <p style="${HEADING}">Single button (all outer radii)</p>
      <div style="${ROW}; margin-bottom:12px;">
        <md-button-group variant="connected" size="sm" shape="round">
          <md-button variant="tonal" value="a">Only</md-button>
        </md-button-group>
        <md-button-group variant="connected" size="sm" shape="square">
          <md-button variant="tonal" value="a">Only</md-button>
        </md-button-group>
      </div>

      <p style="${HEADING}">Five buttons (many inner segments)</p>
      <div style="${ROW}; margin-bottom:12px;">
        <md-button-group variant="connected" size="sm" shape="round">
          <md-button variant="tonal" value="a">${t(globals.locale, 'buttonGroup.mon')}</md-button>
          <md-button variant="tonal" value="b">${t(globals.locale, 'buttonGroup.tue')}</md-button>
          <md-button variant="tonal" value="c">${t(globals.locale, 'buttonGroup.wed')}</md-button>
          <md-button variant="tonal" value="d">${t(globals.locale, 'buttonGroup.thu')}</md-button>
          <md-button variant="tonal" value="e">${t(globals.locale, 'buttonGroup.fri')}</md-button>
        </md-button-group>
      </div>

      <p style="${HEADING}">No motion animation (click to verify — shape only, no neighbor effects)</p>
      <div style="${ROW}; margin-bottom:12px;">
        <md-button-group variant="connected" size="md" shape="round" selection-mode="single-select">
          <md-button variant="tonal" value="a">Option A</md-button>
          <md-button variant="tonal" value="b">Option B</md-button>
          <md-button variant="tonal" value="c">Option C</md-button>
        </md-button-group>
      </div>
    </div>
  `,
};

/* ==========================================================
   BUTTON VARIANTS
   ========================================================== */
export const ButtonVariants: Story = {
  name: 'Button Variants',
  render: () => html`
    <div style="${SECTION}">
      <p style="${HEADING}">Filled — standard</p>
      <div style="${ROW}; margin-bottom:12px;">
        <md-button-group variant="standard" size="sm" shape="round">
          <md-button variant="filled" value="a">First</md-button>
          <md-button variant="filled" value="b">Second</md-button>
          <md-button variant="filled" value="c">Third</md-button>
        </md-button-group>
      </div>

      <p style="${HEADING}">Filled — connected</p>
      <div style="${ROW}; margin-bottom:12px;">
        <md-button-group variant="connected" size="sm" shape="round">
          <md-button variant="filled" value="a">First</md-button>
          <md-button variant="filled" value="b">Second</md-button>
          <md-button variant="filled" value="c">Third</md-button>
        </md-button-group>
      </div>

      <p style="${HEADING}">Tonal — standard</p>
      <div style="${ROW}; margin-bottom:12px;">
        <md-button-group variant="standard" size="sm" shape="round">
          <md-button variant="tonal" value="a">First</md-button>
          <md-button variant="tonal" value="b">Second</md-button>
          <md-button variant="tonal" value="c">Third</md-button>
        </md-button-group>
      </div>

      <p style="${HEADING}">Tonal — connected</p>
      <div style="${ROW}; margin-bottom:12px;">
        <md-button-group variant="connected" size="sm" shape="round">
          <md-button variant="tonal" value="a">First</md-button>
          <md-button variant="tonal" value="b">Second</md-button>
          <md-button variant="tonal" value="c">Third</md-button>
        </md-button-group>
      </div>

      <p style="${HEADING}">Outlined — standard</p>
      <div style="${ROW}; margin-bottom:12px;">
        <md-button-group variant="standard" size="sm" shape="round">
          <md-button variant="outlined" value="a">First</md-button>
          <md-button variant="outlined" value="b">Second</md-button>
          <md-button variant="outlined" value="c">Third</md-button>
        </md-button-group>
      </div>

      <p style="${HEADING}">Outlined — connected</p>
      <div style="${ROW}; margin-bottom:12px;">
        <md-button-group variant="connected" size="sm" shape="round">
          <md-button variant="outlined" value="a">First</md-button>
          <md-button variant="outlined" value="b">Second</md-button>
          <md-button variant="outlined" value="c">Third</md-button>
        </md-button-group>
      </div>

      <p style="${HEADING}">Elevated — standard</p>
      <div style="${ROW}; margin-bottom:12px;">
        <md-button-group variant="standard" size="sm" shape="round">
          <md-button variant="elevated" value="a">First</md-button>
          <md-button variant="elevated" value="b">Second</md-button>
          <md-button variant="elevated" value="c">Third</md-button>
        </md-button-group>
      </div>

      <p style="${HEADING}">Elevated — connected</p>
      <div style="${ROW}; margin-bottom:12px;">
        <md-button-group variant="connected" size="sm" shape="round">
          <md-button variant="elevated" value="a">First</md-button>
          <md-button variant="elevated" value="b">Second</md-button>
          <md-button variant="elevated" value="c">Third</md-button>
        </md-button-group>
      </div>

      <p style="${HEADING}">Icon buttons — filled</p>
      <div style="${ROW}; margin-bottom:12px;">
        <md-button-group variant="standard" size="sm" shape="round">
          <md-icon-button variant="filled" value="a" icon="play_arrow" aria-label="Play"></md-icon-button>
          <md-icon-button variant="filled" value="b" icon="pause" aria-label="Pause"></md-icon-button>
          <md-icon-button variant="filled" value="c" icon="stop" aria-label="Stop"></md-icon-button>
        </md-button-group>
        <md-button-group variant="connected" size="sm" shape="round">
          <md-icon-button variant="filled" value="a" icon="play_arrow" aria-label="Play"></md-icon-button>
          <md-icon-button variant="filled" value="b" icon="pause" aria-label="Pause"></md-icon-button>
          <md-icon-button variant="filled" value="c" icon="stop" aria-label="Stop"></md-icon-button>
        </md-button-group>
      </div>

      <p style="${HEADING}">Icon buttons — tonal</p>
      <div style="${ROW}; margin-bottom:12px;">
        <md-button-group variant="standard" size="sm" shape="round">
          <md-icon-button variant="tonal" value="a" icon="thumb_up" aria-label="Like"></md-icon-button>
          <md-icon-button variant="tonal" value="b" icon="thumb_down" aria-label="Dislike"></md-icon-button>
          <md-icon-button variant="tonal" value="c" icon="bookmark" aria-label="Bookmark"></md-icon-button>
        </md-button-group>
        <md-button-group variant="connected" size="sm" shape="round">
          <md-icon-button variant="tonal" value="a" icon="thumb_up" aria-label="Like"></md-icon-button>
          <md-icon-button variant="tonal" value="b" icon="thumb_down" aria-label="Dislike"></md-icon-button>
          <md-icon-button variant="tonal" value="c" icon="bookmark" aria-label="Bookmark"></md-icon-button>
        </md-button-group>
      </div>

      <p style="${HEADING}">Icon buttons — outlined</p>
      <div style="${ROW}; margin-bottom:12px;">
        <md-button-group variant="standard" size="sm" shape="round">
          <md-icon-button variant="outlined" value="a" icon="share" aria-label="Share"></md-icon-button>
          <md-icon-button variant="outlined" value="b" icon="link" aria-label="Copy link"></md-icon-button>
          <md-icon-button variant="outlined" value="c" icon="content_copy" aria-label="Copy"></md-icon-button>
        </md-button-group>
        <md-button-group variant="connected" size="sm" shape="round">
          <md-icon-button variant="outlined" value="a" icon="share" aria-label="Share"></md-icon-button>
          <md-icon-button variant="outlined" value="b" icon="link" aria-label="Copy link"></md-icon-button>
          <md-icon-button variant="outlined" value="c" icon="content_copy" aria-label="Copy"></md-icon-button>
        </md-button-group>
      </div>
    </div>
  `,
};

/* ==========================================================
   MIXED CONTENT
   ========================================================== */
export const MixedContent: Story = {
  name: 'Mixed Content',
  render: (_args, { globals }) => html`
    <div style="${SECTION}">
      <p style="${HEADING}">Label + icon buttons — standard</p>
      <div style="${ROW}; margin-bottom:12px;">
        <md-button-group variant="standard" size="sm" shape="round">
          <md-button variant="tonal" value="a" icon="edit">${t(globals.locale, 'edit')}</md-button>
          <md-icon-button variant="tonal" value="b" icon="delete" aria-label="Delete"></md-icon-button>
          <md-button variant="tonal" value="c" icon="share">${t(globals.locale, 'buttonGroup.share')}</md-button>
        </md-button-group>
      </div>

      <p style="${HEADING}">Label + icon buttons — connected</p>
      <div style="${ROW}; margin-bottom:12px;">
        <md-button-group variant="connected" size="sm" shape="round">
          <md-button variant="tonal" value="a">Label A</md-button>
          <md-icon-button variant="tonal" value="b" icon="favorite" aria-label="Favorite"></md-icon-button>
          <md-button variant="tonal" value="c">Label C</md-button>
        </md-button-group>
      </div>

      <p style="${HEADING}">Two buttons</p>
      <div style="${ROW}; margin-bottom:12px;">
        <md-button-group variant="standard" size="sm" shape="round">
          <md-button variant="tonal" value="a">${t(globals.locale, 'buttonGroup.yes')}</md-button>
          <md-button variant="tonal" value="b">${t(globals.locale, 'buttonGroup.no')}</md-button>
        </md-button-group>
        <md-button-group variant="connected" size="sm" shape="round">
          <md-icon-button variant="filled" value="a" icon="check" aria-label="Confirm"></md-icon-button>
          <md-icon-button variant="filled" value="b" icon="close" aria-label="Close"></md-icon-button>
        </md-button-group>
      </div>

      <p style="${HEADING}">Five buttons</p>
      <div style="${ROW}; margin-bottom:12px;">
        <md-button-group variant="standard" size="sm" shape="round">
          <md-button variant="tonal" value="a">${t(globals.locale, 'buttonGroup.mon')}</md-button>
          <md-button variant="tonal" value="b">${t(globals.locale, 'buttonGroup.tue')}</md-button>
          <md-button variant="tonal" value="c">${t(globals.locale, 'buttonGroup.wed')}</md-button>
          <md-button variant="tonal" value="d">${t(globals.locale, 'buttonGroup.thu')}</md-button>
          <md-button variant="tonal" value="e">${t(globals.locale, 'buttonGroup.fri')}</md-button>
        </md-button-group>
      </div>
      <div style="${ROW}; margin-bottom:12px;">
        <md-button-group variant="connected" size="sm" shape="round">
          <md-button variant="tonal" value="a">${t(globals.locale, 'buttonGroup.mon')}</md-button>
          <md-button variant="tonal" value="b">${t(globals.locale, 'buttonGroup.tue')}</md-button>
          <md-button variant="tonal" value="c">${t(globals.locale, 'buttonGroup.wed')}</md-button>
          <md-button variant="tonal" value="d">${t(globals.locale, 'buttonGroup.thu')}</md-button>
          <md-button variant="tonal" value="e">${t(globals.locale, 'buttonGroup.fri')}</md-button>
        </md-button-group>
      </div>
    </div>
  `,
};

/* ==========================================================
   TOGGLE COLORS — Selected vs Unselected
   ========================================================== */
export const ToggleColors: Story = {
  name: 'Toggle Colors',
  render: (_args, { globals }) => html`
    <div style="${SECTION}">
      <p style="color:#49454F; margin:0 0 16px; font-size:13px; line-height:1.6;">
        Buttons inside a group get <code>toggle=true</code> automatically.
        The <strong>selected</strong> button shows the full variant color;
        <strong>unselected</strong> buttons are muted.
      </p>

      <p style="${HEADING}">Filled</p>
      <div style="${ROW}; margin-bottom:12px;">
        <md-button-group variant="connected" size="sm" shape="round" selection-mode="single-select">
          <md-button variant="filled" value="a" selected>${t(globals.locale, 'buttonGroup.selected')}</md-button>
          <md-button variant="filled" value="b">${t(globals.locale, 'buttonGroup.unselected')}</md-button>
          <md-button variant="filled" value="c">${t(globals.locale, 'buttonGroup.unselected')}</md-button>
        </md-button-group>
      </div>

      <p style="${HEADING}">Tonal</p>
      <div style="${ROW}; margin-bottom:12px;">
        <md-button-group variant="connected" size="sm" shape="round" selection-mode="single-select">
          <md-button variant="tonal" value="a" selected>${t(globals.locale, 'buttonGroup.selected')}</md-button>
          <md-button variant="tonal" value="b">${t(globals.locale, 'buttonGroup.unselected')}</md-button>
          <md-button variant="tonal" value="c">${t(globals.locale, 'buttonGroup.unselected')}</md-button>
        </md-button-group>
      </div>

      <p style="${HEADING}">Outlined</p>
      <div style="${ROW}; margin-bottom:12px;">
        <md-button-group variant="connected" size="sm" shape="round" selection-mode="single-select">
          <md-button variant="outlined" value="a" selected>${t(globals.locale, 'buttonGroup.selected')}</md-button>
          <md-button variant="outlined" value="b">${t(globals.locale, 'buttonGroup.unselected')}</md-button>
          <md-button variant="outlined" value="c">${t(globals.locale, 'buttonGroup.unselected')}</md-button>
        </md-button-group>
      </div>

      <p style="${HEADING}">Elevated</p>
      <div style="${ROW}; margin-bottom:12px;">
        <md-button-group variant="standard" size="sm" shape="round" selection-mode="single-select">
          <md-button variant="elevated" value="a" selected>${t(globals.locale, 'buttonGroup.selected')}</md-button>
          <md-button variant="elevated" value="b">${t(globals.locale, 'buttonGroup.unselected')}</md-button>
          <md-button variant="elevated" value="c">${t(globals.locale, 'buttonGroup.unselected')}</md-button>
        </md-button-group>
      </div>

      <p style="${HEADING}">Icon buttons — filled / tonal / outlined</p>
      <div style="${ROW}; margin-bottom:12px;">
        <md-button-group variant="connected" size="sm" shape="round" selection-mode="single-select">
          <md-icon-button variant="filled" value="a" icon="format_bold" aria-label="Bold" selected></md-icon-button>
          <md-icon-button variant="filled" value="b" icon="format_italic" aria-label="Italic"></md-icon-button>
          <md-icon-button variant="filled" value="c" icon="format_underlined" aria-label="Underline"></md-icon-button>
        </md-button-group>
        <md-button-group variant="connected" size="sm" shape="round" selection-mode="single-select">
          <md-icon-button variant="tonal" value="a" icon="format_align_left" aria-label="Align left" selected></md-icon-button>
          <md-icon-button variant="tonal" value="b" icon="format_align_center" aria-label="Align center"></md-icon-button>
          <md-icon-button variant="tonal" value="c" icon="format_align_right" aria-label="Align right"></md-icon-button>
        </md-button-group>
        <md-button-group variant="connected" size="sm" shape="round" selection-mode="single-select">
          <md-icon-button variant="outlined" value="a" icon="view_list" aria-label="List view" selected></md-icon-button>
          <md-icon-button variant="outlined" value="b" icon="grid_view" aria-label="Grid view"></md-icon-button>
          <md-icon-button variant="outlined" value="c" icon="view_module" aria-label="Module view"></md-icon-button>
        </md-button-group>
      </div>

      <p style="${HEADING}">All sizes — icon buttons (tonal, connected)</p>
      ${sizes.map(s => html`
        <div style="${ROW}; margin-bottom:12px;">
          <span style="width:24px; font-size:11px; color:#49454F; font-weight:600;">${s.toUpperCase()}</span>
          <md-button-group variant="connected" size="${s}" shape="round" selection-mode="single-select">
            <md-icon-button variant="tonal" value="a" icon="home" aria-label="Home" selected></md-icon-button>
            <md-icon-button variant="tonal" value="b" icon="search" aria-label="Search"></md-icon-button>
            <md-icon-button variant="tonal" value="c" icon="settings" aria-label="Settings"></md-icon-button>
          </md-button-group>
        </div>
      `)}
    </div>
  `,
};

/* ==========================================================
   PRESS MOTION — Standard variant animation
   ========================================================== */
export const PressMotion: Story = {
  name: 'Press Motion (Standard only)',
  render: () => html`
    <div style="${SECTION}">
      <p style="color:#49454F; margin:0 0 16px; font-size:13px; line-height:1.6;">
        <strong>Standard</strong> groups have a transient press animation.
        Click an unselected button to see it briefly grow while neighbors shrink.
        When <code>required</code> is true, clicking the active button does not animate.
      </p>

      <p style="${HEADING}">Label buttons — all sizes</p>
      ${sizes.map(s => html`
        <div style="${ROW}; margin-bottom:12px;">
          <span style="width:24px; font-size:11px; color:#49454F; font-weight:600;">${s.toUpperCase()}</span>
          <md-button-group variant="standard" size="${s}" shape="round">
            <md-button variant="tonal" value="a">First</md-button>
            <md-button variant="tonal" value="b">Second</md-button>
            <md-button variant="tonal" value="c">Third</md-button>
          </md-button-group>
        </div>
      `)}

      <p style="${HEADING}">Icon buttons — all sizes</p>
      ${sizes.map(s => html`
        <div style="${ROW}; margin-bottom:12px;">
          <span style="width:24px; font-size:11px; color:#49454F; font-weight:600;">${s.toUpperCase()}</span>
          <md-button-group variant="standard" size="${s}" shape="round">
            <md-icon-button variant="filled" value="a" icon="format_bold" aria-label="Bold"></md-icon-button>
            <md-icon-button variant="filled" value="b" icon="format_italic" aria-label="Italic"></md-icon-button>
            <md-icon-button variant="filled" value="c" icon="format_underlined" aria-label="Underline"></md-icon-button>
          </md-button-group>
        </div>
      `)}

      <p style="${HEADING}">With required (no motion on active button)</p>
      <div style="${ROW}">
        <md-button-group variant="standard" size="sm" shape="round" selection-mode="single-select" required>
          <md-button variant="tonal" value="a" selected>Active</md-button>
          <md-button variant="tonal" value="b">Option B</md-button>
          <md-button variant="tonal" value="c">Option C</md-button>
        </md-button-group>
      </div>
    </div>
  `,
  /** Press motion is standard-variant only (the pointerdown / keydown motion
   *  listeners are wired in componentDidLoad just for `variant="standard"`).
   *  onGroupPointerDown / onGroupKeyDown run synchronously during dispatch and
   *  start WAAPI animations, so we assert on a NON-pressed neighbor's live
   *  animations — the neighbor only animates because of the group's motion. */
  play: async ({ canvasElement, step }) => {
    const groups = await getGroups(canvasElement);
    const first = groups[0]; // standard label group (xs): First / Second / Third, nothing selected
    const iconGroup = groups[5]; // standard icon-button group (xs): a / b / c
    const requiredGroup = groups[groups.length - 1]; // standard, single-select + required, 'a' selected

    await step('Pressing a middle button shrinks BOTH neighbors', async () => {
      const a = btn(first, 'a');
      const b = btn(first, 'b'); // middle -> two neighbors
      const c = btn(first, 'c');
      b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); // onGroupPointerDown -> runMotion (sync)
      expect(a.getAnimations().length).toBeGreaterThan(0); // neighbor animates only due to group motion
      expect(c.getAnimations().length).toBeGreaterThan(0);
    });

    await step('Enter on an end button animates its single neighbor', async () => {
      const b = btn(first, 'b');
      const c = btn(first, 'c'); // last -> exactly one neighbor ('b')
      c.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); // onGroupKeyDown (capture) -> runMotion
      expect(b.getAnimations().length).toBeGreaterThan(0); // keyboard activation ran the press motion
    });

    await step('Icon buttons animate via the width branch (non-md-button)', async () => {
      const a = btn(iconGroup, 'a');
      const b = btn(iconGroup, 'b'); // middle icon button
      b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      expect(a.getAnimations().length).toBeGreaterThan(0); // neighbor icon shrinks via width keyframes
    });

    await step('Re-pressing an already-selected button (not required) still animates', async () => {
      const a = btn(first, 'a');
      const b = btn(first, 'b');
      b.click(); // select b (single-select) without firing pointer motion
      await waitFor(() => expect(pressed(b)).toBe('true'));
      b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      expect(a.getAnimations().length).toBeGreaterThan(0); // shouldMotion true: selected but not required
    });

    await step('required: pressing the active button does NOT animate', async () => {
      const active = btn(requiredGroup, 'a'); // selected + required -> shouldMotion returns false
      const neighbor = btn(requiredGroup, 'b');
      // The assertion is "this press STARTS no motion" — but getAnimations()
      // also reports whatever is still mid-flight from earlier steps/stories
      // (the 400ms press motions above outlive their steps, and under a loaded
      // full-suite run they can land on these elements' timeline right up to
      // this line). Clear the deck so only what THIS dispatch starts is
      // measured; runMotion starts its animations synchronously, so a real
      // suppression bug still fails the assertion below.
      for (const el of [active, neighbor, btn(requiredGroup, 'c')]) {
        el.getAnimations().forEach((a) => a.cancel());
      }
      active.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      expect(neighbor.getAnimations().length).toBe(0); // group suppressed the press motion
    });
  },
};

/* ==========================================================
   ACCESSIBILITY — roles, ARIA, keyboard, required semantics
   ========================================================== */
export const Accessibility: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Each section demonstrates a WAI-ARIA pattern that ' +
          '<code>md-button-group</code> implements. Tab into a group and ' +
          'use the keyboard — every state is announced by screen readers.',
      },
    },
  },
  render: () => html`
    <style>
      .a11y { padding: 24px; font-family: Roboto, sans-serif; max-width: 920px; }
      .a11y section { margin-block-end: 32px; }
      .a11y h3 { margin: 0 0 8px; font-size: 16px; color: #1d1b20; }
      .a11y p { margin: 0 0 12px; color: #49454F; font-size: 13px; line-height: 1.6; }
      .a11y code { background: #f7f2fa; padding: 1px 6px; border-radius: 4px; font-size: 12px; }
      .a11y .demo { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; padding: 12px; background: #fef7ff; border-radius: 12px; }
      .a11y kbd {
        display: inline-block;
        padding: 1px 6px;
        font-family: 'JetBrains Mono', ui-monospace, monospace;
        font-size: 11px;
        background: #fff;
        border: 1px solid #cac4d0;
        border-radius: 4px;
        box-shadow: 0 1px 0 #cac4d0;
        color: #1d1b20;
      }
      .a11y ul { margin: 0; padding-inline-start: 20px; color: #49454F; font-size: 13px; line-height: 1.7; }
    </style>

    <div class="a11y">
      <section>
        <h3>1 · Container roles</h3>
        <p>
          The host gets <code>role="radiogroup"</code> for
          <code>single-select</code> (and <code>selection-required</code>)
          modes — semantics that match a "pick exactly one" toolbar — and
          <code>role="group"</code> for <code>multi-select</code>, where
          buttons toggle independently. <code>aria-orientation="horizontal"</code>
          is always set so AT users know arrow keys move horizontally.
        </p>
        <div class="demo">
          <md-button-group selection-mode="single-select">
            <md-button variant="tonal" value="a">Single</md-button>
            <md-button variant="tonal" value="b">select</md-button>
            <md-button variant="tonal" value="c">role</md-button>
          </md-button-group>
          <md-button-group selection-mode="multi-select">
            <md-button variant="tonal" value="a">Multi</md-button>
            <md-button variant="tonal" value="b">select</md-button>
            <md-button variant="tonal" value="c">role</md-button>
          </md-button-group>
        </div>
      </section>

      <section>
        <h3>2 · <code>aria-pressed</code> on each child</h3>
        <p>
          Because every child is automatically toggled (the group sets
          <code>toggle=true</code>), each button reports its selected
          state via <code>aria-pressed="true|false"</code>. A screen
          reader announces "pressed" / "not pressed" alongside the
          visible label.
        </p>
        <div class="demo">
          <md-button-group selection-mode="single-select">
            <md-button variant="tonal" value="a" selected>Active</md-button>
            <md-button variant="tonal" value="b">Inactive</md-button>
            <md-button variant="tonal" value="c">Inactive</md-button>
          </md-button-group>
        </div>
      </section>

      <section>
        <h3>3 · Roving tabindex + keyboard navigation</h3>
        <p>
          The group implements WAI-ARIA's roving-tabindex pattern: only one
          child carries <code>tabindex="0"</code> at any moment (the
          currently-active button), so <kbd>Tab</kbd> enters the group exactly
          once and <kbd>Tab</kbd> again leaves it. Use the arrows to roam
          inside.
        </p>
        <ul>
          <li><kbd>Tab</kbd> / <kbd>Shift</kbd>+<kbd>Tab</kbd> — enter / leave the group (single tab stop)</li>
          <li><kbd>←</kbd> / <kbd>→</kbd> — move focus between buttons (RTL-aware, wraps)</li>
          <li><kbd>Home</kbd> / <kbd>End</kbd> — jump to first / last button</li>
          <li><kbd>Enter</kbd> / <kbd>Space</kbd> — toggle the focused button</li>
        </ul>
        <p>
          Try it: tab in from the heading above, arrow around, then tab again —
          focus jumps cleanly past the rest of the group.
        </p>
        <div class="demo" style="margin-block-start: 12px;">
          <md-button-group variant="connected" selection-mode="single-select">
            <md-button variant="tonal" value="a">First</md-button>
            <md-button variant="tonal" value="b" disabled>Disabled (skipped)</md-button>
            <md-button variant="tonal" value="c" selected>Third (active)</md-button>
            <md-button variant="tonal" value="d">Fourth</md-button>
          </md-button-group>
        </div>
      </section>

      <section>
        <h3>4 · <code>required</code> — at least one stays selected</h3>
        <p>
          When <code>required</code> is set, clicking the only active
          button does not deselect it — the group restores it
          automatically. <code>aria-pressed="true"</code> stays on the
          active button, so AT users hear the consistent state.
        </p>
        <div class="demo">
          <md-button-group selection-mode="single-select" required>
            <md-button variant="tonal" value="list" icon="view_list" selected>List</md-button>
            <md-button variant="tonal" value="grid" icon="grid_view">Grid</md-button>
            <md-button variant="tonal" value="module" icon="view_module">Module</md-button>
          </md-button-group>
        </div>
      </section>

      <section>
        <h3>5 · Disabled children</h3>
        <p>
          Disabled buttons inside a group keep <code>aria-disabled="true"</code>
          and <code>tabindex="-1"</code>; clicks are suppressed and arrow
          navigation jumps over them.
        </p>
        <div class="demo">
          <md-button-group>
            <md-button variant="tonal" value="a">Available</md-button>
            <md-button variant="tonal" value="b" disabled>Disabled</md-button>
            <md-button variant="tonal" value="c">Available</md-button>
          </md-button-group>
        </div>
      </section>
    </div>
  `,
};

/* ==========================================================
   LOCALIZATION — translated labels, lang/dir cascade
   ========================================================== */
export const Localization: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Button group is a thin layout container — the visible labels ' +
          'are the consumer\'s slotted text, so plug in your i18n layer ' +
          'directly. The group respects ambient <code>lang</code> and ' +
          '<code>dir</code>; placing a <code>dir="rtl"</code> on a ' +
          'wrapping element flips both the group\'s child order (via the ' +
          'browser\'s flex inline-axis) and each button\'s internal ' +
          'layout.',
      },
    },
  },
  render: () => {
    const rows = [
      { code: 'en', dir: 'ltr', label: 'English',  day: 'Day',     week: 'Week',    month: 'Month' },
      { code: 'fr', dir: 'ltr', label: 'Français', day: 'Jour',    week: 'Semaine', month: 'Mois' },
      { code: 'de', dir: 'ltr', label: 'Deutsch',  day: 'Tag',     week: 'Woche',   month: 'Monat' },
      { code: 'ja', dir: 'ltr', label: '日本語',     day: '日',       week: '週',       month: '月' },
      { code: 'hi', dir: 'ltr', label: 'हिन्दी',      day: 'दिन',     week: 'सप्ताह',    month: 'महीना' },
      { code: 'ar', dir: 'rtl', label: 'العربية',   day: 'يوم',      week: 'أسبوع',    month: 'شهر' },
      { code: 'he', dir: 'rtl', label: 'עברית',    day: 'יום',     week: 'שבוע',     month: 'חודש' },
    ];
    return html`
      <style>
        .l10n-bg { padding: 24px; font-family: Roboto, sans-serif; }
        .l10n-bg .grid { display: flex; flex-direction: column; }
        .l10n-bg .row {
          display: flex;
          align-items: center;
          gap: 24px;
          padding-block: 16px;
          border-block-end: 1px solid #e7e0ec;
        }
        .l10n-bg .info {
          flex: 0 0 180px;
          display: flex;
          align-items: baseline;
          gap: 8px;
        }
        .l10n-bg .code { color: #6750a4; font-weight: 600; font-family: 'JetBrains Mono', ui-monospace, monospace; }
        .l10n-bg .name { color: var(--md-sys-color-on-surface-variant, #49454F); font-size: 14px; }
        .l10n-bg .groups {
          flex: 1 1 auto;
          display: flex;
          flex-wrap: wrap;
          gap: 16px;
          align-items: center;
        }
      </style>
      <div class="l10n-bg">
        <p style="color:#49454F; margin:0 0 16px; font-size:14px;">
          The same connected and standard groups rendered with translated
          labels. Each row carries its own <code>lang</code> and
          <code>dir</code> on a real block-level element so the
          <code>direction</code> property cascades into both the group
          host and every child button. In RTL rows, the visual
          ordering reverses (Day appears on the right, Month on the
          left) — that's the browser handling the inline axis for us.
        </p>
        <div class="grid">
          ${rows.map(r => html`
            <div class="row" lang="${r.code}" dir="${r.dir}">
              <div class="info">
                <span class="code">${r.code}</span>
                <span class="name">${r.label}</span>
              </div>
              <div class="groups">
                <md-button-group variant="connected" size="sm" shape="round" selection-mode="single-select">
                  <md-button variant="tonal" value="day">${r.day}</md-button>
                  <md-button variant="tonal" value="week" selected>${r.week}</md-button>
                  <md-button variant="tonal" value="month">${r.month}</md-button>
                </md-button-group>
                <md-button-group variant="standard" size="sm" shape="round" selection-mode="multi-select">
                  <md-icon-button variant="tonal" value="bold" icon="format_bold" aria-label="Bold"></md-icon-button>
                  <md-icon-button variant="tonal" value="italic" icon="format_italic" aria-label="Italic"></md-icon-button>
                  <md-icon-button variant="tonal" value="underline" icon="format_underlined" aria-label="Underline"></md-icon-button>
                </md-button-group>
              </div>
            </div>
          `)}
        </div>
      </div>
    `;
  },
};

/* ==========================================================
   RTL — flex inline-axis, mirror-icon on directional glyphs
   ========================================================== */
export const RTL: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Layout uses CSS logical properties throughout — the group is ' +
          'a flex container along the inline axis, so its child buttons ' +
          'visually reverse inside <code>dir="rtl"</code> with no extra ' +
          'work. Each button\'s leading / trailing icon also swaps ' +
          'sides automatically. For directional Material Symbols ' +
          '(<code>arrow_forward</code>, <code>chevron_right</code>, ' +
          '<code>send</code>) add <code>mirror-icon</code> to flip the ' +
          'glyph itself; non-directional icons (<code>add</code>, ' +
          '<code>search</code>, <code>format_bold</code>) must leave it ' +
          'unset.',
      },
    },
  },
  render: () => html`
    <style>
      .rtl-bg { padding: 24px; font-family: Roboto, sans-serif; }
      .rtl-bg .pair {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
        margin-block-end: 24px;
      }
      .rtl-bg .pane {
        padding: 16px;
        border: 1px solid #e7e0ec;
        border-radius: 12px;
        background: #fef7ff;
      }
      .rtl-bg .pane h5 {
        margin: 0 0 12px;
        font-size: 12px;
        font-weight: 500;
        color: #6750a4;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .rtl-bg .row { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }
      .rtl-bg h3 { margin: 0 0 8px; font-size: 16px; color: #1d1b20; }
      .rtl-bg p { margin: 0 0 16px; color: #49454F; font-size: 13px; line-height: 1.6; }
      .rtl-bg code { background: #f7f2fa; padding: 1px 6px; border-radius: 4px; font-size: 12px; }
    </style>

    <div class="rtl-bg">
      <h3>1 · Child order reverses (automatic)</h3>
      <p>
        The group is a flex row along the inline axis. In LTR the first
        child is visually leftmost; in RTL it's visually rightmost. No
        manual ordering required.
      </p>
      <div class="pair">
        <div class="pane" dir="ltr">
          <h5>dir="ltr" — first child on the left</h5>
          <div class="row">
            <md-button-group variant="connected" size="sm" shape="round" selection-mode="single-select">
              <md-button variant="tonal" value="1">First</md-button>
              <md-button variant="tonal" value="2" selected>Second</md-button>
              <md-button variant="tonal" value="3">Third</md-button>
            </md-button-group>
          </div>
        </div>
        <div class="pane" dir="rtl">
          <h5>dir="rtl" — first child on the right</h5>
          <div class="row">
            <md-button-group variant="connected" size="sm" shape="round" selection-mode="single-select">
              <md-button variant="tonal" value="1">الأول</md-button>
              <md-button variant="tonal" value="2" selected>الثاني</md-button>
              <md-button variant="tonal" value="3">الثالث</md-button>
            </md-button-group>
          </div>
        </div>
      </div>

      <h3>2 · Inner button icons swap sides</h3>
      <p>
        Each button's leading icon sits on the <em>inline-start</em>
        side, trailing on the <em>inline-end</em>. The flip is purely
        visual and the icon glyph stays the same.
      </p>
      <div class="pair">
        <div class="pane" dir="ltr">
          <h5>dir="ltr"</h5>
          <div class="row">
            <md-button-group variant="connected" size="sm" shape="round">
              <md-button variant="tonal" value="a" icon="format_align_left">Left</md-button>
              <md-button variant="tonal" value="b" icon="format_align_center">Center</md-button>
              <md-button variant="tonal" value="c" icon="format_align_right">Right</md-button>
            </md-button-group>
          </div>
        </div>
        <div class="pane" dir="rtl">
          <h5>dir="rtl"</h5>
          <div class="row">
            <md-button-group variant="connected" size="sm" shape="round">
              <md-button variant="tonal" value="a" icon="format_align_left">يسار</md-button>
              <md-button variant="tonal" value="b" icon="format_align_center">وسط</md-button>
              <md-button variant="tonal" value="c" icon="format_align_right">يمين</md-button>
            </md-button-group>
          </div>
        </div>
      </div>

      <h3>3 · <code>mirror-icon</code> for directional glyphs</h3>
      <p>
        A "previous / next" pager uses <code>chevron_left</code> and
        <code>chevron_right</code>. In RTL those glyphs need to flip
        along the X axis so they keep meaning "back / forward" in the
        reading direction. Add <code>mirror-icon</code> to each child
        button.
      </p>
      <div class="pair">
        <div class="pane" dir="ltr">
          <h5>dir="ltr"</h5>
          <div class="row">
            <md-button-group variant="connected" size="sm" shape="round">
              <md-icon-button variant="tonal" value="prev" icon="chevron_left" aria-label="Previous" mirror-icon></md-icon-button>
              <md-icon-button variant="tonal" value="next" icon="chevron_right" aria-label="Next" mirror-icon></md-icon-button>
            </md-button-group>
            <md-button-group variant="standard" size="sm" shape="round">
              <md-button variant="tonal" value="back" icon="arrow_back" mirror-icon>Back</md-button>
              <md-button variant="tonal" value="next" trailing-icon="arrow_forward" mirror-icon>Next</md-button>
            </md-button-group>
          </div>
        </div>
        <div class="pane" dir="rtl">
          <h5>dir="rtl"</h5>
          <div class="row">
            <md-button-group variant="connected" size="sm" shape="round">
              <md-icon-button variant="tonal" value="prev" icon="chevron_left" aria-label="Previous" mirror-icon></md-icon-button>
              <md-icon-button variant="tonal" value="next" icon="chevron_right" aria-label="Next" mirror-icon></md-icon-button>
            </md-button-group>
            <md-button-group variant="standard" size="sm" shape="round">
              <md-button variant="tonal" value="back" icon="arrow_back" mirror-icon>عودة</md-button>
              <md-button variant="tonal" value="next" trailing-icon="arrow_forward" mirror-icon>التالي</md-button>
            </md-button-group>
          </div>
        </div>
      </div>

      <h3>4 · Non-directional icons stay put</h3>
      <p>
        Non-directional glyphs (bold, italic, alignment with their
        own visual handedness) must <strong>not</strong> be mirrored —
        omit <code>mirror-icon</code>. Their position swaps with the
        flex inline axis, but the glyph reads the same in any
        locale.
      </p>
      <div class="pair">
        <div class="pane" dir="ltr">
          <h5>dir="ltr"</h5>
          <div class="row">
            <md-button-group variant="connected" size="sm" shape="round" selection-mode="multi-select">
              <md-icon-button variant="tonal" value="bold" icon="format_bold" aria-label="Bold"></md-icon-button>
              <md-icon-button variant="tonal" value="italic" icon="format_italic" aria-label="Italic"></md-icon-button>
              <md-icon-button variant="tonal" value="underline" icon="format_underlined" aria-label="Underline"></md-icon-button>
            </md-button-group>
          </div>
        </div>
        <div class="pane" dir="rtl">
          <h5>dir="rtl"</h5>
          <div class="row">
            <md-button-group variant="connected" size="sm" shape="round" selection-mode="multi-select">
              <md-icon-button variant="tonal" value="bold" icon="format_bold" aria-label="Bold"></md-icon-button>
              <md-icon-button variant="tonal" value="italic" icon="format_italic" aria-label="Italic"></md-icon-button>
              <md-icon-button variant="tonal" value="underline" icon="format_underlined" aria-label="Underline"></md-icon-button>
            </md-button-group>
          </div>
        </div>
      </div>
    </div>
  `,
};

/* ==========================================================
   WIDTH & FULL-WIDTH — sizing API + 100% layout
   ========================================================== */
export const WidthAndFullWidth: Story = {
  name: 'Width, Height & Full Width',
  parameters: {
    docs: {
      description: {
        story:
          'The group exposes six CSS custom properties for explicit ' +
          'sizing — three for the inline axis ' +
          '(<code>--md-button-group-width</code>, ' +
          '<code>--md-button-group-min-width</code>, ' +
          '<code>--md-button-group-max-width</code>) and three for ' +
          'the block axis ' +
          '(<code>--md-button-group-height</code>, ' +
          '<code>--md-button-group-min-height</code>, ' +
          '<code>--md-button-group-max-height</code>) — plus a ' +
          '<code>full-width</code> attribute that stretches the group ' +
          'to 100% of its container while distributing children equally ' +
          'with <code>flex: 1 1 0</code>. Children stretch to the ' +
          'group\'s block-size automatically (via flex ' +
          '<code>align-items: stretch</code>). The 48px touch-target ' +
          'floor on connected XS/SM children stays in effect.',
      },
    },
  },
  render: (_args, { globals }) => html`
    <style>
      .ww-section {
        ${SECTION}
      }
      .ww-h {
        ${HEADING}
      }
      .ww-card {
        background: #fff;
        border: 1px solid var(--md-sys-color-outline-variant);
        border-radius: 12px;
        padding: 16px;
        margin-block-end: 16px;
      }
      .ww-card p {
        color: #49454F;
        font-size: 13px;
        margin: 0 0 12px;
      }
      .ww-frame {
        outline: 1px dashed #b9b3bf;
        padding: 16px;
        border-radius: 8px;
        background: #faf8fc;
      }
      .ww-frame.narrow { max-inline-size: 320px; }
      .ww-frame.medium { max-inline-size: 520px; }
      .ww-frame.wide   { max-inline-size: 800px; }
    </style>
    <div class="ww-section">
      <h2 style="font-family:Roboto; margin:0 0 24px;">Width &amp; Full Width</h2>

      <div class="ww-card">
        <h4 class="ww-h">1 · <code>full-width</code> stretches the group to 100%</h4>
        <p>
          The group becomes <code>display: flex</code> at 100% of its
          container; children share the row equally. Try resizing the
          window — the buttons keep their proportions.
        </p>

        <div class="ww-frame wide">
          <md-button-group variant="standard" size="sm" shape="round" full-width>
            <md-button variant="tonal" value="day">${t(globals.locale, 'buttonGroup.day')}</md-button>
            <md-button variant="tonal" value="week" selected>${t(globals.locale, 'buttonGroup.week')}</md-button>
            <md-button variant="tonal" value="month">${t(globals.locale, 'buttonGroup.month')}</md-button>
            <md-button variant="tonal" value="year">${t(globals.locale, 'buttonGroup.year')}</md-button>
          </md-button-group>
        </div>

        <p style="margin-block-start:12px;">Same group, connected variant:</p>
        <div class="ww-frame wide">
          <md-button-group variant="connected" size="sm" shape="round" full-width>
            <md-button variant="tonal" value="day">${t(globals.locale, 'buttonGroup.day')}</md-button>
            <md-button variant="tonal" value="week" selected>${t(globals.locale, 'buttonGroup.week')}</md-button>
            <md-button variant="tonal" value="month">${t(globals.locale, 'buttonGroup.month')}</md-button>
            <md-button variant="tonal" value="year">${t(globals.locale, 'buttonGroup.year')}</md-button>
          </md-button-group>
        </div>
      </div>

      <div class="ww-card">
        <h4 class="ww-h">2 · Mixed icon + text buttons share equally</h4>
        <p>
          Each child still gets exactly <code>1 / n</code> of the row even
          when one button is icon-only and another is text-heavy.
        </p>
        <div class="ww-frame wide">
          <md-button-group variant="connected" size="md" shape="round" full-width selection-mode="multi-select">
            <md-icon-button variant="tonal" value="bold" icon="format_bold" aria-label="Bold"></md-icon-button>
            <md-button variant="tonal" value="italic" icon="format_italic">${t(globals.locale, 'buttonGroup.italic')}</md-button>
            <md-button variant="tonal" value="under" icon="format_underlined">${t(globals.locale, 'buttonGroup.underline')}</md-button>
            <md-icon-button variant="tonal" value="strike" icon="format_strikethrough" aria-label="Strikethrough"></md-icon-button>
          </md-button-group>
        </div>
      </div>

      <div class="ww-card">
        <h4 class="ww-h">3 · Constrain with <code>--md-button-group-max-width</code></h4>
        <p>
          Pair <code>full-width</code> with a <code>max-width</code> token
          to cap the group inside a wide layout (toolbar, page header).
        </p>
        <div class="ww-frame wide">
          <md-button-group
            variant="connected"
            size="sm"
            shape="round"
            full-width
            style="--md-button-group-max-width: 480px;"
          >
            <md-button variant="tonal" value="list" icon="view_list" selected>${t(globals.locale, 'buttonGroup.list')}</md-button>
            <md-button variant="tonal" value="grid" icon="grid_view">${t(globals.locale, 'buttonGroup.grid')}</md-button>
            <md-button variant="tonal" value="module" icon="view_module">${t(globals.locale, 'buttonGroup.module')}</md-button>
          </md-button-group>
        </div>
      </div>

      <div class="ww-card">
        <h4 class="ww-h">4 · Explicit width via <code>--md-button-group-width</code></h4>
        <p>
          Set a concrete inline-size without <code>full-width</code> for
          stand-alone toolbars. Children inside still use their natural
          widths (no equal-share) — useful when buttons should keep their
          intrinsic labels.
        </p>
        <div class="ww-frame wide">
          <md-button-group
            variant="standard"
            size="sm"
            shape="round"
            style="--md-button-group-width: 360px;"
          >
            <md-button variant="tonal" value="back" icon="arrow_back">${t(globals.locale, 'back')}</md-button>
            <md-button variant="tonal" value="next" trailing-icon="arrow_forward">${t(globals.locale, 'next')}</md-button>
          </md-button-group>
        </div>
      </div>

      <div class="ww-card">
        <h4 class="ww-h">5 · Narrow container — children compete for space</h4>
        <p>
          When the container is narrower than the buttons' intrinsic
          minimum size (label + 48px floor for connected XS/SM), they
          either ellipsize or overflow. The group never falls below the
          spec touch-target on connected XS/SM.
        </p>
        <div class="ww-frame narrow">
          <md-button-group variant="connected" size="sm" shape="round" full-width>
            <md-button variant="tonal" value="a" icon="folder">${t(globals.locale, 'buttonGroup.documents')}</md-button>
            <md-button variant="tonal" value="b" icon="image">${t(globals.locale, 'buttonGroup.images')}</md-button>
            <md-button variant="tonal" value="c" icon="movie">${t(globals.locale, 'buttonGroup.videos')}</md-button>
          </md-button-group>
        </div>
      </div>

      <div class="ww-card">
        <h4 class="ww-h">6 · Side-by-side — auto vs. full-width</h4>
        <div class="ww-frame wide">
          <p style="font-weight:500;">Auto (default — content-sized)</p>
          <md-button-group variant="connected" size="sm" shape="round">
            <md-button variant="tonal" value="day">${t(globals.locale, 'buttonGroup.day')}</md-button>
            <md-button variant="tonal" value="week" selected>${t(globals.locale, 'buttonGroup.week')}</md-button>
            <md-button variant="tonal" value="month">${t(globals.locale, 'buttonGroup.month')}</md-button>
          </md-button-group>

          <p style="font-weight:500; margin-block-start:16px;"><code>full-width</code></p>
          <md-button-group variant="connected" size="sm" shape="round" full-width>
            <md-button variant="tonal" value="day">${t(globals.locale, 'buttonGroup.day')}</md-button>
            <md-button variant="tonal" value="week" selected>${t(globals.locale, 'buttonGroup.week')}</md-button>
            <md-button variant="tonal" value="month">${t(globals.locale, 'buttonGroup.month')}</md-button>
          </md-button-group>
        </div>
      </div>

      <div class="ww-card">
        <h4 class="ww-h">7 · Custom height via <code>--md-button-group-height</code></h4>
        <p>
          Override the group's block-size to align with adjacent
          form controls or app bars. Children stretch to fill the
          group via flex <code>align-items: stretch</code> — they
          don't need their own <code>--md-button-height</code> set.
        </p>
        <div class="ww-frame wide">
          <p style="font-weight:500;">56px (form-row alignment)</p>
          <md-button-group
            variant="connected"
            size="sm"
            shape="round"
            style="--md-button-group-height: 56px;"
          >
            <md-button variant="tonal" value="day">${t(globals.locale, 'buttonGroup.day')}</md-button>
            <md-button variant="tonal" value="week" selected>${t(globals.locale, 'buttonGroup.week')}</md-button>
            <md-button variant="tonal" value="month">${t(globals.locale, 'buttonGroup.month')}</md-button>
          </md-button-group>

          <p style="font-weight:500; margin-block-start:16px;">72px (toolbar height)</p>
          <md-button-group
            variant="connected"
            size="md"
            shape="round"
            style="--md-button-group-height: 72px;"
          >
            <md-icon-button variant="tonal" value="bold" icon="format_bold" aria-label="Bold"></md-icon-button>
            <md-icon-button variant="tonal" value="italic" icon="format_italic" aria-label="Italic" selected></md-icon-button>
            <md-icon-button variant="tonal" value="under" icon="format_underlined" aria-label="Underline"></md-icon-button>
          </md-button-group>

          <p style="font-weight:500; margin-block-start:16px;">120px (hero / banner)</p>
          <md-button-group
            variant="connected"
            size="lg"
            shape="round"
            full-width
            style="--md-button-group-height: 120px; --md-button-group-max-width: 600px;"
          >
            <md-button variant="filled" value="a" icon="rocket_launch">${t(globals.locale, 'buttonGroup.launch')}</md-button>
            <md-button variant="tonal" value="b" icon="schedule">${t(globals.locale, 'buttonGroup.schedule')}</md-button>
            <md-button variant="outlined" value="c" icon="bookmark">${t(globals.locale, 'save')}</md-button>
          </md-button-group>
        </div>
      </div>

      <div class="ww-card">
        <h4 class="ww-h">8 · <code>min-height</code> / <code>max-height</code> bounds</h4>
        <p>
          Use the min/max variants to set a floor or ceiling without
          locking the group to a single height — useful when content
          is dynamic (e.g. the focused button briefly grows in
          standard variant).
        </p>
        <div class="ww-frame wide">
          <p style="font-weight:500;">Floor — at least 48px tall</p>
          <md-button-group
            variant="standard"
            size="xs"
            shape="round"
            style="--md-button-group-min-height: 48px;"
          >
            <md-button variant="tonal" value="a">${t(globals.locale, 'buttonGroup.compact')}</md-button>
            <md-button variant="tonal" value="b" selected>${t(globals.locale, 'buttonGroup.active')}</md-button>
            <md-button variant="tonal" value="c">${t(globals.locale, 'buttonGroup.compact')}</md-button>
          </md-button-group>

          <p style="font-weight:500; margin-block-start:16px;">Ceiling — at most 40px tall</p>
          <md-button-group
            variant="connected"
            size="lg"
            shape="round"
            style="--md-button-group-max-height: 40px;"
          >
            <md-button variant="tonal" value="a">${t(globals.locale, 'buttonGroup.list')}</md-button>
            <md-button variant="tonal" value="b" selected>${t(globals.locale, 'buttonGroup.grid')}</md-button>
            <md-button variant="tonal" value="c">${t(globals.locale, 'buttonGroup.module')}</md-button>
          </md-button-group>
        </div>
      </div>
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
          'Button groups stay on a single line by default — children carry ' +
          '<code>flex-shrink: 0</code> so the group overflows rather than ' +
          'crushing tap targets. Three responsive recipes work well: ' +
          '<strong>(1)</strong> add <code>full-width</code> so children ' +
          'share the parent equally on every width; ' +
          '<strong>(2)</strong> swap to icon-only buttons at narrow ' +
          'breakpoints via a container query; ' +
          '<strong>(3)</strong> let the group overflow horizontally with ' +
          '<code>overflow-x: auto</code> on the parent for tab-strip ' +
          'patterns. Each frame below shows the same group at four ' +
          'breakpoints; the live frame at the bottom is resizable.',
      },
    },
  },
  render: (_args, { globals }) => html`
    <style>
      .bg-resp-shell { display: flex; flex-direction: column; gap: 32px; max-width: 1100px; }
      .bg-resp-section h3 { margin: 0 0 4px; }
      .bg-resp-section p { margin: 0 0 16px; font-size: 14px; color: var(--md-sys-color-on-surface-variant, #49454F); }
      .bg-resp-vp__label { font-size: 11px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase; color: var(--md-sys-color-on-surface-variant, #49454F); margin-block-end: 6px; }
      .bg-resp-vp {
        border: 1px dashed var(--md-sys-color-outline-variant, #cac4d0);
        border-radius: 12px;
        padding: 16px;
        background: var(--md-sys-color-surface-container-lowest, #fffbfe);
        box-sizing: border-box;
        container-type: inline-size;
        margin-block-end: 12px;
      }
      .bg-resp-live { resize: horizontal; overflow: auto; min-inline-size: 240px; max-inline-size: 100%; inline-size: 720px; }

      /* Container-query example for recipe 2: hide labels under 380px,
         turning labelled md-buttons into icon-only chips. */
      .bg-resp-cq md-button .bg-resp-cq__label { display: inline; }
      @container (max-width: 380px) {
        .bg-resp-cq md-button .bg-resp-cq__label { display: none; }
      }

      /* Overflow scroller for recipe 3 */
      .bg-resp-scroll {
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: thin;
      }
    </style>

    <div class="bg-resp-shell">
      <section class="bg-resp-section">
        <h3>1 · <code>full-width</code> on every breakpoint</h3>
        <p>Children share the inline-axis equally with <code>flex: 1 1 0</code>.</p>
        ${[
          { label: 'XS · 320 px', width: '320px' },
          { label: 'SM · 480 px', width: '480px' },
          { label: 'MD · 768 px', width: '768px' },
          { label: 'LG · 1024 px', width: '1024px' },
        ].map(
          (vp) => html`
            <div>
              <div class="bg-resp-vp__label">${vp.label}</div>
              <div class="bg-resp-vp" style="inline-size: ${vp.width}; max-inline-size: 100%;">
                <md-button-group variant="connected" size="sm" shape="round" full-width>
                  <md-button variant="tonal" value="day">${t(globals.locale, 'buttonGroup.day')}</md-button>
                  <md-button variant="tonal" value="week" selected>${t(globals.locale, 'buttonGroup.week')}</md-button>
                  <md-button variant="tonal" value="month">${t(globals.locale, 'buttonGroup.month')}</md-button>
                </md-button-group>
              </div>
            </div>
          `,
        )}
      </section>

      <section class="bg-resp-section">
        <h3>2 · Hide labels under 380px (container query)</h3>
        <p>
          The same toolbar shows full labels at ≥ 380px and collapses to
          icon-only chips below — driven by a container query, so the
          breakpoint is local to the frame, not the viewport.
        </p>
        ${[
          { label: 'XS · 320 px (icon-only)', width: '320px' },
          { label: 'SM · 420 px (labels)', width: '420px' },
          { label: 'MD · 720 px (labels)', width: '720px' },
        ].map(
          (vp) => html`
            <div>
              <div class="bg-resp-vp__label">${vp.label}</div>
              <div class="bg-resp-vp bg-resp-cq" style="inline-size: ${vp.width}; max-inline-size: 100%;">
                <md-button-group variant="standard" size="md" shape="round">
                  <md-button variant="tonal" icon="format_bold" aria-label="Bold">
                    <span class="bg-resp-cq__label">${t(globals.locale, 'buttonGroup.bold')}</span>
                  </md-button>
                  <md-button variant="tonal" icon="format_italic" aria-label="Italic">
                    <span class="bg-resp-cq__label">${t(globals.locale, 'buttonGroup.italic')}</span>
                  </md-button>
                  <md-button variant="tonal" icon="format_underlined" aria-label="Underline">
                    <span class="bg-resp-cq__label">${t(globals.locale, 'buttonGroup.underline')}</span>
                  </md-button>
                  <md-button variant="tonal" icon="format_strikethrough" aria-label="Strikethrough">
                    <span class="bg-resp-cq__label">${t(globals.locale, 'buttonGroup.strike')}</span>
                  </md-button>
                </md-button-group>
              </div>
            </div>
          `,
        )}
      </section>

      <section class="bg-resp-section">
        <h3>3 · Horizontal-scroll tab strip</h3>
        <p>
          When you have more chips than will ever fit, wrap the group in a
          container with <code>overflow-x: auto</code>. The group keeps
          its native sizing; the parent provides the scrolling.
        </p>
        ${[
          { label: 'XS · 320 px (scrolls)', width: '320px' },
          { label: 'MD · 720 px (some scroll)', width: '720px' },
          { label: 'LG · 1024 px (fits)', width: '1024px' },
        ].map(
          (vp) => html`
            <div>
              <div class="bg-resp-vp__label">${vp.label}</div>
              <div class="bg-resp-vp bg-resp-scroll" style="inline-size: ${vp.width}; max-inline-size: 100%;">
                <md-button-group variant="standard" size="sm" shape="round">
                  ${['All', 'Inbox', 'Drafts', 'Sent', 'Spam', 'Trash', 'Archive', 'Starred'].map(
                    (label, i) => html`
                      <md-button variant="tonal" value=${label} ?selected=${i === 0}>${t(globals.locale, 'buttonGroup.' + label.toLowerCase())}</md-button>
                    `,
                  )}
                </md-button-group>
              </div>
            </div>
          `,
        )}
      </section>

      <section class="bg-resp-section">
        <h3>4 · Live resize playground</h3>
        <p>
          Drag the bottom-right corner. The same group is rendered three
          times — content-sized, full-width, and overflow-scrolling.
        </p>
        <div class="bg-resp-vp bg-resp-live">
          <p style="margin: 0 0 8px; font-size: 12px; color: var(--md-sys-color-on-surface-variant, #49454F);">Default (content-sized)</p>
          <md-button-group variant="connected" size="sm" shape="round">
            <md-button variant="tonal" value="day">${t(globals.locale, 'buttonGroup.day')}</md-button>
            <md-button variant="tonal" value="week" selected>${t(globals.locale, 'buttonGroup.week')}</md-button>
            <md-button variant="tonal" value="month">${t(globals.locale, 'buttonGroup.month')}</md-button>
          </md-button-group>

          <p style="margin: 16px 0 8px; font-size: 12px; color: var(--md-sys-color-on-surface-variant, #49454F);"><code>full-width</code></p>
          <md-button-group variant="connected" size="sm" shape="round" full-width>
            <md-button variant="tonal" value="day">${t(globals.locale, 'buttonGroup.day')}</md-button>
            <md-button variant="tonal" value="week" selected>${t(globals.locale, 'buttonGroup.week')}</md-button>
            <md-button variant="tonal" value="month">${t(globals.locale, 'buttonGroup.month')}</md-button>
          </md-button-group>

          <p style="margin: 16px 0 8px; font-size: 12px; color: var(--md-sys-color-on-surface-variant, #49454F);">Overflow-scroll tab strip</p>
          <div style="overflow-x: auto;">
            <md-button-group variant="standard" size="sm" shape="round">
              ${['All', 'Inbox', 'Drafts', 'Sent', 'Spam', 'Trash', 'Archive', 'Starred'].map(
                (label, i) => html`
                  <md-button variant="tonal" value=${label} ?selected=${i === 0}>${t(globals.locale, 'buttonGroup.' + label.toLowerCase())}</md-button>
                `,
              )}
            </md-button-group>
          </div>
        </div>
      </section>
    </div>
  `,
};
