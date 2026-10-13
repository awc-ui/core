import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { usageSnippet, snippetLanguages, recipePropertyValues } from './usage-snippets.js';
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

const editableButton = '<md-button><span slot="leading-icon">add</span>Old label<span slot="">Old default</span><b>Old markup</b><span slot="trailing-icon">arrow_forward</span></md-button>';

test('edited button text replaces all default content and preserves named icons in every language', () => {
  for (const { id } of snippetLanguages) {
    const snippet = usageSnippet(button, {}, id, { html: editableButton, text: 'Salvează „Știință” 😀' });
    assert.ok(snippet.includes('Salvează „Știință” 😀'), id);
    assert.ok(snippet.includes('leading-icon') && snippet.includes('add'), id);
    assert.ok(snippet.includes('trailing-icon') && snippet.includes('arrow_forward'), id);
    for (const stale of ['Old label', 'Old default', 'Old markup']) assert.equal(snippet.includes(stale), false, `${id}: ${stale}`);
    assert.ok(usageSnippet(button, {}, id, { html: editableButton }).includes('Old label'), `${id}: omitted text preserves fixture`);
  }
});

test('cleared and whitespace-only button text stay explicit in native examples and remove old web content', () => {
  for (const text of ['', '   ']) {
    for (const { id } of snippetLanguages) {
      const snippet = usageSnippet(button, {}, id, { html: editableButton, text });
      assert.equal(snippet.includes('Old'), false, id);
      assert.ok(snippet.includes('leading-icon') && snippet.includes('trailing-icon'), id);
      if (id === 'swift') assert.ok(snippet.includes(`.text("${text}")`), id);
      if (id === 'android') assert.ok(snippet.includes(`if (slot == "") Text("${text}")`), id);
    }
  }
});

