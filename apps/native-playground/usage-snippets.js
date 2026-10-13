import { BUTTON_APPEARANCE_FIELDS, normalizeButtonAppearance, buttonAppearanceCSS } from './button-appearance.js';

export const snippetLanguages = Object.freeze([
  { id: 'html', label: 'HTML', language: 'html' },
  { id: 'react', label: 'React', language: 'tsx' },
  { id: 'angular', label: 'Angular', language: 'typescript' },
  { id: 'vue', label: 'Vue', language: 'vue' },
  { id: 'svelte', label: 'Svelte', language: 'svelte' },
  { id: 'swift', label: 'SwiftUI', language: 'swift' },
  { id: 'android', label: 'Android', language: 'kotlin' },
].map(Object.freeze));

/** Copyable examples for the public framework, SwiftUI and Compose APIs.
 * `html` is trusted local recipe markup. Property values are JSON data, never code.
 */
export function usageSnippet(component, properties = {}, platform = 'web', { html, text, buttonAppearance, buttonAppearanceDefaults } = {}) {
  const tag = component?.tag;
  if (typeof tag !== 'string' || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)+$/.test(tag)) throw new TypeError('A valid component tag is required.');
  platform = ({ web: 'html', ios: 'swift' })[platform] ?? platform;
  if (!snippetLanguages.some(language => language.id === platform)) throw new TypeError(`Unknown snippet platform: ${platform}`);
  const declared = Array.isArray(component.properties) ? new Set(component.properties.map(property => typeof property === 'string' ? property : property.name)) : null;
  const filtered = Object.fromEntries(Object.entries(properties ?? {}).filter(([key, value]) => value !== undefined && (!declared || declared.has(key))));
  const values = jsonValue(filtered);
  const events = [...new Set((component.events ?? []).map(event => typeof event === 'string' ? event : event.name).filter(name => typeof name === 'string' && name.length))];
  const tree = recipeTree(tag, html, text);
  const appearance = { defaults: normalizeButtonAppearance(buttonAppearanceDefaults), local: normalizeButtonAppearance(tag === 'md-button' ? buttonAppearance : undefined) };
  if (platform === 'swift') return swiftSnippet(tag, values, tree, appearance);
  if (platform === 'android') return kotlinSnippet(tag, values, tree, appearance);
  const css = (value, inherited) => Object.entries(buttonAppearanceCSS(value, inherited)).map(([name, value]) => `${name}: ${value}`).join('; ');
  if (Object.keys(appearance.local).length) tree.selected.attrs.style = [css(appearance.local, appearance.defaults), tree.selected.attrs.style].filter(Boolean).join('; ');
  if (Object.keys(appearance.defaults).length) tree.nodes = [{tag: 'div', attrs: {style: css(appearance.defaults)}, children: tree.nodes}];
  const markup = tree.nodes.map(node => renderHTML(node)).join('');
  if (platform === 'html') return webSnippet(tag, values, events, markup);
  return frameworkSnippet(tag, values, events, tree, platform);
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
const appearanceEntries = value => BUTTON_APPEARANCE_FIELDS.filter(field => Object.hasOwn(value, field.name)).map(field => [field.name, value[field.name]]);

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

