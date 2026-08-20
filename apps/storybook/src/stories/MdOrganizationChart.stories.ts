import type { Meta, StoryObj } from '@storybook/web-components';
import { expect, waitFor } from 'storybook/test';
import { html } from 'lit';
import { t } from '../i18n';

/**
 * `md-organization-chart` — Material Design 3 Expressive organization chart.
 *
 * Visualises hierarchical org data as a top-down tree of avatar cards joined by
 * connector lines. Data-driven via the `nodes` property; collapsible subtrees;
 * optional single/multiple selection; full WAI-ARIA **tree** keyboard model;
 * RTL-aware; pans horizontally when it outgrows its container.
 */

/** Shadow-piercing helpers for play(): testing-library queries can't cross
 *  shadow roots, so interactions address the real internals directly. */
type ChartEl = HTMLElement & { selectedIds: string[] };
const getChart = async (canvasElement: HTMLElement): Promise<ChartEl> => {
  const chart = canvasElement.querySelector('md-organization-chart') as ChartEl;
  await waitFor(() => expect(chart.classList.contains('hydrated')).toBe(true));
  return chart;
};
const itemsOf = (chart: ChartEl) =>
  chart.shadowRoot!.querySelectorAll('li[role="treeitem"]');
const focusedItem = (chart: ChartEl) =>
  chart.shadowRoot!.activeElement as HTMLElement;
const key = (target: Element, k: string) =>
  target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, composed: true }));

/** The demo org data, resolved for the active locale. Person names and avatars
 *  are proper-noun sample data (kept as-is); only the descriptive role titles
 *  localize via the demo i18n dictionary. */
const org = (loc: string) => [
  {
    id: 'ceo',
    name: 'Amy Elsner',
    title: t(loc, 'orgchart.founderCeo'),
    avatar: 'https://i.pravatar.cc/80?img=1',
    children: [
      {
        id: 'prod',
        name: 'Asiya Javayant',
        title: t(loc, 'orgchart.productLead'),
        avatar: 'https://i.pravatar.cc/80?img=5',
        children: [
          { id: 'ux', name: 'Anna Fali', title: t(loc, 'orgchart.uxDesigner'), avatar: 'https://i.pravatar.cc/80?img=9' },
          { id: 'pm', name: 'Bernardo Dominic', title: t(loc, 'orgchart.productManager'), avatar: 'https://i.pravatar.cc/80?img=12' },
        ],
      },
      {
        id: 'eng',
        name: 'Onyama Limba',
        title: t(loc, 'orgchart.engineeringLead'),
        avatar: 'https://i.pravatar.cc/80?img=15',
        children: [
          { id: 'fe', name: 'Elwin Sharvill', title: t(loc, 'orgchart.frontendEngineer'), avatar: 'https://i.pravatar.cc/80?img=33' },
          { id: 'be', name: 'Stephen Shaw', title: t(loc, 'orgchart.backendEngineer'), avatar: 'https://i.pravatar.cc/80?img=51' },
        ],
      },
    ],
  },
];

const meta: Meta = {
  title: 'Data Display/Organization Chart',
  component: 'md-organization-chart',
  tags: ['autodocs'],
  parameters: { layout: 'padded', docs: { source: { language: 'html' } } },
  argTypes: {
    selectionMode: { control: { type: 'select' }, options: ['none', 'single', 'multiple'] },
    orientation: { control: { type: 'inline-radio' }, options: ['vertical', 'horizontal'] },
    collapsible: { control: 'boolean' },
    label: { control: 'text' },
  },
  args: { selectionMode: 'none', orientation: 'vertical', collapsible: true, label: 'Organization chart' },
  render: (args, { globals }) => html`
    <md-organization-chart
      .nodes=${org(globals.locale)}
      selection-mode=${args.selectionMode}
      orientation=${args.orientation}
      ?collapsible=${args.collapsible}
      label=${args.label}
    ></md-organization-chart>
  `,
};
export default meta;
type Story = StoryObj;

