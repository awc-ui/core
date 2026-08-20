import { newE2EPage } from '@stencil/core/testing';

/**
 * Stencil doesn't re-export the `E2EPage` interface type, and the
 * underlying puppeteer `Page` doesn't have Stencil's `waitForChanges`
 * extension, so we derive the page type from the helper's return
 * value. This way every helper below stays in sync if Stencil ever
 * changes the shape of E2EPage.
 */
type E2EPage = Awaited<ReturnType<typeof newE2EPage>>;

/**
 * Pin `forced-colors: none` on a page before reading media-sensitive
 * computed styles (:focus-visible outline color, active-tile fill).
 * Stencil shares ONE browser across test-file workers, and a sibling
 * file's forced-colors emulation can intermittently bleed into this
 * page's target — this makes such reads deterministic regardless of
 * what any concurrent file is doing. No-op cost in the common case.
 */
/**
 * Make this page's focus + color rendering DETERMINISTIC for style
 * assertions. Two shared-browser hazards, both fixed here:
 *   1. Focus: Stencil runs all e2e files against ONE browser, and only
 *      one tab is "focused" at a time — a concurrent file steals window
 *      focus, so `:focus` / `:focus-visible` CSS stops matching even
 *      though `document.activeElement` is still set. `setFocusEmulationEnabled`
 *      forces this page to always render as focused (isolation passed
 *      precisely because a lone tab keeps focus; concurrency broke it).
 *   2. Forced-colors: a concurrent forced-colors emulation can bleed;
 *      pin it to `none` so author colors resolve normally.
 */
async function pinNormalColors(page: E2EPage) {
  try {
    const cdp = await (
      page as unknown as {
        createCDPSession: () => Promise<{ send: (m: string, p: unknown) => Promise<unknown>; detach: () => Promise<void> }>;
      }
    ).createCDPSession();
    await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true });
    await cdp.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'forced-colors', value: 'none' }],
    });
  } catch {
    /* CDP unavailable in this env — the assertion still runs in the default context */
  }
}

/**
 * Read author-color computed styles ATOMICALLY under a confirmed
 * non-forced-colors context. Stencil shares ONE browser across test-file
 * workers, so the forced-colors hardening e2e (another file) can flip
 * forced-colors on this page's target mid-test; a plain pin loses that
 * race. This re-pins, then guards + reads in a SINGLE page.evaluate so
 * the style is only returned when matchMedia confirms forced-colors is
 * inactive at read time — otherwise it retries. Race-proof by construction.
 */
async function readInNormalColors<A, T>(page: E2EPage, readFn: (arg: A) => T, arg?: A): Promise<T> {
  const body = readFn.toString();
   
  const evalAny = page.evaluate.bind(page) as (fn: any, ...a: any[]) => Promise<any>;
  for (let attempt = 0; attempt < 12; attempt++) {
    await pinNormalColors(page);
    const r = (await evalAny(
      (fnBody: string, a: unknown) => {
        if (window.matchMedia('(forced-colors: active)').matches) return { __forced__: true };
         
        return { value: new Function('arg', 'return (' + fnBody + ')(arg)')(a) };
      },
      body,
      arg,
    )) as { __forced__?: boolean; value?: T };
    if (r && !r.__forced__) return r.value as T;
    await new Promise((res) => setTimeout(res, 100));
  }
  return (await evalAny(readFn, arg)) as T; // last-ditch: whatever the default media yields
}

