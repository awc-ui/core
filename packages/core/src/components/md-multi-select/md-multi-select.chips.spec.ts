import { newSpecPage } from '@stencil/core/testing';
import { MdMultiSelect } from './md-multi-select';
import { MdSelectOption } from '../md-select-option/md-select-option';
import { MdChip } from '../md-chip/md-chip';

/**
 * Chip display, removal and the select-all toggle — the interaction surface
 * between the trigger and the menu. The existing specs assert that chips
 * render; none exercise removing one, the overflow chip, or what focus does
 * when the chip holding it unmounts.
 */
async function create(html: string) {
  return newSpecPage({
    components: [MdMultiSelect, MdSelectOption, MdChip],
    html,
  });
}

type Host = HTMLElement & { value: string[]; open: boolean; disabled?: boolean };

const OPTIONS = `
  <md-select-option value="a">Alpha</md-select-option>
  <md-select-option value="b">Beta</md-select-option>
  <md-select-option value="c">Gamma</md-select-option>
  <md-select-option value="d">Delta</md-select-option>
`;

const chips = (page: { root?: HTMLElement | null }) =>
  Array.from(page.root?.shadowRoot?.querySelectorAll('md-chip') ?? []) as HTMLElement[];

const part = (page: { root?: HTMLElement | null }, name: string) =>
  page.root?.shadowRoot?.querySelector(`[part~="${name}"]`) as HTMLElement | null;

