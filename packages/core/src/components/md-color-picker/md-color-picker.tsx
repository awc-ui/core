import {
  Component,
  Host,
  h,
  Prop,
  State,
  Element,
  Event,
  EventEmitter,
  Watch,
  Method,
  Listen,
} from '@stencil/core';
import {
  Hsva,
  hsvaToHex,
  hsvaToHsl,
  hsvaToRgba,
  hslToRgb,
  parseColor,
  formatColor,
} from './color-utils';

export type ColorFormat = 'hex' | 'rgb' | 'hsl';
export type ColorPickerVariant = 'inline' | 'popover';

@Component({
  tag: 'md-color-picker',
  styleUrl: 'md-color-picker.css',
  shadow: true,
})
export class MdColorPicker {
  @Element() el!: HTMLElement;

  /**
   * Layout variant.
   * - `inline` (default) — picker UI is always visible.
   * - `popover` — opens the picker in a floating panel anchored to itself,
   *   behind a trigger YOU slot into `trigger`. There is no built-in trigger.
   */
  @Prop({ reflect: true }) variant: ColorPickerVariant = 'inline';

  /**
   * Current value. Accepts any 3/4/6/8-digit hex, `rgb()`, `rgba()`, or
   * the formats emitted by this component. Two-way bindable.
   */
  @Prop({ mutable: true, reflect: true }) value: string = '#6750A4';

  /** Output format for `value` and `mdChange` events. */
  @Prop({ reflect: true }) format: ColorFormat = 'hex';

  /** Show the alpha slider + alpha hex field. */
  @Prop({ reflect: true }) alpha: boolean = false;

  /** Show the hex input field below the sliders. */
  @Prop({ attribute: 'show-hex' }) showHex: boolean = true;

  /** Show the RGB/HSL numeric inputs. */
  @Prop({ attribute: 'show-inputs' }) showInputs: boolean = true;

  /** Disable the entire control. */
  @Prop({ reflect: true }) disabled: boolean = false;

  /**
   * Swatch presets. When non-empty, a small palette appears below the sliders
   * for one-tap colour selection.
   *
   * Takes either form, so it behaves like every other list-valued prop in the
   * library rather than being the one exception:
   *   - attribute — `presets="#000000,#FFFFFF,#FF5722"` (comma-separated)
   *   - property  — `el.presets = ['#000000', '#FFFFFF', '#FF5722']`
   */
  @Prop() presets: string | string[] = '';

  /**
   * Accessible label for the whole picker. Defaults to "Color picker".
   */
  @Prop({ attribute: 'aria-label' }) ariaLabelProp: string = 'Color picker';

  /** Whether the popover is open. Only meaningful when variant=`popover`. */
  @Prop({ mutable: true, reflect: true }) open: boolean = false;

  /**
   * When true and `variant="popover"`, clicking outside the component
   * closes the open panel. Defaults to `false` so existing popovers keep
   * their current behaviour until opted in.
   */
  @Prop({ attribute: 'dismiss-on-outside-click' }) dismissOnOutsideClick: boolean = false;

  /**
   * Local density rung. Drives the same `--md-sys-density-scale` signal that a
   * global `data-density` ancestor sets, so a local value simply overrides the
   * inherited one. 0 = default, -4 = ultra-compact.
   */
  @Prop({ reflect: true }) density: 0 | -1 | -2 | -3 | -4 = 0;

  /** Emitted on every change while the user drags / types. */
  @Event() mdInput: EventEmitter<{ value: string }>;

  /**
   * Emitted when the user commits a value (release pointer, blur input,
   * Enter, or click a preset).
   */
  @Event() mdChange: EventEmitter<{ value: string }>;

  /** Emitted when the popover opens or closes. */
  @Event() mdOpenChange: EventEmitter<{ open: boolean }>;

  @State() private hsva: Hsva = { h: 268, s: 53, v: 64, a: 1 };
  @State() private hexInput: string = '';
  @State() private hexInvalid: boolean = false;
  /** Whether the consumer supplied a trigger. `variant="popover"` is inert
   *  without one, so its absence is a dev-time warning rather than a silent
   *  empty host. */
  @State() private hasSlottedTrigger: boolean = false;

