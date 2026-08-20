/**
 * Pure colour-conversion helpers used by md-color-picker.
 *
 * All colour values internally are stored as HSVA in the ranges:
 *   h: 0–360
 *   s: 0–100 (percent)
 *   v: 0–100 (percent)
 *   a: 0–1
 *
 * Hex strings are accepted in 3, 4, 6, or 8-digit forms.
 */

export interface Hsva {
  h: number;
  s: number;
  v: number;
  a: number;
}

export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));

export function clampHsva(c: Hsva): Hsva {
  return {
    h: ((c.h % 360) + 360) % 360,
    s: clamp(c.s, 0, 100),
    v: clamp(c.v, 0, 100),
    a: clamp(c.a, 0, 1),
  };
}

export function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  const rN = r / 255;
  const gN = g / 255;
  const bN = b / 255;
  const max = Math.max(rN, gN, bN);
  const min = Math.min(rN, gN, bN);
  const d = max - min;

  let h = 0;
  if (d !== 0) {
    switch (max) {
      case rN:
        h = ((gN - bN) / d) % 6;
        break;
      case gN:
        h = (bN - rN) / d + 2;
        break;
      default:
        h = (rN - gN) / d + 4;
    }
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : (d / max) * 100;
  const v = max * 100;
  return { h, s, v };
}

export function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  const sN = s / 100;
  const vN = v / 100;
  const c = vN * sN;
  const hP = h / 60;
  const x = c * (1 - Math.abs((hP % 2) - 1));
  let r = 0, g = 0, b = 0;
  if (hP >= 0 && hP < 1) { r = c; g = x; b = 0; }
  else if (hP < 2) { r = x; g = c; b = 0; }
  else if (hP < 3) { r = 0; g = c; b = x; }
  else if (hP < 4) { r = 0; g = x; b = c; }
  else if (hP < 5) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }
  const m = vN - c;
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

export function hsvaToRgba(c: Hsva): Rgba {
  const { r, g, b } = hsvToRgb(c.h, c.s, c.v);
  return { r, g, b, a: c.a };
}

/** HSL components in degrees (h) and percent (s, l). */
export interface Hsl {
  h: number;
  s: number;
  l: number;
}

export function rgbToHsl(r: number, g: number, b: number): Hsl {
  const rN = r / 255;
  const gN = g / 255;
  const bN = b / 255;
  const max = Math.max(rN, gN, bN);
  const min = Math.min(rN, gN, bN);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rN:
        h = (gN - bN) / d + (gN < bN ? 6 : 0);
        break;
      case gN:
        h = (bN - rN) / d + 2;
        break;
      default:
        h = (rN - gN) / d + 4;
    }
    h *= 60;
  }
  return { h, s: s * 100, l: l * 100 };
}

export function hsvaToHsl(c: Hsva): Hsl {
  const { r, g, b } = hsvToRgb(c.h, c.s, c.v);
  return rgbToHsl(r, g, b);
}

