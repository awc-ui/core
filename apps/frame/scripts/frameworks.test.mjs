import test from 'node:test';
import assert from 'node:assert/strict';
import { frameworks, frameworkUrl } from '../src/frameworks.js';

test('every framework transition keeps the mount, origin, search parameters, and encoded route', () => {
  for (const prefix of ['http://127.0.0.1:4390/', 'https://awc-ui.dev/showcase/frame/', 'https://example.test/demo/frame/']) {
    for (const source of frameworks) for (const target of frameworks) {
      const href = `${prefix}${source.id}/?ref=docs#/search?q=design%20%26%20nature`;
      const result = frameworkUrl(target.id, href);
      assert.equal(result.href, `${prefix}${target.id}/?ref=docs#/search?q=design%20%26%20nature`);
      assert.equal(result.origin, new URL(href).origin);
    }
  }
});

test('framework links handle direct index entries and reject invalid targets', () => {
  assert.equal(frameworkUrl('vue', 'http://127.0.0.1:4390/react/index.html#/watch/local-example').href, 'http://127.0.0.1:4390/vue/#/watch/local-example');
  assert.equal(frameworkUrl('html', 'http://127.0.0.1:4390/#/watch/v9').href, 'http://127.0.0.1:4390/html/#/watch/v9');
  for (const target of ['next', '../outside', 'https://example.test']) assert.throws(() => frameworkUrl(target, 'https://awc-ui.dev/showcase/frame/html/'), /Unknown Frame framework/);
});
