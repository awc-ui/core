/**
 * Domain value → component vocabulary.
 *
 * `md-chip`, `md-meter`, `md-badge` and `md-status-dot` each take a fixed
 * enumeration (`color`, `state`). Mapping banking states onto them in ONE place
 * keeps an over-budget category the same red everywhere, and keeps the mapping
 * auditable — the alternative is a `status === 'over' ? 'error' : …` ternary in
 * nine files that drift apart.
 *
 * Nothing here produces a visible string. The label always comes from the
 * dictionary key beside the value (`banking.category.${category}` and friends).
 *
 * ONE RULE THIS VERTICAL ADDS, and every screen depends on it: DIRECTION IS
 * NOT SENTIMENT. Money out is not an error and money in is not a success —
 * a €3,200 salary and a €42 coffee run are both ordinary. `flowColor()` below
 * is deliberately restrained: green for credits, the plain body colour for
 * debits, and red reserved for what actually went wrong (a declined card, a
 * budget breached). A statement that paints every purchase red is unreadable
 * after four rows.
 */

import type {
  BudgetStatus,
  Category,
  CardState,
  InstrumentKind,
  TradeSide,
  TradeStatus,
  TransactionStatus,
  TransactionType,
} from './types';

/** The `color` enumeration shared by md-chip, md-meter, md-badge and md-progress-indicator. */
export type MdColor =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'error'
  | 'success'
  | 'warning'
  | 'info';

/** The `state` enumeration of md-status-dot. */
export type MdDotState = 'online' | 'away' | 'busy' | 'offline' | 'invisible' | 'neutral';

/* ------------------------------------------------------------------ budget */

export const budgetColor: Record<BudgetStatus, MdColor> = {
  under: 'success',
  near: 'warning',
  over: 'error',
};

export const budgetDot: Record<BudgetStatus, MdDotState> = {
  under: 'online',
  near: 'away',
  over: 'busy',
};

/* ------------------------------------------------------------------- cards */

/**
 * `frozen` is amber and `blocked` is red, and the difference is the point.
 *
 * Freezing is a thing the holder did and can undo in one tap; blocking is
 * terminal and means a card was lost. Painting both red would tell a reader
 * their own precaution is a problem.
 */
export const cardStateColor: Record<CardState, MdColor> = {
  active: 'success',
  frozen: 'warning',
  blocked: 'error',
};

export const cardStateDot: Record<CardState, MdDotState> = {
  active: 'online',
  frozen: 'away',
  blocked: 'busy',
};

/* ------------------------------------------------------- transaction state */

/**
 * Only `declined` is an error. `pending` is amber because it is genuinely
 * provisional — the amount can still change — and `reverted` is neutral
 * because a reversal is the system working, not failing.
 */
export const txnStatusColor: Record<TransactionStatus, MdColor> = {
  completed: 'success',
  pending: 'warning',
  reverted: 'info',
  declined: 'error',
};

export const txnStatusDot: Record<TransactionStatus, MdDotState> = {
  completed: 'online',
  pending: 'away',
  reverted: 'neutral',
  declined: 'busy',
};

/** The Material Symbols ligature for each way money moved. */
export const txnTypeIcon: Record<TransactionType, string> = {
  card: 'credit_card',
  transfer: 'sync_alt',
  exchange: 'currency_exchange',
  topup: 'add_circle',
  atm: 'local_atm',
  fee: 'receipt_long',
  refund: 'undo',
  dividend: 'savings',
  trade: 'trending_up',
};

/* -------------------------------------------------------------- categories */

/**
 * The category palette.
 *
 * A category has to be the same colour in the analytics ring, the row's leading
 * glyph and the budget meter, or the three stop being readable together. Seven
 * `MdColor` values for twelve categories means repeats are unavoidable; the
 * repeats are placed so that two categories sharing a colour never appear
 * adjacent in the ring, which is ordered by amount.
 */
export const categoryColor: Record<Category, MdColor> = {
  groceries: 'success',
  transport: 'info',
  eatingOut: 'warning',
  shopping: 'tertiary',
  entertainment: 'secondary',
  travel: 'primary',
  bills: 'info',
  health: 'error',
  cash: 'secondary',
  transfers: 'tertiary',
  investing: 'primary',
  income: 'success',
};

export const categoryIcon: Record<Category, string> = {
  groceries: 'shopping_basket',
  transport: 'directions_bus',
  eatingOut: 'restaurant',
  shopping: 'shopping_bag',
  entertainment: 'confirmation_number',
  travel: 'flight',
  bills: 'receipt',
  health: 'medical_services',
  cash: 'payments',
  transfers: 'swap_horiz',
  investing: 'trending_up',
  income: 'account_balance',
};

/* --------------------------------------------------------------- investing */

export const instrumentKindColor: Record<InstrumentKind, MdColor> = {
  stock: 'primary',
  etf: 'info',
  crypto: 'tertiary',
};

export const tradeSideColor: Record<TradeSide, MdColor> = {
  buy: 'success',
  sell: 'warning',
};

export const tradeStatusColor: Record<TradeStatus, MdColor> = {
  filled: 'success',
  pending: 'warning',
  cancelled: 'error',
};

/* ---------------------------------------------------------------- movement */

/**
 * The colour a SIGNED amount is printed in.
 *
 * Dead-banded on purpose: an amount of exactly zero is neither, and a debit is
 * the ordinary case rather than a bad one. Callers that want a P/L colouring —
 * where down genuinely is bad — use `plColor` below instead.
 */
export function flowColor(amount: number): MdColor | null {
  if (amount > 0) return 'success';
  return null;
}

/**
 * Profit and loss, where direction IS sentiment.
 *
 * Used by the invest screen and nowhere else. Dead-banded around zero so a
 * holding that has not moved is not painted as a tiny gain.
 */
export function plColor(value: number): MdColor | null {
  if (value > 0.00005) return 'success';
  if (value < -0.00005) return 'error';
  return null;
}
