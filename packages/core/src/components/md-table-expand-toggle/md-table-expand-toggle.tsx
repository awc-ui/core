import { Component, Host, h, Prop, Element, State } from '@stencil/core';

type ExpandableRow = HTMLElement & { expanded: boolean; toggle: () => Promise<void> };

/**
 * Material Design 3 — Table Expand Toggle.
 *
 * The STANDARD expand caret for an expandable `<md-table-row>`: one consistent
 * size (xs / 32px — fits every density incl. compact rows, matching the 32px
 * checkbox precedent), a chevron that rotates 90° on the spatial spring when
 * the row opens, wired click→row.toggle() and aria-expanded out of the box.
 *
 * Slot it INSIDE a cell of the expandable row (never as a bare row child —
 * rows are subgrid containers where any extra child would consume a column
 * track):
 *
 * ```html
 * <md-table-row expandable>
 *   <md-table-cell padding="checkbox"><md-table-expand-toggle></md-table-expand-toggle></md-table-cell>
 *   <md-table-cell>…</md-table-cell>
 *   <div slot="expanded">Details…</div>
 * </md-table-row>
 * ```
 */
@Component({
  tag: 'md-table-expand-toggle',
  styleUrl: 'md-table-expand-toggle.css',
  shadow: true,
})
export class MdTableExpandToggle {
  @Element() el!: HTMLElement;

  /** Accessible label of the toggle button. */
  @Prop({ attribute: 'button-label' }) buttonLabel: string = 'Expand row';

  /**
   * Caret icon (Material Symbols ligature). The expanded rotation still
   * applies (--md-table-expand-toggle-rotation, default 90deg) — pick a
   * "collapsed-pointing" glyph like the default chevron_right, or pair e.g.
   * "expand_circle_right" with a custom rotation.
   */
  @Prop() icon: string = 'chevron_right';

  /** Mirrors the owning row's `expanded` state (drives the caret rotation). */
  @State() private expanded: boolean = false;

  private row: ExpandableRow | null = null;

  private onRowExpandedChange = (e: Event) => {
    this.expanded = !!(e as CustomEvent<{ expanded: boolean }>).detail?.expanded;
  };

  private bindRow() {
    this.row = this.el.closest('md-table-row') as ExpandableRow | null;
    this.expanded = !!this.row?.expanded;
    this.row?.addEventListener('mdRowExpandedChange', this.onRowExpandedChange);
  }

  // Bind in connectedCallback, NOT componentWillLoad: sorting/paging via the
  // documented appendChild pattern disconnects + reconnects the row, and a
  // willLoad-only bind would leave the toggle permanently dead after the
  // first reorder (disconnectedCallback nulls the row).
  connectedCallback() {
    this.bindRow();
  }

  disconnectedCallback() {
    this.row?.removeEventListener('mdRowExpandedChange', this.onRowExpandedChange);
    this.row = null;
  }

  private onClick = (e: Event) => {
    // The toggle owns this click — never bubble into row-click selection.
    e.stopPropagation();
    void this.row?.toggle?.();
  };

  render() {
    return (
      <Host
        class={{
          'md-table-expand-toggle': true,
          'md-table-expand-toggle--expanded': this.expanded,
        }}
      >
        <md-icon-button
          size="xs"
          icon={this.icon}
          aria-label={this.buttonLabel}
          aria-expanded={this.expanded ? 'true' : 'false'}
          onClick={this.onClick}
        ></md-icon-button>
      </Host>
    );
  }
}
