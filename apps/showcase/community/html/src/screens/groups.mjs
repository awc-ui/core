/**
 * Groups — the ones you are in, and the ones you might be.
 *
 * TWO SECTIONS AND THE JOIN BUTTON IS THE DIFFERENCE. `joinAction` decides
 * which control each role gets, including the two that offer nothing: an admin
 * cannot leave their own group here, because there is no ownership-transfer
 * flow behind it and the control would be a dead end.
 */

import { getDiscoverGroups, getJoinedGroups, getTotals, joinAction, route } from '@awc-ui/showcase-kit/community';
import { attrs, html } from '../lib/html.mjs';
import { localeHref } from '../lib/i18n.mjs';
import { count, media, nextRoleChip, privacyChip, roleChip } from '../lib/bits.mjs';
import { emptyState, panel, screen, snackbar } from '../components/shell.mjs';

export function groupCard(t, locale, group) {
  const action = joinAction[group.role];
  /* Joining a PRIVATE group asks rather than joins — the whole point of the
     privacy flag, and the state `pending` exists to hold. */
  const next =
    group.role === 'none' ? (group.privacy === 'private' ? 'pending' : 'member') : 'none';
  const target = joinAction[next];

  return panel({
    children: html`<div class="group-card"${attrs({ 'data-group': group.id })}>
      <a${attrs({
        href: localeHref(locale, route.group(group.slug)),
        'aria-label': group.name,
      })}>${media(t, group.cover, { className: 'group-card__cover' })}</a>
      <a class="group-card__name"${attrs({
        href: localeHref(locale, route.group(group.slug)),
      })}>${group.name}</a>
      <div class="row">${privacyChip(t, group)}${roleChip(t, group.role, 'group-role')}${nextRoleChip(t, next)}</div>
      <p class="group-card__about">${t(group.descriptionKey)}</p>
      <p class="person-row__meta">${count(t, group.memberCount, { compact: true })} ${t(
        'community.count.members',
      ).toLocaleLowerCase(t.locale)}${
        group.weeklyPostCount > 0
          ? ` · ${
              group.weeklyPostCount === 1
                ? t('community.count.weeklyPostsOne')
                : t('community.count.weeklyPosts', {
                    count: t.formatNumber(group.weeklyPostCount),
                  })
            }`
          : ''
      }</p>
      ${action
        ? html`<md-button${attrs({
            class: 'group-join',
            variant: action.variant,
            size: 'sm',
            icon: action.icon,
            'data-group': group.id,
            'data-role': group.role,
            'data-next': next,
            'data-next-label': target ? t(target.labelKey) : '',
            'data-next-icon': target?.icon ?? '',
            'data-next-variant': target?.variant ?? '',
            /* Every sentence the press can raise, already translated. */
            'data-msg-joined': t('community.msg.joined', { name: group.name }),
            'data-msg-requested': t('community.msg.requested', { name: group.name }),
            'data-msg-cancelled': t('community.msg.requestCancelled', { name: group.name }),
            'data-msg-left': t('community.msg.left', { name: group.name }),
          })}>${t(action.labelKey)}</md-button>`
        : null}
    </div>`,
  });
}

export function groupsScreen(t, locale) {
  const totals = getTotals();
  const joined = getJoinedGroups();
  const discover = getDiscoverGroups();

  return screen(t, {
    locale,
    here: route.groups(),
    title: t('community.screen.groups.title'),
    subtitle: t('community.screen.groups.subtitle'),
    aside: count(t, totals.groupCount),
    children: html`${panel({
        title: t('community.panel.yourGroups'),
        actions: count(t, joined.length),
        children:
          joined.length === 0
            ? emptyState(t('community.empty.groups'), { hint: t('community.empty.groupsHint') })
            : html`<div class="card-grid">${joined.map((group) =>
                groupCard(t, locale, group),
              )}</div>`,
      })}

      ${panel({
        title: t('community.panel.discover'),
        actions: count(t, discover.length),
        children: html`<div class="card-grid">${discover.map((group) =>
          groupCard(t, locale, group),
        )}</div>`,
      })}

      ${snackbar(t)}`,
  });
}
