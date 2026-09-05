/**
 * The small, repeated pieces: counts, timestamps, chips, media, the reaction
 * control and the person line.
 *
 * THE CONTRACT FOR SCREENS, and the one this build enforces hardest:
 *
 *   - Never call `Intl` and never call `toFixed`. Counts go through `count()`,
 *     timestamps through `when()`, dates through `dateText()`.
 *   - Never write an `<img>` by hand. `media()` is the only place a picture is
 *     drawn and the only place that can guarantee the alt text.
 *   - EVERY STRING A CONTROL CAN PRODUCE IS WRITTEN HERE, at build time, in the
 *     page's own language. `src/client/*.mjs` has no dictionary: it swaps
 *     between two strings it was handed on a data attribute. That is what keeps
 *     a Romanian page Romanian after the first press, and it is the rule to
 *     check against on every addition to this file.
 */

import {
  REACTIONS,
  REPORTING_INSTANT,
  audienceIcon,
  friendAction,
  privacyIcon,
  privacyTone,
  reactionIcon,
  reactionTone,
  roleIcon,
  roleTone,
  rsvpIcon,
  rsvpTone,
} from '@awc-ui/showcase-kit/community';
import { attrs, html } from './html.mjs';

/* ------------------------------------------------------------- formatting */

/** Compact above ten thousand, exact below it. */
export function count(t, value, { compact = false } = {}) {
  return html`<span class="num">${t.formatNumber(
    value,
    compact && value >= 10_000
      ? { notation: 'compact', maximumFractionDigits: 1 }
      : { maximumFractionDigits: 0 },
  )}</span>`;
}

/**
 * How long ago, in words, inside a `<time>` that keeps the instant.
 *
 * Measured against `REPORTING_INSTANT`, never the clock — and on a build that
 * writes files and stops, that is not a nicety: a "3h ago" computed against
 * `Date.now()` would freeze the build machine's afternoon into the file.
 */
export function when(t, at) {
  return html`<time${attrs({
    datetime: at,
    title: t.formatDate(at.slice(0, 10), 'long'),
    class: 'when',
  })}>${t.formatRelativeTime(at, REPORTING_INSTANT, { style: 'narrow' })}</time>`;
}

/** A calendar date. An event is not "in 3 days", it is on a date. */
export function dateText(t, at, format = 'medium') {
  return html`<time${attrs({ datetime: at })}>${t.formatDate(at.slice(0, 10), format)}</time>`;
}

/** The time of day. Pinned to UTC like every other formatter here. */
export function timeText(t, at) {
  const text = new Intl.DateTimeFormat(t.locale, {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  }).format(new Date(at));
  return html`<time${attrs({ datetime: at })}>${text}</time>`;
}

/* ------------------------------------------------------------------ chips */

/**
 * `className` IS PARITY-SAFE and it is here for one reason: the client has to
 * be able to find this chip again. The census compares `md-*` elements by tag
 * and by a hand-picked list of value attributes; `class` is on neither, so a
 * hook the four SPA builds have no need of costs nothing here.
 */
export function stateChip(t, { labelKey, color, icon, appearance = 'outlined', className }) {
  return html`<md-chip${attrs({
    class: className,
    variant: 'assist',
    appearance,
    color,
    icon,
    label: t(labelKey),
  })}></md-chip>`;
}

export const privacyChip = (t, group) =>
  stateChip(t, {
    labelKey: group.privacyKey,
    color: privacyTone[group.privacy],
    icon: privacyIcon[group.privacy],
  });

/** `none` earns no chip — the join button already says they are not in it. */
export function roleChip(t, role, className) {
  const tone = roleTone[role];
  if (!tone) return null;
  return stateChip(t, {
    labelKey: `community.role.${role}`,
    color: tone,
    icon: roleIcon[role] ?? undefined,
    className,
  });
}

/**
 * The chip the group WOULD carry after the join button is pressed, written now
 * and parked in a template.
 *
 * THE ROLE CHIP HAS TO FOLLOW THE BUTTON. React re-renders the card from the
 * live role, so asking to join a private group swaps its chip to `pending`
 * there for free. Here nothing re-renders, and the first version of this
 * changed the button and left the chip saying what the reader used to be —
 * which on a private group is the difference between "you asked" and "you are
 * in", the one distinction the whole privacy flag exists to make.
 *
 * IT IS A TEMPLATE, NOT A HIDDEN CHIP, for the census's sake, and it is written
 * by the BUILD rather than assembled on press so the label and the tone arrive
 * already translated — the rule the whole client obeys: swap between strings
 * you were handed, never compose one.
 */
