import { newSpecPage } from '@stencil/core/testing';
import { MdCard } from './md-card';

const pointer = (type: string, x = 0) => Object.assign(
  new Event(type, { bubbles: true, cancelable: true }),
  { clientX: x, clientY: 10, button: 0, pointerId: 9, isPrimary: true },
);

describe('md-card authored interaction boundaries', () => {
  for (const cancel of ['disabled', 'drag-enabled', 'disconnect']) it(`does not continue a drag canceled synchronously by mdDragStart through ${cancel}`, async () => {
    const page = await newSpecPage({ components: [MdCard], html: '<md-card interactive drag-enabled>Content</md-card>' });
    const card = page.root!, instance = page.rootInstance as any;
    card.setPointerCapture = jest.fn(); card.releasePointerCapture = jest.fn();
    card.style.transform = 'scale(.8)'; card.style.zIndex = '4';
    const move = jest.fn(); card.addEventListener('mdDragMove', move);
    card.addEventListener('mdDragStart', () => {
      if (cancel === 'disconnect') instance.disconnectedCallback();
      else card.setAttribute(cancel, cancel === 'disabled' ? '' : 'false');
    });
    card.dispatchEvent(pointer('pointerdown'));
    card.dispatchEvent(pointer('pointermove', 20));
    await page.waitForChanges();
    expect(move).not.toHaveBeenCalled();
    expect(card.style.transform).toBe('scale(.8)'); expect(card.style.zIndex).toBe('4');
    expect(card).not.toHaveClass('md-card--dragged');
    expect(card.releasePointerCapture).toHaveBeenCalledWith(9);
    instance.disconnectedCallback();
  });

  it('observes authored shadow controls and releases detached roots', async () => {
    const previous = globalThis.MutationObserver;
    const observers: Array<{ callback: () => void; roots: Set<Node> }> = [];
    class Observer {
      roots = new Set<Node>();
      constructor(public callback: () => void) { observers.push(this); }
      observe(node: Node) { this.roots.add(node); }
      disconnect() { this.roots.clear(); }
    }
    (globalThis as any).MutationObserver = Observer;
    try {
      const page = await newSpecPage({ components: [MdCard], html: '<md-card interactive><custom-field></custom-field></md-card>' });
      const field = page.root!.querySelector('custom-field')!;
      const shadow = field.attachShadow({ mode: 'open' });
      shadow.innerHTML = '<button>Submit</button>';
      const observer = observers[observers.length - 1];
      observer.callback(); await page.waitForChanges();
      expect(observer.roots.has(shadow)).toBe(true);
      expect(page.root!.getAttribute('role')).toBeNull();
      shadow.querySelector('button')!.setAttribute('disabled', '');
      observer.callback(); await page.waitForChanges();
      expect(page.root!.getAttribute('role')).toBe('button');
      field.remove(); observer.callback(); await page.waitForChanges();
      expect(observer.roots.has(shadow)).toBe(false);
      page.rootInstance.disconnectedCallback();
      expect(observer.roots.size).toBe(0);
    } finally { globalThis.MutationObserver = previous; }
  });

  it('keeps container semantics around authored controls inside an open custom shadow root', async () => {
    const page = await newSpecPage({ components: [MdCard], html: '<md-card interactive><custom-field></custom-field></md-card>' });
    const field = page.root!.querySelector('custom-field')!;
    field.attachShadow({ mode: 'open' }).innerHTML = '<input aria-label="Name">';
    page.rootInstance.detectInteractiveContent(); await page.waitForChanges();
    expect(page.root!.getAttribute('role')).toBeNull();
    expect(page.root!.getAttribute('tabindex')).toBeNull();
  });
});
