import { newE2EPage } from '@stencil/core/testing';
import { exerciseSelectFiltering } from './test-utils/filtering.browser';

describe('md-select public dataset filtering', () => {
  it('filters row factories, commits once, rejects disabled options and clears the dataset', async () => {
    const page = await newE2EPage({ html: '<md-select label="Produce"></md-select>' });
    await page.evaluate(exerciseSelectFiltering);
  });
});
