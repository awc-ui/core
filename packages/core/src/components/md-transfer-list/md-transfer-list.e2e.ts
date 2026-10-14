import { newE2EPage, type E2EPage } from '@stencil/core/testing';

const ITEMS = [
  { value: 'apple', label: 'Apple', description: 'Red fruit' },
  { value: 'banana', label: 'Banana', description: 'Yellow fruit' },
  { value: 'cherry', label: 'Cherry', description: 'Red fruit' },
  { value: 'locked', label: 'Reserved', disabled: true },
];
const SOURCE = 'md-transfer-list >>> [part~="column-source"]';
const TARGET = 'md-transfer-list >>> [part~="column-target"]';

async function mount(page: E2EPage, attrs = '') {
  await page.setContent(`<md-transfer-list style="width:700px" ${attrs}></md-transfer-list>`);
  const list = await page.find('md-transfer-list');
  await list.setProperty('items', ITEMS);
  await list.setProperty('value', ['banana']);
  await page.waitForChanges();
  return list;
}

async function labels(page: E2EPage, side: 'source' | 'target') {
  return page.evaluate((column) => Array.from(document.querySelector('md-transfer-list')!.shadowRoot!
    .querySelectorAll(`[part~="column-${column}"] .md-transfer-list__label`), (item) => item.textContent), side);
}

async function search(page: E2EPage, side: 'source' | 'target', query: string) {
  await page.evaluate((column) => {
    const field = document.querySelector('md-transfer-list')!.shadowRoot!
      .querySelector(`[part~="column-${column}"] md-text-field`)!;
    const input = field.shadowRoot!.querySelector('input')!;
    input.focus();
    input.select();
  }, side);
  await page.keyboard.press('Backspace');
  await page.keyboard.type(query);
  await page.waitForChanges();
}

async function move(page: E2EPage, label: string) {
  await (await page.find(`md-transfer-list >>> [part="controls"] md-icon-button[aria-label="${label}"]`)).click();
  await page.waitForChanges();
}

