import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const dependencies = process.env.AWC_DEPENDENCY_ROOT || root;
const req = createRequire(join(dependencies, 'packages/angular/package.json'));
const coreReq = createRequire(join(dependencies, 'packages/core/package.json'));
const { build } = coreReq('esbuild');
const { JSDOM } = coreReq('jsdom');
await import(req.resolve('@angular/compiler'));
const { FormControl, FormGroup } = await import(req.resolve('@angular/forms'));
const out = await mkdtemp(join(tmpdir(), 'awc-angular-forms-'));
try {
  await build({
    entryPoints: [join(root, 'packages/angular/src/directives/radio-value-accessor.ts'), join(root, 'packages/angular/src/directives/multi-select-value-accessor.ts')],
    outdir: out, bundle: true, format: 'esm', platform: 'node', outExtension: { '.js': '.mjs' },
    tsconfigRaw: { compilerOptions: { experimentalDecorators: true } },
    plugins: [{ name: 'existing-workspace-dependencies', setup(b) {
      b.onResolve({ filter: /^@angular\// }, (args) => ({ path: req.resolve(args.path), external: true }));
      b.onResolve({ filter: /^\./ }, (args) => {
        // Allows the read-only staging harness; ordinary repository tests resolve locally.
        const candidate = resolve(args.resolveDir, args.path + '.ts');
        if (!existsSync(candidate) && candidate.startsWith(root)) {
          const original = candidate.replace(root, dependencies + '/');
          if (existsSync(original)) return { path: original };
        }
      });
    } }],
  });
  const { RadioValueAccessor, RadioValueAccessorRegistry } = await import(pathToFileURL(join(out, 'radio-value-accessor.mjs')));
  const { MultiSelectValueAccessor } = await import(pathToFileURL(join(out, 'multi-select-value-accessor.mjs')));
  const dom = new JSDOM('<form id="one"></form><form id="two"></form>');
  const registry = new RadioValueAccessorRegistry();
  const plan = new FormControl('pro');
  function radio(value, control = plan, form = 'one', name = 'plan') {
    const el = dom.window.document.createElement('md-radio');
    Object.assign(el, { value, checked: false, disabled: false, name });
    dom.window.document.getElementById(form).append(el);
    const accessor = new RadioValueAccessor({ nativeElement: el }, registry, { get: () => ({ control }) });
    accessor.ngOnInit();
    accessor.registerOnChange((value) => control.setValue(value, { emitModelToViewChange: false }));
    control.registerOnChange((value) => accessor.writeValue(value));
    control.registerOnDisabledChange((disabled) => accessor.setDisabledState(disabled));
    accessor.writeValue(control.value);
    el.addEventListener('mdChange', (event) => accessor.handleRadioChange(event));
    return { el, accessor, choose() { el.checked = true; el.dispatchEvent(new dom.window.CustomEvent('mdChange', { bubbles: true })); } };
  }
  const staticElement = { value: '', checked: true };
  const staticAccessor = new RadioValueAccessor({ nativeElement: staticElement }, registry, { get: () => null });
  staticAccessor.value = 'static'; staticAccessor.ngOnInit();
  assert.equal(staticElement.checked, true, 'an unbound radio preserves an explicit checked state');
  const basic = radio('basic'), pro = radio('pro');
  assert.deepEqual([basic.el.checked, pro.el.checked], [false, true], 'initial model selects the matching option');
  assert.deepEqual([basic.el.value, pro.el.value], ['basic', 'pro'], 'option identities survive writeValue');
  basic.choose();
  assert.equal(plan.value, 'basic', 'user change propagates the option value');
  assert.deepEqual([basic.el.checked, pro.el.checked], [true, false], 'shared control remains exclusive');
  pro.choose();
  assert.equal(plan.value, 'pro', 'switching back to a previously selected option propagates');
  basic.choose();
  plan.setValue('pro');
  assert.deepEqual([basic.el.checked, pro.el.checked], [false, true], 'programmatic updates select the other radio');
  plan.reset();
  assert.deepEqual([basic.el.checked, pro.el.checked], [false, false], 'reset clears selection without clearing option values');
  assert.deepEqual([basic.el.value, pro.el.value], ['basic', 'pro']);
  plan.disable(); basic.choose(); assert.equal(plan.value, null, 'disabled radio cannot write the model');
  plan.enable();
  // Separate NgModel controls with the same name are coordinated by their parent.
  const group = new FormGroup({ a: new FormControl('pro'), b: new FormControl('pro') });
  const a = radio('basic', group.controls.a), b = radio('pro', group.controls.b);
  const isolated = radio('pro', new FormControl('pro'), 'two');
  a.choose();
  assert.equal(b.el.checked, false, 'named controls sharing a form parent are exclusive');
  assert.equal(isolated.el.checked, true, 'same name in a different form remains selected');
  b.accessor.ngOnDestroy(); b.el.checked = true; a.choose();
  assert.equal(b.el.checked, true, 'destroyed accessors are removed from coordination');
  const multi = { value: ['a'] };
  const multiAccessor = new MultiSelectValueAccessor({ nativeElement: multi });
  multiAccessor.writeValue(null);
  assert.deepEqual(multi.value, [], 'multi-select reset preserves the array value contract');
  multiAccessor.writeValue(['b']); assert.deepEqual(multi.value, ['b']);
  dom.window.close();
  console.log('Angular forms: selection, group isolation, programmatic updates, reset, disabled state and teardown passed.');
} finally { await rm(out, { recursive: true, force: true }); }
