/**
 * Accessibility regressions the showcase has actually had, re-checked in a
 * browser rather than in the source.
 *
 * Every assertion here corresponds to a defect that was really shipped and was
 * invisible to type-checking, to linting, and to looking at the page: an
 * English accessible name on an Arabic chart, a status announced twice per
 * table row, a badge sliced in half by its host's overflow, a paginated table
 * telling assistive tech "row 1 of 10" on every page. None of those change a
 * pixel, so the only honest check is what the accessibility tree contains.
 *
 * COVERS EVERY BUILD IN THE STATIC TREE, and that is the point of running it at
 * this level rather than inside one app. Each build fixed these defects in its
 * own idiom — a defaulted prop in one, an attribute binding in another, a
 * component with no label in a third — and "the same application in many
 * frameworks" is a claim about the accessibility tree as much as about the
 * pixels. Most of the assertions apply to every build and are run against each;
 * the rest belong to a vertical's LOCALE-ROUTED tree, which is a different
 * shape and gets its own.
 *
 * RUNS PER VERTICAL. It used to have `credit-risk` spelled into it, and the
 * html/astro split hardcoded in two places. Both now come from the registry in
 * `scripts/lib/showcase-verticals.mjs`: the builds from `staticBuilds()`, and
 * which of them route locale through the URL from `VERTICALS[].localeRouted`.
 * Every vertical the registry lists is checked. Name one to check only it:
 *
 *   node scripts/verify-showcase-a11y.mjs               # every vertical
 *   node scripts/verify-showcase-a11y.mjs credit-risk   # just this one
 *
 * WHAT IT DOES NOT COVER, said plainly so a pass is not read as more than it
 * is: a vertical's server-rendered builds — credit-risk's next, nuxt,
 * angular-ssr and sveltekit — are absent. This script serves
 * `apps/docs/public`, and a build that renders per request has nothing staged
 * there by design; reaching one would mean starting a server, which is
 * `scripts/verify-ssr.mjs`'s job. So an accessibility regression present ONLY
 * in a server-rendered build passes here. Each SSR build shares its screens
 * with the SPA beside it, which narrows that gap to the server render itself,
 * but does not close it.
 *
 * Serves the staged builds itself, so it needs nothing running:
 *   pnpm showcase:build        # -> apps/docs/public/showcase/
 *   pnpm verify:showcase-a11y
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';
import { VERTICALS, basePathFor, stagedPathFor, staticBuilds } from './lib/showcase-verticals.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = join(root, 'apps/docs/public');
const PORT = 4351;

/**
 * What each vertical's screens are called, and the numbers its data makes true.
 *
 * WHY THIS LIVES HERE AND NOT IN THE REGISTRY. `showcase-verticals.mjs`
 * describes the BUILD MATRIX — which frameworks a vertical ships, where each is
 * staged, which of them route locale through the URL. Everything below is that
 * vertical's CONTENT: `/facilities/fac-057/` is the facility that happens to
 * have a collateral table, and twenty-four is how many rows credit-risk's
 * watchlist book holds. Keyed by vertical id so the next vertical adds an entry
 * instead of editing assertions, and a vertical with NO entry is a hard error
 * below rather than a run that quietly checks nothing.
 */
