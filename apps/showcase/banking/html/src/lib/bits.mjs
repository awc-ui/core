/**
 * The small, repeated pieces: formatted figures, the chips that carry a domain
 * state, the meters, and the KPI tile.
 *
 * Every one of them takes a domain value and resolves BOTH halves of it through
 * the kit: the COLOUR through the status maps in `@awc-ui/showcase-kit/banking`,
 * the LABEL through the dictionary key that travels beside the value
 * (`household.strategyKey`, `goal.statusKey`, `order.sideKey`). Nothing here
 * contains English, so nothing here can render English into a translated page.
 *
 * THIS IS THE CONTRACT FOR SCREENS. If you are writing one of the six screens:
 *
 *   - Never call `Intl` and never call `toFixed`. Money goes through `money()`,
 *     ratios through `percent()`, signed figures through `signed()`, dates
 *     through `dateText()`. They are pinned to the page's locale and to UTC.
 *   - Never write `status === 'breach' ? 'error' : …`. Use the chip or the dot.
 *   - Never hardcode a chip's `color`. Every mapping is already in the kit.
 *   - A `…Key` field is a dictionary key, not a label. Pass it to `t()`.
 *
 * Each helper takes the translator explicitly. There is no context to read it
 * from: these run once per page at build time, and the locale is a property of
 * the route.
 */

import {
  budgetColor,
  cardStateColor,
  categoryColor,
  categoryIcon,
  flowColor,
  instrumentKindColor,
  plColor,
  tradeSideColor,
  tradeStatusColor,
  txnStatusColor,
  txnTypeIcon,
} from '@awc-ui/showcase-kit/banking';
import { attrs, escape, html, raw } from './html.mjs';
import { sparkline } from './charts.mjs';
import { localeHref } from './i18n.mjs';

/* ------------------------------------------------------------- formatting */

/**
 * A money amount.
 *
 * `currency` defaults to EUR because every aggregate in the fixture is in EUR;
 * pass a position's or an order's own `currency` for a local amount. `compact`
 * gives €3.2m — the right choice for a KPI tile or a chart axis, the wrong one
 * for a table cell where the reader is comparing figures digit by digit.
 */
export function money(t, value, { currency = 'EUR', compact = false, digits } = {}) {
  /*
   * TWO DECIMALS BY DEFAULT in standard notation. The wealth console's default
   * is whole units, right for a book measured in millions. A current account
   * holds €4,218.64, and rendering that as "€4,219" is not a rounding, it is a
   * different balance.
   */
  const places = digits ?? (compact ? undefined : 2);
  return html`<span class="num">${t.formatCurrency(value, {
    currency,
    notation: compact ? 'compact' : 'standard',
    maximumFractionDigits: places,
    minimumFractionDigits: places,
  })}</span>`;
}

/**
 * A ratio, as a percentage.
 *
 * The value is a FRACTION — `0.0135` renders as `1.35%`. Every ratio in the
 * fixture is stored that way, so pass it straight in and never multiply by 100
 * first.
 */
export function percent(t, value, { digits = 2, sign = false } = {}) {
  return html`<span class="num">${t.formatPercent(value, {
    maximumFractionDigits: digits,
    minimumFractionDigits: Math.min(digits, 1),
    signDisplay: sign ? 'exceptZero' : undefined,
  })}</span>`;
}

/**
 * A signed figure — profit and loss, an excess return, a drift.
 *
 * THE COLOUR IS NEVER THE ONLY CARRIER. The sign is always in the text
 * (`signDisplay: 'exceptZero'`), so the cell still says which way it went in
 * monochrome, in a screenshot, and to a reader who cannot distinguish the two
 * hues. `plColor` has a dead band: a move smaller than the rounding scale is
 * neither green nor red, which is what stops a table of near-flat positions
 * reading as a chequerboard.
 *
 * `<bdi>`, NOT `<span>`. The money branch composes its `+` by hand, because
 * the kit's `CurrencyOptions` has no `signDisplay` to hand to `Intl`. A leading
 * `+` is a bidi-NEUTRAL character, so under `dir="rtl"` the algorithm resolves
 * it against the paragraph direction and moves it to the other end: `+€1.5m`
 * renders as `€1.5m+`, which reads as a different number. `<bdi>` isolates the
 * run and auto-detects its direction from its own first strong character, so
 * the sign stays where it was written. The percent branch does not need it —
 * `Intl` places that sign itself and gets the bidi right — but one wrapper for
 * both keeps the two from drifting.
 */
