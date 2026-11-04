import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { apiExample, methodExampleArguments } from './api-examples.js';
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
  for (const framework of frameworks) assert.match(apiExample(button, 'event', 'mdChange', framework).code, /"toggle": true/);
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
  assert.match(angular, /@ViewChild\('view'\) view\?: MdNumberField/);
  assert.match(angular, /<md-number-field #view/);
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

test('live method defaults are JSON values from documented signatures and fixture data', () => {
  const component = { tag: 'md-table', methods: [{ name: 'setSort', parameters: [{ name: 'column', type: 'string' }, { name: 'order', type: 'MdTableSortOrder' }] }, { name: 'getSelection', parameters: [] }] };
  assert.deepEqual(methodExampleArguments(component, 'setSort'), ['platform', 'asc']);
  assert.deepEqual(methodExampleArguments(component, 'getSelection'), []);
  assert.equal(methodExampleArguments(component, 'undocumented'), null);
  assert.equal(methodExampleArguments({ tag: 'md-custom' }, { name: 'configure', parameters: [{ name: 'app', type: 'ApplicationProvider' }] }), null);
  assert.equal(methodExampleArguments({ tag: 'md-custom' }, { name: 'loadOptions', parameters: [{ name: 'provider', type: 'ApplicationProvider' }] }), null, 'a matching method name does not infer another component’s contract');
  const options = methodExampleArguments({ tag: 'md-select' }, { name: 'loadOptions' });
  assert.equal(options[0][0].value, 'design');
  options[0][0].value = 'changed';
  assert.equal(methodExampleArguments({ tag: 'md-select' }, { name: 'loadOptions' })[0][0].value, 'design', 'callers cannot mutate future defaults');
  assert.deepEqual(methodExampleArguments({ tag: 'md-list' }, { name: 'selectItem', parameters: [{ name: 'index', type: { text: 'number' } }] }), [0]);
});

test('event and method examples include data, parent composition and source-required interaction flags', async () => {
  const manifest = JSON.parse(await readFile(new URL('../../packages/core/custom-elements.json', import.meta.url), 'utf8'));
  const components = new Map(manifest.modules.flatMap(module => module.declarations || []).filter(item => item.tagName).map(item => [item.tagName, mergeComponentDocumentation(item)]));
  const examples = [
    ['md-card', 'event', 'mdClick', /"interactive": true/],
    ['md-card', 'event', 'mdDragStart', /"dragEnabled": true/],
    ['md-text-field', 'event', 'mdClear', /"clearable": "internal"/],
    ['md-text-field', 'event', 'mdPasswordToggle', /"passwordToggle": "internal"/],
    ['md-text-field', 'event', 'mdSearch', /"debounce": 250/],
    ['md-line-chart', 'event', 'mdMarkerClick', /"showMarks": true/],
    ['md-line-chart', 'event', 'mdAreaClick', /"area": true/],
    ['md-bar-chart', 'event', 'mdZoom', /"zoom": "both"/],
    ['md-select', 'event', 'mdChange', /"value": "mobile"/],
    ['md-pie-chart', 'event', 'mdSliceClick', /"label": "Android"/],
    ['md-app-bar', 'event', 'mdSearchInput', /"variant": "search"/],
    ['md-side-sheet', 'event', 'mdBack', /"showBack": true/],
    ['md-multi-select', 'event', 'mdClear', /"clearable": true/],
    ['md-table-row', 'event', 'mdRowExpandedChange', /"expandable": true/],
    ['md-table', 'event', 'mdSelectionChange', /"selection": "multiple"/],
    ['md-table', 'event', 'mdPinChange', /await component\.pinColumn\(0, "start"\)/],
    ['md-table', 'event', 'mdColumnVisibilityChange', /await component\.setColumnVisibility\(0, false\)/],
    ['md-progress-indicator', 'event', 'mdComplete', /component\.complete = true;/],
    ['md-select-option', 'event', 'mdSelectOptionChange', /component\.label = "Updated team name";/],
    ['md-table-row', 'method', 'toggle', /Native Compose components use shared design tokens/],
    ['md-select', 'method', 'getLabels', /"label": "Design systems"/],
    ['md-line-chart', 'method', 'setZoom', /"label": "This week"/],
    ['md-table', 'method', 'setSort', /await component\.setSort\("platform", "asc"\)/],
    ['md-list-item', 'method', 'expand', /expanded-content/],
    ['md-stepper', 'method', 'prev', /"active": 1/],
  ];
  for (const [tag, kind, member, expected] of examples) for (const framework of frameworks) {
    const example = apiExample(components.get(tag), kind, member, framework);
    assert.equal(example.status, 'supported', `${tag}.${member}/${framework}`);
    assert.match(example.code, expected, `${tag}.${member}/${framework}`);
  }
  const row = apiExample(components.get('md-table-row'), 'method', 'toggle', 'html').code;
  assert.match(row, /<md-table[^>]*><md-table-body><md-table-row/);
  assert.doesNotMatch(row, /<md-table-head>/, 'selected row is a body row with real expansion controls');
  const dialog = apiExample(components.get('md-dialog'), 'event', 'mdOpen', 'react').code;
  assert.match(dialog, /data-awc-action/);
  assert.match(dialog, /function onRecipeAction/);
});

test('slots project actual child content and native named slots across all web frameworks', () => {
  for (const framework of frameworks) {
    const icon = apiExample(button, 'slot', 'leading-icon', framework);
    assert.match(icon.code, /leading-icon/);
    assert.match(icon.code, /material-symbols-outlined/);
    assert.match(icon.code, /favorite/);
    assert.doesNotMatch(icon.code, /#leading-icon|v-slot|<slot/);
    const content = apiExample(button, 'slot', '', framework);
    assert.match(content.code, /Continue/);
    assert.doesNotMatch(content.code, /slot=""/);
    const tabs = apiExample({ tag: 'md-tabs', slots: [{ name: '' }] }, 'slot', '', framework);
    assert.match(tabs.code, framework === 'react' || framework === 'vue' ? /<MdTab label="Overview"/ : /<md-tab label="Overview"/);
    if (framework !== 'html' && framework !== 'svelte') assert.match(tabs.code, /import \{ MdTabs, MdTab \}/);
  }
  assert.match(apiExample(button, 'slot', 'leading-icon', 'react').code, /style=\{/);
  for (const framework of frameworks) {
    const loader = apiExample({ ...button, slots: [...button.slots, { name: 'loader' }] }, 'slot', 'loader', framework);
    assert.match(loader.code, /md-progress-indicator|MdProgressIndicator/);
    assert.match(loader.code, /loading/);
    assert.match(loader.code, /circular/);
  }
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
    for (const [kind, members] of [['event', component.events || []], ['method', component.methods || []]]) for (const member of members) {
      const html = apiExample(component, kind, member.name, 'html').code;
      const properties = html.match(/Object\.assign\(component, ([\s\S]*?)\);\n/)[1];
      declarations.push(`const properties${index++}: Partial<Components.${name}> = ${properties};`);
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

test('framework compilers accept every populated source event and method example', async () => {
  const directory = new URL('../../node_modules/.pnpm/', import.meta.url);
  const installed = await readdir(directory);
  async function compiler(name, entry) {
    const version = installed.filter(item => item.startsWith(name.replaceAll('/', '+') + '@')).sort().at(-1);
    assert.ok(version, `${name} compiler is installed`);
    const loaded = await import(new URL(`${version}/node_modules/${name}/${entry}`, directory));
    return loaded.default ?? loaded;
  }
  const [angular, vue, svelte] = await Promise.all([
    compiler('@angular/compiler', 'fesm2022/compiler.mjs'),
    compiler('@vue/compiler-sfc', 'dist/compiler-sfc.cjs.js'),
    compiler('svelte', 'compiler/index.js'),
  ]);
  const manifest = JSON.parse(await readFile(new URL('../../packages/core/custom-elements.json', import.meta.url), 'utf8'));
  const components = manifest.modules.flatMap(module => module.declarations || []).filter(item => item.tagName).map(item => mergeComponentDocumentation(item));
  for (const component of components) for (const [kind, members] of [['event', component.events], ['method', component.methods]]) for (const member of members || []) {
    for (const framework of ['react', 'angular', 'vue', 'svelte']) {
      const { code } = apiExample(component, kind, member.name, framework);
      const label = `${component.tag}.${member.name}/${framework}`;
      if (framework === 'react' || framework === 'angular') {
        const file = ts.createSourceFile('Example.' + (framework === 'react' ? 'tsx' : 'ts'), code, ts.ScriptTarget.Latest, true, framework === 'react' ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
        assert.deepEqual(file.parseDiagnostics, [], label);
        if (framework === 'angular') {
          let template;
          function visit(node) { if (ts.isPropertyAssignment(node) && node.name.getText(file) === 'template') template = node.initializer.text; ts.forEachChild(node, visit); }
          visit(file);
          assert.deepEqual(angular.parseTemplate(template, 'Example.html').errors ?? [], [], label);
        }
      } else if (framework === 'vue') {
        const parsed = vue.parse(code, { filename: 'Example.vue' });
        assert.deepEqual(parsed.errors, [], label);
        assert.doesNotThrow(() => vue.compileScript(parsed.descriptor, { id: 'example' }), label);
        assert.deepEqual(vue.compileTemplate({ source: parsed.descriptor.template.content, filename: 'Example.vue', id: 'example' }).errors, [], label);
      } else assert.doesNotThrow(() => svelte.compile(code, { filename: 'Example.svelte', generate: 'client' }), label);
    }
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

test('icon slot examples render real symbols and activate selected content on every Web framework', () => {
  const icon = { tag: 'md-icon-button', slots: [{ name: '' }, { name: 'selected' }] };
  for (const framework of frameworks) for (const name of ['', 'selected']) {
    const example = apiExample(icon, 'slot', name, framework);
    assert.match(example.code, /material-symbols-outlined|materialSymbolsOutlined/);
    assert.match(example.code, /favorite/);
    assert.match(example.code, /aria-label/);
    assert.match(example.code, /--md-icon-button-icon-size/);
    assert.doesNotMatch(example.code, /Custom content|<svg/);
    if (name) {
      assert.match(example.code, /"toggle": true/);
      assert.match(example.code, /"selected": true/);
    }
  }
});

test('icon mdClick explicitly describes committed state and never suggests vetoing the activation', () => {
  const icon = { tag: 'md-icon-button', events: [{ name: 'mdClick', cancelable: true, detail: '{ selected: boolean }' }] };
  for (const framework of frameworks) {
    const example = apiExample(icon, 'event', 'mdClick', framework);
    assert.doesNotMatch(example.code, /preventDefault/);
    assert.match(example.notes.join(' '), /Navigation and toggle occur before/);
  }
});
