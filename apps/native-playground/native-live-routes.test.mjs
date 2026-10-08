import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { handleNativeLiveRequest } from './server.mjs';

const sessionId = '8472268c-9a31-43a0-855e-390e67fc512c';
function fixture() {
  const calls = [];
  const renderer = {
    status: async () => ({available:true}),
    create: async value => {calls.push(['create',value]); return {sessionId};},
    input: async (id,value) => {calls.push(['input',id,value]); return {sessionId:id,events:[{name:'mdSelect',detail:{selected:true}}]};},
    frame: async id => {calls.push(['frame',id]); return {sessionId:id};},
    close: async id => {calls.push(['close',id]);},
  };
  return {
    calls,
    async request(url, body={}, options={}) {
      const req = Readable.from([Buffer.from(JSON.stringify(body))]);
      Object.assign(req,{url,method:options.method||'POST',headers:{host:'127.0.0.1:4177','content-type':'application/json',origin:options.origin||'http://127.0.0.1:4177'}});
      const res = {destroyed:options.destroyed||false,writeHead(status,headers){this.status=status;this.headers=headers;},end(){}};
      const handled = await handleNativeLiveRequest(req,res,{renderer,tags:async()=>new Set(['md-chip']),json:(target,status,value)=>{target.status=status;target.value=value;}});
      return {handled,...res};
    },
  };
}

test('live session routes reject foreign origins and unknown components before native execution', async () => {
  const f=fixture();
  assert.equal((await f.request('/api/native-live/session',{tag:'md-chip'},{origin:'https://example.com'})).status,403);
  assert.equal((await f.request('/api/native-live/session',{tag:'private-command'})).status,400);
  assert.equal((await f.request('/api/native-live/session',{}, {method:'GET'})).status,405);
  assert.equal((await f.request('/api/native-live/no-such-route')).status,404);
  assert.deepEqual(f.calls,[]);
});

test('live session routes retain native event details and close abandoned or explicitly ended sessions', async () => {
  const f=fixture();
  const created=await f.request('/api/native-live/session',{tag:'md-chip',properties:{selected:false},dark:true,width:640});
  assert.equal(created.status,200);
  assert.equal(f.calls[0][1].properties.selected,false);
  const input=await f.request(`/api/native-live/${sessionId}/input`,{command:'click',x:42,y:40});
  assert.deepEqual(input.value.events,[{name:'mdSelect',detail:{selected:true}}]);
  assert.equal((await f.request(`/api/native-live/${sessionId}/close`)).value.closed,true);
  await f.request('/api/native-live/session',{tag:'md-chip'}, {destroyed:true});
  assert.deepEqual(f.calls.at(-1),['close',sessionId]);
  assert.equal(f.calls.filter(([command])=>command==='close').length,2);
  assert.equal((await f.request('/api/native-render')).handled,false);
});
