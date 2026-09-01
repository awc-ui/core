/**
 * The proposal builder's shared constants, enumerations and draft arithmetic.
 *
 * In the React source all of this sits at the top of `ProposalBuilder.tsx`;
 * `<script setup>` cannot export, and the builder here is several SFCs that
 * must agree on step indices and the weight epsilon, so the section became a
 * module — the same move `trade-strings.ts` makes for the trade screen.
 */

import { ASSET_CLASS_ORDER, type AllocationRow, type AssetClass, type InstrumentType, type ProposalType } from '@awc-ui/showcase-kit/wealth';

/* ------------------------------------------------------------ enumerations */

/*
 * The two domain enumerations this form offers as choices.
 *
 * `Record<Union, number>` rather than an array so TypeScript demands every
 * member: adding a proposal type to the kit fails the build here instead of
 * silently dropping a radio. The kit exports `ASSET_CLASS_ORDER` for the third
 * enumeration and nothing equivalent for these two — see the hand-off notes.
 */
export const PROPOSAL_TYPE_RANK: Record<ProposalType, number> = {
  rebalance: 0,
  'new-mandate': 1,
  'cash-raise': 2,
  'tax-harvest': 3,
  'goal-funding': 4,
};

export const INSTRUMENT_TYPE_RANK: Record<InstrumentType, number> = {
  equity: 0,
  bond: 1,
  fund: 2,
  etf: 3,
  alternative: 4,
};

export const PROPOSAL_TYPES = Object.keys(PROPOSAL_TYPE_RANK) as ProposalType[];
export const INSTRUMENT_TYPES = Object.keys(INSTRUMENT_TYPE_RANK) as InstrumentType[];

/* --------------------------------------------------------------- constants */

/** Horizon slider, in MONTHS — the unit `Goal.monthsRemaining` already uses. */
export const HORIZON_MIN = 12;
export const HORIZON_MAX = 240;
export const HORIZON_STEP = 12;
/** A form default, not a fixture value: five years. */
export const HORIZON_DEFAULT = 60;

export const CONVICTION_MAX = 5;
export const CODE_LENGTH = 6;

/** How many instruments the summary lists before it stops and counts the rest. */
export const SUMMARY_LIST_LIMIT = 5;

/** Step indices, named so the validation table reads as prose. */
export const STEP_CLIENT = 0;
export const STEP_RISK = 1;
export const STEP_ALLOCATION = 2;
export const STEP_SIGN = 3;
export const LAST_STEP = STEP_SIGN;

export const STEP_MESSAGE = [
  'wealth.proposal.error.step1',
  'wealth.proposal.error.step2',
  'wealth.proposal.error.step3',
  'wealth.proposal.error.step4',
];

/** The fixed ladder the fake submit climbs. No clock, no randomness. */
export const SUBMIT_TICK = 20;
export const SUBMIT_INTERVAL_MS = 160;
export const SUBMIT_SETTLE_MS = 200;

/* ------------------------------------------------------------- draft maths */

/**
 * The arithmetic this screen cannot push into the kit.
 *
 * Every figure the fixture carries is derived in `derive.ts`; these are about a
 * DRAFT that does not exist there, so there is nothing to call. Collected in
 * one object rather than scattered through the templates so that the day the
 * kit grows an allocation-draft helper there is exactly one place to delete.
 * Flagged in the hand-off notes as a kit candidate.
 *
 * `balanced` needs a tolerance because five fractions summed in binary floating
 * point miss 1 by about 1e-16. The tolerance is a twentieth of the smallest
 * step the field offers, so it can never accept a total the user typed wrong.
 */
export const WEIGHT_EPSILON = 0.0005;

export const draftMaths = {
  total(weights: Record<AssetClass, number>): number {
    return ASSET_CLASS_ORDER.reduce((sum, cls) => sum + (weights[cls] || 0), 0);
  },
  /** Signed distance from a balanced book — exactly what `driftColor` reads. */
  imbalance(weights: Record<AssetClass, number>): number {
    return draftMaths.total(weights) - 1;
  },
  balanced(weights: Record<AssetClass, number>): boolean {
    return Math.abs(draftMaths.imbalance(weights)) <= WEIGHT_EPSILON;
  },
};

/** The mandate's own targets, as a full five-class record. */
export function targetsFor(rows: AllocationRow[]): Record<AssetClass, number> {
  const seed = {} as Record<AssetClass, number>;
  for (const cls of ASSET_CLASS_ORDER) seed[cls] = 0;
  for (const row of rows) seed[row.assetClass] = row.targetWeight;
  return seed;
}

/* ----------------------------------------------------------------- shapes */

/** One failed validation rule: which step, which field, which message key. */
export interface Failure {
  step: number;
  field: string;
  key: string;
}

/** One row of `md-transfer-list`'s `items` property. */
export interface TransferItem {
  value: string;
  label: string;
  description: string;
  disabled: boolean;
}
