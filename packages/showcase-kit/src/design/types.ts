/**
 * Domain model for the "Pictor — Design & Image" showcase vertical.
 *
 * A design tool: a canvas of nested layers, a layer tree beside it, and an
 * inspector bound to whatever is selected. It is the SEVENTH vertical, and what
 * it adds to the other six is not another noun and not another axis — it is a
 * different SHAPE OF STATE.
 *
 * WHAT MAKES IT A DIFFERENT APPLICATION FROM THE OTHER SIX, in the order the
 * difference costs component work:
 *
 *   - THE DOCUMENT IS A TREE, AND EVERY QUESTION IS RECURSIVE. Cygnus's tracks
 *     are a list; a feed is a list; a table is a list. Here a layer sits inside
 *     a group inside a frame, and "is this visible?" cannot be answered by
 *     reading the layer — a visible layer inside a hidden group is not visible.
 *     Neither can "is this locked?", "where is it on the canvas?", or "what
 *     order does it paint in?". Six verticals answer their questions with a
 *     property lookup. This one answers them with a walk to the root.
 *   - SELECTION IS A SET, NOT A CURSOR. Every other vertical selects one thing:
 *     one row, one post, one track. An editor selects five layers and then asks
 *     what their shared fill is — and the honest answer is often "they differ".
 *     `MIXED` is a real value in this model, it renders, and it is editable:
 *     typing into a mixed field assigns to the whole selection.
 *   - GEOMETRY IS THE CONTENT. A table cell holds a number that happens to be
 *     rendered somewhere. A rectangle's x, y, width and height ARE the thing
 *     being edited, they are edited by dragging, and the number in the
 *     inspector and the shape on the canvas are two views of one value that
 *     must never disagree.
 *   - AN EDIT HAS AN INVERSE AND A NAME. Cygnus introduced undo; here it is
 *     load-bearing rather than a demonstration. "Align 4 layers left" is one
 *     history entry that moved four independent values, and undoing it must
 *     restore all four — which means the history stores VALUES, not gestures.
 *
 * THE CANVAS IS A GRID, AND THAT IS A CONSTRAINT MADE INTO A FEATURE.
 * The deployed policy is `style-src-attr 'none'`, so nothing may carry a
 * `style` attribute — which is exactly how every design tool on the web
 * positions a shape. Cygnus met the one-dimensional version of this by giving
 * its timeline one CSS grid column per bar. A canvas needs two dimensions, so
 * the artboard is a CANVAS_COLS x CANVAS_ROWS grid and every layer's rect is
 * measured in CELLS, positioned by generated `[data-x]` / `[data-y]` /
 * `[data-w]` / `[data-h]` rules in `app.css`.
 *
 * The result is not a compromise. Snapping is what a design tool wants anyway,
 * the numbers in the inspector are integers a reader can reason about, and the
 * plain-HTML build — which writes markup and cannot reach the CSSOM — renders
 * the identical canvas to the four SPAs. A pixel-precise canvas would have made
 * that build impossible.
 *
 * NOTHING IS RASTERISED, AND THAT IS A DESIGN DECISION RATHER THAN A GAP.
 * Blend modes, opacity and adjustments are real values on real layers, and the
 * canvas renders them with CSS `mix-blend-mode` and `filter` — but there is no
 * pixel buffer, no `<canvas>`, and no export that produces a file. Three
 * reasons, in the order they bite:
 *
 *   1. A PIXEL PIPELINE IS UNTESTABLE HERE. The parity check compares five
 *      builds' document heights and text content. Canvas output is opaque to
 *      it, so an editor built on `<canvas>` would be five black boxes the
 *      comparison cannot see into — and the comparison is the point.
 *   2. THERE ARE NO PHOTOGRAPHS TO SHIP. Real images are licensed binaries;
 *      every picture here is generated SVG inlined as a `data:` URI.
 *   3. IT IS THE SAME PROMISE THE OTHER VERTICALS MAKE. Corvus never posts,
 *      Lyra never uploads, Cygnus never plays. The showcase demonstrates the
 *      INTERFACE to an operation, not the operation.
 *
 * Everything is a plain, serialisable value. There is no runtime clock and no
 * randomness: the fixture is generated once at authoring time from a seeded
 * PRNG (`scripts/generate-design-fixture.mjs`) and baked into `generated.ts`,
 * so every framework build renders byte-identical output.
 *
 * THE FIVE CONVENTIONS every fixture in this repository follows:
 *
 *   1. Every ratio is a FRACTION. `0.0135` means 1.35%. Pass them straight to
 *      `t.formatPercent()`, which multiplies by 100 itself. Opacity is the
 *      documented exception and is stored 0..100, because it is an integer the
 *      inspector edits directly and a percent sign is part of its label.
 *   2. Every enum-ish value carries a `…Key` twin (`kind` / `kindKey`) that
 *      resolves through the shared dictionary. Render the key, never the raw
 *      value — the raw value is for logic and for `status.ts`.
 *   3. Proper nouns live here untranslated; prose lives in the dictionary. A
 *      project's name, a file's name and a layer's name are fixture data.
 *      Every description and note is a `…Key`.
 *   4. TIME IS AN INSTANT, NOT A DATE. Every timestamp is a full UTC instant
 *      rendered against `REPORTING_INSTANT`, so the screenshots do not age.
 *   5. EVERY IMAGE IS SELF-DESCRIBING. Every `Artwork` carries an `altKey` and
 *      no screen may render an `<img>` without resolving it.
 */

