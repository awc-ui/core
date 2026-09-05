/**
 * What the reader has done: reactions, friendships, group membership, RSVPs.
 *
 * THE FIXTURE IS FROZEN AND STAYS FROZEN, exactly as in the four SPA builds.
 * The difference is where the override lives: they hold a map above the router,
 * this build holds it in the DOM, on the element the reader pressed.
 *
 * NOTHING IS FORMATTED OR TRANSLATED HERE. Every label, every count and every
 * sentence was written into a data attribute at build time, in the page's
 * language and number format. This module swaps between strings it was handed;
 * it never composes one. That is the rule that keeps a Romanian page Romanian
 * after the first press, and it is worth checking on every addition.
 */

import { raise } from './snackbar.mjs';
import { claimAll } from './claim.mjs';

/* --------------------------------------------------------------- reactions */

/**
 * The six-option picker and the main button.
 *
 * THE SWITCH IS THE CASE THAT MATTERS: moving from one reaction to another must
 * leave the aggregate alone, because a reader who changed their mind has not
 * reacted twice. The two spellings of the total are on the count element, so
 * this only has to decide WHICH — never compute one.
 */
function bindReactions(root) {
  for (const react of claimAll(root, '.react', 'reactions')) {

    const main = react.querySelector('.react__main');
    const toggle = react.querySelector('.react__toggle');
    const picker = react.querySelector('.react__picker');
    const card = react.closest('.post-card');
    const total = card?.querySelector('.reactions__count');

    const apply = (next) => {
      main.setAttribute('data-mine', next ?? '');
      main.toggleAttribute('data-on', next !== null);

      for (const option of react.querySelectorAll('.react__option')) {
        const on = option.getAttribute('data-reaction') === next;
        option.toggleAttribute('data-on', on);
        option.setAttribute('aria-pressed', String(on));
        if (on) main.setAttribute('color', option.getAttribute('data-tone') ?? '');
      }
      if (next === null) main.removeAttribute('color');

      const chosen = next
        ? react.querySelector(`.react__option[data-reaction="${next}"]`)
        : null;
      main.setAttribute('icon', chosen?.getAttribute('data-icon') ?? main.getAttribute('data-none-icon') ?? '');
      main.textContent = chosen?.getAttribute('data-label') ?? main.getAttribute('data-none-text') ?? '';
      main.setAttribute(
        'aria-label',
        chosen?.getAttribute('data-label') ?? main.getAttribute('data-none-label') ?? '',
      );

      /* The aggregate: one of two pre-formatted sentences, never arithmetic. */
      if (total) {
        const text = total.getAttribute(next ? 'data-on-text' : 'data-off-text');
        if (text) total.textContent = text;
      }
    };

    const current = () => main.getAttribute('data-mine') || null;

    main.addEventListener('mdClick', () => apply(current() ? null : 'like'));
    toggle?.addEventListener('mdClick', () => {
      const open = picker?.hasAttribute('data-open');
      picker?.toggleAttribute('data-open', !open);
      toggle.setAttribute('aria-expanded', String(!open));
    });

    for (const option of react.querySelectorAll('.react__option')) {
      option.addEventListener('click', () => {
        const kind = option.getAttribute('data-reaction');
        apply(current() === kind ? null : kind);
        picker?.removeAttribute('data-open');
        toggle?.setAttribute('aria-expanded', 'false');
      });
    }
  }
}

/* ------------------------------------------------------- comment reactions */

function bindCommentLikes(root) {
  /* SCOPED TO A COMMENT. `.comment__act` alone also matches the aggregate
     "View all N comments" button, which wears the class for its styling and is
     the thread-opener — binding a like handler to it was half of why pressing
     it did nothing. The other half was the shared flag; see `claim.mjs`. */
  for (const button of claimAll(root, '.comment .comment__act', 'commentLike')) {
    const likes = button.parentElement?.querySelector('.comment__likes');
    button.addEventListener('click', () => {
      const on = !button.hasAttribute('data-on');
      button.toggleAttribute('data-on', on);
      button.setAttribute('aria-pressed', String(on));
      if (!likes) return;
      const text = likes.getAttribute(on ? 'data-on-text' : 'data-off-text');
      const num = likes.querySelector('.num');
      if (text && num) num.textContent = text;
      /* A count that has fallen to zero hides the whole run rather than showing
         a bare "0" beside a thumb. */
      likes.toggleAttribute('hidden', text === '0');
    });
  }
}

/* --------------------------------------------------------------- the share */

function bindShares(root) {
  for (const button of claimAll(root, '.post-actions__share', 'share')) {
    button.addEventListener('mdClick', () => raise(button.getAttribute('data-msg')));
  }
}

/* ------------------------------------------------------------- friendships */

/**
 * Add friend / Cancel request / Friends.
 *
 * PRESSABLE AS MANY TIMES AS THE READER LIKES, which is what the four SPA
 * builds do and what this did not. It used to swap in one pre-written "next"
 * label and then set `soft-disabled`, so the second press did nothing — and
 * since the label by then said "Add friend", the button looked like a live
 * control that had stopped answering. It was reported as exactly that.
 *
 * The build now writes the whole reachable cycle onto the element as
 * `data-cycle`, each entry carrying its label, icon, variant, successor and
 * already-translated sentence. This reads the entry for wherever the button is
 * now, applies the one it points at, and leaves the control live.
 */
