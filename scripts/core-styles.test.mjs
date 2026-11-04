import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import test from 'node:test';
import { coreStyleInputs, coreStylesOutputTarget, generateCoreStyles } from './core-styles.cjs';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const core = path.join(repository, 'packages/core');
const requireCore = createRequire(path.join(core, 'package.json'));
const { JSDOM } = requireCore('jsdom');
const { loadConfig } = requireCore('@stencil/core/compiler');

async function fixture(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'awc-core-styles-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const inputs = coreStyleInputs(directory);
  await fs.mkdir(path.dirname(inputs.tokens), { recursive: true });
  await fs.mkdir(path.dirname(inputs.layout), { recursive: true });
  await fs.mkdir(path.join(inputs.components, 'md-button'), { recursive: true });
  await fs.mkdir(path.join(inputs.components, 'md-card'), { recursive: true });
  await fs.writeFile(inputs.tokens, ':root{--example-color:rebeccapurple}');
  await fs.writeFile(inputs.layout, 'md-card:not(.hydrated){display:block;min-block-size:48px}');
  return { directory, inputs };
}

function compilerRecorder() {
  const files = new Map();
  const watchedFiles = new Set();
  const watchedDirectories = new Set();
  return {
    files, watchedFiles, watchedDirectories,
    context: {
      fs: { writeFile: async (file, css) => files.set(file, css) },
      addWatchFile: file => watchedFiles.add(file),
      addWatchDir: (directory, recursive) => {
        assert.equal(recursive, true);
        watchedDirectories.add(directory);
      },
    },
  };
}

