import { newSpecPage } from '@stencil/core/testing';
import { MdMultiSelect } from './md-multi-select';
import { MdSelectOption } from '../md-select-option/md-select-option';

async function create(html: string) {
  return newSpecPage({ components: [MdMultiSelect], html });
}

describe('md-multi-select', () => {
  describe('rendering', () => {
    it('renders host with default classes', async () => {
      const page = await create('<md-multi-select label="Tags"></md-multi-select>');
      expect(page.root).toBeTruthy();
      expect(page.root).toHaveClass('md-multi-select');
      expect(page.root).toHaveClass('md-multi-select--outlined');
      expect(page.root).toHaveClass('md-multi-select--display-chips');
    });

    it('reflects variant', async () => {
      const page = await create('<md-multi-select variant="outlined"></md-multi-select>');
      expect(page.root).toHaveClass('md-multi-select--outlined');
      expect(page.root?.getAttribute('variant')).toBe('outlined');
    });

    it('renders the inner trigger field', async () => {
      const page = await create('<md-multi-select label="X"></md-multi-select>');
      const field = page.root?.shadowRoot?.querySelector('md-text-field');
      expect(field).toBeTruthy();
      expect(field?.getAttribute('label')).toBe('X');
    });

    it('renders the inner menu anchored to the trigger', async () => {
      const page = await create('<md-multi-select></md-multi-select>');
      const field = page.root?.shadowRoot?.querySelector('md-text-field');
      const menu = page.root?.shadowRoot?.querySelector('md-menu');
      expect(menu?.getAttribute('anchor')).toBe(field?.getAttribute('id'));
    });

    it('exposes parts', async () => {
      const page = await create('<md-multi-select></md-multi-select>');
      const shadow = page.root?.shadowRoot;
      expect(shadow?.querySelector('[part="field"]')).toBeTruthy();
      expect(shadow?.querySelector('[part="caret"]')).toBeTruthy();
      expect(shadow?.querySelector('[part="menu"]')).toBeTruthy();
    });
  });

  describe('options + selection', () => {
    it('renders one md-menu-item per option', async () => {
      const page = await create('<md-multi-select></md-multi-select>');
      (page.root as unknown as { options: unknown[] }).options = [
        { value: 'a', label: 'Alpha' },
        { value: 'b', label: 'Beta' },
        { value: 'c', label: 'Gamma' },
      ];
      await page.waitForChanges();
      const items = page.root?.shadowRoot?.querySelectorAll('md-menu-item');
      expect(items?.length).toBe(3);
    });

    it('applies per-option iconColor as an inline style on the leading icon', async () => {
      const page = await create('<md-multi-select></md-multi-select>');
      (page.root as unknown as { options: unknown[] }).options = [
        { value: 'red', label: 'Red', icon: 'circle', iconColor: '#E53935' },
        { value: 'green', label: 'Green', icon: 'circle' },
      ];
      await page.waitForChanges();
      const icons = Array.from(
        page.root?.shadowRoot?.querySelectorAll('.md-multi-select__option-icon') ?? [],
      ) as HTMLElement[];
      expect(icons).toHaveLength(2);
      expect(icons[0].style.color).toBeTruthy();
      expect((icons[0].getAttribute('style') || '').toLowerCase()).toContain('#e53935');
      expect(icons[1].style.color).toBeFalsy();
    });

    it('marks options as selected based on `value` array', async () => {
      const page = await create('<md-multi-select></md-multi-select>');
      const root = page.root as unknown as { options: unknown[]; value: string[] };
      root.options = [
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B' },
      ];
      root.value = ['b'];
      await page.waitForChanges();
      const items = page.root?.shadowRoot?.querySelectorAll('md-menu-item');
      expect(items?.[0].hasAttribute('selected')).toBe(false);
      expect(items?.[1].hasAttribute('selected')).toBe(true);
    });

    it('renders chips for selected options in chips mode', async () => {
      const page = await create('<md-multi-select></md-multi-select>');
      const root = page.root as unknown as { options: unknown[]; value: string[] };
      root.options = [{ value: 'a', label: 'Alpha' }];
      root.value = ['a'];
      await page.waitForChanges();
      const chips = page.root?.shadowRoot?.querySelectorAll('md-chip');
      expect(chips?.length).toBe(1);
      expect(chips?.[0].getAttribute('label')).toBe('Alpha');
    });

    it('renders count text in count mode', async () => {
      const page = await create('<md-multi-select display-mode="count"></md-multi-select>');
      const root = page.root as unknown as { options: unknown[]; value: string[] };
      root.options = [
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B' },
      ];
      root.value = ['a', 'b'];
      await page.waitForChanges();
      const field = page.root?.shadowRoot?.querySelector('md-text-field');
      expect(field?.getAttribute('value')).toBe('2 selected');
    });

    it('honours max-selected', async () => {
      const page = await create('<md-multi-select max-selected="2"></md-multi-select>');
      const root = page.root as unknown as {
        options: unknown[];
        value: string[];
      };
      root.options = [
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B' },
        { value: 'c', label: 'C' },
      ];
      root.value = ['a', 'b'];
      await page.waitForChanges();
      const spy = jest.fn();
      page.root?.addEventListener('mdChange', spy);
      const items = page.root?.shadowRoot?.querySelectorAll('md-menu-item') as
        unknown as NodeListOf<HTMLElement>;
      items[2].dispatchEvent(new CustomEvent('mdClick'));
      await page.waitForChanges();
      expect((page.root as unknown as { value: string[] }).value).toEqual(['a', 'b']);
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('slotted options', () => {
    it('projects slotted <md-select-option> children into menu items', async () => {
      const page = await newSpecPage({
        components: [MdMultiSelect, MdSelectOption],
        html: `<md-multi-select label="Topics">
          <md-select-option value="a">Alpha</md-select-option>
          <md-select-option value="b">Beta</md-select-option>
        </md-multi-select>`,
      });
      const items = page.root?.shadowRoot?.querySelectorAll('md-menu-item');
      expect(items?.length).toBe(2);
    });

    it('adopts preselected slotted options when value is empty', async () => {
      const page = await newSpecPage({
        components: [MdMultiSelect, MdSelectOption],
        html: `<md-multi-select label="Topics">
          <md-select-option value="a" selected>Alpha</md-select-option>
          <md-select-option value="b">Beta</md-select-option>
          <md-select-option value="c" selected>Gamma</md-select-option>
        </md-multi-select>`,
      });
      expect((page.root as unknown as { value: string[] }).value).toEqual(['a', 'c']);
    });
  });

  describe('events', () => {
    it('emits mdChange when an option is toggled', async () => {
      const page = await create('<md-multi-select></md-multi-select>');
      const root = page.root as unknown as { options: unknown[]; value: string[] };
      root.options = [{ value: 'a', label: 'A' }];
      await page.waitForChanges();
      const spy = jest.fn();
      page.root?.addEventListener('mdChange', spy);
      const item = page.root?.shadowRoot?.querySelector('md-menu-item') as HTMLElement;
      item.dispatchEvent(new CustomEvent('mdClick'));
      await page.waitForChanges();
      expect(spy).toHaveBeenCalledWith(expect.objectContaining({ detail: ['a'] }));
    });
  });

  describe('accessibility', () => {
    it('exposes aria-haspopup on the host but NOT aria-expanded', async () => {
      const page = await create('<md-multi-select></md-multi-select>');
      expect(page.root?.getAttribute('aria-haspopup')).toBe('listbox');
      // The host has no role, so aria-expanded there is ignored by AT (and axe
      // flags it). The expanded state lives on the real trigger controls: the
      // button trigger (role=button) and the filterable search (role=combobox).
      expect(page.root?.getAttribute('aria-expanded')).toBeNull();
    });

    it('the button trigger flips its aria-expanded when open changes', async () => {
      const page = await create('<md-multi-select trigger="button"></md-multi-select>');
      const btn = () => page.root?.shadowRoot?.querySelector('md-button');
      expect(btn()?.getAttribute('aria-expanded')).toBe('false');
      (page.root as unknown as { open: boolean }).open = true;
      await page.waitForChanges();
      expect(btn()?.getAttribute('aria-expanded')).toBe('true');
    });
  });

  describe('slotted trigger', () => {
    const withTrigger = (attrs = '') =>
      create(
        `<md-multi-select ${attrs}><button slot="trigger" id="">Add tags</button></md-multi-select>`,
      );

    it('replaces the built-in field entirely', async () => {
      const page = await withTrigger();
      const shadow = page.root?.shadowRoot;
      expect(shadow?.querySelector('md-text-field')).toBeNull();
      expect(shadow?.querySelector('md-button')).toBeNull();
      expect(shadow?.querySelector('slot[name="trigger"]')).toBeTruthy();
    });

    it('keeps the built-in trigger when nothing is slotted', async () => {
      const page = await create('<md-multi-select></md-multi-select>');
      expect(page.root?.shadowRoot?.querySelector('md-text-field')).toBeTruthy();
    });

    it('stamps the anchor id and advertises the popup on the consumer element', async () => {
      const page = await withTrigger();
      const trigger = page.root?.querySelector('[slot="trigger"]') as HTMLElement;
      const menu = page.root?.shadowRoot?.querySelector('md-menu');
      expect(trigger.id).toBeTruthy();
      expect(menu?.getAttribute('anchor')).toBe(trigger.id);
      expect(trigger.getAttribute('aria-haspopup')).toBe('listbox');
      // No aria-controls: the listbox is in this shadow root and the trigger is
      // not, so the IDREF could never resolve.
      expect(trigger.getAttribute('aria-controls')).toBeNull();
    });

    it('opens on a click of the consumer element', async () => {
      const page = await withTrigger();
      const trigger = page.root?.querySelector('[slot="trigger"]') as HTMLElement;
      trigger.click();
      await page.waitForChanges();
      expect((page.root as unknown as { open: boolean }).open).toBe(true);
    });

    it('shows chips beside it without display-mode="chips" being set', async () => {
      const page = await withTrigger('chip-position="right"');
      (page.root as unknown as { options: unknown[] }).options = [
        { value: 'a', label: 'Alpha' },
      ];
      (page.root as unknown as { value: string[] }).value = ['a'];
      await page.waitForChanges();
      expect(page.root).toHaveClass('md-multi-select--slotted-trigger');
      expect(page.root).toHaveClass('md-multi-select--chips-right');
      expect(page.root?.shadowRoot?.querySelector('[part="chips"]')).toBeTruthy();
    });
  });

  describe('select all', () => {
    async function withOptions(attrs = '') {
      const page = await create(`<md-multi-select show-select-all ${attrs}></md-multi-select>`);
      (page.root as unknown as { options: unknown[] }).options = [
        { value: 'a', label: 'Alpha' },
        { value: 'b', label: 'Beta' },
        { value: 'c', label: 'Gamma' },
      ];
      await page.waitForChanges();
      return page;
    }

    it('renders a pinned role=checkbox toggle (not a heavy md-checkbox) in the header', async () => {
      const page = await withOptions();
      const group = page.root?.shadowRoot?.querySelector('[part="select-all"]');
      expect(group?.getAttribute('slot')).toBe('header');
      const item = group?.querySelector('md-menu-item');
      expect(item).toBeTruthy();
      expect(item?.getAttribute('type')).toBe('checkbox');
      expect(item?.getAttribute('check-position')).toBe('start');
      // role="checkbox" (a bulk toggle, not a menu item) via role-override
      expect(item?.getAttribute('role-override')).toBe('checkbox');
      // no heavy checkbox square anymore
      expect(group?.querySelector('md-checkbox')).toBeNull();
    });

    it('is absent without show-select-all', async () => {
      const page = await create('<md-multi-select></md-multi-select>');
      (page.root as unknown as { options: unknown[] }).options = [{ value: 'a', label: 'Alpha' }];
      await page.waitForChanges();
      expect(page.root?.shadowRoot?.querySelector('[part="select-all"]')).toBeNull();
    });

    it('toggleSelectAll selects every eligible value, then clears', async () => {
      const page = await withOptions();
      const inst = page.rootInstance as unknown as { toggleSelectAll: (e?: unknown) => void; value: string[] };
      inst.toggleSelectAll();
      await page.waitForChanges();
      expect(inst.value).toEqual(['a', 'b', 'c']);
      inst.toggleSelectAll();
      await page.waitForChanges();
      expect(inst.value).toEqual([]);
    });
  });

  describe('RTL', () => {
    it('renders inside an RTL container', async () => {
      const page = await newSpecPage({
        components: [MdMultiSelect],
        html: `<div dir="rtl"><md-multi-select></md-multi-select></div>`,
      });
      expect(page.root).toBeTruthy();
    });
  });

  // Form participation is form-associated (ElementInternals.setFormValue
  // with a FormData payload of repeated name=value pairs), not shadow-DOM
  // hidden inputs (which FormData can't see). Real submission is covered by
  // the e2e suite; here we assert the contract: name reflects to the host
  // and no hidden inputs are rendered.
  describe('form participation', () => {
    it('reflects name to the host and renders no hidden inputs', async () => {
      const page = await create('<md-multi-select name="topics"></md-multi-select>');
      const root = page.root as unknown as { options: unknown[]; value: string[] };
      root.options = [
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B' },
      ];
      root.value = ['a', 'b'];
      await page.waitForChanges();
      expect(page.root?.getAttribute('name')).toBe('topics');
      expect(page.root?.shadowRoot?.querySelectorAll('input[type="hidden"]').length).toBe(0);
    });
  });
});
