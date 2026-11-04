import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { ACCORDION_APPEARANCE_FIELDS, ACCORDION_ITEM_APPEARANCE_FIELDS, normalizeAccordionAppearance, normalizeAccordionItemAppearance, accordionAppearanceCSS, accordionItemAppearanceCSS,
  parseAccordionAppearanceInput, parseAccordionItemAppearanceInput, formatAccordionItemAppearanceInput, accordionItemAppearanceNativeValue, accordionAppearanceNativeValue } from './accordion-appearance.js';
import { componentAppearance, componentAppearanceOptions } from './component-appearance.js';
import { createButtonAppearanceUI } from './button-appearance-ui.js';
import { nativeRenderRequest } from './contracts.js';
import { validateRenderRequest } from './native-render.mjs';
import { validateLiveInput } from './native-live.mjs';
import { ACCORDION_UPDATE_PROPERTIES, ACCORDION_ITEM_UPDATE_PROPERTIES, nativePropertyUpdate, supportsRetainedPropertyUpdates, dispatchRetainedPropertyEdit } from './native-property-updates.js';
import { nativeMethodCommand, nativeMethodSupported } from './native-methods.js';
import { recipeFor } from './recipes.js';
import { usageSnippet } from './usage-snippets.js';
import { nativeApiExample, nativeUsageExample } from './native-api-examples.js';

const packages = await readdir(new URL('../../node_modules/.pnpm/', import.meta.url));
const { JSDOM } = createRequire(import.meta.url)(new URL(`../../node_modules/.pnpm/${packages.find(name => name.startsWith('jsdom@'))}/node_modules/jsdom/lib/api.js`, import.meta.url).pathname);
const ir = async tag => JSON.parse(await readFile(new URL(`../../packages/native-compiler/generated/ir/${tag}.json`, import.meta.url), 'utf8'));
// Released native support declarations (generated from NativeSupport.json / support.json).
const group = await ir('md-accordion'), item = await ir('md-accordion-item');
const css = async tag => readFile(new URL(`../../packages/core/src/components/${tag}/${tag}.css`, import.meta.url), 'utf8');
const sample = field => ({ color: '#12345680', corners: '12px 4px / 6px 2px', length: '12px', opacity: '0.5', duration: '0.25s', insets: '8px 16px 12px', shadow: '0px 1px 3px rgba(0, 0, 0, 0.3), inset 0 4px 8px 3px #00000026' })[field.kind];
const parentStyles = Object.fromEntries(ACCORDION_APPEARANCE_FIELDS.map(f => [f.name, parseAccordionAppearanceInput(f.name, sample(f))]));
const itemStyles = Object.fromEntries(ACCORDION_ITEM_APPEARANCE_FIELDS.map(f => [f.name, parseAccordionItemAppearanceInput(f.name, sample(f))]));
const parentProps = { variant: 'outlined', density: -2, elevation: 3, reorderable: true, floating: true, initialX: 40.5, initialY: 12, bringToFront: false, exclusive: true, keepOneExpanded: true, headingLevel: 4, region: 'always', regionThreshold: 2, transition: 'none', defaultExpanded: '1' };
const itemProps = { headline: 'A & B', supportingText: 'Details', icon: 'palette', expanded: true, disabled: false, headingLevel: 2, collapsible: false, regionRole: 'group', contentMaxHeight: '50vh', density: -1 };

