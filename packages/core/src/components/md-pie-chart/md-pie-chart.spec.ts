import { newSpecPage } from '@stencil/core/testing';
import { MdPieChart } from './md-pie-chart';

describe('md-pie-chart', () => {
  async function create(html: string) {
    return newSpecPage({ components: [MdPieChart], html });
  }

  describe('rendering', () => {
    it('renders with defaults + empty state', async () => {
      const page = await create('<md-pie-chart></md-pie-chart>');
      expect(page.root).toHaveClass('md-pie-chart');
      expect(page.root).toHaveClass('md-pie-chart--empty');
    });

    it('exposes a center slot for donut KPIs', async () => {
      const page = await create('<md-pie-chart></md-pie-chart>');
      const shadow = page.root?.shadowRoot;
      expect(shadow?.querySelector('slot[name="center"]')).toBeTruthy();
      expect(shadow?.querySelector('[part="center"]')).toBeTruthy();
    });

    it('adds the donut modifier class when innerRadius > 0%', async () => {
      const page = await create('<md-pie-chart inner-radius="60%"></md-pie-chart>');
      expect(page.root).toHaveClass('md-pie-chart--donut');
    });

    it('drops the empty class once data is supplied', async () => {
      const page = await create('<md-pie-chart></md-pie-chart>');
      page.root!.data = [
        { label: 'A', value: 10 },
        { label: 'B', value: 20 },
      ];
      await page.waitForChanges();
      expect(page.root).not.toHaveClass('md-pie-chart--empty');
    });
  });

  describe('accessibility', () => {
    it('uses role="figure"', async () => {
      const page = await create('<md-pie-chart></md-pie-chart>');
      expect(page.root?.getAttribute('role')).toBe('figure');
    });

    it('summary lists slice count', async () => {
      const page = await create('<md-pie-chart></md-pie-chart>');
      page.root!.data = [
        { label: 'A', value: 10 },
        { label: 'B', value: 20 },
      ];
      await page.waitForChanges();
      expect(page.root?.getAttribute('aria-label')).toContain('2 slices');
    });

    it('singularises the slice count for a single datum', async () => {
      const page = await create('<md-pie-chart></md-pie-chart>');
      page.root!.data = [{ label: 'A', value: 10 }];
      await page.waitForChanges();
      expect(page.root?.getAttribute('aria-label')).toContain('1 slice');
    });
  });

  describe('props', () => {
    it('defaults to a pie (no inner radius)', async () => {
      const page = await create('<md-pie-chart></md-pie-chart>');
      expect((page.root as unknown as { innerRadius: string | number }).innerRadius).toBe('0%');
    });

    it('accepts a numeric inner radius (pixels)', async () => {
      const page = await create('<md-pie-chart inner-radius="40"></md-pie-chart>');
      expect((page.root as unknown as { innerRadius: string | number }).innerRadius).toBe('40');
    });

    it('reflects start/end angles for half-pie support', async () => {
      const page = await create('<md-pie-chart start-angle="180" end-angle="0"></md-pie-chart>');
      const host = page.root as unknown as { startAngle: number; endAngle: number };
      expect(host.startAngle).toBe(180);
      expect(host.endAngle).toBe(0);
    });
  });

  describe('public API', () => {
    it('exposes resize / toDataURL / getInstance', async () => {
      const page = await create('<md-pie-chart></md-pie-chart>');
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
});

describe('keyboard access to the slices', () => {
  async function withData(html = '<md-pie-chart></md-pie-chart>') {
    const page = await newSpecPage({ components: [MdPieChart], html });
    page.root!.data = [
      { label: 'Direct', value: 320 },
      { label: 'Organic', value: 240 },
      { label: 'Email', value: 80 },
    ];
    await page.waitForChanges();
    return page;
  }
  const plot = (page: { root?: HTMLElement | null }) =>
    page.root?.shadowRoot?.querySelector('[part="canvas"]') as HTMLElement;
  const live = (page: { root?: HTMLElement | null }) =>
    page.root?.shadowRoot?.querySelector('[aria-live]')?.textContent?.trim() ?? '';
  const press = async (page: any, key: string) => {
    plot(page).dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    await page.waitForChanges();
  };

  it('makes the plot a focus stop and explains the keys', async () => {
    const page = await withData();
    expect(plot(page).getAttribute('tabindex')).toBe('0');
    expect(plot(page).getAttribute('role')).toBe('application');
    expect(plot(page).getAttribute('aria-label')).toContain('arrow keys');
  });

  it('is not a focus stop with no slices to walk', async () => {
    const page = await newSpecPage({ components: [MdPieChart], html: '<md-pie-chart></md-pie-chart>' });
    expect(plot(page).getAttribute('tabindex')).toBeNull();
  });

  it('announces each slice with its value and share', async () => {
    const page = await withData();
    await press(page, 'ArrowRight');
    expect(live(page)).toBe('Direct: 320 (50%)');
    await press(page, 'ArrowRight');
    expect(live(page)).toBe('Organic: 240 (37.5%)');
  });

  it('wraps nothing: Home and End go to the ends, Escape leaves', async () => {
    const page = await withData();
    await press(page, 'End');
    expect(live(page)).toContain('Email');
    await press(page, 'Home');
    expect(live(page)).toContain('Direct');
    // Already at the first slice — stepping back must not fall off.
    await press(page, 'ArrowLeft');
    expect(live(page)).toContain('Direct');
    await press(page, 'Escape');
    expect(live(page)).toBe('');
  });

  it('uses labelPoint for the announcement', async () => {
    const page = await withData('<md-pie-chart label-point="%label% — %percent%"></md-pie-chart>');
    await press(page, 'ArrowRight');
    expect(live(page)).toBe('Direct — 50%');
  });
});

describe('localization and label overrides', () => {
  it('formats numbers with the given locale', async () => {
    const page = await newSpecPage({ components: [MdPieChart], html: '<md-pie-chart locale="de-DE"></md-pie-chart>' });
    page.root!.data = [{ label: 'A', value: 1234567 }];
    await page.waitForChanges();
    const table = page.root?.shadowRoot?.querySelector('.md-pie-chart__a11y-table')?.innerHTML ?? '';
    // German groups with dots; the browser default would group differently.
    expect(table).toContain('1.234.567');
  });

  it('replaces the generated summary outright', async () => {
    const page = await newSpecPage({
      components: [MdPieChart],
      html: '<md-pie-chart summary="Trafikkilder"></md-pie-chart>',
    });
    page.root!.data = [{ label: 'A', value: 1 }];
    await page.waitForChanges();
    expect(page.root?.getAttribute('aria-label')).toBe('Trafikkilder');
  });

  it('translates the data table chrome', async () => {
    const page = await newSpecPage({ components: [MdPieChart], html: '<md-pie-chart></md-pie-chart>' });
    page.root!.tableLabels = { category: 'Kategori', value: 'Verdi', share: 'Andel' };
    page.root!.data = [{ label: 'A', value: 1 }];
    await page.waitForChanges();
    const table = page.root?.shadowRoot?.querySelector('.md-pie-chart__a11y-table')?.innerHTML ?? '';
    expect(table).toContain('Kategori');
    expect(table).toContain('Verdi');
    expect(table).toContain('Andel');
  });

  it('uses labelEmpty, and the loader replaces the empty state', async () => {
    const page = await newSpecPage({
      components: [MdPieChart],
      html: '<md-pie-chart label-empty="Ingen data"></md-pie-chart>',
    });
    expect(page.root?.shadowRoot?.querySelector('[part="empty"]')?.textContent).toContain('Ingen data');

    const loadingPage = await newSpecPage({
      components: [MdPieChart],
      html: '<md-pie-chart loading loading-label="Laster…"></md-pie-chart>',
    });
    expect(loadingPage.root?.shadowRoot?.querySelector('[part="loading"]')).toBeTruthy();
    expect(loadingPage.root?.shadowRoot?.querySelector('[part="empty"]')).toBeFalsy();
  });
});
