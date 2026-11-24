export function reserved(token, tag) {
  return token === 'hydrated' || token === tag || token.startsWith(`${tag}--`) || token.startsWith('sc-md-');
}

/** Merge only library-owned classes; framework-owned classes stay authoritative. */
export function mergeSsrClasses(element, capturedClass) {
  const current = new Set(element.classList);
  for (const token of capturedClass.split(/\s+/)) {
    if (reserved(token, element.localName)) current.add(token);
  }
  const next = [...current].join(' ');
  if (next !== element.className) element.className = next;
}

const READY = 'data-awc-motion-ready';
const INPUTS = ['pointerdown', 'keydown', 'click'];

/** One observer per document, shared by a Svelte claim spanning several roots. */
export function createSsrClassHandoff(document) {
  const view = document?.defaultView;
  if (!view?.MutationObserver) return null;
  const pending = new Map();
  const observed = new Map();
  let claimed = false;
  let listening = false;
  let released = false;

  const releaseReady = () => {
    for (const element of pending.keys()) {
      if (!element.isConnected || element.ownerDocument !== document || (claimed && element.hasAttribute(READY))) pending.delete(element);
    }
    if (!pending.size && !released) {
      released = true;
      observer.disconnect();
      observed.clear();
      if (listening) for (const type of INPUTS) document.removeEventListener(type, onInput, true);
      listening = false;
    }
  };
  const repair = element => {
    const saved = pending.get(element);
    if (!saved) return;
    if (element.classList.contains(element.localName)) {
      // Component renders own the latest state; never replay an old selection.
      pending.set(element, [...element.classList].filter(token => reserved(token, element.localName)));
      mergeSsrClasses(element, 'hydrated');
    } else {
      mergeSsrClasses(element, saved.join(' '));
    }
  };
  const process = records => {
    const changed = new Set();
    let checkLifetime = false;
    let treeChanged = false;
    for (const { target, type, attributeName, oldValue, removedNodes } of records) {
      // Additions elsewhere in a partial root's document cannot retire a host.
      // Avoid scanning the pending set for this common unrelated mutation.
      if (type === 'childList') {
        if (removedNodes.length) { checkLifetime = true; treeChanged = true; }
        continue;
      }
      if (!pending.has(target)) continue;
      if (attributeName === READY) { checkLifetime = true; continue; }
      if (attributeName !== 'class') continue;
      // Preserve intermediate Core state when a framework replaces className
      // later in the same task, before MutationObserver delivers either write.
      const previous = (oldValue ?? '').split(/\s+/);
      if (previous.includes(target.localName)) {
        pending.set(target, previous.filter(token => reserved(token, target.localName)));
      }
      changed.add(target);
    }
    for (const element of changed) repair(element);
    if (treeChanged) {
      // A still-connected root may have moved into a different shadow tree.
      // Its next removal must be visible from the new containing tree too.
      for (const [root, classes] of observed) if (classes && root.isConnected) observeLifetime(root);
    }
    if (changed.size || checkLifetime) releaseReady();
  };
  const observer = new view.MutationObserver(process);
  const observe = (root, classes) => {
    if (observed.has(root) && (!classes || observed.get(root))) return;
    observed.set(root, classes);
    observer.observe(root, classes
      ? { subtree: true, attributes: true, attributeOldValue: true, attributeFilter: ['class', READY], childList: true }
      : { subtree: true, childList: true });
  };
  const observeLifetime = root => {
    let tree = root.getRootNode();
    while (tree) {
      if (tree !== root) observe(tree, false);
      tree = tree.host?.getRootNode();
    }
    if (root !== document) observe(document, false);
  };
  const onInput = event => {
    if (!event.isTrusted) return;
    for (const element of event.composedPath()) pending.delete(element);
    releaseReady();
  };

  return {
    get closed() { return released; },
    capture(root) {
      if (released) return;
      // Query only possible server/adopted hosts, not every page descendant.
      const candidates = [...root.querySelectorAll('[s-id], .hydrated')];
      if (root.nodeType === 1) candidates.unshift(root);
      for (const element of candidates) {
        if (pending.has(element) || !element.localName.startsWith('md-') || !element.shadowRoot) continue;
        if (!element.hasAttribute('s-id') && !element.classList.contains('hydrated')) continue;
        pending.set(element, [...element.classList].filter(token => reserved(token, element.localName)));
      }
      if (!pending.size) return;
      observe(root, true);
      // Observing a subtree cannot see its own removal. Watch child removals in
      // each containing tree, including shadow trees, without broadening the
      // class-attribute watch to the rest of the document.
      observeLifetime(root);
      if (!listening) {
        for (const type of INPUTS) document.addEventListener(type, onInput, true);
        listening = true;
      }
    },
    finish() {
      if (released) return;
      process(observer.takeRecords());
      for (const element of pending.keys()) repair(element);
      claimed = true;
      releaseReady();
    },
  };
}
