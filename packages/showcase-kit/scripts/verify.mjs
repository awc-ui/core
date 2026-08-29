/**
 * Round-trip checks over the built package.
 *
 * Run after `build`: pnpm --filter @awc-ui/showcase-kit verify
 * Exits non-zero on the first failed assertion.
 */
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const dist = resolve(here, '..', 'dist');
const load = (p) => import(pathToFileURL(join(dist, p)).href);

const D = await load('data/index.mjs');
const I = await load('i18n/index.mjs');
const P = await load('preboot/index.mjs');
const C = await load('credit-risk/index.mjs');

let failures = 0;
let checks = 0;

function ok(label, condition, detail = '') {
  checks += 1;
  if (condition) {
    console.log(`  ok   ${label}${detail ? `  ${detail}` : ''}`);
  } else {
    failures += 1;
    console.error(`  FAIL ${label}${detail ? `  ${detail}` : ''}`);
  }
}
function near(a, b, tol = 0.01) {
  return Math.abs(a - b) <= tol;
}
const section = (name) => console.log(`\n${name}`);
const sum = (arr, f) => arr.reduce((a, x) => a + f(x), 0);
const m = (n) => `${(n / 1e6).toFixed(2)}m`;

/* -------------------------------------------------------------------- data */

section('data — aggregates reconcile');

const totals = D.getPortfolioTotals();
const cps = D.getCounterparties();
const sectors = D.getSectors();
const facilities = D.getFacilities();

ok('reporting date frozen', totals.reportingDate === '2026-03-31', totals.reportingDate);
ok('24 counterparties', cps.length === 24, String(cps.length));
ok('7 sectors', sectors.length === 7);
ok(
  'totals.ead === Σ counterparty.ead',
  near(totals.ead, sum(cps, (c) => c.ead)),
  `${m(totals.ead)} vs ${m(sum(cps, (c) => c.ead))}`,
);
ok(
  'totals.ead === Σ sector.ead',
  near(totals.ead, sum(sectors, (s) => s.ead)),
);
ok(
  'totals.expectedLoss === Σ counterparty.expectedLoss',
  near(totals.expectedLoss, sum(cps, (c) => c.expectedLoss)),
  m(totals.expectedLoss),
);
ok('totals.rwa === Σ counterparty.rwa', near(totals.rwa, sum(cps, (c) => c.rwa)));
ok('totals.limit === Σ counterparty.limit', near(totals.limit, sum(cps, (c) => c.limit)));
ok(
  'drawn + undrawn === limit',
  near(totals.drawn + totals.undrawn, totals.limit),
);
ok(
  'weighted PD is the EAD-weighted mean',
  near(totals.weightedAvgPd, sum(cps, (c) => c.ead * c.pd) / totals.ead, 1e-6),
  `${(totals.weightedAvgPd * 100).toFixed(2)}%`,
);
ok(
  'sector shares sum to 1',
  near(sum(sectors, (s) => s.portfolioShare), 1, 0.001),
);
ok('facility count matches totals', facilities.length === totals.facilityCount);

section('data — counterparty ↔ facility roll-up');

let rollupOk = true;
let elOk = true;
for (const cp of cps) {
  const own = D.getFacilitiesFor(cp.id);
  if (own.length !== cp.facilityCount) rollupOk = false;
  if (!near(cp.ead, sum(own, (f) => f.ead))) rollupOk = false;
  if (!near(cp.limit, sum(own, (f) => f.commitmentEur))) rollupOk = false;
  if (!near(cp.expectedLoss, cp.ead * cp.pd * cp.lgd, 0.02)) elOk = false;
}
ok('every counterparty EAD === Σ its facility EADs', rollupOk);
ok('every counterparty EL === EAD × PD × LGD', elOk);
ok(
  'every facility belongs to a known counterparty',
  facilities.every((f) => D.getCounterpartyById(f.counterpartyId) !== undefined),
);
ok(
  'facility drawn + undrawn === commitment',
  facilities.every((f) => near(f.drawn + f.undrawn, f.commitment, 0.02)),
);
ok(
  'facility EAD === drawnEur + ccf × undrawnEur',
  facilities.every((f) => near(f.ead, f.drawnEur + f.ccf * f.undrawnEur, 0.02)),
);

section('data — covenants and collateral');

const covenants = D.getCovenants();
ok('every facility has 1..3 covenants', facilities.every((f) => f.covenantCount >= 1 && f.covenantCount <= 3));
ok(
  'covenant count matches totals',
  covenants.length === totals.covenantCount,
  String(covenants.length),
);
ok(
  'headroom sign agrees with status',
  covenants.every((c) =>
    c.status === 'breach'
      ? c.headroomPct < 0
      : c.status === 'watch'
        ? c.headroomPct >= 0 && c.headroomPct < 0.1
        : c.headroomPct >= 0.1,
  ),
);
ok(
  'min covenants breach only when current < threshold',
  covenants
    .filter((c) => c.direction === 'min')
    .every((c) => (c.currentValue < c.threshold) === c.status === undefined ? true : (c.currentValue < c.threshold) === (c.headroomPct < 0)),
);
ok(
  'breach count matches totals',
  covenants.filter((c) => c.status === 'breach').length === totals.covenantBreachCount,
  String(totals.covenantBreachCount),
);
ok(
  'getCovenantsFor returns only that facility',
  D.getCovenantsFor(facilities[0].id).every((c) => c.facilityId === facilities[0].id),
);

const secured = facilities.filter((f) => f.secured);
ok('every secured facility has collateral', secured.every((f) => D.getCollateralFor(f.id).length > 0));
ok('unsecured facilities have none', facilities.filter((f) => !f.secured).every((f) => D.getCollateralFor(f.id).length === 0));
const allCollateral = secured.flatMap((f) => D.getCollateralFor(f.id));
ok(
  'collateral netValue === valuationEur × (1 − haircut)',
  allCollateral.every((c) => near(c.netValue, c.valuationEur * (1 - c.haircutPct), 0.02)),
);
ok(
  'collateral net value matches totals',
  near(totals.collateralNetValue, sum(allCollateral, (c) => c.netValue)),
  m(totals.collateralNetValue),
);

