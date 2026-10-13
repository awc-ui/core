// Copyable examples of the public native adapters. Source TypeScript signatures
// are never treated as native methods or as native payload declarations.
import { memberDocumentation } from './documentation.js';
import { editableTextSlot } from './content-slots.js';

const indent = (text, size = 4) => text.split('\n').map(line => ' '.repeat(size) + line).join('\n');
const collection = { event: 'events', slot: 'slots', method: 'methods', cssPart: 'cssParts' };
const has = (values, name) => Array.isArray(values) && values.some(value => (typeof value === 'string' ? value : value?.name) === name);

function literal(value, platform) {
  return '"' + [...String(value)].map(character => {
    const code = character.codePointAt(0);
    if (character === '"') return '\\"';
    if (character === '\\') return '\\\\';
    if (character === '\n') return '\\n';
    if (character === '\r') return '\\r';
    if (character === '\t') return '\\t';
    if (character === '$' && platform === 'android') return '\\$';
    if (code < 32 || code === 127 || code === 0x2028 || code === 0x2029 || (code >= 0xd800 && code <= 0xdfff)) {
      return platform === 'swift' ? `\\u{${(code >= 0xd800 && code <= 0xdfff ? 0xfffd : code).toString(16)}}` : `\\u${code.toString(16).padStart(4, '0')}`;
    }
    return character;
  }).join('') + '"';
}

function valueCode(value, platform) {
  if (platform === 'swift') {
    if (value === null) return '.null';
    if (typeof value === 'string') return `.string(${literal(value, platform)})`;
    if (typeof value === 'boolean') return `.bool(${value})`;
    if (typeof value === 'number') return `.number(${value})`;
    if (Array.isArray(value)) return `.array([${value.map(item => valueCode(item, platform)).join(', ')}])`;
    return `.object(${propertiesCode(value, platform)})`;
  }
  if (value === null) return 'null';
  if (typeof value === 'string') return literal(value, platform);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return `listOf<AWCValue>(${value.map(item => valueCode(item, platform)).join(', ')})`;
  return propertiesCode(value, platform);
}

function propertiesCode(properties, platform, expressions = {}) {
  const entries = Object.entries({ ...properties, ...expressions });
  if (platform === 'swift') return entries.length ? `[${entries.map(([key, value]) => `${literal(key, platform)}: ${Object.hasOwn(expressions, key) ? value : valueCode(value, platform)}`).join(', ')}]` : '[:]';
  return entries.length ? `mapOf<String, AWCValue>(${entries.map(([key, value]) => `${literal(key, platform)} to ${Object.hasOwn(expressions, key) ? value : valueCode(value, platform)}`).join(', ')})` : 'emptyMap()';
}

function swiftExample(body, state = '') {
  return `import SwiftUI\nimport AWCUI\n\n// Add the AWCUI Swift package to your app.\nstruct NativeAPIExample: View {\n${state ? indent(state) + '\n\n' : ''}    var body: some View {\n${indent(body, 8)}\n    }\n}`;
}

function androidExample(body, state = '', imports = []) {
  return `import androidx.compose.runtime.*\nimport androidx.compose.foundation.layout.Column\nimport androidx.compose.material3.Text\n${imports.map(name => `import ${name}\n`).join('')}import dev.awc.nativeui.*\n\n// Add the :native-ui Gradle module to your app.\n@Composable\nfun NativeAPIExample() {\n${state ? indent(state) + '\n' : ''}    AWCTheme {\n${indent(body, 8)}\n    }\n}`;
}

function componentCode(tag, properties, platform, { children = [], handler, expressions = {} } = {}) {
  if (platform === 'swift') {
    const node = (child, index, parent = 'example') => child.text !== undefined
      ? `.text(${literal(child.text, platform)}${child.slot ? `, slot: ${literal(child.slot, platform)}` : ''})`
      : `AWCNode(id: ${literal(`${parent}-${index}`, platform)}, tag: ${literal(child.tag, platform)}, properties: ${propertiesCode(child.properties ?? {}, platform)}, children: [${(child.children ?? []).map((value, position) => node(value, position, `${parent}-${index}`)).join(', ')}]${child.slot ? `, slot: ${literal(child.slot, platform)}` : ''})`;
    return `AWCNativeView(\n    tag: ${literal(tag, platform)},\n    properties: ${propertiesCode(properties, platform, expressions)},\n    children: [${children.map((child, index) => node(child, index)).join(', ')}]${handler ? `,\n    onEvent: { event in\n${indent(handler, 8)}\n    }` : ''}\n)`;
  }
  const groups = new Map();
  for (const child of children) {
    const name = child.slot ?? '';
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(child);
  }
  const contents = [...groups].map(([name, nodes]) => `if (slot == ${literal(name, platform)}) {\n${indent(nodes.map(child => child.text !== undefined ? `Text(${literal(child.text, platform)})` : componentCode(child.tag, child.properties ?? {}, platform, { children: child.children ?? [] })).join('\n'))}\n}`);
  return `AWCComponent(\n    tag = ${literal(tag, platform)},\n    properties = ${propertiesCode(properties, platform, expressions)},${handler ? `\n    onEvent = { name, detail ->\n${indent(handler, 8)}\n    },` : ''}\n)${contents.length ? ` { slot ->\n${indent(contents.join('\n'))}\n}` : ''}`;
}

