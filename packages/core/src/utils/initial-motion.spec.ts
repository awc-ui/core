import { Build } from '@stencil/core';
import { MockWindow } from '@stencil/core/mock-doc';
import {
  beginInitialInteractionMotion as begin,
  completeInitialInteractionMotion as loaded,
  initialInteractionMotionRendered as rendered,
  reconnectInteractionMotion as reconnect,
  disconnectInteractionMotion as disconnect,
  canAnimateInteraction as canAnimate,
  prepareInteractionUpdate,
  suppressInteractionMotion,
} from './initial-motion';

describe('initial interaction motion', () => {
  let originalBrowser: boolean;
  let fixtureWindow: Window;
  let fixtureDocument: Document;
  let capture: Map<string, EventListener>;
  let sequence: number;
  let callbacks: Map<number, FrameRequestCallback>;
  let elements: HTMLElement[];

  const frame = async () => {
    const work = [...callbacks.values()];
    callbacks.clear();
    work.forEach(callback => callback(0));
    await Promise.resolve();
  };
  const control = (owner: HTMLElement = fixtureDocument.body) => {
    const element = fixtureDocument.createElement('div');
    owner.appendChild(element);
    elements.push(element);
    begin(element);
    rendered(element);
    return element;
  };
  const click = (element: HTMLElement) => {
    const event = new MouseEvent('click', { bubbles: true, composed: true });
    const path: EventTarget[] = [element];
    for (let node = element.parentNode; node; node = node.parentNode) path.push(node);
    Object.defineProperty(event, 'composedPath', { value: () => path });
    Object.defineProperty(event, 'eventPhase', { configurable: true, value: 1 });
    capture.get('click')?.(event);
    element.dispatchEvent(event);
    Object.defineProperty(event, 'eventPhase', { value: 0 });
  };

  beforeEach(() => {
    originalBrowser = Build.isBrowser;
    Build.isBrowser = true;
    fixtureWindow = new MockWindow() as unknown as Window;
    fixtureDocument = fixtureWindow.document;
    capture = new Map();
    jest.spyOn(fixtureDocument, 'addEventListener').mockImplementation((type, listener) => {
      if (typeof listener === 'function') capture.set(type, listener as EventListener);
    });
    sequence = 0;
    callbacks = new Map();
    elements = [];
    fixtureWindow.requestAnimationFrame = callback => { callbacks.set(++sequence, callback); return sequence; };
    fixtureWindow.cancelAnimationFrame = id => { callbacks.delete(id); };
    fixtureWindow.matchMedia = jest.fn().mockReturnValue({ matches: false });
  });

  afterEach(async () => {
    elements.forEach(element => { disconnect(element); element.remove(); });
    await Promise.resolve();
    Build.isBrowser = originalBrowser;
  });

  it('does not serialize browser readiness or schedule frames during SSR', async () => {
    Build.isBrowser = false;
    const element = control();
    loaded(element);
    expect(element.hasAttribute('data-awc-motion-ready')).toBe(false);
    expect(callbacks.size).toBe(0);
  });

  it('commits the initial style baseline before enabling subsequent motion', async () => {
    const element = control();
    loaded(element);
    expect(canAnimate(element)).toBe(false);
    await frame();
    expect(canAnimate(element)).toBe(false);
    await frame();
    expect(canAnimate(element)).toBe(true);
    expect(callbacks.size).toBe(0);
  });

  it('includes initial reconciliation renders in the same quiet baseline', async () => {
    const element = control(); loaded(element); await frame();
    rendered(element);
    await frame(); expect(canAnimate(element)).toBe(false);
    await frame(); expect(canAnimate(element)).toBe(true);
  });

  it('waits for an initially asynchronous owner before arming its child', async () => {
    const owner = control();
    const child = control(owner); loaded(child);
    await frame(); await frame();
    expect(canAnimate(child)).toBe(false);
    expect(callbacks.size).toBe(0);
    loaded(owner); await frame(); await frame();
    expect(canAnimate(owner)).toBe(true);
    expect(canAnimate(child)).toBe(true);
  });

  it('quiets already-upgraded children when their owner first adopts them', async () => {
    const owner = fixtureDocument.createElement('div'); fixtureDocument.body.appendChild(owner); elements.push(owner);
    const child = control(owner); loaded(child); await frame(); await frame();
    expect(canAnimate(child)).toBe(true);
    begin(owner); rendered(owner);
    expect(canAnimate(child)).toBe(false);
    loaded(owner); await frame(); await frame();
    expect(canAnimate(child)).toBe(true);
  });

  it('quiets an upgraded destination forwarded through a slot during owner adoption', async () => {
    const owner = fixtureDocument.createElement('div');
    fixtureDocument.body.appendChild(owner);
    elements.push(owner);
    const slot = fixtureDocument.createElement('slot');
    owner.appendChild(slot);
    const child = control();
    Object.defineProperty(slot, 'assignedElements', { value: () => [child] });
    Object.defineProperty(child, 'assignedSlot', { value: slot });
    loaded(child);
    await frame(); await frame();
    expect(canAnimate(child)).toBe(true);

    begin(owner);
    rendered(owner);
    expect(child.hasAttribute('data-awc-motion-ready')).toBe(false);
    await frame(); await frame();
    expect(canAnimate(child)).toBe(false);

    loaded(owner);
    await frame(); await frame();
    expect(canAnimate(child)).toBe(true);
  });

  it('arms the first real input without arming an unrelated pending sibling', async () => {
    const first = control(); const sibling = control(); loaded(first); loaded(sibling);
    first.addEventListener('click', () => expect(canAnimate(first)).toBe(true));
    click(first);
    expect(canAnimate(first)).toBe(true);
    // Input provenance is only consumed by the destination which changes.
    expect(sibling.hasAttribute('data-awc-motion-ready')).toBe(false);
  });

  it('recognizes synchronous control updates from an external native opener', async () => {
    const destination = control(); const other = control(); loaded(destination); loaded(other);
    const opener = fixtureDocument.createElement('button'); fixtureDocument.body.appendChild(opener); elements.push(opener);
    opener.addEventListener('click', async () => { prepareInteractionUpdate(destination); });
    click(opener);
    expect(destination.hasAttribute('data-awc-motion-ready')).toBe(true);
    expect(other.hasAttribute('data-awc-motion-ready')).toBe(false);
  });

  it('retains the outer dispatch after a nested click returns', () => {
    const destination = control(); loaded(destination);
    const opener = fixtureDocument.createElement('button');
    const relay = fixtureDocument.createElement('span');
    fixtureDocument.body.append(opener, relay);
    elements.push(opener, relay);
    opener.addEventListener('click', () => {
      click(relay);
      prepareInteractionUpdate(destination);
    });

    click(opener);
    expect(destination.hasAttribute('data-awc-motion-ready')).toBe(true);
  });

  it('resumes a pending baseline after disconnect and reconnect', async () => {
    const element = control(); loaded(element); await frame();
    disconnect(element); element.remove();
    expect(callbacks.size).toBe(0);
    fixtureDocument.body.appendChild(element); reconnect(element);
    await frame(); await frame(); expect(canAnimate(element)).toBe(true);
  });

  it('commits an already-rendered baseline when adopted before the old document is discarded', () => {
    const element = control(); loaded(element);
    disconnect(element);
    const destination = new MockWindow() as unknown as Window;
    destination.document.body.appendChild(element);
    reconnect(element);
    expect(element.ownerDocument).toBe(destination.document);
    expect(element.hasAttribute('data-awc-motion-ready')).toBe(true);
    expect(callbacks.size).toBe(0);
  });

  it('preserves readiness on an ordinary DOM move without scheduling work', async () => {
    const element = control(); loaded(element); await frame(); await frame();
    disconnect(element); element.remove(); fixtureDocument.body.appendChild(element); reconnect(element);
    expect(canAnimate(element)).toBe(true);
    expect(callbacks.size).toBe(0);
  });

  it('suspends initial external-owner snapshots and then restores later motion', async () => {
    const element = control(); loaded(element); await frame(); await frame();
    suppressInteractionMotion(element);
    expect(canAnimate(element)).toBe(false);
    rendered(element); await frame(); await frame();
    expect(canAnimate(element)).toBe(true);
  });

  it('does no layout read for input after the initial baseline has settled', async () => {
    const element = control(); loaded(element); await frame(); await frame();
    const layout = jest.spyOn(element, 'getBoundingClientRect');
    click(element);
    expect(layout).not.toHaveBeenCalled();
  });

  it('does not arm detached feedback or reduced-motion interaction keyframes', async () => {
    const element = control(); loaded(element); await frame(); await frame();
    fixtureWindow.matchMedia = jest.fn().mockReturnValue({ matches: true });
    expect(canAnimate(element)).toBe(false);
    fixtureWindow.matchMedia = jest.fn().mockReturnValue({ matches: false });
    disconnect(element); element.remove();
    expect(canAnimate(element)).toBe(false);
  });
});
