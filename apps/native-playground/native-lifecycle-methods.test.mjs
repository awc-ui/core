import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { createNativeLiveClient } from './contracts.js';
import { nativeMethodCommand, nativeMethodResultsCommand, nativeMethodReply, nativeMethodSupported } from './native-methods.js';
import { validateLiveInput } from './native-live.mjs';

const accepted = callId => ({ methodCall: { callId, status: 'accepted' } });
const terminal = (callId, status = 'fulfilled', error) => ({ callId, status, ...(error ? { error } : {}) });
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

function fixture(t) {
  const calls = [], errors = [], timers = new Map(), records = new Map();
  let timerId = 0, session = 0, subscriptions = 0;
  const hooks = {};
  const client = createNativeLiveClient({
    schedule(callback, delay) { timers.set(++timerId, { callback, delay }); return timerId; },
    unschedule(id) { timers.delete(id); },
    subscribe() { subscriptions++; return () => { subscriptions--; }; },
    onFrame() {}, onError(error) { errors.push(error); },
    async send(route, payload) {
      calls.push({ route, payload });
      if (route === 'session') return { sessionId: `session-${++session}`, revision: 0, events: [] };
      if (route.endsWith('/close')) return { closed: true };
      const base = { sessionId: route.split('/')[0], revision: 0, events: [] };
      if (payload.command === 'method') {
        if (hooks.method) return { ...base, ...await hooks.method(payload) };
        records.set(payload.callId, terminal(payload.callId, 'pending'));
        return { ...base, ...accepted(payload.callId) };
      }
      if (payload.command === 'method-results') {
        if (hooks.query) return { ...base, ...await hooks.query(payload) };
        payload.acknowledged.forEach(id => records.delete(id));
        return { ...base, methodResults: payload.callIds.map(id => records.get(id) || terminal(id, 'rejected', { code: 'UNKNOWN_METHOD_CALL', message: 'Unknown call.' })) };
      }
      return base;
    },
  });
  t.after(() => client.stop());
  return { client, calls, errors, timers, records, hooks, get subscriptions() { return subscriptions; },
    async tick() {
      const [id, timer] = timers.entries().next().value || [];
      assert.ok(timer, 'expected scheduled method query');
      timers.delete(id); timer.callback(); await nextTurn(); return timer.delay;
    },
  };
}

test('menu method/query schema is bounded and completion replies correlate every requested call exactly', () => {
  const command = nativeMethodCommand('md-fab-menu', 'whenClosed', [], { target: 'component', callId: 'm-1' });
  assert.deepEqual(validateLiveInput(command, { tag: 'md-fab-menu' }), command);
  assert.equal(nativeMethodSupported('md-fab-menu', 'whenClosed'), false, 'wire support does not invent adapter capability');
  assert.equal(nativeMethodSupported('md-fab-menu', 'whenClosed', { methods: ['whenClosed'] }), true);
  assert.equal(nativeMethodSupported('md-fab-menu', 'whenClosed', { methods: ['whenClosed'], unsupportedMethods: ['whenClosed'] }), false);
  for (const target of ['body', 'anchor', '#demo-fab-menu', '']) assert.throws(() => nativeMethodCommand('md-fab-menu', 'show', [], { target, callId: 'm-1' }), { code: 'INVALID_METHOD' });
  for (const args of [[true], new Array(1), undefined]) assert.throws(() => nativeMethodCommand('md-fab-menu', 'show', args, { target: 'component', callId: 'm-1' }), { code: 'INVALID_METHOD' });
  for (const ids of [Array.from({ length: 33 }, (_, i) => `m-${i}`), ['a','a'], ['bad id'], new Array(1)]) assert.throws(() => nativeMethodResultsCommand('md-fab-menu', ids), { code: 'INVALID_METHOD' });
  assert.throws(() => nativeMethodResultsCommand('md-fab-menu', ['a'], ['a']), { code: 'INVALID_METHOD' });
  assert.throws(() => nativeMethodResultsCommand('md-button', []), { code: 'INVALID_METHOD' });
  const query = nativeMethodResultsCommand('md-fab-menu', ['a','b'], ['c']);
  assert.deepEqual(validateLiveInput(query, { tag: 'md-fab-menu' }), query);
  assert.deepEqual(nativeMethodReply({ methodResults: [terminal('b'), terminal('a','pending')] }, query).methodResults.map(result => result.callId), ['b','a']);
  for (const methodResults of [[], [terminal('a'),terminal('a')], [terminal('a'),terminal('x')], [terminal('a'),terminal('b','rejected')]]) assert.throws(() => nativeMethodReply({ methodResults }, query), { code: 'INVALID_METHOD_RESULT' });
  assert.throws(() => nativeMethodReply(accepted('wrong'), command), { code: 'INVALID_METHOD_RESULT' });
});

