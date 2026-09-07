import { scrollCommandIntoView, pictorSearchText } from '@awc-ui/pictor-model';
import { translateUi as p } from './context';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';
import 'material-symbols/outlined.css';
import '@awc-ui/core/css/tokens.css';
import '@awc-ui/core/css/pre-upgrade.css';
import '@awc-ui/showcase-kit/design/app.css';
import '@awc-ui/pictor-model/styles.css';
import { dom, Fragment, replace } from './dom';
import { connect, getDocument, getTranslator, store, routeBinding, withBase, ui, field } from './context';
import { StudioDialog } from './controls';
import { ProjectsScreen } from './views/ProjectsScreen';
import { ProfileScreen } from './views/ProfileScreen';
import { AssetsScreen } from './views/AssetsScreen';
import { ProjectScreen } from './views/ProjectScreen';
import { AssetScreen } from './views/AssetScreen';
import { NotFoundScreen } from './views/NotFoundScreen';
import { ExportDialog } from './views/ExportDialog';
import { ComponentLens, openComponentLens } from './views/ComponentLens';
import { mountCanvas } from './canvas';
import { mountEditor, showInsert } from './editor';
import { subscribeShowcaseState } from '@awc-ui/showcase-kit/dock';
import { DESTINATIONS, FRAMEWORKS, SHOWCASE_BASE, destinationIndex, fileById, getViewer, getFiles, getAssets, getProjects, projectSlug, route } from '@awc-ui/showcase-kit/design';

const root=document.getElementById('root')!;
const appbar=<div class="html-appbar-mount"/>, railMount=<div class="html-rail-mount"/>, barMount=<div class="html-bar-mount"/>, main=<main class="shell__main"/>;
const overlays=<div/>, presentation=<div/>;
const dock=<awc-showcase-dock collapsed="" frameworks={FRAMEWORKS.join(',')} framework="html" base-path={SHOWCASE_BASE} position="bottom" label={p("Design & Image")}/>;
replace(root,<><div class="shell">{appbar}<div class="shell__body">{railMount}{main}</div>{barMount}</div>{dock}{overlays}{presentation}</>);
// Transparent native mounting nodes keep the same shell grid as every port.
for(const node of [appbar,railMount,barMount])node.classList.add('awc-root');
let path=readPath(), renderedPath='', expanded=false, exportOpen=false, presentOpen=false, scheduled=false, rendering=false;
let editor:ReturnType<typeof mountEditor>|undefined, preview:ReturnType<typeof mountCanvas>|undefined;
let previousFocus:HTMLElement|null=null;
function readPath(){const suffix=location.pathname.slice(routeBinding.basePath.length)||'/';return suffix.endsWith('/')?suffix:suffix+'/';}
function navigate(next:string){
  if(next===path)return;
  getDocument().save();
  history.pushState({},'',withBase(next)+location.search);path=next;
  if(next.startsWith('/f/'))getDocument().openFile(decodeURIComponent(next.split('/')[2]));
  for(const key of [...ui.keys()])if(!key.startsWith('ComponentLens:')&&!key.startsWith('commands:'))ui.delete(key);
  editor?.destroy();editor=undefined;renderedPath='';main.scrollTop=0;requestRender();
}
function requestRender(){if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;render();});}
connect(requestRender,navigate);
const openExport=()=>{exportOpen=true;requestRender();};
const openPresent=()=>{presentOpen=true;requestRender();};
const closePresent=()=>{presentOpen=false;preview?.destroy();preview=undefined;replace(presentation,null);requestRender();};
const editorAction=(action:()=>void)=>{if(!editor){navigate(route.editor());requestAnimationFrame(action);}else action();};
const save=()=>{ui.set('toast',getDocument().save()?"Saved to this browser. Your files and history are here when you return.":"Browser storage is unavailable. Export a copy to keep your work.");requestRender();};

