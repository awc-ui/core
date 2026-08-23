import { Component, CUSTOM_ELEMENTS_SCHEMA, Input } from '@angular/core';

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
  /** Tooltip x labels — quarters or month-end dates, already formatted. */
  @Input() labels?: string[];
  @Input() valueFormatter?: (value: number | null) => string;
  @Input() color = 'primary';
}