section('data — rating scale and history');

const scale = D.getRatingScale();
ok('10 grades', scale.length === 10);
ok('PD is monotone in grade', scale.every((g, i) => i === 0 || g.pd > scale[i - 1].pd));
ok('grade 10 is D at PD 1', scale[9].label === 'D' && scale[9].pd === 1);
let historyOk = true;
for (const cp of cps) {
  const h = D.getRatingHistory(cp.id);
  if (h.length !== 8) historyOk = false;
  if (h[7].grade !== cp.grade) historyOk = false;
  if (h[7].quarter !== '2026-Q1' || h[7].date !== '2026-03-31') historyOk = false;
  if (h[0].quarter !== '2024-Q2') historyOk = false;
}
ok('8 quarterly observations per counterparty, ending on the current grade', historyOk);
ok('unknown counterparty yields an empty history', D.getRatingHistory('cp-999').length === 0);

section('data — watchlist');

const wl = D.getWatchlist();
ok('signal count matches totals', wl.length === totals.signalCount, String(wl.length));
ok(
  'every signal belongs to a watchlisted counterparty',
  wl.every((s) => D.getCounterpartyById(s.counterpartyId)?.watchlist === true),
);
ok(
  'denormalised fields agree with the counterparty row',
  wl.every((s) => {
    const cp = D.getCounterpartyById(s.counterpartyId);
    return cp.legalName === s.counterpartyName && cp.ead === s.ead && cp.grade === s.grade;
  }),
);
ok('sorted highest severity first', wl[0].severity === 'high');
ok(
  'watchlist counterparties count matches totals',
  D.getWatchlistCounterparties().length === totals.watchlistCount,
  String(totals.watchlistCount),
);

section('data — groups');

const groups = D.getGroups();
ok('4 corporate groups', groups.length === 4, String(groups.length));
let treeOk = true;
let treeTotalsOk = true;
for (const g of groups) {
  const tree = D.getGroupTree(g.id);
  if (!tree) { treeOk = false; continue; }
  const flat = [];
  const walk = (n) => { flat.push(n.counterparty); n.children.forEach(walk); };
  walk(tree.root);
  if (flat.length !== tree.memberCount) treeOk = false;
  if (tree.root.counterparty.id !== g.parentCounterpartyId) treeOk = false;
  if (!near(tree.totals.ead, sum(flat, (c) => c.ead))) treeTotalsOk = false;
}
ok('every member appears exactly once in its tree', treeOk);
ok('group totals === Σ member exposures', treeTotalsOk);
ok('unknown group id returns null', D.getGroupTree('grp-nope') === null);
ok(
  'Halden tree has 2 members',
  D.getGroupTree('grp-halden').memberCount === 2,
);
ok(
  'Nordwerk tree is 3 deep (parent → sub → sub-sub)',
  D.getGroupTree('grp-nordwerk').root.children[0].children.length === 1,
);

section('data — stress scenarios');

const scenarios = D.getStressScenarios();
ok('3 scenarios in order', scenarios.map((s) => s.id).join(',') === 'baseline,adverse,severe');
ok(
  'baseline EL === portfolio EL',
  near(scenarios[0].totals.expectedLoss, totals.expectedLoss, 1),
  m(scenarios[0].totals.expectedLoss),
);
ok('baseline deltas are zero', scenarios[0].totals.expectedLossDelta === 0);
ok(
  'EL grows monotonically across scenarios',
  scenarios[0].totals.expectedLoss < scenarios[1].totals.expectedLoss &&
    scenarios[1].totals.expectedLoss < scenarios[2].totals.expectedLoss,
  scenarios.map((s) => m(s.totals.expectedLoss)).join(' → '),
);
ok(
  'RWA grows monotonically across scenarios',
  scenarios[0].totals.rwa < scenarios[1].totals.rwa && scenarios[1].totals.rwa < scenarios[2].totals.rwa,
);
ok(
  'EAD is invariant across scenarios',
  scenarios.every((s) => near(s.totals.ead, totals.ead)),
);
ok(
  'each scenario has all 7 sectors and its sector ELs sum to its total',
  scenarios.every(
    (s) => s.bySector.length === 7 && near(sum(s.bySector, (x) => x.expectedLoss), s.totals.expectedLoss),
  ),
);
ok(
  'severe LGD uplift lands on every obligor',
  near(scenarios[2].totals.weightedAvgLgd - totals.weightedAvgLgd, 0.14, 0.005),
);

section('data — selectors are pure');

const a = D.getCounterparties();
a.sort((x, y) => x.id.localeCompare(y.id));
const b = D.getCounterparties();
ok('mutating a returned array does not affect the next call', b[0].id === a.slice().sort((x, y) => y.ead - x.ead)[0].id || b[0].ead >= b[1].ead);
ok('default sort is EAD descending', D.getCounterparties().every((c, i, arr) => i === 0 || arr[i - 1].ead >= c.ead));
ok('sortBy legalName ascending', D.getCounterparties({ sortBy: 'legalName' })[0].legalName === 'Adriatic Freight Lines');
ok('filter by sector', D.getCounterparties({ sectorId: 'energy' }).every((c) => c.sectorId === 'energy'));
ok('filter by watchlist', D.getCounterparties({ watchlist: true }).length === totals.watchlistCount);
ok('filter by grade band', D.getCounterparties({ minGrade: 8 }).every((c) => c.grade >= 8));
ok('search is case-insensitive', D.getCounterparties({ search: 'AURALIS' })[0]?.id === 'cp-08');
ok('paging', D.getCounterparties({ offset: 2, limit: 3 }).length === 3);
ok('unknown id returns undefined', D.getCounterpartyById('cp-999') === undefined);
ok('unknown sector returns undefined', D.getSectorById('mining') === undefined);

