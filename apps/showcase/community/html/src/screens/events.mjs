/**
 * Events — grouped by age, soonest first, past last.
 *
 * The buckets come from the kit and empty ones are dropped rather than rendered
 * as a heading over nothing. `past` is LAST rather than first: a list read top
 * to bottom should begin with what is about to happen.
 *
 * THE DATE IS A BLOCK, NOT A LINE OF TEXT. A column of events is scanned by
 * date before anything else, and a date inside a paragraph cannot be scanned.
 */

import { RSVP_CHOICES, eventGroups, getEvents, getTotals, rsvpIcon, route } from '@awc-ui/showcase-kit/community';
import { attrs, html } from '../lib/html.mjs';
import { localeHref } from '../lib/i18n.mjs';
import { count, rsvpChip, timeText } from '../lib/bits.mjs';
import { emptyState, panel, screen, snackbar } from '../components/shell.mjs';

export function eventDate(t, at) {
  const date = new Date(at);
  const month = new Intl.DateTimeFormat(t.locale, { month: 'short', timeZone: 'UTC' }).format(date);
  const day = new Intl.DateTimeFormat(t.locale, { day: 'numeric', timeZone: 'UTC' }).format(date);
  return html`<time class="event-date"${attrs({ datetime: at })}>
    <span class="event-date__month">${month}</span>
    <span class="event-date__day">${day}</span>
  </time>`;
}

export function eventRow(t, locale, event) {
  return html`<div class="event-row"${attrs({ 'data-event': event.id })}>
    ${eventDate(t, event.startsAt)}
    <div class="event-row__text">
      <a class="event-row__name"${attrs({
        href: localeHref(locale, route.event(event.slug)),
      })}>${event.name}</a>
      <span class="event-row__meta">
        ${timeText(t, event.startsAt)}
        <span aria-hidden="true">&middot;</span>
        <span class="material-symbols-outlined" aria-hidden="true">${
          event.online ? 'videocam' : 'place'
        }</span>
        ${event.online ? t('community.hint.online') : t(event.placeKey ?? 'community.common.na')}
      </span>
      <!-- __counts, not __meta: this line is a sentence rather than a row of
           items, so it must not carry the flex gap. -->
      <span class="event-row__counts">${count(t, event.goingCount)} ${t(
        'community.count.going',
      ).toLocaleLowerCase(t.locale)}${
        event.friendsGoingCount > 0
          ? ` · ${
              event.friendsGoingCount === 1
                ? t('community.hint.friendsGoingOne')
                : t('community.hint.friendsGoing', {
                    count: t.formatNumber(event.friendsGoingCount),
                  })
            }`
          : ''
      }</span>
      <span class="row event-row__chip">${rsvpChip(t, event.rsvp)}</span>
    </div>

    <!-- THREE CHOICES, NOT FIVE: invited is a state somebody else put the
         reader in, and none is the absence of an answer rather than one. -->
    <span class="event-row__action row">
      ${RSVP_CHOICES.map(
        (choice) => html`<md-icon-button${attrs({
          class: 'event-rsvp',
          icon: rsvpIcon[choice],
          'data-event': event.id,
          'data-rsvp': choice,
          'data-on': event.rsvp === choice,
          color: event.rsvp === choice ? 'primary' : undefined,
          'aria-label': t(`community.rsvp.${choice}`),
          'aria-pressed': String(event.rsvp === choice),
          'data-msg': t(
            choice === 'going'
              ? 'community.msg.rsvpGoing'
              : choice === 'interested'
                ? 'community.msg.rsvpInterested'
                : 'community.msg.rsvpDeclined',
            { name: event.name },
          ),
        })}></md-icon-button>`,
      )}
    </span>
  </div>`;
}

export function eventsScreen(t, locale) {
  const totals = getTotals();
  const groups = eventGroups(getEvents());

  return screen(t, {
    locale,
    here: route.events(),
    title: t('community.screen.events.title'),
    subtitle: t('community.screen.events.subtitle'),
    aside: count(t, totals.goingCount),
    children: html`${groups.length === 0
        ? emptyState(t('community.empty.events'))
        : groups.map((group) =>
            panel({
              title: t(group.labelKey),
              actions: count(t, group.events.length),
              children: html`<div class="event-list">${group.events.map((event) =>
                eventRow(t, locale, event),
              )}</div>`,
            }),
          )}

      ${snackbar(t)}`,
  });
}
