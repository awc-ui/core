/**
 * Interaction e2e for the md-tabs family — every defect class the readiness
 * audit confirmed gets a real-browser guard here: keyboard model (real
 * keystrokes), shadow-root embedding, RTL inversion, roving-tabindex single
 * ownership, prop-driven reactivity, dynamic removal integrity, reparent
 * survival, wrapper-slot flattening, wheel overflow access, indicator glide.
 */
import { newE2EPage } from '@stencil/core/testing';

const TABS = `
  <md-tabs aria-label="Sections">
    <md-tab label="Alpha" active></md-tab>
    <md-tab label="Beta"></md-tab>
    <md-tab label="Gamma" disabled></md-tab>
    <md-tab label="Delta"></md-tab>
  </md-tabs>
`;

const state = async (page: Awaited<ReturnType<typeof newE2EPage>>) =>
  page.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll('md-tab'));
    return {
      active: tabs.findIndex((t) => t.hasAttribute('active')),
      tabindexes: tabs.map((t) => t.getAttribute('tabindex')),
      focused: tabs.findIndex((t) => t === document.activeElement),
      index: (document.querySelector('md-tabs') as HTMLElement & { activeTabIndex: number }).activeTabIndex,
    };
  });

describe('md-tabs interaction e2e', () => {
  it('REAL keystrokes: arrows wrap, skip disabled, Home/End; exactly one tabindex=0 always', async () => {
    const page = await newE2EPage();
    await page.setContent(TABS);
    await page.waitForChanges();
    await page.evaluate(() => (document.querySelector('md-tab') as HTMLElement).focus());

    await page.keyboard.press('ArrowRight'); // Alpha -> Beta
    await page.waitForChanges();
    let s = await state(page);
    expect(s.active).toBe(1);
    expect(s.focused).toBe(1);
    expect(s.tabindexes).toEqual(['-1', '0', '-1', '-1']); // single owner, no double-0

    await page.keyboard.press('ArrowRight'); // skips disabled Gamma -> Delta
    await page.waitForChanges();
    s = await state(page);
    expect(s.active).toBe(3);
    expect(s.tabindexes).toEqual(['-1', '-1', '-1', '0']);

    await page.keyboard.press('ArrowRight'); // wraps -> Alpha
    await page.waitForChanges();
    expect((await state(page)).active).toBe(0);

    await page.keyboard.press('End');
    await page.waitForChanges();
    expect((await state(page)).active).toBe(3);
    await page.keyboard.press('Home');
    await page.waitForChanges();
    expect((await state(page)).active).toBe(0);
  });

  it('RTL: ArrowRight moves toward LOWER indexes (visual direction)', async () => {
    const page = await newE2EPage();
    await page.setContent(`<div dir="rtl">${TABS}</div>`);
    await page.waitForChanges();
    await page.evaluate(() => (document.querySelectorAll('md-tab')[1] as HTMLElement).focus());
    await page.keyboard.press('ArrowRight');
    await page.waitForChanges();
    expect((await state(page)).active).toBe(0); // visually right = lower index in RTL
    await page.keyboard.press('ArrowLeft');
    await page.waitForChanges();
    expect((await state(page)).active).toBe(1);
  });

  it('keyboard WORKS inside a shadow root (deep active element)', async () => {
    const page = await newE2EPage();
    await page.setContent('<div id="wrap"></div>');
    await page.evaluate((html) => {
      const wrap = document.getElementById('wrap')!;
      const shadow = wrap.attachShadow({ mode: 'open' });
      shadow.innerHTML = html;
    }, TABS);
    await page.waitForChanges();
    await page.evaluate(() => {
      const tab = document.getElementById('wrap')!.shadowRoot!.querySelector('md-tab') as HTMLElement;
      tab.focus();
    });
    await page.keyboard.press('ArrowRight');
    await page.waitForChanges();
    const active = await page.evaluate(() => {
      const tabs = Array.from(document.getElementById('wrap')!.shadowRoot!.querySelectorAll('md-tab'));
      return tabs.findIndex((t) => t.hasAttribute('active'));
    });
    expect(active).toBe(1); // previously a silent no-op
  });

  it('activeTabIndex prop set is FULLY reactive: roving tabindex + scroll follow', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <md-tabs aria-label="t" style="max-width: 260px; display: block;">
        ${Array.from({ length: 8 }).map((_, i) => `<md-tab label="Tab ${i}" ${i === 0 ? 'active' : ''} style="min-width: 120px;"></md-tab>`).join('')}
      </md-tabs>
    `);
    await page.waitForChanges();
    await page.$eval('md-tabs', (el: HTMLElement & { activeTabIndex: number }) => {
      el.activeTabIndex = 6;
    });
    await page.waitForChanges();
    await new Promise((r) => setTimeout(r, 400)); // smooth scroll settles
    const s = await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('md-tab'));
      const container = document.querySelector('md-tabs')!.shadowRoot!.querySelector('.md-tabs__container') as HTMLElement;
      return {
        active: tabs.findIndex((t) => t.hasAttribute('active')),
        zeroHolders: tabs.filter((t) => t.getAttribute('tabindex') === '0').length,
        activeHolds0: tabs[6].getAttribute('tabindex') === '0',
        scrolled: container.scrollLeft > 0,
      };
    });
    expect(s.active).toBe(6);
    expect(s.zeroHolders).toBe(1);
    expect(s.activeHolds0).toBe(true);
    expect(s.scrolled).toBe(true); // scroll-into-view ran on the prop path
  });

  it('out-of-range prop set CLAMPS instead of stranding the tablist', async () => {
    const page = await newE2EPage();
    await page.setContent(TABS);
    await page.waitForChanges();
    await page.$eval('md-tabs', (el: HTMLElement & { activeTabIndex: number }) => {
      el.activeTabIndex = 99;
    });
    await page.waitForChanges();
    const s = await state(page);
    expect(s.index).toBe(3); // clamped to last
    expect(s.active).toBe(3);
    expect(s.tabindexes.filter((t) => t === '0').length).toBe(1);
  });

  it('removing the ACTIVE tab reselects an ENABLED tab, re-roves, and emits', async () => {
    const page = await newE2EPage();
    await page.setContent(TABS);
    await page.waitForChanges();
    const spy = await page.spyOnEvent('mdTabChange');
    await page.$eval('md-tabs', (el: HTMLElement & { selectTab: (i: number) => Promise<void> }) => el.selectTab(3));
    await page.waitForChanges();
    await page.evaluate(() => document.querySelectorAll('md-tab')[3].remove());
    await page.waitForChanges();
    await new Promise((r) => setTimeout(r, 50));
    const s = await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('md-tab'));
      const activeIdx = tabs.findIndex((t) => t.hasAttribute('active'));
      return {
        active: activeIdx,
        activeDisabled: activeIdx >= 0 ? tabs[activeIdx].hasAttribute('disabled') : null,
        zeroHolders: tabs.filter((t) => t.getAttribute('tabindex') === '0').length,
      };
    });
    expect(s.active).not.toBe(-1); // an active tab EXISTS
    expect(s.activeDisabled).toBe(false); // and it is ENABLED (never a disabled tab)
    expect(s.zeroHolders).toBe(1); // still keyboard-reachable
    expect(spy.length).toBeGreaterThanOrEqual(2); // activation + removal reconciliation
  });

  it('MID-LIST active removal emits even though the numeric index is unchanged', async () => {
    const page = await newE2EPage();
    await page.setContent(TABS);
    await page.waitForChanges();
    await page.$eval('md-tabs', (el: HTMLElement & { selectTab: (i: number) => Promise<void> }) => el.selectTab(1));
    await page.waitForChanges();
    const spy = await page.spyOnEvent('mdTabChange');
    await page.evaluate(() => document.querySelectorAll('md-tab')[1].remove()); // active mid-list
    await page.waitForChanges();
    await new Promise((r) => setTimeout(r, 50));
    // selection changed ELEMENT (Beta -> Delta via disabled-skip) at index 1
    expect(spy).toHaveReceivedEvent();
    const s = await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('md-tab'));
      const i = tabs.findIndex((t) => t.hasAttribute('active'));
      return { label: tabs[i]?.getAttribute('label'), disabled: tabs[i]?.hasAttribute('disabled') };
    });
    expect(s.disabled).toBe(false);
  });

  it('ALL remaining tabs disabled: no aria-selected residue, emits index -1', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <md-tabs aria-label="t">
        <md-tab label="A" disabled></md-tab>
        <md-tab label="B" active></md-tab>
        <md-tab label="C" disabled></md-tab>
      </md-tabs>
    `);
    await page.waitForChanges();
    const spy = await page.spyOnEvent('mdTabChange');
    await page.evaluate(() => document.querySelectorAll('md-tab')[1].remove());
    await page.waitForChanges();
    await new Promise((r) => setTimeout(r, 50));
    const s = await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('md-tab'));
      return {
        anyActive: tabs.some((t) => t.hasAttribute('active')),
        anySelected: tabs.some((t) => t.getAttribute('aria-selected') === 'true'),
      };
    });
    expect(s.anyActive).toBe(false); // a disabled tab must never look selected
    expect(s.anySelected).toBe(false);
    expect(spy.lastEvent.detail.index).toBe(-1); // consumers learn selection was lost
  });

  it('keyboard works inside a CLOSED shadow root (composedPath origin)', async () => {
    const page = await newE2EPage();
    await page.setContent('<div id="wrap"></div>');
    await page.evaluate((html) => {
      const wrap = document.getElementById('wrap')!;
      const shadow = wrap.attachShadow({ mode: 'closed' });
      (window as unknown as { __shadow: ShadowRoot }).__shadow = shadow; // test-only handle
      shadow.innerHTML = html;
    }, TABS);
    await page.waitForChanges();
    await page.evaluate(() => {
      const shadow = (window as unknown as { __shadow: ShadowRoot }).__shadow;
      (shadow.querySelector('md-tab') as HTMLElement).focus();
    });
    await page.keyboard.press('ArrowRight');
    await page.waitForChanges();
    const active = await page.evaluate(() => {
      const shadow = (window as unknown as { __shadow: ShadowRoot }).__shadow;
      return Array.from(shadow.querySelectorAll('md-tab')).findIndex((t) => t.hasAttribute('active'));
    });
    expect(active).toBe(1); // deep-activeElement walk dies at closed hosts; composedPath doesn't
  });

  it('garbage indexes never wipe the tablist (NaN attr, float prop)', async () => {
    const page = await newE2EPage();
    await page.setContent(TABS.replace('<md-tabs', '<md-tabs active-tab-index="abc"'));
    await page.waitForChanges();
    let s = await state(page);
    expect(s.active).toBe(0); // "abc" -> 0, not a wiped tablist
    expect(s.tabindexes.filter((t) => t === '0').length).toBe(1);
    await page.$eval('md-tabs', (el: HTMLElement & { activeTabIndex: number }) => {
      el.activeTabIndex = 1.5;
    });
    await page.waitForChanges();
    s = await state(page);
    expect(s.index).toBe(3); // 1.5 rounds to 2 (disabled) -> resolves to next enabled
    expect(s.active).toBe(3); // Delta active, tablist intact
  });

  it('append a tab and select it in the SAME tick — intent survives slotchange', async () => {
    const page = await newE2EPage();
    await page.setContent(TABS);
    await page.waitForChanges();
    await page.evaluate(() => {
      const tabs = document.querySelector('md-tabs')! as HTMLElement & { activeTabIndex: number };
      const tab = document.createElement('md-tab');
      tab.setAttribute('label', 'Epsilon');
      tabs.appendChild(tab);
      tabs.activeTabIndex = 4; // before slotchange registers the new tab
    });
    await page.waitForChanges();
    await new Promise((r) => setTimeout(r, 100));
    const s = await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('md-tab'));
      const i = tabs.findIndex((t) => t.hasAttribute('active'));
      return { label: tabs[i]?.getAttribute('label'), index: (document.querySelector('md-tabs') as HTMLElement & { activeTabIndex: number }).activeTabIndex };
    });
    expect(s.label).toBe('Epsilon'); // previously silently rewritten to the stale clamp
    expect(s.index).toBe(4);
  });

  it('a tab moved OUT of the tablist sheds selected state and regains focusability', async () => {
    const page = await newE2EPage();
    await page.setContent(`${TABS}<div id="outside"></div>`);
    await page.waitForChanges();
    await page.$eval('md-tabs', (el: HTMLElement & { selectTab: (i: number) => Promise<void> }) => el.selectTab(1));
    await page.waitForChanges();
    await page.evaluate(() => document.getElementById('outside')!.appendChild(document.querySelectorAll('md-tab')[1]));
    await page.waitForChanges();
    await new Promise((r) => setTimeout(r, 100));
    const s = await page.evaluate(() => {
      const moved = document.querySelector('#outside md-tab')!;
      const inside = Array.from(document.querySelectorAll('md-tabs md-tab'));
      return {
        movedActive: moved.hasAttribute('active'),
        movedSelected: moved.getAttribute('aria-selected') === 'true',
        movedTabindex: moved.getAttribute('tabindex'),
        insideZeroHolders: inside.filter((t) => t.getAttribute('tabindex') === '0').length,
      };
    });
    expect(s.movedActive).toBe(false); // no selected-looking orphan
    expect(s.movedSelected).toBe(false);
    expect(s.movedTabindex).toBe('0'); // standalone: focusable again
    expect(s.insideZeroHolders).toBe(1);
  });

  it('disabling the roving holder via PROPERTY re-roves immediately', async () => {
    const page = await newE2EPage();
    await page.setContent(TABS);
    await page.waitForChanges();
    await page.evaluate(() => {
      (document.querySelectorAll('md-tab')[0] as HTMLElement & { disabled: boolean }).disabled = true;
    });
    await page.waitForChanges();
    await new Promise((r) => setTimeout(r, 50));
    const s = await state(page);
    expect(s.tabindexes[0]).toBe('-1'); // property write, not just attribute
    expect(s.tabindexes.filter((t) => t === '0').length).toBe(1);
  });

  it('overflow fades survive a reparent (ResizeObserver re-observes)', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <div id="a"><md-tabs aria-label="t" style="display:block; max-width: 800px;">
        ${Array.from({ length: 6 }).map((_, i) => `<md-tab label="Tab ${i}" ${i === 0 ? 'active' : ''} style="min-width: 90px;"></md-tab>`).join('')}
      </md-tabs></div><div id="b"></div>
    `);
    await page.waitForChanges();
    await page.evaluate(() => document.getElementById('b')!.appendChild(document.querySelector('md-tabs')!));
    await page.waitForChanges();
    await new Promise((r) => setTimeout(r, 100));
    await page.evaluate(() => {
      (document.querySelector('md-tabs') as HTMLElement).style.maxWidth = '300px'; // shrink AFTER reparent
    });
    await new Promise((r) => setTimeout(r, 200));
    const clipped = await page.evaluate(() => document.querySelector('md-tabs')!.classList.contains('md-tabs--clip-right'));
    expect(clipped).toBe(true); // RO was previously dead after reconnect
  });

  it('removing a PRECEDING tab keeps the SAME tab selected (identity, not position)', async () => {
    const page = await newE2EPage();
    await page.setContent(TABS);
    await page.waitForChanges();
    await page.$eval('md-tabs', (el: HTMLElement & { selectTab: (i: number) => Promise<void> }) => el.selectTab(3));
    await page.waitForChanges();
    await page.evaluate(() => document.querySelectorAll('md-tab')[0].remove()); // remove Alpha
    await page.waitForChanges();
    await new Promise((r) => setTimeout(r, 50));
    const s = await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('md-tab'));
      const activeIdx = tabs.findIndex((t) => t.hasAttribute('active'));
      return { label: tabs[activeIdx]?.getAttribute('label'), index: (document.querySelector('md-tabs') as HTMLElement & { activeTabIndex: number }).activeTabIndex };
    });
    expect(s.label).toBe('Delta'); // selection followed the ELEMENT
    expect(s.index).toBe(2); // index re-derived from identity
  });

  it('survives a DOM reparent (listeners rebind on reconnect)', async () => {
    const page = await newE2EPage();
    await page.setContent(`${TABS}<div id="elsewhere"></div>`);
    await page.waitForChanges();
    await page.evaluate(() => document.getElementById('elsewhere')!.appendChild(document.querySelector('md-tabs')!));
    await page.waitForChanges();
    await new Promise((r) => setTimeout(r, 50));
    const spy = await page.spyOnEvent('mdTabChange');
    await page.evaluate(() => (document.querySelectorAll('md-tab')[1] as HTMLElement).click());
    await page.waitForChanges();
    expect(spy).toHaveReceivedEvent(); // previously permanently dead
    expect((await state(page)).active).toBe(1);
  });

  it('tabs forwarded through a wrapper <slot> are managed (flatten:true)', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <div id="w">
        <md-tab label="A" active></md-tab>
        <md-tab label="B"></md-tab>
      </div>
    `);
    await page.evaluate(() => {
      const w = document.getElementById('w')!;
      const shadow = w.attachShadow({ mode: 'open' });
      shadow.innerHTML = '<md-tabs aria-label="wrapped"><slot></slot></md-tabs>';
    });
    await page.waitForChanges();
    await new Promise((r) => setTimeout(r, 100));
    const s = await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('md-tab'));
      return { ids: tabs.map((t) => t.id), tabindexes: tabs.map((t) => t.getAttribute('tabindex')) };
    });
    expect(s.ids.every((id) => id.length > 0)).toBe(true); // registered
    expect(s.tabindexes).toEqual(['0', '-1']); // roving managed
  });

  it('mdTabChange payload carries index AND previousIndex', async () => {
    const page = await newE2EPage();
    await page.setContent(TABS);
    await page.waitForChanges();
    const spy = await page.spyOnEvent('mdTabChange');
    await page.evaluate(() => (document.querySelectorAll('md-tab')[1] as HTMLElement).click());
    await page.waitForChanges();
    expect(spy.lastEvent.detail).toEqual({ index: 1, previousIndex: 0 });
  });

  it('wheel input scrolls an overflowing tab strip (mouse-only reachability)', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <md-tabs aria-label="t" style="max-width: 240px; display: block;">
        ${Array.from({ length: 8 }).map((_, i) => `<md-tab label="Tab ${i}" ${i === 0 ? 'active' : ''} style="min-width: 120px;"></md-tab>`).join('')}
      </md-tabs>
    `);
    await page.waitForChanges();
    const before = await page.evaluate(() => {
      const c = document.querySelector('md-tabs')!.shadowRoot!.querySelector('.md-tabs__container') as HTMLElement;
      return { left: c.scrollLeft, clipRight: document.querySelector('md-tabs')!.classList.contains('md-tabs--clip-right') };
    });
    expect(before.clipRight).toBe(true); // fade affordance present
    await page.evaluate(() => {
      const c = document.querySelector('md-tabs')!.shadowRoot!.querySelector('.md-tabs__container') as HTMLElement;
      c.dispatchEvent(new WheelEvent('wheel', { deltaY: 240, bubbles: true, cancelable: true }));
    });
    await page.waitForChanges();
    await new Promise((r) => setTimeout(r, 100));
    const after = await page.evaluate(() => {
      const c = document.querySelector('md-tabs')!.shadowRoot!.querySelector('.md-tabs__container') as HTMLElement;
      return c.scrollLeft;
    });
    expect(after).toBeGreaterThan(before.left);
  });

  it('wheel BURST scrolls at full speed (no smooth-behavior compounding) and deltaX passes through', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <md-tabs aria-label="t" style="max-width: 240px; display: block;">
        ${Array.from({ length: 8 }).map((_, i) => `<md-tab label="Tab ${i}" ${i === 0 ? 'active' : ''} style="min-width: 120px;"></md-tab>`).join('')}
      </md-tabs>
    `);
    await page.waitForChanges();
    const r = await page.evaluate(async () => {
      const c = document.querySelector('md-tabs')!.shadowRoot!.querySelector('.md-tabs__container') as HTMLElement;
      for (let i = 0; i < 10; i++) {
        c.dispatchEvent(new WheelEvent('wheel', { deltaY: 120, bubbles: true, cancelable: true }));
        await new Promise((res) => setTimeout(res, 16));
      }
      await new Promise((res) => setTimeout(res, 300));
      const max = c.scrollWidth - c.clientWidth;
      const dx = new WheelEvent('wheel', { deltaX: 120, deltaY: 4, bubbles: true, cancelable: true });
      c.dispatchEvent(dx);
      return { scrolled: c.scrollLeft, max, deltaXPrevented: dx.defaultPrevented };
    });
    expect(r.scrolled).toBe(r.max); // 1200px of wheel input saturates 720px of overflow
    expect(r.deltaXPrevented).toBe(false); // trackpad panning stays native
  });

  it('indicator GLIDE: mid-transition the incoming indicator is BETWEEN the tabs (geometry)', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <md-tabs aria-label="t" style="width: 600px; display: block;">
        <md-tab label="Alpha" active></md-tab>
        <md-tab label="Beta"></md-tab>
        <md-tab label="Gamma"></md-tab>
      </md-tabs>
    `);
    await page.waitForChanges();
    const r = await page.evaluate(async () => {
      const tabs = Array.from(document.querySelectorAll('md-tab')) as HTMLElement[];
      const ind = (t: HTMLElement) => t.shadowRoot!.querySelector('.md-tab__indicator')!.getBoundingClientRect();
      const originCenter = ind(tabs[0]).left + ind(tabs[0]).width / 2;
      tabs[2].click();
      // let the double-rAF release fire, then sample mid-transition (400ms total)
      await new Promise((res) => setTimeout(res, 120));
      const mid = ind(tabs[2]);
      const midCenter = mid.left + mid.width / 2;
      await new Promise((res) => setTimeout(res, 600));
      const done = ind(tabs[2]);
      const destCenter = done.left + done.width / 2;
      return { originCenter, midCenter, destCenter };
    });
    // strictly between origin and destination — a pop-in-place fails this
    expect(r.midCenter).toBeGreaterThan(r.originCenter + 10);
    expect(r.midCenter).toBeLessThan(r.destCenter - 10);
  });

  it('tab-width modes: equal fills parent, auto sizes to content, fixed is content-immune', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <md-tabs aria-label="t" style="display:block; width: 600px;">
        <md-tab label="A" active></md-tab>
        <md-tab label="Considerably longer label"></md-tab>
        <md-tab label="C"></md-tab>
      </md-tabs>
    `);
    await page.waitForChanges();
    const widths = () =>
      page.evaluate(() => Array.from(document.querySelectorAll('md-tab')).map((t) => Math.round(t.getBoundingClientRect().width)));

    const equal = await widths();
    expect(equal.reduce((a, b) => a + b, 0)).toBeGreaterThanOrEqual(598); // fills the parent

    await page.$eval('md-tabs', (el) => el.setAttribute('tab-width', 'auto'));
    await page.waitForChanges();
    const auto = await widths();
    expect(auto[1]).toBeGreaterThan(auto[0]); // content-sized
    expect(auto.reduce((a, b) => a + b, 0)).toBeLessThan(598); // no stretch

    await page.$eval('md-tabs', (el) => el.setAttribute('tab-width', '140px'));
    await page.waitForChanges();
    const fixed = await widths();
    expect(fixed).toEqual([140, 140, 140]); // exact, long label ellipsized
  });

  it('fixed tab-width is FLICKER-IMMUNE: content changes never move the strip', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <md-tabs aria-label="t" tab-width="150px" style="display:block; width: 600px;">
        <md-tab label="Inbox" active badge="3"></md-tab>
        <md-tab label="Sent"></md-tab>
        <md-tab label="Archive"></md-tab>
      </md-tabs>
    `);
    await page.waitForChanges();
    const rects = () =>
      page.evaluate(() => Array.from(document.querySelectorAll('md-tab')).map((t) => {
        const r = t.getBoundingClientRect();
        return [Math.round(r.x), Math.round(r.width)];
      }));
    const before = await rects();
    // aggressive dynamic content: label growth + badge churn
    await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('md-tab'));
      tabs[0].setAttribute('badge', '999+');
      tabs[1].setAttribute('label', 'Sent with a much much longer label');
      tabs[2].setAttribute('badge', '');
    });
    await page.waitForChanges();
    await new Promise((r) => setTimeout(r, 100));
    const after = await rects();
    expect(after).toEqual(before); // zero movement — the flicker class is gone
  });


  it('width prop anchors the strip against panel-driven shrink-to-fit collapse', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <div style="display: inline-block; border: 1px solid;">
        <md-tabs aria-label="t">
          <md-tab label="Inbox" active></md-tab>
          <md-tab label="Sent"></md-tab>
        </md-tabs>
        <div id="panel" style="white-space: nowrap;">A properly wide piece of panel content that stretches the card out</div>
      </div>
    `);
    await page.waitForChanges();
    const stripW = () => page.evaluate(() => Math.round(document.querySelector('md-tabs')!.getBoundingClientRect().width));
    const wide = await stripW();
    await page.evaluate(() => { document.getElementById('panel')!.textContent = 'S'; }); // one-letter panel
    await page.waitForChanges();
    const collapsed = await stripW();
    expect(collapsed).toBeLessThan(wide); // default: strip follows the shrink-to-fit parent

    await page.evaluate(() => { document.getElementById('panel')!.textContent = 'A properly wide piece of panel content that stretches the card out'; });
    await page.$eval('md-tabs', (el) => el.setAttribute('width', '420px'));
    await page.waitForChanges();
    const anchoredWide = await stripW();
    await page.evaluate(() => { document.getElementById('panel')!.textContent = 'S'; });
    await page.waitForChanges();
    const anchoredNarrow = await stripW();
    expect(anchoredWide).toBe(420);
    expect(anchoredNarrow).toBe(420); // panel content can no longer move the strip
  });


  it('md-tab-panels keeps a shrink-to-fit card the SAME SIZE across panels (stable sizing)', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <div id="card" style="display: inline-block; border: 1px solid; padding: 12px;">
        <md-tabs aria-label="Analytics">
          <md-tab label="Overview" active></md-tab>
          <md-tab label="Activity"></md-tab>
          <md-tab label="Reports" badge="2"></md-tab>
        </md-tabs>
        <md-tab-panels>
          <md-tab-panel><div style="white-space: nowrap;">Weekly user growth — generated Mar 23, 2026 with a wide row of report content</div></md-tab-panel>
          <md-tab-panel>S</md-tab-panel>
          <md-tab-panel><div style="block-size: 180px;">tall panel</div></md-tab-panel>
        </md-tab-panels>
      </div>
    `);
    await page.waitForChanges();
    const size = () => page.evaluate(() => {
      const r = document.getElementById('card')!.getBoundingClientRect();
      return [Math.round(r.width), Math.round(r.height)];
    });
    const s0 = await size();
    await page.evaluate(() => (document.querySelectorAll('md-tab')[1] as HTMLElement).click()); // one-letter panel
    await page.waitForChanges();
    const s1 = await size();
    await page.evaluate(() => (document.querySelectorAll('md-tab')[2] as HTMLElement).click()); // tall panel
    await page.waitForChanges();
    const s2 = await size();
    expect(s1).toEqual(s0); // the card NEVER moves
    expect(s2).toEqual(s0);
    // only the active panel is visible / interactive
    const vis = await page.evaluate(() =>
      Array.from(document.querySelectorAll('md-tab-panel')).map((p) => ({
        active: p.hasAttribute('active'),
        visibility: getComputedStyle(p.shadowRoot!.querySelector('.md-tab-panel__body')!).visibility,
        inert: p.hasAttribute('inert'),
      })),
    );
    expect(vis.map((v) => v.active)).toEqual([false, false, true]);
    expect(vis.filter((v) => !v.active).every((v) => v.visibility === 'hidden' && v.inert)).toBe(true);
  });

  it('md-tab-panels sizing="active" opts back into content-driven sizing', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <div id="card" style="display: inline-block; border: 1px solid;">
        <md-tabs aria-label="t"><md-tab label="A" active></md-tab><md-tab label="B"></md-tab></md-tabs>
        <md-tab-panels sizing="active">
          <md-tab-panel><div style="inline-size: 500px;">wide</div></md-tab-panel>
          <md-tab-panel>S</md-tab-panel>
        </md-tab-panels>
      </div>
    `);
    await page.waitForChanges();
    const w = () => page.evaluate(() => Math.round(document.getElementById('card')!.getBoundingClientRect().width));
    const wide = await w();
    await page.evaluate(() => (document.querySelectorAll('md-tab')[1] as HTMLElement).click());
    await page.waitForChanges();
    expect(await w()).toBeLessThan(wide); // active mode: card follows the panel
  });

});
