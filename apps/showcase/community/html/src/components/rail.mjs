/**
 * The third column: birthdays, this week's events, and contacts.
 *
 * THERE IS NO PRESENCE AND NO "ACTIVE NOW" DOT. Every product of this shape has
 * one and it would be the single dishonest thing in this showcase: nobody is
 * online, there is no socket, and a green dot that is always on says something
 * false about a person.
 */

import { rightRail, route } from '@awc-ui/showcase-kit/community';
import { attrs, html } from '../lib/html.mjs';
import { localeHref } from '../lib/i18n.mjs';
import { avatar, dateText } from '../lib/bits.mjs';
import { panel } from './shell.mjs';

/**
 * An event in a 300px rail.
 *
 * A SECOND PRESENTATION, NOT A NARROWER FIRST ONE: the list row is a
 * three-column grid sized for the 680px feed column, and a rail is REFERENCE
 * material — answering an event is a decision that belongs on its own page.
 */
export function eventRailRow(t, locale, event) {
  return html`<a class="rail-row"${attrs({ href: localeHref(locale, route.event(event.slug)) })}>
    <span class="material-symbols-outlined" aria-hidden="true">event</span>
    <span class="rail-row__text">
      <span class="rail-row__name">${event.name}</span>
      <span class="rail-row__meta">${dateText(t, event.startsAt)}</span>
    </span>
  </a>`;
}

export function rightRailPanels(t, locale) {
  const rail = rightRail();

  return html`${rail.birthdays.length > 0
      ? panel({
          title: t('community.panel.birthdays'),
          children: html`<div class="rail-block">
            ${rail.birthdays.map(
              (person) => html`<a class="rail-row"${attrs({
                href: localeHref(locale, route.person(person.handle)),
              })}>
                <span class="material-symbols-outlined" aria-hidden="true">cake</span>
                <span class="rail-row__text">
                  <span class="rail-row__name">${person.displayName}</span>
                </span>
              </a>`,
            )}
            <span class="rail-row__meta">${t('community.hint.birthdayToday')}</span>
          </div>`,
        })
      : null}

    ${rail.events.length > 0
      ? panel({
          title: t('community.panel.upcoming'),
          children: html`<div class="rail-block">${rail.events.map((event) =>
            eventRailRow(t, locale, event),
          )}</div>`,
        })
      : null}

    ${panel({
      title: t('community.panel.contacts'),
      children: html`<div class="rail-block">
        ${rail.contacts.map(
          (person) => html`<a class="rail-row"${attrs({
            href: localeHref(locale, route.person(person.handle)),
          })}>
            ${avatar(t, person, { size: 'small' })}
            <span class="rail-row__text">
              <span class="rail-row__name">${person.displayName}</span>
            </span>
          </a>`,
        )}
      </div>`,
    })}`;
}
