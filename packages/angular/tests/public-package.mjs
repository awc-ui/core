// Requires a built @awc-ui/angular. Resolve the packed public API in a fresh consumer.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readdir, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const library = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
const core = createRequire(new URL('../../core/package.json', import.meta.url));
const { build } = core('esbuild');
const ts = require('typescript');
const scratch = await mkdtemp(join(tmpdir(), 'awc-angular-consumer-'));

try {
  execFileSync('pnpm', ['pack', '--pack-destination', scratch], { cwd: library });
  const archive = (await readdir(scratch)).find(name => name.endsWith('.tgz'));
  assert(archive, 'Expected an Angular package tarball');
  const installed = join(scratch, 'node_modules/@awc-ui/angular');
  await mkdir(installed, { recursive: true });
  execFileSync('tar', ['-xzf', join(scratch, archive), '--strip-components=1', '-C', installed]);

  // Supply the consumer's peers from the local install without a registry fetch.
  for (const dependency of [
    '@angular/common', '@angular/compiler', '@angular/core', '@angular/forms',
    '@awc-ui/core', 'rxjs', 'tslib',
  ]) {
    const link = join(scratch, 'node_modules', dependency);
    await mkdir(dirname(link), { recursive: true });
    await symlink(await realpath(join(library, 'node_modules', dependency)), link, 'dir');
  }

  const consumer = join(scratch, 'consumer.mts');
  await writeFile(consumer, `
    import * as primary from '@awc-ui/angular';
    import * as forms from '@awc-ui/angular/forms';
    import type { ControlValueAccessor } from '@angular/forms';

    const sharedTypes: typeof forms = primary;
    const accessors: ControlValueAccessor[] = [
      forms.BooleanValueAccessor.prototype,
      forms.MultiSelectValueAccessor.prototype,
      forms.NumericValueAccessor.prototype,
      forms.RadioValueAccessor.prototype,
      forms.SelectValueAccessor.prototype,
      forms.SwitchValueAccessor.prototype,
      forms.TextValueAccessor.prototype,
    ];
    // @ts-expect-error The forms entry exposes accessors only.
    forms.AwcUiModule;
  `);
  for (const [module, moduleResolution] of [
    [ts.ModuleKind.ESNext, ts.ModuleResolutionKind.Bundler],
    [ts.ModuleKind.NodeNext, ts.ModuleResolutionKind.NodeNext],
    [ts.ModuleKind.ESNext, ts.ModuleResolutionKind.Node10],
  ]) {
    const program = ts.createProgram([consumer], {
      target: ts.ScriptTarget.ES2022, module, moduleResolution,
      strict: true, noEmit: true, types: [],
    });
    const name = ts.ModuleResolutionKind[moduleResolution];
    const diagnostics = ts.getPreEmitDiagnostics(program);
    assert.equal(diagnostics.length, 0, `${name}\n${ts.formatDiagnostics(diagnostics, {
      getCanonicalFileName: file => file,
      getCurrentDirectory: () => scratch,
      getNewLine: () => '\n',
    })}`);
  }

  const formsGraph = await build({
    stdin: { contents: 'export * from "@awc-ui/angular/forms";', resolveDir: scratch },
    bundle: true, format: 'esm', metafile: true, write: false,
    external: ['@angular/*', '@awc-ui/core', 'tslib'],
  });
  assert(
    Object.values(formsGraph.metafile.inputs).every(({ imports }) =>
      imports.every(({ path }) => !/^@awc-ui\/core(?:\/|$)/.test(path)),
    ),
    'The public Angular forms entry must be independent of Core',
  );

  const resolveConsumer = createRequire(consumer).resolve;
  const importConsumer = name => import(pathToFileURL(resolveConsumer(name)).href);
  await importConsumer('@angular/compiler');
  const forms = await importConsumer('@awc-ui/angular/forms');
  const primary = await importConsumer('@awc-ui/angular');
  const accessors = [
    forms.TextValueAccessor,
    forms.SelectValueAccessor,
    forms.MultiSelectValueAccessor,
    forms.BooleanValueAccessor,
    forms.RadioValueAccessor,
    forms.NumericValueAccessor,
    forms.SwitchValueAccessor,
  ];
  for (const accessor of [forms.ValueAccessor, ...accessors]) {
    assert.equal(typeof accessor, 'function');
    assert.equal(primary[accessor.name], accessor, `${accessor.name} must be shared by both entries`);
  }
  assert.deepEqual(primary.VALUE_ACCESSORS, accessors);
  console.log('Angular package: Bundler, NodeNext and Node10 types, forms isolation and shared directives verified.');
} finally {
  await rm(scratch, { recursive: true, force: true });
}
