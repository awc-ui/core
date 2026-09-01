/**
 * The cards, and the controls that act on them.
 *
 * THE ONLY SCREEN THAT CHANGES ANYTHING. Freezing a card, flipping a control,
 * moving a limit — all of it is client state held here, because the fixture is
 * frozen and a showcase that mutated it would stop being reproducible. The
 * state starts at the fixture's own values, so a reload is a reset.
 *
 * FREEZE IS A SWITCH, BLOCK IS NOT. `frozen` is reversible and is a thing the
 * holder did; `blocked` is terminal and means the card was lost. That is why
 * the freeze control is an `md-switch` and a blocked card offers no thaw — its
 * controls are disabled outright and the reason is stated, rather than the
 * switch being present and secretly inert.
 *
 * `md-switch` EMITS `mdChange` AFTER IT HAS ALREADY FLIPPED ITSELF, so the
 * element's own state is right and only this screen has to follow.
 */

import { useRef, useState } from 'react';
import {
  getAccountById,
  getCards,
  getTotals,
  getTransactions,
  type CardState,
} from '@awc-ui/showcase-kit/banking';
import { useT } from '@/lib/showcase';
import { useCustomEvent } from '../elements';
import { EmptyState, Panel, Screen } from '../Shell';
import {
  CardKindChip,
  CardStateChip,
  Count,
  DateText,
  Money,
  Percent,
  RatioMeter,
} from '../bits';
import { TransactionRow } from './StatementParts';
import './snackbar.css';

/** The three per-card switches, in the order the card screen renders them. */
const CONTROLS = [
  { key: 'contactless', labelKey: 'banking.control.contactless', icon: 'contactless' },
  { key: 'onlinePayments', labelKey: 'banking.control.online', icon: 'language' },
  { key: 'atmWithdrawals', labelKey: 'banking.control.atm', icon: 'local_atm' },
] as const;

type ControlKey = (typeof CONTROLS)[number]['key'];

