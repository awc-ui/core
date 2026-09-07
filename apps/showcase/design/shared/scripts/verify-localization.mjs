#!/usr/bin/env node
/** Shared localization contracts for every native Pictor port.
 * Run: node apps/showcase/design/shared/scripts/verify-localization.mjs
 * The message fixture is the union of the five ports' interface catalogs.
 * Update it when adding interface copy; authored document names are excluded.
 */
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const scripts = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(scripts, '..');
const messages = JSON.parse(await readFile(join(scripts, 'fixtures/messages-en.json'), 'utf8'));
const scratch = await mkdtemp(join(tmpdir(), 'pictor-localization-'));
let engine;
try {
  const result = await build({
    stdin: {
      contents: "export * from './src/i18n.ts'; export * from './src/command-navigation.ts'; export { PICTOR_AR } from './src/messages-ar.ts';",
      resolveDir: packageRoot,
      sourcefile: 'pictor-localization-contract.ts',
      loader: 'ts',
    },
    bundle: true, write: false, format: 'esm', platform: 'node', target: 'node22', logLevel: 'silent',
  });
  const entry = join(scratch, 'localization.mjs');
  await writeFile(entry, result.outputFiles[0].text);
  engine = await import(pathToFileURL(entry).href);
} finally {
  await rm(scratch, { recursive: true, force: true });
}
const { PICTOR_AR, pictorText, hasPictorArabic, pictorSearchText, scrollCommandIntoView } = engine;
const slots = (value) => [...new Set([...value.matchAll(/\{(\w+)\}/g)].map(match => match[1]))].sort();
const languageNeutral = new Set([
  '1× · 960 × 640', '2× · 1920 × 1280', '3× · 2880 × 1920', '960 × 640 · RGB',
  'X {value} · Y {value2}', 'X {x} · Y {y}', 'sRGB', '{tool} ({key})', '{tool} · {key}',
]);

test('all five ports have nonempty Arabic interface translations', () => {
  assert.equal(new Set(messages).size, messages.length, 'message fixture must be unique');
  assert.deepEqual(messages.filter(message => !hasPictorArabic(message)), []);
  for (const message of messages) {
    const translated = pictorText('ar', message);
    assert(translated.trim(), `Empty translation: ${message}`);
    if (!languageNeutral.has(message)) assert(/\p{Script=Arabic}/u.test(translated), `English-only Arabic message: ${message}`);
  }
});

test('every Arabic catalog entry preserves its named interpolation slots', () => {
  for (const [message, translated] of Object.entries(PICTOR_AR)) {
    assert.deepEqual(slots(translated), slots(message), `Placeholder mismatch: ${message}`);
    const params = Object.fromEntries(slots(message).map(name => [name, `__VALUE_${name}__`]));
    const rendered = pictorText('ar', message, params);
    for (const value of Object.values(params)) assert(rendered.includes(value), `Dropped interpolation value: ${message}`);
  }
});

test('locale variants, existing Romanian terms, and unknown messages use the intended fallback', () => {
  assert.equal(pictorText(' AR-eg ', 'Saved locally'), pictorText('ar', 'Saved locally'));
  assert.equal(pictorText('en-US', 'Saved locally'), 'Saved locally');
  assert.equal(pictorText('ro-RO', 'Projects'), 'Proiecte');
  assert.equal(pictorText('fr', 'Saved locally'), 'Saved locally');
  assert.equal(pictorText('ar', 'Uncatalogued {name}', { name: 'Atlas UI' }), 'Uncatalogued Atlas UI');
  assert.equal(pictorText('ar', '__proto__'), '__proto__');
  assert.equal(pictorText('ar', 'constructor'), 'constructor');
  assert.equal(hasPictorArabic('__proto__'), false);
  assert.equal(hasPictorArabic('constructor'), false);
});

test('translation preserves authored values while search ignores optional Arabic marks', () => {
  const name = 'Atlas\u2009UI — مَشْرُوع';
  assert(pictorText('ar', 'Open {name}', { name }).includes(name));
  assert.equal(pictorSearchText('  مُـكَوِّنَات  '), pictorSearchText('مكونات'));
  assert.equal(pictorSearchText('AWC Button'), pictorSearchText('awc button'));
  assert.equal(pictorSearchText('Text field'), 'text field');
});

function viewport(initialScroll = 0) {
  let top = initialScroll;
  const list = {
    get scrollTop() { return top; },
    set scrollTop(value) { top = Math.max(0, Math.min(400, value)); },
    scrollLeft: 17,
    getBoundingClientRect: () => ({ top: 100, bottom: 300 }),
    focus: () => assert.fail('keyboard focus must stay in search'),
    scrollIntoView: () => assert.fail('the page must not scroll'),
    querySelectorAll(selector) {
      assert.equal(selector, '[role="option"]');
      return items;
    },
  };
  const items = Array.from({ length: 12 }, (_, index) => ({
    getBoundingClientRect: () => ({ top: 100 + index * 50 - top, bottom: 150 + index * 50 - top }),
    focus: () => assert.fail('active descendant must not take search focus'),
    scrollIntoView: () => assert.fail('only the result list should scroll'),
  }));
  return list;
}

test('command scrolling reveals clipped results and preserves visible edge items', () => {
  const list = viewport();
  scrollCommandIntoView(list, 3);
  assert.equal(list.scrollTop, 0, 'a result exactly on the lower edge is visible');
  scrollCommandIntoView(list, 9);
  assert.equal(list.scrollTop, 300);
  scrollCommandIntoView(list, 9);
  assert.equal(list.scrollTop, 300, 'repeated rendering does not move a visible result');
  scrollCommandIntoView(list, 0);
  assert.equal(list.scrollTop, 0);
  const partial = viewport(25);
  scrollCommandIntoView(partial, 4);
  assert.equal(partial.scrollTop, 50);
  scrollCommandIntoView(partial, 0);
  assert.equal(partial.scrollTop, 0);
  assert.equal(list.scrollLeft, 17, 'horizontal position is unchanged');
});

test('command scrolling tolerates closed, empty, or invalid result selections', () => {
  scrollCommandIntoView(null, 0);
  scrollCommandIntoView({ querySelectorAll: () => [] }, 0);
  const list = viewport(100);
  for (const index of [-1, 12, Number.NaN, Number.POSITIVE_INFINITY]) scrollCommandIntoView(list, index);
  assert.equal(list.scrollTop, 100);
});
