import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const appRoot = fileURLToPath(new URL('../', import.meta.url));
export function coreRoot() {
  if (process.env.AWC_CORE_ROOT) return resolve(process.env.AWC_CORE_ROOT);
  let directory = appRoot;
  while (directory !== dirname(directory)) {
    if (existsSync(resolve(directory, 'packages/core/dist/md3/md3.esm.js'))) return directory;
    directory = dirname(directory);
  }
  throw new Error('Build @awc-ui/core first. Outside the monorepo, set AWC_CORE_ROOT to your core checkout.');
}
