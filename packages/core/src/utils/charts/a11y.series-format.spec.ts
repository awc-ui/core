import { buildDataTableHtml } from './a11y';

/**
 * A table whose columns are not all the same kind of number — a pie's value
 * next to its share — needs a formatter per column. One `valueFormatter` for
 * every cell printed a share through a currency formatter ("$75.00").
 */
describe('buildDataTableHtml — per-series format', () => {
  const cells = (html: string) =>
    [...html.matchAll(/<td>([^<]*)<\/td>/g)].map((m) => m[1]);

  it('formats a series with its own `format`, and the rest with valueFormatter', () => {
    const html = buildDataTableHtml({
      xAxisData: ['A', 'B'],
      series: [
        { label: 'Value', data: [1500, 500] },
        { label: 'Share', data: [75, 25], format: (v) => (v == null ? '—' : `${v}%`) },
      ],
      valueFormatter: (v) => (v == null ? '—' : `$${v.toFixed(2)}`),
    });
    expect(cells(html)).toEqual(['$1500.00', '75%', '$500.00', '25%']);
  });

  it('routes a gap in a formatted series through its own format', () => {
    const html = buildDataTableHtml({
      series: [{ data: [null, 2], format: (v) => (v == null ? 'n/a' : `#${v}`) }],
    });
    expect(cells(html)).toEqual(['n/a', '#2']);
  });

  it('formats both ends of a band with the series format', () => {
    const html = buildDataTableHtml({
      series: [{ data: [], range: [[1, 3]], format: (v) => (v == null ? '—' : `${v}u`) }],
    });
    expect(cells(html)).toEqual(['1u–3u']);
  });

  it('escapes what a series format returns', () => {
    const html = buildDataTableHtml({ series: [{ data: [1], format: () => '<b>x</b>' }] });
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;');
  });
});
