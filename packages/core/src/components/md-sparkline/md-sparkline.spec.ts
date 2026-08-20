import { newSpecPage } from '@stencil/core/testing';
import { MdSparkline } from './md-sparkline';

describe('md-sparkline', () => {
  async function create(html: string) {
    return newSpecPage({ components: [MdSparkline], html });
  }

  describe('rendering', () => {
    it('renders with defaults (line variant)', async () => {
      const page = await create('<md-sparkline></md-sparkline>');
      expect(page.root).toHaveClass('md-sparkline');
      expect(page.root).toHaveClass('md-sparkline--line');
    });

    it('reflects variant via host class', async () => {
      for (const v of ['line', 'bar', 'area'] as const) {
        const page = await create(`<md-sparkline variant="${v}"></md-sparkline>`);
        expect(page.root).toHaveClass(`md-sparkline--${v}`);
      }
    });

    it('exposes a canvas part', async () => {
      const page = await create('<md-sparkline></md-sparkline>');
      expect(page.root?.shadowRoot?.querySelector('[part="canvas"]')).toBeTruthy();
    });

    it('does NOT render header/footer/empty parts (sparklines are presentation-only)', async () => {
      const page = await create('<md-sparkline></md-sparkline>');
      const shadow = page.root?.shadowRoot;
      expect(shadow?.querySelector('[part="header"]')).toBeFalsy();
      expect(shadow?.querySelector('[part="footer"]')).toBeFalsy();
      expect(shadow?.querySelector('[part="empty"]')).toBeFalsy();
    });
  });

  describe('accessibility', () => {
    it('uses role="img" (more compact than role="figure" for inline use)', async () => {
      const page = await create('<md-sparkline></md-sparkline>');
      expect(page.root?.getAttribute('role')).toBe('img');
    });

    it('summary mentions latest value and range', async () => {
      const page = await create('<md-sparkline></md-sparkline>');
      page.root!.data = [10, 20, 30, 40];
      await page.waitForChanges();
      const label = page.root?.getAttribute('aria-label') ?? '';
      expect(label).toContain('Sparkline');
      expect(label).toContain('latest 40');
      expect(label).toContain('range 10 to 40');
    });

    it('summary handles the empty case gracefully', async () => {
      const page = await create('<md-sparkline></md-sparkline>');
      expect(page.root?.getAttribute('aria-label')).toContain('no data');
    });

    it('ignores nulls when computing min / max / latest', async () => {
      const page = await create('<md-sparkline></md-sparkline>');
      page.root!.data = [null, 5, null, 8, null];
      await page.waitForChanges();
      const label = page.root?.getAttribute('aria-label') ?? '';
      expect(label).toContain('latest 8');
      expect(label).toContain('range 5 to 8');
    });
  });

  describe('props', () => {
    it('defaults to the primary colour role', async () => {
      const page = await create('<md-sparkline></md-sparkline>');
      expect((page.root as unknown as { color: string }).color).toBe('primary');
    });

    it('defaults showMarks to "extremes"', async () => {
      const page = await create('<md-sparkline></md-sparkline>');
      expect((page.root as unknown as { showMarks: string }).showMarks).toBe('extremes');
    });

    it('accepts a custom block-size via the `height` attribute', async () => {
      const page = await create('<md-sparkline height="48px"></md-sparkline>');
      expect((page.root as HTMLElement | null)?.style.blockSize).toBe('48px');
    });
  });

  describe('public API', () => {
    it('exposes resize() and getInstance()', async () => {
      const page = await create('<md-sparkline></md-sparkline>');
      const host = page.root as unknown as {
        resize: () => Promise<void>;
        getInstance: () => Promise<unknown>;
      };
      expect(typeof host.resize).toBe('function');
      expect(typeof host.getInstance).toBe('function');
    });
  });
});
