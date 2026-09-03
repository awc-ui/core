/**
 * The cards screen — the only screen in this app that changes anything.
 *
 * WHAT THE DOCUMENT ALREADY HOLDS. The first card's four blocks are live and
 * every other card's ride in a template each, written at build time from the
 * fixture. Selecting a card SWAPS the blocks; it does not render them. So the
 * markup, the icons and the localised text of a card's detail are the build's
 * work in every case, and this file's job is which nodes are in the document
 * and what has changed about them since.
 *
 * THE OVERRIDES ARE THE ONLY STATE. `states` and `controls` hold what the
 * reader has changed, keyed by card, exactly as the React screen holds them —
 * absent means "as the fixture shipped it", which is what makes a reload a
 * reset without a second copy of the data. They matter here in a way they do
 * not in React: a swapped-in template is the FIXTURE state, so every override
 * for that card has to be re-applied over it.
 *
 * FREEZE IS A SWITCH, BLOCK IS NOT. A blocked card is terminal: its controls
 * ship disabled and it offers no thaw. md-switch flips ITSELF before it emits
 * `mdChange`, so the element's own state is already right and only this has to
 * follow.
 */

import {
  cardStateColor,
  getAccountById,
  getCards,
} from '@awc-ui/showcase-kit/banking';
import { createTranslator } from '@awc-ui/showcase-kit/i18n';

/** The three per-card switches, in the order the screen renders them. */
const CONTROLS = ['contactless', 'onlinePayments', 'atmWithdrawals'];

