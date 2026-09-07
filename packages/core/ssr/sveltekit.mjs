/** Preserve Stencil's SSR host annotations while Svelte claims the light DOM. */
export function createSvelteHydration() {
  let captured = [];
  return {
    /** Call from SvelteKit's client init hook, before framework hydration. */
    capture(root = document) {
      captured = [...root.querySelectorAll('[s-id]')].map((element) => [
        element,
        [...element.attributes].map(({ name, value }) => [name, value]),
      ]);
    },
    /** Call in the root layout's onMount, before importing component entries. */
    restore() {
      for (const [element, attributes] of captured) {
        if (!element.isConnected) continue;
        for (const [name, value] of attributes) {
          // Values written by the application's hydration take precedence.
          if (!element.hasAttribute(name)) element.setAttribute(name, value);
        }
      }
      captured = [];
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
