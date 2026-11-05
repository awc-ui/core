import { nativeToolbarMethod } from './toolbar-appearance.js';
import { nativeStepperMethod } from './stepper-appearance.js';
import { nativeSrMethod } from './sr-appearance.js';
import { nativeTableMethod } from './table-appearance.js';
import { nativeChartMethod } from './chart-appearance.js';
import { nativeSelectionMethod } from './native-methods.js';
import { PICKER_ITEM_METHODS, PICKER_VALIDITY_METHODS } from './picker-appearance.js';
// Copyable examples of the public native adapters. Source TypeScript signatures
// are never treated as native methods or as native payload declarations.
import { memberDocumentation } from './documentation.js';
import { editableTextSlot } from './content-slots.js';
import { componentAppearance } from './component-appearance.js';
import { supportsRetainedPropertyUpdates } from './native-property-updates.js';
import { parseCornerShape, cornerShapeNativeValue } from './corner-shape.js';
import { partCase } from './modal-appearance.js';

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
  if (body.includes('AWCModalScope(Modifier.fillMaxSize())')) imports = [...new Set([...imports, 'androidx.compose.ui.Modifier', 'androidx.compose.foundation.layout.fillMaxSize'])];
  return `import androidx.compose.runtime.*\nimport androidx.compose.foundation.layout.Column\nimport androidx.compose.material3.Text\n${imports.map(name => `import ${name}\n`).join('')}import dev.awc.nativeui.*\n\n// Add the :native-ui Gradle module to your app.\n@Composable\nfun NativeAPIExample() {\n${state ? indent(state) + '\n' : ''}    AWCTheme {\n${indent(body, 8)}\n    }\n}`;
}

const meterImports = ['androidx.compose.foundation.layout.Box', 'androidx.compose.foundation.layout.requiredWidth', 'androidx.compose.ui.Modifier', 'androidx.compose.ui.Alignment', 'androidx.compose.ui.unit.dp'];
function meterContext(body, platform) {
  return platform === 'swift' ? `${body}\n.frame(width: 300)`
    : `Box(modifier = Modifier.requiredWidth(300.dp), contentAlignment = Alignment.Center) {\n${indent(body)}\n}`;
}

const skeletonImports = ['androidx.compose.foundation.layout.Box', 'androidx.compose.foundation.layout.requiredSize', 'androidx.compose.ui.Modifier', 'androidx.compose.ui.Alignment', 'androidx.compose.ui.unit.dp'];
function skeletonContext(body, platform) {
  return platform === 'swift' ? `${body}\n.frame(width: 260, height: 160, alignment: .topLeading)\n.awcSkeletonSizingContext(.init(parentHeight: 160))`
    : `AWCSkeletonSizingContextScope(AWCSkeletonSizingContext(parentHeight = 160.0)) {\n    Box(modifier = Modifier.requiredSize(260.dp, 160.dp), contentAlignment = Alignment.TopStart) {\n${indent(body, 8)}\n    }\n}`;
}

