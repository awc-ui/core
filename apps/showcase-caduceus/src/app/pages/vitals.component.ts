import {
  AfterViewInit,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  ElementRef,
  PLATFORM_ID,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

interface MetricSeries {
  label: string;
  data: number[];
}

interface Metric {
  id: string;
  button: string;
  title: string;
  subtitle: string;
  unit: string;
  axisLabel: string;
  yMin: number;
  series: MetricSeries[];
  latest: string;
  change: string;
  changeNote: string;
  inRangePct: number;
  target: string;
}

const WEEKS = ['Jun 28', 'Jul 5', 'Jul 12', 'Jul 19', 'Jul 26', 'Aug 2', 'Aug 9', 'Aug 16'];

const METRICS: Metric[] = [
  {
    id: 'hr',
    button: 'Heart rate',
    title: 'Resting heart rate',
    subtitle: 'Weekly average, last 8 weeks',
    unit: 'bpm',
    axisLabel: 'Beats per minute',
    yMin: 50,
    series: [{ label: 'Resting HR', data: [74, 72, 71, 73, 69, 70, 68, 67] }],
    latest: '67 bpm',
    change: '−7 bpm',
    changeNote: 'vs. 8 weeks ago',
    inRangePct: 100,
    target: 'Target 55 – 80 bpm',
  },
  {
    id: 'bp',
    button: 'Blood pressure',
    title: 'Blood pressure',
    subtitle: 'Weekly morning average, last 8 weeks',
    unit: 'mmHg',
    axisLabel: 'mmHg',
    yMin: 60,
    series: [
      { label: 'Systolic', data: [138, 136, 133, 134, 130, 128, 127, 124] },
      { label: 'Diastolic', data: [88, 86, 85, 84, 83, 82, 80, 79] },
    ],
    latest: '124 / 79 mmHg',
    change: '−14 / −9',
    changeNote: 'vs. 8 weeks ago',
    inRangePct: 75,
    target: 'Target below 130 / 80',
  },
  {
    id: 'weight',
    button: 'Weight',
    title: 'Body weight',
    subtitle: 'Weekly weigh-in, last 8 weeks',
    unit: 'kg',
    axisLabel: 'Kilograms',
    yMin: 74,
    series: [{ label: 'Weight', data: [82.4, 82.1, 81.8, 81.9, 81.2, 80.8, 80.4, 80.1] }],
    latest: '80.1 kg',
    change: '−2.3 kg',
    changeNote: 'vs. 8 weeks ago',
    inRangePct: 62,
    target: 'Goal 78.0 kg by December',
  },
  {
    id: 'glucose',
    button: 'Glucose',
    title: 'Fasting glucose',
    subtitle: 'Weekly fingerstick average, last 8 weeks',
    unit: 'mg/dL',
    axisLabel: 'mg/dL',
    yMin: 60,
    series: [{ label: 'Fasting glucose', data: [104, 102, 101, 99, 98, 97, 95, 96] }],
    latest: '96 mg/dL',
    change: '−8 mg/dL',
    changeNote: 'vs. 8 weeks ago',
    inRangePct: 88,
    target: 'Target 70 – 99 mg/dL',
  },
];

@Component({
  selector: 'app-vitals',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <main class="page">
      <header class="vitals-head">
        <div>
          <h1 class="page-title">Vitals</h1>
          <p class="page-subtitle">
            Synced from your home devices · Last reading Aug 16, 2026
          </p>
        </div>
        <md-segmented-button-set aria-label="Vital sign" (mdChange)="onMetric($event)">
          @for (m of metrics; track m.id) {
            <md-segmented-button
              [attr.value]="m.id"
              [attr.label]="m.button"
              [attr.selected]="m.id === current().id ? '' : null"
            ></md-segmented-button>
          }
        </md-segmented-button-set>
      </header>

      <div class="stat-row">
        <md-card variant="filled" class="stat-tile">
          <span class="stat-label">Latest</span>
          <span class="stat-value">{{ current().latest }}</span>
          <span class="stat-note">{{ current().target }}</span>
        </md-card>
        <md-card variant="filled" class="stat-tile">
          <span class="stat-label">8-week change</span>
          <span class="stat-value">{{ current().change }}</span>
          <span class="stat-note">{{ current().changeNote }}</span>
        </md-card>
        <md-card variant="filled" class="stat-tile">
          <span class="stat-label">Readings in range</span>
          <md-meter
            [attr.value]="current().inRangePct"
            min="0"
            max="100"
            [attr.color]="current().inRangePct >= 80 ? 'success' : 'warning'"
            label="Share of readings within target"
            show-value
            thickness="6"
          ></md-meter>
          <span class="stat-note">of the last 8 weekly readings</span>
        </md-card>
      </div>

      <md-card variant="outlined" class="chart-card">
        <md-line-chart
          #chart
          [attr.label]="current().title"
          [attr.subtitle]="current().subtitle"
          curve="monotone"
          show-marks
          grid="horizontal"
          axis-ticks
          tooltip="axis"
          height="340px"
          [attr.legend]="current().series.length > 1 ? 'top-end' : 'none'"
        ></md-line-chart>
      </md-card>

      <md-card variant="filled" class="note-card">
        <h2 class="section-title">Trend summary</h2>
        <p class="note-copy">
          All four tracked vitals are moving in the right direction since the June care-plan
          review. Keep logging morning readings — the next automatic summary goes to
          Dr. Okafor on Sep 1, 2026.
        </p>
      </md-card>
    </main>
  `,
  styles: [
    `
      .vitals-head {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 16px;
        flex-wrap: wrap;
      }
      .stat-row {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 16px;
      }
      .stat-tile {
        padding: 16px 20px;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .stat-label {
        font: var(--md-sys-typescale-label-large-font);
        color: var(--md-sys-color-on-surface-variant);
      }
      .stat-value {
        font: var(--md-sys-typescale-headline-small-font);
      }
      .stat-note {
        font: var(--md-sys-typescale-body-small-font);
        color: var(--md-sys-color-on-surface-variant);
      }
      .chart-card {
        padding: 20px;
      }
      .note-card {
        padding: 20px 24px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .note-copy {
        margin: 0;
        font: var(--md-sys-typescale-body-medium-font);
        color: var(--md-sys-color-on-surface-variant);
      }
    `,
  ],
})
export class VitalsComponent implements AfterViewInit {
  private platformId = inject(PLATFORM_ID);

  @ViewChild('chart') chartRef?: ElementRef<HTMLElement>;

  metrics = METRICS;
  currentId = signal('hr');
  current = computed(() => METRICS.find((m) => m.id === this.currentId()) ?? METRICS[0]);

  ngAfterViewInit() {
    void this.applyMetric();
  }

  onMetric(event: Event) {
    const values = (event as CustomEvent<string[]>).detail;
    if (values.length > 0 && values[0] !== this.currentId()) {
      this.currentId.set(values[0]);
      void this.applyMetric();
    }
  }

  private async applyMetric() {
    if (!isPlatformBrowser(this.platformId)) return;
    await customElements.whenDefined('md-line-chart');
    const el = this.chartRef?.nativeElement as any;
    if (!el) return;
    const metric = this.current();
    el.xAxis = { data: WEEKS, scale: 'category' };
    el.yAxis = { label: metric.axisLabel, min: metric.yMin };
    el.series = metric.series.map((s) => ({ label: s.label, data: [...s.data] }));
    el.valueFormatter = (v: number | null) => (v == null ? '' : `${v} ${metric.unit}`);
  }
}
