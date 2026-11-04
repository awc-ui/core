import { newSpecPage } from '@stencil/core/testing';
import { MdTablePagination } from './md-table-pagination';

const create = (html: string) =>
  newSpecPage({ components: [MdTablePagination], html });

describe('md-table-pagination', () => {
  it('drives first, previous, next and last navigation through its rendered controls', async () => {
    const page = await create('<md-table-pagination count="23" rows-per-page="5" show-first-last></md-table-pagination>');
    const changed = jest.fn();
    page.root!.addEventListener('mdPageChange', changed);
    for (const [part, expected] of [['last', 4], ['prev', 3], ['first', 0], ['next', 1]] as const) {
      (page.root!.shadowRoot!.querySelector(`[part="${part}-button"]`) as HTMLElement).click();
      await page.waitForChanges();
      expect(page.root!.page).toBe(expected);
      expect(changed.mock.calls.at(-1)![0].detail).toEqual({ page: expected });
    }
    expect(page.root!.shadowRoot!.querySelector('[part="display"]')!.textContent).toBe('6–10 of 23');
  });

  it('accepts valid rows-per-page choices and rejects invalid choices', async () => {
    const page = await create('<md-table-pagination count="23" page="2" rows-per-page="5" rows-per-page-options="5, ,bad,0,-1,ALL,10"></md-table-pagination>');
    const select = page.root!.shadowRoot!.querySelector('md-select')!;
    expect(select.options).toEqual([{ value: '5', label: '5' }, { value: '23', label: 'All' }, { value: '10', label: '10' }]);
    const sizes = jest.fn();
    page.root!.addEventListener('mdRowsPerPageChange', sizes);
    select.dispatchEvent(new CustomEvent('mdChange', { detail: '10', bubbles: true, composed: true }));
    await page.waitForChanges();
    expect(page.root!.rowsPerPage).toBe(10);
    expect(page.root!.page).toBe(0);
    expect(sizes.mock.calls[0][0].detail).toEqual({ rowsPerPage: 10 });
    for (const value of ['invalid', '0', '-5', '10']) {
      select.dispatchEvent(new CustomEvent('mdChange', { detail: value, bubbles: true, composed: true }));
      await page.waitForChanges();
    }
    expect(sizes).toHaveBeenCalledTimes(1);
    await page.root!.setRowsPerPage(0);
    expect(page.root!.rowsPerPage).toBe(10);
    page.root!.count = 0;
    page.root!.rowsPerPage = 0;
    await page.waitForChanges();
    expect(page.root!.shadowRoot!.querySelector('[part="display"]')!.textContent).toBe('0–0 of 0');
    expect(select.options).not.toContainEqual({ value: '-1', label: 'All' });
  });
  describe('rendering', () => {
    it('renders with defaults', async () => {
      const page = await create('<md-table-pagination count="100"></md-table-pagination>');
      expect(page.root).toBeTruthy();
      expect(page.root?.getAttribute('role')).toBe('navigation');
    });

    it('shows the from-to-count label', async () => {
      const page = await create('<md-table-pagination count="100" rows-per-page="10" page="0"></md-table-pagination>');
      const display = page.root?.shadowRoot?.querySelector('[part="display"]');
      expect(display?.textContent).toBe('1–10 of 100');
    });

    it('clamps from / to when count is 0', async () => {
      const page = await create('<md-table-pagination count="0" rows-per-page="10"></md-table-pagination>');
      const display = page.root?.shadowRoot?.querySelector('[part="display"]');
      expect(display?.textContent).toBe('0–0 of 0');
    });

    it('updates label when page advances', async () => {
      const page = await create('<md-table-pagination count="25" rows-per-page="10" page="1"></md-table-pagination>');
      const display = page.root?.shadowRoot?.querySelector('[part="display"]');
      expect(display?.textContent).toBe('11–20 of 25');
    });

    it('clamps the last page correctly', async () => {
      const page = await create('<md-table-pagination count="25" rows-per-page="10" page="2"></md-table-pagination>');
      const display = page.root?.shadowRoot?.querySelector('[part="display"]');
      expect(display?.textContent).toBe('21–25 of 25');
    });

    it('shows first/last buttons when show-first-last is set', async () => {
      const page = await create('<md-table-pagination count="100" show-first-last></md-table-pagination>');
      expect(page.root?.shadowRoot?.querySelector('[part="first-button"]')).toBeTruthy();
      expect(page.root?.shadowRoot?.querySelector('[part="last-button"]')).toBeTruthy();
    });
  });

  describe('events', () => {
    it('emits mdPageChange via goToPage()', async () => {
      const page = await create('<md-table-pagination count="100" rows-per-page="10"></md-table-pagination>');
      const spy = jest.fn();
      page.root?.addEventListener('mdPageChange', spy);
      await page.rootInstance.goToPage(2);
      await page.waitForChanges();
      expect(spy).toHaveBeenCalled();
      expect(spy.mock.calls[0][0].detail).toEqual({ page: 2 });
    });

    it('does not emit when going to the same page', async () => {
      const page = await create('<md-table-pagination count="100" page="0"></md-table-pagination>');
      const spy = jest.fn();
      page.root?.addEventListener('mdPageChange', spy);
      await page.rootInstance.goToPage(0);
      await page.waitForChanges();
      expect(spy).not.toHaveBeenCalled();
    });

    it('clamps goToPage(-1) to 0', async () => {
      const page = await create('<md-table-pagination count="100"></md-table-pagination>');
      await page.rootInstance.goToPage(-5);
      expect(page.rootInstance.page).toBe(0);
    });

    it('emits mdRowsPerPageChange via setRowsPerPage()', async () => {
      const page = await create('<md-table-pagination count="100" rows-per-page="10"></md-table-pagination>');
      const spy = jest.fn();
      page.root?.addEventListener('mdRowsPerPageChange', spy);
      await page.rootInstance.setRowsPerPage(25);
      await page.waitForChanges();
      expect(spy).toHaveBeenCalled();
      expect(spy.mock.calls[0][0].detail).toEqual({ rowsPerPage: 25 });
    });
  });

  describe('next/prev buttons', () => {
    it('next button is disabled on the last page', async () => {
      const page = await create('<md-table-pagination count="20" rows-per-page="10" page="1"></md-table-pagination>');
      const btn = page.root?.shadowRoot?.querySelector('[part="next-button"]') as HTMLButtonElement;
      expect(btn.hasAttribute('disabled')).toBe(true);
    });

    it('prev button is disabled on the first page', async () => {
      const page = await create('<md-table-pagination count="20" rows-per-page="10" page="0"></md-table-pagination>');
      const btn = page.root?.shadowRoot?.querySelector('[part="prev-button"]') as HTMLButtonElement;
      expect(btn.hasAttribute('disabled')).toBe(true);
    });
  });

  describe('rpp re-clamping', () => {
    it('reduces page when count drops below current page range', async () => {
      const page = await create('<md-table-pagination count="100" rows-per-page="10" page="9"></md-table-pagination>');
      page.root?.setAttribute('count', '5');
      await page.waitForChanges();
      expect(page.rootInstance.page).toBe(0);
    });
  });
});
