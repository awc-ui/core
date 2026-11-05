import { newE2EPage } from '@stencil/core/testing';
import { exerciseAutocompleteEditing, exerciseAutocompleteData } from './test-utils/editing.browser';

describe('md-autocomplete strict and free-solo editing', () => {
  it('preserves strict selection while filtering and manages constrained free-solo chips', async () => {
    const page = await newE2EPage({ html: '<md-autocomplete label="Produce"></md-autocomplete>' });
    await page.evaluate(exerciseAutocompleteEditing);
  });
});

describe('md-autocomplete DynamicDataContract', () => {
  it('dynamic data contract', async () => {
    const page = await newE2EPage({ html: '<md-autocomplete label="Form value"></md-autocomplete>' });
    await page.evaluate(exerciseAutocompleteData);
  });
});
