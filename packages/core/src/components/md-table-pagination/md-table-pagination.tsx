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
  Listen,
} from '@stencil/core';

/**
 * Material Design 3 — Table Pagination.
 *
 * Drop into a `<md-table-container slot="bottom">` for a complete data table.
 * Mirrors the MUI `<TablePagination>` API surface. Built from house
 * primitives: `md-icon-button` navigation and an `md-select` rows-per-page
 * picker (proper dismissal, keyboard support and theming for free).
 *
 * Emits:
 *   - `mdPageChange` — when the page changes
 *   - `mdRowsPerPageChange` — when the rows-per-page selector changes
 *
 * @slot actions - Custom pagination actions appended after the nav buttons
 *                 (MUI ActionsComponent parity).
 */
@Component({
  tag: 'md-table-pagination',
  styleUrl: 'md-table-pagination.css',
  shadow: true,
})
export class MdTablePagination {
  @Element() el!: HTMLElement;

  /** Total number of rows in the dataset. */
  @Prop() count: number = 0;

  /** Current zero-based page. */
  @Prop({ mutable: true, reflect: true }) page: number = 0;

  /** Rows shown per page. */
  @Prop({ mutable: true, reflect: true, attribute: 'rows-per-page' })
  rowsPerPage: number = 10;

  /**
   * Comma-separated list of options for the rows-per-page selector
   * (e.g. `"5,10,25,50"`). Use `"all"` (case-insensitive) to add an
   * "All" option that maps to the total count.
   */
  @Prop({ attribute: 'rows-per-page-options' }) rowsPerPageOptions: string = '5,10,25,50';

  /** Show the first / last page buttons. */
  @Prop({ reflect: true, attribute: 'show-first-last' }) showFirstLast: boolean = false;

  /**
   * Custom label used to display the current row range
   * (e.g. `"Showing %from%–%to% of %count%"`).
   * Tokens: `%from%`, `%to%`, `%count%`.
   */
  @Prop({ attribute: 'label-displayed-rows' })
  labelDisplayedRows: string = '%from%–%to% of %count%';

  /** Label for the rows-per-page selector. */
  @Prop({ attribute: 'label-rows-per-page' }) labelRowsPerPage: string = 'Rows per page:';

  /** Accessible label for the first-page button. */
  @Prop({ attribute: 'label-first-page' }) labelFirstPage: string = 'First page';

  /** Accessible label for the previous-page button. */
  @Prop({ attribute: 'label-previous-page' }) labelPreviousPage: string = 'Previous page';

  /** Accessible label for the next-page button. */
  @Prop({ attribute: 'label-next-page' }) labelNextPage: string = 'Next page';

  /** Accessible label for the last-page button. */
  @Prop({ attribute: 'label-last-page' }) labelLastPage: string = 'Last page';

  /** Label of the "All" rows-per-page option. */
  @Prop({ attribute: 'label-all' }) labelAll: string = 'All';

  /** Compact pagination layout (good for embedding inside cards). */
  @Prop({ reflect: true }) compact: boolean = false;

  /** Disabled state. */
  @Prop({ reflect: true }) disabled: boolean = false;

  /**
   * Local density rung. Drives the same `--md-sys-density-scale` signal that a
   * global `data-density` ancestor sets, so a local value simply overrides the
   * inherited one. 0 = default, -4 = ultra-compact.
   */
  @Prop({ reflect: true }) density: 0 | -1 | -2 | -3 | -4 = 0;

  /** Fired when the user changes the page. */
  @Event() mdPageChange: EventEmitter<{ page: number }>;

  /** Fired when the user changes rows-per-page. */
  @Event() mdRowsPerPageChange: EventEmitter<{ rowsPerPage: number }>;

  @Watch('count')
  @Watch('rowsPerPage')
  clampPage() {
    const last = this.lastPage;
    if (this.page > last) {
      this.page = Math.max(0, last);
    }
  }

  private get selectDensity(): 0 | -1 | -2 | -3 | -4 {
    if (typeof getComputedStyle !== 'function') return -2;
    try {
      const raw = getComputedStyle(this.el).getPropertyValue('--md-sys-density-scale').trim();
      const n = parseInt(raw, 10);
      if (Number.isFinite(n) && n <= -2) return Math.max(-4, n) as -2 | -3 | -4;
    } catch { /* noop */ }
    return -2;
  }

  /** Internal md-icon-buttons / md-select emit composed events that retarget
   *  to this host — swallow them so app-level delegation sees only the
   *  pagination's own events. */
  @Listen('mdClick')
  @Listen('mdChange')
  @Listen('mdOpen')
  @Listen('mdClose')
  onInternalChrome(e: globalThis.Event) {
    if (e.target === this.el) e.stopPropagation();
  }

