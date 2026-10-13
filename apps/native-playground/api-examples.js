import { memberDocumentation } from './documentation.js';
import { nativeApiExample } from './native-api-examples.js';

const languages = { html: 'html', react: 'tsx', angular: 'typescript', vue: 'vue', svelte: 'svelte', swift: 'swift', android: 'kotlin' };
const collections = { event: 'events', slot: 'slots', method: 'methods', cssPart: 'cssParts' };
const text = value => typeof value === 'string' ? value : value?.text || '';
const pascal = value => value.split('-').map(part => part[0].toUpperCase() + part.slice(1)).join('');
const indent = (value, spaces = 2) => value.split('\n').map(line => ' '.repeat(spaces) + line).join('\n');
const literal = value => JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
const html = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const templateLiteral = value => value.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
const result = (title, description, code, language, notes = [], status = 'supported') => ({ title, description, code, language, status, notes });
const unknown = (description, framework) => result('Example unavailable', description, null, languages[framework] || 'text', [], 'unknown');

/** Plain display data; source metadata is never evaluated as JavaScript. */
export function apiExample(component = {}, kind, member, framework = 'html') {
  framework = ({ web: 'html', ios: 'swift' })[framework] || framework;
  if (!Object.hasOwn(languages, framework) || !Object.hasOwn(collections, kind)) return unknown('No example is available for this API or framework.', framework);
  if (framework === 'swift' || framework === 'android') return nativeApiExample(component, kind, member, framework);
  const tag = component.tag || component.tagName;
  if (!/^md-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(tag || '')) return unknown('A valid component tag is required.', framework);
  const doc = memberDocumentation(component, kind, member, 'web');
  const name = doc.name;
  if (kind === 'slot' ? !/^[a-z0-9-]*$/.test(name) : !/^[A-Za-z][A-Za-z0-9_-]*$/.test(name)) return unknown('This member name cannot be safely represented in an example.', framework);
  if (kind === 'cssPart') return partExample(tag, doc, framework);
  if (kind === 'slot') return slotExample(tag, doc, framework);
  if (!/^[A-Za-z][A-Za-z0-9]*$/.test(name)) return unknown('This member requires a custom binding; no verified example is available.', framework);
  if (kind === 'event') return eventExample(tag, doc, framework);
  return methodExample(tag, doc, framework);
}

// A cancelable DOM flag does not establish a component default action. Stencil
// defaults that flag to true even for several post-commit notifications. Only
// demonstrate cancellation where the source explicitly checks defaultPrevented.
const cancellationActions = {
  'md-button:mdClick': 'Veto this activation before its side effects.',
  'md-switch:mdInput': 'Prevent the internal toggle before state changes.',
  'md-breadcrumb-item:mdSelect': 'Prevent the default link navigation.',
  'md-chip:mdRemove': 'Keep the chip from removing itself.',
  'md-stepper:mdBeforeChange': 'Veto the step change before it commits.',
};
function eventBody(tag, doc) {
  const detail = text(doc.detail) || text(doc.payload?.detail) || doc.type.replace(/^CustomEvent<([\s\S]+)>$/, '$1');
  const empty = /^(?:void|undefined|never)$/.test(detail.trim());
  const fields = (doc.payloadFields || []).filter(field => typeof field.name === 'string' && !/\b(?:MouseEvent|KeyboardEvent|PointerEvent|HTMLElement|Element)\b/.test(text(field.type))).slice(0, 3);
  const access = fields.length ? fields.map(field => `event.detail[${literal(field.name)}]`).join(', ') : 'event.detail';
  const cancellation = cancellationActions[`${tag}:${doc.name}`];
  return `console.log(${empty ? literal(doc.name) : access});${cancellation && doc.cancelable !== false ? `\n// event.preventDefault(); // ${cancellation}` : ''}`;
}

