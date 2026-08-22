// One-shot migration: replace the wrapper-span + inset-override workaround with
// md-status-dot's `inline` mode (added in core 0a41564).
//
// Before: <span style="position: relative; display: inline-flex; inline-size: Npx;
//           block-size: Npx; --md-status-dot-inset-end: 0px;
//           --md-status-dot-inset-block-end: 0px;"><md-status-dot ...></md-status-dot></span>
// After:  <md-status-dot inline ...></md-status-dot>
//
// Only dots that sit beside text are migrated. Dots anchored to an avatar or
// tile (a real badge) keep the wrapper — those are matched by the absence of
// the inset overrides, which only ever existed to defeat the badge anchoring.
import fs from 'node:fs';

const files = process.argv.slice(2);
let total = 0;

for (const file of files) {
  const before = fs.readFileSync(file, 'utf8');

  // Wrapper spans carrying BOTH inset overrides, wrapping exactly one dot.
  // [\s\S]*? spans newlines so multi-line anchors are caught too.
  const re =
    /<span[^>]*--md-status-dot-inset-end[^>]*>\s*(<md-status-dot\b[^>]*?)(\s*\/?>)\s*(?:<\/md-status-dot>)?\s*<\/span>/g;

  const after = before.replace(re, (_m, openTag, close) => {
    const tag = /\binline\b/.test(openTag) ? openTag : openTag + ' inline';
    return tag + close.replace(/\s*\/?>/, '>') + '</md-status-dot>';
  });

  const hits = (before.match(re) || []).length;
  if (hits) {
    fs.writeFileSync(file, after);
    total += hits;
    console.log(hits + '\t' + file);
  }
}
console.log('migrated ' + total + ' dots');
