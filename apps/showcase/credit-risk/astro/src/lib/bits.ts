/**
 * The small repeated pieces — chips, dots — as prop builders rather than
 * components.
 *
 * The React build has a `bits.tsx` full of one-line components (RatingChip,
 * CovenantChip, WatchDot) because a React component is a function call and
 * costs nothing to declare. An Astro component is a separate `.astro` file with
 * its own frontmatter, and eight of them that each render a single `<md-chip>`
 * with a different colour lookup would be more ceremony than the thing they
 * wrap. So each one here returns the props, and the call site spreads them:
 *
 *     <md-chip {...ratingChip(t, cp.ratingLabel, band, cp.grade)} />
 *
 * Same single source for the colour mapping, one file instead of eight, and the
 * element stays visible in the markup — which on a page whose whole point is
 * demonstrating those elements is the better default anyway.
 *
 * Every one takes the translator explicitly. There is no context to read it
 * from: these run on the server, once per page, and the locale is a property of
 * the route.
 */

import type {
  CovenantStatus,
  FacilityStatus,
  RatingBand,
  RatingLabel,
  SignalSeverity,
} from '@awc-ui/showcase-kit/data';
import {
  bandColor,
  covenantColor,
  covenantDot,
  facilityColor,
  severityColor,
  severityDot,
  watchlistDot,
} from '@awc-ui/showcase-kit/credit-risk';
import type { T } from './i18n';

export function ratingChip(t: T, label: RatingLabel, band: RatingBand, grade?: number) {
  return {
    variant: 'assist',
    appearance: 'filled',
    color: bandColor[band],
    label: grade == null ? t(`rating.${label}`) : `${t(`rating.${label}`)} · ${grade}`,
    title: t(`ratingBand.${band}`),
  };
}

export function covenantChip(t: T, status: CovenantStatus) {
  return {
    variant: 'assist',
    appearance: 'filled',
    color: covenantColor[status],
    label: t(`covenantStatus.${status}`),
  };
}

export function facilityStatusChip(t: T, status: FacilityStatus) {
  return {
    variant: 'assist',
    appearance: 'outlined',
    color: facilityColor[status],
    label: t(`facilityStatus.${status}`),
  };
}

export function severityChip(t: T, severity: SignalSeverity) {
  return {
    variant: 'assist',
    appearance: 'filled',
    color: severityColor[severity],
    label: t(`severity.${severity}`),
  };
}

/**
 * `inline` on every dot. Without it `md-status-dot` is a block, and a dot set
 * beside a word sits on its own baseline a few pixels low — which is exactly
 * the misalignment this app was reported for once already.
 */
export function severityDotProps(_t: T, severity: SignalSeverity) {
  return {
    inline: true,
    state: severityDot[severity],
    size: 'small',
    // NO label. This dot is rendered immediately beside a chip carrying the
    // same word, so naming it too makes every watchlist row announce the
    // severity twice. Unlabelled, md-status-dot falls back to
    // role="presentation" + aria-hidden, which is what a decorative dot
    // beside its own label should be. Contrast `watchDotProps` below, which
    // stands alone and whose label is the only word available.
  };
}

export function covenantDotProps(t: T, status: CovenantStatus) {
  return {
    inline: true,
    state: covenantDot[status],
    size: 'small',
    label: t(`covenantStatus.${status}`),
  };
}

/** The watchlist marker: a live dot plus its accessible name. */
export function watchDotProps(t: T, on: boolean) {
  return {
    inline: true,
    state: watchlistDot(on),
    size: 'medium',
    label: on ? t('kpi.watchlist') : t('facilityStatus.performing'),
  };
}
