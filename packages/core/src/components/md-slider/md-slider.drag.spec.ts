import { newSpecPage, SpecPage } from '@stencil/core/testing';
import { MdSlider } from './md-slider';

/**
 * Range-thumb dragging: the pointer → value mapping, step snapping, and the
 * thumb SWAP when one is dragged past the other.
 *
 * mock-doc reports a zero-sized rect for the rail, and `pointerToValue` divides
 * by its width — so without a real box every drag resolves to `min` and none of
 * this is reachable.
 */
const RAIL_LEFT = 0;
const RAIL_WIDTH = 200;

async function create(attrs = '') {
  const page = await newSpecPage({
    components: [MdSlider],
    html: `<md-slider ${attrs}></md-slider>`,
  });
  await page.waitForChanges();
  sizeRail(page);
  return page;
}

/** Give the rail a real 200px box so a ratio can be computed from it. */
function sizeRail(page: SpecPage, vertical = false) {
  const rail = page.root!.shadowRoot!.querySelector('.md-slider__rail') as HTMLElement | null;
  if (!rail) return null;
  rail.getBoundingClientRect = () =>
    ({
      left: RAIL_LEFT,
      right: RAIL_LEFT + RAIL_WIDTH,
      top: 0,
      bottom: vertical ? RAIL_WIDTH : 8,
      width: vertical ? 8 : RAIL_WIDTH,
      height: vertical ? RAIL_WIDTH : 8,
      x: RAIL_LEFT,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect;
  return rail;
}

const rail = (page: SpecPage) =>
  page.root!.shadowRoot!.querySelector('.md-slider__rail') as HTMLElement;

/** Dispatch a pointer event at `fraction` along the rail. */
function drag(page: SpecPage, type: string, fraction: number) {
  const el = rail(page);
  const ev = new CustomEvent(type, { bubbles: true }) as CustomEvent & {
    clientX: number;
    clientY: number;
    pointerId: number;
    currentTarget: unknown;
    setPointerCapture?: () => void;
  };
  Object.assign(ev, {
    clientX: RAIL_LEFT + RAIL_WIDTH * fraction,
    clientY: 4,
    pointerId: 1,
  });
  el.setPointerCapture = () => undefined;
  el.releasePointerCapture = () => undefined;
  el.dispatchEvent(ev);
  return ev;
}

type Slider = HTMLElement & { valueStart: number; valueEnd: number; value: number };

describe('md-slider — range dragging', () => {
  it('moves the nearer thumb to the pressed position', async () => {
    const page = await create('range value-start="0" value-end="100" min="0" max="100"');
    drag(page, 'pointerdown', 0.2);
    await page.waitForChanges();
    // 20% of 0..100 is nearer the start thumb, so that is the one that moves.
    expect((page.root as Slider).valueStart).toBe(20);
    expect((page.root as Slider).valueEnd).toBe(100);
  });

  it('moves the end thumb when the press is nearer it', async () => {
    const page = await create('range value-start="0" value-end="100" min="0" max="100"');
    drag(page, 'pointerdown', 0.8);
    await page.waitForChanges();
    expect((page.root as Slider).valueEnd).toBe(80);
    expect((page.root as Slider).valueStart).toBe(0);
  });

  it('tracks a drag after the press', async () => {
    const page = await create('range value-start="0" value-end="100" min="0" max="100"');
    drag(page, 'pointerdown', 0.2);
    drag(page, 'pointermove', 0.35);
    await page.waitForChanges();
    expect((page.root as Slider).valueStart).toBe(35);
  });

  it('swaps thumbs when the start is dragged past the end', async () => {
    const page = await create('range value-start="20" value-end="60" min="0" max="100"');
    drag(page, 'pointerdown', 0.2); // grab the start thumb
    drag(page, 'pointermove', 0.9); // drag it beyond the end
    await page.waitForChanges();
    const el = page.root as Slider;
    // The gesture continues on the OTHER thumb rather than stopping dead at the
    // crossing point, so the range stays ordered.
    expect(el.valueEnd).toBe(90);
    expect(el.valueStart).toBeLessThanOrEqual(el.valueEnd);
  });

  it('swaps the other way when the end is dragged below the start', async () => {
    const page = await create('range value-start="40" value-end="80" min="0" max="100"');
    drag(page, 'pointerdown', 0.8); // grab the end thumb
    drag(page, 'pointermove', 0.1); // drag it below the start
    await page.waitForChanges();
    const el = page.root as Slider;
    expect(el.valueStart).toBe(10);
    expect(el.valueStart).toBeLessThanOrEqual(el.valueEnd);
  });

  it('snaps to the step', async () => {
    const page = await create('range value-start="0" value-end="100" min="0" max="100" step="25"');
    drag(page, 'pointerdown', 0.3); // 30 → nearest 25
    await page.waitForChanges();
    expect((page.root as Slider).valueStart).toBe(25);
  });

  it('clamps a press past the far end', async () => {
    const page = await create('range value-start="0" value-end="50" min="0" max="100"');
    drag(page, 'pointerdown', 5); // way past the rail
    await page.waitForChanges();
    const el = page.root as Slider;
    expect(el.valueEnd).toBe(100);
  });

  it('clamps a press before the near end', async () => {
    const page = await create('range value-start="50" value-end="100" min="0" max="100"');
    drag(page, 'pointerdown', -5);
    await page.waitForChanges();
    expect((page.root as Slider).valueStart).toBe(0);
  });

  it('emits input while dragging', async () => {
    const page = await create('range value-start="0" value-end="100" min="0" max="100"');
    const onInput = jest.fn();
    page.root!.addEventListener('mdInput', onInput);
    drag(page, 'pointerdown', 0.2);
    drag(page, 'pointermove', 0.3);
    await page.waitForChanges();
    expect(onInput).toHaveBeenCalled();
  });

  it('stops tracking after the pointer is released', async () => {
    const page = await create('range value-start="0" value-end="100" min="0" max="100"');
    drag(page, 'pointerdown', 0.2);
    drag(page, 'pointerup', 0.2);
    await page.waitForChanges();
    const settled = (page.root as Slider).valueStart;
    drag(page, 'pointermove', 0.9);
    await page.waitForChanges();
    // A move with no button down must not keep dragging the thumb.
    expect((page.root as Slider).valueStart).toBe(settled);
  });

  it('ignores dragging while disabled', async () => {
    const page = await create('range value-start="10" value-end="90" min="0" max="100" disabled');
    drag(page, 'pointerdown', 0.5);
    await page.waitForChanges();
    const el = page.root as Slider;
    expect(el.valueStart).toBe(10);
    expect(el.valueEnd).toBe(90);
  });

  it('ignores a move that never had a press', async () => {
    const page = await create('range value-start="10" value-end="90" min="0" max="100"');
    drag(page, 'pointermove', 0.5);
    await page.waitForChanges();
    expect((page.root as Slider).valueStart).toBe(10);
  });

  it('maps a fraction across a non-zero minimum', async () => {
    const page = await create('range value-start="100" value-end="200" min="100" max="200"');
    drag(page, 'pointerdown', 0.5);
    await page.waitForChanges();
    const el = page.root as Slider;
    // Halfway along 100..200 is 150, not 50.
    expect(el.valueStart === 150 || el.valueEnd === 150).toBe(true);
  });
});
