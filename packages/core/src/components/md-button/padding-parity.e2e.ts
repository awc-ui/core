import { newE2EPage } from '@stencil/core/testing';

/**
 * Buttons in a strip must share one horizontal padding, at every density.
 *
 * The container is invisible on a text button at rest, but its hover/press
 * state layer paints the padding box — so a text button beside a tonal one in
 * a toggle strip showed a cramped pill hugging its label (4px by rung -2)
 * next to a roomy one (14px), and the mismatch widened with density. It also
 * meant a button changed width if its variant changed to signal selection.
 *
 * Filled, tonal, elevated and text now all take the base size padding.
 * Outlined deliberately keeps a wider inset of its own (its border reads as
 * part of the shape), but must still decay at the same 25% rate.
 */
const SHARED = ['filled', 'tonal', 'elevated', 'text'];
const DENSITIES = [0, -1, -2, -3, -4];
/** Base `sm` rule: max(8px, 16px + density * 1px). */
const EXPECTED: Record<number, number> = { 0: 16, [-1]: 15, [-2]: 14, [-3]: 13, [-4]: 12 };

describe('md-button · padding parity across variants and density', () => {
  it('every container variant shares the base padding at every density', async () => {
    const page = await newE2EPage();
    await page.setContent(
      DENSITIES.map(
        d =>
          `<div>${SHARED.map(
            v => `<md-button id="b${d}${v}" variant="${v}" density="${d}">Add item</md-button>`,
          ).join('')}</div>`,
      ).join(''),
    );
    await page.waitForChanges();
    await new Promise(r => setTimeout(r, 200));

    const measured = await page.evaluate(
      (densities: number[], variants: string[]) => {
        const out: Record<string, number> = {};
        for (const d of densities) {
          for (const v of variants) {
            const el = document.getElementById(`b${d}${v}`)!;
            out[`${d}/${v}`] = parseFloat(getComputedStyle(el).paddingLeft);
          }
        }
        return out;
      },
      DENSITIES,
      SHARED,
    );

    const wrong = Object.entries(measured).filter(
      ([key, px]) => px !== EXPECTED[Number(key.split('/')[0])],
    );
    expect(wrong).toEqual([]);

    // Left and right must stay symmetric too.
    const asymmetric = await page.evaluate(
      (densities: number[], variants: string[]) => {
        const bad: string[] = [];
        for (const d of densities) {
          for (const v of variants) {
            const cs = getComputedStyle(document.getElementById(`b${d}${v}`)!);
            if (cs.paddingLeft !== cs.paddingRight) bad.push(`${d}/${v}`);
          }
        }
        return bad;
      },
      DENSITIES,
      SHARED,
    );
    expect(asymmetric).toEqual([]);
  }, 60000);

  it('outlined keeps its own inset but decays at the same 25% rate', async () => {
    const page = await newE2EPage();
    await page.setContent(
      DENSITIES.map(
        d => `<md-button id="o${d}" variant="outlined" density="${d}">Add item</md-button>`,
      ).join(''),
    );
    await page.waitForChanges();

    const pads = await page.evaluate(
      (densities: number[]) =>
        densities.map(d => parseFloat(getComputedStyle(document.getElementById(`o${d}`)!).paddingLeft)),
      DENSITIES,
    );

    // 25% total shrink across the four rungs, matching the base rules —
    // previously outlined lost 70% and ended up NARROWER than filled.
    expect(Math.round((pads[4] / pads[0]) * 100)).toBe(75);
    // And it must stay the wider variant at every rung (no inversion).
    expect(pads[4]).toBeGreaterThan(EXPECTED[-4]);
  }, 60000);
});
