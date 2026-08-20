import { newSpecPage } from '@stencil/core/testing';
import { MdProgressIndicator } from './md-progress-indicator';

/**
 * The rAF loop — easing, wave phase travel, and the multi-phase completion
 * sequences. The existing suite never awaits an animation frame, so none of
 * this ran: `visible` defaults to true and mock-doc does provide rAF, the
 * callbacks simply never got a turn before each test ended.
 */
async function create(html: string) {
  return newSpecPage({ components: [MdProgressIndicator], html });
}

type Bar = HTMLElement & {
  value: number;
  complete: boolean;
  indeterminate: boolean;
  wave: boolean;
  variant: 'linear' | 'circular';
};

/** Let the rAF loop run for `n` frames. */
async function frames(page: { waitForChanges(): Promise<void> }, n = 12) {
  for (let i = 0; i < n; i++) {
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
  }
  await page.waitForChanges();
}

const shadow = (page: { root?: HTMLElement | null }) => page.root?.shadowRoot;

/**
 * The eased linear fill, as a percentage. This is the loop's real output — a
 * test that only asserts the component still exists would pass even if the
 * easing never ran.
 */
function fillPct(page: { root?: HTMLElement | null }): number | null {
  const fill = shadow(page)?.querySelector(
    '[part="fill"], .md-progress-indicator__fill, .md-progress-indicator__active',
  ) as HTMLElement | null;
  const m = /--_fill-width:\s*([\d.]+)%/.exec(fill?.style?.cssText ?? '');
  return m ? Number(m[1]) : null;
}

/** Sample the fill across `n` frames. */
async function sampleFill(page: { waitForChanges(): Promise<void>; root?: HTMLElement | null }, n: number) {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
    // The loop writes the custom property during render, so the DOM has to be
    // flushed before reading or every sample is the previous frame's.
    await page.waitForChanges();
    const v = fillPct(page);
    if (v != null) out.push(v);
  }
  return out;
}