// Composite slots need native component children, rather than text that merely
// occupies a slot. These are small adapter compositions, not source HTML.
const structuralChild = {
  'md-button-group': { tag: 'md-button', children: [{ text: 'Save' }] },
  'md-segmented-button-set': { tag: 'md-segmented-button', properties: { value: 'one' }, children: [{ text: 'One' }] },
  'md-accordion': { tag: 'md-accordion-item', properties: { headline: 'Details', expanded: true }, children: [{ text: 'Additional information' }] },
  'md-list': { tag: 'md-list-item', properties: { headline: 'First item', supportingText: 'Item details' } },
  'md-tabs': { tag: 'md-tab', properties: { label: 'Overview' } },
  'md-tab-panels': { tag: 'md-tab-panel', properties: { active: true }, children: [{ text: 'Overview content' }] },
  'md-navigation-bar': { tag: 'md-navigation-tab', properties: { label: 'Home', icon: 'home' } },
  'md-navigation-rail': { tag: 'md-navigation-rail-tab', properties: { label: 'Home', icon: 'home', value: 'home' } },
  'md-breadcrumbs': { tag: 'md-breadcrumb-item', properties: { current: true }, children: [{ text: 'Current page' }] },
  'md-stepper': { tag: 'md-step', properties: { label: 'Details' }, children: [{ text: 'Complete this step.' }] },
  'md-menu': { tag: 'md-menu-item', properties: { headline: 'Account' } },
  'md-fab-menu': { tag: 'md-fab-menu-item', properties: { label: 'Create', icon: 'add' }, children: [{ text: 'Create' }] },
  'md-menu-item-group': { tag: 'md-menu-item', properties: { headline: 'Account' } },
  'md-table-container': { tag: 'md-table', children: [{ tag: 'md-table-row', children: [{ tag: 'md-table-cell', children: [{ text: 'Cell content' }] }] }] },
  'md-table': { tag: 'md-table-body', children: [{ tag: 'md-table-row', properties: { value: 'project-1', selectable: true, clickable: true, expandable: true }, children: [{ tag: 'md-table-cell', children: [{ text: 'Project Atlas' }] }, { text: 'Project details', slot: 'expanded' }] }] },
  'md-table-head': { tag: 'md-table-row', children: [{ tag: 'md-table-cell', properties: { head: true }, children: [{ text: 'Name' }] }] },
  'md-table-body': { tag: 'md-table-row', children: [{ tag: 'md-table-cell', children: [{ text: 'Ada' }] }] },
  'md-table-foot': { tag: 'md-table-row', children: [{ tag: 'md-table-cell', children: [{ text: 'Total' }] }] },
  'md-table-row': { tag: 'md-table-cell', children: [{ text: 'Cell content' }] },
};

/** Plain-text overrides must not replace structural component children. */
export function nativeTextSlotSupported(component, name, platform) {
  if (!['swift', 'ios', 'android'].includes(platform)) return false;
  const normalized = name === '(default)' ? '' : name;
  const policy = component?.support?.[platform === 'swift' || platform === 'ios' ? 'ios' : 'android'];
  if (!policy || policy.status === 'missing-adapter' || !has(policy.slots, normalized) || has(policy.unsupportedSlots, normalized)) return false;
  const slots = component.slots ?? policy.slots.map(slot => typeof slot === 'string' ? { name: slot } : slot);
  return editableTextSlot({ ...component, tag: component.tag ?? component.tagName, slots }, normalized);
}

function sampleProperties(tag, policy) {
  const choices = {
    'md-button': { value: 'save', toggle: true },
    'md-card': { interactive: true },
    'md-chip': { label: 'Filter', selectable: true, removable: true },
    'md-list': { selectionMode: 'single-select' },
    'md-list-item': { headline: 'Details', expandable: true, expanded: true },
    'md-accordion-item': { headline: 'Details', expanded: true },
    'md-text-field': { label: 'Name', value: '' },
    'md-select': { label: 'Choice', options: [{ value: 'one', label: 'One' }, { value: 'two', label: 'Two' }], open: true },
    'md-multi-select': { label: 'Choices', options: [{ value: 'one', label: 'One' }, { value: 'two', label: 'Two' }], open: true },
    'md-autocomplete': { label: 'Search choices', options: [{ value: 'one', label: 'One' }, { value: 'two', label: 'Two' }], open: true },
    'md-number-field': { label: 'Quantity', value: 1 },
    'md-otp-field': { label: 'Verification code', value: '', length: 6 },
    'md-checkbox': { label: 'Accept', checked: false },
    'md-radio': { label: 'Option', value: 'one', checked: false },
    'md-switch': { selected: false, supportingText: 'Enable notifications' },
    'md-slider': { value: 25, min: 0, max: 100 },
    'md-dialog': { headline: 'Details', open: true },
    'md-snackbar': { message: 'Changes saved', open: true, closeable: true, autoHide: false },
    'md-icon-button': { icon: 'favorite', toggle: true, selected: false },
    'md-fab': { icon: 'add', label: 'New project', extended: true },
    'md-fab-menu-item': { icon: 'edit', label: 'Edit project' },
    'md-split-button': { icon: 'check', label: 'Publish', menuLabel: 'More actions', trailingToggle: true },
    'md-segmented-button': { label: 'Week', value: 'week', icon: 'calendar_month' },
    'md-select-option': { label: 'Design', value: 'design', supportingText: 'Design team' },
    'md-rating': { value: 3, max: 5, showValueLabel: true },
    'md-date-picker': { label: 'Start date', value: '2026-10-07', clearable: true },
    'md-time-picker': { label: 'Meeting time', value: '14:30' },
    'md-color-picker': { value: '#6750A4', showHex: true, presets: ['#6750A4', '#386A20', '#006A6A'] },
    'md-avatar': { name: 'Alex Morgan', size: 'lg' },
    'md-badge': { variant: 'large', value: '12' },
    'md-status-dot': { state: 'success', label: 'Available' },
    'md-skeleton': { lines: 3, variant: 'text', width: '240px' },
    'md-progress-indicator': { value: 0.65, max: 1, variant: 'linear', label: 'Upload progress' },
    'md-meter': { value: 65, max: 100, showLabel: true, showValue: true, label: 'Storage used' },
    'md-loading-indicator': { label: 'Loading workspace' },
    'md-app-bar': { headline: 'Workspace', subtitle: 'Your projects', leadingIcon: 'menu' },
    'md-navigation-tab': { label: 'Projects', icon: 'folder', active: true },
    'md-navigation-rail-tab': { label: 'Projects', icon: 'folder', value: 'projects', active: true },
    'md-tab': { label: 'Overview', active: true },
    'md-tab-panel': { active: true },
    'md-step': { label: 'Workspace', description: 'Choose a project name', active: true },
    'md-stepper': { active: 0, nav: true },
    'md-bottom-sheet': { headline: 'Project details', open: true },
    'md-side-sheet': { headline: 'Project details', open: true, showBack: true },
    'md-menu': { open: true, listLabel: 'Project actions' },
    'md-fab-menu': { open: true, menuLabel: 'Create' },
    'md-menu-item': { headline: 'Notifications', type: 'checkbox', supportingText: 'Project updates' },
    'md-sub-menu-item': { headline: 'Share' },
    'md-menu-item-group': { label: 'Workspace' },
    'md-tooltip': { text: 'Additional information', subhead: 'Details', variant: 'rich', open: true },
    'md-search': { placeholder: 'Search projects', value: '', open: true },
    'md-table': { caption: 'Projects', selection: 'multiple' },
    'md-table-row': { value: 'project-1', selectable: true, clickable: true, expandable: true },
    'md-table-toolbar': { headline: 'Projects', supportingText: 'Workspace projects' },
    'md-table-pagination': { count: 87, page: 0, rowsPerPage: 10, rowsPerPageOptions: [10, 20, 50], showFirstLast: true },
    'md-table-sort-label': { column: 'name', order: 'asc', defaultOrder: 'asc' },
    'md-table-expand-toggle': { buttonLabel: 'Expand project' },
    'md-transfer-list': { items: [{ value: 'design', label: 'Design' }, { value: 'engineering', label: 'Engineering' }, { value: 'research', label: 'Research' }], value: ['design'], searchable: true },
    'md-organization-chart': { selectionMode: 'multiple', nodes: [{ id: 'lead', name: 'Alex Morgan', title: 'Product lead', children: [{ id: 'design', name: 'Sam Lee', title: 'Design' }, { id: 'engineering', name: 'Robin Chen', title: 'Engineering' }] }], selectedIds: [] },
    'md-line-chart': { label: 'Weekly activity', showMarks: true, series: [{ id: 'design', name: 'Design', data: [12, 19, 15, 26] }, { id: 'engineering', name: 'Engineering', data: [8, 12, 18, 14] }] },
    'md-area-chart': { label: 'Weekly activity', showMarks: true, series: [{ id: 'design', name: 'Design', data: [12, 19, 15, 26] }] },
    'md-bar-chart': { label: 'Weekly activity', series: [{ id: 'design', name: 'Design', data: [12, 19, 15, 26] }, { id: 'engineering', name: 'Engineering', data: [8, 12, 18, 14] }] },
    'md-pie-chart': { label: 'Team distribution', innerRadius: '45%', data: [{ name: 'Design', value: 35 }, { name: 'Engineering', value: 45 }, { name: 'Research', value: 20 }] },
    'md-sparkline': { data: [4, 7, 5, 12, 9, 15], variant: 'area' },
  };
  const values = choices[tag] ?? (has(policy.properties, 'open') ? { open: true } : has(policy.properties, 'label') ? { label: 'Example' } : has(policy.properties, 'headline') ? { headline: 'Example' } : {});
  return Object.fromEntries(Object.entries(values).filter(([key]) => has(policy.properties, key)));
}

