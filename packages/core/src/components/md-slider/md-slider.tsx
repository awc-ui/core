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
  AttachInternals,
} from '@stencil/core';
import type { VNode } from '@stencil/core';
import { setFormValue } from '../../utils/form';

export interface MdSliderValueDetail {
  value: number;
  valueStart?: number;
  valueEnd?: number;
}

export interface MdSliderThumbDetail {
  thumb: 'single' | 'start' | 'end';
}

export interface MdSliderDragDetail {
  thumb: 'single' | 'start' | 'end';
  value: number;
  valueStart?: number;
  valueEnd?: number;
}

/**
 * MD3 Expressive slider: standard (from edge), centered (from midpoint), or range (dual thumb).
 *
 * **Uncontrolled (default)** — the slider manages its own value. Listen to `mdChange` to observe commits.
 *
 * **Controlled** (`controlled`) — the slider never mutates `value`/`valueStart`/`valueEnd`.
 * Listen to events and set the props yourself.  During drag the slider uses internal live
 * state for smooth visuals; on commit it snaps to the prop values.
 *
 * @slot inset-icon - Custom icon inside track (standard only; use with `inset-icon`)
 */
@Component({
  tag: 'md-slider',
  styleUrl: 'md-slider.css',
  shadow: true,
  formAssociated: true,
})
export class MdSlider {
  @Element() el!: HTMLElement;

  // ── Public API ──────────────────────────────────────────

  @Prop() min: number = 0;
  @Prop() max: number = 100;
  @Prop({ mutable: true }) value: number = 50;
  @Prop() step: number = 1;
  @Prop({ reflect: true }) disabled: boolean = false;

  /**
   * Form-association handle. The slider submits its value under `name` via
   * `setFormValue`, exactly as a native `<input type="range">` does — a hidden
   * input in the shadow root would be invisible to `FormData`.
   */
  @AttachInternals() internals!: ElementInternals;

  /**
   * Form field name. Without it the slider still works, it just submits
   * nothing — same as a native input with no `name`.
   */
  @Prop({ reflect: true }) name: string = '';

  /**
   * Range mode submits TWO values, which one name cannot express. By default
   * both go under `name` (read them with `formData.getAll(name)`); set these to
   * give each end its own key. Ignored outside `range`.
   */
  @Prop({ attribute: 'name-start' }) nameStart: string = '';

  /** See `nameStart`. */
  @Prop({ attribute: 'name-end' }) nameEnd: string = '';

  /** Single-thumb layout: `standard` fills from min; `centered` fills from range midpoint to value. */
  @Prop({ reflect: true }) variant: 'standard' | 'centered' = 'standard';

  /** Dual-thumb range */
  @Prop({ reflect: true }) range: boolean = false;

  /** Stop / tick marks at each step. */
  @Prop({ reflect: true }) stops: boolean = false;

  @Prop({ mutable: true }) valueStart: number = 0;
  @Prop({ mutable: true }) valueEnd: number = 100;

  /** Expressive size (default XS per MD3 spec) */
  @Prop({ reflect: true }) size: 'xs' | 'sm' | 'md' | 'lg' | 'xl' = 'xs';

  @Prop({ reflect: true }) orientation: 'horizontal' | 'vertical' = 'horizontal';

  /**
   * Make a **vertical** slider fill its parent's block size (responsive height)
   * instead of the fixed `--md-slider-track-length`. The parent needs a definite
   * height; otherwise it falls back to the track-length floor so it never
   * collapses. (Horizontal sliders are already full-width by default.)
   */
  @Prop({ attribute: 'full-height', reflect: true }) fullHeight: boolean = false;

  /** Show value label at thumb(s) */
  @Prop({ reflect: true, attribute: 'value-indicator' }) valueIndicator: boolean = false;

  /** @deprecated Use `value-indicator` */
  @Prop({ reflect: true }) labeled: boolean = false;

  /** Standard slider only: inset icon area (use `icon` or `inset-icon` slot) */
  @Prop({ reflect: true, attribute: 'inset-icon' }) insetIcon: boolean = false;

  /** Material Symbols name when `inset-icon` and no slotted icon */
  @Prop() icon: string = '';

  @Prop({ attribute: 'aria-label' }) sliderAriaLabel: string = '';

