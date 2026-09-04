/**
 * The screen for a post or a person that does not exist.
 *
 * IT IS A REAL SCREEN, not a redirect to the feed. A reader who followed a
 * stale link needs to be told the thing is gone; silently landing them on the
 * feed makes it look as though the link worked and the app forgot where they
 * were going.
 *
 * This build writes a file per route, so nothing routes HERE — a bad URL is a
 * 404 from the host, and the two drill screens call this when an id in their
 * own argument does not resolve. It exists so that a mistake in the route table
 * produces a stated answer rather than a crash mid-render.
 */

import { route } from '@awc-ui/showcase-kit/social';
import { attrs, html } from '../lib/html.mjs';
import { localeHref } from '../lib/i18n.mjs';
import { emptyState, screen } from '../components/shell.mjs';

export function notFoundScreen(t, locale) {
  return screen(t, {
    locale,
    here: route.feed(),
    title: t('social.screen.notFound.title'),
    subtitle: t('social.screen.notFound.subtitle'),
    children: html`${emptyState(t('social.screen.notFound.subtitle'))}
      <!-- A LINK STYLED AS A BUTTON, not a button. There is nothing to route
           here: on this build a navigation is a page load, so the thing that
           navigates should be the thing browsers navigate with. -->
      <div class="row">
        <md-button${attrs({
          variant: 'tonal',
          icon: 'arrow_back',
          href: localeHref(locale, route.feed()),
        })}>${t('social.nav.feed')}</md-button>
      </div>`,
  });
}
