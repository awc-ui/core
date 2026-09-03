import { Component, CUSTOM_ELEMENTS_SCHEMA, computed, signal } from '@angular/core';
import {
  cardStateColor,
  getAccountById,
  getCards,
  getTotals,
  getTransactions,
  type CardState,
} from '@awc-ui/showcase-kit/banking';
import { ShowcaseComponent } from '../lib/screen.base';
import { ScreenComponent } from '../components/screen.component';
import { PanelComponent } from '../components/panel.component';
import { EmptyStateComponent } from '../components/empty-state.component';
import {
  ChipComponent,
  CountComponent,
  MoneyComponent,
  PercentComponent,
  RatioMeterComponent,
  StatementRowComponent,
} from '../components/bits.component';

const CONTROLS = [
  { key: 'contactless', labelKey: 'banking.control.contactless', icon: 'contactless' },
  { key: 'onlinePayments', labelKey: 'banking.control.online', icon: 'language' },
  { key: 'atmWithdrawals', labelKey: 'banking.control.atm', icon: 'local_atm' },
] as const;
type ControlKey = (typeof CONTROLS)[number]['key'];

/**
 * The cards, and the controls that act on them.
 *
 * THE ONLY SCREEN THAT CHANGES ANYTHING. All client state, because the fixture
 * is frozen and a showcase that mutated it would stop being reproducible. State
 * starts at the fixture's own values, so a reload is a reset.
 *
 * FREEZE IS A SWITCH, BLOCK IS NOT. `frozen` is reversible and something the
 * holder did; `blocked` is terminal. A blocked card offers no thaw — its
 * controls are disabled and the reason is stated.
 */
