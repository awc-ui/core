#!/usr/bin/env node
/**
 * The runtime server for the `sveltekit` showcase build.
 *
 *   node server.mjs [port]     # needs `pnpm build` first
 *   PORT=4612 pnpm start
 *
 * This file used to be `scripts/serve-build.mjs`, a static file server that
 * handed out the 95 prerendered `index.html` files at the mount path. There is
 * nothing static left to serve: `adapter-node` writes `build/index.js` (a
 * standalone server) and `build/handler.js` (the same thing as a middleware),
 * and every screen is rendered on demand by `src/hooks.server.ts`.
 *
 * WHY NOT JUST `node build/index.js`
 *
 * One reason, and it is the front door. `paths.base` means SvelteKit answers
 * 404 at `/` — correct in production, where this build is one of several
 * mounted behind a shared host, and useless when the server is run on its own:
 * you start it, open the port it printed, and get a 404 from your own app.
 * `scripts/verify-ssr.mjs` hits `/` for exactly that reason, as a readiness
 * check. So the bare root — and only the bare root — is redirected onto the
 * mount. Anything else outside it is a genuine wrong address and keeps
 * SvelteKit's own 404 rather than being quietly rewritten.
 *
 * NO COMPRESSION LAYER HERE, deliberately, and it is worth saying why given
 * that the `next` build next door needs one. There, the framework compresses
 * inside its own handler, so a transform bolted on afterwards sees gzip instead
 * of HTML and silently does nothing — a real bug that shipped once. Here the
 * transform happens INSIDE the render, in `hooks.server.ts`, before any byte is
 * encoded, so there is nothing to unwrap and nothing to get wrong.
 *
 * What that leaves is a big document: a screen is 20–23 kB of markup before the
 * transform and 1.1–1.6 MB after it, because every component's styles are
 * inlined into every shadow root. That is what declarative shadow DOM costs, it
 * compresses to a fraction of itself, and encoding it is a reverse proxy's job
 * in production. It is not made this server's job here, where the alternative is
 * buffering and re-encoding every response by hand on the one code path that
 * must not be got wrong. adapter-node serves the precompressed CLIENT assets
 * itself either way.
 */
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRoutes } from '@awc-ui/showcase-kit/credit-risk';

const appRoot = dirname(fileURLToPath(import.meta.url));

/**
 * The mount is read from the kit rather than written down again here, which is
 * the whole reason `createRoutes()` exists: one fact, one place.
 */
const BASE_PATH = createRoutes('sveltekit').basePath;

const handlerPath = join(appRoot, 'build', 'handler.js');
if (!existsSync(handlerPath)) {
  console.error(
    `[awc-ssr] ${handlerPath} does not exist — build first:\n` +
      '          pnpm --filter @awc-ui/showcase-credit-risk-sveltekit build',
  );
  process.exit(1);
}

/**
 * Prove the BUILD agrees with the kit about where it is mounted, not just the
 * config file. adapter-node writes the client assets to `build/client${base}`,
 * so if that directory is missing, `paths.base` in `svelte.config.js` and
 * `createRoutes(...).basePath` have drifted apart — the single most common bug
 * in this vertical, and otherwise a silent one: the server would redirect onto
 * a path the app answers 404 at, and every asset URL would miss.
 */
if (!existsSync(join(appRoot, 'build', 'client', BASE_PATH))) {
  console.error(
    `[awc-ssr] the build has no client assets under ${BASE_PATH} —\n` +
      "          `paths.base` in svelte.config.js does not match the kit's basePath.",
  );
  process.exit(1);
}

const { handler } = await import('./build/handler.js');

const portArg = process.argv.slice(2).find((arg) => /^\d+$/.test(arg));
const port = Number(process.env.PORT ?? portArg ?? 4612);
const hostname = process.env.HOST ?? 'localhost';

createServer((req, res) => {
  const [pathname, query] = (req.url ?? '/').split('?');

  if (pathname === '/' || pathname === '') {
    res.writeHead(308, { location: `${BASE_PATH}/${query ? `?${query}` : ''}` });
    res.end();
    return;
  }

  // `handler` is a polka-style middleware and always answers — SvelteKit
  // renders its own 404 rather than falling through. The fallback is here so
  // that a future middleware in front of it cannot end in a hung socket.
  handler(req, res, () => {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  });
}).listen(port, hostname, () => {
  console.log(`[awc-ssr] http://${hostname}:${port}${BASE_PATH}/`);
});
