import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { STEPPER_APPEARANCE_FIELDS, stepperAppearance, STEP_APPEARANCE_FIELDS, stepAppearance, STEPPER_UPDATE_PROPERTIES, validStepperUpdate, STEPPER_METHODS } from './stepper-appearance.js';
import { componentAppearance } from './component-appearance.js';
import { nativeThemeOptions } from './native-theme-options.js';
import { validateRenderRequest } from './native-render.mjs';
import { nativePropertyUpdate, supportsRetainedPropertyUpdates } from './native-property-updates.js';
import { nativeMethodSupported, nativeMethodCommand } from './native-methods.js';
import { nativeApiExample } from './native-api-examples.js';

// md-stepper and md-step in the Laboratory: typed hooks (the --md-step-* hooks a stepper passes on, and --md-stepper-gap),
// retained updates of every source property, next() / prev() / goTo() / reset() with their examples, the released policies.
const TAGS = ['md-stepper', 'md-step'];
const INTERNAL = ['--md-stepper-step-count', '--md-step-idx'];   // stamped by the component, not hooks
const read = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const ios = (await read('../../packages/native-ios/NativeSupport.json')).components, android = (await read('../../packages/native-android/support.json')).components;
const irs = Object.fromEntries(await Promise.all(TAGS.map(async tag => [tag, await read(`../../packages/native-compiler/generated/ir/${tag}.json`)])));
const component = tag => ({ ...irs[tag], support: { ios: ios[tag], android: android[tag] } });
const profileOf = tag => tag === 'md-stepper' ? stepperAppearance : stepAppearance;
const hooksOf = tag => irs[tag].cssProperties.map(p => p.name).filter(n => !INTERNAL.includes(n));

test('the hooks cover each IR (a stepper carries the step hooks) and both released policies', () => {
  assert.deepEqual(stepperAppearance.fields.map(f => f.cssProperty).sort(), [...hooksOf('md-stepper'), ...hooksOf('md-step')].sort());
  assert.deepEqual(stepAppearance.fields.map(f => f.cssProperty).sort(), hooksOf('md-step').sort());
  for (const tag of TAGS) {
    const ir = irs[tag], fields = profileOf(tag).fields;
    for (const [platform, p] of [['ios', ios[tag]], ['android', android[tag]]]) {
      assert.deepEqual(p.appearance.fields, fields.map(f => f.name), `${platform} ${tag}`);
      for (const kind of ['properties', 'methods', 'events', 'slots']) assert.deepEqual(p[kind], ir[kind].map(x => x.name), `${platform} ${tag} ${kind}`);
      for (const kind of ['unsupportedProperties', 'unsupportedEvents', 'unsupportedMethods', 'unsupportedSlots']) assert.deepEqual(p[kind] ?? [], [], `${platform} ${tag} ${kind}`);
    }
    const registry = componentAppearance(tag);
    assert.equal(registry.nativeType, 'AWCStepperAppearance', tag);
    assert.equal(registry.key, tag === 'md-stepper' ? 'stepperAppearance' : 'stepAppearance', tag);
    assert.deepEqual(registry.groups.flatMap(([, names]) => names).sort(), fields.map(f => f.name).sort(), tag);
  }
  assert.equal(STEPPER_APPEARANCE_FIELDS.length, 23); assert.equal(STEP_APPEARANCE_FIELDS.length, 22);
});