@Component({
  selector: 'awc-cards-screen',
  standalone: true,
  styles: ':host { display: contents; }',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [
    ScreenComponent,
    PanelComponent,
    EmptyStateComponent,
    ChipComponent,
    CountComponent,
    MoneyComponent,
    PercentComponent,
    RatioMeterComponent,
    StatementRowComponent,
  ],
  template: `
    <awc-screen
      [title]="t('banking.screen.cards.title')"
      [subtitle]="t('banking.screen.cards.subtitle')"
    >
      <md-chip aside awcCount [value]="totals.activeCardCount"></md-chip>

      @if (!card()) {
        <awc-empty-state [message]="t('banking.empty.cards')" />
      } @else {
        <div class="grid-2">
          <awc-panel [title]="t('banking.panel.cards')">
            <md-chip actions awcCount [value]="cards.length"></md-chip>
            <md-list
              [attr.label]="t('banking.panel.cards')"
              interaction-mode="navigation"
              selection-mode="single"
              list-style="segmented"
              (mdClick)="onListClick($event)"
            >
              @for (c of cards; track c.id) {
                <md-list-item
                  [attr.data-card]="c.id"
                  type="button"
                  [attr.selected]="c.id === card()!.id ? '' : null"
                  [attr.headline]="c.label"
                  [attr.overline]="t('banking.unit.endingIn', { last4: c.last4 })"
                  [attr.supporting-text]="
                    t(c.kindKey) + ' · ' + t('banking.cardState.' + stateOf(c.id))
                  "
                  lines="3"
                  leading-icon="credit_card"
                >
                  <span slot="trailing">
                    <md-chip
                      awcChip
                      [labelKey]="'banking.cardState.' + stateOf(c.id)"
                      [color]="colourOf(c.id)"
                    ></md-chip>
                  </span>
                </md-list-item>
              }
            </md-list>
          </awc-panel>

          <awc-panel [title]="card()!.label" [subtitle]="account()?.nickname">
            <div class="stack">
              <!-- Decorative: every fact on the tile is repeated beside and
                   below it. -->
              <div class="card-tile" [attr.data-state]="state()" aria-hidden="true">
                <div class="card-tile__head">
                  <span class="card-tile__label">{{ card()!.label }}</span>
                  <span class="card-tile__network">
                    {{ card()!.network === 'visa' ? 'VISA' : 'MC' }}
                  </span>
                </div>
                <div class="card-tile__number">•••• •••• •••• {{ card()!.last4 }}</div>
                <div class="card-tile__foot">
                  <span>{{ card()!.expiry }}</span>
                  <span>{{ card()!.network.toUpperCase() }}</span>
                </div>
              </div>

              <dl class="dl">
                <div>
                  <dt>{{ t('banking.table.status') }}</dt>
                  <dd>
                    <md-chip
                      awcChip
                      [labelKey]="'banking.cardState.' + state()"
                      [color]="stateColour()"
                    ></md-chip>
                  </dd>
                </div>
                <div>
                  <dt>{{ t('banking.table.kind') }}</dt>
                  <dd>
                    <md-chip awcChip [labelKey]="card()!.kindKey" color="secondary"></md-chip>
                  </dd>
                </div>
                <div>
                  <dt>{{ t('banking.table.account') }}</dt>
                  <dd>{{ account()?.nickname ?? t('banking.common.na') }}</dd>
                </div>
                <div>
                  <dt>{{ t('banking.table.expiry') }}</dt>
                  <dd>{{ card()!.expiry }}</dd>
                </div>
              </dl>

              @if (terminal()) {
                <p class="muted">{{ t('banking.hint.blocked') }}</p>
              } @else if (state() === 'frozen') {
                <p class="muted">{{ t('banking.hint.frozen') }}</p>
              }
            </div>
          </awc-panel>
        </div>

        <div class="grid-2">
          <awc-panel [title]="t('banking.panel.controls')">
            <md-list
              [attr.label]="t('banking.panel.controls')"
              class="table-host"
              interaction-mode="multi-action"
              (mdChange)="onControl($event)"
            >
              <!-- Freeze first: the control someone opens this screen to find,
                   and it gates the meaning of the three below it. -->
              <md-list-item
                [attr.headline]="t('banking.action.freeze')"
                leading-icon="ac_unit"
                lines="1"
              >
                <md-switch
                  slot="trailing"
                  data-control="freeze"
                  [attr.selected]="state() === 'frozen' ? '' : null"
                  [attr.disabled]="terminal() ? '' : null"
                  [attr.aria-label]="t('banking.action.freeze')"
                ></md-switch>
              </md-list-item>

              @for (control of CONTROLS; track control.key) {
                <md-list-item
                  [attr.headline]="t(control.labelKey)"
                  [attr.leading-icon]="control.icon"
                  lines="1"
                >
                  <md-switch
                    slot="trailing"
                    [attr.data-control]="control.key"
                    [attr.selected]="controlOf(control.key) ? '' : null"
                    [attr.disabled]="terminal() || state() === 'frozen' ? '' : null"
                    [attr.aria-label]="t(control.labelKey)"
                  ></md-switch>
                </md-list-item>
              }
            </md-list>
          </awc-panel>

          <awc-panel [title]="t('banking.panel.limits')">
            @if (card()!.monthlyLimit === null) {
              <p class="muted">{{ t('banking.common.na') }}</p>
            } @else {
              <div class="budget-row">
                <div class="budget-row__head">
                  <span>{{ t('banking.table.spent') }}</span>
                  <span class="strong">
                    <span
                      awcMoney
                      [value]="card()!.spentThisMonth"
                      [currency]="account()?.currency ?? 'EUR'"
                    ></span>
                    /
                    <span
                      awcMoney
                      [value]="card()!.monthlyLimit!"
                      [currency]="account()?.currency ?? 'EUR'"
                    ></span>
                  </span>
                </div>
                <awc-ratio-meter
                  [label]="t('banking.panel.limits')"
                  [fraction]="limitFraction()"
                  [color]="limitColour()"
                />
                <div class="budget-row__foot">
                  <span><span awcPercent [value]="limitFraction()"></span></span>
                  <span>{{ t('banking.common.thisMonth') }}</span>
                </div>
              </div>
            }
          </awc-panel>
        </div>

        <awc-panel [title]="t('banking.panel.recent')" [subtitle]="card()!.label">
          @if (rows().length === 0) {
            <awc-empty-state [message]="t('banking.empty.transactions')" />
          } @else {
            <md-list
              [attr.label]="t('banking.panel.recent')"
              interaction-mode="multi-action"
              list-style="segmented"
            >
              @for (txn of rows(); track txn.id) {
                <md-list-item awcStatementRow [txn]="txn"></md-list-item>
              }
            </md-list>
          }
        </awc-panel>

        <md-snackbar
          class="app-snackbar"
          position="bottom"
          closeable
          auto-hide
          [attr.open]="message() !== null ? '' : null"
          [attr.message]="message() ?? ''"
          [attr.dismiss-label]="t('banking.action.close')"
          (mdClose)="message.set(null)"
        ></md-snackbar>
      }
    </awc-screen>
  `,
})
export class CardsScreen extends ShowcaseComponent {
  protected readonly CONTROLS = CONTROLS;
  protected readonly totals = getTotals();
  protected readonly cards = getCards();

