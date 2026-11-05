import {
  Component,
  Host,
  h,
  Prop,
  State,
  Event,
  EventEmitter,
  Element,
  Watch,
} from '@stencil/core';

/**
 * A single node in the organization tree. Only `id` and `name` are required;
 * everything else is optional so the model stays terse.
 */
export interface OrgChartNode {
  /** Stable identifier — used for selection, expansion, and eventing. */
  id: string;
  /** Primary label (person / unit name), rendered in the emphasis weight. */
  name: string;
  /** Secondary label (role / department), rendered muted under the name. */
  title?: string;
  /** Avatar image URL. Falls back to initials → name-derived initials. */
  avatar?: string;
  /** Explicit avatar initials (overrides name-derived ones). */
  avatarInitials?: string;
  /** Optional accent colour for the node's avatar ring + selected tint. */
  accent?: string;
  /** Initial expanded state for this node's subtree (default: expanded). */
  expanded?: boolean;
  /** When false the node cannot be selected (default: selectable). */
  selectable?: boolean;
  /** Child nodes. */
  children?: OrgChartNode[];
}

/** Accepted public input for organization-chart nodes. */
export type NodeInput = OrgChartNode[] | string | null | undefined;

/** Detail for the `mdSelectionChange` event. */
export interface OrgChartSelectionChangeDetail {
  /** The node that was clicked / toggled. */
  node: OrgChartNode;
  /** The full set of selected ids after the change. */
  selectedIds: string[];
}

/** Detail for the `mdNodeToggle` event. */
export interface OrgChartToggleDetail {
  /** The node whose subtree was expanded / collapsed. */
  node: OrgChartNode;
  /** Whether the node is now expanded. */
  expanded: boolean;
}

/**
 * `md-organization-chart` — Material Design 3 Expressive organization chart.
 *
 * Visualises hierarchical org data as a top-down tree of avatar cards joined
 * by connector lines. Data-driven (`nodes`), with collapsible subtrees,
 * optional single/multiple selection, and the full WAI-ARIA **tree** pattern
 * (roving tabindex, Arrow/Home/End navigation, Enter/Space to select).
 *
 * The surface pans horizontally when it outgrows its container, so a wide org
 * stays usable on small screens. Direction-aware (RTL mirrors the layout and
 * swaps the horizontal arrow keys); every affordance label is a prop for
 * localisation.
 *
 * ```html
 * <md-organization-chart selection-mode="single"></md-organization-chart>
 * <script>
 *   document.querySelector('md-organization-chart').nodes = [{
 *     id: 'ceo', name: 'Amy Elsner', title: 'Founder & CEO',
 *     children: [{ id: 'prod', name: 'Asiya Javayant', title: 'Product Lead' }],
 *   }];
 * </script>
 * ```
 *
 * @csspart branch - A role="treeitem" list item (the node and its subtree)
 * @csspart branch-on-path - A branch on the path from a selection up to its root
 * @csspart node - A node card
 * @csspart node-selected - A selected node card
 */
@Component({
  tag: 'md-organization-chart',
  styleUrl: 'md-organization-chart.css',
  shadow: true,
})
export class MdOrganizationChart {
  @Element() el!: HTMLElement;

  /**
   * The organization tree. Accepts an `OrgChartNode[]` (property) or a JSON
   * string (attribute). Multiple roots are supported (rendered side by side).
   */
  @Prop() nodes: NodeInput = [];

  /**
   * Selection behaviour:
   *   - `'none'`     — nodes are not selectable (default).
   *   - `'single'`   — one node at a time.
   *   - `'multiple'` — any number of nodes.
   */
  @Prop({ reflect: true }) selectionMode: 'none' | 'single' | 'multiple' = 'none';

  /** Selected node ids (controlled + initial). Kept in sync as the user selects. */
  @Prop({ mutable: true }) selectedIds: string[] = [];

  /** Show expand/collapse togglers on nodes that have children. */
  @Prop() collapsible: boolean = true;

