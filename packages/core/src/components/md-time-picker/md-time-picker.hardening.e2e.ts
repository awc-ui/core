import { newE2EPage } from '@stencil/core/testing';

/**
 * Hardening coverage for md-time-picker (dev-readiness remediation):
 *   • modal core — focus trap, deep focus restore, first-keystroke
 *     select-all, reparent-while-open resilience, scroll lock
 *   • form association — FormData, required/min/max validity, reset,
 *     <fieldset disabled>
 *   • dial geometry — computed tap coordinates → value, drag + mdInput
 *     de-dupe, 24h inner-ring discrimination, minute-step snapping
 *   • adaptive layout — horizontal demotion, dialog scroll fallback
 *   • forced-colors — active-tile Highlight survives author hover rules
 */
type E2EPage = Awaited<ReturnType<typeof newE2EPage>>;

/** Composed-tree active element descriptor (crosses shadow roots). */
async function deepActive(page: E2EPage) {
  return page.evaluate(() => {
    let a: Element | null = document.activeElement;
    while (a && a.shadowRoot && a.shadowRoot.activeElement) a = a.shadowRoot.activeElement;
    return {
      tag: a?.tagName ?? '',
      part: a?.getAttribute?.('part') ?? '',
      cls: (a as HTMLElement)?.className ?? '',
    };
  });
}

/** True while the composed focus is anywhere inside the md-time-picker. */
async function focusInsidePicker(page: E2EPage) {
  return page.evaluate(() => document.activeElement?.tagName === 'MD-TIME-PICKER');
}

/** Centre + radius of the rendered dial face in page coordinates. */
async function dialGeometry(page: E2EPage) {
  return page.evaluate(() => {
    const host = document.querySelector('md-time-picker')!;
    const dial = host.shadowRoot!.querySelector('[part="dial"]')!;
    const r = dial.getBoundingClientRect();
    return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, radius: r.width / 2 };
  });
}

/** Page point for a clock angle (0° = 12 o'clock) at ratio × radius. */
function dialPoint(geo: { cx: number; cy: number; radius: number }, angleDeg: number, ratio: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: geo.cx + Math.cos(rad) * geo.radius * ratio,
    y: geo.cy + Math.sin(rad) * geo.radius * ratio,
  };
}

