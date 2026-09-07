import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';

export const starterFrameworks = ['html', 'next', 'nuxt', 'sveltekit', 'astro'];
export async function projectInfo(root, explicit) {
  const manifest=await readFile(join(root,'package.json'),'utf8').then(JSON.parse).catch(e=>{if(e.code==='ENOENT')return {};throw e;});
  const deps={...manifest.devDependencies,...manifest.dependencies};
  const pairs=[['next','next'],['nuxt','nuxt'],['@sveltejs/kit','sveltekit'],['astro','astro'],['@angular/core','angular'],['react','react'],['vue','vue'],['svelte','svelte']];
  if(explicit && !['html','react','angular','vue','svelte',...starterFrameworks].includes(explicit)) throw new Error(`Unknown framework: ${explicit}`);
  return {framework:explicit??pairs.find(([name])=>deps[name])?.[1]??'html',manifest,deps};
}

export function setupInstruction(framework) {
  const styles="Import '@awc-ui/core/css/tokens.css' once in the application stylesheet/entry.";
  switch(framework) {
    case 'next': return `${styles} Use @awc-ui/react/server in Server Components and @awc-ui/react inside client boundaries. Do not use /define in a server module. Follow the Next.js starter configuration.`;
    case 'nuxt': case 'astro': return `${styles} Render on the server with @awc-ui/core/hydrate and register client components separately. Follow the ${framework} starter; /define is a client/bundler entry.`;
    case 'sveltekit': return `${styles} Use @awc-ui/core/ssr/sveltekit to preserve server annotations before Svelte hydration, then register the SSR-capable components. Follow the SvelteKit starter.`;
    case 'react': return `${styles} Import typed components from @awc-ui/react; wrappers register the components they use.`;
    case 'angular': return `${styles} Add AWC standalone components or AwcUiModule to each Angular component's imports, plus FormsModule or ReactiveFormsModule for forms. Providers alone do not establish template scope.`;
    case 'vue': return `${styles} Import typed components from @awc-ui/vue. For raw md-* tags, configure isCustomElement in the build-time Vue compiler.`;
    case 'svelte': return `${styles} Register only used custom elements from @awc-ui/core/components/* in browser code. Import @awc-ui/svelte for its element typing.`;
    default: return "For a client app with a bundler, import '@awc-ui/core/define' once to register elements and load tokens. For per-component imports, load '@awc-ui/core/css/tokens.css' explicitly. Plain browsers need browser-resolvable URLs.";
  }
}

export async function initProject({packageRoot,cwd,directory='awc-app',framework='html',dryRun=false}) {
  if(!starterFrameworks.includes(framework)) throw new Error(`Starter frameworks: ${starterFrameworks.join(', ')}. React, Vue and Angular integration guides: https://awc-ui.dev/frameworks/`);
  const source=join(packageRoot,'bin/templates',framework);
  const target=resolve(cwd,directory);
  const existing=await readdir(target).catch(e=>{if(e.code==='ENOENT')return [];throw e;});
  if(existing.length) throw new Error(`Destination is not empty: ${target}. Choose an empty directory; existing files are never overwritten.`);
  const files=[];
  async function walk(dir,base='') {
    for(const item of await readdir(dir,{withFileTypes:true})) {
      if(item.isSymbolicLink())throw new Error(`Template contains a symlink: ${item.name}`);
      const rel=join(base,item.name);
      if(item.isDirectory())await walk(join(dir,item.name),rel);
      else files.push({source:join(dir,item.name),path:join(base,item.name==='_gitignore'?'.gitignore':item.name)});
    }
  }
  await walk(source);
  // Read everything before writing so a damaged package does not create a partial project.
  for(const file of files)file.content=await readFile(file.source);
  if(!dryRun) for(const file of files) {const out=join(target,file.path);await mkdir(dirname(out),{recursive:true});await writeFile(out,file.content,{flag:'wx'});}
  return {framework,directory:target,files:files.map(f=>f.path),dryRun};
}

async function installedManifest(root,name) {
  const req=createRequire(join(root,'package.json'));
  let path;
  try {path=dirname(req.resolve(name));} catch (error) {
    // import-only packages have no require export, but are still installed.
    if(error.code!=='ERR_PACKAGE_PATH_NOT_EXPORTED')return null;
    for(const modulesPath of req.resolve.paths(name)??[]) {
      const manifest=await readFile(join(modulesPath,name,'package.json'),'utf8').then(JSON.parse).catch(()=>null);
      if(manifest?.name===name)return manifest;
    }
    return null;
  }
  while(path!==dirname(path)) {
    const p=await readFile(join(path,'package.json'),'utf8').then(JSON.parse).catch(()=>null);
    if(p?.name===name)return p;
    path=dirname(path);
  }
  return null;
}

export async function doctor(root,explicit) {
  const info=await projectInfo(root,explicit);
  const checks=[];
  const core=await installedManifest(root,'@awc-ui/core');
  checks.push({status:core?'pass':'fail',message:core?`@awc-ui/core ${core.version} is installed`:'Install @awc-ui/core in this project before checking integration.'});
  for(const name of ['react','vue','angular','svelte']) {
    if(!info.deps[`@awc-ui/${name}`])continue;
    const wrapper=await installedManifest(root,`@awc-ui/${name}`);
    checks.push({status:wrapper?'pass':'fail',message:wrapper?`@awc-ui/${name} ${wrapper.version} is installed`:`@awc-ui/${name} is declared but not resolvable; install dependencies.`});
    const peer=wrapper?.peerDependencies?.['@awc-ui/core'];
    if(core && peer && /^\d+\.\d+\.\d+/.test(peer))checks.push({status:peer===core.version?'pass':'fail',message:peer===core.version?`@awc-ui/${name} and core versions match`:`@awc-ui/${name} requires core ${peer}, found ${core.version}; upgrade the AWC packages together.`});
  }
  const source=[];
  const skip=new Set(['node_modules','.git','.next','.nuxt','.svelte-kit','.astro','dist','build','coverage','work','outputs']);
  async function scan(dir,depth=0) {
    if(depth>8)return;
    for(const item of await readdir(dir,{withFileTypes:true})) {
      if(item.isSymbolicLink() || skip.has(item.name))continue;
      const file=join(dir,item.name);
      if(item.isDirectory())await scan(file,depth+1);
      else if(/\.(?:[cm]?[jt]sx?|vue|svelte|astro|html|css)$/.test(item.name))source.push(await readFile(file,'utf8'));
    }
  }
  await scan(root);
  const text=source.join('\n');
  const styles=/@awc-ui\/(?:core\/(?:define|css\/tokens\.css)|tokens(?:\/tokens\.css)?)/.test(text);
  const registration=/@awc-ui\/(?:core\/(?:define|loader|components)|react|angular|vue|svelte)/.test(text);
  checks.push({status:styles?'pass':'warn',message:styles?'Token stylesheet setup found':'No token stylesheet import found. Add @awc-ui/core/css/tokens.css to your global entry.'});
  checks.push({status:registration?'pass':'warn',message:registration?'Component registration or wrapper import found':'No component registration found in inspected source files.'});
  if(['next','nuxt','sveltekit','astro'].includes(info.framework))checks.push({status:'info',message:'Check server markup and client adoption in a browser; static source checks cannot verify hydration.'});
  return {framework:info.framework,checks,guidance:setupInstruction(info.framework),ok:checks.every(c=>c.status!=='fail')};
}