  private satRect?: DOMRect;
  private hueRect?: DOMRect;
  private alphaRect?: DOMRect;
  private pointerDragKind: 'sat' | 'hue' | 'alpha' | null = null;
  private outsideClickHandler?: (e: MouseEvent) => void;

  /** Instance-unique prefix so each channel <label> can be associated with
   *  its <input> via for/id without colliding across multiple pickers. */
  private uid = `md-color-picker-${Math.random().toString(36).slice(2, 7)}`;

  componentWillLoad() {
    this.applyValue(this.value, /* emit */ false);
    this.computeSlottedTrigger();
  }

  componentDidLoad() {
    this.syncOutsideClickListener();
    this.wireSlottedTrigger();
    // A consumer may swap the trigger at runtime (a different md-button, or
    // rendering it conditionally), so re-read on slotchange rather than once.
    const slot = this.el.shadowRoot?.querySelector('slot[name="trigger"]') as HTMLSlotElement | null;
    slot?.addEventListener('slotchange', () => {
      this.computeSlottedTrigger();
      this.wireSlottedTrigger();
    });
  }

  private computeSlottedTrigger() {
    this.hasSlottedTrigger = this.el.querySelector('[slot="trigger"]') !== null;
    if (
      !this.hasSlottedTrigger &&
      this.variant === 'popover' &&
      typeof console !== 'undefined'
    ) {
      console.warn(
        '[md-color-picker] variant="popover" needs a trigger: slot one into ' +
          '`trigger` (e.g. <md-button slot="trigger">…</md-button>). Without it ' +
          'there is nothing to open the panel.',
      );
    }
  }

  /** The slotted element is the consumer's, so we do not re-render it — we
   *  attach the behaviour it needs: open on activation, and the ARIA that
   *  describes the popup relationship. Both are idempotent. */
  private wireSlottedTrigger() {
    const trigger = this.el.querySelector('[slot="trigger"]') as HTMLElement | null;
    if (!trigger || trigger === this.wiredTrigger) {
      this.syncSlottedTriggerAria();
      return;
    }
    this.wiredTrigger?.removeEventListener('click', this.toggleOpen);
    trigger.addEventListener('click', this.toggleOpen);
    this.wiredTrigger = trigger;
    this.syncSlottedTriggerAria();
  }

  private syncSlottedTriggerAria() {
    const t = this.wiredTrigger;
    if (!t) return;
    t.setAttribute('aria-haspopup', 'dialog');
    t.setAttribute('aria-expanded', String(this.open));
  }

  private wiredTrigger: HTMLElement | null = null;

  @Watch('value')
  onValueChange(newVal: string) {
    if (newVal === this.lastEmitted) return;
    this.applyValue(newVal, false);
  }

  private lastEmitted: string = '';

  /** Whether the host (or an ancestor) is in RTL layout. */
  private isRtl(): boolean {
    return (
      typeof getComputedStyle === 'function' &&
      getComputedStyle(this.el).direction === 'rtl'
    );
  }

  /** Normalized horizontal pointer ratio (0 = inline-start, 1 = inline-end). */
  private horizontalRatio(clientX: number, rect: DOMRect): number {
    const w = rect.width;
    if (w <= 0) return 0;
    return this.isRtl()
      ? (rect.right - clientX) / w
      : (clientX - rect.left) / w;
  }

  /** Valid `linear-gradient` side keyword matching inline flow (not `inline-end`). */
  private horizontalGradientTo(): 'right' | 'left' {
    return this.isRtl() ? 'left' : 'right';
  }

  private applyValue(input: string, emit: boolean) {
    const parsed = parseColor(input);
    if (parsed) {
      this.hsva = parsed;
      this.hexInput = hsvaToHex(parsed, this.alpha && parsed.a < 1);
      this.hexInvalid = false;
      if (emit) this.emit();
    } else {
      // Keep current hsva but mark hex input as invalid.
      this.hexInvalid = true;
    }
  }

