/**
 * A polar bar chart draws its bars as ring segments (`scene.slices`), not
 * rectangles (`scene.bars` is empty). A pointer click on a segment must emit
 * `mdBarClick` for that segment — the same event a click on a cartesian bar and
 * Enter on the keyboard cursor emit — and a click in the hole must emit nothing.
 */
import { newE2EPage } from '@stencil/core/testing';

describe('md-bar-chart polar click', () => {
  it('emits mdBarClick for the ring segment under the pointer, and nothing for the hole', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-bar-chart no-animation polar label="Medals" style="display:block;width:640px;height:400px"></md-bar-chart>');
    const chart = await page.find('md-bar-chart');
    await chart.setProperty('series', [
      { id: 'rev', label: 'Revenue', data: [12, 19, 15] },
      { id: 'cost', label: 'Costs', data: [8, 11, 13] },
    ]);
    await chart.setProperty('xAxis', { data: ['Jan', 'Feb', 'Mar'] });
    await page.waitForChanges();
    const clicks = await chart.spyOnEvent('mdBarClick');
    const at = await page.evaluate(async () => {
      const host = document.querySelector('md-bar-chart')!;
      const scene = (await host.getInstance())!.getScene()!;
      const rect = host.shadowRoot!.querySelector('canvas')!.getBoundingClientRect();
      const seg = scene.slices.find(s => s.dataIndex === 1 && s.seriesIndex === 1)!;
      const a = (seg.startAngle + seg.endAngle) / 2, r = (seg.innerR + seg.outerR) / 2;
      return { seg: [rect.left + seg.cx + r * Math.cos(a), rect.top + seg.cy + r * Math.sin(a)], hole: [rect.left + seg.cx, rect.top + seg.cy] };
    });
    await page.mouse.click(at.seg[0], at.seg[1]); await page.waitForChanges();
    expect(clicks).toHaveReceivedEventTimes(1);
    expect(clicks.lastEvent!.detail).toEqual(expect.objectContaining({ seriesIndex: 1, seriesId: 'cost', dataIndex: 1, value: 11 }));
    await page.mouse.click(at.hole[0], at.hole[1]); await page.waitForChanges();
    expect(clicks).toHaveReceivedEventTimes(1);
  });
});