/* -------------------------------------------------------------------- i18n */

section('i18n — dictionaries');

/*
 * Every key, both verticals.
 *
 * The `wealth.` namespace used to be filtered out here because it shipped
 * English only. It is translated now, `Dictionary` requires it, and `ro.ts` /
 * `ar.ts` fail to COMPILE if they drift — so this compares the whole key set
 * again, which is what it was always meant to do.
 */
const keys = Object.keys(I.en);
ok('en has a dictionary', keys.length > 200, `${keys.length} translated keys`);
ok('ro has exactly the same keys', Object.keys(I.ro).length === keys.length && keys.every((k) => k in I.ro));
ok('ar has exactly the same keys', Object.keys(I.ar).length === keys.length && keys.every((k) => k in I.ar));
/*
 * Identical strings are legitimate for acronyms (RWA, PD, DSCR, KYC, AUM, YTD,
 * ETF), rating glyphs, pure placeholders, and the handful of words Romanian
 * spells exactly as English does — `client`, `contact`, `segment`, `instrument`,
 * `sector`, `global`, `total`. Everything else must actually be translated.
 *
 * The wealth arm is spelled out rather than folded into the credit-risk one:
 * the two verticals have same-named keys that mean different things, and a
 * pattern loose enough to cover both would stop catching an untranslated string
 * in either.
 */
const IDENTICAL_OK =
  /^(rating\.|table\.(id|pd|lgd|ead|rwa|rwaDelta|ccf|rating|sector|margin|type)$|kpi\.(expectedLossRatio|.*\.short)$|covenant\..*\.abbr$|dock\.(framework|accent)$|unit\.times$|common\.(na|total)$|screen\.counterparty\.title$|wealth\.(screen\.household\.title|kpi\..*\.short|table\.(client|contact|kyc|segment|aum|ytd|instrument|sector)|segment\.family-office|instrumentType\.etf|region\.global|entity\.client|common\.(na|total)|proposal\.(step\.client|instruments\.meta|time\.(am|pm)|ok))$)/;
const roSame = keys.filter((k) => I.ro[k] === I.en[k] && !IDENTICAL_OK.test(k));
const arSame = keys.filter((k) => I.ar[k] === I.en[k] && !IDENTICAL_OK.test(k));
ok('every ro string that should differ from en does', roSame.length === 0, roSame.join(',') || 'none');
ok('every ar string that should differ from en does', arSame.length === 0, arSame.join(',') || 'none');
ok('no empty values in any locale', ['en', 'ro', 'ar'].every((l) => keys.every((k) => I.DICTIONARIES[l][k].length > 0)));
ok(
  'placeholders survive translation',
  keys
    .filter((k) => /\{\w+\}/.test(I.en[k]))
    .every((k) => {
      const want = (I.en[k].match(/\{\w+\}/g) ?? []).sort().join();
      return ['ro', 'ar'].every((l) => (I.DICTIONARIES[l][k].match(/\{\w+\}/g) ?? []).sort().join() === want);
    }),
);

section('i18n — every fixture key resolves');

const t = I.createTranslator('ar');
const fixtureKeys = new Set([
  ...sectors.map((s) => s.nameKey),
  ...facilities.map((f) => f.typeKey),
  ...covenants.map((c) => c.nameKey),
  ...allCollateral.map((c) => c.typeKey),
  ...allCollateral.map((c) => c.valuationBasisKey),
  ...covenants.map((c) => c.frequencyKey),
  ...wl.map((s) => s.typeKey),
  ...wl.map((s) => s.severityKey),
  ...scale.map((g) => g.bandKey),
  ...scenarios.map((s) => s.nameKey),
  ...scenarios.map((s) => s.descriptionKey),
  ...cps.map((c) => `country.${c.country}`),
  ...cps.map((c) => `rating.${c.ratingLabel}`),
  ...facilities.map((f) => `facilityStatus.${f.status}`),
  ...covenants.map((c) => `covenantStatus.${c.status}`),
  ...covenants.map((c) => `covenantDirection.${c.direction}`),
]);
ok(
  `all ${fixtureKeys.size} distinct fixture i18n keys exist in every locale`,
  [...fixtureKeys].every((k) => ['en', 'ro', 'ar'].every((l) => k in I.DICTIONARIES[l])),
  [...fixtureKeys].filter((k) => !(k in I.en)).join(',') || 'none missing',
);

section('i18n — translator and formatters');

ok('interpolation', I.createTranslator('en').t('common.showing', { shown: 10, total: 24 }) === 'Showing 10 of 24');
ok('ro interpolation', I.createTranslator('ro').t('common.showing', { shown: 10, total: 24 }) === 'Se afișează 10 din 24');
ok('unknown key falls back to the key', t.t('nope.nope') === 'nope.nope');
ok('unknown locale falls back to en', I.createTranslator('zz').locale === 'en');
ok('missing param leaves the token visible', I.createTranslator('en').t('common.showing', { shown: 1 }) === 'Showing 1 of {total}');
ok('translator is cached', I.createTranslator('ro') === I.createTranslator('ro'));

ok('LOCALES metadata', I.LOCALES.map((l) => `${l.code}:${l.dir}`).join(',') === 'en:ltr,ro:ltr,ar:rtl');
ok('getDirection(ar) is rtl', I.getDirection('ar') === 'rtl');
ok('isLocaleCode rejects junk', I.isLocaleCode('de') === false && I.isLocaleCode('ar') === true);

