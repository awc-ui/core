import { Component, Host, h, Prop, State, Element } from '@stencil/core';

@Component({
  tag: 'md-skeleton',
  styleUrl: 'md-skeleton.css',
  shadow: true,
})
export class MdSkeleton {
  @Element() el!: HTMLElement;

  /**
   * Shape of the skeleton placeholder.
   * - `text` — single short rectangle the height of a body line. With
   *   `lines > 1` the last line gets a tapered width so it reads as a
   *   "last line of a paragraph".
   * - `rectangular` — fills the inline + block sizes you give it; no
   *   border-radius unless you set `--md-skeleton-radius`.
   * - `rounded` — same as `rectangular` but with the MD3 medium corner
   *   radius (or your override). Good for cards / images.
   * - `circular` — perfect circle (1:1 aspect). Use for avatar / icon
   *   placeholders; set `--md-skeleton-size` or `width`+`height`.
   */
  @Prop({ reflect: true }) variant: 'text' | 'rectangular' | 'rounded' | 'circular' = 'text';

  /**
   * Animation style:
   * - `pulse` (default) — gentle opacity fade in and out.
   * - `wave` — shimmer gradient sweeps across the surface.
   * - `none` — static block; useful in `prefers-reduced-motion` opt-outs
   *   or when the skeleton is purely decorative.
   */
  @Prop({ reflect: true }) animation: 'pulse' | 'wave' | 'none' = 'pulse';

  /**
   * Number of text rows to render. Only meaningful for `variant="text"`.
   * The last row is tapered to ~60 % width so it reads as the final
   * line of a paragraph.
   */
  @Prop({ reflect: true }) lines: number = 1;

  /**
   * Inline size (CSS length). Overrides any `--md-skeleton-width`.
   * Examples: `"100%"`, `"240px"`, `"60ch"`.
   */
  @Prop() width: string = '';

  /**
   * Block size (CSS length). Defaults are `1em` for text, `120px` for
   * rectangular/rounded, and `40px` for circular.
   */
  @Prop() height: string = '';

  /**
   * Stretch to fill the parent's inline size, overriding `width` /
   * `--md-skeleton-width`. (The skeleton is already 100%-wide by default; this
   * makes it explicit and wins over a fixed width — handy in responsive grids.)
   */
  @Prop({ attribute: 'full-width', reflect: true }) fullWidth: boolean = false;

  /**
   * Stretch to fill the parent's block size — the placeholder fills its
   * container's height (which must be definite, e.g. a flex/grid cell). Best
   * with the shape variants (`rectangular` / `rounded` / `circular`); pairs with
   * `full-width` for a fully responsive block.
   */
  @Prop({ attribute: 'full-height', reflect: true }) fullHeight: boolean = false;

  /**
   * Accessible label. Defaults to "Loading…". Pass a more specific
   * label when the skeleton represents a recognisable region
   * ("Loading article") for better screen-reader context.
   */
  @Prop({ attribute: 'aria-label' }) ariaLabelProp: string = 'Loading';

  /**
   * Whether to expose the skeleton to assistive tech at all. Set to
   * `false` when the surrounding region already announces its own
   * busy state — duplicate announcements get noisy.
   */
  @Prop() announce: boolean = true;

  /**
   * Local density rung. Drives the same `--md-sys-density-scale` signal that a
   * global `data-density` ancestor sets, so a local value simply overrides the
   * inherited one. 0 = default, -4 = ultra-compact.
   */
  @Prop({ reflect: true }) density: 0 | -1 | -2 | -3 | -4 = 0;

  @State() private prefersReducedMotion: boolean = false;

  private motionQuery?: MediaQueryList;
  private motionListener?: () => void;

  componentWillLoad() {
    if (typeof window !== 'undefined' && window.matchMedia) {
      this.motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.prefersReducedMotion = this.motionQuery.matches;
    }
  }

  componentDidLoad() {
    if (!this.motionQuery) return;
    this.motionListener = () => {
      this.prefersReducedMotion = this.motionQuery!.matches;
    };
    this.motionQuery.addEventListener('change', this.motionListener);
  }

  disconnectedCallback() {
    if (this.motionQuery && this.motionListener) {
      this.motionQuery.removeEventListener('change', this.motionListener);
    }
  }

  private renderTextLines() {
    const count = Math.max(1, this.lines | 0);
    const items: Array<{ key: number; tapered: boolean }> = [];
    for (let i = 0; i < count; i++) {
      items.push({ key: i, tapered: count > 1 && i === count - 1 });
    }
    return items.map(({ key, tapered }) => (
      <span
        key={key}
        part={tapered ? 'line line-last' : 'line'}
        class={{
          'md-skeleton__line': true,
          'md-skeleton__line--tapered': tapered,
        }}
      ></span>
    ));
  }

  render() {
    const effectiveAnimation = this.prefersReducedMotion ? 'none' : this.animation;

    const inlineStyle: { [key: string]: string } = {};
    if (this.width) inlineStyle['--_w'] = this.width;
    if (this.height) inlineStyle['--_h'] = this.height;

    return (
      <Host
        class={{
          'md-skeleton': true,
          [`md-skeleton--${this.variant}`]: true,
          [`md-skeleton--anim-${effectiveAnimation}`]: true,
        }}
        role={this.announce ? 'status' : undefined}
        aria-busy={this.announce ? 'true' : undefined}
        aria-live={this.announce ? 'polite' : undefined}
        aria-label={this.announce ? this.ariaLabelProp : undefined}
        // Decorative skeletons are removed from the a11y tree entirely (and any
        // stray author-set aria-label with them), so they don't add noise.
        aria-hidden={this.announce ? undefined : 'true'}
        style={inlineStyle}
      >
        {this.variant === 'text' ? (
          this.renderTextLines()
        ) : (
          <span
            class="md-skeleton__shape"
            part="shape"
            aria-hidden="true"
          ></span>
        )}
      </Host>
    );
  }
}
