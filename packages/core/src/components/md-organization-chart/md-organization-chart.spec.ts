import { newSpecPage } from '@stencil/core/testing';
import { MdOrganizationChart } from './md-organization-chart';

const TREE = [
  {
    id: 'a',
    name: 'Amy',
    title: 'CEO',
    children: [
      { id: 'b', name: 'Bob', title: 'Lead', children: [{ id: 'd', name: 'Dan' }] },
      { id: 'c', name: 'Cara', title: 'Lead' },
    ],
  },
];

async function withNodes(nodes: unknown, attrs = '') {
  const page = await newSpecPage({
    components: [MdOrganizationChart],
    html: `<md-organization-chart ${attrs}></md-organization-chart>`,
  });
  (page.root as unknown as { nodes: unknown }).nodes = nodes;
  await page.waitForChanges();
  return page;
}

const shadow = (page: { root?: HTMLElement | null }) => page.root?.shadowRoot;
const items = (page: { root?: HTMLElement | null }) =>
  Array.from(shadow(page)?.querySelectorAll('[role="treeitem"]') ?? []);

describe('md-organization-chart', () => {
  describe('rendering', () => {
    it('renders an empty state when there are no nodes', async () => {
      const page = await newSpecPage({
        components: [MdOrganizationChart],
        html: `<md-organization-chart></md-organization-chart>`,
      });
      expect(shadow(page)?.querySelector('[part="empty"]')).toBeTruthy();
      expect(shadow(page)?.querySelector('[role="tree"]')).toBeNull();
    });

    it('parses a JSON string attribute into a tree', async () => {
      const page = await newSpecPage({
        components: [MdOrganizationChart],
        html: `<md-organization-chart nodes='${JSON.stringify(TREE)}'></md-organization-chart>`,
      });
      expect(shadow(page)?.querySelector('[role="tree"]')).toBeTruthy();
      expect(items(page)).toHaveLength(4);
    });

    it('renders one treeitem per node with the name + title', async () => {
      const page = await withNodes(TREE);
      const first = items(page)[0];
      expect(first.querySelector('[part="name"]')?.textContent).toBe('Amy');
      expect(first.querySelector('[part="title"]')?.textContent).toBe('CEO');
    });

    it('defaults to vertical and reflects orientation (layout is CSS-only, semantics unchanged)', async () => {
      const dflt = await withNodes(TREE);
      expect((dflt.root as unknown as { orientation: string }).orientation).toBe('vertical');

      // orientation="horizontal" reflects onto the host (drives the :host([orientation])
      // CSS) while the tree/treeitem structure stays identical to vertical.
      const page = await withNodes(TREE, 'orientation="horizontal"');
      expect(page.root?.getAttribute('orientation')).toBe('horizontal');
      expect(shadow(page)?.querySelector('[role="tree"]')).toBeTruthy();
      expect(items(page)).toHaveLength(4);
    });
  });

  describe('ARIA / tree semantics', () => {
    it('exposes tree / treeitem / group roles and positional ARIA', async () => {
      const page = await withNodes(TREE);
      const tree = shadow(page)?.querySelector('[role="tree"]');
      expect(tree?.getAttribute('aria-label')).toBe('Organization chart');
      const root = items(page)[0];
      expect(root.getAttribute('aria-level')).toBe('1');
      expect(root.getAttribute('aria-setsize')).toBe('1');
      expect(root.getAttribute('aria-posinset')).toBe('1');
      // children live in a role="group"
      const group = root.querySelector('[role="group"]');
      expect(group).toBeTruthy();
      const bob = group?.querySelector('[role="treeitem"]');
      expect(bob?.getAttribute('aria-level')).toBe('2');
      expect(bob?.getAttribute('aria-setsize')).toBe('2');
    });

    it('sets aria-expanded only on nodes that have children', async () => {
      const page = await withNodes(TREE);
      const [amy, bob, cara, dan] = items(page).map((el) => el.getAttribute('data-id'));
      expect(amy).toBe('a');
      const byId = (id: string) => items(page).find((el) => el.getAttribute('data-id') === id);
      expect(byId('a')?.getAttribute('aria-expanded')).toBe('true');
      expect(byId('b')?.getAttribute('aria-expanded')).toBe('true');
      expect(byId('c')?.getAttribute('aria-expanded')).toBeNull(); // leaf
      expect(byId('d')?.getAttribute('aria-expanded')).toBeNull(); // leaf
      void [bob, cara, dan];
    });

    it('marks the tree aria-multiselectable in multiple mode', async () => {
      const page = await withNodes(TREE, 'selection-mode="multiple"');
      expect(shadow(page)?.querySelector('[role="tree"]')?.getAttribute('aria-multiselectable')).toBe('true');
    });

    it('has exactly one tabbable treeitem (roving tabindex)', async () => {
      const page = await withNodes(TREE);
      const tabbable = items(page).filter((el) => el.getAttribute('tabindex') === '0');
      expect(tabbable).toHaveLength(1);
      expect(tabbable[0].getAttribute('data-id')).toBe('a');
    });
  });

  describe('expand / collapse', () => {
    it('starts collapsed for nodes seeded expanded:false', async () => {
      const page = await withNodes([
        { id: 'a', name: 'Amy', children: [{ id: 'b', name: 'Bob', expanded: false, children: [{ id: 'c', name: 'Cara' }] }] },
      ]);
      // Cara is hidden because Bob is collapsed.
      expect(items(page).some((el) => el.getAttribute('data-id') === 'c')).toBe(false);
      const bob = items(page).find((el) => el.getAttribute('data-id') === 'b');
      expect(bob?.getAttribute('aria-expanded')).toBe('false');
    });

    it('toggling collapses the subtree and emits mdNodeToggle', async () => {
      const page = await withNodes(TREE);
      const toggleSpy = jest.fn();
      page.root?.addEventListener('mdNodeToggle', toggleSpy);
      const amyToggle = items(page)[0].querySelector('[part="toggle"]') as HTMLElement;
      amyToggle.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await page.waitForChanges();
      // Bob/Cara/Dan disappear when Amy collapses.
      expect(items(page)).toHaveLength(1);
      expect(items(page)[0].getAttribute('aria-expanded')).toBe('false');
      expect(toggleSpy).toHaveBeenCalled();
    });
  });

  describe('selection', () => {
    it('does not select when selectionMode is none', async () => {
      const page = await withNodes(TREE, 'selection-mode="none"');
      const node = items(page)[0].querySelector('.md-org-chart__node') as HTMLElement;
      node.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await page.waitForChanges();
      expect(items(page)[0].getAttribute('aria-selected')).toBeNull();
    });

    it('single selection sets aria-selected + emits, and is exclusive', async () => {
      const page = await withNodes(TREE, 'selection-mode="single"');
      const spy = jest.fn();
      page.root?.addEventListener('mdSelectionChange', spy);
      const clickNode = (id: string) => {
        const li = items(page).find((el) => el.getAttribute('data-id') === id)!;
        (li.querySelector('.md-org-chart__node') as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true }));
      };
      clickNode('a');
      await page.waitForChanges();
      expect(items(page).find((el) => el.getAttribute('data-id') === 'a')?.getAttribute('aria-selected')).toBe('true');
      clickNode('b');
      await page.waitForChanges();
      // 'a' is deselected (single).
      expect(items(page).find((el) => el.getAttribute('data-id') === 'a')?.getAttribute('aria-selected')).toBe('false');
      expect(items(page).find((el) => el.getAttribute('data-id') === 'b')?.getAttribute('aria-selected')).toBe('true');
      expect(spy).toHaveBeenCalledTimes(2);
      expect((page.root as unknown as { selectedIds: string[] }).selectedIds).toEqual(['b']);
    });

    it('multiple selection accumulates', async () => {
      const page = await withNodes(TREE, 'selection-mode="multiple"');
      const clickNode = (id: string) => {
        const li = items(page).find((el) => el.getAttribute('data-id') === id)!;
        (li.querySelector('.md-org-chart__node') as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true }));
      };
      clickNode('a');
      clickNode('b');
      await page.waitForChanges();
      expect((page.root as unknown as { selectedIds: string[] }).selectedIds.sort()).toEqual(['a', 'b']);
    });
  });
});


