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

/*
 * THE PRE-HYDRATION VISIBILITY RULE, which Stencil used to inject as an inline
 * `<style>` and no longer does — see `invisiblePrehydration` in stencil.config.
 *
 * It rides in the token sheet because `@awc-ui/core/define` already imports that
 * file, so the behaviour a consumer gets is unchanged and there is nothing new
 * for them to load. It deliberately does NOT ride in `pre-upgrade.css`, which is
 * opt-in: putting it there would hand a flash-of-unstyled-content regression to
 * everyone who had not opted in.
 *
 * The tag list is read from the components directory rather than written down,
 * so a new component is covered the day it exists. `.hydrated` is Stencil's own
 * flag and still applied by the runtime; only the STYLESHEET moved.
 */
const componentsDir = path.join(repoRoot, 'packages/core/src/components');
const tags = fs
  .readdirSync(componentsDir, { withFileTypes: true })
  .filter((e) => e.isDirectory() && e.name.startsWith('md-'))
  .map((e) => e.name)
  .sort();
if (tags.length === 0) throw new Error('emit-tokens-css: no md-* components found');
const prehydration =
  `\n/* Pre-hydration visibility — see scripts/emit-tokens-css.mjs. */\n` +
  `${tags.map((t) => `${t}:not(.hydrated)`).join(',')}{visibility:hidden}\n`;

const css = fs.readFileSync(source, 'utf8') + prehydration;
const { code } = transformSync(css, { loader: 'css', minify: true });
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outFile, code);

console.log(
  `emit-tokens-css: ${path.relative(repoRoot, outFile)} written ` +
    `(${css.length} B source incl. ${tags.length} pre-hydration tags -> ${code.length} B minified)`,
);
