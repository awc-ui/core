import { newSpecPage } from '@stencil/core/testing';
import { MdTimePicker } from './md-time-picker';
import { MdTextField } from '../md-text-field/md-text-field';
import { MdButton } from '../md-button/md-button';
import { MdIconButton } from '../md-icon-button/md-icon-button';

describe('md-time-picker', () => {
  // The dialog is composed from several other components — trigger
  // uses md-text-field; footer toggle uses md-icon-button; Cancel/OK
  // use md-button. We register all of them so their Host onClick
  // listeners hydrate and `.click()` propagates to the `mdClick`
  // emitters that md-time-picker subscribes to via `onMdClick`.
  // Without hydration, calling .click() on a host element in spec
  // mode is a no-op for the inner native button, and event-emission
  // assertions silently fail.
  async function create(html: string) {
    return newSpecPage({
      components: [MdTimePicker, MdTextField, MdButton, MdIconButton],
      html,
    });
  }

  // ───────────────────────── RENDERING ─────────────────────────
  describe('rendering', () => {
    it('renders with defaults', async () => {
      const page = await create('<md-time-picker></md-time-picker>');
      expect(page.root).toBeTruthy();
      expect(page.root?.classList.contains('md-time-picker')).toBe(true);
    });

    it('renders trigger by default', async () => {
      const page = await create('<md-time-picker></md-time-picker>');
      // Trigger is now a composed md-text-field tagged with the same
      // .md-time-picker__field class + part="trigger" for legacy hooks.
      const trigger = page.root?.shadowRoot?.querySelector('.md-time-picker__field');
      expect(trigger).toBeTruthy();
      expect(trigger?.tagName.toLowerCase()).toBe('md-text-field');
      expect(trigger?.getAttribute('part')).toBe('trigger');
    });

    it('renders md-ripple inside every tappable AM/PM tile', async () => {
      // After the variants unified around typeable HH/MM input fields,
      // the only headline tiles that remain "stateful press targets"
      // are the AM and PM buttons in 12-hour mode. They MUST each host
      // exactly one <md-ripple> that's exposed as a CSS part for
      // automation, and the ripple MUST inherit the host's disabled
      // state. The HH/MM tiles, now <input> elements, use the browser's
      // native caret/selection feedback instead of a custom ripple.
      const page = await create('<md-time-picker open format="12h"></md-time-picker>');
      const sr = page.root?.shadowRoot;
      const tiles = [
        ['period-am', 'period-am-ripple'],
        ['period-pm', 'period-pm-ripple'],
      ] as const;

      for (const [tilePart, ripplePart] of tiles) {
        const tile = sr?.querySelector(`[part="${tilePart}"]`);
        expect(tile).toBeTruthy();
        const ripples = tile?.querySelectorAll('md-ripple') ?? [];
        expect(ripples.length).toBe(1);
        const exposed = sr?.querySelector(`[part="${ripplePart}"]`);
        expect(exposed?.tagName.toLowerCase()).toBe('md-ripple');
        expect(exposed?.hasAttribute('disabled')).toBe(false);
      }
    });

    it('does NOT host an md-ripple inside the HH/MM input fields', async () => {
      // Pin the contract: HH/MM are now typeable <input> elements,
      // not "stateful press tiles", so a stray <md-ripple> nested
      // inside one of them would be a regression to the old read-only
      // button design.
      const page = await create('<md-time-picker open format="12h"></md-time-picker>');
      const sr = page.root?.shadowRoot;
      const hourInput = sr?.querySelector('[part="input-hour"]');
      const minuteInput = sr?.querySelector('[part="input-minute"]');
      expect(hourInput?.querySelector('md-ripple')).toBeFalsy();
      expect(minuteInput?.querySelector('md-ripple')).toBeFalsy();
    });

    it('wires the ripple disabled-state binding through to the AM/PM tiles', async () => {
      // A disabled picker is never open (boot-open + disabled is a no-op
      // and disabling at runtime closes the dialog — covered separately),
      // so the reachable contract is the positive one: an OPEN, enabled
      // picker renders AM/PM ripples that are present and NOT disabled.
      // The ripples bind `disabled={this.isDisabled}`, so the state layer
      // can never contradict the disabled visual.
      const page = await create('<md-time-picker open format="12h"></md-time-picker>');
      const sr = page.root?.shadowRoot;
      const ripples = sr?.querySelectorAll('md-ripple') ?? [];
      expect(ripples.length).toBeGreaterThan(0);
      ripples.forEach((r) => expect(r.hasAttribute('disabled')).toBe(false));
    });

    it('composes the footer from md-icon-button and md-button (no bespoke <button>)', async () => {
      // Guard against regressions where someone re-introduces a native
      // <button> for the toggle or actions, bypassing md-icon-button /
      // md-button's state layer, ripple, focus ring, density and theme
      // tokens. The footer parts MUST stay composed from the design
      // system primitives.
      const page = await create('<md-time-picker open></md-time-picker>');
      const toggle = page.root?.shadowRoot?.querySelector('[part="toggle-mode"]');
      const cancel = page.root?.shadowRoot?.querySelector('[part="cancel-button"]');
      const confirm = page.root?.shadowRoot?.querySelector('[part="confirm-button"]');
      expect(toggle?.tagName.toLowerCase()).toBe('md-icon-button');
      expect(cancel?.tagName.toLowerCase()).toBe('md-button');
      expect(confirm?.tagName.toLowerCase()).toBe('md-button');
      // md-button defaults to "filled"; the M3 dialog spec wants text
      // buttons for Cancel / OK.
      expect((cancel as any)?.variant).toBe('text');
      expect((confirm as any)?.variant).toBe('text');
    });

    it('hides trigger when hide-trigger is set', async () => {
      const page = await create('<md-time-picker hide-trigger></md-time-picker>');
      expect(page.root?.shadowRoot?.querySelector('.md-time-picker__field')).toBeNull();
    });

    it('renders the trigger as an outlined, readonly text-field', async () => {
      const page = await create('<md-time-picker></md-time-picker>');
      const trigger = page.root?.shadowRoot?.querySelector('md-text-field[part="trigger"]') as any;
      // md-text-field's variant / readOnly / label props are not
      // `reflect: true`, so JSX prop-setting doesn't put them on the
      // attribute map. Check the JS properties instead — that's what
      // md-text-field actually reads when rendering.
      expect(trigger?.variant).toBe('outlined');
      expect(trigger?.readOnly).toBe(true);
    });

    it('places the schedule icon in the leading-icon slot of the trigger', async () => {
      const page = await create('<md-time-picker></md-time-picker>');
      const trigger = page.root?.shadowRoot?.querySelector('md-text-field[part="trigger"]');
      const slotted = trigger?.querySelector('[slot="leading-icon"]');
      expect(slotted).toBeTruthy();
      expect(slotted?.textContent?.trim()).toBe('schedule');
      expect(slotted?.getAttribute('part')).toBe('trigger-icon');
    });

    it('does not render the dialog when closed', async () => {
      const page = await create('<md-time-picker></md-time-picker>');
      expect(page.root?.shadowRoot?.querySelector('.md-time-picker__dialog')).toBeNull();
    });

    it('renders the dialog when open=true', async () => {
      const page = await create('<md-time-picker open></md-time-picker>');
      expect(page.root?.shadowRoot?.querySelector('.md-time-picker__dialog')).toBeTruthy();
    });

    it('applies variant class', async () => {
      const page = await create('<md-time-picker variant="input"></md-time-picker>');
      expect(page.root?.classList.contains('md-time-picker--input')).toBe(true);
    });

    it('applies format class', async () => {
      const page = await create('<md-time-picker format="24h"></md-time-picker>');
      expect(page.root?.classList.contains('md-time-picker--format-24h')).toBe(true);
    });
  });

  // ───────────────────────── PROPS ─────────────────────────
  describe('props', () => {
    it('reflects disabled', async () => {
      const page = await create('<md-time-picker disabled></md-time-picker>');
      expect(page.root?.getAttribute('disabled')).not.toBeNull();
    });

    it('reflects open', async () => {
      const page = await create('<md-time-picker open></md-time-picker>');
      expect(page.root?.hasAttribute('open')).toBe(true);
    });

    it('parses value prop', async () => {
      const page = await create('<md-time-picker value="14:30"></md-time-picker>');
      expect(page.rootInstance.value).toBe('14:30');
    });

    it('rejects invalid value strings: resets to "" and keeps the trigger empty', async () => {
      // Previously the malformed string was kept verbatim in `value`
      // while the trigger rendered a phantom "12:00 PM" — the contract
      // is now native-like: unparseable ⇒ empty.
      const page = await create('<md-time-picker value="not-a-time"></md-time-picker>');
      expect(page.rootInstance.value).toBe('');
      const trigger = page.root?.shadowRoot?.querySelector('md-text-field[part="trigger"]') as any;
      expect(trigger?.value).toBe('');
    });

    it('rejects out-of-range value strings at runtime (25:99 → "")', async () => {
      const page = await create('<md-time-picker value="09:15"></md-time-picker>');
      (page.root as any).value = '25:99';
      await page.waitForChanges();
      expect(page.rootInstance.value).toBe('');
      const trigger = page.root?.shadowRoot?.querySelector('md-text-field[part="trigger"]') as any;
      expect(trigger?.value).toBe('');
    });

    it('rejects an invalid runtime value even when no value was ever committed (open dialog re-seeds)', async () => {
      // committedValue === '' meant the '' re-assignment could not
      // re-fire the watch — the reset has to happen inline.
      const page = await create('<md-time-picker open></md-time-picker>');
      const sr = page.root!.shadowRoot!;
      const hourInput = sr.querySelector('[part="input-hour"]') as HTMLInputElement;
      hourInput.value = '3';
      hourInput.dispatchEvent(new Event('input', { bubbles: true }));
      await page.waitForChanges();
      expect(hourInput.value).toBe('3');
      (page.root as any).value = 'banana';
      await page.waitForChanges();
      expect(page.rootInstance.value).toBe('');
      // tiles re-seeded to the documented empty state (noon)
      expect(hourInput.value).toBe('12');
      expect((sr.querySelector('[part="input-minute"]') as HTMLInputElement).value).toBe('00');
    });

    it('canonicalizes unpadded value strings ("9:05" → "09:05") on load and at runtime', async () => {
      const page = await create('<md-time-picker value="9:05"></md-time-picker>');
      expect(page.rootInstance.value).toBe('09:05');
      const trigger = page.root?.shadowRoot?.querySelector('md-text-field[part="trigger"]') as any;
      expect(trigger?.value).toBe('9:05 AM');
      (page.root as any).value = '7:30';
      await page.waitForChanges();
      expect(page.rootInstance.value).toBe('07:30');
    });

    it('forwards label to the trigger text-field', async () => {
      const page = await create('<md-time-picker label="Start time"></md-time-picker>');
      const trigger = page.root?.shadowRoot?.querySelector('md-text-field[part="trigger"]') as any;
      // `label` on md-text-field is a plain prop (no attribute reflection),
      // so assert the JS-side property — that's what drives the floating
      // label, fieldset legend, and aria-label on the inner input.
      expect(trigger?.label).toBe('Start time');
    });

    it('respects custom AM/PM labels', async () => {
      const page = await create('<md-time-picker am-label="vorm." pm-label="nachm." value="14:00" open></md-time-picker>');
      const am = page.root?.shadowRoot?.querySelector('.md-time-picker__period-btn--am');
      const pm = page.root?.shadowRoot?.querySelector('.md-time-picker__period-btn--pm');
      expect(am?.textContent).toBe('vorm.');
      expect(pm?.textContent).toBe('nachm.');
    });
  });

  // ───────────────────────── TRIGGER ─────────────────────────
  describe('trigger', () => {
    it('shows the formatted value in 12h mode on the trigger', async () => {
      const page = await create('<md-time-picker value="14:30"></md-time-picker>');
      const trigger = page.root?.shadowRoot?.querySelector('md-text-field[part="trigger"]') as any;
      // md-text-field's `value` is intentionally NOT reflected (typed
      // values — passwords included — must never appear as DOM attributes);
      // the consumer-facing surface is the property.
      expect(trigger?.getAttribute('value')).toBeNull();
      expect(trigger?.value).toBe('2:30 PM');
    });

    it('shows the formatted value in 24h mode on the trigger', async () => {
      const page = await create('<md-time-picker format="24h" value="08:05"></md-time-picker>');
      const trigger = page.root?.shadowRoot?.querySelector('md-text-field[part="trigger"]') as any;
      expect(trigger?.getAttribute('value')).toBeNull();
      expect(trigger?.value).toBe('08:05');
    });

    it('opens the dialog on trigger click', async () => {
      const page = await create('<md-time-picker></md-time-picker>');
      const trigger = page.root?.shadowRoot?.querySelector('.md-time-picker__field') as HTMLElement;
      trigger.click();
      await page.waitForChanges();
      expect(page.root?.shadowRoot?.querySelector('.md-time-picker__dialog')).toBeTruthy();
    });

    it('opens the dialog on trigger Enter key', async () => {
      const page = await create('<md-time-picker></md-time-picker>');
      const trigger = page.root?.shadowRoot?.querySelector('.md-time-picker__field') as HTMLElement;
      trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await page.waitForChanges();
      expect(page.root?.shadowRoot?.querySelector('.md-time-picker__dialog')).toBeTruthy();
    });

    it('opens the dialog on trigger Space key', async () => {
      const page = await create('<md-time-picker></md-time-picker>');
      const trigger = page.root?.shadowRoot?.querySelector('.md-time-picker__field') as HTMLElement;
      trigger.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
      await page.waitForChanges();
      expect(page.root?.shadowRoot?.querySelector('.md-time-picker__dialog')).toBeTruthy();
    });

    it('does not open when disabled', async () => {
      const page = await create('<md-time-picker disabled></md-time-picker>');
      const trigger = page.root?.shadowRoot?.querySelector('.md-time-picker__field') as HTMLElement;
      trigger.click();
      await page.waitForChanges();
      expect(page.root?.shadowRoot?.querySelector('.md-time-picker__dialog')).toBeNull();
    });

    it('reflects disabled onto the trigger text-field', async () => {
      const page = await create('<md-time-picker disabled></md-time-picker>');
      const trigger = page.root?.shadowRoot?.querySelector('md-text-field[part="trigger"]') as any;
      // md-text-field's `disabled` IS reflected, so the attribute lands
      // on the host. We rely on the attribute (not just the prop) so
      // consumers using `md-text-field[disabled]` selectors get a hit.
      expect(trigger?.hasAttribute('disabled')).toBe(true);
      expect(trigger?.disabled).toBe(true);
    });
  });

  // ───────────────────────── EVENTS ─────────────────────────
  describe('events', () => {
    it('emits mdOpen on open', async () => {
      const page = await create('<md-time-picker></md-time-picker>');
      const spy = jest.fn();
      page.root?.addEventListener('mdOpen', spy);
      (page.root?.shadowRoot?.querySelector('.md-time-picker__field') as HTMLElement).click();
      await page.waitForChanges();
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('emits mdClose when closed', async () => {
      const page = await create('<md-time-picker open></md-time-picker>');
      const spy = jest.fn();
      page.root?.addEventListener('mdClose', spy);
      const cancel = page.root?.shadowRoot?.querySelector('[part="cancel-button"]') as HTMLButtonElement;
      cancel.click();
      await page.waitForChanges();
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('emits mdCancel on cancel', async () => {
      const page = await create('<md-time-picker open value="09:15"></md-time-picker>');
      const spy = jest.fn();
      page.root?.addEventListener('mdCancel', spy);
      const cancel = page.root?.shadowRoot?.querySelector('[part="cancel-button"]') as HTMLButtonElement;
      cancel.click();
      await page.waitForChanges();
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('emits mdChange on confirm with the right payload', async () => {
      const page = await create('<md-time-picker open value="09:15" format="24h"></md-time-picker>');
      const spy = jest.fn();
      page.root?.addEventListener('mdChange', spy);
      const ok = page.root?.shadowRoot?.querySelector('[part="confirm-button"]') as HTMLButtonElement;
      ok.click();
      await page.waitForChanges();
      expect(spy).toHaveBeenCalledTimes(1);
      const detail = spy.mock.calls[0][0].detail;
      expect(detail.value).toBe('09:15');
      expect(detail.hours).toBe(9);
      expect(detail.minutes).toBe(15);
      expect(detail.period).toBe('AM');
    });

    // ── ISO / Date payload (industry-standard formats) ──
    // Verify that every emitted `mdChange` detail carries the
    // four canonical time representations: HH:MM, HH:MM:SS,
    // full ISO datetime, and a real Date. These mirror what
    // HTML <input type="time">, OpenAPI `format: time`,
    // RFC 3339, and JavaScript `Date` consumers expect.
    it('emits an ISO 8601 partial-time string (HH:MM:SS) in detail.iso', async () => {
      const page = await create('<md-time-picker open value="14:30" format="24h"></md-time-picker>');
      const spy = jest.fn();
      page.root?.addEventListener('mdChange', spy);
      (page.root?.shadowRoot?.querySelector('[part="confirm-button"]') as HTMLButtonElement).click();
      await page.waitForChanges();
      const detail = spy.mock.calls[0][0].detail;
      expect(detail.iso).toBe('14:30:00');
      // Format guard — should match `HH:MM:SS` exactly.
      expect(detail.iso).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    });

    it('emits a full RFC 3339 datetime string in detail.isoDateTime', async () => {
      const page = await create('<md-time-picker open value="14:30"></md-time-picker>');
      const spy = jest.fn();
      page.root?.addEventListener('mdChange', spy);
      (page.root?.shadowRoot?.querySelector('[part="confirm-button"]') as HTMLButtonElement).click();
      await page.waitForChanges();
      const detail = spy.mock.calls[0][0].detail;
      // `Date.prototype.toISOString` always produces `…T…Z`.
      expect(detail.isoDateTime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      // Should be parseable as a Date and round-trip cleanly.
      expect(new Date(detail.isoDateTime).getTime()).not.toBeNaN();
    });

    it('emits a JS Date in detail.date with seconds/ms zeroed', async () => {
      const page = await create('<md-time-picker open value="14:30" format="24h"></md-time-picker>');
      const spy = jest.fn();
      page.root?.addEventListener('mdChange', spy);
      (page.root?.shadowRoot?.querySelector('[part="confirm-button"]') as HTMLButtonElement).click();
      await page.waitForChanges();
      const d = spy.mock.calls[0][0].detail.date as Date;
      expect(d).toBeInstanceOf(Date);
      expect(d.getHours()).toBe(14);
      expect(d.getMinutes()).toBe(30);
      expect(d.getSeconds()).toBe(0);
      expect(d.getMilliseconds()).toBe(0);
    });

    it('keeps every detail field internally consistent (value ⇄ iso ⇄ date)', async () => {
      const page = await create('<md-time-picker open value="07:05"></md-time-picker>');
      const spy = jest.fn();
      page.root?.addEventListener('mdChange', spy);
      (page.root?.shadowRoot?.querySelector('[part="confirm-button"]') as HTMLButtonElement).click();
      await page.waitForChanges();
      const detail = spy.mock.calls[0][0].detail;
      // `iso` must be `value + ":00"`.
      expect(detail.iso).toBe(`${detail.value}:00`);
      // `date.toISOString()` must equal `isoDateTime`.
      expect((detail.date as Date).toISOString()).toBe(detail.isoDateTime);
      // The Date's local hour/minute must match the integer fields.
      expect((detail.date as Date).getHours()).toBe(detail.hours);
      expect((detail.date as Date).getMinutes()).toBe(detail.minutes);
    });

    // ── mdInput — fires for intermediate user-driven mutations ──
    // ── mdInput — fires when the user types a new value into HH/MM ──
    // Both variants now share the same typeable HH:MM input row, so
    // these tests drive the input fields directly via `input` event +
    // blur instead of the obsolete spinbutton arrow-key path.
    it('emits mdInput when the user types a new hour', async () => {
      const page = await create('<md-time-picker open value="09:15" format="24h"></md-time-picker>');
      const spy = jest.fn();
      page.root?.addEventListener('mdInput', spy);
      const hourInput = page.root?.shadowRoot?.querySelector('[part="input-hour"]') as HTMLInputElement;
      hourInput.value = '10';
      hourInput.dispatchEvent(new Event('input'));
      hourInput.dispatchEvent(new Event('blur'));
      await page.waitForChanges();
      expect(spy).toHaveBeenCalled();
      expect(spy.mock.calls[0][0].detail.hours).toBe(10);
    });

    // ── live dial tracking + immediate error feedback ──
    // Critical UX contract: with the dial visible, typing into the HH
    // input must (a) move the dial hand on every valid keystroke and
    // (b) paint the error state on every invalid keystroke. Neither
    // behavior waits for blur — the dial responds live and the error
    // hint appears the moment the buffer goes out of range.
    it('moves the draft + emits mdInput + flags errors on every keystroke — no blur required', async () => {
      const page = await create(
        '<md-time-picker open variant="dial" value="00:00" format="24h"></md-time-picker>',
      );
      const spy = jest.fn();
      page.root?.addEventListener('mdInput', spy);
      const hourInput = page.root?.shadowRoot?.querySelector(
        '[part="input-hour"]',
      ) as HTMLInputElement;
      const minuteInput = page.root?.shadowRoot?.querySelector(
        '[part="input-minute"]',
      ) as HTMLInputElement;

      // First keystroke: "5" — valid in 24h mode → dial commits and
      // any prior HH error is cleared.
      hourInput.value = '5';
      hourInput.dispatchEvent(new Event('input'));
      await page.waitForChanges();
      expect((page.rootInstance as any).draftHours).toBe(5);
      expect((page.rootInstance as any).hourInputError).toBe(false);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0].detail.hours).toBe(5);

      // Second keystroke: "50" — invalid (>23) → dial intentionally
      // HOLDS at the last valid commit (5) so the hand doesn't jitter,
      // but the HH error flag fires IMMEDIATELY (no blur required).
      hourInput.value = '50';
      hourInput.dispatchEvent(new Event('input'));
      await page.waitForChanges();
      expect((page.rootInstance as any).draftHours).toBe(5);
      expect((page.rootInstance as any).hourInputError).toBe(true);
      expect(hourInput.getAttribute('aria-invalid')).toBe('true');
      expect(spy).toHaveBeenCalledTimes(1);
      // MM was NOT just edited, so its error flag is untouched.
      expect((page.rootInstance as any).minuteInputError).toBe(false);

      // Recover to "15" — valid → dial follows live AND HH error clears
      // on the same keystroke that fixed the buffer.
      hourInput.value = '15';
      hourInput.dispatchEvent(new Event('input'));
      await page.waitForChanges();
      expect((page.rootInstance as any).draftHours).toBe(15);
      expect((page.rootInstance as any).hourInputError).toBe(false);
      expect(spy).toHaveBeenCalledTimes(2);
      expect(spy.mock.calls[1][0].detail.hours).toBe(15);

      // Typing in MM never touches the HH error flag (and vice versa).
      hourInput.value = '99'; // re-flag HH as error
      hourInput.dispatchEvent(new Event('input'));
      await page.waitForChanges();
      expect((page.rootInstance as any).hourInputError).toBe(true);
      minuteInput.value = '30';
      minuteInput.dispatchEvent(new Event('input'));
      await page.waitForChanges();
      // MM edit must not silently clear the existing HH error.
      expect((page.rootInstance as any).hourInputError).toBe(true);
      expect((page.rootInstance as any).minuteInputError).toBe(false);
    });

    it('mdInput payload shape matches mdChange payload shape', async () => {
      const page = await create('<md-time-picker open value="09:15" format="24h"></md-time-picker>');
      const inputSpy = jest.fn();
      page.root?.addEventListener('mdInput', inputSpy);
      const hourInput = page.root?.shadowRoot?.querySelector('[part="input-hour"]') as HTMLInputElement;
      hourInput.value = '10';
      hourInput.dispatchEvent(new Event('input'));
      hourInput.dispatchEvent(new Event('blur'));
      await page.waitForChanges();
      const detail = inputSpy.mock.calls[0][0].detail;
      // Same shape contract as mdChange — value, iso, isoDateTime, date, hours, minutes, period.
      expect(detail).toMatchObject({
        value: expect.any(String),
        iso: expect.any(String),
        isoDateTime: expect.any(String),
        date: expect.any(Date),
        hours: expect.any(Number),
        minutes: expect.any(Number),
        period: expect.stringMatching(/^(AM|PM)$/),
      });
    });

    it('does NOT emit mdInput when the user reopens at the same value (no movement yet)', async () => {
      const page = await create('<md-time-picker open value="09:15"></md-time-picker>');
      const spy = jest.fn();
      page.root?.addEventListener('mdInput', spy);
      await page.waitForChanges();
      // Opening the picker should not be treated as user input.
      expect(spy).not.toHaveBeenCalled();
    });

    it('de-dupes repeated mdInput emits at the same H/M (e.g. dial drag overshoot)', async () => {
      // Drive the dial directly so the de-dupe contract is independent
      // of the input-field commit cadence (which is buffered until
      // blur). The internal `emitInputIfChanged` filter is the shared
      // hot path for both drag and type-and-blur, so a single test on
      // the simpler path pins the behavior for both.
      const page = await create('<md-time-picker open variant="dial" value="09:15" format="24h"></md-time-picker>');
      const spy = jest.fn();
      page.root?.addEventListener('mdInput', spy);
      const inst = page.rootInstance;
      inst['draftHours'] = 10;
      inst['emitInputIfChanged']();
      inst['draftHours'] = 9;
      inst['emitInputIfChanged']();
      inst['draftHours'] = 8;
      inst['emitInputIfChanged']();
      // Re-emitting the same value is a no-op (drag overshoot).
      inst['emitInputIfChanged']();
      await page.waitForChanges();
      // Three distinct H values → three distinct emits; the no-op
      // repeat was swallowed by the de-dupe filter.
      expect(spy).toHaveBeenCalledTimes(3);
    });

    // ── mdModeChange — fires when the dial ⇄ input toggle is used ──
    it('emits mdModeChange with `{ mode, previousMode }` on toggle', async () => {
      const page = await create('<md-time-picker open variant="dial"></md-time-picker>');
      const spy = jest.fn();
      page.root?.addEventListener('mdModeChange', spy);
      const toggle = page.root?.shadowRoot?.querySelector('[part="toggle-mode"]') as HTMLElement;
      toggle.dispatchEvent(new CustomEvent('mdClick', { detail: new MouseEvent('click') }));
      await page.waitForChanges();
      expect(spy).toHaveBeenCalledTimes(1);
      const detail = spy.mock.calls[0][0].detail;
      expect(detail).toEqual({ mode: 'input', previousMode: 'dial' });
    });

    it('reverts to committed value on cancel', async () => {
      const page = await create('<md-time-picker open value="09:15"></md-time-picker>');
      const inst = page.rootInstance;
      // Mutate draft via internal API
      inst['draftHours'] = 22;
      inst['draftMinutes'] = 45;
      const cancel = page.root?.shadowRoot?.querySelector('[part="cancel-button"]') as HTMLButtonElement;
      cancel.click();
      await page.waitForChanges();
      expect(inst['committedHours']).toBe(9);
      expect(inst['committedMinutes']).toBe(15);
    });
  });

  // ───────────────────────── ACCESSIBILITY ─────────────────────────
  describe('accessibility', () => {
    it('marks the dialog with role=dialog and aria-modal', async () => {
      const page = await create('<md-time-picker open></md-time-picker>');
      const d = page.root?.shadowRoot?.querySelector('.md-time-picker__dialog');
      expect(d?.getAttribute('role')).toBe('dialog');
      expect(d?.getAttribute('aria-modal')).toBe('true');
    });

    it('labels the dialog via aria-labelledby (dial → "Select time")', async () => {
      const page = await create('<md-time-picker open variant="dial"></md-time-picker>');
      const d = page.root?.shadowRoot?.querySelector('.md-time-picker__dialog');
      const labelId = d?.getAttribute('aria-labelledby');
      expect(labelId).toBeTruthy();
      const headline = page.root?.shadowRoot?.querySelector(`#${labelId}`);
      expect(headline?.textContent?.toLowerCase()).toContain('select');
    });

    it('labels the dialog via aria-labelledby (input → "Enter time")', async () => {
      // The input variant uses a different default headline so the
      // dialog announces the right verb to assistive tech ("Enter"
      // instead of "Select"). aria-labelledby must still resolve.
      const page = await create('<md-time-picker open variant="input"></md-time-picker>');
      const d = page.root?.shadowRoot?.querySelector('.md-time-picker__dialog');
      const labelId = d?.getAttribute('aria-labelledby');
      expect(labelId).toBeTruthy();
      const headline = page.root?.shadowRoot?.querySelector(`#${labelId}`);
      expect(headline?.textContent?.toLowerCase()).toContain('enter');
    });

    it('HH/MM inputs expose accessible labels and numeric input mode', async () => {
      // Both variants now expose typeable HH/MM <input> fields, so the
      // ARIA contract is the standard "labelled input" pattern — not
      // the old spinbutton role. Screen readers announce each field
      // via its `aria-label`, and `inputmode="numeric"` raises the
      // numeric keypad on touch devices for the typical "type the
      // time" interaction.
      const page = await create('<md-time-picker open value="09:15"></md-time-picker>');
      const hourInput = page.root?.shadowRoot?.querySelector('[part="input-hour"]');
      const minuteInput = page.root?.shadowRoot?.querySelector('[part="input-minute"]');
      expect(hourInput?.tagName.toLowerCase()).toBe('input');
      expect(minuteInput?.tagName.toLowerCase()).toBe('input');
      expect(hourInput?.getAttribute('aria-label')).toBe('Hour');
      expect(minuteInput?.getAttribute('aria-label')).toBe('Minute');
      expect(hourInput?.getAttribute('inputmode')).toBe('numeric');
      expect(minuteInput?.getAttribute('inputmode')).toBe('numeric');
      // 2-character cap enforced by `maxlength` so a third digit
      // doesn't appear before the regex strip kicks in.
      expect(hourInput?.getAttribute('maxlength')).toBe('2');
      expect(minuteInput?.getAttribute('maxlength')).toBe('2');
    });

    it('HH/MM inputs flip aria-invalid="true" when the typed value is out of range', async () => {
      // The dial variant also surfaces validation — out-of-range
      // hour (>23 in 24h, >12 in 12h) sets aria-invalid so SR users
      // hear the error, and OK refuses to commit.
      const page = await create('<md-time-picker open format="24h" value="08:00"></md-time-picker>');
      const hourInput = page.root?.shadowRoot?.querySelector('[part="input-hour"]') as HTMLInputElement;
      hourInput.value = '99';
      hourInput.dispatchEvent(new Event('input'));
      const ok = page.root?.shadowRoot?.querySelector('[part="confirm-button"]') as HTMLButtonElement;
      ok.click();
      await page.waitForChanges();
      expect(hourInput.getAttribute('aria-invalid')).toBe('true');
    });

    it('period toggle uses role=radiogroup with role=radio children', async () => {
      const page = await create('<md-time-picker open value="14:00"></md-time-picker>');
      const group = page.root?.shadowRoot?.querySelector('[part="period-toggle"]');
      expect(group?.getAttribute('role')).toBe('radiogroup');
      const am = page.root?.shadowRoot?.querySelector('[part="period-am"]');
      const pm = page.root?.shadowRoot?.querySelector('[part="period-pm"]');
      expect(am?.getAttribute('role')).toBe('radio');
      expect(pm?.getAttribute('role')).toBe('radio');
      expect(pm?.getAttribute('aria-checked')).toBe('true');
      expect(am?.getAttribute('aria-checked')).toBe('false');
    });

    it('no period toggle in 24h format', async () => {
      const page = await create('<md-time-picker open format="24h" value="14:00"></md-time-picker>');
      expect(page.root?.shadowRoot?.querySelector('[part="period-toggle"]')).toBeNull();
    });

    it('trigger announces value via aria-label', async () => {
      const page = await create('<md-time-picker value="14:30" label="Start"></md-time-picker>');
      const trigger = page.root?.shadowRoot?.querySelector('.md-time-picker__field');
      expect(trigger?.getAttribute('aria-label')).toContain('Start');
      expect(trigger?.getAttribute('aria-label')).toContain('2:30 PM');
    });

    it('trigger announces only the label when no value', async () => {
      const page = await create('<md-time-picker label="Start"></md-time-picker>');
      const trigger = page.root?.shadowRoot?.querySelector('.md-time-picker__field');
      expect(trigger?.getAttribute('aria-label')).toBe('Start');
    });

    it('trigger exposes combobox / popup affordances', async () => {
      const page = await create('<md-time-picker></md-time-picker>');
      const trigger = page.root?.shadowRoot?.querySelector('.md-time-picker__field');
      expect(trigger?.getAttribute('aria-haspopup')).toBe('dialog');
      expect(trigger?.getAttribute('aria-expanded')).toBe('false');
    });

    it('trigger aria-expanded flips when the dialog opens', async () => {
      const page = await create('<md-time-picker open></md-time-picker>');
      const trigger = page.root?.shadowRoot?.querySelector('.md-time-picker__field');
      expect(trigger?.getAttribute('aria-expanded')).toBe('true');
    });

    // ── Trigger ↔ open-dialog visual coupling ──
    // While the dialog is open the OS focus has moved into the dialog,
    // so the trigger would normally fall back to its resting (neutral)
    // outline and read as a disconnected surface. We pass
    // `appear-focused` to the underlying md-text-field so it renders in
    // its focused look (notch open, primary outline, primary label) for
    // the duration the dialog is open. This is what visually couples
    // the trigger to the dialog. Going through md-text-field's own
    // `appear-focused` prop is what guarantees the notched-outline
    // cuts cleanly around the label — a previous attempt to paint an
    // external `box-shadow inset` on the host drew a continuous line
    // that struck through the label text.
    it('trigger gets `appear-focused` while the dialog is open', async () => {
      const page = await create('<md-time-picker open></md-time-picker>');
      const trigger = page.root?.shadowRoot?.querySelector('.md-time-picker__field');
      expect(trigger?.hasAttribute('appear-focused')).toBe(true);
    });

    it('trigger does NOT have `appear-focused` while the dialog is closed', async () => {
      const page = await create('<md-time-picker></md-time-picker>');
      const trigger = page.root?.shadowRoot?.querySelector('.md-time-picker__field');
      expect(trigger?.hasAttribute('appear-focused')).toBe(false);
    });

    it('trigger gains the .md-time-picker__field--open class while open', async () => {
      // Used by the CSS rule that re-tints the focused outline /
      // label / icon onto our `--_trigger-focus-color` token. Without
      // this class hook authors can't restyle the open-state trigger
      // independently of the resting trigger.
      const page = await create('<md-time-picker open></md-time-picker>');
      const trigger = page.root?.shadowRoot?.querySelector('.md-time-picker__field');
      expect(trigger?.classList.contains('md-time-picker__field--open')).toBe(true);
    });

    // ── MD3 accessibility-spec aria-labels ──
    // The [MD3 Time pickers accessibility spec](https://m3.material.io/components/time-pickers/accessibility)
    // pins the exact wording of each interactive element's a11y label
    // so screen-reader users get a consistent verb across MD3 surfaces
    // (Wiz, Jetpack Compose, Android Views, Web). We mirror those
    // strings as default values and expose them as localizable props.
    it('hour input has aria-label="Hour" (MD3 spec default)', async () => {
      const page = await create('<md-time-picker open></md-time-picker>');
      const hh = page.root?.shadowRoot?.querySelector('[part="input-hour"]');
      expect(hh?.getAttribute('aria-label')).toBe('Hour');
    });

    it('minute input has aria-label="Minute" (MD3 spec default)', async () => {
      const page = await create('<md-time-picker open></md-time-picker>');
      const mm = page.root?.shadowRoot?.querySelector('[part="input-minute"]');
      expect(mm?.getAttribute('aria-label')).toBe('Minute');
    });

    it('mode toggle has aria-label="Toggle dial picker" in input mode (MD3 spec default)', async () => {
      // Input variant shows the clock icon → click to switch INTO the
      // dial. MD3 spec wording for this button is the literal string
      // "Toggle dial picker".
      const page = await create('<md-time-picker open variant="input"></md-time-picker>');
      const btn = page.root?.shadowRoot?.querySelector('[part="toggle-mode"]');
      expect(btn?.getAttribute('aria-label')).toBe('Toggle dial picker');
    });

    it('mode toggle has aria-label="Toggle keyboard input" in dial mode (symmetric default)', async () => {
      // Dial variant shows the keyboard icon → click to switch INTO
      // the input. MD3 only documents the input-mode label explicitly;
      // we apply the same naming pattern to the reverse direction so
      // the toggle reads consistently no matter which mode you're in.
      const page = await create('<md-time-picker open variant="dial"></md-time-picker>');
      const btn = page.root?.shadowRoot?.querySelector('[part="toggle-mode"]');
      expect(btn?.getAttribute('aria-label')).toBe('Toggle keyboard input');
    });

    it('AM/PM radio group has aria-label="Period" (radiogroup container name)', async () => {
      const page = await create('<md-time-picker open value="03:00"></md-time-picker>');
      const group = page.root?.shadowRoot?.querySelector('[part="period-toggle"]');
      expect(group?.getAttribute('aria-label')).toBe('Period');
    });

    // ── Localized overrides of every a11y label ──
    // Each of the spec-aligned labels above is exposed as a `*-label`
    // attribute so production deployments can localize them without
    // patching the shadow DOM.
    it('respects custom aria-labels via hour-label / minute-label / toggle-dial-label / toggle-input-label / period-label', async () => {
      const page = await create(
        `<md-time-picker
            open
            value="03:00"
            hour-label="Heure"
            minute-label="Minute"
            toggle-dial-label="Basculer vers le cadran"
            toggle-input-label="Basculer vers le clavier"
            period-label="Période"
          ></md-time-picker>`,
      );
      const root = page.root?.shadowRoot;
      expect(root?.querySelector('[part="input-hour"]')?.getAttribute('aria-label')).toBe('Heure');
      expect(root?.querySelector('[part="input-minute"]')?.getAttribute('aria-label')).toBe('Minute');
      expect(root?.querySelector('[part="period-toggle"]')?.getAttribute('aria-label')).toBe('Période');
      // Default is input variant → clock icon → toggleDialLabel applies.
      expect(root?.querySelector('[part="toggle-mode"]')?.getAttribute('aria-label')).toBe(
        'Basculer vers le cadran',
      );
      // Flip to dial mode and re-read — now the toggleInputLabel applies.
      (page.rootInstance as any).mode = 'dial';
      await page.waitForChanges();
      expect(page.root?.shadowRoot?.querySelector('[part="toggle-mode"]')?.getAttribute('aria-label')).toBe(
        'Basculer vers le clavier',
      );
    });
  });

  // ───────────────────────── KEYBOARD (HH/MM INPUTS) ─────────────────────────
  // Both variants share the same typeable HH/MM inputs, so the
  // keyboard contract is now the standard text-input one: type to
  // edit, Tab to move between fields, Enter to commit. Arrow keys
  // are delegated to the browser's native caret navigation; spec
  // arrow-key handling (the old spinbutton contract) is intentionally
  // gone because typing the value is faster and more accessible.
  describe('keyboard (HH/MM inputs)', () => {
    it('focusing the hour input flips `selecting` to "hour"', async () => {
      const page = await create('<md-time-picker open value="03:00"></md-time-picker>');
      const inst = page.rootInstance;
      inst['selecting'] = 'minute';
      const hourInput = page.root?.shadowRoot?.querySelector('[part="input-hour"]') as HTMLElement;
      hourInput.dispatchEvent(new Event('focus'));
      await page.waitForChanges();
      expect(inst['selecting']).toBe('hour');
    });

    it('focusing the minute input flips `selecting` to "minute"', async () => {
      const page = await create('<md-time-picker open value="03:00"></md-time-picker>');
      const inst = page.rootInstance;
      const minuteInput = page.root?.shadowRoot?.querySelector('[part="input-minute"]') as HTMLElement;
      minuteInput.dispatchEvent(new Event('focus'));
      await page.waitForChanges();
      expect(inst['selecting']).toBe('minute');
    });

    // ── bidirectional dial ⇄ input sync ──
    // The dial and the typeable HH/MM inputs share a single source of
    // truth (`draftHours` / `draftMinutes`). The input → dial direction
    // is covered above; these pin the dial → input direction so a drag
    // (or AM/PM toggle) on the dial side updates the input row too.
    describe('dial → input sync', () => {
      it('dial-driven draft change rewrites the HH/MM input fields', async () => {
        const page = await create(
          '<md-time-picker open variant="dial" value="03:30" format="24h"></md-time-picker>',
        );
        const inst = page.rootInstance;
        const hourInput = page.root?.shadowRoot?.querySelector('[part="input-hour"]') as HTMLInputElement;
        const minuteInput = page.root?.shadowRoot?.querySelector('[part="input-minute"]') as HTMLInputElement;

        // Pre-flight: inputs reflect the seeded value.
        expect(hourInput.value).toBe('3');
        expect(minuteInput.value).toBe('30');

        // Simulate the dial committing a new value (e.g. user dragged
        // to 17:45). We bypass the pointer math here — `applyDialPointer`
        // depends on real DOM bounding rects — and call the sync helper
        // directly, which is the same code path that every pointer
        // event terminates in.
        inst['draftHours'] = 17;
        inst['draftMinutes'] = 45;
        inst['syncInputsFromDraft']();
        await page.waitForChanges();

        expect(hourInput.value).toBe('17');
        expect(minuteInput.value).toBe('45');
        expect(inst['hourInputValue']).toBe('17');
        expect(inst['minuteInputValue']).toBe('45');
      });

      it('dial sync clears stale error flags (dial-derived values are always in range)', async () => {
        const page = await create(
          '<md-time-picker open variant="dial" value="03:30" format="24h"></md-time-picker>',
        );
        const inst = page.rootInstance;
        const hourInput = page.root?.shadowRoot?.querySelector('[part="input-hour"]') as HTMLInputElement;

        // First put HH into an error state by typing something invalid.
        hourInput.value = '99';
        hourInput.dispatchEvent(new Event('input'));
        await page.waitForChanges();
        expect(inst['hourInputError']).toBe(true);

        // Now the user reaches for the dial and drags to a real hour.
        // The dial sync MUST clear the stale "99 was bad" error so the
        // input doesn't keep painting red after the user fixed the
        // value via the dial side.
        inst['draftHours'] = 9;
        inst['syncInputsFromDraft']();
        await page.waitForChanges();

        expect(inst['hourInputError']).toBe(false);
        expect(hourInput.value).toBe('9');
      });

      it('12h-mode display-hour formatting is honored when syncing from the dial', async () => {
        // 17:00 in 12h mode shows "5" + "PM", not "17".
        const page = await create(
          '<md-time-picker open variant="dial" value="03:00" format="12h"></md-time-picker>',
        );
        const inst = page.rootInstance;
        const hourInput = page.root?.shadowRoot?.querySelector('[part="input-hour"]') as HTMLInputElement;
        inst['draftHours'] = 17;
        inst['syncInputsFromDraft']();
        await page.waitForChanges();
        expect(hourInput.value).toBe('5');
      });

      it('releasing an hour-drag on the dial moves keyboard focus to the MM input', async () => {
        // Stencil's mock DOM doesn't fully track shadow-root
        // activeElement, so instead of asserting on `activeElement`
        // we spy on the MM input's `focus()` method — that's the
        // operation we actually want pinned. End-to-end browser
        // focus is covered by the e2e suite, where activeElement
        // is real.
        const page = await create(
          '<md-time-picker open variant="dial" value="03:30" format="24h"></md-time-picker>',
        );
        const inst = page.rootInstance;
        const minuteInput = page.root?.shadowRoot?.querySelector(
          '[part="input-minute"]',
        ) as HTMLInputElement;
        const focusSpy = jest.spyOn(minuteInput, 'focus');

        // Simulate a dial drag: pointerdown puts us in dragging
        // mode, pointerup commits the hour and should auto-flip
        // selecting → 'minute' AND push focus into the MM input.
        inst['isDragging'] = true;
        inst['selecting'] = 'hour';
        inst['onDialPointerUp'](new Event('pointerup') as any);
        // The focus call is deferred in a rAF so the input has
        // already re-rendered with the `--active` class. The mock
        // polyfills rAF as a setTimeout(0)-ish microtask, so a
        // single tick is enough to flush it.
        await new Promise((r) => setTimeout(r, 20));
        await page.waitForChanges();

        expect(inst['selecting']).toBe('minute');
        expect(focusSpy).toHaveBeenCalled();
      });

      it('AM/PM toggle clears any stale HH error (period change is a dial-side action)', async () => {
        const page = await create(
          '<md-time-picker open value="03:00"></md-time-picker>',
        );
        const inst = page.rootInstance;
        const hourInput = page.root?.shadowRoot?.querySelector('[part="input-hour"]') as HTMLInputElement;
        // Paint the error.
        hourInput.value = '99';
        hourInput.dispatchEvent(new Event('input'));
        await page.waitForChanges();
        expect(inst['hourInputError']).toBe(true);
        // Click PM — the period flip re-syncs the inputs and clears
        // the stale error since the dial-side value is in range.
        const pm = page.root?.shadowRoot?.querySelector('[part="period-pm"]') as HTMLButtonElement;
        pm.click();
        await page.waitForChanges();
        expect(inst['hourInputError']).toBe(false);
        expect(hourInput.value).toBe('3'); // 3 PM still shows "3"
      });
    });

    it('Enter on an input commits the current value and closes the dialog', async () => {
      const page = await create('<md-time-picker open format="24h" value="00:00"></md-time-picker>');
      const hourInput = page.root?.shadowRoot?.querySelector('[part="input-hour"]') as HTMLInputElement;
      const minuteInput = page.root?.shadowRoot?.querySelector('[part="input-minute"]') as HTMLInputElement;
      hourInput.value = '14';
      hourInput.dispatchEvent(new Event('input'));
      minuteInput.value = '45';
      minuteInput.dispatchEvent(new Event('input'));
      const spy = jest.fn();
      page.root?.addEventListener('mdChange', spy);
      hourInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      await page.waitForChanges();
      expect(spy).toHaveBeenCalled();
      expect(spy.mock.calls[0][0].detail.value).toBe('14:45');
    });

    // ── ArrowUp / ArrowDown on the HH/MM inputs ──
    // The native `<input type="time">` and the WAI-ARIA spinbutton
    // pattern both ship vertical-arrow increments. We mirror that
    // on our typeable HH/MM tiles so screen-reader users on
    // Win+NVDA / VoiceOver get the expected step behaviour, and so
    // sighted users editing a time without the mouse never reach
    // for the dial.
    describe('ArrowUp / ArrowDown on the HH/MM inputs', () => {
      it('ArrowUp on the HOUR input bumps the hour by 1 (24h, no wrap)', async () => {
        const page = await create('<md-time-picker open format="24h" value="10:00"></md-time-picker>');
        const hh = page.root?.shadowRoot?.querySelector('[part="input-hour"]') as HTMLInputElement;
        hh.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
        await page.waitForChanges();
        expect(hh.value).toBe('11');
      });

      it('ArrowDown on the HOUR input bumps the hour by -1 (24h, no wrap)', async () => {
        const page = await create('<md-time-picker open format="24h" value="10:00"></md-time-picker>');
        const hh = page.root?.shadowRoot?.querySelector('[part="input-hour"]') as HTMLInputElement;
        hh.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
        await page.waitForChanges();
        expect(hh.value).toBe('9');
      });

      it('ArrowUp on HOUR wraps 23→0 in 24h format', async () => {
        const page = await create('<md-time-picker open format="24h" value="23:00"></md-time-picker>');
        const hh = page.root?.shadowRoot?.querySelector('[part="input-hour"]') as HTMLInputElement;
        hh.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
        await page.waitForChanges();
        expect(hh.value).toBe('0');
      });

      it('ArrowDown on HOUR wraps 0→23 in 24h format', async () => {
        const page = await create('<md-time-picker open format="24h" value="00:00"></md-time-picker>');
        const hh = page.root?.shadowRoot?.querySelector('[part="input-hour"]') as HTMLInputElement;
        hh.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
        await page.waitForChanges();
        expect(hh.value).toBe('23');
      });

      it('ArrowUp on HOUR in 12h wraps 12→1 WITHOUT flipping the period', async () => {
        // Critical: in 12h the hour cycler operates in display-hour
        // space (1..12). The user flips AM/PM with the dedicated
        // period pill — the hour cycler must not silently fight
        // them by flipping period under them every 12 hours.
        const page = await create('<md-time-picker open format="12h" value="11:30"></md-time-picker>');
        const inst = page.rootInstance;
        const hh = page.root?.shadowRoot?.querySelector('[part="input-hour"]') as HTMLInputElement;
        // 11 AM → 12 (still AM, since 12 AM === 00:30 internally)
        hh.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
        await page.waitForChanges();
        expect(hh.value).toBe('12');
        // 12 AM → 1 AM (display wraps but period stays AM)
        hh.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
        await page.waitForChanges();
        expect(hh.value).toBe('1');
        expect(inst['period']).toBe('AM');
      });

      it('ArrowDown on HOUR in 12h wraps 1→12 WITHOUT flipping the period', async () => {
        const page = await create('<md-time-picker open format="12h" value="13:30"></md-time-picker>');
        const inst = page.rootInstance;
        const hh = page.root?.shadowRoot?.querySelector('[part="input-hour"]') as HTMLInputElement;
        // 1 PM → 12 (period stays PM)
        hh.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
        await page.waitForChanges();
        expect(hh.value).toBe('12');
        expect(inst['period']).toBe('PM');
      });

      it('ArrowUp on the MINUTE input bumps minutes by 1 (default step)', async () => {
        const page = await create('<md-time-picker open format="24h" value="10:30"></md-time-picker>');
        const mm = page.root?.shadowRoot?.querySelector('[part="input-minute"]') as HTMLInputElement;
        mm.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
        await page.waitForChanges();
        expect(mm.value).toBe('31');
      });

      it('ArrowUp on MINUTE wraps 59→0', async () => {
        const page = await create('<md-time-picker open format="24h" value="10:59"></md-time-picker>');
        const mm = page.root?.shadowRoot?.querySelector('[part="input-minute"]') as HTMLInputElement;
        mm.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
        await page.waitForChanges();
        expect(mm.value).toBe('00');
      });

      it('ArrowDown on MINUTE wraps 0→(60 - step)', async () => {
        const page = await create('<md-time-picker open format="24h" value="10:00"></md-time-picker>');
        const mm = page.root?.shadowRoot?.querySelector('[part="input-minute"]') as HTMLInputElement;
        mm.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
        await page.waitForChanges();
        expect(mm.value).toBe('59');
      });

      it('honours minute-step when bumping with ArrowUp / ArrowDown', async () => {
        const page = await create('<md-time-picker open format="24h" value="10:00" minute-step="5"></md-time-picker>');
        const mm = page.root?.shadowRoot?.querySelector('[part="input-minute"]') as HTMLInputElement;
        mm.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
        await page.waitForChanges();
        expect(mm.value).toBe('05');
        mm.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
        await page.waitForChanges();
        expect(mm.value).toBe('10');
      });

      it('snaps an off-step minute value to the step grid before bumping', async () => {
        // User typed "07" with step=5 → next ArrowUp lands on the
        // nearest-on-grid next step ("10"), not "12". Prevents the
        // input from drifting off the dial's snap grid.
        const page = await create('<md-time-picker open format="24h" value="10:07" minute-step="5"></md-time-picker>');
        const mm = page.root?.shadowRoot?.querySelector('[part="input-minute"]') as HTMLInputElement;
        mm.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
        await page.waitForChanges();
        expect(mm.value).toBe('10');
      });

      it('clears the field error flag (new value is definitionally valid)', async () => {
        // Type an out-of-range value to set the error flag, then
        // press ArrowUp — the bumper resolves to a valid value, so
        // the error must clear on the same tick.
        const page = await create('<md-time-picker open format="24h" value="10:00"></md-time-picker>');
        const inst = page.rootInstance;
        const hh = page.root?.shadowRoot?.querySelector('[part="input-hour"]') as HTMLInputElement;
        hh.value = '99';
        hh.dispatchEvent(new Event('input'));
        await page.waitForChanges();
        expect(inst['hourInputError']).toBe(true);
        hh.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
        await page.waitForChanges();
        expect(inst['hourInputError']).toBe(false);
      });

      it('emits `mdInput` on each arrow press', async () => {
        const page = await create('<md-time-picker open format="24h" value="10:00"></md-time-picker>');
        const hh = page.root?.shadowRoot?.querySelector('[part="input-hour"]') as HTMLInputElement;
        const spy = jest.fn();
        page.root?.addEventListener('mdInput', spy);
        hh.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
        await page.waitForChanges();
        expect(spy).toHaveBeenCalled();
        expect(spy.mock.calls[0][0].detail.hours).toBe(11);
      });

      it('moves the dial hand in sync with the input bump', async () => {
        // The dial and the inputs are bound to the same `draftHours`
        // / `draftMinutes` state, so a keyboard bump on the input
        // must update the draft in the same render pass — otherwise
        // the dial visibly stalls one frame behind the typed value.
        const page = await create('<md-time-picker open variant="dial" format="24h" value="10:30"></md-time-picker>');
        const inst = page.rootInstance;
        const mm = page.root?.shadowRoot?.querySelector('[part="input-minute"]') as HTMLInputElement;
        mm.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
        await page.waitForChanges();
        expect(inst['draftMinutes']).toBe(31);
      });
    });
  });

  // ───────────────────────── MODE TOGGLE ─────────────────────────
  describe('mode toggle', () => {
    it('switches between dial and input', async () => {
      const page = await create('<md-time-picker open variant="dial"></md-time-picker>');
      expect(page.root?.shadowRoot?.querySelector('[part="dial"]')).toBeTruthy();
      const toggle = page.root?.shadowRoot?.querySelector('[part="toggle-mode"]') as HTMLButtonElement;
      toggle.click();
      await page.waitForChanges();
      expect(page.root?.shadowRoot?.querySelector('[part="input-hour"]')).toBeTruthy();
      toggle.click();
      await page.waitForChanges();
      expect(page.root?.shadowRoot?.querySelector('[part="dial"]')).toBeTruthy();
    });
  });

  // ───────────────────────── INPUT MODE ─────────────────────────
  describe('input mode', () => {
    it('commits valid input on confirm', async () => {
      const page = await create('<md-time-picker open variant="input" value="00:00" format="24h"></md-time-picker>');
      const hourInput = page.root?.shadowRoot?.querySelector('[part="input-hour"]') as HTMLInputElement;
      const minuteInput = page.root?.shadowRoot?.querySelector('[part="input-minute"]') as HTMLInputElement;
      hourInput.value = '23';
      hourInput.dispatchEvent(new Event('input'));
      minuteInput.value = '45';
      minuteInput.dispatchEvent(new Event('input'));
      await page.waitForChanges();
      const ok = page.root?.shadowRoot?.querySelector('[part="confirm-button"]') as HTMLButtonElement;
      const spy = jest.fn();
      page.root?.addEventListener('mdChange', spy);
      ok.click();
      await page.waitForChanges();
      expect(spy).toHaveBeenCalled();
      expect(spy.mock.calls[0][0].detail.value).toBe('23:45');
    });

    it('flags invalid input and does not confirm', async () => {
      const page = await create('<md-time-picker open variant="input" value="00:00" format="24h"></md-time-picker>');
      const hourInput = page.root?.shadowRoot?.querySelector('[part="input-hour"]') as HTMLInputElement;
      hourInput.value = '99';
      hourInput.dispatchEvent(new Event('input'));
      await page.waitForChanges();
      const ok = page.root?.shadowRoot?.querySelector('[part="confirm-button"]') as HTMLButtonElement;
      const spy = jest.fn();
      page.root?.addEventListener('mdChange', spy);
      ok.click();
      await page.waitForChanges();
      expect(spy).not.toHaveBeenCalled();
      expect(hourInput.getAttribute('aria-invalid')).toBe('true');
    });

    it('rejects non-numeric characters', async () => {
      const page = await create('<md-time-picker open variant="input" value="00:00"></md-time-picker>');
      const hourInput = page.root?.shadowRoot?.querySelector('[part="input-hour"]') as HTMLInputElement;
      hourInput.value = '1abc2';
      hourInput.dispatchEvent(new Event('input'));
      await page.waitForChanges();
      expect(page.rootInstance['hourInputValue']).toBe('12');
    });
  });

  // ───────────────────────── DIAL DRAW ─────────────────────────
  // Dial geometry only renders in the dial variant — the input
  // variant intentionally has no clock face. Every test in this
  // block opens the picker with `variant="dial"` to pin that
  // behavior independently of the component's default variant.
  describe('dial draw', () => {
    it('renders 12 numbers for 12h hour selection', async () => {
      const page = await create('<md-time-picker open variant="dial" value="03:00" format="12h"></md-time-picker>');
      const nums = page.root?.shadowRoot?.querySelectorAll('.md-time-picker__dial-number');
      expect(nums?.length).toBe(12);
    });

    it('renders 24 numbers for 24h hour selection', async () => {
      const page = await create('<md-time-picker open variant="dial" value="03:00" format="24h"></md-time-picker>');
      const nums = page.root?.shadowRoot?.querySelectorAll('.md-time-picker__dial-number');
      expect(nums?.length).toBe(24);
    });

    it('renders 12 minute markers (every 5) for minute selection', async () => {
      // Focusing the minute input flips `selecting` to "minute" so
      // the dial swaps from the hour ring to the 12-marker minute ring.
      const page = await create('<md-time-picker open variant="dial" value="03:00"></md-time-picker>');
      const minuteInput = page.root?.shadowRoot?.querySelector('[part="input-minute"]') as HTMLElement;
      minuteInput.dispatchEvent(new Event('focus'));
      await page.waitForChanges();
      const nums = page.root?.shadowRoot?.querySelectorAll('.md-time-picker__dial-number');
      expect(nums?.length).toBe(12);
    });

    it('marks the active hour number', async () => {
      const page = await create('<md-time-picker open variant="dial" value="03:00" format="12h"></md-time-picker>');
      const active = page.root?.shadowRoot?.querySelector('.md-time-picker__dial-number--active');
      expect(active?.textContent).toBe('3');
    });
  });

  // ───────────────────────── PARTS ─────────────────────────
  describe('parts', () => {
    it('exposes the variant-agnostic structural parts', async () => {
      // These parts wrap the dialog chrome that's present in BOTH
      // variants — trigger, dialog frame, headline, footer toggle
      // and action buttons.
      const page = await create('<md-time-picker open></md-time-picker>');
      const shadow = page.root?.shadowRoot;
      [
        'trigger',
        'dialog',
        'headline',
        'footer',
        'toggle-mode',
        'actions',
        'cancel-button',
        'confirm-button',
      ].forEach((part) => {
        expect(shadow?.querySelector(`[part="${part}"]`)).toBeTruthy();
      });
    });

    it('exposes the dial-only parts when variant="dial"', async () => {
      // Dial variant adds the clock face (`dial`, `dial-wrap`) and
      // the wrapping `time-area` underneath which the typeable HH/MM
      // input row sits. The HH/MM tiles themselves are <input>
      // elements that expose `input-hour` / `input-minute` — see the
      // shared-parts test below.
      const page = await create('<md-time-picker open variant="dial"></md-time-picker>');
      const shadow = page.root?.shadowRoot;
      ['time-area', 'dial-wrap', 'dial'].forEach((part) => {
        expect(shadow?.querySelector(`[part="${part}"]`)).toBeTruthy();
      });
    });

    it('exposes the shared HH/MM input parts in BOTH variants', async () => {
      // Both variants render the same typeable HH/MM input row, so
      // `input-area`, `input-hour` and `input-minute` MUST resolve
      // regardless of `variant`. Consumers that style the field
      // bezel / error ring write a single rule that applies to both.
      for (const variant of ['dial', 'input'] as const) {
        const page = await create(`<md-time-picker open variant="${variant}"></md-time-picker>`);
        const shadow = page.root?.shadowRoot;
        for (const part of ['input-area', 'input-hour', 'input-minute']) {
          expect(shadow?.querySelector(`[part="${part}"]`)).toBeTruthy();
        }
      }
    });

    it('does NOT expose the input-only `dial` / `dial-wrap` parts when variant="input"', async () => {
      // The input variant has no clock face, so the dial-only parts
      // MUST stay absent — surfacing them as empty hooks would let
      // consumers write CSS that visually breaks without warning.
      const page = await create('<md-time-picker open variant="input"></md-time-picker>');
      const shadow = page.root?.shadowRoot;
      expect(shadow?.querySelector('[part="dial"]')).toBeNull();
      expect(shadow?.querySelector('[part="dial-wrap"]')).toBeNull();
      expect(shadow?.querySelector('[part="time-area"]')).toBeNull();
    });
  });

  // ───────────────────────── PERIOD ─────────────────────────
  describe('period toggle', () => {
    it('toggles AM to PM shifts hours by +12', async () => {
      const page = await create('<md-time-picker open value="03:00"></md-time-picker>');
      const pm = page.root?.shadowRoot?.querySelector('[part="period-pm"]') as HTMLButtonElement;
      pm.click();
      await page.waitForChanges();
      expect(page.rootInstance['draftHours']).toBe(15);
    });

    it('toggles PM to AM shifts hours by -12', async () => {
      const page = await create('<md-time-picker open value="15:00"></md-time-picker>');
      const am = page.root?.shadowRoot?.querySelector('[part="period-am"]') as HTMLButtonElement;
      am.click();
      await page.waitForChanges();
      expect(page.rootInstance['draftHours']).toBe(3);
    });

    it('does not toggle period in 24h mode', async () => {
      const page = await create('<md-time-picker open format="24h" value="03:00"></md-time-picker>');
      expect(page.root?.shadowRoot?.querySelector('[part="period-am"]')).toBeNull();
    });

    // ── WAI-ARIA radiogroup keyboard pattern ──
    // The period toggle is a roving-tabindex radio group: only the
    // *checked* radio is tabbable, the other is tabindex=-1. That
    // is correct per the WAI-ARIA Authoring Practices, but it makes
    // the second radio unreachable unless the group ALSO handles
    // arrow / Home / End keys. Before this contract was wired, Tab
    // appeared to "skip" PM straight to the footer keyboard-toggle
    // icon — these tests pin the fix.
    describe('keyboard (WAI-ARIA radiogroup pattern)', () => {
      function getGroup(page: any) {
        return page.root?.shadowRoot?.querySelector('[part="period-toggle"]') as HTMLElement;
      }
      function getAm(page: any) {
        return page.root?.shadowRoot?.querySelector('[part="period-am"]') as HTMLButtonElement;
      }
      function getPm(page: any) {
        return page.root?.shadowRoot?.querySelector('[part="period-pm"]') as HTMLButtonElement;
      }

      it('ArrowRight on AM toggles to PM and shifts hours by +12', async () => {
        const page = await create('<md-time-picker open value="03:00"></md-time-picker>');
        getGroup(page).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
        await page.waitForChanges();
        expect(page.rootInstance['draftHours']).toBe(15);
        expect(getPm(page).getAttribute('aria-checked')).toBe('true');
        expect(getAm(page).getAttribute('aria-checked')).toBe('false');
      });

      it('ArrowLeft on PM toggles back to AM and shifts hours by -12', async () => {
        const page = await create('<md-time-picker open value="15:00"></md-time-picker>');
        getGroup(page).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
        await page.waitForChanges();
        expect(page.rootInstance['draftHours']).toBe(3);
        expect(getAm(page).getAttribute('aria-checked')).toBe('true');
      });

      it('ArrowDown / ArrowUp also navigate (period toggle works on both axes)', async () => {
        const page = await create('<md-time-picker open value="03:00"></md-time-picker>');
        getGroup(page).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
        await page.waitForChanges();
        expect(page.rootInstance['draftHours']).toBe(15);
        getGroup(page).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
        await page.waitForChanges();
        expect(page.rootInstance['draftHours']).toBe(3);
      });

      it('Home selects AM, End selects PM (regardless of current)', async () => {
        const page = await create('<md-time-picker open value="03:00"></md-time-picker>');
        getGroup(page).dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
        await page.waitForChanges();
        expect(page.rootInstance['draftHours']).toBe(15);
        getGroup(page).dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
        await page.waitForChanges();
        expect(page.rootInstance['draftHours']).toBe(3);
      });

      it('Space on the already-checked radio is a no-op (HTML radio semantics)', async () => {
        const page = await create('<md-time-picker open value="03:00"></md-time-picker>');
        const spy = jest.fn();
        page.root?.addEventListener('mdInput', spy);
        getGroup(page).dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
        await page.waitForChanges();
        expect(page.rootInstance['draftHours']).toBe(3);
        expect(spy).not.toHaveBeenCalled();
      });

      it('roving tabindex: only the checked radio is tabbable (the other is tabindex=-1)', async () => {
        const page = await create('<md-time-picker open value="03:00"></md-time-picker>');
        expect(getAm(page).getAttribute('tabindex')).toBe('0');
        expect(getPm(page).getAttribute('tabindex')).toBe('-1');
        // Flip the period and re-check that the tab-stop migrates.
        getGroup(page).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
        await page.waitForChanges();
        expect(getAm(page).getAttribute('tabindex')).toBe('-1');
        expect(getPm(page).getAttribute('tabindex')).toBe('0');
      });

      it('arrow keys are ignored in 24h mode (group is not rendered)', async () => {
        const page = await create('<md-time-picker open format="24h" value="03:00"></md-time-picker>');
        expect(page.root?.shadowRoot?.querySelector('[part="period-toggle"]')).toBeNull();
        expect(page.rootInstance['draftHours']).toBe(3);
      });
    });
  });

  // ───────────────────────── ORIENTATION ─────────────────────────
  describe('orientation (horizontal landscape dialog)', () => {
    /* The `orientation` prop only changes layout — it doesn't touch the
       state machine — so these tests focus on the structural shape of
       the rendered tree. Pixel-level geometry is owned by the e2e
       suite, where a real browser can measure column gaps and tile
       offsets. */

    it('adds the dialog--horizontal modifier and a body wrapper', async () => {
      const page = await create('<md-time-picker open variant="dial" orientation="horizontal" value="07:00"></md-time-picker>');
      const dialog = page.root?.shadowRoot?.querySelector('[part="dialog"]');
      const body = page.root?.shadowRoot?.querySelector('[part="body"]');
      const timeArea = page.root?.shadowRoot?.querySelector('[part="time-area"]');
      expect(dialog?.classList.contains('md-time-picker__dialog--horizontal')).toBe(true);
      expect(dialog?.classList.contains('md-time-picker__dialog--vertical')).toBe(false);
      expect(body?.classList.contains('md-time-picker__body--horizontal')).toBe(true);
      expect(timeArea).toBeTruthy();
    });

    it('forces the AM/PM pill into the horizontal layout even when period-layout="vertical"', async () => {
      // The author asked for the vertical 52×80 pill, but the
      // horizontal dialog has no inline-end gutter to host it, so the
      // component falls back to the 216×38 horizontal pill below HH:MM.
      const page = await create(
        '<md-time-picker open variant="dial" orientation="horizontal" period-layout="vertical" format="12h" value="07:00"></md-time-picker>'
      );
      const period = page.root?.shadowRoot?.querySelector('[part="period-toggle"]');
      expect(period?.classList.contains('md-time-picker__period--horizontal')).toBe(true);
      expect(period?.classList.contains('md-time-picker__period--vertical')).toBe(false);
      // The pill also moves out of the inputs row — in the horizontal
      // layout it sits in the time-area as a sibling BELOW the HH:MM
      // input-area, not inside it.
      const inputArea = page.root?.shadowRoot?.querySelector('[part="input-area"]');
      expect(inputArea?.querySelector('[part="period-toggle"]')).toBeFalsy();
      const timeArea = page.root?.shadowRoot?.querySelector('[part="time-area"]');
      expect(timeArea?.querySelector('[part="period-toggle"]')).toBeTruthy();
    });

    it('ignores orientation="horizontal" on the input variant', async () => {
      // The input variant has no dial to balance against, so the
      // landscape modifier MUST NOT be applied — otherwise the
      // dialog would stretch awkwardly to 572px with empty space
      // where the dial would normally sit.
      const page = await create(
        '<md-time-picker open variant="input" orientation="horizontal" value="14:30"></md-time-picker>'
      );
      const dialog = page.root?.shadowRoot?.querySelector('[part="dialog"]');
      expect(dialog?.classList.contains('md-time-picker__dialog--horizontal')).toBe(false);
      expect(dialog?.classList.contains('md-time-picker__dialog--input')).toBe(true);
    });

    it('exposes the body and time-area as CSS parts', async () => {
      const page = await create('<md-time-picker open variant="dial" orientation="horizontal" value="07:00"></md-time-picker>');
      const shadow = page.root?.shadowRoot;
      expect(shadow?.querySelector('[part="body"]')).toBeTruthy();
      expect(shadow?.querySelector('[part="time-area"]')).toBeTruthy();
    });
  });

  // ───────────────────────── 12H ↔ 24H CONVERSION ─────────────────────────
  describe('12h ↔ 24h conversion', () => {
    it('treats midnight as 12:00 AM in 12h mode', async () => {
      const page = await create('<md-time-picker value="00:00"></md-time-picker>');
      const trigger = page.root?.shadowRoot?.querySelector('md-text-field[part="trigger"]') as any;
      expect(trigger?.value).toBe('12:00 AM');
    });

    it('treats noon as 12:00 PM in 12h mode', async () => {
      const page = await create('<md-time-picker value="12:00"></md-time-picker>');
      const trigger = page.root?.shadowRoot?.querySelector('md-text-field[part="trigger"]') as any;
      expect(trigger?.value).toBe('12:00 PM');
    });
  });

  // ───────────────────────── RTL ─────────────────────────
  // The clock dial is a GEOMETRIC face that must not mirror in RTL
  // contexts — clock faces have no RTL variant (real wristwatches
  // don't mirror in Arabic / Hebrew / Farsi locales, and the Google
  // Material Components Android reference implementation positions
  // dial numbers physically). These specs pin the implementation
  // choice that backs that behaviour: every dial number is rendered
  // with PHYSICAL `left` / `top`, not logical `inset-inline-start` /
  // `inset-block-start`. Together with the physical hand transforms
  // this keeps the handle on top of the active number in both LTR
  // and RTL — see `md-time-picker.e2e.ts > RTL` for the visual
  // assertions backed by real layout.
  describe('RTL', () => {
    it('renders inside dir=rtl without errors', async () => {
      const page = await newSpecPage({
        components: [MdTimePicker, MdTextField],
        html: '<div dir="rtl"><md-time-picker open></md-time-picker></div>',
      });
      expect(page.root).toBeTruthy();
      expect(page.body.querySelector('md-time-picker')?.shadowRoot?.querySelector('.md-time-picker__dialog')).toBeTruthy();
    });

    it('positions every dial number with physical left/top (not inset-inline)', async () => {
      // Pin the IR — `renderDialNumber` must serialize physical
      // properties on every number so layout cannot mirror under
      // `direction: rtl`. A logical regression here would silently
      // flip the dial face away from the (physical) hand and put
      // the handle on the wrong side. Dial-only — the input variant
      // has no dial face.
      const page = await create('<md-time-picker open variant="dial"></md-time-picker>');
      const numbers = Array.from(
        page.root?.shadowRoot?.querySelectorAll('.md-time-picker__dial-number') ?? [],
      );
      expect(numbers.length).toBeGreaterThan(0);
      for (const n of numbers) {
        const style = (n as HTMLElement).getAttribute('style') ?? '';
        expect(style).toMatch(/left:\s*[\d.]+%/);
        expect(style).toMatch(/top:\s*[\d.]+%/);
        expect(style).not.toMatch(/inset-inline/);
        expect(style).not.toMatch(/inset-block/);
      }
    });

    it('renders the same DOM serialization in dir=ltr and dir=rtl (dial geometry is physical)', async () => {
      // Compare the inline-style strings for every dial number across
      // LTR and RTL contexts. They must match: `left: 70%` does not
      // depend on inherited direction.
      const ltr = await newSpecPage({
        components: [MdTimePicker, MdTextField],
        html: '<md-time-picker open variant="dial" value="00:00"></md-time-picker>',
      });
      const rtl = await newSpecPage({
        components: [MdTimePicker, MdTextField],
        html: '<div dir="rtl"><md-time-picker open variant="dial" value="00:00"></md-time-picker></div>',
      });

      const collect = (root: ShadowRoot | null | undefined) =>
        Array.from(root?.querySelectorAll('.md-time-picker__dial-number') ?? []).map((n) => ({
          value: (n as HTMLElement).getAttribute('data-value'),
          style: (n as HTMLElement).getAttribute('style'),
        }));

      const ltrNums = collect(ltr.root?.shadowRoot);
      const rtlNums = collect(
        rtl.body.querySelector('md-time-picker')?.shadowRoot,
      );
      expect(ltrNums.length).toBe(rtlNums.length);
      for (const l of ltrNums) {
        const r = rtlNums.find((n) => n.value === l.value);
        expect(r).toBeDefined();
        expect(r!.style).toBe(l.style);
      }
    });
  });

  // ───────────────────────── ADAPTIVE RESPONSIVE ─────────────────────────
  // The `responsive` prop opts into the MD3 adaptive-design policy
  // (input fallback on short viewports, landscape promotion on
  // wide ones). The visual / resize behavior is exercised by the
  // Puppeteer suite where the viewport is real — these spec tests
  // only pin the prop-default behavior and the wiring of the
  // explicit-preference fast path (responsive=false skips the
  // policy entirely so `mode` mirrors `variant`).
  describe('responsive (adaptive layout)', () => {
    it('defaults `responsive` to false so existing integrations are unaffected', async () => {
      const page = await create('<md-time-picker></md-time-picker>');
      expect(page.rootInstance['responsive']).toBe(false);
    });

    it('honors the explicit variant prop when responsive is OFF (default)', async () => {
      const page = await create('<md-time-picker open variant="dial"></md-time-picker>');
      expect(page.rootInstance['mode']).toBe('dial');
    });

    it('honors the explicit variant prop in input variant when responsive is OFF', async () => {
      const page = await create('<md-time-picker open variant="input"></md-time-picker>');
      expect(page.rootInstance['mode']).toBe('input');
    });

    it('reads the responsive attribute from HTML', async () => {
      const page = await create('<md-time-picker responsive></md-time-picker>');
      expect(page.rootInstance['responsive']).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // Customisation tokens — pin the public CSS custom-property surface
  // so accidental renames / removals break the suite. We don't rely on
  // computed-style reflection here (Stencil's mock DOM doesn't run a
  // real style engine), so the smoke test is structural:
  //
  //   • the host accepts any author-supplied `--md-time-picker-*`
  //     override via the `style` attribute without throwing,
  //   • the rendered shadow-DOM is unchanged (the override is purely
  //     a CSS-time concern; no runtime branch reads these tokens),
  //   • and the override survives `page.waitForChanges()` so it isn't
  //     scrubbed by a re-render.
  //
  // Visual fidelity of each token is exercised by the storybook
  // CustomCSS story and (where applicable) by Puppeteer e2e snapshots.
  describe('custom CSS API', () => {
    // The seven canonical recipes from `readme.md` (Tomato brand,
    // filled actions, sharp, compact, touch, snappy) all reduce to
    // long lists of `--md-time-picker-*` overrides on a single style
    // attribute. A representative subset is asserted here — one
    // colour, one shape, one dimension, one typography, one motion
    // token — so the test stays maintainable while covering every
    // axis of the token surface.
    const REPRESENTATIVE_OVERRIDES: Array<{ axis: string; declaration: string }> = [
      { axis: 'colour',     declaration: '--md-time-picker-dial-hand-color: tomato' },
      { axis: 'colour-bg',  declaration: '--md-time-picker-input-active-bg: #ffe5dc' },
      { axis: 'colour-fg',  declaration: '--md-time-picker-input-active-color: #5a1500' },
      { axis: 'shape',      declaration: '--md-time-picker-period-shape: 0' },
      { axis: 'shape-act',  declaration: '--md-time-picker-action-shape: 4px' },
      { axis: 'dimension',  declaration: '--md-time-picker-dial-size: 320px' },
      { axis: 'dimension-w',declaration: '--md-time-picker-input-width: 112px' },
      { axis: 'dimension-h',declaration: '--md-time-picker-input-height: 88px' },
      { axis: 'period-vw',  declaration: '--md-time-picker-period-vertical-width: 64px' },
      { axis: 'period-vh',  declaration: '--md-time-picker-period-vertical-height: 96px' },
      { axis: 'typography', declaration: '--md-time-picker-input-font-size: 56px' },
      { axis: 'motion',     declaration: '--md-time-picker-dialog-enter-duration: 150ms' },
      { axis: 'motion-sw',  declaration: '--md-time-picker-mode-swap-duration: 100ms' },
      { axis: 'actions-bg', declaration: '--md-time-picker-action-confirm-bg: tomato' },
    ];

    for (const { axis, declaration } of REPRESENTATIVE_OVERRIDES) {
      it(`accepts ${axis} override (${declaration.split(':')[0].trim()})`, async () => {
        const page = await create(
          `<md-time-picker open value="07:30" style="${declaration}"></md-time-picker>`
        );
        await page.waitForChanges();
        expect(page.root).toBeTruthy();
        expect(page.root?.getAttribute('style')).toContain(declaration.split(':')[0].trim());
        // Sanity: the dialog still renders all its parts after the override
        const shadow = page.root?.shadowRoot;
        expect(shadow?.querySelector('[part="dialog"]')).toBeTruthy();
        expect(shadow?.querySelector('[part="headline"]')).toBeTruthy();
        expect(shadow?.querySelector('[part="input-hour"]')).toBeTruthy();
        expect(shadow?.querySelector('[part="input-minute"]')).toBeTruthy();
        expect(shadow?.querySelector('[part="confirm-button"]')).toBeTruthy();
        expect(shadow?.querySelector('[part="cancel-button"]')).toBeTruthy();
      });
    }

    it('composes multiple overrides on a single style attribute (sharp + tomato + touch)', async () => {
      // The "kitchen sink" override — one of every axis combined onto
      // a single style attribute. If the runtime ever started reading
      // any of these tokens through `getPropertyValue()` and choking
      // on an unparseable value, this test would crash on render.
      const style = [
        '--md-time-picker-dial-hand-color: #00bcd4',
        '--md-time-picker-input-active-bg: #b2ebf2',
        '--md-time-picker-input-active-color: #006064',
        '--md-time-picker-action-confirm-bg: #00bcd4',
        '--md-time-picker-action-primary-color: #ffffff',
        '--md-time-picker-dialog-shape: 0',
        '--md-time-picker-trigger-shape: 0',
        '--md-time-picker-input-shape: 0',
        '--md-time-picker-period-shape: 0',
        '--md-time-picker-action-shape: 4px',
        '--md-time-picker-dial-size: 320px',
        '--md-time-picker-dial-target-size: 60px',
        '--md-time-picker-input-width: 112px',
        '--md-time-picker-input-height: 88px',
        '--md-time-picker-input-font-size: 56px',
        '--md-time-picker-period-vertical-width: 64px',
        '--md-time-picker-period-vertical-height: 96px',
        '--md-time-picker-period-vertical-height-input: 88px',
        '--md-time-picker-dialog-enter-duration: 200ms',
        '--md-time-picker-mode-swap-duration: 150ms',
        '--md-time-picker-motion-easing: linear',
      ].join('; ');
      const page = await create(
        `<md-time-picker open variant="dial" value="14:30" style="${style}"></md-time-picker>`
      );
      await page.waitForChanges();
      expect(page.root?.shadowRoot?.querySelector('[part="dial"]')).toBeTruthy();
      expect(page.root?.shadowRoot?.querySelector('[part="dial-hand"]')).toBeTruthy();
    });

    it('keeps the legacy --md-time-picker-time-display-shape alias working alongside the canonical --md-time-picker-input-shape', async () => {
      // Back-compat guarantee — call out the alias explicitly so the
      // test fails loudly if someone "tidies up" the fallback chain.
      const page = await create(
        `<md-time-picker open style="--md-time-picker-time-display-shape: 0"></md-time-picker>`
      );
      await page.waitForChanges();
      expect(page.root?.getAttribute('style')).toContain(
        '--md-time-picker-time-display-shape'
      );
      expect(page.root?.shadowRoot?.querySelector('[part="input-hour"]')).toBeTruthy();
    });
  });

  // ───────────────────────── PUBLIC METHODS (show/hide) ─────────────────────────
  describe('show() / hide() methods', () => {
    it('show() opens the dialog and emits mdOpen', async () => {
      const page = await create('<md-time-picker></md-time-picker>');
      const opened = jest.fn();
      page.root!.addEventListener('mdOpen', opened);
      await (page.root as any).show();
      await page.waitForChanges();
      expect(page.root?.shadowRoot?.querySelector('.md-time-picker__dialog')).toBeTruthy();
      expect(page.root?.hasAttribute('open')).toBe(true);
      expect(opened).toHaveBeenCalledTimes(1);
    });

    it('show() is a no-op when disabled', async () => {
      const page = await create('<md-time-picker disabled></md-time-picker>');
      await (page.root as any).show();
      await page.waitForChanges();
      expect(page.root?.shadowRoot?.querySelector('.md-time-picker__dialog')).toBeNull();
    });

    it('hide() closes as a cancel (mdCancel + mdClose, no mdChange)', async () => {
      const page = await create('<md-time-picker value="09:15" open></md-time-picker>');
      const cancelled = jest.fn();
      const closed = jest.fn();
      const changed = jest.fn();
      page.root!.addEventListener('mdCancel', cancelled);
      page.root!.addEventListener('mdClose', closed);
      page.root!.addEventListener('mdChange', changed);
      await (page.root as any).hide();
      await page.waitForChanges();
      expect(page.root?.shadowRoot?.querySelector('.md-time-picker__dialog')).toBeNull();
      expect(cancelled).toHaveBeenCalledTimes(1);
      expect(closed).toHaveBeenCalledTimes(1);
      expect(changed).not.toHaveBeenCalled();
    });
  });

  // ───────────────────────── WATCHERS ─────────────────────────
  describe('prop watchers', () => {
    it('variant change while closed retargets the next open mode', async () => {
      const page = await create('<md-time-picker variant="input"></md-time-picker>');
      (page.root as any).variant = 'dial';
      await page.waitForChanges();
      (page.root as any).open = true;
      await page.waitForChanges();
      expect(page.root?.shadowRoot?.querySelector('[part="dial"]')).toBeTruthy();
    });

    it('variant change while OPEN does not yank the current mode', async () => {
      const page = await create('<md-time-picker variant="input" open></md-time-picker>');
      (page.root as any).variant = 'dial';
      await page.waitForChanges();
      // still the input dialog — no dial surface
      expect(page.root?.shadowRoot?.querySelector('[part="dial"]')).toBeNull();
      expect(page.root?.shadowRoot?.querySelector('[part="input-hour"]')).toBeTruthy();
    });

    it('external unpadded set that canonically equals the committed value still resyncs open tiles', async () => {
      // Regression: committed "09:05", user drags the dial elsewhere, then
      // external code sets "9:05" — canonical "09:05" equals committed, but
      // the tiles must still snap back to 09:05 (the old early-return left
      // them showing the dragged value).
      const page = await create('<md-time-picker value="09:05" open></md-time-picker>');
      const sr = page.root!.shadowRoot!;
      const hourInput = sr.querySelector('[part="input-hour"]') as HTMLInputElement;
      const minuteInput = sr.querySelector('[part="input-minute"]') as HTMLInputElement;
      // simulate the user moving the draft away via the HH/MM buffers
      hourInput.value = '11';
      hourInput.dispatchEvent(new Event('input', { bubbles: true }));
      minuteInput.value = '30';
      minuteInput.dispatchEvent(new Event('input', { bubbles: true }));
      await page.waitForChanges();
      expect(minuteInput.value).toBe('30');
      (page.root as any).value = '9:05';
      await page.waitForChanges();
      expect(page.rootInstance.value).toBe('09:05');
      expect(hourInput.value).toBe('9');
      expect(minuteInput.value).toBe('05');
    });

    it('external value set while OPEN re-seeds the visible HH/MM tiles and clears errors', async () => {
      const page = await create('<md-time-picker value="09:15" open></md-time-picker>');
      const sr = page.root!.shadowRoot!;
      const hourInput = sr.querySelector('[part="input-hour"]') as HTMLInputElement;
      // Poison the hour buffer so the error path is also exercised.
      hourInput.value = '99';
      hourInput.dispatchEvent(new Event('input', { bubbles: true }));
      await page.waitForChanges();
      expect(hourInput.getAttribute('aria-invalid')).toBe('true');
      (page.root as any).value = '14:45';
      await page.waitForChanges();
      const minuteInput = sr.querySelector('[part="input-minute"]') as HTMLInputElement;
      expect(hourInput.value).toBe('2');
      expect(minuteInput.value).toBe('45');
      expect(hourInput.getAttribute('aria-invalid')).toBe('false');
    });
  });

  // ───────────────────────── CONFIRM VALIDATION (both modes) ─────────────────────────
  describe('confirm validates visible buffers in dial mode too', () => {
    it('OK refuses to commit while the typed HH buffer is invalid in DIAL mode', async () => {
      const page = await create('<md-time-picker variant="dial" value="09:15" open></md-time-picker>');
      const sr = page.root!.shadowRoot!;
      const changed = jest.fn();
      page.root!.addEventListener('mdChange', changed);
      const hourInput = sr.querySelector('[part="input-hour"]') as HTMLInputElement;
      hourInput.value = '99';
      hourInput.dispatchEvent(new Event('input', { bubbles: true }));
      await page.waitForChanges();
      const okBtn = sr.querySelector('[part="confirm-button"]') as HTMLElement;
      okBtn.dispatchEvent(new CustomEvent('mdClick', { bubbles: true }));
      await page.waitForChanges();
      // Previously this silently committed the stale 09:15 draft and
      // closed; now OK is blocked until the buffer is corrected.
      expect(changed).not.toHaveBeenCalled();
      expect(sr.querySelector('.md-time-picker__dialog')).toBeTruthy();
      expect(hourInput.getAttribute('aria-invalid')).toBe('true');
    });
  });

  // ───────────────────────── EMPTY-VALUE SEED ─────────────────────────
  describe('empty value seed', () => {
    it('seeds the dialog at noon (12:00 PM) with an empty trigger', async () => {
      const page = await create('<md-time-picker open></md-time-picker>');
      const sr = page.root!.shadowRoot!;
      expect((sr.querySelector('[part="input-hour"]') as HTMLInputElement).value).toBe('12');
      expect((sr.querySelector('[part="input-minute"]') as HTMLInputElement).value).toBe('00');
      const pm = sr.querySelector('.md-time-picker__period-btn--pm');
      expect(pm?.getAttribute('aria-checked')).toBe('true');
    });
  });

  // ───────────────────────── FORM-ASSOCIATED CALLBACKS ─────────────────────────
  describe('form-associated callbacks', () => {
    it('formResetCallback restores the initial value attribute (native parity), not empty', async () => {
      const page = await create('<md-time-picker value="07:30"></md-time-picker>');
      (page.root as any).value = '14:45';
      await page.waitForChanges();
      page.rootInstance.formResetCallback();
      await page.waitForChanges();
      expect(page.rootInstance.value).toBe('07:30'); // back to the initial, not ''
      const trigger = page.root?.shadowRoot?.querySelector('md-text-field[part="trigger"]') as any;
      expect(trigger?.value).toBe('7:30 AM');
    });

    it('formResetCallback restores an empty initial value to empty', async () => {
      const page = await create('<md-time-picker></md-time-picker>');
      (page.root as any).value = '14:45';
      await page.waitForChanges();
      page.rootInstance.formResetCallback();
      await page.waitForChanges();
      expect(page.rootInstance.value).toBe('');
    });

    it('formResetCallback restores the CANONICAL initial value ("9:05" default → "09:05")', async () => {
      const page = await create('<md-time-picker value="9:05"></md-time-picker>');
      (page.root as any).value = '';
      await page.waitForChanges();
      page.rootInstance.formResetCallback();
      await page.waitForChanges();
      expect(page.rootInstance.value).toBe('09:05');
    });

    it('formDisabledCallback(true) disables the trigger and closes an open dialog', async () => {
      const page = await create('<md-time-picker value="07:30" open></md-time-picker>');
      page.rootInstance.formDisabledCallback(true);
      await page.waitForChanges();
      expect(page.root?.shadowRoot?.querySelector('.md-time-picker__dialog')).toBeNull();
      const trigger = page.root?.shadowRoot?.querySelector('md-text-field[part="trigger"]') as any;
      expect(trigger?.disabled).toBe(true);
      page.rootInstance.formDisabledCallback(false);
      await page.waitForChanges();
      expect(trigger?.disabled).toBe(false);
    });

    it('setting disabled=true while open closes the dialog (parity with fieldset disable)', async () => {
      const page = await create('<md-time-picker value="07:30" open></md-time-picker>');
      expect(page.root?.shadowRoot?.querySelector('.md-time-picker__dialog')).toBeTruthy();
      (page.root as any).disabled = true;
      await page.waitForChanges();
      expect(page.root?.shadowRoot?.querySelector('.md-time-picker__dialog')).toBeNull();
    });

    it('boot-open + disabled does not open the dialog', async () => {
      const page = await create('<md-time-picker value="07:30" open disabled></md-time-picker>');
      expect(page.root?.shadowRoot?.querySelector('.md-time-picker__dialog')).toBeNull();
    });

    it('confirm() is a no-op on a disabled picker (no mdChange)', async () => {
      const page = await create('<md-time-picker value="07:30" open></md-time-picker>');
      const changed = jest.fn();
      page.root!.addEventListener('mdChange', changed);
      (page.root as any).disabled = true; // also closes it
      await page.waitForChanges();
      page.rootInstance.confirm();
      await page.waitForChanges();
      expect(changed).not.toHaveBeenCalled();
    });

    it('formStateRestoreCallback restores a string state into value', async () => {
      const page = await create('<md-time-picker></md-time-picker>');
      page.rootInstance.formStateRestoreCallback('18:20');
      await page.waitForChanges();
      expect(page.rootInstance.value).toBe('18:20');
      const trigger = page.root?.shadowRoot?.querySelector('md-text-field[part="trigger"]') as any;
      expect(trigger?.value).toBe('6:20 PM');
    });
  });

  // ───────────────────────── SPINBUTTON SEMANTICS ─────────────────────────
  describe('HH/MM spinbutton semantics', () => {
    it('exposes role=spinbutton with a 12h hour range', async () => {
      const page = await create('<md-time-picker value="14:30" open></md-time-picker>');
      const sr = page.root!.shadowRoot!;
      const hour = sr.querySelector('[part="input-hour"]')!;
      expect(hour.getAttribute('role')).toBe('spinbutton');
      expect(hour.getAttribute('aria-valuemin')).toBe('1');
      expect(hour.getAttribute('aria-valuemax')).toBe('12');
      expect(hour.getAttribute('aria-valuenow')).toBe('2');
      const minute = sr.querySelector('[part="input-minute"]')!;
      expect(minute.getAttribute('role')).toBe('spinbutton');
      expect(minute.getAttribute('aria-valuemin')).toBe('0');
      expect(minute.getAttribute('aria-valuemax')).toBe('59');
      expect(minute.getAttribute('aria-valuenow')).toBe('30');
    });

    it('uses the 0–23 hour range in 24h mode', async () => {
      const page = await create('<md-time-picker format="24h" value="14:30" open></md-time-picker>');
      const hour = page.root!.shadowRoot!.querySelector('[part="input-hour"]')!;
      expect(hour.getAttribute('aria-valuemin')).toBe('0');
      expect(hour.getAttribute('aria-valuemax')).toBe('23');
      expect(hour.getAttribute('aria-valuenow')).toBe('14');
    });

    it('drops aria-valuenow while the typed buffer is invalid', async () => {
      const page = await create('<md-time-picker value="09:15" open></md-time-picker>');
      const hour = page.root!.shadowRoot!.querySelector('[part="input-hour"]') as HTMLInputElement;
      hour.value = '99';
      hour.dispatchEvent(new Event('input', { bubbles: true }));
      await page.waitForChanges();
      expect(hour.getAttribute('aria-valuenow')).toBeNull();
    });

    it('aria-valuenow announces a valid-but-unapplied buffer while the SIBLING field errors', async () => {
      // hour "99" errors → the both-valid gate holds the draft at 15,
      // but the user SEES "45" in the minute tile — valuenow must
      // announce what they see, not the stale draft.
      const page = await create('<md-time-picker format="24h" value="10:15" open></md-time-picker>');
      const sr = page.root!.shadowRoot!;
      const hour = sr.querySelector('[part="input-hour"]') as HTMLInputElement;
      hour.value = '99';
      hour.dispatchEvent(new Event('input', { bubbles: true }));
      await page.waitForChanges();
      const minute = sr.querySelector('[part="input-minute"]') as HTMLInputElement;
      minute.value = '45';
      minute.dispatchEvent(new Event('input', { bubbles: true }));
      await page.waitForChanges();
      expect(minute.getAttribute('aria-valuenow')).toBe('45');
      expect(hour.getAttribute('aria-valuenow')).toBeNull();
    });
  });

  // ───────────────────────── LOCALIZATION ─────────────────────────
  describe('localizable strings', () => {
    it('HH/MM hints render the hour-label / minute-label props (no hardcoded English)', async () => {
      const page = await create('<md-time-picker hour-label="Heure" minute-label="Minute (fr)" open></md-time-picker>');
      const hints = page.root!.shadowRoot!.querySelectorAll('.md-time-picker__input-hint');
      expect(hints[0].textContent).toBe('Heure');
      expect(hints[1].textContent).toBe('Minute (fr)');
    });

    it('localizes the default dialog headline per variant (no hardcoded English)', async () => {
      const input = await create('<md-time-picker variant="input" headline-input-label="Heure de saisie" open></md-time-picker>');
      expect(input.root!.shadowRoot!.querySelector('[part="headline"]')!.textContent).toBe('Heure de saisie');
      const dial = await create('<md-time-picker variant="dial" headline-dial-label="Choisir l’heure" open></md-time-picker>');
      expect(dial.root!.shadowRoot!.querySelector('[part="headline"]')!.textContent).toBe('Choisir l’heure');
      // explicit `headline` still overrides both
      const override = await create('<md-time-picker variant="input" headline="Réveil" headline-input-label="X" open></md-time-picker>');
      expect(override.root!.shadowRoot!.querySelector('[part="headline"]')!.textContent).toBe('Réveil');
    });

    it('the polite live region announces the active unit via the label props', async () => {
      const page = await create('<md-time-picker variant="dial" hour-label="Heure" minute-label="Minute (fr)" open></md-time-picker>');
      const sr = page.root!.shadowRoot!;
      const status = sr.querySelector('.md-time-picker__sr-status')!;
      expect(status.getAttribute('aria-live')).toBe('polite');
      expect(status.textContent).toBe('Heure');
      const minuteInput = sr.querySelector('[part="input-minute"]') as HTMLInputElement;
      minuteInput.dispatchEvent(new Event('focus'));
      await page.waitForChanges();
      expect(status.textContent).toBe('Minute (fr)');
    });
  });
});
