import { normalizeSegmentedContext, SEGMENTED_PARENT_PROPERTIES } from './segmented-context.js';
import { normalizeButtonGroupSelection } from './button-group-state.js';
import { componentAppearance } from './component-appearance.js';
import { partRulesCSS } from './appearance-part-rules.js';
import { normalizeThemeColorTokens } from './theme-color-tokens.js';
import { nativeTextSlotSupported, nativeStatusDotContext, statusDotContextImports, nativeSnackbarContext, nativeSnackbarLifecycleSupported, nativeTooltipContext, nativeTooltipLifecycleSupported } from './native-api-examples.js';
import { defaultSlotMaskingProperty, componentContentSlots, componentSlotElement } from './content-slots.js';
import { recipeFor } from './recipes.js';
import { propertyEditor, parsePropertyInput } from './property-controls.js';

export const snippetLanguages = Object.freeze([
  { id: 'html', label: 'HTML', language: 'html' },
  { id: 'react', label: 'React', language: 'tsx' },
  { id: 'angular', label: 'Angular', language: 'typescript' },
  { id: 'vue', label: 'Vue', language: 'vue' },
  { id: 'svelte', label: 'Svelte', language: 'svelte' },
  { id: 'swift', label: 'SwiftUI', language: 'swift' },
  { id: 'android', label: 'Android', language: 'kotlin' },
].map(Object.freeze));

/** Selected fixture values, available before any Web preview has mounted.
 * Reads authored attributes as declared property types, then applies the
 * recipe's JSON properties. Parent and sibling properties never leak in.
 */
export function recipePropertyValues(component, recipe = recipeFor(component?.tag ?? component?.tagName ?? '')) {
  const tag = component?.tag ?? component?.tagName;
  if (typeof tag !== 'string' || !/^md-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(tag)) throw new TypeError('A valid component tag is required.');
  const properties = component.properties ?? component.props ?? (component.members ?? []).filter(member => member.kind === 'field' && !['private', 'protected'].includes(member.privacy));
  const fields = properties.map(property => typeof property === 'string' ? { name: property } : property).filter(property => typeof property?.name === 'string');
  const attrs = recipeTree(tag, recipe?.html).selected.attrs;
  const values = {};
  for (const property of fields) {
    const name = property.name;
    const declaredAttribute = component.attributes?.find(attribute => attribute.fieldName === name || (!attribute.fieldName && attribute.name === name));
    const rawName = typeof property.attribute === 'string' ? property.attribute : declaredAttribute?.name ?? name.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
    if (property.attribute === false || property.attribute === null || !Object.hasOwn(attrs, rawName.toLowerCase())) continue;
    const raw = attrs[rawName.toLowerCase()];
    const field = { ...declaredAttribute, ...property, type: property.type || declaredAttribute?.type };
    const editor = propertyEditor(component, field, attributeValue(rawName, raw));
    if (editor.kind === 'readonly') continue;
    try {
      // Stencil boolean attributes treat the literal "false" as false.
      const booleanPresence = raw === null && editor.schema?.some(item => item.kind === 'boolean' || item.kind === 'literal' && item.value === true);
      let value;
      try { value = parsePropertyInput(editor, booleanPresence ? 'true' : raw ?? '', raw !== 'false'); }
      catch (error) {
        if (editor.kind !== 'json' || !editor.schema?.some(item => item.kind === 'string' || item.kind === 'literal' && typeof item.value === 'string')) throw error;
        value = parsePropertyInput(editor, JSON.stringify(raw ?? ''), false);
      }
      if (value !== undefined) Object.defineProperty(values, name, { value, enumerable: true, configurable: true, writable: true });
    } catch {
      // An invalid authored attribute cannot become executable source or an
      // incorrectly typed native value. Explicit recipe properties may fix it.
    }
  }
  const declared = new Set(fields.map(property => property.name));
  for (const [name, value] of Object.entries(recipe?.props ?? {})) {
    if (!declared.has(name)) continue;
    if (value === undefined) delete values[name];
    else Object.defineProperty(values, name, { value, enumerable: true, configurable: true, writable: true });
  }
  return jsonValue(values);
}

/** Host accessibility attributes are separate from generated component properties. */
export function recipeContextAttributes(component, recipe = recipeFor(component?.tag ?? component?.tagName ?? '')) {
  const tag = component?.tag ?? component?.tagName;
  if (!['md-icon-button', 'md-fab', 'md-fab-menu-item', 'md-segmented-button', 'md-split-button'].includes(tag)) return {};
  const attrs = recipeTree(tag, recipe?.html).selected.attrs;
  return typeof attrs['aria-label'] === 'string' ? { 'aria-label': attrs['aria-label'] } : {};
}

/** Actual selectable descendants, in the same source order the group uses. */
export function recipeButtonGroupChildren(component, recipe = recipeFor(component?.tag ?? component?.tagName ?? '')) {
  if ((component?.tag ?? component?.tagName) !== 'md-button-group') return [];
  return walk(recipeTree('md-button-group', recipe.html).selected.children)
    .filter(node => ['md-button', 'md-icon-button'].includes(node.tag)).map((node, index) => ({
      index, tag: node.tag, value: String(nodeProperties(node).value ?? ''),
      label: node.attrs['aria-label'] || walk(node.children).filter(child => child.text !== undefined).map(child => child.text).join('').trim() || node.attrs.icon || `Button ${index + 1}`,
      selected: nodeProperties(node).selected === true,
    }));
}

/** Copyable examples for the public framework, SwiftUI and Compose APIs.
 * `html` is trusted local recipe markup. Property values are JSON data, never code.
 */