  /**
   * Layout direction of the tree:
   *   - `'vertical'`   — top-down (default).
   *   - `'horizontal'` — left-to-right; RTL mirrors it right-to-left.
   *
   * Only the visual layout changes — the tree's ARIA semantics and keyboard
   * model (Arrow Left/Right = collapse/expand, Up/Down = move) are unchanged.
   */
  @Prop({ reflect: true }) orientation: 'vertical' | 'horizontal' = 'vertical';

  /** Accessible name for the tree (localisable). */
  @Prop({ attribute: 'label' }) label: string = 'Organization chart';

  /** Toggler accessible label when a node is collapsed (localisable). */
  @Prop({ attribute: 'expand-label' }) expandLabel: string = 'Expand';

  /** Toggler accessible label when a node is expanded (localisable). */
  @Prop({ attribute: 'collapse-label' }) collapseLabel: string = 'Collapse';

  /**
   * Local density rung. Drives the same `--md-sys-density-scale` signal that a
   * global `data-density` ancestor sets, so a local value simply overrides the
   * inherited one. 0 = default, -4 = ultra-compact.
   */
  @Prop({ reflect: true }) density: 0 | -1 | -2 | -3 | -4 = 0;

  /** Fired when the selection changes. */
  @Event() mdSelectionChange!: EventEmitter<OrgChartSelectionChangeDetail>;

  /** Fired when a node is expanded or collapsed. */
  @Event() mdNodeToggle!: EventEmitter<OrgChartToggleDetail>;

  /** Ids whose subtree is collapsed (default: everything expanded). */
  @State() private collapsed = new Set<string>();
  /**
   * Ids on the selection's ancestry, recomputed each render. Held on the
   * instance rather than threaded through `renderNode`'s arguments because the
   * recursion already carries four.
   */
  private onPath: Set<string> = new Set();

  /** Re-measures the trail when the tree reflows for a non-render reason. */
  private resizeObserver?: ResizeObserver;

  /** Working selection set (mirrors `selectedIds`). */
  @State() private selection = new Set<string>();
  /** Roving-tabindex owner — the one node reachable with Tab. */
  @State() private activeId = '';

  private nodeMap = new Map<string, OrgChartNode>();
  /** Child id → parent id, for keeping the roving owner visible when a branch folds. */
  private parentMap = new Map<string, string>();

  componentWillLoad() {
    this.syncFromNodes(this.nodes);
    this.selection = new Set(this.selectedIds ?? []);
  }

  @Watch('nodes')
  onNodesChange(next: NodeInput) {
    this.refocus = this.focusInTree();
    this.syncFromNodes(next);
  }

  @Watch('collapsible')
  onCollapsibleChange() {
    // Re-enabling folds brings seeded `expanded: false` branches back; keep
    // the roving owner on a row that is still rendered.
    this.refocus = this.focusInTree();
    this.activeId = this.visibleOwner(this.activeId);
  }

  /**
   * Set when new data or a `collapsible` change may un-render the focused row.
   * The re-render then hands focus to the roving owner, so a keyboard user is
   * not dropped to `<body>` — only when focus was on a row to begin with.
   */
  private refocus = false;

  private focusInTree(): boolean {
    const active = this.el.shadowRoot?.activeElement as HTMLElement | null | undefined;
    return !!active && active.getAttribute('role') === 'treeitem';
  }

  @Watch('selectedIds')
  onSelectedIdsChange(next: string[]) {
    this.selection = new Set(next ?? []);
  }

  /** Parse the incoming nodes, (re)build the id map, seed collapse + active. */
  private syncFromNodes(input: NodeInput) {
    const roots = this.parseNodes(input);
    this.nodeMap = new Map();
    this.parentMap = new Map();
    const collapsed = new Set<string>();
    const walk = (list: OrgChartNode[], parent?: string) => {
      for (const n of list) {
        if (!n || n.id == null) continue;
        this.nodeMap.set(n.id, n);
        if (parent !== undefined) this.parentMap.set(n.id, parent);
        if (n.expanded === false && n.children?.length) collapsed.add(n.id);
        if (n.children?.length) walk(n.children, n.id);
      }
    };
    walk(roots);
    this.collapsed = collapsed;
    // Keep the roving owner valid; default to the first root.
    if (!this.activeId || !this.nodeMap.has(this.activeId)) {
      this.activeId = roots[0]?.id ?? '';
    }
    // …and visible: a fold in the new data may hide it, which would leave the
    // tree with no tab stop at all. The nearest visible ancestor takes it over.
    this.activeId = this.visibleOwner(this.activeId);
    this.roots = roots;
  }

