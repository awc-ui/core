import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SEARCH_APPEARANCE_FIELDS, SEARCH_PARTS, SEARCH_PART_FIELDS, SEARCH_UPDATE_PROPERTIES, searchAppearance, validSearchUpdate } from './search-appearance.js';
import { componentAppearance } from './component-appearance.js';
import { nativeThemeOptions } from './native-theme-options.js';
import { validateRenderRequest } from './native-render.mjs';
import { nativePropertyUpdate, supportsRetainedPropertyUpdates } from './native-property-updates.js';
import { nativeSelectionMethod, nativeMethodSupported, nativeMethodCommand } from './native-methods.js';
import { nativeApiExample } from './native-api-examples.js';

// md-search in the Laboratory: the sixty typed hooks (shadow list, font, weight, durations, cubic-bezier easings), retained
// updates of every source property, the controller methods, the typed parts, released policies and examples.
const ir = JSON.parse(await readFile(new URL('../../packages/native-compiler/generated/ir/md-search.json', import.meta.url), 'utf8'));
const policies = { ios: JSON.parse(await readFile(new URL('../../packages/native-ios/NativeSupport.json', import.meta.url), 'utf8')).components['md-search'],
  android: JSON.parse(await readFile(new URL('../../packages/native-android/support.json', import.meta.url), 'utf8')).components['md-search'] };
const component = { ...ir, support: policies };
const typedParts = Object.keys(SEARCH_PARTS);

test('the sixty hooks cover the IR and both released policies', () => {
  assert.equal(SEARCH_APPEARANCE_FIELDS.length, 60);
  // Every documented hook is typed; the stylesheet reads seven more (state-layer opacities, the full-screen bar offsets and
  // collapse duration, the contained background and docked panel offset), typed as well.
  const documented = ir.cssProperties.map(p => p.name), typed = SEARCH_APPEARANCE_FIELDS.map(f => f.cssProperty);
  for (const name of documented) assert.ok(typed.includes(name), name);
  assert.deepEqual(typed.filter(name => !documented.includes(name)).sort(), ['--md-search-contained-background-color', '--md-search-contained-docked-panel-offset',
    '--md-search-fullscreen-bar-offset-block-start', '--md-search-fullscreen-bar-offset-inline', '--md-search-fullscreen-collapse-duration',
    '--md-search-hover-state-layer-opacity', '--md-search-pressed-state-layer-opacity']);
  for (const platform of ['ios', 'android']) {
    const p = policies[platform];
    assert.deepEqual(p.appearance.fields, SEARCH_APPEARANCE_FIELDS.map(f => f.name), platform);
    assert.deepEqual(p.properties, ir.properties.map(x => x.name).filter(n => n !== 'triggerElement'), platform);
    assert.deepEqual(p.methods, ir.methods.map(x => x.name), platform);
    assert.deepEqual(p.events, ir.events.map(x => x.name), platform);
    assert.deepEqual(p.slots, ir.slots.map(x => x.name), platform);
    assert.deepEqual(p.visualParts, typedParts, platform);
  }
  assert.deepEqual(policies.ios.unsupportedProperties, ['triggerElement']);
  // Typed parts are source parts; the untyped ones are the hidden live region, the layout wrappers and the loading indicator's own.
  const parts = ir.cssParts.map(x => x.name);
  for (const part of typedParts) assert.ok(parts.includes(part), part);
  assert.deepEqual(parts.filter(part => !typedParts.includes(part)).sort(), []);  // all 19 parts are typed (session 8)
  assert.deepEqual(Object.values(SEARCH_PARTS).flat(), [...SEARCH_PART_FIELDS]);
  const registry = componentAppearance('md-search');
  assert.equal(registry.key, 'searchAppearance'); assert.equal(registry.swiftModifier, 'awcSearchAppearance'); assert.equal(registry.nativeType, 'AWCSearchAppearance');
  assert.deepEqual(registry.groups.flatMap(([, names]) => names).sort(), SEARCH_APPEARANCE_FIELDS.map(f => f.name).sort());
});

