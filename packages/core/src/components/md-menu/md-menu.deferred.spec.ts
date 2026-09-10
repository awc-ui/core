import { newSpecPage } from '@stencil/core/testing';
import { MdMenu } from './md-menu';
import { MdMenuItem } from '../md-menu-item/md-menu-item';
import { MdFabMenu } from '../md-fab-menu/md-fab-menu';
import { MdFabMenuItem } from '../md-fab-menu-item/md-fab-menu-item';

describe.each(['md-menu', 'md-fab-menu'])('%s deferred opening work', (tag) => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  async function setup() {
    const item = tag === 'md-menu' ? 'md-menu-item' : 'md-fab-menu-item';
    const page = await newSpecPage({
      components: [MdMenu, MdMenuItem, MdFabMenu, MdFabMenuItem],
      html: `<${tag} anchor="trigger" quick><${item}>Action</${item}></${tag}>`,
    });
    const menu = page.root as HTMLMdMenuElement | HTMLMdFabMenuElement;
    const instance = page.rootInstance as any;
    // Complete the first native cycle before controlling the next frame.
    await menu.show();
    await menu.close();
    await menu.whenClosed();
    await page.waitForChanges();

    jest.useFakeTimers({ doNotFake: ['nextTick', 'queueMicrotask'] });
    const frames = new Map<number, FrameRequestCallback>();
    let id = 0;
    jest.spyOn(global, 'requestAnimationFrame').mockImplementation((callback) => {
      frames.set(++id, callback);
      return id;
    });
    jest.spyOn(global, 'cancelAnimationFrame').mockImplementation((frame) => { frames.delete(frame); });
    jest.spyOn(instance, 'positionMenu').mockImplementation(() => {});
    jest.spyOn(instance, tag === 'md-menu' ? 'startAnchorWatch' : 'startAnchorTracking').mockImplementation(() => {});
    const focus = jest.spyOn(instance, 'focusFirstItem').mockImplementation(() => {});
    const roving = jest.spyOn(instance, 'initRovingTabindex').mockImplementation(() => {});
    const add = jest.spyOn(document, 'addEventListener');
    const outsideListenerAdds = () => add.mock.calls.filter((call) => call[1] === instance.handleOutsideClick).length;
    const flushFrames = () => {
      const queued = [...frames.values()];
      frames.clear();
      queued.forEach((callback) => callback(0));
    };
    return { page, menu, instance, frames, focus, roving, outsideListenerAdds, flushFrames };
  }

  it.each(['close', 'disconnect'])('cancels listeners and focus when %s precedes the opening frame', async (action) => {
    const { menu, instance, frames, focus, roving, outsideListenerAdds } = await setup();
    instance.openedViaKeyboard = true;
    await menu.show();
    jest.runOnlyPendingTimers();
    const staleFrames = [...frames.values()];

    if (action === 'close') await menu.close();
    else {
      menu.remove();
      instance.disconnectedCallback();
    }
    // Already-queued callbacks remain harmless even if cancellation arrives late.
    staleFrames.forEach((callback) => callback(0));
    expect(outsideListenerAdds()).toBe(0);
    expect(focus).not.toHaveBeenCalled();
    expect(roving).not.toHaveBeenCalled();
  });

  it('discards old autofocus and reattaches listeners when show interrupts an animated close', async () => {
    const { menu, instance, frames, focus, roving, outsideListenerAdds, flushFrames } = await setup();
    menu.quick = false;
    instance.openedViaKeyboard = true;
    await menu.show();
    jest.runOnlyPendingTimers();
    const staleFrames = [...frames.values()];
    await menu.close();
    expect(menu.open).toBe(true);
    if (tag === 'md-menu') await (menu as HTMLMdMenuElement).show({ autoFocus: false });
    else await menu.show();
    jest.runOnlyPendingTimers();

    staleFrames.forEach((callback) => callback(0));
    expect(focus).not.toHaveBeenCalled();
    flushFrames();
    expect(outsideListenerAdds()).toBe(1);
    expect(roving).toHaveBeenCalledTimes(1);
    expect(focus).not.toHaveBeenCalled();
    expect(menu.open).toBe(true);
  });

  it('does not resume opening work after an mdOpen handler immediately closes', async () => {
    const { menu, instance, focus, roving, outsideListenerAdds, flushFrames } = await setup();
    menu.addEventListener('mdOpen', () => { void menu.close(); });
    instance.openedViaKeyboard = true;
    await menu.show();
    jest.runOnlyPendingTimers();
    flushFrames();
    expect(menu.open).toBe(false);
    expect(outsideListenerAdds()).toBe(0);
    expect(focus).not.toHaveBeenCalled();
    expect(roving).not.toHaveBeenCalled();
  });
});
