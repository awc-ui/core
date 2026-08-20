import { newSpecPage, SpecPage } from '@stencil/core/testing';
import { MdColorPicker } from './md-color-picker';

/**
 * The three drag surfaces — saturation/value square, hue rail, alpha rail.
 *
 * Each caches `getBoundingClientRect()` on pointerdown and maps later positions
 * against it, and mock-doc reports zeros — so the cached rect had no size, every
 * position resolved the same way, and the drags were untestable. Real boxes make
 * the mapping mean something.
 */
const W = 200;
const H = 100;

const box = (w: number, h: number) => () =>
  ({ width: w, height: h, left: 0, top: 0, right: w, bottom: h, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;

async function create(attrs = '') {
  const page = await newSpecPage({
    components: [MdColorPicker],
    html: `<md-color-picker ${attrs}></md-color-picker>`,
  });
  await page.waitForChanges();
  return page;
}

const surface = (page: SpecPage, part: string) =>
  page.root!.shadowRoot!.querySelector(`[part~="${part}"]`) as HTMLElement | null;

/** Pointer event carrying the coordinates and a capture stub. */
function pointer(el: HTMLElement, type: string, x: number, y: number) {
  const ev = new CustomEvent(type, { bubbles: true }) as CustomEvent & Record<string, unknown>;
  Object.assign(ev, { clientX: x, clientY: y, pointerId: 1 });
  Object.defineProperty(ev, 'currentTarget', { value: el, configurable: true });
  (el as HTMLElement & { setPointerCapture?: unknown }).setPointerCapture = () => undefined;
  (el as HTMLElement & { releasePointerCapture?: unknown }).releasePointerCapture = () => undefined;
  el.dispatchEvent(ev);
  return ev;
}

type Picker = HTMLElement & { value: string; disabled: boolean };
const el = (page: SpecPage) => page.root as Picker;
const hsva = (page: SpecPage) =>
  (page.rootInstance as unknown as { hsva: { h: number; s: number; v: number; a: number } }).hsva;

/** Give a surface a real box before dragging on it. */
function sized(page: SpecPage, part: string, w = W, h = H) {
  const s = surface(page, part);
  if (s) s.getBoundingClientRect = box(w, h);
  return s;
}

describe('md-color-picker — drag surfaces', () => {
  // The square is `part="plate"`; the rails are `hue` and `alpha`.
  describe('saturation / value square', () => {
    it('maps a press to saturation and value', async () => {
      const page = await create();
      const sat = sized(page, 'plate')!;
      // Right edge, top → fully saturated, full value.
      pointer(sat, 'pointerdown', W, 0);
      await page.waitForChanges();
      expect(hsva(page).s).toBeCloseTo(100, 0);
      expect(hsva(page).v).toBeCloseTo(100, 0);
    });

    it('maps the opposite corner to no saturation and no value', async () => {
      const page = await create();
      const sat = sized(page, 'plate')!;
      pointer(sat, 'pointerdown', 0, H);
      await page.waitForChanges();
      expect(hsva(page).s).toBeCloseTo(0, 0);
      expect(hsva(page).v).toBeCloseTo(0, 0);
    });

    it('tracks a drag after the press', async () => {
      const page = await create();
      const sat = sized(page, 'plate')!;
      pointer(sat, 'pointerdown', 0, H);
      pointer(sat, 'pointermove', W / 2, H / 2);
      await page.waitForChanges();
      expect(hsva(page).s).toBeCloseTo(50, 0);
      expect(hsva(page).v).toBeCloseTo(50, 0);
    });

    it('clamps a position outside the square', async () => {
      const page = await create();
      const sat = sized(page, 'plate')!;
      pointer(sat, 'pointerdown', W * 5, -H);
      await page.waitForChanges();
      expect(hsva(page).s).toBe(100);
      expect(hsva(page).v).toBe(100);
    });

    it('ignores a move that never had a press', async () => {
      const page = await create();
      const sat = sized(page, 'plate')!;
      const before = { ...hsva(page) };
      pointer(sat, 'pointermove', W / 2, H / 2);
      await page.waitForChanges();
      expect(hsva(page).s).toBe(before.s);
    });

    it('commits on release', async () => {
      const page = await create();
      const sat = sized(page, 'plate')!;
      const onChange = jest.fn();
      page.root!.addEventListener('mdChange', onChange);
      pointer(sat, 'pointerdown', W, 0);
      pointer(sat, 'pointerup', W, 0);
      await page.waitForChanges();
      // The committed change is what a consumer persists; the drag itself only
      // emits the live input.
      expect(onChange).toHaveBeenCalled();
    });

    it('does nothing while disabled', async () => {
      const page = await create('disabled');
      const sat = sized(page, 'plate')!;
      const before = { ...hsva(page) };
      pointer(sat, 'pointerdown', W, 0);
      await page.waitForChanges();
      expect(hsva(page).s).toBe(before.s);
    });
  });

  describe('hue rail', () => {
    it('maps a press along the rail to a hue', async () => {
      const page = await create();
      const hue = sized(page, 'hue');
      if (!hue) return;
      pointer(hue, 'pointerdown', W / 2, 5);
      await page.waitForChanges();
      // Halfway along the rail is the middle of the 0-360 wheel.
      expect(hsva(page).h).toBeGreaterThan(150);
      expect(hsva(page).h).toBeLessThan(210);
    });

    it('clamps at both ends', async () => {
      const page = await create();
      const hue = sized(page, 'hue');
      if (!hue) return;
      pointer(hue, 'pointerdown', -50, 5);
      await page.waitForChanges();
      expect(hsva(page).h).toBe(0);
      pointer(hue, 'pointermove', W * 3, 5);
      await page.waitForChanges();
      expect(hsva(page).h).toBe(360);
    });
  });

  describe('alpha rail', () => {
    it('maps a press to an alpha', async () => {
      const page = await create('alpha');
      const a = sized(page, 'alpha');
      if (!a) return;
      pointer(a, 'pointerdown', W / 2, 5);
      await page.waitForChanges();
      expect(hsva(page).a).toBeGreaterThan(0.4);
      expect(hsva(page).a).toBeLessThan(0.6);
    });

    it('reaches fully transparent and fully opaque', async () => {
      const page = await create('alpha');
      const a = sized(page, 'alpha');
      if (!a) return;
      pointer(a, 'pointerdown', 0, 5);
      await page.waitForChanges();
      expect(hsva(page).a).toBe(0);
      pointer(a, 'pointermove', W, 5);
      await page.waitForChanges();
      expect(hsva(page).a).toBe(1);
    });
  });

  describe('hex field', () => {
    const hexInput = (page: SpecPage) =>
      (page.root!.shadowRoot!.querySelector('[part~="field-hex"]') as HTMLElement | null)?.tagName ===
      'INPUT'
        ? (page.root!.shadowRoot!.querySelector('[part~="field-hex"]') as HTMLInputElement)
        : (page.root!.shadowRoot!.querySelector('[part~="field-hex"] input') as HTMLInputElement | null);

    it('accepts a valid hex', async () => {
      const page = await create();
      const field = hexInput(page);
      if (!field) return;
      field.value = '#ff0000';
      field.dispatchEvent(new Event('input', { bubbles: true }));
      await page.waitForChanges();
      const inst = page.rootInstance as unknown as { hexInvalid: boolean };
      expect(inst.hexInvalid).toBe(false);
      expect(hsva(page).h).toBeCloseTo(0, 0);
      expect(hsva(page).s).toBeCloseTo(100, 0);
    });

    it('marks an unparseable hex invalid without changing the colour', async () => {
      const page = await create();
      const field = hexInput(page);
      if (!field) return;
      const before = { ...hsva(page) };
      field.value = 'nonsense';
      field.dispatchEvent(new Event('input', { bubbles: true }));
      await page.waitForChanges();
      const inst = page.rootInstance as unknown as { hexInvalid: boolean };
      // The field reports the error; the swatch keeps the last good colour
      // rather than jumping to black.
      expect(inst.hexInvalid).toBe(true);
      expect(hsva(page).h).toBe(before.h);
    });
  });
});
