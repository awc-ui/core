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

type NodeInput = OrgChartNode[] | string | null | undefined;

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
  /** Working selection set (mirrors `selectedIds`). */
  @State() private selection = new Set<string>();
  /** Roving-tabindex owner — the one node reachable with Tab. */
  @State() private activeId = '';

  private nodeMap = new Map<string, OrgChartNode>();

  componentWillLoad() {
    this.syncFromNodes(this.nodes);
    this.selection = new Set(this.selectedIds ?? []);
  }

  @Watch('nodes')
  onNodesChange(next: NodeInput) {
    this.syncFromNodes(next);
  }

  @Watch('selectedIds')
  onSelectedIdsChange(next: string[]) {
    this.selection = new Set(next ?? []);
  }

  /** Parse the incoming nodes, (re)build the id map, seed collapse + active. */
  private syncFromNodes(input: NodeInput) {
    const roots = this.parseNodes(input);
    this.nodeMap = new Map();
    const collapsed = new Set<string>();
    const walk = (list: OrgChartNode[]) => {
      for (const n of list) {
        if (!n || n.id == null) continue;
        this.nodeMap.set(n.id, n);
        if (n.expanded === false && n.children?.length) collapsed.add(n.id);
        if (n.children?.length) walk(n.children);
      }
    };
    walk(roots);
    this.collapsed = collapsed;
    // Keep the roving owner valid; default to the first root.
    if (!this.activeId || !this.nodeMap.has(this.activeId)) {
      this.activeId = roots[0]?.id ?? '';
    }
    this.roots = roots;
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
    return !this.collapsed.has(node.id);
  }

  private hasChildren(node: OrgChartNode): boolean {
    return !!node.children && node.children.length > 0;
  }

  private isSelectable(node: OrgChartNode): boolean {
    return this.selectionMode !== 'none' && node.selectable !== false;
  }

  private toggle(node: OrgChartNode) {
    if (!this.hasChildren(node)) return;
    const next = new Set(this.collapsed);
    const willExpand = next.has(node.id);
    if (willExpand) next.delete(node.id);
    else next.add(node.id);
    this.collapsed = next;
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
        if (this.hasChildren(node) && this.isExpanded(node)) this.toggle(node);
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
        }}
        onKeyDown={this.handleKeyDown}
        onFocus={() => (this.activeId = node.id)}
      >
        <div
          class={{
            'md-org-chart__node': true,
            'md-org-chart__node--selectable': selectable,
            'md-org-chart__node--selected': selected,
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

  render() {
    const roots = this.roots;
    const empty = roots.length === 0;

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
