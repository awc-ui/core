import {
  Component,
  Host,
  h,
  Prop,
  State,
  Event,
  EventEmitter,
  Element,
  Watch,
  Method,
  AttachInternals,
} from '@stencil/core';
import { setFormValue } from '../../utils/form';

/**
 * `md-rating` — Material Design 3 Expressive Rating control.
 *
 * A star-rating input: configurable max, half-step precision, custom icons
 * (Material Symbols glyphs OR slotted SVG/HTML), per-value icons
 * (filled / empty), hover preview, read-only and disabled modes,
 * keyboard navigation (Arrow + Home/End), and reset to zero.
 *
 * MD3 Expressive: items animate with a brief tonal "scale-up" pop on
 * hover and selection; press uses a state-layer + ripple. The
 * underlying ARIA pattern is a slider so screen readers announce the
 * value as a continuous range.
 */
@Component({
  tag: 'md-rating',
  styleUrl: 'md-rating.css',
  shadow: true,
  formAssociated: true,
})
export class MdRating {
  @Element() el!: HTMLElement;

  /**
   * Form-association handle. The rating submits its `value` under the host's
   * `name` via `setFormValue`, so it participates in `<form>`/`FormData`
   * natively — a hidden `<input>` in the shadow root would be invisible to
   * `FormData`.
   */
  @AttachInternals() internals!: ElementInternals;

  /** Current numeric rating (0 → max, half-steps when precision = 0.5). */
  @Prop({ mutable: true, reflect: true }) value: number = 0;

  /** Default value used when the consumer clears the rating (re-clicking the
   *  current value). */
  @Prop({ attribute: 'default-value' }) defaultValue: number = 0;

  /** Maximum rating (number of items rendered). */
  @Prop({ reflect: true }) max: number = 5;

  /** Step size — `1` (full only) or `0.5` (half). */
  @Prop({ reflect: true }) precision: 1 | 0.5 = 1;

  /** Size of each item. */
  @Prop({ reflect: true }) size: 'xs' | 'sm' | 'md' | 'lg' | 'xl' = 'md';

  /** Read-only — purely decorative; no interaction, no focus. */
  @Prop({ reflect: true }) readonly: boolean = false;

  /** Disabled — non-interactive and visually dimmed; not focusable. */
  @Prop({ reflect: true }) disabled: boolean = false;

  /** Soft-disabled — disabled visuals but remains focusable for discoverability. */
  @Prop({ reflect: true, attribute: 'soft-disabled' }) softDisabled: boolean = false;

  /** Material Symbols glyph used for *filled* items. */
  @Prop() icon: string = 'star';

  /** Material Symbols glyph used for *empty* items. */
  @Prop({ attribute: 'empty-icon' }) emptyIcon: string = 'star';

  /**
   * Use the *filled* glyph for empty items as well, drawn with the
   * outline-only color treatment — a solid silhouette outline behind
   * the fill.
   */
  @Prop({ attribute: 'outline-empty', reflect: true }) outlineEmpty: boolean = true;

  /**
   * Optional label provider — `el.getLabel = (v) => "${v} Stars"`. Used
   * by the hidden screen-reader text and the visible value label
   * when `show-value-label` is set.
   */
  @Prop() getLabel?: (value: number) => string;

  /** When true, render the current numeric value beside the items. */
  @Prop({ attribute: 'show-value-label', reflect: true }) showValueLabel: boolean = false;

  /** Accessible label for the slider role. */
  /**
   * Accessible name for the rating control.
   *
   * The attribute is `rating-label`, NOT `aria-label-rating`. Anything starting
   * with `aria-` is parsed as an ARIA attribute, and `aria-label-rating` is not
   * one — so the previous name made axe report a CRITICAL `aria-valid-attr`
   * violation on every consumer that used the documented API. The value still
   * ends up as the host's accessible name; only the attribute spelling changed.
   */
  @Prop({ attribute: 'rating-label' }) ratingLabel: string = 'Rating';

  /** Form name for native form participation. */
  @Prop({ reflect: true }) name: string = '';

  /**
   * Hover-preview behaviour:
   *   - `'preview'` (default) — display the hovered value over the live one.
   *   - `'off'` — no hover preview; `value` is the only signal.
   */
  @Prop({ reflect: true }) hover: 'preview' | 'off' = 'preview';

  /**
   * Local density rung. Drives the same `--md-sys-density-scale` signal that a
   * global `data-density` ancestor sets, so a local value simply overrides the
   * inherited one. 0 = default, -4 = ultra-compact.
   */
  @Prop({ reflect: true }) density: 0 | -1 | -2 | -3 | -4 = 0;