test('Accordion appearance exactly covers the fourteen parent and twenty-four item source hooks', async () => {
  const own = [...new Set((await css('md-accordion')).match(/--md-accordion-[a-z-]+/g))].filter(name => !name.startsWith('--md-accordion-item-')).sort();
  assert.deepEqual(own, ACCORDION_APPEARANCE_FIELDS.map(f => f.cssProperty).sort());
  assert.deepEqual([...new Set((await css('md-accordion-item')).match(/--md-accordion-item-[a-z-]+/g))].sort(), ACCORDION_ITEM_APPEARANCE_FIELDS.map(f => f.cssProperty).sort());
  assert.deepEqual(group.cssProperties.map(p => p.name).sort(), ACCORDION_APPEARANCE_FIELDS.map(f => f.cssProperty).sort());
  assert.deepEqual(item.cssProperties.map(p => p.name).sort(), ACCORDION_ITEM_APPEARANCE_FIELDS.map(f => f.cssProperty).sort());
  for (const platform of ['ios', 'android']) {
    assert.deepEqual([...group.support[platform].appearance.fields].sort(), ACCORDION_APPEARANCE_FIELDS.map(f => f.name).sort(), `${platform} parent appearance declaration`);
    assert.deepEqual([...item.support[platform].appearance.fields].sort(), ACCORDION_ITEM_APPEARANCE_FIELDS.map(f => f.name).sort(), `${platform} item appearance declaration`);
  }
  assert.equal(Object.keys(accordionAppearanceCSS(parentStyles)).length, 14);
  assert.equal(Object.keys(accordionItemAppearanceCSS(itemStyles)).length, 24);
});

