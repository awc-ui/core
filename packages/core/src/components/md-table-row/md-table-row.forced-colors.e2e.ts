import { newE2EPage, E2EPage } from '@stencil/core/testing';

// Gate 1 (native parity): in forced colours a selected row paints Highlight and
// casts HighlightText onto its cells, but under forced-color-adjust:auto the
// browser backplates every text run with Canvas — HighlightText on Canvas — and
// a pinned cell's opaque background is forced to Canvas too. Both left the
// selected row's text white-on-white (unreadable).
const markup = `<div style="inline-size:640px"><md-table selection="multiple" column-template="56px 200px 1fr" label="Desserts">
  <md-table-body>
    <md-table-row><md-table-cell padding="checkbox"><md-checkbox aria-label="a"></md-checkbox></md-table-cell><md-table-cell sticky="start">Frozen yogurt</md-table-cell><md-table-cell>Plain row text</md-table-cell></md-table-row>
    <md-table-row selected><md-table-cell padding="checkbox"><md-checkbox aria-label="b"></md-checkbox></md-table-cell><md-table-cell sticky="start">Ice cream sandwich</md-table-cell><md-table-cell>Selected row text</md-table-cell></md-table-row>
  </md-table-body></md-table></div>`;

async function forcedColors(page: E2EPage) {
  const p = page as any;
  const session = p.createCDPSession ? await p.createCDPSession() : await p.target().createCDPSession();
  await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value: 'active' }] });
}

/** Light/dark pixel fractions inside the text run of `selector` (trusted screenshot, decoded in the page). */
async function inkSplit(page: E2EPage, selector: string) {
  const rect = await page.evaluate((sel: string) => {
    const cell = document.querySelector(sel)!;
    const range = document.createRange();
    range.selectNodeContents(cell);
    const r = range.getBoundingClientRect();
    return { x: Math.floor(r.x), y: Math.floor(r.y), width: Math.ceil(r.width), height: Math.ceil(r.height) };
  }, selector);
  const b64 = (await (page as any).screenshot({ clip: rect, encoding: 'base64' })) as string;
  return page.evaluate(async (data: string) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + data;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const g = c.getContext('2d')!;
    g.drawImage(img, 0, 0);
    const px = g.getImageData(0, 0, c.width, c.height).data;
    let light = 0, dark = 0;
    for (let i = 0; i < px.length; i += 4) {
      const l = (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) / 255;
      if (l > 0.7) light++;
      else if (l < 0.3) dark++;
    }
    const n = px.length / 4;
    return { light: light / n, dark: dark / n };
  }, b64);
}

describe('md-table-row in forced colours', () => {
  it('keeps a selected row readable (plain and pinned cells)', async () => {
    const page = await newE2EPage();
    await forcedColors(page);
    await page.setContent(markup);
    await page.waitForChanges();
    await new Promise((r) => setTimeout(r, 200));
    for (const sel of ['md-table-row[selected] md-table-cell:nth-child(3)', 'md-table-row[selected] md-table-cell[sticky="start"]']) {
      const ink = await inkSplit(page, sel);
      // Readable text = glyphs in one tone over a background in the other.
      expect(ink.light).toBeGreaterThan(0.03);
      expect(ink.dark).toBeGreaterThan(0.03);
    }
  });

  it('leaves an unselected row readable (guard)', async () => {
    const page = await newE2EPage();
    await forcedColors(page);
    await page.setContent(markup);
    await page.waitForChanges();
    await new Promise((r) => setTimeout(r, 200));
    for (const sel of ['md-table-row:not([selected]) md-table-cell:nth-child(3)', 'md-table-row:not([selected]) md-table-cell[sticky="start"]']) {
      const ink = await inkSplit(page, sel);
      expect(ink.light).toBeGreaterThan(0.03);
      expect(ink.dark).toBeGreaterThan(0.03);
    }
  });
});