function sampleChildren(tag, policy) {
  const multiple = {
    'md-button-group': ['Day', 'Week', 'Month'].map(value => ({ tag: 'md-button', properties: { value: value.toLowerCase() }, children: [{ text: value }] })),
    'md-segmented-button-set': ['Day', 'Week', 'Month'].map(value => ({ tag: 'md-segmented-button', properties: { label: value, value: value.toLowerCase() }, children: [{ text: value }] })),
    'md-tabs': ['Overview', 'Details'].map(label => ({ tag: 'md-tab', properties: { label } })),
    'md-navigation-bar': ['Home', 'Projects'].map((label, index) => ({ tag: 'md-navigation-tab', properties: { label, icon: index ? 'folder' : 'home' } })),
    'md-navigation-rail': ['Home', 'Projects'].map((label, index) => ({ tag: 'md-navigation-rail-tab', properties: { label, icon: index ? 'folder' : 'home', value: label.toLowerCase() } })),
    'md-stepper': ['Account', 'Workspace', 'Review'].map(label => ({ tag: 'md-step', properties: { label }, children: [{ text: `Complete ${label.toLowerCase()} details.` }] })),
    'md-list': ['Design review', 'Prototype', 'Release'].map(headline => ({ tag: 'md-list-item', properties: { headline, supportingText: 'Project milestone' } })),
    'md-toolbar': ['edit', 'share', 'delete'].map(icon => ({ tag: 'md-icon-button', properties: { icon } })),
  };
  if (has(policy.slots, '') && multiple[tag]) return multiple[tag];
  if (has(policy.slots, '') && structuralChild[tag]) return [structuralChild[tag]];
  if (tag === 'md-sub-menu-item' && has(policy.slots, 'submenu')) return [{ tag: 'md-menu-item', properties: { headline: 'Copy link' }, slot: 'submenu' }];
  if (tag === 'md-search' && has(policy.slots, 'results')) return [{ tag: 'md-list-item', properties: { headline: 'Project Atlas' }, slot: 'results' }];
  if (tag === 'md-list-item' && has(policy.slots, 'expanded-content')) return [{ text: 'Additional information', slot: 'expanded-content' }];
  return has(policy.slots, '') ? [{ text: tag === 'md-button' ? 'Continue' : 'Example content' }] : [];
}

// Payloads below are verified against the native adapters, not inferred from
// TypeScript. String-array state remains JSON-compatible on both platforms.
function stateContract(tag, name, platform, policy) {
  let result;
  const assign = (property, type, field = null, initial) => ({ property, type, field, initial });
  if (['md-text-field', 'md-otp-field', 'md-select', 'md-autocomplete'].includes(tag) && ['mdInput', 'mdChange'].includes(name)) {
    if (tag === 'md-select' && name === 'mdInput') return null;
    result = assign(tag === 'md-autocomplete' && name === 'mdInput' ? 'inputValue' : 'value', 'String', null, '');
  }
  if (['md-number-field', 'md-slider'].includes(tag) && ['mdInput', 'mdChange'].includes(name)) result = assign('value', 'Double', 'value', tag === 'md-slider' ? 25 : 5);
  if (tag === 'md-rating' && name === 'mdChange') result = assign('value', 'Double', null, 3);
  if (['md-checkbox', 'md-radio'].includes(tag) && name === 'mdChange') result = assign('checked', 'Bool', 'checked', false);
  if (tag === 'md-switch' && ['mdInput', 'mdChange'].includes(name)) result = assign('selected', 'Bool', 'selected', false);
  if (tag === 'md-icon-button' && name === 'mdClick' || tag === 'md-chip' && name === 'mdSelect') result = assign('selected', 'Bool', 'selected', false);
  if (tag === 'md-accordion-item' && name === 'mdItemToggle' || tag === 'md-list-item' && name === 'mdExpand' || tag === 'md-table-row' && name === 'mdRowExpandedChange') result = assign('expanded', 'Bool', 'expanded', false);
  if (tag === 'md-table-row' && name === 'mdRowSelectionChange') result = assign('selected', 'Bool', 'selected', false);
  if (tag === 'md-tabs' && name === 'mdTabChange') result = assign('activeTabIndex', 'Int', 'index', 0);
  if (tag === 'md-navigation-bar' && name === 'mdChange' || tag === 'md-navigation-rail' && name === 'mdTabChange') result = assign('activeIndex', 'Int', 'index', 0);
  if (tag === 'md-stepper' && name === 'mdStepChange') result = assign('active', 'Int', 'index', 0);
  if (tag === 'md-table-pagination' && ['mdPageChange', 'mdRowsPerPageChange'].includes(name)) result = assign(name === 'mdPageChange' ? 'page' : 'rowsPerPage', 'Int', name === 'mdPageChange' ? 'page' : 'rowsPerPage', name === 'mdPageChange' ? 0 : 10);
  if (['md-multi-select', 'md-transfer-list'].includes(tag) && name === 'mdChange') result = assign('value', 'Strings', null, []);
  if (tag === 'md-organization-chart' && name === 'mdSelectionChange') result = assign('selectedIds', 'Strings', 'selectedIds', []);
  if (['md-date-picker', 'md-time-picker', 'md-color-picker', 'md-search'].includes(tag) && ['mdInput', 'mdChange', 'mdSelected', 'mdSearch', 'mdSubmit'].includes(name)) result = assign('value', 'String', 'value', tag === 'md-color-picker' ? '#6750A4' : '');
  return result && has(policy.properties, result.property) && has(policy.events, name) ? result : null;
}

