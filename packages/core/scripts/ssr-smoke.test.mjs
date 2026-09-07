import assert from 'node:assert/strict';
import test from 'node:test';
import { assertSsrResult } from './lib/ssr-validation.mjs';

test('missing DSD fails even when rendering succeeds without diagnostics', () => {
  assert.throws(() => assertSsrResult('md-card', { html: '<md-card></md-card>', diagnostics: [] }, true), /shadow root/);
});
test('a nested component template cannot mask the missing host root', () => {
  assert.throws(() => assertSsrResult('md-card', { html: '<md-card><md-button><template shadowrootmode="open"></template></md-button></md-card>' }, true), /shadow root/);
});
test('shadow expectations distinguish valid shadow and non-shadow components', () => {
  assertSsrResult('md-card', { html: '<md-card s-id="1"><template shadowrootmode="open"></template></md-card>' }, true);
  assertSsrResult('md-light', { html: '<md-light></md-light>' }, false);
});
test('render diagnostics and a missing host still fail', () => {
  assert.throws(() => assertSsrResult('md-card', { html: '', diagnostics: [{ level: 'error', messageText: 'render failed' }] }, true), /render failed/);
  assert.throws(() => assertSsrResult('md-card', { html: '<md-card-other></md-card-other>' }, true), /missing the element/);
});
