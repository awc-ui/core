import { memberDocumentation } from './documentation.js';
import { nativeApiExample } from './native-api-examples.js';
import { usageSnippet } from './usage-snippets.js';
import { recipeFor } from './recipes.js';

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
  if (kind === 'event') return eventExample(component, tag, doc, framework);
  return methodExample(component, tag, doc, framework);
}

// Prerequisites come from the source implementations: the focused API must
// have a visible control/data path that can actually exercise its behavior.
function apiRecipe(tag, kind, member) {
  const source = recipeFor(tag);
  const recipe = { ...source, props: { ...source.props } };
  const props = recipe.props;
  if (tag === 'md-button' && member === 'mdChange') props.toggle = true;
  if (tag === 'md-card') {
    if (member === 'mdClick') props.interactive = true;
    if (member.startsWith('mdDrag')) props.dragEnabled = true;
  }
  if (tag === 'md-avatar') {
    if (member === 'mdLoad') props.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="64" height="64"%3E%3Crect width="64" height="64" fill="%236750a4"/%3E%3C/svg%3E';
    if (member === 'mdError') props.src = 'data:image/png;base64,broken-image';
  }
  if (tag === 'md-chip' && member === 'mdRemove') Object.assign(props, { variant: 'input', removable: true });
  if (tag === 'md-app-bar' && member.startsWith('mdSearch')) props.variant = 'search';
  if (tag === 'md-breadcrumbs') Object.assign(props, { maxItems: 2, itemsBeforeCollapse: 1, itemsAfterCollapse: 1 });
  if (tag === 'md-accordion' && /Reorder|Drag/.test(member)) props.reorderable = true;
  if (tag === 'md-accordion-item' && member === 'mdItemRequestReorder') recipe.html = recipe.html.replace('<md-accordion>', '<md-accordion reorderable>');
  if (tag === 'md-list' && member === 'mdReorder') props.reorderable = true;
  if (tag === 'md-list-item') {
    if (member === 'mdItemRequestReorder') recipe.html = recipe.html.replace('<md-list ', '<md-list reorderable ');
    if (['mdExpand', 'toggle', 'expand', 'collapse'].includes(member)) {
      props.expandable = true;
      recipe.html = recipe.html.replace(/(<md-list-item[^>]*>)/, '$1<p slot="expanded-content">Shared components, tokens, and documentation.</p>');
    }
  }
  if (tag === 'md-text-field') {
    if (member === 'mdSearch') props.debounce = 250;
    if (member === 'mdClear') props.clearable = 'internal';
    if (member === 'mdPasswordToggle') Object.assign(props, { type: 'password', passwordToggle: 'internal' });
    if (member === 'mdSpeechResult') props.speechToText = 'external';
  }
  if (tag === 'md-multi-select' && member === 'mdClear') props.clearable = true;
  if (tag === 'md-side-sheet' && member === 'mdBack') props.showBack = true;
  if (tag === 'md-navigation-rail-tab' && member === 'mdSubmenuToggle') recipe.html = recipe.html.replace(/(<md-navigation-rail-tab[^>]*>)/, '$1<md-menu slot="submenu"><md-menu-item headline="Recent workspaces"></md-menu-item><md-menu-item headline="All workspaces"></md-menu-item></md-menu>');
  if (tag === 'md-search') {
    if (member === 'mdClear' || member === 'mdTrailingIconClick') props.value = 'Design';
    if (member === 'mdVoice' || member === 'startVoice' || member === 'stopVoice') props.voiceSearch = true;
  }
  if (/^md-(?:area|line|bar)-chart$/.test(tag) && ['mdZoom', 'setZoom', 'resetZoom'].includes(member)) props.zoom = 'both';
  if (/^md-(?:area|line)-chart$/.test(tag) && member === 'mdMarkerClick') props.showMarks = true;
  if (tag === 'md-line-chart' && member === 'mdAreaClick') props.area = true;
  if (tag === 'md-table-pagination' && member === 'mdPageChange') props.rowsPerPage = 1;
  if (kind === 'method') {
    if (tag === 'md-select' || tag === 'md-multi-select') {
      if (member === 'setQuery') { props.filterable = true; props.open = true; }
    }
    if (member === 'close' || member === 'hide' || member === 'closeMenu' || member === 'whenClosed') props.open = true;
    if (member === 'collapse' && ['md-list-item', 'md-navigation-rail'].includes(tag)) props.expanded = true;
    if (member === 'prev' && tag === 'md-stepper') props.active = 1;
  }
  return recipe;
}

