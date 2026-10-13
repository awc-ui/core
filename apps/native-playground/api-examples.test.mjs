import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { apiExample } from './api-examples.js';
import { mergeComponentDocumentation } from './documentation.js';

const frameworks = ['html', 'react', 'angular', 'vue', 'svelte'];
const button = {
  tag: 'md-button',
  events: [{ name: 'mdClick', detail: 'MdButtonClickDetail', cancelable: true }, { name: 'mdChange' }],
  eventPayloads: [{ name: 'mdClick', fields: [{ name: 'value', type: 'string' }, { name: 'selected', type: 'boolean' }, { name: 'originalEvent', type: 'MouseEvent' }] }],
  slots: [{ name: '' }, { name: 'leading-icon' }], cssParts: [{ name: 'button' }, { name: 'anchor' }],
};

async function executeHTML(code, component = {}) {
  const scripts = [...code.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)];
  assert.equal(scripts.length, 1);
  const componentListeners = new Map(), buttonListeners = new Map(), definitions = [], logs = [];
  const runButton = { addEventListener: (name, handler) => buttonListeners.set(name, handler) };
  component.addEventListener = (name, handler) => componentListeners.set(name, handler);
  const context = vm.createContext({ document: { querySelector: selector => selector === '#run-api' ? runButton : component }, customElements: { whenDefined: async name => definitions.push(name) }, console: { log: (...args) => logs.push(args) } });
  await new vm.Script(`(async () => { ${scripts[0][1].replace(/^import .*;$/gm, '')}\n})()`).runInContext(context, { timeout: 1000 });
  return { componentListeners, buttonListeners, definitions, logs };
}

