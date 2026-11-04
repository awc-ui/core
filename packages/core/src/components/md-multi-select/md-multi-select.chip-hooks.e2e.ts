import { newE2EPage } from '@stencil/core/testing';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const OPTS =
  '<md-select-option value="a">Apple</md-select-option>' +
  '<md-select-option value="b">Banana</md-select-option>' +
  '<md-select-option value="c">Cherry</md-select-option>';

/** Outline colour and height of every value chip the picker renders (the
 *  visible ones, not the hidden measurement row). */
const chipBoxes = () => {
  const host = document.querySelector('md-multi-select') as HTMLElement;
  return Array.from(host.shadowRoot!.querySelectorAll('md-chip'))
    .filter((c) => !(c as HTMLElement).closest('.md-multi-select__inline-measure'))
    .map((c) => {
      const outline = c.shadowRoot!.querySelector('.md-chip__outline') as HTMLElement;
      const r = (c as HTMLElement).getBoundingClientRect();
      return { color: getComputedStyle(outline).borderTopColor, height: Math.round(r.height) };
    });
};

/**
 * `--md-multi-select-chip-outline` and `--md-multi-select-chip-height` are
 * documented as the chip outline colour and the chip height. They used to reach
 * only the "+N" overflow counter; the value chips themselves kept md-chip's
 * defaults, so a themed picker showed chips and counter in different styles.
 */
describe('md-multi-select chip hooks', () => {
  for (const mode of ['chips', 'chips-inline']) {
    it(`paints the value chips (${mode})`, async () => {
      const page = await newE2EPage({
        html: `<md-multi-select display-mode="${mode}" label="Fruit" style="--md-multi-select-chip-outline:#1565C0;--md-multi-select-chip-height:28px">${OPTS}</md-multi-select>`,
      });
      await page.$eval('md-multi-select', (el: any) => { el.value = ['a', 'b']; });
      await page.waitForChanges();
      await sleep(200);
      const chips = await page.evaluate(chipBoxes);
      expect(chips.length).toBe(2);
      for (const c of chips) expect(c).toEqual({ color: 'rgb(21, 101, 192)', height: 28 });
    });
  }

  it('keeps ancestor md-chip theming when the hooks are unset', async () => {
    const page = await newE2EPage({
      html: `<div style="--md-chip-outline-color:#2E7D32;--md-chip-container-height:36px"><md-multi-select label="Fruit">${OPTS}</md-multi-select></div>`,
    });
    await page.$eval('md-multi-select', (el: any) => { el.value = ['a']; });
    await page.waitForChanges();
    await sleep(200);
    expect(await page.evaluate(chipBoxes)).toEqual([{ color: 'rgb(46, 125, 50)', height: 36 }]);
  });

  it('leaves md-chip defaults alone when the hooks are unset', async () => {
    const page = await newE2EPage({
      html: `<md-multi-select label="Fruit">${OPTS}</md-multi-select>`,
    });
    await page.$eval('md-multi-select', (el: any) => { el.value = ['a']; });
    await page.waitForChanges();
    await sleep(200);
    const chips = await page.evaluate(chipBoxes);
    expect(chips.length).toBe(1);
    // md-chip input variant: outline-variant outline, 32px container.
    expect(chips[0].height).toBe(32);
    expect(chips[0].color).not.toBe('rgb(21, 101, 192)');
    expect(chips[0].color).not.toBe('rgba(0, 0, 0, 0)');
  });
});