function stateValue(type, expression, platform) {
  if (platform === 'android' || type === 'Value') return expression;
  return type === 'Int' ? `.number(Double(${expression}))` : type === 'Double' ? `.number(${expression})` : type === 'Strings' ? `.array(${expression}.map(AWCValue.string))` : `.${type === 'Bool' ? 'bool' : 'string'}(${expression})`;
}

function initialState(type, value, platform) {
  if (type === 'Strings') return platform === 'swift' ? `[${value.map(item => literal(item, platform)).join(', ')}]` : `listOf<String>(${value.map(item => literal(item, platform)).join(', ')})`;
  if (type === 'Value') return valueCode(value, platform);
  if (type === 'String') return literal(value, platform);
  return type === 'Double' && Number.isInteger(value) ? `${value}.0` : String(value);
}

function readState(contract, platform) {
  const { field, type } = contract;
  const payload = platform === 'swift' ? `event.detail${field ? `[${literal(field, platform)}]` : ''}` : field ? `(detail as? Map<*, *>)?.get(${literal(field, platform)})` : 'detail';
  if (platform === 'swift') return type === 'Strings' ? `${payload}.array.map(\\.string)` : type === 'Int' ? `Int(${payload}.number ?? Double(value))` : `${payload}.${type === 'Bool' ? 'bool' : type === 'Double' ? 'number' : 'string'}${type === 'String' ? '' : ' ?? value'}`;
  return type === 'Strings' ? `(${payload} as? List<*>)?.mapNotNull { it as? String } ?: value` : type === 'Double' || type === 'Int' ? `(${payload} as? Number)?.to${type}() ?: value` : `${payload} as? ${type === 'Bool' ? 'Boolean' : 'String'} ?: value`;
}

function controlledEvent(component, name, platform, policy, contract) {
  const properties = sampleProperties(component.tag, policy);
  delete properties[contract.property];
  const handler = platform === 'swift'
    ? `guard event.tag == ${literal(component.tag, platform)}, event.name == ${literal(name, platform)} else { return }\nvalue = ${readState(contract, platform)}\nlastPayload = event.detail.json`
    : `if (name == ${literal(name, platform)}) {\n    value = ${readState(contract, platform)}\n    lastPayload = detail?.toString() ?: "null"\n}`;
  const body = componentCode(component.tag, properties, platform, { children: sampleChildren(component.tag, policy), expressions: { [contract.property]: stateValue(contract.type, 'value', platform) }, handler });
  const initial = initialState(contract.type, contract.initial, platform);
  const state = platform === 'swift' ? `@State private var value: ${contract.type === 'Strings' ? '[String]' : contract.type} = ${initial}\n@State private var lastPayload = "Interact with the control."` : `var value by remember { mutableStateOf(${initial}) }\nvar lastPayload by remember { mutableStateOf("Interact with the control.") }`;
  return {
    description: `Update the supported ${contract.property} property from ${name} using ${contract.field ? `the native payload’s ${contract.field} field` : 'the native payload itself'}.`,
    code: platform === 'swift' ? swiftExample(`VStack {\n${indent(body)}\n    Text(lastPayload)\n}`, state) : androidExample(`Column {\n${indent(body)}\n    Text(lastPayload)\n}`, state),
    notes: [`The native ${contract.field ? `${contract.field} value` : 'detail'} is ${contract.type === 'Strings' ? 'an array of strings' : contract.type === 'Bool' ? 'a Boolean' : contract.type === 'String' ? 'a string' : 'a number'} for this configuration.`, 'Keep the application value in state and pass it back through the supported property. This API has no automatic two-way binding.', ...(component.tag === 'md-autocomplete' ? ['This example uses single selection; multiple mode changes the value payload to an array.'] : []), ...(component.tag === 'md-slider' ? ['This example uses one thumb. Range mode also exposes valueStart and valueEnd.'] : [])],
  };
}

