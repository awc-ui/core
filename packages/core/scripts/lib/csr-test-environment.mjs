import assert from 'node:assert/strict';
import { JSDOM, VirtualConsole } from 'jsdom';

/** A browser-like DOM for the actual built CSR modules, without a paint engine. */
export function createCsrTestEnvironment(markup = '') {
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (error) => errors.push(error.message));
  virtualConsole.on('error', (error) => errors.push(String(error)));
  const dom = new JSDOM(`<!doctype html>${markup}`, {
    url: 'http://localhost/', pretendToBeVisual: true, virtualConsole,
  });
  const view = dom.window;
  for (const name of [
    'window', 'document', 'HTMLElement', 'Element', 'Node', 'ShadowRoot',
    'CustomEvent', 'Event', 'KeyboardEvent', 'MutationObserver', 'customElements',
    'navigator', 'CSSStyleSheet',
  ]) {
    Object.defineProperty(globalThis, name, {
      value: name === 'window' ? view : view[name], configurable: true,
    });
  }
  globalThis.getComputedStyle = view.getComputedStyle.bind(view);
  globalThis.requestAnimationFrame = view.requestAnimationFrame.bind(view);
  globalThis.cancelAnimationFrame = view.cancelAnimationFrame.bind(view);
  view.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  globalThis.matchMedia = view.matchMedia;
  view.HTMLElement.prototype.attachInternals = function () {
    return {
      form: null, labels: [], validity: { valid: true }, validationMessage: '',
      setFormValue() {}, setValidity() {}, checkValidity() { return true; },
      reportValidity() { return true; }, states: new Set(),
    };
  };
  return {
    view,
    async define(tags) {
      for (const tag of tags) (await import(`../../dist/components-csr/${tag}.js`)).defineCustomElement();
    },
    close() {
      view.close();
      assert.deepEqual(errors, [], 'built components must not log runtime errors');
    },
  };
}

export const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export async function until(predicate, message = 'Core lifecycle did not complete') {
  for (let i = 0; i < 150; i++) {
    if (predicate()) return;
    await delay(10);
  }
  assert.ok(predicate(), message);
}
export async function painted() {
  await new Promise((resolve) => requestAnimationFrame(resolve));
  await new Promise((resolve) => requestAnimationFrame(resolve));
}
