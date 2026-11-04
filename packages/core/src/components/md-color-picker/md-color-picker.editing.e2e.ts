import { newE2EPage } from '@stencil/core/testing';
import { exerciseColorChannels, exerciseColorPopover, exerciseColorValues } from './test-utils/editing.browser';

describe('md-color-picker editing contracts', () => {
  it.each(['ltr', 'rtl'])('tracks captured pointer gestures in %s and commits hue, alpha and saturation on release', async (direction) => {
    const page = await newE2EPage({ html: `<div dir="${direction}"><md-color-picker alpha value="#FF0000"></md-color-picker></div>` });
    const picker = await page.find('md-color-picker');
    const changed = await picker.spyOnEvent('mdChange');
    const input = await picker.spyOnEvent('mdInput');
    const rect = (part: string) => page.evaluate((name) => {
      const r = document.querySelector('md-color-picker')!.shadowRoot!.querySelector(`[part="${name}"]`)!.getBoundingClientRect();
      return { left: r.left, top: r.top, width: r.width, height: r.height };
    }, part);
    const hue = await rect('hue');
    await page.mouse.move(hue.left + hue.width / 4, hue.top + hue.height / 2); await page.mouse.down();
    await page.mouse.move(hue.left + hue.width / 2, hue.top + hue.height / 2, { steps: 3 }); await page.waitForChanges();
    expect(input.events.length).toBeGreaterThan(0); expect(changed).toHaveReceivedEventTimes(0);
    expect(Number((await page.find('md-color-picker >>> [part="hue"]')).getAttribute('aria-valuenow'))).toBeCloseTo(180, 0);
    await page.mouse.up(); await page.waitForChanges(); expect(changed).toHaveReceivedEventTimes(1);
    const alpha = await rect('alpha');
    await page.mouse.move(alpha.left + alpha.width / 4, alpha.top + alpha.height / 2); await page.mouse.down();
    await page.mouse.move(alpha.left + alpha.width / 2, alpha.top + alpha.height / 2, { steps: 3 }); await page.mouse.up(); await page.waitForChanges();
    expect(Number((await page.find('md-color-picker >>> [part="alpha"]')).getAttribute('aria-valuenow'))).toBeCloseTo(0.5, 1);
    expect(changed).toHaveReceivedEventTimes(2);
    const plate = await rect('plate');
    await page.mouse.move(plate.left + plate.width / 2, plate.top + plate.height / 2); await page.mouse.down();
    await page.mouse.move(direction === 'rtl' ? plate.left - 20 : plate.left + plate.width + 20, plate.top + plate.height + 20, { steps: 3 });
    await page.mouse.up(); await page.waitForChanges();
    expect(await picker.getProperty('value')).toBe('#00000080'); expect(changed).toHaveReceivedEventTimes(3);
    const count = input.events.length;
    picker.setProperty('disabled', true); await page.waitForChanges();
    await page.mouse.click(hue.left + hue.width / 4, hue.top + hue.height / 2); await page.waitForChanges();
    expect(await picker.getProperty('value')).toBe('#00000080'); expect(input.events.length).toBe(count);
  });
  it('edits all color channels, validates hex, and respects directional keyboard and disabled behavior', async () => {
    const page = await newE2EPage();
    await page.setContent('<div><md-color-picker alpha value="#FF0000"></md-color-picker></div>');
    await page.evaluate(exerciseColorChannels);
  });

  it('keeps consumer triggers and outside-dismissal behavior synchronized across replacements', async () => {
    const page = await newE2EPage();
    await page.setContent('<div><button data-outside>Outside</button><md-color-picker variant="popover"><button slot="trigger">Choose color</button></md-color-picker></div>');
    await page.evaluate(exerciseColorPopover);
  });
});

describe('md-color-picker controlled CSS values', () => {
 it('normalizes supported CSS formats and recovers from invalid controlled values without emitting edits', async () => {
 const page = await newE2EPage({ html: '<md-color-picker alpha></md-color-picker>' });
 await page.evaluate(exerciseColorValues);
 });
});
