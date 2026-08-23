/**
 * Series derived from the fixture — never invented, never random, never clocked.
 *
 * The fixture is frozen at 2026-03-31 and carries exactly one time dimension:
 * `getRatingHistory()`, eight quarterly grade observations per counterparty. Every
 * trend on every screen is computed from those observations plus the static
 * balance-sheet fields, so all six framework builds draw identical lines.
 *
 * CALIBRATION. A history observation carries the GRADE's through-the-cycle PD,
 * while `Counterparty.pd` carries the same grade with an idiosyncratic tilt. Left
 * alone, the last point of a derived series lands a percent or two off the
 * headline KPI beside it, which reads as a bug. Each counterparty's history is
 * therefore scaled by `counterparty.pd / lastObservation.pd`, so the final point
 * of every series is exactly the number in the tile above it.
 *
 * RISK WEIGHT. `riskWeight()` reproduces the fixture generator's illustrative
 * formula so a stressed or historical PD can be turned back into RWA. It is a
 * monotone stand-in that makes the charts behave — it is not an IRB calculation
 * and is never labelled as one in the UI.
 *
 * FLAT EAD IS DELIBERATE, NOT A BUG. The fixture gives each counterparty one
 * exposure, not an exposure per quarter, so `quarterlySeries().ead` is the SAME
 * number in all eight points. That is why the overview's stacked area has a
 * perfectly level top: it shows rating MIGRATION at constant exposure — money
 * moving from the investment band into speculative — which is the honest thing
 * this fixture can say. Do not "fix" the flat line by scaling EAD over time;
 * that would invent a balance sheet the data does not have. The series that
 * legitimately moves is `monthlyEadSeries()`, which counts facilities actually
 * live at each month end, and that is what the exposure KPI's sparkline plots.
 */

import {
  getCounterparties,
  getFacilities,
  getRatingGrade,
  getRatingHistory,
  REPORTING_DATE,
  type Counterparty,
  type Facility,
  type RatingBand,
  type SectorId,
} from '../data/index';

/** The fixture's illustrative risk weight. Monotone in PD and LGD. NOT Basel IRB. */
export function riskWeight(pd: number, lgd: number): number {
  return Math.min(3, Math.max(0.15, 0.12 + 8.5 * Math.sqrt(pd) * (lgd / 0.45)));
}

export interface QuarterPoint {
  /** e.g. `2025-Q3`. */
  quarter: string;
  /** Quarter-end ISO date. */
  date: string;
  ead: number;
  expectedLoss: number;
  rwa: number;
  /** EAD-weighted PD, as a fraction. */
  weightedAvgPd: number;
  /** EAD-weighted LGD, as a fraction. */
  weightedAvgLgd: number;
  /** EAD split across the three rating bands at that quarter. */
  byBand: Record<RatingBand, number>;
}

/** Per-counterparty calibrated PD path, memoised for the life of the page. */
const pdPathCache = new Map<string, number[]>();

function pdPath(cp: Counterparty): number[] {
  const cached = pdPathCache.get(cp.id);
  if (cached) return cached;
  const history = getRatingHistory(cp.id);
  const last = history[history.length - 1];
  const calibration = last && last.pd > 0 ? cp.pd / last.pd : 1;
  const path = history.map((o) => Math.min(1, o.pd * calibration));
  pdPathCache.set(cp.id, path);
  return path;
}

const quarterCache = new Map<string, QuarterPoint[]>();

/**
 * Eight quarterly portfolio aggregates, oldest first, ending at the reporting
 * quarter. Pass a sector id to restrict the population to that sector.
 */
export function quarterlySeries(sectorId?: SectorId): QuarterPoint[] {
  const key = sectorId ?? '__all__';
  const cached = quarterCache.get(key);
  if (cached) return cached;

  const population = sectorId ? getCounterparties({ sectorId }) : getCounterparties();
  const template = getRatingHistory(population[0]?.id ?? 'cp-01');

  const points = template.map((observation, q) => {
    const byBand: Record<RatingBand, number> = { investment: 0, speculative: 0, default: 0 };
    let ead = 0;
    let expectedLoss = 0;
    let rwa = 0;
    let pdWeighted = 0;
    let lgdWeighted = 0;

    for (const cp of population) {
      const history = getRatingHistory(cp.id);
      const pd = pdPath(cp)[q];
      const grade = getRatingGrade(history[q].grade);
      ead += cp.ead;
      expectedLoss += cp.ead * pd * cp.lgd;
      rwa += cp.ead * riskWeight(pd, cp.lgd);
      pdWeighted += cp.ead * pd;
      lgdWeighted += cp.ead * cp.lgd;
      if (grade) byBand[grade.band] += cp.ead;
    }

    return {
      quarter: observation.quarter,
      date: observation.date,
      ead,
      expectedLoss,
      rwa,
      weightedAvgPd: ead ? pdWeighted / ead : 0,
      weightedAvgLgd: ead ? lgdWeighted / ead : 0,
      byBand,
    };
  });

  quarterCache.set(key, points);
  return points;
}

