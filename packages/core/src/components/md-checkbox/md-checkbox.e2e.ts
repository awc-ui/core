import { newE2EPage } from '@stencil/core/testing';

describe('md-checkbox (e2e)', () => {
  // ─── Form participation (ElementInternals, real browser) ───

  it('submits its value under name only when checked', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <form id="f">
        <md-checkbox name="agree" value="yes"></md-checkbox>
      </form>`);
    const read = () =>
      page.evaluate(() => {
        const fd = new FormData(document.getElementById('f') as HTMLFormElement);
        return fd.get('agree');
      });
    expect(await read()).toBeNull(); // unchecked → absent
    await (await page.find('md-checkbox')).click(); // check
    await page.waitForChanges();
    expect(await read()).toBe('yes'); // checked → submitted
  });

  it('uses "on" as the default submitted value', async () => {
    const page = await newE2EPage();
    await page.setContent(`<form id="f"><md-checkbox name="opt" checked></md-checkbox></form>`);
    const val = await page.evaluate(() => new FormData(document.getElementById('f') as HTMLFormElement).get('opt'));
    expect(val).toBe('on');
  });

  it('restores its checked state on form reset', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <form id="f">
        <md-checkbox name="agree" checked></md-checkbox>
        <button type="reset" id="r">reset</button>
      </form>`);
    const cb = await page.find('md-checkbox');
    await cb.click(); // now unchecked
    await page.waitForChanges();
    expect(await cb.getProperty('checked')).toBe(false);
    await (await page.find('#r')).click();
    await page.waitForChanges();
    expect(await cb.getProperty('checked')).toBe(true); // restored to initial
  });

  // ─── nested-interactive regression guard ───

  it('has no native <input> nested inside the role="checkbox" host', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-checkbox name="x"></md-checkbox>');
    const hasInput = await page.evaluate(
      () => !!document.querySelector('md-checkbox')!.shadowRoot!.querySelector('input'),
    );
    expect(hasInput).toBe(false);
  });

  // ─── Label association (labelable form-associated element) ───

  it('toggles when the wrapping label text is clicked (native labelable forwarding)', async () => {
    const page = await newE2EPage();
    await page.setContent('<label style="display:inline-flex;gap:12px;align-items:center">Accept terms <md-checkbox id="c"></md-checkbox></label>');
    await page.waitForChanges();
    // click the label's text region (left edge), not the checkbox itself
    const box = await page.evaluate(() => {
      const r = document.querySelector('label')!.getBoundingClientRect();
      return { x: r.left + 4, y: r.top + r.height / 2 };
    });
    await page.mouse.click(box.x, box.y);
    await page.waitForChanges();
    expect(await (await page.find('#c')).getProperty('checked')).toBe(true);
  });

  it('derives its accessible name from the wrapping label', async () => {
    const page = await newE2EPage();
    await page.setContent('<label>Accept terms <md-checkbox></md-checkbox></label>');
    await page.waitForChanges();
    const snapshot = await page.accessibility.snapshot();
    const findByRole = (node: any): any => {
      if (!node) return null;
      if (node.role === 'checkbox' || node.role === 'CheckBox') return node;
      for (const child of node.children || []) {
        const hit = findByRole(child);
        if (hit) return hit;
      }
      return null;
    };
    const cb = findByRole(snapshot);
    expect(cb).toBeTruthy();
    expect(cb.name).toContain('Accept terms');
  });

  // ─── Keyboard (WAI-ARIA checkbox: Space toggles, Enter reserved for submit) ───

  it('Space toggles, Enter does not', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-checkbox></md-checkbox>');
    const cb = await page.find('md-checkbox');
    await cb.focus();
    await page.keyboard.press('Enter');
    await page.waitForChanges();
    expect(await cb.getProperty('checked')).toBe(false);
    await page.keyboard.press(' ');
    await page.waitForChanges();
    expect(await cb.getProperty('checked')).toBe(true);
  });

  it('disabled does not toggle or fire mdChange', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-checkbox disabled></md-checkbox>');
    const cb = await page.find('md-checkbox');
    const spy = await cb.spyOnEvent('mdChange');
    await cb.click();
    await page.waitForChanges();
    expect(await cb.getProperty('checked')).toBe(false);
    expect(spy).not.toHaveReceivedEvent();
  });
});
