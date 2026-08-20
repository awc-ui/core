import { newSpecPage } from '@stencil/core/testing';
import { MdTable } from './md-table';
import { MdTableHead } from '../md-table-head/md-table-head';
import { MdTableBody } from '../md-table-body/md-table-body';
import { MdTableRow } from '../md-table-row/md-table-row';
import { MdTableCell } from '../md-table-cell/md-table-cell';

/**
 * Column pinning and visibility. Neither could be tested before: both go
 * through `ensurePinBase`, which used `:scope >` — and mock-doc's selector
 * engine throws on `:scope`, so every call rejected before reaching its own
 * logic.
 */
const create = (html: string) =>
  newSpecPage({
    components: [MdTable, MdTableHead, MdTableBody, MdTableRow, MdTableCell],
    html,
  });

type Table = HTMLElement & {
  pinColumn(column: number, side: 'start' | 'end' | 'none'): Promise<'start' | 'end' | null>;
  setColumnVisibility(column: number, visible: boolean): Promise<boolean>;
  animateNextChange(): Promise<void>;
  columnTemplate?: string;
};

const table = (cols = 3, template = '1fr 1fr 1fr') => {
  const cells = (prefix: string) =>
    Array.from({ length: cols }, (_, i) => `<md-table-cell>${prefix}${i}</md-table-cell>`).join('');
  return `<md-table column-template="${template}">
    <md-table-head><md-table-row>${cells('H')}</md-table-row></md-table-head>
    <md-table-body>
      <md-table-row>${cells('A')}</md-table-row>
      <md-table-row>${cells('B')}</md-table-row>
    </md-table-body>
  </md-table>`;
};

