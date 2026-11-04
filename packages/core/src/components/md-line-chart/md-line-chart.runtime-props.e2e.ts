/**
 * Runtime property changes must reach the canvas engine, not only the next
 * unrelated re-apply. `locale` formats the tick labels and the data table;
 * `no-animation` decides whether a replayed entrance plays. md-bar-chart has
 * always re-applied for both, so it is the control.
 */
import { newE2EPage, type E2EPage } from '@stencil/core/testing';

const series = [{ id: 'rev', label: 'Revenue', data: [1000, 2000, 3000, 4000, 5000, 6000] }];
const xAxis = { data: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'] };

async function mount(tag: string, attrs = 'no-animation animation="none"') {
  const page = await newE2EPage();
  await page.setContent(`<${tag} ${attrs} label="Revenue" style="display:block;width:640px;height:360px"></${tag}>`);
  const chart = await page.find(tag);
  await chart.setProperty('series', series);
  await chart.setProperty('xAxis', xAxis);
  await page.waitForChanges();
  return { page, chart };
}
const texts = (page: E2EPage, tag: string) =>
  page.evaluate(async (t: string) => ((await (document.querySelector(t) as any).getInstance()).getScene().texts as { text: string }[]).map(x => x.text), tag);
const table = async (page: E2EPage, tag: string) => (await page.find(`${tag} >>> table`)).textContent;

/** Replay the entrance with reduced motion OFF and report the lowest canvas opacity seen. */
async function replayFade(page: E2EPage, tag: string): Promise<number> {
  return page.evaluate(async (t: string) => {
    const host = document.querySelector(t) as any;
    const real = window.matchMedia.bind(window);
    window.matchMedia = ((q: string) => q.includes('reduced-motion')
      ? { matches: false, media: q, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent() { return false; } }
      : real(q)) as typeof window.matchMedia;
    const canvas = host.shadowRoot.querySelector('canvas') as HTMLCanvasElement;
    await host.replay();
    let min = 1; const t0 = performance.now();
    await new Promise<void>(res => { const tick = () => { min = Math.min(min, parseFloat(getComputedStyle(canvas).opacity || '1')); if (performance.now() - t0 < 500) requestAnimationFrame(tick); else res(); }; requestAnimationFrame(tick); });
    return min;
  }, tag);
}

describe.each(['md-line-chart', 'md-area-chart', 'md-bar-chart'])('%s runtime properties', tag => {
  it('reformats canvas tick labels and the data table when locale changes after mount', async () => {
    const { page, chart } = await mount(tag);
    expect(await texts(page, tag)).toContain('2,000');
    await chart.setProperty('locale', 'de-DE');
    await page.waitForChanges();
    const after = await texts(page, tag);
    expect(after).toContain('2.000');
    expect(after).not.toContain('2,000');
    expect(await table(page, tag)).toContain('2.000');
  });

  it('honours no-animation set after mount for the next replayed entrance', async () => {
    const { page, chart } = await mount(tag, 'animation="fade"');
    await chart.setProperty('noAnimation', true);
    await page.waitForChanges();
    expect(await replayFade(page, tag)).toBe(1);
  });
});
