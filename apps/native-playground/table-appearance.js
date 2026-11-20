import { appearanceField, appearanceProfile } from './accordion-appearance.js';

// The md-table family in the Laboratory: the typed hooks of md-table, md-table-cell, md-table-container,
// md-table-expand-toggle, md-table-pagination, md-table-row, md-table-sort-label and md-table-toolbar (field order follows
// the native initializers AWCTable…Appearance), the retained property updates of all eleven tags and the methods with
// results (md-table, md-table-row, md-table-pagination).
const invalid = (code, message) => Object.assign(new Error(message), { code });
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const NUMBER = '[+-]?(?:\\d+\\.?\\d*|\\.\\d+)(?:e[+-]?\\d+)?';
const cssNumber = value => { const text = String(value); return text.includes('e') ? String(Number(value.toPrecision(15))) : text; };
const quote = (text, platform) => JSON.stringify(text).replace(platform === 'kotlin' ? /\$/g : /(?!)/g, '\\$');
const double = value => { if (Object.is(value, -0)) return '-0.0'; const text = String(value); return /[.e]/i.test(text) ? text : `${text}.0`; };

/** Kinds the shared profile has no rule for: a grid track template, a signed angle and the pin indicator display. */
const EXTRA = {
  template: {
    hint: 'A CSS grid-template-columns value, for example 2fr 1fr 120px or repeat(3, minmax(96px, 1fr)).',
    normalize(value, code, label) {
      if (typeof value !== 'string' || !value.trim() || value.trim().length > 512 || /[;{}<>\\]/.test(value)) throw invalid(code, `${label} must be a grid track list (at most 512 characters, no ; { } < > \\).`);
      return value.trim();
    },
    css: value => value,
    parse: raw => String(raw ?? '').trim(),
    native: (value, platform) => quote(value, platform),
  },
  angle: {
    hint: 'An angle in degrees (deg, grad, rad or turn are converted), for example 90.',
    normalize(value, code, label) { if (typeof value !== 'number' || !Number.isFinite(value)) throw invalid(code, `${label} must be a finite number of degrees.`); return Object.is(value, -0) ? 0 : value; },
    css: value => `${cssNumber(value)}deg`,
    parse(raw, code, label) {
      const m = new RegExp(`^(${NUMBER})(deg|grad|rad|turn)?$`, 'i').exec(String(raw ?? '').trim());
      if (!m) throw invalid(code, `${label} must be an angle.`);
      const scale = { deg: 1, grad: 0.9, rad: 180 / Math.PI, turn: 360 }[(m[2] || 'deg').toLowerCase()];
      return Number((Number(m[1]) * scale).toPrecision(12));
    },
    native: value => double(value),
  },
  display: {
    hint: 'inline-flex (shown) or none (hidden).',
    normalize(value, code, label) { if (!['inline-flex', 'none'].includes(value)) throw invalid(code, `${label} must be inline-flex or none.`); return value; },
    css: value => value,
    parse: (raw, code, label) => { const text = String(raw ?? '').trim().toLowerCase(); if (!['inline-flex', 'none'].includes(text)) throw invalid(code, `${label} must be inline-flex or none.`); return text; },
    native: (value, platform) => quote(value, platform),
  },
};

