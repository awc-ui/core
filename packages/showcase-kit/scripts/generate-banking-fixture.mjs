/**
 * Deterministic fixture generator for the consumer-banking showcase.
 *
 * Run: pnpm --filter @awc-ui/showcase-kit generate:banking
 *
 * Output: src/banking/generated.ts — a baked, literal fixture. Same contract as
 * the two generators next door: a seeded mulberry32 PRNG and a frozen reporting
 * date, so re-running it produces a byte-identical file. Nothing at runtime ever
 * calls Math.random or Date.now, and every date is built with Date.UTC — the
 * ambient time zone of the machine that runs this never reaches the output.
 *
 * WHAT MAKES THIS ONE DIFFERENT: the statement is the source of truth.
 *
 * The other two fixtures pick balances and then describe them. Here the
 * transactions are generated first and every balance is DERIVED from them — an
 * account's opening balance is back-solved from a chosen closing balance minus
 * the twelve months of movement, so the statement genuinely adds up to the
 * number on the home screen. That matters because this vertical puts a running
 * balance, a month's spending and a category breakdown on three different
 * screens, and a reader can add them up.
 *
 * Every invariant is asserted at the bottom rather than hoped for. A generator
 * that silently emits a book that does not balance is worse than one that
 * throws.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'banking', 'generated.ts');

const SEED = 0x5eed3b91;
const REPORTING_DATE = '2026-08-31';
const REPORTING_MONTH = '2026-08';
const REPORTING_MS = Date.UTC(2026, 7, 31);
const STATEMENT_MONTHS = 12;
const PRICE_HISTORY_DAYS = 90;
const RATE_HISTORY_DAYS = 90;

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
const uf = (min, max) => min + rnd() * (max - min);
const ui = (min, max) => Math.floor(uf(min, max + 1));
const pick = (arr) => arr[ui(0, arr.length - 1)];
const chance = (p) => rnd() < p;
/** Approximately normal via the mean of four uniforms (Bates), bounded at ±2σ. */
const normal = (mean, sd) => mean + (uf(-1, 1) + uf(-1, 1) + uf(-1, 1) + uf(-1, 1)) * 0.5 * sd;

/* ---------------------------------------------------------------- helpers */

const r2 = (n) => Math.round(n * 100) / 100;
const r4 = (n) => Math.round(n * 10000) / 10000;
const r6 = (n) => Math.round(n * 1000000) / 1000000;
const r8 = (n) => Math.round(n * 1e8) / 1e8;
const sum2 = (arr, f) => r2(arr.reduce((a, x) => a + f(x), 0));

const pad = (n) => String(n).padStart(2, '0');
const iso = (ms) => {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};
const dayOffset = (days) => iso(REPORTING_MS + days * 86400000);
/** `YYYY-MM` of an ISO calendar date. */
const monthOf = (isoDate) => isoDate.slice(0, 7);
/** Month-end ISO date `n` whole months before the reporting month end. */
function monthEndBack(n) {
  const base = new Date(REPORTING_MS);
  return iso(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - n + 1, 0));
}
/** First day of the month `n` whole months back. */
function monthStartBack(n) {
  const base = new Date(REPORTING_MS);
  return iso(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - n, 1));
}
/** A UTC instant inside a calendar date, at a plausible hour. */
const stampOn = (isoDate) =>
  `${isoDate}T${pad(ui(7, 22))}:${pad(ui(0, 59))}:${pad(ui(0, 59))}Z`;

/** Two initials from a name, for md-avatar. */
function initialsOf(name) {
  const parts = name.replace(/[^\p{L}\s]/gu, ' ').trim().split(/\s+/);
  const a = parts[0]?.[0] ?? '';
  const b = parts.length > 1 ? parts[parts.length - 1][0] : (parts[0]?.[1] ?? '');
  return (a + b).toUpperCase();
}

/* -------------------------------------------------------------------- fx */

/** Units of EUR per one unit of the key currency. Frozen. */
const FX_RATES = { EUR: 1, USD: 0.92, GBP: 1.17, RON: 0.201 };
const toEur = (amount, currency) => r2(amount * FX_RATES[currency]);

/* --------------------------------------------------------------- profile */

const PROFILE = {
  id: 'usr-01',
  name: 'Ana Ilves',
  initials: initialsOf('Ana Ilves'),
  plan: 'metal',
  planKey: 'banking.plan.metal',
  memberSince: '2021-03-14',
  country: 'RO',
  baseCurrency: 'EUR',
};

/* -------------------------------------------------------------- accounts */

/**
 * Five accounts. The closing balances here are TARGETS — the opening balance is
 * back-solved once the statement exists, so what the home screen shows is the
 * statement's own arithmetic rather than a number sitting beside it.
 */
const ACCOUNT_SPECS = [
  { id: 'acc-eur', kind: 'current', currency: 'EUR', nickname: 'Everyday', primary: true, target: 4218.64, iban: 'RO49 VELA 1B31 0075 9384 0000' },
  { id: 'acc-gbp', kind: 'current', currency: 'GBP', nickname: 'London', primary: false, target: 1164.2, iban: 'GB29 VELA 6016 1331 9268 19' },
  { id: 'acc-usd', kind: 'current', currency: 'USD', nickname: 'Travel USD', primary: false, target: 742.85, iban: 'US64 VELA 0000 0000 5947 21' },
  { id: 'acc-sav', kind: 'savings', currency: 'EUR', nickname: 'Rainy day', primary: false, target: 9600, iban: 'RO49 VELA 1B31 0075 9384 0001', interestRate: 0.0285 },
  { id: 'acc-vault', kind: 'vault', currency: 'EUR', nickname: 'Japan 2027', primary: false, target: 2340, iban: 'RO49 VELA 1B31 0075 9384 0002', goalName: 'Japan 2027', goalTarget: 6000 },
];

/* ----------------------------------------------------------------- cards */

