import { newSpecPage } from '@stencil/core/testing';
import { MdSideSheet } from './md-side-sheet';

const mountedSheets: MdSideSheet[] = [];
beforeEach(() => {
  const loaded = MdSideSheet.prototype.componentDidLoad;
  jest.spyOn(MdSideSheet.prototype, 'componentDidLoad').mockImplementation(function(this: MdSideSheet) {
    mountedSheets.push(this); return loaded.call(this);
  });
});
afterEach(() => {
  mountedSheets.splice(0).reverse().forEach(sheet => sheet.disconnectedCallback());
  jest.restoreAllMocks();
});

describe('md-side-sheet public chrome and focus', () => {
  it('back preserves the open panel, close cancels and resolves whenClosed', async () => {
    const page = await newSpecPage({ components: [MdSideSheet], html: '<md-side-sheet open variant="modal" show-back bottom-divider><button slot="actions">Apply</button></md-side-sheet>' });
    const root = page.root as HTMLMdSideSheetElement;
    const back = jest.fn(); const cancel = jest.fn();
    root.addEventListener('mdBack', back); root.addEventListener('mdCancel', cancel);
    root.shadowRoot!.querySelector('.md-side-sheet__back md-icon-button')!.dispatchEvent(new MouseEvent('click'));
    expect(back).toHaveBeenCalledTimes(1);
    expect(root.open).toBe(true);
    expect(root.shadowRoot!.querySelector('[part="divider-bottom"]')).not.toBeNull();
    root.shadowRoot!.querySelector('.md-side-sheet__close md-icon-button')!.dispatchEvent(new MouseEvent('click'));
    await page.waitForChanges();
    await root.whenClosed();
    expect(root.open).toBe(false);
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('honors scrimDismissible while exposing explicit close', async () => {
    const page = await newSpecPage({ components: [MdSideSheet], html: '<md-side-sheet open variant="modal" scrim-dismissible="false"></md-side-sheet>' });
    const root = page.root as HTMLMdSideSheetElement;
    const cancel = jest.fn(); root.addEventListener('mdCancel', cancel);
    root.shadowRoot!.querySelector('[part="scrim"]')!.dispatchEvent(new MouseEvent('click'));
    expect(root.open).toBe(true); expect(cancel).not.toHaveBeenCalled();
    root.scrimDismissible = true; await page.waitForChanges();
    root.shadowRoot!.querySelector('[part="scrim"]')!.dispatchEvent(new MouseEvent('click'));
    await page.waitForChanges();
    expect(root.open).toBe(false); expect(cancel).toHaveBeenCalledTimes(1);
  });

  it.each([false, true])('focus guards wrap %s slotted controls without calling private handlers', async controls => {
    const page = await newSpecPage({ components: [MdSideSheet], html: `<md-side-sheet open variant="modal" closeable="false">${controls ? '<button id="first">First</button><div><button id="last">Last</button></div>' : ''}</md-side-sheet>` });
    const root = page.root!;
    const container = root.shadowRoot!.querySelector('[part="container"]') as HTMLElement;
    const first = controls ? root.querySelector('#first') as HTMLElement : container;
    const last = controls ? root.querySelector('#last') as HTMLElement : container;
    const firstFocus = jest.spyOn(first, 'focus').mockImplementation(() => undefined);
    const lastFocus = last === first ? firstFocus : jest.spyOn(last, 'focus').mockImplementation(() => undefined);
    const guards = root.shadowRoot!.querySelectorAll('.md-side-sheet__focus-guard');
    expect(guards.length).toBe(2);
    guards.forEach(guard => jest.spyOn(guard as HTMLElement, 'focus').mockImplementation(() => undefined));
    guards[0].dispatchEvent(new FocusEvent('focus'));
    expect(lastFocus).toHaveBeenCalled();
    guards[1].dispatchEvent(new FocusEvent('focus'));
    expect(firstFocus).toHaveBeenCalled();
  });
});

describe('md-side-sheet modal escaped focus recovery', () => {
  it('focuses the first real content control when focus leaves the modal', async () => {
    const page = await newSpecPage({ components: [MdSideSheet], html: '<button id="outside">Outside</button><md-side-sheet open variant="modal" closeable="false"><button id="first">First</button></md-side-sheet>' });
    const sheet = page.body.querySelector('md-side-sheet')!;
    const focus = jest.spyOn(sheet.querySelector('#first') as HTMLElement, 'focus').mockImplementation(() => undefined);
    Object.defineProperty(page.doc, 'activeElement', { configurable: true, get: () => page.body.querySelector('#outside') });
    page.doc.dispatchEvent(new FocusEvent('focusin'));
    expect(focus).toHaveBeenCalled();
  });
});

describe('md-side-sheet scheduled modal focus', () => {
  it.each([false, true])('enters the modal after rendering with slotted control=%s and restores the opener', async withControl => {
    const page = await newSpecPage({ components: [MdSideSheet], html: `<button id="opener">Details</button><md-side-sheet variant="modal" closeable="false">${withControl ? '<button id="action">Apply</button>' : 'Details'}</md-side-sheet>` });
    const root = page.body.querySelector('md-side-sheet') as HTMLMdSideSheetElement;
    const opener = page.body.querySelector('#opener') as HTMLElement;
    Object.defineProperty(page.doc, 'activeElement', { configurable: true, get: () => opener });
    const target = (withControl ? root.querySelector('#action') : root.shadowRoot!.querySelector('[part="container"]')) as HTMLElement;
    const focused = jest.spyOn(target, 'focus').mockImplementation(() => undefined);
    const restored = jest.spyOn(opener, 'focus').mockImplementation(() => undefined);
    const frames: FrameRequestCallback[] = [];
    const frame = jest.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(callback => { frames.push(callback); return frames.length; });
    try {
      await root.show(); await page.waitForChanges();
      while (frames.length) frames.shift()!(0);
      expect(focused).toHaveBeenCalled();
      expect(root.shadowRoot!.querySelector('[part="container"]')!.hasAttribute('inert')).toBe(false);
      expect(page.doc.body.style.overflow).toBe('hidden');
      const consumed = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }); consumed.preventDefault();
      page.doc.dispatchEvent(consumed); expect(root.open).toBe(true);
      await root.close(); await page.waitForChanges(); await root.whenClosed();
      expect(restored).toHaveBeenCalledWith({ preventScroll: true });
      expect(page.doc.body.style.overflow).toBe('');
    } finally { frame.mockRestore(); }
  });
});