export function usageSnippet(component, properties = {}, platform = 'web', options = {}) {
  const { html, sourceHtml, text, slots, buttonGroupSelection, focusEvent, focusMethod } = options;
  const tag = component?.tag;
  if (typeof tag !== 'string' || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)+$/.test(tag)) throw new TypeError('A valid component tag is required.');
  platform = ({ web: 'html', ios: 'swift' })[platform] ?? platform;
  if (!snippetLanguages.some(language => language.id === platform)) throw new TypeError(`Unknown snippet platform: ${platform}`);
  const declared = Array.isArray(component.properties) ? new Set(component.properties.map(property => typeof property === 'string' ? property : property.name)) : null;
  const filtered = Object.fromEntries(Object.entries(properties ?? {}).filter(([key, value]) => value !== undefined && (!declared || declared.has(key)
    || tag === 'md-button' && key === 'aria-expanded' && typeof value === 'boolean'
    || ['md-icon-button', 'md-fab', 'md-fab-menu-item', 'md-segmented-button', 'md-split-button'].includes(tag) && key === 'aria-label' && typeof value === 'string')));
  const values = jsonValue(filtered);
  const events = [...new Set((component.events ?? []).map(event => typeof event === 'string' ? event : event.name).filter(name => typeof name === 'string' && name.length))];
  const native = platform === 'swift' || platform === 'android';
  const nativeSlots = native && slots && typeof slots === 'object' && !Array.isArray(slots);
  // Native edits start from the authored composition. A Web-only slot edit in
  // `html` must not erase children that the native adapter still needs.
  const tree = recipeTree(tag, native && typeof sourceHtml === 'string' ? sourceHtml : html, nativeSlots ? undefined : text);
  if (tag === 'md-segmented-button' && options.segmentedContext !== undefined) {
    const context = normalizeSegmentedContext(options.segmentedContext);
    if (context.mode === 'standalone') tree.nodes = [tree.selected];
    else {
      const set = walk(tree.nodes).find(node => node.tag === 'md-segmented-button-set');
      const children = set && walk(set.children).filter(node => node.tag === tag);
      if (!set || children.length !== context.selection.length) throw new TypeError('Segmented context must match the authored set composition.');
      set.attrs.multiselect = String(context.multiselect); set.attrs.density = String(context.density);
      children.forEach((child, index) => { child.attrs.selected = String(context.selection[index]); });
      values.selected = context.selection[0];
      for (const name of SEGMENTED_PARENT_PROPERTIES) delete values[name];
    }
  }
  // ARIA context belongs to the host attribute on Web. An expando assigned by
  // Object.assign would not rotate the icon or expose the expanded state.
  if (tag === 'md-button' && typeof values['aria-expanded'] === 'boolean') {
    tree.selected.attrs['aria-expanded'] = String(values['aria-expanded']);
    if (!native) delete values['aria-expanded'];
  }
  if (['md-icon-button', 'md-fab', 'md-fab-menu-item', 'md-segmented-button', 'md-split-button'].includes(tag) && typeof values['aria-label'] === 'string') {
    tree.selected.attrs['aria-label'] = values['aria-label'];
    if (!native) delete values['aria-label'];
  }
  if (tag === 'md-button-group' && buttonGroupSelection !== undefined) {
    const selections = normalizeButtonGroupSelection(buttonGroupSelection);
    const children = walk(tree.selected.children).filter(node => ['md-button', 'md-icon-button'].includes(node.tag));
    if (children.length !== selections.length) throw new TypeError('Group selection must match its authored children.');
    children.forEach((child, index) => { child.attrs.selected = String(selections[index]); });
  }
  if (nativeSlots) applyNativeSlotText(tree, component, slots, platform, values);
  if (componentContentSlots(tag).length && slots) applyButtonSlotEdits(tree, component, slots, platform, values);
  const profile = componentAppearance(tag) || componentAppearance('md-button');
  const appearance = { profile,
    tooltipLifecycle: native && nativeTooltipLifecycleSupported(component, platform),
    snackbarLifecycle: native && nativeSnackbarLifecycleSupported(component, platform),
    defaults: profile.normalize(options[`${profile.key}Defaults`]),
    local: profile.normalize(componentAppearance(tag) ? options[profile.key] : undefined),
    themeTokens: options.themeTokens === undefined ? {} : normalizeThemeColorTokens(options.themeTokens),
  };
  // Replace the Web recipe's external trigger with working native controller buttons.
  // Preserve the selected Snackbar and all of its authored slot children.
  if (appearance.snackbarLifecycle) tree.nodes = [tree.selected];
  if (platform === 'swift') return swiftSnippet(tag, values, tree, appearance);
  if (platform === 'android') return kotlinSnippet(tag, values, tree, appearance);
  const css = (value, inherited) => Object.entries(profile.css(value, inherited)).map(([name, value]) => `${name}: ${value}`).join('; ');
  if (Object.keys(appearance.themeTokens).length) {
    const existing = (tree.selected.attrs.style || '').split(';').filter(declaration => !Object.hasOwn(appearance.themeTokens, declaration.split(':')[0].trim()));
    tree.selected.attrs.style = [...existing, ...Object.entries(appearance.themeTokens).map(([name, value]) => `${name}: ${value}`)].filter(Boolean).join('; ');
  }
  if (Object.keys(appearance.local).length) {
    const style = [css(appearance.local, appearance.defaults), tree.selected.attrs.style].filter(Boolean).join('; ');
    if (style) tree.selected.attrs.style = style;
  }
  // Fields that are ::part() declarations, not custom properties (md-button's fixed state-layer opacity): a stylesheet rule
  // for the styled element (and, for subtree defaults, every matching component inside the wrapper).
  const partDefaults = profile.partCSS?.(appearance.defaults) ?? [], partLocal = profile.partCSS?.(appearance.local) ?? [];
  if (partLocal.length) tree.selected.attrs.class = [tree.selected.attrs.class, 'awc-appearance'].filter(Boolean).join(' ');
  if (Object.keys(appearance.defaults).length) {
    const style = css(appearance.defaults);
    tree.nodes = [{tag: 'div', attrs: {...(partDefaults.length ? {class: 'awc-appearance-defaults'} : {}), ...(style ? {style} : {})}, children: tree.nodes}];
  }
  const partStyles = [partRulesCSS(`.awc-appearance-defaults ${tag}`, partDefaults), partRulesCSS(`${tag}.awc-appearance`, partLocal)].filter(Boolean).join('\n');
  const markup = tree.nodes.map(node => renderHTML(node)).join('');
  if (platform === 'html') return webSnippet(tag, values, events, partStyles ? `<style>\n${indent(partStyles)}\n</style>\n${markup}` : markup, recipeActions(tree), focusEvent, focusMethod);
  return frameworkSnippet(tag, values, events, tree, platform, focusEvent, focusMethod, partStyles);
}

function jsonValue(value, seen = new Set()) {
  if (value == null) return null;
  if (typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'object') throw new TypeError('Snippet properties must contain JSON values.');
  if (seen.has(value)) throw new TypeError('Snippet properties must not contain cycles.');
  seen.add(value);
  let result;
  if (Array.isArray(value)) result = Array.from(value, item => jsonValue(item, seen));
  else {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) throw new TypeError('Snippet properties must contain plain JSON objects.');
    result = Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined).map(([key, item]) => [key, jsonValue(item, seen)]));
  }
  seen.delete(value);
  return result;
}

function htmlText(value) { return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]); }
function decodeText(value) {
  return value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (entity, name) => {
    if (name[0] !== '#') return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0' }[name.toLowerCase()] ?? entity;
    const code = name[1].toLowerCase() === 'x' ? parseInt(name.slice(2), 16) : Number(name.slice(1));
    return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : '\ufffd';
  });
}

const voidTags = new Set('area base br col embed hr img input link meta param source track wbr'.split(' '));
const camel = name => name.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
const pascal = tag => tag.split('-').map(part => part[0].toUpperCase() + part.slice(1)).join('');
const custom = node => node.tag?.startsWith('md-');
const walk = nodes => nodes.flatMap(node => [node, ...walk(node.children ?? [])]);
const appearanceEntries = (value, profile) => profile.fields.filter(field => Object.hasOwn(value, field.name)).map(field => [field.name, value[field.name]]);
const appearanceValue = (profile, name, value, platform) => profile.nativeValue?.(name, value, platform) ?? (typeof value === 'string' ? nativeString(value, platform) : numberLiteral(value));

function applyNativeSlotText(tree, component, slots, platform, properties) {
  for (const [rawName, value] of Object.entries(slots)) {
    const name = rawName === '(default)' ? '' : rawName;
    if (typeof value !== 'string' || !nativeTextSlotSupported(component, name, platform)) continue;
    const children = tree.selected.children.filter(child => (child.attrs?.slot || '') === name);
    // Plain text cannot replace a structural component, even if its outer slot
    // also accepts text in other compositions. Preserve such children intact.
    if (walk(children).some(custom)) continue;
    tree.selected.children = tree.selected.children.filter(child => (child.attrs?.slot || '') !== name);
    tree.selected.children.push({ tag: 'span', attrs: name ? { slot: name } : {}, children: [{ text: value, explicitText: true }] });
    // Some adapters prefer a label/headline/message property to the default
    // slot. An accepted text edit owns that region, including an empty edit.
    const mask = !name && defaultSlotMaskingProperty(component.tag ?? component.tagName);
    if (mask) {
      delete tree.selected.attrs[mask];
      properties[mask] = '';
    }
  }
}