export function enhanceCards(root = document) {
  const list = root.querySelector('[data-card-list]');
  if (!list || list.hasAttribute('data-bound')) return;
  list.setAttribute('data-bound', '');

  const lang = document.documentElement.lang;
  const locale = ['en', 'ro', 'ar'].includes(lang) ? lang : 'en';
  const tr = createTranslator(locale);

  const cards = getCards();
  const byId = new Map(cards.map((card) => [card.id, card]));

  const detailPanel = root.querySelector('[data-detail-panel]');
  const detailHost = root.querySelector('[data-detail]');
  const controlsHost = root.querySelector('[data-controls-host]');
  const limitHost = root.querySelector('[data-limit]');
  const recentPanel = root.querySelector('[data-recent-panel]');
  const recentHost = root.querySelector('[data-recent]');
  const snackbar = root.querySelector('[data-snackbar]');
  const frozenHint = root.querySelector('template[data-frozen-hint]');

  const state = {
    selectedId: cards[0]?.id ?? '',
    /** Card id -> CardState, over the fixture's own. */
    states: new Map(),
    /** Card id -> Map(control key -> boolean), over the fixture's own. */
    controls: new Map(),
  };

  const stateOf = (card) => state.states.get(card.id) ?? card.state;
  const controlOf = (card, key) => state.controls.get(card.id)?.get(key) ?? card[key];

  /**
   * The blocks for one card, taken from the templates.
   *
   * The first card's are already in the document, so its templates do not
   * exist; `null` means "what is there is already right".
   */
  const blockFor = (kind, id) =>
    root.querySelector(`template[data-card-${kind}="${id}"]`)?.content.firstElementChild;

  const swapIn = (host, kind, id) => {
    const block = blockFor(kind, id);
    if (!host || !block) return;
    host.replaceChildren(block.cloneNode(true));
  };

  /* ------------------------------------------------------------- the paint */

  /** Repaint everything that depends on which card is selected and its state. */
  const apply = ({ swap = false } = {}) => {
    const card = byId.get(state.selectedId) ?? cards[0];
    if (!card) return;
    const current = stateOf(card);
    const terminal = current === 'blocked';

    if (swap) {
      swapIn(detailHost, 'detail', card.id);
      swapIn(controlsHost, 'controls', card.id);
      swapIn(limitHost, 'limit', card.id);
      swapIn(recentHost, 'recent', card.id);
      if (detailPanel) {
        const title = detailPanel.querySelector('.panel__title');
        const sub = detailPanel.querySelector('.panel__sub');
        if (title) title.textContent = card.label;
        if (sub) sub.textContent = getAccountById(card.accountId)?.nickname ?? '';
      }
      const recentSub = recentPanel?.querySelector('.panel__sub');
      if (recentSub) recentSub.textContent = card.label;
    }

    /* The list: exactly one row is selected, and every row's chip and
       supporting text follow that card's own current state. */
    for (const row of list.querySelectorAll('md-list-item[data-card]')) {
      const rowCard = byId.get(row.dataset.card);
      if (!rowCard) continue;
      const rowState = stateOf(rowCard);
      row.selected = rowCard.id === card.id;
      row.setAttribute(
        'supporting-text',
        `${tr.t(rowCard.kindKey)} · ${tr.t(`banking.cardState.${rowState}`)}`,
      );
      const chip = row.querySelector('md-chip');
      if (chip) {
        chip.setAttribute('label', tr.t(`banking.cardState.${rowState}`));
        chip.setAttribute('color', cardStateColor[rowState]);
      }
    }

    /* The tile and the status chip beside it. */
    const tile = detailHost?.querySelector('.card-tile');
    if (tile) tile.setAttribute('data-state', current);
    const statusChip = detailHost?.querySelector('[data-card-status] md-chip');
    if (statusChip) {
      statusChip.setAttribute('label', tr.t(`banking.cardState.${current}`));
      statusChip.setAttribute('color', cardStateColor[current]);
    }

    /* The frozen hint comes and goes; the blocked one never does. */
    const stack = detailHost?.firstElementChild;
    const hint = stack?.querySelector('[data-state-hint="frozen"]');
    if (current === 'frozen' && !hint && frozenHint) {
      stack?.appendChild(frozenHint.content.firstElementChild.cloneNode(true));
    } else if (current !== 'frozen' && hint) {
      hint.remove();
    }

    /* The switches. A frozen card spends nothing, so its per-transaction
       controls are moot — disabling them says that, where leaving them live
       would imply they still did something. */
    const freeze = controlsHost?.querySelector('md-switch[data-control="freeze"]');
    if (freeze) {
      freeze.selected = current === 'frozen';
      freeze.disabled = terminal;
    }
    for (const key of CONTROLS) {
      const el = controlsHost?.querySelector(`md-switch[data-control="${key}"]`);
      if (!el) continue;
      el.selected = Boolean(controlOf(card, key));
      el.disabled = terminal || current === 'frozen';
    }
  };

  const say = (key) => {
    if (!snackbar) return;
    snackbar.message = tr.t(key);
    snackbar.open = true;
  };

  /* ------------------------------------------------------------ the events */

  list.addEventListener('mdClick', (event) => {
    const row = event.target?.closest?.('md-list-item');
    const id = row?.dataset?.card;
    if (!id || id === state.selectedId) return;
    state.selectedId = id;
    apply({ swap: true });
  });

  /* One delegated listener on the screen rather than one per switch: the
     switches are replaced wholesale every time a card is swapped in, and a
     listener bound to an element that has since been thrown away is the
     quietest kind of dead code. */
  root.addEventListener('mdChange', (event) => {
    const key = event.target?.dataset?.control;
    if (!key) return;
    const card = byId.get(state.selectedId) ?? cards[0];
    if (!card) return;
    const on = Boolean(event.detail?.selected);

    if (key === 'freeze') {
      const next = on ? 'frozen' : 'active';
      state.states.set(card.id, next);
      apply();
      say(next === 'frozen' ? 'banking.msg.cardFrozen' : 'banking.msg.cardUnfrozen');
      return;
    }

    const overrides = state.controls.get(card.id) ?? new Map();
    overrides.set(key, on);
    state.controls.set(card.id, overrides);
    apply();
    say('banking.msg.controlSaved');
  });

  snackbar?.addEventListener('mdClose', () => {
    snackbar.open = false;
  });

  apply();
}