function eventExample(component, tag, doc, framework) {
  const detail = text(doc.detail) || text(doc.payload?.detail) || doc.type;
  const empty = /^(?:CustomEvent<)?(?:void|undefined|never)>?$/.test(detail.trim());
  const recipe = apiRecipe(tag, 'event', doc.name);
  const properties = recipe.props;
  // These notifications have no built-in UI trigger: expose their public
  // mutator beside the handler so the example can emit the selected event.
  const triggerMethod = tag === 'md-table' ? ({ mdPinChange: 'pinColumn', mdColumnVisibilityChange: 'setColumnVisibility' })[doc.name] : null;
  let focusMethod = triggerMethod ? { name: triggerMethod, arguments: methodArguments[triggerMethod] } : undefined;
  if (tag === 'md-progress-indicator' && doc.name === 'mdComplete') focusMethod = { name: 'complete', arguments: [], action: 'set-property', value: true };
  if (tag === 'md-select-option' && doc.name === 'mdSelectOptionChange') focusMethod = { name: 'label', arguments: [], action: 'set-property', value: 'Updated team name' };
  const code = usageSnippet({ ...component, tag, events: [{ name: doc.name }] }, properties, framework, { html: recipe.html, focusEvent: doc, focusMethod });
  const notes = ['Load @awc-ui/core/css/tokens.css once in your application entry.'];
  if (tag === 'md-button' && doc.name === 'mdChange') notes.push('Enable toggle on the button to emit mdChange when selection changes.');
  if (doc.name === 'mdChange' && ['md-button', 'md-switch', 'md-autocomplete', 'md-color-picker', 'md-number-field', 'md-slider'].includes(tag)) {
    const veto = tag === 'md-button' ? ' Use mdClick to veto the activation beforehand.' : tag === 'md-switch' ? ' Use mdInput to veto the toggle beforehand.' : '';
    notes.push(`This notification observes a committed change. Calling preventDefault() here does not undo that change.${veto}`);
  }
  if (framework === 'svelte') notes.push('Uses Svelte 5 event properties; event names are case-sensitive.');
  if (tag === 'md-card' && doc.name.startsWith('mdDrag')) notes.push('Drag the card surface with the primary pointer; movement past the threshold starts the drag sequence.');
  if (tag === 'md-text-field' && doc.name === 'mdSpeechResult') notes.push('External speech mode reports the microphone control state; connect your speech-recognition service in this handler.');
  if (tag === 'md-search' && doc.name === 'mdVoice') notes.push('Voice input requires a browser with speech recognition and microphone permission.');
  if (tag === 'md-avatar' && doc.name === 'mdError') notes.push('The deliberately invalid image exercises the error handler and the initials fallback.');
  if (tag === 'md-progress-indicator' && doc.name === 'mdComplete') notes.push('Set complete after mounting to start the completion animation; reaching value 100 alone does not emit mdComplete.');
  return result(`Handle ${doc.name}`, empty ? `Handle ${doc.name}; this event does not carry a detail payload.` : `Bind ${doc.name} and read its event.detail payload in this handler.`, code, languages[framework], notes);
}

