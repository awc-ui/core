/**
 * Axe (WCAG 2.1 A/AA) sweep + ARIA-contract checks for md-stepper / md-step.
 * The structure spans a shadow boundary — a `navigation` landmark wrapping an
 * `<ol>` of slotted `listitem`s each exposing a `button`-roled header — so these
 * sweeps guard that relationship across orientations, states and features.
 */
import { newSpecPage } from '@stencil/core/testing';
import { MdStepper } from './md-stepper';
import { MdStep } from '../md-step/md-step';
import { MdRipple } from '../md-ripple/md-ripple';
import { MdButton } from '../md-button/md-button';
import { runAxe, toHaveNoViolations } from '../md-accordion/test-utils/axe-spec';

expect.extend(toHaveNoViolations);

const COMPONENTS = [MdStepper, MdStep, MdRipple, MdButton];
const wrap = (inner: string) => `<body><h1>Page</h1><main>${inner}</main></body>`;

const STEPS = `
  <md-step label="Account" completed></md-step>
  <md-step label="Shipping" active></md-step>
  <md-step label="Payment"></md-step>
`;

describe('md-stepper · axe', () => {
  it('horizontal numbered (default) — no violations', async () => {
    const page = await newSpecPage({ components: COMPONENTS, html: `<md-stepper active="1">${STEPS}</md-stepper>` });
    expect(await runAxe(page, { wrap })).toHaveNoViolations();
  });

  it('vertical with content panels + actions — no violations', async () => {
    const page = await newSpecPage({
      components: COMPONENTS,
      html: `<md-stepper orientation="vertical" active="1">
               <md-step label="Account" completed><p>Body one</p></md-step>
               <md-step label="Shipping" active><p>Body two</p></md-step>
               <md-step label="Payment"><p>Body three</p></md-step>
             </md-stepper>`,
    });
    expect(await runAxe(page, { wrap })).toHaveNoViolations();
  });

  it('dot indicator — no violations', async () => {
    const page = await newSpecPage({
      components: COMPONENTS,
      html: `<md-stepper indicator="dot" active="1">${STEPS}</md-stepper>`,
    });
    expect(await runAxe(page, { wrap })).toHaveNoViolations();
  });

  it('linear with optional + editable + error steps — no violations', async () => {
    const page = await newSpecPage({
      components: COMPONENTS,
      html: `<md-stepper mode="linear" active="2">
               <md-step label="Account" completed editable></md-step>
               <md-step label="Shipping" optional completed></md-step>
               <md-step label="Payment" active error error-text="Card declined"></md-step>
             </md-stepper>`,
    });
    expect(await runAxe(page, { wrap })).toHaveNoViolations();
  });

  it('localized words — no violations', async () => {
    const page = await newSpecPage({
      components: COMPONENTS,
      html: `<md-stepper active="1" step-word="Schritt" of-word="von" optional-word="Optional">
               <md-step label="Konto" completed></md-step>
               <md-step label="Versand" active optional></md-step>
               <md-step label="Zahlung"></md-step>
             </md-stepper>`,
    });
    expect(await runAxe(page, { wrap })).toHaveNoViolations();
  });
});

describe('md-stepper · ARIA contract', () => {
  async function build(html: string) {
    const page = await newSpecPage({ components: COMPONENTS, html });
    return page.root!;
  }

  it('navigation landmark wrapping an ordered list', async () => {
    const root = await build(`<md-stepper label="Checkout">${STEPS}</md-stepper>`);
    expect(root.getAttribute('role')).toBe('navigation');
    expect(root.getAttribute('aria-label')).toBe('Checkout');
    expect(root.shadowRoot!.querySelector('ol')).not.toBeNull();
  });

  it('each step is a listitem with a button-roled header named "Step N of M…"', async () => {
    const root = await build(`<md-stepper active="1">${STEPS}</md-stepper>`);
    (Array.from(root.querySelectorAll('md-step')) as HTMLElement[]).forEach((s) => {
      expect(s.getAttribute('role')).toBe('listitem');
      const inner = s.shadowRoot!.querySelector('.md-step__inner')!;
      expect(inner.getAttribute('role')).toBe('button');
      expect(inner.getAttribute('aria-label')).toMatch(/^Step \d of \d/);
    });
  });

  it('only the active step carries aria-current="step"', async () => {
    const root = await build(`<md-stepper active="1">${STEPS}</md-stepper>`);
    expect((Array.from(root.querySelectorAll('md-step')) as HTMLElement[]).map((s) => s.getAttribute('aria-current')))
      .toEqual([null, 'step', null]);
  });

  it('decorative indicators are hidden from AT', async () => {
    const root = await build(`<md-stepper active="1">${STEPS}</md-stepper>`);
    const bubble = root.querySelector('md-step')!.shadowRoot!.querySelector('.md-step__bubble');
    expect(bubble!.getAttribute('aria-hidden')).toBe('true');
  });

  it('error step announces the error text in its name', async () => {
    const root = await build(
      `<md-stepper active="0"><md-step label="Pay" error error-text="Card declined"></md-step></md-stepper>`,
    );
    const inner = root.querySelector('md-step')!.shadowRoot!.querySelector('.md-step__inner')!;
    expect(inner.getAttribute('aria-label')).toContain('error: Card declined');
  });
});