test('hook values normalize, render as CSS and round-trip through the inputs', () => {
  const value = { containerColor: '#FFF3E0', containerElevation: [{ x: 0, y: 2, blur: 6, spread: 0, color: '#00000055', inset: false }], iconColor: '#2E7D32', containerShape: 16,
    containerHeight: 64, inputFontFamily: 'Roboto Mono', inputFontSize: 18, inputFontWeight: 500, expandDuration: 250, expandEasing: [0.34, 1.56, 0.64, 1],
    fullscreenCollapseEasing: [0.2, 0, 0, 1], hoverStateLayerOpacity: 0.1, dividerThickness: 3 };
  const css = searchAppearance.css(value);
  assert.equal(Object.keys(css).length, Object.keys(value).length);
  assert.equal(css['--md-search-expand-easing'], 'cubic-bezier(0.34, 1.56, 0.64, 1)'); assert.equal(css['--md-search-expand-duration'], '250ms');
  assert.equal(css['--md-search-container-height'], '64px'); assert.equal(css['--md-search-container-elevation'], '0px 2px 6px 0px #00000055');
  for (const name of Object.keys(value)) assert.deepEqual(searchAppearance.parseInput(name, searchAppearance.formatInput(name, value[name])), value[name], name);
  for (const bad of [{ expandEasing: [2, 0, 0, 1] }, { expandEasing: [0.2, 0, 0] }, { expandEasing: 'ease' }, { containerShape: -1 }, { hoverStateLayerOpacity: 2 }, { iconColor: 'red' },
    { expandDuration: -1 }, { width: 2 }])
    assert.throws(() => searchAppearance.normalize(bad), { code: 'INVALID_SEARCH_APPEARANCE' }, JSON.stringify(bad));
  assert.throws(() => searchAppearance.parseInput('expandEasing', 'ease-in'), { code: 'INVALID_SEARCH_APPEARANCE' });
  assert.equal(searchAppearance.nativeValue('expandEasing', [0.2, 0, 0, 1], 'swift'), '[0.2, 0, 0, 1]');
  assert.equal(searchAppearance.nativeValue('expandEasing', [0.2, 0, 0, 1], 'kotlin'), 'listOf(0.2, 0.0, 0.0, 1.0)');
  assert.match(searchAppearance.nativeValue('containerElevation', value.containerElevation, 'swift'), /^\[AWCBoxShadow\(/);
  assert.deepEqual(nativeThemeOptions({ searchAppearance: { expandEasing: [0.2, 0, 0, 1] } }).searchAppearance, { expandEasing: [0.2, 0, 0, 1] });
  assert.doesNotThrow(() => validateRenderRequest({ tag: 'md-search', properties: {}, searchAppearance: { containerHeight: 64, expandEasing: [0.2, 0, 0, 1] } }, new Set(['md-search'])));
  assert.throws(() => validateRenderRequest({ tag: 'md-search', properties: {}, searchAppearance: { expandEasing: [0.2] } }, new Set(['md-search'])));
});

test('retained updates of every source property except the trigger element', () => {
  assert.deepEqual([...SEARCH_UPDATE_PROPERTIES].sort(), ir.properties.map(p => p.name).filter(n => n !== 'triggerElement').sort());
  for (const platform of ['ios', 'android']) assert.ok(supportsRetainedPropertyUpdates(component, platform), platform);
  const ok = { variant: 'divided', layout: 'docked', trigger: 'icon', triggerIcon: 'tune', value: 'pro', placeholder: 'Find', open: true, disabled: false, elevation: 3,
    leadingIcon: 'menu', showClearButton: false, voiceSearch: true, maxBlockSize: '400px', initialFocus: 'leading', loading: true, debounce: 250, throttle: 0, density: -2 };
  for (const [key, value] of Object.entries(ok)) assert.deepEqual(nativePropertyUpdate('md-search', { [key]: value }), { command: 'update', properties: { [key]: value } }, key);
  for (const [key, value] of [['variant', 'plain'], ['layout', 'inline'], ['density', -5], ['elevation', 6], ['debounce', -1], ['open', 'true'], ['triggerElement', 'x'], ['bogus', 1]])
    assert.throws(() => nativePropertyUpdate('md-search', { [key]: value }), undefined, key);
  assert.equal(validSearchUpdate('trigger', ''), true);
});

test('controller methods and their examples', () => {
  for (const name of ['show', 'close', 'toggle', 'focusInput']) {
    assert.ok(nativeSelectionMethod('md-search', name), name);
    assert.ok(nativeMethodSupported('md-search', name, policies.ios), name);
    assert.deepEqual(nativeMethodCommand('md-search', name, []), { command: 'method', method: name, arguments: [] }, name);
    assert.throws(() => nativeMethodCommand('md-search', name, [1]), undefined, name);
  }
  // whenClosed and the voice methods are native API the preview does not run (no microphone in the preview host).
  for (const name of ['whenClosed', 'startVoice', 'stopVoice']) assert.equal(nativeMethodSupported('md-search', name, policies.ios), false, name);
  for (const platform of ['swift', 'android']) {
    for (const name of ir.methods.map(m => m.name)) {
      const example = nativeApiExample(component, 'method', name, platform);
      assert.equal(example.status, 'supported', `${platform} ${name}`);
      assert.match(example.code, new RegExp(name === 'whenClosed' ? 'controller\\.whenClosed \\{' : `controller\\.${name}\\(\\)`), `${platform} ${name}`);
      assert.match(example.code, platform === 'swift' ? /awcSearchController\(controller, for: "md-search"\)/ : /AWCSearchControllerScope\(controller\)/);
    }
  }
});

test('typed part examples for every typed part (all 19)', () => {
  for (const platform of ['swift', 'android']) {
    for (const part of typedParts) {
      const example = nativeApiExample(component, 'cssPart', part, platform);
      assert.equal(example.status, 'native-equivalent', `${platform} ${part}`);
      assert.match(example.code, platform === 'swift' ? /\.awcSearchPartAppearance\(\.init\(/ : /AWCSearchPartAppearanceScope\(AWCSearchPartAppearance\(/, part);
      for (const field of SEARCH_PARTS[part]) assert.match(example.code, new RegExp(`${field}${platform === 'swift' ? ': ' : ' = '}`), `${part} ${field}`);
    }
    // status (visually hidden) and trigger (display: contents) are typed too: stored, nothing paints (Chrome cases x-*).
    assert.ok(typedParts.includes('status') && typedParts.includes('trigger'));
  }
});
