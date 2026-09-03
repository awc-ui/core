/**
 * The statement's four filters, its period, its count and its phone placement.
 *
 * WHAT THIS FILE IS ALLOWED TO DO, AND WHAT IT IS NOT.
 *
 * md-chip selects nothing and md-search narrows nothing — each is display state
 * plus a REQUEST, and the host answers it. The React screen answers by calling
 * getTransactions() with the five chosen values and re-rendering; this build
 * answers by calling THE SAME getTransactions() and MOVING the rows the build
 * already wrote. The kit decides what matches; this file decides where a node
 * goes.
 *
 * WHY THE KIT AND NOT A data-* MATCH. Everywhere else in this build a filter is
 * an attribute comparison, because everywhere else a filtered-out row leaves
 * nothing behind. A statement is the exception: every day heading states that
 * day's net, so hiding two of a day's five rows would leave the heading
 * asserting a total that is no longer the sum of what is under it. Re-deriving
 * the day groups is the only way that number stays true, and the kit's
 * statementDays() is where that arithmetic already lives.
 *
 * DETACHED, NEVER HIDDEN — the house rule. Nodes are moved, never destroyed and
 * never re-created, so every row keeps the markup and the localised text the
 * build gave it, and the live census matches what React renders.
 *
 * NO ENGLISH. The only text this file writes is a formatted number and a count
 * sentence whose template was translated at build time and shipped on the
 * element that shows it.
 */

import {
  REPORTING_MONTH,
  flowColor,
  getTransactions,
  statementDays,
} from '@awc-ui/showcase-kit/banking';
import { createTranslator } from '@awc-ui/showcase-kit/i18n';
import { fillCount } from './rows.mjs';

const ALL_MONTHS = 'all';
/** Same breakpoint as the React build's PHONE. */
const PHONE = '(max-width: 719px)';

/**
 * A day's net, formatted exactly as `flow()` formats it at build time.
 *
 * The `+` is composed by hand there because the kit's currency options carry no
 * signDisplay, and the same hand-composed sign has to appear here or a day
 * would gain and lose its plus as it was filtered. The bdi wrapper and the
 * class are already on the element; only the text and the direction change.
 */
