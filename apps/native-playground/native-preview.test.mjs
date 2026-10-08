import test from 'node:test';
import assert from 'node:assert/strict';
import { createLatestRequest, nativeRenderRequest } from './contracts.js';

test('native render payload preserves typed union values and snapshots editable objects', () => {
  const properties = { clearable: false, passwordToggle: true, density: -1, value: 'false', options: [{ value: 0, disabled: false }], unset: undefined };
  const request = nativeRenderRequest('md-text-field', properties, true);
  assert.deepEqual(request, { tag: 'md-text-field', properties: { clearable: false, passwordToggle: true, density: -1, value: 'false', options: [{ value: 0, disabled: false }] }, dark: true, width: 640 });
  properties.clearable = 'internal';
  properties.options[0].disabled = true;
  assert.equal(request.properties.clearable, false);
  assert.equal(request.properties.options[0].disabled, false);
  assert.equal(nativeRenderRequest('md-chip', {}, false).dark, false);
});

test('new render aborts fetch and rejects callbacks already queued by an old render', async () => {
  const requests = createLatestRequest();
  const old = requests.start();
  const accepted = [];
  const delayedCallback = Promise.resolve().then(() => { if (old.isCurrent()) accepted.push('old component'); });
  const current = requests.start();
  await delayedCallback;
  assert.equal(old.signal.aborted, true);
  assert.equal(old.isCurrent(), false);
  assert.equal(current.signal.aborted, false);
  if (current.isCurrent()) accepted.push('current component');
  assert.deepEqual(accepted, ['current component']);
});

test('leaving native preview invalidates a pending image callback without a replacement request', () => {
  const requests = createLatestRequest();
  const current = requests.start();
  requests.cancel();
  assert.equal(current.isCurrent(), false);
  assert.equal(current.signal.aborted, true);
  requests.cancel();
  const returned = requests.start();
  assert.equal(returned.isCurrent(), true);
  assert.equal(current.isCurrent(), false);
});
