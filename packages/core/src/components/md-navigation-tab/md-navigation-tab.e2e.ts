import { newE2EPage } from '@stencil/core/testing';

describe('md-navigation-tab — e2e', () => {
  it('renders standalone (no parent bar)', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-navigation-tab label="Home" icon="home"></md-navigation-tab>');
    const tab = await page.find('md-navigation-tab');
    expect(tab).not.toBeNull();
    expect(tab.getAttribute('role')).toBe('tab');
  });

  it('bubbles a native click on activation (no custom event)', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <div id="wrap">
        <md-navigation-tab label="A" icon="home"></md-navigation-tab>
        <md-navigation-tab label="B" icon="search"></md-navigation-tab>
      </div>
    `);
    const wrap = await page.find('#wrap');
    const spy = await wrap.spyOnEvent('click');
    const second = await page.find('md-navigation-tab:nth-child(2)');
    await second.click();
    await page.waitForChanges();
    expect(spy).toHaveReceivedEvent();
  });

  it('synthesizes a native click on Enter and Space when focused', async () => {
    const page = await newE2EPage();
    await page.setContent('<div id="wrap"><md-navigation-tab label="A" icon="home"></md-navigation-tab></div>');
    const wrap = await page.find('#wrap');
    const spy = await wrap.spyOnEvent('click');
    const tab = await page.find('md-navigation-tab');
    await tab.focus();
    await page.keyboard.press('Enter');
    await page.waitForChanges();
    expect(spy).toHaveReceivedEventTimes(1);

    await page.keyboard.press('Space');
    await page.waitForChanges();
    expect(spy).toHaveReceivedEventTimes(2);
  });

  it('hard-disabled: click passes THROUGH the tab (pointer-events none), no activation', async () => {
    const page = await newE2EPage();
    await page.setContent('<div id="wrap"><md-navigation-tab label="A" icon="home" disabled></md-navigation-tab></div>');
    const tab = await page.find('md-navigation-tab');
    const activate = await tab.spyOnEvent('mdTabClick');
    // Real mouse click at the tab's box: hard-disabled sets pointer-events:
    // none, so the tab must NOT be in the composed path (the wrap receives a
    // click TARGETED AT ITSELF — that's click-through, not a leak).
    const path = await page.evaluate(() => {
      return new Promise<string>((resolve) => {
        const wrap = document.getElementById('wrap')!;
        wrap.addEventListener('click', (e) => resolve((e.composedPath()[0] as HTMLElement).tagName), { once: true });
        setTimeout(() => resolve('NO-CLICK'), 500);
        const box = document.querySelector('md-navigation-tab')!.getBoundingClientRect();
        // elementFromPoint proves the hit target skips the disabled tab
        const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)!;
        (hit as HTMLElement).click();
      });
    });
    await page.waitForChanges();
    expect(path).toBe('DIV'); // the wrap itself — tab skipped by hit-testing
    expect(activate).toHaveReceivedEventTimes(0);
  });

  it('soft-disabled: tab stays targetable but blocks propagation and activation', async () => {
    const page = await newE2EPage();
    await page.setContent('<div id="wrap"><md-navigation-tab label="A" icon="home" soft-disabled></md-navigation-tab></div>');
    const wrap = await page.find('#wrap');
    const spy = await wrap.spyOnEvent('click');
    const tab = await page.find('md-navigation-tab');
    const activate = await tab.spyOnEvent('mdTabClick');
    await tab.click();
    await page.waitForChanges();
    // handleClick stopPropagation(): the wrap must not hear the tab's click...
    expect(spy).not.toHaveReceivedEvent();
    // ...and the tab must not activate.
    expect(activate).toHaveReceivedEventTimes(0);
  });

  it('toggles between filled and outlined icon glyphs when active flips', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-navigation-tab label="Home" icon="home" active-icon="home_filled"></md-navigation-tab>');
    const initial = await page.evaluate(() => {
      const t = document.querySelector('md-navigation-tab') as HTMLElement;
      return t.shadowRoot?.querySelector('.md-navigation-tab__icon')?.textContent?.trim();
    });
    expect(initial).toBe('home');

    await page.evaluate(() => {
      const t = document.querySelector('md-navigation-tab') as HTMLElement & { active?: boolean };
      (t as unknown as { active: boolean }).active = true;
    });
    await page.waitForChanges();

    const after = await page.evaluate(() => {
      const t = document.querySelector('md-navigation-tab') as HTMLElement;
      return t.shadowRoot?.querySelector('.md-navigation-tab__icon')?.textContent?.trim();
    });
    expect(after).toBe('home_filled');
  });

  it('renders the active indicator pill when active', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-navigation-tab label="Home" icon="home" active></md-navigation-tab>');
    const indicator = await page.find('md-navigation-tab >>> .md-navigation-tab__indicator');
    expect(indicator).not.toBeNull();
    expect(indicator.classList.contains('md-navigation-tab__indicator--active')).toBe(true);
  });

  it('renders the badge dot and large variant', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <div>
        <md-navigation-tab label="Dot" icon="home" badge></md-navigation-tab>
        <md-navigation-tab label="Num" icon="home" badge-value="42"></md-navigation-tab>
      </div>
    `);
    const dot = await page.find('md-navigation-tab:nth-child(1) >>> .md-navigation-tab__badge');
    const num = await page.find('md-navigation-tab:nth-child(2) >>> .md-navigation-tab__badge');
    expect(dot).not.toBeNull();
    expect(dot.classList.contains('md-navigation-tab__badge--small')).toBe(true);
    expect(num).not.toBeNull();
    expect(num.classList.contains('md-navigation-tab__badge--large')).toBe(true);
    expect(num.textContent).toBe('42');
  });

  it('exposes the focusEl() public method', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-navigation-tab label="Home" icon="home"></md-navigation-tab>');
    const tab = await page.find('md-navigation-tab');
    await tab.callMethod('focusEl');
    await page.waitForChanges();
    const focused = await page.evaluate(() => document.activeElement?.tagName);
    expect(focused).toBe('MD-NAVIGATION-TAB');
  });
});
