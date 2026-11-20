import { Component, Element, Host, h, Prop } from '@stencil/core';
import { refreshNewSlots } from '../../utils/slot-refresh';

/**
 * A single tab panel. Place inside `md-tab-panels`, one per tab, in tab
 * order. The parent manages `active`, `inert`, and the tabs↔panel ARIA
 * wiring; inactive panels stay in layout (hidden) so the region's size
 * never jumps between tabs.
 *
 * @slot - Panel content
 */
@Component({
  tag: 'md-tab-panel',
  styleUrl: 'md-tab-panel.css',
  shadow: true,
})
export class MdTabPanel {
  @Element() el!: HTMLElement;

  /** Managed by md-tab-panels — reflects the associated tab's selection. */
  @Prop({ reflect: true }) active: boolean = false;

  /** Chrome can build the panel's new slot into its accessibility tree without the slotted content (R6-15). */
  componentDidRender() {
    refreshNewSlots(this.el.shadowRoot);
  }

  render() {
    return (
      <Host role="tabpanel" tabindex={this.active ? '0' : '-1'}>
        {/* visibility lives on this wrapper: Stencil's document-level
            `.hydrated { visibility: inherit }` out-cascades any :host rule,
            but it cannot reach into the shadow tree. */}
        <div class="md-tab-panel__body">
          <slot />
        </div>
      </Host>
    );
  }
}
