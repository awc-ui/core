/**
 * The public surface of the Pictor vertical.
 *
 * Every framework build imports from `@awc-ui/showcase-kit/design` and never
 * reaches into a file below this one — which is what lets the internals move
 * without touching five applications, and what makes "does a screen do this
 * itself or ask the kit?" a question with a visible answer.
 *
 * `generated.ts` is exported as `FIXTURE` for the invariant checks and for
 * nothing else. A screen that reads it directly has bypassed every selector.
 */

export {
  ADJUSTMENT_STEP,
  CANVAS_COLS,
  CANVAS_ROWS,
  CONTAINER_KINDS,
  DEFAULT_ZOOM_INDEX,
  HISTORY_LIMIT,
  LIST_PAGE,
  MIN_LAYER_CELLS,
  MIXED,
  OPACITY_STEP,
  PALETTE,
  REPORTING_DATE,
  REPORTING_INSTANT,
  TREE_MAX_DEPTH,
  VIEWER_HANDLE,
  ZOOM_LEVELS,
  paletteHex,
  toRung,
} from './types';

export type {
  Adjustment,
  AdjustmentKind,
  AlignAxis,
  Artwork,
  Asset,
  AssetKind,
  BlendMode,
  BooleanOp,
  Common,
  ComponentDef,
  DesignFile,
  DesignFixture,
  DesignTotals,
  DistributeAxis,
  Edit,
  EditKind,
  FileState,
  Layer,
  LayerKind,
  Mixed,
  Project,
  Rect,
  ToolMode,
  Viewer,
} from './types';

export {
  EMPTY_HISTORY,
  alignLayers,
  ancestorIds,
  booleanRect,
  canRedo,
  canReparent,
  canUndo,
  cellsMoved,
  childrenOf,
  clampRect,
  commonValue,
  depthOf,
  descendantIds,
  distributeLayers,
  effectiveLocked,
  effectiveVisible,
  filterCss,
  isContainer,
  isMixed,
  layerById,
  lockedLayers,
  marqueeHits,
  moveSubtree,
  pushEdit,
  redo,
  rectsIntersect,
  reorderSibling,
  reparent,
  resizeRect,
  rulerTicks,
  selectionBounds,
  undo,
  unionRect,
  visibleLayers,
  zOrder,
  zoomIn,
  zoomOut,
  zoomPercent,
} from './derive';

export type { History } from './derive';

export {
  ADJUSTMENT_ORDER,
  ALIGN_ORDER,
  ASSET_ORDER,
  BLEND_ORDER,
  BOOLEAN_ORDER,
  TOOL_ORDER,
  adjustmentIcon,
  adjustmentKey,
  alignIcon,
  alignKey,
  assetIcon,
  assetKey,
  blendKey,
  booleanIcon,
  booleanKey,
  editIcon,
  editKey,
  fileStateIcon,
  fileStateKey,
  fileStateTone,
  layerIcon,
  layerKindKey,
  layerTone,
  lockIcon,
  lockLabelKey,
  toolIcon,
  toolKey,
  visibilityIcon,
  visibilityLabelKey,
} from './status';

export {
  allLayers,
  assetById,
  assetUsage,
  assetsOfKind,
  componentById,
  componentUsage,
  defaultFile,
  fileById,
  filesInProject,
  getAssets,
  getComponents,
  getFiles,
  getProjects,
  getTotals,
  getViewer,
  handleInitial,
  paintOrder,
  projectById,
  projectBySlug,
  projectSlug,
  recentFiles,
  sharedFiles,
  slugify,
} from './selectors';

export {
  DESTINATIONS,
  FRAMEWORKS,
  SHOWCASE_BASE,
  createRoutes,
  crumbsFor,
  destinationFor,
  destinationIndex,
  route,
} from './routes';

export type { CrumbSpec, Destination, DesignRoutes, Framework, RouteName } from './routes';

export { FIXTURE } from './generated';
