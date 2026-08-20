import { newSpecPage } from '@stencil/core/testing';
import { MdTableCell } from './md-table-cell';

const create = (html: string) =>
  newSpecPage({ components: [MdTableCell], html });

describe('md-table-cell', () => {
  describe('rendering & ARIA', () => {
    it('renders with role=cell by default', async () => {
      const page = await create('<md-table-cell>data</md-table-cell>');
      expect(page.root?.getAttribute('role')).toBe('cell');
    });

    it('renders with role=columnheader when head + scope=col', async () => {
      const page = await create('<md-table-cell head scope="col">Name</md-table-cell>');
      expect(page.root?.getAttribute('role')).toBe('columnheader');
      expect(page.root?.getAttribute('scope')).toBe('col');
    });

    it('renders with role=rowheader when head + scope=row', async () => {
      const page = await create('<md-table-cell head scope="row">Total</md-table-cell>');
      expect(page.root?.getAttribute('role')).toBe('rowheader');
    });

    it('reflects align', async () => {
      const page = await create('<md-table-cell align="end">data</md-table-cell>');
      expect(page.root).toHaveClass('md-table-cell--align-end');
    });

    it('reflects numeric attribute', async () => {
      const page = await create('<md-table-cell numeric>42</md-table-cell>');
      expect(page.root?.hasAttribute('numeric')).toBe(true);
    });

    it('reflects padding=checkbox', async () => {
      const page = await create('<md-table-cell padding="checkbox"></md-table-cell>');
      expect(page.root).toHaveClass('md-table-cell--padding-checkbox');
    });

    it('reflects sticky=start', async () => {
      const page = await create('<md-table-cell sticky="start">a</md-table-cell>');
      expect(page.root?.getAttribute('sticky')).toBe('start');
    });

    it('renders content slot', async () => {
      const page = await create('<md-table-cell><span>Hello</span></md-table-cell>');
      const slot = page.root?.shadowRoot?.querySelector('slot');
      expect(slot).toBeTruthy();
    });

    it('exposes content part', async () => {
      const page = await create('<md-table-cell></md-table-cell>');
      expect(page.root?.shadowRoot?.querySelector('[part="content"]')).toBeTruthy();
    });
  });

  describe('grid spans', () => {
    it('applies colspan via gridColumn style', async () => {
      const page = await create('<md-table-cell colspan="3"></md-table-cell>');
      expect(((page.root as HTMLElement).style as any).gridColumn).toContain('span 3');
    });

    it('applies rowspan via gridRow style', async () => {
      const page = await create('<md-table-cell rowspan="2"></md-table-cell>');
      expect(((page.root as HTMLElement).style as any).gridRow).toContain('span 2');
    });
  });

  it('pin-icon renders a ligature glyph instead of the built-in SVG', async () => {
    const page = await create('<md-table-cell head sticky="start" pin-icon="anchor">A</md-table-cell>');
    const pin = page.root!.shadowRoot!.querySelector('.md-table-cell__pin')!;
    expect(pin.querySelector('.md-table-cell__pin-glyph')?.textContent).toBe('anchor');
    expect(pin.querySelector('svg')).toBeNull();
  });

});
