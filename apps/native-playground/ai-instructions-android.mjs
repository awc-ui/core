import { usageSnippet } from './usage-snippets.js';
import { nativeGuideOverview, nativeGuideRecipes } from './ai-instructions-examples.mjs';

export const androidInstructionFiles = Object.freeze({
  support: 'packages/native-android/support.json',
  wrappers: 'packages/native-android/src/main/java/dev/awc/nativeui/generated/Components.kt',
  libraryBuild: 'packages/native-android/build.gradle.kts',
  playgroundBuild: 'apps/native-android-playground/build.gradle.kts',
  playgroundSettings: 'apps/native-android-playground/settings.gradle.kts',
  model: 'packages/native-android/src/main/java/dev/awc/nativeui/AWCModel.kt',
  renderer: 'packages/native-android/src/main/java/dev/awc/nativeui/AWCComponent.kt',
  theme: 'packages/native-android/src/main/java/dev/awc/nativeui/AWCTheme.kt',
  actions: 'packages/native-android/src/main/java/dev/awc/nativeui/AWCNativeActions.kt',
  readme: 'packages/native-android/README.md',
  inputs: 'packages/native-android/src/main/java/dev/awc/nativeui/AWCInputs.kt',
  navigation: 'packages/native-android/src/main/java/dev/awc/nativeui/AWCNavigation.kt',
  overlays: 'packages/native-android/src/main/java/dev/awc/nativeui/AWCOverlays.kt',
  groups: 'packages/native-android/src/main/java/dev/awc/nativeui/AWCGroups.kt',
  data: 'packages/native-android/src/main/java/dev/awc/nativeui/AWCData.kt',
});

const names = entries => (entries || []).map(entry => typeof entry === 'string' ? entry : entry.name).filter(name => typeof name === 'string');
const code = value => '`' + String(value).replaceAll('`', '\\`').replaceAll('|', '\\|').replaceAll('\n', ' ') + '`';
const list = values => values.length ? values.map(value => code(value === '' ? '(default: "")' : value)).join(', ') : 'None declared.';
const table = (headings, rows) => [
  `| ${headings.join(' | ')} |`, `| ${headings.map(() => '---').join(' | ')} |`,
  ...rows.map(row => `| ${row.join(' | ')} |`),
].join('\n');
const fence = (source, language = 'kotlin') => '```' + language + '\n' + source + '\n```';

