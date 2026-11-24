import { Component, Host, h, Prop, Element, State, Watch } from '@stencil/core';
import { beginInitialInteractionMotion, completeInitialInteractionMotion, initialInteractionMotionRendered, reconnectInteractionMotion, disconnectInteractionMotion, canAnimateInteraction, suppressInteractionMotion, prepareInteractionUpdate } from '../../utils/initial-motion';

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
  styleUrls: ['../../utils/initial-motion.css', 'md-table-toolbar.css'],
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
  @State() private selectionCaptionEntering = false;

  private selectionCaptionAnimation?: Animation;

  @Watch('numSelected')
  onNumSelectedChange(value: number, previousValue: number) {
    if (!(value > 0)) {
      this.selectionCaptionEntering = false;
    } else if (!(previousValue > 0)) {
      this.selectionCaptionEntering = canAnimateInteraction(this.el);
    }
  }

  private parentTable: HTMLMdTableElement | null = null;
  private boundListener: ((e: Event) => void) | null = null;
  private loaded = false;

  componentDidLoad() {
    try {
      this.loaded = true;
      const shadow = this.el.shadowRoot;
      if (!shadow) return;
      this.bindSlotChanges(shadow);
      if (!this.parentTable) this.bindSelection();
    } finally {
      completeInitialInteractionMotion(this);
    }
  }

  private bindSelection() {
    if (!this.autoBind) return;
    const table = this.el.closest('md-table-container')?.querySelector('md-table');
    if (!table) return;

    let receivedEvent = false;
    const listener = (event: Event) => {
      receivedEvent = true;
      const detail = (event as CustomEvent<{ count: number }>).detail;
      this.numSelected = detail?.count ?? 0;
    };
    this.parentTable = table;
    this.boundListener = listener;
    table.addEventListener('mdSelectionChange', listener);

    // The toolbar can render before the table or rows are upgraded. Mirror
    // the authored body selection, then adopt the table's initialized model.
    const rows = Array.from(table.querySelectorAll('md-table-row')).filter(row => !row.closest('md-table-head, md-table-foot'));
    const selection = rows.filter(row => {
      const selected = row.selected ?? (row.hasAttribute('selected') && row.getAttribute('selected') !== 'false');
      const disabled = row.disabled ?? (row.hasAttribute('disabled') && row.getAttribute('disabled') !== 'false');
      return selected && !disabled && (row.selectable ?? row.getAttribute('selectable') !== 'false');
    });
    this.seedSelectionCount(selection.length);

    const bindingIsCurrent = () => this.boundListener === listener && !receivedEvent && this.el.isConnected;
    const reconcile = async () => {
      const registry = table.ownerDocument.defaultView?.customElements;
      if (!table.getSelection) await registry?.whenDefined('md-table');
      if (rows.some(row => typeof row.selected !== 'boolean')) await registry?.whenDefined('md-table-row');
      if (!bindingIsCurrent()) return;
      const selection = await table.getSelection?.();
      if (selection && bindingIsCurrent()) this.seedSelectionCount(selection.count);
    };
    void reconcile();
  }

  private seedSelectionCount(count: number) {
    if (this.numSelected === count) return;
    suppressInteractionMotion(this.el);
    this.numSelected = count;
  }

  componentDidRender() {
    initialInteractionMotionRendered(this);
    if (!this.selectionCaptionEntering) {
      this.selectionCaptionAnimation = undefined;
      return;
    }

    const animation = this.el.shadowRoot?.querySelector('.md-table-toolbar__selection-caption--entering')
      ?.getAnimations?.().find((motion) => (motion as CSSAnimation).animationName === 'md-table-toolbar-fade');
    if (animation && animation === this.selectionCaptionAnimation) return;
    this.selectionCaptionAnimation = animation;
    const clear = () => {
      if (this.selectionCaptionAnimation !== animation) return;
      this.selectionCaptionEntering = false;
    };
    void Promise.resolve(animation?.finished).then(clear, clear);
  }

  disconnectedCallback() {
    disconnectInteractionMotion(this);
    this.selectionCaptionEntering = false;
    if (this.parentTable && this.boundListener) {
      this.parentTable.removeEventListener('mdSelectionChange', this.boundListener);
    }
    this.parentTable = null;
    this.boundListener = null;
  }

  private bindSlotChanges(shadow: ShadowRoot) {
    const leadingSlot = shadow.querySelector('slot[name="leading"]') as HTMLSlotElement | null;
    const actionsSlot = shadow.querySelector('slot[name="actions"]') as HTMLSlotElement | null;
    const selSlot = shadow.querySelector('slot[name="selection-actions"]') as HTMLSlotElement | null;

    leadingSlot?.addEventListener('slotchange', () => {
      this.hasLeading = leadingSlot.assignedElements().length > 0;
    });
    actionsSlot?.addEventListener('slotchange', () => {
      this.hasActions = actionsSlot.assignedElements().length > 0;
    });
    selSlot?.addEventListener('slotchange', () => {
      this.hasSelectionActions = selSlot.assignedElements().length > 0;
    });

    this.hasLeading = !!leadingSlot && leadingSlot.assignedElements().length > 0;
    this.hasActions = !!actionsSlot && actionsSlot.assignedElements().length > 0;
    this.hasSelectionActions = !!selSlot && selSlot.assignedElements().length > 0;
  }

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
          {!this.inSelectionMode && <slot name="leading" />}
        </div>

        <div class="md-table-toolbar__main" part="main">
          {this.inSelectionMode ? (
            <span
              class={{
                'md-table-toolbar__selection-caption': true,
                'md-table-toolbar__selection-caption--entering': this.selectionCaptionEntering,
              }}
              part="selection-caption"
              aria-live="polite"
            >
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
            <slot name="selection-actions" />
          ) : (
            <slot name="actions" />
          )}
        </div>
      </Host>
    );
  }

  componentWillLoad() {
    beginInitialInteractionMotion(this);
    this.bindSelection();
  }

  connectedCallback() {
    reconnectInteractionMotion(this);
    if (this.loaded) this.bindSelection();
  }

  componentShouldUpdate() {
    prepareInteractionUpdate(this);
    return true;
  }
}
