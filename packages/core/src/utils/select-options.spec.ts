import {
  collectOptions,
  isRowSource,
  labelFor,
  normalizeInits,
  rowsToArray,
  type OptionRowSource,
  type SelectOptionInit,
} from './select-options';

/** Build a light-DOM `<md-select-option>` the way a consumer's template would. */
function option(attrs: Record<string, string>, text = ''): HTMLElement {
  const el = document.createElement('md-select-option');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (text) el.textContent = text;
  return el;
}

describe('select-options', () => {
  describe('isRowSource', () => {
    it('treats an array as a materialised set, not a factory', () => {
      expect(isRowSource([{ value: 'a' }])).toBe(false);
      expect(isRowSource([])).toBe(false);
    });

    it('identifies a row factory', () => {
      expect(isRowSource({ count: 0, getRow: () => ({ value: 'a' }) })).toBe(true);
    });
  });

  describe('rowsToArray', () => {
    it('copies an array rather than aliasing it', () => {
      const src: SelectOptionInit[] = [{ value: 'a' }, { value: 'b' }];
      const out = rowsToArray(src);
      expect(out).toEqual(src);
      expect(out).not.toBe(src);
      out.push({ value: 'c' });
      expect(src).toHaveLength(2);
    });

    it('materialises a row factory in index order', () => {
      const source: OptionRowSource = {
        count: 3,
        getRow: (i) => ({ value: `v${i}`, label: `L${i}` }),
      };
      expect(rowsToArray(source)).toEqual([
        { value: 'v0', label: 'L0' },
        { value: 'v1', label: 'L1' },
        { value: 'v2', label: 'L2' },
      ]);
    });

    it('handles an empty row factory', () => {
      expect(rowsToArray({ count: 0, getRow: () => ({ value: 'x' }) })).toEqual([]);
    });
  });

  describe('normalizeInits', () => {
    it('defaults the label to the value and coerces the flags', () => {
      expect(normalizeInits([{ value: 'us' }])).toEqual([
        {
          value: 'us',
          label: 'us',
          disabled: false,
          icon: undefined,
          iconColor: undefined,
          supportingText: undefined,
          selected: false,
        },
      ]);
    });

    it('carries every optional field through', () => {
      const [o] = normalizeInits([
        {
          value: 'a',
          label: 'Alpha',
          disabled: true,
          icon: 'star',
          iconColor: 'var(--md-sys-color-primary)',
          supportingText: 'first',
          selected: true,
        },
      ]);
      expect(o).toEqual({
        value: 'a',
        label: 'Alpha',
        disabled: true,
        icon: 'star',
        iconColor: 'var(--md-sys-color-primary)',
        supportingText: 'first',
        selected: true,
      });
    });
  });

  describe('collectOptions', () => {
    it('returns an empty list when there is neither slot nor prop', () => {
      expect(collectOptions(document.createElement('md-select'))).toEqual([]);
    });

    it('reads the options prop when nothing is slotted', () => {
      const host = document.createElement('md-select');
      expect(collectOptions(host, [{ value: 'a', label: 'A' }])).toEqual([
        expect.objectContaining({ value: 'a', label: 'A' }),
      ]);
    });

    it('reads slotted children from their attributes', () => {
      const host = document.createElement('md-select');
      host.appendChild(
        option({ value: 'a', icon: 'star', 'icon-color': 'red', 'supporting-text': 'hi' }, 'Alpha'),
      );
      expect(collectOptions(host)).toEqual([
        {
          value: 'a',
          label: 'Alpha',
          disabled: false,
          icon: 'star',
          iconColor: 'red',
          supportingText: 'hi',
          selected: false,
        },
      ]);
    });

    it('falls back to textContent for the label, trimmed', () => {
      const host = document.createElement('md-select');
      host.appendChild(option({ value: 'a' }, '\n  Alpha  \n'));
      expect(collectOptions(host)[0].label).toBe('Alpha');
    });

    it('reads boolean attributes with no value', () => {
      const host = document.createElement('md-select');
      host.appendChild(option({ value: 'a', disabled: '', selected: '' }, 'A'));
      expect(collectOptions(host)[0]).toEqual(
        expect.objectContaining({ disabled: true, selected: true }),
      );
    });

    it('prefers properties over attributes when both are set', () => {
      const host = document.createElement('md-select');
      const el = option({ value: 'attr', label: 'FromAttr' }, 'FromText');
      Object.assign(el, { value: 'prop', label: 'FromProp', disabled: true });
      host.appendChild(el);
      expect(collectOptions(host)[0]).toEqual(
        expect.objectContaining({ value: 'prop', label: 'FromProp', disabled: true }),
      );
    });

    it('lets slotted children win over the prop, with no silent duplication', () => {
      const host = document.createElement('md-select');
      host.appendChild(option({ value: 'slotted' }, 'Slotted'));
      const out = collectOptions(host, [{ value: 'prop', label: 'Prop' }]);
      expect(out).toHaveLength(1);
      expect(out[0].value).toBe('slotted');
    });

    it('ignores non-option children and does not descend into them', () => {
      const host = document.createElement('md-select');
      const wrapper = document.createElement('div');
      wrapper.appendChild(option({ value: 'nested' }, 'Nested'));
      host.appendChild(wrapper);
      host.appendChild(document.createElement('span'));
      // Only DIRECT md-select-option children count, so this reads as "none
      // slotted" and the prop is used.
      expect(collectOptions(host, [{ value: 'p' }])).toEqual([
        expect.objectContaining({ value: 'p' }),
      ]);
    });

    it('supplies an empty value when an option declares none', () => {
      const host = document.createElement('md-select');
      host.appendChild(option({}, 'No value'));
      expect(collectOptions(host)[0].value).toBe('');
    });

    it('leaves absent optional fields undefined rather than empty strings', () => {
      const host = document.createElement('md-select');
      host.appendChild(option({ value: 'a' }, 'A'));
      const [o] = collectOptions(host);
      expect(o.icon).toBeUndefined();
      expect(o.iconColor).toBeUndefined();
      expect(o.supportingText).toBeUndefined();
    });
  });

  describe('labelFor', () => {
    const opts = normalizeInits([
      { value: 'a', label: 'Alpha' },
      { value: 'b', label: 'Beta' },
    ]);

    it('finds the matching label', () => {
      expect(labelFor(opts, 'b')).toBe('Beta');
    });

    it('returns an empty string for an unknown value', () => {
      expect(labelFor(opts, 'zz')).toBe('');
    });

    it('returns an empty string against an empty option set', () => {
      expect(labelFor([], 'a')).toBe('');
    });

    it('does not match loosely across types', () => {
      const numeric = normalizeInits([{ value: '1', label: 'One' }]);
      expect(labelFor(numeric, '1')).toBe('One');
      expect(labelFor(numeric, '01')).toBe('');
    });
  });
});
