import { refreshNewSlots, reinsertSlot, SLOT_REFRESH_SETTLE_MS } from './slot-refresh';

// R6-15 (5-2): Chrome can build a newly rendered <slot> into its accessibility tree without the slotted content; re-inserting the
// slot one frame later restores it (work/d6-lab/s52, 5-2-003 / 5-2-004). These tests pin the helper's DOM behaviour.
describe('slot-refresh', () => {
  let savedRaf: typeof requestAnimationFrame;
  let savedTimeout: typeof setTimeout;
  let frames: FrameRequestCallback[];
  let timers: Array<[() => void, number]>;
  let host: HTMLElement;
  let root: ShadowRoot;
  let wrap: HTMLElement;
  let slot: HTMLSlotElement;

  beforeEach(() => {
    frames = [];
    timers = [];
    savedTimeout = globalThis.setTimeout;
    globalThis.setTimeout = ((cb: () => void, ms: number) => { timers.push([cb, ms]); return timers.length; }) as unknown as typeof setTimeout;
    savedRaf = globalThis.requestAnimationFrame;
    globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => { frames.push(cb); return frames.length; }) as typeof requestAnimationFrame;
    host = document.createElement('div');
    document.body.appendChild(host);
    root = host.attachShadow({ mode: 'open' });
    wrap = document.createElement('div');
    wrap.appendChild(document.createElement('span'));
    slot = document.createElement('slot');
    wrap.appendChild(slot);
    wrap.appendChild(document.createElement('i'));
    root.appendChild(wrap);
    host.appendChild(document.createTextNode('Slotted text'));
  });

  afterEach(() => {
    globalThis.requestAnimationFrame = savedRaf;
    globalThis.setTimeout = savedTimeout;
    host.remove();
    jest.restoreAllMocks();
  });

  const runFrames = () => { const due = frames; frames = []; due.forEach(cb => cb(0)); };
  const runTimers = () => { const due = timers; timers = []; due.forEach(([cb]) => cb()); };

  it('re-inserts a new default slot on the next frame, at the same place', () => {
    const remove = jest.spyOn(wrap, 'removeChild');
    const insert = jest.spyOn(wrap, 'insertBefore');
    refreshNewSlots(root);
    expect(remove).not.toHaveBeenCalled();
    expect(frames.length).toBe(1);
    runFrames();
    expect(remove).toHaveBeenCalledWith(slot);
    expect(insert).toHaveBeenCalledWith(slot, wrap.lastChild);
    expect(Array.from(wrap.children).map(el => el.localName)).toEqual(['span', 'slot', 'i']);
    expect(root.querySelector('slot')).toBe(slot);
  });

  it('re-inserts it once more after the settle delay, still at the same place', () => {
    refreshNewSlots(root);
    expect(timers.map(([, ms]) => ms)).toEqual([SLOT_REFRESH_SETTLE_MS]);
    runFrames();
    const remove = jest.spyOn(wrap, 'removeChild');
    const insert = jest.spyOn(wrap, 'insertBefore');
    runTimers();
    expect(remove).toHaveBeenCalledWith(slot);
    expect(insert).toHaveBeenCalledWith(slot, wrap.lastChild);
    expect(Array.from(wrap.children).map(el => el.localName)).toEqual(['span', 'slot', 'i']);
  });

  it('refreshes each slot element once, however often the host re-renders', () => {
    refreshNewSlots(root);
    runFrames();
    refreshNewSlots(root);
    refreshNewSlots(root);
    expect(frames.length).toBe(0);
    expect(timers.length).toBe(1);
  });

  it('refreshes a slot that a later render creates', () => {
    refreshNewSlots(root);
    runFrames();
    const later = document.createElement('slot');
    root.appendChild(later);
    const remove = jest.spyOn(root, 'removeChild');
    refreshNewSlots(root);
    expect(frames.length).toBe(1);
    runFrames();
    expect(remove).toHaveBeenCalledWith(later);
  });

  it('leaves named slots alone by default', () => {
    slot.setAttribute('name', 'icon');
    refreshNewSlots(root);
    expect(frames.length).toBe(0);
  });

  it('does nothing when the slot left the tree before the frame', () => {
    refreshNewSlots(root);
    slot.remove();
    const insert = jest.spyOn(wrap, 'insertBefore');
    runFrames();
    runTimers();
    expect(insert).not.toHaveBeenCalled();
  });

  it('keeps the slot in place while focus is inside the slotted content', () => {
    const button = document.createElement('button');
    host.appendChild(button);
    (slot as any).assignedElements = () => [button];
    const own = Object.getOwnPropertyDescriptor(document, 'activeElement');
    Object.defineProperty(document, 'activeElement', { configurable: true, get: () => button });
    try {
      expect(reinsertSlot(root, slot)).toBe(false);
      expect(slot.parentNode).toBe(wrap);
    } finally {
      if (own) Object.defineProperty(document, 'activeElement', own); else delete (document as any).activeElement;
    }
  });
});
