import {
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  ElementRef,
  EventEmitter,
  inject,
  Input,
  NgZone,
  Output,
  ViewChild,
  type AfterViewInit,
  type OnDestroy,
  type OnInit,
} from '@angular/core';
import { Router } from '@angular/router';
import {
  getClientById,
  getGoalById,
  getPortfolioById,
  kycDot,
  REPORTING_DATE,
  type Activity,
  type AllocationRow,
  type Client,
  type Goal,
  type Household,
  type Portfolio,
  type Proposal,
} from '@awc-ui/showcase-kit/wealth';
import { ShowcaseComponent } from '../lib/screen.base';
import { EmptyStateComponent } from '../components/empty-state.component';
import {
  ChipComponent,
  CountComponent,
  DateTextComponent,
  FactComponent,
  FundedMeterComponent,
  MoneyComponent,
  NumComponent,
  PercentComponent,
  SignedComponent,
} from '../components/bits.component';

/**
 * Four sibling views of ONE household: members, mandate, documents, activity.
 *
 * THIS IS THE LEGITIMATE USE OF `md-tabs` (§7.3). The tabs do not navigate —
 * every panel describes the same household from a different angle, the reader
 * may move between them in any order, and the URL does not change. App
 * destinations remain the rail and the bar, which `AppComponent` owns and this
 * file never touches.
 *
 * PANELS ARE MOUNTED BEFORE THEY ARE ASKED FOR, but never up front.
 * `md-tab-panels` is explicit that nothing is lazily rendered — inactive panel
 * content stays in the DOM — and it tells you to mount expensive content
 * yourself. So the first panel is built with the screen, and the other three
 * are built one at a time during idle periods once it has painted; see
 * `opened` below for what that buys and why the idle wait is the whole point.
 * The panel ELEMENTS are always present, because `md-tab-panels` pairs panels
 * to tabs BY POSITION and a missing panel would shift every one after it.
 *
 * `sizing="active"` rather than the default `stable`: with `stable` the region
 * is permanently as tall as the tallest panel, and the org chart is several
 * times the height of the activity list — a card of empty space under every
 * other tab. The trade is a layout shift on switch, which is the honest one.
 *
 * SELECTION STATE THAT SURVIVES A TAB SWITCH lives in this component rather
 * than in the panels. Keeping panels mounted would preserve it either way now,
 * but that is a performance choice this file is free to revisit and not a
 * contract — ticking three members, reading the mandate and coming back must
 * not clear the selection whichever way the mounting goes.
 */

/* ------------------------------------------------------------------ shared */

/**
 * An `md-button` that reports through `mdClick`.
 *
 * §9.1: listen to the component's own event, never the native `click` — the
 * native one fires even when the component's `disabled` / `soft-disabled` /
 * `loading` guard has already suppressed the action. An ATTRIBUTE selector on
 * `md-button` itself, because an `md-toolbar` wires roving focus over its
 * DIRECT children: a wrapper element around the button would break that, and
 * this renders none.
 */
@Component({
  selector: 'md-button[awcAction]',
  standalone: true,
  host: {
    size: 'sm',
    '[attr.variant]': 'variant',
    '[attr.icon]': 'icon',
    '[attr.soft-disabled]': "softDisabled ? '' : null",
    '(mdClick)': 'onActivate()',
  },
  template: '<ng-content />',
})
export class ActionButtonComponent {
  @Input({ required: true }) icon!: string;
  @Input() variant: 'text' | 'tonal' | 'filled' | 'outlined' | 'elevated' = 'text';
  @Input() softDisabled = false;
  @Output() readonly activate = new EventEmitter<void>();

  protected onActivate(): void {
    if (this.softDisabled) return;
    this.activate.emit();
  }
}

/**
 * Initials for a DECORATIVE avatar.
 *
 * `md-avatar` derives initials from `name` itself — but setting `name` also
 * gives the avatar `role="img"` and an `aria-label`, and the row it sits in
 * already announces that same name as its headline. Passing `initials` and
 * leaving `name` / `label` / `alt` empty is the documented way to make the
 * avatar decorative, which is what a picture beside its own caption is.
 */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1] : '';
  return `${first.slice(0, 1)}${last.slice(0, 1)}`;
}

/** A person, an entity or an objective as an org-chart node. */
interface OrgNode {
  id: string;
  name: string;
  title?: string;
  avatarInitials?: string;
  children?: OrgNode[];
}

/** `selectedIds` is property-only — the one write the template cannot make. */
type OrgChartElement = HTMLElement & { selectedIds?: string[] };

/**
 * Run `work` when the browser has nothing better to do, and return its cancel.
 *
 * `requestIdleCallback` is the whole point of the warm-up below — it is what
 * keeps building a panel nobody has asked for off the critical path, rather
 * than merely off the click. The `timeout` caps how long a busy tab can defer
 * it; without one, a page that never goes idle never warms and the first click
 * pays the old cost. Safari only shipped it in 17, hence the `setTimeout`
 * fallback — a fixed delay is a worse scheduler but a correct one.
 */
function whenIdle(work: () => void): () => void {
  const host = window as typeof window & {
    requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
    cancelIdleCallback?: (handle: number) => void;
  };

  if (typeof host.requestIdleCallback === 'function') {
    const handle = host.requestIdleCallback(work, { timeout: 500 });
    return () => host.cancelIdleCallback?.(handle);
  }

  const timer = window.setTimeout(work, 200);
  return () => window.clearTimeout(timer);
}

