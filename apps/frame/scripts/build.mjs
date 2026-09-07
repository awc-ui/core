import { cp, mkdir, rm, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startupMarkup } from '../src/loading.js';
import { appRoot, coreRoot } from './paths.mjs';

// The docs integration uses the same build, staged directly under its public
// showcase directory. Relative URLs keep the standalone and embedded app equal.
export async function buildFrame(destination = resolve(appRoot, 'dist')) {
  const dist = resolve(destination);
  const runtime = resolve(coreRoot(), 'packages/core/dist/md3');
  await rm(dist, { recursive: true, force: true });
  await mkdir(dist, { recursive: true });
  await cp(resolve(appRoot, 'src'), dist, { recursive: true });
  const index = resolve(dist, 'index.html');
  await writeFile(index, (await readFile(index, 'utf8')).replace('<!-- frame:loading -->', startupMarkup()));
  await cp(resolve(appRoot, 'public'), dist, { recursive: true });
  // Keep Stencil's loader beside its lazy chunks, as the repository's showcases do.
  await cp(runtime, resolve(dist, 'awc'), { recursive: true, filter: path => !path.endsWith('.map') });
  return dist;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await buildFrame();
  console.log('Frame built successfully → dist/');
}
