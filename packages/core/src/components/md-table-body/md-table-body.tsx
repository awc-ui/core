import { Component, Element, Host, h, Prop } from '@stencil/core';

/**
 * Material Design 3 — Table Body (`<tbody>`).
 *
 * Pure presentational rowgroup. Children flow into the parent grid via
 * `display: contents`.
 */
@Component({
  tag: 'md-table-body',
  styleUrl: 'md-table-body.css',
  shadow: true,
})
export class MdTableBody {
  @Element() el!: HTMLElement;

  /**
   * @internal Stamped by the parent `md-table` in `frozen-header` mode. The
   * body then renders inside the focusable `.md-table__body-scroll` wrapper,
   * which itself carries `role="rowgroup"` (a valid, walked-through child of
   * `role="table"` even though it is a scroll tab stop). Keeping our own
   * `rowgroup` role there would NEST rowgroups — invalid, since a rowgroup may
   * only own rows (axe `aria-required-children`). Dropping to `presentation`
   * lets our rows promote into the wrapper rowgroup. Non-frozen (the default),
   * we are a direct child of the table and stay a real `rowgroup`.
   */
  @Prop({ reflect: true }) presentational: boolean = false;

  render() {
    return (
      <Host
        class="md-table-body"
        role={this.presentational ? 'presentation' : 'rowgroup'}
        data-md-rowgroup="body"
      >
        <slot
          onSlotchange={() =>
            // Row mutations happen inside THIS shadow slot — slotchange is not
            // composed, so md-table would never see reorders (a sorted row
            // kept its stale data-last stamp, losing its divider). Relay as a
            // bubbling light-DOM event the table listens for.
            this.el.dispatchEvent(new CustomEvent('mdRowgroupSlotChange', { bubbles: true }))
          }
        ></slot>
      </Host>
    );
  }
}