const PANEL_COUNT = 4;

/* ------------------------------------------------------------ node detail */

/**
 * The detail pane beside the org chart, on a surface of its own.
 *
 * The card is HERE rather than inside each branch: all four of them — client,
 * objective, mandate, household — are the same pane showing whatever is
 * selected, so they share one surface, and wrapping once means a fifth branch
 * cannot forget it. `variant="outlined"` is the same
 * `--md-sys-color-surface-container-low` the charts sit on, which is what makes
 * this read as a panel beside the tree rather than as loose text under it.
 *
 * The id comes from the chart, which got it from the fixture, so every branch
 * here is a selector lookup rather than a cache — and each one may return
 * `undefined`, which is what the household fallback at the end is for.
 */
@Component({
  selector: 'awc-node-detail',
  standalone: true,
  styles: ':host { display: contents; }',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [
    ChipComponent,
    DateTextComponent,
    FactComponent,
    FundedMeterComponent,
    MoneyComponent,
    NumComponent,
  ],
  template: `
    <md-card variant="outlined" full-width class="surface-card fact-card">
      <!--
        NESTED RATHER THAN A FOUR-BRANCH CHAIN. Angular 17 allows the "; as"
        alias only on the PRIMARY @if — "@else if (goal; as goal)" is a
        template parse error (NG5002) — and each branch here narrows a getter
        that may return undefined, so each one needs its own alias. Nesting
        buys the narrowing back without adding a single element: @if renders
        no host node, so the four branches are still four alternative bodies of
        the same card.
      -->
      @if (client; as client) {
        <div class="stack">
          <div class="row">
            <md-chip awcChip kind="clientRole" [value]="client.role"></md-chip>
            <md-chip awcChip kind="kyc" [value]="client.kycStatus"></md-chip>
            <md-chip awcChip kind="riskTolerance" [value]="client.riskTolerance"></md-chip>
          </div>
          <dl class="dl">
            <div awcFact [label]="t('wealth.table.client')">{{ client.name }}</div>
            <div awcFact [label]="t('wealth.table.age')">
              <span awcNum [value]="client.age"></span>
            </div>
            <div awcFact [label]="t('wealth.table.domicile')">
              {{ t('wealth.country.' + client.domicile) }}
            </div>
            <div awcFact [label]="t('wealth.table.kycReview')">
              <time awcDate [value]="client.kycReviewDate"></time>
            </div>
            <div awcFact [label]="t('wealth.table.contact')">
              <span class="muted">{{ client.email }}</span>
            </div>
            <div awcFact [label]="t('wealth.table.id')">{{ client.id }}</div>
          </dl>
        </div>
      } @else {
        @if (goal; as goal) {
          <div class="stack">
            <div class="row">
              <md-chip awcChip kind="priority" [value]="goal.priority"></md-chip>
              <md-chip awcChip kind="goal" [value]="goal.status"></md-chip>
            </div>
            <awc-funded-meter [fraction]="goal.fundedPct" [status]="goal.status" />
            <dl class="dl">
              <div awcFact [label]="t('wealth.table.goal')">{{ t(goal.typeKey) }}</div>
              <div awcFact [label]="t('wealth.table.targetAmount')">
                <span awcMoney [value]="goal.targetAmount" [compact]="true"></span>
              </div>
              <div awcFact [label]="t('wealth.table.targetDate')">
                <time awcDate [value]="goal.targetDate"></time>
              </div>
              <div awcFact [label]="t('wealth.table.projected')">
                <span awcMoney [value]="goal.projectedAmount" [compact]="true"></span>
              </div>
            </dl>
          </div>
        } @else {
          @if (portfolio; as portfolio) {
            <div class="stack">
              <div class="row">
                <md-chip awcChip kind="strategy" [value]="portfolio.strategy"></md-chip>
              </div>
              <dl class="dl">
                <div awcFact [label]="t('wealth.table.id')">{{ portfolio.reference }}</div>
                <div awcFact [label]="t('wealth.table.benchmark')">
                  {{ portfolio.benchmarkName }}
                </div>
                <div awcFact [label]="t('wealth.table.marketValue')">
                  <span awcMoney [value]="portfolio.marketValue" [compact]="true"></span>
                </div>
                <div awcFact [label]="t('wealth.kpi.cash')">
                  <span awcMoney [value]="portfolio.cashBalance" [compact]="true"></span>
                </div>
                <div awcFact [label]="t('wealth.table.inception')">
                  <time awcDate [value]="portfolio.inceptionDate"></time>
                </div>
                <div awcFact [label]="t('wealth.table.fee')">
                  {{ t('wealth.unit.bps', { value: t.formatNumber(portfolio.feeBps) }) }}
                </div>
              </dl>
            </div>
          } @else {
            <div class="stack">
              <div class="row">
                <md-chip awcChip kind="segment" [value]="household.segment"></md-chip>
                <md-chip awcChip kind="mandate" [value]="household.mandate"></md-chip>
              </div>
              <dl class="dl">
                <div awcFact [label]="t('wealth.table.household')">{{ household.name }}</div>
                <div awcFact [label]="t('wealth.table.domicile')">
                  {{ t('wealth.country.' + household.domicile) }}
                </div>
                <div awcFact [label]="t('wealth.table.members')">
                  <span awcNum [value]="household.memberCount"></span>
                </div>
                <div awcFact [label]="t('wealth.table.onboarded')">
                  <time awcDate [value]="household.onboardedDate"></time>
                </div>
                <div awcFact [label]="t('wealth.table.advisor')">{{ household.advisorName }}</div>
                <div awcFact [label]="t('wealth.table.aum')">
                  <span awcMoney [value]="household.totalAum" [compact]="true"></span>
                </div>
              </dl>
            </div>
          }
        }
      }
    </md-card>
  `,
})
export class NodeDetailComponent extends ShowcaseComponent {
  @Input({ required: true }) nodeId!: string;
  @Input({ required: true }) household!: Household;

