import { newE2EPage } from '@stencil/core/testing';

describe('md-loading-indicator browser behavior', () => {
  it('updates the accessible loading message without claiming determinate progress', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-loading-indicator label="Loading account"></md-loading-indicator>');
    const indicator = await page.find('md-loading-indicator');
    expect(indicator.getAttribute('role')).toBe('progressbar');
    expect(indicator.getAttribute('aria-label')).toBe('Loading account');
    expect(indicator.getAttribute('aria-valuenow')).toBeNull();
    await indicator.setProperty('label', 'Saving changes');
    await page.waitForChanges();
    expect(indicator.getAttribute('aria-label')).toBe('Saving changes');
    expect((await page.find('md-loading-indicator >>> [role="status"]')).textContent).toBe('Saving changes');
    expect((await page.find('md-loading-indicator >>> [part="shape"]')).getAttribute('aria-hidden')).toBe('true');
  });

  it('scales the painted shape with the requested size and resolves contained colors', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-loading-indicator variant="contained" style="--md-loading-indicator-size: 80px; --md-loading-indicator-color: rgb(10, 20, 30); --md-loading-indicator-container-color: rgb(40, 50, 60)"></md-loading-indicator>');
    const dimensions = await page.evaluate(() => {
      const host = document.querySelector('md-loading-indicator')!;
      const shape = host.shadowRoot!.querySelector('[part="shape"]')!;
      return { host: host.getBoundingClientRect().width, shape: parseFloat(getComputedStyle(shape).width), color: getComputedStyle(shape).backgroundColor, background: getComputedStyle(host).backgroundColor };
    });
    expect(dimensions.host).toBe(80);
    expect(dimensions.shape).toBeCloseTo(80 * 0.792, 1);
    expect(dimensions.color).toBe('rgb(10, 20, 30)');
    expect(dimensions.background).toBe('rgb(40, 50, 60)');
  });

  it('replaces rotation and shape morphing with an opacity pulse for reduced motion', async () => {
    const page = await newE2EPage();
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.setContent('<md-loading-indicator></md-loading-indicator>');
    const animation = await page.evaluate(() => {
      const style = getComputedStyle(document.querySelector('md-loading-indicator')!.shadowRoot!.querySelector('[part="shape"]')!);
      return { name: style.animationName, clip: style.clipPath, transform: style.transform };
    });
    expect(animation).toEqual({ name: 'md-loading-pulse', clip: 'none', transform: 'none' });
  });

  it('applies compact density and removes the indicator from layout when hidden', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-loading-indicator density="-4"></md-loading-indicator>');
    expect(await page.evaluate(() => document.querySelector('md-loading-indicator')!.getBoundingClientRect().width)).toBe(32);
    const indicator = await page.find('md-loading-indicator');
    await indicator.setProperty('hidden', true);
    await page.waitForChanges();
    expect(await page.evaluate(() => document.querySelector('md-loading-indicator')!.getBoundingClientRect().width)).toBe(0);
  });
});
