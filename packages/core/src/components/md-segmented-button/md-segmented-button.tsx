import { Component, Host, h, Prop, Event, EventEmitter, Element, State } from '@stencil/core';
import { triggerRipple } from '../../utils/ripple';

@Component({
  tag: 'md-segmented-button',
  styleUrl: 'md-segmented-button.css',
  shadow: true,
})
export class MdSegmentedButton {
  @Element() el!: HTMLElement;

  /** Unique value identifying this segment */
  @Prop() value: string = '';

  /** Whether this segment is selected */
  @Prop({ mutable: true, reflect: true }) selected: boolean = false;

  /** Disable this segment */
  @Prop({ reflect: true }) disabled: boolean = false;

  /** Visually disabled but remains focusable for screen readers */
  @Prop({ reflect: true, attribute: 'soft-disabled' }) softDisabled: boolean = false;

  /** Material Symbols icon name (optional) */
  @Prop() icon: string = '';

  /** Label text */
  @Prop() label: string = '';

  /** Show checkmark icon when selected */
  @Prop({ attribute: 'no-checkmark' }) noCheckmark: boolean = false;

  /** Enable/disable ripple */
  @Prop() ripple: boolean = true;

  /** Position index within the set (managed by md-segmented-button-set) */
  @Prop() segmentIndex: number = 0;

  /** Total number of segments in the set (managed by md-segmented-button-set) */
  @Prop() segmentTotal: number = 1;

  /** Density value from parent set (managed by md-segmented-button-set) */
  @Prop() segmentDensity: number = 0;

  /** Whether the parent set is in multiselect mode (managed by md-segmented-button-set) */
  @Prop() segmentMultiselect: boolean = false;

  /**
   * Local density rung. Drives the same `--md-sys-density-scale` signal that a
   * global `data-density` ancestor sets, so a local value simply overrides the
   * inherited one. 0 = default, -4 = ultra-compact.
   */
  @Prop({ reflect: true }) density: 0 | -1 | -2 | -3 | -4 = 0;

  /** Internal event — caught by the set */
  @Event() mdSegmentClick: EventEmitter<{ value: string; selected: boolean }>;

  private get isDisabled() {
    return this.disabled || this.softDisabled;
  }

  componentDidLoad() {
    if (
      typeof window !== 'undefined' &&
      window.__STENCIL_DEV_MODE__ !== false
    ) {
      // Slotted text (e.g. `<md-segmented-button>Day</md-segmented-button>`)
      // is a valid accessible name once we render `<slot/>` inside the label
      // wrapper below. Read textContent on the host to detect it — slot
      // assignment is already resolved by the time componentDidLoad runs.
      const hasSlottedText = !!this.el.textContent?.trim();
      if (!this.label && !hasSlottedText && !this.el.hasAttribute('aria-label')) {
        console.warn(
          `[md-segmented-button] WCAG 1.1.1: Segment is missing an accessible name. ` +
          `Provide a label prop, slotted text content, or aria-label attribute.`,
          this.el,
        );
      }
    }
  }

  private handleClick = (e: MouseEvent) => {
    if (this.isDisabled) {
      e.preventDefault();
      return;
    }

    const newSelected = this.segmentMultiselect ? !this.selected : true;
    this.mdSegmentClick.emit({ value: this.value, selected: newSelected });
  };