  /** Fires while the user is hovering (or `null` when the cursor leaves). */
  @Event() mdHover: EventEmitter<number | null>;

  /** Fires whenever the value changes via interaction. */
  @Event() mdChange: EventEmitter<number>;

  @State() private hoveredValue: number | null = null;
  @State() private focused: boolean = false;

  /** Initial rating at load, restored on form reset. */
  private initialValue = 0;

  componentWillLoad() {
    this.validateValue(this.value);
    this.initialValue = this.value;
  }

  @Watch('value')
  validateValue(next: number) {
    if (typeof next !== 'number' || Number.isNaN(next)) {
      this.value = 0;
      return;
    }
    if (next < 0) this.value = 0;
    if (next > this.max) this.value = this.max;
    this.syncFormValue();
  }

  /** Re-clamp the value when `max` shrinks, so aria-valuenow can never fall
   *  outside the announced [aria-valuemin, aria-valuemax] range. */
  @Watch('max')
  onMaxChange() {
    if (this.value > this.max) this.value = this.max;
  }

  /** Restore the initial rating when the owning form is reset. */
  formResetCallback() {
    this.value = this.initialValue;
  }

  /** Keep the submitted form value in sync with the rating. */
  private syncFormValue() {
    setFormValue(this.internals, this.value ? String(this.value) : null);
  }

  /** Programmatically focus the rating. */
  @Method()
  async focusRating() {
    const root = this.el.shadowRoot;
    const host = root?.querySelector('.md-rating__items') as HTMLElement | null;
    host?.focus();
  }

  private get isInteractive(): boolean {
    return !this.readonly && !this.disabled && !this.softDisabled;
  }

  private get displayValue(): number {
    return this.hoveredValue != null && this.hover === 'preview'
      ? this.hoveredValue
      : this.value;
  }

  private resolveLabel(value: number): string {
    if (this.getLabel) return this.getLabel(value);
    if (value === 0) return 'Empty';
    if (value === 1) return '1 Star';
    return `${value} Stars`;
  }

  /**
   * Accessible name for the slider. The focusable node is the shadow-internal
   * slider, so an external `<label>`, `aria-labelledby`, or host `aria-label`
   * can't otherwise name it (IDREFs don't cross the shadow boundary; a host
   * label on a generic host is dropped). We forward it: aria-labelledby (text)
   * → host aria-label → associated `<label>`s (via ElementInternals) → the
   * `rating-label` prop as the attribute-only fallback.
   */
  private resolveAccessibleLabel(): string {
    const host = this.el;
    const root = host.getRootNode() as Document | ShadowRoot;
    const byId = (id: string): Element | null =>
      (root as Document).getElementById?.(id) ??
      (typeof document !== 'undefined' ? document.getElementById(id) : null);
    const joinText = (els: Array<Element | null>) =>
      els.map((el) => el?.textContent?.trim() ?? '').filter(Boolean).join(' ');

    const labelledby = host.getAttribute('aria-labelledby');
    if (labelledby) {
      const text = joinText(labelledby.split(/\s+/).map(byId));
      if (text) return text;
    }

    const hostAria = host.getAttribute('aria-label');
    if (hostAria) return hostAria;

    const labels = this.internals?.labels;
    if (labels && labels.length) {
      const text = joinText(Array.from(labels) as Element[]);
      if (text) return text;
    }

    return this.ratingLabel;
  }

  /**
   * Every label the value can take (one per discrete step, 0 → max). Rendered as
   * hidden sizers behind the visible label so its box reserves the widest label's
   * width — otherwise the text swapping on hover ("1 Star" → "3.5 Stars") would
   * resize the box and reflow the whole component. Icon-agnostic re: getLabel.
   */
  private valueLabelVariants(): string[] {
    const step = this.precision || 1;
    const set = new Set<string>();
    for (let v = 0; v <= this.max + 1e-9; v += step) {
      const val = Math.min(Math.round(v / step) * step, this.max);
      set.add(this.resolveLabel(val));
    }
    return Array.from(set);
  }

  private computeValueFromPointer = (
    itemIndex: number,
    e: MouseEvent | PointerEvent,
    itemEl: HTMLElement,
  ): number => {
    if (this.precision === 1) return itemIndex + 1;
    const rect = itemEl.getBoundingClientRect();
    const isRtl = getComputedStyle(this.el).direction === 'rtl';
    const x = e.clientX - rect.left;
    const ratio = isRtl ? 1 - x / rect.width : x / rect.width;
    return itemIndex + (ratio <= 0.5 ? 0.5 : 1);
  };

