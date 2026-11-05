import { newE2EPage } from '@stencil/core/testing';
import { exerciseOptionData } from '../md-select/test-utils/filtering.browser';

describe('md-select-option live metadata', () => {
  it('announces every data change and disconnection while updating its parent projection', async () => {
    const page = await newE2EPage({ html: '<md-select label="Produce"><md-select-option value="a">Apple</md-select-option></md-select>' });
    await page.evaluate(exerciseOptionData);
  });
});
