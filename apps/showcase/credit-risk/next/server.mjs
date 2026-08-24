#!/usr/bin/env node
/**
 * The runtime server for the `next` showcase build.
 *
 *   node server.mjs [port]        # production, needs `next build` first
 *   node server.mjs --dev [port]  # dev
 *
 * It exists for one reason: to run the rendered HTML through the AWC UI hydrate
 * module before it leaves the process, so `md-*` elements arrive with their
 * shadow DOM already painted.
 *
 * WHY A CUSTOM SERVER AND NOT `next start`
 *
 * `next start` serves whatever the App Router produced, and the App Router
 * produces `<md-card class="panel">…</md-card>` — a bare custom-element tag with
 * no shadow root, because a custom element is only upgraded by a browser. First
 * paint is therefore unstyled until Stencil's runtime loads and builds every
 * shadow root client-side. Server rendering the components fixes that, and the
 * transform needs the finished HTML string, which is the one thing a React
 * component tree cannot hand you.
 *
 * Three ways to get that string were considered:
 *
 *  1. `@awc-ui/react/server` — the generated SSR wrappers, and what
 *     `starters/next` uses. Correct, and NOT AVAILABLE here: `@awc-ui/react` is
 *     not a dependency of this app and adding it means an install, which this
 *     workspace does not allow on a whim. It would also undo the deliberate
 *     decision recorded in `scripts/sync-runtime.mjs` — the wrappers pull
 *     `@awc-ui/core` into the browser graph and the lazy loader goes looking for
 *     entry chunks under `/_next/static/` that nobody wrote.
 *  2. Next middleware. Next 14 runs middleware on the Edge runtime; the hydrate
 *     module is a Node build. Node middleware did not land until 15.2.
 *  3. This: buffer the response, transform, send. Same primitive the rest of the
 *     repo already uses — `starters/astro/src/middleware.ts`,
 *     `starters/nuxt/server/plugins/awc-ssr-dsd.ts` and
 *     `starters/sveltekit/src/hooks.server.ts` are the identical eight lines
 *     hung off each framework's own response hook. Next 14 has no such hook, so
 *     the hook is the server.
 *
 * WHAT IT COSTS: streaming. Everything is buffered so the transform can see a
 * whole document. Nothing here streams anyway — no `loading.tsx`, no Suspense,
 * and every fixture selector is synchronous — so there is no first-byte to lose.
 */

import { createServer } from 'node:http';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzip } from 'node:zlib';
import next from 'next';
import { renderToString } from '@awc-ui/core/hydrate';
import nextConfig from './next.config.mjs';

const appRoot = dirname(fileURLToPath(import.meta.url));
/** Read from the Next config rather than written down twice. */
const BASE_PATH = nextConfig.basePath;
const dev = process.argv.includes('--dev');
const portArg = process.argv.slice(2).find((arg) => /^\d+$/.test(arg));
const port = Number(process.env.PORT ?? portArg ?? 4610);
const hostname = process.env.HOSTNAME ?? 'localhost';

/**
 * Options copied from the sibling starters, plus one.
 *
 * `maxHydrateCount` defaults to 300. These screens go well past that — the
 * facility and counterparty tables alone are hundreds of `md-table-cell`s — and
 * the limit is silent: components past it are left as inert tags, so the page
 * looks half server-rendered and nothing says why.
 */
const HYDRATE_OPTIONS = {
  serializeShadowRoot: 'declarative-shadow-dom',
  removeScripts: false,
  removeHtmlComments: false,
  removeUnusedStyles: false,
  maxHydrateCount: 10_000,
};

const GZIP_OK = /\bgzip\b/i;
const COMPRESSIBLE = /^(text\/|application\/(javascript|json|xml)|image\/svg)/i;

/** Inject Declarative Shadow DOM for every `md-*` element in a rendered page. */
async function injectShadowRoots(html) {
  const { html: hydrated, diagnostics } = await renderToString(html, {
    ...HYDRATE_OPTIONS,
    fullDocument: html.includes('<html'),
  });
  const errors = (diagnostics ?? []).filter((d) => d.level === 'error');
  if (errors.length) {
    throw new Error(errors.map((d) => d.messageText).join(' | '));
  }
  return hydrated;
}

/**
 * Buffer an HTML response so it can be rewritten before the head is flushed.
 *
 * The head cannot go out early: the transform changes the body length, so
 * `content-length` is only knowable afterwards. `writeHead` is therefore
 * intercepted and folded into `setHeader` calls rather than being allowed to
 * send, and `flushHeaders` is neutered for the same reason. Everything is put
 * back before the real `end`, so anything holding a reference to the response
 * after that sees a normal one.
 *
 * Non-HTML responses — `_next/static/*`, the `text/x-component` RSC payloads a
 * client-side navigation fetches, `public/` assets — are passed through byte for
 * byte. So is any HTML with no `md-` tag in it, which is what keeps a 404 or a
 * redirect cheap.
 *
 * COMPRESSION IS OURS, NOT NEXT'S. Next compresses by default, and it does it
 * INSIDE the handler — so what arrives here would be gzip, and every test of
 * the buffer ("is this HTML?", "does it contain `<md-`?") would be run against
 * binary and quietly answer no. That is not hypothetical: the first version of
 * this file did exactly that, and served correct-looking pages with no shadow
 * DOM in them to any client that sent `Accept-Encoding` — which curl does not
 * by default and `fetch` always does, so it passed by hand and failed
 * `verify:ssr`. The request is therefore stripped of `accept-encoding` before
 * Next sees it, and this layer compresses the finished bytes instead.
 */
