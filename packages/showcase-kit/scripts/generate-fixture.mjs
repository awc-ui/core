/**
 * Deterministic fixture generator for the credit-risk showcase.
 *
 * Run: pnpm --filter @awc-ui/showcase-kit generate:fixture
 *
 * Output: src/data/generated.ts — a baked, literal fixture. The generator uses a
 * seeded mulberry32 PRNG and a frozen reporting date, so re-running it produces
 * a byte-identical file. Nothing at runtime ever calls Math.random or Date.now.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'generated.ts');

const SEED = 0x5eed1a2b;
const REPORTING_DATE = '2026-03-31';
const REPORTING_QUARTER = '2026-Q1';
const REPORTING_MS = Date.UTC(2026, 2, 31);

/* ------------------------------------------------------------------- prng */

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(SEED);
/** Uniform float in [min, max). */
const uf = (min, max) => min + rnd() * (max - min);
/** Uniform integer in [min, max] inclusive. */
const ui = (min, max) => Math.floor(uf(min, max + 1));
const pick = (arr) => arr[ui(0, arr.length - 1)];
const chance = (p) => rnd() < p;

/* ---------------------------------------------------------------- helpers */

const r2 = (n) => Math.round(n * 100) / 100;
const r4 = (n) => Math.round(n * 10000) / 10000;
const r6 = (n) => Math.round(n * 1000000) / 1000000;
const sum = (arr, f) => r2(arr.reduce((a, x) => a + f(x), 0));

const pad = (n) => String(n).padStart(2, '0');
const iso = (ms) => {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};
/** Shift the frozen reporting date by whole days. */
const dayOffset = (days) => iso(REPORTING_MS + days * 86400000);
/** Shift the frozen reporting date by whole months, clamping the day of month. */
function monthOffset(months, day) {
  const base = new Date(REPORTING_MS);
  const y = base.getUTCFullYear();
  const m = base.getUTCMonth() + months;
  const targetDay = day ?? base.getUTCDate();
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return iso(Date.UTC(y, m, Math.min(targetDay, lastDay)));
}
const daysBetween = (isoA, isoB) =>
  Math.round((Date.parse(`${isoB}T00:00:00Z`) - Date.parse(`${isoA}T00:00:00Z`)) / 86400000);
function monthsFromReporting(isoDate) {
  const d = new Date(Date.parse(`${isoDate}T00:00:00Z`));
  const base = new Date(REPORTING_MS);
  let months =
    (d.getUTCFullYear() - base.getUTCFullYear()) * 12 + (d.getUTCMonth() - base.getUTCMonth());
  if (d.getUTCDate() < base.getUTCDate()) months -= 1;
  return months;
}

/* ----------------------------------------------------------- rating scale */

const RATING_SCALE = [
  { grade: 1, label: 'AAA', band: 'investment', pd: 0.0003 },
  { grade: 2, label: 'AA', band: 'investment', pd: 0.0006 },
  { grade: 3, label: 'A', band: 'investment', pd: 0.0015 },
  { grade: 4, label: 'BBB', band: 'investment', pd: 0.0042 },
  { grade: 5, label: 'BB', band: 'speculative', pd: 0.0135 },
  { grade: 6, label: 'B', band: 'speculative', pd: 0.034 },
  { grade: 7, label: 'CCC', band: 'speculative', pd: 0.091 },
  { grade: 8, label: 'CC', band: 'speculative', pd: 0.175 },
  { grade: 9, label: 'C', band: 'speculative', pd: 0.32 },
  { grade: 10, label: 'D', band: 'default', pd: 1 },
].map((g) => ({ ...g, bandKey: `ratingBand.${g.band}` }));

const gradeOf = (g) => RATING_SCALE[g - 1];

/* ----------------------------------------------------------------- sectors */

const SECTOR_IDS = [
  'real-estate',
  'manufacturing',
  'energy',
  'retail-trade',
  'technology',
  'healthcare',
  'transport',
];