export const Playground: Story = {
  /** Pointer + node-reassignment paths the keyboard stories don't reach. */
  play: async ({ canvasElement, step, globals }) => {
    const chart = await getChart(canvasElement);

    await step('Clicking a node roves focus without selecting (mode "none")', async () => {
      const prod = chart.shadowRoot!.querySelector('li[data-id="prod"] .md-org-chart__node') as HTMLElement;
      prod.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
      // handleNodeClick moves the roving tabindex to the clicked node…
      await waitFor(() =>
        expect(chart.shadowRoot!.querySelector('li[data-id="prod"]')!.getAttribute('tabindex')).toBe('0'),
      );
      // …but 'none' mode isn't selectable, so no aria-selected is exposed.
      expect(chart.shadowRoot!.querySelector('li[data-id="prod"]')!.getAttribute('aria-selected')).toBe(null);
      expect(chart.shadowRoot!.querySelectorAll('li[tabindex="0"]').length).toBe(1);
    });

    await step('Enter on a parent toggles its subtree when nothing is selectable', async () => {
      const ceo = chart.shadowRoot!.querySelector('li[data-id="ceo"]') as HTMLElement;
      let toggled: { node: { id: string }; expanded: boolean } | undefined;
      chart.addEventListener('mdNodeToggle', (e) => { toggled = (e as CustomEvent).detail; }, { once: true });
      key(ceo, 'Enter');
      await waitFor(() => expect(itemsOf(chart).length).toBe(1)); // whole tree collapsed to the root
      expect(toggled?.node?.id).toBe('ceo');
      expect(toggled?.expanded).toBe(false);
      expect(ceo.getAttribute('aria-expanded')).toBe('false');
    });

    await step('Clicking the toggler affordance re-expands the subtree', async () => {
      const toggler = chart.shadowRoot!.querySelector('li[data-id="ceo"] .md-org-chart__toggle') as HTMLElement;
      let toggled: { expanded: boolean } | undefined;
      chart.addEventListener('mdNodeToggle', (e) => { toggled = (e as CustomEvent).detail; }, { once: true });
      toggler.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
      await waitFor(() => expect(itemsOf(chart).length).toBe(7)); // fully expanded again
      expect(toggled?.expanded).toBe(true);
      await new Promise((r) => setTimeout(r, 300));
    });

    await step('Reassigning nodes re-syncs through the @Watch (string / invalid / nullish)', async () => {
      const set = (v: unknown) => { (chart as unknown as { nodes: unknown }).nodes = v; };
      // A JSON string is parsed into a fresh tree.
      set(JSON.stringify([{ id: 'root2', name: 'New Root', children: [{ id: 'child2', name: 'Child Two' }] }]));
      await waitFor(() => expect(chart.shadowRoot!.querySelector('li[data-id="root2"]')).not.toBe(null));
      expect(chart.shadowRoot!.querySelector('li[data-id="child2"]')).not.toBe(null);
      // Malformed JSON fails to parse → empty state.
      set('{ not valid json');
      await waitFor(() => expect(chart.classList.contains('md-org-chart--empty')).toBe(true));
      expect(chart.shadowRoot!.querySelector('[role="status"]')).not.toBe(null);
      // A nullish value is treated as empty too.
      set(null);
      await waitFor(() => expect(itemsOf(chart).length).toBe(0));
      // A JSON string encoding a single object (not an array) is wrapped into a
      // one-node tree, lifting the chart back out of its empty state.
      set(JSON.stringify({ id: 'solo', name: 'Solo Root' }));
      await waitFor(() =>
        expect(chart.shadowRoot!.querySelector('li[data-id="solo"]')).not.toBe(null),
      );
      expect(itemsOf(chart).length).toBe(1);
      expect(chart.classList.contains('md-org-chart--empty')).toBe(false);
    });

    await step('Restore the initial render so the visual baseline stays neutral', async () => {
      // The coverage steps above mutated `nodes` down to a single 'solo' node
      // (and roved/collapsed along the way). Reassign the original tree so the
      // VISUAL-mode screenshot captures the clean resting render — root plus two
      // levels, all expanded, nothing selected or focused (mode 'none' never
      // focuses; the @Watch re-seeds the roving owner to the first root).
      (chart as unknown as { nodes: unknown }).nodes = org(globals.locale);
      await waitFor(() => expect(itemsOf(chart).length).toBe(7));
      expect(chart.shadowRoot!.querySelector('li[data-id="ceo"]')).not.toBe(null);
      expect(chart.classList.contains('md-org-chart--empty')).toBe(false);
    });
  },
};