  private handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!this.isDisabled) {
        triggerRipple(this.el);
        const newSelected = this.segmentMultiselect ? !this.selected : true;
        this.mdSegmentClick.emit({ value: this.value, selected: newSelected });
      }
      return;
    }

    const isArrow = e.key === 'ArrowRight' || e.key === 'ArrowLeft' ||
                    e.key === 'ArrowDown'  || e.key === 'ArrowUp';
    if (!isArrow) return;
    e.preventDefault();

    const set = this.el.closest('md-segmented-button-set');
    if (!set) return;
    const siblings = Array.from(
      set.querySelectorAll<HTMLElement>('md-segmented-button'),
    ).filter(s => !s.hasAttribute('disabled'));
    if (siblings.length === 0) return;

    const idx = siblings.indexOf(this.el);
    if (idx === -1) return;

    const isForward = e.key === 'ArrowRight' || e.key === 'ArrowDown';
    const next = siblings[(idx + (isForward ? 1 : -1) + siblings.length) % siblings.length];
    next.focus();

    // Single-select: arrow also selects (WAI-ARIA radiogroup pattern).
    if (!this.segmentMultiselect) next.click();
  };

  /** Whether the consumer put anything in the default slot, captured before the
   *  first render so an unlabelled segment never renders an empty label box. */
  @State() private hasSlottedLabel = false;

  componentWillLoad() {
    this.hasSlottedLabel = (this.el.textContent || '').trim().length > 0;
  }

  render() {
    const index = this.segmentIndex;
    const total = this.segmentTotal;
    const density = this.segmentDensity;
    const hasIcon = !!this.icon;
    const hasLabel = !!this.label || this.hasSlottedLabel;
    const showCheckmark = this.selected && !this.noCheckmark;
    const _showIcon = hasIcon && !showCheckmark;
    const isFirst = index === 0;
    const isLast = index === total - 1;

    return (
      <Host
        class={{
          'md-segmented-button': true,
          'md-segmented-button--selected': this.selected,
          'md-segmented-button--disabled': this.isDisabled,
          'md-segmented-button--with-icon': hasIcon || showCheckmark,
          'md-segmented-button--first': isFirst,
          'md-segmented-button--last': isLast,
          [`md-segmented-button--density-${Math.abs(density)}`]: density !== 0,
        }}
        role={this.segmentMultiselect ? 'checkbox' : 'radio'}
        aria-checked={String(this.selected)}
        aria-disabled={this.isDisabled ? 'true' : 'false'}
        tabindex={this.disabled ? '-1' : '0'}
        onClick={this.handleClick}
        onKeyDown={this.handleKeyDown}
      >
        {this.ripple && <md-ripple disabled={this.isDisabled}></md-ripple>}
        <span class="md-segmented-button__state-layer" part="state-layer" aria-hidden="true"></span>
        <span class="md-segmented-button__outline" aria-hidden="true"></span>

        <span class="md-segmented-button__content">
          {hasIcon ? (
            // Icon segments: single element swaps icon ↔ checkmark in-place
            <span class="md-segmented-button__graphic material-symbols-outlined"
              part={showCheckmark ? 'checkmark' : 'icon'}
              aria-hidden="true"
            >{showCheckmark ? 'check' : this.icon}</span>
          ) : !this.noCheckmark ? (
            // Text-only: always reserve leading graphic space so segments
            // pre-account for the checkmark width and never cramp.
            <span class={{
                'md-segmented-button__graphic': true,
                'material-symbols-outlined': true,
                'md-segmented-button__graphic--hidden': !this.selected,
              }}
              part={this.selected ? 'checkmark' : undefined}
              aria-hidden="true"
            >{this.selected ? 'check' : ''}</span>
          ) : null}
          <slot name="icon"></slot>
          {/* Label resolves from the `label` prop first, then falls back
              to whatever the consumer passed in the default slot, matching
              the pattern used across md-button, md-fab-menu-item, etc.
              The wrapper is always rendered so the slot's content lands
              inside the labelled part — empty wrapper is harmless. */}
          {/* Rendered only when there IS a label. An empty wrapper is not
              harmless after all: it is a second flex item, so the content row's
              gap sits between the glyph and a zero-width span and shifts an
              icon-only segment's glyph off-centre by half the gap (measured
              -4px). The default slot still needs a home when unlabelled, so it
              sits outside the wrapper below. */}
          {hasLabel ? (
            <span class="md-segmented-button__label" part="label">
              {this.label ? this.label : <slot />}
            </span>
          ) : (
            <slot />
          )}
          {/* Trailing spacer keeps total content width stable across selection states */}
          {!hasIcon && !this.noCheckmark && (
            <span class="md-segmented-button__spacer" aria-hidden="true"></span>
          )}
        </span>
      </Host>
    );
  }
}
