/**
 * Gate-1 contract fix (2026-10-25): a reference area is a TINT of its colour in
 * every CSS colour syntax, not only #hex / comma rgb().
 */
import { newE2EPage } from '@stencil/core/testing';

/** RGBA of the canvas pixel inside the band (indices 2..4 of 8), above the flat line. */
async function bandPixel(color: string, area: Record<string, unknown>) {
  const page = await newE2EPage();
  await page.setContent(`<md-sparkline color="${color}" show-marks="none" no-animation height="100px" style="width:300px"></md-sparkline>`);
  const el = await page.find('md-sparkline');
  await el.setProperty('data', [5, 5, 5, 5, 5, 5, 5, 5]);
  await el.setProperty('referenceAreas', [{ from: 2, to: 4, ...area }]);
  await page.waitForChanges();
  await new Promise(r => setTimeout(r, 300));
  return page.evaluate(() => {
    const c = document.querySelector('md-sparkline')!.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const x = Math.round((3 / 7) * c.width), y = Math.round(0.15 * c.height);
    return Array.from(c.getContext('2d')!.getImageData(x, y, 1, 1).data);
  });
}

describe('md-sparkline reference-area tint', () => {
  it.each([
    ['#ff6347'],
    ['tomato'],
    ['hsl(9 100% 64%)'],
    ['rgb(255 99 71)'],
  ])('tints the band from a %s line colour at 12%%', async color => {
    const [r, g, b, a] = await bandPixel(color, {});
    expect(a).toBeGreaterThan(20);
    expect(a).toBeLessThan(45);
    expect([r, g, b]).toEqual([expect.any(Number), expect.any(Number), expect.any(Number)]);
    expect(r).toBeGreaterThan(230); // tomato, not black
    expect(g).toBeGreaterThan(80);
  });

  it.each([['#2e7d32'], ['rgb(46 125 50)'], ['hsl(123 46% 34%)'], ['green']])(
    'tints an explicit %s band colour at 18%%',
    async bandColor => {
      const [, g, , a] = await bandPixel('#6750A4', { color: bandColor });
      expect(a).toBeGreaterThan(35);
      expect(a).toBeLessThan(60);
      expect(g).toBeGreaterThan(100); // green, not black
    },
  );

  it('keeps the alpha an author gave the band colour', async () => {
    const [, , b, a] = await bandPixel('#6750A4', { color: 'rgba(0, 0, 255, 0.5)' });
    expect(b).toBeGreaterThan(200);
    expect(a).toBeGreaterThan(115);
    expect(a).toBeLessThan(140);
  });
});
