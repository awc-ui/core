import { newE2EPage } from '@stencil/core/testing';

describe('md-table-sort-label e2e', () => {
  it('supports keyboard sorting, custom arrows and runtime disabling without emitting invalid requests', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-table-sort-label column="price" default-order="desc" icon="north" icon-position="start" active order="desc" sorted-descending-label="Highest first">Price</md-table-sort-label>');
    const label = await page.find('md-table-sort-label');
    const request = await label.spyOnEvent('mdSortRequest');
    await label.press('Enter');
    await label.press('Space');
    await label.press('ArrowDown');
    expect(request).toHaveReceivedEventTimes(2);
    expect(request.lastEvent.detail).toEqual({ column: 'price', defaultOrder: 'desc' });
    expect((await page.find('md-table-sort-label >>> [aria-live]')).textContent).toBe('Highest first');
    expect((await page.find('md-table-sort-label >>> [part="icon"]')).textContent).toBe('north');
    await label.setProperty('disabled', true);
    await page.waitForChanges();
    await label.click();
    await label.press('Enter');
    expect(request).toHaveReceivedEventTimes(2);
    expect(label.getAttribute('tabindex')).toBe('-1');
    await label.setProperty('disabled', false);
    await label.setProperty('column', '');
    await label.setProperty('order', 'asc');
    await page.waitForChanges();
    await label.click();
    expect(request).toHaveReceivedEventTimes(2);
    expect((await page.find('md-table-sort-label >>> [aria-live]')).textContent).toBe('sorted ascending');
  });
  it('renders and emits mdSortRequest on click', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-table-sort-label column="name">Name</md-table-sort-label>');
    const label = await page.find('md-table-sort-label');
    const ev = await label.spyOnEvent('mdSortRequest');
    await label.click();
    await page.waitForChanges();
    expect(ev).toHaveReceivedEvent();
    expect(ev).toHaveReceivedEventDetail({ column: 'name', defaultOrder: 'asc' });
  });

  it('renders inside md-table and shows active state when sort-by matches', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <md-table sort-by="name" sort-order="desc">
        <md-table-head>
          <md-table-row>
            <md-table-cell head>
              <md-table-sort-label column="name">Name</md-table-sort-label>
            </md-table-cell>
          </md-table-row>
        </md-table-head>
      </md-table>
    `);
    await page.waitForChanges();
    const label = await page.find('md-table-sort-label');
    const cls = await label.getProperty('className');
    expect(cls).toContain('md-table-sort-label--active');
  });
});
