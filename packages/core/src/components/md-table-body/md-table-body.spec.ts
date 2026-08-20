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
});
