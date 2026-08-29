/**
 * Four sibling views of ONE household: members, mandate, documents, activity.
 *
 * THIS IS THE LEGITIMATE USE OF `md-tabs` (§7.3). The tabs do not navigate —
 * every panel describes the same household from a different angle, the reader
 * may move between them in any order, and the URL does not change. App
 * destinations remain the rail and the bar, which `Shell.tsx` owns and this
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

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
import { useRouter } from '@/lib/router';
import { route } from '@/lib/routes';
import { useT } from '@/lib/showcase';
import { EmptyState } from '../Shell';
import { useCustomEvent, useElementProps } from '../elements';
import {
  ActivityCategoryChip,
  ClientRoleChip,
  Count,
  DateText,
  Fact,
  FundedMeter,
  GoalStatusChip,
  KycChip,
  MandateChip,
  Money,
  Num,
  Percent,
  PriorityChip,
  ProposalStatusChip,
  ProposalTypeChip,
  RiskProfileChip,
  RiskToleranceChip,
  SegmentChip,
  Signed,
  StrategyChip,
} from '../bits';

/* ------------------------------------------------------------------ shared */

/**
 * An `md-button` that reports through `mdClick`.
 *
 * §9.1: listen to the component's own event, never the native `click` — the
 * native one fires even when the component's `disabled` / `soft-disabled` /
 * `loading` guard has already suppressed the action. Written as a component
 * because a `ref` is the only way to attach an `md*` listener in React 18, and
 * because an `md-toolbar` wires roving focus over its DIRECT children: a
 * wrapper element around the button would break that, and this renders none.
 */