function writeNet(el, t, value) {
  const text = `${value > 0 ? '+' : ''}${t.formatCurrency(value, {
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
  el.textContent = text;
  el.className = flowColor(value) === 'success' ? 'num pl-up' : 'num';
}

export function enhanceTransactions(root = document) {
  const statement = root.querySelector('[data-statement]');
  if (!statement || statement.hasAttribute('data-bound')) return;
  statement.setAttribute('data-bound', '');

  const lang = document.documentElement.lang;
  const locale = ['en', 'ro', 'ar'].includes(lang) ? lang : 'en';
  const tr = createTranslator(locale);
  const t = {
    formatCurrency: tr.formatCurrency.bind(tr),
    formatNumber: tr.formatNumber.bind(tr),
  };

  const host = statement.querySelector('[data-groups]');
  const emptyTemplate = root.querySelector('template[data-empty]');
  const asideCount = root.querySelector('[data-result-count]');

  /* ------------------------------------------------------------- the pools */

  /**
   * Every month's day-groups, indexed by month, each group indexed by date.
   *
   * The reporting month's groups are live in the document; the rest are inside
   * a template each. Both are read into the same structure and then detached,
   * so from here on there is exactly one code path and the reporting month is
   * not a special case.
   */
  const pools = new Map();

  const readGroups = (container) => {
    const groups = [];
    for (const el of container.querySelectorAll('[data-day]')) {
      const list = el.querySelector('md-list');
      groups.push({
        date: el.dataset.day,
        el,
        list,
        rows: Array.from(list?.children ?? []),
        net: el.querySelector('[data-day-net]'),
      });
    }
    return groups;
  };

  if (host) pools.set(REPORTING_MONTH, readGroups(host));
  for (const template of statement.querySelectorAll('template[data-month-groups]')) {
    pools.set(template.dataset.monthGroups, readGroups(template.content));
  }

  /* ------------------------------------------------------------- the state */

  const state = {
    month: REPORTING_MONTH,
    accountId: null,
    category: null,
    status: null,
    search: '',
  };

  const total = getTransactions().length;

  /**
   * Both filter placements, kept in step.
   *
   * The desktop panel is the one in the document and the phone accordion is the
   * one this file moves it into, so at any moment there is exactly ONE body —
   * but which element holds it changes with the viewport, and every query below
   * is written against the body rather than against either host.
   */
  const bodies = () => Array.from(root.querySelectorAll('[data-filter-body]'));

  const apply = () => {
    const rows = getTransactions({
      month: state.month === ALL_MONTHS ? undefined : state.month,
      accountId: state.accountId ?? undefined,
      category: state.category ?? undefined,
      status: state.status ?? undefined,
      search: state.search,
    });
    const ids = new Set(rows.map((row) => row.id));
    const days = statementDays(rows);

    const pool = pools.get(state.month) ?? [];
    const byDate = new Map(pool.map((group) => [group.date, group]));

    const wanted = [];
    for (const day of days) {
      const group = byDate.get(day.date);
      /* A month whose pool has no such day cannot happen — the pool was written
         from the same fixture — but a missing group would throw here and take
         the whole enhancement down, so it is skipped rather than assumed. */
      if (!group) continue;
      if (group.net) writeNet(group.net, t, day.netEur);
      group.list?.replaceChildren(...group.rows.filter((row) => ids.has(row.dataset.id)));
      wanted.push(group.el);
    }

    if (host) host.replaceChildren(...wanted);

    /* React renders the empty state INSTEAD of the statement panel, so this
       swaps the two rather than leaving an empty card behind. */
    const emptyShown = root.querySelector('[data-empty-shown]');
    if (days.length === 0 && !emptyShown && emptyTemplate) {
      const node = emptyTemplate.content.firstElementChild?.cloneNode(true);
      if (node) {
        node.setAttribute('data-empty-shown', '');
        statement.replaceWith(node);
      }
    } else if (days.length > 0 && emptyShown) {
      emptyShown.replaceWith(statement);
    }

    /* The heading's chip and the panel's sentence, both from templates the
       build translated. */
    if (asideCount) {
      asideCount.setAttribute('label', t.formatNumber(rows.length, { maximumFractionDigits: 0 }));
    }
    for (const body of bodies()) {
      fillCount(
        body.querySelector('[data-count]'),
        'data-count-template',
        'textContent',
        rows.length,
        total,
      );

      const dirty =
        state.month !== REPORTING_MONTH ||
        state.accountId !== null ||
        state.category !== null ||
        state.status !== null ||
        state.search !== '';

      /* The reset is INSERTED and REMOVED, never hidden — the house rule, and
         the reason it ships in a template: React renders no button at all
         while there is nothing to reset. */
      const foot = body.querySelector('.facet-foot');
      const template = body.querySelector('template[data-clear]');
      const clear = foot?.querySelector('md-button');
      if (dirty && !clear && template) {
        foot.appendChild(template.content.firstElementChild.cloneNode(true));
      } else if (!dirty && clear) {
        clear.remove();
      }

      /* The collapsed header says the list is filtered without being opened. */
      const item = body.closest('md-accordion-item');
      if (item) {
        const text = body.querySelector('[data-count]')?.textContent ?? '';
        if (dirty) item.setAttribute('supporting-text', text);
        else item.removeAttribute('supporting-text');
      }
    }

    /* Every placement's chips follow the state, not the press: the phone body
       and the desktop body are the same element, but a chip that was pressed
       and a chip that has to turn OFF because a sibling turned on are the same
       update. */
    for (const chip of root.querySelectorAll('[data-facet] md-chip')) {
      const { month, account, category, status } = chip.dataset;
      const on =
        (month !== undefined && month === state.month) ||
        (account !== undefined && account === state.accountId) ||
        (category !== undefined && category === state.category) ||
        (status !== undefined && status === state.status);
      chip.selected = on;
    }
  };

  /* ------------------------------------------------------------ the events */

  /*
   * ONE LISTENER ON THE PANEL, not one per chip. The chips are the same
   * elements before and after a placement swap, but binding each of them would
   * mean rebinding whatever the swap re-parents; a delegated listener on the
   * screen survives it.
   */
  root.addEventListener('mdSelect', (event) => {
    const chip = event.target?.closest?.('md-chip');
    const row = chip?.closest?.('[data-facet]');
    if (!chip || !row) return;
    const on = event.detail?.selected;

    switch (row.dataset.facet) {
      case 'month':
        // No deselect branch: a statement is always OF something, so pressing
        // the month that is already chosen leaves it chosen.
        if (chip.dataset.month) state.month = chip.dataset.month;
        break;
      case 'account':
        state.accountId = on ? chip.dataset.account : null;
        break;
      case 'category':
        state.category = on ? chip.dataset.category : null;
        break;
      case 'status':
        state.status = on ? chip.dataset.status : null;
        break;
      default:
        return;
    }
    apply();
  });

  /* `mdSearch`, not `mdInput`: it is debounced and distinct-until-changed,
     which is what a filter over 652 rows wants, and clearing the field flushes
     it immediately so the list comes straight back. The detail is `{ value }` —
     md-text-field's `mdInput` detail IS the bare string, and the two are
     different components. */
  root.addEventListener('mdSearch', (event) => {
    if (!event.target?.hasAttribute?.('data-search')) return;
    state.search = event.detail?.value ?? '';
    apply();
  });

  root.addEventListener('mdClick', (event) => {
    if (!event.target?.closest?.('.facet-foot md-button')) return;
    state.month = REPORTING_MONTH;
    state.accountId = null;
    state.category = null;
    state.status = null;
    state.search = '';
    for (const search of root.querySelectorAll('[data-search]')) search.value = '';
    apply();
  });

  /* ------------------------------------------------------- the two placements */

  /**
   * Below 720px the filter body moves out of its panel and into a disclosure.
   *
   * MOVED, NOT COPIED. The chips, the search and the count are the same
   * elements in both placements, so nothing can drift and no state has to be
   * mirrored — which is the whole reason this is a move and not a second render
   * of the same markup.
   */
  const panel = root.querySelector('[data-filter-panel]');
  const sheetTemplate = root.querySelector('template[data-filter-sheet]');
  if (panel && sheetTemplate) {
    const body = panel.querySelector('[data-filter-body]');
    const sheet = sheetTemplate.content.firstElementChild?.cloneNode(true);
    const item = sheet?.querySelector('md-accordion-item');
    const phone = window.matchMedia(PHONE);

    const place = () => {
      if (!body || !sheet || !item) return;
      if (phone.matches) {
        if (sheet.isConnected) return;
        item.appendChild(body);
        panel.replaceWith(sheet);
      } else {
        if (panel.isConnected) return;
        panel.querySelector('.panel__inner')?.appendChild(body);
        sheet.replaceWith(panel);
      }
      apply();
    };

    place();
    phone.addEventListener('change', place);
  }

  apply();
}
