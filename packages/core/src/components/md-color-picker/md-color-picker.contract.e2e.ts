import { newE2EPage } from '@stencil/core/testing';

// Gate-1 contract checks (native-parity source review, 2026-10-25).
describe('md-color-picker contract', () => {
  it('applies a controlled value equal to the last emitted one after another controlled value', async () => {
    const page = await newE2EPage({ html: '<md-color-picker value="#6750A4" presets="#00FF00"></md-color-picker>' });
    const result = await page.evaluate(async () => {
      const picker = document.querySelector('md-color-picker') as any;
      await picker.componentOnReady();
      const settle = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const hex = () => (picker.shadowRoot.querySelector('[part="field-hex"] input') as HTMLInputElement).value;
      (picker.shadowRoot.querySelector('[part="preset"]') as HTMLElement).click(); await settle();
      const picked = [picker.value, hex()];
      picker.value = '#0000FF'; await settle();
      const blue = [picker.value, hex()];
      picker.value = '#00FF00'; await settle();
      return { picked, blue, green: [picker.value, hex(), picker.shadowRoot.querySelector('[part="hue"]').getAttribute('aria-valuenow')] };
    });
    expect(result.picked).toEqual(['#00FF00', '#00FF00']);
    expect(result.blue).toEqual(['#0000FF', '#0000FF']);
    expect(result.green).toEqual(['#00FF00', '#00FF00', '120']);
  });

  it('marks short-hex presets as selected like their six-digit forms', async () => {
    const page = await newE2EPage({ html: '<md-color-picker value="#FF0000" presets="#f00,#0f0,#0000FF"></md-color-picker>' });
    const selected = () => page.evaluate(() => Array.from(document.querySelector('md-color-picker')!.shadowRoot!.querySelectorAll('[part="preset"]'))
      .map(preset => preset.getAttribute('aria-selected')));
    expect(await selected()).toEqual(['true', 'false', 'false']);
    const presets = await page.findAll('md-color-picker >>> [part="preset"]');
    await presets[1].click(); await page.waitForChanges();
    expect(await selected()).toEqual(['false', 'true', 'false']);
    await presets[2].click(); await page.waitForChanges();
    expect(await selected()).toEqual(['false', 'false', 'true']);
  });

  it('returns focus to the trigger when the popover closes with focus inside it', async () => {
    const page = await newE2EPage({ html: '<button id="outside">Outside</button><md-color-picker variant="popover" dismiss-on-outside-click><button slot="trigger">Pick</button></md-color-picker>' });
    const active = () => page.evaluate(() => {
      const picker = document.querySelector('md-color-picker')!;
      const inner = picker.shadowRoot!.activeElement as HTMLElement | null;
      return inner ? `shadow:${inner.getAttribute('part')}` : (document.activeElement as HTMLElement).id || document.activeElement!.tagName;
    });
    await page.click('md-color-picker button'); await page.waitForChanges();
    await page.keyboard.press('Tab'); await page.waitForChanges();
    expect(await active()).toBe('shadow:plate');
    await page.keyboard.press('Escape'); await page.waitForChanges();
    expect(await page.evaluate(() => (document.querySelector('md-color-picker') as any).open)).toBe(false);
    expect(await page.evaluate(() => document.activeElement === document.querySelector('md-color-picker button'))).toBe(true);
    // Programmatic close from inside the panel restores focus the same way.
    await page.keyboard.press('Enter'); await page.waitForChanges();
    await page.keyboard.press('Tab'); await page.waitForChanges();
    expect(await active()).toBe('shadow:plate');
    await page.evaluate(() => (document.querySelector('md-color-picker') as any).close()); await page.waitForChanges();
    expect(await page.evaluate(() => document.activeElement === document.querySelector('md-color-picker button'))).toBe(true);
    // Guard: an outside click keeps focus where the user clicked.
    await page.click('md-color-picker button'); await page.waitForChanges();
    await new Promise(resolve => setTimeout(resolve, 50));
    await page.click('#outside'); await page.waitForChanges();
    expect(await page.evaluate(() => (document.querySelector('md-color-picker') as any).open)).toBe(false);
    expect(await active()).toBe('outside');
  });

  it('dims disabled presets like the other disabled surfaces', async () => {
    const page = await newE2EPage({ html: '<md-color-picker disabled presets="#ff0000"></md-color-picker><md-color-picker presets="#ff0000"></md-color-picker>' });
    const styles = await page.evaluate(() => Array.from(document.querySelectorAll('md-color-picker')).map(picker => {
      const preset = getComputedStyle(picker.shadowRoot!.querySelector('[part="preset"]')!);
      const plate = getComputedStyle(picker.shadowRoot!.querySelector('[part="plate"]')!);
      return { opacity: preset.opacity, cursor: preset.cursor, plate: plate.opacity };
    }));
    expect(styles[0].opacity).toBe(styles[0].plate);
    expect(styles[0].opacity).toBe('0.5');
    expect(styles[0].cursor).not.toBe('pointer');
    expect(styles[1]).toEqual({ opacity: '1', cursor: 'pointer', plate: '1' });
  });

  it('lets Escape inside an open popover close only the popover when it sits in a modal', async () => {
    const page = await newE2EPage({ html: '<md-dialog open headline="Theme"><md-color-picker variant="popover"><button slot="trigger">Pick</button></md-color-picker></md-dialog>' });
    await new Promise(resolve => setTimeout(resolve, 400));
    await page.evaluate(() => (document.querySelector('md-color-picker') as any).show());
    await page.waitForChanges();
    await page.evaluate(() => (document.querySelector('md-color-picker')!.shadowRoot!.querySelector('[part="plate"]') as HTMLElement).focus());
    await page.keyboard.press('Escape'); await page.waitForChanges();
    await new Promise(resolve => setTimeout(resolve, 400));
    const state = await page.evaluate(() => ({
      picker: (document.querySelector('md-color-picker') as any).open,
      dialog: (document.querySelector('md-dialog') as any).open,
      trigger: document.activeElement === document.querySelector('md-color-picker button'),
    }));
    expect(state).toEqual({ picker: false, dialog: true, trigger: true });
    // A second Escape now reaches the dialog.
    await page.keyboard.press('Escape'); await page.waitForChanges();
    await new Promise(resolve => setTimeout(resolve, 400));
    expect(await page.evaluate(() => (document.querySelector('md-dialog') as any).open)).toBe(false);
  });

  it('keeps the preset and preview swatches in their own colours under forced colours', async () => {
    const page = await newE2EPage({ html: '<md-color-picker value="#00FF00" presets="#ff0000,#0000ff"></md-color-picker>' });
    // This puppeteer's emulateMediaFeatures rejects forced-colors; CDP accepts it.
    const cdp = await (page as any).target().createCDPSession();
    await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value: 'active' }] });
    await page.waitForChanges();
    await new Promise(resolve => setTimeout(resolve, 300));
    const colours = await page.evaluate(() => {
      const sr = document.querySelector('md-color-picker')!.shadowRoot!;
      return {
        forced: matchMedia('(forced-colors: active)').matches,
        presets: Array.from(sr.querySelectorAll('[part="preset"]')).map(p => getComputedStyle(p).backgroundColor),
        preview: getComputedStyle(sr.querySelector('.md-color-picker__preview-inner')!).backgroundColor,
        plate: getComputedStyle(sr.querySelector('[part="plate"]')!).backgroundColor,
      };
    });
    // The swatches are the information: the plate already kept its hue; the
    // presets and the current-colour preview were forced to Canvas (all white).
    expect(colours).toEqual({ forced: true, presets: ['rgb(255, 0, 0)', 'rgb(0, 0, 255)'], preview: 'rgb(0, 255, 0)', plate: 'rgb(0, 255, 0)' });
  });
});
