import { newE2EPage } from '@stencil/core/testing';
import { exerciseSliderTransactions } from './test-utils/transactions.browser';

describe('md-slider browser transactions', () => {
  it.each(['range', 'vertical', 'form'] as const)('preserves the %s interaction and value contract', async scenario => {
    const page = await newE2EPage({ html: '<form><md-slider value="30" style="width:400px"></md-slider></form>' });
    await page.evaluate(exerciseSliderTransactions, undefined, scenario);
  });
});
