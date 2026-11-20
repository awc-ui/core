import { captureFlip } from './flip';

/**
 * A glide's cleanup (its transitionend / transitioncancel listener or the fallback timer) belongs to that glide only.
 * md-table brackets every sort with captureFlip; a sort made within the fallback window (700 ms + stagger cap) of the
 * previous one used to lose its glide when the previous glide's timer fired and cleared the row's inline transition.
 */
describe('flip util: a previous glide never clears a newer one', () => {
  let container: HTMLElement;
  let savedRaf: typeof requestAnimationFrame;

  beforeEach(() => {
    (window as any).matchMedia = jest.fn().mockReturnValue({ matches: false });
    container = document.createElement('div');
    for (let i = 0; i < 3; i++) container.appendChild(document.createElement('md-table-row'));
    document.body.appendChild(container);
    savedRaf = globalThis.requestAnimationFrame;
    globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    }) as typeof requestAnimationFrame;
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    globalThis.requestAnimationFrame = savedRaf;
    container.remove();
  });

  /** Rows 0 and 2 swap places on every mutation (phase 0: 0 / 52 / 104). */
  const swapping = () => {
    const rows = Array.from(container.querySelectorAll('md-table-row')) as HTMLElement[];
    let phase = 0;
    rows.forEach((el, i) => {
      jest.spyOn(el, 'getBoundingClientRect').mockImplementation(() => {
        const slot = phase % 2 === 0 ? i : i === 0 ? 2 : i === 2 ? 0 : 1;
        return { top: slot * 52, left: 0, height: 52, width: 400 } as DOMRect;
      });
    });
    return { rows, mutate: () => (phase += 1) };
  };
  const end = (el: HTMLElement) => el.dispatchEvent(Object.assign(new Event('transitionend'), { propertyName: 'transform' }));

  it("the previous glide's fallback timer leaves the next glide running", () => {
    const { rows, mutate } = swapping();
    // Sort 1: rows 0 and 2 glide, then finish (transitionend) as they do in the browser.
    let play = captureFlip(container, { stagger: 18, staggerCap: 6 });
    mutate();
    play();
    expect(rows[0].style.willChange).toBe('transform');
    rows.forEach(end);
    expect(rows[0].style.willChange).toBe('');
    // Sort 2, 500 ms later (inside sort 1's 808 ms fallback window): the rows glide back.
    jest.advanceTimersByTime(500);
    play = captureFlip(container, { stagger: 18, staggerCap: 6 });
    mutate();
    play();
    expect(rows[0].style.willChange).toBe('transform');
    expect(rows[2].style.willChange).toBe('transform');
    // Sort 1's fallback timer is due now; sort 2's glide must keep running.
    jest.advanceTimersByTime(400);
    expect(rows[0].style.willChange).toBe('transform');
    expect(rows[2].style.willChange).toBe('transform');
    // Sort 2's own cleanup still runs (its fallback timer).
    jest.advanceTimersByTime(1000);
    expect(rows[0].style.willChange).toBe('');
    expect(rows[2].style.transform).toBe('');
  });
});
