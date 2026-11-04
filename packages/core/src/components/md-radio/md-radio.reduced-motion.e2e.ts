import { newE2EPage } from '@stencil/core/testing';

describe('md-radio reduced motion', () => {
  // The stylesheet's REDUCED MOTION block removes the container, state-layer and circle transitions;
  // the pressed rule (more specific than the bare class) must not re-introduce the squish animation.
  const transition = `(() => getComputedStyle(document.querySelector('md-radio').shadowRoot.querySelector('.md-radio__container')).transitionDuration)()`;
  async function press(reduce: boolean) {
    const page = await newE2EPage();
    if (reduce) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.setContent('<md-radio name="g" value="a" aria-label="A" style="margin:40px"></md-radio>');
    const r = await page.evaluate(() => { const b = document.querySelector('md-radio')!.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
    await page.mouse.move(r.x, r.y); await page.mouse.down();
    await page.waitForFunction(() => document.querySelector('md-radio')!.classList.contains('md-radio--pressed'));
    const value = (await page.evaluate(transition)) as string;
    await page.mouse.up();
    return value;
  }
  it('does not animate the press squish', async () => {
    expect((await press(true)).split(', ').every((d) => d === '0s')).toBe(true);
  });
  it('keeps the press squish without reduced motion (guard)', async () => {
    expect((await press(false)).split(', ').some((d) => d !== '0s')).toBe(true);
  });
});
