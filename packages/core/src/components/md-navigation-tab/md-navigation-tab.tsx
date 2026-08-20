import {
  Component,
  Element,
  Event,
  EventEmitter,
  Host,
  Method,
  Prop,
  State,
  Watch,
  h,
} from '@stencil/core';
import { triggerRipple } from '../../utils/ripple';
import { sanitizeHref, SAFE_WINDOW_FEATURES } from '../../utils/url';

export type MdNavigationTabLabelBehavior = 'always' | 'selected' | 'none';

/**
 * `md-navigation-tab` — a single destination inside `md-navigation-bar`.
 *
 * Renders an icon, an optional label, and an optional badge. Selecting
 * the tab swaps the icon to a filled variant (per M3 spec) and reveals
 * an "active indicator" pill behind the icon.
 *
 * References:
 *   - {@link https://m3.material.io/components/navigation-bar/specs Specs}
 *   - {@link https://m3.material.io/components/navigation-bar/accessibility Accessibility}
 *
 * @slot icon         - Custom icon for the inactive state
 *                       (replaces the `icon` attribute).
 * @slot active-icon  - Custom icon for the active state
 *                       (replaces the `active-icon` attribute).
 * @slot              - Default slot for a custom label
 *                       (replaces the `label` attribute).
 *
 * @part container      - The full tab hit-area / touch target.
 * @part indicator      - The 56×32 pill that highlights the active icon.
 * @part state-layer    - The hover/focus/pressed tint overlay.
 * @part icon-container - The 56×32 wrapper around the icon (badge anchor).
 * @part icon           - The rendered icon glyph.
 * @part badge          - The badge dot or text capsule (when present).
 * @part label          - The destination label text.
 */
@Component({
  tag: 'md-navigation-tab',
  styleUrl: 'md-navigation-tab.css',
  shadow: true,
})
export class MdNavigationTab {
  @Element() el!: HTMLElement;

  /** Whether this destination is currently selected. */
  @Prop({ mutable: true, reflect: true }) active: boolean = false;

  /** Disable interaction. Disabled tabs are skipped by keyboard nav. */
  @Prop({ reflect: true }) disabled: boolean = false;

  /**
   * Soft-disable the destination: it cannot be activated or selected and is
   * announced as `aria-disabled`, but — unlike `disabled` — it stays
   * keyboard-reachable (the bar's arrow-key tour still lands on it) so
   * screen-reader users can discover a temporarily-unavailable destination.
   */
  @Prop({ reflect: true, attribute: 'soft-disabled' }) softDisabled: boolean = false;

  /** Destination label rendered below the icon. */
  @Prop() label: string = '';

  /**
   * Material Symbols / Material Icons name shown when inactive.
   * Per M3 spec, inactive destinations use the outlined variant.
   */
  @Prop() icon: string = '';

  /**
   * Material Symbols / Material Icons name shown when active.
   * Per M3 spec, active destinations use the filled variant.
   * Defaults to `icon` when empty (the same glyph in both states).
   */
  @Prop({ attribute: 'active-icon' }) activeIcon: string = '';

  /**
   * Show a small "notification dot" badge in the top-right of the icon.
   * Use when there are new items but no count is needed.
   */
  @Prop({ reflect: true }) badge: boolean = false;

  /**
   * Numeric / textual badge value (e.g. `"3"`, `"99+"`, `"New"`).
   * When set, the badge expands to a pill that accommodates the value
   * (M3 calls this the "large badge" variant).
   */
  @Prop({ attribute: 'badge-value' }) badgeValue: string = '';

  /**
   * Maximum value rendered when `badgeValue` is purely numeric. Values
   * greater than this render as `"{max}+"` (e.g. `99+`). Set to `0` to
   * disable the cap.
   */
  @Prop({ attribute: 'badge-max' }) badgeMax: number = 999;

  /**
   * When set, activating the tab also navigates to the URL — useful when
   * each destination is a full route. For SPA routing, intercept the native
   * `click` (call `preventDefault()`) or listen to the bar's `mdChange`;
   * navigation only occurs when `href` is truthy and the click isn't prevented.
   */
  @Prop() href: string = '';

  /** Link target (forwarded only when `href` is set). */
  @Prop() target: string = '';