function eventExample(tag, doc, framework) {
  const name = pascal(tag), handler = `on${doc.name[0].toUpperCase()}${doc.name.slice(1)}`;
  const content = tag === 'md-button' ? 'Continue' : '';
  const attributes = tag === 'md-button' && doc.name === 'mdChange' ? ' toggle' : '';
  const detail = text(doc.detail) || text(doc.payload?.detail) || doc.type;
  const empty = /^(?:CustomEvent<)?(?:void|undefined|never)>?$/.test(detail.trim());
  const body = eventBody(tag, doc);
  // Generated global event maps preserve custom payload types without assuming
  // every referenced source interface is exported from the package entry point.
  const signature = `function ${handler}(event: CustomEvent<HTML${name}ElementEventMap[${literal(doc.name)}]>) {\n${indent(body)}\n}`;
  let code;
  if (framework === 'html') code = `<${tag}${attributes} id="api-example">${content}</${tag}>\n\n<script type="module">\nimport "@awc-ui/core/components/${tag}";\n\nawait customElements.whenDefined(${literal(tag)});\nconst component = document.querySelector("#api-example");\ncomponent.addEventListener(${literal(doc.name)}, event => {\n${indent(body)}\n});\n</script>`;
  else if (framework === 'react') code = `"use client";\nimport { ${name} } from "@awc-ui/react";\nimport type {} from "@awc-ui/core";\n\n${signature}\n\nexport function EventExample() {\n  return <${name}${attributes} ${handler}={${handler}}>${content}</${name}>;\n}`;
  else if (framework === 'vue') code = `<script setup lang="ts">\nimport { ${name} } from "@awc-ui/vue";\nimport type {} from "@awc-ui/core";\n\n${signature}\n</script>\n\n<template>\n  <${name}${attributes} @${doc.name}="${handler}">${content}</${name}>\n</template>`;
  else if (framework === 'svelte') code = `<script lang="ts">\n  import type {} from "@awc-ui/svelte";\n  import "@awc-ui/core/components/${tag}";\n\n${indent(signature)}\n</script>\n\n<${tag}${attributes} on${doc.name}={${handler}}>${content}</${tag}>`;
  else code = `import { Component } from "@angular/core";\nimport { ${name} } from "@awc-ui/angular";\nimport type {} from "@awc-ui/core";\n\n@Component({\n  selector: "app-event-example",\n  standalone: true,\n  imports: [${name}],\n  template: '<${tag}${attributes} (${doc.name})="${handler}($event)">${content}</${tag}>',\n})\nexport class EventExample {\n${indent(signature.replace(/^function /, ''))}\n}`;
  const notes = ['Load @awc-ui/core/css/tokens.css once in your application entry.'];
  if (tag === 'md-button' && doc.name === 'mdChange') notes.push('Enable toggle on the button to emit mdChange when selection changes.');
  if (doc.name === 'mdChange' && ['md-button', 'md-switch', 'md-autocomplete', 'md-color-picker', 'md-number-field', 'md-slider'].includes(tag)) {
    const veto = tag === 'md-button' ? ' Use mdClick to veto the activation beforehand.' : tag === 'md-switch' ? ' Use mdInput to veto the toggle beforehand.' : '';
    notes.push(`This notification observes a committed change. Calling preventDefault() here does not undo that change.${veto}`);
  }
  if (framework === 'svelte') notes.push('Uses Svelte 5 event properties; event names are case-sensitive.');
  return result(`Handle ${doc.name}`, empty ? `Handle ${doc.name}; this event does not carry a detail payload.` : `Bind ${doc.name} and read its event.detail payload in this handler.`, code, languages[framework], notes);
}

