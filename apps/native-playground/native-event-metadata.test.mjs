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
