import { Component, Host, h, Prop, State, Event, EventEmitter, Element, Watch } from '@stencil/core';

/**
 * Preset size buckets. Map to MD3 reference dimensions (24/40/56px).
 */
export type MdAvatarPresetSize = 'small' | 'medium' | 'large';

/**
 * The `size` prop accepts either a named preset (`'small' | 'medium' | 'large'`)
 * or an arbitrary CSS length / unitless number for a fully-custom dimension.
 *
 *   `<md-avatar size="medium" />`  → 40 × 40
 *   `<md-avatar size="72" />`      → 72 × 72  (unitless → px)
 *   `<md-avatar size="4rem" />`    → 4rem     (any CSS length)
 *   `<md-avatar size="clamp(28px, 4vw, 72px)" />` → CSS function passes through
 *
 * The `(string & {})` intersection keeps autocomplete on the three presets
 * while still accepting any string at the type level.
 */
export type MdAvatarSize = MdAvatarPresetSize | (string & {});

export type MdAvatarShape = 'circle' | 'rounded' | 'square';

const PRESET_SIZES: ReadonlySet<string> = new Set(['small', 'medium', 'large']);

/**
 * Coerce a free-form size value into a CSS length string.
 *
 *   "72"            → "72px"
 *   "72.5"          → "72.5px"
 *   "4rem"          → "4rem"          (already a length)
 *   "min(72px,8vw)" → "min(72px,8vw)" (CSS function passes through)
 *   ""  / null      → undefined       (caller falls back to preset)
 */
function coerceCssLength(raw: string | number | null | undefined): string | undefined {
  if (raw == null) return undefined;
  const value = String(raw).trim();
  if (!value) return undefined;
  // Pure number (integer or decimal, optional sign) → px.
  if (/^-?\d*\.?\d+$/.test(value)) return `${value}px`;
  return value;
}

/**
 * `md-avatar` — a presentational identity tile that resolves the first
 * available source from a clear fallback chain:
 *
 *   1. `src` (image)  → `<img>` is rendered.
 *      On error/empty, automatically falls through to step 2.
 *   2. `initials`     → explicit initials string (verbatim, max 3 chars).
 *   3. `name`         → auto-derived initials. Two tokens → first letter
 *                       of each; one token → first letter only. RTL- and
 *                       diacritic-safe via `Intl.Segmenter` when available.
 *   4. default slot   → caller-provided fallback (icon, emoji, SVG).
 *   5. person icon    → material-symbols fallback (always available).
 */
@Component({
  tag: 'md-avatar',
  styleUrl: 'md-avatar.css',
  shadow: true,
})
export class MdAvatar {
  @Element() el!: HTMLElement;

  /** Image URL. When set, the avatar renders as an `<img>` element. */
  @Prop() src: string = '';

  /**
   * Alternative text for the image. When empty, the image is exposed to
   * AT as decorative (`aria-hidden`); the host carries the accessible
   * label instead (see `label`).
   */
  @Prop() alt: string = '';

  /**
   * Full name. The component derives initials automatically:
   *   - `"Ada Lovelace"` → `"AL"`
   *   - `"Cher"`         → `"C"`
   *   - `"  john   doe"` → `"JD"`
   *
   * Honored only when `src` is not set (or fails to load) and
   * `initials` is empty.
   */
  @Prop() name: string = '';

  /**
   * Explicit initials override. Bypasses the `name` parsing entirely.
   * Truncated to the first 3 grapheme clusters at render time so a
   * stray "WXYZ" can't blow out the layout.
   */
  @Prop() initials: string = '';

  /**
   * Avatar size. Accepts either a named preset or any CSS length.
   *
   * Presets:
   * - `small`   — 24×24 (typography: label-medium)
   * - `medium`  — 40×40 (typography: title-medium)  [default]
   * - `large`   — 56×56 (typography: title-large)
   *
   * Custom values:
   * - Unitless number → pixels (`size="72"` → 72px)
   * - Any CSS length  → passes through (`size="4rem"`, `size="10vw"`,
   *   `size="clamp(28px, 4vw, 72px)"`)
   *
   * Custom values are wired through the existing `--md-avatar-size` CSS
   * custom property, so per-instance overrides via `style` / class still
   * win when set.
   */
  @Prop({ reflect: true }) size: MdAvatarSize = 'medium';

