'use client';

import { MdSparkline } from '@awc-ui/react';
import type { ServiceStatus } from '../lib/data';

const COLOR: Record<ServiceStatus, string> = {
  operational: 'success',
  degraded: 'warning',
  down: 'error',
};

export default function UptimeSparkline({
  data,
  status,
}: {
  data: number[];
  status: ServiceStatus;
}) {
  const labels = data.map((_, i) => `${String(i).padStart(2, '0')}:00 UTC`);
  return (
    <MdSparkline
      variant="area"
      curve="monotone"
      color={COLOR[status]}
      heightProp="40px"
      min={94}
      max={100.4}
      showMarks="extremes"
      data={data}
      labels={labels}
      valueFormatter={(v: number | null) => `${v ?? 0}% uptime`}
    />
  );
}