  /**
   * Accessible label for the range-start thumb (becomes the thumb input's
   * `aria-label`; overrides `aria-label`). NB: a plain (non-`aria-`) attribute
   * name — `aria-label-start` is not a valid ARIA attribute and would just
   * pollute the host with an invalid `aria-*`.
   */
  @Prop({ attribute: 'label-start' }) ariaLabelStart: string = '';

  /** Accessible label for the range-end thumb (becomes the thumb input's `aria-label`). */
  @Prop({ attribute: 'label-end' }) ariaLabelEnd: string = '';

  /** Human-readable text alternative for the current value (single slider). Mapped to `aria-valuetext`. */
  @Prop({ attribute: 'value-text' }) valueText: string = '';

  /** Human-readable text for the range-start value. Mapped to `aria-valuetext` on the start thumb. */
  @Prop({ attribute: 'value-start-text' }) valueStartText: string = '';

  /** Human-readable text for the range-end value. Mapped to `aria-valuetext` on the end thumb. */
  @Prop({ attribute: 'value-end-text' }) valueEndText: string = '';

  /**
   * When `true`, the slider never mutates `value` / `valueStart` / `valueEnd` on user interaction.
   * Listen to `mdInput` (continuous) and `mdChange` (committed) events and write the props back yourself.
   * During a drag gesture the slider uses internal live state for smooth visuals.
   */
  @Prop({ reflect: true }) controlled: boolean = false;

  /**
   * Local density rung. Drives the same `--md-sys-density-scale` signal that a
   * global `data-density` ancestor sets, so a local value simply overrides the
   * inherited one. 0 = default, -4 = ultra-compact.
   */
  @Prop({ reflect: true }) density: 0 | -1 | -2 | -3 | -4 = 0;

  // ── Events ──────────────────────────────────────────────

  /** Fires continuously while the user drags or presses arrow keys. */
  @Event() mdInput: EventEmitter<MdSliderValueDetail>;

  /** Fires once when the user commits a value (pointer up, keyboard release, change event). */
  @Event() mdChange: EventEmitter<MdSliderValueDetail>;

  /** Fires when a slider thumb receives focus. */
  @Event() mdFocus: EventEmitter<MdSliderThumbDetail>;

  /** Fires when a slider thumb loses focus. */
  @Event() mdBlur: EventEmitter<MdSliderThumbDetail>;

  /** Fires when a drag/keyboard interaction begins. */
  @Event() mdDragStart: EventEmitter<MdSliderDragDetail>;

  /** Fires when a drag/keyboard interaction ends. */
  @Event() mdDragEnd: EventEmitter<MdSliderDragDetail>;

  // ── Internal state ──────────────────────────────────────

  @State() private keyFocusedThumb: 'single' | 'start' | 'end' | null = null;
  @State() private pressingThumb: 'single' | 'start' | 'end' | null = null;

  /** Live value during active interaction (controlled mode visual feedback). */
  @State() private _liveValue: number | null = null;
  @State() private _liveStart: number | null = null;
  @State() private _liveEnd: number | null = null;

  private rangeDragThumb: 'start' | 'end' | null = null;
  private verticalDragging = false;

  // ── Display getters (live state during drag, prop otherwise) ──

  private get displayValue(): number { return this._liveValue ?? this.value; }
  private get displayStart(): number { return this._liveStart ?? this.valueStart; }
  private get displayEnd(): number { return this._liveEnd ?? this.valueEnd; }

  // ── Value update helpers ────────────────────────────────

  private setSingle(v: number) {
    if (this.controlled) {
      this._liveValue = v;
    } else {
      this.value = v;
    }
  }

  private setStart(v: number) {
    if (this.controlled) {
      this._liveStart = v;
    } else {
      this.valueStart = v;
    }
  }

  private setEnd(v: number) {
    if (this.controlled) {
      this._liveEnd = v;
    } else {
      this.valueEnd = v;
    }
  }

  /** Commit live values to props (uncontrolled) or clear live state (controlled). */
  private commit() {
    if (this.controlled) {
      this._liveValue = null;
      this._liveStart = null;
      this._liveEnd = null;
    } else {
      if (this._liveValue !== null) { this.value = this._liveValue; this._liveValue = null; }
      if (this._liveStart !== null) { this.valueStart = this._liveStart; this._liveStart = null; }
      if (this._liveEnd !== null) { this.valueEnd = this._liveEnd; this._liveEnd = null; }
    }
  }

