import { newE2EPage } from '@stencil/core/testing';

describe('md-navigation-rail e2e', () => {
  it('renders', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <md-navigation-rail label="Primary">
        <md-navigation-rail-tab icon="home" label="Home"></md-navigation-rail-tab>
        <md-navigation-rail-tab icon="search" label="Search"></md-navigation-rail-tab>
      </md-navigation-rail>
    `);
    const rail = await page.find('md-navigation-rail');
    expect(rail).toBeTruthy();
    expect(rail.getAttribute('role')).toBe('navigation');
  });

  it('has role=navigation and the configured aria-label', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-navigation-rail label="Primary"></md-navigation-rail>');
    const rail = await page.find('md-navigation-rail');
    expect(rail.getAttribute('role')).toBe('navigation');
    expect(rail.getAttribute('aria-label')).toBe('Primary');
  });

  it('emits mdTabChange when a destination is selected', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <md-navigation-rail label="Primary">
        <md-navigation-rail-tab id="home" icon="home" label="Home"></md-navigation-rail-tab>
        <md-navigation-rail-tab id="search" icon="search" label="Search"></md-navigation-rail-tab>
      </md-navigation-rail>
    `);
    const rail = await page.find('md-navigation-rail');
    const ev = await rail.spyOnEvent('mdTabChange');
    const search = await page.find('#search');
    await search.click();
    await page.waitForChanges();
    expect(ev).toHaveReceivedEvent();
  });

  it('keyboard ArrowDown moves focus to next destination', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <md-navigation-rail label="Primary">
        <md-navigation-rail-tab id="t1" icon="home" label="Home" active></md-navigation-rail-tab>
        <md-navigation-rail-tab id="t2" icon="search" label="Search"></md-navigation-rail-tab>
        <md-navigation-rail-tab id="t3" icon="settings" label="Settings"></md-navigation-rail-tab>
      </md-navigation-rail>
    `);
    await page.waitForChanges();

    const t1 = await page.find('#t1');
    await t1.focus();
    await page.keyboard.press('ArrowDown');
    await page.waitForChanges();

    const focusedId = await page.evaluate(() => document.activeElement?.id ?? '');
    expect(focusedId).toBe('t2');
  });

  it('keyboard Home jumps to first destination, End jumps to last', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <md-navigation-rail label="Primary">
        <md-navigation-rail-tab id="t1" icon="home" label="Home"></md-navigation-rail-tab>
        <md-navigation-rail-tab id="t2" icon="search" label="Search" active></md-navigation-rail-tab>
        <md-navigation-rail-tab id="t3" icon="settings" label="Settings"></md-navigation-rail-tab>
      </md-navigation-rail>
    `);
    await page.waitForChanges();

    const t2 = await page.find('#t2');
    await t2.focus();
    await page.keyboard.press('End');
    await page.waitForChanges();
    let focusedId = await page.evaluate(() => document.activeElement?.id ?? '');
    expect(focusedId).toBe('t3');

    await page.keyboard.press('Home');
    await page.waitForChanges();
    focusedId = await page.evaluate(() => document.activeElement?.id ?? '');
    expect(focusedId).toBe('t1');
  });

  it('expand() / collapse() methods update the variant attribute', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-navigation-rail label="Primary"></md-navigation-rail>');
    const rail = await page.find('md-navigation-rail');

    await rail.callMethod('expand');
    await page.waitForChanges();
    expect(rail.getAttribute('variant')).toBe('expanded');

    await rail.callMethod('collapse');
    await page.waitForChanges();
    expect(rail.getAttribute('variant')).toBe('standard');
  });

  describe('account footer motion', () => {
    const footerFixture = (direction = 'ltr', custom = false, modal = false) => `
      <div dir="${direction}" style="position:relative;display:flex;height:560px;width:760px">
        <md-navigation-rail id="rail" variant="standard" ${modal ? 'modal' : ''}
          style="--md-sys-motion-duration-short4:200ms;--md-navigation-rail-padding-block:24px;
          ${custom ? '--md-navigation-rail-container-width:96px;--md-navigation-rail-expanded-width:260px;--md-navigation-rail-padding-inline:10px;--md-navigation-rail-footer-leading-size:40px' : ''}">
          <md-navigation-rail-tab icon="home" label="Overview"></md-navigation-rail-tab>
          <md-avatar id="account-avatar" slot="footer-leading" initials="DO" name="Demo operator" size="${custom ? 40 : 32}"></md-avatar>
          <div id="account-copy" slot="footer-content" style="font:14px/20px Arial,sans-serif">
            <button id="account-action" style="display:block;padding:0;border:0;background:none;font:inherit">Demo operator</button>
            <div>Demo workspace</div>
          </div>
        </md-navigation-rail>
      </div>`;

    it.each([
      ['ltr', false, false],
      ['rtl', false, false],
      ['ltr', true, false],
      ['rtl', true, false],
      ['ltr', false, true],
      ['rtl', false, true],
    ])('keeps the account anchored across frames (%s, custom=%s, modal=%s)', async (direction, custom, modal) => {
      const page = await newE2EPage();
      await page.setContent(footerFixture(direction as string, custom as boolean, modal as boolean));
      await page.waitForChanges();

      // Measure every painted frame, including the frame before the state flips.
      // Endpoint-only assertions miss the old centre/width animation drift.
      for (const [target, reverse] of [['expanded', false], ['standard', false], ['expanded', true]] as const) {
        const samples = await page.evaluate(async ({ target, reverse }) => {
          const rail = document.querySelector('#rail') as HTMLMdNavigationRailElement;
          const avatar = rail.querySelector('#account-avatar') as HTMLElement;
          const copy = rail.querySelector('#account-copy') as HTMLElement;
          const content = rail.shadowRoot!.querySelector('[part="footer-content"]') as HTMLElement;
          const sample = () => {
            const surface = rail.modal ? rail.shadowRoot!.querySelector('[part="container"]') as HTMLElement : rail;
            const a = avatar.getBoundingClientRect(), r = surface.getBoundingClientRect();
            const css = getComputedStyle(content);
            return {
              leading: getComputedStyle(rail).direction === 'rtl' ? r.right - a.right : a.left - r.left,
              bottom: r.bottom - a.bottom, width: a.width, height: a.height,
              copyHeight: copy.getBoundingClientRect().height,
              copyWhiteSpace: getComputedStyle(copy).whiteSpace,
              avatarVisible: getComputedStyle(avatar).visibility === 'visible' && Number(getComputedStyle(avatar).opacity) === 1,
              sameAvatar: rail.querySelector('#account-avatar') === avatar && avatar.isConnected,
              opacity: Number(css.opacity), visibility: css.visibility,
              inert: content.inert, ariaHidden: content.getAttribute('aria-hidden') === 'true',
            };
          };
          const samples = [sample()], start = performance.now();
          rail.variant = target;
          let reversed = false;
          while (performance.now() - start < (reverse ? 400 : 300)) {
            await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
            if (reverse && !reversed && performance.now() - start >= 65) {
              rail.variant = target === 'expanded' ? 'standard' : 'expanded';
              reversed = true;
            }
            samples.push(sample());
          }
          return samples;
        }, { target, reverse });
        expect(samples.length).toBeGreaterThan(4);
        for (const key of ['leading', 'bottom', 'width', 'height', 'copyHeight'] as const) {
          const values = samples.map(s => s[key]);
          expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(0.5);
        }
        expect(samples.every(s => s.avatarVisible && s.sameAvatar && s.copyWhiteSpace === 'nowrap')).toBe(true);
        const expectedSize = custom ? 40 : 32;
        expect(samples.every(s => Math.abs(s.width - expectedSize) <= 0.5 && Math.abs(s.height - expectedSize) <= 0.5)).toBe(true);
        const last = samples[samples.length - 1];
        const visible = reverse ? target !== 'expanded' : target === 'expanded';
        expect(last.visibility).toBe(visible ? 'visible' : 'hidden');
        expect(last.opacity).toBeCloseTo(Number(visible), 2);
        expect(last.inert).toBe(!visible);
        expect(last.ariaHidden).toBe(!visible);
      }
    });

    it('settles immediately for reduced motion and blocks focus on collapsed account text', async () => {
      const page = await newE2EPage();
      await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
      await page.setContent(footerFixture());
      await page.waitForChanges();
      const rail = await page.find('#rail');
      for (const method of ['expand', 'collapse']) {
        await rail.callMethod(method);
        await page.waitForChanges();
        const state = await page.evaluate(async () => {
          await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
          const rail = document.querySelector('#rail') as HTMLElement;
          const content = rail.shadowRoot!.querySelector('[part="footer-content"]') as HTMLElement;
          const button = rail.querySelector('#account-action') as HTMLButtonElement;
          (document.activeElement as HTMLElement)?.blur();
          button.focus();
          return {
            transition: getComputedStyle(content).transitionDuration,
            opacity: Number(getComputedStyle(content).opacity),
            inert: content.inert, focused: document.activeElement === button,
          };
        });
        const expanded = method === 'expand';
        expect(state.transition).toBe('0s');
        expect(state.opacity).toBe(Number(expanded));
        expect(state.inert).toBe(!expanded);
        expect(state.focused).toBe(expanded);
      }
    });
  });
});