export const SingleSelection: Story = {
  render: (_args, { globals }) => html`
    <md-organization-chart .nodes=${org(globals.locale)} selection-mode="single" .selectedIds=${['prod']}></md-organization-chart>
  `,
  /** The WAI-ARIA tree keyboard model, scripted (see the Interactions panel). */
  play: async ({ canvasElement, step }) => {
    const chart = await getChart(canvasElement);

    await step('Tab stop: exactly one tabbable treeitem takes focus', async () => {
      const tabbable = chart.shadowRoot!.querySelectorAll('li[role="treeitem"][tabindex="0"]');
      expect(tabbable.length).toBe(1);
      (tabbable[0] as HTMLElement).focus();
      await waitFor(() => expect(focusedItem(chart)?.getAttribute('role')).toBe('treeitem'));
      expect(itemsOf(chart).length).toBe(7); // every node visible (all expanded)
    });

    await step('ArrowDown moves focus to the next visible node', async () => {
      const before = focusedItem(chart).getAttribute('data-id');
      key(focusedItem(chart), 'ArrowDown');
      await waitFor(() => expect(focusedItem(chart).getAttribute('data-id')).not.toBe(before));
      expect(focusedItem(chart).getAttribute('data-id')).toBe('prod');
    });

    await step('Enter selects the focused node (single-select swaps)', async () => {
      key(focusedItem(chart), 'ArrowDown'); // onto 'ux' — not the preselected node
      await waitFor(() => expect(focusedItem(chart).getAttribute('data-id')).toBe('ux'));
      let detail: { selectedIds: string[] } | undefined;
      chart.addEventListener(
        'mdSelectionChange',
        (e) => { detail = (e as CustomEvent).detail; },
        { once: true },
      );
      key(focusedItem(chart), 'Enter');
      await waitFor(() => expect(focusedItem(chart).getAttribute('aria-selected')).toBe('true'));
      expect(detail?.selectedIds).toEqual(['ux']);
      expect(chart.selectedIds).toEqual(['ux']);
      // Single mode: the preselected 'prod' was swapped out, not accumulated.
      expect(chart.shadowRoot!.querySelectorAll('li[aria-selected="true"]').length).toBe(1);
    });

    await step('ArrowLeft walks up then collapses; ArrowRight re-expands', async () => {
      key(focusedItem(chart), 'ArrowLeft'); // leaf → move focus to parent 'prod'
      await waitFor(() => expect(focusedItem(chart).getAttribute('data-id')).toBe('prod'));
      key(focusedItem(chart), 'ArrowLeft'); // expanded parent → collapse subtree
      await waitFor(() => expect(itemsOf(chart).length).toBe(5));
      expect(focusedItem(chart).getAttribute('aria-expanded')).toBe('false');
      key(focusedItem(chart), 'ArrowRight'); // collapsed parent → re-expand
      await waitFor(() => expect(itemsOf(chart).length).toBe(7));
      expect(focusedItem(chart).getAttribute('aria-expanded')).toBe('true');
      // Let the group's grow animation (--_duration: 300ms) settle before the
      // play returns — a teardown mid-animation registers as an unhandled error.
      await new Promise((r) => setTimeout(r, 300));
    });

    await step('Home / End / ArrowUp / forward-into-child navigation', async () => {
      key(focusedItem(chart), 'Home'); // jump to the first visible node
      await waitFor(() => expect(focusedItem(chart).getAttribute('data-id')).toBe('ceo'));
      key(focusedItem(chart), 'ArrowRight'); // expanded parent → move into its first child
      await waitFor(() => expect(focusedItem(chart).getAttribute('data-id')).toBe('prod'));
      key(focusedItem(chart), 'End'); // jump to the last visible node
      await waitFor(() => expect(focusedItem(chart).getAttribute('data-id')).toBe('be'));
      key(focusedItem(chart), 'ArrowUp'); // step back to the previous visible node
      await waitFor(() => expect(focusedItem(chart).getAttribute('data-id')).toBe('fe'));
      const held = focusedItem(chart).getAttribute('data-id');
      key(focusedItem(chart), 'a'); // unhandled key → no-op, focus is preserved
      await waitFor(() => expect(focusedItem(chart).getAttribute('data-id')).toBe(held));
    });

    await step('Enter on the sole selected node toggles single-select off', async () => {
      // 'ux' is still the lone selection from the earlier Enter step; drive focus
      // straight to it and re-activate to exercise the single-mode deselect path.
      const ux = chart.shadowRoot!.querySelector('li[data-id="ux"]') as HTMLElement;
      ux.focus();
      await waitFor(() => expect(focusedItem(chart).getAttribute('data-id')).toBe('ux'));
      expect(chart.selectedIds).toEqual(['ux']);
      let detail: { selectedIds: string[] } | undefined;
      chart.addEventListener('mdSelectionChange', (e) => { detail = (e as CustomEvent).detail; }, { once: true });
      key(focusedItem(chart), 'Enter'); // sole selected node → clears to empty
      // Gate on the reflected DOM attribute (updated on the async render flush),
      // not just the synchronous selectedIds prop — otherwise the read races the
      // flush and still sees the stale aria-selected="true".
      await waitFor(() => expect(ux.getAttribute('aria-selected')).toBe('false'));
      expect(chart.selectedIds).toEqual([]);
      expect(detail?.selectedIds).toEqual([]);
      expect(chart.shadowRoot!.querySelectorAll('li[aria-selected="true"]').length).toBe(0);
    });
  },
};