  /**
   * The id that is actually rendered for `id`: itself, or — when a collapsed
   * ancestor hides it — the outermost collapsed ancestor, which is the visible
   * row closest to it.
   */
  private visibleOwner(id: string): string {
    let owner = id;
    for (let cur = this.parentMap.get(id); cur !== undefined; cur = this.parentMap.get(cur)) {
      const parent = this.nodeMap.get(cur);
      if (parent && !this.isExpanded(parent)) owner = cur;
    }
    return owner;
  }

  private roots: OrgChartNode[] = [];

  private parseNodes(input: NodeInput): OrgChartNode[] {
    if (Array.isArray(input)) return input;
    if (typeof input === 'string' && input.trim()) {
      try {
        const parsed = JSON.parse(input);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        return [];
      }
    }
    return [];
  }

  private isExpanded(node: OrgChartNode): boolean {
    // `collapsible="false"` locks every branch open, including ones the data
    // seeds as `expanded: false` (there is no toggler to open them).
    return !this.collapsible || !this.collapsed.has(node.id);
  }

  private hasChildren(node: OrgChartNode): boolean {
    return !!node.children && node.children.length > 0;
  }

  private isSelectable(node: OrgChartNode): boolean {
    return this.selectionMode !== 'none' && node.selectable !== false;
  }

  private toggle(node: OrgChartNode) {
    if (!this.collapsible || !this.hasChildren(node)) return;
    const next = new Set(this.collapsed);
    const willExpand = next.has(node.id);
    if (willExpand) next.delete(node.id);
    else next.add(node.id);
    this.collapsed = next;
    // Folding a branch that holds the roving owner hands the tab stop to the
    // branch itself; otherwise the owner un-renders and Tab skips the tree.
    if (!willExpand) this.activeId = this.visibleOwner(this.activeId);
    this.mdNodeToggle.emit({ node, expanded: willExpand });
  }

  private select(node: OrgChartNode) {
    if (!this.isSelectable(node)) return;
    const next = new Set(this.selection);
    if (this.selectionMode === 'single') {
      const wasOnlySelected = next.has(node.id) && next.size === 1;
      next.clear();
      if (!wasOnlySelected) next.add(node.id);
    } else {
      if (next.has(node.id)) next.delete(node.id);
      else next.add(node.id);
    }
    this.selection = next;
    this.selectedIds = Array.from(next);
    this.mdSelectionChange.emit({ node, selectedIds: this.selectedIds });
  }

  // ── Keyboard: WAI-ARIA tree pattern ──────────────────────────────────────
  private visibleItems(): HTMLElement[] {
    return Array.from(
      this.el.shadowRoot?.querySelectorAll('li[role="treeitem"]') ?? [],
    ) as HTMLElement[];
  }

  private itemFor(node: OrgChartNode): HTMLElement | null {
    return (
      (this.el.shadowRoot?.querySelector(
        `li[role="treeitem"][data-id="${cssEscape(node.id)}"]`,
      ) as HTMLElement | null) ?? null
    );
  }

  private focusItem(el: HTMLElement | null | undefined) {
    if (!el) return;
    const id = el.getAttribute('data-id');
    if (id) this.activeId = id;
    el.focus();
  }

  private firstChildItem(li: HTMLElement): HTMLElement | null {
    const group = Array.from(li.children).find(
      (c) => (c as HTMLElement).getAttribute?.('role') === 'group',
    ) as HTMLElement | undefined;
    if (!group) return null;
    return (
      (Array.from(group.children).find(
        (c) => (c as HTMLElement).getAttribute?.('role') === 'treeitem',
      ) as HTMLElement | undefined) ?? null
    );
  }

