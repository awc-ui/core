#!/usr/bin/env node
import { watch } from 'node:fs';
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkEnvironment } from './check-environment.mjs';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function classifyChange(path) {
  const normalized = path.replaceAll('\\', '/');
  if (/^packages\/core\/src\/.*\.(tsx?|css|md)$/.test(normalized)) return 'core';
  if (/^packages\/theme\/src\/.*\.ts$/.test(normalized)) return 'theme';
  if (/^apps\/storybook\/src\/stories\/.*\.stories\.ts$/.test(normalized)) return 'docs';
  if (/^scripts\/(generate-docs|generate-custom-elements-manifest|build-package-docs)\.mjs$/.test(normalized)) return 'core';
  return null;
}

async function main() {
  checkEnvironment();
  const children = new Set();
  const watchers = [];
  let stopping = false;
  let timer;
  const run = (command, args) => new Promise((resolveRun, reject) => {
    const child = spawn(command, args, { cwd: repo, stdio: 'inherit', detached: process.platform !== 'win32' });
    children.add(child);
    child.once('error', error => { children.delete(child); reject(error); });
    child.once('exit', (code, signal) => {
      children.delete(child);
      if (code === 0 || stopping) resolveRun();
      else reject(new Error(`${command} ${args.join(' ')} failed (${signal ?? code}).`));
    });
  });
  const shutdown = () => {
    stopping = true;
    clearTimeout(timer);
    watchers.forEach(watcher => watcher.close());
    children.forEach(child => {
      try {
        if (process.platform !== 'win32') process.kill(-child.pid, 'SIGTERM');
        else child.kill('SIGTERM');
      } catch (error) {
        if (error.code !== 'ESRCH') console.error(`[docs] Unable to stop child: ${error.message}`);
      }
    });
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  const pending = new Set(['core', 'theme', 'docs']);
  let building = false;
  async function rebuild() {
    if (building || stopping) return;
    building = true;
    const changes = new Set(pending);
    pending.clear();
    try {
      if (changes.has('theme')) await run('pnpm', ['--filter', '@awc-ui/theme', 'build']);
      if (!stopping && changes.has('core')) {
        await run('pnpm', ['--filter', '@awc-ui/core', 'build']);
        if (!stopping) await run('pnpm', ['--filter', '@awc-ui/react', 'build']);
        if (!stopping) await run(process.execPath, ['scripts/sync-docs-runtime.mjs']);
      }
      if (!stopping && (changes.has('core') || changes.has('docs'))) {
        await run('pnpm', ['generate:docs']);
      }
    } finally {
      building = false;
      if (pending.size && !stopping) schedule();
    }
  }
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(() => rebuild().catch(error => console.error(`[docs] ${error.message} Fix the source and save to retry.`)), 250);
  }
  try {
    for (const directory of ['packages/core/src', 'packages/theme/src', 'apps/storybook/src/stories', 'scripts']) {
      watchers.push(watch(resolve(repo, directory), { recursive: true }, (_event, filename) => {
        if (!filename) return;
        const kind = classifyChange(`${directory}/${filename}`);
        if (kind) { pending.add(kind); schedule(); }
      }));
    }
    await rebuild();
    if (!stopping) {
      console.log('[docs] Watching core, theme and documentation sources. Stop other core watchers while this preview runs.');
      await run('pnpm', ['--filter', '@awc-ui/docs', 'exec', 'astro', 'dev', ...process.argv.slice(2)]);
    }
  } finally {
    shutdown();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(`[docs] ${error.message}`); process.exitCode = 1; });
}
