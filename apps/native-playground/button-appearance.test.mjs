import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BUTTON_APPEARANCE_FIELDS, normalizeButtonAppearance, mergeButtonAppearance, buttonAppearanceCSS, buttonAppearancePartCSS } from './button-appearance.js';
import { usageSnippet } from './usage-snippets.js';
import { partRulesCSS, applyAppearancePartRules } from './appearance-part-rules.js';

test('every public button CSS hook has a shared appearance field including dimensions and focus ring', () => {
  const css = readFileSync(new URL('../../packages/core/src/components/md-button/md-button.css', import.meta.url), 'utf8');
  const hooks = [...new Set(css.match(/--md-button-[a-z-]+/g))].sort();
  assert.deepEqual(BUTTON_APPEARANCE_FIELDS.filter(field => field.cssProperty).map(field => field.cssProperty).sort(), hooks);
  assert.deepEqual(buttonAppearanceCSS({ width: 0, minWidth: 48, maxWidth: 2400, height: 56.5, minHeight: 0, focusRingColor: '#123abc' }), {
    '--md-button-focus-ring-color': '#123ABC', '--md-button-width': '0px', '--md-button-min-width': '48px',
    '--md-button-max-width': '2400px', '--md-button-height': '56.5px', '--md-button-min-height': '0px',
  });
});

const rejects = value => assert.throws(() => normalizeButtonAppearance(value), { code: 'INVALID_BUTTON_APPEARANCE' });

test('appearance stays sparse, normalizes colors, and preserves intentional zero and fractional values', () => {
  assert.deepEqual(normalizeButtonAppearance(), {});
  assert.deepEqual(normalizeButtonAppearance({}), {});
  const source = { containerColor: '#a0bcde', iconSize: 17.5, fontWeight: 575, letterSpacing: -0.5, gap: 0, hoverOpacity: 0, cornerRadius: -0 };
  assert.deepEqual(normalizeButtonAppearance(source), { ...source, containerColor: '#A0BCDE', cornerRadius: 0 });
  assert.equal(source.containerColor, '#a0bcde');
});

test('strict contract rejects unknown fields, CSS strings, nonfinite values, and nonplain objects', () => {
  for (const value of [null, [], 1, 'red', new Date(), { extra: 1 }, { iconSize: '20' }, { iconSize: '20px' }, { fontWeight: 500.5 }, { labelColor: '#abc' }, { labelColor: '#12345678' }, { labelColor: 'red' }, { labelColor: ' #123456' }, { labelColor: 'var(--primary)' }, { labelColor: '#123456; color:red' }, { gap: undefined }, { gap: null }, { gap: NaN }, { gap: Infinity }, { gap: -Infinity }]) rejects(value);
  rejects(Object.assign(Object.create({ inherited: true }), { gap: 4 }));
  rejects({ [Symbol('gap')]: 4 });
  rejects(JSON.parse('{"__proto__":{"gap":4}}'));
  rejects(Object.defineProperty({}, 'gap', { get() { throw new Error('Do not invoke getters'); } }));
  assert.deepEqual(normalizeButtonAppearance(Object.assign(Object.create(null), { gap: 4 })), { gap: 4 });
});

test('every numeric field accepts both limits and rejects values outside its declared range', () => {
  for (const field of BUTTON_APPEARANCE_FIELDS.filter(field => field.kind === 'number')) {
    assert.equal(normalizeButtonAppearance({ [field.name]: field.min })[field.name], field.min);
    assert.equal(normalizeButtonAppearance({ [field.name]: field.max })[field.name], field.max);
    rejects({ [field.name]: field.min - 0.01 });
    rejects({ [field.name]: field.max + 0.01 });
  }
});

