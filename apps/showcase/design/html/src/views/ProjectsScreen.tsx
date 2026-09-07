import { translateUi as p } from '../context';
import { dom, Fragment } from '../dom';
import { field, calculate } from '../context';
import { getFiles, getProjects, getTotals, projectSlug } from '@awc-ui/showcase-kit/design';
import { Screen } from '../controls';
import { ChoiceTabs, FileFilterGroup, SelectControl, StudioDialog, TextControl } from '../controls';
import { getDocument } from '../context';
import { getRouter } from '../context';
import { Link } from '../controls';
import { route } from '../context';
import { TEMPLATES, ORB_ART, documentSvg, makeTemplate } from '@awc-ui/pictor-model';
import { getTranslator } from '../context';

export function ProjectsScreen() {
  const t = getTranslator();
  const doc = getDocument();
  const router = getRouter();
  const [query, setQuery] = field('ProjectsScreen:query', '');
  const [filter, setFilter] = field('ProjectsScreen:filter', 'all');
  const [sort, setSort] = field('ProjectsScreen:sort', 'recent');
  const [view, setView] = field('ProjectsScreen:view', 'grid');
  const [template, setTemplate] = field<string | null>('ProjectsScreen:template', null);
  const [favorites, setFavorites] = field<string[]>('ProjectsScreen:favorites', () => { try { const value = JSON.parse(localStorage.getItem('pictor:favorites') || '[]'); return Array.isArray(value) ? value.filter(item => typeof item === 'string') : []; } catch { return []; } });
  const totals = getTotals();
  const projects = getProjects();
  const files = calculate(() => getFiles().filter(file =>
    (!query || `${file.name} ${projects.find(project => project.id === file.projectId)?.name ?? ''}`.toLowerCase().includes(query.toLowerCase())) &&
    (filter === 'all' || filter === 'favorites' && favorites.includes(file.id) || filter === 'shared' && file.editorHandles.length > 1),
  ).slice().sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : sort === 'layers' ? doc.layersForFile(b.id).length - doc.layersForFile(a.id).length : b.updatedAt.localeCompare(a.updatedAt)), [query, filter, sort, favorites, doc.layersForFile]);
  const toggleFavorite = (id: string) => setFavorites(current => { const next = current.includes(id) ? current.filter(x => x !== id) : [...current, id]; try { localStorage.setItem('pictor:favorites', JSON.stringify(next)); } catch {} return next; });
  const selectedTemplate = template ? makeTemplate(template) : null;

  return <Screen title={p("Your creative workspace")} subtitle={p("A little structure. Infinite possibility.")} aside={<md-button variant="tonal" icon="arrow_outward" onClick={() => router.push(route.editor())}>{p("Resume designing")}</md-button>}>
    <section className="pictor-hero" aria-label={p("Welcome to Pictor")}>
      <div className="pictor-hero__copy">
        <span className="pictor-eyebrow"><span className="pictor-live-dot" />  {p("MADE FOR YOUR NEXT BIG IDEA")}</span>
        <h2>{p("Big ideas.")}<br /><em>{p("Beautifully made.")}</em></h2>
        <p>{p("From the first spark to the final pixel. Draw, compose, refine and export in one beautifully connected studio.")}</p>
        <div className="pictor-hero__actions"><md-button variant="filled" icon="draw" onClick={() => router.push(route.editor())}>{p("Enter the studio")}</md-button><md-button variant="text" icon="auto_awesome" onClick={() => document.getElementById('pictor-templates')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>{p("Start with a spark")}</md-button></div>
        <div className="pictor-hero__facts"><span><strong>{totals.projects}</strong>  {p("creative spaces")}</span><span><strong>{totals.assets}</strong>  {p("reusable assets")}</span><span><strong>{p("Yours.")}</strong>  {p("Saved on this device")}</span></div>
      </div>
      <div className="pictor-hero__art" aria-hidden="true"><div className="pictor-art-orbit" /><img src={ORB_ART.src} alt="" /><span className="pictor-art-label pictor-art-label--top"><span className="material-symbols-outlined" aria-hidden="true">deployed_code</span>  {p("Shape the unexpected")}</span><span className="pictor-art-label pictor-art-label--bottom"><span className="pictor-live-dot" />  {p("Boundless by design")}</span></div>
    </section>

    <section id="pictor-templates" className="pictor-section">
      <div className="pictor-section__head"><div><span className="pictor-eyebrow">{p("SKIP THE BLANK CANVAS")}</span><h2>{p("A starting point. A world of possibilities.")}</h2></div><span className="pictor-muted">{p("Every layer is yours to change")}</span></div>
      <div className="pictor-template-grid">{TEMPLATES.map(item => <button key={item.id} className="pictor-template" data-template={item.id} onClick={() => setTemplate(item.id)}><div className="pictor-template__art" data-tone={item.tone}><img src={item.art.src} alt="" /><span>{p(item.tagline)}</span><span className="pictor-template__arrow"><span className="material-symbols-outlined" aria-hidden="true">arrow_outward</span></span></div><div className="pictor-template__meta"><strong>{p(item.name)}</strong><span>{p(item.category)} · 960 × 640</span></div></button>)}</div>
    </section>

    <section className="pictor-section">
      <div className="pictor-section__head"><div><span className="pictor-eyebrow">{p("ROOM TO CREATE")}</span><h2>{p("Your projects")}</h2></div><span className="pictor-muted">{p("{count} spaces, one creative flow", { count: projects.length })}</span></div>
      <div className="pictor-project-grid">{projects.map((project, index) => <Link key={project.id} href={route.project(projectSlug(project))} className="pictor-project-card"><div className="pictor-project-mark" data-tone={TEMPLATES[index % 3].tone}><span className="material-symbols-outlined" aria-hidden="true">{['shapes', 'photo_camera', 'auto_awesome', 'view_quilt', 'palette', 'architecture'][index % 6]}</span></div><div><strong>{project.name}</strong><span>{p("{count} design files", { count: project.fileIds.length })}</span></div><span className="material-symbols-outlined" aria-hidden="true">arrow_forward</span></Link>)}</div>
    </section>

    <section className="pictor-section">
      <div className="pictor-section__head"><h2>{p("Pick up where inspiration left you")}</h2><ChoiceTabs label={p("File layout")} value={view} onValue={setView} options={[{ value: 'grid', label: p("Grid"), icon: 'grid_view' }, { value: 'list', label: p("List"), icon: 'view_list' }]} /></div>
      <div className="pictor-filterbar"><FileFilterGroup label={p("Filter design files")} value={filter} onValue={setFilter} options={[{ value: 'all', label: p("All files") }, { value: 'favorites', label: p("Starred"), icon: 'star' }, { value: 'shared', label: p("Shared"), icon: 'group' }]} /><TextControl live label={p("Search files")} placeholder={p("Find your next idea…")} value={query} onValue={setQuery} /><SelectControl label={p("Sort by")} value={sort} onValue={setSort} options={[{ value: 'recent', label: p("Recently edited") }, { value: 'name', label: p("Name") }, { value: 'layers', label: p("Most layers") }]} /></div>
      {files.length ? <div className="pictor-file-grid" data-view={view}>{files.map(file => <md-card key={file.id} class="pictor-file-card" variant="outlined"><Link href={route.file(file.id)} className="pictor-file-preview" aria-label={p("Open {name}", { name: file.name })}><img src={`data:image/svg+xml,${encodeURIComponent(documentSvg(doc.layersForFile(file.id), t))}`} alt={p("{name} canvas preview", { name: file.name })} loading="lazy" /><span className="pictor-open-label"><span className="material-symbols-outlined" aria-hidden="true">open_in_new</span>  {p("Open canvas")}</span></Link><div className="pictor-file-meta"><Link href={route.file(file.id)}><strong>{file.name}</strong><span>{p("{name} · {count} layers", { name: projects.find(project => project.id === file.projectId)?.name ?? '', count: doc.layersForFile(file.id).length })}</span></Link><md-icon-button icon={favorites.includes(file.id) ? 'star' : 'star_outline'} aria-label={`${favorites.includes(file.id) ? p("Unstar") : p("Star")} ${file.name}`} onClick={() => toggleFavorite(file.id)} /></div><div className="pictor-file-footer"><md-chip label={t(file.stateKey)} /><span><span className="material-symbols-outlined" aria-hidden="true">group</span> {file.editorHandles.length}</span></div></md-card>)}</div> : <div className="pictor-empty"><span className="material-symbols-outlined" aria-hidden="true">search_off</span><h3>{p("No files in this view")}</h3><p>{p("Try another search or star a design to collect it here.")}</p><md-button variant="text" onClick={() => { setQuery(''); setFilter('all'); }}>{p("Show all files")}</md-button></div>}
    </section>

    <StudioDialog open={!!template} onClose={() => setTemplate(null)} title={selectedTemplate ? p(selectedTemplate.name) : p("Choose a template")} actions={<><md-button variant="text" onClick={() => setTemplate(null)}>{p("Keep exploring")}</md-button><md-button variant="filled" icon="auto_awesome" onClick={() => { if (selectedTemplate) { doc.replaceCanvas(selectedTemplate.layers); setTemplate(null); router.push(route.editor()); } }}>{p("Make it yours")}</md-button></>}>
      {selectedTemplate ? <><img className="pictor-template-preview" src={`data:image/svg+xml,${encodeURIComponent(documentSvg(selectedTemplate.layers))}`} alt={p("{name} editable design", { name: p(selectedTemplate.name) })} /><p>{p("This replaces your current canvas with {count} editable layers. You can undo the replacement from the studio history.", { count: selectedTemplate.layers.length })}</p></> : null}
    </StudioDialog>
  </Screen>;
}
