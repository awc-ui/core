import { translateUi as p } from '../context';
import { dom, Fragment } from '../dom';
import { field, calculate } from '../context';
import { canRedo, canUndo, zoomPercent, type ToolMode } from '@awc-ui/showcase-kit/design';
import { getDocument } from '../context';

const TOOLS: { tool: ToolMode; icon: string; label: string; shortcut: string }[] = [
  { tool: 'select', icon: 'near_me', label: 'Select and move', shortcut: 'V' },
  { tool: 'frame', icon: 'crop_free', label: 'Frame', shortcut: 'F' },
  { tool: 'rect', icon: 'rectangle', label: 'Rectangle', shortcut: 'R' },
  { tool: 'ellipse', icon: 'circle', label: 'Ellipse', shortcut: 'O' },
  { tool: 'text', icon: 'title', label: 'Text', shortcut: 'T' },
  { tool: 'image', icon: 'image', label: 'Insert artwork', shortcut: 'I' },
  { tool: 'hand', icon: 'pan_tool', label: 'Pan', shortcut: 'H' },
];
export function Toolbar({ onInsert, onExport, onPresent, onLayers, onInspector }: { onInsert(category?: 'components' | 'art'): void; onExport(): void; onPresent(): void; onLayers(): void; onInspector(): void }) {
  const doc = getDocument();
  return <md-toolbar class="toolbar studio-toolbar" variant="floating" aria-label={p("Canvas editing tools")} density={-2}>
    <div className="toolbar__group"><md-icon-button icon="left_panel_open" aria-label={p("Toggle layers panel")} onClick={onLayers} /><md-icon-button icon="add_circle" aria-label={p("Insert assets and live components")} onClick={() => onInsert('components')} /></div>
    <div className="toolbar__group" role="group" aria-label={p("Drawing tools")}>{TOOLS.map(({ tool, icon, label, shortcut }) => <md-icon-button key={tool} icon={icon} aria-label={`${p(label)} (${shortcut})`} title={`${p(label)} · ${shortcut}`} aria-pressed={doc.tool === tool} data-tool={tool} data-active={doc.tool === tool ? '' : undefined} onClick={() => { doc.setTool(tool); if (tool === 'image') onInsert('art'); }} />)}</div>
    <div className="toolbar__group"><md-icon-button icon="undo" aria-label={p("Undo (⌘Z)")} data-undo disabled={!canUndo(doc.history) || undefined} onClick={() => doc.undo()} /><md-icon-button icon="redo" aria-label={p("Redo (⌘⇧Z)")} data-redo disabled={!canRedo(doc.history) || undefined} onClick={() => doc.redo()} /></div>
    <span className="toolbar__spacer" />
    <div className="toolbar__group toolbar__view"><md-icon-button icon="grid_4x4" aria-label={p("Toggle grid")} aria-pressed={doc.showGrid} data-grid-toggle onClick={() => doc.toggleGrid()} /><md-icon-button icon="zoom_out" aria-label={p("Zoom out")} data-zoom-out disabled={doc.zoomIndex === 0 || undefined} onClick={() => doc.zoomOut()} /><button className="studio-zoom" aria-label={p("Fit and center canvas")} title={p("Fit and center canvas")} onClick={() => window.dispatchEvent(new Event('pictor:fit'))}>{zoomPercent(doc.zoomIndex)}% <span>⌄</span></button><md-icon-button icon="zoom_in" aria-label={p("Zoom in")} data-zoom-in disabled={doc.zoomIndex === 4 || undefined} onClick={() => doc.zoomIn()} /></div>
    <div className="toolbar__group"><md-icon-button icon="right_panel_open" aria-label={p("Toggle inspector")} onClick={onInspector} /><md-icon-button icon="play_arrow" aria-label={p("Present design")} data-present onClick={onPresent} /><md-button variant="filled" icon="download" data-export onClick={onExport}>{p("Export")}</md-button></div>
  </md-toolbar>;
}
