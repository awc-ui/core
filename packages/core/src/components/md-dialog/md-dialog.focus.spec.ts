import { newSpecPage, SpecPage } from '@stencil/core/testing';
import { MdDialog } from './md-dialog';
import { MdTextField } from '../md-text-field/md-text-field';

/**
 * The focus trap — deep tabbable collection, the wrap at either end, and the
 * initial focus placement.
 *
 * It was unreachable: `isVisible()` keeps an element only if it has a non-zero
 * box (or non-zero offsets / client rects), and mock-doc reports zeros for
 * everything. Every candidate was filtered out, so the trap collected an empty
 * list and returned at its first guard. Giving the candidates real boxes is
 * what makes the pipeline — collectTabbablesDeep → isVisible →
 * getDeepActiveElement — run at all.
 */
const box = (w = 80, h = 32) => () =>
  ({ width: w, height: h, top: 0, left: 0, right: w, bottom: h, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;

/** Give every candidate a real box, and a focus() that records the call. */
function makeFocusable(page: SpecPage) {
  const els = Array.from(page.root!.querySelectorAll('button, input, a[href], md-text-field')) as HTMLElement[];
  const focused: string[] = [];
  for (const el of els) {
    el.getBoundingClientRect = box();
    Object.defineProperty(el, 'isConnected', { value: true, configurable: true });
    el.focus = () => {
      focused.push(el.id || el.tagName.toLowerCase());
    };
  }
  return { els, focused };
}

async function create(inner: string, attrs = 'open') {
  const page = await newSpecPage({
    components: [MdDialog, MdTextField],
    html: `<md-dialog ${attrs} headline="Title">${inner}</md-dialog>`,
  });
  await page.waitForChanges();
  return page;
}

const tab = (page: SpecPage, shift = false) => {
  const ev = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: shift, bubbles: true });
  page.root!.dispatchEvent(ev);
  return ev;
};

/** Point document.activeElement at `el` — the trap reads it to find the edge. */
function setActive(el: Element | null) {
  Object.defineProperty(document, 'activeElement', { configurable: true, get: () => el });
}

const THREE = `
  <button id="one">One</button>
  <button id="two">Two</button>
  <button id="three">Three</button>
`;