  private parentItem(li: HTMLElement): HTMLElement | null {
    const group = li.parentElement;
    if (!group || group.getAttribute('role') !== 'group') return null;
    const parent = group.parentElement;
    return parent && parent.getAttribute('role') === 'treeitem'
      ? (parent as HTMLElement)
      : null;
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    const current = e.target as HTMLElement;
    if (!current || current.getAttribute?.('role') !== 'treeitem') return;
    const node = this.nodeMap.get(current.getAttribute('data-id') ?? '');
    if (!node) return;

    const rtl = getComputedStyle(this.el).direction === 'rtl';
    const forwardKey = rtl ? 'ArrowLeft' : 'ArrowRight';
    const backwardKey = rtl ? 'ArrowRight' : 'ArrowLeft';
    const items = this.visibleItems();
    const idx = items.indexOf(current);

    switch (e.key) {
      case 'ArrowDown':
        this.focusItem(items[idx + 1]);
        break;
      case 'ArrowUp':
        this.focusItem(items[idx - 1]);
        break;
      case forwardKey:
        if (this.hasChildren(node)) {
          if (!this.isExpanded(node)) this.toggle(node);
          else this.focusItem(this.firstChildItem(current));
        }
        break;
      case backwardKey:
        if (this.collapsible && this.hasChildren(node) && this.isExpanded(node)) this.toggle(node);
        else this.focusItem(this.parentItem(current));
        break;
      case 'Home':
        this.focusItem(items[0]);
        break;
      case 'End':
        this.focusItem(items[items.length - 1]);
        break;
      case 'Enter':
      case ' ':
      case 'Spacebar':
        if (this.isSelectable(node)) this.select(node);
        else if (this.hasChildren(node)) this.toggle(node);
        break;
      default:
        return;
    }
    e.preventDefault();
    e.stopPropagation();
  };

  private handleNodeClick = (node: OrgChartNode) => (e: MouseEvent) => {
    // Toggler clicks are handled on the toggler itself.
    if ((e.target as HTMLElement)?.closest('.md-org-chart__toggle')) return;
    this.activeId = node.id;
    if (this.isSelectable(node)) this.select(node);
  };

  private handleTogglerClick = (node: OrgChartNode) => (e: MouseEvent) => {
    e.stopPropagation();
    this.toggle(node);
    // The toggler is aria-hidden and out of the tab order, but a pointer press
    // still focuses its inner button — focus that AT cannot see, and that a
    // fold may have taken from a row inside the branch. Hand it to the row the
    // toggler belongs to, which also becomes the roving owner.
    this.activeId = node.id;
    this.itemFor(node)?.focus();
  };

