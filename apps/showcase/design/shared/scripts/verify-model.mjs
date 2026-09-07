#!/usr/bin/env node
/**
 * Shared contracts for all five native Pictor ports.
 * Run from the workspace with `node apps/showcase/design/shared/scripts/verify-model.mjs`.
 * The actual TypeScript engine is bundled to an isolated temporary directory;
 * source files, browser storage, and application builds are never modified.
 */
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const scratch = await mkdtemp(join(tmpdir(), 'pictor-model-'));
let engine;
try {
  const bundle = await build({
    stdin: {
      contents: `export * from './src/index.ts'; export { defaultFile, getFiles } from '@awc-ui/showcase-kit/design';`,
      resolveDir: packageRoot,
      sourcefile: 'pictor-model-contract-entry.ts',
      loader: 'ts',
    },
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'node',
    target: 'node22',
    logLevel: 'silent',
  });
  const entry = join(scratch, 'engine.mjs');
  await writeFile(entry, bundle.outputFiles[0].text);
  engine = await import(pathToFileURL(entry).href);
} finally {
  await rm(scratch, { recursive: true, force: true });
}

const {
  createDocumentStore, createLayer, documentSvg, componentMarkup,
  STORAGE_KEY, parseWorkspaceCache, defaultFile, getFiles,
} = engine;
const firstFileId = defaultFile().id;
const secondFileId = getFiles().find(file => file.id !== firstFileId)?.id;
assert(secondFileId, 'The shared fixture needs two files to exercise switching');

/** Only the external browser Storage boundary is replaced. */
class MemoryStorage {
  values = new Map();
  writes = 0;
  rejectWrites = false;

  constructor(raw = null) {
    if (raw !== null) this.values.set(STORAGE_KEY, raw);
  }

  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) {
    if (this.rejectWrites) throw new Error('Storage quota exceeded');
    this.writes++;
    this.values.set(String(key), String(value));
  }
  removeItem(key) { this.values.delete(key); }
}

function workspace(context, raw = null) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const storage = new MemoryStorage(raw);
  const stores = [];
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  const open = () => {
    const store = createDocumentStore();
    stores.push(store);
    return store;
  };
  context.after(() => {
    for (const store of stores) store.dispose();
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else delete globalThis.localStorage;
  });
  return { storage, open, store: open() };
}

const layer = (id, rect, patch = {}) => createLayer('rect', rect, { id, name: id, ...patch });
const current = store => store.getSnapshot();
const storedDocument = snapshot => {
  const { fileId, layers, selection, history, tool, zoomIndex, showGrid } = snapshot;
  return { fileId, layers, selection, history, tool, zoomIndex, showGrid };
};

/** A literal v1 document predating curated seeds; never produced by the code under test. */
function legacyWorkspace() {
  const before = {
    id: 'legacy-user-text', parentId: null, kind: 'text', kindKey: 'design.layerKind.text',
    name: 'My saved copy & ideas', rect: { x: 1, y: 3, w: 16, h: 4 }, order: 0,
    visible: true, locked: false, opacity: 90, blend: 'normal', blendKey: 'design.blend.normal',
    fill: '#345678', adjustments: [], masked: false, art: null, textKey: null, componentId: null,
  };
  const after = { ...before, rect: { ...before.rect, x: 2 } };
  return {
    version: 1,
    activeFileId: firstFileId,
    savedAt: 1788652800000,
    documents: {
      [firstFileId]: {
        fileId: firstFileId, layers: [after], selection: [after.id], tool: 'select',
        zoomIndex: 2, showGrid: true,
        history: {
          index: 1,
          entries: [{
            id: 'legacy-move', kind: 'move', kindKey: 'design.edit.move', labelKey: 'design.edit.move',
            at: '2026-09-06T00:00:00.000Z', layerIds: [after.id], before: [before], after: [after],
          }],
        },
      },
    },
  };
}

