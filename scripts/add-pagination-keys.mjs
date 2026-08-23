// One-shot: add the table-pagination label keys to all three dictionaries.
// They must exist in every dictionary — the kit's verifier asserts key parity.
import fs from 'node:fs';

const KEYS = {
  en: {
    'table.rowsPerPage': 'Rows per page:',
    'table.displayedRows': '%from%–%to% of %count%',
    'table.firstPage': 'First page',
    'table.previousPage': 'Previous page',
    'table.nextPage': 'Next page',
    'table.lastPage': 'Last page',
    'table.all': 'All',
  },
  ro: {
    'table.rowsPerPage': 'Rânduri pe pagină:',
    'table.displayedRows': '%from%–%to% din %count%',
    'table.firstPage': 'Prima pagină',
    'table.previousPage': 'Pagina anterioară',
    'table.nextPage': 'Pagina următoare',
    'table.lastPage': 'Ultima pagină',
    'table.all': 'Toate',
  },
  ar: {
    'table.rowsPerPage': 'الصفوف لكل صفحة:',
    'table.displayedRows': '%from%–%to% من %count%',
    'table.firstPage': 'الصفحة الأولى',
    'table.previousPage': 'الصفحة السابقة',
    'table.nextPage': 'الصفحة التالية',
    'table.lastPage': 'الصفحة الأخيرة',
    'table.all': 'الكل',
  },
};

const ANCHOR = "'table.rwaDelta':";

for (const [locale, entries] of Object.entries(KEYS)) {
  const file = `packages/showcase-kit/src/i18n/${locale}.ts`;
  const src = fs.readFileSync(file, 'utf8');
  if (src.includes("'table.rowsPerPage'")) {
    console.log(locale, 'already has the keys — skipped');
    continue;
  }
  const lines = src.split('\n');
  const at = lines.findIndex((l) => l.includes(ANCHOR));
  if (at === -1) throw new Error('anchor not found in ' + file);
  const block = Object.entries(entries).map(([k, v]) => `  '${k}': ${JSON.stringify(v)},`);
  lines.splice(at + 1, 0, ...block);
  fs.writeFileSync(file, lines.join('\n'));
  console.log(locale, '+' + block.length, 'keys');
}