  protected get client(): Client | undefined {
    return getClientById(this.nodeId);
  }

  protected get goal(): Goal | undefined {
    return this.client ? undefined : getGoalById(this.nodeId);
  }

  protected get portfolio(): Portfolio | undefined {
    return this.client || this.goal ? undefined : getPortfolioById(this.nodeId);
  }
}

/* ---------------------------------------------------------------- members */

/**
 * The household's structure, twice: as a tree and as a list.
 *
 * The org chart's own manual asks for exactly this — "offer a non-visual
 * alternative for the hierarchy" — because a connector-drawn tree is a PICTURE
 * of structure and a picture is not available to every reader. The list below
 * it is that alternative, and it is also where the per-member controls live: a
 * tree item cannot hold a checkbox, since the chart renders its own node chrome
 * and its togglers are deliberately out of the tab order.
 *
 * THE TREE IS REAL RELATIONS, not decoration: the household entity at the root,
 * its mandate and its members beneath it, and each objective under the member
 * it is earmarked for (`Goal.beneficiaryClientId`), with the household-level
 * ones hanging off the root. Selecting any node fills the panel beside it.
 */
@Component({
  selector: 'awc-household-members',
  standalone: true,
  styles: ':host { display: contents; }',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [ActionButtonComponent, CountComponent, EmptyStateComponent, NodeDetailComponent],
  template: `
    @if (members.length === 0) {
      <awc-empty-state [message]="t('wealth.empty.clients')" />
    } @else {
      <div class="stack">
        <div class="grid-wide">
          <!--
            The wealth dictionary has no expand/collapse verbs; these two are
            in the shared core block, which every locale is required to
            translate — so they are localised in ro and ar today, which the
            component's English defaults would not be (§9.2).

            nodes has no attribute form, so it is a PROPERTY binding — and it
            is bound ALONE, memoised on the household and the locale.
            Reassigning nodes rebuilds the chart's collapsed set from the
            data, so folding selectedIds into the same write would re-fold
            every branch the reader had opened each time they clicked a node;
            selectedIds is property-only and written imperatively instead.
          -->
          <md-organization-chart
            #chart
            class="table-host"
            selection-mode="single"
            orientation="vertical"
            [nodes]="nodesValue"
            [attr.label]="t('wealth.panel.members')"
            [attr.expand-label]="t('action.expand')"
            [attr.collapse-label]="t('action.collapse')"
            (mdSelectionChange)="onSelection($event)"
          >
            <div slot="empty">{{ t('wealth.empty.clients') }}</div>
          </md-organization-chart>

          <awc-node-detail [nodeId]="focusId" [household]="household" />
        </div>

        <md-divider></md-divider>

        <div class="row row--between">
          <h3 class="panel__title">{{ t('wealth.panel.members') }}</h3>
          <!--
            ALWAYS RENDERED, HIDDEN WHILE NOTHING IS SELECTED.

            It used to be mounted only once a row was ticked, so this header
            row was the height of its heading until then and the height of a
            40px button after — and the whole member list below jumped down the
            moment you selected anything, which is the opposite of what
            selecting should feel like.

            visibility: hidden rather than a reserved min-block-size on the
            row: the space reserved is then exactly what the real cluster
            occupies, at any density and in any locale, with no number here
            that can drift from it. It also takes the button out of the tab
            order and out of the accessibility tree while it is inert, which
            opacity: 0 would not.
          -->
          <span
            class="row"
            [attr.aria-hidden]="selected.length > 0 ? null : 'true'"
            [style.visibility]="selected.length > 0 ? null : 'hidden'"
          >
            <md-chip awcCount [value]="selected.length"></md-chip>
            <md-button
              awcAction
              icon="mail"
              (activate)="notify.emit(t('wealth.activity.client-contacted'))"
            >
              {{ t('wealth.action.contact') }}
            </md-button>
          </span>
        </div>

        <!--
          interaction-mode="multi-action": the row is a label and the trailing
          controls are the actions, each keeping its own tab stop. No
          selection-mode — the checkbox IS the selection here, and a listbox
          mode would put a second, competing selected state on the row itself.
          Both listeners are delegated: mdChange and mdClick bubble and are
          composed, and the retargeted event.target is the md-* host carrying
          the data-id.
        -->
        <md-list
          [attr.label]="t('wealth.panel.members')"
          interaction-mode="multi-action"
          (mdChange)="onMemberChange($event)"
          (mdClick)="onMemberClick($event)"
        >
          @for (client of members; track client.id) {
            <!--
              THE KYC STATE IS IN THE SUPPORTING TEXT, not in a trailing chip,
              and that is a layout decision made by looking at the rendered
              row. md-list-item lays its trailing slot out as a column, so a
              chip pair plus the two controls became three stacked lines and a
              140px row. The trailing edge is for CONTROLS (§7.2 pairs the row
              with a checkbox, a switch or an icon button); the facts belong in
              the row's own text, where they also stay readable at density -4.
            -->
            <md-list-item
              [attr.headline]="client.name"
              [attr.overline]="t(client.roleKey)"
              [attr.supporting-text]="
                t('wealth.table.age') +
                ' ' +
                t.formatNumber(client.age) +
                ' · ' +
                t('wealth.country.' + client.domicile) +
                ' · ' +
                t(client.kycStatusKey)
              "
              lines="3"
            >
              <!-- The avatar + corner dot pattern from md-status-dot's manual:
                   the dot positions itself absolutely, so it needs a
                   positioned ancestor, and .badge-anchor is the one this app
                   already has. Both are decorative — the headline carries the
                   name and the supporting text carries the KYC state in words,
                   so the dot's colour repeats it rather than being its only
                   carrier. -->
              <span slot="leading" class="badge-anchor">
                <md-avatar [attr.initials]="initialsOf(client.name)" size="small"></md-avatar>
                <md-status-dot
                  shape="circle"
                  [attr.state]="kycDot[client.kycStatus]"
                  size="small"
                ></md-status-dot>
              </span>

              <!-- ONE trailing element holding two controls, not two trailing
                   elements: the slot lays its children out as a column, so two
                   siblings stack and make the row twice as tall. Wrapped in a
                   .row they sit side by side and each keeps its own tab stop,
                   because both are still light-DOM elements. -->
              <span slot="trailing" class="row">
                <md-icon-button
                  [attr.data-id]="client.id"
                  icon="mail"
                  [attr.aria-label]="t('wealth.action.contact') + ' — ' + client.name"
                ></md-icon-button>
                <!-- md-checkbox renders no slot at all, so a label cannot be
                     slotted into it — aria-label is the only accessible name a
                     checkbox inside a row can have. -->
                <md-checkbox
                  [attr.data-id]="client.id"
                  [attr.checked]="selected.includes(client.id) ? '' : null"
                  [attr.aria-label]="client.name"
                ></md-checkbox>
              </span>
            </md-list-item>
          }
        </md-list>
      </div>
    }
  `,
})
export class MembersPanelComponent
  extends ShowcaseComponent
  implements OnInit, AfterViewInit
{
  @Input({ required: true }) household!: Household;
  @Input({ required: true }) portfolio!: Portfolio | undefined;
  @Input({ required: true }) members!: Client[];
  @Input({ required: true }) goals!: Goal[];
  @Input({ required: true }) selected!: string[];
  @Output() readonly selectedChange = new EventEmitter<string[]>();
  @Output() readonly notify = new EventEmitter<string>();

  @ViewChild('chart') private chartEl?: ElementRef<HTMLElement>;

  protected readonly kycDot = kycDot;
  protected readonly initialsOf = initialsOf;

  protected focusId = '';

  ngOnInit(): void {
    // Once, like the React build's useState initial value: a navigation from
    // one household to another reuses this instance and keeps the focus.
    this.focusId = this.members[0]?.id ?? this.household.id;
  }

  ngAfterViewInit(): void {
    this.applySelection();
  }

  /** Memoised on content: reassigning `nodes` re-folds the chart. */
  protected get nodesValue(): OrgNode[] {
    return this.memo(`nodes:${this.household.id}`, () => this.buildNodes());
  }

  private buildNodes(): OrgNode[] {
    const objectivesFor = (clientId: string | null): OrgNode[] =>
      this.goals
        .filter((goal) => goal.beneficiaryClientId === clientId)
        .map((goal) => ({
          id: goal.id,
          name: this.t(goal.typeKey),
          title: this.t.formatPercent(goal.fundedPct, { maximumFractionDigits: 0 }),
        }));

    const memberNodes: OrgNode[] = this.members.map((client) => {
      const children = objectivesFor(client.id);
      return {
        id: client.id,
        name: client.name,
        title: this.t(client.roleKey),
        avatarInitials: initialsOf(client.name),
        ...(children.length ? { children } : {}),
      };
    });

    const mandateNode: OrgNode[] = this.portfolio
      ? [
          {
            id: this.portfolio.id,
            name: this.portfolio.reference,
            title: this.t(this.portfolio.strategyKey),
          },
        ]
      : [];

    return [
      {
        id: this.household.id,
        name: this.household.name,
        title: this.t(this.household.segmentKey),
        children: [...mandateNode, ...memberNodes, ...objectivesFor(null)],
      },
    ];
  }

  protected onSelection(event: Event): void {
    // Single-select: clicking the selected node DESELECTS it and reports an
    // empty array. Falling back to the household keeps the detail panel from
    // emptying out under the reader.
    const detail = (event as CustomEvent<{ selectedIds: string[] }>).detail;
    this.focusId = detail.selectedIds[0] ?? this.household.id;
    this.applySelection();
  }

  private applySelection(): void {
    const chart = this.chartEl?.nativeElement as OrgChartElement | undefined;
    if (chart) chart.selectedIds = this.focusId ? [this.focusId] : [];
  }

  protected onMemberChange(event: Event): void {
    const id = (event.target as HTMLElement | null)?.dataset?.['id'];
    if (!id) return;
    const { checked } = (event as CustomEvent<{ checked: boolean }>).detail;
    this.selectedChange.emit(
      checked ? [...this.selected, id] : this.selected.filter((one) => one !== id),
    );
  }

  protected onMemberClick(event: Event): void {
    const id = (event.target as HTMLElement | null)?.dataset?.['id'];
    if (!id || !this.members.some((client) => client.id === id)) return;
    this.notify.emit(this.t('wealth.activity.client-contacted'));
  }
}

