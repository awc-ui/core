// Copyable examples of the public native adapters. Source TypeScript signatures
// are never treated as native methods or as native payload declarations.
import { memberDocumentation } from './documentation.js';

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
    const node = child => child.text !== undefined
      ? `.text(${literal(child.text, platform)}${child.slot ? `, slot: ${literal(child.slot, platform)}` : ''})`
      : `AWCNode(tag: ${literal(child.tag, platform)}, properties: ${propertiesCode(child.properties ?? {}, platform)}, children: [${(child.children ?? []).map(node).join(', ')}]${child.slot ? `, slot: ${literal(child.slot, platform)}` : ''})`;
    return `AWCNativeView(\n    tag: ${literal(tag, platform)},\n    properties: ${propertiesCode(properties, platform, expressions)},\n    children: [${children.map(node).join(', ')}]${handler ? `,\n    onEvent: { event in\n${indent(handler, 8)}\n    }` : ''}\n)`;
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
  'md-table': { tag: 'md-table-body', children: [{ tag: 'md-table-row', children: [{ tag: 'md-table-cell', children: [{ text: 'Cell content' }] }] }] },
  'md-table-head': { tag: 'md-table-row', children: [{ tag: 'md-table-cell', properties: { head: true }, children: [{ text: 'Name' }] }] },
  'md-table-body': { tag: 'md-table-row', children: [{ tag: 'md-table-cell', children: [{ text: 'Ada' }] }] },
  'md-table-foot': { tag: 'md-table-row', children: [{ tag: 'md-table-cell', children: [{ text: 'Total' }] }] },
  'md-table-row': { tag: 'md-table-cell', children: [{ text: 'Cell content' }] },
};

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
    'md-switch': { label: 'Enable notifications', checked: false },
    'md-slider': { value: 25, min: 0, max: 100 },
    'md-dialog': { headline: 'Details', open: true },
    'md-snackbar': { message: 'Changes saved', open: true, closeable: true, autoHide: false },
  };
  const values = choices[tag] ?? (has(policy.properties, 'open') ? { open: true } : has(policy.properties, 'label') ? { label: 'Example' } : has(policy.properties, 'headline') ? { headline: 'Example' } : {});
  return Object.fromEntries(Object.entries(values).filter(([key]) => has(policy.properties, key)));
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
  const handler = platform === 'swift'
    ? `guard event.name == ${literal(name, platform)} else { return }\nlastPayload = event.detail.json`
    : `if (name == ${literal(name, platform)}) {\n    lastPayload = detail?.toString() ?: "null"\n}`;
  const children = structuralChild[component.tag] ? [structuralChild[component.tag]] : has(policy.slots, '') ? [{ text: 'Example content' }] : [];
  const body = componentCode(component.tag, sampleProperties(component.tag, policy), platform, { handler, children });
  return {
    description: `Handle only ${name} and display its native payload in application state.`,
    code: platform === 'swift'
      ? swiftExample(`VStack {\n${indent(body)}\n    Text(lastPayload)\n}`, '@State private var lastPayload = "No event received yet."')
      : androidExample(`Column {\n${indent(body)}\n    Text(lastPayload)\n}`, 'var lastPayload by remember { mutableStateOf("No event received yet.") }'),
    notes: ['The callback exposes native JSON-shaped data. Its payload can differ from the source TypeScript event; this example displays the complete native value without inventing fields.', 'Add the component data and child content required by your application to exercise every event path.'],
  };
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
  const children = [{ ...child, ...(name ? { slot: name } : {}) }];
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
  const openTags = ['md-dialog', 'md-fab-menu', 'md-side-sheet', 'md-menu', 'md-search', 'md-bottom-sheet', 'md-color-picker', 'md-snackbar', 'md-select', 'md-multi-select', 'md-autocomplete'];
  if (openTags.includes(tag) && ['show', 'showMenu', 'close', 'closeMenu', 'hide'].includes(name) && has(policy.properties, 'open')) return { property: 'open', initial: !['show', 'showMenu'].includes(name), next: ['show', 'showMenu'].includes(name), type: 'Bool', description: 'Control visibility through the supported open property.' };
  if (tag === 'md-list-item' && ['expand', 'collapse', 'toggle'].includes(name) && has(policy.properties, 'expanded')) return { property: 'expanded', initial: name === 'collapse', next: name !== 'collapse', toggle: name === 'toggle', type: 'Bool', description: 'Control row expansion through the supported expanded property.', properties: { expandable: true, headline: 'Details' } };
  if (tag === 'md-otp-field' && name === 'clear' && has(policy.properties, 'value')) return { property: 'value', initial: '123456', next: '', type: 'String', description: 'Clear the code by updating the supported value property.' };
  return null;
}

