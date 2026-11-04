import { newE2EPage } from '@stencil/core/testing';
import { exerciseTextEditing, exerciseTextSpeech } from './test-utils/editing.browser';

describe('md-text-field editing pipeline', () => {
  it('preserves raw values and caret positions through restriction, IME, formatting and multiline editing', async () => {
    const page = await newE2EPage({ html: '<md-text-field label="Reference"></md-text-field>' });
    await page.evaluate(exerciseTextEditing);
  });
});

describe('md-text-field SpeechEditingContract', () => {
  it('speech editing contract', async () => {
    const page = await newE2EPage({ html: '<md-text-field label="Form value"></md-text-field>' });
    await page.evaluate(exerciseTextSpeech);
  });
});