test('local appearance overrides defaults field by field without filling absent values or changing inputs', () => {
  const defaults = Object.freeze({ containerColor: '#112233', iconSize: 24, gap: 8, hoverOpacity: 0.08 });
  const local = Object.freeze({ iconSize: 32, gap: 0, hoverOpacity: 0 });
  assert.deepEqual(mergeButtonAppearance(defaults, local), { containerColor: '#112233', iconSize: 32, gap: 0, hoverOpacity: 0 });
  assert.deepEqual(mergeButtonAppearance(defaults, {}), defaults);
  assert.deepEqual(mergeButtonAppearance(undefined, local), local);
  assert.throws(() => mergeButtonAppearance({ unknown: 1 }, {}), { code: 'INVALID_BUTTON_APPEARANCE' });
  assert.throws(() => mergeButtonAppearance({}, { gap: -1 }), { code: 'INVALID_BUTTON_APPEARANCE' });
});

test('browser mapping uses public button hooks, lengths in px, and unitless weight and state opacity', () => {
  assert.deepEqual(buttonAppearanceCSS({
    containerColor: '#abcdef', labelColor: '#010203', iconColor: '#040506', trailingIconColor: '#070809',
    loadingColor: '#0a0b0c', stateLayerColor: '#0d0e0f', outlineColor: '#101112',
    iconSize: 24, trailingIconSize: 28, loadingSize: 18, fontSize: 16, fontWeight: 575,
    lineHeight: 22, letterSpacing: -0.5, cornerRadius: 0, outlineWidth: 2, paddingInline: 12,
    paddingBlock: 4, gap: 0, hoverOpacity: 0, focusOpacity: 0.2, pressedOpacity: 1,
  }), {
    '--md-button-container-color': '#ABCDEF', '--md-button-label-color': '#010203', '--md-button-icon-color': '#040506',
    '--md-button-trailing-icon-color': '#070809', '--md-button-loading-color': '#0A0B0C', '--md-button-state-layer-color': '#0D0E0F',
    '--md-button-outline-color': '#101112', '--md-button-icon-size': '24px', '--md-button-trailing-icon-size': '28px',
    '--md-button-loading-size': '18px', '--md-button-font-size': '16px', '--md-button-font-weight': '575',
    '--md-button-line-height': '22px', '--md-button-letter-spacing': '-0.5px', '--md-button-container-shape': '0px',
    '--md-button-outline-width': '2px', '--md-button-padding-inline': '12px', '--md-button-padding-block': '4px',
    '--md-button-gap': '0px', '--md-button-hover-opacity': '0', '--md-button-focus-opacity': '0.2', '--md-button-pressed-opacity': '1',
  });
  assert.deepEqual(buttonAppearanceCSS(), {});
  assert.throws(() => buttonAppearanceCSS({ containerColor: 'url(https://example.test)' }), { code: 'INVALID_BUTTON_APPEARANCE' });
  assert.equal(new Set(BUTTON_APPEARANCE_FIELDS.map(field => field.cssProperty ?? `part:${field.cssPart.part}:${field.cssPart.property}`)).size, BUTTON_APPEARANCE_FIELDS.length);
});


test('explicit stroke falls back to outline while preserving merged theme and local colors', () => {
  assert.deepEqual(buttonAppearanceCSS({ outlineWidth: 2 }), {
    '--md-button-outline-width': '2px', '--md-button-outline-color': 'var(--md-sys-color-outline)',
  });
  assert.deepEqual(buttonAppearanceCSS({ outlineWidth: 0 }), { '--md-button-outline-width': '0px' });
  assert.equal(buttonAppearanceCSS(mergeButtonAppearance({ outlineColor: '#123abc' }, { outlineWidth: 2 }))['--md-button-outline-color'], '#123ABC');
  assert.equal(buttonAppearanceCSS(mergeButtonAppearance({ outlineWidth: 2, outlineColor: '#123abc' }, { outlineColor: '#abcdef' }))['--md-button-outline-color'], '#ABCDEF');
  assert.equal(buttonAppearanceCSS(mergeButtonAppearance({ outlineWidth: 2 }, {}))['--md-button-outline-color'], 'var(--md-sys-color-outline)');
});


