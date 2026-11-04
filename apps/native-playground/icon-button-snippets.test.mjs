import test from 'node:test';
import assert from 'node:assert/strict';
import { usageSnippet, recipeContextAttributes } from './usage-snippets.js';
import { componentAppearanceGuide } from './component-appearance-guide.mjs';

const policy = { status: 'native-adapter', properties: ['icon', 'toggle', 'selected', 'size', 'buttonWidth'], events: ['mdClick'], slots: ['', 'selected'], unsupportedSlots: [] };
const icon = { tag: 'md-icon-button', properties: policy.properties.map(name => ({ name })), events: [{ name: 'mdClick' }], slots: policy.slots.map(name => ({ name })), support: { ios: policy, android: policy } };
const options = {
  html: '<md-icon-button><md-badge value="3"></md-badge></md-icon-button>',
  slots: { '': { kind: 'symbol', value: 'favorite' }, selected: { kind: 'symbol', value: 'check' } },
  iconButtonAppearanceDefaults: { iconSize: 24, containerColor: '#123abc' },
  iconButtonAppearance: { width: 80, height: 56, outlineWidth: 0, iconColor: '#ffffff' },
};

test('icon appearance and both symbol slots reach every copyable framework without losing a badge', () => {
  for (const language of ['html', 'react', 'angular', 'vue', 'svelte', 'swift', 'android']) {
    const source = usageSnippet(icon, { toggle: true, selected: false, 'aria-label': 'Save favorite' }, language, options);
    assert.match(source, /favorite/);
    assert.match(source, /check/);
    assert.match(source, /Save favorite/);
    assert.match(source, /md-badge|MdBadge/);
    if (language === 'swift') {
      assert.match(source, /\.symbol\("favorite"/);
      assert.match(source, /\.symbol\("check", slot: "selected"\)/);
      assert.match(source, /\.awcIconButtonAppearance\(\.init\(/);
      assert.match(source, /width: 80(?:\.0)?, height: 56(?:\.0)?/);
      assert.match(source, /"aria-label": \.string\("Save favorite"\)/);
      assert.doesNotMatch(source, /\.awcButtonAppearance/);
    } else if (language === 'android') {
      assert.match(source, /AWCMaterialSymbol\("favorite"\)/);
      assert.match(source, /AWCIconButtonAppearanceScope/);
      assert.match(source, /width = 80\.0, height = 56\.0/);
      assert.match(source, /"aria-label" to "Save favorite"/);
      assert.doesNotMatch(source, /\bAWCButtonAppearance/);
    } else {
      assert.match(source, /--md-icon-button-container-width/);
      assert.match(source, /--md-icon-button-icon-size/);
      assert.doesNotMatch(source, /--md-button-/);
    }
  }
});

test('the preview accessible name comes from the same authored Web recipe', () => {
  assert.equal(recipeContextAttributes(icon)['aria-label'], 'Save to favorites');
  const source = usageSnippet(icon, { 'aria-label': '<Save "favorite">' }, 'html');
  assert.match(source, /aria-label="&lt;Save &quot;favorite&quot;&gt;"/);
  assert.doesNotMatch(source, /"aria-label":/);
});

test('icon AI guide exposes native appearance API and all nine exact source hooks', () => {
  for (const platform of ['ios', 'android']) {
    const source = componentAppearanceGuide(icon, platform);
    assert.match(source, /AWCIconButtonAppearance/);
    assert.match(source, /--md-icon-button-container-width/);
    assert.match(source, /--md-icon-button-container-height/);
    assert.equal((source.match(/\| `--md-icon-button-/g) || []).length, 9);
  }
});
