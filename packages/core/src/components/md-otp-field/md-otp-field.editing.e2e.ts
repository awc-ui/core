import { newE2EPage } from '@stencil/core/testing';
import { exerciseOtpEditing, exerciseOtpPaste } from './test-utils/editing.browser';

describe('md-otp-field editing contracts', () => {
  it('edits contiguous cells, moves focus and blocks readonly/disabled edits', async () => {
    const page = await newE2EPage({ html: '<md-otp-field label="Verification code"></md-otp-field>' });
    await page.evaluate(exerciseOtpEditing);
  });
  it('normalizes paste and SMS autofill with exact completion and retry events', async () => {
    const page = await newE2EPage({ html: '<md-otp-field label="Verification code"></md-otp-field>' });
    await page.evaluate(exerciseOtpPaste);
  });
});