const EXPECTATIONS = {
  'credit-risk': {
    /*
     * The Arabic locale segment. Named for the script and not for "the RTL
     * locale" on purpose: the assertions below test that a label CONTAINS
     * Arabic characters, so a vertical shipping a different right-to-left
     * locale needs a matching range here, not just a different path segment.
     */
    arabicLocale: 'ar',
    /** A list screen whose rows lead with a severity marker. */
    listScreen: '/watchlist/',
    /** A record deep enough to render breadcrumbs. */
    detailScreen: '/counterparties/cp-01/',
    /** A record that actually has a collateral table, hence a table footer. */
    footerScreen: '/facilities/fac-057/',
    /** Every severity word the marker may carry, in every locale it ships. */
    severityWords: ['High', 'Medium', 'Low', 'Ridicat', 'Mediu', 'Scăzut'],
    /** The whole book, and one page of it. */
    bookRows: '24',
    pageRows: 10,
    /*
     * WHICH SCREEN CARRIES EACH SHAPE. These were implicit while credit-risk
     * was the only vertical — the badge, the paginated table and the dead
     * attributes all happened to live on its overview, and the severity chip
     * happened to be the fifth column. None of that is universal, so each is
     * named here rather than hardcoded in the assertion.
     */
    badgeScreen: '/',
    paginatedScreen: '/',
    /** The chart whose generated summary the locale check reads. */
    summaryChart: 'md-area-chart',
    /** This vertical's tables sort, so their labels take state from the table. */
    sortLabels: true,
    /** Column that repeats the row marker as a word. `null` = this vertical
     *  does not duplicate it, so only the marker itself is checked. */
    markerChipCell: 4,
  },
  wealth: {
    arabicLocale: 'ar',
    /** The advisor's book — its rows lead with a KYC dot beside the name. */
    listScreen: '/',
    /** A household is the drill target, and renders breadcrumbs. */
    detailScreen: '/households/hh-01/',
    /** The household's holdings table is the one with a totals row. */
    footerScreen: '/households/hh-01/',
    /**
     * Every KYC word the dot may carry, in all three locales — the assertion
     * tests that the label IS one of these, so a missing locale reads as a
     * failure rather than as a skipped check.
     */
    severityWords: [
      'Verified', 'Review due', 'Pending', 'Expired',
      'Verificat', 'Revizuire scadentă', 'În așteptare', 'Expirat',
      'موثَّق', 'مراجعة مستحقة', 'قيد الانتظار', 'منتهي الصلاحية',
    ],
    /*
     * Holdings, not the overview: this vertical's book is eight households and
     * is shown whole, while the 66-position holdings table is the one that
     * pages. Pointing the assertion at the overview would have it compare 8
     * against 8 and pass having tested nothing.
     */
    paginatedScreen: '/holdings/',
    bookRows: '66',
    pageRows: 25,
    sortLabels: true,
    /*
     * No badge-in-button anywhere in this vertical: the one badge sits on an
     * `md-avatar` in the household header, and an avatar does not clip its
     * corners the way `md-button` does. See the note on that block.
     */
    badgeScreen: null,
    /** The overview's performance curve is a line chart, not an area chart. */
    summaryChart: 'md-line-chart',
    /*
     * No second carrier to check. Credit-risk names the severity twice per row
     * — a dot leading the row and a chip in the severity column — so it
     * asserts the chip still says the word. A household row names its KYC
     * state once, on the dot, which is why the dot MUST be labelled; there is
     * no chip repeating it and nothing here to assert.
     */
    markerChipCell: null,
  },
  banking: {
    arabicLocale: 'ar',
    /*
     * NO SEVERITY MARKER IN THIS VERTICAL, and that is a decision rather than
     * an omission.
     *
     * `md-status-dot` is positioned absolutely against its nearest positioned
     * ancestor's bottom-end corner. In a statement row it landed across the
     * last two digits of the amount, and on a card row it had nothing to anchor
     * to at all. A transaction's state is carried by a word — the status chip
     * on the card list, the status line under a statement row — plus the
     * strike-through and the muted amount that `app.css` drives off
     * `data-status`. There is no dot to name, so there is no list screen for
     * this assertion to read and it is skipped rather than pointed at a screen
     * where it would report a missing element as a defect.
     */
    listScreen: null,
    severityWords: [],
    markerChipCell: null,
    /** An account is the drill target, and renders breadcrumbs. */
    detailScreen: '/accounts/acc-eur/',
    /** No table in this vertical carries a totals row; the assertion skips. */
    footerScreen: '/invest/',
    /*
     * NOTHING PAGES HERE EITHER. A statement is grouped by day and cutting a
     * day in half across a page boundary is the one break a statement must not
     * make, so the period is the filter instead. The holdings table is twelve
     * rows and is shown whole.
     */
    paginatedScreen: null,
    bookRows: null,
    pageRows: null,
    /** The home screen's balance curve. */
    summaryChart: 'md-area-chart',
    /** And no sortable table, so no sort label takes state from one. */
    sortLabels: false,
    /*
     * No badge-in-button: this vertical's one badge is `badge-value` on a
     * navigation tab, which the component places itself.
     */
    badgeScreen: null,
  },
  social: {
    arabicLocale: 'ar',
    /*
     * NO SEVERITY MARKER, NO PAGED TABLE, NO SORTABLE TABLE — and no TABLE at
     * all. This vertical has none of the shapes the three consoles share: it is
     * pictures, names and times. Each assertion that names one of those shapes
     * is switched off here rather than pointed at a screen where it would
     * report a missing element as a defect.
     */
    listScreen: null,
    severityWords: [],
    markerChipCell: null,
    paginatedScreen: null,
    bookRows: null,
    pageRows: null,
    sortLabels: false,
    footerScreen: '/profile/',
    /** A post is the drill, and it renders the back affordance. */
    detailScreen: '/p/post-02/',
    /*
     * NO CHART EITHER — and `null` rather than a selector that matches nothing,
     * which is what this was at first and was wrong in the way this whole table
     * exists to avoid. The check reads a chart's generated summary to prove the
     * Arabic build is not falling through to an English default; pointed at a
     * selector with nothing behind it, it reported "(none)" and "0/0" as two
     * failures. A vertical with no chart has nothing to assert here, and the
     * ordinary Arabic content checks beside it already cover the same claim.
     */
    summaryChart: null,
    badgeScreen: null,
  },
  community: {
    arabicLocale: 'ar',
    /*
     * THE SAME SHAPES LYRA LACKS, LACKED AGAIN — no table, no severity, no
     * pager, no chart. What this vertical adds over Lyra is depth rather than a
     * new widget: nested comments, a friendship that has two directions and a
     * membership that can be pending. None of that is a shape this file knows
     * how to assert, and all of it is asserted properly in the five builds' own
     * `verify-browser.mjs`.
     */
    listScreen: null,
    severityWords: [],
    markerChipCell: null,
    paginatedScreen: null,
    bookRows: null,
    pageRows: null,
    sortLabels: false,
    footerScreen: '/profile/',
    /** A post is the drill, and it renders the back affordance. */
    detailScreen: '/p/pst-04/',
    /* No chart — `null` rather than a selector that matches nothing, for the
       reason spelled out under `social` above. */
    summaryChart: null,
    /*
     * NO BADGE-ON-A-BUTTON, so null — and this was `'/'` first, on the
     * assumption that the friend-request count was one. It is not: it rides on
     * the Friends destination as `badge-value`, which `md-navigation-bar` and
     * `md-navigation-rail-tab` place inside their own shadow roots. There is no
     * `md-badge` slotted into an `md-button` anywhere in this vertical, which
     * is the single interaction this check exists to catch, and pointing it at
     * a screen without one reported a missing element as a defect — the exact
     * mistake the note above `social` warns about.
     */
    badgeScreen: null,
  },
};

