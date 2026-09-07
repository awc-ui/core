import {
  getRailTransitionTiming,
  parseRailMotionDuration,
  synchronizeRailAnimation,
  prepareRailTabTransition,
  registerRailTabTransition,
} from './navigation-rail-motion';

describe('navigation rail motion registration', () => {
  it('prepares registered tabs and stops after disconnect cleanup', () => {
    const tab = document.createElement('md-navigation-rail-tab');
    const capture = jest.fn();
    const unregister = registerRailTabTransition(tab, capture);
    prepareRailTabTransition(tab);
    expect(capture).toHaveBeenCalledTimes(1);
    unregister();
    prepareRailTabTransition(tab);
    expect(capture).toHaveBeenCalledTimes(1);
  });

  it('preserves a new registration when an older connection cleans up', () => {
    const tab = document.createElement('md-navigation-rail-tab');
    const previous = jest.fn();
    const current = jest.fn();
    const unregisterPrevious = registerRailTabTransition(tab, previous);
    const unregisterCurrent = registerRailTabTransition(tab, current);
    unregisterPrevious();
    prepareRailTabTransition(tab);
    expect(previous).not.toHaveBeenCalled();
    expect(current).toHaveBeenCalledTimes(1);
    unregisterCurrent();
  });

  it('ignores a destination without a registered transition', () => {
    const tab = document.createElement('md-navigation-rail-tab');
    expect(() => prepareRailTabTransition(tab)).not.toThrow();
  });
});

describe('navigation rail transition clock', () => {
  afterEach(() => jest.restoreAllMocks());

  function fixture(modal = false) {
    const rail = document.createElement('md-navigation-rail');
    const tab = document.createElement('md-navigation-rail-tab');
    rail.append(tab);
    let surface: HTMLElement = rail;
    if (modal) {
      rail.setAttribute('modal', '');
      const shadow = rail.attachShadow({ mode: 'open' });
      surface = document.createElement('div');
      surface.setAttribute('part', 'container');
      shadow.append(surface);
    }
    const getAnimations = jest.fn(() => [] as Animation[]);
    surface.getAnimations = getAnimations;
    return { rail, tab, surface, getAnimations };
  }

  function widthTransition(duration: number, startTime: number | null = 120) {
    return {
      transitionProperty: 'width', playState: 'running', startTime,
      effect: {
        getTiming: () => ({ duration, easing: 'linear' }),
        getComputedTiming: () => ({ duration }),
        getKeyframes: () => [{ easing: 'cubic-bezier(0.2, 0, 0, 1)' }, { easing: 'linear' }],
      },
    } as unknown as Animation;
  }

  it.each([
    ['200ms', 200], ['0.4s', 400], ['0ms', 0], ['0s', 0], ['', 200], ['-2ms', 200], ['invalid', 200],
  ])('parses duration %s without replacing valid zero values', (raw, expected) => {
    expect(parseRailMotionDuration(raw as string)).toBe(expected);
  });

  it.each([false, true])('uses the actual width reversal duration and easing (modal=%s)', (modal) => {
    const f = fixture(modal);
    const source = widthTransition(64);
    f.getAnimations.mockReturnValue([
      { ...source, transitionProperty: 'max-width' } as Animation & { transitionProperty: string }, source,
    ]);
    const timing = getRailTransitionTiming(f.tab, { duration: 200, easing: 'ease-out' });
    expect(timing.duration).toBe(64);
    expect(timing.easing).toBe('cubic-bezier(0.2, 0, 0, 1)');
    expect(timing.source).toBe(source);
  });

  it('keeps authored fallback motion for isolated tabs or an unavailable animation API', () => {
    const fallback = { duration: 140, easing: 'linear' };
    expect(getRailTransitionTiming(document.createElement('md-navigation-rail-tab'), fallback)).toEqual(fallback);
    const f = fixture();
    expect(getRailTransitionTiming(f.tab, fallback)).toEqual(fallback);
  });

  it.each(['none', 'width'])('recognizes disabled CSS transitions without an Animation object (%s)', (property) => {
    const f = fixture();
    jest.spyOn(globalThis, 'getComputedStyle').mockReturnValue({ transitionProperty: property, transitionDuration: '0s' } as CSSStyleDeclaration);
    expect(getRailTransitionTiming(f.tab, { duration: 200, easing: 'linear' }).duration).toBe(0);
  });

  it('aligns the destination start time with the existing parent transition', () => {
    const source = widthTransition(64, 1234);
    const target = { startTime: 1300 } as Animation;
    synchronizeRailAnimation(target, source, () => true);
    expect(target.startTime).toBe(1234);
  });

  it('aligns a pending parent clock when ready and ignores canceled destination work', async () => {
    let ready!: () => void;
    const source = widthTransition(64, null);
    Object.defineProperty(source, 'ready', { value: new Promise<void>(resolve => { ready = resolve; }) });
    const target = { startTime: 1300 } as Animation;
    const stale = { startTime: 1400 } as Animation;
    synchronizeRailAnimation(target, source, () => true);
    synchronizeRailAnimation(stale, source, () => false);
    source.startTime = 1234;
    ready();
    await Promise.resolve();
    expect(target.startTime).toBe(1234);
    expect(stale.startTime).toBe(1400);
  });
});
