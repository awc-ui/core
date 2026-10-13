import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseFragment } from 'parse5';
import { highlightCode, renderCode } from './syntax-highlighting.js';
import { usageSnippet, snippetLanguages } from './usage-snippets.js';
import { recipeFor } from './recipes.js';

const text = node => node.nodeName === '#text' ? node.value : (node.childNodes || []).map(text).join('');
const nodes = node => [node, ...(node.childNodes || []).flatMap(nodes)];
class CodeElement {
  dataset = {};
  isConnected = true;
  writes = 0;
  set textContent(value) { this.text = value; this.html = null; }
  get textContent() { return this.text; }
  set innerHTML(value) { this.html = value; this.text = text(parseFragment(value)); this.writes++; }
}

test('Markdown instructions preserve headings, tables, Swift fences and literal HTML safely', async () => {
  const source = '# Button instructions\n\n| Property | Type |\n| --- | --- |\n| icon | String |\n\n```swift\nimport AWCUI\nlet label = "Continue"\n```\n\n<script>Do not execute</script>\n';
  const html = await highlightCode(source, 'markdown');
  const parsed = parseFragment(html);
  assert.match(html, /class="syntax-token"/);
  assert.equal(text(parsed), source);
  assert.ok(nodes(parsed).filter(node => node.tagName).every(node => node.tagName === 'span'));
});

test('real generated code for all seven languages has dual-theme tokens and identical text', async () => {
  const catalog = JSON.parse(await readFile(new URL('../../packages/native-compiler/generated/catalog.json', import.meta.url), 'utf8'));
  const button = catalog.components.find(component => component.tag === 'md-button');
  const recipe = recipeFor(button.tag);
  for (const language of snippetLanguages) {
    const source = usageSnippet(button, { variant: 'filled', selected: true }, language.id, { html: recipe.html });
    const html = await highlightCode(source, language.language);
    assert.match(html, /class="syntax-token"/, language.id);
    assert.match(html, /--syntax-light:#[\da-f]{6};--syntax-dark:#[\da-f]{6}/i, language.id);
    assert.equal(text(parseFragment(html)), source, language.id);
    const palette = new Set([...html.matchAll(/--syntax-light:(#[\da-f]{6})/gi)].map(match => match[1]));
    assert.ok(palette.size >= 3, `${language.id} distinguishes token categories`);
  }
});

test('highlight output contains only safe spans and escaped source, including malicious HTML', async () => {
  const source = '<script>alert("x")</script>\n<img src=x onerror="evil()"><svg onload="evil()">&amp;\r\nconst value = `</span><a href="javascript:x">`; ';
  const html = await highlightCode(source, 'html');
  const parsed = parseFragment(html);
  assert.equal(text(parsed), source);
  for (const node of nodes(parsed).filter(node => node.tagName)) {
    assert.equal(node.tagName, 'span');
    assert.deepEqual(node.attrs.map(attribute => attribute.name), ['class', 'style']);
    assert.match(node.attrs.find(attribute => attribute.name === 'style').value, /^--syntax-light:(?:#[\da-f]{6}(?:[\da-f]{2})?|inherit);--syntax-dark:(?:#[\da-f]{6}(?:[\da-f]{2})?|inherit)$/i);
  }
});

test('CRLFs, lone CRs, tabs, Unicode and trailing newlines survive DOM rendering exactly', async () => {
  const element = new CodeElement();
  for (const source of ['const name = "Ștefan 👋";\r\n\tconsole.log(name);\r\n\r\n', 'let a = 1;\rlet b = 2;', '\n\n', 'const nullChar = "\0";']) {
    await renderCode(element, source, 'javascript');
    assert.equal(element.textContent, source);
  }
});

test('stale async renders cannot replace newer code, and detached nodes stay plain', async () => {
  const element = new CodeElement();
  const first = renderCode(element, 'const old = 1;', 'javascript');
  const second = renderCode(element, 'let current: String = "new"', 'swift');
  assert.equal(element.textContent, 'let current: String = "new"', 'Plain code is available immediately');
  assert.equal(await first, false);
  assert.equal(await second, true);
  assert.equal(element.textContent, 'let current: String = "new"');
  assert.equal(element.dataset.language, 'swift');
  const writes = element.writes;
  await renderCode(element, 'let current: String = "new"', 'swift');
  assert.equal(element.writes, writes, 'Identical updates preserve DOM selection');
  const detached = new CodeElement();
  const pending = renderCode(detached, 'val value = true', 'kotlin');
  detached.isConnected = false;
  assert.equal(await pending, false);
  assert.equal(detached.writes, 0);
});

test('shell/theme aliases highlight; unknown or oversized sources remain safe plain text', async () => {
  for (const [language, source] of [['bash', 'pnpm native:playground'], ['javascript', 'const theme = { dark: true };'], ['json', '{ "value": true }'], ['css', 'button { color: red; }']]) {
    assert.match(await highlightCode(source, language), /class="syntax-token"/);
  }
  for (const [language, source] of [['unknown', '<img onerror="bad()">'], ['html', '<'.repeat(100001)]]) {
    const html = await highlightCode(source, language);
    assert.doesNotMatch(html, /class="syntax-token"/);
    assert.equal(text(parseFragment(html)), source);
  }
});