  private renderNode(node: OrgChartNode, level: number, posInSet: number, setSize: number) {
    const has = this.hasChildren(node);
    const expanded = this.isExpanded(node);
    const selectable = this.isSelectable(node);
    const selected = selectable && this.selection.has(node.id);
    const tabbable = node.id === this.activeId;
    const showToggle = this.collapsible && has;

    return (
      <li
        role="treeitem"
        data-id={node.id}
        aria-level={level}
        aria-setsize={setSize}
        aria-posinset={posInSet}
        aria-expanded={has ? String(expanded) : undefined}
        aria-selected={selectable ? String(selected) : undefined}
        tabindex={tabbable ? '0' : '-1'}
        class={{
          'md-org-chart__branch': true,
          'md-org-chart__branch--collapsed': has && !expanded,
          'md-org-chart__branch--on-path': this.onPath.has(node.id),
        }}
        part={`branch${this.onPath.has(node.id) ? ' branch-on-path' : ''}`}
        onKeyDown={this.handleKeyDown}
        onFocus={() => (this.activeId = node.id)}
      >
        <div
          class={{
            'md-org-chart__node': true,
            'md-org-chart__node--selectable': selectable,
            'md-org-chart__node--selected': selected,
            'md-org-chart__node--accent': !!node.accent,
          }}
          part={`node${selected ? ' node-selected' : ''}`}
          style={node.accent ? { '--_accent': node.accent } : undefined}
          onClick={this.handleNodeClick(node)}
        >
          <span class="md-org-chart__state-layer" part="state-layer" aria-hidden="true"></span>
          {selectable && <md-ripple class="md-org-chart__ripple"></md-ripple>}
          <md-avatar
            class="md-org-chart__avatar"
            part="avatar"
            exportparts="image: avatar-image"
            // Decorative: the node's name is already announced as the treeitem's
            // text, so exposing the avatar's label would double-speak it. The
            // auto per-name palette is disabled in favour of a fixed AA-contrast
            // pair (see CSS) — initials here are a photo fallback, not identity.
            aria-hidden="true"
            colorFromName={false}
            src={node.avatar}
            initials={node.avatarInitials}
            name={node.name}
            size="medium"
            shape="circle"
          ></md-avatar>
          <span class="md-org-chart__text">
            <span class="md-org-chart__name" part="name">{node.name}</span>
            {node.title && (
              <span class="md-org-chart__title" part="title">{node.title}</span>
            )}
          </span>
          {showToggle && (
            // Decorative pointer affordance: expand/collapse is exposed to AT via
            // the treeitem's aria-expanded + Arrow keys, so the button is
            // aria-hidden and taken out of the tab order (group-tabindex=-1) to
            // avoid a nested interactive control inside the treeitem. The label
            // rides in the library md-tooltip rather than a native `title`.
            <md-tooltip
              class="md-org-chart__toggle-tip"
              text={expanded ? this.collapseLabel : this.expandLabel}
              position="bottom"
            >
              <md-icon-button
                class="md-org-chart__toggle"
                part="toggle"
                icon={expanded ? 'expand_less' : 'expand_more'}
                size="xs"
                variant="tonal"
                shape="round"
                aria-hidden="true"
                group-tabindex={-1}
                onPointerDown={(e: PointerEvent) => e.stopPropagation()}
                onClick={this.handleTogglerClick(node)}
              ></md-icon-button>
            </md-tooltip>
          )}
        </div>

        {has && expanded && (
          <ul role="group" class="md-org-chart__group" part="group">
            {node.children!.map((child, i) =>
              this.renderNode(child, level + 1, i + 1, node.children!.length),
            )}
          </ul>
        )}
      </li>
    );
  }

  /**
   * Every id on the path from a selected node up to its root, the selected
   * nodes included.
   *
   * A selection deep in a wide tree is easy to find and hard to PLACE: the node
   * is outlined, but which parent it hangs off — and which parent that one hangs
   * off — is left to the reader to trace by eye across identical grey
   * connectors. Marking the ancestry lets the connectors themselves answer it.
   *
   * `.map(walk)` before `.some()` on purpose: `some()` alone would short-circuit
   * on the first hit and leave the rest of the subtree unmarked, so a second
   * selection in a later branch would lose its trail.
   */
  private pathToSelection(roots: OrgChartNode[]): Set<string> {
    const path = new Set<string>();
    if (this.selection.size === 0) return path;
    const walk = (node: OrgChartNode): boolean => {
      const below = (node.children ?? []).map(walk).some(Boolean);
      // Only a node that can actually be selected draws a trail: ids in
      // `selectedIds` that `selection-mode="none"` or `selectable: false`
      // exempt are not shown as selected, so they must not be traced either.
      const hit = below || (this.isSelectable(node) && this.selection.has(node.id));
      if (hit) path.add(node.id);
      return hit;
    };
    for (const root of roots) walk(root);
    return path;
  }

