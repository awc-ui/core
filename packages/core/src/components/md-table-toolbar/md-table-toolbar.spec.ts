import { newSpecPage } from '@stencil/core/testing';
import { MdTableToolbar } from './md-table-toolbar';

const create = (html: string) =>
  newSpecPage({ components: [MdTableToolbar], html });

describe('md-table-toolbar', () => {
  it('renders with role=toolbar', async () => {
    const page = await create('<md-table-toolbar headline="Users"></md-table-toolbar>');
    expect(page.root?.getAttribute('role')).toBe('toolbar');
  });

  it('shows headline by default', async () => {
    const page = await create('<md-table-toolbar headline="Users"></md-table-toolbar>');
    const h = page.root?.shadowRoot?.querySelector('[part="headline"]');
    expect(h?.textContent).toContain('Users');
  });

  it('shows supporting text when set', async () => {
    const page = await create('<md-table-toolbar headline="Users" supporting-text="All accounts"></md-table-toolbar>');
    const p = page.root?.shadowRoot?.querySelector('[part="supporting-text"]');
    expect(p?.textContent).toContain('All accounts');
  });

  it('switches to selection mode when num-selected > 0', async () => {
    const page = await create('<md-table-toolbar headline="Users" num-selected="3"></md-table-toolbar>');
    expect(page.root).toHaveClass('md-table-toolbar--selection-mode');
    const cap = page.root?.shadowRoot?.querySelector('[part="selection-caption"]');
    expect(cap?.textContent).toBe('3 selected');
  });

  it('honours custom label-selected with %count% token', async () => {
    const page = await create(
      '<md-table-toolbar num-selected="5" label-selected="Selected %count% items"></md-table-toolbar>',
    );
    const cap = page.root?.shadowRoot?.querySelector('[part="selection-caption"]');
    expect(cap?.textContent).toBe('Selected 5 items');
  });

  it('exposes parts', async () => {
    const page = await create('<md-table-toolbar headline="x"></md-table-toolbar>');
    const shadow = page.root?.shadowRoot;
    expect(shadow?.querySelector('[part="leading"]')).toBeTruthy();
    expect(shadow?.querySelector('[part="main"]')).toBeTruthy();
    expect(shadow?.querySelector('[part="actions"]')).toBeTruthy();
  });
});