const methodArguments = {
  loadOptions: '[{ value: "design", label: "Design systems" }]',
  getLabels: '["design"]', setQuery: '"design"', setCustomValidity: '"Please review this value."',
  setMenuIcon: '"close"', setZoom: '0, 4', stepUp: '2', stepDown: '2',
  setComboboxElement: 'null', setVirtualProvider: 'null',
  setSort: '"name", "asc"', pinColumn: '0, "start"', setColumnVisibility: '0, false',
  setRowsPerPage: '10', goToPage: '1', drill: '0, "down"',
};
function parameterValue(parameter) {
  const type = text(parameter.type).trim();
  if (type === 'number') return '0';
  if (type === 'boolean') return 'true';
  if (type === 'string') return '"Example"';
  if (/^(?:readonly\s+)?string\[\]$/.test(type)) return '["example"]';
  if (/^(?:readonly\s+)?number\[\]$/.test(type)) return '[0]';
  if (/^['"]([^'"\\]*)['"](?:\s*\||$)/.test(type)) return literal(type.match(/^['"]([^'"\\]*)['"]/)[1]);
  if (/(?:^|\|)\s*null\s*(?:\||$)/.test(type)) return 'null';
  return null;
}
function argumentsFor(tag, doc) {
  if (Object.hasOwn(methodArguments, doc.name)) return methodArguments[doc.name];
  if (doc.name === 'setFocus' && tag === 'md-list-item') return '{ preventScroll: true }';
  if (doc.name === 'show' && tag === 'md-menu') return '{ autoFocus: true }';
  const parameters = doc.parameters ?? doc.params ?? [];
  if (!Array.isArray(parameters)) return null;
  const values = [];
  for (const parameter of parameters) {
    if (parameter.optional || parameter.default !== undefined) break;
    const value = parameterValue(parameter);
    if (value === null) return null;
    values.push(value);
  }
  return values.join(', ');
}

function methodExample(tag, doc, framework) {
  const name = pascal(tag), args = argumentsFor(tag, doc);
  if (args === null) return unknown('This method needs an application-specific argument. Construct it from the parameter type shown above before calling the method.', framework);
  const returnType = text(doc.returns?.type) || text(doc.returns) || text(doc.return?.type) || text(doc.returnType);
  const hasResult = returnType && !/^(?:Promise<\s*)?(?:void|undefined)(?:\s*>)?$/.test(returnType.trim());
  const call = `${hasResult ? 'const result = ' : ''}await component.${doc.name}(${args});${hasResult ? '\nconsole.log(result);' : ''}`;
  const body = `await customElements.whenDefined(${literal(tag)});\n${call}`;
  const content = tag === 'md-button' ? 'Continue' : '';
  let code;
  if (framework === 'html') code = `<${tag} id="api-example">${content}</${tag}>\n<button id="run-api" type="button">Run ${doc.name}</button>\n\n<script type="module">\nimport "@awc-ui/core/components/${tag}";\n\ndocument.querySelector("#run-api").addEventListener("click", async () => {\n  await customElements.whenDefined(${literal(tag)});\n  /** @type {HTML${name}Element | null} */\n  const component = document.querySelector("#api-example");\n  if (!component) return;\n${indent(call)}\n});\n</script>`;
  else if (framework === 'react') code = `"use client";\nimport { useRef } from "react";\nimport { ${name} } from "@awc-ui/react";\nimport type {} from "@awc-ui/core";\n\nexport function MethodExample() {\n  const ref = useRef<HTML${name}Element>(null);\n  async function run() {\n    const component = ref.current;\n    if (!component) return;\n${indent(body, 4)}\n  }\n  return <>\n    <${name} ref={ref}>${content}</${name}>\n    <button type="button" onClick={run}>Run ${doc.name}</button>\n  </>;\n}`;
  else if (framework === 'vue') code = `<script setup lang="ts">\nimport { ref } from "vue";\nimport { ${name} } from "@awc-ui/vue";\nimport type {} from "@awc-ui/core";\n\nconst view = ref<{ $el: HTML${name}Element } | null>(null);\nasync function run() {\n  const component = view.value?.$el;\n  if (!component) return;\n${indent(body)}\n}\n</script>\n\n<template>\n  <${name} ref="view">${content}</${name}>\n  <button type="button" @click="run">Run ${doc.name}</button>\n</template>`;
  else if (framework === 'svelte') code = `<script lang="ts">\n  import type {} from "@awc-ui/svelte";\n  import "@awc-ui/core/components/${tag}";\n\n  let view: HTML${name}Element | undefined = $state();\n  async function run() {\n    const component = view;\n    if (!component) return;\n${indent(body, 4)}\n  }\n</script>\n\n<${tag} bind:this={view}>${content}</${tag}>\n<button type="button" onclick={run}>Run ${doc.name}</button>`;
  else code = `import { Component, ViewChild } from "@angular/core";\nimport { ${name} } from "@awc-ui/angular";\n\n@Component({\n  selector: "app-method-example",\n  standalone: true,\n  imports: [${name}],\n  template: \`\n    <${tag}>${content}</${tag}>\n    <button type="button" (click)="run()">Run ${doc.name}</button>\n  \`,\n})\nexport class MethodExample {\n  @ViewChild(${name}) view?: ${name};\n  async run() {\n    const component = this.view;\n    if (!component) return;\n${indent(body, 4)}\n  }\n}`;
  const notes = ['Run in the browser after the element is mounted. Registration is awaited; the public method returns a promise.'];
  if (framework === 'vue') notes.push('The Vue ref is a wrapper instance; $el is the underlying custom element.');
  if (framework === 'angular') notes.push('The Angular wrapper proxies this method to the underlying custom element.');
  if (['setZoom', 'drill', 'setSort', 'pinColumn', 'setColumnVisibility', 'selectItem', 'selectTab', 'focusTab', 'goTo', 'goToPage'].includes(doc.name)) notes.push('Use the populated component from the main Usage example; choose indices or column keys present in your data.');
  if (doc.name === 'getLabels' || doc.name === 'setQuery') notes.push('Load the options first with await component.loadOptions(...); use values present in your option data.');
  if (doc.name === 'setCustomValidity') notes.push('Pass an empty string to clear the custom validation error.');
  if (doc.name === 'setComboboxElement' || doc.name === 'setVirtualProvider') notes.push('Passing null clears the existing integration. Supply your element or provider to attach one.');
  if (doc.name === 'whenClosed') notes.push('Call after showing the overlay; the promise resolves when its current close lifecycle finishes.');
  return result(`Call ${doc.name}()`, `Get the mounted component reference and await ${doc.name}(${args}).`, code, languages[framework], notes);
}