const SECTOR_SCALE = {
  'real-estate': 1.25,
  manufacturing: 1.0,
  energy: 1.35,
  'retail-trade': 0.8,
  technology: 0.7,
  healthcare: 0.75,
  transport: 0.95,
};

/* --------------------------------------------------------------- FX rates */

/** Units of EUR per one unit of the key currency. Frozen, never fetched. */
const FX = { EUR: 1, USD: 0.92, GBP: 1.17, RON: 0.201, AED: 0.2505 };

/* ------------------------------------------------------------------ groups */

const GROUPS = [
  { id: 'grp-halden', name: 'Halden Holdings', parentCounterpartyId: 'cp-01' },
  { id: 'grp-nordwerk', name: 'Nordwerk Gruppe', parentCounterpartyId: 'cp-04' },
  { id: 'grp-auralis', name: 'Auralis Energy Group', parentCounterpartyId: 'cp-08' },
  { id: 'grp-cygnus', name: 'Cygnus Technology Group', parentCounterpartyId: 'cp-15' },
];

const MANAGERS = [
  'R. Ionescu',
  'M. Haddad',
  'L. Berger',
  'S. Novak',
  'J. Whitfield',
  'A. Okafor',
  'P. Lindqvist',
];

/* --------------------------------------------------------- counterparties */

/** Hand-authored spine: identity, sector, jurisdiction, grade, LGD, group. */
const SEEDS = [
  ['cp-01', 'Halden Property Group', 'real-estate', 'GB', 5, 0.4, false, 'grp-halden', null],
  ['cp-02', 'Kestrel Estates NV', 'real-estate', 'NL', 6, 0.45, true, 'grp-halden', 'cp-01'],
  ['cp-03', 'Marchetti Immobiliare SpA', 'real-estate', 'IT', 7, 0.5, true, null, null],
  ['cp-04', 'Nordwerk Industrie AG', 'manufacturing', 'DE', 3, 0.35, false, 'grp-nordwerk', null],
  ['cp-05', 'Vantera Precision BV', 'manufacturing', 'NL', 4, 0.4, false, 'grp-nordwerk', 'cp-04'],
  ['cp-06', 'Carpathia Steel SA', 'manufacturing', 'RO', 6, 0.45, true, null, null],
  ['cp-07', 'Belmont Tooling Ltd', 'manufacturing', 'GB', 5, 0.42, false, 'grp-nordwerk', 'cp-05'],
  ['cp-08', 'Auralis Power Holdings', 'energy', 'FR', 3, 0.3, false, 'grp-auralis', null],
  ['cp-09', 'Meridian Gas Partners', 'energy', 'US', 5, 0.38, false, 'grp-auralis', 'cp-08'],
  ['cp-10', 'Petrel Renewables Oy', 'energy', 'SE', 4, 0.35, false, 'grp-auralis', 'cp-08'],
  ['cp-11', 'Solvent Energie SA', 'energy', 'FR', 9, 0.55, true, null, null],
  ['cp-12', 'Fairhaven Retail Group', 'retail-trade', 'GB', 5, 0.45, false, null, null],
  ['cp-13', 'Bucur Market SRL', 'retail-trade', 'RO', 8, 0.5, true, null, null],
  ['cp-14', 'Nordkap Grocers AB', 'retail-trade', 'SE', 4, 0.4, false, null, null],
  ['cp-15', 'Cygnus Data Systems', 'technology', 'US', 2, 0.3, false, 'grp-cygnus', null],
  ['cp-16', 'Lumen Analytics GmbH', 'technology', 'DE', 4, 0.35, false, 'grp-cygnus', 'cp-15'],
  ['cp-17', 'Orbis Software NV', 'technology', 'NL', 6, 0.45, false, null, null],
  ['cp-18', 'Silvan Care Holdings', 'healthcare', 'DE', 3, 0.32, false, null, null],
  ['cp-19', 'Medistar Clinics Ltd', 'healthcare', 'GB', 5, 0.42, false, null, null],
  ['cp-20', 'Corvina Pharma SA', 'healthcare', 'ES', 6, 0.46, true, null, null],
  ['cp-21', 'Adriatic Freight Lines', 'transport', 'IT', 6, 0.48, false, null, null],
  ['cp-22', 'Vireo Logistics BV', 'transport', 'NL', 4, 0.38, false, null, null],
  ['cp-23', 'Kilnmore Rail Ltd', 'transport', 'GB', 1, 0.25, false, null, null],
  ['cp-24', 'Alcyon Shipping Ltd', 'transport', 'AE', 10, 0.62, true, null, null],
];