export function signed(t, value, { kind = 'money', currency = 'EUR', compact = false, digits } = {}) {
  // The dead band is a fraction for percentages and a currency unit for money —
  // half a cent is not a move, but half a euro on a €40m book is not either.
  const color = plColor(value, kind === 'percent' ? 0.0005 : 1);
  const className = color === 'success' ? 'pl-up' : color === 'error' ? 'pl-down' : 'pl-flat';

  const text =
    kind === 'percent'
      ? t.formatPercent(value, {
          maximumFractionDigits: digits ?? 2,
          minimumFractionDigits: Math.min(digits ?? 2, 1),
          signDisplay: 'exceptZero',
        })
      : `${value > 0 ? '+' : ''}${t.formatCurrency(value, {
          currency,
          notation: compact ? 'compact' : 'standard',
          maximumFractionDigits: digits ?? (compact ? undefined : 2),
          minimumFractionDigits: digits ?? (compact ? undefined : 2),
        })}`;

  return html`<bdi${attrs({ class: `num ${className}` })}>${text}</bdi>`;
}

/**
 * A count, as a small chip.
 *
 * This is what goes in a KPI tile's `trailing` slot and beside a panel title —
 * NOT `md-badge`. A badge has to sit on a host it can overlap, and dropped into
 * a card's foot it anchors to the card's corner and is clipped in half. A chip
 * is a standalone element that takes its own space, which is what a count in a
 * row of facts actually is.
 */
export function count(t, value, { color = 'primary' } = {}) {
  return html`<md-chip${attrs({
    variant: 'assist',
    appearance: 'outlined',
    color,
    label: t.formatNumber(value, { maximumFractionDigits: 0 }),
  })}></md-chip>`;
}

/** A plain number: a quantity, a count, a basis-point figure. */
export function num(t, value, { digits = 0 } = {}) {
  return html`<span class="num">${t.formatNumber(value, {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  })}</span>`;
}

/**
 * A calendar date.
 *
 * Rendered inside a `<time>` with a machine-readable `datetime`, so the ISO
 * value survives even though the visible text is localised. `formatDate` is
 * pinned to UTC in the kit, so 2026-06-30 is 30 June west of Greenwich too.
 */
export function dateText(t, value, style = 'medium') {
  return html`<time${attrs({ datetime: value })}>${t.formatDate(value, style)}</time>`;
}

/** A full UTC instant from the audit trail. The date part is what is shown. */
export function timestampText(t, value) {
  return html`<time${attrs({ datetime: value })}>${t.formatDate(value.slice(0, 10), 'medium')}</time>`;
}

/* ----------------------------------------------------------------- layout */

/** A `dt`/`dd` pair inside a `.dl` grid. */
export function fact(label, value) {
  return html`<div><dt>${label}</dt><dd>${value}</dd></div>`;
}

/** A drill link into the next screen down. Always an `<a>` with a real href. */
export function drill(locale, path, label) {
  return html`<a class="drill"${attrs({ href: localeHref(locale, path) })}>${label}</a>`;
}

/** A status dot beside a name, without the dot pushing the baseline around. */
export function nameCell(dot, children) {
  return html`<span class="with-dot">${dot}<span>${children}</span></span>`;
}

/* -------------------------------------------------------- search highlight */

/**
 * The regex metacharacters, so a query can be dropped into a pattern.
 * `$&` in the replacement is the character that matched, so each one comes
 * back escaped and matches itself literally.
 */
const REGEX_METACHARACTERS = /[.*+?^${}()|[\]\\]/g;

/**
 * The mark's colours are a CONTAINER/ON-CONTAINER PAIR, never a literal — the
 * user-agent default (black on yellow) survives into the dark theme. The
 * weight is a second carrier, and `<mark>` itself carries the fact into the
 * accessibility tree.
 */
const HIGHLIGHT_STYLE =
  'background:var(--md-sys-color-tertiary-container);' +
  'color:var(--md-sys-color-on-tertiary-container);' +
  'font-weight:500;padding-inline:1px;' +
  'border-radius:var(--md-sys-shape-corner-extra-small)';

