import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { androidGuide, androidInstructionFiles } from './ai-instructions-android.mjs';

const repository = new URL('../../', import.meta.url);
const catalog = JSON.parse(await readFile(new URL('packages/native-compiler/generated/catalog.json', repository), 'utf8'));
const sources = Object.fromEntries(await Promise.all(Object.values(androidInstructionFiles).map(async file => [file, await readFile(new URL(file, repository), 'utf8')])));
const component = tag => catalog.components.find(item => item.tag === tag);

test('all 81 Android guides verify actual typed wrappers and their Kotlin property classes', () => {
  assert.equal(catalog.components.length, 81);
  const kotlin = sources[androidInstructionFiles.wrappers];
  for (const item of catalog.components) {
    const guide = androidGuide(item, sources);
    assert.ok(guide.startsWith('## Android / Jetpack Compose AI instructions'));
    const wrapper = /Use the verified `(\w+)` composable and `(\w+)` class from `([\w.]+)`/.exec(guide);
    assert.ok(wrapper, item.tag);
    const signature = kotlin.slice(kotlin.indexOf(`fun ${wrapper[1]}(`)).split('\n}')[0];
    assert.ok(signature.includes(`AWCComponent(tag = "${item.tag}"`), item.tag);
    assert.ok(signature.includes(`properties: ${wrapper[2]} = ${wrapper[2]}()`), item.tag);
    assert.ok(guide.includes(`import ${wrapper[3]}.${wrapper[1]}`), item.tag);
    assert.ok(guide.includes(`properties = ${wrapper[2]}()`), item.tag);
    assert.match(guide, /minSdk 26, compileSdk 36, Java\/Kotlin JVM target 17/);
    assert.match(guide, /Compose BOM `2025\.10\.01`/);
    assert.match(guide, /Android Gradle Plugin `8\.13\.2`, Kotlin `2\.2\.21`/);
    assert.match(guide, /Android events/);
    assert.match(guide, /Android content, slots and methods/);
    assert.match(guide, /Android theme, rendering and limitations/);
    assert.match(guide, /is not the local macOS SwiftUI preview/);
    assert.match(guide, /does not run tests or certify/);
  }
});

test('Android support comes from its own policy, including differences from iOS', () => {
  const field = androidGuide(component('md-text-field'), sources);
  assert.match(field, /\| `variant` \| `AWCTextFieldVariant` \| `'filled'` \| Supported by Android adapter \|/);
  assert.match(field, /\| `speechToText` .* Unsupported \/ not listed in Android policy \|/);
  assert.match(field, /\| `mdSpeechResult` \| Unsupported \/ not listed in Android policy \|/);
  assert.match(field, /Supported Android slots: `trailing-icon`/);
  assert.match(field, /Unsupported source slots: `leading-icon`/);
  assert.match(field, /Unsupported source methods: .*`getInputElement`/);
  const chart = androidGuide(component('md-bar-chart'), sources);
  assert.match(chart, /\| `xAxis` .* Supported by Android adapter \|/);
  assert.match(chart, /\| `zoom` .* Unsupported \/ not listed in Android policy \|/);
  assert.match(chart, /Supported Android slots: None declared/);
  assert.match(chart, /Advanced scales, curves, stacking, zoom/);
});

test('button instructions use actual Compose state, nullable map events and native action scopes', () => {
  const guide = androidGuide(component('md-button'), sources);
  assert.match(guide, /AWCButtonProperties\(toggle = true, selected = selected\)/);
  assert.match(guide, /var selected by remember \{ mutableStateOf\(false\) \}/);
  assert.match(guide, /\(detail as\? Map<\*, \*>\)\?\.get\("selected"\) as\? Boolean/);
  assert.match(guide, /if \(slot == ""\) Text\("Save"\)/);
  assert.match(guide, /AWCActionScope and AWCActionTargetScope/);
  assert.match(guide, /Explicit Android replacements/);
  assert.match(guide, /Kotlin\/Java/);
  assert.doesNotMatch(guide, /detail\.json|AWCButtonProperties\(toggle: true/);
});

test('missing typed wrappers fall back to the established dynamic Kotlin generator', () => {
  const guide = androidGuide(component('md-button'), { ...sources, [androidInstructionFiles.wrappers]: '// No generated wrapper available.' });
  assert.match(guide, /No matching generated Kotlin wrapper/);
  assert.match(guide, /AWCComponent\(/);
  assert.match(guide, /tag = "md-button"/);
  assert.doesNotMatch(guide, /AWCButton\(/);
});

test('requirements are derived from Gradle source rather than hardcoded', () => {
  const guide = androidGuide(component('md-button'), { ...sources,
    [androidInstructionFiles.libraryBuild]: sources[androidInstructionFiles.libraryBuild].replace('minSdk = 26', 'minSdk = 29').replace('compose-bom:2025.10.01', 'compose-bom:2099.01.01'),
  });
  assert.match(guide, /minSdk 29/); assert.match(guide, /Compose BOM `2099\.01\.01`/);
  assert.doesNotMatch(guide, /minSdk 26/);
});

test('invalid components, incomplete sources and unknown support fail without invented guides', () => {
  assert.throws(() => androidGuide({ tag: '../../private' }, sources), /Invalid Android component/);
  assert.throws(() => androidGuide({ tag: 'md-unknown' }, sources), /Missing Android support/);
  const incomplete = { ...sources }; delete incomplete[androidInstructionFiles.theme];
  assert.throws(() => androidGuide(component('md-button'), incomplete), /Missing Android instruction source: theme/);
  assert.throws(() => androidGuide(component('md-button'), { ...sources, [androidInstructionFiles.libraryBuild]: '// Unknown build' }), /Unrecognized Android build/);
  assert.ok(Object.values(androidInstructionFiles).every(file => !file.startsWith('/') && !file.split('/').includes('..')));
});
