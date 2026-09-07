import { useT as usePictorT } from '@/lib/showcase';
import { fileById, lockedLayers, visibleLayers, descendantIds, type ToolMode } from '@awc-ui/showcase-kit/design';
import { useEffect, useState, type KeyboardEvent } from 'react';
import { Canvas } from '@/components/editor/Canvas';
import { HistoryPanel } from '@/components/editor/HistoryPanel';
import { Inspector } from '@/components/editor/Inspector';
import { LayerTree } from '@/components/editor/LayerTree';
import { Toolbar } from '@/components/editor/Toolbar';
import { InsertPanel } from '@/components/editor/InsertPanel';
import { ExportDialog } from '@/components/editor/ExportDialog';
import { PanelTabs, StudioDialog } from '@/components/editor/controls';
import { Screen } from '@/components/Shell';
import { NotFoundScreen } from '@/components/screens/NotFoundScreen';
import { useDocument } from '@/lib/document';

const toolHelp: Record<ToolMode, readonly [string, string]> = {
  select: ['Select', 'Drag to move · Shift-click to select more · Drag a corner to resize'],
  frame: ['Frame', 'Drag on the canvas to draw a frame, or click for a starting size.'],
  rect: ['Rectangle', 'Drag on the canvas to draw · Hold Shift for a square'],
  ellipse: ['Ellipse', 'Drag on the canvas to draw · Hold Shift for a circle'],
  text: ['Text', 'Click the canvas to add text. Double-click it to edit in the inspector.'],
  image: ['Image', 'Choose artwork from the library, or drag on the canvas to place an image.'],
  hand: ['Pan', 'Drag anywhere in the workspace to look around. Fit canvas brings it back.'],
};