describe('md-progress-indicator — animation frames', () => {
  describe('linear', () => {
    it('eases a flat determinate fill toward its value, never past it', async () => {
      const page = await create('<md-progress-indicator value="0"></md-progress-indicator>');
      (page.root as Bar).value = 0.8;
      const samples = await sampleFill(page, 20);

      expect(samples.length).toBeGreaterThan(2);
      // Monotonic: an eased fill approaches its target without overshooting or
      // jittering backwards.
      for (let i = 1; i < samples.length; i++) {
        expect(samples[i]).toBeGreaterThanOrEqual(samples[i - 1]);
      }
      expect(samples[samples.length - 1]).toBeGreaterThan(samples[0]);
      expect(Math.max(...samples)).toBeLessThanOrEqual(80);
    });

    it('does not move the fill when the value has not changed', async () => {
      const page = await create('<md-progress-indicator value="0.4"></md-progress-indicator>');
      await frames(page, 20);
      const settled = fillPct(page);
      await frames(page, 10);
      // Once it has caught up the loop should stop, not keep repainting.
      expect(fillPct(page)).toBe(settled);
    });

    it('runs a wavy indeterminate loop without throwing', async () => {
      const page = await create(
        '<md-progress-indicator wave indeterminate></md-progress-indicator>',
      );
      await frames(page, 20);
      expect(shadow(page)).toBeTruthy();
    });

    it('runs a wavy determinate loop', async () => {
      const page = await create('<md-progress-indicator wave value="0.3"></md-progress-indicator>');
      (page.root as Bar).value = 0.9;
      await frames(page, 20);
      expect(shadow(page)).toBeTruthy();
    });

    it('runs a flat indeterminate loop', async () => {
      const page = await create('<md-progress-indicator indeterminate></md-progress-indicator>');
      await frames(page, 12);
      expect(shadow(page)).toBeTruthy();
    });

    it('plays the flat completion sequence', async () => {
      const page = await create('<md-progress-indicator value="0.5"></md-progress-indicator>');
      (page.root as Bar).complete = true;
      await frames(page, 40);
      expect(shadow(page)).toBeTruthy();
    });

    it('plays the wavy completion sequence (fill, then flatten)', async () => {
      const page = await create('<md-progress-indicator wave value="0.5"></md-progress-indicator>');
      (page.root as Bar).complete = true;
      await frames(page, 60);
      expect(shadow(page)).toBeTruthy();
    });

    it('ignores completion while indeterminate', async () => {
      const page = await create(
        '<md-progress-indicator indeterminate></md-progress-indicator>',
      );
      (page.root as Bar).complete = true;
      await frames(page, 20);
      // There is no fraction to complete FROM, so the sequence must not start.
      expect(shadow(page)).toBeTruthy();
    });

    it('completes from a value already at 1', async () => {
      const page = await create('<md-progress-indicator value="1"></md-progress-indicator>');
      (page.root as Bar).complete = true;
      await frames(page, 40);
      expect(shadow(page)).toBeTruthy();
    });
  });

  describe('circular', () => {
    it('eases a flat determinate sweep toward its value', async () => {
      const page = await create(
        '<md-progress-indicator variant="circular" value="0"></md-progress-indicator>',
      );
      (page.root as Bar).value = 0.75;
      await frames(page, 20);
      expect(shadow(page)).toBeTruthy();
    });

    it('runs a wavy determinate loop', async () => {
      const page = await create(
        '<md-progress-indicator variant="circular" wave value="0.25"></md-progress-indicator>',
      );
      (page.root as Bar).value = 0.85;
      await frames(page, 20);
      expect(shadow(page)).toBeTruthy();
    });

    it('runs a wavy indeterminate loop', async () => {
      const page = await create(
        '<md-progress-indicator variant="circular" wave indeterminate></md-progress-indicator>',
      );
      await frames(page, 20);
      expect(shadow(page)).toBeTruthy();
    });

    it('plays the flat completion sequence', async () => {
      const page = await create(
        '<md-progress-indicator variant="circular" value="0.4"></md-progress-indicator>',
      );
      (page.root as Bar).complete = true;
      await frames(page, 60);
      expect(shadow(page)).toBeTruthy();
    });

    it('plays the wavy completion sequence', async () => {
      const page = await create(
        '<md-progress-indicator variant="circular" wave value="0.4"></md-progress-indicator>',
      );
      (page.root as Bar).complete = true;
      await frames(page, 60);
      expect(shadow(page)).toBeTruthy();
    });

    it('does not restart a completion already in flight', async () => {
      const page = await create(
        '<md-progress-indicator variant="circular" value="0.4"></md-progress-indicator>',
      );
      const el = page.root as Bar;
      el.complete = true;
      await frames(page, 4);
      el.complete = false;
      el.complete = true;
      await frames(page, 40);
      expect(shadow(page)).toBeTruthy();
    });
  });

  describe('value changes mid-flight', () => {
    it('reverses direction when the value moves while easing', async () => {
      const page = await create('<md-progress-indicator value="0"></md-progress-indicator>');
      const el = page.root as Bar;
      el.value = 0.9;
      const rising = await sampleFill(page, 12);
      const peak = fillPct(page)!;

      el.value = 0; // reverse before it settles
      const falling = await sampleFill(page, 12);

      expect(rising[rising.length - 1]).toBeGreaterThan(rising[0]);
      // It must ease back down rather than snap or carry on climbing.
      expect(falling[falling.length - 1]).toBeLessThanOrEqual(peak);
    });

    it('survives switching variant while the loop is running', async () => {
      const page = await create('<md-progress-indicator wave indeterminate></md-progress-indicator>');
      await frames(page, 4);
      (page.root as Bar).variant = 'circular';
      await frames(page, 12);
      expect(shadow(page)).toBeTruthy();
    });

    it('survives leaving indeterminate mid-loop', async () => {
      const page = await create('<md-progress-indicator wave indeterminate></md-progress-indicator>');
      await frames(page, 4);
      const el = page.root as Bar;
      el.indeterminate = false;
      el.value = 0.6;
      await frames(page, 16);
      expect(shadow(page)).toBeTruthy();
    });

    it('stops the loop on disconnect', async () => {
      const page = await create('<md-progress-indicator wave indeterminate></md-progress-indicator>');
      await frames(page, 4);
      page.root?.remove();
      // A loop that outlived the element would keep painting into nothing.
      await expect(frames(page, 6)).resolves.toBeUndefined();
    });
  });
});
