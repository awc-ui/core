import test from 'node:test';
import assert from 'node:assert/strict';
import { createActions, trackImage } from '../src/loading.js';
class Control extends EventTarget {
  attributes = new Map();
  setAttribute(name, value) { this.attributes.set(name, value); }
  getAttribute(name) { return this.attributes.get(name); }
}
function imageFixture(complete = false, width = 0) {
  const image = Object.assign(new Control(), { complete, naturalWidth: width });
  const skeleton = { removed: false, remove() { this.removed = true; } };
  image.parentElement = Object.assign(new Control(), { querySelector: () => skeleton });
  return { image, skeleton };
}
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };

test('cached covers are revealed immediately and a pending cover replaces its skeleton when loaded', () => {
  for (const cached of [true, false]) {
    const { image, skeleton } = imageFixture(cached, cached ? 640 : 0);
    const dispose = trackImage(image);
    assert.equal(skeleton.removed, cached);
    if (!cached) { image.naturalWidth = 640; image.dispatchEvent(new Event('load')); }
    assert.equal(skeleton.removed, true);
    assert.equal(image.hidden, false);
    assert.equal(image.parentElement.getAttribute('aria-busy'), 'false');
    dispose();
  }
});

test('failed covers show one fallback; detached covers stop responding to late events', () => {
  const { image, skeleton } = imageFixture();
  let failures = 0;
  trackImage(image, { onError: () => failures++ });
  image.dispatchEvent(new Event('error')); image.dispatchEvent(new Event('error'));
  assert.equal(failures, 1); assert.equal(skeleton.removed, true); assert.equal(image.hidden, true);
  const detached = imageFixture();
  const dispose = trackImage(detached.image, { onError: () => failures++ });
  dispose(); detached.image.dispatchEvent(new Event('error'));
  assert.equal(failures, 1);
});

test('duplicate action clicks share one operation and completion restores the button', async () => {
  const indicator = new Control(), button = new Control(), region = new Control();
  const actions = createActions(indicator), work = deferred();
  let calls = 0;
  const first = actions.run(button, 'Saving video', () => { calls++; return work.promise; }, region);
  const second = actions.run(button, 'Saving video', () => { calls++; });
  assert.equal(first, second); assert.equal(button.loading, true); assert.equal(indicator.hidden, false);
  await Promise.resolve(); assert.equal(calls, 1);
  work.resolve('saved'); assert.equal(await first, 'saved');
  assert.equal(button.loading, false); assert.equal(indicator.hidden, true);
  assert.equal(region.getAttribute('aria-busy'), 'false');
});

test('rejection clears its busy state without hiding another action; disposal clears remaining feedback', async () => {
  const indicator = new Control(), a = new Control(), b = new Control();
  const actions = createActions(indicator), pending = deferred();
  const first = actions.run(a, 'Saving', () => pending.promise);
  await assert.rejects(actions.run(b, 'Copying', () => { throw new Error('Denied'); }), /Denied/);
  assert.equal(b.loading, false); assert.equal(indicator.hidden, false); assert.equal(indicator.label, 'Saving');
  actions.dispose(); assert.equal(indicator.hidden, true); assert.equal(a.loading, false);
  pending.resolve(); await first; assert.equal(indicator.hidden, true);
});