describe('md-table — columns', () => {
  describe('pinColumn', () => {
    it('pins a column to the start and reports the effective side', async () => {
      const page = await create(table());
      const el = page.root as Table;
      await expect(el.pinColumn(0, 'start')).resolves.toBe('start');
    });

    it('pins to the end', async () => {
      const page = await create(table());
      await expect((page.root as Table).pinColumn(2, 'end')).resolves.toBe('end');
    });

    it('unpins with "none"', async () => {
      const page = await create(table());
      const el = page.root as Table;
      await el.pinColumn(0, 'start');
      await expect(el.pinColumn(0, 'none')).resolves.toBeNull();
    });

    it('treats re-pinning to the same side as a toggle off', async () => {
      const page = await create(table());
      const el = page.root as Table;
      await el.pinColumn(1, 'start');
      await expect(el.pinColumn(1, 'start')).resolves.toBeNull();
    });

    it('moves a column between edges', async () => {
      const page = await create(table());
      const el = page.root as Table;
      await el.pinColumn(1, 'start');
      await expect(el.pinColumn(1, 'end')).resolves.toBe('end');
    });

    it('announces the change', async () => {
      const page = await create(table());
      const el = page.root as Table;
      const onPin = jest.fn();
      el.addEventListener('mdPinChange', onPin);
      await el.pinColumn(0, 'start');
      expect(onPin).toHaveBeenCalledTimes(1);
      expect((onPin.mock.calls[0][0] as CustomEvent).detail).toEqual({ column: 0, side: 'start' });
    });

    it('declines without an explicit column template', async () => {
      const page = await create(`<md-table>
        <md-table-body><md-table-row><md-table-cell>A</md-table-cell></md-table-row></md-table-body>
      </md-table>`);
      // Pinning has to permute real tracks; there is nothing to permute here.
      await expect((page.root as Table).pinColumn(0, 'start')).resolves.toBeNull();
    });

    it('declines a repeat() template, whose tracks it cannot address', async () => {
      const page = await create(table(3, 'repeat(3, 1fr)'));
      await expect((page.root as Table).pinColumn(0, 'start')).resolves.toBeNull();
    });

    it('declines when a row has the wrong number of cells', async () => {
      const page = await create(`<md-table column-template="1fr 1fr 1fr">
        <md-table-body>
          <md-table-row><md-table-cell>A</md-table-cell><md-table-cell>B</md-table-cell></md-table-row>
        </md-table-body>
      </md-table>`);
      await expect((page.root as Table).pinColumn(0, 'start')).resolves.toBeNull();
    });

    it('declines when a cell spans columns', async () => {
      const page = await create(`<md-table column-template="1fr 1fr 1fr">
        <md-table-body>
          <md-table-row>
            <md-table-cell colspan="2">A</md-table-cell>
            <md-table-cell>B</md-table-cell>
          </md-table-row>
        </md-table-body>
      </md-table>`);
      // A spanned cell has no single column to move.
      await expect((page.root as Table).pinColumn(0, 'start')).resolves.toBeNull();
    });
  });

  describe('setColumnVisibility', () => {
    it('hides a column and reports it hidden', async () => {
      const page = await create(table());
      await expect((page.root as Table).setColumnVisibility(1, false)).resolves.toBe(false);
    });

    it('shows it again', async () => {
      const page = await create(table());
      const el = page.root as Table;
      await el.setColumnVisibility(1, false);
      await expect(el.setColumnVisibility(1, true)).resolves.toBe(true);
    });

    it('announces the change with the full hidden set, sorted', async () => {
      const page = await create(table());
      const el = page.root as Table;
      const onVis = jest.fn();
      el.addEventListener('mdColumnVisibilityChange', onVis);
      await el.setColumnVisibility(2, false);
      await el.setColumnVisibility(0, false);
      const last = (onVis.mock.calls[1][0] as CustomEvent).detail;
      expect(last).toEqual({ column: 0, visible: false, hidden: [0, 2] });
    });

    it('refuses to hide the last visible column', async () => {
      const page = await create(table());
      const el = page.root as Table;
      await el.setColumnVisibility(0, false);
      await el.setColumnVisibility(1, false);
      // A table with no columns left is not a state worth reaching.
      await expect(el.setColumnVisibility(2, false)).resolves.toBe(true);
    });

    it('is a no-op for an out-of-range column', async () => {
      const page = await create(table());
      const el = page.root as Table;
      await expect(el.setColumnVisibility(99, false)).resolves.toBe(true);
      await expect(el.setColumnVisibility(-1, false)).resolves.toBe(true);
    });

    it('hiding an already-hidden column keeps it hidden', async () => {
      const page = await create(table());
      const el = page.root as Table;
      await el.setColumnVisibility(1, false);
      await expect(el.setColumnVisibility(1, false)).resolves.toBe(false);
    });

    it('declines without an explicit column template', async () => {
      const page = await create(`<md-table>
        <md-table-body><md-table-row><md-table-cell>A</md-table-cell></md-table-row></md-table-body>
      </md-table>`);
      await expect((page.root as Table).setColumnVisibility(0, false)).resolves.toBe(true);
    });
  });

  describe('pinning and hiding together', () => {
    it('keeps both states independent', async () => {
      const page = await create(table());
      const el = page.root as Table;
      await el.pinColumn(0, 'start');
      await el.setColumnVisibility(1, false);
      // Hiding a different column must not disturb the pin.
      await expect(el.pinColumn(0, 'start')).resolves.toBeNull(); // toggles off, so it WAS pinned
      await expect(el.setColumnVisibility(1, true)).resolves.toBe(true);
    });
  });

  describe('animateNextChange', () => {
    it('arms the FLIP without throwing when nothing follows', async () => {
      const page = await create(table());
      await expect((page.root as Table).animateNextChange()).resolves.toBeUndefined();
    });

    it('can be armed repeatedly', async () => {
      const page = await create(table());
      const el = page.root as Table;
      await el.animateNextChange();
      await expect(el.animateNextChange()).resolves.toBeUndefined();
    });
  });
});
