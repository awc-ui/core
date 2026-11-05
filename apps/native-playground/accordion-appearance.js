import { normalizeCornerShape, cornerShapeCSS, parseCornerShape, cornerShapeNativeValue } from './corner-shape.js';
import { normalizeSkeletonLength, skeletonLengthCSS, parseSkeletonLength, skeletonLengthNativeValue } from './skeleton-length.js';

// Typed source hooks of md-accordion (fourteen) and md-accordion-item (twenty-four).
// Field order follows the native initializers (Swift requires labelled arguments in order).
const invalid = (code, message) => Object.assign(new Error(message), { code });
const number = '[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:e[+-]?\\d+)?';
const hint = {
  color: '#RRGGBB or #RRGGBBAA.',
  corners: 'Physical CSS radius shorthand, including asymmetric, elliptical and percentage corners.',
  length: 'Length in px (points on SwiftUI, dp on Android).',
  opacity: 'A number from 0 to 1.',
  duration: 'Time in ms or s.',
  insets: 'CSS padding shorthand in px: one to four values (top, right, bottom, left).',
  shadow: 'CSS box-shadow list in px with #hex or rgb()/rgba() colors, or none.',
  affine: 'px, %, em, rem or ch; additive calc(). Relative terms use the parent and font context.',
  font: 'A CSS font-family list, for example serif or "Roboto Flex", sans-serif.',
  integer: 'An integer, for example 1000.',
  weight: 'A font weight from 1 to 1000, for example 500.',
  sheetShape: 'One to four px radii, optionally / and one to four vertical radii, for example 28px or 28px 28px 0 0.',
};
const field = (prefix, name, label, suffix, kind) => Object.freeze({ name, label, cssProperty: `--md-${prefix}-${suffix}`, kind, hint: hint[kind] });
/** Shared typed-hook field for other components' appearance modules. */
export const appearanceField = field;
export const ACCORDION_APPEARANCE_FIELDS = Object.freeze([
  field('accordion', 'gap', 'Gap between items', 'gap', 'length'),
  field('accordion', 'outlineColor', 'Outline color', 'outline-color', 'color'),
  field('accordion', 'containerShape', 'Container corners', 'container-shape', 'corners'),
  field('accordion', 'elevation', 'Elevation', 'elevation', 'shadow'),
  field('accordion', 'dropPlaceholderColor', 'Drop placeholder color', 'drop-placeholder-color', 'color'),
  field('accordion', 'dropPlaceholderOutlineColor', 'Drop placeholder outline color', 'drop-placeholder-outline-color', 'color'),
  field('accordion', 'dropPlaceholderOutlineWidth', 'Drop placeholder outline width', 'drop-placeholder-outline-width', 'length'),
  field('accordion', 'dropPlaceholderShape', 'Drop placeholder corners', 'drop-placeholder-shape', 'corners'),
  field('accordion', 'dropPlaceholderOpacity', 'Drop placeholder opacity', 'drop-placeholder-opacity', 'opacity'),
  field('accordion', 'floatingWidth', 'Floating width', 'floating-width', 'length'),
  field('accordion', 'floatingBackground', 'Floating background', 'floating-bg', 'color'),
  field('accordion', 'floatingElevation', 'Floating elevation', 'floating-elevation', 'shadow'),
  field('accordion', 'floatingElevationActive', 'Floating elevation while dragging', 'floating-elevation-active', 'shadow'),
  field('accordion', 'floatingRadius', 'Floating corners', 'floating-radius', 'corners'),
]);
export const ACCORDION_ITEM_APPEARANCE_FIELDS = Object.freeze([
  field('accordion-item', 'containerColor', 'Container color', 'container-color', 'color'),
  field('accordion-item', 'containerColorExpanded', 'Expanded container color', 'container-color-expanded', 'color'),
  field('accordion-item', 'headerColor', 'Header color', 'header-color', 'color'),
  field('accordion-item', 'headerColorExpanded', 'Expanded header color', 'header-color-expanded', 'color'),
  field('accordion-item', 'headlineColor', 'Headline color', 'headline-color', 'color'),
  field('accordion-item', 'headlineColorExpanded', 'Expanded headline color', 'headline-color-expanded', 'color'),
  field('accordion-item', 'supportingColor', 'Supporting text color', 'supporting-color', 'color'),
  field('accordion-item', 'iconColor', 'Icon color', 'icon-color', 'color'),
  field('accordion-item', 'iconColorExpanded', 'Expanded icon color', 'icon-color-expanded', 'color'),
  field('accordion-item', 'stateLayerColor', 'State layer color', 'state-layer-color', 'color'),
  field('accordion-item', 'stateLayerColorExpanded', 'Expanded state layer color', 'state-layer-color-expanded', 'color'),
  field('accordion-item', 'containerShape', 'Container corners', 'container-shape', 'corners'),
  field('accordion-item', 'containerShapeExpanded', 'Expanded container corners', 'container-shape-expanded', 'corners'),
  field('accordion-item', 'headerPadding', 'Header padding', 'header-padding', 'insets'),
  field('accordion-item', 'contentPadding', 'Content padding', 'content-padding', 'insets'),
  field('accordion-item', 'headerMinHeight', 'Header minimum height', 'header-min-height', 'length'),
  field('accordion-item', 'expandDuration', 'Expand duration', 'expand-duration', 'duration'),
  field('accordion-item', 'collapseDuration', 'Collapse duration', 'collapse-duration', 'duration'),
  field('accordion-item', 'elevation', 'Elevation', 'elevation', 'shadow'),
  field('accordion-item', 'elevationExpanded', 'Expanded elevation', 'elevation-expanded', 'shadow'),
  field('accordion-item', 'containerColorDragging', 'Dragging container color', 'container-color-dragging', 'color'),
  field('accordion-item', 'containerShapeDragging', 'Dragging container corners', 'container-shape-dragging', 'corners'),
  field('accordion-item', 'chassisHandleColor', 'Floating grip color', 'chassis-handle-color', 'color'),
  field('accordion-item', 'chassisHandleBackgroundHover', 'Floating grip hover tint', 'chassis-handle-bg-hover', 'color'),
]);

