/**
 * The placeholder shapes every screen shows while it settles.
 *
 * PLAIN DOM, NOT `md-skeleton`. Every shape here is a `<div class="skel">`
 * styled from tokens in `app.css`, and that is the single most important thing
 * about this file.
 *
 * The obvious version used `md-skeleton` and `md-card` — the library HAS a
 * skeleton component, and §5.5 recommends it. But those are lazily-hydrated
 * custom elements exactly like the content they stand in for, so the placeholder
 * caught the same disease it was there to treat: measured on holdings, the
 * placeholder was 172px tall for three frames, 228px for one more, and only then
 * its real 1986. A loading state that pops open cannot hide a loading state that
 * pops open. Divs have their size in the first paint, before a chunk has
 * loaded — which is the only property a placeholder actually needs.
 *
 * `md-skeleton` remains the right answer for a placeholder INSIDE an already-
 * hydrated screen — a panel waiting on one fetch, a row streaming in. It is the
 * wrong answer for the placeholder that covers a screen's own first paint.
 *
 * THE PLACEHOLDER NO LONGER HAS TO BE THE RIGHT HEIGHT. It is absolutely
 * positioned over the real content, which keeps its own box the whole time (see
 * the note in `Shell.tsx`), so revealing is a `visibility` flip with no reflow.
 * The heights below are still measured rather than invented, because the shape
 * should look like what is coming — but a few pixels out no longer moves the
 * page, and chasing exact heights across every breakpoint is what this design
 * replaced.
 *
 * THE BEAT IS A CONSTANT, NEVER A MEASURED DURATION. These screens read
 * synchronous selectors out of the kit — there is no network here, and the pause
 * exists to demonstrate the pattern rather than to cover a real wait. A
 * clock-derived or random delay would also make two runs of the showcase
 * disagree, which the cross-framework parity check cannot tolerate.
 */

import type { CSSProperties } from 'react';

/**
 * How long the placeholder layout is shown for, in milliseconds.
 *
 * Long enough to be seen — below ~300ms a placeholder only flashes — and short
 * enough not to be in the way. `?skeleton=hold` or `?skeleton=<ms>` overrides it
 * for inspection; see `useScreenReady` in `Shell.tsx`.
 */
export const SKELETON_MS = 550;

/**
 * One placeholder bar with a corner of its own.
 *
 * A single `border-radius` for everything would be wrong in both directions:
 * measured off the real holdings filter bar, `md-search` is a 9999px pill, an
 * outlined text field is 4px, `md-chip` is 8px and `md-split-button` is 20px.
 *
 * `flex` is how a bar takes the SAME share of a `.row` its control does — the
 * fields in that bar are laid out by `flex: 1 1 260px` and friends, and a
 * placeholder that guessed a percentage instead would break at the first
 * breakpoint.
 */
export function Bar({
  radius,
  height,
  width,
  flex,
}: {
  /** A CSS length. The control's own corner, measured, not a guess. */
  radius: string;
  height: string;
  /** Omit to let the bar fill its box. */
  width?: string;
  flex?: string;
}) {
  return (
    <div
      className="skel"
      style={
        {
          blockSize: height,
          inlineSize: width ?? (flex ? undefined : '100%'),
          borderRadius: radius,
          ...(flex ? { flex } : null),
        } as CSSProperties
      }
    />
  );
}

/**
 * A KPI tile's shape: label line, value line, optional sparkline, foot line.
 *
 * `spark` is what the tile actually has, not decoration. `KpiTile` draws a
 * sparkline only when the screen gives it one — the overview's tiles do, the
 * holdings tiles do not.
 *
 * `foot` is the same fact about the tile's last line: a foot carrying a bare
 * hint is one 16px text line; a foot carrying a chip beside that text is 32,
 * because the chip is 32.
 */
