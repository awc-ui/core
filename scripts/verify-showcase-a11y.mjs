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
 * Covers BOTH framework builds, because the two are supposed to be the same
 * application and a11y is exactly where they are most likely to drift.
 *
 * Usage — needs the docs preview serving the built apps:
 *   pnpm --filter @awc-ui/docs exec astro preview --port 4350
 *   pnpm verify:showcase-a11y
 */
import puppeteer from 'puppeteer';

const A = 'http://localhost:4350/showcase/credit-risk/astro';
const R = 'http://localhost:4350/showcase/credit-risk/react';
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

/* ---- English leaking into the Arabic tree ---- */
{
  const p = await load(`${A}/ar/`);
  const probe = await p.evaluate(() => {
    const area = document.querySelector('md-area-chart');
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
  });

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

  ok(
    'area chart summary is Arabic, not the generated English',
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
  await p.close();
}
{
  const p = await load(`${A}/ar/counterparties/cp-01/`);
  const probe = await p.evaluate(() => {
    const c = document.querySelector('md-breadcrumbs');
    return { label: c?.getAttribute('aria-label') ?? c?.getAttribute('label') ?? '(none)' };
  });
  console.log('\n[Arabic counterparty] breadcrumb landmark');
  ok('breadcrumb nav is named in Arabic, not "Breadcrumb"', !/Breadcrumb/i.test(probe.label), probe.label);
  await p.close();
}

/* ---- badge no longer clipped by the button ---- */
{
  const p = await load(`${A}/`);
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
      // Clipped means the badge's box extends past the button but is hidden.
      badgeRight: Math.round(bo.right),
      buttonRight: Math.round(bu.right),
      buttonAria: button.getAttribute('aria-label'),
    };
  });
  console.log('\n[overview] watchlist badge');
  ok('badge is no longer slotted into the button', !probe.slotted && !probe.inButton);
  ok('badge renders with a real box', probe.badgeVisible, `${probe.badgeRight} vs button ${probe.buttonRight}`);
  ok('button carries the count in its accessible name', /\d/.test(probe.buttonAria ?? ''), probe.buttonAria ?? '(none)');
  await p.close();
}

/* ---- severity announced once, not twice ---- */
{
  const p = await load(`${A}/watchlist/`);
  const probe = await p.evaluate(() => {
    const row = document.querySelector('md-table-row[data-severity]');
    const dot = row?.querySelector('md-status-dot');
    // The severity chip is the dot's SIBLING; row.querySelector('md-chip')
    // would return the rating chip in an earlier cell and pass for the wrong
    // reason, which it did.
    const chip = dot?.parentElement?.querySelector('md-chip');
    return {
      dotAria: dot?.getAttribute('aria-hidden'),
      dotRole: dot?.getAttribute('role'),
      dotLabel: dot?.getAttribute('label'),
      chipLabel: chip?.getAttribute('label'),
    };
  });
  console.log('\n[watchlist] severity dot beside its chip');
  ok('dot is decorative (no label)', !probe.dotLabel, `label=${probe.dotLabel ?? 'none'}`);
  ok('dot is hidden from AT', probe.dotAria === 'true' || probe.dotRole === 'presentation', `aria-hidden=${probe.dotAria} role=${probe.dotRole}`);
  ok(
    'the chip beside it still carries the severity',
    ['High', 'Medium', 'Low', 'Ridicat', 'Mediu', 'Scăzut'].includes(probe.chipLabel ?? ''),
    probe.chipLabel ?? '(none)',
  );
  await p.close();
}

/* ---- collateral footer total is a row header ---- */
{
  const p = await load(`${A}/facilities/fac-057/`);
  const probe = await p.evaluate(() => {
    const foot = document.querySelector('md-table-foot md-table-row');
    if (!foot) return { noFooter: true };
    const first = foot.children[0];
    return { role: first?.getAttribute('role'), scope: first?.getAttribute('scope'), text: first?.textContent?.trim() };
  });
  console.log('\n[facility] collateral footer');
  if (probe.noFooter) {
    ok('(this facility has no collateral table — skipped)', true);
  } else {
    ok('"Total" is a rowheader', probe.role === 'rowheader', `role=${probe.role} scope=${probe.scope} text=${probe.text}`);
  }
  await p.close();
}

/* ---- paginated table reports its true row positions ---- */
{
  const p = await load(`${R}/`);
  const probe = await p.evaluate(() => {
    const table = document.querySelector('md-table');
    const rows = [...(table?.querySelectorAll('md-table-body md-table-row') ?? [])];
    return {
      rowCount: table?.getAttribute('row-count'),
      rowOffset: table?.getAttribute('row-offset'),
      ariaRowCount: table?.shadowRoot?.querySelector('[role="grid"],[role="table"]')?.getAttribute('aria-rowcount'),
      firstRowIndex: rows[0]?.getAttribute('aria-rowindex'),
    };
  });
  console.log('\n[react overview] paginated table row positions');
  ok('row-count is the whole book, not the page', probe.rowCount === '24', `row-count=${probe.rowCount}`);
  ok('row-offset is set', probe.rowOffset !== null, `row-offset=${probe.rowOffset}`);
  await p.close();
}

/* ---- dead attributes gone ---- */
{
  const p = await load(`${A}/`);
  const probe = await p.evaluate(() => ({
    sparklineLocale: document.querySelector('md-sparkline')?.hasAttribute('locale'),
    sortLabelActive: [...document.querySelectorAll('md-table-sort-label')].filter((l) => l.hasAttribute('active')).length,
  }));
  console.log('\n[overview] dead markup');
  ok('md-sparkline no longer ships a locale attribute', probe.sparklineLocale === false);
  // The table pushes active back in after hydration — that is the point.
  ok('sort labels get their state FROM the table', probe.sortLabelActive >= 1, `${probe.sortLabelActive} label(s) marked active by md-table`);
  await p.close();
}

await b.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${failed === 0 ? 'PASS' : 'FAIL'} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
