import { Component, Element, Host, h, Prop, State } from '@stencil/core';

@Component({
  tag: 'md-badge',
  styleUrl: 'md-badge.css',
  shadow: true,
})
export class MdBadge {
  /** Badge size — small renders a dot; large renders a label */
  @Prop({ reflect: true }) variant: 'small' | 'large' = 'large';

  /** Text or number to display (large variant only, max 4 visible characters) */
  @Prop() value: string = '';

  /**
   * Numeric threshold. When the parsed value exceeds this, the badge
   * shows `{max}+` (e.g. `999+`). Ignored for non-numeric values.
   */
  @Prop() max: number = 999;

  /** Material Symbols icon name (large variant only, e.g. `"error"`) */
  @Prop() icon: string = '';

  /**
   * The SHAPE of the thing the badge is anchored to.
   *
   * The badge pins to its containing block's top-inline-end CORNER and
   * translates itself onto it, which is right for a `rect` host — a button, a
   * tab, a tile. On a `circle` it is wrong for the same reason it is wrong for
   * `md-status-dot`: a circle's bounding-box corner lies outside the visible
   * shape, so the badge floats clear of the avatar with nothing behind it.
   *
   * `circle` anchors it to the 45° point on the rim instead — the top-trailing
   * arc, where a count badge on an avatar belongs. Percentage insets, so it is
   * correct at every avatar size without being told the size, and it needs no
   * hand-tuned offsets at the call site.
   *
   * `rect` stays the default: changing it would move every badge already
   * sitting on a button or a tab.
   */
  @Prop({ reflect: true }) shape: 'rect' | 'circle' = 'rect';

  /**
   * Local density rung. Drives the same `--md-sys-density-scale` signal that a
   * global `data-density` ancestor sets, so a local value simply overrides the
   * inherited one. 0 = default, -4 = ultra-compact.
   */
  @Prop({ reflect: true }) density: 0 | -1 | -2 | -3 | -4 = 0;

  @Element() el!: HTMLElement;

  /**
   * Whether anything is slotted into `icon`. The slot is rendered for every
   * large badge — gating it on the `icon` prop meant a slotted custom icon was
   * never assigned, so it stayed invisible and the badge drew as an empty pill.
   * This only tracks whether the badge counts as *having content*.
   */
  @State() private hasSlottedIcon = false;

  componentWillLoad() {
    this.readSlottedIcon();
  }

  private readSlottedIcon = () => {
    // Direct children only, and without `:scope` — Stencil's mock-doc cannot
    // parse that pseudo-class, so it throws in spec tests.
    this.hasSlottedIcon = Array.from(this.el.children).some((c) => c.getAttribute('slot') === 'icon');
  };

  private get displayValue(): string {
    if (this.variant === 'small' || !this.value) return '';

    const num = Number(this.value);
    if (!Number.isNaN(num) && Number.isFinite(num) && num > this.max) {
      return `${this.max}+`;
    }

    return this.value.slice(0, 4);
  }

  private get accessibleLabel(): string | undefined {
    if (this.variant === 'small') return 'notification';
    const display = this.displayValue;
    if (display) return display;
    if (this.icon) return this.icon;
    return undefined;
  }

  render() {
    const isSmall = this.variant === 'small';
    const display = this.displayValue;
    const hasLabel = !isSmall && !!display;
    const hasIcon = !isSmall && (!!this.icon || this.hasSlottedIcon);
    const hasContent = hasLabel || hasIcon;

    return (
      <Host
        class={{
          'md-badge': true,
          'md-badge--small': isSmall,
          'md-badge--large': !isSmall,
          // Only the circular case gets a class — `rect` is the corner anchor
          // the base rule already is, so a `--rect` class would name nothing.
          'md-badge--circle': this.shape === 'circle',
          'md-badge--has-content': hasContent,
        }}
        role="status"
        aria-label={this.accessibleLabel}
      >
        {!isSmall && (
          <slot name="icon" onSlotchange={this.readSlottedIcon}>
            {this.icon ? (
              <span class="md-badge__icon material-symbols-outlined" part="icon" aria-hidden="true">
                {this.icon}
              </span>
            ) : null}
          </slot>
        )}
        {hasLabel && (
          <span class="md-badge__label" part="label">
            {display}
          </span>
        )}
      </Host>
    );
  }
}
