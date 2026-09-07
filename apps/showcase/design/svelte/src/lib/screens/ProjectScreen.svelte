<script lang="ts">
import {filesInProject,projectBySlug} from '@awc-ui/showcase-kit/design';
import Screen from '$lib/screens/Screen.svelte';
import TextControl from '$lib/editor/TextControl.svelte';
import NotFoundScreen from '$lib/screens/NotFoundScreen.svelte';
import {documentSvg,ORB_ART} from '@awc-ui/pictor-model';
import {route} from '$lib/routes';
import {document} from '$lib/document'; import {t} from '$lib/showcase'; import {navigate} from '$lib/router'; import Link from '$lib/components/Link.svelte';
export let slug: any = undefined;
let query: any = ''; const setQuery = (value: any) => query = typeof value === "function" ? value(query) : value;
$: project = projectBySlug(slug);
$: projectFiles = project ? filesInProject(project.id) : [];
$: files = projectFiles.filter(file => file.name.toLowerCase().includes(query.toLowerCase()));
$: enterStudio = () => {
    const file = projectFiles.find(item => item.id === $document.fileId) ?? projectFiles[0];
    if (file) $document.openFile(file.id);
    navigate(route.editor());
  };
</script>
{#if project}<Screen title={project.name} subtitle={$t('A shared space for your most interesting ideas.')} crumbLabel={project.name}><div class="pictor-project-banner"><div><span class="pictor-eyebrow">{$t('A SPACE TO CREATE')}</span><h2>{project.name}</h2><p>{$t(project.descriptionKey)}</p><span>{project.fileIds.length} {$t('design files · Built to be explored')}</span></div><img src={ORB_ART.src} alt="" /></div><section class="pictor-section"><div class="pictor-section__head"><h2>{$t('The work in progress')}</h2><TextControl live label={$t('Search this project')} value={query} onValue={setQuery}></TextControl></div><div class="pictor-file-grid">{#each files as file}<md-card class="pictor-file-card" variant="outlined"><Link href={route.file(file.id)} class="pictor-file-preview" aria-label={$t('Open {name}', {name: file.name})}><img src={`data:image/svg+xml,${encodeURIComponent(documentSvg($document.layersForFile(file.id), $t))}`} alt={$t('{name} canvas preview', {name: file.name})} loading="lazy" /><span class="pictor-open-label"><span class="material-symbols-outlined" aria-hidden="true">open_in_new</span> {$t('Open canvas')}</span></Link><div class="pictor-file-meta"><Link href={route.file(file.id)}><strong>{file.name}</strong><span>{$document.layersForFile(file.id).length} {$t('layers ·')} {file.editorHandles.length} {$t('contributors')}</span></Link><span class="material-symbols-outlined" aria-hidden="true">arrow_outward</span></div><div class="pictor-file-footer"><md-chip label={$t(file.stateKey)}></md-chip></div></md-card>{/each}</div>{#if !files.length}<div class="pictor-empty"><span class="material-symbols-outlined" aria-hidden="true">search_off</span><h3>{$t('No files found')}</h3><p>{$t('Try another search.')}</p></div>{/if}</section><svelte:fragment slot="aside"><!-- AWC owns keyboard activation inside its shadow control. -->
<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<md-button variant="tonal" icon="arrow_outward" on:click={enterStudio}>{$t('Enter the studio')}</md-button></svelte:fragment></Screen>{:else}<NotFoundScreen />{/if}
