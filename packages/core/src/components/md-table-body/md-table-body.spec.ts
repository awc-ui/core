import { newSpecPage } from '@stencil/core/testing';
import { MdTableBody } from './md-table-body';

describe('md-table-body', () => {
  it('renders with role=rowgroup', async () => {
    const page = await newSpecPage({
      components: [MdTableBody],
      html: '<md-table-body></md-table-body>',
    });
    expect(page.root?.getAttribute('role')).toBe('rowgroup');
    expect(page.root?.getAttribute('data-md-rowgroup')).toBe('body');
  });

  it('relays row changes to its owning table and avoids nested rowgroups when frozen', async () => {
    const page = await newSpecPage({ components: [MdTableBody], html: '<md-table><md-table-body></md-table-body></md-table>' });
    const body = page.body.querySelector('md-table-body')!;
    const changed = jest.fn();
    body.parentElement!.addEventListener('mdRowgroupSlotChange', changed);
    body.appendChild(page.doc.createElement('md-table-row'));
    body.shadowRoot!.querySelector('slot')!.dispatchEvent(new Event('slotchange'));
    expect(changed).toHaveBeenCalledTimes(1);
    expect(changed.mock.calls[0][0].target).toBe(body);
    body.presentational = true;
    await page.waitForChanges();
    expect(body.getAttribute('role')).toBe('presentation');
    body.presentational = false;
    await page.waitForChanges();
    expect(body.getAttribute('role')).toBe('rowgroup');
  });
});
