import { componentIcon } from './component-icons.js';

const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

export function filterDocumentationNavigation(navigation, components, query = '') {
  const available = new Map(components.map(component => [component.tag, component]));
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return navigation.groups.map(group => ({ ...group, items: group.items.filter(item => {
    const component = available.get(item.tag);
    const text = `${item.title} ${item.tag} ${group.title}`.toLocaleLowerCase();
    return component && words.every(word => text.includes(word));
  }) })).filter(group => group.items.length);
}

export function navigationMarkup(groups, selected) {
  const items = groups.flatMap(group => group.items);
  if (!items.length) return '<p class="empty-state" role="status">No matching components.</p>';
  return `<md-navigation-rail id="studio-component-navigation" variant="expanded" label="Components" density="-2" active-index="${items.findIndex(item => item.tag === selected)}">${groups.map(group =>
    `<h3 data-section-header><span>${escape(group.title)}</span><md-chip class="count-chip nav-group-count" variant="input" selectable="false" removable="false" density="-4" inert aria-hidden="true">${group.items.length}</md-chip><span class="studio-visually-hidden">, ${group.items.length} ${group.items.length === 1 ? 'component' : 'components'}</span></h3>${group.items.map(item => `<md-navigation-rail-tab data-tag="${escape(item.tag)}" value="${escape(item.tag)}" label="${escape(item.title)}" title="${escape(item.title)}" href="#${escape(item.tag)}" icon="${escape(componentIcon(item.tag))}" density="-2"${item.tag === selected ? ' active' : ''}></md-navigation-rail-tab>`).join('')}`
  ).join('')}</md-navigation-rail><span class="studio-visually-hidden" role="status">${items.length} components shown.</span>`;
}

/** Let the real AWC rail own focus, keyboard navigation and link semantics. */
export function createComponentNavigation({ container, onSelect }) {
  let signature;
  // The AWC component itself exposes the single named navigation landmark.
  container.setAttribute('role', 'presentation');
  container.removeAttribute('aria-label');
  const activate = event => {
    if (event.target?.id !== 'studio-component-navigation') return;
    const tag = event.detail?.value;
    const items = container.querySelectorAll('md-navigation-rail-tab');
    if ([...items].some(item => item.dataset.tag === tag)) onSelect(tag);
  };
  container.addEventListener('mdTabChange', activate);
  return {
    render(groups, selected) {
      const nextSignature = JSON.stringify(groups);
      if (signature !== nextSignature) {
        signature = nextSignature;
        container.innerHTML = navigationMarkup(groups, selected);
      } else {
        // Selection must not replace focused native destinations or reset scroll.
        const items = [...container.querySelectorAll('md-navigation-rail-tab')];
        const index = items.findIndex(item => item.dataset.tag === selected);
        container.querySelector('md-navigation-rail')?.setAttribute('active-index', String(index));
        items.forEach(item => item.toggleAttribute('active', item.dataset.tag === selected));
      }
    },
    dispose() { container.removeEventListener('mdTabChange', activate); },
  };
}