/**
 * The run of `text` a search query matched, wrapped in `<mark>`.
 *
 * The selectors match case-insensitively on a TRIMMED query, so this splits on
 * the same trimmed needle with the `i` flag. NEVER built by interpolating the
 * query into markup: `split()` with ONE capture group returns the pieces as
 * strings and the tagged template escapes each one, so every match is escaped
 * by construction.
 *
 * (The React build only ever highlights live filter results, so this is here
 * for the client enhancements — the pre-rendered pages have no query.)
 */
export function highlight(text, query) {
  const needle = (query ?? '').trim();
  if (!needle) return html`${text}`;

  const parts = String(text).split(
    new RegExp(`(${needle.replace(REGEX_METACHARACTERS, '\\$&')})`, 'gi'),
  );

  // One capture group makes the result alternate: even indices are the text
  // between matches, odd indices are the matches themselves.
  return raw(
    parts
      .map((part, index) =>
        index % 2 === 1 ? `<mark style="${HIGHLIGHT_STYLE}">${escape(part)}</mark>` : escape(part),
      )
      .join(''),
  );
}

/* --------------------------------------------------------------- KPI tile */

/**
 * @param {object} options
 *   `trend`       — historical values for the sparkline, oldest first
 *   `trendLabels` — tooltip x labels, month ends, already formatted
 *   `trendFormat` — 'currency' | 'percent' | 'number', resolved by the client
 *   `trailing`    — a small node at the end of the foot row: a chip, a dot, a
 *                   `count()`. NOT a bare `md-badge` — a badge anchors against
 *                   the nearest positioned ancestor and is clipped by the
 *                   card's own overflow.
 */
