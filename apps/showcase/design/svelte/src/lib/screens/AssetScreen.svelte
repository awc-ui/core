<script lang="ts">
import {assetById,assetUsage} from '@awc-ui/showcase-kit/design';
import Screen from '$lib/screens/Screen.svelte';
import NotFoundScreen from '$lib/screens/NotFoundScreen.svelte';
import {route} from '$lib/routes';
import {colorOf,documentSvg,layerFromAsset} from '@awc-ui/pictor-model';
import {document} from '$lib/document'; import {t} from '$lib/showcase'; import {navigate} from '$lib/router'; import Link from '$lib/components/Link.svelte';
export let assetId: any = undefined;
$: asset = assetById(assetId);
$: usage = asset ? assetUsage(asset) : [];
$: insert = () => { const layer = layerFromAsset(asset); $document.commitLayers('create', layers => [...layers, layer], [layer.id]); $document.setTool('select'); navigate(route.editor()); };
</script>
{#if asset}<Screen title={asset.name} subtitle={$t('One ingredient. Endless possible compositions.')} crumbLabel={asset.name}><div class="pictor-asset-detail"><div class="pictor-asset-detail__art">{#if asset.art}<img src={asset.art.src} alt={$t(asset.art.altKey)} />{:else}<svg viewBox="0 0 600 400" aria-label={asset.name}><rect width="600" height="400" fill={colorOf(asset.color, '#E6EBDC')}></rect>{#if asset.kind === 'text-style'}<text x="70" y="270" font-size="210" font-family="Georgia,serif" fill="#203D35">Aa</text>{/if}</svg>{/if}</div><div class="pictor-asset-detail__copy"><span class="pictor-eyebrow">{$t('YOUR CREATIVE INGREDIENT')}</span><h2>{asset.name}</h2><md-chip label={$t(asset.kindKey)}></md-chip><p>{$t('Add this asset as an editable layer in your current design. Move it, resize it, and make it part of something new.')}</p>{#if asset.color}<code>{colorOf(asset.color)}</code>{/if}<!-- AWC owns keyboard activation inside its shadow control. -->
<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<md-button variant="filled" icon="add" on:click={insert}>{$t('Use in my design')}</md-button><!-- AWC owns keyboard activation inside its shadow control. -->
<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<md-button variant="text" icon="arrow_back" on:click={() => navigate(route.assets())}>{$t('Explore the library')}</md-button></div></div><section class="pictor-section"><div class="pictor-section__head"><h2>{$t('Related designs')}</h2><span class="pictor-muted">{usage.length} {$t('design files')}</span></div><div class="pictor-file-grid">{#each usage as file}<md-card class="pictor-file-card" variant="outlined"><Link href={route.file(file.id)} class="pictor-file-preview"><img src={`data:image/svg+xml,${encodeURIComponent(documentSvg($document.layersForFile(file.id), $t))}`} alt={$t('{name} design', {name: file.name})} /></Link><div class="pictor-file-meta"><Link href={route.file(file.id)}><strong>{file.name}</strong><span>{$document.layersForFile(file.id).length} {$t('editable layers')}</span></Link><span class="material-symbols-outlined" aria-hidden="true">arrow_outward</span></div></md-card>{/each}</div>{#if !usage.length}<p class="studio-description">{$t('Be the first to put this asset to work in your current canvas.')}</p>{/if}</section><svelte:fragment slot="aside"><!-- AWC owns keyboard activation inside its shadow control. -->
<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<md-button variant="filled" icon="add" on:click={insert}>{$t('Add to canvas')}</md-button></svelte:fragment></Screen>{:else}<NotFoundScreen />{/if}
