import { newSpecPage } from '@stencil/core/testing';
import { MdAccordion } from './md-accordion';
import { MdAccordionItem } from '../md-accordion-item/md-accordion-item';

const create = (html: string) => newSpecPage({ components: [MdAccordion, MdAccordionItem], html });
const pointer = (type: string, pointerId = 1, clientX = 100, clientY = 100) => {
  const event = new Event(type, { bubbles: true, composed: true, cancelable: true });
  Object.assign(event, { button: 0, pointerId, clientX, clientY });
  return event;
};
const nested = `<md-accordion exclusive reorderable default-expanded="1">
  <md-accordion-item headline="Outer A"><md-accordion reorderable>
    <md-accordion-item headline="Inner A">A</md-accordion-item>
    <md-accordion-item headline="Inner B">B</md-accordion-item>
  </md-accordion></md-accordion-item>
  <md-accordion-item headline="Outer B">B</md-accordion-item>
</md-accordion>`;

describe('md-accordion independent ownership and lifecycle', () => {
  it.each([
    ['next', 1, 3], ['next', 3, 1], ['prev', 3, 1], ['prev', 1, 3],
    ['first', 3, 1], ['last', 1, 3],
  ] as const)('%s navigation skips disabled headers from %i to %i', async (direction, from, to) => {
    const page = await create(`<md-accordion>
      <md-accordion-item disabled headline="A">A</md-accordion-item>
      <md-accordion-item headline="B">B</md-accordion-item>
      <md-accordion-item disabled headline="C">C</md-accordion-item>
      <md-accordion-item headline="D">D</md-accordion-item>
      <md-accordion-item disabled headline="E">E</md-accordion-item>
    </md-accordion>`);
    const items = Array.from(page.root!.children);
    const focused = items.map(item => jest.spyOn(item.shadowRoot!.querySelector('button')!, 'focus'));
    items[from].dispatchEvent(new CustomEvent('mdItemRequestFocus', { bubbles: true, composed: true, detail: { direction, from } }));
    await page.waitForChanges();
    focused.forEach((spy, index) => expect(spy).toHaveBeenCalledTimes(index === to ? 1 : 0));
  });

  it('does not focus a disabled header when every item is disabled', async () => {
    const page = await create('<md-accordion><md-accordion-item disabled>A</md-accordion-item></md-accordion>');
    const item = page.root!.children[0];
    const focused = jest.spyOn(item.shadowRoot!.querySelector('button')!, 'focus');
    for (const direction of ['next', 'prev', 'first', 'last']) {
      item.dispatchEvent(new CustomEvent('mdItemRequestFocus', { bubbles: true, composed: true, detail: { direction, from: 0 } }));
    }
    expect(focused).not.toHaveBeenCalled();
  });

  it('restores authored orchestration values when a locked item becomes standalone', async () => {
    const page = await create('<md-accordion keep-one-expanded heading-level="2"><md-accordion-item heading-level="5" region-role="none" headline="A">A</md-accordion-item></md-accordion>');
    const item = page.root!.children[0] as HTMLMdAccordionItemElement;
    expect([item.collapsible, item.headingLevel, item.regionRole]).toEqual([false, 2, 'region']);
    item.remove();
    page.root!.shadowRoot!.querySelector('slot')!.dispatchEvent(new Event('slotchange'));
    page.body.appendChild(item);
    await page.waitForChanges();
    expect([item.collapsible, item.headingLevel, item.regionRole]).toEqual([true, 5, 'none']);
    await item.toggle();
    await page.waitForChanges();
    expect(item.expanded).toBe(false);
  });

  it('keeps new owner state when old slot cleanup arrives after reparenting and later restores the original author state', async () => {
    const page = await create('<div><md-accordion keep-one-expanded heading-level="2"><md-accordion-item collapsible="false" heading-level="5" region-role="none" headline="A">A</md-accordion-item></md-accordion><md-accordion variant="outlined" heading-level="4" region="never"></md-accordion></div>');
    const [oldOwner, newOwner] = Array.from(page.body.querySelectorAll('md-accordion'));
    const item = oldOwner.children[0] as HTMLMdAccordionItemElement;
    newOwner.appendChild(item);
    newOwner.shadowRoot!.querySelector('slot')!.dispatchEvent(new Event('slotchange'));
    oldOwner.headingLevel = 1;
    oldOwner.variant = 'filled';
    await page.waitForChanges();
    oldOwner.shadowRoot!.querySelector('slot')!.dispatchEvent(new Event('slotchange'));
    await page.waitForChanges();
    expect([item.collapsible, item.headingLevel, item.regionRole]).toEqual([true, 4, 'group']);
    expect(item.getAttribute('data-index')).toBe('0');
    expect(item.getAttribute('data-accordion-variant')).toBe('outlined');
    item.remove();
    newOwner.shadowRoot!.querySelector('slot')!.dispatchEvent(new Event('slotchange'));
    await page.waitForChanges();
    expect([item.collapsible, item.headingLevel, item.regionRole]).toEqual([false, 5, 'none']);
  });

  it('restores authored state on parent disconnect and reapplies ownership on reconnect', async () => {
    const page = await create('<md-accordion keep-one-expanded heading-level="2"><md-accordion-item heading-level="5" region-role="none">A</md-accordion-item></md-accordion>');
    const root = page.root!;
    const item = root.children[0] as HTMLMdAccordionItemElement;
    root.remove();
    await page.waitForChanges();
    expect([item.collapsible, item.headingLevel, item.regionRole]).toEqual([true, 5, 'none']);
    page.body.appendChild(root);
    await page.waitForChanges();
    expect([item.collapsible, item.headingLevel, item.regionRole]).toEqual([false, 2, 'region']);
  });

  it('old-owner selection cannot collapse a transferred item before the old slot is synchronized', async () => {
    const page = await create('<div><md-accordion exclusive><md-accordion-item expanded>A</md-accordion-item><md-accordion-item>B</md-accordion-item></md-accordion><md-accordion></md-accordion></div>');
    const [oldOwner, newOwner] = Array.from(page.body.querySelectorAll('md-accordion'));
    const item = oldOwner.children[0] as HTMLMdAccordionItemElement;
    const remaining = oldOwner.children[1] as HTMLMdAccordionItemElement;
    newOwner.appendChild(item);
    newOwner.shadowRoot!.querySelector('slot')!.dispatchEvent(new Event('slotchange'));
    remaining.expanded = true;
    await page.waitForChanges();
    expect(item.expanded).toBe(true);
    expect(remaining.expanded).toBe(true);
  });

  it('does not let an inner item toggle collapse an outer exclusive panel', async () => {
    const page = await create(nested);
    const inner = page.root!.querySelector('md-accordion')!;
    const innerItem = inner.querySelector('md-accordion-item')!;
    const outerB = page.root!.children[1] as HTMLMdAccordionItemElement;
    const ownEvents: unknown[] = [];
    page.root!.addEventListener('mdToggle', (event) => { if (event.target === page.root) ownEvents.push(event); });
    innerItem.expanded = true;
    await page.waitForChanges();
    expect(outerB.expanded).toBe(true);
    expect(ownEvents).toHaveLength(0);
  });

  it('keeps nested keyboard reordering within its owning accordion', async () => {
    const page = await create(nested);
    const inner = page.root!.querySelector('md-accordion')!;
    inner.querySelector('md-accordion-item')!.dispatchEvent(new CustomEvent('mdItemRequestReorder', {
      bubbles: true, composed: true, detail: { direction: 'down', from: 0 },
    }));
    await page.waitForChanges();
    expect(Array.from(page.root!.children).map(item => item.getAttribute('headline'))).toEqual(['Outer A', 'Outer B']);
    expect(Array.from(inner.children).map(item => item.getAttribute('headline'))).toEqual(['Inner B', 'Inner A']);
  });

  it('does not focus an outer header for a nested focus request', async () => {
    const page = await create(nested);
    const outerB = page.root!.children[1] as HTMLMdAccordionItemElement;
    const focus = jest.spyOn(outerB.shadowRoot!.querySelector('button')!, 'focus');
    page.root!.querySelector('md-accordion md-accordion-item')!.dispatchEvent(new CustomEvent('mdItemRequestFocus', {
      bubbles: true, composed: true, detail: { direction: 'next', from: 0 },
    }));
    await page.waitForChanges();
    expect(focus).not.toHaveBeenCalled();
  });

  it('reindexes and synchronizes remaining children when a slotted item is removed', async () => {
    const page = await create(`<md-accordion floating keep-one-expanded heading-level="2" region-threshold="1">
      <md-accordion-item headline="A">A</md-accordion-item>
      <md-accordion-item headline="B">B</md-accordion-item>
    </md-accordion>`);
    page.root!.children[0].remove();
    page.root!.shadowRoot!.querySelector('slot')!.dispatchEvent(new Event('slotchange'));
    await page.waitForChanges();
    const remaining = page.root!.children[0] as HTMLMdAccordionItemElement;
    expect(remaining.getAttribute('data-index')).toBe('0');
    expect(remaining.hasAttribute('data-chassis-handle')).toBe(true);
    expect(remaining.expanded).toBe(true);
    expect(remaining.collapsible).toBe(false);
    expect(remaining.regionRole).toBe('region');
  });

  it('cancels a floating drag on disconnect and ignores later pointer events', async () => {
    const page = await create('<md-accordion floating><md-accordion-item headline="A">A</md-accordion-item></md-accordion>');
    const root = page.root!;
    root.querySelector('md-accordion-item')!.shadowRoot!.querySelector('[part="chassis-handle"]')!.dispatchEvent(pointer('pointerdown'));
    await page.waitForChanges();
    const moved = jest.fn();
    root.addEventListener('mdDragMove', moved);
    root.remove();
    root.dispatchEvent(pointer('pointermove', 1, 150, 150));
    await page.waitForChanges();
    expect(moved).not.toHaveBeenCalled();
  });

  it('ignores a different pointer while floating drag is active', async () => {
    const page = await create('<md-accordion floating><md-accordion-item headline="A">A</md-accordion-item></md-accordion>');
    const root = page.root!;
    root.querySelector('md-accordion-item')!.shadowRoot!.querySelector('[part="chassis-handle"]')!.dispatchEvent(pointer('pointerdown'));
    const moved = jest.fn();
    const ended = jest.fn();
    root.addEventListener('mdDragMove', moved);
    root.addEventListener('mdDragEnd', ended);
    root.dispatchEvent(pointer('pointermove', 2, 150, 150));
    root.dispatchEvent(pointer('pointerup', 2, 150, 150));
    await page.waitForChanges();
    expect(moved).not.toHaveBeenCalled();
    expect(ended).not.toHaveBeenCalled();
    root.dispatchEvent(pointer('pointerup'));
    expect(ended).toHaveBeenCalledTimes(1);
  });

  it('public toggle respects the locked-open contract', async () => {
    const page = await create('<md-accordion-item expanded collapsible="false" headline="A">A</md-accordion-item>');
    await (page.root as HTMLMdAccordionItemElement).toggle();
    await page.waitForChanges();
    expect((page.root as HTMLMdAccordionItemElement).expanded).toBe(true);
    expect(page.root!.shadowRoot!.querySelector('button')!.getAttribute('aria-disabled')).toBe('true');
  });

  it('updates direct-owner presentation without leaking into a nested group', async () => {
    const page = await create(nested);
    const root = page.root as HTMLMdAccordionElement;
    const direct = root.children[0];
    const inner = root.querySelector('md-accordion')!.children[0];
    root.variant = 'outlined';
    root.transition = 'none';
    root.elevation = 4;
    root.reorderable = false;
    await page.waitForChanges();
    expect(direct.getAttribute('data-accordion-variant')).toBe('outlined');
    expect(direct.getAttribute('data-accordion-transition')).toBe('none');
    expect(direct.getAttribute('data-accordion-elevation')).toBe('4');
    expect(direct.hasAttribute('data-accordion-reorderable')).toBe(false);
    expect(inner.getAttribute('data-accordion-variant')).toBe('filled');
    expect(inner.getAttribute('data-accordion-transition')).toBe('expressive');
    expect(inner.hasAttribute('data-accordion-reorderable')).toBe(true);
  });

  it('clears owned presentation when an item is removed', async () => {
    const page = await create('<md-accordion floating reorderable variant="outlined"><md-accordion-item headline="A">A</md-accordion-item></md-accordion>');
    const item = page.root!.children[0];
    item.remove();
    page.root!.shadowRoot!.querySelector('slot')!.dispatchEvent(new Event('slotchange'));
    await page.waitForChanges();
    for (const name of ['data-index', 'data-chassis-handle', 'data-accordion-variant', 'data-accordion-elevation', 'data-accordion-transition', 'data-accordion-reorderable', 'data-accordion-dragging']) {
      expect(item.hasAttribute(name)).toBe(false);
    }
  });

  it('cancels floating input when the property is turned off mid-gesture', async () => {
    const page = await create('<md-accordion floating><md-accordion-item headline="A">A</md-accordion-item></md-accordion>');
    const root = page.root as HTMLMdAccordionElement;
    root.children[0].shadowRoot!.querySelector('[part="chassis-handle"]')!.dispatchEvent(pointer('pointerdown'));
    await page.waitForChanges();
    expect(root.children[0].hasAttribute('data-accordion-dragging')).toBe(true);
    root.floating = false;
    await page.waitForChanges();
    const moved = jest.fn();
    const ended = jest.fn();
    root.addEventListener('mdDragMove', moved);
    root.addEventListener('mdDragEnd', ended);
    root.dispatchEvent(pointer('pointermove', 1, 150, 150));
    root.dispatchEvent(pointer('pointerup'));
    expect(root.children[0].hasAttribute('data-accordion-dragging')).toBe(false);
    expect(moved).not.toHaveBeenCalled();
    expect(ended).not.toHaveBeenCalled();
  });
});
