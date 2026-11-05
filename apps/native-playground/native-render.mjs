import { nativeCaptureViewport, supportsNativeViewportTag } from './native-viewport.js';
import { validateSkeletonLengths } from './skeleton-appearance.js';
import { segmentedContextOptions } from './segmented-context.js';
import { buttonGroupSelectionOptions } from './button-group-state.js';
import { nativeContentSlots } from './content-slots.js';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { access, mkdir, readFile, writeFile, rename, unlink, stat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import { nativeThemeOptions } from './native-theme-options.js';

const run = promisify(execFile);
const MAX_BODY = 128 * 1024;
const PNG_SIGNATURE = Buffer.from([137,80,78,71,13,10,26,10]);
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key,canonical(value[key])])) : value;

export class RenderError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}

export function validateRenderRequest(value, tags) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new RenderError(400,'INVALID_REQUEST','Send a component render request.');
  if (typeof value.tag !== 'string' || !tags.has(value.tag)) throw new RenderError(400,'UNKNOWN_COMPONENT','Choose an existing AWC component.');
  const props = value.properties === undefined ? {} : value.properties;
  if (props === null || typeof props !== 'object' || Array.isArray(props)) throw new RenderError(400,'INVALID_PROPERTIES','Properties must be a JSON object.');
  if (value.dark !== undefined && typeof value.dark !== 'boolean') throw new RenderError(400,'INVALID_THEME','dark must be a boolean.');
  if (value.width !== undefined && (typeof value.width !== 'number' || !Number.isFinite(value.width))) throw new RenderError(400,'INVALID_WIDTH','width must be a finite number.');
  if (value.height !== undefined && (!supportsNativeViewportTag(value.tag) || typeof value.height !== 'number' || !Number.isFinite(value.height) || value.height <= 0)) throw new RenderError(400, 'INVALID_HEIGHT', 'height must be a finite positive overlay viewport size.');
  if (value.scenario !== undefined && (!['button-behavior', 'navigation-events', 'focus-accessibility'].includes(value.scenario) || value.tag !== 'md-button')) throw new RenderError(400,'INVALID_SCENARIO','Choose a supported native example for md-button.');
  if (value.text !== undefined && (value.tag !== 'md-button' || typeof value.text !== 'string' || Buffer.byteLength(value.text, 'utf8') > 4096)) throw new RenderError(400,'INVALID_TEXT','Button text must be a string of at most 4096 UTF-8 bytes.');
  if (value.buttonAppearance !== undefined && value.tag !== 'md-button') throw new RenderError(400, 'INVALID_BUTTON_APPEARANCE', 'Local button appearance applies to md-button only.');
  if (value.badgeAppearance !== undefined && value.tag !== 'md-badge') throw new RenderError(400, 'INVALID_BADGE_APPEARANCE', 'Local badge appearance applies to md-badge only.');
  if (value.statusDotAppearance !== undefined && value.tag !== 'md-status-dot') throw new RenderError(400, 'INVALID_STATUS_DOT_APPEARANCE', 'Local status dot appearance applies to md-status-dot only.');
  if (value.loadingIndicatorAppearance !== undefined && value.tag !== 'md-loading-indicator') throw new RenderError(400, 'INVALID_LOADING_INDICATOR_APPEARANCE', 'Local loading indicator appearance applies to md-loading-indicator only.');
  if (value.tooltipAppearance !== undefined && value.tag !== 'md-tooltip') throw new RenderError(400, 'INVALID_TOOLTIP_APPEARANCE', 'Local tooltip appearance applies to md-tooltip only.');
  if (value.snackbarAppearance !== undefined && value.tag !== 'md-snackbar') throw new RenderError(400, 'INVALID_SNACKBAR_APPEARANCE', 'Local snackbar appearance applies to md-snackbar only.');
  if (value.skeletonAppearance !== undefined && value.tag !== 'md-skeleton') throw new RenderError(400, 'INVALID_SKELETON_APPEARANCE', 'Local skeleton appearance applies to md-skeleton only.');
  if (value.progressIndicatorAppearance !== undefined && value.tag !== 'md-progress-indicator') throw new RenderError(400, 'INVALID_PROGRESS_INDICATOR_APPEARANCE', 'Local progress appearance applies to md-progress-indicator only.');
  if (value.meterAppearance !== undefined && value.tag !== 'md-meter') throw new RenderError(400, 'INVALID_METER_APPEARANCE', 'Local meter appearance applies to md-meter only.');
  if (value.iconButtonAppearance !== undefined && value.tag !== 'md-icon-button') throw new RenderError(400, 'INVALID_ICON_BUTTON_APPEARANCE', 'Local icon button appearance applies to md-icon-button only.');
  if (value.splitButtonAppearance !== undefined && value.tag !== 'md-split-button') throw new RenderError(400, 'INVALID_SPLIT_BUTTON_APPEARANCE', 'Local split button appearance applies to md-split-button only.');
  if (value.fabAppearance !== undefined && value.tag !== 'md-fab') throw new RenderError(400, 'INVALID_FAB_APPEARANCE', 'Local FAB appearance applies to md-fab only.');
  if (value.dividerAppearance !== undefined && value.tag !== 'md-divider') throw new RenderError(400, 'INVALID_DIVIDER_APPEARANCE', 'Local divider appearance applies to md-divider only.');
  for (const [key, tag, code] of [['colorPickerAppearance', 'md-color-picker', 'INVALID_COLOR_PICKER_APPEARANCE'], ['timePickerAppearance', 'md-time-picker', 'INVALID_TIME_PICKER_APPEARANCE'], ['fabMenuAppearance', 'md-fab-menu', 'INVALID_FAB_MENU_APPEARANCE'], ['fabMenuItemAppearance', 'md-fab-menu-item', 'INVALID_FAB_MENU_ITEM_APPEARANCE'], ['accordionAppearance', 'md-accordion', 'INVALID_ACCORDION_APPEARANCE'], ['accordionItemAppearance', 'md-accordion-item', 'INVALID_ACCORDION_ITEM_APPEARANCE'], ['avatarAppearance', 'md-avatar', 'INVALID_AVATAR_APPEARANCE'], ['switchAppearance', 'md-switch', 'INVALID_SWITCH_APPEARANCE'], ['checkboxAppearance', 'md-checkbox', 'INVALID_CHECKBOX_APPEARANCE'], ['radioAppearance', 'md-radio', 'INVALID_RADIO_APPEARANCE'], ['chipAppearance', 'md-chip', 'INVALID_CHIP_APPEARANCE'], ['rippleAppearance', 'md-ripple', 'INVALID_RIPPLE_APPEARANCE'], ['toolbarAppearance', 'md-toolbar', 'INVALID_TOOLBAR_APPEARANCE'], ['stepperAppearance', 'md-stepper', 'INVALID_STEPPER_APPEARANCE'], ['stepAppearance', 'md-step', 'INVALID_STEP_APPEARANCE'], ['sliderAppearance', 'md-slider', 'INVALID_SLIDER_APPEARANCE'], ['ratingAppearance', 'md-rating', 'INVALID_RATING_APPEARANCE'], ['menuAppearance', 'md-menu', 'INVALID_MENU_APPEARANCE'], ['lineChartAppearance', 'md-line-chart', 'INVALID_CHART_APPEARANCE'], ['areaChartAppearance', 'md-area-chart', 'INVALID_CHART_APPEARANCE'], ['barChartAppearance', 'md-bar-chart', 'INVALID_CHART_APPEARANCE'], ['pieChartAppearance', 'md-pie-chart', 'INVALID_CHART_APPEARANCE'], ['sparklineAppearance', 'md-sparkline', 'INVALID_CHART_APPEARANCE'], ['navigationBarAppearance', 'md-navigation-bar', 'INVALID_NAVIGATION_BAR_APPEARANCE'], ['navigationTabAppearance', 'md-navigation-tab', 'INVALID_NAVIGATION_TAB_APPEARANCE'], ['tabsAppearance', 'md-tabs', 'INVALID_TABS_APPEARANCE'], ['tabAppearance', 'md-tab', 'INVALID_TAB_APPEARANCE'], ['breadcrumbsAppearance', 'md-breadcrumbs', 'INVALID_BREADCRUMBS_APPEARANCE'], ['breadcrumbItemAppearance', 'md-breadcrumb-item', 'INVALID_BREADCRUMB_ITEM_APPEARANCE'], ['dialogAppearance', 'md-dialog', 'INVALID_DIALOG_APPEARANCE'], ['bottomSheetAppearance', 'md-bottom-sheet', 'INVALID_BOTTOM_SHEET_APPEARANCE'], ['sideSheetAppearance', 'md-side-sheet', 'INVALID_SIDE_SHEET_APPEARANCE'], ['listAppearance', 'md-list', 'INVALID_LIST_APPEARANCE'], ['listItemAppearance', 'md-list-item', 'INVALID_LIST_ITEM_APPEARANCE'], ['cardAppearance', 'md-card', 'INVALID_CARD_APPEARANCE'], ['orgChartAppearance', 'md-organization-chart', 'INVALID_ORG_CHART_APPEARANCE'], ['textFieldAppearance', 'md-text-field', 'INVALID_TEXT_FIELD_APPEARANCE'], ['numberFieldAppearance', 'md-number-field', 'INVALID_NUMBER_FIELD_APPEARANCE'], ['otpFieldAppearance', 'md-otp-field', 'INVALID_OTP_FIELD_APPEARANCE'], ['tableAppearance', 'md-table', 'INVALID_TABLE_APPEARANCE'], ['tableCellAppearance', 'md-table-cell', 'INVALID_TABLE_CELL_APPEARANCE'], ['tableContainerAppearance', 'md-table-container', 'INVALID_TABLE_CONTAINER_APPEARANCE'], ['tableExpandToggleAppearance', 'md-table-expand-toggle', 'INVALID_TABLE_EXPAND_TOGGLE_APPEARANCE'], ['tablePaginationAppearance', 'md-table-pagination', 'INVALID_TABLE_PAGINATION_APPEARANCE'], ['tableRowAppearance', 'md-table-row', 'INVALID_TABLE_ROW_APPEARANCE'], ['tableSortLabelAppearance', 'md-table-sort-label', 'INVALID_TABLE_SORT_LABEL_APPEARANCE'], ['tableToolbarAppearance', 'md-table-toolbar', 'INVALID_TABLE_TOOLBAR_APPEARANCE']]) {
    if (value[key] !== undefined && value.tag !== tag) throw new RenderError(400, code, 'Local appearance applies only to its matching component.');
  }
  if (value.segmentedButtonAppearance !== undefined && value.tag !== 'md-segmented-button') throw new RenderError(400, 'INVALID_SEGMENTED_BUTTON_APPEARANCE', 'Local segmented button appearance applies to md-segmented-button only.');
  if (value.buttonGroupAppearance !== undefined && value.tag !== 'md-button-group') throw new RenderError(400, 'INVALID_BUTTON_GROUP_APPEARANCE', 'Local button group appearance applies to md-button-group only.');
  function depth(v, level=0) {
    if (level>32) throw new RenderError(400,'INVALID_PROPERTIES','Property nesting is too deep.');
    if (v && typeof v==='object') for(const child of Object.values(v))depth(child,level+1);
  }
  depth(props);
  let themeOptions;
  try {
    if (value.tag === 'md-skeleton') validateSkeletonLengths(props);
    themeOptions = { ...nativeThemeOptions(value), ...nativeContentSlots(value.slots, value.tag), ...buttonGroupSelectionOptions(value.buttonGroupSelection, value.tag), ...segmentedContextOptions(value.segmentedContext, value.tag) };
  }
  catch (error) { throw new RenderError(400, error.code || 'INVALID_THEME', error.message); }
  return {tag:value.tag,properties:canonical(props),dark:value.dark??false,width:nativeCaptureViewport(value.width ?? 640).width,...(supportsNativeViewportTag(value.tag) && value.height !== undefined ? { height: nativeCaptureViewport(value.width ?? 640, value.height).height } : {}),...(value.scenario ? {scenario:value.scenario} : {}),...(value.text !== undefined ? {text:value.text} : {}),...themeOptions};
}