test('a specific HTML event binds once and reads the documented payload fields', async () => {
  const example = apiExample(button, 'event', 'mdClick', 'html');
  const run = await executeHTML(example.code);
  assert.deepEqual([...run.componentListeners.keys()], ['mdClick']);
  run.componentListeners.get('mdClick')({ detail: { value: 'save', selected: true, originalEvent: {} } });
  assert.deepEqual(run.logs, [['save', true]]);
  assert.deepEqual(run.definitions, ['md-button']);
  assert.match(example.code, /event\.preventDefault\(\)/);
  assert.doesNotMatch(example.code, /for \(const name|originalEvent/);
});

test('event bindings preserve each wrapper convention and source payload types', () => {
  const bindings = { react: /onMdClick=\{onMdClick\}/, angular: /\(mdClick\)="onMdClick\(\$event\)"/, vue: /@mdClick="onMdClick"/, svelte: /onmdClick=\{onMdClick\}/ };
  for (const [framework, binding] of Object.entries(bindings)) {
    const example = apiExample(button, 'event', 'mdClick', framework);
    assert.match(example.code, binding);
    assert.match(example.code, /CustomEvent<HTMLMdButtonElementEventMap\["mdClick"\]>/);
    assert.doesNotMatch(example.code, /onMdChange=|@mdChange|onmdChange/);
  }
  for (const framework of frameworks) assert.match(apiExample(button, 'event', 'mdChange', framework).code, /<(?:md-button|MdButton) toggle/);
  const empty = apiExample({ tag: 'md-dialog', events: [{ name: 'mdOpened', detail: { text: 'void' } }] }, 'event', 'mdOpened', 'html');
  assert.match(empty.description, /does not carry a detail payload/);
  assert.doesNotMatch(empty.code, /event\.detail/);
});

test('post-commit events never suggest cancellation even when metadata marks them cancelable', () => {
  for (const tag of ['md-button', 'md-switch', 'md-autocomplete', 'md-color-picker', 'md-number-field', 'md-slider']) {
    const component = { tag, events: [{ name: 'mdChange', cancelable: true }] };
    for (const framework of frameworks) {
      const example = apiExample(component, 'event', 'mdChange', framework);
      assert.doesNotMatch(example.code, /preventDefault|Cancel the default action/, `${tag} ${framework} observes the committed change`);
      assert.ok(example.notes.some(note => /does not undo/.test(note)));
      if (tag === 'md-button') assert.ok(example.notes.some(note => /Use mdClick to veto/.test(note)));
      if (tag === 'md-switch') assert.ok(example.notes.some(note => /Use mdInput to veto/.test(note)));
    }
  }
  for (const [tag, name] of [['md-button', 'mdClick'], ['md-switch', 'mdInput'], ['md-breadcrumb-item', 'mdSelect'], ['md-chip', 'mdRemove'], ['md-stepper', 'mdBeforeChange']]) {
    const component = { tag, events: [{ name, cancelable: true }] };
    for (const framework of frameworks) assert.match(apiExample(component, 'event', name, framework).code, /event\.preventDefault\(\)/);
  }
  const notification = { tag: 'md-dialog', events: [{ name: 'mdClose', cancelable: true }] };
  assert.doesNotMatch(apiExample(notification, 'event', 'mdClose', 'html').code, /preventDefault/);
});

test('method examples actually await concrete arguments, without undeclared sample variables', async () => {
  const component = { tag: 'md-number-field', methods: [{ name: 'stepUp', parameters: [{ name: 'times', type: { text: 'number' }, optional: true }], returns: { type: { text: 'Promise<void>' } } }] };
  let calls = 0;
  const run = await executeHTML(apiExample(component, 'method', 'stepUp', 'html').code, { stepUp: async times => { assert.equal(times, 2); calls++; } });
  assert.equal(calls, 0);
  await run.buttonListeners.get('click')();
  assert.equal(calls, 1);
  assert.deepEqual(run.definitions, ['md-number-field']);
  const react = apiExample(component, 'method', 'stepUp', 'react').code;
  assert.match(react, /useRef<HTMLMdNumberFieldElement>\(null\)/);
  assert.match(react, /ref=\{ref\}/);
  const vue = apiExample(component, 'method', 'stepUp', 'vue').code;
  assert.match(vue, /view\.value\?\.\$el/);
  assert.match(vue, /\$el: HTMLMdNumberFieldElement/);
  const angular = apiExample(component, 'method', 'stepUp', 'angular').code;
  assert.match(angular, /@ViewChild\(MdNumberField\) view\?: MdNumberField/);
  assert.match(angular, /await component\.stepUp\(2\)/);
  assert.match(apiExample(component, 'method', 'stepUp', 'svelte').code, /bind:this=\{view\}/);
});

test('method arguments support type objects, strings and application-specific unsupported shapes', () => {
  const component = { tag: 'md-list', methods: [{ name: 'selectItem', parameters: [{ name: 'index', type: { text: 'number' } }] }] };
  assert.match(apiExample(component, 'method', 'selectItem', 'html').code, /component\.selectItem\(0\)/);
  component.methods[0].parameters[0].type = 'number';
  assert.match(apiExample(component, 'method', 'selectItem', 'html').code, /component\.selectItem\(0\)/);
  const custom = { tag: 'md-custom', methods: [{ name: 'configure', parameters: [{ name: 'provider', type: 'ApplicationProvider' }] }] };
  const example = apiExample(custom, 'method', 'configure', 'react');
  assert.equal(example.status, 'unknown');
  assert.equal(example.code, null);
});

test('slots project actual child content and native named slots across all web frameworks', () => {
  for (const framework of frameworks) {
    const icon = apiExample(button, 'slot', 'leading-icon', framework);
    assert.match(icon.code, /<svg slot="leading-icon"/);
    assert.match(icon.code, /<path/);
    assert.doesNotMatch(icon.code, /#leading-icon|v-slot|<slot/);
    const content = apiExample(button, 'slot', '', framework);
    assert.match(content.code, /Continue/);
    assert.doesNotMatch(content.code, /slot=""/);
    const tabs = apiExample({ tag: 'md-tabs', slots: [{ name: '' }] }, 'slot', '', framework);
    assert.match(tabs.code, framework === 'react' || framework === 'vue' ? /<MdTab label="Overview"/ : /<md-tab label="Overview"/);
    if (framework !== 'html' && framework !== 'svelte') assert.match(tabs.code, /import \{ MdTabs, MdTab \}/);
  }
  assert.match(apiExample(button, 'slot', 'leading-icon', 'react').code, /strokeWidth=/);
});

test('CSS part examples target the selected part and explain stylesheet scope', () => {
  for (const framework of frameworks) {
    const example = apiExample(button, 'cssPart', 'anchor', framework);
    assert.match(example.code, /md-button::part\(anchor\)/);
    assert.match(example.code, /text-decoration: underline/);
    assert.ok(example.notes.some(note => /href/.test(note)));
    if (framework === 'react') assert.ok(example.notes.some(note => /import "\.\/component-parts.css"/.test(note)));
    if (framework === 'angular') assert.match(example.code, /src\/styles.css/);
    if (framework === 'vue') assert.match(example.code, /^<style>/);
    if (framework === 'svelte') assert.match(example.code, /:global\(md-button::part\(anchor\)\)/);
  }
  assert.match(apiExample(button, 'cssPart', { name: 'label' }, 'html').code, /font-weight: 600/);
  assert.match(apiExample(button, 'cssPart', { name: 'icon' }, 'html').code, /font-size: 20px/);
  assert.match(apiExample(button, 'cssPart', { name: 'loading' }, 'html').code, /--md-loading-indicator-size: 20px/);
  assert.ok(apiExample(button, 'cssPart', { name: 'loading' }, 'html').notes.some(note => /Set loading/.test(note)));
  assert.match(apiExample({ tag: 'md-dialog' }, 'cssPart', { name: 'container' }, 'html').code, /border-radius: 12px/);
});

test('malformed metadata cannot inject executable source or markup', () => {
  for (const kind of ['event', 'slot', 'method', 'cssPart']) {
    const example = apiExample(button, kind, { name: '</script><script>alert(1)</script>' }, 'html');
    assert.equal(example.code, null);
  }
  const hostile = '</script><script>alert(1)</script>"\u2028';
  const component = { ...button, eventPayloads: [{ name: 'mdClick', fields: [{ name: hostile, type: 'string' }] }] };
  const code = apiExample(component, 'event', 'mdClick', 'html').code;
  assert.equal((code.match(/<\/script>/g) || []).length, 1);
  assert.match(code, /\\u003c\/script\\u003e/);
});

test('native API examples are dispatched with explicit unsupported status', () => {
  const component = { ...button, support: { ios: { unsupportedMethods: ['setFocus'] }, android: { unsupportedMethods: ['setFocus'] } }, methods: [{ name: 'setFocus' }] };
  for (const framework of ['swift', 'android']) {
    const example = apiExample(component, 'method', 'setFocus', framework);
    assert.equal(example.status, 'unsupported');
    assert.equal(example.code, null);
  }
});

test('all source methods and event handlers type-check against the public core declarations', async () => {
  const manifest = JSON.parse(await readFile(new URL('../../packages/core/custom-elements.json', import.meta.url), 'utf8'));
  const components = manifest.modules.flatMap(module => module.declarations || []).filter(item => item.tagName);
  const declarations = ['import type { Components } from "../../packages/core/src/components";'];
  let index = 0;
  for (const raw of components) {
    const component = mergeComponentDocumentation(raw);
    const name = component.tag.split('-').map(part => part[0].toUpperCase() + part.slice(1)).join('');
    for (const method of component.methods || []) {
      const example = apiExample(component, 'method', method.name, 'html');
      assert.equal(example.status, 'supported', `${component.tag}.${method.name} has a usable argument example`);
      const call = example.code.match(/(?:const result = )?await component\.[\s\S]+?;\n(?:  )?(?:console\.log\(result\);\n)?/)[0];
      declarations.push(`async function method${index++}(component: Components.${name}) {\n${call}\n}`);
    }
    for (const event of component.events || []) {
      const example = apiExample(component, 'event', event.name, 'react');
      const handler = example.code.match(/function on[\s\S]+?\n}/)[0].replace(/function on\w+/, `function event${index++}`);
      declarations.push(handler);
    }
  }
  const filename = fileURLToPath(new URL('./api-examples-typecheck.ts', import.meta.url));
  const source = declarations.join('\n');
  const options = { noEmit: true, strict: true, skipLibCheck: true, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, jsx: ts.JsxEmit.Preserve };
  const host = ts.createCompilerHost(options), getSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (path, languageVersion, onError, shouldCreateNewSourceFile) => path === filename ? ts.createSourceFile(path, source, languageVersion, true) : getSourceFile(path, languageVersion, onError, shouldCreateNewSourceFile);
  const program = ts.createProgram([filename], options, host);
  const diagnostics = ts.getPreEmitDiagnostics(program).filter(item => item.file?.fileName === filename);
  assert.equal(diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(diagnostics, { getCanonicalFileName: name => name, getCurrentDirectory: () => '.', getNewLine: () => '\n' }));
});

test('generated web examples contain syntactically valid scripts in each framework', () => {
  const component = { ...button, methods: [{ name: 'setFocus', parameters: [], returns: { type: { text: 'Promise<void>' } } }] };
  for (const framework of frameworks) for (const [kind, member] of [['event', 'mdClick'], ['method', 'setFocus'], ['slot', 'leading-icon']]) {
    const { code } = apiExample(component, kind, member, framework);
    const source = ['html', 'vue', 'svelte'].includes(framework) ? code.match(/<script[^>]*>([\s\S]*?)<\/script>/)[1] : code;
    const file = ts.createSourceFile('example.' + (framework === 'react' ? 'tsx' : 'ts'), source, ts.ScriptTarget.Latest, true, framework === 'react' ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    assert.deepEqual(file.parseDiagnostics, [], `${framework} ${kind} has valid syntax`);
  }
});

test('verified wrapper APIs and button styling hooks remain aligned with source', async () => {
  const [react, vue, angular, css] = await Promise.all([
    readFile(new URL('../../packages/react/src/components/MdButton.ts', import.meta.url), 'utf8'),
    readFile(new URL('../../packages/vue/lib/runtime.ts', import.meta.url), 'utf8'),
    readFile(new URL('../../packages/angular/src/directives/proxies.ts', import.meta.url), 'utf8'),
    readFile(new URL('../../packages/core/src/components/md-button/md-button.css', import.meta.url), 'utf8'),
  ]);
  assert.match(react, /onMdClick: 'mdClick'/);
  assert.match(vue, /return h\(name, propsToAdd, slots\.default/);
  assert.match(angular, /methods: \[[^\]]*'stepUp'/);
  assert.match(css, /--md-loading-indicator-size: var\(--_loading-size\)/);
  assert.match(css, /--md-loading-indicator-shape-size: var\(--_loading-size\)/);
  assert.match(css, /--md-loading-indicator-color: var\(--_loading-color\)/);
  assert.match(css, /\.md-button__anchor \{[\s\S]*?display: flex/);
});