function profile(fields, code, label) {
  const extras = new Map(fields.filter(f => EXTRA[f.kind]).map(f => [f.name, f]));
  const base = appearanceProfile(fields.filter(f => !extras.has(f.name)), code, label);
  const byName = new Map(fields.map(f => [f.name, f]));
  const normalize = value => {
    if (value === undefined) return {};
    if (!plain(value) || Reflect.ownKeys(value).some(key => !byName.has(key))) throw invalid(code, `Use a plain object containing only the ${fields.length} ${label} appearance fields.`);
    for (const key of Reflect.ownKeys(value)) if (!Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), 'value')) throw invalid(code, 'Appearance fields must contain data values.');
    const normalized = base.normalize(Object.fromEntries(Object.entries(value).filter(([key]) => !extras.has(key))));
    for (const [name, f] of extras) if (Object.hasOwn(value, name)) normalized[name] = EXTRA[f.kind].normalize(value[name], code, f.label);
    return Object.fromEntries(fields.filter(f => Object.hasOwn(normalized, f.name)).map(f => [f.name, normalized[f.name]]));
  };
  return Object.freeze({
    fields,
    normalize,
    css(value) {
      const n = normalize(value);
      const out = base.css(Object.fromEntries(Object.entries(n).filter(([key]) => !extras.has(key))));
      for (const [name, f] of extras) if (Object.hasOwn(n, name)) out[f.cssProperty] = EXTRA[f.kind].css(n[name]);
      return Object.fromEntries(fields.filter(f => Object.hasOwn(out, f.cssProperty)).map(f => [f.cssProperty, out[f.cssProperty]]));
    },
    parseInput: (name, raw) => extras.has(name) ? EXTRA[extras.get(name).kind].parse(raw, code, extras.get(name).label) : base.parseInput(name, raw),
    formatInput: (name, value) => extras.has(name) ? (value === undefined ? '' : String(EXTRA[extras.get(name).kind].css(EXTRA[extras.get(name).kind].normalize(value, code, name)))) : base.formatInput(name, value),
    nativeValue: (name, value, platform) => extras.has(name) ? EXTRA[extras.get(name).kind].native(value, platform)
      : byName.get(name)?.kind === 'color' ? quote(String(value), platform)
      : typeof value === 'number' ? double(value) : base.nativeValue(name, value, platform),
  });
}
const field = (prefix, name, label, suffix, kind) => EXTRA[kind]
  ? Object.freeze({ name, label, cssProperty: `--md-${prefix}-${suffix}`, kind, hint: EXTRA[kind].hint })
  : appearanceField(prefix, name, label, suffix, kind);
const fields = (prefix, specs) => Object.freeze(specs.map(([name, label, suffix, kind]) => field(prefix, name, label, suffix, kind)));

// ---- typed hooks (52 public custom properties) -----------------------------------------------------------------------
export const TABLE_APPEARANCE_FIELDS = fields('table', [
  ['rowHeightCompact', 'Compact row height', 'row-height-compact', 'length'], ['rowHeightStandard', 'Standard row height', 'row-height-standard', 'length'],
  ['rowHeightComfortable', 'Comfortable row height', 'row-height-comfortable', 'length'], ['headerHeight', 'Header row height', 'header-height', 'length'],
  ['cellPaddingInline', 'Cell inline padding', 'cell-padding-inline', 'length'], ['cellPaddingBlock', 'Cell block padding', 'cell-padding-block', 'length'],
  ['dividerColor', 'Divider color', 'divider-color', 'color'], ['stripeColor', 'Stripe color', 'stripe-color', 'color'],
  ['headBackground', 'Header background', 'head-bg', 'color'], ['headColor', 'Header text color', 'head-color', 'color'],
  ['footBackground', 'Footer background', 'foot-bg', 'color'], ['rowHoverColor', 'Row hover color', 'row-hover-color', 'color'],
  ['rowSelectedBackground', 'Selected row background', 'row-selected-bg', 'color'], ['rowSelectedColor', 'Selected row text color', 'row-selected-color', 'color'],
  ['columnsTemplate', 'Column template', 'columns-template', 'template'], ['minWidth', 'Minimum width', 'min-width', 'length'],
  ['bodyMaxHeight', 'Body maximum height', 'body-max-h', 'length'], ['emptyMinHeight', 'Empty state minimum height', 'empty-min-height', 'length'],
]);
export const TABLE_CELL_APPEARANCE_FIELDS = fields('table-cell', [
  ['color', 'Text color', 'color', 'color'], ['background', 'Background', 'background', 'color'], ['paddingInline', 'Inline padding', 'padding-inline', 'length'],
  ['paddingBlock', 'Block padding', 'padding-block', 'length'], ['minHeight', 'Minimum height', 'min-height', 'length'],
  ['stickyBackground', 'Pinned background', 'sticky-bg', 'color'], ['stickyTransition', 'Pinned background transition', 'sticky-transition', 'duration'],
  ['pinDisplay', 'Pin indicator display', 'pin-display', 'display'], ['pinColor', 'Pin indicator color', 'pin-color', 'color'], ['pinSize', 'Pin indicator size', 'pin-size', 'length'],
]);
export const TABLE_CONTAINER_APPEARANCE_FIELDS = fields('table-container', [
  ['color', 'Surface color', 'color', 'color'], ['shape', 'Corners', 'shape', 'corners'], ['elevation', 'Elevation', 'elevation', 'shadow'],
  ['outlineColor', 'Outline color', 'outline-color', 'color'], ['outlineWidth', 'Outline width', 'outline-width', 'length'],
]);
export const TABLE_EXPAND_TOGGLE_APPEARANCE_FIELDS = fields('table-expand-toggle', [['rotation', 'Expanded rotation', 'rotation', 'angle']]);
export const TABLE_PAGINATION_APPEARANCE_FIELDS = fields('table-pagination', [
  ['color', 'Text color', 'color', 'color'], ['background', 'Background', 'bg', 'color'], ['paddingBlock', 'Block padding', 'padding-block', 'length'],
  ['paddingInline', 'Inline padding', 'padding-inline', 'length'], ['selectWidth', 'Rows-per-page select width', 'select-width', 'length'],
]);
export const TABLE_ROW_APPEARANCE_FIELDS = fields('table-row', [['hoverColor', 'Hover color', 'hover-color', 'color']]);
export const TABLE_SORT_LABEL_APPEARANCE_FIELDS = fields('table-sort-label', [
  ['color', 'Text color', 'color', 'color'], ['activeColor', 'Active color', 'active-color', 'color'], ['iconSize', 'Arrow size', 'icon-size', 'length'],
  ['gap', 'Gap', 'gap', 'length'], ['restOpacity', 'Inactive arrow opacity', 'rest-opacity', 'opacity'],
]);
export const TABLE_TOOLBAR_APPEARANCE_FIELDS = fields('table-toolbar', [
  ['color', 'Text color', 'color', 'color'], ['background', 'Background', 'bg', 'color'], ['selectionBackground', 'Selection background', 'selection-bg', 'color'],
  ['selectionColor', 'Selection text color', 'selection-color', 'color'], ['paddingBlock', 'Block padding', 'padding-block', 'length'],
  ['paddingInline', 'Inline padding', 'padding-inline', 'length'], ['minHeight', 'Minimum height', 'min-height', 'length'],
]);