export function ActionButton({
  icon,
  onActivate,
  variant = 'text',
  softDisabled = false,
  children,
}: {
  icon: string;
  onActivate(): void;
  variant?: 'text' | 'tonal' | 'filled' | 'outlined' | 'elevated';
  softDisabled?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement | null>(null);
  useCustomEvent<CustomEvent>(ref, 'mdClick', () => {
    if (softDisabled) return;
    onActivate();
  });
  return (
    <md-button
      ref={ref}
      variant={variant}
      size="sm"
      icon={icon}
      soft-disabled={softDisabled || undefined}
    >
      {children}
    </md-button>
  );
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

/* -------------------------------------------------------------------- tabs */

export function HouseholdTabs({
  household,
  portfolio,
  members,
  goals,
  proposals,
  activity,
  allocation,
  breachCount,
  onNotify,
}: {
  household: Household;
  portfolio: Portfolio | undefined;
  members: Client[];
  goals: Goal[];
  proposals: Proposal[];
  activity: Activity[];
  allocation: AllocationRow[];
  /** From the kit's `driftedMandates()`, not counted here. */
  breachCount: number;
  /** Raise a snackbar on the screen. Every message is a dictionary string. */
  onNotify(message: string): void;
}) {
  const t = useT();
  const [active, setActive] = useState(0);
  /*
   * Which panels have been BUILT. A panel in here has its children mounted and
   * keeps them; one outside it is an empty `md-tab-panel`.
   *
   * Panels used to render their children only while active, so leaving a tab
   * destroyed its contents and returning rebuilt them. Mounting on first
   * activation fixed the return visit and not the first one: clicking a tab
   * nobody had opened still mounted dozens of custom elements in the very
   * frame the panel became visible, and the region — `sizing="active"`, so it
   * follows the visible panel — had nothing to be as tall as until React
   * committed. Measured: one painted frame at 0px, then the content appearing
   * into it. That is the flicker.
   *
   * So panel 0 is built with the screen and the rest are built AHEAD of the
   * click, one per idle period. A first click then finds its panel already
   * built and behaves exactly like a return: one height change, no rebuild.
   */
  const [opened, setOpened] = useState<Set<number>>(() => new Set([0]));
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [reviewScore, setReviewScore] = useState(0);
  const [reviewed, setReviewed] = useState(false);

  const tabsRef = useRef<HTMLElement | null>(null);
  useCustomEvent<CustomEvent<{ index: number; previousIndex: number }>>(
    tabsRef,
    'mdTabChange',
    (event) => {
      const next = event.detail.index;
      setActive(next);
      // The fallback, for a panel the warm-up below has not reached yet — a
      // click inside the first idle period, or a tab that was backgrounded the
      // whole time. Recorded in the same handler as `active`, so the panel
      // mounts in the commit that activates it rather than a pass later.
      setOpened((prev) => (prev.has(next) ? prev : new Set(prev).add(next)));
    },
  );

  const tabs = [
    { labelKey: 'wealth.panel.members', icon: 'group', badge: String(members.length) },
    { labelKey: 'wealth.panel.mandate', icon: 'gavel', badge: undefined },
    {
      labelKey: 'wealth.kpi.proposals',
      icon: 'description',
      badge: proposals.length ? String(proposals.length) : undefined,
    },
    { labelKey: 'wealth.panel.activity', icon: 'history', badge: undefined },
  ];

  /*
   * WARM THE PANELS NOBODY HAS OPENED YET, once the screen is idle.
   *
   * `requestAnimationFrame` first, so the callback is queued behind the commit
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
   * the mount-on-activation path below is still there and still correct.
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
   */
  useEffect(() => {
    if (opened.size >= tabs.length) return undefined;

    let cancelIdle: (() => void) | null = null;
    const frame = requestAnimationFrame(() => {
      cancelIdle = whenIdle(() => {
        setOpened((prev) => {
          const next = new Set(prev);
          for (let index = 0; index < tabs.length; index += 1) {
            if (next.has(index)) continue;
            next.add(index);
            return next;
          }
          return prev;
        });
      });
    });

    return () => {
      cancelAnimationFrame(frame);
      cancelIdle?.();
    };
    // Re-runs after each warm-up commits, which is what schedules the next one.
  }, [opened, tabs.length]);

  return (
    <div className="stack">
      {/*
        `tab-width="auto"` rather than the default `equal`: the four labels are
        of very different lengths and equal tracks would truncate the longest in
        English and more of them in a longer language. Every tab carries an icon
        — M3 forbids mixing icon+text tabs with text-only ones in the same set.
        `variant` and `active` are stamped onto the children by the strip, and
        `md-tabs` has no `density` prop, so none of the three appears below.
      */}
      <md-tabs
        ref={tabsRef}
        id="household-tabs"
        aria-label={t('wealth.nav.household')}
        active-tab-index={active}
        tab-width="auto"
      >
        {tabs.map((tab) => (
          <md-tab
            key={tab.labelKey}
            label={t(tab.labelKey)}
            icon={tab.icon}
            inline-icon
            badge={tab.badge}
          />
        ))}
      </md-tabs>

      <md-tab-panels for="household-tabs" sizing="active">
        <md-tab-panel>
          {opened.has(0) ? (
            <MembersPanel
              household={household}
              portfolio={portfolio}
              members={members}
              goals={goals}
              selected={selectedMembers}
              onSelect={setSelectedMembers}
              onNotify={onNotify}
            />
          ) : null}
        </md-tab-panel>

        <md-tab-panel>
          {opened.has(1) ? (
            <MandatePanel
              household={household}
              portfolio={portfolio}
              allocation={allocation}
              breachCount={breachCount}
              score={reviewScore}
              reviewed={reviewed}
              onScore={setReviewScore}
              onReviewed={() => {
                setReviewed(true);
                onNotify(t('wealth.activity.review-completed'));
              }}
            />
          ) : null}
        </md-tab-panel>

        <md-tab-panel>{opened.has(2) ? <DocumentsPanel proposals={proposals} /> : null}</md-tab-panel>

        <md-tab-panel>{opened.has(3) ? <ActivityPanel activity={activity} /> : null}</md-tab-panel>
      </md-tab-panels>
    </div>
  );
}

/* ----------------------------------------------------------------- members */

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
function MembersPanel({
  household,
  portfolio,
  members,
  goals,
  selected,
  onSelect,
  onNotify,
}: {
  household: Household;
  portfolio: Portfolio | undefined;
  members: Client[];
  goals: Goal[];
  selected: string[];
  onSelect(next: string[]): void;
  onNotify(message: string): void;
}) {
  const t = useT();
  const [focusId, setFocusId] = useState<string>(members[0]?.id ?? household.id);

  const nodes = useMemo<OrgNode[]>(() => {
    const objectivesFor = (clientId: string | null) =>
      goals
        .filter((goal) => goal.beneficiaryClientId === clientId)
        .map((goal) => ({
          id: goal.id,
          name: t(goal.typeKey),
          title: t.formatPercent(goal.fundedPct, { maximumFractionDigits: 0 }),
        }));

    const memberNodes: OrgNode[] = members.map((client) => {
      const children = objectivesFor(client.id);
      return {
        id: client.id,
        name: client.name,
        title: t(client.roleKey),
        avatarInitials: initialsOf(client.name),
        ...(children.length ? { children } : {}),
      };
    });

    const mandateNode: OrgNode[] = portfolio
      ? [{ id: portfolio.id, name: portfolio.reference, title: t(portfolio.strategyKey) }]
      : [];

    return [
      {
        id: household.id,
        name: household.name,
        title: t(household.segmentKey),
        children: [...mandateNode, ...memberNodes, ...objectivesFor(null)],
      },
    ];
  }, [household, portfolio, members, goals, t]);

  /*
   * `nodes` has no attribute form, so it is assigned as a JS property — and it
   * is assigned ALONE, keyed on its own content. Reassigning `nodes` rebuilds
   * the chart's collapsed set from the data, so folding it into the same effect
   * as `selectedIds` would re-fold every branch the reader had opened each time
   * they clicked a node.
   */
  const chartRef = useElementProps<HTMLElement>({ nodes }, [JSON.stringify(nodes)]);

  useEffect(() => {
    // `selectedIds` is property-only — it has no attribute form to render.
    const chart = chartRef.current as unknown as { selectedIds?: string[] } | null;
    if (chart) chart.selectedIds = focusId ? [focusId] : [];
  }, [chartRef, focusId]);

  useCustomEvent<CustomEvent<{ node: OrgNode; selectedIds: string[] }>>(
    chartRef,
    'mdSelectionChange',
    (event) => {
      // Single-select: clicking the selected node DESELECTS it and reports an
      // empty array. Falling back to the household keeps the detail panel from
      // emptying out under the reader.
      setFocusId(event.detail.selectedIds[0] ?? household.id);
    },
  );

  const listRef = useRef<HTMLElement | null>(null);

  useCustomEvent<CustomEvent<{ checked: boolean }>>(listRef, 'mdChange', (event) => {
    const id = (event.target as HTMLElement | null)?.dataset?.id;
    if (!id) return;
    onSelect(event.detail.checked ? [...selected, id] : selected.filter((one) => one !== id));
  });

  useCustomEvent<CustomEvent>(listRef, 'mdClick', (event) => {
    const id = (event.target as HTMLElement | null)?.dataset?.id;
    if (!id || !members.some((client) => client.id === id)) return;
    onNotify(t('wealth.activity.client-contacted'));
  });

  if (members.length === 0) {
    return <EmptyState message={t('wealth.empty.clients')} />;
  }

  return (
    <div className="stack">
      <div className="grid-wide">
        <md-organization-chart
          ref={chartRef}
          class="table-host"
          selection-mode="single"
          orientation="vertical"
          label={t('wealth.panel.members')}
          // The wealth dictionary has no expand/collapse verbs; these two are
          // in the shared `core` block, which every locale is required to
          // translate — so they are localised in ro and ar today, which the
          // component's English defaults would not be (§9.2).
          expand-label={t('action.expand')}
          collapse-label={t('action.collapse')}
        >
          <div slot="empty">{t('wealth.empty.clients')}</div>
        </md-organization-chart>

        <NodeDetail id={focusId} household={household} />
      </div>

      <md-divider />

      <div className="row row--between">
        <h3 className="panel__title">{t('wealth.panel.members')}</h3>
        {/*
          ALWAYS RENDERED, HIDDEN WHILE NOTHING IS SELECTED.

          It used to be mounted only once a row was ticked, so this header row
          was the height of its heading until then and the height of a 40px
          button after — and the whole member list below jumped down the moment
          you selected anything, which is the opposite of what selecting should
          feel like.

          `visibility: hidden` rather than a reserved `min-block-size` on the
          row: the space reserved is then exactly what the real cluster
          occupies, at any density and in any locale, with no number here that
          can drift from it. It also takes the button out of the tab order and
          out of the accessibility tree while it is inert, which `opacity: 0`
          would not.
        */}
        <span
          className="row"
          aria-hidden={selected.length > 0 ? undefined : true}
          style={selected.length > 0 ? undefined : { visibility: 'hidden' }}
        >
          <Count value={selected.length} />
          <ActionButton icon="mail" onActivate={() => onNotify(t('wealth.activity.client-contacted'))}>
            {t('wealth.action.contact')}
          </ActionButton>
        </span>
      </div>

      {/*
        `interaction-mode="multi-action"`: the row is a label and the trailing
        controls are the actions, each keeping its own tab stop. No
        `selection-mode` — the checkbox IS the selection here, and a listbox
        mode would put a second, competing selected state on the row itself.
      */}
      <md-list ref={listRef} label={t('wealth.panel.members')} interaction-mode="multi-action">
        {members.map((client) => (
          <md-list-item
            key={client.id}
            headline={client.name}
            overline={t(client.roleKey)}
            /*
             * THE KYC STATE IS IN THE SUPPORTING TEXT, not in a trailing chip,
             * and that is a layout decision made by looking at the rendered
             * row. `md-list-item` lays its trailing slot out as a column, so a
             * chip pair plus the two controls became three stacked lines and a
             * 140px row. The trailing edge is for CONTROLS (§7.2 pairs the row
             * with a checkbox, a switch or an icon button); the facts belong in
             * the row's own text, where they also stay readable at density -4.
             */
            supporting-text={`${t('wealth.table.age')} ${t.formatNumber(client.age)} · ${t(
              `wealth.country.${client.domicile}`,
            )} · ${t(client.kycStatusKey)}`}
            lines="3"
          >
            {/* The avatar + corner dot pattern from `md-status-dot`'s manual:
                the dot positions itself absolutely, so it needs a positioned
                ancestor, and `.badge-anchor` is the one this app already has.
                Both are decorative — the headline carries the name and the
                supporting text carries the KYC state in words, so the dot's
                colour repeats it rather than being its only carrier. */}
            <span slot="leading" className="badge-anchor">
              <md-avatar initials={initialsOf(client.name)} size="small" />
              <md-status-dot shape="circle" state={kycDot[client.kycStatus]} size="small" />
            </span>

            {/* ONE trailing element holding two controls, not two trailing
                elements: the slot lays its children out as a column, so two
                siblings stack and make the row twice as tall. Wrapped in a
                `.row` they sit side by side and each keeps its own tab stop,
                because both are still light-DOM elements. */}
            <span slot="trailing" className="row">
              <md-icon-button
                data-id={client.id}
                icon="mail"
                aria-label={`${t('wealth.action.contact')} — ${client.name}`}
              />
              {/* `md-checkbox` renders no slot at all, so a label cannot be
                  slotted into it — `aria-label` is the only accessible name a
                  checkbox inside a row can have. */}
              <md-checkbox
                data-id={client.id}
                checked={selected.includes(client.id)}
                aria-label={client.name}
              />
            </span>
          </md-list-item>
        ))}
      </md-list>
    </div>
  );
}

/**
 * The detail pane beside the org chart, on a surface of its own.
 *
 * The card is HERE rather than inside each branch below: all four of them —
 * client, objective, mandate, household — are the same pane showing whatever is
 * selected, so they share one surface, and wrapping once means a fifth branch
 * cannot forget it. `variant="outlined"` is the same
 * `--md-sys-color-surface-container-low` the charts sit on, which is what makes
 * this read as a panel beside the tree rather than as loose text under it.
 */
function NodeDetail({ id, household }: { id: string; household: Household }) {
  return (
    <md-card variant="outlined" full-width class="surface-card fact-card">
      <NodeDetailBody id={id} household={household} />
    </md-card>
  );
}

/**
 * Whatever the reader picked in the tree.
 *
 * The id comes from the chart, which got it from the fixture, so every branch
 * here is a selector lookup rather than a cache — and each one may return
 * `undefined`, which is what the household fallback at the end is for.
 */
function NodeDetailBody({ id, household }: { id: string; household: Household }) {
  const t = useT();
  const client = getClientById(id);
  const goal = client ? undefined : getGoalById(id);
  const portfolio = client || goal ? undefined : getPortfolioById(id);

  if (client) {
    return (
      <div className="stack">
        <div className="row">
          <ClientRoleChip role={client.role} />
          <KycChip status={client.kycStatus} />
          <RiskToleranceChip tolerance={client.riskTolerance} />
        </div>
        <dl className="dl">
          <Fact label={t('wealth.table.client')}>{client.name}</Fact>
          <Fact label={t('wealth.table.age')}>
            <Num value={client.age} />
          </Fact>
          <Fact label={t('wealth.table.domicile')}>{t(`wealth.country.${client.domicile}`)}</Fact>
          <Fact label={t('wealth.table.kycReview')}>
            <DateText value={client.kycReviewDate} />
          </Fact>
          <Fact label={t('wealth.table.contact')}>
            <span className="muted">{client.email}</span>
          </Fact>
          <Fact label={t('wealth.table.id')}>{client.id}</Fact>
        </dl>
      </div>
    );
  }

  if (goal) {
    return (
      <div className="stack">
        <div className="row">
          <PriorityChip priority={goal.priority} />
          <GoalStatusChip status={goal.status} />
        </div>
        <FundedMeter fraction={goal.fundedPct} status={goal.status} />
        <dl className="dl">
          <Fact label={t('wealth.table.goal')}>{t(goal.typeKey)}</Fact>
          <Fact label={t('wealth.table.targetAmount')}>
            <Money value={goal.targetAmount} compact />
          </Fact>
          <Fact label={t('wealth.table.targetDate')}>
            <DateText value={goal.targetDate} />
          </Fact>
          <Fact label={t('wealth.table.projected')}>
            <Money value={goal.projectedAmount} compact />
          </Fact>
        </dl>
      </div>
    );
  }

  if (portfolio) {
    return (
      <div className="stack">
        <div className="row">
          <StrategyChip strategy={portfolio.strategy} />
        </div>
        <dl className="dl">
          <Fact label={t('wealth.table.id')}>{portfolio.reference}</Fact>
          <Fact label={t('wealth.table.benchmark')}>{portfolio.benchmarkName}</Fact>
          <Fact label={t('wealth.table.marketValue')}>
            <Money value={portfolio.marketValue} compact />
          </Fact>
          <Fact label={t('wealth.kpi.cash')}>
            <Money value={portfolio.cashBalance} compact />
          </Fact>
          <Fact label={t('wealth.table.inception')}>
            <DateText value={portfolio.inceptionDate} />
          </Fact>
          <Fact label={t('wealth.table.fee')}>
            {t('wealth.unit.bps', { value: t.formatNumber(portfolio.feeBps) })}
          </Fact>
        </dl>
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="row">
        <SegmentChip segment={household.segment} />
        <MandateChip mandate={household.mandate} />
      </div>
      <dl className="dl">
        <Fact label={t('wealth.table.household')}>{household.name}</Fact>
        <Fact label={t('wealth.table.domicile')}>{t(`wealth.country.${household.domicile}`)}</Fact>
        <Fact label={t('wealth.table.members')}>
          <Num value={household.memberCount} />
        </Fact>
        <Fact label={t('wealth.table.onboarded')}>
          <DateText value={household.onboardedDate} />
        </Fact>
        <Fact label={t('wealth.table.advisor')}>{household.advisorName}</Fact>
        <Fact label={t('wealth.table.aum')}>
          <Money value={household.totalAum} compact />
        </Fact>
      </dl>
    </div>
  );
}

/* ----------------------------------------------------------------- mandate */

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
function MandatePanel({
  household,
  portfolio,
  allocation,
  breachCount,
  score,
  reviewed,
  onScore,
  onReviewed,
}: {
  household: Household;
  portfolio: Portfolio | undefined;
  allocation: AllocationRow[];
  breachCount: number;
  score: number;
  reviewed: boolean;
  onScore(next: number): void;
  onReviewed(): void;
}) {
  const t = useT();
  const ratingRef = useRef<HTMLElement | null>(null);

  // `md-rating`'s `mdChange` carries the value itself, not an object.
  useCustomEvent<CustomEvent<number>>(ratingRef, 'mdChange', (event) => onScore(event.detail));

  /*
   * `getLabel` is a FUNCTION prop and has no attribute form. It drives both the
   * visible value label and `aria-valuetext`, which makes it the one hook that
   * decides what a screen reader says at each step — so it resolves through the
   * dictionary rather than through a template literal.
   */
  const labelRef = useElementProps<HTMLElement>(
    {
      getLabel: (value: number) => t('wealth.common.of', { count: t.formatNumber(value), total: 5 }),
    },
    [t.locale],
  );

  if (!portfolio) {
    return <EmptyState message={t('wealth.common.na')} />;
  }

  return (
    <div className="stack">
      <dl className="dl">
        <Fact label={t('wealth.table.id')}>{portfolio.reference}</Fact>
        <Fact label={t('wealth.table.benchmark')}>{portfolio.benchmarkName}</Fact>
        <Fact label={t('wealth.table.inception')}>
          <DateText value={portfolio.inceptionDate} />
        </Fact>
        <Fact label={t('wealth.table.fee')}>
          {t('wealth.unit.bps', { value: t.formatNumber(portfolio.feeBps) })}
        </Fact>
        <Fact label={t('wealth.kpi.cash')}>
          <Money value={portfolio.cashBalance} compact />
        </Fact>
        <Fact label={reviewed ? t('wealth.table.lastReview') : t('wealth.table.nextReview')}>
          {/* Recording the review stamps the REPORTING DATE, never a clock:
              this console has no `Date.now()` anywhere, and the reporting date
              is the only "today" the fixture admits. */}
          <DateText value={reviewed ? REPORTING_DATE : portfolio.nextReviewDate} />
        </Fact>
      </dl>

      <md-accordion variant="outlined" heading-level="3" default-expanded="0">
        <md-accordion-item headline={t('wealth.table.strategy')} icon="pie_chart">
          <div className="stack">
            {/*
              THREE LABELLED FACTS, not a bare row of chips.

              `RiskProfile` and `Strategy` are DIFFERENT fields — the appetite
              the household agreed, and the strategy its mandate runs off it —
              and they genuinely differ for half the book (`defensive` runs
              `conservative`, `dynamic` runs `aggressive`), so both belong here.
              But they share the words "balanced" and "growth", and
              `riskProfileColor` maps position-for-position onto
              `strategyColor`: on the four households where the words collide
              the two chips came out BYTE-IDENTICAL side by side — same label,
              same role, same width, nothing to say which was which. Colour can
              never separate them; only the `dt` can, for a reader and for a
              screen reader alike.

              A chip inside a `<Fact>` is the shape the proposal wizard already
              uses for this same pair — see `ProposalBuilder`'s strategy step.
            */}
            <dl className="dl">
              <Fact label={t('wealth.table.strategy')}>
                <StrategyChip strategy={portfolio.strategy} />
              </Fact>
              <Fact label={t('wealth.table.riskProfile')}>
                <RiskProfileChip profile={household.riskProfile} />
              </Fact>
              <Fact label={t('wealth.table.mandate')}>
                <MandateChip mandate={household.mandate} />
              </Fact>
            </dl>
            <dl className="dl">
              {allocation.map((row) => (
                <Fact key={row.assetClass} label={t(row.assetClassKey)}>
                  <Percent value={row.targetWeight} digits={0} />
                </Fact>
              ))}
            </dl>
          </div>
        </md-accordion-item>

        <md-accordion-item headline={t('wealth.table.fee')} icon="receipt_long">
          <dl className="dl">
            <Fact label={t('wealth.table.fee')}>
              {t('wealth.unit.bps', { value: t.formatNumber(portfolio.feeBps) })}
            </Fact>
            <Fact label={t('wealth.table.costBasis')}>
              <Money value={portfolio.costBasis} compact />
            </Fact>
            <Fact label={t('wealth.table.marketValue')}>
              <Money value={portfolio.marketValue} compact />
            </Fact>
            <Fact label={t('wealth.table.unrealisedPl')}>
              <Signed value={portfolio.unrealisedPl} compact />
            </Fact>
            <Fact label={t('wealth.table.plPct')}>
              <Signed value={portfolio.unrealisedPlPct} kind="percent" />
            </Fact>
          </dl>
        </md-accordion-item>

        <md-accordion-item headline={t('wealth.panel.rebalance')} icon="balance">
          <dl className="dl">
            <Fact label={t('wealth.table.lastRebalance')}>
              <DateText value={portfolio.lastRebalanceDate} />
            </Fact>
            <Fact label={t('wealth.table.nextReview')}>
              <DateText value={portfolio.nextReviewDate} />
            </Fact>
            <Fact label={t('wealth.table.lastContact')}>
              <DateText value={household.lastContactDate} />
            </Fact>
            <Fact label={t('wealth.kpi.driftBreaches')}>
              <Num value={breachCount} />
            </Fact>
          </dl>
        </md-accordion-item>

        <md-accordion-item headline={t('wealth.table.riskProfile')} icon="shield">
          <div className="stack">
            <dl className="dl">
              <Fact label={t('wealth.kpi.maxDrawdown')}>
                <Signed value={portfolio.maxDrawdown} kind="percent" />
              </Fact>
              <Fact label={t('wealth.kpi.twoYearReturn')}>
                <Percent value={portfolio.twoYearReturn} />
              </Fact>
              <Fact label={t('wealth.kpi.benchmark')}>
                <Percent value={portfolio.benchmarkTwoYearReturn} />
              </Fact>
            </dl>

            <div className="row">
              <span className="muted">{t('wealth.table.riskTolerance')}</span>
              {/* Two hooks on one element: the event listener and the function
                  prop. Both refs are assigned from one callback ref rather than
                  duplicating the element. */}
              <md-rating
                ref={(node: HTMLElement | null) => {
                  ratingRef.current = node;
                  labelRef.current = node;
                }}
                value={score}
                max="5"
                precision="1"
                size="sm"
                show-value-label
                rating-label={t('wealth.table.riskTolerance')}
              />
            </div>

            <div className="row">
              {/* The tooltip exists only while the gate does: once a score is
                  recorded the button is live, and an explanation of why it is
                  off would be a lie. A tooltip is a DESCRIPTION and never a
                  name — the button's own label is its name. */}
              <md-tooltip text={t('wealth.table.riskTolerance')} disabled={score > 0 || undefined}>
                <ActionButton
                  icon="task_alt"
                  variant="tonal"
                  softDisabled={score === 0 || reviewed}
                  onActivate={onReviewed}
                >
                  {t('wealth.action.review')}
                </ActionButton>
              </md-tooltip>
              {reviewed ? <span className="muted">{t('wealth.activity.review-completed')}</span> : null}
            </div>
          </div>
        </md-accordion-item>
      </md-accordion>
    </div>
  );
}

/* --------------------------------------------------------------- documents */

/**
 * The household's advice documents.
 *
 * A proposal IS the document in this domain — a draft advice paper moving
 * through five review steps — so this list is `getProposalsFor()` and not a
 * second, invented entity. `md-list` rather than a table (§5.5: a short
 * vertical set of records), rows are `type="text"`, and the drill is the
 * trailing `md-icon-button`: routing from the icon button's own `mdClick`
 * keeps the navigation in the SPA, where a row-level `href` would hand it to
 * `window.location` and reload the whole application.
 */
function DocumentsPanel({ proposals }: { proposals: Proposal[] }) {
  const t = useT();
  const router = useRouter();
  const listRef = useRef<HTMLElement | null>(null);

  useCustomEvent<CustomEvent>(listRef, 'mdClick', (event) => {
    const id = (event.target as HTMLElement | null)?.dataset?.id;
    if (!id) return;
    router.push(route.proposals());
  });

  if (proposals.length === 0) {
    return <EmptyState message={t('wealth.empty.proposals')} />;
  }

  return (
    <md-list
      ref={listRef}
      label={t('wealth.kpi.proposals')}
      interaction-mode="multi-action"
      list-style="segmented"
    >
      {proposals.map((proposal) => (
        <md-list-item
          key={proposal.id}
          headline={t(proposal.typeKey)}
          overline={proposal.id}
          supporting-text={`${t('wealth.common.of', {
            count: proposal.completedStepCount,
            total: proposal.stepCount,
          })} · ${t('wealth.unit.days', { value: t.formatNumber(proposal.daysOpen) })}`}
          leading-icon="description"
          lines="3"
        >
          {/* One trailing element, for the same reason as the members list:
              the slot stacks its children, so the chips and the drill would
              sit on two lines and double the row height. */}
          <span slot="trailing" className="row">
            <ProposalTypeChip type={proposal.type} />
            <ProposalStatusChip status={proposal.status} />
            <md-icon-button
              data-id={proposal.id}
              icon="open_in_new"
              aria-label={`${t('wealth.action.review')} — ${proposal.id}`}
            />
          </span>
        </md-list-item>
      ))}
    </md-list>
  );
}

/* ---------------------------------------------------------------- activity */

/** The household's audit trail, newest first — as the kit already returns it. */
function ActivityPanel({ activity }: { activity: Activity[] }) {
  const t = useT();

  if (activity.length === 0) {
    return <EmptyState message={t('wealth.empty.activity')} />;
  }

  return (
    <md-list label={t('wealth.panel.activity')}>
      {activity.map((entry) => (
        <md-list-item
          key={entry.id}
          headline={t(entry.actionKey)}
          overline={`${t(entry.targetTypeKey)} · ${entry.targetLabel}`}
          supporting-text={entry.actorName}
          leading-icon="history"
          lines="3"
        >
          <span slot="trailing" className="row">
            <ActivityCategoryChip category={entry.category} />
          </span>
          <span slot="trailing-supporting-text">
            <DateText value={entry.date} style="short" />
          </span>
        </md-list-item>
      ))}
    </md-list>
  );
}