export function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const hN = ((h % 360) + 360) % 360;
  const sN = clamp(s, 0, 100) / 100;
  const lN = clamp(l, 0, 100) / 100;
  const c = (1 - Math.abs(2 * lN - 1)) * sN;
  const x = c * (1 - Math.abs(((hN / 60) % 2) - 1));
  const m = lN - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hN < 60) {
    r = c;
    g = x;
  } else if (hN < 120) {
    r = x;
    g = c;
  } else if (hN < 180) {
    g = c;
    b = x;
  } else if (hN < 240) {
    g = x;
    b = c;
  } else if (hN < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

export function rgbaToHex(c: Rgba, withAlpha = false): string {
  const hex = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');
  const base = `#${hex(c.r)}${hex(c.g)}${hex(c.b)}`;
  if (!withAlpha && c.a >= 1) return base.toUpperCase();
  return `${base}${hex(c.a * 255)}`.toUpperCase();
}

export function hsvaToHex(c: Hsva, withAlpha = false): string {
  return rgbaToHex(hsvaToRgba(c), withAlpha || c.a < 1);
}

/**
 * Parse a hex string (3 / 4 / 6 / 8 digits, with or without #). Returns
 * null on invalid input.
 */
export function parseHex(input: string): Rgba | null {
  if (!input) return null;
  const s = input.trim().replace(/^#/, '');
  const re = /^[0-9a-fA-F]+$/;
  if (!re.test(s)) return null;
  let r = 0, g = 0, b = 0, a = 1;
  if (s.length === 3) {
    r = parseInt(s[0] + s[0], 16);
    g = parseInt(s[1] + s[1], 16);
    b = parseInt(s[2] + s[2], 16);
  } else if (s.length === 4) {
    r = parseInt(s[0] + s[0], 16);
    g = parseInt(s[1] + s[1], 16);
    b = parseInt(s[2] + s[2], 16);
    a = parseInt(s[3] + s[3], 16) / 255;
  } else if (s.length === 6) {
    r = parseInt(s.slice(0, 2), 16);
    g = parseInt(s.slice(2, 4), 16);
    b = parseInt(s.slice(4, 6), 16);
  } else if (s.length === 8) {
    r = parseInt(s.slice(0, 2), 16);
    g = parseInt(s.slice(2, 4), 16);
    b = parseInt(s.slice(4, 6), 16);
    a = parseInt(s.slice(6, 8), 16) / 255;
  } else {
    return null;
  }
  return { r, g, b, a };
}

export function rgbaFromCssHsl(input: string): Rgba | null {
  const m = input.trim().match(
    /^hsla?\(\s*([\d.]+)[\s,]+([\d.]+)%?[\s,]+([\d.]+)%?(?:[\s,/]+([\d.%]+))?\s*\)$/i,
  );
  if (!m) return null;
  const h = clamp(parseFloat(m[1]), 0, 360);
  const s = clamp(parseFloat(m[2]), 0, 100);
  const l = clamp(parseFloat(m[3]), 0, 100);
  const toAlpha = (v: string | undefined) => {
    if (v == null) return 1;
    if (v.endsWith('%')) return clamp(parseFloat(v) / 100, 0, 1);
    return clamp(parseFloat(v), 0, 1);
  };
  const { r, g, b } = hslToRgb(h, s, l);
  return { r, g, b, a: toAlpha(m[4]) };
}

export function rgbaFromCssRgb(input: string): Rgba | null {
  // Supports rgb(...), rgba(...), and the modern `rgb(R G B / A)` syntax.
  const m = input.trim().match(
    /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.%]+))?\s*\)$/i,
  );
  if (!m) return null;
  const toComp = (v: string) => {
    if (v.endsWith('%')) return clamp((parseFloat(v) / 100) * 255, 0, 255);
    return clamp(parseFloat(v), 0, 255);
  };
  const toAlpha = (v: string | undefined) => {
    if (v == null) return 1;
    if (v.endsWith('%')) return clamp(parseFloat(v) / 100, 0, 1);
    return clamp(parseFloat(v), 0, 1);
  };
  return {
    r: Math.round(toComp(m[1])),
    g: Math.round(toComp(m[2])),
    b: Math.round(toComp(m[3])),
    a: toAlpha(m[4]),
  };
}

/**
 * Best-effort parse of any common CSS colour string. Supports hex,
 * rgb(), rgba(), hsl(), and hsla() emitted by this component.
 */
export function parseColor(input: string): Hsva | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (trimmed.startsWith('#') || /^[0-9a-fA-F]{3,8}$/.test(trimmed)) {
    const rgba = parseHex(trimmed);
    if (!rgba) return null;
    const { h, s, v } = rgbToHsv(rgba.r, rgba.g, rgba.b);
    return { h, s, v, a: rgba.a };
  }
  const lower = trimmed.toLowerCase();
  if (lower.startsWith('rgb')) {
    const rgba = rgbaFromCssRgb(trimmed);
    if (!rgba) return null;
    const { h, s, v } = rgbToHsv(rgba.r, rgba.g, rgba.b);
    return { h, s, v, a: rgba.a };
  }
  if (lower.startsWith('hsl')) {
    const rgba = rgbaFromCssHsl(trimmed);
    if (!rgba) return null;
    const { h, s, v } = rgbToHsv(rgba.r, rgba.g, rgba.b);
    return { h, s, v, a: rgba.a };
  }
  return null;
}

export function formatColor(c: Hsva, format: 'hex' | 'rgb' | 'hsl'): string {
  const rgba = hsvaToRgba(c);
  if (format === 'rgb') {
    if (c.a < 1) {
      return `rgba(${rgba.r}, ${rgba.g}, ${rgba.b}, ${+c.a.toFixed(2)})`;
    }
    return `rgb(${rgba.r}, ${rgba.g}, ${rgba.b})`;
  }
  if (format === 'hsl') {
    const { h, s, l } = rgbToHsl(rgba.r, rgba.g, rgba.b);
    if (c.a < 1) {
      return `hsla(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%, ${+c.a.toFixed(2)})`;
    }
    return `hsl(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%)`;
  }
  return hsvaToHex(c, c.a < 1);
}
