import { Component, Host, h, Prop, Element, Watch, State, Event, EventEmitter } from '@stencil/core';

/* ============================================================================
 * Material Design 3 — Progress Indicator (Expressive generation)
 * Spec: https://m3.material.io/components/progress-indicators/specs
 *
 * Conforms to the 2024+ "expressive" generation (the version shown on
 * m3.material.io today): animated wavy waveforms, 4dp indicator↔track gaps,
 * round caps, and the expressive indeterminate motion. Constants below were
 * verified against the Compose Material3 source (the authoritative source for
 * the wavy geometry/motion) and Material Web (baseline CSS/tokens).
 * ==========================================================================*/

/** Indicator↔track gap (dp). Fixed token — NOT coupled to thickness. */
const GAP_DP = 4;
/** Wavelength (dp) for the linear wave (both determinate and indeterminate). */
const LINEAR_DET_WAVELENGTH = 40;
const CIRCULAR_WAVELENGTH = 15;
/** Peak amplitudes (dp) at amplitude factor = 1. */
const LINEAR_AMPLITUDE = 3;
const CIRCULAR_AMPLITUDE = 1.6;
/** Circular container sizes (dp): non-wavy 40, wavy 48. */
const CIRCULAR_SIZE_FLAT = 40;
const CIRCULAR_SIZE_WAVE = 48;
/** M3 circular size range (dp): 24 (min) … 240 (max). Sizes are clamped here. */
const CIRCULAR_SIZE_MIN = 24;
const CIRCULAR_SIZE_MAX = 240;
/** Wave path sampling density (control points per wavelength). Catmull-Rom
 *  smooths between samples, so ~8 is plenty for a clean sine and keeps the
 *  per-frame path rebuild cheap. */
const WAVE_SAMPLES_PER_WL = 8;
/** Amplitude in/out animation: 500ms; in = EasingStandard, out = EmphasizedAccelerate. */
const AMP_DURATION = 500;
const AMP_IN: Bezier = [0.2, 0, 0, 1];
const AMP_OUT: Bezier = [0.3, 0, 0.8, 0.15];
/** Circular indeterminate choreography (Compose expressive). */
const CIRCULAR_INDET_CYCLE = 6000;
const CIRCULAR_INDET_MIN = 0.1;
const CIRCULAR_INDET_MAX = 0.87;
const CIRCULAR_GLOBAL_ROTATION = 1080; // deg per cycle
const MIN_CIRCULAR_VERTICES = 5;

type Bezier = [number, number, number, number];

/* ── cubic-bézier easing solver (maps time fraction → eased fraction) ──────*/
function bezierEasing([x1, y1, x2, y2]: Bezier): (t: number) => number {
  if (x1 === y1 && x2 === y2) return (t) => t; // linear
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const slopeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const xt = sampleX(t) - x;
      const d = slopeX(t);
      if (Math.abs(xt) < 1e-5) break;
      if (Math.abs(d) < 1e-6) break;
      t -= xt / d;
    }
    return sampleY(Math.min(1, Math.max(0, t)));
  };
}
const EASE_IN = bezierEasing(AMP_IN);
const EASE_OUT = bezierEasing(AMP_OUT);
const EASE_STANDARD = bezierEasing([0.2, 0, 0, 1]);

@Component({
  tag: 'md-progress-indicator',
  styleUrl: 'md-progress-indicator.css',
  shadow: true,
})
export class MdProgressIndicator {
  @Element() el!: HTMLElement;

  /** Visual variant: linear (horizontal bar) or circular (ring). */
  @Prop() variant: 'circular' | 'linear' = 'linear';

  /** Current progress value (0 to max). */
  @Prop() value: number = 0;

  /** Maximum progress value. */
  @Prop() max: number = 100;

  /** Indeterminate mode — looping animation when progress is unknown. */
  @Prop({ reflect: true }) indeterminate: boolean = false;

  /** Track / stroke thickness in dp. */
  @Prop() thickness: number = 4;

  /** Enable the wavy (M3 Expressive) active indicator. */
  @Prop({ reflect: true }) wave: boolean = false;

  /**
   * Wave amplitude (center-to-peak) in dp. `0` = auto per M3 spec
   * (linear 3dp, circular 1.6dp).
   */
  @Prop({ attribute: 'wave-amplitude' }) waveAmplitude: number = 0;

  /**
   * Wavelength (peak-to-peak) in dp. `0` = auto
   * (linear 40dp for both determinate + indeterminate, circular 15dp).
   */
  @Prop({ attribute: 'wave-length' }) waveLength: number = 0;

  /**
   * Wave travel speed in dp/second. `0` = auto (= wavelength, i.e. one
   * wavelength per second per the M3 default).
   */
  @Prop({ attribute: 'wave-speed' }) waveSpeed: number = 0;

  /**
   * Circular indicator outer size in dp. `0` = auto (non-wavy 40dp,
   * wavy 48dp per the M3 expressive spec). Clamped to the M3 range 24–240dp.
   */
  @Prop() size: number = 0;

  /** Four-color cycling animation (circular indeterminate only). */
  @Prop({ attribute: 'four-color', reflect: true }) fourColor: boolean = false;

  /** Accessible label for screen readers. */
  @Prop() label: string = 'Progress';

  /**
   * Set to `true` to trigger the completion ("closing TV") animation. After it
   * plays, the indicator self-hides (`visibility:hidden`) and emits `mdComplete` —
   * EXCEPT the flat (non-wavy) circular variant, which instead rests showing its
   * empty track ring (the active indicator erases away and the track fades in).
   * No-op on indeterminate indicators.
   */
  @Prop() complete: boolean = false;

  /**
   * Local density rung. Drives the same `--md-sys-density-scale` signal that a
   * global `data-density` ancestor sets, so a local value simply overrides the
   * inherited one. 0 = default, -4 = ultra-compact.
   */
  @Prop({ reflect: true }) density: 0 | -1 | -2 | -3 | -4 = 0;

  /** Fired when the completion animation finishes (and the indicator has hidden
   *  itself, or — for flat circular — settled on its empty track ring). */
  @Event() mdComplete!: EventEmitter<void>;

  /** Tracks the user's reduced-motion preference (drives the flat wave). */
  @State() private reducedMotion: boolean = false;
  @State() private _completing = false;
  @State() private _completed = false;
  /** Flat circular terminal state: active erased, empty track ring left visible
   *  (the variant that does NOT self-hide on completion). */
  @State() private _completedTrack = false;
  @State() private _fillComplete = false;

  // ── animation state ──────────────────────────────────────────────────────
  private raf = 0;
  private phase = 0; // circular wave phase (radians)
  private linearPhase = 0; // linear wavy determinate phase (radians)
  private amp = 0; // current animated amplitude factor (0..1)
  private ampFrom = 0;
  private ampTo = 0;
  private ampStartTs = -1;
  private ampEase: (t: number) => number = EASE_IN;
  private lastTs = -1;
  private indetStartTs = -1;
  private renderFraction = 0;       // eased sweep for the wavy circular determinate arc
  private linearRenderFraction = 0; // eased fill for the wavy linear determinate path
  private activeRef?: SVGPathElement;
  private trackRef?: SVGPathElement;
  private linearWaveRef: SVGPathElement | null = null;
  private linearWaveSvgRef: SVGSVGElement | null = null;
  private linearWaveTrackRef: HTMLDivElement | null = null;
  private flatActiveRef: HTMLDivElement | null = null;
  private flatTrackRef: HTMLDivElement | null = null;
  private indetBar1Ref: HTMLDivElement | null = null;
  private indetBar2Ref: HTMLDivElement | null = null;
  private indetPath1Ref: SVGPathElement | null = null;
  private indetPath2Ref: SVGPathElement | null = null;
  private indetTrackRef: HTMLDivElement | null = null;
  private rotRef?: SVGGElement;
  private mql?: MediaQueryList;
  private io?: IntersectionObserver;
  private ro?: ResizeObserver;
  private linearWidth = 0; // cached layout width (refreshed on render + resize)
  private visible = true;
  private rtl = false; // cached layout direction (refreshed each render)

  // ── completion animation state ────────────────────────────────────────────
  private completingFromFrac = 0;
  private activeCircleRef?: SVGCircleElement;
  private circularFlatTrackRef: SVGCircleElement | null = null;
  // Path used ONLY during the flat completion sequence: the erase/fill arc is drawn
  // here as an explicit round-capped <path> (not the dashed <circle>) so the head
  // doesn't jitter the way an animated stroke-dashoffset on a circle does.
  private circularFlatCompleteRef: SVGPathElement | null = null;

  // ── circular completion (unified flat + wavy rAF state machine) ───────────
  // Phase 1: fill the arc from the current fraction → a full circle (one pass).
  // Phase 2: (wavy only) flatten the wave amplitude → 0 so it becomes a ring.
  // Phase 3: after a brief hold, erase the ring from the START point, progressively
  //          shrinking it clockwise until nothing is left (no track shown).
  // Phase 4: (flat circular only) the line is gone — fade the empty track ring IN,
  //          then settle on it (flat circular rests on its track, doesn't self-hide).
  // Driven entirely by plain fields + rAF (NOT @State) so no Stencil re-render
  // detaches the SVG elements mid-animation — that detach was what produced the
  // "two passes" (the CSS stroke-dasharray transition re-drawing the arc while
  // the JS animation was also drawing it).
  private ccPhase: 0 | 1 | 2 | 3 | 4 = 0;
  private ccStart = -1;
  private ccFrac = 0; // animated fill fraction during phase 1
  private ccErase = 0; // erase progress 0..1 during phase 3
  private readonly CC_FILL_DUR = 500;    // ms
  private readonly CC_FLATTEN_DUR = 300; // ms (wavy only)
  private readonly CC_WAIT = 150;        // ms hold at full circle before erasing
  private readonly CC_ERASE_DUR = 550;   // ms
  private readonly CC_TRACK_REVEAL_DUR = 300; // ms (flat circular: fade the empty track ring in after the erase)

