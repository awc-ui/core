import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { Session } from 'node:inspector/promises';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { test } from 'node:test';
import ts from 'typescript';
import { parseLCOV } from './coverage-reports.mjs';

const require = createRequire(import.meta.url);
const { completeSourceCoverage } = require('./scripts/coverage/complete-source-coverage.cjs');
const { CoverageReport } = createRequire(new URL('../../packages/core/package.json', import.meta.url))('monocart-coverage-reports');
const tags = ['md-button', 'md-chip'];

async function fixture(t) {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'awc-compiled-coverage-')));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const runtime = path.join(root, 'runtime'); await fs.mkdir(runtime);
  for (const tag of tags) {
    const original = path.join(root, `packages/core/src/components/${tag}/${tag}.tsx`);
    const source = `export function calculate(value: number): number {\n  if (value > 0) return value + 1;\n  return 0;\n}\n`;
    await fs.mkdir(path.dirname(original), { recursive: true }); await fs.writeFile(original, source);
    const compiled = ts.transpileModule(source, { fileName: original, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, sourceMap: true, inlineSources: true } });
    const map = JSON.parse(compiled.sourceMapText); map.sources = [original]; map.sourcesContent = [source];
    await fs.writeFile(path.join(runtime, `${tag}.entry.js`), compiled.outputText);
    await fs.writeFile(path.join(runtime, `${tag}.entry.js.map`), JSON.stringify(map));
  }
  return { root, runtime };
}

test('Monocart adds verified unexecuted compiled sources with nonzero denominators without replacing real V8 hits', async t => {
  const { root, runtime } = await fixture(t);
  // Components such as Loading Indicator can live in a non-entry shared chunk.
  await fs.rename(path.join(runtime, 'md-chip.entry.js'), path.join(runtime, 'md-chip-shared.js'));
  await fs.rename(path.join(runtime, 'md-chip.entry.js.map'), path.join(runtime, 'md-chip-shared.js.map'));
  const options = completeSourceCoverage({ repository: root, runtime, tags });
  const file = path.join(runtime, 'md-button.entry.js'), url = pathToFileURL(file).href, source = await fs.readFile(file, 'utf8');
  const inspector = new Session(); inspector.connect();
  let captured;
  try {
    await inspector.post('Profiler.enable');
    await inspector.post('Profiler.startPreciseCoverage', { callCount: true, detailed: true });
    const context = { exports: {} }; vm.runInNewContext(source, context, { filename: url });
    assert.equal(context.exports.calculate(2), 3);
    captured = (await inspector.post('Profiler.takePreciseCoverage')).result.find(entry => entry.url === url);
    await inspector.post('Profiler.stopPreciseCoverage');
  } finally { inspector.disconnect(); }
  assert.ok(captured, 'Real V8 function ranges were captured from executing compiled JavaScript');
  const entry = { ...captured, source }; options.all.transformer(entry);
  const baseline = new CoverageReport({ baseDir: root, sourceFilter: options.sourceFilter, outputDir: path.join(root, 'baseline'), reports: ['lcovonly'], logging: 'off' });
  await baseline.add([structuredClone(entry)]); await baseline.generate();
  const baselineCoverage = parseLCOV(await fs.readFile(path.join(root, 'baseline/lcov.info'), 'utf8'), new Set(tags));
  const observedEntries = [];
  const complete = completeSourceCoverage({ repository: root, runtime, tags, observedEntries });
  observedEntries.push(structuredClone(entry));
  const report = new CoverageReport({ ...complete, outputDir: path.join(root, 'report'), reports: ['lcovonly'], logging: 'off' });
  await report.add([entry]); await report.generate();
  const lcov = await fs.readFile(path.join(root, 'report/lcov.info'), 'utf8');
  const coverage = parseLCOV(lcov, new Set(tags));
  assert.equal(coverage.size, 2);
  const button = coverage.get('md-button'), chip = coverage.get('md-chip');
  assert.ok(button.lines.covered > 0, 'Adding an empty entry must preserve observed hits');
  assert.ok(button.functions.covered > 0);
  assert.deepEqual(button, baselineCoverage.get('md-button'), 'Every measured source metric remains exactly unchanged when adding unobserved files');
  assert.ok(chip.lines.total > 0, 'Unexecuted source has a compiled executable denominator');
  assert.ok(chip.functions.total > 0); assert.ok(chip.branches.total > 0);
  assert.equal(chip.lines.covered, 0); assert.equal(chip.lines.percent, 0);
  assert.equal(chip.functions.covered, 0); assert.equal(chip.branches.covered, 0);
  assert.doesNotMatch(lcov, /^SF:.*\.entry\.js$/m, 'Generated entry files do not become component sources');
});

test('compiled denominator rejects stale or missing mapped components and excludes unselected components', async t => {
  const { root, runtime } = await fixture(t);
  const selected = completeSourceCoverage({ repository: root, runtime, tags: ['md-button'] });
  assert.equal(selected.all.filter(path.join(runtime, 'md-button.entry.js')), true);
  assert.equal(selected.all.filter(path.join(runtime, 'md-chip.entry.js')), false);
  assert.equal(selected.sourceFilter('packages/core/src/components/md-chip/md-chip.tsx'), false);
  assert.throws(() => completeSourceCoverage({ repository: root, runtime, tags: ['md-switch'] }), /No verified compiled/);
  await fs.appendFile(path.join(root, 'packages/core/src/components/md-button/md-button.tsx'), '\n// source changed\n');
  assert.throws(() => completeSourceCoverage({ repository: root, runtime, tags }), /Stale or missing component source map/);
});

test('compiled denominator detects runtime replacement before conversion', async t => {
  const { root, runtime } = await fixture(t);
  const options = completeSourceCoverage({ repository: root, runtime, tags });
  assert.throws(() => options.all.transformer({ url: pathToFileURL(path.join(runtime, 'md-button.entry.js')).href, source: 'changed' }), /runtime changed/);
});
