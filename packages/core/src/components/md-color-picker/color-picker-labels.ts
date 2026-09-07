type Label = 'saturation' | 'hue' | 'opacity' | 'presets' | 'current';
const english: Record<Label, string> = {
  saturation: 'Saturation and brightness', hue: 'Hue', opacity: 'Opacity',
  presets: 'Color presets', current: 'Current colour',
};
const translations: Record<string, Record<Label, string>> = {
  ar: { saturation: 'التشبّع والسطوع', hue: 'درجة اللون', opacity: 'العتامة', presets: 'ألوان جاهزة', current: 'اللون الحالي' },
  ro: { saturation: 'Saturație și luminozitate', hue: 'Nuanță', opacity: 'Opacitate', presets: 'Culori predefinite', current: 'Culoarea curentă' },
};

export function colorPickerLabel(locale: string | undefined, key: Label): string {
  const language = (locale || 'en').trim().toLowerCase().split('-')[0];
  return translations[language]?.[key] ?? english[key];
}
