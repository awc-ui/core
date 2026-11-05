import { newE2EPage } from '@stencil/core/testing';

describe('md-segmented-button standalone and multiple selection', () => {
  it('emits alternate selection states for an icon-only multi-select segment', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-segmented-button icon="format_bold" aria-label="Bold" value="bold" segment-multiselect></md-segmented-button>');
    const segment = await page.find('md-segmented-button');
    const selected = await segment.spyOnEvent('mdSegmentClick');
    await segment.click();
    await page.waitForChanges();
    expect(selected.events[0].detail).toEqual({ value: 'bold', selected: true });
    segment.setProperty('selected', true);
    await page.waitForChanges();
    expect((await page.find('md-segmented-button >>> [part="checkmark"]')).textContent).toBe('check');
    await segment.focus();
    await page.keyboard.press('Space');
    await page.waitForChanges();
    expect(selected.events[1].detail).toEqual({ value: 'bold', selected: false });
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Escape');
    expect(selected.events).toHaveLength(2);
    segment.setProperty('noCheckmark', true);
    await page.waitForChanges();
    expect((await page.find('md-segmented-button >>> [part="icon"]')).textContent).toBe('format_bold');
    expect(await page.find('md-segmented-button >>> [part="label"]')).toBeNull();
  });
});

describe('md-segmented-button browser behavior', () => {
  it('requests single selection and reflects the owning set response in aria-checked', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <md-segmented-button-set aria-label="Calendar view">
        <md-segmented-button id="day" value="day" label="Day" selected></md-segmented-button>
        <md-segmented-button id="week" value="week">Week</md-segmented-button>
      </md-segmented-button-set>`);
    const day = await page.find('#day');
    const week = await page.find('#week');
    const request = await week.spyOnEvent('mdSegmentClick');
    const changed = await (await page.find('md-segmented-button-set')).spyOnEvent('mdChange');

    await week.click();
    await page.waitForChanges();
    expect(request).toHaveReceivedEventTimes(1);
    expect(request.lastEvent.detail).toEqual({ value: 'week', selected: true });
    expect(changed).toHaveReceivedEventTimes(1);
    expect(changed.lastEvent.detail).toEqual(['week']);
    expect(day.getAttribute('aria-checked')).toBe('false');
    expect(week.getAttribute('aria-checked')).toBe('true');
    expect(week.getAttribute('role')).toBe('radio');
    expect(await week.getProperty('selected')).toBe(true);
  });

  it('toggles multiselection with Enter and Space, preserving other selected values', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <md-segmented-button-set multiselect aria-label="Text styles">
        <md-segmented-button id="bold" value="bold" label="Bold"></md-segmented-button>
        <md-segmented-button value="italic" label="Italic" selected></md-segmented-button>
      </md-segmented-button-set>`);
    const bold = await page.find('#bold');
    const request = await bold.spyOnEvent('mdSegmentClick');
    const changed = await (await page.find('md-segmented-button-set')).spyOnEvent('mdChange');
    await page.$eval('#bold', element => (element as HTMLElement).focus());
    await page.keyboard.press('Enter');
    await page.waitForChanges();
    expect(bold.getAttribute('role')).toBe('checkbox');
    expect(bold.getAttribute('aria-checked')).toBe('true');
    expect(changed.lastEvent.detail).toEqual(['bold', 'italic']);

    await page.keyboard.press('Space');
    await page.waitForChanges();
    expect(request.events.map(event => event.detail)).toEqual([
      { value: 'bold', selected: true }, { value: 'bold', selected: false },
    ]);
    expect(changed).toHaveReceivedEventTimes(2);
    expect(changed.lastEvent.detail).toEqual(['italic']);
    expect(bold.getAttribute('aria-checked')).toBe('false');
  });

  it('moves and selects with arrow keys, skipping disabled segments and wrapping at the end', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <md-segmented-button-set aria-label="View">
        <md-segmented-button id="day" value="day" label="Day" selected></md-segmented-button>
        <md-segmented-button id="week" value="week" label="Week" disabled></md-segmented-button>
        <md-segmented-button id="month" value="month" label="Month"></md-segmented-button>
      </md-segmented-button-set>`);
    const changed = await (await page.find('md-segmented-button-set')).spyOnEvent('mdChange');
    await page.$eval('#day', element => (element as HTMLElement).focus());
    await page.keyboard.press('ArrowRight');
    await page.waitForChanges();
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('month');
    expect(changed.lastEvent.detail).toEqual(['month']);
    expect((await page.find('#month')).getAttribute('aria-checked')).toBe('true');
    expect((await page.find('#week')).getAttribute('tabindex')).toBe('-1');

    await page.keyboard.press('ArrowRight');
    await page.waitForChanges();
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('day');
    expect(changed.lastEvent.detail).toEqual(['day']);
    await page.keyboard.press('ArrowLeft');
    await page.waitForChanges();
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('month');
    expect(changed.events.map(event => event.detail)).toEqual([['month'], ['day'], ['month']]);
  });

  it('moves focus without selecting in multiselect mode until Space is pressed', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <md-segmented-button-set multiselect aria-label="Text styles">
        <md-segmented-button id="bold" value="bold" label="Bold" selected></md-segmented-button>
        <md-segmented-button id="italic" value="italic" label="Italic"></md-segmented-button>
      </md-segmented-button-set>`);
    const changed = await (await page.find('md-segmented-button-set')).spyOnEvent('mdChange');
    await page.$eval('#bold', element => (element as HTMLElement).focus());
    await page.keyboard.press('ArrowRight');
    await page.waitForChanges();
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('italic');
    expect((await page.find('#italic')).getAttribute('aria-checked')).toBe('false');
    expect(changed).not.toHaveReceivedEvent();

    await page.keyboard.press('Space');
    await page.waitForChanges();
    expect(changed).toHaveReceivedEventTimes(1);
    expect(changed.lastEvent.detail).toEqual(['bold', 'italic']);
  });

  it.each(['disabled', 'soft-disabled'])('rejects selection while %s and accepts it after enabling', async attribute => {
    const page = await newE2EPage();
    await page.setContent(`
      <md-segmented-button-set aria-label="View">
        <md-segmented-button id="day" value="day" label="Day" selected></md-segmented-button>
        <md-segmented-button id="week" value="week" label="Week" ${attribute}></md-segmented-button>
      </md-segmented-button-set>`);
    const week = await page.find('#week');
    const request = await week.spyOnEvent('mdSegmentClick');
    const changed = await (await page.find('md-segmented-button-set')).spyOnEvent('mdChange');
    expect(week.getAttribute('aria-disabled')).toBe('true');
    expect(week.getAttribute('tabindex')).toBe(attribute === 'disabled' ? '-1' : '0');
    await week.click();
    await page.$eval('#week', element => (element as HTMLElement).focus());
    await page.keyboard.press('Enter');
    await page.keyboard.press('Space');
    await page.waitForChanges();
    expect(request).not.toHaveReceivedEvent();
    expect(changed).not.toHaveReceivedEvent();
    expect(week.getAttribute('aria-checked')).toBe('false');
    expect((await page.find('#day')).getAttribute('aria-checked')).toBe('true');

    await page.$eval('#week', element => {
      const segment = element as HTMLElement & { disabled: boolean; softDisabled: boolean };
      segment.disabled = false;
      segment.softDisabled = false;
    });
    await page.waitForChanges();
    await week.click();
    await page.waitForChanges();
    expect(request).toHaveReceivedEventTimes(1);
    expect(changed.lastEvent.detail).toEqual(['week']);
    expect(week.getAttribute('aria-checked')).toBe('true');
  });
});
