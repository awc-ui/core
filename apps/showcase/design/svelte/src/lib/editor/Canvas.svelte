<script lang="ts">
import {t} from '$lib/showcase';

import {onMount,onDestroy} from 'svelte';
import {CANVAS_COLS,CANVAS_ROWS,clampRect,descendantIds,getAssets,lockedLayers,marqueeHits,visibleLayers,zOrder,zoomPercent,type Layer,type Rect} from '@awc-ui/showcase-kit/design';
import {createLayer,ORB_ART} from '@awc-ui/pictor-model';
import {document} from '$lib/document';
import LayerPaint from './LayerPaint.svelte';
export let presentation=false;export let onInspect:()=>void=undefined;
type Gesture={mode:'move'|'resize'|'draw'|'marquee'|'pan';pointerId:number;startX:number;startY:number;origin:Rect;ids:string[];rects?:Record<string,Rect>;corner?:string;layer?:Layer;scrollX?:number;scrollY?:number;moved?:boolean};
const attrs=(rect:Rect)=>({'data-x':String(rect.x),'data-y':String(rect.y),'data-w':String(rect.w),'data-h':String(rect.h)});
let board:HTMLDivElement,viewport:HTMLDivElement,gesture:Gesture|null=null,previewRef:Record<string,Rect>={};
let preview:Record<string,Rect>={},box:Rect|null=null,drawing:Layer|null=null,position={x:0,y:0};
const setPreview=(value:Record<string,Rect>)=>preview=value;
const setBox=(value:Rect|null)=>box=value;
const setDrawing=(value:Layer|null)=>drawing=value;
const setPosition=(value:{x:number;y:number})=>position=value;
$: visible=visibleLayers($document.layers);$: locked=lockedLayers($document.layers);$: painted=zOrder($document.layers);
  const updatePreview = (next: Record<string, Rect>) => { previewRef = next; setPreview(next); };
  const cellAt = (event: { clientX: number; clientY: number }) => {
    const rect = board?.getBoundingClientRect();
    const cell = rect ? rect.width / 48 : 14;
    return { x: Math.max(0, Math.min(47, Math.floor((event.clientX - (rect?.left ?? 0)) / cell))), y: Math.max(0, Math.min(31, Math.floor((event.clientY - (rect?.top ?? 0)) / cell))) };
  };
  const clearGesture = () => {
    const active = gesture;
    gesture = null;
    setDrawing(null); setBox(null); updatePreview({});
    if (active && viewport?.hasPointerCapture(active.pointerId)) viewport.releasePointerCapture(active.pointerId);
  };
  const capture = (event: PointerEvent, next: Omit<Gesture, 'pointerId'>) => {
    updatePreview({});
    gesture = { ...next, pointerId: event.pointerId };
    viewport?.setPointerCapture(event.pointerId);
    event.preventDefault();
  };
  const down = (event: PointerEvent, layer?: Layer, corner?: string) => {
    if (presentation || gesture || (event.button !== 0 && event.button !== 1)) return;
    board?.focus({ preventScroll: true });
    const at = cellAt(event);
    if ($document.tool === 'hand' || event.button === 1) {
      event.stopPropagation();
      capture(event, { mode: 'pan', startX: event.clientX, startY: event.clientY, origin: { ...at, w: 1, h: 1 }, ids: [], scrollX: viewport?.scrollLeft ?? 0, scrollY: viewport?.scrollTop ?? 0 }); return;
    }
    if (layer && $document.tool === 'select') {
      event.stopPropagation();
      if (locked.has(layer.id)) { if (layer.rect.w === 48 && layer.rect.h === 32) down(event); return; }
      // Dragging a member of an already-selected group moves that group.
      // Shift still targets the member so it can join a separate selection.
      if (!corner && !event.shiftKey && !$document.selection.includes(layer.id)) {
        const memberId = layer.id;
        const selectedGroup = $document.layers.find(item => item.kind === 'group' && $document.selection.includes(item.id) && descendantIds($document.layers, item.id).has(memberId));
        if (selectedGroup) layer = selectedGroup;
      }
      if (event.shiftKey && !corner && $document.selection.includes(layer.id)) {
        $document.toggleInSelection(layer.id); event.preventDefault(); return;
      }
      const ids = event.shiftKey ? [...new Set([...$document.selection, layer.id])] : $document.selection.includes(layer.id) ? [...$document.selection] : [layer.id];
      $document.select(ids);
      const moved = new Set(ids); ids.forEach(id => descendantIds($document.layers, id).forEach(child => moved.add(child)));
      const affected = corner
        ? layer.kind === 'group' ? [layer.id, ...descendantIds($document.layers, layer.id)].filter(id => !locked.has(id)) : [layer.id]
        : [...moved].filter(id => !locked.has(id));
      capture(event, { mode: corner ? 'resize' : 'move', startX: event.clientX, startY: event.clientY, origin: layer.rect, ids: affected, rects: Object.fromEntries($document.layers.filter(item => affected.includes(item.id)).map(item => [item.id, item.rect])), corner }); return;
    }
    if (layer) return;
    if (!event.shiftKey || $document.tool !== 'select') $document.clearSelection();
    if ($document.tool === 'select') {
      capture(event, { mode: 'marquee', startX: event.clientX, startY: event.clientY, origin: { ...at, w: 1, h: 1 }, ids: event.shiftKey ? [...$document.selection] : [] }); setBox({ ...at, w: 1, h: 1 });
    } else {
      const kind = $document.tool;
      const art = kind === 'image' ? getAssets().find(asset => asset.kind === 'image')?.art ?? ORB_ART : null;
      const layer = createLayer(kind, { ...at, w: 1, h: 1 }, { art, name: kind === 'text' ? 'Your next big idea' : kind === 'image' ? 'Image' : `${kind[0].toUpperCase()}${kind.slice(1)} ${$document.layers.length + 1}` });
      capture(event, { mode: 'draw', startX: event.clientX, startY: event.clientY, origin: layer.rect, ids: [], layer }); setDrawing(layer);
    }
  };
  const move = (event: PointerEvent) => {
    if (presentation) return;
    const at = cellAt(event); setPosition(at);
    const active = gesture;
    if (!active || event.pointerId !== active.pointerId) return;
    if (active.mode === 'pan') { if (viewport) { viewport.scrollLeft = (active.scrollX ?? 0) - event.clientX + active.startX; viewport.scrollTop = (active.scrollY ?? 0) - event.clientY + active.startY; } return; }
    if (!active.moved && Math.hypot(event.clientX - active.startX, event.clientY - active.startY) < 3) return;
    active.moved = true;
    const cell = (board?.getBoundingClientRect().width ?? 672) / 48;
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
      setBox(rect); previewRef = { marquee: rect };
      if (active.layer) setDrawing({ ...active.layer, rect });
    }
  };
  const up = (event: PointerEvent, cancel = false) => {
    const active = gesture;
    if (!active || event.pointerId !== active.pointerId) return;
    if (!cancel && active.mode === 'draw' && active.layer) {
      const raw = previewRef.marquee;
      const rect = raw ?? clampRect({ ...active.origin, w: active.layer.kind === 'text' ? 18 : 12, h: active.layer.kind === 'text' ? 4 : 10 });
      const layer = { ...active.layer, rect };
      $document.commitLayers('create', layers => [...layers, layer], [layer.id]); $document.setTool('select');
    } else if (!cancel && active.mode === 'marquee' && previewRef.marquee) {
      $document.select([...new Set([...active.ids, ...marqueeHits($document.layers, previewRef.marquee)])]);
    } else if (!cancel && (active.mode === 'move' || active.mode === 'resize')) {
      const next = previewRef;
      if (Object.keys(next).length) $document.commitLayers(active.mode, layers => layers.map(layer => next[layer.id] && JSON.stringify(next[layer.id]) !== JSON.stringify(layer.rect) ? { ...layer, rect: next[layer.id] } : layer));
    }
    clearGesture();
  };

