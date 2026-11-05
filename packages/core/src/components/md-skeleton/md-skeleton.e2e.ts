import { newE2EPage } from '@stencil/core/testing';

describe('md-skeleton live motion preference', () => {
  it('responds to reduced-motion changes after mounting and can be removed safely', async () => {
    const page = await newE2EPage();
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
    await page.setContent('<md-skeleton animation="wave" lines="3" width="200px"></md-skeleton>');
    expect(await page.findAll('md-skeleton >>> [part~="line"]')).toHaveLength(3);
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.waitForFunction(() => document.querySelector('md-skeleton')?.classList.contains('md-skeleton--anim-none'));
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
    await page.waitForFunction(() => document.querySelector('md-skeleton')?.classList.contains('md-skeleton--anim-wave'));
    await page.$eval('md-skeleton', element => element.remove());
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    expect(await page.find('md-skeleton')).toBeNull();
    expect(page.getDiagnostics().filter(item => item.type === 'error' || item.type === 'pageerror')).toEqual([]);
  });
});
