import { newE2EPage, E2EPage } from '@stencil/core/testing';

/**
 * Interaction coverage for md-slider — keyboard, pointer drag (single / range /
 * vertical), range thumb collision, controlled mode, and the value events. These
 * exercise the pointer/keyboard handlers that unit (jsdom) specs can't drive.
 */
describe('md-slider interaction', () => {
  const val = (page: E2EPage, prop = 'value') =>
    page.evaluate((p: string) => (document.getElementById('s') as any)[p], prop);

  /** Focus a thumb input (by index) so keyboard goes to it. */
  async function focusThumb(page: E2EPage, i = 0) {
    await page.evaluate((idx: number) => {
      const inputs = document
        .getElementById('s')!
        .shadowRoot!.querySelectorAll('input[type="range"]');
      (inputs[idx] as HTMLElement).focus();
    }, i);
  }

  async function railRect(page: E2EPage) {
    return page.evaluate(() => {
      const r = document
        .getElementById('s')!
        .shadowRoot!.querySelector('.md-slider__rail')!
        .getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, w: r.width, h: r.height };
    });
  }

  it('keyboard: arrows step, Home/End jump to min/max', async () => {
    const page = await newE2EPage();
    await page.setContent(
      `<md-slider id="s" aria-label="x" min="0" max="100" step="10" value="50"></md-slider>`,
    );
    await page.waitForChanges();
    await focusThumb(page);

    await page.keyboard.press('ArrowRight');
    await page.waitForChanges();
    expect(await val(page)).toBe(60);

    await page.keyboard.press('ArrowDown');
    await page.waitForChanges();
    expect(await val(page)).toBe(50);

    await page.keyboard.press('Home');
    await page.waitForChanges();
    expect(await val(page)).toBe(0);

    await page.keyboard.press('End');
    await page.waitForChanges();
    expect(await val(page)).toBe(100);
  }, 60000);

  it('keyboard: PageUp / PageDown move by a larger increment', async () => {
    const page = await newE2EPage();
    await page.setContent(
      `<md-slider id="s" aria-label="x" min="0" max="100" step="1" value="50"></md-slider>`,
    );
    await page.waitForChanges();
    await focusThumb(page);

    await page.keyboard.press('PageUp');
    await page.waitForChanges();
    const up = await val(page);
    expect(up).toBeGreaterThan(50);

    await page.keyboard.press('PageDown');
    await page.waitForChanges();
    expect(await val(page)).toBeLessThan(up);
  }, 60000);

  it('pointer: clicking the track sets the value', async () => {
    const page = await newE2EPage();
    await page.setViewport({ width: 600, height: 300 });
    await page.setContent(
      `<div style="width:400px;"><md-slider id="s" aria-label="x" min="0" max="100" value="0"></md-slider></div>`,
    );
    await page.waitForChanges();
    const r = await railRect(page);
    // Click at ~75% across the rail.
    await page.mouse.click(Math.round(r.left + r.w * 0.75), Math.round(r.top + r.h / 2));
    await page.waitForChanges();
    const v = await val(page);
    expect(v).toBeGreaterThan(65);
    expect(v).toBeLessThan(85);
  }, 60000);

  it('range: keyboard moves each thumb and start cannot cross end', async () => {
    const page = await newE2EPage();
    await page.setContent(
      `<md-slider id="s" range label-start="lo" label-end="hi" min="0" max="100" step="10" value-start="20" value-end="50"></md-slider>`,
    );
    await page.waitForChanges();

    // End thumb up.
    await focusThumb(page, 1);
    await page.keyboard.press('ArrowRight');
    await page.waitForChanges();
    expect(await val(page, 'valueEnd')).toBe(60);

    // Start thumb up repeatedly — must not pass end (60).
    await focusThumb(page, 0);
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('ArrowRight');
    }
    await page.waitForChanges();
    const start = await val(page, 'valueStart');
    const end = await val(page, 'valueEnd');
    expect(start).toBeLessThanOrEqual(end);
  }, 60000);

  it('range: dragging the rail near the start thumb updates it and fires drag events', async () => {
    const page = await newE2EPage();
    await page.setViewport({ width: 600, height: 300 });
    await page.setContent(
      `<div style="width:400px;"><md-slider id="s" range aria-label="x" min="0" max="100" value-start="20" value-end="80"></md-slider></div>`,
    );
    await page.waitForChanges();
    await page.evaluate(() => {
      (window as any).__drag = { start: 0, end: 0 };
      const s = document.getElementById('s')!;
      s.addEventListener('mdDragStart', () => (window as any).__drag.start++);
      s.addEventListener('mdDragEnd', () => (window as any).__drag.end++);
    });
    const r = await railRect(page);
    const y = Math.round(r.top + r.h / 2);
    // Press near the start thumb (~20%) and drag toward ~40%.
    await page.mouse.move(Math.round(r.left + r.w * 0.2), y);
    await page.mouse.down();
    await page.mouse.move(Math.round(r.left + r.w * 0.4), y, { steps: 5 });
    await page.mouse.up();
    await page.waitForChanges();
    const start = await val(page, 'valueStart');
    const drag = await page.evaluate(() => (window as any).__drag);
    expect(start).toBeGreaterThan(25); // moved up from 20
    expect(start).toBeLessThan(80); // still below end
    expect(drag.start).toBeGreaterThanOrEqual(1);
    expect(drag.end).toBeGreaterThanOrEqual(1);
  }, 60000);

  it('vertical: dragging the rail maps to value', async () => {
    const page = await newE2EPage();
    await page.setContent(
      `<div style="height:300px;"><md-slider id="s" orientation="vertical" full-height aria-label="x" value="50"></md-slider></div>`,
    );
    await page.waitForChanges();
    const r = await railRect(page);
    const x = Math.round(r.left + r.w / 2);
    // Press low, drag toward the top → value increases.
    await page.mouse.move(x, Math.round(r.bottom - r.h * 0.2));
    await page.mouse.down();
    await page.mouse.move(x, Math.round(r.top + r.h * 0.1), { steps: 5 });
    await page.mouse.up();
    await page.waitForChanges();
    expect(await val(page)).toBeGreaterThan(70);
  }, 60000);

  it('controlled mode: value prop is not mutated, but mdInput / mdChange fire', async () => {
    const page = await newE2EPage();
    await page.setContent(
      `<md-slider id="s" controlled aria-label="x" min="0" max="100" step="10" value="50"></md-slider>`,
    );
    await page.waitForChanges();
    await page.evaluate(() => {
      (window as any).__ev = { input: [] as number[], change: [] as number[] };
      const s = document.getElementById('s')!;
      s.addEventListener('mdInput', (e: any) => (window as any).__ev.input.push(e.detail.value));
      s.addEventListener('mdChange', (e: any) => (window as any).__ev.change.push(e.detail.value));
    });
    await focusThumb(page);
    await page.keyboard.press('ArrowRight');
    await page.waitForChanges();
    const ev = await page.evaluate(() => (window as any).__ev);
    // Controlled: the prop stays put...
    expect(await val(page)).toBe(50);
    // ...but the events report the intended value (60).
    expect(ev.change).toContain(60);
  }, 60000);
});
