import { newSpecPage } from '@stencil/core/testing';
import { MdAutocomplete } from './md-autocomplete';

/** md-menu's first show waits for its initial paint. Keep that boundary under
 * test without depending on browser frame speed or sleeping for a fixed delay. */
describe('md-autocomplete deferred popup keyboard focus', () => {
  afterEach(() => jest.restoreAllMocks());

  async function setup() {
    const page = await newSpecPage({ components: [MdAutocomplete], html: '<md-autocomplete label="Fruit"></md-autocomplete>' });
    const root = page.root as HTMLElement & { options: unknown[]; open: boolean };
    root.options = [{ value: 'a', label: 'Apple' }, { value: 'b', label: 'Banana' }];
    await page.waitForChanges();
    const field = root.shadowRoot!.querySelector('md-text-field') as HTMLElement;
    const menu = root.shadowRoot!.querySelector('md-menu') as HTMLElement & { open: boolean };
    menu.open = false;
    const rows = [...root.shadowRoot!.querySelectorAll('md-menu-item')] as HTMLElement[];
    const focus = rows.map(row => jest.spyOn(row, 'focus'));
    let frameId = 0;
    const frames = new Map<number, FrameRequestCallback>();
    jest.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(callback => {
      frames.set(++frameId, callback);
      return frameId;
    });
    jest.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(id => { frames.delete(id); });
    const paint = () => {
      const pending = [...frames];
      for (const [id, callback] of pending) if (frames.delete(id)) callback(0);
    };
    const key = (value: string) => field.dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true, composed: true }));
    const openMenu = () => {
      menu.open = true;
      menu.dispatchEvent(new CustomEvent('mdOpen'));
    };
    return { page, root, field, menu, focus, paint, key, openMenu };
  }

  it.each(['ArrowDown', 'ArrowUp'])('%s retains its focus request until the popup opens and paints', async keyName => {
    const { page, root, focus, paint, key, openMenu } = await setup();
    key(keyName);
    await page.waitForChanges();
    expect(root.open).toBe(true);
    paint();
    paint();
    expect(focus[0]).not.toHaveBeenCalled();
    expect(focus[1]).not.toHaveBeenCalled();
    openMenu();
    paint();
    expect(focus[0]).not.toHaveBeenCalled();
    expect(focus[1]).not.toHaveBeenCalled();
    paint();
    expect(focus[keyName === 'ArrowDown' ? 0 : 1]).toHaveBeenCalledTimes(1);
    expect(focus[keyName === 'ArrowDown' ? 1 : 0]).not.toHaveBeenCalled();
  });

  it('retains ArrowDown after typing has requested an open popup', async () => {
    const { page, field, root, focus, paint, key, openMenu } = await setup();
    field.dispatchEvent(new CustomEvent('mdInput', { detail: 'a' }));
    await page.waitForChanges();
    expect(root.open).toBe(true);
    key('ArrowDown');
    paint();
    paint();
    expect(focus[0]).not.toHaveBeenCalled();
    openMenu();
    paint();
    paint();
    expect(focus[0]).toHaveBeenCalledTimes(1);
  });

  it.each(['Escape', 'typing', 'disconnect'])('cancels pending keyboard focus on %s', async action => {
    const { page, root, field, focus, paint, key, openMenu } = await setup();
    key('ArrowDown');
    await page.waitForChanges();
    openMenu();
    paint();
    if (action === 'Escape') key('Escape');
    else if (action === 'typing') field.dispatchEvent(new CustomEvent('mdInput', { detail: 'a' }));
    else root.remove();
    await page.waitForChanges();
    paint();
    paint();
    expect(focus[0]).not.toHaveBeenCalled();
    expect(focus[1]).not.toHaveBeenCalled();
  });
});