/* ---------------------------------------------------------------- mandate */

/**
 * The mandate: its terms as facts, its clauses as an accordion.
 *
 * `md-accordion` and not a second tab strip — these are independent sections a
 * reader opens on demand, which is §5.5's "progressive disclosure of sections",
 * where tabs are peer views of one thing. `exclusive` is off, because comparing
 * the fee clause against the rebalancing clause means having both open, and
 * `heading-level="3"` puts the clause headers under the panel's own `h2`
 * (`md-accordion-item` renders a REAL `<h3>`, not an ARIA role).
 *
 * THE RATING IS A CONTROL, NOT A READOUT. `md-rating` is §5.3's "subjective
 * score", and the score an advisor records at a review is exactly that — it is
 * not in the fixture, because it is a judgement made here rather than a fact
 * about the book. It gates the review action through `soft-disabled` plus an
 * `md-tooltip` (§9.2: keep a contextually-unavailable control focusable and say
 * what is missing, rather than dropping it out of the tab order in silence).
 */
@Component({
  selector: 'awc-household-mandate',
  standalone: true,
  styles: ':host { display: contents; }',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [
    ActionButtonComponent,
    ChipComponent,
    DateTextComponent,
    FactComponent,
    MoneyComponent,
    NumComponent,
    PercentComponent,
    SignedComponent,
    EmptyStateComponent,
  ],
  template: `
    @if (portfolio; as portfolio) {
      <div class="stack">
        <dl class="dl">
          <div awcFact [label]="t('wealth.table.id')">{{ portfolio.reference }}</div>
          <div awcFact [label]="t('wealth.table.benchmark')">{{ portfolio.benchmarkName }}</div>
          <div awcFact [label]="t('wealth.table.inception')">
            <time awcDate [value]="portfolio.inceptionDate"></time>
          </div>
          <div awcFact [label]="t('wealth.table.fee')">
            {{ t('wealth.unit.bps', { value: t.formatNumber(portfolio.feeBps) }) }}
          </div>
          <div awcFact [label]="t('wealth.kpi.cash')">
            <span awcMoney [value]="portfolio.cashBalance" [compact]="true"></span>
          </div>
          <div
            awcFact
            [label]="reviewed ? t('wealth.table.lastReview') : t('wealth.table.nextReview')"
          >
            <!-- Recording the review stamps the REPORTING DATE, never a clock:
                 this console has no Date.now() anywhere, and the reporting
                 date is the only "today" the fixture admits. -->
            <time awcDate [value]="reviewed ? reportingDate : portfolio.nextReviewDate"></time>
          </div>
        </dl>

        <md-accordion variant="outlined" heading-level="3" default-expanded="0">
          <md-accordion-item [attr.headline]="t('wealth.table.strategy')" icon="pie_chart">
            <div class="stack">
              <!--
                THREE LABELLED FACTS, not a bare row of chips.

                RiskProfile and Strategy are DIFFERENT fields — the appetite
                the household agreed, and the strategy its mandate runs off it
                — and they genuinely differ for half the book (defensive runs
                conservative, dynamic runs aggressive), so both belong here.
                But they share the words "balanced" and "growth", and
                riskProfileColor maps position-for-position onto strategyColor:
                on the four households where the words collide the two chips
                came out BYTE-IDENTICAL side by side — same label, same role,
                same width, nothing to say which was which. Colour can never
                separate them; only the dt can, for a reader and for a screen
                reader alike.
              -->
              <dl class="dl">
                <div awcFact [label]="t('wealth.table.strategy')">
                  <md-chip awcChip kind="strategy" [value]="portfolio.strategy"></md-chip>
                </div>
                <div awcFact [label]="t('wealth.table.riskProfile')">
                  <md-chip awcChip kind="riskProfile" [value]="household.riskProfile"></md-chip>
                </div>
                <div awcFact [label]="t('wealth.table.mandate')">
                  <md-chip awcChip kind="mandate" [value]="household.mandate"></md-chip>
                </div>
              </dl>
              <dl class="dl">
                @for (row of allocation; track row.assetClass) {
                  <div awcFact [label]="t(row.assetClassKey)">
                    <span awcPercent [value]="row.targetWeight" [digits]="0"></span>
                  </div>
                }
              </dl>
            </div>
          </md-accordion-item>

          <md-accordion-item [attr.headline]="t('wealth.table.fee')" icon="receipt_long">
            <dl class="dl">
              <div awcFact [label]="t('wealth.table.fee')">
                {{ t('wealth.unit.bps', { value: t.formatNumber(portfolio.feeBps) }) }}
              </div>
              <div awcFact [label]="t('wealth.table.costBasis')">
                <span awcMoney [value]="portfolio.costBasis" [compact]="true"></span>
              </div>
              <div awcFact [label]="t('wealth.table.marketValue')">
                <span awcMoney [value]="portfolio.marketValue" [compact]="true"></span>
              </div>
              <div awcFact [label]="t('wealth.table.unrealisedPl')">
                <bdi awcSigned [value]="portfolio.unrealisedPl" [compact]="true"></bdi>
              </div>
              <div awcFact [label]="t('wealth.table.plPct')">
                <bdi awcSigned [value]="portfolio.unrealisedPlPct" kind="percent"></bdi>
              </div>
            </dl>
          </md-accordion-item>

          <md-accordion-item [attr.headline]="t('wealth.panel.rebalance')" icon="balance">
            <dl class="dl">
              <div awcFact [label]="t('wealth.table.lastRebalance')">
                <time awcDate [value]="portfolio.lastRebalanceDate"></time>
              </div>
              <div awcFact [label]="t('wealth.table.nextReview')">
                <time awcDate [value]="portfolio.nextReviewDate"></time>
              </div>
              <div awcFact [label]="t('wealth.table.lastContact')">
                <time awcDate [value]="household.lastContactDate"></time>
              </div>
              <div awcFact [label]="t('wealth.kpi.driftBreaches')">
                <span awcNum [value]="breachCount"></span>
              </div>
            </dl>
          </md-accordion-item>

          <md-accordion-item [attr.headline]="t('wealth.table.riskProfile')" icon="shield">
            <div class="stack">
              <dl class="dl">
                <div awcFact [label]="t('wealth.kpi.maxDrawdown')">
                  <bdi awcSigned [value]="portfolio.maxDrawdown" kind="percent"></bdi>
                </div>
                <div awcFact [label]="t('wealth.kpi.twoYearReturn')">
                  <span awcPercent [value]="portfolio.twoYearReturn"></span>
                </div>
                <div awcFact [label]="t('wealth.kpi.benchmark')">
                  <span awcPercent [value]="portfolio.benchmarkTwoYearReturn"></span>
                </div>
              </dl>

              <div class="row">
                <span class="muted">{{ t('wealth.table.riskTolerance') }}</span>
                <!--
                  getLabel is a FUNCTION prop and has no attribute form. It
                  drives both the visible value label and aria-valuetext, which
                  makes it the one hook that decides what a screen reader says
                  at each step — so it resolves through the dictionary rather
                  than through a template literal, and it is memoised per
                  locale because it closes over the translator.

                  md-rating's mdChange carries the value itself, not an object.
                -->
                <md-rating
                  [getLabel]="ratingLabel"
                  [attr.value]="score"
                  max="5"
                  precision="1"
                  size="sm"
                  show-value-label
                  [attr.rating-label]="t('wealth.table.riskTolerance')"
                  (mdChange)="onRate($event)"
                ></md-rating>
              </div>

              <div class="row">
                <!-- The tooltip exists only while the gate does: once a score
                     is recorded the button is live, and an explanation of why
                     it is off would be a lie. A tooltip is a DESCRIPTION and
                     never a name — the button's own label is its name. -->
                <md-tooltip
                  [attr.text]="t('wealth.table.riskTolerance')"
                  [attr.disabled]="score > 0 ? '' : null"
                >
                  <md-button
                    awcAction
                    icon="task_alt"
                    variant="tonal"
                    [softDisabled]="score === 0 || reviewed"
                    (activate)="completed.emit()"
                  >
                    {{ t('wealth.action.review') }}
                  </md-button>
                </md-tooltip>
                @if (reviewed) {
                  <span class="muted">{{ t('wealth.activity.review-completed') }}</span>
                }
              </div>
            </div>
          </md-accordion-item>
        </md-accordion>
      </div>
    } @else {
      <awc-empty-state [message]="t('wealth.common.na')" />
    }
  `,
})
export class MandatePanelComponent extends ShowcaseComponent {
  @Input({ required: true }) household!: Household;
  @Input({ required: true }) portfolio!: Portfolio | undefined;
  @Input({ required: true }) allocation!: AllocationRow[];
  @Input({ required: true }) breachCount!: number;
  @Input({ required: true }) score!: number;
  @Input({ required: true }) reviewed!: boolean;
  @Output() readonly scoreChange = new EventEmitter<number>();
  @Output() readonly completed = new EventEmitter<void>();

