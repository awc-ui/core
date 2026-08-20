import { newSpecPage } from '@stencil/core/testing';
import { MdStep } from './md-step';
import { MdRipple } from '../md-ripple/md-ripple';
import { MdButton } from '../md-button/md-button';

/**
 * Unit coverage for md-step rendered in isolation. The parent stepper pushes
 * layout / position / i18n via `data-*` attributes; we set those directly to
 * exercise the rendering branches without the orchestration layer.
 */
const create = (html: string) =>
  newSpecPage({ components: [MdStep, MdRipple, MdButton], html });

const data = (attrs: Record<string, string | number> = {}) =>
  Object.entries({
    'data-index': 0, 'data-total': 1, 'data-active': 0, 'data-position': 'first',
    'data-orientation': 'horizontal', 'data-indicator': 'numbered',
    'data-mode': 'non-linear', 'data-connector': 'line', ...attrs,
  })
    .map(([k, v]) => `${k}="${v}"`)
    .join(' ');

const bubbleText = (root: HTMLElement) =>
  root.shadowRoot!.querySelector('.md-step__bubble')?.textContent?.trim();
const glyph = (root: HTMLElement) =>
  root.shadowRoot!.querySelector('.md-step__bubble .material-symbols-outlined')?.textContent?.trim();
const innerLabel = (root: HTMLElement) =>
  root.shadowRoot!.querySelector('.md-step__inner')!.getAttribute('aria-label');

