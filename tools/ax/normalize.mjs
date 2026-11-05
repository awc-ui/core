// Normalizes each platform's raw accessibility capture into one comparable model:
//   elements: semantic nodes in reading order { role, name, value?, states{}, range?, level?, live?, actions[], frame, raw }
//   texts:    static text runs that are not already part of a semantic element's name (reading order)
// ROLE_TABLE documents how each ARIA role is encoded per platform; the normalizers implement it.
export const ROLE_TABLE = {
  button: { macos: 'AXButton (AXPopUpButton/AXMenuButton with popup)', ios: 'trait button', android: 'android.widget.Button' },
  togglebutton: { macos: 'AXCheckBox/AXToggle', ios: 'traits button+toggleButton, value 1/0 (as SwiftUI button-style Toggle)', android: 'checkable android.widget.Button / ToggleButton' },
  checkbox: { macos: 'AXCheckBox, AXValue 0/1/2', ios: 'trait button, value Checked/Unchecked/Mixed (iOS has no checkbox trait)', android: 'android.widget.CheckBox, checkable/checked (+stateDescription for mixed)' },
  switch: { macos: 'AXCheckBox/AXSwitch, AXValue 0/1', ios: 'traits button+toggleButton, value 1/0', android: 'android.widget.Switch, checkable/checked' },
  radio: { macos: 'AXRadioButton, AXValue 0/1', ios: 'trait button (+selected; iOS has no radio trait)', android: 'android.widget.RadioButton, checkable/checked' },
  radiogroup: { macos: 'AXRadioGroup', ios: 'semanticGroup container', android: 'collection / container' },
  link: { macos: 'AXLink', ios: 'trait link', android: 'clickable text (link)' },
  heading: { macos: 'AXHeading', ios: 'trait header', android: 'isHeading' },
  img: { macos: 'AXImage (named)', ios: 'trait image', android: 'android.widget.ImageView (named)' },
  progressbar: { macos: 'AXProgressIndicator / AXBusyIndicator', ios: 'trait updatesFrequently, value', android: 'android.widget.ProgressBar + RangeInfo' },
  meter: { macos: 'AXLevelIndicator', ios: 'static text with value', android: 'ProgressBar + RangeInfo' },
  slider: { macos: 'AXSlider', ios: 'trait adjustable', android: 'android.widget.SeekBar + RangeInfo' },
  tab: { macos: 'AXRadioButton/AXTabButton', ios: 'button + selected inside tabBar', android: 'roleDescription "Tab"' },
  tablist: { macos: 'AXTabGroup', ios: 'trait tabBar', android: 'collection' },
  menu: { macos: 'AXMenu', ios: 'container', android: 'pane / collection' },
  menuitem: { macos: 'AXMenuItem', ios: 'trait button', android: 'android.widget.Button' },
  dialog: { macos: 'AXGroup/AXApplicationDialog, AXSheet, AXWindow/AXDialog', ios: 'accessibilityViewIsModal container', android: 'paneTitle (pane / window)' },
  status: { macos: 'AXGroup/AXApplicationStatus or announcement', ios: 'UIAccessibility announcement', android: 'liveRegion polite / TYPE_ANNOUNCEMENT' },
  alert: { macos: 'AXGroup/AXApplicationAlert', ios: 'announcement', android: 'liveRegion assertive' },
  tooltip: { macos: 'AXHelp on the anchor', ios: 'accessibilityHint on the anchor', android: 'tooltipText on the anchor' },
  list: { macos: 'AXList', ios: 'list container', android: 'CollectionInfo' },
  listbox: { macos: 'AXList (selectable)', ios: 'list container', android: 'CollectionInfo (selection)' },
  option: { macos: 'AXStaticText + AXSelected (as WebKit exposes an option)', ios: 'static text (+selected) on the keyboard focus surface (as WebKit exposes an option)', android: 'selectable collection item (RadioButton/CheckBox role, checked = selected)' },
  listitem: { macos: 'row group', ios: 'element in list container', android: 'CollectionItemInfo' },
  tree: { macos: 'AXOutline whose rows have no cells (NSOutlineView-style), named', ios: 'semanticGroup container (named; not an element)', android: 'CollectionInfo, contentDescription = name (not an element)' },
  treeitem: { macos: 'AXRow/AXOutlineRow in the outline: AXDisclosing (expanded), AXDisclosureLevel (level − 1), AXSelected', ios: 'trait button (+selected), value Expanded/Collapsed (parents), hint "Level N"', android: 'focusable, clickable CollectionItemInfo in traversal order, stateDescription Expanded/Collapsed (parents); a selectable item is checkable (Compose exposes `selected` as checked: option)' },
  grid: { macos: 'AXTable/AXGrid', ios: 'dataTable container', android: 'CollectionInfo' },
  gridcell: { macos: 'AXCell', ios: 'dataTable cell', android: 'CollectionItemInfo' },
  table: { macos: 'AXTable (as WebKit/Chrome)', ios: 'labelled container (no data-table element)', android: 'CollectionInfo (named collection)' },
  treegrid: { macos: 'AXTable', ios: 'labelled container', android: 'CollectionInfo' },
  rowgroup: { macos: 'not exposed (AXTable lists its rows)', ios: 'not exposed', android: 'not exposed' },
  row: { macos: 'AXRow (a tab-stop row is its focus surface)', ios: 'not exposed; a tab-stop row is a button named by its cells', android: 'CollectionItemInfo; a tab-stop row is a button / selectable item named by its cells' },
  cell: { macos: 'AXCell (named from content)', ios: 'its text', android: 'its text' },
  columnheader: { macos: 'AXCell (AXColumnHeaderUIElements)', ios: 'its text', android: 'heading (merged content)' },
  textbox: { macos: 'AXTextField/AXTextArea', ios: 'keyboard-editable element', android: 'android.widget.EditText' },
  searchbox: { macos: 'AXTextField/AXSearchField', ios: 'trait searchField', android: 'android.widget.EditText' },
  combobox: { macos: 'AXComboBox / AXPopUpButton', ios: 'trait button', android: 'android.widget.Spinner' },
  spinbutton: { macos: 'AXIncrementor', ios: 'trait adjustable', android: 'android.widget.NumberPicker' },
  separator: { macos: 'AXSplitter (not exposed for decorative dividers)', ios: 'not exposed', android: 'not exposed' },
  group: { macos: 'AXGroup (named)', ios: 'semanticGroup container', android: 'container with description' },
};
const MAC = { AXButton: 'button', AXPopUpButton: 'button', AXMenuButton: 'button', AXDisclosureTriangle: 'button', AXCheckBox: 'checkbox', AXRadioButton: 'radio',
  AXRadioGroup: 'radiogroup', AXLink: 'link', AXHeading: 'heading', AXImage: 'img', AXProgressIndicator: 'progressbar', AXBusyIndicator: 'progressbar',
  AXLevelIndicator: 'meter', AXValueIndicator: 'meter', AXSlider: 'slider', AXTabGroup: 'tablist', AXMenu: 'menu', AXMenuItem: 'menuitem', AXList: 'list',
  AXTable: 'grid', AXGrid: 'grid', AXOutline: 'treegrid', AXRow: 'row', AXCell: 'gridcell', AXToolbar: 'toolbar', AXTextField: 'textbox', AXTextArea: 'textbox',
  AXComboBox: 'combobox', AXIncrementor: 'spinbutton', AXSplitter: 'separator', AXSheet: 'dialog', AXStaticText: 'text', AXGroup: 'group', AXScrollArea: 'group',
  AXHelpTag: 'tooltip', AXLayoutArea: 'group', AXLayoutItem: 'group', AXUnknown: 'group', AXWindow: 'window', AXApplication: 'application' };