function captureHtml(res, acceptEncoding) {
  const chunks = [];
  const rawWriteHead = res.writeHead.bind(res);
  const rawWrite = res.write.bind(res);
  const rawEnd = res.end.bind(res);
  const rawFlushHeaders = res.flushHeaders.bind(res);

  res.writeHead = function writeHead(status, arg1, arg2) {
    res.statusCode = status;
    if (typeof arg1 === 'string') res.statusMessage = arg1;
    const headers = typeof arg1 === 'object' && arg1 !== null ? arg1 : arg2;
    if (Array.isArray(headers)) {
      // Flat [k, v, k, v] or an array of [k, v] pairs — Node accepts both.
      if (Array.isArray(headers[0])) {
        for (const [key, value] of headers) res.setHeader(key, value);
      } else {
        for (let i = 0; i < headers.length; i += 2) res.setHeader(headers[i], headers[i + 1]);
      }
    } else if (headers) {
      for (const [key, value] of Object.entries(headers)) {
        if (value !== undefined) res.setHeader(key, value);
      }
    }
    return res;
  };

  res.flushHeaders = function flushHeaders() {};

  res.write = function write(chunk, encoding, callback) {
    if (typeof encoding === 'function') [callback, encoding] = [encoding, undefined];
    if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding || 'utf8'));
    if (callback) process.nextTick(callback);
    return true;
  };

  res.end = function end(chunk, encoding, callback) {
    if (typeof chunk === 'function') [callback, chunk] = [chunk, undefined];
    else if (typeof encoding === 'function') [callback, encoding] = [encoding, undefined];
    if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding || 'utf8'));

    res.writeHead = rawWriteHead;
    res.write = rawWrite;
    res.end = rawEnd;
    res.flushHeaders = rawFlushHeaders;

    const body = Buffer.concat(chunks);

    const flush = (buffer, encoding) => {
      res.removeHeader('transfer-encoding');
      if (encoding) res.setHeader('content-encoding', encoding);
      res.setHeader('content-length', String(buffer.length));
      rawWriteHead(res.statusCode);
      rawEnd(buffer, callback);
    };

    const send = (buffer) => {
      res.removeHeader('content-encoding');
      const type = String(res.getHeader('content-type') ?? '');
      // Below ~1 kB the gzip header costs more than it saves.
      if (!GZIP_OK.test(acceptEncoding) || buffer.length < 1024 || !COMPRESSIBLE.test(type)) {
        flush(buffer, null);
        return;
      }
      gzip(buffer, (error, compressed) => {
        if (error) flush(buffer, null);
        else flush(compressed, 'gzip');
      });
    };

    const contentType = String(res.getHeader('content-type') ?? '');
    const html = contentType.includes('text/html') ? body.toString('utf8') : null;
    if (html === null || !html.includes('<md-')) {
      send(body);
      return res;
    }

    injectShadowRoots(html).then(
      (hydrated) => {
        // Say so in a header as well: it makes "did the transform run?" a
        // question curl can answer without reading the body.
        res.setHeader('x-awc-ssr', 'declarative-shadow-dom');
        send(Buffer.from(hydrated, 'utf8'));
      },
      (error) => {
        // A failed transform must not cost the user the page. The untransformed
        // HTML is still a working document — the components just build their
        // shadow roots client-side, exactly as they did before this server
        // existed.
        console.error('[awc-ssr] shadow-root injection failed, serving raw HTML:', error);
        send(body);
      },
    );
    return res;
  };
}

const app = next({ dev, dir: appRoot, hostname, port });
await app.prepare();
const handle = app.getRequestHandler();

createServer((req, res) => {
  // THE FRONT DOOR. `basePath` means Next answers 404 at `/` — correct in
  // production, where this build is one of several mounted behind a shared
  // host, and useless when the server is run on its own: you start it, open
  // the port it printed, and get a 404 from your own app. `scripts/verify-ssr.mjs`
  // hits `/` for exactly that reason, as a readiness check.
  //
  // Only the bare root redirects. Anything else outside the mount is a genuine
  // wrong address and keeps Next's 404 rather than being quietly rewritten.
  const [pathname, query] = (req.url ?? '/').split('?');
  if (pathname === '/' || pathname === '') {
    res.writeHead(308, { location: `${BASE_PATH}/${query ? `?${query}` : ''}` });
    res.end();
    return;
  }

  // Take compression away from Next and give it to `captureHtml` — see the
  // comment there. The client's preference is remembered, not discarded.
  const acceptEncoding = String(req.headers['accept-encoding'] ?? '');
  delete req.headers['accept-encoding'];

  captureHtml(res, acceptEncoding);
  Promise.resolve(handle(req, res)).catch((error) => {
    console.error('[awc-ssr] request failed:', error);
    if (!res.headersSent) res.statusCode = 500;
    res.end('Internal Server Error');
  });
}).listen(port, () => {
  console.log(`[awc-ssr] http://${hostname}:${port}${BASE_PATH}/`);
});