const CARD_SPECS = [
  { id: 'card-01', accountId: 'acc-eur', kind: 'physical', network: 'visa', last4: '4417', state: 'active', label: 'Everyday', monthlyLimit: 2500, contactless: true, onlinePayments: true, atmWithdrawals: true, regeneratesAfterUse: false },
  { id: 'card-02', accountId: 'acc-eur', kind: 'virtual', network: 'mastercard', last4: '0932', state: 'active', label: 'Online only', monthlyLimit: 600, contactless: false, onlinePayments: true, atmWithdrawals: false, regeneratesAfterUse: false },
  { id: 'card-03', accountId: 'acc-gbp', kind: 'physical', network: 'visa', last4: '7205', state: 'frozen', label: 'London', monthlyLimit: null, contactless: true, onlinePayments: true, atmWithdrawals: true, regeneratesAfterUse: false },
  { id: 'card-04', accountId: 'acc-eur', kind: 'disposable', network: 'mastercard', last4: '8861', state: 'active', label: 'Single use', monthlyLimit: 200, contactless: false, onlinePayments: true, atmWithdrawals: false, regeneratesAfterUse: true },
  { id: 'card-05', accountId: 'acc-usd', kind: 'virtual', network: 'visa', last4: '3390', state: 'blocked', label: 'Old travel', monthlyLimit: null, contactless: false, onlinePayments: false, atmWithdrawals: false, regeneratesAfterUse: false },
];

/* ------------------------------------------------------------- merchants */

/** Invented names. Proper nouns live here and are deliberately not translated. */
const MERCHANT_SPECS = [
  ['mer-01', 'Piața Verde', 'groceries', 'RO', [14, 62]],
  ['mer-02', 'Nordmarkt', 'groceries', 'DE', [18, 74]],
  ['mer-03', 'Coopérative Bio', 'groceries', 'FR', [11, 48]],
  ['mer-04', 'Tramline', 'transport', 'RO', [2, 9]],
  ['mer-05', 'Northgate Rail', 'transport', 'GB', [8, 46]],
  ['mer-06', 'Velo Share', 'transport', 'NL', [3, 14]],
  ['mer-07', 'Kestrel Air', 'travel', 'GB', [64, 340]],
  ['mer-08', 'Hotel Marisol', 'travel', 'ES', [88, 260]],
  ['mer-09', 'Casa Lentă', 'eatingOut', 'RO', [16, 72]],
  ['mer-10', 'Bar Umbrella', 'eatingOut', 'ES', [9, 44]],
  ['mer-11', 'Noodle Yard', 'eatingOut', 'GB', [11, 38]],
  ['mer-12', 'Kaffee Sechs', 'eatingOut', 'DE', [3, 11]],
  ['mer-13', 'Halden Home', 'shopping', 'NL', [22, 180]],
  ['mer-14', 'Turnstile Books', 'shopping', 'GB', [8, 42]],
  ['mer-15', 'Atelier Fold', 'shopping', 'FR', [35, 220]],
  ['mer-16', 'Pixel Forge', 'entertainment', 'US', [9, 60]],
  ['mer-17', 'Lumen Cinema', 'entertainment', 'RO', [11, 34]],
  ['mer-18', 'Orbit Audio', 'entertainment', 'US', [10, 11]],
  ['mer-19', 'Vantage Energy', 'bills', 'RO', [48, 132]],
  ['mer-20', 'Meridian Telecom', 'bills', 'RO', [19, 26]],
  ['mer-21', 'Aquaflow', 'bills', 'RO', [14, 38]],
  ['mer-22', 'Clarity Dental', 'health', 'RO', [45, 210]],
  ['mer-23', 'Farmacia Iris', 'health', 'RO', [7, 44]],
  ['mer-24', 'Ridgeline Gym', 'health', 'RO', [39, 40]],
  ['mer-25', 'Stellar Cloud', 'bills', 'US', [8, 9]],
  ['mer-26', 'Foldspace', 'bills', 'US', [12, 13]],
];

const MERCHANTS = MERCHANT_SPECS.map(([id, name, category, country]) => ({
  id,
  name,
  category,
  categoryKey: `banking.category.${category}`,
  country,
  initials: initialsOf(name),
}));
const MERCHANT_RANGE = new Map(MERCHANT_SPECS.map(([id, , , , range]) => [id, range]));
const merchantsIn = (category) => MERCHANT_SPECS.filter((m) => m[2] === category).map((m) => m[0]);

/* ---------------------------------------------------------- subscriptions */

/** Recurring charges, and the merchants they belong to. */
const SUBSCRIPTION_SPECS = [
  { id: 'sub-01', merchantId: 'mer-18', amount: 10.99, currency: 'EUR', cadence: 'monthly', day: 4, active: true, cardId: 'card-02' },
  { id: 'sub-02', merchantId: 'mer-25', amount: 8.5, currency: 'USD', cadence: 'monthly', day: 12, active: true, cardId: 'card-02' },
  { id: 'sub-03', merchantId: 'mer-26', amount: 12.0, currency: 'USD', cadence: 'monthly', day: 19, active: true, cardId: 'card-02' },
  { id: 'sub-04', merchantId: 'mer-24', amount: 39.0, currency: 'EUR', cadence: 'monthly', day: 2, active: true, cardId: 'card-01' },
  { id: 'sub-05', merchantId: 'mer-20', amount: 22.9, currency: 'EUR', cadence: 'monthly', day: 8, active: true, cardId: null },
  { id: 'sub-06', merchantId: 'mer-16', amount: 59.0, currency: 'EUR', cadence: 'yearly', day: 21, active: false, cardId: 'card-02' },
];

/* ---------------------------------------------------------- instruments */

/**
 * Ten instruments: six equities, two ETFs, two crypto.
 *
 * Deliberately consumer-scale and consumer-shaped — tickers a retail app would
 * carry, not an institutional universe. All invented.
 */
const INSTRUMENT_SPECS = [
  ['ins-01', 'NVLT', 'Novalight Systems', 'stock', 'USD', 184.2, 'technology'],
  ['ins-02', 'HLDN', 'Halden Retail Group', 'stock', 'EUR', 42.85, 'consumer'],
  ['ins-03', 'ORBT', 'Orbit Audio', 'stock', 'USD', 61.4, 'communications'],
  ['ins-04', 'VNTG', 'Vantage Energy', 'stock', 'EUR', 27.6, 'energy'],
  ['ins-05', 'MRDN', 'Meridian Telecom', 'stock', 'EUR', 14.35, 'communications'],
  ['ins-06', 'CLRT', 'Clarity Health', 'stock', 'GBP', 33.1, 'health'],
  ['ins-07', 'GLBE', 'Globe Index ETF', 'etf', 'EUR', 96.7, 'diversified'],
  ['ins-08', 'TECX', 'Tech 100 ETF', 'etf', 'USD', 148.9, 'technology'],
  ['ins-09', 'BTC', 'Bitcoin', 'crypto', 'EUR', 58420.0, null],
  ['ins-10', 'ETH', 'Ethereum', 'crypto', 'EUR', 3184.5, null],
];

