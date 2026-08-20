import { newSpecPage, SpecPage } from '@stencil/core/testing';
import { MdAppBar } from './md-app-bar';

/**
 * The `search` variant and the slot-presence detection that drives the other
 * variants' layout — the two halves of this component the existing spec does
 * not reach.
 */
async function create(attrs = '', slots = '') {
  const page = await newSpecPage({
    components: [MdAppBar],
    html: `<md-app-bar ${attrs}>${slots}</md-app-bar>`,
  });
  await page.waitForChanges();
  return page;
}

type Bar = HTMLElement & { searchValue: string; searchDisabled: boolean };
const el = (page: SpecPage) => page.root as Bar;
const input = (page: SpecPage) =>
  page.root!.shadowRoot!.querySelector('input') as HTMLInputElement | null;
const part = (page: SpecPage, name: string) =>
  page.root!.shadowRoot!.querySelector(`[part~="${name}"]`);

describe('md-app-bar — search variant', () => {
  describe('rendering', () => {
    it('renders a search field only for the search variant', async () => {
      const search = await create('variant="search"');
      expect(input(search)).toBeTruthy();

      const small = await create('variant="small" headline="Title"');
      expect(input(small)).toBeNull();
    });

    it('carries the placeholder and accessible name', async () => {
      const page = await create(
        'variant="search" search-placeholder="Find anything" search-aria-label="Search the app"',
      );
      expect(input(page)?.getAttribute('placeholder')).toBe('Find anything');
      expect(input(page)?.getAttribute('aria-label')).toBe('Search the app');
    });

    it('reflects the current value', async () => {
      const page = await create('variant="search" search-value="hello"');
      expect(input(page)?.value).toBe('hello');
    });

    it('marks the field disabled', async () => {
      const page = await create('variant="search" search-disabled');
      expect(input(page)?.hasAttribute('disabled')).toBe(true);
    });
  });

  describe('typing', () => {
    it('reports each change and keeps the value in step', async () => {
      const page = await create('variant="search"');
      const onInput = jest.fn();
      page.root!.addEventListener('mdSearchInput', onInput);

      const field = input(page)!;
      field.value = 'abc';
      field.dispatchEvent(new Event('input', { bubbles: true }));
      await page.waitForChanges();

      expect(el(page).searchValue).toBe('abc');
      expect((onInput.mock.calls[0][0] as CustomEvent).detail).toEqual({ value: 'abc' });
    });

    it('reports an empty value when the field is cleared', async () => {
      const page = await create('variant="search" search-value="abc"');
      const onInput = jest.fn();
      page.root!.addEventListener('mdSearchInput', onInput);

      const field = input(page)!;
      field.value = '';
      field.dispatchEvent(new Event('input', { bubbles: true }));
      await page.waitForChanges();

      expect(el(page).searchValue).toBe('');
      expect((onInput.mock.calls[0][0] as CustomEvent).detail).toEqual({ value: '' });
    });
  });

  describe('activation', () => {
    it('announces on focus', async () => {
      const page = await create('variant="search"');
      const onActivate = jest.fn();
      page.root!.addEventListener('mdSearchActivate', onActivate);
      input(page)!.dispatchEvent(new Event('focus', { bubbles: true }));
      await page.waitForChanges();
      expect(onActivate).toHaveBeenCalled();
    });

    it('announces on Enter and Space', async () => {
      for (const key of ['Enter', ' ']) {
        const page = await create('variant="search"');
        const onActivate = jest.fn();
        page.root!.addEventListener('mdSearchActivate', onActivate);
        const ev = new KeyboardEvent('keydown', { key, bubbles: true });
        input(page)!.dispatchEvent(ev);
        await page.waitForChanges();
        expect(onActivate).toHaveBeenCalled();
        // Space would otherwise scroll the page.
        expect(ev.defaultPrevented).toBe(true);
      }
    });

    it('leaves other keys alone', async () => {
      const page = await create('variant="search"');
      const onActivate = jest.fn();
      page.root!.addEventListener('mdSearchActivate', onActivate);
      const ev = new KeyboardEvent('keydown', { key: 'a', bubbles: true });
      input(page)!.dispatchEvent(ev);
      await page.waitForChanges();
      expect(onActivate).not.toHaveBeenCalled();
      expect(ev.defaultPrevented).toBe(false);
    });

    it('stays silent while disabled', async () => {
      const page = await create('variant="search" search-disabled');
      const onActivate = jest.fn();
      page.root!.addEventListener('mdSearchActivate', onActivate);
      input(page)!.dispatchEvent(new Event('focus', { bubbles: true }));
      input(page)!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await page.waitForChanges();
      expect(onActivate).not.toHaveBeenCalled();
    });
  });

  describe('slot detection', () => {
    it('notices slotted leading content', async () => {
      const page = await create('variant="small" headline="T"', '<button slot="leading">Back</button>');
      const inst = page.rootInstance as unknown as { hasSlottedLeading: boolean };
      expect(inst.hasSlottedLeading).toBe(true);
    });

    it('notices a slotted headline', async () => {
      const page = await create('variant="small"', '<span slot="headline">Custom</span>');
      const inst = page.rootInstance as unknown as { hasSlottedHeadline: boolean };
      expect(inst.hasSlottedHeadline).toBe(true);
    });

    it('reports nothing slotted for a bare bar', async () => {
      const page = await create('variant="small" headline="T"');
      const inst = page.rootInstance as unknown as {
        hasSlottedLeading: boolean;
        hasSlottedHeadline: boolean;
        hasSlottedSubtitle: boolean;
      };
      expect(inst.hasSlottedLeading).toBe(false);
      expect(inst.hasSlottedHeadline).toBe(false);
      expect(inst.hasSlottedSubtitle).toBe(false);
    });

    it('renders the title from the headline prop when nothing is slotted', async () => {
      const page = await create('variant="small" headline="Inbox"');
      expect(part(page, 'title')?.textContent).toContain('Inbox');
    });

    it('shows a subtitle only when there is one', async () => {
      const withSub = await create('variant="medium" headline="T" subtitle="Sub"');
      expect(withSub.root!.shadowRoot!.textContent).toContain('Sub');

      const without = await create('variant="medium" headline="T"');
      expect(without.root!.shadowRoot!.querySelector('[part~="subtitle"]')).toBeNull();
    });
  });
});
