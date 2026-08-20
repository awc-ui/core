import { Component, Host, h, Prop, State, Event, EventEmitter, Element } from '@stencil/core';
import { triggerRipple } from '../../utils/ripple';
import { sanitizeHref, SAFE_WINDOW_FEATURES } from '../../utils/url';

@Component({
  tag: 'md-icon-button',
  styleUrl: 'md-icon-button.css',
  shadow: true,
})
export class MdIconButton {
  @Element() el!: HTMLElement;

  /** Visual style variant */
  @Prop() variant: 'standard' | 'filled' | 'outlined' | 'tonal' = 'standard';

  /** M3 Expressive size */
  @Prop() size: 'xs' | 'sm' | 'md' | 'lg' | 'xl' = 'sm';

  /** Container shape */
  @Prop() shape: 'round' | 'square' = 'round';

  /** M3 Expressive width (narrow, default, wide) */
  @Prop() buttonWidth: 'narrow' | 'default' | 'wide' = 'default';

  /** Prevents interaction and removes from tab order */
  @Prop({ reflect: true }) disabled: boolean = false;

  /** Visually disabled but remains focusable for discoverability */
  @Prop({ reflect: true, attribute: 'soft-disabled' }) softDisabled: boolean = false;

  /** Enable toggle behavior (selected/unselected) */
  @Prop() toggle: boolean = false;

  /** Current selected state (toggle mode) */
  @Prop({ mutable: true }) selected: boolean = false;

  /** Enable M3 Expressive shape morphing on press and toggle */
  @Prop() shapeMorph: boolean = true;

  /** Whether to show the ripple effect */
  @Prop() ripple: boolean = true;

  /** Material Symbols icon name */
  @Prop() icon: string = '';

  /** Icon shown when selected in toggle mode */
  @Prop() selectedIcon: string = '';

  /** Turns the button into a link */
  @Prop() href: string = '';

  /** Link target attribute */
  @Prop() target: string = '_self';

  /** @internal Set by md-button-group — left side is connected to a neighbor */
  @Prop({ reflect: true }) connectedLeft: boolean = false;

  /** @internal Set by md-button-group — right side is connected to a neighbor */
  @Prop({ reflect: true }) connectedRight: boolean = false;

  /** @internal Value for button-group form association */
  @Prop() value: string = '';

  /**
   * @internal Roving-tabindex override set by `md-button-group`. When the
   * button is a child of a group, the group sets this to `0` on the
   * currently-active button and `-1` on the rest.
   */
  @Prop({ mutable: true, reflect: false }) groupTabindex: number | null = null;

  /**
   * Local density rung. Drives the same `--md-sys-density-scale` signal that a
   * global `data-density` ancestor sets, so a local value simply overrides the
   * inherited one. 0 = default, -4 = ultra-compact.
   */
  @Prop({ reflect: true }) density: 0 | -1 | -2 | -3 | -4 = 0;

  /** Fires on pointer or keyboard activation. Detail includes toggle `selected` state. */
  @Event({ bubbles: true, composed: true })
  mdClick!: EventEmitter<{ selected: boolean }>;

  @State() private hasSlottedIcon = false;
  /** A badge is slotted in — the host must stop clipping so it can straddle
   *  the corner. `:host(:has(md-badge))` does not match light-DOM children, so
   *  the presence is tracked here and expressed as a host class. */
  @State() private hasSlottedBadge = false;
  @State() private hasSlottedSelected = false;
  @State() private pressed = false;

  private get isDisabled() {
    return this.disabled || this.softDisabled;
  }

  componentWillLoad() {
    this.syncSlottedIcons();
  }

  componentDidLoad() {
    const shadow = this.el.shadowRoot;
    if (!shadow) return;

    const iconSlot = shadow.querySelector('slot:not([name])') as HTMLSlotElement | null;
    const selectedSlot = shadow.querySelector('slot[name="selected"]') as HTMLSlotElement | null;

    this.syncSlottedIcons();
    iconSlot?.addEventListener('slotchange', () => this.syncSlottedIcons());
    selectedSlot?.addEventListener('slotchange', () => this.syncSlottedIcons());
  }

