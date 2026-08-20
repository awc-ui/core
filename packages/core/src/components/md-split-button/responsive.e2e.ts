import { newE2EPage } from '@stencil/core/testing';

/**
 * Responsiveness for md-split-button. By default it is `inline-flex` and sized
 * to its content. With `full-width` it stretches to fill its container; the
 * leading segment grows and its label truncates with an ellipsis rather than
 * overflowing — so a long label in a narrow container never breaks the layout.
 */
describe('md-split-button responsive (full-width)', () => {
  async function geom(width: number, attrs: string, label: string) {
    const page = await newE2EPage();
    await page.setContent(
      `<div id="box" style="inline-size:${width}px">
         <md-split-button id="sb" ${attrs} label="${label}"></md-split-button>
       </div>`,
    );
    await page.waitForChanges();
    return page.evaluate(() => {
      const box = document.getElementById('box')!.getBoundingClientRect();
      const host = document.getElementById('sb')!;
      const hostRect = host.getBoundingClientRect();
      const root = host.shadowRoot!;
      const leading = root.querySelector('.md-split-button__leading') as HTMLElement;
      const trailing = root.querySelector('.md-split-button__trailing') as HTMLElement;
      const labelEl = root.querySelector('.md-split-button__label') as HTMLElement | null;
      return {
        boxW: Math.round(box.width),
        hostW: Math.round(hostRect.width),
        hostRight: Math.round(hostRect.right),
        boxRight: Math.round(box.right),
        leadingW: Math.round(leading.getBoundingClientRect().width),
        trailingW: Math.round(trailing.getBoundingClientRect().width),
        labelScroll: labelEl ? labelEl.scrollWidth : 0,
        labelClient: labelEl ? labelEl.clientWidth : 0,
        docScrollW: document.documentElement.scrollWidth,
        vw: window.innerWidth,
      };
    });
  }

  it('default (no full-width) is content-sized, narrower than its container', async () => {
    const r = await geom(600, '', 'Save');
    expect(r.hostW).toBeLessThan(r.boxW); // shrinks to content, not the 600px box
  }, 60000);

  it('full-width fills the container; the trailing toggle keeps its width', async () => {
    const r = await geom(600, 'full-width', 'Save');
    // host spans essentially the whole 600px box (allow rounding / borders)
    expect(r.hostW).toBeGreaterThanOrEqual(r.boxW - 2);
    expect(r.hostRight).toBeLessThanOrEqual(r.boxRight + 1);
    // leading absorbs the free space; trailing stays compact (icon-only)
    expect(r.leadingW).toBeGreaterThan(r.trailingW * 3);
  }, 60000);

  it('a long label truncates instead of overflowing the container', async () => {
    const long = 'Save and continue to the next step right away please now';
    const r = await geom(260, 'full-width', long);
    // label is clipped (content wider than its box) → ellipsis, not overflow
    expect(r.labelScroll).toBeGreaterThan(r.labelClient);
    // and nothing spills past the container / viewport
    expect(r.hostW).toBeLessThanOrEqual(r.boxW + 1);
    expect(r.docScrollW).toBeLessThanOrEqual(r.vw + 1);
  }, 60000);

  // Mirrors the Storybook "Full Width (Responsive)" story exactly: a 240px padded
  // box nested inside a max-width:420px column flex. Guards that the nesting
  // doesn't let the box grow to its content and defeat truncation.
  it('truncates inside a nested column-flex + padded box (story markup)', async () => {
    const page = await newE2EPage();
    await page.setContent(
      `<div style="max-width:420px; display:flex; flex-direction:column; gap:16px;">
         <div id="box" style="inline-size:240px; padding:8px; box-sizing:border-box;">
           <md-split-button id="sb" full-width icon="description"
             label="Save and continue to the next step" variant="outlined"></md-split-button>
         </div>
       </div>`,
    );
    await page.waitForChanges();
    const r = await page.evaluate(() => {
      const box = document.getElementById('box')!.getBoundingClientRect();
      const host = document.getElementById('sb')!.getBoundingClientRect();
      const label = document
        .getElementById('sb')!
        .shadowRoot!.querySelector('.md-split-button__label') as HTMLElement;
      return {
        boxW: Math.round(box.width),
        hostW: Math.round(host.width),
        labelScroll: label.scrollWidth,
        labelClient: label.clientWidth,
        docScrollW: document.documentElement.scrollWidth,
        vw: window.innerWidth,
      };
    });
    expect(r.boxW).toBe(240); // box did NOT grow to its content
    expect(r.hostW).toBeLessThanOrEqual(224 + 1); // host fits inside the padding
    expect(r.labelScroll).toBeGreaterThan(r.labelClient); // label truncated
    expect(r.docScrollW).toBeLessThanOrEqual(r.vw + 1); // no page overflow
  }, 60000);
});
