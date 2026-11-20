import { appearanceField, appearanceProfile } from './accordion-appearance.js';

// md-line-chart, md-area-chart, md-bar-chart, md-pie-chart and md-sparkline in the Laboratory: their typed hooks (field
// order follows the native initializer AWCChartAppearance), the retained property updates (every source property except
// the formatter / renderer closures) and the methods with results. The hook-profile helpers (extra kinds: ratio, signed
// length, number, font shorthand) and the property-type validator are exported for other components' modules.
const invalid = (code, message) => Object.assign(new Error(message), { code });
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const NUMBER = '[+-]?(?:\\d+\\.?\\d*|\\.\\d+)(?:e[+-]?\\d+)?';
const numberText = text => new RegExp(`^${NUMBER}$`, 'i').test(text) ? Number(text) : NaN;
const cssNumber = value => { const text = String(value); return text.includes('e') ? String(Number(value.toPrecision(15))) : text; };
const quote = (text, platform) => JSON.stringify(text).replace(platform === 'kotlin' ? /\$/g : /(?!)/g, '\\$');
const double = value => { if (Object.is(value, -0)) return '-0.0'; const text = String(value); return /[.e]/i.test(text) ? text : `${text}.0`; };

/** Kinds the shared profile has no rule for: a CSS `<ratio>`, a signed length, a plain number, a `font` shorthand. */
const EXTRA = {
  ratio: {
    hint: 'A CSS <ratio>: a positive number or a / b, for example 16 / 9.',
    normalize(value, code, label) {
      if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
      if (typeof value === 'string') { const m = /^\s*([0-9.e+]+)\s*\/\s*([0-9.e+]+)\s*$/i.exec(value); const a = m && numberText(m[1]), b = m && numberText(m[2]);
        if (m && a > 0 && b > 0) return `${cssNumber(a)} / ${cssNumber(b)}`; }
      throw invalid(code, `${label} must be a positive number or a / b.`);
    },
    css: value => typeof value === 'number' ? cssNumber(value) : value,
    parse: raw => { const text = String(raw ?? '').trim(); const n = numberText(text); return Number.isFinite(n) ? n : text; },
    native: (value, platform) => quote(typeof value === 'number' ? cssNumber(value) : value, platform),
  },
  signedLength: {
    hint: 'A signed length in px (points on SwiftUI, dp on Android).',
    normalize(value, code, label) { if (typeof value !== 'number' || !Number.isFinite(value)) throw invalid(code, `${label} must be a finite number.`); return Object.is(value, -0) ? 0 : value; },
    css: value => `${cssNumber(value)}px`,
    parse: (raw, code, label) => { const m = new RegExp(`^(${NUMBER})(px)?$`, 'i').exec(String(raw ?? '').trim()); if (!m) throw invalid(code, `${label} must be a px length.`); return Number(m[1]); },
    native: value => double(value),
  },
  number: {
    hint: 'A nonnegative number, for example 1.2.',
    normalize(value, code, label) { if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw invalid(code, `${label} must be a nonnegative number.`); return Object.is(value, -0) ? 0 : value; },
    css: value => cssNumber(value),
    parse: (raw, code, label) => { const n = numberText(String(raw ?? '').trim()); if (!Number.isFinite(n)) throw invalid(code, `${label} must be a number.`); return n; },
    native: value => double(value),
  },
  fontShorthand: {
    hint: 'A CSS font shorthand with a px size, for example 500 14px/20px Roboto.',
    normalize(value, code, label) {
      if (typeof value !== 'string' || value.length > 256 || /[;{}<>\\]/.test(value) || !/(?:^|\s)\d+(?:\.\d+)?px(?:\/\d+(?:\.\d+)?px)?\s+\S/.test(value.trim())) throw invalid(code, `${label} must be a CSS font shorthand with a px size.`);
      return value.trim();
    },
    css: value => value,
    parse: raw => String(raw ?? '').trim(),
    native: (value, platform) => quote(value, platform),
  },
};
const extraField = (prefix, name, label, suffix, kind) => Object.freeze({ name, label, cssProperty: `--md-${prefix}-${suffix}`, kind, hint: EXTRA[kind].hint });

