import { Component, Host, h, Prop, Event, EventEmitter, Element, State, Method } from '@stencil/core';
import { MenuElement } from '../../utils/types';
import { triggerRipple } from '../../utils/ripple';

@Component({ tag: 'md-sub-menu-item', styleUrl: 'md-sub-menu-item.css', shadow: true })
export class MdSubMenuItem {
  @Element() el!: HTMLElement;

  /** Primary label text. */
  @Prop() headline: string = '';
  /** Secondary descriptive text below the headline. */
  @Prop({ attribute: 'supporting-text' }) supportingText: string = '';
  /** Whether the item is disabled. */
  @Prop({ reflect: true }) disabled: boolean = false;
  /** Render a divider line below this item. */
  @Prop({ reflect: true }) divider: boolean = false;
  /** Render a gap (extra space) below this item — an alternative separator to divider. */
  @Prop({ reflect: true }) gap: boolean = false;
  /** Small badge label (e.g. "New") displayed before the trailing arrow. */
  @Prop() badge: string = '';

  /**
   * Local density rung. Drives the same `--md-sys-density-scale` signal that a
   * global `data-density` ancestor sets, so a local value simply overrides the
   * inherited one. 0 = default, -4 = ultra-compact.
   */
  @Prop({ reflect: true }) density: 0 | -1 | -2 | -3 | -4 = 0;

  /** Fires when the item row itself is clicked (not the submenu). */
  @Event() mdClick: EventEmitter<void>;

  @State() private submenuOpen: boolean = false;
  @State() private hasLeadingIcon = false;

  private closeTimer?: ReturnType<typeof setTimeout>;

  componentWillLoad() {
    this.hasLeadingIcon = !!this.el.querySelector('[slot="leading-icon"]');
  }

  componentDidLoad() {
    const nestedMenu = this.getNestedMenu() as MenuElement | null;
    if (nestedMenu?.open) {
      this.submenuOpen = true;
      if (nestedMenu) {
        nestedMenu.style.position = 'relative';
      }
    }
  }

  private getNestedMenu(): HTMLElement | null {
    return this.el.querySelector('[slot="submenu"]');
  }

  /**
   * Collapse this row's submenu and reset its visual state. Called by an
   * ancestor menu when it closes, so reopening the menu tree always starts
   * fresh instead of restoring the previously-open submenu and focus ring.
   */
  @Method()
  async collapse() {
    clearTimeout(this.closeTimer);
    const nestedMenu = this.getNestedMenu() as MenuElement | null;
    if (nestedMenu?.open) nestedMenu.open = false;
    this.submenuOpen = false;
    this.resetSubmenuStyles();
    this.el.removeAttribute('data-md-focused');
  }

