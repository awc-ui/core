import { newE2EPage } from '@stencil/core/testing';

/**
 * The stepper announces a step entering the error state through its visually
 * hidden `role="alert"` region. That region must not keep a stale error once
 * every step is valid again: assistive tech can still read it in browse mode,
 * and — because a live region only speaks when its content CHANGES — the same
 * error raised a second time would otherwise be silent.
 */
describe('md-stepper error announcements', () => {
  const html = `
    <md-stepper active="0">
      <md-step label="Account"><p>a</p></md-step>
      <md-step label="Plan"><p>b</p></md-step>
    </md-stepper>`;

  const alertText = (page: any) => page.evaluate(() =>
    (document.querySelector('md-stepper') as HTMLElement).shadowRoot!.querySelector('[role="alert"]')!.textContent);

  it('clears the alert region when the error is cleared, and announces the same error again', async () => {
    const page = await newE2EPage();
    await page.setContent(html);
    const step = await page.find('md-step');
    await page.evaluate(() => { const s = document.querySelector('md-step') as HTMLMdStepElement; s.errorText = 'Email is required'; s.error = true; });
    await page.waitForChanges();
    expect(await alertText(page)).toBe('Step 1 of 2: Account, error: Email is required');

    step.setProperty('error', false);
    await page.waitForChanges();
    expect(await alertText(page)).toBe('');

    // Count real content changes of the alert region: a re-raised error must change it.
    await page.evaluate(() => {
      const region = (document.querySelector('md-stepper') as HTMLElement).shadowRoot!.querySelector('[role="alert"]')!;
      (window as any).__alertMutations = 0;
      new MutationObserver((m) => { (window as any).__alertMutations += m.length; })
        .observe(region, { childList: true, characterData: true, subtree: true });
    });
    step.setProperty('error', true);
    await page.waitForChanges();
    expect(await alertText(page)).toBe('Step 1 of 2: Account, error: Email is required');
    expect(await page.evaluate(() => (window as any).__alertMutations)).toBeGreaterThan(0);
  });

  it('keeps the alert while another step is still in error', async () => {
    const page = await newE2EPage();
    await page.setContent(html);
    await page.evaluate(() => {
      const [a, b] = Array.from(document.querySelectorAll('md-step')) as HTMLMdStepElement[];
      a.errorText = 'Email is required'; a.error = true;
      b.errorText = 'Pick a plan'; b.error = true;
    });
    await page.waitForChanges();
    expect(await alertText(page)).toBe('Step 2 of 2: Plan, error: Pick a plan');
    await page.evaluate(() => { (document.querySelector('md-step') as HTMLMdStepElement).error = false; });
    await page.waitForChanges();
    expect(await alertText(page)).toBe('Step 2 of 2: Plan, error: Pick a plan');
  });
});
