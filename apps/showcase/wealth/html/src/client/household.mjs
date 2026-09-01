/**
 * Everything the household screen does after load.
 *
 * `screens/household.mjs` writes the DEFAULT of every piece of view state the
 * React build holds — every settings switch on, no facet, the default sort, the
 * first member selected, nothing ticked, review pending — and the alternate
 * states ride along in `<template>` elements. This is the half that moves
 * between them. With JavaScript off the page stays the complete default view,
 * which is exactly what React's first paint is.
 *
 * NINE BEHAVIOURS, ONE PER `bind*` BELOW, and each returns quietly when its own
 * marker is absent, so this module is safe to call on all thirteen pages:
 *
 *   the snackbar and the three things that raise it, the settings sheet and the
 *   four switches it holds, the org chart's selection and its detail pane, the
 *   member checkboxes and their action cluster, the holdings tab's facet and
 *   sort, the documents drill-down, and the mandate review gate.
 *
 * WHAT IS DELIBERATELY NOT HERE. React's `active` tab and its `opened` set are
 * a lazy-mount concern: it builds panel 0 with the screen and warms the other
 * three in idle time, because mounting ~120 elements in the frame a panel
 * becomes visible is a measurable flicker. This build has no such frame — all
 * four panels are in the file the server sent, already parsed — so `md-tabs`
 * switching between them is the component's own behaviour and needs nothing.
 *
 * DETACH, NEVER HIDE. Where React renders a node conditionally, this removes it
 * from the document and keeps the reference, rather than setting `hidden` on
 * it. `verify-showcase-parity.mjs` counts the live `md-*` census, and a hidden
 * element is still in it; more to the point, `visibility`/`display` leave a
 * control in the accessibility tree that React never rendered at all.
 */

import { fillCount, sorted } from './rows.mjs';

/** Every switch on, which is what the document is written in. */
const DEFAULT_VIEW = { benchmark: true, trend: true, cash: true, inBand: true };

/* ------------------------------------------------------------------ snackbar */

/**
 * One snackbar, one message — the component has no queue by design.
 *
 * Returns the `notify` every other binding here calls. `mdClose` covers all
 * three ways it can go away (auto-hide, the dismiss button, `hide()`); clearing
 * the message there is what keeps a second notification able to reopen it.
 */
function bindSnackbar(root) {
  const bar = root.querySelector('md-snackbar[data-snackbar]');
  if (!bar) return () => {};

  bar.addEventListener('mdClose', () => {
    bar.message = '';
  });

  return (message) => {
    if (!message) return;
    bar.message = message;
    bar.open = true;
  };
}

/**
 * Every control whose whole job is to raise a message: the toolbar's contact
 * button and the members cluster's. The message is baked into `data-notify` by
 * the build, in the page's own language — this never assembles a sentence.
 *
 * One delegated listener rather than one per button: `mdClick` bubbles and is
 * composed, and the cluster's button is cloned in and out of the document as
 * the selection changes, so a listener bound to the element itself would have
 * to be rebound each time.
 */
function bindNotifyButtons(root, notify) {
  root.addEventListener('mdClick', (event) => {
    const button = event.target?.closest?.('[data-notify]');
    if (button) notify(button.dataset.notify);
  });
}

/* ------------------------------------------------------------ settings sheet */

/**
 * The side sheet, its four switches, and everything they change.
 *
 * The switches take effect the moment they are flipped — there is no Apply,
 * which is why the only other control is a reset. Each one is read from
 * `data-key` on the switch that moved rather than from four separate listeners,
 * and the whole view is re-applied from one function, so the sheet cannot get
 * into a state the reset cannot get it out of.
 */