export function kpiTile(t, { label, value, hint, trend, trendLabels, trendFormat = 'currency', color = 'primary', trailing }) {
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
      ${hint || trailing
        ? html`<div class="kpi__foot"><span>${hint}</span>${trailing}</div>`
        : null}
    </div>
  </md-card>`;
}

/* ------------------------------------------------------------------ chips */

/* ------------------------------------------------------------------ chips */

/**
 * Every chip in the app.
 *
 * One function, one mapping table, so a category is the same colour in the
 * ring, the statement row and the budget meter. A screen names the domain value
 * and this resolves it through the kit's `status.ts` — never a colour by hand.
 */
export function stateChip(t, { labelKey, color, icon, appearance = 'outlined' }) {
  return html`<md-chip${attrs({
    variant: 'assist',
    appearance,
    color,
    icon,
    label: t(labelKey),
  })}></md-chip>`;
}

export const categoryChip = (t, category) =>
  stateChip(t, {
    labelKey: `banking.category.${category}`,
    color: categoryColor[category],
    icon: categoryIcon[category],
  });

export const txnTypeChip = (t, type) =>
  stateChip(t, { labelKey: `banking.txnType.${type}`, color: 'secondary', icon: txnTypeIcon[type] });

export const txnStatusChip = (t, status) =>
  stateChip(t, { labelKey: `banking.txnStatus.${status}`, color: txnStatusColor[status] });

export const budgetStatusChip = (t, status) =>
  stateChip(t, { labelKey: `banking.budgetStatus.${status}`, color: budgetColor[status] });

export const cardStateChip = (t, state) =>
  stateChip(t, { labelKey: `banking.cardState.${state}`, color: cardStateColor[state] });

export const cardKindChip = (t, kind) =>
  stateChip(t, { labelKey: `banking.cardKind.${kind}`, color: 'secondary' });

export const accountKindChip = (t, kind) =>
  stateChip(t, { labelKey: `banking.accountKind.${kind}`, color: 'info' });

export const instrumentKindChip = (t, kind) =>
  stateChip(t, { labelKey: `banking.instrumentKind.${kind}`, color: instrumentKindColor[kind] });

export const tradeSideChip = (t, side) =>
  stateChip(t, { labelKey: `banking.tradeSide.${side}`, color: tradeSideColor[side] });

export const tradeStatusChip = (t, status) =>
  stateChip(t, { labelKey: `banking.tradeStatus.${status}`, color: tradeStatusColor[status] });

/**
 * A currency, as a plain chip.
 *
 * Not translated: a currency CODE is the same three letters in every locale,
 * and putting it through the dictionary would invite someone to localise it.
 */
export function currencyChip(currency) {
  return html`<md-chip${attrs({
    variant: 'assist',
    appearance: 'outlined',
    color: 'secondary',
    label: currency,
  })}></md-chip>`;
}

/* ------------------------------------------------------------- money bits */

/**
 * A signed movement, coloured by DIRECTION rather than by sentiment.
 *
 * Credits are green; debits are the ordinary body colour. A statement where
 * every purchase is red is unreadable after four rows.
 *
 * `<bdi>` is load-bearing: the `+` is composed by hand because the kit's
 * `CurrencyOptions` has no `signDisplay`, and a leading `+` is a bidi-NEUTRAL
 * character that RTL would move to the other end of the number.
 */
export function flow(t, value, { currency = 'EUR', compact = false } = {}) {
  const up = flowColor(value) === 'success';
  const text = `${value > 0 ? '+' : ''}${t.formatCurrency(value, {
    currency,
    notation: compact ? 'compact' : 'standard',
    maximumFractionDigits: compact ? undefined : 2,
    minimumFractionDigits: compact ? undefined : 2,
  })}`;
  return html`<bdi${attrs({ class: up ? 'num pl-up' : 'num' })}>${text}</bdi>`;
}

/**
 * One statement line, shared by four screens.
 *
 * THE LEADING GLYPH IS THE CATEGORY, via the row's own `leading-icon` — there
 * is no `md-icon` element in this library. A reader scanning a statement looks
 * for "the supermarket", not "a card payment".
 *
 * `showDate` is false inside a day group, where the heading already states it.
 *
 * NO STATUS DOT: `md-status-dot` anchors absolutely to a positioned parent's
 * bottom-end corner, which lands across the last two digits of a currency
 * figure. `data-status` on the row drives the treatment from `app.css`.
 */
export function statementRow(t, txn, { showDate = true } = {}) {
  const meta = [t(txn.typeKey), t(txn.categoryKey)];
  if (txn.status !== 'completed') meta.push(t(txn.statusKey));

  return html`<md-list-item${attrs({
    headline: txn.counterparty,
    overline: showDate ? t.formatDate(txn.date, 'medium') : undefined,
    'supporting-text': meta.join(' · '),
    lines: showDate ? '3' : '2',
    'data-status': txn.status,
    'leading-icon': categoryIcon[txn.category] ?? txnTypeIcon[txn.type],
  })}>
    <span slot="trailing" class="account-row__figures">
      <span class="txn-row__amount">${flow(t, txn.amount, { currency: txn.currency })}</span>
      ${txn.currency === 'EUR' ? null : html`<span class="muted">${flow(t, txn.amountEur)}</span>`}
    </span>
  </md-list-item>`;
}

/**
 * A fraction against a cap, as a labelled linear meter.
 *
 * `md-meter` is for a read-only value in a known range — a funded percentage,
 * a weight, a coverage ratio. It is NOT a progress indicator: nothing here is
 * loading. The bar is clamped into 0…`max`; the text keeps the real value.
 */
export function ratioMeter(t, { label, fraction, color, max = 1, thickness = 10 }) {
  return html`<md-meter${attrs({
    value: Math.max(0, Math.min(max, fraction)) * 100,
    min: '0',
    max: max * 100,
    color,
    thickness,
    label,
    'show-label': true,
    'show-value': true,
    'value-text': t.formatPercent(fraction, { maximumFractionDigits: 1 }),
  })}></md-meter>`;
}

/**
 * A budget's usage. Clamped bar, uncapped text — 115% reads as 115%.
 */
export function budgetMeter(t, { fraction, status }) {
  return ratioMeter(t, {
    label: t('banking.kpi.budgetUsed'),
    fraction,
    color: budgetColor[status],
  });
}

/**
 * A vault's progress towards its goal.
 *
 * Always `primary`: saving towards something is not a state that can go wrong,
 * so there is no colour to earn. A vault at 12% is not a problem.
 */
export function vaultMeter(t, { fraction, label }) {
  return ratioMeter(t, { label, fraction, color: 'primary', thickness: 8 });
}
