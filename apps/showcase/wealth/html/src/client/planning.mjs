/**
 * The planning screen's behaviour: the four filters, the objective picker, the
 * what-if sliders, the category colour, and the compact bottom sheet.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * THE ONE THING WORTH READING FIRST
 *
 * This module imports `goalProjection` and `goalSummary` from the kit and CALLS
 * them. It does not re-implement, approximate or unpack them, and it does not
 * read a precomputed answer out of the page.
 *
 * That is affordable because both functions take their data as an ARGUMENT —
 * neither reaches for the fixture — so the bundler drops the 200 kB of
 * generated records and keeps ~11 kB of formulas. The records themselves ride
 * in `data-plan` on the objectives panel, as the fixture wrote them, together
 * with the four sort orders exactly as `getGoals({ sortBy })` returned them.
 * Everything in this file is therefore either a kit call over kit data, a
 * formatter from the kit's translator, or DOM.
 *
 * The alternative — baking every (contribution × horizon) pair at build time —
 * was ~200 kB of JSON per page and, worse, a second place where the answer is
 * defined. `goalProjection` is one place.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * WHAT THE FILTERS DO, AND WHAT THEY DO NOT
 *
 * `getGoals` needs the fixture, so it is NOT imported. Instead the page ships
 * the four sort orders the selector produced, and a filter is a SUBSET of one
 * of those orders — the kit's sort is total (it breaks ties on the id), so a
 * subset of the sorted book is exactly the sort of the subset. No comparator is
 * written here, which is the same discipline `client/book-table.mjs` states.
 *
 * Non-matching cards are DETACHED, never hidden: a hidden card is still a card
 * in `querySelectorAll`, in the accessibility tree and in the census the parity
 * check takes, and React renders a shorter array rather than a longer one with
 * holes.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * WHAT IS DELIBERATELY MISSING: THE LOADING INDICATOR
 *
 * React wires `md-loading-indicator` to `useDeferredValue` — it is on exactly
 * while the deferred projection has not landed, and on a fast machine it is
 * rarely seen. There is no deferred render here: a slider move calls
 * `goalProjection` and assigns the result synchronously, so there is no window
 * during which the figures and the plot disagree with the thumb. Mounting a
 * spinner for a frame anyway would be a delay pretending to be work, which is
 * the one thing the React screen says not to do. The `.plan-busy` box is still
 * in the markup, holding its 24px and `aria-hidden`, so the controls beside it
 * sit where they do in every other build.
 */

import { goalProjection, goalSummary } from '@awc-ui/showcase-kit/wealth';
import { createTranslator } from '@awc-ui/showcase-kit/i18n';
import { subscribeShowcaseState } from '@awc-ui/showcase-kit/dock';

const COMPACT_QUERY = '(max-width: 899px)';

/** Anything that is not a plain hex is dropped rather than handed to the picker,
 *  which would flag its hex field invalid and keep its old colour. */
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