  /**
   * Container shape.
   * - `circle`  — fully rounded (`50%`)             [default]
   * - `rounded` — `--md-sys-shape-corner-medium` (12px)
   * - `square`  — sharp corners (`0`)
   */
  @Prop({ reflect: true }) shape: MdAvatarShape = 'circle';

  /**
   * Accessible label for the avatar. When empty:
   *   - if `alt` is set, that is exposed instead
   *   - if `name` is set, that is exposed instead
   *   - otherwise the avatar is hidden from AT (`role="presentation"`)
   *     so it doesn't add noise next to a labelled control.
   */
  @Prop() label: string = '';

  /**
   * When `true` the avatar background is deterministically picked from a
   * tonal palette using the initials/name as a hash seed. When `false`,
   * the avatar uses the neutral on-surface tone.
   */
  @Prop({ attribute: 'color-from-name', reflect: true }) colorFromName: boolean = true;

  /** `<img>` `loading` attribute. */
  @Prop() loading: 'eager' | 'lazy' = 'lazy';

  /** `<img>` `crossorigin` attribute (forwarded only when set). */
  @Prop() crossorigin: '' | 'anonymous' | 'use-credentials' = '';

  /**
   * Local density rung. Drives the same `--md-sys-density-scale` signal that a
   * global `data-density` ancestor sets, so a local value simply overrides the
   * inherited one. 0 = default, -4 = ultra-compact.
   */
  @Prop({ reflect: true }) density: 0 | -1 | -2 | -3 | -4 = 0;

  /** Image successfully loaded. */
  @Event() mdLoad: EventEmitter<{ src: string }>;

  /** Image failed to load — component fell back to initials/icon. */
  @Event() mdError: EventEmitter<{ src: string }>;

  /** Internal: whether the image src failed (triggers fallback). */
  @State() private imageFailed = false;

  @Watch('src')
  onSrcChange() {
    this.imageFailed = false;
  }

  private computeInitials(): string {
    if (this.initials) return this.truncate(this.initials.trim());

    const name = (this.name || '').trim();
    if (!name) return '';

    const tokens = name.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return '';

    if (tokens.length === 1) {
      return this.firstGrapheme(tokens[0]).toLocaleUpperCase();
    }

    const first = this.firstGrapheme(tokens[0]);
    const last = this.firstGrapheme(tokens[tokens.length - 1]);
    return (first + last).toLocaleUpperCase();
  }

  /** First grapheme cluster, RTL- and emoji-safe when Intl.Segmenter is present. */
  private firstGrapheme(text: string): string {
    if (!text) return '';
    const segments = this.segmentGraphemes(text, 1);
    return segments[0] ?? text.charAt(0);
  }

  private truncate(text: string): string {
    const out = this.segmentGraphemes(text, 3);
    if (out.length > 0) return out.join('').toLocaleUpperCase();
    return text.slice(0, 3).toLocaleUpperCase();
  }

  /**
   * Yields up to `max` grapheme clusters from `text`. Uses Intl.Segmenter
   * when available (every evergreen browser since 2022); falls back to
   * `charAt` on the off chance the runtime lacks it.
   */
  private segmentGraphemes(text: string, max: number): string[] {
    interface SegLike {
      segment(input: string): Iterable<{ segment: string }>;
    }
    interface SegCtor {
      new (locale?: unknown, options?: { granularity?: string }): SegLike;
    }
    const SegmenterCtor = (Intl as unknown as { Segmenter?: SegCtor }).Segmenter;
    const out: string[] = [];
    if (typeof SegmenterCtor === 'function') {
      try {
        const seg = new SegmenterCtor(undefined, { granularity: 'grapheme' });
        for (const { segment } of seg.segment(text)) {
          out.push(segment);
          if (out.length === max) break;
        }
        return out;
      } catch {
        /* fall through */
      }
    }
    for (let i = 0; i < Math.min(max, text.length); i++) {
      out.push(text.charAt(i));
    }
    return out;
  }

