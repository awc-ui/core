import { newE2EPage, E2EPage } from '@stencil/core/testing';

/**
 * Measurement coverage for md-stepper / md-step — the things jsdom can't see:
 * the fixed indicator baseline (alignment), the circular ripple, the connector
 * fill, the active bubble spring, reduced-motion, and the compact
 * label collapse.
 */
const FOUR = `
  <md-stepper id="sp" active="1">
    <md-step label="Cart" completed></md-step>
    <md-step label="Shipping" description="Address & method"></md-step>
    <md-step label="Payment"></md-step>
    <md-step label="Review"></md-step>
  </md-stepper>`;

describe('md-stepper · baseline alignment', () => {
  it('all bubbles + connectors share one Y even with a described active step', async () => {
    const page = await newE2EPage();
    await page.setViewport({ width: 900, height: 400 });
    await page.setContent(FOUR);
    await page.waitForChanges();
    await new Promise((r) => setTimeout(r, 400));
    const centres = await page.evaluate(() => {
      const out: number[] = [];
      (Array.from(document.querySelectorAll('#sp md-step')) as HTMLElement[]).forEach((s) => {
        const sr = s.shadowRoot!;
        [sr.querySelector('.md-step__bubble'), sr.querySelector('.md-step__connector--leading'), sr.querySelector('.md-step__connector--trailing')].forEach((el) => {
          if (!el) return;
          const r = (el as HTMLElement).getBoundingClientRect();
          out.push(Math.round(r.top + r.height / 2));
        });
      });
      return out;
    });
    const base = centres[0];
    centres.forEach((c) => expect(Math.abs(c - base)).toBeLessThanOrEqual(1));
  }, 60000);

  it('bubble-on-top / label-below with evenly-spaced bubbles', async () => {
    const page = await newE2EPage();
    await page.setViewport({ width: 900, height: 400 });
    await page.setContent(FOUR);
    await page.waitForChanges();
    const geo = await page.evaluate(() =>
      (Array.from(document.querySelectorAll('#sp md-step')) as HTMLElement[]).map((s) => {
        const b = (s.shadowRoot!.querySelector('.md-step__bubble') as HTMLElement).getBoundingClientRect();
        const l = (s.shadowRoot!.querySelector('.md-step__label') as HTMLElement).getBoundingClientRect();
        return { cx: b.left + b.width / 2, bottom: b.bottom, labelTop: l.top };
      }),
    );
    geo.forEach((g) => expect(g.labelTop).toBeGreaterThanOrEqual(g.bottom - 1));
    const gaps = geo.slice(1).map((g, i) => g.cx - geo[i].cx);
    const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    gaps.forEach((g) => expect(Math.abs(g - avg)).toBeLessThanOrEqual(2));
  }, 60000);
});

