import {
  Component,
  Host,
  h,
  Prop,
  Element,
  State,
  Watch,
  Event,
  EventEmitter,
  Method,
} from '@stencil/core';

/**
 * Detail payload emitted by `md-breadcrumbs`'s `mdExpand` event when the
 * collapsed middle section is revealed (or, less commonly, re-collapsed
 * via the `collapse()` method).
 */
export interface MdBreadcrumbsExpandDetail {
  /** New expanded state — `true` means the full trail is now visible. */
  expanded: boolean;
  /** Total number of crumbs in the trail. */
  itemCount: number;
}

@Component({
  tag: 'md-breadcrumbs',
  styleUrl: 'md-breadcrumbs.css',
  shadow: true,
})
export class MdBreadcrumbs {
  @Element() el!: HTMLElement;

  /** Accessible name. Defaults to "Breadcrumb". */
  @Prop() label: string = 'Breadcrumb';

  /**
   * Accessible name for the overflow ("…") toggle button. Surface this
   * in your i18n layer so screen-reader users in non-English locales hear
   * a localized announcement when collapsing is in effect.
   */
  @Prop({ attribute: 'expand-label' }) expandLabel: string = 'Show full breadcrumb trail';

  /**
   * Separator glyph placed between items. Use any single character
   * or short string (e.g. `/`, `›`, `→`, `»`). For SVG / icon
   * separators, override `::part(separator)` from the light DOM
   * with a CSS `background-image` — see readme.
   */
  @Prop() separator: string = '/';

  /**
   * When the number of crumbs exceeds `maxItems`, the middle ones
   * collapse behind an "…" toggle. Set to `0` to disable collapsing.
   */
  @Prop({ attribute: 'max-items' }) maxItems: number = 0;

  /**
   * How many items to ALWAYS show at the start of the trail when
   * collapsed. Default 1.
   */
  @Prop({ attribute: 'items-before-collapse' }) itemsBeforeCollapse: number = 1;

  /**
   * How many items to ALWAYS show at the end of the trail when
   * collapsed. Default 2.
   */
  @Prop({ attribute: 'items-after-collapse' }) itemsAfterCollapse: number = 2;

  /**
   * Local density rung. Drives the same `--md-sys-density-scale` signal that a
   * global `data-density` ancestor sets, so a local value simply overrides the
   * inherited one. 0 = default, -4 = ultra-compact.
   */
  @Prop({ reflect: true }) density: 0 | -1 | -2 | -3 | -4 = 0;

  /**
   * Fires when the user reveals the full breadcrumb trail by activating
   * the overflow ("…") toggle, or when consumers programmatically call
   * `expand()` / `collapse()`. Not cancelable — the visibility change
   * has already happened. Use it for analytics or to react to a user
   * who wants to see the full path.
   *
   * Bubbles + composed, so consumers outside the shadow tree (the typical
   * case) receive it.
   */
  @Event({ bubbles: true, composed: true })
  mdExpand!: EventEmitter<MdBreadcrumbsExpandDetail>;

  @State() private expanded: boolean = false;
  @State() private itemCount = 0;

  componentWillLoad() {
    // Seed itemCount + collapsed/index/total props on items BEFORE the
    // first render so we don't trigger Stencil's "state changed during
    // componentDidLoad" warning. Light-DOM children are accessible at
    // this lifecycle, only the shadowRoot is not.
    this.refreshItems();
  }

  componentDidLoad() {
    const main = this.el.shadowRoot?.querySelector(
      'slot:not([name])',
    ) as HTMLSlotElement | null;
    main?.addEventListener('slotchange', () => this.refreshItems());
  }

  @Watch('maxItems')
  @Watch('itemsBeforeCollapse')
  @Watch('itemsAfterCollapse')
  onCollapseConfigChange() {
    this.refreshItems();
  }

  private refreshItems() {
    const items = this.collectItems();
    this.itemCount = items.length;
    items.forEach((item, i) => {
      item.itemIndex = i;
      item.itemTotal = items.length;
    });
    // Auto-promote the last item to current unless a non-last item
    // has been explicitly marked current by the consumer.
    const manualOverride = items.some(
      (it, i) => it.current && i !== items.length - 1,
    );
    if (!manualOverride && items.length > 0) {
      items.forEach((it, i) => {
        it.current = i === items.length - 1;
      });
    }
    this.applyVisibility(items);
  }

