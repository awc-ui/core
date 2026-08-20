import { newSpecPage } from '@stencil/core/testing';
import { MdList } from './md-list';
import { MdListItem } from '../md-list-item/md-list-item';

describe('md-list', () => {
  async function create(html: string) {
    return newSpecPage({
      components: [MdList, MdListItem],
      html,
    });
  }

  /* ----------------------------------------------------------
     1. RENDERING
     ---------------------------------------------------------- */
  describe('rendering', () => {
    it('renders with defaults', async () => {
      const page = await create('<md-list></md-list>');
      expect(page.root).toBeTruthy();
      expect(page.root).toHaveClass('md-list');
      expect(page.root).toHaveClass('md-list--standard');
    });

    it('renders segmented style', async () => {
      const page = await create('<md-list list-style="segmented"></md-list>');
      expect(page.root).toHaveClass('md-list--segmented');
    });

    it('renders slotted children', async () => {
      const page = await create('<md-list><md-list-item headline="One"></md-list-item></md-list>');
      const item = page.root?.querySelector('md-list-item');
      expect(item).toBeTruthy();
      expect(item?.getAttribute('headline')).toBe('One');
    });
  });

  /* ----------------------------------------------------------
     2. ACCESSIBILITY — role auto-promotion + aria attrs
     ---------------------------------------------------------- */
  describe('accessibility', () => {
    it('role=list when selection-mode=none', async () => {
      const page = await create('<md-list></md-list>');
      expect(page.root?.getAttribute('role')).toBe('list');
    });

    it('keeps role=list for static/label-only rows (valid listitem children)', async () => {
      const page = await create(`<md-list>
        <md-list-item headline="A"></md-list-item>
        <md-list-item headline="B"></md-list-item>
      </md-list>`);
      expect(page.root?.getAttribute('role')).toBe('list');
    });

    it('stays role=list when non-selection rows are interactive buttons/links', async () => {
      // A role="list" may only own listitems. Interactive rows keep a
      // structural `listitem` HOST and expose their widget role on an inner
      // primary element, so the container validly owns only listitems (no
      // toolbar promotion) and interleaved dividers are decorative.
      const page = await create(`<md-list>
        <md-list-item type="button" headline="A"></md-list-item>
        <md-divider></md-divider>
        <md-list-item type="link" href="/x" headline="B"></md-list-item>
      </md-list>`);
      expect(page.root?.getAttribute('role')).toBe('list');
      const items = page.root?.querySelectorAll('md-list-item') as NodeListOf<HTMLElement>;
      expect(items[0].getAttribute('role')).toBe('listitem');
      expect(items[1].getAttribute('role')).toBe('listitem');
      expect(items[0].shadowRoot?.querySelector('.md-list-item__primary')?.getAttribute('role')).toBe('button');
      expect(items[1].shadowRoot?.querySelector('.md-list-item__primary')?.getAttribute('role')).toBe('link');
    });

    it('role-override menu: rows become menuitems on the HOST (menu owns its direct children)', async () => {
      // A role="menu" owns its direct light-DOM children (the md-list-item
      // hosts) and requires menuitem/separator/group — a role="none" host is a
      // disallowed child (aria-required-children), and a menuitem in the host's
      // shadow isn't owned by the menu. So the HOST itself is the menuitem
      // (like `option`); no inner primary widget is rendered.
      const page = await create(`<md-list role-override="menu">
        <md-list-item type="button" headline="A"></md-list-item>
      </md-list>`);
      expect(page.root?.getAttribute('role')).toBe('menu');
      expect(page.root?.getAttribute('aria-orientation')).toBeFalsy();
      const item = page.root?.querySelector('md-list-item') as HTMLElement;
      expect(item.getAttribute('role')).toBe('menuitem');
      expect(item.getAttribute('tabindex')).toBe('0');
      expect(item.shadowRoot?.querySelector('.md-list-item__primary')).toBeNull();
    });

    it('role=listbox when selection-mode=single-select', async () => {
      const page = await create('<md-list selection-mode="single-select"></md-list>');
      expect(page.root?.getAttribute('role')).toBe('listbox');
    });

    it('role=listbox when selection-mode=multi-select', async () => {
      const page = await create('<md-list selection-mode="multi-select"></md-list>');
      expect(page.root?.getAttribute('role')).toBe('listbox');
    });

    it('aria-multiselectable=true when multi-select', async () => {
      const page = await create('<md-list selection-mode="multi-select"></md-list>');
      expect(page.root?.getAttribute('aria-multiselectable')).toBe('true');
    });

    it('honors role-override', async () => {
      const page = await create('<md-list role-override="menu"></md-list>');
      expect(page.root?.getAttribute('role')).toBe('menu');
    });

    it('sets aria-label from label prop', async () => {
      const page = await create('<md-list label="Inbox folders"></md-list>');
      expect(page.root?.getAttribute('aria-label')).toBe('Inbox folders');
    });

    it('sets aria-labelledby when labelledby is provided', async () => {
      const page = await create('<md-list labelledby="hdr"></md-list>');
      expect(page.root?.getAttribute('aria-labelledby')).toBe('hdr');
    });
  });

  /* ----------------------------------------------------------
     3. SELECTION MODE — propagates to children + role=option
     ---------------------------------------------------------- */
  describe('selection coordination', () => {
    it('sets data-selection-mode on each child item', async () => {
      const page = await create(`<md-list selection-mode="single-select">
        <md-list-item headline="A"></md-list-item>
        <md-list-item headline="B"></md-list-item>
      </md-list>`);
      const items = page.root?.querySelectorAll('md-list-item');
      items?.forEach(it => {
        expect(it.getAttribute('data-selection-mode')).toBe('single-select');
      });
    });

    it('removes data-selection-mode when toggled back to none', async () => {
      const page = await create(`<md-list selection-mode="single-select">
        <md-list-item headline="A"></md-list-item>
      </md-list>`);
      const list = page.root as HTMLMdListElement;
      list.selectionMode = 'none';
      await page.waitForChanges();
      const item = page.root?.querySelector('md-list-item');
      expect(item?.hasAttribute('data-selection-mode')).toBe(false);
    });

    it('items receive role=option in selection mode', async () => {
      const page = await create(`<md-list selection-mode="single-select">
        <md-list-item headline="A"></md-list-item>
      </md-list>`);
      const item = page.root?.querySelector('md-list-item');
      expect(item?.getAttribute('role')).toBe('option');
    });

    it('single-select: clicking an item deselects others and selects clicked', async () => {
      const page = await create(`<md-list selection-mode="single-select">
        <md-list-item headline="A"></md-list-item>
        <md-list-item headline="B"></md-list-item>
        <md-list-item headline="C"></md-list-item>
      </md-list>`);
      const items = page.root?.querySelectorAll('md-list-item') as NodeListOf<HTMLMdListItemElement>;
      items[0].selected = true;
      await page.waitForChanges();

      items[2].click();
      await page.waitForChanges();

      expect(items[0].selected).toBe(false);
      expect(items[1].selected).toBe(false);
      expect(items[2].selected).toBe(true);
    });

    it('multi-select: clicking toggles each item independently', async () => {
      const page = await create(`<md-list selection-mode="multi-select">
        <md-list-item headline="A"></md-list-item>
        <md-list-item headline="B"></md-list-item>
      </md-list>`);
      const items = page.root?.querySelectorAll('md-list-item') as NodeListOf<HTMLMdListItemElement>;

      items[0].click();
      await page.waitForChanges();
      items[1].click();
      await page.waitForChanges();

      expect(items[0].selected).toBe(true);
      expect(items[1].selected).toBe(true);

      items[0].click();
      await page.waitForChanges();
      expect(items[0].selected).toBe(false);
      expect(items[1].selected).toBe(true);
    });

    it('emits mdSelect with detail when an item is activated', async () => {
      const page = await create(`<md-list selection-mode="single-select">
        <md-list-item headline="A"></md-list-item>
      </md-list>`);
      const spy = jest.fn();
      page.root?.addEventListener('mdSelect', spy);
      const item = page.root?.querySelector('md-list-item');
      item?.click();
      await page.waitForChanges();
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0].detail.selected).toBe(true);
      expect(spy.mock.calls[0][0].detail.value).toBe('A');
      expect(spy.mock.calls[0][0].detail.index).toBe(0);
    });

    it('emits mdSelect when single-select moves to a new item', async () => {
      const page = await create(`<md-list selection-mode="single-select">
        <md-list-item headline="A"></md-list-item>
        <md-list-item headline="B"></md-list-item>
      </md-list>`);
      const spy = jest.fn();
      page.root?.addEventListener('mdSelect', spy);
      const items = page.root?.querySelectorAll('md-list-item') as NodeListOf<HTMLMdListItemElement>;

      items[0].click();
      await page.waitForChanges();
      items[1].click();
      await page.waitForChanges();

      expect(spy).toHaveBeenCalledTimes(2);
      expect(spy.mock.calls[1][0].detail.index).toBe(1);
      expect(spy.mock.calls[1][0].detail.value).toBe('B');
      expect(spy.mock.calls[1][0].detail.selected).toBe(true);
    });

    it('emits mdSelect with selected=false when multi-select deselects', async () => {
      const page = await create(`<md-list selection-mode="multi-select">
        <md-list-item headline="A"></md-list-item>
      </md-list>`);
      const spy = jest.fn();
      page.root?.addEventListener('mdSelect', spy);
      const item = page.root?.querySelector('md-list-item') as HTMLMdListItemElement;

      item.click();
      await page.waitForChanges();
      item.click();
      await page.waitForChanges();

      expect(spy).toHaveBeenCalledTimes(2);
      expect(spy.mock.calls[0][0].detail.selected).toBe(true);
      expect(spy.mock.calls[1][0].detail.selected).toBe(false);
    });

    it('emits mdSelect when an expanded-content child is selected', async () => {
      const page = await create(`<md-list selection-mode="single-select">
        <md-list-item expandable expanded headline="Parent">
          <md-list-item slot="expanded-content" type="button" headline="Child A"></md-list-item>
          <md-list-item slot="expanded-content" type="button" headline="Child B"></md-list-item>
        </md-list-item>
      </md-list>`);
      const spy = jest.fn();
      page.root?.addEventListener('mdSelect', spy);
      const parent = page.root?.querySelector('md-list-item') as HTMLMdListItemElement;
      const children = Array.from(parent.children).filter(
        c => c.tagName === 'MD-LIST-ITEM',
      ) as HTMLMdListItemElement[];

      children[1].click();
      await page.waitForChanges();

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0].detail.index).toBe(0);
      expect(spy.mock.calls[0][0].detail.childIndex).toBe(1);
      expect(spy.mock.calls[0][0].detail.expanded).toBe(true);
      expect(spy.mock.calls[0][0].detail.value).toBe('Child B');
      expect(spy.mock.calls[0][0].detail.selected).toBe(true);
      expect(spy.mock.calls[0][0].detail.item).toBe(children[1]);
    });

    it('emits distinct childIndex for each expanded-content child', async () => {
      const page = await create(`<md-list selection-mode="single-select">
        <md-list-item expandable expanded headline="Parent">
          <md-list-item slot="expanded-content" type="button" headline="Child A"></md-list-item>
          <md-list-item slot="expanded-content" type="button" headline="Child B"></md-list-item>
          <md-list-item slot="expanded-content" type="button" headline="Child C"></md-list-item>
        </md-list-item>
      </md-list>`);
      const spy = jest.fn();
      page.root?.addEventListener('mdSelect', spy);
      const parent = page.root?.querySelector('md-list-item') as HTMLMdListItemElement;
      const children = Array.from(parent.children).filter(
        c => c.tagName === 'MD-LIST-ITEM',
      ) as HTMLMdListItemElement[];

      children[0].click();
      await page.waitForChanges();
      children[2].click();
      await page.waitForChanges();

      expect(spy).toHaveBeenCalledTimes(2);
      expect(spy.mock.calls[0][0].detail.childIndex).toBe(0);
      expect(spy.mock.calls[1][0].detail.childIndex).toBe(2);
      expect(spy.mock.calls[0][0].detail.expanded).toBe(true);
      expect(spy.mock.calls[1][0].detail.expanded).toBe(true);
    });
  });

  /* ----------------------------------------------------------
     4. ROVING TABINDEX
     ---------------------------------------------------------- */
  describe('roving tabindex', () => {
    it('makes only the first focusable item tabbable', async () => {
      const page = await create(`<md-list>
        <md-list-item type="button" headline="A"></md-list-item>
        <md-list-item type="button" headline="B"></md-list-item>
        <md-list-item type="button" headline="C"></md-list-item>
      </md-list>`);
      const items = page.root?.querySelectorAll('md-list-item') as NodeListOf<HTMLMdListItemElement>;
      expect(items[0].tabbable).toBe(true);
      expect(items[1].tabbable).toBe(false);
      expect(items[2].tabbable).toBe(false);
    });

    it('promotes plain text rows to focusable when in selection mode', async () => {
      const page = await create(`<md-list selection-mode="single-select">
        <md-list-item headline="A"></md-list-item>
        <md-list-item headline="B"></md-list-item>
      </md-list>`);
      const items = page.root?.querySelectorAll('md-list-item') as NodeListOf<HTMLMdListItemElement>;
      expect(items[0].tabbable).toBe(true);
      expect(items[1].tabbable).toBe(false);
    });

    it('starts on the first selected item when one is pre-selected', async () => {
      const page = await create(`<md-list selection-mode="single-select">
        <md-list-item headline="A"></md-list-item>
        <md-list-item headline="B" selected></md-list-item>
        <md-list-item headline="C"></md-list-item>
      </md-list>`);
      const items = page.root?.querySelectorAll('md-list-item') as NodeListOf<HTMLMdListItemElement>;
      expect(items[1].tabbable).toBe(true);
      expect(items[0].tabbable).toBe(false);
      expect(items[2].tabbable).toBe(false);
    });

    it('skips disabled items when finding the initial active row', async () => {
      const page = await create(`<md-list>
        <md-list-item type="button" headline="A" disabled></md-list-item>
        <md-list-item type="button" headline="B"></md-list-item>
      </md-list>`);
      const items = page.root?.querySelectorAll('md-list-item') as NodeListOf<HTMLMdListItemElement>;
      expect(items[0].tabbable).toBe(false);
      expect(items[1].tabbable).toBe(true);
    });

    it('does not show roving focus ring at idle on initial load', async () => {
      const page = await create(`<md-list selection-mode="multi-select">
        <md-list-item headline="A"></md-list-item>
        <md-list-item headline="B"></md-list-item>
      </md-list>`);
      const items = page.root?.querySelectorAll('md-list-item') as NodeListOf<HTMLMdListItemElement>;
      expect(items[0].tabbable).toBe(true);
      expect(items[0].rovingFocusVisible).toBe(false);
      expect(items[1].rovingFocusVisible).toBe(false);
      expect(items[0]).not.toHaveClass('md-list-item--roving-focus-visible');
    });
  });

  /* ----------------------------------------------------------
     5. METHODS — activateNext / activatePrevious / selectItem
     ---------------------------------------------------------- */
  describe('methods', () => {
    it('activateNext moves tabbable to the next focusable item', async () => {
      const page = await create(`<md-list>
        <md-list-item type="button" headline="A"></md-list-item>
        <md-list-item type="button" headline="B"></md-list-item>
      </md-list>`);
      const list = page.root as HTMLMdListElement;
      const items = page.root?.querySelectorAll('md-list-item') as NodeListOf<HTMLMdListItemElement>;
      await list.activateNext();
      await page.waitForChanges();
      expect(items[1].tabbable).toBe(true);
      expect(items[0].tabbable).toBe(false);
      expect(items[1].rovingFocusVisible).toBe(true);
      expect(items[0].rovingFocusVisible).toBe(false);
      expect(items[1]).toHaveClass('md-list-item--roving-focus-visible');
    });

    it('activatePrevious wraps to the last focusable item from the first', async () => {
      const page = await create(`<md-list>
        <md-list-item type="button" headline="A"></md-list-item>
        <md-list-item type="button" headline="B"></md-list-item>
      </md-list>`);
      const list = page.root as HTMLMdListElement;
      const items = page.root?.querySelectorAll('md-list-item') as NodeListOf<HTMLMdListItemElement>;
      await list.activatePrevious();
      await page.waitForChanges();
      expect(items[1].tabbable).toBe(true);
    });

    it('activateNext focuses the new row with focusVisible after tabbable updates', async () => {
      const page = await create(`<md-list selection-mode="multi-select">
        <md-list-item headline="A"></md-list-item>
        <md-list-item headline="B"></md-list-item>
      </md-list>`);
      const list = page.root as HTMLMdListElement;
      const items = page.root?.querySelectorAll('md-list-item') as NodeListOf<HTMLMdListItemElement>;
      const focusSpy = jest.spyOn(items[1], 'focus');

      await list.activateNext();
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      await page.waitForChanges();

      expect(focusSpy).toHaveBeenCalledWith(
        expect.objectContaining({ focusVisible: true, preventScroll: true }),
      );
      focusSpy.mockRestore();
    });

    it('activateNext advances from tabbable row when focus is on an external control', async () => {
      const page = await create(`<md-list selection-mode="multi-select">
            <md-list-item headline="A"></md-list-item>
            <md-list-item headline="B" selected></md-list-item>
            <md-list-item headline="C"></md-list-item>
          </md-list>`);
      const list = page.root as HTMLMdListElement;
      const items = list.querySelectorAll('md-list-item') as NodeListOf<HTMLMdListItemElement>;
      const external = document.createElement('button');
      page.body.appendChild(external);
      external.focus();
      await page.waitForChanges();
      expect(items[1].tabbable).toBe(true);

      await list.activateNext();
      await page.waitForChanges();

      expect(items[2].tabbable).toBe(true);
      expect(items[1].tabbable).toBe(false);
    });

    it('selectItem mutates selection without emitting mdSelect', async () => {
      const page = await create(`<md-list selection-mode="single-select">
        <md-list-item headline="A"></md-list-item>
        <md-list-item headline="B"></md-list-item>
      </md-list>`);
      const spy = jest.fn();
      page.root?.addEventListener('mdSelect', spy);
      const list = page.root as HTMLMdListElement;
      await list.selectItem(1);
      await page.waitForChanges();
      const items = page.root?.querySelectorAll('md-list-item') as NodeListOf<HTMLMdListItemElement>;
      expect(items[1].selected).toBe(true);
      expect(spy).not.toHaveBeenCalled();
    });

    it('getSelectedIndices reflects selection state', async () => {
      const page = await create(`<md-list selection-mode="multi-select">
        <md-list-item headline="A"></md-list-item>
        <md-list-item headline="B"></md-list-item>
        <md-list-item headline="C"></md-list-item>
      </md-list>`);
      const list = page.root as HTMLMdListElement;
      await list.selectItem(0);
      await list.selectItem(2);
      await page.waitForChanges();
      const selected = await list.getSelectedIndices();
      expect(selected).toEqual([0, 2]);
    });
  });

  /* ----------------------------------------------------------
     6. INTERACTION MODE — single-action vs multi-action
     ---------------------------------------------------------- */
  describe('interaction mode', () => {
    it('propagates interaction-mode to child items', async () => {
      const page = await create(`<md-list interaction-mode="multi-action">
        <md-list-item type="button" headline="A"></md-list-item>
        <md-list-item type="button" headline="B"></md-list-item>
      </md-list>`);
      const items = page.root?.querySelectorAll('md-list-item') as NodeListOf<HTMLMdListItemElement>;
      items?.forEach(it => {
        expect(it.getAttribute('data-interaction-mode')).toBe('multi-action');
      });
    });

    it('removes data-interaction-mode when toggled back to single-action', async () => {
      const page = await create(`<md-list interaction-mode="multi-action">
        <md-list-item type="button" headline="A"></md-list-item>
      </md-list>`);
      const list = page.root as HTMLMdListElement;
      list.setAttribute('interaction-mode', 'single-action');
      await page.waitForChanges();
      const item = page.root?.querySelector('md-list-item');
      expect(item?.hasAttribute('data-interaction-mode')).toBe(false);
      expect(list.getAttribute('interaction-mode')).toBe('single-action');
    });

    it('adds interaction-mode class on the host', async () => {
      const page = await create('<md-list interaction-mode="multi-action"></md-list>');
      expect(page.root).toHaveClass('md-list--multi-action');
    });

    it('secondary trailing click does not emit mdActivate on parent list', async () => {
      const page = await create(`<md-list interaction-mode="multi-action">
        <md-list-item type="button" headline="A">
          <button slot="trailing" id="trail" type="button">More</button>
        </md-list-item>
      </md-list>`);
      const activateSpy = jest.fn();
      const itemClickSpy = jest.fn();
      page.root?.addEventListener('mdActivate', activateSpy);
      page.root?.querySelector('md-list-item')?.addEventListener('mdClick', itemClickSpy);
      const trail = page.root?.querySelector('#trail') as HTMLButtonElement;
      trail?.click();
      await page.waitForChanges();
      expect(itemClickSpy).not.toHaveBeenCalled();
      expect(activateSpy).not.toHaveBeenCalled();
    });
  });

  /* ----------------------------------------------------------
     7. RTL SMOKE TEST
     ---------------------------------------------------------- */
  describe('RTL', () => {
    it('renders inside dir="rtl" container without errors', async () => {
      const page = await newSpecPage({
        components: [MdList, MdListItem],
        html: `<div dir="rtl"><md-list><md-list-item headline="عنصر"></md-list-item></md-list></div>`,
      });
      expect(page.root).toBeTruthy();
    });
  });

  /* ----------------------------------------------------------
     8. REORDER (drag-to-reorder)
     ---------------------------------------------------------- */
  describe('reorder', () => {
    async function createReorderable() {
      return create(`<md-list reorderable>
        <md-list-item type="button" headline="A"></md-list-item>
        <md-list-item type="button" headline="B"></md-list-item>
        <md-list-item type="button" headline="C"></md-list-item>
      </md-list>`);
    }

    const headlines = (page: Awaited<ReturnType<typeof create>>) =>
      Array.from(page.root?.querySelectorAll('md-list-item') ?? []).map(i =>
        i.getAttribute('headline'),
      );

    it('reflects the reorderable attribute and adds host class', async () => {
      const page = await createReorderable();
      expect(page.root).toHaveClass('md-list--reorderable');
      expect(page.root?.hasAttribute('reorderable')).toBe(true);
    });

    it('propagates reorderable down to each child row', async () => {
      const page = await createReorderable();
      const items = page.root?.querySelectorAll('md-list-item');
      items?.forEach(item => {
        expect((item as unknown as { reorderable: boolean }).reorderable).toBe(true);
      });
    });

    it('renders a drag handle on each reorderable row', async () => {
      const page = await createReorderable();
      const handle = page.root
        ?.querySelector('md-list-item')
        ?.shadowRoot?.querySelector('[data-list-drag-handle="true"]');
      expect(handle).toBeTruthy();
      expect(handle?.getAttribute('part')).toBe('drag-handle');
    });

    it('moves a row DOWN and emits mdReorder with correct from/to/order', async () => {
      const page = await createReorderable();
      const spy = jest.fn();
      page.root?.addEventListener('mdReorder', spy);

      // Ask the list to move row 0 (A) down one slot, as the row would on Alt+ArrowDown.
      const firstItem = page.root?.querySelector('md-list-item');
      firstItem?.dispatchEvent(
        new CustomEvent('mdItemRequestReorder', {
          detail: { direction: 'down', from: 0 },
          bubbles: true,
          composed: true,
        }),
      );
      await page.waitForChanges();

      expect(headlines(page)).toEqual(['B', 'A', 'C']);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0].detail).toEqual({ from: 0, to: 1, order: [1, 0, 2] });
    });

    it('moves a row UP and emits mdReorder', async () => {
      const page = await createReorderable();
      const spy = jest.fn();
      page.root?.addEventListener('mdReorder', spy);

      const lastItem = page.root?.querySelectorAll('md-list-item')[2];
      lastItem?.dispatchEvent(
        new CustomEvent('mdItemRequestReorder', {
          detail: { direction: 'up', from: 2 },
          bubbles: true,
          composed: true,
        }),
      );
      await page.waitForChanges();

      expect(headlines(page)).toEqual(['A', 'C', 'B']);
      expect(spy.mock.calls[0][0].detail).toEqual({ from: 2, to: 1, order: [0, 2, 1] });
    });

    it('ignores an out-of-bounds reorder (first row up)', async () => {
      const page = await createReorderable();
      const spy = jest.fn();
      page.root?.addEventListener('mdReorder', spy);

      page.root?.querySelector('md-list-item')?.dispatchEvent(
        new CustomEvent('mdItemRequestReorder', {
          detail: { direction: 'up', from: 0 },
          bubbles: true,
          composed: true,
        }),
      );
      await page.waitForChanges();

      expect(headlines(page)).toEqual(['A', 'B', 'C']);
      expect(spy).not.toHaveBeenCalled();
    });

    it('does not move a disabled row', async () => {
      const page = await create(`<md-list reorderable>
        <md-list-item type="button" headline="A" disabled></md-list-item>
        <md-list-item type="button" headline="B"></md-list-item>
      </md-list>`);
      const spy = jest.fn();
      page.root?.addEventListener('mdReorder', spy);

      page.root?.querySelector('md-list-item')?.dispatchEvent(
        new CustomEvent('mdItemRequestReorder', {
          detail: { direction: 'down', from: 0 },
          bubbles: true,
          composed: true,
        }),
      );
      await page.waitForChanges();

      expect(headlines(page)).toEqual(['A', 'B']);
      expect(spy).not.toHaveBeenCalled();
    });

    it('shows a drop-target placeholder during a pointer drag and clears it on drop', async () => {
      const page = await createReorderable();
      const item = page.root?.querySelector('md-list-item') as HTMLElement;
      const handle = item?.shadowRoot?.querySelector(
        '[data-list-drag-handle="true"]',
      ) as HTMLElement;
      expect(handle).toBeTruthy();

      // No placeholder at rest.
      expect(
        page.root?.shadowRoot?.querySelector('[part="drop-placeholder"]'),
      ).toBeFalsy();

      // Start a drag from the trailing handle (mock-doc has no real pointer
      // events, so synthesize one whose composedPath routes through the handle).
      const down = new CustomEvent('pointerdown', { bubbles: true, composed: true }) as CustomEvent & {
        composedPath: () => EventTarget[];
      };
      Object.defineProperty(down, 'composedPath', { value: () => [handle, item, page.root] });
      Object.defineProperty(down, 'button', { value: 0 });
      Object.defineProperty(down, 'clientY', { value: 0 });
      Object.defineProperty(down, 'pointerId', { value: 1 });
      page.root?.dispatchEvent(down);
      await page.waitForChanges();

      expect(page.root).toHaveClass('md-list--reordering');
      const placeholder = page.root?.shadowRoot?.querySelector('[part="drop-placeholder"]');
      expect(placeholder).toBeTruthy();
      expect(placeholder?.classList.contains('md-list__drop-placeholder')).toBe(true);
      // The lifted row carries the dragged affordance.
      expect(item.classList.contains('md-list-item--dragged')).toBe(true);

      // Dropping ends the drag and removes the ghost slot with no leftover.
      const up = new CustomEvent('pointerup', { bubbles: true }) as CustomEvent;
      Object.defineProperty(up, 'pointerId', { value: 1 });
      page.root?.dispatchEvent(up);
      await page.waitForChanges();

      expect(
        page.root?.shadowRoot?.querySelector('[part="drop-placeholder"]'),
      ).toBeFalsy();
      expect(page.root).not.toHaveClass('md-list--reordering');
    });

    it('does not render a drag handle when not reorderable', async () => {
      const page = await create(
        '<md-list><md-list-item type="button" headline="A"></md-list-item></md-list>',
      );
      const handle = page.root
        ?.querySelector('md-list-item')
        ?.shadowRoot?.querySelector('[data-list-drag-handle="true"]');
      expect(handle).toBeFalsy();
    });
  });
});
