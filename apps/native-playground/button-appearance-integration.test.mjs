import test from 'node:test';
import assert from 'node:assert/strict';
import { nativeRenderRequest } from './contracts.js';
import { validateRenderRequest } from './native-render.mjs';
import { usageSnippet } from './usage-snippets.js';
import { memberDocumentation } from './documentation.js';
import { getAIInstructions } from './ai-instructions.mjs';
import { fileURLToPath } from 'node:url';

const button = { tag: 'md-button', properties: [], events: [] };
const options = { buttonAppearanceDefaults: { containerColor: '#123abc', gap: 12 }, buttonAppearance: { gap: 0, fontSize: 20, labelColor: '#FFFFFF' } };

test('preview request preserves sparse inherited/local appearance and rejects invalid values before native execution', () => {
  const payload = nativeRenderRequest('md-button', {}, false, options);
  assert.deepEqual(payload.buttonAppearanceDefaults, { containerColor: '#123ABC', gap: 12 });
  assert.deepEqual(payload.buttonAppearance, options.buttonAppearance);
  assert.deepEqual(validateRenderRequest(payload, new Set(['md-button'])), payload);
  for (const bad of [{ gap: -1 }, { containerColor: 'red' }, { fontWeight: 400.5 }, { pressedOpacity: 2 }, { fontSize: '20' }, { arbitraryCSS: 'display:none' }]) {
    assert.throws(() => validateRenderRequest({ ...payload, buttonAppearance: bad }, new Set(['md-button'])), error => error.status === 400 && error.code === 'INVALID_BUTTON_APPEARANCE');
  }
  assert.throws(() => validateRenderRequest({ ...payload, tag: 'md-chip' }, new Set(['md-chip'])), /md-button only/);
});

test('Web framework snippets keep theme and local styles in distinct scopes', () => {
  for (const platform of ['html', 'react', 'vue', 'svelte', 'angular']) {
    const snippet = usageSnippet(button, {}, platform, { ...options, text: 'Continue' });
    assert.match(snippet, /--md-button-container-color/);
    assert.match(snippet, /#123ABC/);
    assert.match(snippet, /--md-button-gap/);
    assert.match(snippet, /0px/);
    assert.match(snippet, /12px/);
    assert.doesNotMatch(snippet, /AWCButtonAppearance/);
  }
});

test('native snippets use typed styles, valid Swift argument order and local scopes inside theme defaults', () => {
  const swift = usageSnippet(button, {}, 'swift', { ...options, text: 'Continue' });
  assert.match(swift, /\.awcButtonAppearance\(\.init\(labelColor: "#FFFFFF", fontSize: 20\.0, gap: 0\.0\)\)/);
  assert.ok(swift.indexOf('labelColor:') < swift.indexOf('containerColor:'));
  const kotlin = usageSnippet(button, {}, 'android', { ...options, text: 'Continue' });
  assert.match(kotlin, /import dev.awc.nativeui.AWCButtonAppearanceScope/);
  assert.match(kotlin, /fontSize = 20\.0/);
  assert.match(kotlin, /gap = 0\.0/);
  assert.ok(kotlin.indexOf('containerColor =') < kotlin.indexOf('labelColor ='));
  for (const snippet of [swift, kotlin]) assert.doesNotMatch(snippet, /--md-button-/);
});

test('CSS selector support stays distinct from implemented native visual equivalents', () => {
  const component = { ...button, cssParts: [{ name: 'icon' }], support: { ios: { visualParts: ['icon'], appearance: { api: 'AWCButtonAppearance', fields: ['iconColor'] } } } };
  const native = memberDocumentation(component, 'cssPart', { name: 'icon' }, 'ios');
  assert.equal(native.support.status, 'native-equivalent');
  assert.match(native.support.description, /CSS selector: Web only/);
  assert.match(native.support.description, /AWCButtonAppearance/);
  assert.equal(memberDocumentation(component, 'cssPart', { name: 'icon' }, 'android').support.status, 'unknown');
  assert.equal(memberDocumentation(component, 'cssPart', { name: 'icon' }, 'web').support.status, 'source');
});

test('complete button AI guide includes inherited/local style examples on both native platforms', async () => {
  const guide = await getAIInstructions(fileURLToPath(new URL('../../', import.meta.url)), 'md-button');
  assert.match(guide.markdown, /Shared button appearance on iOS \/ SwiftUI/);
  assert.match(guide.markdown, /Shared button appearance on Android \/ Compose/);
  assert.match(guide.markdown, /AWCButtonAppearanceScope\(AWCButtonAppearance/);
  assert.match(guide.markdown, /\.awcButtonAppearance\(\.init/);
  assert.match(guide.markdown, /CSS parts remain Web selectors/);
});

test('a fixed state-layer opacity travels as ::part(state-layer) on Web and as stateLayerOpacity natively', () => {
  const fixed = { buttonAppearanceDefaults: { stateLayerOpacity: 0.1 }, buttonAppearance: { stateLayerOpacity: 0.2 } };
  const payload = nativeRenderRequest('md-button', {}, false, fixed);
  assert.deepEqual(validateRenderRequest(payload, new Set(['md-button'])).buttonAppearance, { stateLayerOpacity: 0.2 });
  assert.throws(() => validateRenderRequest({ ...payload, buttonAppearance: { stateLayerOpacity: -0.1 } }, new Set(['md-button'])), error => error.code === 'INVALID_BUTTON_APPEARANCE');
  const defaultsRule = '.awc-appearance-defaults md-button::part(state-layer) { opacity: 0.1; }', localRule = 'md-button.awc-appearance::part(state-layer) { opacity: 0.2; }';
  const wrappers = { html: ['<style>', '</style>'], react: ['<style>{"', '"}</style>'], vue: ['<style scoped>', '</style>'], svelte: ['<style>', '</style>'], angular: ['styles: ["', '"],'] };
  for (const [platform, [open, close]] of Object.entries(wrappers)) {
    const snippet = usageSnippet(button, {}, platform, { ...fixed, text: 'Continue' });
    const start = snippet.indexOf(open), defaults = snippet.indexOf(defaultsRule), local = snippet.indexOf(localRule);
    assert.ok(start >= 0 && start < defaults && defaults < local && local < snippet.indexOf(close, local), `${platform}: ${snippet}`);
    assert.match(snippet, /(class|className)=("|\{")awc-appearance-defaults/, platform);
    assert.match(snippet, /(class|className)=("|\{")awc-appearance"/, platform);
    assert.doesNotMatch(snippet, /--md-button-state-layer-opacity|stateLayerOpacity|style=""/, platform);
  }
  const swift = usageSnippet(button, {}, 'swift', { ...fixed, text: 'Continue' });
  assert.match(swift, /\.awcButtonAppearance\(\.init\(stateLayerOpacity: 0\.2\)\)/);
  const kotlin = usageSnippet(button, {}, 'android', { ...fixed, text: 'Continue' });
  assert.match(kotlin, /stateLayerOpacity = 0\.2/);
  for (const snippet of [swift, kotlin]) assert.doesNotMatch(snippet, /::part/);
});
