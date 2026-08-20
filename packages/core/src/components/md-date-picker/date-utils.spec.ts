import {
  parseFlexibleDateInput,
  parseIsoDate,
  toIsoDate,
  formatDisplayDate,
  dateFormatPattern,
  resolveDateSeparator,
} from './date-utils';

describe('parseFlexibleDateInput', () => {
  it('parses ISO YYYY-MM-DD', () => {
    const d = parseFlexibleDateInput('2025-06-15');
    expect(d).not.toBeNull();
    expect(toIsoDate(d!)).toBe('2025-06-15');
  });

  it('parses slash-separated dates with optional leading zeros', () => {
    expect(toIsoDate(parseFlexibleDateInput('1/5/2025')!)).toBe('2025-01-05');
    expect(toIsoDate(parseFlexibleDateInput('01/05/2025')!)).toBe('2025-01-05');
    expect(toIsoDate(parseFlexibleDateInput('12/31/2025')!)).toBe('2025-12-31');
  });

  it('parses dash-separated dates', () => {
    expect(toIsoDate(parseFlexibleDateInput('01-05-2025')!)).toBe('2025-01-05');
    expect(toIsoDate(parseFlexibleDateInput('1-5-2025')!)).toBe('2025-01-05');
  });

  it('parses dot-separated dates', () => {
    expect(toIsoDate(parseFlexibleDateInput('1.5.2025')!)).toBe('2025-01-05');
    expect(toIsoDate(parseFlexibleDateInput('01.05.2025')!)).toBe('2025-01-05');
  });

  it('parses space-separated dates', () => {
    expect(toIsoDate(parseFlexibleDateInput('1 5 2025')!)).toBe('2025-01-05');
    expect(toIsoDate(parseFlexibleDateInput('01 05 2025')!)).toBe('2025-01-05');
  });

  it('parses YYYY-M-D order', () => {
    expect(toIsoDate(parseFlexibleDateInput('2025-1-5')!)).toBe('2025-01-05');
    expect(toIsoDate(parseFlexibleDateInput('2025/6/15')!)).toBe('2025-06-15');
  });

  it('parses D-M-YYYY when the day segment exceeds 12', () => {
    expect(toIsoDate(parseFlexibleDateInput('17/1/2025')!)).toBe('2025-01-17');
    expect(toIsoDate(parseFlexibleDateInput('31-12-2025')!)).toBe('2025-12-31');
  });

  it('parses 8-digit compact strings as MMDDYYYY by default', () => {
    expect(toIsoDate(parseFlexibleDateInput('06122025')!)).toBe('2025-06-12');
    expect(toIsoDate(parseFlexibleDateInput('06172025')!)).toBe('2025-06-17');
    expect(toIsoDate(parseFlexibleDateInput('17012025')!)).toBe('2025-01-17');
  });

  it('uses locale for ambiguous 8-digit compact strings', () => {
    expect(toIsoDate(parseFlexibleDateInput('12062025', 'en-US')!)).toBe(
      '2025-12-06',
    );
    expect(toIsoDate(parseFlexibleDateInput('12062025', 'en-GB')!)).toBe(
      '2025-06-12',
    );
  });

  it('parses 7-digit compact strings (single-digit month)', () => {
    expect(toIsoDate(parseFlexibleDateInput('6122025')!)).toBe('2025-06-12');
    expect(toIsoDate(parseFlexibleDateInput('3122025')!)).toBe('2025-03-12');
  });

  it('returns null for invalid calendar dates', () => {
    expect(parseFlexibleDateInput('2/30/2025')).toBeNull();
    expect(parseFlexibleDateInput('0/5/2025')).toBeNull();
    expect(parseFlexibleDateInput('32/1/2025')).toBeNull();
    expect(parseFlexibleDateInput('')).toBeNull();
    expect(parseFlexibleDateInput('not-a-date')).toBeNull();
    expect(parseFlexibleDateInput('1/5')).toBeNull();
    expect(parseFlexibleDateInput('99999999')).toBeNull();
  });

  it('delegates to parseIsoDate for strict ISO validation', () => {
    expect(parseFlexibleDateInput('2025-02-30')).toBeNull();
    expect(parseIsoDate('2025-02-30')).toBeNull();
  });

  it('parses only the configured separator when set', () => {
    expect(toIsoDate(parseFlexibleDateInput('01/05/2025', 'en-US', '/')!)).toBe(
      '2025-01-05',
    );
    expect(toIsoDate(parseFlexibleDateInput('01.05.2025', 'en-US', '.')!)).toBe(
      '2025-01-05',
    );
    expect(parseFlexibleDateInput('01-05-2025', 'en-US', '/')).toBeNull();
    expect(parseFlexibleDateInput('01.05.2025', 'en-US', '/')).toBeNull();
  });

  it('still accepts ISO input when a custom separator is set', () => {
    expect(toIsoDate(parseFlexibleDateInput('2025-06-15', 'en-US', '.')!)).toBe(
      '2025-06-15',
    );
  });
});

describe('formatDisplayDate', () => {
  const june15 = new Date(2025, 5, 15);

  it('formats with locale default separator', () => {
    expect(formatDisplayDate(june15, 'en-US')).toMatch(/06[/.]15[/.]2025/);
  });

  it('formats with an explicit slash separator', () => {
    expect(formatDisplayDate(june15, 'en-US', '/')).toBe('06/15/2025');
  });

  it('formats with an explicit dot separator', () => {
    expect(formatDisplayDate(june15, 'de-DE', '.')).toBe('15.06.2025');
  });

  it('formats with an explicit dash separator', () => {
    expect(formatDisplayDate(june15, 'en-US', '-')).toBe('06-15-2025');
  });
});

describe('dateFormatPattern', () => {
  it('builds MM/DD/YYYY for en-US with slash separator', () => {
    expect(dateFormatPattern('en-US', '/')).toBe('MM/DD/YYYY');
  });

  it('builds DD.MM.YYYY for de-DE with dot separator', () => {
    expect(dateFormatPattern('de-DE', '.')).toBe('DD.MM.YYYY');
  });
});

describe('resolveDateSeparator', () => {
  it('returns explicit separator when provided', () => {
    expect(resolveDateSeparator('en-US', '.')).toBe('.');
  });

  it('derives separator from locale when not provided', () => {
    expect(resolveDateSeparator('en-US')).toBe('/');
  });
});
