import { Component, Element, Host, h, Prop } from '@stencil/core';

/**
 * Material Design 3 — Table Foot (`<tfoot>`).
 *
 * Pure presentational rowgroup for footer rows (totals, summaries).
 * Children flow into the parent grid via `display: contents`.
 */
@Component({
  tag: 'md-table-foot',
  styleUrl: 'md-table-foot.css',
  shadow: true,
})
export class MdTableFoot {
  @Element() el!: HTMLElement;

  /**
   * @internal Stamped by the parent `md-table` in `frozen-header` mode. The
   * foot renders inside the focusable `.md-table__body-scroll` wrapper, which
   * itself carries `role="rowgroup"`; keeping our own `rowgroup` role there
   * would NEST rowgroups (invalid — a rowgroup may only own rows). Dropping to
   * `presentation` lets our rows promote into the wrapper rowgroup. Non-frozen
   * (the default), we stay a real `rowgroup`. See `md-table-body`.
   */
  @Prop({ reflect: true }) presentational: boolean = false;

  render() {
    return (
      <Host
        class="md-table-foot"
        role={this.presentational ? 'presentation' : 'rowgroup'}
        data-md-rowgroup="foot"
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
