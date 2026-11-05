import { test, expect } from './coverage';

declare global {
  namespace JSX { interface IntrinsicElements { [elemName: string]: any } }
}

test.describe('md-ripple React host integration', () => {
  test('uses theme tokens, public trigger and release cleanup within a React surface', async ({ mount, page }) => {
    const surface = await mount(<button style={{ position: 'relative', width: 120, height: 60, padding: 0, border: 0 }}><md-ripple />Press</button>);
    const ripple = surface.locator('md-ripple');
    await expect(ripple).toHaveClass(/hydrated/);
    const wave = ripple.locator('.md-ripple__wave');
    await surface.evaluate((el: HTMLElement) => {
      el.style.setProperty('--md-ripple-opacity', '.25');
      el.style.setProperty('--md-ripple-extend-inline', '20px');
      el.style.setProperty('--md-ripple-extend-block', '10px');
      el.style.setProperty('--md-ripple-grow-duration', '80ms');
      el.style.setProperty('--md-ripple-grow-easing', 'linear');
    });
    const geometry = await ripple.evaluate(async (el: any) => {
      await el.trigger();
      const wave = el.shadowRoot.querySelector('.md-ripple__wave') as HTMLElement;
      const effect = wave.getAnimations()[0].effect as KeyframeEffect;
      return { width: parseFloat(wave.style.width), timing: effect.getTiming(), opacity: effect.getKeyframes()[0].opacity };
    });
    expect(geometry.width).toBeCloseTo(2 * Math.hypot(80, 40), 2);
    expect(geometry.timing.duration).toBe(80);
    expect(geometry.timing.easing).toBe('linear');
    expect(Number(geometry.opacity)).toBeCloseTo(.25);
    await expect(wave).toHaveCount(0);
    await surface.evaluate((el: HTMLElement) => {
      el.style.setProperty('--md-ripple-opacity', 'invalid');
      el.style.setProperty('--md-ripple-extend-inline', '-20px');
      el.style.setProperty('--md-ripple-extend-block', 'calc(1px + 2px)');
      el.style.setProperty('--md-ripple-grow-duration', 'invalid');
      el.style.removeProperty('--md-ripple-grow-easing');
    });
    await surface.hover();
    await page.mouse.down();
    await expect(wave).toHaveCount(1);
    const fallback = await wave.evaluate(el => ({ duration: el.getAnimations()[0].effect!.getTiming().duration, opacity: (el.getAnimations()[0].effect as KeyframeEffect).getKeyframes()[0].opacity }));
    expect(fallback.duration).toBe(450);
    expect(Number(fallback.opacity)).toBeCloseTo(.12);
    await page.mouse.up();
    await ripple.evaluate((el: any) => el.whenSettled());
    await expect(wave).toHaveCount(0);
    await ripple.evaluate((el: any) => el.whenSettled());
  });

  test('suppresses disabled and themed-off waves, then responds after enabling and reparenting', async ({ mount }) => {
    const fixture = await mount(<div><button id="old" style={{ position: 'relative', width: 100, height: 40 }}><span style={{ display: 'contents' }}><md-ripple disabled /></span>Old</button><button id="next" style={{ position: 'relative', width: 200, height: 80 }}>Next</button></div>);
    const ripple = fixture.locator('md-ripple');
    await expect(ripple).toHaveClass(/hydrated/);
    await fixture.locator('#old').click();
    await ripple.evaluate((el: any) => el.trigger());
    await expect(ripple.locator('.md-ripple__wave')).toHaveCount(0);
    await ripple.evaluate((el: any) => { el.disabled = false; el.style.setProperty('--md-sys-ripple-enabled', '0'); });
    await fixture.locator('#old').click();
    await ripple.evaluate((el: any) => el.trigger());
    await expect(ripple.locator('.md-ripple__wave')).toHaveCount(0);
    await ripple.evaluate((el: any) => { el.style.setProperty('--md-sys-ripple-enabled', '1'); document.querySelector('#next')!.append(el); });
    const size = await ripple.evaluate(async (el: any) => {
      await el.trigger();
      return parseFloat(el.shadowRoot.querySelector('.md-ripple__wave').style.width);
    });
    expect(size).toBeGreaterThan(200);
    await expect(ripple.locator('.md-ripple__wave')).toHaveCount(0);
    await fixture.locator('#old').click();
    await expect(ripple.locator('.md-ripple__wave')).toHaveCount(0);
    await fixture.unmount();
  });
});
