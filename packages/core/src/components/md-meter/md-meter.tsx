import { Component, Host, h, Prop, Element } from '@stencil/core';

/** M3 circular size band (dp), shared with md-progress-indicator. */
const CIRCULAR_SIZE_MIN = 24;
const CIRCULAR_SIZE_MAX = 240;
const CIRCULAR_SIZE_DEFAULT = 48;

/**
 * md-meter — a read-only graphical display of a numeric value within a known
 * range (storage used, quota, password strength, battery level).
 *
 * The semantics live on the HOST: `role="meter"` with the full ARIA value
 * contract, a purely presentational track + indicator inside the shadow root
 * (all `aria-hidden`), value clamping into `[min, max]`, and Intl-driven value
 * formatting (locale-aware percent by default, any `Intl.NumberFormatOptions`
 * via `formatOptions`). Keeping the ARIA outside the shadow root is what lets
 * the visuals change shape without touching what is announced.
 *
 * Deliberately NOT a progress indicator: a meter shows a *state* ("how full"),
 * a progress indicator shows an *activity* ("how far along"). It is therefore
 * a plain track + fill — no 4dp gap, no stop dot, no indeterminate mode, no
 * completion animation. Nothing here is focusable or interactive and no events
 * are emitted.
 *
 * Two shapes, one contract: `variant="linear"` (default) is the bar;
 * `variant="circular"` is the same reading as a ring, with the value in the
 * middle and the label beneath. The ARIA lives on the host either way, so the
 * shape is presentational and swapping it changes nothing for a screen reader.
 */
@Component({
  tag: 'md-meter',
  styleUrl: 'md-meter.css',
  shadow: true,
})
export class MdMeter {
  @Element() el!: HTMLElement;

  /** Current value. Clamped into `[min, max]` for ARIA, geometry and formatting. */
  @Prop() value: number = 0;

  /** Lower bound of the range. */
  @Prop() min: number = 0;

  /** Upper bound of the range. */
  @Prop() max: number = 100;

  /**
   * Accessible name (`aria-label`) of the meter. Also the visible header label
   * when `show-label` is set. Pass already-localized text.
   */
  @Prop() label: string = '';

  /** Renders the `label` text in a header row above the track. */
  @Prop({ attribute: 'show-label' }) showLabel: boolean = false;

  /**
   * Renders the formatted value in the header row above the track,
   * end-aligned. The visible span is `aria-hidden` — screen readers announce
   * the same string via `aria-valuetext` on the host instead.
   */
  @Prop({ attribute: 'show-value' }) showValue: boolean = false;

  /**
   * Overrides the formatted value text entirely — both `aria-valuetext` and
   * the visible header value (when `show-value` is set). Use it when neither
   * the default percent format nor `formatOptions` can express the reading
   * (e.g. "3 of 10 seats").
   */
  @Prop({ attribute: 'value-text' }) valueText: string = '';

  /**
   * BCP-47 locale for `Intl.NumberFormat` output (the formatted value text).
   * Empty string = the runtime's default locale. This prop exists ONLY for
   * Intl-computed output; translatable copy (`label`) is a plain text prop.
   */
  @Prop() locale: string = '';

  /**
   * `Intl.NumberFormatOptions` for the value text (JS-only object prop — set
   * it as a property, not an attribute). When provided, the CLAMPED value is
   * formatted with it (`{ style: 'unit', unit: 'gigabyte' }`, currency, plain
   * number…). When omitted, the value's position in the range is formatted as
   * a locale-aware percentage — the default, because a meter answers "how
   * full", which a bare number cannot say without its bounds alongside it.
   */
  @Prop() formatOptions?: Intl.NumberFormatOptions;

  /**
   * Colour role applied to the fill and track. Any role name the THEME defines
   * is accepted, not just the listed ones — the meter resolves `<name>` to the
   * `--md-sys-color-<name>` / `-<name>-container` pair at runtime, so
   * `color="brand"` works as soon as a theme ships those tokens.
   *
   * The default (`primary`) keeps md-progress-indicator's neutral look:
   * primary fill on a secondary-container track. Every other role paints
   * `<role>` fill on a `<role>-container` track.
   */
  @Prop({ reflect: true }) color:
    | 'primary'
    | 'secondary'
    | 'tertiary'
    | 'error'
    | 'success'
    | 'warning'
    | 'info'
    | (string & {}) = 'primary';

  /**
   * Shape of the reading.
   *
   * - `linear` (default) — a horizontal bar, full width of its container.
   * - `circular` — a ring. `show-value` puts the value in the middle of it and
   *   `show-label` captions it underneath, instead of the bar's header row.
   *
   * The ring does NOT mirror under `dir="rtl"`: it fills clockwise in every
   * locale, matching Material's circular progress (and a clock face).
   */
  @Prop({ reflect: true }) variant: 'linear' | 'circular' = 'linear';

