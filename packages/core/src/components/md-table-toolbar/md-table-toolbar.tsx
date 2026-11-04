import { Component, Host, h, Prop, Element, State, Watch } from '@stencil/core';

/**
 * Material Design 3 — Table Toolbar.
 *
 * The header bar above a `<md-table>` (typically dropped into a
 * `<md-table-container slot="top">`). Shows a title + supporting text and
 * a row of action items. Switches into a "selection" mode when one or more
 * rows are selected (matching the MUI / MD3 data-table pattern).
 *
 * Two modes:
 *   - Default — shows the headline + supporting text + actions
 *   - Selection — shows "%count% selected" + selection-actions (when
 *     `num-selected > 0`)
 *
 * The toolbar can listen to its closest `<md-table>`'s `mdSelectionChange`
 * event automatically (via `auto-bind`) — set `auto-bind` on the toolbar
 * and selection state will track the table without any glue code.
 */
@Component({
  tag: 'md-table-toolbar',
  styleUrl: 'md-table-toolbar.css',
  shadow: true,
})
export class MdTableToolbar {
  @Element() el!: HTMLElement;

  /** Title displayed when no rows are selected. */
  @Prop() headline: string = '';

  /** Optional supporting text under the headline. */
  @Prop({ attribute: 'supporting-text' }) supportingText: string = '';

  /** Number of selected rows (controlled). */
  @Prop({ mutable: true, reflect: true, attribute: 'num-selected' })
  numSelected: number = 0;

  /**
   * Auto-bind to the closest `<md-table>`'s `mdSelectionChange`
   * event so `numSelected` updates with no glue code.
   */
  @Prop({ attribute: 'auto-bind' }) autoBind: boolean = false;

  /**
   * Custom label for the selection-mode caption.
   * Tokens: `%count%`.
   */
  @Prop({ attribute: 'label-selected' }) labelSelected: string = '%count% selected';

  /** Compact density for the toolbar (smaller padding / type). */
  @Prop({ reflect: true }) compact: boolean = false;

  /**
   * Local density rung. Drives the same `--md-sys-density-scale` signal that a
   * global `data-density` ancestor sets, so a local value simply overrides the
   * inherited one. 0 = default, -4 = ultra-compact.
   */
  @Prop({ reflect: true }) density: 0 | -1 | -2 | -3 | -4 = 0;

  @State() private hasSelectionActions: boolean = false;
  @State() private hasActions: boolean = false;
  @State() private hasLeading: boolean = false;

  private parentTable: HTMLElement | null = null;
  private boundListener: ((e: Event) => void) | null = null;
  private loaded = false;

  componentDidLoad() {
    this.syncSlots();
    this.loaded = true;
    this.bindTable();
  }

  connectedCallback() {
    // Re-attach after a move (disconnect + reconnect); the first connection is
    // bound from componentDidLoad once the slots exist.
    if (this.loaded) this.bindTable();
  }

  disconnectedCallback() {
    this.unbindTable();
  }

  @Watch('autoBind')
  onAutoBindChange() {
    if (this.loaded) this.bindTable();
  }

  /**
   * Track the container's `<md-table>`: listen for future `mdSelectionChange`
   * events AND seed from its current selection, so a toolbar that binds after
   * rows were selected (late insertion, re-connection) shows the right count.
   */
  private bindTable() {
    this.unbindTable();
    if (!this.autoBind) return;
    const table = this.el.closest('md-table-container')?.querySelector('md-table') ?? null;
    if (!table) return;
    let heard = false;
    const listener = (e: Event) => {
      heard = true;
      const detail = (e as CustomEvent).detail as { count: number };
      this.numSelected = detail?.count ?? 0;
    };
    this.parentTable = table;
    this.boundListener = listener;
    table.addEventListener('mdSelectionChange', listener);
    const t = table as HTMLElement & {
      componentOnReady?: () => Promise<unknown>;
      getSelection?: () => Promise<{ count: number }>;
    };
    Promise.resolve(t.componentOnReady?.())
      .then(() => t.getSelection?.())
      .then((state) => {
        // A live event that arrived meanwhile is newer than this snapshot.
        if (state && !heard && this.boundListener === listener) this.numSelected = state.count ?? 0;
      })
      .catch(() => {});
  }

  private unbindTable() {
    if (this.parentTable && this.boundListener) {
      this.parentTable.removeEventListener('mdSelectionChange', this.boundListener);
    }
    this.parentTable = null;
    this.boundListener = null;
  }

  private syncSlots = () => {
    const shadow = this.el.shadowRoot;
    if (!shadow) return;
    const leadingSlot = shadow.querySelector('slot[name="leading"]') as HTMLSlotElement | null;
    const actionsSlot = shadow.querySelector('slot[name="actions"]') as HTMLSlotElement | null;
    const selSlot = shadow.querySelector('slot[name="selection-actions"]') as HTMLSlotElement | null;
    this.hasLeading = !!leadingSlot && leadingSlot.assignedElements().length > 0;
    this.hasActions = !!actionsSlot && actionsSlot.assignedElements().length > 0;
    this.hasSelectionActions = !!selSlot && selSlot.assignedElements().length > 0;
  };

  private get inSelectionMode(): boolean {
    return this.numSelected > 0;
  }

  private get selectionLabel(): string {
    // Group digits (e.g. "10,000,000 selected") so large selection counts read
    // cleanly. Locale-aware via toLocaleString.
    return this.labelSelected.replace('%count%', this.numSelected.toLocaleString());
  }

  render() {
    return (
      <Host
        class={{
          'md-table-toolbar': true,
          'md-table-toolbar--compact': this.compact,
          'md-table-toolbar--selection-mode': this.inSelectionMode,
        }}
        role="toolbar"
        aria-label={this.headline || 'Table toolbar'}
      >
        <div class="md-table-toolbar__leading" part="leading" hidden={!this.hasLeading && !this.inSelectionMode}>
          {!this.inSelectionMode && <slot name="leading" onSlotchange={this.syncSlots} />}
        </div>

        <div class="md-table-toolbar__main" part="main">
          {this.inSelectionMode ? (
            <span class="md-table-toolbar__selection-caption" part="selection-caption" aria-live="polite">
              {this.selectionLabel}
            </span>
          ) : (
            <div class="md-table-toolbar__titles">
              {this.headline && (
                <h2 class="md-table-toolbar__headline" part="headline">
                  <slot name="headline">{this.headline}</slot>
                </h2>
              )}
              {this.supportingText && (
                <p class="md-table-toolbar__supporting" part="supporting-text">
                  <slot name="supporting-text">{this.supportingText}</slot>
                </p>
              )}
              {!this.headline && !this.supportingText && (
                <slot name="title-area" />
              )}
            </div>
          )}
        </div>

        <div class="md-table-toolbar__actions" part="actions">
          {this.inSelectionMode ? (
            <slot name="selection-actions" onSlotchange={this.syncSlots} />
          ) : (
            <slot name="actions" onSlotchange={this.syncSlots} />
          )}
        </div>
      </Host>
    );
  }
}
