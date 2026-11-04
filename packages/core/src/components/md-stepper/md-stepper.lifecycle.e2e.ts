import { newE2EPage } from '@stencil/core/testing';

describe('md-stepper live configuration and empty lifecycle', () => {
  it('localizes runtime child navigation and announces a newly set error', async () => {
    const page = await newE2EPage(); await page.setContent('<md-stepper mode="non-linear"><md-step label="Account">Account fields</md-step><md-step label="Review">Review fields</md-step></md-stepper>');
    const stepper = await page.find('md-stepper'); stepper.setProperty('stepWord', 'Etapa'); stepper.setProperty('errorWord', 'Invalid'); stepper.setProperty('nextLabel', 'Continue now'); stepper.setProperty('orientation', 'vertical'); await page.waitForChanges();
    const step = await page.find('md-step'); step.setProperty('errorText', 'Required field'); step.setProperty('error', true); await page.waitForChanges();
    await page.waitForFunction(() => document.querySelector('md-stepper')!.shadowRoot!.querySelector('[role="alert"]')!.textContent!.includes('Required field'));
    expect((await page.find('md-step')).getAttribute('data-next-label')).toBe('Continue now');
    expect((await page.find('md-stepper >>> [role="alert"]')).textContent).toContain('Etapa 1');
    await page.$eval('md-stepper', el => el.replaceChildren()); await page.waitForChanges();
    await stepper.callMethod('next'); await stepper.callMethod('prev'); await page.waitForChanges();
    expect(await page.find('md-step')).toBeNull();
  });
});