describe('md-step', () => {
  describe('indicator', () => {
    it('renders the 1-indexed number by default', async () => {
      const p = await create(`<md-step ${data({ 'data-index': 2, 'data-total': 4 })} label="x"></md-step>`);
      expect(bubbleText(p.root!)).toBe('3');
    });
    it('renders the completed-icon (check) when completed', async () => {
      const p = await create(`<md-step ${data()} label="x" completed></md-step>`);
      expect(glyph(p.root!)).toBe('check');
    });
    it('renders the edit (pencil) glyph when completed AND editable', async () => {
      const p = await create(`<md-step ${data()} label="x" completed editable></md-step>`);
      expect(glyph(p.root!)).toBe('edit');
    });
    it('renders the error glyph (overrides completed)', async () => {
      const p = await create(`<md-step ${data()} label="x" completed error></md-step>`);
      expect(glyph(p.root!)).toBe('priority_high');
    });
    it('renders a custom icon', async () => {
      const p = await create(`<md-step ${data()} label="x" icon="lock"></md-step>`);
      expect(glyph(p.root!)).toBe('lock');
    });
    it('renders a dot for the dot variant', async () => {
      const p = await create(`<md-step ${data({ 'data-indicator': 'dot' })} label="x"></md-step>`);
      expect(p.root!.shadowRoot!.querySelector('.md-step__dot')).not.toBeNull();
      expect(p.root!.shadowRoot!.querySelector('.md-step__bubble')).toBeNull();
    });
  });

  describe('text & optional & error', () => {
    it('shows the description as supporting text', async () => {
      const p = await create(`<md-step ${data()} label="A" description="hello"></md-step>`);
      expect(p.root!.shadowRoot!.querySelector('.md-step__description')?.textContent).toContain('hello');
    });
    it('shows an Optional caption (localized via data-optional-word)', async () => {
      const p = await create(`<md-step ${data({ 'data-optional-word': 'Optional' })} label="A" optional></md-step>`);
      expect(p.root!.shadowRoot!.querySelector('.md-step__optional')?.textContent?.trim()).toBe('Optional');
    });
    it('error-text overrides the description when in error', async () => {
      const p = await create(`<md-step ${data()} label="A" description="d" error error-text="Bad input"></md-step>`);
      expect(p.root!.shadowRoot!.querySelector('.md-step__description')?.textContent).toContain('Bad input');
    });
  });

  describe('accessible name', () => {
    it('composes "Step N of M: label"', async () => {
      const p = await create(`<md-step ${data({ 'data-index': 1, 'data-total': 3 })} label="Shipping"></md-step>`);
      expect(innerLabel(p.root!)).toBe('Step 2 of 3: Shipping');
    });
    it('includes optional / completed / current / error words', async () => {
      const p = await create(
        `<md-step ${data({ 'data-index': 0, 'data-total': 2 })} label="A" optional completed active error error-text="oops"></md-step>`,
      );
      expect(innerLabel(p.root!)).toBe('Step 1 of 2: A, optional, completed, current, error: oops');
    });
    it('honors localized words', async () => {
      const p = await create(
        `<md-step ${data({ 'data-index': 0, 'data-total': 2, 'data-step-word': 'Schritt', 'data-of-word': 'von' })} label="Konto"></md-step>`,
      );
      expect(innerLabel(p.root!)).toBe('Schritt 1 von 2: Konto');
    });
    it('accessible-name fully overrides', async () => {
      const p = await create(`<md-step ${data()} label="A" accessible-name="custom"></md-step>`);
      expect(innerLabel(p.root!)).toBe('custom');
    });
  });

  describe('linear reachability', () => {
    it('a future step in linear mode is disabled (not focusable)', async () => {
      const p = await create(
        `<div>
           <md-step ${data({ 'data-index': 0, 'data-total': 3, 'data-active': 0, 'data-mode': 'linear' })} label="A"></md-step>
           <md-step ${data({ 'data-index': 2, 'data-total': 3, 'data-active': 0, 'data-mode': 'linear' })} label="C" id="c"></md-step>
         </div>`,
      );
      const c = p.body.querySelector('#c') as HTMLElement;
      expect(c.shadowRoot!.querySelector('.md-step__inner')!.getAttribute('tabindex')).toBe('-1');
      expect(c.getAttribute('aria-disabled')).toBe('true');
    });
    it('a completed step is reachable in linear mode', async () => {
      const p = await create(
        `<md-step ${data({ 'data-index': 2, 'data-total': 3, 'data-active': 0, 'data-mode': 'linear' })} label="C" completed></md-step>`,
      );
      expect(p.root!.shadowRoot!.querySelector('.md-step__inner')!.getAttribute('tabindex')).toBe('0');
    });
    it('optional prior steps do not gate reachability (parity with the stepper)', async () => {
      // A(completed) → B(optional, untouched) → C must be reachable: the parent
      // stepper's canNavigateTo allows it, so the header affordance must agree.
      const p = await create(
        `<div>
           <md-step ${data({ 'data-index': 0, 'data-total': 3, 'data-active': 0, 'data-mode': 'linear' })} label="A" completed></md-step>
           <md-step ${data({ 'data-index': 1, 'data-total': 3, 'data-active': 0, 'data-mode': 'linear' })} label="B" optional></md-step>
           <md-step ${data({ 'data-index': 2, 'data-total': 3, 'data-active': 0, 'data-mode': 'linear' })} label="C" id="c"></md-step>
         </div>`,
      );
      const c = p.body.querySelector('#c') as HTMLElement;
      expect(c.shadowRoot!.querySelector('.md-step__inner')!.getAttribute('tabindex')).toBe('0');
      expect(c.getAttribute('aria-disabled')).toBeNull();
    });
  });

  describe('events', () => {
    it('emits mdStepClick with its index', async () => {
      const p = await create(`<md-step ${data({ 'data-index': 2, 'data-total': 4 })} label="C"></md-step>`);
      const spy = jest.fn();
      p.root!.addEventListener('mdStepClick', spy);
      (p.root!.shadowRoot!.querySelector('.md-step__inner') as HTMLElement).click();
      await p.waitForChanges();
      expect(spy.mock.calls[0][0].detail).toEqual({ index: 2 });
    });
    it('does not emit when disabled', async () => {
      const p = await create(`<md-step ${data()} label="C" disabled></md-step>`);
      const spy = jest.fn();
      p.root!.addEventListener('mdStepClick', spy);
      (p.root!.shadowRoot!.querySelector('.md-step__inner') as HTMLElement).click();
      await p.waitForChanges();
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('content panel (vertical)', () => {
    it('renders Back + Continue actions when active with content', async () => {
      const p = await create(
        `<md-step ${data({ 'data-index': 1, 'data-total': 3, 'data-position': 'middle', 'data-orientation': 'vertical' })} label="B" active><p>body</p></md-step>`,
      );
      const btns = p.root!.shadowRoot!.querySelectorAll('.md-step__actions md-button');
      expect(btns.length).toBe(2);
      expect(btns[0].textContent?.trim()).toBe('Back');
      expect(btns[1].textContent?.trim()).toBe('Continue');
    });
    it('disables Back on the first step (kept mounted — no reflow) and shows Finish on the last', async () => {
      const first = await create(
        `<md-step ${data({ 'data-position': 'first', 'data-orientation': 'vertical' })} label="A" active><p>x</p></md-step>`,
      );
      const fBtns = first.root!.shadowRoot!.querySelectorAll('.md-step__actions md-button') as NodeListOf<HTMLMdButtonElement>;
      expect(fBtns.length).toBe(2);
      expect(fBtns[0].textContent?.trim()).toBe('Back');
      expect(fBtns[0].disabled).toBe(true);
      expect(fBtns[1].textContent?.trim()).toBe('Continue');

      const last = await create(
        `<md-step ${data({ 'data-index': 2, 'data-total': 3, 'data-position': 'last', 'data-orientation': 'vertical', 'data-finish-label': 'Finish' })} label="C" active><p>x</p></md-step>`,
      );
      const lBtns = last.root!.shadowRoot!.querySelectorAll('.md-step__actions md-button');
      expect(lBtns[lBtns.length - 1].textContent?.trim()).toBe('Finish');
    });
    it('emits mdStepNext / mdStepBack from the actions', async () => {
      const p = await create(
        `<md-step ${data({ 'data-index': 1, 'data-total': 3, 'data-position': 'middle', 'data-orientation': 'vertical' })} label="B" active><p>x</p></md-step>`,
      );
      const next = jest.fn();
      const back = jest.fn();
      p.root!.addEventListener('mdStepNext', next);
      p.root!.addEventListener('mdStepBack', back);
      const btns = p.root!.shadowRoot!.querySelectorAll('.md-step__actions md-button');
      (btns[0] as HTMLElement).click(); // Back
      (btns[1] as HTMLElement).click(); // Continue
      await p.waitForChanges();
      expect(back).toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });
    it('hide-actions suppresses the built-in buttons', async () => {
      const p = await create(
        `<md-step ${data({ 'data-orientation': 'vertical' })} label="A" active hide-actions><p>x</p></md-step>`,
      );
      expect(p.root!.shadowRoot!.querySelector('.md-step__actions')).toBeNull();
    });
    it('renders actions even without slotted content (consistent nav)', async () => {
      const p = await create(
        `<md-step ${data({ 'data-orientation': 'vertical', 'data-nav': 'true', 'data-index': 1, 'data-total': 3, 'data-position': 'middle' })} label="A" active></md-step>`,
      );
      // middle step → Back + Continue, even with no slotted content
      expect(p.root!.shadowRoot!.querySelectorAll('.md-step__actions md-button').length).toBe(2);
    });
    it('data-nav="false" suppresses the actions', async () => {
      const p = await create(
        `<md-step ${data({ 'data-orientation': 'vertical', 'data-nav': 'false' })} label="A" active><p>x</p></md-step>`,
      );
      expect(p.root!.shadowRoot!.querySelector('.md-step__actions')).toBeNull();
    });
    it('keeps the panel in the tree when inactive (animatable), marked open only when active', async () => {
      const p = await create(
        `<md-step ${data({ 'data-orientation': 'vertical', 'data-index': 1, 'data-total': 3, 'data-position': 'middle', 'data-active': 0 })} label="B"><p>x</p></md-step>`,
      );
      const content = p.root!.shadowRoot!.querySelector('.md-step__content');
      expect(content).not.toBeNull();
      expect(content!.classList.contains('md-step__content--open')).toBe(false);

      (p.root! as HTMLMdStepElement).active = true;
      await p.waitForChanges();
      expect(
        p.root!.shadowRoot!.querySelector('.md-step__content')!.classList.contains('md-step__content--open'),
      ).toBe(true);
    });
    it('whitespace-only light DOM does not count as content (no empty panel)', async () => {
      const p = await create(
        `<md-step ${data({ 'data-orientation': 'vertical', 'data-nav': 'false' })} label="A" active>
         </md-step>`,
      );
      expect(p.root!.shadowRoot!.querySelector('.md-step__content')).toBeNull();
    });
    it('horizontal steps render NO content panel — slotted content is not composed', async () => {
      // Documented API trap: horizontal content belongs in the stepper's
      // `content` slot, not inside md-step.
      const p = await create(
        `<md-step ${data({ 'data-orientation': 'horizontal' })} label="A" active><p>dropped</p></md-step>`,
      );
      expect(p.root!.shadowRoot!.querySelector('.md-step__content')).toBeNull();
      expect(p.root!.shadowRoot!.querySelector('slot:not([name])')).toBeNull();
    });
  });
});