  protected readonly reportingDate = REPORTING_DATE;

  protected get ratingLabel(): (value: number) => string {
    return this.memo('rating:getLabel', () => (value: number) =>
      this.t('wealth.common.of', { count: this.t.formatNumber(value), total: 5 }),
    );
  }

  protected onRate(event: Event): void {
    this.scoreChange.emit((event as CustomEvent<number>).detail);
  }
}

/* -------------------------------------------------------------- documents */

/**
 * The household's advice documents.
 *
 * A proposal IS the document in this domain — a draft advice paper moving
 * through five review steps — so this list is `getProposalsFor()` and not a
 * second, invented entity. `md-list` rather than a table (§5.5: a short
 * vertical set of records), rows are text rows, and the drill is the trailing
 * `md-icon-button`: routing from the icon button's own `mdClick` keeps the
 * navigation in the SPA, where a row-level `href` would hand it to
 * `window.location` and reload the whole application.
 */
@Component({
  selector: 'awc-household-documents',
  standalone: true,
  styles: ':host { display: contents; }',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [ChipComponent, EmptyStateComponent],
  template: `
    @if (proposals.length === 0) {
      <awc-empty-state [message]="t('wealth.empty.proposals')" />
    } @else {
      <md-list
        [attr.label]="t('wealth.kpi.proposals')"
        interaction-mode="multi-action"
        list-style="segmented"
        (mdClick)="onListClick($event)"
      >
        @for (proposal of proposals; track proposal.id) {
          <md-list-item
            [attr.headline]="t(proposal.typeKey)"
            [attr.overline]="proposal.id"
            [attr.supporting-text]="
              t('wealth.common.of', {
                count: proposal.completedStepCount,
                total: proposal.stepCount
              }) +
              ' · ' +
              t('wealth.unit.days', { value: t.formatNumber(proposal.daysOpen) })
            "
            leading-icon="description"
            lines="3"
          >
            <!-- One trailing element, for the same reason as the members list:
                 the slot stacks its children, so the chips and the drill would
                 sit on two lines and double the row height. -->
            <span slot="trailing" class="row">
              <md-chip awcChip kind="proposalType" [value]="proposal.type"></md-chip>
              <md-chip awcChip kind="proposalStatus" [value]="proposal.status"></md-chip>
              <md-icon-button
                [attr.data-id]="proposal.id"
                icon="open_in_new"
                [attr.aria-label]="t('wealth.action.review') + ' — ' + proposal.id"
              ></md-icon-button>
            </span>
          </md-list-item>
        }
      </md-list>
    }
  `,
})
export class DocumentsPanelComponent extends ShowcaseComponent {
  @Input({ required: true }) proposals!: Proposal[];