/**
 * Twelve month-end EAD observations to the reporting date, counting only
 * facilities that were live at each month end. This is the one balance-sheet
 * series the fixture supports honestly: origination and maturity dates decide
 * which lines were on the book, so the curve steps as facilities were drawn down.
 */
export function monthlyEadSeries(): { date: string; ead: number; facilities: number }[] {
  const facilities = getFacilities();
  const [y, m] = REPORTING_DATE.split('-').map(Number);
  const out: { date: string; ead: number; facilities: number }[] = [];

  for (let back = 11; back >= 0; back--) {
    // Day 0 of the following month is the last day of the month we want, in UTC.
    const end = new Date(Date.UTC(y, m - back, 0));
    const date = end.toISOString().slice(0, 10);
    let ead = 0;
    let live = 0;
    for (const f of facilities) {
      if (f.originationDate <= date && f.maturityDate > date) {
        ead += f.ead;
        live++;
      }
    }
    out.push({ date, ead, facilities: live });
  }
  return out;
}

export interface ScheduleRow {
  quarter: string;
  date: string;
  commitment: number;
  drawn: number;
  undrawn: number;
  utilisation: number;
  /** Movement in the drawn balance against the previous row. Negative = repayment. */
  movement: number;
}

/**
 * A drawdown / repayment schedule for one facility, in the facility's own
 * currency, from the reporting quarter to maturity.
 *
 * Term loans amortise straight-line over the remaining tenor. Revolving credit,
 * trade finance and guarantees are committed lines that do not amortise, so the
 * balance holds and the commitment retires in one step at maturity. Both shapes
 * come purely from `maturityDate`, `drawn` and `commitment` — nothing is guessed.
 *
 * A long line is ABRIDGED rather than truncated: the first rows plus the last
 * two, so the maturity retirement is always on screen. Truncating instead would
 * end an eleven-year revolver on eight identical rows and never show the balance
 * going to zero, which is the one row the reader came for.
 */
export function drawdownSchedule(facility: Facility, maxRows = 8): ScheduleRow[] {
  const amortising = facility.type === 'term-loan';
  const quarters = Math.max(1, Math.ceil(facility.monthsToMaturity / 3));
  const [y, m] = REPORTING_DATE.split('-').map(Number);

  const steps: number[] = [];
  if (quarters + 1 <= maxRows) {
    for (let i = 0; i <= quarters; i++) steps.push(i);
  } else {
    for (let i = 0; i < maxRows - 2; i++) steps.push(i);
    steps.push(quarters - 1, quarters);
  }

  const rows: ScheduleRow[] = [];
  let previousDrawn = facility.drawn;

  for (const [index, step] of steps.entries()) {
    const end = new Date(Date.UTC(y, m + step * 3, 0));
    const iso = end.toISOString().slice(0, 10);
    const quarter = `${end.getUTCFullYear()}-Q${Math.floor(end.getUTCMonth() / 3) + 1}`;
    const remaining = Math.max(0, quarters - step) / quarters;

    const drawn = amortising ? facility.drawn * remaining : step >= quarters ? 0 : facility.drawn;
    const commitment = amortising
      ? facility.commitment * remaining
      : step >= quarters
        ? 0
        : facility.commitment;

    rows.push({
      quarter,
      date: iso,
      commitment,
      drawn,
      undrawn: Math.max(0, commitment - drawn),
      utilisation: commitment > 0 ? drawn / commitment : 0,
      // Against the previous ROW, not the previous quarter — the abridged jump
      // carries the movement of everything it skipped.
      movement: index === 0 ? 0 : drawn - previousDrawn,
    });
    previousDrawn = drawn;
  }
  return rows;
}

/** Counterparties in a sector, largest exposure first. */
export function sectorCounterparties(sectorId: SectorId): Counterparty[] {
  return getCounterparties({ sectorId, sortBy: 'ead', sortDir: 'desc' });
}
