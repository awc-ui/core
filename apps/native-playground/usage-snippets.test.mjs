import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { usageSnippet, snippetLanguages } from './usage-snippets.js';
import { recipeFor } from './recipes.js';

const button = {
  tag: 'md-button', properties: ['variant', 'selected', 'value', 'payload', 'groupTabindex'].map(name => ({ name })),
  events: [{ name: 'mdClick' }, { name: 'mdChange' }], slots: [{ name: '' }],
};
async function runWebSnippet(snippet) {
  const blocks = [...snippet.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)];
  assert.equal(blocks.length, 1, 'Properties cannot inject or terminate script blocks');
  const source = blocks[0][1].replace(/^import .*;$/gm, '');
  const listeners = []; let selector; let defined;
  const component = { addEventListener: (name, listener) => listeners.push({ name, listener }) };
  const context = vm.createContext({
    document: { querySelector: value => { selector = value; return component; } },
    customElements: { whenDefined: async value => { defined = value; } },
    console: { log() {} },
  });
  await new vm.Script(`(async () => { ${source}\n})()`).runInContext(context, { timeout: 1000 });
  return { component, listeners, selector, defined };
}

test('web example preserves recipe markup and assigns current declared props after registration', async () => {
  const html = '<md-button variant="tonal">Continue</md-button>';
  const snippet = usageSnippet(button, { variant: 'outlined', selected: false, label: 'recipe-only', groupTabindex: null }, 'web', { html });
  assert.ok(snippet.includes(html));
  assert.ok(snippet.includes('import "@awc-ui/core/define";'));
  assert.ok(snippet.includes('import "@awc-ui/core/css/tokens.css";'));
  const result = await runWebSnippet(snippet);
  assert.equal(result.component.variant, 'outlined');
  assert.equal(result.component.selected, false);
  assert.equal(result.component.groupTabindex, null);
  assert.equal(Object.hasOwn(result.component, 'label'), false);
  assert.equal(result.selector, '#awc-example md-button');
  assert.equal(result.defined, 'md-button');
  assert.deepEqual(result.listeners.map(item => item.name), ['mdClick', 'mdChange']);
});

test('web data escapes script terminators, quotes, Unicode separators and HTML delimiters without executing strings', async () => {
  const hostile = '</script><script>throw new Error("injected")</script> \\ ${value} \u2028\u2029 & < >';
  const snippet = usageSnippet(button, { value: hostile, payload: { nested: [hostile, false, null, 2.5] } }, 'web', { text: '<Continue & "go">' });
  assert.ok(snippet.includes('&lt;Continue &amp; &quot;go&quot;&gt;'));
  assert.equal((snippet.match(/<\/script>/g) ?? []).length, 1);
  assert.ok(snippet.includes('\\u003c/script\\u003e'));
  const { component } = await runWebSnippet(snippet);
  assert.equal(component.value, hostile);
  assert.deepEqual(JSON.parse(JSON.stringify(component.payload)), { nested: [hostile, false, null, 2.5] });
});

test('web structured data preserves a nested __proto__ own property', async () => {
  const payload = JSON.parse('{"__proto__":{"safe":true},"constructor":"data"}');
  const { component } = await runWebSnippet(usageSnippet(button, { payload }, 'web'));
  assert.ok(Object.hasOwn(component.payload, '__proto__'));
  assert.equal(component.payload.__proto__.safe, true);
  assert.equal(component.payload.constructor, 'data');
});

