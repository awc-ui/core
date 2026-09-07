import { matchesDiscovery } from '@awc-ui/showcase-kit/community';
/** Discovery filters reuse translated server-rendered cards and preserve their interaction state. */
export function enhanceFeed(root = document, onCloned = () => {}) {
  const tools = root.querySelector('.discovery-tools:not([data-discovery-bound])');
  if (!tools) return;
  tools.setAttribute('data-discovery-bound', '');
  const host = tools.parentElement;
  const more = host.querySelector('.feed__more');
  const end = host.querySelector('.feed__end');
  const empty = host.querySelector('.discovery-empty');
  const rest = host.querySelector('template.feed-rest');
  const cards = [...host.querySelectorAll(':scope > .feed__item')];
  if (rest) cards.push(...rest.content.cloneNode(true).querySelectorAll('.feed__item'));
  // Full labels are translated at build time, including singular and dual forms.
  const countLabels = JSON.parse(tools.getAttribute('data-discovery-count-labels') ?? '[]');
  const page = Number(tools.getAttribute('data-discovery-page'));
  const field = tools.querySelector('md-text-field');
  const reset = tools.querySelector('.discovery-tools__reset');
  let query = '';
  let filter = 'all';
  let shown = page;
  const render = () => {
    const matches = cards.filter((card) =>
      matchesDiscovery(
        card.getAttribute('data-discovery-search') ?? '',
        query,
        filter,
        card.getAttribute('data-discovery-category') ?? '',
      ),
    );
    cards.forEach((card) => card.remove());
    const anchor = more ?? end;
    for (const card of matches.slice(0, shown)) anchor.before(card);
    more?.toggleAttribute('hidden', shown >= matches.length);
    end?.toggleAttribute('hidden', matches.length === 0 || shown < matches.length);
    empty?.toggleAttribute('hidden', matches.length > 0);
    tools.querySelector('.discovery-count').textContent =
      countLabels[matches.length] ?? String(matches.length);
    reset.disabled = !query && filter === 'all';
    for (const button of tools.querySelectorAll('[data-discovery-filter]')) {
      const selected = button.getAttribute('data-discovery-filter') === filter;
      button.setAttribute('variant', selected ? 'tonal' : 'text');
      button.setAttribute('aria-pressed', String(selected));
    }
    onCloned();
  };
  field?.addEventListener('mdInput', (event) => {
    query = event.detail ?? '';
    shown = page;
    render();
  });
  for (const button of tools.querySelectorAll('[data-discovery-filter]')) {
    button.addEventListener('mdClick', () => {
      filter = button.getAttribute('data-discovery-filter');
      shown = page;
      render();
    });
  }
  reset?.addEventListener('mdClick', () => {
    query = '';
    filter = 'all';
    shown = page;
    field.value = '';
    render();
  });
  more?.querySelector('md-button')?.addEventListener('mdClick', () => {
    shown = cards.length;
    render();
  });
}
