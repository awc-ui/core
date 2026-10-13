import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { usageSnippet } from './usage-snippets.js';
import { androidGuide, androidInstructionFiles } from './ai-instructions-android.mjs';

const files = Object.freeze({
  catalog: 'packages/native-compiler/generated/catalog.json',
  support: 'packages/native-ios/NativeSupport.json',
  wrappers: 'packages/native-ios/Sources/AWCUI/Generated/Components.swift',
  package: 'packages/native-ios/Package.swift',
  models: 'packages/native-ios/Sources/AWCUI/Models.swift',
  renderer: 'packages/native-ios/Sources/AWCUI/AWCNativeView.swift',
  examples: 'packages/native-ios/Sources/AWCUI/Examples.swift',
  nativeReadme: 'packages/native-ios/README.md',
  behavior: 'packages/native-ios/NativeBehavior.md',
  focus: 'packages/native-ios/NativeFocus.md',
});

export class AIInstructionsError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}

async function readSource(root, relative) {
  const file = await realpath(path.join(root, relative));
  if (!file.startsWith(root + path.sep)) throw new Error('Source is outside the repository.');
  const info = await stat(file);
  if (!info.isFile() || info.size > 16 * 1024 * 1024) throw new Error('Source is unavailable.');
  return readFile(file, 'utf8');
}