test('typed hook kinds roundtrip CSS, native data and native literals', () => {
  const generated = accordionItemAppearanceCSS(itemStyles);
  assert.equal(generated['--md-accordion-item-elevation'], '0px 1px 3px 0px #0000004D, inset 0px 4px 8px 3px #00000026');
  assert.equal(generated['--md-accordion-item-header-padding'], '8px 16px 12px 16px');
  assert.equal(generated['--md-accordion-item-expand-duration'], '250ms');
  assert.equal(generated['--md-accordion-item-container-shape'], '12px 4px / 6px 2px');
  assert.equal(accordionAppearanceCSS({ elevation: [] })['--md-accordion-elevation'], 'none');
  assert.deepEqual(itemStyles.headerPadding, { top: 8, right: 16, bottom: 12, left: 16 });
  assert.deepEqual(itemStyles.elevation[1], { x: 0, y: 4, blur: 8, spread: 3, color: '#00000026', inset: true });
  for (const field of ACCORDION_ITEM_APPEARANCE_FIELDS) {
    const text = formatAccordionItemAppearanceInput(field.name, itemStyles[field.name]);
    assert.deepEqual(parseAccordionItemAppearanceInput(field.name, text), itemStyles[field.name], `${field.name} formats to reparseable CSS`);
  }
  assert.equal(accordionItemAppearanceNativeValue('headerPadding', itemStyles.headerPadding, 'swift'), 'AWCAccordionInsets(top: 8.0, right: 16.0, bottom: 12.0, left: 16.0)');
  assert.match(accordionItemAppearanceNativeValue('elevation', itemStyles.elevation, 'android'), /^listOf\(AWCBoxShadow\(x = 0\.0, y = 1\.0, blur = 3\.0, spread = 0\.0, color = "#0000004D"\), AWCBoxShadow\(.*inset = true\)\)$/);
  assert.match(accordionAppearanceNativeValue('floatingRadius', parentStyles.floatingRadius, 'swift'), /^AWCCornerShape\(/);
  assert.equal(accordionAppearanceNativeValue('gap', 12, 'swift'), undefined, 'scalar fields use the shared literal path');
  let accessed = false; const accessor = Object.defineProperty({}, 'headlineColor', { get() { accessed = true; return '#FFFFFF'; } });
  for (const value of [null, [], { headlineColor: '#FFF' }, { headerPadding: { top: 1 } }, { elevation: [{ x: 1, blur: -1 }] }, { expandDuration: -1 }, { gap: 1 }, accessor, { [Symbol('bad')]: 1 }]) {
    assert.throws(() => normalizeAccordionItemAppearance(value), { code: 'INVALID_ACCORDION_ITEM_APPEARANCE' });
  }
  assert.equal(accessed, false);
  for (const value of [{ dropPlaceholderOpacity: 2 }, { gap: -1 }, { floatingElevation: 'none' }, { containerShape: { topLeft: 'x' } }]) assert.throws(() => normalizeAccordionAppearance(value), { code: 'INVALID_ACCORDION_APPEARANCE' });
  for (const [name, raw] of [['elevation', '1px'], ['elevation', '1px 2px red'], ['headerPadding', '1px 2px 3px 4px 5px'], ['expandDuration', '300'], ['headerMinHeight', '2em'], ['containerColor', 'red']]) {
    assert.throws(() => normalizeAccordionItemAppearance({ [name]: parseAccordionItemAppearanceInput(name, raw) }), /./, `${name}: ${raw}`);
  }
});

test('panel transport retains every authored value and style for both tags', () => {
  for (const [component, props, styles, key] of [[group, parentProps, parentStyles, 'accordionAppearance'], [item, itemProps, itemStyles, 'accordionItemAppearance']]) {
    const request = nativeRenderRequest(component.tag, props, true, { ...componentAppearanceOptions({ selected: component, [key]: styles }), direction: 'rtl' });
    const valid = validateRenderRequest(request, new Set([component.tag]));
    assert.deepEqual(valid.properties, props); assert.deepEqual(valid[key], styles); assert.equal(valid.direction, 'rtl');
    const other = component === group ? 'md-accordion-item' : 'md-accordion';
    assert.throws(() => validateRenderRequest({ ...request, tag: other }, new Set([other])), { code: component === group ? 'INVALID_ACCORDION_APPEARANCE' : 'INVALID_ACCORDION_ITEM_APPEARANCE' });
  }
  assert.throws(() => validateRenderRequest({ tag: 'md-accordion', accordionAppearance: { gap: 'wide' } }, new Set(['md-accordion'])), { code: 'INVALID_ACCORDION_APPEARANCE' });
});

test('retained updates cover every source property with the source types, gated by released support', async () => {
  assert.deepEqual([...ACCORDION_UPDATE_PROPERTIES].sort(), group.properties.map(p => p.name).sort());
  assert.deepEqual([...ACCORDION_ITEM_UPDATE_PROPERTIES].sort(), item.properties.map(p => p.name).sort());
  assert.deepEqual(nativePropertyUpdate('md-accordion', parentProps), { command: 'update', properties: parentProps });
  assert.deepEqual(nativePropertyUpdate('md-accordion-item', itemProps), { command: 'update', properties: itemProps });
  for (const patch of [{ variant: 'plain' }, { elevation: 6 }, { headingLevel: 0 }, { region: 'auto ' }, { transition: 'slow' }, { floating: 'true' }, { initialX: Infinity }, { density: -5 }, { regionRole: 'group' }, { width: 1 }]) {
    assert.throws(() => nativePropertyUpdate('md-accordion', patch), { code: 'INVALID_PROPERTY_UPDATE' }, JSON.stringify(patch));
  }
  for (const patch of [{ regionRole: 'list' }, { expanded: 1 }, { headline: 'x'.repeat(4097) }, { variant: 'filled' }]) assert.throws(() => nativePropertyUpdate('md-accordion-item', patch), { code: 'INVALID_PROPERTY_UPDATE' });
  for (const component of [group, item]) for (const platform of ['ios', 'android']) {
    assert.equal(supportsRetainedPropertyUpdates(component, platform), true, `${component.tag} ${platform}`);
    const policy = component.support[platform];
    assert.equal(supportsRetainedPropertyUpdates({ ...component, support: { [platform]: { ...policy, properties: policy.properties.slice(1) } } }, platform), false);
  }
  const edits = []; const client = { canUpdate: () => true, update: async value => edits.push(value) };
  for (const value of [true, false]) assert.equal(dispatchRetainedPropertyEdit({ component: item, platform: 'ios', client, name: 'expanded', value }), true);
  await Promise.resolve(); assert.deepEqual(edits, [{ expanded: true }, { expanded: false }]);
});

test('item methods, pointer drags and the support gate use the released contract', () => {
  for (const platform of ['ios', 'android']) {
    for (const [component, key] of [[group, 'properties'], [group, 'events'], [item, 'properties'], [item, 'events'], [item, 'methods'], [item, 'slots'], [group, 'slots']]) {
      assert.deepEqual([...component.support[platform][key]].sort(), component[key].map(member => member.name).sort(), `${platform} ${component.tag} ${key}`);
    }
    assert.deepEqual(item.support[platform].visualParts, ['heading', 'header', 'state-layer', 'drag-handle', 'leading-icon', 'headline', 'supporting-text', 'trailing-icon', 'panel', 'content', 'content-inner']);
    assert.match(group.support[platform].notes.join(' '), /zIndex orders a panel only among siblings/);
    for (const method of ['toggle', 'focusHeader']) {
      assert.equal(nativeMethodSupported('md-accordion-item', method, item.support[platform]), true);
      assert.equal(nativeMethodSupported('md-accordion-item', method, { ...item.support[platform], methods: [] }), false);
    }
  }
  for (const method of ['toggle', 'focusHeader']) {
    assert.deepEqual(nativeMethodCommand('md-accordion-item', method, []), { command: 'method', method, arguments: [] });
    assert.throws(() => nativeMethodCommand('md-accordion-item', method, ['x']), { code: 'INVALID_METHOD' });
    assert.throws(() => nativeMethodCommand('md-accordion-item', method, [], { callId: 'a', target: 'component' }), { code: 'INVALID_METHOD' });
  }
  assert.throws(() => nativeMethodCommand('md-accordion', 'toggle', []), { code: 'INVALID_METHOD' });
  for (const tag of ['md-accordion', 'md-accordion-item']) {
    const context = { tag, logicalWidth: 640, logicalHeight: 400 };
    for (const phase of ['down', 'move', 'up']) assert.deepEqual(validateLiveInput({ command: 'pointer', phase, x: 120, y: 40 }, context), { command: 'pointer', phase, x: 120, y: 40 });
  }
});

test('all three Styles panels expose every hook and invalid input preserves the last valid appearance', t => {
  const dom = new JSDOM('<div id="button-appearance-controls"></div>'), previous = globalThis.document; globalThis.document = dom.window.document;
  t.after(() => { globalThis.document = previous; dom.window.close(); });
  for (const [component, fields, key, invalid] of [[group, ACCORDION_APPEARANCE_FIELDS, 'accordionAppearance', ['gap', '2em']], [item, ACCORDION_ITEM_APPEARANCE_FIELDS, 'accordionItemAppearance', ['elevation', '0 1px red']]]) {
    const state = { selected: component, platform: 'web', props: {} }; const ui = createButtonAppearanceUI({ getState: () => state, onChange() {} });
    for (const platform of ['web', 'ios', 'android']) {
      state.platform = platform; ui.render();
      assert.equal(document.querySelectorAll('[data-appearance-field]').length, fields.length, `${component.tag} ${platform}`);
      for (const field of fields) {
        const input = document.querySelector(`#appearance-${field.name}`);
        input.dispatchEvent(new dom.window.CustomEvent('mdInput', { detail: sample(field) }));
        assert.equal(input.error, false, `${field.name} accepts ${sample(field)}`);
      }
      assert.equal(Object.keys(state[key]).length, fields.length);
      const before = structuredClone(state[key][invalid[0]]);
      const input = document.querySelector(`#appearance-${invalid[0]}`);
      input.dispatchEvent(new dom.window.CustomEvent('mdInput', { detail: invalid[1] }));
      assert.equal(input.error, true); assert.deepEqual(state[key][invalid[0]], before);
    }
    const target = document.createElement(component.tag); ui.apply(target);
    for (const field of fields) assert.ok(target.style.getPropertyValue(field.cssProperty), `${field.cssProperty} applied`);
  }
});

test('framework snippets carry every hook with the correct native types', () => {
  for (const [component, styles, key, props] of [[group, parentStyles, 'accordionAppearance', { floating: true }], [item, itemStyles, 'accordionItemAppearance', { headline: 'Details' }]]) {
    const profile = componentAppearance(component.tag);
    for (const platform of ['html', 'react', 'angular', 'vue', 'svelte', 'swift', 'android']) {
      const code = usageSnippet(component, props, platform, { html: recipeFor(component.tag).html, [key]: styles });
      assert.doesNotMatch(code, /\[object Object\]/);
      for (const field of profile.fields) assert.match(code, new RegExp(['swift', 'android'].includes(platform) ? `\\b${field.name}${platform === 'swift' ? ':' : ' ='}` : field.cssProperty), `${component.tag} ${platform} ${field.name}`);
      if (platform === 'swift') assert.match(code, new RegExp(`\\.${profile.swiftModifier}\\(\\.init\\(`));
      if (platform === 'android') assert.match(code, new RegExp(`${profile.nativeType}Scope\\(appearance = ${profile.nativeType}\\(`));
      if (['swift', 'android'].includes(platform)) { assert.match(code, /AWCBoxShadow\(/); assert.match(code, /AWCCornerShape\(/); }
      if (['swift', 'android'].includes(platform) && component === item) assert.match(code, /AWCAccordionInsets\(top/);
    }
  }
  // A copied floating accordion carries the viewport the Laboratory hosts use; an in-flow one does not.
  for (const [platform, viewport] of [['swift', /\.awcAccordionViewport\(\)/], ['android', /AWCAccordionViewport\(modifier = Modifier\.fillMaxWidth\(\)\.heightIn\(min = 320\.dp\)\)/]]) {
    assert.match(usageSnippet(group, { floating: true }, platform, { html: recipeFor(group.tag).html }), viewport);
    assert.doesNotMatch(usageSnippet(group, { floating: false }, platform, { html: recipeFor(group.tag).html }), /AccordionViewport/);
  }
  assert.match(usageSnippet(group, { floating: true }, 'android', { html: recipeFor(group.tag).html }), /import dev\.awc\.nativeui\.AWCAccordionViewport\nimport androidx\.compose\.ui\.Modifier\n/);
});

test('native API examples use the verified viewport, controller, typed parts and hooks', () => {
  for (const platform of ['swift', 'android']) {
    const usage = nativeUsageExample(group, platform);
    assert.match(usage.code, /A shared design language/); assert.match(usage.code, /Native by design/);
    assert.match(nativeApiExample(group, 'event', 'mdReorder', platform).code, platform === 'swift' ? /"reorderable": \.bool\(true\)/ : /"reorderable" to true/);
    for (const name of ['mdDragStart', 'mdDragMove', 'mdDragEnd']) {
      const example = nativeApiExample(group, 'event', name, platform);
      assert.match(example.code, platform === 'swift' ? /\.awcAccordionViewport\(\)/ : /AWCAccordionViewport\(modifier/); assert.match(example.code, platform === 'swift' ? /"floating": \.bool\(true\)/ : /"floating" to true/);
    }
    for (const name of ['mdItemRequestFocus', 'mdItemRequestReorder']) assert.match(nativeApiExample(item, 'event', name, platform).code, /md-accordion"/);
    for (const method of ['toggle', 'focusHeader']) {
      const example = nativeApiExample(item, 'method', method, platform);
      assert.equal(example.status, 'supported'); assert.match(example.code, new RegExp(`controller\\.${method}\\(\\)`));
      assert.match(example.code, platform === 'swift' ? /\.awcAccordionItemController\(controller, for: "md-accordion-item"\)/ : /AWCAccordionItemControllerScope\(controller\)/);
    }
    for (const part of item.support.ios.visualParts) {
      const example = nativeApiExample(item, 'cssPart', part, platform);
      assert.equal(example.status, 'native-equivalent', part);
      assert.match(example.code, platform === 'swift' ? /\.awcAccordionItemPartAppearance\(\.init\(/ : /AWCAccordionItemPartAppearanceScope\(AWCAccordionItemPart\.[A-Z]/, part);
    }
    for (const part of ['chassis-handle', 'chassis-handle-bar']) assert.match(nativeApiExample(item, 'cssPart', part, platform).code, /chassisHandleColor/);
    assert.match(nativeApiExample(group, 'cssPart', 'drop-placeholder', platform).code, /dropPlaceholderColor/);
    for (const slot of ['', 'leading-icon', 'headline', 'trailing-icon']) assert.ok(nativeApiExample(item, 'slot', slot, platform).code, `slot ${slot}`);
  }
});
