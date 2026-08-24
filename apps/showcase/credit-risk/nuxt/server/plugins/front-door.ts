/**
 * THE FRONT DOOR.
 *
 * `app.baseURL` is `/showcase/credit-risk/nuxt/`, and Nitro mounts the whole
 * application there — the router, the middleware and the `public/` assets
 * alike. That is correct in production, where this build is one of seven
 * sitting behind a shared host, and useless when the server is run on its own:
 * you start it, open the port it printed, and your own app answers 404.
 *
 * `scripts/verify-ssr.mjs` at the repo root hits `/` for exactly that reason —
 * it is the readiness check, and it is also where both SSR probes are taken —
 * so `/` has to lead somewhere. It redirects rather than rewrites: the address
 * bar should end up showing the path the build actually lives at, the same one
 * the dock's framework switcher rewrites when you move between builds. The
 * `next` build's `server.mjs` does the identical thing for the identical
 * reason.
 *
 * Only two paths move. The bare root, and the mount without its trailing slash
 * (`/showcase/credit-risk/nuxt`), which Nitro does not match against a baseURL
 * that carries one. Anything else outside the mount is a genuine wrong address
 * and keeps the 404 rather than being quietly rewritten.
 *
 * WHY THE `request` HOOK. It is the only seam that sees the RAW path. Server
 * middleware in `server/middleware/` is mounted under `app.baseURL` like
 * everything else, so it never runs for a path outside the mount; and route
 * rules are matched with the base already stripped, which makes `/` and
 * `/showcase/credit-risk/nuxt/` the same rule and any redirect on it a loop.
 * The `request` hook is Nitro's `onRequest`, called before a single layer is
 * consulted, with `event.path` still the whole thing.
 *
 * The response is written straight to the node socket. `sendRedirect` would do
 * the same and reads better, but this hook's contract is "observe", not
 * "answer" — h3 continues down its layer stack after it returns either way, and
 * finding every layer skipped and the response already ended is the quiet path
 * through. Writing the two lines here rather than importing a helper keeps that
 * visible.
 */
import { createRoutes } from '@awc-ui/showcase-kit/credit-risk';

/** e.g. `/showcase/credit-risk/nuxt`. No trailing slash — see `lib/routes.ts`. */
const { basePath: BASE_PATH } = createRoutes('nuxt');

export default defineNitroPlugin((nitro) => {
  nitro.hooks.hook('request', (event) => {
    const [pathname, query] = (event.path || '/').split('?');
    if (pathname !== '/' && pathname !== '' && pathname !== BASE_PATH) return;

    event.node.res.writeHead(308, {
      location: `${BASE_PATH}/${query ? `?${query}` : ''}`,
    });
    event.node.res.end();
  });
});