  // ── Lifecycle ───────────────────────────────────────────

  /** Baseline for `formResetCallback` — the values the markup was authored with. */
  private initialValue = 0;
  private initialStart = 0;
  private initialEnd = 0;

  connectedCallback() {
    this.initialValue = this.value;
    this.initialStart = this.valueStart;
    this.initialEnd = this.valueEnd;
  }

  componentDidLoad() {
    this.clampValues();
    this.syncCssVars();
    this.syncFormValue();
  }

  /**
   * Publish the current reading to the owning form.
   *
   * A range slider carries two numbers, which a single name/value pair cannot
   * express, so it submits a `FormData` instead: one entry per thumb, under
   * `name-start`/`name-end` when given and both under `name` otherwise (read
   * them back with `formData.getAll(name)`).
   *
   * With no `name` there is nothing to submit under — the same no-op a native
   * input without a name performs.
   */
  private syncFormValue() {
    if (!this.name && !this.nameStart && !this.nameEnd) {
      setFormValue(this.internals, null);
      return;
    }

    if (!this.range) {
      setFormValue(this.internals, String(this.value));
      return;
    }

    const data = new FormData();
    data.append(this.nameStart || this.name, String(this.valueStart));
    data.append(this.nameEnd || this.name, String(this.valueEnd));
    setFormValue(this.internals, data);
  }

  /** Restore the authored values when the owning form is reset. */
  formResetCallback() {
    this.value = this.initialValue;
    this.valueStart = this.initialStart;
    this.valueEnd = this.initialEnd;
    this.syncFormValue();
  }

  /**
   * Re-apply a value the browser restored (back/forward navigation, session
   * restore). Range state arrives as the FormData entries we submitted.
   */
  formStateRestoreCallback(state: string | FormData | null) {
    if (state == null) return;
    if (typeof state === 'string') {
      const n = Number(state);
      if (Number.isFinite(n)) this.value = n;
      return;
    }
    const values = [...state.values()].map(Number).filter((n) => Number.isFinite(n));
    if (values.length === 2) {
      this.valueStart = values[0];
      this.valueEnd = values[1];
    }
  }

  private clampValues() {
    this.value = Math.min(this.max, Math.max(this.min, this.value));
    if (this.range) {
      this.valueStart = Math.min(this.max, Math.max(this.min, this.valueStart));
      this.valueEnd = Math.min(this.max, Math.max(this.min, this.valueEnd));
    }
  }

  // ── CSS variable sync ───────────────────────────────────

  private pct(v: number): number {
    if (this.max === this.min) return 0;
    return ((v - this.min) / (this.max - this.min)) * 100;
  }

  private syncCssVars() {
    const el = this.el;
    const val = this.displayValue;
    const vs = this.displayStart;
    const ve = this.displayEnd;
    const p = (v: number) => `${this.pct(v)}%`;

    el.style.setProperty('--_value-pct', p(val));

    const mid = (this.min + this.max) / 2;
    const c = this.pct(mid);
    const vp = this.pct(val);
    const lo = Math.min(c, vp);
    const hi = Math.max(c, vp);
    el.style.setProperty('--_center-pct', `${c}%`);
    el.style.setProperty('--_active-start-pct', `${lo}%`);
    el.style.setProperty('--_active-width-pct', `${hi - lo}%`);

    const thumbBelow = vp <= c;
    el.style.setProperty('--_centered-start-gap', thumbBelow ? 'var(--_track-thumb-gap)' : 'var(--_center-gap)');
    el.style.setProperty('--_centered-end-gap', thumbBelow ? 'var(--_center-gap)' : 'var(--_track-thumb-gap)');

    if (this.range) {
      el.style.setProperty('--_start-pct', p(vs));
      el.style.setProperty('--_end-pct', p(ve));
    }
  }

  // ── Watchers ────────────────────────────────────────────

  @Watch('value')
  onValuePropChange() {
    this._liveValue = null;
    this.syncCssVars();
    this.syncFormValue();
  }

  @Watch('valueStart')
  onValueStartPropChange() {
    this._liveStart = null;
    this.syncCssVars();
    this.syncFormValue();
  }

  @Watch('valueEnd')
  onValueEndPropChange() {
    this._liveEnd = null;
    this.syncCssVars();
    this.syncFormValue();
  }

