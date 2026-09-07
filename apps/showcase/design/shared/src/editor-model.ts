import { CANVAS_COLS, CANVAS_ROWS, PALETTE, clampRect, paletteHex, visibleLayers, zOrder, type Asset, type Layer, type LayerKind, type Rect } from '@awc-ui/showcase-kit/design';

export const LIVE_COMPONENTS = [
  { id: 'awc:button', name: 'Action button', icon: 'smart_button', description: 'Native AWC button · try it in Present' },
  { id: 'awc:text-field', name: 'Text field', icon: 'text_fields', description: 'A real editable Material text field' },
  { id: 'awc:switch', name: 'Switch', icon: 'toggle_on', description: 'An interactive boolean control' },
  { id: 'awc:card', name: 'Feature card', icon: 'dashboard', description: 'Compose typography, surface and action' },
] as const;

let sequence = 0;
export function createLayer(kind: LayerKind, rect: Rect, patch: Partial<Layer> = {}): Layer {
  return {
    id: `pictor-${Date.now().toString(36)}-${++sequence}`, parentId: null,
    kind, kindKey: `design.layerKind.${kind}`, name: kind === 'text' ? 'Your next big idea' : kind[0].toUpperCase() + kind.slice(1),
    rect: clampRect(rect), order: 1000 + sequence, visible: true, locked: false,
    opacity: 100, blend: 'normal', blendKey: 'design.blend.normal',
    fill: kind === 'text' ? '#203D35' : '#BEE7AA',
    adjustments: kind === 'image' ? ['exposure', 'contrast', 'saturation', 'temperature'].map(kind => ({ kind, kindKey: `design.adjustment.${kind}`, value: 0 })) as Layer['adjustments'] : [],
    masked: false, art: null, textKey: null, componentId: null, ...patch,
  };
}

export function layerFromAsset(asset: Asset): Layer {
  const kind = asset.kind === 'text-style' ? 'text' : asset.kind === 'color' ? 'rect' : asset.kind === 'component' ? 'component' : 'image';
  return createLayer(kind, { x: 16, y: 9, w: 16, h: kind === 'text' ? 5 : 14 }, {
    name: asset.kind === 'text-style' ? 'Type something wonderful' : asset.name,
    art: asset.art, fill: asset.color ?? (kind === 'text' ? '#203D35' : null),
    componentId: asset.kind === 'component' ? asset.id : null,
  });
}

export function colorOf(fill: string | null, fallback = 'transparent'): string {
  return paletteHex(fill) ?? (fill && /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(fill) ? fill : fallback);
}

const artwork = (body: string, background = 'none') => ({
  src: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600"><defs><radialGradient id="orb" cx="30%" cy="24%" r="74%"><stop stop-color="#e7f7ab"/><stop offset=".44" stop-color="#8bd9ac"/><stop offset=".76" stop-color="#267e63"/><stop offset="1" stop-color="#153e37"/></radialGradient><linearGradient id="ribbon" x2="1" y2="1"><stop stop-color="#edffbc"/><stop offset=".6" stop-color="#c5c7ff"/><stop offset="1" stop-color="#807bea"/></linearGradient><linearGradient id="sun"><stop stop-color="#ffac7d"/><stop offset="1" stop-color="#e64949"/></linearGradient></defs>${background === 'none' ? '' : `<rect width="600" height="600" fill="${background}"/>`}${body}</svg>`)}`,
  altKey: '',
});

export const ORB_ART = artwork('<ellipse cx="311" cy="497" rx="184" ry="26" fill="#143d32" opacity=".12"/><circle cx="302" cy="294" r="211" fill="url(#orb)"/><ellipse cx="300" cy="292" rx="288" ry="90" transform="rotate(-27 300 292)" fill="none" stroke="url(#ribbon)" stroke-width="28"/><ellipse cx="230" cy="195" rx="47" ry="15" transform="rotate(-30 230 195)" fill="#fff" opacity=".35"/>');
export const WAVE_ART = artwork('<path d="M-70 495C145 564 102 40 342 110S307 697 675 255" fill="none" stroke="#fea9d8" stroke-width="135"/><path d="M-60 442C138 515 140 24 364 161S342 710 690 268" fill="none" stroke="#e6edaa" stroke-width="45"/>');
export const LANDSCAPE_ART = artwork('<circle cx="300" cy="290" r="254" fill="#e6bd91"/><circle cx="338" cy="235" r="115" fill="url(#sun)"/><path d="M35 440 235 187 429 469Z" fill="#859684"/><path d="M137 524 395 297 588 505Z" fill="#354e43"/><path d="M37 513q280-153 537-10v98H37Z" fill="#bcc5a3"/>');