// Pointer capture retargets click/dblclick to the viewport. Resolve the
// frontmost painted layer by coordinates instead of trusting event.target.
const inspectAtPoint = (event: MouseEvent) => {
  if (presentation || $document.tool !== 'select') return;
  const bounds = board.getBoundingClientRect();
  if (!bounds.width || !bounds.height || event.clientX < bounds.left || event.clientY < bounds.top || event.clientX >= bounds.left + bounds.width || event.clientY >= bounds.top + bounds.height) return;
  const x = (event.clientX - bounds.left) * CANVAS_COLS / bounds.width;
  const y = (event.clientY - bounds.top) * CANVAS_ROWS / bounds.height;
  const visible = visibleLayers($document.layers);
  const hit = [...zOrder($document.layers)].reverse().find(layer => visible.has(layer.id) && layer.kind !== 'group' && x >= layer.rect.x && y >= layer.rect.y && x < layer.rect.x + layer.rect.w && y < layer.rect.y + layer.rect.h);
  if (hit?.kind === 'text' && !lockedLayers($document.layers).has(hit.id)) {
    $document.select([hit.id]); onInspect?.();
  }
};

const fit=()=>{
 if(presentation)return;clearGesture();const rect=viewport?.getBoundingClientRect();if(!rect)return;
 const values=[50,75,100,150,200];const suitable=values.reduce((best,scale,i)=>672*scale/100<rect.width-65&&448*scale/100<rect.height-70?i:best,0);
 const diff=suitable-$document.zoomIndex;for(let i=0;i<Math.abs(diff);i++)diff>0?$document.zoomIn():$document.zoomOut();
 requestAnimationFrame(()=>{if(!viewport)return;viewport.scrollLeft=(viewport.scrollWidth-viewport.clientWidth)/2;viewport.scrollTop=(viewport.scrollHeight-viewport.clientHeight)/2});
};
onMount(()=>{window.addEventListener('pictor:fit',fit);return()=>window.removeEventListener('pictor:fit',fit)});
let fitFrame:number;
$: currentFile=$document.fileId;$: currentTool=$document.tool;$: currentZoom=$document.zoomIndex;
function resetGesture(_tool:string,_file:string,_zoom:number){clearGesture()}
$: resetGesture(currentTool,currentFile,currentZoom);
function scheduleFit(_file:string,show:boolean){cancelAnimationFrame(fitFrame);if(!show)fitFrame=requestAnimationFrame(fit)}
$: scheduleFit(currentFile,presentation);
onDestroy(()=>{cancelAnimationFrame(fitFrame);clearGesture()});
$: cornerLabel = (corner: string) => $t(({nw:'Top left',ne:'Top right',sw:'Bottom left',se:'Bottom right'} as Record<string,string>)[corner] ?? corner);
</script>
<div class="pictor-canvas" data-presentation={presentation||undefined}>
 <div class="pictor-canvas__label"><span><span class="pictor-live-dot"/>{presentation?$t('INTERACTIVE PREVIEW'):$t('ARTBOARD 01')}</span><span>{$t('960 × 640 · RGB')}</span></div>
 <div bind:this={viewport} class="canvas-scroll" role="group" aria-label={$t('Canvas viewport')} on:dblclick={inspectAtPoint} data-pan-active={gesture?.mode==='pan'||undefined} on:pointerdown={event=>{if($document.tool==='hand'||event.button===1)down(event)}} on:pointermove={move} on:pointerup={event=>up(event)} on:pointercancel={event=>up(event,true)} on:lostpointercapture={event=>up(event,true)} on:keydown={event=>{if(event.key==='Escape'&&gesture){clearGesture();event.stopPropagation()}}}>
  <div class="canvas-workspace"><div class="canvas-frame" data-zoom={String(zoomPercent($document.zoomIndex))}>
   <div class="ruler ruler--x" aria-hidden="true">{#each Array(12) as _,i}<span>{i*80}</span>{/each}</div>
   <!-- Role switches between an editable application and a presentation region. -->
<!-- svelte-ignore a11y-no-noninteractive-tabindex -->
<div bind:this={board} class="artboard" tabindex={presentation?undefined:0} data-artboard data-zoom={String(presentation?100:zoomPercent($document.zoomIndex))} data-grid={!presentation&&$document.showGrid?'':undefined} data-tool={$document.tool} role={presentation?'region':'application'} aria-label={presentation?$t('Interactive design preview'):$t('Design canvas. Select a tool or layer, drag to draw or move, use corner handles to resize.')} on:pointerdown={event=>down(event)}>
    {#each painted.filter(layer=>visible.has(layer.id)) as layer (layer.id)}
     {@const shown=preview[layer.id]?{...layer,rect:preview[layer.id]}:layer}
     <div class="layer" role="group" {...attrs(shown.rect)} data-layer={layer.id} data-kind={layer.kind} data-opacity={String(layer.opacity)} data-blend={layer.blend} data-masked={layer.masked?'':undefined} data-locked={locked.has(layer.id)||undefined} data-selected={!presentation&&$document.selection.includes(layer.id)?'':undefined} aria-label={layer.name} on:pointerdown={event=>down(event,layer)}><LayerPaint layer={shown} {presentation}/></div>
    {/each}
    {#if !presentation&&drawing}<div class="layer layer--drawing" {...attrs(drawing.rect)} data-kind={drawing.kind}><LayerPaint layer={drawing}/></div>{/if}
    {#if !presentation&&box&&!drawing}<div class="marquee" {...attrs(box)}/>{/if}
    {#if !presentation}{#each $document.selection as id (id)}
     {@const layer=$document.layers.find(layer=>layer.id===id)}
     {#if layer&&visible.has(id)&&!locked.has(id)}
      {@const rect=preview[id]??layer.rect}
      <div class="selection-box" {...attrs(rect)}><span class="selection-box__size">{rect.w*20} × {rect.h*20}</span>{#if $document.selection.length===1}{#each ['nw','ne','sw','se'] as corner}<button class="resize-handle" data-corner={corner} aria-label={$t('Resize {name} from {corner}', {name: layer.name, corner: cornerLabel(corner)})} on:pointerdown={event=>{event.stopPropagation();down(event,layer,corner)}}/>{/each}{/if}</div>
     {/if}
    {/each}{/if}
   </div>
  </div></div>
 </div>
 {#if !presentation}<div class="pictor-canvas__foot"><span>{$document.tool==='select'?$t('Drag to move · Shift-click to add/remove · Corners to resize · Shift-resize keeps proportions'):$document.tool==='hand'?$t('Drag anywhere to pan · Fit recenters the artboard'):$document.tool==='image'?$t('Choose Artwork in Insert, or drag to place a sample image'):$t('Click to add a {tool}, or drag to size it · Shift for equal sides', {tool: $t('design.tool.' + $document.tool)})}</span><span>X {position.x*20} · Y {position.y*20}</span></div>{/if}
</div>
