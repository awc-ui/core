import { newSpecPage } from '@stencil/core/testing';
import { MdStepper } from './md-stepper';
import { MdStep } from '../md-step/md-step';
import { MdRipple } from '../md-ripple/md-ripple';
import { MdButton } from '../md-button/md-button';

const create = (html: string) =>
  newSpecPage({ components: [MdStepper, MdStep, MdRipple, MdButton], html });

const STEPS = `
  <md-step label="One"></md-step>
  <md-step label="Two"></md-step>
  <md-step label="Three"></md-step>
`;
const steps = (root: HTMLElement) => Array.from(root.querySelectorAll('md-step')) as HTMLMdStepElement[];

/** Dispatch a step event the way a real md-step does: bubbling from the child
 *  (the stepper only honors events from its own direct md-step children). */
function stepEvent(p: { root?: HTMLElement }, name: string, index: number) {
  const step = p.root!.querySelectorAll('md-step')[index] as HTMLElement;
  step.dispatchEvent(new CustomEvent(name, { detail: { index }, bubbles: true }));
}

describe('md-stepper', () => {
  describe('landmark + sync', () => {
    it('is a navigation landmark with a label', async () => {
      const p = await create(`<md-stepper label="Checkout">${STEPS}</md-stepper>`);
      expect(p.root!.getAttribute('role')).toBe('navigation');
      expect(p.root!.getAttribute('aria-label')).toBe('Checkout');
      expect(p.root!.shadowRoot!.querySelector('ol')).not.toBeNull();
    });
    it('stamps index / total / position / active onto each step', async () => {
      const p = await create(`<md-stepper active="1">${STEPS}</md-stepper>`);
      const s = steps(p.root!);
      expect(s.map((x) => x.getAttribute('data-index'))).toEqual(['0', '1', '2']);
      expect(s.every((x) => x.getAttribute('data-total') === '3')).toBe(true);
      expect(s.every((x) => x.getAttribute('data-active') === '1')).toBe(true);
      expect(s.map((x) => x.getAttribute('data-position'))).toEqual(['first', 'middle', 'last']);
      expect(s.map((x) => x.active)).toEqual([false, true, false]);
    });
    it('propagates orientation / indicator / mode + i18n', async () => {
      const p = await create(
        `<md-stepper orientation="vertical" indicator="dot" mode="non-linear" step-word="Schritt" next-label="Weiter">${STEPS}</md-stepper>`,
      );
      const f = steps(p.root!)[0];
      expect(f.getAttribute('data-orientation')).toBe('vertical');
      expect(f.getAttribute('data-indicator')).toBe('dot');
      expect(f.getAttribute('data-step-word')).toBe('Schritt');
      expect(f.getAttribute('data-next-label')).toBe('Weiter');
    });
    it('stamps the staggered-entrance index onto each step', async () => {
      const p = await create(`<md-stepper active="0">${STEPS}</md-stepper>`);
      expect(steps(p.root!).map((s) => s.style.getPropertyValue('--md-step-idx'))).toEqual(['0', '1', '2']);
    });
    it('renders the horizontal content slot', async () => {
      const p = await create(
        `<md-stepper active="0">${STEPS}<div slot="content" id="panel">Cart contents</div></md-stepper>`,
      );
      expect(p.root!.shadowRoot!.querySelector('slot[name="content"]')).not.toBeNull();
      expect(p.root!.querySelector('#panel')).not.toBeNull();
    });
  });

  describe('initial active clamping', () => {
    it('clamps an out-of-range initial active to the last step', async () => {
      const p = await create(`<md-stepper active="5">${STEPS}</md-stepper>`);
      expect(p.root!.active).toBe(2);
      expect(steps(p.root!).map((s) => s.active)).toEqual([false, false, true]);
      expect(steps(p.root!).every((s) => s.getAttribute('data-active') === '2')).toBe(true);
    });
    it('clamps a negative initial active to 0', async () => {
      const p = await create(`<md-stepper active="-1">${STEPS}</md-stepper>`);
      expect(p.root!.active).toBe(0);
      expect(steps(p.root!)[0].active).toBe(true);
    });
    it('clamps runtime out-of-range assignment and emits the true previous', async () => {
      const p = await create(`<md-stepper mode="non-linear" active="0">${STEPS}</md-stepper>`);
      const spy = jest.fn();
      p.root!.addEventListener('mdStepChange', spy);
      p.root!.active = 99;
      await p.waitForChanges();
      expect(p.root!.active).toBe(2);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0].detail).toEqual({ index: 2, previous: 0 });
    });
    it('a clamp round-trip back to the same index emits nothing', async () => {
      const p = await create(`<md-stepper active="2">${STEPS}</md-stepper>`);
      const spy = jest.fn();
      p.root!.addEventListener('mdStepChange', spy);
      p.root!.active = 99; // clamps straight back to 2
      await p.waitForChanges();
      expect(p.root!.active).toBe(2);
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('next / auto-complete / mdComplete', () => {
    it('next() advances and marks the left step completed (auto-complete on)', async () => {
      const p = await create(`<md-stepper active="0">${STEPS}</md-stepper>`);
      await p.root!.next();
      await p.waitForChanges();
      expect(p.root!.active).toBe(1);
      expect(steps(p.root!)[0].completed).toBe(true);
    });
    it('auto-complete="false" does not write completed', async () => {
      const p = await create(`<md-stepper active="0" auto-complete="false">${STEPS}</md-stepper>`);
      await p.root!.next();
      await p.waitForChanges();
      expect(p.root!.active).toBe(1);
      expect(steps(p.root!)[0].completed).toBe(false);
    });
    it('auto-complete: going back un-completes the steps from the new active onward', async () => {
      const p = await create(`<md-stepper active="0">${STEPS}</md-stepper>`);
      await p.root!.next(); // completes 0, active 1
      await p.root!.next(); // completes 1, active 2
      await p.waitForChanges();
      expect(steps(p.root!).map((s) => s.completed)).toEqual([true, true, false]);
      await p.root!.prev(); // back to 1
      await p.waitForChanges();
      expect(steps(p.root!).map((s) => s.completed)).toEqual([true, false, false]);
      await p.root!.prev(); // back to 0
      await p.waitForChanges();
      expect(steps(p.root!).map((s) => s.completed)).toEqual([false, false, false]);
    });
    it('auto-complete="false": going back keeps completed', async () => {
      const p = await create(
        `<md-stepper active="2" auto-complete="false"><md-step label="A" completed></md-step><md-step label="B" completed></md-step><md-step label="C"></md-step></md-stepper>`,
      );
      await p.root!.prev();
      await p.waitForChanges();
      expect(steps(p.root!).map((s) => s.completed)).toEqual([true, true, false]);
    });
    it('revisiting an editable completed step preserves downstream completion', async () => {
      const p = await create(
        `<md-stepper mode="linear" active="2"><md-step label="A" completed editable></md-step><md-step label="B" completed></md-step><md-step label="C"></md-step></md-stepper>`,
      );
      stepEvent(p, 'mdStepClick', 0);
      await p.waitForChanges();
      expect(p.root!.active).toBe(0);
      // review/edit-in-place: nothing is un-completed
      expect(steps(p.root!).map((s) => s.completed)).toEqual([true, true, false]);
    });
    it('finishing the flow then stepping back leaves no completed step ahead of the active one', async () => {
      const p = await create(`<md-stepper active="0">${STEPS}</md-stepper>`); // 3 steps
      await p.root!.next(); // complete 0 → active 1
      await p.root!.next(); // complete 1 → active 2 (last)
      await p.root!.next(); // complete 2 → mdComplete, stays on 2
      await p.waitForChanges();
      expect(steps(p.root!).map((s) => s.completed)).toEqual([true, true, true]);
      await p.root!.prev(); // back to 1 — step 2 must NOT stay orphaned as completed
      await p.waitForChanges();
      expect(steps(p.root!).map((s) => s.completed)).toEqual([true, false, false]);
      await p.root!.prev(); // back to 0
      await p.waitForChanges();
      expect(steps(p.root!).map((s) => s.completed)).toEqual([false, false, false]);
      // invariant: no step at or after `active` is completed
      const active = p.root!.active;
      steps(p.root!).forEach((s, i) => {
        if (i >= active) expect(s.completed).toBe(false);
      });
    });
    it('jumping back several steps at once un-completes everything from the target onward', async () => {
      const p = await create(
        `<md-stepper mode="non-linear" active="3"><md-step label="A" completed></md-step><md-step label="B" completed></md-step><md-step label="C" completed></md-step><md-step label="D" completed></md-step></md-stepper>`,
      );
      await p.root!.goTo(1); // jump back 3→1
      await p.waitForChanges();
      // step 1 (target) and everything after it clears; step 0 stays done
      expect(steps(p.root!).map((s) => s.completed)).toEqual([true, false, false, false]);
    });
    it('next() on the last step emits mdComplete (and stays)', async () => {
      const p = await create(`<md-stepper active="2">${STEPS}</md-stepper>`);
      const spy = jest.fn();
      p.root!.addEventListener('mdComplete', spy);
      await p.root!.next();
      await p.waitForChanges();
      expect(spy).toHaveBeenCalledTimes(1);
      expect(p.root!.active).toBe(2);
      expect(steps(p.root!)[2].completed).toBe(true);
    });
    it('next() skips disabled steps (and completes past a disabled tail)', async () => {
      const p = await create(
        `<md-stepper active="0"><md-step label="A"></md-step><md-step label="B" disabled></md-step><md-step label="C"></md-step></md-stepper>`,
      );
      await p.root!.next();
      await p.waitForChanges();
      expect(p.root!.active).toBe(2); // hopped over the disabled step

      const q = await create(
        `<md-stepper active="0"><md-step label="A"></md-step><md-step label="B" disabled></md-step></md-stepper>`,
      );
      const done = jest.fn();
      q.root!.addEventListener('mdComplete', done);
      await q.root!.next();
      await q.waitForChanges();
      expect(q.root!.active).toBe(0); // nowhere to go
      expect(done).toHaveBeenCalledTimes(1);
    });
  });

  describe('prev / goTo / reset', () => {
    it('prev() steps back and clamps at 0', async () => {
      const p = await create(`<md-stepper active="1">${STEPS}</md-stepper>`);
      await p.root!.prev();
      await p.waitForChanges();
      expect(p.root!.active).toBe(0);
      await p.root!.prev();
      expect(p.root!.active).toBe(0);
    });
    it('prev() skips disabled steps', async () => {
      const p = await create(
        `<md-stepper mode="non-linear" active="2"><md-step label="A"></md-step><md-step label="B" disabled></md-step><md-step label="C"></md-step></md-stepper>`,
      );
      await p.root!.prev();
      await p.waitForChanges();
      expect(p.root!.active).toBe(0);
    });
    it('goTo() respects linear reachability (blocks unreachable forward)', async () => {
      const p = await create(`<md-stepper mode="linear" active="0">${STEPS}</md-stepper>`);
      await p.root!.goTo(2);
      await p.waitForChanges();
      expect(p.root!.active).toBe(0); // blocked
    });
    it('goTo() allows any step in non-linear', async () => {
      const p = await create(`<md-stepper mode="non-linear" active="0">${STEPS}</md-stepper>`);
      await p.root!.goTo(2);
      await p.waitForChanges();
      expect(p.root!.active).toBe(2);
    });
    it('goTo() clamps out-of-range input', async () => {
      const p = await create(`<md-stepper mode="non-linear" active="0">${STEPS}</md-stepper>`);
      await p.root!.goTo(99);
      await p.waitForChanges();
      expect(p.root!.active).toBe(2);
    });
    it('goTo() refuses a disabled step (even in non-linear)', async () => {
      const p = await create(
        `<md-stepper mode="non-linear" active="0"><md-step label="A"></md-step><md-step label="B" disabled></md-step><md-step label="C"></md-step></md-stepper>`,
      );
      await p.root!.goTo(1);
      await p.waitForChanges();
      expect(p.root!.active).toBe(0);
    });
    it('reset() returns to 0 and clears completed/error', async () => {
      const p = await create(
        `<md-stepper active="2"><md-step label="A" completed></md-step><md-step label="B" completed></md-step><md-step label="C" error></md-step></md-stepper>`,
      );
      await p.root!.reset();
      await p.waitForChanges();
      expect(p.root!.active).toBe(0);
      expect(steps(p.root!).every((s) => !s.completed && !s.error)).toBe(true);
    });
  });

  describe('mdStepChange + click gating', () => {
    it('emits new + previous index', async () => {
      const p = await create(`<md-stepper active="0">${STEPS}</md-stepper>`);
      const spy = jest.fn();
      p.root!.addEventListener('mdStepChange', spy);
      p.root!.active = 2;
      await p.waitForChanges();
      expect(spy.mock.calls[0][0].detail).toEqual({ index: 2, previous: 0 });
    });
    it('linear: blocks forward click when prior not completed', async () => {
      const p = await create(`<md-stepper mode="linear" active="0">${STEPS}</md-stepper>`);
      stepEvent(p, 'mdStepClick', 2);
      await p.waitForChanges();
      expect(p.root!.active).toBe(0);
    });
    it('linear: allows forward click when prior completed', async () => {
      const p = await create(
        `<md-stepper mode="linear" active="0"><md-step label="A" completed></md-step><md-step label="B" completed></md-step><md-step label="C"></md-step></md-stepper>`,
      );
      stepEvent(p, 'mdStepClick', 2);
      await p.waitForChanges();
      expect(p.root!.active).toBe(2);
    });
    it('linear: optional prior step does not block forward', async () => {
      const p = await create(
        `<md-stepper mode="linear" active="0"><md-step label="A" completed></md-step><md-step label="B" optional></md-step><md-step label="C"></md-step></md-stepper>`,
      );
      stepEvent(p, 'mdStepClick', 2);
      await p.waitForChanges();
      expect(p.root!.active).toBe(2);
    });
    it('linear: a completed step can be revisited (editable wizard)', async () => {
      const p = await create(
        `<md-stepper mode="linear" active="2"><md-step label="A" completed editable></md-step><md-step label="B" completed></md-step><md-step label="C"></md-step></md-stepper>`,
      );
      stepEvent(p, 'mdStepClick', 0);
      await p.waitForChanges();
      expect(p.root!.active).toBe(0);
    });
    it('ignores step events that did not come from a direct md-step child', async () => {
      const p = await create(`<md-stepper mode="non-linear" active="0">${STEPS}</md-stepper>`);
      // e.g. a nested stepper's event bubbling through — target is not our child
      p.root!.dispatchEvent(new CustomEvent('mdStepClick', { detail: { index: 2 }, bubbles: true }));
      await p.waitForChanges();
      expect(p.root!.active).toBe(0);
    });
    it('consumes owned step events (stopPropagation) so ancestors never see them', async () => {
      const p = await create(`<md-stepper mode="non-linear" active="0">${STEPS}</md-stepper>`);
      const outer = jest.fn();
      p.doc.addEventListener('mdStepClick', outer);
      stepEvent(p, 'mdStepClick', 2);
      await p.waitForChanges();
      expect(p.root!.active).toBe(2);
      expect(outer).not.toHaveBeenCalled();
    });
  });

  describe('built-in actions', () => {
    it('mdStepNext advances; mdStepBack goes back', async () => {
      const p = await create(`<md-stepper active="1">${STEPS}</md-stepper>`);
      stepEvent(p, 'mdStepNext', 1);
      await p.waitForChanges();
      expect(p.root!.active).toBe(2);
      stepEvent(p, 'mdStepBack', 2);
      await p.waitForChanges();
      expect(p.root!.active).toBe(1);
    });
  });

  describe('built-in nav', () => {
    it('pushes data-nav to steps; default on', async () => {
      const p = await create(`<md-stepper active="0">${STEPS}</md-stepper>`);
      expect(steps(p.root!).every((s) => s.getAttribute('data-nav') === 'true')).toBe(true);
    });
    it('horizontal renders a footer Back/Continue bar (Back disabled on first, no reflow)', async () => {
      const p = await create(`<md-stepper active="0">${STEPS}</md-stepper>`);
      const btns = () =>
        Array.from(p.root!.shadowRoot!.querySelectorAll('.md-stepper__nav md-button')) as HTMLMdButtonElement[];
      expect(btns().length).toBe(2); // Back stays mounted so the bar never shifts
      expect(btns()[0].textContent?.trim()).toBe('Back');
      expect(btns()[0].disabled).toBe(true);
      expect(btns()[1].textContent?.trim()).toBe('Continue');

      p.root!.active = 1;
      await p.waitForChanges();
      expect(btns()[0].disabled).toBe(false);
    });
    it('horizontal footer shows Finish on the last step', async () => {
      const p = await create(`<md-stepper active="2">${STEPS}</md-stepper>`);
      const btns = p.root!.shadowRoot!.querySelectorAll('.md-stepper__nav md-button');
      expect(btns[btns.length - 1].textContent?.trim()).toBe('Finish');
    });
    it('footer nav renders localized labels', async () => {
      const p = await create(
        `<md-stepper active="1" back-label="Zurück" next-label="Weiter" finish-label="Fertig">${STEPS}</md-stepper>`,
      );
      const btns = () => p.root!.shadowRoot!.querySelectorAll('.md-stepper__nav md-button');
      expect(btns()[0].textContent?.trim()).toBe('Zurück');
      expect(btns()[1].textContent?.trim()).toBe('Weiter');
      p.root!.active = 2;
      await p.waitForChanges();
      expect(btns()[1].textContent?.trim()).toBe('Fertig');
    });
    it('nav="false" renders no footer bar and pushes data-nav=false', async () => {
      const p = await create(`<md-stepper active="0" nav="false">${STEPS}</md-stepper>`);
      expect(p.root!.shadowRoot!.querySelector('.md-stepper__nav')).toBeNull();
      expect(steps(p.root!)[0].getAttribute('data-nav')).toBe('false');
    });
    it('vertical does NOT render the footer bar (nav lives in step panels)', async () => {
      const p = await create(`<md-stepper orientation="vertical" active="0">${STEPS}</md-stepper>`);
      expect(p.root!.shadowRoot!.querySelector('.md-stepper__nav')).toBeNull();
    });
  });

  describe('mdBeforeChange (validation veto)', () => {
    it('fires before a user-driven change with { index, previous } and commits when not vetoed', async () => {
      const p = await create(`<md-stepper mode="non-linear" active="0">${STEPS}</md-stepper>`);
      const spy = jest.fn();
      p.root!.addEventListener('mdBeforeChange', spy);
      stepEvent(p, 'mdStepClick', 2);
      await p.waitForChanges();
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0].detail).toEqual({ index: 2, previous: 0 });
      expect(p.root!.active).toBe(2);
    });
    it('preventDefault() vetoes the change (next / click / goTo all blocked)', async () => {
      const p = await create(`<md-stepper mode="non-linear" active="0">${STEPS}</md-stepper>`);
      const changed = jest.fn();
      p.root!.addEventListener('mdBeforeChange', (e) => e.preventDefault());
      p.root!.addEventListener('mdStepChange', changed);
      await p.root!.next();
      await p.waitForChanges();
      expect(p.root!.active).toBe(0);
      stepEvent(p, 'mdStepClick', 2);
      await p.waitForChanges();
      expect(p.root!.active).toBe(0);
      await p.root!.goTo(2);
      await p.waitForChanges();
      expect(p.root!.active).toBe(0);
      expect(changed).not.toHaveBeenCalled();
      // vetoed advance must NOT auto-complete the current step
      expect(steps(p.root!)[0].completed).toBe(false);
    });
    it('a direct `active` assignment bypasses the veto (authoritative commit) but still auto-completes forward', async () => {
      const p = await create(`<md-stepper mode="non-linear" active="0">${STEPS}</md-stepper>`);
      const before = jest.fn();
      p.root!.addEventListener('mdBeforeChange', (e) => { before(); e.preventDefault(); });
      p.root!.active = 2; // async-veto bypass pattern: commit directly
      await p.waitForChanges();
      expect(before).not.toHaveBeenCalled();
      expect(p.root!.active).toBe(2);
      // forward auto-complete lives in the watch, so steps passed over are completed
      expect(steps(p.root!).map((s) => s.completed)).toEqual([true, true, false]);
    });
  });

  describe('loading / next-disabled forwarding', () => {
    it('next-disabled disables the footer Continue but not Back', async () => {
      const p = await create(`<md-stepper active="1" next-disabled>${STEPS}</md-stepper>`);
      const btns = p.root!.shadowRoot!.querySelectorAll('.md-stepper__nav md-button') as NodeListOf<HTMLMdButtonElement>;
      expect(btns[0].disabled).toBe(false); // Back
      expect(btns[1].disabled).toBe(true); // Continue
      expect(steps(p.root!)[1].getAttribute('data-next-disabled')).toBe('true');
    });
    it('loading puts Continue in loading + disables both footer buttons', async () => {
      const p = await create(`<md-stepper active="1" loading>${STEPS}</md-stepper>`);
      const btns = p.root!.shadowRoot!.querySelectorAll('.md-stepper__nav md-button') as NodeListOf<HTMLMdButtonElement>;
      expect(btns[1].loading).toBe(true);
      expect(btns[1].disabled).toBe(true);
      expect(btns[0].disabled).toBe(true); // Back disabled while loading
      expect(steps(p.root!)[1].getAttribute('data-loading')).toBe('true');
    });
    it('vertical step Continue reflects data-loading / data-next-disabled', async () => {
      const p = await create(
        `<md-stepper orientation="vertical" active="0" loading next-disabled><md-step label="A"><p>x</p></md-step><md-step label="B"><p>y</p></md-step></md-stepper>`,
      );
      const btns = steps(p.root!)[0].shadowRoot!.querySelectorAll('.md-step__actions md-button') as NodeListOf<HTMLMdButtonElement>;
      const cont = btns[btns.length - 1];
      expect(cont.loading).toBe(true);
      expect(cont.disabled).toBe(true);
    });
  });

  describe('mobile variant', () => {
    it('hides the step row and renders a compact bar with Back / progress / Continue', async () => {
      const p = await create(`<md-stepper variant="mobile" active="1">${STEPS}</md-stepper>`);
      expect(p.root!.classList.contains('md-stepper--mobile')).toBe(true);
      expect(p.root!.shadowRoot!.querySelector('.md-stepper__nav')).toBeNull(); // default footer replaced
      const bar = p.root!.shadowRoot!.querySelector('.md-stepper__mobile')!;
      expect(bar).not.toBeNull();
      const btns = bar.querySelectorAll('md-button');
      expect(btns.length).toBe(2);
      expect(btns[0].textContent?.trim()).toBe('Back');
      expect(btns[1].textContent?.trim()).toBe('Continue');
    });
    it('numbered mobile shows a "Step N of M" caption', async () => {
      const p = await create(`<md-stepper variant="mobile" active="1">${STEPS}</md-stepper>`);
      expect(p.root!.shadowRoot!.querySelector('.md-stepper__mobile-text')!.textContent).toBe('Step 2 of 3');
    });
    it('dot mobile shows one dot per step with the active + done ones marked', async () => {
      const p = await create(
        `<md-stepper variant="mobile" indicator="dot" active="1"><md-step label="A" completed></md-step><md-step label="B"></md-step><md-step label="C"></md-step></md-stepper>`,
      );
      const dots = p.root!.shadowRoot!.querySelectorAll('.md-stepper__mobile-dot');
      expect(dots.length).toBe(3);
      expect(dots[0].classList.contains('is-done')).toBe(true);
      expect(dots[1].classList.contains('is-active')).toBe(true);
      expect(dots[2].classList.contains('is-active') || dots[2].classList.contains('is-done')).toBe(false);
    });
    it('mobile Continue shows Finish on the last step and still forwards loading/next-disabled', async () => {
      const p = await create(`<md-stepper variant="mobile" active="2" loading>${STEPS}</md-stepper>`);
      const btns = p.root!.shadowRoot!.querySelectorAll('.md-stepper__mobile md-button') as NodeListOf<HTMLMdButtonElement>;
      expect(btns[1].textContent?.trim()).toBe('Finish');
      expect(btns[1].loading).toBe(true);
      expect(btns[0].disabled).toBe(true); // Back disabled while loading
    });
  });

  describe('lazy panels', () => {
    it('mounts only the active step\'s content panel', async () => {
      const p = await create(
        `<md-stepper orientation="vertical" active="0" lazy><md-step label="A"><p>a</p></md-step><md-step label="B"><p>b</p></md-step></md-stepper>`,
      );
      const panels = () => steps(p.root!).map((s) => !!s.shadowRoot!.querySelector('.md-step__content'));
      expect(panels()).toEqual([true, false]); // only active mounted
      p.root!.active = 1;
      await p.waitForChanges();
      expect(panels()).toEqual([false, true]); // swapped
    });
    it('without lazy, all vertical panels stay mounted (for the collapse animation)', async () => {
      const p = await create(
        `<md-stepper orientation="vertical" active="0"><md-step label="A"><p>a</p></md-step><md-step label="B"><p>b</p></md-step></md-stepper>`,
      );
      expect(steps(p.root!).every((s) => !!s.shadowRoot!.querySelector('.md-step__content'))).toBe(true);
    });
  });

  describe('a11y live announcer', () => {
    it('announces the active step politely on change', async () => {
      const p = await create(`<md-stepper mode="non-linear" active="0">${STEPS}</md-stepper>`);
      p.root!.active = 1;
      await p.waitForChanges();
      const live = p.root!.shadowRoot!.querySelector('.md-stepper__live[role="status"]')!;
      expect(live.textContent).toBe('Step 2 of 3: Two, current');
    });
    it('uses localized words in the announcement', async () => {
      const p = await create(
        `<md-stepper mode="non-linear" active="0" step-word="Schritt" of-word="von" current-word="aktuell">${STEPS}</md-stepper>`,
      );
      p.root!.active = 1;
      await p.waitForChanges();
      expect(p.root!.shadowRoot!.querySelector('.md-stepper__live[role="status"]')!.textContent).toBe(
        'Schritt 2 von 3: Two, aktuell',
      );
    });
    it('renders both a polite status and an assertive alert region', async () => {
      const p = await create(`<md-stepper active="0">${STEPS}</md-stepper>`);
      expect(p.root!.shadowRoot!.querySelector('.md-stepper__live[role="status"][aria-live="polite"]')).not.toBeNull();
      expect(p.root!.shadowRoot!.querySelector('.md-stepper__live[role="alert"][aria-live="assertive"]')).not.toBeNull();
    });
  });
});
