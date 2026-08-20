import { Build, Component, Host, h, Prop, Event, EventEmitter, Element, State, Watch } from '@stencil/core';
import { triggerRipple } from '../../utils/ripple';

/**
 * @slot icon - Custom leading icon (overrides `icon` prop)
 * @slot badge - Badge overlay on the icon
 *
 * @part content - Inner content wrapper (icon + label)
 * @part icon - Icon element
 * @part label - Label text element
 * @part indicator - Active indicator bar
 * @part divider - Bottom divider line
 * @part state-layer - Hover / focus / press overlay
 */
@Component({
  tag: 'md-tab',
  styleUrl: 'md-tab.css',
  shadow: true,
})
export class MdTab {
  @Element() el!: HTMLElement;

  /** Tab label text */
  @Prop() label: string = '';

  /** Material Symbols icon name (or use the `icon` slot for custom icons) */
  @Prop() icon: string = '';

  /** Whether this tab is the active / selected tab */
  @Prop({ mutable: true, reflect: true }) active: boolean = false;

  /** Prevents interaction */
  @Prop({ reflect: true }) disabled: boolean = false;

  /** Display icon and label side-by-side instead of stacked */
  @Prop({ reflect: true, attribute: 'inline-icon' }) inlineIcon: boolean = false;

  /** Visual variant — set automatically by parent `md-tabs` */
  @Prop({ reflect: true }) variant: 'primary' | 'secondary' = 'primary';

  /** Optional badge text (empty string = dot badge) */
  @Prop() badge: string | undefined;

  /** ID of the associated tabpanel (sets `aria-controls`) */
  @Prop({ attribute: 'controls' }) controls: string = '';

  /**
   * Local density rung. Drives the same `--md-sys-density-scale` signal that a
   * global `data-density` ancestor sets, so a local value simply overrides the
   * inherited one. 0 = default, -4 = ultra-compact.
   */
  @Prop({ reflect: true }) density: 0 | -1 | -2 | -3 | -4 = 0;

  /** Emits when the tab is activated by click or keyboard */
  @Event() mdTabClick: EventEmitter<void>;

  @State() private hasSlottedIcon = false;

  private didLoad = false;
  private warnedName = false;

  @Watch('disabled')
  onDisabledChange() {
    this.syncStandaloneTabindex();
    // Inside a tablist the PARENT owns roving tabindex — tell it to re-rove
    // (attribute changes alone are invisible to it).
    this.el.dispatchEvent(new CustomEvent('mdTabDisabledChange', { bubbles: true }));
  }

  connectedCallback() {
    // A tab moved OUT of a tablist at runtime kept its parent-stamped
    // tabindex="-1" forever — re-evaluate ownership on every reconnect.
    if (this.didLoad) {
      queueMicrotask(() => this.syncStandaloneTabindex());
    }
  }

  componentWillLoad() {
    // The icon slot only renders when hasIcon is true — with no icon PROP,
    // a slotted icon could never assign (slot absent -> no slotchange ->
    // hasSlottedIcon stays false forever). Seed from the light DOM.
    this.hasSlottedIcon = Array.from(this.el.children).some(
      (c) => c.getAttribute('slot') === 'icon',
    );
  }

  componentDidLoad() {
    this.didLoad = true;
    this.syncStandaloneTabindex();
    this.checkAccessibleName();
    const shadow = this.el.shadowRoot;
    if (!shadow) return;

    const iconSlot = shadow.querySelector('slot[name="icon"]') as HTMLSlotElement | null;
    iconSlot?.addEventListener('slotchange', () => {
      this.hasSlottedIcon = (iconSlot.assignedElements().length > 0);
      this.checkAccessibleName(); // slotted-icon-only tabs are nameless too
    });
  }

  /** Dev-only nameless-tab warning (WCAG 4.1.2). Exempts every name source:
   *  label text, non-empty aria-label, aria-labelledby, title. */
  private checkAccessibleName() {
    if (!Build.isDev || this.warnedName) return;
    const hasIcon = !!this.icon || this.hasSlottedIcon;
    const named =
      !!this.label ||
      !!this.el.getAttribute('aria-label') ||
      this.el.hasAttribute('aria-labelledby') ||
      this.el.hasAttribute('title');
    if (hasIcon && !named) {
      this.warnedName = true;
      console.warn(
        '[md-tab] Icon-only tab has no accessible name — add aria-label (WCAG 4.1.2).',
        this.el,
      );
    }
  }

