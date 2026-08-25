#!/usr/bin/env node
/**
 * Prove the SSR showcase builds render ON THE SERVER, PER REQUEST.
 *
 * The showcase claims a capability, and a claim in a table is worth nothing.
 * Worse, the obvious test proves the wrong thing: fetching a page and finding
 * the markup there shows only that SOMETHING rendered it — a build-time
 * prerender satisfies that just as well as a live server, because the HTML is
 * then simply a file on disk. Every one of these builds used to be
 * prerendered, and every one of them would have passed that test.
 *
 * So each app is asked two independent questions:
 *
 *   1. RENDERED WITHOUT A BROWSER. The request is made with fetch, which runs
 *      no JavaScript. If the response body already contains
 *      `<template shadowrootmode="open">`, the components were rendered by the
 *      server — a client-rendered SPA returns an empty shell here.
 *
 *   2. RENDERED FOR THIS REQUEST. Two requests are made and compared. A
 *      prerendered route returns byte-identical HTML; a live render differs,
 *      because the app stamps a per-request marker into the document. Without
 *      a marker there is nothing to compare, so an app that does not emit one
 *      FAILS rather than being given the benefit of the doubt — the whole
 *      point is to distinguish these two cases, and silence is not evidence.
 *
 * Each app must therefore render, somewhere in its document:
 *
 *     <meta name="awc-render-mode" content="ssr">
 *     <meta name="awc-rendered-at" content="<ISO timestamp stamped while rendering>">
 *
 * Usage:
 *   node scripts/verify-ssr.mjs            # every registered app
 *   node scripts/verify-ssr.mjs next nuxt  # only these
 *
 * Each app is built, started on its own port, probed, and stopped. Nothing is
 * left running, including when a probe throws.
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SSR_APPS } from './lib/ssr-apps.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * The SSR builds — every one the registry marks `server: true`, whichever
 * vertical it belongs to, rather than a list typed out here. This script used to
 * carry its own copy of that list, identical to the one in `lib/ssr-apps.mjs`
 * down to the ports, which is the arrangement that put three different framework
 * lists out of step with each other in the first place.
 *
 * Today that resolves to credit-risk's four and nothing else, because a new
 * vertical ships static builds only. Should one ever add a server build, it is
 * checked here from the moment it is registered.
 */
const APPS = SSR_APPS;

const wanted = process.argv.slice(2);
const apps = wanted.length ? APPS.filter((a) => wanted.includes(a.id)) : APPS;
if (!apps.length) {
  console.error(`[verify-ssr] no such app. known: ${APPS.map((a) => a.id).join(', ')}`);
  process.exit(1);
}

const DSD = 'shadowrootmode';
const META = /<meta[^>]+name="awc-rendered-at"[^>]+content="([^"]+)"/i;
const MODE = /<meta[^>]+name="awc-render-mode"[^>]+content="([^"]+)"/i;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForServer(url, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {
      /* not up yet */
    }
    await sleep(500);
  }
  return false;
}

async function probe(app) {
  const url = `http://localhost:${app.port}/`;
  const first = await fetch(url).then((r) => r.text());
  // A second later, so a per-request timestamp is unambiguously different
  // rather than differing only in sub-millisecond noise.
  await sleep(1100);
  const second = await fetch(url).then((r) => r.text());

  const failures = [];

  // 1. server-rendered at all
  const dsdCount = (first.match(new RegExp(DSD, 'g')) ?? []).length;
  if (dsdCount === 0) {
    failures.push(
      'no declarative shadow DOM in the response — fetch runs no JavaScript, so the ' +
        'components were not rendered by the server',
    );
  }

  // 2. rendered for THIS request
  const a = first.match(META)?.[1];
  const b = second.match(META)?.[1];
  if (!a || !b) {
    failures.push(
      'no <meta name="awc-rendered-at"> in the response — without a per-request marker ' +
        'a live render cannot be told apart from a prerendered file',
    );
  } else if (a === b) {
    failures.push(
      `identical render marker across two requests (${a}) — this is a cached or ` +
        'prerendered document, not a per-request render',
    );
  }

  const mode = first.match(MODE)?.[1];
  if (mode && mode !== 'ssr') failures.push(`render mode reports "${mode}", expected "ssr"`);

  return { dsdCount, first: a, second: b, failures };
}

let failed = 0;

for (const app of apps) {
  const cwd = join(root, app.dir);
  console.log(`\n==> ${app.id}`);

  if (!existsSync(cwd)) {
    console.error(`    SKIP — ${app.dir} does not exist yet`);
    continue;
  }

  /* The package name comes off the app rather than being rebuilt from its id,
     so the vertical is whatever the registry says it is. */
  const build = spawnSync('pnpm', ['--filter', app.pkg, 'build'], {
    cwd: root,
    stdio: 'inherit',
    shell: false,
  });
  if (build.status !== 0) {
    console.error(`    FAIL — build failed`);
    failed++;
    continue;
  }

  const server = spawn('pnpm', app.start, { cwd, stdio: 'ignore', shell: false, detached: true });
  const stop = () => {
    try {
      process.kill(-server.pid, 'SIGTERM');
    } catch {
      /* already gone */
    }
  };

  try {
    const up = await waitForServer(`http://localhost:${app.port}/`);
    if (!up) {
      console.error(`    FAIL — server did not answer on :${app.port}`);
      failed++;
      continue;
    }

    const { dsdCount, first, second, failures } = await probe(app);
    console.log(`    declarative shadow DOM templates: ${dsdCount}`);
    console.log(`    render marker: ${first ?? '(none)'} then ${second ?? '(none)'}`);

    if (failures.length) {
      for (const f of failures) console.error(`    FAIL — ${f}`);
      failed++;
    } else {
      console.log('    PASS — server-rendered, and rendered per request');
    }
  } finally {
    stop();
  }
}

console.log(
  failed
    ? `\n[verify-ssr] ${failed} app(s) failed\n`
    : `\n[verify-ssr] all checked apps render on the server, per request\n`,
);
process.exit(failed ? 1 : 0);
