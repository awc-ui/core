import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,mkdir,readFile,writeFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname,join,resolve } from 'node:path';
import { compactSourceMaps } from './compact-sourcemaps.mjs';

test('shared sources stay readable, mappings stay intact, and reruns preserve maps', async()=>{
  const dir=await mkdtemp(join(tmpdir(),'awc-maps-'));
  try {
    const files=['dist/a/index.js.map','hydrate/index.js.map'];
    const original={version:3,names:['x'],sources:['../src/example.ts'],sourcesContent:['export const x = 1;'],sourceRoot:'/old/',mappings:'AAAA',file:'index.js'};
    for(const rel of files){await mkdir(dirname(join(dir,rel)),{recursive:true});await writeFile(join(dir,rel),JSON.stringify(original));}
    const result=await compactSourceMaps(dir);
    assert.equal(result.maps,2);assert.equal(result.sources,1);
    let target;
    for(const rel of files){
      const map=JSON.parse(await readFile(join(dir,rel),'utf8'));
      assert.equal(map.mappings,original.mappings);assert.deepEqual(map.names,original.names);
      assert.equal(map.sourceRoot,undefined);assert.equal(map.sourcesContent,undefined);
      const path=resolve(dirname(join(dir,rel)),map.sources[0]);
      assert.equal(await readFile(path,'utf8'),original.sourcesContent[0]);
      if(target)assert.equal(path,target);target=path;
    }
    assert.equal((await compactSourceMaps(dir)).maps,0);
  } finally {await rm(dir,{recursive:true,force:true});}
});
