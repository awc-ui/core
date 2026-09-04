/**
 * Explore — everything on Lyra, as a grid.
 *
 * A MASONRY-ISH GRID WITHOUT MASONRY. One in seven tiles spans two columns and
 * two rows, which is what stops a uniform grid reading as a contact sheet. The
 * span comes from the kit (`ExploreTile.span`) and is derived from the post's
 * INDEX rather than drawn at random, so all five builds lay out identically — a
 * parity check that compared a randomised layout would compare nothing.
 *
 * EVERY TILE IS SQUARE-CROPPED, whatever the picture's own ratio. That is the
 * one place this app deliberately throws away the aspect ratio it is otherwise
 * so careful about: a grid whose cells were 1:1, 4:5 and 16:9 is not a grid.
 * `object-fit: cover` does the crop, and the full ratio is restored the moment
 * the reader opens the post.
 *
 * THE SEARCH MATCHES PEOPLE, NOT CAPTIONS, and the field says so. A selector
 * cannot see the dictionary, so a caption search would work in English and
 * silently return nothing in Arabic.
 *
 * FILTERING IS A CLIENT ENHANCEMENT OVER A COMPLETE GRID. Every tile is in the
 * document; `src/client/explore.mjs` hides the ones that do not match, using
 * the author name and handle stamped on each tile. Nothing is rebuilt, so
 * nothing has to be translated in the browser — and with JavaScript off the
 * page is the unfiltered grid, which is the honest answer to a filter that
 * cannot run.
 */

import { exploreTiles, getTotals, postKindIcon, route, topicFacets } from '@awc-ui/showcase-kit/social';
import { attrs, html } from '../lib/html.mjs';
import { localeHref } from '../lib/i18n.mjs';
import { count, media, topicChip } from '../lib/bits.mjs';
import { emptyState, panel, screen } from '../components/shell.mjs';

export function exploreScreen(t, locale) {
  const totals = getTotals();
  const facets = topicFacets();
  const tiles = exploreTiles();

  return screen(t, {
    locale,
    here: route.explore(),
    title: t('social.screen.explore.title'),
    subtitle: t('social.screen.explore.subtitle'),
    aside: count(t, tiles.length),
    children: html`${panel({
        title: t('social.panel.topics'),
        children: html`<div class="stack">
          <!-- trigger="bar" and full-width: the default trigger is an icon that
               opens the field, which in a filter panel renders as a lone
               magnifying glass and reads as broken. The wrapper is what makes
               it fill the panel — md-search carries a 360px minimum and centres
               itself in a wider parent, so full-width alone left it marooned in
               the middle of the card. -->
          <div class="explore-search">
            <md-search${attrs({
              layout: 'docked',
              trigger: 'bar',
              variant: 'contained',
              'full-width': true,
              debounce: '250',
              label: t('social.action.search'),
              placeholder: t('social.count.people'),
            })}></md-search>
          </div>

          <div class="facet-row">${facets.map((facet) => topicChip(t, facet.id))}</div>

          <div class="row row--between facet-foot">
            <!-- The sentence is written by the build in the page's own language
                 with two holes left in it, and refilled in place as the filter
                 narrows. Never assembled in JavaScript: word order differs by
                 locale and Arabic is one of the three. -->
            <span class="muted"${attrs({
              'data-count-template': t('social.common.showing', {
                shown: '%shown%',
                total: '%total%',
              }),
            })}>${t('social.common.showing', { shown: tiles.length, total: totals.feedCount })}</span>
            <!-- The reset exists only while there is something to reset; a
                 permanently-inert control in a filter bar is furniture. A
                 freshly-written page has no filter on, so it is not in the
                 document at all — it lives in a template and the client puts it
                 in when the first chip or the first keystroke lands.

                 A template and not a hidden button, because the parity census
                 counts elements rather than visible ones: a hidden md-button is
                 a button the four SPA builds do not render, and it brought an
                 md-ripple with it. -->
            <template class="explore-reset-template">
              <md-button${attrs({
                class: 'explore-reset',
                variant: 'text',
                size: 'sm',
                icon: 'restart_alt',
              })}>${t('social.action.clearFilters')}</md-button>
            </template>
          </div>
        </div>`,
      })}

      <ul class="explore-grid">
        ${tiles.map(({ post, author, span }) => {
          const badge = postKindIcon[post.kind];
          return html`<li class="explore-tile"${attrs({
            'data-span': span === 2 ? '2' : undefined,
            /* What the client filters on. The topics are ids and the two name
               fields are the untranslated proper nouns the search matches —
               the same two fields the kit's selector compares. */
            'data-topics': post.topics.join(' '),
            'data-name': author.displayName,
            'data-handle': author.handle,
          })}>
            <!-- The link's accessible name is the picture's alt plus whose it
                 is — "Abstract artwork: layered dunes, by Ada Lindqvist". A grid
                 of forty links all named "Post" is a grid a screen reader cannot
                 navigate. -->
            <a class="explore-tile__link"${attrs({
              href: localeHref(locale, route.post(post.id)),
              'aria-label': `${t(post.media[0].altKey)} — ${author.displayName}`,
            })}>
              ${media(t, post.media[0], { className: 'explore-tile__img' })}
              ${badge
                ? html`<span class="explore-tile__badge on-media material-symbols-outlined" aria-hidden="true">${badge}</span>`
                : null}
            </a>
          </li>`;
        })}
      </ul>

      <!-- Written, and held in a template until the filter empties the grid.
           Building it in the browser would mean translating two sentences
           there; holding it hidden would put a div in the document the four SPA
           builds only render when they have nothing to show. -->
      <template class="explore-empty-template">
        ${emptyState(t('social.empty.explore'), { hint: t('social.empty.exploreHint') })}
      </template>`,
  });
}
