/**
 * Story coverage — how much of @awc-ui/core the Storybook suite actually
 * exercises, reported against the original .tsx sources.
 *
 * WHY NOT THE VITEST PROVIDER. It only attributes files that reach Vite's
 * module graph. Stencil's lazy loader fetches component chunks at runtime, so
 * they never do, and the report came back 0/0 for the whole library (the
 * default config instead measured apps/storybook/** — the test harness — which
 * looked like library coverage and was not). Four routes were tried through the
 * provider; all failed. See vitest.config.mts.
 *
 * WHAT THIS DOES INSTEAD, mirroring the e2e setup in
 * packages/core/test/coverage that already solves the identical problem:
 * drive the stories in a real browser with V8 JS coverage on, inline each
 * chunk's external sourcemap, and let monocart-coverage-reports do the
 * remapping. Monocart follows sourceMappingURL itself rather than depending on
 * a bundler's module graph — which is precisely the step the provider lacks.
 *
 * Requires a Storybook serving a SOURCE-MAPPED core build:
 *   pnpm --filter @awc-ui/core build:coverage-sb
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require_ = createRequire(import.meta.url);
// Playwright, not Puppeteer: it is already a dependency here (the Vitest
// browser provider uses it) and monocart consumes its coverage output directly.
const { chromium } = require_("playwright");
const { CoverageReport } = require_("monocart-coverage-reports");

const dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(dirname, "../../..");
const DIST = path.join(REPO, "packages/core/dist");
const SB = process.env.STORYBOOK_URL || "http://localhost:6006";

/**
 * Inline a chunk's external .map so monocart can follow it.
 *
 * Vite serves workspace files as `/@fs/<absolute path>`, so the on-disk map is
 * simply that path + '.map' — no guessing at a served-directory layout.
 */
