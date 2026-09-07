import {
  Component,
  Host,
  h,
  Prop,
  State,
  Watch,
  Event,
  EventEmitter,
  Element,
  Method,
} from '@stencil/core';
import { triggerRipple } from '../../utils/ripple';
import { getRailTransitionTiming, parseRailMotionDuration, registerRailTabTransition, synchronizeRailAnimation } from '../../utils/navigation-rail-motion';
import { sanitizeHref, SAFE_LINK_REL } from '../../utils/url';

/**
 * Material Design 3 — Navigation Rail Destination (Tab)
 *
 * A single destination within a `<md-navigation-rail>`. Renders the MD3
 * active-indicator pill (56×32) around the icon, with an optional label
 * underneath (or inline when the parent rail is expanded). Supports badges,
 * disabled state, link mode (`href`) and slotted custom icons.
 *
 * Spec:
 *   - https://m3.material.io/components/navigation-rail/specs
 *   - https://m3.material.io/components/navigation-rail/guidelines
 *   - https://m3.material.io/components/navigation-rail/accessibility
 */
@Component({
  tag: 'md-navigation-rail-tab',
  styleUrl: 'md-navigation-rail-tab.css',
  shadow: true,
})
export class MdNavigationRailTab {
  @Element() el!: HTMLElement;

  /** Material Symbols Outlined icon name (shorthand). Ignored when the `icon` slot is filled. */
  @Prop() icon: string = '';

  /** Visible text label. Recommended for all destinations (MD3 a11y). */
  @Prop() label: string = '';

  /** Active / selected state. Reflected. Managed by `<md-navigation-rail>`. */
  @Prop({ mutable: true, reflect: true }) active: boolean = false;

  /** Disabled — destination cannot be activated and is removed from tab order. */
  @Prop({ reflect: true }) disabled: boolean = false;

  /** Show a small dot badge (notification indicator). */
  @Prop() badge: boolean = false;

  /** Numeric / textual badge value (renders large badge). */
  @Prop({ attribute: 'badge-value' }) badgeValue: string = '';

  /**
   * When set, the tab is rendered as a link (anchor) with the given href.
   * Activates link semantics (uses `aria-current="page"` when active).
   */
  @Prop() href: string = '';

  /** Optional target for the link (when `href` is set). */
  @Prop() target: string = '';

  /** Optional value emitted alongside `mdTabClick`. */
  @Prop() value: string = '';

  /**
   * Controls label visibility. Usually set automatically by the parent
   * `<md-navigation-rail>` based on its `label-visibility` prop.
   */
  @Prop({ reflect: true, attribute: 'label-visibility' })
  labelVisibility: 'all' | 'selected' | 'none' = 'all';

  /** True when the parent rail is expanded; managed by the parent. */
  @Prop({ reflect: true }) expanded: boolean = false;

  /**
   * Local density rung. Drives the same `--md-sys-density-scale` signal that a
   * global `data-density` ancestor sets, so a local value simply overrides the
   * inherited one. 0 = default, -4 = ultra-compact.
   */
  @Prop({ reflect: true }) density: 0 | -1 | -2 | -3 | -4 = 0;

  /** Fired when the user activates the destination (click / Enter / Space). */
  @Event() mdTabClick: EventEmitter<{ value: string }>;

  /**
   * Fired when this destination's slotted dropdown opens or closes. `md-menu`'s
   * own `mdOpen` / `mdClose` are deliberately non-bubbling and non-composed, so
   * the rail has no way to hear them — this is the signal it listens for (it
   * lifts its stacking context so the fixed-position menu is not trapped).
   */
  @Event({ bubbles: true, composed: true }) mdSubmenuToggle: EventEmitter<{ open: boolean }>;

  /** Rendered geometry captured before the rail or destination changes layout. */
  private iconFirst: { cx: number; cy: number } | null = null;
  private indicatorFirst: { left: number; top: number; width: number; height: number } | null = null;
  private labelFirst: {
    rect: DOMRect;
    opacity: number;
    visible: boolean;
    fontFamily: string;
    fontSize: string;
    fontWeight: string;
    lineHeight: string;
    letterSpacing: string;
    paddingTop: string;
    paddingRight: string;
    paddingBottom: string;
    paddingLeft: string;
    textAlign: string;
    boxSizing: string;
  } | null = null;
  private labelOverlay?: {
    element: HTMLElement;
    styles: Map<string, { value: string; priority: string }>;
  };
  private pendingTransition = false;
  private transitionPrepared = false;
  private iconAnimation?: Animation;
  private indicatorAnimation?: Animation;
  private labelAnimation?: Animation;
  private unregisterTransition?: () => void;