export function EditorScreen({ fileId }: { fileId?: string }) {
  const p = usePictorT();
  const doc = useDocument();
  const [panel, setPanel] = useState('layers');
  const [insertRequest, setInsertRequest] = useState(0);
  const [insertCategory, setInsertCategory] = useState<'components' | 'art'>('components');
  const [showLeft, setShowLeft] = useState(() => window.innerWidth > 700);
  const [showRight, setShowRight] = useState(() => window.innerWidth > 980);
  const [exportOpen, setExportOpen] = useState(false);
  const [presentOpen, setPresentOpen] = useState(false);
  useEffect(() => { if (fileId && fileId !== doc.fileId) doc.openFile(fileId); }, [fileId, doc]);
  const insert = (category: 'components' | 'art' = 'components') => { setInsertCategory(category); setInsertRequest(value => value + 1); setPanel('insert'); setShowLeft(true); };
  useEffect(() => {
    const exporting = () => setExportOpen(true), presenting = () => setPresentOpen(true), inserting = () => insert();
    window.addEventListener('pictor:export', exporting); window.addEventListener('pictor:present', presenting); window.addEventListener('pictor:insert', inserting);
    return () => { window.removeEventListener('pictor:export', exporting); window.removeEventListener('pictor:present', presenting); window.removeEventListener('pictor:insert', inserting); };
  }, []);
  const keyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    if (exportOpen || presentOpen) return;
    if (event.nativeEvent.composedPath().some(target => target instanceof HTMLElement && (target.matches('input,textarea,select,[contenteditable="true"],md-text-field,md-number-field,md-select,md-color-picker,md-slider') || target.isContentEditable))) return;
    const key = event.key.toLowerCase(), command = event.metaKey || event.ctrlKey;
    if (command && key === 'z') { event.preventDefault(); event.shiftKey ? doc.redo() : doc.undo(); return; }
    if (command && key === 'd') { event.preventDefault(); doc.duplicate(); return; }
    if (command && key === 'a') { event.preventDefault(); const visible = visibleLayers(doc.layers), locked = lockedLayers(doc.layers); doc.select(doc.layers.filter(layer => visible.has(layer.id) && !locked.has(layer.id)).map(layer => layer.id)); return; }
    if (command || event.altKey) return;
    if (key === 'escape') { doc.clearSelection(); doc.setTool('select'); return; }
    if (key === 'delete' || key === 'backspace') { if (doc.selection.length) { event.preventDefault(); doc.remove(); } return; }
    const modes: Record<string, ToolMode> = { v: 'select', f: 'frame', r: 'rect', o: 'ellipse', t: 'text', i: 'image', h: 'hand' };
    if (modes[key]) { doc.setTool(modes[key]); return; }
    if (key.startsWith('arrow') && doc.selection.length && !(event.target as HTMLElement).closest('button,md-icon-button,md-toolbar,[role="treeitem"]')) { event.preventDefault(); const step = event.shiftKey ? 5 : 1; doc.commitLayers('move', layers => { const locked = lockedLayers(layers); const ids = new Set(doc.selection); doc.selection.forEach(id => descendantIds(layers, id).forEach(child => ids.add(child))); const moved = layers.filter(layer => ids.has(layer.id) && !locked.has(layer.id)); if (!moved.length) return layers; let dx = key === 'arrowleft' ? -step : key === 'arrowright' ? step : 0, dy = key === 'arrowup' ? -step : key === 'arrowdown' ? step : 0; dx = Math.max(-Math.min(...moved.map(layer => layer.rect.x)), Math.min(48 - Math.max(...moved.map(layer => layer.rect.x + layer.rect.w)), dx)); dy = Math.max(-Math.min(...moved.map(layer => layer.rect.y)), Math.min(32 - Math.max(...moved.map(layer => layer.rect.y + layer.rect.h)), dy)); return layers.map(layer => moved.includes(layer) ? { ...layer, rect: { ...layer.rect, x: layer.rect.x + dx, y: layer.rect.y + dy } } : layer); }); }
  };
  const file = fileById(doc.fileId);
  if (fileId && !fileById(fileId) || !file) return <NotFoundScreen />;
  return <Screen title={file.name} subtitle={p("An idea becomes a composition. Make something unmistakably yours.")} crumbLabel={file.name} aside={<div className="studio-save-status" data-save-status={doc.saveStatus}><span className="material-symbols-outlined" aria-hidden="true">{doc.saveStatus === 'saved' ? 'cloud_done' : doc.saveStatus === 'unavailable' ? 'cloud_off' : 'edit'}</span>{doc.saveStatus === 'saved' ? p("Saved on this device") : doc.saveStatus === 'unavailable' ? p("Device storage unavailable") : p("Saving your changes…")}</div>}>
    <div className="editor studio-editor" data-editor data-left={showLeft ? 'open' : 'closed'} data-right={showRight ? 'open' : 'closed'} onKeyDown={keyboard} tabIndex={-1}>
      <div className="editor__toolbar"><Toolbar onInsert={insert} onExport={() => setExportOpen(true)} onPresent={() => setPresentOpen(true)} onLayers={() => setShowLeft(value => !value)} onInspector={() => setShowRight(value => !value)} /><div className="studio-tool-hint" role="status"><strong>{p(toolHelp[doc.tool][0])}</strong><span>{p(toolHelp[doc.tool][1])}</span></div></div>
      <aside className="editor__tree studio-left-panel"><PanelTabs label={p("Studio panels")} value={panel} onValue={setPanel} options={[{ value: 'layers', label: p("Layers") }, { value: 'insert', label: p("Insert") }, { value: 'history', label: p("History") }]} />{panel === 'layers' ? <LayerTree /> : panel === 'insert' ? <InsertPanel key={insertRequest} category={insertCategory} /> : <HistoryPanel />}</aside>
      <div className="editor__canvas"><Canvas onInspect={() => setShowRight(true)} /></div>
      <aside className="editor__inspector"><Inspector /></aside>
      <div className="studio-statusbar"><span><span className="pictor-live-dot" /> {doc.selection.length ? p("{count} selected", { count: doc.selection.length }) : p("Your next move starts here")}</span><span>{p("{count} layers", { count: doc.layers.length })}<span className="studio-statusbar__separator">·</span> 960 × 640 <span className="studio-statusbar__separator">·</span>  {p("20 px snap")}</span><button onClick={() => { setPanel('history'); setShowLeft(true); }}><span className="material-symbols-outlined" aria-hidden="true">history</span> {p("{count} edits", { count: doc.history.entries.length })}</button></div>
    </div>
    <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} />
    <StudioDialog open={presentOpen} onClose={() => setPresentOpen(false)} title={p("Your idea, center stage")} fullscreen actions={<md-button variant="filled" icon="close" data-close-present onClick={() => setPresentOpen(false)}>{p("Back to studio")}</md-button>}><div className="studio-presentation"><div className="studio-presentation__intro"><span className="pictor-eyebrow">{p("THE FINISHED PICTURE")}</span><p>{p("Live AWC controls are interactive here. Try a button, field or switch.")}</p></div><Canvas presentation /></div></StudioDialog>
  </Screen>;
}
