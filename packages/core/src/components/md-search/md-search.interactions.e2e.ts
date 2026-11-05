import { newE2EPage } from '@stencil/core/testing';
import { exerciseSearchQueries, exerciseSearchVoice, exerciseSearchExternalTrigger } from './test-utils/interactions.browser';

describe('md-search query and voice contracts', () => {
  it('debounces distinct queries, submits immediately, navigates results and preserves consumer actions', async () => {
    const page = await newE2EPage({ html: '<md-search input-aria-label="Search products"></md-search>' });
    await page.evaluate(exerciseSearchQueries);
  });
  it('streams and retries recognition through a controlled Web Speech platform adapter', async () => {
    const page = await newE2EPage({ html: '<md-search input-aria-label="Search products"></md-search>' });
    await page.evaluate(exerciseSearchVoice);
  });
});

describe('md-search consumer trigger lifecycle', () => {
 it('transfers external trigger ownership, focus and dismissal policy without leaking the scroll lock', async () => {
 const page = await newE2EPage({ html: '<md-search label="Search catalogue"></md-search>' });
 await page.evaluate(exerciseSearchExternalTrigger);
 });
});