describe('md-stepper · vertical rail', () => {
  it('rail is straight + continuous and a tall content step does not stretch it', async () => {
    const page = await newE2EPage();
    await page.setViewport({ width: 600, height: 900 });
    await page.setContent(`
      <md-stepper id="sp" orientation="vertical" active="1">
        <md-step label="Account" completed><p>body</p></md-step>
        <md-step label="Shipping" active><p style="height:120px">tall body</p></md-step>
        <md-step label="Payment"><p>body</p></md-step>
      </md-stepper>`);
    await page.waitForChanges();
    await new Promise((r) => setTimeout(r, 250));
    const d = await page.evaluate(() => {
      const steps = Array.from(document.querySelectorAll('#sp md-step')) as HTMLElement[];
      const r = (el: Element | null) => {
        if (!el) return null;
        const rect = (el as HTMLElement).getBoundingClientRect();
        return rect.width === 0 && rect.height === 0 ? null : rect; // skip hidden leadings
      };
      const cx = (x: DOMRect | null) => (x ? x.left + x.width / 2 : null);
      return steps.map((s) => {
        const sr = s.shadowRoot!;
        const b = r(sr.querySelector('.md-step__bubble'))!;
        const trail = r(sr.querySelector('.md-step__connector--trailing'));
        return {
          bx: cx(b), by: b.top + b.height / 2, br: b.height / 2,
          bTop: b.top, bBottom: b.bottom,
          trailX: cx(trail), trailTop: trail?.top ?? null, trailBottom: trail?.bottom ?? null,
          trailRadius: trail
            ? parseFloat(getComputedStyle(sr.querySelector('.md-step__connector--trailing')!).borderRadius)
            : 0,
        };
      });
    });
    // straight rail: every bubble + VISIBLE connector centre shares one X
    const xs = d.flatMap((s) => [s.bx, s.trailX]).filter((v): v is number => v != null);
    xs.forEach((x) => expect(Math.abs(x - xs[0])).toBeLessThanOrEqual(1));
    // ONE rounded rail per gap (like horizontal): a ~10px gap below each bubble,
    // rounded caps. step0 (completed) trailing starts --_connector-gap below its
    // bubble; the last step has no trailing at all.
    expect(d[0].trailTop! - d[0].bBottom).toBeGreaterThan(3);
    expect(d[0].trailTop! - d[0].bBottom).toBeLessThan(10);
    expect(d[0].trailRadius).toBeGreaterThanOrEqual(2); // rounded caps, not square
    expect(d[2].trailTop).toBeNull(); // last step: no rail below
    // ACTIVE step (step1): its own leading is hidden; the trailing starts a clear
    // gap below the (scaled) bubble so the line never runs under the halo.
    expect(d[1].trailTop! - d[1].bBottom).toBeGreaterThan(4);
    // the active step's trailing runs down PAST its content (not stuck at ~half the box)
    expect(d[1].trailBottom! - d[1].by).toBeGreaterThan(120);
  }, 60000);
});

describe('md-stepper · affordance + motion', () => {
  it('hover/ripple affordance is a circle hugging the bubble, not a step-wide rectangle', async () => {
    const page = await newE2EPage();
    await page.setViewport({ width: 900, height: 400 });
    await page.setContent(FOUR);
    await page.waitForChanges();
    const r = await page.evaluate(() => {
      const step = document.querySelectorAll('#sp md-step')[1] as HTMLElement;
      const sr = step.shadowRoot!;
      const layer = sr.querySelector('.md-step__state-layer') as HTMLElement;
      const ripple = (sr.querySelector('md-ripple') as HTMLElement).shadowRoot!.querySelector('.md-ripple') as HTMLElement;
      const lb = layer.getBoundingClientRect();
      return {
        w: Math.round(lb.width), h: Math.round(lb.height),
        layerRadius: getComputedStyle(layer).borderRadius,
        rippleRadius: getComputedStyle(ripple).borderRadius,
        bubbleW: Math.round((sr.querySelector('.md-step__bubble') as HTMLElement).getBoundingClientRect().width),
        innerW: Math.round((sr.querySelector('.md-step__inner') as HTMLElement).getBoundingClientRect().width),
      };
    });
    expect(Math.abs(r.w - r.h)).toBeLessThanOrEqual(1); // circular
    expect(r.layerRadius === '50%' || parseFloat(r.layerRadius) >= r.w / 2 - 1).toBe(true);
    expect(r.rippleRadius === '50%' || parseFloat(r.rippleRadius) >= r.w / 2 - 1).toBe(true); // ripple is round
    expect(r.w).toBeLessThanOrEqual(r.bubbleW + 20);
    expect(r.w).toBeLessThan(r.innerW - 20);
  }, 60000);

  it('active bubble springs up; reduced motion keeps it flat', async () => {
    const scaleOf = async (rm: 'no-preference' | 'reduce') => {
      const page = await newE2EPage();
      await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: rm }]);
      await page.setContent(FOUR);
      await page.waitForChanges();
      await new Promise((r) => setTimeout(r, rm === 'reduce' ? 50 : 600));
      return page.evaluate(() => {
        const b = (document.querySelectorAll('#sp md-step')[1] as HTMLElement).shadowRoot!.querySelector('.md-step__bubble') as HTMLElement;
        const t = getComputedStyle(b).transform;
        return t === 'none' ? 1 : parseFloat(t.match(/matrix\(([^)]+)\)/)![1].split(',')[0]);
      });
    };
    expect(await scaleOf('no-preference')).toBeGreaterThan(1.05);
    expect(await scaleOf('reduce')).toBe(1);
  }, 60000);
});

