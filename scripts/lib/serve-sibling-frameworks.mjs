/**
 * A dev-server plugin that answers for a vertical's OTHER framework builds.
 *
 * WHAT IT SOLVES. Every build of a vertical is a sibling under
 * `/showcase/<vertical>/<framework>/`, and the dock's framework switcher moves
 * between them by rewriting that one path segment while leaving the origin
 * alone — exactly right in production, where they share a host. In development
 * they do not: each app runs its own dev server on its own port, so switching
 * from the React app on :4337 to Angular asks :4337 for
 * `/showcase/wealth/angular/`, and Vite answers with its "the server is
 * configured with a public base URL of /showcase/wealth/react/" page.
 *
 * `scripts/showcase-preview.mjs` already solves that by serving every build
 * from one origin, and it stays the right tool for checking what deploys. It is
 * the wrong tool while WRITING one of them, because it serves the staged copy
 * of the app you are editing — no HMR, and a rebuild between every keystroke
 * and the page. Being told to give that up in order to click a control that is
 * part of the page under test is a bad trade, and the reason this exists.
 *
 * WHAT IT DOES. Requests for a framework OTHER than the one this server owns
 * are served from the staged build under `apps/docs/public/showcase/…`, which
 * is what `pnpm showcase:build` writes and what the preview server and both
 * verifiers read. The app being developed keeps its own dev pipeline untouched:
 * this only claims paths that Vite would otherwise reject outright.
 *
 * The sibling is a BUILD, so it is as fresh as the last `showcase:build` — it
 * does not live-reload, and it should not pretend to. A framework that has
 * never been staged gets a page saying so and naming the command, rather than a
 * bare 404 that looks like the switcher is broken.
 */

import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

const page = (title, body) =>
  `<!doctype html><meta charset="utf-8"><title>${title}</title>` +
  `<body style="font:16px/1.6 system-ui;margin:3rem auto;max-width:46rem;padding:0 1rem">${body}`;

/**
 * @param {object} options
 * @param {string} options.repoRoot   Absolute path to the monorepo root.
 * @param {string} options.vertical   e.g. `wealth`.
 * @param {string} options.framework  The framework THIS server owns; left alone.
 * @param {readonly string[]} options.siblings  Every framework in the vertical.
 * @returns {import('vite').Plugin}
 */
export function serveSiblingFrameworks({ repoRoot, vertical, framework, siblings }) {
  const staged = resolve(repoRoot, 'apps/docs/public/showcase', vertical);
  const others = siblings.filter((id) => id !== framework);
  const prefixes = others.map((id) => ({ id, prefix: `/showcase/${vertical}/${id}` }));

  return {
    name: 'awc-serve-sibling-frameworks',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
        const hit = prefixes.find((p) => path === p.prefix || path.startsWith(`${p.prefix}/`));
        if (!hit) return next();

        const root = join(staged, hit.id);
        if (!existsSync(root)) {
          res.statusCode = 503;
          res.setHeader('content-type', TYPES['.html']);
          res.end(
            page(
              `${hit.id} is not staged`,
              `<h1>The <code>${hit.id}</code> build is not staged yet</h1>` +
                `<p>This is the <code>${framework}</code> dev server. It serves the other ` +
                `frameworks of this vertical from their built output so the dock's switcher ` +
                `works here, and that output has not been produced yet.</p>` +
                `<pre>pnpm showcase:build --vertical ${vertical}</pre>` +
                `<p>Then reload. The sibling is a build, so it is as fresh as that command — ` +
                `only <code>${framework}</code> live-reloads on this server.</p>`,
            ),
          );
          return;
        }

        // normalize() collapses any `..` before the join, so a traversal attempt
        // resolves inside the staged directory rather than above it.
        const rest = normalize(path.slice(hit.prefix.length) || '/');
        let file = join(root, rest);
        if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');

        if (!existsSync(file) || statSync(file).isDirectory()) {
          // Deep links are real files in these builds (each one is fanned out at
          // build time), so a miss means the route does not exist rather than
          // that a history fallback is needed — answer as the static host would.
          res.statusCode = 404;
          res.setHeader('content-type', TYPES['.html']);
          res.end(page('404', `<h1>404</h1><p><code>${path}</code> is not in the ${hit.id} build.</p>`));
          return;
        }

        res.setHeader('content-type', TYPES[extname(file)] || 'application/octet-stream');
        // The staged copy changes only when showcase:build runs, but it changes
        // wholesale when it does — so no caching, or a switch back lands on the
        // previous build.
        res.setHeader('cache-control', 'no-store');
        createReadStream(file).pipe(res);
      });
    },
  };
}
