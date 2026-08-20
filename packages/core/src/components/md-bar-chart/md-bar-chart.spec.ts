import { newSpecPage } from '@stencil/core/testing';
import { MdBarChart } from './md-bar-chart';

describe('md-bar-chart', () => {
  async function create(html: string) {
    return newSpecPage({ components: [MdBarChart], html });
  }

  describe('loader slot', () => {
    it('accepts `loader`, with `loading` kept as the older alias', async () => {
      const page = await create('<md-bar-chart loading></md-bar-chart>');
      const outer = page.root?.shadowRoot?.querySelector('slot[name="loader"]');
      expect(outer).toBeTruthy();
      // Nesting is what makes both names work: the outer slot's fallback IS the
      // inner one, whose own fallback is the default indicator.
      const inner = outer?.querySelector('slot[name="loading"]');
      expect(inner).toBeTruthy();
      expect(inner?.querySelector('md-progress-indicator')).toBeTruthy();
    });
  });

  describe('rendering', () => {
    it('renders with defaults (vertical, empty)', async () => {
      const page = await create('<md-bar-chart></md-bar-chart>');
      expect(page.root).toHaveClass('md-bar-chart');
      expect(page.root).toHaveClass('md-bar-chart--vertical');
      expect(page.root).toHaveClass('md-bar-chart--empty');
    });

    it('reflects horizontal layout via the host class', async () => {
      const page = await create('<md-bar-chart layout="horizontal"></md-bar-chart>');
      expect(page.root).toHaveClass('md-bar-chart--horizontal');
    });

    it('exposes header / canvas / footer parts', async () => {
      const page = await create('<md-bar-chart></md-bar-chart>');
      const shadow = page.root?.shadowRoot;
      expect(shadow?.querySelector('[part="header"]')).toBeTruthy();
      expect(shadow?.querySelector('[part="canvas"]')).toBeTruthy();
      expect(shadow?.querySelector('[part="footer"]')).toBeTruthy();
    });
  });

  describe('accessibility', () => {
    it('uses role="figure" + a "Bar chart" summary', async () => {
      const page = await create('<md-bar-chart></md-bar-chart>');
      page.root!.series = [{ label: 'A', data: [1, 2] }];
      await page.waitForChanges();
      expect(page.root?.getAttribute('role')).toBe('figure');
      expect(page.root?.getAttribute('aria-label')).toContain('Bar chart');
    });
  });

  describe('props', () => {
    it('defaults to grouped layout (stack=none)', async () => {
      const page = await create('<md-bar-chart></md-bar-chart>');
      expect((page.root as unknown as { stack: string }).stack).toBe('none');
    });

    it('defaults cornerRadius to MD3-expressive (>0)', async () => {
      const page = await create('<md-bar-chart></md-bar-chart>');
      expect((page.root as unknown as { cornerRadius: number }).cornerRadius).toBeGreaterThan(0);
    });

    it('reflects layout as an HTML attribute', async () => {
      const page = await create('<md-bar-chart layout="horizontal"></md-bar-chart>');
      expect(page.root?.getAttribute('layout')).toBe('horizontal');
    });
  });

  describe('public API', () => {
    it('exposes the resize / toDataURL / getInstance methods', async () => {
      const page = await create('<md-bar-chart></md-bar-chart>');
      const host = page.root as unknown as {
        resize: () => Promise<void>;
        toDataURL: () => Promise<string>;
        getInstance: () => Promise<unknown>;
      };
      expect(typeof host.resize).toBe('function');
      expect(typeof host.toDataURL).toBe('function');
      expect(typeof host.getInstance).toBe('function');
    });
  });

  describe('RTL', () => {
    it('renders inside an RTL parent', async () => {
      const page = await newSpecPage({
        components: [MdBarChart],
        html: '<div dir="rtl"><md-bar-chart></md-bar-chart></div>',
      });
      expect(page.body.querySelector('md-bar-chart')).toBeTruthy();
    });
  });
});

describe('keyboard accessibility', () => {
  it('makes the plot focusable and explains the keys', async () => {
    const page = await newSpecPage({ components: [MdBarChart], html: '<md-bar-chart></md-bar-chart>' });
    (page.root as unknown as { series: unknown }).series = [{ label: 'A', data: [1, 2, 3] }];
    await page.waitForChanges();
    const plot = page.root?.shadowRoot?.querySelector('.md-bar-chart__canvas');
    expect(plot?.getAttribute('tabindex')).toBe('0');
    // role=application keeps a screen reader's browse mode off the arrow keys.
    expect(plot?.getAttribute('role')).toBe('application');
    expect(plot?.getAttribute('aria-label')).toContain('arrow keys');
  });

  it('is not a focus stop with no data to walk', async () => {
    const page = await newSpecPage({ components: [MdBarChart], html: '<md-bar-chart></md-bar-chart>' });
    expect(page.root?.shadowRoot?.querySelector('.md-bar-chart__canvas')?.getAttribute('tabindex')).toBeNull();
  });

  it('exposes a polite live region for the keyboard cursor', async () => {
    const page = await newSpecPage({ components: [MdBarChart], html: '<md-bar-chart></md-bar-chart>' });
    const live = page.root?.shadowRoot?.querySelector('[aria-live]');
    expect(live?.getAttribute('aria-live')).toBe('polite');
    expect(live?.getAttribute('role')).toBe('status');
  });
});
