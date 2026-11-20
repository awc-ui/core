import { appearanceField, appearanceProfile } from './accordion-appearance.js';

// md-search's sixty typed hooks, its typed parts and its retained property updates. Field order follows the native initializers
// (Swift requires labelled arguments in order). Lengths are px (points on SwiftUI, dp on Android), durations ms, colours #RRGGBB
// or #RRGGBBAA, the container elevation a list of shadow layers. The three easings are cubic-bezier control points.
const sf = (name, label, suffix, kind) => appearanceField('search', name, label, suffix, kind);
const easing = (name, label, suffix) => Object.freeze({ name, label, cssProperty: `--md-search-${suffix}`, kind: 'easing',
  hint: 'cubic-bezier(x1, y1, x2, y2) with x1 and x2 from 0 to 1.' });
export const SEARCH_APPEARANCE_FIELDS = Object.freeze([
  sf('containerColor', 'Container color', 'container-color', 'color'),
  sf('containerElevation', 'Container elevation', 'container-elevation', 'shadow'),
  sf('leadingIconColor', 'Leading icon color', 'leading-icon-color', 'color'),
  sf('trailingIconColor', 'Trailing icon color', 'trailing-icon-color', 'color'),
  sf('iconColor', 'Icon color', 'icon-color', 'color'),
  sf('loadingColor', 'Loading indicator color', 'loading-color', 'color'),
  sf('containerShape', 'Container corner radius', 'container-shape', 'length'),
  sf('containerHeight', 'Container height', 'container-height', 'length'),
  sf('iconButtonSize', 'Icon button size', 'icon-button-size', 'length'),
  sf('leadingIconLabelGap', 'Leading icon to text gap', 'leading-icon-label-gap', 'length'),
  sf('trailingIconLabelGap', 'Text to trailing icons gap', 'trailing-icon-label-gap', 'length'),
  sf('containerPaddingInline', 'Container inline padding', 'container-padding-inline', 'length'),
  sf('containerPaddingInlineFocused', 'Container inline padding (focused)', 'container-padding-inline-focused', 'length'),
  sf('leadingPaddingInline', 'Leading inline padding', 'leading-padding-inline', 'length'),
  sf('trailingPaddingInline', 'Trailing inline padding', 'trailing-padding-inline', 'length'),
  sf('inputColor', 'Input text color', 'input-color', 'color'),
  sf('inputFontFamily', 'Input font family', 'input-font-family', 'font'),
  sf('inputFontSize', 'Input font size', 'input-font-size', 'length'),
  sf('inputLineHeight', 'Input line height', 'input-line-height', 'length'),
  sf('inputFontWeight', 'Input font weight', 'input-font-weight', 'weight'),
  sf('inputLetterSpacing', 'Input letter spacing', 'input-letter-spacing', 'length'),
  sf('placeholderColor', 'Placeholder color', 'placeholder-color', 'color'),
  sf('stateLayerColor', 'State layer color', 'state-layer-color', 'color'),
  sf('focusIndicatorColor', 'Focus indicator color', 'focus-indicator-color', 'color'),
  sf('focusIndicatorOffset', 'Focus indicator offset', 'focus-indicator-offset', 'length'),
  sf('avatarSize', 'Avatar size', 'avatar-size', 'length'),
  sf('panelMinBlockSize', 'Panel minimum height', 'panel-min-block-size', 'length'),
  sf('panelMaxBlockSize', 'Panel maximum height', 'panel-max-block-size', 'length'),
  sf('maxBlockSize', 'Full-screen maximum height', 'max-block-size', 'length'),
  sf('dockedPanelShape', 'Docked panel corner radius', 'docked-panel-shape', 'length'),
  sf('panelOffset', 'Panel offset', 'panel-offset', 'length'),
  sf('barFullscreenColor', 'Full-screen bar color', 'bar-fullscreen-color', 'color'),
  sf('fullscreenResultsColor', 'Full-screen results color', 'fullscreen-results-color', 'color'),
  sf('dividerColor', 'Divider color', 'divider-color', 'color'),
  sf('dividerThickness', 'Divider thickness', 'divider-thickness', 'length'),
  sf('fullscreenBarPanelGap', 'Full-screen bar to panel gap', 'fullscreen-bar-panel-gap', 'length'),
  sf('emptyColor', 'Empty state color', 'empty-color', 'color'),
  sf('emptyPaddingBlock', 'Empty state block padding', 'empty-padding-block', 'length'),
  sf('emptyPaddingInline', 'Empty state inline padding', 'empty-padding-inline', 'length'),
  sf('expandInset', 'Resting inset', 'expand-inset', 'length'),
  sf('expandFocusedInset', 'Focused inset', 'expand-focused-inset', 'length'),
  sf('expandDuration', 'Expand duration', 'expand-duration', 'duration'),
  easing('expandEasing', 'Expand easing', 'expand-easing'),
  sf('panelMotionDuration', 'Panel motion duration', 'panel-motion-duration', 'duration'),
  sf('fullscreenExpandDuration', 'Full-screen expand duration', 'fullscreen-expand-duration', 'duration'),
  easing('fullscreenExpandEasing', 'Full-screen expand easing', 'fullscreen-expand-easing'),
  easing('fullscreenCollapseEasing', 'Full-screen collapse easing', 'fullscreen-collapse-easing'),
  sf('dividedFullscreenBarHeight', 'Divided full-screen bar height', 'divided-fullscreen-bar-height', 'length'),
  sf('containerMinInlineSize', 'Container minimum width', 'container-min-inline-size', 'length'),
  sf('containerMaxInlineSize', 'Container maximum width', 'container-max-inline-size', 'length'),
  sf('iconSize', 'Icon size', 'icon-size', 'length'),
  sf('focusIndicatorThickness', 'Focus indicator thickness', 'focus-indicator-thickness', 'length'),
  sf('panelPaddingBlockStart', 'Panel top padding', 'panel-padding-block-start', 'length'),
  sf('containedBackgroundColor', 'Contained background color', 'contained-background-color', 'color'),
  sf('containedDockedPanelOffset', 'Contained docked panel offset', 'contained-docked-panel-offset', 'length'),
  sf('fullscreenBarOffsetBlockStart', 'Full-screen bar top offset', 'fullscreen-bar-offset-block-start', 'length'),
  sf('fullscreenBarOffsetInline', 'Full-screen bar inline offset', 'fullscreen-bar-offset-inline', 'length'),
  sf('fullscreenCollapseDuration', 'Full-screen collapse duration', 'fullscreen-collapse-duration', 'duration'),
  sf('hoverStateLayerOpacity', 'Hover state layer opacity', 'hover-state-layer-opacity', 'opacity'),
  sf('pressedStateLayerOpacity', 'Pressed state layer opacity', 'pressed-state-layer-opacity', 'opacity'),
]);
/** The source's ::part names with their typed native part fields (AWCSearchPartAppearance). */
export const SEARCH_PARTS = Object.freeze({
  bar: ['barBackgroundColor'], 'state-layer': ['stateLayerColor', 'stateLayerOpacity'], leading: ['leadingBackgroundColor'],
  'leading-state-layer': ['leadingStateLayerColor', 'leadingStateLayerOpacity'], input: ['inputColor', 'caretColor'],
  trailing: ['trailingBackgroundColor'], 'clear-button': ['clearButtonBackgroundColor'], 'voice-button': ['voiceButtonBackgroundColor'],
  'trigger-button': ['triggerButtonBackgroundColor'], divider: ['dividerColor'], panel: ['panelBackgroundColor'], empty: ['emptyColor'],
  'results-viewport': ['resultsViewportBackgroundColor'],
  // story 1-2 session 8: trigger (display: contents, no box: stored, not painted), status (visually hidden: stored, not painted).
  trigger: ['triggerBackgroundColor'], 'panel-body': ['panelBodyBackgroundColor'], 'results-host': ['resultsHostBackgroundColor'],
  loading: ['loadingBackgroundColor'], 'loading-shape': ['loadingShapeBackgroundColor'], status: ['statusBackgroundColor'],
});
/** The typed part fields in native initializer order. */
export const SEARCH_PART_FIELDS = Object.freeze(['barBackgroundColor', 'stateLayerColor', 'stateLayerOpacity', 'leadingBackgroundColor', 'leadingStateLayerColor',
  'leadingStateLayerOpacity', 'inputColor', 'caretColor', 'trailingBackgroundColor', 'clearButtonBackgroundColor', 'voiceButtonBackgroundColor',
  'triggerButtonBackgroundColor', 'dividerColor', 'panelBackgroundColor', 'emptyColor', 'resultsViewportBackgroundColor',
  'triggerBackgroundColor', 'panelBodyBackgroundColor', 'resultsHostBackgroundColor', 'loadingBackgroundColor', 'loadingShapeBackgroundColor', 'statusBackgroundColor']);
