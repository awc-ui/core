<script lang="ts">
const GEOMETRY_KEYS=["x","y","w","h"] as const;
import {ADJUSTMENT_ORDER,BLEND_ORDER,ancestorIds,ALIGN_ORDER,adjustmentKey,alignIcon,alignKey,blendKey,childrenOf,commonValue,isMixed,layerById,moveSubtree,clampRect,type Layer,type Rect} from '@awc-ui/showcase-kit/design';
import {colorOf,componentMarkup,DEFAULT_SWATCHES} from '@awc-ui/pictor-model';
import PanelTabs from '$lib/editor/PanelTabs.svelte';
import ColorControl from '$lib/editor/ColorControl.svelte';
import NumberControl from '$lib/editor/NumberControl.svelte';
import RangeControl from '$lib/editor/RangeControl.svelte';
import SelectControl from '$lib/editor/SelectControl.svelte';
import TextControl from '$lib/editor/TextControl.svelte';
import ToggleControl from '$lib/editor/ToggleControl.svelte';
import {document} from '$lib/document'; import {t} from '$lib/showcase'; import {navigate} from '$lib/router'; import Link from '$lib/components/Link.svelte';
let tab: any = 'design'; const setTab = (value: any) => tab = typeof value === "function" ? value(tab) : value;
let copied: any = false; const setCopied = (value: any) => copied = typeof value === "function" ? value(copied) : value;
$: selected = $document.layers.filter(layer => $document.selection.includes(layer.id));
$: first = selected[0];
$: pick = (fn: (layer: Layer) => unknown) => commonValue($document.layers, $document.selection, fn);
$: geometry = (key: any) => { const value = pick(layer => layer.rect[key]); return typeof value === 'number' ? value * 20 : null; };
$: setGeometry = (key: keyof Rect, pixels: number) => {
    const value = Math.round(pixels / 20);
    $document.commitLayers(key === 'x' || key === 'y' ? 'move' : 'resize', layers => {
      let next = layers;
      const ids = key === 'x' || key === 'y' ? $document.selection.filter(id => ![...ancestorIds(layers, id)].some(parent => $document.selection.includes(parent))) : $document.selection;
      for (const id of ids) {
        const layer = layerById(next, id); if (!layer) continue;
        if (key === 'x' || key === 'y') next = moveSubtree(next, id, key === 'x' ? value - layer.rect.x : 0, key === 'y' ? value - layer.rect.y : 0);
        else next = next.map(item => item.id === id ? { ...item, rect: clampRect({ ...item.rect, [key]: value }) } : item);
      }
      return next;
    });
  };
