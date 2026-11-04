import { newE2EPage } from '@stencil/core/testing';
import { exerciseTimeEditing } from './test-utils/editing.browser';

describe('md-time-picker editing contract', () => {
  it('wraps hour/minute steps, rejects invalid drafts, preserves cancellation and validates overnight ranges', async () => {
    const page = await newE2EPage({ html: '<md-time-picker label="Meeting time"></md-time-picker>' });
    await page.evaluate(exerciseTimeEditing);
  });
});
