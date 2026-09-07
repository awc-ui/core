import { scrollCommandIntoView, pictorSearchText } from '@awc-ui/pictor-model';
import { useT as usePictorT } from '@/lib/showcase';
import { useEffect, useMemo, useRef, useState } from 'react';
import { fileById, getAssets, getFiles, getProjects, projectSlug } from '@awc-ui/showcase-kit/design';
import { useDocument } from '@/lib/document';
import { useRouter } from '@/lib/router';
import { route } from '@/lib/routes';
import { useCustomEvent } from './elements';
import './workbench-shell.css';

interface Command { id: string; label: string; detail: string; keywords: string; icon: string; run(): void }
const emit = (name: string) => window.dispatchEvent(new CustomEvent(name));

/** The global actions outlive route changes; editing shortcuts belong to the editor. */
export function WorkbenchCommands() {
  const p = usePictorT();
  const doc = useDocument();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [message, setMessage] = useState('');
  const dialog = useRef<HTMLElement>(null);
  const snackbar = useRef<HTMLElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const resultsList = useRef<HTMLDivElement>(null);
  const openState = useRef(false);
  const previousFocus = useRef<HTMLElement | null>(null);
  const openPalette = () => {
    if (openState.current) return;
    let focused = document.activeElement;
    while (focused?.shadowRoot?.activeElement) focused = focused.shadowRoot.activeElement;
    previousFocus.current = focused instanceof HTMLElement ? focused : null;
    openState.current = true;
    setOpen(true);
  };
  const closePalette = () => { openState.current = false; setOpen(false); };
  useCustomEvent(dialog, 'mdClose', (event) => { if (event.target === dialog.current) closePalette(); });
  useCustomEvent(dialog, 'mdOpen', () => input.current?.focus());
  useCustomEvent(snackbar, 'mdClose', () => setMessage(''));

  const save = () => setMessage(doc.save() ? "Saved to this browser. Your files and history are here when you return." : "Browser storage is unavailable. Your work is still open; export a copy to keep it.");
  useEffect(() => {
    const commands = openPalette;
    const saveNow = () => save();
    const keydown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.isComposing) return;
      if (event.key.toLowerCase() === 'k') { event.preventDefault(); openState.current ? closePalette() : openPalette(); }
      if (event.key.toLowerCase() === 's') { event.preventDefault(); save(); }
    };
    window.addEventListener('keydown', keydown);
    window.addEventListener('pictor:commands', commands);
    window.addEventListener('pictor:save', saveNow);
    return () => {
      window.removeEventListener('keydown', keydown);
      window.removeEventListener('pictor:commands', commands);
      window.removeEventListener('pictor:save', saveNow);
    };
  }, [doc.save, p]);
  useEffect(() => {
    if (!open) {
      const target = previousFocus.current;
      previousFocus.current = null;
      // A chosen command may open another dialog in this same render. Let it
      // own focus; otherwise return to the still-connected palette trigger.
      if (target?.isConnected && !document.querySelector('md-dialog[open]')) target.focus({ preventScroll: true });
      return;
    }
    setQuery(''); setActive(0);
    const timer = setTimeout(() => input.current?.focus(), 60);
    return () => clearTimeout(timer);
  }, [open]);

  const commands = useMemo<Command[]>(() => {
    const inEditor = router.pathname === route.editor() || router.pathname.startsWith('/f/');
    const editorAction = (event: string) => {
      if (inEditor) emit(event);
      else { router.push(route.editor()); setTimeout(() => emit(event), 120); }
    };
    return [
      { id: 'editor', label: p("Open canvas"), keywords: "Open canvas Continue designing editor", detail: fileById(doc.fileId)?.name ?? p("Continue designing"), icon: 'draw', run: () => router.push(route.editor()) },
      { id: 'projects', label: p("Browse projects"), keywords: "Browse projects Your workspace", detail: p("Your workspace"), icon: 'folder_open', run: () => router.push(route.projects()) },
      { id: 'assets', label: p("Explore assets"), keywords: "Explore assets Images colors reusable components library", detail: p("Images, colors and reusable components"), icon: 'grid_view', run: () => router.push(route.assets()) },
      { id: 'save', label: p("Save in this browser"), keywords: "Save in this browser Keep your files canvas and undo history", detail: p("Keep your files, canvas and undo history"), icon: 'save', run: save },
      { id: 'export', label: p("Export your design"), keywords: "Export your design Download SVG PNG JSON", detail: p("Download an SVG or PNG"), icon: 'download', run: () => editorAction('pictor:export') },
      { id: 'present', label: p("Present canvas"), keywords: "Present canvas Explore your design without editor panels preview presentation", detail: p("Explore your design without editor panels"), icon: 'play_arrow', run: () => editorAction('pictor:present') },
      { id: 'components', label: p("Explore AWC components"), keywords: "Explore AWC components Inspect the real components powering this screen API widgets", detail: p("Inspect the real components powering this screen"), icon: 'widgets', run: () => emit('pictor:components') },
      ...getFiles().map((file) => ({ id: `file:${file.id}`, label: file.name, detail: p("Design file"), keywords: "Design file", icon: 'draft', run: () => { doc.openFile(file.id); router.push(route.file(file.id)); } })),
      ...getProjects().map((project) => ({ id: `project:${project.id}`, label: project.name, detail: p("Project"), keywords: "Project", icon: 'folder', run: () => router.push(route.project(projectSlug(project))) })),
      ...getAssets().map((asset) => ({ id: `asset:${asset.id}`, label: asset.name, detail: p("Asset · {kind}", { kind: p(asset.kindKey) }), keywords: `Asset ${asset.kind} ${asset.kind.replaceAll('-', ' ')}`, icon: 'interests', run: () => router.push(route.asset(asset.id)) })),
    ];
  }, [doc.fileId, doc.openFile, doc.save, router, p]);
  // Source-language aliases stay searchable while labels follow the locale.
  const normalized = pictorSearchText(query);
  const results = commands.filter((command) => !normalized || pictorSearchText(`${command.label} ${command.detail} ${command.keywords}`).includes(normalized)).slice(0, 12);
  const choose = (command?: Command) => { if (command) { closePalette(); command.run(); } };
  const selected = Math.min(active, Math.max(0, results.length - 1));
  useEffect(() => { if (open) scrollCommandIntoView(resultsList.current, selected); }, [open, selected, query]);

  return <>
    {open ? <md-dialog locale={p.locale} ref={dialog} class="pictor-command-dialog" open={open || undefined} headline={p("Go anywhere. Make something.")} icon="search">
      <div className="pictor-command-search">
        <input ref={input} value={query} onChange={(event) => { setQuery(event.target.value); setActive(0); }}
          aria-label={p("Search commands, projects, files and assets")} placeholder={p("Search commands, files, projects…")}
          role="combobox" aria-expanded="true" aria-controls="pictor-command-results" aria-autocomplete="list"
          aria-activedescendant={results.length ? `pictor-command-${selected}` : undefined}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') { event.preventDefault(); setActive((value) => Math.max(0, Math.min(results.length - 1, value + 1))); }
            if (event.key === 'ArrowUp') { event.preventDefault(); setActive((value) => Math.max(0, value - 1)); }
            if (event.key === 'Enter') { event.preventDefault(); choose(results[selected]); }
            if (event.key === 'Escape') { event.preventDefault(); closePalette(); }
          }} />
      </div>
      <div ref={resultsList} className="pictor-command-results" id="pictor-command-results" role="listbox" aria-label={p("Commands and destinations")}>
        {results.map((command, index) => <button key={command.id} id={`pictor-command-${index}`} type="button" tabIndex={-1} role="option"
          aria-selected={index === selected} className="pictor-command-item" onMouseEnter={() => setActive(index)} onClick={() => choose(command)}>
          <span className="pictor-command-icon" aria-hidden="true">{command.icon}</span>
          <span><strong>{command.label}</strong><small>{command.detail}</small></span>
          <span className="pictor-command-enter" aria-hidden="true">↵</span>
        </button>)}
        {!results.length && <p className="pictor-command-empty">{p("No matches. Try “canvas”, “export”, or a project name.")}</p>}
      </div>
      <div slot="actions" className="pictor-command-hints"><span><kbd>↑</kbd> <kbd>↓</kbd>  {p("to navigate")}</span><span><kbd>Enter</kbd>  {p("to open")}</span><span><kbd>Esc</kbd>  {p("to close")}</span></div>
    </md-dialog> : null}
    <md-snackbar ref={snackbar} open={!!message || undefined} message={p(message)} duration={4500} />
  </>;
}
