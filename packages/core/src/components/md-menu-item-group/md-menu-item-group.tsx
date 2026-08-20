import { Component, Host, h, Prop } from '@stencil/core';

@Component({ tag: 'md-menu-item-group', styleUrl: 'md-menu-item-group.css', shadow: true })
export class MdMenuItemGroup {
  /** Optional label shown above the group items. */
  @Prop() label: string = '';

  /**
   * Local density rung. Drives the same `--md-sys-density-scale` signal that a
   * global `data-density` ancestor sets, so a local value simply overrides the
   * inherited one. 0 = default, -4 = ultra-compact.
   */
  @Prop({ reflect: true }) density: 0 | -1 | -2 | -3 | -4 = 0;

  render() {
    return (
      <Host class="md-menu-item-group" role="group" aria-label={this.label || undefined}>
        {this.label && (
          <span class="md-menu-item-group__label">{this.label}</span>
        )}
        <div class="md-menu-item-group__items" role="presentation">
          <slot />
        </div>
      </Host>
    );
  }
}