/**
 * Only check the vertical named on the command line, if one is.
 *
 * No argument means every vertical in the registry. That default is the whole
 * reason this file was moved off its hardcoded list: a check that still reports
 * PASS while silently covering only the first vertical is the failure mode more
 * verticals would otherwise arrive with.
 */
const wanted = process.argv.slice(2);
const verticals = wanted.length ? VERTICALS.filter((v) => wanted.includes(v.id)) : VERTICALS;

const unknown = wanted.filter((id) => !VERTICALS.some((v) => v.id === id));
if (unknown.length) {
  console.error(
    `[a11y] no such vertical: ${unknown.join(', ')}\n` +
      `       known: ${VERTICALS.map((v) => v.id).join(', ')}`,
  );
  process.exit(1);
}

/*
 * NOTHING IS SKIPPED QUIETLY. A vertical with no expectations, or one that has
 * not been staged, stops the run rather than being passed over. A verification
 * that measures nothing while printing PASS is worse than one that errors.
 *
 * The staged check covers EVERY static build rather than just one of them: a
 * partial `pnpm showcase:build react vue` used to get as far as the browser and
 * then fail on whichever build was missing, reporting it as an accessibility
 * defect rather than as an absent build.
 */
const missingExpectations = verticals.filter((v) => !EXPECTATIONS[v.id]);
if (missingExpectations.length) {
  console.error(
    `[a11y] no expectations for: ${missingExpectations.map((v) => v.id).join(', ')}\n` +
      '       add an entry to EXPECTATIONS in this file — these assertions name a\n' +
      "       vertical's own screens and row counts, and cannot be guessed.",
  );
  process.exit(1);
}

