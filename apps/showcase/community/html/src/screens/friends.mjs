/**
 * Friends — the screen the bidirectional graph exists for.
 *
 * FOUR SECTIONS IN ONE ORDER: requests waiting on you, requests you are waiting
 * on, suggestions, then everyone — by WHO IS BLOCKED.
 *
 * A REQUEST HAS TWO BUTTONS, NOT A TOGGLE. Accept and Decline are different
 * outcomes, and each row also carries the sentence it becomes once answered, so
 * the client can state the outcome without composing one.
 */

import {
  getFriends,
  getOutgoing,
  getRequests,
  getSuggestions,
  getTotals,
  route,
} from '@awc-ui/showcase-kit/community';
import { attrs, html } from '../lib/html.mjs';
import { localeHref } from '../lib/i18n.mjs';
import { avatar, count, friendButton } from '../lib/bits.mjs';
import { emptyState, panel, screen, snackbar } from '../components/shell.mjs';

function personRow(t, locale, person, trailing) {
  return html`<div class="person-row"${attrs({ 'data-person': person.id })}>
    <a${attrs({ href: localeHref(locale, route.person(person.handle)) })}>${avatar(t, person, {
      size: 'medium',
    })}</a>
    <span class="person-row__text">
      <a class="person-row__name"${attrs({
        href: localeHref(locale, route.person(person.handle)),
      })}>${person.displayName}</a>
      <span class="person-row__meta">${
        person.mutualCount === 1
          ? t('community.count.mutualOne')
          : t('community.count.mutual', { count: t.formatNumber(person.mutualCount) })
      }</span>
      ${trailing}
    </span>
  </div>`;
}

export function friendsScreen(t, locale) {
  const totals = getTotals();
  const requests = getRequests();
  const outgoing = getOutgoing();
  const suggestions = getSuggestions(6);
  const friends = getFriends();

  return screen(t, {
    locale,
    here: route.friends(),
    title: t('community.screen.friends.title'),
    subtitle: t('community.screen.friends.subtitle'),
    aside: count(t, totals.friendCount),
    children: html`${panel({
        title: t('community.panel.requests'),
        actions: totals.requestCount > 0 ? count(t, totals.requestCount) : undefined,
        children:
          requests.length === 0
            ? emptyState(t('community.empty.requests'))
            : html`<div class="person-grid">
                ${requests.map((person) =>
                  personRow(
                    t,
                    locale,
                    person,
                    html`<span class="request-actions">
                      <md-button${attrs({
                        class: 'request-accept',
                        variant: 'filled',
                        size: 'sm',
                        'data-person': person.id,
                        'data-msg': t('community.msg.friendAccepted', {
                          name: person.displayName,
                        }),
                        /* The row states the outcome rather than vanishing
                           under the reader's hand, so the word it becomes has
                           to be written here too. */
                        'data-outcome': t('community.friendship.friend'),
                      })}>${t('community.action.accept')}</md-button>
                      <md-button${attrs({
                        class: 'request-decline',
                        variant: 'outlined',
                        size: 'sm',
                        'data-person': person.id,
                        'data-msg': t('community.msg.friendDeclined', {
                          name: person.displayName,
                        }),
                        'data-outcome': t('community.friendship.none'),
                      })}>${t('community.action.decline')}</md-button>
                    </span>`,
                  ),
                )}
              </div>`,
      })}

      ${outgoing.length > 0
        ? panel({
            title: t('community.panel.outgoing'),
            actions: count(t, outgoing.length),
            children: html`<div class="person-grid">
              ${outgoing.map((person) =>
                personRow(
                  t,
                  locale,
                  person,
                  html`<span class="request-actions">${friendButton(t, person, {
                    state: person.friendship,
                  })}</span>`,
                ),
              )}
            </div>`,
          })
        : null}

      ${panel({
        title: t('community.panel.suggested'),
        actions: count(t, suggestions.length),
        children: html`<div class="person-grid">
          ${suggestions.map((person) =>
            personRow(
              t,
              locale,
              person,
              html`<span class="request-actions">${friendButton(t, person, {
                state: person.friendship,
              })}</span>`,
            ),
          )}
        </div>`,
      })}

      ${panel({
        title: t('community.panel.allFriends'),
        actions: count(t, friends.length),
        children:
          friends.length === 0
            ? emptyState(t('community.empty.friends'), { hint: t('community.empty.friendsHint') })
            : html`<div class="person-grid">
                ${friends.map((person) =>
                  personRow(
                    t,
                    locale,
                    person,
                    html`<span class="request-actions">${friendButton(t, person, {
                      state: person.friendship,
                    })}</span>`,
                  ),
                )}
              </div>`,
      })}

      ${snackbar(t)}`,
  });
}
