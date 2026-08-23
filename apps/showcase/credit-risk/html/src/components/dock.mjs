/**
 * `<awc-showcase-dock>` — the same bar on every screen, in every framework.
 *
 * `locale-route` tells the dock this build's language lives in the URL: the
 * picker reflects the DOCUMENT's `lang` rather than whatever is in
 * localStorage, and changing it navigates to the same screen in the new
 * language instead of firing a state change that nothing here would re-render
 * for. Its value names the locale served WITHOUT a path segment.
 *
 * `base-path` is the prefix BEFORE the framework segment — the dock swaps
 * `html` for `react` inside the path it finds and only falls back to this when
 * the current segment is absent from the URL. `data-app-base` is one segment
 * longer, and is what the locale switcher rewrites around.
 */

import { FRAMEWORKS, SHOWCASE_BASE } from '@awc-ui/showcase-kit/credit-risk';
import { attrs, html } from '../lib/html.mjs';
import { BASE_PATH, DEFAULT_LOCALE, FRAMEWORK } from '../lib/i18n.mjs';

export function dock() {
  return html`<awc-showcase-dock${attrs({
    frameworks: FRAMEWORKS.join(','),
    framework: FRAMEWORK,
    'base-path': SHOWCASE_BASE,
    'locale-route': DEFAULT_LOCALE,
    position: 'bottom',
    'data-app-base': BASE_PATH,
  })}></awc-showcase-dock>`;
}
