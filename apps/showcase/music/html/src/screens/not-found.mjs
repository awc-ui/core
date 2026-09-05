/**
 * The screen for an address nothing answers to.
 *
 * ON A STATIC HOST a bad URL is answered by the SERVER, before this app exists
 * — every route is a directory with an `index.html` and there is no router to
 * reach. This screen is what the four drills render when an id in their own
 * argument does not resolve, which is the only way it is reachable here.
 */
import { html } from '../lib/html.mjs';
import { emptyState, screen } from '../components/shell.mjs';
import { localeHref } from '../lib/i18n.mjs';
import { attrs } from '../lib/html.mjs';
import { route } from '@awc-ui/showcase-kit/music';

export function notFoundScreen(t, locale) {
  return screen(t, {
    locale,
    here: '/',
    title: t('music.screen.notFound.title'),
    subtitle: t('music.screen.notFound.subtitle'),
    children: html`${emptyState(t('music.screen.notFound.subtitle'))}
      <div class="row">
        <md-button${attrs({
          class: 'notfound__home',
          variant: 'filled',
          icon: 'home',
          href: localeHref(locale, route.home()),
        })}>${t('music.nav.home')}</md-button>
      </div>`,
  });
}
