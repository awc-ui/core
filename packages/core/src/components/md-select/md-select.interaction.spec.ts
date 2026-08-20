import { newSpecPage, SpecPage } from '@stencil/core/testing';
import { MdSelect } from './md-select';
import { MdSelectOption } from '../md-select-option/md-select-option';
import { MdTextField } from '../md-text-field/md-text-field';
import { MdMenu } from '../md-menu/md-menu';
import { MdMenuItem } from '../md-menu-item/md-menu-item';

/**
 * The interaction layer: opening from the keyboard, choosing a value, and
 * clearing. The existing specs cover rendering and the public methods; nothing
 * drove the trigger the way a user does.
 */
async function create(html: string) {
  const page = await newSpecPage({
    components: [MdSelect, MdSelectOption, MdTextField, MdMenu, MdMenuItem],
    html,
  });
  await page.waitForChanges();
  return page;
}

type Select = HTMLElement & { open: boolean; value: string; disabled: boolean };

const OPTIONS = `
  <md-select-option value="a">Alpha</md-select-option>
  <md-select-option value="b">Beta</md-select-option>
  <md-select-option value="c">Gamma</md-select-option>
`;

const key = (page: SpecPage, k: string) => {
  const ev = new KeyboardEvent('keydown', { key: k, bubbles: true });
  page.root!.dispatchEvent(ev);
  return ev;
};

const el = (page: SpecPage) => page.root as Select;
const items = (page: SpecPage) =>
  Array.from(page.root!.shadowRoot!.querySelectorAll('md-menu-item')) as HTMLElement[];

describe('md-select — interaction', () => {
  describe('opening from the keyboard', () => {
    it.each(['ArrowDown', 'Enter', ' '])('opens on %s', async (k) => {
      const page = await create(`<md-select>${OPTIONS}</md-select>`);
      const ev = key(page, k);
      await page.waitForChanges();
      expect(el(page).open).toBe(true);
      // Otherwise Space scrolls the page and Enter submits the surrounding form.
      expect(ev.defaultPrevented).toBe(true);
    });

    it('closes on Escape', async () => {
      const page = await create(`<md-select>${OPTIONS}</md-select>`);
      el(page).open = true;
      await page.waitForChanges();
      key(page, 'Escape');
      await page.waitForChanges();
      expect(el(page).open).toBe(false);
    });

    it('ignores Escape while already closed', async () => {
      const page = await create(`<md-select>${OPTIONS}</md-select>`);
      const ev = key(page, 'Escape');
      await page.waitForChanges();
      expect(el(page).open).toBe(false);
      expect(ev.defaultPrevented).toBe(false);
    });

    it('stays shut while disabled', async () => {
      const page = await create(`<md-select disabled>${OPTIONS}</md-select>`);
      key(page, 'ArrowDown');
      await page.waitForChanges();
      expect(el(page).open).toBe(false);
    });

    it('leaves other keys alone', async () => {
      const page = await create(`<md-select>${OPTIONS}</md-select>`);
      const ev = key(page, 'x');
      await page.waitForChanges();
      expect(el(page).open).toBe(false);
      expect(ev.defaultPrevented).toBe(false);
    });
  });

  describe('choosing a value', () => {
    it('takes the clicked option and closes', async () => {
      const page = await create(`<md-select>${OPTIONS}</md-select>`);
      el(page).open = true;
      await page.waitForChanges();
      const onChange = jest.fn();
      page.root!.addEventListener('mdChange', onChange);

      items(page)[1].click();
      await page.waitForChanges();

      expect(el(page).value).toBe('b');
      expect(el(page).open).toBe(false);
      expect(onChange).toHaveBeenCalledTimes(1);
    });

    it('closes without re-announcing when the same option is picked again', async () => {
      const page = await create(`<md-select value="b">${OPTIONS}</md-select>`);
      el(page).open = true;
      await page.waitForChanges();
      const onChange = jest.fn();
      page.root!.addEventListener('mdChange', onChange);

      items(page)[1].click();
      await page.waitForChanges();

      expect(el(page).open).toBe(false);
      // Re-picking the current value is a dismissal, not a change.
      expect(onChange).not.toHaveBeenCalled();
    });

    it('ignores a disabled option', async () => {
      const page = await create(`<md-select>
        <md-select-option value="a">Alpha</md-select-option>
        <md-select-option value="b" disabled>Beta</md-select-option>
      </md-select>`);
      el(page).open = true;
      await page.waitForChanges();
      items(page)[1].click();
      await page.waitForChanges();
      expect(el(page).value).not.toBe('b');
    });
  });

  describe('clearing', () => {
    it('empties the value and announces it', async () => {
      const page = await create(`<md-select clearable value="a">${OPTIONS}</md-select>`);
      const onChange = jest.fn();
      page.root!.addEventListener('mdChange', onChange);
      const clear = page.root!.shadowRoot!.querySelector('[part~="clear"]') as HTMLElement;
      clear.click();
      await page.waitForChanges();
      expect(el(page).value).toBe('');
      expect(onChange).toHaveBeenCalledTimes(1);
    });

    it('does not open the menu on its way through', async () => {
      // The clear button sits inside the trigger, so its click must not also
      // reach the field's toggle.
      const page = await create(`<md-select clearable value="a">${OPTIONS}</md-select>`);
      (page.root!.shadowRoot!.querySelector('[part~="clear"]') as HTMLElement).click();
      await page.waitForChanges();
      expect(el(page).open).toBe(false);
    });

    it('does nothing while disabled', async () => {
      const page = await create(`<md-select clearable value="a" disabled>${OPTIONS}</md-select>`);
      const clear = page.root!.shadowRoot!.querySelector('[part~="clear"]') as HTMLElement | null;
      clear?.click();
      await page.waitForChanges();
      expect(el(page).value).toBe('a');
    });
  });

  describe('toggling by click', () => {
    it('opens and closes on the trigger', async () => {
      const page = await create(`<md-select>${OPTIONS}</md-select>`);
      const field = page.root!.shadowRoot!.querySelector('md-text-field') as HTMLElement;
      field.click();
      await page.waitForChanges();
      expect(el(page).open).toBe(true);
      field.click();
      await page.waitForChanges();
      expect(el(page).open).toBe(false);
    });

    it('does not toggle while disabled', async () => {
      const page = await create(`<md-select disabled>${OPTIONS}</md-select>`);
      (page.root!.shadowRoot!.querySelector('md-text-field') as HTMLElement).click();
      await page.waitForChanges();
      expect(el(page).open).toBe(false);
    });
  });
});