/* ------------------------------------------------------------- the instant */

/**
 * WHEN THIS DOCUMENT WAS LAST TOUCHED. Every relative timestamp on every screen
 * is measured against this, so "edited 2 hours ago" stays true forever.
 */
export const REPORTING_INSTANT = '2026-12-04T11:40:00Z';
export const REPORTING_DATE = '2026-12-04';

/** Whose session this is. Matches the `viewer` record in the fixture. */
export const VIEWER_HANDLE = 'juno.ferreira';

/* --------------------------------------------------------------- the grid */

/**
 * THE ARTBOARD IS 48 x 32 CELLS, and both numbers are part of the contract.
 *
 * `app.css` generates a positioning rule for every column and every row, so the
 * grid's size is the size of that generated block: 48 + 32 + 48 + 32 = 160
 * rules. Doubling the grid doubles the stylesheet for no visible gain, because
 * a cell is already smaller than the smallest thing anyone drags.
 *
 * 48 x 32 is 3:2, which matches the artboard proportions the fixture uses and
 * means a layer that looks square on screen is square in cells.
 */
export const CANVAS_COLS = 48;
export const CANVAS_ROWS = 32;

/**
 * THE PROJECT PALETTE, and a fill is a TOKEN INTO IT rather than a free colour.
 *
 * This is the second thing the CSP constraint decides, after the grid. A fill
 * cannot be a `style` attribute, so it has to be a class or a data attribute
 * the stylesheet already knows about — which means the set of possible fills
 * has to be finite and known at build time.
 *
 * The four SPA builds could dodge this by writing `el.style.background`, which
 * CSP permits because script is already trusted. The plain-HTML build cannot:
 * it writes markup and never touches the CSSOM. So a free colour would give
 * four builds one canvas and the fifth a different one, and parity would be
 * right to call that a failure.
 *
 * Making it a palette is not a workaround dressed up as a feature. Every design
 * system has a fixed set of colours and every design tool puts them in a
 * swatch picker; a free colour well is the thing teams add lint rules against.
 */
