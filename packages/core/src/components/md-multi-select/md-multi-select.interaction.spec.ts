import { newSpecPage, SpecPage } from '@stencil/core/testing';
import { MdMultiSelect } from './md-multi-select';
import { MdSelectOption } from '../md-select-option/md-select-option';
import { MdTextField } from '../md-text-field/md-text-field';
import { MdMenu } from '../md-menu/md-menu';
import { MdMenuItem } from '../md-menu-item/md-menu-item';

/**
 * Opening from the keyboard and toggling values off the menu — the layer
 * between the trigger and the selection that the earlier specs (rendering,
 * public methods, chips) did not drive.
 */
async function create(html: string) {
  const page = await newSpecPage({
    components: [MdMultiSelect, MdSelectOption, MdTextField, MdMenu, MdMenuItem],
    html,
  });
  await page.waitForChanges();
  return page;
}

type Multi = HTMLElement & { open: boolean; value: string[] };

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

const el = (page: SpecPage) => page.root as Multi;
const items = (page: SpecPage) =>
  Array.from(page.root!.shadowRoot!.querySelectorAll('md-menu-item')) as HTMLElement[];

describe('md-multi-select — interaction', () => {
  describe('opening from the keyboard', () => {
    // APG select-only listbox: all four of these open the menu.
    it.each(['ArrowDown', 'ArrowUp', 'Enter', ' '])('opens on %s', async (k) => {
      const page = await create(`<md-multi-select>${OPTIONS}</md-multi-select>`);
      const ev = key(page, k);
      await page.waitForChanges();
      expect(el(page).open).toBe(true);
      // Otherwise Space scrolls the page and Enter submits the form around it.
      expect(ev.defaultPrevented).toBe(true);
    });

    it('closes on Escape and returns focus to the trigger', async () => {
      const page = await create(`<md-multi-select>${OPTIONS}</md-multi-select>`);
      el(page).open = true;
      await page.waitForChanges();
      const ev = key(page, 'Escape');
      await page.waitForChanges();
      expect(el(page).open).toBe(false);
      expect(ev.defaultPrevented).toBe(true);
    });

    it('ignores Escape while closed', async () => {
      const page = await create(`<md-multi-select>${OPTIONS}</md-multi-select>`);
      const ev = key(page, 'Escape');
      await page.waitForChanges();
      expect(ev.defaultPrevented).toBe(false);
    });

    it('stays shut while disabled', async () => {
      const page = await create(`<md-multi-select disabled>${OPTIONS}</md-multi-select>`);
      key(page, 'ArrowDown');
      await page.waitForChanges();
      expect(el(page).open).toBe(false);
    });

    it('leaves other keys alone', async () => {
      const page = await create(`<md-multi-select>${OPTIONS}</md-multi-select>`);
      const ev = key(page, 'x');
      await page.waitForChanges();
      expect(el(page).open).toBe(false);
      expect(ev.defaultPrevented).toBe(false);
    });
  });

  describe('toggling values', () => {
    it('adds a value on first pick and keeps the menu open', async () => {
      const page = await create(`<md-multi-select>${OPTIONS}</md-multi-select>`);
      el(page).open = true;
      await page.waitForChanges();
      const onChange = jest.fn();
      page.root!.addEventListener('mdChange', onChange);

      items(page)[0].click();
      await page.waitForChanges();

      expect(el(page).value).toEqual(['a']);
      // Multi-select stays open so several picks are one gesture.
      expect(el(page).open).toBe(true);
      expect(onChange).toHaveBeenCalledTimes(1);
    });

    it('removes a value when picked again', async () => {
      const page = await create(`<md-multi-select>${OPTIONS}</md-multi-select>`);
      const host = el(page);
      host.value = ['a'];
      host.open = true;
      await page.waitForChanges();

      items(page)[0].click();
      await page.waitForChanges();
      expect(host.value).toEqual([]);
    });

    it('accumulates several picks', async () => {
      const page = await create(`<md-multi-select>${OPTIONS}</md-multi-select>`);
      el(page).open = true;
      await page.waitForChanges();
      items(page)[0].click();
      await page.waitForChanges();
      items(page)[2].click();
      await page.waitForChanges();
      expect(el(page).value).toEqual(['a', 'c']);
    });

    it('ignores a disabled option', async () => {
      const page = await create(`<md-multi-select>
        <md-select-option value="a">Alpha</md-select-option>
        <md-select-option value="b" disabled>Beta</md-select-option>
      </md-multi-select>`);
      el(page).open = true;
      await page.waitForChanges();
      items(page)[1].click();
      await page.waitForChanges();
      expect(el(page).value).not.toContain('b');
    });
  });

  describe('max-selected', () => {
    it('refuses a pick past the cap', async () => {
      const page = await create(`<md-multi-select max-selected="2">${OPTIONS}</md-multi-select>`);
      const host = el(page);
      host.value = ['a', 'b'];
      host.open = true;
      await page.waitForChanges();

      items(page)[2].click();
      await page.waitForChanges();
      expect(host.value).toEqual(['a', 'b']);
    });

    it('still allows removing one at the cap', async () => {
      const page = await create(`<md-multi-select max-selected="2">${OPTIONS}</md-multi-select>`);
      const host = el(page);
      host.value = ['a', 'b'];
      host.open = true;
      await page.waitForChanges();

      // Deselecting must stay possible, or the control locks up once full.
      items(page)[0].click();
      await page.waitForChanges();
      expect(host.value).toEqual(['b']);
    });
  });

  describe('toggling by click', () => {
    it('opens and closes on the trigger', async () => {
      const page = await create(`<md-multi-select>${OPTIONS}</md-multi-select>`);
      const field = page.root!.shadowRoot!.querySelector('md-text-field') as HTMLElement;
      field.click();
      await page.waitForChanges();
      expect(el(page).open).toBe(true);
      field.click();
      await page.waitForChanges();
      expect(el(page).open).toBe(false);
    });

    it('does not toggle while disabled', async () => {
      const page = await create(`<md-multi-select disabled>${OPTIONS}</md-multi-select>`);
      (page.root!.shadowRoot!.querySelector('md-text-field') as HTMLElement).click();
      await page.waitForChanges();
      expect(el(page).open).toBe(false);
    });
  });
});
