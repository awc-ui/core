import { newE2EPage } from '@stencil/core/testing';
import { exerciseServerValidation } from '../md-checkbox/test-utils/form-validation.browser';

describe('md-radio server validation in a native form', () => {
  it('keeps checks silent, reports the error with focus, and recovers after fieldset and server updates', async () => {
    const page = await newE2EPage();
    await page.setContent('<form><fieldset><button type="button">Outside control</button><md-radio data-form-contract name="entry" label="Form value" aria-label="Form value"></md-radio></fieldset></form>');
    await page.waitForChanges();
    await page.evaluate(exerciseServerValidation);
  });
});

