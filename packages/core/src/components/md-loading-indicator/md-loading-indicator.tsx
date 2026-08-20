import { Component, Host, h, Prop } from '@stencil/core';

@Component({
  tag: 'md-loading-indicator',
  styleUrl: 'md-loading-indicator.css',
  shadow: true,
})
export class MdLoadingIndicator {
  /** Visual style: uncontained (default) or contained (with background container) */
  @Prop({ reflect: true }) variant: 'uncontained' | 'contained' = 'uncontained';

  /** Accessible label for screen readers */
  @Prop() label: string = 'Loading';

  /**
   * Local density rung. Drives the same `--md-sys-density-scale` signal that a
   * global `data-density` ancestor sets, so a local value simply overrides the
   * inherited one. 0 = default, -4 = ultra-compact.
   */
  @Prop({ reflect: true }) density: 0 | -1 | -2 | -3 | -4 = 0;

  render() {
    return (
      <Host
        class={{
          'md-loading-indicator': true,
          [`md-loading-indicator--${this.variant}`]: true,
        }}
        role="progressbar"
        aria-label={this.label}
        aria-live="polite"
      >
        <span class="md-loading-indicator__shape" part="shape" aria-hidden="true"></span>
        <span class="md-loading-indicator__sr-only" role="status">{this.label}</span>
      </Host>
    );
  }
}
