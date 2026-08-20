import { newSpecPage } from '@stencil/core/testing';
import { MdSelect } from './md-select';
import { MdSelectOption } from '../md-select-option/md-select-option';
import { MdMenu } from '../md-menu/md-menu';
import { MdMenuItem } from '../md-menu-item/md-menu-item';
import { MdTextField } from '../md-text-field/md-text-field';

const COMPONENTS = [MdSelect, MdSelectOption, MdMenu, MdMenuItem, MdTextField];

/** Query the rendered menu-item rows the select projects into its md-menu. */
function menuItems(root: HTMLElement | null | undefined) {
  return Array.from(root?.shadowRoot?.querySelectorAll('md-menu-item') ?? []);
}
function field(root: HTMLElement | null | undefined) {
  return root?.shadowRoot?.querySelector('md-text-field') as
    | (HTMLElement & { value: string; appearFocused: boolean })
    | null;
}

describe('md-select', () => {
  it('renders and reflects host classes', async () => {
    const page = await newSpecPage({
      components: COMPONENTS,
      html: `<md-select label="Colour"></md-select>`,
    });
    expect(page.root).toBeTruthy();
    expect(page.root).toHaveClass('md-select');
    expect(page.root?.getAttribute('aria-haspopup')).toBe('listbox');
  });

  it('projects slotted options into md-menu-item rows', async () => {
    const page = await newSpecPage({
      components: COMPONENTS,
      html: `<md-select label="Colour">
        <md-select-option value="red">Red</md-select-option>
        <md-select-option value="green">Green</md-select-option>
        <md-select-option value="blue">Blue</md-select-option>
      </md-select>`,
    });
    const items = menuItems(page.root);
    expect(items).toHaveLength(3);
    // headline/type are non-reflected props — read them off the upgraded element.
    expect(items.map((i) => (i as unknown as { headline: string }).headline))
      .toEqual(['Red', 'Green', 'Blue']);
    expect(items.every((i) => (i as unknown as { type: string }).type === 'radio')).toBe(true);
  });

  it('applies per-option icon-color as an inline style on the leading icon', async () => {
    const page = await newSpecPage({
      components: COMPONENTS,
      html: `<md-select label="Colour">
        <md-select-option value="red" icon="circle" icon-color="#E53935">Red</md-select-option>
        <md-select-option value="green" icon="circle">Green</md-select-option>
      </md-select>`,
    });
    const icons = Array.from(
      page.root?.shadowRoot?.querySelectorAll('.md-select__option-icon') ?? [],
    ) as HTMLElement[];
    expect(icons).toHaveLength(2);
    // Inline colour wins over the --md-select-option-icon-color token / ::part rule.
    expect(icons[0].style.color).toBeTruthy();
    expect((icons[0].getAttribute('style') || '').toLowerCase()).toContain('#e53935');
    // No icon-color → no inline style override (falls back to the token).
    expect(icons[1].style.color).toBeFalsy();
  });

  it('exposes the dropdown as a WAI-ARIA listbox of options (not a menu)', async () => {
    const page = await newSpecPage({
      components: COMPONENTS,
      html: `<md-select label="Colour" value="green">
        <md-select-option value="red">Red</md-select-option>
        <md-select-option value="green">Green</md-select-option>
      </md-select>`,
    });
    const root = page.root?.shadowRoot;
    // The listbox container in the select's shadow root.
    const listbox = root?.querySelector('.md-select__listbox');
    expect(listbox?.getAttribute('role')).toBe('listbox');
    expect(listbox?.getAttribute('aria-label')).toBeTruthy();
    // Options use role="option" + aria-selected, not menuitemradio/aria-checked.
    const items = menuItems(page.root);
    expect(items.every((i) => i.getAttribute('role') === 'option')).toBe(true);
    expect(items.every((i) => i.hasAttribute('aria-selected'))).toBe(true);
    expect(items.some((i) => i.hasAttribute('aria-checked'))).toBe(false);
    const green = items.find((i) => i.id?.endsWith('-opt-green'));
    expect(green?.getAttribute('aria-selected')).toBe('true');
  });

  it('falls back to the options array when no slotted children exist', async () => {
    const page = await newSpecPage({
      components: COMPONENTS,
      html: `<md-select label="Country"></md-select>`,
    });
    (page.root as unknown as { options: unknown }).options = [
      { value: 'us', label: 'United States' },
      { value: 'gb', label: 'United Kingdom', disabled: true },
    ];
    await page.waitForChanges();
    const items = menuItems(page.root);
    expect(items.map((i) => (i as unknown as { headline: string }).headline)).toEqual([
      'United States',
      'United Kingdom',
    ]);
    expect(items[1].hasAttribute('disabled')).toBe(true);
  });

  it('marks the matching option selected and shows its label in the field', async () => {
    const page = await newSpecPage({
      components: COMPONENTS,
      html: `<md-select label="Colour" value="green">
        <md-select-option value="red">Red</md-select-option>
        <md-select-option value="green">Green</md-select-option>
      </md-select>`,
    });
    const items = menuItems(page.root);
    expect(items[0].hasAttribute('selected')).toBe(false);
    expect(items[1].hasAttribute('selected')).toBe(true);
    expect(field(page.root)?.value).toBe('Green');
  });

  it('adopts a preselected option when no value is set', async () => {
    const page = await newSpecPage({
      components: COMPONENTS,
      html: `<md-select label="Colour">
        <md-select-option value="red">Red</md-select-option>
        <md-select-option value="green" selected>Green</md-select-option>
      </md-select>`,
    });
    expect((page.root as unknown as { value: string }).value).toBe('green');
  });

  it('selecting an option updates value, emits mdChange, and closes', async () => {
    const page = await newSpecPage({
      components: COMPONENTS,
      html: `<md-select label="Colour" open>
        <md-select-option value="red">Red</md-select-option>
        <md-select-option value="green">Green</md-select-option>
      </md-select>`,
    });
    const spy = jest.fn();
    page.root?.addEventListener('mdChange', spy);

    const items = menuItems(page.root);
    items[1].dispatchEvent(new CustomEvent('mdClick', { bubbles: true }));
    await page.waitForChanges();

    expect((page.root as unknown as { value: string }).value).toBe('green');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0].detail).toBe('green');
    expect((page.root as unknown as { open: boolean }).open).toBe(false);
  });

  it('keeps the field appear-focused while open', async () => {
    const page = await newSpecPage({
      components: COMPONENTS,
      html: `<md-select label="Colour" open>
        <md-select-option value="red">Red</md-select-option>
      </md-select>`,
    });
    expect(field(page.root)?.appearFocused).toBe(true);
  });

  it('renders a clear button only when clearable + value, and reset() clears', async () => {
    const page = await newSpecPage({
      components: COMPONENTS,
      html: `<md-select label="Colour" clearable value="red">
        <md-select-option value="red">Red</md-select-option>
      </md-select>`,
    });
    expect(page.root?.shadowRoot?.querySelector('.md-select__clear')).toBeTruthy();

    const spy = jest.fn();
    page.root?.addEventListener('mdChange', spy);
    await (page.root as unknown as { reset: () => Promise<void> }).reset();
    await page.waitForChanges();
    expect((page.root as unknown as { value: string }).value).toBe('');
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ detail: '' }));
    expect(page.root?.shadowRoot?.querySelector('.md-select__clear')).toBeNull();
  });

  // Form participation is form-associated (ElementInternals.setFormValue),
  // not a shadow-DOM hidden input — a hidden input in the shadow root is
  // invisible to FormData. Real submission is covered by the e2e suite;
  // here we assert the contract: name reflects to the host and no hidden
  // input is rendered.
  it('reflects name to the host and renders no hidden input', async () => {
    const page = await newSpecPage({
      components: COMPONENTS,
      html: `<md-select name="colour" value="red">
        <md-select-option value="red">Red</md-select-option>
      </md-select>`,
    });
    expect(page.root?.getAttribute('name')).toBe('colour');
    expect(
      page.root?.shadowRoot?.querySelector('input[type="hidden"]'),
    ).toBeNull();
  });

  it('re-reads options when an option is added later', async () => {
    const page = await newSpecPage({
      components: COMPONENTS,
      html: `<md-select label="Colour">
        <md-select-option value="red">Red</md-select-option>
      </md-select>`,
    });
    expect(menuItems(page.root)).toHaveLength(1);

    const opt = page.doc.createElement('md-select-option');
    opt.setAttribute('value', 'green');
    opt.textContent = 'Green';
    page.root?.appendChild(opt);
    await page.waitForChanges();

    expect(menuItems(page.root)).toHaveLength(2);
  });

  it('forwards match-trigger-width to the inner md-menu', async () => {
    const page = await newSpecPage({
      components: COMPONENTS,
      html: `<md-select label="Colour">
        <md-select-option value="red">Red</md-select-option>
      </md-select>`,
    });
    // Default true → menu matches anchor width.
    let menu = page.root?.shadowRoot?.querySelector('md-menu') as
      | (HTMLElement & { matchAnchorWidth: boolean })
      | null;
    expect(menu?.matchAnchorWidth).toBe(true);

    (page.root as unknown as { matchTriggerWidth: boolean }).matchTriggerWidth = false;
    await page.waitForChanges();
    menu = page.root?.shadowRoot?.querySelector('md-menu') as
      | (HTMLElement & { matchAnchorWidth: boolean })
      | null;
    expect(menu?.matchAnchorWidth).toBe(false);
  });

  describe('filterable (markup-authored options)', () => {
    const create = () =>
      newSpecPage({
        components: COMPONENTS,
        html: `<md-select label="Country" filterable>
          <md-select-option value="fr">France</md-select-option>
          <md-select-option value="de">Germany</md-select-option>
          <md-select-option value="es">Spain</md-select-option>
        </md-select>`,
      });
    const search = (page: Awaited<ReturnType<typeof create>>) =>
      page.root?.shadowRoot?.querySelector('.md-select__search') as HTMLInputElement | null;
    const type = async (page: Awaited<ReturnType<typeof create>>, q: string) => {
      const input = search(page)!;
      input.value = q;
      input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      await page.waitForChanges();
    };
    // Stencil hands `headline` to md-menu-item as a property, not an attribute.
    const labels = (page: Awaited<ReturnType<typeof create>>) =>
      menuItems(page.root)
        .filter((i) => i.getAttribute('presentation') === 'option')
        .map((i) => (i as HTMLElement & { headline?: string }).headline);

    it('renders the search field without virtualization', async () => {
      const page = await create();
      // The field used to be gated on the virtual controller being active, so a
      // markup-authored `filterable` select had no way to filter at all.
      expect(search(page)).toBeTruthy();
    });

    it('narrows the options as you type', async () => {
      const page = await create();
      await type(page, 'ger');
      expect(labels(page)).toEqual(['Germany']);
    });

    it('matches supporting text too, case-insensitively', async () => {
      const page = await newSpecPage({
        components: COMPONENTS,
        html: `<md-select label="Country" filterable>
          <md-select-option value="fr" supporting-text="Paris">France</md-select-option>
          <md-select-option value="de" supporting-text="Berlin">Germany</md-select-option>
        </md-select>`,
      });
      const input = page.root?.shadowRoot?.querySelector('.md-select__search') as HTMLInputElement;
      input.value = 'BERL';
      input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      await page.waitForChanges();
      expect(
        menuItems(page.root)
          .filter((i) => i.getAttribute('presentation') === 'option')
          .map((i) => (i as HTMLElement & { headline?: string }).headline),
      ).toEqual(['Germany']);
    });

    it('shows the no-results text when nothing matches', async () => {
      const page = await create();
      await type(page, 'zzz');
      expect(labels(page)).toEqual([]);
      const menu = page.root?.shadowRoot?.querySelector('md-menu');
      expect(menu?.getAttribute('empty-text')).toBe('No results');
    });

    it('setQuery filters and fills the search field', async () => {
      const page = await create();
      await (page.root as unknown as { setQuery: (q: string) => Promise<void> }).setQuery('spa');
      await page.waitForChanges();
      expect(labels(page)).toEqual(['Spain']);
      expect(search(page)?.value).toBe('spa');
    });

    it('clears the query when the menu closes', async () => {
      const page = await create();
      await type(page, 'ger');
      expect(labels(page)).toEqual(['Germany']);
      page.root?.shadowRoot
        ?.querySelector('md-menu')
        ?.dispatchEvent(new CustomEvent('mdClose', { bubbles: true }));
      await page.waitForChanges();
      expect(labels(page)).toEqual(['France', 'Germany', 'Spain']);
    });
  });

  it('applies disabled host class', async () => {
    const page = await newSpecPage({
      components: COMPONENTS,
      html: `<md-select label="Colour" disabled></md-select>`,
    });
    expect(page.root).toHaveClass('md-select--disabled');
  });
});
