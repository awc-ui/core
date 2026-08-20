import { newSpecPage } from '@stencil/core/testing';
import { MdTransferList } from './md-transfer-list';

async function create(html: string) {
  return newSpecPage({ components: [MdTransferList], html });
}

describe('md-transfer-list', () => {
  describe('rendering', () => {
    it('renders host with default classes', async () => {
      const page = await create('<md-transfer-list></md-transfer-list>');
      expect(page.root).toBeTruthy();
      expect(page.root).toHaveClass('md-transfer-list');
      expect(page.root?.getAttribute('role')).toBe('group');
    });

    it('renders two columns', async () => {
      const page = await create('<md-transfer-list></md-transfer-list>');
      const shadow = page.root?.shadowRoot;
      expect(shadow?.querySelector('[part~="column-source"]')).toBeTruthy();
      expect(shadow?.querySelector('[part~="column-target"]')).toBeTruthy();
    });

    it('exposes part attributes', async () => {
      const page = await create('<md-transfer-list></md-transfer-list>');
      const shadow = page.root?.shadowRoot;
      expect(shadow?.querySelector('[part~="column"]')).toBeTruthy();
      expect(shadow?.querySelector('[part="controls"]')).toBeTruthy();
    });

    it('hides search when searchable is false', async () => {
      const page = await create('<md-transfer-list searchable="false"></md-transfer-list>');
      expect(page.root?.shadowRoot?.querySelectorAll('[part="search"]').length).toBe(0);
    });

    it('drops "all" buttons in singleStepOnly mode', async () => {
      const page = await create('<md-transfer-list single-step-only></md-transfer-list>');
      const buttons = page.root?.shadowRoot?.querySelectorAll('[part="controls"] md-icon-button');
      expect(buttons?.length).toBe(2);
    });

    it('forwards custom mover icons to the md-icon-buttons', async () => {
      const page = await create(
        `<md-transfer-list
           move-all-right-icon="fast_forward"
           move-right-icon="arrow_forward"
           move-left-icon="arrow_back"
           move-all-left-icon="fast_rewind"
         ></md-transfer-list>`,
      );
      // md-icon-button isn't registered in this spec page, so `icon` lands as
      // an attribute on the un-upgraded element rather than a JS property.
      const icons = Array.from(
        page.root?.shadowRoot?.querySelectorAll('[part="controls"] md-icon-button') ?? [],
      ).map((b) => b.getAttribute('icon'));
      expect(icons).toEqual(['fast_forward', 'arrow_forward', 'arrow_back', 'fast_rewind']);
    });

    it('renders a custom empty icon + text, and count template', async () => {
      const page = await create(
        `<md-transfer-list empty-icon="inbox" empty-text="Nothing here" count-template="{checked} of {total} picked"></md-transfer-list>`,
      );
      const shadow = page.root?.shadowRoot;
      const empty = shadow?.querySelector('[part="empty"]');
      expect(empty?.querySelector('[part="empty-icon"]')?.textContent).toBe('inbox');
      expect(empty?.textContent).toContain('Nothing here');
      expect(shadow?.querySelector('[part="count"]')?.textContent?.trim()).toBe('0 of 0 picked');
    });

    it('search-icon="" removes the leading icon from the search fields', async () => {
      const page = await create('<md-transfer-list search-icon=""></md-transfer-list>');
      expect(
        page.root?.shadowRoot?.querySelectorAll('[part="search"] [slot="leading-icon"]').length,
      ).toBe(0);
    });
  });

  describe('items split + move operations', () => {
    function seed(page: Awaited<ReturnType<typeof create>>) {
      const root = page.root as unknown as {
        items: { value: string; label: string; disabled?: boolean }[];
        value: string[];
      };
      root.items = [
        { value: 'a', label: 'Alpha' },
        { value: 'b', label: 'Beta' },
        { value: 'c', label: 'Gamma' },
        { value: 'd', label: 'Delta' },
        { value: 'e', label: 'Echo', disabled: true },
      ];
      root.value = ['b'];
      return root;
    }

    it('splits items between source and target by value', async () => {
      const page = await create('<md-transfer-list></md-transfer-list>');
      seed(page);
      await page.waitForChanges();
      const sourceCol = page.root?.shadowRoot?.querySelector('[part~="column-source"]');
      const targetCol = page.root?.shadowRoot?.querySelector('[part~="column-target"]');
      expect(sourceCol?.querySelectorAll('[part="item"]').length).toBe(4);
      expect(targetCol?.querySelectorAll('[part="item"]').length).toBe(1);
    });

    it('moves selected items right via moveSelectedRight()', async () => {
      const page = await create('<md-transfer-list></md-transfer-list>');
      const root = seed(page);
      await page.waitForChanges();
      const spy = jest.fn();
      page.root?.addEventListener('mdChange', spy);

      // Source side excludes "b" (already in target) → [a, c, d, e].
      // Toggle the first two non-disabled rows ("a" and "c") via click.
      const sourceCol = page.root?.shadowRoot?.querySelector('[part~="column-source"]');
      const items = sourceCol?.querySelectorAll('[part="item"]') as NodeListOf<HTMLElement>;
      items[0].click();
      items[1].click();
      await page.waitForChanges();

      await (page.root as unknown as { moveSelectedRight: () => Promise<void> }).moveSelectedRight();
      await page.waitForChanges();

      expect(root.value).toEqual(['b', 'a', 'c']);
      expect(spy).toHaveBeenCalled();
    });

    it('does not move disabled rows even when selected', async () => {
      const page = await create('<md-transfer-list></md-transfer-list>');
      const root = seed(page);
      await page.waitForChanges();
      const sourceCol = page.root?.shadowRoot?.querySelector('[part~="column-source"]');
      const items = sourceCol?.querySelectorAll('[part="item"]') as NodeListOf<HTMLElement>;
      // "e" is the disabled one — find it
      const disabledRow = Array.from(items).find((el) => el.classList.contains('md-transfer-list__item--disabled'));
      expect(disabledRow).toBeTruthy();
      // Try clicking it
      disabledRow?.click();
      await page.waitForChanges();
      // Nothing checked
      const checked = sourceCol?.querySelectorAll('.md-transfer-list__item--checked');
      expect(checked?.length).toBe(0);
      // moveSelectedRight is a no-op
      await (page.root as unknown as { moveSelectedRight: () => Promise<void> }).moveSelectedRight();
      await page.waitForChanges();
      expect(root.value).toEqual(['b']);
    });

    it('moves all eligible items right via moveAllRight (via internal button)', async () => {
      const page = await create('<md-transfer-list></md-transfer-list>');
      const root = seed(page);
      await page.waitForChanges();
      const buttons = page.root?.shadowRoot?.querySelectorAll('[part="controls"] md-icon-button') as
        NodeListOf<HTMLElement>;
      // First button is ">>" (move all right)
      buttons[0].click();
      await page.waitForChanges();
      // 'b' was already in target; 'a','c','d' (non-disabled) move; 'e' stays
      expect(root.value.sort()).toEqual(['a', 'b', 'c', 'd']);
    });
  });

  describe('events', () => {
    it('emits mdMove with direction + moved list', async () => {
      const page = await create('<md-transfer-list></md-transfer-list>');
      const root = page.root as unknown as {
        items: { value: string; label: string }[];
        value: string[];
      };
      root.items = [
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B' },
      ];
      root.value = [];
      await page.waitForChanges();
      const spy = jest.fn();
      page.root?.addEventListener('mdMove', spy);

      const sourceCol = page.root?.shadowRoot?.querySelector('[part~="column-source"]');
      const items = sourceCol?.querySelectorAll('[part="item"]') as NodeListOf<HTMLElement>;
      items[0].click();
      await page.waitForChanges();
      await (page.root as unknown as { moveSelectedRight: () => Promise<void> }).moveSelectedRight();
      await page.waitForChanges();

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: expect.objectContaining({ direction: 'right', moved: ['a'] }),
        }),
      );
    });
  });

  describe('accessibility', () => {
    it('lists are role="listbox" with aria-multiselectable', async () => {
      const page = await create('<md-transfer-list></md-transfer-list>');
      const lists = page.root?.shadowRoot?.querySelectorAll('[part="list"]');
      lists?.forEach((l) => {
        expect(l.getAttribute('role')).toBe('listbox');
        expect(l.getAttribute('aria-multiselectable')).toBe('true');
      });
    });

    it('sets aria-disabled when disabled', async () => {
      const page = await create('<md-transfer-list disabled></md-transfer-list>');
      expect(page.root?.getAttribute('aria-disabled')).toBe('true');
    });
  });

  describe('search', () => {
    it('filters visible rows by query', async () => {
      const page = await create('<md-transfer-list></md-transfer-list>');
      const root = page.root as unknown as {
        items: { value: string; label: string }[];
        value: string[];
      };
      root.items = [
        { value: 'a', label: 'Apple' },
        { value: 'b', label: 'Banana' },
        { value: 'c', label: 'Cherry' },
      ];
      root.value = [];
      await page.waitForChanges();

      // Simulate setting the source query via the input event on the search field.
      (page.root as unknown as { sourceQuery: string }).sourceQuery = 'ban';
      // sourceQuery is @State, not @Prop — set on the component instance via forceUpdate
      // We approach this by simulating the actual flow: dispatch mdInput on the search field.
      const searchField = page.root?.shadowRoot?.querySelectorAll('[part="search"]')[0] as HTMLElement;
      searchField.dispatchEvent(new CustomEvent('mdInput', { detail: 'ban' }));
      await page.waitForChanges();

      const sourceCol = page.root?.shadowRoot?.querySelector('[part~="column-source"]');
      const rows = sourceCol?.querySelectorAll('[part="item"]');
      expect(rows?.length).toBe(1);
    });
  });

  describe('RTL', () => {
    it('renders in RTL context', async () => {
      const page = await newSpecPage({
        components: [MdTransferList],
        html: `<div dir="rtl"><md-transfer-list></md-transfer-list></div>`,
      });
      expect(page.root).toBeTruthy();
    });
  });
});
