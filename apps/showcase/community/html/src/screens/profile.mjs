/** Your own profile. NO FRIENDSHIP BUTTON — `friendAction.self` is null. */

import { getViewer, profileSummary, route } from '@awc-ui/showcase-kit/community';
import { html } from '../lib/html.mjs';
import { count } from '../lib/bits.mjs';
import { emptyState, screen, snackbar } from '../components/shell.mjs';
import { aboutPanel, photoPanel, profileHeader } from './profile-parts.mjs';
import { postCard } from '../components/post-card.mjs';
import { resolve } from '@awc-ui/showcase-kit/community';

export function profileScreen(t, locale) {
  const summary = profileSummary(getViewer().id);

  return screen(t, {
    locale,
    here: route.profile(),
    title: t('community.screen.profile.title'),
    subtitle: t('community.screen.profile.subtitle'),
    aside: count(t, summary.posts.length),
    children: html`<div class="columns">
        <div class="columns__main">
          ${profileHeader(t, summary)}
          ${summary.posts.map((post) => postCard(t, locale, resolve(post)))}
        </div>
        <aside class="columns__rail">
          ${aboutPanel(t, locale, summary)}
          ${photoPanel(t, locale, summary)}
        </aside>
      </div>

      ${summary.posts.length === 0 ? emptyState(t('community.empty.posts')) : null}
      ${snackbar(t)}`,
  });
}