describe('md-time-picker hardening (e2e)', () => {
  // ─────────────────────────── MODAL CORE ───────────────────────────
  describe('modal focus management', () => {
    it('traps Tab inside the open dialog (forward wrap)', async () => {
      const page = await newE2EPage();
      await page.setContent(
        '<button id="before">before</button><md-time-picker label="Time" value="09:15"></md-time-picker><button id="after">after</button>',
      );
      const trigger = await page.find('md-time-picker >>> .md-time-picker__field');
      await trigger.click();
      await page.waitForChanges();
      // 12 Tabs is more than one full lap of the dialog's focusables —
      // focus must never escape to #after / body.
      const seen: string[] = [];
      for (let i = 0; i < 12; i++) {
        await page.keyboard.press('Tab');
        expect(await focusInsidePicker(page)).toBe(true);
        seen.push((await deepActive(page)).part);
      }
      // the wrap actually happened: the HH input came around again
      expect(seen.filter((p) => p === 'input-hour').length).toBeGreaterThanOrEqual(1);
    });

    it('traps Shift+Tab (backward wrap from the first focusable)', async () => {
      const page = await newE2EPage();
      await page.setContent('<md-time-picker label="Time" value="09:15" open></md-time-picker>');
      await page.waitForChanges();
      // initial focus = HH input (first focusable) → Shift+Tab must wrap
      // to the dialog's last focusable, not escape to body
      await page.keyboard.down('Shift');
      await page.keyboard.press('Tab');
      await page.keyboard.up('Shift');
      expect(await focusInsidePicker(page)).toBe(true);
      const active = await deepActive(page);
      expect(active.part).not.toBe('input-hour');
    });

    it('restores focus to the trigger field after Escape', async () => {
      const page = await newE2EPage();
      await page.setContent('<md-time-picker label="Time" value="09:15"></md-time-picker>');
      const trigger = await page.find('md-time-picker >>> .md-time-picker__field');
      await trigger.click();
      await page.waitForChanges();
      await page.keyboard.press('Escape');
      await page.waitForChanges();
      // rAF-deferred focus restore
      await new Promise((r) => setTimeout(r, 100));
      const active = await deepActive(page);
      // focus must land back in the trigger's inner input — NOT on body
      expect(active.tag).toBe('INPUT');
      expect(await focusInsidePicker(page)).toBe(true);
    });

    it('restores focus to an external opener after cancel (show() path)', async () => {
      const page = await newE2EPage();
      await page.setContent(
        '<button id="opener">open</button><md-time-picker hide-trigger label="Time"></md-time-picker>',
      );
      await page.evaluate(() => {
        const btn = document.getElementById('opener')!;
        btn.focus();
        btn.addEventListener('click', () => (document.querySelector('md-time-picker') as any).show());
      });
      await page.click('#opener');
      await page.waitForChanges();
      const cancel = await page.find('md-time-picker >>> [part="cancel-button"]');
      await cancel.click();
      await page.waitForChanges();
      await new Promise((r) => setTimeout(r, 100));
      const id = await page.evaluate(() => document.activeElement?.id);
      expect(id).toBe('opener');
    });

    it('first keystroke replaces the seeded hour (select-all on open)', async () => {
      const page = await newE2EPage();
      await page.setContent('<md-time-picker label="Time" value="12:30"></md-time-picker>');
      const trigger = await page.find('md-time-picker >>> .md-time-picker__field');
      await trigger.click();
      await page.waitForChanges();
      await new Promise((r) => setTimeout(r, 100)); // rAF focus + select
      await page.keyboard.type('9');
      await page.waitForChanges();
      const hour = await page.find('md-time-picker >>> [part="input-hour"]');
      // seeded "12" + maxLength=2 used to swallow the keystroke entirely
      expect(await hour.getProperty('value')).toBe('9');
      // and the typed hour actually commits on OK
      const ok = await page.find('md-time-picker >>> [part="confirm-button"]');
      await ok.click();
      await page.waitForChanges();
      const value = await (await page.find('md-time-picker')).getProperty('value');
      expect(value).toBe('21:30'); // 12:30 PM seed → hour 9 typed stays PM
    });

    it('survives a reparent while open: Escape still closes, scroll lock intact', async () => {
      const page = await newE2EPage();
      await page.setContent('<div id="a"><md-time-picker open></md-time-picker></div><div id="b"></div>');
      await page.waitForChanges();
      expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');
      await page.evaluate(() => {
        document.getElementById('b')!.appendChild(document.querySelector('md-time-picker')!);
      });
      await page.waitForChanges();
      // disconnected→connected teardown/rebind: lock re-armed
      expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');
      await page.keyboard.press('Escape');
      await page.waitForChanges();
      const dialog = await page.find('md-time-picker >>> .md-time-picker__dialog');
      expect(dialog).toBeNull();
      expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
    });
  });

  // ─────────────────────────── FORM ASSOCIATION ───────────────────────────
  describe('form association', () => {
    it('submits the committed value in FormData under `name`', async () => {
      const page = await newE2EPage();
      await page.setContent('<form><md-time-picker name="meet" value="14:30"></md-time-picker></form>');
      const entry = await page.evaluate(() => new FormData(document.querySelector('form')!).get('meet'));
      expect(entry).toBe('14:30');
    });

    it('updates FormData after an OK commit', async () => {
      const page = await newE2EPage();
      await page.setContent('<form><md-time-picker name="meet" value="14:30" open></md-time-picker></form>');
      await page.waitForChanges();
      await new Promise((r) => setTimeout(r, 100));
      await page.keyboard.type('8'); // select-all → replaces hour
      const ok = await page.find('md-time-picker >>> [part="confirm-button"]');
      await ok.click();
      await page.waitForChanges();
      const entry = await page.evaluate(() => new FormData(document.querySelector('form')!).get('meet'));
      expect(entry).toBe('20:30'); // 2:30 PM → hour 8 PM
    });

    it('required blocks form validity until a value is committed', async () => {
      const page = await newE2EPage();
      await page.setContent('<form><md-time-picker name="t" required></md-time-picker></form>');
      expect(await page.evaluate(() => document.querySelector('form')!.checkValidity())).toBe(false);
      const el = await page.find('md-time-picker');
      expect(await el.callMethod('checkValidity')).toBe(false);
      const validity = await el.callMethod('getValidity');
      expect(validity.valueMissing).toBe(true);
      el.setProperty('value', '09:00');
      await page.waitForChanges();
      expect(await page.evaluate(() => document.querySelector('form')!.checkValidity())).toBe(true);
    });

    it('min/max produce rangeUnderflow / rangeOverflow', async () => {
      const page = await newE2EPage();
      await page.setContent('<md-time-picker min="09:00" max="17:00" value="08:00"></md-time-picker>');
      const el = await page.find('md-time-picker');
      let v = await el.callMethod('getValidity');
      expect(v.valid).toBe(false);
      expect(v.rangeUnderflow).toBe(true);
      el.setProperty('value', '18:30');
      await page.waitForChanges();
      v = await el.callMethod('getValidity');
      expect(v.rangeOverflow).toBe(true);
      el.setProperty('value', '12:15');
      await page.waitForChanges();
      v = await el.callMethod('getValidity');
      expect(v.valid).toBe(true);
    });

    it('form reset with an EMPTY initial value clears value, trigger, and FormData entry', async () => {
      // No `value` attribute → the default is '' → reset returns to ''.
      // (The pre-filled case restoring its initial value is covered by
      // "form reset restores the initial value attribute" below.)
      const page = await newE2EPage();
      await page.setContent('<form><md-time-picker name="t"></md-time-picker></form>');
      const el = await page.find('md-time-picker');
      el.setProperty('value', '09:15');
      await page.waitForChanges();
      await page.evaluate(() => document.querySelector('form')!.reset());
      await page.waitForChanges();
      expect(await el.getProperty('value')).toBe('');
      const trigger = await page.find('md-time-picker >>> md-text-field');
      expect(await trigger.getProperty('value')).toBe('');
      const entry = await page.evaluate(() => new FormData(document.querySelector('form')!).get('t'));
      expect(entry).toBe('');
    });

    it('<fieldset disabled> disables the trigger and blocks opening', async () => {
      const page = await newE2EPage();
      await page.setContent('<form><fieldset disabled><md-time-picker value="07:30"></md-time-picker></fieldset></form>');
      await page.waitForChanges();
      const trigger = await page.find('md-time-picker >>> md-text-field');
      expect(await trigger.getProperty('disabled')).toBe(true);
      await page.evaluate(() => {
        const host = document.querySelector('md-time-picker')!;
        (host.shadowRoot!.querySelector('.md-time-picker__field') as HTMLElement).click();
      });
      await page.waitForChanges();
      expect(await page.find('md-time-picker >>> .md-time-picker__dialog')).toBeNull();
    });
  });

  // ─────────────────────────── DIAL GEOMETRY ───────────────────────────
  describe('dial interaction', () => {
    it('tapping a computed hour position selects that hour', async () => {
      const page = await newE2EPage();
      await page.setContent('<md-time-picker variant="dial" value="09:15" open></md-time-picker>');
      await page.waitForChanges();
      const geo = await dialGeometry(page);
      const p = dialPoint(geo, 3 * 30, 0.8); // 3 o'clock, outer ring
      await page.mouse.click(p.x, p.y);
      await page.waitForChanges();
      const hour = await page.find('md-time-picker >>> [part="input-hour"]');
      expect(await hour.getProperty('value')).toBe('3');
    });

    it('drag de-dupes mdInput per distinct position and lands on the final hour', async () => {
      const page = await newE2EPage();
      await page.setContent('<md-time-picker variant="dial" value="12:00" open></md-time-picker>');
      await page.waitForChanges();
      const spy = await page.spyOnEvent('mdInput');
      const geo = await dialGeometry(page);
      const p3 = dialPoint(geo, 3 * 30, 0.8);
      const p6 = dialPoint(geo, 6 * 30, 0.8);
      await page.mouse.move(p3.x, p3.y);
      await page.mouse.down();
      await page.waitForChanges();
      await page.mouse.move(p6.x, p6.y, { steps: 1 });
      await page.waitForChanges();
      await page.mouse.move(p6.x, p6.y + 1, { steps: 1 }); // same hour again
      await page.waitForChanges();
      await page.mouse.up();
      await page.waitForChanges();
      // exactly two distinct positions: 3 (down) and 6 (move); the
      // duplicate 6 must not re-fire
      expect(spy).toHaveReceivedEventTimes(2);
      const last = spy.lastEvent.detail as { hours: number };
      expect(last.hours).toBe(18); // 6 PM (12:00 seed is PM)
    });

    it('24h format: inner-ring taps select 13–23, outer ring 1–12 at the same angle', async () => {
      const page = await newE2EPage();
      await page.setContent('<md-time-picker variant="dial" format="24h" value="08:00" open></md-time-picker>');
      await page.waitForChanges();
      const geo = await dialGeometry(page);
      const inner = dialPoint(geo, 3 * 30, 0.52);
      await page.mouse.click(inner.x, inner.y);
      await page.waitForChanges();
      const hour = await page.find('md-time-picker >>> [part="input-hour"]');
      expect(await hour.getProperty('value')).toBe('15');
      // re-open hour selection (auto-advanced to minutes after the tap)
      const hourEl = await page.find('md-time-picker >>> [part="input-hour"]');
      await hourEl.click();
      await page.waitForChanges();
      const outer = dialPoint(geo, 3 * 30, 0.8);
      await page.mouse.click(outer.x, outer.y);
      await page.waitForChanges();
      expect(await hour.getProperty('value')).toBe('3');
    });

    it('minute selection snaps to minute-step', async () => {
      const page = await newE2EPage();
      await page.setContent('<md-time-picker variant="dial" minute-step="5" value="09:00" open></md-time-picker>');
      await page.waitForChanges();
      // advance to minute selection by tapping the current hour
      const geo = await dialGeometry(page);
      const hourPos = dialPoint(geo, 9 * 30, 0.8);
      await page.mouse.click(hourPos.x, hourPos.y);
      await page.waitForChanges();
      // tap at the 33-minute angle → must snap to 35
      const minutePos = dialPoint(geo, 33 * 6, 0.8);
      await page.mouse.click(minutePos.x, minutePos.y);
      await page.waitForChanges();
      const minute = await page.find('md-time-picker >>> [part="input-minute"]');
      expect(await minute.getProperty('value')).toBe('35');
    });
  });

  // ─────────────────────────── ADAPTIVE LAYOUT ───────────────────────────
  describe('adaptive layout', () => {
    it('demotes an explicit horizontal orientation on a too-narrow viewport (responsive)', async () => {
      const page = await newE2EPage();
      await page.setViewport({ width: 500, height: 900 });
      await page.setContent(
        '<md-time-picker responsive variant="dial" orientation="horizontal" open></md-time-picker>',
      );
      await page.waitForChanges();
      const dialog = await page.find('md-time-picker >>> .md-time-picker__dialog');
      expect(dialog.className).toContain('md-time-picker__dialog--vertical');
      expect(dialog.className).not.toContain('md-time-picker__dialog--horizontal');
    });

    it('clamps the dialog to the viewport and keeps OK reachable via internal scroll', async () => {
      const page = await newE2EPage();
      await page.setViewport({ width: 800, height: 420 });
      await page.setContent('<md-time-picker variant="dial" value="09:15" open></md-time-picker>');
      await page.waitForChanges();
      const box = await page.evaluate(() => {
        const host = document.querySelector('md-time-picker')!;
        const d = host.shadowRoot!.querySelector('.md-time-picker__dialog')!;
        const r = d.getBoundingClientRect();
        return { height: r.height, scrollable: d.scrollHeight > d.clientHeight };
      });
      expect(box.height).toBeLessThanOrEqual(420);
      expect(box.scrollable).toBe(true);
      // OK stays operable: scroll it into view inside the dialog + click
      const changeSpy = await page.spyOnEvent('mdChange');
      await page.evaluate(() => {
        const host = document.querySelector('md-time-picker')!;
        host.shadowRoot!.querySelector('[part="confirm-button"]')!.scrollIntoView();
      });
      const ok = await page.find('md-time-picker >>> [part="confirm-button"]');
      await ok.click();
      await page.waitForChanges();
      expect(changeSpy).toHaveReceivedEventTimes(1);
    });
  });

  // ─────────────────────────── FORCED COLORS ───────────────────────────
  describe('forced-colors', () => {
    it('active tile keeps its Highlight fill under hover (author rules out-specified the FC block before)', async () => {
      const page = await newE2EPage();
      await page.setContent('<md-time-picker variant="input" value="09:15" open></md-time-picker>');
      await page.waitForChanges();
      // puppeteer 21's emulateMediaFeatures rejects 'forced-colors' — raw CDP
      const cdp = await (
        page as unknown as {
          createCDPSession: () => Promise<{ send: (m: string, p: unknown) => Promise<unknown>; detach: () => Promise<void> }>;
        }
      ).createCDPSession();
      try {
        await cdp.send('Emulation.setEmulatedMedia', {
          features: [{ name: 'forced-colors', value: 'active' }],
        });
        await page.waitForChanges();
        await new Promise((r) => setTimeout(r, 300));
        const resting = await page.evaluate(() => {
          const host = document.querySelector('md-time-picker')!;
          const active = host.shadowRoot!.querySelector('.md-time-picker__input--active')!;
          return getComputedStyle(active).backgroundColor;
        });
        // hover the active tile with the real mouse — the author color-mix
        // hover rule must NOT drain the Highlight fill in FC mode
        const pos = await page.evaluate(() => {
          const host = document.querySelector('md-time-picker')!;
          const r = host.shadowRoot!.querySelector('.md-time-picker__input--active')!.getBoundingClientRect();
          return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        });
        await page.mouse.move(pos.x, pos.y);
        await new Promise((r) => setTimeout(r, 150));
        const hovered = await page.evaluate(() => {
          const host = document.querySelector('md-time-picker')!;
          const active = host.shadowRoot!.querySelector('.md-time-picker__input--active')!;
          return getComputedStyle(active).backgroundColor;
        });
        expect(hovered).toBe(resting);
        // and it's a real system color, not the author primary-container
        expect(resting).not.toBe('rgb(234, 221, 255)');
      } finally {
        // Reset on THIS page even if an assertion threw. Note: Stencil
        // shares one browser across workers, so a concurrently-running
        // file can still observe forced-colors during this test's active
        // window — the durable defense lives in the media-sensitive tests
        // themselves, which pin `forced-colors: none` before measuring.
        await cdp.send('Emulation.setEmulatedMedia', { features: [] });
        await cdp.detach();
      }
    });
  });

  // ───────────────── BREAK-THE-FIX ROUND 2 GUARDS ─────────────────
  describe('round-2 hardening (adversarial findings)', () => {
    it('two open pickers: Escape closes ONLY the topmost; scroll lock survives until both close', async () => {
      const page = await newE2EPage();
      await page.setContent('<md-time-picker id="a" value="09:00"></md-time-picker><md-time-picker id="b" value="10:00"></md-time-picker>');
      await page.evaluate(async () => {
        await (document.getElementById('a') as any).show();
        await (document.getElementById('b') as any).show();
      });
      await page.waitForChanges();
      expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');
      await page.keyboard.press('Escape');
      await page.waitForChanges();
      let open = await page.evaluate(() => ({
        a: !!document.getElementById('a')!.shadowRoot!.querySelector('.md-time-picker__dialog'),
        b: !!document.getElementById('b')!.shadowRoot!.querySelector('.md-time-picker__dialog'),
      }));
      expect(open).toEqual({ a: true, b: false }); // topmost (b) closed, a survives
      expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden'); // a still holds the lock
      await page.keyboard.press('Escape');
      await page.waitForChanges();
      open = await page.evaluate(() => ({
        a: !!document.getElementById('a')!.shadowRoot!.querySelector('.md-time-picker__dialog'),
        b: !!document.getElementById('b')!.shadowRoot!.querySelector('.md-time-picker__dialog'),
      }));
      expect(open).toEqual({ a: false, b: false });
      expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
    });

    it('disconnecting a CLOSED picker does not release another picker\'s scroll lock', async () => {
      const page = await newE2EPage();
      await page.setContent('<md-time-picker id="a" open></md-time-picker><md-time-picker id="b"></md-time-picker>');
      await page.waitForChanges();
      expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');
      await page.evaluate(() => document.getElementById('b')!.remove());
      await page.waitForChanges();
      expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');
    });

    it('focus-trap wrap re-selects the HH buffer (no swallowed keystroke after a full lap)', async () => {
      const page = await newE2EPage();
      await page.setContent('<md-time-picker variant="input" format="24h" value="10:30" open></md-time-picker>');
      await page.waitForChanges();
      await new Promise((r) => setTimeout(r, 100));
      // collapse the initial selection, then Tab a full lap back to HH
      await page.keyboard.press('ArrowRight');
      for (let i = 0; i < 12; i++) {
        await page.keyboard.press('Tab');
        const active = await deepActive(page);
        if (active.part === 'input-hour' && i > 0) break;
      }
      const sel = await page.evaluate(() => {
        const host = document.querySelector('md-time-picker')!;
        const hour = host.shadowRoot!.querySelector('[part="input-hour"]') as HTMLInputElement;
        return { start: hour.selectionStart, end: hour.selectionEnd };
      });
      expect(sel).toEqual({ start: 0, end: 2 });
      await page.keyboard.type('9');
      await page.waitForChanges();
      const hour = await page.find('md-time-picker >>> [part="input-hour"]');
      expect(await hour.getProperty('value')).toBe('9'); // replaced, not swallowed
    });

    it('external value set while a dial-focused MM input is showing re-selects it (no swallowed keystroke)', async () => {
      // The dial auto-advance focuses the MM input; an external value
      // set (or dial-driven syncInputsFromDraft) rewrites that focused,
      // maxLength-full buffer — it must re-select so the next keystroke
      // replaces rather than being swallowed.
      const page = await newE2EPage();
      await page.setContent('<md-time-picker variant="dial" value="09:00" open></md-time-picker>');
      await page.waitForChanges();
      const geo = await dialGeometry(page);
      const hourPos = dialPoint(geo, 9 * 30, 0.8);
      await page.mouse.click(hourPos.x, hourPos.y); // auto-advance focuses MM
      await new Promise((r) => setTimeout(r, 120));
      // external set rewrites the focused MM buffer to "45"
      await page.evaluate(() => ((document.querySelector('md-time-picker') as any).value = '09:45'));
      await page.waitForChanges();
      const sel = await page.evaluate(() => {
        const mm = document.querySelector('md-time-picker')!.shadowRoot!.querySelector('[part="input-minute"]') as HTMLInputElement;
        return { value: mm.value, focused: document.querySelector('md-time-picker')!.shadowRoot!.activeElement === mm, len: (mm.selectionEnd ?? 0) - (mm.selectionStart ?? 0) };
      });
      expect(sel.value).toBe('45');
      // only assert the re-selection when the MM input actually held focus
      if (sel.focused) expect(sel.len).toBe(2);
    });

    it('hideTrigger boot-open close does not throw and settles focus deterministically', async () => {
      // hideTrigger hosts are display:contents (no focusable box); a
      // boot-open picker with no external opener has no focus origin, so
      // <body> is the honest, native-<dialog>-like outcome. The contract
      // is: closing is clean and focus is NOT left inside the unmounted
      // dialog. (The meaningful restore — external opener — is covered by
      // the show()-path test above.)
      const page = await newE2EPage();
      await page.setContent('<md-time-picker hide-trigger open></md-time-picker>');
      await page.waitForChanges();
      await page.keyboard.press('Escape');
      await page.waitForChanges();
      await new Promise((r) => setTimeout(r, 100));
      const state = await page.evaluate(() => ({
        active: document.activeElement?.tagName,
        dialogGone: !document.querySelector('md-time-picker')!.shadowRoot!.querySelector('.md-time-picker__dialog'),
      }));
      expect(state.dialogGone).toBe(true);
      expect(state.active).toBe('BODY'); // not stranded inside the picker
    });

    it('canonicalizes "9:05" to "09:05" in the prop and FormData', async () => {
      const page = await newE2EPage();
      await page.setContent('<form><md-time-picker name="t" value="9:05"></md-time-picker></form>');
      const el = await page.find('md-time-picker');
      expect(await el.getProperty('value')).toBe('09:05');
      const entry = await page.evaluate(() => new FormData(document.querySelector('form')!).get('t'));
      expect(entry).toBe('09:05');
    });

    it('blur keeps a valid-but-unapplied buffer while the sibling errors, and OK commits it once fixed', async () => {
      const page = await newE2EPage();
      await page.setContent('<md-time-picker variant="input" format="24h" value="10:30" open></md-time-picker>');
      await page.waitForChanges();
      await new Promise((r) => setTimeout(r, 100));
      await page.keyboard.type('99'); // hour buffer errors
      await page.keyboard.press('Tab'); // blur hour → focus minute (select-all)
      await page.keyboard.type('45'); // valid minute, unapplied (hour errors)
      await page.keyboard.press('Tab'); // blur minute — must NOT revert to "30"
      await page.waitForChanges();
      const minute = await page.find('md-time-picker >>> [part="input-minute"]');
      expect(await minute.getProperty('value')).toBe('45');
      // fix the hour, then commit
      await page.evaluate(() => {
        const host = document.querySelector('md-time-picker')!;
        const hour = host.shadowRoot!.querySelector('[part="input-hour"]') as HTMLInputElement;
        hour.focus();
        hour.select();
      });
      await page.keyboard.type('7');
      const ok = await page.find('md-time-picker >>> [part="confirm-button"]');
      await ok.click();
      await page.waitForChanges();
      const el = await page.find('md-time-picker');
      expect(await el.getProperty('value')).toBe('07:45'); // the 45 the user typed, not the stale 30
    });

    it('localizes constraint-validation messages with {min}/{max} substitution', async () => {
      const page = await newE2EPage();
      await page.setContent('<md-time-picker required min="09:00" max="17:00"></md-time-picker>');
      const el = await page.find('md-time-picker');
      // Set the labels as PROPERTIES (UTF-8-safe across the CDP bridge;
      // accented chars in a setContent HTML attribute get mojibake'd).
      el.setProperty('valueMissingLabel', 'Veuillez choisir une heure.');
      el.setProperty('rangeUnderflowLabel', 'Choisissez une heure après {min}.');
      el.setProperty('rangeOverflowLabel', 'Choisissez une heure avant {max}.');
      await page.waitForChanges();
      let v = await el.callMethod('getValidity');
      expect(v.valueMissing).toBe(true);
      expect(v.validationMessage).toBe('Veuillez choisir une heure.');
      el.setProperty('value', '08:00');
      await page.waitForChanges();
      v = await el.callMethod('getValidity');
      expect(v.validationMessage).toBe('Choisissez une heure après 09:00.');
      el.setProperty('value', '18:00');
      await page.waitForChanges();
      v = await el.callMethod('getValidity');
      expect(v.validationMessage).toBe('Choisissez une heure avant 17:00.');
      // repeated placeholder → every occurrence substituted (global replace)
      el.setProperty('rangeOverflowLabel', 'Après {max} interdit ({max}).');
      await page.waitForChanges();
      v = await el.callMethod('getValidity');
      expect(v.validationMessage).toBe('Après 17:00 interdit (17:00).');
    });

    it('form reset restores the initial value attribute in a real form (native parity)', async () => {
      const page = await newE2EPage();
      await page.setContent('<form><md-time-picker name="t" value="07:30"></md-time-picker></form>');
      const el = await page.find('md-time-picker');
      el.setProperty('value', '15:45');
      await page.waitForChanges();
      await page.evaluate(() => document.querySelector('form')!.reset());
      await page.waitForChanges();
      expect(await el.getProperty('value')).toBe('07:30'); // restored, not cleared
      const entry = await page.evaluate(() => new FormData(document.querySelector('form')!).get('t'));
      expect(entry).toBe('07:30');
    });

    it('min > max is an overnight window (native time semantics), excluded values set BOTH range flags', async () => {
      const page = await newE2EPage();
      await page.setContent('<md-time-picker min="22:00" max="06:00" value="23:30"></md-time-picker>');
      const el = await page.find('md-time-picker');
      let v = await el.callMethod('getValidity');
      expect(v.valid).toBe(true);
      el.setProperty('value', '05:00');
      await page.waitForChanges();
      v = await el.callMethod('getValidity');
      expect(v.valid).toBe(true);
      el.setProperty('value', '12:00');
      await page.waitForChanges();
      v = await el.callMethod('getValidity');
      expect(v.valid).toBe(false);
      // HTML spec: a reversed range in the excluded middle suffers from
      // BOTH underflow and overflow — a consumer checking either flag sees it.
      expect(v.rangeUnderflow).toBe(true);
      expect(v.rangeOverflow).toBe(true);
    });

    it('two open pickers: reparenting the LOWER one does not steal Escape from the front dialog', async () => {
      const page = await newE2EPage();
      await page.setContent('<div id="host"><md-time-picker id="a"></md-time-picker></div><md-time-picker id="b"></md-time-picker>');
      await page.evaluate(async () => {
        await (document.getElementById('a') as any).show(); // opened first
        await (document.getElementById('b') as any).show(); // opened last → owns keyboard
      });
      await page.waitForChanges();
      // reparent A (the lower, first-opened picker) while both stay open
      await page.evaluate(() => {
        const a = document.getElementById('a')!;
        document.body.appendChild(a); // disconnect + reconnect
      });
      await page.waitForChanges();
      await page.keyboard.press('Escape');
      await page.waitForChanges();
      const open = await page.evaluate(() => ({
        a: !!document.getElementById('a')!.shadowRoot!.querySelector('.md-time-picker__dialog'),
        b: !!document.getElementById('b')!.shadowRoot!.querySelector('.md-time-picker__dialog'),
      }));
      // B (last opened) still owns the keyboard despite A's re-push to the
      // stack tail — Escape closes B, not the reparented background A.
      expect(open).toEqual({ a: true, b: false });
    });

    it('enabling responsive mid-session on a short viewport falls the open dial back to input', async () => {
      const page = await newE2EPage();
      await page.setViewport({ width: 800, height: 400 }); // shorter than the 460 dial threshold
      await page.setContent('<md-time-picker variant="dial" open></md-time-picker>');
      await page.waitForChanges();
      expect(await page.find('md-time-picker >>> [part="dial"]')).not.toBeNull(); // not yet responsive
      const el = await page.find('md-time-picker');
      el.setProperty('responsive', true);
      await page.waitForChanges();
      // the adaptive fallback applies immediately, not only on the next resize
      expect(await page.find('md-time-picker >>> [part="dial"]')).toBeNull();
      expect(await page.find('md-time-picker >>> [part="input-hour"]')).not.toBeNull();
    });

    it('disabling responsive mid-session does NOT evict a user\'s manual keyboard-input toggle back to dial', async () => {
      const page = await newE2EPage();
      await page.setViewport({ width: 900, height: 800 }); // tall — no adaptive fallback
      await page.setContent('<md-time-picker variant="dial" responsive open></md-time-picker>');
      await page.waitForChanges();
      expect(await page.find('md-time-picker >>> [part="dial"]')).not.toBeNull();
      // user deliberately toggles to keyboard input
      const toggle = await page.find('md-time-picker >>> [part="toggle-mode"]');
      await toggle.click();
      await page.waitForChanges();
      expect(await page.find('md-time-picker >>> [part="input-hour"]')).not.toBeNull();
      // app disables responsive mid-session — must NOT yank the user back to the dial
      const el = await page.find('md-time-picker');
      el.setProperty('responsive', false);
      await page.waitForChanges();
      expect(await page.find('md-time-picker >>> [part="input-hour"]')).not.toBeNull();
      expect(await page.find('md-time-picker >>> [part="dial"]')).toBeNull();
    });

    it('a window resize no longer evicts a user-chosen dial mode (responsive + variant="input")', async () => {
      const page = await newE2EPage();
      await page.setViewport({ width: 900, height: 800 });
      await page.setContent('<md-time-picker responsive variant="input" open></md-time-picker>');
      await page.waitForChanges();
      // user toggles to dial
      const toggle = await page.find('md-time-picker >>> [part="toggle-mode"]');
      await toggle.click();
      await page.waitForChanges();
      expect(await page.find('md-time-picker >>> [part="dial"]')).not.toBeNull();
      // resize (still tall enough for the dial) — must NOT flip back to input
      await page.setViewport({ width: 800, height: 700 });
      await new Promise((r) => setTimeout(r, 200));
      await page.waitForChanges();
      expect(await page.find('md-time-picker >>> [part="dial"]')).not.toBeNull();
    });

    it('horizontal demotion also applies to dial mode reached via the footer toggle', async () => {
      const page = await newE2EPage();
      await page.setViewport({ width: 500, height: 900 });
      await page.setContent('<md-time-picker responsive variant="input" orientation="horizontal" open></md-time-picker>');
      await page.waitForChanges();
      const toggle = await page.find('md-time-picker >>> [part="toggle-mode"]');
      await toggle.click();
      await page.waitForChanges();
      const dialog = await page.find('md-time-picker >>> .md-time-picker__dialog');
      expect(dialog.className).toContain('md-time-picker__dialog--vertical');
      expect(dialog.className).not.toContain('md-time-picker__dialog--horizontal');
    });
  });
});
