import { preserveSsrClasses } from './classes.mjs';
import { mergeSsrClasses } from './classes-internal.mjs';

/** Preserve Stencil's annotations while Svelte claims the server's light DOM. */
export function createSvelteHydration() {
  const captured = new Map();
  let finishClasses;
  return {
    /** Call from SvelteKit's client init hook, before framework hydration. */
    capture(root = document) {
      finishClasses ??= preserveSsrClasses(root);
      for (const element of root.querySelectorAll('[s-id]')) {
        if (captured.has(element)) continue;
        // Svelte 5 claims children by position. An extra Stencil render marker
        // before a dynamic label or block can make it discard the entire SSR tree.
        const markerText = 'r.' + element.getAttribute('s-id');
        const marker = Array.from(element.childNodes).find(
          (node) => node.nodeType === 8 && node.nodeValue === markerText,
        );
        captured.set(element, {
          attributes: [...element.attributes].map(({ name, value }) => [name, value]),
          marker,
          nextSibling: marker?.nextSibling,
        });
        marker?.remove();
      }
    },
    /** Call in the root layout's onMount, before importing component entries. */
    restore() {
      // Flush class mutations before restoring annotations so a same-task
      // component update cannot be replaced by the earlier server snapshot.
      finishClasses?.();
      finishClasses = undefined;
      for (const [element, { attributes, marker, nextSibling }] of captured) {
        if (!element.isConnected) continue;
        for (const [name, value] of attributes) {
          if (name === 'class') {
            if (!element.classList.contains(element.localName)) mergeSsrClasses(element, value);
          } else if (!element.hasAttribute(name)) element.setAttribute(name, value);
        }
        if (marker) {
          element.insertBefore(marker, nextSibling?.parentNode === element ? nextSibling : element.firstChild);
        }
      }
      captured.clear();

    },
  };
}

/**
 * Create once per request. SvelteKit chunks need not be well-formed HTML, so an
 * HTML parser must receive the complete document. This buffers HTML streaming.
 */
export function createPageTransform(transform) {
  let document = '';
  return async ({ html, done }) => {
    document += html;
    if (!done) return '';
    const page = document;
    document = '';
    return transform(page);
  };
}