  // ── wave linear completion (multi-phase rAF sequence) ─────────────────────
  // Phase 1: fill the wave path from current fraction → 1 (WLC_FILL_DUR ms)
  // Phase 2: tween amplitude → 0 so the wave flattens (AMP_DURATION ms)
  // After phase 2: set _completing = true → CSS scaleY collapse plays
  private wlcPhase: 0 | 1 | 2 = 0;
  private wlcStart = -1;
  private wlcFromFrac = 0;
  private wlcFrac = 0;
  private readonly WLC_FILL_DUR = 300;     // ms to fill wave path to 100%
  private readonly WLC_FLATTEN_DUR = 300; // ms to flatten wave to a straight line

  // ── flat linear completion (rAF fill phase) ───────────────────────────────
  // Phase 1: ease the fill fraction → 1 (sharing the wavy variant's ease), then
  // hand off to the CSS scaleY collapse. Driven by the same linearRenderFraction
  // as the steady-state fill so the flat + wavy variants stay perfectly in sync.
  private flcPhase: 0 | 1 = 0;

  // ── derived geometry ──────────────────────────────────────────────────────
  private get fraction(): number {
    if (!this.max) return 0;
    return Math.min(1, Math.max(0, this.value / this.max));
  }

  private get densityScale(): number {
    if (!this.el) return 0;
    const v = getComputedStyle(this.el).getPropertyValue('--md-sys-density-scale').trim();
    return v ? Number(v) : 0;
  }

  private get resolvedSize(): number {
    const density = this.densityScale;
    const s = this.size > 0 ? this.size : (this.wave ? CIRCULAR_SIZE_WAVE : CIRCULAR_SIZE_FLAT) + density * 3;
    return Math.min(CIRCULAR_SIZE_MAX, Math.max(CIRCULAR_SIZE_MIN, s));
  }

  private get resolvedWavelength(): number {
    if (this.waveLength > 0) return this.waveLength;
    if (this.variant === 'circular') return CIRCULAR_WAVELENGTH;
    return LINEAR_DET_WAVELENGTH;
  }

  private get resolvedAmplitude(): number {
    if (this.waveAmplitude > 0) return this.waveAmplitude;
    if (this.variant === 'circular') return CIRCULAR_AMPLITUDE;
    return LINEAR_AMPLITUDE;
  }

  private get resolvedThickness(): number {
    if (this.thickness !== 4) return this.thickness;
    return Math.max(2, 4 + this.densityScale * 0.5);
  }

  /** Stroke width of the wave path — density-scaled like everything else. */
  private get resolvedWaveStroke(): number {
    return this.resolvedThickness;
  }

  /** Effective thickness for all geometry. */
  private get effectiveThickness(): number {
    return this.resolvedThickness;
  }

  private get resolvedWaveSpeed(): number {
    if (this.waveSpeed > 0) return this.waveSpeed;
    return this.resolvedWavelength;
  }

  /** Fixed wavy linear container height (2·amp + wave stroke; 10dp at determinate
   *  defaults). Uses the (possibly bolder) wave stroke so the mask viewBox and
   *  the band height both contain the round caps. */
  private get linearWaveHeight(): number {
    return 2 * this.resolvedAmplitude + this.resolvedWaveStroke;
  }

  /**
   * Amplitude *target* (0..1). Indeterminate is always full; determinate
   * flattens to 0 at the endpoints (≤10% / ≥95%). Reduced motion → flat.
   */
  private get amplitudeTarget(): number {
    if (!this.wave || this.reducedMotion) return 0;
    if (this.indeterminate) return 1;
    // Determinate: fully wavy from the first bit of progress all the way through
    // 100 % (and through the closing animation) — NO endpoint flatten. At the
    // very start the fill is shorter than one wavelength, so it naturally reads
    // as a dot, then progresses DIRECTLY to wavy; at 100 % it stays wavy and the
    // "closing TV" animation collapses the wave shape rather than a flat line.
    return this.fraction > 0 ? 1 : 0;
  }

  // ── lifecycle ─────────────────────────────────────────────────────────────
  componentWillLoad() {
    this.amp = this.amplitudeTarget;
    this.ampTo = this.amp;
    this.renderFraction = this.fraction;
    this.linearRenderFraction = this.fraction;
    this.syncHostStyles();
    if (typeof window !== 'undefined' && window.matchMedia) {
      this.mql = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.reducedMotion = this.mql.matches;
      this.mql.addEventListener?.('change', this.onReducedMotionChange);
    }
  }

  componentDidLoad() {
    if (typeof IntersectionObserver !== 'undefined') {
      this.io = new IntersectionObserver((entries) => {
        this.visible = entries.some((e) => e.isIntersecting);
        this.ensureLoop();
      });
      this.io.observe(this.el);
    }
    // Refresh the cached width (and repaint) only on actual resizes — so the
    // per-frame loop never has to call getBoundingClientRect (which would force
    // a synchronous layout every frame).
    if (typeof ResizeObserver !== 'undefined') {
      this.ro = new ResizeObserver(() => {
        this.measureLinearWidth();
        this.updateLinearPath();
      });
      this.ro.observe(this.el);
    }
    this.ensureLoop();
  }

  componentDidRender() {
    this.ensureLoop();
    // Refresh the cached layout direction (inherited from ancestors via dir=rtl).
    this.rtl = this.computeRtl();
    // Keep the SVG path in sync when the fill width changes while the phase
    // loop isn't running (e.g. the wave is flat near 0% / ≥95%).
    if (this.wave && this.variant === 'linear' && !this.indeterminate) {
      this.measureLinearWidth(); // once per render, NOT per animation frame
      // Don't overwrite the path while the rAF loop owns it (wlcPhase > 0)
      // or after completion has frozen it (_completing / _completed).
      if (this.wlcPhase === 0 && !this._completing && !this._completed) {
        // If the rAF loop isn't running (amp=0, reduced motion), snap the eased
        // fraction so the path stays at the actual value with no lag.
        if (!this.raf) this.linearRenderFraction = this.fraction;
        this.updateLinearPath();
      }
    }
    // Flat linear determinate: the fill + track are rAF-driven (same as the wavy
    // variant) so they share its motion exactly. Keep them in sync when the loop
    // isn't running (reduced motion, off-screen, settled) by snapping the value.
    if (!this.wave && this.variant === 'linear' && !this.indeterminate) {
      if (this.flcPhase === 0 && !this._completing && !this._completed) {
        if (!this.raf) this.linearRenderFraction = this.fraction;
        this.updateLinearFlat();
      }
    }
    // Flat circular determinate: active arc + track are rAF-driven (mirrors the wavy
    // variant) so they recede in lockstep. Keep them in sync when the loop isn't
    // running (reduced motion, off-screen, settled) by snapping the eased value.
    if (this.variant === 'circular' && !this.wave && !this.indeterminate) {
      if (this.ccPhase === 0 && !this._completing && !this._completed && !this._completedTrack) {
        if (!this.raf) this.renderFraction = this.fraction;
        this.updateCircularFlat();
      }
    }
  }

  /** Measure + cache the linear layout width. Called on render and on resize
   *  (never inside the rAF loop) so the per-frame path repaint stays layout-free. */
  private measureLinearWidth(): number {
    const w =
      this.linearWaveSvgRef?.getBoundingClientRect().width ||
      this.el.getBoundingClientRect().width ||
      this.el.clientWidth ||
      0;
    if (w) this.linearWidth = w;
    return this.linearWidth;
  }

  private computeRtl(): boolean {
    if (typeof getComputedStyle === 'undefined' || !this.el) return false;
    return getComputedStyle(this.el).direction === 'rtl';
  }

  disconnectedCallback() {
    this.stopLoop();
    this.mql?.removeEventListener?.('change', this.onReducedMotionChange);
    this.io?.disconnect();
    this.ro?.disconnect();
  }

  private onReducedMotionChange = (e: MediaQueryListEvent) => {
    this.reducedMotion = e.matches;
  };

  @Watch('thickness')
  @Watch('size')
  @Watch('wave')
  @Watch('waveAmplitude')
  @Watch('waveLength')
  @Watch('variant')
  onDimensionChange() {
    this.syncHostStyles();
  }

  @Watch('value')
  @Watch('max')
  @Watch('indeterminate')
  @Watch('wave')
  @Watch('reducedMotion')
  onAmplitudeInputChange() {
    if (this.ccPhase > 0) return; // a completion sequence owns the geometry
    this.retargetAmplitude();
    // A value change also needs to wake the loop so the wavy circular sweep
    // can ease toward its new target (renderFraction → fraction).
    this.ensureLoop();
  }

  @Watch('complete')
  onCompleteChange(next: boolean) {
    if (!next || this.indeterminate || this._completing || this._completed || this._completedTrack || this.ccPhase > 0) return;

    // Wave linear: multi-phase rAF sequence (fill → flatten → scaleY collapse).
    // Snap amp to 1 now so the flatten always starts from a fully visible wave.
    if (this.variant === 'linear' && this.wave) {
      this.amp = 1;
      this.ampFrom = 1;
      this.ampTo = 1;
      this.ampStartTs = -2;
      this.wlcPhase = 1;
      this.wlcStart = -1;
      this.wlcFromFrac = this.fraction;
      this.wlcFrac = this.fraction;
      this.ensureLoop();
      return;
    }

    // Flat linear: ease the fill to 100% (driven by the SAME linearRenderFraction
    // + ease as the wavy variant, so both fill identically), then collapse.
    if (this.variant === 'linear' && !this.wave) {
      if (this.reducedMotion || typeof requestAnimationFrame === 'undefined') {
        // No rAF available — snap to full, then collapse (transitions are 0s under
        // reduced motion so the fill jumps and the scaleY collapse plays).
        this._fillComplete = true;
        this._completing = true;
        return;
      }
      this.flcPhase = 1;
      this.ensureLoop();
      return;
    }

    // Circular (flat + wavy): unified rAF state machine (fill → flatten → erase).
    // Reduced motion has no rAF loop — snap straight to hidden.
    if (this.reducedMotion || typeof requestAnimationFrame === 'undefined') {
      this.handleComplete();
      return;
    }
    // Snap the eased sweep to its target so the determinate fill that just finished
    // is NOT re-driven from a lagging renderFraction (the wavy "second pass" where
    // Phase 1 grew the arc ~93% → 100% again), and so the flat hand-off from the
    // dashed <circle> to the completion <path> starts at exactly the shown arc.
    this.renderFraction = this.fraction;
    this.completingFromFrac = this.fraction;
    this.ccFrac = this.completingFromFrac;
    this.ccErase = 0;
    this.ccStart = -1;
    // Wavy closes on the wave shape: hold full amplitude through fill + flatten.
    if (this.wave) {
      this.amp = 1;
      this.ampTo = 1;
      this.ampStartTs = -2;
      this.ampFrom = this.amp;
    }
    // Already at (or essentially at) 100% — there is nothing to fill, so skip the
    // dead Phase-1 hold and go straight to flatten (wavy) / erase (flat).
    if (this.completingFromFrac >= 1 - 1e-3) {
      this.ccFrac = 1;
      this.ccPhase = this.wave ? 2 : 3;
    } else {
      this.ccPhase = 1;
    }
    this.ensureLoop();
  }

