import { newE2EPage } from '@stencil/core/testing';

describe('md-fab reduced motion', () => {
  // The REDUCED MOTION block removes every transition of the extend/collapse morph and the menu-icon cross-fade: the host's
  // min-width/padding, the label's max-inline-size/margin/opacity and the icon's opacity/transform.
  const durations = `(() => { const f = document.querySelector('md-fab'); const r = f.shadowRoot;
    return [getComputedStyle(f), getComputedStyle(r.querySelector('.md-fab__label')), getComputedStyle(r.querySelector('.md-fab__icon'))]
      .map((s) => s.transitionDuration).join(', '); })()`;
  async function read(reduce: boolean) {
    const page = await newE2EPage();
    if (reduce) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.setContent('<md-fab icon="add" label="Create" extended></md-fab>');
    await page.waitForChanges();
    return ((await page.evaluate(durations)) as string).split(', ');
  }
  it('does not animate the extend/collapse morph or the icon cross-fade', async () => {
    expect((await read(true)).every((d) => d === '0s')).toBe(true);
  });
  it('keeps the morph without reduced motion (guard)', async () => {
    expect((await read(false)).some((d) => d !== '0s')).toBe(true);
  });
});
