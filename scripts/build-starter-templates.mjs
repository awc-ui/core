#!/usr/bin/env node
import { cp,mkdir,readdir,readFile,writeFile,rm,rename } from 'node:fs/promises';
import { dirname,join,resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const pkg=JSON.parse(await readFile(join(root,'packages/core/package.json'),'utf8'));
const destination=join(root,'packages/core/bin/templates');
await rm(destination,{recursive:true,force:true});await mkdir(destination,{recursive:true});
for(const name of ['html','next','nuxt','sveltekit','astro']) {
  const target=join(destination,name);
  await cp(join(root,'starters',name),target,{recursive:true,filter:source=>!source.split(/[\\/]/).some(part=>['node_modules','.next','.nuxt','.svelte-kit','.astro','dist','build'].includes(part))});
  const manifestPath=join(target,'package.json');const manifest=JSON.parse(await readFile(manifestPath,'utf8'));
  for(const field of ['dependencies','devDependencies'])for(const dep of Object.keys(manifest[field]??{}))if(dep.startsWith('@awc-ui/'))manifest[field][dep]=pkg.version;
  await writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n');
  if(name==='html') {
    const htmlPath=join(target,'index.html');
    const html=await readFile(htmlPath,'utf8');
    // CDN consumers must run the same release as the generated npm manifest.
    await writeFile(htmlPath,html.replace(/(@awc-ui\/(?:core|tokens)@)[^/\s'"]+(?=\/)/g,`$1${pkg.version}`));
  }
  if((await readdir(target)).includes('.gitignore'))await rename(join(target,'.gitignore'),join(target,'_gitignore'));
}
console.log(`Bundled five standalone starters for AWC UI ${pkg.version}`);