test('hook values normalize, render as CSS and round-trip through the inputs', () => {
  const v = { activeColor: '#C62828', indicatorSize: 40, connectorThickness: 6, expandDuration: 300, gap: 12, labelActiveColor: '#1B5E20' };
  const css = stepperAppearance.css(v);
  assert.equal(css['--md-step-active-color'], '#C62828'); assert.equal(css['--md-step-indicator-size'], '40px');
  assert.equal(css['--md-step-expand-duration'], '300ms'); assert.equal(css['--md-stepper-gap'], '12px');
  for (const f of STEPPER_APPEARANCE_FIELDS) if (v[f.name] !== undefined) assert.deepEqual(stepperAppearance.parseInput(f.name, stepperAppearance.formatInput(f.name, v[f.name])), v[f.name], f.name);
  for (const bad of [{ indicatorSize: -1 }, { activeColor: 'red' }, { bogus: 1 }]) assert.throws(() => stepperAppearance.normalize(bad), { code: 'INVALID_STEPPER_APPEARANCE' }, JSON.stringify(bad));
  assert.throws(() => stepAppearance.normalize({ gap: 12 }), { code: 'INVALID_STEP_APPEARANCE' });
  assert.deepEqual(nativeThemeOptions({ stepperAppearance: { indicatorSize: 40 }, stepAppearanceDefaults: { activeColor: '#C62828' } }), { stepperAppearance: { indicatorSize: 40 }, stepAppearanceDefaults: { activeColor: '#C62828' } });
  assert.doesNotThrow(() => validateRenderRequest({ tag: 'md-stepper', properties: {}, stepperAppearance: { activeColor: '#C62828' } }, new Set(['md-stepper'])));
  assert.throws(() => validateRenderRequest({ tag: 'md-step', properties: {}, stepperAppearance: { activeColor: '#C62828' } }, new Set(['md-step'])));
});

test('retained updates of every source property', () => {
  for (const tag of TAGS) {
    assert.deepEqual([...STEPPER_UPDATE_PROPERTIES[tag]].sort(), irs[tag].properties.map(p => p.name).sort(), tag);
    for (const platform of ['ios', 'android']) assert.ok(supportsRetainedPropertyUpdates(component(tag), platform), `${platform} ${tag}`);
  }
  for (const [tag, values] of [['md-stepper', { active: 2, orientation: 'vertical', mode: 'non-linear', indicator: 'dot', variant: 'mobile', readonly: true, nextLabel: 'Next', density: -2 }],
    ['md-step', { label: 'Plan', completed: true, error: true, errorText: 'Required', active: true, hideActions: true }]])
    for (const [key, value] of Object.entries(values)) assert.deepEqual(nativePropertyUpdate(tag, { [key]: value }), { command: 'update', properties: { [key]: value } }, `${tag} ${key}`);
  for (const [tag, key, value] of [['md-stepper', 'orientation', 'diagonal'], ['md-stepper', 'active', -1], ['md-stepper', 'active', 1.5], ['md-stepper', 'active', '1'], ['md-stepper', 'density', 2], ['md-step', 'active', 'yes']])
    assert.throws(() => nativePropertyUpdate(tag, { [key]: value }), undefined, `${tag} ${key}`);
  assert.equal(validStepperUpdate('md-stepper', 'active', 3), true); assert.equal(validStepperUpdate('md-stepper', 'active', Infinity), false);
});

test('next() / prev() / goTo() / reset() with their examples', () => {
  for (const method of irs['md-stepper'].methods.map(m => m.name)) {
    assert.equal(nativeMethodSupported('md-stepper', method, ios['md-stepper']), true, method);
    for (const platform of ['swift', 'android']) {
      const example = nativeApiExample(component('md-stepper'), 'method', method, platform);
      assert.equal(example.status, 'supported', `${platform} ${method}`);
      assert.match(example.code, new RegExp(`controller\\.${method}\\(`), `${platform} ${method}`);
    }
  }
  assert.deepEqual(STEPPER_METHODS, { 'md-stepper': ['next', 'prev', 'goTo', 'reset'] });
  assert.deepEqual(nativeMethodCommand('md-stepper', 'goTo', [2]), { command: 'method', method: 'goTo', arguments: [2] });
  assert.deepEqual(nativeMethodCommand('md-stepper', 'next', []), { command: 'method', method: 'next', arguments: [] });
  for (const [method, args] of [['goTo', []], ['goTo', ['x']], ['goTo', [-1]], ['next', [1]]]) assert.throws(() => nativeMethodCommand('md-stepper', method, args), undefined, `${method} ${JSON.stringify(args)}`);
});
