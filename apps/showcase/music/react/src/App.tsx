/**
 * The route table. Nine patterns, resolved in the browser.
 *
 * Five are exact paths and four take a parameter. The paths are not spelled out
 * here — they come from `route.*` in `@awc-ui/showcase-kit/music`, so the
 * strings this file matches on and the strings the rail links to are the same
 * strings. A literal `'/library/'` here would agree with the kit right up until
 * somebody renamed the route.
 *
 * THREE OF THE FOUR DRILLS ARE MATCHED BY SLUG rather than by id — an album, an
 * artist and a project each have a name that is how a person refers to them,
 * and `/project/prj-04/` would be the detail that made this app feel unlike a
 * music app. A TRACK keeps its id, and not by oversight: track titles collide
 * both across albums and within one discography, so a slug would not be unique
 * and disambiguating it would produce exactly the opaque URL it was avoiding.
 *
 * THE 404 FOR AN UNKNOWN ID is the screen's own guard, not this file's. All four
 * drill screens look their parameter up and render the not-found state when the
 * fixture does not know it — a component taking a plain string from a URL must
 * not trust its caller.
 *
 * NO WRAPPER ELEMENT. This returns the screen itself. A `<div>` around it would
 * become a block inside the shell's child list and shift every measured gap
 * when the other four ports are compared against this one.
 */

import { usePathname } from '@/lib/router';
import { route } from '@/lib/routes';

import { AlbumScreen } from '@/components/screens/AlbumScreen';
import { ArtistScreen } from '@/components/screens/ArtistScreen';
import { HomeScreen } from '@/components/screens/HomeScreen';
import { LibraryScreen } from '@/components/screens/LibraryScreen';
import { MixerScreen } from '@/components/screens/MixerScreen';
import { NotFoundScreen } from '@/components/screens/NotFoundScreen';
import { ProfileScreen } from '@/components/screens/ProfileScreen';
import { ProjectScreen } from '@/components/screens/ProjectScreen';
import { StudioScreen } from '@/components/screens/StudioScreen';
import { TrackScreen } from '@/components/screens/TrackScreen';

/**
 * The four parameterised routes. `[^/]+` rather than `.+` so
 * `/album/drift-season/edit/` does not silently render an album called
 * `drift-season/edit`.
 */
const ALBUM = /^\/album\/([^/]+)\/$/;
const ARTIST = /^\/artist\/([^/]+)\/$/;
const TRACK = /^\/t\/([^/]+)\/$/;
const PROJECT = /^\/project\/([^/]+)\/$/;

export function App() {
  const pathname = usePathname();

  if (pathname === route.home()) return <HomeScreen />;
  if (pathname === route.library()) return <LibraryScreen />;
  if (pathname === route.studio()) return <StudioScreen />;
  if (pathname === route.mixer()) return <MixerScreen />;
  if (pathname === route.profile()) return <ProfileScreen />;

  /*
   * The path is percent-encoded on the way into the URL. The fixture's ids and
   * slugs are plain ASCII today, but decoding is what makes a lookup miss mean
   * "no such thing" rather than "the slug had a character in it".
   */
  const album = ALBUM.exec(pathname);
  if (album) return <AlbumScreen slug={decodeURIComponent(album[1])} />;

  const artist = ARTIST.exec(pathname);
  if (artist) return <ArtistScreen handle={decodeURIComponent(artist[1])} />;

  const track = TRACK.exec(pathname);
  if (track) return <TrackScreen trackId={decodeURIComponent(track[1])} />;

  const project = PROJECT.exec(pathname);
  if (project) return <ProjectScreen slug={decodeURIComponent(project[1])} />;

  return <NotFoundScreen />;
}