export async function readLocalJSONRequest(req) {
  if (!/^application\/json(?:;|$)/i.test(req.headers['content-type']??'')) throw new RenderError(415,'JSON_REQUIRED','Send application/json.');
  const host = req.headers.host??'';
  if (!/^(?:127\.0\.0\.1|localhost)(?::\d+)?$/.test(host)) throw new RenderError(403,'LOCAL_ONLY','Native rendering is available only on localhost.');
  if ((req.headers.origin && req.headers.origin !== `http://${host}`) || req.headers['sec-fetch-site']==='cross-site') throw new RenderError(403,'ORIGIN_REJECTED','Use the local AWC playground to request native renders.');
  if(Number(req.headers['content-length'])>MAX_BODY) throw new RenderError(413,'REQUEST_TOO_LARGE','The render request is too large.');
  let size=0;const chunks=[];
  for await (const chunk of req) {
    size+=chunk.length;if(size>MAX_BODY)throw new RenderError(413,'REQUEST_TOO_LARGE','The render request is too large.');
    chunks.push(chunk);
  }
  let value;try{value=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new RenderError(400,'INVALID_JSON','Properties must be valid JSON.');}
  return value;
}

export async function readRenderRequest(req, tags) {
  return validateRenderRequest(await readLocalJSONRequest(req),tags);
}