function buttonEvent(name, platform) {
  if (name === 'mdChange') {
    const handler = platform === 'swift'
      ? 'guard event.name == "mdChange" else { return }\nselected = event.detail["selected"].bool ?? false\nlastValue = event.detail["value"].string'
      : 'if (name == "mdChange") {\n    val payload = detail as? Map<*, *>\n    selected = payload?.get("selected") as? Boolean ?: false\n    lastValue = payload?.get("value") as? String ?: ""\n}';
    const body = componentCode('md-button', { toggle: true, value: 'save' }, platform, {
      children: [{ text: 'Save' }], handler, expressions: { selected: platform === 'swift' ? '.bool(selected)' : 'selected' },
    });
    return {
      description: 'Store the committed selected state from mdChange in application state. This notification is emitted after a toggle commits.',
      code: platform === 'swift'
        ? swiftExample(`VStack {\n${indent(body)}\n    Text("Selected: \\(selected); value: \\(lastValue)")\n}`, '@State private var selected = false\n@State private var lastValue = ""')
        : androidExample(`Column {\n${indent(body)}\n    Text("Selected: $selected; value: $lastValue")\n}`, 'var selected by remember { mutableStateOf(false) }\nvar lastValue by remember { mutableStateOf("") }'),
      notes: ['The native payload contains selected (Boolean) and value. This example supplies a string value.', 'mdChange is not cancelable; veto activation synchronously in the mdClick native event scope.'],
    };
  }
  const component = componentCode('md-button', { toggle: true, value: 'save' }, platform, { children: [{ text: 'Save' }] });
  const body = platform === 'swift'
    ? `VStack {\n    Toggle("Allow activation", isOn: $allowActivation)\n    AWCEventScope(id: "save-actions", onEvent: { context in\n        guard context.event.name == "mdClick" else { return }\n        let detail = context.event.detail\n        let proposedSelected = detail["selected"].bool ?? false\n        let value = detail["value"].string\n        lastAction = "value: \\(value); proposed selected: \\(proposedSelected)"\n        // Native fields also include toggle, href and target.\n        if !allowActivation { context.preventDefault() }\n    }) {\n${indent(component, 8)}\n    }\n    Text(lastAction)\n}`
    : `Column {\n    Text("Allow activation")\n    Switch(checked = allowActivation, onCheckedChange = { allowActivation = it })\n    AWCActionScope(onAction = { event ->\n        if (event.name == "mdClick") {\n            val proposedSelected = event.detail["selected"] as? Boolean ?: false\n            val value = event.detail["value"] as? String ?: ""\n            lastAction = "value: $value; proposed selected: $proposedSelected"\n            // Native fields also include toggle, href and target.\n            if (!allowActivation) event.preventDefault()\n        }\n    }) {\n${indent(component, 8)}\n    }\n    Text(lastAction)\n}`;
  return {
    description: 'Inspect the proposed mdClick payload and optionally cancel activation before toggle, navigation or form effects run.',
    code: platform === 'swift'
      ? swiftExample(body, '@State private var allowActivation = true\n@State private var lastAction = "Activate Save to inspect mdClick."')
      : androidExample(body, 'var allowActivation by remember { mutableStateOf(true) }\nvar lastAction by remember { mutableStateOf("Activate Save to inspect mdClick.") }', ['androidx.compose.material3.Switch']),
    notes: ['selected is the proposed state, not a confirmation that the action committed.', 'preventDefault must run synchronously in this native event scope. The component onEvent callback is an observation callback, not a cancellation API.', 'Native event scopes have their own propagation model. No DOM originalEvent is fabricated.'],
  };
}

function eventExample(component, name, platform, policy) {
  if (component.tag === 'md-button' && ['mdClick', 'mdChange'].includes(name)) return buttonEvent(name, platform);
  const contract = stateContract(component.tag, name, platform, policy);
  if (contract) return controlledEvent(component, name, platform, policy, contract);
  const handler = platform === 'swift'
    ? `guard event.name == ${literal(name, platform)} else { return }\nlastPayload = event.detail.json`
    : `if (name == ${literal(name, platform)}) {\n    lastPayload = detail?.toString() ?: "null"\n}`;
  const children = sampleChildren(component.tag, policy);
  const body = componentCode(component.tag, sampleProperties(component.tag, policy), platform, { handler, children });
  return {
    description: `Handle only ${name} and display its native payload in application state.`,
    code: platform === 'swift'
      ? swiftExample(`VStack {\n${indent(body)}\n    Text(lastPayload)\n}`, '@State private var lastPayload = "No event received yet."')
      : androidExample(`Column {\n${indent(body)}\n    Text(lastPayload)\n}`, 'var lastPayload by remember { mutableStateOf("No event received yet.") }'),
    notes: [nativePayloadNote(component.tag, name, platform), 'The callback exposes native JSON-shaped data. Its payload can differ from the source TypeScript event; this example displays the complete native value without inventing fields.', 'Add the component data and child content required by your application to exercise every event path.'].filter(Boolean),
  };
}

function nativePayloadNote(tag, name, platform) {
  if (['md-line-chart', 'md-area-chart', 'md-bar-chart', 'md-pie-chart', 'md-sparkline'].includes(tag)) {
    if (name === 'mdReady') return 'The native ready notification has no payload. It describes the native view lifecycle, not a web chart-engine instance.';
    if (name === 'mdLegendClick') return 'The native legend payload identifies the affected series or slice and its selected state. Native chart interactions do not expose a web chart-engine event.';
    return platform === 'swift' ? 'Native point/slice clicks include dataIndex, seriesIndex, value and source series data; Cartesian charts also include seriesId. No DOM pointer event is included.' : 'Native point/slice clicks include dataIndex, seriesIndex, value and label. The Android hit-testing payload differs from the web chart detail.';
  }
  if (tag === 'md-button-group' && name === 'mdSelectionChange') return 'The native payload contains values, added and removed arrays. Selection belongs to the group; use child value properties as stable identifiers.';
  if (tag === 'md-segmented-button-set' && name === 'mdChange') return 'The detail is the array of selected values, not an object with a value field.';
  if (tag === 'md-otp-field' && name === 'mdComplete') return 'The native payload contains value with the completed code. Keep verification and server requests in the host application.';
  if (tag === 'md-transfer-list' && name === 'mdMove') return 'The native payload contains direction, moved values and the resulting target array.';
  if (tag === 'md-organization-chart' && name === 'mdNodeToggle') return 'The native payload contains the affected node record and its expanded Boolean state.';
  if (tag === 'md-snackbar' && name === 'mdClose') return platform === 'swift' ? 'SwiftUI supplies a reason string in the close payload.' : 'Android emits null for mdClose; do not read a web-style reason field.';
  if (name === 'mdValidityChange') return 'The SwiftUI adapter reports valid, validationMessage and flags. This is its native validation result, not a DOM ValidityState object.';
  if (name === 'mdOpen' || name === 'mdClose' || name === 'mdCancel') return 'This native lifecycle notification has no detail payload unless a component-specific adapter note says otherwise. It does not return an awaitable close promise.';
  if (tag === 'md-list' && name === 'mdSelect') return 'Native list selection includes the changed index and selected state. Keep application selection synchronized from the adapter callback rather than querying DOM children.';
  return '';
}