function swiftWrapper(source, tag) {
  for (const match of source.matchAll(/public struct (AWC\w+): View \{([\s\S]*?)(?=\npublic (?:enum|struct)|$)/g)) {
    if (/AWCNativeView\(tag: "([^"]+)"/.exec(match[2])?.[1] !== tag) continue;
    const propertyType = /public var properties: (\w+)/.exec(match[2])?.[1];
    if (!propertyType || !match[2].includes(`public init(properties: ${propertyType} = .init(), children: [AWCNode] = []`)) return null;
    const block = new RegExp(`public struct ${propertyType} \\{([\\s\\S]*?)(?=\\npublic (?:enum|struct)|$)`).exec(source)?.[1];
    if (!block) return null;
    const types = new Map([...block.matchAll(/public var `([^`]+)`: ([^\n]+)/g)].map(item => [item[1], item[2].trim()]));
    return { name: match[1], propertyType, types };
  }
  return null;
}

const code = value => '`' + String(value).replaceAll('`', '\\`').replaceAll('|', '\\|').replaceAll('\n', ' ') + '`';
const list = values => values.length ? values.map(value => code(value === '' ? '(default)' : value)).join(', ') : 'None declared.';
const names = values => (values || []).map(value => typeof value === 'string' ? value : value.name).filter(value => typeof value === 'string');
const supported = (policy, kind) => new Set(names(policy[kind]));
const table = (headings, rows) => [
  `| ${headings.join(' | ')} |`, `| ${headings.map(() => '---').join(' | ')} |`,
  ...rows.map(row => `| ${row.join(' | ')} |`),
].join('\n');

function typedExample(wrapper, tag) {
  const children = tag === 'md-button' ? '[.text("Continue")]' : '[]';
  return `import SwiftUI
import AWCUI

struct ComponentExample: View {
    @State private var properties = ${wrapper.propertyType}()

    var body: some View {
        ${wrapper.name}(
            properties: properties,
            children: ${children},
            onEvent: { event in
                print(event.name, event.detail.json)
            }
        )
    }
}`;
}

function nativeGuide(component, policy, manifest, wrapper, packageSource) {
  const tag = component.tag;
  const ios = /\.iOS\(\.v(\d+)\)/.exec(packageSource)?.[1];
  const macos = /\.macOS\(\.v(\d+)\)/.exec(packageSource)?.[1];
  if (!ios || !macos) throw new Error('Unknown package platform requirements.');
  const props = supported(policy, 'properties'), events = supported(policy, 'events'), slots = supported(policy, 'slots');
  const methodNames = names(component.methods);
  const rows = (component.properties || []).map(property => [
    code(property.name), wrapper?.types.has(property.name) ? code(wrapper.types.get(property.name)) : 'No verified typed field',
    property.default === undefined ? 'Not specified' : code(property.default),
    props.has(property.name) ? 'Supported by native adapter' : 'Unsupported / not listed in native policy',
  ]);
  const paragraphs = [
    '## SwiftUI / iOS AI instructions',
    `This section is generated from this checkout's native catalog, public Swift API and support policy for ${code(tag)}. The original Markdown above describes the web component; browser APIs and CSS documented there are not automatically available in SwiftUI. Generated API coverage does not imply full behavioral parity.`,
    '### Package and platform',
    'Run `pnpm native:build` from the repository root before building so the generated native catalog, wrappers and tokens are current. Place ComponentExample in your existing SwiftUI app or WindowGroup; do not add a second @main entry point.',
    `Add the local Swift package at ${code('packages/native-ios')} to your Xcode app and link its ${code('AWCUI')} library product. Import ${code('SwiftUI')} and ${code('AWCUI')}. The package declares iOS ${ios}+ and macOS ${macos}+ and renders native SwiftUI/Canvas without a WebView or JavaScript runtime.`,
    'The studio’s local SwiftUI live preview runs a macOS native host. It is not an iOS Simulator or an iPhone/iPad device run. Build and test the app with an iOS Xcode destination to verify UIKit, hardware-keyboard, VoiceOver, touch and presentation behavior on iOS.',
    '### Public SwiftUI usage',
    wrapper ? `Use the verified ${code(wrapper.name)} view and ${code(wrapper.propertyType)} property struct. Its initializer accepts ${code('properties')}, ${code('children: [AWCNode]')} and ${code('onEvent: (AWCEvent) -> Void')}.`
      : 'No matching generated typed wrapper was found in this checkout. Use the verified dynamic API below; do not invent a wrapper name.',
    '```swift\n' + (wrapper ? typedExample(wrapper, tag) : usageSnippet(component, {}, 'swift')) + '\n```',
    'This is a minimal API example. Supply application data and composed children where required by this component; empty defaults are not a complete screen.',
    component.parent ? `Composition context: the catalog associates this component with ${code(component.parent)}. Preserve that parent/child relationship when the component depends on shared selection, navigation or table context.` : null,
    `For a development fixture with authored data/children, use ${code(`AWCNativeView(node: AWCExamples.node(for: "${tag}"))`)}. Fixtures are separate from production rendering; replace their sample data in your app.`,
    '### Properties and state',
    'The property struct contains source-derived fields, including fields the native adapter does not implement. Set only supported properties for native behavior. The source-default column describes the web contract; the generated Swift initializer performs the actual Swift default/type conversion. Use native enum cases for enum fields and JSON-shaped AWCValue for structured fields.',
    rows.length ? table(['Property', 'Swift field type', 'Source default', 'Native support'], rows) : 'This component declares no source properties.',
    `Native policy property names: ${list([...props])}`,
    'The renderer merges source defaults with supplied properties, owns local interaction state and resynchronizes when supplied properties change. Keep application state in @State or your model and update the supported property value when handling the relevant native event. This is not an automatic two-way Binding initializer. For dynamic trees use AWCNativeView(node:) with stable AWCNode IDs; generated wrappers do not expose a custom node ID.',
    `Generated wrappers and AWCNativeView(tag:) use the component tag as the node ID. Multiple instances of the same tag therefore share that observation ID. For distinct event routing, linked tabs or group members, provide a stable, unique ID, for example ${code(`AWCNativeView(node: AWCNode(id: "stable-unique-id", tag: "${tag}"))`)}. Retain stateful child nodes or their explicit IDs instead of regenerating default UUIDs on every body evaluation.`,
    '### Native events',
    names(component.events).length ? table(['Source event', 'Native adapter'], names(component.events).map(name => [code(name), events.has(name) ? 'Supported' : 'Unsupported / not listed in native policy'])) : 'No source events are declared.',
    `Native policy event names: ${list([...events])}`,
    'onEvent receives AWCEvent with name, tag, nodeID and serializable AWCValue detail; inspect detail.json when integrating. Native payloads can differ from web detail types: DOM references, originalEvent objects and JavaScript callbacks are not transported. Do not infer browser bubbling or cancellation from the web event declaration. The native adapter notes below describe component-specific payloads and exceptions.',
    'Composed children forward events to the parent observation callback; filter event.tag and event.nodeID before updating application state. AWCEvent also exposes defaultPrevented, propagationPath and optional activation metadata. A canceled native mdClick is still observed: check defaultPrevented before performing host side effects, and use mdChange for committed toggle state.',
    'onEvent is an observation callback, not a place to call a DOM event’s preventDefault(). Where documented, native AWCEventScope / AWCEventTargetScope provide synchronous native event cancellation before an action. See NativeBehavior.md for those explicit scope APIs.',
    '### Children, named slots and methods',
    `Supported native slots: ${list([...slots])}`,
    `Unsupported source slots: ${list([...new Set([...names(component.slots).filter(name => !slots.has(name)), ...names(policy.unsupportedSlots)])])}`,
    'Represent children as AWCNode values, not HTML strings or arbitrary SwiftUI View values. Use AWCNode.text("Content") for the default slot (omit slot / use nil). For supported named slots use AWCNode.text("Content", slot: "slot-name") or set the child AWCNode.slot to that exact name. Do not assume an unsupported slot renders just because it exists in the generated web contract.',
    `Source methods: ${list(methodNames)}`,
    `Native policy methods: ${list(names(policy.methods))}`,
    `Unsupported source methods: ${list([...new Set([...methodNames.filter(name => !supported(policy, 'methods').has(name)), ...names(policy.unsupportedMethods)])])}`,
    'Do not call HTMLElement methods on a SwiftUI view. Drive supported state declaratively (for example, open when supported); use the explicit native form, focus and routing APIs only where documented. Wrap independent sibling AWCNode trees in AWCNativeScope when they need shared radio/tab linkage.',
    '### Native appearance and limitations',
    'The renderer follows the system appearance. Use .awcTheme(AWCTheme.generated(dark: true)) for an explicit generated palette; use .preferredColorScheme(.dark) as well when SwiftUI system controls should follow that appearance. Native layout uses SwiftUI; web CSS selectors, parts, style strings and arbitrary TSX/JavaScript do not execute. Material icon names generally map to SF Symbols; md-button bundles its Roboto and Material Symbols fonts.',
    ...(policy.notes || []).map(note => `- ${note}`),
    ...(manifest.globalNotes || []).map(note => `- ${note}`),
  ].filter(Boolean);
  if (tag === 'md-button' && wrapper && props.has('toggle') && props.has('selected') && events.has('mdChange')) {
    paragraphs.push('### Controlled button state', 'Use mdChange for the committed toggle state; mdClick describes the proposed activation. The observation callback cannot cancel an already dispatched action.', '```swift\n' + `import SwiftUI
import AWCUI

struct ToggleExample: View {
    @State private var selected = false

    var body: some View {
        AWCButton(
            properties: .init(toggle: true, selected: selected),
            children: [.text("Save")]
        ) { event in
            if event.name == "mdChange", let value = event.detail["selected"].bool {
                selected = value
            }
        }
    }
}` + '\n```');
  }
  const equivalents = Object.entries(policy.nativeEquivalents || {});
  if (equivalents.length) {
    paragraphs.push('### Explicit native replacements');
    for (const [capability, equivalent] of equivalents) {
      paragraphs.push(`#### ${capability}`, `Status: ${code(equivalent.status)}. API: ${code(equivalent.api)}.`, equivalent.description,
        ...(equivalent.limitations || []).map(limit => `- ${limit}`));
    }
  }
  paragraphs.push('### Verification recorded by the adapter',
    ...Object.entries(manifest.verification || {}).map(([name, evidence]) => `- ${name}: ${evidence}`),
    'These are recorded implementation/verification notes, not a new test run. This guide does not certify iOS device behavior or complete web parity.');
  return paragraphs.join('\n\n');
}

/** Read-only, generated on demand; never executes source or rewrites component READMEs. */
export async function getAIInstructions(repository, tag) {
  if (typeof tag !== 'string' || !/^md-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(tag)) {
    throw new AIInstructionsError(404, 'UNKNOWN_COMPONENT', 'Choose a known component tag.');
  }
  try {
    const root = await realpath(repository);
    const catalog = JSON.parse(await readSource(root, files.catalog));
    const component = catalog.components?.find(item => item.tag === tag);
    if (!component) throw new AIInstructionsError(404, 'UNKNOWN_COMPONENT', 'Choose a known component tag.');
    const readmePath = `packages/core/src/components/${tag}/readme.md`;
    const sources = [readmePath, ...Object.values(files), ...Object.values(androidInstructionFiles)];
    const content = await Promise.all(sources.map(relative => readSource(root, relative)));
    const byPath = Object.fromEntries(sources.map((relative, index) => [relative, content[index]]));
    const manifest = JSON.parse(byPath[files.support]);
    const policy = manifest.components?.[tag];
    if (!policy) throw new Error('Native support policy is missing.');
    const wrapper = swiftWrapper(byPath[files.wrappers], tag);
    const guide = nativeGuide(component, policy, manifest, wrapper, byPath[files.package]);
    const composeGuide = androidGuide(component, byPath);
    const provenance = '### Guide sources\n\n' + sources.map(source => `- [${source}](${source})`).join('\n');
    return { filename: `${tag}.md`, markdown: byPath[readmePath] + '\n\n---\n\n' + guide + '\n\n---\n\n' + composeGuide + '\n\n' + provenance + '\n', sources };
  } catch (error) {
    if (error instanceof AIInstructionsError) throw error;
    throw new AIInstructionsError(503, 'AI_INSTRUCTIONS_UNAVAILABLE', 'Local component instructions are unavailable. No source files were changed.');
  }
}
