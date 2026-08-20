import { newE2EPage, E2EPage } from '@stencil/core/testing';

/**
 * Real-browser coverage for md-meter: fill geometry (percentage of the track's
 * painted width), RTL anchoring, and theme-token resolution — none of which
 * jsdom can measure. The ARIA/formatting contract lives in the spec.
 */

/** Track + indicator rects as plain objects (page.evaluate can't return DOMRect). */
async function rects(page: E2EPage) {
  return page.evaluate(() => {
    const meter = document.querySelector('md-meter')!;
    const track = meter.shadowRoot!.querySelector('[part="track"]')!.getBoundingClientRect();
    const indicator = meter.shadowRoot!.querySelector('[part="indicator"]')!.getBoundingClientRect();
    return {
      track: { left: track.left, right: track.right, width: track.width },
      indicator: { left: indicator.left, right: indicator.right, width: indicator.width },
    };
  });
}

/** Let the 300ms fill transition finish before measuring. */
const settle = () => new Promise((r) => setTimeout(r, 450));

describe('md-meter (e2e)', () => {
  it('hydrates and paints the fill at the value percentage of the track', async () => {
    const page = await newE2EPage();
    await page.setContent(
      '<div style="width: 400px;"><md-meter value="25" label="Storage used"></md-meter></div>',
    );
    const el = await page.find('md-meter');
    expect(el).toHaveClass('hydrated');

    await settle();
    const { track, indicator } = await rects(page);
    expect(track.width).toBeGreaterThan(0);
    expect(indicator.width / track.width).toBeCloseTo(0.25, 1);
  });

  it('a value change re-paints the fill (transitioned, not jumped)', async () => {
    const page = await newE2EPage();
    await page.setContent(
      '<div style="width: 400px;"><md-meter value="25" label="Storage used"></md-meter></div>',
    );
    const el = await page.find('md-meter');
    await el.setProperty('value', 75);
    await page.waitForChanges();
    await settle();
    const { track, indicator } = await rects(page);
    expect(indicator.width / track.width).toBeCloseTo(0.75, 1);
  });

  it('RTL: the fill anchors to the RIGHT edge of the track', async () => {
    const page = await newE2EPage();
    await page.setContent(
      '<div dir="rtl" style="width: 400px;"><md-meter value="25" label="مساحة التخزين"></md-meter></div>',
    );
    await settle();
    const { track, indicator } = await rects(page);
    // inline-start in RTL is the right edge: the fill's right edge sits on the
    // track's right edge, and its left edge sits 25% of the width in from it.
    expect(Math.abs(indicator.right - track.right)).toBeLessThanOrEqual(1);
    expect(Math.abs(indicator.left - (track.right - track.width * 0.25))).toBeLessThanOrEqual(2);
  });

  it('announces the browser-locale percent as aria-valuetext', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-meter value="25" label="Storage used"></md-meter>');
    const expected = await page.evaluate(() =>
      new Intl.NumberFormat(undefined, { style: 'percent' }).format(0.25),
    );
    const el = await page.find('md-meter');
    expect(el.getAttribute('aria-valuetext')).toBe(expected);
    expect(el.getAttribute('role')).toBe('meter');
    expect(el.getAttribute('aria-valuenow')).toBe('25');
  });

  it('dark theme resolves different track/indicator token values (smoke)', async () => {
    // Self-contained token set (the e2e harness does not load tokens.css):
    // proves the shadow parts resolve --md-sys-* through the cascade and pick
    // up a [data-theme="dark"] re-declaration, exactly like the real tokens.
    const page = await newE2EPage();
    await page.setContent(
      `<style>
        :root {
          --md-sys-color-primary: rgb(10, 20, 30);
          --md-sys-color-secondary-container: rgb(40, 50, 60);
        }
        [data-theme='dark'] {
          --md-sys-color-primary: rgb(200, 210, 220);
          --md-sys-color-secondary-container: rgb(90, 100, 110);
        }
      </style>
      <div style="width: 400px;"><md-meter value="50" label="Quota"></md-meter></div>`,
    );
    const readColors = () =>
      page.evaluate(() => {
        const meter = document.querySelector('md-meter')!;
        const track = meter.shadowRoot!.querySelector('[part="track"]')!;
        const indicator = meter.shadowRoot!.querySelector('[part="indicator"]')!;
        return {
          track: getComputedStyle(track).backgroundColor,
          indicator: getComputedStyle(indicator).backgroundColor,
        };
      });

    const light = await readColors();
    expect(light.indicator).toBe('rgb(10, 20, 30)');
    expect(light.track).toBe('rgb(40, 50, 60)');

    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    await page.waitForChanges();
    const dark = await readColors();
    expect(dark.indicator).toBe('rgb(200, 210, 220)');
    expect(dark.track).toBe('rgb(90, 100, 110)');
  });
});