function slotExample(component, name, platform, policy) {
  const tag = component.tag;
  let properties = sampleProperties(tag, policy);
  let child = name === '' && structuralChild[tag] ? structuralChild[tag] : { text: name ? `${name} content` : 'Example content' };
  if (tag === 'md-button') {
    properties = name === 'loader' ? { loading: true } : {};
    child = name === 'loader' ? { tag: 'md-loading-indicator' } : { text: name === 'leading-icon' ? '★' : name === 'trailing-icon' ? '→' : 'Continue' };
  }
  if (name === 'expanded-content' || name === 'expanded') properties = { ...properties, ...(has(policy.properties, 'expanded') ? { expanded: true } : {}), ...(has(policy.properties, 'expandable') ? { expandable: true } : {}) };
  if (name === 'selected-icon' && has(policy.properties, 'selected')) properties.selected = true;
  if (name === 'unselected-icon' && has(policy.properties, 'selected')) properties.selected = false;
  if (['loader', 'loading'].includes(name) && has(policy.properties, 'loading')) properties.loading = true;
  if (name === 'empty') {
    for (const property of ['series', 'data', 'nodes']) if (has(policy.properties, property)) properties[property] = [];
    if (has(policy.properties, 'empty')) properties.empty = true;
  }
  const children = name === '' && tag !== 'md-button' ? sampleChildren(tag, policy) : [{ ...child, ...(name ? { slot: name } : {}) }];
  if (tag === 'md-button' && name) children.unshift({ text: name === 'loader' ? 'Saving' : 'Continue' });
  const body = componentCode(tag, properties, platform, { children });
  return {
    description: `Supply ${name ? `“${name}”` : 'default'} content using ${platform === 'swift' ? 'AWCNode children' : 'the native Compose slot callback'}.`,
    code: platform === 'swift' ? swiftExample(body) : androidExample(body),
    notes: [platform === 'swift' ? 'AWCNode.slot assigns a child to a named location. Omit slot for default content.' : 'The content callback receives the requested slot name. The empty string identifies default content; compose content only for matching names.',
      ...(tag === 'md-button' ? [name === 'loader' ? 'loading must be true to display loader content; supplied content replaces the built-in loader.' : name ? 'Provided slot content replaces the corresponding icon-property fallback.' : 'Default children supply the visible button label.'] : ['Some content is visible only in the component’s open, expanded, loading or active state.'])],
  };
}

const appearanceForPart = {
  anchor: { containerColor: '#6750A4', labelColor: '#FFFFFF', cornerRadius: 12 },
  'state-layer': { stateLayerColor: '#6750A4', hoverOpacity: 0.08, focusOpacity: 0.12, pressedOpacity: 0.16 },
  icon: { iconColor: '#006A6A', iconSize: 24 },
  label: { labelColor: '#4F378B', fontSize: 16, fontWeight: 600, lineHeight: 24, letterSpacing: 0.2 },
  'trailing-icon': { trailingIconColor: '#006A6A', trailingIconSize: 24 },
  loading: { loadingColor: '#006A6A', loadingSize: 24 },
};

function appearanceExample(name, platform, policy) {
  const appearance = Object.fromEntries(Object.entries(appearanceForPart[name] ?? {}).filter(([key]) => has(policy.appearance?.fields, key)));
  if (!Object.keys(appearance).length) return null;
  const properties = name === 'loading' ? { loading: true } : name === 'icon' ? { icon: 'favorite' } : name === 'trailing-icon' ? { trailingIcon: 'arrow_forward' } : name === 'label' || name === 'state-layer' ? { variant: 'outlined' } : {};
  const body = componentCode('md-button', properties, platform, { children: [{ text: 'Continue' }] });
  const fields = Object.entries(appearance).map(([key, value]) => `${key}${platform === 'swift' ? ': ' : ' = '}${typeof value === 'string' ? literal(value, platform) : Number.isInteger(value) ? `${value}.0` : value}`).join(', ');
  return {
    status: 'native-equivalent',
    description: `Customize the native ${name === 'anchor' ? 'button surface' : name} visual using AWCButtonAppearance.`,
    code: platform === 'swift' ? swiftExample(`${body}\n.awcButtonAppearance(.init(${fields}))`) : androidExample(`AWCButtonAppearanceScope(appearance = AWCButtonAppearance(${fields})) {\n${indent(body)}\n}`),
    notes: ['CSS ::part() selectors remain Web-only. These fields are a native visual equivalent, not a CSS bridge.', 'Appearance fields inherit through the subtree and local valid values override inherited values. Colors use #RRGGBB.', platform === 'swift' ? 'Dimensions use native points.' : 'Dimensions use dp; typography uses sp.', ...(name === 'anchor' ? ['Native navigation uses the action/router API; there is no native HTML anchor element.'] : [])],
  };
}

function methodAlternative(tag, name, policy) {
  const openTags = ['md-dialog', 'md-fab-menu', 'md-side-sheet', 'md-menu', 'md-search', 'md-bottom-sheet', 'md-color-picker', 'md-snackbar', 'md-select', 'md-multi-select', 'md-autocomplete', 'md-date-picker', 'md-time-picker', 'md-tooltip'];
  if (openTags.includes(tag) && ['show', 'showMenu', 'close', 'closeMenu', 'hide'].includes(name) && has(policy.properties, 'open')) return { property: 'open', initial: !['show', 'showMenu'].includes(name), next: ['show', 'showMenu'].includes(name), type: 'Bool', description: 'Control visibility through the supported open property.' };
  if (tag === 'md-search' && name === 'toggle' && has(policy.properties, 'open')) return { property: 'open', initial: false, next: true, toggle: true, type: 'Bool', description: 'Toggle visibility through the supported open property.' };
  if (['md-list-item', 'md-table-row', 'md-accordion-item'].includes(tag) && ['expand', 'collapse', 'toggle'].includes(name) && has(policy.properties, 'expanded')) return { property: 'expanded', initial: name === 'collapse', next: name !== 'collapse', toggle: name === 'toggle', type: 'Bool', description: 'Control expansion through the supported expanded property.', properties: { expandable: true, headline: 'Details' } };
  if (tag === 'md-otp-field' && name === 'clear' && has(policy.properties, 'value')) return { property: 'value', initial: '123456', next: '', type: 'String', description: 'Clear the code by updating the supported value property.' };
  if (tag === 'md-date-picker' && name === 'clear' && has(policy.properties, 'value')) return { property: 'value', initial: '2026-10-07', next: '', type: 'String', description: 'Clear the selected date through the supported value property.' };
  if (['md-select', 'md-multi-select'].includes(tag) && name === 'reset' && has(policy.properties, 'value')) return { property: 'value', initial: tag === 'md-select' ? 'one' : ['one'], next: tag === 'md-select' ? '' : [], type: tag === 'md-select' ? 'String' : 'Strings', description: 'Clear the app-owned selected value; this does not emit the source reset method’s notification.' };
  if (['md-select', 'md-multi-select', 'md-autocomplete'].includes(tag) && name === 'loadOptions' && has(policy.properties, 'options')) return { property: 'options', initial: [{ value: 'one', label: 'One' }], next: [{ value: 'two', label: 'Two' }, { value: 'three', label: 'Three' }], type: 'Value', description: 'Replace the supported options array from application state. Source row factories and DOM virtualization APIs are not passed to native.' };
  if (tag === 'md-radio' && name === 'select' && has(policy.properties, 'checked')) return { property: 'checked', initial: false, next: true, type: 'Bool', description: 'Set checked in host state. The host is responsible for exclusive group selection and programmatic notification policy.' };
  if ((tag === 'md-tabs' && name === 'selectTab') || (tag === 'md-navigation-bar' && name === 'select')) {
    const property = tag === 'md-tabs' ? 'activeTabIndex' : 'activeIndex';
    if (has(policy.properties, property)) return { property, initial: 0, next: 1, type: 'Int', description: 'Select the second authored item through the supported zero-based active index property.' };
  }
  if (tag === 'md-stepper' && ['next', 'prev', 'goTo'].includes(name) && has(policy.properties, 'active')) return { property: 'active', initial: name === 'prev' ? 1 : 0, next: 1, expression: name === 'next' ? { swift: 'min(value + 1, 2)', android: '(value + 1).coerceAtMost(2)' } : name === 'prev' ? { swift: 'max(value - 1, 0)', android: '(value - 1).coerceAtLeast(0)' } : null, type: 'Int', description: 'Change the active index for these three authored steps. Native host state changes do not run the source imperative navigation/completion flow.' };
  if (tag === 'md-table-pagination' && ['goToPage', 'setRowsPerPage'].includes(name)) {
    const property = name === 'goToPage' ? 'page' : 'rowsPerPage';
    if (has(policy.properties, property)) return { property, initial: name === 'goToPage' ? 0 : 10, next: name === 'goToPage' ? 1 : 20, type: 'Int', description: name === 'goToPage' ? 'Set the zero-based page property within the range implied by count and rowsPerPage.' : 'Update rowsPerPage and reset page to zero in host state.', properties: { page: 0 } };
  }
  return null;
}

