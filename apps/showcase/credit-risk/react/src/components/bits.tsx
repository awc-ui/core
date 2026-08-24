/**
 * The small, repeated pieces: a KPI tile, the chips that carry a credit state,
 * and the covenant meter.
 *
 * Every one of them takes a domain value and resolves BOTH halves of it through
 * the kit: the colour through the status maps in
 * `@awc-ui/showcase-kit/credit-risk`, the label through the dictionary key that
 * travels beside the value (`covenantStatus.${status}`, `rating.${label}`,
 * `severity.${severity}`). Nothing here can render English into a Romanian
 * page, because nothing here contains English.
 */

import type { ReactNode } from 'react';
import type {
  Covenant,
  CovenantStatus,
  FacilityStatus,
  RatingBand,
  RatingLabel,
  SignalSeverity,
} from '@awc-ui/showcase-kit/data';
import { useShowcase, useT } from '@/lib/showcase';
import {
  bandColor,
  covenantColor,
  covenantDot,
  facilityColor,
  severityColor,
  severityDot,
  watchlistDot,
} from '@awc-ui/showcase-kit/credit-risk';
import { Sparkline } from './elements';

/* ----------------------------------------------------------------- KPI tile */

export function KpiTile({
  label,
  value,
  hint,
  trend,
  trendLabels,
  formatTrend,
  color = 'primary',
  badge,
}: {
  label: string;
  value: string;
  hint?: ReactNode;
  /** Historical values for the sparkline, oldest first. */
  trend?: number[];
  /** Tooltip x labels — quarters or month-end dates, already formatted. */
  trendLabels?: string[];
  formatTrend?: (value: number | null) => string;
  color?: string;
  badge?: ReactNode;
}) {
  const { state } = useShowcase();
  return (
    <md-card variant="filled" full-width>
      <div className="kpi">
        <p className="kpi__label">{label}</p>
        <p className="kpi__value">{value}</p>
        {trend && trend.length > 1 ? (
          <div className="kpi__spark">
            <Sparkline
              data={trend}
              labels={trendLabels}
              valueFormatter={formatTrend}
              locale={state.locale}
              variant="area"
              color={color}
              curve="monotone"
              show-marks="extremes"
              height="34px"
            />
          </div>
        ) : null}
        {hint || badge ? (
          <div className="kpi__foot">
            <span>{hint}</span>
            {badge}
          </div>
        ) : null}
      </div>
    </md-card>
  );
}

/* --------------------------------------------------------------------- chips */

export function RatingChip({ label, band, grade }: { label: RatingLabel; band: RatingBand; grade?: number }) {
  const t = useT();
  return (
    <md-chip
      variant="assist"
      appearance="filled"
      color={bandColor[band]}
      label={grade == null ? t(`rating.${label}`) : `${t(`rating.${label}`)} · ${grade}`}
      title={t(`ratingBand.${band}`)}
    />
  );
}

export function CovenantChip({ status }: { status: CovenantStatus }) {
  const t = useT();
  return (
    <md-chip variant="assist" appearance="filled" color={covenantColor[status]} label={t(`covenantStatus.${status}`)} />
  );
}

export function FacilityStatusChip({ status }: { status: FacilityStatus }) {
  const t = useT();
  return (
    <md-chip variant="assist" appearance="outlined" color={facilityColor[status]} label={t(`facilityStatus.${status}`)} />
  );
}

/** The severity, as a chip. The dot that goes with it lives in the first column. */
export function SeverityChip({ severity }: { severity: SignalSeverity }) {
  const t = useT();
  return (
    <md-chip variant="assist" appearance="filled" color={severityColor[severity]} label={t(`severity.${severity}`)} />
  );
}

/**
 * The severity marker beside the counterparty's name, at the head of the row.
 *
 * IT CARRIES A LABEL, and that is the whole difference from the dot that used
 * to sit inside the severity cell. That one was decorative on purpose: the chip
 * immediately beside it held the same word, so naming both announced the
 * severity twice per row. Here the dot stands alone at the other end of the
 * row, so an unlabelled one would leave its colour as the only carrier of
 * meaning — which is exactly the failure `md-status-dot`'s `label` exists to
 * prevent.
 */
export function SeverityDot({ severity }: { severity: SignalSeverity }) {
  const t = useT();
  return <md-status-dot inline state={severityDot[severity]} size="small" label={t(`severity.${severity}`)} />;
}

/** The watchlist marker: a live dot plus its accessible name. */
export function WatchDot({ on }: { on: boolean }) {
  const t = useT();
  return <md-status-dot inline state={watchlistDot(on)} size="medium" label={on ? t('kpi.watchlist') : t('facilityStatus.performing')} />;
}

/* ------------------------------------------------------------------- meters */

/**
 * One covenant, as a headroom meter.
 *
 * `headroomPct` is a SIGNED fraction of the threshold and can be negative — a
 * breach. `md-meter` has no negative range, so the bar shows headroom clamped
 * into 0…50% of threshold and the sign is carried by the colour, the status chip
 * and the signed percentage text. Reading the bar alone never tells you a
 * breached covenant is fine: at a breach the bar is empty AND red.
 */
export function CovenantMeter({ covenant }: { covenant: Covenant }) {
  const t = useT();
  const headroomText = t.formatPercent(covenant.headroomPct, {
    maximumFractionDigits: 1,
    signDisplay: 'exceptZero',
  });

  return (
    <div className="covenant">
      <div className="covenant__head">
        <h3 className="covenant__name">{t(`${covenant.nameKey}.abbr`)}</h3>
        <CovenantChip status={covenant.status} />
      </div>
      <md-meter
        value={Math.max(0, Math.min(50, covenant.headroomPct * 100))}
        min="0"
        max="50"
        color={covenantColor[covenant.status]}
        thickness="8"
        label={t('table.headroom')}
        show-label
        value-text={headroomText}
        show-value
      />
      <div className="covenant__figures">
        <span>
          {t('table.direction')}: {t(`covenantDirection.${covenant.direction}`)}
        </span>
        <span className="num">
          {t('table.threshold')}: {t.formatNumber(covenant.threshold, { maximumFractionDigits: 2 })}
        </span>
        <span className="num">
          {t('table.current')}: {t.formatNumber(covenant.currentValue, { maximumFractionDigits: 2 })}
        </span>
        <span>
          {t('table.nextTest')}: {t.formatDate(covenant.nextTestDate, 'medium')}
        </span>
        <span>{t(covenant.frequencyKey)}</span>
      </div>
    </div>
  );
}

/** Concentration or utilisation against a cap, as a labelled linear meter. */
export function RatioMeter({
  label,
  fraction,
  color,
  max = 1,
}: {
  label: string;
  fraction: number;
  color: string;
  max?: number;
}) {
  const t = useT();
  return (
    <md-meter
      value={Math.max(0, Math.min(max, fraction)) * 100}
      min="0"
      max={max * 100}
      color={color}
      thickness="10"
      label={label}
      show-label
      show-value
      value-text={t.formatPercent(fraction, { maximumFractionDigits: 1 })}
    />
  );
}

/** A `dt`/`dd` pair inside a `.dl` grid. */
export function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** Also known as the covenant status dot, reused in the covenants table. */
export function CovenantDot({ status }: { status: CovenantStatus }) {
  const t = useT();
  return <md-status-dot inline state={covenantDot[status]} size="small" label={t(`covenantStatus.${status}`)} />;
}
