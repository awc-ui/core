/**
 * The header and the grid, shared by the two profile screens.
 *
 * YOUR PROFILE AND SOMEONE ELSE'S ARE THE SAME SCREEN with two differences: the
 * follow button, and which tabs exist. Written twice they would drift on the
 * third change; written once, the differences are two arguments and are visible
 * side by side here.
 */

import { postKindIcon, route } from '@awc-ui/showcase-kit/community';
import { attrs, html } from '../lib/html.mjs';
import { localeHref } from '../lib/i18n.mjs';
import { accountKindChip, avatar, count, media, verified } from '../lib/bits.mjs';
import { panel } from './shell.mjs';

/**
 * The header: portrait, name, four counts, bio.
 *
 * THE THREE PERSON COUNTS ARE EXACT, not compact. A follower total is a number
 * people check — "1.2K followers" on an account with 1,180 is a figure its
 * owner would dispute — which is exactly the distinction `countOptions` draws
 * and the reason the `exact` option exists. The like total is not one of those,
 * so it is left compact.
 */
export function profileHeader(t, locale, summary, { action } = {}) {
  const { person, posts, likes } = summary;

  return panel({
    children: html`<div class="profile-head">
        ${avatar(t, person, { size: 'large', ring: true })}

        <div class="profile-head__text">
          <div class="profile-head__names">
            <h2 class="profile-head__name">${person.displayName}${verified(t, person)}</h2>
            <span class="profile-head__handle">@${person.handle}</span>
            ${accountKindChip(t, person)}
          </div>

          <dl class="stat-row">
            <div><dt>${t('community.count.posts')}</dt><dd>${count(t, posts.length, { exact: true })}</dd></div>
            <div><dt>${t('community.count.followers')}</dt><dd>${count(t, person.followerCount, { exact: true })}</dd></div>
            <div><dt>${t('community.count.following')}</dt><dd>${count(t, person.followingCount, { exact: true })}</dd></div>
            <div><dt>${t('community.count.likes')}</dt><dd>${count(t, likes)}</dd></div>
          </dl>

          <p class="profile-head__bio">${t(person.bioKey)}</p>
          ${person.locationKey
            ? html`<p class="muted profile-head__place"><span class="material-symbols-outlined" aria-hidden="true">place</span>${t(
                person.locationKey,
              )}</p>`
            : null}
        </div>

        ${action ? html`<div class="profile-head__action">${action}</div>` : null}
      </div>

      ${summary.topTopics.length > 0
        ? html`<div class="row">
            <span class="muted">${t('community.panel.topics')}</span>
            ${summary.topTopics.map(
              (topic) => html`<md-chip${attrs({
                variant: 'assist',
                appearance: 'outlined',
                color: 'secondary',
                icon: topic.icon,
                label: t(topic.labelKey),
              })}></md-chip>`,
            )}
          </div>`
        : null}`,
  });
}

/**
 * A square grid of posts, three across.
 *
 * PINNED POSTS LEAD, and they say so with a badge — otherwise a grid ordered by
 * anything but date looks like a grid that has lost its order. The ordering
 * itself is the kit's, so all five builds pin the same two.
 */
export function postGrid(t, locale, posts, empty, { attributes = {} } = {}) {
  if (posts.length === 0) return html`<div${attrs(attributes)}>${empty}</div>`;

  return html`<ul class="post-grid"${attrs(attributes)}>
    ${posts.map((post) => {
      const badge = postKindIcon[post.kind];
      return html`<li class="post-grid__cell">
        <a class="post-grid__link"${attrs({
          href: localeHref(locale, route.post(post.id)),
          'aria-label': t(post.media[0].altKey),
        })}>
          ${media(t, post.media[0], { className: 'post-grid__img' })}
          ${post.pinned
            ? html`<span class="post-grid__pin on-media"><span class="material-symbols-outlined" aria-hidden="true">push_pin</span>${t(
                'community.hint.gridSpan',
              )}</span>`
            : null}
          ${badge
            ? html`<span class="post-grid__badge on-media material-symbols-outlined" aria-hidden="true">${badge}</span>`
            : null}
        </a>
      </li>`;
    })}
  </ul>`;
}