  connectedCallback() {
    this.unregisterTransition = registerRailTabTransition(this.el, () => {
      this.captureTransition();
      this.transitionPrepared = true;
    });
  }

  disconnectedCallback() {
    this.unregisterTransition?.();
    this.cancelAnimations();
    this.iconFirst = null;
    this.indicatorFirst = null;
    this.labelFirst = null;
    this.pendingTransition = false;
    this.transitionPrepared = false;
  }

  /** Mirrors the slotted submenu's open state for `aria-expanded`. */
  @State() private submenuOpen: boolean = false;
  /** True when a dropdown is slotted, so the label can show a disclosure caret. */
  @State() private hasSubmenu: boolean = false;
  /** True when a row inside this destination's dropdown is selected, so the
   *  destination itself reads as the active one. */
  @State() private submenuHasSelection: boolean = false;

  componentDidLoad() {
    if (
      typeof window !== 'undefined' &&
      window.__STENCIL_DEV_MODE__ !== false
    ) {
      this.warnMissingAccessibleName();
    }

    // A slotted submenu needs its anchor wired once this tab is in the DOM.
    this.ensureSubmenuAnchor();
    const submenu = this.submenu;
    this.hasSubmenu = !!submenu;
    if (submenu) {
      submenu.addEventListener('mdOpen', () => {
        this.submenuOpen = true;
        this.mdSubmenuToggle.emit({ open: true });
      });
      submenu.addEventListener('mdClose', () => {
        this.submenuOpen = false;
        this.syncSubmenuSelection();
        this.mdSubmenuToggle.emit({ open: false });
      });
      submenu.addEventListener('mdClick', (e) => this.handleSubmenuClick(e));
      this.syncSubmenuSelection();
    }
  }

  /** The rail prepares before its own padding changes. Direct prop changes
   * still capture here, so a destination also behaves correctly in isolation. */
  @Watch('expanded')
  onExpandedChange() {
    if (!this.transitionPrepared) this.captureTransition();
    this.transitionPrepared = false;
  }

  private captureTransition() {
    const sr = this.el.shadowRoot;
    const indicator = sr?.querySelector<HTMLElement>('[part="indicator"]');
    const label = sr?.querySelector<HTMLElement>('[part="label"]');
    // Read the visible (possibly mid-animation) boxes BEFORE cancelling. A
    // reversal then starts at the pixels on screen, not the previous target.
    this.iconFirst = this.iconCentre();
    this.indicatorFirst = indicator?.getBoundingClientRect() ?? null;
    const labelCss = label ? getComputedStyle(label) : null;
    this.labelFirst = label && labelCss ? {
      rect: label.getBoundingClientRect(),
      opacity: Number.parseFloat(labelCss.opacity) || 0,
      visible: labelCss.display !== 'none' && labelCss.visibility !== 'hidden',
      fontFamily: labelCss.fontFamily,
      fontSize: labelCss.fontSize,
      fontWeight: labelCss.fontWeight,
      lineHeight: labelCss.lineHeight,
      letterSpacing: labelCss.letterSpacing,
      paddingTop: labelCss.paddingTop,
      paddingRight: labelCss.paddingRight,
      paddingBottom: labelCss.paddingBottom,
      paddingLeft: labelCss.paddingLeft,
      textAlign: labelCss.textAlign,
      boxSizing: labelCss.boxSizing,
    } : null;
    this.cancelAnimations();
    this.pendingTransition = !this.prefersReducedMotion();
    if (!this.pendingTransition) {
      this.iconFirst = null;
      this.indicatorFirst = null;
      this.labelFirst = null;
    }
  }

  private cancelAnimations() {
    this.iconAnimation?.cancel();
    this.indicatorAnimation?.cancel();
    this.labelAnimation?.cancel();
    this.iconAnimation = undefined;
    this.indicatorAnimation = undefined;
    this.labelAnimation = undefined;
    this.restoreLabelOverlay();
  }

