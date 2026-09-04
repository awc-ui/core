/**
 * The feed's one control: reveal the rest.
 *
 * EVERY POST IS ALREADY WRITTEN, the ones past the first page inside a
 * `<template>`, so this clones a fragment rather than fetching or composing
 * anything — every caption, handle and alt text in it is already in the page's
 * language. The two endings — the button and the "you are caught up" block —
 * are both in the document, and pressing swaps which one is shown.
 *
 * A TEMPLATE RATHER THAN THIRTY HIDDEN DIVS, and the difference is not
 * cosmetic: a template's contents are an inert fragment outside the document,
 * so the parity census does not count them. Hidden divs are still elements, and
 * thirty of them read as ninety icon buttons the other four builds do not have.
 */

export function enhanceFeed(root = document) {
  const more = root.querySelector('.feed__more:not([data-bound])');
  if (!more) return;
  more.setAttribute('data-bound', '');

  const button = more.querySelector('md-button');
  const end = root.querySelector('.feed__end');
  const rest = root.querySelector('template.feed-rest');

  button?.addEventListener('mdClick', () => {
    /* Inserted BEFORE the button rather than appended to the column, so the
       "view all" row and the ending that replaces it stay at the bottom where
       the reader's eye already is. */
    if (rest) more.before(rest.content.cloneNode(true));
    more.setAttribute('hidden', '');
    end?.removeAttribute('hidden');
  });
}