  /**
   * Ring diameter in dp — circular only, ignored by the bar. Clamped to
   * 24…240 like md-progress-indicator, and tapered by density through the
   * `--md-meter-size` hook.
   */
  @Prop() size: number = 48;

  /** Track thickness in dp. Density-scaled (0.5px per rung), floored at 2px. */
  @Prop() thickness: number = 4;

  /**
   * Local density rung. Drives the same `--md-sys-density-scale` signal that a
   * global `data-density` ancestor sets, so a local value simply overrides the
   * inherited one. 0 = default, -4 = ultra-compact.
   */
  @Prop({ reflect: true }) density: 0 | -1 | -2 | -3 | -4 = 0;

  // ── private getters ────────────────────────────────────────────────────────

  /** Sanitized lower bound — always a finite number. */
  private get saneMin(): number {
    return Number.isFinite(this.min) ? this.min : 0;
  }

  /**
   * Sanitized upper bound — finite, and never below `min` (an inverted range
   * collapses to an empty one so clamping and percentage stay well-defined).
   */
  private get saneMax(): number {
    const max = Number.isFinite(this.max) ? this.max : 100;
    return Math.max(max, this.saneMin);
  }

  /**
   * Value clamped into `[saneMin, saneMax]`. ARIA, geometry and formatting all
   * read this, never the raw prop, so an out-of-range reading can neither emit
   * invalid ARIA nor overflow the track.
   */
  private get clampedValue(): number {
    const v = Number.isFinite(this.value) ? this.value : this.saneMin;
    return Math.min(this.saneMax, Math.max(this.saneMin, v));
  }

  /** Position of the clamped value in the range, 0–100. Empty range → 0. */
  private get percentage(): number {
    const lo = this.saneMin;
    const hi = this.saneMax;
    if (hi === lo) return 0;
    return ((this.clampedValue - lo) / (hi - lo)) * 100;
  }

  /**
   * The one string that drives BOTH `aria-valuetext` and the visible header
   * value, so what is seen and what is announced can never disagree.
   * `valueText` overrides everything; otherwise Intl formats the clamped value
   * (`formatOptions`) or the percentage (default). Intl throws on invalid
   * option combinations, so exotic `formatOptions` degrade to the raw value
   * rather than taking the whole render down.
   */
  private get formattedValue(): string {
    if (this.valueText) return this.valueText;
    const clamped = this.clampedValue;
    try {
      if (this.formatOptions) {
        return new Intl.NumberFormat(this.locale || undefined, this.formatOptions).format(clamped);
      }
      return new Intl.NumberFormat(this.locale || undefined, { style: 'percent' }).format(
        this.percentage / 100,
      );
    } catch {
      return `${clamped}`;
    }
  }

  /**
   * Maps `color` onto the two slots the track/indicator rules are written
   * against (md-chip's colorVars pattern). Done here rather than as one CSS
   * block per role so ANY theme-defined role works, not just a fixed list.
   *
   * `primary` (the default) returns undefined so the CSS neutral defaults
   * apply — primary fill on a secondary-container track, matching
   * md-progress-indicator — instead of a primary-container track.
   *
   * The value becomes part of a custom-property NAME, so anything outside a
   * plain CSS ident is rejected outright.
   */
  private get colorVars(): Record<string, string> | undefined {
    const c = this.color;
    if (!c || c === 'primary' || !/^[a-z][a-z0-9-]*$/i.test(c)) return undefined;
    return {
      '--_c-main': `var(--md-sys-color-${c}, var(--md-sys-color-primary))`,
      '--_c-container': `var(--md-sys-color-${c}-container, var(--md-sys-color-secondary-container))`,
    };
  }

  /**
   * Inline `--_thickness` ONLY when the prop deviates from the 4dp default
   * (md-text-field's focusBorderWidth precedent) — the resting look stays pure
   * CSS. The public `--md-meter-height` hook is repeated inside the override
   * so it still wins, and the density taper + 2px floor stay applied.
   */
  private get thicknessVar(): Record<string, string> | undefined {
    const t = Number(this.thickness);
    if (!Number.isFinite(t) || t === 4) return undefined;
    return {
      '--_thickness': `var(--md-meter-height, max(2px, calc(${t}px + var(--md-sys-density-scale, 0) * 0.5px)))`,
    };
  }

