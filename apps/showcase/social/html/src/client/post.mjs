/**
 * The post screen's comment composer.
 *
 * THE FIELD REPORTS THROUGH `mdInput`, WHOSE DETAIL IS THE BARE STRING — not
 * the native `input` event, and not the `{ value }` shape `md-search` uses.
 * Binding the native one is silent: the draft stays empty, the Post button
 * stays soft-disabled, and nothing throws. That exact mistake cost this repo a
 * round of debugging in the React port and is why `scripts/verify-browser.mjs`
 * types into this field rather than trusting it.
 *
 * A POSTED COMMENT IS A CLONE OF A TEMPLATE the build wrote, not markup this
 * module composes: the row's name ("You") and its timestamp are both
 * translated, and only the body is the reader's own words. The comment counts —
 * one in the stat row, one beside the panel title — are plain integers small
 * enough that no locale formats them differently, so incrementing them here is
 * safe in a way formatting a like count would not be.
 */

import { raise } from './snackbar.mjs';

export function enhancePost(root = document) {
  const compose = root.querySelector('.comment-compose:not([data-bound])');
  if (!compose) return;
  compose.setAttribute('data-bound', '');

  const field = compose.querySelector('.comment-draft');
  const button = compose.querySelector('.comment-post');
  const template = compose.querySelector('template.comment-mine');
  const panel = compose.closest('.panel__inner');
  let draft = '';

  field?.addEventListener('mdInput', (event) => {
    draft = String(event.detail ?? '');
    button?.toggleAttribute('soft-disabled', draft.trim() === '');
  });

  button?.addEventListener('mdClick', () => {
    const body = draft.trim();
    if (body === '') return;

    /* The thread may not exist yet — a post with no comments renders an empty
       state instead of a list, and the first comment has to replace it. */
    let list = panel?.querySelector('.comment-list');
    if (!list) {
      const empty = panel?.querySelector('.comment-empty');
      list = document.createElement('md-list');
      list.className = 'comment-list';
      list.setAttribute('interaction-mode', 'multi-action');
      list.setAttribute('list-style', 'segmented');
      empty?.replaceWith(list);
    }

    const row = template?.content.firstElementChild?.cloneNode(true);
    if (row && list) {
      row.setAttribute('supporting-text', body);
      list.append(row);
    }

    for (const counter of root.querySelectorAll('.post-comment-count .num')) {
      const next = Number(counter.textContent?.replace(/\D/g, '')) + 1;
      if (Number.isFinite(next)) counter.textContent = String(next);
    }

    draft = '';
    if (field) field.value = '';
    button.setAttribute('soft-disabled', '');
    raise(button.getAttribute('data-msg'));
  });
}
