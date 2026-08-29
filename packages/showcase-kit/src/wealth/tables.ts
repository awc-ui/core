/**
 * Column layouts for the console's tables, shared by every framework build.
 *
 * Two problems solved in one place, and they are the same two the credit-risk
 * layouts solve.
 *
 * DUPLICATION. These templates are pure data describing a layout that must be
 * IDENTICAL across builds, or two screenshots of the same table stop being
 * comparable evidence.
 *
 * TRANSLATION. Every fixed track is `minmax(Npx, auto)` rather than a bare
 * `Npx`, and that is the important part. A bare fixed track cannot grow, so a
 * header that is longer in another language overflows it — and because these
 * are grid columns inside a horizontal scroll port, a few pixels of overflow on
 * the LAST column produces a horizontal scrollbar across the whole table, at
 * every viewport width, for the sake of two pixels. The credit-risk layouts
 * measured six such misses across three locales, one of them 27px. This
 * vertical ships English strings today; using `minmax` from the start means the
 * Romanian and Arabic dictionaries can be added later without re-measuring
 * every track.
 *
 * `minWidth` is the point below which the table scrolls horizontally instead of
 * compressing further. It is roughly the sum of the track minima; below it, a
 * holdings row cannot compress without becoming unreadable, so scrolling is the
 * honest behaviour.
 *
 * WHERE THESE GO. `column-template` and `min-width` are `md-table` props. The
 * toolbar and the pagination do NOT go inside the table — `md-table-container`
 * wraps `md-table` and carries them in its `top` and `bottom` slots.
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
   * The advisor's book, on the overview.
   *
   * `advisor` is dropped when the whole table belongs to one advisor, where
   * every row would repeat the name already in the app bar.
   */
  households: (showAdvisor: boolean): TableLayout => ({
    columns: [
      flex(220, 2), // household name + status dot
      fit(132), // segment chip
      fit(140), // mandate chip
      fit(128), // strategy chip
      fit(148), // AUM
      fit(120), // YTD return
      fit(148), // unrealised P/L
      fit(96), // members
      showAdvisor ? flex(150, 1) : '',
      fit(132), // next review
    ]
      .filter(Boolean)
      .join(' '),
    minWidth: showAdvisor ? '1440px' : '1290px',
  }),

  /**
   * Holdings, across the book or inside one mandate.
   *
   * `household` is dropped on a household screen; `weight` means "share of the
   * mandate" there and "share of the book" on the holdings screen, which is why
   * the header key differs even though the track does not.
   */
  positions: (showHousehold: boolean): TableLayout => ({
    columns: [
      fit(96), // ticker
      flex(220, 2), // instrument name
      showHousehold ? flex(170, 1.2) : '',
      fit(132), // asset class chip
      fit(88), // currency
      fit(112), // quantity
      fit(112), // price
      fit(148), // market value (EUR)
      fit(140), // unrealised P/L
      fit(112), // P/L %
      fit(104), // weight
      fit(112), // day change
    ]
      .filter(Boolean)
      .join(' '),
    minWidth: showHousehold ? '1620px' : '1450px',
  }),

  /** The instrument universe, on the holdings screen's second view. */
  instruments: {
    columns: [
      fit(96), // ticker
      flex(230, 2), // name
      fit(128), // type chip
      fit(132), // asset class chip
      fit(140), // sector
      fit(132), // region
      fit(88), // currency
      fit(112), // price
      fit(112), // day change
      fit(124), // 12m return
      fit(120), // sparkline
    ].join(' '),
    minWidth: '1500px',
  } satisfies TableLayout,

  /** Members of one household. */
  clients: {
    columns: [
      flex(200, 1.6), // name + KYC dot
      fit(132), // role chip
      fit(96), // age
      fit(120), // domicile
      fit(140), // risk tolerance chip
      fit(132), // KYC chip
      fit(140), // KYC review date
      flex(220, 1.4), // contact
    ].join(' '),
    minWidth: '1180px',
  } satisfies TableLayout,

  /**
   * Target versus actual, per asset class.
   *
   * Narrow on purpose: five rows and no free text, so it sits beside a donut
   * rather than under it.
   */
  allocation: {
    columns: [
      flex(160, 1.4), // asset class
      fit(120), // target
      fit(120), // actual
      fit(112), // drift
      fit(104), // drift bps
      fit(148), // market value
      fit(152), // rebalance amount
      fit(128), // status chip
    ].join(' '),
    minWidth: '1040px',
  } satisfies TableLayout,

  /** Objectives, on the planning screen. */
  goals: (showHousehold: boolean): TableLayout => ({
    columns: [
      flex(190, 1.5), // goal type + beneficiary
      showHousehold ? flex(180, 1.2) : '',
      fit(120), // priority chip
      fit(148), // target amount
      fit(132), // target date
      fit(148), // current amount
      fit(160), // funded meter
      fit(148), // projected
      fit(140), // shortfall
      fit(128), // status chip
    ]
      .filter(Boolean)
      .join(' '),
    minWidth: showHousehold ? '1560px' : '1380px',
  }),

  /** Advice documents in flight. */
  proposals: {
    columns: [
      fit(104), // id
      flex(190, 1.4), // household
      fit(148), // type chip
      fit(148), // status chip
      fit(180), // step progress
      fit(152), // estimated value
      fit(136), // created
      fit(116), // days open
      flex(150, 1), // advisor
    ].join(' '),
    minWidth: '1400px',
  } satisfies TableLayout,

  /**
   * The blotter.
   *
   * `quantity` and `filled` sit next to each other on purpose: a partial fill is
   * only legible when the two numbers are adjacent.
   */
  orders: {
    columns: [
      fit(104), // id
      fit(96), // side chip
      fit(96), // ticker
      flex(200, 1.6), // instrument
      flex(170, 1.2), // household
      fit(116), // quantity
      fit(116), // filled
      fit(128), // order type chip
      fit(112), // limit price
      fit(104), // time in force
      fit(152), // estimated value
      fit(140), // status chip
      fit(136), // created
    ].join(' '),
    minWidth: '1720px',
  } satisfies TableLayout,

  /** The audit trail. */
  activity: {
    columns: [
      fit(160), // timestamp
      fit(140), // category chip
      flex(200, 1.4), // action
      flex(180, 1.2), // household
      flex(180, 1.2), // target
      flex(150, 1), // actor
    ].join(' '),
    minWidth: '1060px',
  } satisfies TableLayout,
} as const;