  /**
   * Draw the trail's RUN — the stretch of bus between the parent's drop and the
   * selected child's riser — by measuring it.
   *
   * The bus is tiled from a half per child, and the parent's drop stands at the
   * group's 50% — which lands on a half boundary only when every sibling is the
   * same size. They are not: a node is sized by its own name. Tinting whole
   * halves therefore stopped at the boundary NEAREST the drop and left a visible
   * stub of grey between the two, which is the one thing a trail must not do.
   * Rounding the other way overshoots past the junction instead; there is no
   * arithmetic over shared halves that lands on an arbitrary percentage.
   *
   * So the run is one element, positioned from real geometry. Four other shapes
   * were tried against this connector geometry and each broke somewhere:
   *
   *   - Tinting a branch's own bus halves paints its FULL width, so the colour
   *     ran past the riser and ended mid-air over the neighbour.
   *   - Tinting only the halves the run covers whole leaves the piece containing
   *     the drop untinted, because the drop lands at a percentage and a border
   *     cannot stop partway — a grey stub short of the junction.
   *   - Tinting the half the on-path branch owns overshoots the other way when
   *     that branch is wider than its sibling.
   *   - A straight overlay across the whole run cannot round the elbow where the
   *     bus turns into a node, so the grey arc showed through.
   *
   * One L-shaped box solves all four, because it is drawn the way the connectors
   * themselves are: a border along the bus, a border down the riser, and a
   * corner radius joining them.
   *
   * EVERY END IS READ FROM THE BORDER IT MEETS, not derived from centres. The
   * drop and each riser are borders of pseudo-elements, and which side of a
   * branch's centre the riser's pixels sit on depends on which pseudo draws it
   * (the last child's riser is on `::before`, everyone else's on `::after`), on
   * the reading direction (the borders are logical) and on the orientation (the
   * bus is horizontal in a vertical tree and vertical in a horizontal one).
   * Chrome also draws a 1.5px border 1px wide at DPR 1. Reading each border's
   * used box makes the run land on exactly the pixels the grey connector
   * occupies, so selecting a node moves nothing and doubles no line — in every
   * orientation and direction, where the old centre arithmetic was right only
   * for a left-to-right, top-down tree.
   *
   * Several selections in one group still form one contiguous run: they all
   * end at the same drop, so the hull of the drop and the outermost riser on
   * each side covers every one of them, and the box draws the riser at each end
   * it reaches. Risers in between keep their own tint (a square T, as the grey
   * bus has there).
   */
  private measureTrail() {
    const root = this.el.shadowRoot;
    if (!root) return;
    const eps = 0.5;
    const horizontal = this.orientation === 'horizontal';
    const rtl = getComputedStyle(this.el).direction === 'rtl';

    const clearRun = (el: HTMLElement) => {
      el.removeAttribute('data-trail-run');
      el.removeAttribute('data-trail-elbow');
      for (const k of ['--_trail-x', '--_trail-w', '--_trail-y', '--_trail-h']) el.style.removeProperty(k);
    };

    /*
     * The used border of a pseudo-element on the bus axis: the interval its
     * pixels occupy, from the owner's box plus the pseudo's resolved offsets
     * (an absolutely positioned pseudo reports used px for every inset).
     * `sides` are the borders that can be the line there; the one with a width
     * is it.
     */
    const line = (owner: Element, pseudo: string, sides: Array<'top' | 'right' | 'bottom' | 'left'>) => {
      const r = owner.getBoundingClientRect();
      const c = getComputedStyle(owner, pseudo);
      const w = { top: parseFloat(c.borderTopWidth), right: parseFloat(c.borderRightWidth), bottom: parseFloat(c.borderBottomWidth), left: parseFloat(c.borderLeftWidth) };
      const content = c.boxSizing !== 'border-box';
      const x0 = r.left + parseFloat(c.left);
      const y0 = r.top + parseFloat(c.top);
      const x1 = x0 + parseFloat(c.width) + (content ? w.left + w.right : 0);
      const y1 = y0 + parseFloat(c.height) + (content ? w.top + w.bottom : 0);
      const side = sides.find((k) => w[k] > 0);
      if (!side) return null;
      const at: Record<string, [number, number]> = {
        left: [x0, x0 + w.left], right: [x1 - w.right, x1], top: [y0, y0 + w.top], bottom: [y1 - w.bottom, y1],
      };
      return at[side];
    };
    const across: Array<'top' | 'right' | 'bottom' | 'left'> = horizontal ? ['top', 'bottom'] : ['left', 'right'];

    for (const group of Array.from(root.querySelectorAll('.md-org-chart__group'))) {
      const el = group as HTMLElement;
      const branches = Array.from(group.children).filter((li) =>
        li.classList.contains('md-org-chart__branch'),
      ) as HTMLElement[];

      // Cleared for trees rendered by an earlier version that hid branch borders.
      for (const li of branches) {
        li.removeAttribute('data-trail-drawn');
        li.removeAttribute('data-trail-hide');
      }

      const onPath = branches.filter((li) => li.classList.contains('md-org-chart__branch--on-path'));
      if (onPath.length === 0) {
        // No child of THIS group is on the trail, so its drop stays grey — the
        // trail climbs towards the root and must not run on down into the
        // selection's own children, which are not on it.
        el.removeAttribute('data-trail');
        clearRun(el);
        continue;
      }

      // The drop is tinted whenever something below is on the trail, INCLUDING
      // for an only child — which has no bus and no riser at all (both pseudos
      // are `display: none`), so the drop is the entire connection.
      el.setAttribute('data-trail', '');
      const drop = branches.length < 2 ? null : line(el, '::before', horizontal ? ['top'] : ['left', 'right']);
      if (!drop) {
        clearRun(el);
        continue;
      }

      const last = branches[branches.length - 1];
      const riserOf = (li: HTMLElement) => line(li, li === last ? '::before' : '::after', across);
      const dropMid = (drop[0] + drop[1]) / 2;
      const mid = (at: [number, number]) => (at[0] + at[1]) / 2;
      const risers = onPath
        .map((li) => ({ li, at: riserOf(li) }))
        .filter((r): r is { li: HTMLElement; at: [number, number] } => !!r.at);
      const before = risers.filter((r) => mid(r.at) < dropMid - eps);
      const after = risers.filter((r) => mid(r.at) > dropMid + eps);
      if (before.length === 0 && after.length === 0) {
        // The riser stands directly under the drop — no run exists, and the
        // drop's and the branch's own tints are the whole trail at this level.
        clearRun(el);
        continue;
      }

      const from = Math.min(drop[0], ...before.map((r) => r.at[0]));
      const to = Math.max(drop[1], ...after.map((r) => r.at[1]));

      /*
       * Physical sides and corners. The bus border is the box's top in a
       * vertical tree, and its inline-start side in a horizontal one; a riser
       * border is drawn at each end the run reaches. The grey connector rounds
       * only at the outermost branch on each side, so the box does too.
       */
      const [lo, hi] = horizontal ? ['top', 'bottom'] : ['left', 'right'];
      const bus = horizontal ? (rtl ? 'right' : 'left') : 'top';
      const sides = [bus];
      const corners: string[] = [];
      const outermost = (side: 'lo' | 'hi') => {
        if (horizontal) return side === 'hi' ? last : branches[0];
        const xs = branches.map((li) => li.getBoundingClientRect().left);
        return branches[xs.indexOf(side === 'hi' ? Math.max(...xs) : Math.min(...xs))];
      };
      const corner = (end: string) => (horizontal ? `${end}-${bus}` : `${bus}-${end}`);
      if (before.length) {
        sides.push(lo);
        if (before.some((r) => r.li === outermost('lo'))) corners.push(corner(lo));
      }
      if (after.length) {
        sides.push(hi);
        if (after.some((r) => r.li === outermost('hi'))) corners.push(corner(hi));
      }

      const box = el.getBoundingClientRect();
      el.setAttribute('data-trail-run', sides.join(' '));
      if (corners.length) el.setAttribute('data-trail-elbow', corners.join(' '));
      else el.removeAttribute('data-trail-elbow');
      if (horizontal) {
        el.style.setProperty('--_trail-y', `${from - box.top}px`);
        el.style.setProperty('--_trail-h', `${to - from}px`);
        el.style.removeProperty('--_trail-x');
        el.style.removeProperty('--_trail-w');
      } else {
        el.style.setProperty('--_trail-x', `${from - box.left}px`);
        el.style.setProperty('--_trail-w', `${to - from}px`);
        el.style.removeProperty('--_trail-y');
        el.style.removeProperty('--_trail-h');
      }
    }
  }