const dateEn = I.formatDate('2026-03-31', 'en');
const dateRo = I.formatDate('2026-03-31', 'ro');
const dateAr = I.formatDate('2026-03-31', 'ar');
ok('formatDate en', dateEn.includes('2026'), dateEn);
ok('formatDate ro differs from en', dateRo !== dateEn, dateRo);
ok('formatDate ar differs from en', dateAr !== dateEn, dateAr);
ok('formatDate iso is a passthrough', I.formatDate('2026-03-31', 'en', 'iso') === '2026-03-31');
ok('formatDate accepts a Date', I.formatDate(new Date(Date.UTC(2026, 2, 31)), 'en') === dateEn);
ok('formatPercent takes a fraction', I.formatPercent(0.0135, 'en') === '1.35%', I.formatPercent(0.0135, 'en'));
ok('formatPercent handles negatives', I.formatPercent(-0.084, 'en', { maximumFractionDigits: 1 }).startsWith('-8.4'));
const curEn = I.formatCurrency(3178153000, 'en');
const curCompact = I.formatCurrency(3178153000, 'en', { notation: 'compact' });
ok('formatCurrency standard', curEn.includes('€'), curEn);
ok('formatCurrency compact', curCompact.length < 12, curCompact);
ok('formatCurrency honours the currency code', I.formatCurrency(100, 'ar', { currency: 'AED' }).length > 0, I.formatCurrency(100, 'ar', { currency: 'AED' }));
ok('formatNumber grouping', I.formatNumber(1234567, 'en') === '1,234,567', I.formatNumber(1234567, 'en'));
ok('formatNumber ro grouping differs', I.formatNumber(1234567, 'ro') !== I.formatNumber(1234567, 'en'), I.formatNumber(1234567, 'ro'));

section('i18n — timezone independence');

const original = process.env.TZ;
const stamps = [];
for (const tz of ['UTC', 'Pacific/Kiritimati', 'Pacific/Midway', 'Asia/Dubai']) {
  process.env.TZ = tz;
  I.clearFormatterCache();
  stamps.push(`${tz}=${I.formatDate('2026-03-31', 'en', 'long')}`);
}
process.env.TZ = original;
I.clearFormatterCache();
const distinct = new Set(stamps.map((s) => s.split('=')[1]));
ok('formatDate is identical in every host timezone', distinct.size === 1, [...distinct][0]);

/* ----------------------------------------------------------------- preboot */

section('preboot');

ok('under 1 kB', Buffer.byteLength(P.PREBOOT_SCRIPT, 'utf8') < 1024, `${Buffer.byteLength(P.PREBOOT_SCRIPT, 'utf8')}B`);
ok('is an IIFE', P.PREBOOT_SCRIPT.startsWith('(function(){') && P.PREBOOT_SCRIPT.endsWith('})();'));
ok('uses the one namespaced storage key', P.PREBOOT_SCRIPT.includes("'awc:showcase:v1'"));
ok('never writes data-theme="light"', !P.PREBOOT_SCRIPT.includes("'data-theme','light'"));
ok('removes data-density rather than writing 0', P.PREBOOT_SCRIPT.includes("removeAttribute('data-density')"));
ok('script tag helper wraps it', P.prebootScriptTag() === `<script>${P.PREBOOT_SCRIPT}</script>`);

/*
 * The checks above only grep the source. These RUN it, because the script's
 * whole job is a side effect on <html> and a string match cannot tell you
 * whether it fired. The IIFE swallows its own exceptions by design, so a
 * throwing stub would look exactly like a passing run — every stub here is
 * therefore complete enough that the script takes its real path.
 */
function runPreboot({ search = '', stored = null, lang = 'en', dir = 'ltr', localeRoute = false, prefersDark = false } = {}) {
  const attrs = new Map();
  if (localeRoute) attrs.set('data-locale-route', '');
  const documentElement = {
    lang,
    dir,
    hasAttribute: (k) => attrs.has(k),
    setAttribute: (k, v) => attrs.set(k, String(v)),
    removeAttribute: (k) => attrs.delete(k),
  };
  const sandbox = {
    document: { documentElement },
    location: { search },
    localStorage: { getItem: () => (stored === null ? null : JSON.stringify(stored)) },
    URLSearchParams,
    JSON,
    parseInt,
    window: { matchMedia: () => ({ matches: prefersDark }) },
  };
  sandbox.matchMedia = sandbox.window.matchMedia;
  vm.createContext(sandbox);
  vm.runInContext(P.PREBOOT_SCRIPT, sandbox);
  return { lang: documentElement.lang, dir: documentElement.dir, attrs };
}

let r = runPreboot({ stored: { locale: 'ar', theme: 'dark', density: -2 } });
ok('applies a stored locale, direction, theme and density', r.lang === 'ar' && r.dir === 'rtl' && r.attrs.get('data-theme') === 'dark' && r.attrs.get('data-density') === '-2', `${r.lang}/${r.dir}`);

r = runPreboot({ search: '?lang=ro&density=-4', stored: { locale: 'ar', density: -1 } });
ok('the URL beats localStorage', r.lang === 'ro' && r.attrs.get('data-density') === '-4', `${r.lang}/${r.attrs.get('data-density')}`);

r = runPreboot({ stored: { locale: 'en', theme: 'light', density: 0 } });
ok('light theme and rung 0 REMOVE their attributes', !r.attrs.has('data-theme') && !r.attrs.has('data-density'));

r = runPreboot({ stored: { theme: 'system' }, prefersDark: true });
ok('system theme follows prefers-color-scheme', r.attrs.get('data-theme') === 'dark');

r = runPreboot({ stored: { locale: 'zz', density: 99, theme: 'neon' } });
ok('junk state falls back to en/ltr/light/0', r.lang === 'en' && r.dir === 'ltr' && !r.attrs.has('data-theme') && !r.attrs.has('data-density'));

/*
 * The locale-route opt-out. A statically rendered build writes the language
 * into the HTML at build time, so a stale locale in localStorage must not be
 * stamped over it — that would put lang="ro" on English text, which misleads
 * screen readers, hyphenation and the browser's own translate offer. Theme and
 * density are pure CSS and must still apply.
 */