test('Snackbar lifecycle methods preserve exact source reasons and remain gated by adapter support', () => {
  for (const args of [[], ['auto'], ['action'], ['close']]) {
    const command = nativeMethodCommand('md-snackbar', 'hide', args, { target: 'component', callId: 'snackbar-1' });
    assert.deepEqual(command.arguments, args);
    assert.deepEqual(validateLiveInput(command, { tag: 'md-snackbar' }), command);
  }
  assert.equal(nativeMethodSupported('md-snackbar', 'show'), false);
  assert.equal(nativeMethodSupported('md-snackbar', 'show', { methods: ['show', 'hide'] }), true);
  assert.equal(nativeMethodSupported('md-snackbar', 'hide', { methods: ['show', 'hide'], unsupportedMethods: ['hide'] }), false);
  for (const args of [[null], [''], ['timeout'], ['CLOSE'], ['close', 'auto'], new Array(1)]) {
    assert.throws(() => nativeMethodCommand('md-snackbar', 'hide', args, { target: 'component', callId: 'm-1' }), { code: 'INVALID_METHOD' });
  }
  assert.throws(() => nativeMethodCommand('md-snackbar', 'show', ['close'], { target: 'component', callId: 'm-1' }), { code: 'INVALID_METHOD' });
  assert.throws(() => nativeMethodCommand('md-snackbar', 'hide', []), { code: 'INVALID_METHOD' });
  assert.throws(() => nativeMethodCommand('md-snackbar', 'close', [], { target: 'component', callId: 'm-1' }), { code: 'INVALID_METHOD' });
  const query = nativeMethodResultsCommand('md-snackbar', ['m-1'], []);
  assert.deepEqual(validateLiveInput(query, { tag: 'md-snackbar' }), query);
});

test('Snackbar show and hide preserve ordered calls, and acceptance alone does not settle the application promise', async t => {
  const f = fixture(t); await f.client.start({ tag: 'md-snackbar' });
  let finished = 0;
  const shown = f.client.invoke('show', []).then(() => finished++);
  const hidden = f.client.invoke('hide', ['action']).then(() => finished++);
  await nextTurn();
  const calls = f.calls.filter(call => call.payload?.command === 'method').map(call => call.payload);
  assert.deepEqual(calls.map(call => [call.method, call.arguments]), [['show', []], ['hide', ['action']]]);
  assert.equal(finished, 0);
  f.records.set('m-1', terminal('m-1')); f.records.set('m-2', terminal('m-2'));
  await f.tick(); await Promise.all([shown, hidden]);
  assert.equal(finished, 2);
  await f.tick();
  assert.equal(f.records.size, 0); assert.equal(f.timers.size, 0);
});

test('whenClosed stays pending after acceptance and visual pause, while a later close command runs and completes both promises', async t => {
  const f = fixture(t); await f.client.start({ tag: 'md-fab-menu' });
  let closed = false;
  const wait = f.client.invoke('whenClosed', []).then(() => { closed = true; });
  await nextTurn(); f.client.setVisible(false);
  assert.equal(f.subscriptions, 0);
  await f.tick(); assert.equal(closed, false);
  assert.equal([...f.timers.values()][0].delay, 500, 'pending queries back off without replaying methods');
  const close = f.client.invoke('close', []); await nextTurn();
  assert.deepEqual(f.calls.filter(call => call.payload?.command === 'method').map(call => call.payload.method), ['whenClosed','close']);
  f.records.set('m-1', terminal('m-1')); f.records.set('m-2', terminal('m-2'));
  await f.tick(); await Promise.all([wait, close]);
  assert.equal(closed, true);
  await f.tick();
  assert.deepEqual(f.calls.at(-1).payload, { command:'method-results',callIds:[],acknowledged:['m-1','m-2'] });
  assert.equal(f.records.size, 0); assert.equal(f.timers.size, 0, 'no polling remains after final result acknowledgement');
  assert.deepEqual(f.errors, []);
});

test('unknown calls and nonfatal host busy rejection reject only the corresponding method', async t => {
  const f = fixture(t); await f.client.start({ tag:'md-fab-menu' });
  const unknown = assert.rejects(f.client.invoke('whenClosed', []), { code:'UNKNOWN_METHOD_CALL' });
  await nextTurn(); f.records.clear(); await f.tick(); await unknown;
  f.hooks.method = payload => ({ methodCall:{callId:payload.callId,status:'rejected',error:{code:'METHOD_CALLS_BUSY',message:'Wait for pending methods.'}} });
  await assert.rejects(f.client.invoke('show', []), { code:'METHOD_CALLS_BUSY' });
  assert.equal(f.client.input({command:'key',key:'Escape'}), true, 'method failure leaves input/session usable');
  await nextTurn(); assert.deepEqual(f.errors, []);
});

test('pending lifecycle calls are bounded and no unresolved promise is evicted', async t => {
  const f = fixture(t); await f.client.start({tag:'md-fab-menu'});
  const waits = Array.from({length:32}, () => assert.rejects(f.client.invoke('whenClosed', []), {code:'SESSION_CLOSED'}));
  await nextTurn(); await assert.rejects(f.client.invoke('show', []), {code:'METHOD_CALLS_BUSY'});
  await f.client.stop(); await Promise.all(waits);
  assert.equal(f.calls.filter(call=>call.payload?.command==='method').length,32);
  assert.equal(f.timers.size,0);
});

test('session replacement rejects lifecycle waits and ignores an old result query still in flight', async t => {
  const f=fixture(t); await f.client.start({tag:'md-fab-menu'});
  const waiting=assert.rejects(f.client.invoke('whenClosed',[]),{code:'SESSION_CLOSED'});
  await nextTurn(); const gate=deferred(); f.hooks.query=()=>gate.promise;
  await f.tick(); await f.client.start({tag:'md-fab'}); await waiting;
  gate.resolve({methodResults:[terminal('m-1')]}); await nextTurn();
  assert.equal(f.timers.size,0); assert.deepEqual(f.errors,[]);
  assert.equal(f.calls.filter(call=>call.payload?.command==='method-results').length,1);
});