  private handleItemPointerMove = (i: number) => (e: PointerEvent) => {
    if (!this.isInteractive) return;
    if (this.hover === 'off') return;
    const target = e.currentTarget as HTMLElement;
    const next = this.computeValueFromPointer(i, e, target);
    if (next !== this.hoveredValue) {
      this.hoveredValue = next;
      this.mdHover.emit(next);
    }
  };

  private handlePointerLeave = () => {
    if (!this.isInteractive) return;
    if (this.hoveredValue == null) return;
    this.hoveredValue = null;
    this.mdHover.emit(null);
  };

  private handleItemClick = (i: number) => (e: MouseEvent) => {
    if (!this.isInteractive) return;
    const target = e.currentTarget as HTMLElement;
    let next = this.computeValueFromPointer(i, e, target);

    if (next === this.value) {
      next = this.defaultValue;
    }

    this.value = next;
    this.mdChange.emit(next);
  };

  /**
   * True when ripples are switched off, globally (`data-ripple="off"` on an
   * ancestor) or on this component (`ripple="off"`). Both resolve to
   * `--md-sys-ripple-enabled` in tokens.css §13.
   *
   * md-rating does NOT use the shared md-ripple element — its press effect is a
   * filled copy of the glyph revealed by a WAAPI clip-path animation, so it
   * bypasses the gate in md-ripple entirely and needs its own check to honour
   * the same switch.
   *
   * `=== '0'` deliberately: an unset property returns '' and must mean ENABLED,
   * so a falsiness test would kill ripples wherever the token sheet is absent.
   */
  private rippleSuppressed(): boolean {
    if (typeof getComputedStyle !== 'function') return false;
    try {
      return (
        getComputedStyle(this.el).getPropertyValue('--md-sys-ripple-enabled').trim() === '0'
      );
    } catch {
      return false;
    }
  }

  /**
   * Press ripple, clipped to the glyph. The ripple layer is a filled copy of
   * the icon, so an expanding `clip-path: circle()` from the pointer reveals it
   * within the star/heart/bolt silhouette — a shaped ripple that stays
   * icon-agnostic (no hardcoded star geometry). Runs via the Web Animations API
   * so each press restarts cleanly and it no-ops in non-DOM (spec) envs.
   */
  private handleItemPointerDown = () => (e: PointerEvent) => {
    if (!this.isInteractive || this.rippleSuppressed()) return;
    const item = e.currentTarget as HTMLElement;
    const ripple = item.querySelector('.md-rating__icon--ripple') as HTMLElement | null;
    if (!ripple || typeof ripple.animate !== 'function') return;
    const rect = item.getBoundingClientRect();
    const x = rect.width ? ((e.clientX - rect.left) / rect.width) * 100 : 50;
    const y = rect.height ? ((e.clientY - rect.top) / rect.height) * 100 : 50;
    ripple.animate(
      [
        { clipPath: `circle(0% at ${x}% ${y}%)`, opacity: 0.22 },
        { clipPath: `circle(85% at ${x}% ${y}%)`, opacity: 0 },
      ],
      { duration: 420, easing: 'cubic-bezier(0.2, 0, 0, 1)' },
    );
  };

  private handleKeyDown = (e: KeyboardEvent) => {
    if (!this.isInteractive) return;
    const step = this.precision;
    let next = this.value;
    const isRtl = getComputedStyle(this.el).direction === 'rtl';

    switch (e.key) {
      case 'ArrowRight':
        next = isRtl ? this.value - step : this.value + step;
        break;
      case 'ArrowLeft':
        next = isRtl ? this.value + step : this.value - step;
        break;
      case 'ArrowUp':
        next = this.value + step;
        break;
      case 'ArrowDown':
        next = this.value - step;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = this.max;
        break;
      default:
        if (/^[0-9]$/.test(e.key)) {
          const digit = Number(e.key);
          if (digit <= this.max) next = digit;
        } else {
          // Not a slider key (e.g. Escape/Tab): let it bubble untouched so a
          // dialog/menu ancestor can still dismiss. Home already clears to 0.
          return;
        }
    }
    e.preventDefault();
    next = Math.max(0, Math.min(this.max, next));
    if (next !== this.value) {
      this.value = next;
      this.mdChange.emit(next);
    }
  };

  private handleFocus = () => {
    this.focused = true;
  };

  private handleBlur = () => {
    this.focused = false;
    if (this.hoveredValue != null) {
      this.hoveredValue = null;
      this.mdHover.emit(null);
    }
  };