const MAC_SUB = { AXSwitch: 'switch', AXToggle: 'togglebutton', AXTabButton: 'tab', AXSearchField: 'searchbox', AXApplicationDialog: 'dialog', AXApplicationAlertDialog: 'alertdialog',
  AXApplicationStatus: 'status', AXApplicationAlert: 'alert', AXDialog: 'dialog', AXSystemDialog: 'dialog', AXLandmarkNavigation: 'navigation', AXLandmarkRegion: 'region',
  AXContentList: 'list', AXSortButton: 'button', AXSecureTextField: 'textbox' };
export const ws = s => String(s ?? '').replace(/\s+/g, ' ').trim();
/** The ARIA role of an AppKit role (focus records of unnamed elements). */
export const macRole = role => MAC[role];
const STRUCTURAL = new Set(['generic', 'none', 'presentation', 'LineBreak', 'InlineTextBox', 'paragraph', 'main', 'Section', 'RootWebArea', 'window', 'application', 'ListMarker',
  'emphasis', 'strong', 'code', 'mark', 'superscript', 'subscript', 'time', 'abbr', 'DescriptionListTerm', 'DescriptionListDetail', 'blockquote', 'figure', 'LabelText', 'legend']);
const NAME_FROM_CONTENT = new Set(['button', 'checkbox', 'switch', 'radio', 'link', 'heading', 'tab', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'option', 'cell', 'gridcell',
  'row', 'tooltip', 'treeitem', 'listitem', 'togglebutton', 'columnheader', 'rowheader']);
