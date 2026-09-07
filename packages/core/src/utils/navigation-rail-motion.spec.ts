import {
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
