/**
 * The route table. Seven patterns, resolved in the browser.
 *
 * Four are exact paths and three take a parameter. The paths are not spelled
 * out here — they come from `route.*` in `@awc-ui/showcase-kit/design`, so the
 * strings this file matches on and the strings the rail links to are the same
 * strings. A literal `'/assets/'` here would agree with the kit right up until
 * somebody renamed the route.
 *
 * A PROJECT AND AN ASSET ARE MATCHED BY SLUG; A FILE KEEPS ITS ID. Project and
 * asset names are distinctive, so `/p/atlas-mobile/` reads as an address. File
 * names are not — "Cover" and "Hero" recur in every project — so a slug would
 * collide and disambiguating it would produce exactly the opaque URL the slug
 * was avoiding. The id is honest about being an id.
 *
 * THE 404 FOR AN UNKNOWN ID is the screen's own guard, not this file's. All
 * three drill screens look their parameter up and render the not-found state
 * when the fixture does not know it — a component taking a plain string from a
 * URL must not trust its caller.
 *
 * NO WRAPPER ELEMENT. This returns the screen itself. A `<div>` around it would
 * become a block inside the shell's child list and shift every measured gap
 * when the other four ports are compared against this one.
 */

import { usePathname } from '@/lib/router';
import { route } from '@/lib/routes';

import { AssetScreen } from '@/components/screens/AssetScreen';
import { AssetsScreen } from '@/components/screens/AssetsScreen';
import { EditorScreen } from '@/components/screens/EditorScreen';
import { NotFoundScreen } from '@/components/screens/NotFoundScreen';
import { ProfileScreen } from '@/components/screens/ProfileScreen';
import { ProjectScreen } from '@/components/screens/ProjectScreen';
import { ProjectsScreen } from '@/components/screens/ProjectsScreen';

/**
 * The three parameterised routes. `[^/]+` rather than `.+` so
 * `/p/atlas-mobile/edit/` does not silently render a project called
 * `atlas-mobile/edit`.
 */
const PROJECT = /^\/p\/([^/]+)\/$/;
const FILE = /^\/f\/([^/]+)\/$/;
const ASSET = /^\/a\/([^/]+)\/$/;

export function App() {
  const pathname = usePathname();

  if (pathname === route.projects()) return <ProjectsScreen />;
  if (pathname === route.editor()) return <EditorScreen />;
  if (pathname === route.assets()) return <AssetsScreen />;
  if (pathname === route.profile()) return <ProfileScreen />;

  /*
   * The path is percent-encoded on the way into the URL. The fixture's ids and
   * slugs are plain ASCII today, but decoding is what makes a lookup miss mean
   * "no such thing" rather than "the slug had a character in it".
   */
  const project = PROJECT.exec(pathname);
  if (project) return <ProjectScreen slug={decodeURIComponent(project[1])} />;

  /* A FILE DRILL IS THE EDITOR POINTED SOMEWHERE ELSE, not a different screen.
     Opening a file IS editing it, so the drill renders the same component with
     a file id — which is also why the destination highlights as Editor. */
  const file = FILE.exec(pathname);
  if (file) return <EditorScreen fileId={decodeURIComponent(file[1])} />;

  const asset = ASSET.exec(pathname);
  if (asset) return <AssetScreen assetId={decodeURIComponent(asset[1])} />;

  return <NotFoundScreen />;
}
