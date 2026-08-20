import { datumX, datumY, isPointDatum, normalizeSeriesX, remapIndexRecord } from './xy';
import type { MdChartDatum } from './types';

describe('chart xy normalisation', () => {
  describe('datum accessors', () => {
    it('reads y from every datum shape', () => {
      expect(datumY(3)).toBe(3);
      expect(datumY(null)).toBeNull();
      expect(datumY({ x: '2024-01-01', y: 7 })).toBe(7);
      expect(datumY(['2024-01-01', 7])).toBe(7);
      expect(datumY({ x: '2024-01-01', y: null })).toBeNull();
    });

    it('reads x only from point data', () => {
      expect(datumX(3)).toBeUndefined();
      expect(datumX(null)).toBeUndefined();
      expect(datumX({ x: '2024-01-01', y: 7 })).toBe('2024-01-01');
      expect(datumX(['2024-01-01', 7])).toBe('2024-01-01');
    });

    it('does not mistake a Date for a point', () => {
      expect(isPointDatum(new Date() as unknown as MdChartDatum)).toBe(false);
    });
  });

  describe('pass-through (no series carries its own x)', () => {
    it('hands the original arrays back without copying', () => {
      const a = [1, 2, 3];
      const axis = ['a', 'b', 'c'];
      const out = normalizeSeriesX([{ data: a }], axis, 'category');
      expect(out.hasPointX).toBe(false);
      expect(out.data[0]).toBe(a); // same reference — no allocation per render
      expect(out.xValues).toBe(axis);
      expect(out.toMerged[0]).toBeNull();
    });

    it('treats a series of all-null data as index-aligned, not as points', () => {
      const out = normalizeSeriesX([{ data: [null, null] }], ['a', 'b'], 'category');
      expect(out.hasPointX).toBe(false);
    });
  });

  describe('merging series that carry their own x', () => {
    it('merges two date ranges into one chronological axis', () => {
      const out = normalizeSeriesX(
        [
          { data: [{ x: '2024-01-01', y: 1 }, { x: '2024-03-01', y: 3 }] },
          { data: [{ x: '2024-02-01', y: 20 }, { x: '2024-03-01', y: 30 }] },
        ],
        undefined,
        'time',
      );
      expect(out.hasPointX).toBe(true);
      expect(out.xValues).toEqual(['2024-01-01', '2024-02-01', '2024-03-01']);
      // A slot a series wasn't measured at is a HOLE (undefined), not a null
      // gap — the line bridges it instead of breaking.
      expect(out.data[0]).toEqual([1, undefined, 3]);
      expect(out.data[1]).toEqual([undefined, 20, 30]);
    });

    it('keeps an authored null distinct from a hole', () => {
      const out = normalizeSeriesX(
        [
          { data: [{ x: 1, y: 1 }, { x: 2, y: null }, { x: 3, y: 3 }] },
          { data: [{ x: 1, y: 9 }] },
        ],
        undefined,
        'value',
      );
      expect(out.data[0]).toEqual([1, null, 3]); // measured, no value → gap
      expect(out.data[1]).toEqual([9, undefined, undefined]); // never measured → hole
    });

    it('sorts chronologically no matter the input order, and accepts tuples', () => {
      const out = normalizeSeriesX(
        [{ data: [['2024-03-01', 3] as const, ['2024-01-01', 1] as const] }],
        undefined,
        'time',
      );
      expect(out.xValues).toEqual(['2024-01-01', '2024-03-01']);
      expect(out.data[0]).toEqual([1, 3]);
    });

    it('lands an index-aligned series on the slots its axis values took', () => {
      const out = normalizeSeriesX(
        [
          { data: [{ x: '2024-02-01', y: 20 }] },
          { data: [1, 2] }, // aligned to xAxis.data below
        ],
        ['2024-01-01', '2024-03-01'],
        'time',
      );
      expect(out.xValues).toEqual(['2024-01-01', '2024-02-01', '2024-03-01']);
      expect(out.data[0]).toEqual([undefined, 20, undefined]);
      expect(out.data[1]).toEqual([1, undefined, 2]);
    });

    it('merges a category axis in first-seen order', () => {
      const out = normalizeSeriesX(
        [{ data: [{ x: 'Mon', y: 1 }, { x: 'Wed', y: 3 }] }, { data: [{ x: 'Tue', y: 2 }] }],
        undefined,
        'category',
      );
      expect(out.xValues).toEqual(['Mon', 'Wed', 'Tue']);
    });

    it('drops a bare value inside a point series (it has no x to sit at)', () => {
      const out = normalizeSeriesX(
        [{ data: [{ x: 1, y: 1 }, 5, { x: 2, y: 2 }] }],
        undefined,
        'value',
      );
      expect(out.xValues).toEqual([1, 2]);
      expect(out.data[0]).toEqual([1, 2]);
    });

    it('lets the last of a duplicated x win', () => {
      const out = normalizeSeriesX(
        [{ data: [{ x: 1, y: 1 }, { x: 1, y: 99 }] }],
        undefined,
        'value',
      );
      expect(out.xValues).toEqual([1]);
      expect(out.data[0]).toEqual([99]);
    });

    it('maps indices both ways so events and pointSymbols can be rebased', () => {
      const out = normalizeSeriesX(
        [
          { data: [{ x: '2024-01-01', y: 1 }, { x: '2024-03-01', y: 3 }] },
          { data: [{ x: '2024-02-01', y: 20 }] },
        ],
        undefined,
        'time',
      );
      expect(out.toMerged[0]).toEqual([0, 2]); // own index → merged index
      expect(out.toOwn[0]).toEqual([0, -1, 1]); // merged index → own index
      expect(out.toOwn[1]).toEqual([-1, 0, -1]);
    });
  });

  describe('remapIndexRecord', () => {
    it('rebases index-keyed options onto the merged axis', () => {
      expect(remapIndexRecord({ 0: '☀️', 1: '❄️' }, [0, 2])).toEqual({ 0: '☀️', 2: '❄️' });
    });

    it('drops entries with no merged slot and passes through index-aligned series', () => {
      expect(remapIndexRecord({ 0: 'a', 1: 'b' }, [-1, 3])).toEqual({ 3: 'b' });
      const rec = { 2: 'x' };
      expect(remapIndexRecord(rec, null)).toBe(rec);
    });
  });
});
