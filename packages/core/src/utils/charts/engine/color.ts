/*
 * Chart engine — CSS colour → RGBA parsing
 * ===========================================================
 * For anywhere a resolved colour string must become numbers. Handles
 * #rgb / #rrggbb / #rrggbbaa and rgb()/rgba() directly (DOM-less,
 * unit-testable), and normalises any other CSS colour (named, hsl(),
 * hwb(), lab(), color-mix(), …) through a shared canvas 2D context
 * so every consumer agrees on a colour. Falls back to mid-grey only
 * when no canvas is available (headless unit-test env).
 * ===========================================================
 */

/** RGBA components in 0..1. */
export type Rgba = [number, number, number, number];

/** Parse a #hex / rgb() / rgba() string, or null if it's neither. */
function parseHexOrRgb(s: string): Rgba | null {
  if (s.startsWith('#')) {
    let h = s.slice(1);
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    if (h.length === 4) h = h.split('').map((c) => c + c).join('');
    if (h.length < 6) return null;
    const r = parseInt(h.slice(0, 2), 16) / 255;
    const g = parseInt(h.slice(2, 4), 16) / 255;
    const b = parseInt(h.slice(4, 6), 16) / 255;
    const a = h.length >= 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
    return [r, g, b, a];
  }
  const m = s.match(/rgba?\(([^)]+)\)/);
  if (m) {
    const parts = m[1].split(/[,/]/).map((p) => p.trim());
    const chan = (v: string) => (v.endsWith('%') ? (parseFloat(v) / 100) * 255 : parseFloat(v));
    const r = chan(parts[0]) / 255;
    const g = chan(parts[1]) / 255;
    const b = chan(parts[2]) / 255;
    const a = parts[3] != null ? (parts[3].endsWith('%') ? parseFloat(parts[3]) / 100 : parseFloat(parts[3])) : 1;
    return [r, g, b, Number.isNaN(a) ? 1 : a];
  }
  return null;
}

// A single reusable 2D context that resolves any CSS colour to #hex / rgb().
// `undefined` = not yet probed; `null` = no canvas (unit-test env).
let normCtx: CanvasRenderingContext2D | null | undefined;

function normalizeColor(css: string): string | null {
  if (normCtx === undefined) {
    try {
      normCtx = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
    } catch {
      normCtx = null;
    }
  }
  if (!normCtx) return null;
  try {
    // Setting an INVALID colour leaves fillStyle unchanged, so seed a sentinel
    // and treat "unchanged" as unparseable.
    normCtx.fillStyle = '#000000';
    normCtx.fillStyle = css;
    const resolved = normCtx.fillStyle;
    if (typeof resolved !== 'string') return null;
    if (resolved === '#000000' && css.trim().toLowerCase() !== 'black' && css.trim() !== '#000000' && css.trim() !== '#000') {
      return null; // invalid input the browser rejected
    }
    return resolved;
  } catch {
    return null;
  }
}

/** Re-express a colour as an `rgba()` string with its alpha scaled by `factor`
 *  (for hover emphasis dimming). Resolves named/hsl/hex/rgb inputs. */
export function withAlpha(css: string, factor: number): string {
  const [r, g, b, a] = parseColor(css);
  const alpha = Math.round(a * factor * 1000) / 1000; // avoid float dust in the string
  return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${alpha})`;
}

export function parseColor(css: string): Rgba {
  const s = css.trim();
  const direct = parseHexOrRgb(s);
  if (direct) return direct;
  // Named / hsl() / lab() / color-mix() etc. — resolve via canvas, then parse
  // the browser-normalised #hex / rgb() form.
  const norm = normalizeColor(s);
  if (norm) {
    const parsed = parseHexOrRgb(norm);
    if (parsed) return parsed;
  }
  // No canvas (headless test) or unparseable — mid-grey so at least something draws.
  return [0.5, 0.5, 0.5, 1];
}

/**
 * Black or white, whichever reads on top of `fill`.
 *
 * For anything drawn ON a series colour — a value label inside its slice, a
 * press ripple clipped to it. The threshold is above 0.5 because a mid-tone
 * carries white better than black at small sizes.
 */
export function onColorFor(fill: string): '#000000' | '#ffffff' {
  const [r, g, b] = parseColor(fill);
  return 0.299 * r + 0.587 * g + 0.114 * b > 0.62 ? '#000000' : '#ffffff';
}

/**
 * Blend `css` toward `target` by `amount` (0 = unchanged, 1 = fully target).
 *
 * Used to derive a slice's hover states from its own colour: a deeper shade for
 * the raised outer ring, and a faded one for the slices the pointer is NOT on —
 * so a palette change carries into both without anyone restating them.
 */
export function mixColor(css: string, target: string, amount: number): string {
  const a = parseColor(css);
  const b = parseColor(target);
  const t = Math.max(0, Math.min(1, amount));
  const ch = (i: number) => Math.round((a[i] + (b[i] - a[i]) * t) * 255);
  // Alpha follows the source: blending toward an opaque target should not make
  // a translucent slice suddenly solid.
  return `rgba(${ch(0)}, ${ch(1)}, ${ch(2)}, ${a[3]})`;
}
