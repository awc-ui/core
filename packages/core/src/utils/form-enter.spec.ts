import { newSpecPage } from '@stencil/core/testing';
import { MdButton } from '../components/md-button/md-button';
import { submitFormOnEnter } from './form';

const enter = (init: KeyboardEventInit = {}) =>
  new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true, ...init });
const internalsOf = (form: HTMLFormElement) => ({ form } as ElementInternals);

describe('submitFormOnEnter', () => {
  afterEach(() => jest.useRealTimers());

  async function fixture(html = '<form></form>') {
    const page = await newSpecPage({ components: [], html });
    const form = page.body.querySelector('form')!;
    const requestSubmit = jest.fn();
    Object.defineProperty(form, 'requestSubmit', { configurable: true, value: requestSubmit });
    // Mock DOM does not implement native form association; keep the real
    // button nodes/click events and supply only their platform-owned link.
    page.body.querySelectorAll('button, input').forEach((button) => {
      Object.defineProperty(button, 'disabled', { configurable: true, value: button.hasAttribute('disabled') });
      const owner = button.getAttribute('form');
      if (owner === form.id || (!owner && button.closest('form') === form)) {
        Object.defineProperty(button, 'form', { configurable: true, value: form });
      }
    });
    jest.useFakeTimers();
    return { page, form, requestSubmit };
  }

  it('activates the first native default, preserving its click handler, exactly once', async () => {
    const { page, form, requestSubmit } = await fixture('<form><button type="submit" name="intent" value="verify">Verify</button></form>');
    const click = jest.fn((event: Event) => event.preventDefault());
    page.body.querySelector('button')!.addEventListener('click', click);
    const event = enter();
    expect(submitFormOnEnter(internalsOf(form), event)).toBe(true);
    expect(submitFormOnEnter(internalsOf(form), event)).toBe(false);
    expect(click).not.toHaveBeenCalled();
    jest.runOnlyPendingTimers();
    expect(click).toHaveBeenCalledTimes(1);
    expect(requestSubmit).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(true);
  });

  it('does not bypass a disabled default to activate a later submit button', async () => {
    const { page, form, requestSubmit } = await fixture('<form><button type="submit" disabled>Wait</button><button type="submit">Later</button></form>');
    const clicks = jest.fn();
    page.body.querySelectorAll('button').forEach((button) => button.addEventListener('click', clicks));
    submitFormOnEnter(internalsOf(form), enter());
    jest.runOnlyPendingTimers();
    expect(clicks).not.toHaveBeenCalled();
    expect(requestSubmit).not.toHaveBeenCalled();
  });

  it('finds an earlier native submitter associated by form=id', async () => {
    const { page, form } = await fixture('<button type="submit" form="verify">Outside</button><form id="verify"><button type="submit">Inside</button></form>');
    const buttons = page.body.querySelectorAll('button');
    const outside = jest.fn();
    const inside = jest.fn();
    buttons[0].addEventListener('click', outside);
    buttons[1].addEventListener('click', inside);
    submitFormOnEnter(internalsOf(form), enter());
    jest.runOnlyPendingTimers();
    expect(outside).toHaveBeenCalledTimes(1);
    expect(inside).not.toHaveBeenCalled();
  });

  it('uses requestSubmit for validation when no default submitter exists', async () => {
    const { form, requestSubmit } = await fixture();
    submitFormOnEnter(internalsOf(form), enter());
    jest.runOnlyPendingTimers();
    expect(requestSubmit).toHaveBeenCalledWith();
    expect(requestSubmit).toHaveBeenCalledTimes(1);
  });

  it('lets a bubbling ancestor cancel before submission', async () => {
    const { form, requestSubmit } = await fixture();
    const event = enter();
    submitFormOnEnter(internalsOf(form), event);
    event.preventDefault();
    jest.runOnlyPendingTimers();
    expect(requestSubmit).not.toHaveBeenCalled();
  });

  it('ignores modifiers, IME, repeats, disabled/multiline inputs and canceled keys', async () => {
    const { form, requestSubmit } = await fixture();
    for (const init of [
      { key: 'Escape' }, { altKey: true }, { ctrlKey: true }, { metaKey: true },
      { shiftKey: true }, { isComposing: true }, { repeat: true },
    ]) {
      const event = enter(init);
      // Older Stencil mock events omit some KeyboardEventInit properties.
      Object.entries(init).forEach(([key, value]) => Object.defineProperty(event, key, { value }));
      expect(submitFormOnEnter(internalsOf(form), event)).toBe(false);
    }
    const ime = enter();
    Object.defineProperty(ime, 'keyCode', { value: 229 });
    expect(submitFormOnEnter(internalsOf(form), ime)).toBe(false);
    const canceled = enter();
    canceled.preventDefault();
    expect(submitFormOnEnter(internalsOf(form), canceled)).toBe(false);
    for (const options of [{ disabled: true }, { composing: true }, { multiline: true }]) {
      expect(submitFormOnEnter(internalsOf(form), enter(), options)).toBe(false);
    }
    expect(submitFormOnEnter(undefined, enter())).toBe(false);
    jest.runOnlyPendingTimers();
    expect(requestSubmit).not.toHaveBeenCalled();
  });

  async function awcButton(attributes = '') {
    const page = await newSpecPage({ components: [MdButton], html: `<md-button type="submit" ${attributes}>Verify</md-button>` });
    const form = page.doc.createElement('form');
    page.body.appendChild(form);
    form.appendChild(page.root!);
    const requestSubmit = jest.fn();
    Object.defineProperty(form, 'requestSubmit', { configurable: true, value: requestSubmit });
    page.rootInstance.internals = { form };
    // newSpecPage mounts the component without the lazy runtime's hydration
    // marker; this fixture represents an already-ready button.
    page.root!.classList.add('hydrated');
    jest.useFakeTimers();
    return { page, form, requestSubmit };
  }

  it('activates the real md-button HOST, including mdClick and its form action', async () => {
    const { page, form, requestSubmit } = await awcButton();
    const click = jest.fn();
    page.root!.addEventListener('mdClick', click);
    submitFormOnEnter(internalsOf(form), enter());
    jest.runOnlyPendingTimers();
    expect(click).toHaveBeenCalledTimes(1);
    expect(requestSubmit).toHaveBeenCalledTimes(1);
  });

  it('respects cancellation by the real md-button mdClick listener', async () => {
    const { page, form, requestSubmit } = await awcButton();
    page.root!.addEventListener('mdClick', (event) => event.preventDefault());
    submitFormOnEnter(internalsOf(form), enter());
    jest.runOnlyPendingTimers();
    expect(requestSubmit).not.toHaveBeenCalled();
  });

  it.each(['disabled', 'soft-disabled', 'loading'])('does not bypass a real md-button marked %s', async (attribute) => {
    const { page, form, requestSubmit } = await awcButton(attribute);
    const click = jest.fn();
    page.root!.addEventListener('mdClick', click);
    submitFormOnEnter(internalsOf(form), enter());
    jest.runOnlyPendingTimers();
    expect(click).not.toHaveBeenCalled();
    expect(requestSubmit).not.toHaveBeenCalled();
  });

  async function delayedAwcButton() {
    const context = await awcButton();
    const button = context.page.root!;
    button.classList.remove('hydrated');
    let resolveReady!: () => void;
    let rejectReady!: (error: Error) => void;
    const ready = new Promise<void>((resolve, reject) => {
      resolveReady = resolve;
      rejectReady = reject;
    });
    const componentOnReady = jest.fn(() => ready);
    Object.defineProperty(button, 'componentOnReady', { configurable: true, value: componentOnReady });
    const click = jest.fn();
    button.addEventListener('mdClick', click);
    return { ...context, button, ready, resolveReady, rejectReady, componentOnReady, click };
  }

  it('waits for the lazy default button before emitting mdClick and submitting exactly once', async () => {
    const { form, ready, resolveReady, componentOnReady, click, requestSubmit } = await delayedAwcButton();
    const event = enter();
    submitFormOnEnter(internalsOf(form), event);
    expect(submitFormOnEnter(internalsOf(form), event)).toBe(false);
    jest.runOnlyPendingTimers();
    expect(componentOnReady).toHaveBeenCalledTimes(1);
    expect(click).not.toHaveBeenCalled();
    expect(requestSubmit).not.toHaveBeenCalled();
    resolveReady();
    await ready;
    expect(click).toHaveBeenCalledTimes(1);
    expect(requestSubmit).toHaveBeenCalledTimes(1);
  });

  it.each([
    'canceled', 'unmounted form', 'moved button', 'different form owner',
    'new default', 'disabled', 'softDisabled', 'loading',
  ])('rechecks %s after the default button finishes loading', async (change) => {
    const { page, form, button, ready, resolveReady, click, requestSubmit } = await delayedAwcButton();
    const event = enter();
    submitFormOnEnter(internalsOf(form), event);
    jest.runOnlyPendingTimers();
    switch (change) {
      case 'canceled': event.preventDefault(); break;
      case 'unmounted form': form.remove(); break;
      case 'moved button': {
        const other = page.doc.createElement('form');
        page.body.appendChild(other);
        other.appendChild(button);
        break;
      }
      case 'different form owner': button.setAttribute('form', 'other'); break;
      case 'new default': {
        const earlier = page.doc.createElement('md-button');
        earlier.setAttribute('type', 'submit');
        form.insertBefore(earlier, button);
        break;
      }
      default: Object.defineProperty(button, change, { configurable: true, value: true });
    }
    resolveReady();
    await ready;
    expect(click).not.toHaveBeenCalled();
    expect(requestSubmit).not.toHaveBeenCalled();
  });

  it('does not bypass a default whose lazy upgrade rejects', async () => {
    const { form, ready, rejectReady, click, requestSubmit } = await delayedAwcButton();
    submitFormOnEnter(internalsOf(form), enter());
    jest.runOnlyPendingTimers();
    rejectReady(new Error('Button chunk unavailable'));
    await ready.catch(() => undefined);
    expect(click).not.toHaveBeenCalled();
    expect(requestSubmit).not.toHaveBeenCalled();
  });

  it('activates an already hydrated button without waiting for another readiness promise', async () => {
    const { form, button, componentOnReady, click, requestSubmit } = await delayedAwcButton();
    button.classList.add('hydrated');
    submitFormOnEnter(internalsOf(form), enter());
    jest.runOnlyPendingTimers();
    expect(componentOnReady).not.toHaveBeenCalled();
    expect(click).toHaveBeenCalledTimes(1);
    expect(requestSubmit).toHaveBeenCalledTimes(1);
  });

});
