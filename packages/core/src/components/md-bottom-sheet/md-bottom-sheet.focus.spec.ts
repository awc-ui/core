import { newSpecPage } from '@stencil/core/testing';
import { MdBottomSheet } from './md-bottom-sheet';

describe('md-bottom-sheet composed focus and modal return ownership', () => {
  const instances: MdBottomSheet[] = [];
  beforeEach(() => {
    const activate = (MdBottomSheet.prototype as any).activateSession;
    jest.spyOn(MdBottomSheet.prototype as any, 'activateSession').mockImplementation(function(this: MdBottomSheet) {
      if (!instances.includes(this)) instances.push(this);
      return activate.call(this);
    });
  });
  afterEach(() => {
    instances.splice(0).reverse().forEach(instance => instance.disconnectedCallback());
    jest.restoreAllMocks();
  });

  for (const mode of ['open', 'closed'] as const) it(`recognizes its own focused control through an enclosing ${mode} shadow root`, async () => {
    const page = await newSpecPage({ components: [MdBottomSheet], html: '<md-bottom-sheet open><input id="inside"></md-bottom-sheet>' });
    const sheet = page.root!, inside = sheet.querySelector('input')!;
    const outer = page.doc.createElement('section'); page.doc.body.append(outer);
    const shadow = outer.attachShadow({ mode }); shadow.append(sheet);
    Object.defineProperty(page.doc, 'activeElement', { configurable: true, get: () => outer });
    Object.defineProperty(shadow, 'activeElement', { configurable: true, get: () => inside });
    const focus = jest.spyOn(page.rootInstance as any, 'focusFirst');
    (page.rootInstance as any).handleDocFocusIn();
    expect(focus).not.toHaveBeenCalled();
  });

  for (const mode of ['open', 'closed'] as const) it(`restores an opener within its enclosing ${mode} shadow root`, async () => {
    const page = await newSpecPage({ components: [MdBottomSheet], html: '<md-bottom-sheet><input></md-bottom-sheet>' });
    const outer = page.doc.createElement('section'); page.doc.body.append(outer);
    const opener = page.doc.createElement('button'), shadow = outer.attachShadow({ mode });
    shadow.append(opener, page.root!);
    Object.defineProperty(page.doc, 'activeElement', { configurable: true, get: () => outer });
    Object.defineProperty(shadow, 'activeElement', { configurable: true, get: () => opener });
    page.rootInstance.open = true; await page.waitForChanges();
    const restore = jest.spyOn(opener, 'focus');
    page.rootInstance.open = false; await page.waitForChanges();
    expect(restore).toHaveBeenCalledWith({ preventScroll: true });
  });

  it('keeps the original opener when a lower sheet closes underneath the active sheet', async () => {
    const page = await newSpecPage({ components: [MdBottomSheet], html: '<button id="opener">Open</button><md-bottom-sheet id="lower"><button id="lower-control">Next</button></md-bottom-sheet><md-bottom-sheet id="upper"><button>Done</button></md-bottom-sheet>' });
    const opener = page.doc.querySelector('#opener') as HTMLElement;
    const lower = page.doc.querySelector('#lower')!, upper = page.doc.querySelector('#upper')!;
    const lowerControl = page.doc.querySelector('#lower-control') as HTMLElement;
    let active: Element = opener;
    Object.defineProperty(page.doc, 'activeElement', { configurable: true, get: () => active });
    lower.setAttribute('open', ''); await page.waitForChanges();
    active = lowerControl;
    upper.setAttribute('open', ''); await page.waitForChanges();
    const restoreOpener = jest.spyOn(opener, 'focus'), restoreClosedContent = jest.spyOn(lowerControl, 'focus');
    lower.removeAttribute('open'); await page.waitForChanges();
    expect(restoreOpener).not.toHaveBeenCalled();
    upper.removeAttribute('open'); await page.waitForChanges();
    expect(restoreOpener).toHaveBeenCalledWith({ preventScroll: true });
    expect(restoreClosedContent).not.toHaveBeenCalled();
  });

  it('skips disabled fieldset controls while retaining its first legend controls and ordinary links', async () => {
    const page = await newSpecPage({ components: [MdBottomSheet], html: '<md-bottom-sheet open><fieldset disabled><legend><button id="legend">Legend action</button></legend><input id="disabled"><button id="disabled-button">Disabled</button><a id="link" href="#ok">Link</a></fieldset><button id="enabled">Continue</button></md-bottom-sheet>' });
    const elements = (page.rootInstance as any).getFocusableElements() as HTMLElement[];
    expect(elements.map(element => element.id)).toEqual(['legend', 'link', 'enabled']);
  });
});