describe('selection trail', () => {
  /*
   * A selected node is outlined, which says WHICH node without saying WHERE it
   * hangs. `--on-path` marks the selected branch and every ancestor of it so the
   * connectors can carry that answer; these pin the marking, not the colour.
   */
  const tree = `
    <md-organization-chart selection-mode="single"></md-organization-chart>
  `;
  const nodes = [
    {
      id: 'root',
      name: 'Root',
      children: [
        { id: 'a', name: 'A', children: [{ id: 'a1', name: 'A1' }] },
        { id: 'b', name: 'B' },
      ],
    },
  ];

  const onPath = (page: { root?: Element | null }) =>
    [...(page.root?.shadowRoot?.querySelectorAll('.md-org-chart__branch--on-path') ?? [])].map(
      (li) => li.getAttribute('data-id'),
    );

  it('marks the selected branch and every ancestor, and nothing else', async () => {
    const page = await newSpecPage({ components: [MdOrganizationChart], html: tree });
    const el = page.root as HTMLElement & { nodes: unknown; selectedIds: string[] };
    el.nodes = nodes;
    el.selectedIds = ['a1'];
    await page.waitForChanges();
    // root -> a -> a1 is the trail; b is a sibling and stays off it.
    expect(onPath(page).sort()).toEqual(['a', 'a1', 'root']);
  });

  it('keeps both trails when two branches are selected', async () => {
    // `.map(walk)` before `.some()` exists for exactly this: a short-circuit
    // would mark the first hit's ancestors and leave the second's untraced.
    const page = await newSpecPage({ components: [MdOrganizationChart], html: tree });
    const el = page.root as HTMLElement & { nodes: unknown; selectedIds: string[] };
    el.nodes = nodes;
    el.selectedIds = ['a1', 'b'];
    await page.waitForChanges();
    expect(onPath(page).sort()).toEqual(['a', 'a1', 'b', 'root']);
  });

  it('marks nothing when the selection is empty', async () => {
    const page = await newSpecPage({ components: [MdOrganizationChart], html: tree });
    const el = page.root as HTMLElement & { nodes: unknown; selectedIds: string[] };
    el.nodes = nodes;
    el.selectedIds = [];
    await page.waitForChanges();
    expect(onPath(page)).toEqual([]);
  });
});

