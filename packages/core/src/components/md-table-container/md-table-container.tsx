import { Component, Host, h, Prop, Element, Listen, forceUpdate } from '@stencil/core';

/**
 * Material Design 3 — Table Container
 *
 * The outer surface that wraps a `<md-table>`, optional `<md-table-toolbar>`
 * and `<md-table-pagination>`. Provides elevation, shape, and the scroll
 * context (with optional max-height) for sticky headers / columns.
 *
 * Compose freely:
 *
 * ```html
 * <md-table-container variant="elevated" max-height="480px">
 *   <md-table-toolbar headline="Users"></md-table-toolbar>
 *   <md-table>…</md-table>
 *   <md-table-pagination></md-table-pagination>
 * </md-table-container>
 * ```
 */
@Component({
  tag: 'md-table-container',
  styleUrl: 'md-table-container.css',
  shadow: true,
})
export class MdTableContainer {
  @Element() el!: HTMLElement;

  /**
   * Visual surface variant.
   * - `elevated` — surface-container-low + box-shadow
   * - `outlined` — surface + 1px outline
   * - `filled`   — surface-container-low, no shadow / outline
   * - `flat`     — transparent (use when nesting inside another surface)
   */
  @Prop({ reflect: true }) variant: 'elevated' | 'outlined' | 'filled' | 'flat' = 'elevated';

  /**
   * Container shape — large for dashboards, medium for dense, small for compact.
   * Maps to MD3 `--md-sys-shape-corner-{size}` tokens.
   */
  @Prop({ reflect: true }) shape: 'extra-large' | 'large' | 'medium' | 'small' | 'none' = 'large';

  /**
   * If set, the table area becomes scrollable up to this max-height
   * (e.g. `"480px"`, `"60vh"`). Required for sticky header / column.
   */
  @Prop({ attribute: 'max-height' }) maxHeight: string = '';

  /**
   * If set, the table area becomes scrollable up to this min-height
   * (useful to keep an empty-state visible).
   */
  @Prop({ attribute: 'min-height' }) minHeight: string = '';

  /**
   * Vibrant tonality: tints the whole table with primary/tertiary container
   * tones (coloured header, primary hover, tertiary selection, primary-tinted
   * surface). Cascades to the contained md-table via CSS custom properties.
   */
  @Prop({ reflect: true }) vibrant: boolean = false;

  /**
   * Explicit MD3 elevation level (0–5), overriding the variant's default
   * shadow. Handy to raise/flatten the surface without changing `variant`
   * (e.g. `variant="outlined" elevation="2"`). Also settable via
   * `--md-table-container-elevation`.
   */
  @Prop({ reflect: true }) elevation?: 0 | 1 | 2 | 3 | 4 | 5;

  /**
   * Bracket page changes with the table's built-in FLIP motion. Pagination is
   * slotted into the CONTAINER (not the table), so its events never pass
   * through md-table — the container hears them instead, in the CAPTURE phase
   * (i.e. BEFORE the consumer's own handler mutates the rows), and arms the
   * slotted table synchronously via the internal `mdMotionArm` event. The
   * table's rAF-deferred play() then animates whatever the handler changed.
   */
  // The frozen class mirrors the slotted table's reflected frozen-header
  // attribute — that can change at RUNTIME (the prop is reactive), so watch
  // for it; without this the mirror goes stale and the two scroll owners
  // disagree (nested scrollbars).
  private frozenMirror?: MutationObserver;
  private childMirror?: MutationObserver;

  connectedCallback() {
    if (typeof MutationObserver === 'undefined') return;
    // Two narrowly-scoped observers: subtree childList would forceUpdate on
    // EVERY row mutation (pagination re-slices, sorts). We only care about
    // (a) the frozen-header attribute anywhere below, (b) direct children
    // changing (the md-table itself being added/removed).
    this.frozenMirror = new MutationObserver(() => forceUpdate(this));
    this.frozenMirror.observe(this.el, {
      subtree: true,
      attributes: true,
      attributeFilter: ['frozen-header'],
    });
    this.childMirror = new MutationObserver((muts) => {
      for (const m of muts) {
        for (const n of [...m.addedNodes, ...m.removedNodes]) {
          if ((n as HTMLElement).tagName === 'MD-TABLE') {
            forceUpdate(this);
            return;
          }
        }
      }
    });
    this.childMirror.observe(this.el, { childList: true });
  }

  disconnectedCallback() {
    this.frozenMirror?.disconnect();
    this.frozenMirror = undefined;
    this.childMirror?.disconnect();
    this.childMirror = undefined;
  }

  @Listen('mdPageChange', { capture: true })
  @Listen('mdRowsPerPageChange', { capture: true })
  handlePaginationChange(e: CustomEvent) {
    // Only bracket events coming from a slotted pagination bar — a nested table
    // (which manages its own motion) swallows its internal events already.
    if ((e.target as HTMLElement | null)?.tagName !== 'MD-TABLE-PAGINATION') return;
    const table = this.el.querySelector('md-table');
    table?.dispatchEvent(new CustomEvent('mdMotionArm'));
  }

  render() {
    const style: { [k: string]: string } = {};
    if (this.maxHeight) {
      style['--_max-h'] = this.maxHeight;
      // A frozen-header md-table owns its own body scroll — hand the
      // max-height to it so the scrollbar spans only the body.
      style['--md-table-body-max-h'] = this.maxHeight;
    }
    if (this.minHeight) style['--_min-h'] = this.minHeight;

    // Mirrors the slotted table's EXPLICIT frozen-header prop (reflected as an
    // attribute), so the two never disagree about who scrolls — a mismatch
    // would nest two scrollbars. max-height only controls the SIZE of the
    // frozen body; the architecture is opt-in on the table.
    const frozen = !!this.el.querySelector('md-table[frozen-header]');

    return (
      <Host
        class={{
          'md-table-container': true,
          [`md-table-container--${this.variant}`]: true,
          [`md-table-container--shape-${this.shape}`]: true,
          'md-table-container--scrollable': !!this.maxHeight,
          'md-table-container--frozen-header': frozen,
          'md-table-container--vibrant': this.vibrant,
        }}
        style={style}
      >
        <div class="md-table-container__top" part="top">
          <slot name="top"></slot>
        </div>

        <div class="md-table-container__scroll" part="scroll">
          <slot></slot>
        </div>

        <div class="md-table-container__bottom" part="bottom">
          <slot name="bottom"></slot>
        </div>
      </Host>
    );
  }
}