test('Swift uses the actual public generic view/node API and explicit JSON values', () => {
  const snippet = usageSnippet(button, { variant: 'tonal', selected: true, value: 42, groupTabindex: null, payload: { list: [1, 'two', false, null], empty: {} } }, 'ios', { html: '<md-button>Continue &amp; save</md-button>' });
  assert.match(snippet, /import SwiftUI\nimport AWCUI/);
  assert.match(snippet, /struct ComponentExample: View/);
  assert.match(snippet, /AWCNativeView\(\n\s+tag: "md-button"/);
  assert.ok(snippet.includes('"selected": .bool(true)'));
  assert.ok(snippet.includes('"value": .number(42.0)'));
  assert.ok(snippet.includes('"groupTabindex": .null'));
  assert.ok(snippet.includes('.object(["list": .array([.number(1.0), .string("two"), .bool(false), .null]), "empty": .object([:])])'));
  assert.ok(snippet.includes('children: [.text("Continue & save")]'));
  assert.ok(snippet.includes('print(event.name, event.detail.json)'));
});

test('Swift string literals prevent interpolation and encode control characters', () => {
  const value = '" \\(danger) \\path\n\r\t\0\b\f $name \u2028 😀';
  const snippet = usageSnippet(button, { value, payload: { ['key\\(x)']: value } }, 'ios', { text: value });
  assert.ok(snippet.includes('\\" \\\\(danger) \\\\path\\n\\r\\t\\u{0}\\u{8}\\u{c} $name \\u{2028} 😀'));
  assert.ok(snippet.includes('"key\\\\(x)"'));
  assert.equal(snippet.includes('\u2028'), false);
});

test('Compose uses actual public imports, theme, JSON types and default slot', () => {
  const snippet = usageSnippet(button, { variant: 'filled', selected: false, value: 1e30, groupTabindex: null, payload: { nested: [2, true, null], empty: [] } }, 'android', { text: 'Continue' });
  assert.ok(snippet.includes('import dev.awc.nativeui.AWCComponent'));
  assert.ok(snippet.includes('@Composable\nfun ComponentExample()'));
  assert.ok(snippet.includes('AWCTheme {'));
  assert.ok(snippet.includes('properties = mapOf<String, AWCValue>('));
  assert.ok(snippet.includes('"value" to 1e+30'));
  assert.ok(snippet.includes('"groupTabindex" to null'));
  assert.ok(snippet.includes('mapOf<String, AWCValue>("nested" to listOf<AWCValue>(2.0, true, null), "empty" to emptyList<AWCValue>())'));
  assert.ok(snippet.includes('if (slot == "") Text("Continue")'));
  assert.ok(snippet.includes('onEvent = { name, detail -> println(name + ": " + detail) }'));
});

test('Kotlin strings escape dollar templates, quotes, slashes and all JSON controls', () => {
  const value = '$name ${danger()} " \\ \n\t\r\0\b\f \u2029';
  const snippet = usageSnippet(button, { value, payload: { '${key}': value } }, 'android', { text: value });
  assert.ok(snippet.includes('"\\$name \\${danger()} \\" \\\\ \\n\\t\\r\\u0000\\u0008\\u000c \\u2029"'));
  assert.ok(snippet.includes('"\\${key}" to'));
  assert.equal(snippet.includes('\u2029'), false);
});

test('omitted props inherit native defaults; supplied false/zero/null/empty values survive', () => {
  const component = { ...button, properties: [{ name: 'selected', defaultValue: true }, { name: 'value', defaultValue: 'default' }, { name: 'payload' }] };
  const swift = usageSnippet(component, {}, 'ios');
  const kotlin = usageSnippet(component, {}, 'android');
  assert.ok(swift.includes('properties: [:]'));
  assert.ok(kotlin.includes('properties = emptyMap()'));
  assert.equal(swift.includes('.bool(true)'), false);
  const current = usageSnippet(component, { selected: false, value: 0, payload: [] }, 'ios');
  assert.ok(current.includes('.bool(false)') && current.includes('.number(0.0)') && current.includes('.array([])'));
  assert.equal(usageSnippet(component, { value: undefined }, 'android').includes('"value" to'), false);
});

test('complex recipes retain native children and named slots along with supplied text', () => {
  const html = '<div><md-button><span slot="leading-icon">add</span>Continue</md-button></div>';
  const swift = usageSnippet(button, {}, 'ios', { html, text: 'Continue' });
  const kotlin = usageSnippet(button, {}, 'android', { html, text: 'Continue' });
  assert.ok(swift.includes('AWCNode preserves native children and named slots'));
  assert.ok(kotlin.includes('matching native content slots'));
  assert.ok(swift.includes('children: [.text("add", slot: "leading-icon"), .text("Continue")]'));
  assert.ok(kotlin.includes('if (slot == "leading-icon") Text("add")'));
  assert.ok(kotlin.includes('Text("Continue")'));
  assert.equal(swift.includes('<md-icon'), false);
  assert.ok(usageSnippet(button, {}, 'web', { html }).includes(html));
});

test('events are source-declared, deduplicated and omitted for structural components', async () => {
  const { listeners } = await runWebSnippet(usageSnippet({ ...button, events: ['mdClick', { name: 'mdClick' }] }, {}, 'web'));
  assert.deepEqual(listeners.map(item => item.name), ['mdClick']);
  assert.equal(usageSnippet({ tag: 'md-divider', properties: [], events: [] }, {}, 'web').includes('addEventListener'), false);
});

test('unsupported data and invalid component/platform fail explicitly; nonfinite JSON numbers become null', () => {
  assert.throws(() => usageSnippet({ tag: '</script>' }, {}, 'web'), /valid component tag/);
  assert.throws(() => usageSnippet(button, {}, 'other'), /Unknown snippet platform/);
  assert.throws(() => usageSnippet(button, { value: 1n }, 'web'), /JSON values/);
  const cycle = {}; cycle.self = cycle;
  assert.throws(() => usageSnippet(button, { payload: cycle }, 'ios'), /cycles/);
  assert.ok(usageSnippet(button, { value: Infinity }, 'ios').includes('"value": .null'));
  assert.ok(usageSnippet(button, { value: -0 }, 'android').includes('"value" to -0.0'));
  assert.ok(usageSnippet(button, { value: '\ud800' }, 'ios').includes('\\u{fffd}'));
});

test('all 81 actual source components produce examples for each platform', async () => {
  const manifest = JSON.parse(await readFile(new URL('../../packages/core/custom-elements.json', import.meta.url), 'utf8'));
  const components = manifest.modules.flatMap(module => module.declarations ?? []).filter(component => component.tagName);
  assert.equal(components.length, 81);
  for (const source of components) {
    const component = { tag: source.tagName, properties: (source.members ?? []).filter(member => member.kind === 'field'), events: source.events ?? [] };
    const recipe = recipeFor(component.tag);
    for (const platform of snippetLanguages.map(language => language.id)) {
      const snippet = usageSnippet(component, recipe.props, platform, { html: recipe.html });
      assert.ok(snippet.includes(['react', 'vue'].includes(platform) ? component.tag.split('-').map(part => part[0].toUpperCase() + part.slice(1)).join('') : component.tag), `${component.tag}/${platform}`);
      assert.equal(snippet.includes('[object Object]'), false);
    }
  }
});

test('language metadata is immutable and the original platform aliases remain identical', () => {
  assert.deepEqual(snippetLanguages.map(language => language.id), ['html', 'react', 'angular', 'vue', 'svelte', 'swift', 'android']);
  assert.ok(Object.isFrozen(snippetLanguages) && snippetLanguages.every(Object.isFrozen));
  assert.equal(usageSnippet(button, {}, 'web'), usageSnippet(button, {}, 'html'));
  assert.equal(usageSnippet(button, {}, 'ios'), usageSnippet(button, {}, 'swift'));
});

test('framework examples use verified package APIs, typed state, events and live structured values', () => {
  const props = { variant: 'outlined', selected: false, groupTabindex: null, payload: { items: ['a', 1, null] } };
  const html = '<md-button variant="filled"><span slot="leading-icon">add</span>Old label</md-button>';
  for (const language of ['react', 'angular', 'vue', 'svelte']) {
    const snippet = usageSnippet(button, props, language, { html, text: 'Current label' });
    assert.ok(snippet.includes(`@awc-ui/${language}`));
    assert.ok(snippet.includes('Partial<Components.MdButton>'));
    assert.ok(snippet.includes('"selected": false') && snippet.includes('"groupTabindex": null'));
    assert.ok(snippet.includes('Current label') && snippet.includes('leading-icon'));
    assert.equal(snippet.includes('Old label'), false);
    assert.equal(snippet.includes('filled'), false, 'Current props override old recipe attributes');
  }
  assert.ok(usageSnippet(button, props, 'react', { html }).includes('onMdClick={onEvent}'));
  assert.ok(usageSnippet(button, props, 'angular', { html }).includes('(mdClick)="onEvent($event)"'));
  assert.ok(usageSnippet(button, props, 'angular', { html }).includes('[variant]="properties.variant!"'));
  assert.ok(usageSnippet(button, props, 'vue', { html }).includes('@mdClick="onEvent"'));
  assert.ok(usageSnippet(button, props, 'svelte', { html }).includes('onmdClick={onEvent}'));
  assert.ok(usageSnippet(button, props, 'svelte', { html }).includes('import "@awc-ui/core/components/md-button";'));
});

test('all platforms discard hydration internals, comments, inline scripts and handler strings', () => {
  const html = '<md-button class="demo hydrated" s-id="1" c-id="2" data-stencil-root="x" onclick="evil()"><!--t.0--><span s-sn="" slot="leading-icon">add</span>Keep<script>evil()</script></md-button>';
  for (const language of snippetLanguages) {
    const snippet = usageSnippet(button, {}, language.id, { html });
    for (const unwanted of ['hydrated', 's-id', 'c-id', 's-sn', 'data-stencil', 'onclick', 'evil()', '<!--t.0-->']) assert.equal(snippet.includes(unwanted), false, `${language.id}: ${unwanted}`);
    assert.ok(snippet.includes('Keep') && snippet.includes('leading-icon'));
  }
});

test('parent context and only the first selected child receive edited props in all frameworks', () => {
  const component = { tag: 'md-table-cell', properties: [{ name: 'colspan' }], events: [] };
  const html = '<md-table columns="2"><md-table-body><md-table-row><md-table-cell>One</md-table-cell><md-table-cell>Two</md-table-cell></md-table-row></md-table-body></md-table>';
  for (const language of snippetLanguages) {
    const snippet = usageSnippet(component, { colspan: 2 }, language.id, { html });
    assert.ok(snippet.includes(language.id === 'react' || language.id === 'vue' ? 'MdTableBody' : 'md-table-body'));
    assert.ok(snippet.includes('One') && snippet.includes('Two'));
    if (['react', 'svelte'].includes(language.id)) assert.equal(snippet.split('{...properties}').length - 1, 1);
    if (language.id === 'vue') assert.equal(snippet.split('v-bind="properties"').length - 1, 1);
    if (language.id === 'angular') assert.equal(snippet.split('[colspan]="properties.colspan!"').length - 1, 1);
  }
});

async function compilerPackage(name, entry) {
  const directory = new URL('../../node_modules/.pnpm/', import.meta.url);
  const prefix = name.replaceAll('/', '+') + '@';
  const matches = (await readdir(directory)).filter(item => item.startsWith(prefix)).sort();
  if (!matches.length) throw new Error(`Compiler ${name} is not installed in this workspace.`);
  const loaded = await import(new URL(`${matches.at(-1)}/node_modules/${name}/${entry}`, directory));
  return loaded.default ?? loaded;
}

test('real TSX, Angular, Vue and Svelte compilers accept all 81 composed examples', async () => {
  const ts = (await import('typescript')).default;
  const angular = await compilerPackage('@angular/compiler', 'fesm2022/compiler.mjs');
  const vue = await compilerPackage('@vue/compiler-sfc', 'dist/compiler-sfc.cjs.js');
  const svelte = await compilerPackage('svelte', 'compiler/index.js');
  const manifest = JSON.parse(await readFile(new URL('../../packages/core/custom-elements.json', import.meta.url), 'utf8'));
  const components = manifest.modules.flatMap(module => module.declarations ?? []).filter(component => component.tagName);
  const extras = [{ tag: 'md-button', properties: [{ name: 'value' }, { name: 'payload' }], events: [{ name: 'mdClick' }], recipe: { props: { value: '</script> ${danger} ` \\ \u2028', payload: { a: [1, null, false, '<b>'] } }, html: '<md-button title="a > b" style="--custom: red; display:flex">{{value}} {code} @else ${eval} ` \\</md-button>' } }];
  for (const source of [...components, ...extras]) {
    const component = source.tag ? source : { tag: source.tagName, properties: (source.members ?? []).filter(member => member.kind === 'field'), events: source.events ?? [] };
    const recipe = source.recipe ?? recipeFor(component.tag);
    for (const language of ['react', 'angular', 'vue', 'svelte']) {
      const code = usageSnippet(component, recipe.props, language, { html: recipe.html });
      const label = `${component.tag}/${language}`;
      if (language === 'react' || language === 'angular') {
        const file = ts.createSourceFile(language === 'react' ? 'Example.tsx' : 'Example.ts', code, ts.ScriptTarget.Latest, true, language === 'react' ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
        assert.deepEqual(file.parseDiagnostics.map(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')), [], label);
        if (language === 'angular') {
          let template;
          function visit(node) { if (ts.isPropertyAssignment(node) && node.name.getText(file) === 'template') template = node.initializer.text; ts.forEachChild(node, visit); }
          visit(file);
          const result = angular.parseTemplate(template, 'Example.html');
          assert.deepEqual((result.errors ?? []).map(error => error.toString()), [], label);
        }
      } else if (language === 'vue') {
        const parsed = vue.parse(code, { filename: 'Example.vue' });
        assert.deepEqual(parsed.errors, [], label);
        vue.compileScript(parsed.descriptor, { id: 'example' });
        const result = vue.compileTemplate({ source: parsed.descriptor.template.content, filename: 'Example.vue', id: 'example' });
        assert.deepEqual(result.errors, [], label);
      } else {
        assert.doesNotThrow(() => svelte.compile(code, { filename: 'Example.svelte', generate: 'client' }), label);
      }
    }
  }
});

test('all 81 selected fixture prop objects typecheck against the actual public core interfaces', async () => {
  const ts = (await import('typescript')).default;
  const manifest = JSON.parse(await readFile(new URL('../../packages/core/custom-elements.json', import.meta.url), 'utf8'));
  const components = manifest.modules.flatMap(module => module.declarations ?? []).filter(component => component.tagName);
  const filename = fileURLToPath(new URL('GeneratedUsageProperties.ts', import.meta.url));
  const core = fileURLToPath(new URL('../../packages/core/src/components', import.meta.url));
  let source = `import type { Components } from ${JSON.stringify(core)};\n`;
  for (const component of components) {
    const declared = new Set((component.members ?? []).filter(member => member.kind === 'field').map(member => member.name));
    const values = Object.fromEntries(Object.entries(recipeFor(component.tagName).props).filter(([key]) => declared.has(key)));
    const name = component.tagName.split('-').map(part => part[0].toUpperCase() + part.slice(1)).join('');
    source += `export const ${name}: Partial<Components.${name}> = ${JSON.stringify(values)};\n`;
  }
  const options = { strict: true, noEmit: true, skipLibCheck: true, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler };
  const host = ts.createCompilerHost(options), original = host.getSourceFile.bind(host);
  host.getSourceFile = (path, language, ...rest) => path === filename ? ts.createSourceFile(path, source, language, true) : original(path, language, ...rest);
  const program = ts.createProgram([filename], options, host);
  const errors = ts.getPreEmitDiagnostics(program).filter(diagnostic => diagnostic.file?.fileName === filename);
  assert.deepEqual(errors.map(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')), []);
});

test('plain recipe text tolerates quoted angle brackets, entities and explicit empty content', () => {
  const html = '<md-button data-note="a > b" title="x < y">A &#x1f600; &amp; B</md-button>';
  assert.ok(usageSnippet(button, {}, 'ios', { html }).includes('children: [.text("A 😀 & B")]'));
  assert.ok(usageSnippet(button, {}, 'ios', { html, text: '' }).includes('children: []'));
  assert.equal(usageSnippet(button, {}, 'android', { html, text: '' }).includes('Text('), false);
  const values = Object.freeze({ selected: false, payload: Object.freeze({ list: Object.freeze([1, null]) }) });
  for (const platform of ['web', 'ios', 'android']) assert.ok(usageSnippet(button, values, platform).includes('md-button'));
  assert.deepEqual(values.payload.list, [1, null]);
});