  /** Ignore whitespace-only text nodes (e.g. Lit template indentation) when detecting slots. */
  private hasMeaningfulSlotContent(slot: HTMLSlotElement | null): boolean {
    if (!slot) return false;
    return slot.assignedNodes().some((node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        // A badge is an ADORNMENT anchored to the button, not the button's
        // icon. Counting it here made `hasSlottedIcon` true, which suppresses
        // the `icon` prop's glyph — so the documented pattern (an icon button
        // with a count badge) rendered the badge and NO icon at all.
        if ((node as Element).tagName.toLowerCase() === 'md-badge') return false;
        return true;
      }
      if (node.nodeType === Node.TEXT_NODE) return (node.textContent?.trim().length ?? 0) > 0;
      return false;
    });
  }

  /** Sync default/selected slot presence (initial + slotchange). */
  private syncSlottedIcons() {
    const shadow = this.el.shadowRoot;
    const iconSlot = shadow?.querySelector('slot:not([name])') as HTMLSlotElement | null;
    const selectedSlot = shadow?.querySelector('slot[name="selected"]') as HTMLSlotElement | null;

    this.hasSlottedIcon = this.hasMeaningfulSlotContent(iconSlot);
    this.hasSlottedBadge = !!iconSlot
      ?.assignedElements()
      .some((el) => el.tagName.toLowerCase() === 'md-badge');
    this.hasSlottedSelected = this.hasMeaningfulSlotContent(selectedSlot);
  }

  private handleClick = (e: MouseEvent) => {
    if (this.isDisabled) { e.preventDefault(); return; }
    const href = sanitizeHref(this.href);
    if (href) { window.open(href, this.target, SAFE_WINDOW_FEATURES); }
    if (this.toggle) this.selected = !this.selected;
    this.mdClick.emit({ selected: this.selected });
  };

  private handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!this.isDisabled) {
        this.pressed = true;
        triggerRipple(this.el);
        this.el.click();
        setTimeout(() => { this.pressed = false; }, 150);
      }
    }
  };

  private handlePointerDown = () => {
    if (!this.isDisabled) this.pressed = true;
  };

  private handlePointerUp = () => {
    this.pressed = false;
  };

  render() {
    const isEffectivelyDisabled = this.isDisabled;
    const showSelected = this.toggle && this.selected;
    const hasIcon = !!this.icon || this.hasSlottedIcon;
    // Do not gate visibility on `hasIcon` — slotted glyphs must paint before sync.
    const showDefaultIconLayer =
      !showSelected || (!this.selectedIcon && !this.hasSlottedSelected);

    return (
      <Host
        class={{
          'md-icon-button': true,
          [`md-icon-button--${this.variant}`]: true,
          [`md-icon-button--${this.size}`]: true,
          [`md-icon-button--${this.shape}`]: true,
          [`md-icon-button--width-${this.buttonWidth}`]: this.buttonWidth !== 'default',
          'md-icon-button--selected': this.selected,
          'md-icon-button--toggle': this.toggle,
          'md-icon-button--disabled': this.disabled || this.softDisabled,
          'md-icon-button--shape-morph': this.shapeMorph,
          'md-icon-button--has-badge': this.hasSlottedBadge,
          'md-icon-button--pressed': this.shapeMorph && this.pressed,
          'md-icon-button--connected-left': this.connectedLeft,
          'md-icon-button--connected-right': this.connectedRight,
        }}
        role="button"
        aria-disabled={isEffectivelyDisabled ? 'true' : 'false'}
        aria-pressed={this.toggle ? String(this.selected) : undefined}
        tabindex={
          this.disabled
            ? '-1'
            : (this.groupTabindex !== null ? String(this.groupTabindex) : '0')
        }
        onClick={this.handleClick}
        onKeyDown={this.handleKeyDown}
        onPointerDown={this.handlePointerDown}
        onPointerUp={this.handlePointerUp}
        onPointerLeave={this.handlePointerUp}
        onPointerCancel={this.handlePointerUp}
      >
        {this.ripple && <md-ripple disabled={isEffectivelyDisabled}></md-ripple>}
        <span class="md-icon-button__state-layer" part="state-layer" aria-hidden="true"></span>

        {/* Default icon (shown when not toggle-selected, or no selected slot/icon) */}
        <span
          class={{
            'md-icon-button__icon': true,
            'md-icon-button__icon--on': showDefaultIconLayer,
          }}
          part="icon"
        >
          <slot />
          {showDefaultIconLayer && hasIcon && !this.hasSlottedIcon && (
            <span class="md-icon-button__icon-font material-symbols-outlined" aria-hidden="true">
              {showSelected && this.selectedIcon ? this.selectedIcon : this.icon}
            </span>
          )}
        </span>

        {/* Selected icon (toggle mode only) */}
        {this.toggle && (this.selectedIcon || this.hasSlottedSelected) && (
          <span
            class={{
              'md-icon-button__icon': true,
              'md-icon-button__icon--on': showSelected,
            }}
            part="selected-icon"
          >
            <slot name="selected" />
            {!this.hasSlottedSelected && this.selectedIcon && (
              <span class="md-icon-button__icon-font material-symbols-outlined" aria-hidden="true">
                {this.selectedIcon}
              </span>
            )}
          </span>
        )}
      </Host>
    );
  }
}
