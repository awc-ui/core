import { newE2EPage } from '@stencil/core/testing';

// Event-detail, controlled-mode and reduced-motion contract checks (Gate 1, 2026-10-25).
const focusInput = (page: any, sel: string) =>
  page.$eval('md-slider', (el: any, sel: string) => (el.shadowRoot.querySelector(sel) as HTMLElement).focus(), sel);
const dom = (page: any, sel = 'input') =>
  page.$eval('md-slider', (el: any, sel: string) => {
    const i = el.shadowRoot.querySelector(sel) as HTMLInputElement;
    return { value: Number(i.value), now: Number(i.getAttribute('aria-valuenow')) };
  }, sel);

describe('md-slider contract', () => {
  it('range keyboard events report the moved thumb as `value`, like pointer drags do', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-slider range value-start="20" value-end="80"></md-slider>');
    const host = await page.find('md-slider');
    const input = await host.spyOnEvent('mdInput');
    const change = await host.spyOnEvent('mdChange');
    await focusInput(page, '.md-slider__input--start');
    await page.keyboard.press('ArrowRight');
    await page.waitForChanges();
    await focusInput(page, '.md-slider__input--end');
    await page.keyboard.press('ArrowLeft');
    await page.waitForChanges();
    expect(input.events.map(e => e.detail)).toEqual([
      { value: 21, valueStart: 21, valueEnd: 80 },
      { value: 79, valueStart: 21, valueEnd: 79 },
    ]);
    expect(change.events.map(e => e.detail)).toEqual(input.events.map(e => e.detail));
  });

  it('range pointer drags keep reporting the dragged thumb (guard)', async () => {
    const page = await newE2EPage();
    await page.setContent('<div style="width:400px;padding:40px"><md-slider range value-start="20" value-end="80"></md-slider></div>');
    const host = await page.find('md-slider');
    const input = await host.spyOnEvent('mdInput');
    const r = await page.$eval('md-slider', el => { const b = el.shadowRoot!.querySelector('.md-slider__rail')!.getBoundingClientRect(); return { x: b.x, y: b.y + b.height / 2, w: b.width }; });
    await page.mouse.move(r.x + r.w * 0.2, r.y);
    await page.mouse.down();
    await page.mouse.move(r.x + r.w * 0.3, r.y, { steps: 2 });
    await page.mouse.up();
    await page.waitForChanges();
    const last = input.events[input.events.length - 1].detail;
    expect(last.value).toBe(last.valueStart);
    expect(last.valueEnd).toBe(80);
  });

  it('controlled: a rejected keyboard step leaves the native input at the prop value', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-slider controlled value="50"></md-slider>');
    const host = await page.find('md-slider');
    const input = await host.spyOnEvent('mdInput');
    await focusInput(page, 'input');
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('ArrowRight');
      await page.waitForChanges();
      expect(await dom(page)).toEqual({ value: 50, now: 50 });
    }
    // Each step starts from the value the slider shows (the prop), not from a stale DOM value.
    expect(input.events.map(e => e.detail.value)).toEqual([51, 51, 51]);
  });

  it('controlled: a clamping handler can be stepped back off its cap in one key press', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-slider controlled value="50"></md-slider>');
    await page.$eval('md-slider', (el: any) => el.addEventListener('mdInput', (e: any) => { el.value = Math.min(52, e.detail.value); }));
    await focusInput(page, 'input');
    for (let i = 0; i < 4; i++) { await page.keyboard.press('ArrowRight'); await page.waitForChanges(); }
    expect(await page.$eval('md-slider', (el: any) => el.value)).toBe(52);
    expect(await dom(page)).toEqual({ value: 52, now: 52 });
    await page.keyboard.press('ArrowLeft');
    await page.waitForChanges();
    expect(await page.$eval('md-slider', (el: any) => el.value)).toBe(51);
  });

  it('controlled range: rejected keyboard steps leave both native inputs at their props', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-slider controlled range value-start="20" value-end="80"></md-slider>');
    await focusInput(page, '.md-slider__input--start');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.waitForChanges();
    expect(await dom(page, '.md-slider__input--start')).toEqual({ value: 20, now: 20 });
    expect(await dom(page, '.md-slider__input--end')).toEqual({ value: 80, now: 80 });
  });

  // What the slider paints: the thumb/active-track position vars and the thumb boxes.
  const paint = (page: any) => page.$eval('md-slider', (el: any) => ({
    vars: ['--_value-pct', '--_start-pct', '--_end-pct', '--_active-width-pct'].map(k => el.style.getPropertyValue(k)),
    thumbs: [...el.shadowRoot.querySelectorAll('.md-slider__thumb')].map((t: Element) => Math.round(t.getBoundingClientRect().x)),
  }));
  const railPoint = (page: any, f: number) => page.$eval('md-slider', (el: any, f: number) => {
    const r = el.shadowRoot.querySelector('.md-slider__rail').getBoundingClientRect();
    return { x: r.x + r.width * f, y: r.y + r.height / 2 };
  }, f);
  const dragRail = async (page: any, from: number, to: number) => {
    const a = await railPoint(page, from), b = await railPoint(page, to);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 4 });
    await page.mouse.up();
    await page.waitForChanges();
  };

  it.each([
    ['single', 'value="50"', 'input', 0.5],
    ['range', 'range value-start="20" value-end="80"', '.md-slider__input--start', 0.8],
  ])('controlled %s: a rejected key step or drag leaves the thumb painted at the prop value', async (_, attrs, sel, from) => {
    const page = await newE2EPage();
    await page.setContent(`<div style="width:400px;padding:40px"><md-slider controlled ${attrs}></md-slider></div>`);
    const shown = await paint(page);
    await focusInput(page, sel as string);
    await page.keyboard.press('ArrowRight');
    await page.waitForChanges();
    expect(await paint(page)).toEqual(shown);
    await dragRail(page, from as number, 0.9);
    expect(await paint(page)).toEqual(shown);
  });

  it('value indicator: the bubble tapers with density and stays inside its reserved head room', async () => {
    const seen: any[] = [];
    for (const d of [0, -1, -2, -3, -4]) {
      const page = await newE2EPage();
      await page.setContent(`<div style="padding:60px;width:400px"><md-slider value-indicator value="30" style="--md-sys-density-scale:${d}"></md-slider></div>`);
      seen.push(await page.$eval('md-slider', (el: any) => {
        const h = el.getBoundingClientRect(), b = el.shadowRoot.querySelector('.md-slider__value-indicator').getBoundingClientRect();
        return { height: Math.round(b.height), inside: b.top >= h.top - 0.5 };
      }));
    }
    expect(seen).toEqual([44, 40, 36, 32, 28].map(height => ({ height, inside: true })));
  });

  it.each(['value="30"', 'range value-start="20" value-end="60"', 'orientation="vertical" value="30"'])(
    'disabled (%s): pressing and dragging emits no drag or value events', async attrs => {
      const page = await newE2EPage();
      await page.setContent(`<div style="width:400px;height:260px;padding:40px"><md-slider disabled ${attrs}></md-slider></div>`);
      const host = await page.find('md-slider');
      const spies = await Promise.all(['mdDragStart', 'mdDragEnd', 'mdInput', 'mdChange'].map(n => host.spyOnEvent(n)));
      const a = await railPoint(page, 0.3), b = await railPoint(page, 0.7);
      await page.mouse.move(a.x, a.y);
      await page.mouse.down();
      await page.mouse.move(b.x, b.y, { steps: 3 });
      await page.mouse.up();
      await page.waitForChanges();
      expect(spies.map(s => s.events.length)).toEqual([0, 0, 0, 0]);
    });

  // The stylesheet's transitions read motion tokens; tokens are not loaded in e2e pages, so the
  // test page defines them (long durations keep every transition observable while it runs).
  const motionPage = async (reduce: boolean) => {
    const page = await newE2EPage();
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: reduce ? 'reduce' : 'no-preference' }]);
    await page.setContent('<md-slider stops step="10" value="50" style="width:300px;--md-sys-motion-duration-short2:3s;--md-sys-motion-easing-standard:ease;--md-sys-motion-spring-spatial-fast-duration:3s;--md-sys-motion-spring-effects-default-duration:3s"></md-slider>');
    await focusInput(page, 'input');
    await page.keyboard.down('ArrowRight');
    await page.waitForChanges();
    const running = await page.$eval('md-slider', (el: any) => {
      const props = (sel: string) => [...el.shadowRoot.querySelectorAll(sel)].flatMap((n: Element) => n.getAnimations().map((a: any) => a.transitionProperty)).filter(Boolean).sort();
      return { knob: props('.md-slider__thumb-knob'), active: props('.md-slider__track-active'), ticks: [...new Set(props('.md-slider__tick'))] };
    });
    await page.keyboard.up('ArrowRight');
    return running;
  };

  it('animates the stop spring, ticks and knob press without reduced motion (guard)', async () => {
    const running = await motionPage(false);
    expect(running.knob.length).toBeGreaterThan(0);
    expect(running.active.length).toBeGreaterThan(0);
    expect(running.ticks.length).toBeGreaterThan(0);
  });

  it('honours prefers-reduced-motion: no stop spring, tick fade or knob press transition', async () => {
    expect(await motionPage(true)).toEqual({ knob: [], active: [], ticks: [] });
  });

  // Chromium ignores aria-orientation on a native range input and derives the exposed orientation
  // (and the arrow-key mapping) from the input's own writing mode, not from a CSS rotation.
  const orientations = async (page: any) => {
    const found: string[] = [];
    const walk = (n: any) => { if (n.role === 'slider') found.push(n.orientation); (n.children || []).forEach(walk); };
    walk(await page.accessibility.snapshot());
    return found;
  };

  it('vertical sliders expose a vertical orientation to assistive tech', async () => {
    const page = await newE2EPage();
    await page.setContent(`<div style="display:flex;gap:24px;height:300px">
      <md-slider orientation="vertical" aria-label="a" value="50"></md-slider>
      <md-slider orientation="vertical" range value-start="20" value-end="60" label-start="b" label-end="c"></md-slider>
      <md-slider orientation="vertical" full-height aria-label="d" value="50"></md-slider>
      <md-slider aria-label="e" value="50"></md-slider></div>`);
    expect(await orientations(page)).toEqual(['vertical', 'vertical', 'vertical', 'vertical', 'horizontal']);
  });

  const arrows = async (attrs: string, dir: string) => {
    const page = await newE2EPage();
    await page.setContent(`<div dir="${dir}" style="height:300px"><md-slider aria-label="v" value="50" ${attrs}></md-slider></div>`);
    const steps: number[] = [];
    for (const key of ['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'] as const) {
      await focusInput(page, 'input');
      await page.keyboard.press(key);
      await page.waitForChanges();
      steps.push((await dom(page)).now);
    }
    return steps;
  };

  it.each(['ltr', 'rtl'])('vertical arrows follow the vertical axis (%s): Up/Right increase, Down/Left decrease', async dir => {
    expect(await arrows('orientation="vertical"', dir)).toEqual([51, 52, 51, 50]);
  });

  it('horizontal RTL keeps the mirrored native arrows (guard)', async () => {
    expect(await arrows('', 'rtl')).toEqual([51, 50, 49, 50]);
  });
});
