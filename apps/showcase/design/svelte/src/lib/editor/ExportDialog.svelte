<script lang="ts">
import {fileById} from '@awc-ui/showcase-kit/design';
import {documentSvg,downloadDocument} from '@awc-ui/pictor-model';
import SelectControl from '$lib/editor/SelectControl.svelte';
import StudioDialog from '$lib/editor/StudioDialog.svelte';
import ToggleControl from '$lib/editor/ToggleControl.svelte';
import {document} from '$lib/document'; import {t} from '$lib/showcase'; import {navigate} from '$lib/router'; import Link from '$lib/components/Link.svelte';
export let open: any = undefined;
export let onClose: any = undefined;
let format: any = 'svg'; const setFormat = (value: any) => format = typeof value === "function" ? value(format) : value;
let scale: any = '1'; const setScale = (value: any) => scale = typeof value === "function" ? value(scale) : value;
let background: any = false; const setBackground = (value: any) => background = typeof value === "function" ? value(background) : value;
let busy: any = false; const setBusy = (value: any) => busy = typeof value === "function" ? value(busy) : value;
let message: any = ''; const setMessage = (value: any) => message = typeof value === "function" ? value(message) : value;
$: download = async () => { setBusy(true); setMessage(''); try { await downloadDocument($document.layers, $t, format as 'svg' | 'png' | 'json', fileById($document.fileId)?.name ?? 'Pictor design', Number(scale), background); setMessage('Your file is ready. Check your downloads.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Export failed. Please try SVG.'); } finally { setBusy(false); } };
</script>
<StudioDialog open={open} onClose={onClose} title={$t('Made by you. Ready for the world.')}><div class="studio-export" data-export-dialog><div class="studio-export__preview"><img src={`data:image/svg+xml,${encodeURIComponent(documentSvg($document.layers, $t, { background }))}`} alt={$t('Export preview')} /></div><div class="studio-export__settings"><SelectControl label={$t('File format')} data-export-format value={format} onValue={value => { setFormat(value); setMessage(''); }} options={[{ value: 'svg', label: $t('SVG · Scalable vector') }, { value: 'png', label: $t('PNG · Ready to share') }, { value: 'json', label: $t('JSON · Editable document data') }]}></SelectControl>{#if format !== 'json'}<SelectControl label={$t('Resolution')} value={scale} onValue={setScale} options={[{ value: '1', label: '1× · 960 × 640' }, { value: '2', label: '2× · 1920 × 1280' }, { value: '3', label: '3× · 2880 × 1920' }]}></SelectControl><ToggleControl selected={background} onValue={setBackground} label={$t('Add white background')}></ToggleControl>{/if}<p class="studio-description">{#if format === 'json'}{$t('Preserves the complete layer model, including geometry, colors and component references.')}{:else}{$t('Exports visible layers and embedded artwork. Live controls become static vector representations; image adjustments and blend effects are simplified.')}{/if}</p><div role="status" class="studio-export__message">{$t(message)}</div></div></div><svelte:fragment slot="actions"><!-- AWC owns keyboard activation inside its shadow control. -->
<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<md-button variant="text" on:click={onClose}>{$t('Back to canvas')}</md-button><!-- AWC owns keyboard activation inside its shadow control. -->
<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<md-button variant="filled" icon="download" data-download disabled={busy || undefined} on:click={download}>{#if busy}{$t('Preparing…')}{:else}{$t('Download {format}', {format: format.toUpperCase()})}{/if}</md-button></svelte:fragment></StudioDialog>
