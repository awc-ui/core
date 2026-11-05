import { newSpecPage } from '@stencil/core/testing';
import { MdTableFoot } from './md-table-foot';

describe('md-table-foot', () => {
  it('renders with role=rowgroup', async () => {
    const page = await newSpecPage({
      components: [MdTableFoot],
      html: '<md-table-foot></md-table-foot>',
    });
    expect(page.root?.getAttribute('role')).toBe('rowgroup');
    expect(page.root?.getAttribute('data-md-rowgroup')).toBe('foot');
  });

  it('relays footer mutations and restores rowgroup semantics after frozen mode', async () => {
    const page = await newSpecPage({ components: [MdTableFoot], html: '<md-table><md-table-foot presentational></md-table-foot></md-table>' });
    const foot = page.body.querySelector('md-table-foot')!;
    const changed = jest.fn();
    foot.parentElement!.addEventListener('mdRowgroupSlotChange', changed);
    expect(foot.getAttribute('role')).toBe('presentation');
    foot.appendChild(page.doc.createElement('md-table-row'));
    foot.shadowRoot!.querySelector('slot')!.dispatchEvent(new Event('slotchange'));
    expect(changed).toHaveBeenCalledTimes(1);
    expect(changed.mock.calls[0][0].target).toBe(foot);
    foot.presentational = false;
    await page.waitForChanges();
    expect(foot.getAttribute('role')).toBe('rowgroup');
  });
});
