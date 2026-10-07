import http from 'node:http';
import { readFile, stat, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(appRoot, '../..');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png', '.swift': 'text/plain; charset=utf-8', '.kt': 'text/plain; charset=utf-8', '.tsx': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8' };
const within = (root, file) => file === root || file.startsWith(root + path.sep);

export async function resolveAsset(rawUrl, options = {}) {
  const repo = options.repoRoot || repoRoot;
  const app = options.appRoot || appRoot;
  let pathname;
  try { pathname = decodeURIComponent(rawUrl.split('?')[0]); } catch { return null; }
  if (pathname.includes('\0') || pathname.includes('\\') || pathname.split('/').includes('..')) return null;
  let root, relative;
  if (pathname.startsWith('/web-dist/')) {
    root = options.webDist || process.env.AWC_WEB_DIST || path.join(repo, 'packages/core/dist');
    relative = pathname.slice('/web-dist/'.length);
  } else if (pathname.startsWith('/fonts/')) {
    root = path.join(repo, 'apps/smart-home/public/fonts');
    relative = pathname.slice('/fonts/'.length);
  } else if (pathname.startsWith('/repo/')) {
    relative = pathname.slice('/repo/'.length);
    const allowed = ['packages/native-compiler/generated/', 'packages/native-ios/', 'packages/native-android/'];
    if (relative !== 'packages/core/custom-elements.json' && !allowed.some(prefix => relative.startsWith(prefix))) return null;
    if (!['.json', '.swift', '.kt', '.md'].includes(path.extname(relative))) return null;
    if (relative.split('/').some(part => part.startsWith('.'))) return null;
    root = repo;
  } else {
    root = app;
    relative = pathname === '/' ? 'index.html' : pathname.slice(1);
    if (!['index.html', 'app.js', 'styles.css', 'recipes.js', 'contracts.js'].includes(relative)) return null;
  }
  const absolute = path.resolve(root, relative);
  if (!within(path.resolve(root), absolute)) return null;
  try {
    const [realRoot, realFile] = await Promise.all([realpath(root), realpath(absolute)]);
    if (!within(realRoot, realFile)) return null;
    if (!(await stat(realFile)).isFile()) return null;
    return realFile;
  } catch { return null; }
}

export function createServer(options = {}) {
  return http.createServer(async (req, res) => {
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, { Allow: 'GET, HEAD' }); res.end(); return; }
    const file = await resolveAsset(req.url || '/', options);
    if (!file) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('Not found'); return; }
    try {
      const content = await readFile(file);
      res.writeHead(200, {
        'Content-Type': mime[path.extname(file)] || 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
        'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'",
      });
      res.end(req.method === 'HEAD' ? undefined : content);
    } catch { res.writeHead(500); res.end('Unable to read asset'); }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 4177);
  const server = createServer();
  server.listen(port, '127.0.0.1', () => process.stdout.write(`AWC Native Compiler Lab: http://127.0.0.1:${port}\nWeb reference only. Run the native playgrounds to inspect native UI.\n`));
  server.on('error', error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
