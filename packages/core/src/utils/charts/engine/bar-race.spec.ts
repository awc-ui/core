/*
 * Chart engine — bar-race reorder tween
 * =====================================
 * When data updates and bars change rank, each ENTITY (matched by category, not
 * by slot) slides between its old and new position rather than the chart
 * snapping. These pin the identity-matching + interpolation that drives that:
 *   - a bar keyed by its category survives a reorder (ATL: slot 0 → slot 1)
 *   - lerpBar tweens it from the old slot to the new one
 *   - matching by index would instead pair different entities (wrong)
 */
import { computeBarLayout, type BarChartSpec } from './bar-layout';
import type { EngineTheme } from './layout';
import { barKey, barsByKey, lerpBar, barsDiffer } from './bar-chart';

const theme: EngineTheme = {
  background: 'transparent',
  textColor: '#1C1B1F',
  textColorMuted: '#49454F',
  axisLineColor: '#79747E',
  gridLineColor: '#CAC4D0',
  surface: '#FFFBFE',
  fontFamily: 'Roboto',
  labelSize: 11,
  titleSize: 14,
};

const race = (categories: string[], data: number[]): BarChartSpec => ({
  series: [{ label: 'Passengers', color: '#6750A4', data, hidden: false }],
  categories,
  categoryFormatter: (v) => String(v),
  valueScale: 'value',
  valueFormatter: (v) => String(v),
  stack: 'none',
  horizontal: true,
  categoryGapRatio: 0.3,
  barGapRatio: 0.2,
  cornerRadius: 6,
  showLabels: true,
});

describe('bar-race reorder — entities slide between ranks', () => {
  // Step 1: ATL leads. Step 2: PEK overtakes, ATL drops to 2nd.
  const before = computeBarLayout(race(['ATL', 'PEK', 'ORD'], [98, 86, 74]), theme, 500, 300);
  const after = computeBarLayout(race(['PEK', 'ATL', 'ORD'], [92, 95, 74]), theme, 500, 300);

  it('detects the reorder as a change', () => {
    expect(barsDiffer(before, after)).toBe(true);
    // Same data, no reorder → no tween needed.
    expect(barsDiffer(before, computeBarLayout(race(['ATL', 'PEK', 'ORD'], [98, 86, 74]), theme, 500, 300))).toBe(false);
  });

  it('keys a bar by its CATEGORY, so ATL is the same bar across the reorder', () => {
    const fromMap = barsByKey(before);
    const toMap = barsByKey(after);
    const atlKey = '0::ATL';
    expect(fromMap.has(atlKey) && toMap.has(atlKey)).toBe(true);
    const atlBefore = fromMap.get(atlKey)!;
    const atlAfter = toMap.get(atlKey)!;
    // Horizontal chart → the category axis is Y. ATL moved from slot 0 to slot 1,
    // i.e. DOWN the plot: its y increased.
    expect(atlAfter.y).toBeGreaterThan(atlBefore.y + 10);
  });

  it('lerpBar slides the entity from its old slot to its new one', () => {
    const atlBefore = barsByKey(before).get('0::ATL')!;
    const atlAfter = barsByKey(after).get('0::ATL')!;
    const mid = lerpBar(atlBefore, atlAfter, 0.5);
    expect(mid.y).toBeCloseTo((atlBefore.y + atlAfter.y) / 2, 6);
    // Length (value axis = x/w) also tweens: 98 → 95.
    expect(mid.w).toBeCloseTo((atlBefore.w + atlAfter.w) / 2, 6);
    // lerpBar keeps the TARGET identity so labels/hit-testing resolve to the new datum.
    expect(mid.dataIndex).toBe(atlAfter.dataIndex);
  });

  it('matching by category (not index) pairs the right entities', () => {
    // Slot 0 is ATL before but PEK after — an index-based match would cross
    // entities. Category keys keep them distinct.
    expect(barKey(before, before.bars.find((b) => b.dataIndex === 0)!)).toBe('0::ATL');
    expect(barKey(after, after.bars.find((b) => b.dataIndex === 0)!)).toBe('0::PEK');
  });

  it('does not collapse DUPLICATE category values onto one key (rolling window)', () => {
    // Q1 appears twice (a rolling quarters window). With category keys the two
    // "Q1" bars collided onto one key and one drew on top of the other (flicker);
    // duplicates must fall back to slot identity so every bar keeps its own key.
    const s = computeBarLayout(race(['Q1', 'Q2', 'Q3', 'Q4', 'Q1'], [10, 20, 30, 40, 50]), theme, 500, 300);
    expect(barsByKey(s).size).toBe(s.bars.length);
  });

  it('does not collapse a SPLIT bar (value-axis break) onto one key', () => {
    // A value-axis break splits the outlier into pieces that all carry the same
    // (series, category) — same base key. Collapsed, the follow loop kept only
    // the last piece and the broken-axis bar lost its free end (stuck at the
    // break). Occurrence-aware keys must keep every piece.
    const s = computeBarLayout(
      { ...race(['a', 'b', 'c'], [10, 12, 5000]), valueBreaks: 'auto' } as BarChartSpec,
      theme,
      500,
      320,
    );
    const cat = s.bars.filter((b) => b.dataIndex === 2);
    expect(cat.length).toBeGreaterThan(1); // the outlier IS split
    expect(barsByKey(s).size).toBe(s.bars.length); // …and every piece survives keying
  });

  it('flags entering / leaving entities', () => {
    const dropped = computeBarLayout(race(['PEK', 'ORD', 'SFO'], [92, 74, 60]), theme, 500, 300);
    const fromKeys = new Set(barsByKey(before).keys());
    const toKeys = new Set(barsByKey(dropped).keys());
    expect([...fromKeys].filter((k) => !toKeys.has(k))).toContain('0::ATL'); // ATL left
    expect([...toKeys].filter((k) => !fromKeys.has(k))).toContain('0::SFO'); // SFO entered
  });
});
