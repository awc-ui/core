// Astro rewrites asset URLs for `base` automatically, but NOT hrefs authored in
// markup. Every in-app link must go through this helper so the app works both at
// "/" (dev) and under a mount path such as /showcase/SPIKE/astro/.
// BASE_URL is "/" when `base` is unset. Whether it keeps a trailing slash
// depends on the `trailingSlash` setting, so normalise it here.
const BASE = import.meta.env.BASE_URL.replace(/\/+$/, '');

/** Prefix an app-absolute path ("/", "/checkout") with the configured base. */
export function withBase(path: string): string {
  const clean = path.replace(/^\/+/, '');
  return clean ? `${BASE}/${clean}` : BASE || '/';
}
