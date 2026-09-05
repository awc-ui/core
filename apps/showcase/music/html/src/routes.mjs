/**
 * Every page this build writes, as `{ path, render }`.
 *
 * ONE LIST, TWO CONSUMERS. `scripts/build.mjs` writes a file per entry per
 * locale and `scripts/lint.mjs` renders every entry in every locale looking for
 * the smells a template-literal renderer produces. Written twice, the two would
 * agree until the first screen was added to one of them.
 *
 * THE DRILLS COME FROM THE FIXTURE, not from a hard-coded table: a post added
 * to the kit adds a page here without a second edit, which is the same contract
 * the four SPA builds' fan-out scripts follow.
 *
 * THE VIEWER'S OWN HANDLE IS WRITTEN TOO, and it renders their own profile.
 * The four SPA builds all resolve `/people/petra.novak/` — their fan-out writes
 * a shell for every person and `personScreen` delegates to `profileScreen` at
 * runtime — so omitting the file here would make one of the five ports answer
 * 404 for a URL the other four serve. A port that differs from its reference on
 * which URLs exist is worse than a duplicate page, and it is exactly the kind
 * of difference that only shows up when somebody follows a link.
 */

import {
  getAlbums,
  getArtists,
  getProjects,
  getTracks,
  route,
} from '@awc-ui/showcase-kit/music';
import { homeScreen } from './screens/home.mjs';
import { libraryScreen } from './screens/library.mjs';
import { studioScreen } from './screens/studio.mjs';
import { mixerScreen } from './screens/mixer.mjs';
import { profileScreen } from './screens/profile.mjs';
import { albumScreen } from './screens/album.mjs';
import { artistScreen } from './screens/artist.mjs';
import { trackScreen } from './screens/track.mjs';

export function routes() {
  return [
    { path: route.home(), render: (t, locale) => homeScreen(t, locale) },
    { path: route.library(), render: (t, locale) => libraryScreen(t, locale) },
    { path: route.studio(), render: (t, locale) => studioScreen(t, locale) },
    { path: route.mixer(), render: (t, locale) => mixerScreen(t, locale) },
    { path: route.profile(), render: (t, locale) => profileScreen(t, locale) },

    ...getAlbums().map((album) => ({
      path: route.album(album.slug),
      render: (t, locale) => albumScreen(t, locale, album.slug),
    })),
    ...getArtists().map((artist) => ({
      path: route.artist(artist.handle),
      render: (t, locale) => artistScreen(t, locale, artist.handle),
    })),
    ...getTracks().map((track) => ({
      path: route.track(track.id),
      render: (t, locale) => trackScreen(t, locale, track.id),
    })),
    ...getProjects().map((project) => ({
      path: route.project(project.slug),
      render: (t, locale) => studioScreen(t, locale, project.slug),
    })),
  ];
}