$: snippet = first ? first.componentId?.startsWith('awc:') ? componentMarkup(first) : `.design-element {\n  width: ${first.rect.w * 20}px;\n  height: ${first.rect.h * 20}px;\n  ${first.kind === 'text' ? 'color' : 'background'}: ${colorOf(first.fill)};\n  opacity: ${first.opacity / 100};\n  mix-blend-mode: ${first.blend};\n}` : '';
$: reorder = (where: 'front' | 'back') => { if (!first) return; $document.reorderTo(first.id, first.parentId, where === 'front' ? childrenOf($document.layers, first.parentId).length - 1 : 0); };
</script>
<div class="inspector studio-inspector" data-inspector> <div class="studio-panel-head"><strong>{$t('Inspector')}</strong><span>{#if selected.length}{$t('{count} selected', {count: selected.length})}{:else}{$t('Canvas')}{/if}</span></div> <PanelTabs value={tab} onValue={setTab} label={$t('Inspector view')} options={[{ value: 'design', label: $t('Design'), icon: 'tune' }, { value: 'code', label: $t('Handoff'), icon: 'code' }]}></PanelTabs> {#if !first}<div class="studio-inspector-empty"><span class="material-symbols-outlined" aria-hidden="true">interests</span><h3>{$t('Every detail is a possibility.')}</h3><p>{$t('Select an object to adjust its geometry, color and appearance.')}</p><div class="studio-canvas-spec"><span>{$t('Canvas size')}</span><strong>960 × 640</strong><span>{$t('Color profile')}</span><strong>sRGB</strong><span>{$t('Editable layers')}</span><strong>{$document.layers.length}</strong><span>{$t('Grid')}</span><strong>{$t('20px snapping')}</strong></div><!-- AWC owns keyboard activation inside its shadow control. -->
<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<md-button variant="tonal" icon="add" on:click={() => window.dispatchEvent(new Event('pictor:insert'))}>{$t('Insert something')}</md-button><p class="studio-tip">{$t('Try R to draw a rectangle, T for text, or double-click a text layer to edit it.')}</p></div>{:else}{#if tab === 'code'}<section class="inspector__section"><h3 class="inspector__title">{#if first.componentId?.startsWith('awc:')}{$t('AWC component markup')}{:else}{$t('CSS properties')}{/if}</h3><p class="studio-tip">{#if first.componentId?.startsWith('awc:')}{$t('This is a live component. Open Present mode to interact with it.')}{:else}{$t('Measured directly from your selected layer. Position it within your own layout.')}{/if}</p><pre class="studio-code"><code>{snippet}</code></pre><!-- AWC owns keyboard activation inside its shadow control. -->
<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<md-button variant="tonal" icon={copied ? 'check' : 'content_copy'} on:click={async () => { try {
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
}
catch {
    setCopied(false);
} }}>{#if copied}{$t('Copied')}{:else}{$t('Copy code')}{/if}</md-button><div class="studio-canvas-spec"><span>{$t('Layer ID')}</span><code>{first.id}</code><span>{$t('Type')}</span><strong>{first.kind}</strong></div></section>{:else} <section class="inspector__section"><TextControl label={first.kind === 'text' ? $t('Text content') : $t('Layer name')} value={selected.length === 1 ? first.textKey ? $t(first.textKey) : first.name : ''} placeholder={selected.length > 1 ? $t('Rename selected layers') : undefined} onValue={name => $document.restyle({ name, ...(first.kind === 'text' ? { textKey: null } : {}) })} data-name-field multiline={first.kind === 'text' ? 'auto-grow' : undefined} rows={first.kind === 'text' ? 3 : undefined}></TextControl>{#if first.kind === 'text'}<p class="studio-tip">{$t('Text scales to fit its frame. Add a line break or resize for a new composition.')}</p>{/if}</section> <section class="inspector__section"><h3 class="inspector__title">{$t('Position & size')} <span>PX</span></h3><div class="inspector__grid">{#each GEOMETRY_KEYS as key}<NumberControl label={key.toUpperCase()} value={geometry(key)} onValue={value => setGeometry(key, value)} min={key === 'w' || key === 'h' ? 20 : 0} max={key === 'x' || key === 'w' ? 960 : 640} step={20} data-geometry={key} data-field={`design.label.${key}`}></NumberControl>{/each}</div><p class="studio-tip">{$t('Snaps to 20px. Drag canvas corner handles to resize.')}</p></section> <section class="inspector__section"><h3 class="inspector__title">{$t('Fill & appearance')}</h3><div class="studio-color-row"><ColorControl value={colorOf(first.fill, '#203D35')} onValue={fill => $document.restyle({ fill })}></ColorControl><TextControl label={$t('Color')} value={colorOf(first.fill, '#203D35')} onValue={fill => { if (/^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(fill))
    $document.restyle({ fill }); }}></TextControl></div><div class="studio-swatches" role="group" aria-label={$t('Brand colors')}>{#each DEFAULT_SWATCHES.slice(0, 12) as fill}<button title={fill} aria-label={$t('Set fill to {fill}', {fill: fill})} aria-pressed={colorOf(first.fill) === fill} on:click={() => $document.restyle({ fill })}><svg viewBox="0 0 24 24" aria-hidden="true"><rect width="24" height="24" rx="7" fill={fill}></rect></svg></button>{/each}</div><RangeControl label={$t('Opacity')} value={typeof pick(l => l.opacity) === 'number' ? Number(pick(l => l.opacity)) : 100} onValue={opacity => $document.restyle({ opacity })}></RangeControl><SelectControl value={isMixed(pick(l => l.blend)) ? '' : first.blend} label={$t('Blend mode')} onValue={blend => $document.restyle({ blend: blend, blendKey: blendKey(blend) })} options={BLEND_ORDER.map(mode => ({ value: mode, label: $t(blendKey(mode)) }))} data-blend-select></SelectControl></section> <section class="inspector__section"><h3 class="inspector__title">{$t('Arrange')}</h3><div class="studio-arrange" role="group" aria-label={$t('Align selected layers')}>{#each ALIGN_ORDER as axis}<!-- AWC owns keyboard activation inside its shadow control. -->
<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<md-icon-button icon={alignIcon(axis)} aria-label={$t(alignKey(axis))} disabled={selected.length < 2 || undefined} data-align={axis} on:click={() => $document.align(axis)}></md-icon-button>{/each}</div><div class="studio-arrange"><!-- AWC owns keyboard activation inside its shadow control. -->
<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<md-icon-button icon="horizontal_distribute" aria-label={$t('Distribute horizontally')} disabled={selected.length < 3 || undefined} on:click={() => $document.distribute('horizontal')}></md-icon-button><!-- AWC owns keyboard activation inside its shadow control. -->
<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<md-icon-button icon="vertical_distribute" aria-label={$t('Distribute vertically')} disabled={selected.length < 3 || undefined} on:click={() => $document.distribute('vertical')}></md-icon-button><!-- AWC owns keyboard activation inside its shadow control. -->
<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<md-icon-button icon="flip_to_front" aria-label={$t('Bring to front')} on:click={() => reorder('front')}></md-icon-button><!-- AWC owns keyboard activation inside its shadow control. -->
<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<md-icon-button icon="flip_to_back" aria-label={$t('Send to back')} on:click={() => reorder('back')}></md-icon-button><!-- AWC owns keyboard activation inside its shadow control. -->
<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<md-icon-button icon="folder" aria-label={$t('Group layers')} disabled={selected.length < 2 || undefined} on:click={() => $document.group()}></md-icon-button><!-- AWC owns keyboard activation inside its shadow control. -->
<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<md-icon-button icon="folder_off" aria-label={$t('Ungroup')} disabled={!selected.some(l => l.kind === 'group' || l.kind === 'frame') || undefined} on:click={() => $document.ungroup()}></md-icon-button></div></section> {#if selected.some(layer => layer.kind === 'image')}<section class="inspector__section"><h3 class="inspector__title">{$t('Image adjustments')}</h3>{#each ADJUSTMENT_ORDER as kind}<RangeControl label={$t(adjustmentKey(kind))} min={-100} max={100} step={20} value={first.adjustments.find(a => a.kind === kind)?.value ?? 0} onValue={value => $document.setAdjustment(kind, value)}></RangeControl>{/each}<ToggleControl label={$t('Rounded image mask')} selected={first.masked} onValue={masked => $document.restyle({ masked })}></ToggleControl></section>{/if} <section class="inspector__section"><!-- AWC owns keyboard activation inside its shadow control. -->
<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<md-button variant="tonal" icon="content_copy" on:click={() => $document.duplicate()}>{$t('Duplicate selection')}</md-button><!-- AWC owns keyboard activation inside its shadow control. -->
<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<md-button variant="text" icon="delete" on:click={() => $document.remove()}>{$t('Delete selection')}</md-button></section> {/if}{/if} </div>