const methodArguments = {
  loadOptions: [[{ value: 'design', label: 'Design systems' }, { value: 'mobile', label: 'Mobile apps' }]],
  getLabels: [['design']], setQuery: ['design'], setCustomValidity: ['Please review this value.'],
  setMenuIcon: ['close'], setZoom: [0, 4], stepUp: [2], stepDown: [2],
  setComboboxElement: [null], setVirtualProvider: [null],
  setSort: ['platform', 'asc'], pinColumn: [0, 'start'], setColumnVisibility: [0, false],
  setRowsPerPage: [1], goToPage: [0], drill: [0, 'down'],
};
const methodArgumentTags = {
  loadOptions: ['md-select', 'md-multi-select', 'md-autocomplete'],
  getLabels: ['md-select', 'md-multi-select', 'md-autocomplete'],
  setQuery: ['md-select', 'md-multi-select'],
  setCustomValidity: ['md-autocomplete', 'md-checkbox', 'md-date-picker', 'md-multi-select', 'md-number-field', 'md-otp-field', 'md-radio', 'md-select', 'md-switch', 'md-text-field'],
  setMenuIcon: ['md-fab'], setZoom: ['md-area-chart', 'md-bar-chart', 'md-line-chart'],
  stepUp: ['md-number-field'], stepDown: ['md-number-field'],
  setComboboxElement: ['md-menu'], setVirtualProvider: ['md-menu'],
  setSort: ['md-table'], pinColumn: ['md-table'], setColumnVisibility: ['md-table'],
  setRowsPerPage: ['md-table-pagination'], goToPage: ['md-table-pagination'],
  drill: ['md-bar-chart', 'md-pie-chart'],
};
const unsupportedParameter = Symbol('application-specific parameter');
function parameterValue(parameter) {
  const type = text(parameter.type).trim();
  if (type === 'number') return 0;
  if (type === 'boolean') return true;
  if (type === 'string') return 'Example';
  if (/^(?:readonly\s+)?string\[\]$/.test(type)) return ['example'];
  if (/^(?:readonly\s+)?number\[\]$/.test(type)) return [0];
  if (/^['"]([^'"\\]*)['"](?:\s*\||$)/.test(type)) return type.match(/^['"]([^'"\\]*)['"]/)[1];
  if (/(?:^|\|)\s*null\s*(?:\||$)/.test(type)) return null;
  return unsupportedParameter;
}
/** JSON arguments for live method controls. Null means the application must supply them. */
export function methodExampleArguments(component = {}, method) {
  const tag = component.tag || component.tagName;
  const name = typeof method === 'string' ? method : method?.name;
  if (!/^md-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(tag || '') || !/^[A-Za-z][A-Za-z0-9]*$/.test(name || '')) return null;
  const declarations = component.methods ?? component.members?.filter(member => member.kind === 'method') ?? [];
  if (typeof method === 'string' && !declarations.some(item => (typeof item === 'string' ? item : item.name) === name)) return null;
  const doc = memberDocumentation(component, 'method', method, 'web');
  if (Object.hasOwn(methodArguments, doc.name) && methodArgumentTags[doc.name]?.includes(tag)) return JSON.parse(JSON.stringify(methodArguments[doc.name]));
  if (doc.name === 'setFocus' && tag === 'md-list-item') return [{ preventScroll: true }];
  if (doc.name === 'show' && tag === 'md-menu') return [{ autoFocus: true }];
  const parameters = doc.parameters ?? doc.params ?? [];
  if (!Array.isArray(parameters)) return null;
  const values = [];
  for (const parameter of parameters) {
    if (parameter.optional || parameter.default !== undefined) break;
    const value = parameterValue(parameter);
    if (value === unsupportedParameter) return null;
    values.push(value);
  }
  return values;
}

function methodExample(component, tag, doc, framework) {
  const argumentValues = methodExampleArguments(component, doc);
  if (argumentValues === null) return unknown('This method needs an application-specific argument. Construct it from the parameter type shown above before calling the method.', framework);
  const args = argumentValues.map(literal).join(', ');
  const recipe = apiRecipe(tag, 'method', doc.name);
  const code = usageSnippet({ ...component, tag, events: [] }, recipe.props, framework, { html: recipe.html, focusMethod: { ...doc, arguments: argumentValues } });
  const notes = ['Run in the browser after the element is mounted. Registration is awaited; the public method returns a promise.'];
  if (framework === 'vue') notes.push('The Vue ref is a wrapper instance; $el is the underlying custom element.');
  if (framework === 'angular') notes.push('The Angular wrapper proxies this method to the underlying custom element.');
  if (['setZoom', 'setSort', 'pinColumn', 'setColumnVisibility', 'selectItem', 'selectTab', 'focusTab', 'goTo', 'goToPage'].includes(doc.name)) notes.push('Indices and column keys refer to the populated sample above; use values present in your own data.');
  if (doc.name === 'drill') notes.push('This arms the next data change. After awaiting drill(), assign the next data (pie) or series and xAxis (bar) to animate the transition.');
  if (doc.name === 'getLabels' || doc.name === 'setQuery') notes.push('This sample supplies options up front; use values present in your own option data.');
  if (doc.name === 'setCustomValidity') notes.push('Pass an empty string to clear the custom validation error.');
  if (doc.name === 'setComboboxElement' || doc.name === 'setVirtualProvider') notes.push('Passing null clears the existing integration. Supply your element or provider to attach one.');
  if (doc.name === 'whenClosed') notes.push('Call after showing the overlay; the promise resolves when its current close lifecycle finishes.');
  if (doc.name === 'moveSelectedRight' || doc.name === 'moveSelectedLeft') notes.push('Select one or more items on the corresponding side before running the move method.');
  if (doc.name === 'startVoice' || doc.name === 'stopVoice') notes.push('Voice input requires browser speech-recognition support and microphone permission. Start recognition before stopping it.');
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