function declarativeExample(component, name, platform, policy, alternative) {
  const { property, initial, next, toggle, type } = alternative;
  const initialCode = typeof initial === 'string' ? literal(initial, platform) : String(initial);
  const nextCode = toggle ? '!value' : typeof next === 'string' ? literal(next, platform) : String(next);
  const properties = { ...sampleProperties(component.tag, policy), ...alternative.properties };
  delete properties[property];
  const handler = property === 'open' && has(policy.events, 'mdClose')
    ? platform === 'swift' ? 'if event.name == "mdClose" { value = false }' : 'if (name == "mdClose") value = false'
    : property === 'expanded' && has(policy.events, 'mdExpand')
      ? platform === 'swift' ? 'if event.name == "mdExpand" { value = event.detail["expanded"].bool ?? false }' : 'if (name == "mdExpand") value = (detail as? Map<*, *>)?.get("expanded") as? Boolean ?: false'
      : component.tag === 'md-otp-field' ? platform === 'swift' ? 'if event.name == "mdInput" || event.name == "mdChange" { value = event.detail.string }' : 'if (name == "mdInput" || name == "mdChange") value = detail as? String ?: ""' : undefined;
  const children = property === 'expanded' ? [{ text: 'Additional information', slot: 'expanded-content' }] : structuralChild[component.tag] ? [structuralChild[component.tag]] : has(policy.slots, '') ? [{ text: 'Example content' }] : [];
  const body = componentCode(component.tag, properties, platform, { expressions: { [property]: platform === 'swift' ? `.${type === 'Bool' ? 'bool' : 'string'}(value)` : 'value' }, handler, children });
  return {
    status: 'native-equivalent',
    description: `${name}() has no native method bridge. ${alternative.description}`,
    code: platform === 'swift'
      ? swiftExample(`VStack {\n    Button(${literal(`Apply ${name}`, platform)}) { value = ${nextCode} }\n${indent(body)}\n}`, `@State private var value: ${type} = ${initialCode}`)
      : androidExample(`Column {\n    Button(onClick = { value = ${nextCode} }) { Text(${literal(`Apply ${name}`, platform)}) }\n${indent(body)}\n}`, `var value by remember { mutableStateOf(${initialCode}) }`, ['androidx.compose.material3.Button']),
    notes: ['This updates declarative native state. It does not invoke the source method or reproduce its promise, return value, validation flow or event lifecycle.', 'Keep host state synchronized with native change/close callbacks when the control can also change through user interaction.'],
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
    return example ? { ...result, ...example } : { ...result, description: `The ${normalizedName} CSS part is a Web styling hook. No copyable ${target} appearance API is declared for this part.`, notes: ['Native views do not support CSS selectors or ::part().'] };
  }
  if (doc.support.status !== 'supported') return { ...result, description: `${normalizedName || 'Default slot'} is ${doc.support.status === 'unsupported' ? 'not implemented' : 'not declared as supported'} by the ${target} adapter.`, notes: ['No native usage code is supplied for an unavailable or unverified member.'] };
  return { ...result, ...(kind === 'event' ? eventExample(component, normalizedName, platform, policy) : slotExample(component, normalizedName, platform, policy)) };
}
