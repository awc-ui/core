/**
 * Column layouts for this vertical's tables, shared by every framework build.
 *
 * The same two problems the other verticals' layouts solve, solved the same
 * way. DUPLICATION: these templates are pure data describing a layout that must
 * be IDENTICAL across builds, or two screenshots of the same table stop being
 * comparable evidence. TRANSLATION: every fixed track is `minmax(Npx, auto)`
 * rather than a bare `Npx`, because a bare fixed track cannot grow and a header
 * that is longer in another language overflows it — and a few pixels of
 * overflow on the LAST column produces a horizontal scrollbar across the whole
 * table at every viewport width.
 *
 * `minWidth` is the point below which the table scrolls horizontally instead of
 * compressing further.
 */

export interface TableLayout {
  /** `column-template` for `md-table`. */
  columns: string;
  /** `min-width` for `md-table` — where horizontal scrolling starts. */
  minWidth: string;
}

/** Never narrower than `px`, but free to grow for a longer translation. */
const fit = (px: number) => `minmax(${px}px, auto)`;

export const TABLES = {
  /**
   * The statement.
   *
   * The merchant column is the flexible one (`1.6fr`) because a merchant name
   * is the longest and least predictable value in the row; everything else is
   * a figure, a date or a chip, all of which have a knowable width.
   */
  transactions: (): TableLayout => ({
    columns: [
      fit(112), // date
      '1.6fr', // merchant / counterparty
      fit(132), // category
      fit(104), // type
      fit(112), // status
      fit(128), // amount
    ].join(' '),
    minWidth: '760px',
  }),

  /** Holdings in the investing account. */
  holdings: (): TableLayout => ({
    columns: [
      fit(96), // ticker
      '1.4fr', // name
      fit(96), // kind
      fit(112), // quantity
      fit(120), // price
      fit(128), // value
      fit(128), // P/L
      fit(104), // P/L %
      fit(104), // allocation
    ].join(' '),
    minWidth: '1040px',
  }),

  /** The instrument list on the invest screen — watchlist and universe alike. */
  instruments: (): TableLayout => ({
    columns: [
      fit(96), // ticker
      '1.4fr', // name
      fit(96), // kind
      fit(120), // price
      fit(104), // day
      fit(104), // week
      fit(104), // year
    ].join(' '),
    minWidth: '820px',
  }),

  /** Trade history. */
  trades: (): TableLayout => ({
    columns: [
      fit(112), // date
      fit(96), // ticker
      fit(88), // side
      fit(112), // quantity
      fit(120), // price
      fit(128), // amount
      fit(104), // status
    ].join(' '),
    minWidth: '780px',
  }),

  /** Recurring payments. */
  subscriptions: (): TableLayout => ({
    columns: [
      '1.4fr', // merchant
      fit(120), // cadence
      fit(128), // amount
      fit(132), // next charge
      fit(112), // card
      fit(104), // state
    ].join(' '),
    minWidth: '780px',
  }),
} as const;