describe('md-stepper · connectors', () => {
  it('the line animates (scaleX grows over time) when you advance past a step', async () => {
    const page = await newE2EPage();
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
    await page.setContent(`
      <md-stepper id="sp" active="0">
        <md-step label="One"></md-step><md-step label="Two"></md-step>
      </md-stepper>`);
    await page.waitForChanges();
    const probe = () =>
      page.evaluate(() => {
        const conn = (document.querySelectorAll('#sp md-step')[0] as HTMLElement).shadowRoot!.querySelector('.md-step__connector--trailing') as HTMLElement;
        const cs = getComputedStyle(conn, '::after');
        const t = cs.transform;
        return {
          scale: t === 'none' ? 1 : parseFloat(t.match(/matrix\(([^)]+)\)/)![1].split(',')[0]),
          dur: parseFloat(cs.transitionDuration) || 0,
        };
      });
    // moving past step 0 (active 0 → 1) fills its trailing connector, animated.
    // Assert the ANIMATION (transition duration > 0 + it didn't snap to full,
    // then fills over time) rather than a specific mid-value at a fixed instant,
    // which is racy under load.
    await page.evaluate(() => { (document.getElementById('sp') as any).active = 1; });
    await page.waitForChanges();
    const early = await probe();
    await new Promise((r) => setTimeout(r, 700));
    const end = await probe();
    expect(early.dur).toBeGreaterThan(0); // has a real transition (not instant)
    expect(early.scale).toBeLessThan(0.9); // did not snap to full immediately
    expect(end.scale).toBeGreaterThan(0.95); // ...and fills over time
  }, 60000);

  it('auto-complete: going back greys the connectors AND un-checks the steps ahead', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <md-stepper id="sp" mode="non-linear" active="2">
        <md-step label="One" completed></md-step>
        <md-step label="Two" completed></md-step>
        <md-step label="Three"></md-step>
      </md-stepper>`);
    await page.waitForChanges();
    const probe = () =>
      page.evaluate(() => {
        const steps = Array.from(document.querySelectorAll('#sp md-step')) as HTMLElement[];
        const filledTrailing = (i: number) =>
          !!steps[i].shadowRoot!.querySelector('.md-step__connector--trailing.md-step__connector--filled');
        return { gap0: filledTrailing(0), gap1: filledTrailing(1), completed: steps.map((s) => (s as any).completed) };
      });
    expect(await probe()).toMatchObject({ gap0: true, gap1: true, completed: [true, true, false] });
    // click the first step
    await page.evaluate(() => {
      const s = document.querySelectorAll('#sp md-step')[0] as HTMLElement;
      (s.shadowRoot!.querySelector('.md-step__inner') as HTMLElement).click();
    });
    await page.waitForChanges();
    await new Promise((r) => setTimeout(r, 100));
    // on step 0 → lines grey AND the checks ahead are reverted
    expect(await probe()).toMatchObject({ gap0: false, gap1: false, completed: [false, false, false] });
  }, 60000);

  it('controlled (auto-complete=false): going back keeps completed (line still greys)', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <md-stepper id="sp" mode="non-linear" active="2" auto-complete="false">
        <md-step label="One" completed editable></md-step>
        <md-step label="Two" completed editable></md-step>
        <md-step label="Three"></md-step>
      </md-stepper>`);
    await page.waitForChanges();
    await page.evaluate(() => {
      const s = document.querySelectorAll('#sp md-step')[0] as HTMLElement;
      (s.shadowRoot!.querySelector('.md-step__inner') as HTMLElement).click();
    });
    await page.waitForChanges();
    const r = await page.evaluate(() => {
      const steps = Array.from(document.querySelectorAll('#sp md-step')) as HTMLElement[];
      return {
        active: (document.getElementById('sp') as any).active,
        completed: steps.map((s) => (s as any).completed),
        gap0: !!steps[0].shadowRoot!.querySelector('.md-step__connector--trailing.md-step__connector--filled'),
      };
    });
    expect(r.active).toBe(0);
    expect(r.completed).toEqual([true, true, false]); // checks preserved (controlled)
    expect(r.gap0).toBe(false); // line still reflects current position
  }, 60000);

  it('each gap is ONE connector spanning bubble-to-bubble (not two half segments)', async () => {
    const page = await newE2EPage();
    await page.setViewport({ width: 900, height: 400 });
    await page.setContent(`
      <md-stepper id="sp" active="1">
        <md-step label="One" completed></md-step>
        <md-step label="Two" active></md-step>
        <md-step label="Three"></md-step>
      </md-stepper>`);
    await page.waitForChanges();
    const r = await page.evaluate(() => {
      const steps = Array.from(document.querySelectorAll('#sp md-step')) as HTMLElement[];
      const rect = (el: Element | null) => (el ? (el as HTMLElement).getBoundingClientRect() : null);
      const b0 = rect(steps[0].shadowRoot!.querySelector('.md-step__bubble'))!;
      const b1 = rect(steps[1].shadowRoot!.querySelector('.md-step__bubble'))!;
      // step 0 has exactly one connector (its trailing); step 1 has no leading
      const s0connectors = steps[0].shadowRoot!.querySelectorAll('.md-step__connector').length;
      const s1leading = steps[1].shadowRoot!.querySelector('.md-step__connector--leading');
      const conn = rect(steps[0].shadowRoot!.querySelector('.md-step__connector--trailing'))!;
      return {
        s0connectors,
        hasLeading: !!s1leading,
        connLeft: conn.left, connRight: conn.right,
        b0right: b0.right, b1left: b1.left,
        gap: b1.left - b0.right,
        connW: conn.width,
      };
    });
    expect(r.s0connectors).toBe(1); // a single connector per step, not two halves
    expect(r.hasLeading).toBe(false); // no separate leading half in horizontal
    // the single connector spans most of the gap between the two bubbles
    expect(r.connLeft).toBeGreaterThan(r.b0right - 1); // starts after bubble 0
    expect(r.connRight).toBeLessThan(r.b1left + 1); // ends before bubble 1
    expect(r.connW).toBeGreaterThan(r.gap * 0.6); // spans the bulk of the gap (not ~half)
  }, 60000);

  it('connector is an expressive rounded 4px progress track (no mask)', async () => {
    const page = await newE2EPage();
    await page.setViewport({ width: 900, height: 400 });
    await page.setContent(`
      <md-stepper id="sp" active="1"><md-step label="A" completed></md-step><md-step label="B" active></md-step><md-step label="C"></md-step></md-stepper>`);
    await page.waitForChanges();
    const line = await page.evaluate(() => {
      const conn = (document.querySelectorAll('#sp md-step')[1] as HTMLElement).shadowRoot!.querySelector('.md-step__connector') as HTMLElement;
      const cs = getComputedStyle(conn);
      return {
        mask: cs.maskImage || (cs as any).webkitMaskImage,
        h: Math.round(conn.getBoundingClientRect().height),
        radius: parseFloat(cs.borderRadius),
      };
    });
    expect(line.mask === 'none' || !line.mask).toBe(true);
    expect(line.h).toBeGreaterThanOrEqual(3); // expressive 4px, not a hairline
    expect(line.h).toBeLessThanOrEqual(5);
    expect(line.radius).toBeGreaterThanOrEqual(line.h / 2 - 1); // rounded caps
  }, 60000);

  it('reduced motion: the connector fill snaps instead of sweeping', async () => {
    const page = await newE2EPage();
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.setContent(`
      <md-stepper id="sp" active="0">
        <md-step label="One"></md-step><md-step label="Two"></md-step>
      </md-stepper>`);
    await page.waitForChanges();
    await page.evaluate(() => { (document.getElementById('sp') as any).active = 1; });
    await page.waitForChanges();
    const readScale = () =>
      page.evaluate(() => {
        const conn = (document.querySelectorAll('#sp md-step')[0] as HTMLElement).shadowRoot!.querySelector('.md-step__connector--trailing') as HTMLElement;
        const t = getComputedStyle(conn, '::after').transform;
        return t === 'none' ? 1 : parseFloat(t.match(/matrix\(([^)]+)\)/)![1].split(',')[0]);
      });
    // Under reduced motion the fill has a ~0.01ms transition, so it reaches full
    // almost immediately — poll briefly so a slow render/paint under load doesn't
    // read the pre-fill frame.
    let scale = 0;
    for (let i = 0; i < 25 && scale <= 0.95; i++) {
      await new Promise((r) => setTimeout(r, 20));
      scale = await readScale();
    }
    expect(scale).toBeGreaterThan(0.95);
  }, 60000);
});

