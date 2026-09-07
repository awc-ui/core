#!/usr/bin/env node
/** Deduplicate embedded sources while retaining readable, published source files. */
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export async function compactSourceMaps(packageRoot) {
  const sourcesDir = join(packageRoot, 'dist/sources');
  let maps = 0, embeddedBytes = 0;
  const sources = new Set();
  async function walk(dir) {
    for (const item of await readdir(dir, {withFileTypes:true}).catch(e=>{if(e.code==='ENOENT')return [];throw e;})) {
      const file = join(dir, item.name);
      if (item.isDirectory()) { if (file !== sourcesDir) await walk(file); continue; }
      if (!item.name.endsWith('.map')) continue;
      const map = JSON.parse(await readFile(file, 'utf8'));
      if (!Array.isArray(map.sourcesContent) || !Array.isArray(map.sources)) continue;
      // Mixed inline/external maps retain their original semantics unchanged.
      if (map.sourcesContent.length !== map.sources.length || map.sourcesContent.some(s=>typeof s!=='string')) continue;
      const nextSources = [];
      for (let index=0; index<map.sources.length; index++) {
        const content = map.sourcesContent[index];
        const hash = createHash('sha256').update(content).digest('hex');
        const name = basename(map.sources[index]).replace(/[^\w.-]/g, '_') || 'source.txt';
        const target = join(sourcesDir, hash, name);
        if (!sources.has(target)) { await mkdir(dirname(target),{recursive:true});await writeFile(target,content);sources.add(target); }
        nextSources.push(relative(dirname(file), target).split('\\').join('/'));
        embeddedBytes += Buffer.byteLength(content);
      }
      map.sources = nextSources;
      delete map.sourcesContent;
      delete map.sourceRoot;
      await writeFile(file,JSON.stringify(map));
      maps++;
    }
  }
  await walk(join(packageRoot,'dist'));
  await walk(join(packageRoot,'hydrate'));
  return {maps, sources:sources.size, embeddedBytes};
}

if (process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const root=resolve(dirname(fileURLToPath(import.meta.url)),'../packages/core');
  console.log('Source maps:',await compactSourceMaps(root));
}
