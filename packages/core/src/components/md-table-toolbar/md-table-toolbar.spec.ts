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

  it('starts with the authored body selection before the table and rows upgrade', async () => {
    const page = await create(`
      <md-table-container>
        <md-table-toolbar auto-bind headline="Users"></md-table-toolbar>
        <md-table selection="multiple">
          <md-table-head><md-table-row selected></md-table-row></md-table-head>
          <md-table-body>
            <md-table-row selected></md-table-row>
            <md-table-row selected disabled></md-table-row>
            <md-table-row selected selectable="false"></md-table-row>
          </md-table-body>
        </md-table>
      </md-table-container>`);
    const toolbar = page.body.querySelector('md-table-toolbar')!;
    const caption = () => toolbar.shadowRoot!.querySelector('[part="selection-caption"]');
    expect(caption()?.textContent).toBe('1 selected');
    expect(caption()).not.toHaveClass('md-table-toolbar__selection-caption--entering');

    page.body.querySelector('md-table')!.dispatchEvent(new CustomEvent('mdSelectionChange', { detail: { count: 2 } }));
    await page.waitForChanges();
    expect(caption()?.textContent).toBe('2 selected');
  });

  it('keeps newer selection events when an initial table snapshot resolves later', async () => {
    const page = await create('<md-table-container><md-table></md-table></md-table-container>');
    const table = page.body.querySelector('md-table')!;
    let resolveSelection!: (selection: Awaited<ReturnType<typeof table.getSelection>>) => void;
    table.getSelection = jest.fn(() => new Promise(resolve => { resolveSelection = resolve; }));
    const toolbar = page.doc.createElement('md-table-toolbar');
    toolbar.setAttribute('auto-bind', '');
    table.parentElement!.prepend(toolbar);
    await page.waitForChanges();

    table.dispatchEvent(new CustomEvent('mdSelectionChange', { detail: { count: 2 } }));
    resolveSelection({ count: 1, total: 3, all: false, indeterminate: true, values: ['1'] });
    await page.waitForChanges();
    expect(toolbar.shadowRoot!.querySelector('[part="selection-caption"]')?.textContent).toBe('2 selected');
  });

  it('exposes parts', async () => {
    const page = await create('<md-table-toolbar headline="x"></md-table-toolbar>');
    const shadow = page.root?.shadowRoot;
    expect(shadow?.querySelector('[part="leading"]')).toBeTruthy();
    expect(shadow?.querySelector('[part="main"]')).toBeTruthy();
    expect(shadow?.querySelector('[part="actions"]')).toBeTruthy();
  });
});
