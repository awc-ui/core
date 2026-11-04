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

  it('updates leading content after selection mode recreates its slot', async () => {
    const page = await create('<md-table-toolbar headline="Invoices"><span slot="leading">€</span></md-table-toolbar>');
    const toolbar = page.root as HTMLMdTableToolbarElement;
    const leading = toolbar.querySelector('[slot="leading"]')!;
    const hidden = () => (toolbar.shadowRoot!.querySelector('[part="leading"]') as HTMLElement).hidden;
    expect(hidden()).toBe(false);

    toolbar.numSelected = 2;
    await page.waitForChanges();
    expect(toolbar.shadowRoot!.querySelector('slot[name="leading"]')).toBeNull();
    toolbar.numSelected = 0;
    await page.waitForChanges();
    const recreated = toolbar.shadowRoot!.querySelector('slot[name="leading"]')!;
    leading.remove();
    recreated.dispatchEvent(new Event('slotchange'));
    await page.waitForChanges();
    expect(hidden()).toBe(true);
    toolbar.appendChild(leading);
    recreated.dispatchEvent(new Event('slotchange'));
    await page.waitForChanges();
    expect(hidden()).toBe(false);
  });

  it('reveals assigned leading content when an initially selected toolbar returns to default mode', async () => {
    const page = await create('<md-table-toolbar num-selected="1"><span slot="leading">Back</span></md-table-toolbar>');
    const toolbar = page.root as HTMLMdTableToolbarElement;
    toolbar.numSelected = 0;
    await page.waitForChanges();
    toolbar.shadowRoot!.querySelector('slot[name="leading"]')!.dispatchEvent(new Event('slotchange'));
    await page.waitForChanges();
    expect((toolbar.shadowRoot!.querySelector('[part="leading"]') as HTMLElement).hidden).toBe(false);
  });
});
