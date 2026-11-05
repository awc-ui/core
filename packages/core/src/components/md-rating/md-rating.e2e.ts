import { newE2EPage } from '@stencil/core/testing';

describe('md-rating browser interactions', () => {
  it('supports keyboard adjustment, bounds, RTL direction and native form reset', async () => {
    const page = await newE2EPage();
    await page.setContent('<form><label for="rating">Your rating</label><md-rating id="rating" name="score" value="2" precision="0.5" show-value-label></md-rating><button type="reset">Reset</button></form>');
    const host = await page.find('md-rating');
    const changes = await host.spyOnEvent('mdChange');
    await host.callMethod('focusRating');
    expect((await page.find('md-rating >>> [role="slider"]')).getAttribute('aria-label')).toBe('Your rating');
    const value = () => page.$eval('md-rating', (el: any) => el.value);
    for (const [key, expected] of [['ArrowRight', 2.5], ['ArrowLeft', 2], ['ArrowUp', 2.5], ['ArrowDown', 2], ['End', 5], ['ArrowRight', 5], ['Home', 0], ['1', 1], ['9', 1], ['Escape', 1]] as const) {
      await page.keyboard.press(key);
      await page.waitForChanges();
      expect(await value()).toBe(expected);
    }
    await page.$eval('md-rating', el => el.setAttribute('dir', 'rtl'));
    await page.keyboard.press('ArrowLeft');
    await page.waitForChanges();
    expect(await value()).toBe(1.5);
    await page.keyboard.press('ArrowRight');
    await page.waitForChanges();
    expect(await value()).toBe(1);
    expect(await page.$eval('form', el => new FormData(el as HTMLFormElement).get('score'))).toBe('1');
    await (await page.find('button')).click();
    await page.waitForChanges();
    expect(await value()).toBe(2);
    expect(changes.events.map(event => event.detail)).toEqual([2.5, 2, 2.5, 2, 5, 0, 1, 1.5, 1]);
  });

  it('previews half ratings with the pointer, commits and clears repeated selections', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-rating precision="0.5" show-value-label></md-rating><button>Outside</button>');
    const host = await page.find('md-rating');
    const hover = await host.spyOnEvent('mdHover');
    const changes = await host.spyOnEvent('mdChange');
    const rect = await page.$eval('md-rating', el => {
      const r = el.shadowRoot!.querySelectorAll('.md-rating__item')[2].getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    });
    await page.mouse.move(rect.x + rect.width * 0.25, rect.y + rect.height / 2);
    await page.waitForChanges();
    expect(hover.events[hover.events.length - 1].detail).toBe(2.5);
    expect(await host.getProperty('value')).toBe(0);
    await page.mouse.click(rect.x + rect.width * 0.25, rect.y + rect.height / 2);
    await page.waitForChanges();
    expect(await host.getProperty('value')).toBe(2.5);
    await page.mouse.click(rect.x + rect.width * 0.25, rect.y + rect.height / 2);
    await page.waitForChanges();
    expect(await host.getProperty('value')).toBe(0);
    expect(changes.events.map(event => event.detail)).toEqual([2.5, 0]);
    await page.mouse.move(700, 400);
    await page.waitForChanges();
    expect(hover.events[hover.events.length - 1].detail).toBeNull();
    host.setProperty('hover', 'off');
    host.setProperty('precision', 1);
    await page.waitForChanges();
    const before = hover.events.length;
    await page.mouse.move(rect.x + rect.width * 0.75, rect.y + rect.height / 2);
    await page.mouse.click(rect.x + rect.width * 0.75, rect.y + rect.height / 2);
    await page.waitForChanges();
    expect(hover.events).toHaveLength(before);
    expect(await host.getProperty('value')).toBe(3);
  });

  it('honours readonly, disabled and soft-disabled states, custom labels and value validation', async () => {
    const page = await newE2EPage();
    await page.setContent('<span id="label">Product quality</span><md-rating aria-labelledby="label" value="3" show-value-label></md-rating>');
    const host = await page.find('md-rating');
    const changes = await host.spyOnEvent('mdChange');
    await page.$eval('md-rating', (el: any) => { el.getLabel = (v: number) => `${v} points`; el.outlineEmpty = false; el.emptyIcon = 'circle'; });
    await page.waitForChanges();
    expect((await page.find('md-rating >>> [role="slider"]')).getAttribute('aria-valuetext')).toBe('3 points');
    for (const state of ['softDisabled', 'disabled', 'readonly']) {
      host.setProperty(state, true);
      await page.waitForChanges();
      await (await page.find('md-rating >>> .md-rating__item')).click();
      await host.callMethod('focusRating');
      await page.keyboard.press('ArrowUp');
      await page.waitForChanges();
      expect(await host.getProperty('value')).toBe(3);
      if (state === 'readonly') {
        const picture = await page.find('md-rating >>> [role="img"]');
        expect(picture.getAttribute('aria-label')).toBe('Product quality: 3 points');
        expect(picture.getAttribute('aria-valuenow')).toBeNull();
      }
      host.setProperty(state, false);
      await page.waitForChanges();
    }
    expect(changes).toHaveReceivedEventTimes(0);
    host.setProperty('max', 2);
    await page.waitForChanges();
    expect(await host.getProperty('value')).toBe(2);
    host.setProperty('value', -4);
    await page.waitForChanges();
    expect(await host.getProperty('value')).toBe(0);
    await page.$eval('md-rating', (el: any) => { el.value = Number.NaN; });
    await page.waitForChanges();
    expect(await host.getProperty('value')).toBe(0);
    host.setProperty('value', 99);
    await page.waitForChanges();
    expect(await host.getProperty('value')).toBe(2);
  });
});
