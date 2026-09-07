import { getSectors } from '../data/selectors';
import type { StressScenario } from '../data/types';
import { createTranslator } from '../i18n/translator';
import type { LocaleCode } from '../i18n/locales';

const COPY = {
  en: {
    title: 'Scenario briefing',
    loss: 'Additional expected loss',
    capital: 'Additional risk-weighted assets',
    concentration: 'Largest expected-loss contributor',
    baseline: 'Compared with baseline',
    share: 'of scenario expected loss',
    export: 'Download scenario CSV',
    note: 'Illustrative portfolio · EUR · 31 March 2026',
  },
  ro: {
    title: 'Sinteza scenariului',
    loss: 'Pierdere așteptată suplimentară',
    capital: 'Active ponderate la risc suplimentare',
    concentration: 'Cea mai mare contribuție la pierderea așteptată',
    baseline: 'Față de scenariul de bază',
    share: 'din pierderea așteptată a scenariului',
    export: 'Descarcă scenariul CSV',
    note: 'Portofoliu demonstrativ · EUR · 31 martie 2026',
  },
  ar: {
    title: 'ملخص السيناريو',
    loss: 'الخسارة المتوقعة الإضافية',
    capital: 'الأصول الإضافية المرجحة بالمخاطر',
    concentration: 'أكبر مساهم في الخسارة المتوقعة',
    baseline: 'مقارنة بالسيناريو الأساسي',
    share: 'من الخسارة المتوقعة للسيناريو',
    export: 'تنزيل السيناريو بصيغة CSV',
    note: 'محفظة توضيحية · EUR · ٣١ مارس ٢٠٢٦',
  },
} as const;

/** Derived from the same fixture as the charts and table, in every rendering mode. */
export function stressBriefing(scenario: StressScenario, locale: LocaleCode) {
  const copy = COPY[locale] ?? COPY.en;
  const t = createTranslator(locale);
  const top = scenario.bySector.reduce<(typeof scenario.bySector)[number] | undefined>(
    (largest, row) => (!largest || row.expectedLoss > largest.expectedLoss ? row : largest),
    undefined,
  );
  const sector = getSectors().find((item) => item.id === top?.sectorId);
  const money = (value: number) => t.formatCurrency(value, { notation: 'compact' });
  return {
    title: copy.title,
    exportLabel: copy.export,
    note: copy.note,
    items: [
      { label: copy.loss, value: money(scenario.totals.expectedLossDelta), detail: copy.baseline },
      { label: copy.capital, value: money(scenario.totals.rwaDelta), detail: copy.baseline },
      {
        label: copy.concentration,
        value: sector ? t.t(sector.nameKey) : t.t('common.na'),
        detail: `${t.formatPercent(scenario.totals.expectedLoss > 0 ? (top?.expectedLoss ?? 0) / scenario.totals.expectedLoss : 0, { maximumFractionDigits: 1 })} ${copy.share}`,
      },
    ],
  };
}

/** Machine-readable, unrounded EUR values and fraction rates; fixed field names. */
export function stressScenarioCsv(scenario: StressScenario): string {
  const header = [
    'scenario',
    'sector',
    'currency',
    'ead',
    'expected_loss',
    'expected_loss_delta',
    'rwa',
    'rwa_delta',
    'pd',
    'lgd',
  ];
  const rows = scenario.bySector.map((row) => [
    scenario.id,
    row.sectorId,
    'EUR',
    row.ead,
    row.expectedLoss,
    row.expectedLossDelta,
    row.rwa,
    row.rwaDelta,
    row.weightedAvgPd,
    row.weightedAvgLgd,
  ]);
  rows.push([
    scenario.id,
    'TOTAL',
    'EUR',
    scenario.totals.ead,
    scenario.totals.expectedLoss,
    scenario.totals.expectedLossDelta,
    scenario.totals.rwa,
    scenario.totals.rwaDelta,
    scenario.totals.weightedAvgPd,
    scenario.totals.weightedAvgLgd,
  ]);
  const quote = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
  return [header, ...rows].map((row) => row.map(quote).join(',')).join('\r\n') + '\r\n';
}

/** A download works even before hydration and requires no browser-only code. */
export function stressScenarioDownload(scenario: StressScenario) {
  return {
    href: `data:text/csv;charset=utf-8,${encodeURIComponent(stressScenarioCsv(scenario))}`,
    filename: `aurelia-${scenario.id}-2026-03-31.csv`,
  };
}
