/**
 * Your own profile: posts, saved, tagged.
 *
 * THREE TABS, AND `md-tabs` IS THE RIGHT COMPONENT HERE — the one place in this
 * app it is. The house rule is that destinations are a rail or a bar and never
 * tabs; these are not destinations. They are three views of the SAME thing (the
 * viewer's relationship to a set of posts), inside one screen, with one URL,
 * which is exactly what `md-tabs` is specified for.
 *
 * ALL THREE GRIDS ARE IN THE DOCUMENT and two of them are hidden. The four SPA
 * builds pick one from state; this build has none, so a client that rebuilt a
 * grid would be rebuilding forty translated alt texts and forty hrefs it would
 * have to know the locale prefix for. Switching is an attribute flip instead,
 * and with JavaScript off the reader gets the posts grid — which is the tab
 * that would have been open anyway.
 */

import { getPosts, getViewer, profileSummary, route } from '@awc-ui/showcase-kit/social';
import { attrs, html } from '../lib/html.mjs';
import { count } from '../lib/bits.mjs';
import { emptyState, panel, screen } from '../components/shell.mjs';
import { postGrid, profileHeader } from '../components/profile-parts.mjs';

export function profileScreen(t, locale) {
  const viewer = getViewer();
  const summary = profileSummary(viewer.id);
  const saved = getPosts().filter((post) => post.saved);

  /* Nothing in the fixture models "tagged in" — inventing a field for one tab
     would be data added to serve a layout. The tab exists because a profile has
     one and its empty state is the honest answer. */
  const tagged = [];

  return screen(t, {
    locale,
    here: route.profile(),
    title: t('social.screen.profile.title'),
    subtitle: t('social.screen.profile.subtitle'),
    aside: count(t, summary.posts.length, { exact: true }),
    children: html`${profileHeader(t, locale, summary)}

      ${panel({
        children: html`<md-tabs${attrs({ class: 'profile-tabs', variant: 'primary' })}>
            <md-tab${attrs({ value: 'posts', label: t('social.panel.posts'), icon: 'grid_on' })}></md-tab>
            <md-tab${attrs({ value: 'saved', label: t('social.panel.saved'), icon: 'bookmark' })}></md-tab>
            <md-tab${attrs({ value: 'tagged', label: t('social.panel.tagged.short'), icon: 'sell' })}></md-tab>
          </md-tabs>

          ${postGrid(t, locale, summary.posts, emptyState(t('social.empty.posts')), {
            attributes: { 'data-tab-panel': 'posts' },
          })}
          ${postGrid(
            t,
            locale,
            saved,
            emptyState(t('social.empty.saved'), { hint: t('social.empty.savedHint') }),
            { attributes: { 'data-tab-panel': 'saved', hidden: true } },
          )}
          ${postGrid(t, locale, tagged, emptyState(t('social.empty.tagged')), {
            attributes: { 'data-tab-panel': 'tagged', hidden: true },
          })}`,
      })}`,
  });
}