const FIELD_ROLES = new Set(['textbox', 'searchbox', 'combobox', 'spinbutton']);
function finish(elements, texts) {
  const names = elements.map(e => e.name).filter(Boolean);
  return { elements, texts: texts.filter(t => t && !names.some(n => n === t || (n.includes(t) && t.length > 1))) };
}

export function normalizeWeb(tree) {
  const elements = [], texts = [];
  function visit(n, ancestors) {
    if (!n) return;
    const role = n.role;
    if (n.ignored) { for (const c of n.children ?? []) visit(c, ancestors); return; }
    // Text inside a field is its value (carried as the field's `value`), not separate text.
    if (role === 'StaticText') { const t = ws(n.name); if (t && !ancestors.some(a => (NAME_FROM_CONTENT.has(a.role) && ws(a.name).includes(t)) || (FIELD_ROLES.has(a.role) && (a.value ?? '').includes(t)))) texts.push(t); return; }
    if (STRUCTURAL.has(role) || (['group', 'image', 'img'].includes(role) && !ws(n.name))) { for (const c of n.children ?? []) visit(c, ancestors); return; }
    const e = { role: role === 'image' ? 'img' : role === 'ProgressIndicator' ? 'progressbar' : role, name: ws(n.name), states: {}, actions: [], frame: n.frame };
    if (role === 'button' && n.pressed !== undefined) { e.role = 'togglebutton'; e.states.pressed = String(n.pressed); }
    if (n.description) e.description = ws(n.description);
    if (n.value !== undefined && n.value !== '' && !['checkbox', 'radio', 'switch', 'slider', 'progressbar', 'meter', 'spinbutton'].includes(role)) e.value = ws(n.value);
    for (const k of ['checked', 'expanded', 'selected', 'disabled', 'required', 'invalid', 'readonly', 'modal', 'haspopup', 'multiselectable', 'busy'])
      if (n[k] !== undefined && n[k] !== false && n[k] !== 'false') e.states[k] = String(n[k]);
    if (n.expanded !== undefined) e.expandable = String(n.expanded);
    if (['checkbox', 'switch', 'radio', 'menuitemcheckbox', 'menuitemradio'].includes(role)) e.states.checked = String(n.checked ?? 'false');
    if (n.focusable) e.focusable = true;
    if (n.level !== undefined) e.level = n.level;
    if (n.valuemin !== undefined || n.valuemax !== undefined || n.valuetext !== undefined)
      e.range = { min: n.valuemin, max: n.valuemax, now: n.value !== undefined && n.value !== '' ? Number(n.value) : undefined, text: n.valuetext };
    if (n.live && n.live !== 'off') e.live = n.live;
    if (n.controls?.length) e.controls = n.controls.map(ws);
    elements.push(e);
    for (const c of n.children ?? []) visit(c, [...ancestors, e]);
  }
  visit(tree, []);
  return finish(elements, texts);
}