const COUNTRY_CCY = {
  AE: ['AED', 'USD'],
  DE: ['EUR'],
  ES: ['EUR'],
  FR: ['EUR'],
  GB: ['GBP', 'EUR'],
  IT: ['EUR'],
  NL: ['EUR'],
  RO: ['RON', 'EUR'],
  SE: ['EUR'],
  US: ['USD'],
};

/* ---------------------------------------------------- risk-weight function */

/**
 * Simplified, monotone illustrative risk weight. NOT a Basel IRB implementation
 * — it exists so the showcase has RWA numbers that move sensibly with PD/LGD.
 */
function riskWeight(pd, lgd) {
  const rw = 0.12 + 8.5 * Math.sqrt(pd) * (lgd / 0.45);
  return r4(Math.min(3, Math.max(0.15, rw)));
}

/* ------------------------------------------------------------- facilities */

const FACILITY_TYPES = ['term-loan', 'revolving-credit', 'trade-finance', 'guarantee'];
/** Credit conversion factor applied to the undrawn balance, by facility type. */
const CCF = {
  'term-loan': 0.5,
  'revolving-credit': 0.4,
  'trade-finance': 0.2,
  guarantee: 0.5,
};
const SECURED_ODDS = {
  'term-loan': 0.8,
  'revolving-credit': 0.4,
  'trade-finance': 0.55,
  guarantee: 0.2,
};
const UTILISATION_RANGE = {
  'term-loan': [0.82, 1.0],
  'revolving-credit': [0.2, 0.86],
  'trade-finance': [0.35, 0.9],
  guarantee: [0.45, 0.95],
};

const COVENANT_DEFS = {
  dscr: { direction: 'min', base: [1.15, 1.4] },
  'net-leverage': { direction: 'max', base: [2.75, 4.5] },
  'interest-cover': { direction: 'min', base: [2.0, 3.5] },
};

const COLLATERAL_BY_SECTOR = {
  'real-estate': ['real-estate', 'real-estate', 'securities'],
  manufacturing: ['equipment', 'inventory', 'receivables'],
  energy: ['equipment', 'securities', 'cash-deposit'],
  'retail-trade': ['inventory', 'receivables', 'real-estate'],
  technology: ['receivables', 'securities', 'cash-deposit'],
  healthcare: ['real-estate', 'equipment', 'receivables'],
  transport: ['equipment', 'equipment', 'receivables'],
};
const HAIRCUT = {
  'real-estate': [0.25, 0.4],
  receivables: [0.2, 0.35],
  inventory: [0.4, 0.6],
  'cash-deposit': [0.0, 0.05],
  equipment: [0.3, 0.5],
  securities: [0.08, 0.25],
};
const VALUATION_BASIS = ['appraisal', 'mark-to-market', 'internal-model'];

const SIGNAL_TYPES = [
  'covenant-breach',
  'rating-downgrade',
  'payment-delay',
  'utilisation-spike',
  'market-spread',
  'adverse-news',
  'audit-qualification',
];

/* ------------------------------------------------------------------ build */

const counterparties = [];
const facilities = [];
const covenants = [];
const collateral = [];
const ratingHistory = [];
const watchlist = [];

let facSeq = 0;
let covSeq = 0;
let colSeq = 0;
let sigSeq = 0;

