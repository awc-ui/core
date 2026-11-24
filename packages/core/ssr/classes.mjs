const READY = 'data-awc-motion-ready';

import { mergeSsrClasses, reserved } from './classes-internal.mjs';

/**
 * Call before framework hydration; call the returned function after its mount.
 * Native DSD already has styles, but Vue/Angular/Svelte may replace the host's
 * class attribute while claiming it. Keep only Stencil's classes until BOTH
 * framework claim and component adoption finish, regardless of loading order.
 */
export function preserveSsrClasses(root = globalThis.document) {
  const document = root?.ownerDocument ?? root;
  const view = document?.defaultView;
  if (!root?.querySelectorAll || !view?.MutationObserver) return () => {};
  const pending = new Map();
  const candidates = [...root.querySelectorAll('*')];
  if (root.nodeType === 1) candidates.unshift(root);
  for (const element of candidates) {
    if (!element.localName.startsWith('md-') || !element.shadowRoot) continue;
    if (!element.hasAttribute('s-id') && !element.classList.contains('hydrated')) continue;
    pending.set(element, [...element.classList].filter(token => reserved(token, element.localName)));
  }
  if (!pending.size) return () => {};

  let claimed = false;
  const releaseReady = () => {
    for (const element of pending.keys()) {
      if (!element.isConnected || element.ownerDocument !== document || (claimed && element.hasAttribute(READY))) pending.delete(element);
    }
    if (!pending.size) {
      observer.disconnect();
      for (const type of ['pointerdown', 'keydown', 'click']) document.removeEventListener(type, onInput, true);
    }
  };
  const repair = element => {
    const saved = pending.get(element);
    if (!saved) return;
    if (element.classList.contains(element.localName)) {
      // A component render retains its base class while changing state classes.
      // Accept the NEW state: never put an old selected/expanded variant back.
      pending.set(element, [...element.classList].filter(token => reserved(token, element.localName)));
      mergeSsrClasses(element, 'hydrated');
    } else {
      mergeSsrClasses(element, saved.join(' '));
    }
  };
  const process = records => {
    const changed = new Set();
    // Multiple writers can run in one task before this callback. The oldValue
    // of the next write is the only surviving evidence of an intermediate
    // component render followed by a framework's wholesale class replacement.
    for (const { target, attributeName, oldValue } of records) {
      if (attributeName !== 'class' || !pending.has(target)) continue;
      const previous = (oldValue ?? '').split(/\s+/);
      if (previous.includes(target.localName)) {
        pending.set(target, previous.filter(token => reserved(token, target.localName)));
      }
      changed.add(target);
    }
    for (const element of changed) repair(element);
    releaseReady();
  };
  const observer = new view.MutationObserver(process);
  observer.observe(root, { subtree: true, attributes: true, attributeOldValue: true, attributeFilter: ['class', READY], childList: true });
  const onInput = event => {
    // The first real action owns subsequent visual state, even if it arrives
    // before either framework's usual readiness boundary.
    if (!event.isTrusted) return;
    for (const element of event.composedPath()) pending.delete(element);
    releaseReady();
  };
  for (const type of ['pointerdown', 'keydown', 'click']) document.addEventListener(type, onInput, true);
  return () => {
    process(observer.takeRecords());
    for (const element of pending.keys()) repair(element);
    claimed = true;
    releaseReady();
  };
}
