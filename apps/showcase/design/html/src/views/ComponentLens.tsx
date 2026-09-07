import { pictorSearchText } from '@awc-ui/pictor-model';
import { translateUi as p } from '../context';
import { dom, Fragment } from '../dom';
import { field, ui, requestRender } from '../context';
import { StudioDialog, TextControl } from '../controls';

/** Human-readable UI names supplement exact custom-element tags in search. */
const componentName = (tag: string) => { const words = tag.slice(3).replaceAll('-', ' '); return words.charAt(0).toUpperCase() + words.slice(1); };

type Entry = { tag: string; count: number; markup: string };

/** Snapshot the application surface when opened, excluding this inspector. */
function inspectComponents(): Entry[] {
  const entries = new Map<string, Entry>();
  for (const element of document.querySelectorAll('.shell *')) {
    if (!element.localName.startsWith('md-') || !customElements.get(element.localName) || element.closest('[data-component-lens]')) continue;
    const entry = entries.get(element.localName);
    if (entry) { entry.count++; continue; }
    const clone = element.cloneNode(true) as Element;
    for (const node of [clone, ...clone.querySelectorAll('*')]) {
      for (const attribute of [...node.attributes]) {
        if (/^(class|id|style|data-.+|s-.+|c-id|hydrated)$/.test(attribute.name)) node.removeAttribute(attribute.name);
      }
    }
    entries.set(element.localName, { tag: element.localName, count: 1, markup: clone.outerHTML });
  }
  return [...entries.values()].sort((a, b) => a.tag.localeCompare(b.tag));
}

export function ComponentLens() {
  const [open, setOpen] = field('ComponentLens:open', false);
  const [entries, setEntries] = field<Entry[]>('ComponentLens:entries', []);
  const [query, setQuery] = field('ComponentLens:query', '');
  const [selected, setSelected] = field('ComponentLens:selected', '');
  const [copyStatus, setCopyStatus] = field('ComponentLens:copyStatus', '');
  const current = entries.find(entry => entry.tag === selected);
  const filtered = entries.filter(entry => pictorSearchText(`${entry.tag} ${componentName(entry.tag)} ${p(componentName(entry.tag))}`).includes(pictorSearchText(query)));
  return <div data-component-lens>
    <StudioDialog open={open} onClose={() => setOpen(false)} title={p("Inside the interface")} actions={<md-button variant="text" onClick={() => setOpen(false)}>{p("Back to Pictor")}</md-button>}>
      <p className="component-lens__intro"><strong>{p("{count} AWC component types", { count: entries.length })}</strong>  {p("compose this screen. Explore the elements behind the experience, then bring them into your own application.")}</p>
      <TextControl live label={p("Find a component")} value={query} onValue={setQuery} placeholder={p("Try button, dialog, slider…")} />
      <div className="component-lens__layout">
        <div className="component-lens__list" aria-label={p("Components on this screen")}>
          {filtered.map(entry => <button key={entry.tag} aria-pressed={selected === entry.tag} onClick={() => { setSelected(entry.tag); setCopyStatus(''); }}><code title={p(componentName(entry.tag))}>{entry.tag}</code><span>{entry.count}</span></button>)}
          {!filtered.length && <p>{p("No matching components on this screen.")}</p>}
        </div>
        {current && <section className="component-lens__detail">
          <span className="component-lens__eyebrow">{p("LIVE ELEMENT MARKUP")}</span><h3>{current.tag}</h3>
          <p>{p("{count} {value} in this application surface. This HTML shows the first instance; object properties and event handlers belong in your framework code.", { count: current.count, value: current.count === 1 ? p('instance') : p('instances') })}</p>
          <pre tabIndex={0}><code>{current.markup.length > 5000 ? `${current.markup.slice(0, 5000)}\n… ${p("Preview truncated; copy includes the complete element.")}` : current.markup}</code></pre>
          <div className="component-lens__actions"><md-button variant="tonal" icon="content_copy" onClick={async () => { try { await navigator.clipboard.writeText(current.markup); setCopyStatus("Markup copied"); } catch { setCopyStatus("Clipboard unavailable. Select and copy the preview."); } }}>{p("Copy HTML")}</md-button><md-button variant="text" icon="open_in_new" href={`https://awc-ui.dev/components/${current.tag.slice(3)}/`} target="_blank" rel="noopener noreferrer">{p("Component API")}</md-button></div>
          <span role="status">{p(copyStatus)}</span>
        </section>}
      </div>
      <div className="component-lens__install"><span>{p("Start with the library")}</span><code>npm i @awc-ui/core</code><a href="https://awc-ui.dev/getting-started/installation/" target="_blank" rel="noopener noreferrer">{p("Choose your framework →")}</a></div>
    </StudioDialog>
  </div>;
}

export function openComponentLens(){ const entries=inspectComponents(); ui.set('ComponentLens:entries',entries); ui.set('ComponentLens:selected',entries.find(e=>e.tag==='md-button')?.tag??entries[0]?.tag??''); ui.set('ComponentLens:query','');ui.set('ComponentLens:copyStatus','');ui.set('ComponentLens:open',true);requestRender();}
