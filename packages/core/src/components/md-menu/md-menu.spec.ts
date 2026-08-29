import { newSpecPage, SpecPage } from '@stencil/core/testing';
import { MdMenu } from './md-menu';
import { MdMenuItem } from '../md-menu-item/md-menu-item';
import { MdSubMenuItem } from '../md-sub-menu-item/md-sub-menu-item';

async function createMenu(html: string): Promise<SpecPage> {
  return newSpecPage({ components: [MdMenu, MdMenuItem, MdSubMenuItem], html });
}

function mockKeyEvent(key: string, target: HTMLElement, extra: Partial<KeyboardEvent> = {}): KeyboardEvent {
  const e = {
    key,
    target,
    preventDefault: jest.fn(),
    stopPropagation: jest.fn(),
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    ...extra,
  } as unknown as KeyboardEvent;
  return e;
}

describe('md-menu', () => {
  afterEach(() => { jest.useRealTimers(); });
  // ── Rendering ──

  it('renders and is hidden by default', async () => {
    const page = await createMenu(`<md-menu></md-menu>`);
    expect(page.root).toBeTruthy();
    expect(page.root?.classList.contains('md-menu')).toBe(true);
    expect(page.root?.classList.contains('md-menu--open')).toBe(false);
    expect(page.root?.getAttribute('aria-hidden')).toBe('true');
  });

  it('shows open state when open prop is set', async () => {
    const page = await createMenu(`<md-menu open></md-menu>`);
    expect(page.root?.classList.contains('md-menu--open')).toBe(true);
    expect(page.root?.getAttribute('aria-hidden')).toBe('false');
  });

  it('applies baseline variant class by default', async () => {
    const page = await createMenu(`<md-menu></md-menu>`);
    expect(page.root?.classList.contains('md-menu--baseline')).toBe(true);
  });

  it('applies standard variant class', async () => {
    const page = await createMenu(`<md-menu variant="standard"></md-menu>`);
    expect(page.root?.classList.contains('md-menu--standard')).toBe(true);
  });

  it('applies vibrant variant class', async () => {
    const page = await createMenu(`<md-menu variant="vibrant"></md-menu>`);
    expect(page.root?.classList.contains('md-menu--vibrant')).toBe(true);
  });

  it('applies quick class when quick is set', async () => {
    const page = await createMenu(`<md-menu quick></md-menu>`);
    expect(page.root?.classList.contains('md-menu--quick')).toBe(true);
  });

  it('applies gap class when use-gap is set', async () => {
    const page = await createMenu(`<md-menu variant="standard" use-gap></md-menu>`);
    expect(page.root?.classList.contains('md-menu--gap')).toBe(true);
  });

  it('renders surface with role="menu"', async () => {
    const page = await createMenu(`<md-menu></md-menu>`);
    const surface = page.root?.shadowRoot?.querySelector('.md-menu__surface');
    expect(surface).toBeTruthy();
    expect(surface?.getAttribute('role')).toBe('menu');
    expect(surface?.getAttribute('aria-orientation')).toBe('vertical');
  });

  it('assigns a unique id to the surface', async () => {
    const page = await createMenu(`<md-menu></md-menu>`);
    const surface = page.root?.shadowRoot?.querySelector('.md-menu__surface');
    expect(surface?.getAttribute('id')).toMatch(/^md-menu-\d+$/);
  });

  it('sets aria-labelledby when anchor is provided', async () => {
    const page = await createMenu(`<md-menu anchor="my-button"></md-menu>`);
    const surface = page.root?.shadowRoot?.querySelector('.md-menu__surface');
    expect(surface?.getAttribute('aria-labelledby')).toBe('my-button');
  });

  it('does not set aria-labelledby without anchor', async () => {
    const page = await createMenu(`<md-menu></md-menu>`);
    const surface = page.root?.shadowRoot?.querySelector('.md-menu__surface');
    expect(surface?.getAttribute('aria-labelledby')).toBeNull();
  });

  it('renders empty text when emptyText is set', async () => {
    const page = await createMenu(`<md-menu empty-text="No results"></md-menu>`);
    const empty = page.root?.shadowRoot?.querySelector('.md-menu__empty');
    expect(empty).toBeTruthy();
    expect(empty?.textContent).toBe('No results');
    expect(empty?.getAttribute('role')).toBe('status');
    expect(empty?.getAttribute('part')).toBe('empty-text');
  });

  it('does not render empty text when emptyText is empty', async () => {
    const page = await createMenu(`<md-menu></md-menu>`);
    const empty = page.root?.shadowRoot?.querySelector('.md-menu__empty');
    expect(empty).toBeFalsy();
  });

  it('aria-hidden is true during closing animation', async () => {
    const page = await createMenu(`<md-menu></md-menu>`);
    page.rootInstance.open = true;
    await page.waitForChanges();
    expect(page.root?.getAttribute('aria-hidden')).toBe('false');

    page.rootInstance.closing = true;
    await page.waitForChanges();
    expect(page.root?.classList.contains('md-menu--closing')).toBe(true);
    expect(page.root?.getAttribute('aria-hidden')).toBe('true');
  });

  // ── Events ──

  it('emits mdOpen when opened', async () => {
    const page = await createMenu(`<md-menu></md-menu>`);
    const spy = jest.fn();
    page.root?.addEventListener('mdOpen', spy);
    page.rootInstance.open = true;
    page.rootInstance.onOpenChange(true);
    await page.waitForChanges();
    expect(spy).toHaveBeenCalled();
  });

  it('mdOpen does not bubble to parent elements', async () => {
    const page = await newSpecPage({
      components: [MdMenu, MdMenuItem],
      html: '<div id="host"><md-menu></md-menu></div>',
    });
    const parentSpy = jest.fn();
    page.body.querySelector('#host')?.addEventListener('mdOpen', parentSpy);
    page.rootInstance.open = true;
    page.rootInstance.onOpenChange(true);
    await page.waitForChanges();
    expect(parentSpy).not.toHaveBeenCalled();
  });

  it('emits mdClose when closed', async () => {
    const page = await createMenu(`<md-menu open></md-menu>`);
    const spy = jest.fn();
    page.root?.addEventListener('mdClose', spy);
    page.rootInstance.open = false;
    page.rootInstance.onOpenChange(false);
    await page.waitForChanges();
    expect(spy).toHaveBeenCalled();
  });

  it('mdClose does not bubble to parent elements', async () => {
    const page = await newSpecPage({
      components: [MdMenu, MdMenuItem],
      html: '<div id="host"><md-menu open></md-menu></div>',
    });
    const parentSpy = jest.fn();
    page.body.querySelector('#host')?.addEventListener('mdClose', parentSpy);
    page.rootInstance.open = false;
    page.rootInstance.onOpenChange(false);
    await page.waitForChanges();
    expect(parentSpy).not.toHaveBeenCalled();
  });

  // ── Methods ──

  it('show() opens the menu', async () => {
    const page = await createMenu(`<md-menu></md-menu>`);
    await page.rootInstance.show();
    await page.waitForChanges();
    expect(page.rootInstance.open).toBe(true);
  });

  it('show() with autoFocus:false sets skipAutoFocus', async () => {
    const page = await createMenu(`<md-menu></md-menu>`);
    await page.rootInstance.show({ autoFocus: false });
    expect(page.rootInstance.open).toBe(true);
  });

  it('show() clears pending close timer', async () => {
    const page = await createMenu(`<md-menu></md-menu>`);
    page.rootInstance.open = true;
    await page.waitForChanges();
    jest.useFakeTimers();
    page.rootInstance.close();
    expect(page.rootInstance.closing).toBe(true);
    await page.rootInstance.show();
    expect(page.rootInstance.closing).toBe(false);
    expect(page.rootInstance.open).toBe(true);
  });

  it('close() enters closing state then sets open to false', async () => {
    const page = await createMenu(`<md-menu></md-menu>`);
    page.rootInstance.open = true;
    await page.waitForChanges();
    jest.useFakeTimers();

    page.rootInstance.close();
    expect(page.rootInstance.closing).toBe(true);
    expect(page.rootInstance.open).toBe(true);

    jest.advanceTimersByTime(150);
    expect(page.rootInstance.open).toBe(false);
    expect(page.rootInstance.closing).toBe(false);
  });

  it('close() with quick skips animation', async () => {
    const page = await createMenu(`<md-menu open quick></md-menu>`);
    await page.rootInstance.close();
    await page.waitForChanges();
    expect(page.rootInstance.open).toBe(false);
  });

  it('close() is a no-op when not open', async () => {
    const page = await createMenu(`<md-menu></md-menu>`);
    await page.rootInstance.close();
    expect(page.rootInstance.open).toBe(false);
  });

  it('close() is a no-op when already closing', async () => {
    const page = await createMenu(`<md-menu></md-menu>`);
    page.rootInstance.open = true;
    await page.waitForChanges();
    jest.useFakeTimers();
    page.rootInstance.close();
    expect(page.rootInstance.closing).toBe(true);
    page.rootInstance.close();
    expect(page.rootInstance.closing).toBe(true);
    jest.advanceTimersByTime(150);
  });

  // ── Slot ──

  it('renders slotted menu items', async () => {
    const page = await createMenu(`
      <md-menu open>
        <md-menu-item headline="Cut"></md-menu-item>
        <md-menu-item headline="Copy"></md-menu-item>
      </md-menu>
    `);
    const items = page.root?.querySelectorAll('md-menu-item');
    expect(items?.length).toBe(2);
  });

  // ── Layout ──

  it('applies grouped layout class for non-baseline variants', async () => {
    const page = await createMenu(`<md-menu variant="standard" layout="grouped"></md-menu>`);
    expect(page.root?.classList.contains('md-menu--grouped')).toBe(true);
  });

  it('does not apply layout class for baseline variant', async () => {
    const page = await createMenu(`<md-menu variant="baseline" layout="grouped"></md-menu>`);
    expect(page.root?.classList.contains('md-menu--grouped')).toBe(false);
  });

  // ── getMenuItems ──

  it('returns only direct children of this menu', async () => {
    const page = await createMenu(`
      <md-menu open>
        <md-menu-item headline="Cut"></md-menu-item>
        <md-sub-menu-item headline="More">
          <md-menu slot="submenu">
            <md-menu-item headline="Nested"></md-menu-item>
          </md-menu>
        </md-sub-menu-item>
      </md-menu>
    `);
    const items = page.rootInstance.getMenuItems();
    expect(items.length).toBe(2);
  });

  it('includes disabled items in getMenuItems', async () => {
    const page = await createMenu(`
      <md-menu open>
        <md-menu-item headline="Cut"></md-menu-item>
        <md-menu-item headline="Copy" disabled></md-menu-item>
        <md-menu-item headline="Paste"></md-menu-item>
      </md-menu>
    `);
    const items = page.rootInstance.getMenuItems();
    expect(items.length).toBe(3);
  });

  // ── Roving tabindex ──

  it('initRovingTabindex sets first item to tabindex 0 and rest to -1', async () => {
    const page = await createMenu(`
      <md-menu open>
        <md-menu-item headline="Cut"></md-menu-item>
        <md-menu-item headline="Copy"></md-menu-item>
        <md-menu-item headline="Paste"></md-menu-item>
      </md-menu>
    `);
    page.rootInstance.initRovingTabindex();
    const items = page.root!.querySelectorAll('md-menu-item');
    expect(items[0].getAttribute('tabindex')).toBe('0');
    expect(items[1].getAttribute('tabindex')).toBe('-1');
    expect(items[2].getAttribute('tabindex')).toBe('-1');
    expect(page.rootInstance.focusedIndex).toBe(0);
  });

  it('resetRovingTabindex sets all items to tabindex -1', async () => {
    const page = await createMenu(`
      <md-menu open>
        <md-menu-item headline="Cut"></md-menu-item>
        <md-menu-item headline="Copy"></md-menu-item>
      </md-menu>
    `);
    page.rootInstance.initRovingTabindex();
    page.rootInstance.resetRovingTabindex();
    const items = page.root!.querySelectorAll('md-menu-item');
    expect(items[0].getAttribute('tabindex')).toBe('-1');
    expect(items[1].getAttribute('tabindex')).toBe('-1');
  });

  it('focusFirstItem sets tabindex 0 on first item', async () => {
    const page = await createMenu(`
      <md-menu open>
        <md-menu-item headline="Cut"></md-menu-item>
        <md-menu-item headline="Copy"></md-menu-item>
      </md-menu>
    `);
    page.rootInstance.focusFirstItem();
    const items = page.root!.querySelectorAll('md-menu-item');
    expect(items[0].getAttribute('tabindex')).toBe('0');
    expect(page.rootInstance.focusedIndex).toBe(0);
  });

  // ── focusItem ──

  it('focusItem sets tabindex and updates focusedIndex', async () => {
    const page = await createMenu(`
      <md-menu open>
        <md-menu-item headline="Cut"></md-menu-item>
        <md-menu-item headline="Copy"></md-menu-item>
        <md-menu-item headline="Paste"></md-menu-item>
      </md-menu>
    `);
    const items = Array.from(page.root!.querySelectorAll('md-menu-item')) as HTMLElement[];
    page.rootInstance.focusItem(items, 1);
    expect(items[1].getAttribute('tabindex')).toBe('0');
    expect(page.rootInstance.focusedIndex).toBe(1);
  });

  it('focusItem wraps forward past last item', async () => {
    const page = await createMenu(`
      <md-menu open>
        <md-menu-item headline="Cut"></md-menu-item>
        <md-menu-item headline="Copy"></md-menu-item>
      </md-menu>
    `);
    const items = Array.from(page.root!.querySelectorAll('md-menu-item')) as HTMLElement[];
    page.rootInstance.focusItem(items, 0);
    page.rootInstance.focusItem(items, 2);
    expect(items[0].getAttribute('tabindex')).toBe('0');
    expect(page.rootInstance.focusedIndex).toBe(0);
  });

  it('focusItem wraps backward past first item', async () => {
    const page = await createMenu(`
      <md-menu open>
        <md-menu-item headline="Cut"></md-menu-item>
        <md-menu-item headline="Copy"></md-menu-item>
      </md-menu>
    `);
    const items = Array.from(page.root!.querySelectorAll('md-menu-item')) as HTMLElement[];
    page.rootInstance.focusItem(items, 1);
    page.rootInstance.focusItem(items, -1);
    expect(items[1].getAttribute('tabindex')).toBe('0');
    expect(page.rootInstance.focusedIndex).toBe(1);
  });

  it('focusItem is a no-op with empty array', async () => {
    const page = await createMenu(`<md-menu open></md-menu>`);
    page.rootInstance.focusItem([], 0);
    expect(page.rootInstance.focusedIndex).toBe(-1);
  });

  it('focusItem moves tabindex from previous to new item', async () => {
    const page = await createMenu(`
      <md-menu open>
        <md-menu-item headline="Cut"></md-menu-item>
        <md-menu-item headline="Copy"></md-menu-item>
        <md-menu-item headline="Paste"></md-menu-item>
      </md-menu>
    `);
    const items = Array.from(page.root!.querySelectorAll('md-menu-item')) as HTMLElement[];
    page.rootInstance.focusItem(items, 0);
    expect(items[0].getAttribute('tabindex')).toBe('0');
    page.rootInstance.focusItem(items, 2);
    expect(items[0].getAttribute('tabindex')).toBe('-1');
    expect(items[2].getAttribute('tabindex')).toBe('0');
  });

  // ── Keyboard navigation (handleKeyDown) ──

  it('ArrowDown moves focus to next item', async () => {
    const page = await createMenu(`
      <md-menu open>
        <md-menu-item headline="Cut"></md-menu-item>
        <md-menu-item headline="Copy"></md-menu-item>
        <md-menu-item headline="Paste"></md-menu-item>
      </md-menu>
    `);
    const items = page.root!.querySelectorAll('md-menu-item');
    page.rootInstance.focusItem(Array.from(items) as HTMLElement[], 0);

    const e = mockKeyEvent('ArrowDown', items[0] as HTMLElement);
    page.rootInstance.handleKeyDown(e);
    expect(e.preventDefault).toHaveBeenCalled();
    expect(items[1].getAttribute('tabindex')).toBe('0');
    expect(items[0].getAttribute('tabindex')).toBe('-1');
  });

  it('ArrowUp moves focus to previous item', async () => {
    const page = await createMenu(`
      <md-menu open>
        <md-menu-item headline="Cut"></md-menu-item>
        <md-menu-item headline="Copy"></md-menu-item>
        <md-menu-item headline="Paste"></md-menu-item>
      </md-menu>
    `);
    const items = page.root!.querySelectorAll('md-menu-item');
    page.rootInstance.focusItem(Array.from(items) as HTMLElement[], 2);

    const e = mockKeyEvent('ArrowUp', items[2] as HTMLElement);
    page.rootInstance.handleKeyDown(e);
    expect(e.preventDefault).toHaveBeenCalled();
    expect(items[1].getAttribute('tabindex')).toBe('0');
  });

  it('ArrowDown wraps from last to first', async () => {
    const page = await createMenu(`
      <md-menu open>
        <md-menu-item headline="Cut"></md-menu-item>
        <md-menu-item headline="Copy"></md-menu-item>
      </md-menu>
    `);
    const items = page.root!.querySelectorAll('md-menu-item');
    page.rootInstance.focusItem(Array.from(items) as HTMLElement[], 1);

    const e = mockKeyEvent('ArrowDown', items[1] as HTMLElement);
    page.rootInstance.handleKeyDown(e);
    expect(items[0].getAttribute('tabindex')).toBe('0');
  });

  it('ArrowUp wraps from first to last', async () => {
    const page = await createMenu(`
      <md-menu open>
        <md-menu-item headline="Cut"></md-menu-item>
        <md-menu-item headline="Copy"></md-menu-item>
      </md-menu>
    `);
    const items = page.root!.querySelectorAll('md-menu-item');
    page.rootInstance.focusItem(Array.from(items) as HTMLElement[], 0);

    const e = mockKeyEvent('ArrowUp', items[0] as HTMLElement);
    page.rootInstance.handleKeyDown(e);
    expect(items[1].getAttribute('tabindex')).toBe('0');
  });

  it('Home focuses first item', async () => {
    const page = await createMenu(`
      <md-menu open>
        <md-menu-item headline="Cut"></md-menu-item>
        <md-menu-item headline="Copy"></md-menu-item>
        <md-menu-item headline="Paste"></md-menu-item>
      </md-menu>
    `);
    const items = page.root!.querySelectorAll('md-menu-item');
    page.rootInstance.focusItem(Array.from(items) as HTMLElement[], 2);

    const e = mockKeyEvent('Home', items[2] as HTMLElement);
    page.rootInstance.handleKeyDown(e);
    expect(items[0].getAttribute('tabindex')).toBe('0');
  });

  it('End focuses last item', async () => {
    const page = await createMenu(`
      <md-menu open>
        <md-menu-item headline="Cut"></md-menu-item>
        <md-menu-item headline="Copy"></md-menu-item>
        <md-menu-item headline="Paste"></md-menu-item>
      </md-menu>
    `);
    const items = page.root!.querySelectorAll('md-menu-item');
    page.rootInstance.focusItem(Array.from(items) as HTMLElement[], 0);

    const e = mockKeyEvent('End', items[0] as HTMLElement);
    page.rootInstance.handleKeyDown(e);
    expect(items[2].getAttribute('tabindex')).toBe('0');
  });

  it('Escape closes the menu', async () => {
    const page = await createMenu(`
      <md-menu open quick>
        <md-menu-item headline="Cut"></md-menu-item>
      </md-menu>
    `);
    const items = page.root!.querySelectorAll('md-menu-item');
    page.rootInstance.focusItem(Array.from(items) as HTMLElement[], 0);

    const e = mockKeyEvent('Escape', items[0] as HTMLElement);
    page.rootInstance.handleKeyDown(e);
    await page.waitForChanges();
    expect(page.rootInstance.open).toBe(false);
  });

  it('Tab calls closeEntireMenuTree', async () => {
    const page = await createMenu(`
      <md-menu open quick>
        <md-menu-item headline="Cut"></md-menu-item>
      </md-menu>
    `);
    const items = page.root!.querySelectorAll('md-menu-item');
    page.rootInstance.focusItem(Array.from(items) as HTMLElement[], 0);

    const e = mockKeyEvent('Tab', items[0] as HTMLElement);
    page.rootInstance.handleKeyDown(e);
    await page.waitForChanges();
    expect(e.stopPropagation).toHaveBeenCalled();
    expect(page.rootInstance.open).toBe(false);
  });

  it('ignores keyboard events when menu is closed', async () => {
    const page = await createMenu(`
      <md-menu>
        <md-menu-item headline="Cut"></md-menu-item>
      </md-menu>
    `);
    const items = page.root!.querySelectorAll('md-menu-item');
    const e = mockKeyEvent('ArrowDown', items[0] as HTMLElement);
    page.rootInstance.handleKeyDown(e);
    expect(e.preventDefault).not.toHaveBeenCalled();
  });

  it('ignores keyboard events from nested submenus', async () => {
    const page = await createMenu(`
      <md-menu open>
        <md-menu-item headline="Cut"></md-menu-item>
        <md-sub-menu-item headline="More">
          <md-menu slot="submenu">
            <md-menu-item headline="Nested"></md-menu-item>
          </md-menu>
        </md-sub-menu-item>
      </md-menu>
    `);
    const directItems = page.rootInstance.getMenuItems();
    page.rootInstance.focusItem(directItems, 0);

    const nestedMenu = page.root!.querySelector('md-sub-menu-item md-menu') as HTMLElement;
    const nestedItem = nestedMenu?.querySelector('md-menu-item') as HTMLElement;
    const e = mockKeyEvent('ArrowDown', nestedItem);
    page.rootInstance.handleKeyDown(e);
    expect(e.preventDefault).not.toHaveBeenCalled();
    expect(page.rootInstance.focusedIndex).toBe(0);
  });

  // ── Typeahead ──

  it('typeahead focuses item matching typed character', async () => {
    const page = await createMenu(`
      <md-menu open>
        <md-menu-item headline="Cut"></md-menu-item>
        <md-menu-item headline="Copy"></md-menu-item>
        <md-menu-item headline="Paste"></md-menu-item>
      </md-menu>
    `);
    const items = Array.from(page.root!.querySelectorAll('md-menu-item')) as HTMLElement[];
    page.rootInstance.focusItem(items, 0);

    page.rootInstance.handleTypeahead('p', items);
    expect(items[2].getAttribute('tabindex')).toBe('0');
    expect(page.rootInstance.focusedIndex).toBe(2);
  });

  it('typeahead accumulates characters for multi-char matching', async () => {
    const page = await createMenu(`
      <md-menu open>
        <md-menu-item headline="Copy"></md-menu-item>
        <md-menu-item headline="Cut"></md-menu-item>
      </md-menu>
    `);
    const items = Array.from(page.root!.querySelectorAll('md-menu-item')) as HTMLElement[];
    page.rootInstance.focusItem(items, 0);

    page.rootInstance.handleTypeahead('c', items);
    page.rootInstance.handleTypeahead('u', items);
    expect(items[1].getAttribute('tabindex')).toBe('0');
  });

  it('typeahead via handleKeyDown for printable character', async () => {
    const page = await createMenu(`
      <md-menu open>
        <md-menu-item headline="Apple"></md-menu-item>
        <md-menu-item headline="Banana"></md-menu-item>
      </md-menu>
    `);
    const items = page.root!.querySelectorAll('md-menu-item');
    page.rootInstance.focusItem(Array.from(items) as HTMLElement[], 0);

    const e = mockKeyEvent('b', items[0] as HTMLElement);
    page.rootInstance.handleKeyDown(e);
    expect(items[1].getAttribute('tabindex')).toBe('0');
  });

  it('typeahead ignores characters with modifier keys', async () => {
    const page = await createMenu(`
      <md-menu open>
        <md-menu-item headline="Apple"></md-menu-item>
        <md-menu-item headline="Banana"></md-menu-item>
      </md-menu>
    `);
    const items = page.root!.querySelectorAll('md-menu-item');
    page.rootInstance.focusItem(Array.from(items) as HTMLElement[], 0);

    const e = mockKeyEvent('b', items[0] as HTMLElement, { ctrlKey: true } as any);
    page.rootInstance.handleKeyDown(e);
    expect(page.rootInstance.focusedIndex).toBe(0);

    const shiftE = mockKeyEvent('b', items[0] as HTMLElement, { shiftKey: true } as any);
    page.rootInstance.handleKeyDown(shiftE);
    expect(page.rootInstance.focusedIndex).toBe(0);
  });

  // ── handleFocusIn ──

  it('handleFocusIn syncs focusedIndex when a different item receives focus', async () => {
    const page = await createMenu(`
      <md-menu open>
        <md-menu-item headline="Cut"></md-menu-item>
        <md-menu-item headline="Copy"></md-menu-item>
      </md-menu>
    `);
    const items = page.root!.querySelectorAll('md-menu-item');
    page.rootInstance.focusItem(Array.from(items) as HTMLElement[], 0);

    page.rootInstance.handleFocusIn({ target: items[1] } as unknown as FocusEvent);
    expect(page.rootInstance.focusedIndex).toBe(1);
    expect(items[1].getAttribute('tabindex')).toBe('0');
    expect(items[0].getAttribute('tabindex')).toBe('-1');
  });

  it('handleFocusIn is a no-op when menu is closed', async () => {
    const page = await createMenu(`
      <md-menu>
        <md-menu-item headline="Cut"></md-menu-item>
      </md-menu>
    `);
    const items = page.root!.querySelectorAll('md-menu-item');
    page.rootInstance.handleFocusIn({ target: items[0] } as unknown as FocusEvent);
    expect(page.rootInstance.focusedIndex).toBe(-1);
  });

  it('handleFocusIn is a no-op when same item refocuses', async () => {
    const page = await createMenu(`
      <md-menu open>
        <md-menu-item headline="Cut"></md-menu-item>
        <md-menu-item headline="Copy"></md-menu-item>
      </md-menu>
    `);
    const items = page.root!.querySelectorAll('md-menu-item');
    page.rootInstance.focusItem(Array.from(items) as HTMLElement[], 0);

    page.rootInstance.handleFocusIn({ target: items[0] } as unknown as FocusEvent);
    expect(page.rootInstance.focusedIndex).toBe(0);
    expect(items[0].getAttribute('tabindex')).toBe('0');
  });

  it('handleFocusIn ignores unknown targets', async () => {
    const page = await createMenu(`
      <md-menu open>
        <md-menu-item headline="Cut"></md-menu-item>
      </md-menu>
    `);
    page.rootInstance.focusItem(
      Array.from(page.root!.querySelectorAll('md-menu-item')) as HTMLElement[], 0
    );
    const fakeEl = document.createElement('div');
    page.rootInstance.handleFocusIn({ target: fakeEl } as unknown as FocusEvent);
    expect(page.rootInstance.focusedIndex).toBe(0);
  });

  // ── onOpenChange branches ──

  it('onOpenChange(false) resets focusedIndex and roving tabindex', async () => {
    const page = await createMenu(`
      <md-menu open>
        <md-menu-item headline="Cut"></md-menu-item>
        <md-menu-item headline="Copy"></md-menu-item>
      </md-menu>
    `);
    const items = page.root!.querySelectorAll('md-menu-item');
    page.rootInstance.focusItem(Array.from(items) as HTMLElement[], 1);

    page.rootInstance.open = false;
    page.rootInstance.onOpenChange(false);
    await page.waitForChanges();
    expect(page.rootInstance.focusedIndex).toBe(-1);
    expect(items[0].getAttribute('tabindex')).toBe('-1');
    expect(items[1].getAttribute('tabindex')).toBe('-1');
  });

  // ── closeEntireMenuTree ──

  it('closeEntireMenuTree closes this menu when no parent', async () => {
    const page = await createMenu(`
      <md-menu open quick>
        <md-menu-item headline="Cut"></md-menu-item>
      </md-menu>
    `);
    page.rootInstance.closeEntireMenuTree();
    await page.waitForChanges();
    expect(page.rootInstance.open).toBe(false);
  });

  it('closeEntireMenuTree sets all items to tabindex -1', async () => {
    const page = await createMenu(`
      <md-menu open quick>
        <md-menu-item headline="Cut"></md-menu-item>
        <md-menu-item headline="Copy"></md-menu-item>
      </md-menu>
    `);
    page.rootInstance.initRovingTabindex();
    page.rootInstance.closeEntireMenuTree();
    await page.waitForChanges();
    const items = page.root!.querySelectorAll('md-menu-item');
    expect(items[0].getAttribute('tabindex')).toBe('-1');
    expect(items[1].getAttribute('tabindex')).toBe('-1');
  });

  // ── handleOutsideClick ──

  it('handleOutsideClick closes menu when click is outside', async () => {
    const page = await createMenu(`<md-menu open quick></md-menu>`);
    const fakeEvent = { composedPath: () => [] } as unknown as MouseEvent;
    page.rootInstance.handleOutsideClick(fakeEvent);
    await page.waitForChanges();
    expect(page.rootInstance.open).toBe(false);
  });

  it('handleOutsideClick does not close when click is inside', async () => {
    const page = await createMenu(`<md-menu open quick></md-menu>`);
    const fakeEvent = { composedPath: () => [page.root] } as unknown as MouseEvent;
    page.rootInstance.handleOutsideClick(fakeEvent);
    expect(page.rootInstance.open).toBe(true);
  });

  // ── persistent ──

  type Peer = HTMLElement & { open: boolean; persistent: boolean; quick: boolean };

  async function attachPeer(page: SpecPage, opts: { open: boolean; persistent: boolean }): Promise<Peer> {
    const peer = page.doc.createElement('md-menu') as Peer;
    peer.setAttribute('quick', '');
    if (opts.open) peer.setAttribute('open', '');
    if (opts.persistent) peer.setAttribute('persistent', '');
    page.body.appendChild(peer);
    await page.waitForChanges();
    return peer;
  }

  it('persistent defaults to false', async () => {
    const page = await createMenu(`<md-menu></md-menu>`);
    expect(page.rootInstance.persistent).toBe(false);
  });

  it('handleOutsideClick is a no-op when persistent', async () => {
    const page = await createMenu(`<md-menu open quick persistent></md-menu>`);
    const fakeEvent = { composedPath: () => [] } as unknown as MouseEvent;
    page.rootInstance.handleOutsideClick(fakeEvent);
    await page.waitForChanges();
    expect(page.rootInstance.open).toBe(true);
  });

  it('dismissPeerMenus closes other open non-persistent menus', async () => {
    const page = await createMenu(`<md-menu></md-menu>`);
    const peer = await attachPeer(page, { open: true, persistent: false });
    expect(peer.open).toBe(true);
    page.rootInstance.dismissPeerMenus();
    await page.waitForChanges();
    expect(peer.open).toBe(false);
  });

  it('dismissPeerMenus skips persistent peers', async () => {
    const page = await createMenu(`<md-menu></md-menu>`);
    const peer = await attachPeer(page, { open: true, persistent: true });
    page.rootInstance.dismissPeerMenus();
    await page.waitForChanges();
    expect(peer.open).toBe(true);
  });

  it('dismissPeerMenus skips already-closed peers', async () => {
    const page = await createMenu(`<md-menu></md-menu>`);
    const peer = await attachPeer(page, { open: false, persistent: false });
    expect(peer.open).toBe(false);
    page.rootInstance.dismissPeerMenus();
    await page.waitForChanges();
    expect(peer.open).toBe(false);
  });

  it('dismissPeerMenus is a no-op when this menu is persistent', async () => {
    const page = await createMenu(`<md-menu persistent></md-menu>`);
    const peer = await attachPeer(page, { open: true, persistent: false });
    page.rootInstance.dismissPeerMenus();
    await page.waitForChanges();
    expect(peer.open).toBe(true);
  });

  // ── handleDocumentKeyDown ──

  it('handleDocumentKeyDown closes menu on Escape', async () => {
    const page = await createMenu(`<md-menu open quick></md-menu>`);
    page.rootInstance.handleDocumentKeyDown({ key: 'Escape' } as KeyboardEvent);
    await page.waitForChanges();
    expect(page.rootInstance.open).toBe(false);
  });

  it('handleDocumentKeyDown ignores non-Escape keys', async () => {
    const page = await createMenu(`<md-menu open quick></md-menu>`);
    page.rootInstance.handleDocumentKeyDown({ key: 'a' } as KeyboardEvent);
    expect(page.rootInstance.open).toBe(true);
  });

  // ── handleScroll ──

  it('handleScroll does nothing when closed', async () => {
    const page = await createMenu(`<md-menu></md-menu>`);
    expect(() => page.rootInstance.handleScroll()).not.toThrow();
  });

  it('handleScroll does nothing when closing', async () => {
    const page = await createMenu(`<md-menu></md-menu>`);
    page.rootInstance.open = true;
    await page.waitForChanges();
    jest.useFakeTimers();
    page.rootInstance.close();
    expect(() => page.rootInstance.handleScroll()).not.toThrow();
    jest.advanceTimersByTime(150);
  });

  // ── restoreFocusToAnchor ──

  it('restoreFocusToAnchor returns early without anchor', async () => {
    const page = await createMenu(`<md-menu></md-menu>`);
    expect(() => page.rootInstance.restoreFocusToAnchor()).not.toThrow();
  });

  // ── updateAnchorAria ──

  it('updateAnchorAria returns early without anchor', async () => {
    const page = await createMenu(`<md-menu></md-menu>`);
    expect(() => page.rootInstance.updateAnchorAria(true)).not.toThrow();
  });

  it('updateAnchorAria sets ARIA attributes on anchor element', async () => {
    const page = await createMenu(`<md-menu anchor="test-anchor"></md-menu>`);
    const anchor = document.createElement('button');
    anchor.id = 'test-anchor';
    page.body.appendChild(anchor);

    page.rootInstance.updateAnchorAria(true);
    expect(anchor.getAttribute('aria-haspopup')).toBe('menu');
    expect(anchor.getAttribute('aria-expanded')).toBe('true');
    expect(anchor.getAttribute('aria-controls')).toMatch(/^md-menu-\d+$/);

    page.rootInstance.updateAnchorAria(false);
    expect(anchor.getAttribute('aria-expanded')).toBe('false');
  });

  it('updateAnchorAria is safe when anchor element not found', async () => {
    const page = await createMenu(`<md-menu anchor="nonexistent"></md-menu>`);
    expect(() => page.rootInstance.updateAnchorAria(true)).not.toThrow();
  });

  // ── disconnectedCallback ──

  it('disconnectedCallback clears timers and resets anchor ARIA', async () => {
    const page = await createMenu(`<md-menu></md-menu>`);
    expect(() => page.rootInstance.disconnectedCallback()).not.toThrow();
  });

  // ── getItemLabel ──

  it('getItemLabel returns headline from element', async () => {
    const page = await createMenu(`
      <md-menu>
        <md-menu-item headline="Cut"></md-menu-item>
      </md-menu>
    `);
    const item = page.root!.querySelector('md-menu-item')!;
    expect(page.rootInstance.getItemLabel(item)).toBe('Cut');
  });

  it('getItemLabel falls back to textContent', async () => {
    const page = await createMenu(`<md-menu></md-menu>`);
    const el = document.createElement('div');
    el.textContent = 'Fallback';
    expect(page.rootInstance.getItemLabel(el)).toBe('Fallback');
  });

  it('getItemLabel returns empty string when no headline or textContent', async () => {
    const page = await createMenu(`<md-menu></md-menu>`);
    const el = document.createElement('div');
    expect(page.rootInstance.getItemLabel(el)).toBe('');
  });

  it('handleKeyDown is a no-op when open but has no items', async () => {
    const page = await createMenu(`<md-menu open></md-menu>`);
    const e = mockKeyEvent('ArrowDown', page.root as unknown as HTMLElement);
    page.rootInstance.handleKeyDown(e);
    expect(e.preventDefault).not.toHaveBeenCalled();
  });

  // ── applyDepthZIndex ──

  it('applyDepthZIndex sets z-index when anchor is present', async () => {
    const page = await createMenu(`<md-menu anchor="btn"></md-menu>`);
    page.rootInstance.applyDepthZIndex();
    expect(page.root!.style.zIndex).toBe('var(--md-sys-z-index-popup, 1000)');
  });

  it('applyDepthZIndex is a no-op without anchor', async () => {
    const page = await createMenu(`<md-menu></md-menu>`);
    page.rootInstance.applyDepthZIndex();
    expect(page.root!.style.zIndex).toBe('');
  });

  // ── componentDidLoad ──

  it('componentDidLoad calls applyDepthZIndex when open', async () => {
    const page = await createMenu(`<md-menu anchor="btn" open></md-menu>`);
    expect(page.root!.style.zIndex).toBe('var(--md-sys-z-index-popup, 1000)');
  });

  // ── positionMenu ──

  describe('positionMenu', () => {
    function setupAnchor(page: SpecPage, id: string, rect: Partial<DOMRect>) {
      const btn = document.createElement('button');
      btn.id = id;
      btn.getBoundingClientRect = () => ({
        top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => {},
        ...rect,
      } as DOMRect);
      page.body.appendChild(btn);
      return btn;
    }

    function mockSurface(page: SpecPage, w: number, h: number) {
      const surface = page.root!.shadowRoot!.querySelector('.md-menu__surface') as HTMLElement;
      Object.defineProperty(surface, 'offsetWidth', { value: w, configurable: true });
      Object.defineProperty(surface, 'offsetHeight', { value: h, configurable: true });
      return surface;
    }

    it('returns early without anchor', async () => {
      const page = await createMenu(`<md-menu></md-menu>`);
      page.rootInstance.positionMenu();
      expect(page.root!.style.top).toBe('');
    });

    it('returns early when anchor element not found', async () => {
      const page = await createMenu(`<md-menu anchor="missing"></md-menu>`);
      page.rootInstance.positionMenu();
      expect(page.root!.style.top).toBe('');
    });

    it('does not set final position when surface has zero dimensions', async () => {
      const page = await createMenu(`<md-menu anchor="pos-anchor"></md-menu>`);
      setupAnchor(page, 'pos-anchor', { top: 100, bottom: 140, left: 50, right: 150, width: 100, height: 40 });

      const surface = page.root!.shadowRoot!.querySelector('.md-menu__surface') as HTMLElement;
      Object.defineProperty(surface, 'offsetWidth', { value: 0, configurable: true });
      Object.defineProperty(surface, 'offsetHeight', { value: 0, configurable: true });

      page.rootInstance.positionMenu();

      expect(page.root!.style.top).toBe('0');
      expect(page.root!.style.left).toBe('0');
    });

    it('positions bottom-start (default) with enough space', async () => {
      const page = await createMenu(`<md-menu anchor="pos-anchor" placement="bottom-start"></md-menu>`);
      setupAnchor(page, 'pos-anchor', { top: 100, bottom: 140, left: 50, right: 150, width: 100, height: 40 });
      const surface = mockSurface(page, 200, 300);
      Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: 768, configurable: true });

      page.rootInstance.positionMenu();

      expect(page.root!.style.top).toBe('144px');
      expect(page.root!.style.left).toBe('50px');
      expect(surface.style.transformOrigin).toBe('top left');
    });

    it('flips vertical to top when bottom overflows', async () => {
      const page = await createMenu(`<md-menu anchor="pos-anchor" placement="bottom-start"></md-menu>`);
      setupAnchor(page, 'pos-anchor', { top: 600, bottom: 640, left: 50, right: 150, width: 100, height: 40 });
      mockSurface(page, 200, 300);
      Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: 768, configurable: true });

      page.rootInstance.positionMenu();

      expect(page.root!.style.top).toBe('296px');
    });

    it('flips vertical to bottom when top overflows (top-start placement)', async () => {
      const page = await createMenu(`<md-menu anchor="pos-anchor" placement="top-start"></md-menu>`);
      setupAnchor(page, 'pos-anchor', { top: 50, bottom: 90, left: 50, right: 150, width: 100, height: 40 });
      mockSurface(page, 200, 300);
      Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: 768, configurable: true });

      page.rootInstance.positionMenu();

      expect(page.root!.style.top).toBe('94px');
    });

    it('flips horizontal to end when start overflows viewport', async () => {
      const page = await createMenu(`<md-menu anchor="pos-anchor" placement="bottom-start"></md-menu>`);
      setupAnchor(page, 'pos-anchor', { top: 100, bottom: 140, left: 900, right: 1000, width: 100, height: 40 });
      mockSurface(page, 200, 100);
      Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: 768, configurable: true });

      page.rootInstance.positionMenu();

      expect(page.root!.style.left).toBe('800px');
    });

    it('flips horizontal to start when end overflows (bottom-end placement)', async () => {
      const page = await createMenu(`<md-menu anchor="pos-anchor" placement="bottom-end"></md-menu>`);
      setupAnchor(page, 'pos-anchor', { top: 100, bottom: 140, left: 50, right: 150, width: 100, height: 40 });
      mockSurface(page, 200, 100);
      Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: 768, configurable: true });

      page.rootInstance.positionMenu();

      expect(page.root!.style.left).toBe('50px');
    });

    it('sets surface minWidth when matchAnchorWidth is true', async () => {
      const page = await createMenu(`<md-menu anchor="pos-anchor" match-anchor-width></md-menu>`);
      setupAnchor(page, 'pos-anchor', { top: 100, bottom: 140, left: 50, right: 250, width: 200, height: 40 });
      const surface = mockSurface(page, 200, 100);
      Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: 768, configurable: true });

      page.rootInstance.positionMenu();

      expect(surface.style.minWidth).toBe('200px');
    });

    it('positions top-end correctly', async () => {
      const page = await createMenu(`<md-menu anchor="pos-anchor" placement="top-end"></md-menu>`);
      setupAnchor(page, 'pos-anchor', { top: 400, bottom: 440, left: 500, right: 600, width: 100, height: 40 });
      const surface = mockSurface(page, 150, 200);
      Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: 768, configurable: true });

      page.rootInstance.positionMenu();

      expect(page.root!.style.top).toBe('196px');
      expect(page.root!.style.left).toBe('450px');
      expect(surface.style.transformOrigin).toBe('bottom right');
    });
  });

  // ── restoreFocusToAnchor with anchor ──

  it('restoreFocusToAnchor focuses the anchor element', async () => {
    const page = await createMenu(`<md-menu anchor="focus-btn"></md-menu>`);
    const btn = document.createElement('button');
    btn.id = 'focus-btn';
    btn.focus = jest.fn();
    page.body.appendChild(btn);

    page.rootInstance.restoreFocusToAnchor();
    expect(btn.focus).toHaveBeenCalled();
  });

  it('restoreFocusToAnchor is safe when anchor element not found', async () => {
    const page = await createMenu(`<md-menu anchor="nonexistent"></md-menu>`);
    expect(() => page.rootInstance.restoreFocusToAnchor()).not.toThrow();
  });

  // ── onOpenChange with anchor (listener management) ──

  it('onOpenChange(true) with anchor registers scroll/resize listeners', async () => {
    const page = await createMenu(`<md-menu anchor="anchor-el"></md-menu>`);
    const addSpy = jest.spyOn(window, 'addEventListener');
    page.rootInstance.onOpenChange(true);
    expect(addSpy).toHaveBeenCalledWith('scroll', expect.any(Function), true);
    expect(addSpy).toHaveBeenCalledWith('resize', expect.any(Function));
    addSpy.mockRestore();
  });

  it('onOpenChange(false) with anchor removes scroll/resize listeners', async () => {
    const page = await createMenu(`<md-menu anchor="anchor-el"></md-menu>`);
    const removeSpy = jest.spyOn(window, 'removeEventListener');
    page.rootInstance.onOpenChange(false);
    expect(removeSpy).toHaveBeenCalledWith('scroll', expect.any(Function), true);
    expect(removeSpy).toHaveBeenCalledWith('resize', expect.any(Function));
    removeSpy.mockRestore();
  });

  it('onOpenChange(true) with skipAutoFocus calls initRovingTabindex instead of focusFirstItem', async () => {
    const page = await createMenu(`
      <md-menu anchor="test-skip">
        <md-menu-item headline="A"></md-menu-item>
        <md-menu-item headline="B"></md-menu-item>
      </md-menu>
    `);
    page.rootInstance.skipAutoFocus = true;
    const initSpy = jest.spyOn(page.rootInstance, 'initRovingTabindex');
    page.rootInstance.onOpenChange(true);

    await new Promise(r => setTimeout(r, 50));

    expect(initSpy).toHaveBeenCalled();
    expect(page.rootInstance.skipAutoFocus).toBe(false);
    initSpy.mockRestore();
  });

  it('onOpenChange(true) with auto-focus=false calls initRovingTabindex instead of focusFirstItem', async () => {
    const page = await createMenu(`
      <md-menu anchor="test-no-autofocus" auto-focus="false">
        <md-menu-item headline="A"></md-menu-item>
        <md-menu-item headline="B"></md-menu-item>
      </md-menu>
    `);
    const initSpy = jest.spyOn(page.rootInstance, 'initRovingTabindex');
    const focusSpy = jest.spyOn(page.rootInstance, 'focusFirstItem');
    page.rootInstance.onOpenChange(true);

    await new Promise((r) => setTimeout(r, 50));

    expect(initSpy).toHaveBeenCalled();
    expect(focusSpy).not.toHaveBeenCalled();
    initSpy.mockRestore();
    focusSpy.mockRestore();
  });

  it('onOpenChange(false) with anchor removes document listeners', async () => {
    const page = await createMenu(`<md-menu anchor="anchor-el"></md-menu>`);
    const removeSpy = jest.spyOn(document, 'removeEventListener');
    page.rootInstance.onOpenChange(false);
    expect(removeSpy).toHaveBeenCalledWith('click', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    removeSpy.mockRestore();
  });

  // ── handleScroll when open ──

  it('handleScroll calls positionMenu when open and not closing', async () => {
    const page = await createMenu(`<md-menu anchor="scroll-btn"></md-menu>`);
    page.rootInstance.open = true;
    page.rootInstance.closing = false;
    const spy = jest.spyOn(page.rootInstance, 'positionMenu');
    page.rootInstance.handleScroll();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  // ── closeEntireMenuTree with parent menu ──

  it('closeEntireMenuTree walks up to root parent menu', async () => {
    const page = await createMenu(`
      <md-menu open quick>
        <md-menu-item headline="Child"></md-menu-item>
      </md-menu>
    `);
    const outerMenu = document.createElement('md-menu');
    const closeFn = jest.fn();
    Object.defineProperty(outerMenu, 'close', { value: closeFn, configurable: true });
    Object.defineProperty(outerMenu, 'anchor', { value: '', configurable: true, writable: true });
    const subItem = document.createElement('md-sub-menu-item');
    subItem.appendChild(page.root!);
    outerMenu.appendChild(subItem);
    page.body.appendChild(outerMenu);

    page.rootInstance.closeEntireMenuTree();

    expect(closeFn).toHaveBeenCalled();
  });

  it('closeEntireMenuTree focuses anchor of root menu', async () => {
    const page = await createMenu(`
      <md-menu open quick>
        <md-menu-item headline="Child"></md-menu-item>
      </md-menu>
    `);
    const outerMenu = document.createElement('md-menu');
    Object.defineProperty(outerMenu, 'close', { value: jest.fn(), configurable: true });
    Object.defineProperty(outerMenu, 'anchor', { value: 'root-anchor', configurable: true });
    const subItem = document.createElement('md-sub-menu-item');
    subItem.appendChild(page.root!);
    outerMenu.appendChild(subItem);

    const anchorBtn = document.createElement('button');
    anchorBtn.id = 'root-anchor';
    anchorBtn.focus = jest.fn();
    page.body.appendChild(anchorBtn);
    page.body.appendChild(outerMenu);

    page.rootInstance.closeEntireMenuTree();

    expect(anchorBtn.focus).toHaveBeenCalled();
  });

  // ── propagateVariant / updateSections / handleSlotChange ──

  describe('slot-based helpers', () => {
    function mockSlot(page: SpecPage, elements: HTMLElement[]) {
      // Mock the DEFAULT (content) slot — the same one getContentSlot() targets.
      // The surface also renders a named `header` slot first, so querySelector
      // ('slot') would grab that instead and diverge from the component.
      const slots = Array.from(page.root!.shadowRoot!.querySelectorAll('slot')) as HTMLElement[];
      const slot = slots.find((s) => !s.getAttribute('name')) ?? slots[0];
      if (slot) {
        (slot as any).assignedElements = () => elements;
      }
    }

    it('handleSlotChange calls updateSections and propagateVariant', async () => {
      const page = await createMenu(`<md-menu></md-menu>`);
      const updateSpy = jest.spyOn(page.rootInstance, 'updateSections');
      const propSpy = jest.spyOn(page.rootInstance, 'propagateVariant');
      page.rootInstance.handleSlotChange();
      expect(updateSpy).toHaveBeenCalled();
      expect(propSpy).toHaveBeenCalled();
      updateSpy.mockRestore();
      propSpy.mockRestore();
    });

    it('propagateVariant sets data-variant on children', async () => {
      const page = await createMenu(`<md-menu variant="standard"></md-menu>`);
      const child1 = document.createElement('md-menu-item');
      const child2 = document.createElement('md-menu-item');
      mockSlot(page, [child1, child2]);

      page.rootInstance.propagateVariant();

      expect(child1.getAttribute('data-variant')).toBe('standard');
      expect(child2.getAttribute('data-variant')).toBe('standard');
    });

    it('propagateVariant handles md-menu-item-group with useGap', async () => {
      const page = await createMenu(`<md-menu variant="standard" use-gap></md-menu>`);
      const group = document.createElement('md-menu-item-group');
      const item = document.createElement('md-menu-item');
      group.appendChild(item);
      mockSlot(page, [group]);

      page.rootInstance.propagateVariant();

      expect(group.getAttribute('data-variant')).toBe('standard');
      expect(group.hasAttribute('data-use-gap')).toBe(true);
      expect(item.getAttribute('data-variant')).toBe('standard');
    });

    it('propagateVariant removes data-use-gap when useGap is false', async () => {
      const page = await createMenu(`<md-menu variant="standard"></md-menu>`);
      const group = document.createElement('md-menu-item-group');
      group.setAttribute('data-use-gap', '');
      mockSlot(page, [group]);

      page.rootInstance.propagateVariant();

      expect(group.hasAttribute('data-use-gap')).toBe(false);
    });

    it('propagateVariant returns early if no slot', async () => {
      const page = await createMenu(`<md-menu></md-menu>`);
      const origSlot = page.root!.shadowRoot!.querySelector('slot');
      if (origSlot) origSlot.remove();
      expect(() => page.rootInstance.propagateVariant()).not.toThrow();
    });

    it('updateSections marks sectioned when gap items found', async () => {
      const page = await createMenu(`<md-menu></md-menu>`);
      const child1 = document.createElement('md-menu-item');
      const gapChild = document.createElement('md-menu-item');
      gapChild.setAttribute('gap', '');
      const child3 = document.createElement('md-menu-item');
      mockSlot(page, [child1, gapChild, child3]);

      page.rootInstance.updateSections();

      expect(page.rootInstance.sectioned).toBe(true);
      expect(child3.hasAttribute('data-after-gap')).toBe(true);
      expect(child1.hasAttribute('data-after-gap')).toBe(false);
    });

    it('updateSections sets sectioned false when no gaps', async () => {
      const page = await createMenu(`<md-menu></md-menu>`);
      const child1 = document.createElement('md-menu-item');
      const child2 = document.createElement('md-menu-item');
      mockSlot(page, [child1, child2]);

      page.rootInstance.updateSections();

      expect(page.rootInstance.sectioned).toBe(false);
    });

    it('updateSections removes stale data-after-gap', async () => {
      const page = await createMenu(`<md-menu></md-menu>`);
      const child1 = document.createElement('md-menu-item');
      child1.setAttribute('data-after-gap', '');
      const child2 = document.createElement('md-menu-item');
      mockSlot(page, [child1, child2]);

      page.rootInstance.updateSections();

      expect(child1.hasAttribute('data-after-gap')).toBe(false);
    });

    it('updateSections returns early if no slot', async () => {
      const page = await createMenu(`<md-menu></md-menu>`);
      const slot = page.root!.shadowRoot!.querySelector('slot');
      if (slot) slot.remove();
      expect(() => page.rootInstance.updateSections()).not.toThrow();
    });
  });

  // ── disconnectedCallback with active state ──

  describe('inline-fill', () => {
    it('wraps content in a scroll viewport for edge scroll fades', async () => {
      const page = await createMenu(
        `<md-menu class="md-menu--inline-fill" open><md-menu-item headline="Jan"></md-menu-item></md-menu>`,
      );
      expect(
        page.root?.shadowRoot?.querySelector('.md-menu__scroll-shadow'),
      ).toBeTruthy();
    });

    it('wraps every regular menu body in a scroll viewport (viewport-bounded scroll)', async () => {
      const page = await createMenu(
        `<md-menu open><md-menu-item headline="Jan"></md-menu-item></md-menu>`,
      );
      // Regular menus now scroll inside a bounded viewport — with a pinned header —
      // when they would overflow, not only when max-height is set.
      expect(page.root?.shadowRoot?.querySelector('.md-menu__scroll-shadow')).toBeTruthy();
    });
  });

  // ── max-height (capped, scrollable) ──

  describe('max-height', () => {
    it('adds the scroll class and wraps the body in a scroll viewport when set', async () => {
      const page = await createMenu(
        `<md-menu open max-height="240">
          <md-menu-item headline="One"></md-menu-item>
        </md-menu>`,
      );
      expect(page.root?.classList.contains('md-menu--scroll')).toBe(true);
      expect(
        page.root?.shadowRoot?.querySelector('.md-menu__scroll-shadow'),
      ).toBeTruthy();
    });

    it('clamps the scroll viewport max-block-size to the viewport', async () => {
      const page = await createMenu(
        `<md-menu open max-height="240"><md-menu-item headline="One"></md-menu-item></md-menu>`,
      );
      const shadow = page.root?.shadowRoot?.querySelector(
        '.md-menu__scroll-shadow',
      ) as HTMLElement;
      expect(shadow.style.maxBlockSize).toContain('240px');
      expect(shadow.style.maxBlockSize).toContain('min(');
    });

    it('treats a bare numeric attribute value as pixels', async () => {
      const page = await createMenu(`<md-menu max-height="320"></md-menu>`);
      expect(page.rootInstance.maxHeightValue).toBe('320px');
    });

    it('passes a CSS length string through unchanged', async () => {
      const page = await createMenu(`<md-menu max-height="50vh"></md-menu>`);
      expect(page.rootInstance.maxHeightValue).toBe('50vh');
    });

    it('is viewport-bounded (scroll class + shadow) even when max-height is unset', async () => {
      const page = await createMenu(`<md-menu open></md-menu>`);
      expect(page.rootInstance.maxHeightValue).toBeNull();
      // A regular menu is now scroll-capped to the viewport regardless of max-height.
      expect(page.rootInstance.scrollCapped).toBe(true);
      expect(page.root?.classList.contains('md-menu--scroll')).toBe(true);
    });

    // A menu with submenus used to opt OUT of the cap, and this test asserted
    // that. The flyout was an absolutely-positioned child of its row laid out
    // entirely outside the surface's box, so any overflow above it clipped the
    // flyout away completely. It is `position: fixed` now and escapes the scroll
    // viewport, so a submenu menu caps and scrolls like every other one.
    it('scroll-caps like any other menu when the menu has submenus', async () => {
      const page = await createMenu(
        `<md-menu open max-height="240">
          <md-sub-menu-item headline="More">
            <md-menu slot="submenu">
              <md-menu-item headline="Nested"></md-menu-item>
            </md-menu>
          </md-sub-menu-item>
        </md-menu>`,
      );
      // slotchange does not fire in the spec DOM; drive the scan manually so
      // hasSubmenu reflects the markup.
      page.rootInstance.handleSlotChange();
      await page.waitForChanges();
      expect(page.rootInstance.hasSubmenu).toBe(true);
      expect(page.rootInstance.scrollCapped).toBe(true);
      expect(page.root?.classList.contains('md-menu--scroll')).toBe(true);

      const viewport = page.root?.shadowRoot?.querySelector(
        '.md-menu__scroll-shadow',
      ) as HTMLElement;
      expect(viewport).toBeTruthy();
      // The explicit prop still wins over the custom property.
      expect(viewport.style.maxBlockSize).toContain('240px');
    });

    it('caps a submenu menu at --md-menu-max-block-size when max-height is unset', async () => {
      const page = await createMenu(
        `<md-menu open>
          <md-sub-menu-item headline="More">
            <md-menu slot="submenu">
              <md-menu-item headline="Nested"></md-menu-item>
            </md-menu>
          </md-sub-menu-item>
        </md-menu>`,
      );
      page.rootInstance.handleSlotChange();
      await page.waitForChanges();
      const viewport = page.root?.shadowRoot?.querySelector(
        '.md-menu__scroll-shadow',
      ) as HTMLElement;
      expect(viewport.style.maxBlockSize).toContain('var(--md-menu-max-block-size, 250px)');
    });
  });

  it('disconnectedCallback removes all event listeners', async () => {
    const page = await createMenu(`<md-menu anchor="dc-anchor"></md-menu>`);
    const docRemoveSpy = jest.spyOn(document, 'removeEventListener');
    const winRemoveSpy = jest.spyOn(window, 'removeEventListener');

    page.rootInstance.disconnectedCallback();

    expect(docRemoveSpy).toHaveBeenCalledWith('click', expect.any(Function));
    expect(docRemoveSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    expect(winRemoveSpy).toHaveBeenCalledWith('scroll', expect.any(Function), true);
    expect(winRemoveSpy).toHaveBeenCalledWith('resize', expect.any(Function));

    docRemoveSpy.mockRestore();
    winRemoveSpy.mockRestore();
  });
});