export const nextRoleChip = (t, role) =>
  html`<template class="group-next-role">${roleChip(t, role, 'group-role') ?? ''}</template>`;

export function rsvpChip(t, rsvp) {
  const tone = rsvpTone[rsvp];
  if (!tone) return null;
  return stateChip(t, {
    labelKey: `community.rsvp.${rsvp}`,
    color: tone,
    icon: rsvpIcon[rsvp],
  });
}

/* ----------------------------------------------------------------- people */

export function avatar(t, person, { size = 'small' } = {}) {
  return html`<md-avatar${attrs({
    src: person.avatar,
    name: person.displayName,
    initials: person.initials,
    size,
    label: person.displayName,
    alt: t('community.alt.arcs'),
  })}></md-avatar>`;
}

export function verified(t, person) {
  if (!person.verified) return null;
  return html`<md-tooltip${attrs({ text: t('community.verified') })}><span${attrs({
    class: 'verified material-symbols-outlined',
    role: 'img',
    'aria-label': t('community.verified'),
  })}>verified</span></md-tooltip>`;
}

/**
 * The friendship button.
 *
 * BOTH LABELS TRAVEL IN THE MARKUP. The reader's override arrives later and
 * `src/client/engagement.mjs` re-labels the button in place — so the other
 * state's label, icon and variant ride along on data attributes rather than
 * being composed in the browser, which has no translator.
 */
/**
 * Where a press goes, from any state this control can be in.
 *
 * `incoming` GOES NOWHERE ON PURPOSE: a request somebody sent the reader is
 * answered by the row's own Accept and Decline, so pressing this one opens that
 * choice rather than silently accepting on their behalf.
 */
const nextFriendship = (state) =>
  state === 'none' ? 'outgoing' : state === 'outgoing' || state === 'friend' ? 'none' : 'incoming';

/** Which already-translated sentence a move from `state` to `next` raises. */
const friendMessage = (t, person, state, next) =>
  t(
    next === 'outgoing'
      ? 'community.msg.friendRequested'
      : next === 'friend'
        ? 'community.msg.friendAccepted'
        : state === 'friend'
          ? 'community.msg.friendRemoved'
          : 'community.msg.requestCancelled',
    { name: person.displayName },
  );

/**
 * Add friend / Cancel request / Friends.
 *
 * THE WHOLE CYCLE IS WRITTEN INTO THE MARKUP, not just the next step, and that
 * is a correction rather than a flourish. The first version carried one `next`
 * and marked the button `soft-disabled` after using it — one press, then a dead
 * control. In the four SPA builds this button reads live state and re-renders,
 * so a reader can add, cancel, add again all day; here they got a single press
 * and a greyed-out button that still said "Add friend", which reads as broken
 * because from the reader's side it IS broken.
 *
 * So every state reachable from this one ships with its label, its icon, its
 * variant, its successor and the sentence that move raises — all resolved by
 * the build, in the page's language, with the name already substituted. The
 * client picks an entry out of that map. It still never composes a string,
 * which is the rule; it simply has more than one to choose between.
 *
 * ONLY THE REACHABLE STATES. From `friend` the reader can land on `none` and
 * then on `outgoing`, so all three go; from `none` there are two; `incoming`
 * cycles to itself and ships one. Writing all five everywhere would put labels
 * in the page for transitions this button cannot make.
 */
export function friendButton(t, person, { state, size = 'sm' } = {}) {
  const action = friendAction[state];
  if (!action) return null;

  /* Walk forward from the starting state until it repeats — which it always
     does, because every path ends in the none/outgoing pair or in `incoming`. */
  const cycle = {};
  for (let at = state; !(at in cycle); at = nextFriendship(at)) {
    const step = friendAction[at];
    if (!step) break;
    const next = nextFriendship(at);
    cycle[at] = {
      label: t(step.labelKey),
      icon: step.icon ?? '',
      variant: step.variant,
      next,
      msg: friendMessage(t, person, at, next),
    };
  }

  return html`<md-button${attrs({
    class: 'friend-button',
    variant: action.variant,
    size,
    icon: action.icon ?? undefined,
    'data-person': person.id,
    'data-state': state,
    'data-cycle': JSON.stringify(cycle),
  })}>${t(action.labelKey)}</md-button>`;
}

/* ------------------------------------------------------------------ media */

