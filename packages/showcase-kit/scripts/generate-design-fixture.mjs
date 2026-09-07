/**
 * Generate `src/design/generated.ts` — the Pictor fixture.
 *
 * Run once at authoring time, never at build time and never in a browser. The
 * output is a plain module of frozen literals, so all five framework builds
 * render byte-identical documents and the parity check has something stable to
 * compare.
 *
 * WHAT THIS FILE GUARANTEES, and why each one is asserted rather than hoped for:
 *
 *   - NO LAYER LEAVES THE ARTBOARD. Every rect fits inside CANVAS_COLS x
 *     CANVAS_ROWS. A layer at x=47 with w=4 would render clipped in four builds
 *     and clipped differently in the fifth.
 *   - NO CHILD ESCAPES ITS PARENT. A layer inside a frame is inside that
 *     frame's rect. Rects are absolute, so nothing enforces this structurally —
 *     which is exactly why it is checked here.
 *   - THE TREE IS A TREE. No cycles, and nothing nests deeper than
 *     TREE_MAX_DEPTH. `canReparent` refuses to create either at runtime; the
 *     fixture must not ship one.
 *   - SIBLING ORDER IS DENSE. Each parent's children are numbered 0..n-1 with
 *     no gaps and no duplicates, because `reorderSibling` assumes it.
 *   - EVERY ENUM VALUE IS REACHABLE. All eight layer kinds, all seven blend
 *     modes, all four adjustments, all four file states and all four asset
 *     kinds appear somewhere. A screen cannot be reviewed against a state the
 *     fixture never produces.
 *   - EVERY INSTANCE RESOLVES. An instance's componentId names a real
 *     component, and every component's instanceCount matches the instances
 *     that actually exist.
 *   - THE INSPECTOR HAS SOMETHING TO SAY. At least one file contains a set of
 *     sibling layers that DISAGREE on fill, opacity and blend, so the MIXED
 *     state is reachable by selecting them — the fixture has to make the
 *     interesting case possible or it will never be seen.
 */

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createArtwork } from './lib/artwork.mjs';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'design', 'generated.ts');

/* A seventh seed, so Pictor's artwork does not repeat Cygnus's. */
const SEED = 0x7c1a5e93;
const REPORTING_INSTANT = '2026-12-04T11:40:00Z';
const REPORTING_MS = Date.parse(REPORTING_INSTANT);
const VIEWER_HANDLE = 'juno.ferreira';

/* Mirrors `src/design/types.ts`; see the note there on why the canvas is a grid. */
const CANVAS_COLS = 48;
const CANVAS_ROWS = 32;
const TREE_MAX_DEPTH = 4;

/* How many of each prose pool the dictionary holds. Every `…Key` this file
   emits indexes into one of these, and `scripts/verify.mjs` fails if a key it
   names is missing from any locale. */
const PROJECT_ABOUT = 8;
const COMPONENT_ABOUT = 10;
const TEXT_STRINGS = 16;

/* ------------------------------------------------------------------- prng */

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rnd = mulberry32(SEED);
const uf = (min, max) => min + rnd() * (max - min);
const ui = (min, max) => Math.floor(uf(min, max + 1));
const pick = (arr) => arr[ui(0, arr.length - 1)];
const chance = (p) => rnd() < p;

const { artwork } = createArtwork(rnd);

/* ---------------------------------------------------------------- helpers */

const rows = (list) => list.map((row) => `  ${JSON.stringify(row)},`).join('\n');
const hoursBefore = (h) => new Date(REPORTING_MS - h * 3600_000).toISOString().replace('.000', '');

/* --------------------------------------------------------------- vocabulary */

const BLEND_MODES = ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'difference'];
const ADJUSTMENTS = ['exposure', 'contrast', 'saturation', 'temperature'];
const FILE_STATES = ['draft', 'in-review', 'approved', 'archived'];
const ASSET_KINDS = ['image', 'color', 'text-style', 'component'];

