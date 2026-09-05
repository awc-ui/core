/**
 * One event.
 *
 * A PAST EVENT SAYS SO AND KEEPS NO BUTTONS: there is no answering an event that
 * has happened. Measured against the REPORTING INSTANT, not the clock, so a
 * past event stays past in every screenshot — which on a build that writes
 * files once is the only way it could be right at all.
 */

import {
  REPORTING_INSTANT,
  RSVP_CHOICES,
  crumbsFor,
  eventSummary,
  getEventBySlug,
  rsvpIcon,
  route,
} from '@awc-ui/showcase-kit/community';
import { attrs, html } from '../lib/html.mjs';
import { localeHref } from '../lib/i18n.mjs';
import { avatar, count, dateText, media, rsvpChip, timeText } from '../lib/bits.mjs';
import { panel, screen, snackbar } from '../components/shell.mjs';
import { notFoundScreen } from './not-found.mjs';

export function eventScreen(t, locale, slug) {
  const found = getEventBySlug(slug);
  if (!found) return notFoundScreen(t, locale);

  const { event, host, group, friendsGoing } = eventSummary(found.id);
  const past = Date.parse(event.startsAt) < Date.parse(REPORTING_INSTANT);
  const here = route.event(event.slug);

  return screen(t, {
    locale,
    here,
    title: event.name,
    subtitle: t('community.screen.event.subtitle'),
    crumbs: crumbsFor(here, event.name),
    aside: rsvpChip(t, event.rsvp),
    children: html`<div class="columns">
        <div class="columns__main">
          ${panel({
            children: html`${media(t, event.cover, { className: 'event-cover', eager: true })}
              <h2 class="profile-head__name">${event.name}</h2>

              <div class="profile-facts">
                <p class="profile-fact"><span class="material-symbols-outlined" aria-hidden="true">schedule</span>${dateText(
                  t,
                  event.startsAt,
                  'long',
                )}, ${timeText(t, event.startsAt)} ${t('community.common.to')} ${timeText(
                  t,
                  event.endsAt,
                )}</p>
                <p class="profile-fact"><span class="material-symbols-outlined" aria-hidden="true">${
                  event.online ? 'videocam' : 'place'
                }</span>${
                  event.online
                    ? t('community.hint.online')
                    : t(event.placeKey ?? 'community.common.na')
                }</p>
                ${group
                  ? html`<p class="profile-fact"><span class="material-symbols-outlined" aria-hidden="true">groups</span><a class="post-card__group"${attrs(
                      { href: localeHref(locale, route.group(group.slug)) },
                    )}>${group.name}</a></p>`
                  : null}
              </div>

              ${past
                ? html`<p class="muted">${t('community.hint.eventOver')}</p>`
                : html`<div class="row">
                    ${RSVP_CHOICES.map(
                      (choice) => html`<md-button${attrs({
                        class: 'event-rsvp',
                        variant: event.rsvp === choice ? 'filled' : 'outlined',
                        icon: rsvpIcon[choice],
                        'data-event': event.id,
                        'data-rsvp': choice,
                        'data-on': event.rsvp === choice,
                        'data-msg': t(
                          choice === 'going'
                            ? 'community.msg.rsvpGoing'
                            : choice === 'interested'
                              ? 'community.msg.rsvpInterested'
                              : 'community.msg.rsvpDeclined',
                          { name: event.name },
                        ),
                      })}>${t(`community.rsvp.${choice}`)}</md-button>`,
                    )}
                  </div>`}

              <p>${t(event.descriptionKey)}</p>`,
          })}
        </div>

        <aside class="columns__rail">
          ${panel({
            title: t('community.panel.hostedBy'),
            children: html`<a class="rail-row"${attrs({
              href: localeHref(locale, route.person(host.handle)),
            })}>
              ${avatar(t, host, { size: 'medium' })}
              <span class="rail-row__text">
                <span class="rail-row__name">${host.displayName}</span>
              </span>
            </a>`,
          })}

          ${panel({
            title: t('community.panel.attendance'),
            children: html`<dl class="stat-row">
                <div><dt>${t('community.count.going')}</dt><dd>${count(
                  t,
                  event.goingCount,
                )}</dd></div>
                <div><dt>${t('community.count.interested')}</dt><dd>${count(
                  t,
                  event.interestedCount,
                )}</dd></div>
              </dl>
              ${friendsGoing.length > 0
                ? html`<p class="muted">${
                    friendsGoing.length === 1
                      ? t('community.hint.friendsGoingOne')
                      : t('community.hint.friendsGoing', {
                          count: t.formatNumber(friendsGoing.length),
                        })
                  }</p>
                  <div class="rail-block">
                    ${friendsGoing.map(
                      (person) => html`<a class="rail-row"${attrs({
                        href: localeHref(locale, route.person(person.handle)),
                      })}>
                        ${avatar(t, person, { size: 'small' })}
                        <span class="rail-row__text">
                          <span class="rail-row__name">${person.displayName}</span>
                        </span>
                      </a>`,
                    )}
                  </div>`
                : null}`,
          })}
        </aside>
      </div>

      ${snackbar(t)}`,
  });
}