const SPEC = {
  'md-table': ['tableAppearance', TABLE_APPEARANCE_FIELDS, 'INVALID_TABLE_APPEARANCE', 'Table', 'AWCTableAppearance', 'awcTableAppearance',
    [['Rows', ['rowHeightCompact', 'rowHeightStandard', 'rowHeightComfortable', 'headerHeight', 'stripeColor', 'rowHoverColor', 'rowSelectedBackground', 'rowSelectedColor']],
     ['Cells and dividers', ['cellPaddingInline', 'cellPaddingBlock', 'dividerColor']], ['Header and footer', ['headBackground', 'headColor', 'footBackground']],
     ['Layout', ['columnsTemplate', 'minWidth', 'bodyMaxHeight', 'emptyMinHeight']]],
    'Hooks inherit down the table, as CSS custom properties do: rows, cells, sort labels and expand toggles read them. The column template applies when the columnTemplate property is empty; the body maximum height applies to a frozen header. Density rows win over the row height hooks only through the density property. Colors accept #RRGGBB or #RRGGBBAA.'],
  'md-table-cell': ['tableCellAppearance', TABLE_CELL_APPEARANCE_FIELDS, 'INVALID_TABLE_CELL_APPEARANCE', 'Table Cell', 'AWCTableCellAppearance', 'awcTableCellAppearance',
    [['Content', ['color', 'background', 'paddingInline', 'paddingBlock', 'minHeight']], ['Pinned column', ['stickyBackground', 'stickyTransition', 'pinDisplay', 'pinColor', 'pinSize']]],
    'Styles apply to this cell (shown inside its table). Pinned cells paint the pinned background instead of the cell background; the row’s own pinned background wins over an inherited one, as in the source.'],
  'md-table-container': ['tableContainerAppearance', TABLE_CONTAINER_APPEARANCE_FIELDS, 'INVALID_TABLE_CONTAINER_APPEARANCE', 'Table Container', 'AWCTableContainerAppearance', 'awcTableContainerAppearance',
    [['Surface', ['color', 'shape', 'elevation']], ['Outline', ['outlineColor', 'outlineWidth']]],
    'The elevation and outline hooks apply to their variants (elevated, outlined). As in the source, the shape class and the variant surface rules win over the container shape and color hooks: those two have no visible effect (recorded in the source review).'],
  'md-table-expand-toggle': ['tableExpandToggleAppearance', TABLE_EXPAND_TOGGLE_APPEARANCE_FIELDS, 'INVALID_TABLE_EXPAND_TOGGLE_APPEARANCE', 'Table Expand Toggle', 'AWCTableExpandToggleAppearance', 'awcTableExpandToggleAppearance',
    [['Caret', ['rotation']]], 'The caret turns to this angle while its row is expanded (mirrored in right-to-left layouts).'],
  'md-table-pagination': ['tablePaginationAppearance', TABLE_PAGINATION_APPEARANCE_FIELDS, 'INVALID_TABLE_PAGINATION_APPEARANCE', 'Table Pagination', 'AWCTablePaginationAppearance', 'awcTablePaginationAppearance',
    [['Bar', ['color', 'background', 'paddingBlock', 'paddingInline']], ['Rows per page', ['selectWidth']]],
    'compact wins over the block padding. The source declares the inline padding hook but never reads it: it has no effect on the Web and none natively (recorded in the source review).'],
  'md-table-row': ['tableRowAppearance', TABLE_ROW_APPEARANCE_FIELDS, 'INVALID_TABLE_ROW_APPEARANCE', 'Table Row', 'AWCTableRowAppearance', 'awcTableRowAppearance',
    [['States', ['hoverColor']]], 'The hover layer of this row (shown inside its table); the table’s row hover color is the inherited default.'],
  'md-table-sort-label': ['tableSortLabelAppearance', TABLE_SORT_LABEL_APPEARANCE_FIELDS, 'INVALID_TABLE_SORT_LABEL_APPEARANCE', 'Table Sort Label', 'AWCTableSortLabelAppearance', 'awcTableSortLabelAppearance',
    [['Label', ['color', 'activeColor', 'gap']], ['Arrow', ['iconSize', 'restOpacity']]], 'The active color applies while the label is the active sort; the inactive arrow opacity applies to an inactive label’s arrow.'],
  'md-table-toolbar': ['tableToolbarAppearance', TABLE_TOOLBAR_APPEARANCE_FIELDS, 'INVALID_TABLE_TOOLBAR_APPEARANCE', 'Table Toolbar', 'AWCTableToolbarAppearance', 'awcTableToolbarAppearance',
    [['Bar', ['color', 'background', 'paddingBlock', 'paddingInline', 'minHeight']], ['Selection mode', ['selectionBackground', 'selectionColor']]],
    'Selection colors apply while rows are selected (numSelected, or the bound table with autoBind). compact wins over the padding and minimum height hooks, as in the source.'],
};
export const TABLE_APPEARANCE_TAGS = Object.freeze(Object.keys(SPEC));
export const TABLE_APPEARANCE_KEYS = Object.freeze(Object.fromEntries(TABLE_APPEARANCE_TAGS.map(tag => [tag, SPEC[tag][0]])));
export const TABLE_APPEARANCES = Object.freeze(Object.fromEntries(TABLE_APPEARANCE_TAGS.map(tag => [tag, profile(SPEC[tag][1], SPEC[tag][2], SPEC[tag][3])])));
/** Registry entries for COMPONENT_APPEARANCES (component-appearance.js). */
export const TABLE_APPEARANCE_REGISTRY = Object.freeze(Object.fromEntries(TABLE_APPEARANCE_TAGS.map(tag => {
  const [key, list, , , nativeType, swiftModifier, groups, note] = SPEC[tag], p = TABLE_APPEARANCES[tag];
  return [tag, Object.freeze({ key, fields: list, normalize: p.normalize, css: p.css, parseInput: p.parseInput, formatInput: p.formatInput, nativeValue: p.nativeValue,
    nativeImports: tag === 'md-table-container' ? ['AWCBoxShadow', 'AWCCornerLength', 'AWCCornerRadius', 'AWCCornerShape'] : [], swiftModifier, nativeType, groups, note })];
})));
/** [key, tag, error code] triples for native-render.mjs. */
export const TABLE_APPEARANCE_RENDER = Object.freeze(TABLE_APPEARANCE_TAGS.map(tag => [SPEC[tag][0], tag, SPEC[tag][2]]));

