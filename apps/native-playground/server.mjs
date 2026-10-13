import http from 'node:http';
import { readFile, stat, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createNativeRenderer, readRenderRequest, readLocalJSONRequest, validateRenderRequest, RenderError } from './native-render.mjs';
import { createNativeLiveRenderer } from './native-live.mjs';
import { createAndroidLiveRenderer } from './android-live.mjs';
import { getComponentCoverage, isCoverageEvidencePath } from './coverage.mjs';
import { enrichEventDocumentation } from './event-documentation.mjs';
import { getAIInstructions, AIInstructionsError } from './ai-instructions.mjs';

const appRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(appRoot, '../..');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png', '.swift': 'text/plain; charset=utf-8', '.kt': 'text/plain; charset=utf-8', '.ts': 'text/plain; charset=utf-8', '.tsx': 'text/plain; charset=utf-8', '.mts': 'text/plain; charset=utf-8', '.cjs': 'text/plain; charset=utf-8', '.info': 'text/plain; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8' };
const within = (root, file) => file === root || file.startsWith(root + path.sep);

export async function resolveAsset(rawUrl, options = {}) {
  const repo = options.repoRoot || repoRoot;
  const app = options.appRoot || appRoot;
  let pathname;
  try { pathname = decodeURIComponent(rawUrl.split('?')[0]); } catch { return null; }
  if (pathname.includes('\0') || pathname.includes('\\') || pathname.split('/').includes('..')) return null;
  let root, relative;
  if (pathname.startsWith('/native-renders/')) {
    relative = pathname.slice('/native-renders/'.length);
    if (!/^[a-f0-9]{64}\.png$/.test(relative)) return null;
    root = options.renderRoot || path.join(repo, '.cache/native-playground/renders');
  } else if (pathname.startsWith('/web-dist/')) {
    root = options.webDist || process.env.AWC_WEB_DIST || path.join(repo, 'packages/core/dist');
    relative = pathname.slice('/web-dist/'.length);
  } else if (pathname.startsWith('/fonts/')) {
    root = path.join(repo, 'apps/smart-home/public/fonts');
    relative = pathname.slice('/fonts/'.length);
  } else if (pathname.startsWith('/repo/')) {
    relative = pathname.slice('/repo/'.length);
    const allowed = ['packages/native-compiler/generated/', 'packages/native-ios/', 'packages/native-android/'];
    const componentDocumentation = /^(?:apps\/docs\/src\/data\/components\/[a-z][a-z0-9]*(?:-[a-z0-9]+)*\.json|packages\/core\/src\/components\/md-[a-z][a-z0-9]*(?:-[a-z0-9]+)*\/readme\.md)$/.test(relative);
    const coverageEvidence = isCoverageEvidencePath(relative);
    if (relative !== 'packages/core/custom-elements.json' && !componentDocumentation && !coverageEvidence && !allowed.some(prefix => relative.startsWith(prefix))) return null;
    if (!coverageEvidence && !['.json', '.swift', '.kt', '.md'].includes(path.extname(relative))) return null;
    if (!coverageEvidence && relative.split('/').some(part => part.startsWith('.'))) return null;
    root = repo;
  } else {
    root = app;
    relative = pathname === '/' ? 'index.html' : pathname.slice(1);
    if (!['index.html', 'app.js', 'styles.css', 'recipes.js', 'contracts.js', 'documentation.js', 'documentation-ui.js', 'ai-instructions-ui.js', 'brand-icons.js', 'usage-snippets.js', 'syntax-highlighting.js', 'syntax-vendor/highlighter.js', 'syntax-vendor/LICENSES.txt', 'property-controls.js', 'studio.css', 'studio-ui.js', 'canvas-tools.js', 'canvas-tools.css', 'canvas-inspector.js', 'canvas-inspector.css', 'studio-theme.js', 'preview-frame.html', 'native-theme-options.js', 'theme-vendor/awc-theme.js', 'theme-vendor/LICENSES.txt'].includes(relative)) return null;
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

export async function handleCoverageRequest(req, res, { repoRoot: repository = repoRoot, tags, json }) {
  const pathname = (req.url || '/').split('?')[0];
  if (pathname !== '/api/coverage' && !pathname.startsWith('/api/coverage/')) return false;
  if (req.method !== 'GET') { res.writeHead(405, { Allow: 'GET' }); res.end(); return true; }
  const match = /^\/api\/coverage\/(md-[a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(pathname);
  if (!match) { json(res, 404, { error: 'UNKNOWN_COMPONENT', message: 'Choose a known component tag.' }); return true; }
  try {
    if (!(await tags()).has(match[1])) { json(res, 404, { error: 'UNKNOWN_COMPONENT', message: 'Choose a known component tag.' }); return true; }
    json(res, 200, await getComponentCoverage(repository, match[1]));
  } catch {
    json(res, 503, { error: 'COVERAGE_UNAVAILABLE', message: 'Local test evidence is unavailable. No test run was started.' });
  }
  return true;
}

export function assetContentSecurityPolicy(pathname) {
  return `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors '${pathname === '/preview-frame.html' ? 'self' : 'none'}'`;
}

export async function handleAIInstructionsRequest(req, res, { repoRoot: repository = repoRoot, tags, json }) {
  const pathname = (req.url || '/').split('?')[0];
  if (pathname !== '/api/ai-instructions' && !pathname.startsWith('/api/ai-instructions/')) return false;
  if (req.method !== 'GET') { res.writeHead(405, { Allow: 'GET' }); res.end(); return true; }
  const match = /^\/api\/ai-instructions\/(md-[a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(pathname);
  if (!match) { json(res, 404, { error: 'UNKNOWN_COMPONENT', message: 'Choose a known component tag.' }); return true; }
  try {
    if (!(await tags()).has(match[1])) throw new AIInstructionsError(404, 'UNKNOWN_COMPONENT', 'Choose a known component tag.');
    json(res, 200, await getAIInstructions(repository, match[1]));
  } catch (error) {
    json(res, error instanceof AIInstructionsError ? error.status : 503, {
      error: error instanceof AIInstructionsError ? error.code : 'AI_INSTRUCTIONS_UNAVAILABLE',
      message: error instanceof AIInstructionsError ? error.message : 'Local component instructions are unavailable.',
    });
  }
  return true;
}

export async function readAssetContent(file, repository = repoRoot) {
  const content = await readFile(file);
  const relative = path.relative(await realpath(repository), file).split(path.sep).join('/');
  const component = /^apps\/docs\/src\/data\/components\/([a-z][a-z0-9]*(?:-[a-z0-9]+)*)\.json$/.exec(relative);
  if (!component) return content;
  return Buffer.from(JSON.stringify(await enrichEventDocumentation(repository, `md-${component[1]}`, JSON.parse(content.toString('utf8')))));
}

export async function handleNativeLiveRequest(req, res, { renderer, androidRenderer, tags, json }) {
  const pathname = (req.url || '/').split('?')[0];
  if (!pathname.startsWith('/api/native-live/')) return false;
  try {
    const platform = new URL(req.url, 'http://localhost').searchParams.get('platform') || 'ios';
    if (!['ios', 'android'].includes(platform)) throw new RenderError(400, 'INVALID_PLATFORM', 'Choose iOS or Android.');
    if (platform === 'android') renderer = androidRenderer;
    if (!renderer) throw new RenderError(503, 'RENDERER_UNAVAILABLE', 'This native preview renderer is unavailable.');
    if (pathname === '/api/native-live/status' && req.method === 'GET') {
      json(res, 200, await renderer.status());
      return true;
    }
    if (req.method !== 'POST') {
      res.writeHead(405, { Allow: pathname === '/api/native-live/status' ? 'GET' : 'POST' });
      res.end();
      return true;
    }
    const body = await readLocalJSONRequest(req);
    if (pathname === '/api/native-live/session') {
      const result = await renderer.create(validateRenderRequest(body, await tags()));
      if (res.destroyed) await renderer.close(result.sessionId);
      else json(res, 200, result);
      return true;
    }
    const match = /^\/api\/native-live\/([a-f0-9-]{36})\/(input|frame|close|stream)$/.exec(pathname);
    if (!match) throw new RenderError(404, 'UNKNOWN_ENDPOINT', 'Unknown native preview endpoint.');
    const [, sessionId, action] = match;
    if (action === 'stream') {
      streamNativeFrames(res, renderer, sessionId);
    } else if (action === 'close') {
      await renderer.close(sessionId);
      json(res, 200, { closed: true });
    } else {
      json(res, 200, await (action === 'input' ? renderer.input(sessionId, body) : renderer.frame(sessionId)));
    }
  } catch (error) {
    if (res.headersSent) { res.destroy(); return true; }
    json(res, error instanceof RenderError ? error.status : 500, {
      error: error instanceof RenderError ? error.code : 'LIVE_PREVIEW_FAILED',
      message: error instanceof RenderError ? error.message : 'Unable to update the native preview.',
    });
  }
  return true;
}

// Lossless native frames on one connection. A slow reader keeps only the newest
// image, while retaining the bounded event batch between rendered frames.
export function streamNativeFrames(res, renderer, sessionId) {
  if (res.destroyed) return;
  let unsubscribe, stopped = false, blocked = false, latest = null, stallTimer;
  const cleanup = () => {
    if (stopped) return;
    stopped = true; clearTimeout(stallTimer); latest = null; unsubscribe?.();
  };
  const write = frame => {
    if (stopped || res.destroyed) return;
    if (!res.headersSent) {
      res.writeHead(200, { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'X-Accel-Buffering': 'no' });
      res.flushHeaders?.();
    }
    blocked = !res.write(`${JSON.stringify(frame)}\n`);
    if (blocked) { clearTimeout(stallTimer); stallTimer = setTimeout(() => { cleanup(); res.destroy(); }, 15000); stallTimer.unref?.(); }
  };
  res.on('close', cleanup);
  res.on('drain', () => {
    blocked = false; clearTimeout(stallTimer);
    if (latest) { const next = latest; latest = null; write(next); }
  });
  try {
    unsubscribe = renderer.subscribe(sessionId, frame => {
      if (stopped) return;
      if (!blocked) { write(frame); return; }
      const events = [...(latest?.events || []), ...frame.events];
      if (events.length > 256) { cleanup(); res.destroy(); return; }
      latest = { ...frame, events };
    }, error => {
      if (stopped) return;
      if (!blocked) write({ error: error.code || 'STREAM_FAILED', message: error.message || 'Native frame stream disconnected.' });
      cleanup(); res.end();
    });
    if (stopped) unsubscribe();
  } catch (error) { cleanup(); throw error; }
}

export function createServer(options = {}) {
  const renderer = options.renderer || createNativeRenderer({repoRoot:options.repoRoot||repoRoot,renderRoot:options.renderRoot,executable:options.nativeExecutable});
  const liveRenderer = options.liveRenderer || createNativeLiveRenderer({repoRoot:options.repoRoot||repoRoot,executable:options.nativeLiveExecutable});
  const androidRenderer = options.androidRenderer || createAndroidLiveRenderer(options.androidOptions);
  let tagPromise;
  const tags = () => tagPromise ||= readFile(path.join(options.repoRoot||repoRoot,'packages/core/custom-elements.json'),'utf8')
    .then(JSON.parse).then(manifest=>new Set(manifest.modules.flatMap(m=>m.declarations||[]).map(c=>c.tagName).filter(Boolean)));
  const json = (res,status,value) => {res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));};
  const server = http.createServer(async (req, res) => {
    const pathname=(req.url||'/').split('?')[0];
    if (await handleAIInstructionsRequest(req, res, { repoRoot: options.repoRoot || repoRoot, tags, json })) return;
    if (await handleCoverageRequest(req, res, { repoRoot: options.repoRoot || repoRoot, tags, json })) return;
    if (await handleNativeLiveRequest(req, res, { renderer: liveRenderer, androidRenderer, tags, json })) return;
    if(pathname==='/api/native-render/status' && req.method==='GET'){
      try{json(res,200,await renderer.status());}catch{json(res,503,{available:false,platform:'macos',renderer:'SwiftUI',message:'Native renderer is unavailable.'});}return;
    }
    if(pathname==='/api/native-render'){
      if(req.method!=='POST'){res.writeHead(405,{Allow:'POST'});res.end();return;}
      try{const request=await readRenderRequest(req,await tags());json(res,200,await renderer.render(request));}
      catch(error){json(res,error instanceof RenderError?error.status:500,{error:error.code||'RENDER_FAILED',message:error instanceof RenderError?error.message:'Unable to prepare native preview.'});}return;
    }
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, { Allow: 'GET, HEAD' }); res.end(); return; }
    const file = await resolveAsset(req.url || '/', {...options,renderRoot:renderer.directory});
    if (!file) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('Not found'); return; }
    try {
      const content = await readAssetContent(file, options.repoRoot || repoRoot);
      res.writeHead(200, {
        'Content-Type': mime[path.extname(file)] || 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
        'Content-Security-Policy': assetContentSecurityPolicy(pathname),
      });
      res.end(req.method === 'HEAD' ? undefined : content);
    } catch { res.writeHead(500); res.end('Unable to read asset'); }
  });
  server.disposeNative = () => Promise.allSettled([liveRenderer.dispose(), androidRenderer.dispose()]);
  server.once('close', () => { void server.disposeNative(); });
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 4177);
  const server = createServer();
  server.listen(port, '127.0.0.1', () => process.stdout.write(`AWC Native Compiler Lab: http://127.0.0.1:${port}\nWeb reference, live SwiftUI and Android Compose previews.\n`));
  server.on('error', error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => {
    await server.disposeNative();
    server.close(() => process.exit(0));
    server.closeAllConnections();
  });
}
