#!/usr/bin/env node
/**
 * Manual regeneration of the public Core CSS export. Normal Stencil builds and
 * watch rebuilds emit the same stylesheet through coreStylesOutputTarget.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateCoreStyles } from './core-styles.cjs';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outFile = path.join(repository, 'packages/core/dist/md3/md3.css');
const { css, tags, sourceBytes } = generateCoreStyles(repository);
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, css);
console.log(
  `emit-tokens-css: ${path.relative(repository, outFile)} written ` +
  `(${sourceBytes} B source incl. ${tags.length} pre-hydration tags -> ${Buffer.byteLength(css)} B minified)`,
);
