#!/usr/bin/env node
/** Consumer installs happen outside the monorepo; no workspace links can mask packaging errors. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { cp, mkdtemp, mkdir, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log(`Usage: node scripts/verify-starters.mjs [--source=packed|registry] [--starter=next,nuxt,sveltekit,astro,html] [--offline] [--cache=PATH] [--skip-browser] [--keep]

Default: packed candidates, all starters, Chromium verification.
Build core + React first. Packed mode runs pnpm pack with lifecycle scripts disabled;
registry mode uses each starter's declared package ranges unchanged. HTML always
installs its package manifest but checks published CDN URLs, with no build step.
Install/build work and npm's cache use a fresh OS temporary directory.
--cache=PATH reuses an explicit cache; --offline requires cached registry packages.
An explicit npm_config_cache environment variable is also respected. --skip-browser validates install/build/server HTML only and reports
the browser checks as skipped. --keep retains the temporary directory for inspection.
PUPPETEER_EXECUTABLE_PATH may select an existing Chrome; its profile stays temporary.`);
  process.exit(0);
}
const allowed = /^(--source=(packed|registry)|--starter=[a-z,]+|--offline|--cache=.+|--skip-browser|--keep)$/;
for (const arg of args) if (!allowed.test(arg)) throw new Error(`Unknown argument: ${arg}`);
const source = args.find((arg) => arg.startsWith('--source='))?.slice(9) ?? 'packed';
const names = args.find((arg) => arg.startsWith('--starter='))?.slice(10).split(',') ?? ['next', 'nuxt', 'sveltekit', 'astro', 'html'];
for (const name of names) assert(['next', 'nuxt', 'sveltekit', 'astro', 'html'].includes(name), `Unknown starter: ${name}`);
const scratch = await mkdtemp(join(tmpdir(), 'awc-starters-'));
const cache = resolve(args.find((arg) => arg.startsWith('--cache='))?.slice(8) ?? process.env.npm_config_cache ?? join(scratch, 'npm-cache'));
const excluded = new Set(['node_modules', '.next', '.nuxt', '.output', '.svelte-kit', '.astro', 'build', 'dist', '.git']);
const environments = { ...process.env, npm_config_cache: cache, XDG_CACHE_HOME: join(scratch, 'cache'), NEXT_TELEMETRY_DISABLED: '1', NUXT_TELEMETRY_DISABLED: '1', ASTRO_TELEMETRY_DISABLED: '1' };
let browser;

async function run(command, argv, cwd, extraEnv = {}) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, argv, { cwd, env: { ...environments, ...extraEnv }, stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', (code, signal) => code === 0 ? resolve() : reject(new Error(`${command} ${argv.join(' ')} failed (${signal ?? code})`)));
  });
}

async function candidates() {
  if (source !== 'packed') return new Map();
  const directory = join(scratch, 'packages');
  await mkdir(directory);
  const result = new Map();
  for (const name of ['core', 'tokens', ...(names.includes('next') ? ['react'] : [])]) {
    const cwd = join(root, 'packages', name);
    // pnpm translates workspace peer ranges, unlike npm pack. Prepack must not
    // rebuild or regenerate source: this command verifies the already-built candidate.
    await run('pnpm', ['--config.ignore-scripts=true', 'pack', '--pack-destination', directory], cwd);
    const manifest = JSON.parse(await readFile(join(cwd, 'package.json'), 'utf8'));
    const filename = `${manifest.name.replace('@', '').replace('/', '-')}-${manifest.version}.tgz`;
    assert((await readdir(directory)).includes(filename), `Missing packed candidate ${filename}`);
    result.set(manifest.name, `file:${join(directory, filename)}`);
  }
  return result;
}

async function listen(server, port) {
  await new Promise((resolve, reject) => {
    const failed = (error) => reject(error);
    server.once('error', failed);
    server.listen(port, '127.0.0.1', () => {
      server.off('error', failed);
      resolve();
    });
  });
}

async function start(name, cwd) {
  // Ask the OS for an available port, then hand it to the framework server.
  const reservation = createServer();
  await listen(reservation, 0);
  const port = reservation.address().port;
  await new Promise((resolve) => reservation.close(resolve));
  const url = `http://127.0.0.1:${port}/`;
  if (name === 'html') {
    const html = await readFile(join(cwd, 'index.html'));
    const server = createServer((_request, response) => {
      response.setHeader('content-type', 'text/html');
      response.end(html);
    });
    await listen(server, port);
    return { url, stop: () => new Promise((resolve) => server.close(resolve)) };
  }
  let command = 'npm';
  let argv = ['run', 'preview', '--', '--host', '127.0.0.1', '--port', String(port)];
  if (name === 'next') argv = ['start', '--', '--hostname', '127.0.0.1', '--port', String(port)];
  if (name === 'sveltekit') argv.push('--strictPort');
  if (name === 'astro') {
    // Astro 7's CLI detaches in agent environments. The public API keeps this
    // verifier's server in its child process so readiness and cleanup are owned here.
    command = process.execPath;
    argv = ['--input-type=module', '--eval', `
      import { preview } from 'astro';
      const server = await preview({ server: { host: '127.0.0.1', port: ${port} }, vite: { preview: { strictPort: true } } });
      for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, async () => {
        await server.stop();
        process.exit(0);
      });
    `];
  }
  if (name === 'nuxt') {
    command = process.execPath;
    argv = ['.output/server/index.mjs'];
  }
  const child = spawn(command, argv, {
    cwd, env: { ...environments, HOST: '127.0.0.1', PORT: String(port), NITRO_HOST: '127.0.0.1', NITRO_PORT: String(port) },
    stdio: 'inherit', detached: process.platform !== 'win32',
  });
  let startupError;
  child.once('error', (error) => { startupError = error; });
  const stop = async () => {
    if (child.exitCode !== null || !child.pid) return;
    try { process.platform === 'win32' ? child.kill('SIGTERM') : process.kill(-child.pid, 'SIGTERM'); } catch {}
    await new Promise((resolve) => {
      const timer = setTimeout(() => {
        try { process.platform === 'win32' ? child.kill('SIGKILL') : process.kill(-child.pid, 'SIGKILL'); } catch {}
        resolve();
      }, 5000);
      child.once('exit', () => { clearTimeout(timer); resolve(); });
    });
  };
  try {
    const deadline = Date.now() + 90_000;
    while (Date.now() < deadline) {
      if (startupError) throw startupError;
      if (child.exitCode !== null) throw new Error(`${name} server exited ${child.exitCode}`);
      try { if ((await fetch(url, { signal: AbortSignal.timeout(2000) })).ok) return { url, stop }; } catch {}
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error(`${name} server did not become ready`);
  } catch (error) { await stop(); throw error; }
}

async function inspectBrowser(url) {
  const page = await browser.newPage();
  const failures = [];
  page.on('pageerror', (error) => failures.push(error.message));
  page.on('requestfailed', (request) => {
    if (request.resourceType() === 'script') failures.push(`${request.failure()?.errorText} ${request.url()}`);
  });
  page.on('response', (response) => {
    if (response.request().resourceType() === 'script' && response.status() >= 400) failures.push(`${response.status()} ${response.url()}`);
  });
  try {
    await page.goto(url, { waitUntil: 'networkidle0' });
    await page.waitForFunction(() => {
      const visit = (root) => [...root.querySelectorAll('*')].every((element) => {
        if (element.tagName.startsWith('MD-') && (!customElements.get(element.localName) || !element.shadowRoot)) return false;
        return !element.shadowRoot || (element.shadowRoot.querySelectorAll('[c-id]').length === 0 && visit(element.shadowRoot));
      });
      const chart = document.querySelector('md-line-chart');
      return visit(document) && chart?.series?.[0]?.data?.length === 8 && !!chart.shadowRoot?.querySelector('canvas');
    }, { timeout: 30_000 });
    const before = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    await page.click('md-switch');
    await page.waitForFunction((value) => document.documentElement.getAttribute('data-theme') !== value, {}, before);
    assert.deepEqual(failures, [], 'starter reported browser errors');
  } catch (error) {
    const state = await page.evaluate(() => ({
      unresolved: [...document.querySelectorAll('*')]
        .filter(element => element.tagName.startsWith('MD-') && !element.shadowRoot)
        .map(element => element.localName),
      points: document.querySelector('md-line-chart')?.series?.[0]?.data?.length ?? 0,
      canvas: !!document.querySelector('md-line-chart')?.shadowRoot?.querySelector('canvas'),
    })).catch(() => null);
    console.error('[verify-starters] Browser initialization failed:', { url, failures, state });
    throw error;
  } finally { await page.close(); }
}

try {
  console.log(`[verify-starters] ${source}; isolated directory ${scratch}`);
  const packed = await candidates();
  if (!args.includes('--skip-browser')) {
    const puppeteer = createRequire(join(root, 'package.json'))('puppeteer');
    browser = await puppeteer.launch({ headless: true, userDataDir: join(scratch, 'browser-profile'), args: ['--no-sandbox'] });
  }
  for (const name of names) {
    console.log(`[verify-starters] ${name}${name === 'html' ? ' (published CDN URLs)' : ''}`);
    const cwd = join(scratch, name);
    await cp(join(root, 'starters', name), cwd, { recursive: true, filter: (path) => !excluded.has(path.split(/[\\/]/).at(-1)) });
    {
      const manifestPath = join(cwd, 'package.json');
      const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
      for (const section of ['dependencies', 'devDependencies']) {
        for (const dependency of Object.keys(manifest[section] ?? {})) {
          if (packed.has(dependency)) manifest[section][dependency] = packed.get(dependency);
        }
      }
      await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
      await run('npm', ['install', '--no-audit', '--no-fund', ...(args.includes('--offline') ? ['--offline'] : [])], cwd);
      const resolved = createRequire(manifestPath).resolve('@awc-ui/core/hydrate');
      assert((await realpath(resolved)).startsWith(`${await realpath(cwd)}/node_modules/`), 'core must resolve from the isolated consumer install');
      if (name !== 'html') await run('npm', ['run', 'build'], cwd);
    }
    const server = await start(name, cwd);
    try {
      const response = await fetch(server.url);
      assert(response.ok, `HTTP ${response.status}`);
      const html = await response.text();
      assert.match(html, /Revenue/, 'initial document must contain meaningful dashboard content');
      if (name !== 'html') assert.match(html, /<template\b[^>]*shadowrootmode=["']open["']/, 'server must emit DSD');
      if (browser) await inspectBrowser(server.url);
      console.log(`[verify-starters] PASS ${name}: install${name === 'html' ? ', CDN document' : '/build, server DSD'}${browser ? ', browser upgrade/adoption, chart and switch' : '; browser checks SKIPPED'}`);
    } finally { await server.stop(); }
  }
} finally {
  try {
    if (browser) await browser.close();
  } finally {
    if (args.includes('--keep')) console.log(`[verify-starters] retained ${scratch}`);
    else await rm(scratch, { recursive: true, force: true });
  }
}