for (const [id, legalName, sectorId, country, grade, lgd, watch, groupId, parentId] of SEEDS) {
  const g = gradeOf(grade);
  // Idiosyncratic PD tilt around the grade anchor, capped at 1 for grade 10.
  const pd = grade === 10 ? 1 : r6(Math.min(0.95, g.pd * uf(0.85, 1.22)));
  const scale = SECTOR_SCALE[sectorId];
  const facCount = ui(1, 4);
  const currencies = COUNTRY_CCY[country];

  const own = [];
  for (let f = 0; f < facCount; f++) {
    facSeq += 1;
    const fid = `fac-${String(facSeq).padStart(3, '0')}`;
    const type = f === 0 ? pick(['term-loan', 'revolving-credit']) : pick(FACILITY_TYPES);
    const currency = f === 0 ? currencies[0] : pick(currencies);
    const rate = FX[currency];
    // Commitment sized in EUR, then expressed in the facility currency.
    // Weaker grades carry smaller books — banks cap appetite as quality falls.
    const gradeFactor = Math.pow(0.9, grade - 1);
    const commitmentEurRaw =
      uf(18e6, 210e6) * scale * gradeFactor * (type === 'guarantee' ? 0.45 : 1);
    const commitment = Math.round(commitmentEurRaw / rate / 1e5) * 1e5;
    const commitmentEur = r2(commitment * rate);
    const [lo, hi] = UTILISATION_RANGE[type];
    const utilisation = r4(uf(lo, hi));
    const drawn = r2(commitment * utilisation);
    const undrawn = r2(commitment - drawn);
    const drawnEur = r2(drawn * rate);
    const undrawnEur = r2(undrawn * rate);
    const ccf = CCF[type];
    const ead = r2(drawnEur + ccf * undrawnEur);
    const termMonths = type === 'term-loan' ? ui(14, 84) : ui(5, 42);
    const maturityDate = monthOffset(termMonths, ui(1, 28));
    const originationDate = monthOffset(-ui(8, 72), ui(1, 28));
    const marginBps = Math.round((90 + grade * 42 + uf(-30, 55)) / 5) * 5;
    const secured = chance(SECURED_ODDS[type]);

    own.push({
      id: fid,
      counterpartyId: id,
      counterpartyName: legalName,
      type,
      typeKey: `facilityType.${type}`,
      currency,
      commitment: r2(commitment),
      drawn,
      undrawn,
      commitmentEur,
      drawnEur,
      undrawnEur,
      ead,
      ccf,
      utilisation,
      maturityDate,
      monthsToMaturity: monthsFromReporting(maturityDate),
      marginBps,
      secured,
      status: 'performing',
      originationDate,
      covenantCount: 0,
      collateralCount: 0,
      _sectorId: sectorId,
    });
  }

  // --- covenants: 1..3 per facility -------------------------------------
  for (const fac of own) {
    const names = ['dscr', 'net-leverage', 'interest-cover'];
    const n = ui(1, 3);
    // Rotate the start so the mix varies, then restore canonical name order.
    const start = ui(0, 2);
    const chosen = names
      .map((_, i) => names[(start + i) % 3])
      .slice(0, n)
      .sort((a, b) => names.indexOf(a) - names.indexOf(b));
    for (const name of chosen) {
      covSeq += 1;
      const def = COVENANT_DEFS[name];
      const threshold = r2(uf(def.base[0], def.base[1]));
      // Weaker grades sit closer to (or through) the threshold.
      const stress = Math.pow((grade - 1) / 9, 1.6);
      const headroom = r4(uf(0.05, 0.6) - stress * 0.44);
      const currentValue =
        def.direction === 'min'
          ? r2(threshold * (1 + headroom))
          : r2(threshold * (1 - headroom));
      const realHeadroom =
        def.direction === 'min'
          ? r4((currentValue - threshold) / threshold)
          : r4((threshold - currentValue) / threshold);
      const status = realHeadroom < 0 ? 'breach' : realHeadroom < 0.1 ? 'watch' : 'compliant';
      covenants.push({
        id: `cov-${String(covSeq).padStart(3, '0')}`,
        facilityId: fac.id,
        counterpartyId: id,
        name,
        nameKey: `covenant.${name}`,
        direction: def.direction,
        threshold,
        currentValue,
        headroomPct: realHeadroom,
        status,
        testDate: REPORTING_DATE,
        nextTestDate: monthOffset(3, 30),
        frequencyKey: 'frequency.quarterly',
      });
      fac.covenantCount += 1;
    }

    // --- collateral: 1..2 items per secured facility ---------------------
    if (fac.secured) {
      const types = COLLATERAL_BY_SECTOR[sectorId];
      const n2 = ui(1, 2);
      for (let c = 0; c < n2; c++) {
        colSeq += 1;
        const ctype = types[c % types.length];
        const rate = FX[fac.currency];
        const cover = uf(0.55, 1.35);
        const valuation = Math.round((fac.commitment * cover) / 1e5) * 1e5;
        const valuationEur = r2(valuation * rate);
        const [hlo, hhi] = HAIRCUT[ctype];
        const haircutPct = r4(uf(hlo, hhi));
        collateral.push({
          id: `col-${String(colSeq).padStart(3, '0')}`,
          facilityId: fac.id,
          counterpartyId: id,
          type: ctype,
          typeKey: `collateralType.${ctype}`,
          currency: fac.currency,
          valuation: r2(valuation),
          valuationEur,
          haircutPct,
          netValue: r2(valuationEur * (1 - haircutPct)),
          lastValuationDate: monthOffset(-ui(1, 20), ui(1, 28)),
          valuationBasisKey: `valuationBasis.${pick(VALUATION_BASIS)}`,
        });
        fac.collateralCount += 1;
      }
    }

    // --- facility status --------------------------------------------------
    const breached = covenants.some((c) => c.facilityId === fac.id && c.status === 'breach');
    fac.status = grade >= 9 ? 'impaired' : breached || watch ? 'watch' : 'performing';
  }

  const limit = sum(own, (f) => f.commitmentEur);
  const drawn = sum(own, (f) => f.drawnEur);
  const undrawn = sum(own, (f) => f.undrawnEur);
  const ead = sum(own, (f) => f.ead);
  const expectedLoss = r2(ead * pd * lgd);
  const rw = riskWeight(pd, lgd);
  const rwa = r2(ead * rw);

  counterparties.push({
    id,
    legalName,
    sectorId,
    country,
    grade,
    ratingLabel: g.label,
    ratingBand: g.band,
    pd,
    lgd,
    ead,
    limit,
    drawn,
    undrawn,
    utilisation: r4(drawn / limit),
    expectedLoss,
    rwa,
    rwaDensity: r4(rwa / ead),
    watchlist: watch,
    groupId,
    isGroupParent: GROUPS.some((gr) => gr.parentCounterpartyId === id),
    parentId,
    facilityCount: own.length,
    signalCount: 0,
    relationshipManager: pick(MANAGERS),
    onboardedDate: monthOffset(-ui(24, 168), ui(1, 28)),
    lastReviewDate: monthOffset(-ui(1, 11), ui(1, 28)),
    nextReviewDate: monthOffset(ui(1, 12), ui(1, 28)),
  });

  for (const f of own) {
    delete f._sectorId;
    facilities.push(f);
  }

  // --- rating history: 8 quarters ending at the reporting quarter --------
  const quarters = [
    ['2024-Q2', '2024-06-30'],
    ['2024-Q3', '2024-09-30'],
    ['2024-Q4', '2024-12-31'],
    ['2025-Q1', '2025-03-31'],
    ['2025-Q2', '2025-06-30'],
    ['2025-Q3', '2025-09-30'],
    ['2025-Q4', '2025-12-31'],
    [REPORTING_QUARTER, REPORTING_DATE],
  ];
  // Walk backwards from today's grade so the series lands exactly on it.
  const path = new Array(8);
  path[7] = grade;
  for (let i = 6; i >= 0; i--) {
    const drift = chance(watch || grade >= 7 ? 0.55 : 0.25) ? (chance(0.75) ? -1 : 1) : 0;
    path[i] = Math.min(10, Math.max(1, path[i + 1] + drift));
  }
  for (let i = 0; i < 8; i++) {
    const og = gradeOf(path[i]);
    ratingHistory.push({
      counterpartyId: id,
      quarter: quarters[i][0],
      date: quarters[i][1],
      grade: path[i],
      label: og.label,
      pd: og.pd,
    });
  }
}