// ---- retained property updates (every source property of the eleven tags) ------------------------------------------
const E = values => ({ enum: values });
const DENSITY = E([0, -1, -2, -3, -4]);
const S = 'string', N = 'number', B = 'boolean';
export const TABLE_PROPERTY_TYPES = Object.freeze({
  'md-table': { density: E(['compact', 'standard', 'comfortable', 0, -1, -2, -3, -4]), columnTemplate: S, columns: N, minWidth: S, stickyHeader: B, frozenHeader: B,
    keepHeight: B, scrollbar: E(['overlay', 'gutter']), pinMode: E(['stack', 'static']), pinIcon: S, stickyFooter: B, striped: B, noDividers: B, hoverable: B,
    motion: E(['expressive', 'none']), selection: E(['none', 'single', 'multiple']), sortBy: S, sortOrder: E(['asc', 'desc', 'none']), loading: B,
    loadingMode: E(['overlay', 'skeleton']), loadingRows: N, empty: B, label: S, caption: S, summary: S, rowOffset: N, rowCount: N },
  'md-table-body': { presentational: B },
  'md-table-foot': { presentational: B },
  'md-table-cell': { align: E(['start', 'center', 'end', 'justify']), numeric: B, padding: E(['default', 'none', 'checkbox']), head: B,
    scope: E(['col', 'row', 'colgroup', 'rowgroup', '']), sticky: E(['start', 'end', '']), colSpan: N, rowSpan: N, ellipsis: B, variant: E(['body', 'meta']),
    noPinIndicator: B, pinIcon: S, density: DENSITY },
  'md-table-container': { variant: E(['elevated', 'outlined', 'filled', 'flat']), shape: E(['extra-large', 'large', 'medium', 'small', 'none']), maxHeight: S, minHeight: S,
    vibrant: B, elevation: E([0, 1, 2, 3, 4, 5]) },
  'md-table-expand-toggle': { buttonLabel: S, icon: S },
  'md-table-pagination': { count: N, page: N, rowsPerPage: N, rowsPerPageOptions: S, showFirstLast: B, labelDisplayedRows: S, labelRowsPerPage: S, labelFirstPage: S,
    labelPreviousPage: S, labelNextPage: S, labelLastPage: S, labelAll: S, label: S, compact: B, disabled: B, density: DENSITY },
  'md-table-row': { rowgroup: E(['head', 'body', 'foot']), selected: B, disabled: B, selectable: B, clickable: B, value: S, expandable: B, expanded: B, highlight: B },
  'md-table-sort-label': { column: S, disabled: B, defaultOrder: E(['asc', 'desc']), iconPosition: E(['start', 'end']), icon: S, inactiveIcon: E(['always', 'hover']),
    active: B, order: E(['asc', 'desc', 'none']), sortedAscendingLabel: S, sortedDescendingLabel: S, density: DENSITY },
  'md-table-toolbar': { headline: S, supportingText: S, numSelected: N, autoBind: B, labelSelected: S, compact: B, density: DENSITY },
});
/** md-table-head has no properties, so it has no retained updates. */
export const TABLE_UPDATE_PROPERTIES = Object.freeze(Object.fromEntries(Object.entries(TABLE_PROPERTY_TYPES).map(([tag, types]) => [tag, Object.freeze(Object.keys(types))])));
export const TABLE_UPDATE_LABELS = Object.freeze({ 'md-table': 'Table', 'md-table-body': 'Table Body', 'md-table-foot': 'Table Foot', 'md-table-cell': 'Table Cell',
  'md-table-container': 'Table Container', 'md-table-expand-toggle': 'Table Expand Toggle', 'md-table-pagination': 'Table Pagination', 'md-table-row': 'Table Row',
  'md-table-sort-label': 'Table Sort Label', 'md-table-toolbar': 'Table Toolbar' });
