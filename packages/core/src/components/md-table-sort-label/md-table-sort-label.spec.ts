import { newSpecPage } from '@stencil/core/testing';
import { MdTableSortLabel } from './md-table-sort-label';

const create = (html: string) =>
  newSpecPage({ components: [MdTableSortLabel], html });

describe('md-table-sort-label', () => {
  it('renders with role=button', async () => {
    const page = await create('<md-table-sort-label column="name">Name</md-table-sort-label>');
    expect(page.root?.getAttribute('role')).toBe('button');
  });

  it('is focusable by default', async () => {
    const page = await create('<md-table-sort-label column="name">Name</md-table-sort-label>');
    expect(page.root?.getAttribute('tabindex')).toBe('0');
  });

  it('is not focusable when disabled', async () => {
    const page = await create('<md-table-sort-label column="name" disabled>Name</md-table-sort-label>');
    expect(page.root?.getAttribute('tabindex')).toBe('-1');
  });

  it('emits mdSortRequest with the column id on click', async () => {
    const page = await create('<md-table-sort-label column="age">Age</md-table-sort-label>');
    const spy = jest.fn();
    page.root?.addEventListener('mdSortRequest', spy);
    page.root?.click();
    await page.waitForChanges();
    expect(spy).toHaveBeenCalled();
    expect(spy.mock.calls[0][0].detail).toEqual({ column: 'age', defaultOrder: 'asc' });
  });

  it('does not emit when disabled', async () => {
    const page = await create('<md-table-sort-label column="age" disabled>Age</md-table-sort-label>');
    const spy = jest.fn();
    page.root?.addEventListener('mdSortRequest', spy);
    page.root?.click();
    await page.waitForChanges();
    expect(spy).not.toHaveBeenCalled();
  });

  it('Enter and Space activate the sort request', async () => {
    const page = await create('<md-table-sort-label column="age">Age</md-table-sort-label>');
    const spy = jest.fn();
    page.root?.addEventListener('mdSortRequest', spy);
    page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await page.waitForChanges();
    expect(spy).toHaveBeenCalledTimes(1);

    page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    await page.waitForChanges();
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('renders the arrow icon', async () => {
    const page = await create('<md-table-sort-label column="age">Age</md-table-sort-label>');
    expect(page.root?.shadowRoot?.querySelector('[part="icon"]')).toBeTruthy();
  });

  it('exposes label part', async () => {
    const page = await create('<md-table-sort-label column="age">Age</md-table-sort-label>');
    expect(page.root?.shadowRoot?.querySelector('[part="label"]')).toBeTruthy();
  });

  it('icon prop swaps the built-in SVG arrow for a ligature glyph', async () => {
    const page = await create('<md-table-sort-label column="x" icon="north">X</md-table-sort-label>');
    const icon = page.root!.shadowRoot!.querySelector('[part="icon"]')!;
    expect(icon.querySelector('.md-table-sort-label__icon-glyph')?.textContent).toBe('north');
    expect(icon.querySelector('svg')).toBeNull();
  });

});
