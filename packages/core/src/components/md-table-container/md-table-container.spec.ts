import { newSpecPage } from '@stencil/core/testing';
import { MdTableContainer } from './md-table-container';

const create = (html: string) =>
  newSpecPage({ components: [MdTableContainer], html });

describe('md-table-container', () => {
  it('arms only the contained table for pagination events and shares its size constraints', async () => {
    const page = await create('<md-table-container min-height="120px" max-height="300px"><md-table></md-table><md-table-pagination slot="bottom"></md-table-pagination><button>Other action</button></md-table-container>');
    const table = page.root!.querySelector('md-table')!;
    const pagination = page.root!.querySelector('md-table-pagination')!;
    const order: string[] = [];
    table.addEventListener('mdMotionArm', () => order.push('capture'));
    pagination.addEventListener('mdPageChange', () => order.push('consumer'));
    pagination.dispatchEvent(new CustomEvent('mdPageChange', { bubbles: true, detail: { page: 1 } }));
    pagination.dispatchEvent(new CustomEvent('mdRowsPerPageChange', { bubbles: true, detail: { rowsPerPage: 25 } }));
    page.root!.querySelector('button')!.dispatchEvent(new CustomEvent('mdPageChange', { bubbles: true }));
    // Capture ordering is checked in Chromium: mock-doc dispatches listeners
    // in bubbling order even when capture:true was requested.
    expect(order.filter(value => value === 'capture')).toHaveLength(2);
    expect(page.root!.style.getPropertyValue('--_min-h')).toBe('120px');
    expect(page.root!.style.getPropertyValue('--md-table-body-max-h')).toBe('300px');
    table.remove();
    pagination.dispatchEvent(new CustomEvent('mdPageChange', { bubbles: true }));
    expect(order.filter(value => value === 'capture')).toHaveLength(2);
  });
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

describe('md-table-container observed layout', () => {
  it('observes only table placement and frozen-header changes, then disconnects on removal', async () => {
    const original = globalThis.MutationObserver;
    const observers: Array<{ callback: MutationCallback; observe: jest.Mock; disconnect: jest.Mock }> = [];
    class Observer {
      observe = jest.fn(); disconnect = jest.fn(); takeRecords = () => [];
      constructor(public callback: MutationCallback) { observers.push(this); }
    }
    globalThis.MutationObserver = Observer as unknown as typeof MutationObserver;
    try {
      const page = await create('<md-table-container><span>Caption</span></md-table-container>');
      const [attributes, children] = observers;
      expect(attributes.observe).toHaveBeenCalledWith(page.root, { subtree: true, attributes: true, attributeFilter: ['frozen-header'] });
      expect(children.observe).toHaveBeenCalledWith(page.root, { childList: true });
      const table = document.createElement('md-table'); table.setAttribute('frozen-header', ''); page.root!.append(table);
      children.callback([{ addedNodes: [document.createElement('span')], removedNodes: [] }, { addedNodes: [table], removedNodes: [] }] as unknown as MutationRecord[], children as unknown as MutationObserver);
      await page.waitForChanges();
      expect(page.root).toHaveClass('md-table-container--frozen-header');
      table.removeAttribute('frozen-header');
      attributes.callback([], attributes as unknown as MutationObserver); await page.waitForChanges();
      expect(page.root).not.toHaveClass('md-table-container--frozen-header');
      table.remove(); children.callback([{ addedNodes: [], removedNodes: [table] }] as unknown as MutationRecord[], children as unknown as MutationObserver);
      await page.waitForChanges(); page.root!.remove(); await page.waitForChanges();
      expect(attributes.disconnect).toHaveBeenCalledTimes(1); expect(children.disconnect).toHaveBeenCalledTimes(1);
    } finally { globalThis.MutationObserver = original; }
  });
});
