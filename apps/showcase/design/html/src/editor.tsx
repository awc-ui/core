import { translateUi as p } from './context';
import { dom, Fragment, replace } from './dom';
import { field, getDocument, getTranslator, requestRender, ui } from './context';
import { PanelTabs, Screen, TextControl } from './controls';
import { Toolbar } from './views/Toolbar';
import { Inspector } from './views/Inspector';
import { HistoryPanel } from './views/HistoryPanel';
import { InsertPanel } from './views/InsertPanel';
import { mountCanvas } from './canvas';
import { treeRows } from '@awc-ui/pictor-model';
import { ancestorIds, canReparent, childrenOf, descendantIds, fileById, isContainer, layerById, layerIcon, lockedLayers, visibleLayers, type ToolMode } from '@awc-ui/showcase-kit/design';

const help: Record<ToolMode, [string,string]> = {
  select: ['Select', 'Drag to move · Shift-click to select more · Drag a corner to resize'],
  frame: ['Frame', 'Drag on the canvas to draw a frame, or click for a starting size.'],
  rect: ['Rectangle', 'Drag on the canvas to draw · Hold Shift for a square'],
  ellipse: ['Ellipse', 'Drag on the canvas to draw · Hold Shift for a circle'],
  text: ['Text', 'Click the canvas to add text. Double-click it to edit in the inspector.'],
  image: ['Image', 'Choose artwork from the library, or drag on the canvas to place an image.'],
  hand: ['Pan', 'Drag anywhere in the workspace to look around. Fit canvas brings it back.'],
};
const state = { panel:'layers', left:innerWidth > 700, right:innerWidth > 980, category:'components' as 'components'|'art' };
export function showInsert(category: 'components'|'art' = 'components') {
  state.category=category; state.panel='insert'; state.left=true;
  ui.set('InsertPanel:tab',category); ui.set('InsertPanel:query',''); requestRender();
}
const collapsed = new Set<string>();
let dragging: string | null = null;
function LayerTree() {
  const doc=getDocument(), [query,setQuery]=field('layers:query','');
  const rows=treeRows(doc.layers).filter(({layer}) => query ? layer.name.toLowerCase().includes(query.toLowerCase()) : ![...ancestorIds(doc.layers,layer.id)].some(id=>collapsed.has(id)));
  const locked=lockedLayers(doc.layers), visible=visibleLayers(doc.layers);
  const pick=(e:MouseEvent,id:string)=> { if (!locked.has(id)) e.shiftKey || e.metaKey || e.ctrlKey ? doc.toggleInSelection(id) : doc.select([id]); };
  return <div class="studio-layers"><div class="studio-panel-heading"><div><h3>{p("Layers")} <span>{doc.layers.length}</span></h3><p>{p("Your composition, piece by piece.")}</p></div><md-icon-button icon="add" aria-label={p("Insert a layer")} onClick={()=>showInsert()} /></div><TextControl live label={p("Find a layer")} value={query} onValue={setQuery}/><div class="tree" role="tree" aria-label={p("Canvas layers")} data-layer-tree>{rows.map(({layer,level}) =>
    <div class="tree__row" role="treeitem" aria-level={level+1} aria-selected={doc.selection.includes(layer.id)} aria-expanded={isContainer(layer) ? !collapsed.has(layer.id):undefined} tabIndex={0} data-layer={layer.id} data-level={level} data-selected={doc.selection.includes(layer.id)?'':undefined} data-tone={!visible.has(layer.id)?'hidden':locked.has(layer.id)?'locked':undefined} draggable={!locked.has(layer.id)}
      onClick={(e:MouseEvent)=>pick(e,layer.id)}
      onKeyDown={(e:KeyboardEvent)=>{ if(e.target!==e.currentTarget)return; if(e.key==='Enter'||e.key===' '){e.preventDefault();doc.select([layer.id]);} if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();e.stopPropagation();const all=[...(e.currentTarget as Element).parentElement!.children] as HTMLElement[];all[Math.max(0,Math.min(all.length-1,all.indexOf(e.currentTarget as HTMLElement)+(e.key==='ArrowDown'?1:-1)))]?.focus();} if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();e.stopPropagation();e.key==='ArrowLeft'?collapsed.add(layer.id):collapsed.delete(layer.id);requestRender();}}}
      onDragStart={(e:DragEvent)=>{dragging=layer.id;e.dataTransfer?.setData('text/plain',layer.id);}}
      onDragOver={(e:DragEvent)=>{if(dragging&&dragging!==layer.id)e.preventDefault();}}
      onDrop={(e:DragEvent)=>{e.preventDefault();const id=dragging;dragging=null;if(!id||id===layer.id)return;const rect=(e.currentTarget as Element).getBoundingClientRect();const fraction=(e.clientY-rect.top)/rect.height;const inside=isContainer(layer)&&fraction>.25&&fraction<.75;const parent=inside?layer.id:layer.parentId;const siblings=childrenOf(doc.layers,parent).filter(x=>x.id!==id);const index=inside?siblings.length:siblings.findIndex(x=>x.id===layer.id)+(fraction>.5?1:0);if(canReparent(doc.layers,id,parent))doc.reorderTo(id,parent,Math.max(0,index));}}
      onDragEnd={()=>{dragging=null;}}>
      {isContainer(layer)?<button class="tree__expand" aria-label={p(collapsed.has(layer.id)?'Expand {name}':'Collapse {name}',{name:layer.name})} onClick={(e:MouseEvent)=>{e.stopPropagation();collapsed.has(layer.id)?collapsed.delete(layer.id):collapsed.add(layer.id);requestRender();}}><span class="material-symbols-outlined" aria-hidden="true">{collapsed.has(layer.id)?'chevron_right':'expand_more'}</span></button>:<span class="tree__expand-spacer"/>}
      <span class="material-symbols-outlined tree__icon" aria-hidden="true">{layerIcon(layer.kind)}</span><span class="tree__name" title={layer.name}>{layer.name}</span>
      <md-icon-button class="tree__toggle" size="x-small" icon={layer.visible?'visibility':'visibility_off'} aria-label={p(layer.visible?'Hide {name}':'Show {name}',{name:layer.name})} data-visibility={layer.id} onClick={(e:MouseEvent)=>{e.stopPropagation();doc.toggleVisible(layer.id);}}/>
      <md-icon-button class="tree__toggle" size="x-small" icon={layer.locked?'lock':'lock_open'} aria-label={p(layer.locked?'Unlock {name}':'Lock {name}',{name:layer.name})} data-lock={layer.id} onClick={(e:MouseEvent)=>{e.stopPropagation();doc.toggleLocked(layer.id);}}/>
    </div>)}</div>{!rows.length?<p class="studio-description">{p("No matching layers. Try another name.")}</p>:null}<p class="studio-panel-footnote">{p("Shift-click to select more. Drag rows to reorder or nest.")}</p></div>;
}

