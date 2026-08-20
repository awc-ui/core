import { Component, Host, h, Prop, Event, EventEmitter, Element } from '@stencil/core';
import { triggerRipple } from '../../utils/ripple';

@Component({
  tag: 'md-split-button',
  styleUrl: 'md-split-button.css',
  shadow: true,
})
export class MdSplitButton {
  @Element() el!: HTMLElement;

  /** Color variant */
  @Prop() variant: 'elevated' | 'filled' | 'tonal' | 'outlined' = 'filled';

  /** Size */
  @Prop() size: 'xs' | 'sm' | 'md' | 'lg' | 'xl' = 'sm';

  /** Disable the entire split button */
  @Prop({ reflect: true }) disabled: boolean = false;

  /** Visually disabled but remains focusable for screen readers */
  @Prop({ reflect: true, attribute: 'soft-disabled' }) softDisabled: boolean = false;

  /** Material Symbols icon name for the leading button */
  @Prop() icon: string = '';

  /** Leading button label text */
  @Prop() label: string = '';

  /** Trailing button icon (default: keyboard_arrow_down) */
  @Prop() trailingIcon: string = 'keyboard_arrow_down';

  /** Whether the trailing button is in "open/checked" state */
  @Prop({ mutable: true, reflect: true, attribute: 'trailing-checked' }) trailingChecked: boolean = false;

  /**
   * Accessible label for the trailing (menu-toggle) button. Localize per the
   * page locale. (WCAG 4.1.2 — the icon-only trailing button needs a name.)
   */
  @Prop({ attribute: 'menu-label' }) menuLabel: string = 'Toggle menu';

  /**
   * `aria-haspopup` value for the trailing button — the kind of popup it opens.
   * Defaults to `'menu'` (the split-button menu-trigger pattern). Set to
   * `'false'` when the trailing button toggles state rather than opening a popup.
   */
  @Prop({ attribute: 'haspopup' }) haspopup:
    | 'menu' | 'listbox' | 'dialog' | 'grid' | 'tree' | 'true' | 'false' = 'menu';

  /**
   * `id` of the element the trailing button controls (the menu/listbox it
   * opens). Wires `aria-controls` so assistive tech links trigger → popup.
   */
  @Prop() controls: string = '';

  /**
   * Stretch the split button to fill its container. The leading segment grows
   * and its label truncates with an ellipsis when space is tight; the trailing
   * toggle keeps its intrinsic width.
   */
  @Prop({ reflect: true, attribute: 'full-width' }) fullWidth: boolean = false;

  /** Enable/disable ripple */
  @Prop() ripple: boolean = true;

  /**
   * Local density rung. Drives the same `--md-sys-density-scale` signal that a
   * global `data-density` ancestor sets, so a local value simply overrides the
   * inherited one. 0 = default, -4 = ultra-compact.
   */
  @Prop({ reflect: true }) density: 0 | -1 | -2 | -3 | -4 = 0;

  /** Fired when the leading button is activated */
  @Event() mdLeadingClick: EventEmitter<void>;

  /** Fired when the trailing button is toggled */
  @Event() mdTrailingClick: EventEmitter<{ checked: boolean }>;

  private get isDisabled() {
    return this.disabled || this.softDisabled;
  }

  componentDidLoad() {
    if (
      typeof window !== 'undefined' &&
      window.__STENCIL_DEV_MODE__ !== false
    ) {
      if (!this.label && !this.el.hasAttribute('aria-label')) {
        console.warn(
          `[md-split-button] WCAG 1.1.1: Leading button is missing an accessible name. ` +
          `Provide a label prop or aria-label attribute.`,
          this.el,
        );
      }
    }
  }

  private handleLeadingClick = (e: MouseEvent) => {
    e.stopPropagation();
    if (this.isDisabled) {
      e.preventDefault();
      return;
    }
    this.mdLeadingClick.emit();
  };

  private handleLeadingKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!this.isDisabled) {
        triggerRipple(this.el, '.md-split-button__leading md-ripple');
        this.mdLeadingClick.emit();
      }
    }
  };

  private handleTrailingClick = (e: MouseEvent) => {
    e.stopPropagation();
    if (this.isDisabled) {
      e.preventDefault();
      return;
    }
    this.trailingChecked = !this.trailingChecked;
    this.mdTrailingClick.emit({ checked: this.trailingChecked });
  };

  private handleTrailingKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!this.isDisabled) {
        triggerRipple(this.el, '.md-split-button__trailing md-ripple');
        this.trailingChecked = !this.trailingChecked;
        this.mdTrailingClick.emit({ checked: this.trailingChecked });
      }
    }
  };

  render() {
    const hasIcon = !!this.icon;

    return (
      <Host
        class={{
          'md-split-button': true,
          [`md-split-button--${this.variant}`]: true,
          [`md-split-button--${this.size}`]: true,
          'md-split-button--disabled': this.isDisabled,
          'md-split-button--trailing-checked': this.trailingChecked,
          'md-split-button--with-icon': hasIcon,
          'md-split-button--full-width': this.fullWidth,
        }}
      >
        <button
          class="md-split-button__leading"
          part="leading"
          disabled={this.disabled}
          aria-disabled={this.isDisabled ? 'true' : undefined}
          aria-label={!this.label ? this.el.getAttribute('aria-label') ?? undefined : undefined}
          tabindex={this.disabled ? -1 : 0}
          onClick={this.handleLeadingClick}
          onKeyDown={this.handleLeadingKeyDown}
        >
          {this.ripple && <md-ripple disabled={this.isDisabled}></md-ripple>}
          <span class="md-split-button__leading-state-layer" part="leading-state-layer" aria-hidden="true"></span>
          {hasIcon && (
            <span class="md-split-button__icon material-symbols-outlined" part="icon" aria-hidden="true">
              {this.icon}
            </span>
          )}
          {this.label && <span class="md-split-button__label" part="label">{this.label}</span>}
          <slot></slot>
        </button>

        <button
          class={{
            'md-split-button__trailing': true,
            'md-split-button__trailing--checked': this.trailingChecked,
          }}
          part="trailing"
          disabled={this.disabled}
          aria-disabled={this.isDisabled ? 'true' : undefined}
          aria-haspopup={this.haspopup === 'false' ? undefined : this.haspopup}
          aria-expanded={String(this.trailingChecked)}
          aria-controls={this.controls || undefined}
          aria-label={this.menuLabel}
          tabindex={this.disabled ? -1 : 0}
          onClick={this.handleTrailingClick}
          onKeyDown={this.handleTrailingKeyDown}
        >
          {this.ripple && <md-ripple disabled={this.isDisabled}></md-ripple>}
          <span class="md-split-button__trailing-state-layer" part="trailing-state-layer" aria-hidden="true"></span>
          <span class="md-split-button__trailing-icon material-symbols-outlined" part="trailing-icon" aria-hidden="true">
            {this.trailingIcon}
          </span>
        </button>
      </Host>
    );
  }
}