function profile(fields, code, label) {
  const extras = new Map(fields.filter(f => EXTRA[f.kind]).map(f => [f.name, f]));
  const base = appearanceProfile(fields.filter(f => !extras.has(f.name)), code, label);
  const byName = new Map(fields.map(f => [f.name, f]));
  const normalize = value => {
    if (value === undefined) return {};
    if (!plain(value) || Reflect.ownKeys(value).some(key => !byName.has(key))) throw invalid(code, `Use a plain object containing only the ${fields.length} ${label} appearance fields.`);
    for (const key of Reflect.ownKeys(value)) if (!Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), 'value')) throw invalid(code, 'Appearance fields must contain data values.');
    const rest = Object.fromEntries(Object.entries(value).filter(([key]) => !extras.has(key)));
    const normalized = base.normalize(rest);
    for (const [name, f] of extras) if (Object.hasOwn(value, name)) normalized[name] = EXTRA[f.kind].normalize(value[name], code, f.label);
    return Object.fromEntries(fields.filter(f => Object.hasOwn(normalized, f.name)).map(f => [f.name, normalized[f.name]]));
  };
  return Object.freeze({
    fields,
    normalize,
    css(value) {
      const n = normalize(value);
      const rest = Object.fromEntries(Object.entries(n).filter(([key]) => !extras.has(key)));
      const out = base.css(rest);
      for (const [name, f] of extras) if (Object.hasOwn(n, name)) out[f.cssProperty] = EXTRA[f.kind].css(n[name]);
      return Object.fromEntries(fields.filter(f => Object.hasOwn(out, f.cssProperty)).map(f => [f.cssProperty, out[f.cssProperty]]));
    },
    parseInput: (name, raw) => extras.has(name) ? EXTRA[extras.get(name).kind].parse(raw, code, extras.get(name).label) : base.parseInput(name, raw),
    formatInput: (name, value) => extras.has(name) ? (value === undefined ? '' : String(EXTRA[extras.get(name).kind].css(EXTRA[extras.get(name).kind].normalize(value, code, name)))) : base.formatInput(name, value),
    nativeValue: (name, value, platform) => extras.has(name) ? EXTRA[extras.get(name).kind].native(value, platform)
      : byName.get(name)?.kind === 'color' || byName.get(name)?.kind === 'font' ? quote(String(value), platform)
      : typeof value === 'number' ? double(value) : base.nativeValue(name, value, platform),
  });
}

// ---- charts ----------------------------------------------------------------------------------------------------------
export const CHART_TAGS = Object.freeze(['md-line-chart', 'md-area-chart', 'md-bar-chart', 'md-pie-chart', 'md-sparkline']);
const chartPrefix = tag => tag.slice(3);   // line-chart, …, sparkline
const CHART_FIELD_SPECS = [
  ['blockSize', 'Block size', 'block-size', 'length'], ['minBlockSize', 'Minimum block size', 'min-block-size', 'length'],
  ['aspectRatio', 'Aspect ratio', 'aspect-ratio', 'ratio'], ['background', 'Background', 'background', 'color'], ['padding', 'Padding', 'padding', 'length'],
  ['shape', 'Corner radius', 'shape', 'length'], ['emptyColor', 'Empty state text color', 'empty-color', 'color'],
  ['emptyBackground', 'Empty state background', 'empty-background', 'color'], ['emptyFont', 'Empty state font family', 'empty-font', 'font'],
  ['emptyFontSize', 'Empty state font size', 'empty-font-size', 'length'], ['emptyIconSize', 'Empty state icon size', 'empty-icon-size', 'length'],
  ['zoomSize', 'Zoom slider size', 'zoom-size', 'length'], ['zoomTrackColor', 'Zoom track color', 'zoom-track-color', 'color'],
  ['zoomWindowColor', 'Zoom window color', 'zoom-window-color', 'color'], ['zoomHandleColor', 'Zoom handle color', 'zoom-handle-color', 'color'],
  ['zoomBandColor', 'Zoom band color', 'zoom-band-color', 'color'], ['centerColor', 'Center slot color', 'center-color', 'color'],
  ['inlineSize', 'Inline size', 'inline-size', 'length'], ['minInlineSize', 'Minimum inline size', 'min-inline-size', 'length'],
];
const CHART_FIELD_NAMES = {
  'md-line-chart': CHART_FIELD_SPECS.slice(0, 16).map(s => s[0]), 'md-area-chart': CHART_FIELD_SPECS.slice(0, 16).map(s => s[0]),
  'md-bar-chart': CHART_FIELD_SPECS.slice(0, 16).map(s => s[0]), 'md-pie-chart': [...CHART_FIELD_SPECS.slice(0, 11).map(s => s[0]), 'centerColor'],
  'md-sparkline': ['blockSize', 'inlineSize', 'minInlineSize'],
};
const chartFields = tag => Object.freeze(CHART_FIELD_SPECS.filter(([name]) => CHART_FIELD_NAMES[tag].includes(name))
  .map(([name, label, suffix, kind]) => (EXTRA[kind] ? extraField : appearanceField)(chartPrefix(tag), name, label, suffix, kind)));