export function KpiSkeleton({
  announce,
  label,
  spark = true,
  foot = '32px',
}: {
  announce?: boolean;
  label?: string;
  spark?: boolean;
  /** `'32px'` when the real tile's foot holds a chip, `'16px'` when it is text alone. */
  foot?: string;
}) {
  return (
    <div className="skel-card skel-card--filled">
      {/* The heights are the tile's OWN, measured off a rendered `KpiTile`: a
          16px label, a 32px value, a 34px sparkline, and a foot of 16 or 32. */}
      <div className="kpi">
        <div
          className="skel"
          style={{ blockSize: '16px', inlineSize: '60%' }}
          role={announce ? 'status' : undefined}
          aria-label={announce ? label : undefined}
        />
        <div className="skel" style={{ blockSize: '32px', inlineSize: '45%' }} />
        {spark ? (
          <div className="kpi__spark">
            <div className="skel" style={{ blockSize: '34px', inlineSize: '100%' }} />
          </div>
        ) : null}
        <div className="skel" style={{ blockSize: foot, inlineSize: '70%' }} />
      </div>
    </div>
  );
}

/** A panel's shape: a head, then one block the size the real content will be. */
export function PanelSkeleton({ height, lines = 0 }: { height?: string; lines?: number }) {
  return (
    <div className="skel-card panel">
      <div className="panel__inner">
        <div className="panel__head">
          <div className="skel" style={{ blockSize: '20px', inlineSize: '140px' }} />
          <div className="skel" style={{ blockSize: '20px', inlineSize: '60px' }} />
        </div>
        {height ? <div className="skel" style={{ blockSize: height, inlineSize: '100%' }} /> : null}
        {lines > 0
          ? Array.from({ length: lines }, (_, i) => (
              <div
                key={i}
                className="skel"
                style={{ blockSize: '16px', inlineSize: i === lines - 1 ? '60%' : '100%' }}
              />
            ))
          : null}
      </div>
    </div>
  );
}

/**
 * A table's shape: the panel head, then one block where the rows will be.
 *
 * `height` overrides the row arithmetic when the real table's height is known
 * and is not a whole number of 40px rows — a pagination bar, a toolbar with a
 * wrapped filter row.
 */
export function TableSkeleton({ rows = 8, height }: { rows?: number; height?: string }) {
  return (
    <div className="table-host">
      <div className="skel-card panel">
        <div className="panel__inner">
          <div className="panel__head">
            <div className="skel" style={{ blockSize: '20px', inlineSize: '120px' }} />
            <div className="skel" style={{ blockSize: '20px', inlineSize: '220px' }} />
          </div>
          {/* One block rather than a row of bars: a table's rows are uniform,
              and N stacked bars at row height is the same grey rectangle with
              more elements in the accessibility tree. */}
          <div
            className="skel"
            style={{ blockSize: height ?? `${rows * 40}px`, inlineSize: '100%' }}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * The shape a screen gets when it has not described its own.
 *
 * IT IS NO LONGER THE COMMON CASE, and that is the point. This used to be what
 * five of the six screens opened with; every one of them now passes its own
 * `skeleton` to `<Screen>`, because "a KPI row and two panels" was never any of
 * their real layouts. What is left on this fallback is the not-found screen and
 * the household guard — pages with nothing much to stand in for.
 *
 * So treat a screen reaching this as one that has not been measured yet.
 * Tailoring one is the pattern in `HoldingsScreen.tsx`.
 */
export function ScreenSkeleton({
  kpis = 4,
  panels = 2,
  label,
}: {
  kpis?: number;
  panels?: number;
  label?: string;
}) {
  return (
    <>
      {kpis > 0 ? (
        <section className="kpi-grid">
          {Array.from({ length: kpis }, (_, i) => (
            <KpiSkeleton key={i} announce={i === 0} label={label} />
          ))}
        </section>
      ) : null}

      <section className="grid-2">
        {Array.from({ length: panels }, (_, i) => (
          <PanelSkeleton key={i} lines={8} />
        ))}
      </section>
    </>
  );
}