export function createNativeRenderer({repoRoot, executable=process.env.AWC_NATIVE_RENDERER, renderRoot, platform=process.platform, execute=run}={}) {
  const binary=path.resolve(executable||path.join(repoRoot,'apps/native-ios-playground/.build/debug/AWCSnapshots'));
  const directory=path.resolve(renderRoot||path.join(repoRoot,'.cache/native-playground/renders'));
  let fingerprint;let active=0;
  const pending=new Map();
  async function status(){
    if(platform!=='darwin')return {available:false,platform:'macos',renderer:'SwiftUI',message:'The SwiftUI renderer requires macOS. Use the native Android playground on other systems.'};
    try{await access(binary,constants.X_OK);return {available:true,platform:'macos',renderer:'SwiftUI',message:'Real SwiftUI snapshot rendered with the macOS SDK. This is not an iOS simulator render.'};}
    catch{return {available:false,platform:'macos',renderer:'SwiftUI',message:'Build the renderer: swift build --package-path apps/native-ios-playground --product AWCSnapshots. Then refresh this preview.'};}
  }
  async function render(request){
    if(request.scenario)throw new RenderError(400,'LIVE_SCENARIO_REQUIRED','Use Live mode for interactive native examples.');
    const availability=await status();if(!availability.available)throw new RenderError(503,'RENDERER_UNAVAILABLE',availability.message);
    const binaryInfo=await stat(binary),signature=`${binaryInfo.size}:${binaryInfo.mtimeMs}`;
    if(fingerprint?.signature!==signature)fingerprint={signature,hash:createHash('sha256').update(await readFile(binary)).digest('hex')};
    const key=createHash('sha256').update(fingerprint.hash).update(JSON.stringify(request)).digest('hex');
    const output=path.join(directory,`${key}.png`);
    const metadata=path.join(directory,`${key}.json`);
    try{
      const [result,png]=await Promise.all([readFile(metadata,'utf8').then(JSON.parse),readFile(output)]);
      if(png.subarray(0,8).equals(PNG_SIGNATURE))return result;
    }catch{}
    if(pending.has(key))return pending.get(key);
    if(active>=2)throw new RenderError(429,'RENDERER_BUSY','The native renderer is busy. Try again in a moment.');
    const work=(async()=>{
      active++;
      const id=randomUUID(),input=path.join(directory,`${id}.request.json`),temporary=path.join(directory,`${id}.png`);
      try{
        await mkdir(directory,{recursive:true});await writeFile(input,JSON.stringify(request),{mode:0o600});
        const {stdout}=await execute(binary,['--request',input,'--output',temporary],{timeout:20000,maxBuffer:1024*1024,windowsHide:true});
        let details;try{details=JSON.parse(stdout.trim());}catch{throw new RenderError(502,'INVALID_RENDER','The native renderer returned invalid metadata.');}
        const png=await readFile(temporary);
        if(!png.subarray(0,8).equals(PNG_SIGNATURE)||details.tag!==request.tag||!Number.isFinite(details.width)||!Number.isFinite(details.height))throw new RenderError(502,'INVALID_RENDER','The native renderer did not produce a valid component image.');
        const result={imageUrl:`/native-renders/${key}.png`,platform:'macos',renderer:'SwiftUI',tag:request.tag,width:details.width,height:details.height};
        await rename(temporary,output);await writeFile(metadata,JSON.stringify(result));return result;
      }catch(error){
        if(error instanceof RenderError)throw error;
        throw new RenderError(502,'RENDER_FAILED',error.killed?'The native render timed out. Try a simpler configuration.':'SwiftUI could not render this configuration. Check the native renderer or try Reset.');
      }finally{
        active--;pending.delete(key);await Promise.allSettled([unlink(input),unlink(temporary)]);
      }
    })();
    pending.set(key,work);return work;
  }
  return {status,render,directory};
}