// A tree (Web role="tree"): an AXOutline whose rows have no cells; its rows are tree items.
const hasCell = n => (n.children ?? []).some(c => c.role === 'AXCell' || hasCell(c));
export function normalizeMac(windows) {
  const elements = [], texts = [];
  function visit(n, ancestors) {
    if (!n) return;
    const sub = n.subrole && MAC_SUB[n.subrole];
    let role = sub || MAC[n.role] || 'group';
    if (n.role === 'AXOutline' && !hasCell(n)) role = 'tree';
    if (n.role === 'AXRow' && (n.subrole === 'AXOutlineRow' || ancestors.some(a => a.role === 'tree'))) role = 'treeitem';
    const name = ws(n.description || n.title || n.titleElement || '');
    // WebKit/Chrome expose a listbox option as static text that is selectable and pressable; AWC options do the same.
    if (n.role === 'AXStaticText' && n.selected !== undefined && (n.actions ?? []).includes('AXPress')) {
      const e = { role: 'option', name: ws(n.description || n.value || ''), states: n.selected ? { selected: 'true' } : {}, actions: [], frame: n.frame, raw: { role: n.role } };
      if (n.enabled === false) e.states.disabled = 'true';
      elements.push(e); return;
    }
    if (role === 'text') { const t = ws(n.value ?? n.description ?? ''); if (t && !ancestors.some(a => NAME_FROM_CONTENT.has(a.role) && a.name.includes(t))) texts.push(t); return; }
    if (['window', 'application'].includes(role) || (['group', 'img'].includes(role) && !name)) { for (const c of n.children ?? []) visit(c, ancestors); return; }
    const e = { role, name, states: {}, actions: (n.actions ?? []).filter(a => !['AXScrollToVisible', 'AXShowMenu', 'AXRaise'].includes(a)), frame: n.frame, raw: { role: n.role, subrole: n.subrole, roleDescription: n.roleDescription } };
    if (n.linked?.length) e.linked = n.linked.map(ws);
    // A named group with no semantic content and no actions is read as its label (status messages, separators).
    const leafGroup = role === 'group' && !e.actions.length;
    if (n.customActions) e.actions.push(...n.customActions.map(a => 'custom:' + a));
    if (n.help) e.description = ws(n.help);
    if (n.enabled === false) e.states.disabled = 'true';
    if (n.selected === true) e.states.selected = 'true';
    if (n.expanded === true) e.states.expanded = 'true';
    if (n.required === true) e.states.required = 'true';
    if (n.invalid === true || n.invalid === 'true') e.states.invalid = 'true';
    if (n.modal === true) e.states.modal = 'true';
    if (['checkbox', 'switch', 'radio', 'togglebutton'].includes(role)) {
      const v = Number(n.value); const s = v === 2 ? 'mixed' : v === 1 ? 'true' : 'false';
      if (role === 'togglebutton') e.states.pressed = s; else e.states.checked = s;
    } else if (['slider', 'progressbar', 'meter', 'spinbutton'].includes(role)) e.range = { min: n.minValue, max: n.maxValue, now: n.value === undefined ? undefined : Number(n.value), text: n.valueDescription };
    else if (n.value !== undefined && n.value !== '' && typeof n.value !== 'object') e.value = ws(n.value);
    if (role === 'heading' && n.disclosureLevel !== undefined) e.level = n.disclosureLevel + 1;
    if (role === 'treeitem') { if (n.disclosureLevel !== undefined) e.level = n.disclosureLevel + 1; if (n.disclosing === true) e.states.expanded = 'true'; }
    if (n.headingLevel !== undefined) e.level = n.headingLevel;
    const before = elements.length, textsBefore = texts.length;
    elements.push(e);
    for (const c of n.children ?? []) visit(c, [...ancestors, e]);
    if (leafGroup && elements.length === before + 1) { elements.splice(before, 1); texts.splice(textsBefore, 0, [name, typeof n.value === 'string' ? ws(n.value) : ''].filter(Boolean).join(' ')); }
  }
  for (const w of windows ?? []) visit(w, []);
  return finish(elements, texts);
}

