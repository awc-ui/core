import {
  Component,
  Host,
  h,
  Prop,
  Element,
  State,
  Event,
  EventEmitter,
} from '@stencil/core';
import { sanitizeHref, SAFE_LINK_REL } from '../../utils/url';

/**
 * Detail payload emitted by `md-breadcrumb-item`'s `mdSelect` event when the
 * user activates a navigable crumb (via mouse, touch, or keyboard).
 */
export interface MdBreadcrumbSelectDetail {
  /** Destination URL of the activated crumb (empty string when none). */
  href: string;
  /** Plain-text label of the activated crumb. */
  label: string;
  /** Whether the activated crumb is marked as the current page. */
  current: boolean;
  /** Position of the activated crumb in the trail (0-indexed). */
  itemIndex: number;
  /** Total number of crumbs in the trail. */
  itemTotal: number;
  /** The original DOM event that triggered the activation. */
  originalEvent: MouseEvent | KeyboardEvent;
}

@Component({
  tag: 'md-breadcrumb-item',
  styleUrl: 'md-breadcrumb-item.css',
  shadow: true,
})
export class MdBreadcrumbItem {
  @Element() el!: HTMLElement;

  /** Destination URL. When empty the item renders as a plain span. */
  @Prop() href: string = '';

  /** Anchor `target` attribute (e.g. `_blank`). */
  @Prop() target: string = '';

  /** Anchor `rel` attribute. */
  @Prop() rel: string = '';

  /**
   * When `true`, mark this item as the current page. Usually the parent
   * `md-breadcrumbs` auto-sets this on the last child, but explicit
   * override is supported.
   */
  @Prop({ reflect: true }) current: boolean = false;

  /** Optional leading icon (Material Symbols shorthand). */
  @Prop() icon: string = '';

  /** Disable the item — renders without an anchor and is not focusable. */
  @Prop({ reflect: true }) disabled: boolean = false;

  /**
   * Marks this item as part of the collapsed middle section. Usually
   * set by the parent `md-breadcrumbs` when `max-items` is exceeded.
   * Declared as a public prop (instead of just a `data-*` attribute) so
   * Stencil re-renders the item when the parent toggles its visibility.
   */
  @Prop({ reflect: true }) collapsed: boolean = false;

  /**
   * Position in the trail (0-indexed). Set automatically by the parent
   * `md-breadcrumbs`. Exposed as a reactive prop so children re-render
   * the leading separator when their position changes.
   */
  @Prop() itemIndex: number = 0;

  /**
   * Total number of items in the trail. Set automatically by the parent.
   */
  @Prop() itemTotal: number = 0;

  /**
   * Local density rung. Drives the same `--md-sys-density-scale` signal that a
   * global `data-density` ancestor sets, so a local value simply overrides the
   * inherited one. 0 = default, -4 = ultra-compact.
   */
  @Prop({ reflect: true }) density: 0 | -1 | -2 | -3 | -4 = 0;

  /**
   * Fires when the user activates a navigable crumb — i.e. when an item with
   * a non-empty `href` (and not marked `current` / `disabled`) is clicked or
   * activated with `Enter` while focused. The event is **cancelable**:
   * call `event.preventDefault()` from the listener to stop the browser's
   * default navigation. This is the recommended hook for SPA routing — let
   * the breadcrumb render a real `<a>` (so right-click / middle-click /
   * "Open in new tab" still work), then intercept `mdSelect` to push the
   * route through your client-side router instead of a full page reload.
   *
   * The event bubbles, so consumers can attach a single listener on the
   * parent `<md-breadcrumbs>` for delegation. The event is composed, so
   * listeners outside the shadow tree (the typical case) receive it.
   *
   * ```ts
   * document.querySelector('md-breadcrumbs')!
   *   .addEventListener('mdSelect', (e) => {
   *     const { href, label, itemIndex } = (e as CustomEvent).detail;
   *     e.preventDefault();              // stop the <a> from navigating
   *     myRouter.push(href);             // SPA navigation
   *   });
   * ```
   */
  @Event({ cancelable: true, bubbles: true, composed: true })
  mdSelect!: EventEmitter<MdBreadcrumbSelectDetail>;

  @State() private hasSlottedIcon = false;
  @State() private hasSlottedLabel = false;

  private get isCollapsed(): boolean {
    return this.collapsed;
  }

  private get isCurrent(): boolean {
    return this.current;
  }

  componentWillLoad() {
    this.hasSlottedIcon = this.hasDirectSlottedChild('icon');
    this.hasSlottedLabel = this.hasDefaultSlotContent();
  }