// Representative structural children are essential: a span cannot substitute
// for an option, table row, navigation tab, or another required child component.
const defaultContent = {
  'md-accordion': '<md-accordion-item headline="Details"><p>Account settings</p></md-accordion-item>',
  'md-breadcrumbs': '<md-breadcrumb-item href="/">Home</md-breadcrumb-item>',
  'md-button-group': '<md-button>Save</md-button><md-button>Cancel</md-button>',
  'md-fab-menu': '<md-fab-menu-item icon="edit">Edit</md-fab-menu-item>',
  'md-list': '<md-list-item headline="Design systems"></md-list-item>',
  'md-menu': '<md-menu-item headline="Save"></md-menu-item>',
  'md-menu-item-group': '<md-menu-item headline="Save"></md-menu-item>',
  'md-navigation-bar': '<md-navigation-tab label="Home" icon="home"></md-navigation-tab>',
  'md-navigation-rail': '<md-navigation-rail-tab label="Home" icon="home"></md-navigation-rail-tab>',
  'md-segmented-button-set': '<md-segmented-button value="day" label="Day"></md-segmented-button>',
  'md-select': '<md-select-option value="design" label="Design systems"></md-select-option>',
  'md-multi-select': '<md-select-option value="design" label="Design systems"></md-select-option>',
  'md-stepper': '<md-step label="Details"><p>Account settings</p></md-step>',
  'md-tabs': '<md-tab label="Overview"></md-tab>',
  'md-tab-panels': '<md-tab-panel><p>Overview content</p></md-tab-panel>',
  'md-table': '<md-table-body><md-table-row><md-table-cell>Alex</md-table-cell></md-table-row></md-table-body>',
  'md-table-container': '<md-table><md-table-body><md-table-row><md-table-cell>Alex</md-table-cell></md-table-row></md-table-body></md-table>',
  'md-table-body': '<md-table-row><md-table-cell>Alex</md-table-cell></md-table-row>',
  'md-table-head': '<md-table-row><md-table-cell>Name</md-table-cell></md-table-row>',
  'md-table-foot': '<md-table-row><md-table-cell>Total</md-table-cell></md-table-row>',
  'md-table-row': '<md-table-cell>Alex</md-table-cell>',
  'md-tooltip': '<button type="button">Help</button>',
  'md-toolbar': '<md-icon-button icon="edit" aria-label="Edit"></md-icon-button>',
};
function slotContent(tag, slot) {
  if (!slot) return defaultContent[tag] || (tag === 'md-button' ? 'Continue' : '<span>Custom content</span>');
  const attr = ` slot="${html(slot)}"`;
  if (/icon|^selected$/.test(slot)) return `<svg${attr} width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2"></path></svg>`;
  if (/loader|loading/.test(slot)) return `<span${attr} role="status">Loading…</span>`;
  if (slot === 'submenu') return `<md-menu${attr}><md-menu-item headline="Export"></md-menu-item></md-menu>`;
  if (slot === 'head' && tag === 'md-table') return `<md-table-head${attr}><md-table-row><md-table-cell>Name</md-table-cell></md-table-row></md-table-head>`;
  if (slot === 'fab') return `<md-fab${attr} icon="add" aria-label="Add"></md-fab>`;
  if (slot === 'chips') return `<md-chip${attr} label="Design"></md-chip>`;
  if (/actions?$|^close$|^back$|^trigger$/.test(slot)) return `<button${attr} type="button">${slot === 'close' ? 'Close' : slot === 'back' ? 'Back' : slot === 'trigger' ? 'Open' : 'Save'}</button>`;
  const labels = { headline: 'Account settings', header: 'Overview', subhead: 'More information', subtitle: 'Manage your workspace', 'supporting-text': 'Choose your preferences', empty: 'No items available', separator: '–', center: 'Total: 100', content: 'Additional details', results: 'Search results', footer: 'Last updated today' };
  return `<span${attr}>${html(labels[slot] || 'Custom content')}</span>`;
}
function slotExample(tag, doc, framework) {
  const source = `<${tag}>\n${indent(slotContent(tag, doc.name))}\n</${tag}>`;
  const tags = [...new Set([...source.matchAll(/<(md-[a-z0-9-]+)/g)].map(match => match[1]))];
  const names = tags.map(pascal);
  const markup = ['react', 'vue'].includes(framework) ? source.replace(/(<\/?)(md-[a-z0-9-]+)/g, (_, prefix, value) => prefix + pascal(value)).replace(framework === 'react' ? /stroke-width=/g : /$^/g, 'strokeWidth=') : source;
  let code;
  if (framework === 'html') code = `${markup}\n\n<script type="module">\n${tags.map(value => `import "@awc-ui/core/components/${value}";`).join('\n')}\n</script>`;
  else if (framework === 'react') code = `"use client";\nimport { ${names.join(', ')} } from "@awc-ui/react";\n\nexport function SlotExample() {\n  return (\n${indent(markup, 4)}\n  );\n}`;
  else if (framework === 'vue') code = `<script setup lang="ts">\nimport { ${names.join(', ')} } from "@awc-ui/vue";\n</script>\n\n<template>\n${indent(markup)}\n</template>`;
  else if (framework === 'svelte') code = `<script lang="ts">\n  import type {} from "@awc-ui/svelte";\n${indent(tags.map(value => `import "@awc-ui/core/components/${value}";`).join('\n'))}\n</script>\n\n${markup}`;
  else code = `import { Component } from "@angular/core";\nimport { ${names.join(', ')} } from "@awc-ui/angular";\n\n@Component({\n  selector: "app-slot-example",\n  standalone: true,\n  imports: [${names.join(', ')}],\n  template: \`\n${indent(templateLiteral(markup), 4)}\n  \`,\n})\nexport class SlotExample {}`;
  const notes = ['Load @awc-ui/core/css/tokens.css once in your application entry.'];
  if (framework === 'vue') notes.push('Use the native slot attribute on children; these wrappers project their default Vue slot into the custom element.');
  if (doc.name) notes.push('Keep the slot attribute on a direct child of the custom element. Conditional slots appear only in the relevant component state.');
  if (['md-table-row', 'md-table-body', 'md-table-head', 'md-table-foot', 'md-table-cell', 'md-tab-panel', 'md-select-option', 'md-step', 'md-navigation-tab', 'md-navigation-rail-tab', 'md-breadcrumb-item', 'md-fab-menu-item', 'md-segmented-button'].includes(tag)) notes.push('Place this component inside the parent composition shown in the main Usage example.');
  return result(doc.name ? `Fill the ${doc.name} slot` : 'Fill the default slot', doc.name ? `Insert this direct child with slot="${doc.name}" to provide content at the named insertion point.` : 'Place children between the component tags without a slot attribute.', code, languages[framework], notes);
}

