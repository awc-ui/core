import { Component, CUSTOM_ELEMENTS_SCHEMA, Input } from '@angular/core';

/**
 * The eight-point trend line inside a KPI tile or a table row.
 *
 * `data`, `labels` and `valueFormatter` have no attribute form, so they are
 * property bindings — build them with `memo()` at the call site (keyed on the
 * locale where `valueFormatter` closes over the translator) so the chart is not
 * redrawn on every change-detection pass.
 */
@Component({
  selector: 'awc-sparkline',
  standalone: true,
  styles: ':host { display: contents; }',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <md-sparkline
      [data]="data"
      [labels]="labels"
      [valueFormatter]="valueFormatter"
      variant="area"
      [attr.color]="color"
      curve="monotone"
      show-marks="extremes"
      height="34px"
    ></md-sparkline>
  `,
})
export class SparklineComponent {
  @Input({ required: true }) data!: (number | null)[];
  /** Tooltip x labels — month ends, already formatted. */
  @Input() labels?: string[];
  @Input() valueFormatter?: (value: number | null) => string;
  @Input() color = 'primary';
}
