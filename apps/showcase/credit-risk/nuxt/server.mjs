#!/usr/bin/env node
/**
 * The runtime server for the `nuxt` showcase build.
 *
 *   pnpm start          # port 4611
 *   PORT=8080 pnpm start
 *   node server.mjs 4611
 *
 * It is a wrapper, not a server. The server is `.output/server/index.mjs` — the
 * Nitro `node-server` bundle `nuxi build` produces, which listens for itself the
 * moment it is imported. Everything the AWC UI showcase needs from a request
 * happens inside that process, in `server/plugins/`: the shadow-DOM injection,
 * the render stamp, the front-door redirect. There is deliberately nothing to
 * intercept out here, which is the difference between this and the `next`
 * build's `server.mjs`: Next 14 has no per-response hook, so its server IS the
 * hook. Nitro has two, so this file has one job.
 *
 * THAT JOB IS THE PORT. Nitro reads `NITRO_PORT || PORT || 3000`, and 3000 is
 * not the port `scripts/verify-ssr.mjs` looks for — the seven showcase builds
 * each own one, and this one owns 4611. An explicit `$PORT` still wins, so the
 * usual platform convention keeps working; a bare numeric argument is the
 * fallback, which is what `scripts/verify-browser.mjs` uses to run on a port of
 * its own without disturbing a server you already have up.
 *
 * Both variables are set, and to the same value, because `NITRO_PORT` takes
 * priority inside Nitro: leaving it alone would let a stale `NITRO_PORT` in the
 * environment silently win over the `$PORT` that was just asked for.
 */
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const appRoot = dirname(fileURLToPath(import.meta.url));
const entry = join(appRoot, '.output/server/index.mjs');

if (!existsSync(entry)) {
  console.error(
    `[awc-ssr] ${entry} does not exist — build first:\n` +
      '          pnpm --filter @awc-ui/showcase-credit-risk-nuxt build',
  );
  process.exit(1);
}

const portArg = process.argv.slice(2).find((arg) => /^\d+$/.test(arg));
const port = String(process.env.PORT ?? portArg ?? 4611);

process.env.PORT = port;
process.env.NITRO_PORT = port;

await import(pathToFileURL(entry).href);