function declarativeExample(component, name, platform, policy, alternative) {
  const { property, initial, next, toggle, type } = alternative;
  const initialCode = initialState(type, initial, platform);
  const nextCode = alternative.expression?.[platform] ?? (toggle ? '!value' : initialState(type, next, platform));
  const properties = Object.fromEntries(Object.entries({ ...sampleProperties(component.tag, policy), ...alternative.properties }).filter(([key]) => has(policy.properties, key)));
  delete properties[property];
  const statements = [];
  const resetsPage = component.tag === 'md-table-pagination' && property === 'rowsPerPage';
  for (const event of policy.events ?? []) {
    const eventName = typeof event === 'string' ? event : event.name;
    const state = stateContract(component.tag, eventName, platform, policy);
    let expression;
    if (property === 'open' && ['mdOpen', 'mdClose'].includes(eventName)) expression = String(eventName === 'mdOpen');
    else if (property === 'open' && eventName === 'mdOpenChange') expression = platform === 'swift' ? 'event.detail["open"].bool ?? value' : '(detail as? Map<*, *>)?.get("open") as? Boolean ?: value';
    else if (state?.property === property && state.type === type) expression = readState(state, platform);
    if (expression) statements.push(platform === 'swift' ? `if event.tag == ${literal(component.tag, platform)}, event.name == ${literal(eventName, platform)} { value = ${expression} }` : `if (name == ${literal(eventName, platform)}) value = ${expression}`);
    if (resetsPage && eventName === 'mdPageChange') statements.push(platform === 'swift' ? 'if event.name == "mdPageChange" { page = Int(event.detail["page"].number ?? Double(page)) }' : 'if (name == "mdPageChange") page = ((detail as? Map<*, *>)?.get("page") as? Number)?.toInt() ?: page');
  }
  const children = property === 'expanded' && component.tag === 'md-table-row' ? [...sampleChildren(component.tag, policy), { text: 'Additional information', slot: 'expanded' }] : property === 'expanded' && component.tag === 'md-accordion-item' ? [{ text: 'Additional information' }] : sampleChildren(component.tag, policy);
  const body = componentCode(component.tag, properties, platform, { expressions: { [property]: stateValue(type, 'value', platform), ...(resetsPage ? { page: stateValue('Int', 'page', platform) } : {}) }, handler: statements.join('\n') || undefined, children });
  return {
    status: 'native-equivalent',
    description: `${name}() has no native method bridge. ${alternative.description}`,
    code: platform === 'swift'
      ? swiftExample(`VStack {\n    Button(${literal(`Apply ${name}`, platform)}) { value = ${nextCode}${resetsPage ? '; page = 0' : ''} }\n${indent(body)}\n}`, `@State private var value: ${type === 'Strings' ? '[String]' : type === 'Value' ? 'AWCValue' : type} = ${initialCode}${resetsPage ? '\n@State private var page = 0' : ''}`)
      : androidExample(`Column {\n    Button(onClick = { value = ${nextCode}${resetsPage ? '; page = 0' : ''} }) { Text(${literal(`Apply ${name}`, platform)}) }\n${indent(body)}\n}`, `var value by remember { mutableStateOf${type === 'Value' ? '<AWCValue>' : ''}(${initialCode}) }${resetsPage ? '\nvar page by remember { mutableStateOf(0) }' : ''}`, ['androidx.compose.material3.Button']),
    notes: ['This updates declarative native state. It does not invoke the source method or reproduce its promise, return value, validation flow or event lifecycle.', 'Keep host state synchronized with native change/close callbacks when the control can also change through user interaction.'],
  };
}

/** A meaningful native starting screen using this platform's supported subset. */
export function nativeUsageExample(component = {}, platform) {
  if (!['swift', 'android'].includes(platform)) throw new TypeError(`Unknown native API platform: ${platform}`);
  const tag = component.tag ?? component.tagName;
  if (typeof tag !== 'string' || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)+$/.test(tag)) throw new TypeError('A valid component tag is required.');
  component = { ...component, tag };
  const policy = component.support?.[platform === 'swift' ? 'ios' : 'android'];
  const result = { title: `${platform === 'swift' ? 'SwiftUI' : 'Compose'} component example`, description: '', code: null, language: platform === 'swift' ? 'swift' : 'kotlin', status: policy ? 'supported' : 'unknown', notes: [] };
  if (!policy || policy.status === 'missing-adapter') return { ...result, status: policy ? 'unsupported' : 'unknown', description: 'No verified native adapter policy is available for this component.' };
  const overlay = methodAlternative(tag, 'show', policy);
  if (overlay && !['md-select', 'md-multi-select', 'md-autocomplete', 'md-date-picker', 'md-time-picker', 'md-color-picker', 'md-search'].includes(tag)) return { ...result, ...declarativeExample(component, 'show', platform, policy, overlay), title: result.title };
  const preferred = {
    'md-text-field': 'mdInput', 'md-number-field': 'mdInput', 'md-otp-field': 'mdInput', 'md-slider': 'mdInput',
    'md-tabs': 'mdTabChange', 'md-navigation-rail': 'mdTabChange', 'md-stepper': 'mdStepChange',
    'md-accordion-item': 'mdItemToggle', 'md-list-item': 'mdExpand', 'md-chip': 'mdSelect',
    'md-organization-chart': 'mdSelectionChange', 'md-table-pagination': 'mdPageChange', 'md-table-row': 'mdRowSelectionChange',
    'md-line-chart': 'mdMarkerClick', 'md-area-chart': 'mdAreaClick', 'md-bar-chart': 'mdBarClick', 'md-pie-chart': 'mdSliceClick', 'md-sparkline': 'mdSparkClick',
  }[tag];
  const event = [preferred, 'mdChange', 'mdClick', ...(policy.events ?? []).map(value => typeof value === 'string' ? value : value.name)].find(name => name && has(policy.events, name));
  if (event) return { ...result, ...eventExample(component, event, platform, policy) };
  const body = componentCode(tag, sampleProperties(tag, policy), platform, { children: sampleChildren(tag, policy) });
  return { ...result, description: 'Render native content and sample data using the supported properties for this platform.', code: platform === 'swift' ? swiftExample(body) : androidExample(body), notes: ['Replace the sample content with application data. The generated property types may contain additional source fields that this native adapter does not implement.'] };
}

