import { newSpecPage, SpecPage } from '@stencil/core/testing';
import { MdTabs } from './md-tabs';
import { MdTab } from '../md-tab/md-tab';

describe('md-tabs', () => {
  async function create(html: string): Promise<SpecPage> {
    return newSpecPage({ components: [MdTabs, MdTab], html });
  }

  // ─── Rendering ───────────────────────────────────────────

  describe('rendering', () => {
    it('renders with defaults', async () => {
      const page = await create('<md-tabs></md-tabs>');
      expect(page.root).toBeTruthy();
      expect(page.root).toHaveClass('md-tabs');
    });

    it('renders container part', async () => {
      const page = await create('<md-tabs></md-tabs>');
      expect(page.root?.shadowRoot?.querySelector('[part="container"]')).toBeTruthy();
    });

    it('renders slot for tab children', async () => {
      const page = await create('<md-tabs></md-tabs>');
      expect(page.root?.shadowRoot?.querySelector('slot')).toBeTruthy();
    });
  });

  // ─── Variants ────────────────────────────────────────────

  describe('variants', () => {
    it('applies primary variant class', async () => {
      const page = await create('<md-tabs variant="primary"></md-tabs>');
      expect(page.root).toHaveClass('md-tabs--primary');
    });

    it('applies secondary variant class', async () => {
      const page = await create('<md-tabs variant="secondary"></md-tabs>');
      expect(page.root).toHaveClass('md-tabs--secondary');
    });
  });

  // ─── Props ───────────────────────────────────────────────

  describe('props', () => {
    it('defaults activeTabIndex to 0', async () => {
      const page = await create('<md-tabs></md-tabs>');
      expect(page.rootInstance.activeTabIndex).toBe(0);
    });

    it('defaults variant to primary', async () => {
      const page = await create('<md-tabs></md-tabs>');
      expect(page.rootInstance.variant).toBe('primary');
    });
  });

  // ─── Accessibility ──────────────────────────────────────

  describe('accessibility', () => {
    it('has role="tablist"', async () => {
      const page = await create('<md-tabs></md-tabs>');
      expect(page.root?.getAttribute('role')).toBe('tablist');
    });

    it('has aria-orientation="horizontal"', async () => {
      const page = await create('<md-tabs></md-tabs>');
      expect(page.root?.getAttribute('aria-orientation')).toBe('horizontal');
    });

    it('has default aria-label', async () => {
      const page = await create('<md-tabs></md-tabs>');
      expect(page.root?.getAttribute('aria-label')).toBe('tabs');
    });

    it('accepts custom aria-label', async () => {
      const page = await create('<md-tabs aria-label="Navigation tabs"></md-tabs>');
      expect(page.root?.getAttribute('aria-label')).toBe('Navigation tabs');
    });
  });

  // ─── Events ─────────────────────────────────────────────

  describe('events', () => {
    it('emits mdTabChange via selectTab', async () => {
      const page = await create(`
        <md-tabs>
          <md-tab label="Tab 1"></md-tab>
          <md-tab label="Tab 2"></md-tab>
        </md-tabs>
      `);
      const spy = jest.fn();
      page.root?.addEventListener('mdTabChange', spy);
      await page.rootInstance.selectTab(1);
      await page.waitForChanges();
      expect(spy).toHaveBeenCalled();
    });
  });

  // ─── Methods ────────────────────────────────────────────

  describe('methods', () => {
    it('selectTab sets activeTabIndex', async () => {
      const page = await create(`
        <md-tabs>
          <md-tab label="Tab 1"></md-tab>
          <md-tab label="Tab 2"></md-tab>
        </md-tabs>
      `);
      await page.rootInstance.selectTab(1);
      expect(page.rootInstance.activeTabIndex).toBe(1);
    });
  });

  // ─── Tab IDs ─────────────────────────────────────────────

  describe('auto-generated IDs', () => {
    it('assigns auto IDs to tabs without IDs', async () => {
      const page = await create(`
        <md-tabs>
          <md-tab label="Tab 1"></md-tab>
          <md-tab label="Tab 2"></md-tab>
        </md-tabs>
      `);
      const tabs = page.root?.querySelectorAll('md-tab');
      expect(tabs?.[0]?.id).toMatch(/^md-tabs-.*-tab-0$/);
      expect(tabs?.[1]?.id).toMatch(/^md-tabs-.*-tab-1$/);
    });

    it('preserves user-set IDs', async () => {
      const page = await create(`
        <md-tabs>
          <md-tab id="my-tab" label="Tab 1"></md-tab>
          <md-tab label="Tab 2"></md-tab>
        </md-tabs>
      `);
      const tabs = page.root?.querySelectorAll('md-tab');
      expect(tabs?.[0]?.id).toBe('my-tab');
      expect(tabs?.[1]?.id).toMatch(/^md-tabs-.*-tab-1$/);
    });
  });

  // ─── Parts ──────────────────────────────────────────────

  describe('parts', () => {
    it('exposes container part', async () => {
      const page = await create('<md-tabs></md-tabs>');
      expect(page.root?.shadowRoot?.querySelector('[part="container"]')).toBeTruthy();
    });
  });

  // ─── RTL ────────────────────────────────────────────────

  describe('RTL', () => {
    it('renders in RTL context', async () => {
      const page = await newSpecPage({
        components: [MdTabs, MdTab],
        html: '<div dir="rtl"><md-tabs><md-tab label="Tab"></md-tab></md-tabs></div>',
      });
      expect(page.root).toBeTruthy();
    });
  });

  describe('API contract guards (readiness audit)', () => {
    const setup = async (html: string) => {
      const page = await newSpecPage({ components: [MdTabs, MdTab], html });
      await page.waitForChanges();
      return page;
    };

    it('selectTab out-of-bounds is a no-op (no emit, no state change)', async () => {
      const page = await setup('<md-tabs aria-label="t"><md-tab label="A" active></md-tab><md-tab label="B"></md-tab></md-tabs>');
      const spy = jest.fn();
      page.root!.addEventListener('mdTabChange', spy);
      await (page.root as HTMLMdTabsElement).selectTab(99);
      await (page.root as HTMLMdTabsElement).selectTab(-1);
      await page.waitForChanges();
      expect(spy).not.toHaveBeenCalled();
      expect((page.root as HTMLMdTabsElement).activeTabIndex).toBe(0);
    });

    it('re-selecting the active tab does not re-emit', async () => {
      const page = await setup('<md-tabs aria-label="t"><md-tab label="A" active></md-tab><md-tab label="B"></md-tab></md-tabs>');
      const spy = jest.fn();
      page.root!.addEventListener('mdTabChange', spy);
      await (page.root as HTMLMdTabsElement).selectTab(0);
      await page.waitForChanges();
      expect(spy).not.toHaveBeenCalled();
    });

    it('mdTabChange payload = { index, previousIndex }', async () => {
      const page = await setup('<md-tabs aria-label="t"><md-tab label="A" active></md-tab><md-tab label="B"></md-tab></md-tabs>');
      const spy = jest.fn();
      page.root!.addEventListener('mdTabChange', spy);
      await (page.root as HTMLMdTabsElement).selectTab(1);
      await page.waitForChanges();
      expect(spy.mock.calls[0][0].detail).toEqual({ index: 1, previousIndex: 0 });
    });

    it('initial active-tab-index attribute is honored and roved', async () => {
      const page = await setup('<md-tabs aria-label="t" active-tab-index="1"><md-tab label="A"></md-tab><md-tab label="B"></md-tab></md-tabs>');
      const tabs = page.body.querySelectorAll('md-tab');
      expect(tabs[1].hasAttribute('active')).toBe(true);
      expect(tabs[1].getAttribute('tabindex')).toBe('0');
      expect(tabs[0].getAttribute('tabindex')).toBe('-1');
    });

    it('variant propagates to every child tab (incl. late prop change)', async () => {
      const page = await setup('<md-tabs aria-label="t" variant="secondary"><md-tab label="A" active></md-tab><md-tab label="B"></md-tab></md-tabs>');
      let variants = Array.from(page.body.querySelectorAll('md-tab')).map((t) => t.getAttribute('variant'));
      expect(variants).toEqual(['secondary', 'secondary']);
      (page.root as HTMLMdTabsElement).variant = 'primary';
      await page.waitForChanges();
      variants = Array.from(page.body.querySelectorAll('md-tab')).map((t) => t.getAttribute('variant'));
      expect(variants).toEqual(['primary', 'primary']);
    });

    it('out-of-range activeTabIndex prop CLAMPS (no stranded tablist)', async () => {
      const page = await setup('<md-tabs aria-label="t"><md-tab label="A" active></md-tab><md-tab label="B"></md-tab></md-tabs>');
      (page.root as HTMLMdTabsElement).activeTabIndex = 99;
      await page.waitForChanges();
      expect((page.root as HTMLMdTabsElement).activeTabIndex).toBe(1);
      const tabs = page.body.querySelectorAll('md-tab');
      expect(tabs[1].hasAttribute('active')).toBe(true);
      expect(tabs[1].getAttribute('tabindex')).toBe('0');
    });
  });

});