/* ------------------------------------------------------------- fx pairs */

const PAIR_SPECS = [
  ['fx-eurusd', 'EUR', 'USD', 0.0, 12],
  ['fx-eurgbp', 'EUR', 'GBP', 0.0, 10],
  ['fx-eurron', 'EUR', 'RON', 0.0, 18],
  ['fx-gbpusd', 'GBP', 'USD', 0.004, 14],
  ['fx-usdron', 'USD', 'RON', 0.004, 22],
  ['fx-gbpron', 'GBP', 'RON', 0.004, 24],
];

/* =========================================================== GENERATION == */

/* ---------------------------------------------------------- instruments */

const instruments = INSTRUMENT_SPECS.map(([id, ticker, name, kind, currency, price, sector]) => {
  // Walk BACKWARDS from today's price so the last history point is the price
  // itself — a chart whose right edge disagrees with the figure beside it is
  // the first thing a reader notices.
  const vol = kind === 'crypto' ? 0.031 : kind === 'etf' ? 0.007 : 0.013;
  const drift = normal(0.0006, 0.0004);
  const history = [];
  let p = price;
  for (let i = 0; i < PRICE_HISTORY_DAYS; i += 1) {
    history.push({ date: dayOffset(-i), price: kind === 'crypto' ? r2(p) : r2(p) });
    p = p / (1 + normal(drift, vol));
  }
  history.reverse();

  const priceAt = (back) => history[history.length - 1 - back]?.price ?? history[0].price;
  const dayChangePct = r4(price / priceAt(1) - 1);
  const weekChangePct = r4(price / priceAt(7) - 1);
  const yearChangePct = r4(price / history[0].price - 1);

  return {
    id,
    ticker,
    name,
    kind,
    kindKey: `banking.instrumentKind.${kind}`,
    currency,
    price: r2(price),
    priceEur: toEur(price, currency),
    dayChangePct,
    weekChangePct,
    yearChangePct,
    sector,
    sectorKey: sector ? `banking.sector.${sector}` : null,
    initials: ticker.slice(0, 2),
    history,
  };
});
const instrumentById = new Map(instruments.map((i) => [i.id, i]));

/* ------------------------------------------------------------- holdings */

/** Seven of the ten are held; the other three are watched. */
const HOLDING_SPECS = [
  ['ins-01', 3.482, 0.71],
  ['ins-02', 41.0, 0.88],
  ['ins-07', 18.25, 0.82],
  ['ins-08', 4.9, 0.76],
  ['ins-09', 0.0412, 0.52],
  ['ins-10', 0.86, 0.64],
  ['ins-04', 62.0, 1.14],
];

const holdings = HOLDING_SPECS.map(([instrumentId, quantity, costRatio]) => {
  const ins = instrumentById.get(instrumentId);
  const marketValueEur = r2(quantity * ins.priceEur);
  const costBasisEur = r2(marketValueEur * costRatio);
  const unrealisedPlEur = r2(marketValueEur - costBasisEur);
  const previousEur = r2(ins.priceEur / (1 + ins.dayChangePct));
  return {
    instrumentId,
    quantity: r8(quantity),
    costBasisEur,
    marketValueEur,
    unrealisedPlEur,
    unrealisedPlPct: r4(unrealisedPlEur / costBasisEur),
    allocation: 0,
    dayChangeEur: r2(quantity * (ins.priceEur - previousEur)),
  };
});
const portfolioValueEur = sum2(holdings, (h) => h.marketValueEur);
for (const h of holdings) h.allocation = r4(h.marketValueEur / portfolioValueEur);

const watchlist = instruments
  .filter((i) => !holdings.some((h) => h.instrumentId === i.id))
  .map((i, n) => ({ instrumentId: i.id, addedDate: dayOffset(-(28 + n * 17)) }));

/* --------------------------------------------------------------- trades */

