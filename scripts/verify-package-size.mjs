#!/usr/bin/env node
/** Budget what npm actually packs, separately from browser bundle budgets. */
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname,join,resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const scratch=await mkdtemp(join(tmpdir(),'awc-pack-size-'));
try {
  const packageRoot=join(root,'packages/core');
  const packed=JSON.parse(execFileSync('npm',['pack','--ignore-scripts','--json','--pack-destination',scratch],{cwd:packageRoot,encoding:'utf8',env:{...process.env,npm_config_cache:join(scratch,'cache')}}))[0];
  const budgets=JSON.parse(await readFile(join(root,'scripts/package-size-budget.json'),'utf8'));
  console.log(JSON.stringify({package:packed.name,version:packed.version,packedBytes:packed.size,unpackedBytes:packed.unpackedSize,files:packed.entryCount,budgets},null,2));
  if(packed.size>budgets.packedBytes || packed.unpackedSize>budgets.unpackedBytes)throw new Error('Package exceeds its installation-size budget; inspect npm pack contents before raising it.');
} finally {await rm(scratch,{recursive:true,force:true});}
