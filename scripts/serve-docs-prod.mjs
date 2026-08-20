#!/usr/bin/env node
/**
 * Serve `apps/docs/dist` the way the CDN will.
 *
 * `astro preview` serves the built site but does NO content encoding, so it
 * tells you nothing about what a visitor actually downloads. This does what the
 * edge does: negotiate `Accept-Encoding`, prefer brotli, fall back to gzip,
 * and serve identity to anything that asks for neither.
 *
 * Compression is quality 11 (what a build-time precompress would emit, not the
 * lower quality a CDN uses when compressing on the fly) and every result is
 * memoised, so the cost is paid once per file and the numbers you read are the
 * best case. A `.br` / `.gz` sitting next to a file is served as-is, which is
 * how a precompressed deploy behaves.
 *
 * Cache-Control mirrors a normal static deploy: content-hashed assets are
 * immutable for a year, HTML always revalidates. That makes repeat-load
 * behaviour realistic too, not just first paint.
 *
 * Usage:  node scripts/serve-docs-prod.mjs [--port 4323] [--no-compress]
 */
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = resolve(repoRoot, 'apps/docs/dist');

const argv = process.argv.slice(2);
const portArg = argv.indexOf('--port');
const PORT = portArg > -1 ? Number(argv[portArg + 1]) : 4323;
const COMPRESS = !argv.includes('--no-compress');

if (!existsSync(root)) {
  console.error(`[serve-prod] ${root} does not exist — build first:\n              pnpm build`);
  process.exit(1);
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
  '.map': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
};

/** Types worth compressing. Images/fonts are already compressed formats. */
const COMPRESSIBLE = new Set(['.html', '.js', '.mjs', '.css', '.json', '.svg', '.md', '.txt', '.xml', '.map']);
const MIN_COMPRESS_BYTES = 1024;

/** key: `${path}|${encoding}` → Buffer */
const cache = new Map();
let served = 0;
let rawTotal = 0;
let sentTotal = 0;

function encode(buf, encoding) {
  return encoding === 'br'
    ? brotliCompressSync(buf, {
        params: {
          [constants.BROTLI_PARAM_QUALITY]: 11,
          [constants.BROTLI_PARAM_SIZE_HINT]: buf.length,
        },
      })
    : gzipSync(buf, { level: 9 });
}

/** Pick the best encoding the client accepts. */
function negotiate(header = '') {
  const accept = header.toLowerCase();
  if (!COMPRESS) return null;
  if (/\bbr\b/.test(accept)) return 'br';
  if (/\bgzip\b/.test(accept)) return 'gzip';
  return null;
}

/** Resolve a URL path to a file on disk, the way a static host does. */
function resolveFile(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0].split('#')[0]);
  // Block traversal: normalise, then require the result to stay under root.
  const candidate = resolve(root, '.' + normalize(clean));
  if (candidate !== root && !candidate.startsWith(root + sep)) return null;

  if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  const asIndex = join(candidate, 'index.html');
  if (existsSync(asIndex)) return asIndex;
  const asHtml = candidate + '.html';
  if (existsSync(asHtml)) return asHtml;
  return null;
}

function cacheControl(file) {
  // Content-hashed assets (Astro's _astro/, Stencil's chunk hashes) can be
  // pinned; HTML has to revalidate or a deploy never reaches anyone.
  if (extname(file) === '.html') return 'public, max-age=0, must-revalidate';
  if (/[.-][A-Za-z0-9_-]{8,}\.(js|css|woff2?)$/.test(file)) return 'public, max-age=31536000, immutable';
  return 'public, max-age=3600';
}

const server = createServer((req, res) => {
  const file = resolveFile(req.url || '/');

  if (!file) {
    const notFound = join(root, '404.html');
    const body = existsSync(notFound) ? readFileSync(notFound) : Buffer.from('404');
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': body.length });
    return res.end(req.method === 'HEAD' ? undefined : body);
  }

  const ext = extname(file);
  const type = MIME[ext] || 'application/octet-stream';
  const size = statSync(file).size;
  const headers = { 'Content-Type': type, 'Cache-Control': cacheControl(file), Vary: 'Accept-Encoding' };

  let encoding = COMPRESSIBLE.has(ext) && size >= MIN_COMPRESS_BYTES ? negotiate(req.headers['accept-encoding']) : null;

  // No encoding wanted (or not worth it): stream it straight through.
  if (!encoding) {
    headers['Content-Length'] = size;
    res.writeHead(200, headers);
    served++; rawTotal += size; sentTotal += size;
    if (req.method === 'HEAD') return res.end();
    return createReadStream(file).pipe(res);
  }

  // A precompressed sibling is what a real precompressed deploy serves.
  const sidecar = file + (encoding === 'br' ? '.br' : '.gz');
  const key = `${file}|${encoding}`;
  let body = cache.get(key);
  if (!body) {
    body = existsSync(sidecar) ? readFileSync(sidecar) : encode(readFileSync(file), encoding);
    cache.set(key, body);
  }

  headers['Content-Encoding'] = encoding;
  headers['Content-Length'] = body.length;
  res.writeHead(200, headers);
  served++; rawTotal += size; sentTotal += body.length;
  res.end(req.method === 'HEAD' ? undefined : body);
});

server.listen(PORT, () => {
  console.log(`[serve-prod] ${root.replace(repoRoot + '/', '')}`);
  console.log(`[serve-prod] http://localhost:${PORT}/`);
  console.log(`[serve-prod] compression: ${COMPRESS ? 'brotli q11 → gzip -9 → identity' : 'OFF'}`);
});

// Report the transfer saving on exit — the number that actually matters.
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    if (served) {
      const mb = (n) => (n / 1024 / 1024).toFixed(2) + ' MB';
      const pct = rawTotal ? ((1 - sentTotal / rawTotal) * 100).toFixed(1) : '0';
      console.log(
        `\n[serve-prod] ${served} responses — ${mb(rawTotal)} on disk, ${mb(sentTotal)} over the wire (${pct}% saved)`,
      );
    }
    server.close(() => process.exit(0));
  });
}