export function media(t, item, { className, eager = false } = {}) {
  return html`<img${attrs({
    class: className,
    'data-aspect': item.aspect,
    src: item.src,
    alt: t(item.altKey),
    loading: eager ? 'eager' : 'lazy',
    decoding: 'async',
    draggable: 'false',
  })} />`;
}

/* --------------------------------------------------------------- audience */

export function audienceMark(t, audience, labelKey) {
  return html`<md-tooltip${attrs({ text: t(labelKey) })}><span${attrs({
    class: 'material-symbols-outlined',
    role: 'img',
    'aria-label': t(labelKey),
  })}>${audienceIcon[audience]}</span></md-tooltip>`;
}

/* -------------------------------------------------------------- reactions */

/**
 * The aggregate: up to three overlapping glyphs and a total.
 *
 * EVERY REACHABLE STATE OF THE COUNT IS WRITTEN OUT, because the client cannot
 * format one. `data-totals` carries the pre-formatted sentence for the total
 * with and without the viewer's own reaction, and the client picks between
 * them — the same technique the like count uses in Lyra's HTML build.
 */
export function reactionSummaryRow(t, { summary, commentCount, shareCount, shipped }) {
  if (summary.total === 0 && commentCount === 0 && shareCount === 0) return null;

  const withMine = shipped ? summary.total : summary.total + 1;
  const withoutMine = shipped ? summary.total - 1 : summary.total;

  return html`<div class="reactions">
    ${summary.total > 0
      ? html`<span class="reactions__glyphs" aria-hidden="true">
            ${summary.top.map(
              (kind) => html`<span class="reactions__glyph"><span class="material-symbols-outlined">${
                reactionIcon[kind]
              }</span></span>`,
            )}
          </span>
          <span class="reactions__count"${attrs({
            'data-on-text': t('community.reaction.summary', {
              count: t.formatNumber(withMine),
            }),
            'data-off-text': t('community.reaction.summary', {
              count: t.formatNumber(withoutMine),
            }),
          })}>${t('community.reaction.summary', { count: t.formatNumber(summary.total) })}</span>`
      : null}
    <span class="reactions__spacer"></span>
    ${commentCount > 0
      ? html`<button type="button" class="reactions__count comment__act">${t(
          'community.action.viewComments',
          { count: t.formatNumber(commentCount) },
        )}</button>`
      : null}
    ${shareCount > 0
      ? html`<span class="reactions__count">${t.formatNumber(shareCount)} ${t(
          'community.count.shares',
        ).toLocaleLowerCase(t.locale)}</span>`
      : null}
  </div>`;
}

/**
 * The react button and its six options.
 *
 * ALL SEVEN LABELS ARE IN THE MARKUP — one per reaction plus the "react to this
 * post" name for the unselected state — because the client swaps between them
 * and has no dictionary.
 */
export function reactButton(t, { mine }) {
  const current = mine ?? 'like';
  return html`<span class="react">
    <md-button${attrs({
      class: 'react__main',
      variant: 'text',
      icon: reactionIcon[current],
      color: mine ? reactionTone[mine] : undefined,
      'data-on': Boolean(mine),
      'data-mine': mine ?? '',
      'aria-label': t(mine ? `community.reaction.${mine}` : 'community.reaction.none'),
      'data-none-label': t('community.reaction.none'),
      'data-none-icon': reactionIcon.like,
      'data-none-text': t('community.reaction.like'),
    })}>${t(`community.reaction.${current}`)}</md-button>

    <span class="react__picker"${attrs({ role: 'group', 'aria-label': t('community.reaction.pick') })}>
      ${REACTIONS.map(
        (kind) => html`<button type="button" class="react__option"${attrs({
          'data-tone': reactionTone[kind],
          'data-reaction': kind,
          'data-on': mine === kind,
          'data-label': t(`community.reaction.${kind}`),
          'data-icon': reactionIcon[kind],
          'aria-pressed': String(mine === kind),
          'aria-label': t(`community.reaction.${kind}`),
        })}><span class="material-symbols-outlined" aria-hidden="true">${
          reactionIcon[kind]
        }</span></button>`,
      )}
    </span>

    <!-- The touch path. pointer: coarse hides the hover affordance, so this is
         the only way in on a phone — a real button with a name rather than a
         long-press nobody can discover. -->
    <md-icon-button${attrs({
      class: 'react__toggle',
      icon: 'add_reaction',
      'aria-label': t('community.reaction.pick'),
      'aria-expanded': 'false',
    })}></md-icon-button>
  </span>`;
}