  /**
   * Label visibility for this tab. Inherits from the parent
   * `md-navigation-bar`'s `label-behavior` when not set.
   *
   * Not reflected as an attribute — the parent bar uses
   * `getAttribute('label-behavior')` to detect *explicit* author
   * overrides, so reflecting the default would defeat that signal.
   */
  @Prop({ mutable: true, attribute: 'label-behavior' })
  labelBehavior: MdNavigationTabLabelBehavior = 'always';

  /**
   * Local density rung. Drives the same `--md-sys-density-scale` signal that a
   * global `data-density` ancestor sets, so a local value simply overrides the
   * inherited one. 0 = default, -4 = ultra-compact.
   */
  @Prop({ reflect: true }) density: 0 | -1 | -2 | -3 | -4 = 0;

  /**
   * Fired when the tab is activated (click, Enter, or Space) and the tab is
   * not disabled. The parent `md-navigation-bar` listens for this to drive
   * selection; external code may also listen to detect per-tab activation
   * (including a re-click of the already-active tab, which does not emit
   * `mdChange` on the bar).
   */
  @Event() mdTabClick: EventEmitter<{ index: number }>;

  /** Internal — track focus-visible for the state layer + a11y. */
  @State() private focusVisible: boolean = false;

  // ─── Watchers ────────────────────────────────────────────────────

  @Watch('active')
  onActiveChange(active: boolean) {
    // Mirror the active state into aria-selected so the parent isn't
    // the sole writer (works in detached usage / docs without a bar).
    this.el.setAttribute('aria-selected', String(active));
  }

  @Watch('disabled')
  onDisabledChange() {
    this.syncAriaDisabled();
  }

  @Watch('softDisabled')
  onSoftDisabledChange() {
    this.syncAriaDisabled();
  }

  /** Activation/selection is blocked when either disabled flag is set. */
  private get interactionDisabled(): boolean {
    return this.disabled || this.softDisabled;
  }

  private syncAriaDisabled() {
    this.el.setAttribute('aria-disabled', String(this.interactionDisabled));
  }

  // ─── Lifecycle ───────────────────────────────────────────────────

  connectedCallback() {
    // Defaults — the bar may override these on mount.
    if (!this.el.hasAttribute('role')) this.el.setAttribute('role', 'tab');
    this.el.setAttribute('aria-selected', String(this.active));
    if (this.interactionDisabled) this.el.setAttribute('aria-disabled', 'true');
    if (!this.el.hasAttribute('tabindex')) {
      this.el.setAttribute('tabindex', this.active ? '0' : '-1');
    }
  }

  // ─── Public API ──────────────────────────────────────────────────

  /** Focus the tab programmatically (skip when disabled). */
  @Method()
  async focusEl(): Promise<void> {
    if (this.disabled) return;
    this.el.focus();
  }

  // ─── Internal helpers ────────────────────────────────────────────

  /** Locate this tab's index inside its parent navigation bar. */
  private resolveIndex(): number {
    const parent = this.el.parentElement;
    if (!parent) return -1;
    // Walk direct children rather than using `:scope > md-navigation-tab`
    // — the latter is unsupported by Stencil's mock-doc in spec tests.
    const siblings: HTMLElement[] = [];
    for (const child of Array.from(parent.children)) {
      if ((child as HTMLElement).tagName === 'MD-NAVIGATION-TAB') {
        siblings.push(child as HTMLElement);
      }
    }
    return siblings.indexOf(this.el);
  }

  private emitActivation() {
    const index = this.resolveIndex();
    this.mdTabClick.emit({ index });
  }

  private handleClick = (e: MouseEvent) => {
    if (this.interactionDisabled) {
      // Block activation and stop the click from reaching the bar.
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (e.defaultPrevented) return; // SPA routers call preventDefault()
    this.emitActivation();
    this.maybeFollowHref();
  };

  private handleKeyDown = (e: KeyboardEvent) => {
    if (this.interactionDisabled) return;
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      triggerRipple(this.el);
      // Synthesize a native click so keyboard and pointer activation share one
      // path (bubbles to the bar + follows href).
      this.el.click();
    }
  };

