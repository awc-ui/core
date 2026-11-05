import { newE2EPage } from '@stencil/core/testing';

// Contract checks for documented behaviour that the original suites did not cover.
describe('md-checkbox keyboard activation', () => {
  // readme: "`mdChange` … User activation only (click / `Space`)" — one activation per press.
  it('toggles once for a held Space key (auto-repeat does not re-toggle)', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-checkbox aria-label="Updates"></md-checkbox>');
    const box = await page.find('md-checkbox');
    const change = await box.spyOnEvent('mdChange');
    await box.focus();
    await page.keyboard.down('Space');
    await page.keyboard.down('Space'); // auto-repeat keydown (repeat: true)
    await page.keyboard.down('Space');
    await page.keyboard.up('Space');
    await page.waitForChanges();
    expect(change).toHaveReceivedEventTimes(1);
    expect(await box.getProperty('checked')).toBe(true);
    // Guard: a second, separate press toggles again.
    await page.keyboard.press('Space');
    await page.waitForChanges();
    expect(change).toHaveReceivedEventTimes(2);
    expect(await box.getProperty('checked')).toBe(false);
  });
});

describe('md-checkbox reduced motion', () => {
  // The stylesheet's REDUCED MOTION block removes the container transitions and the glyph entrance;
  // the state rules must not re-introduce them.
  async function mount() {
    const page = await newE2EPage();
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.setContent('<md-checkbox aria-label="Updates" style="margin:40px"></md-checkbox>');
    return page;
  }
  // Computed values, not running animations: a 200ms transition may already be over by the time a
  // round trip reads getAnimations().
  const motion = (selector: string) => `(() => {
    const box = document.querySelector('md-checkbox');
    const cs = getComputedStyle(box.shadowRoot.querySelector('${selector}'));
    return { transition: cs.transitionDuration, animation: cs.animationName };
  })()`;

  it('does not animate the press squish', async () => {
    const page = await mount();
    const rect = await page.evaluate(() => { const r = document.querySelector('md-checkbox')!.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    await page.mouse.move(rect.x, rect.y);
    await page.mouse.down();
    // Pressed (squished) — the scale may snap, but nothing animates.
    await page.waitForFunction(() => document.querySelector('md-checkbox')!.classList.contains('md-checkbox--pressed'));
    expect(((await page.evaluate(motion('.md-checkbox__container'))) as any).transition.split(', ').every((d: string) => d === '0s')).toBe(true);
    await page.mouse.up();
  });

  it('does not run the glyph entrance when checked', async () => {
    const page = await mount();
    await (await page.find('md-checkbox')).click();
    await page.waitForChanges();
    expect(((await page.evaluate(motion('.md-checkbox__icon .material-symbols-outlined'))) as any).animation).toBe('none');
    await page.evaluate(() => { document.querySelector('md-checkbox')!.setAttribute('indeterminate', ''); });
    await page.waitForChanges();
    expect(((await page.evaluate(motion('.md-checkbox__icon .material-symbols-outlined'))) as any).animation).toBe('none');
  });

  it('keeps the press squish and glyph entrance without reduced motion (guard)', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-checkbox aria-label="Updates" style="margin:40px"></md-checkbox>');
    await (await page.find('md-checkbox')).click();
    await page.waitForChanges();
    expect(((await page.evaluate(motion('.md-checkbox__icon .material-symbols-outlined'))) as any).animation).toBe('md-checkbox-glyph-in');
    const rect = await page.evaluate(() => { const r = document.querySelector('md-checkbox')!.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    await page.mouse.move(rect.x, rect.y);
    await page.mouse.down();
    await page.waitForFunction(() => document.querySelector('md-checkbox')!.classList.contains('md-checkbox--pressed'));
    expect(((await page.evaluate(motion('.md-checkbox__container'))) as any).transition).toBe('0.2s, 0.2s, 0.2s');
    await page.mouse.up();
  });
});