  @Watch('name')
  @Watch('nameStart')
  @Watch('nameEnd')
  @Watch('range')
  onFormIdentityChange() {
    this.syncFormValue();
  }

  @Watch('variant')
  @Watch('range')
  onLayoutDeps() {
    this.syncCssVars();
  }

  @Watch('min')
  @Watch('max')
  onBoundsChange() {
    this.clampValues();
    this.syncCssVars();
  }

  // ── Derived getters ─────────────────────────────────────

  private get showStops(): boolean {
    return this.stops;
  }

  private get isCentered(): boolean {
    return !this.range && this.variant === 'centered';
  }

  private get showBubble(): boolean {
    return this.valueIndicator || this.labeled;
  }

  private formatValue(v: number): string {
    if (this.step > 0) {
      const decimals = (`${this.step}`.split('.')[1] || '').length;
      return v.toFixed(decimals);
    }
    return String(Math.round(v));
  }

  private get insetArea(): boolean {
    return this.insetIcon && !this.range && this.size !== 'xs' && this.size !== 'sm';
  }

  private get insetOnActive(): boolean {
    if (!this.insetArea) return false;
    if (this.isCentered) {
      const mid = (this.min + this.max) / 2;
      return this.displayValue < mid;
    }
    return this.displayValue > this.min;
  }

  // ── Event detail builders ───────────────────────────────

  private singleDetail(): MdSliderValueDetail {
    return { value: this.displayValue };
  }

  private rangeDetail(): MdSliderValueDetail {
    return {
      value: this.rangeDragThumb === 'start' ? this.displayStart : this.displayEnd,
      valueStart: this.displayStart,
      valueEnd: this.displayEnd,
    };
  }

  // ── Native input handlers ───────────────────────────────

  private handleInput = (e: Event, isStart?: boolean) => {
    const input = e.target as HTMLInputElement;
    const val = Number(input.value);
    if (this.range) {
      if (isStart) {
        if (val > this.displayEnd) {
          this.setEnd(val);
          this.setStart(val);
        } else {
          this.setStart(val);
        }
      } else {
        if (val < this.displayStart) {
          this.setStart(val);
          this.setEnd(val);
        } else {
          this.setEnd(val);
        }
      }
      this.syncCssVars();
      this.mdInput.emit(this.rangeDetail());
    } else {
      this.setSingle(val);
      this.syncCssVars();
      this.mdInput.emit(this.singleDetail());
    }
  };

  private handleChange = (e: Event, isStart?: boolean) => {
    const input = e.target as HTMLInputElement;
    const val = Number(input.value);
    if (this.range) {
      if (isStart) {
        if (val > this.displayEnd) {
          this.setEnd(val);
          this.setStart(val);
        } else {
          this.setStart(val);
        }
      } else {
        if (val < this.displayStart) {
          this.setStart(val);
          this.setEnd(val);
        } else {
          this.setEnd(val);
        }
      }
      this.syncCssVars();
      this.mdChange.emit(this.rangeDetail());
    } else {
      this.setSingle(val);
      this.syncCssVars();
      this.mdChange.emit(this.singleDetail());
    }
    this.commit();
  };

  // ── Pointer helpers ─────────────────────────────────────

  private snapToStep(raw: number): number {
    const s = this.step;
    if (s <= 0) return Math.min(this.max, Math.max(this.min, raw));
    const q = Math.round((raw - this.min) / s);
    return Math.min(this.max, Math.max(this.min, this.min + q * s));
  }

  private pointerToValue(clientX: number, clientY: number): number {
    const rail = this.el.shadowRoot?.querySelector('.md-slider__rail') as HTMLElement | null;
    if (!rail) return this.min;
    const rect = rail.getBoundingClientRect();
    const vertical = this.orientation === 'vertical';
    let ratio: number;
    if (vertical) {
      ratio = rect.height > 0 ? (rect.bottom - clientY) / rect.height : 0;
    } else {
      const rtl = getComputedStyle(this.el).direction === 'rtl';
      ratio =
        rect.width > 0
          ? rtl
            ? (rect.right - clientX) / rect.width
            : (clientX - rect.left) / rect.width
          : 0;
    }
    ratio = Math.min(1, Math.max(0, ratio));
    const raw = this.min + ratio * (this.max - this.min);
    return this.snapToStep(raw);
  }

  // ── Range pointer interaction ───────────────────────────