const PROJECT_NAMES = ['Meridian Rebrand', 'Atlas Mobile', 'Harbour Editorial', 'Fieldnote Marketing'];
const FILE_NAMES = [
  'Cover', 'Hero', 'Pricing', 'Onboarding', 'Settings', 'Empty states',
  'Icon set', 'Type scale', 'Dark theme', 'Illustration', 'Nav patterns', 'Cards',
];
const COMPONENT_NAMES = ['Button', 'Field', 'Card', 'Avatar', 'Chip', 'Tab bar', 'Banner', 'Tooltip'];
const FRAME_NAMES = ['Desktop', 'Tablet', 'Mobile', 'Detail'];
const GROUP_NAMES = ['Header', 'Body', 'Footer', 'Aside', 'Toolbar'];
const SHAPE_NAMES = ['Backdrop', 'Panel', 'Divider', 'Accent', 'Badge', 'Marker', 'Swatch', 'Tile'];
const IMAGE_NAMES = ['Photo', 'Texture', 'Portrait', 'Cutout', 'Backdrop image'];
const TEXT_NAMES = ['Title', 'Subtitle', 'Body copy', 'Caption', 'Label', 'Eyebrow'];
const EDITORS = ['juno.ferreira', 'noor.abadi', 'petra.lind', 'sam.okafor'];

/* Tokens, not hexes — mirrors PALETTE in src/design/types.ts. See the note
   there on why a fill has to be one of a finite, known-at-build-time set. */
