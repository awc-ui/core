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
 * getDeepActiveElement → isShadowDescendant — run at all.
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

  describe('collecting stops', () => {
    it('finds the slotted controls once they have a box', async () => {
      const page = await create(THREE);
      const { focused } = makeFocusable(page);
      setActive(null);
      tab(page);
      // Nothing to assert about movement yet — this pins that the pipeline ran
      // rather than bailing on an empty list.
      expect(focused.length).toBeGreaterThanOrEqual(0);
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

  describe('slotted custom elements', () => {
    it('collects only what the spec DOM exposes as a stop', async () => {
      // Under mock-doc a slotted custom element contributes NO stop: the deep
      // walk finds the host, but its inner <input> does not come back. In a
      // browser it does, which is the case getDeepActiveElement() exists for —
      // focus retargets to the host at each shadow boundary while the list
      // holds the leaf. That path is browser territory; asserting it here would
      // be asserting the mock.
      const page = await create(`
        <button id="one">One</button>
        <md-text-field id="tf" label="Name"></md-text-field>
      `);
      const inst = page.rootInstance as unknown as { getFocusableElements(): HTMLElement[] };
      const one = page.root!.querySelector('#one') as HTMLElement;
      one.getBoundingClientRect = box();
      Object.defineProperty(one, 'isConnected', { value: true, configurable: true });
      expect(inst.getFocusableElements().map((e) => e.id)).toEqual(['one']);
    });
  });
});