export const MultipleSelection: Story = {
  render: (_args, { globals }) => html`
    <md-organization-chart
      .nodes=${org(globals.locale)}
      selection-mode="multiple"
      .selectedIds=${['ux', 'be']}
    ></md-organization-chart>
  `,
  /** Multiple mode accumulates and toggles selection off the same node. */
  play: async ({ canvasElement, step }) => {
    const chart = await getChart(canvasElement);
    const nodeDiv = (id: string) =>
      chart.shadowRoot!.querySelector(`li[data-id="${id}"] .md-org-chart__node`) as HTMLElement;
    const click = (el: HTMLElement) =>
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));

    await step('The tree advertises multi-select and starts with two nodes selected', async () => {
      const tree = chart.shadowRoot!.querySelector('[role="tree"]');
      expect(tree?.getAttribute('aria-multiselectable')).toBe('true');
      expect(chart.shadowRoot!.querySelectorAll('li[aria-selected="true"]').length).toBe(2);
      expect(chart.selectedIds).toEqual(['ux', 'be']);
    });

    await step('Clicking an unselected node adds it (selection accumulates)', async () => {
      let detail: { selectedIds: string[] } | undefined;
      chart.addEventListener('mdSelectionChange', (e) => { detail = (e as CustomEvent).detail; }, { once: true });
      click(nodeDiv('pm'));
      await waitFor(() =>
        expect(chart.shadowRoot!.querySelector('li[data-id="pm"]')!.getAttribute('aria-selected')).toBe('true'),
      );
      expect(chart.selectedIds).toContain('pm');
      expect(chart.selectedIds.length).toBe(3);
      expect(detail?.selectedIds).toEqual(chart.selectedIds);
    });

    await step('Clicking the same node again toggles it back off', async () => {
      click(nodeDiv('pm'));
      await waitFor(() =>
        expect(chart.shadowRoot!.querySelector('li[data-id="pm"]')!.getAttribute('aria-selected')).toBe('false'),
      );
      expect(chart.selectedIds).not.toContain('pm');
      expect(chart.selectedIds.length).toBe(2);
    });
  },
};

/** Nodes seeded `expanded: false` start collapsed; togglers expand/collapse them. */
export const Collapsible: Story = {
  render: (_args, { globals }) => {
    const [root] = org(globals.locale);
    return html`
      <md-organization-chart
        .nodes=${[
          {
            ...root,
            children: [
              { ...root.children[0], expanded: false },
              root.children[1],
            ],
          },
        ]}
      ></md-organization-chart>
    `;
  },
};

