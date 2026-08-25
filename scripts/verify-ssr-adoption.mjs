#!/usr/bin/env node
/**
 * Prove the BROWSER KEEPS the server's render — which is a different claim from
 * the server having produced one, and the one nothing was checking.
 *
 * `verify-ssr.mjs` proves each build renders per request: the markup arrives
 * without a browser, and two requests differ. Both of those are answered by
 * `fetch`, and both were TRUE of a build that was visibly broken on screen —
 * every nav icon drawn twice, a chip reading "24 of 61 24 of 61", a badge
 * reading "77" instead of "7". The server output was byte-comparable with the
 * builds that worked. The damage was done afterwards, by the framework's own
 * hydration, and no check could see it:
 *
 *   - `document.body.innerText` DOES NOT TRAVERSE SHADOW ROOTS, so every
 *     text-length and text-content assertion in the repo was blind to content
 *     duplicated inside a shadow root.
 *   - the light DOM was identical in the broken build — 174 `md-*` elements,
 *     same as the working ones — so element counts saw nothing either.
 *   - the page still rendered, still had a working dock, and still passed its
 *     own browser harness, because none of those look INSIDE the shadow roots.
 *
 * HOW IT ACTUALLY BREAKS. Stencil marks what it server-rendered: `s-id` on each
 * host, `c-id` on the shadow children. On the client its runtime uses those to
 * ADOPT the existing shadow DOM instead of rendering again. A framework whose
 * hydration strips unknown attributes takes `s-id` with them — Svelte 4's
 * `claim_element` removes every attribute not in its own template — and the
 * runtime, finding no marker, renders a SECOND copy into a shadow root that
 * already had one.
 *
 * So this script asks two questions `fetch` cannot:
 *
 *   1. IS ANYTHING DUPLICATED? Two signals, and the FAILURE. The precise one is
 *      a shadow root still carrying `c-id` after the runtime has run: those
 *      attributes are consumed on adoption, so their survival means the runtime
 *      never adopted that root and rendered beside what was already in it. The
 *      blunt one is a shadow-host count that disagrees with the reference
 *      build's for the same screen — every build renders the same application,
 *      so they should agree, and a build rendering twice diverges by dozens.
 *
 *   2. WAS THE SERVER RENDER ADOPTED, OR REPLACED? Measured with the runtime
 *      request blocked, so what is observed is purely the framework's own
 *      hydration. `s-id` surviving means the runtime can adopt. Zero means the
 *      framework discarded the markers, and the build re-renders on the client:
 *      the server render was real for first paint and then thrown away.
 *
 *      That is reported, not failed. A framework may make adoption genuinely
 *      unreachable, and a correct re-render is a legitimate compromise — but it
 *      is a compromise, and a build advertising server rendering should not
 *      quietly mean "for one paint". Silence here is how it would stay quiet.
 *
 * Usage:
 *   node scripts/verify-ssr-adoption.mjs                  # every SSR build
 *   node scripts/verify-ssr-adoption.mjs sveltekit        # only this one
 *
 * Each build must already be built. Servers are started and stopped here.
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SSR_APPS, SCREENS, REFERENCE } from './lib/ssr-apps.mjs';
import { allBuilds } from './lib/showcase-verticals.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/* puppeteer is a devDependency of the showcase apps rather than the root, so it
   is resolved from one of them rather than added to the root just for this.
   WHICH one is not worth naming: the apps are asked in registry order and the
   first that can resolve it wins, because not every app carries it — the Next
   build does not — and a single hardcoded path would break the day that app is
   renamed or its dependency dropped. */
const anchors = allBuilds().map((b) =>
  join(root, `apps/showcase/${b.vertical}/${b.framework}/package.json`),
);
let puppeteer;
for (const anchor of anchors) {
  try {
    puppeteer = createRequire(anchor)('puppeteer');
    break;
  } catch {
    /* not this one */
  }
}
if (!puppeteer) {
  console.error(
    '[verify-ssr-adoption] puppeteer is not resolvable — run `pnpm install` first',
  );
  process.exit(1);
}

/**
 * How far a build's shadow-host count may sit from the REFERENCE build's count
 * for the same screen.
 *
 * The comparison is against another build rather than against the number of
 * templates the server sent, and the first version of this script got that
 * wrong. Counting hosts against templates flagged the reference build itself on
 * one screen: components legitimately appear after hydration that were never
 * server-rendered — the dock, and the parts of a chart that only exist once a
 * canvas has been drawn. There is no constant that separates those from a
 * defect, because the number depends on how many charts a screen has.
 *
 * Every build renders the same application, so the honest invariant is that
 * they agree with each other. A build rendering its components twice diverges
 * enormously — the broken SvelteKit build had 239 hosts on a screen where every
 * other build had 207 — so this bound only has to exclude noise.
 */
const HOST_TOLERANCE = 2;

const wanted = process.argv.slice(2);
const asked = wanted.length ? SSR_APPS.filter((a) => wanted.includes(a.id)) : SSR_APPS;
if (!asked.length) {
  console.error(`[verify-ssr-adoption] no such app. known: ${SSR_APPS.map((a) => a.id).join(', ')}`);
  process.exit(1);
}

/* The reference is always measured, even when it was not asked for: without it
   there is nothing to compare against, and a per-screen baseline cannot be
   hardcoded because it depends on how many charts a screen draws. It is
   measured FIRST so every later build has something to be checked against. */
