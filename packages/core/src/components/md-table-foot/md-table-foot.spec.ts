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
});
