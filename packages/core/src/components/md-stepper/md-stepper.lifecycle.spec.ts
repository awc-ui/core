import { newSpecPage } from '@stencil/core/testing';
import { MdStepper } from './md-stepper';
import { MdStep } from '../md-step/md-step';

describe('md-stepper public footer and child updates', () => {
  it.each(['standard', 'mobile'])('navigates the %s footer and updates localized child configuration', async variant => {
    const page = await newSpecPage({ components: [MdStepper, MdStep], html: `<md-stepper variant="${variant}" mode="non-linear"><md-step label="Account"></md-step><md-step label="Review"></md-step></md-stepper>` });
    const root = page.root as HTMLMdStepperElement;
    const buttons = root.shadowRoot!.querySelectorAll('md-button');
    expect(buttons.length).toBe(2);
    buttons[1].dispatchEvent(new MouseEvent('click')); await page.waitForChanges();
    expect(root.active).toBe(1);
    buttons[0].dispatchEvent(new MouseEvent('click')); await page.waitForChanges();
    expect(root.active).toBe(0);
    root.nextLabel = 'Weiter'; root.orientation = 'vertical'; root.lazy = true;
    await page.waitForChanges();
    const step = root.querySelector('md-step')!;
    expect(step.getAttribute('data-next-label')).toBe('Weiter');
    expect(step.getAttribute('data-orientation')).toBe('vertical');
    expect(step.getAttribute('data-lazy')).toBe('true');
    const leaked = jest.fn(); page.body.addEventListener('mdClick', leaked);
    root.dispatchEvent(new CustomEvent('mdClick', { bubbles: true }));
    expect(leaked).not.toHaveBeenCalled();
  });

  it('clamps the active step after a slot removal and preserves custom panel content', async () => {
    const page = await newSpecPage({ components: [MdStepper, MdStep], html: '<md-stepper active="1"><md-step label="A"><p>Panel A</p></md-step><md-step label="B">Panel B</md-step></md-stepper>' });
    const root = page.root as HTMLMdStepperElement;
    root.querySelectorAll('md-step')[1].remove();
    root.shadowRoot!.querySelector('slot:not([name])')!.dispatchEvent(new Event('slotchange'));
    await page.waitForChanges();
    expect(root.active).toBe(0);
    expect(root.querySelector('md-step')!.getAttribute('data-panel-mode')).toBe('step');
    root.remove(); await page.waitForChanges();
  });
});