/* ------------------------------------------------- early-warning signals */

const cpById = new Map(counterparties.map((c) => [c.id, c]));
for (const cp of counterparties) {
  if (!cp.watchlist) continue;
  const n = ui(1, 3);
  const used = new Set();
  for (let i = 0; i < n; i++) {
    sigSeq += 1;
    let type = pick(SIGNAL_TYPES);
    let guard = 0;
    while (used.has(type) && guard++ < 12) type = pick(SIGNAL_TYPES);
    used.add(type);
    const severity = cp.grade >= 8 ? (chance(0.7) ? 'high' : 'medium') : pick(['high', 'medium', 'low']);
    const openedDate = dayOffset(-ui(9, 260));
    watchlist.push({
      id: `ews-${String(sigSeq).padStart(3, '0')}`,
      counterpartyId: cp.id,
      counterpartyName: cp.legalName,
      sectorId: cp.sectorId,
      grade: cp.grade,
      ratingLabel: cp.ratingLabel,
      ead: cp.ead,
      type,
      typeKey: `signal.${type}`,
      severity,
      severityKey: `severity.${severity}`,
      openedDate,
      daysOpen: daysBetween(openedDate, REPORTING_DATE),
      owner: pick(MANAGERS),
    });
    cp.signalCount += 1;
  }
}
const SEV_ORDER = { high: 0, medium: 1, low: 2 };
watchlist.sort(
  (a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity] || b.ead - a.ead || a.id.localeCompare(b.id),
);

