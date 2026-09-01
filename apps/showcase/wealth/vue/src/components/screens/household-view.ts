/**
 * What the reader has chosen to see on the household screen. Pure view state —
 * nothing here is a domain value, which is exactly why it lives in the app and
 * not in the kit.
 *
 * A `.ts` module rather than a declaration inside a component: `<script setup>`
 * cannot contain ES module exports, and this shape is shared between the screen
 * (which holds it) and the settings sheet (which edits it).
 */

export interface HouseholdView {
  /** Draw the benchmark beside the mandate on the growth chart. */
  benchmark: boolean;
  /** Show the 24-month sparkline on the KPI tiles. */
  trend: boolean;
  /** Keep the cash line in the allocation panel. */
  cash: boolean;
  /** Keep the asset classes that are already inside their band. */
  inBand: boolean;
}

/** Everything visible. "Clear" returns here, so it hides nothing. */
export const DEFAULT_VIEW: HouseholdView = {
  benchmark: true,
  trend: true,
  cash: true,
  inBand: true,
};
