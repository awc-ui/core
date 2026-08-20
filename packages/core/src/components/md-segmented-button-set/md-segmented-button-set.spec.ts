import { newSpecPage } from '@stencil/core/testing';
import { MdSegmentedButtonSet } from './md-segmented-button-set';
import { MdSegmentedButton } from '../md-segmented-button/md-segmented-button';

describe('md-segmented-button-set', () => {
  let warnSpy: jest.SpyInstance;
  beforeEach(() => { warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {}); });
  afterEach(() => { warnSpy.mockRestore(); });

  // ── Rendering ─────────────────────────────────────────────
  it('renders with default props', async () => {
    const page = await newSpecPage({
      components: [MdSegmentedButtonSet, MdSegmentedButton],
      html: `
        <md-segmented-button-set>
          <md-segmented-button value="a" label="Day" selected></md-segmented-button>
          <md-segmented-button value="b" label="Week"></md-segmented-button>
          <md-segmented-button value="c" label="Month"></md-segmented-button>
        </md-segmented-button-set>
      `,
    });
    expect(page.root).toBeTruthy();
    expect(page.root?.classList.contains('md-segmented-button-set')).toBe(true);
  });

  it('has role="radiogroup" for single-select', async () => {
    const page = await newSpecPage({
      components: [MdSegmentedButtonSet, MdSegmentedButton],
      html: `
        <md-segmented-button-set>
          <md-segmented-button value="a" label="A"></md-segmented-button>
        </md-segmented-button-set>
      `,
    });
    expect(page.root?.getAttribute('role')).toBe('radiogroup');
  });

  it('has role="group" for multiselect', async () => {
    const page = await newSpecPage({
      components: [MdSegmentedButtonSet, MdSegmentedButton],
      html: `
        <md-segmented-button-set multiselect>
          <md-segmented-button value="a" label="A"></md-segmented-button>
        </md-segmented-button-set>
      `,
    });
    expect(page.root?.getAttribute('role')).toBe('group');
  });

  // ── Segment sync ──────────────────────────────────────────
  it('passes data-index and data-total to children', async () => {
    const page = await newSpecPage({
      components: [MdSegmentedButtonSet, MdSegmentedButton],
      html: `
        <md-segmented-button-set>
          <md-segmented-button value="a" label="A"></md-segmented-button>
          <md-segmented-button value="b" label="B"></md-segmented-button>
          <md-segmented-button value="c" label="C"></md-segmented-button>
        </md-segmented-button-set>
      `,
    });
    const segments = page.root?.querySelectorAll('md-segmented-button');
    expect((segments?.[0] as any).segmentIndex).toBe(0);
    expect((segments?.[0] as any).segmentTotal).toBe(3);
    expect((segments?.[2] as any).segmentIndex).toBe(2);
  });

  // ── Single-select behavior ────────────────────────────────
  it('selects clicked segment and deselects others in single mode', async () => {
    const page = await newSpecPage({
      components: [MdSegmentedButtonSet, MdSegmentedButton],
      html: `
        <md-segmented-button-set>
          <md-segmented-button value="a" label="A" selected></md-segmented-button>
          <md-segmented-button value="b" label="B"></md-segmented-button>
        </md-segmented-button-set>
      `,
    });

    const spy = jest.fn();
    page.root?.addEventListener('mdChange', spy);

    const segB = page.root?.querySelectorAll('md-segmented-button')[1];
    segB?.dispatchEvent(new CustomEvent('mdSegmentClick', {
      detail: { value: 'b', selected: true },
      bubbles: true,
    }));
    await page.waitForChanges();

    expect(spy).toHaveBeenCalled();
    const segments = page.root?.querySelectorAll('md-segmented-button');
    expect((segments?.[0] as any).selected).toBe(false);
    expect((segments?.[1] as any).selected).toBe(true);
  });

  // ── Multi-select behavior ─────────────────────────────────
  it('allows multiple selections in multiselect mode', async () => {
    const page = await newSpecPage({
      components: [MdSegmentedButtonSet, MdSegmentedButton],
      html: `
        <md-segmented-button-set multiselect>
          <md-segmented-button value="a" label="A" selected></md-segmented-button>
          <md-segmented-button value="b" label="B"></md-segmented-button>
        </md-segmented-button-set>
      `,
    });

    const spy = jest.fn();
    page.root?.addEventListener('mdChange', spy);

    const segB = page.root?.querySelectorAll('md-segmented-button')[1];
    segB?.dispatchEvent(new CustomEvent('mdSegmentClick', {
      detail: { value: 'b', selected: true },
      bubbles: true,
    }));
    await page.waitForChanges();

    expect(spy).toHaveBeenCalled();
    const segments = page.root?.querySelectorAll('md-segmented-button');
    expect((segments?.[0] as any).selected).toBe(true);
    expect((segments?.[1] as any).selected).toBe(true);
  });

  // ── Density ───────────────────────────────────────────────
  it('applies density class', async () => {
    const page = await newSpecPage({
      components: [MdSegmentedButtonSet],
      html: `<md-segmented-button-set density="-2"></md-segmented-button-set>`,
    });
    expect(page.root?.classList.contains('md-segmented-button-set--density-2')).toBe(true);
  });

  // ── WCAG 1.3.1 — Info and Relationships ──────────────────
  it('WCAG 1.3.1: preserves user-provided aria-label on the group', async () => {
    const page = await newSpecPage({
      components: [MdSegmentedButtonSet, MdSegmentedButton],
      html: `
        <md-segmented-button-set aria-label="View mode">
          <md-segmented-button value="a" label="Day"></md-segmented-button>
        </md-segmented-button-set>
      `,
    });
    expect(page.root?.getAttribute('aria-label')).toBe('View mode');
  });

  // ── WCAG 4.1.2 — Name, Role, Value ─────────────────────
  it('WCAG 4.1.2: role updates dynamically when multiselect changes', async () => {
    const page = await newSpecPage({
      components: [MdSegmentedButtonSet, MdSegmentedButton],
      html: `
        <md-segmented-button-set>
          <md-segmented-button value="a" label="A"></md-segmented-button>
        </md-segmented-button-set>
      `,
    });
    expect(page.root?.getAttribute('role')).toBe('radiogroup');

    (page.root as any).multiselect = true;
    await page.waitForChanges();
    expect(page.root?.getAttribute('role')).toBe('group');
  });

  it('WCAG 4.1.2: selected values emitted via mdChange for AT consumption', async () => {
    const page = await newSpecPage({
      components: [MdSegmentedButtonSet, MdSegmentedButton],
      html: `
        <md-segmented-button-set>
          <md-segmented-button value="a" label="A"></md-segmented-button>
          <md-segmented-button value="b" label="B"></md-segmented-button>
        </md-segmented-button-set>
      `,
    });
    const spy = jest.fn();
    page.root?.addEventListener('mdChange', spy);

    const segA = page.root?.querySelectorAll('md-segmented-button')[0];
    segA?.dispatchEvent(new CustomEvent('mdSegmentClick', {
      detail: { value: 'a', selected: true },
      bubbles: true,
    }));
    await page.waitForChanges();

    expect(spy).toHaveBeenCalled();
    expect(spy.mock.calls[0][0].detail).toEqual(['a']);
  });

  it('WCAG 2.1.1: child segments maintain proper tabindex delegation', async () => {
    const page = await newSpecPage({
      components: [MdSegmentedButtonSet, MdSegmentedButton],
      html: `
        <md-segmented-button-set>
          <md-segmented-button value="a" label="A"></md-segmented-button>
          <md-segmented-button value="b" label="B" disabled></md-segmented-button>
        </md-segmented-button-set>
      `,
    });
    const segments = page.root?.querySelectorAll('md-segmented-button');
    expect(segments?.[0]?.getAttribute('tabindex')).toBe('0');
    expect(segments?.[1]?.getAttribute('tabindex')).toBe('-1');
  });

  // ── Edge cases ───────────────────────────────────────────
  it('does not throw when mdSegmentClick has no matching target (null guard)', async () => {
    const page = await newSpecPage({
      components: [MdSegmentedButtonSet, MdSegmentedButton],
      html: `
        <md-segmented-button-set>
          <md-segmented-button value="a" label="A"></md-segmented-button>
        </md-segmented-button-set>
      `,
    });
    // Dispatch from the set itself (target = set, not a child segment)
    expect(() => {
      page.root?.dispatchEvent(new CustomEvent('mdSegmentClick', {
        detail: { value: 'a', selected: true },
        bubbles: false,
      }));
    }).not.toThrow();
  });

  // ── @Watch prop changes ─────────────────────────────────
  it('re-syncs segments when multiselect changes', async () => {
    const page = await newSpecPage({
      components: [MdSegmentedButtonSet, MdSegmentedButton],
      html: `
        <md-segmented-button-set>
          <md-segmented-button value="a" label="A"></md-segmented-button>
          <md-segmented-button value="b" label="B"></md-segmented-button>
        </md-segmented-button-set>
      `,
    });

    const segments = page.root?.querySelectorAll('md-segmented-button');
    expect((segments?.[0] as any).segmentMultiselect).toBe(false);

    (page.root as any).multiselect = true;
    await page.waitForChanges();

    expect((segments?.[0] as any).segmentMultiselect).toBe(true);
  });

  it('re-syncs segments when density changes', async () => {
    const page = await newSpecPage({
      components: [MdSegmentedButtonSet, MdSegmentedButton],
      html: `
        <md-segmented-button-set>
          <md-segmented-button value="a" label="A"></md-segmented-button>
        </md-segmented-button-set>
      `,
    });

    const seg = page.root?.querySelector('md-segmented-button');
    expect((seg as any).segmentDensity).toBe(0);

    (page.root as any).density = -2;
    await page.waitForChanges();

    expect((seg as any).segmentDensity).toBe(-2);
  });
});