export const TEMPLATES = [
  { id: 'orbit', name: 'Orbit — launch campaign', category: 'Brand design', tagline: 'Make room for extraordinary.', tone: 'orbit', art: ORB_ART, tags: ['Typography', 'Shapes', 'Brand'] },
  { id: 'pulse', name: 'Pulse — culture festival', category: 'Social campaign', tagline: 'Less noise. More feeling.', tone: 'pulse', art: WAVE_ART, tags: ['Color', 'Poster', 'Social'] },
  { id: 'field', name: 'Fieldnotes — editorial', category: 'Editorial', tagline: 'A different point of view.', tone: 'field', art: LANDSCAPE_ART, tags: ['Editorial', 'Image', 'Layout'] },
] as const;

export function makeTemplate(id: string): { name: string; layers: readonly Layer[] } {
  const template = TEMPLATES.find(t => t.id === id) ?? TEMPLATES[0];
  const layers: Layer[] = [];
  const add = (kind: LayerKind, name: string, rect: Rect, fill: string | null, extra: Partial<Layer> = {}) => {
    const layer = createLayer(kind, rect, { id: `template-${template.id}-${layers.length}`, name, fill, order: layers.length, ...extra });
    layers.push(layer); return layer;
  };
  if (template.id === 'orbit') {
    add('rect', 'Warm paper', { x: 0, y: 0, w: 48, h: 32 }, '#F4F1E9', { locked: true });
    add('text', 'ORBIT®   /   CREATIVE SYSTEMS', { x: 3, y: 2, w: 27, h: 2 }, '#203D35');
    add('ellipse', 'Lime accent', { x: 35, y: 1, w: 11, h: 11 }, '#D6E8AE');
    add('image', 'Orbital sculpture', { x: 25, y: 7, w: 23, h: 23 }, null, { art: ORB_ART });
    add('text', 'Make room\nfor extraordinary.', { x: 3, y: 8, w: 29, h: 9 }, '#203D35');
    add('text', 'A little structure. Infinite possibility.\nYour next chapter starts with one bold idea.', { x: 3, y: 19, w: 24, h: 4 }, '#51645D');
    add('rect', 'Explore button', { x: 3, y: 26, w: 14, h: 3 }, '#203D35');
    add('text', "EXPLORE WHAT'S NEXT  ↗", { x: 4, y: 26, w: 12, h: 3 }, '#F4F1E9');
    add('text', 'EST. 2026  /  VOL. 01', { x: 33, y: 29, w: 12, h: 2 }, '#51645D');
    add('rect', 'Editorial rule', { x: 3, y: 6, w: 42, h: 1 }, '#D8DFD1');
  } else if (template.id === 'pulse') {
    add('rect', 'Ultraviolet', { x: 0, y: 0, w: 48, h: 32 }, '#392263', { locked: true });
    add('image', 'Electric ribbon', { x: 23, y: 1, w: 25, h: 30 }, null, { art: WAVE_ART });
    add('text', 'PULSE  /  CULTURE IN MOTION', { x: 3, y: 2, w: 33, h: 2 }, '#F3F2D3');
    add('text', 'LESS NOISE.\nMORE FEELING.', { x: 3, y: 9, w: 34, h: 10 }, '#F3F2D3');
    add('text', 'Three nights. One electric city.\nMusic, art & the beautifully unexpected.', { x: 3, y: 22, w: 25, h: 4 }, '#E2CCE8');
    add('rect', 'Ticket strip', { x: 3, y: 28, w: 24, h: 3 }, '#E3ED9C');
    add('text', 'SEP 18—20    /    FIND YOUR FREQUENCY ↗', { x: 4, y: 28, w: 22, h: 3 }, '#392263');
  } else {
    add('rect', 'Linen', { x: 0, y: 0, w: 48, h: 32 }, '#EEE8DC', { locked: true });
    add('text', 'FIELDNOTES', { x: 3, y: 2, w: 26, h: 3 }, '#9D382B');
    add('text', 'ISSUE 08  /  EXPLORING THE EVERYDAY', { x: 28, y: 2, w: 17, h: 3 }, '#665F51');
    add('image', 'New horizons', { x: 23, y: 7, w: 24, h: 24 }, null, { art: LANDSCAPE_ART });
    add('text', 'A different\npoint of view.', { x: 3, y: 10, w: 29, h: 10 }, '#9D382B');
    add('text', 'Stories for a slower, more considered life.\nLook closer. There is wonder everywhere.', { x: 3, y: 22, w: 24, h: 4 }, '#665F51');
    add('text', 'READ THE JOURNAL  ↗', { x: 3, y: 28, w: 18, h: 2 }, '#9D382B');
  }
  return { name: template.name, layers };
}

