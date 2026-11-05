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
 * All variants share the same outer-edge content inset. Outlined subtracts
 * its border from the padding so switching variants keeps the same width.
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

  it('outlined includes its border in the shared inset at every density', async () => {
    const page = await newE2EPage();
    await page.setContent(
      DENSITIES.map(
        // Supply the outline color normally provided by the theme token sheet.
        d => `<div style="--md-button-outline-color:#67616f">
          <md-button id="f${d}" variant="filled" density="${d}">Add item</md-button>
          <md-button id="o${d}" variant="outlined" density="${d}">Add item</md-button>
          <md-button id="w${d}" variant="outlined" density="${d}" style="--md-button-outline-width:3px">Add item</md-button>
        </div>`,
      ).join(''),
    );
    await page.waitForChanges();

    const measurements = await page.evaluate(
      async (densities: number[]) => {
        await document.fonts.ready;
        return densities.map(d => {
          const filled = document.getElementById(`f${d}`)!;
          const outlined = ['o', 'w'].map(prefix => {
            const element = document.getElementById(`${prefix}${d}`)!;
            const style = getComputedStyle(element);
            return {
              left: parseFloat(style.paddingLeft) + parseFloat(style.borderLeftWidth),
              right: parseFloat(style.paddingRight) + parseFloat(style.borderRightWidth),
              width: element.getBoundingClientRect().width,
              border: parseFloat(style.borderLeftWidth),
              expectedBorder: prefix === 'w' ? 3 : 1,
            };
          });
          return { density: d, filledWidth: filled.getBoundingClientRect().width, outlined };
        });
      },
      DENSITIES,
    );

    for (const measurement of measurements) for (const outlined of measurement.outlined) {
      expect(outlined.border).toBe(outlined.expectedBorder);
      expect(outlined.left).toBe(EXPECTED[measurement.density]);
      expect(outlined.right).toBe(EXPECTED[measurement.density]);
      expect(outlined.width).toBeCloseTo(measurement.filledWidth, 5);
    }
    // The outer inset shrinks by 25%, including the outline on both edges.
    expect(measurements[4].outlined[0].left / measurements[0].outlined[0].left).toBe(0.75);
  }, 60000);
});
