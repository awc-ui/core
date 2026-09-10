import React, { StrictMode, useCallback, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { act as legacyAct } from 'react-dom/test-utils';
import { useOverlay } from '../../src/use-overlay';
const act = (React as unknown as { act?: typeof legacyAct }).act ?? legacyAct;

// Run the actual hook and React DOM effects, including StrictMode replay.
// Only the native animation boundary is deferred by this custom-element stub.
class TestOverlay extends HTMLElement {
  open = false;
  shows = 0;
  closes = 0;
  deferOpening = false;
  pendingShow?: () => void;
  cycle?: { promise: Promise<void>; resolve: () => void };

  async show() {
    this.shows++;
    if (!this.cycle) {
      let resolve!: () => void;
      const promise = new Promise<void>((done) => { resolve = done; });
      this.cycle = { promise, resolve };
    }
    if (this.deferOpening) await new Promise<void>((resolve) => { this.pendingShow = resolve; });
    else this.open = true;
  }
  close() {
    this.closes++;
    this.pendingShow?.();
    this.pendingShow = undefined;
    if (this.open) {
      this.open = false;
      this.dispatchEvent(new CustomEvent('mdClose', { bubbles: true }));
    }
    return Promise.resolve();
  }
  whenClosed() { return this.cycle?.promise ?? Promise.resolve(); }
  finishExit() {
    if (!this.open && !this.pendingShow) {
      this.cycle?.resolve();
      this.cycle = undefined;
    }
  }
}
customElements.define('awc-test-overlay', TestOverlay);
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

function createHarness(initialOptions = {}, strict = false, deferOpening = false) {
  const container = document.createElement('main');
  document.body.append(container);
  const root = createRoot(container);
  let element: TestOverlay;

  function Overlay({ options }) {
    const ref = useRef<TestOverlay>(null);
    const { onMdClose } = useOverlay(ref, options);
    // Like the native wrapper, listeners survive effect replay. They are
    // detached only when React actually replaces/removes the host ref.
    const bind = useCallback((node: TestOverlay | null) => {
      ref.current?.removeEventListener('mdClose', onMdClose);
      (ref as React.MutableRefObject<TestOverlay | null>).current = node;
      if (node) {
        node.deferOpening = deferOpening;
        node.addEventListener('mdClose', onMdClose);
        element = node;
      }
    }, [onMdClose]);
    return React.createElement('awc-test-overlay', { ref: bind }, React.createElement('div', { id: 'nested' }));
  }

  function render(options) {
    act(() => root.render(strict
      ? <StrictMode><Overlay options={options} /></StrictMode>
      : <Overlay options={options} />));
  }
  render(initialOptions);
  return {
    element: () => element,
    update: render,
    requestClose() { act(() => { void element.close(); }); },
    nestedClose() {
      act(() => element.querySelector('#nested')!.dispatchEvent(new CustomEvent('mdClose', { bubbles: true })));
    },
    async finishExit() { await act(async () => { element.finishExit(); }); },
    unmount() { act(() => root.unmount()); container.remove(); },
  };
}
(globalThis as any).createOverlayHarness = createHarness;