const apps = asked.some((a) => a.id === REFERENCE)
  ? [...asked].sort((a, b) => (a.id === REFERENCE ? -1 : b.id === REFERENCE ? 1 : 0))
  : [SSR_APPS.find((a) => a.id === REFERENCE), ...asked];

/** screen -> host count in the reference build. */
const baseline = new Map();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForServer(url, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(url)).ok) return true;
    } catch {
      /* not up yet */
    }
    await sleep(500);
  }
  return false;
}

/** Count shadow hosts and duplicated slot content, after everything has settled. */
async function inspectHydrated(browser, url) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60_000 });
    await sleep(2500);
    return await page.evaluate(() => {
      let hosts = 0;
      const duplicated = [];
      const walk = (root) => {
        for (const el of root.querySelectorAll('*')) {
          if (!el.shadowRoot) continue;
          hosts++;
          /* A shadow root that still carries `c-id` after the runtime has run
             is one the runtime never adopted: those attributes are consumed on
             adoption. Paired with a second, unannotated copy of the same
             markup, that is the duplication signature exactly. */
          const annotated = el.shadowRoot.querySelectorAll('[c-id]').length;
          if (annotated > 0) duplicated.push(`${el.tagName.toLowerCase()} (${annotated} unclaimed)`);
          walk(el.shadowRoot);
        }
      };
      walk(document);
      return { hosts, duplicated: duplicated.slice(0, 5), duplicatedCount: duplicated.length };
    });
  } finally {
    await page.close();
  }
}

/** Observe the framework's hydration alone, with the runtime blocked. */
async function inspectFrameworkOnly(browser, url) {
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on('request', (r) => (r.url().includes('/awc-runtime/') ? r.abort() : r.continue()));
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60_000 });
    await sleep(2000);
    return await page.evaluate(() => {
      const md = [...document.querySelectorAll('*')].filter((e) => e.tagName.startsWith('MD-'));
      return {
        sId: document.querySelectorAll('[s-id]').length,
        mdElements: md.length,
        withShadow: md.filter((e) => e.shadowRoot).length,
      };
    });
  } finally {
    await page.close();
  }
}

let failed = 0;
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });

for (const app of apps) {
  const cwd = join(root, app.dir);
  console.log(`\n==> ${app.id}`);
  if (!existsSync(cwd)) {
    console.error(`    SKIP — ${app.dir} does not exist`);
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
    /* The public path is the registry's, not a string built here: a build
       answers on the path it was compiled against, and there is one place that
       decides what that is. */
    const base = `http://localhost:${app.port}${app.base}`;
    if (!(await waitForServer(`${base}/`))) {
      console.error(`    FAIL — server did not answer on :${app.port}`);
      failed++;
      continue;
    }

    /* Question 2 first, on the overview: it is the one that describes the
       build's whole hydration strategy, so it belongs above the per-screen
       detail rather than buried in it. */
    const solo = await inspectFrameworkOnly(browser, `${base}/`);
    const adopts = solo.sId > 0;
    console.log(
      `    server render is ${adopts ? 'ADOPTED' : 'REPLACED'} — ` +
        `${solo.sId} of ${solo.mdElements} hosts keep their marker through hydration` +
        `${adopts ? '' : ', so the runtime re-renders on the client'}`,
    );
    if (!adopts) {
      console.log(
        `    note: not a failure, but the server render survives only to first paint here.`,
      );
    }

    const isReference = app.id === REFERENCE;

    for (const screen of SCREENS) {
      const url = `${base}/${screen}`;
      const html = await fetch(url).then((r) => r.text());
      const sent = (html.match(/shadowrootmode/g) ?? []).length;
      const { hosts, duplicated, duplicatedCount } = await inspectHydrated(browser, url);

      if (isReference) baseline.set(screen, hosts);
      const expected = baseline.get(screen);
      const drift = expected === undefined ? 0 : hosts - expected;

      /* Two independent signals, and the first is the precise one. A shadow
         root still carrying `c-id` after the runtime has run is one the runtime
         never adopted — those attributes are consumed on adoption — which is
         the duplication signature itself rather than a proxy for it. */
      const unclaimed = duplicatedCount > 0;
      const diverged = !isReference && Math.abs(drift) > HOST_TOLERANCE;
      const bad = unclaimed || diverged;
      if (bad) failed++;

      console.log(
        `    ${bad ? 'FAIL' : 'ok  '} /${screen.padEnd(22)} ` +
          `server sent ${String(sent).padStart(3)}, page has ${String(hosts).padStart(3)} hosts` +
          (isReference
            ? '   (reference)'
            : `   vs ${REFERENCE} ${String(expected).padStart(3)} (${drift >= 0 ? '+' : ''}${drift})`) +
          (unclaimed ? `  ${duplicatedCount} UNCLAIMED` : ''),
      );
      if (duplicated.length) console.log(`         rendered twice: ${duplicated.join(', ')}`);
    }
  } finally {
    stop();
    await sleep(500);
  }
}

await browser.close();

console.log(
  failed
    ? `\n[verify-ssr-adoption] ${failed} failure(s) — content is being rendered twice\n`
    : `\n[verify-ssr-adoption] no duplication: every build renders each component once\n`,
);
process.exit(failed ? 1 : 0);
