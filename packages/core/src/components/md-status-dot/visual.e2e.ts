import { newE2EPage, E2EPage } from '@stencil/core/testing';

/**
 * Measurement coverage for md-status-dot — the things jsdom specs can't see:
 * the live-pulse animation and its reduced-motion gating, the rendered
 * diameters per size preset, and the logical-property anchor flipping in RTL.
 * Measure-first: we read the real computed values, not assumptions.
 */
describe('md-status-dot · live pulse + reduced motion', () => {
  async function animName(page: E2EPage) {
    return page.evaluate(
      () => getComputedStyle(document.getElementById('d')!).animationName,
    );
  }

  it('pulses (animation runs) when live + prefers-reduced-motion: no-preference', async () => {
    const page = await newE2EPage();
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
    await page.setContent(`<md-status-dot id="d" state="online" live></md-status-dot>`);
    await page.waitForChanges();
    expect(await animName(page)).toBe('md-status-dot-pulse');
  }, 60000);

  it('does NOT animate when prefers-reduced-motion: reduce', async () => {
    const page = await newE2EPage();
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.setContent(`<md-status-dot id="d" state="online" live></md-status-dot>`);
    await page.waitForChanges();
    expect(await animName(page)).toBe('none');
  }, 60000);

  it('does NOT animate when not live, even with motion allowed', async () => {
    const page = await newE2EPage();
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
    await page.setContent(`<md-status-dot id="d" state="online"></md-status-dot>`);
    await page.waitForChanges();
    expect(await animName(page)).toBe('none');
  }, 60000);
});

describe('md-status-dot · size presets', () => {
  async function diameter(size: string, extraStyle = '') {
    const page = await newE2EPage();
    await page.setContent(`<md-status-dot id="d" size="${size}" style="${extraStyle}"></md-status-dot>`);
    await page.waitForChanges();
    return page.evaluate(() => {
      const r = document.getElementById('d')!.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height) };
    });
  }

  it('small = 8px, medium = 12px, large = 16px', async () => {
    expect(await diameter('small')).toEqual({ w: 8, h: 8 });
    expect(await diameter('medium')).toEqual({ w: 12, h: 12 });
    expect(await diameter('large')).toEqual({ w: 16, h: 16 });
  }, 60000);

  it('--md-status-dot-size overrides the preset', async () => {
    expect(await diameter('medium', '--md-status-dot-size: 24px;')).toEqual({ w: 24, h: 24 });
  }, 60000);
});

describe('md-status-dot · anchoring (logical-property RTL flip)', () => {
  async function offsets(dir: 'ltr' | 'rtl') {
    const page = await newE2EPage();
    await page.setContent(
      `<div dir="${dir}" id="box"
            style="position:relative;inline-size:40px;block-size:40px;background:#ccc;">
         <md-status-dot id="d" state="online"></md-status-dot>
       </div>`,
    );
    await page.waitForChanges();
    return page.evaluate(() => {
      const box = document.getElementById('box')!.getBoundingClientRect();
      const dot = document.getElementById('d')!.getBoundingClientRect();
      return {
        dotLeftMinusBoxLeft: Math.round(dot.left - box.left),
        dotRightMinusBoxRight: Math.round(dot.right - box.right),
      };
    });
  }

  it('LTR: anchors to the inline-end (right) edge, ~2px outside', async () => {
    const r = await offsets('ltr');
    expect(r.dotRightMinusBoxRight).toBeGreaterThanOrEqual(1); // pip kisses the right edge, slightly outside
    expect(r.dotLeftMinusBoxLeft).toBeGreaterThan(20); // sits on the right half, not the left
  }, 60000);

  it('RTL: anchor flips to the inline-end = left edge', async () => {
    const r = await offsets('rtl');
    expect(r.dotLeftMinusBoxLeft).toBeLessThanOrEqual(-1); // now ~2px outside the LEFT edge
    expect(r.dotRightMinusBoxRight).toBeLessThan(-20); // sits on the left half
  }, 60000);
});

describe('md-status-dot · state colors', () => {
  async function bg(state: string) {
    const page = await newE2EPage();
    // The host transitions background-color over 200ms on state changes, and
    // that transition also runs transparent -> state color on first upgrade.
    // Sampling getComputedStyle mid-transition returns an interpolated rgba
    // (this test once caught rgba(45, 198, 83, 0.92) — 92% through), so kill
    // the transition for the assertion: document-level styles on the host
    // element outrank :host rules, making the read deterministic.
    await page.setContent(
      `<style>md-status-dot { transition: none !important; }</style>` +
        `<md-status-dot id="d" state="${state}"></md-status-dot>`,
    );
    await page.waitForChanges();
    return page.evaluate(() => getComputedStyle(document.getElementById('d')!).backgroundColor);
  }

  it('online is green, busy is red — visibly distinct fills', async () => {
    const online = await bg('online'); // rgb(45, 198, 83)
    const busy = await bg('busy'); // rgb(219, 68, 55)
    expect(online).not.toBe(busy);
    expect(online).toBe('rgb(45, 198, 83)');
    expect(busy).toBe('rgb(219, 68, 55)');
  }, 60000);
});