  private readonly router = inject(Router);

  protected onListClick(event: Event): void {
    const id = (event.target as HTMLElement | null)?.dataset?.['id'];
    if (!id) return;
    void this.router.navigateByUrl(this.appPath(this.route.proposals()));
  }
}

/* --------------------------------------------------------------- activity */

/** The household's audit trail, newest first — as the kit already returns it. */
@Component({
  selector: 'awc-household-activity',
  standalone: true,
  styles: ':host { display: contents; }',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [ChipComponent, DateTextComponent, EmptyStateComponent],
  template: `
    @if (activity.length === 0) {
      <awc-empty-state [message]="t('wealth.empty.activity')" />
    } @else {
      <md-list [attr.label]="t('wealth.panel.activity')">
        @for (entry of activity; track entry.id) {
          <md-list-item
            [attr.headline]="t(entry.actionKey)"
            [attr.overline]="t(entry.targetTypeKey) + ' · ' + entry.targetLabel"
            [attr.supporting-text]="entry.actorName"
            leading-icon="history"
            lines="3"
          >
            <span slot="trailing" class="row">
              <md-chip awcChip kind="activityCategory" [value]="entry.category"></md-chip>
            </span>
            <span slot="trailing-supporting-text">
              <time awcDate [value]="entry.date" dateStyle="short"></time>
            </span>
          </md-list-item>
        }
      </md-list>
    }
  `,
})
export class ActivityPanelComponent extends ShowcaseComponent {
  @Input({ required: true }) activity!: Activity[];
}


