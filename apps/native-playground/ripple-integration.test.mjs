import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { RIPPLE_APPEARANCE_FIELDS, rippleAppearance, validRippleEasing } from './ripple-appearance.js';
import { componentAppearance } from './component-appearance.js';
import { nativeThemeOptions } from './native-theme-options.js';
import { validateRenderRequest } from './native-render.mjs';
import { RIPPLE_UPDATE_PROPERTIES, nativePropertyUpdate, supportsRetainedPropertyUpdates } from './native-property-updates.js';
import { nativeItemMethod, nativeMethodSupported, nativeMethodCommand } from './native-methods.js';
import { recipeFor } from './recipes.js';
import { nativeApiExample } from './native-api-examples.js';

// md-ripple in the Laboratory: the six typed hooks (incl. the CSS easing text), the retained `disabled` update,
// trigger()/whenSettled() through the native controller, released policies and the token-styled recipe surface.
const ir = JSON.parse(await readFile(new URL('../../packages/native-compiler/generated/ir/md-ripple.json', import.meta.url), 'utf8'));
const policies = { ios: JSON.parse(await readFile(new URL('../../packages/native-ios/NativeSupport.json', import.meta.url), 'utf8')).components['md-ripple'],
  android: JSON.parse(await readFile(new URL('../../packages/native-android/support.json', import.meta.url), 'utf8')).components['md-ripple'] };

test('the six hooks cover the IR and both released policies', () => {
  assert.deepEqual(RIPPLE_APPEARANCE_FIELDS.map(f => f.cssProperty).sort(), ir.cssProperties.map(p => p.name).sort());
  for (const platform of ['ios', 'android']) {
    const p = policies[platform];
    assert.deepEqual(p.appearance.fields, RIPPLE_APPEARANCE_FIELDS.map(f => f.name), platform);
    assert.deepEqual(p.properties, ir.properties.map(x => x.name), platform);
    assert.deepEqual(p.methods, ['trigger', 'whenSettled'], platform);
  }
  const registry = componentAppearance('md-ripple');
  assert.equal(registry.key, 'rippleAppearance'); assert.equal(registry.swiftModifier, 'awcRippleAppearance'); assert.equal(registry.nativeType, 'AWCRippleAppearance');
});

test('hook values normalize, render as CSS and round-trip through the inputs', () => {
  const value = { color: '#33669988', opacity: 0.35, extendInline: 30, extendBlock: 12, growDuration: 600, growEasing: 'cubic-bezier(.1, .8, .3, 1)' };
  assert.deepEqual(rippleAppearance.css(value), { '--md-ripple-color': '#33669988', '--md-ripple-opacity': '0.35', '--md-ripple-extend-inline': '30px', '--md-ripple-extend-block': '12px', '--md-ripple-grow-duration': '600ms', '--md-ripple-grow-easing': 'cubic-bezier(.1, .8, .3, 1)' });
  for (const f of RIPPLE_APPEARANCE_FIELDS) assert.deepEqual(rippleAppearance.parseInput(f.name, rippleAppearance.formatInput(f.name, value[f.name])), value[f.name], f.name);
  for (const ok of ['linear', 'ease-in-out', 'step-end', 'steps(4, jump-none)', 'cubic-bezier(0.2,0,0,1)', 'linear(0, 0.25 25%, 1)']) assert.ok(validRippleEasing(ok), ok);
  for (const bad of ['invalid-easing', 'cubic-bezier(1.2,0,0,1)', 'steps(1, jump-none)', 'linear(1)', 'cubic-bezier(1,2,3)', '']) assert.equal(validRippleEasing(bad), false, bad);
  assert.throws(() => rippleAppearance.normalize({ growEasing: 'bounce' }), { code: 'INVALID_RIPPLE_APPEARANCE' });
  assert.throws(() => rippleAppearance.normalize({ opacity: 2 }), { code: 'INVALID_RIPPLE_APPEARANCE' });
  assert.throws(() => rippleAppearance.normalize({ width: 2 }), { code: 'INVALID_RIPPLE_APPEARANCE' });
  assert.equal(rippleAppearance.nativeValue('growEasing', 'linear', 'swift'), '"linear"');
  assert.deepEqual(nativeThemeOptions({ rippleAppearance: { opacity: 0.2 } }).rippleAppearance, { opacity: 0.2 });
  assert.doesNotThrow(() => validateRenderRequest({ tag: 'md-ripple', properties: {}, rippleAppearance: { opacity: 0.2, growEasing: 'linear' } }, new Set(['md-ripple'])));
  assert.throws(() => validateRenderRequest({ tag: 'md-ripple', properties: {}, rippleAppearance: { growEasing: 'bounce' } }, new Set(['md-ripple'])));
});

test('retained update, methods and the recipe surface', () => {
  assert.deepEqual([...RIPPLE_UPDATE_PROPERTIES], ['disabled']);
  for (const platform of ['ios', 'android']) assert.ok(supportsRetainedPropertyUpdates({ ...ir, support: policies }, platform), platform);
  assert.ok(JSON.stringify(nativePropertyUpdate('md-ripple', { disabled: true })).includes('"disabled":true'));
  assert.throws(() => nativePropertyUpdate('md-ripple', { disabled: 'yes' }));
  for (const name of ['trigger', 'whenSettled']) {
    assert.ok(nativeItemMethod('md-ripple', name));
    assert.ok(nativeMethodSupported('md-ripple', name, policies.ios));
    assert.deepEqual(nativeMethodCommand('md-ripple', name, []), { command: 'method', method: name, arguments: [] });
    assert.throws(() => nativeMethodCommand('md-ripple', name, [1]));
    for (const platform of ['swift', 'android']) {
      const example = nativeApiExample({ ...ir, support: { ios: policies.ios, android: policies.android } }, 'method', name, platform);
      assert.equal(example.status, 'supported', `${platform} ${name}`);
      assert.match(example.code, platform === 'swift' ? /AWCRippleController\(\)/ : /AWCRippleController\(\)/);
      assert.match(example.code, name === 'trigger' ? /controller\.trigger\(\)/ : /controller\.whenSettled\(\)/);
    }
  }
  const html = recipeFor('md-ripple').html;
  assert.match(html, /<button[^>]+surface-container-highest[^>]+>Tap to see the ripple<md-ripple><\/md-ripple><\/button>/);
});
