import { claim } from './claim.mjs';
/**
 * The feed's one control: reveal the rest.
 *
 * The remaining posts are in a `<template>`, so this clones a fragment rather
 * than building anything — every body, name and timestamp in it is already in
 * the page's language. A template rather than hidden divs because the parity
 * census counts ELEMENTS, not visible ones.
 */
export function enhanceFeed(root = document, onCloned = () => {}) {
  const more = root.querySelector('.feed__more');
  if (!more) return;
  if (!claim(more, 'feedPager')) return;

  const button = more.querySelector('md-button');
  const end = root.querySelector('.feed__end');
  const rest = root.querySelector('template.feed-rest');

  button?.addEventListener('mdClick', () => {
    if (rest) {
      const fragment = rest.content.cloneNode(true);
      /* Inserted BEFORE the button so the ending stays at the bottom where the
         reader's eye already is. */
      more.before(fragment);
    }
    more.setAttribute('hidden', '');
    end?.removeAttribute('hidden');
    /* The cloned cards carry controls of their own, and the enhancements bind
       by selector at load — so they have to be re-run over what just arrived.
       Every binder is idempotent via `data-bound`, which is what makes a second
       sweep safe rather than a source of doubled listeners. */
    onCloned();
  });
}
