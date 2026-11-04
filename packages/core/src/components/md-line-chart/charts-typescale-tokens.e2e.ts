/**
 * Chart text sizes come from the MD3 typescale: tick and axis labels from
 * label-small, titles from title-small. Themes set the real token names
 * (`--md-sys-typescale-*-font-size`), so a themed size must reach the canvas.
 * The older chart-only names (`--md-sys-typescale-label-small-size`,
 * `-title-small-size`) keep working and win when both are set.
 */
import { newE2EPage } from '@stencil/core/testing';

// One fresh page per measurement: setContent twice on one E2EPage trips its request interception.
async function sizes(tag: string, style: string) {
  const page = await newE2EPage();
  await page.setContent(`<${tag} no-animation animation="none" label="Revenue" legend="none" style="display:block;width:640px;height:360px;--md-sys-density-scale:0;${style}"></${tag}>`);
  const chart = await page.find(tag);
  await chart.setProperty('series', [{ label: 'Revenue', data: [10, 20, 30, 40] }]);
  await chart.setProperty('xAxis', { data: ['Q1', 'Q2', 'Q3', 'Q4'] });
  await page.waitForChanges();
  return page.evaluate(async (t: string) => {
    const scene = (await (document.querySelector(t) as any).getInstance()).getScene();
    const items = scene.texts as { text: string; fontSize: number }[];
    return { tick: items.find(x => x.text === 'Q2')?.fontSize, title: items.find(x => x.text === 'Revenue')?.fontSize };
  }, tag);
}

describe.each(['md-line-chart', 'md-area-chart', 'md-bar-chart'])('%s typescale tokens', tag => {
  it('takes tick and title sizes from the MD3 typescale font-size tokens', async () => {
    expect(await sizes(tag, '')).toEqual({ tick: 11, title: 14 });
    expect(await sizes(tag, '--md-sys-typescale-label-small-font-size:16px;--md-sys-typescale-title-small-font-size:20px')).toEqual({ tick: 16, title: 20 });
  });

  it('keeps the legacy chart-only size names, which win over the typescale tokens', async () => {
    expect(await sizes(tag, '--md-sys-typescale-label-small-font-size:16px;--md-sys-typescale-label-small-size:13px;--md-sys-typescale-title-small-font-size:20px;--md-sys-typescale-title-small-size:18px')).toEqual({ tick: 13, title: 18 });
  });
});
