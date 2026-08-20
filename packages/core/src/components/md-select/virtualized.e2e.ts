import { newE2EPage, E2EPage } from '@stencil/core/testing';

/**
 * End-to-end coverage for the WASM-backed virtualized `md-select`. These run in
 * a real Chromium (Puppeteer) so WebAssembly actually instantiates — the spec
 * tests cover the store/window math in isolation, this covers the live
 * component wiring: windowed rendering, scroll, the filter field, keyboard
 * navigation through the `VirtualMenuProvider`, and off-window label resolution.
 */
describe('md-select virtualized e2e', () => {
  const TOTAL = 5000;

  /** Mount a virtualized select, load `n` rows into WASM, and open the menu. */
  async function mountAndOpen(page: E2EPage, n = TOTAL): Promise<void> {
    await page.setContent(
      '<md-select label="Item" virtualize="always" filterable max-height="320"></md-select>',
    );
    await page.waitForChanges();

    await page.evaluate(async (count: number) => {
      const el = document.querySelector('md-select') as HTMLElement & {
        loadOptions: (rows: Array<{ value: string; label: string }>) => Promise<void>;
      };
      const rows = Array.from({ length: count }, (_, i) => ({
        value: `v${i}`,
        label: `Option ${i}`,
      }));
      await el.loadOptions(rows);
    }, n);
    await page.waitForChanges();

    const el = await page.find('md-select');
    el.setProperty('open', true);
    await page.waitForChanges();
    // Let the open animation, viewport attach, and first recompute settle.
    await new Promise((r) => setTimeout(r, 250));
    await page.waitForChanges();
  }

  function windowInfo(page: E2EPage) {
    return page.evaluate(() => {
      const sel = document.querySelector('md-select')!;
      const root = sel.shadowRoot!;
      const items = Array.from(
        root.querySelectorAll('md-menu-item[data-vindex]'),
      ) as HTMLElement[];
      const vindices = items.map((it) => Number(it.getAttribute('data-vindex')));
      // `headline` is a Stencil @Prop without `reflect`, so it is set as a
      // property — never an attribute. Read the property (getAttribute is null).
      const headlines = items.map(
        (it) => (it as unknown as { headline: string }).headline,
      );
      const spacers = Array.from(
        root.querySelectorAll('.md-select__vspacer'),
      ) as HTMLElement[];
      return {
        domCount: items.length,
        firstVindex: vindices[0] ?? -1,
        lastVindex: vindices[vindices.length - 1] ?? -1,
        firstHeadline: headlines[0] ?? null,
        setsize: Number(items[0]?.getAttribute('aria-setsize') ?? -1),
        topPad: parseFloat(spacers[0]?.style.height || '0'),
        bottomPad: parseFloat(spacers[1]?.style.height || '0'),
      };
    });
  }

  it('windows a large dataset: only the visible rows exist in the DOM', async () => {
    const page = await newE2EPage();
    await mountAndOpen(page);

    const info = await windowInfo(page);
    // The full set is reported for a11y, but only a small window is in the DOM.
    expect(info.setsize).toBe(TOTAL);
    expect(info.domCount).toBeGreaterThan(0);
    expect(info.domCount).toBeLessThan(60);
    expect(info.firstVindex).toBe(0);
    expect(info.firstHeadline).toBe('Option 0');
    // Spacers preserve the full scroll height (the bottom is mostly padding).
    expect(info.bottomPad).toBeGreaterThan(0);
    expect(info.topPad).toBe(0);
  });

  it('re-windows on scroll, swapping rows and shifting the top spacer', async () => {
    const page = await newE2EPage();
    await mountAndOpen(page);

    const before = await windowInfo(page);

    await page.evaluate(() => {
      const menu = document
        .querySelector('md-select')!
        .shadowRoot!.querySelector('md-menu')!;
      const vp = menu.shadowRoot!.querySelector(
        '.md-menu__scroll-shadow',
      ) as HTMLElement;
      vp.scrollTop = 100 * 48; // jump ~100 rows down (48px row height)
      vp.dispatchEvent(new Event('scroll'));
    });
    // Scroll handling is rAF-throttled, then triggers a re-render.
    await new Promise((r) => setTimeout(r, 100));
    await page.waitForChanges();

    const after = await windowInfo(page);
    expect(after.firstVindex).toBeGreaterThan(before.lastVindex);
    expect(after.topPad).toBeGreaterThan(0);
    expect(after.firstHeadline).toBe(`Option ${after.firstVindex}`);
  });

  it('filters through the search field (substring match runs in WASM)', async () => {
    const page = await newE2EPage();
    await mountAndOpen(page);

    await page.evaluate(() => {
      const input = document
        .querySelector('md-select')!
        .shadowRoot!.querySelector('.md-select__search') as HTMLInputElement;
      input.value = 'Option 4242';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    // Search is debounced (120ms) then re-renders.
    await new Promise((r) => setTimeout(r, 220));
    await page.waitForChanges();

    const info = await windowInfo(page);
    expect(info.setsize).toBe(1);
    expect(info.domCount).toBe(1);
    expect(info.firstHeadline).toBe('Option 4242');
  });

  it('selects an off-window value and resolves its trigger label', async () => {
    const page = await newE2EPage();
    await mountAndOpen(page);

    // Filter to a single far-off row, then select it.
    await page.evaluate(() => {
      const sel = document.querySelector('md-select')! as HTMLElement & {
        setQuery: (q: string) => Promise<void>;
      };
      return sel.setQuery('Option 3333');
    });
    await page.waitForChanges();
    await new Promise((r) => setTimeout(r, 50));
    await page.waitForChanges();

    await page.evaluate(() => {
      const item = document
        .querySelector('md-select')!
        .shadowRoot!.querySelector('md-menu-item[data-vindex="0"]') as HTMLElement;
      item.dispatchEvent(new CustomEvent('mdClick', { bubbles: true }));
    });
    await page.waitForChanges();

    const value = await page.evaluate(
      () => (document.querySelector('md-select') as unknown as { value: string }).value,
    );
    expect(value).toBe('v3333');

    // The trigger shows the selected label even though it is outside any
    // current window (clear the filter to prove off-window resolution).
    await page.evaluate(() => {
      const sel = document.querySelector('md-select')! as HTMLElement & {
        setQuery: (q: string) => Promise<void>;
      };
      return sel.setQuery('');
    });
    await page.waitForChanges();

    const triggerText = await page.evaluate(() => {
      // The selected label is shown via the inner md-text-field's `value` prop
      // (the trigger surface), not a textContent node in md-select's shadow root.
      const field = document
        .querySelector('md-select')!
        .shadowRoot!.querySelector('.md-select__field') as
        | (HTMLElement & { value?: string })
        | null;
      return (field?.value || '').includes('Option 3333');
    });
    expect(triggerText).toBe(true);
  });

  it('moves focus through the provider with ArrowDown', async () => {
    const page = await newE2EPage();
    await mountAndOpen(page);

    const focusedVindex = await page.evaluate(async () => {
      const menu = document
        .querySelector('md-select')!
        .shadowRoot!.querySelector('md-menu')! as HTMLElement;
      menu.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
      );
      menu.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
      );
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      const focused = document
        .querySelector('md-select')!
        .shadowRoot!.querySelector('md-menu-item[data-md-focused]');
      return focused ? Number(focused.getAttribute('data-vindex')) : -1;
    });
    expect(focusedVindex).toBeGreaterThanOrEqual(0);
  });

  it('renders a leading icon and supporting text on virtualized rows', async () => {
    const page = await newE2EPage();
    await page.setContent(
      '<md-select label="Item" virtualize="always" max-height="320"></md-select>',
    );
    await page.waitForChanges();

    await page.evaluate(async () => {
      const el = document.querySelector('md-select') as HTMLElement & {
        loadOptions: (src: {
          count: number;
          getRow: (i: number) => {
            value: string;
            label: string;
            icon: string;
            supportingText: string;
          };
        }) => Promise<void>;
      };
      await el.loadOptions({
        count: 500,
        getRow: (i) => ({
          value: `v${i}`,
          label: `Option ${i}`,
          icon: 'star',
          supportingText: `Row ${i}`,
        }),
      });
    });
    await page.waitForChanges();

    const el = await page.find('md-select');
    el.setProperty('open', true);
    await page.waitForChanges();
    await new Promise((r) => setTimeout(r, 250));
    await page.waitForChanges();

    const row = await page.evaluate(() => {
      const first = document
        .querySelector('md-select')!
        .shadowRoot!.querySelector('md-menu-item[data-vindex="0"]') as
        | (HTMLElement & { headline?: string; supportingText?: string })
        | null;
      const icon = first?.querySelector('span[slot="leading-icon"]');
      return {
        headline: first?.headline ?? null,
        // supporting-text is a property (not reflected), like headline.
        support: first?.supportingText ?? null,
        icon: icon?.textContent?.trim() ?? null,
      };
    });

    expect(row.headline).toBe('Option 0');
    expect(row.support).toBe('Row 0');
    expect(row.icon).toBe('star');
  }, 60000);

  describe('scaled regime (list taller than the browser height cap)', () => {
    // A dataset whose real height (× 48px row) far exceeds the ~1.5M-px spacer
    // cap, so keyboard nav runs through the anchored/scaled window math — the
    // regime where ArrowUp near the end used to "jump" thousands of rows.
    const SCALED = 1_000_000;

    async function mountScaledAndOpen(page: E2EPage): Promise<void> {
      await page.setContent(
        '<md-select label="Item" virtualize="always" max-height="320"></md-select>',
      );
      await page.waitForChanges();

      await page.evaluate(async (count: number) => {
        const el = document.querySelector('md-select') as HTMLElement & {
          loadOptions: (src: {
            count: number;
            getRow: (i: number) => { value: string; label: string };
          }) => Promise<void>;
        };
        // Row factory: never materialises the full dataset as JS objects.
        await el.loadOptions({
          count,
          getRow: (i) => ({ value: `v${i}`, label: `Option ${i}` }),
        });
      }, SCALED);
      await page.waitForChanges();

      const el = await page.find('md-select');
      el.setProperty('open', true);
      await page.waitForChanges();
      await new Promise((r) => setTimeout(r, 300));
      await page.waitForChanges();
    }

    /** Dispatch a key on the menu and let ensureVisible's rAFs + render settle. */
    async function pressKey(page: E2EPage, key: string): Promise<void> {
      await page.evaluate((k: string) => {
        const menu = document
          .querySelector('md-select')!
          .shadowRoot!.querySelector('md-menu')! as HTMLElement;
        menu.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
      }, key);
      await new Promise((r) => setTimeout(r, 90));
      await page.waitForChanges();
    }

    function focusedVindex(page: E2EPage) {
      return page.evaluate(() => {
        const focused = document
          .querySelector('md-select')!
          .shadowRoot!.querySelector('md-menu-item[data-md-focused]');
        return focused ? Number(focused.getAttribute('data-vindex')) : -1;
      });
    }

    it('windows correctly at the scale where the spacers must be capped', async () => {
      const page = await newE2EPage();
      await mountScaledAndOpen(page);
      const info = await windowInfo(page);
      expect(info.setsize).toBe(SCALED);
      expect(info.domCount).toBeGreaterThan(0);
      expect(info.domCount).toBeLessThan(60);
      expect(info.firstVindex).toBe(0);
    }, 60000);

    it('ArrowUp near the end steps one row at a time without jumping', async () => {
      const page = await newE2EPage();
      await mountScaledAndOpen(page);

      // Jump to the very end, then walk back up. Before the fix, the anchored
      // offset saturated near the end, so a dropped anchor re-mapped the window
      // thousands of rows away mid-walk.
      await pressKey(page, 'End');
      const start = await focusedVindex(page);
      expect(start).toBe(SCALED - 1);

      const seen: number[] = [start];
      for (let i = 0; i < 12; i++) {
        await pressKey(page, 'ArrowUp');
        seen.push(await focusedVindex(page));
      }

      // Each press moves focus to the immediately-preceding row — strictly
      // -1 every step, the focus ring never lost, no teleport.
      for (let i = 1; i < seen.length; i++) {
        expect(seen[i]).toBe(seen[i - 1] - 1);
      }
    }, 60000);

    it('does not teleport when the anchor is dropped near the end', async () => {
      const page = await newE2EPage();
      await mountScaledAndOpen(page);

      // Walk firmly into the anchored/scaled zone near the end.
      await pressKey(page, 'End');
      for (let i = 0; i < 15; i++) await pressKey(page, 'ArrowUp');
      const before = (await windowInfo(page)).firstVindex;
      expect(before).toBeGreaterThan(SCALED - 100);

      // Simulate the browser nudging scrollTop out from under the keyboard anchor
      // (scroll-anchoring / sub-pixel drift — what `overflow-anchor: none` guards
      // against in a real browser). This drops the anchor and forces the
      // scroll-driven re-derive: the exact path that used to teleport the view.
      await page.evaluate(() => {
        const menu = document
          .querySelector('md-select')!
          .shadowRoot!.querySelector('md-menu')!;
        const vp = menu.shadowRoot!.querySelector(
          '.md-menu__scroll-shadow',
        ) as HTMLElement;
        vp.scrollTop += 4;
        vp.dispatchEvent(new Event('scroll'));
      });
      await new Promise((r) => setTimeout(r, 120));
      await page.waitForChanges();

      const after = (await windowInfo(page)).firstVindex;
      // The re-derived window must land on essentially the same rows — not the
      // hundreds-to-thousands of rows the old saturating offset jumped.
      expect(Math.abs(after - before)).toBeLessThan(50);
    }, 60000);

    it('shows exactly one ring and one lit state layer through a fast ArrowUp burst (no flicker)', async () => {
      const page = await newE2EPage();
      await mountScaledAndOpen(page);
      await pressKey(page, 'End');

      // Fire ArrowUps at OS-autorepeat cadence (~28ms apart) while sampling, every
      // animation frame, both the focus ring (data-md-focused) and the lit state
      // layers (the background tint). Three distinct flicker modes are guarded:
      //   - too MANY rings: superseded async focusVirtual calls re-stamp the ring
      //     on stale rows (the navSeq reentrancy guard).
      //   - ZERO rings on a frame: removing the old ring before the async
      //     ensureVisible re-adds it blinks it off mid-burst.
      //   - MANY lit state layers: a 100ms state-layer fade-OUT leaves a trail of
      //     lit rows behind the moving focus (the "second item background
      //     flickers" symptom). The fade-out must be instant, so at most one row
      //     is ever tinted.
      const result = await page.evaluate(async () => {
        const root = document.querySelector('md-select')!.shadowRoot!;
        const menu = root.querySelector('md-menu')! as HTMLElement;
        const ringCount = () =>
          root.querySelectorAll('md-menu-item[data-md-focused]').length;
        const litCount = () => {
          const items = Array.from(
            root.querySelectorAll('md-menu-item[data-vindex]'),
          ) as HTMLElement[];
          return items.filter((it) => {
            const sl = it.shadowRoot?.querySelector(
              '.md-menu-item__state-layer',
            ) as HTMLElement | null;
            return sl ? parseFloat(getComputedStyle(sl).opacity) > 0.005 : false;
          }).length;
        };

        const rings: number[] = [];
        const lits: number[] = [];
        let stop = false;
        const sample = () => {
          rings.push(ringCount());
          lits.push(litCount());
          if (!stop) requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);

        for (let i = 0; i < 12; i++) {
          menu.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }),
          );
          await new Promise((r) => setTimeout(r, 28));
        }
        await new Promise((r) => setTimeout(r, 200));
        stop = true;

        // Ignore the first few frames before the first ring is stamped; from then
        // on the ring must be present (1) on every frame and never doubled.
        const firstRingFrame = rings.findIndex((c) => c >= 1);
        const ringNav = firstRingFrame < 0 ? [] : rings.slice(firstRingFrame);
        const litNav = firstRingFrame < 0 ? [] : lits.slice(firstRingFrame);
        return {
          finalRing: rings[rings.length - 1],
          blankFrames: ringNav.filter((c) => c === 0).length,
          multiRing: ringNav.filter((c) => c > 1).length,
          multiLit: litNav.filter((c) => c > 1).length,
        };
      });

      // Steady state: exactly one ring.
      expect(result.finalRing).toBe(1);
      // No frame mid-burst with the ring blinked off, and never two rings.
      expect(result.blankFrames).toBe(0);
      expect(result.multiRing).toBe(0);
      // No fade-out trail: at most one row tinted on every frame.
      expect(result.multiLit).toBe(0);
    }, 60000);
  });
});
