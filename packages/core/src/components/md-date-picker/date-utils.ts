/**
 * Pure date helpers used by md-date-picker.
 *
 * Co-located with the component but exported separately so we can
 * unit-test them without booting a Stencil page, and so the component
 * file stays a single-default-export module (required by Stencil's
 * bundling rules).
 */

/** Pad a number to two digits (locale-independent). */
function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** ISO YYYY-MM-DD (local-time, NOT toISOString which is UTC). */
export function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Build a local-midnight Date when (year, month, day) is a real calendar day. */
function buildValidatedDate(
  year: number,
  month: number,
  day: number,
): Date | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(year, month - 1, day);
  if (
    d.getFullYear() !== year ||
    d.getMonth() !== month - 1 ||
    d.getDate() !== day
  ) {
    return null;
  }
  return d;
}

/** Escape a separator for use inside a RegExp character class or alternation. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Resolve the separator between day, month, and year segments.
 * When `explicit` is non-empty it wins; otherwise the locale's
 * `Intl.DateTimeFormat` literal is used (falls back to `/`).
 */
export function resolveDateSeparator(
  locale?: string,
  explicit?: string,
): string {
  if (explicit && explicit.length > 0) return explicit;
  try {
    const parts = new Intl.DateTimeFormat(locale || 'en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date(2000, 11, 31));
    const literal = parts.find((p) => p.type === 'literal');
    return literal?.value ?? '/';
  } catch {
    return '/';
  }
}

/**
 * Format a date for text-field display using locale field order and an
 * optional separator override (`date-separator` on the component).
 */
export function formatDisplayDate(
  d: Date,
  locale?: string,
  separator?: string,
): string {
  const sep = resolveDateSeparator(locale, separator);
  const parts = new Intl.DateTimeFormat(locale || undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  return parts
    .map((p) => {
      switch (p.type) {
        case 'day':
          return pad2(d.getDate());
        case 'month':
          return pad2(d.getMonth() + 1);
        case 'year':
          return String(d.getFullYear());
        case 'literal':
          return sep;
        default:
          return '';
      }
    })
    .join('');
}

/**
 * Locale-aware date format hint (e.g. `MM/DD/YYYY` or `DD.MM.YYYY`) with an
 * optional separator override.
 */
export function dateFormatPattern(locale?: string, separator?: string): string {
  const sep = resolveDateSeparator(locale, separator);
  const parts = new Intl.DateTimeFormat(locale || 'en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(2000, 11, 31));
  return parts
    .map((p) => {
      switch (p.type) {
        case 'day':
          return 'DD';
        case 'month':
          return 'MM';
        case 'year':
          return 'YYYY';
        case 'literal':
          return sep;
        default:
          return '';
      }
    })
    .join('');
}

/** True when the locale formats day before month (e.g. en-GB). */
function prefersDayFirst(locale?: string): boolean {
  try {
    const parts = new Intl.DateTimeFormat(locale || 'en-US').formatToParts(
      new Date(2025, 3, 3),
    );
    const dayIdx = parts.findIndex((p) => p.type === 'day');
    const monthIdx = parts.findIndex((p) => p.type === 'month');
    return dayIdx >= 0 && monthIdx >= 0 && dayIdx < monthIdx;
  } catch {
    return false;
  }
}

/**
 * Parse compact digit-only strings such as `06122025` (8) or `6122025` (7).
 * Year is always the trailing four digits.
 */
function parseCompactDateInput(digits: string, locale?: string): Date | null {
  if (digits.length === 8) {
    const a = Number.parseInt(digits.slice(0, 2), 10);
    const b = Number.parseInt(digits.slice(2, 4), 10);
    const year = Number.parseInt(digits.slice(4, 8), 10);
    let month: number;
    let day: number;

    if (a > 12 && b <= 12) {
      day = a;
      month = b;
    } else if (b > 12 && a <= 12) {
      month = a;
      day = b;
    } else if (a > 12 && b > 12) {
      return null;
    } else if (prefersDayFirst(locale)) {
      day = a;
      month = b;
    } else {
      month = a;
      day = b;
    }
    return buildValidatedDate(year, month, day);
  }

  if (digits.length === 7) {
    const year = Number.parseInt(digits.slice(3, 7), 10);
    const candidates: Array<{ month: number; day: number; pattern: string }> = [
      {
        month: Number.parseInt(digits.slice(0, 1), 10),
        day: Number.parseInt(digits.slice(1, 3), 10),
        pattern: 'MDD',
      },
      {
        day: Number.parseInt(digits.slice(0, 2), 10),
        month: Number.parseInt(digits.slice(2, 3), 10),
        pattern: 'DDM',
      },
      {
        month: Number.parseInt(digits.slice(0, 2), 10),
        day: Number.parseInt(digits.slice(2, 3), 10),
        pattern: 'MMD',
      },
    ];

    const valid = candidates
      .map((c) => ({
        ...c,
        date: buildValidatedDate(year, c.month, c.day),
      }))
      .filter((c) => c.date !== null);

    if (valid.length === 0) return null;
    if (valid.length === 1) return valid[0].date;

    const mddDay = Number.parseInt(digits.slice(1, 3), 10);
    const mddMonth = Number.parseInt(digits.slice(0, 1), 10);
    if (mddMonth >= 1 && mddMonth <= 9 && mddDay >= 10) {
      const mdd = valid.find((c) => c.pattern === 'MDD');
      if (mdd) return mdd.date;
    }

    const ddmDay = Number.parseInt(digits.slice(0, 2), 10);
    if (ddmDay > 12) {
      const ddm = valid.find((c) => c.pattern === 'DDM');
      if (ddm) return ddm.date;
    }

    const mmdMonth = Number.parseInt(digits.slice(0, 2), 10);
    if (mmdMonth > 12) {
      const mmd = valid.find((c) => c.pattern === 'MMD');
      if (mmd) return mmd.date;
    }

    const preferred = prefersDayFirst(locale) ? 'DDM' : 'MMD';
    const pick = valid.find((c) => c.pattern === preferred) ?? valid[0];
    return pick.date;
  }

  return null;
}

/**
 * Parse a user-typed date string into a local-midnight Date, or null.
 *
 * Accepts flexible separators (`/`, `-`, `.`, spaces) when no `separator` is
 * given, or only the configured `separator` when set. Optional leading zeros
 * on month/day, compact digit strings (`06122025`, `6122025`), and ISO
 * `YYYY-MM-DD` are always accepted. When the year has four digits, order is
 * inferred: `YYYY-M-D`, `M-D-YYYY`, or `D-M-YYYY` (when the first segment is
 * > 12 and the second is ≤ 12). Ambiguous compact/all-numeric orders fall back
 * to the locale hint.
 */
export function parseFlexibleDateInput(
  value: string,
  locale?: string,
  separator?: string,
): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const iso = parseIsoDate(trimmed);
  if (iso) return iso;

  if (/^\d+$/.test(trimmed)) {
    return parseCompactDateInput(trimmed, locale);
  }

  let parts: string[];
  if (separator && separator.length > 0) {
    parts = trimmed.split(new RegExp(escapeRegExp(separator))).filter(Boolean);
  } else {
    parts = trimmed.split(/[/\-.]|\s+/).filter(Boolean);
  }
  if (parts.length !== 3) return null;

  const nums = parts.map((p) => Number.parseInt(p, 10));
  if (nums.some((n) => Number.isNaN(n))) return null;

  let year: number;
  let month: number;
  let day: number;

  if (parts[0].length === 4 || nums[0] > 31) {
    [year, month, day] = nums;
  } else if (parts[2].length === 4 || nums[2] > 31) {
    if (nums[0] > 12 && nums[1] <= 12) {
      [day, month, year] = nums;
    } else if (nums[1] > 12 && nums[0] <= 12) {
      [month, day, year] = nums;
    } else if (prefersDayFirst(locale)) {
      [day, month, year] = nums;
    } else {
      [month, day, year] = nums;
    }
  } else {
    return null;
  }

  return buildValidatedDate(year, month, day);
}

/** Parse YYYY-MM-DD into a local-midnight Date, or null. */
export function parseIsoDate(value: string): Date | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const day = Number(m[3]);
  const d = new Date(y, mo, day);
  if (
    d.getFullYear() !== y ||
    d.getMonth() !== mo ||
    d.getDate() !== day
  ) {
    return null;
  }
  return d;
}

/** Number of days in the (year, month) where month is 0-indexed. */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** Resolve the first day-of-week index for the given BCP-47 locale.
 *  Returns 0 (Sunday) when the runtime can't tell us — that matches
 *  the en-US default. */
export function getFirstDayOfWeek(locale: string): number {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const IntlAny: any = Intl;
    const loc = new IntlAny.Locale(locale || 'en-US');
    if (typeof loc.getWeekInfo === 'function') {
      const w = loc.getWeekInfo();
      if (w && typeof w.firstDay === 'number') {
        return w.firstDay === 7 ? 0 : w.firstDay;
      }
    }
    if (loc.weekInfo && typeof loc.weekInfo.firstDay === 'number') {
      return loc.weekInfo.firstDay === 7 ? 0 : loc.weekInfo.firstDay;
    }
  } catch {
    /* ignore */
  }
  return 0;
}

