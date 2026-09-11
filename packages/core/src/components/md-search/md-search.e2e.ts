import { newE2EPage } from '@stencil/core/testing';

describe('md-search e2e', () => {
  it.each(['ltr', 'rtl'])('keeps closed bar results out of the app header layout (%s)', async (dir) => {
    const page = await newE2EPage();
    await page.setContent(`
      <div dir="${dir}">
        <header style="height:64px;display:flex;align-items:center">
          <div id="headline" style="display:flex;align-items:center;width:100%">
            <span>Workbench</span>
            <md-search layout="full-screen" trigger="bar">
              <div slot="results" style="height:400px">Repository results</div>
            </md-search>
          </div>
        </header>
        <button id="package" style="width:100%;height:56px">Order management</button>
      </div>
    `);
    const search = await page.find('md-search');
    const readLayout = () => page.evaluate(() => {
      const host = document.querySelector('md-search') as HTMLElement;
      const bar = host.shadowRoot!.querySelector('[part="bar"]')!;
      const button = document.querySelector('#package')!;
      const rect = button.getBoundingClientRect();
      return {
        hostHeight: host.getBoundingClientRect().height,
        barHeight: bar.getBoundingClientRect().height,
        headlineHeight: document.querySelector('#headline')!.getBoundingClientRect().height,
        packageReceivesClick: document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2) === button,
      };
    });
    const expectCompact = async () => {
      const layout = await readLayout();
      expect(layout.barHeight).toBeGreaterThan(0);
      expect(layout.hostHeight).toBeCloseTo(layout.barHeight, 0);
      expect(layout.headlineHeight).toBeLessThanOrEqual(64);
      expect(layout.packageReceivesClick).toBe(true);
    };
    await expectCompact();

    await search.callMethod('show');
    await page.waitForChanges();
    expect(await search.getProperty('open')).toBe(true);
    expect(await page.evaluate(() => {
      const host = document.querySelector('md-search')!;
      const panel = host.shadowRoot!.querySelector('[part="panel"]')!;
      return getComputedStyle(panel).display;
    })).not.toBe('none');

    await search.callMethod('close');
    await page.waitForFunction(() => document.querySelector('md-search')!.classList.contains('md-search--closed'));
    await expectCompact();
  });

  it('renders with defaults', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-search placeholder="Find anything"></md-search>');
    const el = await page.find('md-search');
    expect(el).toBeTruthy();
    expect(await el.getProperty('open')).toBe(false);
    expect(await el.getProperty('value')).toBe('');
    expect(await el.getProperty('variant')).toBe('contained');
    expect(await el.getProperty('layout')).toBe('full-screen');
  });

  it('opens via show() and closes via close()', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-search></md-search>');
    const el = await page.find('md-search');

    await el.callMethod('show');
    await page.waitForChanges();
    expect(await el.getProperty('open')).toBe(true);

    await el.callMethod('close');
    await page.waitForChanges();
    expect(await el.getProperty('open')).toBe(false);
  });

  it('emits mdSubmit on Enter from the input', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-search open value="hello"></md-search>');
    const spy = await page.spyOnEvent('mdSubmit');

    await page.evaluate(() => {
      const search = document.querySelector('md-search') as HTMLElement;
      const input = search.shadowRoot?.querySelector('[part="input"]') as HTMLInputElement;
      input.focus();
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true }));
    });

    await page.waitForChanges();
    expect(spy).toHaveReceivedEvent();
    expect(spy.lastEvent.detail).toEqual({ value: 'hello' });
  });

  it('clears the input via the built-in clear button', async () => {
    const page = await newE2EPage();
    // The clear (×) button renders inside the OPEN search bar — a collapsed
    // trigger has no input row at all.
    await page.setContent('<md-search value="hello" open></md-search>');
    const el = await page.find('md-search');
    const clearSpy = await page.spyOnEvent('mdClear');

    await page.evaluate(() => {
      const search = document.querySelector('md-search') as HTMLElement;
      const clear = search.shadowRoot?.querySelector(
        '[part="clear-button"]',
      ) as HTMLButtonElement;
      clear.click();
    });

    await page.waitForChanges();
    expect(await el.getProperty('value')).toBe('');
    expect(clearSpy).toHaveReceivedEvent();
  });
});