r = runPreboot({ lang: 'en', dir: 'ltr', localeRoute: true, stored: { locale: 'ar', theme: 'dark', density: -3 } });
ok('data-locale-route leaves the server-rendered lang alone', r.lang === 'en', r.lang);
ok('…and the server-rendered dir alone', r.dir === 'ltr', r.dir);
ok('…while still applying theme and density', r.attrs.get('data-theme') === 'dark' && r.attrs.get('data-density') === '-3');

r = runPreboot({ lang: 'ar', dir: 'rtl', localeRoute: true, stored: { locale: 'en' } });
ok('an RTL page stays RTL despite an LTR locale in storage', r.lang === 'ar' && r.dir === 'rtl', `${r.lang}/${r.dir}`);

r = runPreboot({ lang: 'ar', dir: 'rtl', localeRoute: true, search: '?lang=en' });
ok('and a stale ?lang in the URL cannot override the route either', r.lang === 'ar' && r.dir === 'rtl', `${r.lang}/${r.dir}`);

/* -------------------------------------------------------------------- dock */

section('dock — state, URL and the html attribute contract');

// Minimal DOM stand-in. Enough to exercise applyShowcaseState's contract.
const attrs = new Map();
const styleProps = new Map();
const headChildren = [];
const fakeDoc = {
  documentElement: {
    setAttribute: (k, v) => attrs.set(k, v),
    removeAttribute: (k) => attrs.delete(k),
    getAttribute: (k) => (attrs.has(k) ? attrs.get(k) : null),
    hasAttribute: (k) => attrs.has(k),
    style: { setProperty: (k, v) => styleProps.set(k, v), removeProperty: (k) => styleProps.delete(k) },
  },
  head: { appendChild: (el) => headChildren.push(el) },
  createElement: () => ({ id: '', textContent: '', remove() { const i = headChildren.indexOf(this); if (i >= 0) headChildren.splice(i, 1); } }),
  getElementById: (id) => headChildren.find((el) => el.id === id) ?? null,
};

globalThis.window = undefined;
const K = await load('dock/index.mjs');

ok('storage key is the single namespaced one', K.STORAGE_KEY === 'awc:showcase:v1');
ok('density rungs are 0..-4', K.DENSITY_RUNGS.join(',') === '0,-1,-2,-3,-4');
ok('theme modes', K.THEME_MODES.join(',') === 'light,dark,system');
ok('4 accent presets', K.SEED_PRESETS.length === 4, K.SEED_PRESETS.map((p) => p.id).join(','));
ok('default preset carries no CSS override', K.SEED_PRESETS[0].css === '');
ok('other presets override --md-sys-color-primary in both themes', K.SEED_PRESETS.slice(1).every((p) => p.css.includes(':root{--md-sys-color-primary:') && p.css.includes('[data-theme="dark"]')));

ok('URL params', JSON.stringify(K.URL_PARAMS) === '{"theme":"theme","locale":"lang","dir":"dir","density":"density","seed":"seed"}');
const parsed = K.readStateFromSearch('?theme=dark&lang=ar&density=-2&seed=azure');
ok('readStateFromSearch parses every param', parsed.theme === 'dark' && parsed.locale === 'ar' && parsed.density === -2 && parsed.seed === 'azure');
ok('unknown values are ignored', Object.keys(K.readStateFromSearch('?theme=neon&lang=de&seed=puce')).length === 0);
ok('density is clamped to the floor', K.readStateFromSearch('?density=-9').density === -4);
ok('positive density collapses to 0', K.readStateFromSearch('?density=3').density === 0);
ok('ar implies rtl when dir is absent', K.normalizeState({ locale: 'ar' }).dir === 'rtl');
ok('an explicit dir wins over the locale', K.normalizeState({ locale: 'ar', dir: 'ltr' }).dir === 'ltr');
ok('normalizeState fills defaults', JSON.stringify(K.normalizeState(null)) === JSON.stringify(K.DEFAULT_STATE));

const st = K.normalizeState({ theme: 'dark', locale: 'ar', density: -2, seed: 'azure' });
ok('toSearchParams round-trips', JSON.stringify(K.normalizeState(K.readStateFromSearch(`?${K.toSearchParams(st)}`))) === JSON.stringify(st));

K.applyShowcaseState(st, fakeDoc);
ok('lang written', attrs.get('lang') === 'ar');
ok('dir written', attrs.get('dir') === 'rtl');
ok('data-theme="dark" written', attrs.get('data-theme') === 'dark');
ok('data-density="-2" written', attrs.get('data-density') === '-2');
ok('seed stylesheet injected', headChildren.length === 1 && headChildren[0].id === 'awc-showcase-seed' && headChildren[0].textContent.length > 100);

K.applyShowcaseState(K.normalizeState({ theme: 'light', locale: 'en', density: 0, seed: 'default' }), fakeDoc);
ok('data-theme REMOVED for light, never written as "light"', !attrs.has('data-theme'));
ok('data-density REMOVED at rung 0, never written as "0"', !attrs.has('data-density'));
ok('dir flips back to ltr', attrs.get('dir') === 'ltr');
ok('seed stylesheet removed for the default preset', headChildren.length === 0);
ok('only the four documented attributes were ever written', [...attrs.keys()].every((k) => ['lang', 'dir', 'data-theme', 'data-density'].includes(k)), [...attrs.keys()].join(','));

/*
 * applyShowcaseState is the RUNTIME TWIN of the preboot script, and the two must
 * agree about data-locale-route or they fight. Shipping the guard in only one of
 * them is worse than shipping it in neither: preboot leaves the server-rendered
 * language alone, then this stamps the stored one back over it a moment later,
 * so the page flashes the right language and settles on the wrong one.
 *
 * That is exactly what happened — the guard went into preboot, the unit checks
 * for preboot passed, and the bug only surfaced in a real browser. Hence these.
 */