describe('md-stepper · expressive indicators', () => {
  it('every bubble stays circular (active included) and only the active one springs up', async () => {
    const page = await newE2EPage();
    await page.setViewport({ width: 900, height: 400 });
    await page.setContent(FOUR);
    await page.waitForChanges();
    await new Promise((r) => setTimeout(r, 600));
    const b = await page.evaluate(() =>
      (Array.from(document.querySelectorAll('#sp md-step')) as HTMLElement[]).map((s) => {
        const bubble = s.shadowRoot!.querySelector('.md-step__bubble') as HTMLElement;
        const cs = getComputedStyle(bubble);
        const t = cs.transform;
        return {
          radius: parseFloat(cs.borderRadius),
          scale: t === 'none' ? 1 : parseFloat(t.match(/matrix\(([^)]+)\)/)![1].split(',')[0]),
        };
      }),
    );
    // FOUR has active=1: corner-full (≥ half the 32px bubble) on all four
    b.forEach((x) => expect(x.radius).toBeGreaterThanOrEqual(16));
    expect(b[1].scale).toBeGreaterThan(1.05); // active springs up
    [b[0], b[2], b[3]].forEach((x) => expect(x.scale).toBeCloseTo(1, 1));
  }, 60000);

  it('dot variant: pending dots are visible (outline role) and the active dot is a bigger circle', async () => {
    const page = await newE2EPage();
    await page.setViewport({ width: 900, height: 400 });
    await page.setContent(`
      <md-stepper id="sp" indicator="dot" active="1">
        <md-step label="A" completed></md-step><md-step label="B"></md-step><md-step label="C"></md-step>
      </md-stepper>`);
    await page.waitForChanges();
    await new Promise((r) => setTimeout(r, 600));
    const d = await page.evaluate(() =>
      (Array.from(document.querySelectorAll('#sp md-step')) as HTMLElement[]).map((s) => {
        const dot = s.shadowRoot!.querySelector('.md-step__dot') as HTMLElement;
        const r = dot.getBoundingClientRect();
        return { w: r.width, h: r.height, bg: getComputedStyle(dot).backgroundColor };
      }),
    );
    expect(d[2].bg).toBe('rgb(121, 116, 126)'); // pending → outline, not the 1.23:1 surface tint
    // active dot springs up but stays circular (same pattern as the number) —
    // just a bigger dot, never a pill
    expect(Math.abs(d[1].w - d[1].h)).toBeLessThanOrEqual(1);
    expect(d[1].w).toBeGreaterThan(d[0].w + 1); // bigger than a resting dot
    expect(Math.abs(d[0].w - d[0].h)).toBeLessThanOrEqual(1); // others stay round dots
  }, 60000);

  it('dot variant: the vertical rail is centred on the dots (no 11px drift)', async () => {
    const page = await newE2EPage();
    await page.setViewport({ width: 600, height: 900 });
    await page.setContent(`
      <md-stepper id="sp" orientation="vertical" indicator="dot" active="1">
        <md-step label="A" completed></md-step>
        <md-step label="B"><p>body</p></md-step>
        <md-step label="C"></md-step>
      </md-stepper>`);
    await page.waitForChanges();
    await new Promise((r) => setTimeout(r, 250));
    const xs = await page.evaluate(() => {
      const out: number[] = [];
      (Array.from(document.querySelectorAll('#sp md-step')) as HTMLElement[]).forEach((s) => {
        const sr = s.shadowRoot!;
        [sr.querySelector('.md-step__dot'), sr.querySelector('.md-step__connector--leading'), sr.querySelector('.md-step__connector--trailing')].forEach((el) => {
          if (!el) return;
          const r = (el as HTMLElement).getBoundingClientRect();
          if (r.width === 0 && r.height === 0) return; // skip the active step's hidden leading
          out.push(r.left + r.width / 2);
        });
      });
      return out;
    });
    xs.forEach((x) => expect(Math.abs(x - xs[0])).toBeLessThanOrEqual(1));
  }, 60000);

  it('hover disc is proportional per variant: 48px for the numbered bubble, and the dot disc does not overlap the connectors', async () => {
    const page = await newE2EPage();
    await page.setViewport({ width: 900, height: 400 });
    await page.setContent(`
      <md-stepper id="numbered" active="0"><md-step label="A"></md-step><md-step label="B"></md-step></md-stepper>
      <md-stepper id="dots" indicator="dot" active="1"><md-step label="A" completed></md-step><md-step label="B"></md-step><md-step label="C"></md-step></md-stepper>`);
    await page.waitForChanges();
    // numbered bubble keeps a full 48px hover/touch disc
    const numbered = await page.evaluate(() => {
      const step = document.querySelector('#numbered md-step') as HTMLElement;
      const r = (step.shadowRoot!.querySelector('.md-step__indicator') as HTMLElement).getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height) };
    });
    expect(numbered.w).toBeGreaterThanOrEqual(48);
    expect(numbered.h).toBeGreaterThanOrEqual(48);
    // dot disc stays small and its right edge does NOT reach the connector on
    // its right (the disc must not swallow the lines)
    const dot = await page.evaluate(() => {
      const steps = Array.from(document.querySelectorAll('#dots md-step')) as HTMLElement[];
      const disc = (steps[1].shadowRoot!.querySelector('.md-step__indicator') as HTMLElement).getBoundingClientRect();
      const line = (steps[1].shadowRoot!.querySelector('.md-step__connector--trailing') as HTMLElement).getBoundingClientRect();
      return { discW: Math.round(disc.width), gap: line.left - disc.right };
    });
    expect(dot.discW).toBeLessThan(36); // proportional to a 10px dot, not a 48px slab
    expect(dot.gap).toBeGreaterThan(0); // disc clears the connector — no intersection
  }, 60000);

  it('the connector never runs under the active indicator halo (h + v, dot + numbered)', async () => {
    const haloSpread = (cs: string) => parseFloat((cs.match(/0px 0px 0px (\d+(?:\.\d+)?)px/) || [])[1] || '0');
    // horizontal: line to the left of the active indicator clears its halo
    for (const ind of ['numbered', 'dot']) {
      const page = await newE2EPage();
      await page.setViewport({ width: 700, height: 300 });
      await page.setContent(`
        <md-stepper id="sp" indicator="${ind}" active="1" nav="false">
          <md-step label="A" completed></md-step><md-step label="B"></md-step><md-step label="C"></md-step>
        </md-stepper>`);
      await page.waitForChanges();
      await new Promise((r) => setTimeout(r, 600));
      const clr = await page.evaluate((sel: string) => {
        const steps = Array.from(document.querySelectorAll('#sp md-step')) as HTMLElement[];
        const el = steps[1].shadowRoot!.querySelector(sel) as HTMLElement;
        const r = el.getBoundingClientRect();
        const spread = parseFloat((getComputedStyle(el).boxShadow.match(/0px 0px 0px (\d+(?:\.\d+)?)px/) || [])[1] || '0');
        const line = steps[0].shadowRoot!.querySelector('.md-step__connector--trailing') as HTMLElement;
        return (r.left - spread) - line.getBoundingClientRect().right; // halo-left minus line-right
      }, ind === 'dot' ? '.md-step__dot' : '.md-step__bubble');
      expect(clr).toBeGreaterThan(1); // positive clearance, halo untouched
    }
    // vertical: the active step's trailing starts below the halo
    const page = await newE2EPage();
    await page.setViewport({ width: 500, height: 700 });
    await page.setContent(`
      <md-stepper id="sp" orientation="vertical" active="0" nav="false">
        <md-step label="One"></md-step><md-step label="Two"></md-step>
      </md-stepper>`);
    await page.waitForChanges();
    await new Promise((r) => setTimeout(r, 600));
    const v = await page.evaluate(() => {
      const active = document.querySelector('#sp md-step') as HTMLElement;
      const bubble = active.shadowRoot!.querySelector('.md-step__bubble') as HTMLElement;
      const spread = parseFloat((getComputedStyle(bubble).boxShadow.match(/0px 0px 0px (\d+(?:\.\d+)?)px/) || [])[1] || '0');
      const trailing = active.shadowRoot!.querySelector('.md-step__connector--trailing') as HTMLElement;
      return trailing.getBoundingClientRect().top - (bubble.getBoundingClientRect().bottom + spread);
    });
    expect(v).toBeGreaterThan(1); // trailing starts below the halo, not inside it
  }, 60000);

  it('steps enter with a staggered fade (increasing animation delays)', async () => {
    const page = await newE2EPage();
    await page.setContent(FOUR);
    await page.waitForChanges();
    const delays = await page.evaluate(() =>
      (Array.from(document.querySelectorAll('#sp md-step')) as HTMLElement[]).map((s) =>
        parseFloat(getComputedStyle(s).animationDelay),
      ),
    );
    expect(delays).toEqual([0, 0.04, 0.08, 0.12]);
  }, 60000);
});