function verifiedWrapper(source, tag) {
  const namespace = /^package ([\w.]+)$/m.exec(source)?.[1];
  if (!namespace) return null;
  for (const match of source.matchAll(/@Composable\s+fun (AWC\w+)\(([\s\S]*?)\n\) \{\n\s*AWCComponent\(tag = "([^"]+)"[^\n]+\n\}/g)) {
    if (match[3] !== tag) continue;
    const propertyType = /properties: (\w+) = \1\(\)/.exec(match[2])?.[1];
    if (!propertyType || !match[2].includes('onEvent: (String, AWCValue) -> Unit') || !match[2].includes('content: (@Composable (String) -> Unit)?')) return null;
    const block = new RegExp(`(?:data )?class ${propertyType}\\(([\\s\\S]*?)\\n\\)`).exec(source)?.[1];
    if (!block) return null;
    const fields = new Map([...block.matchAll(/val `([^`]+)`: ([^\n=]+?) = /g)].map(item => [item[1], item[2].trim()]));
    return { name: match[1], propertyType, namespace, fields };
  }
  return null;
}

function example(wrapper, tag, namespace) {
  const label = tag === 'md-button';
  return `${label ? 'import androidx.compose.material3.Text\n' : ''}import androidx.compose.runtime.Composable
import ${namespace}.AWCTheme
import ${wrapper.namespace}.${wrapper.name}
import ${wrapper.namespace}.${wrapper.propertyType}

@Composable
fun ComponentExample() {
    AWCTheme {
        ${wrapper.name}(
            properties = ${wrapper.propertyType}(),
            onEvent = { name, detail -> println("$name: $detail") },
        )${label ? ' { slot ->\n            if (slot == "") Text("Continue")\n        }' : ''}
    }
}`;
}

function buttonExample(wrapper, namespace) {
  return `import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import ${namespace}.AWCTheme
import ${wrapper.namespace}.${wrapper.name}
import ${wrapper.namespace}.${wrapper.propertyType}

@Composable
fun ToggleExample() {
    var selected by remember { mutableStateOf(false) }
    AWCTheme {
        ${wrapper.name}(
            properties = ${wrapper.propertyType}(toggle = true, selected = selected),
            onEvent = { name, detail ->
                if (name == "mdChange") {
                    val committed = (detail as? Map<*, *>)?.get("selected") as? Boolean
                    if (committed != null) selected = committed
                }
            },
        ) { slot ->
            if (slot == "") Text("Save")
        }
    }
}`;
}

/** Pure renderer: callers supply the bounded, repository-verified source strings. */
export function androidGuide(component, sourcesByPath) {
  if (!/^md-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(component?.tag || '')) throw new Error('Invalid Android component tag.');
  const source = key => {
    const value = sourcesByPath[androidInstructionFiles[key]];
    if (typeof value !== 'string') throw new Error(`Missing Android instruction source: ${key}`);
    return value;
  };
  // Require every declared provenance input even when a short section only links it.
  for (const key of Object.keys(androidInstructionFiles)) source(key);
  const manifest = JSON.parse(source('support'));
  const policy = manifest.components?.[component.tag];
  if (manifest.platform !== 'android' || !policy) throw new Error('Missing Android support policy.');
  const build = source('libraryBuild'), plugins = source('playgroundBuild');
  const minSdk = /\bminSdk\s*=\s*(\d+)/.exec(build)?.[1];
  const compileSdk = /\bcompileSdk\s*=\s*(\d+)/.exec(build)?.[1];
  const java = /jvmTarget\s*=\s*"(\d+)"/.exec(build)?.[1];
  const bom = /androidx\.compose:compose-bom:([^"\s]+)/.exec(build)?.[1];
  const agp = /id\("com\.android\.library"\) version "([^"]+)"/.exec(plugins)?.[1];
  const kotlin = /id\("org\.jetbrains\.kotlin\.android"\) version "([^"]+)"/.exec(plugins)?.[1];
  const composePlugin = /id\("org\.jetbrains\.kotlin\.plugin\.compose"\) version "([^"]+)"/.exec(plugins)?.[1];
  const namespace = /^package ([\w.]+)$/m.exec(source('model'))?.[1];
  if (![minSdk, compileSdk, java, bom, agp, kotlin, composePlugin, namespace].every(Boolean) || !/compose\s*=\s*true/.test(build)) {
    throw new Error('Unrecognized Android build configuration.');
  }
  const wrapper = verifiedWrapper(source('wrappers'), component.tag);
  const supported = kind => new Set(names(policy[kind]));
  const props = supported('properties'), events = supported('events'), slots = supported('slots'), methods = supported('methods');
  const missing = kind => [...new Set([...names(component[kind]).filter(name => !supported(kind).has(name)), ...names(policy[`unsupported${kind[0].toUpperCase()}${kind.slice(1)}`])])];
  const paragraphs = [
    '## Android / Jetpack Compose AI instructions',
    `This section describes the native Android adapter for ${code(component.tag)} from the current Kotlin API and Android support policy. A generated property or wrapper is not proof of implemented behavior. Android and iOS have separate support policies; do not copy a support claim between platforms.`,
    '### Android integration and toolchain',
    `The local library is ${code('packages/native-android')}, included as ${code(':native-ui')} by the Android playground. It declares minSdk ${minSdk}, compileSdk ${compileSdk}, Java/Kotlin JVM target ${java}, Compose enabled and Compose BOM ${code(bom)}. The reference Gradle root uses Android Gradle Plugin ${code(agp)}, Kotlin ${code(kotlin)} and the Compose compiler plugin ${code(composePlugin)}. These versions come from this checkout, not a recommendation for the latest releases.`,
    'Run the native compiler from the repository root before building: `node packages/native-compiler/src/cli.mjs build`. In a consuming app, include the local library in settings.gradle.kts (adjust this path to your checkout):',
    fence('include(":native-ui")\nproject(":native-ui").projectDir = file("/absolute/path/to/awc-ui/packages/native-android")'),
    'In the app module, apply the Android/Kotlin/Compose plugins, enable Compose and depend on the library. Configure compatible plugin versions in the root build, with google() and mavenCentral() repositories, as in the reference playground:',
    fence(`plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}
android {
    compileSdk = ${compileSdk}
    defaultConfig { minSdk = ${minSdk} }
    buildFeatures { compose = true }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_${java}
        targetCompatibility = JavaVersion.VERSION_${java}
    }
    kotlinOptions { jvmTarget = "${java}" }
}
dependencies { implementation(project(":native-ui")) }`),
    '### Public Compose usage',
    nativeGuideOverview(component, policy, 'android'),
    wrapper ? `Use the verified ${code(wrapper.name)} composable and ${code(wrapper.propertyType)} class from ${code(wrapper.namespace)}. They accept properties, Modifier, onEvent and an optional composable slot callback. Place the component inside AWCTheme.`
      : 'No matching generated Kotlin wrapper was verified in this checkout. Use the existing dynamic AWCComponent API below; do not invent a typed composable name.',
    fence(wrapper ? example(wrapper, component.tag, namespace) : usageSnippet(component, {}, 'android')),
    'This is a minimal API example. Supply meaningful application data and composed children where required; an empty chart, list or container is not a complete screen. Render it from your Compose screen or an Activity setContent block. The generic API accepts AWCComponent(tag, properties = mapOf(...)); generated types expose their values map when dynamic composition is needed.',
    component.parent ? `The catalog associates this component with ${code(component.parent)}. Preserve the relevant parent/child context; native coordination exists only where the support policy documents it.` : null,
    '### Android properties and state',
    'Use source camelCase property names. Generated enums are Kotlin enum constants, numeric fields use their declared Kotlin types, and structured values use JSON-compatible AWCValue. AWCValue is a typealias for Any? accepting scalar values, lists and maps; it is not the Swift AWCValue enum. Arbitrary JavaScript functions and DOM objects are not supported values.',
    (component.properties || []).length ? table(['Property', 'Kotlin field type', 'Source default', 'Android support'], component.properties.map(property => [
      code(property.name), wrapper?.fields.has(property.name) ? code(wrapper.fields.get(property.name)) : 'No verified typed field',
      property.default === undefined ? 'Not specified' : code(property.default),
      props.has(property.name) ? 'Supported by Android adapter' : 'Unsupported / not listed in Android policy',
    ])) : 'This component declares no source properties.',
    `Android policy property names: ${list([...props])}`,
    'The generic renderer merges source defaults with supplied values. Unchanged external values retain local interaction state; changing a value resynchronizes its state. Hoist application state with remember/model state, consume the relevant onEvent callback, and supply the updated supported property. Typed property objects are immutable; use copy(...) or create a new instance. No automatic two-way Binding API is provided.',
    '### Android events',
    names(component.events).length ? table(['Source event', 'Android adapter'], names(component.events).map(name => [code(name), events.has(name) ? 'Supported' : 'Unsupported / not listed in Android policy'])) : 'No source events are declared.',
    `Android policy event names: ${list([...events])}`,
    'onEvent has signature (String, AWCValue) -> Unit: it receives the event name and a nullable JSON-compatible payload, not a Swift AWCEvent or a DOM CustomEvent. Cast payload values safely according to the adapter notes; native details can differ from web detail types. DOM originalEvent, node objects, browser event bubbling and cancellation are not implied by the source declaration.',
    'The observation callback does not expose preventDefault(). Where explicitly documented for md-button, AWCActionScope and AWCActionTargetScope provide synchronous native cancellation/propagation before default effects. Other adapters must not be assumed to implement those button action semantics.',
    '### Android content, slots and methods',
    `Supported Android slots: ${list([...slots])}`,
    `Unsupported source slots: ${list(missing('slots'))}`,
    'The content callback is @Composable (String) -> Unit. It receives "" for the default slot and the exact source name for a named slot; emit content only for a matching supported name, for example if (slot == "") Text("Content"). Content is composed natively, not interpreted as HTML. A supplied slot can replace a native fallback; the md-button AWCSlotsScope/AWCSlotRegistry API also represents intentionally empty slots explicitly. Swift AWCNode children are not an Android API.',
    `Source methods: ${list(names(component.methods))}`,
    `Android policy methods: ${list([...methods])}`,
    `Unsupported source methods: ${list(missing('methods'))}`,
    'Drive supported properties declaratively rather than calling source HTMLElement methods. Explicit native forms, focus and navigation APIs have their own contracts in the Android README and do not recreate browser DOM machinery.',
    '### Android theme, rendering and limitations',
    'AWCTheme() follows system dark mode; AWCTheme(darkTheme = true) selects the generated dark palette. The tokenOverrides overload accepts supported --md-sys-color-* roles as six-digit hex strings. Native Material3 color roles, source corner tokens and a subset of typography are mapped; CSS selectors, arbitrary component CSS variables and JavaScript are not executed. md-button bundles the source Roboto and Material Symbols fonts; platform font rasterization and elevation can still differ.',
    ...(policy.notes || []).map(note => `- ${note}`),
  ].filter(Boolean);
  if (component.tag === 'md-button' && wrapper && props.has('toggle') && props.has('selected') && events.has('mdChange')) {
    paragraphs.push('### Controlled Android button state',
      'mdClick describes the proposed selection before commit; mdChange follows an accepted toggle commit. Update hoisted state from mdChange. Cancel an action in the explicit native action scope, not the observation callback.',
      fence(buttonExample(wrapper, namespace)));
  }
  const equivalents = Object.entries(policy.nativeEquivalents || {});
  if (equivalents.length) {
    paragraphs.push('### Explicit Android replacements');
    for (const [name, equivalent] of equivalents) paragraphs.push(`#### ${name}`, `Status: ${code(equivalent.status)}. API: ${code(equivalent.api)}.`, equivalent.description,
      ...(equivalent.limitations || []).map(limit => `- ${limit}`));
  }
  paragraphs.push('### Android validation boundary',
    'The studio Android preview runs an actual Compose host on a dedicated emulator and streams native pixels; it is not the local macOS SwiftUI preview. A successful build or streamed image does not establish complete interaction parity, accessibility compliance or behavior on all Android devices. Use emulator/device instrumentation for layouts, touch, IME, keyboard navigation, TalkBack and lifecycle behavior. This generated guide does not run tests or certify those capabilities.',
    `Consult ${code(androidInstructionFiles.support)} for the Android support policy and ${code(androidInstructionFiles.readme)} for native forms, actions, focus, routing, validation and remaining platform differences.`);
  paragraphs.push(nativeGuideRecipes(component, policy, 'android'));
  return paragraphs.join('\n\n');
}