  private applyRangePointerValue(v: number) {
    if (this.rangeDragThumb === 'start') {
      if (v > this.displayEnd) {
        this.rangeDragThumb = 'end';
        this.pressingThumb = 'end';
        this.setEnd(v);
      } else {
        this.setStart(v);
      }
    } else if (this.rangeDragThumb === 'end') {
      if (v < this.displayStart) {
        this.rangeDragThumb = 'start';
        this.pressingThumb = 'start';
        this.setStart(v);
      } else {
        this.setEnd(v);
      }
    }
    this.syncCssVars();
    this.mdInput.emit(this.rangeDetail());
  }

  private onRangeRailPointerDown = (e: PointerEvent) => {
    if (!this.range || this.disabled) return;
    const rail = e.currentTarget as HTMLElement;
    const v = this.pointerToValue(e.clientX, e.clientY);
    const dStart = Math.abs(v - this.displayStart);
    const dEnd = Math.abs(v - this.displayEnd);
    if (dStart === dEnd) {
      this.rangeDragThumb = v >= this.displayEnd ? 'end' : 'start';
    } else {
      this.rangeDragThumb = dStart < dEnd ? 'start' : 'end';
    }
    this.pressingThumb = this.rangeDragThumb;
    this.mdDragStart.emit({
      thumb: this.rangeDragThumb,
      value: this.rangeDragThumb === 'start' ? this.displayStart : this.displayEnd,
      valueStart: this.displayStart,
      valueEnd: this.displayEnd,
    });
    this.applyRangePointerValue(v);
    try { rail.setPointerCapture(e.pointerId); } catch { /* noop */ }
    e.preventDefault();
  };

  private onRangeRailPointerMove = (e: PointerEvent) => {
    if (!this.range || this.disabled || !this.rangeDragThumb) return;
    this.applyRangePointerValue(this.pointerToValue(e.clientX, e.clientY));
    e.preventDefault();
  };

