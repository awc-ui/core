import { newE2EPage, E2EPage } from '@stencil/core/testing';

const surface = '<button id="surface" style="position:relative; width:120px; height:60px; border:0; padding:0; border-radius:12px"><md-ripple></md-ripple>Press</button>';
const waves = (page: E2EPage) => page.evaluate(() => document.querySelector('md-ripple')!.shadowRoot!.querySelectorAll('.md-ripple__wave').length);
const waitForRemoval = (page: E2EPage) => page.waitForFunction(() => document.querySelector('md-ripple')!.shadowRoot!.querySelectorAll('.md-ripple__wave').length === 0);

describe('md-ripple browser behavior', () => {
  it('uses custom geometry and timing tokens and falls back safely for invalid token values', async () => {
    const page = await newE2EPage();
    await page.setContent(surface.replace('border-radius:12px', 'border-radius:12px;--md-ripple-opacity:.3;--md-ripple-extend-inline:20px;--md-ripple-extend-block:10px;--md-ripple-grow-duration:60ms;--md-ripple-grow-easing:linear'));
    const readWave = () => page.evaluate(async () => {
      const ripple = document.querySelector('md-ripple')!;
      await ripple.trigger();
      const wave = ripple.shadowRoot!.querySelector('.md-ripple__wave') as HTMLElement;
      const animation = wave.getAnimations()[0];
      return { width: parseFloat(wave.style.width), duration: animation.effect!.getTiming().duration, easing: animation.effect!.getTiming().easing, opacity: (animation.effect as KeyframeEffect).getKeyframes()[0].opacity };
    });
    const custom = await readWave();
    expect(custom.width).toBeCloseTo(2 * Math.hypot(80, 40), 2);
    expect(custom.duration).toBe(60);
    expect(custom.easing).toBe('linear');
    expect(Number(custom.opacity)).toBeCloseTo(.3);
    await waitForRemoval(page);
    await page.$eval('#surface', element => {
      const el = element as HTMLElement;
      el.style.setProperty('--md-ripple-opacity', 'invalid');
      el.style.setProperty('--md-ripple-extend-inline', '-20px');
      el.style.setProperty('--md-ripple-extend-block', 'calc(2px + 4px)');
      el.style.setProperty('--md-ripple-grow-duration', 'invalid');
      el.style.removeProperty('--md-ripple-grow-easing');
    });
    const fallback = await readWave();
    expect(fallback.width).toBeCloseTo(2 * Math.hypot(60, 30), 2);
    expect(fallback.duration).toBe(450);
    expect(Number(fallback.opacity)).toBeCloseTo(.12);
    await waitForRemoval(page);
  });

  it('anchors through display-contents and can reconnect to a new surface', async () => {
    const page = await newE2EPage();
    await page.setContent('<button id="surface" style="position:relative;width:120px;height:60px;border:0;padding:0"><span style="display:contents"><md-ripple></md-ripple></span>Press</button><button id="next" style="position:relative;width:200px;height:80px;border:0;padding:0">Next</button>');
    const width = () => page.evaluate(async () => {
      const ripple = document.querySelector('md-ripple')!;
      await ripple.trigger();
      return parseFloat((ripple.shadowRoot!.querySelector('.md-ripple__wave') as HTMLElement).style.width);
    });
    expect(await width()).toBeCloseTo(2 * Math.hypot(60, 30), 2);
    await waitForRemoval(page);
    await page.$eval('md-ripple', el => document.querySelector('#next')!.append(el));
    await page.waitForChanges();
    expect(await width()).toBeCloseTo(2 * Math.hypot(100, 40), 2);
    await waitForRemoval(page);
    await (await page.find('#surface')).click();
    expect(await waves(page)).toBe(0);
    await (await page.find('#next')).click();
    await (await page.find('md-ripple')).callMethod('whenSettled');
    await waitForRemoval(page);
    expect(await waves(page)).toBe(0);
  });
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
    // Inspect within the same browser task so a busy worker cannot miss the
    // short-lived wave between the trigger and a second protocol roundtrip.
    const center = await page.evaluate(async () => {
      const host = document.querySelector('md-ripple')!;
      await host.trigger();
      const wave = host.shadowRoot!.querySelector('.md-ripple__wave') as HTMLElement;
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
    expect(await page.evaluate(async () => {
      const host = document.querySelector('md-ripple')!;
      await host.trigger();
      return host.shadowRoot!.querySelectorAll('.md-ripple__wave').length;
    })).toBe(1);
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
    expect(await page.evaluate(async () => {
      const host = document.querySelector('md-ripple')!;
      await host.trigger();
      return host.shadowRoot!.querySelectorAll('.md-ripple__wave').length;
    })).toBe(1);
    await waitForRemoval(page);
  });
});