function frameworkSnippet(tag, values, events, tree, platform) {
  const names = [...new Set(walk(tree.nodes).filter(custom).map(node => pascal(node.tag)))].sort();
  const tags = [...new Set(walk(tree.nodes).filter(custom).map(node => node.tag))].sort();
  const usedStyle = platform === 'react' && walk(tree.nodes).some(node => node.attrs?.style);
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
      if (platform === 'react' || platform === 'svelte') attributes.push('{...properties}');
      else if (platform === 'vue') attributes.push('v-bind="properties"');
      else for (const key of Object.keys(values)) attributes.push(`[${key}]="${htmlText(expressionName(key))}!"`);
      for (const event of events) {
        if (!/^[A-Za-z][A-Za-z0-9]*$/.test(event)) continue;
        if (platform === 'react') attributes.push(`on${event[0].toUpperCase() + event.slice(1)}={onEvent}`);
        else if (platform === 'svelte') attributes.push(`on${event}={onEvent}`);
        else if (platform === 'vue') attributes.push(`@${event}="onEvent"`);
        else attributes.push(`(${event})="onEvent($event)"`);
      }
    }
    const opening = `<${name}${attributes.length ? ' ' + attributes.join(' ') : ''}`;
    if (voidTags.has(node.tag)) return opening + (platform === 'react' ? ' />' : '>');
    return `${opening}>${node.children.map(render).join('')}</${name}>`;
  };
  const markup = tree.nodes.map(render).join('\n');
  const eventHandler = events.length ? '\nfunction onEvent(event: CustomEvent) {\n  console.log(event.type, event.detail);\n}\n' : '';
  const type = `Partial<Components.${pascal(tag)}>`;
  const core = 'import type { Components } from "@awc-ui/core";\nimport "@awc-ui/core/css/tokens.css";';
  const setup = `// Client-side example. Install @awc-ui/${platform} and @awc-ui/core.\n// Load tokens.css once in your application entry.\n`;
  const note = walk(tree.nodes).some(node => Object.keys(node.attrs ?? {}).some(key => /^data-(?:open|close)$/.test(key)) || node.attrs?.id === 'demo-menu-trigger' || node.attrs?.id === 'demo-fab-anchor')
    ? '// Wire the recipe launch/close controls to your application\'s open state.\n' : '';
  if (platform === 'react') return `"use client";\n\n${setup}import { useState${usedStyle ? ', type CSSProperties' : ''} } from "react";\nimport { ${names.join(', ')} } from "@awc-ui/react";\n${core}\n${eventHandler}\nexport function ComponentExample() {\n  const [properties] = useState<${type}>(${jsLiteral(values, true)});\n${note ? indent(note.trimEnd(), 2) + '\n' : ''}  return (\n    <>\n${indent(markup, 6)}\n    </>\n  );\n}`;
  if (platform === 'vue') return `<script setup lang="ts">\n${setup}import { reactive } from "vue";\nimport { ${names.join(', ')} } from "@awc-ui/vue";\n${core}\n\nconst properties = reactive<${type}>(${jsLiteral(values, true)});\n${eventHandler}${note}</script>\n\n<template>\n${indent(markup, 2)}\n</template>`;
  if (platform === 'svelte') return `<script lang="ts">\n${indent(setup + 'import type {} from "@awc-ui/svelte";\n' + core + '\n' + tags.map(name => `import "@awc-ui/core/components/${name}";`).join('\n'), 2)}\n\n  let properties: ${type} = $state(${jsLiteral(values, true)});\n${eventHandler ? indent(eventHandler.trim(), 2) + '\n' : ''}${note ? indent(note.trim(), 2) + '\n' : ''}</script>\n\n${markup}`;
  const template = markup.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
  return `${setup}import { Component } from "@angular/core";\nimport { ${names.join(', ')} } from "@awc-ui/angular";\n${core}\n\n@Component({\n  selector: "app-component-example",\n  standalone: true,\n  imports: [${names.join(', ')}],\n  template: \`\n${indent(template, 4)}\n  \`,\n})\nexport class ComponentExample {\n  properties: ${type} = ${jsLiteral(values, true)};\n${events.length ? '\n  onEvent(event: CustomEvent) {\n    console.log(event.type, event.detail);\n  }\n' : ''}${note ? indent(note.trim(), 2) + '\n' : ''}}`;
}

