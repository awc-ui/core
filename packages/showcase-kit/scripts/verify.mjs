/**
 * Round-trip checks over the built package.
 *
 * Run after `build`: pnpm --filter @awc-ui/showcase-kit verify
 * Exits non-zero on the first failed assertion.
 */
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const dist = resolve(here, '..', 'dist');
const load = (p) => import(pathToFileURL(join(dist, p)).href);

const D = await load('data/index.mjs');
const I = await load('i18n/index.mjs');
const P = await load('preboot/index.mjs');

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

const keys = Object.keys(I.en);
ok('en has a dictionary', keys.length > 200, `${keys.length} keys`);
ok('ro has exactly the same keys', Object.keys(I.ro).length === keys.length && keys.every((k) => k in I.ro));
ok('ar has exactly the same keys', Object.keys(I.ar).length === keys.length && keys.every((k) => k in I.ar));
// Identical strings are legitimate for acronyms (RWA, PD, DSCR), rating glyphs
// and pure placeholders — everything else must actually be translated.
const IDENTICAL_OK =
  /^(rating\.|table\.(id|pd|lgd|ead|rwa|rwaDelta|ccf|rating|sector|margin|type)$|kpi\.(expectedLossRatio|.*\.short)$|covenant\..*\.abbr$|dock\.(framework|accent)$|unit\.times$|common\.(na|total)$|screen\.counterparty\.title$)/;
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

/* ------------------------------------------------------------------ report */

console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'} — ${checks - failures}/${checks} checks`);
process.exit(failures === 0 ? 0 : 1);
