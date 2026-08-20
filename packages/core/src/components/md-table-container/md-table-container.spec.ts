import { newSpecPage } from '@stencil/core/testing';
import { MdTableContainer } from './md-table-container';

const create = (html: string) =>
  newSpecPage({ components: [MdTableContainer], html });

describe('md-table-container', () => {
  it('renders with defaults', async () => {
    const page = await create('<md-table-container></md-table-container>');
    expect(page.root).toBeTruthy();
    expect(page.root).toHaveClass('md-table-container');
    expect(page.root).toHaveClass('md-table-container--elevated');
    expect(page.root).toHaveClass('md-table-container--shape-large');
  });

  it('reflects variant', async () => {
    const page = await create('<md-table-container variant="outlined"></md-table-container>');
    expect(page.root).toHaveClass('md-table-container--outlined');
  });

  it('reflects shape', async () => {
    const page = await create('<md-table-container shape="medium"></md-table-container>');
    expect(page.root).toHaveClass('md-table-container--shape-medium');
  });

  it('adds scrollable class when max-height is set', async () => {
    const page = await create('<md-table-container max-height="300px"></md-table-container>');
    expect(page.root).toHaveClass('md-table-container--scrollable');
  });

  it('mirrors the frozen-header class from the slotted table attribute', async () => {
    // Frozen is EXPLICIT (md-table[frozen-header]); this mirror must stay in
    // lockstep with the table's own prop — a mismatch nests two scrollbars.
    const page = await create(
      '<md-table-container max-height="300px"><md-table frozen-header></md-table></md-table-container>',
    );
    expect(page.root).toHaveClass('md-table-container--frozen-header');
  });

  it('does not freeze without the frozen-header attribute (max-height only sizes)', async () => {
    const noProp = await create(
      '<md-table-container max-height="300px"><md-table></md-table></md-table-container>',
    );
    expect(noProp.root).not.toHaveClass('md-table-container--frozen-header');
    const noTable = await create('<md-table-container max-height="300px"></md-table-container>');
    expect(noTable.root).not.toHaveClass('md-table-container--frozen-header');
  });

  it('exposes top / scroll / bottom parts', async () => {
    const page = await create('<md-table-container></md-table-container>');
    const shadow = page.root?.shadowRoot;
    expect(shadow?.querySelector('[part="top"]')).toBeTruthy();
    expect(shadow?.querySelector('[part="scroll"]')).toBeTruthy();
    expect(shadow?.querySelector('[part="bottom"]')).toBeTruthy();
  });

  it('renders the default slot inside scroll', async () => {
    const page = await create('<md-table-container></md-table-container>');
    const slot = page.root?.shadowRoot?.querySelector('.md-table-container__scroll slot');
    expect(slot).toBeTruthy();
  });
});