/** YYYY-MM-DD comparison without timezone surprises. */
export function isoLte(a: string, b: string): boolean {
  return a <= b;
}

/** True when `a` is the same calendar day as `b`. */
export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Return a new Date `n` days after `d` (local time, no mutation). */
export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

/** Return a new Date `n` months after `d`, clamping the day-of-month so
 *  e.g. Jan 31 + 1 month → Feb 28/29 instead of spilling into March. */
export function addMonths(d: Date, n: number): Date {
  const target = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const lastDay = daysInMonth(target.getFullYear(), target.getMonth());
  return new Date(
    target.getFullYear(),
    target.getMonth(),
    Math.min(d.getDate(), lastDay),
  );
}

/** Clamp a date into the inclusive [minIso, maxIso] window. Returns the
 *  same date when already inside (or when a bound is absent). */
export function clampDate(
  d: Date,
  minIso: string,
  maxIso: string,
): Date {
  const iso = toIsoDate(d);
  if (minIso && !isoLte(minIso, iso)) {
    return parseIsoDate(minIso) ?? d;
  }
  if (maxIso && !isoLte(iso, maxIso)) {
    return parseIsoDate(maxIso) ?? d;
  }
  return d;
}

/** True when `d` lies outside the inclusive [minIso, maxIso] window. */
export function isOutOfRange(d: Date, minIso: string, maxIso: string): boolean {
  const iso = toIsoDate(d);
  if (minIso && !isoLte(minIso, iso)) return true;
  if (maxIso && !isoLte(iso, maxIso)) return true;
  return false;
}