  private endRangePointerGesture(e: PointerEvent | null) {
    if (!this.rangeDragThumb) return;
    const thumb = this.rangeDragThumb;
    const detail = this.rangeDetail();
    this.rangeDragThumb = null;
    this.pressingThumb = null;
    if (e) {
      try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* noop */ }
    }
    this.mdChange.emit(detail);
    this.mdDragEnd.emit({ thumb, ...detail });
    this.commit();
    this.syncCssVars();
  }

  private onRangeRailPointerUp = (e: PointerEvent) => {
    if (!this.range) return;
    this.endRangePointerGesture(e);
  };

  private onRangeRailLostPointerCapture = () => {
    if (!this.rangeDragThumb) return;
    const thumb = this.rangeDragThumb;
    const detail = this.rangeDetail();
    this.rangeDragThumb = null;
    this.pressingThumb = null;
    this.mdChange.emit(detail);
    this.mdDragEnd.emit({ thumb, ...detail });
    this.commit();
    this.syncCssVars();
  };

  // ── Vertical pointer interaction ────────────────────────

  private onVerticalRailPointerDown = (e: PointerEvent) => {
    if (this.range || this.disabled || this.orientation !== 'vertical') return;
    const rail = e.currentTarget as HTMLElement;
    this.verticalDragging = true;
    this.pressingThumb = 'single';
    const v = this.pointerToValue(e.clientX, e.clientY);
    this.setSingle(v);
    this.syncCssVars();
    this.mdDragStart.emit({ thumb: 'single', value: this.displayValue });
    this.mdInput.emit(this.singleDetail());
    try { rail.setPointerCapture(e.pointerId); } catch { /* noop */ }
    e.preventDefault();
  };

  private onVerticalRailPointerMove = (e: PointerEvent) => {
    if (!this.verticalDragging) return;
    const v = this.pointerToValue(e.clientX, e.clientY);
    this.setSingle(v);
    this.syncCssVars();
    this.mdInput.emit(this.singleDetail());
    e.preventDefault();
  };

  private onVerticalRailPointerUp = (e: PointerEvent) => {
    if (!this.verticalDragging) return;
    this.verticalDragging = false;
    this.pressingThumb = null;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* noop */ }
    const detail = this.singleDetail();
    this.mdChange.emit(detail);
    this.mdDragEnd.emit({ thumb: 'single', ...detail });
    this.commit();
    this.syncCssVars();
  };

  private onVerticalRailLostPointerCapture = () => {
    if (!this.verticalDragging) return;
    this.verticalDragging = false;
    this.pressingThumb = null;
    const detail = this.singleDetail();
    this.mdChange.emit(detail);
    this.mdDragEnd.emit({ thumb: 'single', ...detail });
    this.commit();
    this.syncCssVars();
  };

  // ── Tick marks ──────────────────────────────────────────

  private getTickMarks() {
    if (!this.showStops || this.step <= 0) return null;
    const span = this.max - this.min;
    const count = Math.floor(span / this.step) + 1;
    if (count < 2) return null;
    const isVertical = this.orientation === 'vertical';
    const eps = this.step * 0.001;
    const near = (a: number, b: number) => Math.abs(a - b) < eps;
    const pos = (i: number) => {
      const frac = i / (count - 1);
      return `calc(var(--_tick-pad) + (100% - 2 * var(--_tick-pad)) * ${frac})`;
    };
    const mid = (this.min + this.max) / 2;
    const val = this.displayValue;
    const vs = this.displayStart;
    const ve = this.displayEnd;
    const isOnActive = (v: number): boolean => {
      if (this.range) return v >= vs && v <= ve;
      if (this.isCentered) {
        const lo = Math.min(mid, val);
        const hi = Math.max(mid, val);
        return v >= lo && v <= hi;
      }
      return v <= val;
    };

    return Array.from({ length: count }, (_, i) => {
      const tickVal = this.min + i * this.step;
      const hidden = this.range
        ? near(tickVal, vs) || near(tickVal, ve)
        : near(tickVal, val);
      const onFilled = isOnActive(tickVal);
      const cls = {
        'md-slider__tick': true,
        'md-slider__tick--on-active': hidden,
        'md-slider__tick--on-filled': onFilled && !hidden,
        'md-slider__tick--on-inactive': !onFilled && !hidden,
      };
      return isVertical ? (
        <span class={cls} style={{ bottom: pos(i) }} />
      ) : (
        <span class={cls} style={{ insetInlineStart: pos(i) }} />
      );
    });
  }

  // ── Focus / keyboard handlers ───────────────────────────

  private onInputFocus = (which: 'single' | 'start' | 'end') => (e: FocusEvent) => {
    const input = e.target as HTMLElement;
    try {
      if (input.matches(':focus-visible')) {
        this.keyFocusedThumb = which;
      }
    } catch {
      this.keyFocusedThumb = which;
    }
    this.mdFocus.emit({ thumb: which });
  };

  private onInputBlur = (which: 'single' | 'start' | 'end') => () => {
    this.keyFocusedThumb = null;
    this.mdBlur.emit({ thumb: which });
  };

  private static SLIDER_KEYS = new Set([
    'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
    'Home', 'End', 'PageUp', 'PageDown',
  ]);

  private onInputKeyDown = (which: 'single' | 'start' | 'end') => (e: KeyboardEvent) => {
    if (!MdSlider.SLIDER_KEYS.has(e.key)) return;
    if (!this.pressingThumb) {
      this.pressingThumb = which;
      const detail: MdSliderDragDetail = this.range
        ? { thumb: which, value: which === 'start' ? this.displayStart : this.displayEnd, valueStart: this.displayStart, valueEnd: this.displayEnd }
        : { thumb: 'single', value: this.displayValue };
      this.mdDragStart.emit(detail);
    }
  };

  private onInputKeyUp = (which: 'single' | 'start' | 'end') => (e: KeyboardEvent) => {
    if (!MdSlider.SLIDER_KEYS.has(e.key)) return;
    this.pressingThumb = null;
    const detail: MdSliderDragDetail = this.range
      ? { thumb: which, value: which === 'start' ? this.displayStart : this.displayEnd, valueStart: this.displayStart, valueEnd: this.displayEnd }
      : { thumb: 'single', value: this.displayValue };
    this.mdDragEnd.emit(detail);
  };

  private onInputPointerDown = (which: 'single' | 'start' | 'end') => () => {
    this.pressingThumb = which;
    const detail: MdSliderDragDetail = this.range
      ? { thumb: which, value: which === 'start' ? this.displayStart : this.displayEnd, valueStart: this.displayStart, valueEnd: this.displayEnd }
      : { thumb: 'single', value: this.displayValue };
    this.mdDragStart.emit(detail);
  };

  private onInputPointerUp = (which: 'single' | 'start' | 'end') => () => {
    this.pressingThumb = null;
    const detail: MdSliderDragDetail = this.range
      ? { thumb: which, value: which === 'start' ? this.displayStart : this.displayEnd, valueStart: this.displayStart, valueEnd: this.displayEnd }
      : { thumb: 'single', value: this.displayValue };
    this.mdDragEnd.emit(detail);
  };

  // ── Helpers ─────────────────────────────────────────────

  private inputAriaLabel(single: boolean, which?: 'start' | 'end'): string {
    if (single) return this.sliderAriaLabel || 'slider';
    if (which === 'start') return this.ariaLabelStart || this.sliderAriaLabel || 'range start';
    return this.ariaLabelEnd || this.sliderAriaLabel || 'range end';
  }

  private wrapInputShell(vertical: boolean, node: VNode) {
    return vertical ? <div class="md-slider__input-shell">{node}</div> : node;
  }

  // ── Render ──────────────────────────────────────────────

  render() {
    const vertical = this.orientation === 'vertical';
    const bubble = this.showBubble;
    const insetArea = this.insetArea;
    const orientVertical = vertical ? { orient: 'vertical' as const } : {};

    const val = this.displayValue;
    const vs = this.displayStart;
    const ve = this.displayEnd;

    return (
      <Host
        class={{
          'md-slider': true,
          [`md-slider--size-${this.size}`]: true,
          'md-slider--vertical': vertical,
          'md-slider--horizontal': !vertical,
          'md-slider--centered': this.isCentered,
          'md-slider--range': this.range,
          'md-slider--stops': this.showStops,
          'md-slider--inset': insetArea,
          'md-slider--disabled': this.disabled,
        }}
        aria-orientation={vertical ? 'vertical' : 'horizontal'}
      >
        <div class="md-slider__surface" part="surface">
          <div
            class="md-slider__rail"
            onPointerDown={this.range ? this.onRangeRailPointerDown : vertical ? this.onVerticalRailPointerDown : undefined}
            onPointerMove={this.range ? this.onRangeRailPointerMove : vertical ? this.onVerticalRailPointerMove : undefined}
            onPointerUp={this.range ? this.onRangeRailPointerUp : vertical ? this.onVerticalRailPointerUp : undefined}
            onPointerCancel={this.range ? this.onRangeRailPointerUp : vertical ? this.onVerticalRailPointerUp : undefined}
            onLostPointerCapture={this.range ? this.onRangeRailLostPointerCapture : vertical ? this.onVerticalRailLostPointerCapture : undefined}
          >
            <div class="md-slider__track" part="track">
              <div class="md-slider__track-inactive" part="track-inactive"></div>
              <div class="md-slider__track-active" part="track-active"></div>
              {this.showStops && <div class="md-slider__ticks">{this.getTickMarks()}</div>}
              {insetArea && (
                <span
                  class={{ 'md-slider__inset': true, 'md-slider__inset--on-active': this.insetOnActive }}
                  part="inset"
                  aria-hidden="true"
                >
                  <slot name="inset-icon">
                    {this.icon ? (
                      <span class="md-slider__inset-font material-symbols-outlined">{this.icon}</span>
                    ) : null}
                  </slot>
                </span>
              )}
            </div>

            {this.range
            ? [
                <div
                  class={{
                    'md-slider__thumb': true,
                    'md-slider__thumb--start': true,
                    'md-slider__thumb--focus-visible': this.keyFocusedThumb === 'start',
                    'md-slider__thumb--pressing': this.pressingThumb === 'start',
                  }}
                  style={{
                    ...(!vertical ? { insetInlineStart: 'var(--_start-pct)' } : {}),
                  }}
                >
                  <span class="md-slider__thumb-knob" part="thumb-knob"></span>
                  <span class="md-slider__state-layer" part="state-layer" aria-hidden="true"></span>
                  {bubble && (
                    <span class="md-slider__value-indicator" part="value-indicator">
                      {this.formatValue(vs)}
                    </span>
                  )}
                </div>,
                <div
                  class={{
                    'md-slider__thumb': true,
                    'md-slider__thumb--end': true,
                    'md-slider__thumb--focus-visible': this.keyFocusedThumb === 'end',
                    'md-slider__thumb--pressing': this.pressingThumb === 'end',
                  }}
                  style={{
                    ...(!vertical ? { insetInlineStart: 'var(--_end-pct)' } : {}),
                  }}
                >
                  <span class="md-slider__thumb-knob" part="thumb-knob"></span>
                  <span class="md-slider__state-layer" part="state-layer" aria-hidden="true"></span>
                  {bubble && (
                    <span class="md-slider__value-indicator" part="value-indicator">
                      {this.formatValue(ve)}
                    </span>
                  )}
                </div>,
                this.wrapInputShell(
                  vertical,
                  <input
                    type="range"
                    class="md-slider__input md-slider__input--start"
                    min={this.min}
                    max={this.max}
                    step={this.step}
                    value={vs}
                    disabled={this.disabled}
                    aria-label={this.inputAriaLabel(false, 'start')}
                    aria-valuemin={this.min}
                    aria-valuemax={this.max}
                    aria-valuenow={vs}
                    aria-valuetext={this.valueStartText || undefined}
                    aria-orientation={vertical ? 'vertical' : 'horizontal'}
                    {...orientVertical}
                    onInput={(e) => this.handleInput(e, true)}
                    onChange={(e) => this.handleChange(e, true)}
                    onFocus={this.onInputFocus('start')}
                    onBlur={this.onInputBlur('start')}
                    onKeyDown={this.onInputKeyDown('start')}
                    onKeyUp={this.onInputKeyUp('start')}
                    onPointerDown={this.onInputPointerDown('start')}
                    onPointerUp={this.onInputPointerUp('start')}
                  />,
                ),
                this.wrapInputShell(
                  vertical,
                  <input
                    type="range"
                    class="md-slider__input md-slider__input--end"
                    min={this.min}
                    max={this.max}
                    step={this.step}
                    value={ve}
                    disabled={this.disabled}
                    aria-label={this.inputAriaLabel(false, 'end')}
                    aria-valuemin={this.min}
                    aria-valuemax={this.max}
                    aria-valuenow={ve}
                    aria-valuetext={this.valueEndText || undefined}
                    aria-orientation={vertical ? 'vertical' : 'horizontal'}
                    {...orientVertical}
                    onInput={(e) => this.handleInput(e, false)}
                    onChange={(e) => this.handleChange(e, false)}
                    onFocus={this.onInputFocus('end')}
                    onBlur={this.onInputBlur('end')}
                    onKeyDown={this.onInputKeyDown('end')}
                    onKeyUp={this.onInputKeyUp('end')}
                    onPointerDown={this.onInputPointerDown('end')}
                    onPointerUp={this.onInputPointerUp('end')}
                  />,
                ),
              ]
            : [
                <div
                  class={{
                    'md-slider__thumb': true,
                    'md-slider__thumb--focus-visible': this.keyFocusedThumb === 'single',
                    'md-slider__thumb--pressing': this.pressingThumb === 'single',
                  }}
                  style={{
                    ...(!vertical ? { insetInlineStart: 'var(--_value-pct)' } : {}),
                  }}
                >
                  <span class="md-slider__thumb-knob" part="thumb-knob"></span>
                  <span class="md-slider__state-layer" part="state-layer" aria-hidden="true"></span>
                  {bubble && (
                    <span class="md-slider__value-indicator" part="value-indicator">
                      {this.formatValue(val)}
                    </span>
                  )}
                </div>,
                this.wrapInputShell(
                  vertical,
                  <input
                    type="range"
                    class="md-slider__input"
                    min={this.min}
                    max={this.max}
                    step={this.step}
                    value={val}
                    disabled={this.disabled}
                    aria-label={this.inputAriaLabel(true)}
                    aria-valuemin={this.min}
                    aria-valuemax={this.max}
                    aria-valuenow={val}
                    aria-valuetext={this.valueText || undefined}
                    aria-orientation={vertical ? 'vertical' : 'horizontal'}
                    {...orientVertical}
                    onInput={(e) => this.handleInput(e)}
                    onChange={(e) => this.handleChange(e)}
                    onFocus={this.onInputFocus('single')}
                    onBlur={this.onInputBlur('single')}
                    onKeyDown={this.onInputKeyDown('single')}
                    onKeyUp={this.onInputKeyUp('single')}
                    onPointerDown={this.onInputPointerDown('single')}
                    onPointerUp={this.onInputPointerUp('single')}
                  />,
                ),
              ]}
          </div>
        </div>
      </Host>
    );
  }
}