/** Initials fall back automatically when no `avatar` image is supplied. */
export const InitialsFallback: Story = {
  render: (_args, { globals }) => html`
    <md-organization-chart
      .nodes=${[
        {
          id: 'a', name: 'Ada Lovelace', title: t(globals.locale, 'orgchart.chiefScientist'),
          children: [
            { id: 'b', name: 'Alan Turing', title: t(globals.locale, 'orgchart.research') },
            { id: 'c', name: 'Grace Hopper', title: t(globals.locale, 'orgchart.compilers') },
          ],
        },
      ]}
    ></md-organization-chart>
  `,
};

/** Multiple roots render side by side. */
export const MultipleRoots: Story = {
  render: (_args, { globals }) => html`
    <md-organization-chart
      .nodes=${[
        { id: 'r1', name: t(globals.locale, 'orgchart.sales'), title: t(globals.locale, 'orgchart.regionWest'), children: [{ id: 'r1a', name: t(globals.locale, 'orgchart.teamA'), title: '' }] },
        { id: 'r2', name: t(globals.locale, 'orgchart.sales'), title: t(globals.locale, 'orgchart.regionEast'), children: [{ id: 'r2a', name: t(globals.locale, 'orgchart.teamB'), title: '' }] },
      ]}
    ></md-organization-chart>
  `,
};

/**
 * `orientation="horizontal"` lays the tree left-to-right instead of top-down —
 * the same connectors, mirrored onto the inline axis (and flipped in RTL). The
 * ARIA/keyboard model is unchanged (Arrow →/← still expand/collapse).
 */
export const Horizontal: Story = {
  render: (_args, { globals }) => html`
    <md-organization-chart
      orientation="horizontal"
      selection-mode="single"
      .selectedIds=${['prod']}
      .nodes=${org(globals.locale)}
    ></md-organization-chart>
  `,
};

const L10N = {
  de: { label: 'Organigramm', expand: 'Erweitern', collapse: 'Reduzieren', ceo: 'Gründerin & CEO', prod: 'Produktleitung', eng: 'Technische Leitung' },
  ar: { label: 'الهيكل التنظيمي', expand: 'توسيع', collapse: 'طي', ceo: 'المؤسِّسة والرئيس التنفيذي', prod: 'قائدة المنتج', eng: 'قائد الهندسة' },
};

/** Localised affordance labels; the Arabic locale also mirrors in RTL. */
export const Localization: Story = {
  render: () => html`
    <div style="display:flex; flex-direction:column; gap:32px;">
      <div>
        <p style="font:600 12px/16px Roboto,sans-serif; color:var(--md-sys-color-on-surface-variant, #49454F); margin:0 0 8px;">Deutsch</p>
        <md-organization-chart
          label=${L10N.de.label} expand-label=${L10N.de.expand} collapse-label=${L10N.de.collapse}
          .nodes=${[{ id: 'c', name: 'Amy Elsner', title: L10N.de.ceo, avatar: 'https://i.pravatar.cc/80?img=1',
            children: [{ id: 'p', name: 'Asiya Javayant', title: L10N.de.prod, avatar: 'https://i.pravatar.cc/80?img=5' },
                       { id: 'e', name: 'Onyama Limba', title: L10N.de.eng, avatar: 'https://i.pravatar.cc/80?img=15' }] }]}
        ></md-organization-chart>
      </div>
      <div dir="rtl">
        <p style="font:600 12px/16px Roboto,sans-serif; color:var(--md-sys-color-on-surface-variant, #49454F); margin:0 0 8px;">العربية (RTL)</p>
        <md-organization-chart
          label=${L10N.ar.label} expand-label=${L10N.ar.expand} collapse-label=${L10N.ar.collapse}
          .nodes=${[{ id: 'c', name: 'إيمي إلسنر', title: L10N.ar.ceo, avatar: 'https://i.pravatar.cc/80?img=1',
            children: [{ id: 'p', name: 'آسيا جافايانت', title: L10N.ar.prod, avatar: 'https://i.pravatar.cc/80?img=5' },
                       { id: 'e', name: 'أونياما ليمبا', title: L10N.ar.eng, avatar: 'https://i.pravatar.cc/80?img=15' }] }]}
        ></md-organization-chart>
      </div>
    </div>
  `,
};

