/**
 * Explore's filter: the topic chips, the search field, the count and the reset.
 *
 * IT HIDES TILES; IT NEVER BUILDS THEM (with two exceptions, both clones of a
 * template the build wrote: the reset button and the empty state, neither of
 * which the four SPA builds render until there is something to reset or nothing
 * to show — so neither may sit hidden in the document, where the parity census
 * would count it). Every tile is in the document with its
 * topics, its author's name and their handle stamped on it, so filtering is a
 * pass over forty elements setting `hidden`. Rebuilding the grid would mean
 * this module knowing each picture's translated alt text and each post's
 * locale-prefixed href — two things the page already knows and it does not.
 *
 * THE SEARCH MATCHES PEOPLE, NOT CAPTIONS, which is the same rule the kit's
 * selector follows and for the same reason: a caption lives in the dictionary,
 * so matching one would work in English and silently return nothing in Arabic.
 * A name and a handle are proper nouns and are the same in all three.
 */

/** Case-folded for comparison. `toLowerCase` without a locale is right here:
    the fields are proper nouns, not sentences, and a locale-aware fold on a
    Turkish machine would move the dotless i. */
const fold = (value) => (value ?? '').toLowerCase();

export function enhanceExplore(root = document) {
  const grid = root.querySelector('.explore-grid:not([data-bound])');
  if (!grid) return;
  grid.setAttribute('data-bound', '');

  const tiles = [...grid.querySelectorAll('.explore-tile')];
  const facets = root.querySelector('.facet-row');
  const search = root.querySelector('md-search');
  const counter = root.querySelector('.facet-foot [data-count-template]');
  const foot = root.querySelector('.facet-foot');
  const resetTemplate = root.querySelector('template.explore-reset-template');
  const emptyTemplate = root.querySelector('template.explore-empty-template');
  const total = tiles.length;

  /**
   * Put one of the two templated blocks in, or take it out again.
   *
   * Cloned on the way in and REMOVED on the way out rather than hidden, so the
   * document holds exactly what the four SPA builds' render would have
   * produced for the same state — which is what makes a parity screenshot taken
   * mid-filter comparable rather than merely similar.
   */
  const present = (template, selector, parent, want, bind) => {
    const existing = parent?.querySelector(selector);
    if (want && !existing && template) {
      const node = template.content.firstElementChild?.cloneNode(true);
      if (!node) return;
      parent.append(node);
      bind?.(node);
    } else if (!want && existing) {
      existing.remove();
    }
  };

  let topic = null;
  let query = '';

  const apply = () => {
    const needle = fold(query.trim());
    let shown = 0;

    for (const tile of tiles) {
      const topics = (tile.getAttribute('data-topics') ?? '').split(' ');
      const matchesTopic = topic === null || topics.includes(topic);
      const matchesSearch =
        needle === '' ||
        fold(tile.getAttribute('data-name')).includes(needle) ||
        fold(tile.getAttribute('data-handle')).includes(needle);
      const visible = matchesTopic && matchesSearch;
      tile.toggleAttribute('hidden', !visible);
      if (visible) shown += 1;
    }

    const template = counter?.getAttribute('data-count-template');
    if (counter && template) {
      counter.textContent = template
        .replace('%shown%', String(shown))
        .replace('%total%', String(total));
    }

    grid.toggleAttribute('hidden', shown === 0);
    present(emptyTemplate, '.empty', grid.parentElement, shown === 0);
    present(resetTemplate, '.explore-reset', foot, topic !== null || query !== '', (button) =>
      button.addEventListener('mdClick', clear),
    );
  };

  /* Declared as a binding rather than inlined, because `present` above wires it
     onto each freshly-cloned reset button and `apply` runs before any of them
     exists. */
  function clear() {
    topic = null;
    query = '';
    for (const chip of facets?.querySelectorAll('md-chip[data-topic]') ?? []) {
      chip.removeAttribute('selected');
    }
    if (search) search.value = '';
    apply();
  }

  /* `mdSelect` bubbles from the chip to the row, so one listener covers all ten
     — and the chip's own `selected` state is the component's to manage; this
     only reads which way it went. */
  facets?.addEventListener('mdSelect', (event) => {
    const value = event.target?.dataset?.topic;
    if (!value) return;
    if (event.detail?.selected) {
      /* A filter chip row is not a radio group, so the component will happily
         leave two selected. One topic at a time is the rule the four SPA builds
         hold in state; here it has to be enforced on the elements. */
      for (const chip of facets.querySelectorAll('md-chip[data-topic]')) {
        if (chip !== event.target) chip.removeAttribute('selected');
      }
      topic = value;
    } else if (topic === value) {
      topic = null;
    }
    apply();
  });

  /* `md-search` carries `{ value }` on every one of its events — unlike
     `md-text-field`, whose `mdInput` detail IS the bare string. Two different
     components, two different shapes; assuming one from the other has cost this
     repo two silent bugs. `mdSearch` rather than `mdInput` because it is
     debounced and distinct-until-changed. */
  search?.addEventListener('mdSearch', (event) => {
    query = event.detail?.value ?? '';
    apply();
  });

}