/* ---------------------------------------------------------------- sectors */

const portfolioEad = sum(counterparties, (c) => c.ead);
const sectors = SECTOR_IDS.map((sectorId) => {
  const members = counterparties.filter((c) => c.sectorId === sectorId);
  const ead = sum(members, (c) => c.ead);
  const limit = sum(members, (c) => c.limit);
  const drawn = sum(members, (c) => c.drawn);
  return {
    id: sectorId,
    nameKey: `sector.${sectorId}`,
    counterpartyCount: members.length,
    facilityCount: members.reduce((a, c) => a + c.facilityCount, 0),
    limit,
    drawn,
    undrawn: sum(members, (c) => c.undrawn),
    ead,
    expectedLoss: sum(members, (c) => c.expectedLoss),
    rwa: sum(members, (c) => c.rwa),
    weightedAvgPd: r6(members.reduce((a, c) => a + c.ead * c.pd, 0) / ead),
    weightedAvgLgd: r6(members.reduce((a, c) => a + c.ead * c.lgd, 0) / ead),
    utilisation: r4(drawn / limit),
    portfolioShare: r4(ead / portfolioEad),
  };
});

/* ----------------------------------------------------------------- groups */

const groups = GROUPS.map((g) => ({
  ...g,
  memberIds: [
    g.parentCounterpartyId,
    ...counterparties
      .filter((c) => c.groupId === g.id && c.id !== g.parentCounterpartyId)
      .map((c) => c.id),
  ],
}));

/* ------------------------------------------------------ stress scenarios */

const SCENARIO_DEFS = [
  { id: 'baseline', pdMultiplier: 1, lgdUplift: 0 },
  { id: 'adverse', pdMultiplier: 1.85, lgdUplift: 0.06 },
  { id: 'severe', pdMultiplier: 3.4, lgdUplift: 0.14 },
];

