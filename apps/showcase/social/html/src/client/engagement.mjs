/**
 * What the reader has done: the heart, the bookmark, the share, and the follow
 * button in its four states.
 *
 * THE FIXTURE IS FROZEN AND STAYS FROZEN, exactly as in the four SPA builds.
 * The difference is where the override lives: they hold a map above the router,
 * this build holds it in the DOM, on the element the reader pressed. A reload
 * is a reset either way, which is what keeps the showcase reproducible.
 *
 * NOTHING IS FORMATTED OR TRANSLATED HERE. Both labels of every toggle and both
 * spellings of the like count were written into data attributes at build time,
 * in the page's language and with the page's number format. This module swaps
 * between two strings it was handed; it never composes one. That is the whole
 * reason a Romanian page shows Romanian after a click.
 */

import { raise } from './snackbar.mjs';

/** Flip a boolean-ish data attribute and return the new state. */
function toggleFlag(el, name) {
  const next = !el.hasAttribute(name);
  if (next) el.setAttribute(name, '');
  else el.removeAttribute(name);
  return next;
}

function bindPostActions(root) {
  for (const row of root.querySelectorAll('.post-actions:not([data-bound])')) {
    row.setAttribute('data-bound', '');
    const card = row.closest('.post-card, .panel__inner, .post-detail__side');

    const like = row.querySelector('.post-actions__like');
    like?.addEventListener('mdClick', () => {
      const on = toggleFlag(like, 'data-on');
      like.setAttribute('icon', on ? 'favorite' : 'favorite_border');
      if (on) like.setAttribute('color', 'error');
      else like.removeAttribute('color');
      like.setAttribute(
        'aria-label',
        like.getAttribute(on ? 'data-on-label' : 'data-off-label') ?? '',
      );

      /* The count is two pre-formatted strings on the element that holds it —
         the post screen has one in its stat row and the feed card one under the
         picture, and a post open in both places is not a case that exists. */
      for (const el of card?.querySelectorAll('.post-card__likes') ?? []) {
        const text = el.getAttribute(on ? 'data-liked-text' : 'data-unliked-text');
        const num = el.querySelector('.num');
        if (text && num) num.textContent = text;
      }

      /* Liking announces; UNliking does not. A snackbar is for something the
         reader may want to undo or verify, and taking a like back is already
         its own confirmation — the heart empties. */
      if (on) raise(like.getAttribute('data-msg-on'));
    });

    const save = row.querySelector('.post-actions__save');
    save?.addEventListener('mdClick', () => {
      const on = toggleFlag(save, 'data-on');
      save.setAttribute('icon', on ? 'bookmark' : 'bookmark_border');
      save.setAttribute(
        'aria-label',
        save.getAttribute(on ? 'data-on-label' : 'data-off-label') ?? '',
      );
      /* Saving is the other way round from liking: the post goes somewhere the
         reader cannot see from here, so both directions are worth saying. */
      raise(save.getAttribute(on ? 'data-msg-on' : 'data-msg-off'));
    });

    const share = row.querySelector('.post-actions__share');
    share?.addEventListener('mdClick', () => raise(share.getAttribute('data-msg')));
  }
}

function bindFollowButtons(root) {
  for (const button of root.querySelectorAll('.follow-button:not([data-bound])')) {
    button.setAttribute('data-bound', '');
    button.addEventListener('mdClick', () => {
      const on = button.getAttribute('data-following') !== 'true';
      button.setAttribute('data-following', String(on));
      const prefix = on ? 'data-on' : 'data-off';
      button.textContent = button.getAttribute(`${prefix}-label`) ?? '';
      button.setAttribute('variant', button.getAttribute(`${prefix}-variant`) ?? 'filled');
      const icon = button.getAttribute(`${prefix}-icon`);
      if (icon) button.setAttribute('icon', icon);
      else button.removeAttribute('icon');
      raise(button.getAttribute(on ? 'data-msg-on' : 'data-msg-off'));
    });
  }
}

export function enhanceEngagement(root = document) {
  bindPostActions(root);
  bindFollowButtons(root);
}
