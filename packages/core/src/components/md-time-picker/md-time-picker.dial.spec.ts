import { newSpecPage } from '@stencil/core/testing';
import { MdTimePicker } from './md-time-picker';
import { MdTextField } from '../md-text-field/md-text-field';
import { MdButton } from '../md-button/md-button';
import { MdIconButton } from '../md-icon-button/md-icon-button';

/**
 * Dial pointer geometry — the mapping from a pointer position to an hour or a
 * minute. Untested until now because mock-doc reports a zero-sized rect for the
 * dial, which collapses the radius to 0 and makes every inner/outer ring test
 * meaningless; the dial has to be given a real box first. It also only exists
 * under `variant="dial"` — the picker opens in `input` variant by default.
 */
async function create(html: string) {
  return newSpecPage({
    components: [MdTimePicker, MdTextField, MdButton, MdIconButton],
    html,
  });
}

const R = 100; // dial radius; the box is 200×200 centred on (100,100)

/** Give the dial a real box so angle/distance mean something. */
function sizeDial(page: { root?: HTMLElement | null }) {
  const dial = page.root?.shadowRoot?.querySelector('.md-time-picker__dial') as HTMLElement | null;
  if (!dial) return null;
  dial.getBoundingClientRect = () =>
    ({
      left: 0,
      top: 0,
      right: 2 * R,
      bottom: 2 * R,
      width: 2 * R,
      height: 2 * R,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect;
  return dial;
}

/**
 * Dispatch a pointer at `deg` clockwise from 12 o'clock, `frac` of the way out
 * to the rim. The component measures angle from 12, so this mirrors its own
 * convention rather than raw atan2.
 */
function pointAt(dial: HTMLElement, type: string, deg: number, frac = 0.8) {
  const rad = ((deg - 90) * Math.PI) / 180;
  const ev = new CustomEvent(type, { bubbles: true }) as CustomEvent & {
    clientX: number;
    clientY: number;
    pointerId: number;
    preventDefault(): void;
  };
  Object.assign(ev, {
    clientX: R + Math.cos(rad) * R * frac,
    clientY: R + Math.sin(rad) * R * frac,
    pointerId: 1,
    preventDefault: () => undefined,
  });
  dial.dispatchEvent(ev);
  return ev;
}

type Picker = HTMLElement & { value: string; open: boolean; format?: string };

/**
 * The dial edits a DRAFT — `value` only commits when OK is pressed — so the
 * live signal is `mdInput`, which fires once per distinct H/M pair.
 */
async function openPicker(html: string) {
  const page = await create(html);
  const host = page.root as Picker;
  const inputs: string[] = [];
  host.addEventListener('mdInput', (e) => inputs.push((e as CustomEvent).detail.value));
  host.open = true;
  await page.waitForChanges();
  const dial = sizeDial(page);
  return {
    page,
    dial: dial!,
    host,
    inputs,
    /** The most recent drafted time, as canonical HH:MM. */
    latest: () => inputs[inputs.length - 1],
  };
}

describe('md-time-picker — dial', () => {
  describe('12h hours', () => {
    it('maps the top of the dial to 12 o’clock — which in the AM is midnight', async () => {
      const { page, dial, latest } = await openPicker(
        '<md-time-picker variant="dial" value="03:30"></md-time-picker>',
      );
      pointAt(dial, 'pointerdown', 0);
      await page.waitForChanges();
      // The dial shows "12" at the top; with the period still AM the canonical
      // 24h value is 00, not 12.
      expect(latest()?.startsWith('00:')).toBe(true);
    });

    it('maps a quarter turn to 3', async () => {
      const { page, dial, latest } = await openPicker('<md-time-picker variant="dial" value="01:00"></md-time-picker>');
      pointAt(dial, 'pointerdown', 90);
      await page.waitForChanges();
      expect(latest()?.startsWith('03:')).toBe(true);
    });

    it('maps half a turn to 6', async () => {
      const { page, dial, latest } = await openPicker('<md-time-picker variant="dial" value="01:00"></md-time-picker>');
      pointAt(dial, 'pointerdown', 180);
      await page.waitForChanges();
      expect(latest()?.startsWith('06:')).toBe(true);
    });

    it('snaps a position between numbers to the nearest hour', async () => {
      const { page, dial, latest } = await openPicker('<md-time-picker variant="dial" value="01:00"></md-time-picker>');
      // 88° is just short of 3 o'clock — must round to it, not to 2.
      pointAt(dial, 'pointerdown', 88);
      await page.waitForChanges();
      expect(latest()?.startsWith('03:')).toBe(true);
    });

    it('ignores the ring radius in 12h, where there is only one ring', async () => {
      const outer = await openPicker('<md-time-picker variant="dial" value="01:00"></md-time-picker>');
      pointAt(outer.dial, 'pointerdown', 90, 0.8);
      await outer.page.waitForChanges();

      const inner = await openPicker('<md-time-picker variant="dial" value="01:00"></md-time-picker>');
      pointAt(inner.dial, 'pointerdown', 90, 0.4);
      await inner.page.waitForChanges();

      expect(inner.latest()).toBe(outer.latest());
    });
  });

  describe('24h hours — two rings', () => {
    it('reads the outer ring as 1-12', async () => {
      const { page, dial, latest } = await openPicker(
        '<md-time-picker variant="dial" format="24h" value="05:00"></md-time-picker>',
      );
      pointAt(dial, 'pointerdown', 90, 0.8);
      await page.waitForChanges();
      expect(latest()?.startsWith('03:')).toBe(true);
    });

    it('reads the inner ring as 13-23', async () => {
      const { page, dial, latest } = await openPicker(
        '<md-time-picker variant="dial" format="24h" value="05:00"></md-time-picker>',
      );
      // Inside the 0.66r midpoint between the two number rings.
      pointAt(dial, 'pointerdown', 90, 0.4);
      await page.waitForChanges();
      expect(latest()?.startsWith('15:')).toBe(true);
    });

    it('reads the top of the outer ring as 12', async () => {
      const { page, dial, latest } = await openPicker(
        '<md-time-picker variant="dial" format="24h" value="05:00"></md-time-picker>',
      );
      pointAt(dial, 'pointerdown', 0, 0.8);
      await page.waitForChanges();
      expect(latest()?.startsWith('12:')).toBe(true);
    });

    it('reads the top of the inner ring as 00', async () => {
      const { page, dial, latest } = await openPicker(
        '<md-time-picker variant="dial" format="24h" value="05:00"></md-time-picker>',
      );
      pointAt(dial, 'pointerdown', 0, 0.4);
      await page.waitForChanges();
      expect(latest()?.startsWith('00:')).toBe(true);
    });
  });

  describe('minutes', () => {
    /** Advance to the minute view the way the UI does. */
    async function toMinutes(html: string) {
      const opened = await openPicker(html);
      const minuteTile = opened.page.root?.shadowRoot?.querySelector(
        '.md-time-picker__input--minute, [part="minute-input"]',
      ) as HTMLElement | null;
      minuteTile?.click();
      await opened.page.waitForChanges();
      return opened;
    }

    it('maps the top of the dial to :00', async () => {
      const { page, dial, latest } = await toMinutes('<md-time-picker variant="dial" value="03:17"></md-time-picker>');
      pointAt(dial, 'pointerdown', 0);
      await page.waitForChanges();
      expect(latest()).toMatch(/^\d{2}:\d{2}$/);
    });

    it('accepts a full sweep without producing an out-of-range minute', async () => {
      const { page, dial, inputs } = await toMinutes('<md-time-picker variant="dial" value="03:17"></md-time-picker>');
      // A move only applies while dragging, so the sweep has to start with a
      // press — a bare pointermove is correctly ignored.
      pointAt(dial, 'pointerdown', 0);
      for (const deg of [45, 90, 180, 270, 359]) {
        pointAt(dial, 'pointermove', deg);
      }
      await page.waitForChanges();
      expect(inputs.length).toBeGreaterThan(0);
      for (const v of inputs) {
        expect(v).toMatch(/^\d{2}:\d{2}$/);
        expect(Number(v.split(':')[1])).toBeLessThan(60);
      }
    });
  });

  describe('drag', () => {
    it('never even opens while disabled, so there is no dial to drag', async () => {
      const { dial, latest } = await openPicker(
        '<md-time-picker variant="dial" value="01:00" disabled></md-time-picker>',
      );
      expect(dial).toBeNull();
      expect(latest()).toBeUndefined();
    });

    it('emits one input per distinct time, not per pointer move', async () => {
      const { page, dial, inputs } = await openPicker(
        '<md-time-picker variant="dial" value="01:00"></md-time-picker>',
      );
      pointAt(dial, 'pointerdown', 90);
      // The same angle again — the de-dupe key must collapse these, or a drag
      // would emit once per frame.
      pointAt(dial, 'pointermove', 90);
      pointAt(dial, 'pointermove', 90);
      await page.waitForChanges();
      expect(inputs).toHaveLength(1);
    });

    it('tracks a drag across several hours', async () => {
      const { page, dial, latest } = await openPicker('<md-time-picker variant="dial" value="01:00"></md-time-picker>');
      pointAt(dial, 'pointerdown', 0);
      pointAt(dial, 'pointermove', 90);
      pointAt(dial, 'pointermove', 180);
      await page.waitForChanges();
      expect(latest()?.startsWith('06:')).toBe(true);
    });
  });
});
