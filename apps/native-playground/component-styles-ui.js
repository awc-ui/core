import { groupedStyleFields, parseStyleValue } from './component-styles.js';
import { componentAppearance } from './component-appearance.js';

const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

export function createComponentStylesUI({ getState, infoButton, onChange }) {
  let renderedKey, renderedTag, query = '', groups = [];
  const root = () => document.querySelector('#css-controls');
  const changed = () => { onChange(); updateCount(); };
  function updateCount() {
    const count = Object.values(getState().docCssValues || {}).filter(Boolean).length;
    const label = root().querySelector('#styles-edit-count');
    if (label) label.textContent = count ? `${count} override${count === 1 ? '' : 's'}` : 'Using component defaults';
    const reset = root().querySelector('#reset-css-styles');
    if (reset) reset.disabled = !count;
  }
  function filter() {
    query = root().querySelector('#styles-search')?.value?.trim().toLowerCase() || '';
    let matches = 0;
    for (const group of groups) {
      let groupMatches = 0;
      for (const field of group.fields) {
        const show = !query || field.search.includes(query);
        const control = root().querySelector(`[data-style-field="${field.index}"]`);
        if (control) control.hidden = !show;
        if (show) groupMatches++;
      }
      const accordion = root().querySelector(`[data-style-group="${group.title}"]`);
      if (accordion) {
        accordion.hidden = !groupMatches;
        if (query) accordion.expanded = !!groupMatches;
      }
      matches += groupMatches;
    }
    const empty = root().querySelector('#styles-empty');
    if (empty) empty.hidden = matches > 0;
  }
  function render(members) {
    const state = getState(), host = root(), button = !!componentAppearance(state.selected.tag);
    const key = JSON.stringify([state.selected.tag, state.platform, members]);
    if (key !== renderedKey) {
      const sameTag = renderedTag === state.selected.tag;
      const expanded = new Set([...host.querySelectorAll('[data-style-group]')].filter(item => item.expanded).map(item => item.dataset.styleGroup));
      if (!sameTag) query = '';
      groups = groupedStyleFields(state.selected.tag, members);
      const fields = groups.flatMap(group => group.fields);
      const control = field => `<div class="css-variable-control" data-style-field="${field.index}"><div class="css-variable-heading">${button ? `<code>${escape(field.name)}</code>` : `<label class="css-variable-label" for="css-${field.index}">${escape(field.label)}</label>`}${infoButton('cssProperty', field)}</div>${button ? '' : `<code class="css-variable-name">${escape(field.name)}</code>`}<md-text-field id="css-${field.index}" data-css-index="${field.index}" aria-label="${escape(field.name)} value" placeholder="${button ? 'Inherited value' : `e.g. ${escape(field.example)}`}" value="${escape(state.docCssValues?.[field.name] || '')}" density="-3" variant="outlined" clearable="internal"></md-text-field></div>`;
      const reset = '<div class="styles-reset"><span id="styles-edit-count" role="status"></span><md-button id="reset-css-styles" variant="text" size="xs" icon="restart_alt">Reset styles</md-button></div>';
      host.innerHTML = !fields.length ? '' : button
        ? `<md-accordion-item headline="Web CSS overrides" heading-level="3" density="-3"><div class="css-variable-fields">${[...fields].sort((a, b) => a.index - b.index).map(control).join('')}</div>${reset}</md-accordion-item>`
        : `<md-text-field id="styles-search" label="Find a style" aria-label="Search styles" value="${escape(query)}" variant="outlined" density="-3" clearable="internal"></md-text-field><div class="component-style-groups">${groups.map((group, index) => `<md-accordion-item data-style-group="${group.title}" headline="${group.title}" heading-level="3" density="-3"${(sameTag ? expanded.has(group.title) : index === 0) ? ' expanded' : ''}><span slot="headline" class="style-group-heading">${group.title}<md-chip class="count-chip" variant="input" selectable="false" removable="false" density="-4" inert aria-hidden="true">${group.fields.length}</md-chip></span><div class="css-variable-fields">${group.fields.map(control).join('')}</div></md-accordion-item>`).join('')}</div><p id="styles-empty" class="prop-note" hidden>No styles match your search.</p>${reset}`;
      renderedKey = key; renderedTag = state.selected.tag;
      host.querySelector('#styles-search')?.addEventListener('mdInput', filter);
      host.querySelector('#reset-css-styles')?.addEventListener('mdClick', () => {
        state.docCssValues = Object.fromEntries(fields.map(field => [field.name, '']));
        host.querySelectorAll('[data-css-index]').forEach(input => { input.value = ''; input.error = false; });
        changed();
      });
      host.querySelectorAll('[data-css-index]').forEach(input => input.addEventListener('mdInput', event => {
        if (event.target !== input) return;
        const field = fields.find(field => field.index === Number(input.dataset.cssIndex));
        try {
          const value = parseStyleValue(field, typeof event.detail === 'string' ? event.detail : input.value);
          getState().docCssValues ||= {};
          getState().docCssValues[field.name] = value;
          input.error = false;
          changed();
        } catch (error) { input.error = true; input.errorText = error.message; }
      }));
    }
    host.querySelectorAll('[data-css-index]').forEach(input => {
      if (input === document.activeElement) return;
      const field = groups.flatMap(group => group.fields).find(field => field.index === Number(input.dataset.cssIndex));
      const value = state.docCssValues?.[field.name] || '';
      if (input.value !== value) input.value = value;
    });
    if (!button) filter();
    updateCount();
  }
  return { render };
}
