import { Component, Host, h, Prop } from '@stencil/core';

/**
 * Material Design 3 — Table Cell.
 *
 * The visual surface for a single grid cell. Renders as either a `cell`
 * (default) or `columnheader` / `rowheader` based on `head` / `scope`.
 *
 * Props are intentionally MUI-compatible:
 *   - `align="start" | "center" | "end" | "justify"`
 *   - `numeric` (right-aligns + tabular numbers)
 *   - `padding="none" | "checkbox" | "default"`
 *   - `head` (renders as `<th>` semantics with `scope="col"|"row"`)
 *   - `sticky="start" | "end"` (sticky first / last column)
 *   - `colspan` / `rowspan` (grid spans)
 *
 * The cell is a dumb surface: row state (selected / disabled / header
 * context) arrives as inherited CSS custom properties cast by
 * `<md-table-row>` — no observers, no DOM queries.
 */
@Component({
  tag: 'md-table-cell',
  styleUrl: 'md-table-cell.css',
  shadow: true,
})
export class MdTableCell {
  /** Text alignment within the cell. */
  @Prop({ reflect: true }) align: 'start' | 'center' | 'end' | 'justify' = 'start';

  /** Right-align + tabular figures (for monetary / numeric data). */
  @Prop({ reflect: true }) numeric: boolean = false;

  /** Padding mode (MUI parity). */
  @Prop({ reflect: true }) padding: 'default' | 'none' | 'checkbox' = 'default';

  /** Render as a column / row header. */
  @Prop({ reflect: true }) head: boolean = false;

  /** Header scope (used when `head` is true). */
  @Prop({ reflect: true }) scope: 'col' | 'row' | 'colgroup' | 'rowgroup' | '' = '';

  /** Sticky positioning — `start` for first column, `end` for last column. */
  @Prop({ reflect: true }) sticky: 'start' | 'end' | '' = '';

  /** Number of columns this cell spans (CSS Grid `grid-column: span N`). */
  @Prop({ attribute: 'colspan' }) colSpan: number = 1;

  /** Number of rows this cell spans (CSS Grid `grid-row: span N`). */
  @Prop({ attribute: 'rowspan' }) rowSpan: number = 1;

  /** Disable text-wrap (single-line, ellipsis). */
  @Prop({ reflect: true }) ellipsis: boolean = false;

  /** Optional content variant: `body` | `meta` (smaller, dimmer). */
  @Prop({ reflect: true }) variant: 'body' | 'meta' = 'body';

  /**
   * Suppress the automatic pin indicator that a sticky header cell shows.
   * By default a frozen (sticky) column always advertises that it's pinned
   * with a small pin icon in its header; set this to opt out (e.g. a sticky
   * checkbox column — which is auto-skipped anyway).
   */
  @Prop({ reflect: true, attribute: 'no-pin-indicator' }) noPinIndicator: boolean = false;

  /**
   * Custom pin-indicator icon: a Material Symbols ligature (e.g. "anchor",
   * "keep"). Empty = the built-in 45° push-pin SVG. Usually set ONCE on
   * md-table via its `pin-icon` prop, which casts the value to every pinned
   * header cell; setting it here directly overrides the cast.
   */
  @Prop({ attribute: 'pin-icon' }) pinIcon: string = '';

  /**
   * Local density rung. Drives the same `--md-sys-density-scale` signal that a
   * global `data-density` ancestor sets, so a local value simply overrides the
   * inherited one. 0 = default, -4 = ultra-compact.
   */
  @Prop({ reflect: true }) density: 0 | -1 | -2 | -3 | -4 = 0;

  private get role(): 'columnheader' | 'rowheader' | 'cell' {
    if (this.head) {
      if (this.scope === 'row' || this.scope === 'rowgroup') return 'rowheader';
      return 'columnheader';
    }
    return 'cell';
  }

  /**
   * A frozen (sticky) column header always shows a pin affordance so users can
   * tell at a glance the column is pinned. Skipped for the checkbox column
   * (no label) and when explicitly opted out.
   */
  private get showPin(): boolean {
    return this.head && !!this.sticky && this.padding !== 'checkbox' && !this.noPinIndicator;
  }

  render() {
    const style: { [k: string]: string } = {};
    if (this.colSpan > 1) style.gridColumn = `span ${this.colSpan}`;
    if (this.rowSpan > 1) style.gridRow = `span ${this.rowSpan}`;

    return (
      <Host
        class={{
          'md-table-cell': true,
          'md-table-cell--head': this.head,
          'md-table-cell--pinned': this.showPin,
          [`md-table-cell--align-${this.align}`]: true,
          [`md-table-cell--padding-${this.padding}`]: true,
          [`md-table-cell--variant-${this.variant}`]: true,
        }}
        role={this.role}
        scope={this.head && this.scope ? this.scope : undefined}
        aria-colspan={this.colSpan > 1 ? String(this.colSpan) : null}
        aria-rowspan={this.rowSpan > 1 ? String(this.rowSpan) : null}
        style={style}
      >
        {this.showPin && (
          <span
            class="md-table-cell__pin"
            part="pin"
            aria-hidden="true"
            title={this.sticky === 'end' ? 'Pinned right' : 'Pinned left'}
          >
            {this.pinIcon ? (
              <span class="material-symbols-outlined md-table-cell__pin-glyph">{this.pinIcon}</span>
            ) : (
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M16,12V4H17V2H7V4H8V12L6,14V16H11.2V22H12.8V16H18V14L16,12Z" />
              </svg>
            )}
          </span>
        )}
        <span class="md-table-cell__content" part="content">
          <slot />
        </span>
      </Host>
    );
  }
}
