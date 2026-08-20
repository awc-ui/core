import { newSpecPage } from '@stencil/core/testing';
import { MdNumberField } from './md-number-field';

async function create(html: string) {
  return newSpecPage({ components: [MdNumberField], html });
}

type Root = HTMLElement & {
  value: number | null;
  min?: number;
  max?: number;
  formatOptions?: Intl.NumberFormatOptions;
  stepUp: (times?: number) => Promise<void>;
  stepDown: (times?: number) => Promise<void>;
  setCustomValidity: (m: string) => Promise<void>;
  getValidity: () => Promise<{ valid: boolean; validationMessage: string; flags: Record<string, boolean> }>;
};

/** The formatted display text lives in private state — read it off the instance. */
const display = (page: Awaited<ReturnType<typeof create>>): string =>
  (page.rootInstance as unknown as { inputValue: string }).inputValue;

const fieldOf = (page: Awaited<ReturnType<typeof create>>): HTMLElement =>
  page.root?.shadowRoot?.querySelector('md-text-field') as HTMLElement;

const typeIn = (page: Awaited<ReturnType<typeof create>>, text: string) =>
  fieldOf(page).dispatchEvent(new CustomEvent('mdInput', { detail: text }));

const keyOn = (page: Awaited<ReturnType<typeof create>>, key: string, init: KeyboardEventInit = {}) =>
  fieldOf(page).dispatchEvent(new KeyboardEvent('keydown', { key, ...init }));

const blurField = (page: Awaited<ReturnType<typeof create>>) =>
  fieldOf(page).dispatchEvent(new Event('blur'));