  private emit(commit: boolean = false) {
    const out = formatColor(this.hsva, this.format);
    if (out !== this.value) {
      // Set lastEmitted BEFORE this.value so the @Watch('value')
      // sees a matching sentinel and skips applyValue (which would
      // otherwise re-parse our own output and waste work).
      this.lastEmitted = out;
      this.value = out;
      this.mdInput.emit({ value: out });
      if (commit) this.mdChange.emit({ value: out });
    } else if (commit) {
      this.mdChange.emit({ value: out });
    }
  }

  // ──────────────────────────────────────────────────────────────────
  // Saturation / Value picker
  // ──────────────────────────────────────────────────────────────────

  private onSatPointerDown = (e: PointerEvent) => {
    if (this.disabled) return;
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    this.satRect = target.getBoundingClientRect();
    this.pointerDragKind = 'sat';
    this.updateSatFromPoint(e.clientX, e.clientY);
  };

  private onSatPointerMove = (e: PointerEvent) => {
    if (this.pointerDragKind !== 'sat' || !this.satRect) return;
    this.updateSatFromPoint(e.clientX, e.clientY);
  };

  private onSatPointerUp = (e: PointerEvent) => {
    if (this.pointerDragKind !== 'sat') return;
    const target = e.currentTarget as HTMLElement;
    target.releasePointerCapture?.(e.pointerId);
    this.pointerDragKind = null;
    this.emit(true);
  };

  private updateSatFromPoint(clientX: number, clientY: number) {
    if (!this.satRect) return;
    const xRatio = this.horizontalRatio(clientX, this.satRect);
    const y = clientY - this.satRect.top;
    const s = Math.max(0, Math.min(100, xRatio * 100));
    const v = Math.max(0, Math.min(100, 100 - (y / this.satRect.height) * 100));
    this.hsva = { ...this.hsva, s, v };
    this.hexInput = hsvaToHex(this.hsva, this.alpha && this.hsva.a < 1);
    this.hexInvalid = false;
    this.emit(false);
  }

  private onSatKeyDown = (e: KeyboardEvent) => {
    if (this.disabled) return;
    const step = e.shiftKey ? 10 : 1;
    const rtl = this.isRtl();
    let { s, v } = this.hsva;
    let handled = true;
    switch (e.key) {
      case 'ArrowLeft':  s += rtl ? step : -step; break;
      case 'ArrowRight': s += rtl ? -step : step; break;
      case 'ArrowDown':  v -= step; break;
      case 'ArrowUp':    v += step; break;
      case 'Home':       s = 0; break;
      case 'End':        s = 100; break;
      case 'PageDown':   v = 0; break;
      case 'PageUp':     v = 100; break;
      default: handled = false;
    }
    if (!handled) return;
    e.preventDefault();
    this.hsva = {
      ...this.hsva,
      s: Math.max(0, Math.min(100, s)),
      v: Math.max(0, Math.min(100, v)),
    };
    this.hexInput = hsvaToHex(this.hsva, this.alpha && this.hsva.a < 1);
    this.hexInvalid = false;
    this.emit(true);
  };

  // ──────────────────────────────────────────────────────────────────
  // Hue slider
  // ──────────────────────────────────────────────────────────────────

  private onHuePointerDown = (e: PointerEvent) => {
    if (this.disabled) return;
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    this.hueRect = target.getBoundingClientRect();
    this.pointerDragKind = 'hue';
    this.updateHueFromPoint(e.clientX);
  };

  private onHuePointerMove = (e: PointerEvent) => {
    if (this.pointerDragKind !== 'hue' || !this.hueRect) return;
    this.updateHueFromPoint(e.clientX);
  };

  private onHuePointerUp = (e: PointerEvent) => {
    if (this.pointerDragKind !== 'hue') return;
    const target = e.currentTarget as HTMLElement;
    target.releasePointerCapture?.(e.pointerId);
    this.pointerDragKind = null;
    this.emit(true);
  };

