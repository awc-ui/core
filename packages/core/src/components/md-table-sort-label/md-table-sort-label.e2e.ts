import { newE2EPage } from '@stencil/core/testing';

describe('md-table-sort-label e2e', () => {
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
