import { newSpecPage } from '@stencil/core/testing';
import { createDocument } from '@stencil/core/mock-doc';
import { MdBottomSheet } from './md-bottom-sheet';

describe('md-bottom-sheet gesture and document resource ownership', () => {
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
  const pointer = (target: Element, type: string, y: number) => {
    const event = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0 });
    Object.defineProperties(event, { clientY: { value: y }, pointerId: { value: 42 } });
    target.dispatchEvent(event);
  };

  it('cancels an underlying gesture immediately when another sheet takes ownership', async () => {
    const page = await newSpecPage({ components: [MdBottomSheet], html: '<md-bottom-sheet open id="lower">One</md-bottom-sheet><md-bottom-sheet id="upper">Two</md-bottom-sheet>' });
    const lower = page.doc.querySelector('#lower')!, upper = page.doc.querySelector('#upper')!;
    const handle = lower.shadowRoot!.querySelector('[part="drag-handle"]')!;
    const panel = lower.shadowRoot!.querySelector('[part="container"]') as HTMLElement;
    const cancel = jest.fn(); lower.addEventListener('mdCancel', cancel);
    pointer(handle, 'pointerdown', 10); pointer(handle, 'pointermove', 150);
    expect(panel.style.transform).toBe('translateY(140px)');
    upper.setAttribute('open', ''); await page.waitForChanges();
    expect(panel.style.transform).toBe(''); expect(panel.style.transition).toBe('');
    pointer(handle, 'pointermove', 180); pointer(handle, 'pointerup', 180);
    await page.waitForChanges();
    expect(lower.hasAttribute('open')).toBe(true); expect(cancel).not.toHaveBeenCalled();
    upper.removeAttribute('open'); await page.waitForChanges();
    pointer(handle, 'pointerup', 180);
    expect(lower.hasAttribute('open')).toBe(true);
  });

  it('releases the original document after adoption changes ownerDocument before disconnect', async () => {
    const page = await newSpecPage({ components: [MdBottomSheet], html: '<md-bottom-sheet>Body</md-bottom-sheet>' });
    const sheet = page.root!, instance = page.rootInstance;
    const original = page.doc, destination = createDocument();
    original.body.style.overflow = 'scroll'; destination.body.style.overflow = 'clip';
    instance.open = true; await page.waitForChanges();
    const removeOld = jest.spyOn(original, 'removeEventListener'), addNew = jest.spyOn(destination, 'addEventListener');
    // DOM adoption callbacks run after ownerDocument has changed. The mock
    // document lacks adoptNode; change only that boundary and invoke callbacks.
    Object.defineProperty(sheet, 'ownerDocument', { configurable: true, get: () => destination });
    instance.disconnectedCallback();
    expect(original.body.style.overflow).toBe('scroll');
    expect(destination.body.style.overflow).toBe('clip');
    expect(removeOld).toHaveBeenCalledWith('keydown', instance.handleDocKeyDown);
    expect(removeOld).toHaveBeenCalledWith('focusin', instance.handleDocFocusIn);
    instance.connectedCallback();
    expect(destination.body.style.overflow).toBe('hidden');
    expect(addNew).toHaveBeenCalledWith('keydown', instance.handleDocKeyDown);
    instance.disconnectedCallback();
    expect(destination.body.style.overflow).toBe('clip');
    expect(original.body.style.overflow).toBe('scroll');
  });

  it('keeps another sheet locked in the original document when one is adopted away', async () => {
    const page = await newSpecPage({ components: [MdBottomSheet], html: '<md-bottom-sheet id="first">One</md-bottom-sheet><md-bottom-sheet id="second">Two</md-bottom-sheet>' });
    const first = page.doc.querySelector('#first')!, second = page.doc.querySelector('#second')!;
    page.doc.body.style.overflow = 'scroll';
    first.setAttribute('open', ''); second.setAttribute('open', ''); await page.waitForChanges();
    const secondInstance = instances.find(instance => instance.el === second)!;
    const destination = createDocument();
    Object.defineProperty(second, 'ownerDocument', { configurable: true, get: () => destination });
    secondInstance.disconnectedCallback();
    expect(page.doc.body.style.overflow).toBe('hidden');
    first.removeAttribute('open'); await page.waitForChanges();
    expect(page.doc.body.style.overflow).toBe('scroll');
  });
});
