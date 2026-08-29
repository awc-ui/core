import { Component, Element, h, Host, Method, Prop } from '@stencil/core';

const PRESS_GROW_MS = 450;
const RELEASE_FADE_MS = 150;
const DEFAULT_PRESS_OPACITY = 0.12;
const EASING_STANDARD = 'cubic-bezier(0.2, 0, 0, 1)';

const GROW_DURATION_PROP = '--md-ripple-grow-duration';
const GROW_EASING_PROP = '--md-ripple-grow-easing';

@Component({ tag: 'md-ripple', styleUrl: 'md-ripple.css', shadow: true })
export class MdRipple {
  @Element() el!: HTMLElement;

  @Prop() disabled: boolean = false;

  /**
   * True when ripples are switched off for this element, either globally
   * (`data-ripple="off"` on any ancestor) or on the owning component
   * (`ripple="off"`). Both spellings resolve to `--md-sys-ripple-enabled` in
   * tokens.css, so only the resolved value is read here.
   *
   * Read at interaction time rather than cached. The signal is a plain
   * inherited custom property, so it can change at any moment — a theme
   * switch, a settings toggle, a parent re-render — with no attribute mutation
   * on THIS element to observe. One getComputedStyle per press is cheap next to
   * the wave animation that follows, and it cannot go stale.
   *
   * The check is deliberately `=== '0'`: an unset property returns '' and must
   * mean ENABLED, so testing for falsiness would disable ripples everywhere the
   * token sheet has not loaded.
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

  private hostEl: HTMLElement | null = null;
  private activeWave: HTMLElement | null = null;
  private growAnimation: Animation | null = null;
  private activeOpacity: number = DEFAULT_PRESS_OPACITY;
  private bound = false;
  private settlePromise: Promise<void> | null = null;
  private settleResolve: (() => void) | null = null;

  private resolveOpacity(): number {
    if (!this.hostEl) return DEFAULT_PRESS_OPACITY;
    const raw = getComputedStyle(this.hostEl)
      .getPropertyValue('--md-ripple-opacity')
      .trim();
    if (!raw) return DEFAULT_PRESS_OPACITY;
    const parsed = parseFloat(raw);
    return Number.isFinite(parsed) ? parsed : DEFAULT_PRESS_OPACITY;
  }

  /**
   * Resolve the inline / block extents that surfaces growing during the
   * ripple's lifetime (e.g. md-search springing out on focus) declare via
   * `--md-ripple-extend-inline` / `--md-ripple-extend-block`. The values
   * inflate the host's rect ONLY for the wave's farthest-corner radius
   * calculation, so the wave is sized for the SETTLED rect even though
   * the actual host is still at its resting size at pointerdown. Wave
   * POSITION still uses the unmodified rect so the wave originates
   * exactly where the user clicked.
   *
   * Consumers MUST pass concrete pixel values here (e.g.
   * `style.setProperty('--md-ripple-extend-inline', '120px')`).
   * `getComputedStyle().getPropertyValue()` on a custom property returns
   * the LITERAL TOKEN — for `calc()` / `clamp()` / `%` expressions the
   * string is unparsed (`"calc(clamp(0px, 8%, 64px) * 2)"`) and
   * `parseFloat()` returns `NaN`. Resolving such expressions reliably
   * requires knowing the consumer's intended containing-block reference,
   * which md-ripple cannot infer; consumers therefore compute the value
   * themselves (typically with a hidden probe element scoped to the
   * correct containing block) and write it back as fixed pixels.
   */
  private resolveExtent(prop: string): number {
    const raw = getComputedStyle(this.el).getPropertyValue(prop).trim();
    if (!raw) return 0;
    const parsed = parseFloat(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }

  /**
   * Wave grow duration (ms). Surfaces that animate their size during the
   * ripple's lifetime (e.g. md-search springing from a narrower resting
   * width to its full width) should sync the wave's growth with their
   * own settle so the wave reaches scale = 1 at the same moment the
   * surface stops moving — otherwise the wave is still ramping up while
   * the surface is already at its final width and the user sees a
   * visible gap on the side that grew. Default is the spec-canonical
   * 450ms.
   */
  private resolveGrowDuration(): number {
    const raw = getComputedStyle(this.el).getPropertyValue(GROW_DURATION_PROP).trim();
    if (!raw) return PRESS_GROW_MS;
    const parsed = parseFloat(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : PRESS_GROW_MS;
  }

  /**
   * Wave grow easing function. Companion to {@link resolveGrowDuration}
   * — when a surface drives the timing it should usually pass its own
   * easing (typically a back-out spring) so the wave's growth feels
   * like part of the same motion.
   */
  private resolveGrowEasing(): string {
    const raw = getComputedStyle(this.el).getPropertyValue(GROW_EASING_PROP).trim();
    return raw || EASING_STANDARD;
  }

  private beginSettle() {
    this.finishSettle();
    this.settlePromise = new Promise<void>((resolve) => {
      this.settleResolve = resolve;
    });
  }

  private finishSettle() {
    this.settleResolve?.();
    this.settleResolve = null;
    this.settlePromise = null;
  }

  /** Resolves when the active press ripple has fully faded out. */
  @Method()
  async whenSettled(): Promise<void> {
    if (!this.settlePromise) return;
    const maxWait = new Promise<void>((resolve) => {
      setTimeout(resolve, RELEASE_FADE_MS + 50);
    });
    await Promise.race([this.settlePromise, maxWait]);
    this.finishSettle();
  }

  /**
   * An ancestor with `display: contents` generates NO BOX, and a box is the
   * whole of what this element needs from its host.
   *
   * Two things break when the wave is anchored to one. Its client rect is an
   * empty 0×0 at the viewport origin, so the farthest-corner radius and the
   * wave's offset are computed in the wrong coordinate space entirely — a
   * 56px destination produced a 520px wave centred 200px below itself. And it
   * can never be a hit target, so `pointerdown` only reaches a listener bound
   * there when the press lands on a painted DESCENDANT; a press on the
   * surface's own padding (or on any `pointer-events: none` child, which is
   * what an active-indicator pill and an icon wrapper are) targets the shadow
   * host instead, whose event path does not include this element at all, and
   * no wave is created.
   *
   * `md-navigation-rail-tab` is exactly this shape: with `href` set it wraps
   * its whole shadow tree — ripple included — in a `display: contents` anchor,
   * because the host is the flex container and a real box there would collapse
   * the layout.
   */
  private generatesNoBox(node: HTMLElement): boolean {
    if (typeof getComputedStyle !== 'function') return false;
    try {
      return getComputedStyle(node).display === 'contents';
    } catch {
      return false;
    }
  }

  /**
   * The surface this ripple decorates.
   *
   * `parentElement` stays the starting point rather than jumping straight to
   * the shadow host: a component may render more than one ripple, and each
   * must ripple its OWN half (md-split-button's leading and trailing buttons).
   * Those wrappers are real boxes, so the walk below stops on the first step
   * and their behaviour is unchanged. Only a box-less ancestor is skipped —
   * see {@link generatesNoBox} — and when the chain runs out of elements it
   * has left the shadow tree, so the shadow host is the surface.
   */
  private resolveHost(): HTMLElement | null {
    const root = this.el.getRootNode();
    let node: HTMLElement | null = this.el.parentElement;
    while (node && this.generatesNoBox(node)) node = node.parentElement;
    return node ??
      (root instanceof ShadowRoot ? (root.host as HTMLElement) : null);
  }

  private bind() {
    if (this.bound) return;
    this.hostEl = this.resolveHost();
    if (!this.hostEl) return;
    this.bound = true;
    this.hostEl.addEventListener('pointerdown', this.onPointerDown);
  }

  connectedCallback() {
    this.bind();
    if (!this.bound) {
      queueMicrotask(() => this.bind());
    }
  }

  disconnectedCallback() {
    this.hostEl?.removeEventListener('pointerdown', this.onPointerDown);
    this.hostEl = null;
    this.bound = false;
  }

  private onPointerDown = (e: PointerEvent) => {
    if (this.disabled || this.rippleSuppressed()) return;

    const container = this.el.shadowRoot?.querySelector('.md-ripple') as HTMLElement;
    if (!container || !this.hostEl) return;

    this.endWave();

    const rect = this.hostEl.getBoundingClientRect();
    // Treat the surface as if it spans an extended rect when the host has
    // declared `--md-ripple-extend-inline` / `--md-ripple-extend-block`.
    // Wave POSITION still uses the actual (current) rect so the wave
    // visually originates at the click point — only the RADIUS uses the
    // inflated bounds so the wave grows large enough to cover the surface
    // once it settles.
    const extendInline = this.resolveExtent('--md-ripple-extend-inline');
    const extendBlock = this.resolveExtent('--md-ripple-extend-block');
    const left = rect.left - extendInline;
    const right = rect.right + extendInline;
    const top = rect.top - extendBlock;
    const bottom = rect.bottom + extendBlock;
    const dx = Math.max(Math.abs(e.clientX - left), Math.abs(e.clientX - right));
    const dy = Math.max(Math.abs(e.clientY - top), Math.abs(e.clientY - bottom));
    const radius = Math.sqrt(dx * dx + dy * dy);
    const size = radius * 2;
    const x = e.clientX - rect.left - radius;
    const y = e.clientY - rect.top - radius;

    const wave = document.createElement('span');
    wave.classList.add('md-ripple__wave');
    wave.style.width = wave.style.height = `${size}px`;
    wave.style.left = `${x}px`;
    wave.style.top = `${y}px`;
    container.appendChild(wave);
    this.activeWave = wave;
    this.activeOpacity = this.resolveOpacity();
    this.beginSettle();

    this.growAnimation = wave.animate(
      [
        { transform: 'scale(0)', opacity: this.activeOpacity },
        { transform: 'scale(1)', opacity: this.activeOpacity },
      ],
      {
        duration: this.resolveGrowDuration(),
        easing: this.resolveGrowEasing(),
        fill: 'forwards',
      },
    );

    window.addEventListener('pointerup', this.onRelease, { once: true });
    window.addEventListener('pointercancel', this.onRelease, { once: true });
  };

  private onRelease = () => {
    this.endWave();
  };

  private async endWave() {
    const wave = this.activeWave;
    const grow = this.growAnimation;
    if (!wave || !grow) return;

    this.activeWave = null;
    this.growAnimation = null;

    if (grow.playState !== 'finished') {
      await grow.finished;
    }

    const fade = wave.animate(
      [{ opacity: this.activeOpacity }, { opacity: 0 }],
      { duration: RELEASE_FADE_MS, easing: EASING_STANDARD, fill: 'forwards' },
    );
    try {
      if (typeof fade.finished?.then === 'function') {
        await fade.finished;
      } else {
        await new Promise<void>((resolve) => setTimeout(resolve, RELEASE_FADE_MS));
      }
    } catch {
      /* animation cancelled */
    }
    wave.remove();
    this.finishSettle();
  }

  /** Programmatically trigger a centered ripple (for keyboard activations). */
  @Method()
  async trigger() {
    if (this.disabled || this.rippleSuppressed()) return;

    if (!this.hostEl) this.hostEl = this.resolveHost();
    const container = this.el.shadowRoot?.querySelector('.md-ripple') as HTMLElement;
    if (!container || !this.hostEl) return;

    this.endWave();

    const rect = this.hostEl.getBoundingClientRect();
    const extendInline = this.resolveExtent('--md-ripple-extend-inline');
    const extendBlock = this.resolveExtent('--md-ripple-extend-block');
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    // Centered ripples use the rect's centre as both anchor and farthest
    // reference, so the inflated half-extents become the radius
    // contribution directly.
    const halfX = cx + extendInline;
    const halfY = cy + extendBlock;
    const radius = Math.sqrt(halfX * halfX + halfY * halfY);
    const size = radius * 2;

    const wave = document.createElement('span');
    wave.classList.add('md-ripple__wave');
    wave.style.width = wave.style.height = `${size}px`;
    wave.style.left = `${cx - radius}px`;
    wave.style.top = `${cy - radius}px`;
    container.appendChild(wave);
    this.activeWave = wave;
    this.activeOpacity = this.resolveOpacity();
    this.beginSettle();

    this.growAnimation = wave.animate(
      [
        { transform: 'scale(0)', opacity: this.activeOpacity },
        { transform: 'scale(1)', opacity: this.activeOpacity },
      ],
      {
        duration: this.resolveGrowDuration(),
        easing: this.resolveGrowEasing(),
        fill: 'forwards',
      },
    );

    this.growAnimation.addEventListener('finish', () => this.endWave(), { once: true });
  }

  render() {
    return (
      <Host aria-hidden="true">
        <div class="md-ripple"></div>
      </Host>
    );
  }
}