export const RTL: Story = {
  render: (_args, { globals }) => html`<div dir="rtl"><md-organization-chart .nodes=${org(globals.locale)} selection-mode="single"></md-organization-chart></div>`,
  /** Under dir="rtl" the horizontal arrows invert (forward = ArrowLeft). */
  play: async ({ canvasElement }) => {
    const chart = await getChart(canvasElement);
    await waitFor(() => expect(getComputedStyle(chart).direction).toBe('rtl'));
    const ceo = chart.shadowRoot!.querySelector('li[data-id="ceo"]') as HTMLElement;
    ceo.focus();
    await waitFor(() => expect(focusedItem(chart).getAttribute('data-id')).toBe('ceo'));
    // Forward (ArrowLeft in RTL) descends into the first child.
    key(focusedItem(chart), 'ArrowLeft');
    await waitFor(() => expect(focusedItem(chart).getAttribute('data-id')).toBe('prod'));
    // Backward (ArrowRight in RTL) collapses the now-focused expanded parent.
    key(focusedItem(chart), 'ArrowRight');
    await waitFor(() => expect(itemsOf(chart).length).toBe(5));
    expect(focusedItem(chart).getAttribute('aria-expanded')).toBe('false');
    await new Promise((r) => setTimeout(r, 300));

    // Reset to the resting render for a neutral VISUAL baseline: re-expand the
    // 'prod' subtree collapsed above and drop focus so no ring lingers — the
    // screenshot then matches a fresh mount (all 7 nodes visible, nothing focused).
    const prodReset = chart.shadowRoot!.querySelector('li[data-id="prod"]') as HTMLElement;
    key(prodReset, 'ArrowLeft'); // RTL forward on the collapsed parent → re-expand
    await waitFor(() => expect(itemsOf(chart).length).toBe(7));
    expect(prodReset.getAttribute('aria-expanded')).toBe('true');
    (chart.shadowRoot!.activeElement as HTMLElement | null)?.blur();
    await waitFor(() => expect(chart.shadowRoot!.activeElement).toBe(null));
    // Let the group's grow animation settle before the screenshot is captured.
    await new Promise((r) => setTimeout(r, 300));
  },
};

export const DarkTheme: Story = {
  parameters: { backgrounds: { default: 'dark' } },
  globals: { theme: 'dark' },
  render: (_args, { globals }) => html`<md-organization-chart .nodes=${org(globals.locale)} selection-mode="single" .selectedIds=${['eng']}></md-organization-chart>`,
};

/** Per-instance theming via the public CSS custom properties. */
export const CustomCSS: Story = {
  render: (_args, { globals }) => html`
    <style>
      .branded {
        --md-org-chart-connector-color: #7c4dff;
        --md-org-chart-node-outline-color: #7c4dff;
        --md-org-chart-node-shape: 20px;
        --md-org-chart-selected-color: #7c4dff;
        --md-org-chart-sibling-gap: 24px;
      }
    </style>
    <md-organization-chart class="branded" .nodes=${org(globals.locale)} selection-mode="single"></md-organization-chart>
  `,
};

/**
 * Full WAI-ARIA **tree** wiring — click a node (single-select here) or drive it
 * entirely from the keyboard. Tab lands on one node (roving tabindex); the
 * arrows then walk the tree and expand/collapse subtrees. Every node exposes its
 * depth and position (`aria-level` / `aria-setsize` / `aria-posinset`), parents
 * expose `aria-expanded`, and selectable nodes expose `aria-selected` (the tree
 * is `aria-multiselectable` in multiple mode). The toggler is a decorative,
 * inert affordance — collapse/expand is a keyboard action on the node itself.
 */