await test('Pictor shared document contracts', { concurrency: false }, async suite => {
  await suite.test('snapshots are stable until change and subscribers receive the current snapshot', t => {
    const { store } = workspace(t);
    const initial = current(store);
    assert.strictEqual(current(store), initial);
    let firstCalls = 0;
    let secondCalls = 0;
    let received;
    const offFirst = store.subscribe(() => { firstCalls++; received = current(store); });
    const offSecond = store.subscribe(() => secondCalls++);
    assert.equal(firstCalls, 0, 'Reading/subscribing must not manufacture an edit');

    initial.setTool('ellipse');
    assert.equal(firstCalls, 1);
    assert.equal(secondCalls, 1);
    assert.strictEqual(current(store), received);
    assert.notStrictEqual(received, initial);
    assert.equal(initial.tool, 'select', 'An existing snapshot must retain its previous state');
    assert.equal(received.tool, 'ellipse');
    assert.strictEqual(current(store), received);

    received.commitLayers('move', layers => layers);
    assert.strictEqual(current(store), received, 'A no-op transaction must keep snapshot identity');
    assert.equal(firstCalls, 1);
    offFirst();
    current(store).setTool('text');
    assert.equal(firstCalls, 1, 'Removed listeners must stop receiving updates');
    assert.equal(secondCalls, 2);
    offSecond();
  });

  await suite.test('an untouched subscribed workspace autosaves its initial document', { timeout: 3000 }, async t => {
    const { store, storage } = workspace(t);
    assert.equal(storage.writes, 0);
    assert.equal(current(store).saveStatus, 'unsaved');
    await new Promise((resolveSaved, reject) => {
      const timeout = setTimeout(() => { unsubscribe(); reject(new Error('Initial autosave never completed')); }, 2000);
      const unsubscribe = store.subscribe(() => {
        if (current(store).saveStatus !== 'saved') return;
        clearTimeout(timeout);
        unsubscribe();
        resolveSaved();
      });
    });
    assert.equal(storage.writes, 1);
    assert.equal(current(store).history.index, 0, 'Saving must not add undo history');
    const saved = parseWorkspaceCache(storage.getItem(STORAGE_KEY));
    assert(saved, 'Initial autosave must produce a loadable versioned cache');
    assert.equal(saved.activeFileId, firstFileId);
    assert.deepEqual(saved.documents[firstFileId].layers, current(store).layers);
    assert.equal(current(store).lastSavedAt, saved.savedAt);
  });

  await suite.test('a legacy v1 saved document and its undo history survive save and reopen', t => {
    const legacy = legacyWorkspace();
    const { store, storage, open } = workspace(t, JSON.stringify(legacy));
    assert.equal(storage.writes, 0, 'Loading must preserve existing storage');
    assert.deepEqual(storedDocument(current(store)), legacy.documents[firstFileId]);
    assert.equal(current(store).saveStatus, 'saved');
    current(store).undo();
    assert.equal(current(store).layers[0].rect.x, 1);
    current(store).redo();
    assert.equal(current(store).layers[0].rect.x, 2);
    assert.equal(current(store).save(), true);
    store.dispose();

    const reopened = open();
    assert.deepEqual(storedDocument(current(reopened)), legacy.documents[firstFileId]);
    assert.equal(current(reopened).layers[0].name, 'My saved copy & ideas');
    assert(!current(reopened).layers.some(item => item.id.startsWith('seed-')), 'New defaults must never replace saved user layers');
  });

  await suite.test('file switching preserves each canvas, selection, and undo/redo branch', t => {
    const { store, open } = workspace(t);
    current(store).replaceCanvas([layer('first-design', { x: 2, y: 3, w: 6, h: 4 })]);
    current(store).select(['first-design']);
    current(store).restyle({ name: 'First file edit', fill: '#F2AAA7' });
    current(store).moveBy('first-design', 3, 2);
    current(store).undo(); // Persist both the current canvas and an available redo.
    const first = storedDocument(current(store));

    current(store).openFile(secondFileId);
    current(store).replaceCanvas([layer('second-design', { x: 12, y: 8, w: 5, h: 7 })]);
    current(store).select(['second-design']);
    current(store).restyle({ opacity: 65 });
    const second = storedDocument(current(store));
    current(store).openFile(firstFileId);
    assert.deepEqual(storedDocument(current(store)), first);
    current(store).redo();
    assert.deepEqual(current(store).layers[0].rect, { x: 5, y: 5, w: 6, h: 4 });
    current(store).undo();
    current(store).save();
    store.dispose();

    const reopened = open();
    assert.deepEqual(storedDocument(current(reopened)), first);
    current(reopened).openFile(secondFileId);
    assert.deepEqual(storedDocument(current(reopened)), second);
  });

  await suite.test('a batch transaction is one edit, reversible as a whole, and replaces the redo branch', t => {
    const { store } = workspace(t);
    const initial = [layer('one', { x: 2, y: 2, w: 4, h: 4 }), layer('two', { x: 10, y: 8, w: 6, h: 5 })];
    current(store).replaceCanvas(initial);
    const before = current(store).history.index;
    current(store).commitLayers('move', layers => layers.map(item => ({ ...item, rect: { ...item.rect, x: item.rect.x + 2 } })), ['one', 'two']);
    assert.equal(current(store).history.index, before + 1);
    assert.deepEqual(current(store).layers.map(item => item.rect.x), [4, 12]);
    const moved = current(store).layers;
    current(store).undo();
    assert.deepEqual(current(store).layers, initial);
    current(store).redo();
    assert.deepEqual(current(store).layers, moved);
    current(store).undo();
    current(store).restyle({ fill: '#F2AAA7' });
    assert.equal(current(store).history.entries.length, current(store).history.index);
    const styled = current(store).layers;
    current(store).redo();
    assert.deepEqual(current(store).layers, styled, 'A new edit after undo must discard the previous future');
  });

  await suite.test('grouping and duplication preserve nested descendants without changing the original tree', t => {
    const { store } = workspace(t);
    current(store).replaceCanvas([
      layer('left', { x: 2, y: 2, w: 3, h: 3 }),
      layer('right', { x: 8, y: 3, w: 4, h: 3 }),
      layer('outside', { x: 16, y: 6, w: 3, h: 3 }),
    ]);
    current(store).select(['left', 'right']);
    current(store).group();
    const innerId = current(store).layers.find(item => item.kind === 'group').id;
    assert(current(store).layers.filter(item => ['left', 'right'].includes(item.id)).every(item => item.parentId === innerId));
    current(store).select([innerId, 'outside']);
    current(store).group();
    const outerId = current(store).layers.find(item => item.kind === 'group' && item.parentId === null).id;
    current(store).select([outerId]);
    const original = structuredClone(current(store).layers);
    const before = current(store).history.index;
    current(store).duplicate();
    const all = current(store).layers;
    assert.equal(all.length, original.length * 2);
    assert.equal(new Set(all.map(item => item.id)).size, all.length);
    assert.equal(current(store).history.index, before + 1);
    assert.deepEqual(all.filter(item => original.some(old => old.id === item.id)), original);

    const copyRootId = current(store).selection[0];
    assert.notEqual(copyRootId, outerId);
    const copied = all.filter(item => !original.some(old => old.id === item.id));
    const copyRoot = copied.find(item => item.id === copyRootId);
    assert.equal(copyRoot.kind, 'group');
    assert.equal(copyRoot.parentId, null);
    for (const item of copied) {
      if (item.id !== copyRootId) assert(copied.some(parent => parent.id === item.parentId), 'Copied descendants must refer to copied parents');
      const old = item.id === copyRootId ? original.find(old => old.id === outerId)
        : item.kind === 'group' ? original.find(old => old.id === innerId)
          : original.find(old => old.name === item.name);
      assert(old);
      assert.deepEqual(item.rect, { ...old.rect, x: old.rect.x + 2, y: old.rect.y + 2 });
    }
    current(store).undo();
    assert.deepEqual(current(store).layers, original);
    current(store).redo();
    assert.deepEqual(current(store).layers, all);
  });

  await suite.test('preview reads use live or cached layers without switching, saving, or notifying', t => {
    const { store, storage } = workspace(t, JSON.stringify(legacyWorkspace()));
    let notifications = 0;
    store.subscribe(() => notifications++);
    const before = current(store);
    const raw = storage.getItem(STORAGE_KEY);
    assert.strictEqual(before.layersForFile(firstFileId), before.layers);
    const otherPreview = before.layersForFile(secondFileId);
    assert(otherPreview.length > 0);
    assert.strictEqual(before.layersForFile(secondFileId), otherPreview, 'Unedited previews should be stable');
    assert.deepEqual(before.layersForFile('missing-file'), []);
    assert.strictEqual(current(store), before);
    assert.equal(notifications, 0);
    assert.equal(storage.writes, 0);
    assert.equal(storage.getItem(STORAGE_KEY), raw);

    current(store).openFile(secondFileId);
    assert.strictEqual(current(store).layers, otherPreview, 'Opening an untouched file must use the content shown in its preview');
    current(store).replaceCanvas([layer('preview-edit', { x: 4, y: 4, w: 5, h: 5 })]);
    const changed = current(store).layers;
    current(store).openFile(firstFileId);
    const readsBefore = notifications;
    const writesBefore = storage.writes;
    assert.strictEqual(current(store).layersForFile(secondFileId), changed);
    assert.equal(current(store).fileId, firstFileId);
    assert.equal(notifications, readsBefore);
    assert.equal(storage.writes, writesBefore);
  });

  await suite.test('invalid caches fall back to usable seeds, including poisoned redo trees', async t => {
    const malformed = [
      ['invalid JSON', '{'],
      ['unknown schema', JSON.stringify({ ...legacyWorkspace(), version: 99 })],
      ['unknown active file', JSON.stringify({ ...legacyWorkspace(), activeFileId: 'missing-file' })],
      ['out-of-bounds layer', (() => { const value = legacyWorkspace(); value.documents[firstFileId].layers[0].rect.x = 99; return JSON.stringify(value); })()],
      ['dangling parent', (() => { const value = legacyWorkspace(); value.documents[firstFileId].layers[0].parentId = 'missing-parent'; return JSON.stringify(value); })()],
      ['poisoned redo', (() => {
        const value = legacyWorkspace();
        const document = value.documents[firstFileId];
        document.history.index = 0;
        document.layers = structuredClone(document.history.entries[0].before);
        document.history.entries[0].after[0].parentId = 'missing-parent';
        return JSON.stringify(value);
      })()],
    ];
    for (const [name, raw] of malformed) await t.test(name, child => {
      const { store, storage } = workspace(child, raw);
      assert.equal(parseWorkspaceCache(raw), null);
      assert.equal(current(store).fileId, firstFileId);
      assert(current(store).layers.length > 0);
      assert(current(store).layers.every(item => item.id.startsWith('seed-')));
      assert.equal(current(store).history.index, 0);
      assert.equal(storage.getItem(STORAGE_KEY), raw, 'Reading invalid data must not itself write storage');
    });
  });

  await suite.test('invalid or locked batch changes are rejected atomically', t => {
    const { store } = workspace(t);
    current(store).replaceCanvas([
      layer('locked', { x: 2, y: 2, w: 4, h: 4 }, { locked: true }),
      layer('editable', { x: 9, y: 4, w: 5, h: 5 }),
    ]);
    const before = current(store);
    before.commitLayers('move', layers => layers.map(item => ({ ...item, rect: { ...item.rect, x: item.rect.x + 1 } })));
    assert.strictEqual(current(store), before, 'A protected layer makes the whole batch invalid');
    before.commitLayers('create', layers => [...layers, layer('dangling', { x: 1, y: 1, w: 2, h: 2 }, { parentId: 'absent' })]);
    assert.strictEqual(current(store), before);
    before.toggleLocked('locked');
    assert.equal(current(store).layers.find(item => item.id === 'locked').locked, false, 'An explicit unlock must still work');
  });

  await suite.test('storage failure is reported without losing the open document', t => {
    const { store, storage } = workspace(t);
    current(store).replaceCanvas([layer('keep-me', { x: 1, y: 1, w: 8, h: 8 })]);
    const layers = current(store).layers;
    storage.rejectWrites = true;
    assert.equal(current(store).save(), false);
    assert.equal(current(store).saveStatus, 'unavailable');
    assert.strictEqual(current(store).layers, layers);
    storage.rejectWrites = false;
    assert.equal(current(store).save(), true);
    assert.equal(current(store).saveStatus, 'saved');
  });

  await suite.test('SVG export preserves dimensions, visibility, and XML-escaped user content', () => {
    const userText = `A & B <script> "quote" 'apostrophe' →`;
    const text = layer('text"<&', { x: 2, y: 3, w: 30, h: 4 }, { kind: 'text', name: userText });
    const hidden = layer('hidden-group', { x: 1, y: 1, w: 8, h: 8 }, { kind: 'group', visible: false });
    const child = layer('hidden-child', { x: 2, y: 2, w: 3, h: 3 }, { parentId: hidden.id });
    const control = layer('live-control', { x: 10, y: 12, w: 15, h: 5 }, { kind: 'component', name: 'Go & explore', componentId: 'awc:button' });
    const svg = documentSvg([text, hidden, child, control], undefined, { background: true, scale: 2 });
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="1920" height="1280" viewBox="0 0 960 640">/);
    assert.match(svg, /<rect width="960" height="640" fill="#ffffff"\/>/);
    assert(svg.includes('data-layer="text&quot;&lt;&amp;"'));
    assert(svg.includes('A &amp; B &lt;script&gt; &quot;quote&quot; &apos;apostrophe&apos; →'));
    assert(!svg.includes('<script>'));
    assert(!svg.includes('hidden-group'));
    assert(!svg.includes('hidden-child'));
    assert(svg.includes('Go &amp; explore'));
    assert(!svg.includes('<md-button'), 'Static SVG export uses a vector representation of live controls');
    assert(svg.endsWith('</svg>'));
    assert.equal(componentMarkup({ ...control, name: userText }), `<md-button variant="filled" icon="arrow_forward">A &amp; B &lt;script&gt; &quot;quote&quot; &apos;apostrophe&apos; →</md-button>`);
  });
});