/** Shared color-token API; this does not claim a CSS-part-to-native mapping. */
export function nativeThemeExample(component = {}, platform) {
  const starter = nativeUsageExample(component, platform);
  if (!starter.code) return starter;
  const tag = component.tag ?? component.tagName;
  const policy = component.support[platform === 'swift' ? 'ios' : 'android'];
  const properties = sampleProperties(tag, policy);
  if (Object.hasOwn(properties, 'open')) properties.open = false;
  const body = componentCode(tag, properties, platform, { children: sampleChildren(tag, policy) });
  const tokens = { '--md-sys-color-primary': '#006A6A', '--md-sys-color-on-primary': '#FFFFFF', '--md-sys-color-surface-container': '#E8F5F2', '--md-sys-color-on-surface': '#173B36' };
  const swiftTokens = `[${Object.entries(tokens).map(([key, value]) => `${literal(key, platform)}: ${literal(value, platform)}`).join(', ')}]`;
  const kotlinTokens = `mapOf(${Object.entries(tokens).map(([key, value]) => `${literal(key, platform)} to ${literal(value, platform)}`).join(', ')})`;
  return {
    title: `${platform === 'swift' ? 'SwiftUI' : 'Compose'} theme colors`, language: starter.language, status: 'native-equivalent',
    description: 'Set validated system color roles for theme-aware native controls in this subtree.',
    code: platform === 'swift' ? swiftExample(`${body}\n.awcTheme(.generated(tokens: ${swiftTokens}))`) : androidExample(body).replace('AWCTheme {', `AWCTheme(tokenOverrides = ${kotlinTokens}) {`),
    notes: ['This is a native theme API, not a mapping of CSS parts or arbitrary CSS variables.', 'Only supported --md-sys-color-* roles with #RRGGBB values are accepted as overrides. Layout, typography, selector rules, CSS expressions and component-specific custom properties are not transported.', platform === 'swift' ? 'SwiftUI system controls can keep system-defined surfaces and metrics; use preferredColorScheme when choosing a fixed system appearance.' : 'Compose maps accepted roles into MaterialTheme. Individual controls may use different roles for selected, disabled and container states.', 'Use native layout/content APIs for dimensions and composition. Button also exposes its documented AWCButtonAppearance fields.'],
  };
}

/** Plain data for the Studio native API tabs; member accepts a name or record. */
export function nativeApiExample(component = {}, kind, member, platform) {
  if (!['swift', 'android'].includes(platform)) throw new TypeError(`Unknown native API platform: ${platform}`);
  if (!Object.hasOwn(collection, kind)) throw new TypeError(`Unknown native API kind: ${kind}`);
  const tag = component.tag ?? component.tagName;
  if (typeof tag !== 'string' || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)+$/.test(tag)) throw new TypeError('A valid component tag is required.');
  component = { ...component, tag };
  const name = (typeof member === 'string' ? member : member?.name) ?? '';
  const normalizedName = kind === 'slot' && name === '(default)' ? '' : name;
  const nativePlatform = platform === 'swift' ? 'ios' : 'android';
  const policy = component.support?.[nativePlatform] ?? {};
  const doc = memberDocumentation(component, kind, typeof member === 'string' ? normalizedName : { ...member, name: normalizedName }, nativePlatform);
  const target = platform === 'swift' ? 'SwiftUI' : 'Compose';
  const result = {
    title: `${target}: ${normalizedName || 'default slot'}${kind === 'method' ? '()' : ''}`,
    description: doc.support.description,
    code: null,
    language: platform === 'swift' ? 'swift' : 'kotlin',
    status: doc.support.status,
    notes: [],
  };
  if (policy.status === 'missing-adapter') return { ...result, status: 'unsupported', description: `No ${target} adapter is available for ${tag}.` };
  if (kind === 'method') {
    const alternative = methodAlternative(tag, normalizedName, policy);
    if (alternative) return { ...result, ...declarativeExample(component, normalizedName, platform, policy, alternative) };
    return { ...result, status: 'unsupported', description: `${normalizedName}() has no public ${target} method bridge.`, notes: ['The source JavaScript method and return type are Web-only. No callable native equivalent is documented for this operation.', 'Use supported native properties and host application APIs; do not call HTMLElement methods on the native component.'] };
  }
  if (kind === 'cssPart') {
    const example = tag === 'md-button' && doc.support.status === 'native-equivalent' ? appearanceExample(normalizedName, platform, policy) : null;
    if (example) return { ...result, ...example };
    const theme = nativeThemeExample(component, platform);
    return { ...result, code: theme.code, description: `The ${normalizedName} CSS part is a Web styling hook. ${theme.code ? 'The example customizes the surrounding native theme; it does not target this part.' : `No copyable ${target} appearance API is declared for this part.`}`, notes: ['Native views do not support CSS selectors or ::part().', ...(theme.code ? theme.notes : [])] };
  }
  if (doc.support.status !== 'supported') return { ...result, description: `${normalizedName || 'Default slot'} is ${doc.support.status === 'unsupported' ? 'not implemented' : 'not declared as supported'} by the ${target} adapter.`, notes: ['No native usage code is supplied for an unavailable or unverified member.'] };
  return { ...result, ...(kind === 'event' ? eventExample(component, normalizedName, platform, policy) : slotExample(component, normalizedName, platform, policy)) };
}