describe('md-number-field', () => {
  afterEach(() => {
    // A test that installs fake timers and then hangs never reaches its own
    // `finally`, so they stay installed for the rest of the FILE — restore
    // unconditionally so one broken test cannot wedge the whole file.
    jest.useRealTimers();
  });

  // ── Rendering ─────────────────────────────────────────────

  describe('rendering', () => {
    it('renders host classes and the embedded md-text-field', async () => {
      const page = await create('<md-number-field label="Qty"></md-number-field>');
      expect(page.root).toHaveClass('md-number-field');
      expect(page.root).toHaveClass('md-number-field--filled');
      expect(page.root).toHaveClass('md-number-field--inline');
      expect(fieldOf(page)).toBeTruthy();
      expect(page.root?.shadowRoot?.querySelector('[part="field"]')).toBeTruthy();
    });

    it('reflects the outlined variant as a host class', async () => {
      const page = await create('<md-number-field variant="outlined"></md-number-field>');
      expect(page.root).toHaveClass('md-number-field--outlined');
      expect(page.root?.getAttribute('variant')).toBe('outlined');
    });

    it('inline steppers render inside the trailing slot: decrement then increment', async () => {
      const page = await create('<md-number-field></md-number-field>');
      const steppers = page.root?.shadowRoot?.querySelectorAll('md-icon-button');
      expect(steppers?.length).toBe(2);
      expect(steppers?.[0].getAttribute('slot')).toBe('trailing-icon');
      expect(steppers?.[0].getAttribute('part')).toBe('decrement');
      expect(steppers?.[1].getAttribute('part')).toBe('increment');
    });

    it('steppers="split" renders tonal buttons around the field', async () => {
      const page = await create('<md-number-field steppers="split"></md-number-field>');
      expect(page.root).toHaveClass('md-number-field--split');
      const kids = page.root?.shadowRoot?.querySelectorAll('md-icon-button');
      expect(kids?.length).toBe(2);
      expect(kids?.[0].getAttribute('slot')).toBeNull();
      // DOM order: decrement, field, increment (mirrors for free in RTL).
      expect(kids?.[0].getAttribute('part')).toBe('decrement');
      expect(kids?.[1].getAttribute('part')).toBe('increment');
    });

    it('steppers="none" renders no buttons', async () => {
      const page = await create('<md-number-field steppers="none"></md-number-field>');
      expect(page.root?.shadowRoot?.querySelectorAll('md-icon-button').length).toBe(0);
    });

    it('stepper labels are localizable props', async () => {
      const page = await create(
        '<md-number-field increment-label="Mehr" decrement-label="Weniger"></md-number-field>',
      );
      const steppers = page.root?.shadowRoot?.querySelectorAll('md-icon-button');
      expect(steppers?.[0].getAttribute('aria-label')).toBe('Weniger');
      expect(steppers?.[1].getAttribute('aria-label')).toBe('Mehr');
    });
  });

  // ── Parse / format ────────────────────────────────────────

  describe('value parsing + formatting', () => {
    it('formats the initial value with the default (en-US-style) locale grouping', async () => {
      const page = await create('<md-number-field locale="en-US" value="1234.5"></md-number-field>');
      expect((page.root as Root).value).toBe(1234.5);
      expect(display(page)).toBe('1,234.5');
    });

    it('formats and parses de-DE grouping (1.234,5)', async () => {
      const page = await create('<md-number-field locale="de-DE" value="1234.5"></md-number-field>');
      expect(display(page)).toBe('1.234,5');
      typeIn(page, '9.876,25');
      await page.waitForChanges();
      expect((page.root as Root).value).toBe(9876.25);
    });

    it('parses typed en-US text with separators', async () => {
      const page = await create('<md-number-field locale="en-US"></md-number-field>');
      typeIn(page, '1,234.5');
      await page.waitForChanges();
      expect((page.root as Root).value).toBe(1234.5);
    });

    it('percent format keeps Intl semantics: displayed 50 ⇔ value 0.5', async () => {
      const page = await create('<md-number-field locale="en-US"></md-number-field>');
      (page.root as Root).formatOptions = { style: 'percent' };
      (page.root as Root).value = 0.5;
      await page.waitForChanges();
      expect(display(page)).toBe('50%');
      typeIn(page, '75');
      await page.waitForChanges();
      expect((page.root as Root).value).toBe(0.75);
    });

    it('currency EUR / de-DE round-trips through the display', async () => {
      const page = await create('<md-number-field locale="de-DE"></md-number-field>');
      (page.root as Root).formatOptions = { style: 'currency', currency: 'EUR' };
      (page.root as Root).value = 9.99;
      await page.waitForChanges();
      expect(display(page)).toContain('9,99');
      expect(display(page)).toContain('€');
      typeIn(page, '12,50 €');
      await page.waitForChanges();
      expect((page.root as Root).value).toBe(12.5);
    });

    it('a garbage paste is rejected silently — no state change, no events', async () => {
      const page = await create('<md-number-field value="7"></md-number-field>');
      const inputSpy = jest.fn();
      page.root?.addEventListener('mdInput', inputSpy);
      typeIn(page, 'abc');
      await page.waitForChanges();
      expect((page.root as Root).value).toBe(7);
      expect(display(page)).toBe('7');
      expect(inputSpy).not.toHaveBeenCalled();
    });

    it('a string written through the value prop is coerced (framework proxies)', async () => {
      const page = await create('<md-number-field></md-number-field>');
      (page.root as unknown as { value: unknown }).value = '42';
      await page.waitForChanges();
      expect((page.root as Root).value).toBe(42);
      (page.root as unknown as { value: unknown }).value = 'nope';
      await page.waitForChanges();
      expect((page.root as Root).value).toBeNull();
    });
  });

  // ── Stepping math ─────────────────────────────────────────

  describe('stepping', () => {
    it('ArrowUp/ArrowDown step by `step`; an empty field seeds from 0', async () => {
      const page = await create('<md-number-field></md-number-field>');
      keyOn(page, 'ArrowUp');
      await page.waitForChanges();
      expect((page.root as Root).value).toBe(1);
      keyOn(page, 'ArrowDown');
      keyOn(page, 'ArrowDown');
      await page.waitForChanges();
      expect((page.root as Root).value).toBe(-1);
    });

    it('Alt steps by smallStep, Shift by largeStep', async () => {
      const page = await create('<md-number-field value="1"></md-number-field>');
      keyOn(page, 'ArrowUp', { altKey: true });
      await page.waitForChanges();
      expect((page.root as Root).value).toBe(1.1);
      keyOn(page, 'ArrowUp', { shiftKey: true });
      await page.waitForChanges();
      expect((page.root as Root).value).toBe(11.1);
    });

    it('float noise is cleaned on stepped results (0.1 + 0.2 territory)', async () => {
      const page = await create('<md-number-field value="0.2"></md-number-field>');
      keyOn(page, 'ArrowUp', { altKey: true });
      await page.waitForChanges();
      expect((page.root as Root).value).toBe(0.3);
    });

    it('interactive stepping always clamps into [min, max]', async () => {
      const page = await create('<md-number-field min="5" max="6"></md-number-field>');
      keyOn(page, 'ArrowUp'); // 0 + 1 = 1 → clamps up to min
      await page.waitForChanges();
      expect((page.root as Root).value).toBe(5);
      keyOn(page, 'ArrowUp', { shiftKey: true }); // 5 + 10 → clamps to max
      await page.waitForChanges();
      expect((page.root as Root).value).toBe(6);
    });

    it('steps from the parsed VISIBLE text after typing, not stale state', async () => {
      const page = await create('<md-number-field value="1"></md-number-field>');
      typeIn(page, '41');
      await page.waitForChanges();
      keyOn(page, 'ArrowUp');
      await page.waitForChanges();
      expect((page.root as Root).value).toBe(42);
    });

    it('snapOnStep snaps directionally for regular steps', async () => {
      const page = await create('<md-number-field snap-on-step value="2.5"></md-number-field>');
      keyOn(page, 'ArrowUp'); // 2.5 + 1 = 3.5 → snaps down toward travel start → 3
      await page.waitForChanges();
      expect((page.root as Root).value).toBe(3);
      (page.root as Root).value = 2.5;
      await page.waitForChanges();
      keyOn(page, 'ArrowDown'); // 2.5 - 1 = 1.5 → snaps up → 2
      await page.waitForChanges();
      expect((page.root as Root).value).toBe(2);
    });

    it('snapOnStep uses `min` as the snap base (non-aligned bounds stay reachable)', async () => {
      const page = await create('<md-number-field snap-on-step min="0.5" value="0.5"></md-number-field>');
      keyOn(page, 'ArrowUp'); // 0.5 + 1 = 1.5 = base + 1 unit exactly
      await page.waitForChanges();
      expect((page.root as Root).value).toBe(1.5);
    });

    it('Home/End jump to defined bounds only', async () => {
      const withBounds = await create('<md-number-field min="2" max="9" value="5"></md-number-field>');
      keyOn(withBounds, 'Home');
      await withBounds.waitForChanges();
      expect((withBounds.root as Root).value).toBe(2);
      keyOn(withBounds, 'End');
      await withBounds.waitForChanges();
      expect((withBounds.root as Root).value).toBe(9);

      const unbounded = await create('<md-number-field value="5"></md-number-field>');
      keyOn(unbounded, 'Home'); // no min → native caret behavior, value untouched
      await unbounded.waitForChanges();
      expect((unbounded.root as Root).value).toBe(5);
    });

    it('stepUp/stepDown methods apply step × times with clamping', async () => {
      const page = await create('<md-number-field max="5" value="1"></md-number-field>');
      await (page.root as Root).stepUp(3);
      await page.waitForChanges();
      expect((page.root as Root).value).toBe(4);
      await (page.root as Root).stepUp(10); // 4 + 10 → clamps to 5
      await page.waitForChanges();
      expect((page.root as Root).value).toBe(5);
      await (page.root as Root).stepDown();
      await page.waitForChanges();
      expect((page.root as Root).value).toBe(4);
    });

    it('readOnly blocks arrow stepping', async () => {
      const page = await create('<md-number-field readonly value="3"></md-number-field>');
      keyOn(page, 'ArrowUp');
      await page.waitForChanges();
      expect((page.root as Root).value).toBe(3);
    });
  });

  // ── Boundary stepper disabling ────────────────────────────

  describe('stepper boundary auto-disable', () => {
    const stepperDisabled = (el: Element | undefined | null): boolean => {
      const asProp = (el as unknown as { disabled?: boolean } | null)?.disabled === true;
      return asProp || !!el?.hasAttribute('disabled');
    };

    it('increment disables at max, decrement at min', async () => {
      const page = await create('<md-number-field min="0" max="2" value="2"></md-number-field>');
      let steppers = page.root?.shadowRoot?.querySelectorAll('md-icon-button');
      expect(stepperDisabled(steppers?.[1])).toBe(true); // increment at max
      expect(stepperDisabled(steppers?.[0])).toBe(false);
      (page.root as Root).value = 0;
      await page.waitForChanges();
      steppers = page.root?.shadowRoot?.querySelectorAll('md-icon-button');
      expect(stepperDisabled(steppers?.[0])).toBe(true); // decrement at min
      expect(stepperDisabled(steppers?.[1])).toBe(false);
    });

    it('disabled/readOnly disable both steppers', async () => {
      for (const attr of ['disabled', 'readonly']) {
        const page = await create(`<md-number-field ${attr} value="1"></md-number-field>`);
        const steppers = page.root?.shadowRoot?.querySelectorAll('md-icon-button');
        expect(stepperDisabled(steppers?.[0])).toBe(true);
        expect(stepperDisabled(steppers?.[1])).toBe(true);
      }
    });
  });

  // ── Press-and-hold ────────────────────────────────────────

  describe('press-and-hold', () => {
    it('ticks once on pointerdown, then repeats after 400ms at 60ms intervals', async () => {
      const page = await create('<md-number-field></md-number-field>');
      jest.useFakeTimers();
      const increment = page.root?.shadowRoot?.querySelectorAll('md-icon-button')?.[1] as HTMLElement;
      increment.dispatchEvent(new Event('pointerdown'));
      expect((page.root as Root).value).toBe(1); // first tick fires immediately
      jest.advanceTimersByTime(399);
      expect((page.root as Root).value).toBe(1); // still inside the start delay
      jest.advanceTimersByTime(1 + 60 * 3);
      expect((page.root as Root).value).toBe(4); // three interval ticks landed
      window.dispatchEvent(new Event('pointerup'));
      jest.advanceTimersByTime(600);
      expect((page.root as Root).value).toBe(4); // released → no more ticks
    });

    it('ticking stops at the bound', async () => {
      const page = await create('<md-number-field max="2"></md-number-field>');
      jest.useFakeTimers();
      const increment = page.root?.shadowRoot?.querySelectorAll('md-icon-button')?.[1] as HTMLElement;
      increment.dispatchEvent(new Event('pointerdown'));
      jest.advanceTimersByTime(400 + 60 * 10);
      expect((page.root as Root).value).toBe(2);
      window.dispatchEvent(new Event('pointerup'));
    });
  });

  // ── Wheel ─────────────────────────────────────────────────

  describe('wheel', () => {
    const wheel = (page: Awaited<ReturnType<typeof create>>, deltaY: number) => {
      const ev = new Event('wheel', { cancelable: true, bubbles: true }) as Event & { deltaY: number };
      ev.deltaY = deltaY;
      page.root?.dispatchEvent(ev);
      return ev;
    };

    it('steps only when allow-wheel-scrub AND the field has focus; deltaY>0 decrements', async () => {
      const page = await create('<md-number-field allow-wheel-scrub value="5"></md-number-field>');
      wheel(page, 100); // not focused → ignored
      await page.waitForChanges();
      expect((page.root as Root).value).toBe(5);
      fieldOf(page).dispatchEvent(new Event('focus'));
      await page.waitForChanges();
      const ev = wheel(page, 100);
      await page.waitForChanges();
      expect((page.root as Root).value).toBe(4);
      expect(ev.defaultPrevented).toBe(true);
      wheel(page, -100);
      await page.waitForChanges();
      expect((page.root as Root).value).toBe(5);
    });

    it('is inert without allow-wheel-scrub', async () => {
      const page = await create('<md-number-field value="5"></md-number-field>');
      fieldOf(page).dispatchEvent(new Event('focus'));
      await page.waitForChanges();
      const ev = wheel(page, 100);
      await page.waitForChanges();
      expect((page.root as Root).value).toBe(5);
      expect(ev.defaultPrevented).toBe(false);
    });
  });

  // ── Events + reasons ──────────────────────────────────────

  describe('events', () => {
    it('typing emits mdInput with reason "input-change" and the raw number', async () => {
      const page = await create('<md-number-field></md-number-field>');
      const spy = jest.fn();
      page.root?.addEventListener('mdInput', spy);
      typeIn(page, '42');
      await page.waitForChanges();
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0].detail).toEqual({ value: 42, formattedValue: '42', reason: 'input-change' });
    });

    it('emptying the field emits mdInput with reason "input-clear" and null', async () => {
      const page = await create('<md-number-field value="3"></md-number-field>');
      const spy = jest.fn();
      page.root?.addEventListener('mdInput', spy);
      typeIn(page, '');
      await page.waitForChanges();
      expect(spy.mock.calls[0][0].detail).toEqual({ value: null, formattedValue: '', reason: 'input-clear' });
      expect((page.root as Root).value).toBeNull();
    });

    it('blur reformats, clamps, and commits with reason "input-blur"', async () => {
      const page = await create('<md-number-field locale="en-US" max="1000"></md-number-field>');
      const changeSpy = jest.fn();
      page.root?.addEventListener('mdChange', changeSpy);
      typeIn(page, '1234.5');
      blurField(page);
      await page.waitForChanges();
      expect((page.root as Root).value).toBe(1000); // clamped at commit
      expect(display(page)).toBe('1,000');
      expect(changeSpy).toHaveBeenCalledTimes(1);
      expect(changeSpy.mock.calls[0][0].detail.reason).toBe('input-blur');
    });

    it('allow-out-of-range exempts TYPED text from the blur clamp', async () => {
      const page = await create('<md-number-field allow-out-of-range max="10"></md-number-field>');
      typeIn(page, '15');
      blurField(page);
      await page.waitForChanges();
      expect((page.root as Root).value).toBe(15);
    });

    it('keyboard stepping emits mdInput AND mdChange together (reason "keyboard")', async () => {
      const page = await create('<md-number-field value="1"></md-number-field>');
      const inputSpy = jest.fn();
      const changeSpy = jest.fn();
      page.root?.addEventListener('mdInput', inputSpy);
      page.root?.addEventListener('mdChange', changeSpy);
      keyOn(page, 'ArrowUp');
      await page.waitForChanges();
      expect(inputSpy).toHaveBeenCalledTimes(1);
      expect(changeSpy).toHaveBeenCalledTimes(1);
      expect(inputSpy.mock.calls[0][0].detail.reason).toBe('keyboard');
      expect(changeSpy.mock.calls[0][0].detail).toEqual({ value: 2, formattedValue: '2', reason: 'keyboard' });
    });

    it('blur with no change since the last commit stays silent', async () => {
      const page = await create('<md-number-field value="5"></md-number-field>');
      const changeSpy = jest.fn();
      page.root?.addEventListener('mdChange', changeSpy);
      fieldOf(page).dispatchEvent(new Event('focus'));
      blurField(page);
      await page.waitForChanges();
      expect(changeSpy).not.toHaveBeenCalled();
    });

    it('the inner field string-detail mdInput never leaks past the host', async () => {
      const page = await create('<md-number-field></md-number-field>');
      const details: unknown[] = [];
      page.root?.addEventListener('mdInput', (e) => details.push((e as CustomEvent).detail));
      typeIn(page, '7');
      await page.waitForChanges();
      expect(details.length).toBe(1);
      expect(typeof details[0]).toBe('object'); // only the typed detail, never the string
    });
  });

  // ── Character filtering ───────────────────────────────────

  describe('character filtering', () => {
    const pressChar = (page: Awaited<ReturnType<typeof create>>, key: string, init: KeyboardEventInit = {}) => {
      const ev = new KeyboardEvent('keydown', { key, cancelable: true, ...init });
      fieldOf(page).dispatchEvent(ev);
      return ev;
    };

    it('allows digits, sign and the locale separators; blocks letters', async () => {
      const page = await create('<md-number-field locale="en-US"></md-number-field>');
      expect(pressChar(page, '5').defaultPrevented).toBe(false);
      expect(pressChar(page, '-').defaultPrevented).toBe(false);
      expect(pressChar(page, '.').defaultPrevented).toBe(false);
      expect(pressChar(page, ',').defaultPrevented).toBe(false); // group separator
      expect(pressChar(page, 'x').defaultPrevented).toBe(true);
    });

    it('allows the currency symbol of the active format', async () => {
      const page = await create('<md-number-field locale="en-US"></md-number-field>');
      (page.root as Root).formatOptions = { style: 'currency', currency: 'USD' };
      await page.waitForChanges();
      expect(pressChar(page, '$').defaultPrevented).toBe(false);
      expect(pressChar(page, '%').defaultPrevented).toBe(true); // not a percent format
    });

    it('passes through Ctrl/Meta shortcuts and IME composition', async () => {
      const page = await create('<md-number-field></md-number-field>');
      expect(pressChar(page, 'a', { ctrlKey: true }).defaultPrevented).toBe(false);
      // mock-doc's KeyboardEvent may not copy `isComposing` from the init —
      // pin it on the instance so the IME guard is what is actually exercised.
      const ime = new KeyboardEvent('keydown', { key: 'x', cancelable: true });
      Object.defineProperty(ime, 'isComposing', { value: true });
      fieldOf(page).dispatchEvent(ime);
      expect(ime.defaultPrevented).toBe(false);
    });
  });

  // ── Form / validity (spec-mockable parts only) ────────────

  describe('form integration', () => {
    // The submitted value/validity ride on ElementInternals, which the Stencil
    // spec mock no-ops — the real FormData round-trip and required-blocks-
    // submit behaviour are covered in md-number-field.e2e.ts.

    it('formResetCallback restores the initial value and display', async () => {
      const page = await create('<md-number-field value="5"></md-number-field>');
      typeIn(page, '9');
      blurField(page);
      await page.waitForChanges();
      expect((page.root as Root).value).toBe(9);
      (page.rootInstance as unknown as { formResetCallback: () => void }).formResetCallback();
      await page.waitForChanges();
      expect((page.root as Root).value).toBe(5);
      expect(display(page)).toBe('5');
    });

    it('formStateRestoreCallback restores a stringified number', async () => {
      const page = await create('<md-number-field></md-number-field>');
      (page.rootInstance as unknown as {
        formStateRestoreCallback: (s: string) => void;
      }).formStateRestoreCallback('12.5');
      await page.waitForChanges();
      expect((page.root as Root).value).toBe(12.5);
    });

    it('the validity quintet answers permissively under the spec mock', async () => {
      const page = await create('<md-number-field required></md-number-field>');
      const root = page.root as Root;
      await root.setCustomValidity('nope'); // must not throw under the mock
      await root.setCustomValidity('');
      const v = await root.getValidity();
      expect(typeof v.valid).toBe('boolean');
      expect(v).toHaveProperty('flags');
    });
  });

  // ── Disabled ──────────────────────────────────────────────

  describe('disabled', () => {
    it('applies the disabled host class and blocks arrow stepping', async () => {
      const page = await create('<md-number-field disabled value="3"></md-number-field>');
      expect(page.root).toHaveClass('md-number-field--disabled');
      keyOn(page, 'ArrowUp');
      await page.waitForChanges();
      expect((page.root as Root).value).toBe(3);
    });
  });

  // ── Density / RTL ─────────────────────────────────────────

  describe('density + RTL', () => {
    it('reflects density on the host and forwards it to the field', async () => {
      const page = await create('<md-number-field density="-2"></md-number-field>');
      expect(page.root?.getAttribute('density')).toBe('-2');
      const field = fieldOf(page) as HTMLElement & { density?: number };
      // Un-upgraded md-text-field: the forwarded prop lands as an attribute or
      // a JS property depending on the mock-doc serialisation path.
      expect(field.getAttribute('density') === '-2' || field.density === -2).toBe(true);
    });

    it('renders inside an RTL context', async () => {
      const page = await newSpecPage({
        components: [MdNumberField],
        html: '<div dir="rtl"><md-number-field steppers="split" value="3"></md-number-field></div>',
      });
      expect(page.root).toBeTruthy();
    });
  });

  // ── Custom CSS API ────────────────────────────────────────

  describe('custom CSS API', () => {
    it('carries inline custom-property overrides on the host', async () => {
      const page = await create(
        '<md-number-field style="--md-number-field-stepper-icon-size: 24px;"></md-number-field>',
      );
      expect(page.root?.getAttribute('style')).toContain('--md-number-field-stepper-icon-size: 24px');
    });
  });
});