export function textLayout(layer: Layer, text: string) {
  const lines = text.split('\n');
  const width = layer.rect.w * 20;
  const height = layer.rect.h * 20;
  const size = Math.max(9, Math.min(88, height / (lines.length * 1.25), width / (Math.max(...lines.map(line => line.length), 1) * 0.56)));
  return { lines, size, lineHeight: size * 1.16, top: (height - size * 1.16 * lines.length) / 2 + size };
}

const escapeXml = (text: unknown) => String(text ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]!));
export function componentMarkup(layer: Layer): string {
  const label = escapeXml(layer.name);
  switch (layer.componentId) {
    case 'awc:button': return `<md-button variant="filled" icon="arrow_forward">${label}</md-button>`;
    case 'awc:text-field': return `<md-text-field variant="outlined" label="${label}" placeholder="Try typing here…"></md-text-field>`;
    case 'awc:switch': return `<md-switch aria-label="${label}" icons></md-switch>`;
    case 'awc:card': return `<md-card variant="filled">\n  <h3>${label}</h3>\n  <p>A real component. Ready for your next idea.</p>\n  <md-button variant="tonal">Explore more</md-button>\n</md-card>`;
    default: return '';
  }
}

export function documentSvg(layers: readonly Layer[], translate: (key: string) => string = key => key, { background = false, scale = 1 } = {}): string {
  const visible = visibleLayers(layers);
  const body = zOrder(layers).filter(l => visible.has(l.id)).map(layer => {
    const x = layer.rect.x * 20, y = layer.rect.y * 20, w = layer.rect.w * 20, h = layer.rect.h * 20;
    const fill = colorOf(layer.fill, 'none');
    let contents = '';
    if (layer.kind === 'text') {
      const text = layer.textKey ? translate(layer.textKey) : layer.name;
      const { lines, size, lineHeight, top } = textLayout(layer, text);
      contents = `<text x="${x}" y="${y + top}" font-family="Arial,sans-serif" font-size="${size}" font-weight="600" fill="${escapeXml(fill)}">${lines.map((line, i) => `<tspan x="${x}" dy="${i ? lineHeight : 0}">${escapeXml(line)}</tspan>`).join('')}</text>`;
    } else if (layer.art) {
      contents = `<image x="${x}" y="${y}" width="${w}" height="${h}" href="${escapeXml(layer.art.src)}" preserveAspectRatio="xMidYMid slice"/>`;
    } else if (layer.kind === 'ellipse') {
      contents = `<ellipse cx="${x + w / 2}" cy="${y + h / 2}" rx="${w / 2}" ry="${h / 2}" fill="${escapeXml(fill)}"/>`;
    } else if (layer.kind !== 'group') {
      contents = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${escapeXml(fill)}"/>`;
      if (layer.componentId?.startsWith('awc:')) contents += `<text x="${x + 12}" y="${y + h / 2}" font-family="Arial,sans-serif" font-size="18" fill="#203D35">${escapeXml(layer.name)}</text>`;
    }
    return `<g opacity="${layer.opacity / 100}" data-layer="${escapeXml(layer.id)}">${contents}</g>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_COLS * 20 * scale}" height="${CANVAS_ROWS * 20 * scale}" viewBox="0 0 960 640">${background ? '<rect width="960" height="640" fill="#ffffff"/>' : ''}${body}</svg>`;
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = name;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadDocument(layers: readonly Layer[], translate: (key: string) => string, format: 'svg' | 'png' | 'json', name: string, scale = 1, background = false) {
  const safeName = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'pictor-artwork';
  if (format === 'json') {
    downloadBlob(new Blob([JSON.stringify({ application: 'Pictor', version: 1, width: 48, height: 32, layers }, null, 2)], { type: 'application/json' }), `${safeName}.json`);
    return;
  }
  const svg = documentSvg(layers, translate, { scale, background });
  if (format === 'svg') { downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), `${safeName}.svg`); return; }
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('PNG rendering failed. Try SVG export.')); image.src = url; });
    const canvas = document.createElement('canvas'); canvas.width = 960 * scale; canvas.height = 640 * scale;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Your browser does not support PNG rendering.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('PNG rendering failed. Try SVG export.');
    downloadBlob(blob, `${safeName}.png`);
  } finally { URL.revokeObjectURL(url); }
}

export const templatePalette = (id: string) => [...new Set(makeTemplate(id).layers.map(l => l.fill).filter(Boolean))].slice(0, 5) as string[];
export const DEFAULT_SWATCHES = ['#203D35', '#BEE7AA', '#F4F1E9', '#F2AAA7', '#392263', '#C2BBF3', ...PALETTE.map(p => p.hex)];
