import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { nativeMethodCommand, nativeMethodSupported } from './native-methods.js';
import { validateLiveInput } from './native-live.mjs';
import { createNativeLiveClient } from './contracts.js';
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return {promise,resolve,reject}; };

test('only the real FAB setter crosses the method boundary, preserving empty and whitespace strings', () => {
  for (const value of [null, '', ' ', 'close', 'edit']) {
    const command = {command:'method',method:'setMenuIcon',arguments:[value]};
    assert.deepEqual(nativeMethodCommand('md-fab','setMenuIcon',[value]), command);
    assert.deepEqual(validateLiveInput(command, {tag:'md-fab'}), command);
  }
  assert.equal(nativeMethodSupported('md-fab-menu','whenClosed'), false);
  for (const value of [undefined, [], [true], ['x','y'], new Array(1), ['a'.repeat(4097)]]) assert.throws(() => nativeMethodCommand('md-fab','setMenuIcon',value), {code:'INVALID_METHOD'});
  const accessor=[null]; Object.defineProperty(accessor,'0',{get(){throw Error('Must not execute');}});
  assert.throws(() => nativeMethodCommand('md-fab','setMenuIcon',accessor), {code:'INVALID_METHOD'});
  assert.throws(() => validateLiveInput({command:'method',method:'setMenuIcon',arguments:['close'],selector:'body'}, {tag:'md-fab'}), {code:'INVALID_INPUT'});
  for (const [tag,method] of [['md-button','setMenuIcon'],['md-fab','setFocus'],['md-fab','constructor']]) assert.throws(() => nativeMethodCommand(tag,method,['close']), {code:'INVALID_METHOD'});
});

function fixture(t) {
  const calls=[], gates=[], errors=[];
  let sequence=0;
  const client=createNativeLiveClient({
    send: async(route,payload) => {
      calls.push({route,payload});
      if(route==='session') return {sessionId:`session-${++sequence}`,revision:0,events:[],imageUrl:'data:image/png;base64,aA=='};
      if(route.endsWith('/close')) return {closed:true};
      const gate=deferred();gates.push(gate);return gate.promise;
    },
    subscribe:()=>()=>{}, onFrame(){}, onError:error=>errors.push(error),
  });
  t.after(()=>client.stop());
  return {client,calls,gates,errors};
}

test('native invocation is serialized with input and resolves only after the correct acknowledgement', async t => {
  const f=fixture(t);await f.client.start({tag:'md-fab'});
  f.client.input({command:'click',x:20,y:20});
  let finished=false;const invocation=f.client.invoke('setMenuIcon',['close']).then(()=>{finished=true;});
  await nextTurn();assert.equal(f.gates.length,1);assert.equal(finished,false);
  f.gates[0].resolve({sessionId:'session-1',revision:0,events:[]});await nextTurn();
  assert.deepEqual(f.calls.at(-1).payload,{command:'method',method:'setMenuIcon',arguments:['close']});
  assert.equal(finished,false);
  f.gates[1].resolve({sessionId:'session-1',revision:0,events:[]});await invocation;
  assert.equal(finished,true);assert.deepEqual(f.errors,[]);
});

test('closing or replacing a preview rejects both running and queued method promises', async t => {
  const f=fixture(t);await f.client.start({tag:'md-fab'});
  const first=assert.rejects(f.client.invoke('setMenuIcon',['close']),{code:'SESSION_CLOSED'});
  const second=assert.rejects(f.client.invoke('setMenuIcon',[null]),{code:'SESSION_CLOSED'});
  await f.client.start({tag:'md-button'});await Promise.all([first,second]);
  f.gates[0].resolve({sessionId:'session-1',revision:1,events:[]});await nextTurn();
  assert.equal(f.calls.filter(call=>call.payload?.command==='method').length,1,'queued stale method is never sent');
  await assert.rejects(f.client.invoke('setMenuIcon',['close']),{code:'INVALID_METHOD'});
  await f.client.stop();await assert.rejects(f.client.invoke('setMenuIcon',[null]),/Connect/);
});

test('failed method acknowledgement rejects without automatic replay', async t => {
  const f=fixture(t);await f.client.start({tag:'md-fab'});
  const failed=assert.rejects(f.client.invoke('setMenuIcon',['close']),/native controller unavailable/);
  f.gates[0].reject(new Error('native controller unavailable'));await failed;await nextTurn();
  assert.equal(f.calls.filter(call=>call.payload?.command==='method').length,1);
  assert.equal(f.errors.length,1);
});
