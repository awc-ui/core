<script lang="ts">
import {onMount} from "svelte";
import {fileById,lockedLayers,visibleLayers,descendantIds,type ToolMode} from '@awc-ui/showcase-kit/design';
import Canvas from '$lib/editor/Canvas.svelte';
import HistoryPanel from '$lib/editor/HistoryPanel.svelte';
import Inspector from '$lib/editor/Inspector.svelte';
import LayerTree from '$lib/editor/LayerTree.svelte';
import Toolbar from '$lib/editor/Toolbar.svelte';
import InsertPanel from '$lib/editor/InsertPanel.svelte';
import ExportDialog from '$lib/editor/ExportDialog.svelte';
import PanelTabs from '$lib/editor/PanelTabs.svelte';
import StudioDialog from '$lib/editor/StudioDialog.svelte';
import Screen from '$lib/screens/Screen.svelte';
import NotFoundScreen from '$lib/screens/NotFoundScreen.svelte';
import {document} from '$lib/document'; import {t} from '$lib/showcase'; import {navigate} from '$lib/router'; import Link from '$lib/components/Link.svelte';
export let fileId: any = undefined;
const toolHelp: Record<ToolMode, readonly [string, string]> = {
  select: ['Select', 'Drag to move · Shift-click to select more · Drag a corner to resize'],
  frame: ['Frame', 'Drag on the canvas to draw a frame, or click for a starting size.'],
  rect: ['Rectangle', 'Drag on the canvas to draw · Hold Shift for a square'],
  ellipse: ['Ellipse', 'Drag on the canvas to draw · Hold Shift for a circle'],
  text: ['Text', 'Click the canvas to add text. Double-click it to edit in the inspector.'],
  image: ['Image', 'Choose artwork from the library, or drag on the canvas to place an image.'],
  hand: ['Pan', 'Drag anywhere in the workspace to look around. Fit canvas brings it back.'],
};
let panel: any = 'layers'; const setPanel = (value: any) => panel = typeof value === "function" ? value(panel) : value;
let insertRequest: any = 0; const setInsertRequest = (value: any) => insertRequest = typeof value === "function" ? value(insertRequest) : value;
let insertCategory: any = 'components'; const setInsertCategory = (value: any) => insertCategory = typeof value === "function" ? value(insertCategory) : value;
let showLeft: any = (() => window.innerWidth > 700)(); const setShowLeft = (value: any) => showLeft = typeof value === "function" ? value(showLeft) : value;
let showRight: any = (() => window.innerWidth > 980)(); const setShowRight = (value: any) => showRight = typeof value === "function" ? value(showRight) : value;
let exportOpen: any = false; const setExportOpen = (value: any) => exportOpen = typeof value === "function" ? value(exportOpen) : value;
let presentOpen: any = false; const setPresentOpen = (value: any) => presentOpen = typeof value === "function" ? value(presentOpen) : value;
$: insert = (category: 'components' | 'art' = 'components') => { setInsertCategory(category); setInsertRequest(value => value + 1); setPanel('insert'); setShowLeft(true); };
$: keyboard = (event: KeyboardEvent) => {
    if (exportOpen || presentOpen) return;
    if (event.composedPath().some(target => target instanceof HTMLElement && (target.matches('input,textarea,select,[contenteditable="true"],md-text-field,md-number-field,md-select,md-color-picker,md-slider') || target.isContentEditable))) return;
    const key = event.key.toLowerCase(), command = event.metaKey || event.ctrlKey;
    if (command && key === 'z') { event.preventDefault(); event.shiftKey ? $document.redo() : $document.undo(); return; }
    if (command && key === 'd') { event.preventDefault(); $document.duplicate(); return; }
    if (command && key === 'a') { event.preventDefault(); const visible = visibleLayers($document.layers), locked = lockedLayers($document.layers); $document.select($document.layers.filter(layer => visible.has(layer.id) && !locked.has(layer.id)).map(layer => layer.id)); return; }
    if (command || event.altKey) return;
    if (key === 'escape') { $document.clearSelection(); $document.setTool('select'); return; }
    if (key === 'delete' || key === 'backspace') { if ($document.selection.length) { event.preventDefault(); $document.remove(); } return; }
    const modes: Record<string, ToolMode> = { v: 'select', f: 'frame', r: 'rect', o: 'ellipse', t: 'text', i: 'image', h: 'hand' };
    if (modes[key]) { $document.setTool(modes[key]); return; }
    if (key.startsWith('arrow') && $document.selection.length && !(event.target as HTMLElement).closest('button,md-icon-button,md-toolbar,[role="treeitem"]')) { event.preventDefault(); const step = event.shiftKey ? 5 : 1; $document.commitLayers('move', layers => { const locked = lockedLayers(layers); const ids = new Set($document.selection); $document.selection.forEach(id => descendantIds(layers, id).forEach(child => ids.add(child))); const moved = layers.filter(layer => ids.has(layer.id) && !locked.has(layer.id)); if (!moved.length) return layers; let dx = key === 'arrowleft' ? -step : key === 'arrowright' ? step : 0, dy = key === 'arrowup' ? -step : key === 'arrowdown' ? step : 0; dx = Math.max(-Math.min(...moved.map(layer => layer.rect.x)), Math.min(48 - Math.max(...moved.map(layer => layer.rect.x + layer.rect.w)), dx)); dy = Math.max(-Math.min(...moved.map(layer => layer.rect.y)), Math.min(32 - Math.max(...moved.map(layer => layer.rect.y + layer.rect.h)), dy)); return layers.map(layer => moved.includes(layer) ? { ...layer, rect: { ...layer.rect, x: layer.rect.x + dx, y: layer.rect.y + dy } } : layer); }); }
  };
