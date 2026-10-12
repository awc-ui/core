import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir, realpath } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = dirname(fileURLToPath(import.meta.url));
const repository = resolve(directory, '../..');
const candidates = [join(repository, 'packages/theme/package.json')];
// A development worktree can share its original checkout's node_modules.
try { candidates.push(join(dirname(await realpath(join(repository, 'node_modules'))), 'packages/theme/package.json')); } catch { /* Normal install resolution below. */ }
let dependencies;
for (const candidate of candidates) {
  try {
    const require = createRequire(candidate);
    dependencies = { esbuild: require('esbuild'), material: require.resolve('@material/material-color-utilities') };
    break;
  } catch { /* Try the next locally installed workspace dependency path. */ }
}
if (!dependencies) throw new Error('Local theme build dependencies are unavailable. Install the workspace dependencies before running this build; it does not download packages.');
const output = join(directory, 'theme-vendor/awc-theme.js');
const result = await dependencies.esbuild.build({
  stdin: { contents: "export { computeTheme, generateCss, tokenName, ROLE_KEYS, DEFAULT_SEED_COLORS } from '../../packages/theme/src/index.ts';", resolveDir: directory, sourcefile: 'studio-theme-entry.ts', loader: 'ts' },
  alias: { '@material/material-color-utilities': dependencies.material },
  bundle: true, format: 'esm', platform: 'browser', target: 'es2020', minify: true,
  legalComments: 'inline', write: false, outfile: output,
  banner: { js: '// Generated from packages/theme by node apps/native-playground/build-studio-theme.mjs. Includes Material Color Utilities (Apache-2.0); see LICENSES.txt.' },
});
const bundled = result.outputFiles[0].text;
if (process.argv.includes('--check')) {
  if (await readFile(output, 'utf8') !== bundled) throw new Error('The studio theme bundle is stale. Run node apps/native-playground/build-studio-theme.mjs.');
  console.log('Studio theme bundle is current.');
} else {
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, bundled);
  const materialRoot = dirname(dependencies.material);
  const ownLicense = await readFile(join(repository, 'packages/theme/LICENSE'), 'utf8');
  const materialLicense = await readFile(join(materialRoot, 'LICENSE'), 'utf8');
  await writeFile(join(dirname(output), 'LICENSES.txt'), `@awc-ui/theme (packages/theme)\n${ownLicense}\n\n@material/material-color-utilities\n${materialLicense}`);
  console.log(`Built theme-vendor/awc-theme.js (${bundled.length} bytes).`);
}