function inlineSourceMap(text, url) {
  const m = /\/\/[#@]\s*sourceMappingURL=(\S+)\s*$/.exec(text);
  if (!m || m[1].startsWith("data:")) return text;
  try {
    const { pathname } = new URL(url);
    const onDisk = decodeURIComponent(
      pathname.replace(/^\/@fs/, "").split("?")[0],
    );
    const mapPath = path.join(path.dirname(onDisk), path.basename(m[1]));
    const map = fs.readFileSync(mapPath, "utf8");
    return text.replace(
      m[0],
      "//# sourceMappingURL=data:application/json;base64," +
        Buffer.from(map).toString("base64"),
    );
  } catch {
    return text;
  }
}

const options = {
  name: "AWC UI — Storybook story coverage",
  outputDir: path.join(dirname, "../coverage-stories"),
  // The library's own source only — not stories, specs, styles or node_modules.
  sourceFilter: (p) =>
    /(^|\/)src\/(components|utils|global)\//.test(p) &&
    /\.[tj]sx?(\?|$)/.test(p) &&
    !/\.css\b/.test(p) &&
    !/\.(spec|e2e)\.[tj]sx?\b/.test(p),
  // `raw` persists the original V8 data so this run can be MERGED with the
  // spec/e2e runs. Story coverage alone measures only what a story exercises —
  // the jest and e2e suites reach code no story can (SSR guards, error paths,
  // programmatic APIs), and counting them separately understates the library.
  reports: ["v8", "console-summary", "lcovonly", "raw"],
  logging: "error",

};

const run = async () => {
  const index = await (await fetch(`${SB}/index.json`)).json();
  const ids = Object.values(index.entries)
    .filter((e) => e.type === "story")
    .map((e) => e.id);
  const limit = Number(process.env.STORY_LIMIT || 0);
  const targets = limit ? ids.slice(0, limit) : ids;
  console.log(`story-coverage: visiting ${targets.length} stories`);

  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  const report = new CoverageReport(options);
  const context = await browser.newContext({
    viewport: { width: 1200, height: 900 },
  });

  /**
   * Drain coverage into the report every BATCH stories on a FRESH page.
   *
   * One page accumulating coverage across a thousand navigations grows without
   * bound and the tab dies ("Target crashed" at ~200 stories), losing the whole
   * run. Draining in batches keeps memory flat; monocart merges the add() calls.
   */
  const BATCH = Number(process.env.STORY_BATCH || 100);
  let page = null;
  let collected = 0;

  const openPage = async () => {
    page = await context.newPage();
    // resetOnNavigation false so coverage accumulates across the batch rather
    // than being discarded at each goto.
    await page.coverage.startJSCoverage({ resetOnNavigation: false });
  };

  const drain = async () => {
    if (!page) return;
    try {
      const entries = await page.coverage.stopJSCoverage();
      const list = entries
        // `packages/core/dist`, NOT a namespace or `dist/md3`: Storybook serves
        // the workspace package through /@fs/<abs path>/packages/core/dist/esm.
        // (Beware matching on 'md3' — the repo directory is itself md3-stencil-1,
        // so that pattern matches every Vite and Storybook file too.)
        .filter((e) => /packages\/core\/dist\//.test(e.url || ""))
        .map((e) => ({ ...e, source: inlineSourceMap(e.source || "", e.url) }));
      if (list.length) {
        await report.add(list);
        collected += list.length;
      }
    } catch (e) {
      console.warn("  drain failed for a batch, continuing:", e.message);
    }
    try {
      await page.close();
    } catch {
      /* already gone */
    }
    page = null;
  };

  await openPage();

  let visited = 0;
  const failures = [];
  for (const id of targets) {
    try {
      // awcCoverage=1 opts the stories into their coverage-only exercises (see
      // chart-play.ts). Without it those steps stay off, so normal viewing is
      // not disturbed by props being flipped underneath the user.
      await page.goto(`${SB}/iframe.html?id=${id}&viewMode=story&awcCoverage=1`, {
        waitUntil: "networkidle0",
        timeout: 30000,
      });
      // Stencil hydrates asynchronously after render, and play() runs after
      // that — reading coverage too early misses the interactive paths, which
      // are the ones worth measuring.
      await page
        .waitForFunction(
          () =>
            document.querySelectorAll(".hydrated").length > 0 ||
            document.body.innerText.length > 0,
          { timeout: 8000 },
        )
        .catch(() => {});
      await new Promise((r) =>
        setTimeout(r, Number(process.env.STORY_SETTLE_MS || 350)),
      );
      visited++;
      if (visited % 50 === 0) console.log(`  …${visited}/${targets.length}`);
      if (visited % BATCH === 0) {
        await drain();
        await openPage();
      }
    } catch (e) {
      // A story that fails to load must not abort the run, but silently
      // dropping it under-reports coverage: 267 of 1054 vanished this way and
      // the percentage looked like a code problem rather than a sweep problem.
      failures.push(`${id}: ${(e && e.message ? e.message : String(e)).slice(0, 80)}`);
      if (!page) await openPage();
    }
  }

  await drain();
  const list = [];

  console.log(
    `story-coverage: ${visited} stories visited, ${collected} library chunks collected`,
  );
  await report.generate();

  // Which components did no story exercise?
  //
  // Reported separately rather than through monocart's `all` option: that adds
  // raw .tsx it cannot analyse, so each file arrives with ZERO lines but its
  // full byte size — which collapsed the headline figure to ~2% and listed
  // every component at 0%. Diffing the component directory against the report
  // gives the same answer without corrupting the metrics.
  try {
    const compDir = path.join(REPO, 'packages/core/src/components');
    const onDisk = fs.readdirSync(compDir).filter((d) => d.startsWith('md-'));
    const lcov = fs.readFileSync(path.join(options.outputDir, 'lcov.info'), 'utf8');
    const missing = onDisk.filter((c) => !lcov.includes(`/components/${c}/${c}.tsx`));
    console.log(`story-coverage: ${onDisk.length - missing.length}/${onDisk.length} components exercised`);
    if (missing.length) {
      console.log('story-coverage: NOT exercised by any story:');
      missing.forEach((c) => console.log('   ', c));
    }
  } catch (e) {
    console.warn('story-coverage: could not list untouched components:', e.message);
  }

  await browser.close();
};

run().catch((e) => {
  console.error("story-coverage failed:", e);
  process.exit(1);
});
