import { newE2EPage } from '@stencil/core/testing';

describe('md-time-picker form width', () => {
  it.each(['ltr', 'rtl'])('fills an explicitly sized host and keeps its intrinsic width (%s)', async (direction) => {
    const page = await newE2EPage();
    await page.setContent(`<div dir="${direction}" style="width:600px">
      <md-time-picker label="Time" value="07:00" format="24h"></md-time-picker>
    </div>`);
    await page.waitForChanges();
    const widths = () => page.$eval('md-time-picker', (host) => ({
      host: host.getBoundingClientRect().width,
      trigger: host.shadowRoot!.querySelector('[part="trigger"]')!.getBoundingClientRect().width,
    }));
    for (const density of [0, -1, -2, -3, -4]) {
      await page.$eval('md-time-picker', (host: HTMLMdTimePickerElement, value: number) => {
        host.density = value as HTMLMdTimePickerElement['density'];
      }, density);
      await page.waitForChanges();
      const intrinsic = await widths();
      expect(intrinsic.host).toBeGreaterThanOrEqual(240);
      expect(intrinsic.host).toBeLessThan(600);
      for (const width of ['100%', '420px', '200px']) {
        await page.$eval('md-time-picker', (host: HTMLElement, value: string) => { host.style.inlineSize = value; }, width);
        await page.waitForChanges();
        const result = await widths();
        expect(Math.abs(result.trigger - result.host)).toBeLessThanOrEqual(1);
        expect(result.host).toBeCloseTo(width === '100%' ? 600 : parseInt(width), 0);
      }
      await page.$eval('md-time-picker', (host: HTMLElement) => { host.style.inlineSize = ''; });
      await page.waitForChanges();
      expect((await widths()).host).toBeCloseTo(intrinsic.host, 0);
    }
  });
});
