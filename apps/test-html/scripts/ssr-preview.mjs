import { readFile, realpath } from 'node:fs/promises';
import { createServer } from 'node:http';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { gzip } from 'node:zlib';
import { renderToString } from '@awc-ui/core/hydrate';

const host = '127.0.0.1';
const defaultDist = fileURLToPath(new URL('../dist/', import.meta.url));
const compress = promisify(gzip);
const assetPath = /^\/(?:assets|awc-esm)(?:\/[a-z\d_-][a-z\d_.-]*)+$/i;
const mimeTypes = new Map([
  ['js', 'text/javascript; charset=utf-8'],
  ['mjs', 'text/javascript; charset=utf-8'],
  ['css', 'text/css; charset=utf-8'],
  ['json', 'application/json; charset=utf-8'],
  ['map', 'application/json; charset=utf-8'],
  ['svg', 'image/svg+xml'],
  ['png', 'image/png'],
  ['woff', 'font/woff'],
  ['woff2', 'font/woff2'],
]);

function prepareHtml(index, renderedAt, serverOnly) {
  const heading = 'AWC UI — Vanilla HTML SSR Playground';
  const mode = serverOnly
    ? 'Server-rendered · JavaScript disabled for this preview'
    : 'Server-rendered · Interactive';
  const alternate = serverOnly
    ? '<a href="/">Interactive SSR</a>'
    : '<a href="/?client=off">Server-only view</a>';
  const previewBar = `<nav aria-label="Preview options"
    style="display:flex;flex-wrap:wrap;gap:4px 16px;align-items:baseline;margin-block-end:16px;font:14px/1.5 system-ui">
    <strong>${mode}</strong>
    <span>Rendered <time datetime="${renderedAt}">${renderedAt}</time></span>
    ${alternate}
    <a href="http://127.0.0.1:5176/">Client-rendered catalog</a>
  </nav>`;
  return index
    .replace(/<title>[^<]*<\/title>/i, `<title>${heading}</title>`)
    .replace(/<h1>[^<]*<\/h1>/i, `${previewBar}\n      <h1>${heading}</h1>`);
}

function acceptsGzip(header = '') {
  const encodings = new Map(header.split(',').map((entry) => {
    const [encoding, ...parameters] = entry.trim().toLowerCase().split(';');
    const quality = parameters.map((parameter) => parameter.trim()).find((parameter) => parameter.startsWith('q='));
    return [encoding.trim(), quality ? Number(quality.slice(2)) : 1];
  }));
  return (encodings.get('gzip') ?? encodings.get('*') ?? 0) > 0;
}

function send(request, response, status, body, headers = {}) {
  if (response.destroyed) return;
  response.writeHead(status, {
    'Cache-Control': 'no-store',
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'X-Content-Type-Options': 'nosniff',
    ...headers,
  });
  response.end(request.method === 'HEAD' ? undefined : body);
}

async function readAsset(distDirectory, path) {
  try {
    const directory = await realpath(distDirectory);
    const file = await realpath(resolve(directory, `.${path}`));
    const fromDist = relative(directory, file);
    if (isAbsolute(fromDist) || fromDist === '..' || fromDist.startsWith(`..${sep}`)) return null;
    return await readFile(file);
  } catch (error) {
    if (['ENOENT', 'EISDIR', 'ENOTDIR'].includes(error.code)) return null;
    throw error;
  }
}

export function createPreviewServer({ distDirectory = defaultDist } = {}) {
  return createServer(async (request, response) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      send(request, response, 405, 'Method not allowed.\n', { Allow: 'GET, HEAD' });
      return;
    }

    // Check the original request path so URL normalization cannot turn a
    // traversal attempt into a valid asset or page route.
    const [path, query] = (request.url ?? '').split('?', 2);
    const page = path === '/' || path === '/index.html';
    try {
      if (!page) {
        const contentType = mimeTypes.get(path.slice(path.lastIndexOf('.') + 1));
        const asset = contentType && assetPath.test(path) ? await readAsset(distDirectory, path) : null;
        if (asset === null) {
          send(request, response, 404, 'Not found.\n');
          return;
        }
        send(request, response, 200, asset, { 'Content-Type': contentType });
        return;
      }

      const renderedAt = new Date().toISOString();
      const index = await readFile(resolve(distDirectory, 'index.html'), 'utf8');
      if (response.destroyed) return;
      const serverOnly = new URLSearchParams(query).get('client') === 'off';
      const result = await renderToString(prepareHtml(index, renderedAt, serverOnly), {
        fullDocument: true,
        serializeShadowRoot: 'declarative-shadow-dom',
        clientHydrateAnnotations: true,
        removeScripts: serverOnly,
        removeHtmlComments: false,
        removeUnusedStyles: false,
        url: new URL(request.url, `http://${host}:${request.socket.localPort}`).href,
      });
      const errors = result.diagnostics.filter(({ level }) => level === 'error');
      if (errors.length) throw new Error(errors.map(({ messageText }) => messageText).join('\n'));
      if (!result.html) throw new Error('The hydrate renderer returned no HTML.');
      if (response.destroyed) return;

      const headers = { 'Content-Type': 'text/html; charset=utf-8', Vary: 'Accept-Encoding' };
      let body = result.html;
      if (acceptsGzip(request.headers['accept-encoding'])) {
        body = await compress(body);
        headers['Content-Encoding'] = 'gzip';
      }
      send(request, response, 200, body, headers);
    } catch (error) {
      if (response.destroyed) return;
      console.error(error);
      if (response.headersSent) {
        response.destroy();
        return;
      }
      const message = page && error.code === 'ENOENT'
        ? 'Build the HTML playground with pnpm --filter @awc-ui/test-html build.\n'
        : 'Preview request failed. Check the server output for details.\n';
      send(request, response, 500, message);
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const port = Number(process.argv[2] ?? 5177);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    console.error('Supply a port number from 1 to 65535.');
    process.exitCode = 1;
  } else {
    const server = createPreviewServer();
    server.once('error', (error) => {
      console.error(`Could not start the SSR preview on http://${host}:${port}/: ${error.message}`);
      process.exitCode = 1;
    });
    server.listen(port, host, () => console.log(`AWC UI SSR preview at http://${host}:${port}/`));
  }
}
