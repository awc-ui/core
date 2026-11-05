import { newE2EPage } from '@stencil/core/testing';

describe('md-snackbar browser lifecycle', () => {
  it('opens, dismisses, and supports repeated idempotent hide calls', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-snackbar message="Saved" closeable auto-hide="false"></md-snackbar>');
    const snack = await page.find('md-snackbar');
    const opened = await snack.spyOnEvent('mdOpen');
    const closed = await snack.spyOnEvent('mdClose');
    await snack.callMethod('hide');
    expect(closed).toHaveReceivedEventTimes(0);
    await snack.callMethod('show');
    await page.waitForChanges();
    expect(opened).toHaveReceivedEventTimes(1);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('md-snackbar')!.open);
    expect(closed.events[0].detail.reason).toBe('close');
    await snack.callMethod('show');
    await page.waitForChanges();
    await (await page.find('md-snackbar >>> md-icon-button')).click();
    await page.waitForFunction(() => !document.querySelector('md-snackbar')!.open);
    expect(closed.events).toHaveLength(2);
    await snack.callMethod('show');
    await snack.callMethod('hide', 'action');
    await snack.callMethod('hide');
    expect(closed.events[2].detail.reason).toBe('action');
    expect(closed.events).toHaveLength(3);
  });

  it('pauses dismissal while hovered, resumes on leave, and removes timers on disconnect', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-snackbar message="Saved" auto-hide-duration="500"></md-snackbar>');
    const snack = await page.find('md-snackbar');
    const closed = await snack.spyOnEvent('mdClose');
    await snack.callMethod('show');
    await page.waitForChanges();
    const surface = await page.find('md-snackbar >>> [part="surface"]');
    await surface.hover();
    await new Promise(resolve => setTimeout(resolve, 650));
    expect(await snack.getProperty('open')).toBe(true);
    await page.mouse.move(0, 0);
    await page.waitForFunction(() => !document.querySelector('md-snackbar')!.open);
    expect(closed.events[0].detail.reason).toBe('auto');
    await snack.callMethod('show');
    await page.$eval('md-snackbar', el => el.remove());
    await new Promise(resolve => setTimeout(resolve, 650));
    expect(closed.events).toHaveLength(1);
  });

  it('keeps its timer paused while focus moves between actions and resumes when focus leaves', async () => {
    const page = await newE2EPage();
    await page.setContent('<button id="outside">Outside</button><md-snackbar message="Saved" action="Undo" closeable auto-hide-duration="500"></md-snackbar>');
    const snack = await page.find('md-snackbar');
    const action = await snack.spyOnEvent('mdAction');
    await snack.callMethod('show');
    await page.waitForChanges();
    const undo = await page.find('md-snackbar >>> md-button');
    await undo.click();
    await page.waitForChanges();
    expect(action).toHaveReceivedEventTimes(1);
    await undo.focus();
    await page.keyboard.press('Tab');
    await new Promise(resolve => setTimeout(resolve, 650));
    expect(await snack.getProperty('open')).toBe(true);
    await (await page.find('#outside')).focus();
    await page.waitForFunction(() => !document.querySelector('md-snackbar')!.open);
  });

  it('raises newly opened peers and updates custom content slots', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-snackbar id="first" action="Undo" closeable auto-hide="false"></md-snackbar><md-snackbar id="second" open auto-hide="false" politeness="assertive" message="Second"></md-snackbar>');
    const first = await page.find('#first');
    await first.callMethod('show');
    await page.waitForChanges();
    expect(await page.evaluate(() => Number(document.querySelector<HTMLElement>('#first')!.style.getPropertyValue('--_stack-order')) > Number(document.querySelector<HTMLElement>('#second')!.style.getPropertyValue('--_stack-order')))).toBe(true);
    expect((await page.find('#second')).getAttribute('role')).toBe('alert');
    await page.$eval('#first', el => {
      el.append(document.createTextNode('Custom message'));
      for (const slot of ['action', 'close']) { const b = document.createElement('button'); b.slot = slot; b.textContent = slot; el.append(b); }
    });
    await page.waitForChanges();
    expect(first).toHaveClass('md-snackbar--with-action');
    expect(first).toHaveClass('md-snackbar--with-close');
    await page.$eval('#first', el => el.replaceChildren());
    await page.waitForChanges();
    await first.callMethod('hide');
    await page.$eval('#first', el => el.remove());
    expect(page.getDiagnostics().filter(item => item.type === 'error' || item.type === 'pageerror')).toEqual([]);
  });
});
