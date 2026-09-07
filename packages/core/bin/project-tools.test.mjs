import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,mkdir,readFile,writeFile,readdir,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { initProject,doctor,projectInfo,setupInstruction } from './project-tools.mjs';

test('init previews without writes, copies hidden config, and refuses overwrites',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'awc-init-'));
  try {
    const template=join(dir,'package/bin/templates/html');await mkdir(template,{recursive:true});
    await writeFile(join(template,'index.html'),'<md-button>OK</md-button>');await writeFile(join(template,'_gitignore'),'node_modules\n');
    const opts={packageRoot:join(dir,'package'),cwd:dir,directory:'app',framework:'html'};
    const preview=await initProject({...opts,dryRun:true});assert.equal(preview.files.length,2);assert(!(await readdir(dir)).includes('app'));
    await initProject(opts);assert.equal(await readFile(join(dir,'app/.gitignore'),'utf8'),'node_modules\n');
    await assert.rejects(initProject(opts),/not empty/);assert.equal(await readFile(join(dir,'app/index.html'),'utf8'),'<md-button>OK</md-button>');
  } finally {await rm(dir,{recursive:true,force:true});}
});
test('doctor catches missing installation and detects SSR before its underlying framework',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'awc-doctor-'));
  try {
    await writeFile(join(dir,'package.json'),JSON.stringify({dependencies:{react:'18',next:'15','@awc-ui/core':'1.0.0-beta.9'}}));
    const result=await doctor(dir);assert.equal(result.framework,'next');assert.equal(result.ok,false);assert(result.checks.some(c=>c.status==='fail'));
    assert.match(result.guidance,/@awc-ui\/react\/server/);assert.equal((await projectInfo(dir,'vue')).framework,'vue');
    assert.match(setupInstruction('angular'),/template scope/);
  } finally {await rm(dir,{recursive:true,force:true});}
});


test('doctor accepts installed import-only wrappers and still flags mismatched versions',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'awc-doctor-esm-'));
  try {
    await writeFile(join(dir,'package.json'),JSON.stringify({dependencies:{vue:'3','@awc-ui/vue':'1.0.0-beta.9','@awc-ui/svelte':'1.0.0-beta.9'}}));
    for(const name of ['core','vue','svelte']) {
      const pkg=join(dir,'node_modules/@awc-ui',name);await mkdir(pkg,{recursive:true});
      await writeFile(join(pkg,'index.mjs'),'export {};');
      await writeFile(join(pkg,'package.json'),JSON.stringify({name:`@awc-ui/${name}`,version:'1.0.0-beta.9',exports:{'.':{import:'./index.mjs'}},peerDependencies:name==='core'?{}:{'@awc-ui/core':'1.0.0-beta.9'}}));
    }
    const result=await doctor(dir);assert.equal(result.ok,true);
    assert.equal(result.checks.filter(c=>c.status==='pass').length,5);
    assert.equal(result.checks.filter(c=>c.status==='warn').length,2);
    const wrapperPath=join(dir,'node_modules/@awc-ui/vue/package.json');
    const wrapper=JSON.parse(await readFile(wrapperPath,'utf8'));wrapper.peerDependencies['@awc-ui/core']='1.0.0-beta.8';
    await writeFile(wrapperPath,JSON.stringify(wrapper));
    const mismatch=await doctor(dir);assert.equal(mismatch.ok,false);
    assert(mismatch.checks.some(c=>c.status==='fail'&&c.message.includes('requires core 1.0.0-beta.8')));
  } finally {await rm(dir,{recursive:true,force:true});}
});

test('bundled HTML CDN URLs and starter dependencies use the running release',async()=>{
  const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
  const html=await readFile(new URL('./templates/html/index.html',import.meta.url),'utf8');
  const versions=[...html.matchAll(/@awc-ui\/(?:core|tokens)@([^/\s'"]+)\//g)].map(m=>m[1]);
  assert.equal(versions.length,2);assert.deepEqual(versions,[pkg.version,pkg.version]);
  for(const framework of ['html','next','nuxt','sveltekit','astro']) {
    const starter=JSON.parse(await readFile(new URL(`./templates/${framework}/package.json`,import.meta.url),'utf8'));
    for(const field of ['dependencies','devDependencies'])for(const [name,version] of Object.entries(starter[field]??{}))if(name.startsWith('@awc-ui/'))assert.equal(version,pkg.version,`${framework}: ${name}`);
  }
});