function stressCounterparty(cp, def) {
  const pd = Math.min(1, r6(cp.pd * def.pdMultiplier));
  const lgd = Math.min(1, r4(cp.lgd + def.lgdUplift));
  const expectedLoss = r2(cp.ead * pd * lgd);
  const rwa = r2(cp.ead * riskWeight(pd, lgd));
  return { ead: cp.ead, pd, lgd, expectedLoss, rwa };
}

const baselineBySector = new Map();
const baselineTotals = { expectedLoss: 0, rwa: 0 };

const scenarios = SCENARIO_DEFS.map((def) => {
  const stressed = counterparties.map((cp) => ({ cp, s: stressCounterparty(cp, def) }));
  const bySector = SECTOR_IDS.map((sectorId) => {
    const rows = stressed.filter((r) => r.cp.sectorId === sectorId);
    const ead = sum(rows, (r) => r.s.ead);
    const expectedLoss = sum(rows, (r) => r.s.expectedLoss);
    const rwa = sum(rows, (r) => r.s.rwa);
    if (def.id === 'baseline') baselineBySector.set(sectorId, { expectedLoss, rwa });
    const base = baselineBySector.get(sectorId);
    return {
      sectorId,
      ead,
      weightedAvgPd: r6(rows.reduce((a, r) => a + r.s.ead * r.s.pd, 0) / ead),
      weightedAvgLgd: r6(rows.reduce((a, r) => a + r.s.ead * r.s.lgd, 0) / ead),
      expectedLoss,
      rwa,
      expectedLossDelta: r2(expectedLoss - base.expectedLoss),
      rwaDelta: r2(rwa - base.rwa),
    };
  });
  const ead = sum(bySector, (s) => s.ead);
  const expectedLoss = sum(bySector, (s) => s.expectedLoss);
  const rwa = sum(bySector, (s) => s.rwa);
  if (def.id === 'baseline') {
    baselineTotals.expectedLoss = expectedLoss;
    baselineTotals.rwa = rwa;
  }
  return {
    id: def.id,
    nameKey: `scenario.${def.id}`,
    descriptionKey: `scenario.${def.id}.description`,
    pdMultiplier: def.pdMultiplier,
    lgdUplift: def.lgdUplift,
    totals: {
      ead,
      expectedLoss,
      rwa,
      weightedAvgPd: r6(stressed.reduce((a, r) => a + r.s.ead * r.s.pd, 0) / ead),
      weightedAvgLgd: r6(stressed.reduce((a, r) => a + r.s.ead * r.s.lgd, 0) / ead),
      expectedLossDelta: r2(expectedLoss - baselineTotals.expectedLoss),
      rwaDelta: r2(rwa - baselineTotals.rwa),
      rwaDensity: r4(rwa / ead),
    },
    bySector,
  };
});

/* -------------------------------------------------------- portfolio totals */

const limit = sum(counterparties, (c) => c.limit);
const drawn = sum(counterparties, (c) => c.drawn);
const ead = sum(counterparties, (c) => c.ead);
const expectedLoss = sum(counterparties, (c) => c.expectedLoss);
const rwa = sum(counterparties, (c) => c.rwa);
const collateralNetValue = sum(collateral, (c) => c.netValue);

const totals = {
  reportingDate: REPORTING_DATE,
  reportingQuarter: REPORTING_QUARTER,
  currency: 'EUR',
  counterpartyCount: counterparties.length,
  facilityCount: facilities.length,
  covenantCount: covenants.length,
  collateralCount: collateral.length,
  groupCount: groups.length,
  limit,
  drawn,
  undrawn: sum(counterparties, (c) => c.undrawn),
  ead,
  expectedLoss,
  rwa,
  weightedAvgPd: r6(counterparties.reduce((a, c) => a + c.ead * c.pd, 0) / ead),
  weightedAvgLgd: r6(counterparties.reduce((a, c) => a + c.ead * c.lgd, 0) / ead),
  utilisation: r4(drawn / limit),
  rwaDensity: r4(rwa / ead),
  expectedLossRatio: r6(expectedLoss / ead),
  collateralNetValue,
  secureCoverage: r4(collateralNetValue / ead),
  watchlistCount: counterparties.filter((c) => c.watchlist).length,
  watchlistEad: sum(counterparties.filter((c) => c.watchlist), (c) => c.ead),
  signalCount: watchlist.length,
  covenantBreachCount: covenants.filter((c) => c.status === 'breach').length,
  covenantWatchCount: covenants.filter((c) => c.status === 'watch').length,
  impairedEad: sum(counterparties.filter((c) => c.grade >= 8), (c) => c.ead),
};

