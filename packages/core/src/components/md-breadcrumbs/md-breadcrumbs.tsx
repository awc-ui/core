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
  forceUpdate,
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

/**
 * @csspart separator - Separator glyph drawn before the overflow toggle (each crumb draws its own `separator` part)
 */
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

  /** The crumb this component promoted to `current` (not one the author marked). */
  private autoCurrent: HTMLMdBreadcrumbItemElement | null = null;
  /** Crumbs this component moved into the tail slot (after the overflow toggle). */
  private tailStamped = new WeakSet<HTMLElement>();
  /** Internal slot that places the crumbs after the collapsed section AFTER the toggle in
   *  DOM (and so in Tab and reading) order, not only visually. */
  private static readonly TAIL_SLOT = 'collapse-tail';
  private currentObserver?: MutationObserver;

  componentWillLoad() {
    // Seed itemCount + collapsed/index/total props on items BEFORE the
    // first render so we don't trigger Stencil's "state changed during
    // componentDidLoad" warning. Light-DOM children are accessible at
    // this lifecycle, only the shadowRoot is not.
    this.refreshItems();
  }

  componentDidLoad() {
    // Both slots: a crumb removed (or re-slotted) from the tail only changes the tail slot.
    this.el.shadowRoot?.querySelectorAll('slot').forEach((slot) =>
      slot.addEventListener('slotchange', () => this.refreshItems()));
    this.observeCurrent();
  }

  connectedCallback() {
    // Re-attach after a reparent (componentDidLoad does not run again).
    if (this.el.shadowRoot?.querySelector('ol')) this.observeCurrent();
  }

  disconnectedCallback() {
    this.currentObserver?.disconnect();
    this.currentObserver = undefined;
  }

  /** An author marking (or unmarking) a crumb `current` at runtime changes which crumb
   *  is the current page without a slotchange; re-run the promotion when it happens.
   *  The component's own writes converge after one extra pass (nothing changes). */
  private observeCurrent() {
    if (this.currentObserver || typeof MutationObserver === 'undefined') return;
    this.currentObserver = new MutationObserver(() => this.refreshItems());
    this.currentObserver.observe(this.el, { subtree: true, attributes: true, attributeFilter: ['current'] });
  }

  @Watch('separator')
  onSeparatorChange() {
    // Each crumb draws its own leading separator from this prop at render time.
    this.collectItems().forEach((item) => forceUpdate(item));
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
      (it, i) => it.current && i !== items.length - 1 && it !== this.autoCurrent,
    );
    if (!manualOverride && items.length > 0) {
      items.forEach((it, i) => {
        it.current = i === items.length - 1;
      });
      this.autoCurrent = items[items.length - 1];
    } else if (manualOverride) {
      // The author's choice wins: withdraw the promotion this component made earlier,
      // so the trail never exposes two `aria-current="page"` crumbs.
      if (this.autoCurrent && this.autoCurrent.current && items.includes(this.autoCurrent)) {
        this.autoCurrent.current = false;
      }
      this.autoCurrent = null;
    } else {
      this.autoCurrent = null;
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
        this.setTail(it, false);
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
      this.setTail(it, fromEnd);
    });
  }

  /** Move a crumb into (or back out of) the tail slot rendered after the overflow toggle.
   *  CSS `order` alone only moved the crumbs visually: Tab and screen readers still met
   *  the toggle after the last crumb ("Home, Roadmap, Q3 plan, Show full trail"). */
  private setTail(it: HTMLElement, tail: boolean) {
    if (tail) {
      if (it.getAttribute('slot') !== MdBreadcrumbs.TAIL_SLOT) it.setAttribute('slot', MdBreadcrumbs.TAIL_SLOT);
      this.tailStamped.add(it);
    } else if (this.tailStamped.has(it)) {
      this.tailStamped.delete(it);
      if (it.getAttribute('slot') === MdBreadcrumbs.TAIL_SLOT) it.removeAttribute('slot');
    }
  }

  private toggleExpanded = () => {
    const firstRevealed = this.collectItems().findIndex((it) => it.collapsed);
    this.setExpanded(!this.expanded);
    // The toggle removes itself from the DOM once the trail is expanded. Move focus to
    // the first revealed crumb that can take it (or the next one after it) instead of
    // dropping it on <body>.
    if (this.expanded && firstRevealed >= 0) this.focusFrom(firstRevealed, 3);
  };

  private focusFrom(start: number, frames: number) {
    const attempt = () => {
      const items = this.collectItems();
      // Crumbs re-render asynchronously after `collapsed` flips: wait (a few frames at
      // most) until the first revealed crumb shows its content again.
      const ready = items[start]?.shadowRoot?.querySelector('a, [part~="static"]');
      if (!ready) {
        if (frames > 0 && typeof requestAnimationFrame === 'function') {
          frames -= 1;
          requestAnimationFrame(attempt);
        }
        return;
      }
      for (let i = start; i < items.length; i += 1) {
        const link = items[i].shadowRoot?.querySelector('a') as HTMLElement | null;
        if (link) {
          link.focus();
          return;
        }
      }
    };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(attempt);
    else attempt();
  }

  private setExpanded(next: boolean) {
    if (this.expanded === next) return;
    this.expanded = next;
    this.applyVisibility(this.collectItems());
    this.mdExpand.emit({ expanded: next, itemCount: this.itemCount });
  }

  /**
   * Programmatically reveal the full breadcrumb trail. No-op when the trail
   * is already expanded. When `maxItems` is `0` (collapsing disabled) nothing
   * visible changes, but the state still flips and `mdExpand` still fires.
   */
  @Method()
  async expand(): Promise<void> {
    this.setExpanded(true);
  }

  /**
   * Programmatically re-collapse the trail to the configured
   * before/after window. No-op when the trail is already collapsed. When
   * `maxItems` is `0` (collapsing disabled) nothing visible changes, but the
   * state still flips and `mdExpand` still fires.
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
          <slot name={MdBreadcrumbs.TAIL_SLOT}></slot>
        </ol>
      </Host>
    );
  }
}