  /**
   * Deterministic hash → palette index. Same seed → same color across
   * sessions/devices so a given user always has the same avatar tint.
   */
  private hashSeed(seed: string): number {
    let h = 0;
    for (let i = 0; i < seed.length; i++) {
      h = (h << 5) - h + seed.charCodeAt(i);
      h |= 0;
    }
    return Math.abs(h);
  }

  /** 1-based palette index (1..7) matching the CSS palette variables. */
  private get paletteIndex(): number {
    if (!this.colorFromName) return 0;
    const seed = (this.initials || this.name || this.label || '').trim();
    if (!seed) return 0;
    return (this.hashSeed(seed) % 7) + 1;
  }

  private handleImageError = () => {
    this.imageFailed = true;
    this.mdError.emit({ src: this.src });
  };

  private handleImageLoad = () => {
    this.imageFailed = false;
    this.mdLoad.emit({ src: this.src });
  };

  private get accessibleLabel(): string | undefined {
    const v = (this.label || this.alt || this.name || '').trim();
    return v || undefined;
  }

  render() {
    const hasImage = !!this.src && !this.imageFailed;
    const computedInitials = this.computeInitials();
    const hasInitials = !hasImage && !!computedInitials;
    const fallbackMode: 'image' | 'initials' | 'slot' = hasImage
      ? 'image'
      : hasInitials
        ? 'initials'
        : 'slot';

    const a11yLabel = this.accessibleLabel;
    const palette = this.paletteIndex;

    // Resolve `size`: presets emit a `md-avatar--{preset}` modifier class
    // and rely on the CSS-defined token defaults; everything else is treated
    // as a CSS length and pushed into `--md-avatar-size` so the existing
    // sizing pipeline (which already cascades through that custom property)
    // picks it up automatically. We deliberately set the inline style at
    // the lowest possible level (`Host`) so an author's `style="--md-avatar-size: …"`
    // or class-based override still wins via CSS specificity.
    const isPresetSize = PRESET_SIZES.has(String(this.size));
    const customSize = isPresetSize ? undefined : coerceCssLength(this.size);
    const hostStyle = customSize ? { '--md-avatar-size': customSize } : undefined;

    return (
      <Host
        class={{
          'md-avatar': true,
          [`md-avatar--${this.size}`]: isPresetSize,
          'md-avatar--custom-size': !isPresetSize && !!customSize,
          [`md-avatar--${this.shape}`]: true,
          [`md-avatar--mode-${fallbackMode}`]: true,
          [`md-avatar--palette-${palette}`]: palette > 0 && fallbackMode !== 'image',
          'md-avatar--has-image': hasImage,
        }}
        style={hostStyle}
        role={a11yLabel ? 'img' : 'presentation'}
        aria-label={a11yLabel}
        aria-hidden={a11yLabel ? null : 'true'}
      >
        {fallbackMode === 'image' && (
          <img
            class="md-avatar__image"
            part="image"
            src={this.src}
            alt={this.alt || ''}
            loading={this.loading}
            crossorigin={this.crossorigin || undefined}
            aria-hidden="true"
            draggable={false}
            onLoad={this.handleImageLoad}
            onError={this.handleImageError}
          />
        )}

        {fallbackMode === 'initials' && (
          <span class="md-avatar__initials" part="initials" aria-hidden="true">
            {computedInitials}
          </span>
        )}

        {fallbackMode === 'slot' && (
          <slot>
            <span class="md-avatar__icon material-symbols-outlined" part="icon" aria-hidden="true">
              person
            </span>
          </slot>
        )}
      </Host>
    );
  }
}
