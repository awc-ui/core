/**
 * Somebody else's profile. The second of the two drills.
 *
 * THE SAME HEADER AND GRID AS YOUR OWN, plus a follow button and minus the
 * saved and tagged tabs — which are yours, not theirs, and would be either
 * empty or a privacy claim this app is not making.
 *
 * ADDRESSED BY HANDLE, which is what makes the URL of this screen the thing a
 * reader could actually type.
 *
 * THE VIEWER'S OWN HANDLE RENDERS THEIR OWN SCREEN rather than a read-only copy
 * of it. Both URLs resolve — `/people/mara.ilves/` is a perfectly reasonable
 * thing to type or to be linked — and answering with a page that offered to
 * follow yourself would be the state `followAction.self` exists to prevent. On
 * this build the route table skips the viewer's own handle entirely, so this is
 * a guard rather than a page anyone reaches; it is here because a screen must
 * not depend on its caller for that.
 */

import { crumbsFor, getPersonByHandle, getViewer, profileSummary, route } from '@awc-ui/showcase-kit/social';
import { html } from '../lib/html.mjs';
import { count, followButton } from '../lib/bits.mjs';
import { emptyState, panel, screen, snackbar } from '../components/shell.mjs';
import { postGrid, profileHeader } from '../components/profile-parts.mjs';
import { profileScreen } from './profile.mjs';
import { notFoundScreen } from './not-found.mjs';

export function personScreen(t, locale, handle) {
  const person = getPersonByHandle(handle);
  if (!person) return notFoundScreen(t, locale);
  if (person.id === getViewer().id) return profileScreen(t, locale);

  const summary = profileSummary(person.id);
  const following = person.relationship === 'following' || person.relationship === 'mutual';
  const here = route.person(person.handle);

  return screen(t, {
    locale,
    here,
    title: person.displayName,
    subtitle: t('social.screen.person.subtitle'),
    crumbs: crumbsFor(here, person.displayName),
    aside: count(t, summary.posts.length, { exact: true }),
    children: html`${profileHeader(t, locale, summary, {
        action: followButton(t, person, { following, size: 'md' }),
      })}

      ${panel({
        title: t('social.panel.posts'),
        actions: count(t, summary.posts.length, { exact: true }),
        children: postGrid(t, locale, summary.posts, emptyState(t('social.empty.posts'))),
      })}

      ${snackbar(t)}`,
  });
}
