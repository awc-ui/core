import { newE2EPage, E2EPage } from '@stencil/core/testing';

interface MotionSample {
  expanded: boolean;
  hostHeight: number;
  headerHeight: number;
  panelHeight: number;
  hostRadii: number[];
  headerRadii: number[];
  innerTransform: string;
  boxShadow: string;
  opacity: number;
}
interface MotionClock {
  target: string;
  property: string;
  duration: number;
  easing: string;
}
interface MotionHarness {
  read(): MotionSample;
  set(expanded: boolean): Promise<MotionClock[]>;
  seek(fraction: number): MotionSample;
  finish(): Promise<MotionSample>;
  activeTransitions(): number;
}
declare global {
  interface Window { accordionMotion: MotionHarness; }
}

const measuredShape = '--md-accordion-item-container-shape:12px;--md-accordion-item-container-shape-expanded:32px;--md-accordion-item-content-padding:0px;';
const controlledMotion = '--md-accordion-item-expand-duration:4000ms;--md-accordion-item-collapse-duration:3000ms;--md-sys-motion-easing-emphasized:linear;';

async function fixture(page: E2EPage, options: { parent?: string; style?: string; reduced?: boolean } = {}) {
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: options.reduced ? 'reduce' : 'no-preference' }]);
  await page.setContent(`<md-accordion ${options.parent || ''} style="width:400px">
    <md-accordion-item id="motion-item" headline="Account details" icon="folder"
      style="${measuredShape}${options.style || ''}">
      <div style="height:240px">A fixed-height body isolates motion from font loading.</div>
    </md-accordion-item>
  </md-accordion>`);
  await page.waitForChanges();
  await page.evaluate(async () => {
    const item = document.querySelector('#motion-item') as HTMLMdAccordionItemElement;
    const root = item.shadowRoot!;
    const header = root.querySelector('[part="header"]') as HTMLElement;
    const panel = root.querySelector('[part="panel"]') as HTMLElement;
    const inner = root.querySelector('.md-accordion-item__content-inner') as HTMLElement;
    const nodes = [item, ...Array.from(root.querySelectorAll('*'))];
    const frame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    const ownAnimations = () => [...new Set(nodes.flatMap(node => node.getAnimations()))];
    let animations: Animation[] = [];
    const radii = (element: Element) => {
      const style = getComputedStyle(element);
      return [style.borderTopLeftRadius, style.borderTopRightRadius, style.borderBottomRightRadius, style.borderBottomLeftRadius].map(value => parseFloat(value));
    };
    const read = (): MotionSample => ({
      expanded: item.expanded,
      hostHeight: item.getBoundingClientRect().height,
      headerHeight: header.getBoundingClientRect().height,
      panelHeight: panel.getBoundingClientRect().height,
      hostRadii: radii(item), headerRadii: radii(header),
      innerTransform: getComputedStyle(inner).transform,
      boxShadow: getComputedStyle(item).boxShadow,
      opacity: Number(getComputedStyle(panel).opacity),
    });
    // Pause real CSS transitions, then seek a shared elapsed time. There are
    // no wall-clock sleeps or screenshots, and short/fast machines cannot
    // accidentally sample after the controlled 4s/3s transitions have ended.
    window.accordionMotion = {
      read,
      async set(expanded) {
        read(); // Establish the old layout before changing the state.
        item.expanded = expanded;
        await frame(); await frame();
        read(); // Flush style so the browser has created its CSSTransitions.
        animations = ownAnimations();
        animations.forEach(animation => animation.pause());
        return animations.map(animation => {
          const effect = animation.effect as KeyframeEffect;
          const target = effect.target as Element;
          const timing = effect.getTiming();
          return {
            target: target === item ? 'host' : target.getAttribute('part') || target.className,
            property: (animation as CSSTransition).transitionProperty || '',
            duration: Number(timing.duration),
            easing: (timing.easing !== 'linear' ? timing.easing : effect.getKeyframes()[0]?.easing || timing.easing) ?? 'linear',
          };
        });
      },
      seek(fraction) {
        const height = animations.find(animation => (animation as CSSTransition).transitionProperty === 'grid-template-rows');
        if (!height) throw new Error('Expected a real grid-template-rows transition.');
        const elapsed = Number(height.effect!.getTiming().duration) * fraction;
        for (const animation of animations) {
          animation.currentTime = Math.min(elapsed, Number(animation.effect!.getComputedTiming().endTime));
        }
        return read();
      },
      async finish() {
        animations.forEach(animation => animation.finish());
        await frame();
        return read();
      },
      activeTransitions: () => ownAnimations().filter(animation => animation.playState !== 'finished').length,
    };
    await frame();
  });
}