function bindSettings(root) {
  const sheet = root.querySelector('md-side-sheet[data-settings]');
  const list = root.querySelector('md-list[data-settings-list]');
  if (!sheet || !list) return;

  const view = { ...DEFAULT_VIEW };
  const applyTrend = bindTrend(root);
  const applyBenchmark = bindBenchmarkSeries(root);
  const applyAllocation = bindAllocation(root);

  const apply = () => {
    applyTrend(view);
    applyBenchmark(view);
    applyAllocation(view);
  };

  root.querySelector('[data-sheet-open]')?.addEventListener('mdClick', () => {
    sheet.open = true;
  });

  // `md-switch` emits `mdChange` AFTER it has flipped itself, so the element's
  // own state is already right and only the screen has to follow.
  list.addEventListener('mdChange', (event) => {
    const key = event.target?.dataset?.key;
    if (!key || !(key in view)) return;
    view[key] = event.detail.selected;
    apply();
  });

  root.querySelector('[data-settings-reset]')?.addEventListener('mdClick', () => {
    Object.assign(view, DEFAULT_VIEW);
    // Push the defaults back onto the switches: they own their own selected
    // state, and nothing else would move them.
    for (const control of list.querySelectorAll('md-switch[data-key]')) {
      control.selected = DEFAULT_VIEW[control.dataset.key] ?? true;
    }
    apply();
  });
}

/**
 * The `trend` switch: the KPI tiles' sparklines.
 *
 * React passes `trend={undefined}` and the whole `.kpi__spark` block is not
 * rendered. Each one is detached from its own parent and put back at the same
 * place — the anchor is captured once here rather than looked up on each flip,
 * because by the time the block is out of the document there is nothing left to
 * ask where it belonged.
 */
function bindTrend(root) {
  const sparks = [...root.querySelectorAll('.kpi__spark')].map((node) => ({
    node,
    parent: node.parentElement,
    next: node.nextSibling,
  }));

  return ({ trend }) => {
    for (const spark of sparks) {
      if (trend) spark.parent?.insertBefore(spark.node, spark.next);
      else spark.node.remove();
    }
  };
}

/**
 * The `benchmark` switch: the second line on the growth chart.
 *
 * The series is DROPPED FROM THE DATA rather than hidden through the chart's
 * own legend — the chart remembers legend toggles across a data re-feed, so the
 * two would fight over which of them owns "is the benchmark showing".
 *
 * The full set is read from the element once, after upgrade, because that is
 * where the deserialized `serialized:` attribute lands; there is no second copy
 * of it to drift from.
 */
function bindBenchmarkSeries(root) {
  const chart = root.querySelector('[data-series-toggle]');
  if (!chart) return () => {};

  const dropped = chart.dataset.seriesToggle;
  let all = null;

  return ({ benchmark }) => {
    all ??= Array.isArray(chart.series) ? chart.series : null;
    if (!all) return;
    chart.series = benchmark ? all : all.filter((series) => series.id !== dropped);
  };
}

/**
 * The `cash` and `inBand` switches: the allocation panel's chart and cards.
 *
 * Both test a field the KIT classified — the asset class and the in-band /
 * drifted / breach status — so this hides rows without deciding anything about
 * them, and it matches on `data-asset-class` / `data-status`, never on the
 * localised label in the card.
 *
 * The chart and the cards are filtered from DIFFERENT source lists, which is
 * the React build's shape too: the chart plots `getAllocationFor()` (one entry
 * per class) and the cards are `rebalanceSheet()` (the trades that would close
 * the drift). The same predicate over two lists, not one list drawn twice.
 */