test('local CSS stays sparse when stroke color is derived from inherited appearance', () => {
  const defaults = { outlineColor: '#123abc', containerColor: '#556677', fontSize: 20, outlineWidth: 4 };
  assert.deepEqual(buttonAppearanceCSS({ outlineWidth: 2 }, defaults), {
    '--md-button-outline-width': '2px', '--md-button-outline-color': '#123ABC',
  });
  assert.deepEqual(buttonAppearanceCSS({}, defaults), {});
  assert.deepEqual(buttonAppearanceCSS({ outlineWidth: 0 }, defaults), { '--md-button-outline-width': '0px' });
  assert.deepEqual(buttonAppearanceCSS({ outlineWidth: 2, outlineColor: '#aabbcc' }, defaults), {
    '--md-button-outline-width': '2px', '--md-button-outline-color': '#AABBCC',
  });
  assert.deepEqual(buttonAppearanceCSS({ outlineWidth: 2 }, { labelColor: '#556677' }), {
    '--md-button-outline-width': '2px', '--md-button-outline-color': 'var(--md-sys-color-outline)',
  });
  assert.throws(() => buttonAppearanceCSS({ outlineWidth: 2 }, { outlineColor: 'red' }), { code: 'INVALID_BUTTON_APPEARANCE' });
  assert.deepEqual(defaults, { outlineColor: '#123abc', containerColor: '#556677', fontSize: 20, outlineWidth: 4 });
});

test('the fixed state-layer opacity is the ::part(state-layer) opacity: a part rule, never a custom property', () => {
  const field = BUTTON_APPEARANCE_FIELDS.find(item => item.name === 'stateLayerOpacity');
  assert.deepEqual({ kind: field.kind, min: field.min, max: field.max, part: field.cssPart }, { kind: 'number', min: 0, max: 1, part: { part: 'state-layer', property: 'opacity' } });
  assert.deepEqual(normalizeButtonAppearance({ stateLayerOpacity: 0.2 }), { stateLayerOpacity: 0.2 });
  assert.throws(() => normalizeButtonAppearance({ stateLayerOpacity: 1.5 }), { code: 'INVALID_BUTTON_APPEARANCE' });
  assert.deepEqual(buttonAppearanceCSS({ stateLayerOpacity: 0.2, hoverOpacity: 0.3 }), { '--md-button-hover-opacity': '0.3' });
  assert.deepEqual(buttonAppearancePartCSS({ stateLayerOpacity: 0 }), [{ part: 'state-layer', property: 'opacity', value: '0' }]);
  assert.deepEqual(buttonAppearancePartCSS({ hoverOpacity: 0.3 }), []);
  assert.equal(partRulesCSS('md-button.x', buttonAppearancePartCSS({ stateLayerOpacity: 0.2 })), 'md-button.x::part(state-layer) { opacity: 0.2; }');
});

test('the Web preview keeps one part stylesheet per styled element and removes it when cleared', () => {
  const head = { children: [], append(node) { this.children.push(node); node.remove = () => { this.children = this.children.filter(item => item !== node); }; } };
  const doc = { nodeType: 9, head, createElement: localName => { const attrs = {}; return { localName, textContent: '', setAttribute: (k, v) => { attrs[k] = v; }, getAttribute: k => attrs[k] }; } };
  const attrs = {};
  const target = { ownerDocument: doc, getRootNode: () => doc, setAttribute: (k, v) => { attrs[k] = v; }, removeAttribute: k => { delete attrs[k]; } };
  applyAppearancePartRules(target, buttonAppearancePartCSS({ stateLayerOpacity: 0.2 }));
  assert.equal(head.children.length, 1);
  assert.equal(head.children[0].textContent, `[data-awc-part-style="${attrs['data-awc-part-style']}"]::part(state-layer) { opacity: 0.2; }`);
  applyAppearancePartRules(target, buttonAppearancePartCSS({ stateLayerOpacity: 0.5 }));
  assert.equal(head.children.length, 1);
  assert.match(head.children[0].textContent, /opacity: 0\.5;/);
  applyAppearancePartRules(target, []);
  assert.equal(head.children.length, 0);
  assert.equal(attrs['data-awc-part-style'], undefined);
});
