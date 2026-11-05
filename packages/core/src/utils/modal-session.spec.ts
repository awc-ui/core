import { createDocument } from '@stencil/core/mock-doc';
import { ModalSession } from './modal-session';

describe('shared modal sessions', () => {
  const acquired: ModalSession[] = [];
  const document = () => createDocument() as unknown as Document;
  const element = (doc: Document, tag = 'md-dialog') => {
    const el = doc.createElement('section'); el.setAttribute('data-modal-type', tag); doc.body.appendChild(el); return el;
  };
  const session = (el: HTMLElement, onCovered?: () => void) => {
    const value = new ModalSession(() => el, onCovered); acquired.push(value); return value;
  };
  const active = (root: Document | ShadowRoot, el: Element) => {
    Object.defineProperty(root, 'activeElement', { configurable: true, get: () => el });
  };
  afterEach(() => { acquired.splice(0).reverse().forEach(value => value.release()); jest.restoreAllMocks(); });

  it('shares one lock across different modal types and releases it after the last owner', () => {
    const doc = document(); doc.body.style.overflow = 'scroll';
    const sheet = session(element(doc, 'md-bottom-sheet'));
    const dialog = session(element(doc));
    sheet.acquire(); dialog.acquire();
    expect(sheet.owns).toBe(true); expect(sheet.isTop()).toBe(false);
    expect(dialog.isTop()).toBe(true); expect(dialog.document).toBe(doc);
    sheet.release(); expect(doc.body.style.overflow).toBe('hidden');
    dialog.release(); expect(doc.body.style.overflow).toBe('scroll');
    expect(dialog.owns).toBe(false); expect(dialog.document).toBeUndefined();
  });

  it('preserves the original overflow priority and handles duplicate acquire/release', () => {
    const doc = document(); doc.body.style.overflow = 'clip';
    Object.defineProperty(doc.body.style, 'getPropertyPriority', { configurable: true, value: () => 'important' });
    const set = jest.spyOn(doc.body.style, 'setProperty');
    const modal = session(element(doc)); modal.acquire(); modal.acquire();
    modal.release(); modal.release();
    expect(set.mock.calls).toEqual([['overflow', 'hidden'], ['overflow', 'clip', 'important']]);
  });

  it('notifies the covered owner after publishing the new top owner', () => {
    const doc = document(); let first: ModalSession, second: ModalSession;
    const covered = jest.fn(() => { expect(first.isTop()).toBe(false); expect(second.isTop()).toBe(true); });
    first = session(element(doc, 'md-bottom-sheet'), covered);
    second = session(element(doc)); first.acquire(); second.acquire(); second.acquire();
    expect(covered).toHaveBeenCalledTimes(1);
  });

  it('restores the deepest opener in the component own outer shadow root', () => {
    const doc = document(), outer = element(doc, 'app-shell');
    const root = outer.attachShadow({ mode: 'closed' });
    const triggerHost = doc.createElement('app-trigger'); root.appendChild(triggerHost);
    const triggerRoot = triggerHost.attachShadow({ mode: 'open' });
    const trigger = doc.createElement('button'); triggerRoot.appendChild(trigger);
    const modalEl = doc.createElement('md-dialog'); root.appendChild(modalEl);
    active(doc, outer); active(root, triggerHost); active(triggerRoot, trigger);
    const focus = jest.spyOn(trigger, 'focus');
    const modal = session(modalEl); modal.acquire(); modal.release();
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it('forwards the original opener across a lower owner closing out of order', () => {
    const doc = document(), trigger = element(doc, 'button');
    const lowerEl = element(doc, 'md-bottom-sheet'), upperEl = element(doc);
    const nested = doc.createElement('app-control'); lowerEl.appendChild(nested);
    const nestedRoot = nested.attachShadow({ mode: 'open' });
    const inner = doc.createElement('button'); nestedRoot.appendChild(inner);
    const outerFocus = jest.spyOn(trigger, 'focus'), innerFocus = jest.spyOn(inner, 'focus');
    active(doc, trigger); const lower = session(lowerEl); lower.acquire();
    active(doc, nested); active(nestedRoot, inner); const upper = session(upperEl); upper.acquire();
    lower.release(); expect(outerFocus).not.toHaveBeenCalled();
    upper.release(); expect(outerFocus).toHaveBeenCalledTimes(1); expect(innerFocus).not.toHaveBeenCalled();
  });

  it('retains the acquired document during adoption and locks the destination independently', () => {
    const source = document(), destination = document(), el = element(source);
    source.body.style.overflow = 'scroll'; destination.body.style.overflow = 'clip';
    const modal = session(el); modal.acquire();
    Object.defineProperty(el, 'ownerDocument', { configurable: true, get: () => destination });
    expect(modal.document).toBe(source); expect(modal.isTop()).toBe(false);
    modal.acquire(); expect(source.body.style.overflow).toBe('scroll');
    expect(destination.body.style.overflow).toBe('hidden'); expect(modal.document).toBe(destination);
    modal.release(); expect(destination.body.style.overflow).toBe('clip');
  });

  it('keeps another owner locked in the old document when a top modal is adopted away', () => {
    const doc = document(), destination = document(); doc.body.style.overflow = 'scroll';
    const lower = session(element(doc, 'md-bottom-sheet')), el = element(doc), upper = session(el);
    lower.acquire(); upper.acquire();
    Object.defineProperty(el, 'ownerDocument', { configurable: true, get: () => destination });
    upper.release(); expect(doc.body.style.overflow).toBe('hidden'); expect(lower.isTop()).toBe(true);
    lower.release(); expect(doc.body.style.overflow).toBe('scroll');
  });

  it('clears ownership before restoring focus so a synchronous reopen survives', () => {
    const doc = document(), trigger = element(doc, 'button'), modal = session(element(doc));
    active(doc, trigger); modal.acquire();
    const focus = jest.spyOn(trigger, 'focus').mockImplementationOnce(() => modal.acquire());
    modal.release(); expect(modal.owns).toBe(true); expect(modal.isTop()).toBe(true);
    expect(doc.body.style.overflow).toBe('hidden');
    focus.mockRestore(); modal.release(); expect(doc.body.style.overflow).toBe('');
  });

  it('does not restore a removed opener', () => {
    const doc = document(), trigger = element(doc, 'button'), modal = session(element(doc));
    active(doc, trigger); const focus = jest.spyOn(trigger, 'focus'); modal.acquire(); trigger.remove();
    modal.release(); expect(focus).not.toHaveBeenCalled();
  });
});