  /** Programmatically jump to a page. */
  @Method()
  async goToPage(page: number): Promise<void> {
    const target = Math.max(0, Math.min(page, this.lastPage));
    if (target === this.page) return;
    this.page = target;
    this.mdPageChange.emit({ page: this.page });
  }

  /** Programmatically set rows-per-page. */
  @Method()
  async setRowsPerPage(rpp: number): Promise<void> {
    if (rpp <= 0 || rpp === this.rowsPerPage) return;
    this.rowsPerPage = rpp;
    this.page = 0;
    this.mdRowsPerPageChange.emit({ rowsPerPage: rpp });
    this.mdPageChange.emit({ page: 0 });
  }

  private get lastPage(): number {
    if (this.rowsPerPage <= 0) return 0;
    return Math.max(0, Math.ceil(this.count / this.rowsPerPage) - 1);
  }

  private get from(): number {
    if (this.count === 0) return 0;
    return this.page * this.rowsPerPage + 1;
  }

  private get to(): number {
    if (this.count === 0) return 0;
    return Math.min((this.page + 1) * this.rowsPerPage, this.count);
  }

  private get displayLabel(): string {
    return this.labelDisplayedRows
      .replace('%from%', String(this.from))
      .replace('%to%', String(this.to))
      .replace('%count%', String(this.count));
  }

  private get options(): { value: number; label: string }[] {
    return this.rowsPerPageOptions
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((raw) => {
        if (raw.toLowerCase() === 'all') {
          return { value: this.count || -1, label: this.labelAll };
        }
        const n = Number(raw);
        return { value: Number.isFinite(n) ? n : 0, label: raw };
      })
      .filter((o) => o.value > 0);
  }

  private handleFirst = () => this.goToPage(0);
  private handlePrev = () => this.goToPage(this.page - 1);
  private handleNext = () => this.goToPage(this.page + 1);
  private handleLast = () => this.goToPage(this.lastPage);

  private handleRppChange = (e: CustomEvent<string>) => {
    const n = Number(e.detail);
    if (Number.isFinite(n) && n > 0) this.setRowsPerPage(n);
  };

  render() {
    const isFirst = this.page === 0;
    const isLast = this.page >= this.lastPage;
    const opts = this.options;
    const selectOptions = opts.map((o) => ({ value: String(o.value), label: o.label }));

    return (
      <Host
        class={{
          'md-table-pagination': true,
          'md-table-pagination--compact': this.compact,
          'md-table-pagination--disabled': this.disabled,
        }}
        role="navigation"
        aria-label="Pagination"
      >
        {/* Range display LEADS the bar (far left; customize the string via
            label-displayed-rows, e.g. "Showing %from%–%to% of %count% cases"),
            while the controls group at the trailing edge. */}
        <div class="md-table-pagination__display" part="display" aria-live="polite">
          {this.displayLabel}
        </div>

        <div class="md-table-pagination__rpp" part="rpp">
          <span class="md-table-pagination__rpp-label" id="rpp-label">
            {this.labelRowsPerPage}
          </span>
          <md-select
            class="md-table-pagination__rpp-select"
            part="rpp-select"
            aria-label={this.labelRowsPerPage}
            density={this.selectDensity}
            options={selectOptions}
            value={String(this.rowsPerPage)}
            disabled={this.disabled}
            placement="top-start"
            onMdChange={this.handleRppChange}
          ></md-select>
        </div>

        <div class="md-table-pagination__nav" part="nav">
          {this.showFirstLast && (
            <md-icon-button
              part="first-button"
              icon="first_page"
              size="sm"
              aria-label={this.labelFirstPage}
              disabled={isFirst || this.disabled}
              onClick={this.handleFirst}
            ></md-icon-button>
          )}
          <md-icon-button
            part="prev-button"
            icon="chevron_left"
            size="sm"
            aria-label={this.labelPreviousPage}
            disabled={isFirst || this.disabled}
            onClick={this.handlePrev}
          ></md-icon-button>
          <md-icon-button
            part="next-button"
            icon="chevron_right"
            size="sm"
            aria-label={this.labelNextPage}
            disabled={isLast || this.disabled}
            onClick={this.handleNext}
          ></md-icon-button>
          {this.showFirstLast && (
            <md-icon-button
              part="last-button"
              icon="last_page"
              size="sm"
              aria-label={this.labelLastPage}
              disabled={isLast || this.disabled}
              onClick={this.handleLast}
            ></md-icon-button>
          )}
          <slot name="actions"></slot>
        </div>
      </Host>
    );
  }
}