function bindAllocation(root) {
  const stack = root.querySelector('[data-alloc-stack]');
  const chart = root.querySelector('[data-alloc]');
  const cardHost = root.querySelector('[data-alloc-cards]');
  const emptyTemplate = root.querySelector('template[data-alloc-empty]');
  if (!stack) return () => {};

  const stackParent = stack.parentElement;
  const stackNext = stack.nextSibling;

  let rows = [];
  try {
    rows = JSON.parse(chart?.dataset.alloc || '{}').rows ?? [];
  } catch {
    // A malformed payload is a build-time mistake. Leaving the panel on its
    // full set is a better failure than throwing and taking the rest of the
    // screen's bindings down with it.
    console.error('[wealth] unreadable data-alloc');
  }

  /*
   * The cards in the order the build wrote them, kept as a list rather than as
   * per-node anchors. A `nextSibling` captured up front is useless the moment
   * the neighbour it points at is itself detached — restoring two adjacent
   * cards would insert against a node no longer in the document — so the whole
   * row is rewritten from this list on every flip instead.
   */
  const cards = [...(cardHost?.children ?? [])].map((node) => ({
    node,
    assetClass: node.dataset.assetClass,
    status: node.dataset.status,
  }));

  const axis = (() => {
    try {
      return JSON.parse(chart?.dataset.chart || '{}').xAxis ?? {};
    } catch {
      return {};
    }
  })();

  let empty = null;

  const keeps = (row, view) =>
    (view.cash || row.assetClass !== 'cash') && (view.inBand || row.status !== 'in-band');

  return (view) => {
    const visible = rows.filter((row) => keeps(row, view));

    // Re-feed the chart from the build's own copy of what it plots, so the bars
    // and the axis cannot come out of step with each other.
    if (chart && Array.isArray(chart.series)) {
      const [target, actual] = chart.series;
      chart.series = [
        { ...target, data: visible.map((row) => row.target) },
        { ...actual, data: visible.map((row) => row.actual) },
      ];
      chart.xAxis = { ...axis, data: visible.map((row) => row.label) };
    }

    // replaceChildren detaches whatever fell out and restores the build's own
    // order for whatever came back, in one pass.
    cardHost?.replaceChildren(...cards.filter((card) => keeps(card, view)).map((card) => card.node));

    /*
     * React renders the panel's stack OR its empty state, never both. The empty
     * state is keyed on the CHART's rows, matching React, which tests
     * `allocationRows.length === 0` — a class can be in one list and not the
     * other, and this is the one the reader is looking at.
     */
    const isEmpty = visible.length === 0;
    if (isEmpty && !empty && emptyTemplate) {
      empty = [...emptyTemplate.content.cloneNode(true).children];
      for (const node of empty) stackParent?.insertBefore(node, stackNext);
      stack.remove();
    } else if (!isEmpty && empty) {
      for (const node of empty) node.remove();
      empty = null;
      stackParent?.insertBefore(stack, stackNext);
    }
  };
}

/* ----------------------------------------------------------------- org chart */

/**
 * The household tree and the detail pane beside it.
 *
 * `selectedIds` is property-only — it has no attribute form to render — so the
 * build stamped the initial id on `data-selected-id` and it is assigned here.
 * Stencil's lazy proxy keeps own properties set before an element upgrades, so
 * this is not a race.
 *
 * Single-select means clicking the selected node DESELECTS it and reports an
 * empty array; falling back to the household keeps the detail pane from
 * emptying out under the reader, and writing the fallback back onto the chart
 * keeps the tree's own highlight on the node the pane is describing.
 */
function bindOrgChart(root) {
  const chart = root.querySelector('md-organization-chart[data-selected-id]');
  const detail = root.querySelector('[data-node-detail]');
  if (!chart) return;

  const bodies = new Map(
    [...root.querySelectorAll('template[data-node]')].map((node) => [node.dataset.node, node]),
  );

  chart.selectedIds = chart.dataset.selectedId ? [chart.dataset.selectedId] : [];

  chart.addEventListener('mdSelectionChange', (event) => {
    const id = event.detail.selectedIds[0] ?? chart.dataset.fallbackId;
    chart.selectedIds = id ? [id] : [];

    // Cloned, not moved: the template has to survive being selected twice.
    const body = bodies.get(id);
    if (body && detail) detail.replaceChildren(body.content.cloneNode(true));
  });
}

/* ------------------------------------------------------------------- members */

