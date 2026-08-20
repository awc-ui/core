import { Component, Host, h, Prop, State, Event, EventEmitter, Element } from '@stencil/core';
import { triggerRipple } from '../../utils/ripple';

@Component({
  tag: 'md-fab-menu-item',
  styleUrl: 'md-fab-menu-item.css',
  shadow: true,
})
export class MdFabMenuItem {
  @Element() el!: HTMLElement;

  /** Material Symbols icon name. */
  @Prop() icon: string = '';

  /** Item label text. */
  @Prop() label: string = '';

  /** Whether the item is disabled (removed from tab order). */
  @Prop({ reflect: true }) disabled: boolean = false;

  /** Whether the item is soft-disabled (still focusable but not activatable). */
  @Prop({ reflect: true, attribute: 'soft-disabled' }) softDisabled: boolean = false;

  /**
   * When `true`, paints the keyboard-focus ring even if the item does not hold DOM focus
   * (e.g. arrow-key navigation drove `focusItem()`). Set by `md-fab-menu` during
   * programmatic roving — not on initial open.
   */
  @Prop({ mutable: true, reflect: false }) rovingFocusVisible: boolean = false;

  /**
   * Local density rung. Drives the same `--md-sys-density-scale` signal that a
   * global `data-density` ancestor sets, so a local value simply overrides the
   * inherited one. 0 = default, -4 = ultra-compact.
   */
  @Prop({ reflect: true }) density: 0 | -1 | -2 | -3 | -4 = 0;

  /** Fires when the item is activated. */
  @Event() mdClick: EventEmitter<void>;

  @State() private hasSlottedIcon = false;

  private get isDisabled() {
    return this.disabled || this.softDisabled;
  }

  componentWillLoad() {
    if (!this.el.hasAttribute('tabindex')) {
      this.el.setAttribute('tabindex', '-1');
    }
  }

  componentDidLoad() {
    const shadow = this.el.shadowRoot;
    if (!shadow) return;

    const iconSlot = shadow.querySelector('slot[name="icon"]') as HTMLSlotElement | null;
    iconSlot?.addEventListener('slotchange', () => {
      this.hasSlottedIcon = iconSlot.assignedElements().length > 0;
    });
  }

  private handleClick = (e: MouseEvent) => {
    if (this.isDisabled) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    this.mdClick.emit();
  };

  private handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!this.isDisabled) {
        triggerRipple(this.el);
        this.mdClick.emit();
      }
    }
  };

  render() {
    const hasIcon = !!this.icon;
    const effectivelyDisabled = this.isDisabled;

    return (
      <Host
        class={{
          'md-fab-menu-item': true,
          'md-fab-menu-item--with-icon': hasIcon || this.hasSlottedIcon,
          'md-fab-menu-item--disabled': effectivelyDisabled,
          'md-fab-menu-item--roving-focus-visible': this.rovingFocusVisible,
        }}
        role="menuitem"
        aria-disabled={effectivelyDisabled ? 'true' : null}
        onClick={this.handleClick}
        onKeyDown={this.handleKeyDown}
      >
        <md-ripple disabled={effectivelyDisabled}></md-ripple>
        <span class="md-fab-menu-item__state-layer" part="state-layer" aria-hidden="true"></span>
        <slot name="icon">
          {hasIcon && (
            <span class="md-fab-menu-item__icon material-symbols-outlined" part="icon" aria-hidden="true">
              {this.icon}
            </span>
          )}
        </slot>
        <span class="md-fab-menu-item__label" part="label">
          {this.label ? this.label : <slot />}
        </span>
      </Host>
    );
  }
}