describe('md-stepper · vertical panel motion', () => {
  const PANELS = `
    <md-stepper id="sp" orientation="vertical" mode="non-linear" active="0">
      <md-step label="One"><p style="height:80px">a</p></md-step>
      <md-step label="Two"><p style="height:80px">b</p></md-step>
    </md-stepper>`;
  const panelHeight = (page: E2EPage, i: number) =>
    page.evaluate((idx: number) => {
      const step = document.querySelectorAll('#sp md-step')[idx] as HTMLElement;
      return (step.shadowRoot!.querySelector('.md-step__content') as HTMLElement).getBoundingClientRect().height;
    }, i);

  it('the panel springs open over time and the previous one collapses', async () => {
    const page = await newE2EPage();
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
    await page.setContent(PANELS);
    await page.waitForChanges();
    await new Promise((r) => setTimeout(r, 700));
    const openBefore = await panelHeight(page, 0);
    expect(openBefore).toBeGreaterThan(80);
    expect(await panelHeight(page, 1)).toBeLessThanOrEqual(1); // collapsed, not display:none

    await page.evaluate(() => { (document.getElementById('sp') as any).active = 1; });
    await page.waitForChanges();
    await new Promise((r) => setTimeout(r, 100));
    const mid = await panelHeight(page, 1);
    expect(mid).toBeGreaterThan(0); // opening…
    await new Promise((r) => setTimeout(r, 800));
    const end = await panelHeight(page, 1);
    expect(end).toBeGreaterThan(mid - 1);
    expect(end).toBeGreaterThan(80); // …fully open
    expect(await panelHeight(page, 0)).toBeLessThanOrEqual(1); // old panel collapsed
  }, 60000);

  it('closed panels are hidden from interaction (visibility), open ones are live', async () => {
    const page = await newE2EPage();
    await page.setContent(PANELS);
    await page.waitForChanges();
    await new Promise((r) => setTimeout(r, 700));
    const vis = await page.evaluate(() =>
      (Array.from(document.querySelectorAll('#sp md-step')) as HTMLElement[]).map(
        (s) => getComputedStyle(s.shadowRoot!.querySelector('.md-step__content') as HTMLElement).visibility,
      ),
    );
    expect(vis).toEqual(['visible', 'hidden']);
  }, 60000);

  it('reduced motion: the panel toggles instantly', async () => {
    const page = await newE2EPage();
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.setContent(PANELS);
    await page.waitForChanges();
    await page.evaluate(() => { (document.getElementById('sp') as any).active = 1; });
    await page.waitForChanges();
    // Under reduced motion the panel snaps open (~0.01ms) — poll for it so a
    // slow render/paint under load doesn't read the pre-open frame. The point is
    // it reaches full height near-instantly (well before the 500ms spring would).
    let h1 = 0;
    for (let i = 0; i < 15 && h1 <= 80; i++) {
      await new Promise((r) => setTimeout(r, 20));
      h1 = await panelHeight(page, 1);
    }
    expect(h1).toBeGreaterThan(80);
    expect(await panelHeight(page, 0)).toBeLessThanOrEqual(1);
  }, 60000);
});