describe('md-multi-select — chips & selection', () => {
  describe('display modes', () => {
    it('renders a chip per selection by default', async () => {
      const page = await create(`<md-multi-select>${OPTIONS}</md-multi-select>`);
      // `value` is string[]: setting it as an ATTRIBUTE hands the component a
      // bare string and the first render throws on value.map.
      (page.root as Host).value = ['a', 'b'];
      await page.waitForChanges();
      expect(chips(page).length).toBeGreaterThanOrEqual(2);
    });

    it('renders no chip container when nothing is selected', async () => {
      const page = await create(`<md-multi-select display-mode="chips-inline">${OPTIONS}</md-multi-select>`);
      await page.waitForChanges();
      expect(part(page, 'chips')).toBeNull();
    });

    it('caps inline chips and shows an overflow affordance', async () => {
      const page = await create(
        `<md-multi-select display-mode="chips-inline">${OPTIONS}</md-multi-select>`,
      );
      (page.root as Host).value = ['a', 'b', 'c', 'd'];
      // How many chips fit is @State measured by a ResizeObserver, which
      // mock-doc does not implement — it stays Infinity, so the overflow branch
      // is unreachable without setting it.
      (page.rootInstance as unknown as { inlineVisibleCount: number }).inlineVisibleCount = 2;
      await page.waitForChanges();
      const overflow = part(page, 'overflow-chip');
      expect(overflow).toBeTruthy();
      // 4 selected, 2 shown → "2 more".
      expect(overflow?.getAttribute('aria-label')).toContain('2 more');
    });

    it('shows every chip and no overflow when wrapping', async () => {
      const page = await create(
        `<md-multi-select display-mode="chips-inline" chip-overflow="wrap">${OPTIONS}</md-multi-select>`,
      );
      (page.root as Host).value = ['a', 'b', 'c', 'd'];
      (page.rootInstance as unknown as { inlineVisibleCount: number }).inlineVisibleCount = 2;
      await page.waitForChanges();
      // Wrapping ignores the cap entirely — every chip shows, on as many lines
      // as it takes.
      expect(part(page, 'overflow-chip')).toBeNull();
    });

    it('groups the inline chips for assistive tech', async () => {
      const page = await create(
        `<md-multi-select label="Tags" display-mode="chips-inline">${OPTIONS}</md-multi-select>`,
      );
      (page.root as Host).value = ['a'];
      await page.waitForChanges();
      const group = part(page, 'chips');
      expect(group?.getAttribute('role')).toBe('group');
      expect(group?.getAttribute('aria-label')).toBe('Tags — selected');
    });
  });

  describe('removing a selection', () => {
    it('drops the value and announces both events', async () => {
      const page = await create(`<md-multi-select>${OPTIONS}</md-multi-select>`);
      const host = page.root as Host;
      host.value = ['a', 'b'];
      await page.waitForChanges();

      const onRemove = jest.fn();
      const onChange = jest.fn();
      host.addEventListener('mdRemove', onRemove);
      host.addEventListener('mdChange', onChange);

      const chip = chips(page)[0];
      chip.dispatchEvent(new CustomEvent('mdRemove', { bubbles: true }));
      await page.waitForChanges();

      expect(host.value).toEqual(['b']);
      expect(onRemove).toHaveBeenCalledTimes(1);
      expect((onRemove.mock.calls[0][0] as CustomEvent).detail).toBe('a');
      expect(onChange).toHaveBeenCalledTimes(1);
    });

    it('ignores a removal while disabled', async () => {
      const page = await create(`<md-multi-select disabled>${OPTIONS}</md-multi-select>`);
      const host = page.root as Host;
      host.value = ['a', 'b'];
      await page.waitForChanges();
      const onChange = jest.fn();
      host.addEventListener('mdChange', onChange);
      chips(page)[0]?.dispatchEvent(new CustomEvent('mdRemove', { bubbles: true }));
      await page.waitForChanges();
      expect(host.value).toEqual(['a', 'b']);
      expect(onChange).not.toHaveBeenCalled();
    });

    it('ignores a removal for a value that is not selected', async () => {
      const page = await create(`<md-multi-select>${OPTIONS}</md-multi-select>`);
      const host = page.root as Host;
      host.value = ['a'];
      await page.waitForChanges();
      const onChange = jest.fn();
      host.addEventListener('mdChange', onChange);
      // Remove the same chip twice — the second is a no-op.
      const chip = chips(page)[0];
      chip.dispatchEvent(new CustomEvent('mdRemove', { bubbles: true }));
      await page.waitForChanges();
      chip.dispatchEvent(new CustomEvent('mdRemove', { bubbles: true }));
      await page.waitForChanges();
      expect(onChange).toHaveBeenCalledTimes(1);
    });

    it('does not let a chip removal also toggle the menu open', async () => {
      const page = await create(`<md-multi-select>${OPTIONS}</md-multi-select>`);
      const host = page.root as Host;
      host.value = ['a'];
      await page.waitForChanges();
      chips(page)[0].dispatchEvent(new CustomEvent('mdRemove', { bubbles: true }));
      await page.waitForChanges();
      expect(host.open).toBe(false);
    });
  });

  describe('clear', () => {
    it('empties the selection and announces it once', async () => {
      const page = await create(`<md-multi-select clearable>${OPTIONS}</md-multi-select>`);
      const host = page.root as Host;
      host.value = ['a', 'b'];
      await page.waitForChanges();

      const onClear = jest.fn();
      const onChange = jest.fn();
      host.addEventListener('mdClear', onClear);
      host.addEventListener('mdChange', onChange);

      part(page, 'clear')?.click();
      await page.waitForChanges();

      expect(host.value).toEqual([]);
      expect(onClear).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledTimes(1);
    });

    it('stays silent when there is nothing to clear', async () => {
      const page = await create(`<md-multi-select clearable>${OPTIONS}</md-multi-select>`);
      const host = page.root as Host;
      const onClear = jest.fn();
      host.addEventListener('mdClear', onClear);
      // The affordance is not even rendered with an empty value.
      expect(part(page, 'clear')).toBeNull();
      expect(onClear).not.toHaveBeenCalled();
    });

    it('does not clear while disabled', async () => {
      const page = await create(`<md-multi-select clearable disabled>${OPTIONS}</md-multi-select>`);
      const host = page.root as Host;
      host.value = ['a'];
      await page.waitForChanges();
      part(page, 'clear')?.click();
      await page.waitForChanges();
      expect(host.value).toEqual(['a']);
    });
  });

  describe('select all', () => {
    // Rendering of the header toggle itself is already covered in
    // md-multi-select.spec.ts; only the disabled guard is new here.
    it('does nothing while disabled', async () => {
      const page = await create(
        `<md-multi-select show-select-all open disabled>${OPTIONS}</md-multi-select>`,
      );
      await page.waitForChanges();
      const inst = page.rootInstance as unknown as {
        toggleSelectAll: (e?: unknown) => void;
        value: string[];
      };
      inst.toggleSelectAll();
      await page.waitForChanges();
      expect(inst.value).toEqual([]);
    });
  });

  describe('loading', () => {
    it('replaces the clear/caret cluster with a spinner', async () => {
      const page = await create(`<md-multi-select loading clearable>${OPTIONS}</md-multi-select>`);
      (page.root as Host).value = ['a'];
      await page.waitForChanges();
      expect(part(page, 'loading-spinner')).toBeTruthy();
      expect(part(page, 'caret')).toBeNull();
      expect(part(page, 'clear')).toBeNull();
    });
  });
});