function AppBar(){
  const t=getTranslator(),viewer=getViewer(),doc=getDocument(),compact=matchMedia('(max-width:899px)').matches;
  const bar=<md-app-bar class="shell__appbar" variant="small" subtitle={t('design.app.title')} leading-icon={compact?undefined:'menu'} leading-icon-label={compact?undefined:p("Open navigation")}>
    <span slot="headline" class="shell__brand">{t('design.app.brand')}</span>
    <div slot="trailing" class="pictor-studio-actions"><span class="pictor-save-state" data-state={doc.saveStatus}><span class="pictor-save-dot"/>{doc.saveStatus==='saved'?p("Saved locally"):doc.saveStatus==='unavailable'?p("Storage unavailable"):p("Saving…")}</span><button class="pictor-command-trigger" aria-label={p("Open command palette")} onClick={openCommands}><span>{p("Quick actions")}</span><kbd>⌘ K</kbd></button><md-button variant="text" icon="widgets" onClick={openComponentLens}>{p("Components")}</md-button></div>
    <md-avatar slot="trailing" src={viewer.art.src} name={viewer.displayName} label={p('Signed in as {name}', {name: viewer.displayName})} size="small"/>
  </md-app-bar>;
  bar.addEventListener('mdLeadingClick',()=>{expanded=!expanded;requestRender();});
  return bar;
}
function navigation(compact:boolean){
  const t=getTranslator(),index=destinationIndex(path);
  const nav=compact
    ?<md-navigation-bar class="shell__bar" aria-label={t('design.nav.label')} active-index={index} label-behavior="always">{DESTINATIONS.map(d=><md-navigation-tab data-value={d.value} icon={d.icon} active-icon={d.activeIcon} label={t(d.labelKey)} href={withBase(d.path)}/>)}</md-navigation-bar>
    :<md-navigation-rail class="shell__rail" label={t('design.nav.label')} variant={expanded?'expanded':'standard'} active-index={index} label-visibility="all">{DESTINATIONS.map(d=><md-navigation-rail-tab data-value={d.value} value={d.value} icon={d.icon} label={t(d.labelKey)} href={withBase(d.path)}/>)}</md-navigation-rail>;
  nav.addEventListener('click',(e:MouseEvent)=>{
    if(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
    const tab=e.composedPath().find(node=>node instanceof HTMLElement&&node.matches('md-navigation-tab,md-navigation-rail-tab')) as HTMLElement|undefined;
    const target=DESTINATIONS.find(d=>d.value===tab?.dataset.value);if(target){e.preventDefault();navigate(target.path);}
  },true);
  return nav;
}
function openCommands(){previousFocus=document.activeElement as HTMLElement;ui.set('commands:open',true);ui.set('commands:query','');ui.set('commands:active',0);requestRender();setTimeout(()=>document.querySelector<HTMLInputElement>('.pictor-command-search input')?.focus(),80);}
function closeCommands(){ui.set('commands:open',false);requestRender();setTimeout(()=>{if(!document.querySelector('md-dialog[open]')){const target=previousFocus?.isConnected?previousFocus:document.querySelector<HTMLElement>('.pictor-command-trigger');target?.focus();}},80);}
function Toast(){
  const message=ui.get('toast');if(!message)return null;
  const snackbar=<md-snackbar open message={p(message)} duration={4500}/>;
  snackbar.addEventListener('mdClose',(event:Event)=>{if(event.target===snackbar){ui.delete('toast');requestRender();}});
  return snackbar;
}
function Commands(){
  const [open]=field('commands:open',false),[query,setQuery]=field('commands:query',''),[active,setActive]=field('commands:active',0);
  if(!open)return null;
  // Source-language aliases stay searchable while labels follow the locale.
  const commands=[
    {label:p("Open canvas"), keywords: "Open canvas Continue designing editor",detail:fileById(getDocument().fileId)?.name??p("Continue designing"),icon:'draw',run:()=>navigate(route.editor())},
    {label:p("Browse projects"), keywords: "Browse projects Your workspace",detail:p("Your workspace"),icon:'folder_open',run:()=>navigate(route.projects())},
    {label:p("Explore assets"), keywords: "Explore assets Images colors reusable components library",detail:p("Images, colors and reusable components"),icon:'grid_view',run:()=>navigate(route.assets())},
    {label:p("Save in this browser"), keywords: "Save in this browser Keep your files canvas and undo history",detail:p("Keep your files, canvas and undo history"),icon:'save',run:save},
    {label:p("Export your design"), keywords: "Export your design Download SVG PNG JSON",detail:p("Download SVG, PNG or JSON"),icon:'download',run:()=>editorAction(openExport)},
    {label:p("Present canvas"), keywords: "Present canvas Explore your design without editor panels preview presentation",detail:p("Explore your design without editor panels"),icon:'play_arrow',run:()=>editorAction(openPresent)},
    {label:p("Explore AWC components"), keywords: "Explore AWC components Inspect the real components powering this screen API widgets",detail:p("Inspect the real components powering this screen"),icon:'widgets',run:openComponentLens},
    ...getFiles().map(file=>({label:file.name,detail:p("Design file"),keywords:"Design file",icon:'draft',run:()=>navigate(route.file(file.id))})),
    ...getProjects().map(project=>({label:project.name,detail:p("Project"),keywords:"Project",icon:'folder',run:()=>navigate(route.project(projectSlug(project)))})),
    ...getAssets().map(asset=>({label:asset.name,detail:p('Asset · {kind}', {kind: getTranslator()(asset.kindKey)}),keywords:`Asset ${asset.kind} ${asset.kind.replaceAll('-', ' ')}`,icon:'interests',run:()=>navigate(route.asset(asset.id))})),
  ].filter(item=>pictorSearchText(item.label+' '+item.detail+' '+item.keywords).includes(pictorSearchText(query))).slice(0,12);
  const selected=Math.min(active,Math.max(0,commands.length-1));
  const choose=(index:number)=>{const item=commands[index];if(item){closeCommands();item.run();}};
  // Arrow navigation updates this mounted native list. Replacing md-dialog on
  // every key discards its scroll position before Stencil has laid out the new
  // shadow tree, even while the replacement input regains focus.
  const activate=(index:number)=>{
    const next=Math.max(0,Math.min(commands.length-1,index));
    ui.set('commands:active',next);
    const input=dialog.querySelector<HTMLInputElement>('input[role="combobox"]');
    if(commands.length)input?.setAttribute('aria-activedescendant','pictor-command-'+next);
    else input?.removeAttribute('aria-activedescendant');
    const list=dialog.querySelector<HTMLElement>('.pictor-command-results');
    list?.querySelectorAll<HTMLElement>('[role="option"]').forEach((item,i)=>item.setAttribute('aria-selected',String(i===next)));
    scrollCommandIntoView(list,next);
  };
  const dialog:HTMLElement=<md-dialog locale={getTranslator().locale} class="pictor-command-dialog" open headline={p("Go anywhere. Make something.")} icon="search">
    <div class="pictor-command-search"><input value={query} aria-label={p("Search commands, projects, files and assets")} placeholder={p("Search commands, files, projects…")} role="combobox" aria-expanded="true" aria-controls="pictor-command-results" aria-autocomplete="list" aria-activedescendant={commands.length?'pictor-command-'+selected:undefined}
      onInput={(e:Event)=>{setQuery((e.target as HTMLInputElement).value);setActive(0);}}
      onKeyDown={(e:KeyboardEvent)=>{if(e.key==='ArrowDown'){e.preventDefault();activate(Number(ui.get('commands:active')??0)+1);}if(e.key==='ArrowUp'){e.preventDefault();activate(Number(ui.get('commands:active')??0)-1);}if(e.key==='Enter'){e.preventDefault();choose(Number(ui.get('commands:active')??0));}if(e.key==='Escape'){e.preventDefault();closeCommands();}}}/></div>
    <div class="pictor-command-results" id="pictor-command-results" role="listbox" aria-label={p("Commands and destinations")}>{commands.map((item,index)=><button id={'pictor-command-'+index} role="option" tabIndex={-1} aria-selected={index===selected} class="pictor-command-item" onClick={()=>choose(index)}><span class="pictor-command-icon" aria-hidden="true">{item.icon}</span><span><strong>{item.label}</strong><small>{item.detail}</small></span><span class="pictor-command-enter">↵</span></button>)}{!commands.length?<p class="pictor-command-empty">{p("No matches. Try “canvas”, “export”, or a project name.")}</p>:null}</div>
    <div slot="actions" class="pictor-command-hints"><span><kbd>↑</kbd> <kbd>↓</kbd>  {p("to navigate")}</span><span><kbd>Enter</kbd>  {p("to open")}</span><span><kbd>Esc</kbd>  {p("to close")}</span></div>
  </md-dialog>;
  // Query, locale or document changes can still rebuild the dialog. Wait for
  // its own first render and layout before restoring the current active row.
  const ready=(dialog as HTMLElement & {componentOnReady?:()=>Promise<unknown>}).componentOnReady?.();
  void Promise.resolve(ready).then(()=>requestAnimationFrame(()=>{
    if(dialog.isConnected)scrollCommandIntoView(dialog.querySelector('.pictor-command-results'),Number(ui.get('commands:active')??0));
  }));
  dialog.addEventListener('mdClose',(e:Event)=>{if(e.target===dialog)closeCommands();});return dialog;
}
function focusBookmark(){
  let active:any=document.activeElement,host:any=active;
  while(active?.shadowRoot?.activeElement){host=active;active=active.shadowRoot.activeElement;}
  if(!active?.matches?.('input,textarea'))return null;
  const selector=host===active?(active.getAttribute('aria-label')?'input[aria-label="'+CSS.escape(active.getAttribute('aria-label'))+'"]':null):host.localName+'[label="'+CSS.escape(host.getAttribute('label')??'')+'"]';
  return selector?{selector,start:active.selectionStart,end:active.selectionEnd}:null;
}
function restoreFocus(bookmark:ReturnType<typeof focusBookmark>){
  if(!bookmark)return;
  requestAnimationFrame(()=>{let target:any=document.querySelector(bookmark.selector);for(let depth=0;target?.shadowRoot&&depth<6;depth++)target=target.shadowRoot.querySelector('input,textarea,md-text-field')??target;target?.focus?.({preventScroll:true});try{target?.setSelectionRange?.(bookmark.start,bookmark.end);}catch{}});
}
function render(){
  if(rendering)return;rendering=true;const bookmark=focusBookmark();
  try{
    replace(appbar,AppBar());const compact=matchMedia('(max-width:899px)').matches;replace(railMount,compact?null:navigation(false));replace(barMount,compact?navigation(true):null);
    const fileMatch=/^\/f\/([^/]+)\/$/.exec(path);
    const isEditor=path===route.editor()||!!fileMatch;
    if(isEditor&&(!fileMatch||fileById(decodeURIComponent(fileMatch[1])))){
      if(!editor){if(fileMatch)getDocument().openFile(decodeURIComponent(fileMatch[1]));editor=mountEditor(main,openExport,openPresent);}else editor.render();
    }else{
      editor?.destroy();editor=undefined;
      const project=/^\/p\/([^/]+)\/$/.exec(path),asset=/^\/a\/([^/]+)\/$/.exec(path);
      replace(main,path==='/'?<ProjectsScreen/>:path===route.profile()?<ProfileScreen/>:path===route.assets()?<AssetsScreen/>:project?<ProjectScreen slug={decodeURIComponent(project[1])}/>:asset?<AssetScreen assetId={decodeURIComponent(asset[1])}/>:<NotFoundScreen/>);
    }
    renderedPath=path;
    replace(overlays,<><ExportDialog open={exportOpen} onClose={()=>{exportOpen=false;requestRender();}}/><Commands/><ComponentLens/>{<Toast/>}</>);
    if(presentOpen&&!preview){
      const host=<div/>;
      replace(presentation,<StudioDialog open onClose={closePresent} title={p("Your idea, center stage")} fullscreen actions={<md-button variant="filled" icon="close" data-close-present onClick={closePresent}>{p("Back to studio")}</md-button>}><div class="studio-presentation"><div class="studio-presentation__intro"><span class="pictor-eyebrow">{p("THE FINISHED PICTURE")}</span><p>{p("Live AWC controls are interactive here. Try a button, field or switch.")}</p></div>{host}</div></StudioDialog>);
      preview=mountCanvas(host,true);
    }
  }finally{rendering=false;restoreFocus(bookmark);}
}
let paintedLayers=getDocument().layers;
store.subscribe(()=>{requestRender();const layers=getDocument().layers;if(preview && layers!==paintedLayers)preview.render();paintedLayers=layers;});
let paintedLocale=getTranslator().locale;
subscribeShowcaseState(()=>{
  const locale=getTranslator().locale;
  if(locale!==paintedLocale){editor?.destroy();editor=undefined;preview?.destroy();preview=undefined;paintedLocale=locale;}
  requestRender();
});
window.addEventListener('popstate',()=>{path=readPath();editor?.destroy();editor=undefined;requestRender();});
window.addEventListener('pictor:commands',openCommands);
window.addEventListener('pictor:components',openComponentLens);
window.addEventListener('pictor:save',save);
window.addEventListener('pictor:export',()=>editorAction(openExport));
window.addEventListener('pictor:present',()=>editorAction(openPresent));
window.addEventListener('pictor:insert',()=>editorAction(()=>showInsert()));
window.addEventListener('keydown',(e:KeyboardEvent)=>{if(!(e.metaKey||e.ctrlKey)||e.altKey||e.isComposing)return;if(e.key.toLowerCase()==='k'){e.preventDefault();ui.get('commands:open')?closeCommands():openCommands();}if(e.key.toLowerCase()==='s'){e.preventDefault();save();}});
matchMedia('(max-width:899px)').addEventListener('change',requestRender);
render();