const CODE = 'INVALID_SEARCH_APPEARANCE';
const invalid = message => Object.assign(new Error(message), { code: CODE });
const special = new Set(['expandEasing', 'fullscreenExpandEasing', 'fullscreenCollapseEasing']);
const base = appearanceProfile(SEARCH_APPEARANCE_FIELDS.filter(f => !special.has(f.name)), CODE, 'Search');
const byName = new Map(SEARCH_APPEARANCE_FIELDS.map(f => [f.name, f]));
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const css = value => { const text = String(value); return text.includes('e') ? String(Number(value.toPrecision(15))) : text; };
const NUMBER = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;
function easing1(name, value) {
  if (!Array.isArray(value) || value.length !== 4 || Reflect.ownKeys(value).length !== 5 || !value.every(item => typeof item === 'number' && Number.isFinite(item))
    || value[0] < 0 || value[0] > 1 || value[2] < 0 || value[2] > 1) throw invalid(`${byName.get(name).label} must be four cubic-bezier control points with x1 and x2 from 0 to 1.`);
  return value.map(item => Object.is(item, -0) ? 0 : item);
}
const easingCSS = value => `cubic-bezier(${value.map(css).join(', ')})`;
function normalize(value) {
  if (value === undefined) return {};
  if (!plain(value)) throw invalid(`Use a plain object containing only the ${SEARCH_APPEARANCE_FIELDS.length} Search appearance fields.`);
  const rest = {}, extra = {};
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!Object.hasOwn(descriptor, 'value')) throw invalid('Appearance fields must contain data values.');
    if (special.has(key)) extra[key] = easing1(key, value[key]); else rest[key] = value[key];
  }
  const normalized = { ...base.normalize(rest), ...extra };
  return Object.fromEntries(SEARCH_APPEARANCE_FIELDS.filter(f => Object.hasOwn(normalized, f.name)).map(f => [f.name, normalized[f.name]]));
}
export const searchAppearance = Object.freeze({
  fields: SEARCH_APPEARANCE_FIELDS,
  normalize,
  css(value) {
    const n = normalize(value), out = base.css(Object.fromEntries(Object.entries(n).filter(([k]) => !special.has(k))));
    for (const f of SEARCH_APPEARANCE_FIELDS) if (special.has(f.name) && Object.hasOwn(n, f.name)) out[f.cssProperty] = easingCSS(n[f.name]);
    return Object.fromEntries(SEARCH_APPEARANCE_FIELDS.filter(f => Object.hasOwn(out, f.cssProperty)).map(f => [f.cssProperty, out[f.cssProperty]]));
  },
  parseInput(name, raw) {
    if (!special.has(name)) return base.parseInput(name, raw);
    const match = /^cubic-bezier\(([^,()]+),([^,()]+),([^,()]+),([^,()]+)\)$/i.exec(String(raw ?? '').trim());
    return easing1(name, match ? match.slice(1).map(item => NUMBER.test(item.trim()) ? Number(item) : NaN) : []);
  },
  formatInput(name, value) {
    if (!special.has(name)) return base.formatInput(name, value);
    return value === undefined ? '' : easingCSS(easing1(name, value));
  },
  nativeValue(name, value, platform) {
    if (!special.has(name)) return base.nativeValue(name, value, platform);
    const points = easing1(name, value);
    return platform === 'swift' ? `[${points.map(css).join(', ')}]` : `listOf(${points.map(item => Number.isInteger(item) ? `${item}.0` : css(item)).join(', ')})`;
  },
});

