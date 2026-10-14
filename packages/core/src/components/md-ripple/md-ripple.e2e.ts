import { newE2EPage, E2EPage } from '@stencil/core/testing';

const surface = '<button id="surface" style="position:relative; width:120px; height:60px; border:0; padding:0; border-radius:12px"><md-ripple></md-ripple>Press</button>';
const waves = (page: E2EPage) => page.evaluate(() => document.querySelector('md-ripple')!.shadowRoot!.querySelectorAll('.md-ripple__wave').length);
const waitForRemoval = (page: E2EPage) => page.waitForFunction(() => document.querySelector('md-ripple')!.shadowRoot!.querySelectorAll('.md-ripple__wave').length === 0);

describe('md-ripple browser behavior', () => {
  it('starts at the pointer, covers the farthest corner, and is removed after release', async () => {
    const page = await newE2EPage();
    await page.setContent(surface);
    const box = await page.evaluate(() => {
      const rect = document.querySelector('#surface')!.getBoundingClientRect();
      return { x: rect.x, y: rect.y };
    });
    await page.mouse.move(box.x + 10, box.y + 15);
    await page.mouse.down();
    await page.waitForFunction(() => !!document.querySelector('md-ripple')!.shadowRoot!.querySelector('.md-ripple__wave'));
    const wave = await page.evaluate(() => {
      const el = document.querySelector('md-ripple')!.shadowRoot!.querySelector('.md-ripple__wave') as HTMLElement;
      return { size: parseFloat(el.style.width), x: parseFloat(el.style.left), y: parseFloat(el.style.top) };
    });
    expect(wave.size).toBeCloseTo(2 * Math.hypot(110, 45), 1);
    expect(wave.x + wave.size / 2).toBeCloseTo(10, 1);
    expect(wave.y + wave.size / 2).toBeCloseTo(15, 1);
    await page.mouse.up();
    await waitForRemoval(page);
    expect(await waves(page)).toBe(0);
  });

  it('triggers a centered wave through the public method and cleans it up automatically', async () => {
    const page = await newE2EPage();
    await page.setContent(surface);
    const ripple = await page.find('md-ripple');
    await ripple.callMethod('trigger');
    const center = await page.evaluate(() => {
      const wave = document.querySelector('md-ripple')!.shadowRoot!.querySelector('.md-ripple__wave') as HTMLElement;
      const radius = parseFloat(wave.style.width) / 2;
      return { x: parseFloat(wave.style.left) + radius, y: parseFloat(wave.style.top) + radius };
    });
    expect(center.x).toBeCloseTo(60, 2);
    expect(center.y).toBeCloseTo(30, 2);
    await waitForRemoval(page);
    await ripple.callMethod('whenSettled');
    expect(await waves(page)).toBe(0);
    expect(ripple.getAttribute('aria-hidden')).toBe('true');
  });

  it('suppresses pointer and programmatic waves while disabled, then responds when enabled', async () => {
    const page = await newE2EPage();
    await page.setContent(surface.replace('<md-ripple>', '<md-ripple disabled>'));
    const ripple = await page.find('md-ripple');
    await (await page.find('#surface')).click();
    await ripple.callMethod('trigger');
    expect(await waves(page)).toBe(0);
    await ripple.setProperty('disabled', false);
    await page.waitForChanges();
    await ripple.callMethod('trigger');
    expect(await waves(page)).toBe(1);
    await waitForRemoval(page);
  });

  it('reads the inherited ripple setting at interaction time', async () => {
    const page = await newE2EPage();
    await page.setContent(`<div id="settings" style="--md-sys-ripple-enabled:0">${surface}</div>`);
    const ripple = await page.find('md-ripple');
    await (await page.find('#surface')).click();
    await ripple.callMethod('trigger');
    expect(await waves(page)).toBe(0);
    await page.evaluate(() => document.querySelector<HTMLElement>('#settings')!.style.setProperty('--md-sys-ripple-enabled', '1'));
    await ripple.callMethod('trigger');
    expect(await waves(page)).toBe(1);
    await waitForRemoval(page);
  });
});
