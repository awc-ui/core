import { createFormController } from './form-controller';

/**
 * Unit tests for the form controller.
 *
 * Driven through real DOM elements rather than a browser: the controller only
 * needs `name`, a value, and the validation methods, so plain elements with
 * those properties exercise every path — including the ones a story cannot
 * reach, like a control whose setCustomValidity throws.
 */
type Field = HTMLElement & Record<string, unknown>;

const makeField = (name: string, over: Record<string, unknown> = {}): Field => {
  const el = document.createElement('div') as unknown as Field;
  el.setAttribute('name', name);
  (el as Record<string, unknown>).name = name;
  el.value = '';
  el.setCustomValidity = () => Promise.resolve();
  el.checkValidity = () => Promise.resolve(true);
  el.getValidity = () => Promise.resolve({ valid: true, validationMessage: '' });
  Object.assign(el, over);
  return el;
};

const makeForm = (fields: Field[]) => {
  const form = document.createElement('form');
  fields.forEach((f) => form.appendChild(f));
  document.body.appendChild(form);
  return form;
};

afterEach(() => {
  document.body.innerHTML = '';
});

describe('values()', () => {
  it('reads booleans as booleans so requiredWhen can tell unchecked from absent', () => {
    // FormData omits an unchecked box entirely, so a rule reading it there sees
    // `undefined` and cannot distinguish "unchecked" from "no such field".
    const cb = makeField('agree');
    Object.defineProperty(cb, 'tagName', { value: 'MD-CHECKBOX' });
    cb.checked = false;
    const sw = makeField('news');
    Object.defineProperty(sw, 'tagName', { value: 'MD-SWITCH' });
    sw.selected = true;

    const c = createFormController(makeForm([cb, sw]), { liveValidate: false });
    expect(c.values()).toEqual({ agree: false, news: true });
    c.destroy();
  });

  it('reports the checked member of a radio group, and null when none is', () => {
    const a = makeField('plan', { value: 'free', checked: false });
    Object.defineProperty(a, 'tagName', { value: 'MD-RADIO' });
    const b = makeField('plan', { value: 'pro', checked: true });
    Object.defineProperty(b, 'tagName', { value: 'MD-RADIO' });
    const c = createFormController(makeForm([a, b]), { liveValidate: false });
    expect(c.values().plan).toBe('pro');
    c.destroy();

    b.checked = false;
    const c2 = createFormController(makeForm([a, b]), { liveValidate: false });
    expect(c2.values().plan).toBeNull();
    c2.destroy();
  });

  it('skips disabled controls', () => {
    const on = makeField('a', { value: 'x' });
    const off = makeField('b', { value: 'y', disabled: true });
    const c = createFormController(makeForm([on, off]), { liveValidate: false });
    expect(Object.keys(c.values())).toEqual(['a']);
    c.destroy();
  });
});

describe('rules', () => {
  it('applies requiredWhen only while the condition holds', async () => {
    const reason = makeField('reason', { value: 'bug' });
    const detail = makeField('detail', { value: '' });
    let lastMessage = '';
    detail.setCustomValidity = (m: string) => {
      lastMessage = m;
      return Promise.resolve();
    };
    const c = createFormController(makeForm([reason, detail]), {
      liveValidate: false,
      rules: { detail: { requiredWhen: (v) => v.reason === 'other', requiredMessage: 'Say more' } },
    });

    await c.validate();
    expect(lastMessage).toBe('');

    reason.value = 'other';
    await c.validate();
    expect(lastMessage).toBe('Say more');
  });

  it('runs a cross-field validate and reports its message', async () => {
    const a = makeField('pw', { value: '1' });
    const b = makeField('confirm', { value: '2' });
    let msg = '';
    b.setCustomValidity = (m: string) => {
      msg = m;
      return Promise.resolve();
    };
    const c = createFormController(makeForm([a, b]), {
      liveValidate: false,
      rules: { confirm: { validate: (v) => v.pw === v.confirm || 'Mismatch' } },
    });
    await c.validate();
    expect(msg).toBe('Mismatch');
    c.destroy();
  });

  it('accepts an async validate', async () => {
    const f = makeField('email', { value: 'taken' });
    let msg = '';
    f.setCustomValidity = (m: string) => {
      msg = m;
      return Promise.resolve();
    };
    const c = createFormController(makeForm([f]), {
      liveValidate: false,
      rules: { email: { validate: async (v) => v.email !== 'taken' || 'Already used' } },
    });
    await c.validate();
    expect(msg).toBe('Already used');
    c.destroy();
  });

  it('falls back to a generic message when validate returns a non-string falsy', async () => {
    const f = makeField('x', { value: '' });
    let msg = '';
    f.setCustomValidity = (m: string) => {
      msg = m;
      return Promise.resolve();
    };
    const c = createFormController(makeForm([f]), {
      liveValidate: false,
      rules: { x: { validate: () => false as unknown as true } },
    });
    await c.validate();
    expect(msg).toBe('Invalid value.');
    c.destroy();
  });
});

