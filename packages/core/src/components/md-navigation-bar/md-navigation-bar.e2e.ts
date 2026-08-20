import { newE2EPage, E2EPage } from '@stencil/core/testing';

const HTML_FOUR = `
  <md-navigation-bar>
    <md-navigation-tab label="Home" icon="home"></md-navigation-tab>
    <md-navigation-tab label="Search" icon="search"></md-navigation-tab>
    <md-navigation-tab label="Library" icon="library_music"></md-navigation-tab>
    <md-navigation-tab label="Profile" icon="person"></md-navigation-tab>
  </md-navigation-bar>
`;

async function setupBar(page: E2EPage, html = HTML_FOUR): Promise<void> {
  await page.setContent(html);
  await page.waitForChanges();
}

async function activeIndex(page: E2EPage): Promise<number> {
  return page.$eval('md-navigation-bar', (bar: HTMLElement) =>
    Number(bar.getAttribute('active-index') ?? '0'),
  );
}

async function focusedTabIndex(page: E2EPage): Promise<number> {
  return page.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll('md-navigation-tab'));
    return tabs.findIndex(t => t === document.activeElement);
  });
}

describe('md-navigation-bar — e2e', () => {
  // ─── Rendering ───────────────────────────────────────────
  it('renders and exposes the navigation landmark', async () => {
    const page = await newE2EPage();
    await setupBar(page);
    const bar = await page.find('md-navigation-bar');
    expect(bar).not.toBeNull();
    expect(bar.getAttribute('role')).toBe('navigation');
  });

  // ─── Mouse activation ────────────────────────────────────
  it('selects a tab on click and fires mdChange', async () => {
    const page = await newE2EPage();
    await setupBar(page);
    const bar = await page.find('md-navigation-bar');
    const onChange = await bar.spyOnEvent('mdChange');

    const tab = await page.find('md-navigation-tab:nth-child(3)');
    await tab.click();
    await page.waitForChanges();

    expect(onChange).toHaveReceivedEventTimes(1);
    expect(onChange).toHaveReceivedEventDetail({ index: 2, previousIndex: 0 });
    expect(await activeIndex(page)).toBe(2);
  });

  it('ignores clicks on disabled tabs', async () => {
    const page = await newE2EPage();
    await setupBar(page, `
      <md-navigation-bar>
        <md-navigation-tab label="A"></md-navigation-tab>
        <md-navigation-tab label="B" disabled></md-navigation-tab>
        <md-navigation-tab label="C"></md-navigation-tab>
      </md-navigation-bar>
    `);
    const bar = await page.find('md-navigation-bar');
    const onChange = await bar.spyOnEvent('mdChange');
    const disabled = await page.find('md-navigation-tab[disabled]');
    await disabled.click();
    await page.waitForChanges();
    expect(onChange).not.toHaveReceivedEvent();
    expect(await activeIndex(page)).toBe(0);
  });

  // ─── Keyboard navigation ─────────────────────────────────
  describe('keyboard', () => {
    it('moves focus and selects on ArrowRight (automatic activation)', async () => {
      const page = await newE2EPage();
      await setupBar(page);

      // Focus the active tab first.
      await page.evaluate(() => {
        (document.querySelector('md-navigation-tab') as HTMLElement)?.focus();
      });
      await page.waitForChanges();

      await page.keyboard.press('ArrowRight');
      await page.waitForChanges();
      expect(await activeIndex(page)).toBe(1);
      expect(await focusedTabIndex(page)).toBe(1);
    });

    it('moves focus and selects on ArrowLeft, wrapping at the start', async () => {
      const page = await newE2EPage();
      await setupBar(page);

      await page.evaluate(() => {
        (document.querySelector('md-navigation-tab') as HTMLElement)?.focus();
      });
      await page.waitForChanges();

      await page.keyboard.press('ArrowLeft');
      await page.waitForChanges();
      // Wraps around to the last enabled tab (index 3).
      expect(await activeIndex(page)).toBe(3);
      expect(await focusedTabIndex(page)).toBe(3);
    });

    it('jumps to first / last with Home / End', async () => {
      const page = await newE2EPage();
      await setupBar(page);

      await page.evaluate(() => {
        const tabs = document.querySelectorAll('md-navigation-tab');
        (tabs[1] as HTMLElement).focus();
      });
      await page.waitForChanges();

      await page.keyboard.press('End');
      await page.waitForChanges();
      expect(await activeIndex(page)).toBe(3);

      await page.keyboard.press('Home');
      await page.waitForChanges();
      expect(await activeIndex(page)).toBe(0);
    });

    it('skips disabled tabs during arrow navigation', async () => {
      const page = await newE2EPage();
      await setupBar(page, `
        <md-navigation-bar>
          <md-navigation-tab label="A"></md-navigation-tab>
          <md-navigation-tab label="B" disabled></md-navigation-tab>
          <md-navigation-tab label="C"></md-navigation-tab>
          <md-navigation-tab label="D"></md-navigation-tab>
        </md-navigation-bar>
      `);

      await page.evaluate(() => {
        (document.querySelector('md-navigation-tab') as HTMLElement)?.focus();
      });
      await page.waitForChanges();

      await page.keyboard.press('ArrowRight');
      await page.waitForChanges();
      // B is disabled, so focus jumps over it.
      expect(await activeIndex(page)).toBe(2);
      expect(await focusedTabIndex(page)).toBe(2);
    });

    it('honors manual-activation: arrows move focus only, Enter activates', async () => {
      const page = await newE2EPage();
      await setupBar(page, `
        <md-navigation-bar manual-activation>
          <md-navigation-tab label="A"></md-navigation-tab>
          <md-navigation-tab label="B"></md-navigation-tab>
          <md-navigation-tab label="C"></md-navigation-tab>
        </md-navigation-bar>
      `);

      await page.evaluate(() => {
        (document.querySelector('md-navigation-tab') as HTMLElement)?.focus();
      });
      await page.waitForChanges();

      await page.keyboard.press('ArrowRight');
      await page.waitForChanges();
      // Focus moved but the active tab hasn't changed.
      expect(await focusedTabIndex(page)).toBe(1);
      expect(await activeIndex(page)).toBe(0);

      await page.keyboard.press('Enter');
      await page.waitForChanges();
      expect(await activeIndex(page)).toBe(1);
    });

    it('activates via Space on the focused tab', async () => {
      const page = await newE2EPage();
      await setupBar(page);

      await page.evaluate(() => {
        const tabs = document.querySelectorAll('md-navigation-tab');
        (tabs[2] as HTMLElement).focus();
      });
      await page.waitForChanges();
      await page.keyboard.press('Space');
      await page.waitForChanges();
      expect(await activeIndex(page)).toBe(2);
    });
  });

  // ─── Public API ──────────────────────────────────────────
  it('exposes a select() method that activates a tab', async () => {
    const page = await newE2EPage();
    await setupBar(page);
    const bar = await page.find('md-navigation-bar');
    await bar.callMethod('select', 3);
    await page.waitForChanges();
    expect(await activeIndex(page)).toBe(3);
  });

  // ─── RTL ─────────────────────────────────────────────────
  it('reverses arrow direction in RTL', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <div dir="rtl">
        ${HTML_FOUR}
      </div>
    `);
    await page.waitForChanges();

    await page.evaluate(() => {
      (document.querySelector('md-navigation-tab') as HTMLElement)?.focus();
    });
    await page.waitForChanges();

    // In RTL, ArrowLeft moves forward (visually toward the right side of the
    // logical "next" item). We assert by checking the active index advances.
    await page.keyboard.press('ArrowLeft');
    await page.waitForChanges();
    expect(await activeIndex(page)).toBe(1);
  });
});
