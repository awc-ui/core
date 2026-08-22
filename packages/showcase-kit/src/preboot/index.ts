/**
 * `@awc-ui/showcase-kit/preboot`
 *
 * A standalone, dependency-free IIFE the host page inlines in `<head>`, before
 * any stylesheet or app bundle. It reads the same URL params and the same
 * localStorage key the dock writes, and stamps `html[lang|dir|data-theme|data-density]`
 * synchronously — so the first paint is already in the right theme, density and
 * direction and there is no flash.
 *
 * It deliberately does NOT apply the accent preset: that is a ~3 kB stylesheet
 * per seed and would blow the size budget. `@awc-ui/showcase-kit/dock` injects it
 * on import, which still runs before the app renders its own markup.
 *
 * Contract, matching main-llm.md §2.1:
 *   - `lang`         always written
 *   - `dir`          always written, "ltr" or "rtl"
 *   - `data-theme`   written as "dark", or REMOVED. Never "light".
 *   - `data-density` written as "-1".."-4", or REMOVED. Never "0".
 */

/**
 * The preboot IIFE, minified, without `<script>` tags.
 *
 * Inline it verbatim; do not load it as an external file from `<head>`, or you
 * reintroduce the flash you are trying to remove.
 */
export const PREBOOT_SCRIPT =
  '(function(){try{var d=document.documentElement,q=new URLSearchParams(location.search),s={};' +
  "try{s=JSON.parse(localStorage.getItem('awc:showcase:v1'))||{}}catch(e){}" +
  'var g=function(k,f){var v=q.get(k);return v===null||v===""?s[f]:v};' +
  "var L=['en','ro','ar'],l=g('lang','locale');if(L.indexOf(l)<0)l='en';" +
  "var t=g('theme','theme');if(['light','dark','system'].indexOf(t)<0)t='system';" +
  "var r=g('dir','dir');if(r!=='ltr'&&r!=='rtl')r=l==='ar'?'rtl':'ltr';" +
  "var n=parseInt(g('density','density'),10);n=n>=-4&&n<0?n:0;" +
  'd.lang=l;d.dir=r;' +
  "if(t==='dark'||(t==='system'&&window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches))" +
  "d.setAttribute('data-theme','dark');else d.removeAttribute('data-theme');" +
  "if(n)d.setAttribute('data-density',''+n);else d.removeAttribute('data-density');" +
  '}catch(e){}})();';

/** The same script wrapped in a `<script>` tag, ready to interpolate into HTML. */
export function prebootScriptTag(): string {
  return `<script>${PREBOOT_SCRIPT}</script>`;
}

/** Byte length of the inline script — asserted by the build to stay under 1 kB. */
export const PREBOOT_SIZE = PREBOOT_SCRIPT.length;
