'use client';

// Objects/arrays have no attribute form — the React wrapper sets xAxis/series/
// yAxis as JS properties on the custom element, so this must be a client component.
import { MdLineChart } from '@awc-ui/react';

export function SessionsChart() {
  return (
    <MdLineChart
      label="Sessions"
      subtitle="Last 8 weeks"
      curve="monotone"
      area
      legend="none"
      height="260px"
      xAxis={{ data: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8'], scale: 'category' }}
      series={[{ label: 'Sessions', data: [320, 410, 380, 520, 490, 610, 580, 700] }]}
      yAxis={{ min: 0 }}
    />
  );
}
