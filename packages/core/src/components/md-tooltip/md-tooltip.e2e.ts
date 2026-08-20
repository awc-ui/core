import { newE2EPage } from '@stencil/core/testing';

/**
 * Real-browser coverage for md-tooltip — the interaction, focus, and a11y-wiring
 * behavior the JSDOM spec cannot verify (hover/focus timers, hoverable persistence,
 * Escape focus rules, positioning geometry, reparenting, composed-event scope).
 */
type E2EPage = Awaited<ReturnType<typeof newE2EPage>>;

/** Whether the popup currently carries the visible class. */
function isOpen(page: E2EPage): Promise<boolean> {
  return page.evaluate(() => {
    const p = document.querySelector('md-tooltip')!.shadowRoot!.querySelector('.md-tooltip__popup')!;
    return p.classList.contains('md-tooltip__popup--visible');
  });
}

/** Dispatch a non-bubbling mouse event directly on a light-DOM element by data-id. */
async function fire(page: E2EPage, dataId: string, type: string) {
  await page.evaluate(
    (id: string, t: string) => {
      document.querySelector(`[data-id="${id}"]`)!.dispatchEvent(new MouseEvent(t, { bubbles: false }));
    },
    dataId,
    type,
  );
}

/** Dispatch a mouse event on the tooltip's shadow popup. */
async function firePopup(page: E2EPage, type: string) {
  await page.evaluate((t: string) => {
    const p = document.querySelector('md-tooltip')!.shadowRoot!.querySelector('.md-tooltip__popup')!;
    p.dispatchEvent(new MouseEvent(t, { bubbles: false }));
  }, type);
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function settle(page: E2EPage, ms = 30) {
  await wait(ms);
  await page.waitForChanges();
}

describe('md-tooltip (e2e)', () => {
  // ─── aria wiring ─────────────────────────────────────────
  describe('aria-description', () => {
    it('mirrors plain text onto the trigger', async () => {
      const page = await newE2EPage();
      await page.setContent(`<md-tooltip text="Save file"><button data-id="t">Save</button></md-tooltip>`);
      await page.waitForChanges();
      const desc = await page.evaluate(() => document.querySelector('[data-id="t"]')!.getAttribute('aria-description'));
      expect(desc).toBe('Save file');
    });

    it('derives from slotted rich content when no text/subhead prop is set', async () => {
      const page = await newE2EPage();
      await page.setContent(`
        <md-tooltip variant="rich">
          <button data-id="t">Info</button>
          <span slot="subhead">Auto-save</span>
          <span slot="content">Saved every 5 minutes.</span>
        </md-tooltip>`);
      await page.waitForChanges();
      const desc = await page.evaluate(() => document.querySelector('[data-id="t"]')!.getAttribute('aria-description'));
      expect(desc).toBe('Auto-save. Saved every 5 minutes.'); // slot-only rich is still announced
    });

    it('stays fresh when the text prop changes after binding', async () => {
      const page = await newE2EPage();
      await page.setContent(`<md-tooltip text="Undo"><button data-id="t">x</button></md-tooltip>`);
      await page.waitForChanges();
      await page.evaluate(() => ((document.querySelector('md-tooltip') as HTMLElement & { text: string }).text = 'Redo'));
      await page.waitForChanges();
      const desc = await page.evaluate(() => document.querySelector('[data-id="t"]')!.getAttribute('aria-description'));
      expect(desc).toBe('Redo');
    });
  });

  // ─── hover / focus lifecycle ─────────────────────────────
  describe('hover & focus', () => {
    it('opens on hover after showDelay and closes after the hide grace', async () => {
      const page = await newE2EPage();
      await page.setContent(`<md-tooltip text="Tip" show-delay="0" hide-delay="0"><button data-id="t">x</button></md-tooltip>`);
      await page.waitForChanges();
      await fire(page, 't', 'mouseenter');
      await settle(page);
      expect(await isOpen(page)).toBe(true);
      await fire(page, 't', 'mouseleave');
      await settle(page);
      expect(await isOpen(page)).toBe(false);
    });

    it('opens on focus and closes on blur', async () => {
      const page = await newE2EPage();
      await page.setContent(`<md-tooltip text="Tip" show-delay="0" hide-delay="0"><button data-id="t">x</button></md-tooltip>`);
      await page.waitForChanges();
      await page.evaluate(() => (document.querySelector('[data-id="t"]') as HTMLElement).focus());
      await settle(page);
      expect(await isOpen(page)).toBe(true);
      await page.evaluate(() => (document.querySelector('[data-id="t"]') as HTMLElement).blur());
      await settle(page);
      expect(await isOpen(page)).toBe(false);
    });
  });

  // ─── WCAG 1.4.13 hoverable ───────────────────────────────
  describe('hoverable (WCAG 1.4.13)', () => {
    it('plain tooltip stays open when the pointer moves from trigger onto the popup', async () => {
      const page = await newE2EPage();
      await page.setContent(`<md-tooltip text="Tip" show-delay="0" hide-delay="120"><button data-id="t">x</button></md-tooltip>`);
      await page.waitForChanges();
      await fire(page, 't', 'mouseenter');
      await settle(page);
      expect(await isOpen(page)).toBe(true);
      // leave the trigger (arms the 120ms hide grace), then reach the popup before it fires
      await fire(page, 't', 'mouseleave');
      await firePopup(page, 'mouseenter');
      await wait(200); // longer than hide-delay: popup-enter must have cancelled it
      await page.waitForChanges();
      expect(await isOpen(page)).toBe(true); // still visible — was a synchronous close before the fix
    });

    it('closes once the pointer leaves the popup too', async () => {
      const page = await newE2EPage();
      await page.setContent(`<md-tooltip text="Tip" show-delay="0" hide-delay="0"><button data-id="t">x</button></md-tooltip>`);
      await page.waitForChanges();
      await fire(page, 't', 'mouseenter');
      await settle(page);
      await fire(page, 't', 'mouseleave');
      await firePopup(page, 'mouseenter'); // keep open
      await firePopup(page, 'mouseleave'); // now really leave
      await settle(page);
      expect(await isOpen(page)).toBe(false);
    });
  });

  // ─── Escape ──────────────────────────────────────────────
  describe('Escape dismissal (WCAG 1.4.13)', () => {
    it('dismisses and returns focus to the trigger when the trigger is focused', async () => {
      const page = await newE2EPage();
      await page.setContent(`<md-tooltip text="Tip" show-delay="0"><button data-id="t">x</button></md-tooltip>`);
      await page.waitForChanges();
      await page.evaluate(() => (document.querySelector('[data-id="t"]') as HTMLElement).focus());
      await settle(page);
      await page.keyboard.press('Escape');
      await settle(page);
      expect(await isOpen(page)).toBe(false);
      const focused = await page.evaluate(() => document.activeElement?.getAttribute('data-id'));
      expect(focused).toBe('t'); // focus returned to the trigger
    });

    it('does NOT steal focus when the tooltip was hover-opened and focus is elsewhere', async () => {
      const page = await newE2EPage();
      await page.setContent(`
        <input data-id="other" />
        <md-tooltip text="Tip" show-delay="0"><button data-id="t">x</button></md-tooltip>`);
      await page.waitForChanges();
      await page.evaluate(() => (document.querySelector('[data-id="other"]') as HTMLElement).focus());
      await fire(page, 't', 'mouseenter'); // hover-open, focus stays in the input
      await settle(page);
      expect(await isOpen(page)).toBe(true);
      await page.keyboard.press('Escape');
      await settle(page);
      expect(await isOpen(page)).toBe(false);
      const focused = await page.evaluate(() => document.activeElement?.getAttribute('data-id'));
      expect(focused).toBe('other'); // focus NOT yanked to the trigger
    });

    it('does not immediately re-show while the pointer is still over the trigger', async () => {
      const page = await newE2EPage();
      await page.setContent(`<md-tooltip text="Tip" show-delay="0"><button data-id="t">x</button></md-tooltip>`);
      await page.waitForChanges();
      await fire(page, 't', 'mouseenter');
      await settle(page);
      await page.keyboard.press('Escape');
      await settle(page, 60);
      expect(await isOpen(page)).toBe(false); // suppressed until pointer leaves & re-enters
      // re-entry re-enables showing
      await fire(page, 't', 'mouseleave');
      await fire(page, 't', 'mouseenter');
      await settle(page);
      expect(await isOpen(page)).toBe(true);
    });
  });

  // ─── positioning ─────────────────────────────────────────
  describe('positioning', () => {
    it('places a bottom tooltip below the trigger', async () => {
      const page = await newE2EPage();
      await page.setContent(`
        <div style="padding:200px">
          <md-tooltip text="Tip" position="bottom" auto-position="false" open>
            <button data-id="t">anchor</button>
          </md-tooltip>
        </div>`);
      await page.waitForChanges();
      await settle(page, 40);
      const gap = await page.evaluate(() => {
        const trg = document.querySelector('[data-id="t"]')!.getBoundingClientRect();
        const pop = document.querySelector('md-tooltip')!.shadowRoot!.querySelector('.md-tooltip__popup')!.getBoundingClientRect();
        return pop.top - trg.bottom;
      });
      expect(gap).toBeGreaterThanOrEqual(0); // popup sits below the trigger
      expect(gap).toBeLessThan(20); // ~offset(8), not detached
    });

    it('crossOffset on a right-placed tooltip shifts vertically, not along the gap', async () => {
      const page = await newE2EPage();
      await page.setContent(`
        <div style="padding:200px">
          <md-tooltip text="Tip" position="right" auto-position="false" offset="8" cross-offset="20" open>
            <button data-id="t">anchor</button>
          </md-tooltip>
        </div>`);
      await page.waitForChanges();
      await settle(page, 40);
      const m = await page.evaluate(() => {
        const trg = document.querySelector('[data-id="t"]')!.getBoundingClientRect();
        const pop = document.querySelector('md-tooltip')!.shadowRoot!.querySelector('.md-tooltip__popup')!.getBoundingClientRect();
        return { gap: Math.round(pop.left - trg.right), vShift: Math.round(pop.top - trg.top) };
      });
      // gap stays ~offset (8) — crossOffset did NOT widen the main axis…
      expect(m.gap).toBeGreaterThanOrEqual(4);
      expect(m.gap).toBeLessThan(16);
      // …it shifted the popup down the cross (vertical) axis instead
      expect(m.vShift).toBeGreaterThan(10);
    });
  });

  // ─── rich actions focus persistence ──────────────────────
  describe('rich tooltip actions', () => {
    it('stays open while focus is on a slotted action button', async () => {
      const page = await newE2EPage();
      await page.setContent(`
        <md-tooltip variant="rich" text="Details" show-delay="0" hide-delay="80">
          <button data-id="t">Info</button>
          <div slot="actions"><button data-id="act">Learn more</button></div>
        </md-tooltip>`);
      await page.waitForChanges();
      await page.evaluate(() => (document.querySelector('[data-id="t"]') as HTMLElement).focus());
      await settle(page);
      expect(await isOpen(page)).toBe(true);
      // move focus into the action button — the tooltip must persist
      await page.evaluate(() => (document.querySelector('[data-id="act"]') as HTMLElement).focus());
      await wait(150);
      await page.waitForChanges();
      expect(await isOpen(page)).toBe(true);
    });
  });

  // ─── composed-event scope ────────────────────────────────
  describe('events', () => {
    it('mdOpen is not composed (does not cross the shadow boundary onto embedding hosts)', async () => {
      const page = await newE2EPage();
      await page.setContent(`<md-tooltip text="Tip"><button data-id="t">x</button></md-tooltip>`);
      await page.waitForChanges();
      const composed = await page.evaluate(
        () =>
          new Promise((resolve) => {
            const tt = document.querySelector('md-tooltip')!;
            tt.addEventListener('mdOpen', (e) => resolve(e.composed), { once: true });
            (tt as HTMLElement & { show: () => Promise<void> }).show();
          }),
      );
      expect(composed).toBe(false);
    });
  });

  // ─── reparenting ─────────────────────────────────────────
  describe('reparenting', () => {
    it('re-establishes hover binding after the tooltip is moved in the DOM', async () => {
      const page = await newE2EPage();
      await page.setContent(`
        <div id="a"><md-tooltip text="Tip" show-delay="0" hide-delay="0"><button data-id="t">x</button></md-tooltip></div>
        <div id="b"></div>`);
      await page.waitForChanges();
      await page.evaluate(() => document.getElementById('b')!.appendChild(document.querySelector('md-tooltip')!));
      await page.waitForChanges();
      // hover the moved trigger — binding must have been re-attached in connectedCallback
      await fire(page, 't', 'mouseenter');
      await settle(page);
      expect(await isOpen(page)).toBe(true);
    });

    it('a tooltip moved WHILE OPEN stays visible and remains dismissable by Escape', async () => {
      const page = await newE2EPage();
      await page.setContent(`
        <div id="a"><md-tooltip text="Tip" show-delay="0"><button data-id="t">x</button></md-tooltip></div>
        <div id="b"></div>`);
      await page.waitForChanges();
      await page.evaluate(() => (document.querySelector('[data-id="t"]') as HTMLElement).focus());
      await settle(page);
      expect(await isOpen(page)).toBe(true);
      // move the tooltip while it is open
      await page.evaluate(() => document.getElementById('b')!.appendChild(document.querySelector('md-tooltip')!));
      await settle(page, 40);
      expect(await isOpen(page)).toBe(true); // not stranded closed either
      // Escape must still dismiss it — the document listener was re-established on reconnect
      await page.keyboard.press('Escape');
      await settle(page);
      expect(await isOpen(page)).toBe(false);
    });
  });

  // ─── disabled ────────────────────────────────────────────
  describe('disabled', () => {
    it('does not render visible when open + disabled are both set at first render', async () => {
      const page = await newE2EPage();
      await page.setContent(`<md-tooltip text="Tip" open disabled><button data-id="t">x</button></md-tooltip>`);
      await page.waitForChanges();
      expect(await isOpen(page)).toBe(false); // disabled wins — popup is not shown
      const hidden = await page.evaluate(
        () => document.querySelector('md-tooltip')!.shadowRoot!.querySelector('.md-tooltip__popup')!.getAttribute('aria-hidden'),
      );
      expect(hidden).toBe('true');
    });
  });

  // ─── positioning staleness (rAF watchdog) ────────────────
  // The scroll listener only repairs light-DOM scrolls; the watchdog covers every
  // other way the world can change under an open tooltip. Each test measures the
  // bottom-placement invariant: popup ~8px under the trigger, centered on it.
  describe('position watchdog', () => {
    /** Popup-to-trigger geometry for the bottom placement. */
    async function align(page: E2EPage) {
      return page.evaluate(() => {
        const tt = document.querySelector('md-tooltip')!;
        const trg = tt.querySelector('[data-id="t"]')!.getBoundingClientRect();
        const pop = tt.shadowRoot!.querySelector('.md-tooltip__popup')!.getBoundingClientRect();
        return {
          gapY: Math.round(pop.top - trg.bottom),
          centerDX: Math.round(pop.left + pop.width / 2 - (trg.left + trg.width / 2)),
        };
      });
    }

    it('re-anchors after a viewport resize reflows the layout', async () => {
      const page = await newE2EPage();
      await page.setContent(`
        <div style="max-width: 80vw; margin: 0 auto; padding: 160px 0; text-align: center;">
          <md-tooltip text="Tip" position="bottom" open><button data-id="t">anchor</button></md-tooltip>
        </div>`);
      await page.waitForChanges();
      await settle(page, 60);
      expect(Math.abs((await align(page)).centerDX)).toBeLessThanOrEqual(1);
      // narrow the viewport — the centered wrapper reflows, moving the trigger left
      await page.setViewport({ width: 480, height: 700 });
      await settle(page, 120); // a few watchdog frames
      const a = await align(page);
      expect(Math.abs(a.centerDX)).toBeLessThanOrEqual(1); // re-anchored, not stale
      expect(a.gapY).toBe(8);
    });

    it('follows the trigger when a scroller INSIDE another shadow root scrolls', async () => {
      const page = await newE2EPage();
      await page.setContent(`<md-tooltip text="Tip" position="bottom" show-delay="0" open><button data-id="t">in-shadow</button></md-tooltip>`);
      await page.waitForChanges();
      // Recreate the md-side-sheet/md-dialog composition: move the tooltip into a
      // slot inside a shadow-DOM scroller (scroll is composed:false — the window
      // capture listener NEVER sees these scrolls).
      await page.evaluate(() => {
        const wrap = document.createElement('div');
        const sh = wrap.attachShadow({ mode: 'open' });
        sh.innerHTML = `
          <div id="sc" style="height: 260px; overflow-y: scroll;">
            <div style="height: 120px"></div>
            <slot></slot>
            <div style="height: 600px"></div>
          </div>`;
        document.body.appendChild(wrap);
        wrap.appendChild(document.querySelector('md-tooltip')!);
      });
      await settle(page, 120);
      expect(Math.abs((await align(page)).centerDX)).toBeLessThanOrEqual(1);
      // scroll the shadow scroller — trigger moves up 80px
      await page.evaluate(() => {
        const sc = document.querySelector('div')!.shadowRoot!.getElementById('sc')!;
        sc.scrollTop = 80;
      });
      await settle(page, 120);
      const a = await align(page);
      expect(a.gapY).toBe(8); // popup followed the trigger — no window scroll event fired
      expect(Math.abs(a.centerDX)).toBeLessThanOrEqual(1);
    });

    it('re-centers when the popup grows (text change while open)', async () => {
      const page = await newE2EPage();
      await page.setContent(`
        <div style="padding: 160px; text-align: center;">
          <md-tooltip text="short" position="bottom" open><button data-id="t">anchor</button></md-tooltip>
        </div>`);
      await page.waitForChanges();
      await settle(page, 60);
      await page.evaluate(() => {
        (document.querySelector('md-tooltip') as HTMLElement & { text: string }).text =
          'a much longer supporting sentence that widens the popup considerably';
      });
      await settle(page, 150);
      const a = await align(page);
      expect(Math.abs(a.centerDX)).toBeLessThanOrEqual(1); // still centered on the trigger
      expect(a.gapY).toBe(8);
    });

    it('popup width is position-independent — no wrap/slide feedback animation on open', async () => {
      // Regression: with width:auto, a fixed popup shrink-to-fits into
      // (viewport − left), so writing `left` changed the width, re-wrapped the
      // text, and the watchdog saw drift → an animated wrap/slide loop crawling
      // ~10 frames per open. width:max-content decouples measurement from position:
      // the size must be identical before positioning and after settling, with a
      // single coordinate write.
      const page = await newE2EPage();
      await page.setViewport({ width: 520, height: 700 });
      await page.setContent(`
        <div style="padding: 300px 0 0 120px;">
          <md-tooltip text="a long supporting sentence that would re-wrap if the width depended on the popup offset"
                      style="--md-tooltip-plain-max-inline-size: 440px;" position="top" show-delay="0" open>
            <button data-id="t">anchor</button>
          </md-tooltip>
        </div>`);
      await page.waitForChanges();
      const first = await page.evaluate(() => {
        const p = document.querySelector('md-tooltip')!.shadowRoot!.querySelector('.md-tooltip__popup') as HTMLElement;
        return { ow: p.offsetWidth, oh: p.offsetHeight };
      });
      await settle(page, 250); // many watchdog frames
      const after = await page.evaluate(() => {
        const p = document.querySelector('md-tooltip')!.shadowRoot!.querySelector('.md-tooltip__popup') as HTMLElement;
        return { ow: p.offsetWidth, oh: p.offsetHeight, left: p.style.left };
      });
      expect(after.ow).toBe(first.ow); // size never re-flowed after positioning
      expect(after.oh).toBe(first.oh);
      expect(after.left).not.toBe(''); // and it did get positioned
    });

    it('stays anchored when an ancestor GAINS/LOSES a fixed containing block at rest (will-change)', async () => {
      const page = await newE2EPage();
      await page.setContent(`
        <div id="panel" style="padding: 160px; text-align: center;">
          <md-tooltip text="Tip" position="bottom" open><button data-id="t">anchor</button></md-tooltip>
        </div>`);
      await page.waitForChanges();
      await settle(page, 60);
      expect(Math.abs((await align(page)).centerDX)).toBeLessThanOrEqual(1);
      // md-list's --shifting pattern: will-change: transform appears on an ancestor
      // with ZERO geometric change — position:fixed coords are silently reinterpreted
      // relative to the new containing block. The watchdog must catch the popup's
      // actual rect drifting from its expected viewport position.
      await page.evaluate(() => (document.getElementById('panel')!.style.willChange = 'transform'));
      await settle(page, 150);
      let a = await align(page);
      expect(a.gapY).toBe(8);
      expect(Math.abs(a.centerDX)).toBeLessThanOrEqual(1);
      // …and the reverse: the containing block vanishes at rest (transform settles
      // to none after an entrance animation — md-date-picker's modal panel).
      await page.evaluate(() => (document.getElementById('panel')!.style.willChange = ''));
      await settle(page, 150);
      a = await align(page);
      expect(a.gapY).toBe(8);
      expect(Math.abs(a.centerDX)).toBeLessThanOrEqual(1);
    });

    it('re-anchors when sibling layout growth shifts the trigger (no scroll, no resize)', async () => {
      const page = await newE2EPage();
      await page.setContent(`
        <div id="spacer" style="height: 20px;"></div>
        <div style="padding: 120px; text-align: center;">
          <md-tooltip text="Tip" position="bottom" open><button data-id="t">anchor</button></md-tooltip>
        </div>`);
      await page.waitForChanges();
      await settle(page, 60);
      const before = await page.evaluate(() =>
        Math.round(document.querySelector('md-tooltip')!.shadowRoot!.querySelector('.md-tooltip__popup')!.getBoundingClientRect().top));
      await page.evaluate(() => (document.getElementById('spacer')!.style.height = '140px'));
      await settle(page, 150);
      const after = await page.evaluate(() =>
        Math.round(document.querySelector('md-tooltip')!.shadowRoot!.querySelector('.md-tooltip__popup')!.getBoundingClientRect().top));
      expect(after - before).toBe(120); // popup moved WITH the trigger (+120px growth)
      expect((await align(page)).gapY).toBe(8);
    });
  });

  // ─── RTL placement mapping ───────────────────────────────
  describe('RTL placement', () => {
    it('left-start flips the SIDE but keeps top alignment (block axis does not mirror)', async () => {
      const page = await newE2EPage();
      await page.setContent(`
        <div dir="rtl" style="padding: 200px;">
          <md-tooltip text="Tip" position="left-start" auto-position="false" open>
            <button data-id="t">anchor</button>
          </md-tooltip>
        </div>`);
      await page.waitForChanges();
      await settle(page, 60);
      const m = await page.evaluate(() => {
        const tt = document.querySelector('md-tooltip')!;
        const trg = tt.querySelector('[data-id="t"]')!.getBoundingClientRect();
        const pop = tt.shadowRoot!.querySelector('.md-tooltip__popup')!.getBoundingClientRect();
        return { sideGap: Math.round(pop.left - trg.right), topDelta: Math.round(pop.top - trg.top) };
      });
      expect(m.sideGap).toBe(8); // physical RIGHT of the trigger (side mirrored)
      expect(m.topDelta).toBe(0); // -start stays TOP-aligned (was bottom-aligned pre-fix)
    });
  });
});
