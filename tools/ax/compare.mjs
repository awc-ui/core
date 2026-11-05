// Compares a native normalized capture with the Web one (same case, same effective node).
// Finding kinds: missing, extra, role, name, state, value, range, description, live, text-missing, text-extra, focus
// (plus lint/atf added by run.mjs). Findings start "open"; tools/ax/expectations.mjs marks reviewed platform conventions.
import { ws } from './normalize.mjs';

// Web roles a platform encodes with another role (accepted, documented encodings), or does not expose as an element ([]).
// Table structure (WAI table / treegrid; n4, 2026-10-30): AppKit exposes AXTable → AXRow → AXCell (header cells are AXCells,
// no row groups), as WebKit and Chrome expose an ARIA table on macOS. UIKit and Android have no table, row or cell element
// (a data table is a container type: UIAccessibilityContainerDataTable / CollectionInfo + CollectionItemInfo): there the
// structure is not compared as elements — cells are read as their text, Android header cells are headings, and a focusable
// row is the button / selectable item that is its keyboard stop, named by its cells (see tableRowNames).
export const ROLE_EQUIVALENTS = {
  ios: { tree: [], togglebutton: ['button', 'switch'], tab: ['button'], radio: ['button', 'checkbox'], menuitem: ['button'], option: ['button', 'checkbox'], combobox: ['button'], spinbutton: ['slider'],
         meter: [], dialog: [], alertdialog: [], status: [], alert: [], tooltip: [], list: [], listitem: [], listbox: [], menu: [], radiogroup: [], tablist: [], tabpanel: [], toolbar: [], group: [], region: [],
         separator: [], grid: [], gridcell: [], row: [], table: [], treegrid: [], rowgroup: [], cell: [], columnheader: [], rowheader: [] },
  macos: { togglebutton: ['checkbox', 'button'], tab: ['radio'], tabpanel: ['group'], region: ['group'], status: [], alert: [], separator: [], radiogroup: [], listbox: [], list: [], listitem: [],
           table: ['grid'], treegrid: ['grid'], cell: ['gridcell'], columnheader: ['gridcell'], rowheader: ['gridcell'], rowgroup: [] },
  android: { tree: [], treeitem: ['button', 'option'], togglebutton: ['button'], link: ['button'], menuitem: ['button'], option: ['button', 'radio', 'checkbox'], tab: ['button'], meter: ['progressbar'], menu: ['dialog'], separator: [], toolbar: [], tabpanel: ['group'],
             group: [], region: [], radiogroup: [], tablist: [], list: [], listitem: [], listbox: [], tooltip: [],
             table: [], treegrid: [], grid: [], rowgroup: [], row: [], cell: [], gridcell: [], columnheader: ['heading'], rowheader: ['heading'] },
};
// Unexposed web elements whose own text is still read on the platform (a status message, a region's title, a meter's reading).
const READ_AS_TEXT = new Set(['status', 'alert', 'region', 'dialog', 'alertdialog', 'meter', 'tooltip', 'cell', 'gridcell', 'columnheader', 'rowheader']);
const CELL_ROLES = new Set(['cell', 'gridcell', 'columnheader', 'rowheader']);
/** The text of each Web row (its name, else its cells' names): a platform without row elements names a focusable row's stop so. */
export function tableRowNames(elements) {
  const names = new Set(); let cells = null;
  const flush = () => { if (cells?.length) names.add(ws(cells.join(' '))); cells = null; };
  for (const e of elements) {
    if (e.role === 'row') { flush(); cells = []; if (e.name) names.add(ws(e.name)); }
    else if (CELL_ROLES.has(e.role)) cells?.push(e.name);
    else if (['rowgroup', 'table', 'treegrid', 'grid'].includes(e.role)) flush();
  }
  flush(); return names;
}
const compatible = (platform, webRole, nativeRole) => webRole === nativeRole || (ROLE_EQUIVALENTS[platform]?.[webRole] ?? []).includes(nativeRole);
const unexposed = (platform, webRole) => Array.isArray(ROLE_EQUIVALENTS[platform]?.[webRole]) && ROLE_EQUIVALENTS[platform][webRole].length === 0;

function align(platform, web, native) {
  // Longest common subsequence on role compatibility, preferring equal names; returns index pairs.
  const n = web.length, m = native.length, score = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  const w = (a, b) => compatible(platform, a.role, b.role) ? (a.name === b.name ? 3 : 2) : (a.name && a.name === b.name ? 1 : 0);
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) {
    const s = w(web[i], native[j]);
    score[i][j] = Math.max(score[i + 1][j], score[i][j + 1], s ? s + score[i + 1][j + 1] : 0);
  }
  const pairs = []; let i = 0, j = 0;
  while (i < n && j < m) {
    const s = w(web[i], native[j]);
    if (s && score[i][j] === s + score[i + 1][j + 1]) { pairs.push([i, j]); i++; j++; }
    else if (score[i + 1][j] >= score[i][j + 1]) i++; else j++;
  }
  return pairs;
}