const CHART_LABELS = { 'md-line-chart': 'Line Chart', 'md-area-chart': 'Area Chart', 'md-bar-chart': 'Bar Chart', 'md-pie-chart': 'Pie Chart', 'md-sparkline': 'Sparkline' };
export const CHART_APPEARANCE_KEYS = Object.freeze({ 'md-line-chart': 'lineChartAppearance', 'md-area-chart': 'areaChartAppearance', 'md-bar-chart': 'barChartAppearance', 'md-pie-chart': 'pieChartAppearance', 'md-sparkline': 'sparklineAppearance' });
export const CHART_APPEARANCES = Object.freeze(Object.fromEntries(CHART_TAGS.map(tag => [tag, profile(chartFields(tag), 'INVALID_CHART_APPEARANCE', CHART_LABELS[tag])])));
export const CHART_APPEARANCE_GROUPS = Object.freeze(Object.fromEntries(CHART_TAGS.map(tag => [tag, tag === 'md-sparkline'
  ? [['Size', ['blockSize', 'inlineSize', 'minInlineSize']]]
  : [['Container', ['blockSize', 'minBlockSize', 'aspectRatio', 'background', 'padding', 'shape']], ['Empty state', ['emptyColor', 'emptyBackground', 'emptyFont', 'emptyFontSize', 'emptyIconSize']],
     tag === 'md-pie-chart' ? ['Center slot', ['centerColor']] : ['Zoom', ['zoomSize', 'zoomTrackColor', 'zoomWindowColor', 'zoomHandleColor', 'zoomBandColor']]]])));

