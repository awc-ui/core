import { flipRows, captureFlip } from './flip';

describe('flip util', () => {
  let container: HTMLElement;
  let savedRaf: typeof requestAnimationFrame;

  const setReducedMotion = (matches: boolean) => {
    (window as any).matchMedia = jest.fn().mockReturnValue({ matches });
  };

  beforeEach(() => {
    container = document.createElement('div');
    for (let i = 0; i < 3; i++) {
      const row = document.createElement('md-table-row');
      row.dataset.idx = String(i);
      container.appendChild(row);
    }
    document.body.appendChild(container);
    // Deterministic rAF: run the frame callback synchronously. Patch the
    // GLOBAL binding (Stencil's mock-doc rAF is async setTimeout-based and is
    // what the bare `requestAnimationFrame` identifier resolves to).
    savedRaf = globalThis.requestAnimationFrame;
    globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    }) as typeof requestAnimationFrame;
  });

  afterEach(() => {
    globalThis.requestAnimationFrame = savedRaf;
    container.remove();
  });

  it('prefers-reduced-motion: mutates instantly with no animation styles', () => {
    setReducedMotion(true);
    const mutate = jest.fn(() => container.appendChild(container.firstElementChild!));
    flipRows(container, mutate);
    expect(mutate).toHaveBeenCalledTimes(1);
    container.querySelectorAll('md-table-row').forEach((el) => {
      expect((el as HTMLElement).style.transition).toBe('');
      expect((el as HTMLElement).style.transform).toBe('');
    });
  });

  it('runs the mutation exactly once and never throws on zero-size elements', () => {
    setReducedMotion(false);
    // jsdom rects are 0x0 → no movers/enterers; the engine must no-op cleanly.
    const mutate = jest.fn();
    expect(() => flipRows(container, mutate, { enter: true, stagger: 18 })).not.toThrow();
    expect(mutate).toHaveBeenCalledTimes(1);
  });

  it('captureFlip returns a play() that is safe to call after any mutation', () => {
    setReducedMotion(false);
    const play = captureFlip(container, { enter: true });
    container.appendChild(container.firstElementChild!); // reorder
    expect(() => play()).not.toThrow();
  });

  it('captureFlip under reduced motion returns a no-op', () => {
    setReducedMotion(true);
    const play = captureFlip(container);
    expect(() => play()).not.toThrow();
  });

  it('animates movers with transform-only inline styles (mocked rects)', () => {
    setReducedMotion(false);
    const rows = Array.from(container.querySelectorAll('md-table-row')) as HTMLElement[];
    // First pass: rows at y = 0 / 52 / 104.
    let phase = 0;
    rows.forEach((el, i) => {
      jest.spyOn(el, 'getBoundingClientRect').mockImplementation(
        () =>
          ({
            // After the mutation (phase 1) row 0 and row 2 swap positions.
            top: phase === 0 ? i * 52 : i === 0 ? 104 : i === 2 ? 0 : 52,
            left: 0,
            height: 52,
            width: 400,
          }) as DOMRect,
      );
    });
    const play = captureFlip(container);
    phase = 1; // "mutate"
    play();
    // Moved rows are armed for a transform transition: willChange is set during
    // INVERT and the inline transform is released at PLAY (the transition
    // animates it back to rest). NB: jsdom's cssstyle drops `transition` values
    // containing var(), so we assert on willChange/transform instead — the
    // transition string itself is covered by the real-browser e2e checks.
    expect(rows[0].style.willChange).toBe('transform');
    expect(rows[2].style.willChange).toBe('transform');
    expect(rows[0].style.transform).toBe(''); // released at PLAY
    expect(rows[1].style.willChange).toBe(''); // unmoved row untouched
    expect(rows[1].style.transform).toBe('');
  });

  // ── Cleanup paths (audit: previously unasserted) ────────────────────────

  const mockSwap = () => {
    const rows = Array.from(container.querySelectorAll('md-table-row')) as HTMLElement[];
    let phase = 0;
    rows.forEach((el, i) => {
      jest.spyOn(el, 'getBoundingClientRect').mockImplementation(
        () =>
          ({
            top: phase === 0 ? i * 52 : i === 0 ? 104 : i === 2 ? 0 : 52,
            left: 0,
            height: 52,
            width: 400,
          }) as DOMRect,
      );
    });
    return { rows, mutate: () => (phase = 1) };
  };

  it('transitioncancel clears inline styles immediately', () => {
    setReducedMotion(false);
    const { rows, mutate } = mockSwap();
    const play = captureFlip(container);
    mutate();
    play();
    expect(rows[0].style.willChange).toBe('transform');
    rows[0].dispatchEvent(Object.assign(new Event('transitioncancel'), { propertyName: 'transform' }));
    expect(rows[0].style.willChange).toBe('');
    expect(rows[0].style.transform).toBe('');
  });

  it('timeout fallback clears stranded styles', () => {
    setReducedMotion(false);
    jest.useFakeTimers();
    try {
      const { rows, mutate } = mockSwap();
      const play = captureFlip(container);
      mutate();
      play();
      expect(rows[2].style.willChange).toBe('transform');
      jest.advanceTimersByTime(2000); // > 700ms + stagger cap
      expect(rows[2].style.willChange).toBe('');
      expect(rows[2].style.transform).toBe('');
    } finally {
      jest.useRealTimers();
    }
  });

  it('skips elements already mid-flight (never double-animates)', () => {
    setReducedMotion(false);
    const { rows, mutate } = mockSwap();
    rows[0].style.transition = 'transform 350ms ease';
    const play = captureFlip(container);
    mutate();
    play();
    // in-flight row untouched; the OTHER mover still animates
    expect(rows[0].style.willChange).toBe('');
    expect(rows[2].style.willChange).toBe('transform');
  });

});