  private maybeFollowHref() {
    const href = sanitizeHref(this.href);
    if (!href) return;
    if (typeof window === 'undefined') return;
    if (this.target === '_blank') {
      window.open(href, '_blank', SAFE_WINDOW_FEATURES);
    } else if (this.target) {
      /* A named target opens a new browsing context just like `_blank` does,
         so it needs the same opener severing. */
      window.open(href, this.target, SAFE_WINDOW_FEATURES);
    } else {
      window.location.assign(href);
    }
  }

  private handleFocus = () => {
    this.focusVisible = this.el.matches(':focus-visible');
  };

  private handleBlur = () => {
    this.focusVisible = false;
  };

  // ─── Rendering helpers ───────────────────────────────────────────

  private resolveLabelVisibility(): MdNavigationTabLabelBehavior {
    return this.labelBehavior;
  }

  private formatBadgeValue(): string {
    const raw = (this.badgeValue ?? '').trim();
    if (!raw) return '';
    if (this.badgeMax > 0) {
      const num = Number(raw);
      if (!Number.isNaN(num) && Number.isFinite(num) && num > this.badgeMax) {
        return `${this.badgeMax}+`;
      }
    }
    return raw;
  }

  private renderIcon() {
    const useActive = this.active && (this.activeIcon || this.icon);
    const filled = this.active;
    const glyph = useActive ? (this.activeIcon || this.icon) : this.icon;

    return (
      <span class="md-navigation-tab__icon-container" part="icon-container">
        <span
          class={{
            'md-navigation-tab__icon': true,
            'material-symbols-outlined': true,
            'md-navigation-tab__icon--filled': filled,
          }}
          part="icon"
          aria-hidden="true"
        >
          {/* Custom-icon slots win over the icon attribute. */}
          {this.active ? <slot name="active-icon">{glyph}</slot> : <slot name="icon">{glyph}</slot>}
        </span>
        {this.renderBadge()}
      </span>
    );
  }

  private renderBadge() {
    if (!this.badge && !this.badgeValue) return null;
    const value = this.formatBadgeValue();
    const isLarge = value.length > 0;

    return (
      <span
        class={{
          'md-navigation-tab__badge': true,
          'md-navigation-tab__badge--small': !isLarge,
          'md-navigation-tab__badge--large': isLarge,
        }}
        part="badge"
        role="status"
        aria-label={isLarge ? `${value} new` : 'New'}
      >
        {isLarge ? value : ''}
      </span>
    );
  }

  private renderLabel() {
    const visibility = this.resolveLabelVisibility();
    if (visibility === 'none') return null;

    // CSS handles hiding the label when visibility === 'selected' && !active,
    // so we still render it (preserves space + keeps accessible name stable).
    return (
      <span
        class={{
          'md-navigation-tab__label': true,
          'md-navigation-tab__label--hidden':
            visibility === 'selected' && !this.active,
        }}
        part="label"
      >
        <slot>{this.label}</slot>
      </span>
    );
  }

  // ─── Render ──────────────────────────────────────────────────────

  render() {
    // Accessible name resolution: the host carries the label so the
    // `tab` role gets a stable accessible name. Icon-only mode still
    // exposes the textual `label` via aria-label.
    const accessibleLabel = this.label || undefined;
    const visibility = this.resolveLabelVisibility();
    const ariaLabel = visibility === 'none' ? accessibleLabel : undefined;

    return (
      <Host
        class={{
          'md-navigation-tab': true,
          'md-navigation-tab--active': this.active,
          'md-navigation-tab--disabled': this.disabled,
          'md-navigation-tab--soft-disabled': this.softDisabled && !this.disabled,
          'md-navigation-tab--label-hidden': visibility === 'none',
        }}
        aria-label={ariaLabel}
        onClick={this.handleClick}
        onKeyDown={this.handleKeyDown}
        onFocus={this.handleFocus}
        onBlur={this.handleBlur}
      >
        <md-ripple disabled={this.interactionDisabled}></md-ripple>
        <span
          class="md-navigation-tab__state-layer"
          part="state-layer"
          aria-hidden="true"
          data-focus-visible={this.focusVisible ? 'true' : null}
        ></span>
        <span
          class="md-navigation-tab__container"
          part="container"
        >
          <span
            class={{
              'md-navigation-tab__indicator': true,
              'md-navigation-tab__indicator--active': this.active,
            }}
            part="indicator"
            aria-hidden="true"
          ></span>
          {this.renderIcon()}
          {this.renderLabel()}
        </span>
      </Host>
    );
  }
}
