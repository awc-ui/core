import { newSpecPage } from '@stencil/core/testing';
import { MdAccordion } from './md-accordion';
import { MdAccordionItem } from '../md-accordion-item/md-accordion-item';

// Found by tools/ax (native accessibility parity): an exclusive accordion whose first item was expanded through its property
// right after the elements were created (as frameworks set properties) collapsed that item again — the item's index is -1 until
// the accordion assigns indexes, and the exclusive listener collapsed every item whose index differed from -1, itself included.
const create = () => newSpecPage({ components: [MdAccordion, MdAccordionItem],
  html: `<md-accordion exclusive><md-accordion-item headline="A">A</md-accordion-item><md-accordion-item headline="B">B</md-accordion-item></md-accordion>` });
const unindexed = (page: { body: HTMLElement }) => {
  const items = Array.from(page.body.querySelectorAll('md-accordion-item')) as HTMLMdAccordionItemElement[];
  items.forEach(item => item.removeAttribute('data-index'));   // the state before the accordion assigns indexes
  return items;
};

describe('md-accordion exclusive mode identifies the toggled item by element', () => {
  it('keeps an item expanded before indexes are assigned open, and still collapses the others', async () => {
    const page = await create(); const items = unindexed(page);
    items[0].expanded = true; await page.waitForChanges();
    expect(items.map(item => item.expanded)).toEqual([true, false]);
    items[1].expanded = true; await page.waitForChanges();
    expect(items.map(item => item.expanded)).toEqual([false, true]);
  });

  it('reports the toggled item position in mdToggle when its index is not assigned yet', async () => {
    const page = await create(); const items = unindexed(page);
    const toggles: Array<{ index: number; expanded: boolean }> = [];
    page.body.querySelector('md-accordion')!.addEventListener('mdToggle', (e: Event) => toggles.push((e as CustomEvent).detail));
    items[1].expanded = true; await page.waitForChanges();
    expect(toggles[toggles.length - 1]).toEqual(expect.objectContaining({ index: 1, expanded: true }));
  });
});
