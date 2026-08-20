import {
  setFormValue,
  setValidityState,
  checkValidityOf,
  reportValidityOf,
  getValidityOf,
} from './form';

/**
 * Unit tests for the form-association helpers.
 *
 * These exist mainly to pin the DEFENSIVE branches. Every helper here degrades
 * rather than throws when the platform is missing a piece — the Stencil spec
 * mock has no `setFormValue`/`setValidity`, and older browsers have no
 * ElementInternals at all. Those fallbacks are deliberate design decisions, and
 * until now nothing asserted them: someone "simplifying" checkValidityOf to
 * return false on error would have broken every form in exactly the environment
 * hardest to debug, with a green suite.
 */
const internalsWith = (over: Record<string, unknown>) => over as unknown as ElementInternals;

describe('setFormValue', () => {
  it('forwards the value when the platform supports it', () => {
    const calls: unknown[] = [];
    setFormValue(internalsWith({ setFormValue: (v: unknown) => calls.push(v) }), 'abc');
    expect(calls).toEqual(['abc']);
  });

  it('no-ops when setFormValue is absent (the spec mock)', () => {
    expect(() => setFormValue(internalsWith({}), 'abc')).not.toThrow();
  });

  it('no-ops when internals itself is missing', () => {
    expect(() => setFormValue(undefined as unknown as ElementInternals, 'abc')).not.toThrow();
  });

  it('forwards null, which is how a control removes itself from the payload', () => {
    const calls: unknown[] = [];
    setFormValue(internalsWith({ setFormValue: (v: unknown) => calls.push(v) }), null);
    expect(calls).toEqual([null]);
  });
});

describe('setValidityState', () => {
  const spy = () => {
    const calls: Array<[unknown, unknown, unknown]> = [];
    return {
      calls,
      internals: internalsWith({
        setValidity: (f: unknown, m?: unknown, a?: unknown) => calls.push([f, m, a]),
      }),
    };
  };

  it('clears validity when nothing is wrong', () => {
    const { calls, internals } = spy();
    setValidityState(internals, {});
    expect(calls[0][0]).toEqual({});
  });

  it('reports valueMissing with the supplied message', () => {
    const { calls, internals } = spy();
    setValidityState(internals, { missing: true, missingMessage: 'Pick one' });
    expect(calls[0][0]).toEqual({ valueMissing: true });
    expect(calls[0][1]).toBe('Pick one');
  });

  it('falls back to a default message when none is given', () => {
    const { calls, internals } = spy();
    setValidityState(internals, { missing: true });
    expect(String(calls[0][1]).length).toBeGreaterThan(0);
  });

  it('lets a custom message WIN over valueMissing, matching native precedence', () => {
    const { calls, internals } = spy();
    setValidityState(internals, { missing: true, customMessage: 'Taken' });
    expect(calls[0][0]).toEqual({ customError: true });
    expect(calls[0][1]).toBe('Taken');
  });

  it('passes the anchor through so reportValidity has somewhere to point', () => {
    const { calls, internals } = spy();
    const anchor = {} as HTMLElement;
    setValidityState(internals, { missing: true, anchor });
    expect(calls[0][2]).toBe(anchor);
  });

  it('no-ops when setValidity is absent', () => {
    expect(() => setValidityState(internalsWith({}), { missing: true })).not.toThrow();
  });
});

describe('checkValidityOf / reportValidityOf', () => {
  it('returns the platform answer when available', () => {
    expect(checkValidityOf(internalsWith({ checkValidity: () => false }))).toBe(false);
    expect(reportValidityOf(internalsWith({ reportValidity: () => false }))).toBe(false);
  });

  it('resolves an UNKNOWN validity to true, never false', () => {
    // The important one. Reporting "invalid" where ElementInternals is missing
    // would make forms unsubmittable precisely where that is hardest to
    // diagnose, so absence must read as "no objection".
    expect(checkValidityOf(internalsWith({}))).toBe(true);
    expect(reportValidityOf(internalsWith({}))).toBe(true);
    expect(checkValidityOf(undefined as unknown as ElementInternals)).toBe(true);
    expect(reportValidityOf(undefined as unknown as ElementInternals)).toBe(true);
  });

  it('swallows a throwing platform and still answers true', () => {
    const boom = () => {
      throw new Error('nope');
    };
    expect(checkValidityOf(internalsWith({ checkValidity: boom }))).toBe(true);
    expect(reportValidityOf(internalsWith({ reportValidity: boom }))).toBe(true);
  });
});

describe('getValidityOf', () => {
  it('reports the message and the failing flags', () => {
    const v = getValidityOf(
      internalsWith({
        validity: { valid: false, valueMissing: true, customError: false },
        validationMessage: 'Required',
      }),
    );
    expect(v.valid).toBe(false);
    expect(v.validationMessage).toBe('Required');
    expect(v.flags).toEqual({ valueMissing: true });
  });

  it('excludes `valid` from the flags', () => {
    // `valid` is the summary, not a failure reason. Including it made a PASSING
    // control report `flags: { valid: true }`, so any consumer testing "are
    // there flags?" saw a problem where there was none.
    const v = getValidityOf(
      internalsWith({ validity: { valid: true }, validationMessage: '' }),
    );
    expect(v.flags).toEqual({});
    expect(v.valid).toBe(true);
  });

  it('degrades to a valid, empty result when validity is unavailable', () => {
    expect(getValidityOf(internalsWith({}))).toEqual({
      valid: true,
      validationMessage: '',
      flags: {},
    });
  });

  it('degrades rather than throwing when reading validity blows up', () => {
    const hostile = internalsWith({});
    Object.defineProperty(hostile, 'validity', {
      get() {
        throw new Error('detached');
      },
    });
    expect(getValidityOf(hostile).valid).toBe(true);
  });
});
