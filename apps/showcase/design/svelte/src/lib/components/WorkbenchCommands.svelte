<script lang="ts">
import {pictorSearchText} from '@awc-ui/pictor-model';

import {t} from '$lib/showcase';
import {scrollCommandIntoView} from '@awc-ui/pictor-model';

import {onMount,tick} from 'svelte';import {fileById,getFiles,getProjects,getAssets,projectSlug} from '@awc-ui/showcase-kit/design';import {document} from '$lib/document';import {pathname,navigate} from '$lib/router';import {route} from '$lib/routes';import {objectProps} from '$lib/elements';
type Command={id:string;label:string;detail:string;icon:string;run():void};
let resultList:HTMLElement;
let dialog:HTMLElement & {componentOnReady?:()=>Promise<HTMLElement>};
let open=false,query='',active=0,message='',input:HTMLInputElement,previousFocus:HTMLElement;
const emit=(name:string)=>window.dispatchEvent(new CustomEvent(name));
async function focusSearch(){
  await tick();
  const target=dialog;
  if(!open||!target)return;
  // A newly mounted open dialog does not emit mdOpen during its first load.
  // Wait for Stencil's lazy render before focusing its slotted search input.
  await customElements.whenDefined('md-dialog');
  if(!open||dialog!==target||!target.isConnected)return;
  await target.componentOnReady?.();
  requestAnimationFrame(()=>{
    if(open&&dialog===target&&target.isConnected&&input?.isConnected)input.focus({preventScroll:true});
  });
}
async function openPalette(){if(open)return;let focused=window.document.activeElement;while(focused?.shadowRoot?.activeElement)focused=focused.shadowRoot.activeElement;previousFocus=focused instanceof HTMLElement?focused:null;query='';active=0;open=true;await focusSearch();}
async function closePalette(){open=false;await tick();if(previousFocus?.isConnected&&!window.document.querySelector('md-dialog[open]'))previousFocus.focus({preventScroll:true});previousFocus=null;}
const save=()=>message=$document.save()?'Saved to this browser. Your files and history are here when you return.':'Browser storage is unavailable. Your work is still open; export a copy to keep it.';
const editorAction=async(name:string)=>{if($pathname!==route.editor()&&!$pathname.startsWith('/f/')){navigate(route.editor());await tick()}emit(name)};
$: commands=[
{id:'editor',label:$t('Open canvas'),detail:fileById($document.fileId)?.name??$t('Continue designing'),icon:'draw',run:()=>navigate(route.editor())},
{id:'projects',label:$t('Browse projects'),detail:$t('Your workspace'),icon:'folder_open',run:()=>navigate(route.projects())},
{id:'assets',label:$t('Explore assets'),detail:$t('Images, colors and reusable components'),icon:'grid_view',run:()=>navigate(route.assets())},
{id:'save',label:$t('Save in this browser'),detail:$t('Keep your files, canvas and undo history'),icon:'save',run:save},
{id:'export',label:$t('Export your design'),detail:$t('Download an SVG or PNG'),icon:'download',run:()=>editorAction('pictor:export')},
{id:'present',label:$t('Present canvas'),detail:$t('Explore your design without editor panels'),icon:'play_arrow',run:()=>editorAction('pictor:present')},
{id:'components',label:$t('Explore AWC components'),detail:$t('Inspect the real components powering this screen'),icon:'widgets',run:()=>emit('pictor:components')},
...getFiles().map(file=>({id:'file:'+file.id,label:file.name,detail:$t('Design file'),icon:'draft',run:()=>{$document.openFile(file.id);navigate(route.file(file.id))}})),
...getProjects().map(project=>({id:'project:'+project.id,label:project.name,detail:$t('Project'),icon:'folder',run:()=>navigate(route.project(projectSlug(project)))})),
...getAssets().map(asset=>({id:'asset:'+asset.id,label:asset.name,detail:$t('Asset · {kind}', {kind:$t(asset.kindKey)}),icon:'interests',run:()=>navigate(route.asset(asset.id))}))] satisfies Command[];
$: normalized=pictorSearchText(query);$: results=commands.filter(command=>!normalized||pictorSearchText(`${command.label} ${command.detail} ${command.id}`).includes(normalized)).slice(0,12);$: selected=Math.min(active,Math.max(0,results.length-1));
const choose=(command?:Command)=>{if(command){closePalette();command.run()}};
function keyboard(event:KeyboardEvent){if(event.key==='ArrowDown'){event.preventDefault();active=Math.max(0,Math.min(results.length-1,active+1))}if(event.key==='ArrowUp'){event.preventDefault();active=Math.max(0,active-1)}if(event.key==='Enter'){event.preventDefault();choose(results[selected])}if(event.key==='Escape'){event.preventDefault();closePalette()}}
onMount(()=>{const keydown=(event:KeyboardEvent)=>{if(!(event.metaKey||event.ctrlKey)||event.altKey||event.isComposing)return;if(event.key.toLowerCase()==='k'){event.preventDefault();open?closePalette():openPalette()}if(event.key.toLowerCase()==='s'){event.preventDefault();save()}};window.addEventListener('keydown',keydown);window.addEventListener('pictor:commands',openPalette);window.addEventListener('pictor:save',save);return()=>{window.removeEventListener('keydown',keydown);window.removeEventListener('pictor:commands',openPalette);window.removeEventListener('pictor:save',save)}});
async function scrollSelection(list:HTMLElement,index:number,_results:Command[]){await tick();scrollCommandIntoView(list,index)}
$: if(open) scrollSelection(resultList,selected,results);
</script>
{#if open}<md-dialog bind:this={dialog} locale={$t.locale} class="pictor-command-dialog" open headline={$t('Go anywhere. Make something.')} icon="search" on:mdClose={event=>{if(event.target===event.currentTarget)closePalette()}} on:mdCancel={event=>{if(event.target===event.currentTarget)closePalette()}} on:mdOpen={focusSearch}><div class="pictor-command-search"><input bind:this={input} bind:value={query} on:input={()=>active=0} aria-label={$t('Search commands, projects, files and assets')} placeholder={$t('Search commands, files, projects…')} role="combobox" aria-expanded="true" aria-controls="pictor-command-results" aria-autocomplete="list" aria-activedescendant={results.length?`pictor-command-${selected}`:undefined} on:keydown={keyboard}/></div><div bind:this={resultList} class="pictor-command-results" id="pictor-command-results" role="listbox" aria-label={$t('Commands and destinations')}>{#each results as command,index (command.id)}<button id={`pictor-command-${index}`} type="button" role="option" tabindex="-1" aria-selected={index===selected} class="pictor-command-item" on:mouseenter={()=>active=index} on:click={()=>choose(command)}><span class="pictor-command-icon" aria-hidden="true">{command.icon}</span><span><strong>{command.label}</strong><small>{command.detail}</small></span><span class="pictor-command-enter" aria-hidden="true">↵</span></button>{/each}{#if !results.length}<p class="pictor-command-empty">{$t('No matches. Try “canvas”, “export”, or a project name.')}</p>{/if}</div><div slot="actions" class="pictor-command-hints"><span><kbd>↑</kbd> <kbd>↓</kbd> {$t('to navigate')}</span><span><kbd>Enter</kbd> {$t('to open')}</span><span><kbd>Esc</kbd> {$t('to close')}</span></div></md-dialog>{/if}
<md-snackbar open={!!message||undefined} message={$t(message)} duration={4500} use:objectProps={{open:!!message,message:$t(message)}} on:mdClose={()=>message=''}/>