function applyButtonSlotEdits(tree, component, slots, platform, properties) {
  const native = ['swift', 'android'].includes(platform);
  const policy = component.support?.[platform === 'swift' ? 'ios' : platform];
  for (const name of componentContentSlots(component.tag)) {
    if (!Object.hasOwn(slots, name)) continue;
    const names = (values = []) => values.map(value => typeof value === 'string' ? value : value.name);
    if (!names(component.slots ?? policy?.slots).includes(name)) continue;
    if (native && (!policy || policy.status === 'missing-adapter' || !names(policy.slots).includes(name) || names(policy.unsupportedSlots).includes(name))) continue;
    const descriptor = componentSlotElement(component.tag, name, slots[name], properties);
    const node = {
      tag: descriptor.tag,
      attrs: descriptor.attributes,
      children: descriptor.text === undefined ? [] : [{ text: descriptor.text, explicitText: true }],
      ...(slots[name]?.kind === 'symbol' ? { symbol: slots[name].value } : {}),
    };
    // These explicit edits replace the chosen slot, including its composition,
    // while leaving the label and the other named slots intact.
    tree.selected.children = tree.selected.children.filter(child => (child.attrs?.slot || '') !== name
      || component.tag === 'md-icon-button' && name === '' && child.tag === 'md-badge');
    tree.selected.children.push(node);
  }
}