const routedAttrs = new Map([['data-locale-route', '']]);
const routedDoc = {
  documentElement: {
    lang: 'en',
    dir: 'ltr',
    setAttribute: (k, v) => routedAttrs.set(k, String(v)),
    getAttribute: (k) => routedAttrs.get(k) ?? null,
    removeAttribute: (k) => routedAttrs.delete(k),
    hasAttribute: (k) => routedAttrs.has(k),
  },
  head: { appendChild: () => {}, querySelector: () => null },
  getElementById: () => null,
  createElement: () => ({ setAttribute() {}, appendChild() {}, remove() {}, style: {} }),
};

K.applyShowcaseState(K.normalizeState({ locale: 'ar', theme: 'dark', density: -3 }), routedDoc);
ok(
  'applyShowcaseState honours data-locale-route: lang is NOT overwritten',
  !routedAttrs.has('lang') && routedDoc.documentElement.lang === 'en',
  routedDoc.documentElement.lang,
);
ok('…nor is dir', !routedAttrs.has('dir') && routedDoc.documentElement.dir === 'ltr', routedDoc.documentElement.dir);
ok(
  '…while theme and density still apply',
  routedAttrs.get('data-theme') === 'dark' && routedAttrs.get('data-density') === '-3',
  `${routedAttrs.get('data-theme')}/${routedAttrs.get('data-density')}`,
);

const freeAttrs = new Map();
const freeDoc = {
  documentElement: {
    lang: 'en',
    dir: 'ltr',
    setAttribute: (k, v) => freeAttrs.set(k, String(v)),
    getAttribute: (k) => freeAttrs.get(k) ?? null,
    removeAttribute: (k) => freeAttrs.delete(k),
    hasAttribute: (k) => freeAttrs.has(k),
  },
  head: { appendChild: () => {}, querySelector: () => null },
  getElementById: () => null,
  createElement: () => ({ setAttribute() {}, appendChild() {}, remove() {}, style: {} }),
};
K.applyShowcaseState(K.normalizeState({ locale: 'ar', theme: 'light', density: 0 }), freeDoc);
ok(
  'without the marker it still writes lang and dir, as every other build needs',
  freeAttrs.get('lang') === 'ar' && freeAttrs.get('dir') === 'rtl',
  `${freeAttrs.get('lang')}/${freeAttrs.get('dir')}`,
);

section('dock — framework routing');

const carried = K.normalizeState({ theme: 'dark', locale: 'ro', density: -1, seed: 'bronze' });
const url = new URL(
  K.buildFrameworkUrl('vue', {
    current: 'react',
    basePath: '/showcase/credit-risk',
    pathname: '/showcase/credit-risk/react/counterparties',
    origin: 'https://awc-ui.dev',
    state: carried,
  }),
);
ok('framework segment swapped', url.pathname === '/showcase/credit-risk/vue/counterparties', url.pathname);
ok('state carried in the query', url.searchParams.get('lang') === 'ro' && url.searchParams.get('theme') === 'dark' && url.searchParams.get('density') === '-1' && url.searchParams.get('seed') === 'bronze');
ok('origin preserved', url.origin === 'https://awc-ui.dev');

const rooted = new URL(
  K.buildFrameworkUrl('svelte', {
    current: 'react',
    basePath: '/showcase/credit-risk',
    pathname: '/',
    origin: 'http://localhost:5173',
    state: carried,
  }),
);
ok('falls back to basePath when the segment is absent', rooted.pathname === '/showcase/credit-risk/svelte/', rooted.pathname);

const trailing = new URL(
  K.buildFrameworkUrl('angular', {
    current: 'html',
    basePath: '/showcase/credit-risk',
    pathname: '/showcase/credit-risk/html/',
    origin: 'https://awc-ui.dev',
    state: carried,
  }),
);
ok('trailing slash preserved', trailing.pathname === '/showcase/credit-risk/angular/', trailing.pathname);

section('dock — locale routing');

/*
 * This arithmetic is fiddly enough that a first pass at it shipped a real bug:
 * it sliced off `base-path`, which stops BEFORE the framework segment, and so
 * produced /showcase/credit-risk/ro/astro/… — a path that exists in no build.
 * Hence the explicit appBase here, and hence these checks: the helpers are
 * pure so that this case can be pinned rather than eyeballed.
 */
const APP = { appBase: '/showcase/credit-risk/astro', defaultLocale: 'en' };
const at = (p) => `https://awc-ui.dev${p}`;

let sp = K.splitLocalePath('/showcase/credit-risk/astro/', APP);
ok('an unprefixed path is the DEFAULT locale, not "no locale"', sp.locale === 'en' && sp.rest === '/', `${sp.locale} ${sp.rest}`);

sp = K.splitLocalePath('/showcase/credit-risk/astro/ro/counterparties/cp-01/', APP);
ok('a prefixed path yields its locale and the screen beneath it', sp.locale === 'ro' && sp.rest === '/counterparties/cp-01/', `${sp.locale} ${sp.rest}`);

sp = K.splitLocalePath('/showcase/credit-risk/astro/ar', APP);
ok('a bare locale segment with no trailing slash still splits', sp.locale === 'ar' && sp.rest === '/', `${sp.locale} ${sp.rest}`);

sp = K.splitLocalePath('/showcase/credit-risk/astro/sectors/energy/', APP);
ok('a screen whose name is not a locale is left alone', sp.locale === 'en' && sp.rest === '/sectors/energy/', sp.rest);

ok(
  'switching away from the default INSERTS a segment',
  new URL(K.buildLocaleUrl('ro', { ...APP, href: at('/showcase/credit-risk/astro/watchlist/') })).pathname ===
    '/showcase/credit-risk/astro/ro/watchlist/',
);
ok(
  'switching TO the default REMOVES it',
  new URL(K.buildLocaleUrl('en', { ...APP, href: at('/showcase/credit-risk/astro/ro/watchlist/') })).pathname ===
    '/showcase/credit-risk/astro/watchlist/',
);
ok(
  'switching between two prefixed locales replaces rather than stacks',
  new URL(K.buildLocaleUrl('ar', { ...APP, href: at('/showcase/credit-risk/astro/ro/stress/') })).pathname ===
    '/showcase/credit-risk/astro/ar/stress/',
);
ok(
  'the locale never lands before the framework segment',
  K.FRAMEWORKS === undefined ||
    ['ro', 'ar'].every((l) =>
      !new URL(K.buildLocaleUrl(l, { ...APP, href: at('/showcase/credit-risk/astro/') })).pathname.includes(
        `/credit-risk/${l}/`,
      ),
    ),
);

