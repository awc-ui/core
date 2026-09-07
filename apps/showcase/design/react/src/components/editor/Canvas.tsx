import { useT as usePictorT } from '@/lib/showcase';
import { useEffect, useMemo, useRef, useState, type PointerEvent as Pointer } from 'react';
import { CANVAS_COLS, CANVAS_ROWS, clampRect, descendantIds, getAssets, lockedLayers, marqueeHits, visibleLayers, zOrder, zoomPercent, type Layer, type Rect } from '@awc-ui/showcase-kit/design';
import { useDocument } from '@/lib/document';
import { colorOf, createLayer, ORB_ART, textLayout } from '@/lib/editor-model';
import { useT } from '@/lib/showcase';
import './canvas-interactions.css';

function LiveControl({ layer, presentation }: { layer: Layer; presentation: boolean }) {
  const p = usePictorT();
  const [activated, setActivated] = useState(false);
  if (layer.componentId === 'awc:button') return <md-button variant="filled" icon={activated ? 'check' : 'arrow_forward'} onClick={() => presentation && setActivated(v => !v)}>{activated ? p("You made it happen!") : layer.name}</md-button>;
  if (layer.componentId === 'awc:text-field') return <md-text-field variant="outlined" label={layer.name} placeholder={p("Try typing here…")} />;
  if (layer.componentId === 'awc:switch') return <div className="live-switch"><span>{layer.name}</span><md-switch aria-label={layer.name} icons /></div>;
  return <md-card variant="filled"><span className="live-card__eyebrow">{p("MADE OF POSSIBILITIES")}</span><strong>{layer.name}</strong><p>{p("A real component. Ready for your next idea.")}</p><md-button variant="tonal" onClick={() => presentation && setActivated(v => !v)}>{activated ? p("Nice work!") : p("Explore more")}</md-button></md-card>;
}

export function LayerPaint({ layer, presentation = false }: { layer: Layer; presentation?: boolean }) {
  const t = useT();
  const fill = colorOf(layer.fill, 'none');
  if (layer.componentId?.startsWith('awc:')) return <div className="layer__live" data-live={presentation ? '' : undefined}><LiveControl layer={layer} presentation={presentation} /></div>;
  if (layer.art) {
    let picture = <img src={layer.art.src} alt={layer.art.altKey ? t(layer.art.altKey) : layer.name} draggable={false} />;
    for (const adjustment of layer.adjustments) picture = <span data-adj={adjustment.kind} data-v={String(adjustment.value)}>{picture}</span>;
    return <div className="layer__image">{picture}</div>;
  }
  if (layer.kind === 'group') return null;
  const width = layer.rect.w * 20, height = layer.rect.h * 20;
  const label = layer.textKey ? t(layer.textKey) : layer.name;
  const text = textLayout(layer, label);
  return <svg className="layer__paint" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
    {layer.kind === 'text' ? <text x="0" y={text.top} fill={fill} fontSize={text.size} fontFamily="Arial, sans-serif" fontWeight="600">{text.lines.map((line, i) => <tspan key={i} x="0" dy={i ? text.lineHeight : 0}>{line}</tspan>)}</text> : layer.kind === 'ellipse' ? <ellipse cx={width / 2} cy={height / 2} rx={width / 2} ry={height / 2} fill={fill} /> : <rect width={width} height={height} fill={fill} />}
  </svg>;
}

type Gesture = { mode: 'move' | 'resize' | 'draw' | 'marquee' | 'pan'; pointerId: number; startX: number; startY: number; origin: Rect; ids: string[]; rects?: Record<string, Rect>; corner?: string; layer?: Layer; scrollX?: number; scrollY?: number; moved?: boolean };
const attrs = (rect: Rect) => ({ 'data-x': String(rect.x), 'data-y': String(rect.y), 'data-w': String(rect.w), 'data-h': String(rect.h) });

