import { releaseIsolatingAncestors } from './isolation-escape';

/**
 * `releaseIsolatingAncestors` suspends `isolation: isolate` on a popup's
 * ancestors and puts it back. Both halves matter equally: the suspend is what
 * lets a `position: fixed` popup out of the stacking context that was capping
 * its z-index, and the restore is what stops a menu having opened once from
 * permanently changing the page it opened in.
 *
 * These run against plain DOM rather than `newSpecPage`, because the helper's
 * whole job is walking the flat tree and reading `getComputedStyle` — there is
 * no component to mount. The fixtures carry an inline `isolation`; in the
 * browser the same value usually arrives from a `:host` rule in the ancestor's
 * own stylesheet, which is precisely why the helper writes INLINE — an inline
 * declaration is the thing that outranks a `:host` rule.
 */
describe('releaseIsolatingAncestors', () => {
  let root: HTMLElement;

  /*
   * Stencil's mock-doc does not implement `isolation` in getComputedStyle — it
   * comes back `undefined` — so the helper's detection would never fire and
   * every assertion here would test nothing. Stub the ONE property it reads,
   * deriving it from the inline value, which is what a browser would report for
   * these fixtures anyway. Production code is left alone: weakening the real
   * check to suit a mock would be testing a different function than the one
   * that ships.
   */
  const realGCS = globalThis.getComputedStyle;
  beforeAll(() => {
    (globalThis as unknown as { getComputedStyle: unknown }).getComputedStyle = (el: Element) =>
      ({ isolation: (el as HTMLElement).style?.isolation || 'auto' }) as CSSStyleDeclaration;
  });
  afterAll(() => {
    (globalThis as unknown as { getComputedStyle: unknown }).getComputedStyle = realGCS;
  });

  /** outer(isolate) > middle(auto) > inner(isolate) > leaf */
  function build() {
    root = document.createElement('div');
    const outer = document.createElement('div');
    const middle = document.createElement('div');
    const inner = document.createElement('div');
    const leaf = document.createElement('div');
    outer.style.isolation = 'isolate';
    inner.style.isolation = 'isolate';
    outer.appendChild(middle);
    middle.appendChild(inner);
    inner.appendChild(leaf);
    root.appendChild(outer);
    document.body.appendChild(root);
    return { outer, middle, inner, leaf };
  }

  afterEach(() => {
    root?.remove();
  });

  /** What the helper sees, and what a browser would report for these fixtures. */
  const iso = (el: HTMLElement) => el.style.isolation || 'auto';

  it('relaxes every isolating ancestor and leaves the others alone', () => {
    const { outer, middle, inner, leaf } = build();
    releaseIsolatingAncestors(leaf);
    expect(iso(outer)).toBe('auto');
    expect(iso(inner)).toBe('auto');
    // `middle` never isolated, so it was never touched — no stray inline value.
    expect(middle.style.isolation).toBe('');
  });

  it('restores them on release', () => {
    const { outer, inner, leaf } = build();
    const release = releaseIsolatingAncestors(leaf);
    release();
    expect(iso(outer)).toBe('isolate');
    expect(iso(inner)).toBe('isolate');
  });

  it('removes only the isolation declaration, keeping other inline styles', () => {
    const { outer, leaf } = build();
    outer.style.setProperty('--kept', '1');
    outer.style.color = 'red';
    releaseIsolatingAncestors(leaf)();
    expect(outer.style.color).toBe('red');
    expect(outer.style.getPropertyValue('--kept')).toBe('1');
    expect(iso(outer)).toBe('isolate');
  });

  it('preserves an inline isolation the author set themselves', () => {
    const { inner, leaf } = build();
    // `inner` already carries an INLINE isolate here, not a stylesheet one.
    releaseIsolatingAncestors(leaf)();
    expect(inner.style.isolation).toBe('isolate');
  });

  it('refcounts: the first close does not re-isolate while a second popup is open', () => {
    const { outer, inner, leaf } = build();
    const second = document.createElement('div');
    inner.appendChild(second);

    const releaseA = releaseIsolatingAncestors(leaf);
    const releaseB = releaseIsolatingAncestors(second);
    expect(iso(outer)).toBe('auto');

    releaseA();
    // B is still open — this is the case a naive implementation gets wrong,
    // because B read `auto` on the way up and would have taken no reference.
    expect(iso(outer)).toBe('auto');
    expect(iso(inner)).toBe('auto');

    releaseB();
    expect(iso(outer)).toBe('isolate');
    expect(iso(inner)).toBe('isolate');
  });

  it('is idempotent — calling release twice does not double-decrement', () => {
    const { outer, inner, leaf } = build();
    const second = document.createElement('div');
    inner.appendChild(second);

    const releaseA = releaseIsolatingAncestors(leaf);
    const releaseB = releaseIsolatingAncestors(second);
    releaseA();
    releaseA();
    releaseA();
    // A's extra calls must not consume B's reference.
    expect(iso(outer)).toBe('auto');
    releaseB();
    expect(iso(outer)).toBe('isolate');
  });

  it('returns a usable no-op when no ancestor isolates', () => {
    const plain = document.createElement('div');
    const leaf = document.createElement('div');
    plain.appendChild(leaf);
    document.body.appendChild(plain);
    expect(() => releaseIsolatingAncestors(leaf)()).not.toThrow();
    expect(plain.style.isolation).toBe('');
    plain.remove();
  });

  it('crosses a shadow boundary', () => {
    const { inner, leaf } = build();
    const host = document.createElement('div');
    leaf.appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });
    const deep = document.createElement('div');
    shadow.appendChild(deep);

    const release = releaseIsolatingAncestors(deep);
    expect(iso(inner)).toBe('auto');
    release();
    expect(iso(inner)).toBe('isolate');
  });
});
