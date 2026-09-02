/**
 * The investing account: what is held, what is watched, what has been traded.
 *
 * CONSUMER-GRADE ON PURPOSE. The wealth console next door has an institutional
 * order ticket — limit prices, a blotter, working orders. This is the other
 * thing: a quantity, an estimate, and a button. The overlap in components is
 * real and deliberate; the difference is in what the screen asks of the reader.
 *
 * THE PORTFOLIO CURVE IS LABELLED FOR WHAT IT IS. `portfolioSeries()` holds
 * today's quantities constant and re-prices them down the history, so it shows
 * how the CURRENT portfolio would have moved rather than what it was worth on
 * each day — which would need a position history the fixture does not carry.
 * The subtitle says so rather than letting the chart imply otherwise.
 */

import { useMemo, useRef, useState } from 'react';
import {
  TABLES,
  getTotals,
  getTrades,
  holdingRows,
  portfolioRing,
  portfolioSeries,
  priceSeries,
  tradeEstimate,
  watchlistRows,
} from '@awc-ui/showcase-kit/banking';
import { useShowcase, useT } from '@/lib/showcase';
import { PHONE, useMediaQuery } from '@/lib/media';
import { AreaChart, PieChart, useCustomEvent } from '../elements';
import { EmptyState, Panel, Screen } from '../Shell';
import { route, withBase } from '@/lib/routes';
import {
  Count,
  Drill,
  KpiTile,
  InstrumentKindChip,
  Money,
  Num,
  Percent,
  Signed,
  TradeSideChip,
  TradeStatusChip,
  DateText,
} from '../bits';

