/**
 * One group.
 *
 * A PRIVATE GROUP THE VIEWER IS NOT IN SHOWS ITS ABOUT AND NOTHING ELSE, and
 * SAYS the posts are withheld — an empty feed with no explanation reads as a
 * dead group, and one that showed its posts anyway would make the privacy flag
 * a decoration.
 */

import {
  crumbsFor,
  getGroupBySlug,
  groupSummary,
  joinAction,
  resolve,
  route,
} from '@awc-ui/showcase-kit/community';
import { attrs, html } from '../lib/html.mjs';
import { localeHref } from '../lib/i18n.mjs';
import {
  avatar,
  count,
  dateText,
  media,
  nextRoleChip,
  privacyChip,
  roleChip,
} from '../lib/bits.mjs';
import { emptyState, panel, screen, snackbar } from '../components/shell.mjs';
import { eventRailRow } from '../components/rail.mjs';
import { postCard } from '../components/post-card.mjs';
import { notFoundScreen } from './not-found.mjs';

export function groupScreen(t, locale, slug) {
  const found = getGroupBySlug(slug);
  if (!found) return notFoundScreen(t, locale);

  const { group, posts, events, contributors } = groupSummary(found.id);
  const action = joinAction[group.role];
  const member = ['admin', 'moderator', 'member'].includes(group.role);
  const hidden = group.privacy === 'private' && !member;
  const here = route.group(group.slug);

  const next =
    group.role === 'none' ? (group.privacy === 'private' ? 'pending' : 'member') : 'none';
  const target = joinAction[next];

  return screen(t, {
    locale,
    here,
    title: group.name,
    subtitle: t('community.screen.group.subtitle'),
    crumbs: crumbsFor(here, group.name),
    aside: count(t, group.memberCount, { compact: true }),
    children: html`<div class="columns">
        <div class="columns__main">
          ${panel({
            children: html`${media(t, group.cover, { className: 'event-cover', eager: true })}
              <h2 class="profile-head__name">${group.name}</h2>
              <div class="row">
                ${privacyChip(t, group)}${roleChip(t, group.role, 'group-role')}${nextRoleChip(t, next)}
                <span class="person-row__meta">${count(t, group.memberCount, {
                  compact: true,
                })} ${t('community.count.members').toLocaleLowerCase(t.locale)}</span>
                ${action
                  ? html`<md-button${attrs({
                      class: 'group-join',
                      variant: action.variant,
                      icon: action.icon,
                      'data-group': group.id,
                      'data-role': group.role,
                      'data-next': next,
                      'data-next-label': target ? t(target.labelKey) : '',
                      'data-next-icon': target?.icon ?? '',
                      'data-next-variant': target?.variant ?? '',
                      'data-msg-joined': t('community.msg.joined', { name: group.name }),
                      'data-msg-requested': t('community.msg.requested', { name: group.name }),
                      'data-msg-cancelled': t('community.msg.requestCancelled', {
                        name: group.name,
                      }),
                      'data-msg-left': t('community.msg.left', { name: group.name }),
                    })}>${t(action.labelKey)}</md-button>`
                  : null}
              </div>
              <p>${t(group.descriptionKey)}</p>
              ${group.joinedAt
                ? html`<p class="person-row__meta">${t('community.hint.joinedGroup', {
                    date: '',
                  })}${dateText(t, group.joinedAt, 'long')}</p>`
                : null}`,
          })}

          ${hidden
            ? emptyState(t('community.hint.privateGroup'))
            : posts.length === 0
              ? emptyState(t('community.empty.posts'))
              : posts.map((post) => postCard(t, locale, resolve(post)))}
        </div>

        <aside class="columns__rail">
          ${events.length > 0
            ? panel({
                title: t('community.panel.groupEvents'),
                actions: count(t, events.length),
                children: html`<div class="rail-block">${events.map((event) =>
                  eventRailRow(t, locale, event),
                )}</div>`,
              })
            : null}

          ${panel({
            title: t('community.panel.members'),
            actions: count(t, contributors.length),
            children:
              contributors.length === 0
                ? emptyState(t('community.empty.members'))
                : html`<div class="rail-block">
                    ${contributors.map(
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
          })}
        </aside>
      </div>

      ${snackbar(t)}`,
  });
}
