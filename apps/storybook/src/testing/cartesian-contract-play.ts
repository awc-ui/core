import { expect, waitFor } from 'storybook/test';
import { alive } from './chart-play';

/** Public interactions shared by the three Cartesian chart examples. */
export const cartesianContractPlay = (tag: 'md-line-chart' | 'md-area-chart' | 'md-bar-chart') =>
  async ({ canvasElement, step }: { canvasElement: HTMLElement; step: (label: string, body: () => Promise<void>) => void | Promise<void> }) => {
    const chart = canvasElement.querySelector(tag) as HTMLMdLineChartElement | HTMLMdAreaChartElement | HTMLMdBarChartElement;
    await alive(chart);
    await chart.resize();
    const plot = chart.shadowRoot!.querySelector('[part="canvas"]') as HTMLElement;
    const live = () => chart.shadowRoot!.querySelector('[aria-live]')!.textContent;
    const original = chart.series;
    const key = (key: string) => plot.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));

    await step('Keyboard readings follow the visible data and legend choices survive a refresh', async () => {
      plot.focus(); key('Home'); key('ArrowRight');
      await waitFor(() => expect(live()).toContain('Feb'));
      key('End'); await waitFor(() => expect(live()).toContain('Jun'));
      key('ArrowLeft'); await waitFor(() => expect(live()).toContain('May'));
      key('Escape'); await waitFor(() => expect(live()).toBe(''));
      const legend = () => chart.shadowRoot!.querySelector('button[data-series-index="0"]') as HTMLButtonElement;
      legend().click();
      chart.series = original.map(series => ({ ...series, data: [...series.data] }));
      await waitFor(() => expect(legend().getAttribute('aria-pressed')).toBe('false'));
      key('Home');
      await waitFor(() => { expect(live()).toContain('Costs'); expect(live()).not.toContain('Sales'); });
      chart.series = original.map(series => ({ ...series, hidden: false }));
      await waitFor(() => expect(legend().getAttribute('aria-pressed')).toBe('true'));
      plot.blur(); await waitFor(() => expect(live()).toBe(''));
    });

    await step('Clicking a painted datum emits its series and source index', async () => {
      const eventName = tag === 'md-bar-chart' ? 'mdBarClick' : 'mdMarkerClick';
      let detail: { seriesId: string; dataIndex: number; value: number } | undefined;
      const listener = (event: Event) => { detail = (event as CustomEvent).detail; };
      chart.addEventListener(eventName, listener);
      const scene = (await chart.getInstance())!.getScene()!;
      const datum = tag === 'md-bar-chart' ? scene.bars.find(bar => bar.seriesIndex === 0)! : scene.markers.find(mark => mark.seriesIndex === 0)!;
      const canvas = chart.shadowRoot!.querySelector('canvas')!;
      const rect = canvas.getBoundingClientRect();
      const x = datum.x + ('w' in datum ? datum.w / 2 : 0);
      const y = datum.y + ('h' in datum ? datum.h / 2 : 0);
      canvas.dispatchEvent(new MouseEvent('click', { clientX: rect.left + x, clientY: rect.top + y, bubbles: true }));
      expect(detail).toEqual(expect.objectContaining({ seriesId: 'sales', dataIndex: 0, value: 10 }));
      chart.removeEventListener(eventName, listener);
    });

    await step('Zoom and the real range input share one bounded source window', async () => {
      const events: Array<{ startIndex: number; endIndex: number; reset: boolean }> = [];
      const listener = (event: Event) => events.push((event as CustomEvent).detail);
      chart.addEventListener('mdZoom', listener);
      await chart.setZoom(1, 3);
      await waitFor(async () => expect((await chart.getInstance())!.getScene()!.xLabels).toEqual(['Feb', 'Mar', 'Apr']));
      key('Home'); await waitFor(() => expect(live()).toContain('Feb'));
      key('End'); await waitFor(() => expect(live()).toContain('Apr'));
      const slider = chart.shadowRoot!.querySelector('md-slider')!;
      await waitFor(() => expect(slider.shadowRoot?.querySelector('input')).toBeTruthy());
      const input = slider.shadowRoot!.querySelector('input')!;
      input.value = '2'; input.dispatchEvent(new Event('input', { bubbles: true }));
      await waitFor(() => expect(events.at(-1)?.startIndex).toBe(2));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      await chart.resetZoom();
      expect(events.at(-1)).toEqual({ startIndex: 0, endIndex: 5, reset: true });
      expect(chart.series.map(series => series.data)).toEqual(original.map(series => series.data));
      chart.removeEventListener('mdZoom', listener);
    });

    await step('Updated formatting reaches the accessible table, loading clears and export remains usable', async () => {
      chart.valueFormatter = value => value == null ? 'No reading' : `${value} units`;
      chart.xAxis = { data: [1, 2, 3, 4, 5, 6], label: 'Month', valueFormatter: value => `M${value}` };
      chart.yAxis = { label: 'Amount', valueFormatter: value => `${value}k`, min: 0, max: 100 };
      if (tag !== 'md-bar-chart') (chart as HTMLMdLineChartElement).grid = 'both';
      chart.stack = 'percentage';
      await waitFor(() => expect(chart.shadowRoot!.querySelector('table')!.textContent).toContain('10 units'));
      expect(chart.shadowRoot!.querySelector('table')!.textContent).toContain('M1');
      chart.loading = true; chart.loadingLabel = 'Updating revenue'; chart.series = [];
      await waitFor(() => expect(chart.shadowRoot!.querySelector('[part="loading"]')!.textContent).toContain('Updating revenue'));
      expect(chart.shadowRoot!.querySelector('[part="empty"]')).toBeNull();
      chart.loading = false;
      await waitFor(() => expect(chart.shadowRoot!.querySelector('[part="empty"]')).toBeTruthy());
      chart.series = original; chart.stack = 'none'; chart.tooltip = 'item';
      await waitFor(() => expect(chart.shadowRoot!.querySelector('[part="empty"]')).toBeNull());
      await chart.refreshTheme(); await chart.resize(); await chart.replay();
      expect(await chart.toDataURL()).toMatch(/^data:image\/png;base64,/);
    });
    await step('Per-point options and alternative scales stay aligned after zoom', async () => {
      chart.xAxis = { data: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'] };
      if (tag === 'md-bar-chart') {
        const bar = chart as HTMLMdBarChartElement;
        bar.series = [{ data: [10, 20, 30, 40, 50, 60], pointColors: { 0: '#0000ff', 2: '#ff0000', 5: '#00ff00' }, pointWidths: { 0: 0.2, 2: 0.4, 5: 0.8 } }, { label: 'Rate', data: [1, 2, 3, 4, 5, 6], yAxisIndex: 1 }];
        bar.yAxis2 = { label: 'Rate', min: 0, max: 10, valueFormatter: value => `${value}%` };
        bar.categoryGap = '30%'; bar.barGap = 25;
        await waitFor(async () => expect((await bar.getInstance())!.getScene()!.texts.some(text => text.text.endsWith('%'))).toBe(true));
        await bar.setZoom(1, 3);
        await waitFor(async () => expect((await bar.getInstance())!.getScene()!.xLabels).toEqual(['Feb', 'Mar', 'Apr']));
        const scene = (await bar.getInstance())!.getScene()!;
        expect(scene.bars.find(datum => datum.seriesIndex === 0 && datum.dataIndex === 1)!.color).toBe('#ff0000');
        expect(scene.bars.some(datum => datum.color === '#0000ff' || datum.color === '#00ff00')).toBe(false);
        await bar.resetZoom(); bar.yAxis2 = undefined;
        bar.series = [{ label: 'Range', data: [], range: [[1, 4], [2, 8], [3, 9]] }];
        bar.xAxis = { data: ['Mon', 'Tue', 'Wed'] }; bar.yAxis = { scale: 'log' };
        await waitFor(async () => expect((await bar.getInstance())!.getScene()!.bars).toHaveLength(3));
        await bar.drill(0); await bar.drill(0, 'up');
        bar.polar = true; bar.series = [{ label: 'Work', data: [2, 5, 3] }, { label: 'Work', data: [3, 2, 6] }];
        await waitFor(async () => expect((await bar.getInstance())!.getScene()!.polar).toBe(true));
        bar.polar = false;
      } else {
        const line = chart as HTMLMdLineChartElement | HTMLMdAreaChartElement;
        line.series = [{ label: 'Forecast', data: [10, 20, 30, 40, 50, 60], curve: 'linear', connectNulls: true, showMarks: true, lineWidth: 3, markSize: 5, stroke: true, pointSymbols: { 0: 'square', 2: 'diamond', 5: 'triangle' } }];
        await waitFor(async () => expect((await line.getInstance())!.getScene()!.markers).toHaveLength(6));
        await line.setZoom(1, 3);
        await waitFor(async () => expect((await line.getInstance())!.getScene()!.markers).toHaveLength(3));
        const markers = (await line.getInstance())!.getScene()!.markers;
        expect(markers.some(mark => mark.symbol === 'diamond')).toBe(true);
        expect(markers.some(mark => mark.symbol === 'square' || mark.symbol === 'triangle')).toBe(false);
        if (tag === 'md-line-chart') {
          const annotated = line as HTMLMdLineChartElement;
          annotated.markLines = [{ value: 0, label: 'Before' }, { value: 2, label: 'Target', color: '#ff0000' }, { value: 5, label: 'After' }];
          await waitFor(async () => expect((await annotated.getInstance())!.getScene()!.texts.some(text => text.text === 'Target')).toBe(true));
          expect((await annotated.getInstance())!.getScene()!.texts.some(text => text.text === 'Before' || text.text === 'After')).toBe(false);
          annotated.yAxes = [{ label: 'Revenue', min: 0, max: 100, valueFormatter: value => `${value} USD` }, { label: 'Rate', min: 0, max: 1 }];
          await waitFor(async () => expect((await annotated.getInstance())!.getScene()!.texts.some(text => text.text.endsWith(' USD'))).toBe(true));
          annotated.markLines = undefined; annotated.yAxes = undefined;
        } else {
          const area = line as HTMLMdAreaChartElement;
          await area.resetZoom();
          area.series = [{ label: 'Forecast', data: [], range: [[1, 4], [2, 8], [3, 9]] }, { label: 'Forecast', data: [2, 5, 6] }];
          area.xAxis = { data: ['Mon', 'Tue', 'Wed'] }; area.yAxis = { scale: 'log' };
          await waitFor(async () => expect((await area.getInstance())!.getScene()!.xLabels).toEqual(['Mon', 'Tue', 'Wed']));
          expect((await area.getInstance())!.getScene()!.areas.length).toBeGreaterThan(0);
          area.yAxis = undefined; area.stack = 'wiggle'; area.showLine = false;
          area.series = [{ label: 'Work', data: [2, 5, 3] }, { label: 'Work', data: [3, 2, 6] }];
          await waitFor(async () => expect((await area.getInstance())!.getScene()!.areas).toHaveLength(2));
          area.stack = 'silhouette';
          await area.resize(); expect((await area.getInstance())!.getScene()!.areas).toHaveLength(2);
          area.showLine = true;
        }
      }
      chart.series = original; chart.stack = 'none'; chart.yAxis = undefined;
      chart.xAxis = { data: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'] };
      await chart.resetZoom();
      await waitFor(async () => expect((await chart.getInstance())!.getScene()!.xLabels).toHaveLength(6));
    });

  };
