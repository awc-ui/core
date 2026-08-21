'use client';

import { useMemo, useState } from 'react';
import {
  MdAreaChart,
  MdLineChart,
  MdSegmentedButton,
  MdSegmentedButtonSet,
} from '@awc-ui/react';
import { latencyWindows, type TimeWindow } from '../lib/data';

const WINDOWS: { value: TimeWindow; label: string }[] = [
  { value: '1h', label: '1H' },
  { value: '6h', label: '6H' },
  { value: '24h', label: '24H' },
  { value: '7d', label: '7D' },
];

const fmtMs = (v: number | null) => `${(v ?? 0).toLocaleString('en-US')} ms`;
const fmtRps = (v: number | null) => `${(v ?? 0).toLocaleString('en-US')} req/s`;

export default function LatencyPanel() {
  const [window, setWindow] = useState<TimeWindow>('6h');
  const data = latencyWindows[window];

  const latencySeries = useMemo(
    () => [
      { label: 'p50', data: data.p50 },
      { label: 'p95', data: data.p95 },
      { label: 'p99', data: data.p99 },
    ],
    [data],
  );

  const trafficSeries = useMemo(
    () => data.regions.map((r) => ({ label: r.label, data: r.data })),
    [data],
  );

  const markLines = useMemo(
    () =>
      data.deployAt
        ? [{ value: data.deployAt, label: 'Deploy graph-api v5.0.3', dash: 'dashed' as const }]
        : [],
    [data],
  );

  const last = (a: number[]) => a[a.length - 1];

  return (
    <div className="chart-stack">
      <div className="page-toolbar">
        <div className="latency-kpis">
          <div className="kpi">
            <span className="k">Current p50</span>
            <span className="v">{last(data.p50)} ms</span>
          </div>
          <div className="kpi">
            <span className="k">Current p95</span>
            <span className="v">{last(data.p95)} ms</span>
          </div>
          <div className="kpi">
            <span className="k">Current p99</span>
            <span className="v">{last(data.p99)} ms</span>
          </div>
        </div>
        <MdSegmentedButtonSet
          aria-label="Time window"
          onMdChange={(e) => {
            const next = e.detail[0] as TimeWindow | undefined;
            if (next) setWindow(next);
          }}
        >
          {WINDOWS.map((w) => (
            <MdSegmentedButton
              key={w.value}
              value={w.value}
              label={w.label}
              selected={w.value === window}
            />
          ))}
        </MdSegmentedButtonSet>
      </div>

      <div className="chart-card">
        <MdLineChart
          label="Gateway latency percentiles"
          subtitle={`p50 / p95 / p99 across the mesh — last ${window}`}
          heightProp="320px"
          curve="monotone"
          grid="horizontal"
          axisTicks
          legend="top-end"
          tooltip="axis"
          xAxis={{ data: data.labels, scale: 'category' }}
          yAxis={{ label: 'ms', min: 0 }}
          series={latencySeries}
          markLines={markLines}
          valueFormatter={fmtMs}
        />
      </div>

      <div className="chart-card">
        <MdAreaChart
          label="Request volume by region"
          subtitle={`Stacked req/s per ingress region — last ${window}`}
          heightProp="300px"
          curve="monotone"
          grid="horizontal"
          axisTicks
          legend="top-end"
          tooltip="axis"
          xAxis={{ data: data.labels, scale: 'category' }}
          yAxis={{ label: 'req/s', min: 0 }}
          series={trafficSeries}
          valueFormatter={fmtRps}
        />
      </div>
    </div>
  );
}
