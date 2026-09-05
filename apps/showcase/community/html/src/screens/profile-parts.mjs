/**
 * The header, about panel and photo grid shared by the two profile screens.
 *
 * YOUR PROFILE AND SOMEBODY ELSE'S ARE THE SAME SCREEN with two differences:
 * the button in the header, and whether "groups you are both in" has anything
 * to say.
 */

import { route } from '@awc-ui/showcase-kit/community';
import { attrs, html } from '../lib/html.mjs';
import { localeHref } from '../lib/i18n.mjs';
import { avatar, count, dateText, media, verified } from '../lib/bits.mjs';
import { panel } from '../components/shell.mjs';

/**
 * Cover, avatar, name, counts.
 *
 * The avatar overlaps the cover's lower edge by a negative margin rather than
 * absolute positioning — out of flow, the text under it needs a hard-coded push
 * that is wrong at every other avatar size.
 */
export function profileHeader(t, summary, { action } = {}) {
  const { person, posts, reactionsReceived } = summary;

  return panel({
    children: html`<div class="profile-head">
        ${media(t, person.cover, { className: 'profile-head__cover', eager: true })}
        <div class="profile-head__row">
          <span class="profile-head__avatar">${avatar(t, person, { size: 'large' })}</span>
          <div class="profile-head__text">
            <h2 class="profile-head__name">${person.displayName}${verified(t, person)}</h2>
            <span class="profile-head__handle">@${person.handle}</span>
          </div>
          ${action ? html`<div class="profile-head__action">${action}</div>` : null}
        </div>
      </div>

      <dl class="stat-row">
        <div><dt>${t('community.count.friends')}</dt><dd>${count(t, person.friendCount)}</dd></div>
        <div><dt>${t('community.count.posts')}</dt><dd>${count(t, posts.length)}</dd></div>
        <div><dt>${t('community.count.reactions')}</dt><dd>${count(t, reactionsReceived, {
          compact: true,
        })}</dd></div>
        <!-- Mutuals only mean something for somebody else: on your own profile
             the number would be your friend count again. -->
        ${person.friendship !== 'self'
          ? html`<div><dt>${t('community.count.mutualLabel')}</dt><dd>${count(
              t,
              person.mutualCount,
            )}</dd></div>`
          : null}
      </dl>`,
  });
}

export function aboutPanel(t, locale, summary) {
  const { person, sharedGroups } = summary;
  return panel({
    title: t('community.panel.about'),
    children: html`<div class="profile-facts">
        <p class="profile-fact">${t(person.bioKey)}</p>
        ${person.workKey
          ? html`<p class="profile-fact"><span class="material-symbols-outlined" aria-hidden="true">work</span>${t(
              person.workKey,
            )}</p>`
          : null}
        ${person.locationKey
          ? html`<p class="profile-fact"><span class="material-symbols-outlined" aria-hidden="true">place</span>${t(
              person.locationKey,
            )}</p>`
          : null}
        <p class="profile-fact"><span class="material-symbols-outlined" aria-hidden="true">schedule</span>${t(
          'community.hint.joinedCorvus',
          { date: '' },
        )}${dateText(t, person.joinedAt, 'long')}</p>
      </div>

      ${sharedGroups.length > 0
        ? html`<p class="muted">${t('community.panel.sharedGroups')}</p>
            <div class="row">
              ${sharedGroups.map(
                (group) => html`<a class="post-card__group"${attrs({
                  href: localeHref(locale, route.group(group.slug)),
                })}>${group.name}</a>`,
              )}
            </div>`
        : null}`,
  });
}

/**
 * Three across, square-cropped.
 *
 * The one place this app throws away an aspect ratio it is otherwise careful
 * about: a grid whose cells were 1:1, 4:5 and 16:9 is not a grid. The full
 * ratio comes back the moment the reader opens the post.
 */
export function photoPanel(t, locale, summary) {
  if (summary.photos.length === 0) return null;
  return panel({
    title: t('community.panel.photos'),
    actions: count(t, summary.photos.length),
    children: html`<div class="photo-grid">
      ${summary.photos.map(
        ({ postId, media: item }) => html`<a class="photo-grid__cell"${attrs({
          href: localeHref(locale, route.post(postId)),
          'aria-label': t(item.altKey),
        })}>${media(t, item)}</a>`,
      )}
    </div>`,
  });
}
