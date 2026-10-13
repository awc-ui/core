import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { nativeApiExample, nativeUsageExample, nativeThemeExample } from './native-api-examples.js';

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
  assert.match(swift.code, /guard event.tag == "md-text-field", event\.name == "mdInput"/);
  assert.match(swift.code, /value = event.detail.string/);
  assert.match(swift.code, /lastPayload = event\.detail\.json/);
  assert.match(swift.code, /Text\(lastPayload\)/);
  const kotlin = nativeApiExample(component('md-text-field'), 'event', 'mdInput', 'android');
  assert.match(kotlin.code, /if \(name == "mdInput"\)/);
  assert.match(kotlin.code, /lastPayload = detail\?\.toString\(\)/);
  assert.match(kotlin.code, /value = detail as\? String/);
  assert.match(kotlin.notes.join(' '), /detail is a string/);
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
  const fallback = nativeApiExample(narrowed, 'cssPart', 'label', 'swift');
  assert.match(fallback.code, /awcTheme/);
  assert.doesNotMatch(fallback.code, /awcButtonAppearance/);
  assert.match(fallback.description, /does not target this part/);
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
    assert.equal(part.status, 'unknown');
    assert.match(part.code, platform === 'swift' ? /awcTheme/ : /AWCTheme\(tokenOverrides/);
    assert.match(part.description, /Web styling hook/);
    assert.match(part.description, /does not target this part/);
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

test('all 81 catalog components have bounded native starter and theme recipes on both platforms', async () => {
  const catalog = JSON.parse(await readFile(new URL('../../packages/native-compiler/generated/catalog.json', import.meta.url))).components;
  assert.equal(catalog.length, 81);
  for (const item of catalog) for (const platform of platforms) {
    const result = nativeUsageExample({ ...item, ...component(item.tag) }, platform);
    assert.ok(result.code, `${platform} ${item.tag}`);
    assert.match(result.code, platform === 'swift' ? /AWCNativeView\(/ : /AWCComponent\(/);
    assert.ok(result.code.includes(`"${item.tag}"`), item.tag);
    assert.doesNotMatch(result.code, /document\.|querySelector|HTMLElement|addEventListener|TODO/);
    const theme = nativeThemeExample(component(item.tag), platform);
    assert.match(theme.code, /--md-sys-color-primary/);
    assert.match(theme.notes.join(' '), /not a mapping of CSS parts/);
  }
});

test('native state contracts distinguish scalar, map, array and index payloads', () => {
  const cases = [
    ['md-switch', 'mdChange', 'selected', /detail\["selected"\]\.bool/, /get\("selected"\) as\? Boolean/],
    ['md-checkbox', 'mdChange', 'checked', /detail\["checked"\]\.bool/, /get\("checked"\) as\? Boolean/],
    ['md-number-field', 'mdInput', 'value', /detail\["value"\]\.number/, /get\("value"\) as\? Number/],
    ['md-rating', 'mdChange', 'value', /event.detail.number/, /detail as\? Number/],
    ['md-multi-select', 'mdChange', 'value', /detail.array.map\(\\.string\)/, /detail as\? List<\*>/],
    ['md-tabs', 'mdTabChange', 'activeTabIndex', /Int\(event.detail\["index"\].number/, /get\("index"\) as\? Number/],
    ['md-stepper', 'mdStepChange', 'active', /Int\(event.detail\["index"\].number/, /get\("index"\) as\? Number/],
    ['md-organization-chart', 'mdSelectionChange', 'selectedIds', /detail\["selectedIds"\].array/, /get\("selectedIds"\) as\? List/],
  ];
  for (const [tag, event, property, swiftRead, androidRead] of cases) for (const platform of platforms) {
    const example = nativeApiExample(component(tag), 'event', event, platform);
    assert.equal(example.status, 'supported');
    assert.match(example.code, platform === 'swift' ? swiftRead : androidRead, `${tag} ${platform}`);
    assert.ok(example.code.includes(`"${property}"`));
    assert.match(example.description, new RegExp(`supported ${property} property`));
  }
});

test('data and navigation starters include actual fixtures and multiple actionable native children', () => {
  for (const platform of platforms) {
    for (const tag of ['md-line-chart', 'md-area-chart', 'md-bar-chart']) {
      const example = nativeUsageExample(component(tag), platform);
      assert.match(example.code, /"series"/);
      assert.match(example.code, /"data"/);
      assert.match(example.code, /Weekly activity/);
    }
    assert.match(nativeUsageExample(component('md-pie-chart'), platform).code, /Team distribution/);
    assert.match(nativeUsageExample(component('md-transfer-list'), platform).code, /"items"/);
    const tabs = nativeUsageExample(component('md-tabs'), platform).code;
    assert.match(tabs, /Overview/);
    assert.match(tabs, /Details/);
    if (platform === 'swift') {
      assert.match(tabs, /AWCNode\(id: "example-0"/);
      assert.match(tabs, /AWCNode\(id: "example-1"/);
    }
  }
});

test('declarative method alternatives cover verified selection, option-data, pagination and expansion APIs', () => {
  for (const platform of platforms) for (const [tag, name, property] of [
    ['md-date-picker', 'show', 'open'], ['md-time-picker', 'hide', 'open'], ['md-tooltip', 'show', 'open'],
    ['md-tabs', 'selectTab', 'activeTabIndex'], ['md-navigation-bar', 'select', 'activeIndex'],
    ['md-stepper', 'next', 'active'], ['md-stepper', 'prev', 'active'],
    ['md-select', 'loadOptions', 'options'], ['md-multi-select', 'reset', 'value'],
    ['md-table-pagination', 'goToPage', 'page'], ['md-table-pagination', 'setRowsPerPage', 'rowsPerPage'],
    ['md-table-row', 'toggle', 'expanded'], ['md-accordion-item', 'toggle', 'expanded'], ['md-radio', 'select', 'checked'],
  ]) {
    const example = nativeApiExample(component(tag), 'method', name, platform);
    assert.equal(example.status, 'native-equivalent', `${tag}.${name} ${platform}`);
    assert.ok(example.code.includes(`"${property}"`));
    assert.match(example.description, /no native method bridge/);
    assert.doesNotMatch(example.code, new RegExp(`\\.${name}\\(`));
  }
  assert.equal(nativeApiExample(component('md-color-picker'), 'method', 'show', 'swift').code, null, 'Swift color picker has no declared open property');
  assert.ok(nativeApiExample(component('md-color-picker'), 'method', 'show', 'android').code);
});

test('conditional slots request their visible native states', () => {
  assert.match(nativeApiExample(component('md-switch'), 'slot', 'selected-icon', 'swift').code, /"selected": .bool\(true\)/);
  assert.match(nativeApiExample(component('md-line-chart'), 'slot', 'loader', 'swift').code, /"loading": .bool\(true\)/);
  const emptyChart = nativeApiExample(component('md-line-chart'), 'slot', 'empty', 'swift');
  assert.match(emptyChart.code, /"series": .array\(\[\]\)/);
});