describe('md-time-picker (e2e)', () => {
  it('renders in a page', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-time-picker></md-time-picker>');
    const el = await page.find('md-time-picker');
    expect(el).not.toBeNull();
  });

  it('opens dialog on trigger click', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-time-picker label="Pick time"></md-time-picker>');
    const trigger = await page.find('md-time-picker >>> .md-time-picker__field');
    await trigger.click();
    const dialog = await page.find('md-time-picker >>> .md-time-picker__dialog');
    expect(dialog).not.toBeNull();
    expect(dialog.getAttribute('role')).toBe('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
  });

  it('emits mdOpen and mdClose events', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-time-picker></md-time-picker>');
    const openSpy = await page.spyOnEvent('mdOpen');
    const closeSpy = await page.spyOnEvent('mdClose');
    const trigger = await page.find('md-time-picker >>> .md-time-picker__field');
    await trigger.click();
    await page.waitForChanges();
    expect(openSpy).toHaveReceivedEventTimes(1);
    const cancel = await page.find('md-time-picker >>> [part="cancel-button"]');
    await cancel.click();
    await page.waitForChanges();
    expect(closeSpy).toHaveReceivedEventTimes(1);
  });

  it('emits mdChange with the committed value on OK', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-time-picker value="09:30" format="24h"></md-time-picker>');
    const trigger = await page.find('md-time-picker >>> .md-time-picker__field');
    await trigger.click();
    await page.waitForChanges();
    const changeSpy = await page.spyOnEvent('mdChange');
    const ok = await page.find('md-time-picker >>> [part="confirm-button"]');
    await ok.click();
    await page.waitForChanges();
    expect(changeSpy).toHaveReceivedEventTimes(1);
    const detail = changeSpy.firstEvent?.detail as { value: string };
    expect(detail.value).toBe('09:30');
  });

  it('closes on Escape', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-time-picker open></md-time-picker>');
    let dialog = await page.find('md-time-picker >>> .md-time-picker__dialog');
    expect(dialog).not.toBeNull();
    await page.keyboard.press('Escape');
    await page.waitForChanges();
    dialog = await page.find('md-time-picker >>> .md-time-picker__dialog');
    expect(dialog).toBeNull();
  });

  it('switches between dial and input modes', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-time-picker open variant="dial"></md-time-picker>');
    let dial = await page.find('md-time-picker >>> [part="dial"]');
    expect(dial).not.toBeNull();
    const toggle = await page.find('md-time-picker >>> [part="toggle-mode"]');
    await toggle.click();
    await page.waitForChanges();
    const hourInput = await page.find('md-time-picker >>> [part="input-hour"]');
    expect(hourInput).not.toBeNull();
    dial = await page.find('md-time-picker >>> [part="dial"]');
    expect(dial).toBeNull();
  });

  it('updates the trigger value after confirming a new time in input mode', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-time-picker variant="input" format="24h" value="00:00"></md-time-picker>');
    const openTrigger = await page.find('md-time-picker >>> .md-time-picker__field');
    await openTrigger.click();
    await page.waitForChanges();
    // Drive the inputs deterministically via direct value assignment + input event.
    await page.evaluate(() => {
      const host = document.querySelector('md-time-picker') as HTMLElement;
      const sr = host?.shadowRoot;
      const h = sr?.querySelector('[part="input-hour"]') as HTMLInputElement;
      const m = sr?.querySelector('[part="input-minute"]') as HTMLInputElement;
      h.value = '14';
      h.dispatchEvent(new Event('input', { bubbles: true }));
      m.value = '45';
      m.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.waitForChanges();
    const ok = await page.find('md-time-picker >>> [part="confirm-button"]');
    await ok.click();
    await page.waitForChanges();
    // Trigger is now a composed md-text-field; the displayed value
    // lives on its `value` attribute (forwarded by md-time-picker).
    const valueField = await page.find('md-time-picker >>> md-text-field[part="trigger"]');
    expect(await valueField.getProperty('value')).toBe('14:45'); // value is a property, not a reflected attribute
  });

  it('does not open when disabled', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-time-picker disabled></md-time-picker>');
    const trigger = await page.find('md-time-picker >>> .md-time-picker__field');
    await trigger.click();
    await page.waitForChanges();
    const dialog = await page.find('md-time-picker >>> .md-time-picker__dialog');
    expect(dialog).toBeNull();
  });

  it('toggles AM/PM via the period toggle', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-time-picker open value="03:00"></md-time-picker>');
    const pm = await page.find('md-time-picker >>> [part="period-pm"]');
    await pm.click();
    await page.waitForChanges();
    const checked = await pm.getProperty('ariaChecked');
    expect(checked).toBe('true');
  });

  it('exposes all top-level CSS parts', async () => {
    const page = await newE2EPage();
    // Pin to the dial variant — the part inventory here checks the
    // full anatomy (shared HH/MM input row + clock dial). After the
    // variants unified around the typeable HH:MM input row the legacy
    // `time-display` / `hour-display` / `minute-display` parts were
    // removed; the canonical names are `time-area` (dial only),
    // `input-area`, `input-hour`, `input-minute`. The input variant
    // omits `time-area` / `dial-wrap` / `dial` — that contract is
    // pinned by the unit-test parts block.
    await page.setContent('<md-time-picker open variant="dial"></md-time-picker>');
    for (const part of [
      'trigger',
      'dialog',
      'time-area',
      'input-area',
      'input-hour',
      'input-minute',
      'dial-wrap',
      'dial',
      'cancel-button',
      'confirm-button',
    ]) {
      const el = await page.find(`md-time-picker >>> [part="${part}"]`);
      expect(el).not.toBeNull();
    }
  });

  /* ─── MD3 spec dimensions ───────────────────────────────────────
     These tests pin the dialog-anatomy values from the official
     Material Design 3 time-picker spec so future styling tweaks can
     never silently drift them.

     Important: the dialog has a 300ms `scale(0.92 → 1)` entrance
     animation, so measurements taken before it lands are off by
     ~1% (e.g. a 96dp tile reads back as ~95.04). Each test below
     awaits the animation via the `animationend` event (with a small
     wall-clock fallback) before reading any geometry.

     Spec source:
     https://m3.material.io/components/time-pickers/specs */

  /** Wait until the dialog's entrance animation has fully landed.
   *  Shared by the MD3 spec-dimensions and color-roles suites below. */
  async function awaitDialogReady(page: E2EPage) {
    await page.evaluate(() => {
      const host = document.querySelector('md-time-picker');
      const dialog = host?.shadowRoot?.querySelector('[part="dialog"]') as HTMLElement | null;
      if (!dialog) return undefined;
      return new Promise<void>((resolve) => {
        // The dialog entrance animation runs 500ms (long2). The
        // safety timer must comfortably exceed that or every
        // dimension assertion below runs against a transformed
        // element (scale 0.88 → 1) and reads sub-pixel sizes.
        // 800ms gives the animation 300ms of slack to fire its
        // `animationend` event across slower CI machines.
        const timer = setTimeout(resolve, 800);
        dialog.addEventListener(
          'animationend',
          () => { clearTimeout(timer); resolve(); },
          { once: true },
        );
      });
    });
    // Force a fresh layout pass after the animation lands.
    await page.waitForChanges();
  }

  describe('MD3 spec dimensions', () => {

    /** Helper: read the bounding box of a shadow-DOM child by part attr. */
    async function measureByPart(page: E2EPage, part: string) {
      return page.evaluate((p) => {
        const host = document.querySelector('md-time-picker');
        const el = host?.shadowRoot?.querySelector(`[part="${p}"]`) as HTMLElement | null;
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { w: Math.round(r.width), h: Math.round(r.height) };
      }, part);
    }

    /** Helper: read the bounding box of a shadow-DOM child by CSS selector. */
    async function measureBySelector(page: E2EPage, selector: string) {
      return page.evaluate((s) => {
        const host = document.querySelector('md-time-picker');
        const el = host?.shadowRoot?.querySelector(s) as HTMLElement | null;
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { w: Math.round(r.width), h: Math.round(r.height) };
      }, selector);
    }

    it('dial variant matches the 12-hour spec (96×72 input tiles, 52×72 period, 256 dial, 48 handle, 8 centre, 2 track)', async () => {
      const page = await newE2EPage();
      await page.setContent('<md-time-picker open variant="dial" format="12h" value="07:00"></md-time-picker>');
      await awaitDialogReady(page);

      // After unifying both variants around the typeable input row
      // the HH/MM tiles are 96dp × 72dp (M3 *input* spec) instead of
      // the old read-only dial 96×80 — the 8dp delta is absorbed by
      // the "Hour" / "Minute" hint label stacked underneath each
      // input, keeping the overall time-area height aligned with
      // the AM/PM pill alongside it.
      expect(await measureByPart(page, 'input-hour')).toEqual({ w: 96, h: 72 });
      expect(await measureByPart(page, 'input-minute')).toEqual({ w: 96, h: 72 });

      // Period selector container (vertical, default) — 52dp × 72dp
      // (matches the input-tile height, NOT the old 52×80 dial pill).
      expect(await measureByPart(page, 'period-toggle')).toEqual({ w: 52, h: 72 });

      // Clock dial container — 256dp
      expect(await measureByPart(page, 'dial')).toEqual({ w: 256, h: 256 });

      // Clock dial selector handle — 48dp.
      // The handle's parent (.md-time-picker__dial-hand) is rotated, so we
      // intentionally read offsetWidth/Height — the layout box — instead of
      // getBoundingClientRect, which would report the rotated visual bbox
      // (48 × √2 ≈ 68dp).
      const handle = await page.evaluate(() => {
        const host = document.querySelector('md-time-picker');
        const tip = host?.shadowRoot?.querySelector('.md-time-picker__dial-hand-tip') as HTMLElement | null;
        if (!tip) return null;
        return { w: tip.offsetWidth, h: tip.offsetHeight };
      });
      expect(handle).toEqual({ w: 48, h: 48 });

      // Clock dial selector centre — 8dp (no rotation here, but use
      // offsetWidth for parity with the handle measurement).
      const centre = await page.evaluate(() => {
        const host = document.querySelector('md-time-picker');
        const c = host?.shadowRoot?.querySelector('.md-time-picker__dial-center') as HTMLElement | null;
        return c ? { w: c.offsetWidth, h: c.offsetHeight } : null;
      });
      expect(centre).toEqual({ w: 8, h: 8 });

      // Clock dial selector track width — 2dp.
      const trackWidth = await page.evaluate(() => {
        const host = document.querySelector('md-time-picker');
        const line = host?.shadowRoot?.querySelector('.md-time-picker__dial-hand-line') as HTMLElement | null;
        return line ? line.offsetWidth : null;
      });
      expect(trackWidth).toBe(2);

      // Container padding — 24dp on all sides
      const padding = await page.evaluate(() => {
        const host = document.querySelector('md-time-picker');
        const dialog = host?.shadowRoot?.querySelector('[part="dialog"]') as HTMLElement | null;
        if (!dialog) return null;
        const s = getComputedStyle(dialog);
        return {
          top: parseFloat(s.paddingTop),
          right: parseFloat(s.paddingRight),
          bottom: parseFloat(s.paddingBottom),
          left: parseFloat(s.paddingLeft),
        };
      });
      expect(padding).toEqual({ top: 24, right: 24, bottom: 24, left: 24 });
    });

    it('dial variant in 24-hour mode keeps the input tiles at 96×72 and drops the AM/PM toggle', async () => {
      // With the typeable HH/MM input row now shared between variants
      // the 24h dial dialog no longer widens the tiles to 114dp — the
      // input fields stay at the 96dp M3 input spec regardless of
      // clock format. The dialog naturally narrows because there's no
      // AM/PM column on the inline-end edge.
      const page = await newE2EPage();
      await page.setContent('<md-time-picker open variant="dial" format="24h" value="22:05"></md-time-picker>');
      await awaitDialogReady(page);

      expect(await measureByPart(page, 'input-hour')).toEqual({ w: 96, h: 72 });
      expect(await measureByPart(page, 'input-minute')).toEqual({ w: 96, h: 72 });
      const period = await page.find('md-time-picker >>> [part="period-toggle"]');
      expect(period).toBeNull();
    });

    it('centres the dial centre dot on the dial centre and lands the handle on the active number', async () => {
      const page = await newE2EPage();
      await page.setContent('<md-time-picker open variant="dial" format="12h" value="10:30"></md-time-picker>');
      await awaitDialogReady(page);

      // Measure the centre-of-mass for the dial, the centre dot, the
      // hand tip and the active number, then assert the geometric
      // invariants the canonical M3 dial relies on.
      const alignment = await page.evaluate(() => {
        const host = document.querySelector('md-time-picker');
        const sr = host?.shadowRoot;
        const rectCentre = (sel: string) => {
          const el = sr?.querySelector(sel);
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        };
        const dial = rectCentre('[part="dial"]');
        const centre = rectCentre('.md-time-picker__dial-center');
        const tip = rectCentre('.md-time-picker__dial-hand-tip');
        const activeNumber = rectCentre('.md-time-picker__dial-number--active');
        return { dial, centre, tip, activeNumber };
      });

      expect(alignment.dial).not.toBeNull();
      expect(alignment.centre).not.toBeNull();
      expect(alignment.tip).not.toBeNull();
      expect(alignment.activeNumber).not.toBeNull();

      // The centre dot is centred on the dial. A 1px tolerance covers
      // sub-pixel rendering noise; the actual layout target is 0.
      expect(Math.abs(alignment.centre!.x - alignment.dial!.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(alignment.centre!.y - alignment.dial!.y)).toBeLessThanOrEqual(1);

      // The hand tip is centred on the selected number. This locks in
      // the fix for the bug where the handle floated 23dp past the
      // number it pointed to because the hand defaulted to a 100%
      // length while the number ring sits at 80%.
      expect(Math.abs(alignment.tip!.x - alignment.activeNumber!.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(alignment.tip!.y - alignment.activeNumber!.y)).toBeLessThanOrEqual(1);
    });

    it('insets the outer number ring so the 48dp handle hugs the dial edge (~1–2dp clearance)', async () => {
      // The canonical M3 reference (MUI X, Material Web Components,
      // m3.material.io spec image) sits the handle's outer edge
      // *tangent* to the dial circle with only a hair of breathing
      // room. With a 256dp dial (128dp radius), a 48dp handle (24dp
      // radius), and a 0.80 outer ring ratio, the math is:
      //
      //   number center : 0.80 * 128 = 102.4dp from centre
      //   handle outer  : 102.4 + 24 = 126.4dp from centre
      //   clearance     : 128 - 126.4 = ~1.6dp (handle hugs dial)
      //
      // History — what we used to test for:
      //   0.82 (pre-fix)   → handle 1dp PAST dial edge (overflow)
      //   0.75 (overshoot) → handle 8dp away (visually "too inside")
      //   0.80 (current)   → ~1.6dp, matches canonical reference
      //
      // The 2.5dp tolerance accommodates retina sub-pixel rounding
      // and locks the handle to "hugs the edge" without re-allowing
      // overflow or the 8dp empty gap.
      const page = await newE2EPage();
      await page.setContent('<md-time-picker open variant="dial" format="12h" value="10:30"></md-time-picker>');
      await awaitDialogReady(page);

      const geometry = await page.evaluate(() => {
        const host = document.querySelector('md-time-picker');
        const sr = host?.shadowRoot;
        const dial = sr?.querySelector('[part="dial"]') as HTMLElement | null;
        const tip = sr?.querySelector('.md-time-picker__dial-hand-tip') as HTMLElement | null;
        if (!dial || !tip) return null;
        const dialR = dial.getBoundingClientRect();
        const tipR = tip.getBoundingClientRect();
        const dialCx = dialR.left + dialR.width / 2;
        const dialCy = dialR.top + dialR.height / 2;
        const tipCx = tipR.left + tipR.width / 2;
        const tipCy = tipR.top + tipR.height / 2;
        const tipDist = Math.hypot(tipCx - dialCx, tipCy - dialCy);
        const handleRadius = tip.offsetWidth / 2;
        const handleOuter = tipDist + handleRadius;
        return {
          dialRadius: dialR.width / 2,
          tipDist,
          handleOuter,
          clearance: dialR.width / 2 - handleOuter,
        };
      });

      expect(geometry).not.toBeNull();
      // 1px tolerance covers sub-pixel rounding noise on retina.
      expect(Math.abs(geometry!.dialRadius - 128)).toBeLessThanOrEqual(1);
      expect(Math.abs(geometry!.tipDist - 102.4)).toBeLessThanOrEqual(1);
      expect(Math.abs(geometry!.handleOuter - 126.4)).toBeLessThanOrEqual(1);
      // Clearance must sit in the "hugs the dial" band: positive (no
      // overflow) and small (no visible empty gap).
      expect(geometry!.clearance).toBeGreaterThanOrEqual(0);
      expect(geometry!.clearance).toBeLessThanOrEqual(3);
    });

    it('focus ring on the AM/PM tiles matches md-button (3dp secondary outline + 2dp offset)', async () => {
      // Only the AM and PM tiles still get the canonical md-button
      // 3dp secondary outline focus ring — the HH/MM tiles are now
      // typeable <input> elements whose `:focus` paints a 2dp primary
      // border on the field itself (M3 input spec), not an external
      // outline. That input focus treatment is verified separately
      // by the input-focus-color test below.
      //
      // A keyboard-triggered focus is required for :focus-visible to
      // resolve; we drive it via Tab so the heuristic engages just
      // like it would for a real user.
      const page = await newE2EPage();
      await pinNormalColors(page); // immune to a sibling file's forced-colors bleed
      await page.setContent('<md-time-picker open variant="dial" format="12h"></md-time-picker>');
      await awaitDialogReady(page);

      const parts = ['period-am', 'period-pm'] as const;
      for (const part of parts) {
        await page.keyboard.press('Tab');
        await page.evaluate((p) => {
          const host = document.querySelector('md-time-picker');
          const el = host?.shadowRoot?.querySelector(`[part="${p}"]`) as HTMLElement | null;
          el?.focus();
        }, part);
        await page.waitForChanges();

        const style = await readInNormalColors(
          page,
          (p: string) => {
            const host = document.querySelector('md-time-picker');
            const el = host?.shadowRoot?.querySelector(`[part="${p}"]`);
            if (!el) return null;
            const s = getComputedStyle(el);
            return {
              outlineColor: s.outlineColor,
              outlineStyle: s.outlineStyle,
              outlineWidth: s.outlineWidth,
              outlineOffset: s.outlineOffset,
            };
          },
          part,
        );

        expect(style).not.toBeNull();
        // sys-color-secondary in the default theme resolves to #625B71 →
        // rgb(98, 91, 113).
        expect(style!.outlineColor).toBe('rgb(98, 91, 113)');
        expect(style!.outlineStyle).toBe('solid');
        expect(style!.outlineWidth).toBe('3px');
        expect(style!.outlineOffset).toBe('2px');
      }
    });

    it('focused HH/MM input paints ONLY the M3 primary-container fill + 2dp primary border (no extra outer ring)', async () => {
      // The HH/MM <input> elements get TWO focus treatments — and
      // ONLY two — when the user lands on them:
      //
      //   1. M3 text-field "active" fill — background: primary-container.
      //   2. M3 text-field "active" border — 2dp primary.
      //
      // We deliberately do NOT layer the dialog-wide 3dp secondary
      // focus ring on top of the input (the way AM/PM tiles, the
      // mode-toggle icon button, and Cancel / OK do). The primary
      // border is already a strong, dial-meaningful "this is the
      // segment being edited" indicator, and adding a second outer
      // ring read as a double-bordered field — visually noisy and
      // ambiguous about which border the user should treat as the
      // focus signal. The browser-native caret already covers the
      // "keyboard is here" cue inside the field.
      //
      // The test pins:
      //   - background → primary-container
      //   - border    → 2dp primary
      //   - outline   → "none" (no extra ring)
      const page = await newE2EPage();
      await pinNormalColors(page); // immune to a sibling file's forced-colors bleed
      await page.setContent('<md-time-picker open value="07:30"></md-time-picker>');
      await awaitDialogReady(page);

      // The picker auto-focuses HH on open; force a keyboard Tab
      // round-trip so :focus-visible engages just like for a real user.
      await page.keyboard.press('Tab');
      await page.evaluate(() => {
        const host = document.querySelector('md-time-picker');
        const el = host?.shadowRoot?.querySelector('[part="input-hour"]') as HTMLElement | null;
        el?.focus();
      });
      await page.waitForChanges();

      const style = await readInNormalColors(page, () => {
        const host = document.querySelector('md-time-picker');
        const el = host?.shadowRoot?.querySelector('[part="input-hour"]');
        if (!el) return null;
        const s = getComputedStyle(el);
        return {
          background: s.backgroundColor,
          borderColor: s.borderTopColor,
          borderWidth: s.borderTopWidth,
          outlineStyle: s.outlineStyle,
          outlineWidth: s.outlineWidth,
        };
      });

      expect(style).not.toBeNull();
      // primary-container in the default theme → #EADDFF → rgb(234, 221, 255)
      expect(style!.background).toBe('rgb(234, 221, 255)');
      // primary in the default theme → #6750A4 → rgb(103, 80, 164)
      expect(style!.borderColor).toBe('rgb(103, 80, 164)');
      expect(style!.borderWidth).toBe('2px');
      // No layered outline — the inner primary border is the only
      // focus indicator the input gets.
      // Browsers normalize "no outline" to either `outline-style: none`
      // or `outline-width: 0px` (or both). Either is acceptable as
      // long as no ring actually paints.
      const noRing = style!.outlineStyle === 'none' || style!.outlineWidth === '0px';
      expect(noRing).toBe(true);
    });

    it('renders every dial number in the same Body Large size with no tracking', async () => {
      // MD3 spec assigns body-large (16dp / 24 line-height / 400 weight)
      // to *every* dial number on both rings of the 24-hour dial. The
      // selected number stays at the same font-size — only its weight
      // shifts to 500 so it reads inside the primary handle. Tracking
      // is forced to 0 because the canonical body-large 0.5px tracking
      // pushes two-digit numbers (10, 11, 12, 13 ...) visibly off-centre
      // relative to single-digit ones.
      const page = await newE2EPage();
      await page.setContent('<md-time-picker open variant="dial" format="24h" value="22:05"></md-time-picker>');
      await awaitDialogReady(page);

      const typography = await page.evaluate(() => {
        const host = document.querySelector('md-time-picker');
        const sr = host?.shadowRoot;
        const nums = Array.from(sr?.querySelectorAll('.md-time-picker__dial-number') ?? []);
        const read = (el: Element) => {
          const s = getComputedStyle(el);
          return {
            fontSize: s.fontSize,
            fontWeight: s.fontWeight,
            letterSpacing: s.letterSpacing,
            opacity: s.opacity,
          };
        };
        return {
          outer: nums
            .filter(
              (n) =>
                !n.classList.contains('md-time-picker__dial-number--inner') &&
                !n.classList.contains('md-time-picker__dial-number--active'),
            )
            .map(read),
          inner: nums
            .filter(
              (n) =>
                n.classList.contains('md-time-picker__dial-number--inner') &&
                !n.classList.contains('md-time-picker__dial-number--active'),
            )
            .map(read),
          active: nums.filter((n) => n.classList.contains('md-time-picker__dial-number--active')).map(read),
        };
      });

      expect(typography.outer.length).toBeGreaterThan(0);
      expect(typography.inner.length).toBeGreaterThan(0);
      expect(typography.active.length).toBe(1);

      const allUnselected = [...typography.outer, ...typography.inner];
      for (const style of allUnselected) {
        expect(style.fontSize).toBe('16px');
        expect(style.fontWeight).toBe('400');
        // Browsers normalise `letter-spacing: 0` to `normal`.
        expect(style.letterSpacing).toBe('normal');
        expect(style.opacity).toBe('1');
      }
      // Active number keeps the same size and tracking — only weight changes.
      expect(typography.active[0].fontSize).toBe('16px');
      expect(typography.active[0].fontWeight).toBe('500');
      expect(typography.active[0].letterSpacing).toBe('normal');
      expect(typography.active[0].opacity).toBe('1');
    });

    it('horizontal period selector layout renders a 216×38 toggle with 8dp corners', async () => {
      const page = await newE2EPage();
      // The 216×38 horizontal period pill replaces the 52×80 vertical
      // stack inside the dial variant. Pin variant="dial" so the test
      // doesn't depend on the component-level default.
      await page.setContent('<md-time-picker open variant="dial" format="12h" period-layout="horizontal" value="14:30"></md-time-picker>');
      await awaitDialogReady(page);

      // Time tiles use the canonical 96×72 input size in both variants.
      expect(await measureByPart(page, 'input-hour')).toEqual({ w: 96, h: 72 });
      expect(await measureByPart(page, 'input-minute')).toEqual({ w: 96, h: 72 });

      // Period selector container (horizontal) — 216dp × 38dp
      expect(await measureByPart(page, 'period-toggle')).toEqual({ w: 216, h: 38 });

      // ARIA orientation reflects the new layout.
      const period = await page.find('md-time-picker >>> [part="period-toggle"]');
      expect(period.getAttribute('aria-orientation')).toBe('horizontal');

      // Corner radius — `shape-corner-small` (8dp) on every corner. The
      // horizontal toggle is intentionally NOT a full pill: it pairs
      // with the 8dp HH:MM tiles, so a matching radius keeps the time
      // area's corner language consistent. The vertical 52×80 toggle
      // uses the same value, which the next assertion also verifies.
      const horizontalCorners = await page.evaluate(() => {
        const host = document.querySelector('md-time-picker');
        const el = host?.shadowRoot?.querySelector('[part="period-toggle"]') as HTMLElement | null;
        if (!el) return null;
        const s = getComputedStyle(el);
        return {
          tl: parseFloat(s.borderTopLeftRadius),
          tr: parseFloat(s.borderTopRightRadius),
          bl: parseFloat(s.borderBottomLeftRadius),
          br: parseFloat(s.borderBottomRightRadius),
        };
      });
      expect(horizontalCorners).toEqual({ tl: 8, tr: 8, bl: 8, br: 8 });
    });

    /* ─── Input variant ─────────────────────────────────────────────
       Canonical MD3 *input* spec sheet (the "Time picker input"
       reference image):

         padding_l(24) + input(96) + colon(24) + input(96)
            + gap(12) + period(52) + padding_r(24) = 328dp wide (12h)

       Anatomy mirrors the spec image:
         • Headline left-aligned, 20dp gap below
         • 72dp input row: HH:MM inputs + AM/PM stack, all the same
           block-size so they top-align cleanly with the hint labels
           stacked underneath each input
         • 24dp gap below the input area to the footer
         • 24dp padding on every dialog edge

       Asserting each measurement here means a future refactor that
       drifts a single dimension off-spec fails noisily. */
    it('input variant matches the 12-hour spec (96×72 inputs, 24dp colon, 12dp gap, 52×72 AM/PM)', async () => {
      const page = await newE2EPage();
      await page.setContent('<md-time-picker open variant="input" format="12h" value="07:00"></md-time-picker>');
      await awaitDialogReady(page);

      // HH/MM input fields — 96dp × 72dp.
      expect(await measureByPart(page, 'input-hour')).toEqual({ w: 96, h: 72 });
      expect(await measureByPart(page, 'input-minute')).toEqual({ w: 96, h: 72 });

      // AM/PM toggle in input mode — 52dp × 72dp (the 80dp dial-variant
      // height shrinks by 8dp to align with the 72dp input row).
      expect(await measureByPart(page, 'period-toggle')).toEqual({ w: 52, h: 72 });

      // Colon separator column — 24dp wide.
      const separator = await page.evaluate(() => {
        const host = document.querySelector('md-time-picker');
        const el = host?.shadowRoot?.querySelector('.md-time-picker__input-separator') as HTMLElement | null;
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { w: Math.round(r.width), h: Math.round(r.height) };
      });
      expect(separator).toEqual({ w: 24, h: 72 });

      // 12dp inline-start gap between the MM input and the AM/PM
      // toggle — `margin-inline-start: 12px` on the vertical period
      // selector, with the parent flex `gap: 0` so no extra slack
      // creeps in.
      const periodGap = await page.evaluate(() => {
        const host = document.querySelector('md-time-picker');
        const mm = host?.shadowRoot?.querySelector('[part="input-minute"]') as HTMLElement | null;
        const period = host?.shadowRoot?.querySelector('[part="period-toggle"]') as HTMLElement | null;
        if (!mm || !period) return null;
        return Math.round(period.getBoundingClientRect().left - mm.getBoundingClientRect().right);
      });
      expect(periodGap).toBe(12);

      // Dialog padding — 24dp on every edge.
      const padding = await page.evaluate(() => {
        const host = document.querySelector('md-time-picker');
        const dialog = host?.shadowRoot?.querySelector('[part="dialog"]') as HTMLElement | null;
        if (!dialog) return null;
        const s = getComputedStyle(dialog);
        return {
          top: parseFloat(s.paddingTop),
          right: parseFloat(s.paddingRight),
          bottom: parseFloat(s.paddingBottom),
          left: parseFloat(s.paddingLeft),
        };
      });
      expect(padding).toEqual({ top: 24, right: 24, bottom: 24, left: 24 });

      // Total dialog width — 328dp = 24 + 96 + 24 + 96 + 12 + 52 + 24
      const dialogWidth = await page.evaluate(() => {
        const host = document.querySelector('md-time-picker');
        const d = host?.shadowRoot?.querySelector('[part="dialog"]') as HTMLElement | null;
        return d ? Math.round(d.getBoundingClientRect().width) : null;
      });
      expect(dialogWidth).toBe(328);
    });

    it('input variant does not render the dial-only `time-area` / `dial` parts', async () => {
      // Both variants share the typeable HH/MM input row, but the
      // input variant skips the `time-area` wrapper (it has nothing
      // to wrap besides the input-area itself) and the clock dial.
      // Surfacing them as empty hooks would let consumers write CSS
      // that visually breaks in input mode without warning.
      const page = await newE2EPage();
      await page.setContent('<md-time-picker open variant="input" format="12h" value="07:00"></md-time-picker>');
      await awaitDialogReady(page);

      const hourTile = await page.find('md-time-picker >>> [part="dial"]');
      const minuteTile = await page.find('md-time-picker >>> [part="dial-wrap"]');
      const timeArea = await page.find('md-time-picker >>> [part="time-area"]');
      expect(hourTile).toBeNull();
      expect(minuteTile).toBeNull();
      expect(timeArea).toBeNull();

      // Input fields are present.
      expect(await page.find('md-time-picker >>> [part="input-hour"]')).not.toBeNull();
      expect(await page.find('md-time-picker >>> [part="input-minute"]')).not.toBeNull();
    });

    it('input variant keeps the active input filled with primary-container after focus', async () => {
      /* CSS cascade regression: the generic `.md-time-picker__input:focus`
         rule has higher specificity than `.md-time-picker__input--active`,
         so without an explicit `--active:focus` override the active
         input's primary-container fill flickered back to
         surface-container-highest the moment the user clicked into it.
         The assertion below pins the canonical M3 behavior — the
         focused active input MUST keep its primary-container fill and
         only gain a primary 2dp outline on top. The picker auto-
         focuses HH on open, so we assert the focused state directly. */
      const page = await newE2EPage();
      await pinNormalColors(page); // author-color reads are meaningless under a forced-colors bleed
      await page.setContent(
        `<style>:root {
          --md-sys-color-primary: rgb(1, 1, 1);
          --md-sys-color-primary-container: rgb(3, 3, 3);
          --md-sys-color-on-primary-container: rgb(4, 4, 4);
          --md-sys-color-surface-container-highest: rgb(8, 8, 8);
          --md-sys-color-on-surface: rgb(9, 9, 9);
        }</style>
        <md-time-picker open variant="input" format="24h" value="07:00"></md-time-picker>`,
      );
      await awaitDialogReady(page);

      // Ensure HH has focus (open behavior auto-focuses it; this
      // explicit call guards against headless-Chromium quirks where
      // the auto-focus is dropped before getComputedStyle runs).
      await page.evaluate(() => {
        const host = document.querySelector('md-time-picker');
        const hour = host?.shadowRoot?.querySelector('[part="input-hour"]') as HTMLInputElement | null;
        hour?.focus();
      });
      await page.waitForChanges();

      const focusedStyle = await readInNormalColors(page, () => {
        const host = document.querySelector('md-time-picker');
        const hour = host?.shadowRoot?.querySelector('[part="input-hour"]') as HTMLInputElement | null;
        if (!hour) return null;
        const s = getComputedStyle(hour);
        return {
          background: s.backgroundColor.trim(),
          color: s.color.trim(),
          borderColor: s.borderColor.trim(),
          hasActiveClass: hour.classList.contains('md-time-picker__input--active'),
          // Sanity-check focus actually landed on the element so the
          // assertions above are testing the focused state, not the
          // resting state.
          isActiveElement: host?.shadowRoot?.activeElement === hour,
        };
      });

      expect(focusedStyle).toEqual({
        background: 'rgb(3, 3, 3)',     // primary-container — UNCHANGED on focus
        color: 'rgb(4, 4, 4)',          // on-primary-container — UNCHANGED on focus
        borderColor: 'rgb(1, 1, 1)',    // primary — gained on focus
        hasActiveClass: true,
        isActiveElement: true,
      });
    });

    it('input variant focuses HH on open with the seed value SELECTED (first keystroke replaces)', async () => {
      /* Regression for the open-time UX: the picker MUST focus the
         HH input so the user can type immediately, with the seed
         value selected. The seeded buffer is always already at
         maxLength ("14"), so a caret parked at the end silently
         swallowed the first keystroke — the user typed 9:30 and got
         14:30. Select-all matches what native <input type="time">
         segments do on focus: type-to-replace, arrow-to-tweak. */
      const page = await newE2EPage();
      await page.setContent('<md-time-picker open variant="input" format="24h" value="14:30"></md-time-picker>');
      await awaitDialogReady(page);

      const focusState = await page.evaluate(() => {
        const host = document.querySelector('md-time-picker');
        const hour = host?.shadowRoot?.querySelector('[part="input-hour"]') as HTMLInputElement | null;
        if (!hour) return null;
        return {
          value: hour.value,
          isActiveElement: host?.shadowRoot?.activeElement === hour,
          // full selection: the next keystroke replaces the seed
          selectionStart: hour.selectionStart,
          selectionEnd: hour.selectionEnd,
          selectionLength: (hour.selectionEnd ?? 0) - (hour.selectionStart ?? 0),
        };
      });

      expect(focusState).toEqual({
        value: '14',
        isActiveElement: true,
        selectionStart: 0,    // whole seed selected
        selectionEnd: 2,
        selectionLength: 2,
      });
    });

    it('toggling from dial → input re-focuses HH with the seed value selected', async () => {
      // The mode toggle re-runs the same focus path as initial
      // open; same regression target — a caret-at-end here would
      // reintroduce the first-keystroke swallow on the toggle path
      // independently of the open path.
      const page = await newE2EPage();
      await page.setContent('<md-time-picker open variant="dial" format="24h" value="14:30"></md-time-picker>');
      await awaitDialogReady(page);

      // dial → input
      await page.evaluate(() => {
        const host = document.querySelector('md-time-picker');
        const toggle = host?.shadowRoot?.querySelector('[part="toggle-mode"]') as HTMLElement | null;
        toggle?.dispatchEvent(new CustomEvent('mdClick', { bubbles: true, composed: true }));
      });
      await page.waitForChanges();
      // Allow the rAF inside toggleMode to flush.
      await new Promise((r) => setTimeout(r, 50));
      await page.waitForChanges();

      const focusState = await page.evaluate(() => {
        const host = document.querySelector('md-time-picker');
        const hour = host?.shadowRoot?.querySelector('[part="input-hour"]') as HTMLInputElement | null;
        if (!hour) return null;
        return {
          value: hour.value,
          isActiveElement: host?.shadowRoot?.activeElement === hour,
          selectionLength: (hour.selectionEnd ?? 0) - (hour.selectionStart ?? 0),
          caretAtEnd: hour.selectionStart === (hour.value ?? '').length,
        };
      });
      expect(focusState).toEqual({
        value: '14',
        isActiveElement: true,
        selectionLength: 2,
        caretAtEnd: false,
      });
    });

    it('releasing an hour-drag on the dial auto-focuses the MM input (real browser)', async () => {
      // E2E counterpart to the spec-side spy test. Verifies the
      // contract end-to-end in a real browser where activeElement
      // tracking inside the shadow DOM is accurate. After the user
      // commits an hour by lifting the pointer, the dial face flips
      // to the minute ring AND the MM input focuses with its seed
      // selected — so the user can immediately type the minute
      // (replacing the seed) or drag the minute hand.
      const page = await newE2EPage();
      await page.setContent(
        '<md-time-picker open variant="dial" format="24h" value="03:30"></md-time-picker>',
      );
      await awaitDialogReady(page);

      // Drive the pointerdown/pointerup pair directly on the dial
      // — we just need the state machine to fire onDialPointerUp
      // in its hour-mode branch, the exact angle doesn't matter
      // for the focus contract.
      await page.evaluate(() => {
        const host = document.querySelector('md-time-picker');
        const dial = host?.shadowRoot?.querySelector('[part="dial"]') as HTMLElement | null;
        if (!dial) return;
        const rect = dial.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2 - 50;
        dial.dispatchEvent(
          new PointerEvent('pointerdown', { clientX: cx, clientY: cy, bubbles: true, pointerId: 1 }),
        );
        dial.dispatchEvent(
          new PointerEvent('pointerup', { clientX: cx, clientY: cy, bubbles: true, pointerId: 1 }),
        );
      });
      // Flush the rAF that defers the focus call.
      await new Promise((r) => setTimeout(r, 50));
      await page.waitForChanges();

      const focusState = await page.evaluate(() => {
        const host = document.querySelector('md-time-picker');
        const minute = host?.shadowRoot?.querySelector('[part="input-minute"]') as HTMLInputElement | null;
        if (!minute) return null;
        return {
          value: minute.value,
          isActiveElement: host?.shadowRoot?.activeElement === minute,
          // Selection discipline: seed fully selected, matching
          // every other auto-focus path in the picker (the "30"
          // seed is at maxLength — a bare caret would swallow the
          // first typed digit).
          selectionLength: (minute.selectionEnd ?? 0) - (minute.selectionStart ?? 0),
          caretAtEnd: minute.selectionStart === (minute.value ?? '').length,
        };
      });

      expect(focusState).toEqual({
        value: '30',
        isActiveElement: true,
        selectionLength: 2,
        caretAtEnd: false,
      });
    });

    it('input variant in 24-hour mode does not render the AM/PM toggle', async () => {
      // The M3 *12-hour and 24-hour time picker inputs* spec sheet
      // shows the 24h variant with the AM/PM column entirely absent.
      // 24-hour time has no period concept, so rendering the toggle
      // would be both confusing and a WCAG concern (no semantic role
      // for an always-unselectable widget).
      const page = await newE2EPage();
      await page.setContent('<md-time-picker open variant="input" format="24h" value="20:00"></md-time-picker>');
      await awaitDialogReady(page);

      const period = await page.find('md-time-picker >>> [part="period-toggle"]');
      const am = await page.find('md-time-picker >>> [part="period-am"]');
      const pm = await page.find('md-time-picker >>> [part="period-pm"]');
      expect(period).toBeNull();
      expect(am).toBeNull();
      expect(pm).toBeNull();

      // The inputs themselves still match the spec dimensions, just
      // without the trailing AM/PM column.
      expect(await measureByPart(page, 'input-hour')).toEqual({ w: 96, h: 72 });
      expect(await measureByPart(page, 'input-minute')).toEqual({ w: 96, h: 72 });
    });

    it('input variant always uses the vertical 52×72 AM/PM toggle, even when period-layout="horizontal"', async () => {
      // The author asked for the 216×38 horizontal pill, but the
      // input dialog has no room for it inside its single 72dp row
      // — the spec only shows the 52×72 vertical stack. We coerce
      // the layout via `effectivePeriodLayout` (see the getter) so
      // the same prop value can stay safe across dial and input.
      const page = await newE2EPage();
      await page.setContent(
        '<md-time-picker open variant="input" format="12h" period-layout="horizontal" value="07:00"></md-time-picker>',
      );
      await awaitDialogReady(page);
      expect(await measureByPart(page, 'period-toggle')).toEqual({ w: 52, h: 72 });
    });

    it('vertical and horizontal period selectors share the same 8dp corner radius', async () => {
      // Regression test: it should be possible to swap `period-layout`
      // without re-skinning the toggle. Both layouts must land on the
      // canonical `shape-corner-small` (8dp) the rest of the picker's
      // headline tiles also use.
      const page = await newE2EPage();
      await page.setContent('<md-time-picker open format="12h" period-layout="vertical" value="07:00"></md-time-picker>');
      await awaitDialogReady(page);

      const verticalRadius = await page.evaluate(() => {
        const host = document.querySelector('md-time-picker');
        const el = host?.shadowRoot?.querySelector('[part="period-toggle"]') as HTMLElement | null;
        return el ? parseFloat(getComputedStyle(el).borderTopLeftRadius) : null;
      });
      expect(verticalRadius).toBe(8);
    });

    /* ─── Horizontal (landscape) dial dialog ────────────────────────
       Canonical MD3 landscape dial sheet:

         padding_l(24) + tile(96) + colon(24) + tile(96)
            + gap(52) + dial(256) + padding_r(24) = 572dp (12h)

       Anatomy mirrors the spec image:
         • Headline left-aligned at the top, full-width
         • Left column: HH:MM row → 16dp gap → 216×38 AM/PM pill
         • Right column: 256dp dial
         • Footer below both columns, full-width

       These assertions are intentionally exact so any future refactor
       that drifts even 1dp away from the spec sheet fails noisily. */
    it('horizontal orientation lays out the 12-hour landscape dialog with input tiles + 216×38 AM/PM pill', async () => {
      const page = await newE2EPage();
      // `orientation="horizontal"` is meaningful only for the dial
      // variant — the spec ignores it for input pickers. Pin variant
      // explicitly so this test doesn't depend on the default.
      await page.setContent('<md-time-picker open variant="dial" format="12h" orientation="horizontal" value="07:00"></md-time-picker>');
      await awaitDialogReady(page);

      // Dialog padding stays at the canonical 24dp on every edge.
      // The total dialog width is implicitly 24 + 96 + 24 + 96 + 52 + 256 + 24 = 572dp,
      // but we don't pin it here because the typeable input row uses
      // the smaller 96×72 tile (instead of the old read-only 96×80 dial
      // tile) and a future tweak to the hint label could subtly shift
      // intrinsic width. Per-tile measurements below pin the contract.
      const dialogPadding = await page.evaluate(() => {
        const host = document.querySelector('md-time-picker');
        const d = host?.shadowRoot?.querySelector('[part="dialog"]') as HTMLElement | null;
        if (!d) return null;
        const s = getComputedStyle(d);
        return {
          paddingTop: parseFloat(s.paddingTop),
          paddingRight: parseFloat(s.paddingRight),
          paddingBottom: parseFloat(s.paddingBottom),
          paddingLeft: parseFloat(s.paddingLeft),
        };
      });
      expect(dialogPadding).toEqual({ paddingTop: 24, paddingRight: 24, paddingBottom: 24, paddingLeft: 24 });

      // HH/MM input tiles are 96×72 in both orientations; the dial
      // stays at the canonical 256dp.
      expect(await measureByPart(page, 'input-hour')).toEqual({ w: 96, h: 72 });
      expect(await measureByPart(page, 'input-minute')).toEqual({ w: 96, h: 72 });
      expect(await measureByPart(page, 'dial')).toEqual({ w: 256, h: 256 });

      // AM/PM toggle is forced to the 216×38 horizontal pill regardless
      // of the author's `period-layout` value, because the 52×72
      // vertical pill cannot share the left column with HH:MM.
      expect(await measureByPart(page, 'period-toggle')).toEqual({ w: 216, h: 38 });

      // Body uses flex-row with a 52dp column-gap (the spec gap between
      // the time-area and the dial).
      const bodyLayout = await page.evaluate(() => {
        const host = document.querySelector('md-time-picker');
        const body = host?.shadowRoot?.querySelector('[part="body"]') as HTMLElement | null;
        if (!body) return null;
        const s = getComputedStyle(body);
        return {
          display: s.display,
          flexDirection: s.flexDirection,
          columnGap: parseFloat(s.columnGap),
          alignItems: s.alignItems,
        };
      });
      expect(bodyLayout).toEqual({ display: 'flex', flexDirection: 'row', columnGap: 52, alignItems: 'flex-start' });

      // Geometric check: the inputs row is wrapped in input-area which
      // is wrapped in time-area. We measure the dial against the
      // outer time-area so the typeable row's hint labels (which
      // extend block-end of the input fields) don't skew the gap.
      const geometry = await page.evaluate(() => {
        const host = document.querySelector('md-time-picker');
        const ta = host?.shadowRoot?.querySelector('[part="time-area"]') as HTMLElement | null;
        const dial = host?.shadowRoot?.querySelector('[part="dial"]') as HTMLElement | null;
        if (!ta || !dial) return null;
        return Math.round(dial.getBoundingClientRect().left - ta.getBoundingClientRect().right);
      });
      expect(geometry).toBe(52);
    });

    it('horizontal orientation in 24-hour mode keeps input tiles at 96×72 and drops the AM/PM toggle', async () => {
      const page = await newE2EPage();
      await page.setContent('<md-time-picker open variant="dial" format="24h" orientation="horizontal" value="22:05"></md-time-picker>');
      await awaitDialogReady(page);

      // With the unified typeable input row, 24h mode no longer
      // widens the tiles — they stay at the 96dp M3 input spec
      // regardless of clock format. The dialog naturally narrows
      // because the AM/PM column is absent.
      expect(await measureByPart(page, 'input-hour')).toEqual({ w: 96, h: 72 });
      expect(await measureByPart(page, 'input-minute')).toEqual({ w: 96, h: 72 });

      // No period selector is rendered in 24h mode.
      expect(await measureByPart(page, 'period-toggle')).toBeNull();

      // The 52dp dial gap survives the format change; measure against
      // the time-area wrapper so the hint labels under the inputs
      // don't poison the gap arithmetic.
      const dialGap = await page.evaluate(() => {
        const host = document.querySelector('md-time-picker');
        const ta = host?.shadowRoot?.querySelector('[part="time-area"]') as HTMLElement | null;
        const dial = host?.shadowRoot?.querySelector('[part="dial"]') as HTMLElement | null;
        if (!ta || !dial) return null;
        return Math.round(dial.getBoundingClientRect().left - ta.getBoundingClientRect().right);
      });
      expect(dialGap).toBe(52);
    });

    it('horizontal orientation falls back to the vertical 328dp dialog for the input variant', async () => {
      // `orientation="horizontal"` only applies to the dial variant —
      // the input dialog stays at 328dp because there's no clock face
      // to balance against in the right column.
      const page = await newE2EPage();
      await page.setContent('<md-time-picker open variant="input" orientation="horizontal" value="14:30"></md-time-picker>');
      await awaitDialogReady(page);

      const result = await page.evaluate(() => {
        const host = document.querySelector('md-time-picker');
        const d = host?.shadowRoot?.querySelector('[part="dialog"]') as HTMLElement | null;
        if (!d) return null;
        return {
          width: Math.round(d.getBoundingClientRect().width),
          hasHorizontalClass: d.classList.contains('md-time-picker__dialog--horizontal'),
        };
      });
      expect(result).toEqual({ width: 328, hasHorizontalClass: false });
    });
  });

  /* ─── Mode swap (dial ⇄ input) ───────────────────────────────────
     Two coupled requirements that must travel together:

       (1) The HH/MM digits MUST be visibly smaller in input mode
           than in dial mode. The dial variant uses M3
           display-large (57px) for its 96×80 tiles; the input
           variant uses M3 display-medium (45px) inside the 96×72
           fields. The 12dp font-size delta is what makes the
           toggle between modes read as a *focus shift* (read →
           edit) rather than a layout reshuffle.

       (2) The mounted sub-tree (.dial-wrap or .input-area) MUST
           bloom in with M3 emphasized-decelerate motion every
           time it mounts, which Stencil triggers whenever the
           mode flips. This is the "expressive" feedback the user
           experiences when tapping the keyboard / clock icon.

     Both requirements are CSS-level (no JS state to read), so the
     tests read computed styles and the resolved animation
     longhand. */
  describe('Mode swap (dial ⇄ input)', () => {
    it('input digits render in display-medium (45px) — one step smaller than the dial tiles', async () => {
      const page = await newE2EPage();
      await page.setContent('<md-time-picker open variant="input" format="12h" value="07:00"></md-time-picker>');
      await awaitDialogReady(page);

      const sizes = await page.evaluate(() => {
        const host = document.querySelector('md-time-picker');
        const hour = host?.shadowRoot?.querySelector('[part="input-hour"]') as HTMLElement | null;
        const minute = host?.shadowRoot?.querySelector('[part="input-minute"]') as HTMLElement | null;
        const separator = host?.shadowRoot?.querySelector('.md-time-picker__input-separator') as HTMLElement | null;
        if (!hour || !minute || !separator) return null;
        return {
          hour: parseFloat(getComputedStyle(hour).fontSize),
          minute: parseFloat(getComputedStyle(minute).fontSize),
          separator: parseFloat(getComputedStyle(separator).fontSize),
        };
      });
      // display-medium = 45px per the M3 typescale token set.
      expect(sizes).toEqual({ hour: 45, minute: 45, separator: 45 });
    });

    it('dial variant uses the SAME display-medium (45px) input tiles as input mode (unified headline)', async () => {
      // After unifying both variants around the typeable HH:MM input
      // row, the dial variant no longer paints display-large (57px)
      // read-only tiles — both modes share the input-spec
      // display-medium (45px) typeable tiles. The visual mode shift
      // is now communicated by the dial face appearing / disappearing
      // below the row, not by a glyph-size delta in the headline.
      const page = await newE2EPage();
      await page.setContent('<md-time-picker open variant="dial" format="12h" value="07:00"></md-time-picker>');
      await awaitDialogReady(page);

      const sizes = await page.evaluate(() => {
        const host = document.querySelector('md-time-picker');
        const hour = host?.shadowRoot?.querySelector('[part="input-hour"]') as HTMLElement | null;
        const minute = host?.shadowRoot?.querySelector('[part="input-minute"]') as HTMLElement | null;
        const separator = host?.shadowRoot?.querySelector('.md-time-picker__input-separator') as HTMLElement | null;
        if (!hour || !minute || !separator) return null;
        return {
          hour: parseFloat(getComputedStyle(hour).fontSize),
          minute: parseFloat(getComputedStyle(minute).fontSize),
          separator: parseFloat(getComputedStyle(separator).fontSize),
        };
      });
      // display-medium = 45px in both variants.
      expect(sizes).toEqual({ hour: 45, minute: 45, separator: 45 });
    });

    it('mounts the dial-wrap with the emphasized-decelerate bloom animation', async () => {
      // Both branches share the same `md-time-picker-mode-in`
      // keyframe + long1 (450ms) + emphasized-decelerate
      // (cubic-bezier(0.05, 0.7, 0.1, 1)) — they're symmetric so
      // the swap feels balanced regardless of direction. The
      // bloom is intentionally 50ms QUICKER than the outer dialog
      // unfold (long2 / 500ms) so the inner content settles just
      // before the dialog locks in, reading as a single staged
      // motion rather than two competing animations.
      const page = await newE2EPage();
      await page.setContent('<md-time-picker open variant="dial" format="12h" value="07:00"></md-time-picker>');
      await awaitDialogReady(page);

      const anim = await page.evaluate(() => {
        const host = document.querySelector('md-time-picker');
        const wrap = host?.shadowRoot?.querySelector('.md-time-picker__dial-wrap') as HTMLElement | null;
        if (!wrap) return null;
        const s = getComputedStyle(wrap);
        return {
          name: s.animationName,
          duration: s.animationDuration,
          easing: s.animationTimingFunction,
          fillMode: s.animationFillMode,
          transformOrigin: s.transformOrigin,
        };
      });
      expect(anim?.name).toBe('md-time-picker-mode-in');
      expect(anim?.duration).toBe('0.45s');
      // Headless Chromium normalizes `cubic-bezier()` formatting
      // but preserves the values; assert as a regex to stay
      // tolerant of trivial whitespace diffs.
      expect(anim?.easing).toMatch(/cubic-bezier\(\s*0\.05\s*,\s*0\.7\s*,\s*0\.1\s*,\s*1\s*\)/);
      expect(anim?.fillMode).toBe('both');
      // `center top` resolves to a length / keyword pair; just
      // assert the block-axis anchor is at the top so the bloom
      // visually grows down from the headline.
      expect(anim?.transformOrigin).toMatch(/0px$/);
    });

    it('mounts the input-area with the same emphasized-decelerate bloom', async () => {
      const page = await newE2EPage();
      await page.setContent('<md-time-picker open variant="input" format="12h" value="07:00"></md-time-picker>');
      await awaitDialogReady(page);

      const anim = await page.evaluate(() => {
        const host = document.querySelector('md-time-picker');
        const area = host?.shadowRoot?.querySelector('.md-time-picker__input-area') as HTMLElement | null;
        if (!area) return null;
        const s = getComputedStyle(area);
        return {
          name: s.animationName,
          duration: s.animationDuration,
          easing: s.animationTimingFunction,
          fillMode: s.animationFillMode,
        };
      });
      expect(anim?.name).toBe('md-time-picker-mode-in');
      expect(anim?.duration).toBe('0.45s');
      expect(anim?.easing).toMatch(/cubic-bezier\(\s*0\.05\s*,\s*0\.7\s*,\s*0\.1\s*,\s*1\s*\)/);
      expect(anim?.fillMode).toBe('both');
    });

    it('dialog itself unfolds with the same emphasized-decelerate curve (long2 / 500ms, top anchor)', async () => {
      // The dialog and the bloom must share the easing curve to
      // feel like one motion. The dialog runs 50ms LONGER than
      // the bloom (long2 vs long1) so the bloom settles first,
      // then the dialog locks in — staged motion. Top anchor on
      // the transform-origin makes the dialog drop down from the
      // trigger above instead of zooming from its centre.
      const page = await newE2EPage();
      await page.setContent('<md-time-picker open variant="dial" format="12h" value="07:00"></md-time-picker>');
      await awaitDialogReady(page);

      const anim = await page.evaluate(() => {
        const host = document.querySelector('md-time-picker');
        const dialog = host?.shadowRoot?.querySelector('[part="dialog"]') as HTMLElement | null;
        if (!dialog) return null;
        const s = getComputedStyle(dialog);
        return {
          name: s.animationName,
          duration: s.animationDuration,
          easing: s.animationTimingFunction,
          fillMode: s.animationFillMode,
          transformOrigin: s.transformOrigin,
        };
      });
      expect(anim?.name).toBe('md-time-picker-dialog-in');
      expect(anim?.duration).toBe('0.5s');
      expect(anim?.easing).toMatch(/cubic-bezier\(\s*0\.05\s*,\s*0\.7\s*,\s*0\.1\s*,\s*1\s*\)/);
      expect(anim?.fillMode).toBe('both');
      // Top anchor — same as the bloom; second token must
      // resolve to 0px so the unfold pivots from the top edge.
      expect(anim?.transformOrigin).toMatch(/0px$/);
    });

    it('re-runs the bloom animation when the mode toggle flips dial → input → dial', async () => {
      // Stencil unmounts the dial-wrap branch and mounts the
      // input-area branch (or vice versa) every time the mode
      // toggle (keyboard / clock icon) is pressed. Re-mounting an
      // element with a CSS animation re-triggers it — this test
      // proves the re-trigger reaches the new mount by reading
      // `getAnimations()` on the freshly-mounted sub-tree right
      // after toggle.
      const page = await newE2EPage();
      await page.setContent('<md-time-picker open variant="dial" format="12h" value="07:00"></md-time-picker>');
      await awaitDialogReady(page);

      // dial → input. The mode toggle is exposed as part
      // `toggle-mode` and wraps an `md-icon-button`; dispatching
      // mdClick on the outer host triggers `toggleMode` cleanly.
      await page.evaluate(() => {
        const host = document.querySelector('md-time-picker');
        const toggle = host?.shadowRoot?.querySelector('[part="toggle-mode"]') as HTMLElement | null;
        toggle?.dispatchEvent(new CustomEvent('mdClick', { bubbles: true, composed: true }));
      });
      await page.waitForChanges();

      const inputAnimations = await page.evaluate(() => {
        const host = document.querySelector('md-time-picker');
        const area = host?.shadowRoot?.querySelector('.md-time-picker__input-area') as HTMLElement | null;
        if (!area) return { exists: false, states: [] as string[] };
        if (typeof area.getAnimations !== 'function') return { exists: true, states: ['no-api'] };
        return { exists: true, states: area.getAnimations().map((a) => a.playState) };
      });
      // The freshly-mounted input-area MUST exist and carry at
      // least one animation. `awaitDialogReady` may already have
      // advanced it to 'finished' before we read; both states
      // prove the animation reached the new mount.
      expect(inputAnimations.exists).toBe(true);
      expect(inputAnimations.states.some((s) => s === 'running' || s === 'finished')).toBe(true);

      // input → dial
      await page.evaluate(() => {
        const host = document.querySelector('md-time-picker');
        const toggle = host?.shadowRoot?.querySelector('[part="toggle-mode"]') as HTMLElement | null;
        toggle?.dispatchEvent(new CustomEvent('mdClick', { bubbles: true, composed: true }));
      });
      await page.waitForChanges();

      const dialAnimations = await page.evaluate(() => {
        const host = document.querySelector('md-time-picker');
        const wrap = host?.shadowRoot?.querySelector('.md-time-picker__dial-wrap') as HTMLElement | null;
        if (!wrap) return { exists: false, states: [] as string[] };
        if (typeof wrap.getAnimations !== 'function') return { exists: true, states: ['no-api'] };
        return { exists: true, states: wrap.getAnimations().map((a) => a.playState) };
      });
      expect(dialAnimations.exists).toBe(true);
      expect(dialAnimations.states.some((s) => s === 'running' || s === 'finished')).toBe(true);
    });
  });

  /* ─── HH/MM input typing (both variants) ─────────────────────────
     Both variants now share a typeable HH/MM input row, so direct
     numeric entry is just standard browser-native <input> typing.
     The old dial-only segment-buffer auto-advance state machine
     was removed when the read-only spinbutton tiles were retired;
     users press Tab (or click MM) to move between segments, and
     the committed value emits on blur / Enter / OK. */
  describe('HH/MM input typing (both variants)', () => {
    it('types a 24-hour value into HH then Tab into MM in the dial variant', async () => {
      const page = await newE2EPage();
      await page.setContent('<md-time-picker open variant="dial" format="24h" value="00:00"></md-time-picker>');
      await awaitDialogReady(page);

      // The dialog auto-focuses HH on open — clear the seed before typing.
      await page.keyboard.press('Backspace');
      await page.keyboard.press('Backspace');
      await page.keyboard.type('20');
      await page.keyboard.press('Tab');
      await page.keyboard.type('45');
      await page.keyboard.press('Tab');
      await page.waitForChanges();

      // Read the value committed back into each input field — this is
      // what the next OK click would persist to `value`.
      const inputs = await page.evaluate(() => {
        const host = document.querySelector('md-time-picker');
        const hour = host?.shadowRoot?.querySelector('[part="input-hour"]') as HTMLInputElement | null;
        const minute = host?.shadowRoot?.querySelector('[part="input-minute"]') as HTMLInputElement | null;
        return { hour: hour?.value ?? null, minute: minute?.value ?? null };
      });
      expect(inputs.hour).toBe('20');
      expect(inputs.minute).toBe('45');
    });

    it('rejects non-numeric characters as the user types (regex strip on input)', async () => {
      const page = await newE2EPage();
      await page.setContent('<md-time-picker open value="00:00"></md-time-picker>');
      await awaitDialogReady(page);

      await page.keyboard.press('Backspace');
      await page.keyboard.press('Backspace');
      await page.keyboard.type('1a2');
      await page.waitForChanges();

      const hourValue = await page.evaluate(() => {
        const host = document.querySelector('md-time-picker');
        const hour = host?.shadowRoot?.querySelector('[part="input-hour"]') as HTMLInputElement | null;
        return hour?.value ?? null;
      });
      expect(hourValue).toBe('12');
    });

    /* The dial hand has to track typing in real time — the rendered
       rotate() must move on every valid keystroke, not just on blur.
       Read the inline transform on the hand element after each
       keystroke and assert the rotation angle changes BEFORE the
       input loses focus. */
    it('moves the dial hand live on every valid keystroke (no need to blur)', async () => {
      const page = await newE2EPage();
      await page.setContent(
        '<md-time-picker open variant="dial" format="24h" value="00:00"></md-time-picker>',
      );
      await awaitDialogReady(page);

      /** Read the rotation angle baked into the hand's inline transform.
       *  We use the inline `style.transform` (not `getComputedStyle`) so
       *  we read the *target* angle the renderer just wrote — the CSS
       *  transition is mid-flight at this point and computed style would
       *  return an interpolated matrix that's hard to assert on. */
      const readHandAngle = () =>
        page.evaluate(() => {
          const host = document.querySelector('md-time-picker');
          const hand = host?.shadowRoot?.querySelector(
            '.md-time-picker__dial-hand',
          ) as HTMLElement | null;
          if (!hand) return null;
          const t = hand.style.transform || '';
          const m = t.match(/rotate\((-?\d+(?:\.\d+)?)deg\)/);
          if (!m) return null;
          // The component unwraps angles across the 0/360° seam to
          // avoid CSS-transition reverse-spin; normalise back to a
          // clean 0..360° clock-angle for assertion purposes.
          const raw = parseFloat(m[1]);
          return ((raw % 360) + 360) % 360;
        });

      // Clear the auto-seeded "00" so the next digit lands cleanly.
      await page.keyboard.press('Backspace');
      await page.keyboard.press('Backspace');

      await page.keyboard.type('3');
      await page.waitForChanges();
      // Hour 3 sits at the 3 o'clock position → 90° from 12.
      // We assert this WITHOUT a Tab/blur first — proving the hand
      // moved while the input was still focused / mid-edit.
      expect(await readHandAngle()).toBe(90);

      // Typing a second digit that makes the buffer invalid in 24h
      // mode ("30" > 23) is intentionally a no-op for the dial — we
      // hold the last valid commit so the user doesn't see the hand
      // snap to garbage mid-keystroke.
      await page.keyboard.type('0');
      await page.waitForChanges();
      expect(await readHandAngle()).toBe(90);

      // Recover to "5" (valid) and assert the hand swings live again.
      await page.keyboard.press('Backspace');
      await page.keyboard.press('Backspace');
      await page.keyboard.type('5');
      await page.waitForChanges();
      expect(await readHandAngle()).toBe(150);
    });
  });

  /* ─── MD3 color roles ───────────────────────────────────────────
     The MD3 spec assigns a precise color role to each of the 17
     anatomy parts of the dial dialog. The test below drives every
     --md-sys-color-* token to a unique sentinel RGB value, then reads
     getComputedStyle on each element and asserts that the resolved
     color equals the sentinel for the role it should consume. If a
     refactor swaps a token (e.g. surface-container-high → surface),
     this test fails with a diff that pinpoints both the element and
     the role it strayed to.

     Source mapping (from m3.material.io/components/time-pickers/specs):
       1 Headline               on-surface-variant
       2 Time separator         on-surface
       3 Inactive tile bg       surface-container-highest
       4 Inactive tile text     on-surface
       5 Selected period bg     tertiary-container
       6 Selected period text   on-tertiary-container
       7 Dialog container       surface-container-high
       8 Period outline         outline
       9 Unselected period text on-surface
      10 Dial hand / track      primary
      11 Selected number text   on-primary
      12 Cancel / OK text       primary
      13 Keyboard toggle icon   on-surface-variant
      14 Unselected number text on-surface
      15 Dial container bg      surface-container-highest
      16 Selected tile text     on-primary-container
      17 Selected tile bg       primary-container */
  describe('MD3 color roles', () => {
    /**
     * Sentinel palette: every sys-color token gets a unique RGB so any
     * mis-wiring shows up as a concrete diff in the test output.
     */
    const sentinels: Record<string, string> = {
      '--md-sys-color-primary': 'rgb(1, 1, 1)',
      '--md-sys-color-on-primary': 'rgb(2, 2, 2)',
      '--md-sys-color-primary-container': 'rgb(3, 3, 3)',
      '--md-sys-color-on-primary-container': 'rgb(4, 4, 4)',
      '--md-sys-color-tertiary-container': 'rgb(5, 5, 5)',
      '--md-sys-color-on-tertiary-container': 'rgb(6, 6, 6)',
      '--md-sys-color-surface-container-high': 'rgb(7, 7, 7)',
      '--md-sys-color-surface-container-highest': 'rgb(8, 8, 8)',
      '--md-sys-color-on-surface': 'rgb(9, 9, 9)',
      '--md-sys-color-on-surface-variant': 'rgb(10, 10, 10)',
      '--md-sys-color-outline': 'rgb(11, 11, 11)',
    };

    async function bootColorSentinels(content: string) {
      const page = await newE2EPage();
      await pinNormalColors(page); // author-color reads are meaningless under a forced-colors bleed
      const style = Object.entries(sentinels)
        .map(([k, v]) => `${k}: ${v};`)
        .join(' ');
      await page.setContent(`<style>:root { ${style} }</style>${content}`);
      await awaitDialogReady(page);
      return page;
    }

    /** Read `color` or `background-color` from a shadow element by query. */
    async function styleOf(
      page: E2EPage,
      query: string,
      prop: 'color' | 'background-color' | 'border-color',
    ) {
      // Guarded read: the color-role matrix asserts author sys-color
      // sentinels, which a concurrent forced-colors test would override.
      return readInNormalColors(
        page,
        (args: { q: string; p: string }) => {
          const host = document.querySelector('md-time-picker');
          const el = host?.shadowRoot?.querySelector(args.q) as HTMLElement | null;
          if (!el) return null;
          const s = getComputedStyle(el);
          return s.getPropertyValue(args.p).trim();
        },
        { q: query, p: prop },
      );
    }

    it('maps every anatomy part to its canonical MD3 color role', async () => {
      // The full color-role matrix below covers the dial anatomy
      // (time-separator, dial face, dial-number, dial-hand). Pin the
      // dial variant explicitly so the test is independent of the
      // component-level default variant.
      const page = await bootColorSentinels(
        '<md-time-picker open variant="dial" format="12h" value="07:00"></md-time-picker>',
      );

      // 1) Headline — on-surface-variant
      expect(await styleOf(page, '[part="headline"]', 'color')).toBe(sentinels['--md-sys-color-on-surface-variant']);

      // 2) Time separator (colon) — on-surface
      expect(await styleOf(page, '.md-time-picker__input-separator', 'color')).toBe(sentinels['--md-sys-color-on-surface']);

      // 3) Inactive tile background — surface-container-highest (MM tile is inactive when selecting=hour)
      expect(await styleOf(page, '[part="input-minute"]', 'background-color')).toBe(sentinels['--md-sys-color-surface-container-highest']);

      // 4) Inactive tile text — on-surface
      expect(await styleOf(page, '[part="input-minute"]', 'color')).toBe(sentinels['--md-sys-color-on-surface']);

      // 5) Selected period container — tertiary-container (AM is selected at 07:00)
      expect(await styleOf(page, '[part="period-am"]', 'background-color')).toBe(sentinels['--md-sys-color-tertiary-container']);

      // 6) Selected period text — on-tertiary-container
      expect(await styleOf(page, '[part="period-am"]', 'color')).toBe(sentinels['--md-sys-color-on-tertiary-container']);

      // 7) Dialog container — surface-container-high
      expect(await styleOf(page, '[part="dialog"]', 'background-color')).toBe(sentinels['--md-sys-color-surface-container-high']);

      // 8) Period outline — outline
      expect(await styleOf(page, '[part="period-toggle"]', 'border-color')).toBe(sentinels['--md-sys-color-outline']);

      // 9) Unselected period text — on-surface (PM is unselected at 07:00 AM)
      expect(await styleOf(page, '[part="period-pm"]', 'color')).toBe(sentinels['--md-sys-color-on-surface']);

      // 10) Dial hand / track — primary
      expect(await styleOf(page, '.md-time-picker__dial-hand-line', 'background-color')).toBe(sentinels['--md-sys-color-primary']);
      expect(await styleOf(page, '.md-time-picker__dial-hand-tip', 'background-color')).toBe(sentinels['--md-sys-color-primary']);
      expect(await styleOf(page, '.md-time-picker__dial-center', 'background-color')).toBe(sentinels['--md-sys-color-primary']);

      // 11) Selected dial number — on-primary (the number under the handle)
      expect(await styleOf(page, '.md-time-picker__dial-number--active', 'color')).toBe(sentinels['--md-sys-color-on-primary']);

      // 12) Cancel / OK text — primary
      expect(await styleOf(page, '[part="cancel-button"]', 'color')).toBe(sentinels['--md-sys-color-primary']);
      expect(await styleOf(page, '[part="confirm-button"]', 'color')).toBe(sentinels['--md-sys-color-primary']);

      // 13) Keyboard toggle icon — on-surface-variant
      expect(await styleOf(page, '[part="toggle-mode"]', 'color')).toBe(sentinels['--md-sys-color-on-surface-variant']);

      // 14) Unselected dial number — on-surface
      const unselectedNumberColor = await readInNormalColors(page, () => {
        const host = document.querySelector('md-time-picker');
        const num = Array.from(host?.shadowRoot?.querySelectorAll('.md-time-picker__dial-number') ?? [])
          .find((n) => !(n as HTMLElement).classList.contains('md-time-picker__dial-number--active')) as HTMLElement | undefined;
        return num ? getComputedStyle(num).color.trim() : null;
      });
      expect(unselectedNumberColor).toBe(sentinels['--md-sys-color-on-surface']);

      // 15) Dial container background — surface-container-highest
      expect(await styleOf(page, '[part="dial"]', 'background-color')).toBe(sentinels['--md-sys-color-surface-container-highest']);

      // 16) Selected tile text — on-primary-container (HH is selected at open)
      expect(await styleOf(page, '[part="input-hour"]', 'color')).toBe(sentinels['--md-sys-color-on-primary-container']);

      // 17) Selected tile container — primary-container
      expect(await styleOf(page, '[part="input-hour"]', 'background-color')).toBe(sentinels['--md-sys-color-primary-container']);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  //   Adaptive responsive policy
  //
  //   MD3 spec: "Time pickers can swap between orientation or
  //   variant depending on device orientation and viewport
  //   constraints" — verify that the `responsive` prop:
  //     a) is opt-in (default false leaves props untouched)
  //     b) falls back to input on tall-but-short viewports
  //     c) promotes to landscape on wide viewports
  //     d) coexists with explicit user toggles
  // ─────────────────────────────────────────────────────────────────
  describe('Adaptive responsive policy', () => {
    /** Read the live mode/orientation off the host instance so we
     *  test the effective rendering, not just the prop bag.
     *
     *  `hasDial` is the sole truth-source for "is the clock face
     *  rendered?" after both variants unified around the typeable
     *  HH/MM input row — `[part="input-hour"]` now exists in BOTH
     *  variants, so it can't distinguish the rendering branch on
     *  its own. We keep it for the rare cross-check that the input
     *  tile is present even when the dial is hidden (responsive
     *  fallback). */
    const readEffective = (page: E2EPage) =>
      page.evaluate(() => {
        const host = document.querySelector('md-time-picker') as HTMLElement & {
          mode?: string;
        };
        const shadow = host?.shadowRoot;
        const dialog = shadow?.querySelector('[part="dialog"]') as HTMLElement | null;
        return {
          hasDial: !!shadow?.querySelector('[part="dial"]'),
          hasHourInput: !!shadow?.querySelector('[part="input-hour"]'),
          isHorizontal: dialog?.classList.contains('md-time-picker__dialog--horizontal') ?? false,
          isVertical: dialog?.classList.contains('md-time-picker__dialog--vertical') ?? false,
        };
      });

    it('respects explicit variant="dial" when responsive is OFF (default), even on a tiny viewport', async () => {
      const page = await newE2EPage();
      // 320×400 — well below the 460dp adaptive threshold. Without
      // `responsive`, the picker MUST still render the dial as the
      // author requested. Opt-in is the whole point of the flag.
      await page.setViewport({ width: 320, height: 400 });
      await page.setContent('<md-time-picker open variant="dial"></md-time-picker>');
      await awaitDialogReady(page);

      const eff = await readEffective(page);
      // hasDial is the sole truth-source — both variants share the
      // input-hour part after the typeable-headline unification.
      expect(eff.hasDial).toBe(true);
      // The input-hour tile is also present (always, in dial mode);
      // pin it so a future regression that drops the unified header
      // fails noisily here.
      expect(eff.hasHourInput).toBe(true);
    });

    it('falls back to input variant on short viewports when responsive=true', async () => {
      const page = await newE2EPage();
      // 320×400 — viewport height below ADAPTIVE_MIN_DIAL_HEIGHT (460).
      // The dial wouldn't fit without scrolling, so the picker must
      // honor the MD3 fallback ("Time pickers can fallback to the
      // input time picker when there isn't enough vertical real
      // estate to present the dial without scrolling").
      await page.setViewport({ width: 320, height: 400 });
      await page.setContent('<md-time-picker open variant="dial" responsive></md-time-picker>');
      await awaitDialogReady(page);

      const eff = await readEffective(page);
      expect(eff.hasHourInput).toBe(true);
      expect(eff.hasDial).toBe(false);
    });

    it('keeps the dial variant on a tall viewport even with responsive=true', async () => {
      const page = await newE2EPage();
      // 360×800 — height ≫ 460, no fallback needed; the explicit
      // dial preference is honored.
      await page.setViewport({ width: 360, height: 800 });
      await page.setContent('<md-time-picker open variant="dial" responsive></md-time-picker>');
      await awaitDialogReady(page);

      const eff = await readEffective(page);
      expect(eff.hasDial).toBe(true);
      // The typeable HH input is also present (always, in dial mode).
      expect(eff.hasHourInput).toBe(true);
      expect(eff.isVertical).toBe(true);
    });

    it('promotes a vertical preference to horizontal on a wide landscape viewport', async () => {
      const page = await newE2EPage();
      // 1024×600 — width ≥ 720 AND width > height. Per the MD3
      // adaptive-design line "the time picker can change to
      // landscape orientation on larger breakpoints or when
      // viewport height is limited" we expect promotion to
      // horizontal even though the author said "vertical".
      await page.setViewport({ width: 1024, height: 600 });
      await page.setContent(
        '<md-time-picker open variant="dial" orientation="vertical" responsive></md-time-picker>',
      );
      await awaitDialogReady(page);

      const eff = await readEffective(page);
      expect(eff.isHorizontal).toBe(true);
      expect(eff.isVertical).toBe(false);
    });

    it('does NOT promote to horizontal on a tall portrait viewport (width>=720 but width<height)', async () => {
      const page = await newE2EPage();
      // 800×1200 — wide enough for landscape numerically, but it's
      // a tall portrait viewport (height > width). Promoting would
      // produce a cramped horizontal dialog with no breathing room
      // below it; the spec says we should respect orientation.
      await page.setViewport({ width: 800, height: 1200 });
      await page.setContent(
        '<md-time-picker open variant="dial" orientation="vertical" responsive></md-time-picker>',
      );
      await awaitDialogReady(page);

      const eff = await readEffective(page);
      expect(eff.isVertical).toBe(true);
      expect(eff.isHorizontal).toBe(false);
    });

    it('explicit orientation="horizontal" stays horizontal even on narrow viewports under responsive=true', async () => {
      const page = await newE2EPage();
      // The width gate only applies to the PROMOTION (vertical →
      // horizontal). If the author already asked for horizontal,
      // we honor it — the MD3 spec defers to the author when the
      // viewport allows it.
      await page.setViewport({ width: 720, height: 720 });
      await page.setContent(
        '<md-time-picker open variant="dial" orientation="horizontal" responsive></md-time-picker>',
      );
      await awaitDialogReady(page);

      const eff = await readEffective(page);
      expect(eff.isHorizontal).toBe(true);
    });

    it('re-evaluates the effective variant on window resize', async () => {
      const page = await newE2EPage();
      // Start tall — dial renders. Then shrink the viewport
      // below the threshold — the resize listener must flip the
      // mode to input so the user doesn't have to scroll.
      await page.setViewport({ width: 360, height: 800 });
      await page.setContent('<md-time-picker open variant="dial" responsive></md-time-picker>');
      await awaitDialogReady(page);

      let eff = await readEffective(page);
      expect(eff.hasDial).toBe(true);

      await page.setViewport({ width: 360, height: 400 });
      // Resize → rAF → state update → re-render. Give the
      // browser one frame plus a small buffer to settle.
      await page.waitForChanges();
      await new Promise((r) => setTimeout(r, 50));
      await page.waitForChanges();

      eff = await readEffective(page);
      expect(eff.hasHourInput).toBe(true);
      expect(eff.hasDial).toBe(false);
    });

    it('does not promote the input variant to horizontal (only the dial gets landscape)', async () => {
      const page = await newE2EPage();
      // Even on the widest viewport, `variant="input"` stays
      // portrait — there's no dial to balance against in the
      // right column, so a 572dp two-column dialog would just
      // leave half the body empty.
      await page.setViewport({ width: 1280, height: 720 });
      await page.setContent('<md-time-picker open variant="input" responsive></md-time-picker>');
      await awaitDialogReady(page);

      const eff = await readEffective(page);
      expect(eff.isHorizontal).toBe(false);
      expect(eff.hasHourInput).toBe(true);
    });
  });

  // ── RTL ──
  //
  // The clock dial is a GEOMETRIC face, not a text-flow widget — it
  // should NOT mirror in RTL contexts. Real wristwatches have no RTL
  // variant: numbers always march clockwise from 12 at the top, and
  // the canonical Material Components Android implementation positions
  // dial numbers physically (never via logical inset properties). These
  // tests guard the fix that switched
  // `md-time-picker__dial-number` / `__dial-hand{,-line,-tip}` /
  // `__dial-center` from `inset-inline-*` / `inset-block-*` to
  // physical `left` / `top` / `right` / `bottom`, eliminating the
  // visual mismatch where in RTL the numbers flipped but the hand
  // (a physical `transform: rotate`) stayed put — leaving the handle
  // on the WRONG side of the dial from the active number.
  //
  // IMPORTANT: each test uses a SINGLE puppeteer page and toggles
  // `dir` at runtime — creating two pages in a row makes puppeteer's
  // older CDP frame manager occasionally throw "Requesting main
  // frame too early!" when the second page is constructed before the
  // first's frame settles. A single page sidesteps that flake while
  // still exercising real CSS layout under both directions.
  describe('RTL', () => {
    /**
     * Set the document direction at runtime AND wait for the next
     * style flush — `dir` is inherited through shadow DOM via
     * `:host-context()`-style cascade, so by the time the next
     * animation frame ticks every absolute-positioned descendant
     * has been re-laid-out.
     */
    async function setDir(page: E2EPage, dir: 'ltr' | 'rtl') {
      await page.evaluate((d: 'ltr' | 'rtl') => {
        document.documentElement.setAttribute('dir', d);
        document.body.setAttribute('dir', d);
      }, dir);
      await page.waitForChanges();
    }

    /**
     * Read the centre-coordinates of a shadow-DOM element rounded
     * to the nearest pixel so floating-point round-off in the
     * comparison doesn't fight us.
     */
    async function center(page: E2EPage, selector: string) {
      return page.evaluate((sel: string) => {
        const host = document.querySelector('md-time-picker');
        const el = host?.shadowRoot?.querySelector(sel);
        if (!el) return null;
        const r = (el as HTMLElement).getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      }, selector);
    }

    /**
     * Focus the minute input to flip `selecting` from 'hour' (the
     * dial's default on open) to 'minute', so the hand actually
     * points at the minute value we're asserting against. Without
     * this every assertion below would test the hand-at-hour-0
     * geometry instead of the hand-at-minute-N geometry.
     *
     * We call `focus()` AND dispatch a synthetic `focus` event —
     * Puppeteer's `focus()` from inside `page.evaluate` doesn't
     * always reliably re-fire the focus listener when the active
     * element is already inside the picker's shadow root (which is
     * true here because the dialog auto-focuses HH on open). The
     * explicit dispatch guarantees Stencil's `onFocus` handler runs
     * and `selecting` flips to 'minute' before we measure the dial
     * hand position.
     */
    async function selectMinuteMode(page: E2EPage) {
      // Use Stencil's E2EElement.click() which dispatches a real
      // pointer event that the browser then resolves into a focus
      // event on the underlying <input>. This drives the same JSX
      // onFocus path users hit when tapping MM in the dialog, so
      // the dial-hand geometry under test matches the production
      // interaction model exactly.
      //
      // Important: `page.evaluate(() => el.focus())` is unreliable
      // here because the dialog auto-focuses HH on open and the
      // synthetic focus event races the browser's native focus
      // management inside shadow DOM.
      const minuteInput = await page.find('md-time-picker >>> [part="input-minute"]');
      await minuteInput.click();
      await page.waitForChanges();
    }

    it('uses physical (left/top) positioning for dial numbers — not inset-inline', async () => {
      // Pin the implementation choice itself: the inline style on
      // every dial number must use `left`/`top`, never the logical
      // `inset-inline-start`/`inset-block-start`. This guards
      // against accidental regressions when authors "normalise"
      // dial styles back to logical-properties patterns used
      // elsewhere in the codebase.
      const page = await newE2EPage();
      // Dial-only assertion — pin variant explicitly so this RTL
      // geometry test doesn't depend on the component default.
      await page.setContent('<md-time-picker open variant="dial"></md-time-picker>');
      await page.waitForChanges();

      const inlineStyles = await page.evaluate(() => {
        const host = document.querySelector('md-time-picker');
        const nodes = host?.shadowRoot?.querySelectorAll('.md-time-picker__dial-number') ?? [];
        return Array.from(nodes).map((n) => (n as HTMLElement).getAttribute('style') ?? '');
      });

      expect(inlineStyles.length).toBeGreaterThan(0);
      for (const style of inlineStyles) {
        expect(style).toContain('left:');
        expect(style).toContain('top:');
        expect(style).not.toContain('inset-inline');
        expect(style).not.toContain('inset-block');
      }
    });

    it('places every dial number at the SAME physical position in LTR and RTL', async () => {
      // Single-page direction flip captures the entire 12-position
      // outer ring. A regression that re-introduced
      // `inset-inline-start` for even a single number would have
      // moved its (x, y) when `dir` toggled — this fails before
      // the screenshot bug can ship.
      const page = await newE2EPage();
      await page.setContent('<md-time-picker open variant="dial" value="03:15"></md-time-picker>');
      await page.waitForChanges();

      const collect = () =>
        page.evaluate(() => {
          const host = document.querySelector('md-time-picker');
          const nodes = host?.shadowRoot?.querySelectorAll('.md-time-picker__dial-number') ?? [];
          return Array.from(nodes).map((n) => {
            const r = (n as HTMLElement).getBoundingClientRect();
            return {
              value: n.getAttribute('data-value'),
              x: Math.round(r.left + r.width / 2),
              y: Math.round(r.top + r.height / 2),
            };
          });
        });

      await setDir(page, 'ltr');
      const ltrPositions = await collect();

      await setDir(page, 'rtl');
      const rtlPositions = await collect();

      expect(ltrPositions.length).toBe(rtlPositions.length);
      expect(ltrPositions.length).toBeGreaterThan(0);

      for (const ltrNum of ltrPositions) {
        const rtlNum = rtlPositions.find((n) => n.value === ltrNum.value);
        expect(rtlNum).toBeDefined();
        // Tolerance of ±3px absorbs the harmless layout jitter that
        // happens when `dir` flips (scrollbar gutter swap, font
        // hinting shift). The bug we're guarding against would move
        // every number by ~100px+ — a flipped face has cos/sin
        // signs reversed, so the diff swamps any tolerance below
        // half the dial width.
        expect(Math.abs(rtlNum!.x - ltrNum.x)).toBeLessThanOrEqual(3);
        expect(Math.abs(rtlNum!.y - ltrNum.y)).toBeLessThanOrEqual(3);
      }
    });

    it('keeps the dial-hand tip centred on the active minute in RTL', async () => {
      // Pin: in RTL, the hand-tip handle still LANDS on top of the
      // active number — the regression we are guarding against had
      // the handle drift to the opposite quadrant because numbers
      // used logical positioning while the hand used physical rotate.
      const page = await newE2EPage();
      await page.setContent('<div dir="rtl"><md-time-picker open variant="dial" value="00:25" format="24h"></md-time-picker></div>');
      await page.waitForChanges();
      // The dial opens in hour-selecting mode by default — flip to
      // minute mode so the hand actually points at minute 25.
      await selectMinuteMode(page);

      const tip = await center(page, '.md-time-picker__dial-hand-tip');
      const num = await center(page, '.md-time-picker__dial-number[data-value="25"]');

      expect(tip).not.toBeNull();
      expect(num).not.toBeNull();
      // 48dp handle, 16px digit — the tip's centre overlaps the
      // number's centre within a couple of pixels (line stroke
      // rounding + sub-pixel positioning slack).
      expect(Math.abs(tip!.x - num!.x)).toBeLessThan(3);
      expect(Math.abs(tip!.y - num!.y)).toBeLessThan(3);
    });

    it('positions the dial-hand-tip in the SAME quadrant for minute 25 in LTR and RTL', async () => {
      // The "head line tail" pre-fix flipped to the opposite
      // diagonal in RTL because the hand was physically rotated but
      // the dial face wasn't. Verify both directions now end up in
      // the bottom-right quadrant relative to the dial centre —
      // the canonical 5 o'clock position for minute 25 (150°
      // clockwise from 12).
      const page = await newE2EPage();
      await page.setContent('<md-time-picker open variant="dial" value="00:25" format="24h"></md-time-picker>');
      await page.waitForChanges();
      await selectMinuteMode(page);

      const readQuadrant = async () => {
        const dialCenter = await center(page, '.md-time-picker__dial');
        const tip = await center(page, '.md-time-picker__dial-hand-tip');
        expect(dialCenter).not.toBeNull();
        expect(tip).not.toBeNull();
        return {
          dx: tip!.x - dialCenter!.x,
          dy: tip!.y - dialCenter!.y,
        };
      };

      await setDir(page, 'ltr');
      const ltrDelta = await readQuadrant();
      await setDir(page, 'rtl');
      const rtlDelta = await readQuadrant();

      // Both directions: tip is to the RIGHT (dx > 0) and BELOW
      // (dy > 0) the dial centre. The pre-fix RTL render had
      // dx < 0 — the regression we're guarding against.
      for (const { dx, dy } of [ltrDelta, rtlDelta]) {
        expect(dx).toBeGreaterThan(0);
        expect(dy).toBeGreaterThan(0);
      }
      // And the magnitudes themselves match — they don't just
      // happen to share a quadrant, they share an angle.
      expect(Math.abs(ltrDelta.dx - rtlDelta.dx)).toBeLessThanOrEqual(2);
      expect(Math.abs(ltrDelta.dy - rtlDelta.dy)).toBeLessThanOrEqual(2);
    });
  });
});