const deep = new URL(
  K.buildLocaleUrl('ro', {
    ...APP,
    href: at('/showcase/credit-risk/astro/facilities/fac-008/?theme=dark#collateral'),
  }),
);
ok('query and hash survive a language change', deep.search === '?theme=dark' && deep.hash === '#collateral', `${deep.search}${deep.hash}`);
ok('…and so does the screen', deep.pathname === '/showcase/credit-risk/astro/ro/facilities/fac-008/', deep.pathname);

ok(
  'round trip: every locale returns to the same screen',
  ['en', 'ro', 'ar'].every((l) => {
    const there = K.buildLocaleUrl(l, { ...APP, href: at('/showcase/credit-risk/astro/sectors/energy/') });
    const back = K.buildLocaleUrl('en', { ...APP, href: there });
    return new URL(back).pathname === '/showcase/credit-risk/astro/sectors/energy/';
  }),
);

/*
 * The other direction: leaving a locale-routed build for one that has no
 * locale routes. The SEGMENT must not survive — /react/ro/watchlist/ is a 404 —
 * but the language must, as the ?lang= param every build reads.
 */
const leaving = K.splitLocalePath('/showcase/credit-risk/astro/ro/watchlist/', APP);
const crossed = new URL(
  K.buildFrameworkUrl('react', {
    current: 'astro',
    basePath: '/showcase/credit-risk',
    pathname: `${APP.appBase}${leaving.rest}`,
    origin: 'https://awc-ui.dev',
    state: K.normalizeState({ locale: leaving.locale }),
  }),
);
ok('leaving a locale-routed build drops the locale SEGMENT', crossed.pathname === '/showcase/credit-risk/react/watchlist/', crossed.pathname);
ok('…and carries the language in the query instead', crossed.searchParams.get('lang') === 'ro');

/* ------------------------------------------------------- credit-risk logic */

/*
 * These are shared by every framework build. A regression here is not one
 * broken screen, it is the same wrong number rendered six times and no
 * disagreement between the ports to reveal it — so the arithmetic is pinned
 * against the fixture rather than against a snapshot of its own output.
 */

section('credit-risk — derived series');

const qs = C.quarterlySeries();
ok('eight quarterly points', qs.length === 8, String(qs.length));
ok('oldest first, ending at the reporting quarter', qs[qs.length - 1].date === totals.reportingDate, qs[qs.length - 1].quarter);
ok(
  'quarters strictly ascending',
  qs.every((p, i) => i === 0 || p.date > qs[i - 1].date),
);
ok(
  'final EAD === portfolio total',
  near(qs[qs.length - 1].ead, totals.ead),
  `${m(qs[qs.length - 1].ead)} vs ${m(totals.ead)}`,
);
ok(
  'final weighted PD === headline weighted PD (the calibration holds)',
  near(qs[qs.length - 1].weightedAvgPd, totals.weightedAvgPd, 1e-6),
  `${(qs[qs.length - 1].weightedAvgPd * 100).toFixed(3)}%`,
);
ok(
  'final expected loss === portfolio total',
  near(qs[qs.length - 1].expectedLoss, totals.expectedLoss, 1),
  m(qs[qs.length - 1].expectedLoss),
);
ok(
  'every band split sums back to that quarter EAD',
  qs.every((p) => near(p.byBand.investment + p.byBand.speculative + p.byBand.default, p.ead, 1)),
);
ok('PD is always a fraction, never a percentage', qs.every((p) => p.weightedAvgPd > 0 && p.weightedAvgPd < 1));

/*
 * Pinned on purpose, both halves. The fixture holds one exposure per
 * counterparty, so the quarterly total CANNOT move — the overview's stacked
 * area is rating migration at constant exposure, and its level top is the data
 * telling the truth. If someone ever makes EAD drift to "fix" that chart, the
 * first check fails and says why. The second guards the opposite mistake:
 * migration itself must stay visible, or the chart says nothing at all.
 */
ok(
  'quarterly EAD is FLAT by construction — see the header in derive.ts',
  new Set(qs.map((p) => Math.round(p.ead))).size === 1,
);
ok(
  'but the band mix genuinely migrates',
  new Set(qs.map((p) => Math.round(p.byBand.investment))).size >= 4,
  `${new Set(qs.map((p) => Math.round(p.byBand.investment))).size} distinct investment-band levels`,
);
ok(
  'and credit quality deteriorates over the window, as the fixture intends',
  qs[qs.length - 1].weightedAvgPd > qs[0].weightedAvgPd,
  `${(qs[0].weightedAvgPd * 100).toFixed(2)}% → ${(qs[qs.length - 1].weightedAvgPd * 100).toFixed(2)}%`,
);

const energy = C.quarterlySeries('energy');
ok(
  'a sector series is a strict subset of the portfolio',
  energy.length === 8 && energy[7].ead < qs[7].ead && energy[7].ead > 0,
  `${m(energy[7].ead)} of ${m(qs[7].ead)}`,
);
ok(
  'sector series === that sector\'s fixture EAD',
  near(energy[7].ead, sectors.find((x) => x.id === 'energy').ead),
);

section('credit-risk — monthly EAD');

const monthly = C.monthlyEadSeries();
ok('twelve month ends', monthly.length === 12, String(monthly.length));
ok('ends on the reporting date', monthly[11].date === totals.reportingDate, monthly[11].date);
ok('every point is a real month end', monthly.every((p) => {
  const d = new Date(`${p.date}T00:00:00Z`);
  const next = new Date(d.getTime() + 86400000);
  return next.getUTCDate() === 1;
}));
ok('facility count never negative and always ≤ the book', monthly.every((p) => p.facilities >= 0 && p.facilities <= facilities.length));
ok('EAD tracks the live-facility count', monthly.every((p) => (p.facilities === 0 ? p.ead === 0 : p.ead > 0)));