const bytes = value => new TextEncoder().encode(value).length;
export function validTableUpdate(tag, key, value) {
  const type = TABLE_PROPERTY_TYPES[tag]?.[key];
  if (type === undefined) return false;
  if (type.enum) return type.enum.includes(value);
  if (type === B) return typeof value === 'boolean';
  if (type === N) return typeof value === 'number' && Number.isFinite(value);
  return typeof value === 'string' && bytes(value) <= 4096;
}

// ---- methods with results ----------------------------------------------------------------------------------------
export const TABLE_METHODS = Object.freeze({
  'md-table': ['getSelection', 'selectAll', 'deselectAll', 'toggleSelectAll', 'setSort', 'pinColumn', 'setColumnVisibility', 'animateNextChange'],
  'md-table-row': ['toggle'], 'md-table-pagination': ['goToPage', 'setRowsPerPage'],
});
export const nativeTableMethod = (tag, method) => Boolean(TABLE_METHODS[tag]?.includes(method));
/** Wire arguments: setSort(column, order); pinColumn(column, side); setColumnVisibility(column, visible); goToPage(page);
 *  setRowsPerPage(rows). Columns are original column indices; pages and rows are integers. */
export function tableMethodArguments(tag, method, args) {
  const fail = message => { throw Object.assign(new Error(message), { code: 'INVALID_METHOD' }); };
  const index = value => Number.isSafeInteger(value) && value >= 0;
  switch (method) {
    case 'setSort':
      if (args.length !== 2 || typeof args[0] !== 'string' || bytes(args[0]) > 4096 || !['asc', 'desc', 'none'].includes(args[1])) fail('setSort requires a column id and asc, desc or none.');
      return [args[0], args[1]];
    case 'pinColumn':
      if (args.length !== 2 || !index(args[0]) || !['start', 'end', 'none'].includes(args[1])) fail('pinColumn requires a column index (an integer from 0) and start, end or none.');
      return [args[0], args[1]];
    case 'setColumnVisibility':
      if (args.length !== 2 || !index(args[0]) || typeof args[1] !== 'boolean') fail('setColumnVisibility requires a column index (an integer from 0) and a boolean.');
      return [args[0], args[1]];
    case 'goToPage':
      if (args.length !== 1 || !Number.isSafeInteger(args[0])) fail('goToPage requires a page index (an integer).');
      return [args[0]];
    case 'setRowsPerPage':
      if (args.length !== 1 || !Number.isSafeInteger(args[0]) || args[0] < 1) fail('setRowsPerPage requires a positive integer.');
      return [args[0]];
    default:
      if (args.length) fail(`${method} requires no arguments.`);
      return [];
  }
}
/** Method results: getSelection() → { count, total, values, all, indeterminate }; pinColumn() → start, end or null
 *  (setColumnVisibility() returns a boolean, handled by the shared check). Anything else is not a table result. */