test('the readiness gate covers every declared component and releases only hydrated hosts', async () => {
  const generated = generateCoreStyles(repository);
  const declaredTags = [];
  for (const entry of await fs.readdir(generated.inputs.components, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const directory = path.join(generated.inputs.components, entry.name);
    for (const file of await fs.readdir(directory)) {
      if (!file.endsWith('.tsx')) continue;
      const source = await fs.readFile(path.join(directory, file), 'utf8');
      declaredTags.push(...[...source.matchAll(/@Component\s*\(\s*\{[\s\S]*?\btag\s*:\s*['"]([^'"]+)['"]/g)].map(match => match[1]));
    }
  }
  assert.ok(declaredTags.length > 0);
  assert.deepEqual(generated.tags, declaredTags.sort());

  const dom = new JSDOM(`<style>${generated.css}</style><div id="ordinary">Ordinary content</div>`);
  try {
    const rules = [...dom.window.document.styleSheets[0].cssRules];
    const gate = rules.find(rule => rule.style?.getPropertyValue('opacity') === '0' &&
      rule.style.getPropertyPriority('opacity') === 'important' &&
      rule.style.getPropertyValue('visibility') === 'hidden');
    assert.ok(gate, 'a subtree-paint gate is present');
    assert.equal(gate.style.getPropertyPriority('visibility'), 'important');
    assert.equal(dom.window.document.querySelector('#ordinary').matches(gate.selectorText), false);
    for (const tag of declaredTags) {
      const element = dom.window.document.createElement(tag);
      assert.equal(element.matches(gate.selectorText), true, `${tag} is gated before render`);
      element.classList.add('hydrated');
      assert.equal(element.matches(gate.selectorText), false, `${tag} retains control after render`);
    }
    assert.equal(rules.some(rule => rule.selectorText === '.hydrated'), false,
      'there is no blanket visibility/opacity reset for hydrated or application-hidden content');
  } finally {
    dom.window.close();
  }
});

test('build and watch generations reread tokens, shared layout and newly added components', async t => {
  const { directory, inputs } = await fixture(t);
  const target = coreStylesOutputTarget({ repository: directory });
  const recorder = compilerRecorder();
  const output = path.join(directory, 'dist/md3/md3.css');
  const config = { outputTargets: [{ type: 'dist-global-styles', file: output }] };
  assert.equal(target.taskShouldRun, undefined, 'both ordinary and watch builds use Stencil’s default');

  await target.generator(config, recorder.context);
  const first = recorder.files.get(output);
  assert.match(first, /--example-color:rebeccapurple/);
  assert.match(first, /min-block-size:48px/);
  assert.ok(first.indexOf('--example-color') < first.indexOf('min-block-size'));
  assert.ok(first.indexOf('min-block-size') < first.indexOf('opacity:0!important'));
  assert.deepEqual(recorder.watchedFiles, new Set([inputs.tokens, inputs.layout]));
  assert.deepEqual(recorder.watchedDirectories, new Set([inputs.components]));

  await fs.writeFile(inputs.tokens, ':root{--example-color:tomato}');
  await fs.writeFile(inputs.layout, 'md-card:not(.hydrated){min-block-size:64px}');
  await fs.mkdir(path.join(inputs.components, 'md-new-component'));
  await target.generator({ ...config, watch: true }, recorder.context);
  const next = recorder.files.get(output);
  assert.match(next, /--example-color:tomato/);
  assert.match(next, /min-block-size:64px/);
  assert.match(next, /md-new-component:not\(\.hydrated\)/);
  assert.doesNotMatch(next, /rebeccapurple|min-block-size:48px/);
});

test('an isolated output never writes the normal package stylesheet and duplicate paths write once', async t => {
  const { directory } = await fixture(t);
  const isolated = path.join(directory, 'coverage/custom/www/build/md3.css');
  const recorder = compilerRecorder();
  const target = coreStylesOutputTarget({ repository: directory, additionalFiles: [isolated] });
  await target.generator({
    outputTargets: [
      { type: 'dist-global-styles', file: isolated },
      { type: 'dist-custom-elements', dir: path.join(directory, 'coverage/custom/components') },
    ],
  }, recorder.context);
  assert.deepEqual([...recorder.files.keys()], [isolated]);
  assert.equal(recorder.files.has(path.join(core, 'dist/md3/md3.css')), false);
});

test('missing required layout input fails instead of silently emitting incomplete Core CSS', async t => {
  const { directory, inputs } = await fixture(t);
  await fs.rm(inputs.layout);
  assert.throws(() => generateCoreStyles(directory), /ENOENT.*pre-hydration\.css/);
});

test('real build configurations deliver identical Core CSS to their declared destinations', async t => {
  const runs = [
    ['stencil.config.ts', ['dist/md3/md3.css', 'www/build/md3.css']],
    ['stencil.config.dev.ts', ['dist/md3/md3.css']],
    ['stencil.config.csr.ts', ['dist/md3/md3.css']],
    ['stencil.config.coverage.ts', ['dist/md3/md3.css', 'www/build/md3.css']],
    ['stencil.config.coverage-sb.ts', ['dist/md3/md3.css']],
  ];
  const expectedCss = generateCoreStyles(repository).css;
  for (const [name, destinations] of runs) {
    await t.test(name, async () => {
      const { config, diagnostics } = await loadConfig({ configPath: path.join(core, name) });
      assert.deepEqual(diagnostics.filter(item => item.level === 'error'), []);
      assert.equal(config.globalStyle, undefined, 'tokens remain external rather than bundled into JS');
      assert.equal(config.invisiblePrehydration, false, 'no inline runtime pre-hydration styles');
      const targets = config.outputTargets.filter(target => target.name === 'awc-core-styles');
      assert.equal(targets.length, 1);
      const recorder = compilerRecorder();
      await targets[0].generator(config, recorder.context);
      assert.deepEqual([...recorder.files.keys()].sort(), destinations.map(file => path.join(core, file)).sort());
      assert.ok([...recorder.files.values()].every(css => css === expectedCss));
      assert.equal(config.outputTargets.some(target => target.copy?.some(copy =>
        /tokens[/\\]src[/\\]tokens\.css$/.test(copy.src))), false, 'no competing raw-token copy');
      await config.sys.destroy();
    });
  }
});

test('the copied coverage configuration emits only inside the run directory', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'awc-isolated-styles-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const destination = path.join(directory, 'stencil.config.ts');
  await fs.copyFile(path.join(repository, 'apps/native-playground/scripts/coverage/stencil.config.ts'), destination);
  const previousRepo = process.env.AWC_COVERAGE_REPO;
  const previousOutput = process.env.AWC_COVERAGE_E2E_OUTPUT;
  process.env.AWC_COVERAGE_REPO = repository;
  process.env.AWC_COVERAGE_E2E_OUTPUT = directory;
  try {
    const { config, diagnostics } = await loadConfig({ configPath: destination });
    assert.deepEqual(diagnostics.filter(item => item.level === 'error'), []);
    const target = config.outputTargets.find(output => output.name === 'awc-core-styles');
    assert.ok(target);
    const recorder = compilerRecorder();
    await target.generator(config, recorder.context);
    assert.deepEqual([...recorder.files.keys()], [path.join(directory, 'www/build/md3.css')]);
    assert.equal(recorder.files.values().next().value, generateCoreStyles(repository).css);
    await config.sys.destroy();
  } finally {
    if (previousRepo === undefined) delete process.env.AWC_COVERAGE_REPO;
    else process.env.AWC_COVERAGE_REPO = previousRepo;
    if (previousOutput === undefined) delete process.env.AWC_COVERAGE_E2E_OUTPUT;
    else process.env.AWC_COVERAGE_E2E_OUTPUT = previousOutput;
  }
});
