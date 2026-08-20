import { Component, Element, Host, h } from '@stencil/core';

/**
 * Material Design 3 — Table Head (`<thead>`).
 *
 * Pure presentational rowgroup used to mark a region of column-header rows.
 * Applies the head background (sticky-friendly) and ensures children flow
 * into the parent `<md-table>`'s CSS Grid via `display: contents`.
 */
@Component({
  tag: 'md-table-head',
  styleUrl: 'md-table-head.css',
  shadow: true,
})
export class MdTableHead {
  @Element() el!: HTMLElement;

  render() {
    return (
      <Host class="md-table-head" role="rowgroup" data-md-rowgroup="head">
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
