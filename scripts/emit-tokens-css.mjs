#!/usr/bin/env node
/**
 * emit-tokens-css — produce packages/core/dist/md3/md3.css from the tokens
 * package.
 *
 * dist/md3/md3.css is the target of @awc-ui/core's "./css/tokens.css" export
 * and is imported by define.mjs. It used to be a side product of Stencil's
 * `globalStyle` config — which ALSO embedded the whole sheet as a JS string in
 * the custom-elements runtime chunk, double-shipping ~2.7 kB gz to every app
 * (see stencil.config.ts). With globalStyle removed, this script generates the
 * file instead: read @awc-ui/tokens/src/tokens.css, minify with esbuild, write.
 *
 * Chained into @awc-ui/core's "build" script after the Stencil builds (which
 * start with `rm -rf dist`, so this must run after them).
 */
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { createRequire } from 'node:module';

const repoRoot = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');

// esbuild is a devDependency of packages/core (pnpm: not hoisted to the repo
// root), so resolve it from there rather than from this script's location.
const require = createRequire(path.join(repoRoot, 'packages/core/package.json'));
const { transformSync } = require('esbuild');
const source = path.join(repoRoot, 'packages/tokens/src/tokens.css');
const outDir = path.join(repoRoot, 'packages/core/dist/md3');
const outFile = path.join(outDir, 'md3.css');

const css = fs.readFileSync(source, 'utf8');
const { code } = transformSync(css, { loader: 'css', minify: true });
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outFile, code);

console.log(
  `emit-tokens-css: ${path.relative(repoRoot, outFile)} written ` +
    `(${css.length} B source -> ${code.length} B minified)`,
);
