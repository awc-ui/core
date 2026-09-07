import { useT as usePictorT } from '@/lib/showcase';
import { filesInProject, projectBySlug } from '@awc-ui/showcase-kit/design';
import { Screen } from '@/components/Shell';
import { TextControl } from '@/components/editor/controls';
import { NotFoundScreen } from '@/components/screens/NotFoundScreen';
import { useDocument } from '@/lib/document';
import { documentSvg, ORB_ART } from '@/lib/editor-model';
import { Link, useRouter } from '@/lib/router';
import { route } from '@/lib/routes';
import { useT } from '@/lib/showcase';
import { useState } from 'react';

export function ProjectScreen({ slug }: { slug: string }) {
  const p = usePictorT();
  const t = useT(), doc = useDocument(), router = useRouter();
  const [query, setQuery] = useState('');
  const project = projectBySlug(slug);
  if (!project) return <NotFoundScreen />;
  const projectFiles = filesInProject(project.id);
  const files = projectFiles.filter(file => file.name.toLowerCase().includes(query.toLowerCase()));
  const enterStudio = () => {
    const file = projectFiles.find(item => item.id === doc.fileId) ?? projectFiles[0];
    if (file) doc.openFile(file.id);
    router.push(route.editor());
  };
  return <Screen title={project.name} subtitle={p("A shared space for your most interesting ideas.")} crumbLabel={project.name} aside={<md-button variant="tonal" icon="arrow_outward" onClick={enterStudio}>{p("Enter the studio")}</md-button>}><div className="pictor-project-banner"><div><span className="pictor-eyebrow">{p("A SPACE TO CREATE")}</span><h2>{project.name}</h2><p>{t(project.descriptionKey)}</p><span>{p("{count} design files · Built to be explored", { count: project.fileIds.length })}</span></div><img src={ORB_ART.src} alt="" /></div><section className="pictor-section"><div className="pictor-section__head"><h2>{p("The work in progress")}</h2><TextControl live label={p("Search this project")} value={query} onValue={setQuery} /></div><div className="pictor-file-grid">{files.map(file => <md-card key={file.id} class="pictor-file-card" variant="outlined"><Link href={route.file(file.id)} className="pictor-file-preview" aria-label={p("Open {name}", { name: file.name })}><img src={`data:image/svg+xml,${encodeURIComponent(documentSvg(doc.layersForFile(file.id), t))}`} alt={p("{name} canvas preview", { name: file.name })} loading="lazy" /><span className="pictor-open-label"><span className="material-symbols-outlined" aria-hidden="true">open_in_new</span>  {p("Open canvas")}</span></Link><div className="pictor-file-meta"><Link href={route.file(file.id)}><strong>{file.name}</strong><span>{p("{count} layers · {count2} contributors", { count: doc.layersForFile(file.id).length, count2: file.editorHandles.length })}</span></Link><span className="material-symbols-outlined" aria-hidden="true">arrow_outward</span></div><div className="pictor-file-footer"><md-chip label={t(file.stateKey)} /></div></md-card>)}</div>{!files.length ? <div className="pictor-empty"><span className="material-symbols-outlined" aria-hidden="true">search_off</span><h3>{p("No files found")}</h3><p>{p("Try another search.")}</p></div> : null}</section></Screen>;
}
