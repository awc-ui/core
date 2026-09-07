import { balanceSeries } from './derive';

/** The same history controls and window semantics in every framework. */
export const BALANCE_WINDOWS = [3, 6, 12] as const;
export type BalanceWindow = (typeof BALANCE_WINDOWS)[number];
export function isBalanceWindow(value: number): value is BalanceWindow {
  return BALANCE_WINDOWS.some((window) => window === value);
}
export function balanceHistory(window: number = 12) {
  const all = balanceSeries();
  const points = all.slice(-(isBalanceWindow(window) ? window : 12));
  return {
    points,
    total: all.length,
    change: (points[points.length - 1]?.balanceEur ?? 0) - (points[0]?.balanceEur ?? 0),
  };
}
const COPY = {
  en: { period: 'Balance history', months: 'months', change: 'Change over selected period' },
  ro: { period: 'Istoricul soldului', months: 'luni', change: 'Variație în perioada selectată' },
  ar: { period: 'سجل الرصيد', months: 'أشهر', change: 'التغير خلال الفترة المحددة' },
} as const;
export function balanceHistoryCopy(locale: string) {
  return COPY[locale as keyof typeof COPY] ?? COPY.en;
}