describe('trail geometry hooks', () => {
  /*
   * The run's LENGTH is measured from real boxes, which mock-doc does not have —
   * every rect here is zero — so these pin the hooks the measurement writes
   * through, not the numbers. The pixel geometry is covered in the browser.
   */
  const nodes = [
    {
      id: 'root',
      name: 'Root',
      children: [
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' },
      ],
    },
  ];

  const groups = async (selected: string[]) => {
    const page = await newSpecPage({
      components: [MdOrganizationChart],
      html: '<md-organization-chart selection-mode="multiple"></md-organization-chart>',
    });
    const el = page.root as HTMLElement & { nodes: unknown; selectedIds: string[] };
    el.nodes = nodes;
    el.selectedIds = selected;
    await page.waitForChanges();
    return [...(page.root?.shadowRoot?.querySelectorAll('.md-org-chart__group') ?? [])];
  };

  it('marks the group holding a selected child so the run is drawn', async () => {
    const [group] = await groups(['a']);
    expect(group.hasAttribute('data-trail')).toBe(true);
  });

  it('leaves a group with nothing selected under it unmarked', async () => {
    // The root is on the path, but its GROUP only draws a run when a child of
    // that group is on it — which is what `data-trail` has to distinguish.
    const [group] = await groups([]);
    expect(group.hasAttribute('data-trail')).toBe(false);
  });

  it('leaves the selection\'s OWN drop alone', async () => {
    /*
     * The trail climbs to the root. Keying the drop on "this node is on the
     * path" coloured the selected node's own drop as well, running the line on
     * down into children nobody had selected — so the test is whether something
     * BELOW this group is on the trail.
     */
    const deep = [
      {
        id: 'root',
        name: 'Root',
        children: [
          { id: 'a', name: 'A', children: [{ id: 'a1', name: 'A1' }, { id: 'a2', name: 'A2' }] },
          { id: 'b', name: 'B' },
        ],
      },
    ];
    const page = await newSpecPage({
      components: [MdOrganizationChart],
      html: '<md-organization-chart selection-mode="multiple"></md-organization-chart>',
    });
    const el = page.root as HTMLElement & { nodes: unknown; selectedIds: string[] };
    el.nodes = deep;
    el.selectedIds = ['a'];
    await page.waitForChanges();
    const own = page.root?.shadowRoot?.querySelector(
      '[data-id="a"] > .md-org-chart__group',
    );
    expect(own?.hasAttribute('data-trail')).toBe(false);
  });

  it('clears the mark when the selection is withdrawn', async () => {
    const page = await newSpecPage({
      components: [MdOrganizationChart],
      html: '<md-organization-chart selection-mode="multiple"></md-organization-chart>',
    });
    const el = page.root as HTMLElement & { nodes: unknown; selectedIds: string[] };
    el.nodes = nodes;
    el.selectedIds = ['a'];
    await page.waitForChanges();
    el.selectedIds = [];
    await page.waitForChanges();
    const group = page.root?.shadowRoot?.querySelector('.md-org-chart__group');
    // Stale inline geometry would leave a coloured stub behind on a cleared tree.
    expect(group?.hasAttribute('data-trail')).toBe(false);
  });
});