// The live hosts send a table method's result as { awcTableResult: value } (the generic method-result contract rejects a
// bare null, which pinColumn returns when nothing is pinned): null, start / end, a boolean or a selection snapshot.
export function tableMethodValue(envelope) {
  if (!plain(envelope) || Reflect.ownKeys(envelope).join() !== 'awcTableResult') return undefined;
  const value = envelope.awcTableResult;
  if (value === null || value === 'start' || value === 'end' || typeof value === 'boolean') return { value };
  if (!plain(value)) return undefined;
  const keys = Reflect.ownKeys(value);
  if (keys.length !== 5 || !['count', 'total', 'values', 'all', 'indeterminate'].every(key => keys.includes(key))) return undefined;
  const { count, total, values, all, indeterminate } = value;
  if (![count, total].every(n => Number.isSafeInteger(n) && n >= 0) || count > total || typeof all !== 'boolean' || typeof indeterminate !== 'boolean'
    || !Array.isArray(values) || values.length !== count || !values.every(item => typeof item === 'string' && bytes(item) <= 4096)) return undefined;
  return { value: { count, total, values: [...values], all, indeterminate } };
}

/** The md-table family's typed part targets per tag (::part names; AWCTablePart natively, gate-7 r5 R5-07). */
export const TABLE_PARTS = Object.freeze({"md-table": ["caption", "grid", "header-grid", "hscrollbar", "hscrollbar-thumb", "vscrollbar", "vscrollbar-thumb", "skeleton-row", "loading", "progress", "empty"], "md-table-cell": ["content", "pin"], "md-table-container": ["top", "scroll", "bottom"], "md-table-row": ["expanded"], "md-table-sort-label": ["icon", "label"], "md-table-toolbar": ["main", "leading", "headline", "supporting-text", "selection-caption", "actions"], "md-table-pagination": ["display", "rpp", "rpp-select", "nav", "first-button", "prev-button", "next-button", "last-button"]});