describe('md-stepper · RTL', () => {
  it('vertical rail mirrors to the right side, still centred on the bubbles', async () => {
    const page = await newE2EPage();
    await page.setViewport({ width: 600, height: 900 });
    await page.setContent(`
      <md-stepper id="sp" orientation="vertical" active="1">
        <md-step label="حساب" completed></md-step>
        <md-step label="شحن"><p>body</p></md-step>
        <md-step label="دفع"></md-step>
      </md-stepper>`);
    await page.evaluate(() => document.documentElement.setAttribute('dir', 'rtl'));
    await page.waitForChanges();
    await new Promise((r) => setTimeout(r, 250));
    const d = await page.evaluate(() => {
      const sp = document.getElementById('sp')!;
      const spRect = sp.getBoundingClientRect();
      const step = sp.querySelectorAll('md-step')[0] as HTMLElement;
      const b = (step.shadowRoot!.querySelector('.md-step__bubble') as HTMLElement).getBoundingClientRect();
      const c = (step.shadowRoot!.querySelector('.md-step__connector--trailing') as HTMLElement).getBoundingClientRect();
      return {
        mid: spRect.left + spRect.width / 2,
        bubbleX: b.left + b.width / 2,
        railX: c.left + c.width / 2,
      };
    });
    expect(d.bubbleX).toBeGreaterThan(d.mid); // mirrored to the right half
    expect(Math.abs(d.railX - d.bubbleX)).toBeLessThanOrEqual(1); // rail follows
  }, 60000);

  it('horizontal connector fills from the right in RTL', async () => {
    const page = await newE2EPage();
    await page.setViewport({ width: 900, height: 400 });
    await page.setContent(`
      <md-stepper id="sp" active="1">
        <md-step label="أ" completed></md-step><md-step label="ب"></md-step>
      </md-stepper>`);
    await page.evaluate(() => document.documentElement.setAttribute('dir', 'rtl'));
    await page.waitForChanges();
    const o = await page.evaluate(() => {
      const conn = (document.querySelectorAll('#sp md-step')[0] as HTMLElement).shadowRoot!.querySelector('.md-step__connector--trailing') as HTMLElement;
      return {
        originX: parseFloat(getComputedStyle(conn, '::after').transformOrigin),
        width: conn.getBoundingClientRect().width,
      };
    });
    expect(Math.abs(o.originX - o.width)).toBeLessThanOrEqual(1); // right edge, not left
  }, 60000);
});