export const PALETTE: readonly { readonly token: string; readonly hex: string; readonly nameKey: string }[] =
  Object.freeze([
    { token: 'p0', hex: '#1F3A5F', nameKey: 'design.swatch.p0' },
    { token: 'p1', hex: '#2E6F76', nameKey: 'design.swatch.p1' },
    { token: 'p2', hex: '#7A4E9B', nameKey: 'design.swatch.p2' },
    { token: 'p3', hex: '#B3543C', nameKey: 'design.swatch.p3' },
    { token: 'p4', hex: '#3F7A34', nameKey: 'design.swatch.p4' },
    { token: 'p5', hex: '#8C6A1F', nameKey: 'design.swatch.p5' },
    { token: 'p6', hex: '#4A4A57', nameKey: 'design.swatch.p6' },
    { token: 'p7', hex: '#A8354F', nameKey: 'design.swatch.p7' },
    { token: 'p8', hex: '#2B5FA8', nameKey: 'design.swatch.p8' },
    { token: 'p9', hex: '#6B7A2E', nameKey: 'design.swatch.p9' },
    { token: 'ink', hex: '#12141A', nameKey: 'design.swatch.ink' },
    { token: 'paper', hex: '#E8EAF0', nameKey: 'design.swatch.paper' },
  ]);

export const paletteHex = (token: string | null): string | null =>
  PALETTE.find((p) => p.token === token)?.hex ?? null;

/**
 * OPACITY AND ADJUSTMENTS MOVE IN RUNGS, for the same reason fills are tokens:
 * every value one can hold must have a rule in the stylesheet.
 *
 * Opacity steps by 5, which is 21 rules and finer than anyone drags a slider.
 * Adjustments step by 20 across -100..100, which is 10 non-zero rungs per kind
 * and 40 rules in total — and an adjustment is a coarse control anyway, so the
 * rungs are what a reader would have reached for.
 */
export const OPACITY_STEP = 5;
export const ADJUSTMENT_STEP = 20;

/** Snap an arbitrary number onto its rung. The inspector calls this on input. */
export const toRung = (value: number, step: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, Math.round(value / step) * step));

/** The smallest a layer may be. Zero-width shapes are unselectable. */
export const MIN_LAYER_CELLS = 1;

/**
 * ZOOM IS A RUNG, NOT A NUMBER. A continuous zoom would put a non-integer scale
 * on the grid and reintroduce the sub-pixel positioning the grid exists to
 * avoid. These five rungs all divide cleanly.
 */
export const ZOOM_LEVELS = [50, 75, 100, 150, 200] as const;
export const DEFAULT_ZOOM_INDEX = 2;

/**
 * HOW DEEP THE TREE MAY NEST. A drag that would exceed this is refused rather
 * than truncated — `canReparent` is the single place that decides, and the
 * limit exists so the indent in the layer panel stays readable at every depth.
 */
export const TREE_MAX_DEPTH = 4;

/** How many entries the undo history keeps before it starts dropping. */
export const HISTORY_LIMIT = 24;

/** How many rows the file and asset lists page at. */
export const LIST_PAGE = 12;

/* ---------------------------------------------------------------- unions */

/**
 * WHAT A LAYER IS. Eight kinds, and the split matters more than the count:
 *
 *   - `frame` and `group` CONTAIN. A frame clips and is the unit an artboard is
 *     made of; a group only collects, and exists so a transform can move five
 *     things at once.
 *   - `rect`, `ellipse`, `text` and `image` are LEAVES. They are the things
 *     with geometry and paint.
 *   - `component` and `instance` are the reuse pair. A component is a leaf-like
 *     definition; an instance points at one and may override its own fill and
 *     text without touching the definition.
 */
export type LayerKind = 'frame' | 'group' | 'rect' | 'ellipse' | 'text' | 'image' | 'component' | 'instance';

/** The containers, named once so `derive.ts` never restates the list. */
export const CONTAINER_KINDS: readonly LayerKind[] = Object.freeze(['frame', 'group']);

/**
 * HOW A LAYER COMPOSITES WITH WHAT IS BEHIND IT. These are exactly the CSS
 * `mix-blend-mode` values, deliberately: the canvas renders them natively, so
 * the fixture's value and the rendered result cannot drift apart.
 */
