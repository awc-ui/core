/**
 * The small, repeated pieces: a KPI tile, the chips that carry a credit state,
 * the covenant meter.
 *
 * Every one takes a domain value and resolves BOTH halves of it through the
 * kit — the colour through the status maps in
 * `@awc-ui/showcase-kit/credit-risk`, the label through the dictionary key that
 * travels beside the value (`covenantStatus.${status}`, `rating.${label}`).
 * Nothing here contains English, so nothing here can render English into a
 * Romanian page.
 *
 * Each takes the translator explicitly. There is no context to read it from:
 * these run once per page at build time, and the locale is a property of the
 * route.
 */

import {
  bandColor,
  covenantColor,
  covenantDot,
  facilityColor,
  severityColor,
  severityDot,
  watchlistDot,
} from '@awc-ui/showcase-kit/credit-risk';
import { attrs, html } from './html.mjs';
import { sparkline } from './charts.mjs';

/* ----------------------------------------------------------------- KPI tile */

export function kpiTile(t, { label, value, hint, trend, trendLabels, trendFormat = 'currency', color = 'primary', badge }) {
  const hasTrend = Array.isArray(trend) && trend.length > 1;
  return html`<md-card variant="filled" full-width>
    <div class="kpi">
      <p class="kpi__label">${label}</p>
      <p class="kpi__value">${value}</p>
      ${hasTrend
        ? html`<div class="kpi__spark">
            ${sparkline({
              data: trend,
              labels: trendLabels,
              format: trendFormat,
              attributes: {
                variant: 'area',
                color,
                curve: 'monotone',
                'show-marks': 'extremes',
                height: '34px',
              },
            })}
          </div>`
        : null}
      ${hint || badge
        ? html`<div class="kpi__foot"><span>${hint}</span>${badge}</div>`
        : null}
    </div>
  </md-card>`;
}

/* --------------------------------------------------------------------- chips */

export function ratingChip(t, label, band, grade) {
  return html`<md-chip${attrs({
    variant: 'assist',
    appearance: 'filled',
    color: bandColor[band],
    label: grade == null ? t(`rating.${label}`) : `${t(`rating.${label}`)} · ${grade}`,
    title: t(`ratingBand.${band}`),
  })}></md-chip>`;
}

export function covenantChip(t, status) {
  return html`<md-chip${attrs({
    variant: 'assist',
    appearance: 'filled',
    color: covenantColor[status],
    label: t(`covenantStatus.${status}`),
  })}></md-chip>`;
}

export function facilityStatusChip(t, status) {
  return html`<md-chip${attrs({
    variant: 'assist',
    appearance: 'outlined',
    color: facilityColor[status],
    label: t(`facilityStatus.${status}`),
  })}></md-chip>`;
}

/** The severity, as a chip. The dot that goes with it leads the row. */
export function severityChip(t, severity) {
  return html`<md-chip${attrs({
    variant: 'assist',
    appearance: 'filled',
    color: severityColor[severity],
    label: t(`severity.${severity}`),
  })}></md-chip>`;
}

/**
 * The severity marker beside the counterparty's name, at the head of the row.
 *
 * IT CARRIES A LABEL, and that is the whole difference from the dot that used
 * to sit inside the severity cell. That one was decorative on purpose: the chip
 * immediately beside it held the same word, so naming both announced the
 * severity twice per row. Here the dot stands alone at the other end of the
 * row, so an unlabelled one would leave its colour as the only carrier of
 * meaning — exactly the failure `md-status-dot`'s `label` exists to prevent.
 */
export function severityDotMarker(t, severity) {
  return html`<md-status-dot inline${attrs({
    state: severityDot[severity],
    size: 'small',
    label: t(`severity.${severity}`),
  })}></md-status-dot>`;
}

/** The watchlist marker: a live dot plus its accessible name. */
export function watchDot(t, on) {
  return html`<md-status-dot inline${attrs({
    state: watchlistDot(on),
    size: 'medium',
    label: on ? t('kpi.watchlist') : t('facilityStatus.performing'),
  })}></md-status-dot>`;
}

export function covenantStatusDot(t, status) {
  return html`<md-status-dot inline${attrs({
    state: covenantDot[status],
    size: 'small',
    label: t(`covenantStatus.${status}`),
  })}></md-status-dot>`;
}

/* ------------------------------------------------------------------- meters */

/**
 * One covenant, as a headroom meter.
 *
 * `headroomPct` is a SIGNED fraction of the threshold and can be negative — a
 * breach. `md-meter` has no negative range, so the bar shows headroom clamped
 * into 0…50% of threshold and the sign is carried by the colour, the status
 * chip and the signed percentage text. Reading the bar alone never tells you a
 * breached covenant is fine: at a breach the bar is empty AND red.
 */
export function covenantMeter(t, covenant) {
  const headroomText = t.formatPercent(covenant.headroomPct, {
    maximumFractionDigits: 1,
    signDisplay: 'exceptZero',
  });

  return html`<div class="covenant">
    <div class="covenant__head">
      <h3 class="covenant__name">${t(`${covenant.nameKey}.abbr`)}</h3>
      ${covenantChip(t, covenant.status)}
    </div>
    <md-meter${attrs({
      value: Math.max(0, Math.min(50, covenant.headroomPct * 100)),
      min: '0',
      max: '50',
      color: covenantColor[covenant.status],
      thickness: '8',
      label: t('table.headroom'),
      'show-label': true,
      'value-text': headroomText,
      'show-value': true,
    })}></md-meter>
    <div class="covenant__figures">
      <span>${t('table.direction')}: ${t(`covenantDirection.${covenant.direction}`)}</span>
      <span class="num">${t('table.threshold')}: ${t.formatNumber(covenant.threshold, { maximumFractionDigits: 2 })}</span>
      <span class="num">${t('table.current')}: ${t.formatNumber(covenant.currentValue, { maximumFractionDigits: 2 })}</span>
      <span>${t('table.nextTest')}: ${t.formatDate(covenant.nextTestDate, 'medium')}</span>
      <span>${t(covenant.frequencyKey)}</span>
    </div>
  </div>`;
}

/** Concentration or utilisation against a cap, as a labelled linear meter. */
export function ratioMeter(t, { label, fraction, color, max = 1 }) {
  return html`<md-meter${attrs({
    value: Math.max(0, Math.min(max, fraction)) * 100,
    min: '0',
    max: max * 100,
    color,
    thickness: '10',
    label,
    'show-label': true,
    'show-value': true,
    'value-text': t.formatPercent(fraction, { maximumFractionDigits: 1 }),
  })}></md-meter>`;
}

/** A `dt`/`dd` pair inside a `.dl` grid. */
export function fact(label, value) {
  return html`<div><dt>${label}</dt><dd>${value}</dd></div>`;
}
