<script lang="ts">
import {treeRows} from "@awc-ui/pictor-model";
let tree:HTMLDivElement; const focusRow=(index:number)=>tree?.querySelectorAll<HTMLElement>('[role="treeitem"]')[index]?.focus();
import {ancestorIds,canReparent,childrenOf,isContainer,layerById,layerIcon,lockedLayers,visibleLayers} from '@awc-ui/showcase-kit/design';
import TextControl from '$lib/editor/TextControl.svelte';
import {document} from '$lib/document'; import {t} from '$lib/showcase'; import {navigate} from '$lib/router'; import Link from '$lib/components/Link.svelte';
$: rows = treeRows($document.layers);
$: visible = (() => visibleLayers($document.layers))();
$: locked = (() => lockedLayers($document.layers))();
let query: any = ''; const setQuery = (value: any) => query = typeof value === "function" ? value(query) : value;
let collapsed: any = []; const setCollapsed = (value: any) => collapsed = typeof value === "function" ? value(collapsed) : value;
let dragId: any = null; const setDragId = (value: any) => dragId = typeof value === "function" ? value(dragId) : value;
let dropOn: any = null; const setDropOn = (value: any) => dropOn = typeof value === "function" ? value(dropOn) : value;
$: shown = rows.filter(({ layer }) => query ? layer.name.toLowerCase().includes(query.toLowerCase()) : ![...ancestorIds($document.layers, layer.id)].some(id => collapsed.includes(id)));
$: toggle = (id: string) => setCollapsed(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
$: over = (event: DragEvent, id: string) => { if (!dragId || dragId === id) return; event.preventDefault(); const box = (event.currentTarget as HTMLElement).getBoundingClientRect(); const offset = (event.clientY - box.top) / box.height; const layer = layerById($document.layers, id); setDropOn({ id, side: layer && isContainer(layer) && offset > .25 && offset < .75 ? 'inside' : offset < .5 ? 'before' : 'after' }); };
$: drop = (event: DragEvent) => { event.preventDefault(); if (dragId && dropOn) { const target = layerById($document.layers, dropOn.id); if (target) { const parentId = dropOn.side === 'inside' ? target.id : target.parentId; const siblings = childrenOf($document.layers, parentId).filter(layer => layer.id !== dragId); const at = dropOn.side === 'inside' ? siblings.length : siblings.findIndex(layer => layer.id === target.id) + (dropOn.side === 'after' ? 1 : 0); if (canReparent($document.layers, dragId, parentId)) $document.reorderTo(dragId, parentId, Math.max(0, at)); } } setDragId(null); setDropOn(null); };
</script>
<div class="studio-layers"><div class="studio-panel-heading"><div><h3>{$t('Layers')} <span>{$document.layers.length}</span></h3><p>{$t('Your composition, piece by piece.')}</p></div><!-- AWC owns keyboard activation inside its shadow control. -->
<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<md-icon-button icon="add" aria-label={$t('Insert a layer')} on:click={() => window.dispatchEvent(new Event('pictor:insert'))}></md-icon-button></div><TextControl live label={$t('Find a layer')} value={query} onValue={setQuery}></TextControl><div bind:this={tree} class="tree" role="tree" aria-label={$t('Canvas layers')} data-layer-tree>{#each shown as { layer, level }, index}<div class="tree__row" role="treeitem" aria-level={level + 1} aria-expanded={isContainer(layer) ? !collapsed.includes(layer.id) : undefined} aria-selected={$document.selection.includes(layer.id)} tabindex={0} data-layer={layer.id} data-level={level} data-selected={$document.selection.includes(layer.id) ? '' : undefined} data-tone={!visible.has(layer.id) ? 'hidden' : locked.has(layer.id) ? 'locked' : undefined} data-drop={dropOn?.id === layer.id ? dropOn.side : undefined} draggable={!locked.has(layer.id)} on:dragstart={event => { setDragId(layer.id); event.dataTransfer.setData('text/plain', layer.id); event.dataTransfer.effectAllowed = 'move'; }} on:dragover={event => over(event, layer.id)} on:drop={drop} on:dragend={() => { setDragId(null); setDropOn(null); }} on:click={event => { if (!locked.has(layer.id))
    event.shiftKey || event.metaKey || event.ctrlKey ? $document.toggleInSelection(layer.id) : $document.select([layer.id]); }} on:keydown={event => { if (event.target !== event.currentTarget)
    return; if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    if (!locked.has(layer.id))
        $document.select([layer.id]);
} if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    event.stopPropagation();
    const next = Math.max(0, Math.min(shown.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)));
    focusRow(next);
} if ((event.key === 'ArrowLeft' || event.key === 'ArrowRight') && isContainer(layer)) {
    event.preventDefault();
    event.stopPropagation();
    setCollapsed(current => event.key === 'ArrowLeft' ? [...new Set([...current, layer.id])] : current.filter(id => id !== layer.id));
} }}> {#if isContainer(layer)}<button class="tree__expand" aria-label={`${collapsed.includes(layer.id) ? $t('Expand') : $t('Collapse')} ${layer.name}`} on:click={event => { event.stopPropagation(); toggle(layer.id); }}><span class="material-symbols-outlined" aria-hidden="true">{#if collapsed.includes(layer.id)}{'chevron_right'}{:else}{'expand_more'}{/if}</span></button>{:else}<span class="tree__expand-spacer"></span>{/if}<span class="material-symbols-outlined tree__icon" aria-hidden="true">{layerIcon(layer.kind)}</span><span class="tree__name" title={layer.name}>{layer.name}</span><!-- AWC owns keyboard activation inside its shadow control. -->
<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<md-icon-button class="tree__toggle" size="x-small" icon={layer.visible ? 'visibility' : 'visibility_off'} aria-label={`${layer.visible ? $t('Hide') : $t('Show')} ${layer.name}`} data-visibility={layer.id} on:click={(event) => { event.stopPropagation(); $document.toggleVisible(layer.id); }}></md-icon-button><!-- AWC owns keyboard activation inside its shadow control. -->
<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<md-icon-button class="tree__toggle" size="x-small" icon={layer.locked ? 'lock' : 'lock_open'} aria-label={`${layer.locked ? $t('Unlock') : $t('Lock')} ${layer.name}`} data-lock={layer.id} on:click={(event) => { event.stopPropagation(); $document.toggleLocked(layer.id); }}></md-icon-button> </div>{/each}</div>{#if shown.length === 0}<p class="studio-description">{$t('No matching layers. Try another name.')}</p>{/if}<p class="studio-panel-footnote">{$t('Shift-click to select more. Drag rows to reorder or nest.')}</p></div>
