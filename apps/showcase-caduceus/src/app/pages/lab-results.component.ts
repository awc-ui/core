import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';

type LabStatus = 'normal' | 'watch' | 'out';

interface LabRow {
  analyte: string;
  result: string;
  value: number;
  /** Plot window for the reference meter. */
  plotMin: number;
  plotMax: number;
  refText: string;
  status: LabStatus;
}

const STATUS_META: Record<LabStatus, { dot: string; color: string; label: string }> = {
  normal: { dot: 'online', color: 'success', label: 'Within range' },
  watch: { dot: 'away', color: 'warning', label: 'Borderline' },
  out: { dot: 'busy', color: 'error', label: 'Out of range' },
};

@Component({
  selector: 'app-lab-results',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <main class="page">
      <header>
        <h1 class="page-title">Lab results</h1>
        <p class="page-subtitle">
          Comprehensive metabolic and lipid panel · Collected Aug 14, 2026 · Ordered by
          Dr. Imani Okafor · Specimen 26-118392
        </p>
      </header>

      <md-card variant="outlined" class="legend-card">
        <span class="legend-title">Key</span>
        @for (key of statusKeys; track key) {
          <span class="legend-item">
            <span class="dot-anchor">
              <md-status-dot [attr.state]="meta[key].dot" [attr.label]="meta[key].label"></md-status-dot>
            </span>
            {{ meta[key].label }}
          </span>
        }
      </md-card>

      <md-table-container>
        <md-table
          label="Lab results, August 2026 panel"
          caption="Values compared against the Caduceus Health adult reference intervals."
          column-template="1.5fr 0.9fr 1.7fr 1.1fr"
          min-width="720px"
          striped
        >
          <md-table-head>
            <md-table-row rowgroup="head">
              <md-table-cell head scope="col">Analyte</md-table-cell>
              <md-table-cell head scope="col" numeric>Result</md-table-cell>
              <md-table-cell head scope="col">Reference range</md-table-cell>
              <md-table-cell head scope="col">Status</md-table-cell>
            </md-table-row>
          </md-table-head>
          <md-table-body>
            @for (row of rows; track row.analyte) {
              <md-table-row>
                <md-table-cell>{{ row.analyte }}</md-table-cell>
                <md-table-cell numeric>{{ row.result }}</md-table-cell>
                <md-table-cell>
                  <div class="range-cell">
                    <md-meter
                      class="range-meter"
                      [attr.value]="row.value"
                      [attr.min]="row.plotMin"
                      [attr.max]="row.plotMax"
                      [attr.color]="meta[row.status].color"
                      [attr.label]="row.analyte + ' relative to reference range'"
                      [attr.value-text]="row.result + ', reference ' + row.refText"
                      thickness="6"
                    ></md-meter>
                    <span class="range-text">{{ row.refText }}</span>
                  </div>
                </md-table-cell>
                <md-table-cell>
                  <span class="status-cell">
                    <span class="dot-anchor">
                      <md-status-dot
                        [attr.state]="meta[row.status].dot"
                        [attr.label]="meta[row.status].label"
                      ></md-status-dot>
                    </span>
                    {{ meta[row.status].label }}
                  </span>
                </md-table-cell>
              </md-table-row>
            }
          </md-table-body>
        </md-table>
      </md-table-container>

      <md-card variant="filled" class="note-card">
        <h2 class="section-title">Care team note</h2>
        <p class="note-copy">
          LDL cholesterol remains above target and vitamin D is low — Dr. Okafor recommends
          continuing the current statin dose, adding a 2000 IU vitamin D supplement, and
          repeating the lipid panel in 12 weeks. Book the follow-up draw from the
          Appointments tab.
        </p>
      </md-card>
    </main>
  `,
  styles: [
    `
      .legend-card {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 20px;
        padding: 12px 16px;
      }
      .legend-title {
        font: var(--md-sys-typescale-label-large-font);
        color: var(--md-sys-color-on-surface-variant);
      }
      .legend-item,
      .status-cell {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        font: var(--md-sys-typescale-body-medium-font);
      }
      .dot-anchor {
        position: relative;
        display: inline-block;
        inline-size: 12px;
        block-size: 12px;
      }
      .range-cell {
        display: flex;
        flex-direction: column;
        gap: 4px;
        inline-size: 100%;
        padding-block: 6px;
      }
      .range-meter {
        inline-size: 100%;
      }
      .range-text {
        font: var(--md-sys-typescale-body-small-font);
        color: var(--md-sys-color-on-surface-variant);
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
export class LabResultsComponent {
  meta = STATUS_META;
  statusKeys: LabStatus[] = ['normal', 'watch', 'out'];

  rows: LabRow[] = [
    { analyte: 'Hemoglobin A1c', result: '5.6 %', value: 5.6, plotMin: 3.5, plotMax: 9, refText: '4.0 – 5.6 %', status: 'watch' },
    { analyte: 'Fasting glucose', result: '92 mg/dL', value: 92, plotMin: 50, plotMax: 160, refText: '70 – 99 mg/dL', status: 'normal' },
    { analyte: 'Total cholesterol', result: '212 mg/dL', value: 212, plotMin: 100, plotMax: 300, refText: '< 200 mg/dL', status: 'out' },
    { analyte: 'LDL cholesterol (calc)', result: '128 mg/dL', value: 128, plotMin: 40, plotMax: 220, refText: '< 100 mg/dL', status: 'out' },
    { analyte: 'HDL cholesterol', result: '58 mg/dL', value: 58, plotMin: 20, plotMax: 100, refText: '≥ 40 mg/dL', status: 'normal' },
    { analyte: 'Triglycerides', result: '132 mg/dL', value: 132, plotMin: 50, plotMax: 400, refText: '< 150 mg/dL', status: 'normal' },
    { analyte: 'TSH', result: '2.1 mIU/L', value: 2.1, plotMin: 0, plotMax: 8, refText: '0.4 – 4.0 mIU/L', status: 'normal' },
    { analyte: 'Vitamin D, 25-OH', result: '24 ng/mL', value: 24, plotMin: 0, plotMax: 120, refText: '30 – 100 ng/mL', status: 'watch' },
    { analyte: 'Creatinine', result: '0.9 mg/dL', value: 0.9, plotMin: 0.2, plotMax: 2, refText: '0.6 – 1.2 mg/dL', status: 'normal' },
    { analyte: 'eGFR', result: '94 mL/min/1.73m²', value: 94, plotMin: 30, plotMax: 130, refText: '≥ 60 mL/min/1.73m²', status: 'normal' },
  ];
}
