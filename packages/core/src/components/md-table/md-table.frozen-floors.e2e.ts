import { newE2EPage } from '@stencil/core/testing';

// Gate 1 (native parity): in frozen-header mode the table floors each header
// track to its content (sort arrow, pin icon) by rewriting column-template as
// `minmax(<need>px, <base>)`. The readme documents minmax() tracks, but a
// minmax() base produced `minmax(Npx, minmax(a, b))` — invalid CSS — so the
// whole template was dropped and every cell collapsed into one 100%-wide column.
const sortHead = (cols: string[]) =>
  `<md-table-head><md-table-row>${cols.map((c, i) => `<md-table-cell head${i ? ' numeric' : ''}><md-table-sort-label column="${c}">${c}</md-table-sort-label></md-table-cell>`).join('')}</md-table-row></md-table-head>`;
const body = (n: number, cols: number) =>
  `<md-table-body>${Array.from({ length: n }, (_, r) => `<md-table-row>${Array.from({ length: cols }, (_, c) => `<md-table-cell${c ? ' numeric' : ''}>${c ? r * 10 + c : 'Row ' + r}</md-table-cell>`).join('')}</md-table-row>`).join('')}</md-table-body>`;
const markup = (template: string) => `<div style="inline-size:760px"><md-table frozen-header column-template="${template}" style="--md-table-body-max-h:200px">
  ${sortHead(['name', 'calories', 'fat'])}${body(8, 3)}</md-table></div>`;

const layout = (page: import('@stencil/core/testing').E2EPage) =>
  page.evaluate(async () => {
    for (let i = 0; i < 6; i++) await new Promise((r) => requestAnimationFrame(r));
    await new Promise((r) => setTimeout(r, 150));
    const t = document.querySelector('md-table')!;
    const bodyGrid = t.shadowRoot!.querySelector('.md-table__grid--body')!;
    const rect = (el: Element) => { const q = el.getBoundingClientRect(); return { x: Math.round(q.x), y: Math.round(q.y), w: Math.round(q.width) }; };
    return {
      template: t.getAttribute('column-template'),
      bodyTracks: getComputedStyle(bodyGrid).gridTemplateColumns.split(' ').length,
      head: Array.from(t.querySelectorAll('md-table-head md-table-cell')).map(rect),
      body: Array.from(t.querySelector('md-table-body md-table-row')!.querySelectorAll('md-table-cell')).map(rect),
    };
  });

describe('md-table frozen header content floors', () => {
  it('keeps minmax() column tracks valid when flooring sort-label headers', async () => {
    const page = await newE2EPage();
    await page.setContent(markup('minmax(180px, 2fr) minmax(96px, 1fr) minmax(96px, 1fr)'));
    const l = await layout(page);
    expect(l.bodyTracks).toBe(3);
    expect(new Set(l.head.map((c) => c.y)).size).toBe(1); // one header line
    expect(new Set(l.body.map((c) => c.y)).size).toBe(1); // one body line
    expect(l.head.map((c) => c.x)).toEqual(l.body.map((c) => c.x)); // header aligned with body
    expect(l.body[0].w).toBeGreaterThanOrEqual(180); // the author's minimum survives
  });

  it('keeps minmax() tracks valid after pinColumn in frozen mode', async () => {
    const page = await newE2EPage();
    await page.setContent(markup('minmax(180px, 2fr) minmax(96px, 1fr) minmax(96px, 1fr)'));
    await (await page.find('md-table')).callMethod('pinColumn', 2, 'start');
    const l = await layout(page);
    expect(l.bodyTracks).toBe(3);
    expect(new Set(l.head.map((c) => c.y)).size).toBe(1);
    expect(l.head.map((c) => c.x)).toEqual(l.body.map((c) => c.x));
  });

  it('keeps fit-content() tracks valid (left unfloored)', async () => {
    const page = await newE2EPage();
    await page.setContent(markup('fit-content(240px) 1fr 1fr'));
    const l = await layout(page);
    expect(l.bodyTracks).toBe(3);
    expect(new Set(l.head.map((c) => c.y)).size).toBe(1);
  });

  it('still floors plain tracks (guard)', async () => {
    const page = await newE2EPage();
    await page.setContent(markup('200px 1fr 1fr'));
    const l = await layout(page);
    expect(l.template).toMatch(/^minmax\(\d+px, 200px\) minmax\(\d+px, 1fr\) minmax\(\d+px, 1fr\)$/);
    expect(l.bodyTracks).toBe(3);
  });
});
