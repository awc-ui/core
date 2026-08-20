import { buildChartSummary, buildDataTableHtml } from './a11y';
describe('chart localization', () => {
  describe('locale-aware default formatting', () => {
    it('formats summary range numbers in the given locale', () => {
      const en = buildChartSummary({ chartType: 'line', seriesCount: 1, xMin: 1234.5, xMax: 9876.5, locale: 'en-US' });
      const de = buildChartSummary({ chartType: 'line', seriesCount: 1, xMin: 1234.5, xMax: 9876.5, locale: 'de-DE' });
      expect(en).toContain('1,234.5');
      expect(de).toContain('1.234,5');
    });

    it('formats table values in the given locale', () => {
      const html = buildDataTableHtml({
        xAxisData: ['a', 'b'],
        series: [{ label: 'S', data: [1234.5, 9876.5] }],
        locale: 'de-DE',
      });
      expect(html).toContain('1.234,5');
      expect(html).not.toContain('1,234.5');
    });

    it('leaves an explicit formatter alone — the consumer already decided', () => {
      const html = buildDataTableHtml({
        xAxisData: ['a'],
        series: [{ label: 'S', data: [1234.5] }],
        locale: 'de-DE',
        valueFormatter: (v) => `${v} units`,
      });
      expect(html).toContain('1234.5 units');
    });
  });

  describe('translatable strings', () => {
    it('takes translated chart-type and range wording', () => {
      const s = buildChartSummary({
        title: 'Umsatz',
        chartType: 'line',
        seriesCount: 2,
        xMin: 'Jan',
        xMax: 'Dez',
        labels: { line: 'Liniendiagramm', series: 'mit %count% Reihen', range: 'von %min% bis %max%' },
      });
      expect(s).toBe('Umsatz, Liniendiagramm, mit 2 Reihen, von Jan bis Dez.');
    });

    it('falls back to English for anything left unset', () => {
      const s = buildChartSummary({ chartType: 'area', seriesCount: 2, labels: { line: 'Liniendiagramm' } });
      expect(s).toBe('Area chart, with 2 series.');
    });

    it('takes translated table chrome, with %shown%/%total% substituted', () => {
      const html = buildDataTableHtml({
        xAxisData: Array.from({ length: 250 }, (_, i) => `d${i}`),
        series: [{ data: Array.from({ length: 250 }, () => 1) }],
        labels: { x: 'Datum', series: 'Reihe', truncated: 'Erste %shown% von %total% Zeilen.' },
      });
      expect(html).toContain('>Datum<');
      expect(html).toContain('>Reihe<');
      expect(html).toContain('Erste 200 von 250 Zeilen.');
    });

    it('uses the index header only when there is no x axis', () => {
      expect(buildDataTableHtml({ series: [{ data: [1] }], labels: { index: 'Nr.' } })).toContain('>Nr.<');
      expect(buildDataTableHtml({ xAxisData: ['a'], series: [{ data: [1] }], labels: { index: 'Nr.' } })).not.toContain('>Nr.<');
    });

    it('escapes translated strings like every other cell', () => {
      const html = buildDataTableHtml({ series: [{ data: [1] }], labels: { index: '<img src=x>' } });
      expect(html).not.toContain('<img');
      expect(html).toContain('&lt;img');
    });
  });
});
