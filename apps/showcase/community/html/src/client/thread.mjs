/**
 * The comment thread's own controls: the reply collapse, the draft field and
 * the row a posted comment becomes.
 *
 * EVERY REPLY IS ALREADY IN THE DOCUMENT and the ones past the page size carry
 * `hidden`, so expanding is an attribute removal rather than markup this module
 * would have to build — which it could not, because every name and body in it
 * is translated and every timestamp is formatted.
 */

import { raise } from './snackbar.mjs';
import { claimAll } from './claim.mjs';

/** One toggle at a time: the two controls are written and one is shown. */
function bindToggles(root) {
  for (const children of claimAll(root, '.thread__children', 'replyToggle')) {
    const more = children.querySelector('.thread__toggle--more');
    const less = children.querySelector('.thread__toggle--less');
    if (!more || !less) continue;

    const set = (expanded) => {
      for (const reply of children.querySelectorAll(':scope > .thread__reply')) {
        reply.toggleAttribute('hidden', !expanded && reply.hasAttribute('data-paged'));
      }
      more.toggleAttribute('hidden', expanded);
      less.toggleAttribute('hidden', !expanded);
    };

    /* Mark which replies were hidden to begin with, so collapsing puts back
       exactly those and not every reply in the run. */
    for (const reply of children.querySelectorAll(':scope > .thread__reply[hidden]')) {
      reply.setAttribute('data-paged', '');
    }

    more.addEventListener('click', () => set(true));
    less.addEventListener('click', () => set(false));
  }
}

/** The draft field and the row it appends. */
function bindCompose(root) {
  for (const compose of claimAll(root, '.comment-compose', 'commentCompose')) {

    const field = compose.querySelector('.comment-draft');
    const button = compose.querySelector('.comment-post');
    const thread = compose.closest('.thread');
    const template = thread?.querySelector('template.comment-mine');
    let draft = '';

    /* `mdInput`, whose detail IS the bare string — not the native input event.
       Binding the wrong one is silent: the draft stays empty for ever. */
    field?.addEventListener('mdInput', (event) => {
      draft = String(event.detail ?? '');
      button?.toggleAttribute('soft-disabled', draft.trim() === '');
    });

    button?.addEventListener('mdClick', () => {
      const body = draft.trim();
      if (body === '' || !thread || !template) return;

      const row = template.content.firstElementChild?.cloneNode(true);
      const target = row?.querySelector('.comment__body');
      if (row && target) {
        target.textContent = body;
        /* Before the compose row, so the newest comment is at the end of the
           conversation rather than after the box used to write it. */
        compose.before(row);
      }
      thread.querySelector('.comment-empty')?.remove();

      draft = '';
      if (field) field.value = '';
      button.setAttribute('soft-disabled', '');
      raise(button.getAttribute('data-msg'));
    });
  }
}

/**
 * Put a card's thread in the document, cloning it in the first time.
 *
 * On the post drill the thread is already inline; on the feed it is in a
 * template, for the reason `post-card.mjs` documents — a hidden div is still an
 * element and the parity census counts it.
 *
 * IT RETURNS WHETHER IT JUST ARRIVED, and the caller needs that. A clone comes
 * out of the template with no `hidden` attribute, so it is already open the
 * moment it lands: a toggle that reads the attribute and inverts it therefore
 * CLOSED a thread the reader had just asked to see. Pressing Comment appeared
 * to do nothing, twice over — once for this, once for the shared-flag bug in
 * `claim.mjs` — which is how it was reported. Anything that opens a thread has
 * to state the state it wants rather than flip whatever it finds.
 */
function materialiseThread(card, rebind) {
  const existing = card?.querySelector('.post-card__thread');
  if (existing) return { thread: existing, fresh: false };

  const template = card?.querySelector('template.post-card__thread-template');
  const node = template?.content.firstElementChild?.cloneNode(true);
  if (!node) return { thread: null, fresh: false };
  template.replaceWith(node);
  /* The clone brings its own controls, and every binder in this build attaches
     by selector at load — so the sweep has to run again over what just arrived.
     The per-binder claim in `claim.mjs` is what makes that safe rather than
     doubling listeners. */
  rebind();
  return { thread: node, fresh: true };
}

function bindOpen(root, rebind) {
  for (const button of claimAll(root, '.post-actions__comment', 'openThread')) {
    const card = button.closest('.post-card');
    button.addEventListener('mdClick', () => {
      const { thread, fresh } = materialiseThread(card, rebind);
      if (!thread) return;
      /* A thread that just arrived is open — it was asked for. Only one that
         was already in the document is a toggle. */
      const open = fresh || thread.hasAttribute('hidden');
      thread.toggleAttribute('hidden', !open);
      button.setAttribute('aria-expanded', String(open));
    });
  }

  /*
   * And the aggregate's "View all N comments" only ever OPENS. It names a
   * number the reader wants to see, so it is a request rather than a switch —
   * and it sits above the thread it opens, where a second press closing it
   * again would read as the page fighting back.
   */
  for (const link of claimAll(root, '.reactions .comment__act', 'openThread')) {
    const card = link.closest('.post-card');
    link.addEventListener('click', () => {
      const { thread } = materialiseThread(card, rebind);
      if (!thread) return;
      thread.removeAttribute('hidden');
      card?.querySelector('.post-actions__comment')?.setAttribute('aria-expanded', 'true');
    });
  }
}

export function enhanceThread(root = document, rebind = () => {}) {
  bindToggles(root);
  bindCompose(root);
  bindOpen(root, rebind);
}