  componentDidRender() {
    if (this.refocus) {
      this.refocus = false;
      const owner = this.el.shadowRoot?.querySelector(
        `li[role="treeitem"][data-id="${cssEscape(this.activeId)}"]`,
      ) as HTMLElement | null | undefined;
      if (owner && this.el.shadowRoot?.activeElement !== owner) owner.focus();
    }
    this.measureTrail();
  }

  componentDidLoad() {
    /*
     * Re-measure when the tree changes shape for a reason no render caused — a
     * font finishing loading, the container narrowing, a density change
     * reflowing every node.
     *
     * BOTH boxes are watched, because neither catches the other's case. The
     * viewport is the scroll container: it tracks the space available and is
     * unmoved by anything happening inside it. The tree is `max-content`, so it
     * tracks the CONTENT — which is the one that changes when a webfont lands
     * and every node grows by a few pixels. Watching only the viewport left the
     * run measured against fallback-font widths and ending ~9px short of the
     * drop, which is exactly the gap this whole approach exists to close.
     */
    if (typeof ResizeObserver === 'undefined') return;
    this.resizeObserver = new ResizeObserver(() => this.measureTrail());
    for (const sel of ['.md-org-chart__viewport', '.md-org-chart__tree']) {
      const box = this.el.shadowRoot?.querySelector(sel);
      if (box) this.resizeObserver.observe(box);
    }

    /*
     * A webfont swap resizes the tree, so the observer above already covers it —
     * but only if the tree is in the document when it lands. A chart rendered
     * into a hidden tab has no box to resize and gets its first real geometry on
     * reveal, by which time `fonts.ready` has long resolved. Cheap insurance,
     * once per instance.
     */
    void (document as Document & { fonts?: FontFaceSet }).fonts?.ready.then(() =>
      this.measureTrail(),
    );

    /*
     * RE-MEASURE WHEN THE ENTER ANIMATION ENDS.
     *
     * Expanding a collapsed subtree runs `md-org-chart-grow`, which animates a
     * `scale()`. A transform does not change layout size, so the ResizeObserver
     * above never fires — but `getBoundingClientRect()` reports the SCALED box
     * while it runs, so a measurement taken then is against a geometry the tree
     * never settles at. Collapsing the root and reopening it left the run short
     * of the drop by exactly that error.
     *
     * The listener is on the viewport and catches the animation as it bubbles,
     * so it covers every group without one listener per group.
     */
    this.el.shadowRoot
      ?.querySelector('.md-org-chart__viewport')
      ?.addEventListener('animationend', this.remeasure);
  }