const trades = [];
{
  let n = 0;
  /*
   * One or two a month across the whole statement, dated INSIDE their month.
   *
   * An earlier version walked day offsets from the reporting date, which meant
   * every trade landed inside the last ninety days — the investing rows then
   * bunched into three months of a twelve-month statement and the analytics
   * screen's `investing` category was empty for most of the year.
   */
  for (let back = STATEMENT_MONTHS - 1; back >= 0; back -= 1) {
    const monthPrefix = monthStartBack(back).slice(0, 7);
    const lastDay = Number(monthEndBack(back).slice(8, 10));
    const count = ui(1, 2);
    for (let k = 0; k < count; k += 1) {
      const held = pick(HOLDING_SPECS)[0];
      const ins = instrumentById.get(held);
      const side = chance(0.72) ? 'buy' : 'sell';
      const date = `${monthPrefix}-${pad(ui(2, lastDay - 1))}`;
      // Price on the day when the series reaches back that far, else the oldest
      // point we have — never today's price for a trade nine months ago.
      const daysBack = Math.round((Date.parse(`${REPORTING_DATE}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) / 86400000);
      const idx = ins.history.length - 1 - daysBack;
      const priceEur = r2((idx >= 0 ? ins.history[idx].price : ins.history[0].price) * FX_RATES[ins.currency]);
      const quantity =
        ins.kind === 'crypto' ? r8(uf(0.004, 0.05)) : r4(uf(0.4, 9));
      const amountEur = r2(quantity * priceEur);
      n += 1;
      // The newest trade is still settling; a couple across the year were pulled.
      const status = back === 0 && k === 0 ? 'pending' : chance(0.05) ? 'cancelled' : 'filled';
      trades.push({
        id: `trd-${pad(n)}`,
        instrumentId: held,
        side,
        sideKey: `banking.tradeSide.${side}`,
        quantity,
        priceEur,
        amountEur,
        feeEur: r2(Math.min(2.5, amountEur * 0.0015)),
        status,
        statusKey: `banking.tradeStatus.${status}`,
        date,
        timestamp: stampOn(date),
      });
    }
  }
  trades.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
}

/* --------------------------------------------------------- transactions */

/**
 * Twelve months of statement, per account.
 *
 * The shape is deliberately weekday-weighted and category-weighted rather than
 * uniform: groceries several times a week, bills once a month on a fixed day,
 * salary on the 28th, travel in bursts. Uniform noise reads as noise, and the
 * analytics screen would then have nothing to say.
 */
const transactions = [];
let txnSeq = 0;

const nextTxnId = () => {
  txnSeq += 1;
  return `txn-${String(txnSeq).padStart(4, '0')}`;
};

function pushTxn(fields) {
  const merchant = fields.merchantId ? MERCHANTS.find((m) => m.id === fields.merchantId) : null;
  const category = fields.category ?? merchant?.category ?? 'shopping';
  transactions.push({
    id: nextTxnId(),
    accountId: fields.accountId,
    cardId: fields.cardId ?? null,
    date: fields.date,
    timestamp: fields.timestamp ?? stampOn(fields.date),
    merchantId: fields.merchantId ?? null,
    counterparty: fields.counterparty ?? merchant?.name ?? '—',
    type: fields.type,
    typeKey: `banking.txnType.${fields.type}`,
    status: fields.status ?? 'completed',
    statusKey: `banking.txnStatus.${fields.status ?? 'completed'}`,
    category,
    categoryKey: `banking.category.${category}`,
    amount: r2(fields.amount),
    currency: fields.currency,
    amountEur: toEur(fields.amount, fields.currency),
    fxRate: fields.fxRate ?? null,
    note: fields.note ?? null,
  });
}

/** A spend on a card, in the account's currency. */
function spend(accountId, currency, cardId, date, merchantId, scale = 1) {
  const [lo, hi] = MERCHANT_RANGE.get(merchantId);
  const base = uf(lo, hi) * scale;
  const local = currency === 'EUR' ? base : base / FX_RATES[currency];
  pushTxn({
    accountId,
    cardId,
    date,
    merchantId,
    type: 'card',
    amount: -r2(local),
    currency,
  });
}

for (let back = STATEMENT_MONTHS - 1; back >= 0; back -= 1) {
  const start = monthStartBack(back);
  const end = monthEndBack(back);
  const days = Number(end.slice(8, 10));
  const monthPrefix = start.slice(0, 7);
  const dateOn = (day) => `${monthPrefix}-${pad(Math.min(day, days))}`;

  /* Salary, on the 28th, into the primary account. */
  const salary = r2(normal(3260, 90));
  pushTxn({
    accountId: 'acc-eur',
    date: dateOn(28),
    counterparty: 'Northwind Studio SRL',
    type: 'transfer',
    category: 'income',
    amount: salary,
    currency: 'EUR',
    note: back === 0 ? 'August salary' : null,
  });

  /* A second, smaller income — freelance, not every month. */
  if (chance(0.45)) {
    pushTxn({
      accountId: 'acc-eur',
      date: dateOn(ui(6, 22)),
      counterparty: 'Ternstone Design',
      type: 'transfer',
      category: 'income',
      amount: r2(normal(520, 180)),
      currency: 'EUR',
    });
  }

  /* Bills, each on its own fixed day. */
  for (const [merchantId, day] of [['mer-19', 6], ['mer-20', 8], ['mer-21', 11]]) {
    const [lo, hi] = MERCHANT_RANGE.get(merchantId);
    pushTxn({
      accountId: 'acc-eur',
      date: dateOn(day),
      merchantId,
      type: 'transfer',
      amount: -r2(uf(lo, hi)),
      currency: 'EUR',
    });
  }

  /* Subscriptions. */
  for (const sub of SUBSCRIPTION_SPECS) {
    if (!sub.active && back < 3) continue;
    if (sub.cadence === 'yearly' && back !== 7) continue;
    const account = sub.currency === 'USD' ? 'acc-usd' : 'acc-eur';
    pushTxn({
      accountId: account,
      cardId: sub.cardId,
      date: dateOn(sub.day),
      merchantId: sub.merchantId,
      type: 'card',
      amount: -sub.amount,
      currency: sub.currency,
    });
  }

  /* Groceries, two or three times a week. */
  for (let day = 2; day <= days; day += ui(2, 4)) {
    spend('acc-eur', 'EUR', 'card-01', dateOn(day), pick(merchantsIn('groceries')));
  }

  /* Eating out, transport, shopping, entertainment, health. */
  const everyday = [
    ['eatingOut', 7, 11],
    ['transport', 6, 12],
    ['shopping', 2, 4],
    ['entertainment', 1, 3],
    ['health', 0, 2],
  ];
  for (const [category, lo, hi] of everyday) {
    const count = ui(lo, hi);
    for (let k = 0; k < count; k += 1) {
      spend('acc-eur', 'EUR', chance(0.8) ? 'card-01' : 'card-02', dateOn(ui(1, days)), pick(merchantsIn(category)));
    }
  }

  /*
   * Travel: a burst three months in twelve, plus the odd single trip.
   *
   * The bursts alone put a cliff in the headline. With them landing in the
   * month BEFORE the reporting month, "spent this month" came out 44% below
   * the previous one, and a swing that size on a home screen reads as a data
   * bug rather than as a holiday. The bursts now sit away from both ends and
   * the single trips carry the rest, which keeps the month-on-month figure in
   * a range a reader believes — asserted below, so it cannot drift back.
   */
  const travelBurst = back === 3 || back === 7 || back === 11;
  if (travelBurst || chance(0.4)) {
    const count = travelBurst ? ui(2, 4) : 1;
    for (let k = 0; k < count; k += 1) {
      const merchantId = pick(merchantsIn('travel'));
      const gbp = chance(0.5);
      // A single trip is a night away, not the fortnight a burst represents.
      spend(
        gbp ? 'acc-gbp' : 'acc-eur',
        gbp ? 'GBP' : 'EUR',
        gbp ? 'card-03' : 'card-01',
        dateOn(ui(1, days)),
        merchantId,
        travelBurst ? 1 : 0.32,
      );
    }
  }

  /* An ATM withdrawal or two. */
  for (let k = 0, n = chance(0.7) ? 1 : 0; k < n; k += 1) {
    pushTxn({
      accountId: 'acc-eur',
      cardId: 'card-01',
      date: dateOn(ui(1, days)),
      counterparty: 'ATM — Bd. Unirii',
      type: 'atm',
      category: 'cash',
      amount: -r2(ui(1, 3) * 50),
      currency: 'EUR',
    });
  }

  /* Standing transfers into savings and the vault. */
  pushTxn({ accountId: 'acc-eur', date: dateOn(29), counterparty: 'Rainy day', type: 'transfer', category: 'transfers', amount: -400, currency: 'EUR' });
  pushTxn({ accountId: 'acc-sav', date: dateOn(29), counterparty: 'Everyday', type: 'transfer', category: 'transfers', amount: 400, currency: 'EUR' });
  pushTxn({ accountId: 'acc-eur', date: dateOn(29), counterparty: 'Japan 2027', type: 'transfer', category: 'transfers', amount: -180, currency: 'EUR' });
  pushTxn({ accountId: 'acc-vault', date: dateOn(29), counterparty: 'Everyday', type: 'transfer', category: 'transfers', amount: 180, currency: 'EUR' });

  /* Savings interest, monthly. */
  pushTxn({ accountId: 'acc-sav', date: dateOn(days), counterparty: 'Interest', type: 'transfer', category: 'income', amount: r2(uf(18, 24)), currency: 'EUR' });

  /* An exchange, most months: EUR out of the primary, GBP or USD in. */
  if (chance(0.7)) {
    const quote = chance(0.5) ? 'GBP' : 'USD';
    const eurOut = r2(ui(2, 8) * 50);
    const rate = r4(1 / FX_RATES[quote]);
    const day = ui(3, days - 2);
    pushTxn({ accountId: 'acc-eur', date: dateOn(day), counterparty: `EUR → ${quote}`, type: 'exchange', category: 'transfers', amount: -eurOut, currency: 'EUR', fxRate: rate });
    pushTxn({ accountId: quote === 'GBP' ? 'acc-gbp' : 'acc-usd', date: dateOn(day), counterparty: `EUR → ${quote}`, type: 'exchange', category: 'transfers', amount: r2(eurOut * rate), currency: quote, fxRate: rate });
  }

  /* Investing: the cash leg of the month's trades. */
  const monthTrades = trades.filter((t) => monthOf(t.date) === monthPrefix && t.status === 'filled');
  for (const trade of monthTrades) {
    pushTxn({
      accountId: 'acc-eur',
      date: trade.date,
      counterparty: instrumentById.get(trade.instrumentId).name,
      type: 'trade',
      category: 'investing',
      amount: trade.side === 'buy' ? -r2(trade.amountEur + trade.feeEur) : r2(trade.amountEur - trade.feeEur),
      currency: 'EUR',
    });
  }

  /* A dividend, quarterly. */
  if (back % 3 === 0) {
    pushTxn({ accountId: 'acc-eur', date: dateOn(17), counterparty: 'Globe Index ETF', type: 'dividend', category: 'income', amount: r2(uf(9, 26)), currency: 'EUR' });
  }

  /* A refund, occasionally. */
  if (chance(0.25)) {
    const merchantId = pick(merchantsIn('shopping'));
    const [lo, hi] = MERCHANT_RANGE.get(merchantId);
    pushTxn({ accountId: 'acc-eur', cardId: 'card-01', date: dateOn(ui(5, days)), merchantId, type: 'refund', amount: r2(uf(lo, hi)), currency: 'EUR' });
  }

  /* A card fee on the non-free pairs, occasionally. */
  if (chance(0.3)) {
    pushTxn({ accountId: 'acc-eur', date: dateOn(ui(2, days)), counterparty: 'Vela — exchange fee', type: 'fee', category: 'bills', amount: -r2(uf(0.4, 3.2)), currency: 'EUR' });
  }
}

/* The reporting month gets a few unsettled rows — a statement always has some. */
{
  const days = Number(REPORTING_DATE.slice(8, 10));
  for (let k = 0; k < 3; k += 1) {
    const merchantId = pick(merchantsIn(pick(['eatingOut', 'groceries', 'shopping'])));
    const [lo, hi] = MERCHANT_RANGE.get(merchantId);
    pushTxn({
      accountId: 'acc-eur',
      cardId: 'card-01',
      date: `${REPORTING_MONTH}-${pad(days - k)}`,
      merchantId,
      type: 'card',
      status: 'pending',
      amount: -r2(uf(lo, hi)),
      currency: 'EUR',
    });
  }
  /* One declined row: the frozen card, which is the screen's whole point. */
  pushTxn({
    accountId: 'acc-gbp',
    cardId: 'card-03',
    date: `${REPORTING_MONTH}-${pad(days - 4)}`,
    merchantId: 'mer-11',
    type: 'card',
    status: 'declined',
    amount: -r2(uf(11, 38)),
    currency: 'GBP',
  });
}

transactions.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));

/* ------------------------------------------------------------- accounts */

/**
 * Back-solve each opening balance so the statement lands on the target.
 *
 * A declined row never moved money and is excluded; a pending row HAS moved
 * against the available balance but not the settled one, which is why the two
 * are summed separately rather than one being derived from the other.
 */
const accounts = ACCOUNT_SPECS.map((spec) => {
  const own = transactions.filter((t) => t.accountId === spec.id && t.status !== 'declined');
  const settled = sum2(own.filter((t) => t.status === 'completed'), (t) => t.amount);
  const pending = sum2(own.filter((t) => t.status === 'pending'), (t) => t.amount);
  const balance = spec.target;
  const available = r2(balance + pending);
  return {
    id: spec.id,
    kind: spec.kind,
    kindKey: `banking.accountKind.${spec.kind}`,
    currency: spec.currency,
    balance: r2(balance),
    available,
    balanceEur: toEur(balance, spec.currency),
    nickname: spec.nickname,
    iban: spec.iban,
    primary: spec.primary,
    interestRate: spec.interestRate ?? null,
    goalName: spec.goalName ?? null,
    goalTarget: spec.goalTarget ?? null,
    goalFundedPct: spec.goalTarget ? r4(balance / spec.goalTarget) : null,
    /** Not emitted — used below to prove the statement reconciles. */
    _settled: settled,
  };
});

/* ---------------------------------------------------------------- cards */

const cards = CARD_SPECS.map((spec) => {
  const spent = sum2(
    transactions.filter(
      (t) => t.cardId === spec.id && monthOf(t.date) === REPORTING_MONTH && t.status !== 'declined',
    ),
    (t) => Math.min(0, t.amount),
  );
  return {
    id: spec.id,
    accountId: spec.accountId,
    kind: spec.kind,
    kindKey: `banking.cardKind.${spec.kind}`,
    network: spec.network,
    last4: spec.last4,
    state: spec.state,
    stateKey: `banking.cardState.${spec.state}`,
    label: spec.label,
    expiry: spec.state === 'blocked' ? '02/27' : '09/29',
    monthlyLimit: spec.monthlyLimit,
    spentThisMonth: r2(Math.abs(spent)),
    contactless: spec.contactless,
    onlinePayments: spec.onlinePayments,
    atmWithdrawals: spec.atmWithdrawals,
    regeneratesAfterUse: spec.regeneratesAfterUse,
  };
});

/* ------------------------------------------------- spending and budgets */

/** The three categories that are movement, not spending. */
const NON_SPEND = new Set(['income', 'transfers', 'investing']);

function spendByCategory(month) {
  const rows = new Map();
  for (const t of transactions) {
    if (monthOf(t.date) !== month) continue;
    if (t.status === 'declined') continue;
    if (NON_SPEND.has(t.category)) continue;
    if (t.amountEur >= 0) continue;
    const cur = rows.get(t.category) ?? { amountEur: 0, transactionCount: 0 };
    cur.amountEur += -t.amountEur;
    cur.transactionCount += 1;
    rows.set(t.category, cur);
  }
  return rows;
}

const thisMonth = spendByCategory(REPORTING_MONTH);
const lastMonth = spendByCategory(monthOf(monthEndBack(1)));
const spentThisMonthEur = r2([...thisMonth.values()].reduce((a, x) => a + x.amountEur, 0));
const previousMonthSpendEur = r2([...lastMonth.values()].reduce((a, x) => a + x.amountEur, 0));

const categorySpend = [...thisMonth.entries()]
  .map(([category, row]) => {
    const previousAmountEur = r2(lastMonth.get(category)?.amountEur ?? 0);
    return {
      category,
      categoryKey: `banking.category.${category}`,
      amountEur: r2(row.amountEur),
      share: r4(row.amountEur / spentThisMonthEur),
      transactionCount: row.transactionCount,
      previousAmountEur,
      changePct: previousAmountEur > 0 ? r4(r2(row.amountEur) / previousAmountEur - 1) : null,
    };
  })
  .sort((a, b) => b.amountEur - a.amountEur);

/**
 * Budgets on the five categories a person actually caps.
 *
 * THE LIMIT IS DERIVED FROM HABIT, NOT HARDCODED. A budget someone sets is a
 * round number near what they normally spend, so each is the month's own spend
 * scaled by a factor and rounded to the nearest ten. That is both more
 * realistic than a literal and — the reason it is done this way — SELF-
 * CALIBRATING: re-running the generator with a different seed still produces
 * one category over its cap, one pressing against it and three comfortable,
 * which is the spread the analytics screen has to render. Literals were tried
 * first and every regeneration knocked them out of band.
 *
 * The factors are the whole design: below 1 puts the category over, a little
 * above 1 lands it in the amber band, well above 1 leaves it calm.
 */
const BUDGET_SPECS = [
  ['groceries', 1.08],
  ['eatingOut', 1.45],
  ['transport', 0.85],
  ['shopping', 1.35],
  ['entertainment', 1.5],
];

/** To the nearest ten — nobody budgets 537. */
const round10 = (n) => Math.max(10, Math.round(n / 10) * 10);

const budgets = BUDGET_SPECS.map(([category, factor]) => {
  const spent = r2(thisMonth.get(category)?.amountEur ?? 0);
  const monthlyLimit = round10(spent * factor);
  const usedPct = r4(spent / monthlyLimit);
  const status = usedPct > 1 ? 'over' : usedPct >= 0.85 ? 'near' : 'under';
  return {
    category,
    categoryKey: `banking.category.${category}`,
    monthlyLimit,
    spent,
    remaining: r2(monthlyLimit - spent),
    usedPct,
    status,
    statusKey: `banking.budgetStatus.${status}`,
  };
});

/* --------------------------------------------------------- monthly flow */

const monthlyFlow = [];
{
  let closing = 0;
  const months = [];
  for (let back = STATEMENT_MONTHS - 1; back >= 0; back -= 1) months.push(monthOf(monthEndBack(back)));
  // Closing balance walks FORWARD from a back-solved opening so the final month
  // lands on today's real total.
  const finalTotal = sum2(accounts, (a) => a.balanceEur);
  const perMonthNet = months.map((month) => {
    const rows = transactions.filter((t) => monthOf(t.date) === month && t.status === 'completed');
    const inEur = r2(rows.filter((t) => t.amountEur > 0).reduce((a, t) => a + t.amountEur, 0));
    const outEur = r2(rows.filter((t) => t.amountEur < 0).reduce((a, t) => a - t.amountEur, 0));
    return { month, inEur, outEur, netEur: r2(inEur - outEur) };
  });
  const totalNet = r2(perMonthNet.reduce((a, m) => a + m.netEur, 0));
  closing = r2(finalTotal - totalNet);
  for (const m of perMonthNet) {
    closing = r2(closing + m.netEur);
    monthlyFlow.push({ ...m, closingBalanceEur: closing });
  }
}

/* ------------------------------------------------------------- fx pairs */

const fxPairs = [];
const rateHistory = {};
for (const [id, base, quote, feePct, spreadBps] of PAIR_SPECS) {
  const rate = r6(FX_RATES[base] / FX_RATES[quote]);
  const vol = 0.0035;
  const points = [];
  let r = rate;
  for (let i = 0; i < RATE_HISTORY_DAYS; i += 1) {
    points.push({ date: dayOffset(-i), rate: r6(r) });
    r = r / (1 + normal(0.00008, vol));
  }
  points.reverse();
  rateHistory[id] = points;
  fxPairs.push({
    id,
    base,
    quote,
    rate,
    spreadBps,
    feePct,
    thirtyDayChangePct: r4(rate / points[points.length - 31].rate - 1),
  });
}

/* --------------------------------------------------------- subscriptions */

const CADENCE_MONTHS = { weekly: 1 / 4.345, monthly: 1, quarterly: 3, yearly: 12 };
const subscriptions = SUBSCRIPTION_SPECS.map((spec) => ({
  id: spec.id,
  merchantId: spec.merchantId,
  amount: r2(spec.amount),
  currency: spec.currency,
  amountEur: toEur(spec.amount, spec.currency),
  cadence: spec.cadence,
  cadenceKey: `banking.cadence.${spec.cadence}`,
  nextChargeDate: `2026-09-${pad(spec.day)}`,
  active: spec.active,
  cardId: spec.cardId,
}));

/* -------------------------------------------------------------- totals */

const totalBalanceEur = sum2(accounts, (a) => a.balanceEur);
const availableEur = sum2(accounts, (a) => toEur(a.available, a.currency));
const portfolioCostBasisEur = sum2(holdings, (h) => h.costBasisEur);
const portfolioUnrealisedPlEur = r2(portfolioValueEur - portfolioCostBasisEur);
const monthRows = transactions.filter(
  (t) => monthOf(t.date) === REPORTING_MONTH && t.status !== 'declined',
);
const incomeThisMonthEur = r2(
  monthRows.filter((t) => t.category === 'income' && t.amountEur > 0).reduce((a, t) => a + t.amountEur, 0),
);

const TOTALS = {
  totalBalanceEur,
  availableEur,
  savingsBalanceEur: sum2(accounts.filter((a) => a.kind !== 'current'), (a) => a.balanceEur),
  portfolioValueEur,
  netWorthEur: r2(totalBalanceEur + portfolioValueEur),
  spentThisMonthEur,
  incomeThisMonthEur,
  netThisMonthEur: r2(incomeThisMonthEur - spentThisMonthEur),
  spendChangePct: r4(spentThisMonthEur / previousMonthSpendEur - 1),
  previousMonthSpendEur,
  portfolioCostBasisEur,
  portfolioUnrealisedPlEur,
  portfolioReturnPct: r4(portfolioUnrealisedPlEur / portfolioCostBasisEur),
  portfolioDayChangeEur: sum2(holdings, (h) => h.dayChangeEur),
  budgetTotalEur: sum2(budgets, (b) => b.monthlyLimit),
  budgetSpentEur: sum2(budgets, (b) => b.spent),
  budgetOverCount: budgets.filter((b) => b.status === 'over').length,
  budgetNearCount: budgets.filter((b) => b.status === 'near').length,
  subscriptionMonthlyEur: sum2(
    subscriptions.filter((s) => s.active),
    (s) => s.amountEur / CADENCE_MONTHS[s.cadence],
  ),
  activeSubscriptionCount: subscriptions.filter((s) => s.active).length,
  accountCount: accounts.length,
  cardCount: cards.length,
  activeCardCount: cards.filter((c) => c.state === 'active').length,
  frozenCardCount: cards.filter((c) => c.state === 'frozen').length,
  transactionCount: transactions.length,
  monthTransactionCount: monthRows.length,
  pendingCount: transactions.filter((t) => t.status === 'pending').length,
  holdingCount: holdings.length,
  watchlistCount: watchlist.length,
};

/* ---------------------------------------------------------- invariants */

/**
 * Assert what the screens are allowed to assume.
 *
 * Each of these is a claim a reader can check by adding a column up. A
 * generator that emits a book which does not balance is worse than one that
 * throws, because the failure then surfaces as a screenshot nobody trusts.
 */
const near = (a, b, tol = 0.05) => Math.abs(a - b) <= tol;
const problems = [];
const check = (ok, message) => {
  if (!ok) problems.push(message);
};

check(near(sum2(accounts, (a) => a.balanceEur), TOTALS.totalBalanceEur), 'account balances do not sum to totalBalanceEur');
check(near(sum2(holdings, (h) => h.marketValueEur), TOTALS.portfolioValueEur), 'holdings do not sum to portfolioValueEur');
check(near(sum2(holdings, (h) => h.allocation), 1, 0.001), 'holding allocations do not sum to 1');
check(near(sum2(categorySpend, (c) => c.amountEur), TOTALS.spentThisMonthEur), 'category spend does not sum to spentThisMonthEur');
check(near(sum2(categorySpend, (c) => c.share), 1, 0.001), 'category shares do not sum to 1');
check(near(monthlyFlow[monthlyFlow.length - 1].closingBalanceEur, TOTALS.totalBalanceEur), 'the flow series does not close on the current balance');
check(monthlyFlow.length === STATEMENT_MONTHS, 'the flow series is not STATEMENT_MONTHS long');
check(accounts.filter((a) => a.primary).length === 1, 'there must be exactly one primary account');
check(instruments.every((i) => i.history.length === PRICE_HISTORY_DAYS), 'an instrument has the wrong history length');
check(instruments.every((i) => near(i.history[i.history.length - 1].price, i.price, 0.011)), 'an instrument price disagrees with the last history point');
check(Object.values(rateHistory).every((h) => h.length === RATE_HISTORY_DAYS), 'a pair has the wrong rate-history length');
check(transactions.every((t) => near(t.amountEur, t.amount * FX_RATES[t.currency], 0.011)), 'a transaction amountEur disagrees with its local amount');
check(cards.every((c) => c.monthlyLimit === null || c.spentThisMonth >= 0), 'a card has negative spend');
check(budgets.every((b) => near(b.spent + b.remaining, b.monthlyLimit)), 'a budget does not reconcile');
check(new Set(transactions.map((t) => t.id)).size === transactions.length, 'duplicate transaction id');
check(TOTALS.spentThisMonthEur > 0 && TOTALS.incomeThisMonthEur > 0, 'the reporting month is empty');
check(
  Math.abs(TOTALS.spendChangePct) <= 0.35,
  `month-on-month spend moved ${(TOTALS.spendChangePct * 100).toFixed(1)}% — a swing that size reads as a data bug on the home screen`,
);
check(budgets.some((b) => b.status === 'over'), 'no budget is over — the analytics screen needs the case');
check(budgets.some((b) => b.status === 'near'), 'no budget is near its cap — the amber band would never render');
check(budgets.some((b) => b.status === 'under'), 'every budget is over — the calm case would never render');
check(trades.length >= 10, 'too few trades for the invest screen to have a history');
check(new Set(trades.map((t) => monthOf(t.date))).size >= 8, 'trades bunch into a few months instead of spanning the statement');
check(cards.some((c) => c.state === 'frozen') && cards.some((c) => c.state === 'blocked'), 'the card screen needs a frozen and a blocked card');
check(transactions.some((t) => t.status === 'pending') && transactions.some((t) => t.status === 'declined'), 'the statement needs a pending and a declined row');

if (problems.length > 0) {
  console.error('[generate-banking-fixture] the fixture does not balance:');
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}

/* ------------------------------------------------------------- emission */

for (const a of accounts) delete a._settled;

const j = (v) => JSON.stringify(v);
/** One record per line — a diff of this file should be readable. */
const rows = (arr) => arr.map((x) => `  ${j(x)},`).join('\n');
/** Series are emitted several points to a line; 900 one-line points is noise. */
function series(points, perLine = 4) {
  const out = [];
  for (let i = 0; i < points.length; i += perLine) {
    out.push('    ' + points.slice(i, i + perLine).map(j).join(', ') + ',');
  }
  return out.join('\n');
}

const instrumentsOut = instruments
  .map((i) => {
    const { history, ...rest } = i;
    return `  {\n    ...${j(rest)},\n    history: [\n${series(history)}\n    ],\n  },`;
  })
  .join('\n');

const rateHistoryOut = Object.entries(rateHistory)
  .map(([id, points]) => `  ${j(id)}: [\n${series(points)}\n  ],`)
  .join('\n');

const file = `/* eslint-disable */
/**
 * GENERATED FILE — do not edit by hand.
 *
 * Produced by \`scripts/generate-banking-fixture.mjs\` with seed 0x${SEED.toString(16)} and the
 * frozen reporting date ${REPORTING_DATE}. Re-running the generator reproduces this file
 * byte for byte.
 *
 * Every invariant the screens rely on is asserted by the generator before this
 * file is written: the balances sum, the categories sum, the flow series closes
 * on the current balance, and every price series ends on the price beside it.
 */
import type {
  Account,
  BankTotals,
  BankingFixture,
  Budget,
  Card,
  CategorySpend,
  Currency,
  FxPair,
  Holding,
  Instrument,
  Merchant,
  MonthlyFlow,
  Profile,
  RatePoint,
  Subscription,
  Trade,
  Transaction,
  WatchItem,
} from './types';

export const FX_RATES: Record<Currency, number> = ${JSON.stringify(FX_RATES, null, 2)};

export const PROFILE: Profile = ${j(PROFILE)};

export const ACCOUNTS = [
${rows(accounts)}
];

export const CARDS = [
${rows(cards)}
];

export const MERCHANTS = [
${rows(MERCHANTS)}
];

export const TRANSACTIONS = [
${rows(transactions)}
];

export const BUDGETS = [
${rows(budgets)}
];

export const CATEGORY_SPEND = [
${rows(categorySpend)}
];

export const MONTHLY_FLOW = [
${rows(monthlyFlow)}
];

export const FX_PAIRS = [
${rows(fxPairs)}
];

export const RATE_HISTORY: Record<string, RatePoint[]> = {
${rateHistoryOut}
};

export const INSTRUMENTS = [
${instrumentsOut}
];

export const HOLDINGS = [
${rows(holdings)}
];

export const WATCHLIST = [
${rows(watchlist)}
];

export const TRADES = [
${rows(trades)}
];

export const SUBSCRIPTIONS = [
${rows(subscriptions)}
];

export const TOTALS: BankTotals = ${JSON.stringify(TOTALS, null, 2)};

export const FIXTURE: BankingFixture = {
  reportingDate: ${j(REPORTING_DATE)},
  reportingMonth: ${j(REPORTING_MONTH)},
  baseCurrency: 'EUR',
  fxRates: FX_RATES,
  totals: TOTALS,
  profile: PROFILE,
  accounts: ACCOUNTS as Account[],
  cards: CARDS as Card[],
  merchants: MERCHANTS as Merchant[],
  transactions: TRANSACTIONS as Transaction[],
  budgets: BUDGETS as Budget[],
  categorySpend: CATEGORY_SPEND as CategorySpend[],
  monthlyFlow: MONTHLY_FLOW as MonthlyFlow[],
  fxPairs: FX_PAIRS as FxPair[],
  rateHistory: RATE_HISTORY,
  instruments: INSTRUMENTS as Instrument[],
  holdings: HOLDINGS as Holding[],
  watchlist: WATCHLIST as WatchItem[],
  trades: TRADES as Trade[],
  subscriptions: SUBSCRIPTIONS as Subscription[],
};
`;

writeFileSync(OUT, file, 'utf8');

console.log(`wrote ${OUT}`);
console.log(
  `  accounts=${accounts.length} cards=${cards.length} transactions=${transactions.length} ` +
    `merchants=${MERCHANTS.length} instruments=${instruments.length} holdings=${holdings.length} ` +
    `trades=${trades.length} subs=${subscriptions.length}`,
);
console.log(
  `  balance=${TOTALS.totalBalanceEur.toFixed(2)} portfolio=${TOTALS.portfolioValueEur.toFixed(2)} ` +
    `net worth=${TOTALS.netWorthEur.toFixed(2)}`,
);
console.log(
  `  spent=${TOTALS.spentThisMonthEur.toFixed(2)} (${(TOTALS.spendChangePct * 100).toFixed(1)}% vs last) ` +
    `income=${TOTALS.incomeThisMonthEur.toFixed(2)} budgets over=${TOTALS.budgetOverCount}`,
);
