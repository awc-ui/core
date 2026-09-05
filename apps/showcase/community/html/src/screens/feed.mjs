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

  return screen(t, {
    locale,
    here: route.feed(),
    title: t('community.screen.feed.title'),
    subtitle: t('community.screen.feed.subtitle'),
    children: html`<div class="columns">
        <div class="columns__main">
          ${panel({ children: composer(t, viewer) })}

          ${items.length === 0
            ? emptyState(t('community.empty.feed'), { hint: t('community.empty.feedHint') })
            : items
                .slice(0, FEED_PAGE)
                .map((item) => html`<div class="feed__item">${postCard(t, locale, item)}</div>`)}

          ${items.length > FEED_PAGE
            ? html`<template class="feed-rest">${items
                .slice(FEED_PAGE)
                .map((item) => html`<div class="feed__item">${postCard(t, locale, item)}</div>`)}</template>`
            : null}

          <!-- Both endings are written and exactly one is shown. Neither holds
               an md-* element, so unlike the posts above they can be hidden in
               place rather than kept in a template. -->
          ${items.length > FEED_PAGE
            ? html`<div class="feed__more">
                <md-button${attrs({ variant: 'tonal', icon: 'expand_more' })}>${t(
                  'community.action.viewAll',
                )}</md-button>
              </div>`
            : null}
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