const read = (page: E2EPage) => page.evaluate(() => window.accordionMotion.read());
const change = (page: E2EPage, expanded: boolean) => page.evaluate(value => window.accordionMotion.set(value), expanded);
const seek = (page: E2EPage, fraction: number) => page.evaluate(value => window.accordionMotion.seek(value), fraction);
const finish = (page: E2EPage) => page.evaluate(() => window.accordionMotion.finish());
// Defaults are read from computed transition lists, which remain available
// even if a heavily loaded worker misses the short default animation itself.
const configuredClocks = (page: E2EPage) => page.evaluate(() => {
  const item = document.querySelector('#motion-item')!;
  return [item, ...Array.from(item.shadowRoot!.querySelectorAll('*'))].flatMap(target => {
    const style = getComputedStyle(target);
    const properties = style.transitionProperty.split(',').map(value => value.trim());
    const durations = style.transitionDuration.split(',').map(value => value.trim());
    const easings = style.transitionTimingFunction.split(/,(?![^()]*\))/).map(value => value.trim());
    return properties.map((property, index) => {
      const duration = durations[index % durations.length];
      return {
        target: target === item ? 'host' : target.getAttribute('part') || target.className,
        property, duration: parseFloat(duration) * (duration.endsWith('ms') ? 1 : 1000),
        easing: easings[index % easings.length],
      };
    });
  });
});
const heightClock = (clocks: MotionClock[]) => clocks.find(clock => clock.target === 'panel' && clock.property === 'grid-template-rows')!;
const cornerClocks = (clocks: MotionClock[]) => clocks.filter(clock => ['host', 'header'].includes(clock.target) && /radius$/.test(clock.property));

function expectCornersMatch(sample: MotionSample) {
  expect(sample.headerRadii[0]).toBeCloseTo(sample.hostRadii[0], 1);
  expect(sample.headerRadii[1]).toBeCloseTo(sample.hostRadii[1], 1);
  expect(sample.innerTransform).toBe('none');
}
function expectFinal(sample: MotionSample, expanded: boolean) {
  expect(sample.expanded).toBe(expanded);
  expect(sample.panelHeight).toBeCloseTo(expanded ? 240 : 0, 1);
  expect(sample.hostHeight).toBeCloseTo(sample.headerHeight + sample.panelHeight, 1);
  expect(sample.hostRadii).toEqual(Array(4).fill(expanded ? 32 : 12));
  expect(sample.headerRadii).toEqual(expanded ? [32, 32, 0, 0] : [12, 12, 12, 12]);
  expectCornersMatch(sample);
}