export function InvestScreen() {
  const t = useT();
  const { state } = useShowcase();
  const totals = getTotals();
  const holdings = holdingRows();
  const watchlist = watchlistRows();
  const trades = getTrades({ limit: 10 });
  const ring = portfolioRing();
  const curve = portfolioSeries();
  const layout = TABLES.holdings();
  const phone = useMediaQuery(PHONE);

  /* The ticket's instrument defaults to the largest holding — the one a reader
     is most likely to act on, and never an empty select. */
  const [instrumentId, setInstrumentId] = useState(holdings[0]?.instrument.id ?? '');
  /* A number, for the same reason as the exchange amount: `md-number-field`
     emits one already parsed, and `null` is empty rather than zero. */
  const [quantity, setQuantity] = useState<number | null>(1);
  const [placed, setPlaced] = useState(false);

  const estimate = useMemo(
    () => (quantity === null ? null : tradeEstimate(instrumentId, quantity)),
    [instrumentId, quantity],
  );

  const quantityRef = useRef<HTMLElement | null>(null);
  useCustomEvent<CustomEvent<{ value: number | null }>>(quantityRef, 'mdInput', (event) => {
    setQuantity(event.detail.value);
    setPlaced(false);
  });
  useCustomEvent<CustomEvent<{ value: number | null }>>(quantityRef, 'mdChange', (event) =>
    setQuantity(event.detail.value),
  );

  const pickerRef = useRef<HTMLElement | null>(null);
  useCustomEvent<CustomEvent<string | string[]>>(pickerRef, 'mdChange', (event) => {
    const value = Array.isArray(event.detail) ? event.detail[0] : event.detail;
    if (value) setInstrumentId(value);
    setPlaced(false);
  });

  const reason = estimate === null ? t('banking.hint.quantityNeeded') : null;

  return (
    <Screen
      title={t('banking.screen.invest.title')}
      subtitle={t('banking.screen.invest.subtitle')}
      aside={<Count value={totals.holdingCount} />}
    >
      <section className="kpi-grid">
        <KpiRow />
      </section>

      <div className="grid-2">
        <Panel title={t('banking.panel.performance')} subtitle={t('banking.hint.portfolioSeries')}>
          {curve.length === 0 ? null : (
            <AreaChart
              class="chart-md"
              series={[
                { id: 'value', label: t('banking.kpi.portfolio'), data: curve.map((p) => p.valueEur) },
              ]}
              xAxis={{ data: curve.map((p) => t.formatDate(p.date, 'short')), scale: 'category' }}
              valueFormatter={(value: number | null) =>
                t.formatCurrency(value ?? 0, { notation: 'compact' })
              }
              summary={t('banking.panel.performance')}
              curve="monotone"
              grid="horizontal"
            />
          )}
        </Panel>

        <Panel title={t('banking.panel.allocation')}>
            {/*
              THREE THINGS WERE WRONG WITH THIS RING.

              `variant="donut"` is not a prop — I invented it, so it was
              silently ignored and the chart drew a full pie. The hole is
              `inner-radius`.

              `legend="end"` is not a valid position either: the component takes
              top / bottom / left / right and the four corners. An invalid value
              is not a bottom-end legend, it is an unhandled one.

              And `show-labels` defaults ON, which is what made the numbers
              unreadable: seven slices, two of them under 6%, each printing a
              currency figure in white on a mid-tone fill, with the two smallest
              labels overlapping each other outright. Labels around a ring only
              work when every slice is wide enough to hold one, which is a
              property of the data and cannot be assumed. They are off; the
              legend names the slices, the tooltip gives a value on hover, the
              generated data table carries the full set for a screen reader —
              and every figure is listed in full in the panel below anyway.

              The total goes in the hole, which is what the hole is for.
            */}
          <PieChart
            class="chart-md"
            data={ring.map((slice) => ({ id: slice.id, label: slice.labelKey, value: slice.value }))}
            valueFormatter={(value: number | null) =>
              t.formatCurrency(value ?? 0, { notation: 'compact' })
            }
            summary={t('banking.panel.allocation')}
            inner-radius="62%"
            show-labels="false"
            legend="bottom"
          >
            <div slot="center" className="ring-centre">
              <span className="ring-centre__value">
                <Money value={totals.portfolioValueEur} compact />
              </span>
              <span className="ring-centre__label">{t('banking.kpi.portfolio')}</span>
            </div>
          </PieChart>
        </Panel>
      </div>

      <Panel title={t('banking.panel.tradeTicket')}>
        <div className="stack form-stack">
          <md-select
            ref={pickerRef}
            label={t('banking.table.name')}
            value={instrumentId}
          >
            {holdings.map((h) => (
              <md-select-option
                key={h.instrument.id}
                value={h.instrument.id}
                label={`${h.instrument.ticker} — ${h.instrument.name}`}
              />
            ))}
          </md-select>

          {/* No `format-options` here: a quantity is a bare count of units,
              and a crypto holding is fractional to four places, so the field
              formats as a plain number rather than as money. */}
          <md-number-field
            ref={quantityRef}
            label={t('banking.table.quantity')}
            value={quantity}
            min={0}
            step={1}
            small-step={0.1}
            large-step={10}
            locale={state.locale}
          />

          {estimate ? (
            <div className="stack">
              <div className="quote-line">
                <span>{t('banking.table.price')}</span>
                <span className="num">
                  <Money value={estimate.priceEur} />
                </span>
              </div>
              <div className="quote-line">
                <span>{t('banking.table.fee')}</span>
                <span className="num">
                  <Money value={estimate.feeEur} />
                </span>
              </div>
              <div className="quote-line quote-line--total">
                <span>{t('banking.table.total')}</span>
                <span className="num">
                  <Money value={estimate.totalEur} />
                </span>
              </div>
            </div>
          ) : null}

          <div className="row">
            <md-tooltip text={reason ?? ''} disabled={reason === null || undefined}>
              <md-button
                variant="filled"
                icon="trending_up"
                soft-disabled={reason !== null || placed || undefined}
                onClick={() => setPlaced(true)}
              >
                {t('banking.action.buy')}
              </md-button>
            </md-tooltip>
            <md-button
              variant="tonal"
              icon="trending_down"
              soft-disabled={reason !== null || placed || undefined}
              onClick={() => setPlaced(true)}
            >
              {t('banking.action.sell')}
            </md-button>
            {placed ? <span className="muted">{t('banking.msg.tradePlaced')}</span> : null}
          </div>
        </div>
      </Panel>

      <Panel title={t('banking.panel.holdings')} actions={<Count value={holdings.length} />}>
        {holdings.length === 0 ? (
          <EmptyState message={t('banking.empty.holdings')} />
        ) : phone ? (
          /*
           * A LIST ON A PHONE, NOT THE TABLE.
           *
           * The table needs 1040px for its nine columns and does the honest
           * thing below that — it scrolls inside its own port. But scrolling a
           * nine-column grid sideways on a 390px screen is not reading a
           * portfolio, and the three figures that matter (value, P/L, weight)
           * are the ones that end up off-screen.
           *
           * The two layouts are different MARKUP, not the same markup
           * rearranged, which is why this is a media-query hook rather than
           * CSS: rendering both and hiding one would leave a 1040px table in
           * every phone's accessibility tree.
           */
          <md-list
            label={t('banking.panel.holdings')}
            interaction-mode="navigation"
            list-style="segmented"
          >
            {holdings.map((h) => (
              <md-list-item
                key={h.instrument.id}
                type="link"
                href={withBase(route.instrument(h.instrument.id))}
                headline={h.instrument.name}
                overline={h.instrument.ticker}
                supporting-text={`${t(h.instrument.kindKey)} · ${t.formatPercent(h.allocation, {
                  maximumFractionDigits: 1,
                })}`}
                lines="3"
              >
                <span slot="leading">
                  <md-avatar initials={h.instrument.initials} size="small" />
                </span>
                <span slot="trailing" className="account-row__figures">
                  <Money value={h.marketValueEur} />
                  <Signed value={h.unrealisedPlPct} kind="percent" />
                </span>
              </md-list-item>
            ))}
          </md-list>
        ) : (
          <md-table-container variant="outlined" class="table-host">
            <md-table
              label={t('banking.panel.holdings')}
              column-template={layout.columns}
              min-width={layout.minWidth}
              keep-height="false"
              striped
            >
              <md-table-head>
                <md-table-row rowgroup="head">
                  <md-table-cell head scope="col">{t('banking.table.ticker')}</md-table-cell>
                  <md-table-cell head scope="col">{t('banking.table.name')}</md-table-cell>
                  <md-table-cell head scope="col">{t('banking.table.kind')}</md-table-cell>
                  <md-table-cell head scope="col" numeric>{t('banking.table.quantity')}</md-table-cell>
                  <md-table-cell head scope="col" numeric>{t('banking.table.price')}</md-table-cell>
                  <md-table-cell head scope="col" numeric>{t('banking.table.value')}</md-table-cell>
                  <md-table-cell head scope="col" numeric>{t('banking.table.pl')}</md-table-cell>
                  <md-table-cell head scope="col" numeric>{t('banking.table.plPct')}</md-table-cell>
                  <md-table-cell head scope="col" numeric>{t('banking.table.allocation')}</md-table-cell>
                </md-table-row>
              </md-table-head>
              <md-table-body>
                {holdings.map((h) => (
                  <md-table-row key={h.instrument.id} value={h.instrument.id}>
                    <md-table-cell>
                      <Drill href={withBase(route.instrument(h.instrument.id))}>
                        <span className="strong">{h.instrument.ticker}</span>
                      </Drill>
                    </md-table-cell>
                    <md-table-cell>{h.instrument.name}</md-table-cell>
                    <md-table-cell>
                      <InstrumentKindChip kind={h.instrument.kind} />
                    </md-table-cell>
                    <md-table-cell numeric>
                      <Num value={h.quantity} digits={h.instrument.kind === 'crypto' ? 4 : 2} />
                    </md-table-cell>
                    <md-table-cell numeric>
                      <Money value={h.instrument.priceEur} />
                    </md-table-cell>
                    <md-table-cell numeric>
                      <Money value={h.marketValueEur} compact />
                    </md-table-cell>
                    <md-table-cell numeric>
                      <Signed value={h.unrealisedPlEur} compact />
                    </md-table-cell>
                    <md-table-cell numeric>
                      <Signed value={h.unrealisedPlPct} kind="percent" />
                    </md-table-cell>
                    <md-table-cell numeric>
                      <Percent value={h.allocation} digits={1} />
                    </md-table-cell>
                  </md-table-row>
                ))}
              </md-table-body>
            </md-table>
          </md-table-container>
        )}
      </Panel>

      <div className="grid-2">
        <Panel title={t('banking.panel.watchlist')} actions={<Count value={watchlist.length} />}>
          {watchlist.length === 0 ? (
            <EmptyState message={t('banking.empty.watchlist')} />
          ) : (
            <md-list
              label={t('banking.panel.watchlist')}
              interaction-mode="navigation"
              list-style="segmented"
            >
              {watchlist.map((instrument) => (
                <md-list-item
                  key={instrument.id}
                  type="link"
                  href={withBase(route.instrument(instrument.id))}
                  headline={instrument.name}
                  overline={instrument.ticker}
                  supporting-text={t(instrument.kindKey)}
                  lines="3"
                >
                  <span slot="leading">
                    <md-avatar initials={instrument.initials} size="small" />
                  </span>
                  <span slot="trailing" className="account-row__figures">
                    <Money value={instrument.priceEur} />
                    <Signed value={instrument.dayChangePct} kind="percent" />
                  </span>
                </md-list-item>
              ))}
            </md-list>
          )}
        </Panel>

        <Panel title={t('banking.panel.tradeHistory')} actions={<Count value={trades.length} />}>
          {trades.length === 0 ? (
            <EmptyState message={t('banking.empty.trades')} />
          ) : (
            <md-list
              label={t('banking.panel.tradeHistory')}
              interaction-mode="multi-action"
              list-style="segmented"
            >
              {trades.map((trade) => (
                <md-list-item
                  key={trade.id}
                  headline={trade.instrumentId}
                  overline={t.formatDate(trade.date, 'medium')}
                  supporting-text={`${t(trade.sideKey)} · ${t(trade.statusKey)}`}
                  lines="3"
                >
                  <span slot="trailing" className="row">
                    <TradeSideChip side={trade.side} />
                    <TradeStatusChip status={trade.status} />
                    <Money value={trade.amountEur} />
                  </span>
                </md-list-item>
              ))}
            </md-list>
          )}
        </Panel>
      </div>
    </Screen>
  );
}

/**
 * The four investing headlines.
 *
 * Split out so the screen body stays readable — it is a fixed row of tiles with
 * no state, and inlining it put ninety lines between the screen's opening tag
 * and its first real panel.
 */
function KpiRow() {
  const t = useT();
  const totals = getTotals();
  const holdings = holdingRows();

  return (
    <>
      <KpiTile
        label={t('banking.kpi.portfolio')}
        value={<Money value={totals.portfolioValueEur} compact />}
        hint={<Signed value={totals.portfolioReturnPct} kind="percent" />}
      />
      <KpiTile
        label={t('banking.kpi.unrealisedPl')}
        value={<Signed value={totals.portfolioUnrealisedPlEur} compact />}
        hint={<Money value={totals.portfolioCostBasisEur} compact />}
      />
      <KpiTile
        label={t('banking.kpi.dayChange')}
        value={<Signed value={totals.portfolioDayChangeEur} />}
        hint={null}
      />
      <KpiTile
        label={t('banking.panel.holdings')}
        value={<Num value={holdings.length} />}
        hint={<span>{t('banking.kpi.watchlist')}</span>}
        trailing={<Count value={totals.watchlistCount} />}
      />
    </>
  );
}
