import { newSpecPage } from '@stencil/core/testing';
import { MdList } from './md-list';
import { MdListItem } from '../md-list-item/md-list-item';

describe('md-list public configuration transitions', () => {
  it('switches selection, interaction, role and reorder policies on existing rows', async () => {
    const page = await newSpecPage({ components: [MdList, MdListItem], html: '<md-list><md-list-item headline="One"></md-list-item><md-divider></md-divider><md-list-item headline="Two"></md-list-item></md-list>' });
    const root = page.root as HTMLMdListElement;
    const rows = Array.from(root.querySelectorAll('md-list-item'));
    root.selectionMode = 'multi-select'; root.interactionMode = 'multi-action'; root.reorderable = true;
    await page.waitForChanges();
    expect(root.getAttribute('role')).toBe('listbox');
    expect(root.getAttribute('aria-multiselectable')).toBe('true');
    expect(rows.every(row => row.reorderable)).toBe(true);
    await root.selectItem(0); await root.selectItem(1); await page.waitForChanges();
    expect(await root.getSelectedIndices()).toEqual([0, 1]);
    root.roleOverride = 'menu'; await page.waitForChanges();
    expect(root.getAttribute('role')).toBe('menu');
    expect(root.querySelector('md-divider')!.hasAttribute('aria-hidden')).toBe(false);
    root.roleOverride = ''; root.selectionMode = 'none'; root.reorderable = false;
    await page.waitForChanges();
    expect(rows.every(row => !row.reorderable)).toBe(true);
    expect(root.querySelector('md-divider')!.getAttribute('aria-hidden')).toBe('true');
  });

  it('wraps public previous/next activation over disabled rows and clears focus presentation on exit', async () => {
    const page = await newSpecPage({ components: [MdList, MdListItem], html: '<md-list><md-list-item type="button" headline="One"></md-list-item><md-list-item disabled type="button" headline="Disabled"></md-list-item><md-list-item type="button" headline="Three"></md-list-item></md-list>' });
    const root = page.root as HTMLMdListElement;
    const rows = Array.from(root.querySelectorAll('md-list-item'));
    expect(await root.activatePrevious()).toBe(rows[2]);
    expect(await root.activateNext()).toBe(rows[0]);
    rows[0].rovingFocusVisible = true;
    root.dispatchEvent(new FocusEvent('focusout', { relatedTarget: rows[2] }));
    expect(rows[0].rovingFocusVisible).toBe(true);
    root.dispatchEvent(new FocusEvent('focusout', { relatedTarget: page.body }));
    expect(rows.every(row => !row.rovingFocusVisible)).toBe(true);
  });
});

describe('md-list pointer reorder transaction', () => {
  it.each([['down', 0, 2, 120], ['up', 2, 0, -120]] as const)('commits a %s drag and clears transient sibling transforms', async (_direction, from, to, delta) => {
    const page = await newSpecPage({ components: [MdList, MdListItem], html: '<md-list reorderable><md-list-item type="button" headline="A"></md-list-item><md-list-item type="button" headline="B"></md-list-item><md-list-item type="button" headline="C"></md-list-item></md-list>' });
    const root = page.root!; const rows = Array.from(root.children) as HTMLElement[];
    rows.forEach((row, i) => jest.spyOn(row, 'getBoundingClientRect').mockReturnValue({ top: i * 50, bottom: i * 50 + 50, left: 0, right: 300, width: 300, height: 50, x: 0, y: i * 50, toJSON() {} }));
    const reorder = jest.fn(); root.addEventListener('mdReorder', reorder);
    const handle = rows[from].shadowRoot!.querySelector('[data-list-drag-handle]')!;
    const pointer = (type: string, y: number, id = 1) => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.assign(event, { button: 0, pointerId: id, clientY: y });
      event.composedPath = () => [handle, rows[from], root]; root.dispatchEvent(event);
    };
    pointer('pointerdown', from * 50 + 25);
    pointer('pointermove', from * 50 + 25 + delta, 2);
    expect(rows[from].style.transform).toBe('');
    pointer('pointermove', from * 50 + 25 + delta);
    expect(rows[from].style.transform).toBe(`translateY(${delta}px)`);
    pointer('pointerup', from * 50 + 25 + delta);
    await page.waitForChanges();
    expect(reorder.mock.calls[0][0].detail).toEqual({ from, to, order: from === 0 ? [1, 2, 0] : [2, 0, 1] });
    expect(rows.every(row => row.style.transform === '')).toBe(true);
    expect(rows.some(row => row.classList.contains('md-list-item--dragged'))).toBe(false);
  });
});

describe('md-list empty and label fallback selection', () => {
  it('uses slotted text in selection payloads and returns null for empty activation', async () => {
    const page = await newSpecPage({ components: [MdList, MdListItem], html: '<md-list selection-mode="multi-select"><md-list-item>Plain label</md-list-item></md-list>' });
    const root = page.root as HTMLMdListElement; const selected = jest.fn(); root.addEventListener('mdSelect', selected);
    (root.children[0] as HTMLElement).click(); await page.waitForChanges();
    expect(selected.mock.calls[0][0].detail).toMatchObject({ index: 0, value: 'Plain label', selected: true });
    root.selectionMode = 'single-select'; await page.waitForChanges(); (root.children[0] as HTMLElement).click(); await page.waitForChanges();
    expect(selected.mock.calls[1][0].detail).toMatchObject({ value: 'Plain label', selected: true });
    root.innerHTML = ''; await page.waitForChanges();
    expect(await root.activateNext()).toBeNull(); expect(await root.activatePrevious()).toBeNull();
    await root.selectItem(99); root.selectionMode = 'none'; await root.selectItem(0);
    expect(await root.getSelectedIndices()).toEqual([]);
  });
});

describe('md-list rejected and stationary pointer drags', () => {
  it('ignores non-handle, secondary-button and disabled presses and cancels a stationary one-row drag', async () => {
    const page = await newSpecPage({ components: [MdList, MdListItem], html: '<md-list reorderable><md-list-item type="button" headline="Only row"></md-list-item></md-list>' });
    const root = page.root as HTMLMdListElement; const row = root.children[0] as HTMLMdListItemElement;
    const handle = row.shadowRoot!.querySelector('[data-list-drag-handle]')!;
    jest.spyOn(row, 'getBoundingClientRect').mockReturnValue({ top: 0, left: 0, width: 300, height: 50 } as DOMRect);
    const reordered = jest.fn(); root.addEventListener('mdReorder', reordered);
    const pointer = (type: string, button: number, onHandle = true) => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.assign(event, { button, pointerId: 1, clientY: 25 });
      event.composedPath = () => onHandle ? [handle, row, root] : [row, root];
      root.dispatchEvent(event); return event;
    };
    expect(pointer('pointerdown', 0, false).defaultPrevented).toBe(false);
    expect(pointer('pointerdown', 2).defaultPrevented).toBe(false);
    row.disabled = true; await page.waitForChanges(); expect(pointer('pointerdown', 0).defaultPrevented).toBe(false);
    expect(row.classList.contains('md-list-item--dragged')).toBe(false);
    row.disabled = false; await page.waitForChanges(); expect(pointer('pointerdown', 0).defaultPrevented).toBe(true);
    expect(row.classList.contains('md-list-item--dragged')).toBe(true);
    pointer('pointercancel', 0); await page.waitForChanges();
    expect(row.classList.contains('md-list-item--dragged')).toBe(false);
    expect(reordered).not.toHaveBeenCalled(); expect(root.children[0]).toBe(row);
  });
});
