/** Shared viewport breakpoints; subscriptions are framework-neutral. */
export const PHONE = '(max-width: 719px)';
export const COMPACT_NAV = '(max-width: 899px)';
export const COARSE = '(pointer: coarse)';
export function subscribeMediaQuery(query: string, listener: (matches: boolean) => void): () => void {
  const media = window.matchMedia(query);
  const update = () => listener(media.matches);
  media.addEventListener('change', update); update();
  return () => media.removeEventListener('change', update);
}
