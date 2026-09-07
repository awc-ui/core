import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { supportsNode } from '../check-environment.mjs';
import { createComponent, componentFiles } from '../create-component.mjs';
import { classifyChange } from '../dev-docs.mjs';
import { verifyBuildGraph } from '../verify-contributor.mjs';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const withRoot = fn => {
  const root = mkdtempSync(join(tmpdir(), 'awc-scaffold-'));
  try { return fn(root); } finally { rmSync(root, { recursive: true, force: true }); }
};

test('contributor Node boundary matches supported dependency engines', () => {
  for (const version of ['18.20.0', '20.19.0', '22.12.0', '23.0.0', 'invalid']) assert.equal(supportsNode(version), false, version);
  for (const version of ['22.13.0', '22.99.0', '24.0.0', '25.0.0', 'v22.13.0']) assert.equal(supportsNode(version), true, version);
});

test('generator rejects invalid names and path traversal', () => {
  for (const tag of ['button', '../md-button', 'md-../button', 'md-', 'md-Button', 'md-foo/bar', 'md-foo--bar']) {
    assert.throws(() => componentFiles(tag), /lowercase custom-element/);
  }
});

test('dry run is read-only; creation emits all six parseable files', () => withRoot(root => {
  const names = createComponent('md-test-action', { root, dryRun: true });
  assert.equal(names.length, 6);
  assert.equal(existsSync(join(root, 'packages')), false);
  assert.deepEqual(createComponent('md-test-action', { root }), names);
  for (const name of names) {
    const source = readFileSync(join(root, name), 'utf8');
    assert.ok(source.length > 0);
    if (/\.tsx?$/.test(name)) {
      const result = ts.transpileModule(source, {
        fileName: name, reportDiagnostics: true,
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.Preserve, experimentalDecorators: true },
      });
      assert.deepEqual(result.diagnostics.filter(item => item.category === ts.DiagnosticCategory.Error), [], name);
    }
  }
}));

test('a collision on the last file prevents partial creation and preserves content', () => withRoot(root => {
  const story = join(root, 'apps/storybook/src/stories/MdTestAction.stories.ts');
  mkdirSync(dirname(story), { recursive: true });
  writeFileSync(story, 'existing user story');
  assert.throws(() => createComponent('md-test-action', { root }), /Refusing to overwrite/);
  assert.equal(existsSync(join(root, 'packages')), false);
  assert.equal(readFileSync(story, 'utf8'), 'existing user story');
}));

test('action scaffold delegates semantics to a disabled-aware native button', () => {
  const text = componentFiles('md-test-action').get('packages/core/src/components/md-test-action/md-test-action.tsx');
  const source = ts.createSourceFile('component.tsx', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const buttons = [];
  const visit = node => {
    if (ts.isJsxOpeningElement(node) && node.tagName.getText(source) === 'button') buttons.push(node);
    ts.forEachChild(node, visit);
  };
  visit(source);
  assert.equal(buttons.length, 1, 'Use one native button for built-in Enter/Space and focus behavior');
  const attributes = new Map(buttons[0].attributes.properties.filter(ts.isJsxAttribute).map(node => [node.name.getText(source), node.initializer?.getText(source)]));
  assert.equal(attributes.get('type'), '"button"', 'The scaffold must not unexpectedly submit a surrounding form');
  assert.equal(attributes.get('disabled'), '{this.disabled}');
  assert.equal(attributes.get('onClick'), '{this.handleClick}');
});

test('docs watcher includes editable inputs and excludes generated output to prevent loops', () => {
  assert.equal(classifyChange('packages/core/src/components/md-card/md-card.tsx'), 'core');
  assert.equal(classifyChange('packages/core/src/components/md-card/readme.md'), 'core');
  assert.equal(classifyChange('packages/theme/src/index.ts'), 'theme');
  assert.equal(classifyChange('apps/storybook/src/stories/MdCard.stories.ts'), 'docs');
  assert.equal(classifyChange('scripts/generate-docs.mjs'), 'core');
  assert.equal(classifyChange('packages\\core\\src\\utils\\form.ts'), 'core');
  for (const output of ['packages/core/dist/components/md-card.js', 'packages/theme/dist/index.mjs', 'apps/docs/src/content/docs/components/card.mdx', 'scripts/tests/contributor-tooling.test.mjs']) {
    assert.equal(classifyChange(output), null, output);
  }
});

test('graph verification rejects lost SSR output and missing theme prerequisites', () => {
  const graph = { tasks: [
    { taskId: '@awc-ui/core#build', outputs: ['dist/**', 'hydrate/**'] },
    { taskId: '@awc-ui/storybook#build', command: 'storybook build', outputs: ['storybook-static/**'], dependencies: ['@awc-ui/core#build', '@awc-ui/theme#build'] },
    { taskId: '@awc-ui/docs#build', dependencies: ['@awc-ui/core#build', '@awc-ui/theme#build', '@awc-ui/docs#generate-data'] },
  ] };
  assert.doesNotThrow(() => verifyBuildGraph(graph));
  const noHydrate = structuredClone(graph);
  noHydrate.tasks[0].outputs = ['dist/**'];
  assert.throws(() => verifyBuildGraph(noHydrate), /hydrate/);
  const noTheme = structuredClone(graph);
  noTheme.tasks[2].dependencies = ['@awc-ui/core#build', '@awc-ui/docs#generate-data'];
  assert.throws(() => verifyBuildGraph(noTheme), /theme/);
  const duplicate = structuredClone(graph);
  duplicate.tasks[1].command = 'pnpm --filter @awc-ui/core build && storybook build';
  assert.throws(() => verifyBuildGraph(duplicate), /must not rebuild/);
});