describe('md-accordion-item coordinated browser motion', () => {
  it('uses the same default clock for height and corners, with capped non-overshooting color/opacity effects', async () => {
    const page = await newE2EPage();
    await fixture(page, { style: '--md-sys-motion-spring-effects-default-duration:900ms;--md-sys-motion-spring-effects-default-easing:linear;' });
    for (const expanded of [true, false]) {
      await change(page, expanded);
      const clocks = await configuredClocks(page), height = heightClock(clocks);
      expect(height).toBeDefined();
      expect(height.duration).toBe(expanded ? 350 : 250);
      expect(height.easing).toBe('cubic-bezier(0.2, 0, 0, 1)');
      expect(cornerClocks(clocks).length).toBeGreaterThanOrEqual(2);
      for (const clock of cornerClocks(clocks)) {
        expect(clock.duration).toBe(height.duration);
        expect(clock.easing).toBe(height.easing);
      }
      const effects = clocks.filter(clock => /color|opacity/.test(clock.property));
      expect(effects.length).toBeGreaterThan(0);
      for (const effect of effects) {
        expect(effect.duration).toBeLessThanOrEqual(height.duration);
        expect(effect.easing).toBe('linear');
      }
      expectFinal(await finish(page), expanded);
    }
  });

  it('matches actual height and corner progress throughout opening and closing with duration overrides', async () => {
    const page = await newE2EPage();
    await fixture(page, { style: controlledMotion });
    expectFinal(await read(page), false);
    for (const expanded of [true, false]) {
      const clocks = await change(page, expanded);
      expect(heightClock(clocks).duration).toBe(expanded ? 4000 : 3000);
      for (const fraction of [0.1, 0.4, 0.7]) {
        const sample = await seek(page, fraction), progress = expanded ? fraction : 1 - fraction;
        expect(sample.panelHeight / 240).toBeCloseTo(progress, 2);
        expect((sample.hostRadii[0] - 12) / 20).toBeCloseTo(progress, 2);
        expect((12 - sample.headerRadii[2]) / 12).toBeCloseTo(progress, 2);
        expectCornersMatch(sample);
      }
      expectFinal(await finish(page), expanded);
    }
  });

  it('reverses from the current visual geometry without jumping or desynchronizing the header corners', async () => {
    const page = await newE2EPage();
    await fixture(page, { style: controlledMotion });
    await change(page, true);
    const opening = await seek(page, 0.4);
    await change(page, false);
    const reverseStart = await seek(page, 0);
    expect(reverseStart.panelHeight).toBeCloseTo(opening.panelHeight, 1);
    expect(reverseStart.hostRadii[0]).toBeCloseTo(opening.hostRadii[0], 1);
    const closing = await seek(page, 0.5);
    expect(closing.panelHeight).toBeLessThan(opening.panelHeight);
    expectCornersMatch(closing);
    await change(page, true);
    const reopenStart = await seek(page, 0);
    expect(reopenStart.panelHeight).toBeCloseTo(closing.panelHeight, 1);
    expect(reopenStart.hostRadii[0]).toBeCloseTo(closing.hostRadii[0], 1);
    expectCornersMatch(await seek(page, 0.5));
    expectFinal(await finish(page), true);
    await change(page, false);
    expectFinal(await finish(page), false);
  });

  it('honors the disabled shape-morph token on both host and header at intermediate and final states', async () => {
    const page = await newE2EPage();
    await fixture(page, { style: `${controlledMotion}--md-sys-shape-morph-enabled:0;` });
    for (const expanded of [true, false]) {
      await change(page, expanded);
      const samples = [await seek(page, 0.5), await finish(page)];
      for (const sample of samples) {
        expect(sample.hostRadii).toEqual([12, 12, 12, 12]);
        expectCornersMatch(sample);
      }
      expect(samples[1].panelHeight).toBeCloseTo(expanded ? 240 : 0, 1);
    }
  });

  it('keeps outlined interiors square and shadow-free during the complete transition', async () => {
    const page = await newE2EPage();
    await fixture(page, { parent: 'variant="outlined" elevation="3"', style: controlledMotion });
    for (const expanded of [true, false]) {
      await change(page, expanded);
      for (const sample of [await seek(page, 0.25), await seek(page, 0.75), await finish(page)]) {
        expect(sample.hostRadii).toEqual([0, 0, 0, 0]);
        expect(sample.headerRadii).toEqual([0, 0, 0, 0]);
        expect(sample.boxShadow).toBe('none');
        expect(sample.innerTransform).toBe('none');
      }
    }
  });

  it.each(['reduced-motion', 'none-preset'])('snaps to final geometry with no internal transitions for %s', async mode => {
    const page = await newE2EPage();
    await fixture(page, { reduced: mode === 'reduced-motion', parent: mode === 'none-preset' ? 'transition="none" reorderable' : 'reorderable', style: controlledMotion });
    for (const expanded of [true, false]) {
      const clocks = await change(page, expanded);
      expect(clocks).toEqual([]);
      expectFinal(await read(page), expanded);
      const durations = await page.evaluate(() => {
        const item = document.querySelector('#motion-item')!;
        return [item, ...Array.from(item.shadowRoot!.querySelectorAll('*'))].map(node => getComputedStyle(node).transitionDuration);
      });
      expect(durations.every(value => value.split(',').every(duration => parseFloat(duration) === 0))).toBe(true);
    }
  });

  it.each(['standard', 'fade', 'collapse'])('retains the %s preset and public duration overrides', async preset => {
    const page = await newE2EPage();
    await fixture(page, { parent: `transition="${preset}"`, style: controlledMotion });
    for (const expanded of [true, false]) {
      const clocks = await change(page, expanded), height = heightClock(clocks);
      expect(height.duration).toBe(expanded ? 4000 : 3000);
      for (const clock of cornerClocks(clocks)) {
        expect(clock.duration).toBe(height.duration);
        expect(clock.easing).toBe(height.easing);
      }
      const middle = await seek(page, 0.4);
      expectCornersMatch(middle);
      if (preset === 'collapse') expect(middle.opacity).toBe(1);
      expectFinal(await finish(page), expanded);
    }
  });
});