// ---- retained property updates --------------------------------------------------------------------------------------
// Source property types (IR). `json`: chart data / axes / labels objects and arrays (plain JSON, at most 256 KiB).
const JSON_PROPS = ['markLines', 'series', 'xAxis', 'yAxis', 'yAxes', 'yAxis2', 'tableLabels', 'data', 'labels', 'referenceAreas', 'ringWidths'];
const E = values => ({ enum: values });
const DENSITY = E([0, -1, -2, -3, -4]);
const CURVE = E(['linear', 'smooth', 'monotone', 'step', 'step-before', 'step-middle']);
const LEGEND = E(['top', 'bottom', 'left', 'right', 'top-start', 'top-end', 'bottom-start', 'bottom-end', 'none']);
const TOOLTIP = E(['axis', 'item', 'none']);
const ANIMATION = E(['expressive', 'grow', 'fade', 'draw', 'stagger', 'none']);
const ALIGN = E(['start', 'center', 'end']);
const STACK = E(['none', 'normal', 'percent', 'stream']);
const GRID = E(['none', 'horizontal', 'vertical', 'both']);
const ZOOM = E(['none', 'inside', 'slider', 'both']);
const S = 'string', N = 'number', B = 'boolean', J = 'json', SN = 'stringOrNumber', OS = 'optionalString';
const CHART_COMMON = { label: S, subtitle: OS, titleAlign: ALIGN, legend: LEGEND, tooltip: TOOLTIP, locale: S, heightProp: S, noAnimation: B, animation: ANIMATION, animationDuration: N, density: DENSITY };
export const CHART_PROPERTY_TYPES = Object.freeze({
  'md-line-chart': { ...CHART_COMMON, markLines: J, series: J, xAxis: J, yAxis: J, yAxes: J, curve: CURVE, stack: STACK, connectNulls: B, showMarks: B, lineWidth: N, markSize: N,
    area: B, showLine: B, grid: GRID, axisTicks: B, inverted: B, showLabels: B, seriesLabels: B, zoom: ZOOM, labelEmpty: S, labelPlot: S, labelPoint: S, labelZoomStart: S,
    labelZoomEnd: S, summary: S, tableLabels: J, loading: B, loadingLabel: S },
  'md-area-chart': { ...CHART_COMMON, series: J, xAxis: J, yAxis: J, curve: CURVE, stack: STACK, connectNulls: B, showMarks: B, lineWidth: N, markSize: N, zoom: ZOOM,
    fillOpacity: N, showLine: B, grid: GRID, inverted: B, seriesLabels: B, summary: S, tableLabels: J, labelEmpty: S, loading: B, loadingLabel: S, labelZoomStart: S,
    labelZoomEnd: S, axisTicks: B, showLabels: B, labelPlot: S, labelPoint: S },
  'md-bar-chart': { ...CHART_COMMON, series: J, xAxis: J, yAxis: J, yAxis2: J, layout: E(['vertical', 'horizontal']), stack: STACK, categoryGap: SN, barGap: SN, barWidth: N,
    cornerRadius: N, zoom: ZOOM, showLabels: B, showTotals: B, chevron: B, polar: B, polarHole: N, polarSweep: N, axisTicks: B, clickable: B, labelZoomStart: S,
    labelZoomEnd: S, labelPlot: S, labelPoint: S, loading: B, loadingLabel: S },
  'md-pie-chart': { ...CHART_COMMON, data: J, innerRadius: SN, outerRadius: SN, startAngle: N, endAngle: N, paddingAngle: N, cornerRadius: N, showLabels: B,
    labelMode: E(['value', 'name', 'both']), monochrome: S, gradient: B, highlight: E(['slice', 'series', 'none']), summary: S, tableLabels: J, labelEmpty: S, loading: B,
    loadingLabel: S, labelPlot: S, labelPoint: S, ringWidths: J },
  'md-sparkline': { data: J, labels: J, variant: E(['line', 'bar', 'area']), color: S, curve: CURVE, showTooltip: B, showMarks: E(['none', 'extremes', 'edges', 'all']),
    referenceAreas: J, heightProp: S, noAnimation: B, cornerRadius: N, min: N, max: N, lineWidth: N, markSize: N, barWidth: N },
});
/** Retained updates: every source property except the formatter / renderer closures (native API only). */
export const CHART_UPDATE_PROPERTIES = Object.freeze(Object.fromEntries(Object.entries(CHART_PROPERTY_TYPES).map(([tag, types]) => [tag, Object.freeze(Object.keys(types))])));
const bytes = value => new TextEncoder().encode(value).length;
function jsonData(value, depth = 0) {
  if (depth > 16) return false;
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.length <= 10000 && value.every(item => jsonData(item, depth + 1));
  return plain(value) && Reflect.ownKeys(value).every(key => typeof key === 'string' && Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), 'value') && jsonData(value[key], depth + 1));
}
/** Whether `value` is valid for a property `type` of the tables above (enum, boolean, number, string, JSON …). */
export function validPropertyValue(type, value) {
  if (type === undefined) return false;
  if (type.enum) return type.enum.includes(value);
  switch (type) {
    case B: return typeof value === 'boolean';
    case N: return typeof value === 'number' && Number.isFinite(value);
    case S: return typeof value === 'string' && bytes(value) <= 4096;
    case OS: return value === null || typeof value === 'string' && bytes(value) <= 4096;
    case SN: return typeof value === 'number' && Number.isFinite(value) || typeof value === 'string' && bytes(value) <= 64;
    case J: return value === null || (Array.isArray(value) || plain(value)) && jsonData(value) && bytes(JSON.stringify(value)) <= 262144;
    default: return false;
  }
}
export const validChartUpdate = (tag, key, value) => validPropertyValue(CHART_PROPERTY_TYPES[tag]?.[key], value);
/** Property-type building blocks for other components' tables. */
export const PROPERTY_TYPE = Object.freeze({ string: S, number: N, boolean: B, json: J, stringOrNumber: SN, optionalString: OS, enumOf: E, density: DENSITY });