  protected readonly selectedId = signal(this.cards[0]?.id ?? '');
  /* Overrides on top of the fixture, keyed by card. Absent means "as shipped". */
  private readonly states = signal<Record<string, CardState>>({});
  private readonly controls = signal<Record<string, Partial<Record<ControlKey, boolean>>>>({});
  protected readonly message = signal<string | null>(null);

  protected readonly card = computed(
    () => this.cards.find((c) => c.id === this.selectedId()) ?? this.cards[0],
  );
  protected readonly state = computed<CardState>(() => {
    const c = this.card();
    return c ? (this.states()[c.id] ?? c.state) : 'active';
  });
  protected readonly account = computed(() => {
    const c = this.card();
    return c ? getAccountById(c.accountId) : undefined;
  });
  protected readonly rows = computed(() => {
    const c = this.card();
    return c ? getTransactions({ cardId: c.id, limit: 8 }) : [];
  });
  protected readonly terminal = computed(() => this.state() === 'blocked');
  protected readonly stateColour = computed(() => cardStateColor[this.state()]);
  protected readonly limitFraction = computed(() => {
    const c = this.card();
    return c && c.monthlyLimit ? c.spentThisMonth / c.monthlyLimit : 0;
  });
  protected readonly limitColour = computed(() => {
    const c = this.card();
    return c && c.monthlyLimit && c.spentThisMonth > c.monthlyLimit ? 'error' : 'primary';
  });

  protected stateOf(id: string): CardState {
    return this.states()[id] ?? this.cards.find((c) => c.id === id)?.state ?? 'active';
  }
  protected colourOf(id: string): string {
    return cardStateColor[this.stateOf(id)];
  }
  protected controlOf(key: ControlKey): boolean {
    const c = this.card();
    return c ? (this.controls()[c.id]?.[key] ?? c[key]) : false;
  }

  protected onListClick(event: Event): void {
    const row = (event.target as HTMLElement | null)?.closest?.('md-list-item');
    const id = (row as HTMLElement | null)?.dataset?.['card'];
    if (id) this.selectedId.set(id);
  }

  /* `md-switch` emits `mdChange` AFTER it has flipped itself, so the element's
     own state is already right and only this screen has to follow. Freeze and
     the three toggles share one delegated listener, keyed by `data-control`. */
  protected onControl(event: Event): void {
    const key = (event.target as HTMLElement | null)?.dataset?.['control'];
    const card = this.card();
    if (!key || !card) return;
    const selected = (event as CustomEvent<{ selected: boolean }>).detail.selected;

    if (key === 'freeze') {
      const next: CardState = selected ? 'frozen' : 'active';
      this.states.update((s) => ({ ...s, [card.id]: next }));
      this.message.set(
        this.t(next === 'frozen' ? 'banking.msg.cardFrozen' : 'banking.msg.cardUnfrozen'),
      );
      return;
    }

    this.controls.update((c) => ({
      ...c,
      [card.id]: { ...c[card.id], [key as ControlKey]: selected },
    }));
    this.message.set(this.t('banking.msg.controlSaved'));
  }
}
