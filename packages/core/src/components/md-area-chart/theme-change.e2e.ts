import { newE2EPage } from '@stencil/core/testing';

/**
 * Charts are canvas: pixels, not CSS. Nothing retints them when the design
 * tokens change underneath.
 *
 * The reported defect: componentDidLoad wired only
 * `matchMedia('(prefers-color-scheme: dark)')`, so an OS dark-mode flip
 * repainted but every in-page theme change did not — a `data-theme` toggle,
 * or a seed/accent palette written as `--md-sys-color-*` overrides by
 * @awc-ui/theme at runtime, left the canvas in the previous palette while the
 * DOM around it retinted. Measured then as: primary went #6750a4 -> #01629E
 * and the canvas bytes did not change.
 *
 * These tests assert on the rendered pixels via toDataURL(), which is the
 * only thing that actually proves a repaint happened. Custom properties
 * cannot be tested in jsdom — getComputedStyle there does not resolve them
 * at all — so this lives in e2e by necessity, not preference.
 */
describe('md-area-chart · theme changes repaint the canvas', () => {
  const MARKUP = `
    <div id="wrap">
      <md-area-chart id="c" label="Errors" height="200px" style="inline-size: 320px;"></md-area-chart>
    </div>`;

  const seed = async (page: import('@stencil/core/testing').E2EPage) => {
    await page.evaluate(() => {
      const c = document.getElementById('c') as HTMLElement & {
        series: unknown;
        xAxis: unknown;
      };
      c.series = [{ name: '4xx', data: [10, 12, 9, 14, 11, 13] }];
      c.xAxis = { data: ['00', '04', '08', '12', '16', '20'] };
    });
    await page.waitForChanges();
    await new Promise(r => setTimeout(r, 700));
  };

  const snapshot = (page: import('@stencil/core/testing').E2EPage) =>
    page.evaluate(async () => {
      const c = document.getElementById('c') as HTMLElement & {
        toDataURL: () => Promise<string>;
      };
      return c.toDataURL();
    });

  it('repaints when a token is overridden at runtime on an ancestor', async () => {
    const page = await newE2EPage();
    await page.setContent(MARKUP);
    await seed(page);

    const before = await snapshot(page);
    expect(before.length).toBeGreaterThan(100); // the chart really drew something

    await page.evaluate(() => {
      document.getElementById('wrap')!.style.setProperty('--md-sys-color-primary', '#01629E');
    });
    await page.waitForChanges();
    await new Promise(r => setTimeout(r, 700));

    const after = await snapshot(page);
    expect(after).not.toBe(before);
  }, 60000);

  it('repaints when data-theme flips on the document element', async () => {
    const page = await newE2EPage();
    await page.setContent(
      `<style>[data-theme="dark"] { --md-sys-color-primary: #D0BCFF; --md-sys-color-on-surface: #E6E1E5; }</style>` +
        MARKUP,
    );
    await seed(page);

    const before = await snapshot(page);
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    await page.waitForChanges();
    await new Promise(r => setTimeout(r, 700));

    expect(await snapshot(page)).not.toBe(before);
  }, 60000);

  it('leaves the canvas alone when unrelated attributes churn', async () => {
    const page = await newE2EPage();
    await page.setContent(MARKUP);
    await seed(page);

    const before = await snapshot(page);
    await page.evaluate(() => {
      const w = document.getElementById('wrap')!;
      w.classList.add('is-hovered');
      w.classList.remove('is-hovered');
      w.setAttribute('data-unrelated', '1');
    });
    await page.waitForChanges();
    await new Promise(r => setTimeout(r, 400));

    expect(await snapshot(page)).toBe(before);
  }, 60000);

  it('refreshTheme() repaints on demand', async () => {
    const page = await newE2EPage();
    await page.setContent(MARKUP);
    await seed(page);

    const before = await snapshot(page);
    // Inject tokens through a stylesheet — the case the observer cannot see,
    // which is exactly why the public method exists.
    await page.evaluate(async () => {
      const s = document.createElement('style');
      s.textContent = ':root { --md-sys-color-primary: #B3261E; }';
      document.head.appendChild(s);
      const c = document.getElementById('c') as HTMLElement & {
        refreshTheme: () => Promise<void>;
      };
      await c.refreshTheme();
    });
    await page.waitForChanges();
    await new Promise(r => setTimeout(r, 700));

    expect(await snapshot(page)).not.toBe(before);
  }, 60000);
});
