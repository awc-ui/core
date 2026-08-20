import {
  renderBarLabels,
  renderEndLabels,
  renderGlyphs,
  syncOverlay,
  type OverlayCallbacks,
} from './overlay';
import type {
  BarLabel,
  EndLabel,
  GlyphMarker,
  LegendItem,
  RenderScene,
  SceneBar,
  TextItem,
} from './scene';

const layer = () => document.createElement('div');
const kids = (el: HTMLElement) => Array.from(el.children) as HTMLElement[];
/**
 * The overlay writes whole `cssText` strings, so assert on those rather than
 * parsed properties — but normalise the space mock-doc inserts after each
 * colon (`left: 10px;`) so the expectations read like the source.
 */
const css = (el: HTMLElement) => el.style.cssText.replace(/:\s+/g, ':');

const endLabel = (over: Partial<EndLabel> = {}): EndLabel => ({
  key: 'a',
  x: 100,
  y: 50,
  text: 'Series A',
  color: '#f00',
  size: 12,
  visible: true,
  ...over,
});

const glyph = (over: Partial<GlyphMarker> = {}): GlyphMarker => ({
  x: 10,
  y: 20,
  text: '★',
  size: 14,
  ...over,
});

const bar = (over: Partial<SceneBar> = {}): SceneBar => ({
  x: 10,
  y: 20,
  w: 30,
  h: 40,
  color: '#000',
  radius: [0, 0, 0, 0],
  seriesIndex: 0,
  dataIndex: 0,
  ...over,
});

const barLabel = (over: Partial<BarLabel> = {}): BarLabel => ({
  seriesIndex: 0,
  dataIndex: 0,
  text: '42',
  color: '#111',
  size: 11,
  ...over,
});

const text = (over: Partial<TextItem> = {}): TextItem => ({
  x: 5,
  y: 6,
  text: 'Title',
  color: '#222',
  fontSize: 13,
  align: 'center',
  baseline: 'middle',
  key: 't1',
  ...over,
});

const legendItem = (over: Partial<LegendItem> = {}): LegendItem => ({
  label: 'Series A',
  color: '#0f0',
  seriesIndex: 0,
  hidden: false,
  x: 0,
  y: 0,
  ...over,
});

const scene = (over: Partial<RenderScene> = {}): RenderScene =>
  ({
    width: 400,
    height: 300,
    plot: { x: 0, y: 0, w: 400, h: 300 },
    gridlines: [],
    axisLines: [],
    areas: [],
    bars: [],
    slices: [],
    lines: [],
    markers: [],
    texts: [],
    legend: [],
    ...over,
  }) as RenderScene;