export function enhancePlanning(root = document) {
  const board = root.querySelector('md-card[data-plan-objectives]');
  if (!board || board.hasAttribute('data-bound')) return;

  let payload;
  try {
    payload = JSON.parse(board.dataset.plan || '');
  } catch {
    // A malformed payload is a build-time mistake, not a runtime condition. The
    // page is the complete unfiltered view either way, so it stays readable.
    console.error('[wealth] unreadable data-plan on the objectives panel');
    return;
  }
  board.setAttribute('data-bound', '');

  /* --------------------------------------------------------- the page's language */

  const lang = document.documentElement.lang;
  const locale = ['en', 'ro', 'ar'].includes(lang) ? lang : 'en';
  const tr = createTranslator(locale);

  // The same shapes `lib/bits.mjs` renders, so a value the client writes and a
  // value the build wrote are the same string.
  const moneyText = (value, { compact = false, digits } = {}) =>
    tr.formatCurrency(value, {
      currency: 'EUR',
      notation: compact ? 'compact' : 'standard',
      maximumFractionDigits: digits,
      minimumFractionDigits: digits,
    });
  const percentText = (value, { digits = 2 } = {}) =>
    tr.formatPercent(value, {
      maximumFractionDigits: digits,
      minimumFractionDigits: Math.min(digits, 1),
    });
  const countText = (value) => tr.formatNumber(value, { maximumFractionDigits: 0 });

  /* ------------------------------------------------------------------ the page */

  const ALL = payload.all;
  const goals = payload.goals;
  const byId = new Map(goals.map((goal) => [goal.id, goal]));

  const grid = root.querySelector('[data-plan-goals]');
  const emptyTemplate = root.querySelector('template[data-plan-goals-empty]');
  const kpis = root.querySelector('[data-plan-kpis]');
  const clearButton = root.querySelector('[data-plan-clear]');
  const subtitleEl = root.querySelector('.screen-head__text p');
  const countEl = board.querySelector('.panel__sub');
  const countTemplate = board.getAttribute('data-count-template') || '';

  const filterEls = {
    householdId: root.querySelector('[data-filter-household]'),
    type: root.querySelector('[data-filter-type]'),
    status: root.querySelector('[data-filter-status]'),
    sortBy: root.querySelector('[data-filter-sort]'),
  };

  if (!grid) return;

  /** The twelve cards, captured in the order the build rendered them. */
  const cards = new Map([...grid.children].map((card) => [card.dataset.goal, card]));

  /* The projection block and the bottom sheet only exist while an objective is
     chosen, exactly as React mounts them — so both need an anchor to come back
     to when a filter empties the board and is then widened again. */
  const projection = root.querySelector('[data-plan-projection]');
  const projectionAnchor = projection?.nextSibling ?? null;
  const projectionHome = projection?.parentElement ?? null;

  const chart = projection?.querySelector('[data-plan-chart]');
  const factsEl = projection?.querySelector('[data-plan-facts]');
  const meter = projection?.querySelector('[data-plan-meter]');
  const sideEl = projection?.querySelector('[data-plan-side]');
  const goalSelect = projection?.querySelector('[data-plan-goal-select]');
  const actionsRow = goalSelect?.parentElement ?? null;

  /** Every option the picker can offer, captured before any filter narrows it. */
  const options = new Map(
    [...(goalSelect?.children ?? [])].map((option) => [option.getAttribute('value'), option]),
  );

  /* -------------------------------------------------------------- the state */

  const filters = { householdId: ALL, type: ALL, status: ALL };
  let sortBy = payload.orders.targetDate ? 'targetDate' : Object.keys(payload.orders)[0];
  let chosenId = '';
  /** Kept KEYED to the objective it belongs to rather than cleared on switch:
   *  picking another objective must show that objective's own plan. */
  let draft = null;
  const categoryColors = new Map();
  let preview = null;

  let visible = [];
  let selected = null;
  /** The empty state, once there is one. React renders it or the grid, never both. */
  let emptyEl = null;

  /* ------------------------------------------------------ the objective list */

  function currentList() {
    const order = payload.orders[sortBy] ?? [];
    return order
      .map((id) => byId.get(id))
      .filter(
        (goal) =>
          goal &&
          (filters.householdId === ALL || goal.householdId === filters.householdId) &&
          (filters.type === ALL || goal.type === filters.type) &&
          (filters.status === ALL || goal.status === filters.status),
      );
  }

  /* -------------------------------------------------------------- the KPIs */

  function renderKpis(summary) {
    if (!kpis) return;
    const tiles = [...kpis.children];
    const value = (index) => tiles[index]?.querySelector('.kpi__value');
    const valueNum = (index) => tiles[index]?.querySelector('.kpi__value .num');
    const footNum = (index) => tiles[index]?.querySelector('.kpi__foot .num');
    const footChip = (index) => tiles[index]?.querySelector('.kpi__foot md-chip');

    const targetTotal = valueNum(0);
    if (targetTotal) targetTotal.textContent = moneyText(summary.targetTotal, { compact: true });
    footChip(0)?.setAttribute('label', countText(summary.count));

    const funded = valueNum(1);
    if (funded) funded.textContent = percentText(summary.fundedPct, { digits: 0 });
    const fundedTotal = footNum(1);
    if (fundedTotal) fundedTotal.textContent = moneyText(summary.fundedTotal, { compact: true });

    const onTrack = value(2);
    if (onTrack) onTrack.textContent = countText(summary.onTrack + summary.funded);
    const atRisk = summary.atRisk + summary.behind;
    const atRiskChip = footChip(2);
    if (atRiskChip) {
      atRiskChip.setAttribute('label', countText(atRisk));
      // A count of nothing is not a warning. A test for zero, not a status map.
      atRiskChip.setAttribute('color', atRisk > 0 ? 'warning' : 'primary');
    }

    const shortfall = valueNum(3);
    if (shortfall) shortfall.textContent = moneyText(summary.shortfallTotal, { compact: true });
    const contributions = footNum(3);
    if (contributions) {
      contributions.textContent = moneyText(summary.monthlyContributionTotal, { compact: true });
    }

    if (subtitleEl) {
      subtitleEl.textContent = tr.t('wealth.screen.planning.subtitle', {
        onTrack: summary.onTrack + summary.funded,
        total: summary.count,
      });
    }
    if (countEl && countTemplate) {
      countEl.textContent = countTemplate.replace('%shown%', String(summary.count));
    }
  }

  /* ------------------------------------------------------------- the swatch */

  /** The category's colour beside the objective's name, once one is assigned. */
  function renderSwatches() {
    for (const [id, card] of cards) {
      const goal = byId.get(id);
      const colour = goal && categoryColors.get(goal.type);
      const host = card.querySelector('.with-dot');
      if (!host) continue;
      let swatch = host.querySelector('.plan-swatch');
      if (!colour) {
        swatch?.remove();
        continue;
      }
      if (!swatch) {
        swatch = document.createElement('span');
        swatch.className = 'plan-swatch';
        // After the status dot, before the name — the order the React card
        // renders them in.
        host.insertBefore(swatch, host.querySelector('.strong'));
      }
      swatch.style.background = colour;
    }
  }

  /* ------------------------------------------------------------ the scenario */

  /** The colour the band takes: the preview while a pointer is down, then the
   *  committed choice, then the `primary` ROLE the chart re-themes on its own. */
  function bandColor() {
    return preview ?? (selected ? categoryColors.get(selected.type) : undefined) ?? 'primary';
  }

  function renderScenario() {
    if (!selected) return;

    const base = goalProjection(selected);
    const lastIndex = Math.max(1, base.length - 1);
    const active = draft && draft.goalId === selected.id ? draft : null;
    const contribution = active ? active.contribution : selected.monthlyContribution;
    const horizonIndex = active ? Math.min(active.horizonIndex, lastIndex) : lastIndex;
    const horizonPoint = base[horizonIndex] ?? base[base.length - 1];
    const adjusted =
      Boolean(active) &&
      (contribution !== selected.monthlyContribution || horizonIndex !== lastIndex);

    /*
     * The scenario, as an INPUT to the kit: two fields replaced and a cache key
     * that names both of them, because `goalProjection` memoises on `goal.id`
     * and a modified goal reusing its own id would be served the unmodified
     * projection out of the cache.
     */
    const scenarioPoints = horizonPoint
      ? goalProjection(
          {
            ...selected,
            id: `${selected.id}~c${contribution}~m${horizonPoint.month}`,
            monthlyContribution: contribution,
            monthsRemaining: horizonPoint.month,
          },
          horizonIndex + 1,
        )
      : [];
    const scenarioProjected = scenarioPoints.length
      ? scenarioPoints[scenarioPoints.length - 1].projected
      : 0;

    /* ---------------------------------------------------------- the chart */

    // Joined on `month`, not on position: the two series are sampled at the
    // same marks by construction, and a lookup degrades to a gap if the kit's
    // sampling ever changes, where an index would quietly misalign them.
    const projectedByMonth = new Map(scenarioPoints.map((point) => [point.month, point.projected]));

    if (chart) {
      chart.series = [
        {
          label: tr.t('wealth.table.projected'),
          // The cone: the envelope between the current plan and the adjusted
          // one. Beyond the adjusted horizon there is no scenario, so the band
          // gaps out — which is the point of bringing the target date forward.
          range: base.map((point) => {
            const scenario = projectedByMonth.get(point.month);
            if (scenario === undefined) return null;
            return [Math.min(point.projected, scenario), Math.max(point.projected, scenario)];
          }),
          color: bandColor(),
        },
        {
          label: tr.t('wealth.table.current'),
          data: base.map((point) => point.projected),
          fill: false,
          color: 'tertiary',
        },
        {
          label: tr.t('wealth.table.target'),
          data: base.map((point) => point.target),
          fill: false,
          dash: 'dotted',
          color: 'secondary',
        },
      ];

      chart.xAxis = {
        data: base.map((point) => tr.formatDate(point.date, 'monthYear')),
        scale: 'category',
        // Everything past the adjusted horizon is outside the plan the sliders
        // describe, so it is shaded and named rather than left to be inferred
        // from where the band stops.
        bands:
          horizonPoint && horizonIndex < base.length - 1
            ? [
                {
                  from: horizonIndex,
                  to: base.length - 1,
                  label: tr.formatDate(horizonPoint.date, 'monthYear'),
                  labelAlign: 'start',
                },
              ]
            : undefined,
      };
      chart.setAttribute('label', `${tr.t(selected.typeKey)} · ${selected.householdName}`);
    }

    /* --------------------------------------------------------- the figures */

    if (factsEl) {
      const values = factsEl.querySelectorAll('dd');
      const contributionCell = values[0]?.querySelector('.num');
      if (contributionCell) contributionCell.textContent = moneyText(contribution);
      const dateCell = values[1]?.querySelector('time');
      if (dateCell && horizonPoint) {
        dateCell.setAttribute('datetime', horizonPoint.date);
        dateCell.textContent = tr.formatDate(horizonPoint.date, 'medium');
      }
      const projectedCell = values[2]?.querySelector('.num');
      if (projectedCell) {
        projectedCell.textContent = moneyText(scenarioProjected, { compact: true });
      }
      const targetCell = values[3]?.querySelector('.num');
      if (targetCell) targetCell.textContent = moneyText(selected.targetAmount, { compact: true });
    }

    if (meter) {
      // `value` and `max`, never a percentage: the component works the ratio
      // out itself. The bar clamps at the target; the text does not.
      meter.setAttribute('value', String(scenarioProjected));
      meter.setAttribute('max', String(selected.targetAmount));
      meter.setAttribute(
        'value-text',
        moneyText(scenarioProjected, { compact: true, digits: undefined }),
      );
    }

    /* -------------------------------------------------------- the controls */

    const months = tr.t('wealth.goal.monthsRemaining', {
      count: countText(horizonPoint?.month ?? 0),
    });

    setControl('[data-plan-contribution]', {
      value: contribution,
      max: payload.contributionMax[selected.id],
      display: moneyText(contribution),
      valueText: tr.formatCurrency(contribution, { maximumFractionDigits: 0 }),
    });
    setControl('[data-plan-horizon]', {
      value: horizonIndex,
      max: lastIndex,
      display: horizonPoint ? tr.formatDate(horizonPoint.date, 'medium') : '',
      displayDate: horizonPoint?.date,
      valueText: months,
    });

    const monthsEl = controlsHost()?.querySelector('[data-plan-months]');
    if (monthsEl) monthsEl.textContent = months;

    const reset = controlsHost()?.querySelector('[data-plan-reset]');
    reset?.toggleAttribute('disabled', !adjusted);
  }

  /** The one control stack, wherever it currently lives (panel or sheet). */
  const controlsHost = () => root.querySelector('[data-plan-controls]');

  function setControl(selector, { value, max, display, displayDate, valueText }) {
    const control = controlsHost()?.querySelector(selector);
    if (!control) return;
    control.setAttribute('value', String(value));
    if (max !== undefined) control.setAttribute('max', String(max));
    control.setAttribute('value-text', valueText);

    const head = control.closest('.plan-control')?.querySelector('.plan-control__value');
    if (!head) return;
    if (displayDate) {
      // The date keeps its machine-readable twin, exactly as `dateText()` writes it.
      const time = head.querySelector('time');
      if (time) {
        time.setAttribute('datetime', displayDate);
        time.textContent = display;
        return;
      }
    }
    const num = head.querySelector('.num');
    if (num) num.textContent = display;
    else head.textContent = display;
  }

  /* ------------------------------------------------------ the chosen objective */

  function renderSelection() {
    for (const [id, card] of cards) {
      const on = selected?.id === id;
      // `data-selected`, NEVER a toggled `class`: the class list on an `md-*`
      // element carries Stencil's own host classes AND the runtime's `hydrated`
      // flag, and rewriting it paints the card `visibility: hidden` for good.
      card.toggleAttribute('data-selected', on);
      card.setAttribute('variant', on ? 'filled' : 'outlined');
    }

    if (goalSelect && selected) goalSelect.setAttribute('value', selected.id);

    // The assumptions column is the objective's own — swapped in from its
    // template, which is the same clone-and-replace the household screen uses
    // for its org-chart detail bodies.
    if (sideEl && selected) {
      const template = root.querySelector(`template[data-goal-side="${CSS.escape(selected.id)}"]`);
      if (template) {
        sideEl.replaceChildren(template.content.cloneNode(true));
        bindPicker();
      }
    }
  }

  /* -------------------------------------------------------- the colour picker */

  function roleColors() {
    const styles = window.getComputedStyle(document.documentElement);
    return (payload.presetRoles ?? [])
      .map((role) => styles.getPropertyValue(`--md-sys-color-${role}`).trim())
      .filter((value) => HEX.test(value));
  }

  function bindPicker() {
    const picker = sideEl?.querySelector('[data-plan-picker]');
    if (!picker || picker.hasAttribute('data-bound')) return;
    picker.setAttribute('data-bound', '');
    applyPresets();

    // `mdInput` previews, `mdChange` commits — the picker's manual is explicit
    // that the first fires per pointer move and only the second is a decision.
    picker.addEventListener('mdInput', (event) => {
      preview = event.detail?.value ?? null;
      renderScenario();
    });
    picker.addEventListener('mdChange', (event) => {
      const value = event.detail?.value;
      if (!value || !selected) return;
      categoryColors.set(selected.type, value);
      preview = null;
      renderSwatches();
      renderScenario();
    });
  }

  /**
   * `presets` and `value` are MD3 role colours read off the LIVE token sheet —
   * the one place they are defined — so they cannot be written at build time
   * and are re-read whenever the dock rewrites the theme or the accent preset.
   */
  function applyPresets() {
    const picker = sideEl?.querySelector('[data-plan-picker]');
    if (!picker) return;
    const presets = roleColors();
    if (presets.length) picker.setAttribute('presets', presets.join(','));
    const committed = selected ? categoryColors.get(selected.type) : undefined;
    const value = committed ?? presets[0];
    if (value) picker.setAttribute('value', value);
  }

  /* ------------------------------------------------------------- the render */

  function render({ list = true } = {}) {
    if (list) {
      visible = currentList();

      const next = visible.find((goal) => goal.id === chosenId) ?? visible[0] ?? null;
      const changed = next?.id !== selected?.id;
      selected = next;

      // One fragment, one reflow; replaceChildren detaches whatever fell out.
      const fragment = document.createDocumentFragment();
      for (const goal of visible) {
        const card = cards.get(goal.id);
        if (card) fragment.append(card);
      }
      grid.replaceChildren(fragment);

      // React renders the empty state OR the grid, never both.
      if (visible.length === 0 && !emptyEl && emptyTemplate) {
        emptyEl = emptyTemplate.content.firstElementChild?.cloneNode(true) ?? null;
        if (emptyEl) grid.replaceWith(emptyEl);
      } else if (visible.length > 0 && emptyEl) {
        emptyEl.replaceWith(grid);
        emptyEl = null;
      }

      // The picker offers exactly the objectives the board is showing.
      if (goalSelect) {
        const optionFragment = document.createDocumentFragment();
        for (const goal of visible) {
          const option = options.get(goal.id);
          if (option) optionFragment.append(option);
        }
        goalSelect.replaceChildren(optionFragment);
      }

      // With nothing selected there is no projection to draw, so the whole
      // block leaves the document — which is what React mounts, and does not.
      if (projection && projectionHome) {
        if (!selected && projection.isConnected) {
          unmountSheet();
          projection.remove();
        } else if (selected && !projection.isConnected) {
          projectionHome.insertBefore(projection, projectionAnchor);
          syncCompact();
        }
      }

      renderKpis(goalSummary(visible));

      const filtering =
        filters.householdId !== ALL || filters.type !== ALL || filters.status !== ALL;
      clearButton?.toggleAttribute('disabled', !filtering);

      if (changed) {
        renderSelection();
        renderSwatches();
      }
    }

    renderScenario();
  }

  /* ------------------------------------------------------------- the sheet */

  /*
   * The controls live in exactly ONE place: inline in the projection panel above
   * 900px, inside an `md-bottom-sheet` below it. The node is MOVED between the
   * two — never cloned — because two identically-labelled sliders in one
   * document is what the React build refuses to render, and `md-bottom-sheet`
   * never unmounts its content, so a copy parked in there would be permanent.
   */
  const sheetTemplate = root.querySelector('template[data-plan-sheet]');
  const tuneTemplate = root.querySelector('template[data-plan-tune]');
  const controlsHome = controlsHost()?.parentElement ?? null;
  const controlsAnchor = controlsHost()?.nextSibling ?? null;
  let sheet = null;
  let tune = null;

  function mountSheet() {
    if (sheet || !sheetTemplate || !projection?.isConnected) return;
    sheet = sheetTemplate.content.firstElementChild?.cloneNode(true) ?? null;
    if (!sheet) return;
    projectionHome?.append(sheet);

    const body = sheet.querySelector('.plan-sheet-body');
    const stack = controlsHost();
    if (body && stack) body.append(stack);

    // Four ways out — the ✕, the drag handle, the scrim and Escape — and all
    // four emit `mdClose`. Nothing is committed here: the sliders apply live.
    sheet.addEventListener('mdClose', () => {
      sheet.open = false;
    });

    if (tuneTemplate && actionsRow) {
      tune = tuneTemplate.content.firstElementChild?.cloneNode(true) ?? null;
      if (tune) {
        actionsRow.append(tune);
        tune.addEventListener('mdClick', () => {
          if (sheet) sheet.open = true;
        });
      }
    }
  }

  function unmountSheet() {
    if (!sheet) return;
    const stack = controlsHost();
    if (stack && controlsHome) controlsHome.insertBefore(stack, controlsAnchor);
    sheet.remove();
    sheet = null;
    tune?.remove();
    tune = null;
  }

  const compact = window.matchMedia(COMPACT_QUERY);
  function syncCompact() {
    if (compact.matches) mountSheet();
    else unmountSheet();
  }

  /* ---------------------------------------------------------- the listeners */

  for (const [key, element] of Object.entries(filterEls)) {
    element?.addEventListener('mdChange', (event) => {
      const value = event.detail ?? '';
      if (key === 'sortBy') sortBy = value || 'targetDate';
      else filters[key] = value || ALL;
      render();
    });
  }

  goalSelect?.addEventListener('mdChange', (event) => {
    chosenId = event.detail ?? '';
    const next = visible.find((goal) => goal.id === chosenId) ?? visible[0] ?? null;
    if (next?.id === selected?.id) return;
    selected = next;
    renderSelection();
    renderSwatches();
    renderScenario();
  });

  clearButton?.addEventListener('mdClick', () => {
    filters.householdId = ALL;
    filters.type = ALL;
    filters.status = ALL;
    for (const key of ['householdId', 'type', 'status']) {
      // The selects own their displayed value, so the reset has to be written
      // back into them — nothing else re-renders them.
      filterEls[key]?.setAttribute('value', ALL);
    }
    render();
  });

  /*
   * `mdInput` (every move) AND `mdChange` (release), because the sliders are
   * `controlled`: the manual is blunt about the consequence of listening to
   * only one — the thumb follows the pointer and then springs back on commit.
   * Delegated from the panel so the handlers survive the control stack moving
   * into and out of the bottom sheet.
   */
  const onSlide = (event) => {
    const slider = event.target;
    const value = event.detail?.value;
    if (typeof value !== 'number' || !selected) return;

    const base = goalProjection(selected);
    const lastIndex = Math.max(1, base.length - 1);
    const active = draft && draft.goalId === selected.id ? draft : null;
    const contribution = active ? active.contribution : selected.monthlyContribution;
    const horizonIndex = active ? Math.min(active.horizonIndex, lastIndex) : lastIndex;

    if (slider.matches?.('[data-plan-contribution]')) {
      draft = { goalId: selected.id, contribution: value, horizonIndex };
    } else if (slider.matches?.('[data-plan-horizon]')) {
      draft = { goalId: selected.id, contribution, horizonIndex: Math.round(value) };
    } else {
      return;
    }
    renderScenario();
  };

  for (const type of ['mdInput', 'mdChange']) {
    document.addEventListener(type, (event) => {
      if (event.target instanceof Element && event.target.matches('md-slider')) onSlide(event);
    });
  }

  document.addEventListener('mdClick', (event) => {
    if (event.target instanceof Element && event.target.matches('[data-plan-reset]')) {
      draft = null;
      renderScenario();
    }
  });

  compact.addEventListener('change', syncCompact);

  // Theme and accent both rewrite the `--md-sys-color-*` custom properties the
  // picker's swatches are read from, so they are re-read whenever the dock
  // changes state — one frame later, once the new tokens are on the document.
  subscribeShowcaseState(() => {
    requestAnimationFrame(applyPresets);
  });

  /* ------------------------------------------------------------- first run */

  // The document already IS the default view, so nothing is re-rendered here
  // that the build did not write; this binds the picker, resolves the presets
  // and mounts the sheet if the viewport is already compact.
  visible = currentList();
  selected = visible[0] ?? null;
  bindPicker();
  syncCompact();
}