  private updateHueFromPoint(clientX: number) {
    if (!this.hueRect) return;
    const ratio = Math.max(0, Math.min(1, this.horizontalRatio(clientX, this.hueRect)));
    const h = ratio * 360;
    this.hsva = { ...this.hsva, h };
    this.hexInput = hsvaToHex(this.hsva, this.alpha && this.hsva.a < 1);
    this.hexInvalid = false;
    this.emit(false);
  }

  private onHueKeyDown = (e: KeyboardEvent) => {
    if (this.disabled) return;
    const step = e.shiftKey ? 15 : 1;
    const rtl = this.isRtl();
    let { h } = this.hsva;
    let handled = true;
    switch (e.key) {
      case 'ArrowLeft':  h += rtl ? step : -step; break;
      case 'ArrowRight': h += rtl ? -step : step; break;
      case 'Home':       h = 0; break;
      case 'End':        h = 360; break;
      default: handled = false;
    }
    if (!handled) return;
    e.preventDefault();
    h = ((h % 360) + 360) % 360;
    this.hsva = { ...this.hsva, h };
    this.hexInput = hsvaToHex(this.hsva, this.alpha && this.hsva.a < 1);
    this.hexInvalid = false;
    this.emit(true);
  };

  // ──────────────────────────────────────────────────────────────────
  // Alpha slider
  // ──────────────────────────────────────────────────────────────────

  private onAlphaPointerDown = (e: PointerEvent) => {
    if (this.disabled) return;
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    this.alphaRect = target.getBoundingClientRect();
    this.pointerDragKind = 'alpha';
    this.updateAlphaFromPoint(e.clientX);
  };

  private onAlphaPointerMove = (e: PointerEvent) => {
    if (this.pointerDragKind !== 'alpha' || !this.alphaRect) return;
    this.updateAlphaFromPoint(e.clientX);
  };

  private onAlphaPointerUp = (e: PointerEvent) => {
    if (this.pointerDragKind !== 'alpha') return;
    const target = e.currentTarget as HTMLElement;
    target.releasePointerCapture?.(e.pointerId);
    this.pointerDragKind = null;
    this.emit(true);
  };

  private updateAlphaFromPoint(clientX: number) {
    if (!this.alphaRect) return;
    const ratio = Math.max(0, Math.min(1, this.horizontalRatio(clientX, this.alphaRect)));
    this.hsva = { ...this.hsva, a: ratio };
    this.hexInput = hsvaToHex(this.hsva, true);
    this.hexInvalid = false;
    this.emit(false);
  }

  private onAlphaKeyDown = (e: KeyboardEvent) => {
    if (this.disabled) return;
    const step = e.shiftKey ? 0.1 : 0.01;
    const rtl = this.isRtl();
    let { a } = this.hsva;
    let handled = true;
    switch (e.key) {
      case 'ArrowLeft':  a += rtl ? step : -step; break;
      case 'ArrowRight': a += rtl ? -step : step; break;
      case 'Home':       a = 0; break;
      case 'End':        a = 1; break;
      default: handled = false;
    }
    if (!handled) return;
    e.preventDefault();
    a = Math.max(0, Math.min(1, a));
    this.hsva = { ...this.hsva, a };
    this.hexInput = hsvaToHex(this.hsva, true);
    this.hexInvalid = false;
    this.emit(true);
  };

  // ──────────────────────────────────────────────────────────────────
  // Inputs
  // ──────────────────────────────────────────────────────────────────

  private onHexInput = (e: Event) => {
    const v = (e.target as HTMLInputElement).value;
    this.hexInput = v;
    const parsed = parseColor(v.startsWith('#') ? v : `#${v}`);
    if (parsed) {
      this.hsva = parsed;
      this.hexInvalid = false;
      this.emit(false);
    } else {
      this.hexInvalid = true;
    }
  };

  private onHexBlur = () => {
    // If invalid, snap back to the current colour's hex.
    if (this.hexInvalid) {
      this.hexInput = hsvaToHex(this.hsva, this.alpha && this.hsva.a < 1);
      this.hexInvalid = false;
    }
    this.emit(true);
  };

