/**
 * Domain value → component vocabulary.
 *
 * `md-chip`, `md-meter` and `md-status-dot` each take a fixed enumeration
 * (`color`, `state`). Mapping credit states onto them in ONE place keeps a
 * breach the same red everywhere, and keeps the mapping auditable — the
 * alternative is a `status === 'breach' ? 'error' : …` ternary in nine files
 * that drift apart.
 *
 * Nothing here produces a visible string. The label always comes from the
 * dictionary key beside the value (`covenantStatus.${status}` and friends).
 */

import type {
  CovenantStatus,
  FacilityStatus,
  RatingBand,
  SignalSeverity,
} from '@awc-ui/showcase-kit/data';

/** The `color` enumeration shared by md-chip, md-meter and md-badge. */
export type MdColor = 'primary' | 'secondary' | 'tertiary' | 'error' | 'success' | 'warning' | 'info';

/** The `state` enumeration of md-status-dot. */
export type MdDotState = 'online' | 'away' | 'busy' | 'offline' | 'invisible' | 'neutral';

export const covenantColor: Record<CovenantStatus, MdColor> = {
  compliant: 'success',
  watch: 'warning',
  breach: 'error',
};

export const covenantDot: Record<CovenantStatus, MdDotState> = {
  compliant: 'online',
  watch: 'away',
  breach: 'busy',
};

export const facilityColor: Record<FacilityStatus, MdColor> = {
  performing: 'success',
  watch: 'warning',
  impaired: 'error',
};

export const facilityDot: Record<FacilityStatus, MdDotState> = {
  performing: 'online',
  watch: 'away',
  impaired: 'busy',
};

export const severityColor: Record<SignalSeverity, MdColor> = {
  high: 'error',
  medium: 'warning',
  low: 'info',
};

export const severityDot: Record<SignalSeverity, MdDotState> = {
  high: 'busy',
  medium: 'away',
  low: 'online',
};

export const bandColor: Record<RatingBand, MdColor> = {
  investment: 'success',
  speculative: 'warning',
  default: 'error',
};

/**
 * Utilisation against a committed limit. Over 95% of the limit is the point a
 * credit officer wants to see flagged, 85% the point they want to notice.
 */
export function utilisationColor(fraction: number): MdColor {
  if (fraction >= 0.95) return 'error';
  if (fraction >= 0.85) return 'warning';
  return 'primary';
}

/** A watchlisted obligor gets the alert dot; everything else reads as performing. */
export function watchlistDot(onWatchlist: boolean): MdDotState {
  return onWatchlist ? 'busy' : 'online';
}
