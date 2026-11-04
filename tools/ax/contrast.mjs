// Contrast from captured pixels (WCAG 2.2 1.4.3 text, 1.4.11 non-text), measured the same way on every platform and on Web.
// Each capture carries `image: { file, scale, offset, cssPerUnit }`: pixel = (frame + offset) * scale; cssPerUnit converts the
// frame unit (CSS px, pt, Android px) to CSS px for the large-text rule. Text: the most frequent colour in the text's box is the
// background, the most contrasting frequent colour the foreground (as the Accessibility Test Framework does). Non-text: the most
// contrasting frequent colour inside a control against the dominant colour of a 3-unit ring around it. Disabled controls are
// exempt (WCAG: inactive components).
import { ws } from './normalize.mjs';

const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
export const luminance = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
export const ratio = (a, b) => { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

function buckets(img, rects) {
  const map = new Map(); let total = 0;
  for (const [x0, y0, x1, y1] of rects) {
    for (let y = Math.max(0, Math.floor(y0)); y < Math.min(img.height, Math.ceil(y1)); y++)
      for (let x = Math.max(0, Math.floor(x0)); x < Math.min(img.width, Math.ceil(x1)); x++) {
        const i = (y * img.width + x) * 4, a = img.data[i + 3] / 255;
        // Transparent pixels are composited over white (the Laboratory's light preview surface).
        const r = img.data[i] * a + 255 * (1 - a), g = img.data[i + 1] * a + 255 * (1 - a), b = img.data[i + 2] * a + 255 * (1 - a);
        const key = ((r >> 2) << 12) | ((g >> 2) << 6) | (b >> 2);
        const e = map.get(key) ?? { n: 0, r: 0, g: 0, b: 0 }; e.n++; e.r += r; e.g += g; e.b += b; map.set(key, e); total++;
      }
  }
  const list = [...map.values()].map(e => ({ n: e.n, color: [e.r / e.n, e.g / e.n, e.b / e.n] })).sort((a, b) => b.n - a.n);
  return { list, total };
}
const box = (image, frame) => {
  const s = image.scale ?? 1, [ox, oy] = image.offset ?? [0, 0];
  return [(frame[0] + ox) * s, (frame[1] + oy) * s, (frame[0] + frame[2] + ox) * s, (frame[1] + frame[3] + oy) * s];
};
const hex = c => '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');

/** Text contrast inside a frame, or null when the box is too small or outside the image. */
export function textContrast(img, image, frame) {
  if (!frame || frame[2] <= 0 || frame[3] <= 0) return null;
  const { list, total } = buckets(img, [box(image, frame)]);
  if (total < 24) return null;
  const bg = list[0].color, min = Math.max(3, total * 0.003);
  let best = null;
  for (const b of list.slice(1)) if (b.n >= min) { const r = ratio(b.color, bg); if (!best || r > best.ratio) best = { ratio: r, fg: hex(b.color), bg: hex(bg) }; }
  return best;
}

/** Non-text contrast: a control's most contrasting part against its surroundings. */
export function uiContrast(img, image, frame) {
  if (!frame || frame[2] <= 0 || frame[3] <= 0) return null;
  const [x0, y0, x1, y1] = box(image, frame), d = 3 * (image.scale ?? 1) / (image.cssPerUnit ?? 1);
  const ring = buckets(img, [[x0 - d, y0 - d, x1 + d, y0], [x0 - d, y1, x1 + d, y1 + d], [x0 - d, y0, x0, y1], [x1, y0, x1 + d, y1]]);
  const inside = buckets(img, [[x0, y0, x1, y1]]);
  if (!ring.total || inside.total < 24) return null;
  const bg = ring.list[0].color, min = Math.max(3, inside.total * 0.01);
  let best = null;
  for (const b of inside.list) if (b.n >= min) { const r = ratio(b.color, bg); if (!best || r > best.ratio) best = { ratio: r, fg: hex(b.color), bg: hex(bg) }; }
  return best;
}

const TEXT_ROLES = new Set(['button', 'link', 'tab', 'menuitem', 'option', 'togglebutton', 'heading']);
const UI_ROLES = new Set(['checkbox', 'radio', 'switch', 'slider', 'progressbar', 'meter', 'textbox', 'togglebutton', 'button']);