/**
 * The member checkboxes and the action cluster above them.
 *
 * The cluster is always in the document and hidden while nothing is ticked, so
 * the list below does not jump down the moment a row is selected. `aria-hidden`
 * is what drives that — `app.css` hides the cluster while it is set, so one
 * attribute keeps the visibility and the accessibility tree in step and there
 * is no inline style for a strict `style-src` to refuse.
 */
function bindMembers(root, notify) {
  const list = root.querySelector('md-list[data-members]');
  if (!list) return;

  const cluster = root.querySelector('[data-cluster]');
  const counter = cluster?.querySelector('md-chip');
  const selected = new Set();

  list.addEventListener('mdChange', (event) => {
    const id = event.target?.dataset?.id;
    if (!id) return;
    if (event.detail.checked) selected.add(id);
    else selected.delete(id);

    counter?.setAttribute('label', String(selected.size));
    if (selected.size > 0) cluster?.removeAttribute('aria-hidden');
    else cluster?.setAttribute('aria-hidden', 'true');
  });

  // The row's own trailing contact button. Scoped to `md-icon-button` so the
  // checkbox beside it — which carries the same `data-id` — cannot raise a
  // message by being ticked.
  list.addEventListener('mdClick', (event) => {
    if (!event.target?.closest?.('md-icon-button[data-id]')) return;
    notify(list.dataset.notifyMessage);
  });
}

/* ----------------------------------------------------------------- documents */

/**
 * The advice documents list. The drill is the trailing `md-icon-button` rather
 * than a row-level `href`, matching React — and the destination is the one the
 * build resolved for this page's locale, because routing here is a page load.
 */
function bindDocuments(root) {
  const list = root.querySelector('md-list[data-documents]');
  const href = list?.dataset.href;
  if (!list || !href) return;

  list.addEventListener('mdClick', (event) => {
    if (!event.target?.closest?.('[data-id]')) return;
    window.location.assign(href);
  });
}

/* ------------------------------------------------------------ holdings tab */

/**
 * The mandate's positions: one asset-class facet and the column sort.
 *
 * Nothing here pages — the mandate holds tens of positions, not hundreds — so
 * unlike the holdings screen every row is live in the body from the start and
 * the only thing that moves them is the sort.
 *
 * The foot swaps with the facet, from the kit's own per-class roll-up: filtered
 * it is the chosen class's total, unfiltered it is the mandate's securities
 * value and unrealised P/L, which the generator asserts are exactly the sum of
 * the positions. Adding the rendered rows up here would be the same number
 * computed a second way, and the second way is the one that drifts.
 */
function bindHoldingsTab(root) {
  const table = root.querySelector('md-table[data-sortable]');
  const body = table?.querySelector('md-table-body');
  if (!table || !body) return;

  const facetRow = root.querySelector('[data-facets]');
  const counter = facetRow?.querySelector('[data-count]');
  const foot = table.querySelector('md-table-foot');
  const feet = new Map(
    [...root.querySelectorAll('template[data-foot]')].map((node) => [node.dataset.class, node]),
  );

  const all = [...body.children];
  const defaultSort = {
    column: table.getAttribute('sort-by') ?? '',
    order: table.getAttribute('sort-order') ?? 'desc',
  };
  const defaultFoot = foot ? [...foot.children] : [];

  const state = { assetClass: null, sort: { ...defaultSort } };

  function render() {
    const matching = state.assetClass
      ? all.filter((row) => row.dataset.class === state.assetClass)
      : all;
    const visible = state.sort.column ? sorted(matching, state.sort) : matching;

    // One fragment, one reflow; replaceChildren detaches whatever fell out.
    const fragment = document.createDocumentFragment();
    for (const row of visible) fragment.append(row);
    body.replaceChildren(fragment);

    table.setAttribute('sort-by', state.sort.column);
    table.setAttribute('sort-order', state.sort.order);

    fillCount(counter, 'data-count-template', 'textContent', visible.length, all.length);

    if (foot) {
      const swap = state.assetClass ? feet.get(state.assetClass) : null;
      if (swap) foot.replaceChildren(swap.content.cloneNode(true));
      else foot.replaceChildren(...defaultFoot);
    }
  }

  facetRow?.addEventListener('mdSelect', (event) => {
    const chip = event.target?.closest?.('md-chip[data-class]');
    if (!chip) return;
    state.assetClass = event.detail.selected ? chip.dataset.class : null;
    // Single-select: the component flips the chip that was clicked, and the
    // others have to be told.
    for (const other of facetRow.querySelectorAll('md-chip[data-class]')) {
      if (other !== chip) other.selected = false;
    }
    render();
  });

  table.addEventListener('mdSortChange', (event) => {
    const { column, order } = event.detail || {};
    const cleared = !column || order === 'none';
    state.sort = cleared ? { ...defaultSort } : { column, order };
    if (cleared) void table.setSort?.(defaultSort.column, defaultSort.order);
    render();
  });
}

