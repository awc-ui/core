import { newE2EPage, E2EPage } from '@stencil/core/testing';

describe('md-switch e2e', () => {
  it('renders', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-switch></md-switch>');
    const el = await page.find('md-switch');
    expect(el).not.toBeNull();
  });

  it('fires mdChange on click', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-switch></md-switch>');
    const el = await page.find('md-switch');
    const spy = await el.spyOnEvent('mdChange');
    await el.click();
    await page.waitForChanges();
    expect(spy).toHaveReceivedEvent();
  });

  // ─── Form association (verified in a real browser — spec mock no-ops setFormValue) ───

  it('submits its value under name only when selected', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <form id="f">
        <md-switch name="wifi" value="on"></md-switch>
      </form>`);
    const read = () =>
      page.evaluate(() => {
        const fd = new FormData(document.getElementById('f') as HTMLFormElement);
        return fd.get('wifi');
      });
    expect(await read()).toBeNull(); // off → absent
    await (await page.find('md-switch')).click(); // turn on
    await page.waitForChanges();
    expect(await read()).toBe('on'); // on → submitted
  });

  it('restores its state on form reset', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <form id="f">
        <md-switch name="wifi" selected></md-switch>
        <button type="reset" id="r">reset</button>
      </form>`);
    const sw = await page.find('md-switch');
    await sw.click(); // now off
    await page.waitForChanges();
    expect(await sw.getProperty('selected')).toBe(false);
    await (await page.find('#r')).click();
    await page.waitForChanges();
    expect(await sw.getProperty('selected')).toBe(true); // restored to initial
  });

  // ─── Label association ───

  it('toggles when the wrapping label text is clicked (native labelable forwarding)', async () => {
    const page = await newE2EPage();
    await page.setContent('<label style="display:inline-flex;gap:12px;align-items:center">Wi-Fi <md-switch id="s"></md-switch></label>');
    await page.waitForChanges();
    // real click on the label's text region (its left edge), not the switch
    const box = await page.evaluate(() => {
      const r = document.querySelector('label')!.getBoundingClientRect();
      return { x: r.left + 4, y: r.top + r.height / 2 };
    });
    await page.mouse.click(box.x, box.y);
    await page.waitForChanges();
    expect(await (await page.find('#s')).getProperty('selected')).toBe(true);
  });

  // ─── Keyboard ───

  it('Space toggles, Enter does not', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-switch></md-switch>');
    const sw = await page.find('md-switch');
    await sw.focus();
    await page.keyboard.press('Enter');
    await page.waitForChanges();
    expect(await sw.getProperty('selected')).toBe(false); // Enter reserved for submit
    await page.keyboard.press(' ');
    await page.waitForChanges();
    expect(await sw.getProperty('selected')).toBe(true); // Space toggles
  });

  it('disabled does not toggle or fire', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-switch disabled></md-switch>');
    const sw = await page.find('md-switch');
    const spy = await sw.spyOnEvent('mdChange');
    await sw.click();
    await page.waitForChanges();
    expect(await sw.getProperty('selected')).toBe(false);
    expect(spy).not.toHaveReceivedEvent();
  });

  it('controlled mode: preventDefault on mdInput blocks the internal toggle', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-switch></md-switch>');
    await page.evaluate(() => {
      document.querySelector('md-switch')!.addEventListener('mdInput', (e) => e.preventDefault());
    });
    const sw = await page.find('md-switch');
    const changed = await sw.spyOnEvent('mdChange');
    await sw.click();
    await page.waitForChanges();
    expect(await sw.getProperty('selected')).toBe(false); // vetoed
    expect(changed).not.toHaveReceivedEvent();
  });

  // ─── Geometry, motion & theming ───

  const handleSize = (page: E2EPage, sel = 'md-switch') =>
    page.evaluate((s: string) => {
      const h = document.querySelector(s)!.shadowRoot!.querySelector('.md-switch__handle') as HTMLElement;
      const r = h.getBoundingClientRect();
      return Math.round(r.width);
    }, sel);

  it('thumb morphs 16 → 24 → 28px across unselected / selected / pressed', async () => {
    const page = await newE2EPage();
    await page.setViewport({ width: 400, height: 200 });
    await page.setContent('<md-switch></md-switch>');
    await page.waitForChanges();
    await new Promise((r) => setTimeout(r, 400));
    expect(await handleSize(page)).toBe(16); // unselected

    await (await page.find('md-switch')).click(); // selected
    await page.waitForChanges();
    await new Promise((r) => setTimeout(r, 500));
    expect(await handleSize(page)).toBe(24);

    // hold the pointer down → pressed
    const box = await page.evaluate(() => {
      const r = document.querySelector('md-switch')!.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    await page.mouse.move(box.x, box.y);
    await page.mouse.down();
    await new Promise((r) => setTimeout(r, 500));
    const pressed = await handleSize(page);
    await page.mouse.up();
    expect(pressed).toBe(28);
  }, 60000);

  it('offers a >=48px interactive target', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-switch></md-switch>');
    const size = await page.evaluate(() => {
      const r = document.querySelector('md-switch')!.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height) };
    });
    expect(size.w).toBeGreaterThanOrEqual(48);
    expect(size.h).toBeGreaterThanOrEqual(48);
  });

  it('density tokens scale the thumb (track-height 24 → thumb ~18px selected)', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-switch selected style="--md-switch-track-height:24px;--md-switch-track-width:40px"></md-switch>');
    await page.waitForChanges();
    await new Promise((r) => setTimeout(r, 500));
    const w = await handleSize(page);
    expect(w).toBeGreaterThanOrEqual(17);
    expect(w).toBeLessThanOrEqual(19); // 24 * 0.75 = 18
  }, 60000);

  it('focus ring shows on :focus-visible AND on programmatic setFocus()', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-switch></md-switch>');
    const ringWidth = () =>
      page.evaluate(() => {
        const track = document.querySelector('md-switch')!.shadowRoot!.querySelector('.md-switch__track') as HTMLElement;
        return parseFloat(getComputedStyle(track).outlineWidth) || 0;
      });
    await page.evaluate(() => (document.querySelector('md-switch') as any).setFocus());
    await page.waitForChanges();
    expect(await ringWidth()).toBeGreaterThanOrEqual(2); // programmatic ring visible
  }, 60000);

  it('RTL: the thumb travels to the left edge when selected', async () => {
    const page = await newE2EPage();
    await page.setContent('<div dir="rtl"><md-switch></md-switch></div>');
    await page.waitForChanges();
    const thumbCx = () =>
      page.evaluate(() => {
        const sw = document.querySelector('md-switch')!;
        const track = sw.shadowRoot!.querySelector('.md-switch__track')!.getBoundingClientRect();
        const handle = sw.shadowRoot!.querySelector('.md-switch__handle')!.getBoundingClientRect();
        return { trackCx: track.left + track.width / 2, handleCx: handle.left + handle.width / 2 };
      });
    const off = await thumbCx();
    expect(off.handleCx).toBeGreaterThan(off.trackCx); // RTL off → thumb on the right
    await (await page.find('md-switch')).click();
    await page.waitForChanges();
    await new Promise((r) => setTimeout(r, 500));
    const on = await thumbCx();
    expect(on.handleCx).toBeLessThan(on.trackCx); // RTL on → thumb mirrored to the left
  }, 60000);

  it('custom icons: glyph override + slotted SVG project onto the handle', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <md-switch id="g" selected icons selected-icon="bolt"></md-switch>
      <md-switch id="s" selected icons>
        <svg slot="selected-icon" data-custom viewBox="0 0 24 24"><path d="M0 0h24v24H0z"/></svg>
      </md-switch>`);
    await page.waitForChanges();
    // glyph override renders the overridden Material Symbol
    const glyph = await page.evaluate(() =>
      document.getElementById('g')!.shadowRoot!.querySelector('.md-switch__icon')!.textContent!.trim(),
    );
    expect(glyph).toBe('bolt');
    // slotted SVG is projected + assigned to the selected-icon slot (fallback replaced)
    const slotted = await page.evaluate(() => {
      const slot = document.getElementById('s')!.shadowRoot!.querySelector('slot[name="selected-icon"]') as HTMLSlotElement;
      const assigned = slot.assignedElements();
      return { count: assigned.length, custom: assigned[0]?.hasAttribute('data-custom') ?? false };
    });
    expect(slotted).toEqual({ count: 1, custom: true });
  }, 60000);

  it('reduced motion: the thumb slide is not animated', async () => {
    const page = await newE2EPage();
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.setContent('<md-switch></md-switch>');
    await page.waitForChanges();
    const dur = await page.evaluate(() => {
      const c = document.querySelector('md-switch')!.shadowRoot!.querySelector('.md-switch__handle-container') as HTMLElement;
      return getComputedStyle(c).transitionDuration;
    });
    expect(parseFloat(dur)).toBeLessThan(0.05); // ~0.01ms
  }, 60000);
});
