import { newSpecPage } from '@stencil/core/testing';
import { MdTableHead } from './md-table-head';

describe('md-table-head', () => {
  it('renders with role=rowgroup', async () => {
    const page = await newSpecPage({
      components: [MdTableHead],
      html: '<md-table-head></md-table-head>',
    });
    expect(page.root?.getAttribute('role')).toBe('rowgroup');
    expect(page.root?.getAttribute('data-md-rowgroup')).toBe('head');
  });
});