/*
 * A vertical with nothing in the static tree would run every loop below zero
 * times and still print PASS, which is the precise shape of the rot this file
 * was moved onto the registry to avoid. Every vertical ships at least `html`,
 * so reaching this means the registry entry is wrong, not that the check is.
 */
const noStatic = verticals.filter((v) => staticBuilds(v.id).length === 0);
if (noStatic.length) {
  console.error(
    `[a11y] no static builds for: ${noStatic.map((v) => v.id).join(', ')}\n` +
      '       every vertical ships at least one build this script can serve — check\n' +
      '       `builds` for it in scripts/lib/showcase-verticals.mjs.',
  );
  process.exit(1);
}

const unstaged = verticals.flatMap((v) =>
  staticBuilds(v.id)
    .filter((b) => !existsSync(join(PUBLIC, stagedPathFor(v.id, b.framework), 'index.html')))
    .map((b) => `${v.id}/${b.framework}`),
);
if (unstaged.length) {
  console.error(
    `[a11y] not staged under apps/docs/public/showcase: ${unstaged.join(', ')}\n` +
      '       build it first:\n' +
      '       pnpm showcase:build',
  );
  process.exit(1);
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

// The staged tree already sits at the paths the builds were compiled against,
// so serving `apps/docs/public` at `/` puts every one of them exactly where its
// own absolute URLs expect to find it.
const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  let file = join(PUBLIC, normalize(decodeURIComponent(url.pathname)));
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file) || statSync(file).isDirectory()) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('not found');
    return;
  }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
  createReadStream(file).pipe(res);
});
await new Promise((done) => server.listen(PORT, done));

const b = await puppeteer.launch({ headless: 'shell' });
const results = [];
const ok = (l, p, d = '') => { results.push(p); console.log(`  ${p ? 'ok  ' : 'FAIL'} ${l}${d ? `  ${d}` : ''}`); };

const load = async (url, wait = 2500) => {
  const p = await b.newPage();
  await p.setViewport({ width: 1500, height: 950 });
  await p.goto(url, { waitUntil: 'networkidle0', timeout: 90000 });
  await new Promise((r) => setTimeout(r, wait));
  return p;
};

