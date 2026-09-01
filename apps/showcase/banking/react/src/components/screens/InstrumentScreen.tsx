/**
 * One instrument: its price, the position in it, and the trades behind that.
 *
 * A DRILL from the invest screen — reachable from the holdings table and the
 * watchlist, with breadcrumbs because it is one level down.
 *
 * THE HOLDING BLOCK IS CONDITIONAL, and that is the whole shape of the screen:
 * a watched instrument has a price and a chart and nothing else, while a held
 * one adds a position. Rendering an empty position block for a watched
 * instrument would say the reader holds zero of it, which is a different claim
 * from not holding it at all.
 */

import {
  crumbsFor,
  getHoldingFor,
  getInstrumentById,
  getTrades,
} from '@awc-ui/showcase-kit/banking';
import { useT } from '@/lib/showcase';
import { usePathname } from '@/lib/router';
import { AreaChart } from '../elements';
import { EmptyState, Panel, Screen } from '../Shell';
import {
  Count,
  DateText,
  InstrumentKindChip,
  Money,
  Num,
  Percent,
  Signed,
  TradeSideChip,
  TradeStatusChip,
} from '../bits';

export function InstrumentScreen({ instrumentId }: { instrumentId: string }) {
  const t = useT();
  const pathname = usePathname();
  const instrument = getInstrumentById(instrumentId);

  if (!instrument) {
    return (
      <Screen
        crumbs={crumbsFor(pathname, null)}
        title={t('banking.screen.notFound.title')}
        subtitle={t('banking.screen.notFound.body')}
      >
        <EmptyState message={t('banking.screen.notFound.body')} />
      </Screen>
    );
  }

  const holding = getHoldingFor(instrument.id);
  const trades = getTrades({ instrumentId: instrument.id });

  return (
    <Screen
      crumbs={crumbsFor(pathname, instrument.name)}
      title={instrument.name}
      subtitle={t('banking.screen.instrument.subtitle')}
      aside={<InstrumentKindChip kind={instrument.kind} />}
    >
      <Panel>
        <div className="instrument-head">
          <md-avatar initials={instrument.initials} size="large" />
          <div className="stack">
            <span className="strong">{instrument.ticker}</span>
            <span className="muted">
              {instrument.sectorKey ? t(instrument.sectorKey) : t(instrument.kindKey)}
            </span>
          </div>
          <div className="instrument-head__figures">
            <span className="kpi__value">
              <Money value={instrument.price} currency={instrument.currency} />
            </span>
            <Signed value={instrument.dayChangePct} kind="percent" />
          </div>
        </div>

        <dl className="dl">
          <div>
            <dt>{t('banking.table.day')}</dt>
            <dd>
              <Signed value={instrument.dayChangePct} kind="percent" />
            </dd>
          </div>
          <div>
            <dt>{t('banking.table.week')}</dt>
            <dd>
              <Signed value={instrument.weekChangePct} kind="percent" />
            </dd>
          </div>
          <div>
            <dt>{t('banking.table.year')}</dt>
            <dd>
              <Signed value={instrument.yearChangePct} kind="percent" />
            </dd>
          </div>
          <div>
            <dt>{t('banking.table.currency')}</dt>
            <dd>{instrument.currency}</dd>
          </div>
        </dl>
      </Panel>

      <Panel title={t('banking.panel.performance')}>
        <AreaChart
          class="chart-lg"
          series={[
            {
              id: instrument.id,
              label: instrument.ticker,
              data: instrument.history.map((p) => p.price),
            },
          ]}
          xAxis={{
            data: instrument.history.map((p) => t.formatDate(p.date, 'short')),
            scale: 'category',
          }}
          valueFormatter={(value: number | null) =>
            t.formatCurrency(value ?? 0, {
              currency: instrument.currency,
              maximumFractionDigits: 2,
            })
          }
          summary={t('banking.panel.performance')}
          curve="monotone"
          grid="horizontal"
        />
      </Panel>

      {holding ? (
        <Panel title={t('banking.panel.holdings')}>
          <dl className="dl">
            <div>
              <dt>{t('banking.table.quantity')}</dt>
              <dd>
                <Num value={holding.quantity} digits={instrument.kind === 'crypto' ? 4 : 2} />
              </dd>
            </div>
            <div>
              <dt>{t('banking.table.value')}</dt>
              <dd>
                <Money value={holding.marketValueEur} />
              </dd>
            </div>
            <div>
              <dt>{t('banking.table.costBasis')}</dt>
              <dd>
                <Money value={holding.costBasisEur} />
              </dd>
            </div>
            <div>
              <dt>{t('banking.table.pl')}</dt>
              <dd>
                <Signed value={holding.unrealisedPlEur} />
              </dd>
            </div>
            <div>
              <dt>{t('banking.table.plPct')}</dt>
              <dd>
                <Signed value={holding.unrealisedPlPct} kind="percent" />
              </dd>
            </div>
            <div>
              <dt>{t('banking.table.allocation')}</dt>
              <dd>
                <Percent value={holding.allocation} digits={1} />
              </dd>
            </div>
          </dl>
        </Panel>
      ) : null}

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
                headline={t.formatDate(trade.date, 'medium')}
                overline={trade.id}
                supporting-text={`${t('banking.table.price')} ${t.formatCurrency(trade.priceEur)}`}
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
    </Screen>
  );
}