describe('md-dialog — focus trap', () => {
  afterEach(() => setActive(document.body));

  describe('deferred opening focus', () => {
    afterEach(() => jest.restoreAllMocks());

    it.each(['close', 'disconnect'])('does not steal focus after %s before the opening frame', async (action) => {
      const page = await create(THREE, '');
      const request = jest.spyOn(global, 'requestAnimationFrame').mockReturnValue(42);
      const cancel = jest.spyOn(global, 'cancelAnimationFrame').mockImplementation(() => {});
      const focus = jest.spyOn(page.rootInstance, 'focusFirst');

      page.root!.open = true;
      const openingFocus = request.mock.calls[0][0];
      if (action === 'close') {
        await page.root!.close();
      } else {
        page.root!.remove();
        page.rootInstance.disconnectedCallback();
      }
      await page.waitForChanges();

      expect(cancel).toHaveBeenCalledWith(42);
      // A stale callback must be harmless even if it has already been queued.
      openingFocus(0);
      expect(focus).not.toHaveBeenCalled();
    });

    it('does not focus when an mdOpen listener immediately closes the dialog', async () => {
      const page = await create(THREE, '');
      const callbacks: FrameRequestCallback[] = [];
      jest.spyOn(global, 'requestAnimationFrame').mockImplementation((callback) => callbacks.push(callback));
      const focus = jest.spyOn(page.rootInstance, 'focusFirst');
      page.root!.addEventListener('mdOpen', () => { page.root!.open = false; });

      page.root!.open = true;
      for (const callback of callbacks) callback(0);
      expect(focus).not.toHaveBeenCalled();
    });
  });

  describe('collecting stops', () => {
    it('finds each slotted control once in rendered order', async () => {
      const page = await create(THREE);
      const { els } = makeFocusable(page);
      expect(page.rootInstance.getFocusableElements()).toEqual(els);
    });

    it('drops a control with no box, which the user cannot focus either', async () => {
      const page = await create(THREE);
      const els = Array.from(page.root!.querySelectorAll('button')) as HTMLElement[];
      const focused: string[] = [];
      els.forEach((el, i) => {
        // Middle button stays zero-sized: display:none in everything but name.
        el.getBoundingClientRect = i === 1 ? box(0, 0) : box();
        Object.defineProperty(el, 'isConnected', { value: true, configurable: true });
        Object.defineProperty(el, 'offsetWidth', { value: i === 1 ? 0 : 80, configurable: true });
        Object.defineProperty(el, 'offsetHeight', { value: i === 1 ? 0 : 32, configurable: true });
        el.getClientRects = () => (i === 1 ? ([] as unknown as DOMRectList) : ([box()()] as unknown as DOMRectList));
        el.focus = () => focused.push(el.id);
      });
      setActive(els[2]);
      tab(page);
      // Wrapping from the last stop lands on the FIRST remaining one, skipping
      // the invisible middle.
      expect(focused[focused.length - 1]).toBe('one');
    });

    it('ignores a disconnected control', async () => {
      const page = await create(THREE);
      const els = Array.from(page.root!.querySelectorAll('button')) as HTMLElement[];
      const focused: string[] = [];
      els.forEach((el) => {
        el.getBoundingClientRect = box();
        el.focus = () => focused.push(el.id);
        Object.defineProperty(el, 'isConnected', { value: el.id !== 'one', configurable: true });
      });
      setActive(els[2]);
      tab(page);
      expect(focused[focused.length - 1]).toBe('two');
    });
  });

  describe('wrapping', () => {
    it('wraps forward from the last stop to the first', async () => {
      const page = await create(THREE);
      const { els, focused } = makeFocusable(page);
      setActive(els[els.length - 1]);
      const ev = tab(page);
      expect(ev.defaultPrevented).toBe(true);
      expect(focused[focused.length - 1]).toBe('one');
    });

    it('wraps backward from the first stop to the last', async () => {
      const page = await create(THREE);
      const { els, focused } = makeFocusable(page);
      setActive(els[0]);
      const ev = tab(page, true);
      expect(ev.defaultPrevented).toBe(true);
      expect(focused[focused.length - 1]).toBe('three');
    });

    it('leaves a Tab in the middle of the list to the browser', async () => {
      const page = await create(THREE);
      const { els, focused } = makeFocusable(page);
      setActive(els[1]);
      const ev = tab(page);
      // Only the EDGES are trapped; interior tabs move natively.
      expect(ev.defaultPrevented).toBe(false);
      expect(focused).toHaveLength(0);
    });

    it('does nothing when the dialog holds no focusable control', async () => {
      const page = await create('<p>Nothing to focus here.</p>');
      const ev = tab(page);
      expect(ev.defaultPrevented).toBe(false);
    });

    it('treats a single stop as both ends', async () => {
      const page = await create('<button id="only">Only</button>');
      const { els, focused } = makeFocusable(page);
      setActive(els[0]);
      tab(page);
      expect(focused[focused.length - 1]).toBe('only');
      tab(page, true);
      expect(focused[focused.length - 1]).toBe('only');
    });
  });

  describe('composed focus order', () => {
    function expose(element: HTMLElement) {
      element.getBoundingClientRect = box();
      Object.defineProperty(element, 'isConnected', { value: true, configurable: true });
      element.focus = jest.fn();
      return element;
    }

    function shadowControls(page: SpecPage, id: string, markup: string) {
      const host = page.root!.querySelector(`#${id}`) as HTMLElement;
      const shadow = host.attachShadow({ mode: 'open' });
      shadow.innerHTML = markup;
      const controls = Array.from(shadow.querySelectorAll<HTMLElement>('input, button'));
      controls.forEach(expose);
      return { host, shadow, controls };
    }

    it.each([true, false])('visits an earlier shadow field before a later native button (direct slot: %s)', async (direct) => {
      const content = '<focus-field id="field"></focus-field><button id="later">Later</button>';
      const page = await create(direct ? content : `<div>${content}</div>`);
      const { controls: [input] } = shadowControls(page, 'field', '<input id="first">');
      const later = expose(page.root!.querySelector<HTMLElement>('#later')!);
      expect(page.rootInstance.getFocusableElements()).toEqual([input, later]);
      page.rootInstance.focusFirst();
      expect(input.focus).toHaveBeenCalledTimes(1);
      expect(later.focus).not.toHaveBeenCalled();
    });

    it('wraps at shadow boundaries in the same order as initial focus', async () => {
      const page = await create('<focus-field id="first"></focus-field><button id="middle">Middle</button><focus-field id="last"></focus-field>');
      const first = shadowControls(page, 'first', '<input id="first-input">');
      const last = shadowControls(page, 'last', '<input id="last-input">');
      expose(page.root!.querySelector<HTMLElement>('#middle')!);
      Object.defineProperty(first.shadow, 'activeElement', { configurable: true, value: first.controls[0] });
      Object.defineProperty(last.shadow, 'activeElement', { configurable: true, value: last.controls[0] });

      setActive(last.host);
      expect(tab(page).defaultPrevented).toBe(true);
      expect(first.controls[0].focus).toHaveBeenCalledTimes(1);
      setActive(first.host);
      expect(tab(page, true).defaultPrevented).toBe(true);
      expect(last.controls[0].focus).toHaveBeenCalledTimes(1);
    });

    it('inserts assigned slot content between its shadow siblings without duplicates', async () => {
      const page = await create('<focus-group id="group"><button id="assigned">Assigned</button><button id="unassigned">Not rendered</button></focus-group>');
      const { shadow, controls } = shadowControls(page, 'group', '<button id="before">Before</button><slot></slot><button id="after">After</button>');
      const assigned = expose(page.root!.querySelector<HTMLElement>('#assigned')!);
      expose(page.root!.querySelector<HTMLElement>('#unassigned')!);
      shadow.querySelector('slot')!.assignedElements = () => [assigned];
      expect(page.rootInstance.getFocusableElements()).toEqual([controls[0], assigned, controls[1]]);
    });

    it('retains distinct inner controls of a focusable composite host', async () => {
      const page = await create('<focus-group id="group" tabindex="0"></focus-group>');
      const { host, controls } = shadowControls(page, 'group', '<input id="hex"><input id="red">');
      expose(host);
      expect(page.rootInstance.getFocusableElements()).toEqual([host, ...controls]);
    });

    it('does not create an extra stop for a host that delegates focus', async () => {
      const page = await create('<focus-group id="group" tabindex="0"></focus-group>');
      const { host, shadow, controls } = shadowControls(page, 'group', '<input id="hex"><input id="red">');
      expose(host);
      Object.defineProperty(shadow, 'delegatesFocus', { value: true, configurable: true });
      expect(page.rootInstance.getFocusableElements()).toEqual(controls);
    });

    it('skips inert and hidden subtrees plus negative-tabindex shadow scopes', async () => {
      const page = await create('<div inert><button id="inert">Busy</button></div><div hidden><button id="hidden">Hidden</button></div><focus-field id="excluded" tabindex="-1"></focus-field><button id="available">Available</button>');
      shadowControls(page, 'excluded', '<input id="inner">');
      const buttons = Array.from(page.root!.querySelectorAll<HTMLElement>('button'));
      buttons.forEach(expose);
      expect(page.rootInstance.getFocusableElements()).toEqual([buttons[2]]);
    });
  });

  describe('slotted custom elements', () => {
    it('includes the native input of a slotted Core field in rendered order', async () => {
      const page = await create(`
        <button id="one">One</button>
        <md-text-field id="tf" label="Name"></md-text-field>
      `);
      const inst = page.rootInstance as unknown as { getFocusableElements(): HTMLElement[] };
      const one = page.root!.querySelector('#one') as HTMLElement;
      const input = page.root!.querySelector('#tf')!.shadowRoot!.querySelector('input')!;
      // The composed-tree walker reaches the real Core field's shadow input.
      // mock-doc has no layout, so expose both stops just as the other focus
      // tests do instead of assuming the field contributes no focusable leaf.
      for (const element of [one, input]) {
        element.getBoundingClientRect = box();
        Object.defineProperty(element, 'isConnected', { value: true, configurable: true });
      }
      expect(inst.getFocusableElements()).toEqual([one, input]);
    });
  });
});