for (const vertical of verticals) {
  const expect = EXPECTATIONS[vertical.id];
  const url = (framework) => `http://localhost:${PORT}${basePathFor(vertical.id, framework)}`;

  /** Every build with a servable directory — the ones this script can reach. */
  const builds = staticBuilds(vertical.id).map((build) => build.framework);

  /*
   * The builds that keep the language in client state and page their tables.
   *
   * This used to be a literal `['react', 'vue', 'angular', 'svelte']`, which
   * was the same list arrived at by hand: it is every static build that is NOT
   * locale-routed. The registry names the locale-routed ones per vertical, so
   * the complement is derived rather than maintained, and a vertical that
   * routes locale differently gets the right answer without editing this file.
   */
  const hydrating = builds.filter((framework) => !vertical.localeRouted.includes(framework));

  /*
   * ONE locale-routed build carries the locale-tree assertions.
   *
   * A vertical's locale-routed builds render the same translated strings from
   * the same shared i18n module, so the leak these checks look for is either in
   * that module or in none of them — checking a second build re-reads the same
   * source through a different renderer. The list is in dock order and the last
   * entry is taken: `astro` for credit-risk, which is what these assertions
   * have always run against, and `html` for a five-build vertical, where it is
   * the only locale-routed build there is.
   */
  const localeBuild = vertical.localeRouted.at(-1);
  const L = localeBuild ? url(localeBuild) : null;

  if (verticals.length > 1) console.log(`\n======== ${vertical.id} ========`);

  /* ---- English leaking into the locale-routed tree ---- */
  /*
   * A vertical with no locale-routed build has no such tree to leak into, so
   * these are skipped — and that is the one skip in this file that is not a
   * hole, because there is nothing at the other end of it. The registry says so
   * explicitly per vertical rather than this file inferring it.
   */
  if (L) {
    {
      const p = await load(`${L}/${expect.arabicLocale}/`);
      const probe = await p.evaluate((summaryChart) => {
        const area = summaryChart ? document.querySelector(summaryChart) : null;
        const charts = [...document.querySelectorAll('md-bar-chart,md-line-chart,md-area-chart')];
        const plotRegions = charts.map((c) => {
          const region = c.shadowRoot?.querySelector('[role="application"]');
          return region?.getAttribute('aria-label') ?? '(none)';
        });
        const crumbs = document.querySelector('md-breadcrumbs');
        return {
          areaLabel: area?.getAttribute('aria-label') ?? '(none)',
          plotRegions,
          crumbLabel: crumbs?.getAttribute('aria-label') ?? '(no breadcrumbs on this screen)',
        };
      }, expect.summaryChart);

      console.log('\n[Arabic overview] accessible names');
      /*
       * "Contains no Latin letters" is the WRONG test and gave a false failure
       * first time round: the Arabic plot hint legitimately names the Home,
       * End and Escape keys, which are not translated. Test for Arabic script
       * present AND the English default absent instead.
       */
      const arabic = /[\u0600-\u06FF]/;
      const ENGLISH_PLOT_DEFAULT = 'Use the arrow keys to move between points';
      const ENGLISH_SUMMARY_TAIL = /\b(Area|Line|Bar) chart\b/;

      if (expect.summaryChart) {
        ok(
          `${expect.summaryChart} summary is Arabic, not the generated English`,
          arabic.test(probe.areaLabel) && !ENGLISH_SUMMARY_TAIL.test(probe.areaLabel),
          probe.areaLabel.slice(0, 60),
        );
        const named = probe.plotRegions.filter(
          (l) => arabic.test(l) && !l.includes(ENGLISH_PLOT_DEFAULT),
        );
        ok(
          'every chart plot region is named in Arabic',
          probe.plotRegions.length > 0 && named.length === probe.plotRegions.length,
          `${named.length}/${probe.plotRegions.length}`,
        );
      } else {
        ok('(this vertical draws no charts — skipped)', true);
      }
      await p.close();
    }
    {
      const p = await load(`${L}/${expect.arabicLocale}${expect.detailScreen}`);
      const probe = await p.evaluate(() => {
        const c = document.querySelector('md-breadcrumbs');
        return { label: c?.getAttribute('aria-label') ?? c?.getAttribute('label') ?? '(none)' };
      });
      console.log('\n[Arabic counterparty] breadcrumb landmark');
      ok('breadcrumb nav is named in Arabic, not "Breadcrumb"', !/Breadcrumb/i.test(probe.label), probe.label);
      await p.close();
    }
  }

  /* ---- badge no longer clipped by the button ---- */
  /*
   * Skipped entirely where `badgeScreen` is null, and that is not a hole: this
   * tests one component INTERACTION — `md-badge` anchoring past the corner of an
   * `md-button` that sets `overflow: hidden` — so a vertical that never puts a
   * badge on a button has nothing here to get wrong. Wealth anchors its badge to
   * an `md-avatar`, which does not clip, so it says null rather than pointing
   * this at a screen where the selector would simply find nothing and report a
   * missing element as a defect.
   */
  /*
   * Run against EVERY build. `md-badge` anchors absolutely and translates itself
   * past its host's corner, and `md-button` sets `overflow: hidden` with no
   * accommodation — so a slotted badge is sliced in half. Each build had to solve
   * it the same way (badge outside the button, count moved into the button's
   * accessible name) and each could have missed it independently.
   */
  for (const framework of expect.badgeScreen ? builds : []) {
    const p = await load(`${url(framework)}${expect.badgeScreen}`);
    const probe = await p.evaluate(() => {
      const badge = document.querySelector('md-badge');
      const button = document.querySelector('.badge-anchor md-button');
      if (!badge || !button) return { missing: true };
      const bo = badge.getBoundingClientRect();
      const bu = button.getBoundingClientRect();
      return {
        slotted: badge.getAttribute('slot'),
        inButton: button.contains(badge),
        badgeVisible: bo.width > 0 && bo.height > 0,
        badgeRight: Math.round(bo.right),
        buttonRight: Math.round(bu.right),
        buttonAria: button.getAttribute('aria-label'),
      };
    });
    console.log(`\n[${framework} overview] watchlist badge`);
    if (probe.missing) {
      ok('badge and button both present', false, 'one of them is missing');
    } else {
      ok('badge is not slotted into the button', !probe.slotted && !probe.inButton);
      ok('badge renders with a real box', probe.badgeVisible, `${probe.badgeRight} vs button ${probe.buttonRight}`);
      ok('button carries the count in its accessible name', /\d/.test(probe.buttonAria ?? ''), probe.buttonAria ?? '(none)');
    }
    await p.close();
  }

  /* ---- the severity marker leads the row, and is named ---- */
  /*
   * THIS INVARIANT CHANGED, and the change is the interesting part.
   *
   * The dot used to sit inside the severity cell, immediately beside a chip
   * carrying the same word, and was deliberately UNLABELLED: naming both made a
   * screen reader announce the severity twice on every row, and an unlabelled
   * `md-status-dot` correctly falls back to `role="presentation"` + `aria-hidden`.
   *
   * It now leads the row beside the obligor's name, at the other end of a
   * nine-column table. Nothing next to it says "high" any more, so the same
   * unlabelled dot would leave COLOUR as the only carrier of that meaning — the
   * exact defect the old arrangement was avoiding, arrived at from the opposite
   * direction. So the assertion is inverted: the dot must now be named, and the
   * chip in the severity cell must still carry the word too.
   */
  for (const framework of expect.listScreen ? builds : []) {
    const p = await load(`${url(framework)}${expect.listScreen}`);
    const probe = await p.evaluate((markerChipCell) => {
      const row = document.querySelector('md-table-body md-table-row');
      const cells = [...(row?.children ?? [])];
      const dot = cells[0]?.querySelector('md-status-dot');
      const link = cells[0]?.querySelector('a.drill');
      // The severity cell is the fifth column; it should hold a chip and no dot.
      const severityCell = markerChipCell == null ? null : cells[markerChipCell];
      return {
        dotInFirstCell: !!dot,
        /*
         * The COMPUTED accessible name, not the `label` input.
         *
         * `label` is a prop declared without `reflect`, so whether an attribute
         * exists says only how the framework delivered it — Svelte binds it as a
         * property and writes none, and this read used to fail that build alone
         * while its dot carried a perfectly good name. `md-status-dot` puts
         * `role` and `aria-label` on its HOST from `this.label`, so the host's
         * `aria-label` is what a screen reader actually announces and is the
         * same in every build. The input is kept as a fallback for a dot that
         * has not upgraded yet.
         */
        dotLabel: dot?.getAttribute('aria-label') ?? dot?.getAttribute('label') ?? dot?.label ?? null,
        dotHidden: dot?.getAttribute('aria-hidden'),
        dotBeforeLink:
          !!dot && !!link && !!(dot.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING),
        severityCellHasChip: !!severityCell?.querySelector('md-chip'),
        severityCellHasDot: !!severityCell?.querySelector('md-status-dot'),
        chipLabel: (() => {
          const chip = severityCell?.querySelector('md-chip');
          return chip?.getAttribute('aria-label') ?? chip?.getAttribute('label') ?? chip?.label ?? null;
        })(),
      };
    }, expect.markerChipCell);
    const WORDS = expect.severityWords;
    console.log(`\n[${framework} watchlist] severity marker`);
    ok('the dot leads the counterparty cell', probe.dotInFirstCell && probe.dotBeforeLink);
    ok(
      'it is NAMED, now that nothing beside it says the severity',
      WORDS.includes(probe.dotLabel ?? ''),
      `label=${probe.dotLabel ?? 'none'}`,
    );
    ok('and is therefore not hidden from AT', probe.dotHidden !== 'true', `aria-hidden=${probe.dotHidden}`);
    if (expect.markerChipCell != null) {
      ok('the severity cell keeps its chip, and gains no second dot', probe.severityCellHasChip && !probe.severityCellHasDot);
      ok('the chip still carries the severity', WORDS.includes(probe.chipLabel ?? ''), probe.chipLabel ?? '(none)');
    }
    await p.close();
  }

  /* ---- collateral footer total is a row header ---- */
  for (const framework of builds) {
    const p = await load(`${url(framework)}${expect.footerScreen}`);
    const probe = await p.evaluate(() => {
      const foot = document.querySelector('md-table-foot md-table-row');
      if (!foot) return { noFooter: true };
      const first = foot.children[0];
      return { role: first?.getAttribute('role'), scope: first?.getAttribute('scope'), text: first?.textContent?.trim() };
    });
    console.log(`\n[${framework} facility] collateral footer`);
    if (probe.noFooter) {
      ok('(this facility has no collateral table — skipped)', true);
    } else {
      ok('"Total" is a rowheader', probe.role === 'rowheader', `role=${probe.role} scope=${probe.scope} text=${probe.text}`);
    }
    await p.close();
  }

  /* ---- paginated table reports its true row positions ---- */
  /*
   * Only the hydrating builds page. The locale-routed ones — astro and html in
   * credit-risk — render the whole twenty-four-row book deliberately, because
   * hiding twenty rows behind a control that needs JavaScript would make those
   * two pages worse without it, so there is no offset to report and nothing
   * here to check.
   */
  for (const framework of expect.paginatedScreen ? hydrating : []) {
    const p = await load(`${url(framework)}${expect.paginatedScreen}`);
    const probe = await p.evaluate(() => {
      const table = document.querySelector('md-table');
      return {
        rowCount: table?.getAttribute('row-count'),
        rowOffset: table?.getAttribute('row-offset'),
        rendered: table?.querySelectorAll('md-table-body md-table-row').length ?? 0,
      };
    });
    console.log(`\n[${framework} overview] paginated table row positions`);
    ok('row-count is the whole book, not the page', probe.rowCount === expect.bookRows, `row-count=${probe.rowCount}`);
    ok('row-offset is set', probe.rowOffset !== null, `row-offset=${probe.rowOffset}`);
    ok('only one page is rendered', probe.rendered === expect.pageRows, `${probe.rendered} rows`);
    await p.close();
  }

  /* ---- dead attributes gone ---- */
  /*
   * Read off a locale-routed build because it is the one that ships its markup
   * pre-rendered: a dead attribute written by hand survives into the shipped
   * HTML there, where in a hydrating build it would be a line of source that
   * never reaches the document.
   */
  if (L) {
    const p = await load(`${L}/`);
    const probe = await p.evaluate(() => ({
      sparklineLocale: document.querySelector('md-sparkline')?.hasAttribute('locale'),
      sortLabelActive: [...document.querySelectorAll('md-table-sort-label')].filter((l) => l.hasAttribute('active')).length,
    }));
    console.log('\n[overview] dead markup');
    /*
     * `!== true`, not `=== false`. `querySelector(...)?.hasAttribute()` is
     * `undefined` when there is no sparkline on the screen, and a vertical that
     * draws none cannot be shipping a dead attribute on one. Testing for the
     * literal `false` turned "this app has no sparklines" into a failure.
     */
    ok(
      'md-sparkline no longer ships a locale attribute',
      probe.sparklineLocale !== true,
      probe.sparklineLocale === undefined ? '(no sparkline on this screen)' : '',
    );
    // The table pushes active back in after hydration — that is the point.
    // Skipped where a vertical sorts nothing: an assertion that a screen with no
    // sortable table has no active sort label passes having tested nothing.
    if (expect.sortLabels) {
      ok('sort labels get their state FROM the table', probe.sortLabelActive >= 1, `${probe.sortLabelActive} label(s) marked active by md-table`);
    }
    await p.close();
  }
}

await b.close();
server.close();

const failed = results.filter((r) => !r).length;
console.log(`\n${failed === 0 ? 'PASS' : 'FAIL'} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
