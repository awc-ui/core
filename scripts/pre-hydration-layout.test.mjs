import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const early = read('packages/core/src/pre-hydration.css');
const component = name => read(`packages/core/src/components/${name}/${name}.css`);

// The early sheet intentionally mirrors only layout-bearing source values.
// Fail here when a component changes, instead of leaving a silent stale floor.
const sourceValues = {
  'md-app-bar': [
    'var(--md-app-bar-row-height, max(48px, calc(64px + var(--md-sys-density-scale, 0) * 4px)))',
    'var(--md-app-bar-medium-height, calc(112px + var(--md-sys-density-scale, 0) * 4px))',
    'var(--md-app-bar-medium-height-with-subtitle, calc(136px + var(--md-sys-density-scale, 0) * 4px))',
    'var(--md-app-bar-large-height, calc(120px + var(--md-sys-density-scale, 0) * 4px))',
    'var(--md-app-bar-large-height-with-subtitle, calc(152px + var(--md-sys-density-scale, 0) * 4px))',
    'var(--md-app-bar-row-padding-block-start, 20px)',
    'max(28px, calc(36px + var(--md-sys-density-scale, 0) * 2px))',
    'max(16px, calc(20px + var(--md-sys-density-scale, 0) * 1px))',
    'max(18px, calc(24px + var(--md-sys-density-scale, 0) * 1px))',
  ],
  'md-breadcrumb-item': [
    'var(--md-breadcrumb-item-padding, calc(8px + var(--md-sys-density-scale, 0) * 2px) max(4px, calc(12px + var(--md-sys-density-scale, 0) * 2px)))',
    'var(--md-sys-typescale-label-large-font-family, Roboto, sans-serif)',
    'max(12px, calc(14px + var(--md-sys-density-scale, 0) * 0.5px))',
    'max(16px, calc(20px + var(--md-sys-density-scale, 0) * 1px))',
  ],
  'md-tab': [
    'calc(48px + var(--md-sys-density-scale, 0) * 4px)',
    'calc(64px + var(--md-sys-density-scale, 0) * 4px)',
  ],
};

for (const [tag, values] of Object.entries(sourceValues)) {
  test(`${tag} startup dimensions match their owning component source`, () => {
    const source = component(tag);
    for (const value of values) {
      assert.ok(source.includes(value), `${tag} source changed: ${value}`);
      assert.ok(early.includes(value), `${tag} reservation omitted: ${value}`);
    }
  });
}

test('local density reservations follow the same supported override rungs as the components', () => {
  for (const tag of ['md-app-bar', 'md-breadcrumbs', 'md-breadcrumb-item', 'md-tab']) {
    for (const rung of [-1, -2, -3, -4]) {
      assert.ok(component(tag).includes(`:host([density='${rung}']) { --md-sys-density-scale: ${rung}; }`));
      assert.ok(early.includes(`[density="${rung}"] { --md-sys-density-scale: ${rung}; }`));
    }
  }
  assert.doesNotMatch(early, /\[density="0"\]/, 'zero must not override inherited global density');
  assert.ok(component('md-breadcrumb-item').includes('block-size: 18px;'), 'icon reservation follows the actual fixed icon box');
  assert.ok(component('md-app-bar').includes('margin-block-start: 2px;'), 'subtitle adds its source margin');
  assert.ok(component('md-app-bar').includes('--_expanded-padding-block-end: 28px;'), 'large headline block retains its source padding');
});

test('early layout is limited to the hydration interval and stays valid external CSS', () => {
  const require = createRequire(new URL('packages/core/package.json', root));
  const { transformSync } = require('esbuild');
  const { code, warnings } = transformSync(early, { loader: 'css', minify: true });
  assert.ok(code.length > 0);
  assert.deepEqual(warnings, []);
  assert.doesNotMatch(early, /:not\(:defined\)/, 'element definition does not mean the lazy component is ready');
  for (const rule of early.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{[^{}]*\}/g)) {
    assert.ok(rule[1].includes(':not(.hydrated)'), `ungated reservation: ${rule[1].trim()}`);
  }
});

test('layout placeholders end at the source Host marker even while descendants keep hydration pending', () => {
  for (const tag of ['md-app-bar', 'md-breadcrumbs', 'md-breadcrumb-item', 'md-tabs', 'md-tab']) {
    const source = read(`packages/core/src/components/${tag}/${tag}.tsx`);
    assert.ok(source.includes(`'${tag}': true`) || source.includes(`<Host class="${tag}"`), `${tag} first-render Host marker changed`);
  }
  const selectors = early.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{[^{}]*\}/g);
  for (const [, selector] of selectors) {
    for (const branch of selector.trim().split('\n')) {
      const tag = branch.match(/^(md-[a-z-]+)/)?.[1];
      if (tag) assert.ok(branch.startsWith(`${tag}:not(.${tag})`), `placeholder survives first render: ${branch}`);
    }
  }
});

test('the optional pre-upgrade sheet no longer duplicates core-owned app-bar layout', () => {
  const generator = read('scripts/emit-pre-upgrade-css.mjs');
  assert.doesNotMatch(generator, /tag:\s*['"]md-app-bar['"]/);
  assert.ok(generator.includes('packages/core/src/pre-hydration.css'));
});