$: file = fileById($document.fileId);

$: if(fileId&&fileId!==$document.fileId)$document.openFile(fileId);
onMount(()=>{const exporting=()=>setExportOpen(true),presenting=()=>setPresentOpen(true),inserting=()=>insert();window.addEventListener('pictor:export',exporting);window.addEventListener('pictor:present',presenting);window.addEventListener('pictor:insert',inserting);return()=>{window.removeEventListener('pictor:export',exporting);window.removeEventListener('pictor:present',presenting);window.removeEventListener('pictor:insert',inserting)}});
</script>
{#if file && (!fileId||fileById(fileId))}<Screen title={file.name} subtitle={$t('An idea becomes a composition. Make something unmistakably yours.')} crumbLabel={file.name}> <div class="editor studio-editor" role="group" aria-label={$t('Design editor')} data-editor data-left={showLeft ? 'open' : 'closed'} data-right={showRight ? 'open' : 'closed'} on:keydown={keyboard} tabindex={-1}> <div class="editor__toolbar"><Toolbar onInsert={insert} onExport={() => setExportOpen(true)} onPresent={() => setPresentOpen(true)} onLayers={() => setShowLeft(value => !value)} onInspector={() => setShowRight(value => !value)}></Toolbar><div class="studio-tool-hint" role="status"><strong>{$t(toolHelp[$document.tool][0])}</strong><span>{$t(toolHelp[$document.tool][1])}</span></div></div> <aside class="editor__tree studio-left-panel"><PanelTabs label={$t('Studio panels')} value={panel} onValue={setPanel} options={[{ value: 'layers', label: $t('Layers') }, { value: 'insert', label: $t('Insert') }, { value: 'history', label: $t('History') }]}></PanelTabs>{#if panel === 'layers'}<LayerTree></LayerTree>{:else}{#if panel === 'insert'}{#key insertRequest}<InsertPanel category={insertCategory}/>{/key}{:else}<HistoryPanel></HistoryPanel>{/if}{/if}</aside> <div class="editor__canvas"><Canvas onInspect={() => setShowRight(true)}></Canvas></div> <aside class="editor__inspector"><Inspector></Inspector></aside> <div class="studio-statusbar"><span><span class="pictor-live-dot"></span> {#if $document.selection.length}{$t('{count} selected', {count: $document.selection.length})}{:else}{$t('Your next move starts here')}{/if}</span><span>{$document.layers.length} {$t('layers')} <span class="studio-statusbar__separator">·</span> 960 × 640 <span class="studio-statusbar__separator">·</span> {$t('20 px snap')}</span><button on:click={() => { setPanel('history'); setShowLeft(true); }}><span class="material-symbols-outlined" aria-hidden="true">history</span> {$document.history.entries.length} {$t('edits')}</button></div> </div> <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)}></ExportDialog> <StudioDialog open={presentOpen} onClose={() => setPresentOpen(false)} title={$t('Your idea, center stage')} fullscreen><div class="studio-presentation"><div class="studio-presentation__intro"><span class="pictor-eyebrow">{$t('THE FINISHED PICTURE')}</span><p>{$t('Live AWC controls are interactive here. Try a button, field or switch.')}</p></div><Canvas presentation></Canvas></div><svelte:fragment slot="actions"><!-- AWC owns keyboard activation inside its shadow control. -->
<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<md-button variant="filled" icon="close" data-close-present on:click={() => setPresentOpen(false)}>{$t('Back to studio')}</md-button></svelte:fragment></StudioDialog> <svelte:fragment slot="aside"><div class="studio-save-status" data-save-status={$document.saveStatus}><span class="material-symbols-outlined" aria-hidden="true">{#if $document.saveStatus === 'saved'}{'cloud_done'}{:else}{#if $document.saveStatus === 'unavailable'}{'cloud_off'}{:else}{'edit'}{/if}{/if}</span>{#if $document.saveStatus === 'saved'}{$t('Saved on this device')}{:else}{#if $document.saveStatus === 'unavailable'}{$t('Device storage unavailable')}{:else}{$t('Saving your changes…')}{/if}{/if}</div></svelte:fragment></Screen>{:else}<NotFoundScreen/>{/if}