const PALETTE = ['p0', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9'];
const INK = 'ink';
const PAPER = 'paper';

/* Adjustments live on rungs of 20 so every value has a generated CSS rule. */
const ADJUSTMENT_VALUES = [-60, -40, -20, 20, 40, 60];
const ADJUSTMENT_STEP = 20;
const OPACITY_STEP = 5;

let layerSeq = 0;
const layerId = () => `ly-${String(++layerSeq).padStart(4, '0')}`;

/* ============================================================ 1. components */

const components = COMPONENT_NAMES.map((name, index) => ({
  id: `cp-${String(index + 1).padStart(2, '0')}`,
  name,
  descriptionKey: `design.component.about.${(index % COMPONENT_ABOUT) + 1}`,
  art: { src: artwork('square', ui(0, 359), 'facet'), altKey: `design.alt.component.${(index % 6) + 1}` },
  /* Filled in once the files exist — a count that disagrees with reality is the
     kind of thing a reader notices immediately. */
  instanceCount: 0,
}));

/* ================================================================= 2. layers */

/**
 * Build one file's document.
 *
 * The shape is deliberate rather than random: a frame, a couple of groups
 * inside it, leaves inside those, and a few top-level layers beside the frame.
 * Random nesting produces documents that are technically valid and completely
 * uninteresting to look at.
 */
function buildDocument(fileIndex) {
  const layers = [];
  const push = (layer) => {
    layers.push(layer);
    return layer;
  };

  const base = (kind, name, parentId, rect, order, extra = {}) => ({
    id: layerId(),
    parentId,
    kind,
    kindKey: `design.layerKind.${kind}`,
    name,
    rect,
    order,
    visible: true,
    locked: false,
    opacity: 100,
    blend: 'normal',
    blendKey: 'design.blend.normal',
    fill: null,
    adjustments: [],
    masked: false,
    art: null,
    textKey: null,
    componentId: null,
    ...extra,
  });

  /* --- the frame, which is most of the artboard --------------------------- */
  const frame = push(
    base('frame', FRAME_NAMES[fileIndex % FRAME_NAMES.length], null, { x: 2, y: 2, w: 30, h: 26 }, 0, {
      fill: INK,
    }),
  );

  /* --- two groups stacked inside it --------------------------------------- */
  const header = push(base('group', GROUP_NAMES[0], frame.id, { x: 4, y: 4, w: 26, h: 6 }, 0));
  const body = push(base('group', GROUP_NAMES[1], frame.id, { x: 4, y: 11, w: 26, h: 15 }, 1));

  /* --- header leaves: deliberately DISAGREEING, so MIXED is reachable ----- */
  push(
    base('rect', SHAPE_NAMES[0], header.id, { x: 4, y: 4, w: 12, h: 6 }, 0, {
      fill: PALETTE[0],
      opacity: 100,
      blend: 'normal',
      blendKey: 'design.blend.normal',
    }),
  );
  push(
    base('rect', SHAPE_NAMES[1], header.id, { x: 17, y: 4, w: 13, h: 6 }, 1, {
      fill: PALETTE[3],
      opacity: 70,
      blend: 'multiply',
      blendKey: 'design.blend.multiply',
    }),
  );

  /* --- body leaves: one of every remaining kind --------------------------- */
  push(
    base('text', TEXT_NAMES[fileIndex % TEXT_NAMES.length], body.id, { x: 5, y: 12, w: 16, h: 3 }, 0, {
      fill: PAPER,
      textKey: `design.text.${(fileIndex % TEXT_STRINGS) + 1}`,
    }),
  );

  const adjustmentCount = 1 + (fileIndex % ADJUSTMENTS.length);
  push(
    base('image', IMAGE_NAMES[fileIndex % IMAGE_NAMES.length], body.id, { x: 5, y: 16, w: 12, h: 9 }, 1, {
      art: { src: artwork('landscape', ui(0, 359), 'strata'), altKey: `design.alt.layer.${(fileIndex % 6) + 1}` },
      opacity: 60 + ui(0, 4) * 10,
      blend: BLEND_MODES[fileIndex % BLEND_MODES.length],
      blendKey: `design.blend.${BLEND_MODES[fileIndex % BLEND_MODES.length]}`,
      masked: chance(0.5),
      adjustments: ADJUSTMENTS.slice(0, adjustmentCount).map((kind) => ({
        kind,
        kindKey: `design.adjustment.${kind}`,
        /* Never zero: an adjustment at zero is invisible, and a reader opening
           the panel should see the control doing something. */
        value: pick(ADJUSTMENT_VALUES),
      })),
    }),
  );

  push(
    base('ellipse', SHAPE_NAMES[4], body.id, { x: 19, y: 17, w: 6, h: 6 }, 2, {
      fill: PALETTE[(fileIndex + 5) % PALETTE.length],
      opacity: 85,
    }),
  );

  /* --- an instance of a component, beside the frame ----------------------- */
  const componentIndex = fileIndex % components.length;
  push(
    base('instance', components[componentIndex].name, null, { x: 34, y: 3, w: 12, h: 5 }, 1, {
      componentId: components[componentIndex].id,
      fill: PALETTE[(fileIndex + 2) % PALETTE.length],
    }),
  );
  components[componentIndex].instanceCount += 1;

  /* --- a component definition living in the document ---------------------- */
  push(
    base('component', `${components[componentIndex].name} / base`, null, { x: 34, y: 10, w: 12, h: 5 }, 2, {
      componentId: components[componentIndex].id,
      fill: PALETTE[(fileIndex + 7) % PALETTE.length],
    }),
  );

  /* --- one hidden and one locked layer, so both states are reachable ------ */
  push(
    base('rect', SHAPE_NAMES[6], null, { x: 34, y: 17, w: 12, h: 5 }, 3, {
      fill: PALETTE[(fileIndex + 4) % PALETTE.length],
      visible: false,
    }),
  );
  push(
    base('rect', SHAPE_NAMES[7], null, { x: 34, y: 24, w: 12, h: 5 }, 4, {
      fill: PALETTE[(fileIndex + 6) % PALETTE.length],
      locked: true,
      blend: 'screen',
      blendKey: 'design.blend.screen',
    }),
  );

  return layers;
}

/* ================================================================== 3. files */

const files = FILE_NAMES.map((name, index) => ({
  id: `fl-${String(index + 1).padStart(2, '0')}`,
  projectId: `pr-${String((index % PROJECT_NAMES.length) + 1).padStart(2, '0')}`,
  name,
  state: FILE_STATES[index % FILE_STATES.length],
  stateKey: `design.fileState.${FILE_STATES[index % FILE_STATES.length]}`,
  art: { src: artwork('landscape', ui(0, 359), 'facet'), altKey: `design.alt.file.${(index % 6) + 1}` },
  layers: buildDocument(index),
  updatedAt: hoursBefore(2 + index * 7),
  editorHandles: EDITORS.slice(0, 1 + (index % 3)),
}));

/* =============================================================== 4. projects */

const projects = PROJECT_NAMES.map((name, index) => {
  const id = `pr-${String(index + 1).padStart(2, '0')}`;
  const mine = files.filter((f) => f.projectId === id);
  return {
    id,
    name,
    descriptionKey: `design.project.about.${(index % PROJECT_ABOUT) + 1}`,
    art: { src: artwork('wide', ui(0, 359), 'ridge'), altKey: `design.alt.project.${(index % 4) + 1}` },
    fileIds: mine.map((f) => f.id),
    updatedAt: mine.reduce((latest, f) => (f.updatedAt > latest ? f.updatedAt : latest), mine[0].updatedAt),
  };
});

/* ================================================================= 5. assets */

const ASSET_NAMES = {
  image: ['Coast plate', 'Grain overlay', 'Studio shot', 'Paper texture'],
  color: ['Ink', 'Sea', 'Clay', 'Moss', 'Ember'],
  'text-style': ['Display / 48', 'Title / 28', 'Body / 16', 'Caption / 13'],
  component: COMPONENT_NAMES.slice(0, 4),
};

const assets = ASSET_KINDS.flatMap((kind, kindIndex) =>
  ASSET_NAMES[kind].map((name, index) => ({
    id: `as-${kindIndex}${String(index + 1).padStart(2, '0')}`,
    kind,
    kindKey: `design.assetKind.${kind}`,
    name,
    color: kind === 'color' ? PALETTE[index % PALETTE.length] : null,
    art:
      kind === 'image' || kind === 'component'
        ? { src: artwork('square', ui(0, 359), 'bloom'), altKey: `design.alt.asset.${(index % 4) + 1}` }
        : null,
    usedByFileIds: files.filter(() => chance(0.35)).map((f) => f.id).slice(0, 5),
  })),
);

/* ================================================================= 6. viewer */

const viewer = {
  handle: VIEWER_HANDLE,
  displayName: 'Juno Ferreira',
  art: { src: artwork('square', 262, 'halo'), altKey: 'design.alt.viewer' },
};

const allLayers = files.flatMap((f) => f.layers);

const totals = {
  projects: projects.length,
  files: files.length,
  layers: allLayers.length,
  components: components.length,
  assets: assets.length,
  sharedFiles: files.filter((f) => f.editorHandles.length > 1).length,
  editedThisWeek: files.filter((f) => Date.parse(f.updatedAt) > REPORTING_MS - 7 * 86_400_000).length,
};

/* =========================================================== 7. invariants */

const problems = [];
const must = (condition, message) => {
  if (!condition) problems.push(message);
};

for (const file of files) {
  const byId = new Map(file.layers.map((l) => [l.id, l]));

  for (const layer of file.layers) {
    const r = layer.rect;
    must(
      r.x >= 0 && r.y >= 0 && r.w >= 1 && r.h >= 1 && r.x + r.w <= CANVAS_COLS && r.y + r.h <= CANVAS_ROWS,
      `${file.id}/${layer.name}: rect ${JSON.stringify(r)} leaves the ${CANVAS_COLS}x${CANVAS_ROWS} artboard`,
    );

    /* No child escapes its parent. Rects are absolute, so only this check
       stands between the fixture and a layer drawn outside its own frame. */
    if (layer.parentId) {
      const parent = byId.get(layer.parentId);
      must(parent !== undefined, `${file.id}/${layer.name}: parentId ${layer.parentId} does not exist`);
      if (parent) {
        const p = parent.rect;
        must(
          r.x >= p.x && r.y >= p.y && r.x + r.w <= p.x + p.w && r.y + r.h <= p.y + p.h,
          `${file.id}/${layer.name}: escapes its parent ${parent.name}`,
        );
        must(
          parent.kind === 'frame' || parent.kind === 'group',
          `${file.id}/${layer.name}: parent ${parent.name} is a ${parent.kind}, which cannot contain`,
        );
      }
    }

    /* The tree is a tree, and it is shallow enough for the panel's indent. */
    let depth = 0;
    let cursor = layer;
    const seen = new Set([layer.id]);
    while (cursor.parentId) {
      must(!seen.has(cursor.parentId), `${file.id}/${layer.name}: parent cycle`);
      if (seen.has(cursor.parentId)) break;
      seen.add(cursor.parentId);
      cursor = byId.get(cursor.parentId);
      if (!cursor) break;
      depth += 1;
    }
    must(depth < TREE_MAX_DEPTH, `${file.id}/${layer.name}: nests ${depth} deep, limit is ${TREE_MAX_DEPTH}`);

    if (layer.kind === 'instance' || layer.kind === 'component') {
      must(
        components.some((c) => c.id === layer.componentId),
        `${file.id}/${layer.name}: componentId ${layer.componentId} resolves to nothing`,
      );
    }
    if (layer.kind === 'text') must(layer.textKey !== null, `${file.id}/${layer.name}: text layer with no textKey`);
    if (layer.kind === 'image') must(layer.art !== null, `${file.id}/${layer.name}: image layer with no artwork`);
    must(layer.opacity >= 0 && layer.opacity <= 100, `${file.id}/${layer.name}: opacity out of range`);
    must(
      layer.opacity % OPACITY_STEP === 0,
      `${file.id}/${layer.name}: opacity ${layer.opacity} is off the ${OPACITY_STEP}-rung the stylesheet generates`,
    );
    must(
      layer.fill === null || PALETTE.includes(layer.fill) || layer.fill === INK || layer.fill === PAPER,
      `${file.id}/${layer.name}: fill "${layer.fill}" is not a palette token`,
    );
    for (const a of layer.adjustments) {
      must(a.value >= -100 && a.value <= 100, `${file.id}/${layer.name}: adjustment ${a.kind} out of range`);
      must(a.value !== 0, `${file.id}/${layer.name}: adjustment ${a.kind} is zero, which renders as nothing`);
      must(
        a.value % ADJUSTMENT_STEP === 0,
        `${file.id}/${layer.name}: adjustment ${a.kind} is ${a.value}, off the ${ADJUSTMENT_STEP}-rung the stylesheet generates`,
      );
    }
  }

  /* Sibling order is dense: 0..n-1, no gaps, no duplicates. */
  const parents = new Set(file.layers.map((l) => l.parentId));
  for (const parentId of parents) {
    const orders = file.layers.filter((l) => l.parentId === parentId).map((l) => l.order).sort((a, b) => a - b);
    must(
      orders.every((o, i) => o === i),
      `${file.id}: children of ${parentId ?? 'root'} are ordered ${orders.join(',')}, expected 0..${orders.length - 1}`,
    );
  }

  /* The inspector must have something to disagree about. */
  const header = file.layers.find((l) => l.kind === 'group');
  const headerKids = file.layers.filter((l) => l.parentId === header?.id);
  must(
    headerKids.length >= 2 && new Set(headerKids.map((l) => l.fill)).size > 1,
    `${file.id}: no sibling pair disagrees on fill, so MIXED is unreachable`,
  );
}

/* Every enum value is reachable somewhere. */
for (const kind of ['frame', 'group', 'rect', 'ellipse', 'text', 'image', 'component', 'instance']) {
  must(allLayers.some((l) => l.kind === kind), `no layer anywhere has kind "${kind}"`);
}
for (const blend of BLEND_MODES) {
  must(allLayers.some((l) => l.blend === blend), `no layer anywhere uses blend "${blend}"`);
}
for (const adj of ADJUSTMENTS) {
  must(allLayers.some((l) => l.adjustments.some((a) => a.kind === adj)), `no layer uses adjustment "${adj}"`);
}
for (const state of FILE_STATES) must(files.some((f) => f.state === state), `no file is "${state}"`);
for (const kind of ASSET_KINDS) must(assets.some((a) => a.kind === kind), `no asset is "${kind}"`);
must(allLayers.some((l) => !l.visible), 'no layer is hidden, so effectiveVisible is untested by the fixture');
must(allLayers.some((l) => l.locked), 'no layer is locked, so effectiveLocked is untested by the fixture');
must(allLayers.some((l) => l.masked), 'no image layer is masked');

/* Instance counts agree with reality. */
for (const component of components) {
  const actual = allLayers.filter((l) => l.kind === 'instance' && l.componentId === component.id).length;
  must(
    component.instanceCount === actual,
    `component ${component.name}: instanceCount ${component.instanceCount} but ${actual} instances exist`,
  );
}

/* Every project owns at least one file, and every file belongs to a project. */
for (const project of projects) must(project.fileIds.length > 0, `project ${project.name} has no files`);
for (const file of files) {
  must(projects.some((p) => p.id === file.projectId), `file ${file.name} points at a project that does not exist`);
}

if (problems.length) {
  console.error(`[generate:design] ${problems.length} invariant(s) violated:`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}

/* ================================================================= 8. write */

const file = `/**
 * GENERATED by scripts/generate-design-fixture.mjs — do not edit.
 *
 * Seed 0x${SEED.toString(16)}, reporting instant ${REPORTING_INSTANT}. Re-running the
 * generator reproduces this file exactly; editing it by hand makes the next run
 * silently discard your change.
 */

import type { DesignFixture } from './types';

export const FIXTURE: DesignFixture = {
  viewer: ${JSON.stringify(viewer)},
  totals: ${JSON.stringify(totals)},
  components: [
${rows(components)}
  ],
  projects: [
${rows(projects)}
  ],
  assets: [
${rows(assets)}
  ],
  files: [
${rows(files)}
  ],
};
`;

writeFileSync(OUT, file);

const bytes = Buffer.byteLength(file);
const art = [
  ...files.map((f) => f.art),
  ...projects.map((p) => p.art),
  ...components.map((c) => c.art),
  ...assets.map((a) => a.art).filter(Boolean),
  ...allLayers.map((l) => l.art).filter(Boolean),
  viewer.art,
];
const artBytes = art.reduce((sum, a) => sum + a.src.length, 0);

console.log(`[generate:design] ${OUT.split('/').slice(-3).join('/')}`);
console.log(
  `  projects=${projects.length} files=${files.length} layers=${allLayers.length} ` +
    `components=${components.length} assets=${assets.length}`,
);
console.log(
  `  canvas=${CANVAS_COLS}x${CANVAS_ROWS} depth<=${TREE_MAX_DEPTH} ` +
    `hidden=${allLayers.filter((l) => !l.visible).length} locked=${allLayers.filter((l) => l.locked).length} ` +
    `masked=${allLayers.filter((l) => l.masked).length}`,
);
console.log(
  `  blends=${new Set(allLayers.map((l) => l.blend)).size}/7 kinds=${new Set(allLayers.map((l) => l.kind)).size}/8 ` +
    `instances=${allLayers.filter((l) => l.kind === 'instance').length} viewer=${VIEWER_HANDLE}`,
);
console.log(
  `  ${Math.round(bytes / 1024)} kB total, of which ${Math.round(artBytes / 1024)} kB is ` +
    `artwork (${Math.round(artBytes / art.length)} B per image)`,
);