test('text override only edits the selected button in a larger recipe', () => {
  const html = '<md-button-group><md-button>Old first</md-button><md-button>Keep second</md-button></md-button-group>';
  for (const { id } of snippetLanguages) {
    const snippet = usageSnippet(button, {}, id, { html, text: 'Edited first' });
    assert.ok(snippet.includes('Edited first') && snippet.includes('Keep second'), id);
    assert.equal(snippet.includes('Old first'), false, id);
    assert.equal(snippet.split('Edited first').length - 1, 1, id);
  }
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

test('edited markup and interpolation syntax compile as literal label text in all seven languages', async () => {
  const text = 'Știință 😀 "quoted" \'single\' & <b>markup</b> </script><script>danger()</script> {{danger()}} {danger()} @if (true) ${danger()} ` \\(danger)';
  const snippets = Object.fromEntries(snippetLanguages.map(({ id }) => [id, usageSnippet(button, {}, id, { html: editableButton, text })]));
  const [ts, angular, vue, svelte, dom] = await Promise.all([
    import('typescript').then(module => module.default),
    compilerPackage('@angular/compiler', 'fesm2022/compiler.mjs'),
    compilerPackage('@vue/compiler-sfc', 'dist/compiler-sfc.cjs.js'),
    compilerPackage('svelte', 'compiler/index.js'),
    compilerPackage('@stencil/core', 'mock-doc/index.cjs'),
  ]);

  const document = dom.createDocument(snippets.html);
  const selected = document.querySelector('md-button');
  assert.equal([...selected.childNodes].filter(node => node.nodeType === 3).map(node => node.textContent).join(''), text);
  assert.equal(document.querySelectorAll('script').length, 1, 'HTML label cannot introduce a script element');
  await runWebSnippet(snippets.html);

  const react = ts.transpileModule(snippets.react, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX }, reportDiagnostics: true });
  assert.deepEqual(react.diagnostics ?? [], []);
  const element = (type, props) => ({ type, props });
  const context = vm.createContext({ exports: {}, require: name => name === 'react' ? { useState: value => [value] } : name === 'react/jsx-runtime' ? { jsx: element, jsxs: element, Fragment: 'Fragment' } : new Proxy({}, { get: (_, key) => key }) });
  new vm.Script(react.outputText).runInContext(context, { timeout: 1000 });
  const reactButton = context.exports.ComponentExample().props.children;
  assert.equal(reactButton.type, 'MdButton');
  assert.equal(reactButton.props.children.filter(child => typeof child === 'string').join(''), text);

  const angularFile = ts.createSourceFile('Example.ts', snippets.angular, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  assert.deepEqual(angularFile.parseDiagnostics, []);
  let template;
  function visit(node) { if (ts.isPropertyAssignment(node) && node.name.getText(angularFile) === 'template') template = node.initializer.text; ts.forEachChild(node, visit); }
  visit(angularFile);
  const angularTree = angular.parseTemplate(template, 'Example.html');
  assert.deepEqual(angularTree.errors ?? [], []);
  const angularText = angularTree.nodes[0].children.find(node => node.value?.ast?.expressions);
  assert.deepEqual(angularText.value.ast.strings, ['', '']);
  assert.equal(angularText.value.ast.expressions.length, 1);
  assert.equal(angularText.value.ast.expressions[0].value, text, 'Angular must bind a string literal, not execute label interpolation');

  const vueFile = vue.parse(snippets.vue, { filename: 'Example.vue' });
  assert.deepEqual(vueFile.errors, []);
  vue.compileScript(vueFile.descriptor, { id: 'example' });
  const vueTree = vue.compileTemplate({ source: vueFile.descriptor.template.content, filename: 'Example.vue', id: 'example' });
  assert.deepEqual(vueTree.errors, []);
  const vueChildren = vueTree.ast.children[0].children.map(node => node.type === 12 ? node.content : node);
  assert.equal(vueChildren.filter(node => node.type === 2).map(node => node.content).join(''), text);

  assert.doesNotThrow(() => svelte.compile(snippets.svelte, { filename: 'Example.svelte', generate: 'client' }));
  const svelteButton = svelte.parse(snippets.svelte).html.children.find(node => node.name === 'md-button');
  assert.equal(svelteButton.children.filter(node => node.type === 'Text').map(node => node.data).join(''), text);

  const swiftText = text.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
  assert.ok(snippets.swift.includes(`.text("${swiftText}")`));
  const kotlinText = swiftText.replaceAll('$', '\\$');
  assert.ok(snippets.android.includes(`if (slot == "") Text("${kotlinText}")`));
});

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

test('all 81 selected fixture attributes and prop objects typecheck against the actual public core interfaces', async () => {
  const ts = (await import('typescript')).default;
  const { mergeComponentDocumentation } = await import('./documentation.js');
  const manifest = JSON.parse(await readFile(new URL('../../packages/core/custom-elements.json', import.meta.url), 'utf8'));
  const components = manifest.modules.flatMap(module => module.declarations ?? []).filter(component => component.tagName);
  const filename = fileURLToPath(new URL('GeneratedUsageProperties.ts', import.meta.url));
  const core = fileURLToPath(new URL('../../packages/core/src/components', import.meta.url));
  let source = `import type { Components } from ${JSON.stringify(core)};\n`;
  for (const component of components) {
    const declared = new Set((component.members ?? []).filter(member => member.kind === 'field').map(member => member.name));
    const recipe = recipeFor(component.tagName);
    assert.deepEqual(Object.keys(recipe.props).filter(key => !declared.has(key)), [], `${component.tagName} has no undeclared fixture props`);
    const values = recipePropertyValues(component, recipe);
    assert.deepEqual(recipePropertyValues(mergeComponentDocumentation(component), recipe), values, `${component.tagName} behaves identically with normalized catalog metadata`);
    assert.deepEqual(Object.keys(values).filter(key => !declared.has(key)), [], `${component.tagName} extracts only declared values`);
    for (const [key, value] of Object.entries(recipe.props)) assert.deepEqual(values[key], value, `${component.tagName}.${key} retains explicit fixture precedence`);
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

test('recipe property extraction gives native-first routes the selected component authored state', async () => {
  const manifest = JSON.parse(await readFile(new URL('../../packages/core/custom-elements.json', import.meta.url), 'utf8'));
  const components = new Map(manifest.modules.flatMap(module => module.declarations ?? []).filter(component => component.tagName).map(component => [component.tagName, component]));
  const accordion = recipePropertyValues(components.get('md-accordion-item'));
  assert.equal(accordion.headline, 'A shared design language');
  assert.equal(accordion.supportingText, 'Built for every surface');
  assert.equal(accordion.expanded, true);
  assert.equal(recipePropertyValues(components.get('md-segmented-button')).label, 'Day');
  assert.equal(recipePropertyValues(components.get('md-fab-menu-item')).label, 'New document');
  assert.equal(recipePropertyValues(components.get('md-list-item')).headline, 'Design systems');
  assert.deepEqual(recipePropertyValues(components.get('md-table-row')), { value: 'android', expandable: true, clickable: true }, 'does not inherit the parent table selection, columns, or label');
  assert.deepEqual(recipePropertyValues(components.get('md-table-pagination')), { count: 2, rowsPerPage: 1 }, 'explicit recipe value wins over its authored rows-per-page=5 attribute');
  const chart = recipePropertyValues(components.get('md-line-chart'));
  assert.equal(chart.heightProp, '260px');
  assert.equal(chart.series[0].data[3], 42);
  assert.equal(chart.noAnimation, true);
  const density = recipePropertyValues(components.get('md-accordion-item'), { html: '<md-accordion-item density="-2" heading-level="4" expanded="false" headline="A &amp; B"></md-accordion-item>', props: {} });
  assert.deepEqual(density, { density: -2, headingLevel: 4, expanded: false, headline: 'A & B' });
});

test('recipe properties preserve declared primitive, literal and JSON types without executing authored text', () => {
  const component = { tag: 'md-example', properties: [
    { name: 'expanded', type: { text: 'boolean' } }, { name: 'choice', type: 'true | false' },
    { name: 'density', type: '0 | -1 | -2' }, { name: 'label', type: 'string' },
    { name: 'heightProp', attribute: 'height', type: 'string' },
    { name: 'settings', type: 'Record<string, unknown> | null' }, { name: 'data', type: 'number[]' },
    { name: 'maybeText', type: 'string | number' }, { name: 'formatter', type: '(value: string) => string' },
  ] };
  const recipe = { html: '<div label="Parent"><md-example expanded choice density="-2" label="001" height="260px" settings=\'{"enabled":true,"items":[1,null]}\' data="[1,2,3]" maybe-text="hello" formatter="danger()" undeclared="no"><md-example label="Child"></md-example></md-example><md-example label="Sibling"></md-example></div>', props: { expanded: false, undeclared: 'no', data: [9, 8] } };
  const values = recipePropertyValues(component, recipe);
  assert.deepEqual(values, { expanded: false, choice: true, density: -2, label: '001', heightProp: '260px', settings: { enabled: true, items: [1, null] }, data: [9, 8], maybeText: 'hello' });
  values.data.push(7);
  assert.deepEqual(recipe.props.data, [9, 8], 'structured fixture values are cloned');
  assert.deepEqual(recipePropertyValues(component, { html: '<md-example expanded="false" density="bad" data="danger()" label="original"></md-example>', props: { label: undefined } }), { expanded: false }, 'invalid source and explicit unset values are omitted');
  assert.throws(() => recipePropertyValues({ tag: '<script>' }), /valid component tag/);
});

test('plain recipe text tolerates quoted angle brackets, entities and explicit empty content', () => {
  const html = '<md-button data-note="a > b" title="x < y">A &#x1f600; &amp; B</md-button>';
  assert.ok(usageSnippet(button, {}, 'ios', { html }).includes('children: [.text("A 😀 & B")]'));
  assert.ok(usageSnippet(button, {}, 'ios', { html, text: '' }).includes('children: [.text("")]'));
  assert.ok(usageSnippet(button, {}, 'android', { html, text: '' }).includes('if (slot == "") Text("")'));
  const values = Object.freeze({ selected: false, payload: Object.freeze({ list: Object.freeze([1, null]) }) });
  for (const platform of ['web', 'ios', 'android']) assert.ok(usageSnippet(button, values, platform).includes('md-button'));
  assert.deepEqual(values.payload.list, [1, null]);
});

test('copied overlay controls execute in HTML and every framework instead of leaving setup placeholders', async () => {
  const [dom, ts] = await Promise.all([compilerPackage('@stencil/core', 'mock-doc/index.cjs'), import('typescript').then(module => module.default)]);
  for (const tag of ['md-menu', 'md-menu-item', 'md-sub-menu-item', 'md-dialog', 'md-bottom-sheet', 'md-side-sheet', 'md-snackbar']) {
    const recipe = recipeFor(tag), component = { tag, events: [] };
    for (const language of ['html', 'react', 'angular', 'vue', 'svelte']) {
      const code = usageSnippet(component, recipe.props, language, { html: recipe.html });
      const label = `${tag}/${language}`;
      assert.doesNotMatch(code, /Wire the recipe launch\/close/, label);
      assert.match(code, /onRecipeAction/, label);
      const document = dom.createDocument(`<div data-awc-example="">${recipe.html}</div>`);
      const triggers = [...document.querySelectorAll('[data-awc-action]')];
      if (language === 'html') {
        const script = code.match(/<script type="module">([\s\S]*?)<\/script>/)[1].replace(/^import .*;$/gm, '');
        const actual = dom.createDocument(code);
        const context = vm.createContext({ document: actual, customElements: { whenDefined: async () => {} }, console: { log() {} } });
        await new vm.Script(`(async () => { ${script}\n})()`).runInContext(context);
        for (const trigger of actual.querySelectorAll('[data-awc-action]')) {
          const target = actual.getElementById(trigger.getAttribute('data-awc-target'));
          target.open = trigger.getAttribute('data-awc-action') === 'close';
          trigger.dispatchEvent(new dom.MockMouseEvent('click'));
          assert.equal(target.open, trigger.getAttribute('data-awc-action') !== 'close', label);
        }
        continue;
      }
      const bindings = { react: /onClick=\{onRecipeAction\}/, angular: /\(click\)="onRecipeAction\(\$event\)"/, vue: /@click="onRecipeAction"/, svelte: /onclick=\{onRecipeAction\}/ };
      assert.match(code, bindings[language], label);
      assert.match(code, /<div data-awc-example="">/, 'React must receive a string-valued data attribute');
      const script = ['vue', 'svelte'].includes(language) ? code.match(/<script[^>]*>([\s\S]*?)<\/script>/)[1] : code;
      const file = ts.createSourceFile(language === 'react' ? 'Example.tsx' : 'Example.ts', script, ts.ScriptTarget.Latest, true, language === 'react' ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
      let handler;
      function visit(node) {
        if ((ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) && node.name?.getText(file) === 'onRecipeAction') handler = node.getText(file);
        ts.forEachChild(node, visit);
      }
      visit(file);
      assert.ok(handler, label);
      if (!handler.startsWith('function')) handler = 'function ' + handler;
      const output = ts.transpileModule(handler, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
      const context = vm.createContext({});
      const run = new vm.Script(output + '\nonRecipeAction;').runInContext(context);
      for (const trigger of triggers) {
        const target = document.getElementById(trigger.getAttribute('data-awc-target'));
        target.open = trigger.getAttribute('data-awc-action') === 'close';
        run({ currentTarget: trigger });
        assert.equal(target.open, trigger.getAttribute('data-awc-action') !== 'close', label);
      }
    }
  }
});

test('native text-slot edits preserve unsupported slots, structural children and explicitly empty text', () => {
  const sourceHtml = '<md-accordion-item><span slot="headline">Original headline</span><p>Original body</p><md-button slot="actions">Save</md-button><span slot="unsupported">Keep me</span></md-accordion-item>';
  const component = { tag: 'md-accordion-item', support: { ios: { slots: ['', 'headline', 'actions'] }, android: { slots: ['', 'headline', 'actions'] } } };
  const slots = { '': '', headline: 'Updated "headline"', actions: 'Would erase the button', unsupported: 'Not implemented' };
  for (const platform of ['swift', 'android']) {
    const code = usageSnippet(component, {}, platform, { html: '<md-accordion-item>Web-only edits</md-accordion-item>', sourceHtml, slots });
    assert.match(code, /Updated \\"headline\\"/);
    assert.doesNotMatch(code, /Original headline|Original body|Web-only edits|Would erase|Not implemented/);
    assert.match(code, /md-button/);
    assert.match(code, /Save/);
    assert.match(code, /Keep me/);
    assert.match(code, platform === 'swift' ? /\.text\(""\)/ : /Text\(""\)/);
  }
  const structural = { tag: 'md-tabs', support: { ios: { slots: [''] }, android: { slots: [''] } } };
  for (const platform of ['swift', 'android']) {
    const code = usageSnippet(structural, {}, platform, { sourceHtml: '<md-tabs><md-tab label="Overview"></md-tab></md-tabs>', slots: { '': 'Not a tab' } });
    assert.match(code, /md-tab/);
    assert.match(code, /Overview/);
    assert.doesNotMatch(code, /Not a tab/);
  }
  const unavailable = { tag: 'md-button', support: { ios: { slots: [''], unsupportedSlots: [''] }, android: { status: 'missing-adapter', slots: [''] } } };
  for (const platform of ['swift', 'android']) assert.doesNotMatch(usageSnippet(unavailable, {}, platform, { sourceHtml: '<md-button>Keep original</md-button>', slots: { '': 'Reject edit' } }), /Reject edit/);
});

test('accepted native default-slot edits clear only the selected component property that masks its text', () => {
  const masks = {
    'md-segmented-button': 'label', 'md-fab-menu-item': 'label', 'md-select-option': 'label',
    'md-split-button': 'label', 'md-chip': 'label', 'md-list-item': 'headline', 'md-snackbar': 'message',
  };
  for (const [tag, mask] of Object.entries(masks)) for (const platform of ['swift', 'android']) for (const value of ['Updated content', '']) {
    const component = { tag, support: { ios: { slots: [''] }, android: { slots: [''] } } };
    const properties = { [mask]: 'Property fallback', disabled: false };
    const sourceHtml = `<div><${tag} ${mask}="Attribute fallback">Original content</${tag}><${tag} ${mask}="Keep sibling"></${tag}></div>`;
    const code = usageSnippet(component, properties, platform, { sourceHtml, slots: { '': value } });
    assert.doesNotMatch(code, /Property fallback|Attribute fallback|Original content/, `${tag}/${platform} does not mask the edited slot`);
    assert.match(code, /Keep sibling/, 'an unselected sibling retains its own label');
    assert.match(code, new RegExp(platform === 'swift' ? `"${mask}": \\.string\\(""\\)` : `"${mask}" to ""`));
    assert.ok(code.includes(platform === 'swift' ? `.text(${JSON.stringify(value)})` : `Text(${JSON.stringify(value)})`), `${tag}/${platform} retains explicit text, including empty content`);
    assert.deepEqual(properties, { [mask]: 'Property fallback', disabled: false }, 'snippet generation does not mutate the supplied property object');
  }
});

test('native slot edits preserve region titles and preserve property precedence when the edit is rejected or unrelated', () => {
  for (const tag of ['md-accordion-item', 'md-bottom-sheet', 'md-dialog', 'md-side-sheet', 'md-step']) for (const platform of ['swift', 'android']) {
    const field = tag === 'md-step' ? 'label' : 'headline';
    const component = { tag, support: { ios: { slots: [''] }, android: { slots: [''] } } };
    const code = usageSnippet(component, { [field]: 'Keep region title' }, platform, { sourceHtml: `<${tag}>Body</${tag}>`, slots: { '': 'Edited body' } });
    assert.match(code, /Keep region title/);
    assert.match(code, /Edited body/);
  }
  const cases = [
    { slots: { '': 'Rejected edit' }, support: { slots: [''], unsupportedSlots: [''] }, content: 'Original content' },
    { slots: { '': 'Rejected edit' }, support: { slots: [''], status: 'missing-adapter' }, content: 'Original content' },
    { slots: { '': 123 }, support: { slots: [''] }, content: 'Original content' },
    { slots: { '': 'Rejected edit' }, support: { slots: [''] }, content: '<md-button>Structural child</md-button>' },
    { slots: { 'supporting-text': 'New supporting text' }, support: { slots: ['', 'supporting-text'] }, content: 'Original content' },
  ];
  for (const { slots, support, content } of cases) for (const platform of ['swift', 'android']) {
    const component = { tag: 'md-list-item', support: { ios: support, android: support } };
    const code = usageSnippet(component, { headline: 'Keep headline' }, platform, { sourceHtml: `<md-list-item>${content}</md-list-item>`, slots });
    assert.match(code, /Keep headline/);
    assert.doesNotMatch(code, /Rejected edit/);
    assert.match(code, /Original content|Structural child/);
  }
});
