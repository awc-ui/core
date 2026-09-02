import { Component, CUSTOM_ELEMENTS_SCHEMA, EventEmitter, Input, Output } from '@angular/core';
import { ShowcaseComponent } from '../lib/screen.base';

export interface ChartSeries {
  label: string;
  data?: (number | null)[];
  id?: string;
  /** Which entry of `yAxes` measures this series. Omit for the first axis. */
  yAxisIndex?: number;
}

/**
 * One wrapper for the plot types.
 *
 * `@switch` on the tag rather than four components: the charts take almost the
 * same props and would otherwise be four files that drift. `series`, the axes
 * and `valueFormatter` are PROPERTY bindings because they have no attribute
 * form; everything else is an attribute binding, which is the house rule — see
 * `element.md`. Build the property-bound objects with
 * `ShowcaseComponent.memo()` at the call site, or every change-detection pass
 * hands the chart a fresh reference and it redraws.
 *
 * `md-pie-chart` TAKES `data`, NOT `series` — the one member of the family
 * with a different shape. The React build's overview hand-wires its donut for
 * the same reason (centre slot, `tableLabels`); a screen needing those should
 * hand-wire `md-pie-chart` too rather than grow this wrapper.
 *
 * `label-plot` is defaulted here rather than at each call site. A chart's plot
 * is a focusable `role="application"` region whose accessible name comes from
 * that prop, and its default is an English sentence — so without this every
 * chart on the Romanian and Arabic pages names the region in English.
 * Defaulting it centrally means a chart cannot be added without it.
 */
@Component({
  selector: 'awc-chart',
  standalone: true,
  styles: ':host { display: contents; }',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    @switch (tag) {
      @case ('md-line-chart') {
        <md-line-chart
          [series]="series"
          [xAxis]="xAxis"
          [yAxis]="yAxis"
          [yAxes]="yAxes"
          [valueFormatter]="valueFormatter"
          [attr.label]="label"
          [attr.subtitle]="subtitle"
          [attr.summary]="summary"
          [attr.label-plot]="t('banking.chart.plotHint')"
          [attr.height]="height"
          [attr.legend]="legend"
          [attr.curve]="curve"
          [attr.grid]="grid"
          [attr.animation]="animation"
          [attr.axis-ticks]="axisTicks ? '' : null"
          [attr.show-marks]="showMarks"
        ></md-line-chart>
      }
      @case ('md-area-chart') {
        <md-area-chart
          [series]="series"
          [xAxis]="xAxis"
          [yAxis]="yAxis"
          [yAxes]="yAxes"
          [valueFormatter]="valueFormatter"
          [attr.label]="label"
          [attr.subtitle]="subtitle"
          [attr.summary]="summary"
          [attr.label-plot]="t('banking.chart.plotHint')"
          [attr.height]="height"
          [attr.legend]="legend"
          [attr.curve]="curve"
          [attr.stack]="stack"
          [attr.animation]="animation"
          [attr.axis-ticks]="axisTicks ? '' : null"
        ></md-area-chart>
      }
      @case ('md-pie-chart') {
        <md-pie-chart
          [data]="data"
          [valueFormatter]="valueFormatter"
          [attr.label]="label"
          [attr.subtitle]="subtitle"
          [attr.summary]="summary"
          [attr.label-plot]="t('banking.chart.plotHint')"
          [attr.height]="height"
          [attr.legend]="legend"
          [attr.animation]="animation"
        ></md-pie-chart>
      }
      @default {
        <md-bar-chart
          [series]="series"
          [xAxis]="xAxis"
          [yAxis]="yAxis"
          [yAxes]="yAxes"
          [valueFormatter]="valueFormatter"
          (mdBarClick)="barClick.emit($any($event))"
          [attr.label]="label"
          [attr.subtitle]="subtitle"
          [attr.summary]="summary"
          [attr.label-plot]="t('banking.chart.plotHint')"
          [attr.height]="height"
          [attr.legend]="legend"
          [attr.layout]="layout"
          [attr.animation]="animation"
          [attr.clickable]="clickable ? '' : null"
          [attr.corner-radius]="cornerRadius"
          [attr.axis-ticks]="axisTicks ? '' : null"
        ></md-bar-chart>
      }
    }
  `,
})
export class ChartComponent extends ShowcaseComponent {
  @Input() tag: 'md-bar-chart' | 'md-line-chart' | 'md-area-chart' | 'md-pie-chart' =
    'md-bar-chart';
  @Input() series: ChartSeries[] = [];
  /** `md-pie-chart` only — its slices, in place of `series`. */
  @Input() data?: Record<string, unknown>[];
  @Input() xAxis?: Record<string, unknown>;
  @Input() yAxis?: Record<string, unknown>;
  /** Multiple value axes. Supersedes `yAxis`; series pick one via `yAxisIndex`. */
  @Input() yAxes?: Record<string, unknown>[];
  @Input() valueFormatter?: (value: number | null) => string;

  @Input() label?: string;
  @Input() subtitle?: string;
  @Input() summary?: string;
  @Input() height?: string;
  @Input() legend?: string;
  @Input() curve?: string;
  @Input() grid?: string;
  @Input() stack?: string;
  @Input() layout?: string;
  @Input() animation?: string;
  @Input() cornerRadius?: string;
  @Input() showMarks?: string;
  @Input() axisTicks = false;
  @Input() clickable = false;

  @Output() barClick = new EventEmitter<CustomEvent<{ dataIndex: number }>>();
}
