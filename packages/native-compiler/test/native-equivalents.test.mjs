import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { compile } from '../src/compiler.mjs';

const source = `import {Component,Prop,Event,EventEmitter} from '@stencil/core';
@Component({tag:'md-fixture',shadow:true,styleUrl:'md-fixture.css'}) export class Fixture {
 @Prop() disabled:boolean=false;
 @Event() mdClick:EventEmitter<void>;
 internals:ElementInternals;
 connectedCallback(){new MutationObserver(()=>{});this.el.querySelector('button');this.el.shadowRoot;this.el.getBoundingClientRect();}
 render(){return <button disabled={this.disabled}><slot /></button>}
}`;
const policyPaths = { ios: 'packages/native-ios/NativeSupport.json', android: 'packages/native-android/support.json' };
const entry = { properties: ['disabled'], events: ['mdClick'], methods: [], slots: [''], notes: ['Adapter coverage is a declaration.'] };
const replacement = (changes = {}) => ({ status: 'implemented', api: 'NativeFixtureAPI', description: 'An explicit native behavior adapter.', limitations: [], ...changes });

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'awc-native-equivalents-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  async function put(file, value) {
    const location = join(root, file);
    await mkdir(dirname(location), { recursive: true });
    await writeFile(location, typeof value === 'string' ? value : JSON.stringify(value));
  }
  const policy = (platform, value = entry) => put(policyPaths[platform], { components: { 'md-fixture': value } });
  await Promise.all([
    put('packages/core/custom-elements.json', { modules: [{ declarations: [{ tagName: 'md-fixture', customElement: true, slots: [{ name: '' }] }] }] }),
    put('packages/core/src/components/md-fixture/md-fixture.tsx', source),
    put('packages/core/src/components/md-fixture/md-fixture.css', ':host { display:inline-block; }'),
    put('apps/docs/src/data/components/fixture.json', { title: 'Fixture', category: 'Actions' }),
    put('packages/tokens/src/tokens.css', ':root { --md-sys-color-primary:#6750A4; }'),
    policy('ios'), policy('android'),
  ]);
  return { root, policy };
}

test('native equivalents reach catalog and IR without removing diagnostics or asserting strict source parity', async t => {
  const { root, policy } = await fixture(t);
  const before = await compile({ root, write: false, strict: true });
  assert.equal(before.incomplete.length, 0, 'Fixture has complete API coverage so diagnostics alone must keep strict failing');
  const raw = before.components[0].diagnostics;
  assert.equal(raw.length, 6);
  const ios = Object.fromEntries(raw.map(diagnostic => [diagnostic.code, replacement({ api: `Swift.${diagnostic.code}` })]));
  const android = { HTML_FORM: replacement({ status: 'partial', api: 'Compose.FormState', limitations: ['Requires a native form owner.'] }) };
  await policy('ios', { ...entry, nativeEquivalents: ios });
  await policy('android', { ...entry, nativeEquivalents: android });
  const after = await compile({ root, write: false, strict: true });
  const ir = JSON.parse(after.outputs.get('packages/native-compiler/generated/ir/md-fixture.json'));
  for (const component of [after.components[0], after.catalog.components[0], ir]) {
    assert.deepEqual(component.support.ios.nativeEquivalents, ios);
    assert.deepEqual(component.support.android.nativeEquivalents, android);
    assert.deepEqual(component.diagnostics, raw, 'Source diagnostic messages, lines and severities remain intact');
    for (const platform of ['ios', 'android']) {
      const { nativeEquivalents, ...support } = component.support[platform];
      assert.deepEqual(support, before.components[0].support[platform]);
    }
  }
  assert.equal(after.ok, false);
  assert.equal(after.incomplete.length, 0);
  assert.deepEqual(after.catalog.summary, before.catalog.summary);
  assert.equal(after.catalog.summary.sourceParityVerified, false);
  assert.deepEqual(after.catalog.verification, before.catalog.verification);
  for (const [file, content] of before.outputs) {
    if (!file.endsWith('catalog.json') && !file.includes('/ir/')) assert.equal(after.outputs.get(file), content, file);
  }
});

test('absent native-equivalent metadata stays omitted and platform policies remain independent', async t => {
  const { root, policy } = await fixture(t);
  let result = await compile({ root, write: false });
  for (const platform of ['ios', 'android']) assert.equal(Object.hasOwn(result.catalog.components[0].support[platform], 'nativeEquivalents'), false);
  await policy('android', { ...entry, nativeEquivalents: {} });
  result = await compile({ root, write: false });
  assert.equal(Object.hasOwn(result.components[0].support.ios, 'nativeEquivalents'), false);
  assert.deepEqual(result.components[0].support.android.nativeEquivalents, {});
  assert.deepEqual(JSON.parse(result.outputs.get(result.components[0].irPath)).support, result.catalog.components[0].support);
});

test('malformed or stale equivalent metadata fails compilation with policy and component context', async t => {
  const { root, policy } = await fixture(t);
  const valid = replacement();
  const malformed = [
    null, [], 'implemented',
    { UNKNOWN_DIAGNOSTIC: valid }, { DOM_GLOBAL: valid },
    { HTML_FORM: null }, { HTML_FORM: [] },
    { HTML_FORM: { ...valid, status: 'verified' } },
    { HTML_FORM: { ...valid, status: 'partial' } },
    { HTML_FORM: { ...valid, api: '' } }, { HTML_FORM: { ...valid, api: '  ' } }, { HTML_FORM: { ...valid, api: 123 } },
    { HTML_FORM: { ...valid, description: '\n' } }, { HTML_FORM: { ...valid, description: null } },
    { HTML_FORM: { ...valid, limitations: 'none' } }, { HTML_FORM: { ...valid, limitations: [null] } }, { HTML_FORM: { ...valid, limitations: [' '] } },
    { HTML_FORM: { ...valid, limitations: undefined } },
    { HTML_FORM: { ...valid, sourceParityVerified: true } },
  ];
  for (const nativeEquivalents of malformed) {
    await policy('ios', { ...entry, nativeEquivalents });
    await assert.rejects(compile({ root, write: false }), error => {
      assert.match(error.message, /packages\/native-ios\/NativeSupport\.json: md-fixture\.nativeEquivalents/);
      return true;
    }, JSON.stringify(nativeEquivalents));
  }
  await policy('ios');
  await policy('android', { ...entry, nativeEquivalents: { HTML_FORM: { ...valid, status: 'complete' } } });
  await assert.rejects(compile({ root, write: false }), /packages\/native-android\/support\.json: md-fixture\.nativeEquivalents\.HTML_FORM\.status/);
});