  /** Bound so the same reference can be removed on disconnect. */
  private remeasure = () => this.measureTrail();

  disconnectedCallback() {
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    this.el.shadowRoot
      ?.querySelector('.md-org-chart__viewport')
      ?.removeEventListener('animationend', this.remeasure);
  }

  render() {
    const roots = this.roots;
    const empty = roots.length === 0;
    this.onPath = this.pathToSelection(roots);

    return (
      <Host
        class={{
          'md-org-chart': true,
          'md-org-chart--empty': empty,
        }}
      >
        <div class="md-org-chart__viewport" part="viewport">
          {empty ? (
            <div class="md-org-chart__empty" part="empty" role="status">
              <slot name="empty">No data</slot>
            </div>
          ) : (
            <ul
              role="tree"
              class="md-org-chart__tree"
              part="tree"
              aria-label={this.label}
              aria-multiselectable={
                this.selectionMode === 'multiple' ? 'true' : undefined
              }
            >
              {roots.map((root, i) => this.renderNode(root, 1, i + 1, roots.length))}
            </ul>
          )}
        </div>
      </Host>
    );
  }
}

/** Minimal CSS.escape shim (attribute-selector safe) for id values. */
function cssEscape(value: string): string {
  return String(value).replace(/["\\\]]/g, '\\$&');
}
