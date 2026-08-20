import { newE2EPage } from '@stencil/core/testing';

describe('md-skeleton responsive sizing', () => {
  it('full-height circular is a square that does not overflow / overlap siblings', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <div style="display:flex; gap:12px; height:140px; width:480px;">
        <md-skeleton id="circ" variant="circular" full-height></md-skeleton>
        <md-skeleton id="mid" variant="rounded" full-width full-height style="flex:1;"></md-skeleton>
        <md-skeleton id="end" variant="rounded" full-height width="80px"></md-skeleton>
      </div>
    `);
    await page.waitForChanges();
    // Let the mount "bloom" scale-in (500ms) settle so bounding boxes are at 1×.
    await new Promise((res) => setTimeout(res, 650));

    const r = await page.evaluate(() => {
      const box = (id: string) => {
        const b = document.getElementById(id)!.getBoundingClientRect();
        return { left: Math.round(b.left), right: Math.round(b.right), w: Math.round(b.width), h: Math.round(b.height) };
      };
      return { circ: box('circ'), mid: box('mid'), end: box('end') };
    });

    // The circular host fills the row height and is square (w ≈ h).
    expect(r.circ.h).toBe(140);
    expect(Math.abs(r.circ.w - r.circ.h)).toBeLessThanOrEqual(2);
    // It must not overflow into the middle shape (its right edge is left of mid).
    expect(r.circ.right).toBeLessThanOrEqual(r.mid.left);
    // The middle full-width shape and the fixed-width end shape also fill height.
    expect(r.mid.h).toBe(140);
    expect(r.end.h).toBe(140);
    expect(r.end.w).toBe(80);
  }, 60000);

  it('full-height does not collapse to 0 in an indefinite-height parent', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <div id="noheight" style="width:300px;">
        <md-skeleton variant="rounded" full-height></md-skeleton>
      </div>
      <div id="withheight" style="width:300px; height:150px;">
        <md-skeleton variant="rounded" full-height></md-skeleton>
      </div>
    `);
    await page.waitForChanges();
    await new Promise((r) => setTimeout(r, 650));
    const r = await page.evaluate(() => {
      const h = (sel: string) =>
        Math.round(document.querySelector(sel)!.getBoundingClientRect().height);
      return { noHeight: h('#noheight md-skeleton'), withHeight: h('#withheight md-skeleton') };
    });
    // Indefinite parent → falls back to the variant default (120px), not 0.
    expect(r.noHeight).toBe(120);
    // Definite parent → fills it.
    expect(r.withHeight).toBe(150);
  }, 60000);
});
