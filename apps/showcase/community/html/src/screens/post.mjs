/** One post and its whole thread — the SAME CARD as the feed with the
    conversation open. An unknown id is this screen's guard, not the router's. */

import { crumbsFor, getPersonById, getPostById, resolve, route } from '@awc-ui/showcase-kit/community';
import { html } from '../lib/html.mjs';
import { screen, snackbar } from '../components/shell.mjs';
import { postCard } from '../components/post-card.mjs';
import { rightRailPanels } from '../components/rail.mjs';
import { notFoundScreen } from './not-found.mjs';

export function postScreen(t, locale, postId) {
  const post = getPostById(postId);
  if (!post) return notFoundScreen(t, locale);
  const author = getPersonById(post.authorId);
  if (!author) return notFoundScreen(t, locale);

  const here = route.post(post.id);

  return screen(t, {
    locale,
    here,
    title: t('community.screen.post.title'),
    subtitle: t('community.screen.post.subtitle', { name: author.displayName }),
    crumbs: crumbsFor(here, null),
    children: html`<div class="columns">
        <div class="columns__main">
          ${postCard(t, locale, resolve(post), { showComments: true })}
        </div>
        <aside class="columns__rail">${rightRailPanels(t, locale)}</aside>
      </div>

      ${snackbar(t)}`,
  });
}