  componentDidLoad() {
    const iconSlot = this.el.shadowRoot?.querySelector(
      'slot[name="icon"]',
    ) as HTMLSlotElement | null;
    iconSlot?.addEventListener('slotchange', () => {
      this.hasSlottedIcon = iconSlot.assignedElements().length > 0;
    });
    const mainSlot = this.el.shadowRoot?.querySelector(
      'slot:not([name])',
    ) as HTMLSlotElement | null;
    mainSlot?.addEventListener('slotchange', () => {
      this.hasSlottedLabel = (mainSlot?.assignedNodes() ?? []).length > 0;
    });
  }

  private getLabelText(): string {
    // Prefer the rendered text content of the host (covers slotted nodes,
    // text, and inline elements); fall back to the empty string.
    return (this.el.textContent ?? '').trim();
  }

  private buildDetail(originalEvent: MouseEvent | KeyboardEvent): MdBreadcrumbSelectDetail {
    return {
      href: this.href,
      label: this.getLabelText(),
      current: this.current,
      itemIndex: this.itemIndex,
      itemTotal: this.itemTotal,
      originalEvent,
    };
  }

  private handleAnchorClick = (e: MouseEvent) => {
    // The anchor only renders for navigable, non-current, non-disabled
    // items, so we don't need to re-check those conditions here. Emit a
    // cancelable mdSelect; if a listener calls preventDefault on the
    // CustomEvent, suppress the browser's default link navigation.
    //
    // Note: pressing Enter on a focused anchor synthesises a click event,
    // so this handler covers the keyboard activation path as well.
    const evt = this.mdSelect.emit(this.buildDetail(e));
    if (evt.defaultPrevented) {
      e.preventDefault();
    }
  };

  private hasDirectSlottedChild(slotName: string): boolean {
    const children = this.el.children;
    for (let i = 0; i < children.length; i += 1) {
      if (children[i].getAttribute('slot') === slotName) return true;
    }
    return false;
  }

  private hasDefaultSlotContent(): boolean {
    for (let i = 0; i < this.el.childNodes.length; i += 1) {
      const node = this.el.childNodes[i];
      if (node.nodeType === 1) {
        if (!(node as Element).hasAttribute('slot')) return true;
      } else if (
        node.nodeType === 3 &&
        (node.textContent ?? '').trim() !== ''
      ) {
        return true;
      }
    }
    return false;
  }

  private renderLeadingSeparator() {
    if (this.itemIndex === 0) return null;
    // Read the separator glyph from the parent (so we don't have to
    // mirror it through a prop on every item).
    const parent = this.el.parentElement as HTMLMdBreadcrumbsElement | null;
    const sep = parent?.separator ?? '/';
    return (
      <span
        class="md-breadcrumb-item__separator"
        part="separator"
        aria-hidden="true"
      >
        {sep}
      </span>
    );
  }

  private renderIcon() {
    if (this.hasSlottedIcon) {
      return (
        <span class="md-breadcrumb-item__icon" part="icon" aria-hidden="true">
          <slot name="icon"></slot>
        </span>
      );
    }
    if (this.icon) {
      return (
        <span class="md-breadcrumb-item__icon" part="icon" aria-hidden="true">
          <span class="material-symbols-outlined">{this.icon}</span>
        </span>
      );
    }
    return null;
  }

  private renderLabel() {
    return (
      <span class="md-breadcrumb-item__label" part="label">
        <slot></slot>
      </span>
    );
  }

  private renderInner() {
    const icon = this.renderIcon();
    const label = this.renderLabel();
    if (this.isCurrent || !this.href || this.disabled) {
      return (
        <span
          class="md-breadcrumb-item__static"
          part="static"
          aria-current={this.isCurrent ? 'page' : undefined}
        >
          {icon}
          {label}
        </span>
      );
    }
    return (
      <a
        class="md-breadcrumb-item__link"
        part="link"
        href={sanitizeHref(this.href)}
        /* An explicit `rel` from the consumer wins; otherwise a link that
           opens elsewhere gets opener severing by default. */
        target={this.target || undefined}
        rel={this.rel || (this.target ? SAFE_LINK_REL : undefined)}
        onClick={this.handleAnchorClick}
      >
        <md-ripple disabled={this.disabled}></md-ripple>
        <span
          class="md-breadcrumb-item__state-layer"
          part="state-layer"
          aria-hidden="true"
        ></span>
        {icon}
        {label}
      </a>
    );
  }

  render() {
    if (this.isCollapsed) {
      // Parent flagged us as inside the collapsed middle — render
      // nothing visible. We stay in the DOM so toggling expanded
      // doesn't require a re-pass over the slot.
      return (
        <Host
          class="md-breadcrumb-item md-breadcrumb-item--collapsed"
          role="listitem"
          aria-hidden="true"
        ></Host>
      );
    }

    return (
      <Host
        class={{
          'md-breadcrumb-item': true,
          'md-breadcrumb-item--current': this.isCurrent,
          'md-breadcrumb-item--disabled': this.disabled,
        }}
        role="listitem"
      >
        {this.renderLeadingSeparator()}
        {this.renderInner()}
      </Host>
    );
  }
}
