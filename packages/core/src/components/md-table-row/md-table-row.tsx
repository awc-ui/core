import {
  Component,
  Host,
  h,
  Prop,
  Element,
  Event,
  EventEmitter,
  Watch,
  Method,
  State,
} from '@stencil/core';

/**
 * Material Design 3 — Table Row.
 *
 * A row inside a `<md-table>` that contains `<md-table-cell>` children.
 * The host is a REAL grid box that spans the table's tracks and lays its
 * cells on them via `grid-template-columns: subgrid` — so row hover,
 * stripes, dividers, selection tint, sticky rows and focus rings all work
 * on the row itself, and a wrong cell count skews one row, never the table.
 *
 * The parent `<md-table>` stamps context (`rowgroup`, stripe parity,
 * stickiness) onto the row; the row casts typography/color context down to
 * its cells with `::slotted()` custom properties — no observers.
 *
 * Behaviors:
 * - `selected` — selection state (visual + ARIA)
 * - `disabled` — non-interactive
 * - `clickable` — adds keyboard activation (Enter / Space) + emits `mdRowClick`
 * - `expandable` — toggles an "expanded details" zone (use the `expanded` slot),
 *   spring-animated via the grid-rows height pattern
 */
@Component({
  tag: 'md-table-row',
  styleUrl: 'md-table-row.css',
  shadow: true,
})
export class MdTableRow {
  @Element() el!: HTMLElement;

  /**
   * Which rowgroup this row belongs to. Stamped automatically by the parent
   * `<md-table>` (head / body / foot) — set it manually only when using rows
   * outside a table.
   */
  @Prop({ reflect: true }) rowgroup: 'head' | 'body' | 'foot' = 'body';

  /** Selected (highlighted) state. Reflected. */
  @Prop({ mutable: true, reflect: true }) selected: boolean = false;

  /** Disabled — row receives no hover/click handlers. */
  @Prop({ reflect: true }) disabled: boolean = false;

  /** Whether this row counts as selectable (used by `<md-table>` selection coordination). */
  @Prop() selectable: boolean = true;

  /** When true, treat the entire row as a button (Enter/Space activates `mdRowClick`). */
  @Prop({ reflect: true }) clickable: boolean = false;

  /** Identifier attached to selection / click events. Defaults to row index. */
  @Prop() value: string = '';

  /** Render an "expandable details" zone toggleable via `toggle()`. */
  @Prop({ reflect: true }) expandable: boolean = false;

  /** Whether the expandable zone is open. */
  @Prop({ mutable: true, reflect: true }) expanded: boolean = false;

  /** Highlights the row using primary-container (e.g. for the focused row). */
  @Prop({ reflect: true, attribute: 'highlight' }) highlight: boolean = false;

  /** Fired when the user clicks (or Enter/Space-activates) the row. */
  @Event() mdRowClick: EventEmitter<{ value: string; row: HTMLElement }>;

  /**
   * Fired when the `selected` state changes (used by `<md-table>` for
   * selection coordination).
   */
  @Event() mdRowSelectionChange: EventEmitter<{ selected: boolean; value: string }>;

  /** Fired when the row's expanded state changes. */
  @Event() mdRowExpandedChange: EventEmitter<{ expanded: boolean }>;

  @State() private _hasExpandedSlot = false;

  componentDidLoad() {
    const slot = this.el.shadowRoot?.querySelector('slot[name="expanded"]') as HTMLSlotElement | null;
    slot?.addEventListener('slotchange', () => {
      this._hasExpandedSlot = slot.assignedElements().length > 0;
    });
    this._hasExpandedSlot = !!slot && slot.assignedElements().length > 0;
  }

  @Watch('selected')
  onSelectedChange(newVal: boolean, oldVal: boolean) {
    if (newVal === oldVal) return;
    this.mdRowSelectionChange.emit({ selected: newVal, value: this.value });
  }

  @Watch('expanded')
  onExpandedChange(newVal: boolean, oldVal: boolean) {
    if (newVal === oldVal) return;
    this.mdRowExpandedChange.emit({ expanded: newVal });
  }

  /** Toggle the expanded zone. */
  @Method()
  async toggle(): Promise<void> {
    if (!this.expandable) return;
    this.expanded = !this.expanded;
  }

  private handleClick = (e: MouseEvent) => {
    if (this.disabled) return;
    // Don't fire row click for clicks on interactive descendants (checkboxes, buttons, links)
    const target = e.target as HTMLElement;
    if (
      target.closest(
        'md-checkbox, md-radio, md-button, md-icon-button, md-switch, md-fab, md-chip, button, a, input, select, textarea',
      )
    ) {
      return;
    }
    if (this.clickable) {
      this.mdRowClick.emit({ value: this.value, row: this.el });
    }
  };

  private handleKeyDown = (e: KeyboardEvent) => {
    if (this.disabled || !this.clickable) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.mdRowClick.emit({ value: this.value, row: this.el });
    }
  };

  render() {
    return (
      <Host
        class={{
          'md-table-row': true,
          [`md-table-row--${this.rowgroup}`]: true,
          'md-table-row--selected': this.selected,
          'md-table-row--disabled': this.disabled,
          'md-table-row--clickable': this.clickable,
          'md-table-row--highlight': this.highlight,
          'md-table-row--expandable': this.expandable,
          'md-table-row--expanded': this.expanded,
        }}
        role="row"
        // aria-selected is stamped by md-table (syncRows/syncSelectionUI) ONLY
        // on selectable body rows in a selection-enabled table — rendering it
        // unconditionally made SRs announce "not selected" on read-only tables
        // and header rows (WAI tables audit).
        aria-disabled={this.disabled ? 'true' : null}
        // aria-expanded is a CONDITIONAL row property: valid only on a row
        // inside a treegrid, invalid on a plain table row (axe
        // aria-conditional-attr). The owning md-table promotes its structural
        // role from table -> treegrid whenever it has any expandable row, so
        // this attribute is always exposed under a treegrid ancestor. The
        // disclosure button (md-table-expand-toggle) mirrors the same state on
        // its role="button", where aria-expanded is unconditionally valid.
        aria-expanded={this.expandable ? (this.expanded ? 'true' : 'false') : null}
        tabindex={this.clickable && !this.disabled ? '0' : null}
        onClick={this.handleClick}
        onKeyDown={this.handleKeyDown}
      >
        <slot
          onSlotchange={() =>
            // Cells slot into the ROW's shadow — cell additions/removals (e.g.
            // a checkbox column appearing when selection turns on) are
            // invisible to md-table without this relay (same non-composed
            // slotchange rule as the rowgroups).
            this.el.dispatchEvent(new CustomEvent('mdRowgroupSlotChange', { bubbles: true }))
          }
        ></slot>
        {this.expandable && (
          <div
            class={{
              'md-table-row__expanded': true,
              'md-table-row__expanded--open': this.expanded,
            }}
            part="expanded"
            // A row may only own cells/headers — expose the detail panel as a
            // full-width CELL (role=region here was an axe-confirmed content
            // model violation once the panel opened).
            role="cell"
            aria-colspan={String(
              Array.from(this.el.children).filter((c) => c.tagName === 'MD-TABLE-CELL').length || 1,
            )}
            aria-hidden={!this.expanded ? 'true' : null}
            // inert while collapsed: the height animation only clips the
            // panel visually — without inert, focusable content inside stays
            // tab-reachable while invisible.
            inert={!this.expanded}
          >
            <div class="md-table-row__expanded-sizer">
              <div class="md-table-row__expanded-inner">
                <slot name="expanded" />
              </div>
            </div>
          </div>
        )}
      </Host>
    );
  }
}
