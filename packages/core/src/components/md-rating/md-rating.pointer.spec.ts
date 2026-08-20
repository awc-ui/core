import { newSpecPage, SpecPage } from '@stencil/core/testing';
import { MdRating } from './md-rating';

/**
 * Pointer interaction: hover reporting, click-to-set, and half-star precision.
 *
 * `computeValueFromPointer` divides by the item's width, and mock-doc reports a
 * zero-sized rect — so at `precision="0.5"` every position resolved to the same
 * half and the interesting branch never ran. The items are given real boxes
 * here.
 */
const ITEM_W = 40;

const box = (left: number) => () =>
  ({
    width: ITEM_W,
    height: ITEM_W,
    left,
    right: left + ITEM_W,
    top: 0,
    bottom: ITEM_W,
    x: left,
    y: 0,
    toJSON: () => ({}),
  }) as DOMRect;

async function create(attrs = '') {
  const page = await newSpecPage({
    components: [MdRating],
    html: `<md-rating ${attrs}></md-rating>`,
  });
  await page.waitForChanges();
  sizeItems(page);
  return page;
}

/** Lay the stars out end to end so a clientX maps to a known item + fraction. */
function items(page: SpecPage) {
  return Array.from(
    page.root!.shadowRoot!.querySelectorAll('[part~="item"], .md-rating__item'),
  ) as HTMLElement[];
}

function sizeItems(page: SpecPage) {
  items(page).forEach((el, i) => {
    el.getBoundingClientRect = box(i * ITEM_W);
  });
}

/** Fire a pointer event on star `i`, `frac` of the way across it. */
function at(page: SpecPage, type: string, i: number, frac = 0.9) {
  const el = items(page)[i];
  const ev = new CustomEvent(type, { bubbles: true }) as CustomEvent & Record<string, unknown>;
  Object.assign(ev, {
    clientX: i * ITEM_W + ITEM_W * frac,
    clientY: 10,
    currentTarget: el,
    pointerId: 1,
  });
  // currentTarget is read by the handler and mock-doc will not set it during
  // dispatch, so it is pinned here.
  Object.defineProperty(ev, 'currentTarget', { value: el, configurable: true });
  el.dispatchEvent(ev);
  return ev;
}

/** pointerleave is bound on the items container, not the host. */
function leave(page: SpecPage) {
  const group = page.root!.shadowRoot!.querySelector('[part~="items"]') as HTMLElement;
  group.dispatchEvent(new CustomEvent('pointerleave', { bubbles: true }));
}

type Rating = HTMLElement & { value: number; max: number };
const el = (page: SpecPage) => page.root as Rating;

describe('md-rating — pointer', () => {
  describe('click to set', () => {
    it('takes the whole star at precision 1', async () => {
      const page = await create('max="5"');
      at(page, 'click', 2);
      await page.waitForChanges();
      expect(el(page).value).toBe(3);
    });

    it('announces the change', async () => {
      const page = await create('max="5"');
      const onChange = jest.fn();
      page.root!.addEventListener('mdChange', onChange);
      at(page, 'click', 0);
      await page.waitForChanges();
      expect(onChange).toHaveBeenCalledTimes(1);
      expect((onChange.mock.calls[0][0] as CustomEvent).detail).toBe(1);
    });

    it('clears back to the default when the same value is clicked again', async () => {
      const page = await create('max="5"');
      at(page, 'click', 2);
      await page.waitForChanges();
      expect(el(page).value).toBe(3);
      at(page, 'click', 2);
      await page.waitForChanges();
      // Re-picking the current rating clears it, which is how a user undoes a
      // mis-tap without a separate control.
      expect(el(page).value).toBe(0);
    });

    it('does nothing when readonly', async () => {
      const page = await create('max="5" readonly');
      at(page, 'click', 2);
      await page.waitForChanges();
      expect(el(page).value).toBe(0);
    });

    it('does nothing when disabled', async () => {
      const page = await create('max="5" disabled');
      at(page, 'click', 2);
      await page.waitForChanges();
      expect(el(page).value).toBe(0);
    });
  });

  describe('half-star precision', () => {
    it('takes the first half when the pointer is left of centre', async () => {
      const page = await create('max="5" precision="0.5"');
      at(page, 'click', 2, 0.25);
      await page.waitForChanges();
      expect(el(page).value).toBe(2.5);
    });

    it('takes the whole star past centre', async () => {
      const page = await create('max="5" precision="0.5"');
      at(page, 'click', 2, 0.75);
      await page.waitForChanges();
      expect(el(page).value).toBe(3);
    });

    it('treats exactly centre as the half', async () => {
      const page = await create('max="5" precision="0.5"');
      at(page, 'click', 0, 0.5);
      await page.waitForChanges();
      expect(el(page).value).toBe(0.5);
    });
  });

  describe('hover', () => {
    it('reports the hovered value', async () => {
      const page = await create('max="5"');
      const onHover = jest.fn();
      page.root!.addEventListener('mdHover', onHover);
      at(page, 'pointermove', 3);
      await page.waitForChanges();
      expect(onHover).toHaveBeenCalledWith(expect.objectContaining({ detail: 4 }));
    });

    it('reports only once while the pointer stays on the same star', async () => {
      const page = await create('max="5"');
      const onHover = jest.fn();
      page.root!.addEventListener('mdHover', onHover);
      at(page, 'pointermove', 3, 0.8);
      at(page, 'pointermove', 3, 0.9);
      await page.waitForChanges();
      // Otherwise every mouse move would emit.
      expect(onHover).toHaveBeenCalledTimes(1);
    });

    it('reports null when the pointer leaves', async () => {
      const page = await create('max="5"');
      const onHover = jest.fn();
      page.root!.addEventListener('mdHover', onHover);
      at(page, 'pointermove', 3);
      await page.waitForChanges();
      onHover.mockClear();

      leave(page);
      await page.waitForChanges();
      expect(onHover).toHaveBeenCalledWith(expect.objectContaining({ detail: null }));
    });

    it('stays quiet on leave when nothing was hovered', async () => {
      const page = await create('max="5"');
      const onHover = jest.fn();
      page.root!.addEventListener('mdHover', onHover);
      leave(page);
      await page.waitForChanges();
      expect(onHover).not.toHaveBeenCalled();
    });

    it('does not report while readonly', async () => {
      const page = await create('max="5" readonly');
      const onHover = jest.fn();
      page.root!.addEventListener('mdHover', onHover);
      at(page, 'pointermove', 3);
      await page.waitForChanges();
      expect(onHover).not.toHaveBeenCalled();
    });

    it('does not report when hover is switched off', async () => {
      const page = await create('max="5" hover="off"');
      const onHover = jest.fn();
      page.root!.addEventListener('mdHover', onHover);
      at(page, 'pointermove', 3);
      await page.waitForChanges();
      expect(onHover).not.toHaveBeenCalled();
    });
  });
});
