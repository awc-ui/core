/**
 * `series-labels` names each series at the end of its line. Like every other
 * presentation prop it must apply when toggled after mount.
 */
import { newE2EPage } from '@stencil/core/testing';

it('md-area-chart shows and hides end-of-series labels when series-labels toggles at runtime', async () => {
  const page = await newE2EPage();
  await page.setContent('<md-area-chart no-animation animation="none" legend="none" style="display:block;width:640px;height:360px"></md-area-chart>');
  const chart = await page.find('md-area-chart');
  await chart.setProperty('series', [{ id: 'a', label: 'North', data: [3, 5, 4, 6] }, { id: 'b', label: 'South', data: [2, 3, 3, 4] }]);
  await chart.setProperty('xAxis', { data: ['Q1', 'Q2', 'Q3', 'Q4'] });
  await page.waitForChanges();
  const endLabels = () => page.evaluate(async () => ((await (document.querySelector('md-area-chart') as any).getInstance()).getScene().endLabels ?? []).map((l: { text: string }) => l.text));
  expect(await endLabels()).toEqual([]);
  await chart.setProperty('seriesLabels', true);
  await page.waitForChanges();
  expect(await endLabels()).toEqual(expect.arrayContaining(['North', 'South']));
  await chart.setProperty('seriesLabels', false);
  await page.waitForChanges();
  expect(await endLabels()).toEqual([]);
});
