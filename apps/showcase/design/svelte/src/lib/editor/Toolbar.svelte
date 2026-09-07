<script lang="ts">
import {canRedo,canUndo,zoomPercent,type ToolMode} from '@awc-ui/showcase-kit/design';
import {document} from '$lib/document'; import {t} from '$lib/showcase'; import {navigate} from '$lib/router'; import Link from '$lib/components/Link.svelte';
export let onInsert: any = undefined;
export let onExport: any = undefined;
export let onPresent: any = undefined;
export let onLayers: any = undefined;
export let onInspector: any = undefined;
const TOOLS: { tool: ToolMode; icon: string; label: string; shortcut: string }[] = [
  { tool: 'select', icon: 'near_me', label: 'Select and move', shortcut: 'V' },
  { tool: 'frame', icon: 'crop_free', label: 'Frame', shortcut: 'F' },
  { tool: 'rect', icon: 'rectangle', label: 'Rectangle', shortcut: 'R' },
  { tool: 'ellipse', icon: 'circle', label: 'Ellipse', shortcut: 'O' },
  { tool: 'text', icon: 'title', label: 'Text', shortcut: 'T' },
  { tool: 'image', icon: 'image', label: 'Insert artwork', shortcut: 'I' },
  { tool: 'hand', icon: 'pan_tool', label: 'Pan', shortcut: 'H' },
];
</script>
<md-toolbar class="toolbar studio-toolbar" variant="floating" aria-label={$t('Canvas editing tools')} density={-2}> <div class="toolbar__group"><!-- AWC owns keyboard activation inside its shadow control. -->
<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<md-icon-button icon="left_panel_open" aria-label={$t('Toggle layers panel')} on:click={onLayers}></md-icon-button><!-- AWC owns keyboard activation inside its shadow control. -->
<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<md-icon-button icon="add_circle" aria-label={$t('Insert assets and live components')} on:click={() => onInsert('components')}></md-icon-button></div> <div class="toolbar__group" role="group" aria-label={$t('Drawing tools')}>{#each TOOLS as { tool, icon, label, shortcut }}<!-- AWC owns keyboard activation inside its shadow control. -->
<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<md-icon-button icon={icon} aria-label={`${$t(label)} (${shortcut})`} title={`${$t(label)} · ${shortcut}`} aria-pressed={$document.tool === tool} data-tool={tool} data-active={$document.tool === tool ? '' : undefined} on:click={() => { $document.setTool(tool); if (tool === 'image')
    onInsert('art'); }}></md-icon-button>{/each}</div> <div class="toolbar__group"><!-- AWC owns keyboard activation inside its shadow control. -->
<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<md-icon-button icon="undo" aria-label={$t('Undo (⌘Z)')} data-undo disabled={!canUndo($document.history) || undefined} on:click={() => $document.undo()}></md-icon-button><!-- AWC owns keyboard activation inside its shadow control. -->
<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<md-icon-button icon="redo" aria-label={$t('Redo (⌘⇧Z)')} data-redo disabled={!canRedo($document.history) || undefined} on:click={() => $document.redo()}></md-icon-button></div> <span class="toolbar__spacer"></span> <div class="toolbar__group toolbar__view"><!-- AWC owns keyboard activation inside its shadow control. -->
<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<md-icon-button icon="grid_4x4" aria-label={$t('Toggle grid')} aria-pressed={$document.showGrid} data-grid-toggle on:click={() => $document.toggleGrid()}></md-icon-button><!-- AWC owns keyboard activation inside its shadow control. -->
<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<md-icon-button icon="zoom_out" aria-label={$t('Zoom out')} data-zoom-out disabled={$document.zoomIndex === 0 || undefined} on:click={() => $document.zoomOut()}></md-icon-button><button class="studio-zoom" aria-label={$t('Fit and center canvas')} title={$t('Fit and center canvas')} on:click={() => window.dispatchEvent(new Event('pictor:fit'))}>{zoomPercent($document.zoomIndex)}% <span>⌄</span></button><!-- AWC owns keyboard activation inside its shadow control. -->
<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<md-icon-button icon="zoom_in" aria-label={$t('Zoom in')} data-zoom-in disabled={$document.zoomIndex === 4 || undefined} on:click={() => $document.zoomIn()}></md-icon-button></div> <div class="toolbar__group"><!-- AWC owns keyboard activation inside its shadow control. -->
<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<md-icon-button icon="right_panel_open" aria-label={$t('Toggle inspector')} on:click={onInspector}></md-icon-button><!-- AWC owns keyboard activation inside its shadow control. -->
<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<md-icon-button icon="play_arrow" aria-label={$t('Present design')} data-present on:click={onPresent}></md-icon-button><!-- AWC owns keyboard activation inside its shadow control. -->
<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<md-button variant="filled" icon="download" data-export on:click={onExport}>{$t('Export')}</md-button></div> </md-toolbar>
