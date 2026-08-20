/**
 * Merge every coverage source into one report.
 *
 * Story coverage alone answers "what do the Storybook stories exercise?", which
 * is a different question from "how much of the library is tested". The jest
 * spec suite, the Stencil e2e suite and the SSR smoke run all reach code no
 * story can — programmatic APIs, defensive catch branches, SSR guards that only
 * run without a DOM. Reporting them separately understates the library.
 *
 * Merged at the LCOV level rather than through monocart's `inputDir`, because
 * the sources do not share a format: monocart emits its own raw V8, jest emits
 * istanbul-shaped JSON. LCOV is the one format all of them already produce.
 *
 * Union semantics: a line/branch/function counts as covered if ANY suite covered
 * it, and hit counts are summed. Paths are normalised first — the same file
 * arrives as `src/...` from source maps and `packages/core/src/...` from jest,
 * and without normalisation every file is counted twice.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const REPO = path.dirname(fileURLToPath(import.meta.url)).replace(/\/scripts$/, '');

const SOURCES = [
  { name: 'stories', file: 'apps/storybook/coverage-stories/lcov.info' },
  { name: 'e2e', file: 'packages/core/coverage-e2e/lcov.info' },
  { name: 'spec', file: 'packages/core/coverage-spec/lcov.info' },
  { name: 'ssr', file: 'packages/core/coverage-ssr/lcov.info' },
];

/** Strip any prefix so every source agrees on one path per file. */
const normalise = (p) =>
  p
    .replace(/\\/g, '/')
    .replace(/^.*?packages\/core\//, '')
    .replace(/^\.\//, '');

const files = new Map(); // path -> { da:Map, brda:Map, fn:Map, fnName:Map }

const parse = (text) => {
  let cur = null;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (line.startsWith('SF:')) {
      const key = normalise(line.slice(3));
      if (!files.has(key)) files.set(key, { da: new Map(), brda: new Map(), fn: new Map(), fnName: new Map() });
      cur = files.get(key);
    } else if (!cur) {
      continue;
    } else if (line.startsWith('DA:')) {
      const [ln, hits] = line.slice(3).split(',').map(Number);
      cur.da.set(ln, (cur.da.get(ln) || 0) + (hits || 0));
    } else if (line.startsWith('BRDA:')) {
      const [ln, blk, br, taken] = line.slice(5).split(',');
      const key = `${ln},${blk},${br}`;
      const n = taken === '-' ? 0 : Number(taken);
      cur.brda.set(key, (cur.brda.get(key) || 0) + n);
    } else if (line.startsWith('FN:')) {
      const [ln, ...rest] = line.slice(3).split(',');
      cur.fnName.set(rest.join(','), Number(ln));
    } else if (line.startsWith('FNDA:')) {
      const [hits, ...rest] = line.slice(5).split(',');
      const name = rest.join(',');
      cur.fn.set(name, (cur.fn.get(name) || 0) + Number(hits));
    } else if (line === 'end_of_record') {
      cur = null;
    }
  }
};

const used = [];
for (const s of SOURCES) {
  const abs = path.join(REPO, s.file);
  if (!fs.existsSync(abs)) {
    console.warn(`merge-coverage: skipping ${s.name} — not found (${s.file})`);
    continue;
  }
  parse(fs.readFileSync(abs, 'utf8'));
  used.push(s.name);
}

if (!used.length) {
  console.error('merge-coverage: no coverage sources found.');
  process.exit(1);
}

const out = [];
let lf = 0, lh = 0, bf = 0, bh = 0, fnf = 0, fnh = 0;
for (const [file, d] of [...files.entries()].sort()) {
  out.push(`SF:${file}`);
  for (const [name, ln] of d.fnName) out.push(`FN:${ln},${name}`);
  for (const [name, hits] of d.fn) out.push(`FNDA:${hits},${name}`);
  const fTotal = d.fnName.size || d.fn.size;
  const fHit = [...d.fn.values()].filter((n) => n > 0).length;
  out.push(`FNF:${fTotal}`, `FNH:${fHit}`);
  for (const [key, taken] of d.brda) out.push(`BRDA:${key},${taken || '-'}`);
  const bTotal = d.brda.size;
  const bHit = [...d.brda.values()].filter((n) => n > 0).length;
  out.push(`BRF:${bTotal}`, `BRH:${bHit}`);
  for (const [ln, hits] of [...d.da.entries()].sort((a, b) => a[0] - b[0])) out.push(`DA:${ln},${hits}`);
  const lTotal = d.da.size;
  const lHit = [...d.da.values()].filter((n) => n > 0).length;
  out.push(`LF:${lTotal}`, `LH:${lHit}`, 'end_of_record');
  lf += lTotal; lh += lHit; bf += bTotal; bh += bHit; fnf += fTotal; fnh += fHit;
}

const dir = path.join(REPO, 'coverage-merged');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'lcov.info'), out.join('\n') + '\n');

const pct = (h, t) => (t ? ((100 * h) / t).toFixed(2) : '0.00');
console.log(`merge-coverage: merged ${used.join(' + ')} — ${files.size} files`);
console.log('┌─────────────┬──────────┬───────────┬──────────┐');
console.log('│ Metric      │        % │   Covered │    Total │');
console.log('├─────────────┼──────────┼───────────┼──────────┤');
console.log(`│ Lines       │ ${pct(lh, lf).padStart(7)}% │ ${String(lh).padStart(9)} │ ${String(lf).padStart(8)} │`);
console.log(`│ Branches    │ ${pct(bh, bf).padStart(7)}% │ ${String(bh).padStart(9)} │ ${String(bf).padStart(8)} │`);
console.log(`│ Functions   │ ${pct(fnh, fnf).padStart(7)}% │ ${String(fnh).padStart(9)} │ ${String(fnf).padStart(8)} │`);
console.log('└─────────────┴──────────┴───────────┴──────────┘');
console.log(`merge-coverage: lcov written to ${path.relative(REPO, path.join(dir, 'lcov.info'))}`);