function componentCode(tag, properties, platform, { children = [], handler, expressions = {}, unscoped = false } = {}) {
  // Dialogs and sheets present inside an AWCModalScope (outside one they keep the platform presentation).
  if (!unscoped && Object.hasOwn(modalTypes, tag)) return modalScope(componentCode(tag, properties, platform, { children, handler, expressions, unscoped: true }), platform);
  if (platform === 'swift') {
    const node = (child, index, parent = 'example') => child.symbol !== undefined
      ? `.symbol(${literal(child.symbol, platform)}${child.slot ? `, slot: ${literal(child.slot, platform)}` : ''})`
      : child.text !== undefined
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
  const contents = [...groups].map(([name, nodes]) => `if (slot == ${literal(name, platform)}) {\n${indent(nodes.map(child => child.symbol !== undefined ? `AWCMaterialSymbol(${literal(child.symbol, platform)})` : child.text !== undefined ? `${tag === 'md-segmented-button' || tag === 'md-fab-menu-item' && !name ? 'AWCSlotText' : 'Text'}(${literal(child.text, platform)})` : componentCode(child.tag, child.properties ?? {}, platform, { children: child.children ?? [] })).join('\n'))}\n}`);
  return `AWCComponent(\n    tag = ${literal(tag, platform)},\n    properties = ${propertiesCode(properties, platform, expressions)},${handler ? `\n    onEvent = { name, detail ->\n${indent(handler, 8)}\n    },` : ''}\n)${contents.length ? ` { slot ->\n${indent(contents.join('\n'))}\n}` : ''}`;
}

const badgeImports = ['dev.awc.nativeui.AWCIconButtonAppearance', 'dev.awc.nativeui.AWCIconButtonAppearanceScope', 'androidx.compose.foundation.layout.requiredSize', 'androidx.compose.ui.Modifier', 'androidx.compose.ui.unit.dp'];
function badgeContext(body, platform) {
  const parent = componentCode('md-icon-button', { icon: 'notifications', size: 'md', 'aria-label': 'Notifications' }, platform);
  return platform === 'swift' ? `${parent}\n.awcIconButtonAppearance(.init(width: 48, height: 48))\n.frame(width: 48, height: 48)\n.awcBadgeOverlay {\n${indent(body)}\n}` : `AWCBadgeHost(modifier = Modifier.requiredSize(48.dp, 48.dp), badge = {\n${indent(body)}\n}) {\n    AWCIconButtonAppearanceScope(AWCIconButtonAppearance(width = 48.0, height = 48.0)) {\n${indent(parent, 8)}\n    }\n}`;
}

export const statusDotContextImports = [...badgeImports, 'dev.awc.nativeui.AWCStatusDotHost', 'androidx.compose.foundation.layout.Row', 'androidx.compose.foundation.layout.Arrangement', 'androidx.compose.ui.Alignment'];
/** Keep the actual anchor control at48 units; inline content participates in flow. */
export function nativeStatusDotContext(body, platform, { inline = false, parent } = {}) {
  parent ??= componentCode('md-icon-button', { icon: 'notifications', size: 'md', 'aria-label': 'Notifications' }, platform);
  if (platform === 'swift') {
    const anchor = `${parent}\n.awcIconButtonAppearance(.init(width: 48, height: 48))\n.frame(width: 48, height: 48)`;
    return inline ? `HStack(alignment: .center, spacing: 12) {\n${indent(anchor)}\n${indent(body)}\n}` : `${anchor}\n.awcStatusDotOverlay {\n${indent(body)}\n}`;
  }
  const anchor = `AWCIconButtonAppearanceScope(AWCIconButtonAppearance(width = 48.0, height = 48.0)) {\n${indent(parent)}\n}`;
  return inline ? `Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {\n${indent(anchor)}\n${indent(body)}\n}` : `AWCStatusDotHost(modifier = Modifier.requiredSize(48.dp, 48.dp), dot = {\n${indent(body)}\n}) {\n${indent(anchor)}\n}`;
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
    'md-fab': { icon: 'add', label: 'Create' },
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
    'md-icon-button': { icon: 'favorite_border', selectedIcon: 'favorite', toggle: true, selected: false, 'aria-label': 'Save to favorites' },
    'md-fab': { icon: 'add', label: 'New project', extended: true },
    'md-fab-menu-item': { icon: 'edit', label: 'Edit project' },
    'md-split-button': { icon: 'add', label: 'Create project', size: 'md', menuLabel: 'More actions' },
    'md-segmented-button': { label: 'Week', value: 'week', icon: 'calendar_month' },
    'md-select-option': { label: 'Design', value: 'design', supportingText: 'Design team' },
    'md-rating': { value: 3, max: 5, showValueLabel: true },
    'md-date-picker': { label: 'Start date', value: '2026-10-07', clearable: true },
    'md-time-picker': { label: 'Meeting time', value: '14:30' },
    'md-color-picker': { value: '#6750A4', showHex: true, presets: ['#6750A4', '#386A20', '#006A6A'] },
    'md-avatar': { name: 'Alex Morgan', size: 'large' },
    'md-badge': { variant: 'large', value: '12' },
    'md-status-dot': { state: 'online', label: 'All systems operational' },
    'md-skeleton': { lines: 3, variant: 'text', animation: 'wave', fullWidth: true },
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
  return Object.fromEntries(Object.entries(values).filter(([key]) => has(policy.properties, key) || ['md-icon-button', 'md-fab'].includes(tag) && key === 'aria-label'));
}

function sampleChildren(tag, policy) {
  if (['md-icon-button', 'md-fab', 'md-split-button', 'md-avatar'].includes(tag)) return []; // Keep property content visible in event/theme examples.
  const multiple = {
    'md-button-group': ['Day', 'Week', 'Month'].map((value, index) => ({ tag: 'md-button', properties: { value: value.toLowerCase(), selected: index === 0 }, children: [{ text: value }] })),
    'md-segmented-button-set': ['Day', 'Week', 'Month'].map(value => ({ tag: 'md-segmented-button', properties: { label: value, value: value.toLowerCase() }, children: [{ text: value }] })),
    'md-tabs': ['Overview', 'Details'].map(label => ({ tag: 'md-tab', properties: { label } })),
    'md-navigation-bar': ['Home', 'Projects'].map((label, index) => ({ tag: 'md-navigation-tab', properties: { label, icon: index ? 'folder' : 'home' } })),
    'md-navigation-rail': ['Home', 'Projects'].map((label, index) => ({ tag: 'md-navigation-rail-tab', properties: { label, icon: index ? 'folder' : 'home', value: label.toLowerCase() } })),
    'md-stepper': ['Account', 'Workspace', 'Review'].map(label => ({ tag: 'md-step', properties: { label }, children: [{ text: `Complete ${label.toLowerCase()} details.` }] })),
    'md-list': ['Design review', 'Prototype', 'Release'].map(headline => ({ tag: 'md-list-item', properties: { headline, supportingText: 'Project milestone' } })),
    'md-toolbar': ['edit', 'share', 'delete'].map(icon => ({ tag: 'md-icon-button', properties: { icon } })),
    'md-accordion': accordionItems(),
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
  if (tag === 'md-split-button' && name === 'mdTrailingClick') result = assign('trailingChecked', 'Bool', 'checked', false);
  if (tag === 'md-rating' && name === 'mdChange') result = assign('value', 'Double', null, 3);
  if (['md-checkbox', 'md-radio'].includes(tag) && name === 'mdChange') result = assign('checked', 'Bool', 'checked', false);
  if (tag === 'md-switch' && ['mdInput', 'mdChange'].includes(name)) result = assign('selected', 'Bool', 'selected', false);
  if (tag === 'md-icon-button' && name === 'mdClick' || tag === 'md-chip' && name === 'mdSelect') result = assign('selected', 'Bool', 'selected', false);
  if (tag === 'md-segmented-button' && name === 'mdSegmentClick') result = assign('selected', 'Bool', 'selected', false);
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

function groupSelectionEvent(component, platform, policy) {
  const handler = platform === 'swift'
    ? 'guard event.tag == "md-button-group", event.name == "mdSelectionChange" else { return }\nvalues = event.detail["values"].array.map(\\.string)\nadded = event.detail["added"].array.map(\\.string)\nremoved = event.detail["removed"].array.map(\\.string)'
    : 'if (name == "mdSelectionChange") {\n    val payload = detail as? Map<*, *>\n    values = (payload?.get("values") as? List<*>)?.mapNotNull { it as? String } ?: emptyList()\n    added = (payload?.get("added") as? List<*>)?.mapNotNull { it as? String } ?: emptyList()\n    removed = (payload?.get("removed") as? List<*>)?.mapNotNull { it as? String } ?: emptyList()\n}';
  const body = componentCode(component.tag, { selectionMode: 'multi-select' }, platform, { handler, children: sampleChildren(component.tag, policy) });
  return {
    description: 'Observe committed child selection and read the selected values plus the values added and removed by this activation.',
    code: platform === 'swift'
      ? swiftExample(`VStack {\n${indent(body)}\n    Text("Selected: \\(values.joined(separator: ", "))")\n    Text("Added: \\(added.joined(separator: ", ")); removed: \\(removed.joined(separator: ", "))")\n}`, '@State private var values = ["day"]\n@State private var added: [String] = []\n@State private var removed: [String] = []')
      : androidExample(`Column {\n${indent(body)}\n    Text("Selected: \${values.joinToString()}")\n    Text("Added: \${added.joinToString()}; removed: \${removed.joinToString()}")\n}`, 'var values by remember { mutableStateOf(listOf("day")) }\nvar added by remember { mutableStateOf(emptyList<String>()) }\nvar removed by remember { mutableStateOf(emptyList<String>()) }'),
    notes: ['Selection is stored on the child buttons. The group applies its selectionMode and required rules before emitting this notification; cancellation cannot undo the committed selection.', 'Use unique child values when the application needs to identify a child from this payload. Duplicate and empty values are legal, but value arrays cannot identify individual children in that case.', 'Native payloads contain values, added and removed arrays. A DOM originalEvent is not fabricated.'],
  };
}

function fabActivationEvent(platform) {
  const component = componentCode('md-fab', { icon: 'add', label: 'Create' }, platform);
  const body = platform === 'swift'
    ? `VStack {\n    AWCEventScope(id: "create-actions", onEvent: { context in\n        guard context.event.tag == "md-fab", context.event.name == "mdClick" else { return }\n        lastSource = context.event.activation?.source.rawValue ?? "unknown"\n    }) {\n${indent(component, 8)}\n    }\n    Text("Activation source: \\(lastSource)")\n}`
    : `Column {\n    AWCActionScope(onAction = { event ->\n        if (event.tag == "md-fab" && event.name == "mdClick") {\n            lastSource = event.activation.source\n        }\n    }) {\n${indent(component, 8)}\n    }\n    Text("Activation source: $lastSource")\n}`;
  return {
    description: 'Observe FAB activation and read its native input source from the event envelope.',
    code: platform === 'swift' ? swiftExample(body, '@State private var lastSource = "No activation yet"')
      : androidExample(body, 'var lastSource by remember { mutableStateOf("No activation yet") }'),
    notes: ['The callback and preview transport use null detail. The native event scope exposes activation separately; Android’s map-based scoped detail is empty.', 'No DOM MouseEvent or selected state is fabricated. Disabled and soft-disabled FABs block activation.'],
  };
}

function progressCompletionEvent(platform) {
  const handler = platform === 'swift'
    ? 'guard event.name == "mdComplete" else { return }\nfinished = true'
    : 'if (name == "mdComplete") finished = true';
  let indicator = componentCode('md-progress-indicator', { value: 64, wave: true, label: 'Upload progress' }, platform, {
    handler, expressions: { complete: platform === 'swift' ? '.bool(complete)' : 'complete' },
  });
  indicator = platform === 'swift' ? `${indicator}\n.id(runID)` : `key(runID) {\n${indent(indicator)}\n}`;
  const body = platform === 'swift'
    ? `VStack {\n${indent(meterContext(indicator, platform))}\n    Button("Finish") { complete = true }.disabled(complete)\n    Button("Reset") { runID += 1; complete = false; finished = false }\n    Text(finished ? "Complete" : "In progress")\n}`
    : `Column {\n${indent(meterContext(indicator, platform))}\n    Button(onClick = { complete = true }, enabled = !complete) { Text("Finish") }\n    Button(onClick = { runID += 1; complete = false; finished = false }) { Text("Reset") }\n    Text(if (finished) "Complete" else "In progress")\n}`;
  return {
    description: 'Change complete on the mounted indicator and observe its actual completion notification.',
    code: platform === 'swift'
      ? swiftExample(body, '@State private var complete = false\n@State private var finished = false\n@State private var runID = 0')
      : androidExample(body, 'var complete by remember { mutableStateOf(false) }\nvar finished by remember { mutableStateOf(false) }\nvar runID by remember { mutableStateOf(0) }', [...meterImports, 'androidx.compose.material3.Button']),
    notes: ['mdComplete has null detail. It is emitted when the completion sequence finishes; setting value to max alone does not emit it.',
      'Initial complete=true does not trigger the source watcher. Change complete after mounting. Returning complete to false does not undo the terminal state; Reset deliberately creates a new indicator.'],
  };
}

// ---- Accordion: verified renderer APIs (viewport, controller, typed parts and hooks).
function accordionItems() {
  return [
    { tag: 'md-accordion-item', properties: { headline: 'A shared design language', supportingText: 'Built for every surface', expanded: true }, children: [{ text: 'Colors, spacing, shapes, and component contracts come from the same AWC source.' }] },
    { tag: 'md-accordion-item', properties: { headline: 'Native by design', supportingText: 'Platform-specific implementations' }, children: [{ text: 'Native views retain each platform’s own controls and behavior.' }] },
  ];
}
const accordionViewportImports = ['androidx.compose.ui.Modifier', 'androidx.compose.foundation.layout.fillMaxWidth', 'androidx.compose.foundation.layout.heightIn', 'androidx.compose.ui.unit.dp'];
/** A floating panel is placed in the nearest viewport (CSS position: fixed); give it a definite area. */
function accordionViewport(body, platform) {
  return platform === 'swift' ? `${body}\n.frame(maxWidth: .infinity, minHeight: 320, alignment: .topLeading)\n.awcAccordionViewport()`
    : `AWCAccordionViewport(modifier = Modifier.fillMaxWidth().heightIn(min = 320.dp)) {\n${indent(body)}\n}`;
}
const accordionPayloads = {
  mdToggle: 'The payload contains index, expanded and expandedIndices after exclusive and keep-one coordination.',
  mdReorder: 'The payload contains from, to and the resulting order of original indices.',
  mdDragStart: 'Drag payloads contain clientX, clientY, x, y, dx and dy in physical viewport coordinates.',
  mdDragMove: 'Drag payloads contain clientX, clientY, x, y, dx and dy in physical viewport coordinates.',
  mdDragEnd: 'mdDragEnd reports the terminal pointer delta and the last rendered panel position.',
  mdItemRequestFocus: 'The item reports direction and from; its owning accordion moves focus. The request bubbles to the parent.',
  mdItemRequestReorder: 'The item reports direction and from; a reorderable owning accordion moves it. The request bubbles to the parent.',
};
function accordionEventExample(name, platform) {
  const floating = /^mdDrag/.test(name), reorder = name === 'mdReorder' || name === 'mdItemRequestReorder';
  const properties = { ...(floating ? { floating: true, initialX: 24, initialY: 24 } : {}), ...(reorder ? { reorderable: true } : {}) };
  const handler = platform === 'swift'
    ? `guard event.name == ${literal(name, platform)} else { return }\nlastPayload = event.detail.json`
    : `if (name == ${literal(name, platform)}) {\n    lastPayload = detail?.toString() ?: "null"\n}`;
  let body;
  if (name.startsWith('mdItem') && platform === 'android') {
    // Compose delivers an item's own events to that item's callback.
    const items = accordionItems().map(item => componentCode('md-accordion-item', item.properties, platform, { children: item.children, handler })).join('\n');
    body = `AWCComponent(\n    tag = "md-accordion",\n    properties = ${reorder ? 'mapOf<String, AWCValue>("reorderable" to true)' : 'emptyMap()'},\n) { slot ->\n    if (slot == "") {\n${indent(items, 8)}\n    }\n}`;
  } else body = componentCode('md-accordion', properties, platform, { handler, children: accordionItems() });
  if (floating) body = accordionViewport(body, platform);
  return {
    description: `Handle only ${name} and display its native payload in application state.`,
    code: platform === 'swift'
      ? swiftExample(`VStack {\n${indent(body)}\n    Text(lastPayload)\n}`, '@State private var lastPayload = "No event received yet."')
      : androidExample(`Column {\n${indent(body)}\n    Text(lastPayload)\n}`, 'var lastPayload by remember { mutableStateOf("No event received yet.") }', floating ? accordionViewportImports : []),
    notes: [accordionPayloads[name], name.startsWith('mdItem') && platform === 'swift' ? 'Item events dispatched by the accordion’s own items reach the accordion view’s callback with event.tag "md-accordion-item".' : '', floating ? 'Drag the slim grip on the first item. Without awcAccordionViewport()/AWCAccordionViewport the window is the viewport.' : '',
      'Add the AWC native package; the callback receives native JSON-shaped data.'].filter(Boolean),
  };
}
function accordionMethodExample(name, platform) {
  const item = { headline: 'A shared design language', supportingText: 'Built for every surface' };
  const label = name === 'toggle' ? 'Toggle' : 'Focus header';
  const body = componentCode('md-accordion-item', item, platform, { children: [{ text: 'Colors, spacing, shapes, and component contracts come from the same AWC source.' }] });
  return {
    description: `Call ${name}() on the mounted native item through its controller.`,
    code: platform === 'swift'
      ? swiftExample(`VStack {\n    Button(${literal(label, platform)}) { controller.${name}() }\n${indent(body)}\n    .awcAccordionItemController(controller, for: "md-accordion-item")\n}`, 'private let controller = AWCAccordionItemController()')
      : androidExample(`Column {\n    Button(onClick = { controller.${name}() }) { Text(${literal(label, platform)}) }\n    AWCAccordionItemControllerScope(controller) {\n${indent(body, 8)}\n    }\n}`, 'val controller = remember { AWCAccordionItemController() }', ['androidx.compose.material3.Button']),
    notes: [name === 'toggle' ? 'toggle() respects disabled and a non-collapsible open item, like the source method, and emits mdItemToggle.' : 'focusHeader() moves keyboard focus to the header with a visible focus indicator; a disabled item is not focused.',
      platform === 'swift' ? 'The controller addresses the item whose node id matches; AWCNativeView(tag:) uses the tag as its id.' : 'The controller attaches to the md-accordion-item composed directly inside the scope.'],
  };
}
const accordionPartValues = {
  heading: { margin: { top: 4, right: 0, bottom: 4, left: 0 } },
  header: { backgroundColor: '#E8DEF8', minHeight: 64 },
  'state-layer': { backgroundColor: '#6750A4', opacity: 0.12 },
  'drag-handle': { color: '#6750A4' },
  'leading-icon': { color: '#006A6A' },
  headline: { color: '#4F378B', fontSize: 18, fontWeight: 600 },
  'supporting-text': { color: '#625B71', fontSize: 13 },
  'trailing-icon': { color: '#006A6A' },
  panel: { backgroundColor: '#F3EDF7' },
  content: { backgroundColor: '#FFFFFF', cornerShape: parseCornerShape('12px') },
  'content-inner': { color: '#1D1B20', padding: { top: 16, right: 24, bottom: 16, left: 24 } },
};
const accordionPartOrder = ['color', 'backgroundColor', 'borderColor', 'borderWidth', 'cornerShape', 'padding', 'margin', 'width', 'height', 'minHeight', 'opacity', 'gap', 'fontSize', 'lineHeight', 'fontWeight', 'letterSpacing'];
function accordionPartExample(tag, name, platform) {
  const separator = platform === 'swift' ? ': ' : ' = ';
  const number = value => platform === 'android' ? (Number.isInteger(value) ? `${value}.0` : String(value)) : String(value);
  if (tag === 'md-accordion' || ['chassis-handle', 'chassis-handle-bar'].includes(name)) {
    // Parts without a typed part surface are styled through their appearance hooks.
    const placeholder = tag === 'md-accordion';
    const fields = placeholder ? `dropPlaceholderColor${separator}"#FFE08280", dropPlaceholderOutlineColor${separator}"#C62828", dropPlaceholderOutlineWidth${separator}${number(3)}`
      : `chassisHandleColor${separator}"#D81B60", chassisHandleBackgroundHover${separator}"#FFCDD2"`;
    const type = placeholder ? 'AWCAccordionAppearance' : 'AWCAccordionItemAppearance';
    let body = componentCode('md-accordion', placeholder ? { reorderable: true } : { floating: true, initialX: 24, initialY: 24 }, platform, { children: accordionItems() });
    body = platform === 'swift' ? `${body}\n.${placeholder ? 'awcAccordionAppearance' : 'awcAccordionItemAppearance'}(.init(${fields}))` : `${type}Scope(${type}(${fields})) {\n${indent(body)}\n}`;
    if (!placeholder) body = accordionViewport(body, platform);
    return {
      status: 'native-equivalent', description: `The ${name} part is rendered natively and styled through its typed appearance hooks.`,
      code: platform === 'swift' ? swiftExample(body) : androidExample(body, '', placeholder ? [] : accordionViewportImports),
      notes: [placeholder ? 'The placeholder appears while an item is dragged; outline width and opacity hooks also apply. Native views accept no ::part() declarations for it.' : 'The grip appears on the first item of a floating accordion. Native views accept no ::part() declarations for it.'],
    };
  }
  const values = accordionPartValues[name];
  if (!values) return null;
  const value = (key, item) => key === 'cornerShape' ? cornerShapeNativeValue(item, platform)
    : ['padding', 'margin'].includes(key) ? `AWCAccordionInsets(${['top', 'right', 'bottom', 'left'].map(edge => `${edge}${separator}${number(item[edge])}`).join(', ')})`
    : typeof item === 'string' ? literal(item, platform) : number(item);
  const fields = accordionPartOrder.filter(key => Object.hasOwn(values, key)).map(key => `${key}${separator}${value(key, values[key])}`).join(', ');
  const swiftCase = { 'state-layer': 'stateLayer', 'drag-handle': 'dragHandle', 'leading-icon': 'leadingIcon', 'trailing-icon': 'trailingIcon', 'supporting-text': 'supportingText', 'content-inner': 'contentInner' }[name] ?? name;
  const kotlinCase = swiftCase[0].toUpperCase() + swiftCase.slice(1);
  const properties = { headline: 'A shared design language', supportingText: 'Built for every surface', expanded: true, ...(name === 'leading-icon' ? { icon: 'palette' } : {}) };
  let body = componentCode('md-accordion-item', properties, platform, { children: [{ text: 'Colors, spacing, shapes, and component contracts come from the same AWC source.' }] });
  if (name === 'drag-handle') body = componentCode('md-accordion', { reorderable: true }, platform, { children: accordionItems() });
  body = platform === 'swift' ? `${body}\n.awcAccordionItemPartAppearance(.init(${fields}), part: .${swiftCase})`
    : `AWCAccordionItemPartAppearanceScope(AWCAccordionItemPart.${kotlinCase}, AWCAccordionPartAppearance(${fields})) {\n${indent(body)}\n}`;
  return {
    status: 'native-equivalent', description: `Style the actual ${name} part through its public typed native part appearance.`,
    code: platform === 'swift' ? swiftExample(body) : androidExample(body),
    notes: ['Native views do not interpret CSS ::part() selectors; the typed fields follow the source part box (physical edges in every direction).', name === 'drag-handle' ? 'The drag handle appears on items of a reorderable accordion.' : 'Part appearances cascade to every item in this subtree; pass an item id to target one item.'],
  };
}

// ---- List: verified renderer APIs (controllers, typed parts, events and hooks).
function listRows(extra = {}) {
  return [
    { tag: 'md-list-item', properties: { type: 'button', headline: 'Inbox', supportingText: '24 unread', leadingIcon: 'inbox', ...extra } },
    { tag: 'md-list-item', properties: { type: 'button', headline: 'Starred', leadingIcon: 'star', ...extra } },
    { tag: 'md-list-item', properties: { type: 'button', headline: 'Sent', leadingIcon: 'send', ...extra } },
  ];
}
const listPayloads = {
  mdSelect: 'The payload contains index, value, selected and item (the row’s native node id); panel rows add childIndex and expanded.',
  mdActivate: 'The payload contains index and item when roving focus moves to another row.',
  mdReorder: 'The payload contains from, to and order: the displayed rows mapped to their authored indices.',
  mdClick: 'The payload contains item (the row’s native node id). An expandable row emits mdExpand before mdClick.',
  mdExpand: 'The payload contains expanded, index, value and item.',
};
const listId = (tag, platform, properties) => platform === 'android' ? { id: tag, ...properties } : properties;
function listEventExample(tag, name, platform) {
  const handler = platform === 'swift'
    ? `guard event.name == ${literal(name, platform)} else { return }\nlastPayload = event.detail.json`
    : `if (name == ${literal(name, platform)}) {\n    lastPayload = detail?.toString() ?: "null"\n}`;
  let body;
  if (tag === 'md-list') {
    const properties = name === 'mdSelect' ? { selectionMode: 'single-select' } : name === 'mdReorder' ? { reorderable: true } : {};
    body = componentCode('md-list', properties, platform, { handler, children: listRows(name === 'mdSelect' ? { type: 'text' } : {}) });
  } else {
    const expand = name === 'mdExpand';
    body = componentCode('md-list-item', expand ? { headline: 'Folders', expandable: true } : { type: 'button', headline: 'Inbox' }, platform,
      { handler, children: expand ? [{ tag: 'md-list-item', slot: 'expanded-content', properties: { headline: 'Archive' } }] : [] });
  }
  return {
    description: `Handle only ${name} and display its native payload in application state.`,
    code: platform === 'swift'
      ? swiftExample(`VStack {\n${indent(body)}\n    Text(lastPayload)\n}`, '@State private var lastPayload = "No event received yet."')
      : androidExample(`Column {\n${indent(body)}\n    Text(lastPayload)\n}`, 'var lastPayload by remember { mutableStateOf("No event received yet.") }'),
    notes: [listPayloads[name], 'The callback exposes native JSON-shaped data; DOM item references become stable native node ids.'],
  };
}
const listMethodLabels = { activateNext: 'Next row', activatePrevious: 'Previous row', selectItem: 'Select the second row', getSelectedIndices: 'Read the selection',
  setFocus: 'Focus with a ring', focusItem: 'Focus', toggle: 'Toggle', expand: 'Expand', collapse: 'Collapse' };
function listMethodExample(tag, name, platform) {
  const list = tag === 'md-list', label = listMethodLabels[name];
  const call = { selectItem: 'controller.selectItem(1)', getSelectedIndices: platform === 'swift' ? 'selected = controller.getSelectedIndices()' : 'selected = controller.getSelectedIndices()',
    setFocus: platform === 'swift' ? 'controller.setFocus(focusVisible: true)' : 'controller.setFocus(focusVisible = true)' }[name] ?? `controller.${name}()`;
  const body = list
    ? componentCode('md-list', listId('md-list', platform, { selectionMode: 'single-select' }), platform, { children: listRows({ type: 'text' }) })
    : componentCode('md-list-item', listId('md-list-item', platform, { headline: 'Folders', expandable: true }), platform, { children: [{ tag: 'md-list-item', slot: 'expanded-content', properties: { headline: 'Archive' } }] });
  const type = list ? 'AWCListController' : 'AWCListItemController', read = name === 'getSelectedIndices';
  return {
    description: `Call ${name}() on the mounted native ${list ? 'list' : 'list item'} through its controller.`,
    code: platform === 'swift'
      ? swiftExample(`VStack {\n    Button(${literal(label, platform)}) { ${call} }\n${indent(body)}\n    .${list ? 'awcListController' : 'awcListItemController'}(controller, for: ${literal(tag, platform)})${read ? '\n    Text("Selected: \\(selected)")' : ''}\n}`,
        `private let controller = ${type}()${read ? '\n@State private var selected: [Int] = []' : ''}`)
      : androidExample(`Column {\n    Button(onClick = { ${call} }) { Text(${literal(label, platform)}) }\n    ${list ? 'AWCListControllerScope' : 'AWCListItemControllerScope'}(controller, ${literal(tag, platform)}) {\n${indent(body, 8)}\n    }${read ? '\n    Text("Selected: $selected")' : ''}\n}`,
        `val controller = remember { ${type}() }${read ? '\nvar selected by remember { mutableStateOf(listOf<Int>()) }' : ''}`, ['androidx.compose.material3.Button']),
    notes: [{ activateNext: 'Moves roving focus to the next row with a visible ring (wrapping) and emits mdActivate when the active row changes.',
      activatePrevious: 'Moves roving focus to the previous row with a visible ring (wrapping) and emits mdActivate when the active row changes.',
      selectItem: 'Selects the row at an index silently (no mdSelect), as the source method does.', getSelectedIndices: 'Returns the selected row indices in display order.',
      setFocus: 'Focuses the row; focusVisible controls the focus ring.', focusItem: 'Focuses the row with a visible ring.',
      toggle: 'Toggles an expandable row without emitting mdExpand; a disabled row is not changed.', expand: 'Expands an expandable row without emitting mdExpand.',
      collapse: 'Collapses an expandable row without emitting mdExpand.' }[name],
      platform === 'swift' ? 'The controller addresses the node whose id matches; AWCNativeView(tag:) uses the tag as its id.' : 'The controller attaches to the component whose id property matches.'],
  };
}
const listPartValues = { row: { backgroundColor: '#F3EDF7' }, 'state-layer': { backgroundColor: '#6750A4', opacity: 0.12 }, primary: { backgroundColor: '#E8DEF8' },
  'expanded-panel': { backgroundColor: '#F3EDF7' }, 'expanded-panel-inner': { backgroundColor: '#FFFFFF' }, 'expand-button-state-layer': { backgroundColor: '#6750A4', opacity: 0.16 },
  'image-selection-indicator': { backgroundColor: '#00000052' }, 'image-selection-circle': { backgroundColor: '#6750A4' }, avatar: { backgroundColor: '#E8DEF8', cornerShape: parseCornerShape('12px') },
  image: { cornerShape: parseCornerShape('12px') }, 'image-wrap': { cornerShape: parseCornerShape('12px') }, trailing: { backgroundColor: '#E8DEF8' }, leading: { backgroundColor: '#E8DEF8' }, content: { backgroundColor: '#FFFFFF' } };
const listPartOrder = ['color', 'backgroundColor', 'borderColor', 'borderWidth', 'cornerShape', 'padding', 'margin', 'width', 'height', 'minHeight', 'opacity', 'gap', 'fontSize', 'lineHeight', 'fontWeight', 'letterSpacing'];
function listPartExample(tag, name, platform) {
  const separator = platform === 'swift' ? ': ' : ' = ';
  const number = value => platform === 'android' ? (Number.isInteger(value) ? `${value}.0` : String(value)) : String(value);
  const values = tag === 'md-list' ? { backgroundColor: '#FFE08280', borderColor: '#C62828', borderWidth: 3 } : (listPartValues[name] ?? { color: '#6750A4' });
  const value = (key, item) => key === 'cornerShape' ? cornerShapeNativeValue(item, platform) : typeof item === 'string' ? literal(item, platform) : number(item);
  const fields = listPartOrder.filter(key => Object.hasOwn(values, key)).map(key => `${key}${separator}${value(key, values[key])}`).join(', ');
  let body;
  if (tag === 'md-list' || name === 'drag-handle') body = componentCode('md-list', { reorderable: true }, platform, { children: listRows() });
  else {
    const properties = { type: 'button', headline: 'Inbox', overline: 'Mail', supportingText: '24 unread', trailingSupportingText: '24', leadingIcon: 'inbox', trailingIcon: 'chevron_right' };
    if (/^avatar/.test(name)) Object.assign(properties, { leadingIcon: '', leadingAvatarName: 'Ada Lovelace', ...(name === 'avatar-image' ? { leadingAvatar: 'https://example.com/ada.png', leadingAvatarAlt: 'Ada Lovelace' } : {}) });
    if (/^image/.test(name)) Object.assign(properties, { leadingIcon: '', leadingImage: 'https://example.com/photo.jpg', leadingImageAlt: 'Photo', selected: true });
    const expand = /^expand/.test(name);
    if (expand) Object.assign(properties, { type: 'text', expandable: true, expanded: true, trailingIcon: '' });
    body = componentCode('md-list-item', properties, platform, { children: expand ? [{ tag: 'md-list-item', slot: 'expanded-content', properties: { headline: 'Archive' } }] : [] });
  }
  const swiftCase = name.replace(/-([a-z])/g, (_, c) => c.toUpperCase()), kotlinCase = swiftCase[0].toUpperCase() + swiftCase.slice(1);
  body = tag === 'md-list'
    ? (platform === 'swift' ? `${body}\n.awcListPlaceholderPartAppearance(.init(${fields}))` : `AWCListPlaceholderPartAppearanceScope(AWCAccordionPartAppearance(${fields})) {\n${indent(body)}\n}`)
    : (platform === 'swift' ? `${body}\n.awcListItemPartAppearance(.init(${fields}), part: .${swiftCase})` : `AWCListItemPartAppearanceScope(AWCListItemPart.${kotlinCase}, AWCAccordionPartAppearance(${fields})) {\n${indent(body)}\n}`);
  return {
    status: 'native-equivalent', description: `Style the actual ${name} part through its public typed native part appearance.`,
    code: platform === 'swift' ? swiftExample(body) : androidExample(body),
    notes: ['Native views do not interpret CSS ::part() selectors; the typed fields follow the source part box.', tag === 'md-list' ? 'The placeholder appears while a row is dragged in a reorderable list.' : 'Part appearances cascade to every row in this subtree.'],
  };
}

// ---- Modal family (md-dialog, md-bottom-sheet, md-side-sheet): AWCModalScope, controllers, typed parts, events.
const modalTypes = { 'md-dialog': 'Dialog', 'md-bottom-sheet': 'BottomSheet', 'md-side-sheet': 'SideSheet' };
const modalScopeNote = 'The component presents in the nearest AWCModalScope (the app’s own viewport: scrim, owner stack, inert content, focus and Escape/back routing); outside a scope it keeps the previous platform presentation.';
/** Native modal components present inside an AWCModalScope placed at the content root. */
function modalScope(body, platform) {
  return platform === 'swift' ? `AWCModalScope {\n${indent(body)}\n}` : `AWCModalScope(Modifier.fillMaxSize()) {\n${indent(body)}\n}`;
}
const modalPayloads = {
  mdOpen: 'Emitted whenever the open state becomes true (the open property, show() or an initially open component); the payload is null.',
  mdClose: 'Emitted whenever the open state becomes false; after a user dismissal it follows mdCancel in the same update. The payload is null.',
  mdCancel: 'Emitted for a user dismissal (Escape or back, an enabled scrim, a close control or, on a bottom sheet, a drag released beyond the threshold) immediately before mdClose; close() and the open property emit mdClose only. The payload is null.',
  mdBack: 'Emitted when the back control (showBack) is activated; the payload is null.',
};
function modalSample(tag, policy, extra = {}) {
  return { ...sampleProperties(tag, policy), ...(tag === 'md-side-sheet' ? { variant: 'modal' } : {}), ...extra };
}
function modalEventExample(tag, name, platform, policy) {
  const handler = platform === 'swift'
    ? `guard event.name == ${literal(name, platform)} else { return }\nlastPayload = "\\(event.name): \\(event.detail.json)"`
    : `if (name == ${literal(name, platform)}) {\n    lastPayload = name + ": " + (detail?.toString() ?: "null")\n}`;
  const body = componentCode(tag, modalSample(tag, policy, name === 'mdBack' ? { showBack: true } : {}), platform, { handler, children: sampleChildren(tag, policy) });
  return {
    description: `Handle only ${name} and display it in application state.`,
    code: platform === 'swift'
      ? swiftExample(`VStack {\n    Text(lastPayload)\n${indent(body)}\n}`, '@State private var lastPayload = "No event received yet."')
      : androidExample(`Column {\n    Text(lastPayload)\n${indent(body)}\n}`, 'var lastPayload by remember { mutableStateOf("No event received yet.") }'),
    notes: [modalPayloads[name], modalScopeNote],
  };
}
const modalMethodNotes = {
  show: 'Opens the mounted component (mdOpen), exactly like setting open; the call returns immediately.',
  close: 'Closes the mounted component (mdClose without mdCancel), exactly like clearing open.',
  whenClosed: 'Suspends until the current open cycle has ended and the exit motion has finished (immediately under reduced motion).',
};
function modalMethodExample(tag, name, platform, policy) {
  const type = `AWC${modalTypes[tag]}Controller`;
  const swiftCall = name === 'whenClosed' ? 'controller.close()\nTask {\n    await controller.whenClosed()\n    status = "Closed after the exit motion"\n}' : `controller.${name}()`;
  const kotlinCall = name === 'whenClosed' ? 'controller.close()\nscope.launch {\n    controller.whenClosed()\n    status = "Closed after the exit motion"\n}' : `controller.${name}()`;
  const label = { show: 'Show', close: 'Close', whenClosed: 'Close and wait' }[name];
  const body = componentCode(tag, modalSample(tag, policy, { open: name !== 'show' }), platform, { children: sampleChildren(tag, policy) });
  const wait = name === 'whenClosed';
  return {
    description: `Call ${name}() on the mounted native ${modalTypes[tag].replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()} through its controller.`,
    code: platform === 'swift'
      ? swiftExample(`VStack {\n    Button(${literal(label, platform)}) {\n${indent(swiftCall, 8)}\n    }${wait ? '\n    Text(status)' : ''}\n${indent(body)}\n    .awc${modalTypes[tag]}Controller(controller, for: ${literal(tag, platform)})\n}`,
        `private let controller = ${type}()${wait ? '\n@State private var status = "Open"' : ''}`)
      : androidExample(`Column {\n    Button(onClick = {\n${indent(kotlinCall, 8)}\n    }) { Text(${literal(label, platform)}) }${wait ? '\n    Text(status)' : ''}\n    AWC${modalTypes[tag]}ControllerScope(controller) {\n${indent(body, 8)}\n    }\n}`,
        `val controller = remember { ${type}() }${wait ? '\nval scope = rememberCoroutineScope()\nvar status by remember { mutableStateOf("Open") }' : ''}`, ['androidx.compose.material3.Button', ...(wait ? ['kotlinx.coroutines.launch'] : [])]),
    notes: [modalMethodNotes[name], platform === 'swift' ? 'The controller addresses the component whose id matches; AWCNativeView(tag:) uses the tag as its id.' : 'The controller binds to the component rendered directly inside its scope.'],
  };
}
const modalPartValues = {
  scrim: { background: '#00000066' }, container: { background: '#F7F2FA', outlineColor: '#6750A4', outlineWidth: 2 }, header: { background: '#EADDFF' },
  icon: { color: '#6750A4' }, headline: { color: '#21005D', letterSpacing: 0.5 }, content: { color: '#49454F' }, divider: { background: '#6750A4', height: 2 },
  'divider-top': { background: '#6750A4', height: 2 }, 'divider-bottom': { background: '#6750A4', height: 2 }, actions: { background: '#F3EDF7' },
  'cancel-button': { color: '#B3261E' }, 'ok-button': { color: '#FFFFFF', background: '#6750A4' }, 'close-button': { color: '#6750A4' }, close: { color: '#6750A4' },
  'drag-handle': { background: '#F3EDF7' }, 'drag-handle-indicator': { background: '#6750A4', opacity: 0.8 },
};
const modalPartOrder = ['background', 'color', 'outlineColor', 'outlineWidth', 'letterSpacing', 'underline', 'height', 'opacity'];
function modalPartExample(tag, name, platform, policy) {
  const separator = platform === 'swift' ? ': ' : ' = ';
  const number = value => platform === 'android' ? (Number.isInteger(value) ? `${value}.0` : String(value)) : String(value);
  const values = modalPartValues[name] ?? { color: '#6750A4' };
  const fields = modalPartOrder.filter(key => Object.hasOwn(values, key)).map(key => `${key}${separator}${typeof values[key] === 'string' ? literal(values[key], platform) : typeof values[key] === 'boolean' ? values[key] : number(values[key])}`).join(', ');
  const extra = { ...(tag === 'md-dialog' && ['close-button', 'divider'].includes(name) ? { fullscreen: name === 'close-button', headerDivider: name === 'divider', divider: name === 'divider' } : {}),
    ...(tag === 'md-dialog' && name === 'icon' ? { icon: 'info' } : {}), ...(tag !== 'md-dialog' && name === 'close' ? { closeable: true } : {}),
    ...(['divider-top', 'divider-bottom'].includes(name) ? { [name === 'divider-top' ? 'topDivider' : 'bottomDivider']: true } : {}) };
  const body = componentCode(tag, modalSample(tag, policy, extra), platform, { children: sampleChildren(tag, policy) });
  const swiftCase = partCase(name, 'swift'), kotlinCase = partCase(name, 'android'), type = modalTypes[tag];
  const code = platform === 'swift'
    ? `${body}\n.awc${type}PartAppearance(AWCModalPartAppearance(${fields}), part: .${swiftCase})`
    : `AWC${type}PartAppearanceScope(AWC${type}Part.${kotlinCase}, AWCModalPartAppearance(${fields})) {\n${indent(body)}\n}`;
  return {
    status: 'native-equivalent', description: `Style the actual ${name} part through its public typed native part appearance.`,
    code: platform === 'swift' ? swiftExample(code) : androidExample(code),
    notes: ['Native views do not interpret CSS ::part() selectors; the typed fields (background, color, outline, letter spacing, underline, height, opacity) follow the source part box.', 'Pass an id to style one component only; without it the part style applies to every matching component in the subtree.'],
  };
}

// ---- Avatar: verified renderer APIs (image events, typed parts, the fallback slot).
const avatarImage = 'https://example.com/avatars/alex-morgan.png';
const avatarPayloads = {
  mdLoad: 'mdLoad reports { src } once the image has been decoded (data:, file: and http(s) sources). Changing crossorigin while an image is shown requests it again, as Chrome does, and reports mdLoad again.',
  mdError: 'mdError reports { src } when the image cannot be loaded or decoded. The avatar then falls back to initials, the default slot or the person icon; a failed src stays failed until src changes.',
};
function avatarEventExample(name, platform) {
  const handler = platform === 'swift'
    ? `guard event.name == ${literal(name, platform)} else { return }\nlastPayload = event.detail.json`
    : `if (name == ${literal(name, platform)}) {\n    lastPayload = detail?.toString() ?: "null"\n}`;
  const body = componentCode('md-avatar', { src: avatarImage, name: 'Alex Morgan', alt: 'Alex Morgan', size: 'large' }, platform, { handler });
  return {
    description: `Handle ${name} from an image avatar and display its native payload in application state.`,
    code: platform === 'swift'
      ? swiftExample(`VStack {\n${indent(body)}\n    Text(lastPayload)\n}`, '@State private var lastPayload = "No event received yet."')
      : androidExample(`Column {\n${indent(body)}\n    Text(lastPayload)\n}`, 'var lastPayload by remember { mutableStateOf("No event received yet.") }'),
    notes: [avatarPayloads[name], 'loading="lazy" has no viewport deferral natively and crossorigin has no CORS semantics; the image loads when the avatar is shown.',
      'The callback exposes native JSON-shaped data; no DOM Event object is created.'],
  };
}
function avatarPartExample(name, platform) {
  const swift = platform === 'swift', separator = swift ? ': ' : ' = ';
  const length = points => swift ? `.points(${points})` : `AWCSkeletonLength(points = ${points}.0)`;
  const fields = {
    image: `imagePositionX${separator}0.0, imagePositionY${separator}0.0, imageOpacity${separator}0.8`,
    initials: `initialsColor${separator}"#1B5E20", initialsFontSize${separator}${length(18)}, initialsLetterSpacing${separator}${length(0)}`,
    icon: `iconColor${separator}"#E65100", iconFontSize${separator}${length(20)}`,
  }[name];
  if (!fields) return null;
  const properties = name === 'image' ? { src: avatarImage, alt: 'Alex Morgan', size: 'large' } : name === 'initials' ? { name: 'Alex Morgan', size: 'large' } : { size: 'large' };
  let body = componentCode('md-avatar', properties, platform);
  body = swift ? `${body}\n.awcAvatarPartAppearance(.init(${fields}))` : `AWCAvatarPartAppearanceScope(AWCAvatarPartAppearance(${fields})) {\n${indent(body)}\n}`;
  return {
    status: 'native-equivalent', description: `Style the avatar's ${name} part through its public typed native appearance API.`,
    code: swift ? swiftExample(body) : androidExample(body),
    notes: ['Native views do not interpret CSS ::part() selectors. Part values win over the avatar hooks, as outer-tree ::part() rules do.',
      { image: 'object-position is a fraction of the free space on each axis (0 = left/top, 0.5 = centre); the image keeps object-fit: cover.',
        initials: 'Initials lengths resolve px, em (the label font size) and rem; font weight takes 1–1000.',
        icon: 'The icon font size changes the glyph only; its box keeps the icon size hook, as in the source.' }[name]],
  };
}
function avatarSlotExample(platform) {
  const body = componentCode('md-avatar', { label: 'Team', size: 'large' }, platform, { children: [{ text: '★' }] });
  return {
    description: 'Replace the person icon with authored fallback content: it shows when there is no usable image and no initials.',
    code: platform === 'swift' ? swiftExample(body) : androidExample(body),
    notes: ['Slotted content is centred in the icon box at the icon size in the label color. A slotted md-badge keeps its own size and sits on the host’s physical top-right corner, inside the clip.',
      'An image or initials (from initials or name) take precedence over the slot, as in the source.'],
  };
}

// ---- Selection controls: the method controller (validation and focus) and the typed parts.
const selectionMethodLabels = { setFocus: 'Focus', setBlur: 'Blur', select: 'Select', getValidity: 'Read validity', checkValidity: 'Check',
  reportValidity: 'Report', setCustomValidity: 'Set a custom error', syncValidityFromGroup: 'Sync with the group' };
const selectionSamples = { 'md-switch': { required: true, ariaLabel: 'Notifications' }, 'md-checkbox': { required: true, ariaLabel: 'Accept the terms' },
  'md-radio': { name: 'plan', value: 'pro', required: true, ariaLabel: 'Pro plan' } };
const selectionMethodNotes = {
  setFocus: 'Focuses the control and shows its programmatic focus ring.', setBlur: 'Removes focus from the radio.',
  select: 'Checks an enabled, unchecked radio, unchecks its group siblings silently and emits mdChange, like a user interaction.',
  getValidity: 'Returns { valid, validationMessage, flags } with the ten ValidityState flags; a custom message wins as customError, otherwise an empty required control is valueMissing with valueMissingLabel.',
  checkValidity: 'Returns the validity without presenting it; a hard-disabled control is barred from validation and returns true.',
  reportValidity: 'Like checkValidity(), but an invalid control shows its message inline (kept in sync while it stays invalid) and takes focus with its ring. The message hides when the control becomes valid, its name changes, it is disabled or its form resets.',
  setCustomValidity: 'A non-empty message marks the control invalid (customError) until it is cleared with an empty string; validity changes emit mdValidityChange.',
  syncValidityFromGroup: 'Validity and the roving tab stop are derived natively from the group, so this only refreshes them.' };
function selectionMethodExample(tag, name, platform) {
  const swift = platform === 'swift', label = selectionMethodLabels[name];
  const read = ['getValidity', 'checkValidity', 'reportValidity'].includes(name);
  const call = name === 'setCustomValidity' ? 'controller.setCustomValidity("Choose an option first.")'
    : name === 'getValidity' ? 'status = controller.getValidity().validationMessage'
    : read ? (swift ? `status = controller.${name}() ? "Valid" : "Invalid"` : `status = if (controller.${name}()) "Valid" else "Invalid"`)
    : `controller.${name}()`;
  const body = componentCode(tag, listId(tag, platform, selectionSamples[tag]), platform);
  return {
    description: `Call ${name}() on the mounted native ${tag.slice(3)} through its AWCSelectionControlController.`,
    code: swift
      ? swiftExample(`VStack {\n    Button(${literal(label, platform)}) { ${call} }\n${indent(body)}\n    .awcSelectionControlController(controller, for: ${literal(tag, platform)})${read ? '\n    Text(status)' : ''}\n}`,
        `private let controller = AWCSelectionControlController()${read ? '\n@State private var status = ""' : ''}`)
      : androidExample(`Column {\n    Button(onClick = { ${call} }) { Text(${literal(label, platform)}) }\n    AWCSelectionControlControllerScope(controller, ${literal(tag, platform)}) {\n${indent(body, 8)}\n    }${read ? '\n    Text(status)' : ''}\n}`,
        `val controller = remember { AWCSelectionControlController() }${read ? '\nvar status by remember { mutableStateOf("") }' : ''}`, ['androidx.compose.material3.Button']),
    notes: [selectionMethodNotes[name], swift ? 'The controller addresses the node whose id matches; AWCNativeView(tag:) uses the tag as its id. Without an id it attaches to every descendant selection control.' : 'The controller attaches to the component whose id property matches; with an empty id it attaches to every descendant selection control.'],
  };
}
const selectionPartValues = {
  'md-switch': { track: { trackColor: '#FFF59D', trackOutlineColor: '#F57F17', trackShape: '6px' }, handle: { handleColor: '#33691E', handleShape: '3px', handleOpacity: 0.8 }, icon: { iconColor: '#FFEB3B' }, 'state-layer': { stateLayerColor: '#C2185B' } },
  'md-checkbox': { target: { targetColor: '#FFF8E1' }, 'state-layer': { stateLayerColor: '#C2185B', stateLayerOpacity: 0.2 }, container: { containerColor: '#FFF59D', containerOutlineColor: '#F57F17', containerShape: '5px' },
    icon: { iconColor: '#1A237E' }, 'supporting-text': { supportingTextColor: '#4A148C' } },
  'md-radio': { 'state-layer': { stateLayerColor: '#C2185B', stateLayerOpacity: 0.2 }, 'outer-circle': { outerColor: '#F57F17', outerFill: '#FFF59D' }, 'inner-circle': { innerColor: '#1A237E' } },
  'md-chip': { 'state-layer': { stateLayerColor: '#C2185B', stateLayerOpacity: 0.2 }, outline: { outlineColor: '#F57F17', outlineWidth: 2 }, label: { labelColor: '#1A237E' }, icon: { iconColor: '#33691E' },
    'trailing-icon': { trailingIconColor: '#B71C1C' }, checkmark: { checkmarkColor: '#1B5E20' }, remove: { removeColor: '#B71C1C' },
    primary: { primaryBackground: '#00897B3D', primaryOutlineStyle: 'solid', primaryOutlineColor: '#E53935', primaryOutlineWidth: 2, primaryOutlineOffset: -4 } },
  // gate-7 R6-03: the tab and navigation-bar families' typed part targets.
  'md-tab': { 'state-layer': { stateLayerColor: '#C2185B', stateLayerOpacity: 0.16 }, icon: { iconColor: '#8E24AA' }, label: { labelColor: '#3949AB' }, indicator: { indicatorColor: '#00897B' }, divider: { dividerColor: '#E53935' } },
  'md-tabs': { container: { containerColor: '#FFF8E1' } },
  'md-navigation-tab': { 'state-layer': { stateLayerColor: '#C2185B', stateLayerOpacity: 0.16 }, icon: { iconColor: '#8E24AA' }, label: { labelColor: '#3949AB' }, indicator: { indicatorColor: '#B2DFDB' }, badge: { badgeColor: '#1E88E5', badgeLabelColor: '#FFFDE7' } },
  'md-navigation-bar': { container: { containerColor: '#FFF8E1' } },
};
const selectionPartOrder = { 'md-switch': ['trackColor', 'trackOutlineColor', 'trackShape', 'handleColor', 'handleShape', 'handleOpacity', 'iconColor', 'stateLayerColor'],
  'md-checkbox': ['targetColor', 'stateLayerColor', 'stateLayerOpacity', 'containerColor', 'containerOutlineColor', 'containerShape', 'iconColor', 'supportingTextColor'],
  'md-radio': ['stateLayerColor', 'stateLayerOpacity', 'outerColor', 'outerFill', 'innerColor'],
  'md-chip': ['stateLayerColor', 'stateLayerOpacity', 'outlineColor', 'outlineWidth', 'labelColor', 'iconColor', 'trailingIconColor', 'checkmarkColor', 'removeColor',
    'primaryBackground', 'primaryOutlineStyle', 'primaryOutlineColor', 'primaryOutlineWidth', 'primaryOutlineOffset'],
  'md-tab': ['stateLayerColor', 'stateLayerOpacity', 'iconColor', 'labelColor', 'indicatorColor', 'dividerColor'], 'md-tabs': ['containerColor'],
  'md-navigation-tab': ['stateLayerColor', 'stateLayerOpacity', 'iconColor', 'labelColor', 'indicatorColor', 'badgeColor', 'badgeLabelColor'], 'md-navigation-bar': ['containerColor'] };
const selectionPartSamples = { 'md-switch': { selected: true, icons: true, ariaLabel: 'Notifications' }, 'md-checkbox': { checked: true, supportingText: 'Weekly digest', ariaLabel: 'Digest' },
  'md-radio': { checked: true, name: 'plan', value: 'pro', ariaLabel: 'Pro plan' }, 'md-chip': { label: 'Filter', variant: 'filter', selected: true, removable: true, icon: 'palette', trailingIcon: 'expand_more' },
  'md-tab': { label: 'Flights', icon: 'flight', active: true }, 'md-tabs': { ariaLabelProp: 'Sections' }, 'md-navigation-tab': { label: 'Mail', icon: 'mail', active: true, badge: true, badgeValue: '3' }, 'md-navigation-bar': {} };
const possessive = noun => noun.endsWith('s') ? `${noun}'` : `${noun}'s`;
function selectionPartExample(tag, name, platform) {
  const values = selectionPartValues[tag]?.[name];
  if (!values) return null;
  const swift = platform === 'swift', separator = swift ? ': ' : ' = ';
  const type = { 'md-switch': 'Switch', 'md-checkbox': 'Checkbox', 'md-radio': 'Radio', 'md-chip': 'Chip', 'md-tab': 'Tab', 'md-tabs': 'Tabs', 'md-navigation-tab': 'NavigationTab', 'md-navigation-bar': 'NavigationBar' }[tag];
  const number = value => Number.isInteger(value) ? `${value}.0` : String(value);
  const fields = selectionPartOrder[tag].filter(key => Object.hasOwn(values, key)).map(key => {
    const value = values[key];
    return `${key}${separator}${/Shape$/.test(key) ? cornerShapeNativeValue(parseCornerShape(value), platform) : typeof value === 'string' ? literal(value, platform) : number(value)}`;
  }).join(', ');
  let body = componentCode(tag, selectionPartSamples[tag], platform);
  body = swift ? `${body}\n.awc${type}PartAppearance(.init(${fields}))` : `AWC${type}PartAppearanceScope(AWC${type}PartAppearance(${fields})) {\n${indent(body)}\n}`;
  return {
    status: 'native-equivalent', description: `Style the ${possessive(tag.slice(3).replace(/-/g, ' '))} ${name} part through its public typed native part appearance.`,
    code: swift ? swiftExample(body) : androidExample(body),
    notes: ['Native views do not interpret CSS ::part() selectors. Part values come from the outer tree, so they win over the hooks and every internal state and disabled rule, as ::part() rules do.'],
  };
}
// ---- md-breadcrumbs: expand() / collapse() through the native trail controller.
function breadcrumbsMethodExample(name, platform) {
  const swift = platform === 'swift', label = name === 'expand' ? 'Show full trail' : 'Collapse trail';
  const crumbs = [['Home', '#home', 'home'], ['Workspace', '#workspace'], ['Projects', '#projects'], ['Roadmap', '#roadmap'], ['Q3 plan']];
  const children = crumbs.map(([title, href, icon]) => ({ tag: 'md-breadcrumb-item', properties: { ...(href ? { href } : {}), ...(icon ? { icon } : {}) }, children: [{ text: title }] }));
  const trail = componentCode('md-breadcrumbs', { maxItems: 3 }, platform, { children });
  return {
    description: `Call ${name}() on a native trail through its AWCBreadcrumbsController.`,
    code: swift
      ? swiftExample(`VStack(alignment: .leading) {\n    Button(${literal(label, platform)}) { controller.${name}() }\n${indent(trail)}\n        .awcBreadcrumbsController(controller)\n}`, 'private let controller = AWCBreadcrumbsController()')
      : androidExample(`Column {\n    Button(onClick = { controller.${name}() }) { Text(${literal(label, platform)}) }\n    AWCBreadcrumbsControllerScope(controller) {\n${indent(trail, 8)}\n    }\n}`,
        'val controller = remember { AWCBreadcrumbsController() }', ['androidx.compose.material3.Button']),
    notes: [`${name}() sets the trail ${name === 'expand' ? 'expanded (every crumb shown)' : 'collapsed to its window again'} and emits mdExpand with { expanded, itemCount }, also with maxItems 0, as the source; calling it again in the same state emits nothing.`,
      'The overflow toggle expands the trail itself and moves focus to the first revealed link (with the focus ring when it was used from the keyboard).'],
  };
}
// ---- md-tabs: selectTab(index) through the native tabs controller.
function tabsMethodExample(platform) {
  const swift = platform === 'swift', label = 'Show settings';
  const children = ['Overview', 'Activity', 'Settings'].map(title => ({ tag: 'md-tab', properties: { label: title } }));
  const tabs = componentCode('md-tabs', { ariaLabelProp: 'Workspace sections' }, platform, { children });
  return {
    description: 'Call selectTab(index) on native tabs through their AWCTabsController.',
    code: swift
      ? swiftExample(`VStack(alignment: .leading) {\n    Button(${literal(label, platform)}) { controller.selectTab(2) }\n${indent(tabs)}\n        .awcTabsController(controller)\n}`, 'private let controller = AWCTabsController()')
      : androidExample(`Column {\n    Button(onClick = { controller.selectTab(2) }) { Text(${literal(label, platform)}) }\n    AWCTabsControllerScope(controller) {\n${indent(tabs, 8)}\n    }\n}`,
        'val controller = remember { AWCTabsController() }', ['androidx.compose.material3.Button']),
    notes: ['selectTab(index) activates the tab at index and emits mdTabChange with { index, previousIndex }, like a click; an index outside the tabs is ignored and the active tab is not selected again.',
      'Writing activeTabIndex changes the selection silently (no mdTabChange), as the source; linked md-tab-panels follow either way.'],
  };
}
// ---- md-navigation-bar: select(index) / focusTab(index) through the native bar controller; md-navigation-tab: focusEl().
function navigationBarMethodExample(name, platform) {
  const swift = platform === 'swift', label = name === 'select' ? 'Show saved' : 'Focus saved';
  const children = [['Home', 'home'], ['Explore', 'explore'], ['Saved', 'bookmark']].map(([title, icon]) => ({ tag: 'md-navigation-tab', properties: { label: title, icon } }));
  const bar = componentCode('md-navigation-bar', {}, platform, { children });
  return {
    description: `Call ${name}(index) on a native navigation bar through its AWCNavigationBarController.`,
    code: swift
      ? swiftExample(`VStack(alignment: .leading) {\n    Button(${literal(label, platform)}) { controller.${name}(2) }\n${indent(bar)}\n        .awcNavigationBarController(controller)\n}`, 'private let controller = AWCNavigationBarController()')
      : androidExample(`Column {\n    Button(onClick = { controller.${name}(2) }) { Text(${literal(label, platform)}) }\n    AWCNavigationBarControllerScope(controller) {\n${indent(bar, 8)}\n    }\n}`,
        'val controller = remember { AWCNavigationBarController() }', ['androidx.compose.material3.Button']),
    notes: name === 'select'
      ? ['select(index) clamps the index to an activatable destination (forward, then backward; disabled and soft-disabled skipped) and emits mdChange with { index, previousIndex } when the selection changes, as the source; writing activeIndex does the same.']
      : ['focusTab(index) moves keyboard focus to the destination without selecting it (a soft-disabled destination can take focus; a hard-disabled one cannot). With manual activation, Enter or Space then activates it.'],
  };
}
function navigationTabMethodExample(platform) {
  const swift = platform === 'swift';
  const tab = componentCode('md-navigation-tab', { label: 'Saved', icon: 'bookmark' }, platform, {});
  return {
    description: 'Call focusEl() on a native destination outside a bar through its AWCNavigationTabController.',
    code: swift
      ? swiftExample(`VStack(alignment: .leading) {\n    Button(${literal('Focus destination', platform)}) { controller.focusEl() }\n${indent(tab)}\n        .awcNavigationTabController(controller)\n}`, 'private let controller = AWCNavigationTabController()')
      : androidExample(`Column {\n    Button(onClick = { controller.focusEl() }) { Text(${literal('Focus destination', platform)}) }\n    AWCNavigationTabControllerScope(controller) {\n${indent(tab, 8)}\n    }\n}`,
        'val controller = remember { AWCNavigationTabController() }', ['androidx.compose.material3.Button']),
    notes: ['focusEl() focuses the destination unless it is hard-disabled. Inside a bar, use the bar controller\'s focusTab(index).'],
  };
}
// ---- md-menu family: the anchored recipe menu in an AWCMenuScope; methods through AWCMenuScopeState handles.
const MENU_FAMILY = ['md-menu', 'md-menu-item', 'md-menu-item-group', 'md-sub-menu-item'];
const menuFamily = (tag, policy) => MENU_FAMILY.includes(tag) && (tag !== 'md-menu' || has(policy?.properties, 'anchor'));
const MENU_TREE = { id: 'demo-menu', tag: 'md-menu', properties: { anchor: 'demo-menu-trigger' }, children: [
  { id: 'demo-menu-group', tag: 'md-menu-item-group', properties: { label: 'Workspace' }, children: [
    { id: 'demo-menu-new', tag: 'md-menu-item', properties: { headline: 'New project', supportingText: 'Start something new' } },
    { id: 'demo-menu-duplicate', tag: 'md-menu-item', properties: { headline: 'Duplicate', trailingText: '⌘D' } },
    { id: 'demo-menu-export', tag: 'md-sub-menu-item', properties: { headline: 'Export' }, children: [
      { id: 'demo-menu-export-menu', tag: 'md-menu', slot: 'submenu', properties: {}, children: [
        { id: 'demo-menu-swiftui', tag: 'md-menu-item', properties: { headline: 'SwiftUI' } },
        { id: 'demo-menu-compose', tag: 'md-menu-item', properties: { headline: 'Compose' } }] }] }] }] };
function menuSwiftNode(node) {
  const children = (node.children ?? []).map(menuSwiftNode);
  return `AWCNode(id: ${literal(node.id, 'swift')}, tag: ${literal(node.tag, 'swift')}, properties: ${propertiesCode(node.properties, 'swift')}${children.length ? `, children: [\n${indent(children.join(',\n'))}\n]` : ''}${node.slot ? `, slot: ${literal(node.slot, 'swift')}` : ''})`;
}
const menuChild = node => ({ tag: node.tag, ...(node.slot ? { slot: node.slot } : {}), properties: { id: node.id, ...node.properties }, children: (node.children ?? []).map(menuChild) });
const MENU_METHOD_LABELS = { show: 'show()', close: 'close()', whenClosed: 'whenClosed()', reposition: 'reposition()', getScrollViewport: 'getScrollViewport()', collapse: 'collapse()' };
function menuMethodCall(name, platform) {
  const swift = platform === 'swift', handle = swift ? 'menus.menu("demo-menu")' : 'menus.menu("demo-menu")';
  switch (name) {
    case 'whenClosed': return swift ? `Task {\n    await ${handle}.whenClosed()\n    status = "whenClosed() completed"\n}` : `coroutineScope.launch {\n    ${handle}.whenClosed()\n    status = "whenClosed() completed"\n}`;
    case 'getScrollViewport': return swift
      ? `if let viewport = ${handle}.getScrollViewport() {\n    status = "scrollTop \\(viewport.scrollTop), scrollHeight \\(viewport.scrollHeight), clientHeight \\(viewport.clientHeight)"\n} else {\n    status = "The menu is closed"\n}`
      : `status = ${handle}.getScrollViewport()?.let { "scrollTop \${it["scrollTop"]}, scrollHeight \${it["scrollHeight"]}, clientHeight \${it["clientHeight"]}" } ?: "The menu is closed"`;
    case 'collapse': return swift ? `${handle}.collapse(row: "demo-menu-export")` : `${handle}.collapse("demo-menu-export")`;
    case 'show': return swift ? `${handle}.show(autoFocus: true)` : `${handle}.show(autoFocus = true)`;
    default: return `${handle}.${name}()`;
  }
}
function menuExample(platform, { method, event } = {}) {
  const swift = platform === 'swift';
  const handler = event ? swift ? `if event.name == ${literal(event, platform)} { status = "${event} from \\(event.nodeID)" }` : `if (name == ${literal(event, platform)}) status = name` : null;
  const toggle = swift
    ? 'if event.name == "mdClick" {\n    let menu = menus.menu("demo-menu")\n    if menu.isOpen { menu.close() } else { menu.show() }\n}'
    : 'if (name == "mdClick") {\n    val menu = menus.menu("demo-menu")\n    if (menu.isOpen) menu.close() else menu.show()\n}';
  const trigger = swift
    ? `AWCNativeView(node: AWCNode(id: "demo-menu-trigger", tag: "md-button", properties: ["variant": .string("tonal")], children: [.text("Open menu")])) { event in\n${indent(toggle)}\n}`
    : `AWCComponent(\n    tag = "md-button",\n    properties = mapOf<String, AWCValue>("id" to "demo-menu-trigger", "label" to "Open menu", "variant" to "tonal"),\n    onEvent = { name, _ ->\n${indent(toggle, 8)}\n    },\n)`;
  const menu = swift
    ? `AWCNativeView(node: ${menuSwiftNode(MENU_TREE)}${handler ? `) { event in\n${indent(handler)}\n}` : ')'}`
    : componentCode('md-menu', { id: MENU_TREE.id, ...MENU_TREE.properties }, platform, { children: MENU_TREE.children.map(menuChild), handler });
  const scope = swift
    ? `AWCMenuScope(state: menus) {\n    VStack(spacing: 12) {\n${indent(trigger + '\n' + menu, 8)}\n    }\n    .padding(.top, 12)\n}\n.frame(width: 360, height: 480)`
    : `AWCMenuScope(menus, Modifier.requiredSize(360.dp, 480.dp)) {\n    Column(Modifier.fillMaxWidth().padding(top = 12.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {\n${indent(trigger + '\n' + menu, 8)}\n    }\n}`;
  const controls = method ? swift ? `Button(${literal(MENU_METHOD_LABELS[method], platform)}) {\n${indent(menuMethodCall(method, platform))}\n}`
    : `Button(onClick = {\n${indent(menuMethodCall(method, platform))}\n}) { Text(${literal(MENU_METHOD_LABELS[method], platform)}) }` : '';
  const hasStatus = Boolean(event || method && !['show', 'close', 'reposition', 'collapse'].includes(method));
  const body = method || hasStatus ? `${swift ? 'VStack' : 'Column'} {\n${indent([scope, controls, hasStatus ? 'Text(status)' : ''].filter(Boolean).join('\n'))}\n}` : scope;
  const state = swift ? ['@State private var menus = AWCMenuScopeState()', hasStatus && '@State private var status = "Ready"'].filter(Boolean).join('\n')
    : ['val menus = rememberAWCMenuScopeState()', method === 'whenClosed' && 'val coroutineScope = rememberCoroutineScope()', hasStatus && 'var status by remember { mutableStateOf("Ready") }'].filter(Boolean).join('\n');
  const imports = ['androidx.compose.foundation.layout.Arrangement', 'androidx.compose.foundation.layout.fillMaxWidth', 'androidx.compose.foundation.layout.padding', 'androidx.compose.foundation.layout.requiredSize',
    'androidx.compose.ui.Alignment', 'androidx.compose.ui.Modifier', 'androidx.compose.ui.unit.dp', ...(method ? ['androidx.compose.material3.Button'] : []), ...(method === 'whenClosed' ? ['kotlinx.coroutines.launch'] : [])];
  const methodNotes = {
    show: 'show({ autoFocus }) opens the menu and closes its open peers; autoFocus (default: the auto-focus property) focuses the first row. The trigger itself is the app’s: md-menu does not listen to its anchor.',
    close: 'close() runs the 150 ms exit (instant when quick or with Reduce Motion), then open turns false and mdClose fires.',
    whenClosed: 'whenClosed() resolves after the current open cycle and its exit motion; it resolves at once while the menu is closed.',
    reposition: 'The surface is placed against the anchor’s live frame on every layout pass; reposition() requests one more pass, for an anchor moved without a layout change.',
    getScrollViewport: 'The Web method returns the scroll element; the native handle returns its geometry instead: scrollTop, scrollHeight and clientHeight (points / dp), or nil / null while the menu is closed.',
    collapse: 'md-sub-menu-item collapse() closes the row’s flyout at once, without the exit motion; the handle names the submenu row by its node ID.',
  };
  return {
    status: 'supported',
    description: method ? `Call ${MENU_METHOD_LABELS[method]} through the menu’s AWCMenuHandle (AWCMenuScopeState.menu("demo-menu")).`
      : 'Author an anchored menu: a trigger with the anchor ID and the recipe rows (a group, a trailing-text row and an Export submenu) in an AWCMenuScope.',
    code: swift ? swiftExample(body, state) : androidExample(body, state, imports),
    notes: ['AWCMenuScope is the menus’ top layer: an anchored menu presents above the scope’s content and is placed in its bounds (flip, viewport margin, capped height). Outside a scope a menu renders in flow. The 360 × 480 frame is this example’s layout, not a menu size restriction.',
      'The trigger toggles the menu as the recipe does (open = !open). Outside clicks close a non-persistent menu, Escape and Tab close the tree and return focus to the anchor, and activating a row closes the tree unless keep-open.',
      ...(method ? [methodNotes[method]] : []), ...(event ? ['mdOpen and mdClose have no detail; rows emit mdClick when activated (checkbox and radio rows after toggling).'] : [])],
  };
}

// ---- md-ripple: the surface decorator with its method controller.
function rippleMethodExample(name, platform) {
  const swift = platform === 'swift', settled = name === 'whenSettled', label = settled ? 'Wait until settled' : 'Trigger';
  const call = !settled ? 'controller.trigger()' : swift ? 'Task { await controller.whenSettled(); status = "Settled" }' : 'scope.launch { controller.whenSettled(); status = "Settled" }';
  return {
    description: `Call ${name}() on a native ripple through its AWCRippleController.`,
    code: swift
      ? swiftExample(`VStack {\n    Button(${literal(label, platform)}) { ${call} }\n    AWCRippleExampleSurface(node: AWCNode(id: "ripple", tag: "md-ripple"))\n        .awcRippleController(controller)${settled ? '\n    Text(status)' : ''}\n}`,
        `private let controller = AWCRippleController()${settled ? '\n@State private var status = ""' : ''}`)
      : androidExample(`Column {\n    Button(onClick = { ${call} }) { Text(${literal(label, platform)}) }\n    AWCRippleControllerScope(controller) {\n        AWCRippleExampleSurface()\n    }${settled ? '\n    Text(status)' : ''}\n}`,
        `val controller = remember { AWCRippleController() }${settled ? '\nval scope = rememberCoroutineScope()\nvar status by remember { mutableStateOf("") }' : ''}`,
        ['androidx.compose.material3.Button', ...(settled ? ['kotlinx.coroutines.launch'] : [])]),
    notes: [settled ? 'Waits for the current cycle with the source bound (150 + 50 ms): it can return while a held or long-growing wave is still visible, and it never settles a later wave.'
      : 'Starts a centred, self-releasing wave unless the ripple is disabled or suppressed (the --md-sys-ripple-enabled theme token, or awcRippleEnabled / LocalAWCRippleEnabled).',
      swift ? 'On your own surfaces use .awcRipple(cornerRadius:contentColor:controller:appearance:); AWCRippleExampleSurface is the Laboratory recipe.'
        : 'On your own surfaces use Modifier.awcRipple(cornerRadius, contentColor, controller, appearance); AWCRippleExampleSurface is the Laboratory recipe.'],
  };
}
// ---- md-color-picker / md-time-picker: the method controllers (AWCColorPickerController, AWCTimePickerController).
const pickerMethodNotes = {
  'md-color-picker': {
    show: 'Opens the popover of a popover picker (variant popover) that is not disabled and emits mdOpenChange, as the source method does.',
    close: 'Closes the popover and emits mdOpenChange; focus inside the popover returns to the trigger.',
  },
  'md-time-picker': {
    show: 'Opens the dialog (mdOpen); focus moves to the hour tile.',
    hide: 'Closes the dialog as Cancel: mdCancel, then mdClose; focus returns to the trigger.',
    checkValidity: 'Returns the committed value\'s validity (required, min / max, an overnight window); a disabled picker reports true.',
    reportValidity: 'Like checkValidity(); an invalid picker shows its message as the trigger\'s error text and focuses the trigger.',
    getValidity: 'Returns AWCTimePickerValidity: valid, validationMessage, valueMissing, rangeUnderflow and rangeOverflow.',
  },
};
function pickerMethodExample(tag, name, platform) {
  const swift = platform === 'swift', color = tag === 'md-color-picker';
  const type = color ? 'AWCColorPickerController' : 'AWCTimePickerController';
  const body = color
    ? componentCode('md-color-picker', { variant: 'popover', value: '#6750A4' }, platform, { children: [{ tag: 'md-button', slot: 'trigger', properties: { variant: 'tonal' }, children: [{ text: 'Choose colour' }] }] })
    : componentCode('md-time-picker', { label: 'Meeting time', value: '14:30', required: true }, platform);
  const result = ['checkValidity', 'reportValidity', 'getValidity'].includes(name);
  const call = !result ? `controller.${name}()`
    : swift ? `status = ${name === 'getValidity' ? '"\\(controller.getValidity().validationMessage)"' : `"\\(controller.${name}())"`}`
    : `status = ${name === 'getValidity' ? 'controller.getValidity().validationMessage' : `controller.${name}().toString()`}`;
  const label = literal(`${name}()`, platform);
  if (swift) {
    const content = `VStack(alignment: .leading) {\n    Button(${label}) { ${call} }${result ? '\n    Text(status)' : ''}\n${indent(body)}\n    .awc${color ? 'ColorPicker' : 'TimePicker'}Controller(controller)\n}`;
    return {
      description: `Call ${name}() on the mounted native picker through its ${type}.`,
      // The time picker's dialog presents in an AWCModalScope placed at the content root.
      code: swiftExample(color ? content : `AWCModalScope {\n${indent(content)}\n}`, `private let controller = ${type}()${result ? '\n@State private var status = ""' : ''}`),
      notes: [pickerMethodNotes[tag][name], 'The controller addresses every picker below it, or the picker whose node id matches with .awc' + (color ? 'ColorPicker' : 'TimePicker') + 'Controller(controller, for: id).'],
    };
  }
  return {
    description: `Call ${name}() on the mounted native picker through its ${type}.`,
    code: androidExample(`Column {\n    Button(onClick = { ${call} }) { Text(${label}) }${result ? '\n    Text(status)' : ''}\n    ${type}Scope(controller) {\n${indent(body, 8)}\n    }\n}`,
      `val controller = remember { ${type}() }${result ? '\nvar status by remember { mutableStateOf("") }' : ''}`, ['androidx.compose.material3.Button']),
    notes: [pickerMethodNotes[tag][name], `The controller attaches to the md-${color ? 'color' : 'time'}-picker composed inside the scope.`],
  };
}
// ---- md-text-field: the method controller (focus, selection, constraint validation) and the typed parts.
const textFieldMethodLabels = { setFocus: 'Focus', select: 'Select all', getInputElement: 'Read the input', getValidity: 'Read validity',
  checkValidity: 'Check', reportValidity: 'Report', setCustomValidity: 'Set a custom error' };
const textFieldMethodNotes = {
  setFocus: 'Focuses the native input with the caret at the end.',
  select: 'Focuses the input and selects the whole value; the value does not change.',
  getInputElement: 'Native views have no DOM element: the native method returns AWCTextFieldInputInfo (value, selection range, focus and IME composition) or nil/null while unmounted. The Laboratory preview does not run it.',
  getValidity: 'Returns { valid, validationMessage, flags } with the ten ValidityState flags and Chrome\'s English messages (required, type, pattern, length, range, step, custom).',
  checkValidity: 'Returns the validity without presenting it; a disabled or read-only field is barred from validation and returns true.',
  reportValidity: 'Like checkValidity(), but an invalid field shows its message in its error state and takes focus.',
  setCustomValidity: 'A non-empty message marks the field invalid (customError) until it is cleared with an empty string; validity changes emit mdValidityChange.' };
function textFieldMethodExample(name, platform) {
  const swift = platform === 'swift', label = textFieldMethodLabels[name];
  const read = ['getValidity', 'checkValidity', 'reportValidity', 'getInputElement'].includes(name);
  const call = name === 'setCustomValidity' ? 'controller.setCustomValidity("Use your work email.")'
    : name === 'getValidity' ? 'status = controller.getValidity().validationMessage'
    : name === 'getInputElement' ? (swift ? 'status = controller.getInputElement()?.value ?? ""' : 'status = controller.getInputElement()?.value ?: ""')
    : read ? (swift ? `status = controller.${name}() ? "Valid" : "Invalid"` : `status = if (controller.${name}()) "Valid" else "Invalid"`)
    : `controller.${name}()`;
  const body = componentCode('md-text-field', { label: 'Email', type: 'email', required: true, value: '' }, platform);
  return {
    description: `Call ${name}() on the mounted native text field through its AWCTextFieldController.`,
    code: swift
      ? swiftExample(`VStack {\n    Button(${literal(label, platform)}) { ${call} }\n${indent(body)}\n    .awcTextFieldController(controller, for: "md-text-field")${read ? '\n    Text(status)' : ''}\n}`,
        `private let controller = AWCTextFieldController()${read ? '\n@State private var status = ""' : ''}`)
      : androidExample(`Column {\n    Button(onClick = { ${call} }) { Text(${literal(label, platform)}) }\n    AWCTextFieldControllerScope(controller) {\n${indent(body, 8)}\n    }${read ? '\n    Text(status)' : ''}\n}`,
        `val controller = remember { AWCTextFieldController() }${read ? '\nvar status by remember { mutableStateOf("") }' : ''}`, ['androidx.compose.material3.Button']),
    notes: [textFieldMethodNotes[name], swift ? 'The controller addresses the field whose node id matches; AWCNativeView(tag:) uses the tag as its id. Without an id it attaches to every descendant text field.'
      : 'The controller attaches to the text fields inside its scope.'],
  };
}
const textFieldPartValues = { container: { containerColor: '#FFF59D' }, label: { labelColor: '#1A237E' }, input: { inputColor: '#33691E', caretColor: '#C2185B' },
  'supporting-text': { supportingTextColor: '#4A148C' }, counter: { counterColor: '#B71C1C' } };
const textFieldPartOrder = ['containerColor', 'labelColor', 'inputColor', 'caretColor', 'supportingTextColor', 'counterColor'];
function textFieldPartExample(name, platform) {
  const swift = platform === 'swift';
  if (name === 'chips') return { status: 'native-equivalent', description: 'The chips part has no paint of its own: style the md-chip children with their chip appearance.', code: null,
    notes: ['Native views do not interpret CSS ::part() selectors. The chips row lays out the chips slot (gap 4, wrapping under chipsWrap).'] };
  const values = textFieldPartValues[name];
  if (!values) return null;
  const separator = swift ? ': ' : ' = ';
  const fields = textFieldPartOrder.filter(key => Object.hasOwn(values, key)).map(key => `${key}${separator}${literal(values[key], platform)}`).join(', ');
  let body = componentCode('md-text-field', { label: 'Label', value: 'Input text', supportingText: 'Supporting text', maxLength: 20 }, platform);
  body = swift ? `${body}\n.awcTextFieldPartAppearance(.init(${fields}))` : `AWCTextFieldPartAppearanceScope(AWCTextFieldPartAppearance(${fields})) {\n${indent(body)}\n}`;
  return {
    status: 'native-equivalent', description: `Style the text field's ${name} part through its public typed native part appearance.`,
    code: swift ? swiftExample(body) : androidExample(body),
    notes: ['Native views do not interpret CSS ::part() selectors. Part values come from the outer tree, so they win over the hooks and every hover, focus, error and disabled rule, as ::part() rules do.'],
  };
}
// md-line/area/bar/pie-chart and md-sparkline: methods through AWCChartController.
const chartMethodLabels = { replay: 'Replay entrance', setZoom: 'Zoom to Feb–May', resetZoom: 'Reset zoom', drill: 'Drill into the first category', refreshTheme: 'Refresh theme',
  resize: 'Resize', toDataURL: 'Export PNG' };
const chartMethodNotes = {
  replay: 'Plays the entrance again from its first frame (the source\'s hasRendered = false; render()); reduced motion shows the final frame.',
  setZoom: 'Windows the category axis to the inclusive index range, clamped and ordered like the source; emits mdZoom.',
  resetZoom: 'Shows every category again; emits mdZoom when the window changes.',
  drill: 'Arms the next data swap to grow out of the indexed slot (down) or collapse into the plot (up); swap the data right after the call, as on the Web.',
  refreshTheme: 'Native charts read the theme tokens and hooks on every render; the call re-renders like the source\'s computed-style re-read.',
  resize: 'The plot follows the native view\'s size; the call re-renders like the source\'s ResizeObserver path.',
  toDataURL: 'Returns the canvas layer (plot geometry without the DOM-equivalent text overlay) as a PNG data URL at the display scale, like canvas.toDataURL().' };
const chartExampleProperties = {
  'md-line-chart': { label: 'Revenue', series: [{ label: 'Revenue', data: [12, 18, 15, 22, 28, 26] }], xAxis: { data: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'] }, zoom: 'slider' },
  'md-area-chart': { label: 'Revenue', series: [{ label: 'Revenue', data: [12, 18, 15, 22, 28, 26] }], xAxis: { data: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'] }, zoom: 'slider' },
  'md-bar-chart': { label: 'Revenue', series: [{ label: 'Revenue', data: [12, 18, 15, 22, 28, 26] }], xAxis: { data: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'] } },
  'md-pie-chart': { label: 'Traffic', data: [{ label: 'Search', value: 42 }, { label: 'Direct', value: 26 }, { label: 'Social', value: 18 }] },
  'md-sparkline': { data: [3, 5, 4, 7, 6, 9, 8] } };
// n5 navigation components: methods through their controllers (md-toolbar setFocus()).
const navMethodNotes = {
  'md-toolbar.setFocus': 'Focuses the toolbar\'s roving Tab stop — the remembered member, else the first enabled one — with the keyboard focus ring; no-op on a generic toolbar or an empty roving group.',
};
function navMethodExample(tag, name, platform) {
  const swift = platform === 'swift';
  const spec = { 'md-toolbar': { type: 'AWCToolbarController', modifier: 'awcToolbarController', label: 'Focus the toolbar', props: { variant: 'floating', ariaLabelProp: 'Formatting' } } }[tag];
  const call = `controller.${name}()`;
  const body = componentCode(tag, spec.props, platform);
  return {
    description: `Call ${name}() on the mounted native ${tag.slice(3).replace(/-/g, ' ')} through its ${spec.type}.`,
    code: swift
      ? swiftExample(`VStack {\n    Button(${literal(spec.label, platform)}) { ${call} }\n${indent(body)}\n    .${spec.modifier}(controller)\n}`, `@State private var controller = ${spec.type}()`)
      : androidExample(`Column {\n    Button(onClick = { ${call} }) { Text(${literal(spec.label, platform)}) }\n    ${spec.type}Scope(controller) {\n${indent(body, 8)}\n    }\n}`,
        `val controller = remember { ${spec.type}() }`, ['androidx.compose.material3.Button']),
    notes: [navMethodNotes[`${tag}.${name}`], swift ? 'The controller binds to the nearest toolbar below the modifier.' : 'The controller binds to the toolbar inside its scope.'],
  };
}
function chartMethodExample(tag, name, platform) {
  const swift = platform === 'swift', type = 'AWCChartController';
  const call = name === 'setZoom' ? (swift ? 'controller.setZoom(startIndex: 1, endIndex: 4)' : 'controller.setZoom(1.0, 4.0)')
    : name === 'drill' ? (swift ? 'controller.drill(index: 0)' : 'controller.drill(0)')
    : name === 'toDataURL' ? (swift ? 'status = String(controller.toDataURL().prefix(48))' : 'status = controller.toDataURL().take(48)')
    : `controller.${name}()`;
  const read = name === 'toDataURL';
  const body = componentCode(tag, chartExampleProperties[tag], platform);
  return {
    description: `Call ${name}() on the mounted native ${tag.slice(3).replace('-', ' ')} through its ${type}.`,
    code: swift
      ? swiftExample(`VStack {\n    Button(${literal(chartMethodLabels[name], platform)}) { ${call} }\n${indent(body)}\n    .awcChartController(controller)${read ? '\n    Text(status)' : ''}\n}`,
        `@State private var controller = ${type}()${read ? '\n@State private var status = ""' : ''}`)
      : androidExample(`Column {\n    Button(onClick = { ${call} }) { Text(${literal(chartMethodLabels[name], platform)}) }\n    ${type}Scope(controller) {\n${indent(body, 8)}\n    }${read ? '\n    Text(status)' : ''}\n}`,
        `val controller = remember { ${type}() }${read ? '\nvar status by remember { mutableStateOf("") }' : ''}`, ['androidx.compose.material3.Button']),
    notes: [chartMethodNotes[name], swift ? 'The controller binds to the nearest chart below the modifier.' : 'The controller binds to the chart inside its scope.'],
  };
}
// md-table / md-table-row / md-table-pagination: methods through AWCTableController and AWCTablePaginationController.
const tableMethodLabels = { getSelection: 'Read the selection', selectAll: 'Select all', deselectAll: 'Clear the selection', toggleSelectAll: 'Toggle all',
  setSort: 'Sort by project, descending', pinColumn: 'Pin the first column', setColumnVisibility: 'Hide the members column', animateNextChange: 'Animate the next change',
  toggle: 'Toggle the details', goToPage: 'Go to page 3', setRowsPerPage: 'Show 25 rows' };
const tableMethodNotes = {
  getSelection: 'Returns { count, total, values, all, indeterminate }: values are the selected rows’ value (or id) in row order.',
  selectAll: 'Selects every enabled, selectable body row (multiple selection only) and emits mdSelectionChange.',
  deselectAll: 'Clears the selection and emits mdSelectionChange.',
  toggleSelectAll: 'Selects all when not every row is selected, otherwise clears; emits mdSelectionChange.',
  setSort: 'Sets the sort state and emits mdSortChange; as on the Web the application reorders its rows (the consumer-sorts contract).',
  pinColumn: 'Pins the original column to start or end (none unpins; the same side toggles off) and emits mdPinChange. Returns the effective side, or null when the table cannot pin (no explicit column template, a repeat() template, colspans or uneven rows).',
  setColumnVisibility: 'Hides or shows the original column (the last visible column stays) and emits mdColumnVisibilityChange. Returns the effective visibility.',
  animateNextChange: 'Glides the rows through the next order change (FLIP), as sort and pagination events do.',
  toggle: 'md-table-row toggle(): expands or collapses an expandable row and emits mdRowExpandedChange (the source’s expanded watcher); a non-expandable row is unchanged.',
  goToPage: 'Moves to the page (clamped to the last page) and emits mdPageChange when it changes.',
  setRowsPerPage: 'Sets rows per page, returns to the first page and emits mdRowsPerPageChange, then mdPageChange.' };
function tableExampleNodes() {
  const cell = (text, extra = {}) => ({ tag: 'md-table-cell', properties: extra, children: [{ text }] });
  const row = (id, values, extra = {}) => ({ tag: 'md-table-row', properties: { id, value: id, ...extra }, children: values.map(v => cell(v)) });
  return [
    { tag: 'md-table-head', properties: {}, children: [{ tag: 'md-table-row', properties: {}, children: [
      { tag: 'md-table-cell', properties: { head: true }, children: [{ tag: 'md-table-sort-label', properties: { column: 'name' }, children: [{ text: 'Project' }] }] },
      cell('Status', { head: true }), cell('Members', { head: true, numeric: true })] }] },
    { tag: 'md-table-body', properties: {}, children: [
      { ...row('awc-native', ['AWC Native', 'In progress', '8'], { expandable: true }), children: [...row('awc-native', ['AWC Native', 'In progress', '8']).children, { text: 'Last updated today', slot: 'expanded' }] },
      row('design-tokens', ['Design tokens', 'Complete', '4']), row('playground', ['Playground', 'Review', '6'])] },
  ];
}
function tableMethodExample(tag, name, platform) {
  const swift = platform === 'swift', pager = tag === 'md-table-pagination';
  const str = text => literal(text, platform);
  let call, read = false;
  switch (name) {
    case 'getSelection': read = true; call = swift ? 'status = "\\(Int(controller.getSelection()["count"].number ?? 0)) selected"' : 'status = "${(controller.getSelection()["count"] as? Number)?.toInt() ?: 0} selected"'; break;
    case 'setSort': call = `controller.setSort(${str('name')}, ${str('desc')})`; break;
    case 'pinColumn': read = true; call = swift ? `status = controller.pinColumn(0, ${str('start')}) ?? "Not pinnable"` : `status = controller.pinColumn(0, ${str('start')}) ?: "Not pinnable"`; break;
    case 'setColumnVisibility': read = true; call = swift ? 'status = controller.setColumnVisibility(2, false) ? "Visible" : "Hidden"' : 'status = if (controller.setColumnVisibility(2, false)) "Visible" else "Hidden"'; break;
    case 'toggle': call = `controller.toggleRow(${str(swift ? 'example-1-0' : 'awc-native')})`; break;
    case 'goToPage': call = 'pagination.goToPage(2)'; break;
    case 'setRowsPerPage': call = 'pagination.setRowsPerPage(25)'; break;
    default: call = `controller.${name}()`;
  }
  const properties = pager ? { count: 87, rowsPerPage: 10, showFirstLast: true } : { label: 'Projects', selection: 'multiple', columnTemplate: '2fr 1fr 1fr' };
  const body = componentCode(pager ? 'md-table-pagination' : 'md-table', swift ? properties : { id: pager ? 'md-table-pagination' : 'md-table', ...properties }, platform, { children: pager ? [] : tableExampleNodes() });
  const label = str(tableMethodLabels[name]);
  const state = (swift ? (pager ? 'private let pagination = AWCTablePaginationController()' : 'private let controller = AWCTableController()') + (read ? '\n@State private var status = ""' : '')
    : (pager ? 'val pagination = remember { AWCTablePaginationController() }' : 'val controller = remember { AWCTableController() }') + (read ? '\nvar status by remember { mutableStateOf("") }' : ''));
  return {
    description: `Call ${name}() on the mounted native ${pager ? 'pagination through its AWCTablePaginationController' : `table through its AWCTableController${tag === 'md-table-row' ? ' (row methods take the row id)' : ''}`}.`,
    code: swift
      ? swiftExample(`VStack {\n    Button(${label}) { ${call} }\n${indent(body)}\n    .${pager ? 'awcTablePaginationController(pagination' : 'awcTableController(controller'}, for: ${str(pager ? 'md-table-pagination' : 'md-table')})${read ? '\n    Text(status)' : ''}\n}`, state)
      : androidExample(`Column {\n    Button(onClick = { ${call} }) { Text(${label}) }\n    AWCTableControllerScope(${pager ? `emptyMap(), mapOf(${str('md-table-pagination')} to pagination)` : `mapOf(${str('md-table')} to controller)`}) {\n${indent(body, 8)}\n    }${read ? '\n    Text(status)' : ''}\n}`,
        state, ['androidx.compose.material3.Button']),
    notes: [tableMethodNotes[name], swift ? `The controller addresses the ${pager ? 'pagination' : 'table'} whose node id matches; AWCNativeView(tag:) uses the tag as its id${tag === 'md-table-row' ? ', and child rows get the generated ids shown (example-1-0 is the first body row)' : ''}.`
      : `The controller attaches to the ${pager ? 'pagination' : 'table'} whose id property matches${tag === 'md-table-row' ? '; toggleRow takes the row’s id property' : ''}.`],
  };
}
// md-rating: focusRating() through its public native controller.
function srMethodExample(tag, name, platform) {
  const swift = platform === 'swift';
  const body = componentCode(tag, { value: 3, ratingLabel: 'Rating' }, platform);
  return {
    description: 'Call focusRating() on the mounted native rating through its AWCRatingController.',
    code: swift
      ? swiftExample(`VStack {\n    Button(${literal('Focus rating', platform)}) { controller.focusRating() }\n${indent(body)}\n    .awcRatingController(controller)\n}`,
        '@State private var controller = AWCRatingController()')
      : androidExample(`Column {\n    Button(onClick = { controller.focusRating() }) { Text(${literal('Focus rating', platform)}) }\n    AWCRatingControllerScope(controller) {\n${indent(body, 8)}\n    }\n}`,
        'val controller = remember { AWCRatingController() }', ['androidx.compose.material3.Button']),
    notes: ['Moves keyboard focus to the rating, like the source focusing its slider row (.md-rating__items); a readonly rating is not focusable.',
      swift ? 'The controller binds to the nearest rating below the modifier.' : 'The controller binds to the rating inside its scope.'],
  };
}
// md-stepper: next() / prev() / goTo(index) / reset() through its public native controller.
function stepperMethodExample(tag, name, platform) {
  const swift = platform === 'swift';
  const call = name === 'goTo' ? 'goTo(2)' : `${name}()`;
  const label = { next: 'Next step', prev: 'Previous step', goTo: 'Go to review', reset: 'Start over' }[name];
  const children = ['Account', 'Workspace', 'Review'].map(title => ({ tag: 'md-step', properties: { label: title } }));
  const stepper = componentCode(tag, { mode: 'non-linear' }, platform, { children });
  const notes = {
    next: 'next() moves to the next enabled step (mdBeforeChange, cancelable, then mdStepChange; earlier steps auto-complete); on the last step it completes it and emits mdComplete.',
    prev: 'prev() moves to the previous enabled step (mdBeforeChange, cancelable, then mdStepChange); going back clears the completion of the steps from there on unless the step is editable and completed.',
    goTo: 'goTo(index) jumps to a step the mode allows (linear: earlier steps or one whose earlier steps are completed, optional or disabled), with the same events.',
    reset: 'reset() clears every step\'s completed and error state and returns to the first step (mdStepChange when the step changes).',
  };
  return {
    description: `Call ${call} on the mounted native stepper through its AWCStepperController.`,
    code: swift
      ? swiftExample(`VStack(alignment: .leading) {\n    Button(${literal(label, platform)}) { controller.${call} }\n${indent(stepper)}\n        .awcStepperController(controller)\n}`,
        'private let controller = AWCStepperController()')
      : androidExample(`Column {\n    Button(onClick = { controller.${call} }) { Text(${literal(label, platform)}) }\n    AWCStepperControllerScope(controller) {\n${indent(stepper, 8)}\n    }\n}`,
        'val controller = remember { AWCStepperController() }', ['androidx.compose.material3.Button']),
    notes: [notes[name], swift ? 'The controller binds to the nearest stepper below the modifier.' : 'The controller binds to the stepper inside its scope.'],
  };
}
// ---- md-number-field: the method controller (focus, selection, stepping, constraint validation) and the field part.
const numberFieldMethodLabels = { setFocus: 'Focus', select: 'Select all', stepUp: 'Step up', stepDown: 'Step down', getValidity: 'Read validity',
  checkValidity: 'Check', reportValidity: 'Report', setCustomValidity: 'Set a custom error' };
const numberFieldMethodNotes = {
  setFocus: 'Focuses the native input.',
  select: 'Focuses the input and selects its text; the value does not change.',
  stepUp: 'Adds step × max(1, times) to the typed or committed value (snapping when snapOnStep is set), clamps to min/max and commits it: mdInput and mdChange with reason "none".',
  stepDown: 'Subtracts step × max(1, times) from the typed or committed value (snapping when snapOnStep is set), clamps to min/max and commits it: mdInput and mdChange with reason "none".',
  getValidity: 'Returns { valid, validationMessage, flags }: customError from setCustomValidity(), else valueMissing for an empty required field (errorText or valueMissingLabel).',
  checkValidity: 'Returns the validity without presenting it; a disabled or read-only field is barred from validation and returns true.',
  reportValidity: 'Like checkValidity(), but an invalid field shows its message in its error state and takes focus.',
  setCustomValidity: 'A non-empty message marks the field invalid (customError) until it is cleared with an empty string; validity changes emit mdValidityChange.' };
function numberFieldMethodExample(name, platform) {
  const swift = platform === 'swift', label = numberFieldMethodLabels[name];
  const read = ['getValidity', 'checkValidity', 'reportValidity'].includes(name);
  const call = name === 'setCustomValidity' ? 'controller.setCustomValidity("Choose at most 8 guests.")'
    : name === 'getValidity' ? 'status = controller.getValidity().validationMessage'
    : ['stepUp', 'stepDown'].includes(name) ? `controller.${name}(${swift ? '5' : '5.0'})`
    : read ? (swift ? `status = controller.${name}() ? "Valid" : "Invalid"` : `status = if (controller.${name}()) "Valid" else "Invalid"`)
    : `controller.${name}()`;
  const body = componentCode('md-number-field', { label: 'Guests', min: 0, max: 20, required: true }, platform);
  return {
    description: `Call ${name}() on the mounted native number field through its AWCNumberFieldController.`,
    code: swift
      ? swiftExample(`VStack {\n    Button(${literal(label, platform)}) { ${call} }\n${indent(body)}\n    .awcNumberFieldController(controller, for: "md-number-field")${read ? '\n    Text(status)' : ''}\n}`,
        `private let controller = AWCNumberFieldController()${read ? '\n@State private var status = ""' : ''}`)
      : androidExample(`Column {\n    Button(onClick = { ${call} }) { Text(${literal(label, platform)}) }\n    AWCNumberFieldControllerScope(controller) {\n${indent(body, 8)}\n    }${read ? '\n    Text(status)' : ''}\n}`,
        `val controller = remember { AWCNumberFieldController() }${read ? '\nvar status by remember { mutableStateOf("") }' : ''}`, ['androidx.compose.material3.Button']),
    notes: [numberFieldMethodNotes[name], swift ? 'The controller addresses the field whose node id matches; AWCNativeView(tag:) uses the tag as its id. Without an id it attaches to every descendant number field.'
      : 'The controller attaches to the number fields inside its scope.'],
  };
}
function numberFieldPartExample(name, platform) {
  if (name !== 'field') return null;
  const swift = platform === 'swift';
  let body = componentCode('md-number-field', { label: 'Quantity', value: 3, min: 0, max: 10 }, platform);
  body = swift ? `${body}\n.awcTextFieldAppearance(.init(containerColor: ${literal('#FFF59D', platform)}, labelColor: ${literal('#1A237E', platform)}), for: "md-number-field")`
    : `AWCTextFieldAppearanceScope(AWCTextFieldAppearance(containerColor = ${literal('#FFF59D', platform)}, labelColor = ${literal('#1A237E', platform)})) {\n${indent(body)}\n}`;
  return {
    status: 'native-equivalent', description: 'The field part is the inner md-text-field: style it with the text field hooks, which reach the composed field as the --md-text-field-* custom properties do.',
    code: swift ? swiftExample(body) : androidExample(body),
    notes: ['Native views do not interpret CSS ::part() selectors. The number field passes the text field appearance in scope (and the one targeted at its own id) to its inner field; the inline steppers keep the number field hooks (stepper color and icon size).'],
  };
}
// ---- md-otp-field: the method controller (focus, clear, constraint validation) and the parts through the hooks / slot.
const otpFieldMethodLabels = { setFocus: 'Focus', clear: 'Clear', getValidity: 'Read validity', setCustomValidity: 'Set a custom error', checkValidity: 'Check', reportValidity: 'Report' };
const otpFieldMethodNotes = {
  setFocus: 'Focuses the first empty cell (the last cell when the code is complete).',
  clear: 'Clears the code without mdInput or mdChange (programmatic writes stay silent).',
  getValidity: 'Returns { valid, validationMessage, flags }: customError from setCustomValidity(), else valueMissing for an empty required code (valueMissingLabel) or a started incomplete one (incompleteLabel).',
  setCustomValidity: 'A non-empty message marks the field invalid (customError) until it is cleared with an empty string; validity changes emit mdValidityChange.',
  checkValidity: 'Returns the validity without presenting it; a disabled or read-only field is barred from validation and returns true.',
  reportValidity: 'Like checkValidity(), but an invalid field shows its message in its error state and focuses the first empty cell.' };
function otpFieldMethodExample(name, platform) {
  const swift = platform === 'swift', label = otpFieldMethodLabels[name];
  const read = ['getValidity', 'checkValidity', 'reportValidity'].includes(name);
  const call = name === 'setCustomValidity' ? 'controller.setCustomValidity("This code has expired.")'
    : name === 'getValidity' ? 'status = controller.getValidity().validationMessage'
    : read ? (swift ? `status = controller.${name}() ? "Valid" : "Invalid"` : `status = if (controller.${name}()) "Valid" else "Invalid"`)
    : `controller.${name}()`;
  const body = componentCode('md-otp-field', { label: 'Verification code', required: true, incompleteLabel: 'Enter all six digits.' }, platform);
  return {
    description: `Call ${name}() on the mounted native OTP field through its AWCOTPFieldController.`,
    code: swift
      ? swiftExample(`VStack {\n    Button(${literal(label, platform)}) { ${call} }\n${indent(body)}\n    .awcOTPFieldController(controller, for: "md-otp-field")${read ? '\n    Text(status)' : ''}\n}`,
        `private let controller = AWCOTPFieldController()${read ? '\n@State private var status = ""' : ''}`)
      : androidExample(`Column {\n    Button(onClick = { ${call} }) { Text(${literal(label, platform)}) }\n    AWCOTPFieldControllerScope(controller) {\n${indent(body, 8)}\n    }${read ? '\n    Text(status)' : ''}\n}`,
        `val controller = remember { AWCOTPFieldController() }${read ? '\nvar status by remember { mutableStateOf("") }' : ''}`, ['androidx.compose.material3.Button']),
    notes: [otpFieldMethodNotes[name], swift ? 'The controller addresses the field whose node id matches; AWCNativeView(tag:) uses the tag as its id. Without an id it attaches to every descendant OTP field.'
      : 'The controller attaches to the OTP fields inside its scope.'],
  };
}
const otpFieldPartValues = { cells: { cellGap: 14 }, cell: { cellWidth: 52, cellHeight: 64, cellShape: 16, outlineColor: '#1565C0', focusColor: '#C62828', fontSize: 30 } };
const otpFieldPartOrder = ['cellGap', 'cellHeight', 'cellShape', 'cellWidth', 'focusColor', 'fontSize', 'outlineColor'];
function otpFieldPartExample(name, platform) {
  const swift = platform === 'swift';
  if (name === 'separator') return { status: 'native-equivalent', description: 'The separator is the separator slot (first gap) or the built-in dot, which takes the outline colour hook.', code: null,
    notes: ['Native views do not interpret CSS ::part() selectors. Author the separator content in the separator slot; the dots of later gaps follow --md-otp-field-outline-color (outlineColor).'] };
  if (name === 'supporting-text') return { status: 'native-equivalent', description: 'The supporting text follows the theme roles (on-surface-variant, error); it has no hook of its own.', code: null,
    notes: ['Native views do not interpret CSS ::part() selectors. The supporting text uses the theme\'s on-surface-variant and error colours, as the source does.'] };
  const values = otpFieldPartValues[name];
  if (!values) return null;
  const separator = swift ? ': ' : ' = ';
  const fields = otpFieldPartOrder.filter(key => Object.hasOwn(values, key)).map(key => `${key}${separator}${literal(values[key], platform)}`).join(', ');
  let body = componentCode('md-otp-field', { label: 'Code', value: '123' }, platform);
  body = swift ? `${body}\n.awcOTPFieldAppearance(.init(${fields}))` : `AWCOTPFieldAppearanceScope(AWCOTPFieldAppearance(${fields})) {\n${indent(body)}\n}`;
  return {
    status: 'native-equivalent', description: `Style the OTP field's ${name} part through its typed native appearance.`,
    code: swift ? swiftExample(body) : androidExample(body),
    notes: ['Native views do not interpret CSS ::part() selectors. The hooks are the source\'s own per-instance custom properties.'],
  };
}
function eventExample(component, name, platform, policy) {
  if (nativeTooltipLifecycleSupported(component, platform)) return tooltipExample(platform, { event: name });
  if (component.tag === 'md-accordion' || component.tag === 'md-accordion-item' && ['mdItemRequestFocus', 'mdItemRequestReorder'].includes(name)) return accordionEventExample(name, platform);
  if (component.tag === 'md-snackbar' && has(policy.methods, 'show') && has(policy.methods, 'hide') && !has(policy.unsupportedMethods, 'show') && !has(policy.unsupportedMethods, 'hide')) return snackbarExample(platform, { event: name });
  if (component.tag === 'md-progress-indicator' && name === 'mdComplete') return progressCompletionEvent(platform);
  if (menuFamily(component.tag, policy)) return menuExample(platform, { event: name });
  if (component.tag === 'md-fab-menu' && has(policy.properties, 'anchor')) return fabMenuExample(platform, { event: name });
  if (component.tag === 'md-fab' && name === 'mdClick') return fabActivationEvent(platform);
  if (component.tag === 'md-button-group' && name === 'mdSelectionChange') return groupSelectionEvent(component, platform, policy);
  if (component.tag === 'md-button' && ['mdClick', 'mdChange'].includes(name)) return buttonEvent(name, platform);
  if (component.tag === 'md-card' && ['mdClick', 'mdDragStart', 'mdDragMove', 'mdDragEnd'].includes(name)) return cardEventExample(name, platform);
  if (component.tag === 'md-avatar' && ['mdLoad', 'mdError'].includes(name)) return avatarEventExample(name, platform);
  if (Object.hasOwn(modalTypes, component.tag) && ['mdOpen', 'mdClose', 'mdCancel', 'mdBack'].includes(name)) return modalEventExample(component.tag, name, platform, policy);
  if (component.tag === 'md-list' && ['mdSelect', 'mdActivate', 'mdReorder'].includes(name) || component.tag === 'md-list-item' && ['mdClick', 'mdExpand'].includes(name)) return listEventExample(component.tag, name, platform);
  const contract = stateContract(component.tag, name, platform, policy);
  if (contract) {
    const example = controlledEvent(component, name, platform, policy, contract);
    if (component.tag === 'md-icon-button' && name === 'mdClick') example.notes.push('mdClick observes the committed selected state. Navigation and toggle occur before this event; canceling it cannot undo those effects. Its detail contains selected only.');
    if (component.tag === 'md-split-button' && name === 'mdTrailingClick') {
      example.description = 'Observe the committed trailing checked state and retain it in application state.';
      example.notes.push('The control updates trailingChecked before emitting { checked }. Canceling this notification cannot undo that state. It does not automatically open a menu; application popup state is separate.');
    }
    if (component.tag === 'md-segmented-button' && name === 'mdSegmentClick') {
      example.description = 'Explicitly accept a standalone segment’s proposed selected state in application state.';
      example.notes.push('The segment emits { value, selected } without changing its own selected property. This example commits the proposal by assigning the application state. Inside a set, the parent commits by child identity, stops propagation and emits mdChange; cancellation does not veto that commit.');
    }
    return example;
  }
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

// ---- Card: verified renderer APIs (drag gesture, activation payload, typed parts).
const cardPayloads = {
  mdClick: 'The detail reports type, isTrusted, button, detail, clientX and clientY. A pointer click is trusted with detail 1 at its client point; Enter/Space on the card is untrusted with detail 0 at (0, 0). Activating authored content inside the card also reaches the card, as in the source.',
  mdDragStart: 'Drag starts once the pointer has moved 5 points (Manhattan distance) and is immediately followed by mdDragMove with the same detail: clientX, clientY, offsetX, offsetY, startX and startY in viewport points.',
  mdDragMove: 'Each move reports clientX, clientY, offsetX, offsetY, startX and startY in viewport points; the card follows the pointer physically, also in right-to-left layouts.',
  mdDragEnd: 'End follows only a started drag; that release produces no mdClick. Disabling the card, turning dragEnabled off or removing it cancels silently.',
};
function cardEventExample(name, platform) {
  const drag = name !== 'mdClick';
  const handler = platform === 'swift'
    ? `guard event.name == ${literal(name, platform)} else { return }\nlastPayload = event.detail.json`
    : `if (name == ${literal(name, platform)}) {\n    lastPayload = detail?.toString() ?: "null"\n}`;
  const body = componentCode('md-card', drag ? { dragEnabled: true } : { interactive: true }, platform, { handler, children: [{ text: drag ? 'Drag this card' : 'Open project' }] });
  return {
    description: `Handle ${name} from a ${drag ? 'drag-enabled' : 'interactive'} card and display its native payload in application state.`,
    code: platform === 'swift'
      ? swiftExample(`VStack {\n${indent(body)}\n    Text(lastPayload)\n}`, '@State private var lastPayload = "No event received yet."')
      : androidExample(`Column {\n${indent(body)}\n    Text(lastPayload)\n}`, 'var lastPayload by remember { mutableStateOf("No event received yet.") }'),
    notes: [cardPayloads[name], 'The callback exposes native JSON-shaped data; no DOM MouseEvent object is created.'],
  };
}

function cardPartExample(name, platform) {
  const separator = platform === 'swift' ? ': ' : ' = ';
  const fields = name === 'outline' ? `outlineColor${separator}"#006A6A", outlineWidth${separator}2.0` : name === 'state-layer' ? `stateLayerColor${separator}"#006A6A"` : null;
  if (!fields) return null;
  let body = componentCode('md-card', name === 'outline' ? { variant: 'outlined', interactive: true } : { interactive: true }, platform, { children: [{ text: 'Open project' }] });
  body = platform === 'swift' ? `${body}\n.awcCardPartAppearance(.init(${fields}))` : `AWCCardPartAppearanceScope(AWCCardPartAppearance(${fields})) {\n${indent(body)}\n}`;
  return {
    status: 'native-equivalent', description: `Style the card's ${name} part through its public typed native appearance API.`,
    code: platform === 'swift' ? swiftExample(body) : androidExample(body),
    notes: ['Native views do not interpret CSS ::part() selectors. Part values win over the hooks and state rules, as outer-tree ::part() rules do.',
      name === 'outline' ? 'The outline is drawn above the content on the outlined variant only.' : 'The state layer shows for interactive and drag-enabled cards; soft-disabled cards hide it.'],
  };
}

function nativePayloadNote(tag, name, platform) {
  if (tag === 'md-split-button' && name === 'mdLeadingClick') return 'The leading notification has null detail. It is independent of the trailing checked state and does not create or open a menu.';
  if (tag === 'md-fab' && name === 'mdClick') return 'The native callback reports the native activation data. It does not fabricate a DOM MouseEvent or selected state; disabled and soft-disabled FABs block activation.';
  if (['md-line-chart', 'md-area-chart', 'md-bar-chart', 'md-pie-chart', 'md-sparkline'].includes(tag)) {
    if (name === 'mdReady') return 'The native ready notification has no payload. It describes the native view lifecycle, not a web chart-engine instance.';
    if (name === 'mdLegendClick') return 'The native legend payload identifies the affected series or slice and its selected state. Native chart interactions do not expose a web chart-engine event.';
    return platform === 'swift' ? 'Native point/slice clicks include dataIndex, seriesIndex, value and source series data; Cartesian charts also include seriesId. No DOM pointer event is included.' : 'Native point/slice clicks include dataIndex, seriesIndex, value and label. The Android hit-testing payload differs from the web chart detail.';
  }
  if (tag === 'md-button-group' && name === 'mdSelectionChange') return 'The native payload contains values, added and removed arrays. Selection is stored on the children; use unique child values when application code needs stable identifiers.';
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
  if (component.tag === 'md-avatar' && name === '') return avatarSlotExample(platform);
  const tag = component.tag;
  if (nativeTooltipLifecycleSupported(component, platform)) return tooltipSlotExample(name, platform);
  if (tag === 'md-snackbar' && nativeSnackbarLifecycleSupported(component, platform)) return snackbarSlotExample(name, platform);
  if (menuFamily(tag, policy) && ['', 'submenu'].includes(name)) return menuExample(platform);
  if (tag === 'md-fab-menu' && name === '' && has(policy.properties, 'anchor')) return fabMenuExample(platform);
  let properties = sampleProperties(tag, policy);
  let child = name === '' && structuralChild[tag] ? structuralChild[tag] : { text: name ? `${name} content` : 'Example content' };
  if (tag === 'md-button') {
    properties = name === 'loader' ? { loading: true } : {};
    child = name === 'loader'
      ? { tag: 'md-progress-indicator', properties: { variant: 'circular', indeterminate: true, size: 24 } }
      : name === 'leading-icon' || name === 'trailing-icon'
        ? { symbol: name === 'leading-icon' ? 'favorite' : 'arrow_forward' }
        : { text: 'Continue' };
  }
  if (tag === 'md-badge') { properties = { variant: 'large', value: '8', icon: 'notifications' }; child = { symbol: 'priority_high' }; }
  if (tag === 'md-fab') {
    properties = { label: 'Create', icon: 'add' };
    child = { symbol: 'edit' };
  }
  if (tag === 'md-fab-menu-item') {
    properties = name === 'icon' ? { label: 'New document', icon: 'edit' } : {};
    child = name === 'icon' ? { symbol: 'description' } : { text: 'New document' };
  }
  if (tag === 'md-icon-button') {
    properties = { 'aria-label': 'Save to favorites', ...(name === 'selected' ? { toggle: true, selected: true } : {}) };
    child = { symbol: name === 'selected' ? 'favorite' : 'favorite_border' };
  }
  if (tag === 'md-split-button') { properties = { label: 'Create', icon: 'add' }; child = { text: ' project' }; }
  if (tag === 'md-segmented-button') {
    properties = name ? { label: 'Week', value: 'week', icon: 'calendar_month' } : { value: 'week' };
    child = name ? { symbol: 'favorite' } : { text: 'Week' };
  }
  if (name === 'expanded-content' || name === 'expanded') properties = { ...properties, ...(has(policy.properties, 'expanded') ? { expanded: true } : {}), ...(has(policy.properties, 'expandable') ? { expandable: true } : {}) };
  if (name === 'selected-icon' && has(policy.properties, 'selected')) properties.selected = true;
  if (name === 'unselected-icon' && has(policy.properties, 'selected')) properties.selected = false;
  if (['loader', 'loading'].includes(name) && has(policy.properties, 'loading')) properties.loading = true;
  if (name === 'empty') {
    for (const property of ['series', 'data', 'nodes']) if (has(policy.properties, property)) properties[property] = [];
    if (has(policy.properties, 'empty')) properties.empty = true;
  }
  const children = name === '' && !['md-button', 'md-icon-button', 'md-fab-menu-item', 'md-segmented-button', 'md-split-button'].includes(tag) ? sampleChildren(tag, policy) : [{ ...child, ...(name ? { slot: name } : {}) }];
  if (tag === 'md-button' && name) children.unshift({ text: name === 'loader' ? 'Saving' : 'Continue' });
  const componentBody = componentCode(tag, properties, platform, { children });
  const body = tag === 'md-badge' ? badgeContext(componentBody, platform) : componentBody;
  return {
    description: `Supply ${name ? `“${name}”` : 'default'} content using ${platform === 'swift' ? 'AWCNode children' : 'the native Compose slot callback'}.`,
    code: platform === 'swift' ? swiftExample(body) : androidExample(body, '', tag === 'md-badge' ? badgeImports : []),
    notes: [platform === 'swift' ? 'AWCNode.slot assigns a child to a named location. Omit slot for default content.' : 'The content callback receives the requested slot name. The empty string identifies default content; compose content only for matching names.',
      ...(tag === 'md-segmented-button' ? [name ? 'The named icon slot is additional to the built-in property icon or reserved checkmark. Both graphics remain present; selected swaps only the built-in graphic.' : 'Default content supplies the label only when the label property is empty. Initial non-whitespace content determines whether the label wrapper exists.'] : tag === 'md-fab' ? ['The named icon slot replaces the authored icon fallback. Temporary setMenuIcon presentation hides this content without deleting it; clearing the method override reveals the slot again.'] : tag === 'md-button-group' ? ['Supply md-button or md-icon-button children, retaining their own content, values and initial selected state. The group applies toggle, size and shape to its selectable descendants.'] : tag === 'md-icon-button' ? ['Material Symbols inherit the icon button’s measured icon size and color.', name === 'selected' ? 'Enable toggle and selected to show this slot. Without selected content, the default icon remains visible.' : 'Default icon content replaces the icon-property fallback; badge adornments do not suppress it.'] : tag === 'md-button' ? [name === 'loader' ? 'loading must be true to display loader content; supplied content replaces the built-in loader.' : name ? 'Provided slot content replaces the corresponding icon-property fallback.' : 'Default children supply the visible button label.'] : ['Some content is visible only in the component’s open, expanded, loading or active state.'])],
  };
}

const appearanceForPart = {
  anchor: { containerColor: '#6750A4', labelColor: '#FFFFFF', cornerRadius: 12 },
  // ::part(state-layer) { opacity } fixes the layer in every state: stateLayerOpacity (the per-state opacities are hooks).
  'state-layer': { stateLayerColor: '#6750A4', stateLayerOpacity: 0.12 },
  icon: { iconColor: '#006A6A', iconSize: 24 },
  label: { labelColor: '#4F378B', fontSize: 16, fontWeight: 600, lineHeight: 24, letterSpacing: 0.2 },
  'trailing-icon': { trailingIconColor: '#006A6A', trailingIconSize: 24 },
  loading: { loadingColor: '#006A6A', loadingSize: 24 },
};

function appearanceExample(tag, name, platform, policy) {
  if (tag === 'md-tooltip') return tooltipPartExample(name, platform);
  if (tag === 'md-card') return cardPartExample(name, platform);
  if (tag === 'md-snackbar') {
    const values = {
      surface: { backgroundColor: '#313033CC', borderColor: '#FFAA33', borderWidth: 2, cornerShape: parseCornerShape('12px') },
      message: { color: '#FEDCBA', fontWeight: 700 },
      actions: { paddingInlineStart: 13 }, close: { marginInlineStart: 7 }, 'close-icon': { color: '#22CC99' },
    }[name];
    if (!values) return null;
    const part = name === 'close-icon' ? 'closeIcon' : name;
    const partCase = platform === 'swift' ? `.${part}` : `AWCSnackbarPart.${part[0].toUpperCase()}${part.slice(1)}`;
    let body = componentCode(tag, { open: true, autoHide: false, message: 'Changes saved', action: 'Undo', closeable: true }, platform);
    const fields = Object.entries(values).map(([key, value]) => `${key}${platform === 'swift' ? ': ' : ' = '}${key === 'cornerShape' ? cornerShapeNativeValue(value, platform) : typeof value === 'string' ? literal(value, platform) : platform === 'android' && key !== 'fontWeight' ? value.toFixed(1) : value}`).join(', ');
    body = platform === 'swift' ? `${body}\n.awcSnackbarPartAppearance(.init(${fields}), part: ${partCase})`
      : `AWCSnackbarPartAppearanceScope(AWCSnackbarPartAppearance(${fields}), part = ${partCase}) {\n${indent(body)}\n}`;
    body = nativeSnackbarContext(body, platform);
    return {
      status: 'native-equivalent', description: `Style the actual ${name} part through its public typed native appearance API.`,
      code: platform === 'swift' ? swiftExample(body) : androidExample(body, '', skeletonImports),
      notes: ['The example supplies a real overlay viewport. Native views do not interpret CSS ::part() selectors.',
        'These typed fields preserve the demonstrated source part effects. Authored slot content retains its own modifiers and callbacks; close-icon targets the fallback close graphic.'],
    };
  }
  if (tag === 'md-skeleton' && ['shape', 'line', 'line-last'].includes(name)) {
    const part = name === 'line-last' ? 'lineLast' : name;
    const partCase = platform === 'swift' ? `.${part}` : `AWCSkeletonPart.${part[0].toUpperCase()}${part.slice(1)}`;
    const separator = platform === 'swift' ? ': ' : ' = ';
    const values = name === 'line-last'
      ? `width${separator}AWCSkeletonLength(fraction${separator}0.4), cornerShape${separator}AWCCornerShape()`
      : `color${separator}"#006A6A80", height${separator}AWCSkeletonLength(points${separator}${name === 'shape' ? '48.0' : '12.0'})`;
    let body = componentCode(tag, { variant: name === 'shape' ? 'rounded' : 'text', lines: 3, animation: 'wave', fullWidth: true }, platform);
    body = platform === 'swift' ? `${body}\n.awcSkeletonPartAppearance(.init(${values}), part: ${partCase})`
      : `AWCSkeletonPartAppearanceScope(AWCSkeletonPartAppearance(${values}), part = ${partCase}) {\n${indent(body)}\n}`;
    body = skeletonContext(body, platform);
    return {
      status: 'native-equivalent',
      description: `Style the measured ${name} using the public native part appearance API.`,
      code: platform === 'swift' ? swiftExample(body) : androidExample(body, '', skeletonImports),
      notes: ['This part scope is separate from the eleven shared component hooks. Line styles affect every row; line-last styles merge afterward only on the tapered final row.', 'Lengths retain parent/font-relative terms. The example uses a definite260×160 parent and the default16-unit bundled Roboto sizing context. Changing the native font requires an explicit sizing context with its actual font metrics.'],
    };
  }

  if (tag === 'md-progress-indicator') {
    const values = {
      'active-indicator': { activeIndicatorColor: '#006A6A80' },
      track: { trackColor: '#D0E8E5' },
      'stop-indicator': { stopIndicatorColor: '#4F378B', stopIndicatorSize: 6, stopIndicatorTrailingSpace: 2 },
    }[name];
    if (!values || Object.keys(values).some(key => !has(policy.appearance?.fields, key))) return null;
    const body = meterContext(componentCode(tag, { value: 64, variant: 'linear', wave: false, label: 'Upload progress' }, platform), platform);
    const fields = Object.entries(values).map(([key, value]) => `${key}${platform === 'swift' ? ': ' : ' = '}${typeof value === 'string' ? literal(value, platform) : `${value}.0`}`).join(', ');
    return {
      status: 'native-equivalent',
      description: `Customize the measured ${name} visual through the public Progress appearance API.`,
      code: platform === 'swift' ? swiftExample(`${body}\n.awcProgressIndicatorAppearance(.init(${fields}))`)
        : androidExample(`AWCProgressIndicatorAppearanceScope(AWCProgressIndicatorAppearance(${fields})) {\n${indent(body)}\n}`, '', meterImports),
      notes: ['These native appearance hooks style the real part; native views do not interpret CSS ::part() selectors.',
        'The stop is present on determinate linear indicators. The flat example keeps the active and track surfaces visible; circular and wavy paths use stroke geometry instead of CSS corner shapes.'],
    };
  }
  if (tag === 'md-meter') {
    const values = {
      track: { trackColor: '#D0E8E580', height: 8 },
      indicator: { indicatorColor: '#006A6A' },
      label: { labelColor: '#4F378B' },
      value: { valueColor: '#006A6A' },
      circular: { size: 72 },
    }[name];
    if (!values || Object.keys(values).some(key => !has(policy.appearance?.fields, key))) return null;
    const body = meterContext(componentCode(tag, { value: 72, showLabel: true, showValue: true, label: 'Storage used', ...(name === 'circular' ? { variant: 'circular' } : {}) }, platform), platform);
    const fields = Object.entries(values).map(([key, value]) => `${key}${platform === 'swift' ? ': ' : ' = '}${typeof value === 'string' ? literal(value, platform) : `${value}.0`}`).join(', ');
    return {
      status: 'native-equivalent',
      description: `Customize the measured ${name} visual through the public Meter appearance API.`,
      code: platform === 'swift' ? swiftExample(`${body}\n.awcMeterAppearance(.init(${fields}))`)
        : androidExample(`AWCMeterAppearanceScope(AWCMeterAppearance(${fields})) {\n${indent(body)}\n}`, '', meterImports),
      notes: ['Native appearance is a visual equivalent; native views do not interpret CSS ::part() selectors.',
        'The label and value render only when their respective show properties are enabled. The circular part exists only for variant=circular.',
        'Track and indicator colors affect both variants. Height and track corners apply to linear tracks; size changes the circular diameter. Colors accept #RRGGBB or #RRGGBBAA.'],
    };
  }
  if (tag === 'md-loading-indicator' && name === 'shape') {
    const body = componentCode(tag, { label: 'Loading workspace' }, platform);
    return {
      status: 'native-equivalent',
      description: 'Set the measured shape box and fill through the native shape appearance scope.',
      code: platform === 'swift'
        ? swiftExample(`${body}\n.awcLoadingIndicatorShapeAppearance(.init(width: 20, height: 30, color: "#6750A4"))`)
        : androidExample(`AWCLoadingIndicatorShapeAppearanceScope(AWCLoadingIndicatorShapeAppearance(width = 20.0, height = 30.0, color = "#6750A4")) {\n${indent(body)}\n}`),
      notes: ['This public native scope corresponds to the shape visual; it is separate from the five component appearance hooks.', 'The source animation remains active. Container clipping and horizontal flex shrink still apply.'],
    };
  }
  const split = tag === 'md-split-button', badge = tag === 'md-badge', icon = tag === 'md-icon-button', fab = tag === 'md-fab', item = tag === 'md-fab-menu-item', divider = tag === 'md-divider', segment = tag === 'md-segmented-button';
  const examples = split ? { leading: { containerColor: '#6750A4', cornerRadius: 12 }, trailing: { containerColor: '#6750A4', cornerRadius: 12 }, icon: { iconColor: '#006A6A', iconSize: 24 }, label: { labelColor: '#4F378B' }, 'trailing-icon': { labelColor: '#006A6A' } } : badge ? { label: { labelColor: '#4F378B' }, icon: { iconColor: '#006A6A', iconSize: 12 } } : item ? { 'state-layer': { labelColor: '#006A6A' }, icon: { iconColor: '#006A6A', iconSize: 24 }, label: { labelColor: '#4F378B' } } : segment ? { 'state-layer': { labelColor: '#006A6A', selectedLabelColor: '#FFFFFF' }, checkmark: { selectedLabelColor: '#006A6A', iconSize: 20 }, icon: { labelColor: '#006A6A', iconSize: 20 }, label: { labelColor: '#4F378B', selectedLabelColor: '#FFFFFF' } } : divider ? { divider: { color: '#006A6A', thickness: 2, insetStart: 24, insetEnd: 12 } } : fab ? { icon: { iconColor: '#006A6A', iconSize: 28 }, label: { labelColor: '#4F378B' }, 'state-layer': { iconColor: '#006A6A' } } : icon ? { icon: { iconColor: '#006A6A', iconSize: 24 }, 'selected-icon': { iconColor: '#006A6A', iconSize: 24 }, 'state-layer': { stateLayerColor: '#6750A4' } } : appearanceForPart;
  const appearance = Object.fromEntries(Object.entries(examples[name] ?? {}).filter(([key]) => has(policy.appearance?.fields, key)));
  if (!Object.keys(appearance).length) return null;
  const properties = split ? { label: 'Create project', icon: 'add', size: 'md' } : badge ? { variant: 'large', value: '8', ...(name === 'icon' ? { icon: 'notifications' } : {}) } : item ? { label: 'New document', icon: 'edit' } : segment ? { label: 'Week', value: 'week', ...(name === 'checkmark' ? { selected: true } : name === 'icon' ? { icon: 'calendar_month' } : {}) } : divider ? { inset: true } : fab ? { icon: 'add', label: 'Create' } : icon ? { 'aria-label': 'Save to favorites', icon: 'favorite_border', ...(name === 'selected-icon' ? { toggle: true, selected: true, selectedIcon: 'favorite' } : {}) } : name === 'loading' ? { loading: true } : name === 'icon' ? { icon: 'favorite' } : name === 'trailing-icon' ? { trailingIcon: 'arrow_forward' } : name === 'label' || name === 'state-layer' ? { variant: 'outlined' } : {};
  const componentBody = componentCode(tag, properties, platform, { children: split || badge || icon || fab || item || divider || segment ? [] : [{ text: 'Continue' }] });
  const body = badge ? badgeContext(componentBody, platform) : componentBody;
  const { nativeType: type, swiftModifier: modifier } = componentAppearance(tag);
  const fields = Object.entries(appearance).map(([key, value]) => `${key}${platform === 'swift' ? ': ' : ' = '}${typeof value === 'string' ? literal(value, platform) : Number.isInteger(value) ? `${value}.0` : value}`).join(', ');
  return {
    status: 'native-equivalent',
    description: `Customize the native ${name === 'anchor' ? 'button surface' : name} visual using ${type}.`,
    code: platform === 'swift' ? swiftExample(`${body}\n.${modifier}(.init(${fields}))`) : androidExample(`${type}Scope(appearance = ${type}(${fields})) {\n${indent(body)}\n}`, '', badge ? badgeImports : []),
    notes: ['CSS ::part() selectors remain Web-only. These fields are a native visual equivalent, not a CSS bridge.', 'Appearance fields inherit through the subtree and local valid values override inherited values. Colors use #RRGGBB.', platform === 'swift' ? 'Dimensions use native points.' : 'Dimensions use dp; typography uses sp.', ...(split ? ['Typed appearance styles both halves together. iconColor and iconSize affect only the leading icon; the trailing glyph uses labelColor and its size-specific source dimensions. There is no independent state-layer hook, and outlined ignores containerColor.'] : []), ...(segment ? ['The built-in icon and checkmark inherit the current label ink; the state layer uses the same ink. There are no independent public icon-color or state-layer-color hooks. Selected colors apply only when selected.'] : []), ...(divider ? ['The divider part is the painted line inside the host. Insets are signed margins, activated by inset, insetStart or insetEnd. insetEnd takes precedence when multiple inset flags are true; vertical dividers apply these margins at the top and bottom.'] : []), ...(fab && name === 'state-layer' ? ['The FAB state layer uses the icon ink. There is no independent public state-layer color hook.'] : []), ...(name === 'anchor' ? ['Native navigation uses the action/router API; there is no native HTML anchor element.'] : [])],
  };
}

function fabMenuExample(platform, { method, event } = {}) {
  const children = [['edit', 'New document'], ['folder', 'New folder'], ['photo', 'Upload image']].map(([icon, label]) => ({ tag: 'md-fab-menu-item', properties: { icon, label } }));
  const handler = event ? platform === 'swift' ? `if event.name == ${literal(event, platform)} { status = ${literal(event, platform)} }` : `if (name == ${literal(event, platform)}) status = name` : undefined;
  const menu = componentCode('md-fab-menu', { anchor: 'demo-fab-anchor', placement: 'down', menuLabel: 'Create actions' }, platform, { children, handler });
  const anchor = platform === 'swift'
    ? 'AWCNativeView(node: AWCNode(id: "demo-fab-anchor", tag: "md-fab", properties: ["icon": .string("add"), "label": .string("Create")]))'
    : componentCode('md-fab', { id: 'demo-fab-anchor', icon: 'add', label: 'Create' }, platform);
  const attachedMenu = method ? platform === 'swift' ? `${menu}\n.awcFabMenuController(controller)` : `AWCFabMenuControllerScope(controller) {\n${indent(menu)}\n}` : menu;
  const scope = platform === 'swift'
    ? `AWCFabMenuScope {\n    ZStack {\n${indent(anchor + '\n' + attachedMenu, 8)}\n    }\n}\n.frame(width: 360, height: 480)`
    : `AWCFabMenuScope(modifier = Modifier.requiredSize(360.dp, 480.dp)) {\n    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {\n${indent(anchor + '\n' + attachedMenu, 8)}\n    }\n}`;
  const controls = method ? platform === 'swift'
    ? ['show', 'close', 'whenClosed'].map(name => `Button("${name}()") {\n    Task {\n        await controller.${name}()\n        status = "${name}() completed"\n    }\n}`).join('\n')
    : ['show', 'close', 'whenClosed'].map(name => `Button(onClick = {\n    coroutineScope.launch {\n        controller.${name}()\n        status = "${name}() completed"\n    }\n}) { Text("${name}()") }`).join('\n') : '';
  const hasStatus = Boolean(method || event);
  const body = hasStatus ? `${platform === 'swift' ? 'VStack' : 'Column'} {\n${indent([scope, controls, 'Text(status)'].filter(Boolean).join('\n'))}\n}` : scope;
  const state = platform === 'swift'
    ? [method && '@State private var controller = AWCFabMenuController()', hasStatus && '@State private var status = "Ready"'].filter(Boolean).join('\n')
    : [method && 'val controller = rememberAWCFabMenuController()\nval coroutineScope = rememberCoroutineScope()', hasStatus && 'var status by remember { mutableStateOf("Ready") }'].filter(Boolean).join('\n');
  return {
    status: 'supported',
    description: method ? `Invoke ${method}() through the attached native controller and observe its actual completion.` : 'Author a real FAB anchor, menu and three action children in a bounded native scope.',
    code: platform === 'swift' ? swiftExample(body, state) : androidExample(body, state, ['androidx.compose.foundation.layout.Box', 'androidx.compose.foundation.layout.requiredSize', 'androidx.compose.foundation.layout.fillMaxSize', 'androidx.compose.ui.Modifier', 'androidx.compose.ui.Alignment', 'androidx.compose.ui.unit.dp', ...(method ? ['androidx.compose.material3.Button', 'kotlinx.coroutines.launch'] : [])]),
    notes: ['The anchor is an authored sibling with a matching ID. The 360 × 480 context is this example’s layout, not a menu size restriction.', 'show() completes after committing the opening action. close() starts the close sequence; use whenClosed() to await actual closing settlement.', 'Each method button starts its own task so a pending whenClosed() does not block a later close(). Initial open does not emit mdOpen; lifecycle events have no detail payload.', 'Default-slot children are real menu items. Disabled actions do not activate; soft-disabled actions remain focusable.'],
  };
}

function fabMethodExample(platform) {
  const component = componentCode('md-fab', { icon: 'add', label: 'Create' }, platform, { children: [{ symbol: 'edit', slot: 'icon' }] });
  const body = platform === 'swift'
    ? `VStack {\n${indent(component)}\n        .awcFabController(controller)\n    Button("Show temporary close icon") {\n        Task { await controller.setMenuIcon("close") }\n    }\n    Button("Restore authored icon slot") {\n        Task { await controller.setMenuIcon(nil) }\n    }\n}`
    : `Column {\n    AWCFabControllerScope(controller) {\n${indent(component, 8)}\n    }\n    Button(onClick = { applied = controller.setMenuIcon("close") }) { Text("Show temporary close icon") }\n    Button(onClick = { applied = controller.setMenuIcon(null) }) { Text("Restore authored icon slot") }\n    Text(if (applied) "Temporary presentation applied" else "No attached FAB")\n}`;
  return {
    status: 'supported', description: 'Invoke the public native FAB controller to set or clear temporary menu icon presentation.',
    code: platform === 'swift' ? swiftExample(body, '@State private var controller = AWCFabController()')
      : androidExample(body, 'val controller = rememberAWCFabController()\nvar applied by remember { mutableStateOf(false) }', ['androidx.compose.material3.Button']),
    notes: ['Attach this controller to one FAB. The method preserves authored icon properties and slot content.', 'null (nil in Swift) or an empty string clears the override. Nonempty whitespace is not trimmed.', 'Completion means the temporary state was applied; it does not wait for the icon animation to finish.'],
  };
}

/** Anchors stay in normal flow; popups use the scope's real viewport. */
export function nativeTooltipContext(body, platform) {
  return platform === 'swift'
    ? `AWCTooltipScope {\n${indent(body)}\n}\n.frame(width: 360, height: 480)`
    : `AWCTooltipScope(modifier = Modifier.requiredSize(360.dp, 480.dp)) {\n    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {\n${indent(body, 8)}\n    }\n}`;
}
const tooltipImports = [...skeletonImports, 'androidx.compose.foundation.layout.fillMaxSize', 'androidx.compose.material3.Button'];
export function nativeTooltipLifecycleSupported(component, platform) {
  return component?.tag === 'md-tooltip' && supportsRetainedPropertyUpdates(component, platform === 'swift' ? 'ios' : platform);
}
function tooltipComponent(properties, platform, options = {}) {
  return componentCode('md-tooltip', properties, platform, { children: [{tag:'md-button',properties:{variant:'tonal'},children:[{text:'Hover or focus me'}]}], ...options });
}
function tooltipExample(platform, {event,method}={}) {
  const handler = platform === 'swift'
    ? `${event ? `guard event.name == ${literal(event,platform)} else { return }\n` : ''}lastEvent = event.name`
    : `${event ? `if (name == ${literal(event,platform)}) ` : ''}lastEvent = name`;
  let tooltip = tooltipComponent({text:'One source. Every surface.'}, platform, {handler});
  tooltip = platform === 'swift' ? `${tooltip}\n.awcTooltipController(controller)` : `AWCTooltipControllerScope(controller) {\n${indent(tooltip)}\n}`;
  const scope=nativeTooltipContext(tooltip,platform);
  const body=platform==='swift'
    ? `VStack {\n    Button("Show tooltip") { Task { await controller.show() } }\n    Button("Hide tooltip") { Task { await controller.hide() } }\n    Text(lastEvent)\n${indent(scope)}\n}`
    : `Column {\n    Button(onClick = { controller.show() }) { Text("Show tooltip") }\n    Button(onClick = { controller.hide() }) { Text("Hide tooltip") }\n    Text(lastEvent)\n${indent(scope)}\n}`;
  return {status:'supported',description:method?`Invoke the real native ${method}() on the mounted Tooltip.`:'Hover or focus the native anchor and observe actual tooltip lifecycle events.',
    code:platform==='swift'?swiftExample(body,'@State private var controller = AWCTooltipController()\n@State private var lastEvent = "No event received yet."'):androidExample(body,'val controller = rememberAWCTooltipController()\nvar lastEvent by remember { mutableStateOf("No event received yet.") }',tooltipImports),
    notes:['The real overlay scope owns placement while the anchor retains its intrinsic size. The initial recipe is plain and closed, matching Web.','show() and hide() accept no arguments and request an immediate lifecycle change; they do not wait for the visual transition. Trigger hover/focus uses showDelay and hideDelay.','mdOpen and mdClose have no detail payload. Same-tree ancestor capture listeners can observe them; they do not bubble or cross a shadow boundary. They are post-change notifications, so preventDefault does not reverse visibility. Disabled tooltips do not open; Escape suppresses reopening until the trigger is left and entered again.']};
}
function tooltipSlotExample(name,platform) {
  const properties={text:'Fallback description',subhead:'Fallback heading',variant:'rich',open:true};
  let body=tooltipComponent(properties,platform);
  const text=name==='subhead'?'Authored heading':'Authored supporting text';
  if(platform==='swift') {
    if(['subhead','content'].includes(name)) body+=`\n.awcTooltipSlot(.${name}, text: ${literal(text,platform)})`;
    else body+=`\n.awcTooltipSlot(.${name||'anchor'}) {\n    Button(${literal(name?'Custom action':'Hover or focus me',platform)}) { tapCount += 1 }\n}`;
  } else {
    const anchor=componentCode('md-button',{variant:'tonal'},platform,{children:[{text:'Hover or focus me'}]});
    const content=['subhead','content'].includes(name)?`AWCSlotText(${literal(text,platform)})`:`Button(onClick = { tapCount += 1 }) { Text(${literal(name?'Custom action':'Hover or focus me',platform)}) }`;
    body=componentCode('md-tooltip',properties,platform)+` { slot ->\n    if (slot == ${literal(name,platform)}) {\n${indent(content,8)}\n    }${name?`\n    if (slot == "") {\n${indent(anchor,8)}\n    }`:''}\n}`;
  }
  body=nativeTooltipContext(body,platform);
  return {status:'supported',description:`Supply authored native ${name||'anchor'} content.`,
    code:platform==='swift'?swiftExample(body,'@State private var tapCount = 0'):androidExample(body,'var tapCount by remember { mutableStateOf(0) }',tooltipImports),
    notes:['The empty slot is the anchor. Rich subhead/content replace their property fallbacks; actions retain their own native callbacks. Plain tooltips ignore the rich slots.','The typed text slot inherits source font metrics and contributes its actual description. Arbitrary native builders own layout; SwiftUI builders can provide accessibilityLabel when semantic text cannot be derived.','This example opens rich content for inspection. Supplying a custom action does not automatically close the tooltip or invent an action event.']};
}
function tooltipPartExample(name,platform) {
  const values={popup:{backgroundColor:'#22556699',borderColor:'#FFAA33',borderWidth:2,cornerShape:parseCornerShape('12px')},text:{color:'#DDCCAA88',fontSize:13,lineHeight:18},subhead:{fontWeight:700},'supporting-text':{letterSpacing:0.75},actions:{paddingInlineStart:13}}[name];
  if(!values)return null;
  const part=name==='supporting-text'?'supportingText':name;
  const partCase=platform==='swift'?`.${part}`:`AWCTooltipPart.${part[0].toUpperCase()}${part.slice(1)}`;
  let body=tooltipComponent({text:'Helpful information',subhead:'Details',variant:name==='text'?'plain':'rich',open:true},platform,{children:[{tag:'md-button',properties:{variant:'tonal'},children:[{text:'Hover or focus me'}]},{tag:'md-button',slot:'actions',properties:{variant:'text'},children:[{text:'Details'}]}]});
  const fields=Object.entries(values).map(([key,value])=>`${key}${platform==='swift'?': ':' = '}${key==='cornerShape'?cornerShapeNativeValue(value,platform):typeof value==='string'?literal(value,platform):platform==='android'&&key!=='fontWeight'?value.toFixed(2):value}`).join(', ');
  body=platform==='swift'?`${body}\n.awcTooltipPartAppearance(.init(${fields}), part: ${partCase})`:`AWCTooltipPartAppearanceScope(AWCTooltipPartAppearance(${fields}), part = ${partCase}) {\n${indent(body)}\n}`;
  body=nativeTooltipContext(body,platform);
  return {status:'native-equivalent',description:`Style the real ${name} through its typed native part API.`,code:platform==='swift'?swiftExample(body):androidExample(body,'',tooltipImports),notes:['Typed native fields reproduce the shown source effects; native views do not interpret ::part selectors.','Rich headings and supporting text keep their own explicit source typography unless their corresponding part is overridden. Authored child modifiers remain authoritative.']};
}

/** A real overlay viewport is part of the native Snackbar contract. */
export function nativeSnackbarContext(body, platform) {
  return platform === 'swift'
    ? `AWCSnackbarScope {\n${indent(body)}\n}\n.frame(width: 360, height: 480)`
    : `Box(modifier = Modifier.requiredSize(360.dp, 480.dp)) {\n    AWCSnackbarScope {\n${indent(body, 8)}\n    }\n}`;
}

export function nativeSnackbarLifecycleSupported(component, platform) {
  if (component?.tag !== 'md-snackbar') return false;
  const policy = component.support?.[platform === 'swift' ? 'ios' : platform];
  return ['show', 'hide'].every(name => has(policy?.methods, name) && !has(policy?.unsupportedMethods, name));
}

function snackbarSlotExample(name, platform) {
  const properties = { open: true, autoHide: false, message: 'Fallback message', action: 'Undo', closeable: true };
  let body = componentCode('md-snackbar', properties, platform);
  const slot = name || 'message';
  const content = platform === 'swift'
    ? name === 'close' ? 'Button("Dismiss") { Task { await controller.hide() } }'
      : name === 'action' ? 'Button("Custom action (\\(tapCount))") { tapCount += 1 }'
      : 'Text("Authored native message").font(.body)'
    : name === 'close' ? 'Button(onClick = { controller.hide() }) { Text("Dismiss") }'
      : name === 'action' ? 'Button(onClick = { tapCount += 1 }) { Text("Custom action ($tapCount)") }'
      : 'Text("Authored native message")';
  if (platform === 'swift') {
    body += `\n.awcSnackbarController(controller)\n.awcSnackbarSlot(.${slot}${name ? '' : ', accessibilityLabel: "Authored native message"'}) {\n${indent(content)}\n}`;
  } else {
    body += ` { slot ->\n    if (slot == ${literal(name, platform)}) {\n${indent(content, 8)}\n    }\n}`;
    body = `AWCSnackbarControllerScope(controller) {\n${indent(body)}\n}`;
  }
  body = nativeSnackbarContext(body, platform);
  return {
    status: 'supported', description: `Supply authored native ${name || 'message'} content with its own behavior.`,
    code: platform === 'swift' ? swiftExample(body, '@State private var controller = AWCSnackbarController()\n@State private var tapCount = 0')
      : androidExample(body, 'val controller = rememberAWCSnackbarController()\nvar tapCount by remember { mutableStateOf(0) }', [...skeletonImports, 'androidx.compose.material3.Button']),
    notes: ['Authored content replaces the fallback for this slot and retains native styling, accessibility and callbacks.',
      name === 'close' ? 'This custom close button explicitly calls hide(), producing the real close lifecycle notification. The wrapper does not invent a dismissal for arbitrary content.'
        : name === 'action' ? 'This custom action changes its own state. It does not emit the fallback mdAction event or start a fallback auto-hide timer.'
        : platform === 'swift' ? 'Arbitrary SwiftUI views have no DOM textContent; accessibilityLabel supplies the message for the Snackbar live announcement. AWCNode text content derives that text automatically.'
          : 'The empty slot name supplies the default message. Its native text and semantics remain available to accessibility.'],
  };
}

function snackbarExample(platform, { event, method } = {}) {
  const handler = platform === 'swift'
    ? `${event ? `guard event.name == ${literal(event, platform)} else { return }\n` : ''}lastEvent = event.name + ": " + event.detail.json`
    : `${event ? `if (name == ${literal(event, platform)}) ` : ''}lastEvent = name + ": " + (detail?.toString() ?: "null")`;
  let snackbar = componentCode('md-snackbar', { message: 'Changes saved', action: 'Undo', closeable: true, autoHide: false }, platform, { handler });
  snackbar = platform === 'swift' ? `${snackbar}\n.awcSnackbarController(controller)` : `AWCSnackbarControllerScope(controller) {\n${indent(snackbar)}\n}`;
  const content = platform === 'swift'
    ? `VStack {\n    Button("Show snackbar") { Task { await controller.show() } }\n    Button("Hide with action reason") { Task { await controller.hide(reason: .action) } }\n    Button("Hide with close reason") { Task { await controller.hide() } }\n    Text(lastEvent)\n    Spacer()\n}\n${snackbar}`
    : `Column {\n    Button(onClick = { controller.show() }) { Text("Show snackbar") }\n    Button(onClick = { controller.hide(AWCSnackbarCloseReason.Action) }) { Text("Hide with action reason") }\n    Button(onClick = { controller.hide() }) { Text("Hide with close reason") }\n    Text(lastEvent)\n}\n${snackbar}`;
  const body = nativeSnackbarContext(content, platform);
  return {
    ...(method ? { status: 'supported' } : {}),
    description: method ? `Invoke the real native ${method}() controller method on the mounted Snackbar.` : 'Show the mounted Snackbar and observe its actual lifecycle and action notifications.',
    code: platform === 'swift' ? swiftExample(body, '@State private var controller = AWCSnackbarController()\n@State private var lastEvent = "No event received yet."')
      : androidExample(body, 'val controller = rememberAWCSnackbarController()\nvar lastEvent by remember { mutableStateOf("No event received yet.") }', [...skeletonImports, 'androidx.compose.material3.Button']),
    notes: ['AWCSnackbarScope provides the real overlay viewport and coordinates mounted peer snackbars. Attach the controller to one mounted Snackbar. show() and hide() request lifecycle changes; completion does not wait for the visual transition. hide() defaults to close and can explicitly use auto or action.',
      'mdOpen and mdAction have null detail. mdClose carries a reason object with auto, action or close. These post-change notifications cannot veto the completed action.',
      'The built-in Undo action emits mdAction and starts a fresh auto-hide timer even when autoHide is false. It does not immediately dismiss. Assigning open=false does not emit mdClose; use hide() when that notification is required.'],
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
  if (nativeTooltipLifecycleSupported(component, platform)) return { ...result, ...tooltipExample(platform), title: result.title };
  if (tag === 'md-snackbar' && ['show', 'hide'].every(name => has(policy.methods, name) && !has(policy.unsupportedMethods, name))) return { ...result, ...snackbarExample(platform), title: result.title };
  if (menuFamily(tag, policy)) return { ...result, ...menuExample(platform), title: result.title };
  if (tag === 'md-fab-menu' && has(policy.properties, 'anchor')) return { ...result, ...fabMenuExample(platform), title: result.title };
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
  const componentBody = componentCode(tag, sampleProperties(tag, policy), platform, { children: sampleChildren(tag, policy) });
  const body = tag === 'md-badge' ? badgeContext(componentBody, platform) : tag === 'md-status-dot' ? nativeStatusDotContext(componentBody, platform) : ['md-meter', 'md-progress-indicator'].includes(tag) ? meterContext(componentBody, platform) : tag === 'md-skeleton' ? skeletonContext(componentBody, platform) : componentBody;
  return { ...result, description: 'Render native content and sample data using the supported properties for this platform.', code: platform === 'swift' ? swiftExample(body) : androidExample(body, '', tag === 'md-badge' ? badgeImports : tag === 'md-status-dot' ? statusDotContextImports : ['md-meter', 'md-progress-indicator'].includes(tag) ? meterImports : tag === 'md-skeleton' ? skeletonImports : []), notes: ['Replace the sample content with application data. The generated property types may contain additional source fields that this native adapter does not implement.', ...(tag === 'md-meter' ? ['Leave formatOptions absent for a localized percentage of the range. An explicit empty object formats the clamped raw number; currency and unit options are evaluated by the native formatter. Invalid locale/options use the source raw-number fallback.'] : [])] };
}

/** Shared color-token API; this does not claim a CSS-part-to-native mapping. */
export function nativeThemeExample(component = {}, platform) {
  const starter = nativeUsageExample(component, platform);
  if (!starter.code) return starter;
  const tag = component.tag ?? component.tagName;
  const policy = component.support[platform === 'swift' ? 'ios' : 'android'];
  const properties = sampleProperties(tag, policy);
  if (tag === 'md-meter' && has(policy.properties, 'color')) properties.color = 'Brand';
  if (Object.hasOwn(properties, 'open')) properties.open = false;
  const componentBody = componentCode(tag, properties, platform, { children: sampleChildren(tag, policy) });
  const body = tag === 'md-badge' ? badgeContext(componentBody, platform) : tag === 'md-status-dot' ? nativeStatusDotContext(componentBody, platform) : ['md-meter', 'md-progress-indicator'].includes(tag) ? meterContext(componentBody, platform) : tag === 'md-skeleton' ? skeletonContext(componentBody, platform) : componentBody;
  const tokens = { '--md-sys-color-primary': '#006A6A', '--md-sys-color-on-primary': '#FFFFFF', '--md-sys-color-surface-container': '#E8F5F2', '--md-sys-color-on-surface': '#173B36',
    ...(tag === 'md-meter' && has(policy.properties, 'color') ? { '--md-sys-color-Brand': '#006A6A80', '--md-sys-color-Brand-container': '#D0E8E5' } : {}) };
  const swiftTokens = `[${Object.entries(tokens).map(([key, value]) => `${literal(key, platform)}: ${literal(value, platform)}`).join(', ')}]`;
  const kotlinTokens = `mapOf(${Object.entries(tokens).map(([key, value]) => `${literal(key, platform)} to ${literal(value, platform)}`).join(', ')})`;
  const menu = tag === 'md-fab-menu' && has(policy.properties, 'anchor') ? fabMenuExample(platform) : menuFamily(tag, policy) ? menuExample(platform) : null;
  return {
    title: `${platform === 'swift' ? 'SwiftUI' : 'Compose'} theme colors`, language: starter.language, status: 'native-equivalent',
    description: 'Set validated system color roles for theme-aware native controls in this subtree.',
    code: menu ? (platform === 'swift' ? menu.code.replace('.frame(width: 360, height: 480)', `.frame(width: 360, height: 480)\n        .awcTheme(.generated(tokens: ${swiftTokens}))`) : menu.code.replace('AWCTheme {', `AWCTheme(tokenOverrides = ${kotlinTokens}) {`)) : platform === 'swift' ? swiftExample(`${body}\n.awcTheme(.generated(tokens: ${swiftTokens}))`) : androidExample(body, '', tag === 'md-badge' ? badgeImports : tag === 'md-status-dot' ? statusDotContextImports : ['md-meter', 'md-progress-indicator'].includes(tag) ? meterImports : tag === 'md-skeleton' ? skeletonImports : []).replace('AWCTheme {', `AWCTheme(tokenOverrides = ${kotlinTokens}) {`),
    notes: ['This is a native theme API, not a mapping of CSS parts or arbitrary CSS variables.', 'Validated --md-sys-color-* roles accept #RRGGBB and #RRGGBBAA. Role names are case-sensitive. Layout, typography, selector rules, CSS expressions and component-specific custom properties are not transported.', platform === 'swift' ? 'SwiftUI system controls can keep system-defined surfaces and metrics; use preferredColorScheme when choosing a fixed system appearance.' : 'Compose maps accepted roles into MaterialTheme. Individual controls may use different roles for selected, disabled and container states.', 'Use native layout/content APIs for dimensions and composition. Button also exposes its documented AWCButtonAppearance fields.'],
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
    if (nativeTooltipLifecycleSupported(component, platform) && ['show', 'hide'].includes(normalizedName)) return { ...result, ...tooltipExample(platform, { method: normalizedName }) };
    if (tag === 'md-snackbar' && ['show', 'hide'].includes(normalizedName) && ['show', 'hide'].every(name => has(policy.methods, name) && !has(policy.unsupportedMethods, name))) return { ...result, ...snackbarExample(platform, { method: normalizedName }) };
    if ((tag === 'md-menu' && ['show', 'close', 'whenClosed', 'reposition', 'getScrollViewport'].includes(normalizedName) || tag === 'md-sub-menu-item' && normalizedName === 'collapse') && has(policy.methods, normalizedName) && !has(policy.unsupportedMethods, normalizedName)) return { ...result, ...menuExample(platform, { method: normalizedName }) };
    if (tag === 'md-fab-menu' && ['show', 'close', 'whenClosed'].includes(normalizedName) && has(policy.methods, normalizedName) && !has(policy.unsupportedMethods, normalizedName)) return { ...result, ...fabMenuExample(platform, { method: normalizedName }) };
    if (tag === 'md-fab' && normalizedName === 'setMenuIcon' && has(policy.methods, normalizedName) && !has(policy.unsupportedMethods, normalizedName)) return { ...result, ...fabMethodExample(platform) };
    if (tag === 'md-list' && ['activateNext', 'activatePrevious', 'selectItem', 'getSelectedIndices'].includes(normalizedName) || tag === 'md-list-item' && ['setFocus', 'focusItem', 'toggle', 'expand', 'collapse'].includes(normalizedName)) {
      if (has(policy.methods, normalizedName) && !has(policy.unsupportedMethods, normalizedName)) return { ...result, status: 'supported', ...listMethodExample(tag, normalizedName, platform) };
    }
    if (Object.hasOwn(modalTypes, tag) && ['show', 'close', 'whenClosed'].includes(normalizedName) && has(policy.methods, normalizedName) && !has(policy.unsupportedMethods, normalizedName)) return { ...result, status: 'supported', ...modalMethodExample(tag, normalizedName, platform, policy) };
    if (tag === 'md-accordion-item' && ['toggle', 'focusHeader'].includes(normalizedName) && has(policy.methods, normalizedName) && !has(policy.unsupportedMethods, normalizedName)) return { ...result, status: 'supported', ...accordionMethodExample(normalizedName, platform) };
    if (tag === 'md-navigation-bar' && ['select', 'focusTab'].includes(normalizedName) && has(policy.methods, normalizedName) && !has(policy.unsupportedMethods, normalizedName)) return { ...result, status: 'supported', ...navigationBarMethodExample(normalizedName, platform) };
    if (tag === 'md-navigation-tab' && normalizedName === 'focusEl' && has(policy.methods, normalizedName) && !has(policy.unsupportedMethods, normalizedName)) return { ...result, status: 'supported', ...navigationTabMethodExample(platform) };
    if (tag === 'md-tabs' && normalizedName === 'selectTab' && has(policy.methods, normalizedName) && !has(policy.unsupportedMethods, normalizedName)) return { ...result, status: 'supported', ...tabsMethodExample(platform) };
    if (tag === 'md-breadcrumbs' && ['expand', 'collapse'].includes(normalizedName) && has(policy.methods, normalizedName) && !has(policy.unsupportedMethods, normalizedName)) return { ...result, status: 'supported', ...breadcrumbsMethodExample(normalizedName, platform) };
    if ((PICKER_ITEM_METHODS[tag]?.includes(normalizedName) || PICKER_VALIDITY_METHODS[tag]?.includes(normalizedName)) && has(policy.methods, normalizedName) && !has(policy.unsupportedMethods, normalizedName)) return { ...result, status: 'supported', ...pickerMethodExample(tag, normalizedName, platform) };
    if (tag === 'md-ripple' && ['trigger', 'whenSettled'].includes(normalizedName) && has(policy.methods, normalizedName) && !has(policy.unsupportedMethods, normalizedName)) return { ...result, status: 'supported', ...rippleMethodExample(normalizedName, platform) };
    if (nativeToolbarMethod(tag, normalizedName) && has(policy.methods, normalizedName) && !has(policy.unsupportedMethods, normalizedName)) return { ...result, status: 'supported', ...navMethodExample(tag, normalizedName, platform) };
    if (nativeChartMethod(tag, normalizedName) && has(policy.methods, normalizedName) && !has(policy.unsupportedMethods, normalizedName)) return { ...result, status: 'supported', ...chartMethodExample(tag, normalizedName, platform) };
    if (nativeTableMethod(tag, normalizedName) && has(policy.methods, normalizedName) && !has(policy.unsupportedMethods, normalizedName)) return { ...result, status: 'supported', ...tableMethodExample(tag, normalizedName, platform) };
    if (nativeSrMethod(tag, normalizedName) && has(policy.methods, normalizedName) && !has(policy.unsupportedMethods, normalizedName)) return { ...result, status: 'supported', ...srMethodExample(tag, normalizedName, platform) };
    if (nativeStepperMethod(tag, normalizedName) && has(policy.methods, normalizedName) && !has(policy.unsupportedMethods, normalizedName)) return { ...result, status: 'supported', ...stepperMethodExample(tag, normalizedName, platform) };
    if (tag === 'md-otp-field' && has(policy.methods, normalizedName) && !has(policy.unsupportedMethods, normalizedName) && Object.hasOwn(otpFieldMethodLabels, normalizedName)) return { ...result, status: 'supported', ...otpFieldMethodExample(normalizedName, platform) };
    if (tag === 'md-number-field' && has(policy.methods, normalizedName) && !has(policy.unsupportedMethods, normalizedName) && Object.hasOwn(numberFieldMethodLabels, normalizedName)) return { ...result, status: 'supported', ...numberFieldMethodExample(normalizedName, platform) };
    if (tag === 'md-text-field' && has(policy.methods, normalizedName) && !has(policy.unsupportedMethods, normalizedName) && Object.hasOwn(textFieldMethodLabels, normalizedName)) return { ...result, status: 'supported', ...textFieldMethodExample(normalizedName, platform) };
    if (nativeSelectionMethod(tag, normalizedName) && has(policy.methods, normalizedName) && !has(policy.unsupportedMethods, normalizedName)) return { ...result, status: 'supported', ...selectionMethodExample(tag, normalizedName, platform) };
    const alternative = methodAlternative(tag, normalizedName, policy);
    if (alternative) return { ...result, ...declarativeExample(component, normalizedName, platform, policy, alternative) };
    return { ...result, status: 'unsupported', description: `${normalizedName}() has no public ${target} method bridge.`, notes: ['The source JavaScript method and return type are Web-only. No callable native equivalent is documented for this operation.', 'Use supported native properties and host application APIs; do not call HTMLElement methods on the native component.'] };
  }
  if (kind === 'cssPart') {
    if (tag === 'md-otp-field' && policy.appearance && has(policy.visualParts, normalizedName)) { const example = otpFieldPartExample(normalizedName, platform); if (example) return { ...result, ...example }; }
    if (tag === 'md-number-field' && policy.appearance && has(policy.visualParts, normalizedName)) { const example = numberFieldPartExample(normalizedName, platform); if (example) return { ...result, ...example }; }
    if (tag === 'md-text-field' && policy.appearance && has(policy.visualParts, normalizedName)) { const example = textFieldPartExample(normalizedName, platform); if (example) return { ...result, ...example }; }
    if (Object.hasOwn(selectionPartValues, tag) && policy.appearance && has(policy.visualParts, normalizedName)) { const example = selectionPartExample(tag, normalizedName, platform); if (example) return { ...result, ...example }; }
    if (tag === 'md-avatar' && policy.appearance && has(policy.visualParts, normalizedName)) { const example = avatarPartExample(normalizedName, platform); if (example) return { ...result, ...example }; }
    if (['md-list', 'md-list-item'].includes(tag) && policy.appearance && has(policy.visualParts, normalizedName)) return { ...result, ...listPartExample(tag, normalizedName, platform) };
    if (Object.hasOwn(modalTypes, tag) && policy.appearance && has(policy.visualParts, normalizedName)) return { ...result, ...modalPartExample(tag, normalizedName, platform, policy) };
    const accordionPart = ['md-accordion', 'md-accordion-item'].includes(tag) && policy.appearance ? accordionPartExample(tag, normalizedName, platform) : null;
    if (accordionPart && (has(policy.visualParts, normalizedName) || tag === 'md-accordion' || ['chassis-handle', 'chassis-handle-bar'].includes(normalizedName))) return { ...result, ...accordionPart };
    const example = ['md-button', 'md-icon-button', 'md-fab', 'md-fab-menu-item', 'md-divider', 'md-segmented-button', 'md-badge', 'md-split-button', 'md-loading-indicator', 'md-meter', 'md-progress-indicator', 'md-skeleton', 'md-snackbar', 'md-tooltip', 'md-card'].includes(tag) && doc.support.status === 'native-equivalent' ? appearanceExample(tag, normalizedName, platform, policy) : null;
    if (example) return { ...result, ...example };
    const theme = nativeThemeExample(component, platform);
    return { ...result, code: theme.code, description: `The ${normalizedName} CSS part is a Web styling hook. ${theme.code ? 'The example customizes the surrounding native theme; it does not target this part.' : `No copyable ${target} appearance API is declared for this part.`}`, notes: ['Native views do not support CSS selectors or ::part().', ...(theme.code ? theme.notes : [])] };
  }
  if (doc.support.status !== 'supported') return { ...result, description: `${normalizedName || 'Default slot'} is ${doc.support.status === 'unsupported' ? 'not implemented' : 'not declared as supported'} by the ${target} adapter.`, notes: ['No native usage code is supplied for an unavailable or unverified member.'] };
  return { ...result, ...(kind === 'event' ? eventExample(component, normalizedName, platform, policy) : slotExample(component, normalizedName, platform, policy)) };
}
