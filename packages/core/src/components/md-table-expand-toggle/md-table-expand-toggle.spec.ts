import { newSpecPage } from '@stencil/core/testing';
import { MdTableExpandToggle } from './md-table-expand-toggle';
import { MdTableRow } from '../md-table-row/md-table-row';
import { MdIconButton } from '../md-icon-button/md-icon-button';
import { MdTable } from '../md-table/md-table';
import { MdTableBody } from '../md-table-body/md-table-body';
import { MdTableCell } from '../md-table-cell/md-table-cell';

const create = (html: string) =>
  newSpecPage({ components: [MdTableExpandToggle, MdTableRow, MdIconButton], html });

describe('md-table-expand-toggle', () => {
  it('renders the standard xs caret with aria wiring', async () => {
    const page = await create(`
      <md-table-row expandable>
        <md-table-expand-toggle></md-table-expand-toggle>
      </md-table-row>`);
    const btn = page.body.querySelector('md-table-expand-toggle')!.shadowRoot!.querySelector('md-icon-button')!;
    // size/icon are set as JSX properties (md-icon-button doesn't reflect them)
    expect((btn as any).size).toBe('xs'); // ONE size across all tables
    expect((btn as any).icon).toBe('chevron_right');
    expect(btn.getAttribute('aria-label')).toBe('Expand row');
    expect(btn.getAttribute('aria-expanded')).toBe('false');
  });

  it('click toggles the owning row and rotates via the expanded class', async () => {
    const page = await create(`
      <md-table-row expandable>
        <md-table-expand-toggle></md-table-expand-toggle>
        <div slot="expanded">Details</div>
      </md-table-row>`);
    const row = page.body.querySelector('md-table-row') as HTMLElement & { expanded: boolean };
    const toggle = page.body.querySelector('md-table-expand-toggle')!;
    const btn = toggle.shadowRoot!.querySelector('md-icon-button')!;

    (btn as HTMLElement).click();
    // row.toggle() resolves through the @Method proxy on a microtask in the
    // spec env, so the expanded-change cascade needs a second flush.
    await page.waitForChanges();
    await page.waitForChanges();
    expect(row.expanded).toBe(true);
    expect(toggle).toHaveClass('md-table-expand-toggle--expanded');
    expect(btn.getAttribute('aria-expanded')).toBe('true');

    (btn as HTMLElement).click();
    await page.waitForChanges();
    await page.waitForChanges();
    expect(row.expanded).toBe(false);
    expect(toggle).not.toHaveClass('md-table-expand-toggle--expanded');
  });

  it('mirrors a row expanded programmatically (external toggle())', async () => {
    const page = await create(`
      <md-table-row expandable>
        <md-table-expand-toggle></md-table-expand-toggle>
      </md-table-row>`);
    const row = page.body.querySelector('md-table-row') as HTMLElement & {
      toggle: () => Promise<void>;
    };
    await row.toggle();
    await page.waitForChanges();
    expect(page.body.querySelector('md-table-expand-toggle')).toHaveClass(
      'md-table-expand-toggle--expanded',
    );
  });

  it('supports a custom button label', async () => {
    const page = await create(`
      <md-table-row expandable>
        <md-table-expand-toggle button-label="Show order details"></md-table-expand-toggle>
      </md-table-row>`);
    const btn = page.body.querySelector('md-table-expand-toggle')!.shadowRoot!.querySelector('md-icon-button')!;
    expect(btn.getAttribute('aria-label')).toBe('Show order details');
  });

  it('starts expanded when the row is already open', async () => {
    const page = await create(`
      <md-table-row expandable expanded>
        <md-table-expand-toggle></md-table-expand-toggle>
      </md-table-row>`);
    expect(page.body.querySelector('md-table-expand-toggle')).toHaveClass(
      'md-table-expand-toggle--expanded',
    );
  });

  it('survives a row re-append (sort/page reorder) and still toggles', async () => {
    const page = await newSpecPage({
      components: [MdTable, MdTableBody, MdTableRow, MdTableCell, MdTableExpandToggle, MdIconButton],
      html: `
        <md-table label="t" columns="2">
          <md-table-body id="b">
            <md-table-row expandable id="r1">
              <md-table-cell><md-table-expand-toggle></md-table-expand-toggle></md-table-cell>
              <md-table-cell>one</md-table-cell>
            </md-table-row>
            <md-table-row expandable id="r2">
              <md-table-cell>x</md-table-cell><md-table-cell>two</md-table-cell>
            </md-table-row>
          </md-table-body>
        </md-table>
      `,
    });
    const body = page.body.querySelector('#b')!;
    const r1 = page.body.querySelector('#r1') as HTMLElement & { expanded: boolean };
    // Reorder exactly like the documented sort pattern: re-append r1.
    body.appendChild(r1);
    await page.waitForChanges();
    const toggle = r1.querySelector('md-table-expand-toggle')!;
    const btn = toggle.shadowRoot!.querySelector('md-icon-button') as HTMLElement;
    btn.click();
    await page.waitForChanges();
    await page.waitForChanges();
    // willLoad-only binding left this permanently false after re-append.
    expect(r1.expanded).toBe(true);
  });


  it('icon prop reaches the inner icon-button', async () => {
    const page = await newSpecPage({
      components: [MdTableExpandToggle, MdTableRow, MdIconButton],
      html: '<md-table-row expandable><md-table-expand-toggle icon="add_circle"></md-table-expand-toggle></md-table-row>',
    });
    const btn = page.body.querySelector('md-table-expand-toggle')!.shadowRoot!.querySelector('md-icon-button') as HTMLElement & { icon: string };
    expect(btn.icon).toBe('add_circle');
  });

});
