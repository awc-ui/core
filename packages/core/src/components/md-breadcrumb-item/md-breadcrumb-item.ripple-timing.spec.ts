import { newSpecPage } from '@stencil/core/testing';
import { MdBreadcrumbItem } from './md-breadcrumb-item';

// Found by tools/ax (gate-7 R6-15, d6): with the link crumbs' md-ripple hydrating inside their shadow trees during the crumbs' first
// render, Chrome intermittently leaves the static (current) crumb's slotted label out of its accessibility tree (tools/ax Web capture
// path: 13/48 trail and 8/48 collapsed cold loads; 0/48 with the ripple created after the first render — d6-lab/out/d6b-009). The
// same cause as md-accordion-item (fa-051) and md-step (fix-web-3). The ripple is interaction feedback only — nothing to draw at rest —
// so it is created once the crumb has loaded.
type VNode = { $tag$?: unknown; $children$?: VNode[] | null };
const hasTag = (node: VNode | VNode[] | null | undefined, tag: string): boolean =>
  Array.isArray(node) ? node.some(child => hasTag(child, tag)) : !!node && (node.$tag$ === tag || hasTag(node.$children$, tag));

describe('md-breadcrumb-item ripple timing', () => {
  afterEach(() => jest.restoreAllMocks());

  it('creates the link ripple after the first render, and keeps it afterwards', async () => {
    const render = jest.spyOn(MdBreadcrumbItem.prototype, 'render');
    const page = await newSpecPage({ components: [MdBreadcrumbItem], html: '<md-breadcrumb-item href="#docs" icon="folder">Documents</md-breadcrumb-item>' });
    await page.waitForChanges();
    const outputs = render.mock.results.map(result => result.value as VNode);
    expect(outputs.length).toBeGreaterThan(1);
    expect(hasTag(outputs[0], 'md-ripple')).toBe(false);
    expect(hasTag(outputs[outputs.length - 1], 'md-ripple')).toBe(true);
    expect(page.root!.shadowRoot!.querySelector('a md-ripple')).not.toBeNull();
  });

  it('keeps the label slot when the ripple arrives', async () => {
    const page = await newSpecPage({ components: [MdBreadcrumbItem], html: '<md-breadcrumb-item href="#docs">Documents</md-breadcrumb-item>' });
    const slot = page.root!.shadowRoot!.querySelector('slot:not([name])');
    await page.waitForChanges();
    expect(page.root!.shadowRoot!.querySelector('md-ripple')).not.toBeNull();
    expect(page.root!.shadowRoot!.querySelector('slot:not([name])')).toBe(slot);
  });

  it('never creates a ripple for a static crumb', async () => {
    const page = await newSpecPage({ components: [MdBreadcrumbItem], html: '<md-breadcrumb-item>Quarterly report</md-breadcrumb-item>' });
    await page.waitForChanges();
    expect(page.root!.shadowRoot!.querySelector('md-ripple')).toBeNull();
  });
});
