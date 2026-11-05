import test from 'node:test';
import assert from 'node:assert/strict';
import { nativeEventMetadata } from './native-event-metadata.mjs';

test('native metadata retains canceled actions, stable paths and activation identity without changing source detail', () => {
  const event = { defaultPrevented: true, propagationPath: ['button', 'panel', 'root'], activation: { id: 'activation-1', kind: 'nativeControl' }, detail: { selected: true } };
  assert.deepEqual(nativeEventMetadata(event), { defaultPrevented: true, propagationPath: ['button', 'panel', 'root'], activation: { id: 'activation-1', kind: 'nativeControl' } });
  assert.deepEqual(nativeEventMetadata({ detail: null }), {});
  assert.deepEqual(nativeEventMetadata({ defaultPrevented: false }), { defaultPrevented: false });
});

test('native metadata rejects malformed and oversized host values', () => {
  for (const event of [{ defaultPrevented: 'false' }, { propagationPath: 'root' }, { propagationPath: Array(65).fill('root') }, { propagationPath: [1] }, { propagationPath: ['x'.repeat(257)] }, { activation: null }, { activation: { id: '', kind: 'nativeControl' } }, { activation: { id: '1', kind: 'trustedBrowserClick' } }]) {
    assert.throws(() => nativeEventMetadata(event), error => error.code === 'INVALID_LIVE_FRAME');
  }
});

test('native input sources survive transport without inventing browser originalEvent data', () => {
  for (const source of ['pointer', 'keyboard', 'accessibility', 'unknown']) {
    const activation = { id: 'input-1', kind: 'nativeControl', source };
    assert.deepEqual(nativeEventMetadata({ activation }), { activation });
    assert.deepEqual(nativeEventMetadata({ activation: { source } }), { activation: { source } });
  }
  const pointer = { source: 'pointer', x: 12.5, y: 24 };
  assert.deepEqual(nativeEventMetadata({ activation: pointer }), { activation: pointer });
  for (const activation of [{}, { source: 'pointer', x: NaN }, { source: 'pointer', y: 16385 }]) {
    assert.throws(() => nativeEventMetadata({ activation }), error => error.code === 'INVALID_LIVE_FRAME');
  }
  for (const source of [null, true, 'MouseEvent', { type: 'click' }]) {
    assert.throws(() => nativeEventMetadata({ activation: { id: 'input-1', kind: 'nativeControl', source } }), error => error.code === 'INVALID_LIVE_FRAME');
  }
});