describe('reporting', () => {
  it('collects errors by name and points at the first invalid control', async () => {
    const bad = makeField('one', {
      getValidity: () => Promise.resolve({ valid: false, validationMessage: 'Nope' }),
    });
    const good = makeField('two');
    const c = createFormController(makeForm([bad, good]), {
      liveValidate: false,
      focusInvalid: false,
    });
    const res = await c.validate();
    expect(res.valid).toBe(false);
    expect(res.errors).toEqual({ one: 'Nope' });
    expect(res.firstInvalid).toBe(bad);
    c.destroy();
  });

  it('falls back to checkValidity when getValidity is unavailable', async () => {
    const f = makeField('one', {
      getValidity: undefined,
      checkValidity: () => Promise.resolve(false),
      validationMessage: 'From checkValidity',
    });
    const c = createFormController(makeForm([f]), { liveValidate: false, focusInvalid: false });
    const res = await c.validate();
    expect(res.errors.one).toBe('From checkValidity');
    c.destroy();
  });

  it('calls onValidate with the result', async () => {
    const seen: unknown[] = [];
    const c = createFormController(makeForm([makeField('a')]), {
      liveValidate: false,
      onValidate: (r) => seen.push(r),
    });
    await c.validate();
    expect(seen.length).toBe(1);
    c.destroy();
  });
});

describe('focus and reset', () => {
  it('prefers the component setFocus over DOM focus', async () => {
    let used = '';
    const f = makeField('one', {
      getValidity: () => Promise.resolve({ valid: false, validationMessage: 'x' }),
      setFocus: () => {
        used = 'setFocus';
        return Promise.resolve();
      },
    });
    const c = createFormController(makeForm([f]), { liveValidate: false });
    await c.validate();
    expect(used).toBe('setFocus');
    c.destroy();
  });

  it('survives an element with no scrollIntoView', async () => {
    // jsdom has none; the controller must not fall over on it.
    const f = makeField('one', {
      getValidity: () => Promise.resolve({ valid: false, validationMessage: 'x' }),
    });
    (f as Record<string, unknown>).scrollIntoView = () => {
      throw new Error('unsupported');
    };
    const c = createFormController(makeForm([f]), { liveValidate: false });
    await expect(c.validate()).resolves.toBeTruthy();
    c.destroy();
  });

  it('reset() clears displayed errors and custom validity', async () => {
    const cleared: string[] = [];
    const f = makeField('one', {
      error: true,
      errorText: 'Bad',
      setCustomValidity: (m: string) => {
        cleared.push(m);
        return Promise.resolve();
      },
    });
    const c = createFormController(makeForm([f]), { liveValidate: false });
    await c.reset();
    expect(cleared).toContain('');
    expect(f.error).toBe(false);
    expect(f.errorText).toBe('');
    c.destroy();
  });
});

describe('destroy()', () => {
  it('detaches listeners so later edits do nothing', async () => {
    const f = makeField('a');
    const form = makeForm([f]);
    let calls = 0;
    const c = createFormController(form, { onValidate: () => calls++ });
    c.destroy();
    f.dispatchEvent(new CustomEvent('mdChange', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 30));
    expect(calls).toBe(0);
  });
});

