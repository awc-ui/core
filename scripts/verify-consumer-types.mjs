#!/usr/bin/env node
/** Compile the packed public core API outside workspace resolution. No registry access. */
import { mkdtemp, mkdir, readFile, writeFile, readdir, cp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const scratch=await mkdtemp(join(tmpdir(),'awc-consumer-'));
const run=(cmd,args,options={})=>execFileSync(cmd,args,{encoding:'utf8',...options});
try {
  const core=join(root,'packages/core');
  const packed=JSON.parse(run('npm',['pack','--ignore-scripts','--json','--pack-destination',scratch],{cwd:core,env:{...process.env,npm_config_cache:join(scratch,'cache')}}))[0];
  await writeFile(join(scratch,'package.json'),JSON.stringify({name:'awc-consumer-contract',private:true,type:'module'}));
  run('npm',['install','--offline','--ignore-scripts','--no-audit','--no-fund','--no-package-lock','--cache',join(scratch,'cache'),join(scratch,packed.filename)],{cwd:scratch});
  // SSR consumers supply Node types; copy that explicit fixture prerequisite,
  // never link core back to the workspace that produced it.
  const reactRequire=createRequire(join(root,'packages/react/package.json'));
  const nodeTypes=dirname(reactRequire.resolve('@types/node/package.json'));
  await cp(nodeTypes,join(scratch,'node_modules/@types/node'),{recursive:true});
  const typesRequire=createRequire(join(nodeTypes,'package.json'));
  const typesPkg=JSON.parse(await readFile(join(nodeTypes,'package.json'),'utf8'));
  for(const name of Object.keys(typesPkg.dependencies??{})) await cp(dirname(typesRequire.resolve(`${name}/package.json`)),join(scratch,'node_modules',name),{recursive:true});

  const installed=join(scratch,'node_modules/@awc-ui/core');
  const tags=(await readdir(join(installed,'dist/components'))).filter(n=>/^md-.*\.d\.ts$/.test(n)).map(n=>n.slice(0,-5));
  const imports=[
    "import type { Components, NodeInput } from '@awc-ui/core';",
    "import { defineCustomElements } from '@awc-ui/core/loader';",
    "import { renderToString } from '@awc-ui/core/hydrate';",
    "import { createSvelteHydration, createPageTransform } from '@awc-ui/core/ssr/sveltekit';",
    "import '@awc-ui/core/define';",
    "const variant: Components.MdButton['variant'] = 'filled';",
    "const nodes: NodeInput = [{ id: 'root', name: 'Root' }];",
    "// @ts-expect-error invalid button variants must remain rejected",
    "const invalidVariant: Components.MdButton['variant'] = 'invalid';",
    "// @ts-expect-error organization chart nodes require an id",
    "const invalidNodes: NodeInput = [{ name: 'Missing ID' }];",
  ];
  for(const [i,tag] of tags.entries()) {
    imports.push(`import { defineCustomElement as normal${i} } from '@awc-ui/core/components/${tag}';`);
    imports.push(`import { defineCustomElement as csr${i} } from '@awc-ui/core/components-csr/${tag}';`);
    imports.push(`import { defineCustomElement as long${i} } from '@awc-ui/core/dist/components/${tag}.js';`);
    imports.push(`import { defineCustomElement as longCsr${i} } from '@awc-ui/core/dist/components-csr/${tag}.js';`);
  }
  const file=join(scratch,'consumer.mts');await writeFile(file,imports.join('\n'));
  for(const [name,module,moduleResolution] of [
    ['Bundler',ts.ModuleKind.ESNext,ts.ModuleResolutionKind.Bundler],
    ['NodeNext',ts.ModuleKind.NodeNext,ts.ModuleResolutionKind.NodeNext],
  ]) {
    const program=ts.createProgram([file],{target:ts.ScriptTarget.ES2022,module,moduleResolution,strict:true,noEmit:true,skipLibCheck:false,types:['node'],typeRoots:[join(scratch,'node_modules/@types')]});
    const diagnostics=ts.getPreEmitDiagnostics(program);
    if(diagnostics.length)throw new Error(name+'\n'+ts.formatDiagnosticsWithColorAndContext(diagnostics,{getCanonicalFileName:f=>f,getCurrentDirectory:()=>scratch,getNewLine:()=> '\n'}));
    console.log(`${name}: ${tags.length} components × 4 import paths, public types, loader, SSR and negative assertions passed`);
  }
  const cjs=join(scratch,'consumer.cts');
  await writeFile(cjs,"import core = require('@awc-ui/core');\nimport loader = require('@awc-ui/core/loader');\nimport hydrate = require('@awc-ui/core/hydrate');\nconst variant: core.Components.MdButton['variant'] = 'filled';\n");
  const program=ts.createProgram([cjs],{module:ts.ModuleKind.NodeNext,moduleResolution:ts.ModuleResolutionKind.NodeNext,target:ts.ScriptTarget.ES2022,noEmit:true,strict:true,skipLibCheck:false,types:['node'],typeRoots:[join(scratch,'node_modules/@types')]});
  const diagnostics=ts.getPreEmitDiagnostics(program);
  if(diagnostics.length)throw new Error(ts.formatDiagnosticsWithColorAndContext(diagnostics,{getCanonicalFileName:f=>f,getCurrentDirectory:()=>scratch,getNewLine:()=> '\n'}));
  console.log('NodeNext CommonJS: root, loader and hydrate declarations passed');
} finally {await rm(scratch,{recursive:true,force:true});}