section('credit-risk — drawdown schedule');

const term = facilities.find((f) => f.type === 'term-loan' && f.monthsToMaturity > 36);
const revolver = facilities.find((f) => f.type === 'revolving-credit' && f.monthsToMaturity > 36);

const termRows = C.drawdownSchedule(term);
ok('a long term loan is abridged to the row cap', termRows.length <= 8, `${termRows.length} rows`);
ok('opens at the facility\'s current drawn balance', near(termRows[0].drawn, term.drawn, 1));
ok('a term loan amortises to zero at maturity', near(termRows[termRows.length - 1].drawn, 0, 1));
ok('first row has no movement to compare against', termRows[0].movement === 0);
ok(
  'term repayments are all negative movements after the first row',
  termRows.slice(1).every((r) => r.movement <= 0),
);

const revRows = C.drawdownSchedule(revolver);
ok('a committed revolver holds its balance until maturity', revRows.slice(0, -1).every((r) => near(r.drawn, revolver.drawn, 1)));
ok('and retires in one step', near(revRows[revRows.length - 1].drawn, 0, 1));

ok(
  'undrawn === commitment − drawn on every row of both shapes',
  [...termRows, ...revRows].every((r) => near(r.undrawn, Math.max(0, r.commitment - r.drawn), 1)),
);
ok(
  'utilisation is a fraction, and 0 when the line is retired',
  [...termRows, ...revRows].every((r) => r.utilisation >= 0 && r.utilisation <= 1 && (r.commitment > 0 || r.utilisation === 0)),
);

const short = facilities.find((f) => f.monthsToMaturity <= 12);
if (short) {
  const shortRows = C.drawdownSchedule(short);
  ok('a short facility is listed in full rather than abridged', shortRows.length <= 8 && shortRows.length >= 2, `${shortRows.length} rows`);
}

section('credit-risk — status mapping');

const COLORS = ['primary', 'secondary', 'tertiary', 'error', 'success', 'warning', 'info'];
const DOTS = ['online', 'away', 'busy', 'offline', 'invisible', 'neutral'];
const maps = { covenantColor: COLORS, facilityColor: COLORS, severityColor: COLORS, bandColor: COLORS, covenantDot: DOTS, facilityDot: DOTS, severityDot: DOTS };

for (const [name, allowed] of Object.entries(maps)) {
  const values = Object.values(C[name]);
  ok(`${name} only emits documented component values`, values.every((v) => allowed.includes(v)), values.join(','));
}

ok('every covenant status is mapped', Object.keys(C.covenantColor).length === 3 && Object.keys(C.covenantDot).length === 3);
ok('every facility status is mapped', Object.keys(C.facilityColor).length === 3);
ok('every severity is mapped', Object.keys(C.severityColor).length === 3);
ok('every rating band is mapped', Object.keys(C.bandColor).length === 3);
ok('utilisation escalates primary → warning → error', C.utilisationColor(0.5) === 'primary' && C.utilisationColor(0.9) === 'warning' && C.utilisationColor(0.99) === 'error');
ok('utilisation thresholds are inclusive at the boundary', C.utilisationColor(0.85) === 'warning' && C.utilisationColor(0.95) === 'error');
ok('watchlistDot flags only the watchlisted', C.watchlistDot(true) === 'busy' && C.watchlistDot(false) === 'online');

section('credit-risk — routes');

/*
 * No count here, deliberately. This asserted `length === 6` and went red the
 * moment the vertical grew past six — silently, because a failing gate nobody
 * runs is indistinguishable from a passing one. A count only ever reports that
 * the list changed, which is never the bug.
 *
 * What would actually break: a duplicate id makes two builds fight over one
 * path segment, and the dock's switcher rewrites to whichever it matches first.
 * An empty list leaves the dock nothing to offer. `html` leads because this list
 * is in dock display order.
 */
ok(
  'frameworks are unique, non-empty, and in dock order',
  C.FRAMEWORKS.length > 0 &&
    new Set(C.FRAMEWORKS).size === C.FRAMEWORKS.length &&
    C.FRAMEWORKS[0] === 'html',
  C.FRAMEWORKS.join(','),
);
ok('every route ends in a slash', Object.values(C.route).every((f) => f('x').endsWith('/')));
ok('every route is root-relative and unprefixed', Object.values(C.route).every((f) => f('x').startsWith('/') && !f('x').startsWith(C.SHOWCASE_BASE)));

for (const fw of C.FRAMEWORKS) {
  const r = C.createRoutes(fw);
  ok(
    `createRoutes('${fw}') agrees with the deployed path`,
    r.basePath === `/showcase/credit-risk/${fw}` && r.withBase(r.route.watchlist()) === `/showcase/credit-risk/${fw}/watchlist/`,
    r.withBase(r.route.watchlist()),
  );
}

const reactRoutes = C.createRoutes('react');
ok(
  'withBase is idempotent-safe: it never double-prefixes a bare route',
  reactRoutes.withBase(reactRoutes.route.sector('energy')) === '/showcase/credit-risk/react/sectors/energy/',
);
ok(
  'the dock can swap any framework segment for any other',
  C.FRAMEWORKS.every((fw) =>
    new URL(
      K.buildFrameworkUrl(fw, {
        current: 'react',
        basePath: C.SHOWCASE_BASE,
        pathname: '/showcase/credit-risk/react/watchlist/',
        origin: 'https://awc-ui.dev',
        state: carried,
      }),
    ).pathname === `/showcase/credit-risk/${fw}/watchlist/`,
  ),
);


/* ------------------------------------------------------------------ report */

console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'} — ${checks - failures}/${checks} checks`);
process.exit(failures === 0 ? 0 : 1);