describe('live validation triggers', () => {
  /** The controller listens on the FORM, so events must bubble from the field. */
  const fire = (el: HTMLElement, type: string) =>
    el.dispatchEvent(new CustomEvent(type, { bubbles: true }));

  it('does not display an error while a field is still untouched', async () => {
    const f = makeField('email', {
      getValidity: () => Promise.resolve({ valid: false, validationMessage: 'Bad' }),
      error: false,
      errorText: '',
    });
    const c = createFormController(makeForm([f]));
    fire(f, 'mdInput');
    await new Promise((r) => setTimeout(r, 60));
    // Validated, but silent: shouting mid-keystroke is hostile.
    expect(f.error).toBe(false);
    c.destroy();
  });

  it('displays the error once the field is blurred', async () => {
    const f = makeField('email', {
      getValidity: () => Promise.resolve({ valid: false, validationMessage: 'Bad' }),
      error: false,
      errorText: '',
    });
    const c = createFormController(makeForm([f]));
    // focusout, not blur — blur does not bubble and never reaches the form.
    f.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 60));
    expect(f.error).toBe(true);
    expect(f.errorText).toBe('Bad');
    c.destroy();
  });

  it('reveals every field on a submit attempt, including untouched ones', async () => {
    const f = makeField('name', {
      getValidity: () => Promise.resolve({ valid: false, validationMessage: 'Required' }),
      error: false,
      errorText: '',
    });
    const form = makeForm([f]);
    const btn = document.createElement('button');
    btn.setAttribute('type', 'submit');
    form.appendChild(btn);
    const c = createFormController(form, { focusInvalid: false });
    btn.click();
    await new Promise((r) => setTimeout(r, 80));
    expect(f.error).toBe(true);
    c.destroy();
  });

  // `invalid` does not bubble, so the controller listens in the CAPTURE phase.
  // Stencil's mock-doc does not implement capture propagation (probed: a capture
  // listener on the parent never sees a non-bubbling event from a child, while
  // bubbling works), so these dispatch on the form itself — target-phase
  // listeners fire regardless of the capture flag. That exercises the handler;
  // the child-to-form wiring is covered in the browser.
  it('suppresses the browser validation balloon while showing its own message', () => {
    const form = makeForm([makeField('a')]);
    const c = createFormController(form);
    const evt = new Event('invalid', { cancelable: true });
    form.dispatchEvent(evt);
    expect(evt.defaultPrevented).toBe(true);
    c.destroy();
  });

  it('leaves the balloon alone when it is not showing messages itself', () => {
    const form = makeForm([makeField('a')]);
    const c = createFormController(form, { showErrors: false });
    const evt = new Event('invalid', { cancelable: true });
    form.dispatchEvent(evt);
    expect(evt.defaultPrevented).toBe(false);
    c.destroy();
  });

  it('clears the error display when the form is reset', async () => {
    const f = makeField('a', { error: true, errorText: 'Bad' });
    const form = makeForm([f]);
    const c = createFormController(form);
    form.dispatchEvent(new Event('reset'));
    await new Promise((r) => setTimeout(r, 40));
    expect(f.error).toBe(false);
    c.destroy();
  });

  it('re-validates dependents when their dependency changes', async () => {
    const pw = makeField('pw', { value: 'a' });
    const cf = makeField('confirm', { value: 'b' });
    let msg = '';
    cf.setCustomValidity = (m: string) => {
      msg = m;
      return Promise.resolve();
    };
    const c = createFormController(makeForm([pw, cf]), {
      rules: {
        confirm: { dependsOn: ['pw'], validate: (v) => v.pw === v.confirm || 'Mismatch' },
      },
    });
    fire(cf, 'mdInput');
    await new Promise((r) => setTimeout(r, 60));
    expect(msg).toBe('Mismatch');

    // Fix the DEPENDENCY only — confirm is never touched.
    pw.value = 'b';
    fire(pw, 'mdInput');
    await new Promise((r) => setTimeout(r, 60));
    expect(msg).toBe('');
    c.destroy();
  });

  it('debounces, so a burst of edits validates once', async () => {
    let runs = 0;
    const f = makeField('q', { value: 'x' });
    const c = createFormController(makeForm([f]), {
      rules: {
        q: {
          debounce: 40,
          validate: () => {
            runs++;
            return true;
          },
        },
      },
    });
    fire(f, 'mdInput');
    fire(f, 'mdInput');
    fire(f, 'mdInput');
    await new Promise((r) => setTimeout(r, 120));
    expect(runs).toBe(1);
    c.destroy();
  });

  it('ignores events from elements without a name', async () => {
    const f = makeField('a');
    const form = makeForm([f]);
    const stray = document.createElement('div');
    form.appendChild(stray);
    const c = createFormController(form, { onValidate: () => undefined });
    expect(() => fire(stray, 'mdInput')).not.toThrow();
    c.destroy();
  });

  it('skips the inline display for controls that have no errorText slot', async () => {
    // md-checkbox before it gained one, md-radio, md-switch: assigning would
    // create a silent expando that renders nothing.
    const f = makeField('a', {
      getValidity: () => Promise.resolve({ valid: false, validationMessage: 'Bad' }),
    });
    delete (f as Record<string, unknown>).errorText;
    const c = createFormController(makeForm([f]), { focusInvalid: false });
    await expect(c.validate()).resolves.toBeTruthy();
    c.destroy();
  });
});
