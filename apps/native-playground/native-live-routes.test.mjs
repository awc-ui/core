import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import { handleNativeLiveRequest, streamNativeFrames } from './server.mjs';
import { RenderError } from './native-render.mjs';

const sessionId = '8472268c-9a31-43a0-855e-390e67fc512c';
class Response extends EventEmitter {
  constructor(options = {}) { super(); this.destroyed = Boolean(options.destroyed); this.blocked = Boolean(options.blocked); this.writes = []; }
  writeHead(status, headers) { this.status = status; this.headers = headers; this.headersSent = true; }
  write(chunk) { this.writes.push(String(chunk)); return !this.blocked; }
  end() { this.ended = true; this.emit('close'); }
  destroy() { this.destroyed = true; this.emit('close'); }
  drain() { this.blocked = false; this.emit('drain'); }
}
function fixture() {
  const calls = [];
  let activeStream;
  const renderer = {
    status: async () => ({available:true}),
    create: async value => {calls.push(['create',value]); return {sessionId};},
    input: async (id,value) => {calls.push(['input',id,value]); return {sessionId:id,events:[{name:'mdSelect',detail:{selected:true}}]};},
    frame: async id => {calls.push(['frame',id]); return {sessionId:id};},
    close: async id => {calls.push(['close',id]);},
    subscribe: (id,onFrame,onError) => {
      if (activeStream) throw new RenderError(409,'STREAM_EXISTS','This preview already has a frame stream.');
      calls.push(['subscribe',id]);
      const stream = {onFrame,onError}; activeStream = stream;
      return () => { if(activeStream !== stream) return; calls.push(['unsubscribe',id]); activeStream = null; };
    },
  };
  return {
    calls, renderer,
    frame: value => activeStream?.onFrame(value),
    fail: error => activeStream?.onError(error),
    async request(url, body={}, options={}) {
      const req = Readable.from([Buffer.from(JSON.stringify(body))]);
      Object.assign(req,{url,method:options.method||'POST',headers:{host:'127.0.0.1:4177','content-type':'application/json',origin:options.origin||'http://127.0.0.1:4177'}});
      const res = new Response(options);
      const handled = await handleNativeLiveRequest(req,res,{renderer,tags:async()=>new Set(['md-chip']),json:(target,status,value)=>{target.status=status;target.value=value;}});
      return {handled,...res,res};
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

const streamFrame = (revision, events = []) => ({sessionId,platform:'macos',renderer:'SwiftUI',tag:'md-chip',revision,imageUrl:`data:image/png;base64,frame-${revision}`,width:1280,height:200,logicalWidth:640,logicalHeight:100,events});
const streamEvent = index => ({id:`native:${index}`,name:'mdInput',tag:'md-chip',nodeID:'fixture',detail:index});

test('NDJSON stream is same-origin POST only and does not introduce frame polling', async () => {
  const f = fixture(), path = `/api/native-live/${sessionId}/stream`;
  assert.equal((await f.request(path,{}, {origin:'https://example.com'})).status,403);
  assert.equal((await f.request(path,{}, {method:'GET'})).status,405);
  assert.deepEqual(f.calls,[]);
  const {res} = await f.request(path);
  assert.deepEqual(f.calls,[['subscribe',sessionId]]);
  f.frame(streamFrame(1,[streamEvent(1)]));
  assert.equal(res.status,200);
  assert.equal(res.headers['Content-Type'],'application/x-ndjson');
  assert.equal(res.headers['Cache-Control'],'no-store');
  assert.equal(res.writes.length,1);
  assert.ok(res.writes[0].endsWith('\n'));
  assert.deepEqual(JSON.parse(res.writes[0]),streamFrame(1,[streamEvent(1)]));
  const input = await f.request(`/api/native-live/${sessionId}/input`,{command:'click',x:42,y:40});
  assert.equal(input.status,200);
  assert.equal(f.calls.some(([command])=>command==='frame'),false);
  assert.equal((await f.request(path)).status,409);
  f.frame(streamFrame(2));
  assert.equal(res.writes.length,2,'duplicate stream attempt must not disrupt its existing subscriber');
  res.destroy(); res.emit('close');
  assert.equal(f.calls.filter(([command])=>command==='unsubscribe').length,1);
});

test('slow stream readers keep only the newest image but retain ordered events', async () => {
  const f = fixture();
  const {res} = await f.request(`/api/native-live/${sessionId}/stream`,{}, {blocked:true});
  f.frame(streamFrame(1,[streamEvent(1)]));
  f.frame(streamFrame(2,[streamEvent(2)]));
  f.frame(streamFrame(3,[streamEvent(3)]));
  assert.equal(res.writes.length,1);
  res.drain();
  assert.equal(res.writes.length,2);
  assert.deepEqual(JSON.parse(res.writes[1]),streamFrame(3,[streamEvent(2),streamEvent(3)]));
  f.frame(streamFrame(4));
  assert.equal(JSON.parse(res.writes.at(-1)).revision,4);
  res.destroy();
});

test('excessive backpressure events close the stream rather than dropping native actions silently', async () => {
  const f = fixture();
  const {res} = await f.request(`/api/native-live/${sessionId}/stream`,{}, {blocked:true});
  f.frame(streamFrame(1));
  f.frame(streamFrame(2,Array.from({length:256},(_,index)=>streamEvent(index))));
  assert.equal(res.destroyed,false);
  f.frame(streamFrame(3,[streamEvent(256)]));
  assert.equal(res.destroyed,true);
  assert.equal(res.writes.length,1);
  assert.equal(f.calls.filter(([command])=>command==='unsubscribe').length,1);
  res.drain();
  assert.equal(res.writes.length,1,'closed stream must not flush obsolete pixels');
});

test('native stream failure is surfaced once and disconnect releases its subscriber', async () => {
  const f = fixture();
  const {res} = await f.request(`/api/native-live/${sessionId}/stream`);
  f.fail(new RenderError(502,'LIVE_PROCESS_EXITED','The native process exited.'));
  assert.deepEqual(JSON.parse(res.writes[0]),{error:'LIVE_PROCESS_EXITED',message:'The native process exited.'});
  assert.equal(res.ended,true);
  assert.equal(f.calls.filter(([command])=>command==='unsubscribe').length,1);
});

test('a reader that never drains is disconnected within the bounded stall timeout', t => {
  t.mock.timers.enable({apis:['setTimeout']});
  t.after(()=>t.mock.timers.reset());
  const f = fixture(), res = new Response({blocked:true});
  streamNativeFrames(res,f.renderer,sessionId);
  f.frame(streamFrame(1));
  t.mock.timers.tick(14999);
  assert.equal(res.destroyed,false);
  t.mock.timers.tick(1);
  assert.equal(res.destroyed,true);
  assert.equal(f.calls.filter(([command])=>command==='unsubscribe').length,1);
});

test('a response abandoned before subscription does not keep a native frame producer alive', () => {
  const f = fixture(), res = new Response({destroyed:true});
  streamNativeFrames(res,f.renderer,sessionId);
  assert.equal(f.calls.filter(([command])=>command==='subscribe').length,f.calls.filter(([command])=>command==='unsubscribe').length);
  f.frame(streamFrame(1));
  assert.deepEqual(res.writes,[]);
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