const CHECK_VALUES = { checked: 'true', unchecked: 'false', mixed: 'mixed', 'partially checked': 'mixed', on: 'true', off: 'false', '1': 'true', '0': 'false', '2': 'mixed' };
export function normalizeIOS(list) {
  const elements = [], texts = [];
  for (const n of list ?? []) {
    const t = new Set(n.traits ?? []); const label = ws(n.label); const value = ws(n.value ?? '');
    let role = null;
    // WebKit exposes a listbox option as static text (+ selected); AWC's keyboard focus surface for an option does the same.
    if (t.has('staticText') && /FocusView$/.test(n.class ?? '')) role = 'option';
    else if (n.textInput) role = t.has('searchField') ? 'searchbox' : 'textbox';
    else if (t.has('header')) role = 'heading';
    else if (t.has('link')) role = 'link';
    else if (t.has('searchField')) role = 'searchbox';
    else if (t.has('adjustable')) role = 'slider';
    else if (t.has('toggleButton')) role = 'switch';
    else if (t.has('button') || t.has('keyboardKey')) role = /^(checked|unchecked|mixed|partially checked)$/i.test(value) ? 'checkbox' : 'button';
    else if (t.has('image')) role = 'img';
    else if (t.has('tabBar')) role = 'tablist';
    else if (t.has('updatesFrequently')) role = 'progressbar';
    if (!role) { const txt = ws([label, value].filter(Boolean).join(' ')); if (txt) texts.push(txt); continue; }
    if (role === 'img' && !label) continue;
    // A tree item: a button whose hint states its level ("Level N") and whose value its fold (parents).
    const treeLevel = role === 'button' && /^Level (\d+)$/.exec(ws(n.hint ?? ''));
    if (treeLevel) {
      const e = { role: 'treeitem', name: label, level: Number(treeLevel[1]), states: {}, actions: (n.customActions ?? []).map(a => 'custom:' + a), frame: n.frame, raw: { traits: n.traits, class: n.class, value: n.value, hint: n.hint } };
      if (t.has('notEnabled')) e.states.disabled = 'true';
      if (t.has('selected')) e.states.selected = 'true';
      if (/^(expanded|collapsed)$/i.test(value)) e.states.expanded = /^expanded$/i.test(value) ? 'true' : 'false';
      elements.push(e); continue;
    }
    const e = { role, name: label, states: {}, actions: (n.customActions ?? []).map(a => 'custom:' + a), frame: n.frame, raw: { traits: n.traits, class: n.class, value: n.value } };
    if (n.hint) e.description = ws(n.hint);
    if (t.has('notEnabled')) e.states.disabled = 'true';
    if (t.has('selected')) e.states.selected = 'true';
    if (role === 'checkbox' || role === 'switch') e.states.checked = CHECK_VALUES[value.toLowerCase()] ?? value;
    else if (role === 'slider' || role === 'progressbar') e.range = { text: value || undefined };
    else if (role === 'textbox' || role === 'searchbox') { const text = ws(n.text ?? value); if (text) e.value = text; }   // not the placeholder
    else if (value) e.value = value;
    if ((n.containers ?? []).includes('modal')) e.inModal = true;
    // UIKit has no heading container: a header-trait button is Web's heading > button.
    if (role === 'heading' && t.has('button')) { elements.push({ role: 'heading', name: label, states: {}, actions: [], frame: n.frame, raw: e.raw }); e.role = 'button'; e.states.expanded = /^expanded$/i.test(value) ? 'true' : /^collapsed$/i.test(value) ? 'false' : undefined; if (e.states.expanded === undefined) delete e.states.expanded; delete e.value; }
    elements.push(e);
  }
  return finish(elements, texts);
}

const AND = { 'android.widget.Button': 'button', 'android.widget.ImageButton': 'button', 'android.widget.CheckBox': 'checkbox', 'android.widget.Switch': 'switch',
  'android.widget.RadioButton': 'radio', 'android.widget.ToggleButton': 'togglebutton', 'android.widget.ImageView': 'img', 'android.widget.ProgressBar': 'progressbar',
  'android.widget.SeekBar': 'slider', 'android.widget.EditText': 'textbox', 'android.widget.Spinner': 'combobox', 'android.widget.NumberPicker': 'spinbutton', 'android.widget.TextView': 'text' };