  private restoreLabelOverlay() {
    if (!this.labelOverlay) return;
    const { element, styles } = this.labelOverlay;
    for (const [name, previous] of styles) {
      if (previous.value) element.style.setProperty(name, previous.value, previous.priority);
      else element.style.removeProperty(name);
    }
    this.labelOverlay = undefined;
  }

  private retainOutgoingLabel(label: HTMLElement, first: NonNullable<MdNavigationRailTab['labelFirst']>) {
    const host = this.el.getBoundingClientRect();
    const styles = new Map<string, { value: string; priority: string }>();
    const overlay: Record<string, string> = {
      display: 'inline-block', position: 'absolute',
      left: `${first.rect.left - host.left - this.el.clientLeft + this.el.scrollLeft}px`,
      top: `${first.rect.top - host.top - this.el.clientTop + this.el.scrollTop}px`,
      width: `${first.rect.width}px`, height: `${first.rect.height}px`,
      'max-inline-size': 'none', 'max-block-size': 'none',
      'margin-top': '0', 'margin-right': '0', 'margin-bottom': '0', 'margin-left': '0',
      transform: 'none', opacity: String(first.opacity), visibility: 'visible',
      'pointer-events': 'none', 'transition-property': 'none',
      // Longhands preserve authored font/margin/padding/transition values when
      // cleanup restores each property; clearing a shorthand would erase them.
      'font-family': first.fontFamily, 'font-size': first.fontSize,
      'font-weight': first.fontWeight, 'line-height': first.lineHeight,
      'letter-spacing': first.letterSpacing,
      'padding-top': first.paddingTop, 'padding-right': first.paddingRight,
      'padding-bottom': first.paddingBottom, 'padding-left': first.paddingLeft,
      'text-align': first.textAlign, 'box-sizing': first.boxSizing,
    };
    for (const [name, value] of Object.entries(overlay)) {
      if (!value) continue;
      styles.set(name, { value: label.style.getPropertyValue(name), priority: label.style.getPropertyPriority(name) });
      label.style.setProperty(name, value);
    }
    this.labelOverlay = { element: label, styles };
  }

  componentDidRender() {
    if (!this.pendingTransition) return;
    this.pendingTransition = false;
    this.playTransition();
  }

  private prefersReducedMotion(): boolean {
    return (
      typeof window !== 'undefined' &&
      !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    );
  }

  private iconCentre(): { cx: number; cy: number } | null {
    const icon = this.el.shadowRoot?.querySelector(
      '.md-navigation-rail-tab__icon-wrapper',
    ) as HTMLElement | null;
    if (!icon) return null;
    const r = icon.getBoundingClientRect();
    // Viewport coordinates: the icon's `transform: translate` moves it in
    // viewport space, and the tab itself repositions between states, so the
    // delta must be the icon's NET viewport movement — not its movement
    // relative to the (also-moving) tab, which would over-translate it.
    return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
  }

  private motionDuration(): number {
    // Match the rail's snappy expand/collapse width morph (short4 / 200ms) so
    // the icon glide arrives exactly as the rail finishes resizing. Mirrors the
    // button shape-morph timing rather than the slower spatial spring.
    const raw = getComputedStyle(this.el)
      .getPropertyValue('--md-sys-motion-duration-short4')
      .trim();
    return parseRailMotionDuration(raw);
  }

  private playTransition() {
    const sr = this.el.shadowRoot;
    if (!sr) return;
    const fallbackEasing = getComputedStyle(this.el)
      .getPropertyValue('--md-sys-motion-easing-standard').trim()
      || 'cubic-bezier(0.2, 0, 0, 1)';
    const { duration, easing, source } = getRailTransitionTiming(this.el, {
      duration: this.motionDuration(), easing: fallbackEasing,
    });
    if (duration === 0) {
      this.iconFirst = null;
      this.indicatorFirst = null;
      this.labelFirst = null;
      return;
    }
    const timing: KeyframeAnimationOptions = { duration, easing, fill: 'none' };

    const icon = sr.querySelector<HTMLElement>('[part="icon-wrapper"]');
    if (icon && this.iconFirst) {
      const r = icon.getBoundingClientRect();
      const dx = this.iconFirst.cx - (r.left + r.width / 2);
      const dy = this.iconFirst.cy - (r.top + r.height / 2);
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
        this.iconAnimation = icon.animate([
          { transform: `translate(${dx}px, ${dy}px)` },
          { transform: 'translate(0, 0)' },
        ], timing);
        const animation = this.iconAnimation;
        synchronizeRailAnimation(animation, source, () => this.iconAnimation === animation);
      }
    }
    this.iconFirst = null;

