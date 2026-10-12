import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { createNativeRenderer, validateRenderRequest, readRenderRequest } from './native-render.mjs';
import { resolveAsset } from './server.mjs';

const tags = new Set(['md-chip']);
const request = properties => validateRenderRequest({tag:'md-chip',properties,dark:false,width:640},tags);
for (const scenario of ['button-behavior', 'navigation-events', 'focus-accessibility']) test(`${scenario} is explicit, live-only and restricted to the button`, async () => {
  const tags = new Set(['md-button', 'md-chip']);
  const value = {tag:'md-button', scenario};
  assert.equal(validateRenderRequest(value, tags).scenario, scenario);
  for (const changes of [{tag:'md-chip'}, {scenario:'unknown'}, {scenario:true}, {scenario:null}]) {
    assert.throws(() => validateRenderRequest({...value, ...changes}, tags), error => error.code === 'INVALID_SCENARIO');
  }
  const renderer = createNativeRenderer({repoRoot:'/tmp'});
  await assert.rejects(renderer.render(validateRenderRequest(value, tags)), error => error.code === 'LIVE_SCENARIO_REQUIRED');
});
function incoming(value, headers={}) {
  const stream = Readable.from([Buffer.from(JSON.stringify(value))]);
  stream.headers = {'content-type':'application/json',host:'127.0.0.1:4177',origin:'http://127.0.0.1:4177',...headers};
  return stream;
}

test('native render requests retain typed properties and enforce tag, theme, size and origin contracts', async () => {
  const value = {tag:'md-chip',properties:{selected:false,count:0,nested:{a:'$()`'}},width:10};
  assert.deepEqual(await readRenderRequest(incoming(value),tags),{tag:'md-chip',properties:{count:0,nested:{a:'$()`'},selected:false},dark:false,width:320});
  assert.equal(validateRenderRequest({...value,width:5000},tags).width,1200);
  for(const changes of [{tag:'../../secrets'},{dark:'false'},{properties:[]},{properties:null},{width:'640'}]) {
    assert.throws(()=>validateRenderRequest({...value,...changes},tags),error=>error.status===400);
  }
  for(const [headers,status] of [[{origin:'https://example.com'},403],[{host:'rebinding.example'},403],[{'content-type':'text/plain'},415],[{'content-length':'200000'},413]]) {
    await assert.rejects(readRenderRequest(incoming(value,headers),tags),error=>error.status===status);
  }
});

test('native runner writes JSON, coalesces identical work, caches variants, and exposes only PNG artifacts', async () => {
  const root = await mkdtemp(path.join(tmpdir(),'awc-native-render-'));
  try {
    const executable = path.join(root,'renderer'), directory = path.join(root,'renders');
    await writeFile(executable,'fake executable',{mode:0o755});
    let calls=0;
    const execute=async(binary,args)=>{
      calls++; assert.equal(binary,executable); assert.equal(args[0],'--request'); assert.equal(args[2],'--output');
      const input=JSON.parse(await readFile(args[1],'utf8')); assert.equal(input.tag,'md-chip');
      await writeFile(args[3],Buffer.from([137,80,78,71,13,10,26,10,0]));
      return {stdout:JSON.stringify({tag:input.tag,width:640,height:100})};
    };
    const renderer=createNativeRenderer({repoRoot:root,executable,renderRoot:directory,platform:'darwin',execute});
    assert.equal((await renderer.status()).available,true);
    const [first,duplicate]=await Promise.all([renderer.render(request({selected:false})),renderer.render(request({selected:false}))]);
    assert.deepEqual(first,duplicate); assert.equal(calls,1);
    assert.deepEqual(await renderer.render(request({selected:false})),first); assert.equal(calls,1);
    const selected=await renderer.render(request({selected:true}));
    assert.notEqual(selected.imageUrl,first.imageUrl); assert.equal(calls,2);
    assert.equal(first.platform,'macos'); assert.equal(first.renderer,'SwiftUI');
    assert.ok(await resolveAsset(first.imageUrl,{repoRoot:root,renderRoot:directory}));
    assert.equal(await resolveAsset(first.imageUrl.replace('.png','.json'),{repoRoot:root,renderRoot:directory}),null);
    assert.equal(await resolveAsset('/native-renders/../secret',{repoRoot:root,renderRoot:directory}),null);
    assert.equal((await readdir(directory)).some(file=>file.endsWith('.request.json')),false);
    await writeFile(executable,'a rebuilt native executable');
    assert.notEqual((await renderer.render(request({selected:false}))).imageUrl,first.imageUrl); assert.equal(calls,3);
  } finally { await rm(root,{recursive:true,force:true}); }
});

test('failed native renders release capacity, discard temporary files and return actionable errors', async () => {
  const root=await mkdtemp(path.join(tmpdir(),'awc-native-failure-'));
  try {
    const executable=path.join(root,'renderer'),directory=path.join(root,'renders');
    await writeFile(executable,'fake executable',{mode:0o755});
    const execute=async()=>{throw Object.assign(new Error('timeout'),{killed:true});};
    const renderer=createNativeRenderer({repoRoot:root,executable,renderRoot:directory,platform:'darwin',execute});
    await assert.rejects(renderer.render(request({selected:false})),error=>error.status===502&&error.message.includes('timed out'));
    await assert.rejects(renderer.render(request({selected:true})),error=>error.status===502);
    assert.deepEqual(await readdir(directory),[]);
    const unavailable=createNativeRenderer({repoRoot:root,executable,platform:'linux'});
    assert.equal((await unavailable.status()).available,false);
    await assert.rejects(unavailable.render(request({})),error=>error.status===503);
  } finally {await rm(root,{recursive:true,force:true});}
});
