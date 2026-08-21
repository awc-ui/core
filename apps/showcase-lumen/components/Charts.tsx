'use client';

// Chart components draw to <canvas>, so they are rendered only after mount —
// the server pass emits a fixed-size placeholder instead.

import { useEffect, useState } from 'react';
import { MdPieChart, MdSparkline } from '@awc-ui/react/server';
import { SPENDING, TREND_LABELS, currency } from '../lib/data';

function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

export function TrendSparkline({
  data,
  color = 'primary',
}: {
  data: number[];
  color?: string;
}) {
  const mounted = useMounted();
  if (!mounted) return <div className="account-spark" style={{ blockSize: 32 }} />;
  return (
    <div className="account-spark">
      <MdSparkline
        variant="area"
        color={color}
        heightProp="32px"
        showMarks="none"
        data={data}
        labels={TREND_LABELS}
        valueFormatter={(v: number | null) => (v == null ? '—' : currency(v))}
      />
    </div>
  );
}

export function SpendingPie() {
  const mounted = useMounted();
  const total = SPENDING.reduce((sum, s) => sum + s.value, 0);
  if (!mounted) return <div style={{ blockSize: 340 }} />;
  return (
    <MdPieChart
      label="Spending by category"
      subtitle="August so far"
      innerRadius="58%"
      legend="bottom"
      heightProp="340px"
      data={SPENDING}
      valueFormatter={(v: number) => currency(v)}
    >
      <div slot="center" className="pie-center">
        <strong>{currency(total)}</strong>
        <span>spent in August</span>
      </div>
    </MdPieChart>
  );
}
