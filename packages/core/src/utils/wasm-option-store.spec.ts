import { WasmOptionStore, utf8ByteLength, isWasmSupported } from './wasm-option-store';
import { SelectOptionInit } from './select-options';

describe('utf8ByteLength', () => {
  it('matches TextEncoder for ASCII, multibyte, and emoji', () => {
    const enc = new TextEncoder();
    for (const s of ['', 'apple', 'café', 'naïve', 'Grüße', '日本語', '👍🏽 ok', 'a👍b']) {
      expect(utf8ByteLength(s)).toBe(enc.encode(s).length);
    }
  });

  it('counts a lone surrogate as the 3-byte replacement char', () => {
    const lone = '\uD83D'; // lone high surrogate
    expect(utf8ByteLength(lone)).toBe(new TextEncoder().encode(lone).length);
  });
});

// The engine is real WASM; Node (and jsdom) provide WebAssembly + atob.
const describeWasm = isWasmSupported() ? describe : describe.skip;

describeWasm('WasmOptionStore', () => {
  const rows: SelectOptionInit[] = [
    { value: 'apple', label: 'Apple' },
    { value: 'banana', label: 'Banana', disabled: true },
    { value: 'cherry', label: 'Cherry' },
    { value: 'grape', label: 'Grapefruit' },
    { value: 'jp', label: '日本語' },
  ];

  async function loaded(): Promise<WasmOptionStore> {
    const store = new WasmOptionStore();
    await store.load(rows);
    return store;
  }

  it('loads rows and reports totals', async () => {
    const store = await loaded();
    expect(store.total).toBe(5);
    expect(store.length).toBe(5);
  });

  it('decodes a window round-trip including multibyte labels', async () => {
    const store = await loaded();
    const win = store.getWindow(0, 5);
    expect(win.map((r) => r.label)).toEqual(['Apple', 'Banana', 'Cherry', 'Grapefruit', '日本語']);
    expect(win.map((r) => r.value)).toEqual(['apple', 'banana', 'cherry', 'grape', 'jp']);
    expect(win[1].disabled).toBe(true);
    expect(win[0].disabled).toBe(false);
    expect(win[0].index).toBe(0);
  });

  it('filters by case-insensitive substring', async () => {
    const store = await loaded();
    expect(store.setQuery('an')).toBe(1); // Banana
    expect(store.getRow(0)?.value).toBe('banana');
    expect(store.setQuery('A')).toBe(3); // Apple, Banana, Grapefruit contain 'a'
    expect(store.setQuery('')).toBe(5); // reset
  });

  it('filters by prefix', async () => {
    const store = await loaded();
    store.setFilterMode('prefix');
    expect(store.setQuery('gr')).toBe(1);
    expect(store.getRow(0)?.label).toBe('Grapefruit');
  });

  it('resolves labels for values regardless of the active filter', async () => {
    const store = await loaded();
    store.setQuery('zzz'); // filter to nothing
    expect(store.length).toBe(0);
    const labels = store.getLabels(['cherry', 'jp', 'missing']);
    expect(labels.get('cherry')).toBe('Cherry');
    expect(labels.get('jp')).toBe('日本語');
    expect(labels.has('missing')).toBe(false);
  });

  it('supports typeahead prefix search over the filtered list', async () => {
    const store = await loaded();
    expect(store.setQuery('')).toBe(5);
    expect(store.findLabelPrefix('ch', 0)).toBe(2); // Cherry at filtered index 2
    expect(store.findLabelPrefix('zz', 0)).toBe(-1);
  });

  it('survives memory.grow when loading a large dataset', async () => {
    const store = new WasmOptionStore();
    const big: SelectOptionInit[] = [];
    for (let i = 0; i < 50000; i++) big.push({ value: `v${i}`, label: `Option ${i}` });
    await store.load(big);
    expect(store.total).toBe(50000);
    // Reads must still work after the allocation-driven growth.
    expect(store.getRow(0)?.label).toBe('Option 0');
    expect(store.setQuery('Option 49999')).toBe(1);
    expect(store.getRow(0)?.value).toBe('v49999');
    expect(store.getLabels(['v25000']).get('v25000')).toBe('Option 25000');
  });

  it('clears on reset', async () => {
    const store = await loaded();
    store.reset();
    expect(store.total).toBe(0);
    expect(store.length).toBe(0);
  });

  it('loads from a row factory without materialising the array', async () => {
    const store = new WasmOptionStore();
    await store.load({
      count: 1000,
      getRow: (i) => ({ value: `v${i}`, label: `Option ${i}` }),
    });
    expect(store.total).toBe(1000);
    expect(store.getRow(0)?.label).toBe('Option 0');
    expect(store.setQuery('Option 999')).toBe(1);
    expect(store.getRow(0)?.value).toBe('v999');
    expect(store.getLabels(['v500']).get('v500')).toBe('Option 500');
  });

  it('packs and decodes optional icon + supporting-text columns', async () => {
    const store = new WasmOptionStore();
    await store.load([
      { value: 'a', label: 'Apple', icon: 'star', supportingText: 'A fruit' },
      { value: 'b', label: 'Banana', icon: 'bolt' }, // no supporting text
      { value: 'c', label: 'Cherry', supportingText: 'Red' }, // no icon
      { value: 'd', label: 'Date' }, // neither
    ]);
    const win = store.getWindow(0, 4);
    expect(win.map((r) => r.icon)).toEqual(['star', 'bolt', '', '']);
    expect(win.map((r) => r.supportingText)).toEqual(['A fruit', '', 'Red', '']);
    // The label/value/disabled columns stay correct alongside the new ones.
    expect(win.map((r) => r.label)).toEqual(['Apple', 'Banana', 'Cherry', 'Date']);
    expect(win.map((r) => r.value)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('decodes empty icon/support when the dataset uses neither column', async () => {
    const store = new WasmOptionStore();
    await store.load([{ value: 'x', label: 'X' }]);
    const r = store.getRow(0)!;
    expect(r.icon).toBe('');
    expect(r.supportingText).toBe('');
  });

  it('keeps icon/support aligned to the row after filtering, incl. multibyte', async () => {
    const store = new WasmOptionStore();
    await store.load([
      { value: 'a', label: 'Apple', icon: 'star', supportingText: '甘い' },
      { value: 'b', label: 'Banana', icon: '★', supportingText: 'yellow' },
    ]);
    expect(store.setQuery('ban')).toBe(1);
    const r = store.getRow(0)!;
    expect(r.value).toBe('b');
    expect(r.icon).toBe('★');
    expect(r.supportingText).toBe('yellow');
  });

  it('incremental narrowing matches a from-scratch query', async () => {
    const store = await loaded();
    // Type forward — the second query narrows over the first's result set.
    expect(store.setQuery('a')).toBe(3); // Apple, Banana, Grapefruit
    expect(store.setQuery('an')).toBe(1); // Banana
    const fresh = await loaded();
    expect(fresh.setQuery('an')).toBe(1); // identical via a full scan
    expect(store.getRow(0)?.value).toBe(fresh.getRow(0)?.value);
    // Deleting a character widens the query → clean re-scan.
    expect(store.setQuery('a')).toBe(3);
    // Switching to a non-extending query also re-scans correctly.
    expect(store.setQuery('rr')).toBe(1); // Cherry
  });
});