  private handleComplete() {
    this._completing = false;
    this._fillComplete = false;
    this.ccPhase = 0;
    this.flcPhase = 0;
    // Flat circular rests on its empty track ring instead of self-hiding; every
    // other variant hides via the --complete host rule.
    if (this.variant === 'circular' && !this.wave) {
      this._completedTrack = true;
    } else {
      this._completed = true;
    }
    this.mdComplete.emit();
  }

  private onLinearAnimEnd = (e: AnimationEvent) => {
    if (e.animationName === 'md-linear-complete') this.handleComplete();
  };

  private syncHostStyles() {
    const s = this.el?.style;
    if (!s) return;
    const t = this.resolvedThickness;
    s.setProperty('--_thickness', `${t}px`);
    s.setProperty('--_linear-height', `${this.wave ? this.linearWaveHeight : t}px`);
    if (this.variant === 'circular' || this.size > 0) {
      s.setProperty('--_size', `${this.resolvedSize}px`);
    } else {
      s.removeProperty('--_size');
    }

    if (this.wave && this.variant === 'linear') {
      const wl = this.resolvedWavelength;
      s.setProperty('--_wave-length-px', `${wl}px`);
      s.setProperty('--_wave-mask-size', `${wl}px ${this.linearWaveHeight}px`);
      // duration (ms) for one wavelength of travel at the resolved speed
      const dur = Math.max(50, Math.round((wl / this.resolvedWaveSpeed) * 1000));
      s.setProperty('--_wave-duration', `${dur}ms`);
      this.updateLinearMask();
    } else {
      ['--_wave-length-px', '--_wave-mask', '--_wave-mask-size', '--_wave-duration'].forEach((p) =>
        s.removeProperty(p),
      );
    }

    this.syncSpinnerTrackVars(s);
  }

  /**
   * Precompute the flat circular-indeterminate "complement track" keyframe values
   * as resolved CSS vars. The active arc (md-circular-dash) occupies path-fraction
   * [k, k+L] with k = −dashoffset; the gap-following track is the complement
   * [k+L+g, k+1−g] → dash length T = (1 − L − 2g), arc start offset = (O − L − g).
   *
   * CRITICAL: the dash is emitted as `T (1−T)` — NOT `T 1` — so the dash PERIOD
   * equals the path length (pathLength=1). Only then does a track arc that crosses
   * the 12-o'clock seam wrap correctly (with `T 1` the period is T+1 > 1, so the
   * wrapped portion lands outside [0,1) and is never painted — the track would
   * vanish for most of the cycle). Both `T (1−T)` endpoints sum to 1, so linear
   * keyframe interpolation keeps the period exactly 1 at every intermediate frame,
   * and the complement (T = 1−L−2g, affine in the same eased L,O) holds throughout.
   */
  private syncSpinnerTrackVars(s: CSSStyleDeclaration) {
    if (this.variant !== 'circular') return;
    const r = this.circularRadius;
    const C = 2 * Math.PI * r;
    const g = C > 0 ? (GAP_DP + this.effectiveThickness) / C : 0;
    // Active keyframes (L, O): 0.05/0 → 0.70/−0.18 → 0.05/−0.92
    const emit = (key: string, L: number, O: number) => {
      const T = Math.max(0.0001, Math.min(1, 1 - L - 2 * g));
      s.setProperty(`--_spin-da-${key}`, T.toFixed(4)); // dash length
      s.setProperty(`--_spin-gap-${key}`, (1 - T).toFixed(4)); // gap → period = 1
      s.setProperty(`--_spin-do-${key}`, (O - L - g).toFixed(4)); // arc-start offset
    };
    emit('0', 0.05, 0);
    emit('50', 0.7, -0.18);
    emit('100', 0.05, -0.92);
  }

  // ── amplitude animation (rAF tween shared by linear + circular) ───────────
  private retargetAmplitude() {
    if (this.wlcPhase > 0 || this.ccPhase > 0) return; // completion drives amp directly
    const target = this.amplitudeTarget;
    if (target === this.ampTo && this.ampStartTs < 0) return;
    if (target === this.ampTo) return;
    this.ampFrom = this.amp;
    this.ampTo = target;
    this.ampEase = target > this.ampFrom ? EASE_IN : EASE_OUT;
    this.ampStartTs = -1; // (re)start on next frame
    if (this.reducedMotion || typeof requestAnimationFrame === 'undefined') {
      // No animation available — snap.
      this.amp = target;
      this.ampStartTs = -2;
      this.applyAmplitude();
      return;
    }
    this.ensureLoop();
  }

  /** Push the current amplitude into the active renderer (mask or path). */
  private applyAmplitude() {
    if (this.variant === 'linear') {
      if (this.wave && !this.indeterminate) this.updateLinearPath();
      else if (!this.wave) this.updateLinearMask();
      // wave + indeterminate: the rAF loop calls updateLinearIndeterminate() each frame
    } else {
      this.updateCircularPath();
    }
  }

  // ── the rAF loop ──────────────────────────────────────────────────────────
  private shouldAnimate(): boolean {
    if (typeof requestAnimationFrame === 'undefined') return false;
    if (!this.visible || this.reducedMotion) return false;
    // Circular completion (flat + wavy) runs its own multi-phase rAF sequence.
    if (this.ccPhase > 0) return true;
    // Wave linear completion runs its own multi-phase rAF sequence.
    if (this.wlcPhase > 0) return true;
    // Linear completion is CSS-driven; no rAF needed while completing.
    if (this._completing && this.variant === 'linear') return false;
    // Circular wavy needs a persistent loop for phase travel (amp > 0), an
    // in-flight amplitude tween, an unsettled sweep, or indeterminate motion.
    if (this.variant === 'circular' && this.wave) {
      if (this.indeterminate) return true;
      return (
        this.amp > 0 ||
        this.amp !== this.ampTo ||
        Math.abs(this.renderFraction - this.fraction) > 1e-3
      );
    }
    // Flat circular determinate: loop while the eased sweep hasn't caught up to the
    // value, so the active arc + track repaint in lockstep (mirrors wavy circular).
    // Once it has settled on its terminal track ring, stay put.
    if (this.variant === 'circular' && !this.wave && !this.indeterminate) {
      return !this._completedTrack && Math.abs(this.renderFraction - this.fraction) > 1e-3;
    }
    // Linear wavy determinate: loop while wave is active, tween in-flight, or
    // the fill fraction hasn't caught up yet (keeps the path in sync with value).
    if (this.variant === 'linear' && this.wave && !this.indeterminate) {
      return this.amp > 0 || this.amp !== this.ampTo ||
        Math.abs(this.linearRenderFraction - this.fraction) > 1e-3;
    }
    // Linear wavy indeterminate: always loop (JS draws both bars each frame).
    if (this.variant === 'linear' && this.wave && this.indeterminate) return true;
    // Flat linear determinate: loop while the fill is easing toward the value (so
    // it moves with the SAME smoothness as the wavy variant) or while completing.
    if (this.variant === 'linear' && !this.wave && !this.indeterminate) {
      if (this.flcPhase > 0) return true;
      return Math.abs(this.linearRenderFraction - this.fraction) > 1e-3;
    }
    return false;
  }

  private ensureLoop() {
    if (this.shouldAnimate()) {
      if (!this.raf) this.raf = requestAnimationFrame(this.frame);
    } else if (this.amp === this.ampTo) {
      this.stopLoop();
    }
  }