// TalkBack's focus units: a node it stops on. Their spoken label falls back to the non-focusable descendants' text, and
// Compose moves the role / content description of a merging node with children into "fake" child nodes (fake: true).
const focusUnit = n => n.important !== false && !!(n.screenReaderFocusable || n.clickable || n.longClickable || n.focusable || n.checkable);
const roleOf = n => n.roleDescription && /^tab$/i.test(n.roleDescription) ? 'tab' : n.roleDescription && /^switch$/i.test(n.roleDescription) ? 'switch' : (AND[n.class] ?? null);
function descendantLabel(n) {
  const parts = [];
  for (const c of n.children ?? []) {
    if (c.visible === false || focusUnit(c)) continue;
    const t = ws(c.contentDescription || c.text || '');
    if (t) parts.push(t); else { const d = descendantLabel(c); if (d) parts.push(d); }
  }
  return ws(parts.join(' '));
}
function descendantRole(n) {
  for (const c of n.children ?? []) {
    if (focusUnit(c)) continue;
    const r = !(c.text) && c.class !== 'android.widget.TextView' ? roleOf(c) : null;
    if (r && r !== 'text') return r;
    const d = descendantRole(c); if (d) return d;
  }
  return null;
}
export function normalizeAndroid(windows) {
  const elements = [], texts = [];
  function visit(n, ancestors, owner) {
    if (!n || n.visible === false) return;
    if (n.fake && owner && !n.text && !n.contentDescription) return;   // role carrier of its focus unit
    const important = n.important !== false;
    let role = n.heading ? 'heading' : roleOf(n);
    if (!role && focusUnit(n)) role = descendantRole(n);
    if (!role && n.range) role = 'progressbar';
    if (!role && n.collectionItem && n.checkable) role = 'option';
    if (!role && n.clickable) role = 'button';
    if (!role && n.paneTitle) role = 'dialog';
    // A live region without a role is Android's status (polite) / alert (assertive); a collection is a container, not an element.
    if (!role && n.liveRegion) role = n.liveRegion === 'assertive' ? 'alert' : 'status';
    let name = ws(n.contentDescription || n.text || n.paneTitle || '') || (role && role !== 'text' && (focusUnit(n) || role === 'status' || role === 'alert') ? descendantLabel(n) : '');
    // An editable text field (EditText): its text is the value (TalkBack reads it as the field's content), and its label is
    // its content description, which Compose moves into a fake child of the merging field node (or the hint text).
    // Its other non-focusable children (the placeholder) belong to the field.
    const editable = n.editable && (role === 'textbox' || role === 'searchbox');
    if (editable) name = ws(n.contentDescription || (n.children ?? []).find(c => c.fake && c.contentDescription && c.visible !== false)?.contentDescription || n.hint || '');
    if (!important || (!role && !n.liveRegion) || role === 'text') {
      const t = ws(n.text || n.contentDescription || '');
      // A collection's content description is its name (read on entering it), not a text run.
      if (important && t && !(owner?.name ?? '').includes(t) && !(n.collection && !n.text && t === ws(n.contentDescription))) texts.push(t);
      for (const c of n.children ?? []) visit(c, ancestors, owner);
      return;
    }
    const e = { role: role ?? 'group', name, states: {}, actions: (n.actions ?? []).map(a => a.name === 'custom' ? 'custom:' + (a.label ?? '') : a.name).filter(a => !['focus', 'clearFocus', 'showOnScreen'].includes(a)), frame: n.frame,
      raw: { class: n.class, roleDescription: n.roleDescription, stateDescription: n.stateDescription } };
    if (n.enabled === false) e.states.disabled = 'true';
    if (n.selected || (e.role === 'option' && (n.checked || n.collectionItem?.selected))) e.states.selected = 'true';
    else if (e.role === 'option') e.states.selected = 'false';
    if (n.checkable && e.role !== 'option') {
      const s = n.checked ? 'true' : 'false';
      if (['checkbox', 'switch', 'radio'].includes(e.role)) e.states.checked = n.stateDescription && /partial|mixed|indeterminate/i.test(n.stateDescription) ? 'mixed' : s;
      else { if (e.role === 'button') e.role = 'togglebutton'; e.states.pressed = s; }
    }
    if (n.actions?.some(a => a.name === 'expand')) e.states.expanded = 'false';
    if (n.actions?.some(a => a.name === 'collapse')) e.states.expanded = 'true';
    // Compose disclosure controls also state it in words (stateDescription "Expanded"/"Collapsed"), which TalkBack reads.
    if (e.states.expanded === undefined && /^expanded\b/i.test(n.stateDescription ?? '')) e.states.expanded = 'true';
    if (e.states.expanded === undefined && /^collapsed\b/i.test(n.stateDescription ?? '')) e.states.expanded = 'false';
    if (n.invalid || n.error) e.states.invalid = 'true';
    if (n.range) e.range = { min: n.range.min, max: n.range.max, now: n.range.current, text: n.stateDescription };
    else if (n.stateDescription && !n.checkable && !/^(expanded|collapsed)\b/i.test(n.stateDescription)) e.value = ws(n.stateDescription);
    if (n.liveRegion) e.live = n.liveRegion;
    // A role-less live region's words are text, as Web's status/alert content is (its own name is empty on Web).
    if (['status', 'alert'].includes(e.role) && !n.contentDescription && e.name) { texts.push(e.name); e.name = ''; }
    if (n.error) e.description = ws(n.error); else if (n.tooltip) e.description = ws(n.tooltip);
    if (editable && n.text && !n.showingHint) e.value = ws(n.text);
    if (n.focusable) e.focusable = true;
    // Compose puts heading() on the clickable header itself: Web's heading > button.
    if (e.role === 'heading' && (n.clickable || n.actions?.some(a => ['expand', 'collapse', 'click'].includes(a.name)))) {
      elements.push({ role: 'heading', name: e.name, states: {}, actions: [], frame: n.frame, raw: e.raw }); e.role = 'button';
    }
    elements.push(e);
    for (const c of n.children ?? []) if (!editable || focusUnit(c)) visit(c, [...ancestors, e], e);
  }
  for (const w of windows ?? []) visit(w.root, [], null);
  return finish(elements, texts);
}
