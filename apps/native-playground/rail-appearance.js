import { appearanceField, appearanceProfile } from './accordion-appearance.js';
import { PROPERTY_TYPE, validPropertyValue } from './chart-appearance.js';
import { parseCornerShape, cornerShapeNativeValue } from './corner-shape.js';

// md-navigation-rail / md-navigation-rail-tab in the Laboratory: the rail's nineteen hooks (--md-navigation-rail-*, the
// stylesheet's documented list; the CEM lists eighteen, not horizontal-height) and the destination's eighteen
// (--md-navigation-rail-tab-*), which descendant destinations inherit; retained updates of every source property; the
// methods (expand / collapse / toggle / focusTab on the rail, clearSubmenuSelection on a destination) through
// AWCNavigationRailController; and the typed native part appearances of every exported part. Field order follows the
// native initializers (Swift requires labelled arguments in order). Lengths in px (points on SwiftUI, dp on Android); the
// indicator shape is one corner radius (9999 = full); the caret duration is ms; labelTypography is accepted and, as on
// the Web (no rule reads it), has no effect.
const rail = (name, label, suffix, kind) => appearanceField('navigation-rail', name, label, suffix, kind);
const tab = (name, label, suffix, kind) => appearanceField('navigation-rail-tab', name, label, suffix, kind);
export const NAVIGATION_RAIL_TAB_APPEARANCE_FIELDS = Object.freeze([
  tab('activeIconColor', 'Active icon color', 'active-icon-color', 'color'), tab('activeLabelColor', 'Active label color', 'active-label-color', 'color'),
  tab('badgeColor', 'Badge color', 'badge-color', 'color'), tab('badgeContentColor', 'Badge text color', 'badge-content-color', 'color'),
  tab('caretDuration', 'Caret rotation duration', 'caret-duration', 'duration'), tab('focusRingColor', 'Focus ring color', 'focus-ring-color', 'color'),
  tab('focusStateLayerOpacity', 'Focus state layer opacity', 'focus-state-layer-opacity', 'opacity'), tab('iconColor', 'Icon color', 'icon-color', 'color'),
  tab('iconSize', 'Icon size', 'icon-size', 'length'), tab('indicatorColor', 'Indicator color', 'indicator-color', 'color'),
  tab('indicatorHeight', 'Indicator height', 'indicator-height', 'length'), tab('indicatorShape', 'Indicator corner radius', 'indicator-shape', 'length'),
  tab('indicatorWidth', 'Indicator width', 'indicator-width', 'length'), tab('labelColor', 'Label color', 'label-color', 'color'),
  tab('labelTypography', 'Label typography (no effect, as on the Web)', 'label-typography', 'font'), tab('minHeight', 'Minimum height', 'min-height', 'length'),
  tab('pressStateLayerOpacity', 'Pressed state layer opacity', 'press-state-layer-opacity', 'opacity'), tab('stateLayerColor', 'State layer color', 'state-layer-color', 'color'),
]);
export const NAVIGATION_RAIL_APPEARANCE_FIELDS = Object.freeze([
  rail('containerColor', 'Container color', 'container-color', 'color'), rail('containerElevation', 'Elevation', 'container-elevation', 'shadow'),
  rail('containerShape', 'Container corners', 'container-shape', 'corners'), rail('containerWidth', 'Collapsed width', 'container-width', 'length'),
  rail('contentColor', 'Content color', 'content-color', 'color'), rail('destinationsGap', 'Destinations gap', 'destinations-gap', 'length'),
  rail('expandedMaxWidth', 'Expanded maximum width', 'expanded-max-width', 'length'), rail('expandedWidth', 'Expanded width', 'expanded-width', 'length'),
  rail('fabSize', 'FAB footprint', 'fab-size', 'length'), rail('footerGap', 'Footer profile gap', 'footer-gap', 'length'),
  rail('footerLeadingSize', 'Footer leading size', 'footer-leading-size', 'length'), rail('gap', 'Section gap', 'gap', 'length'),
  rail('headerSpace', 'Header space', 'header-space', 'length'), rail('horizontalHeight', 'Bar height', 'horizontal-height', 'length'),
  rail('horizontalPaddingBlock', 'Bar block padding', 'horizontal-padding-block', 'length'), rail('horizontalPaddingInline', 'Bar inline padding', 'horizontal-padding-inline', 'length'),
  rail('logoIconSize', 'Logo size', 'logo-icon-size', 'length'), rail('paddingBlock', 'Block padding', 'padding-block', 'length'),
  rail('paddingInline', 'Inline padding', 'padding-inline', 'length'),
]);
function profile(fields, code, label) {
  const base = appearanceProfile(fields, code, label);
  return Object.freeze({ fields, normalize: base.normalize.bind(base), css: base.css.bind(base), parseInput: base.parseInput.bind(base), formatInput: base.formatInput.bind(base),
    nativeValue: base.nativeValue.bind(base) });
}
export const navigationRailAppearance = profile(NAVIGATION_RAIL_APPEARANCE_FIELDS, 'INVALID_NAVIGATION_RAIL_APPEARANCE', 'Navigation Rail');
export const navigationRailTabAppearance = profile(NAVIGATION_RAIL_TAB_APPEARANCE_FIELDS, 'INVALID_NAVIGATION_RAIL_TAB_APPEARANCE', 'Navigation Rail Tab');
export const NAVIGATION_RAIL_APPEARANCE_GROUPS = Object.freeze([
  ['Container', ['containerColor', 'containerElevation', 'containerShape', 'containerWidth', 'expandedWidth', 'expandedMaxWidth', 'contentColor']],
  ['Spacing', ['paddingBlock', 'paddingInline', 'gap', 'headerSpace', 'destinationsGap']],
  ['Slots', ['logoIconSize', 'fabSize', 'footerLeadingSize', 'footerGap']],
  ['Horizontal bar', ['horizontalHeight', 'horizontalPaddingBlock', 'horizontalPaddingInline']],
]);
export const NAVIGATION_RAIL_TAB_APPEARANCE_GROUPS = Object.freeze([
  ['Indicator', ['indicatorColor', 'indicatorWidth', 'indicatorHeight', 'indicatorShape']],
  ['Icon and label', ['iconColor', 'activeIconColor', 'iconSize', 'labelColor', 'activeLabelColor', 'labelTypography', 'minHeight']],
  ['States', ['stateLayerColor', 'focusStateLayerOpacity', 'pressStateLayerOpacity', 'focusRingColor', 'caretDuration']],
  ['Badge', ['badgeColor', 'badgeContentColor']],
]);

