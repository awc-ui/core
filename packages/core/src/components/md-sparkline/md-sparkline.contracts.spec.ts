import { newSpecPage } from '@stencil/core/testing';
import { MdSparkline } from './md-sparkline';
import { installCanvas } from '../../utils/charts/engine/test-utils/canvas-harness';

describe('md-sparkline public render contracts', () => {
  let restore: () => void;
  beforeEach(() => { ({ restore } = installCanvas()); });
  afterEach(() => restore());

  it('rebuilds the engine for each variant, preserves reference annotations and exports meaningful geometry', async () => {
    const page = await newSpecPage({ components: [MdSparkline], html: '<md-sparkline no-animation></md-sparkline>' });
    const host = page.root as HTMLMdSparklineElement;
    const plot = host.shadowRoot!.querySelector('[part="canvas"]') as HTMLElement;
    plot.getBoundingClientRect = () => ({ width: 300, height: 80, top: 0, left: 0, right: 300, bottom: 80, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
    host.data = [4, null, 9, 1, 6];
    host.labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    host.referenceAreas = [{ from: 0, to: 2, label: 'Campaign', color: '#ff0000' }, { from: 3, to: 4 }];
    host.valueFormatter = value => `$${value}`;
    await page.waitForChanges(); await host.resize();
    expect(host.getAttribute('aria-label')).toContain('latest $6, range $1 to $9');
    expect(host.getAttribute('aria-label')).toContain('Campaign');
    for (const [marks, count] of [['all', 4], ['none', 0], ['edges', 2], ['extremes', 2]] as const) {
      host.showMarks = marks; await page.waitForChanges();
      expect((await host.getInstance())!.getScene()!.markers).toHaveLength(count);
    }
    host.variant = 'area'; await page.waitForChanges();
    expect((await host.getInstance())!.getScene()!.areas.length).toBeGreaterThan(0);
    host.variant = 'bar'; await page.waitForChanges();
    expect((await host.getInstance())!.getScene()!.bars).toHaveLength(4);
    host.variant = 'line'; host.color = 'rgb(10, 20, 30)';
    host.referenceAreas = [{ from: 1, to: 3, color: 'rgb(10, 20, 30)' }];
    await page.waitForChanges(); await host.refreshTheme();
    expect((await host.getInstance())!.getScene()!.lines.length).toBeGreaterThan(0);
    host.data = [null]; await page.waitForChanges();
    expect(host.getAttribute('aria-label')).toContain('no data');
    host.remove(); await page.waitForChanges();
    expect(await host.getInstance()).toBeNull();
  });
});
