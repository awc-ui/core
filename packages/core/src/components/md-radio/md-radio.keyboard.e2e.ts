import { newE2EPage } from '@stencil/core/testing';

describe('md-radio grouped keyboard interaction', () => {
  it('wraps arrow focus and selection, skips unavailable radios and updates the submitted value', async () => {
    const page = await newE2EPage({ html: `<form><div role="radiogroup" aria-label="Delivery">
      <md-radio name="delivery" value="standard" checked>Standard</md-radio>
      <md-radio name="delivery" value="blocked" disabled>Unavailable</md-radio>
      <md-radio name="delivery" value="soft" soft-disabled>Temporarily unavailable</md-radio>
      <md-radio name="delivery" value="express">Express</md-radio>
    </div></form>` });
    const first = await page.find('md-radio[value="standard"]');
    const last = await page.find('md-radio[value="express"]');
    await first.callMethod('setFocus'); await page.keyboard.press('ArrowRight'); await page.waitForChanges();
    expect(await last.getProperty('checked')).toBe(true); expect(await first.getProperty('checked')).toBe(false);
    expect(await page.evaluate(() => document.activeElement?.getAttribute('value'))).toBe('express');
    expect(await page.evaluate(() => new FormData(document.querySelector('form')!).get('delivery'))).toBe('express');
    await page.keyboard.press('ArrowDown'); await page.waitForChanges();
    expect(await first.getProperty('checked')).toBe(true);
    await page.keyboard.press('ArrowLeft'); await page.waitForChanges(); expect(await last.getProperty('checked')).toBe(true);
    await page.keyboard.press('ArrowUp'); await page.waitForChanges(); expect(await first.getProperty('checked')).toBe(true);
    expect((await page.find('md-radio[disabled]')).getAttribute('tabindex')).toBe('-1');
    await page.evaluate(() => document.querySelector('form')!.reset()); await page.waitForChanges();
    expect(await first.getProperty('checked')).toBe(true); expect(await last.getProperty('checked')).toBe(false);
  });

  it('exposes public selection and focus events, ignores repeated selection and omits an ancestor-disabled group from form data', async () => {
    const page = await newE2EPage({ html: '<form><fieldset><legend>Delivery</legend><md-radio name="delivery" value="a">A</md-radio><md-radio name="delivery" value="b">B</md-radio></fieldset></form><md-radio id="standalone">Standalone</md-radio>' });
    const radio = await page.find('md-radio[value="b"]');
    const change = await radio.spyOnEvent('mdChange');
    const focus = await radio.spyOnEvent('mdFocus'); const blur = await radio.spyOnEvent('mdBlur');
    await radio.callMethod('select'); await page.waitForChanges();
    expect(change).toHaveReceivedEventDetail({ checked: true, value: 'b' });
    await radio.callMethod('select'); await page.waitForChanges(); expect(change).toHaveReceivedEventTimes(1);
    await radio.callMethod('setFocus'); await page.waitForChanges(); expect(focus).toHaveReceivedEventTimes(1);
    await radio.callMethod('setBlur'); await page.waitForChanges(); expect(blur).toHaveReceivedEventTimes(1);
    await page.evaluate(() => { document.querySelector('fieldset')!.disabled = true; }); await page.waitForChanges();
    expect(await page.evaluate(() => new FormData(document.querySelector('form')!).has('delivery'))).toBe(false);
    await page.evaluate(() => { document.querySelector('fieldset')!.disabled = false; });
    const blocked = await page.find('md-radio[value="a"]'); blocked.setProperty('disabled', true); await page.waitForChanges();
    await blocked.click(); await blocked.callMethod('select'); await page.waitForChanges();
    expect(await blocked.getProperty('checked')).toBe(false);
    const standalone = await page.find('#standalone'); await standalone.callMethod('setFocus');
    await page.keyboard.press('Space'); await page.waitForChanges(); expect(await standalone.getProperty('checked')).toBe(true);
    await page.keyboard.press('ArrowRight'); await page.waitForChanges();
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('standalone');
  });

  it('keeps one tab stop per group after arrow selection when no radio started checked', async () => {
    const page = await newE2EPage({ html: `<button id="before">before</button>
      <md-radio name="g" value="a">A</md-radio><md-radio name="g" value="b">B</md-radio><md-radio name="g" value="c" disabled>C</md-radio><md-radio name="g" value="d">D</md-radio>` });
    await page.focus('#before'); await page.keyboard.press('Tab'); await page.waitForChanges();
    const stops = () => page.evaluate(() => Array.from(document.querySelectorAll('md-radio')).map((r) => r.getAttribute('tabindex')));
    expect(await stops()).toEqual(['0', '-1', '-1', '-1']);
    await page.keyboard.press('ArrowDown'); await page.waitForChanges();
    expect(await page.evaluate(() => document.activeElement?.getAttribute('value'))).toBe('b');
    expect(await stops()).toEqual(['-1', '0', '-1', '-1']);
    await page.keyboard.press('ArrowDown'); await page.waitForChanges();
    expect(await stops()).toEqual(['-1', '-1', '-1', '0']);
  });

  it('does not re-announce an already checked radio when an arrow key has nowhere else to go', async () => {
    const page = await newE2EPage({ html: `<md-radio name="g" value="a" checked>A</md-radio><md-radio name="g" value="b" disabled>B</md-radio><md-radio id="solo" name="solo" value="s" checked>Solo</md-radio>` });
    const first = await page.find('md-radio[value="a"]'); const solo = await page.find('#solo');
    const firstChange = await first.spyOnEvent('mdChange'); const soloChange = await solo.spyOnEvent('mdChange');
    await first.callMethod('setFocus'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowUp'); await page.waitForChanges();
    expect(await page.evaluate(() => document.activeElement?.getAttribute('value'))).toBe('a');
    expect(await first.getProperty('checked')).toBe(true);
    expect(firstChange).toHaveReceivedEventTimes(0);
    await solo.callMethod('setFocus'); await page.keyboard.press('ArrowRight'); await page.waitForChanges();
    expect(soloChange).toHaveReceivedEventTimes(0);
  });
});