  private stopLoop() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.lastTs = -1;
    // Re-anchor the indeterminate choreography on the next resume so it
    // restarts at t=0 instead of jumping by the elapsed wall-clock time.
    this.indetStartTs = -1;
  }

  private frame = (ts: number) => {
    this.raf = 0;
    if (this.lastTs < 0) this.lastTs = ts;
    const dt = Math.min(64, ts - this.lastTs); // clamp long gaps
    this.lastTs = ts;

    // Circular completion (flat + wavy): fill → (wavy) flatten → hold → erase.
    if (this.ccPhase > 0 && this.variant === 'circular') {
      if (this.ccStart < 0) this.ccStart = ts;
      // Keep the wave travelling for visual continuity through fill + flatten.
      if (this.wave) {
        const speedFactor = this.resolvedWaveSpeed / this.resolvedWavelength;
        this.phase += 2 * Math.PI * speedFactor * (dt / 1000);
        if (this.phase > 1e6) this.phase = this.phase % (2 * Math.PI);
      }

      if (this.ccPhase === 1) {
        // Fill: arc grows from the current fraction to a full circle (one pass).
        const t = Math.min(1, (ts - this.ccStart) / this.CC_FILL_DUR);
        this.ccFrac = this.completingFromFrac + (1 - this.completingFromFrac) * EASE_STANDARD(t);
        this.paintCircularCompletion();
        if (t >= 1) {
          this.ccFrac = 1;
          this.ccStart = ts;
          if (this.wave) {
            this.ccPhase = 2;
            this.ampFrom = this.amp;
          } else {
            this.ccPhase = 3;
          }
        }
      } else if (this.ccPhase === 2) {
        // Flatten (wavy only): wave amplitude eases to 0 → a plain ring.
        const t = Math.min(1, (ts - this.ccStart) / this.CC_FLATTEN_DUR);
        this.amp = this.ampFrom * (1 - EASE_IN(t));
        this.paintCircularCompletion();
        if (t >= 1) {
          this.amp = 0;
          this.ccPhase = 3;
          this.ccStart = ts;
        }
      } else if (this.ccPhase === 3) {
        // Erase: after a brief hold, remove the ring from the 12 o'clock start
        // outward (clockwise) until nothing remains. The track stays hidden.
        const t = Math.min(1, (ts - this.ccStart - this.CC_WAIT) / this.CC_ERASE_DUR);
        this.ccErase = t <= 0 ? 0 : EASE_STANDARD(t);
        this.paintCircularCompletion();
        if (t >= 1) {
          if (!this.wave) {
            // Flat circular: line is gone — fade the empty track ring IN (Phase 4).
            this.ccPhase = 4;
            this.ccStart = ts;
          } else {
            // Wavy circular self-hides.
            this.handleComplete();
            this.stopLoop();
            return;
          }
        }
      } else {
        // Phase 4 (flat circular only): the line has fully erased; fade the empty
        // track ring in, then settle on it (handleComplete → _completedTrack).
        const t = Math.min(1, (ts - this.ccStart) / this.CC_TRACK_REVEAL_DUR);
        this.circularFlatCompleteRef?.setAttribute('d', ''); // line gone
        if (this.activeCircleRef) this.activeCircleRef.style.opacity = '0';
        if (this.circularFlatTrackRef) {
          const tr = this.circularFlatTrackRef;
          tr.removeAttribute('stroke-dasharray'); // full ring
          tr.removeAttribute('stroke-dashoffset');
          tr.style.opacity = `${EASE_STANDARD(t)}`;
        }
        if (t >= 1) {
          this.handleComplete();
          this.stopLoop();
          return;
        }
      }
      this.raf = requestAnimationFrame(this.frame);
      return;
    }

    // Wave linear completion: phase 1 fills the path to 100%, phase 2 flattens amp to 0.
    if (this.wlcPhase > 0) {
      if (this.wlcStart < 0) this.wlcStart = ts;
      // Keep the wave travelling for visual continuity throughout.
      const speedFactor = this.resolvedWaveSpeed / this.resolvedWavelength;
      this.linearPhase += 2 * Math.PI * speedFactor * (dt / 1000);
      if (this.linearPhase > 1e6) this.linearPhase = this.linearPhase % (2 * Math.PI);

      if (this.wlcPhase === 1) {
        const t = Math.min(1, (ts - this.wlcStart) / this.WLC_FILL_DUR);
        this.wlcFrac = this.wlcFromFrac + (1 - this.wlcFromFrac) * EASE_STANDARD(t);
        this.updateLinearPath();
        if (t >= 1) {
          this.wlcFrac = 1;
          this.wlcPhase = 2;
          this.wlcStart = ts;
          this.ampFrom = 1; // always flatten from full amplitude
          this.ampTo = 0;
          this.ampEase = EASE_IN; // holds the wave shape longer then snaps flat
          this.ampStartTs = ts;
        }
      } else {
        const t = Math.min(1, (ts - this.ampStartTs) / this.WLC_FLATTEN_DUR);
        this.amp = this.ampFrom * (1 - this.ampEase(t));
        this.updateLinearPath();
        if (t >= 1) {
          this.amp = 0;
          this.wlcPhase = 0;
          this._completing = true; // scaleY collapse plays, then onLinearAnimEnd → handleComplete
          this.stopLoop();
          return;
        }
      }
      this.raf = requestAnimationFrame(this.frame);
      return;
    }

    // amplitude tween
    if (this.amp !== this.ampTo) {
      if (this.ampStartTs < 0) this.ampStartTs = ts;
      const t = Math.min(1, (ts - this.ampStartTs) / AMP_DURATION);
      this.amp = this.ampFrom + (this.ampTo - this.ampFrom) * this.ampEase(t);
      if (t >= 1) {
        this.amp = this.ampTo;
        this.ampStartTs = -2;
      }
    }

    // circular phase travel + eased determinate sweep
    if (this.variant === 'circular' && this.wave) {
      const speedFactor = this.resolvedWaveSpeed / this.resolvedWavelength; // waves/sec
      this.phase += 2 * Math.PI * speedFactor * (dt / 1000);
      if (this.phase > 1e6) this.phase = this.phase % (2 * Math.PI);
      // ease the rendered sweep toward the target (~500ms settle)
      const k = 1 - Math.exp(-dt / 160);
      this.renderFraction += (this.fraction - this.renderFraction) * k;
      if (Math.abs(this.fraction - this.renderFraction) < 1e-3) this.renderFraction = this.fraction;
      this.updateCircularPath();
    } else if (this.variant === 'circular' && !this.wave && !this.indeterminate) {
      // Flat circular determinate: ease the sweep toward the value with the SAME
      // ~500ms (160ms time-constant) settle the wavy circular uses, then repaint the
      // active arc + track in lockstep — the track recedes exactly as the arc grows
      // (no early unmount) and its final sliver fades out (no pop).
      const k = 1 - Math.exp(-dt / 160);
      this.renderFraction += (this.fraction - this.renderFraction) * k;
      if (Math.abs(this.fraction - this.renderFraction) < 1e-3) this.renderFraction = this.fraction;
      this.updateCircularFlat();
    } else if (this.variant === 'linear' && this.wave && !this.indeterminate) {
      const speedFactor = this.resolvedWaveSpeed / this.resolvedWavelength;
      this.linearPhase += 2 * Math.PI * speedFactor * (dt / 1000);
      if (this.linearPhase > 1e6) this.linearPhase = this.linearPhase % (2 * Math.PI);
      // Ease the fill toward the target with the same ~80ms time constant as the
      // flat linear's 250ms CSS transition so both variants move in sync.
      if (this.wlcPhase === 0) {
        const k = 1 - Math.exp(-dt / 80);
        this.linearRenderFraction += (this.fraction - this.linearRenderFraction) * k;
        if (Math.abs(this.fraction - this.linearRenderFraction) < 1e-3)
          this.linearRenderFraction = this.fraction;
      }
      this.updateLinearPath();
    } else if (this.variant === 'linear' && this.wave && this.indeterminate) {
      const speedFactor = this.resolvedWaveSpeed / this.resolvedWavelength;
      this.linearPhase += 2 * Math.PI * speedFactor * (dt / 1000);
      if (this.linearPhase > 1e6) this.linearPhase = this.linearPhase % (2 * Math.PI);
      this.updateLinearIndeterminate();
    } else if (this.variant === 'linear' && !this.wave && !this.indeterminate) {
      // Flat linear determinate: ease the fill toward the value (or → 1 while
      // completing) with the SAME 80ms time-constant the wavy variant uses, so the
      // two move in lockstep and the track recedes with identical smoothness.
      const target = this.flcPhase === 1 ? 1 : this.fraction;
      const k = 1 - Math.exp(-dt / 80);
      this.linearRenderFraction += (target - this.linearRenderFraction) * k;
      if (Math.abs(target - this.linearRenderFraction) < 1e-3) {
        this.linearRenderFraction = target;
        if (this.flcPhase === 1) {
          this.flcPhase = 0;
          this.updateLinearFlat();
          this._completing = true; // scaleY collapse → onLinearAnimEnd → handleComplete
          this.stopLoop();
          return;
        }
      }
      this.updateLinearFlat();
    } else {
      this.applyAmplitude();
    }

    if (this.shouldAnimate()) {
      this.raf = requestAnimationFrame(this.frame);
    } else {
      this.stopLoop();
    }
  };

  // ── linear wave SVG path (determinate) ───────────────────────────────────
  /**
   * Repaint the filled wave path each frame. The path is a closed filled shape
   * (top edge + right round-cap arc + bottom edge + Z) so the wave body and
   * cap are one continuous element — no coordinate-space mismatch possible.
   */
  private updateLinearPath() {
    if (!(this.wave && this.variant === 'linear' && !this.indeterminate)) return;
    if (!this.linearWaveRef) return;
    // Use the cached width (refreshed on render + resize, not per frame) so the
    // hot loop never forces a synchronous layout. Measure lazily if not set yet.
    const W = this.linearWidth || this.measureLinearWidth();
    if (!W) return;
    // During completion wlcFrac drives the fill; otherwise use the eased
    // linearRenderFraction so the wavy path moves in sync with the flat bar.
    const frac = this.wlcPhase > 0 ? this.wlcFrac : this.linearRenderFraction;
    const fillX = frac * W;
    // RTL: progress fills from the right edge, so draw the wave at [W−fillX, W]
    // (the round leading cap then lands at W−fillX, the growing tip). LTR draws
    // at [0, fillX]. Done in JS — in the same coordinate space as the logical-
    // property track/stop — so there is no CSS transform-origin ambiguity.
    let d = '';
    if (fillX > 0) {
      // inset=true → round caps sit inside [edge, fillX] like the flat bar, so the
      // start (x=0 / RTL x=W) and the leading tip aren't sheared square by the clip.
      d = this.rtl
        ? this.buildLinearWaveSVGPath(W - fillX, W, this.amp, this.linearPhase, true)
        : this.buildLinearWaveSVGPath(0, fillX, this.amp, this.linearPhase, true);
    }
    this.linearWaveRef.setAttribute('d', d);

    // Lock the track's leading edge to the SAME eased fraction that drew the wave
    // (NOT the instant `fraction`), so the indicator↔track gap stays a constant
    // 4dp while the value animates. The flat variant achieves this by CSS-
    // transitioning the track in lockstep with the bar; the wave path is repainted
    // per-frame in JS, so its track must be driven per-frame from the same source —
    // otherwise the track jumps to the target while the wave edge eases behind it,
    // stretching the gap mid-animation. Logical `% + gap` works in LTR and RTL.
    if (this.linearWaveTrackRef) {
      const pct = +(frac * 100).toFixed(3);
      this.linearWaveTrackRef.style.setProperty(
        '--_track-start',
        pct > 0 ? `calc(${pct}% + var(--_gap))` : '0',
      );
    }
  }

  /**
   * Drive the flat linear determinate fill + track from the eased
   * linearRenderFraction (the SAME source + ease the wavy variant uses), so the
   * flat bar advances and its track recedes with identical smoothness and the two
   * variants stay perfectly in sync. Both elements have their CSS transitions
   * removed — this per-frame write is the sole animator. `% + gap` is logical, so
   * it lands correctly in LTR and RTL.
   */
  private updateLinearFlat() {
    if (!(this.variant === 'linear' && !this.wave && !this.indeterminate)) return;
    // Round to 3dp then drop trailing zeros (unary +) so settled integer values
    // read as e.g. "60%" (matching the declarative render) rather than "60.000%".
    const pct = +(this.linearRenderFraction * 100).toFixed(3);
    this.flatActiveRef?.style.setProperty('--_fill-width', `${pct}%`);
    this.flatTrackRef?.style.setProperty(
      '--_track-start',
      pct >= 100
        ? 'calc(100% + var(--_gap))'
        : pct > 0
          ? `calc(${pct}% + var(--_gap))`
          : '0',
    );
  }

  /** Draw two indeterminate wave bars each frame by reading bar-inner positions. */
  private updateLinearIndeterminate() {
    if (!(this.wave && this.variant === 'linear' && this.indeterminate)) return;
    const svgRect = this.linearWaveSvgRef?.getBoundingClientRect();
    const containerRect = svgRect ?? this.el.getBoundingClientRect();
    const W = containerRect.width;
    if (!W) return;

    const r = this.effectiveThickness / 2;
    const intervals: Array<[number, number]> = [];

    const drawBar = (barRef: HTMLDivElement | null, pathRef: SVGPathElement | null) => {
      if (!barRef || !pathRef) return;
      const br = barRef.getBoundingClientRect();
      const startX = br.left - containerRect.left;
      const endX = br.right - containerRect.left;
      if (endX - startX < 1) { pathRef.setAttribute('d', ''); return; }
      pathRef.setAttribute('d', this.buildLinearWaveSVGPath(startX, endX, this.amp, this.linearPhase));
      // Widen by r so the round caps don't leave a sliver of track showing.
      intervals.push([startX - r, endX + r]);
    };
    drawBar(this.indetBar1Ref, this.indetPath1Ref);
    drawBar(this.indetBar2Ref, this.indetPath2Ref);

    // Punch the bar x-ranges out of the track so it's hidden under each bar
    // but stays visible (track colour) everywhere else.
    if (this.indetTrackRef) {
      const mask = this.buildTrackMask(intervals, W);
      this.indetTrackRef.style.setProperty('-webkit-mask-image', mask);
      this.indetTrackRef.style.setProperty('mask-image', mask);
    }
  }

  /**
   * Build a horizontal mask gradient: opaque (track visible) outside the given
   * x-intervals, transparent (track hidden) inside them. Intervals are merged so
   * overlapping bars produce valid, monotonically-increasing gradient stops.
   */
  private buildTrackMask(intervalsPx: Array<[number, number]>, W: number): string {
    const pcts = intervalsPx
      .map(([s, e]) => [
        Math.max(0, Math.min(100, (s / W) * 100)),
        Math.max(0, Math.min(100, (e / W) * 100)),
      ] as [number, number])
      .filter(([s, e]) => e > s)
      .sort((a, b) => a[0] - b[0]);

    const merged: Array<[number, number]> = [];
    for (const [s, e] of pcts) {
      const last = merged[merged.length - 1];
      if (last && s <= last[1]) last[1] = Math.max(last[1], e);
      else merged.push([s, e]);
    }
    if (!merged.length) return 'none';

    const stops: string[] = [];
    let cursor = 0;
    for (const [s, e] of merged) {
      stops.push(
        `#fff ${cursor.toFixed(2)}%`,
        `#fff ${s.toFixed(2)}%`,
        `transparent ${s.toFixed(2)}%`,
        `transparent ${e.toFixed(2)}%`,
        `#fff ${e.toFixed(2)}%`,
      );
      cursor = e;
    }
    stops.push(`#fff ${cursor.toFixed(2)}%`, `#fff 100%`);
    return `linear-gradient(to right, ${stops.join(', ')})`;
  }

  /**
   * Closed filled wave path spanning [startX, endX] with a round cap on each end.
   * Loop: left cap (CCW) → bottom edge L→R → right cap (CCW) → top edge R→L → Z.
   *
   * inset=true (determinate): the caps are pulled INWARD so the rounded ends sit
   * inside the fill bounds — the wave body spans [startX+r, endX−r] and each cap
   * bulges out to reach exactly startX / endX, like the flat bar's border-radius.
   * Without this the caps bulge PAST the edges (to startX−r / endX+r), where the
   * container's overflow:hidden and the SVG's own clip shear them into square ends
   * (most visible at 0 % start and ~100 %, where the ends sit at the viewport edge).
   * inset=false (indeterminate): caps bulge outward from [startX, endX]; the moving
   * bars live mid-track and their cap overhang is hidden by the track mask widening.
   */
  private buildLinearWaveSVGPath(
    startX: number,
    endX: number,
    amp: number,
    phase: number,
    inset = false,
  ): string {
    if (endX <= startX) return '';
    const h = this.linearWaveHeight;
    const cy = h / 2;
    const wl = this.resolvedWavelength;
    const r = this.effectiveThickness / 2;

    // Cap centres: inset by r (caps reach the true edges) or at the edges (caps
    // bulge beyond). The wave body is sampled between the cap centres.
    const bodyStart = inset ? startX + r : startX;
    const bodyEnd = inset ? endX - r : endX;

    // Scale amplitude to zero when the fill body is shorter than one wavelength so
    // small fills emerge as a flat dot/pill rather than a partial sine comma. The wave
    // grows in naturally as the fill lengthens past one wavelength.
    const bodyLen = Math.max(0, bodyEnd - bodyStart);
    const A = amp * this.resolvedAmplitude * Math.min(1, bodyLen / wl);

    // Inset fill shorter than one cap-to-cap band (≤ thickness): the two caps would
    // cross, so render a single growing round dot centred in the fill. Progress then
    // emerges as a dot that grows to full thickness, rather than a clipped nub.
    if (inset && bodyEnd <= bodyStart) {
      const cx = (startX + endX) / 2;
      const rr = (endX - startX) / 2;
      return (
        `M ${(cx - rr).toFixed(2)} ${cy.toFixed(2)} ` +
        `a ${rr.toFixed(2)} ${rr.toFixed(2)} 0 1 0 ${(2 * rr).toFixed(2)} 0 ` +
        `a ${rr.toFixed(2)} ${rr.toFixed(2)} 0 1 0 ${(-2 * rr).toFixed(2)} 0 Z`
      );
    }

    // Sample ~8 points per wavelength. Catmull-Rom smooths between them, so this
    // reproduces the sine cleanly while building ~2.5× fewer bézier segments per
    // frame than the previous fixed 1-point-per-2px sampling (a hot-loop cost).
    const steps = Math.max(8, Math.round(((bodyEnd - bodyStart) / wl) * WAVE_SAMPLES_PER_WL));

    const bot: Array<[number, number]> = [];
    const top: Array<[number, number]> = [];
    for (let i = 0; i <= steps; i++) {
      const x = bodyStart + ((bodyEnd - bodyStart) * i) / steps;
      const wy = cy - A * Math.sin((2 * Math.PI * x) / wl + phase);
      bot.push([x, wy + r]);
      top.unshift([x, wy - r]);
    }

    const lw = cy - A * Math.sin((2 * Math.PI * bodyStart) / wl + phase);
    const rw = cy - A * Math.sin((2 * Math.PI * bodyEnd) / wl + phase);

    const start    = `M ${bodyStart.toFixed(2)} ${(lw - r).toFixed(2)}`;
    const leftCap  = `A ${r.toFixed(2)} ${r.toFixed(2)} 0 0 0 ${bodyStart.toFixed(2)} ${(lw + r).toFixed(2)}`;
    const botPath  = catmullRom(bot).replace(/^M \S+ \S+ /, '');
    const rightCap = `A ${r.toFixed(2)} ${r.toFixed(2)} 0 0 0 ${bodyEnd.toFixed(2)} ${(rw - r).toFixed(2)}`;
    const topPath  = catmullRom(top).replace(/^M \S+ \S+ /, '');

    return `${start} ${leftCap} ${botPath} ${rightCap} ${topPath} Z`;
  }

  // ── linear wave mask (data-URL stroked sine, one wavelength tile) ─────────
  private updateLinearMask() {
    if (!(this.wave && this.variant === 'linear')) return;
    const s = this.el?.style;
    if (!s) return;
    s.setProperty('--_wave-mask', this.buildLinearMask(this.amp));
  }

  private buildLinearMask(amp: number): string {
    const wl = this.resolvedWavelength;
    const t = this.resolvedWaveStroke;
    const h = this.linearWaveHeight;
    const cy = h / 2;
    const A = amp * this.resolvedAmplitude;
    // Build a CLOSED FILLED band instead of a stroked open path. A stroked path
    // clips its round caps at the SVG tile boundary, creating visible seams where
    // adjacent tiles meet. A filled closed path has no caps and tiles seamlessly.
    // Top edge (x: 0→wl): y = cy − A·sin(2π·x/wl) − t/2
    // Bottom edge (x: wl→0): y = cy − A·sin(2π·x/wl) + t/2
    const steps = Math.max(16, Math.round(wl / 2));
    const top: Array<[number, number]> = [];
    const bot: Array<[number, number]> = [];
    for (let i = 0; i <= steps; i++) {
      const x = (wl * i) / steps;
      const wy = A * Math.sin((2 * Math.PI * x) / wl);
      top.push([x, cy - wy - t / 2]);
      bot.unshift([x, cy - wy + t / 2]);
    }
    const topPath = catmullRom(top);
    // Continue from the top edge endpoint into the bottom edge (L instead of M).
    const botPath = catmullRom(bot).replace(/^M \S+ \S+/, `L ${bot[0][0].toFixed(2)} ${bot[0][1].toFixed(2)}`);
    const d = `${topPath} ${botPath} Z`;
    const svg =
      `<svg xmlns='http://www.w3.org/2000/svg' width='${wl}' height='${h}' viewBox='0 0 ${wl} ${h}'>` +
      `<path d='${d}' fill='black'/></svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  }

  // ── circular geometry ─────────────────────────────────────────────────────
  private get circularRadius(): number {
    // Reserve the wave amplitude so travelling crests stay inside the viewBox
    // (the non-root SVG clips overflow); floor positive so thickness >= size
    // can't produce a degenerate / NaN geometry.
    const base = (this.resolvedSize - this.effectiveThickness) / 2 - (this.wave ? this.resolvedAmplitude : 0);
    return Math.max(0.5, base);
  }

  /** Number of waves around the ring — snapped to an integer so it closes. */
  private get circularVertices(): number {
    const r = this.circularRadius;
    const wl = this.resolvedWavelength;
    return Math.max(MIN_CIRCULAR_VERTICES, Math.round((2 * Math.PI * r) / wl));
  }

  /** Build a wavy (or, at amp 0, plain) arc centerline path. */
  private wavyArcPath(a0: number, a1: number, amp: number, phase: number): string {
    const cx = this.resolvedSize / 2;
    const cy = this.resolvedSize / 2;
    const r = this.circularRadius;
    const n = this.circularVertices;
    const A = amp * this.resolvedAmplitude;
    const span = a1 - a0;
    const steps = Math.max(8, Math.ceil((Math.abs(span) / (2 * Math.PI)) * n * 8));
    const pts: Array<[number, number]> = [];
    for (let i = 0; i <= steps; i++) {
      const th = a0 + span * (i / steps);
      const rr = r + A * Math.cos(n * th - phase);
      pts.push([cx + rr * Math.cos(th), cy + rr * Math.sin(th)]);
    }
    return catmullRom(pts);
  }

  /** Plain circular arc (used for the track). */
  private arcPath(a0: number, a1: number): string {
    const cx = this.resolvedSize / 2;
    const cy = this.resolvedSize / 2;
    const r = this.circularRadius;
    const large = Math.abs(a1 - a0) > Math.PI ? 1 : 0;
    const sweep = a1 > a0 ? 1 : 0;
    const x0 = cx + r * Math.cos(a0);
    const y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1);
    const y1 = cy + r * Math.sin(a1);
    return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${large} ${sweep} ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  }

  /**
   * Compute the wavy active + track arc paths for a given sweep fraction.
   * Shared by the declarative render (initial/SSR paint) and the rAF loop so
   * both stay perfectly in sync as the sweep eases and the wave travels.
   */
  private circularPaths(
    frac: number,
    amp: number,
    phase: number,
    indeterminate: boolean,
    sweep?: number,
  ): { active: string; track: string } {
    const start = -Math.PI / 2; // 12 o'clock
    const t = this.effectiveThickness;
    const r = this.circularRadius;
    const a1 = start + (indeterminate ? sweep ?? CIRCULAR_INDET_MIN : frac) * 2 * Math.PI;
    const active = a1 - start < 1e-4 ? '' : this.wavyArcPath(start, a1, amp, phase);

    let track: string;
    if (!indeterminate && frac > 0 && frac < 1) {
      // Determinate mid-progress: arc behind the gap after the active end.
      // Use the current animated amplitude (amp · resolvedAmplitude) so the
      // gap scales with the wave as it tweens in/out, matching indeterminate.
      const gapAng = (GAP_DP + t + amp * this.resolvedAmplitude) / r;
      const trackStart = a1 + gapAng;
      const trackEnd = start + 2 * Math.PI - gapAng;
      // If progress is so high that trackEnd ≤ trackStart, the remaining arc
      // fits entirely inside the gap — hide the track rather than showing the
      // full ring (which would sit flush against the active arc with no gap).
      track = trackEnd > trackStart ? this.arcPath(trackStart, trackEnd) : '';
    } else if (!indeterminate) {
      // 0 % or 100 %: full ring track.
      track = this.arcPath(start, start + 2 * Math.PI - 1e-3);
    } else {
      // Indeterminate: track is computed imperatively each frame in
      // updateCircularPath() after the rotation offset is known, so the track
      // stays as the complement of the rotating arc rather than a static ring.
      track = '';
    }
    return { active, track };
  }

  /**
   * Paint a frame of the circular completion sequence (flat or wavy), driven by
   * ccFrac (fill) / ccErase (erase). Sets SVG attributes directly so no Stencil
   * re-render is involved. The track is hidden throughout so the erasing ring is
   * the only thing visible and the indicator ends up completely empty.
   */
  private paintCircularCompletion() {
    const start = -Math.PI / 2; // 12 o'clock
    // Fill grows the arc to [0, ccFrac]. Erase removes it FROM THE BEGINNING: the
    // visible arc is [ccErase, 1], so the 12 o'clock start goes invisible first and
    // the disappearance progresses clockwise — "starts from the beginning to become
    // progressively invisible". Round caps are kept throughout so the head/tail stay
    // rounded (the "restart at ~75%" was a keyless-reconciliation bug, now keyed —
    // it was never the round cap, so no need for a butt cap here).
    const erasing = this.ccPhase === 3;
    const a0frac = erasing ? this.ccErase : 0;
    const a1frac = erasing ? 1 : this.ccFrac;
    const span = a1frac - a0frac;

    // Fade the final sliver out smoothly: once the visible arc is shorter than the
    // stroke width its two round caps merge into an unstable dot at the 12 o'clock
    // seam, so ramp opacity to 0 over that last stretch instead of drawing it.
    const C = 2 * Math.PI * this.circularRadius;
    const fadeSpan = C > 0 ? this.effectiveThickness / C : 0.04;
    const endOpacity = !erasing
      ? 1
      : span <= 1e-4
        ? 0
        : span < fadeSpan
          ? Math.max(0, span / fadeSpan)
          : 1;

    const a0 = start + a0frac * 2 * Math.PI;
    const a1 = start + a1frac * 2 * Math.PI;

    if (this.wave) {
      const active = span < 1e-4 ? '' : this.wavyArcPath(a0, a1, this.amp, this.phase);
      if (this.activeRef) {
        this.activeRef.style.opacity = endOpacity >= 1 ? '' : `${endOpacity}`;
        this.activeRef.setAttribute('d', active);
      }
      this.trackRef?.setAttribute('d', ''); // hide track during completion
    } else {
      // Flat completion is drawn as an explicit arc <path> (exact endpoint geometry,
      // round caps) — the SAME approach as the wavy variant, just with zero amplitude
      // (a plain arc). Drawing it this way means the shrinking head moves smoothly,
      // instead of the jitter an animated stroke-dashoffset on a <circle> produces as
      // the dash boundary is re-rasterized each frame.
      const d = span < 1e-4 ? '' : this.wavyArcPath(a0, a1, 0, this.phase);
      if (this.circularFlatCompleteRef) {
        this.circularFlatCompleteRef.style.opacity = endOpacity >= 1 ? '' : `${endOpacity}`;
        this.circularFlatCompleteRef.setAttribute('d', d);
      }
      // Hide the dashed determinate active circle; the path is the only active part.
      if (this.activeCircleRef) this.activeCircleRef.style.opacity = '0';
      // Track stays hidden through the whole fill + erase — nothing should show
      // alongside the disappearing line. It is faded in AFTERWARDS, once the line is
      // fully gone, by the Phase-4 reveal in the frame loop. (Kept a full ring, ready
      // to reveal.)
      if (this.circularFlatTrackRef) {
        const tr = this.circularFlatTrackRef;
        tr.removeAttribute('stroke-dasharray');
        tr.removeAttribute('stroke-dashoffset');
        tr.style.opacity = '0';
      }
    }
  }

  /** Completion arc `d` for the flat variant's path, computed from the current cc
   *  state. Used by the initial completion render so the path is never momentarily
   *  empty (which would flash) before the rAF loop takes over the imperative paint. */
  private get flatCompletionD(): string {
    if (this.ccPhase === 0) return '';
    const start = -Math.PI / 2;
    const erasing = this.ccPhase === 3;
    const a0frac = erasing ? this.ccErase : 0;
    const a1frac = erasing ? 1 : this.ccFrac;
    if (a1frac - a0frac < 1e-4) return '';
    return this.wavyArcPath(start + a0frac * 2 * Math.PI, start + a1frac * 2 * Math.PI, 0, this.phase);
  }

  /** Imperatively repaint the wavy circular arcs (+ rotation) each frame. */
  private updateCircularPath() {
    if (!(this.wave && this.variant === 'circular')) return;
    const sweep = this.indeterminate ? this.indeterminateSweep() : undefined;
    const { active, track } = this.circularPaths(
      this.renderFraction,
      this.amp,
      this.phase,
      this.indeterminate,
      sweep,
    );
    this.activeRef?.setAttribute('d', active);

    if (this.indeterminate) {
      const rot = this.indeterminateRotation();
      const cx = this.resolvedSize / 2;
      this.rotRef?.setAttribute('transform', `rotate(${rot.toFixed(2)} ${cx} ${cx})`);

      // The active arc lives inside rotRef and rotates with it.  The track is
      // outside rotRef and must be positioned as the angular complement of the
      // arc in SCREEN SPACE, so we offset by the current rotation.
      const rotRad = (rot * Math.PI) / 180;
      const r = this.circularRadius;
      const gapAng = (GAP_DP + this.effectiveThickness + this.amp * this.resolvedAmplitude) / r;
      const start = -Math.PI / 2;
      const arcSpan = (sweep ?? CIRCULAR_INDET_MIN) * 2 * Math.PI;
      const arcEndScreen   = start + rotRad + arcSpan;
      const arcStartScreen = start + rotRad;
      const trackStart = arcEndScreen   + gapAng;
      const trackEnd   = arcStartScreen + 2 * Math.PI - gapAng;
      this.trackRef?.setAttribute('d', trackEnd > trackStart
        ? this.arcPath(trackStart, trackEnd)
        : '');
    } else {
      this.trackRef?.setAttribute('d', track);
    }
  }

  /**
   * Drive the flat (non-wave) circular determinate active arc + track from the eased
   * renderFraction (the SAME source the wavy variant uses) so both repaint in
   * lockstep: the track recedes exactly as the active arc grows and disappears the
   * instant the arc catches it — no early unmount — and the final sub-stroke sliver
   * fades via opacity rather than popping (round caps paint a dot at zero dash
   * length). The active + track CSS transitions are removed (transition:none) so
   * this per-frame write is the sole animator (mirrors updateLinearFlat).
   */
  private updateCircularFlat() {
    if (!(this.variant === 'circular' && !this.wave && !this.indeterminate)) return;
    if (this.ccPhase > 0 || this._completedTrack) return; // completion / terminal track ring owns the geometry
    const f = this.renderFraction;
    const r = this.circularRadius;
    const C = 2 * Math.PI * r;
    const t = this.effectiveThickness;
    const idealGap = C > 0 ? (GAP_DP + t) / C : 0;

    // Active arc spans [0, f] from 12 o'clock; full ring (no dash) at ≥100%.
    const active = this.activeCircleRef;
    if (active) {
      if (f >= 1 - 1e-4) active.removeAttribute('stroke-dasharray');
      else active.setAttribute('stroke-dasharray', `${f.toFixed(4)} 1`);
    }

    // Track: full ring at 0%; a gapped arc [f+gap, 1−gap] mid-progress; hidden once
    // the remaining arc no longer fits both 4dp gaps. The last sliver (shorter than
    // the round-cap dot ≈ one stroke width) fades out via opacity so it never pops.
    const tr = this.circularFlatTrackRef;
    if (tr) {
      if (f <= 1e-4) {
        tr.removeAttribute('stroke-dasharray');
        tr.removeAttribute('stroke-dashoffset');
        tr.style.opacity = '';
      } else if (f >= 1 - 1e-4) {
        // Active is a full ring covering everything — keep the track hidden.
        tr.style.opacity = '0';
      } else {
        const trackFrac = 1 - f - 2 * idealGap;
        // Below ≈one stroke width a dashed round-cap arc renders as an unstable dot
        // that drifts/twitches as the dash shrinks and the offset moves each frame
        // (the "jumpy tail" near 12 o'clock). So once the sliver reaches that size,
        // FREEZE its geometry — a fixed-length segment pinned at the tail (the end at
        // 1−gap, nearest 12 o'clock) — and fade ONLY its opacity to 0. The frozen
        // segment is continuous with the normal one at the threshold (both occupy
        // [1−gap−fadeSpan, 1−gap] there), so there's no seam when it locks.
        const fadeSpan = C > 0 ? t / C : 0.04;
        if (trackFrac <= 1e-4) {
          tr.style.opacity = '0';
        } else if (trackFrac < fadeSpan) {
          tr.style.opacity = Math.max(0, trackFrac / fadeSpan).toFixed(3);
          tr.setAttribute('stroke-dasharray', `${fadeSpan.toFixed(4)} 1`);
          tr.setAttribute('stroke-dashoffset', `${(-(1 - idealGap - fadeSpan)).toFixed(4)}`);
        } else {
          tr.style.opacity = '';
          tr.setAttribute('stroke-dasharray', `${trackFrac.toFixed(4)} 1`);
          tr.setAttribute('stroke-dashoffset', `${(-(f + idealGap)).toFixed(4)}`);
        }
      }
    }
  }

  /** Compose expressive sweep: 0.1 → 0.87 (at 3s) → 0.1 (at 6s). */
  private indeterminateSweep(): number {
    if (this.indetStartTs < 0) this.indetStartTs = this.lastTs;
    const t = ((this.lastTs - this.indetStartTs) % CIRCULAR_INDET_CYCLE) / CIRCULAR_INDET_CYCLE;
    const range = CIRCULAR_INDET_MAX - CIRCULAR_INDET_MIN;
    if (t < 0.5) return CIRCULAR_INDET_MIN + range * EASE_STANDARD(t / 0.5);
    return CIRCULAR_INDET_MAX - range * EASE_STANDARD((t - 0.5) / 0.5);
  }

  /**
   * Smooth, monotonic rotation (~1440°/cycle = the 1080° global rotation plus
   * the +360° stepped accumulation), wrapped to [0,360) so it advances forward
   * and never snaps backward at the cycle boundary.
   */
  private indeterminateRotation(): number {
    if (this.indetStartTs < 0) this.indetStartTs = this.lastTs;
    const elapsed = this.lastTs - this.indetStartTs;
    return ((CIRCULAR_GLOBAL_ROTATION + 360) * (elapsed / CIRCULAR_INDET_CYCLE)) % 360;
  }

  // ── render helpers ─────────────────────────────────────────────────────────
  /** Sanitized maximum — always a finite, positive number for valid ARIA. */
  private get ariaValueMax(): number {
    return Number.isFinite(this.max) && this.max > 0 ? this.max : 0;
  }

  private get ariaValueNow(): number | undefined {
    // M3 / Material Web report the raw value (not a 0–100 percentage); clamp
    // into [0, max] so the announced value stays a valid ARIA range value.
    if (this.indeterminate) return undefined;
    const n = Math.min(this.ariaValueMax, Math.max(0, this.value));
    return Number.isFinite(n) ? n : 0;
  }

  private renderLinear() {
    return this.indeterminate ? this.renderLinearIndeterminate() : this.renderLinearDeterminate();
  }

  private renderLinearDeterminate() {
    // fillPct drives --_fill-width: jumps to 100 immediately so the CSS transition
    // animates the bar to full. pct controls track/stop visibility: always uses
    // the real fraction so the track and stop dot stay in place while the bar
    // travels — the scaleY collapse hides everything together.
    const fillPct = (this._fillComplete || this._completing) ? 100 : this.fraction * 100;
    const pct = this.fraction * 100;
    const hasProgress = fillPct > 0;

    if (this.wave) {
      // Wave mode: a single SVG filled path covers both the wave body and the
      // round cap — both live in the same coordinate space so there is no
      // pixel-rounding mismatch between the body edge and the cap circle.
      return (
        <div class="md-progress-indicator__linear" aria-hidden="true" onAnimationEnd={this.onLinearAnimEnd}>
          {pct < 100 && (
            <div
              class="md-progress-indicator__track"
              part="track"
              ref={(el) => { this.linearWaveTrackRef = el as HTMLDivElement; }}
              style={{
                // Same formula as the flat linear — gap from the nominal fill edge.
                // Adding thickness/2 on top made the visual gap feel larger than
                // the flat's 4dp because the eye reads the wave end as the last
                // full-height section, not the tapered cap tip.
                // This declarative value is the steady-state / SSR position; while
                // the value animates, updateLinearPath() overrides it per-frame from
                // the eased fraction so the track tracks the wave's leading edge and
                // the gap stays a constant 4dp (see updateLinearPath).
                '--_track-start': hasProgress
                  ? `calc(${pct}% + var(--_gap))`
                  : '0',
              }}
            />
          )}
          <div class="md-progress-indicator__stop" part="stop-indicator" />
          {/* Always rendered; the path is empty at 0 % and grows with the fill,
              so it emerges from the leading edge rather than popping in as a dot. */}
          <svg
            class="md-progress-indicator__linear-wave-svg"
            width="100%"
            aria-hidden="true"
            ref={(el) => { this.linearWaveSvgRef = el as SVGSVGElement; }}
          >
            <path
              class="md-progress-indicator__linear-wave-path"
              part="active-indicator"
              ref={(el) => { this.linearWaveRef = el as SVGPathElement; }}
            />
          </svg>
        </div>
      );
    }

    return (
      <div class="md-progress-indicator__linear" aria-hidden="true" onAnimationEnd={this.onLinearAnimEnd}>
        {/* Always rendered (even at 0 %): the fill grows out of the leading edge
            rather than popping in as a dot. The width is rAF-driven per-frame by
            updateLinearFlat() (shared ease with the wavy variant); these declarative
            values are the steady-state / SSR fallback. */}
        <div
          class="md-progress-indicator__active"
          part="active-indicator"
          ref={(el) => { this.flatActiveRef = el as HTMLDivElement; }}
          style={{ '--_fill-width': `${fillPct}%` }}
        />

        {/* Always rendered: as the bar grows, --_track-start follows it (+gap) so
            the track recedes in lockstep and slides off at 100%. updateLinearFlat()
            drives both per-frame from the same eased fraction as the bar, so the
            4dp gap stays constant and the flat variant moves identically to wavy. */}
        <div
          class="md-progress-indicator__track md-progress-indicator__track--determinate"
          part="track"
          ref={(el) => { this.flatTrackRef = el as HTMLDivElement; }}
          style={{
            // No min() here: a min()/max() inside the calc makes the browser fall
            // back to DISCRETE interpolation of inset-inline-start, so the track
            // jumps each value update (jitter). A plain `% + px` stays in lockstep
            // with the active fill. (Steady-state / SSR fallback; the rAF loop
            // overrides this per-frame while the value animates.)
            '--_track-start': fillPct >= 100
              ? 'calc(100% + var(--_gap))'
              : hasProgress
                ? `calc(${pct}% + var(--_gap))`
                : '0',
          }}
        />

        <div class="md-progress-indicator__stop" part="stop-indicator" />
      </div>
    );
  }

  private renderLinearIndeterminate() {
    if (this.wave && !this.reducedMotion) {
      // Wave indeterminate: JS draws both bars as filled SVG paths each rAF frame.
      // Ghost bar divs drive the CSS position/scale animations so we can read their
      // bounding rects; the SVG overlay renders the actual wavy shapes with round caps.
      return (
        <div class="md-progress-indicator__linear" aria-hidden="true">
          {/* Track is visible in the gaps; updateLinearIndeterminate() masks out
              the x-range under each bar every frame so the clean wave floats over
              a hidden segment instead of overlapping a straight track line. */}
          <div
            class="md-progress-indicator__track md-progress-indicator__track--full"
            part="track"
            ref={(el) => { this.indetTrackRef = el as HTMLDivElement; }}
          />
          <div class="md-progress-indicator__bar md-progress-indicator__bar--primary">
            <div
              class="md-progress-indicator__bar-inner md-progress-indicator__bar-inner--ghost"
              ref={(el) => { this.indetBar1Ref = el as HTMLDivElement; }}
            />
          </div>
          <div class="md-progress-indicator__bar md-progress-indicator__bar--secondary">
            <div
              class="md-progress-indicator__bar-inner md-progress-indicator__bar-inner--ghost"
              ref={(el) => { this.indetBar2Ref = el as HTMLDivElement; }}
            />
          </div>
          <svg
            class="md-progress-indicator__linear-wave-svg"
            width="100%"
            aria-hidden="true"
            ref={(el) => { this.linearWaveSvgRef = el as SVGSVGElement; }}
          >
            <path
              class="md-progress-indicator__linear-wave-path"
              ref={(el) => { this.indetPath1Ref = el as SVGPathElement; }}
            />
            <path
              class="md-progress-indicator__linear-wave-path"
              ref={(el) => { this.indetPath2Ref = el as SVGPathElement; }}
            />
          </svg>
        </div>
      );
    }

    // Flat or reduced-motion indeterminate: standard CSS two-bar motion.
    const barClass = (modifier: string) => ({
      'md-progress-indicator__bar': true,
      [`md-progress-indicator__bar--${modifier}`]: true,
      'md-progress-indicator__bar--wave': this.wave,
    });
    return (
      <div class="md-progress-indicator__linear" aria-hidden="true">
        <div class="md-progress-indicator__track md-progress-indicator__track--full" part="track" />
        <div class={barClass('primary')} part="active-indicator">
          <div class="md-progress-indicator__bar-inner" />
        </div>
        <div class={barClass('secondary')}>
          <div class="md-progress-indicator__bar-inner" />
        </div>
      </div>
    );
  }

  private renderCircular() {
    return this.wave ? this.renderCircularWave() : this.renderCircularFlat();
  }

  private renderCircularFlat() {
    const sz = this.resolvedSize;
    const t = this.effectiveThickness;
    const r = this.circularRadius;
    const center = sz / 2;
    const f = this.fraction;
    const C = 2 * Math.PI * r;
    const idealGap = C > 0 ? (GAP_DP + t) / C : 0;
    const showGap = f > 0 && f < 1;
    // Track = the leftover arc after a constant idealGap is removed at each end:
    // trackFrac = remaining − 2·gap. Constant gap → the active end (f) and the track
    // start (f + gap) move in perfect lockstep, so the 4dp gap never stretches. These
    // are the steady-state / SSR values; while the value animates updateCircularFlat()
    // overrides the dash/offset/opacity per-frame from the eased renderFraction, in
    // lockstep with the active arc (so the track recedes exactly as the arc grows and
    // its final sliver fades out instead of popping — see updateCircularFlat()).
    const trackFrac = showGap ? Math.max(0, 1 - f - 2 * idealGap) : 0;
    const trackVisible = showGap && trackFrac > 0;

    return (
      <svg class="md-progress-indicator__circular" viewBox={`0 0 ${sz} ${sz}`} aria-hidden="true">
        {/* Stable key="circ-track" pins element identity so Stencil never repurposes
            the track as the active circle (which would restart the active's dash and
            read as the fill "starting again").
            - Indeterminate: a complement arc that follows the spinning active arc,
              animated purely in CSS via md-circular-dash-track.
            - Determinate: a SINGLE always-mounted arc driven per-frame by
              updateCircularFlat() (full ring at 0 %, a gapped arc mid-progress, faded
              out near ≥86 % / 100 %). It stays mounted across the whole range so the
              rAF loop fades it smoothly — rather than the DOM yanking it to null,
              which cut the CSS transition mid-flight and popped (the bug this fixes). */}
        {this.indeterminate ? (
          <circle
            key="circ-track"
            class="md-progress-indicator__circular-track md-progress-indicator__circular-track--spinner"
            part="track"
            cx={center}
            cy={center}
            r={r}
            stroke-width={t}
            fill="none"
            pathLength={1}
            stroke-linecap="round"
            transform={`rotate(-90 ${center} ${center})`}
            ref={(el) => { this.circularFlatTrackRef = el as SVGCircleElement; }}
          />
        ) : (
          <circle
            key="circ-track"
            class="md-progress-indicator__circular-track md-progress-indicator__circular-track--determinate"
            part="track"
            cx={center}
            cy={center}
            r={r}
            stroke-width={t}
            fill="none"
            pathLength={1}
            stroke-linecap="round"
            transform={`rotate(-90 ${center} ${center})`}
            stroke-dasharray={this._completedTrack ? undefined : trackVisible ? `${trackFrac} 1` : undefined}
            stroke-dashoffset={this._completedTrack ? undefined : trackVisible ? -(f + idealGap) : undefined}
            style={
              // _completedTrack: rest on a full, visible track ring (the terminal
              // state). Otherwise hide it while completing / when it no longer fits.
              this._completedTrack
                ? undefined
                : this.ccPhase > 0 || (showGap && trackFrac <= 0)
                  ? { opacity: '0' }
                  : undefined
            }
            ref={(el) => { this.circularFlatTrackRef = el as SVGCircleElement; }}
          />
        )}
        <circle
          key="circ-active"
          class="md-progress-indicator__circular-active"
          part="active-indicator"
          cx={center}
          cy={center}
          r={r}
          stroke-width={t}
          fill="none"
          pathLength={1}
          stroke-linecap="round"
          stroke-dasharray={this.indeterminate || f >= 1 ? undefined : `${f} ${1}`}
          // During completion the dashed circle is hidden and the completion <path>
          // below draws the arc instead (so the head doesn't jitter). _completed hides
          // it before visibility:hidden lands; _completedTrack hides it for good (the
          // flat circular terminal state shows only the empty track ring).
          style={this.ccPhase > 0 || this._completed || this._completedTrack ? { opacity: '0' } : undefined}
          transform={`rotate(-90 ${center} ${center})`}
          ref={(el) => { this.activeCircleRef = el as SVGCircleElement; }}
        />
        {/* Completion-only arc, drawn as an explicit round-capped <path> (empty
            outside the completion sequence). Painted imperatively by
            paintCircularCompletion(); flatCompletionD seeds the first frame so the
            path is never momentarily empty (no flash) before the rAF loop runs. */}
        <path
          class="md-progress-indicator__circular-active-path"
          stroke-width={t}
          fill="none"
          stroke-linecap="round"
          d={this.flatCompletionD}
          ref={(el) => { this.circularFlatCompleteRef = el as SVGPathElement; }}
        />
      </svg>
    );
  }

  private renderCircularWave() {
    const sz = this.resolvedSize;
    const t = this.effectiveThickness;
    // Initial (SSR / pre-rAF) paths from the eased fraction; the rAF loop then
    // repaints both arcs in lockstep.
    const { active, track } = this.circularPaths(
      this.renderFraction,
      this.amp,
      this.phase,
      this.indeterminate,
      this.indeterminate ? CIRCULAR_INDET_MIN : undefined,
    );

    return (
      <svg class="md-progress-indicator__circular" viewBox={`0 0 ${sz} ${sz}`} aria-hidden="true">
        <path
          class="md-progress-indicator__circular-track"
          part="track"
          d={this.ccPhase > 0 ? '' : track}
          stroke-width={t}
          fill="none"
          stroke-linecap="round"
          ref={(e) => (this.trackRef = e as SVGPathElement)}
        />
        <g ref={(e) => (this.rotRef = e as SVGGElement)}>
          <path
            class="md-progress-indicator__circular-active"
            part="active-indicator"
            d={active}
            stroke-width={t}
            fill="none"
            stroke-linecap="round"
            ref={(e) => (this.activeRef = e as SVGPathElement)}
          />
        </g>
      </svg>
    );
  }

  render() {
    return (
      <Host
        class={{
          'md-progress-indicator': true,
          [`md-progress-indicator--${this.variant}`]: true,
          'md-progress-indicator--indeterminate': this.indeterminate,
          'md-progress-indicator--wave': this.wave,
          'md-progress-indicator--four-color': this.fourColor,
          'md-progress-indicator--completing': this._completing,
          'md-progress-indicator--complete': this._completed,
        }}
        role="progressbar"
        aria-label={this.label || undefined}
        aria-valuemin={0}
        aria-valuemax={this.ariaValueMax}
        aria-valuenow={this.ariaValueNow}
      >
        {this.variant === 'circular' ? this.renderCircular() : this.renderLinear()}
      </Host>
    );
  }
}

/* ── Catmull-Rom → cubic-bézier smoothing for the wavy ring path ───────────*/
function catmullRom(pts: Array<[number, number]>): string {
  if (pts.length < 2) return '';
  const d: string[] = [`M ${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d.push(
      `C ${c1x.toFixed(2)} ${c1y.toFixed(2)} ${c2x.toFixed(2)} ${c2y.toFixed(2)} ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`,
    );
  }
  return d.join(' ');
}
