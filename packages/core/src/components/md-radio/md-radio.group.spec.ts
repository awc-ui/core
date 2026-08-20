import { newSpecPage, SpecPage } from '@stencil/core/testing';
import { MdRadio } from './md-radio';

/**
 * Group behaviour: selection is a property of the whole `name` group, and the
 * roving tabstop belongs to the first ENABLED member.
 *
 * These read across siblings via `getRootNode()`, so they only mean anything
 * with several radios mounted together — which the single-element specs never
 * set up.
 */
async function create(html: string) {
  const page = await newSpecPage({ components: [MdRadio], html });
  await page.waitForChanges();
  return page;
}

const radios = (page: SpecPage) =>
  Array.from(page.body.querySelectorAll('md-radio')) as Array<
    HTMLElement & { checked: boolean; disabled: boolean }
  >;

const GROUP = `
  <md-radio id="a" name="pick" value="a"></md-radio>
  <md-radio id="b" name="pick" value="b"></md-radio>
  <md-radio id="c" name="pick" value="c"></md-radio>
`;

/** The instance behind a host, for the internals these tests inspect. */
const instOf = (page: SpecPage, id: string) =>
  (page.body.querySelector(`#${id}`) as unknown as { __instance?: unknown }) as unknown;

describe('md-radio — group', () => {
  describe('selection across the group', () => {
    it('reports no selection while every member is unchecked', async () => {
      const page = await create(GROUP);
      const inst = page.rootInstance as unknown as { groupHasSelection: boolean };
      expect(inst.groupHasSelection).toBe(false);
    });

    it('reports a selection when ANY member is checked', async () => {
      const page = await create(GROUP);
      radios(page)[2].checked = true;
      await page.waitForChanges();
      const inst = page.rootInstance as unknown as { groupHasSelection: boolean };
      // Read from the first radio, satisfied by the third — that is what makes
      // `required` a group-level constraint.
      expect(inst.groupHasSelection).toBe(true);
    });

    it('reads the PROPERTY, not the lagging reflected attribute', async () => {
      const page = await create(GROUP);
      const [a] = radios(page);
      a.checked = true;
      await page.waitForChanges();
      a.checked = false;
      // Deliberately NOT awaiting a render: the reflected attribute still says
      // checked at this point. Reading it would report the group as satisfied,
      // `required` would never republish valueMissing, and the form would
      // submit empty.
      const inst = page.rootInstance as unknown as { groupHasSelection: boolean };
      expect(inst.groupHasSelection).toBe(false);
    });

    it('falls back to its own state when the radio has no name', async () => {
      const page = await create('<md-radio id="solo"></md-radio>');
      const inst = page.rootInstance as unknown as { groupHasSelection: boolean; checked: boolean };
      expect(inst.groupHasSelection).toBe(false);
      (page.root as HTMLElement & { checked: boolean }).checked = true;
      await page.waitForChanges();
      expect(inst.groupHasSelection).toBe(true);
    });

    it('ignores radios belonging to another group', async () => {
      const page = await create(`
        <md-radio id="a" name="pick"></md-radio>
        <md-radio id="other" name="different" checked></md-radio>
      `);
      const inst = page.rootInstance as unknown as { groupHasSelection: boolean };
      expect(inst.groupHasSelection).toBe(false);
      expect(instOf(page, 'other')).toBeTruthy();
    });
  });

  describe('roving tabstop', () => {
    it('gives the tabstop to the first member', async () => {
      const page = await create(GROUP);
      await page.waitForChanges();
      const inst = page.rootInstance as unknown as { managedTabIndex: string };
      expect(inst.managedTabIndex).toBe('0');
    });

    it('passes it on when the first member is disabled', async () => {
      const page = await create(`
        <md-radio id="a" name="pick" disabled></md-radio>
        <md-radio id="b" name="pick"></md-radio>
      `);
      await page.waitForChanges();
      // The first ENABLED member holds it, or Tab would land on a dead control.
      const inst = page.rootInstance as unknown as { managedTabIndex: string };
      expect(inst.managedTabIndex).toBe('-1');
    });
  });

  describe('pointer and label interaction', () => {
    it('drops the programmatic focus ring on pointerdown', async () => {
      const page = await create('<md-radio id="a" name="pick"></md-radio>');
      const inst = page.rootInstance as unknown as {
        programmaticFocus: boolean;
        pressed: boolean;
      };
      inst.programmaticFocus = true;
      page.root!.dispatchEvent(new CustomEvent('pointerdown', { bubbles: true }));
      await page.waitForChanges();
      // A mouse press should not leave the keyboard focus ring behind.
      expect(inst.programmaticFocus).toBe(false);
      expect(inst.pressed).toBe(true);
    });

    it('does not arm the press while disabled', async () => {
      const page = await create('<md-radio id="a" name="pick" disabled></md-radio>');
      const inst = page.rootInstance as unknown as { pressed: boolean };
      page.root!.dispatchEvent(new CustomEvent('pointerdown', { bubbles: true }));
      await page.waitForChanges();
      expect(inst.pressed).toBe(false);
    });

    it('checks itself when an associated label is clicked', async () => {
      const page = await create('<md-radio id="a" name="pick"></md-radio>');
      const host = page.root as HTMLElement & { checked: boolean };
      const inst = page.rootInstance as unknown as { handleLabelClick(e: MouseEvent): void };

      // A click that did NOT pass through the radio itself — i.e. on the label
      // text beside it — still selects it.
      const ev = new MouseEvent('click', { bubbles: true }) as MouseEvent & {
        composedPath?: () => EventTarget[];
      };
      ev.composedPath = () => [document.createElement('span')];
      inst.handleLabelClick(ev);
      await page.waitForChanges();
      expect(host.checked).toBe(true);
    });

    it('does not double-handle a click that already hit the radio', async () => {
      const page = await create('<md-radio id="a" name="pick"></md-radio>');
      const host = page.root as HTMLElement & { checked: boolean };
      const inst = page.rootInstance as unknown as { handleLabelClick(e: MouseEvent): void };
      const onChange = jest.fn();
      host.addEventListener('mdChange', onChange);

      const ev = new MouseEvent('click', { bubbles: true }) as MouseEvent & {
        composedPath?: () => EventTarget[];
      };
      ev.composedPath = () => [host];
      inst.handleLabelClick(ev);
      await page.waitForChanges();
      // The radio's own click handler already ran; acting again would toggle twice.
      expect(onChange).not.toHaveBeenCalled();
    });
  });
});