  private collectItems(): HTMLMdBreadcrumbItemElement[] {
    // Iterate direct children manually instead of using
    // `:scope > md-breadcrumb-item` — the latter isn't supported by
    // Stencil's mock-doc test environment, and the manual loop is
    // also slightly cheaper at runtime.
    const result: HTMLMdBreadcrumbItemElement[] = [];
    const children = this.el.children;
    for (let i = 0; i < children.length; i += 1) {
      const child = children[i];
      if (child.tagName === 'MD-BREADCRUMB-ITEM') {
        result.push(child as HTMLMdBreadcrumbItemElement);
      }
    }
    return result;
  }

  private applyVisibility(items: HTMLMdBreadcrumbItemElement[]) {
    if (
      this.expanded ||
      this.maxItems <= 0 ||
      items.length <= this.maxItems
    ) {
      // No collapsing — clear any previously-set CSS order so the
      // items lay out in their natural DOM sequence.
      items.forEach((it) => {
        it.collapsed = false;
        it.style.removeProperty('order');
      });
      return;
    }
    const before = Math.max(0, this.itemsBeforeCollapse);
    const after = Math.max(1, this.itemsAfterCollapse);
    items.forEach((it, i) => {
      const fromStart = i < before;
      const fromEnd = i >= items.length - after;
      it.collapsed = !(fromStart || fromEnd);
      // Position before-items at order:0 (default), after-items at
      // order:2 so the overflow toggle (order:1, set in CSS) lands
      // visually between them. Collapsed items use `display:none`
      // so their order doesn't matter.
      if (fromEnd) {
        it.style.order = '2';
      } else {
        it.style.removeProperty('order');
      }
    });
  }

  private toggleExpanded = () => {
    this.setExpanded(!this.expanded);
  };

  private setExpanded(next: boolean) {
    if (this.expanded === next) return;
    this.expanded = next;
    this.applyVisibility(this.collectItems());
    this.mdExpand.emit({ expanded: next, itemCount: this.itemCount });
  }

  /**
   * Programmatically reveal the full breadcrumb trail. Has no effect when
   * `maxItems` is `0` (collapsing disabled) or when the trail is already
   * expanded. Emits `mdExpand` when the state changes.
   */
  @Method()
  async expand(): Promise<void> {
    this.setExpanded(true);
  }

  /**
   * Programmatically re-collapse the trail to the configured
   * before/after window. Has no effect when collapsing is disabled or
   * when the trail is already collapsed. Emits `mdExpand` when the state
   * changes.
   */
  @Method()
  async collapse(): Promise<void> {
    this.setExpanded(false);
  }

  private renderSeparator(key: number) {
    // Custom visuals can be supplied via `::part(separator)` styling
    // (e.g. `content: ''` + `background-image`) — see readme. We don't
    // expose a `<slot name="separator">` because a single named slot
    // can only project content into one shadow-tree position, and a
    // breadcrumb trail needs visually-identical separators between
    // every pair of items.
    return (
      <span
        class="md-breadcrumbs__separator"
        part={`separator separator-${key}`}
        aria-hidden="true"
      >
        {this.separator}
      </span>
    );
  }

  render() {
    const showCollapseToggle =
      this.maxItems > 0 &&
      this.itemCount > this.maxItems &&
      !this.expanded;

    return (
      <Host class="md-breadcrumbs" role="navigation" aria-label={this.label}>
        <ol class="md-breadcrumbs__list" part="list">
          {/* Slot stays in flow; we visually insert separators around it
              via `::slotted` and the data-attrs the parent maintains. */}
          <slot></slot>
          {showCollapseToggle && (
            <li class="md-breadcrumbs__overflow" part="overflow">
              {/* Render the leading separator only when there's an
                  item to the LEFT of the overflow (i.e. a "before"
                  item). When `items-before-collapse=0`, the overflow
                  is the very first thing in the trail, so a leading
                  separator would dangle. The trailing separator is
                  intentionally NOT rendered here — the first "after"
                  item already renders its own leading separator
                  (because its `itemIndex > 0`), which serves as the
                  separator between the overflow toggle and the
                  resumed trail. */}
              {Math.max(0, this.itemsBeforeCollapse) > 0
                ? this.renderSeparator(-2)
                : null}
              <button
                type="button"
                class="md-breadcrumbs__overflow-btn"
                part="overflow-button"
                aria-label={this.expandLabel}
                aria-expanded={this.expanded ? 'true' : 'false'}
                onClick={this.toggleExpanded}
              >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
                  <circle cx="6" cy="12" r="1.6"/>
                  <circle cx="12" cy="12" r="1.6"/>
                  <circle cx="18" cy="12" r="1.6"/>
                </svg>
              </button>
            </li>
          )}
        </ol>
      </Host>
    );
  }
}