describe('md-stepper · compact responsiveness', () => {
  const C = `
    <md-stepper id="sp" active="1">
      <md-step label="Account details"></md-step>
      <md-step label="Shipping address" description="Address & method" active></md-step>
      <md-step label="Payment method"></md-step>
      <md-step label="Review and confirm"></md-step>
    </md-stepper>`;
  async function measure(page: E2EPage) {
    return page.evaluate(() => {
      const steps = Array.from(document.querySelectorAll('#sp md-step')) as HTMLElement[];
      const w = (i: number, sel: string) => {
        const el = steps[i].shadowRoot!.querySelector(sel) as HTMLElement | null;
        return el ? el.getBoundingClientRect().width : 0;
      };
      return {
        vw: window.innerWidth,
        docScrollW: document.documentElement.scrollWidth,
        label0: w(0, '.md-step__label'),
        desc1: w(1, '.md-step__description'),
        aria0: steps[0].shadowRoot!.querySelector('.md-step__inner')!.getAttribute('aria-label'),
      };
    });
  }
  it('compact (360px): labels stay, descriptions hide, no overflow, a11y intact', async () => {
    const page = await newE2EPage();
    await page.setViewport({ width: 360, height: 720 });
    await page.setContent(C);
    await page.waitForChanges();
    const r = await measure(page);
    expect(r.label0).toBeGreaterThan(0);
    expect(r.desc1).toBe(0);
    expect(r.docScrollW).toBeLessThanOrEqual(r.vw + 1);
    expect(r.aria0).toMatch(/^Step 1 of 4: Account details/);
  }, 60000);
  it('roomy (1200px): description is visible', async () => {
    const page = await newE2EPage();
    await page.setViewport({ width: 1200, height: 720 });
    await page.setContent(C);
    await page.waitForChanges();
    expect((await measure(page)).desc1).toBeGreaterThan(0);
  }, 60000);
});