// ---- retained property updates (every source property except the trigger element reference) ----
export const SEARCH_UPDATE_PROPERTIES = Object.freeze(['variant', 'layout', 'trigger', 'triggerIcon', 'triggerFor', 'fullWidth', 'value', 'placeholder', 'open',
  'disabled', 'elevation', 'leadingIcon', 'openLeadingIcon', 'showClearButton', 'voiceSearch', 'escapeCloses', 'dismissOnOutsideClick', 'scrollShadow',
  'maxBlockSize', 'inputAriaLabel', 'initialFocus', 'announceResults', 'resultsLabel', 'noResultsLabel', 'loading', 'debounce', 'throttle', 'loadingLabel', 'density']);
const BOOLEANS = new Set(['fullWidth', 'open', 'disabled', 'showClearButton', 'voiceSearch', 'escapeCloses', 'dismissOnOutsideClick', 'scrollShadow', 'announceResults', 'loading']);
const text = value => typeof value === 'string' && new TextEncoder().encode(value).length <= 4096;
/** True when `value` is a valid retained update of md-search `key` (the source property types). */
export function validSearchUpdate(key, value) {
  if (BOOLEANS.has(key)) return typeof value === 'boolean';
  switch (key) {
    case 'variant': return ['contained', 'divided'].includes(value);
    case 'layout': return ['full-screen', 'docked'].includes(value);
    case 'trigger': return ['', 'bar', 'icon'].includes(value);
    case 'initialFocus': return ['auto', 'input', 'leading'].includes(value);
    case 'elevation': return [0, 1, 2, 3, 4, 5].includes(value);
    case 'density': return [0, -1, -2, -3, -4].includes(value);
    case 'debounce': case 'throttle': return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1e6;
    default: return text(value);
  }
}
