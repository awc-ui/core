import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { nativeApiExample } from './native-api-examples.js';

const ios = JSON.parse(await readFile(new URL('../../packages/native-ios/NativeSupport.json', import.meta.url))).components;
const android = JSON.parse(await readFile(new URL('../../packages/native-android/support.json', import.meta.url))).components;
const component = tag => ({ tag, support: { ios: ios[tag], android: android[tag] } });
const platforms = ['swift', 'android'];

test('button click demonstrates native synchronous cancellation and proposed payload', () => {
  const swift = nativeApiExample(component('md-button'), 'event', { name: 'mdClick' }, 'swift');
  assert.equal(swift.status, 'supported');
  assert.equal(swift.language, 'swift');
  assert.match(swift.code, /AWCEventScope\(id: "save-actions", onEvent:/);
  assert.match(swift.code, /guard context\.event\.name == "mdClick" else/);
  assert.match(swift.code, /detail\["selected"\]\.bool/);
  assert.match(swift.code, /detail\["value"\]\.string/);
  assert.match(swift.code, /if !allowActivation \{ context\.preventDefault\(\) \}/);
  const kotlin = nativeApiExample(component('md-button'), 'event', 'mdClick', 'android');
  assert.equal(kotlin.language, 'kotlin');
  assert.match(kotlin.code, /AWCActionScope\(onAction = \{ event ->/);
  assert.match(kotlin.code, /event\.detail\["selected"\] as\? Boolean/);
  assert.match(kotlin.code, /if \(!allowActivation\) event\.preventDefault\(\)/);
  for (const result of [swift, kotlin]) {
    assert.match(result.description, /before toggle, navigation or form/);
    assert.match(result.notes.join(' '), /synchronously/);
    assert.match(result.notes.join(' '), /onEvent callback is an observation/);
    assert.doesNotMatch(result.code, /originalEvent|CustomEvent|HTMLElement|addEventListener/);
  }
});

test('button change updates committed selected state, never offers cancellation', () => {
  for (const platform of platforms) {
    const result = nativeApiExample(component('md-button'), 'event', 'mdChange', platform);
    assert.equal(result.status, 'supported');
    assert.match(result.code, /selected = /);
    assert.match(result.code, /"selected"/);
    assert.match(result.code, /"value"/);
    assert.match(result.code, /"mdChange"/);
    assert.match(result.code, /Text\("Selected:/);
    assert.doesNotMatch(result.code, /preventDefault/);
    assert.match(result.notes.join(' '), /not cancelable/);
  }
});

test('generic event handling filters the selected event and consumes native payloads', () => {
  const swift = nativeApiExample(component('md-text-field'), 'event', 'mdInput', 'swift');
  assert.equal(swift.status, 'supported');
  assert.match(swift.code, /guard event\.name == "mdInput"/);
  assert.match(swift.code, /lastPayload = event\.detail\.json/);
  assert.match(swift.code, /Text\(lastPayload\)/);
  const kotlin = nativeApiExample(component('md-text-field'), 'event', 'mdInput', 'android');
  assert.match(kotlin.code, /if \(name == "mdInput"\)/);
  assert.match(kotlin.code, /lastPayload = detail\?\.toString\(\)/);
  assert.match(kotlin.notes.join(' '), /can differ from the source TypeScript/);
});

test('slot examples use actual native content assignment and activate conditional button loader', () => {
  const swift = nativeApiExample(component('md-button'), 'slot', 'leading-icon', 'swift');
  assert.match(swift.code, /\.text\("★", slot: "leading-icon"\)/);
  assert.match(swift.code, /\.text\("Continue"\)/);
  const kotlin = nativeApiExample(component('md-button'), 'slot', 'trailing-icon', 'android');
  assert.match(kotlin.code, /if \(slot == "trailing-icon"\)/);
  assert.match(kotlin.code, /Text\("→"\)/);
  for (const platform of platforms) {
    const loader = nativeApiExample(component('md-button'), 'slot', 'loader', platform);
    assert.match(loader.code, /"loading"/);
    assert.match(loader.code, /"md-loading-indicator"/);
    assert.match(loader.notes.join(' '), /loading must be true/);
    const defaultSlot = nativeApiExample(component('md-button'), 'slot', '(default)', platform);
    assert.equal(defaultSlot.status, 'supported');
    assert.match(defaultSlot.code, /Continue/);
    assert.doesNotMatch(defaultSlot.code, /\(default\)/);
  }
});

test('structural default slots compose native child components', () => {
  for (const platform of platforms) {
    const tabs = nativeApiExample(component('md-tabs'), 'slot', '', platform);
    assert.match(tabs.code, /"md-tabs"/);
    assert.match(tabs.code, /"md-tab"/);
    assert.match(tabs.code, /Overview/);
    const table = nativeApiExample(component('md-table'), 'slot', '', platform);
    assert.match(table.code, /"md-table-body"/);
    assert.match(table.code, /"md-table-row"/);
    assert.match(table.code, /"md-table-cell"/);
  }
});

test('all declared button visual parts have native appearance examples using supported fields', () => {
  for (const platform of platforms) {
    const policy = platform === 'swift' ? ios['md-button'] : android['md-button'];
    for (const part of policy.visualParts) {
      const example = nativeApiExample(component('md-button'), 'cssPart', part, platform);
      assert.equal(example.status, 'native-equivalent', part);
      assert.equal(typeof example.code, 'string', part);
      assert.match(example.notes.join(' '), /CSS ::part\(\) selectors remain Web-only/);
      if (platform === 'swift') assert.match(example.code, /\.awcButtonAppearance\(\.init\(/);
      else assert.match(example.code, /AWCButtonAppearanceScope\(appearance = AWCButtonAppearance\(/);
      assert.doesNotMatch(example.code, /::part|style=|document\./);
    }
    assert.match(nativeApiExample(component('md-button'), 'cssPart', 'loading', platform).code, /"loading"/);
    assert.match(nativeApiExample(component('md-button'), 'cssPart', 'icon', platform).code, /"icon"/);
    assert.match(nativeApiExample(component('md-button'), 'cssPart', 'anchor', platform).notes.join(' '), /no native HTML anchor/);
  }
});

test('native appearance examples honor declared field coverage rather than inventing fields', () => {
  const narrowed = { tag: 'md-button', support: { ios: { visualParts: ['label'], appearance: { fields: ['labelColor'] } } } };
  const result = nativeApiExample(narrowed, 'cssPart', 'label', 'swift');
  assert.match(result.code, /labelColor:/);
  assert.doesNotMatch(result.code, /fontSize:|fontWeight:/);
  narrowed.support.ios.appearance.fields = [];
  assert.equal(nativeApiExample(narrowed, 'cssPart', 'label', 'swift').code, null);
});

test('supported declarative method alternatives show state changes and disclose behavioral differences', () => {
  for (const platform of platforms) {
    const show = nativeApiExample(component('md-dialog'), 'method', 'show', platform);
    assert.equal(show.status, 'native-equivalent');
    assert.match(show.description, /no native method bridge/);
    assert.match(show.code, /value = true/);
    assert.match(show.code, /"open"/);
    assert.match(show.code, /"mdClose"/);
    assert.match(show.notes.join(' '), /does not invoke the source method/);
    assert.doesNotMatch(show.code, /\.show\(/);
    const close = nativeApiExample(component('md-dialog'), 'method', 'close', platform);
    assert.match(close.code, /(?:value: Bool = true|mutableStateOf\(true\))/);
    assert.match(close.code, /value = false/);
    const clear = nativeApiExample(component('md-otp-field'), 'method', 'clear', platform);
    assert.equal(clear.status, 'native-equivalent');
    assert.match(clear.code, /value = ""/);
    assert.match(clear.code, /"mdInput"/);
  }
});

test('unbridged methods and web parts never produce fake native calls', () => {
  for (const platform of platforms) {
    for (const [tag, method] of [['md-text-field', 'getInputElement'], ['md-dialog', 'whenClosed'], ['md-slider', 'setFocus'], ['md-line-chart', 'getInstance']]) {
      const result = nativeApiExample(component(tag), 'method', method, platform);
      assert.equal(result.status, 'unsupported');
      assert.equal(result.code, null);
      assert.match(result.description, /no public .* method bridge/);
    }
    const part = nativeApiExample(component('md-text-field'), 'cssPart', 'input', platform);
    assert.equal(part.code, null);
    assert.match(part.description, /Web styling hook/);
  }
});

test('platform support and unknown coverage gate example code', () => {
  for (const platform of platforms) {
    const key = platform === 'swift' ? 'ios' : 'android';
    const unavailable = { tag: 'md-button', support: { [key]: { events: ['mdClick'], unsupportedEvents: ['mdClick'] } } };
    assert.equal(nativeApiExample(unavailable, 'event', 'mdClick', platform).status, 'unsupported');
    assert.equal(nativeApiExample(unavailable, 'event', 'mdClick', platform).code, null);
    assert.equal(nativeApiExample({ tag: 'md-button' }, 'event', 'mdClick', platform).status, 'unknown');
    assert.equal(nativeApiExample({ tag: 'md-button' }, 'slot', 'loader', platform).code, null);
    const missing = { tag: 'md-dialog', support: { [key]: { status: 'missing-adapter', properties: ['open'], events: ['mdOpen'] } } };
    for (const [kind, name] of [['event', 'mdOpen'], ['method', 'show']]) {
      assert.equal(nativeApiExample(missing, kind, name, platform).status, 'unsupported');
      assert.equal(nativeApiExample(missing, kind, name, platform).code, null);
    }
  }
});

test('member data is escaped as Swift and Kotlin literals', () => {
  const name = 'event"\\(injected)${danger()}\n\0';
  const fixture = { tag: 'md-card', support: { ios: { events: [name] }, android: { events: [name] } } };
  const swift = nativeApiExample(fixture, 'event', name, 'swift');
  assert.ok(swift.code.includes('"event\\"\\\\(injected)${danger()}\\n\\u{0}"'));
  const kotlin = nativeApiExample(fixture, 'event', name, 'android');
  assert.ok(kotlin.code.includes('"event\\"\\\\(injected)\\${danger()}\\n\\u0000"'));
  assert.equal(kotlin.code.includes('\0'), false);
});

test('invalid native API inputs fail explicitly', () => {
  assert.throws(() => nativeApiExample(component('md-button'), 'event', 'mdClick', 'web'), /platform/);
  assert.throws(() => nativeApiExample(component('md-button'), 'property', 'value', 'swift'), /kind/);
  assert.throws(() => nativeApiExample({ tag: 'bad"code' }, 'event', 'x', 'swift'), /valid component tag/);
});