// ---- retained updates: every source property (each re-renders the rail; variant runs the expand / collapse transition) ----
const { string: S, number: N, boolean: B, enumOf: E, density: DENSITY } = PROPERTY_TYPE;
export const NAVIGATION_RAIL_PROPERTY_TYPES = Object.freeze({
  variant: E(['standard', 'expanded']), modal: B, fullHeight: B, alignment: E(['top', 'middle', 'bottom']), expandable: B, toggleLabel: S,
  labelVisibility: E(['all', 'selected', 'none']), activeIndex: N, label: S, disableFocusManagement: B, density: DENSITY,
  orientation: E(['vertical', 'horizontal']), maxVisible: N, overflowLabel: S, overflowIcon: S,
});
export const NAVIGATION_RAIL_TAB_PROPERTY_TYPES = Object.freeze({
  icon: S, label: S, active: B, disabled: B, badge: B, badgeValue: S, href: S, target: S, value: S,
  labelVisibility: E(['all', 'selected', 'none']), expanded: B, density: DENSITY,
});
export const NAVIGATION_RAIL_UPDATE_PROPERTIES = Object.freeze(Object.keys(NAVIGATION_RAIL_PROPERTY_TYPES));
export const NAVIGATION_RAIL_TAB_UPDATE_PROPERTIES = Object.freeze(Object.keys(NAVIGATION_RAIL_TAB_PROPERTY_TYPES));
export const RAIL_TAGS = Object.freeze(['md-navigation-rail', 'md-navigation-rail-tab']);
export const validRailUpdate = (tag, key, value) => validPropertyValue((tag === 'md-navigation-rail' ? NAVIGATION_RAIL_PROPERTY_TYPES : NAVIGATION_RAIL_TAB_PROPERTY_TYPES)[key], value);

// ---- methods (AWCNavigationRailController): no results (the Web methods resolve void) ----
export const RAIL_METHODS = Object.freeze({ 'md-navigation-rail': ['expand', 'collapse', 'toggle', 'focusTab'], 'md-navigation-rail-tab': ['clearSubmenuSelection'] });
export const nativeRailMethod = (tag, method) => Boolean(RAIL_METHODS[tag]?.includes(method));
export function railMethodArguments(method, args) {
  const fail = message => { throw Object.assign(new Error(message), { code: 'INVALID_METHOD' }); };
  if (method === 'focusTab') { if (args.length !== 1 || !Number.isSafeInteger(args[0])) fail('focusTab requires one destination index (an integer).'); return [args[0]]; }
  if (args.length) fail(`${method} requires no arguments.`);
  return [];
}