  private rgbaFromChannels(r: number, g: number, b: number) {
    const hex = `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
    const parsed = parseColor(hex);
    if (parsed) {
      this.hsva = { ...parsed, a: this.hsva.a };
      this.hexInput = hsvaToHex(this.hsva, this.alpha && this.hsva.a < 1);
      this.hexInvalid = false;
      this.emit(true);
    }
  }

  private onRgbChange = (channel: 'r' | 'g' | 'b', e: Event) => {
    const raw = (e.target as HTMLInputElement).value;
    const num = Math.max(0, Math.min(255, parseInt(raw, 10) || 0));
    const rgba = hsvaToRgba(this.hsva);
    this.rgbaFromChannels(
      channel === 'r' ? num : rgba.r,
      channel === 'g' ? num : rgba.g,
      channel === 'b' ? num : rgba.b,
    );
  };

  private onHslChange = (channel: 'h' | 's' | 'l', e: Event) => {
    const raw = (e.target as HTMLInputElement).value;
    const num = parseInt(raw, 10) || 0;
    const hsl = hsvaToHsl(this.hsva);
    const h = channel === 'h' ? Math.max(0, Math.min(360, num)) : hsl.h;
    const s = channel === 's' ? Math.max(0, Math.min(100, num)) : hsl.s;
    const l = channel === 'l' ? Math.max(0, Math.min(100, num)) : hsl.l;
    const { r, g, b } = hslToRgb(h, s, l);
    this.rgbaFromChannels(r, g, b);
  };

  private onAlphaInputChange = (e: Event) => {
    const raw = (e.target as HTMLInputElement).value;
    const num = Math.max(0, Math.min(1, parseFloat(raw) || 0));
    this.hsva = { ...this.hsva, a: num };
    this.hexInput = hsvaToHex(this.hsva, true);
    this.emit(true);
  };

  // ──────────────────────────────────────────────────────────────────
  // Presets
  // ──────────────────────────────────────────────────────────────────

  private get parsedPresets(): string[] {
    const raw = Array.isArray(this.presets)
      ? this.presets
      : String(this.presets ?? '').split(',');
    return raw.map((s) => String(s).trim()).filter(Boolean);
  }

  private onPresetClick = (hex: string) => {
    if (this.disabled) return;
    this.applyValue(hex, true);
    this.emit(true);
  };

  private onPresetKeyDown = (e: KeyboardEvent, hex: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.onPresetClick(hex);
    }
  };

  // ──────────────────────────────────────────────────────────────────
  // Popover
  // ──────────────────────────────────────────────────────────────────

  /** Programmatically open the popover. */
  @Method()
  async show(): Promise<void> {
    if (this.variant !== 'popover' || this.disabled) return;
    this.open = true;
  }

  /** Programmatically close the popover. */
  @Method()
  async close(): Promise<void> {
    if (this.variant !== 'popover') return;
    this.open = false;
  }

  @Watch('open')
  onOpenChange(value: boolean) {
    this.mdOpenChange.emit({ open: value });
    this.syncOutsideClickListener();
    // The trigger is the consumer's element, so nothing re-renders it — its
    // aria-expanded has to be pushed on EVERY transition, not just the ones the
    // trigger itself started (Escape, an outside click, or a controlled
    // `open = false` all land here).
    this.syncSlottedTriggerAria();
  }

  @Watch('variant')
  onVariantChange() {
    this.syncOutsideClickListener();
  }

  @Watch('dismissOnOutsideClick')
  onDismissOnOutsideClickChange() {
    this.syncOutsideClickListener();
  }

  @Watch('disabled')
  onDisabledChange() {
    this.syncOutsideClickListener();
  }

  disconnectedCallback() {
    this.removeOutsideClickHandler();
    this.wiredTrigger?.removeEventListener('click', this.toggleOpen);
    this.wiredTrigger = null;
  }

  private syncOutsideClickListener() {
    this.removeOutsideClickHandler();
    if (
      this.variant !== 'popover' ||
      !this.open ||
      !this.dismissOnOutsideClick ||
      this.disabled ||
      typeof document === 'undefined'
    ) {
      return;
    }
    requestAnimationFrame(() => {
      if (
        this.variant !== 'popover' ||
        !this.open ||
        !this.dismissOnOutsideClick ||
        this.disabled
      ) {
        return;
      }
      this.attachOutsideClickHandler();
    });
  }

  private attachOutsideClickHandler() {
    this.outsideClickHandler = (e: MouseEvent) => {
      if (this.disabled || !this.open) return;
      const path = e.composedPath ? e.composedPath() : [];
      if (path.includes(this.el)) return;
      const target = e.target as Node | null;
      if (target && this.el.contains(target)) return;
      this.open = false;
    };
    document.addEventListener('mousedown', this.outsideClickHandler, true);
  }

  private removeOutsideClickHandler() {
    if (this.outsideClickHandler && typeof document !== 'undefined') {
      document.removeEventListener('mousedown', this.outsideClickHandler, true);
    }
    this.outsideClickHandler = undefined;
  }

  @Listen('keydown', { target: 'window' })
  onGlobalKeyDown(e: KeyboardEvent) {
    if (this.variant === 'popover' && this.open && e.key === 'Escape') {
      e.preventDefault();
      this.open = false;
    }
  }

  private toggleOpen = () => {
    if (this.disabled) return;
    this.open = !this.open; // @Watch('open') syncs the trigger's aria-expanded
  };

  // ──────────────────────────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────────────────────────

  private renderSaturationPlate() {
    const hue = this.hsva.h;
    const sat = this.hsva.s;
    const val = this.hsva.v;
    const hueRgb = hsvaToRgba({ h: hue, s: 100, v: 100, a: 1 });
    const bg = `rgb(${hueRgb.r}, ${hueRgb.g}, ${hueRgb.b})`;
    return (
      <div
        class="md-color-picker__plate"
        part="plate"
        role="application"
        tabindex={this.disabled ? -1 : 0}
        aria-label="Saturation and brightness"
        style={{ background: bg }}
        onPointerDown={this.onSatPointerDown}
        onPointerMove={this.onSatPointerMove}
        onPointerUp={this.onSatPointerUp}
        onPointerCancel={this.onSatPointerUp}
        onKeyDown={this.onSatKeyDown}
      >
        <div class="md-color-picker__plate-saturation" aria-hidden="true"></div>
        <div class="md-color-picker__plate-value" aria-hidden="true"></div>
        <div
          class="md-color-picker__thumb"
          part="thumb"
          style={{
            insetInlineStart: `${sat}%`,
            insetBlockStart: `${100 - val}%`,
            backgroundColor: hsvaToHex(this.hsva, false),
          }}
        ></div>
      </div>
    );
  }

  private renderHueSlider() {
    const hue = this.hsva.h;
    const ratio = hue / 360;
    return (
      <div
        class="md-color-picker__hue"
        part="hue"
        role="slider"
        aria-label="Hue"
        aria-valuemin="0"
        aria-valuemax="360"
        aria-valuenow={Math.round(hue)}
        aria-orientation="horizontal"
        aria-disabled={this.disabled ? 'true' : undefined}
        tabindex={this.disabled ? -1 : 0}
        onPointerDown={this.onHuePointerDown}
        onPointerMove={this.onHuePointerMove}
        onPointerUp={this.onHuePointerUp}
        onPointerCancel={this.onHuePointerUp}
        onKeyDown={this.onHueKeyDown}
      >
        <div
          class="md-color-picker__thumb md-color-picker__thumb--slider"
          style={{
            insetInlineStart: `${ratio * 100}%`,
            backgroundColor: hsvaToHex({ h: hue, s: 100, v: 100, a: 1 }, false),
          }}
        ></div>
      </div>
    );
  }

  private renderAlphaSlider() {
    if (!this.alpha) return null;
    const alphaVal = this.hsva.a;
    const baseRgb = hsvaToRgba({ ...this.hsva, a: 1 });
    const gradient = `linear-gradient(to ${this.horizontalGradientTo()}, rgba(${baseRgb.r}, ${baseRgb.g}, ${baseRgb.b}, 0), rgba(${baseRgb.r}, ${baseRgb.g}, ${baseRgb.b}, 1))`;
    return (
      <div
        class="md-color-picker__alpha"
        part="alpha"
        role="slider"
        aria-label="Opacity"
        aria-valuemin="0"
        aria-valuemax="1"
        aria-valuenow={+alphaVal.toFixed(2)}
        aria-orientation="horizontal"
        aria-disabled={this.disabled ? 'true' : undefined}
        tabindex={this.disabled ? -1 : 0}
        onPointerDown={this.onAlphaPointerDown}
        onPointerMove={this.onAlphaPointerMove}
        onPointerUp={this.onAlphaPointerUp}
        onPointerCancel={this.onAlphaPointerUp}
        onKeyDown={this.onAlphaKeyDown}
      >
        <div class="md-color-picker__alpha-track" style={{ backgroundImage: gradient }}></div>
        <div
          class="md-color-picker__thumb md-color-picker__thumb--slider"
          style={{
            insetInlineStart: `${alphaVal * 100}%`,
            backgroundColor: hsvaToHex(this.hsva, true),
          }}
        ></div>
      </div>
    );
  }

  private renderHexInput() {
    if (!this.showHex) return null;
    return (
      <div class="md-color-picker__field md-color-picker__field--hex" part="field-hex">
        <label part="label" htmlFor={`${this.uid}-hex`}>Hex</label>
        <input
          id={`${this.uid}-hex`}
          type="text"
          value={this.hexInput}
          spellcheck={false}
          autoComplete="off"
          aria-invalid={this.hexInvalid ? 'true' : undefined}
          disabled={this.disabled}
          onInput={this.onHexInput}
          onBlur={this.onHexBlur}
          onKeyDown={(e: KeyboardEvent) => {
            if (e.key === 'Enter') {
              (e.target as HTMLInputElement).blur();
            }
          }}
        />
      </div>
    );
  }

  private renderAlphaField() {
    if (!this.alpha) return null;
    return (
      <div class="md-color-picker__field" part="field-a">
        <label htmlFor={`${this.uid}-a`}>A</label>
        <input
          id={`${this.uid}-a`}
          type="number"
          min="0"
          max="1"
          step="0.01"
          value={+this.hsva.a.toFixed(2)}
          disabled={this.disabled}
          onChange={this.onAlphaInputChange}
        />
      </div>
    );
  }

  private renderRgbInputs() {
    const rgb = hsvaToRgba(this.hsva);
    return (
      <div class="md-color-picker__inputs" part="inputs">
        <div class="md-color-picker__field" part="field-r">
          <label htmlFor={`${this.uid}-r`}>R</label>
          <input
            id={`${this.uid}-r`}
            type="number"
            min="0"
            max="255"
            step="1"
            value={rgb.r}
            disabled={this.disabled}
            onChange={(e) => this.onRgbChange('r', e)}
          />
        </div>
        <div class="md-color-picker__field" part="field-g">
          <label htmlFor={`${this.uid}-g`}>G</label>
          <input
            id={`${this.uid}-g`}
            type="number"
            min="0"
            max="255"
            step="1"
            value={rgb.g}
            disabled={this.disabled}
            onChange={(e) => this.onRgbChange('g', e)}
          />
        </div>
        <div class="md-color-picker__field" part="field-b">
          <label htmlFor={`${this.uid}-b`}>B</label>
          <input
            id={`${this.uid}-b`}
            type="number"
            min="0"
            max="255"
            step="1"
            value={rgb.b}
            disabled={this.disabled}
            onChange={(e) => this.onRgbChange('b', e)}
          />
        </div>
        {this.renderAlphaField()}
      </div>
    );
  }

  private renderHslInputs() {
    const hsl = hsvaToHsl(this.hsva);
    return (
      <div class="md-color-picker__inputs" part="inputs">
        <div class="md-color-picker__field" part="field-h">
          <label htmlFor={`${this.uid}-h`}>H</label>
          <input
            id={`${this.uid}-h`}
            type="number"
            min="0"
            max="360"
            step="1"
            value={Math.round(hsl.h)}
            disabled={this.disabled}
            onChange={(e) => this.onHslChange('h', e)}
          />
        </div>
        <div class="md-color-picker__field" part="field-s">
          <label htmlFor={`${this.uid}-s`}>S</label>
          <input
            id={`${this.uid}-s`}
            type="number"
            min="0"
            max="100"
            step="1"
            value={Math.round(hsl.s)}
            disabled={this.disabled}
            onChange={(e) => this.onHslChange('s', e)}
          />
        </div>
        <div class="md-color-picker__field" part="field-l">
          <label htmlFor={`${this.uid}-l`}>L</label>
          <input
            id={`${this.uid}-l`}
            type="number"
            min="0"
            max="100"
            step="1"
            value={Math.round(hsl.l)}
            disabled={this.disabled}
            onChange={(e) => this.onHslChange('l', e)}
          />
        </div>
        {this.renderAlphaField()}
      </div>
    );
  }

  private renderChannelInputs() {
    if (!this.showInputs) return null;
    if (this.format === 'hsl') return this.renderHslInputs();
    return this.renderRgbInputs();
  }

  private renderPresets() {
    const presets = this.parsedPresets;
    if (presets.length === 0) return null;
    return (
      <div class="md-color-picker__presets" part="presets" role="listbox" aria-label="Color presets">
        {presets.map((hex) => (
          <button
            key={hex}
            type="button"
            class="md-color-picker__preset"
            part="preset"
            role="option"
            aria-label={hex}
            aria-selected={hsvaToHex(this.hsva, false).toLowerCase() === hex.toLowerCase() ? 'true' : 'false'}
            style={{ backgroundColor: hex }}
            disabled={this.disabled}
            onClick={() => this.onPresetClick(hex)}
            onKeyDown={(e: KeyboardEvent) => this.onPresetKeyDown(e, hex)}
          ></button>
        ))}
      </div>
    );
  }

  private renderPanel() {
    return (
      <div class="md-color-picker__panel" part="panel">
        {this.renderSaturationPlate()}
        <div class="md-color-picker__sliders" part="sliders">
          <div class="md-color-picker__sliders-stack">
            {this.renderHueSlider()}
            {this.renderAlphaSlider()}
          </div>
          <div
            class="md-color-picker__preview"
            part="preview"
            role="img"
            aria-label={`Current colour ${formatColor(this.hsva, this.format)}`}
          >
            <div
              class="md-color-picker__preview-inner"
              style={{ backgroundColor: hsvaToHex(this.hsva, true) }}
            ></div>
          </div>
        </div>
        {this.renderHexInput()}
        {this.renderChannelInputs()}
        {this.renderPresets()}
      </div>
    );
  }

  render() {
    const previewColor = hsvaToHex(this.hsva, true);
    if (this.variant === 'popover') {
      return (
        <Host
          class={{
            'md-color-picker': true,
            'md-color-picker--popover': true,
            'md-color-picker--open': this.open,
            'md-color-picker--disabled': this.disabled,
          }}
          aria-label={this.ariaLabelProp}
        >
          {/* The trigger is entirely the consumer's: slot any element — an
              md-button of your chosen variant/size, an md-icon-button, your own
              swatch — and this component wires activation plus
              aria-haspopup / aria-expanded onto it. There is deliberately NO
              built-in trigger: a default would impose a variant, a size and a
              label on every consumer. */}
          <slot name="trigger" />
          {this.open && (
            <div class="md-color-picker__popover" part="popover" role="dialog" aria-label={this.ariaLabelProp}>
              {this.renderPanel()}
            </div>
          )}
        </Host>
      );
    }
    return (
      <Host
        class={{
          'md-color-picker': true,
          'md-color-picker--inline': true,
          'md-color-picker--disabled': this.disabled,
        }}
        role="group"
        aria-label={this.ariaLabelProp}
      >
        {this.renderPanel()}
      </Host>
    );
  }
}