/** Text items with frames from a raw capture: static text plus elements whose name is their visible text. */
export function textItems(platform, raw, normalized) {
  const items = [];
  const push = (text, frame) => { const t = ws(text ?? ''); if (t && frame) items.push({ text: t, frame }); };
  const walk = (n, f) => { if (!n) return; f(n); for (const c of n.children ?? []) walk(c, f); };
  if (platform === 'web') walk(raw.tree, n => { if (n.role === 'StaticText' && !n.ignored) push(n.name, n.frame); });
  if (platform === 'macos') for (const w of raw.tree ?? []) walk(w, n => { if (n.role === 'AXStaticText') push(n.value || n.description, n.frame); });
  if (platform === 'ios') for (const e of raw.elements ?? []) if ((e.traits ?? []).includes('staticText')) push(e.label, e.frame);
  if (platform === 'android') for (const w of raw.windows ?? []) walk(w.root, n => { if (n.text && n.visible !== false) push(n.text, n.frame); });
  for (const e of normalized.elements) if (TEXT_ROLES.has(e.role) && e.name && e.frame && e.states?.disabled !== 'true') push(e.name, e.frame);
  return items;
}

/** WCAG contrast findings for one platform, each compared with the same measurement on Web. */
export function contrastFindings(platform, { img, image, raw, normalized }, web, matched, { inactive = false } = {}) {
  if (!img || !image) return { findings: [], measured: 0 };
  const findings = []; let measured = 0;
  // A case that renders an inactive component (a disabled card whose container has no disabled role): its own text is exempt
  // (WCAG 1.4.3 "part of an inactive user interface component"); enabled controls inside it are still measured.
  const enabledControls = new Set(normalized.elements.filter(e => UI_ROLES.has(e.role) && e.states?.disabled !== 'true').map(e => e.name));
  const disabledEls = normalized.elements.filter(e => e.states?.disabled === 'true');
  const disabledNames = new Set(disabledEls.map(e => e.name));
  // Text of an inactive control is exempt (WCAG 1.4.3): its name, or any text drawn inside its frame.
  const insideDisabled = f => disabledEls.some(e => e.frame && f && f[0] + f[2] / 2 >= e.frame[0] && f[0] + f[2] / 2 <= e.frame[0] + e.frame[2] && f[1] + f[3] / 2 >= e.frame[1] && f[1] + f[3] / 2 <= e.frame[1] + e.frame[3]);
  const best = (items, im, imgInfo) => {
    const byText = new Map();
    for (const it of items) {
      if (im === img && insideDisabled(it.frame)) continue;
      const c = textContrast(im, imgInfo, it.frame); if (!c) continue;
      const lineCss = it.frame[3] * (imgInfo.cssPerUnit ?? 1), prev = byText.get(it.text);
      if (!prev || c.ratio < prev.ratio) byText.set(it.text, { ...c, large: lineCss >= 30 });
    }
    return byText;
  };
  const nativeText = best(textItems(platform, raw, normalized), img, image);
  const webText = web?.img ? best(textItems('web', web.raw, web.normalized), web.img, web.image) : new Map();
  for (const [text, c] of nativeText) {
    if (disabledNames.has(text) || (inactive && !enabledControls.has(text))) continue;
    measured++;
    const need = c.large ? 3 : 4.5, w = webText.get(text);
    if (c.ratio < need - 0.05) findings.push({ kind: 'contrast', detail: `text "${text.slice(0, 60)}" ${c.ratio.toFixed(2)}:1 (${c.fg} on ${c.bg}) < ${need}:1${w ? `; Web ${w.ratio.toFixed(2)}:1` : ''}` });
  }
  for (const [a, b] of matched ?? []) {
    if (!UI_ROLES.has(b.role) || b.states?.disabled === 'true' || a.states?.disabled === 'true') continue;
    // A control is identifiable by its most contrasting part: its boundary/graphic against the surroundings, or its own label/icon
    // against its container (WCAG 1.4.11 does not require a container boundary when the label identifies the control).
    const both = (im, info, frame) => { const u = uiContrast(im, info, frame), t = textContrast(im, info, frame); return !u ? t : !t ? u : t.ratio > u.ratio ? t : u; };
    const c = both(img, image, b.frame); if (!c) continue;
    measured++;
    const w = web?.img ? both(web.img, web.image, a.frame) : null;
    if (c.ratio < 2.95) findings.push({ kind: 'contrast', detail: `${b.role} "${b.name}" non-text ${c.ratio.toFixed(2)}:1 (${c.fg} on ${c.bg}) < 3:1${w ? `; Web ${w.ratio.toFixed(2)}:1` : ''}` });
  }
  return { findings, measured };
}