describe('md-transfer-list browser behavior', () => {
  it('renders both partitions and reconciles externally replaced data and target values', async () => {
    const page = await newE2EPage();
    const list = await mount(page);
    expect(await labels(page, 'source')).toEqual(['Apple', 'Cherry', 'Reserved']);
    expect(await labels(page, 'target')).toEqual(['Banana']);
    expect((await page.find(`${SOURCE} [role="listbox"]`)).getAttribute('aria-multiselectable')).toBe('true');
    const change = await list.spyOnEvent('mdChange');
    await list.setProperty('items', [{ value: 'new', label: 'New choice' }, ITEMS[0]]);
    await list.setProperty('value', ['apple']);
    await page.waitForChanges();
    expect(await labels(page, 'source')).toEqual(['New choice']);
    expect(await labels(page, 'target')).toEqual(['Apple']);
    expect(change).toHaveReceivedEventTimes(0);
  });

  it('moves keyboard-selected rows in both directions and emits the exact committed values', async () => {
    const page = await newE2EPage();
    const list = await mount(page);
    const change = await list.spyOnEvent('mdChange');
    const moved = await list.spyOnEvent('mdMove');
    await (await page.find(`${SOURCE} [role="option"]`)).press('Space');
    await page.waitForChanges();
    expect((await page.find(`${SOURCE} [role="option"]`)).getAttribute('aria-selected')).toBe('true');
    expect((await page.find(`${SOURCE} [part="count"]`)).textContent).toBe('1/2 selected');
    await move(page, 'Move selected to target');
    expect(await list.getProperty('value')).toEqual(['banana', 'apple']);
    expect(change).toHaveReceivedEventDetail(['banana', 'apple']);
    expect(moved.lastEvent.detail).toEqual({ direction: 'right', moved: ['apple'], target: ['banana', 'apple'] });
    expect(await labels(page, 'target')).toEqual(['Apple', 'Banana']);
    expect((await page.find(`${SOURCE} [part="count"]`)).textContent).toBe('0/1 selected');

    await (await page.find(`${TARGET} [role="option"]`)).press('Enter');
    await page.waitForChanges();
    await move(page, 'Move selected to source');
    expect(await list.getProperty('value')).toEqual(['banana']);
    expect(moved.lastEvent.detail).toEqual({ direction: 'left', moved: ['apple'], target: ['banana'] });
    expect(change).toHaveReceivedEventTimes(2);
    expect(moved).toHaveReceivedEventTimes(2);
  });

  it('moves only checked rows matching the live search, including description matches', async () => {
    const page = await newE2EPage();
    const list = await mount(page);
    const rows = await page.findAll(`${SOURCE} [role="option"]`);
    await rows[0].click();
    await rows[1].click();
    await page.waitForChanges();
    await search(page, 'source', 'apple');
    expect(await labels(page, 'source')).toEqual(['Apple']);
    const moved = await list.spyOnEvent('mdMove');
    await move(page, 'Move selected to target');
    expect(moved.lastEvent.detail).toEqual({ direction: 'right', moved: ['apple'], target: ['banana', 'apple'] });
    expect((await page.find(`${SOURCE} [part="empty"]`)).textContent).toBe('No items');

    await search(page, 'source', 'red fruit');
    expect(await labels(page, 'source')).toEqual(['Cherry']);
    expect((await page.find(`${SOURCE} [role="option"]`)).getAttribute('aria-selected')).toBe('false');
    await search(page, 'target', 'YELLOW');
    expect(await labels(page, 'target')).toEqual(['Banana']);
    expect(await list.getProperty('value')).toEqual(['banana', 'apple']);
  });

  it('bulk-moves eligible rows while disabled items remain on their original side', async () => {
    const page = await newE2EPage();
    const list = await mount(page);
    const moved = await list.spyOnEvent('mdMove');
    const disabled = await page.find(`${SOURCE} [aria-disabled="true"][role="option"]`);
    expect(disabled.getAttribute('tabindex')).toBe('-1');
    await disabled.click();
    await page.waitForChanges();
    expect(disabled.getAttribute('aria-selected')).toBe('false');
    await move(page, 'Move all to target');
    expect(await list.getProperty('value')).toEqual(['banana', 'apple', 'cherry']);
    expect(await labels(page, 'source')).toEqual(['Reserved']);
    expect(moved.lastEvent.detail).toEqual({ direction: 'right', moved: ['apple', 'cherry'], target: ['banana', 'apple', 'cherry'] });
    await move(page, 'Move all to source');
    expect(await list.getProperty('value')).toEqual([]);
    expect(await labels(page, 'target')).toEqual([]);
    expect(moved.lastEvent.detail).toEqual({ direction: 'left', moved: ['apple', 'banana', 'cherry'], target: [] });
  });

  it('blocks selection and movement while disabled, then restores interaction when enabled', async () => {
    const page = await newE2EPage();
    const list = await mount(page, 'disabled');
    const moved = await list.spyOnEvent('mdMove');
    expect(list.getAttribute('aria-disabled')).toBe('true');
    const row = await page.find(`${SOURCE} [role="option"]`);
    expect(row.getAttribute('tabindex')).toBe('-1');
    await row.click();
    await list.callMethod('moveSelectedRight');
    await move(page, 'Move all to target');
    expect(await list.getProperty('value')).toEqual(['banana']);
    expect(moved).toHaveReceivedEventTimes(0);
    expect(await page.evaluate(() => Array.from(document.querySelector('md-transfer-list')!.shadowRoot!
      .querySelectorAll('md-text-field'), (field) => field.shadowRoot!.querySelector('input')!.disabled))).toEqual([true, true]);

    await list.setProperty('disabled', false);
    await page.waitForChanges();
    await (await page.find(`${SOURCE} [role="option"]`)).press('Enter');
    await list.callMethod('moveSelectedRight');
    await page.waitForChanges();
    expect(await list.getProperty('value')).toEqual(['banana', 'apple']);
    expect(moved).toHaveReceivedEventTimes(1);
  });
});
