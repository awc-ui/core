import { newE2EPage } from '@stencil/core/testing';

/*
 * The tab's reduced-motion block removes every state transition, but its
 * `.md-navigation-rail-tab__label` / icon-wrapper selectors lose to the more
 * specific labels-selected and horizontal rules. With `label-visibility="selected"`
 * the label then still grows (max-block-size + margin) and pushes the icon on
 * every activation, and the horizontal pill still fades.
 */
describe('md-navigation-rail-tab under prefers-reduced-motion', () => {
  const durations = (selector: string, index: number) => {
    const tab = document.querySelectorAll('md-navigation-rail-tab')[index] as HTMLElement;
    const node = tab.shadowRoot!.querySelector(selector) as HTMLElement;
    return getComputedStyle(node).transitionDuration.split(',').map((d) => d.trim());
  };

  it('does not animate the label of a labels-selected destination', async () => {
    const page = await newE2EPage();
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.setContent(`
      <md-navigation-rail label="Primary" label-visibility="selected" active-index="0">
        <md-navigation-rail-tab icon="home" label="Home"></md-navigation-rail-tab>
        <md-navigation-rail-tab icon="search" label="Search"></md-navigation-rail-tab>
      </md-navigation-rail>`);
    await page.waitForChanges();
    for (const index of [0, 1]) {
      expect(new Set(await page.evaluate(durations, '[part="label"]', index))).toEqual(new Set(['0s']));
    }
    const running = await page.evaluate(async () => {
      const tab = document.querySelectorAll('md-navigation-rail-tab')[1] as HTMLElement;
      tab.click();
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const label = tab.shadowRoot!.querySelector('[part="label"]') as HTMLElement;
      return label.getAnimations().map((a: any) => a.transitionProperty || a.animationName);
    });
    expect(running).toEqual([]);
  });

  it('does not fade the horizontal pill', async () => {
    const page = await newE2EPage();
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.setContent(`
      <md-navigation-rail label="Primary" orientation="horizontal" active-index="0" style="inline-size:480px">
        <md-navigation-rail-tab icon="home" label="Home"></md-navigation-rail-tab>
        <md-navigation-rail-tab icon="search" label="Search"></md-navigation-rail-tab>
      </md-navigation-rail>`);
    await page.waitForChanges();
    expect(new Set(await page.evaluate(durations, '[part="icon-wrapper"]', 1))).toEqual(new Set(['0s']));
  });
});