export function mountEditor(main: HTMLElement, openExport:()=>void, openPresent:()=>void) {
  const toolbar=<div class="editor__toolbar"/>, left=<aside class="editor__tree studio-left-panel"/>, right=<aside class="editor__inspector"/>, canvasHost=<div class="editor__canvas"/>, status=<div class="studio-statusbar"/>;
  const root=<div class="editor studio-editor" data-editor tabIndex={-1}>{toolbar}{left}{canvasHost}{right}{status}</div>;
  replace(main,<Screen crumbLabel={fileById(getDocument().fileId)?.name??p("Canvas")} title={fileById(getDocument().fileId)?.name??p("Canvas")} subtitle={p("An idea becomes a composition. Make something unmistakably yours.")} aside={<div class="studio-save-status"/>}>{root}</Screen>);
  const canvas=mountCanvas(canvasHost,false,()=>{state.right=true;requestRender();});
  const render=()=>{
    const doc=getDocument();
    main.querySelector('h1')!.textContent=fileById(doc.fileId)?.name??p("Canvas");
    const saved=main.querySelector('.studio-save-status')!;
    saved.textContent=doc.saveStatus==='saved'?p("Saved on this device"):doc.saveStatus==='unavailable'?p("Device storage unavailable"):p("Saving your changes…");
    root.setAttribute('data-left',state.left?'open':'closed'); root.setAttribute('data-right',state.right?'open':'closed');
    replace(toolbar,<><Toolbar onInsert={showInsert} onExport={openExport} onPresent={openPresent} onLayers={()=>{state.left=!state.left;requestRender();}} onInspector={()=>{state.right=!state.right;requestRender();}}/><div class="studio-tool-hint" role="status"><strong>{p(help[doc.tool][0])}</strong><span>{p(help[doc.tool][1])}</span></div></>);
    const scrollLeft=left.scrollTop, scrollRight=right.scrollTop;
    replace(left,<><PanelTabs label={p("Studio panels")} value={state.panel} onValue={(value:string)=>{state.panel=value;requestRender();}} options={[{value:'layers',label:p("Layers")},{value:'insert',label:p("Insert")},{value:'history',label:p("History")}]}/>{state.panel==='layers'?<LayerTree/>:state.panel==='insert'?<InsertPanel category={state.category}/>:<HistoryPanel/>}</>);
    replace(right,<Inspector/>); left.scrollTop=scrollLeft;right.scrollTop=scrollRight;
    replace(status,<><span><span class="pictor-live-dot"/>{doc.selection.length?p('{count} selected',{count:doc.selection.length}):p("Your next move starts here")}</span><span>{p("{count} layers", { count: doc.layers.length })}<span class="studio-statusbar__separator">·</span> 960 × 640 <span class="studio-statusbar__separator">·</span>  {p("20 px snap")}</span><button onClick={()=>{state.panel='history';state.left=true;requestRender();}}><span class="material-symbols-outlined">history</span>{p("{count} edits", { count: doc.history.entries.length })}</button></>);
    canvas.render();
  };
  root.addEventListener('keydown',(e:KeyboardEvent)=>{
    if(document.querySelector('md-dialog[open]'))return;
    if(e.composedPath().some(target=>target instanceof HTMLElement&&(target.matches('input,textarea,select,[contenteditable="true"],md-text-field,md-number-field,md-select,md-color-picker,md-slider')||target.isContentEditable)))return;
    const doc=getDocument(),key=e.key.toLowerCase(),command=e.metaKey||e.ctrlKey;
    if(command&&key==='z'){e.preventDefault();e.shiftKey?doc.redo():doc.undo();return;}
    if(command&&key==='d'){e.preventDefault();doc.duplicate();return;}
    if(command&&key==='a'){e.preventDefault();const visible=visibleLayers(doc.layers),locked=lockedLayers(doc.layers);doc.select(doc.layers.filter(l=>visible.has(l.id)&&!locked.has(l.id)).map(l=>l.id));return;}
    if(command||e.altKey)return;
    if(key==='escape'){doc.clearSelection();doc.setTool('select');return;}
    if(key==='delete'||key==='backspace'){if(doc.selection.length){e.preventDefault();doc.remove();}return;}
    const modes:Record<string,ToolMode>={v:'select',f:'frame',r:'rect',o:'ellipse',t:'text',i:'image',h:'hand'};
    if(modes[key]){doc.setTool(modes[key]);return;}
    if(key.startsWith('arrow')&&doc.selection.length&&!(e.target as HTMLElement).closest('button,md-icon-button,md-toolbar,[role="treeitem"]')){
      e.preventDefault();const step=e.shiftKey?5:1;
      doc.commitLayers('move',layers=>{
        const locked=lockedLayers(layers),ids=new Set(doc.selection);doc.selection.forEach(id=>descendantIds(layers,id).forEach(child=>ids.add(child)));
        const moved=layers.filter(l=>ids.has(l.id)&&!locked.has(l.id));if(!moved.length)return layers;
        let dx=key==='arrowleft'?-step:key==='arrowright'?step:0,dy=key==='arrowup'?-step:key==='arrowdown'?step:0;
        dx=Math.max(-Math.min(...moved.map(l=>l.rect.x)),Math.min(48-Math.max(...moved.map(l=>l.rect.x+l.rect.w)),dx));
        dy=Math.max(-Math.min(...moved.map(l=>l.rect.y)),Math.min(32-Math.max(...moved.map(l=>l.rect.y+l.rect.h)),dy));
        return layers.map(l=>moved.includes(l)?{...l,rect:{...l.rect,x:l.rect.x+dx,y:l.rect.y+dy}}:l);
      });
    }
  });
  render(); return {render,destroy:()=>canvas.destroy()};
}
