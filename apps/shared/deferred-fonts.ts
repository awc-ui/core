export function activateDeferredFontStylesheet() {
  const link = globalThis.document?.querySelector<HTMLLinkElement>('link[data-deferred-fonts][media="print"]');
  if (!link) return;

  if (link.sheet) {
    link.media = 'all';
    return;
  }

  link.addEventListener('load', () => { link.media = 'all'; }, { once: true });
}