// ---- methods with results -------------------------------------------------------------------------------------------
export const CHART_METHODS = Object.freeze({
  'md-line-chart': ['refreshTheme', 'resize', 'replay', 'toDataURL', 'setZoom', 'resetZoom'], 'md-area-chart': ['refreshTheme', 'resize', 'replay', 'toDataURL', 'setZoom', 'resetZoom'],
  'md-bar-chart': ['refreshTheme', 'resize', 'replay', 'drill', 'toDataURL', 'setZoom', 'resetZoom'], 'md-pie-chart': ['refreshTheme', 'resize', 'replay', 'drill', 'toDataURL'],
  'md-sparkline': ['refreshTheme', 'resize'],
});
export const nativeChartMethod = (tag, method) => Boolean(CHART_METHODS[tag]?.includes(method));
/** Wire arguments: setZoom(startIndex, endIndex) — two finite numbers; drill(index, direction?) — an integer from 0 and down/up. */
export function chartMethodArguments(tag, method, args) {
  const fail = message => { throw Object.assign(new Error(message), { code: 'INVALID_METHOD' }); };
  if (method === 'setZoom') {
    if (args.length !== 2 || !args.every(value => typeof value === 'number' && Number.isFinite(value))) fail('setZoom requires two numbers: startIndex and endIndex.');
    return [args[0], args[1]];
  }
  if (method === 'drill') {
    if (args.length < 1 || args.length > 2 || !Number.isSafeInteger(args[0]) || args[0] < 0 || args.length === 2 && !['down', 'up'].includes(args[1])) fail('drill requires an index (an integer from 0) and optionally down or up.');
    return args.length === 2 ? [args[0], args[1]] : [args[0]];
  }
  if (args.length) fail(`${method} requires no arguments.`);
  return [];
}
/** toDataURL(): the canvas layer as a PNG data URL (bounded). */
export const validChartMethodValue = value => typeof value === 'string' && value.length <= 16 * 1024 * 1024 && /^data:(?:image\/png;base64,[A-Za-z0-9+/=]*|,)$/.test(value);

// Hook-profile helpers for other components' appearance modules.
export { profile as hookProfile, extraField as hookExtraField, EXTRA as HOOK_EXTRA_KINDS };

/** The charts' typed part targets (::part names; AWCChartPart natively, gate-7 r5 R5-06). */
export const CARTESIAN_CHART_PARTS = Object.freeze(["header", "canvas", "empty", "loading", "footer", "zoom", "zoom-slider", "zoom-pan", "zoom-band", "zoom-track", "zoom-window", "zoom-handle"]);
export const CHART_PARTS = Object.freeze({ 'md-line-chart': CARTESIAN_CHART_PARTS, 'md-area-chart': CARTESIAN_CHART_PARTS, 'md-bar-chart': CARTESIAN_CHART_PARTS,
  'md-pie-chart': Object.freeze(["header", "canvas", "center", "empty", "loading", "footer"]), 'md-sparkline': Object.freeze(['canvas']) });
