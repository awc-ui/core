import { translateUi as p } from '../context';
import { dom, Fragment } from '../dom';
import { field, calculate } from '../context';
import { fileById } from '@awc-ui/showcase-kit/design';
import { getDocument } from '../context';
import { documentSvg, downloadDocument } from '@awc-ui/pictor-model';
import { getTranslator } from '../context';
import { SelectControl, StudioDialog, ToggleControl } from '../controls';

export function ExportDialog({ open, onClose }: { open: boolean; onClose(): void }) {
  const doc = getDocument();
  const t = getTranslator();
  const [format, setFormat] = field('ExportDialog:format', 'svg');
  const [scale, setScale] = field('ExportDialog:scale', '1');
  const [background, setBackground] = field('ExportDialog:background', false);
  const [busy, setBusy] = field('ExportDialog:busy', false);
  const [message, setMessage] = field('ExportDialog:message', '');
  const download = async () => { setBusy(true); setMessage(''); try { await downloadDocument(doc.layers, t, format as 'svg' | 'png' | 'json', fileById(doc.fileId)?.name ?? p("Pictor design"), Number(scale), background); setMessage("Your file is ready. Check your downloads."); } catch (error) { setMessage(error instanceof Error ? error.message : "Export failed. Please try SVG."); } finally { setBusy(false); } };
  return <StudioDialog open={open} onClose={onClose} title={p("Made by you. Ready for the world.")} actions={<><md-button variant="text" onClick={onClose}>{p("Back to canvas")}</md-button><md-button variant="filled" icon="download" data-download disabled={busy || undefined} onClick={download}>{busy ? p("Preparing…") : p("Download {value}", { value: format.toUpperCase() })}</md-button></>}><div className="studio-export" data-export-dialog><div className="studio-export__preview"><img src={`data:image/svg+xml,${encodeURIComponent(documentSvg(doc.layers, t, { background }))}`} alt={p("Export preview")} /></div><div className="studio-export__settings"><SelectControl label={p("File format")} data-export-format value={format} onValue={value => { setFormat(value); setMessage(''); }} options={[{ value: 'svg', label: p("SVG · Scalable vector") }, { value: 'png', label: p("PNG · Ready to share") }, { value: 'json', label: p("JSON · Editable document data") }]} />{format !== 'json' ? <><SelectControl label={p("Resolution")} value={scale} onValue={setScale} options={[{ value: '1', label: '1× · 960 × 640' }, { value: '2', label: '2× · 1920 × 1280' }, { value: '3', label: '3× · 2880 × 1920' }]} /><ToggleControl selected={background} onValue={setBackground} label={p("Add white background")} /></> : null}<p className="studio-description">{format === 'json' ? p("Preserves the complete layer model, including geometry, colors and component references.") : p("Exports visible layers and embedded artwork. Live controls become static vector representations; image adjustments and blend effects are simplified.")}</p><div role="status" className="studio-export__message">{p(message)}</div></div></div></StudioDialog>;
}
