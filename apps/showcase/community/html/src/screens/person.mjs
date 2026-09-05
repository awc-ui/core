/**
 * Somebody else's profile.
 *
 * THE VIEWER'S OWN HANDLE RENDERS THEIR OWN SCREEN rather than a read-only copy
 * of it: both URLs resolve, and offering to befriend yourself is the state
 * `friendAction.self` exists to prevent.
 */

import {
  crumbsFor,
  getPersonByHandle,
  getViewer,
  profileSummary,
  resolve,
  route,
} from '@awc-ui/showcase-kit/community';
import { html } from '../lib/html.mjs';
import { count, friendButton } from '../lib/bits.mjs';
import { emptyState, screen, snackbar } from '../components/shell.mjs';
import { aboutPanel, photoPanel, profileHeader } from './profile-parts.mjs';
import { postCard } from '../components/post-card.mjs';
import { profileScreen } from './profile.mjs';
import { notFoundScreen } from './not-found.mjs';

export function personScreen(t, locale, handle) {
  const person = getPersonByHandle(handle);
  if (!person) return notFoundScreen(t, locale);
  if (person.id === getViewer().id) return profileScreen(t, locale);

  const summary = profileSummary(person.id);
  const here = route.person(person.handle);

  return screen(t, {
    locale,
    here,
    title: person.displayName,
    subtitle: t('community.screen.person.subtitle'),
    crumbs: crumbsFor(here, person.displayName),
    aside: count(t, summary.posts.length),
    children: html`<div class="columns">
        <div class="columns__main">
          ${profileHeader(t, summary, {
            action: friendButton(t, person, { state: person.friendship, size: 'md' }),
          })}
          ${summary.posts.length === 0
            ? emptyState(t('community.empty.posts'))
            : summary.posts.map((post) => postCard(t, locale, resolve(post)))}
        </div>
        <aside class="columns__rail">
          ${aboutPanel(t, locale, summary)}
          ${photoPanel(t, locale, summary)}
        </aside>
      </div>

      ${snackbar(t)}`,
  });
}
