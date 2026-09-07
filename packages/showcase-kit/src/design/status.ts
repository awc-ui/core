/**
 * The presentation vocabulary: which icon, which tone, which label key.
 *
 * Every mapping from a domain value to something a component renders lives
 * here, for the reason the other six verticals give: five builds each picking
 * their own icon for `multiply` is five chances to disagree, and parity would
 * report the disagreement without saying which one is right.
 *
 * Nothing in this file returns a translated string. It returns KEYS, and the
 * caller resolves them — which is what lets the same mapping serve en, ro and
 * ar without knowing any of them exist.
 */

import type { AdjustmentKind, AlignAxis, AssetKind, BlendMode, BooleanOp, EditKind, FileState, LayerKind, ToolMode } from './types';

/* ---------------------------------------------------------------- layers */

/**
 * A LAYER'S ICON IS ITS KIND, and the tree leans on it hard: at four levels of
 * indent the icon is doing more work than the name, because the name is
 * truncated and the icon never is.
 */
const LAYER_ICONS: Record<LayerKind, string> = {
  frame: 'crop_free',
  group: 'folder',
  rect: 'rectangle',
  ellipse: 'circle',
  text: 'title',
  image: 'image',
  component: 'widgets',
  instance: 'deployed_code',
};

export const layerIcon = (kind: LayerKind): string => LAYER_ICONS[kind];
export const layerKindKey = (kind: LayerKind): string => `design.layerKind.${kind}`;

/**
 * VISIBILITY AND LOCK ARE TOGGLES WITH TWO ICONS EACH, and the icon names the
 * CURRENT STATE rather than the action — which is the opposite of what a button
 * usually does. It is right here because the tree shows twelve of these at once
 * and they are being read as a column of state, not as twelve offers.
 *
 * The accessible name says the action; see the label keys.
 */
export const visibilityIcon = (visible: boolean): string => (visible ? 'visibility' : 'visibility_off');
export const visibilityLabelKey = (visible: boolean): string => (visible ? 'design.action.hide' : 'design.action.show');

export const lockIcon = (locked: boolean): string => (locked ? 'lock' : 'lock_open');
export const lockLabelKey = (locked: boolean): string => (locked ? 'design.action.unlock' : 'design.action.lock');

/**
 * A LAYER THE READER CANNOT SEE IS DIMMED, NOT HIDDEN FROM THE TREE.
 *
 * The parity census counts DOM elements, so a tree that dropped hidden layers
 * would have a different element count from one that dimmed them — but more
 * importantly, a layer panel that hides hidden layers is a layer panel you
 * cannot use to unhide anything.
 */
export const layerTone = (visible: boolean, locked: boolean): string =>
  !visible ? 'hidden' : locked ? 'locked' : 'normal';

/* ----------------------------------------------------------------- blend */

export const blendKey = (blend: BlendMode): string => `design.blend.${blend}`;

/** Dock order for the blend picker: normal first, then dark, light, contrast. */
export const BLEND_ORDER: readonly BlendMode[] = Object.freeze([
  'normal',
  'multiply',
  'darken',
  'screen',
  'lighten',
  'overlay',
  'difference',
]);

/* ------------------------------------------------------------ adjustments */

const ADJUSTMENT_ICONS: Record<AdjustmentKind, string> = {
  exposure: 'exposure',
  contrast: 'contrast',
  saturation: 'water_drop',
  temperature: 'thermostat',
};

export const adjustmentIcon = (kind: AdjustmentKind): string => ADJUSTMENT_ICONS[kind];
export const adjustmentKey = (kind: AdjustmentKind): string => `design.adjustment.${kind}`;
export const ADJUSTMENT_ORDER: readonly AdjustmentKind[] = Object.freeze([
  'exposure',
  'contrast',
  'saturation',
  'temperature',
]);

/* ----------------------------------------------------------------- tools */

