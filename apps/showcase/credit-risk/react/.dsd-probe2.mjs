import { renderToString, serializeProperty } from '@awc-ui/core/hydrate';

const enc = (v) => String(serializeProperty(v)).replace(/'/g, '&#39;');
const series = [{ label: 'EAD', data: [10, 20, 30, 25] }];
const xAxis = { data: ['Q1', 'Q2', 'Q3', 'Q4'] };

const html = `<!DOCTYPE html><html><body>
<md-bar-chart series='${enc(series)}' x-axis='${enc(xAxis)}' label="Exposure" subtitle="By quarter" height="200px"></md-bar-chart>
<md-table-container><md-table><md-table-head><md-table-row><md-table-cell>Name</md-table-cell></md-table-row></md-table-head><md-table-body><md-table-row><md-table-cell>Acme</md-table-cell></md-table-row></md-table-body></md-table></md-table-container>
<md-chip variant="assist" label="Compliant" icon="check"></md-chip>
<md-meter value="42" max="100" label="Utilisation"></md-meter>
</body></html>`;

const { html: out } = await renderToString(html, {
  fullDocument: true,
  serializeShadowRoot: 'declarative-shadow-dom',
  removeScripts: false,
  removeHtmlComments: false,
});

const grab = (tag) => {
  const m = out.match(new RegExp(`<${tag}[\\s\\S]*?</${tag}>`));
  return m ? m[0] : '(not found)';
};

const chart = grab('md-bar-chart');
console.log('=== CHART ===');
console.log('canvas present:', chart.includes('<canvas'));
console.log('any <svg>:', chart.includes('<svg'));
// Does the plotted data appear as text anywhere (a11y table / aria)?
for (const probe of ['Q1', '30', 'Exposure', 'By quarter', 'aria-label', 'role=']) {
  console.log(`  contains ${JSON.stringify(probe)}:`, chart.includes(probe));
}
const aria = chart.match(/aria-label="[^"]{0,200}"/g);
console.log('  aria-labels:', aria ? aria.slice(0, 4) : 'none');

console.log('\n=== TABLE ===');
const table = grab('md-table-container');
console.log('  contains "Acme":', table.includes('Acme'));
console.log('  shadow root:', table.includes('shadowrootmode'));

console.log('\n=== CHIP ===');
const chip = grab('md-chip');
console.log('  contains "Compliant":', chip.includes('Compliant'));

console.log('\n=== METER ===');
const meter = grab('md-meter');
console.log('  contains "42" or "Utilisation":', meter.includes('42') || meter.includes('Utilisation'));
console.log('  shadow root:', meter.includes('shadowrootmode'));
