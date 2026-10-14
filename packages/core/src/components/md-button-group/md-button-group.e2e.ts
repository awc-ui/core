import { newE2EPage, E2EPage } from '@stencil/core/testing';

const choices = '<md-button id="a" value="a" selected>Alpha</md-button><md-button id="b" value="b">Beta</md-button><md-button id="c" value="c">Gamma</md-button>';
const selected = (page: E2EPage) => page.evaluate(() =>
  Array.from(document.querySelectorAll('md-button-group md-button')).filter((el: any) => el.selected).map((el: any) => el.value));
const activeId = (page: E2EPage) => page.evaluate(() => document.activeElement?.id);

describe('md-button-group browser behavior', () => {
  it('replaces the single selection and reports its added/removed values once', async () => {
    const page = await newE2EPage();
    await page.setContent(`<md-button-group aria-label="Choice">${choices}</md-button-group>`);
    const group = await page.find('md-button-group');
    const change = await group.spyOnEvent('mdSelectionChange');
    await (await page.find('#b')).click();
    await page.waitForChanges();
    expect(await selected(page)).toEqual(['b']);
    expect(change).toHaveReceivedEventTimes(1);
    expect(change.lastEvent.detail).toMatchObject({ values: ['b'], added: ['b'], removed: ['a'] });
    expect(group.getAttribute('role')).toBe('radiogroup');
    expect(group.getAttribute('aria-orientation')).toBe('horizontal');
  });

  it('allows independent selections in multi-select mode and removal of one value', async () => {
    const page = await newE2EPage();
    await page.setContent(`<md-button-group selection-mode="multi-select" aria-label="Choices">${choices}</md-button-group>`);
    const group = await page.find('md-button-group');
    const change = await group.spyOnEvent('mdSelectionChange');
    await (await page.find('#b')).click();
    await page.waitForChanges();
    expect(await selected(page)).toEqual(['a', 'b']);
    await (await page.find('#a')).click();
    await page.waitForChanges();
    expect(await selected(page)).toEqual(['b']);
    expect(change.lastEvent.detail).toMatchObject({ values: ['b'], added: [], removed: ['a'] });
    expect(group.getAttribute('role')).toBe('group');
    expect(group.getAttribute('aria-orientation')).toBeNull();
  });

  it('keeps the final selection when required and allows clearing after required is removed', async () => {
    const page = await newE2EPage();
    await page.setContent(`<md-button-group required>${choices}</md-button-group>`);
    const group = await page.find('md-button-group');
    const change = await group.spyOnEvent('mdSelectionChange');
    await (await page.find('#a')).click();
    await page.waitForChanges();
    expect(await selected(page)).toEqual(['a']);
    expect(change.lastEvent.detail).toMatchObject({ values: ['a'], added: [], removed: [] });
    await group.setProperty('required', false);
    await page.waitForChanges();
    await (await page.find('#a')).click();
    await page.waitForChanges();
    expect(await selected(page)).toEqual([]);
    expect(change.lastEvent.detail).toMatchObject({ values: [], added: [], removed: ['a'] });
  });

  it('moves keyboard focus past disabled choices, wraps, and activates with Enter', async () => {
    const page = await newE2EPage();
    await page.setContent(`<md-button-group>${choices.replace('id="b"', 'id="b" disabled')}</md-button-group>`);
    await (await page.find('#a')).focus();
    await page.keyboard.press('ArrowRight');
    await page.waitForChanges();
    expect(await activeId(page)).toBe('c');
    expect(await selected(page)).toEqual(['a']);
    await page.keyboard.press('Enter');
    await page.waitForChanges();
    expect(await selected(page)).toEqual(['c']);
    await page.keyboard.press('ArrowRight');
    await page.waitForChanges();
    expect(await activeId(page)).toBe('a');
    await page.keyboard.press('End');
    await page.waitForChanges();
    expect(await activeId(page)).toBe('c');
    await page.keyboard.press('Home');
    await page.waitForChanges();
    expect(await activeId(page)).toBe('a');
  });

  it('reverses horizontal keyboard navigation in an inherited RTL direction', async () => {
    const page = await newE2EPage();
    await page.setContent(`<div dir="rtl"><md-button-group>${choices}</md-button-group></div>`);
    await (await page.find('#a')).focus();
    await page.keyboard.press('ArrowLeft');
    await page.waitForChanges();
    expect(await activeId(page)).toBe('b');
    await page.keyboard.press('ArrowRight');
    await page.waitForChanges();
    expect(await activeId(page)).toBe('a');
  });

  it('synchronizes connected styling and size when children are inserted and removed', async () => {
    const page = await newE2EPage();
    await page.setContent(`<md-button-group variant="connected" size="lg" shape="square">${choices}</md-button-group>`);
    const states = () => page.evaluate(() => Array.from(document.querySelectorAll('md-button-group md-button')).map((el: any) =>
      ({ id: el.id, left: el.connectedLeft, right: el.connectedRight, size: el.size, shape: el.shape, toggle: el.toggle })));
    expect(await states()).toEqual([
      { id: 'a', left: false, right: true, size: 'lg', shape: 'square', toggle: true },
      { id: 'b', left: true, right: true, size: 'lg', shape: 'square', toggle: true },
      { id: 'c', left: true, right: false, size: 'lg', shape: 'square', toggle: true },
    ]);
    await page.evaluate(() => {
      document.querySelector('#c')!.remove();
      const button = document.createElement('md-button');
      button.id = 'd'; button.textContent = 'Delta';
      document.querySelector('md-button-group')!.append(button);
    });
    await page.waitForChanges();
    expect((await states()).map(({ id, left, right }) => ({ id, left, right }))).toEqual([
      { id: 'a', left: false, right: true }, { id: 'b', left: true, right: true }, { id: 'd', left: true, right: false },
    ]);
    const group = await page.find('md-button-group');
    await group.setProperty('variant', 'standard');
    await group.setProperty('size', 'xs');
    await page.waitForChanges();
    expect((await states()).every(state => !state.left && !state.right && state.size === 'xs' && state.toggle)).toBe(true);
  });
});
