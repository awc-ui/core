import { newSpecPage } from '@stencil/core/testing';
import { MdAccordionItem } from './md-accordion-item';

// Found by tools/ax: when the header's md-ripple hydrated inside the item's shadow tree during the item's first render, Chrome
// intermittently left the expanded panel's slotted text out of its accessibility tree for good (20-30 % of cold page loads;
// 0 of 24 once the ripple is created after the first render). The ripple is interaction feedback only — nothing to draw at rest.
type VNode = { $tag$?: unknown; $children$?: VNode[] | null };
const hasTag = (node: VNode | VNode[] | null | undefined, tag: string): boolean =>
  Array.isArray(node) ? node.some(child => hasTag(child, tag)) : !!node && (node.$tag$ === tag || hasTag(node.$children$, tag));

describe('md-accordion-item header ripple timing', () => {
  afterEach(() => jest.restoreAllMocks());

  it('creates the ripple after the first render, and keeps it afterwards', async () => {
    const render = jest.spyOn(MdAccordionItem.prototype, 'render');
    const page = await newSpecPage({ components: [MdAccordionItem], html: `<md-accordion-item expanded headline="A">Panel text</md-accordion-item>` });
    await page.waitForChanges();
    const outputs = render.mock.results.map(result => result.value as VNode);
    expect(outputs.length).toBeGreaterThan(1);
    expect(hasTag(outputs[0], 'md-ripple')).toBe(false);
    expect(hasTag(outputs[outputs.length - 1], 'md-ripple')).toBe(true);
    expect(page.root!.shadowRoot!.querySelector('.md-accordion-item__header md-ripple')).not.toBeNull();
  });
});