export function CardsScreen() {
  const t = useT();
  const totals = getTotals();
  const cards = getCards();

  const [selectedId, setSelectedId] = useState(cards[0]?.id ?? '');
  /* Overrides on top of the fixture, keyed by card. Absent means "as shipped",
     which is what makes a reload a reset without a second copy of the data. */
  const [states, setStates] = useState<Record<string, CardState>>({});
  const [controls, setControls] = useState<Record<string, Partial<Record<ControlKey, boolean>>>>({});
  const [message, setMessage] = useState<string | null>(null);

  const card = cards.find((c) => c.id === selectedId) ?? cards[0];
  const state = card ? (states[card.id] ?? card.state) : 'active';
  const account = card ? getAccountById(card.accountId) : undefined;
  const rows = card ? getTransactions({ cardId: card.id, limit: 8 }) : [];

  const controlOf = (key: ControlKey) =>
    card ? (controls[card.id]?.[key] ?? card[key]) : false;

  const snackbarRef = useRef<HTMLElement | null>(null);
  useCustomEvent<CustomEvent<{ reason: string }>>(snackbarRef, 'mdClose', () => setMessage(null));

  const listRef = useRef<HTMLElement | null>(null);
  useCustomEvent<CustomEvent>(listRef, 'mdClick', (event) => {
    const row = (event.target as HTMLElement | null)?.closest?.('md-list-item');
    const id = (row as HTMLElement | null)?.dataset?.card;
    if (id) setSelectedId(id);
  });

  const controlsRef = useRef<HTMLElement | null>(null);
  useCustomEvent<CustomEvent<{ selected: boolean }>>(controlsRef, 'mdChange', (event) => {
    const key = (event.target as HTMLElement | null)?.dataset?.control as ControlKey | undefined;
    if (!key || !card) return;
    setControls((prev) => ({
      ...prev,
      [card.id]: { ...prev[card.id], [key]: event.detail.selected },
    }));
    setMessage(t('banking.msg.controlSaved'));
  });

  const freezeRef = useRef<HTMLElement | null>(null);
  useCustomEvent<CustomEvent<{ selected: boolean }>>(freezeRef, 'mdChange', (event) => {
    if (!card) return;
    const next: CardState = event.detail.selected ? 'frozen' : 'active';
    setStates((prev) => ({ ...prev, [card.id]: next }));
    setMessage(t(next === 'frozen' ? 'banking.msg.cardFrozen' : 'banking.msg.cardUnfrozen'));
  });

  if (!card) {
    return (
      <Screen title={t('banking.screen.cards.title')} subtitle={t('banking.screen.cards.subtitle')}>
        <EmptyState message={t('banking.empty.cards')} />
      </Screen>
    );
  }

  const terminal = state === 'blocked';

  return (
    <Screen
      title={t('banking.screen.cards.title')}
      subtitle={t('banking.screen.cards.subtitle')}
      aside={<Count value={totals.activeCardCount} />}
    >
      <div className="grid-2">
        <Panel title={t('banking.panel.cards')} actions={<Count value={cards.length} />}>
          <md-list
            ref={listRef}
            label={t('banking.panel.cards')}
            interaction-mode="navigation"
            selection-mode="single"
            list-style="segmented"
          >
            {cards.map((c) => {
              const s = states[c.id] ?? c.state;
              return (
                <md-list-item
                  key={c.id}
                  data-card={c.id}
                  type="button"
                  selected={c.id === card.id || undefined}
                  headline={c.label}
                  overline={t('banking.unit.endingIn', { last4: c.last4 })}
                  supporting-text={`${t(c.kindKey)} · ${t(`banking.cardState.${s}`)}`}
                  lines="3"
                  leading-icon="credit_card"
                >
                  <span slot="trailing">
                    <CardStateChip state={s} />
                  </span>
                </md-list-item>
              );
            })}
          </md-list>
        </Panel>

        <Panel title={card.label} subtitle={account?.nickname}>
          <div className="stack">
            {/* The tile is decorative — every fact on it is repeated in the
                list beside it and the facts below, so it carries no state a
                reader could only get by looking at a picture. */}
            <div className="card-tile" data-state={state} aria-hidden="true">
              <div className="card-tile__head">
                <span className="card-tile__label">{card.label}</span>
                <span className="card-tile__network">{card.network === 'visa' ? 'VISA' : 'MC'}</span>
              </div>
              <div className="card-tile__number">•••• •••• •••• {card.last4}</div>
              <div className="card-tile__foot">
                <span>{card.expiry}</span>
                <span>{card.network.toUpperCase()}</span>
              </div>
            </div>

            <dl className="dl">
              <div>
                <dt>{t('banking.table.status')}</dt>
                <dd>
                  <CardStateChip state={state} />
                </dd>
              </div>
              <div>
                <dt>{t('banking.table.kind')}</dt>
                <dd>
                  <CardKindChip kind={card.kind} />
                </dd>
              </div>
              <div>
                <dt>{t('banking.table.account')}</dt>
                <dd>{account?.nickname ?? t('banking.common.na')}</dd>
              </div>
              <div>
                <dt>{t('banking.table.expiry')}</dt>
                <dd>{card.expiry}</dd>
              </div>
            </dl>

            {terminal ? <p className="muted">{t('banking.hint.blocked')}</p> : null}
            {state === 'frozen' ? <p className="muted">{t('banking.hint.frozen')}</p> : null}
          </div>
        </Panel>
      </div>

      <div className="grid-2">
        <Panel title={t('banking.panel.controls')}>
          <md-list
            ref={controlsRef}
            label={t('banking.panel.controls')}
            class="table-host"
            interaction-mode="multi-action"
          >
            {/* Freeze first — it is the control someone opens this screen to
                find, and it gates the meaning of the three below it. */}
            <md-list-item headline={t('banking.action.freeze')} leading-icon="ac_unit" lines="1">
              <md-switch
                ref={freezeRef}
                slot="trailing"
                selected={state === 'frozen' || undefined}
                disabled={terminal || undefined}
                aria-label={t('banking.action.freeze')}
              />
            </md-list-item>

            {CONTROLS.map((control) => (
              <md-list-item
                key={control.key}
                headline={t(control.labelKey)}
                leading-icon={control.icon}
                lines="1"
              >
                <md-switch
                  slot="trailing"
                  data-control={control.key}
                  selected={controlOf(control.key) || undefined}
                  /* A frozen card spends nothing, so its per-transaction
                     controls are moot — disabling them says that, where
                     leaving them live would imply they still did something. */
                  disabled={terminal || state === 'frozen' || undefined}
                  aria-label={t(control.labelKey)}
                />
              </md-list-item>
            ))}
          </md-list>
        </Panel>

        <Panel title={t('banking.panel.limits')}>
          {card.monthlyLimit === null ? (
            <p className="muted">{t('banking.common.na')}</p>
          ) : (
            <div className="budget-row">
              <div className="budget-row__head">
                <span>{t('banking.table.spent')}</span>
                <span className="strong">
                  <Money value={card.spentThisMonth} currency={account?.currency} /> /{' '}
                  <Money value={card.monthlyLimit} currency={account?.currency} />
                </span>
              </div>
              <RatioMeter
                label={t('banking.panel.limits')}
                fraction={card.spentThisMonth / card.monthlyLimit}
                color={card.spentThisMonth > card.monthlyLimit ? 'error' : 'primary'}
              />
              <div className="budget-row__foot">
                <span>
                  <Percent value={card.spentThisMonth / card.monthlyLimit} />
                </span>
                <span>{t('banking.common.thisMonth')}</span>
              </div>
            </div>
          )}
        </Panel>
      </div>

      <Panel title={t('banking.panel.recent')} subtitle={card.label}>
        {rows.length === 0 ? (
          <EmptyState message={t('banking.empty.transactions')} />
        ) : (
          <md-list
            label={t('banking.panel.recent')}
            interaction-mode="multi-action"
            list-style="segmented"
          >
            {rows.map((txn) => (
              <TransactionRow key={txn.id} txn={txn} />
            ))}
          </md-list>
        )}
      </Panel>

      <md-snackbar
        ref={snackbarRef}
        class="app-snackbar"
        position="bottom"
        closeable
        auto-hide
        open={message !== null || undefined}
        message={message ?? ''}
        dismiss-label={t('banking.action.close')}
      />
    </Screen>
  );
}