/** A single rendered calendar cell. */
export interface DayCell {
  date: Date;
  /** Belongs to a month other than the one being displayed. */
  outOfMonth: boolean;
}

/**
 * Build a fixed 6-row (42-cell) calendar matrix for `(year, month)`,
 * starting on `firstDayOfWeek` (0 = Sunday … 6 = Saturday). Leading and
 * trailing cells are filled with the adjacent months' days, flagged
 * `outOfMonth` so the UI can mute them.
 */
export function buildMonthMatrix(
  year: number,
  month: number,
  firstDayOfWeek: number,
): DayCell[] {
  const first = new Date(year, month, 1);
  const firstWeekday = first.getDay();
  const lead = (firstWeekday - firstDayOfWeek + 7) % 7;
  const start = addDays(first, -lead);
  const cells: DayCell[] = [];
  for (let i = 0; i < 42; i++) {
    const date = addDays(start, i);
    cells.push({ date, outOfMonth: date.getMonth() !== month });
  }
  return cells;
}

/** Ordered short weekday names for a locale, rotated to `firstDayOfWeek`. */
export function weekdayNames(
  locale: string,
  firstDayOfWeek: number,
  format: 'narrow' | 'short' | 'long' = 'narrow',
): string[] {
  const fmt = new Intl.DateTimeFormat(locale || undefined, { weekday: format });
  // 2024-01-07 is a Sunday — a stable anchor for indexing weekdays 0..6.
  const names: string[] = [];
  for (let i = 0; i < 7; i++) {
    const idx = (firstDayOfWeek + i) % 7;
    names.push(fmt.format(new Date(2024, 0, 7 + idx)));
  }
  return names;
}
