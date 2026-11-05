import { newE2EPage } from '@stencil/core/testing';

describe('md-progress-indicator browser progress lifecycle', () => {
  it.each([
    ['linear', false], ['linear', true], ['circular', false], ['circular', true],
  ] as const)('updates and completes %s wave=%s using its actual animation lifecycle', async (variant, wave) => {
    const page = await newE2EPage();
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
    await page.setContent(`<div style="width:320px" dir="rtl"><md-progress-indicator variant="${variant}" ${wave ? 'wave' : ''} value="0" label="Upload" size="72" thickness="6" wave-amplitude="3" wave-length="40" wave-speed="2"></md-progress-indicator></div>`);
    const indicator = await page.find('md-progress-indicator');
    const complete = await indicator.spyOnEvent('mdComplete');
    await page.$eval('md-progress-indicator', (el: HTMLElement) => el.addEventListener('mdComplete', () => { el.dataset.completed = 'true'; }, { once: true }));
    for (const value of [3, 45, 96, 100, 60]) {
      indicator.setProperty('value', value);
      await page.waitForChanges();
      expect(indicator.getAttribute('aria-valuenow')).toBe(String(value));
      // Allow the real rAF path to respond to each transition (including the
      // near-zero/near-full wave taper), then check for invalid geometry.
      await new Promise(resolve => setTimeout(resolve, 160));
      const paths = await page.$eval('md-progress-indicator', el => Array.from(el.shadowRoot!.querySelectorAll('path')).map(path => path.getAttribute('d') || ''));
      expect(paths.every(path => !/NaN|Infinity/.test(path))).toBe(true);
    }
    indicator.setProperty('complete', true);
    await page.waitForChanges();
    await page.waitForFunction(() => (document.querySelector('md-progress-indicator') as HTMLElement).dataset.completed === 'true', { timeout: 6000 });
    expect(complete).toHaveReceivedEventTimes(1);
    indicator.setProperty('complete', false);
    await page.waitForChanges();
    indicator.setProperty('complete', true);
    await page.waitForChanges();
    expect(complete).toHaveReceivedEventTimes(1);
    await page.$eval('md-progress-indicator', el => el.remove());
    expect(page.getDiagnostics().filter(item => item.type === 'error' || item.type === 'pageerror')).toEqual([]);
  });

  it.each(['linear', 'circular'])('changes %s indeterminate mode and live reduced-motion preferences', async variant => {
    const page = await newE2EPage();
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
    await page.setContent(`<div style="width:320px"><md-progress-indicator variant="${variant}" wave indeterminate four-color label="Waiting"></md-progress-indicator></div>`);
    const indicator = await page.find('md-progress-indicator');
    expect(indicator.getAttribute('aria-valuenow')).toBeNull();
    await new Promise(resolve => setTimeout(resolve, 300));
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.waitForChanges();
    indicator.setProperty('indeterminate', false);
    indicator.setProperty('value', 40);
    indicator.setProperty('thickness', 8);
    indicator.setProperty('size', 100);
    await page.waitForChanges();
    expect(indicator.getAttribute('aria-valuenow')).toBe('40');
    await page.$eval('md-progress-indicator', el => { el.parentElement!.style.width = '200px'; });
    await page.waitForChanges();
    indicator.setProperty('wave', false);
    await page.waitForChanges();
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
    indicator.setProperty('indeterminate', true);
    await page.waitForChanges();
    expect(indicator.getAttribute('aria-valuenow')).toBeNull();
    await new Promise(resolve => setTimeout(resolve, 300));
    await page.$eval('md-progress-indicator', el => { el.style.display = 'none'; });
    await page.waitForChanges();
    await page.$eval('md-progress-indicator', el => { el.style.display = ''; });
    indicator.setProperty('indeterminate', false);
    indicator.setProperty('max', 0);
    indicator.setProperty('value', -10);
    indicator.setProperty('label', '');
    await page.waitForChanges();
    expect(indicator.getAttribute('aria-valuenow')).toBe('0');
    expect(indicator.getAttribute('aria-label')).toBeNull();
    expect(page.getDiagnostics().filter(item => item.type === 'error' || item.type === 'pageerror')).toEqual([]);
  });
});