function bindFriendButtons(root) {
  for (const button of claimAll(root, '.friend-button', 'friend')) {

    let cycle;
    try {
      cycle = JSON.parse(button.getAttribute('data-cycle') ?? '{}');
    } catch {
      /* A button with no usable cycle stays inert rather than throwing on every
         press and taking the rest of the page's listeners down with it. */
      continue;
    }

    button.addEventListener('mdClick', () => {
      const here = cycle[button.getAttribute('data-state') ?? ''];
      if (!here) return;
      const step = cycle[here.next];
      if (!step) return;

      button.textContent = step.label;
      if (step.icon) button.setAttribute('icon', step.icon);
      else button.removeAttribute('icon');
      if (step.variant) button.setAttribute('variant', step.variant);
      button.setAttribute('data-state', here.next);

      /* The sentence belongs to the move that was just made, so it comes from
         the entry the button was ON — reading it off the new one would report
         the next press instead of this one. */
      raise(here.msg);
    });
  }
}

/** Accept / Decline on a request row. Two outcomes, not two positions. */
function bindRequests(root) {
  for (const button of claimAll(root, '.request-accept, .request-decline', 'request')) {
    button.addEventListener('mdClick', () => {
      const actions = button.closest('.request-actions');
      const outcome = button.getAttribute('data-outcome') ?? '';
      raise(button.getAttribute('data-msg'));
      /* The row states the outcome rather than vanishing under the reader's
         hand — the same decision the four SPA builds make, and the reason each
         button carries the word it becomes. */
      if (actions) {
        const span = document.createElement('span');
        span.className = 'person-row__meta';
        span.textContent = outcome;
        actions.replaceWith(span);
      }
    });
  }
}

/* ------------------------------------------------------------------ groups */

function bindJoinButtons(root) {
  for (const button of claimAll(root, '.group-join', 'join')) {
    button.addEventListener('mdClick', () => {
      const was = button.getAttribute('data-role');
      const next = button.getAttribute('data-next');
      const label = button.getAttribute('data-next-label') ?? '';
      const icon = button.getAttribute('data-next-icon') ?? '';
      const variant = button.getAttribute('data-next-variant') ?? '';

      button.textContent = label;
      if (icon) button.setAttribute('icon', icon);
      else button.removeAttribute('icon');
      if (variant) button.setAttribute('variant', variant);
      button.setAttribute('data-role', next ?? '');
      button.setAttribute('soft-disabled', '');

      /*
       * THE CHIP FOLLOWS THE BUTTON, out of a template the build already wrote.
       *
       * Asking to join a private group leaves the reader PENDING, not a member,
       * and the chip is the only place that shows it — the button by then just
       * says "Cancel request". Leaving the old chip up is how a card comes to
       * claim membership the reader does not have. `none` writes an empty
       * template, so leaving a group correctly ends with no chip at all.
       */
      const card = button.closest('.group-card') ?? button.closest('.panel__inner');
      const template = card?.querySelector('template.group-next-role');
      if (template) {
        const chip = card.querySelector('md-chip.group-role');
        const replacement = template.content.cloneNode(true);
        if (chip) chip.replaceWith(replacement);
        else template.before(replacement);
      }

      raise(
        button.getAttribute(
          next === 'member'
            ? 'data-msg-joined'
            : next === 'pending'
              ? 'data-msg-requested'
              : was === 'pending'
                ? 'data-msg-cancelled'
                : 'data-msg-left',
        ),
      );
    });
  }
}

/* ------------------------------------------------------------------ events */

function bindRsvp(root) {
  for (const button of claimAll(root, '.event-rsvp', 'rsvp')) {
    button.addEventListener('mdClick', () => {
      const row = button.closest('.event-row') ?? button.closest('.panel__inner');
      const on = !button.hasAttribute('data-on');

      /* One answer at a time: the three choices are exclusive. */
      for (const other of row?.querySelectorAll('.event-rsvp') ?? []) {
        const isThis = other === button;
        other.toggleAttribute('data-on', isThis && on);
        other.setAttribute('aria-pressed', String(isThis && on));
        if (other.tagName === 'MD-BUTTON') {
          other.setAttribute('variant', isThis && on ? 'filled' : 'outlined');
        } else if (isThis && on) {
          other.setAttribute('color', 'primary');
        } else {
          other.removeAttribute('color');
        }
      }
      /* Answering announces; taking an answer back does not — the same
         asymmetry the reaction button has. */
      if (on) raise(button.getAttribute('data-msg'));
    });
  }
}

export function enhanceEngagement(root = document) {
  bindReactions(root);
  bindCommentLikes(root);
  bindShares(root);
  bindFriendButtons(root);
  bindRequests(root);
  bindJoinButtons(root);
  bindRsvp(root);
}
