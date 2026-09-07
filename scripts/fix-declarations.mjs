#!/usr/bin/env node
/** Keep emitted declarations resolvable with both Bundler and NodeNext. */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packages = process.argv.slice(2);
if (!packages.length) packages.push('core');

function visit(dir) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) visit(path);
    else if (entry.name.endsWith('.d.ts')) {
      const text = readFileSync(path, 'utf8');
      const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
      const edits = [];
      function specifier(node) {
        if (!node || !ts.isStringLiteral(node) || !node.text.startsWith('.')) return;
        if (/\.(?:[cm]?js|json|[cm]?ts)$/.test(node.text)) return;
        const target = resolve(dir, node.text);
        const suffix = existsSync(`${target}.d.ts`) ? '.js'
          : existsSync(join(target, 'index.d.ts')) ? '/index.js' : null;
        if (suffix) edits.push([node.getStart(source) + 1, node.getEnd() - 1, node.text + suffix]);
      }
      function walk(node) {
        if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) specifier(node.moduleSpecifier);
        if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) specifier(node.argument.literal);
        ts.forEachChild(node, walk);
      }
      walk(source);
      let next = text;
      for (const [start, end, replacement] of edits.sort((a,b)=>b[0]-a[0])) next = next.slice(0,start)+replacement+next.slice(end);
      if (next !== text) writeFileSync(path, next);
    }
  }
}
for (const name of packages) {
  if (!/^[a-z-]+$/.test(name)) throw new Error(`Invalid package: ${name}`);
  const pkg = join(root, 'packages', name);
  visit(join(pkg, 'dist'));
  if (name === 'core') {
    // ESM facade preserves the legacy CJS declarations without duplicating their tree.
    writeFileSync(join(pkg, 'dist/types/index.d.mts'), "export * from './index.js';\n");
    for (const dir of ['loader', 'hydrate']) {
      const file = join(pkg, dir, 'index.d.ts');
      if (!existsSync(file)) throw new Error(`Build ${name} before normalizing declarations: ${file}`);
      writeFileSync(join(pkg, dir, 'index.d.mts'), readFileSync(file));
    }
  }
  console.log(`Declarations normalized: @awc-ui/${name}`);
}
