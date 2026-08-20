import { newSpecPage } from '@stencil/core/testing';
import { MdTablePagination } from './md-table-pagination';

const create = (html: string) =>
  newSpecPage({ components: [MdTablePagination], html });

describe('md-table-pagination', () => {
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
