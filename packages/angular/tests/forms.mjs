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
const { Injector, PLATFORM_ID, runInInjectionContext } = await import(req.resolve('@angular/core'));
const browserInjector = Injector.create({ providers: [{ provide: PLATFORM_ID, useValue: 'browser' }] });
const serverInjector = Injector.create({ providers: [{ provide: PLATFORM_ID, useValue: 'server' }] });
const createAccessor = (Type, ...args) => runInInjectionContext(browserInjector, () => new Type(...args));
const createServerAccessor = (Type, ...args) => runInInjectionContext(serverInjector, () => new Type(...args));
const out = await mkdtemp(join(tmpdir(), 'awc-angular-forms-'));
try {
  await build({
    entryPoints: [join(root, 'packages/angular/src/directives/radio-value-accessor.ts'), join(root, 'packages/angular/src/directives/multi-select-value-accessor.ts'), join(root, 'packages/angular/src/directives/ssr-value-accessor.ts'), join(root, 'packages/angular/src/directives/boolean-value-accessor.ts'), join(root, 'packages/angular/src/directives/switch-value-accessor.ts'), join(root, 'packages/angular/src/directives/ssr-inputs.ts')],
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
    const accessor = createAccessor(RadioValueAccessor, { nativeElement: el }, registry, { get: () => ({ control }) });
    accessor.ngOnInit();
    accessor.registerOnChange((value) => control.setValue(value, { emitModelToViewChange: false }));
    control.registerOnChange((value) => accessor.writeValue(value));
    control.registerOnDisabledChange((disabled) => accessor.setDisabledState(disabled));
    accessor.writeValue(control.value);
    el.addEventListener('mdChange', (event) => accessor.handleRadioChange(event));
    return { el, accessor, choose() { el.checked = true; el.dispatchEvent(new dom.window.CustomEvent('mdChange', { bubbles: true })); } };
  }
  const staticElement = { value: '', checked: true };
  const staticAccessor = createAccessor(RadioValueAccessor, { nativeElement: staticElement }, registry, { get: () => null });
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
  const multiAccessor = createAccessor(MultiSelectValueAccessor, { nativeElement: multi });
  multiAccessor.writeValue(null);
  assert.deepEqual(multi.value, [], 'multi-select reset preserves the array value contract');
  multiAccessor.writeValue(['b']); assert.deepEqual(multi.value, ['b']);
  // SSR writes must survive HTML serialization; browsers keep property-only writes.
  const { ValueAccessor } = await import(pathToFileURL(join(out, 'ssr-value-accessor.mjs')));
  const { BooleanValueAccessor } = await import(pathToFileURL(join(out, 'boolean-value-accessor.mjs')));
  const { SwitchValueAccessor } = await import(pathToFileURL(join(out, 'switch-value-accessor.mjs')));
  const field = dom.window.document.createElement('md-text-field');
  createAccessor(ValueAccessor, { nativeElement: field }).writeValue('browser');
  assert.equal(field.getAttribute('value'), null, 'client CVAs must not add reflected attributes');
  const serverText = createServerAccessor(ValueAccessor, { nativeElement: field });
  serverText.writeValue('A "quoted" & <value>');
  assert.equal(field.getAttribute('value'), 'A "quoted" & <value>');
  assert.match(field.outerHTML, /&quot;/, 'the DOM serializer escapes attribute payloads');
  serverText.writeValue(null); assert.equal(field.getAttribute('value'), '');
  serverText.setDisabledState(true); assert.equal(field.hasAttribute('disabled'), true);
  serverText.setDisabledState(false); assert.equal(field.hasAttribute('disabled'), false);
  for (const [tag, Type, property] of [['md-checkbox', BooleanValueAccessor, 'checked'], ['md-switch', SwitchValueAccessor, 'selected']]) {
    const element = dom.window.document.createElement(tag);
    const accessor = createServerAccessor(Type, { nativeElement: element });
    accessor.writeValue(true); assert.equal(element.hasAttribute(property), true);
    accessor.writeValue(false); assert.equal(element.hasAttribute(property), false);
    accessor.writeValue(null); assert.equal(element[property], false);
  }
  const multiElement = dom.window.document.createElement('md-multi-select');
  const serverMulti = createServerAccessor(MultiSelectValueAccessor, { nativeElement: multiElement });
  serverMulti.writeValue(['b', 'unknown', 'a']);
  assert.equal(multiElement.getAttribute('data-awc-initial-values'), '["b","unknown","a"]');
  serverMulti.writeValue(null); assert.equal(multiElement.getAttribute('data-awc-initial-values'), '[]');
  assert.equal(multiElement.hasAttribute('value'), false);
  const radioElement = dom.window.document.createElement('md-radio');
  const serverRadio = createServerAccessor(RadioValueAccessor, { nativeElement: radioElement }, registry, { get: () => null });
  serverRadio.value = 'pro'; serverRadio.name = 'plan'; serverRadio.writeValue('pro');
  assert.equal(radioElement.getAttribute('value'), 'pro'); assert.equal(radioElement.getAttribute('name'), 'plan');
  assert.equal(radioElement.hasAttribute('checked'), true);
  serverRadio.writeValue(null); assert.equal(radioElement.hasAttribute('checked'), false);
  assert.equal(radioElement.getAttribute('value'), 'pro', 'reset preserves serialized option identity');
  const { ProxyCmp, initializeSsrInputs, proxyOutputs } = await import(pathToFileURL(join(out, 'ssr-inputs.mjs')));
  let registrations = 0;
  class InputProxy {
    constructor(element) {
      this.el = element;
      this.z = { runOutsideAngular: callback => callback() };
      initializeSsrInputs(this);
    }
  }
  ProxyCmp({
    defineCustomElementFn: () => registrations++,
    inputs: ['label', 'readOnly', 'disabled', 'sheetAriaLabel', 'value', 'options', 'callback'], methods: ['execute'],
    ssrAttributes: { readOnly: 'readonly', sheetAriaLabel: 'aria-label', value: [null, 'values'], options: ['options', 'json'], callback: false },
  })(InputProxy);
  assert.equal(registrations, 1, 'upstream component registration is unchanged');
  const serverElement = dom.window.document.createElement('md-multi-select');
  serverElement.execute = value => `result:${value}`;
  const serverProxy = createServerAccessor(InputProxy, serverElement);
  // All writes happen outside the DI context after construction.
  serverProxy.label = 'Label'; serverProxy.readOnly = false; serverProxy.sheetAriaLabel = 'Details';
  serverProxy.value = ['b', 'a']; serverProxy.options = [{ value: 'a', label: 'A' }]; serverProxy.callback = () => {};
  assert.equal(serverElement.getAttribute('label'), 'Label'); assert.equal(serverElement.getAttribute('readonly'), 'false');
  assert.equal(serverElement.getAttribute('aria-label'), 'Details');
  assert.equal(serverElement.getAttribute('data-awc-initial-values'), '["b","a"]');
  assert.equal(serverElement.getAttribute('options'), '[{"value":"a","label":"A"}]');
  assert.equal(serverElement.hasAttribute('callback'), false, 'property-only inputs never gain derived attributes');
  serverProxy.disabled = true; assert.equal(serverElement.hasAttribute('disabled'), true);
  serverProxy.disabled = false; assert.equal(serverElement.hasAttribute('disabled'), false, 'FACE interprets disabled by presence');
  serverProxy.value = []; assert.equal(serverElement.getAttribute('data-awc-initial-values'), '[]');
  serverProxy.value = null; assert.equal(serverElement.hasAttribute('data-awc-initial-values'), false);
  assert.equal(serverProxy.execute('ok'), 'result:ok', 'upstream method proxy is unchanged');
  const browserElement = dom.window.document.createElement('md-multi-select');
  const browserProxy = createAccessor(InputProxy, browserElement);
  browserProxy.label = 'Client'; browserProxy.value = ['a']; browserProxy.readOnly = true;
  assert.equal(browserElement.getAttributeNames().length, 0, 'browser platform remains property-only even when no global window exists');
  assert.equal(browserProxy.label, 'Client'); assert.deepEqual(browserProxy.value, ['a']);
  proxyOutputs(browserProxy, browserElement, ['mdChange']); let outputCount = 0;
  const subscription = browserProxy.mdChange.subscribe(() => outputCount++);
  browserElement.dispatchEvent(new dom.window.CustomEvent('mdChange')); assert.equal(outputCount, 1);
  subscription.unsubscribe();
  dom.window.close();
  console.log('Angular forms: selection, group isolation, programmatic updates, reset, disabled state and teardown passed.');
} finally { await rm(out, { recursive: true, force: true }); }