  private openSubmenu(autoFocus = false) {
    if (this.disabled) return;
    clearTimeout(this.closeTimer);
    this.submenuOpen = true;

    if (autoFocus) {
      // Keyboard descent into the submenu: DOM focus is leaving this row,
      // so drop the roving focus-ring marker. Otherwise the parent keeps
      // its ring lit while the focused child submenu item also shows one.
      this.el.removeAttribute('data-md-focused');
    }

    const nestedMenu = this.getNestedMenu() as MenuElement | null;
    if (nestedMenu) {
      nestedMenu.style.position = 'relative';
      if (nestedMenu.show) nestedMenu.show({ autoFocus });
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => this.autoPositionSubmenu());
    });
  }

  private autoPositionSubmenu() {
    const container = this.el.shadowRoot?.querySelector('.md-sub-menu-item__submenu') as HTMLElement;
    if (!container) return;

    container.style.insetInlineStart = '';
    container.style.insetInlineEnd = '';
    container.style.top = '';
    container.style.bottom = '';

    const hostRect = this.el.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    const submenuWidth = containerRect.width > 0 ? containerRect.width : 200;
    const submenuHeight = containerRect.height > 0 ? containerRect.height : 200;

    // Flipping is expressed in LOGICAL terms so RTL mirrors for free: the
    // flyout normally opens toward the inline end, and flips to the inline
    // start only when that would leave the viewport.
    const rtl = this.resolveDirection() === 'rtl';
    const overflowsInlineEnd = rtl
      ? hostRect.left - submenuWidth < 0
      : hostRect.right + submenuWidth > window.innerWidth;

    if (overflowsInlineEnd) {
      container.style.insetInlineStart = 'auto';
      container.style.insetInlineEnd = '100%';
    }

    // …and back again if the flipped side is the one that overflows.
    const flippedOverflows = containerRect.width > 0 && (rtl
      ? containerRect.right > window.innerWidth
      : containerRect.left < 0);
    if (flippedOverflows) {
      container.style.insetInlineStart = '100%';
      container.style.insetInlineEnd = 'auto';
    }

    if (hostRect.top + submenuHeight > window.innerHeight) {
      container.style.top = 'auto';
      container.style.bottom = '0';
    }
  }

  /** Nearest explicit `dir`, matching md-button-group's resolution. */
  private resolveDirection(): 'ltr' | 'rtl' {
    let node: HTMLElement | null = this.el;
    while (node) {
      const dir = node.getAttribute?.('dir');
      if (dir === 'rtl' || dir === 'ltr') return dir;
      node = node.parentElement;
    }
    return 'ltr';
  }

  private closeSubmenu() {
    const nestedMenu = this.getNestedMenu() as MenuElement | null;
    if (nestedMenu?.close) nestedMenu.close();

    this.closeTimer = setTimeout(() => {
      this.submenuOpen = false;
      this.resetSubmenuStyles();
    }, 100);
  }

  private resetSubmenuStyles() {
    const nestedMenu = this.el.querySelector('[slot="submenu"]') as HTMLElement;
    if (nestedMenu) {
      nestedMenu.style.position = '';
    }
    const container = this.el.shadowRoot?.querySelector('.md-sub-menu-item__submenu') as HTMLElement;
    if (container) {
      container.style.insetInlineStart = '';
      container.style.insetInlineEnd = '';
      container.style.top = '';
      container.style.bottom = '';
    }
  }

  private handleMouseEnter = () => { this.openSubmenu(false); };
  private handleMouseLeave = () => { this.closeSubmenu(); };

  private handleKeyDown = (e: KeyboardEvent) => {
    if (this.disabled) return;

    if (e.key === 'ArrowRight' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      triggerRipple(this.el);
      this.openSubmenu(true);
    }

    if ((e.key === 'ArrowLeft' || e.key === 'Escape') && this.submenuOpen) {
      e.preventDefault();
      e.stopPropagation();
      const nestedMenu = this.getNestedMenu() as MenuElement | null;
      if (nestedMenu?.close) nestedMenu.close();
      setTimeout(() => {
        this.submenuOpen = false;
        this.resetSubmenuStyles();
      }, 100);
      this.el.focus();
      // Focus is returning to this row — restore the roving focus-ring
      // marker so the ring reappears on the parent item.
      this.el.setAttribute('data-md-focused', '');
    }
  };

  private handleClick = (e: MouseEvent) => {
    if (this.disabled) { e.preventDefault(); e.stopPropagation(); return; }
    this.mdClick.emit();
  };

  disconnectedCallback() {
    clearTimeout(this.closeTimer);
  }

  render() {
    return (
      <Host
        class={{
          'md-sub-menu-item': true,
          'md-sub-menu-item--disabled': this.disabled,
          'md-sub-menu-item--open': this.submenuOpen,
          'md-sub-menu-item--divider': this.divider,
          'md-sub-menu-item--gap': this.gap,
        }}
        role="menuitem"
        aria-haspopup="menu"
        aria-expanded={String(this.submenuOpen)}
        aria-disabled={this.disabled ? 'true' : 'false'}
        tabindex="-1"
        onClick={this.handleClick}
        onMouseEnter={this.handleMouseEnter}
        onMouseLeave={this.handleMouseLeave}
        onKeyDown={this.handleKeyDown}
      >
        <md-ripple disabled={this.disabled}></md-ripple>
        <span class="md-sub-menu-item__state-layer" part="state-layer" aria-hidden="true"></span>

        {this.hasLeadingIcon && (
          <span class="md-sub-menu-item__leading" part="leading-icon" aria-hidden="true">
            <slot name="leading-icon"></slot>
          </span>
        )}

        <span class="md-sub-menu-item__content" part="content">
          <span class="md-sub-menu-item__headline" part="headline">{this.headline}</span>
          {this.supportingText && (
            <span class="md-sub-menu-item__supporting" part="supporting-text">{this.supportingText}</span>
          )}
        </span>

        {this.badge && (
          <span class="md-sub-menu-item__badge" part="badge">{this.badge}</span>
        )}

        <span class="md-sub-menu-item__arrow material-symbols-outlined" aria-hidden="true">
          arrow_right
        </span>

        <div
          class="md-sub-menu-item__submenu"
          onMouseEnter={() => this.openSubmenu()}
          onMouseLeave={() => this.closeSubmenu()}
        >
          <slot name="submenu" />
        </div>
      </Host>
    );
  }
}