const TOOL_ICONS: Record<ToolMode, string> = {
  select: 'arrow_selector_tool',
  frame: 'crop_free',
  rect: 'rectangle',
  ellipse: 'circle',
  text: 'title',
  image: 'add_photo_alternate',
  hand: 'pan_tool',
};

export const toolIcon = (tool: ToolMode): string => TOOL_ICONS[tool];
export const toolKey = (tool: ToolMode): string => `design.tool.${tool}`;

/**
 * TOOLBAR ORDER, and `hand` is last for a reason: it is the only tool that does
 * not create or select anything, so it belongs at the end rather than beside
 * `select` where its neighbour would suggest they are alternatives for the same
 * job.
 */
export const TOOL_ORDER: readonly ToolMode[] = Object.freeze([
  'select',
  'frame',
  'rect',
  'ellipse',
  'text',
  'image',
  'hand',
]);

/* ------------------------------------------------------------ align / bool */

const ALIGN_ICONS: Record<AlignAxis, string> = {
  left: 'align_horizontal_left',
  'center-x': 'align_horizontal_center',
  right: 'align_horizontal_right',
  top: 'align_vertical_top',
  'center-y': 'align_vertical_center',
  bottom: 'align_vertical_bottom',
};

export const alignIcon = (axis: AlignAxis): string => ALIGN_ICONS[axis];
export const alignKey = (axis: AlignAxis): string => `design.align.${axis}`;
export const ALIGN_ORDER: readonly AlignAxis[] = Object.freeze([
  'left',
  'center-x',
  'right',
  'top',
  'center-y',
  'bottom',
]);

const BOOLEAN_ICONS: Record<BooleanOp, string> = {
  union: 'join_full',
  subtract: 'join_left',
  intersect: 'join_inner',
  exclude: 'join_right',
};

export const booleanIcon = (op: BooleanOp): string => BOOLEAN_ICONS[op];
export const booleanKey = (op: BooleanOp): string => `design.boolean.${op}`;
export const BOOLEAN_ORDER: readonly BooleanOp[] = Object.freeze(['union', 'subtract', 'intersect', 'exclude']);

/* ---------------------------------------------------------------- history */

const EDIT_ICONS: Record<EditKind, string> = {
  create: 'add',
  delete: 'delete',
  move: 'drag_pan',
  resize: 'open_in_full',
  reorder: 'swap_vert',
  reparent: 'move_down',
  style: 'palette',
  group: 'folder',
  ungroup: 'folder_off',
  boolean: 'join_full',
  align: 'align_horizontal_left',
  distribute: 'horizontal_distribute',
};

export const editIcon = (kind: EditKind): string => EDIT_ICONS[kind];
export const editKey = (kind: EditKind): string => `design.edit.${kind}`;

/* ------------------------------------------------------------------ files */

/**
 * A FILE'S STATE IS A CHIP, and the tone is the same four-way scale every
 * console in this repository uses, so a reader who has seen Aurelia knows what
 * amber means here without being told.
 */
const FILE_STATE_TONES: Record<FileState, string> = {
  draft: 'neutral',
  'in-review': 'warning',
  approved: 'success',
  archived: 'neutral',
};

const FILE_STATE_ICONS: Record<FileState, string> = {
  draft: 'edit_note',
  'in-review': 'rate_review',
  approved: 'check_circle',
  archived: 'inventory_2',
};

export const fileStateTone = (state: FileState): string => FILE_STATE_TONES[state];
export const fileStateIcon = (state: FileState): string => FILE_STATE_ICONS[state];
export const fileStateKey = (state: FileState): string => `design.fileState.${state}`;

/* ----------------------------------------------------------------- assets */

const ASSET_ICONS: Record<AssetKind, string> = {
  image: 'image',
  color: 'format_color_fill',
  'text-style': 'text_fields',
  component: 'widgets',
};

export const assetIcon = (kind: AssetKind): string => ASSET_ICONS[kind];
export const assetKey = (kind: AssetKind): string => `design.assetKind.${kind}`;
export const ASSET_ORDER: readonly AssetKind[] = Object.freeze(['image', 'color', 'text-style', 'component']);