  /** closest() cannot cross shadow boundaries — a tab slotted THROUGH a
   *  wrapper stamped its own tabindex=0 over the parent's rove (the exact
   *  double-tab-stop defect again). Walk the COMPOSED tree. */
  private hasTablistAncestor(): boolean {
    let node: Node | null = this.el;
    while (node) {
      if ((node as Element).tagName === 'MD-TABS') return true;
      const el = node as Element;
      node = el.assignedSlot ?? (node instanceof ShadowRoot ? node.host : node.parentNode);
    }
    return false;
  }

  /**
   * tabindex has a SINGLE owner: inside md-tabs the parent manages roving
   * focus (two writers previously left two tabs at tabindex="0"). Rendering
   * it here would let every re-render overwrite the parent's value, so the
   * host template carries none — standalone md-tab stamps its own.
   */
  private syncStandaloneTabindex() {
    if (this.hasTablistAncestor()) return;
    this.el.setAttribute('tabindex', this.disabled ? '-1' : '0');
  }

  private handleClick = () => {
    if (this.disabled) return;
    this.mdTabClick.emit();
  };

  private handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!this.disabled) {
        triggerRipple(this.el);
        this.mdTabClick.emit();
      }
    }
  };

  render() {
    const hasIcon = !!this.icon || this.hasSlottedIcon;
    const hasLabel = !!this.label;
    const hasBadge = this.badge !== undefined;
    const isInline = this.inlineIcon && hasIcon && hasLabel;
    const isStacked = hasIcon && hasLabel && !isInline;

    return (
      <Host
        class={{
          'md-tab': true,
          [`md-tab--${this.variant}`]: true,
          'md-tab--active': this.active,
          'md-tab--disabled': this.disabled,
          'md-tab--inline-icon': isInline,
          'md-tab--stacked': isStacked,
          'md-tab--icon-only': hasIcon && !hasLabel,
        }}
        role="tab"
        aria-selected={this.active ? 'true' : 'false'}
        aria-disabled={this.disabled ? 'true' : null}
        aria-controls={this.controls || null}
        onClick={this.handleClick}
        onKeyDown={this.handleKeyDown}
      >
        <md-ripple disabled={this.disabled}></md-ripple>
        <span class="md-tab__state-layer" part="state-layer" aria-hidden="true"></span>

        <span class="md-tab__inner">
          <span
            class={{
              'md-tab__content': true,
              'md-tab__content--inline': isInline,
            }}
            part="content"
          >
            {hasIcon && (
              <span class="md-tab__icon-wrapper">
                <slot name="icon">
                  <span class="md-tab__icon material-symbols-outlined" part="icon" aria-hidden="true">
                    {this.icon}
                  </span>
                </slot>
                <slot name="badge">
                  {hasBadge && (
                    <span class="md-tab__badge" aria-label={this.badge || 'notification'}>
                      {this.badge}
                    </span>
                  )}
                </slot>
              </span>
            )}
            {hasLabel && (
              <span class="md-tab__label" part="label">
                <span class="md-tab__label-text">{this.label}</span>
                {!hasIcon && (
                  <slot name="badge">
                    {hasBadge && (
                      <span class="md-tab__badge md-tab__badge--inline" aria-label={this.badge || 'notification'}>
                        {this.badge}
                      </span>
                    )}
                  </slot>
                )}
              </span>
            )}
          </span>
          {this.variant === 'primary' ? (
            <span
              class={{
                'md-tab__indicator': true,
                'md-tab__indicator--active': this.active,
              }}
              part="indicator"
              aria-hidden="true"
            ></span>
          ) : null}
        </span>
        {this.variant === 'secondary' ? (
          <span
            class={{
              'md-tab__indicator': true,
              'md-tab__indicator--active': this.active,
            }}
            part="indicator"
            aria-hidden="true"
          ></span>
        ) : null}
        <span class="md-tab__divider" part="divider" aria-hidden="true"></span>
      </Host>
    );
  }
}