  /**
   * Ring diameter, clamped into the same 24…240dp band md-progress-indicator
   * uses. This is the SVG's user-unit box; the rendered pixel size comes from
   * `--_size` on the host, so density tapers the whole ring proportionally
   * rather than desynchronising the stroke from the radius.
   */
  private get resolvedSize(): number {
    const s = Number.isFinite(this.size) && this.size > 0 ? this.size : CIRCULAR_SIZE_DEFAULT;
    return Math.min(CIRCULAR_SIZE_MAX, Math.max(CIRCULAR_SIZE_MIN, s));
  }

  /** Stroke width in the SVG's user units. Same dp number as the bar's height. */
  private get ringThickness(): number {
    const t = Number(this.thickness);
    return Number.isFinite(t) && t > 0 ? t : 4;
  }

  /** Centre-line radius: the stroke straddles it, so inset by half the width. */
  private get ringRadius(): number {
    return Math.max(0.5, (this.resolvedSize - this.ringThickness) / 2);
  }

  /**
   * Inline `--_size` only when `size` deviates from the 48dp default, matching
   * how `thicknessVar` leaves the resting look to pure CSS. The public
   * `--md-meter-size` hook is repeated inside so it still wins, and the density
   * taper + 24px floor stay applied.
   */
  private get sizeVar(): Record<string, string> | undefined {
    if (this.variant !== 'circular') return undefined;
    const s = this.resolvedSize;
    if (s === CIRCULAR_SIZE_DEFAULT) return undefined;
    return {
      '--_size': `var(--md-meter-size, max(24px, calc(${s}px + var(--md-sys-density-scale, 0) * 2px)))`,
    };
  }

  private get hostStyle(): Record<string, string> | undefined {
    const style = {
      ...(this.colorVars ?? {}),
      ...(this.thicknessVar ?? {}),
      ...(this.sizeVar ?? {}),
    };
    return Object.keys(style).length ? style : undefined;
  }

  /**
   * The ring. `pathLength={1}` normalises the circumference so the fill is the
   * fraction itself — no 2πr arithmetic that would have to be redone whenever
   * size or thickness changes. `stroke-dasharray="1 1"` + a dashoffset of
   * `1 − fraction` draws exactly that leading portion, and dashoffset is a
   * single number so it transitions cleanly (a dasharray list does not).
   */
  private renderCircular(text: string) {
    const sz = this.resolvedSize;
    const t = this.ringThickness;
    const r = this.ringRadius;
    const c = sz / 2;
    const fraction = this.percentage / 100;

    return [
      <div class="md-meter__circular" part="circular">
        <svg class="md-meter__ring" viewBox={`0 0 ${sz} ${sz}`} aria-hidden="true">
          <circle
            class="md-meter__ring-track"
            part="track"
            cx={c}
            cy={c}
            r={r}
            stroke-width={t}
            fill="none"
          />
          <circle
            class="md-meter__ring-indicator"
            part="indicator"
            cx={c}
            cy={c}
            r={r}
            stroke-width={t}
            fill="none"
            pathLength={1}
            stroke-dasharray="1 1"
            stroke-dashoffset={1 - fraction}
            stroke-linecap="round"
            // 12 o'clock start. Without it the fill would begin at 3 o'clock.
            transform={`rotate(-90 ${c} ${c})`}
            style={{ opacity: fraction > 0 ? '1' : '0' }}
          />
        </svg>
        {this.showValue && (
          <span class="md-meter__center" part="value" aria-hidden="true">
            {text}
          </span>
        )}
      </div>,
      this.showLabel && (
        <span class="md-meter__caption" part="label" aria-hidden="true">
          {this.label}
        </span>
      ),
    ];
  }

  render() {
    const circular = this.variant === 'circular';
    const withHeader = !circular && (this.showLabel || this.showValue);
    const text = this.formattedValue;
    return (
      <Host
        class={{
          'md-meter': true,
          'md-meter--with-header': withHeader,
          'md-meter--circular': circular,
        }}
        role="meter"
        aria-label={this.label || undefined}
        aria-valuemin={String(this.saneMin)}
        aria-valuemax={String(this.saneMax)}
        aria-valuenow={String(this.clampedValue)}
        aria-valuetext={text}
        style={this.hostStyle}
      >
        {circular && this.renderCircular(text)}
        {withHeader && (
          <div class="md-meter__header" aria-hidden="true">
            {this.showLabel && (
              <span class="md-meter__label" part="label">
                {this.label}
              </span>
            )}
            {this.showValue && (
              <span class="md-meter__value" part="value">
                {text}
              </span>
            )}
          </div>
        )}
        {!circular && (
          <div class="md-meter__track" part="track" aria-hidden="true">
            <div
              class="md-meter__indicator"
              part="indicator"
              style={{ '--_fill-pct': `${this.percentage}%` }}
            />
          </div>
        )}
      </Host>
    );
  }
}
