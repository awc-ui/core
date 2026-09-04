/**
 * The feed — the screen this app is judged on.
 *
 * POSTS FROM PEOPLE YOU FOLLOW, NEWEST FIRST, and the selection rule is the
 * kit's `feedItems()` rather than this screen's: someone who follows YOU does
 * not thereby appear here, and that asymmetry is the whole reason
 * `Relationship` has four values instead of a boolean.
 *
 * ONE COLUMN, CAPPED. A feed is a column of pictures and it is read at one
 * width; letting it stretch across a 1600px monitor makes every photograph a
 * letterbox. `.feed` caps it and centres it, and the suggestions panel takes
 * the space beside it where there is space to take.
 *
 * IT PAGES BY REVEALING, NOT BY FETCHING — and on this build that is literal:
 * EVERY post is in the document and the ones past `FEED_PAGE` carry `hidden`.
 * The four SPA builds slice an array in state; here the whole feed is already
 * written, so "show the rest" is an attribute removal, which is also why the
 * page is complete with JavaScript off. There is no infinite scroll and that is
 * deliberate: a scroll handler that appends on intersection is untestable in a
 * parity check, unreachable from a keyboard, and would make the document height
 * depend on how far the harness happened to scroll.
 */

import { FEED_PAGE, feedItems, route, storyRail, suggestedPeople } from '@awc-ui/showcase-kit/social';
import { attrs, html } from '../lib/html.mjs';
import { localeHref } from '../lib/i18n.mjs';
import { count, followButton } from '../lib/bits.mjs';
import { avatar } from '../lib/bits.mjs';
import { emptyState, panel, screen, snackbar } from '../components/shell.mjs';
import { postCard } from '../components/post-card.mjs';
import { storyRailSection } from '../components/story-rail.mjs';

export function feedScreen(t, locale) {
  const items = feedItems();
  const rail = storyRail();
  const suggestions = suggestedPeople(5);

  return screen(t, {
    locale,
    here: route.feed(),
    title: t('social.screen.feed.title'),
    subtitle: t('social.screen.feed.subtitle'),
    children: html`${storyRailSection(t, rail)}

      <div class="feed-layout">
        <div class="feed">
          ${items.length === 0
            ? emptyState(t('social.empty.feed'), { hint: t('social.empty.feedHint') })
            : items
                .slice(0, FEED_PAGE)
                .map(
                  (item, index) => html`<div class="feed__item">${postCard(t, locale, item, {
                    eager: index === 0,
                  })}</div>`,
                )}

          <!-- THE REST OF THE FEED, IN A TEMPLATE.

               Hiding them with the hidden attribute was the first attempt and
               it was wrong in a way only the parity check could see: a template
               element's contents are an INERT FRAGMENT, but a hidden div's are
               still in the document. The census counts elements, not visible
               ones, so thirty hidden posts showed up as 19 extra avatars, 90
               extra icon buttons and 5 extra tooltips against the four builds
               that render twelve cards and stop.

               Cloning is also the only version that keeps the reveal free of
               translation: the markup inside was written by the build in the
               page's own language, so the client appends nodes rather than
               composing any. -->
          ${items.length > FEED_PAGE
            ? html`<template class="feed-rest">
                ${items
                  .slice(FEED_PAGE)
                  .map(
                    (item) => html`<div class="feed__item">${postCard(t, locale, item)}</div>`,
                  )}
              </template>`
            : null}

          <!-- Both endings are written, and exactly one is shown. The button
               hides itself and unhides the other when it is pressed; with
               JavaScript off the button is inert and the first twelve posts
               plus a live "view all" is still an honest page. Neither block
               holds an md-* element, so unlike the posts above they can be
               hidden in place rather than kept in a template. -->
          ${items.length > FEED_PAGE
            ? html`<div class="feed__more">
                <md-button${attrs({ variant: 'tonal', icon: 'expand_more' })}>${t(
                  'social.action.viewAll',
                )}</md-button>
              </div>`
            : null}
          <div class="feed__end"${attrs({ hidden: items.length > FEED_PAGE })}>
            <span class="material-symbols-outlined" aria-hidden="true">check_circle</span>
            <p class="strong">${t('social.common.caughtUp')}</p>
            <p class="muted">${t('social.common.caughtUpHint')}</p>
          </div>
        </div>

        <!-- THE SUGGESTIONS PANEL IS ASIDE CONTENT AND IT SAYS SO. It is not
             part of the feed's reading order — app.css moves it below the
             column on a phone rather than above it, because a reader who opened
             the app came for the posts. -->
        <aside class="feed-aside">
          ${panel({
            title: t('social.panel.suggested'),
            actions: count(t, suggestions.length),
            children: html`<!-- PLAIN ROWS, NOT md-list-item. Four text slots and
                   a trailing action do not fit in a 340px aside: the handle
                   rendered as a truncated small-caps overline and "Follows you"
                   wrapped to three lines beside the button. The component was
                   honest about the space it had; two lines and a button is what
                   actually fits. -->
              <div class="stack">
                ${suggestions.map(
                  (person) => html`<div class="suggest-row">
                    ${avatar(t, person, { size: 'small' })}
                    <span class="suggest-row__text">
                      <a class="suggest-row__name"${attrs({
                        href: localeHref(locale, route.person(person.handle)),
                      })}>${person.displayName}</a>
                      <span class="suggest-row__meta">${t(person.relationshipKey)}</span>
                    </span>
                    ${followButton(t, person, {
                      following:
                        person.relationship === 'following' || person.relationship === 'mutual',
                    })}
                  </div>`,
                )}
              </div>`,
          })}
        </aside>
      </div>

      ${snackbar(t)}`,
  });
}
