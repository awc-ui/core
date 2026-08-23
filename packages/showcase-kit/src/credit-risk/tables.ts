/**
 * Column layouts for the six tables, shared by every framework build.
 *
 * Two problems solved in one place.
 *
 * DUPLICATION. These templates were written twice — once in the React build,
 * once in Astro — and were about to be written four more times. They are pure
 * data describing a layout that must be IDENTICAL across builds, or two
 * screenshots of the same table stop being comparable evidence. Same reasoning
 * as the derived series next door.
 *
 * TRANSLATION. Every fixed track is `minmax(Npx, auto)` rather than a bare
 * `Npx`, and that is the important part. A bare fixed track cannot grow, so a
 * header that is longer in another language overflows it — and because these
 * are grid columns inside a horizontal scroll port, a few pixels of overflow on
 * the LAST column produces a horizontal scrollbar across the whole table, at
 * every viewport width, for the sake of two pixels.
 *
 * That was not hypothetical. Measured across all three locales, six fixed
 * tracks were too narrow for their own content:
 *
 *   Counterparties  Utilisation     104px  needed 106  (en)
 *   Counterparties  Expected loss   132px  needed 159  (ro, "Pierdere așteptată")
 *   Counterparties  PD               88px  needed 100  (ar)
 *   Counterparties  LGD              76px  needed  98  (ar)
 *   Facilities      Status          116px  needed 120  (en), 130 (ro)
 *
 * Note how badly English-only testing would have served here: the English
 * misses are 2px and 4px, easy to dismiss, while Romanian is out by 27px. Just
 * widening the numbers would also have been the wrong fix — it bakes in
 * today's translations and breaks the next time one changes. `minmax(N, auto)`
 * says what is actually meant: never narrower than N, never clipped either.
 *
 * `minWidth` is the point below which the table scrolls horizontally instead of
 * compressing further. It is roughly the sum of the track minima; below it,
 * nine columns of financial data cannot compress without becoming unreadable,
 * so scrolling is the honest behaviour.
 */

export interface TableLayout {
  /** `column-template` for `md-table`. */
  columns: string;
  /** `min-width` for `md-table` — where horizontal scrolling starts. */
  minWidth: string;
}

/** Never narrower than `px`, but free to grow for a longer translation. */
const fit = (px: number) => `minmax(${px}px, auto)`;

/** Flexible: a minimum, then a share of whatever is left. */
const flex = (px: number, fr: number) => `minmax(${px}px, ${fr}fr)`;

export const TABLES = {
  /**
   * The counterparty book. `sector` is dropped on a sector screen, where every
   * row would repeat the sector already named in the heading.
   */
  counterparties: (showSector: boolean): TableLayout => ({
    columns: [
      flex(200, 2),
      showSector ? flex(120, 1) : '',
      flex(120, 1),
      fit(108), // rating chip
      fit(96), // PD — Arabic needs 100
      fit(96), // LGD — Arabic needs 98
      fit(132), // EAD
      fit(160), // expected loss — Romanian needs 159
      fit(132), // RWA
      fit(112), // utilisation
    ]
      .filter(Boolean)
      .join(' '),
    minWidth: '1180px',
  }),

  /** Facilities booked to one counterparty. */
  facilities: {
    columns: [
      fit(132),
      flex(150, 1),
      fit(96),
      flex(150, 1.2),
      fit(128),
      fit(120),
      fit(104),
      fit(108),
      fit(132), // status chip — Romanian needs 130
    ].join(' '),
    minWidth: '1120px',
  } satisfies TableLayout,

  /** Early-warning signals. */
  watchlist: {
    columns: [
      flex(200, 1.6),
      flex(140, 1),
      fit(100),
      flex(170, 1.2),
      fit(156),
      fit(132),
      fit(120),
      fit(120),
      flex(150, 1),
    ].join(' '),
    minWidth: '1280px',
  } satisfies TableLayout,

  /** Per-sector stress results. */
  stress: {
    columns: [
      flex(150, 1.4),
      flex(120, 1),
      fit(104),
      fit(104),
      flex(130, 1),
      flex(130, 1),
      flex(130, 1),
      flex(130, 1),
    ].join(' '),
    minWidth: '1120px',
  } satisfies TableLayout,

  /** Collateral pledged against one facility. */
  collateral: {
    columns: [
      flex(150, 1.2),
      fit(88),
      flex(130, 1),
      flex(130, 1),
      fit(96),
      flex(130, 1),
      fit(128),
      flex(150, 1),
    ].join(' '),
    minWidth: '1060px',
  } satisfies TableLayout,

  /** Drawdown / repayment schedule. */
  schedule: {
    columns: [
      fit(110),
      flex(130, 1),
      flex(130, 1),
      flex(130, 1),
      flex(130, 1),
      fit(108),
    ].join(' '),
    minWidth: '820px',
  } satisfies TableLayout,
} as const;