// Escape HTML parser delimiters even though these are JavaScript string/object
// literals: a literal </script> would terminate the containing HTML script first.
function jsLiteral(value, pretty = false) {
  return JSON.stringify(value, null, pretty ? 2 : undefined)
    .replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')
    .replace(/"__proto__":/g, '["__proto__"]:');
}
function indent(value, spaces) { return value.split('\n').map(line => ' '.repeat(spaces) + line).join('\n'); }
function webSnippet(tag, properties, events, html, text) {
  const markup = typeof html === 'string' && html.trim() ? html.trim() : `<${tag}>${htmlText(text)}</${tag}>`;
  const listeners = events.length ? `\nfor (const name of ${jsLiteral(events)}) {\n  component.addEventListener(name, event => {\n    console.log(name, event.detail);\n  });\n}\n` : '\n';
  return `<div id="awc-example">\n${indent(markup, 2)}\n</div>\n\n<script type="module">\nimport "@awc-ui/core/define";\nimport "@awc-ui/core/css/tokens.css";\n\nawait customElements.whenDefined(${jsLiteral(tag)});\nconst component = document.querySelector(${jsLiteral(`#awc-example ${tag}`)});\n${listeners}\nObject.assign(component, ${jsLiteral(properties, true)});\n</script>`;
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
function nativeNodes(nodes, slot = null) {
  return nodes.flatMap(node => {
    const assignedSlot = node.attrs?.slot ?? slot;
    if (node.text !== undefined) return node.explicitText || node.text.trim() ? [{ text: node.text, slot: assignedSlot }] : [];
    if (!custom(node)) return nativeNodes(node.children, assignedSlot);
    return [{ ...node, slot: assignedSlot, children: nativeNodes(node.children) }];
  });
}
function swiftNode(node, values) {
  if (node.text !== undefined) return `.text(${nativeString(node.text, 'swift')}${node.slot ? `, slot: ${nativeString(node.slot, 'swift')}` : ''})`;
  const properties = { ...nodeProperties(node), ...(node.selected ? values : {}) };
  const dictionary = swiftValue(properties).slice(8, -1);
  const children = node.children.map(child => swiftNode(child, values)).join(', ');
  return `AWCNode(${node.attrs.id ? `id: ${nativeString(node.attrs.id, 'swift')}, ` : ''}tag: ${nativeString(node.tag, 'swift')}, properties: ${dictionary}, children: [${children}]${node.slot ? `, slot: ${nativeString(node.slot, 'swift')}` : ''})`;
}
function swiftSnippet(tag, values, tree, appearance) {
  const roots = nativeNodes(tree.nodes);
  const simple = roots.length === 1 && roots[0].selected;
  const selected = simple ? roots[0] : null;
  values = simple ? { ...nodeProperties(selected), ...values } : values;
  const entries = Object.entries(values);
  const properties = entries.length ? `[\n${entries.map(([key, value]) => `                ${nativeString(key, 'swift')}: ${swiftValue(value)}`).join(',\n')}\n            ]` : '[:]';
  const children = selected ? `[${selected.children.map(child => swiftNode(child, values)).join(', ')}]` : '[]';
  const note = '        // Add the AWCUI Swift package to your app.\n        // AWCNode preserves native children and named slots; HTML layout CSS and\n        // recipe setup callbacks require native layout/state in the host app.\n';
  let body = simple ? `AWCNativeView(\n    tag: ${nativeString(tag, 'swift')},\n    properties: ${properties},\n    children: ${children},\n    onEvent: { event in\n        print(event.name, event.detail.json)\n    }\n)` : `VStack(alignment: .leading) {\n${roots.map(node => node.text !== undefined ? `    Text(${nativeString(node.text, 'swift')})` : `    AWCNativeView(node: ${swiftNode(node, values)}, onEvent: { event in\n        print(event.name, event.detail.json)\n    })`).join('\n')}\n}`;
  for (const [scope, value] of [['This button', appearance.local], ['Theme defaults for this subtree', appearance.defaults]]) {
    if (Object.keys(value).length) body += `\n// ${scope}\n.awcButtonAppearance(.init(${appearanceEntries(value).map(([key, item]) => `${key}: ${typeof item === 'string' ? nativeString(item, 'swift') : numberLiteral(item)}`).join(', ')}))`;
  }
  return `import SwiftUI\nimport AWCUI\n\nstruct ComponentExample: View {\n    var body: some View {\n${note}${indent(body, 8)}\n    }\n}`;
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
function kotlinNode(node, values) {
  if (node.text !== undefined) return `Text(${nativeString(node.text, 'kotlin')})`;
  const properties = { ...nodeProperties(node), ...(node.selected ? values : {}) };
  const entries = Object.entries(properties);
  const dictionary = entries.length ? `mapOf<String, AWCValue>(\n${entries.map(([key, value]) => `        ${nativeString(key, 'kotlin')} to ${kotlinValue(value)}`).join(',\n')}\n    )` : 'emptyMap()';
  const groups = new Map();
  for (const child of node.children) {
    const slot = child.slot ?? '';
    if (!groups.has(slot)) groups.set(slot, []);
    groups.get(slot).push(child);
  }
  const content = node.children.length ? ` { slot ->\n${[...groups].map(([slot, nodes]) => nodes.length === 1 && nodes[0].text !== undefined ? `    if (slot == ${nativeString(slot, 'kotlin')}) ${kotlinNode(nodes[0], values)}` : `    if (slot == ${nativeString(slot, 'kotlin')}) {\n${indent(nodes.map(child => kotlinNode(child, values)).join('\n'), 8)}\n    }`).join('\n')}\n}` : '';
  return `AWCComponent(\n    tag = ${nativeString(node.tag, 'kotlin')},\n    properties = ${dictionary},\n    onEvent = { name, detail -> println(name + ": " + detail) },\n)${content}`;
}
function kotlinSnippet(tag, values, tree, appearance) {
  const roots = nativeNodes(tree.nodes);
  const hasText = walk(roots).some(node => node.text !== undefined);
  let body = roots.map(node => kotlinNode(node, values)).join('\n');
  if (roots.length > 1) body = `Column {\n${indent(body, 4)}\n}`;
  const styled = Object.keys(appearance.local).length || Object.keys(appearance.defaults).length;
  for (const [scope, value] of [['This button', appearance.local], ['Theme defaults for this subtree', appearance.defaults]]) {
    if (Object.keys(value).length) body = `// ${scope}\nAWCButtonAppearanceScope(appearance = AWCButtonAppearance(${Object.entries(value).map(([key, item]) => `${key} = ${typeof item === 'string' ? nativeString(item, 'kotlin') : Number.isInteger(item) ? `${item}.0` : numberLiteral(item)}`).join(', ')})) {\n${indent(body, 4)}\n}`;
  }
  return `import androidx.compose.runtime.Composable\n${hasText ? 'import androidx.compose.material3.Text\n' : ''}${roots.length > 1 ? 'import androidx.compose.foundation.layout.Column\n' : ''}import dev.awc.nativeui.AWCComponent\nimport dev.awc.nativeui.AWCTheme\nimport dev.awc.nativeui.AWCValue\n${styled ? 'import dev.awc.nativeui.AWCButtonAppearance\nimport dev.awc.nativeui.AWCButtonAppearanceScope\n' : ''}\n// Add the :native-ui Gradle module to your app.\n// Children are composed in matching native content slots. HTML layout CSS and\n// recipe setup callbacks require native layout/state in the host app.\n@Composable\nfun ComponentExample() {\n    AWCTheme {\n${indent(body, 8)}\n    }\n}`;
}