/* -------------------------------------------------------------- review gate */

/**
 * The mandate review: a score, then the action it unlocks.
 *
 * The rating is a CONTROL and not a readout — the score an advisor records at a
 * review is a judgement made here rather than a fact about the book, which is
 * why it is not in the fixture and why the document ships it at zero with the
 * action gated.
 *
 * `soft-disabled` and not `disabled`: §9.2 keeps a contextually-unavailable
 * control focusable and says what is missing, rather than dropping it out of
 * the tab order in silence. The tooltip is the saying-so, and it is turned OFF
 * the moment a score exists — once the button is live, an explanation of why it
 * is off would be a lie.
 *
 * Recording the review stamps the REPORTING DATE, never a clock: the swapped-in
 * fact was rendered by the build from `REPORTING_DATE`, so this console still
 * has no `Date.now()` anywhere in it.
 */
function bindReview(root, notify) {
  const rating = root.querySelector('md-rating[data-rating]');
  const button = root.querySelector('md-button[data-review]');
  if (!rating || !button) return;

  const tooltip = root.querySelector('md-tooltip[data-review-tooltip]');
  const noteTemplate = root.querySelector('template[data-review-note]');
  const factTemplate = root.querySelector('template[data-review-fact-done]');

  let reviewed = false;

  // `md-rating`'s `mdChange` carries the value itself, not an object.
  rating.addEventListener('mdChange', (event) => {
    const score = event.detail;
    if (reviewed) return;
    if (score > 0) button.removeAttribute('soft-disabled');
    else button.setAttribute('soft-disabled', '');
    if (tooltip) tooltip.disabled = score > 0;
  });

  // §9.1: the component's own `mdClick`, never the native `click` — the native
  // one fires even when `soft-disabled` has already suppressed the action.
  button.addEventListener('mdClick', () => {
    if (reviewed) return;
    reviewed = true;
    button.setAttribute('soft-disabled', '');

    const fact = root.querySelector('[data-review-fact]');
    if (fact && factTemplate) fact.replaceWith(factTemplate.content.cloneNode(true));

    if (noteTemplate) {
      const anchor = tooltip ?? button;
      anchor.parentElement?.insertBefore(noteTemplate.content.cloneNode(true), anchor.nextSibling);
    }

    notify(button.dataset.message);
  });
}

/* --------------------------------------------------------------------------- */

export function enhanceHousehold(root = document) {
  const screen = root.querySelector('md-snackbar[data-snackbar]');
  if (!screen || screen.hasAttribute('data-bound')) return;
  screen.setAttribute('data-bound', '');

  const notify = bindSnackbar(root);

  bindNotifyButtons(root, notify);
  bindSettings(root);
  bindOrgChart(root);
  bindMembers(root, notify);
  bindDocuments(root);
  bindHoldingsTab(root);
  bindReview(root, notify);
}
