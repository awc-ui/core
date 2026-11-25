import { createSsrClassHandoff } from './classes-internal.mjs';

/**
 * Call before framework hydration; call the returned function after its mount.
 * Keep Stencil's classes until framework claim and component adoption finish.
 * A partial root is also released if it or its containing shadow host unmounts.
 */
export function preserveSsrClasses(root = globalThis.document) {
  if (!root?.querySelectorAll) return () => {};
  const handoff = createSsrClassHandoff(root?.ownerDocument ?? root);
  if (!handoff) return () => {};
  handoff.capture(root);
  return handoff.finish;
}
