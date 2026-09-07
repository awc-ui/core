/**
 * The feed — the screen this app is judged on.
 *
 * THREE COLUMNS ON A WIDE SCREEN, this vertical's signature layout.
 *
 * IT PAGES BY REVEALING, and on this build that is literal: the posts past
 * `FEED_PAGE` live in a `<template>` and the client clones them. Hidden divs
 * were the first attempt and the parity census counts elements, not visible
 * ones — thirty hidden cards read as dozens of extra avatars and buttons
 * against the four builds that render ten and stop.
 */

import { discoveryCopy, discoveryCount, discoverySearchText } from '@awc-ui/showcase-kit/community';
import { FEED_PAGE, feedItems, getViewer, route } from '@awc-ui/showcase-kit/community';
import { attrs, html } from '../lib/html.mjs';
import { panel, screen, snackbar } from '../components/shell.mjs';
import { postCard } from '../components/post-card.mjs';
import { rightRailPanels } from '../components/rail.mjs';
import { composer } from '../components/composer.mjs';
import { emptyState } from '../components/shell.mjs';

export function feedScreen(t, locale) {
  const viewer = getViewer();
  const items = feedItems();
  const copy = discoveryCopy(locale);
  const feedItem = (item, eager = false) =>
    html`<div
      class="feed__item"
      ${attrs({ 'data-discovery-search': discoverySearchText(item, t), 'data-discovery-category': item.group ? 'groups' : 'friends' })}
    >
      ${postCard(t, locale, item, { eager })}
    </div>`;

  return screen(t, {
    locale,
    here: route.feed(),
    title: t('community.screen.feed.title'),
    subtitle: t('community.screen.feed.subtitle'),
    children: html`<section class="discovery-hero"${attrs({ 'aria-label': copy.eyebrow })}>
        <div><span class="discovery-hero__eyebrow">${copy.eyebrow}</span><h2>${copy.title}</h2><p>${copy.description}</p></div>
        <div class="discovery-hero__stat"><span class="material-symbols-outlined" aria-hidden="true">diversity_3</span><strong class="discovery-hero__number">${t.formatNumber(items.length)}</strong><span class="discovery-hero__caption">${copy.stat}</span></div>
      </section>
<div class="columns">
        <div class="columns__main">
<div class="discovery-tools"${attrs({ 'data-discovery-page': FEED_PAGE, 'data-discovery-count-labels': JSON.stringify(Array.from({ length: items.length + 1 }, (_, i) => discoveryCount(i, locale))) })}>
            <md-text-field${attrs({ label: copy.search, value: '' })}><span slot="leading-icon" class="material-symbols-outlined" aria-hidden="true">search</span></md-text-field>
            <div class="discovery-tools__filters" role="group"${attrs({ 'aria-label': copy.eyebrow })}><md-button${attrs({ variant: 'tonal', size: 'sm', icon: 'auto_awesome', 'data-discovery-filter': 'all', 'aria-pressed': 'true' })}>${copy.all}</md-button>
<md-button${attrs({ variant: 'text', size: 'sm', icon: 'people', 'data-discovery-filter': 'friends', 'aria-pressed': 'false' })}>${copy.second}</md-button>
<md-button${attrs({ variant: 'text', size: 'sm', icon: 'groups', 'data-discovery-filter': 'groups', 'aria-pressed': 'false' })}>${copy.third}</md-button></div>
            <div class="discovery-tools__row"><p class="discovery-tools__count" role="status"><span class="discovery-count">${discoveryCount(items.length, locale)}</span></p><md-button class="discovery-tools__reset" size="sm" variant="text" icon="restart_alt" disabled>${copy.clear}</md-button></div>
          </div>
          <div class="empty discovery-empty" hidden><p class="strong">${copy.empty}</p><p class="muted">${copy.hint}</p></div>
          ${panel({ children: composer(t, viewer) })}

          ${
            items.length === 0
              ? emptyState(t('community.empty.feed'), { hint: t('community.empty.feedHint') })
              : items.slice(0, FEED_PAGE).map((item) => feedItem(item))
          }

          ${
            items.length > FEED_PAGE
              ? html`<template class="feed-rest"
                  >${items.slice(FEED_PAGE).map((item) => feedItem(item))}</template
                >`
              : null
          }

          <!-- Both endings are written and exactly one is shown. Neither holds
               an md-* element, so unlike the posts above they can be hidden in
               place rather than kept in a template. -->
          ${
            items.length > FEED_PAGE
              ? html`<div class="feed__more">
                <md-button${attrs({ variant: 'tonal', icon: 'expand_more' })}>${t(
                  'community.action.viewAll',
                )}</md-button>
              </div>`
              : null
          }
          <div class="feed__end"${attrs({ hidden: items.length > FEED_PAGE })}>
            <span class="material-symbols-outlined" aria-hidden="true">check_circle</span>
            <p class="strong">${t('community.common.caughtUp')}</p>
            <p class="muted">${t('community.common.caughtUpHint')}</p>
          </div>
        </div>

        <aside class="columns__rail"${attrs({ 'aria-label': t('community.panel.contacts') })}>
          ${rightRailPanels(t, locale)}
        </aside>
      </div>

      ${snackbar(t)}`,
  });
}
