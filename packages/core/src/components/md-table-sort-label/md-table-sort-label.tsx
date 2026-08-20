import { Component, Host, h, Prop, Event, EventEmitter } from '@stencil/core';

/** Material Symbols 24px `arrow_upward` glyph. */
const ICON_ARROW = 'M4 12l1.41 1.41L11 7.83V20h2V7.83l5.58 5.59L20 12l-8-8-8 8z';

/**
 * Material Design 3 — Table Sort Label.
 *
 * A clickable header label with a sort indicator that reflects the current
 * sort state. Place inside a `<md-table-cell head>`.
 *
 * Wiring:
 *   1. Set `column="<id>"`
 *   2. The parent `<md-table>` listens for `mdSortRequest` (auto-bubbled),
 *      updates its `sort-by` / `sort-order`, and PUSHES the resulting
 *      `active` / `order` back into every sort label — no observers.
 *
 * The arrow is hidden at rest and fades in at 60% opacity on hover or keyboard
 * focus, so an unsorted column advertises sorting only when it is pointed at.
 * Once the column is the sort key the arrow stays fully opaque, tinted with the
 * active colour, and rotates 180° to point down for descending. The rotation
 * runs on the spatial spring, the colour/opacity on the effects spring.
 */
@Component({
  tag: 'md-table-sort-label',
  styleUrl: 'md-table-sort-label.css',
  shadow: true,
})
export class MdTableSortLabel {
  /**
   * Column id — matched against the `<md-table>`'s `sort-by` value.
   * Required.
   */
  @Prop() column: string = '';

  /** Disabled — non-interactive. */
  @Prop({ reflect: true }) disabled: boolean = false;

  /**
   * Direction the arrow points by default (the value used when this column
   * becomes the active sort for the first time).
   */
  @Prop() defaultOrder: 'asc' | 'desc' = 'asc';

  /**
   * Visual position of the arrow icon relative to the label.
   * - `end`   — after the label (default)
   * - `start` — before the label
   */
  @Prop({ reflect: true }) iconPosition: 'start' | 'end' = 'end';

  /**
   * Custom sort-arrow icon: a Material Symbols ligature name (e.g. "north",
   * "expand_less"). Empty = the built-in SVG arrow. The icon still rotates
   * 180deg for descending via the same CSS, so pick an "ascending-pointing"
   * glyph.
   */
  @Prop() icon: string = '';

  /** Whether this column is the active sort. Pushed by the parent `<md-table>`. */
  @Prop({ mutable: true, reflect: true }) active: boolean = false;

  /** Active sort direction. Pushed by the parent `<md-table>`. */
  @Prop({ mutable: true, reflect: true }) order: 'asc' | 'desc' | 'none' = 'none';

  /**
   * Local density rung. Drives the same `--md-sys-density-scale` signal that a
   * global `data-density` ancestor sets, so a local value simply overrides the
   * inherited one. 0 = default, -4 = ultra-compact.
   */
  @Prop({ reflect: true }) density: 0 | -1 | -2 | -3 | -4 = 0;

  /** Fired when the user requests to sort by this column. */
  @Event() mdSortRequest: EventEmitter<{ column: string; defaultOrder: 'asc' | 'desc' }>;

  private handleClick = () => {
    if (this.disabled || !this.column) return;
    this.mdSortRequest.emit({ column: this.column, defaultOrder: this.defaultOrder });
  };

  private handleKeyDown = (e: KeyboardEvent) => {
    if (this.disabled) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.handleClick();
    }
  };

  private renderArrow() {
    return (
      <span
        class={{
          'md-table-sort-label__icon': true,
          'md-table-sort-label__icon--active': this.active,
          'md-table-sort-label__icon--desc': this.active && this.order === 'desc',
        }}
        part="icon"
        aria-hidden="true"
      >
        {this.icon ? (
          <span class="material-symbols-outlined md-table-sort-label__icon-glyph">{this.icon}</span>
        ) : (
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d={ICON_ARROW} />
          </svg>
        )}
      </span>
    );
  }

  render() {

    // aria-sort actually belongs on the parent columnheader cell (md-table-cell head),
    // but we surface it on the host as well so it's present regardless of how the
    // header is composed.
    return (
      <Host
        class={{
          'md-table-sort-label': true,
          'md-table-sort-label--active': this.active,
          'md-table-sort-label--disabled': this.disabled,
        }}
        role="button"
        tabindex={this.disabled ? '-1' : '0'}
        aria-disabled={this.disabled ? 'true' : null}
        onClick={this.handleClick}
        onKeyDown={this.handleKeyDown}
      >
        {this.iconPosition === 'start' && this.renderArrow()}
        <span class="md-table-sort-label__text" part="label">
          <slot />
        </span>
        {this.iconPosition === 'end' && this.renderArrow()}
        <span class="md-table-sort-label__sr" aria-live="polite">
          {this.active ? (this.order === 'desc' ? 'sorted descending' : 'sorted ascending') : ''}
        </span>
      </Host>
    );
  }
}
