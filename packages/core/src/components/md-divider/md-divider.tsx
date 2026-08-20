import { Component, Host, h, Prop } from '@stencil/core';

@Component({
  tag: 'md-divider',
  styleUrl: 'md-divider.css',
  shadow: true,
})
export class MdDivider {
  /** Middle-inset: 16px margin on both sides */
  @Prop({ reflect: true }) inset: boolean = false;

  /** Inset start only: 16px leading margin, 0px trailing */
  @Prop({ reflect: true, attribute: 'inset-start' }) insetStart: boolean = false;

  /** Inset end only: 0px leading margin, 16px trailing */
  @Prop({ reflect: true, attribute: 'inset-end' }) insetEnd: boolean = false;

  /** Vertical orientation */
  @Prop({ reflect: true }) vertical: boolean = false;

  render() {
    return (
      <Host
        class={{
          'md-divider': true,
          'md-divider--inset': this.inset,
          'md-divider--inset-start': this.insetStart,
          'md-divider--inset-end': this.insetEnd,
          'md-divider--vertical': this.vertical,
        }}
        role="separator"
        aria-orientation={this.vertical ? 'vertical' : 'horizontal'}
      >
        {/*
          The rule is an element INSIDE the shadow root rather than the host
          itself. The insets are margins, and a host margin is trivially wiped
          by a page-level reset — `* { margin: 0 }` (Tailwind Preflight, most
          normalize variants) beats a `:host` rule outright, because outer-tree
          styles win the shadow cascade regardless of specificity. Inside the
          shadow root nothing on the page can reach it.
        */}
        <div class="md-divider__line" part="divider" />
      </Host>
    );
  }
}