export function Canvas({ presentation = false, onInspect }: { presentation?: boolean; onInspect?: () => void }) {
  const p = usePictorT();
  const doc = useDocument();
  const board = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const previewRef = useRef<Record<string, Rect>>({});
  const [preview, setPreview] = useState<Record<string, Rect>>({});
  const [box, setBox] = useState<Rect | null>(null);
  const [drawing, setDrawing] = useState<Layer | null>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const visible = useMemo(() => visibleLayers(doc.layers), [doc.layers]);
  const locked = useMemo(() => lockedLayers(doc.layers), [doc.layers]);
  const painted = useMemo(() => zOrder(doc.layers), [doc.layers]);
  const updatePreview = (next: Record<string, Rect>) => { previewRef.current = next; setPreview(next); };
  const cellAt = (event: { clientX: number; clientY: number }) => {
    const rect = board.current?.getBoundingClientRect();
    const cell = rect ? rect.width / 48 : 14;
    return { x: Math.max(0, Math.min(47, Math.floor((event.clientX - (rect?.left ?? 0)) / cell))), y: Math.max(0, Math.min(31, Math.floor((event.clientY - (rect?.top ?? 0)) / cell))) };
  };
  const inspectAt = (event: { clientX: number; clientY: number }) => {
    if (presentation || doc.tool !== 'select') return;
    // Pointer capture sends double-clicks to the viewport; resolve the
    // frontmost painted layer at the pointer instead of relying on its target.
    const bounds = board.current?.getBoundingClientRect();
    if (!bounds?.width || !bounds.height || event.clientX < bounds.left || event.clientY < bounds.top || event.clientX >= bounds.right || event.clientY >= bounds.bottom) return;
    const x = (event.clientX - bounds.left) * CANVAS_COLS / bounds.width;
    const y = (event.clientY - bounds.top) * CANVAS_ROWS / bounds.height;
    const hit = [...painted].reverse().find(layer => visible.has(layer.id) && layer.kind !== 'group' && x >= layer.rect.x && y >= layer.rect.y && x < layer.rect.x + layer.rect.w && y < layer.rect.y + layer.rect.h);
    if (hit?.kind === 'text' && !locked.has(hit.id)) { doc.select([hit.id]); onInspect?.(); }
  };
  const clearGesture = () => {
    const active = gesture.current;
    gesture.current = null;
    setDrawing(null); setBox(null); updatePreview({});
    if (active && viewport.current?.hasPointerCapture(active.pointerId)) viewport.current.releasePointerCapture(active.pointerId);
  };
  const capture = (event: Pointer, next: Omit<Gesture, 'pointerId'>) => {
    updatePreview({});
    gesture.current = { ...next, pointerId: event.pointerId };
    viewport.current?.setPointerCapture(event.pointerId);
    event.preventDefault();
  };
  const down = (event: Pointer, layer?: Layer, corner?: string) => {
    if (presentation || gesture.current || (event.button !== 0 && event.button !== 1)) return;
    board.current?.focus({ preventScroll: true });
    const at = cellAt(event);
    if (doc.tool === 'hand' || event.button === 1) {
      event.stopPropagation();
      capture(event, { mode: 'pan', startX: event.clientX, startY: event.clientY, origin: { ...at, w: 1, h: 1 }, ids: [], scrollX: viewport.current?.scrollLeft ?? 0, scrollY: viewport.current?.scrollTop ?? 0 }); return;
    }
    if (layer && doc.tool === 'select') {
      event.stopPropagation();
      if (locked.has(layer.id)) { if (layer.rect.w === 48 && layer.rect.h === 32) down(event); return; }
      // Dragging a member of an already-selected group moves that group.
      // Shift still targets the member so it can join a separate selection.
      if (!corner && !event.shiftKey && !doc.selection.includes(layer.id)) {
        const memberId = layer.id;
        const selectedGroup = doc.layers.find(item => item.kind === 'group' && doc.selection.includes(item.id) && descendantIds(doc.layers, item.id).has(memberId));
        if (selectedGroup) layer = selectedGroup;
      }
      if (event.shiftKey && !corner && doc.selection.includes(layer.id)) {
        doc.toggleInSelection(layer.id); event.preventDefault(); return;
      }
      const ids = event.shiftKey ? [...new Set([...doc.selection, layer.id])] : doc.selection.includes(layer.id) ? [...doc.selection] : [layer.id];
      doc.select(ids);
      const moved = new Set(ids); ids.forEach(id => descendantIds(doc.layers, id).forEach(child => moved.add(child)));
      const affected = corner
        ? layer.kind === 'group' ? [layer.id, ...descendantIds(doc.layers, layer.id)].filter(id => !locked.has(id)) : [layer.id]
        : [...moved].filter(id => !locked.has(id));
      capture(event, { mode: corner ? 'resize' : 'move', startX: event.clientX, startY: event.clientY, origin: layer.rect, ids: affected, rects: Object.fromEntries(doc.layers.filter(item => affected.includes(item.id)).map(item => [item.id, item.rect])), corner }); return;
    }
    if (layer) return;
    if (!event.shiftKey || doc.tool !== 'select') doc.clearSelection();
    if (doc.tool === 'select') {
      capture(event, { mode: 'marquee', startX: event.clientX, startY: event.clientY, origin: { ...at, w: 1, h: 1 }, ids: event.shiftKey ? [...doc.selection] : [] }); setBox({ ...at, w: 1, h: 1 });
    } else {
      const kind = doc.tool;
      const art = kind === 'image' ? getAssets().find(asset => asset.kind === 'image')?.art ?? ORB_ART : null;
      const layer = createLayer(kind, { ...at, w: 1, h: 1 }, { art, name: kind === 'text' ? p("Your next big idea") : kind === 'image' ? p("Image") : `${p(kind[0].toUpperCase() + kind.slice(1))} ${doc.layers.length + 1}` });
      capture(event, { mode: 'draw', startX: event.clientX, startY: event.clientY, origin: layer.rect, ids: [], layer }); setDrawing(layer);
    }
  };
  const move = (event: Pointer) => {
    if (presentation) return;
    const at = cellAt(event); setPosition(at);
    const active = gesture.current;
    if (!active || event.pointerId !== active.pointerId) return;
    if (active.mode === 'pan') { if (viewport.current) { viewport.current.scrollLeft = (active.scrollX ?? 0) - event.clientX + active.startX; viewport.current.scrollTop = (active.scrollY ?? 0) - event.clientY + active.startY; } return; }
    if (!active.moved && Math.hypot(event.clientX - active.startX, event.clientY - active.startY) < 3) return;
    active.moved = true;
    const cell = (board.current?.getBoundingClientRect().width ?? 672) / 48;
    let dx = Math.round((event.clientX - active.startX) / cell), dy = Math.round((event.clientY - active.startY) / cell);
    if (active.mode === 'move') {
      const members = Object.entries(active.rects ?? {}).map(([id, rect]) => ({ id, rect }));
      if (!members.length) return;
      dx = Math.max(-Math.min(...members.map(l => l.rect.x)), Math.min(48 - Math.max(...members.map(l => l.rect.x + l.rect.w)), dx));
      dy = Math.max(-Math.min(...members.map(l => l.rect.y)), Math.min(32 - Math.max(...members.map(l => l.rect.y + l.rect.h)), dy));
      updatePreview(Object.fromEntries(members.map(layer => [layer.id, { ...layer.rect, x: layer.rect.x + dx, y: layer.rect.y + dy }])));
    } else if (active.mode === 'resize') {
      const r = active.origin; const west = active.corner?.includes('w'), north = active.corner?.includes('n');
      const x = west ? Math.max(0, Math.min(r.x + r.w - 1, r.x + dx)) : r.x;
      const y = north ? Math.max(0, Math.min(r.y + r.h - 1, r.y + dy)) : r.y;
      const w = west ? r.x + r.w - x : Math.max(1, Math.min(48 - x, r.w + dx));
      const h = north ? r.y + r.h - y : Math.max(1, Math.min(32 - y, r.h + dy));
      let resized = clampRect({ x, y, w, h });
      if (event.shiftKey) {
        const changeX = (west ? -dx : dx) / r.w, changeY = (north ? -dy : dy) / r.h;
        const scale = Math.max(Math.max(1 / r.w, 1 / r.h), Math.min(
          1 + (Math.abs(changeX) >= Math.abs(changeY) ? changeX : changeY),
          (west ? r.x + r.w : CANVAS_COLS - r.x) / r.w,
          (north ? r.y + r.h : CANVAS_ROWS - r.y) / r.h,
        ));
        const width = Math.max(1, Math.round(r.w * scale)), height = Math.max(1, Math.round(r.h * scale));
        resized = clampRect({ x: west ? r.x + r.w - width : r.x, y: north ? r.y + r.h - height : r.y, w: width, h: height });
      }
      updatePreview(Object.fromEntries(active.ids.map(id => {
        const origin = active.rects?.[id] ?? r;
        return [id, id === active.ids[0] ? resized : clampRect({
          x: resized.x + (origin.x - r.x) * resized.w / r.w,
          y: resized.y + (origin.y - r.y) * resized.h / r.h,
          w: origin.w * resized.w / r.w, h: origin.h * resized.h / r.h,
        })];
      })));
    } else {
      let w = Math.abs(at.x - active.origin.x) + 1, h = Math.abs(at.y - active.origin.y) + 1;
      if (event.shiftKey && active.mode === 'draw') w = h = Math.min(w, h);
      const rect = clampRect({ x: at.x < active.origin.x ? active.origin.x - w + 1 : active.origin.x, y: at.y < active.origin.y ? active.origin.y - h + 1 : active.origin.y, w, h });
      setBox(rect); previewRef.current = { marquee: rect };
      if (active.layer) setDrawing({ ...active.layer, rect });
    }
  };
  const up = (event: Pointer, cancel = false) => {
    const active = gesture.current;
    if (!active || event.pointerId !== active.pointerId) return;
    if (!cancel && active.mode === 'draw' && active.layer) {
      const raw = previewRef.current.marquee;
      const rect = raw ?? clampRect({ ...active.origin, w: active.layer.kind === 'text' ? 18 : 12, h: active.layer.kind === 'text' ? 4 : 10 });
      const layer = { ...active.layer, rect };
      doc.commitLayers('create', layers => [...layers, layer], [layer.id]); doc.setTool('select');
    } else if (!cancel && active.mode === 'marquee' && previewRef.current.marquee) {
      doc.select([...new Set([...active.ids, ...marqueeHits(doc.layers, previewRef.current.marquee)])]);
    } else if (!cancel && (active.mode === 'move' || active.mode === 'resize')) {
      const next = previewRef.current;
      if (Object.keys(next).length) doc.commitLayers(active.mode, layers => layers.map(layer => next[layer.id] && JSON.stringify(next[layer.id]) !== JSON.stringify(layer.rect) ? { ...layer, rect: next[layer.id] } : layer));
    }
    clearGesture();
  };
  useEffect(() => {
    if (presentation) return;
    const fit = () => {
      clearGesture();
      const rect = viewport.current?.getBoundingClientRect(); if (!rect) return;
      const values = [50, 75, 100, 150, 200];
      const suitable = values.reduce((best, scale, i) => 672 * scale / 100 < rect.width - 65 && 448 * scale / 100 < rect.height - 70 ? i : best, 0);
      const diff = suitable - doc.zoomIndex; for (let i = 0; i < Math.abs(diff); i++) diff > 0 ? doc.zoomIn() : doc.zoomOut();
      requestAnimationFrame(() => {
        const scroller = viewport.current; if (!scroller) return;
        scroller.scrollLeft = (scroller.scrollWidth - scroller.clientWidth) / 2;
        scroller.scrollTop = (scroller.scrollHeight - scroller.clientHeight) / 2;
      });
    };
    window.addEventListener('pictor:fit', fit);
    return () => window.removeEventListener('pictor:fit', fit);
  }, [doc, presentation]);

  useEffect(() => {
    if (presentation) return;
    const frame = requestAnimationFrame(() => window.dispatchEvent(new Event('pictor:fit')));
    return () => cancelAnimationFrame(frame);
  }, [presentation, doc.fileId]);

  useEffect(() => { clearGesture(); }, [doc.tool, doc.fileId, doc.zoomIndex]);

  return <div className="pictor-canvas" data-presentation={presentation || undefined}>
    <div className="pictor-canvas__label"><span><span className="pictor-live-dot" />{presentation ? p("INTERACTIVE PREVIEW") : p("ARTBOARD 01")}</span><span>{p("960 × 640 · RGB")}</span></div>
    <div ref={viewport} className="canvas-scroll" onDoubleClick={inspectAt} data-pan-active={gesture.current?.mode === 'pan' || undefined} onPointerDown={event => { if (doc.tool === 'hand' || event.button === 1) down(event); }} onPointerMove={move} onPointerUp={event => up(event)} onPointerCancel={event => up(event, true)} onLostPointerCapture={event => up(event, true)} onKeyDown={event => { if (event.key === 'Escape' && gesture.current) { clearGesture(); event.stopPropagation(); } }}>
      <div className="canvas-workspace">
      <div className="canvas-frame" data-zoom={String(zoomPercent(doc.zoomIndex))}>
        <div className="ruler ruler--x" aria-hidden="true">{Array.from({ length: 12 }, (_, i) => <span key={i}>{i * 80}</span>)}</div>
        <div ref={board} className="artboard" tabIndex={presentation ? undefined : 0} data-artboard data-zoom={String(presentation ? 100 : zoomPercent(doc.zoomIndex))} data-grid={!presentation && doc.showGrid ? '' : undefined} data-tool={doc.tool} role={presentation ? 'region' : 'application'} aria-label={presentation ? p("Interactive design preview") : p("Design canvas. Select a tool or layer, drag to draw or move, use corner handles to resize.")} onPointerDown={event => down(event)}>
          {painted.filter(layer => visible.has(layer.id)).map(layer => {
            const shown = preview[layer.id] ? { ...layer, rect: preview[layer.id] } : layer;
            return <div key={layer.id} className="layer" {...attrs(shown.rect)} data-layer={layer.id} data-kind={layer.kind} data-opacity={String(layer.opacity)} data-blend={layer.blend} data-masked={layer.masked ? '' : undefined} data-locked={locked.has(layer.id) || undefined} data-selected={!presentation && doc.selection.includes(layer.id) ? '' : undefined} aria-label={layer.name} onPointerDown={event => down(event, layer)}><LayerPaint layer={shown} presentation={presentation} /></div>;
          })}
          {!presentation && drawing ? <div className="layer layer--drawing" {...attrs(drawing.rect)} data-kind={drawing.kind}><LayerPaint layer={drawing} /></div> : null}
          {!presentation && box && !drawing ? <div className="marquee" {...attrs(box)} /> : null}
          {!presentation && doc.selection.map(id => { const layer = doc.layers.find(l => l.id === id); if (!layer || !visible.has(id) || locked.has(id)) return null; const rect = preview[id] ?? layer.rect; return <div key={id} className="selection-box" {...attrs(rect)}><span className="selection-box__size">{rect.w * 20} × {rect.h * 20}</span>{doc.selection.length === 1 ? ['nw', 'ne', 'sw', 'se'].map(corner => <button key={corner} className="resize-handle" data-corner={corner} aria-label={p("Resize {name} from {corner}", { name: layer.name, corner: p(({nw:'Top left',ne:'Top right',sw:'Bottom left',se:'Bottom right'} as Record<string,string>)[corner]) })} onPointerDown={event => { event.stopPropagation(); down(event, layer, corner); }} />) : null}</div>; })}
        </div>
      </div>
      </div>
    </div>
    {!presentation ? <div className="pictor-canvas__foot"><span>{doc.tool === 'select' ? p("Drag to move · Shift-click to add/remove · Corners to resize · Shift-resize keeps proportions") : doc.tool === 'hand' ? p("Drag anywhere to pan · Fit recenters the artboard") : doc.tool === 'image' ? p("Choose Artwork in Insert, or drag to place a sample image") : p("Click to add a {tool}, or drag to size it · Shift for equal sides", { tool: p('design.layerKind.'+doc.tool) })}</span><span>{p("X {value} · Y {value2}", { value: position.x * 20, value2: position.y * 20 })}</span></div> : null}
  </div>;
}