export type BlendMode = 'normal' | 'multiply' | 'screen' | 'overlay' | 'darken' | 'lighten' | 'difference';

/**
 * THE FOUR ADJUSTMENTS an image layer carries. Each is -100..100 with 0 meaning
 * untouched, and each maps to one CSS filter function in `derive.ts` — which is
 * the only place the mapping lives, because four builds getting it slightly
 * different is exactly the drift parity exists to catch.
 */
export type AdjustmentKind = 'exposure' | 'contrast' | 'saturation' | 'temperature';

/** What the pointer does on the canvas. */
export type ToolMode = 'select' | 'frame' | 'rect' | 'ellipse' | 'text' | 'image' | 'hand';

/** Boolean operations on a multi-selection. */
export type BooleanOp = 'union' | 'subtract' | 'intersect' | 'exclude';

/** The six alignments, three per axis. */
export type AlignAxis = 'left' | 'center-x' | 'right' | 'top' | 'center-y' | 'bottom';

/** Distribution spreads the gaps evenly along one axis. */
export type DistributeAxis = 'horizontal' | 'vertical';

/** What an entry in the undo history did. */
export type EditKind =
  | 'create'
  | 'delete'
  | 'move'
  | 'resize'
  | 'reorder'
  | 'reparent'
  | 'style'
  | 'group'
  | 'ungroup'
  | 'boolean'
  | 'align'
  | 'distribute';

/** Where a file is in its review cycle. */
export type FileState = 'draft' | 'in-review' | 'approved' | 'archived';

/** What lives in the asset library. */
export type AssetKind = 'image' | 'color' | 'text-style' | 'component';

/**
 * THE VALUE AN INSPECTOR FIELD SHOWS WHEN THE SELECTION DISAGREES.
 *
 * A sentinel rather than `null` or `undefined`, because both of those are also
 * legitimate answers: `null` is "no selection" and `undefined` is "this kind of
 * layer has no such property". Mixed is a third thing and it renders — as an
 * em-dash — and it is editable, which neither of the others is.
 */
export const MIXED = Symbol.for('awc.design.mixed');
export type Mixed = typeof MIXED;
export type Common<T> = T | Mixed | null;

/* ------------------------------------------------------------- geometry */

/**
 * A RECTANGLE IN GRID CELLS, never in pixels.
 *
 * `x` and `y` are the top-left cell, zero-based. `w` and `h` are counts, so a
 * 1x1 layer occupies exactly one cell and `x + w` is the exclusive right edge.
 * Everything on the canvas is one of these, which is what lets align,
 * distribute, boolean ops and the marquee all be integer arithmetic.
 */
export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** A single adjustment on an image layer. */
export interface Adjustment {
  readonly kind: AdjustmentKind;
  readonly kindKey: string;
  /** -100..100, zero meaning untouched. */
  readonly value: number;
}

/**
 * Generated SVG, inlined as a `data:` URI. See the note at the top of the file
 * on why nothing loads over the network.
 */
export interface Artwork {
  readonly src: string;
  readonly altKey: string;
}

/* --------------------------------------------------------------- records */

/**
 * ONE LAYER. The document is a flat array of these plus `parentId`, not a
 * nested structure, and that is deliberate:
 *
 *   - Reparenting is one field write instead of a splice out of one array and
 *     into another, so it cannot half-happen.
 *   - The history can store a layer's whole previous value without deep-cloning
 *     a subtree.
 *   - Every framework build can hold the document in whatever it calls state
 *     without a recursive reconciler.
 *
 * The cost is that every structural question has to be derived. That is what
 * `derive.ts` is for, and it is a good trade: derived once, correct in five
 * builds.
 */