describe('chart overlay', () => {
  describe('renderEndLabels', () => {
    it('creates one keyed element per label', () => {
      const l = layer();
      renderEndLabels(l, [endLabel({ key: 'a' }), endLabel({ key: 'b' })]);
      expect(kids(l)).toHaveLength(2);
      expect(kids(l).map((e) => e.dataset.k)).toEqual(['a', 'b']);
    });

    it('reuses the same element across frames so the fade can run', () => {
      const l = layer();
      renderEndLabels(l, [endLabel()]);
      const first = kids(l)[0];
      renderEndLabels(l, [endLabel({ x: 200 })]);
      // A recreated node would restart from opacity:0 and never transition.
      expect(kids(l)[0]).toBe(first);
      expect(kids(l)).toHaveLength(1);
    });

    it('hangs the label off the end of the line, mirrored for an end side', () => {
      const l = layer();
      renderEndLabels(l, [endLabel({ key: 'a', x: 100, side: 'end' })]);
      const el = kids(l)[0];
      expect(el.style.transform).toBe('translate(-100%,-50%)');
      expect(el.style.left).toBe('88px'); // 100 - 12, away from the data

      renderEndLabels(l, [endLabel({ key: 'a', x: 100, side: 'start' })]);
      expect(kids(l)[0].style.transform).toBe('translate(0,-50%)');
      expect(kids(l)[0].style.left).toBe('112px');
    });

    it('carries text, colour, size and the font family through', () => {
      const l = layer();
      renderEndLabels(l, [endLabel({ text: 'Revenue', color: '#abc', size: 15 })], 'Roboto');
      const el = kids(l)[0];
      expect(el.textContent).toBe('Revenue');
      expect(el.style.color).toBe('#abc');
      expect(el.style.fontSize).toBe('15px');
      expect(el.style.fontFamily).toBe('Roboto');
    });

    it('drives opacity from visibility so a colliding label fades out', () => {
      const l = layer();
      renderEndLabels(l, [endLabel({ visible: false })]);
      expect(kids(l)[0].style.opacity).toBe('0');
      renderEndLabels(l, [endLabel({ visible: true })]);
      expect(kids(l)[0].style.opacity).toBe('1');
    });

    it('fades a vanished series out before removing it', () => {
      jest.useFakeTimers();
      try {
        const l = layer();
        renderEndLabels(l, [endLabel({ key: 'a' }), endLabel({ key: 'b' })]);
        renderEndLabels(l, [endLabel({ key: 'a' })]);
        const gone = kids(l).find((e) => e.dataset.k === 'b')!;
        // Still present, but fading — removing it immediately would pop.
        expect(gone).toBeTruthy();
        expect(gone.style.opacity).toBe('0');
        expect(gone.dataset.gone).toBe('1');

        jest.advanceTimersByTime(300);
        expect(kids(l).map((e) => e.dataset.k)).toEqual(['a']);
      } finally {
        jest.useRealTimers();
      }
    });

    it('rescues a label that comes back before its removal fires', () => {
      jest.useFakeTimers();
      try {
        const l = layer();
        renderEndLabels(l, [endLabel({ key: 'a' }), endLabel({ key: 'b' })]);
        renderEndLabels(l, [endLabel({ key: 'a' })]); // b starts fading
        renderEndLabels(l, [endLabel({ key: 'a' }), endLabel({ key: 'b' })]); // b returns
        jest.advanceTimersByTime(300);
        // The pending timeout must not remove a label that is live again.
        expect(kids(l).map((e) => e.dataset.k).sort()).toEqual(['a', 'b']);
      } finally {
        jest.useRealTimers();
      }
    });

    it('tolerates being called with no labels', () => {
      const l = layer();
      expect(() => renderEndLabels(l)).not.toThrow();
      expect(kids(l)).toHaveLength(0);
    });
  });

  describe('renderGlyphs', () => {
    it('rebuilds the layer from scratch each frame', () => {
      const l = layer();
      renderGlyphs(l, [glyph(), glyph()]);
      expect(kids(l)).toHaveLength(2);
      renderGlyphs(l, [glyph()]);
      expect(kids(l)).toHaveLength(1);
    });

    it('centres a plain marker on its point', () => {
      const l = layer();
      renderGlyphs(l, [glyph({ x: 10, y: 20, size: 14, text: '★' })]);
      const el = kids(l)[0];
      expect(el.textContent).toBe('★');
      expect(css(el)).toContain('left:10px');
      expect(css(el)).toContain('top:20px');
      expect(css(el)).toContain('transform:translate(-50%,-50%)');
      expect(css(el)).toContain('font-size:14px');
    });

    it('offsets and styles a data label instead of centring it', () => {
      const l = layer();
      renderGlyphs(
        l,
        [
          glyph({
            x: 10,
            y: 20,
            size: 12,
            label: {
              color: '#333',
              weight: 600,
              dx: 4,
              dy: -6,
              anchorX: '-50%',
              anchorY: '-100%',
            },
          }),
        ],
        'Inter',
      );
      const el = kids(l)[0];
      expect(css(el)).toContain('left:14px'); // x + dx
      expect(css(el)).toContain('top:14px'); // y + dy
      expect(css(el)).toContain('transform:translate(-50%,-100%)');
      expect(css(el)).toContain('font:600 12px Inter');
      expect(css(el)).toContain('color:#333');
    });

    it('clears the layer when there are no glyphs', () => {
      const l = layer();
      renderGlyphs(l, [glyph()]);
      renderGlyphs(l);
      expect(kids(l)).toHaveLength(0);
    });
  });

  describe('renderBarLabels', () => {
    it('does nothing without labels', () => {
      const l = layer();
      renderBarLabels(l, scene());
      expect(kids(l)).toHaveLength(0);
    });

    it('skips a label whose bar is not in the scene (hidden series)', () => {
      const l = layer();
      renderBarLabels(
        l,
        scene({ bars: [], barLabels: [barLabel()] }),
      );
      expect(kids(l)).toHaveLength(0);
    });

    it('centres an inside label within the bar', () => {
      const l = layer();
      renderBarLabels(
        l,
        scene({
          bars: [bar({ x: 10, y: 20, w: 30, h: 40 })],
          barLabels: [barLabel({ inside: true })],
        }),
      );
      const el = kids(l)[0];
      expect(css(el)).toContain('left:25px'); // (10 + 40) / 2
      expect(css(el)).toContain('top:40px'); // (20 + 60) / 2
      expect(css(el)).toContain('transform:translate(-50%,-50%)');
    });

    it('hangs a vertical label above a positive bar', () => {
      const l = layer();
      renderBarLabels(
        l,
        scene({
          bars: [bar({ x: 10, y: 20, w: 30, h: 40 })],
          barLabels: [barLabel({ atLowEnd: false })],
        }),
      );
      const el = kids(l)[0];
      expect(css(el)).toContain('top:16px'); // loY - 4
      expect(css(el)).toContain('transform:translate(-50%,-100%)'); // bottom baseline
    });

    it('hangs a vertical label below a negative bar', () => {
      const l = layer();
      renderBarLabels(
        l,
        scene({
          bars: [bar({ x: 10, y: 20, w: 30, h: 40 })],
          barLabels: [barLabel({ atLowEnd: true })],
        }),
      );
      const el = kids(l)[0];
      expect(css(el)).toContain('top:64px'); // hiY + 4
      expect(css(el)).toContain('transform:translate(-50%,0)'); // top baseline
    });

    it('places a horizontal label past the bar’s free end', () => {
      const l = layer();
      renderBarLabels(
        l,
        scene({
          bars: [bar({ x: 10, y: 20, w: 30, h: 40, horizontal: true })],
          barLabels: [barLabel({ atLowEnd: false })],
        }),
      );
      expect(css(kids(l)[0])).toContain('left:44px'); // hiX + 4
      expect(css(kids(l)[0])).toContain('transform:translate(0,-50%)'); // start align
    });

    it('mirrors a horizontal label for a negative bar', () => {
      const l = layer();
      renderBarLabels(
        l,
        scene({
          bars: [bar({ x: 10, y: 20, w: 30, h: 40, horizontal: true })],
          barLabels: [barLabel({ atLowEnd: true })],
        }),
      );
      expect(css(kids(l)[0])).toContain('left:6px'); // loX - 4
      expect(css(kids(l)[0])).toContain('transform:translate(-100%,-50%)'); // end align
    });

    it('spans the union of a bar broken across a value-axis cut', () => {
      const l = layer();
      renderBarLabels(
        l,
        scene({
          // Same series/index, split into two pieces by a broken axis.
          bars: [
            bar({ x: 10, y: 60, w: 30, h: 20 }),
            bar({ x: 10, y: 20, w: 30, h: 20 }),
          ],
          barLabels: [barLabel({ atLowEnd: false })],
        }),
      );
      // Must hang off the OUTERMOST piece (y = 20), not whichever came first.
      expect(css(kids(l)[0])).toContain('top:16px');
    });

    it('applies text, colour and weight', () => {
      const l = layer();
      renderBarLabels(
        l,
        scene({
          bars: [bar()],
          barLabels: [barLabel({ text: '99', color: '#c0c', size: 10, fontWeight: 700 })],
        }),
        'Inter',
      );
      const el = kids(l)[0];
      expect(el.textContent).toBe('99');
      expect(css(el)).toContain('color:#c0c');
      expect(css(el)).toContain('font:700 10px Inter');
    });

    it('rebuilds each frame rather than accumulating', () => {
      const l = layer();
      const s = scene({ bars: [bar()], barLabels: [barLabel()] });
      renderBarLabels(l, s);
      renderBarLabels(l, s);
      expect(kids(l)).toHaveLength(1);
    });
  });

  describe('syncOverlay', () => {
    it('renders scene text with its key, position and rotation', () => {
      const l = layer();
      syncOverlay(l, scene({ texts: [text({ key: 'title', rotate: 90 })] }), 'Inter');
      const el = kids(l)[0];
      expect(el.textContent).toBe('Title');
      expect(el.dataset.key).toBe('title');
      expect(css(el)).toContain('left:5px');
      expect(css(el)).toContain('rotate(90deg)');
    });

    it('omits the rotation when there is none', () => {
      const l = layer();
      syncOverlay(l, scene({ texts: [text()] }), 'Inter');
      expect(css(kids(l)[0])).not.toContain('rotate');
    });

    it('hides a single-series legend, which would say nothing', () => {
      const l = layer();
      syncOverlay(l, scene({ legend: [legendItem()] }), 'Inter');
      expect(kids(l).some((e) => e.getAttribute('part') === 'legend')).toBe(false);
    });

    it('renders a chip per series once there is more than one', () => {
      const l = layer();
      syncOverlay(
        l,
        scene({ legend: [legendItem({ seriesIndex: 0 }), legendItem({ seriesIndex: 1, label: 'B' })] }),
        'Inter',
      );
      const nav = kids(l).find((e) => e.getAttribute('part') === 'legend')!;
      expect(nav).toBeTruthy();
      expect(kids(nav)).toHaveLength(2);
      expect(kids(nav)[1].title).toBe('B');
    });

    it('keeps the same nav and chip nodes across re-renders', () => {
      const l = layer();
      const s = scene({ legend: [legendItem({ seriesIndex: 0 }), legendItem({ seriesIndex: 1 })] });
      syncOverlay(l, s, 'Inter');
      const nav = kids(l).find((e) => e.getAttribute('part') === 'legend')!;
      const chip = kids(nav)[0];
      syncOverlay(l, s, 'Inter');
      const nav2 = kids(l).find((e) => e.getAttribute('part') === 'legend')!;
      // A recreated button would split mousedown/mouseup across two nodes and
      // the browser would never fire `click` on either.
      expect(nav2).toBe(nav);
      expect(kids(nav2)[0]).toBe(chip);
    });

    it('reports the CURRENT item when a chip is clicked, not a stale one', () => {
      const l = layer();
      const onLegendClick = jest.fn();
      const cb: OverlayCallbacks = { onLegendClick };
      syncOverlay(
        l,
        scene({ legend: [legendItem({ seriesIndex: 0, hidden: false }), legendItem({ seriesIndex: 1 })] }),
        'Inter',
        cb,
      );
      // Re-render with the series now hidden; the chip node is reused.
      syncOverlay(
        l,
        scene({ legend: [legendItem({ seriesIndex: 0, hidden: true }), legendItem({ seriesIndex: 1 })] }),
        'Inter',
        cb,
      );
      const nav = kids(l).find((e) => e.getAttribute('part') === 'legend')!;
      kids(nav)[0].click();
      expect(onLegendClick).toHaveBeenCalledTimes(1);
      expect(onLegendClick.mock.calls[0][0]).toEqual(
        expect.objectContaining({ seriesIndex: 0, hidden: true }),
      );
    });

    it('announces toggle state, so a screen reader says more than "button"', () => {
      const l = layer();
      syncOverlay(
        l,
        scene({ legend: [legendItem({ seriesIndex: 0, hidden: true }), legendItem({ seriesIndex: 1 })] }),
        'Inter',
      );
      const nav = kids(l).find((e) => e.getAttribute('part') === 'legend')!;
      expect(kids(nav)[0].getAttribute('aria-pressed')).toBe('false');
      expect(kids(nav)[1].getAttribute('aria-pressed')).toBe('true');
      expect(css(kids(nav)[0])).toContain('line-through');
    });

    it('drops chips for series that disappeared', () => {
      const l = layer();
      syncOverlay(
        l,
        scene({
          legend: [legendItem({ seriesIndex: 0 }), legendItem({ seriesIndex: 1 }), legendItem({ seriesIndex: 2 })],
        }),
        'Inter',
      );
      syncOverlay(
        l,
        scene({ legend: [legendItem({ seriesIndex: 0 }), legendItem({ seriesIndex: 2 })] }),
        'Inter',
      );
      const nav = kids(l).find((e) => e.getAttribute('part') === 'legend')!;
      expect(kids(nav).map((c) => c.dataset.seriesIndex)).toEqual(['0', '2']);
    });

    it('removes the legend entirely when the series drop to one', () => {
      const l = layer();
      syncOverlay(
        l,
        scene({ legend: [legendItem({ seriesIndex: 0 }), legendItem({ seriesIndex: 1 })] }),
        'Inter',
      );
      syncOverlay(l, scene({ legend: [legendItem({ seriesIndex: 0 })] }), 'Inter');
      expect(kids(l).some((e) => e.getAttribute('part') === 'legend')).toBe(false);
    });

    it('puts the legend in its own layer when one is given', () => {
      const l = layer();
      const legendLayer = layer();
      syncOverlay(
        l,
        scene({
          texts: [text()],
          legend: [legendItem({ seriesIndex: 0 }), legendItem({ seriesIndex: 1 })],
        }),
        'Inter',
        {},
        false,
        legendLayer,
      );
      // The focus ring is drawn outside the chip's box, so the legend must not
      // sit inside the clipped text layer.
      expect(kids(l).some((e) => e.getAttribute('part') === 'legend')).toBe(false);
      expect(kids(legendLayer).some((e) => e.getAttribute('part') === 'legend')).toBe(true);
    });

    it('clears stale text but keeps the legend on re-render', () => {
      const l = layer();
      const s = scene({
        texts: [text({ key: 't1' })],
        legend: [legendItem({ seriesIndex: 0 }), legendItem({ seriesIndex: 1 })],
      });
      syncOverlay(l, s, 'Inter');
      syncOverlay(l, s, 'Inter');
      expect(kids(l).filter((e) => e.dataset.key === 't1')).toHaveLength(1);
      expect(kids(l).filter((e) => e.getAttribute('part') === 'legend')).toHaveLength(1);
    });

    describe('legend placement', () => {
      const twoSeries = [legendItem({ seriesIndex: 0 }), legendItem({ seriesIndex: 1 })];
      const navFor = (pos: string, rtl = false) => {
        const l = layer();
        syncOverlay(l, scene({ legend: twoSeries, legendPosition: pos }), 'Inter', {}, rtl);
        return kids(l).find((e) => e.getAttribute('part') === 'legend')!;
      };

      it('lays a side legend out as a centred column', () => {
        const nav = navFor('left');
        expect(css(nav)).toContain('flex-direction:column');
        expect(css(nav)).toContain('left:12px');
        expect(css(nav)).toContain('top:50%');
      });

      it('keeps `left`/`right` physical under RTL', () => {
        // Named for a side, so they must NOT swap the way start/end do.
        expect(css(navFor('right', true))).toContain('right:12px');
        expect(css(navFor('left', true))).toContain('left:12px');
      });

      it('anchors a corner legend to its corner', () => {
        const nav = navFor('bottom-end');
        expect(css(nav)).toContain('bottom:2px');
        expect(css(nav)).toContain('right:12px');
        expect(css(nav)).toContain('justify-content:flex-end');
        expect(css(nav)).toContain('max-width:88%');
      });

      it('swaps logical start/end under RTL', () => {
        expect(css(navFor('top-start'))).toContain('left:12px');
        expect(css(navFor('top-start', true))).toContain('right:12px');
        expect(css(navFor('top-end', true))).toContain('left:12px');
      });

      it('spans the full width for a plain top/bottom legend', () => {
        const nav = navFor('top');
        // Full width so a crammed legend wraps across it instead of stacking
        // into a narrow centred block.
        expect(css(nav)).toContain('left:12px');
        expect(css(nav)).toContain('right:12px');
        expect(css(nav)).toContain('justify-content:center');
      });

      it('defaults to the top-end corner', () => {
        const l = layer();
        syncOverlay(l, scene({ legend: twoSeries }), 'Inter');
        const nav = kids(l).find((e) => e.getAttribute('part') === 'legend')!;
        expect(css(nav)).toContain('top:2px');
        expect(css(nav)).toContain('right:12px');
      });

      it('lets a chip ellipsise in a narrow side column', () => {
        // A cut is unavoidable there, but it should look deliberate rather than
        // like a typo ("Organic searc").
        expect(css(kids(navFor('left'))[0])).toContain('flex:0 1 auto');
        expect(css(kids(navFor('top'))[0])).toContain('flex:none');
      });
    });
  });
});