export const Accessibility: Story = {
  name: 'Accessibility',
  parameters: {
    docs: {
      description: {
        story:
          'WAI-ARIA APG tree: `role="tree"` → `treeitem` → `group`, roving tabindex (one Tab stop), and direction-aware arrow keys. Keyboard: ↑/↓ move between visible nodes, →/← expand-collapse-or-move (inverted under `dir="rtl"`), Home/End jump to first/last, Enter/Space select.',
      },
    },
  },
  render: (_args, { globals }) => html`
    <md-organization-chart
      label="Company org chart"
      selection-mode="single"
      .selectedIds=${['prod']}
      .nodes=${org(globals.locale)}
    ></md-organization-chart>
    <details style="font: 13px/1.6 system-ui; opacity: 0.85; margin-top: 20px; max-inline-size: 560px;">
      <summary>Keyboard &amp; AT contract</summary>
      <ul style="line-height: 1.9;">
        <li><b>Tab</b> — a single stop for the whole chart (roving tabindex); Tab again leaves it.</li>
        <li><b>↓ / ↑</b> — move to the next / previous <em>visible</em> node (depth-first).</li>
        <li><b>→</b> — on a collapsed parent, expand it; on an expanded parent, move to its first child. Inverted to <b>←</b> under <code>dir="rtl"</code>.</li>
        <li><b>←</b> — on an expanded parent, collapse it; otherwise move to the parent node. Inverted to <b>→</b> under <code>dir="rtl"</code>.</li>
        <li><b>Home / End</b> — first / last visible node.</li>
        <li><b>Enter / Space</b> — select the focused node (or toggle it when it isn't selectable).</li>
        <li>Structure: <code>role="tree"</code> / <code>treeitem</code> / <code>group</code> with <code>aria-level</code>, <code>aria-setsize</code>, <code>aria-posinset</code>.</li>
        <li>State: <code>aria-expanded</code> on parents; <code>aria-selected</code> on selectable nodes; <code>aria-multiselectable</code> on the tree in multiple mode.</li>
        <li>Affordance labels are localisable via <code>label</code>, <code>expand-label</code>, <code>collapse-label</code>; the avatar is decorative (the name is announced as the node's text).</li>
      </ul>
    </details>
  `,
};

export const Empty: Story = {
  render: (_args, { globals }) => html`
    <md-organization-chart .nodes=${[]}>
      <span slot="empty">${t(globals.locale, 'orgchart.empty')}</span>
    </md-organization-chart>
  `,
};

/** A node flagged `selectable: false` stays inert even in a selectable mode. */
export const NonSelectableNode: Story = {
  render: () => html`
    <md-organization-chart
      selection-mode="single"
      .nodes=${[
        {
          id: 'lead', name: 'Team Lead', title: 'Group',
          children: [
            { id: 'locked', name: 'Locked Node', title: 'Read-only', selectable: false },
            { id: 'open', name: 'Open Node', title: 'Selectable' },
          ],
        },
      ]}
    ></md-organization-chart>
  `,
  /** The per-node `selectable: false` guard blocks selection without blocking focus. */
  play: async ({ canvasElement, step }) => {
    const chart = await getChart(canvasElement);
    const nodeDiv = (id: string) =>
      chart.shadowRoot!.querySelector(`li[data-id="${id}"] .md-org-chart__node`) as HTMLElement;
    const clickNode = (el: HTMLElement) =>
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));

    await step('A selectable:false node exposes no aria-selected and resists selection', async () => {
      const lockedLi = chart.shadowRoot!.querySelector('li[data-id="locked"]') as HTMLElement;
      // Non-selectable nodes never advertise a selection state at all.
      expect(lockedLi.getAttribute('aria-selected')).toBe(null);
      // Clicking still roves the tabindex (the click handler ran) but must not select.
      clickNode(nodeDiv('locked'));
      await waitFor(() => expect(lockedLi.getAttribute('tabindex')).toBe('0'));
      expect(chart.selectedIds).toEqual([]);
      // Enter on it is likewise inert: not selectable, and a leaf so nothing toggles.
      lockedLi.focus();
      key(lockedLi, 'Enter');
      await new Promise((r) => setTimeout(r, 0));
      expect(chart.selectedIds).toEqual([]);
      expect(chart.shadowRoot!.querySelectorAll('li[aria-selected="true"]').length).toBe(0);
    });

    await step('Its selectable sibling still selects normally', async () => {
      let detail: { selectedIds: string[] } | undefined;
      chart.addEventListener('mdSelectionChange', (e) => { detail = (e as CustomEvent).detail; }, { once: true });
      clickNode(nodeDiv('open'));
      await waitFor(() =>
        expect(chart.shadowRoot!.querySelector('li[data-id="open"]')!.getAttribute('aria-selected')).toBe('true'),
      );
      expect(chart.selectedIds).toEqual(['open']);
      expect(detail?.selectedIds).toEqual(['open']);
    });
  },
};
