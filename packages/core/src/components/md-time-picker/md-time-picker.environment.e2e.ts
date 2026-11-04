import { newE2EPage } from '@stencil/core/testing';
import { exerciseTimeEnvironment } from './test-utils/environment.browser';

describe('md-time-picker modal and form browser contracts', () => {
  it.each(['focus', 'constraints', 'dial', 'initialization'] as const)('preserves the %s contract', async scenario => {
    const page = await newE2EPage({ html: '<form><button id="outside" type="button">Open picker</button><fieldset><md-time-picker label="Meeting" value="09:30"></md-time-picker></fieldset></form>' });
    await page.evaluate(exerciseTimeEnvironment, undefined, scenario);
  });
});