// ---- typed native part appearances (the shared md-list / md-accordion vocabulary) ----
export const NAVIGATION_RAIL_PARTS = Object.freeze(['scrim', 'container', 'logo', 'logo-contracted', 'logo-expanded', 'toggle', 'header', 'fab', 'destinations', 'overflow',
  'overflow-trigger', 'footer', 'footer-profile', 'footer-leading', 'footer-content']);
export const NAVIGATION_RAIL_TAB_PARTS = Object.freeze(['indicator', 'label', 'icon-wrapper', 'icon', 'state-layer', 'caret', 'anchor']);
/** The fields each part honours (the native renderers apply exactly these; the paint suites verify each one). */
export const RAIL_PART_FIELDS = Object.freeze({
  ...Object.fromEntries(NAVIGATION_RAIL_PARTS.map(p => [p, ['backgroundColor', 'cornerShape', 'opacity']])),
  destinations: ['backgroundColor', 'cornerShape', 'opacity', 'gap'], 'overflow-trigger': ['color', 'backgroundColor', 'cornerShape', 'opacity'],
  footer: ['color', 'backgroundColor', 'cornerShape', 'opacity', 'gap'], 'footer-profile': ['color', 'backgroundColor', 'cornerShape', 'opacity', 'gap'],
  'footer-content': ['color', 'backgroundColor', 'cornerShape', 'opacity', 'fontSize', 'fontWeight', 'letterSpacing'],
});
export const RAIL_TAB_PART_FIELDS = Object.freeze({
  indicator: ['backgroundColor', 'cornerShape', 'width', 'height', 'opacity'], 'state-layer': ['backgroundColor', 'opacity'],
  'icon-wrapper': ['color', 'backgroundColor', 'cornerShape', 'opacity'], icon: ['color', 'fontSize', 'opacity'],
  label: ['color', 'fontSize', 'lineHeight', 'fontWeight', 'letterSpacing', 'opacity'], caret: ['color', 'opacity'], anchor: ['color'],
});
const railPartValues = {
  scrim: { backgroundColor: '#1A237E', opacity: 0.32 }, container: { backgroundColor: '#E3F2FD', cornerShape: parseCornerShape('12px') }, destinations: { backgroundColor: '#E0F7FA', gap: 4 },
  'overflow-trigger': { color: '#D84315', backgroundColor: '#FFE0B2', cornerShape: parseCornerShape('12px') }, footer: { color: '#BF360C', backgroundColor: '#FFFDE7' },
  'footer-profile': { backgroundColor: '#E8EAF6', cornerShape: parseCornerShape('16px'), gap: 16 }, 'footer-content': { color: '#BF360C', fontWeight: 700 },
};
const tabPartValues = {
  indicator: { backgroundColor: '#B2DFDB', cornerShape: parseCornerShape('6px'), width: 48, height: 28 }, 'state-layer': { backgroundColor: '#00695C', opacity: 0.16 },
  'icon-wrapper': { color: '#4A148C' }, icon: { color: '#E65100', fontSize: 20 }, label: { color: '#283593', fontSize: 13, lineHeight: 18, fontWeight: 600 },
  caret: { color: '#C62828' }, anchor: { color: '#1B5E20' },
};
const ORDER = ['color', 'backgroundColor', 'borderColor', 'borderWidth', 'cornerShape', 'padding', 'margin', 'width', 'height', 'minHeight', 'opacity', 'gap', 'fontSize', 'lineHeight', 'fontWeight', 'letterSpacing'];
export const railPartValuesFor = (tag, name) => (tag === 'md-navigation-rail' ? railPartValues : tabPartValues)[name] ?? { backgroundColor: '#F3EDF7' };
export function railPartFields(tag, name, platform, literal) {
  const values = railPartValuesFor(tag, name), sep = platform === 'swift' ? ': ' : ' = ';
  const num = v => platform === 'android' ? (Number.isInteger(v) ? `${v}.0` : String(v)) : String(v);
  const value = (key, v) => key === 'cornerShape' ? cornerShapeNativeValue(v, platform) : typeof v === 'string' ? literal(v, platform) : num(v);
  return ORDER.filter(k => Object.hasOwn(values, k)).map(k => `${k}${sep}${value(k, values[k])}`).join(', ');
}
