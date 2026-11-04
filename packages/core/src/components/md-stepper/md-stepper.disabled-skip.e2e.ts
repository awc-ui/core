import { newE2EPage } from '@stencil/core/testing';

/**
 * In `linear` mode a DISABLED step can never be completed by the user — it is
 * not navigable — and `next()` / Continue already skip over it. Reachability
 * (header click, `goTo()`, and the header's own disabled affordance) must treat
 * it the same way, or every step after it becomes permanently unreachable by
 * header click while Continue still walks straight past it.
 */
describe('md-stepper linear mode skips disabled steps for reachability', () => {
  const html = `
    <md-stepper active="0" auto-complete="false" nav="false">
      <md-step label="Account" completed></md-step>
      <md-step label="Plan" disabled></md-step>
      <md-step label="Payment"></md-step>
      <md-step label="Review"></md-step>
    </md-stepper>`;

  it('a header click reaches the step after a disabled one once every enabled prior step is complete', async () => {
    const page = await newE2EPage();
    await page.setContent(html);
    const stepper = await page.find('md-stepper');
    const changes = await stepper.spyOnEvent('mdStepChange');
    const payment = await page.find('md-step:nth-of-type(3) >>> .md-step__inner');
    expect(payment.getAttribute('aria-disabled')).toBeNull();
    await payment.click();
    await page.waitForChanges();
    expect(await stepper.getProperty('active')).toBe(2);
    expect(changes).toHaveReceivedEventDetail({ index: 2, previous: 0 });
  });

  it('goTo() past a disabled step follows the same rule, and an incomplete enabled step still blocks', async () => {
    const page = await newE2EPage();
    await page.setContent(html);
    const stepper = await page.find('md-stepper');
    await stepper.callMethod('goTo', 3); // Payment (index 2) is not complete → blocked
    await page.waitForChanges();
    expect(await stepper.getProperty('active')).toBe(0);
    const review = await page.find('md-step:nth-of-type(4) >>> .md-step__inner');
    expect(review.getAttribute('aria-disabled')).toBe('true');
    await stepper.callMethod('goTo', 2);
    await page.waitForChanges();
    expect(await stepper.getProperty('active')).toBe(2);
  });

  it('the disabled step itself stays unreachable', async () => {
    const page = await newE2EPage();
    await page.setContent(html);
    const stepper = await page.find('md-stepper');
    await stepper.callMethod('goTo', 1);
    await page.waitForChanges();
    expect(await stepper.getProperty('active')).toBe(0);
    const plan = await page.find('md-step:nth-of-type(2) >>> .md-step__inner');
    expect(plan.getAttribute('aria-disabled')).toBe('true');
  });
});