    // CSS cannot interpolate a content-sized expanded pill to a fixed collapsed
    // pill. Morph only its surface; scaling the whole destination distorts text.
    const indicator = sr.querySelector<HTMLElement>('[part="indicator"]');
    if (indicator && this.indicatorFirst) {
      const first = this.indicatorFirst;
      const last = indicator.getBoundingClientRect();
      if (first.width > 0 && first.height > 0 && last.width > 0 && last.height > 0) {
        this.indicatorAnimation = indicator.animate([
          {
            transform: `translate(${first.left - last.left}px, ${first.top - last.top}px) scale(${first.width / last.width}, ${first.height / last.height})`,
            transformOrigin: 'top left',
          },
          { transform: 'translate(0, 0) scale(1, 1)', transformOrigin: 'top left' },
        ], timing);
        const animation = this.indicatorAnimation;
        synchronizeRailAnimation(animation, source, () => this.indicatorAnimation === animation);
      }
    }
    this.indicatorFirst = null;

    const label = sr.querySelector<HTMLElement>('[part="label"]');
    const first = this.labelFirst;
    this.labelFirst = null;
    if (label && first) {
      const css = getComputedStyle(label);
      const targetOpacity = Number.parseFloat(css.opacity) || 0;
      const visible = css.display !== 'none' && css.visibility !== 'hidden' && targetOpacity > 0;
      if (!visible && first.visible && first.opacity > 0 && first.rect.width > 0 && first.rect.height > 0) {
        // Preserve only the outgoing label's painted box. It no longer takes
        // layout space, so the collapsed icon and pill can reach their targets.
        this.retainOutgoingLabel(label, first);
        this.labelAnimation = label.animate([
          { opacity: first.opacity }, { opacity: 0 },
        ], { ...timing, fill: 'forwards' });
        const animation = this.labelAnimation;
        synchronizeRailAnimation(animation, source, () => this.labelAnimation === animation);
        void animation.finished.then(() => {
          if (this.labelAnimation !== animation) return;
          this.restoreLabelOverlay();
          this.labelAnimation = undefined;
          animation.cancel();
        }, () => undefined);
      } else if (visible) {
        const last = label.getBoundingClientRect();
        const dx = first.visible ? first.rect.left - last.left : 0;
        const dy = first.visible ? first.rect.top - last.top : 0;
        const opacity = first.visible ? first.opacity : 0;
        if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5 || Math.abs(opacity - targetOpacity) > 0.01) {
          this.labelAnimation = label.animate([
            { transform: `translate(${dx}px, ${dy}px)`, opacity },
            { transform: 'translate(0, 0)', opacity: targetOpacity },
          ], timing);
          const animation = this.labelAnimation;
          synchronizeRailAnimation(animation, source, () => this.labelAnimation === animation);
        }
      }
    }
  }

  private warnMissingAccessibleName() {
    const hasAriaLabel =
      this.el.hasAttribute('aria-label') || this.el.hasAttribute('aria-labelledby');
    if (!this.label && !hasAriaLabel) {
      console.warn(
        '[md-navigation-rail-tab] WCAG 1.1.1 / 2.4.4: destination is missing a label. ' +
        'Add a `label` attribute or aria-label.',
        this.el,
      );
    }
  }

  /** A slotted `md-menu` turns this destination into a disclosure: activating it
   *  opens the dropdown instead of navigating. Its items are the destinations. */
  private get submenu(): (HTMLElement & { show(): Promise<void>; close(): Promise<void>; open: boolean }) | null {
    return this.el.querySelector('[slot="submenu"]') as never;
  }

  private generatedId?: string;

  /** md-menu resolves `anchor` by id against its own root; a slotted menu's root
   *  is the document, so this tab needs a stable id to be anchored to. */
  private ensureSubmenuAnchor() {
    const menu = this.submenu;
    if (!menu) return;
    if (!this.el.id) {
      this.generatedId = this.generatedId ?? `md-rail-tab-${Math.random().toString(36).slice(2, 9)}`;
      this.el.id = this.generatedId;
    }
    if (menu.getAttribute('anchor') !== this.el.id) menu.setAttribute('anchor', this.el.id);
    // A vertical rail sits on the leading edge, so the flyout opens beside it.
    // md-menu supports the top/bottom placements only — there is no side
    // placement to fly a vertical rail's submenu out to the right.
    if (!menu.hasAttribute('placement')) menu.setAttribute('placement', 'bottom-start');
  }

  /**
   * Choosing a row in the dropdown IS choosing this destination.
   *
   * A plain `md-menu-item` never marks itself — only `type="checkbox"` / `radio`
   * rows self-toggle — so nothing would show which child is current, and the
   * destination would stay unlit. Treat the dropdown as single-select: mark the
   * chosen row (clearing its siblings, at any depth) so reopening the menu shows
   * it, and activate this destination so the bar shows where you are.
   */
  private handleSubmenuClick = (e: Event) => {
    const row = (e.target as HTMLElement | null)?.closest?.('md-menu-item') as HTMLElement | null;
    const menu = this.submenu;
    if (!row || !menu || !menu.contains(row)) return;

    menu.querySelectorAll('md-menu-item[selected]').forEach((other) => {
      if (other !== row) other.removeAttribute('selected');
    });
    row.setAttribute('selected', '');

    this.syncSubmenuSelection();
    // Let the rail move its active index here, so the bar has exactly one
    // active destination rather than two competing highlights.
    this.mdTabClick.emit({ value: this.value });
  };

  /**
   * Drop whatever row this destination's dropdown had marked as chosen.
   *
   * The rail calls this when a *different* destination becomes active. Without
   * it the bar ends up with two highlighted destinations: the newly active one,
   * and the one still wearing the child-selected pill because its menu row was
   * never unmarked.
   */
  @Method()
  async clearSubmenuSelection(): Promise<void> {
    const menu = this.submenu;
    menu?.querySelectorAll('md-menu-item[selected]').forEach((row) => {
      row.removeAttribute('selected');
    });
    this.submenuHasSelection = false;
  }

  /** Does any row in this destination's dropdown (at any depth) read as chosen? */
  private syncSubmenuSelection() {
    const menu = this.submenu;
    this.submenuHasSelection = !!menu?.querySelector(
      'md-menu-item[selected], md-menu-item[aria-checked="true"]',
    );
  }

  private toggleSubmenu() {
    const menu = this.submenu;
    if (!menu) return;
    if (menu.open) void menu.close();
    else void menu.show();
  }

  private handleClick = (e: MouseEvent) => {
    if (this.disabled) {
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }
    // A destination that owns a submenu is a disclosure, not a target: opening
    // the dropdown IS the action, so it does not emit activation.
    if (this.submenu) {
      e.preventDefault();
      this.toggleSubmenu();
      return;
    }
    this.mdTabClick.emit({ value: this.value });
  };

  private handleKeyDown = (e: KeyboardEvent) => {
    if (this.disabled) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      triggerRipple(this.el);
      if (this.submenu) {
        this.toggleSubmenu();
        return;
      }
      this.mdTabClick.emit({ value: this.value });
      if (this.href) {
        // Trigger the link navigation
        const anchor = this.el.shadowRoot?.querySelector('a.md-navigation-rail-tab__anchor') as
          | HTMLAnchorElement
          | null;
        anchor?.click();
      }
    }
  };

  private get displayBadgeValue(): string {
    if (!this.badgeValue) return '';
    const num = Number(this.badgeValue);
    if (Number.isFinite(num) && num > 999) return '999+';
    return this.badgeValue;
  }

  private renderIcon() {
    const hasIcon = !!this.icon;
    return (
      <slot name="icon">
        {hasIcon && (
          <span
            class="md-navigation-rail-tab__icon material-symbols-outlined"
            part="icon"
            aria-hidden="true"
          >
            {this.icon}
          </span>
        )}
      </slot>
    );
  }

  private renderBadge() {
    const hasLargeBadge = !!this.badgeValue;
    const hasDotBadge = this.badge && !hasLargeBadge;
    if (!hasLargeBadge && !hasDotBadge) return null;

    return (
      <span
        class={{
          'md-navigation-rail-tab__badge': true,
          'md-navigation-rail-tab__badge--dot': hasDotBadge,
          'md-navigation-rail-tab__badge--large': hasLargeBadge,
        }}
        part={hasDotBadge ? 'badge badge-dot' : 'badge badge-large'}
        role="status"
        aria-label={
          hasLargeBadge
            ? `${this.displayBadgeValue} new notifications`
            : 'new notifications'
        }
      >
        {hasLargeBadge && this.displayBadgeValue}
      </span>
    );
  }

  private renderInner() {
    return [
      <span class="md-navigation-rail-tab__indicator" part="indicator" aria-hidden="true">
        <span class="md-navigation-rail-tab__state-layer" part="state-layer" aria-hidden="true"></span>
      </span>,
      // Ripple paints AFTER the indicator so the wave shows on top of an active
      // item's filled pill (re-clicking an active destination still ripples),
      // but stays below the icon/label (z-index 1).
      <md-ripple disabled={this.disabled}></md-ripple>,
      <span class="md-navigation-rail-tab__icon-wrapper" part="icon-wrapper">
        {/* icon-box is exactly the icon size (24px) so the badge hugs the icon's
            corner in both layouts — not the 56×32 wrapper corner when collapsed. */}
        <span class="md-navigation-rail-tab__icon-box">
          {this.renderIcon()}
          {this.renderBadge()}
        </span>
      </span>,
      this.label && (
        <span class="md-navigation-rail-tab__label" part="label">
          {this.label}
          {/* Without this, a destination that opens a dropdown looks exactly
              like one that navigates — the markup says `aria-haspopup`, but
              nothing on screen does. */}
          {this.hasSubmenu && (
            <span
              class="md-navigation-rail-tab__caret material-symbols-outlined"
              part="caret"
              aria-hidden="true"
            >
              arrow_drop_down
            </span>
          )}
        </span>
      ),
      // Without a slot to receive it, a slotted dropdown stays unassigned and
      // never renders — the menu would flip its `open` state while painting
      // nothing at all.
      <slot name="submenu"></slot>,
    ];
  }

  render() {
    /* `isLink` drives role, aria-current and aria-selected, so it is derived
       from the sanitized URL: a rejected `href` renders no anchor, and the
       tab must not still announce itself as a link. */
    const href = sanitizeHref(this.href);
    const isLink = !!href && !this.disabled;
    const ariaDisabled = this.disabled ? 'true' : null;
    const ariaCurrent = this.active && isLink ? 'page' : null;
    const ariaSelected = isLink ? null : this.active ? 'true' : 'false';
    const role = isLink ? 'link' : 'tab';
    // Accessible name resolution.
    //  - tab mode: the role=tab host is named by its rendered label contents;
    //    aria-label is only needed for icon-only tabs (author supplies it).
    //  - link mode: the label lives inside the `aria-hidden` anchor (kept
    //    hidden so we don't expose a nested link), so the host link would be
    //    nameless. Carry the name on the host explicitly — matching the
    //    md-navigation-tab convention.
    const authorAriaLabel = this.el.getAttribute('aria-label') ?? undefined;
    const hostAriaLabel = isLink
      ? this.label || authorAriaLabel
      : !this.label
        ? authorAriaLabel
        : undefined;

    return (
      <Host
        class={{
          'md-navigation-rail-tab': true,
          'md-navigation-rail-tab--active': this.active,
          'md-navigation-rail-tab--child-selected': this.submenuHasSelection && !this.active,
          'md-navigation-rail-tab--disabled': this.disabled,
          'md-navigation-rail-tab--has-label': !!this.label,
          [`md-navigation-rail-tab--labels-${this.labelVisibility}`]: true,
          'md-navigation-rail-tab--expanded': this.expanded,
        }}
        role={role}
        aria-selected={ariaSelected}
        aria-current={ariaCurrent}
        aria-disabled={ariaDisabled}
        aria-label={hostAriaLabel}
        tabindex={this.disabled ? '-1' : this.active ? '0' : '-1'}
        aria-haspopup={this.submenu ? 'menu' : undefined}
        aria-expanded={this.submenu ? (this.submenuOpen ? 'true' : 'false') : undefined}
        onClick={this.handleClick}
        onKeyDown={this.handleKeyDown}
      >
        {isLink ? (
          <a
            class="md-navigation-rail-tab__anchor"
            href={href}
            target={this.target || undefined}
            rel={this.target ? SAFE_LINK_REL : undefined}
            tabIndex={-1}
            aria-hidden="true"
            part="anchor"
          >
            {this.renderInner()}
          </a>
        ) : (
          this.renderInner()
        )}
      </Host>
    );
  }
}
