import { newE2EPage, E2EPage } from '@stencil/core/testing';

/**
 * Interaction coverage for md-stepper / md-step in a real browser: click +
 * keyboard navigation, linear gating, editable revisit, the next/prev/goTo/reset
 * methods, auto-complete, the built-in content-panel actions, and mdComplete.
 */
describe('md-stepper interaction', () => {
  const H = (attrs = '') => `
    <md-stepper id="sp" ${attrs}>
      <md-step label="One"></md-step>
      <md-step label="Two"></md-step>
      <md-step label="Three"></md-step>
    </md-stepper>`;

  const active = (page: E2EPage) => page.evaluate(() => (document.getElementById('sp') as any).active);
  const completed = (page: E2EPage) =>
    page.evaluate(() => Array.from(document.querySelectorAll('#sp md-step')).map((s) => (s as any).completed));

  async function clickStep(page: E2EPage, i: number) {
    await page.evaluate((idx: number) => {
      const step = document.querySelectorAll('#sp md-step')[idx] as HTMLElement;
      (step.shadowRoot!.querySelector('.md-step__inner') as HTMLElement).click();
    }, i);
    await page.waitForChanges();
  }
  async function focusStep(page: E2EPage, i: number) {
    await page.evaluate((idx: number) => {
      const step = document.querySelectorAll('#sp md-step')[idx] as HTMLElement;
      (step.shadowRoot!.querySelector('.md-step__inner') as HTMLElement).focus();
    }, i);
  }

  it('non-linear: clicking a step activates it + fires mdStepChange', async () => {
    const page = await newE2EPage();
    await page.setContent(H('mode="non-linear" active="0"'));
    const changed = await page.spyOnEvent('mdStepChange');
    await clickStep(page, 2);
    expect(await active(page)).toBe(2);
    expect(changed).toHaveReceivedEventDetail({ index: 2, previous: 0 });
  }, 60000);

  it('keyboard: Enter / Space activate a focused step', async () => {
    const page = await newE2EPage();
    await page.setContent(H('mode="non-linear" active="0"'));
    await focusStep(page, 1);
    await page.keyboard.press('Enter');
    await page.waitForChanges();
    expect(await active(page)).toBe(1);
    await focusStep(page, 2);
    await page.keyboard.press(' ');
    await page.waitForChanges();
    expect(await active(page)).toBe(2);
  }, 60000);

  it('linear: forward click is blocked until prior steps are completed', async () => {
    const page = await newE2EPage();
    await page.setContent(H('mode="linear" active="0"'));
    await clickStep(page, 2);
    expect(await active(page)).toBe(0); // blocked
  }, 60000);

  it('next() advances and auto-completes the step it leaves (fills the connector)', async () => {
    const page = await newE2EPage();
    await page.setContent(H('active="0"'));
    await (await page.find('#sp')).callMethod('next');
    await page.waitForChanges();
    expect(await active(page)).toBe(1);
    expect((await completed(page))[0]).toBe(true);
  }, 60000);

  it('auto-complete="false" leaves completed untouched on next()', async () => {
    const page = await newE2EPage();
    await page.setContent(H('active="0" auto-complete="false"'));
    await (await page.find('#sp')).callMethod('next');
    await page.waitForChanges();
    expect((await completed(page))[0]).toBe(false);
  }, 60000);

  it('prev / goTo / reset behave (with linear gating + clearing)', async () => {
    const page = await newE2EPage();
    await page.setContent(H('mode="non-linear" active="0"'));
    const sp = await page.find('#sp');
    await sp.callMethod('goTo', 2);
    await page.waitForChanges();
    expect(await active(page)).toBe(2);
    await sp.callMethod('prev');
    await page.waitForChanges();
    expect(await active(page)).toBe(1);
    await sp.callMethod('next'); // completes 1, advances to 2
    await sp.callMethod('reset');
    await page.waitForChanges();
    expect(await active(page)).toBe(0);
    expect(await completed(page)).toEqual([false, false, false]);
  }, 60000);

  it('linear: editable completed step can be revisited by clicking', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <md-stepper id="sp" mode="linear" active="2">
        <md-step label="One" completed editable></md-step>
        <md-step label="Two" completed></md-step>
        <md-step label="Three"></md-step>
      </md-stepper>`);
    await clickStep(page, 0);
    expect(await active(page)).toBe(0);
  }, 60000);

  it('built-in content panel: Continue advances + completes, Back goes back, Finish emits mdComplete', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <md-stepper id="sp" orientation="vertical" active="0">
        <md-step label="One"><p>a</p></md-step>
        <md-step label="Two"><p>b</p></md-step>
      </md-stepper>`);
    const done = await page.spyOnEvent('mdComplete');

    // Every panel renders [Back, Continue|Finish]; Back is disabled on the first.
    const clickAction = (stepIdx: number, btnIdx: number) =>
      page.evaluate((s: number, b: number) => {
        const step = document.querySelectorAll('#sp md-step')[s] as HTMLElement;
        const btns = step.shadowRoot!.querySelectorAll('.md-step__actions md-button');
        (btns[b] as HTMLElement).click();
      }, stepIdx, btnIdx);

    await clickAction(0, 1); // Continue
    await page.waitForChanges();
    expect(await active(page)).toBe(1);
    expect((await completed(page))[0]).toBe(true);

    // step 1 (last): [Back, Finish]
    await clickAction(1, 0); // Back
    await page.waitForChanges();
    expect(await active(page)).toBe(0);

    await clickAction(0, 1); // Continue → step 1
    await page.waitForChanges();
    await clickAction(1, 1); // Finish
    await page.waitForChanges();
    expect(done).toHaveReceivedEventTimes(1);
  }, 60000);

  it('horizontal footer nav: Continue advances, Back (always mounted) goes back, Finish emits mdComplete', async () => {
    const page = await newE2EPage();
    await page.setContent(H('active="0"')); // horizontal, nav on by default
    const done = await page.spyOnEvent('mdComplete');
    const navBtn = (i: number) =>
      page.evaluate((idx: number) => {
        const btns = document.getElementById('sp')!.shadowRoot!.querySelectorAll('.md-stepper__nav md-button');
        (btns[idx] as HTMLElement).click();
      }, i);
    const navState = () =>
      page.evaluate(() => {
        const btns = document.getElementById('sp')!.shadowRoot!.querySelectorAll('.md-stepper__nav md-button');
        return {
          count: btns.length,
          backDisabled: (btns[0] as any).disabled,
          continueText: btns[1].textContent!.trim(),
        };
      });

    // the bar is stable: Back + Continue from the very first step (Back disabled)
    expect(await navState()).toEqual({ count: 2, backDisabled: true, continueText: 'Continue' });

    await navBtn(1); // Continue
    await page.waitForChanges();
    expect(await active(page)).toBe(1);
    expect((await completed(page))[0]).toBe(true);
    expect(await navState()).toEqual({ count: 2, backDisabled: false, continueText: 'Continue' });

    await navBtn(0); // Back
    await page.waitForChanges();
    expect(await active(page)).toBe(0);

    // walk to the last step and Finish
    await navBtn(1);
    await page.waitForChanges();
    await navBtn(1);
    await page.waitForChanges();
    expect(await active(page)).toBe(2);
    expect((await navState()).continueText).toBe('Finish');
    await navBtn(1); // Finish
    await page.waitForChanges();
    expect(done).toHaveReceivedEventTimes(1);
  }, 60000);

  it('keyboard: Enter on a linear-gated future step is a no-op', async () => {
    const page = await newE2EPage();
    await page.setContent(H('mode="linear" active="0"'));
    await focusStep(page, 2); // programmatic focus works even at tabindex=-1
    await page.keyboard.press('Enter');
    await page.waitForChanges();
    expect(await active(page)).toBe(0);
  }, 60000);

  it('linear: a real click reaches a step behind an optional one (affordance parity)', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <md-stepper id="sp" mode="linear" active="0">
        <md-step label="A" completed></md-step>
        <md-step label="B" optional></md-step>
        <md-step label="C"></md-step>
      </md-stepper>`);
    await clickStep(page, 2); // must not LOOK disabled while the stepper would allow it
    expect(await active(page)).toBe(2);
  }, 60000);

  it('auto-complete: revisiting an editable completed step keeps downstream checks', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <md-stepper id="sp" mode="linear" active="2">
        <md-step label="A" completed editable></md-step>
        <md-step label="B" completed></md-step>
        <md-step label="C"></md-step>
      </md-stepper>`);
    await clickStep(page, 0);
    expect(await active(page)).toBe(0);
    expect(await completed(page)).toEqual([true, true, false]); // review-in-place
  }, 60000);

  it('focus lands on the new active header after panel-driven navigation', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <md-stepper id="sp" orientation="vertical" active="0">
        <md-step label="One"><p>a</p></md-step>
        <md-step label="Two"><p>b</p></md-step>
      </md-stepper>`);
    // focus + activate the Continue button in step 0's panel via keyboard-ish flow
    await page.evaluate(() => {
      const step = document.querySelectorAll('#sp md-step')[0] as HTMLElement;
      const btns = step.shadowRoot!.querySelectorAll('.md-step__actions md-button');
      (btns[1] as HTMLElement).click();
    });
    await page.waitForChanges();
    expect(await active(page)).toBe(1);
    const focusIsOnActiveHeader = await page.evaluate(() => {
      const step = document.querySelectorAll('#sp md-step')[1] as HTMLElement;
      return step.shadowRoot!.activeElement === step.shadowRoot!.querySelector('.md-step__inner');
    });
    expect(focusIsOnActiveHeader).toBe(true);
  }, 60000);

  it('dynamic: appending a step re-syncs total/position via slotchange', async () => {
    const page = await newE2EPage();
    await page.setContent(H('active="0"'));
    await page.evaluate(() => {
      const s = document.createElement('md-step');
      s.setAttribute('label', 'Four');
      document.getElementById('sp')!.appendChild(s);
    });
    await page.waitForChanges();
    await new Promise((r) => setTimeout(r, 50));
    await page.waitForChanges();
    const info = await page.evaluate(() => {
      const steps = Array.from(document.querySelectorAll('#sp md-step'));
      return { count: steps.length, total: steps[steps.length - 1].getAttribute('data-total'), pos: steps[steps.length - 1].getAttribute('data-position') };
    });
    expect(info.count).toBe(4);
    expect(info.total).toBe('4');
    expect(info.pos).toBe('last');
  }, 60000);

  it('dynamic: removing steps under the active index re-clamps it', async () => {
    const page = await newE2EPage();
    await page.setContent(H('mode="non-linear" active="2"'));
    const changed = await page.spyOnEvent('mdStepChange');
    await page.evaluate(() => {
      const sp = document.getElementById('sp')!;
      sp.removeChild(sp.querySelectorAll('md-step')[2]); // remove the active step
    });
    await page.waitForChanges();
    await new Promise((r) => setTimeout(r, 50));
    await page.waitForChanges();
    const info = await page.evaluate(() => {
      const steps = Array.from(document.querySelectorAll('#sp md-step'));
      return {
        active: (document.getElementById('sp') as any).active,
        count: steps.length,
        total: steps[0].getAttribute('data-total'),
        lastPos: steps[steps.length - 1].getAttribute('data-position'),
      };
    });
    expect(info.count).toBe(2);
    expect(info.active).toBe(1);
    expect(info.total).toBe('2');
    expect(info.lastPos).toBe('last');
    expect(changed).toHaveReceivedEventDetail({ index: 1, previous: 2 });
  }, 60000);

  it('nested steppers: the inner wizard does not drive the outer one', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <md-stepper id="outer" orientation="vertical" mode="non-linear" active="0">
        <md-step label="Outer one">
          <md-stepper id="inner" mode="non-linear" active="0">
            <md-step label="Inner one"></md-step>
            <md-step label="Inner two"></md-step>
            <md-step label="Inner three"></md-step>
          </md-stepper>
        </md-step>
        <md-step label="Outer two"></md-step>
      </md-stepper>`);
    await page.waitForChanges();
    // click inner step 2 — outer must stay put
    await page.evaluate(() => {
      const inner = document.getElementById('inner')!;
      const step = inner.querySelectorAll('md-step')[2] as HTMLElement;
      (step.shadowRoot!.querySelector('.md-step__inner') as HTMLElement).click();
    });
    await page.waitForChanges();
    const state = await page.evaluate(() => ({
      inner: (document.getElementById('inner') as any).active,
      outer: (document.getElementById('outer') as any).active,
    }));
    expect(state.inner).toBe(2);
    expect(state.outer).toBe(0);

    // inner footer Continue must not advance the outer stepper either
    await page.evaluate(() => {
      const inner = document.getElementById('inner')!;
      const btns = inner.shadowRoot!.querySelectorAll('.md-stepper__nav md-button');
      (btns[1] as HTMLElement).click();
    });
    await page.waitForChanges();
    const state2 = await page.evaluate(() => ({
      inner: (document.getElementById('inner') as any).active,
      outer: (document.getElementById('outer') as any).active,
    }));
    expect(state2.outer).toBe(0);
  }, 60000);

  it('veto: preventDefault on mdBeforeChange blocks the built-in Continue; a later direct active set commits + auto-completes', async () => {
    const page = await newE2EPage();
    await page.setContent(H('active="0"'));
    // Phase 1: veto forward changes → the built-in Continue is a no-op.
    await page.evaluate(() => {
      const sp = document.getElementById('sp') as any;
      sp.__veto = true;
      sp.addEventListener('mdBeforeChange', (e: any) => {
        if (sp.__veto && e.detail.index > e.detail.previous) e.preventDefault();
      });
    });
    const footerContinue = () =>
      page.evaluate(() => {
        const btns = document.getElementById('sp')!.shadowRoot!.querySelectorAll('.md-stepper__nav md-button');
        (btns[1] as HTMLElement).click();
      });
    await footerContinue();
    await page.waitForChanges();
    expect(await active(page)).toBe(0); // veto held — no advance
    expect((await completed(page))[0]).toBe(false); // and no auto-complete on a vetoed advance

    // Phase 2: validation passed → commit authoritatively by setting active
    // (the documented async-bypass); it still auto-completes the step left.
    await page.evaluate(() => { (document.getElementById('sp') as any).active = 1; });
    await page.waitForChanges();
    expect(await active(page)).toBe(1);
    expect((await completed(page))[0]).toBe(true);
  }, 60000);

  it('a11y: the polite live region announces the new step on footer navigation (focus stays on Continue)', async () => {
    const page = await newE2EPage();
    await page.setContent(H('active="0"'));
    await page.evaluate(() => {
      const btns = document.getElementById('sp')!.shadowRoot!.querySelectorAll('.md-stepper__nav md-button');
      (btns[1] as HTMLElement).click(); // Continue 0 -> 1
    });
    await page.waitForChanges();
    const live = await page.evaluate(
      () => document.getElementById('sp')!.shadowRoot!.querySelector('.md-stepper__live[role="status"]')!.textContent,
    );
    expect(live).toBe('Step 2 of 3: Two, current');
  }, 60000);

  it('a11y: setting a step to error announces it assertively via the observer (no navigation)', async () => {
    const page = await newE2EPage();
    await page.setContent(H('mode="non-linear" active="1"'));
    await page.evaluate(() => {
      const step = document.querySelectorAll('#sp md-step')[1] as any;
      step.error = true;
      step.errorText = 'Card declined';
    });
    await page.waitForChanges();
    await new Promise((r) => setTimeout(r, 50)); // MutationObserver is async
    await page.waitForChanges();
    const alert = await page.evaluate(
      () => document.getElementById('sp')!.shadowRoot!.querySelector('.md-stepper__live[role="alert"]')!.textContent,
    );
    expect(alert).toBe('Step 2 of 3: Two, error: Card declined');
  }, 60000);

  it('mobile variant: the compact bar Continue advances and the dots update', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <md-stepper id="sp" variant="mobile" indicator="dot" active="0">
        <md-step label="One"></md-step><md-step label="Two"></md-step><md-step label="Three"></md-step>
        <div slot="content">panel</div>
      </md-stepper>`);
    await page.waitForChanges();
    const rowHidden = await page.evaluate(() => {
      const list = document.getElementById('sp')!.shadowRoot!.querySelector('.md-stepper__list') as HTMLElement;
      return getComputedStyle(list).display === 'none';
    });
    expect(rowHidden).toBe(true); // step-header row hidden in mobile
    await page.evaluate(() => {
      const btns = document.getElementById('sp')!.shadowRoot!.querySelectorAll('.md-stepper__mobile md-button');
      (btns[1] as HTMLElement).click(); // Continue
    });
    await page.waitForChanges();
    expect(await active(page)).toBe(1);
    const dotState = await page.evaluate(() => {
      const dots = document.getElementById('sp')!.shadowRoot!.querySelectorAll('.md-stepper__mobile-dot');
      return { done0: dots[0].classList.contains('is-done'), active1: dots[1].classList.contains('is-active') };
    });
    expect(dotState).toEqual({ done0: true, active1: true });
  }, 60000);

  it('lazy: only the active vertical panel is in the DOM and it swaps on navigation', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <md-stepper id="sp" orientation="vertical" active="0" lazy>
        <md-step label="One"><p>a</p></md-step>
        <md-step label="Two"><p>b</p></md-step>
      </md-stepper>`);
    await page.waitForChanges();
    const mounted = () =>
      page.evaluate(() =>
        Array.from(document.querySelectorAll('#sp md-step')).map((s) => !!s.shadowRoot!.querySelector('.md-step__content')),
      );
    expect(await mounted()).toEqual([true, false]);
    await (await page.find('#sp')).callMethod('next');
    await page.waitForChanges();
    await new Promise((r) => setTimeout(r, 50));
    await page.waitForChanges();
    expect(await mounted()).toEqual([false, true]);
  }, 60000);

  it('observer re-gates linear reachability when a prior step is completed imperatively', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <md-stepper id="sp" mode="linear" active="0" auto-complete="false">
        <md-step label="A"></md-step>
        <md-step label="B"></md-step>
      </md-stepper>`);
    await page.waitForChanges();
    const stepBReachable = () =>
      page.evaluate(() => {
        const b = document.querySelectorAll('#sp md-step')[1] as HTMLElement;
        return b.shadowRoot!.querySelector('.md-step__inner')!.getAttribute('tabindex');
      });
    expect(await stepBReachable()).toBe('-1'); // gated: A not completed
    await page.evaluate(() => { (document.querySelectorAll('#sp md-step')[0] as any).completed = true; });
    await page.waitForChanges();
    await new Promise((r) => setTimeout(r, 50));
    await page.waitForChanges();
    expect(await stepBReachable()).toBe('0'); // re-gated live: now reachable
  }, 60000);
});
