import { driftedMandates } from './derive';

export const REBALANCE_FILTERS = [
  { value: 'all', labelKey: 'wealth.common.all', icon: 'list' },
  { value: 'breach', labelKey: 'wealth.allocationStatus.breach', icon: 'priority_high' },
  { value: 'drifted', labelKey: 'wealth.allocationStatus.drifted', icon: 'tune' },
] as const;
export type RebalanceFilter = (typeof REBALANCE_FILTERS)[number]['value'];
export function isRebalanceFilter(value: string): value is RebalanceFilter {
  return REBALANCE_FILTERS.some((filter) => filter.value === value);
}
/** Mutually exclusive queues retain the fixture's deterministic worst-first order. */
export function rebalanceQueue(filter: RebalanceFilter = 'all') {
  return driftedMandates().filter((row) => filter === 'all' || row.worst.status === filter);
}