const STATE_KEYS = ['checked', 'pressed', 'expanded', 'selected', 'disabled', 'required', 'invalid', 'modal'];
// States a platform has no public channel for: not compared (listed in docs/native-parity/accessibility.md).
export const UNSUPPORTED_STATES = { ios: ['expanded', 'required', 'invalid', 'pressed', 'modal'], android: ['required', 'modal'], macos: [] };
const brief = e => ({ role: e.role, name: e.name, ...(Object.keys(e.states ?? {}).length ? { states: e.states } : {}), ...(e.value !== undefined ? { value: e.value } : {}), ...(e.range ? { range: e.range } : {}) });

export function compareCase(platform, webN, nativeN, { webFocus = [], nativeFocus = [] } = {}) {
  const findings = [];
  // An unnamed Web status/alert is a live container whose content is compared as text; Android reports live regions only where it has them.
  const web = webN.elements.filter(e => !unexposed(platform, e.role) && !(platform === 'android' && ['status', 'alert'].includes(e.role) && !e.name));
  const hiddenText = webN.elements.filter(e => unexposed(platform, e.role) && READ_AS_TEXT.has(e.role)).map(e => [e.name, e.range?.text ?? e.value ?? ''].filter(Boolean).join(' ')).filter(Boolean);
  // A focusable row the platform has no row element for is its keyboard stop (button / selectable item named by the row).
  const rowNames = unexposed(platform, 'row') ? tableRowNames(webN.elements) : new Set();
  const rowStop = e => ['button', 'option'].includes(e.role) && rowNames.has(ws(e.name));
  const native = nativeN.elements.filter(e => !(platform === 'android' && ['status', 'alert'].includes(e.role) && !e.name) && !rowStop(e));
  const pairs = align(platform, web, native);
  const wm = new Set(pairs.map(p => p[0])), nm = new Set(pairs.map(p => p[1]));
  web.forEach((e, i) => { if (!wm.has(i)) findings.push({ kind: 'missing', web: brief(e), detail: `${e.role} "${e.name}" has no ${platform} counterpart` }); });
  native.forEach((e, i) => { if (!nm.has(i)) findings.push({ kind: 'extra', native: brief(e), detail: `${platform} exposes ${e.role} "${e.name}" that Web does not` }); });
  for (const [i, j] of pairs) {
    const a = web[i]; let b = native[j];
    if (!compatible(platform, a.role, b.role)) findings.push({ kind: 'role', web: brief(a), native: brief(b), detail: `role ${a.role} → ${b.role} ("${a.name}")` });
    if (ws(a.name) !== ws(b.name)) findings.push({ kind: 'name', web: brief(a), native: brief(b), detail: `${a.role} name "${a.name}" → "${b.name}"` });
    // aria-controls → AXLinkedUIElements (macOS only; UIKit/Compose have no element relation: exception record R6-09).
    if (platform === 'macos' && a.controls?.length && !a.controls.every(c => (b.linked ?? []).includes(c)))
      findings.push({ kind: 'relation', web: brief(a), native: brief(b), detail: `${a.role} "${a.name}" controls [${a.controls.join(', ')}] → linked [${(b.linked ?? []).join(', ')}]` });
    // iOS/macOS encode pressed (toggle buttons) and checked (radios) with the selected trait/AXSelected; a selected
    // flag that duplicates checked is the same state, not an extra one.
    const ns = { ...b.states };
    if (platform !== 'android') {
      if (['togglebutton', 'tab', 'option'].includes(a.role) && ns.selected === 'true' && a.role === 'togglebutton' && ns.pressed === undefined) { ns.pressed = 'true'; delete ns.selected; }
      // iOS toggle buttons use the toggle trait with value 1/0 (normalized as switch/checked), like SwiftUI button-style Toggle.
      if (a.role === 'togglebutton' && b.role === 'switch' && ns.checked !== undefined && ns.pressed === undefined) { ns.pressed = ns.checked; delete ns.checked; }
      // macOS/iOS toggles may also flag AXSelected/selected trait for the pressed state: the same state, not an extra one.
      if (a.role === 'togglebutton' && ns.pressed !== undefined && ns.selected !== undefined && ns.selected === ns.pressed) delete ns.selected;
      if (['radio', 'checkbox', 'switch'].includes(a.role) && ns.selected === 'true' && (ns.checked === 'true' || platform === 'ios')) { ns.checked = 'true'; delete ns.selected; }
    }
    if (platform === 'android' && a.role === 'option' && ['radio', 'checkbox'].includes(b.role) && ns.checked !== undefined) { ns.selected = ns.checked; delete ns.checked; }
    b = { ...b, states: ns };
    for (const k of STATE_KEYS) {
      if (UNSUPPORTED_STATES[platform]?.includes(k)) continue;
      const toggles = r => ['checkbox', 'switch', 'radio'].includes(r);
      const x = a.states[k] ?? (k === 'checked' && toggles(a.role) ? 'false' : undefined);
      const y = b.states[k] ?? (k === 'checked' && toggles(b.role) ? 'false' : undefined);
      const norm = v => v === undefined || v === 'false' ? 'false' : v;
      const differs = norm(x) !== norm(y);
      if (differs) findings.push({ kind: 'state', web: brief(a), native: brief(b), detail: `${a.role} "${a.name}" ${k}: ${x ?? '∅'} → ${y ?? '∅'}` });
    }
    if (a.value !== undefined && ws(a.value) !== ws(b.value ?? '')) findings.push({ kind: 'value', web: brief(a), native: brief(b), detail: `${a.role} "${a.name}" value "${a.value}" → "${b.value ?? ''}"` });
    if (a.range) {
      const r = b.range;
      if (!r) { if (a.range.now !== undefined) findings.push({ kind: 'range', web: brief(a), native: brief(b), detail: `${a.role} "${a.name}" range not exposed` }); }
      else {
        for (const k of ['min', 'max', 'now']) if (a.range[k] !== undefined && r[k] !== undefined && Math.abs(Number(a.range[k]) - Number(r[k])) > 1e-6)
          findings.push({ kind: 'range', web: brief(a), native: brief(b), detail: `${a.role} "${a.name}" ${k} ${a.range[k]} → ${r[k]}` });
        if (a.range.text && r.text !== undefined && ws(a.range.text) !== ws(r.text)) findings.push({ kind: 'range', web: brief(a), native: brief(b), detail: `${a.role} "${a.name}" valuetext "${a.range.text}" → "${r.text}"` });
      }
    }
    if (a.description && ws(a.description) !== ws(b.description ?? '')) findings.push({ kind: 'description', web: brief(a), native: brief(b), detail: `${a.role} "${a.name}" description "${a.description}" → "${b.description ?? ''}"` });
    if (platform === 'android' && ['true', 'false'].includes(String(a.expandable)) && !b.actions?.some(x => x === 'expand' || x === 'collapse') && b.states?.expanded === undefined) findings.push({ kind: 'state', web: brief(a), native: brief(b), detail: `${a.role} "${a.name}" is collapsible on Web but exposes no expand/collapse action` });
    if (a.live && !b.live && platform === 'android') findings.push({ kind: 'live', web: brief(a), native: brief(b), detail: `${a.role} "${a.name}" live region ${a.live} not exposed` });
  }
  // Static text outside semantic names, compared as reading-order words.
  const words = list => list.join(' ').split(' ').filter(Boolean);
  // A Web region/status/meter that the platform does not expose is satisfied when its words are read as text or as part of a native name.
  const wt = words([...webN.texts, ...hiddenText]), nt = words(nativeN.texts), hw = new Set(words(hiddenText)), bare = x => x.replace(/[,;:.]+$/, ''), names = new Set(words(nativeN.elements.map(e => e.name)).map(bare));
  const missing = wt.filter(x => !nt.includes(x) && !(hw.has(x) && names.has(bare(x)))), extra = nt.filter(x => !wt.includes(x));
  if (missing.length) findings.push({ kind: 'text-missing', detail: `text not exposed on ${platform}: "${[...new Set(missing)].join(' ')}"` });
  if (extra.length) findings.push({ kind: 'text-extra', detail: `${platform} exposes text Web does not: "${[...new Set(extra)].join(' ')}"` });
  // Keyboard focus order: the first Web-length stops must match in order; a native walk may then wrap or stop.
  if (webFocus.length || nativeFocus.length) {
    const key = f => f ? `${f.role}:${ws(f.name)}` : '∅';
    const fw = webFocus.map(key), fn = nativeFocus.map(key), head = fn.slice(0, fw.length);
    // A stop matches when the names are equal and the roles are the same or an accepted encoding of the Web role.
    const same = (w, n) => !!w && !!n && ((ws(w.name) === ws(n.name) && compatible(platform, w.role, n.role))
      || (w.role === 'row' && rowStop(n) && (!w.name || ws(w.name) === ws(n.name))));
    if (webFocus.length && !webFocus.every((w, i) => same(w, nativeFocus[i]))) findings.push({ kind: 'focus', detail: `Tab order web [${fw.join(' | ')}] → ${platform} [${fn.join(' | ')}]` });
    else if (webFocus.length) { const extra = [...new Set(nativeFocus.filter(n => n && !webFocus.some(w => same(w, n))).map(key))]; if (extra.length) findings.push({ kind: 'focus', detail: `${platform} has extra Tab stops: ${extra.join(' | ')}` }); }
  }
  return { pairs: pairs.length, web: web.length, native: native.length, findings, matched: pairs.map(([i, j]) => [web[i], native[j]]) };
}