/* -------------------------------------------------------------------- tabs */

/*
 * DECLARED LAST, and that is a compiler constraint rather than a reading
 * order. A standalone component's `imports` array is a value reference
 * evaluated when the decorator runs, so a component listed there must already
 * be defined — the four panels and `NodeDetailComponent` above are what this
 * one is assembled from, so it comes after all five. (`tsc --noEmit`, the
 * lint gate, reports the other order as TS2449 "used before its
 * declaration".) The file still reads top-down as: the shared pieces, the
 * panels, then the strip that holds them.
 */

@Component({
  selector: 'awc-household-tabs',
  standalone: true,
  styles: ':host { display: contents; }',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [
    MembersPanelComponent,
    MandatePanelComponent,
    DocumentsPanelComponent,
    ActivityPanelComponent,
  ],
  template: `
    <div class="stack">
      <!--
        tab-width="auto" rather than the default equal: the four labels are of
        very different lengths and equal tracks would truncate the longest in
        English and more of them in a longer language. Every tab carries an
        icon — M3 forbids mixing icon+text tabs with text-only ones in the same
        set. variant and active are stamped onto the children by the strip, and
        md-tabs has no density prop, so none of the three appears below.
      -->
      <md-tabs
        id="household-tabs"
        [attr.aria-label]="t('wealth.nav.household')"
        [attr.active-tab-index]="active"
        tab-width="auto"
        (mdTabChange)="onTabChange($event)"
      >
        @for (tab of tabs; track tab.labelKey) {
          <md-tab
            [attr.label]="t(tab.labelKey)"
            [attr.icon]="tab.icon"
            inline-icon
            [attr.badge]="tab.badge ?? null"
          ></md-tab>
        }
      </md-tabs>

      <md-tab-panels for="household-tabs" sizing="active">
        <md-tab-panel>
          @if (opened.has(0)) {
            <awc-household-members
              [household]="household"
              [portfolio]="portfolio"
              [members]="members"
              [goals]="goals"
              [selected]="selectedMembers"
              (selectedChange)="selectedMembers = $event"
              (notify)="notify.emit($event)"
            />
          }
        </md-tab-panel>

        <md-tab-panel>
          @if (opened.has(1)) {
            <awc-household-mandate
              [household]="household"
              [portfolio]="portfolio"
              [allocation]="allocation"
              [breachCount]="breachCount"
              [score]="reviewScore"
              [reviewed]="reviewed"
              (scoreChange)="reviewScore = $event"
              (completed)="onReviewed()"
            />
          }
        </md-tab-panel>

        <md-tab-panel>
          @if (opened.has(2)) {
            <awc-household-documents [proposals]="proposals" />
          }
        </md-tab-panel>

        <md-tab-panel>
          @if (opened.has(3)) {
            <awc-household-activity [activity]="activity" />
          }
        </md-tab-panel>
      </md-tab-panels>
    </div>
  `,
})
export class HouseholdTabsComponent
  extends ShowcaseComponent
  implements AfterViewInit, OnDestroy
{
  @Input({ required: true }) household!: Household;
  @Input({ required: true }) portfolio!: Portfolio | undefined;
  @Input({ required: true }) members!: Client[];
  @Input({ required: true }) goals!: Goal[];
  @Input({ required: true }) proposals!: Proposal[];
  @Input({ required: true }) activity!: Activity[];
  @Input({ required: true }) allocation!: AllocationRow[];
  /** From the kit's `driftedMandates()`, not counted here. */
  @Input({ required: true }) breachCount!: number;
  /** Raise a snackbar on the screen. Every message is a dictionary string. */
  @Output() readonly notify = new EventEmitter<string>();

  protected active = 0;
  /*
   * Which panels have been BUILT. A panel in here has its children mounted and
   * keeps them; one outside it is an empty `md-tab-panel`.
   *
   * Panels used to render their children only while active, so leaving a tab
   * destroyed its contents and returning rebuilt them. Mounting on first
   * activation fixed the return visit and not the first one: clicking a tab
   * nobody had opened still mounted dozens of custom elements in the very
   * frame the panel became visible, and the region — `sizing="active"`, so it
   * follows the visible panel — had nothing to be as tall as until the change
   * committed. Measured on the React reference: one painted frame at 0px, then
   * the content appearing into it. That is the flicker.
   *
   * So panel 0 is built with the screen and the rest are built AHEAD of the
   * click, one per idle period. A first click then finds its panel already
   * built and behaves exactly like a return: one height change, no rebuild.
   */
  protected opened = new Set<number>([0]);
  protected selectedMembers: string[] = [];
  protected reviewScore = 0;
  protected reviewed = false;

  private readonly zone = inject(NgZone);
  private frame: number | null = null;
  private cancelIdle: (() => void) | null = null;

  protected get tabs(): { labelKey: string; icon: string; badge?: string }[] {
    return [
      { labelKey: 'wealth.panel.members', icon: 'group', badge: String(this.members.length) },
      { labelKey: 'wealth.panel.mandate', icon: 'gavel' },
      {
        labelKey: 'wealth.kpi.proposals',
        icon: 'description',
        badge: this.proposals.length ? String(this.proposals.length) : undefined,
      },
      { labelKey: 'wealth.panel.activity', icon: 'history' },
    ];
  }

  protected onTabChange(event: Event): void {
    const next = (event as CustomEvent<{ index: number; previousIndex: number }>).detail.index;
    this.active = next;
    // The fallback, for a panel the warm-up below has not reached yet — a
    // click inside the first idle period, or a tab that was backgrounded the
    // whole time. Recorded in the same handler as `active`, so the panel
    // mounts in the pass that activates it rather than a pass later.
    if (!this.opened.has(next)) this.opened = new Set(this.opened).add(next);
  }

  protected onReviewed(): void {
    this.reviewed = true;
    this.notify.emit(this.t('wealth.activity.review-completed'));
  }

  /*
   * WARM THE PANELS NOBODY HAS OPENED YET, once the screen is idle.
   *
   * `requestAnimationFrame` first, so the callback is queued behind the pass
   * that mounted panel 0 and cannot run before it has laid out. Then
   * `whenIdle`, which is what makes this a warm-up rather than a mount-it-all:
   * the elements are built in time the browser was going to spend doing
   * nothing, so nothing here competes with the screen's own first paint. ONE
   * panel per callback, not all three, because a single commit of ~120
   * elements is one long task and three small ones are three short ones.
   *
   * A tab nobody opens still costs something — that is the trade, and it is
   * deliberately taken in idle time rather than refused. What the old lazy
   * rule was really protecting was the FIRST PAINT, and that is now protected
   * by when this runs rather than by whether it runs at all. If the tab is
   * backgrounded, `requestAnimationFrame` never fires and no panel is warmed;
   * the mount-on-activation path above is still there and still correct.
   *
   * BUILDING A PANEL WHILE IT IS HIDDEN IS SAFE FOR WHAT IS IN THESE THREE,
   * and that is a checked claim rather than a hopeful one: `md-accordion-item`
   * expands with `grid-template-rows: 0fr↔1fr`, and `md-rating` and
   * `md-tooltip` only measure from a pointer or a show — none of them reads a
   * box at build time. `md-list-item` is the one that does, for its truncation
   * tooltip, and it re-runs that from its own ResizeObserver the moment the
   * panel gets a size; it toggles a tooltip's `disabled` and never layout.
   * `md-organization-chart`, the component that would have to be argued about,
   * is in panel 0 and is never warmed — it is built with the screen, in the
   * panel the reader is already looking at.
   *
   * `zone.run` wraps the state change, not the scheduling: zone.js does not
   * patch `requestIdleCallback`, so without it the warmed panel would be
   * recorded and NOTHING would re-render until the reader's next interaction.
   */
  ngAfterViewInit(): void {
    this.scheduleWarmup();
  }

  ngOnDestroy(): void {
    // Cleared on the way out, so a fast navigation does not leave an idle
    // callback mounting panels into a screen the reader has already left.
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.cancelIdle?.();
  }

  private scheduleWarmup(): void {
    if (this.opened.size >= PANEL_COUNT) return;
    this.frame = requestAnimationFrame(() => {
      this.cancelIdle = whenIdle(() => {
        this.zone.run(() => {
          const next = new Set(this.opened);
          for (let index = 0; index < PANEL_COUNT; index += 1) {
            if (next.has(index)) continue;
            next.add(index);
            break;
          }
          this.opened = next;
        });
        // Re-schedules after each warm-up commits, which is what queues the
        // next one — the Angular translation of the React effect re-running
        // on each `opened` change.
        this.scheduleWarmup();
      });
    });
  }
}