// A small, non-executing parser for authored recipe fragments. It is deliberately
// independent of document/DOMParser so generation is identical in Node and the UI.
// Scripts, inline handlers and Stencil hydration internals never become example code.
function recipeTree(tag, html, text) {
  const nodes = [], stack = [{ children: nodes }];
  const markup = typeof html === 'string' && html.trim() ? html.trim() : `<${tag}></${tag}>`;
  const tokens = markup.match(/<!--[\s\S]*?(?:-->|$)|<\/?[a-zA-Z][^<>"']*(?:(?:"[^"]*"|'[^']*')[^<>"']*)*>|[^<]+|</g) ?? [];
  let discarded = null;
  for (const token of tokens) {
    if (token.startsWith('<!--')) continue;
    const closing = token.match(/^<\/([\w-]+)\s*>$/);
    if (discarded) { if (closing?.[1].toLowerCase() === discarded) discarded = null; continue; }
    if (closing) {
      const index = stack.findLastIndex(node => node.tag === closing[1].toLowerCase());
      if (index > 0) stack.length = index;
      continue;
    }
    const opening = token.match(/^<([\w-]+)([\s\S]*?)\/?\s*>$/);
    if (!opening) { stack.at(-1).children.push({ text: decodeText(token) }); continue; }
    const name = opening[1].toLowerCase();
    if (['script', 'style', 'template'].includes(name)) { discarded = name; continue; }
    const attrs = {};
    for (const match of opening[2].matchAll(/([^\s=<>"'`/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
      const key = match[1].toLowerCase();
      if (/^on/.test(key) || /^(?:s-|c-id$|data-stencil|data-hydrat)/.test(key)) continue;
      let value = match[2] ?? match[3] ?? match[4] ?? null;
      if (value !== null) value = decodeText(value);
      if (key === 'class') { value = (value ?? '').split(/\s+/).filter(item => item && item !== 'hydrated').join(' '); if (!value) continue; }
      if (/^[a-z_][a-z0-9_.:-]*$/.test(key)) Object.defineProperty(attrs, key, { value, enumerable: true, writable: true, configurable: true });
    }
    const node = { tag: name, attrs, children: [] };
    stack.at(-1).children.push(node);
    if (!voidTags.has(name) && !/\/\s*>$/.test(token)) stack.push(node);
  }
  let selected = walk(nodes).find(node => node.tag === tag);
  if (!selected) { selected = { tag, attrs: {}, children: [] }; nodes.push(selected); }
  selected.selected = true;
  if (text !== undefined) {
    selected.children = selected.children.filter(child => typeof child.attrs?.slot === 'string' && child.attrs.slot !== '');
    // An explicitly cleared label is still supplied native content. Preserve it
    // (and whitespace) instead of allowing a native component's fallback label.
    if (text !== null) selected.children.push({ text: String(text), explicitText: true });
  }
  return { nodes, selected };
}
function renderHTML(node) {
  if (node.text !== undefined) return htmlText(node.text);
  const attributes = Object.entries(node.attrs).map(([key, value]) => value === null ? ` ${key}` : ` ${key}="${htmlText(value)}"`).join('');
  const start = `<${node.tag}${attributes}>`;
  return voidTags.has(node.tag) ? start : `${start}${node.children.map(renderHTML).join('')}</${node.tag}>`;
}

// HTML attributes only express scalars. These are the numeric attributes present
// in authored compositions; selected component values come from typed live props.
const numberAttributes = new Set('columns count rows-per-page page active-tab-index lines density elevation initial-x initial-y min max step length tabindex group-tabindex heading-level colspan rowspan width height'.split(' '));
function attributeValue(name, value) {
  if (value === null) return true;
  if (['selected', 'multiselect'].includes(name) && ['true', 'false'].includes(value)) return value === 'true';
  if (numberAttributes.has(name) && /^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value)) return Number(value);
  return value;
}
function nodeProperties(node) {
  return Object.fromEntries(Object.entries(node.attrs).filter(([key]) => !['slot', 'class', 'style', 'id'].includes(key) && !key.startsWith('data-'))
    .map(([key, value]) => [key.startsWith('aria-') ? key : camel(key), attributeValue(key, value)]));
}
function cssObject(css) {
  return Object.fromEntries(css.split(';').flatMap(declaration => {
    const colon = declaration.indexOf(':');
    if (colon < 0) return [];
    const name = declaration.slice(0, colon).trim();
    return name ? [[name.startsWith('--') ? name : camel(name), declaration.slice(colon + 1).trim()]] : [];
  }));
}
const plainReactNames = { class: 'className', for: 'htmlFor', tabindex: 'tabIndex', readonly: 'readOnly', colspan: 'colSpan', rowspan: 'rowSpan', maxlength: 'maxLength', minlength: 'minLength', autofocus: 'autoFocus' };
function expressionName(name) { return /^[A-Za-z_$][\w$]*$/.test(name) ? `properties.${name}` : `properties[${jsLiteral(name)}]`; }
function frameworkText(text) { return htmlText(text).replace(/\{/g, '&#123;').replace(/\}/g, '&#125;').replace(/@/g, '&#64;'); }

// Source recipes declare finite open/close/toggle actions as data, so the live
// preview and copied examples keep the same interaction without serializing JS.
function recipeActions(tree) {
  const nodes = walk(tree.nodes);
  return nodes.filter(node => ['open', 'close', 'toggle'].includes(node.attrs?.['data-awc-action'])
    && /^[A-Za-z][A-Za-z0-9_-]*$/.test(node.attrs?.['data-awc-target'] || '')
    && nodes.some(target => target.attrs?.id === node.attrs['data-awc-target']));
}
function recipeActionHandler(typed = true, classMethod = false) {
  const signature = typed ? 'event: { currentTarget: EventTarget | null }' : 'event';
  return `${classMethod ? '' : 'function '}onRecipeAction(${signature}) {\n  const trigger = event.currentTarget${typed ? ' as HTMLElement | null' : ''};\n  const id = trigger?.getAttribute("data-awc-target");\n  if (!id || !/^[A-Za-z][A-Za-z0-9_-]*$/.test(id)) return;\n  const target = trigger?.closest("[data-awc-example]")?.querySelector${typed ? '<HTMLElement & { open: boolean }>' : ''}("#" + id);\n  if (!target) return;\n  const action = trigger?.getAttribute("data-awc-action");\n  if (action === "open") target.open = true;\n  else if (action === "close") target.open = false;\n  else if (action === "toggle") target.open = !target.open;\n}`;
}

// A DOM cancelable flag alone does not establish a cancelable component action.
// These source implementations explicitly inspect the emitted event's flag.
const cancellationActions = {
  'md-button:mdClick': 'Veto this activation before its side effects.',
  'md-switch:mdInput': 'Prevent the internal toggle before state changes.',
  'md-breadcrumb-item:mdSelect': 'Prevent the default link navigation.',
  'md-chip:mdRemove': 'Keep the chip from removing itself.',
  'md-stepper:mdBeforeChange': 'Veto the step change before it commits.',
};
function focusedEventHandler(tag, event) {
  if (!event || !/^[A-Za-z][A-Za-z0-9]*$/.test(event.name || '')) return null;
  const typeText = value => typeof value === 'string' ? value : value?.text || '';
  const detail = (typeText(event.detail) || typeText(event.payload?.detail) || typeText(event.type)).replace(/^CustomEvent<([\s\S]+)>$/, '$1');
  const empty = /^(?:void|undefined|never)$/.test(detail.trim());
  const fields = (event.payloadFields || []).filter(field => typeof field.name === 'string' && !/\b(?:MouseEvent|KeyboardEvent|PointerEvent|HTMLElement|Element)\b/.test(typeText(field.type))).slice(0, 3);
  const access = fields.length ? fields.map(field => `event.detail[${jsLiteral(field.name)}]`).join(', ') : 'event.detail';
  const cancellation = cancellationActions[`${tag}:${event.name}`];
  return {
    name: `on${event.name[0].toUpperCase()}${event.name.slice(1)}`,
    type: `CustomEvent<HTML${pascal(tag)}ElementEventMap[${jsLiteral(event.name)}]>`,
    body: `console.log(${empty ? jsLiteral(event.name) : access});${cancellation && event.cancelable !== false ? `\n// event.preventDefault(); // ${cancellation}` : ''}`,
  };
}

function focusedMethodHandler(method) {
  if (!method || !/^[A-Za-z][A-Za-z0-9]*$/.test(method.name || '') || !Array.isArray(method.arguments)) return null;
  // A few notifications are driven by a public property rather than a method.
  if (method.action === 'set-property') return { name: method.name, body: `component.${method.name} = ${jsLiteral(jsonValue(method.value))};` };
  const typeText = value => typeof value === 'string' ? value : value?.text || '';
  const returnType = typeText(method.returns?.type) || typeText(method.returns) || typeText(method.return?.type) || typeText(method.returnType);
  const hasResult = returnType && !/^(?:Promise<\s*)?(?:void|undefined)(?:\s*>)?$/.test(returnType.trim());
  const args = jsonValue(method.arguments).map(value => jsLiteral(value)).join(', ');
  return { name: method.name, body: `${hasResult ? 'const result = ' : ''}await component.${method.name}(${args});${hasResult ? '\nconsole.log(result);' : ''}` };
}

function frameworkSnippet(tag, values, events, tree, platform, focusEvent, focusMethod, partStyles = '') {
  const names = [...new Set(walk(tree.nodes).filter(custom).map(node => pascal(node.tag)))].sort();
  const tags = [...new Set(walk(tree.nodes).filter(custom).map(node => node.tag))].sort();
  const usedStyle = platform === 'react' && walk(tree.nodes).some(node => node.attrs?.style);
  const actions = recipeActions(tree);
  const focused = focusedEventHandler(tag, focusEvent);
  const method = focusedMethodHandler(focusMethod);
  const handlerName = focused?.name || 'onEvent';
  const render = node => {
    // Angular decodes character entities before parsing interpolation, so
    // escaping braces alone still evaluates a label such as {{ action() }}.
    if (node.text !== undefined) return platform === 'angular' ? `{{ ${jsLiteral(node.text)} }}` : frameworkText(node.text);
    const name = custom(node) && ['react', 'vue'].includes(platform) ? pascal(node.tag) : node.tag;
    const attributes = Object.entries(node.attrs).filter(([raw]) => !(node.selected && Object.hasOwn(values, camel(raw)))).map(([raw, value]) => {
      let key = raw.startsWith('aria-') || raw.startsWith('data-') ? raw : custom(node) ? camel(raw) : raw;
      if (platform === 'react') {
        key = plainReactNames[key] ?? key;
        if (raw === 'style') return `style={${jsLiteral(cssObject(value ?? ''))} as CSSProperties}`;
        return `${key}={${jsLiteral(custom(node) ? attributeValue(raw, value) : value ?? true)}}`;
      }
      if (custom(node) && !['slot', 'id', 'class', 'style', 'title', 'role', 'dir'].includes(raw) && !/^(?:aria|data)-/.test(raw)) {
        const literal = jsLiteral(attributeValue(raw, value));
        if (platform === 'angular') return `[${key}]="${htmlText(literal)}"`;
        if (platform === 'vue') return `:${key}="${htmlText(literal)}"`;
        return `${key}={${literal}}`;
      }
      return value === null ? raw : `${raw}="${frameworkText(value)}"`;
    });
    if (node.selected) {
      if (method) attributes.push(({ react: 'ref={ref}', vue: 'ref="view"', svelte: 'bind:this={view}', angular: '#view' })[platform]);
      if (platform === 'react' || platform === 'svelte') attributes.push('{...properties}');
      else if (platform === 'vue') attributes.push('v-bind="properties"');
      else for (const key of Object.keys(values)) attributes.push(`[${key}]="${htmlText(expressionName(key))}!"`);
      for (const event of events) {
        if (!/^[A-Za-z][A-Za-z0-9]*$/.test(event)) continue;
        if (platform === 'react') attributes.push(`on${event[0].toUpperCase() + event.slice(1)}={${handlerName}}`);
        else if (platform === 'svelte') attributes.push(`on${event}={${handlerName}}`);
        else if (platform === 'vue') attributes.push(`@${event}="${handlerName}"`);
        else attributes.push(`(${event})="${handlerName}($event)"`);
      }
    }
    if (actions.includes(node)) {
      if (platform === 'react') attributes.push('onClick={onRecipeAction}');
      else if (platform === 'svelte') attributes.push('onclick={onRecipeAction}');
      else if (platform === 'vue') attributes.push('@click="onRecipeAction"');
      else attributes.push('(click)="onRecipeAction($event)"');
    }
    const opening = `<${name}${attributes.length ? ' ' + attributes.join(' ') : ''}`;
    if (voidTags.has(node.tag)) return opening + (platform === 'react' ? ' />' : '>');
    return `${opening}>${node.children.map(render).join('')}</${name}>`;
  };
  const runBinding = { react: 'onClick={run}', vue: '@click="run"', svelte: 'onclick={run}', angular: '(click)="run()"' }[platform];
  const rendered = tree.nodes.map(render).join('\n') + (method ? `\n<button type="button" ${runBinding}>Run ${method.name}</button>` : '');
  const framed = actions.length ? `<div data-awc-example="">\n${indent(rendered, 2)}\n</div>` : rendered;
  // ::part() rules: React renders a global <style>; Vue, Svelte and Angular use their component styles below.
  const markup = partStyles && platform === 'react' ? `<style>{${jsLiteral(partStyles)}}</style>\n${framed}` : framed;
  const componentStyles = partStyles && platform !== 'react' ? partStyles : '';
  const eventMethod = `${handlerName}(event: ${focused?.type || 'CustomEvent'}) {\n${indent(focused?.body || 'console.log(event.type, event.detail);')}\n}`;
  const eventHandler = (events.length ? `\nfunction ${eventMethod}\n` : '') + (actions.length ? `\n${recipeActionHandler()}\n` : '');
  const type = `Partial<Components.${pascal(tag)}>`;
  const core = 'import type { Components } from "@awc-ui/core";\nimport "@awc-ui/core/css/tokens.css";';
  const setup = `// Client-side example. Install @awc-ui/${platform} and @awc-ui/core.\n// Load tokens.css once in your application entry.\n`;
  const name = pascal(tag);
  const runMethod = method ? `async ${platform === 'angular' ? '' : 'function '}run() {\n  const component = ${{ react: 'ref.current', vue: 'view.value?.$el', svelte: 'view', angular: 'this.view' }[platform]};\n  if (!component) return;\n  await customElements.whenDefined(${jsLiteral(tag)});\n${indent(method.body)}\n}` : '';
  const methodSetup = !method ? '' : platform === 'react' ? `  const ref = useRef<HTML${name}Element>(null);\n${indent(runMethod)}\n` : platform === 'vue' ? `\nconst view = ref<{ $el: HTML${name}Element } | null>(null);\n${runMethod}\n` : platform === 'svelte' ? `  let view: HTML${name}Element | undefined = $state();\n${indent(runMethod)}\n` : `  @ViewChild('view') view?: ${name};\n${indent(runMethod)}\n`;
  const note = '';
  if (platform === 'react') return `"use client";\n\n${setup}import { useState${method ? ', useRef' : ''}${usedStyle ? ', type CSSProperties' : ''} } from "react";\nimport { ${names.join(', ')} } from "@awc-ui/react";\n${core}\n${eventHandler}\nexport function ComponentExample() {\n  const [properties] = useState<${type}>(${jsLiteral(values, true)});\n${methodSetup}${note ? indent(note.trimEnd(), 2) + '\n' : ''}  return (\n    <>\n${indent(markup, 6)}\n    </>\n  );\n}`;
  if (platform === 'vue') return `<script setup lang="ts">\n${setup}import { reactive${method ? ', ref' : ''} } from "vue";\nimport { ${names.join(', ')} } from "@awc-ui/vue";\n${core}\n\nconst properties = reactive<${type}>(${jsLiteral(values, true)});\n${eventHandler}${methodSetup}${note}</script>\n\n<template>\n${indent(markup, 2)}\n</template>${componentStyles ? `\n\n<style scoped>\n${componentStyles}\n</style>` : ''}`;
  if (platform === 'svelte') return `<script lang="ts">\n${indent(setup + 'import type {} from "@awc-ui/svelte";\n' + core + '\n' + tags.map(name => `import "@awc-ui/core/components/${name}";`).join('\n'), 2)}\n\n  let properties: ${type} = $state(${jsLiteral(values, true)});\n${eventHandler ? indent(eventHandler.trim(), 2) + '\n' : ''}${methodSetup}${note ? indent(note.trim(), 2) + '\n' : ''}</script>\n\n${markup}${componentStyles ? `\n\n<style>\n${indent(componentStyles)}\n</style>` : ''}`;
  const template = markup.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
  return `${setup}import { Component${method ? ', ViewChild' : ''} } from "@angular/core";\nimport { ${names.join(', ')} } from "@awc-ui/angular";\n${core}\n\n@Component({\n  selector: "app-component-example",\n  standalone: true,\n  imports: [${names.join(', ')}],\n  template: \`\n${indent(template, 4)}\n  \`,${componentStyles ? `\n  styles: [${jsLiteral(componentStyles)}],` : ''}\n})\nexport class ComponentExample {\n  properties: ${type} = ${jsLiteral(values, true)};\n${methodSetup}${events.length ? '\n' + indent(eventMethod) + '\n' : ''}${actions.length ? '\n' + indent(recipeActionHandler(true, true), 2) + '\n' : ''}}`;
}

// Escape HTML parser delimiters even though these are JavaScript string/object
// literals: a literal </script> would terminate the containing HTML script first.
function jsLiteral(value, pretty = false) {
  return JSON.stringify(value, null, pretty ? 2 : undefined)
    .replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')
    .replace(/"__proto__":/g, '["__proto__"]:');
}
function indent(value, spaces = 2) { return value.split('\n').map(line => ' '.repeat(spaces) + line).join('\n'); }
function webSnippet(tag, properties, events, html, actions = [], focusEvent, focusMethod) {
  const method = focusedMethodHandler(focusMethod);
  const markup = (typeof html === 'string' && html.trim() ? html.trim() : `<${tag}></${tag}>`) + (method ? `\n<button id="run-api" type="button">Run ${method.name}</button>` : '');
  const focused = focusedEventHandler(tag, focusEvent);
  const listeners = focused ? `\nfunction ${focused.name}(event) {\n${indent(focused.body)}\n}\ncomponent.addEventListener(${jsLiteral(focusEvent.name)}, ${focused.name});\n` : events.length ? `\nfor (const name of ${jsLiteral(events)}) {\n  component.addEventListener(name, event => {\n    console.log(name, event.detail);\n  });\n}\n` : '\n';
  const interactions = actions.length ? `\n${recipeActionHandler(false)}\n\nfor (const trigger of document.querySelectorAll("#awc-example [data-awc-action]")) {\n  trigger.addEventListener("click", onRecipeAction);\n}\n` : '';
  const run = method ? `\ndocument.querySelector("#run-api").addEventListener("click", async () => {\n${indent(method.body)}\n});\n` : '';
  return `<div id="awc-example"${actions.length ? ' data-awc-example' : ''}>\n${indent(markup, 2)}\n</div>\n\n<script type="module">\nimport "@awc-ui/core/define";\nimport "@awc-ui/core/css/tokens.css";\n\nawait customElements.whenDefined(${jsLiteral(tag)});\nconst component = document.querySelector(${jsLiteral(`#awc-example ${tag}`)});\n${listeners}\nObject.assign(component, ${jsLiteral(properties, true)});\n${interactions}${run}</script>`;
}

function nativeString(value, language) {
  let result = '"';
  for (const character of value) {
    const code = character.codePointAt(0);
    if (character === '\\') result += '\\\\';
    else if (character === '"') result += '\\"';
    else if (character === '\n') result += '\\n';
    else if (character === '\r') result += '\\r';
    else if (character === '\t') result += '\\t';
    else if (character === '$' && language === 'kotlin') result += '\\$';
    else if (code < 0x20 || code === 0x7f || code === 0x2028 || code === 0x2029 || (code >= 0xd800 && code <= 0xdfff)) {
      // Swift strings cannot contain an isolated UTF-16 surrogate scalar.
      const scalar = language === 'swift' && code >= 0xd800 && code <= 0xdfff ? 0xfffd : code;
      result += language === 'swift' ? `\\u{${scalar.toString(16)}}` : `\\u${scalar.toString(16).padStart(4, '0')}`;
    } else result += character;
  }
  return result + '"';
}
function numberLiteral(value) {
  if (Object.is(value, -0)) return '-0.0';
  const number = String(value);
  return /[.e]/i.test(number) ? number : `${number}.0`;
}
function swiftValue(value) {
  if (value === null) return '.null';
  if (typeof value === 'string') return `.string(${nativeString(value, 'swift')})`;
  if (typeof value === 'boolean') return `.bool(${value})`;
  if (typeof value === 'number') return `.number(${numberLiteral(value)})`;
  if (Array.isArray(value)) return `.array([${value.map(swiftValue).join(', ')}])`;
  const entries = Object.entries(value);
  return `.object(${entries.length ? `[${entries.map(([key, item]) => `${nativeString(key, 'swift')}: ${swiftValue(item)}`).join(', ')}]` : '[:]'})`;
}
function nativeNodes(nodes, slot = null, parentTag = null) {
  return nodes.flatMap(node => {
    const assignedSlot = node.attrs?.slot ?? slot;
    if (node.symbol !== undefined) return [{ symbol: node.symbol, slot: assignedSlot }];
    // A direct authored span is meaningful even when its text is blank. Keep
    // that presence separate from indentation-only raw text nodes.
    if ((['md-icon-button', 'md-fab'].includes(parentTag) || ['md-segmented-button', 'md-fab-menu-item', 'md-badge'].includes(parentTag) && assignedSlot === 'icon') && node.tag === 'span' && !walk(node.children).some(custom)) {
      return [{ text: walk(node.children).filter(child => child.text !== undefined).map(child => child.text).join(''), slotText: true, slot: assignedSlot }];
    }
    if (node.text !== undefined) return node.explicitText || node.text.trim() ? [{ text: node.text, slot: assignedSlot }] : [];
    if (!custom(node)) return nativeNodes(node.children, assignedSlot, parentTag);
    return [{ ...node, slot: assignedSlot, children: nativeNodes(node.children, null, node.tag) }];
  });
}
function swiftNode(node, values) {
  if (node.symbol !== undefined) return `.symbol(${nativeString(node.symbol, 'swift')}${node.slot ? `, slot: ${nativeString(node.slot, 'swift')}` : ''})`;
  if (node.text !== undefined) return `.${node.slotText ? 'slotText' : 'text'}(${nativeString(node.text, 'swift')}${node.slot ? `, slot: ${nativeString(node.slot, 'swift')}` : ''})`;
  const properties = { ...nodeProperties(node), ...(node.selected ? values : {}) };
  const dictionary = swiftValue(properties).slice(8, -1);
  const children = node.children.map(child => swiftNode(child, values)).join(', ');
  return `AWCNode(${node.attrs.id ? `id: ${nativeString(node.attrs.id, 'swift')}, ` : ''}tag: ${nativeString(node.tag, 'swift')}, properties: ${dictionary}, children: [${children}]${node.slot ? `, slot: ${nativeString(node.slot, 'swift')}` : ''})`;
}
/** md-menu recipes: the anchored menu presents in an AWCMenuScope; its trigger toggles it through the scope's handle (open = !open). */
const MENU_RECIPE_TAGS = new Set(['md-menu', 'md-menu-item', 'md-menu-item-group', 'md-sub-menu-item']);
function anchoredMenuRecipe(roots) {
  const menu = roots.find(node => node.tag === 'md-menu' && node.attrs?.anchor);
  const trigger = menu && roots.find(node => node.attrs?.id === menu.attrs.anchor);
  return menu && trigger ? { menu, trigger, id: menu.attrs.id || 'demo-menu' } : null;
}
function swiftSnippet(tag, values, tree, appearance) {
  const targetedSegment = (tag === 'md-segmented-button' && walk(tree.nodes).some(node => node.tag === 'md-segmented-button-set') || tag === 'md-fab-menu-item' && walk(tree.nodes).some(node => node.tag === 'md-fab-menu')) && Object.keys(appearance.local).length;
  if (targetedSegment && !tree.selected.attrs.id) tree.selected.attrs.id = tag === 'md-segmented-button' ? 'segment-day' : 'menu-item-document';
  const roots = nativeNodes(tree.nodes);
  const menuContext = walk(tree.nodes).some(node => Object.hasOwn(node.attrs || {}, 'data-awc-fab-menu-context'));
  const badgeContext = tag === 'md-badge' && walk(tree.nodes).some(node => Object.hasOwn(node.attrs || {}, 'data-awc-badge-context'));
  const statusDotContext = tag === 'md-status-dot' && walk(tree.nodes).some(node => Object.hasOwn(node.attrs || {}, 'data-awc-status-dot-context'));
  const simple = roots.length === 1 && roots[0].selected;
  const selected = simple ? roots[0] : null;
  values = simple ? { ...nodeProperties(selected), ...values } : values;
  const entries = Object.entries(values);
  const properties = entries.length ? `[\n${entries.map(([key, value]) => `                ${nativeString(key, 'swift')}: ${swiftValue(value)}`).join(',\n')}\n            ]` : '[:]';
  const children = selected ? `[${selected.children.map(child => swiftNode(child, values)).join(', ')}]` : '[]';
  const note = '        // Add the AWCUI Swift package to your app.\n        // AWCNode preserves native children and named slots; HTML layout CSS and\n        // recipe setup callbacks require native layout/state in the host app.\n';
  let body = simple ? `AWCNativeView(\n    tag: ${nativeString(tag, 'swift')},\n    properties: ${properties},\n    children: ${children},\n    onEvent: { event in\n        print(event.name, event.detail.json)\n    }\n)` : `VStack(alignment: .leading) {\n${roots.map(node => node.text !== undefined ? `    Text(${nativeString(node.text, 'swift')})` : `    AWCNativeView(node: ${swiftNode(node, values)}, onEvent: { event in\n        print(event.name, event.detail.json)\n    })`).join('\n')}\n}`;
  const anchored = MENU_RECIPE_TAGS.has(tag) ? anchoredMenuRecipe(roots) : null;
  if (anchored) body = `AWCMenuScope(state: menus) {\n    VStack(spacing: 12) {\n        AWCNativeView(node: ${swiftNode(anchored.trigger, values)}) { event in\n            if event.name == "mdClick" {\n                let menu = menus.menu(${nativeString(anchored.id, 'swift')})\n                if menu.isOpen { menu.close() } else { menu.show() }\n            }\n        }\n        AWCNativeView(node: ${swiftNode(anchored.menu, values)}, onEvent: { event in\n            print(event.name, event.detail.json)\n        })\n    }\n    .padding(.top, 12)\n}\n.frame(width: 360, height: 480)`;
  if (menuContext) body = `AWCFabMenuScope {\n    ZStack {\n${indent(roots.map(node => `AWCNativeView(node: ${swiftNode(node, values)}, onEvent: { event in print(event.name, event.detail.json) })`).join('\n'), 8)}\n    }\n}\n.frame(width: 360, height: 480)`;
  if (badgeContext) {
    const badge = roots.find(node => node.selected), parent = roots.find(node => node.tag === 'md-icon-button');
    body = `AWCNativeView(node: ${swiftNode(parent, values)})\n.awcIconButtonAppearance(.init(width: 48, height: 48))\n.frame(width: 48, height: 48)\n.awcBadgeOverlay {\n    AWCNativeView(node: ${swiftNode(badge, values)})\n}`;
  }
  if (statusDotContext) {
    const dot = roots.find(node => node.selected), parent = roots.find(node => node.tag === 'md-icon-button');
    body = nativeStatusDotContext(`AWCNativeView(node: ${swiftNode(dot, values)})`, 'swift', { inline: values.inline === true, parent: `AWCNativeView(node: ${swiftNode(parent, values)})` });
  }
  if (tag === 'md-divider' && walk(tree.nodes).some(node => Object.hasOwn(node.attrs || {}, 'data-awc-divider-context'))) body += '\n.frame(width: 300, height: 96)';
  if (['md-meter', 'md-progress-indicator'].includes(tag) && walk(tree.nodes).some(node => Object.hasOwn(node.attrs || {}, tag === 'md-meter' ? 'data-awc-meter-context' : 'data-awc-progress-context'))) body += '\n.frame(width: 300)';
  if (tag === 'md-skeleton' && walk(tree.nodes).some(node => Object.hasOwn(node.attrs || {}, 'data-awc-skeleton-context'))) body += '\n.frame(width: 260, height: 160, alignment: .topLeading)\n.awcSkeletonSizingContext(.init(parentHeight: 160))';
  for (const [scope, value] of [['This component', appearance.local], ['Theme defaults for this subtree', appearance.defaults]]) {
    if (Object.keys(value).length) body += `\n// ${scope}\n.${appearance.profile.swiftModifier}(.init(${appearanceEntries(value, appearance.profile).map(([key, item]) => `${key}: ${appearanceValue(appearance.profile, key, item, 'swift')}`).join(', ')})${scope === 'This component' && targetedSegment ? `, nodeID: ${nativeString(tree.selected.attrs.id, 'swift')}` : ''})`;
  }
  // A floating panel is placed in the nearest viewport (CSS position: fixed): give it a definite area.
  if (tag === 'md-accordion' && values.floating === true) body += '\n.frame(maxWidth: .infinity, minHeight: 320, alignment: .topLeading)\n.awcAccordionViewport()';
  if (Object.keys(appearance.themeTokens).length) body += `\n.awcTheme(.generated(tokens: [${Object.entries(appearance.themeTokens).map(([key, value]) => `${nativeString(key, 'swift')}: ${nativeString(value, 'swift')}`).join(', ')}]))`;
  if (appearance.snackbarLifecycle) body = nativeSnackbarContext(`VStack {\n    Button("Show snackbar") { Task { await snackbarController.show() } }\n    Button("Close snackbar") { Task { await snackbarController.hide() } }\n    Spacer()\n}\n${body}\n.awcSnackbarController(snackbarController)`, 'swift');
  // Dialogs and sheets present inside an AWCModalScope placed at the content root.
  if (['md-dialog', 'md-bottom-sheet', 'md-side-sheet'].includes(tag)) body = `AWCModalScope {\n${indent(body, 4)}\n}`;
  if (appearance.tooltipLifecycle) body = nativeTooltipContext(body, 'swift');
  const state = appearance.snackbarLifecycle ? '    @State private var snackbarController = AWCSnackbarController()\n\n' : anchored ? '    @State private var menus = AWCMenuScopeState()\n\n' : '';
  const setupNote = appearance.snackbarLifecycle ? '        // The scope owns the overlay viewport; controller calls target this mounted Snackbar.\n' : note;
  return `import SwiftUI\nimport AWCUI\n\nstruct ComponentExample: View {\n${state}    var body: some View {\n${setupNote}${indent(body, 8)}\n    }\n}`;
}
function kotlinValue(value) {
  if (value === null) return 'null';
  if (typeof value === 'string') return nativeString(value, 'kotlin');
  if (typeof value === 'boolean') return String(value);
  if (typeof value === 'number') return numberLiteral(value);
  if (Array.isArray(value)) return value.length ? `listOf<AWCValue>(${value.map(kotlinValue).join(', ')})` : 'emptyList<AWCValue>()';
  const entries = Object.entries(value);
  return entries.length ? `mapOf<String, AWCValue>(${entries.map(([key, item]) => `${nativeString(key, 'kotlin')} to ${kotlinValue(item)}`).join(', ')})` : 'emptyMap<String, AWCValue>()';
}
function kotlinNode(node, values, targetedAppearance, menuContext = false, parentTag) {
  if (node.symbol !== undefined) return `AWCMaterialSymbol(${nativeString(node.symbol, 'kotlin')})`;
  if (node.text !== undefined) return `${parentTag === 'md-tooltip' && ['content', 'subhead'].includes(node.slot) || parentTag === 'md-segmented-button' || parentTag === 'md-fab-menu-item' && !node.slot ? 'AWCSlotText' : 'Text'}(${nativeString(node.text, 'kotlin')})`;
  const properties = { ...nodeProperties(node), ...(node.selected ? values : {}) };
  if (menuContext && node.attrs?.id) properties.id = node.attrs.id;
  const entries = Object.entries(properties);
  const dictionary = entries.length ? `mapOf<String, AWCValue>(\n${entries.map(([key, value]) => `        ${nativeString(key, 'kotlin')} to ${kotlinValue(value)}`).join(',\n')}\n    )` : 'emptyMap()';
  const groups = new Map();
  for (const child of node.children) {
    const slot = child.slot ?? '';
    if (!groups.has(slot)) groups.set(slot, []);
    groups.get(slot).push(child);
  }
  const content = node.children.length ? ` { slot ->\n${[...groups].map(([slot, nodes]) => nodes.length === 1 && nodes[0].text !== undefined ? `    if (slot == ${nativeString(slot, 'kotlin')}) ${kotlinNode(nodes[0], values, targetedAppearance, menuContext, node.tag)}` : `    if (slot == ${nativeString(slot, 'kotlin')}) {\n${indent(nodes.map(child => kotlinNode(child, values, targetedAppearance, menuContext, node.tag)).join('\n'), 8)}\n    }`).join('\n')}\n}` : '';
  const body = `AWCComponent(\n    tag = ${nativeString(node.tag, 'kotlin')},\n    properties = ${dictionary},\n    onEvent = { name, detail -> println(name + ": " + detail) },\n)${content}`;
  if (node.selected && targetedAppearance) {
    const profile = targetedAppearance.profile;
    const argumentsText = appearanceEntries(targetedAppearance.local, profile).map(([key, item]) => `${key} = ${appearanceValue(profile, key, item, 'kotlin')}`).join(', ');
    return `${profile.nativeType}Scope(appearance = ${profile.nativeType}(${argumentsText})) {\n${indent(body, 4)}\n}`;
  }
  return body;
}
function kotlinSnippet(tag, values, tree, appearance) {
  const roots = nativeNodes(tree.nodes);
  const hasText = walk(roots).some(node => node.text !== undefined);
  const hasSymbol = walk(roots).some(node => node.symbol !== undefined);
  const targetedSegment = (tag === 'md-segmented-button' && walk(tree.nodes).some(node => node.tag === 'md-segmented-button-set') || tag === 'md-fab-menu-item' && walk(tree.nodes).some(node => node.tag === 'md-fab-menu')) && Object.keys(appearance.local).length;
  const menuContext = walk(tree.nodes).some(node => Object.hasOwn(node.attrs || {}, 'data-awc-fab-menu-context'));
  const badgeContext = tag === 'md-badge' && walk(tree.nodes).some(node => Object.hasOwn(node.attrs || {}, 'data-awc-badge-context'));
  const statusDotContext = tag === 'md-status-dot' && walk(tree.nodes).some(node => Object.hasOwn(node.attrs || {}, 'data-awc-status-dot-context'));
  let body = roots.map(node => kotlinNode(node, values, targetedSegment ? appearance : null, menuContext)).join('\n');
  if (menuContext) body = `AWCFabMenuScope(modifier = Modifier.requiredSize(360.dp, 480.dp)) {\n    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {\n${indent(body, 8)}\n    }\n}`;
  else if (roots.length > 1) body = `Column {\n${indent(body, 4)}\n}`;
  const anchored = MENU_RECIPE_TAGS.has(tag) ? anchoredMenuRecipe(roots) : null;
  if (anchored) {
    const toggle = `    onEvent = { name, _ ->\n        if (name == "mdClick") {\n            val menu = menus.menu(${nativeString(anchored.id, 'kotlin')})\n            if (menu.isOpen) menu.close() else menu.show()\n        }\n    },`;
    const trigger = kotlinNode(anchored.trigger, values, null, true).replace('    onEvent = { name, detail -> println(name + ": " + detail) },', toggle);
    body = `val menus = rememberAWCMenuScopeState()\nAWCMenuScope(menus, Modifier.requiredSize(360.dp, 480.dp)) {\n    Column(Modifier.fillMaxWidth().padding(top = 12.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {\n${indent(trigger + '\n' + kotlinNode(anchored.menu, values, null, true), 8)}\n    }\n}`;
  }
  if (badgeContext) {
    const badge = roots.find(node => node.selected), parent = roots.find(node => node.tag === 'md-icon-button');
    body = `AWCBadgeHost(modifier = Modifier.requiredSize(48.dp, 48.dp), badge = {\n${indent(kotlinNode(badge, values), 4)}\n}) {\n    AWCIconButtonAppearanceScope(AWCIconButtonAppearance(width = 48.0, height = 48.0)) {\n${indent(kotlinNode(parent, values), 8)}\n    }\n}`;
  }
  if (statusDotContext) {
    const dot = roots.find(node => node.selected), parent = roots.find(node => node.tag === 'md-icon-button');
    body = nativeStatusDotContext(kotlinNode(dot, values), 'android', { inline: values.inline === true, parent: kotlinNode(parent, values) });
  }
  const dividerContext = tag === 'md-divider' && walk(tree.nodes).some(node => Object.hasOwn(node.attrs || {}, 'data-awc-divider-context'));
  if (dividerContext) body = `Box(modifier = Modifier.requiredSize(300.dp, 96.dp), contentAlignment = Alignment.Center) {\n${indent(body, 4)}\n}`;
  const meterContext = ['md-meter', 'md-progress-indicator'].includes(tag) && walk(tree.nodes).some(node => Object.hasOwn(node.attrs || {}, tag === 'md-meter' ? 'data-awc-meter-context' : 'data-awc-progress-context'));
  if (meterContext) body = `Box(modifier = Modifier.requiredWidth(300.dp), contentAlignment = Alignment.Center) {\n${indent(body, 4)}\n}`;
  const skeletonContext = tag === 'md-skeleton' && walk(tree.nodes).some(node => Object.hasOwn(node.attrs || {}, 'data-awc-skeleton-context'));
  if (skeletonContext) body = `AWCSkeletonSizingContextScope(AWCSkeletonSizingContext(parentHeight = 160.0)) {\n    Box(modifier = Modifier.requiredSize(260.dp, 160.dp), contentAlignment = Alignment.TopStart) {\n${indent(body, 8)}\n    }\n}`;
  const styled = Object.keys(appearance.local).length || Object.keys(appearance.defaults).length;
  const appearanceType = appearance.profile.nativeType;
  for (const [scope, value] of [['This component', appearance.local], ['Theme defaults for this subtree', appearance.defaults]]) {
    if (Object.keys(value).length && !(targetedSegment && scope === 'This component')) body = `// ${scope}\n${appearanceType}Scope(appearance = ${appearanceType}(${appearanceEntries(value, appearance.profile).map(([key, item]) => `${key} = ${appearanceValue(appearance.profile, key, item, 'kotlin')}`).join(', ')})) {\n${indent(body, 4)}\n}`;
  }
  const accordionViewport = tag === 'md-accordion' && values.floating === true;
  if (accordionViewport) body = `AWCAccordionViewport(modifier = Modifier.fillMaxWidth().heightIn(min = 320.dp)) {\n${indent(body, 4)}\n}`;
  if (appearance.snackbarLifecycle) body = nativeSnackbarContext(`Column {\n    Button(onClick = { snackbarController.show() }) { Text("Show snackbar") }\n    Button(onClick = { snackbarController.hide() }) { Text("Close snackbar") }\n}\nAWCSnackbarControllerScope(snackbarController) {\n${indent(body, 4)}\n}`, 'android');
  const modalScope = ['md-dialog', 'md-bottom-sheet', 'md-side-sheet'].includes(tag);
  if (modalScope) body = `AWCModalScope(Modifier.fillMaxSize()) {\n${indent(body, 4)}\n}`;
  if (appearance.tooltipLifecycle) body = nativeTooltipContext(body, 'android');
  const tooltipImports = appearance.tooltipLifecycle ? 'import dev.awc.nativeui.AWCTooltipScope\nimport androidx.compose.foundation.layout.fillMaxSize\n' : '';
  const snackbarImports = appearance.snackbarLifecycle ? ['dev.awc.nativeui.AWCSnackbarScope', 'dev.awc.nativeui.AWCSnackbarControllerScope', 'dev.awc.nativeui.rememberAWCSnackbarController', 'androidx.compose.material3.Button', 'androidx.compose.material3.Text', 'androidx.compose.foundation.layout.Column'].map(name => `import ${name}\n`).join('') : '';
  const themeArguments = Object.keys(appearance.themeTokens).length ? `(tokenOverrides = mapOf(${Object.entries(appearance.themeTokens).map(([key, value]) => `${nativeString(key, 'kotlin')} to ${nativeString(value, 'kotlin')}`).join(', ')}))` : '';
  const menuImports = anchored ? ['dev.awc.nativeui.AWCMenuScope', 'dev.awc.nativeui.rememberAWCMenuScopeState', 'androidx.compose.foundation.layout.Arrangement', 'androidx.compose.foundation.layout.fillMaxWidth', 'androidx.compose.foundation.layout.padding', 'androidx.compose.foundation.layout.requiredSize', 'androidx.compose.ui.Alignment', 'androidx.compose.ui.Modifier', 'androidx.compose.ui.unit.dp'].map(name => `import ${name}\n`).join('') : '';
  return `import androidx.compose.runtime.Composable\n${menuImports}${modalScope ? 'import androidx.compose.ui.Modifier\nimport androidx.compose.foundation.layout.fillMaxSize\n' : ''}${snackbarImports}${tooltipImports}${statusDotContext ? statusDotContextImports.map(name => `import ${name}\n`).join('') : ''}${badgeContext ? 'import dev.awc.nativeui.AWCBadgeHost\nimport dev.awc.nativeui.AWCIconButtonAppearance\nimport dev.awc.nativeui.AWCIconButtonAppearanceScope\n' : ''}${menuContext ? 'import dev.awc.nativeui.AWCFabMenuScope\nimport androidx.compose.foundation.layout.fillMaxSize\n' : ''}${['md-tooltip', 'md-fab-menu-item', 'md-segmented-button', 'md-segmented-button-set'].includes(tag) && hasText ? 'import dev.awc.nativeui.AWCSlotText\n' : ''}${meterContext ? 'import androidx.compose.foundation.layout.requiredWidth\n' : ''}${accordionViewport ? 'import dev.awc.nativeui.AWCAccordionViewport\nimport androidx.compose.ui.Modifier\nimport androidx.compose.foundation.layout.fillMaxWidth\nimport androidx.compose.foundation.layout.heightIn\nimport androidx.compose.ui.unit.dp\n' : ''}${skeletonContext ? 'import dev.awc.nativeui.AWCSkeletonSizingContext\nimport dev.awc.nativeui.AWCSkeletonSizingContextScope\n' : ''}${dividerContext || menuContext || badgeContext || meterContext || skeletonContext || appearance.snackbarLifecycle || appearance.tooltipLifecycle ? 'import androidx.compose.foundation.layout.Box\nimport androidx.compose.foundation.layout.requiredSize\nimport androidx.compose.ui.Modifier\nimport androidx.compose.ui.Alignment\nimport androidx.compose.ui.unit.dp\n' : ''}${hasText ? 'import androidx.compose.material3.Text\n' : ''}${hasSymbol ? 'import dev.awc.nativeui.AWCMaterialSymbol\n' : ''}${roots.length > 1 ? 'import androidx.compose.foundation.layout.Column\n' : ''}import dev.awc.nativeui.AWCComponent\nimport dev.awc.nativeui.AWCTheme\nimport dev.awc.nativeui.AWCValue\n${styled ? `import dev.awc.nativeui.${appearanceType}\nimport dev.awc.nativeui.${appearanceType}Scope\n${(appearance.profile.nativeImports || []).map(name => `import dev.awc.nativeui.${name}\n`).join('')}` : ''}\n// Add the :native-ui Gradle module to your app.\n// Children are composed in matching native content slots. HTML layout CSS and\n// recipe setup callbacks require native layout/state in the host app.\n@Composable\nfun ComponentExample() {\n${appearance.snackbarLifecycle ? '    val snackbarController = rememberAWCSnackbarController()\n' : ''}    AWCTheme${themeArguments} {\n${indent(body, 8)}\n    }\n}`;
}
