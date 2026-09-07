import { translateUi as p } from '../context';
import { dom, Fragment } from '../dom';
import { field, calculate } from '../context';
import { editIcon, fileById, getFiles, getProjects, getTotals, getViewer, recentFiles, sharedFiles } from '@awc-ui/showcase-kit/design';
import { Screen } from '../controls';
import { ChoiceTabs, TextControl } from '../controls';
import { getDocument } from '../context';
import { documentSvg } from '@awc-ui/pictor-model';
import { getRouter } from '../context';
import { Link } from '../controls';
import { route } from '../context';
import { getTranslator } from '../context';

export function ProfileScreen() {
  const t = getTranslator(), doc = getDocument(), router = getRouter();
  const viewer = getViewer(), totals = getTotals(), projects = getProjects();
  const [view, setView] = field('ProfileScreen:view', 'recent'), [query, setQuery] = field('ProfileScreen:query', '');
  const currentFile = fileById(doc.fileId);
  const files = calculate(() => (view === 'shared' ? sharedFiles() : recentFiles(12)).filter(file => file.name.toLowerCase().includes(query.toLowerCase())).slice(0, 8), [view, query]);
  const entries = doc.history.entries.slice(0, doc.history.index).slice(-4).reverse();
  const preview = (fileId: string) => `data:image/svg+xml,${encodeURIComponent(documentSvg(doc.layersForFile(fileId), t))}`;
  const metrics = [
    { label: p("Projects"), value: totals.projects, icon: 'folder_open' },
    { label: p("Design files"), value: totals.files, icon: 'draft' },
    { label: p("Layers"), value: getFiles().reduce((count, file) => count + doc.layersForFile(file.id).length, 0), icon: 'layers' },
    { label: p("Components"), value: totals.components, icon: 'deployed_code' },
    { label: p("Assets"), value: totals.assets, icon: 'interests' },
  ];

  return <Screen title={p("Your creative space")} subtitle={p("The things you're making, and the possibilities ahead.")} aside={<md-button variant="tonal" icon="arrow_outward" onClick={() => router.push(route.editor())}>{p("Open the studio")}</md-button>}>
    <div className="pictor-profile" data-profile>
      <section className="pictor-profile-identity" aria-label={p("Your profile")}>
        <div className="pictor-profile-identity__person"><md-avatar src={viewer.art.src} name={viewer.displayName} label={t(viewer.art.altKey)} size="large" /><div><span className="pictor-profile-eyebrow">{p("YOUR CORNER OF PICTOR")}</span><h2>{viewer.displayName}</h2><p>@{viewer.handle} <span aria-hidden="true">·</span>  {p("A little curiosity goes a long way.")}</p></div></div>
        <div className="pictor-profile-identity__art" aria-hidden="true"><svg viewBox="0 0 210 140"><circle cx="67" cy="70" r="49" fill="#BEE7AA" /><rect x="82" y="20" width="89" height="100" rx="44" fill="none" stroke="#C2BBF3" strokeWidth="20" transform="rotate(30 125 70)" /><circle cx="174" cy="113" r="11" fill="#F2AAA7" /></svg><span>{p("ROOM FOR YOUR NEXT BIG IDEA")}</span></div>
      </section>

      <section className="pictor-profile-metrics" aria-label={p("Workspace library overview")}>{metrics.map(metric => <div className="pictor-profile-metric" key={metric.label}><span className="material-symbols-outlined" aria-hidden="true">{metric.icon}</span><strong>{t.formatNumber(metric.value)}</strong><span>{metric.label}</span></div>)}</section>

      {currentFile ? <md-card class="pictor-profile-resume" variant="outlined"><Link className="pictor-profile-resume__preview" href={route.editor()} aria-label={p("Continue editing {name}", { name: currentFile.name })}><img src={preview(currentFile.id)} alt={p("{name} current canvas", { name: currentFile.name })} /></Link><div className="pictor-profile-resume__copy"><span className="pictor-profile-eyebrow">{p("RIGHT WHERE YOU LEFT OFF")}</span><h2>{currentFile.name}</h2><p>{p("Your canvas is waiting. Pick up a detail, follow an idea, or take the whole thing somewhere new.")}</p><div className="pictor-profile-resume__details"><span><span className="material-symbols-outlined" aria-hidden="true">layers</span>{p("{count} editable layers", { count: doc.layers.length })}</span><span><span className="material-symbols-outlined" aria-hidden="true">history</span>{p("{index} reversible edits", { index: doc.history.index })}</span></div><md-button variant="filled" icon="arrow_forward" onClick={() => router.push(route.editor())}>{p("Continue designing")}</md-button></div></md-card> : null}

      <div className="pictor-profile-workspace">
        <section className="pictor-profile-files"><div className="pictor-profile-section-head"><div><span className="pictor-profile-eyebrow">{p("KEEP YOUR MOMENTUM")}</span><h2>{p("Your design files")}</h2></div><ChoiceTabs label={p("Profile file view")} value={view} onValue={setView} options={[{ value: 'recent', label: p("Recent") }, { value: 'shared', label: p("With others") }]} /></div><TextControl live label={p("Find a design file")} value={query} onValue={setQuery} />
          <div className="pictor-profile-file-list">{files.map(file => <Link key={file.id} href={route.file(file.id)} className="pictor-profile-file"><img src={preview(file.id)} alt="" loading="lazy" /><div><strong>{file.name}</strong><span>{projects.find(project => project.id === file.projectId)?.name} <span aria-hidden="true">·</span> {p("{count} layers", { count: doc.layersForFile(file.id).length })}</span></div><md-chip label={t(file.stateKey)} /><span className="material-symbols-outlined pictor-profile-file__arrow" aria-hidden="true">arrow_outward</span></Link>)}</div>{!files.length ? <div className="pictor-profile-empty"><span className="material-symbols-outlined" aria-hidden="true">search_off</span><h3>{p("No designs in this view")}</h3><p>{p("Try another name or return to your recent files.")}</p><md-button variant="text" onClick={() => { setQuery(''); setView('recent'); }}>{p("Show recent files")}</md-button></div> : null}
        </section>

        <aside className="pictor-profile-sidebar">
          <md-card class="pictor-profile-activity" variant="outlined"><div className="pictor-profile-section-head"><h2>{p("A little progress")}</h2><span className="material-symbols-outlined" aria-hidden="true">history</span></div><p className="pictor-profile-note">{p("Recent changes on your current canvas.")}</p>{entries.length ? <ol>{entries.map(entry => <li key={entry.id}><span className="material-symbols-outlined" aria-hidden="true">{editIcon(entry.kind)}</span><div><strong>{t(entry.labelKey)}</strong><span>{entry.after[0]?.name ?? entry.before[0]?.name ?? p("Canvas")}</span></div></li>)}</ol> : <div className="pictor-profile-first-step"><span className="material-symbols-outlined" aria-hidden="true">draw</span><p>{p("Every good idea starts with a first move.")}</p><md-button variant="text" onClick={() => router.push(route.editor())}>{p("Make your first edit")}</md-button></div>}</md-card>
          <md-card class="pictor-profile-saved" variant="filled"><span className="material-symbols-outlined" aria-hidden="true">{doc.saveStatus === 'unavailable' ? 'cloud_off' : 'check_circle'}</span><h3>{doc.saveStatus === 'unavailable' ? p("Keep a copy of your work") : p("Your ideas stay with you.")}</h3><p>{doc.saveStatus === 'unavailable' ? p("Export your current canvas to keep it beyond this session.") : p("Your canvases and their history are saved in this browser, ready for your next visit.")}</p><md-button variant="text" icon={doc.saveStatus === 'unavailable' ? 'download' : 'save'} onClick={() => { if (doc.saveStatus === 'unavailable') { router.push(route.editor()); setTimeout(() => window.dispatchEvent(new Event('pictor:export')), 120); } else doc.save(); }}>{doc.saveStatus === 'unavailable' ? p("Export a copy") : p("Save workspace")}</md-button></md-card>
          <Link className="pictor-profile-library-link" href={route.assets()}><span className="material-symbols-outlined" aria-hidden="true">interests</span><div><strong>{p("A new ingredient?")}</strong><span>{p("Explore your creative library")}</span></div><span className="material-symbols-outlined" aria-hidden="true">arrow_forward</span></Link>
        </aside>
      </div>
    </div>
  </Screen>;
}