const plain = value => value && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const finite = (value, code, label, { min = -Infinity, max = Infinity } = {}) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw invalid(code, `${label} must be a finite number${min > -Infinity ? ` from ${min}` : ''}${max < Infinity ? ` to ${max}` : ''}.`);
  return Object.is(value, -0) ? 0 : value;
};
const hex = (value, code, label) => {
  if (typeof value !== 'string' || !/^#[\da-f]{6}(?:[\da-f]{2})?$/i.test(value)) throw invalid(code, `${label} must be #RRGGBB or #RRGGBBAA.`);
  return value.toUpperCase();
};
function dataObject(value, keys, code) {
  if (!plain(value) || Reflect.ownKeys(value).some(key => !keys.includes(key))) throw invalid(code, `Use a plain object containing only ${keys.join(', ')}.`);
  for (const key of Reflect.ownKeys(value)) if (!Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), 'value')) throw invalid(code, 'Appearance fields must contain data values.');
  return value;
}
function normalizeInsets(value, code, label) {
  dataObject(value, ['top', 'right', 'bottom', 'left'], code);
  return Object.fromEntries(['top', 'right', 'bottom', 'left'].map(edge => {
    if (!Object.hasOwn(value, edge)) throw invalid(code, `${label} needs top, right, bottom and left.`);
    return [edge, finite(value[edge], code, label, { min: 0 })];
  }));
}
function normalizeShadow(value, code, label) {
  if (!Array.isArray(value)) throw invalid(code, `${label} must be a list of shadow layers (empty for none).`);
  return value.map(layer => {
    dataObject(layer, ['x', 'y', 'blur', 'spread', 'color', 'inset'], code);
    const length = key => Object.hasOwn(layer, key) ? finite(layer[key], code, label, key === 'blur' ? { min: 0 } : {}) : 0;
    if (Object.hasOwn(layer, 'inset') && typeof layer.inset !== 'boolean') throw invalid(code, `${label} inset must be true or false.`);
    return { x: length('x'), y: length('y'), blur: length('blur'), spread: length('spread'), color: Object.hasOwn(layer, 'color') ? hex(layer.color, code, label) : '#000000', inset: layer.inset === true };
  });
}
function normalizeSheetShape(value, code, label) {
  dataObject(value, ['radii', 'vertical'], code);
  const list = (items, name) => {
    if (!Array.isArray(items) || !items.length || items.length > 4) throw invalid(code, `${label} needs one to four ${name}.`);
    return items.map(item => finite(item, code, label, { min: 0 }));
  };
  if (!Object.hasOwn(value, 'radii')) throw invalid(code, `${label} needs radii.`);
  return Object.hasOwn(value, 'vertical') ? { radii: list(value.radii, 'radii'), vertical: list(value.vertical, 'vertical radii') } : { radii: list(value.radii, 'radii') };
}
function normalizeValue(f, value, code) {
  switch (f.kind) {
    case 'color': return hex(value, code, f.label);
    case 'corners': try { return normalizeCornerShape(value); } catch (error) { throw invalid(code, error.message); }
    case 'length': return finite(value, code, f.label, { min: 0 });
    case 'duration': return finite(value, code, f.label, { min: 0 });
    case 'opacity': return finite(value, code, f.label, { min: 0, max: 1 });
    case 'insets': return normalizeInsets(value, code, f.label);
    case 'shadow': return normalizeShadow(value, code, f.label);
    case 'affine': try { return normalizeSkeletonLength(value); } catch (error) { throw invalid(code, `${f.label}: ${error.message}`); }
    case 'font': {
      if (typeof value !== 'string' || !value.trim() || value.length > 256 || /[;{}<>\\]/.test(value)) throw invalid(code, `${f.label} must be a CSS font-family list.`);
      return value.trim();
    }
    case 'integer': {
      if (!Number.isSafeInteger(value)) throw invalid(code, `${f.label} must be an integer.`);
      return Object.is(value, -0) ? 0 : value;
    }
    case 'sheetShape': return normalizeSheetShape(value, code, f.label);
    case 'weight': return finite(value, code, f.label, { min: 1, max: 1000 });
    default: throw invalid(code, `Unknown appearance kind ${f.kind}.`);
  }
}
const css = value => {
  const text = String(value);
  return text.includes('e') ? String(Number(value.toPrecision(15))) : text;
};
const shadowCSS = layers => layers.length ? layers.map(layer => `${layer.inset ? 'inset ' : ''}${css(layer.x)}px ${css(layer.y)}px ${css(layer.blur)}px ${css(layer.spread)}px ${layer.color}`).join(', ') : 'none';
function valueCSS(f, value) {
  switch (f.kind) {
    case 'corners': return cornerShapeCSS(value);
    case 'length': return `${css(value)}px`;
    case 'duration': return `${css(value)}ms`;
    case 'opacity': return css(value);
    case 'insets': return [value.top, value.right, value.bottom, value.left].map(item => `${css(item)}px`).join(' ');
    case 'shadow': return shadowCSS(value);
    case 'affine': return skeletonLengthCSS(value);
    case 'integer': return String(value);
    case 'weight': return css(value);
    case 'sheetShape': return value.radii.map(item => `${css(item)}px`).join(' ') + (value.vertical ? ` / ${value.vertical.map(item => `${css(item)}px`).join(' ')}` : '');
    default: return value;
  }
}
const lengthToken = (raw, code, label) => {
  const match = new RegExp(`^(${number})(px)?$`, 'i').exec(raw);
  if (!match) throw invalid(code, `${label} must be a px length.`);
  return Number(match[1]);
};
function parseShadow(raw, code, label) {
  if (/^none$/i.test(raw.trim())) return [];
  const layers = [], text = raw.trim(); let depth = 0, current = '';
  for (const character of text) {
    if (character === '(') depth += 1;
    if (character === ')') depth -= 1;
    if (depth < 0) throw invalid(code, `${label} has unbalanced parentheses.`);
    if (character === ',' && depth === 0) { layers.push(current); current = ''; } else current += character;
  }
  if (depth) throw invalid(code, `${label} has unbalanced parentheses.`);
  layers.push(current);
  return layers.map(layer => {
    const colors = layer.match(/#[\da-f]{8}\b|#[\da-f]{6}\b|rgba?\([^)]*\)/gi) || [];
    if (colors.length !== 1) throw invalid(code, `${label}: each layer needs exactly one #hex, rgb() or rgba() color.`);
    let color = colors[0];
    if (!color.startsWith('#')) {
      const parts = color.slice(color.indexOf('(') + 1, -1).split(/[\s,/]+/).filter(Boolean);
      if (parts.length < 3 || parts.length > 4) throw invalid(code, `${label}: use rgb(r, g, b) or rgba(r, g, b, a).`);
      const channel = item => { if (!/^\d+(\.\d+)?$/.test(item)) throw invalid(code, `${label}: color channels must be numbers.`); return Math.round(Math.min(255, Number(item))); };
      const alpha = parts.length === 4 ? (/%$/.test(parts[3]) ? Number(parts[3].slice(0, -1)) / 100 : Number(parts[3])) : 1;
      if (!Number.isFinite(alpha)) throw invalid(code, `${label}: alpha must be a number.`);
      color = `#${[...parts.slice(0, 3).map(channel), Math.round(Math.min(1, Math.max(0, alpha)) * 255)].map(item => item.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
      if (color.endsWith('FF') && parts.length === 3) color = color.slice(0, 7);
    }
    const tokens = layer.replace(colors[0], ' ').trim().split(/\s+/).filter(Boolean);
    const inset = tokens.filter(token => /^inset$/i.test(token)).length;
    if (inset > 1) throw invalid(code, `${label}: use inset at most once per layer.`);
    const lengths = tokens.filter(token => !/^inset$/i.test(token)).map(token => {
      const match = new RegExp(`^(${number})(px)?$`, 'i').exec(token);
      if (!match || (!match[2] && Number(match[1]) !== 0)) throw invalid(code, `${label}: shadow lengths must be px values.`);
      return Number(match[1]);
    });
    if (lengths.length < 2 || lengths.length > 4) throw invalid(code, `${label}: use x y [blur [spread]] per layer.`);
    if ((lengths[2] ?? 0) < 0) throw invalid(code, `${label}: blur must be nonnegative.`);
    return { x: lengths[0], y: lengths[1], blur: lengths[2] ?? 0, spread: lengths[3] ?? 0, color: color.toUpperCase(), inset: inset === 1 };
  });
}
function parseValue(f, raw, code) {
  const text = raw.trim();
  switch (f.kind) {
    case 'corners': try { return parseCornerShape(text); } catch (error) { throw invalid(code, error.message); }
    case 'length': return lengthToken(text, code, f.label);
    case 'opacity': { if (!new RegExp(`^${number}$`).test(text)) throw invalid(code, `${f.label} must be a number from 0 to 1.`); return Number(text); }
    case 'duration': {
      const match = new RegExp(`^(${number})(ms|s)$`, 'i').exec(text);
      if (!match) throw invalid(code, `${f.label} must be a time in ms or s.`);
      return Number(match[1]) * (match[2].toLowerCase() === 's' ? 1000 : 1);
    }
    case 'insets': {
      const values = text.split(/\s+/).map(token => lengthToken(token, code, f.label));
      if (!values.length || values.length > 4) throw invalid(code, `${f.label}: use one to four px values.`);
      const [top, right = top, bottom = top, left = right] = values;
      return { top, right, bottom, left };
    }
    case 'shadow': return parseShadow(text, code, f.label);
    case 'affine': try { return parseSkeletonLength(text); } catch (error) { throw invalid(code, `${f.label}: ${error.message}`); }
    case 'weight': {
      if (!new RegExp(`^${number}$`).test(text) || Number(text) < 1 || Number(text) > 1000) throw invalid(code, `${f.label} must be a number from 1 to 1000.`);
      return Number(text);
    }
    case 'integer': {
      if (!/^[+-]?\d+$/.test(text) || !Number.isSafeInteger(Number(text))) throw invalid(code, `${f.label} must be an integer.`);
      return Number(text) || 0;
    }
    case 'sheetShape': {
      const halves = text.split('/');
      if (halves.length > 2) throw invalid(code, `${f.label}: use at most one /.`);
      const list = part => {
        const tokens = part.trim().split(/\s+/).filter(Boolean);
        if (!tokens.length || tokens.length > 4) throw invalid(code, `${f.label}: use one to four px radii${halves.length > 1 ? ' on each side of /' : ''}.`);
        return tokens.map(token => { const value = lengthToken(token, code, f.label); if (value < 0) throw invalid(code, `${f.label}: radii must be nonnegative.`); return value; });
      };
      return halves.length === 2 ? { radii: list(halves[0]), vertical: list(halves[1]) } : { radii: list(halves[0]) };
    }
    default: return text;
  }
}
const double = value => { if (Object.is(value, -0)) return '-0.0'; const text = String(value); return /[.e]/i.test(text) ? text : `${text}.0`; };
function nativeValueFor(f, value, platform, { insetsType = 'AWCAccordionInsets', lengthType = 'AWCSkeletonLength', shapeType = 'AWCBottomSheetShape' } = {}) {
  const separator = platform === 'swift' ? ': ' : ' = ';
  switch (f.kind) {
    case 'corners': return cornerShapeNativeValue(value, platform);
    case 'insets': return `${insetsType}(${['top', 'right', 'bottom', 'left'].map(edge => `${edge}${separator}${double(value[edge])}`).join(', ')})`;
    case 'shadow': {
      const layers = value.map(layer => `AWCBoxShadow(${['x', 'y', 'blur', 'spread'].map(key => `${key}${separator}${double(layer[key])}`).join(', ')}, color${separator}"${layer.color}"${layer.inset ? `, inset${separator}true` : ''})`);
      return platform === 'swift' ? `[${layers.join(', ')}]` : `listOf(${layers.join(', ')})`;
    }
    case 'affine': return skeletonLengthNativeValue(value, platform).replace(/^AWCSkeletonLength\(/, `${lengthType}(`);
    case 'sheetShape': {
      const list = items => platform === 'swift' ? `[${items.map(double).join(', ')}]` : `listOf(${items.map(double).join(', ')})`;
      return `${shapeType}(${list(value.radii)}${value.vertical ? `${platform === 'swift' ? ', vertical: ' : ', vertical = '}${list(value.vertical)}` : ''})`;
    }
    default: return undefined;
  }
}

/** Typed hook profile: normalization, CSS, input parsing/formatting and native literals. */
export function appearanceProfile(fields, code, label, options = {}) {
  const byName = new Map(fields.map(f => [f.name, f]));
  return {
    normalize(value) {
      if (value === undefined) return {};
      if (!plain(value) || Reflect.ownKeys(value).some(key => !byName.has(key))) throw invalid(code, `Use a plain object containing only the ${fields.length} ${label} appearance fields.`);
      for (const key of Reflect.ownKeys(value)) if (!Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), 'value')) throw invalid(code, 'Appearance fields must contain data values.');
      return Object.fromEntries(fields.filter(f => Object.hasOwn(value, f.name)).map(f => [f.name, normalizeValue(f, value[f.name], code)]));
    },
    css(value) {
      const normalized = this.normalize(value);
      return Object.fromEntries(fields.filter(f => Object.hasOwn(normalized, f.name)).map(f => [f.cssProperty, valueCSS(f, normalized[f.name])]));
    },
    parseInput(name, raw) { const f = byName.get(name); return f ? parseValue(f, raw, code) : raw; },
    formatInput(name, value) {
      const f = byName.get(name);
      if (value === undefined || !f) return value === undefined ? '' : String(value);
      return valueCSS(f, normalizeValue(f, value, code));
    },
    nativeValue(name, value, platform) { const f = byName.get(name); return f ? nativeValueFor(f, value, platform, options) : undefined; },
  };
}
const parent = appearanceProfile(ACCORDION_APPEARANCE_FIELDS, 'INVALID_ACCORDION_APPEARANCE', 'Accordion');
const item = appearanceProfile(ACCORDION_ITEM_APPEARANCE_FIELDS, 'INVALID_ACCORDION_ITEM_APPEARANCE', 'Accordion Item');
export const normalizeAccordionAppearance = value => parent.normalize(value);
export const accordionAppearanceCSS = value => parent.css(value);
export const parseAccordionAppearanceInput = (name, raw) => parent.parseInput(name, raw);
export const formatAccordionAppearanceInput = (name, value) => parent.formatInput(name, value);
export const accordionAppearanceNativeValue = (name, value, platform) => parent.nativeValue(name, value, platform);
export const normalizeAccordionItemAppearance = value => item.normalize(value);
export const accordionItemAppearanceCSS = value => item.css(value);
export const parseAccordionItemAppearanceInput = (name, raw) => item.parseInput(name, raw);
export const formatAccordionItemAppearanceInput = (name, value) => item.formatInput(name, value);
export const accordionItemAppearanceNativeValue = (name, value, platform) => item.nativeValue(name, value, platform);