function partExample(tag, doc, framework) {
  const selector = `${tag}::part(${doc.name})`;
  let declarations = 'outline: 2px solid #6750a4;\noutline-offset: 2px;';
  let purpose = `Add an outline to the exposed ${doc.name} part`;
  const notes = ['The part must be rendered for the style to be visible. ::part() targets the exposed shadow element directly.'];
  if (/^(?:label|headline|heading|title|subtitle|supporting-text|overline|text|message|caption|name|value-label|description)$/.test(doc.name)) {
    declarations = 'color: #4f378b;\nfont-weight: 600;';
    purpose = `Change the ${doc.name} text color and weight`;
  } else if (/^(?:icon|leading-icon|trailing-icon|selected-icon|unselected-icon|close-icon|trigger-icon|expand-button-icon)$/.test(doc.name)) {
    declarations = 'color: #4f378b;\nfont-size: 20px;\nwidth: 20px;\nheight: 20px;';
    purpose = `Set the ${doc.name} color and dimensions`;
    if (tag === 'md-button') notes.push(`Set ${doc.name === 'trailing-icon' ? 'trailingIcon' : 'icon'} to a Material Symbols name to render this fallback part. A custom slotted icon is styled on the slotted element instead.`);
  } else if (/^(?:container|surface|panel|button|field|menu-surface|popover|popup)$/.test(doc.name)) {
    declarations = 'border-radius: 12px;\nbackground-color: #f7f2fa;\ncolor: #1d192b;';
    purpose = `Customize the ${doc.name} surface color and corners`;
  } else if (tag === 'md-button' && doc.name === 'loading') {
    // This part is a span containing another shadow component. Its public
    // loading-indicator properties cross that second shadow boundary.
    declarations = '--md-loading-indicator-size: 20px;\n--md-loading-indicator-shape-size: 20px;\n--md-loading-indicator-color: #6750a4;\ncolor: #6750a4;';
    purpose = 'Set the loading indicator size and color through its public CSS properties';
    notes.push('Set loading on md-button to render this part. These public properties reach the nested loading indicator; width on the wrapper alone would not resize it.');
  } else if (doc.name === 'state-layer') {
    declarations = 'background-color: #6750a4;';
    purpose = 'Change the interaction state-layer color';
    notes.push('Hover, focus, or press the enabled component to reveal its state layer. Keep the component’s own opacity and interaction behavior.');
  } else if (tag === 'md-button' && doc.name === 'anchor') {
    declarations = 'text-decoration: underline;\ntext-underline-offset: 0.2em;';
    purpose = 'Underline the internal link text';
  }
  const rule = `${selector} {\n${indent(declarations)}\n}`;
  let code = rule, language = 'css';
  if (framework === 'react') { code = `/* component-parts.css — import this file from your component or app entry. */\n${rule}`; notes.push('Add import "./component-parts.css"; to your React file. In a CSS module, wrap the selector with :global(...).'); }
  else if (framework === 'angular') { code = `/* src/styles.css — application-wide stylesheet */\n${rule}`; notes.push('Use the application stylesheet so Angular view encapsulation does not rewrite the part selector.'); }
  else if (framework === 'vue') { code = `<style>\n${rule}\n</style>`; language = 'vue'; notes.push('Use this unscoped style block, or put the rule in your global stylesheet.'); }
  else if (framework === 'svelte') { code = `<style>\n${indent(rule.replace(selector, `:global(${selector})`))}\n</style>`; language = 'svelte'; notes.push(':global(...) keeps Svelte from adding its component scope to the shadow part selector.'); }
  else notes.push('Put this rule in a stylesheet loaded by the page, or inside a <style> block.');
  if (tag === 'md-button' && doc.name === 'anchor') notes.push('Set a valid href on md-button to render its anchor part.');
  return result(`Style ::part(${doc.name})`, `${purpose} of ${tag}. Adjust these declarations to match your design.`, code, language, notes);
}