export interface Layer {
  readonly id: string;
  /** `null` for a top-level layer. Never points at a descendant of itself. */
  readonly parentId: string | null;
  readonly kind: LayerKind;
  readonly kindKey: string;
  /** A proper noun, per convention 3. Renamed by the reader, never translated. */
  readonly name: string;
  /** Position and size in grid cells, absolute on the artboard. */
  readonly rect: Rect;
  /** Sibling order. Lower paints first; `zOrder` turns this into paint order. */
  readonly order: number;
  /** This layer's own flag. Ask `effectiveVisible` what the reader actually sees. */
  readonly visible: boolean;
  /** This layer's own flag. Ask `effectiveLocked` whether it can be selected. */
  readonly locked: boolean;
  /** 0..100. The documented exception to convention 1. */
  readonly opacity: number;
  readonly blend: BlendMode;
  readonly blendKey: string;
  /** A PALETTE TOKEN (see `PALETTE`), or `null` for the kinds with no fill. */
  readonly fill: string | null;
  /** Populated for `image` layers, empty for everything else. */
  readonly adjustments: readonly Adjustment[];
  /** Image layers only: whether the layer's alpha is clipped by its parent. */
  readonly masked: boolean;
  /** Image layers only. */
  readonly art: Artwork | null;
  /** Text layers only. A dictionary key, per convention 3. */
  readonly textKey: string | null;
  /** Instances only: which component this resolves against. */
  readonly componentId: string | null;
}

/** A reusable definition. Instances point at one of these by id. */
export interface ComponentDef {
  readonly id: string;
  readonly name: string;
  readonly descriptionKey: string;
  readonly art: Artwork;
  /** How many instances exist across every file. Derived once at generation. */
  readonly instanceCount: number;
}

/** One design document. */
export interface DesignFile {
  readonly id: string;
  readonly projectId: string;
  readonly name: string;
  readonly state: FileState;
  readonly stateKey: string;
  readonly art: Artwork;
  readonly layers: readonly Layer[];
  readonly updatedAt: string;
  readonly editorHandles: readonly string[];
}

/** A folder of files. */
export interface Project {
  readonly id: string;
  readonly name: string;
  readonly descriptionKey: string;
  readonly art: Artwork;
  readonly fileIds: readonly string[];
  readonly updatedAt: string;
}

/** One entry in the shared asset library. */
export interface Asset {
  readonly id: string;
  readonly kind: AssetKind;
  readonly kindKey: string;
  readonly name: string;
  /** Populated for `color` assets; `null` otherwise. */
  readonly color: string | null;
  /** Populated for `image` and `component` assets; `null` otherwise. */
  readonly art: Artwork | null;
  /** Which files use it. Drives the "used in N files" line and the drill. */
  readonly usedByFileIds: readonly string[];
}

/**
 * ONE ENTRY IN THE UNDO HISTORY.
 *
 * `before` and `after` are the WHOLE previous and next value of every layer the
 * edit touched, not a description of the gesture. An "align 4 layers left"
 * entry carries four before-rects and four after-rects, because replaying a
 * gesture requires knowing the state it started from and storing values does
 * not. It costs memory the fixture can easily afford.
 */
export interface Edit {
  readonly id: string;
  readonly kind: EditKind;
  readonly kindKey: string;
  /** What the history panel prints. Parameterised with a count where relevant. */
  readonly labelKey: string;
  readonly layerIds: readonly string[];
  readonly before: readonly Layer[];
  readonly after: readonly Layer[];
  readonly at: string;
}

/** Whose session this is. */
export interface Viewer {
  readonly handle: string;
  readonly displayName: string;
  readonly art: Artwork;
}

/** The counts the shell and the profile screen print. */
export interface DesignTotals {
  readonly projects: number;
  readonly files: number;
  readonly layers: number;
  readonly components: number;
  readonly assets: number;
  readonly sharedFiles: number;
  readonly editedThisWeek: number;
}

export interface DesignFixture {
  readonly viewer: Viewer;
  readonly projects: readonly Project[];
  readonly files: readonly DesignFile[];
  readonly assets: readonly Asset[];
  readonly components: readonly ComponentDef[];
  readonly totals: DesignTotals;
}
