/**
 * Does a chart pick up `series` from an ATTRIBUTE during server render?
 * The Astro build depends on it — there is no client instance to assign to.
 */
import { renderToString, serializeProperty } from '@awc-ui/core/hydrate';

const series = [{ label: 'EAD', data: [10, 20, 30, 25] }];
const xAxis = { data: ['Q1', 'Q2', 'Q3', 'Q4'] };

const encoded = serializeProperty(series);
console.log('serializeProperty(series) =', String(encoded).slice(0, 120));
console.log('typeof =', typeof encoded);

const html = `<!DOCTYPE html><html><body>
<md-bar-chart series='${String(encoded).replace(/'/g, '&#39;')}' x-axis='${String(serializeProperty(xAxis)).replace(/'/g, '&#39;')}' label="Test" height="200px"></md-bar-chart>
</body></html>`;

const { html: out, diagnostics } = await renderToString(html, {
  fullDocument: true,
  serializeShadowRoot: 'declarative-shadow-dom',
  removeScripts: false,
  removeHtmlComments: false,
});

console.log('\ndiagnostics:', diagnostics.length ? diagnostics.map((d) => d.messageText) : 'none');
const hasShadow = out.includes('shadowrootmode');
console.log('declarative shadow root emitted:', hasShadow);

// Did anything chart-like actually render inside?
const m = out.match(/<md-bar-chart[\s\S]*?<\/md-bar-chart>/);
const inner = m ? m[0] : '';
console.log('rendered length:', inner.length);
console.log('contains <canvas>:', inner.includes('<canvas'));
console.log('contains the label "Test":', inner.includes('Test'));
console.log('\n--- first 900 chars of the element ---');
console.log(inner.slice(0, 900));