/* ------------------------------------------------------------------ emit */

const j = (v) => JSON.stringify(v, null, 2);

const file = `/* eslint-disable */
/**
 * GENERATED FILE — do not edit by hand.
 *
 * Produced by \`scripts/generate-fixture.mjs\` with seed 0x${SEED.toString(16)} and the frozen
 * reporting date ${REPORTING_DATE}. Re-running the generator reproduces this file byte for byte.
 */
import type {
  Collateral,
  Counterparty,
  CreditRiskFixture,
  Facility,
  Covenant,
  Group,
  PortfolioTotals,
  RatingGrade,
  RatingObservation,
  Sector,
  StressScenario,
  WatchlistSignal,
  FacilityCurrency,
} from './types';

export const FX_RATES: Record<FacilityCurrency, number> = ${j(FX)};

export const RATING_SCALE: readonly RatingGrade[] = ${j(RATING_SCALE)};

export const SECTORS: readonly Sector[] = ${j(sectors)};

export const COUNTERPARTIES: readonly Counterparty[] = ${j(counterparties)};

export const FACILITIES: readonly Facility[] = ${j(facilities)};

export const COVENANTS: readonly Covenant[] = ${j(covenants)};

export const COLLATERAL: readonly Collateral[] = ${j(collateral)};

export const RATING_HISTORY: readonly RatingObservation[] = ${j(ratingHistory)};

export const WATCHLIST: readonly WatchlistSignal[] = ${j(watchlist)};

export const GROUPS: readonly Group[] = ${j(groups)};

export const SCENARIOS: readonly StressScenario[] = ${j(scenarios)};

export const TOTALS: PortfolioTotals = ${j(totals)};

export const FIXTURE: CreditRiskFixture = {
  reportingDate: '${REPORTING_DATE}',
  reportingQuarter: '${REPORTING_QUARTER}',
  baseCurrency: 'EUR',
  fxRates: FX_RATES,
  totals: TOTALS,
  ratingScale: RATING_SCALE as RatingGrade[],
  sectors: SECTORS as Sector[],
  counterparties: COUNTERPARTIES as Counterparty[],
  facilities: FACILITIES as Facility[],
  covenants: COVENANTS as Covenant[],
  collateral: COLLATERAL as Collateral[],
  ratingHistory: RATING_HISTORY as RatingObservation[],
  watchlist: WATCHLIST as WatchlistSignal[],
  groups: GROUPS as Group[],
  scenarios: SCENARIOS as StressScenario[],
};
`;

writeFileSync(OUT, file, 'utf8');

console.log(`wrote ${OUT}`);
console.log(
  `  counterparties=${counterparties.length} facilities=${facilities.length} covenants=${covenants.length} collateral=${collateral.length} history=${ratingHistory.length} signals=${watchlist.length}`,
);
console.log(
  `  EAD=${(totals.ead / 1e9).toFixed(3)}bn EL=${(totals.expectedLoss / 1e6).toFixed(1)}m RWA=${(totals.rwa / 1e9).toFixed(3)}bn wPD=${(totals.weightedAvgPd * 100).toFixed(2)}%`,
);
console.log(
  `  breaches=${totals.covenantBreachCount} watch=${totals.covenantWatchCount} watchlistCPs=${totals.watchlistCount}`,
);
