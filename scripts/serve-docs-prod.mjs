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
import { createReadStream, existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, resolve } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = resolve(repoRoot, 'apps/docs/dist');

const argv = process.argv.slice(2);
const portArg = argv.indexOf('--port');
const PORT = portArg > -1 ? Number(argv[portArg + 1]) : 4323;
const COMPRESS = !argv.includes('--no-compress');


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

/** Index only regular build files. Request text is never used to form a disk path.
 * Symlinks (including compressed siblings and directory links) are not served.
 */
export function indexFiles(directory) {
  const files = new Map();
  function visit(current, prefix) {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const file = join(current, entry.name);
      const url = `${prefix}/${entry.name}`;
      if (entry.isDirectory()) visit(file, url);
      else if (entry.isFile()) files.set(url, file);
    }
  }
  visit(directory, '');
  return files;
}

export function resolveFile(files, urlPath) {
  let clean;
  try {
    clean = decodeURIComponent(urlPath.split('?')[0].split('#')[0]);
  } catch {
    return null;
  }
  if (!clean.startsWith('/') || clean.includes('\\') || clean.includes('\0')
    || clean.split('/').some(part => part === '.' || part === '..')) return null;
  const indexPath = clean.endsWith('/') ? `${clean}index.html` : `${clean}/index.html`;
  return files.get(clean) ?? files.get(indexPath) ?? files.get(`${clean}.html`) ?? null;
}

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
function negotiate(header = '', compress = true) {
  const accept = header.toLowerCase();
  if (!compress) return null;
  if (/\bbr\b/.test(accept)) return 'br';
  if (/\bgzip\b/.test(accept)) return 'gzip';
  return null;
}

function cacheControl(file) {
  // Content-hashed assets (Astro's _astro/, Stencil's chunk hashes) can be
  // pinned; HTML has to revalidate or a deploy never reaches anyone.
  if (extname(file) === '.html') return 'public, max-age=0, must-revalidate';
  if (/[.-][A-Za-z0-9_-]{8,}\.(js|css|woff2?)$/.test(file)) return 'public, max-age=31536000, immutable';
  return 'public, max-age=3600';
}

export function createDocsServer({ directory = root, compress = COMPRESS } = {}) {
  const files = indexFiles(directory);
  const compressedFiles = new Map();
  for (const [url, file] of files) {
    compressedFiles.set(file, { br: files.get(`${url}.br`), gzip: files.get(`${url}.gz`) });
  }
  const cache = new Map();
  let served = 0;
  let rawTotal = 0;
  let sentTotal = 0;
  const server = createServer((req, res) => {
    const file = resolveFile(files, req.url || '/');

    if (!file) {
      const notFound = files.get('/404.html');
      const body = notFound ? readFileSync(notFound) : Buffer.from('404');
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': body.length });
      return res.end(req.method === 'HEAD' ? undefined : body);
    }

    const ext = extname(file);
    const type = MIME[ext] || 'application/octet-stream';
    const size = statSync(file).size;
    const headers = { 'Content-Type': type, 'Cache-Control': cacheControl(file), Vary: 'Accept-Encoding' };

    let encoding = COMPRESSIBLE.has(ext) && size >= MIN_COMPRESS_BYTES ? negotiate(req.headers['accept-encoding'], compress) : null;

    // No encoding wanted (or not worth it): stream it straight through.
    if (!encoding) {
      headers['Content-Length'] = size;
      res.writeHead(200, headers);
      served++; rawTotal += size; sentTotal += size;
      if (req.method === 'HEAD') return res.end();
      return createReadStream(file).pipe(res);
    }

    // A precompressed sibling is what a real precompressed deploy serves.
    const sidecar = compressedFiles.get(file)?.[encoding];
    const key = `${file}|${encoding}`;
    let body = cache.get(key);
    if (!body) {
      body = sidecar ? readFileSync(sidecar) : encode(readFileSync(file), encoding);
      cache.set(key, body);
    }

    headers['Content-Encoding'] = encoding;
    headers['Content-Length'] = body.length;
    res.writeHead(200, headers);
    served++; rawTotal += size; sentTotal += body.length;
    res.end(req.method === 'HEAD' ? undefined : body);
  });

  return { server, stats: () => ({ served, rawTotal, sentTotal }) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (!existsSync(root)) {
    console.error(`[serve-prod] ${root} does not exist — build first: pnpm build`);
    process.exit(1);
  }
  const { server, stats } = createDocsServer();
  server.listen(PORT, () => {
    console.log(`[serve-prod] ${root.replace(repoRoot + '/', '')}`);
    console.log(`[serve-prod] http://localhost:${PORT}/`);
    console.log(`[serve-prod] compression: ${COMPRESS ? 'brotli q11 → gzip -9 → identity' : 'OFF'}`);
  });
  for (const sig of ['SIGINT', 'SIGTERM']) {
    process.on(sig, () => {
      const { served, rawTotal, sentTotal } = stats();
      if (served) {
        const mb = (n) => (n / 1024 / 1024).toFixed(2) + ' MB';
        const pct = rawTotal ? ((1 - sentTotal / rawTotal) * 100).toFixed(1) : '0';
        console.log(`\n[serve-prod] ${served} responses — ${mb(rawTotal)} on disk, ${mb(sentTotal)} over the wire (${pct}% saved)`);
      }
      server.close(() => process.exit(0));
    });
  }
}
