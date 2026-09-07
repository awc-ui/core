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

  describe('destination expansion motion', () => {
    const destinationFixture = (direction: string, density: number, collapsedLabels: string, custom = false) => `
      <div dir="${direction}" data-density="${density}"
        style="display:flex;height:560px;width:760px;--md-sys-density-scale:${density}">
        <md-navigation-rail id="motion-rail" variant="standard" active-index="0" expandable
          label="Primary" label-visibility="${collapsedLabels}"
          style="--md-sys-motion-duration-short4:400ms;--md-sys-motion-easing-standard:linear;
          ${custom ? '--md-navigation-rail-container-width:96px;--md-navigation-rail-padding-inline:8px;--md-navigation-rail-tab-icon-size:28px;--md-navigation-rail-expanded-width:260px' : ''}">
          <md-navigation-rail-tab id="motion-active" icon="home" label="Overview" value="overview"></md-navigation-rail-tab>
          <md-navigation-rail-tab icon="science" label="Test runs" value="runs"></md-navigation-rail-tab>
          <md-navigation-rail-tab icon="settings" label="Settings" value="settings"></md-navigation-rail-tab>
        </md-navigation-rail>
      </div>`;

    it.each([
      ['ltr', 0, 'none', false],
      ['rtl', 0, 'none', false],
      ['ltr', -1, 'none', false],
      ['rtl', -1, 'none', false],
      ['ltr', -2, 'none', false],
      ['rtl', -2, 'none', false],
      ['ltr', -3, 'none', false],
      ['rtl', -3, 'none', false],
      ['ltr', -4, 'none', false],
      ['rtl', -4, 'none', false],
      ['ltr', 0, 'all', false],
      ['rtl', 0, 'all', false],
      ['ltr', -1, 'none', true],
      ['rtl', -1, 'none', true],
    ])('anchors the icon while the active pill morphs (%s, density=%s, labels=%s, custom=%s)', async (direction, density, collapsedLabels, custom) => {
      const page = await newE2EPage();
      await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
      await page.setContent(destinationFixture(direction as string, density as number, collapsedLabels as string, custom as boolean));
      await page.waitForChanges();
      await page.evaluate(async (collapsedLabels) => {
        await document.fonts.ready;
        const rail = document.querySelector('#motion-rail') as HTMLMdNavigationRailElement;
        // Match consumers that reveal labels with the expanded layout. Capturing
        // only in the child's expanded watcher is too late for this parent reflow.
        rail.addEventListener('mdExpand', () => { rail.labelVisibility = 'all'; });
        rail.addEventListener('mdCollapse', () => { rail.labelVisibility = collapsedLabels as 'all' | 'none'; });
      }, collapsedLabels);

      for (const method of ['expand', 'collapse'] as const) {
        const samples = await page.evaluate(async (method) => {
          const rail = document.querySelector('#motion-rail') as HTMLMdNavigationRailElement;
          const tab = document.querySelector('#motion-active') as HTMLMdNavigationRailTabElement;
          const icon = tab.shadowRoot!.querySelector('[part="icon-wrapper"]') as HTMLElement;
          const indicator = tab.shadowRoot!.querySelector('[part="indicator"]') as HTMLElement;
          const toggle = rail.shadowRoot!.querySelector('[part="toggle"] md-icon-button') as HTMLElement;
          const rtl = getComputedStyle(rail).direction === 'rtl';
          const sample = () => {
            const r = rail.getBoundingClientRect(), i = icon.getBoundingClientRect(), p = indicator.getBoundingClientRect(), t = toggle.getBoundingClientRect();
            return {
              at: performance.now(), railWidth: r.width,
              iconLeading: rtl ? r.right - (i.left + i.width / 2) : i.left + i.width / 2 - r.left,
              iconTop: i.top + i.height / 2 - r.top,
              toggleLeading: rtl ? r.right - (t.left + t.width / 2) : t.left + t.width / 2 - r.left,
              indicatorLeading: rtl ? r.right - p.right : p.left - r.left,
              indicatorTop: p.top - r.top, indicatorWidth: p.width, indicatorHeight: p.height,
              sameIcon: tab.shadowRoot!.querySelector('[part="icon-wrapper"]') === icon,
              sameIndicator: tab.shadowRoot!.querySelector('[part="indicator"]') === indicator,
              expanded: tab.expanded, labels: tab.labelVisibility,
            };
          };
          // Awaiting an RAF before the command ensures the baseline itself was
          // painted. Every subsequent sample is a frame, not an endpoint snapshot.
          await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
          const samples = [sample()], start = performance.now();
          await rail[method]();
          do {
            await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
            samples.push(sample());
          } while (performance.now() - start < 550);
          return samples;
        }, method);

        expect(samples.length).toBeGreaterThan(6);
        const first = samples[0], last = samples[samples.length - 1];
        expect(first.expanded).toBe(method !== 'expand');
        expect(last.expanded).toBe(method === 'expand');
        expect(last.labels).toBe(method === 'expand' ? 'all' : collapsedLabels);
        expect(samples.every(sample => sample.sameIcon && sample.sameIndicator)).toBe(true);

        // The icon must stay on the collapsed rail's centre axis. Merely gliding
        // between endpoints still hid the old density -1 drift from 38 to 39.5px.
        for (const key of ['iconLeading', 'toggleLeading'] as const) {
          const leading = samples.map(sample => sample[key]);
          expect(Math.max(...leading) - Math.min(...leading)).toBeLessThanOrEqual(0.5);
        }
        if (collapsedLabels === 'none') {
          const top = samples.map(sample => sample.iconTop);
          expect(Math.max(...top) - Math.min(...top)).toBeLessThanOrEqual(0.5);
        }

        for (const key of ['iconTop', 'indicatorLeading', 'indicatorTop', 'indicatorWidth', 'indicatorHeight'] as const) {
          const low = Math.min(first[key], last[key]), high = Math.max(first[key], last[key]);
          const travel = high - low;
          // The compact icon used to jump 12px away from BOTH endpoints on its
          // first expanded frame. The pill also snapped straight to its target.
          for (let index = 0; index < samples.length; index++) {
            const current = samples[index];
            expect(current[key]).toBeGreaterThanOrEqual(low - 2);
            expect(current[key]).toBeLessThanOrEqual(high + 2);
            if (index === 0) continue;
            const previous = samples[index - 1];
            const elapsed = current.at - previous.at;
            // Allow two paint intervals of linear movement and 2px rounding, but
            // never a full geometry swap in an early 16ms frame.
            const allowedStep = travel * Math.min(1, elapsed / 400 * 2) + 2;
            expect(Math.abs(current[key] - previous[key])).toBeLessThanOrEqual(allowedStep);
          }
        }
        expect(samples.some(sample => sample.indicatorWidth > Math.min(first.indicatorWidth, last.indicatorWidth) + 3 && sample.indicatorWidth < Math.max(first.indicatorWidth, last.indicatorWidth) - 3)).toBe(true);
        for (const sample of samples) {
          expect(sample.indicatorLeading).toBeGreaterThanOrEqual(-2);
          expect(sample.indicatorLeading + sample.indicatorWidth).toBeLessThanOrEqual(sample.railWidth + 2);
        }
        const collapsed = method === 'expand' ? first : last;
        expect(collapsed.indicatorWidth).toBeCloseTo(Math.max(40, 56 + Number(density) * 4), 1);
        expect(collapsed.indicatorHeight).toBeCloseTo(Math.max(24, 32 + Number(density) * 2), 1);
        expect(samples.every(sample => Math.abs(sample.iconLeading - collapsed.railWidth / 2) <= 0.5)).toBe(true);
      }
    });

    it.each([
      ['ltr', 0], ['rtl', 0],
      ['ltr', -1], ['rtl', -1],
      ['ltr', -2], ['rtl', -2],
      ['ltr', -3], ['rtl', -3],
      ['ltr', -4], ['rtl', -4],
    ])('keeps the icon stationary during rapid reversal (%s, density=%s)', async (direction, density) => {
      const page = await newE2EPage();
      await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
      await page.setContent(destinationFixture(direction as string, density as number, 'none'));
      await page.waitForChanges();
      const result = await page.evaluate(async () => {
        const rail = document.querySelector('#motion-rail') as HTMLMdNavigationRailElement;
        const tab = document.querySelector('#motion-active') as HTMLMdNavigationRailTabElement;
        const icon = tab.shadowRoot!.querySelector('[part="icon-wrapper"]') as HTMLElement;
        const indicator = tab.shadowRoot!.querySelector('[part="indicator"]') as HTMLElement;
        const toggle = rail.shadowRoot!.querySelector('[part="toggle"] md-icon-button') as HTMLElement;
        const rtl = getComputedStyle(rail).direction === 'rtl';
        rail.addEventListener('mdExpand', () => { rail.labelVisibility = 'all'; });
        rail.addEventListener('mdCollapse', () => { rail.labelVisibility = 'none'; });
        const sample = () => {
          const r = rail.getBoundingClientRect(), i = icon.getBoundingClientRect(), p = indicator.getBoundingClientRect(), t = toggle.getBoundingClientRect();
          return {
            at: performance.now(), iconLeading: rtl ? r.right - (i.left + i.width / 2) : i.left + i.width / 2 - r.left,
            iconTop: i.top + i.height / 2 - r.top,
            toggleLeading: rtl ? r.right - (t.left + t.width / 2) : t.left + t.width / 2 - r.left,
            indicatorLeading: rtl ? r.right - p.right : p.left - r.left,
            indicatorTop: p.top - r.top, indicatorWidth: p.width, indicatorHeight: p.height,
          };
        };
        await document.fonts.ready;
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
        const samples = [sample()], start = performance.now();
        let reversal = -1;
        await rail.expand();
        do {
          await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
          samples.push(sample());
          if (reversal < 0 && performance.now() - start >= 85) {
            reversal = samples.length - 1;
            await rail.toggle();
          }
        } while (performance.now() - start < 650);
        return { samples, reversal, variant: rail.variant, expanded: tab.expanded, labels: tab.labelVisibility };
      });

      const { samples, reversal } = result;
      expect(reversal).toBeGreaterThan(0);
      expect(reversal).toBeLessThan(samples.length - 2);
      expect(result.variant).toBe('standard');
      expect(result.expanded).toBe(false);
      expect(result.labels).toBe('none');
      const first = samples[0], before = samples[reversal], last = samples[samples.length - 1];
      expect(before.indicatorWidth).toBeGreaterThan(first.indicatorWidth + 3);
      for (const key of ['iconLeading', 'iconTop', 'toggleLeading'] as const) {
        const values = samples.map(sample => sample[key]);
        // Covers expansion, the reversal frame and the complete collapse, not
        // only the final return to the same collapsed resting position.
        expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(0.5);
      }
      for (const key of ['indicatorLeading', 'indicatorTop', 'indicatorWidth', 'indicatorHeight'] as const) {
        expect(last[key]).toBeCloseTo(first[key], 1);
        const travel = Math.abs(before[key] - first[key]);
        for (let index = reversal + 1; index < samples.length; index++) {
          const previous = samples[index - 1], current = samples[index];
          const elapsed = current.at - previous.at;
          // Restarting from either old endpoint would jump here; a reversal
          // must start from the box that was visible immediately before toggle.
          expect(Math.abs(current[key] - previous[key])).toBeLessThanOrEqual(travel * Math.min(1, elapsed / 400 * 2) + 2);
        }
      }
    });
  });
});