  private renderItem(i: number) {
    const value = this.displayValue;
    const filledPortion = Math.max(0, Math.min(1, value - i));
    const isHalf = filledPortion > 0 && filledPortion < 1;
    const isFull = filledPortion >= 1;
    const isEmpty = filledPortion <= 0;

    return (
      // A non-interactive <span> (not <button>): the single interactive control
      // is the role="slider" container, so an interactive descendant would trip
      // WAI-ARIA "nested-interactive". Pointer handlers still drive selection;
      // keyboard is handled on the slider. aria-hidden keeps it out of the tree.
      <span
        class={{
          'md-rating__item': true,
          'md-rating__item--full': isFull,
          'md-rating__item--half': isHalf,
          'md-rating__item--empty': isEmpty,
        }}
        part={`item ${isFull ? 'item-full' : isHalf ? 'item-half' : 'item-empty'}`}
        aria-hidden="true"
        onPointerMove={this.handleItemPointerMove(i)}
        onPointerDown={this.handleItemPointerDown()}
        onClick={this.handleItemClick(i)}
      >
        <span class="md-rating__icon md-rating__icon--bg material-symbols-outlined" part="icon-empty">
          {this.outlineEmpty ? this.icon : this.emptyIcon}
        </span>
        <span
          class="md-rating__icon md-rating__icon--fg material-symbols-outlined"
          part="icon-filled"
          style={{ clipPath: `inset(0 ${(1 - filledPortion) * 100}% 0 0)` }}
        >
          {this.icon}
        </span>
        {/* State layer is a third copy of the glyph, so the hover/press overlay
            follows the icon silhouette (star, heart, bolt…) instead of a circle. */}
        <span
          class="md-rating__icon md-rating__icon--state material-symbols-outlined"
          part="state-layer"
          aria-hidden="true"
        >
          {this.icon}
        </span>
        {/* Press ripple, clipped to the glyph via an expanding clip-path circle
            driven from handleItemPointerDown (see there). */}
        <span
          class="md-rating__icon md-rating__icon--ripple material-symbols-outlined"
          part="ripple"
          aria-hidden="true"
        >
          {this.icon}
        </span>
      </span>
    );
  }

  render() {
    const tabindex = this.disabled
      ? '-1'
      : this.readonly
        ? undefined
        : '0';

    const value = this.value;
    // Readonly renders as role="img" (a static picture of the rating). `img`
    // does NOT support the slider value/orientation/readonly attributes, so
    // emitting them trips WAI-ARIA "aria-allowed-attr". Instead the value is
    // folded into the img's accessible NAME (img ignores aria-valuetext), and
    // the slider ARIA is applied only in the interactive branch.
    const interactive = !this.readonly;
    const baseLabel = this.resolveAccessibleLabel();
    const name = interactive
      ? baseLabel
      : `${baseLabel}: ${this.resolveLabel(value)}`;

    return (
      <Host
        class={{
          'md-rating': true,
          [`md-rating--${this.size}`]: true,
          'md-rating--readonly': this.readonly,
          'md-rating--disabled': this.disabled,
          'md-rating--soft-disabled': this.softDisabled,
          'md-rating--focused': this.focused,
        }}
      >
        <div
          class="md-rating__items"
          role={interactive ? 'slider' : 'img'}
          aria-label={name}
          aria-valuemin={interactive ? 0 : undefined}
          aria-valuemax={interactive ? this.max : undefined}
          aria-valuenow={interactive ? value : undefined}
          aria-valuetext={interactive ? this.resolveLabel(value) : undefined}
          aria-orientation={interactive ? 'horizontal' : undefined}
          aria-readonly={interactive ? 'false' : undefined}
          aria-disabled={interactive && (this.disabled || this.softDisabled) ? 'true' : undefined}
          tabindex={tabindex}
          part="items"
          onKeyDown={this.handleKeyDown}
          onFocus={this.handleFocus}
          onBlur={this.handleBlur}
          onPointerLeave={this.handlePointerLeave}
        >
          {Array.from({ length: this.max }, (_, i) => this.renderItem(i))}
        </div>
        {this.showValueLabel && (
          <span class="md-rating__value-label" part="value-label" aria-hidden="true">
            {/* Hidden sizers reserve the widest label's width so the visible text
                swapping on hover doesn't reflow the row (see valueLabelVariants). */}
            {this.valueLabelVariants().map((t) => (
              <span key={t} class="md-rating__value-label-sizer" aria-hidden="true">
                {t}
              </span>
            ))}
            <span class="md-rating__value-label-text">
              {this.resolveLabel(this.displayValue)}
            </span>
          </span>
        )}
      </Host>
    );
  }
}
