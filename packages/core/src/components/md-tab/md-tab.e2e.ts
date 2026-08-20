import { newE2EPage } from '@stencil/core/testing';

describe('md-tab e2e', () => {
  it('renders', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-tab label="Tab 1"></md-tab>');
    const el = await page.find('md-tab');
    expect(el).toBeTruthy();
  });
});

describe('md-tab icon density', () => {
  /**
   * The default icon span carries BOTH `.md-tab__icon` (density-aware) and
   * `.material-symbols-outlined` (the shadow-root font declaration). They have
   * equal single-class specificity, so whichever comes LAST in the stylesheet
   * wins the `font-size` — see md-list-item's drag-handle for the same trap.
   *
   * Guard: the built-in icon must taper with density exactly like a consumer's
   * slotted icon does, so `icon="home"` and a slotted <svg> never disagree.
   */
  const measure = async (scale: number) => {
    const page = await newE2EPage();
    await page.setContent(`
      <md-tab id="builtin" icon="home" label="Built-in"></md-tab>
      <md-tab id="slotted" label="Slotted">
        <span slot="icon" class="material-symbols-outlined">home</span>
      </md-tab>
    `);
    await page.evaluate((s: number) => {
      for (const id of ['builtin', 'slotted']) {
        document.getElementById(id)!.style.setProperty('--md-sys-density-scale', String(s));
      }
    }, scale);
    await page.waitForChanges();

    return page.evaluate(() => {
      const inner = document
        .getElementById('builtin')!
        .shadowRoot!.querySelector('.md-tab__icon') as HTMLElement;
      const outer = document.querySelector('#slotted > [slot="icon"]') as HTMLElement;
      const cs = getComputedStyle(inner);
      return {
        builtin: cs.fontSize,
        slotted: getComputedStyle(outer).fontSize,
        family: cs.fontFamily,
        liga: cs.fontFeatureSettings,
      };
    });
  };

  it('MEASURE: built-in vs slotted icon across density rungs', async () => {
    for (const scale of [0, -2, -4]) {
      const m = await measure(scale);
       
      console.log(`density ${scale}:`, JSON.stringify(m));
    }
  });

  it.each([
    [0, '24px'],
    [-2, '22px'],
    [-4, '20px'],
  ])('built-in icon tapers with density %i -> %s', async (scale, expected) => {
    const m = await measure(scale as number);
    expect(m.builtin).toBe(expected);
    expect(m.builtin).toBe(m.slotted);
  });

  it('declares the ligature feature so glyph names are not rendered as words', async () => {
    const m = await measure(0);
    expect(m.liga).toContain('liga');
    expect(m.family).toContain('Material Symbols Outlined');
  });
});
